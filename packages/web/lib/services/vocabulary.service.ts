import { createClient } from "@/lib/supabase/client";
import type {
  DBVocabularyEntry,
  DBVocabularyInsert,
  DBVocabularyUpdate,
} from "@/lib/types/vocabulary.types";

/**
 * Get Supabase client instance
 * Uses singleton pattern to ensure consistent auth state
 */
function getSupabase() {
  return createClient();
}

export const vocabularyService = {
  /**
   * Get all vocabulary entries for the current user
   */
  async getVocabulary(): Promise<{
    data: DBVocabularyEntry[] | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_vocabulary")
      .select("*")
      .order("created_at", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Add a new vocabulary entry
   */
  async addVocabularyEntry(
    entry: DBVocabularyInsert
  ): Promise<{ data: DBVocabularyEntry | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_vocabulary")
      .insert(entry)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Update an existing vocabulary entry
   */
  async updateVocabularyEntry(
    id: string,
    updates: DBVocabularyUpdate
  ): Promise<{ data: DBVocabularyEntry | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_vocabulary")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Delete a vocabulary entry
   */
  async deleteVocabularyEntry(id: string): Promise<{ error: Error | null }> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("user_vocabulary")
      .delete()
      .eq("id", id);

    return { error: error as Error | null };
  },

  /**
   * Get vocabulary count for the current user
   */
  async getVocabularyCount(): Promise<{
    count: number | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("user_vocabulary")
      .select("*", { count: "exact", head: true });

    return { count, error: error as Error | null };
  },
};
