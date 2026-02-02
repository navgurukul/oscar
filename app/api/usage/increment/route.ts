/**
 * Increment Usage API Route
 * POST /api/usage/increment
 *
 * Increments recording usage for the current month
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageService } from "@/lib/services/usage.service";

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

    // Check if user can record
    const { allowed, current } = await usageService.canUserRecord(user.id);

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Recording limit reached",
          current,
          remaining: 0,
        },
        { status: 403 }
      );
    }

    // Increment usage
    const newCount = await usageService.incrementRecordingUsage(user.id);

    // Recalculate remaining
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
