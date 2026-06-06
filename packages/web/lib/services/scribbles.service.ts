import { createClient } from "@/lib/supabase/client";
import type {
  DBScribble,
  DBScribbleInsert,
  DBScribbleUpdate,
} from "@/lib/types/scribble.types";

/**
 * Get Supabase client instance
 * Uses singleton pattern to ensure consistent auth state
 */
function getSupabase() {
  return createClient();
}

function emptyWriteError(action: string) {
  return new Error(`${action} failed: scribble not found or permission denied`);
}

function partialWriteError(action: string) {
  return new Error(`${action} partially failed: one or more scribbles were not found or permission denied`);
}

export const scribblesService = {
  /**
   * Create a new scribble in the database
   */
  async createScribble(
    scribble: DBScribbleInsert
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const supabase = getSupabase();

    // Generate the id client-side so the row can be recovered by id if the
    // INSERT's RETURNING representation comes back empty (see below).
    const id = scribble.id ?? crypto.randomUUID();

    // Use .select() (array form) instead of .select().single(): if an INSERT
    // ever commits but its RETURNING representation comes back empty (a
    // transient read-after-write/visibility edge), .single() would throw
    // PGRST116 and turn a committed save into a false "Save failed". Recover by
    // re-reading the row by id rather than reporting data loss.
    const { data, error } = await supabase
      .from("scribbles")
      .insert({ ...scribble, id })
      .select();

    // A genuine insert failure (constraint / RLS WITH CHECK / network).
    if (error) {
      return { data: null, error: error as Error };
    }

    // Happy path: the row was written and returned.
    const created = data?.[0] ?? null;
    if (created) {
      return { data: created, error: null };
    }

    // Insert succeeded (no error) but RETURNING was empty — the row committed.
    // Re-read it by its known id rather than surfacing a false failure.
    const { data: recovered } = await supabase
      .from("scribbles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (recovered) {
      return { data: recovered, error: null };
    }

    // Still unreadable: almost always a broken deployed SELECT policy on
    // `scribbles` (the write most likely committed). Surface a precise,
    // non-destructive message instead of a generic save failure.
    return {
      data: null,
      error: new Error(
        "Your scribble was saved, but it couldn't be loaded back due to a permission/visibility issue. Refresh to see it."
      ),
    };
  },

  /**
   * Get all scribbles for the current user (excluding soft-deleted)
   */
  async getScribbles(): Promise<{ data: DBScribble[] | null; error: Error | null }> {
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      // maybeSingle(): a missing/soft-deleted row returns {data:null,error:null}
      // instead of throwing PGRST116, so callers can tell "not found" from a
      // real error rather than surfacing a misleading crash.
      .maybeSingle();

    return { data, error: error as Error | null };
  },

  /**
   * Update a scribble (primarily for editing text)
   */
  async updateScribble(
    id: string,
    updates: DBScribbleUpdate
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Update multiple scribbles in one request
   */
  async updateScribbles(
    ids: string[],
    updates: DBScribbleUpdate
  ): Promise<{ data: DBScribble[] | null; error: Error | null }> {
    if (ids.length === 0) {
      return { data: [], error: null };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .in("id", ids)
      .select("*");

    if (error) return { data: null, error: error as Error };
    if (!data || data.length === 0) {
      return { data: null, error: emptyWriteError("Update") };
    }
    if (data.length !== ids.length) {
      return { data: null, error: partialWriteError("Update") };
    }

    return { data, error: null };
  },

  /**
   * Soft delete a scribble by setting deleted_at
   */
  async deleteScribble(id: string): Promise<{ error: Error | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");

    if (error) return { error: error as Error };
    if (!data || data.length === 0) {
      return { error: emptyWriteError("Delete") };
    }

    return { error: null };
  },

  /**
   * Soft delete multiple scribbles
   */
  async deleteScribbles(
    ids: string[]
  ): Promise<{ data: DBScribble[] | null; error: Error | null }> {
    if (ids.length === 0) {
      return { data: [], error: null };
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select("*");

    if (error) return { data: null, error: error as Error };
    if (!data || data.length === 0) {
      return { data: null, error: emptyWriteError("Delete") };
    }
    if (data.length !== ids.length) {
      return { data: null, error: partialWriteError("Delete") };
    }

    return { data, error: null };
  },

  /**
   * Toggle the starred status of a scribble
   */
  async toggleStar(
    id: string,
    isStarred: boolean
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    const supabase = getSupabase();
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
   * Get scribbles with feedback for analysis
   * Useful for reviewing AI formatting quality
   */
  async getScribblesWithFeedback(): Promise<{
    data: DBScribble[] | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .select("*")
      .not("feedback_helpful", "is", null)
      .order("feedback_timestamp", { ascending: false });

    return { data, error: error as Error | null };
  },

  /**
   * Get all soft-deleted (trashed) scribbles for the current user
   */
  async getTrashedScribbles(): Promise<{
    data: DBScribble[] | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
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
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scribbles")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return { error: error as Error };
    if (!data || data.length === 0) {
      return { error: emptyWriteError("Delete") };
    }

    return { error: null };
  },

  /**
   * Get all unique folder names for the current user
   */
  async getFolders(): Promise<{ data: string[] | null; error: Error | null }> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("scribbles")
      .select("folder")
      .is("deleted_at", null)
      .not("folder", "is", null);

    if (error) return { data: null, error: error as Error };
    if (!data) return { data: [], error: null };

    const folders = Array.from(
      new Set(
        data
          .map((n: { folder: string | null }) => n.folder?.trim())
          .filter((folder): folder is string => Boolean(folder))
      )
    ).sort((left, right) => left.localeCompare(right));

    return { data: folders, error: null };
  },
};
