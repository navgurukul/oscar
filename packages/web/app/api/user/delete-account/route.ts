/**
 * Delete Account API Route
 * DELETE /api/user/delete-account
 *
 * Permanently deletes all user data and the account itself.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

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

    // Delete all user data first
    const [notesDeleteResult, vocabularyDeleteResult] = await Promise.all([
      supabase.from("notes").delete().eq("user_id", user.id),
      supabase.from("user_vocabulary").delete().eq("user_id", user.id),
    ]);

    if (notesDeleteResult.error) {
      console.error("Error deleting notes during account removal:", notesDeleteResult.error);
      return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
    }

    if (vocabularyDeleteResult.error) {
      console.error(
        "Error deleting vocabulary during account removal:",
        vocabularyDeleteResult.error
      );
      return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
    }

    // Delete the account using admin client (bypasses RLS)
    const adminClient = getSupabaseAdmin();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user account:", deleteError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
