// Session resilience for the desktop AI path.
//
// Background: the Supabase access token (JWT) is short-lived and rotated using a
// single-use refresh token. A hard restart (e.g. auto-update relaunch) kills the
// in-memory auto-refresh timer; on relaunch the persisted refresh token can be
// stale/already-rotated, so `getSession()` resolves to no usable token. Every
// authenticated call then throws — and the dictation flow silently swallows that
// and pastes the raw transcript, so the user just sees "AI stopped working".
//
// This module centralizes token retrieval so that:
//   1. a near-expired token is transparently refreshed once (heals the transient
//      "Invalid Refresh Token: Already Used" race), and
//   2. a genuinely dead session surfaces as a typed AuthSessionError, the signal
//      callers use to prompt re-auth instead of degrading silently.

import { supabase } from "../supabase";

/** Thrown when the session is unrecoverable and the user must sign in again. */
export class AuthSessionError extends Error {
  constructor(message = "AI features require a valid OSCAR sign-in.") {
    super(message);
    this.name = "AuthSessionError";
  }
}

// Edge functions / web routes report auth failure as a 401 with varied wording;
// match the common shapes so a server-side rejection is treated like a dead
// session rather than a generic (silently-swallowed) error.
const AUTH_ERROR_PATTERN =
  /\b(jwt|unauthori[sz]ed|not authenticated|sign[\s-]?in|401|refresh token|invalid token|token (?:is )?expired)\b/i;

/** True when `err` indicates the session is invalid/expired (vs. a generic failure). */
export function isAuthSessionError(err: unknown): boolean {
  if (err instanceof AuthSessionError) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return AUTH_ERROR_PATTERN.test(message);
}

// Refresh a token within this window of expiry rather than letting a call go out
// with one that's about to die mid-flight.
const REFRESH_SKEW_SECONDS = 60;

function isExpiringSoon(expiresAt: number | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt - Math.floor(Date.now() / 1000) <= REFRESH_SKEW_SECONDS;
}

/**
 * Returns a usable access token, transparently refreshing once when the stored
 * one is missing or (near-)expired. Throws {@link AuthSessionError} only when the
 * session is genuinely unrecoverable (dead/rotated refresh token).
 */
export async function getValidAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token && !isExpiringSoon(session.expires_at)) {
    return session.access_token;
  }

  // Missing or near-expiry → attempt a single refresh. supabase-js dedupes
  // concurrent refreshes internally, so this is safe alongside revalidate.
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    throw new AuthSessionError();
  }
  return data.session.access_token;
}

/**
 * Validates the persisted session and clears it locally when unrecoverable, so
 * the app falls back to the sign-in screen instead of holding a dead session
 * that silently fails every authenticated call. Returns `true` when a usable
 * session remains.
 *
 * @param opts.force revalidate even a not-yet-expired token (used after an auth
 *   failure mid-dictation, where the stored token may look valid but the server
 *   has already rejected it).
 */
export async function revalidateSession(
  opts: { force?: boolean } = {},
): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // No session: already signed out — the sign-in screen handles it.
  if (!session) return false;

  if (!opts.force && !isExpiringSoon(session.expires_at)) return true;

  const { error } = await supabase.auth.refreshSession();
  if (error) {
    // Dead/rotated refresh token. Clear locally → onAuthStateChange fires
    // SIGNED_OUT → the app renders AuthScreen for re-authentication.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return false;
  }
  return true;
}
