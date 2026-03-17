import { createClient } from "@/lib/supabase/client";
import type {
  DBNote,
  DBNoteInsert,
  DBNoteUpdate,
  DBFolder,
  DBFolderInsert,
  DBFolderUpdate,
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
   * Move a note to a folder (or remove from folder with null)
   */
  async moveNoteToFolder(
    id: string,
    folderId: string | null
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    return this.updateNote(id, { folder_id: folderId });
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
    const supabase = getSupabase();
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

  /**
   * Get all soft-deleted (trashed) notes for the current user
   */
  async getTrashedNotes(): Promise<{
    data: DBNote[] | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    const { error } = await supabase.from("notes").delete().eq("id", id);

    return { error: error as Error | null };
  },

  // ------------- Folders -------------
  async getFolders(): Promise<{ data: DBFolder[] | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    return { data, error: error as Error | null };
    },

  async createFolder(
    folder: DBFolderInsert
  ): Promise<{ data: DBFolder | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("folders")
      .insert(folder)
      .select()
      .single();
    return { data, error: error as Error | null };
  },

  async updateFolder(
    id: string,
    updates: DBFolderUpdate
  ): Promise<{ data: DBFolder | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("folders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return { data, error: error as Error | null };
  },

  async deleteFolder(id: string): Promise<{ error: Error | null }> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("folders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    return { error: error as Error | null };
  },

  // ------------- Sharing -------------
  async enableShare(
    id: string
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    const g = globalThis as unknown as {
      crypto?: { randomUUID?: () => string };
    };
    const token =
      g.crypto && typeof g.crypto.randomUUID === "function"
        ? g.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return this.updateNote(id, { share_enabled: true, share_token: token });
  },

  async disableShare(
    id: string
  ): Promise<{ data: DBNote | null; error: Error | null }> {
    return this.updateNote(id, {
      share_enabled: false,
      share_token: null,
      share_expires_at: null,
    });
  },
};
