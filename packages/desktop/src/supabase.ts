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
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aW94cnRiandseWhxeXZzanh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NzA1OTUsImV4cCI6MjA4NDA0NjU5NX0.kqOYYdEhGvPTnqlzDXp1XiFyE9d1HOLwQt33htyM3Lk";

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
