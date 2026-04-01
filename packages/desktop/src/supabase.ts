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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
