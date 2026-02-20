/**
 * Check Usage Limit API Route
 * GET /api/usage/check
 *
 * Pre-flight check to verify if user can record before starting
 * - Free tier: Limited to FREE_MONTHLY_RECORDINGS per month (10)
 * - Pro tier: Unlimited recordings
 * - Returns 402 Payment Required if limit exceeded
 * 
 * Called before recording starts to prevent free users from exceeding quota.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageService } from "@/lib/services/usage.service";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";

export async function GET() {
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

    // Check if user can record
    const { allowed, current, remaining } = await usageService.canUserRecord(
      user.id
    );

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Recording limit reached",
          message:
            "You've reached your monthly recording limit. Upgrade to Pro for unlimited recordings.",
          canRecord: false,
          current,
          remaining: 0,
          limit: SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS,
          upgradeRequired: true,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      canRecord: true,
      current,
      remaining,
      limit: allowed ? SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS : null,
    });
  } catch (error) {
    console.error("Usage check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
