/**
 * Usage Service
 * Tracks and enforces usage limits for subscriptions
 */

import { createClient } from "@supabase/supabase-js";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { subscriptionService } from "./subscription.service";

/**
 * Get Supabase admin client (bypasses RLS)
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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
   * Increment recording usage for a user
   * Returns the new count
   */
  async incrementRecordingUsage(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const monthYear = getCurrentMonthYear();

    // Try to upsert the usage record
    const { data: existing } = await supabase
      .from("usage_tracking")
      .select("id, recording_count")
      .eq("user_id", userId)
      .eq("month_year", monthYear)
      .single();

    if (existing) {
      // Update existing record
      const newCount = existing.recording_count + 1;
      await supabase
        .from("usage_tracking")
        .update({
          recording_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return newCount;
    } else {
      // Insert new record
      await supabase.from("usage_tracking").insert({
        user_id: userId,
        month_year: monthYear,
        recording_count: 1,
      });
      return 1;
    }
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
