// Desktop org context builder. Mirrors the web's buildOrgContext but reads
// straight off the Supabase client (RLS already lets a member see their own
// + their org's vocabulary and the org's documents). Result is cached in
// memory for ~5 min so each pill dictation does not re-fetch.

import { supabase } from "../supabase";

import { WEB_APP_URL } from "../lib/web-app-url";

interface CachedContext {
  block: string;
  fetchedAt: number;
  organizationId: string | null;
  organizationName: string | null;
  rawTranscript: string;
  profile: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: CachedContext | null = null;

async function getSessionAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("AI features require a valid OSCAR sign-in.");
  }

  return session.access_token;
}

export const orgContextService = {
  invalidate(): void {
    cached = null;
  },

  /**
   * Returns the prompt-ready context block for the active workspace. Empty
   * string when the user has no active org or both vocab + docs come back empty.
   * Safe to await on every AI call — cached for 5 minutes per session.
   */
  async getBlock(options: {
    rawTranscript?: string;
    profile?: "stream" | "scribble" | "minutes";
  } = {}): Promise<{
    block: string;
    organizationId: string | null;
    organizationName: string | null;
  }> {
    const now = Date.now();
    const rawTranscript = options.rawTranscript || "";
    const profile = options.profile || "scribble";

    if (
      cached &&
      now - cached.fetchedAt < CACHE_TTL_MS &&
      cached.rawTranscript === rawTranscript &&
      cached.profile === profile
    ) {
      return {
        block: cached.block,
        organizationId: cached.organizationId,
        organizationName: cached.organizationName,
      };
    }

    try {
      const accessToken = await getSessionAccessToken();
      const response = await fetch(`${WEB_APP_URL}/api/ai/context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          rawTranscript,
          profile,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to compile context: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        block: string;
        organizationId: string | null;
        organizationName: string | null;
      };

      cached = {
        block: data.block,
        fetchedAt: now,
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        rawTranscript,
        profile,
      };

      return {
        block: data.block,
        organizationId: data.organizationId,
        organizationName: data.organizationName,
      };
    } catch (err) {
      console.warn("[orgContext] build failed, returning empty block", err);
      return { block: "", organizationId: null, organizationName: null };
    }
  },
};
