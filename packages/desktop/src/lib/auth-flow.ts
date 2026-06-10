// Guards the OAuth deep-link against session injection.
//
// The app signs in by opening the system browser; the web app then fires an
// `oscar://auth/callback?access_token=...&refresh_token=...` deep link back.
// Without a guard, ANY local process or web page could fire that scheme with an
// attacker's tokens and silently switch the app into the attacker's account —
// the victim's dictated notes would then save into the attacker's account.
//
// We mark a sign-in as "in flight" in localStorage immediately before opening
// the browser, and the deep-link handler only accepts an auth callback while a
// fresh in-flight flow exists. An unsolicited callback (no sign-in started) is
// rejected. The flag is purely local — it does not depend on the web preserving
// any parameter through the OAuth round-trip, so it cannot lock users out.
//
// A nonce is also recorded for defense-in-depth: if a `state` value ever rides
// back on the callback (the web already forwards `desktop_state` as `state`),
// it must match. A missing `state` degrades to the in-flight check rather than
// failing, so wiring the nonce end-to-end stays a safe, optional follow-up.

const AUTH_FLOW_KEY = "oscar_auth_flow";
const AUTH_FLOW_TTL_MS = 30 * 60 * 1000; // 30 min — generous for a slow sign-in

interface AuthFlow {
  nonce: string;
  ts: number;
}

function randomNonce(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Record an in-flight sign-in just before opening the browser. Returns the nonce. */
export function beginAuthFlow(): string {
  const nonce = randomNonce();
  try {
    localStorage.setItem(AUTH_FLOW_KEY, JSON.stringify({ nonce, ts: Date.now() }));
  } catch {
    /* localStorage unavailable — the deep-link handler will reject, user retries */
  }
  return nonce;
}

export function clearAuthFlow(): void {
  try {
    localStorage.removeItem(AUTH_FLOW_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True only when an auth-callback deep link corresponds to a sign-in this app
 * actually started (fresh in-flight flag), and — when the callback carries a
 * `state` nonce — that nonce matches the one we issued.
 */
export function isAuthCallbackTrusted(stateParam: string | null): boolean {
  let flow: AuthFlow | null = null;
  try {
    const raw = localStorage.getItem(AUTH_FLOW_KEY);
    flow = raw ? (JSON.parse(raw) as AuthFlow) : null;
  } catch {
    flow = null;
  }
  if (!flow || typeof flow.ts !== "number") return false;
  if (Date.now() - flow.ts > AUTH_FLOW_TTL_MS) return false;
  if (stateParam && flow.nonce && stateParam !== flow.nonce) return false;
  return true;
}
