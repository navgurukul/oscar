import { supabase } from "../supabase";
import type {
  DBNote,
  DBNoteInsert,
  DBNoteUpdate,
} from "../types/note.types";

export const notesService = {
  /**
   * Create a new note in the database
   */
  async createNote(
    note: DBNoteInsert
  ): Promise<{ data: DBNote | null; error: Error | null }> {
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
    const { data, error } = await supabase
      .from("notes")
      .update({ is_starred: isStarred })
      .eq("id", id)
      .select();

    if (error) return { data: null, error: error as Error };

    // .select() returns an array; if empty, RLS blocked the update
    const updated = data?.[0] ?? null;
    if (!updated) {
      return {
        data: null,
        error: new Error("Update failed: note not found or permission denied"),
      };
    }

    return { data: updated, error: null };
  },

  /**
   * Get all soft-deleted (trashed) notes for the current user
   */
  async getTrashedNotes(): Promise<{
    data: DBNote[] | null;
    error: Error | null;
  }> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Restore a soft-deleted note by clearing deleted_at
   */
  async restoreNote(
    id: string
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("notes")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Permanently delete a note (hard delete)
   */
  async permanentDelete(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("notes").delete().eq("id", id);

    return { error: error as Error | null };
  },
};
