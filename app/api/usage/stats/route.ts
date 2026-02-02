/**
 * Usage Stats API Route
 * GET /api/usage/stats
 *
 * Returns user's subscription and usage statistics
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionService } from "@/lib/services/subscription.service";
import { usageService } from "@/lib/services/usage.service";
import type { UsageStatsResponse } from "@/lib/types/subscription.types";

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

    // Get or create subscription
    const { data: subscription, error: subError } =
      await subscriptionService.getOrCreateSubscription(user.id);

    if (subError) {
      console.error("Error getting subscription:", subError);
      return NextResponse.json(
        { error: "Failed to get subscription" },
        { status: 500 }
      );
    }

    // Get usage stats
    const usageStats = await usageService.getUsageStats(user.id);

    const response: UsageStatsResponse = {
      tier: subscription?.tier || "free",
      status: subscription?.status || "active",
      billingCycle: subscription?.billing_cycle || null,
      currentPeriodEnd: subscription?.current_period_end || null,
      recordingsThisMonth: usageStats.recordingsThisMonth,
      recordingsLimit: usageStats.recordingsLimit,
      notesCount: usageStats.notesCount,
      notesLimit: usageStats.notesLimit,
      isProUser: usageStats.isProUser,
      canRecord: usageStats.canRecord,
      canCreateNote: usageStats.canCreateNote,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Usage stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
