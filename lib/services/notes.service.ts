import { createClient } from "@/lib/supabase/client";
import type {
  DBNote,
  DBNoteInsert,
  DBNoteUpdate,
} from "@/lib/types/note.types";

const supabase = createClient();

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
   * Get all notes for the current user
   */
  async getNotes(): Promise<{ data: DBNote[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Get a single note by ID
   */
  async getNoteById(
    id: string
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
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
   * Delete a note
   */
  async deleteNote(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("notes").delete().eq("id", id);

    return { error: error as Error | null };
  },
};
