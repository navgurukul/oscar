import { createClient } from "@supabase/supabase-js";

// ── Fill these in after creating your Supabase project ────────────────────────
// Dashboard → Project Settings → API
export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  ?? "";
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
