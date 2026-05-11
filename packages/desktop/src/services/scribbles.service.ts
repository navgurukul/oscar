import { supabase } from "../supabase";
import type {
  DBScribble,
  DBScribbleInsert,
  DBScribbleUpdate,
} from "../types/scribble.types";

export const scribblesService = {
  /**
   * Create a new scribble in the database
   */
  async createScribble(
    scribble: DBScribbleInsert
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .insert(scribble)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Get all scribbles for the current user (excluding soft-deleted)
   */
  async getScribbles(): Promise<{ data: DBScribble[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Get a single scribble by ID (excluding soft-deleted)
   */
  async getScribbleById(
    id: string
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Update a scribble (primarily for editing text)
   */
  async updateScribble(
    id: string,
    updates: DBScribbleUpdate
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Soft delete a scribble by setting deleted_at
   */
  async deleteScribble(id: string): Promise<{ error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select();

    if (error) return { error: error as Error };
    // RLS may silently block the update → 0 rows returned
    if (!data || data.length === 0) {
      return { error: new Error("Delete failed: scribble not found or permission denied") };
    }
    return { error: null };
  },

  /**
   * Toggle the starred status of a scribble
   */
  async toggleStar(
    id: string,
    isStarred: boolean
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .update({ is_starred: isStarred })
      .eq("id", id)
      .select();

    if (error) return { data: null, error: error as Error };

    // .select() returns an array; if empty, RLS blocked the update
    const updated = data?.[0] ?? null;
    if (!updated) {
      return {
        data: null,
        error: new Error("Update failed: scribble not found or permission denied"),
      };
    }

    return { data: updated, error: null };
  },

  /**
   * Get all soft-deleted (trashed) scribbles for the current user
   */
  async getTrashedScribbles(): Promise<{
    data: DBScribble[] | null;
    error: Error | null;
  }> {
    const { data, error } = await supabase
      .from("scribbles")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Restore a soft-deleted scribble by clearing deleted_at
   */
  async restoreScribble(
    id: string
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("scribbles")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Permanently delete a scribble (hard delete)
   */
  async permanentDelete(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("scribbles").delete().eq("id", id);

    return { error: error as Error | null };
  },
};
