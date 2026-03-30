/**
 * Increment Usage API Route
 * POST /api/usage/increment
 *
 * Pre-flight enforcement: Checks monthly recording limit BEFORE incrementing usage.
 * - Free tier: Limited to FREE_MONTHLY_RECORDINGS per month (10)
 * - Pro tier: Unlimited recordings
 * - Returns 402 Payment Required if free user exceeds quota
 * 
 * This prevents free users from processing recordings beyond their monthly limit.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageService } from "@/lib/services/usage.service";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";

export async function POST() {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // PRE-FLIGHT CHECK: Verify user hasn't exceeded monthly limit
    // This calls get_monthly_usage() internally and compares against tier limits
    const { allowed, current } = await usageService.canUserRecord(user.id);

    if (!allowed) {
      // Return 402 Payment Required to signal upgrade needed
      return NextResponse.json(
        {
          error: "Recording limit reached",
          message: "You've reached your monthly recording limit. Upgrade to Pro for unlimited recordings.",
          current,
          remaining: 0,
          upgradeRequired: true,
          limit: SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Limit check passed - increment usage
    const newCount = await usageService.incrementRecordingUsage(user.id);

    // Recalculate remaining after increment
    const usageStats = await usageService.canUserRecord(user.id);

    return NextResponse.json({
      success: true,
      recordingsThisMonth: newCount,
      remaining: usageStats.remaining,
      canRecord: usageStats.allowed,
    });
  } catch (error) {
    console.error("Increment usage error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
