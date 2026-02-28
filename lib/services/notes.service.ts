import { createClient } from "@/lib/supabase/client";
import type {
  DBNote,
  DBNoteInsert,
  DBNoteUpdate,
} from "@/lib/types/note.types";

/**
 * Get Supabase client instance
 * Uses singleton pattern to ensure consistent auth state
 */
function getSupabase() {
  return createClient();
}

export const notesService = {
  /**
   * Create a new note in the database
   */
  async createNote(
    note: DBNoteInsert
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .insert(note)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Get all notes for the current user (excluding soft-deleted)
   */
  async getNotes(): Promise<{ data: DBNote[] | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Get a single note by ID (excluding soft-deleted)
   */
  async getNoteById(
    id: string
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Update a note (primarily for editing text)
   */
  async updateNote(
    id: string,
    updates: DBNoteUpdate
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Soft delete a note by setting deleted_at
   */
  async deleteNote(id: string): Promise<{ error: Error | null }> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    return { error: error as Error | null };
  },

  /**
   * Toggle the starred status of a note
   */
  async toggleStar(
    id: string,
    isStarred: boolean
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    return this.updateNote(id, { is_starred: isStarred });
  },

  /**
   * Get notes with feedback for analysis
   * Useful for reviewing AI formatting quality
   */
  async getNotesWithFeedback(): Promise<{
    data: DBNote[] | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .not("feedback_helpful", "is", null)
      .order("feedback_timestamp", { ascending: false });

    return { data, error: error as Error | null };
  },
};
