import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton instance for browser client
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create a singleton Supabase browser client
 * This ensures all parts of the app share the same client instance,
 * preventing auth state inconsistencies
 */
export function createClient() {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Create new instance only if it doesn't exist
  supabaseInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  return supabaseInstance;
}

/**
 * Get the existing Supabase client instance
 * Returns null if client hasn't been created yet
 */
export function getClient(): SupabaseClient | null {
  return supabaseInstance;
}

// De-duped, on-demand session-freshness check.
//
// `autoRefreshToken: true` is timer-based and best-effort: after the tab has
// been idle or backgrounded the refresh timer can lag, so the next request may
// carry an already-expired JWT. With RLS `auth.uid() = user_id` that makes a
// write silently fail (auth.uid() is NULL), surfacing as the createScribble
// "saved, but couldn't be loaded back" recovery path — the user effectively has
// to log out and back in. getSession() refreshes a stale token on demand and is
// a no-op when the token is still valid, so it's far cheaper than calling
// refreshSession() unconditionally before every write.
//
// Concurrent callers share one in-flight check so two writes never fire two
// refreshes against the same single-use refresh token — the race the desktop
// app hit in 094d092 ("Invalid Refresh Token: Already Used").
let inflightSessionCheck: Promise<void> | null = null;

export function ensureFreshSession(): Promise<void> {
  if (inflightSessionCheck) return inflightSessionCheck;

  const client = createClient();
  inflightSessionCheck = client.auth
    .getSession()
    .then(() => undefined)
    .catch((error) => {
      // Best-effort: if the refresh itself fails (e.g. a revoked refresh
      // token), let the caller proceed — the write's own error handling and
      // the AuthContext onAuthStateChange SIGNED_OUT listener will surface
      // re-authentication rather than throwing from here.
      console.warn("[auth] ensureFreshSession failed:", error);
    })
    .finally(() => {
      inflightSessionCheck = null;
    });

  return inflightSessionCheck;
}
