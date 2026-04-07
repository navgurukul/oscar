import { createClient } from "@supabase/supabase-js";

// ── Supabase project credentials (public / anon — safe to hardcode) ───────────
// Dashboard → Project Settings → API
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY override these at build time when
// a packages/desktop/.env file is present (e.g. local dev).  The hardcoded
// fallbacks ensure release builds work even when no .env file is committed
// (since .env files are gitignored and not present in CI/Tauri release builds).
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://gxioxrtbjwlyhqyvsjxw.supabase.co";
export const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_BqrircmTyzIis-yumtmBTw_GHhCjAoR";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Desktop app handles auth via deep-link callback — don't let the client
    // try to detect tokens in the URL (there's no URL bar in a WebView).
    detectSessionInUrl: false,
    // MUST use implicit flow for desktop OAuth.  The default PKCE flow stores
    // a code_verifier in the Tauri webview, but the OAuth callback lands in
    // the system browser which doesn't have access to that verifier — so the
    // code exchange always fails.  Implicit flow returns tokens directly in
    // the URL hash fragment, which the desktop-callback page can relay back
    // to the app via the oscar:// deep link.
    flowType: "implicit",
  },
});
