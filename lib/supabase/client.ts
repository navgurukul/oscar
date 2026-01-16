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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
