/**
 * Clear User Data API Route
 * DELETE /api/user/clear-data
 *
 * Permanently deletes all scribbles and vocabulary for the authenticated user.
 * The account itself is preserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAllUserData } from "@/lib/server/delete-user-data";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

export async function DELETE(request: NextRequest) {
  try {
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
      "user-clear-data",
      RATE_LIMITS.USER_DESTRUCTIVE
    );
    if (rateLimitResult) return rateLimitResult;

    const { error } = await deleteAllUserData(supabase, user.id);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
