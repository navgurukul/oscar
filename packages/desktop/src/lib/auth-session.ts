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

/**
 * True when a refresh failure is plausibly transient (offline / flaky network /
 * server-side 5xx) rather than a genuine credential rejection. These must NOT
 * sign the user out or bounce them to re-auth — the cached session stays valid
 * and we retry later. A real auth rejection (e.g. 401, rotated refresh token)
 * carries a 4xx status and is not retryable, so it still clears the session.
 */
export function isRetryableAuthFailure(error: unknown): boolean {
  // Browser reports no connectivity — always retryable, regardless of error.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; status?: number };
  // supabase-js wraps fetch/network failures in this class.
  if (e.name === "AuthRetryableFetchError") return true;
  // No status (network never reached the server), 0, or a 5xx are all transient.
  const status = e.status;
  return status === undefined || status === 0 || status >= 500;
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
    // A transient/offline failure must not be mistaken for a dead session:
    // throwing AuthSessionError would force the re-auth screen. Surface a plain
    // network error instead so the caller keeps the raw-transcript fallback.
    if (isRetryableAuthFailure(error)) {
      throw new Error("Network unavailable");
    }
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
 * @param opts.force revalidate even a not-yet-expired token. Used at launch and
 *   after an auth failure mid-dictation: `getSession()` returns the cached
 *   session from disk without contacting the server, so a not-yet-expired
 *   access token can sit on top of a dead/rotated refresh token. Forcing a
 *   refresh is the only way to detect that before the next AI call hits it (and
 *   surfaces as the "Sign in to enable AI" pill).
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
    // A transient/offline network failure must NOT sign the user out — keep the
    // cached session so they stay logged in offline and retry on the next
    // focus/launch. Report it as still-valid rather than tearing it down.
    if (isRetryableAuthFailure(error)) {
      return true;
    }
    // Only a genuine auth rejection (dead/rotated refresh token) should clear
    // the session: clearing it → onAuthStateChange fires SIGNED_OUT → the app
    // renders AuthScreen.
    if (isAuthSessionError(error)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    return false;
  }
  return true;
}
