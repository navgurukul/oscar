import { supabase } from "../supabase";
import type {
  DBScribble,
  DBScribbleInsert,
  DBScribbleUpdate,
} from "../types/scribble.types";

/**
 * Returns the signed-in user's id, or null if the session is gone. Used to
 * scope desktop list queries to the user's own rows so workspace-shared
 * scribbles from teammates do not surface in the "my scribbles" list until
 * desktop ships a dedicated team view.
 */
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

const PRIMARY_TABLE = "scribbles";
const LEGACY_TABLE = "notes";

type ScribbleTable = typeof PRIMARY_TABLE | typeof LEGACY_TABLE;
type SupabaseResult<T> = { data: T | null; error: unknown };

let resolvedTable: ScribbleTable | null = null;

function isMissingPrimaryTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return (
    code === "PGRST205" &&
    typeof message === "string" &&
    message.includes("public.scribbles")
  );
}

async function runScribbleQuery<T>(
  query: (table: ScribbleTable) => PromiseLike<SupabaseResult<T>>
): Promise<{ data: T | null; error: Error | null }> {
  const table = resolvedTable ?? PRIMARY_TABLE;
  const result = await query(table);

  if (table === PRIMARY_TABLE && result.error && isMissingPrimaryTable(result.error)) {
    const legacyResult = await query(LEGACY_TABLE);
    if (!legacyResult.error) {
      resolvedTable = LEGACY_TABLE;
    }
    return {
      data: legacyResult.data,
      error: legacyResult.error as Error | null,
    };
  }

  if (!result.error) {
    resolvedTable = table;
  }

  return { data: result.data, error: result.error as Error | null };
}

export const scribblesService = {
  /**
   * Create a new scribble in the database
   */
  async createScribble(
    scribble: DBScribbleInsert
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    return runScribbleQuery((table) =>
      supabase.from(table).insert(scribble).select().single()
    );
  },

  /**
   * Get all scribbles for the current user (excluding soft-deleted)
   */
  async getScribbles(): Promise<{ data: DBScribble[] | null; error: Error | null }> {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: new Error("Not signed in") };
    return runScribbleQuery((table) =>
      supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    );
  },

  /**
   * Get a single scribble by ID (excluding soft-deleted)
   */
  async getScribbleById(
    id: string
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    return runScribbleQuery((table) =>
      supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single()
    );
  },

  /**
   * Update a scribble (primarily for editing text)
   */
  async updateScribble(
    id: string,
    updates: DBScribbleUpdate
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    return runScribbleQuery((table) =>
      supabase
        .from(table)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
    );
  },

  /**
   * Soft delete a scribble by setting deleted_at
   */
  async deleteScribble(id: string): Promise<{ error: Error | null }> {
    const { data, error } = await runScribbleQuery<DBScribble[]>((table) =>
      supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select()
    );

    if (error) return { error };
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
    const { data, error } = await runScribbleQuery<DBScribble[]>((table) =>
      supabase
        .from(table)
        .update({ is_starred: isStarred })
        .eq("id", id)
        .select()
    );

    if (error) return { data: null, error };

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
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: new Error("Not signed in") };
    return runScribbleQuery((table) =>
      supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
    );
  },

  /**
   * Restore a soft-deleted scribble by clearing deleted_at
   */
  async restoreScribble(
    id: string
  ): Promise<{ data: DBScribble | null; error: Error | null }> {
    return runScribbleQuery((table) =>
      supabase
        .from(table)
        .update({ deleted_at: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
    );
  },

  /**
   * Permanently delete a scribble (hard delete)
   */
  async permanentDelete(id: string): Promise<{ error: Error | null }> {
    const { error } = await runScribbleQuery<null>((table) =>
      supabase.from(table).delete().eq("id", id).then((result) => ({
        data: null,
        error: result.error,
      }))
    );

    return { error };
  },
};
