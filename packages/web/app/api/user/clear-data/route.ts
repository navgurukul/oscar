/**
 * Clear User Data API Route
 * DELETE /api/user/clear-data
 *
 * Permanently deletes all notes and vocabulary for the authenticated user.
 * The account itself is preserved.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAllUserData } from "@/lib/server/delete-user-data";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
