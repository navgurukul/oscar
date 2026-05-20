/**
 * Usage Service
 * Tracks and enforces usage limits for subscriptions
 */

import { SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getActiveOrg } from "@/lib/server/organization";
import { subscriptionService } from "./subscription.service";

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Resolves a user id to their active organization id. Centralised so every
 * user-keyed wrapper can reuse the same lookup.
 */
async function resolveUserOrgId(userId: string): Promise<string | null> {
  const active = await getActiveOrg(userId);
  return active?.organization.id ?? null;
}

export const usageService = {
  /**
   * Shared monthly recording counter for the org's active row.
   */
  async getOrgMonthlyUsage(organizationId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const monthYear = getCurrentMonthYear();
    const { data, error } = await supabase
      .from("usage_tracking")
      .select("recording_count")
      .eq("organization_id", organizationId)
      .eq("month_year", monthYear)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching org usage:", error);
      return 0;
    }
    return data?.recording_count ?? 0;
  },

  /**
   * Atomic increment of the org's shared monthly recording counter.
   * Falls back to non-atomic upsert if the RPC is not yet deployed.
   */
  async incrementOrgRecordingUsage(
    organizationId: string,
    userId: string
  ): Promise<number> {
    const supabase = getSupabaseAdmin();
    const monthYear = getCurrentMonthYear();

    const { data, error } = await supabase.rpc("increment_org_recording_usage", {
      p_org_id: organizationId,
      p_user_id: userId,
      p_month_year: monthYear,
    });

    if (!error) return (data as number) ?? 1;

    console.error(
      "increment_org_recording_usage RPC failed, falling back:",
      error.message
    );

    const { data: existing } = await supabase
      .from("usage_tracking")
      .select("id, recording_count")
      .eq("organization_id", organizationId)
      .eq("month_year", monthYear)
      .maybeSingle();

    if (existing) {
      const newCount = existing.recording_count + 1;
      const { error: updateError } = await supabase
        .from("usage_tracking")
        .update({
          recording_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
      return newCount;
    }

    const { error: insertError } = await supabase.from("usage_tracking").insert({
      organization_id: organizationId,
      user_id: userId,
      month_year: monthYear,
      recording_count: 1,
    });
    if (insertError) throw insertError;
    return 1;
  },

  /**
   * Back-compat user-keyed monthly usage — routes through active org.
   */
  async getMonthlyUsage(userId: string): Promise<number> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return 0;
    return this.getOrgMonthlyUsage(orgId);
  },

  /**
   * Back-compat user-keyed increment — routes through active org.
   */
  async incrementRecordingUsage(userId: string): Promise<number> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) {
      throw new Error("Cannot increment usage: user has no active workspace.");
    }
    return this.incrementOrgRecordingUsage(orgId, userId);
  },

  /**
   * Org-scoped recording quota check.
   *   Free: shared FREE_ORG_MONTHLY_RECORDINGS across all members.
   *   Pro:  unlimited.
   */
  async canOrgRecord(
    organizationId: string
  ): Promise<{ allowed: boolean; remaining: number | null; current: number }> {
    const isProOrg = await subscriptionService.isOrgPro(organizationId);
    if (isProOrg) {
      return { allowed: true, remaining: null, current: 0 };
    }
    const currentUsage = await this.getOrgMonthlyUsage(organizationId);
    const limit = SUBSCRIPTION_CONFIG.FREE_ORG_MONTHLY_RECORDINGS;
    return {
      allowed: currentUsage < limit,
      remaining: Math.max(0, limit - currentUsage),
      current: currentUsage,
    };
  },

  /**
   * Back-compat user-keyed gate — routes through active org.
   */
  async canUserRecord(
    userId: string
  ): Promise<{ allowed: boolean; remaining: number | null; current: number }> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return { allowed: false, remaining: 0, current: 0 };
    return this.canOrgRecord(orgId);
  },

  /**
   * Get total scribble count for a user
   */
  async getUserScribbleCount(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();

    const { count, error } = await supabase
      .from("scribbles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching scribble count:", error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Check if user can create a new scribble
   */
  async canUserCreateScribble(
    userId: string
  ): Promise<{ allowed: boolean; remaining: number | null; current: number }> {
    // Check if user is pro
    const isProUser = await subscriptionService.isProUser(userId);

    if (isProUser) {
      return { allowed: true, remaining: null, current: 0 };
    }

    // Get current scribble count
    const currentCount = await this.getUserScribbleCount(userId);
    const limit = SUBSCRIPTION_CONFIG.FREE_MAX_SCRIBBLES;
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount < limit,
      remaining,
      current: currentCount,
    };
  },

  /**
   * Comprehensive usage stats for a user, scoped to their active org.
   * recordingsThisMonth + recordingsLimit reflect the shared org counter.
   * scribblesCount + scribblesLimit stay user-scoped (per-creator cap).
   */
  async getUsageStats(userId: string): Promise<{
    recordingsThisMonth: number;
    recordingsLimit: number | null;
    scribblesCount: number;
    scribblesLimit: number | null;
    isProUser: boolean;
    canRecord: boolean;
    canCreateScribble: boolean;
  }> {
    const orgId = await resolveUserOrgId(userId);
    const isProUser = orgId ? await subscriptionService.isOrgPro(orgId) : false;
    const recordingsThisMonth = orgId
      ? await this.getOrgMonthlyUsage(orgId)
      : 0;
    const scribblesCount = await this.getUserScribbleCount(userId);

    const recordingsLimit = isProUser
      ? null
      : SUBSCRIPTION_CONFIG.FREE_ORG_MONTHLY_RECORDINGS;
    const scribblesLimit = isProUser ? null : SUBSCRIPTION_CONFIG.FREE_MAX_SCRIBBLES;

    const canRecord = isProUser
      ? true
      : recordingsThisMonth < SUBSCRIPTION_CONFIG.FREE_ORG_MONTHLY_RECORDINGS;
    const canCreateScribble = isProUser
      ? true
      : scribblesCount < SUBSCRIPTION_CONFIG.FREE_MAX_SCRIBBLES;

    return {
      recordingsThisMonth,
      recordingsLimit,
      scribblesCount,
      scribblesLimit,
      isProUser,
      canRecord,
      canCreateScribble,
    };
  },
};
