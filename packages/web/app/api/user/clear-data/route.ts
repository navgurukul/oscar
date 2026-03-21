/**
 * Clear User Data API Route
 * DELETE /api/user/clear-data
 *
 * Permanently deletes all notes and vocabulary for the authenticated user.
 * The account itself is preserved.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const [notesResult, vocabularyResult] = await Promise.all([
      supabase.from("notes").delete().eq("user_id", user.id),
      supabase.from("user_vocabulary").delete().eq("user_id", user.id),
    ]);

    if (notesResult.error) {
      console.error("Error deleting notes:", notesResult.error);
      return NextResponse.json({ error: "Failed to clear notes" }, { status: 500 });
    }

    if (vocabularyResult.error) {
      console.error("Error deleting vocabulary:", vocabularyResult.error);
      return NextResponse.json({ error: "Failed to clear vocabulary" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
