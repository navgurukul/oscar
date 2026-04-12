import { createClient } from "@supabase/supabase-js";
import { getRequiredServerEnv } from "./env";

export function getSupabaseAdmin() {
  return createClient(
    getRequiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
