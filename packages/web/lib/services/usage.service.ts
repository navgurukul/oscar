/**
 * Usage Service
 * Tracks and enforces usage limits for subscriptions
 */

import { SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
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

export const usageService = {
  /**
   * Get monthly recording usage for a user
   */
  async getMonthlyUsage(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const monthYear = getCurrentMonthYear();

    const { data, error } = await supabase
      .from("usage_tracking")
      .select("recording_count")
      .eq("user_id", userId)
      .eq("month_year", monthYear)
      .single();

    if (error && error.code === "PGRST116") {
      // No usage record for this month
      return 0;
    }

    if (error) {
      console.error("Error fetching usage:", error);
      return 0;
    }

    return data?.recording_count || 0;
  },

  /**
   * Increment recording usage for a user atomically.
   * Uses INSERT ... ON CONFLICT DO UPDATE to avoid the read-then-write
   * race condition where two concurrent requests could both read the same
   * count and each write count+1 instead of count+2.
   * Returns the new count.
   */
  async incrementRecordingUsage(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const monthYear = getCurrentMonthYear();

    // Atomic upsert: if row exists increment in-place, otherwise insert with 1.
    // The raw SQL expression `recording_count + 1` is evaluated by Postgres in a
    // single statement, so concurrent calls cannot clobber each other.
    const { data, error } = await supabase.rpc("increment_recording_usage", {
      p_user_id: userId,
      p_month_year: monthYear,
    });

    if (error) {
      // Fall back to non-atomic upsert if the RPC is not yet deployed,
      // so existing deployments degrade gracefully rather than hard-crash.
      console.error(
        "increment_recording_usage RPC failed, falling back:",
        error.message
      );

      const { data: existing } = await supabase
        .from("usage_tracking")
        .select("id, recording_count")
        .eq("user_id", userId)
        .eq("month_year", monthYear)
        .single();

      if (existing) {
        const newCount = existing.recording_count + 1;
        const { error: updateError } = await supabase
          .from("usage_tracking")
          .update({
            recording_count: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          throw updateError;
        }

        return newCount;
      } else {
        const { error: insertError } = await supabase.from("usage_tracking").insert({
          user_id: userId,
          month_year: monthYear,
          recording_count: 1,
        });

        if (insertError) {
          throw insertError;
        }

        return 1;
      }
    }

    return (data as number) ?? 1;
  },

  /**
   * Check if user can create a new recording
   * 
   * Compares current monthly usage against tier limits:
   * - Free tier: LIMITED to FREE_MONTHLY_RECORDINGS (10 per month)
   * - Pro tier: UNLIMITED recordings
   * 
   * @returns {allowed: boolean, remaining: number | null, current: number}
   *   - allowed: true if user can record, false if limit reached
   *   - remaining: recordings left this month (null for pro users)
   *   - current: total recordings this month
   */
  async canUserRecord(
    userId: string
  ): Promise<{ allowed: boolean; remaining: number | null; current: number }> {
    // Check if user is pro
    const isProUser = await subscriptionService.isProUser(userId);

    if (isProUser) {
      return { allowed: true, remaining: null, current: 0 };
    }

    // Get current usage via get_monthly_usage() database function
    const currentUsage = await this.getMonthlyUsage(userId);
    const limit = SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS; // 10 for free tier
    const remaining = Math.max(0, limit - currentUsage);

    return {
      allowed: currentUsage < limit,
      remaining,
      current: currentUsage,
    };
  },

  /**
   * Get total note count for a user
   */
  async getUserNoteCount(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();

    const { count, error } = await supabase
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching note count:", error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Check if user can create a new note
   */
  async canUserCreateNote(
    userId: string
  ): Promise<{ allowed: boolean; remaining: number | null; current: number }> {
    // Check if user is pro
    const isProUser = await subscriptionService.isProUser(userId);

    if (isProUser) {
      return { allowed: true, remaining: null, current: 0 };
    }

    // Get current note count
    const currentCount = await this.getUserNoteCount(userId);
    const limit = SUBSCRIPTION_CONFIG.FREE_MAX_NOTES;
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount < limit,
      remaining,
      current: currentCount,
    };
  },

  /**
   * Get comprehensive usage stats for a user
   */
  async getUsageStats(userId: string): Promise<{
    recordingsThisMonth: number;
    recordingsLimit: number | null;
    notesCount: number;
    notesLimit: number | null;
    isProUser: boolean;
    canRecord: boolean;
    canCreateNote: boolean;
  }> {
    const isProUser = await subscriptionService.isProUser(userId);
    const recordingsThisMonth = await this.getMonthlyUsage(userId);
    const notesCount = await this.getUserNoteCount(userId);

    const recordingsLimit = isProUser
      ? null
      : SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS;
    const notesLimit = isProUser ? null : SUBSCRIPTION_CONFIG.FREE_MAX_NOTES;

    const canRecord = isProUser
      ? true
      : recordingsThisMonth < SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS;
    const canCreateNote = isProUser
      ? true
      : notesCount < SUBSCRIPTION_CONFIG.FREE_MAX_NOTES;

    return {
      recordingsThisMonth,
      recordingsLimit,
      notesCount,
      notesLimit,
      isProUser,
      canRecord,
      canCreateNote,
    };
  },
};
