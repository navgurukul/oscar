/**
 * Shared helper for deleting all user-owned data from the database.
 * Used by both the clear-data and delete-account routes so the
 * deletion logic stays in one place.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DeleteUserDataResult {
  error: string | null;
}

/**
 * Permanently delete all scribbles and vocabulary for a given user.
 * Does NOT delete the auth account — call supabase.auth.admin.deleteUser
 * separately if account removal is needed.
 */
export async function deleteAllUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<DeleteUserDataResult> {
  const [scribblesResult, vocabularyResult] = await Promise.all([
    supabase.from("scribbles").delete().eq("user_id", userId),
    supabase.from("user_vocabulary").delete().eq("user_id", userId),
  ]);

  if (scribblesResult.error) {
    console.error("Error deleting scribbles:", scribblesResult.error);
    return { error: "Failed to delete scribbles" };
  }

  if (vocabularyResult.error) {
    console.error("Error deleting vocabulary:", vocabularyResult.error);
    return { error: "Failed to delete vocabulary" };
  }

  return { error: null };
}
