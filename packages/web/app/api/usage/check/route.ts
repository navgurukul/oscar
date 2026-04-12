/**
 * Check Usage Limit API Route
 * GET /api/usage/check
 * GET /api/usage/check?type=note
 *
 * Pre-flight check to verify if user can record or save a note.
 * - Free tier: Limited to FREE_MONTHLY_RECORDINGS per month and FREE_MAX_NOTES total
 * - Pro tier: Unlimited
 * - Returns 402 Payment Required if limit exceeded
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usageService } from "@/lib/services/usage.service";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";

export async function GET(request: NextRequest) {
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

    const type = request.nextUrl.searchParams.get("type");

    if (type === "note") {
      const { allowed, current, remaining } = await usageService.canUserCreateNote(user.id);

      if (!allowed) {
        return NextResponse.json(
          {
            error: "Note limit reached",
            message:
              "You've reached your note limit. Upgrade to Pro for unlimited notes.",
            canCreateNote: false,
            current,
            remaining: 0,
            limit: SUBSCRIPTION_CONFIG.FREE_MAX_NOTES,
            upgradeRequired: true,
          },
          { status: 402 }
        );
      }

      return NextResponse.json({
        canCreateNote: true,
        current,
        remaining,
        limit: remaining !== null ? SUBSCRIPTION_CONFIG.FREE_MAX_NOTES : null,
      });
    }

    // Default: check recording quota
    const { allowed, current, remaining } = await usageService.canUserRecord(user.id);

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
      limit: remaining !== null ? SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS : null,
    });
  } catch (error) {
    console.error("Usage check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
