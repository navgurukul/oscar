/**
 * Usage Refresh API Route
 * POST /api/usage/increment
 *
 * NOTE: This endpoint no longer increments. The monthly recording counter is now
 * incremented authoritatively, server-side, in /api/ai/format (the recording
 * entry point for both web and desktop Scribbles) so a tampered client cannot
 * skip metering to earn unlimited AI spend. Incrementing here as well would
 * double-count. The route is retained at its original path for client
 * compatibility (SubscriptionContext.incrementUsage) and simply returns the
 * current authoritative usage so the UI can refresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageService } from "@/lib/services/usage.service";
import { RATE_LIMITS } from "@/lib/constants";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
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

    const rateLimitResult = await applyRateLimit(
      getClientIdentifier(user.id, request),
      "usage-increment",
      RATE_LIMITS.USAGE_WRITE
    );
    if (rateLimitResult) return rateLimitResult;

    // Read-only: return the current authoritative usage (incremented by the
    // format route, not here) so the client can refresh its displayed counts.
    const { allowed, remaining } = await usageService.canUserRecord(user.id);
    const recordingsThisMonth = await usageService.getMonthlyUsage(user.id);

    return NextResponse.json({
      success: true,
      recordingsThisMonth,
      remaining,
      canRecord: allowed,
    });
  } catch (error) {
    console.error("Usage refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
