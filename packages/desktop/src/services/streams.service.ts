// Desktop streams persistence. Called from the pill cleanup flow after a
// successful paste so users get a private history of every dictation in
// the web app /streams view. Failures are swallowed — persistence must
// never block the next paste.

import { supabase } from "../supabase";
import type { DBStreamInsert } from "@oscar/shared/types";

let cachedOrgId: string | null = null;
let cachedOrgFetchedAt = 0;
const ORG_CACHE_TTL_MS = 5 * 60 * 1000;

async function getActiveOrgId(userId: string): Promise<string | null> {
  const now = Date.now();
  if (cachedOrgId !== null && now - cachedOrgFetchedAt < ORG_CACHE_TTL_MS) {
    return cachedOrgId;
  }
  const { data } = await supabase
    .from("user_active_org")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  cachedOrgId = (data as { organization_id?: string } | null)?.organization_id ?? null;
  cachedOrgFetchedAt = now;
  return cachedOrgId;
}

export const streamsService = {
  invalidateOrgCache(): void {
    cachedOrgId = null;
    cachedOrgFetchedAt = 0;
  },

  /**
   * Persists a dictation. Returns the new row id when successful, null when
   * the user is signed out / the insert fails. Never throws.
   */
  async record(params: Omit<DBStreamInsert, "user_id" | "organization_id">): Promise<string | null> {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const organizationId = await getActiveOrgId(user.id);

      const { data, error } = await supabase
        .from("streams")
        .insert({
          ...params,
          user_id: user.id,
          organization_id: organizationId,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("[streams] insert failed", error);
        return null;
      }
      return (data as { id: string }).id;
    } catch (err) {
      console.warn("[streams] record threw", err);
      return null;
    }
  },
};
