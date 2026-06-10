// Guards the OAuth deep-link against session injection.
//
// The app signs in by opening the system browser; the web app then fires an
// `oscar://auth/callback?access_token=...&refresh_token=...` deep link back.
// Without a guard, ANY local process or web page could fire that scheme with an
// attacker's tokens and silently switch the app into the attacker's account —
// the victim's dictated notes would then save into the attacker's account.
//
// Defense: immediately before opening the browser we mint a single-use nonce
// and stash it in localStorage. The web app round-trips that nonce back as the
// `state` query param on the callback (AuthScreen appends it as
// `?desktop_state=`, desktop-callback forwards it as `&state=`). The deep-link
// handler accepts the callback ONLY when a fresh flow is in progress AND the
// returned nonce matches. We FAIL CLOSED: a missing/empty/mismatched nonce is
// rejected. This is safe because the sign-in path always carries the nonce
// end-to-end; an unsolicited callback never will.

const AUTH_FLOW_KEY = "oscar.auth.flow.v1";
const AUTH_FLOW_TTL_MS = 30 * 60 * 1000; // 30 min — generous for a slow sign-in

interface AuthFlow {
  state: string;
  startedAt: number;
}

/** A 128-bit cryptographically-random nonce as a 32-char hex string. */
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Record an in-flight sign-in just before opening the browser. Returns the
 * nonce to append to the OAuth `redirectTo` as `?desktop_state=<nonce>`.
 */
export function beginAuthFlow(): string {
  const state = randomNonce();
  try {
    localStorage.setItem(
      AUTH_FLOW_KEY,
      JSON.stringify({ state, startedAt: Date.now() } satisfies AuthFlow),
    );
  } catch {
    /* localStorage unavailable — the deep-link handler will reject, user retries */
  }
  return state;
}

export function clearAuthFlow(): void {
  try {
    localStorage.removeItem(AUTH_FLOW_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True ONLY when an auth-callback deep link corresponds to a sign-in this app
 * actually started: a flow is in progress, its nonce matches `stateParam`, and
 * it began within the TTL. Fails closed — an empty/null `stateParam`, a missing
 * flow, a mismatched nonce, or an expired flow all return false.
 */
export function isAuthCallbackTrusted(stateParam: string | null): boolean {
  // Fail closed: no nonce on the callback → never trust it.
  if (!stateParam) return false;

  let flow: AuthFlow | null = null;
  try {
    const raw = localStorage.getItem(AUTH_FLOW_KEY);
    flow = raw ? (JSON.parse(raw) as AuthFlow) : null;
  } catch {
    flow = null;
  }
  if (!flow || typeof flow.startedAt !== "number" || !flow.state) return false;
  if (Date.now() - flow.startedAt > AUTH_FLOW_TTL_MS) return false;
  return stateParam === flow.state;
}
