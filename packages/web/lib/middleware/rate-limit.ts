/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse by limiting requests per user/IP within time windows.
 * Uses Supabase (rate_limits table) for cross-instance persistence, with an
 * in-memory map as a fallback when the table is unavailable.
 *
 * Required migration (run once):
 *   CREATE TABLE IF NOT EXISTS rate_limits (
 *     key        TEXT PRIMARY KEY,
 *     count      INTEGER NOT NULL DEFAULT 1,
 *     reset_at   TIMESTAMPTZ NOT NULL,
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   CREATE INDEX IF NOT EXISTS rate_limits_reset_at_idx ON rate_limits (reset_at);
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstRequestAt: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom error message to return when rate limit is exceeded */
  message?: string;
  /** Skip rate limiting for certain conditions */
  skip?: (identifier: string) => boolean;
}

// In-memory fallback store (used when Supabase is unavailable)
const fallbackStore = new Map<string, RateLimitEntry>();

// Cleanup fallback store every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(fallbackStore.entries())) {
    if (entry.resetAt < now) fallbackStore.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Atomically increment a rate-limit counter in Supabase.
 * Returns the new {count, resetAt} or null if Supabase is unavailable.
 *
 * Uses an upsert: on conflict the count is incremented in-place when the
 * window is still valid, or reset to 1 when it has expired.
 */
async function supabaseIncrement(
  key: string,
  windowMs: number
): Promise<{ count: number; resetAt: number } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const resetAt = new Date(Date.now() + windowMs);

    // Read current entry first so we can decide the new count atomically.
    const { data: existing, error: selectError } = await supabase
      .from("rate_limits")
      .select("count, reset_at")
      .eq("key", key)
      .maybeSingle();

    if (selectError) return null;

    const existingResetAt = existing ? new Date(existing.reset_at).getTime() : 0;
    const windowExpired = existingResetAt < now.getTime();
    const newCount = windowExpired || !existing ? 1 : existing.count + 1;
    const newResetAt = windowExpired || !existing ? resetAt : new Date(existingResetAt);

    const { error: upsertError } = await supabase
      .from("rate_limits")
      .upsert(
        {
          key,
          count: newCount,
          reset_at: newResetAt.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "key" }
      );

    if (upsertError) return null;

    return { count: newCount, resetAt: newResetAt.getTime() };
  } catch {
    return null;
  }
}

/**
 * Check and increment the rate limit counter for a given identifier/endpoint.
 * Tries Supabase first; falls back to in-memory on any error.
 */
async function incrementAndCheck(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  const now = Date.now();

  // Try Supabase-backed throttling
  const result = await supabaseIncrement(key, config.windowMs);

  if (result) {
    const { count, resetAt } = result;
    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const retryAfter = allowed ? undefined : Math.ceil((resetAt - now) / 1000);
    return { allowed, remaining, resetAt, retryAfter };
  }

  // Fallback: in-memory store
  const entry = fallbackStore.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    fallbackStore.set(key, { count: 1, resetAt, firstRequestAt: now });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  entry.count++;
  fallbackStore.set(key, entry);

  if (entry.count <= config.maxRequests) {
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
}

/**
 * Create a rate limit response with proper headers
 */
export function createRateLimitResponse(
  config: RateLimitConfig,
  result: { remaining: number; resetAt: number; retryAfter?: number }
): NextResponse {
  const message =
    config.message ||
    `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`;

  return NextResponse.json(
    { error: message, retryAfter: result.retryAfter },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
        "Retry-After": result.retryAfter?.toString() || "60",
      },
    }
  );
}

/**
 * Apply rate limiting to an API route.
 * Returns null if the request is allowed, or a 429 NextResponse if blocked.
 *
 * @example
 * const rateLimitResult = await applyRateLimit(userId, "format-api", { maxRequests: 10, windowMs: 60000 });
 * if (rateLimitResult) return rateLimitResult;
 */
export async function applyRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  if (config.skip?.(identifier)) return null;

  const key = `${endpoint}:${identifier}`;
  const result = await incrementAndCheck(key, config);

  if (!result.allowed) {
    console.warn(
      `[Rate Limit] Blocked request for ${endpoint} from ${identifier}. ` +
        `Retry after ${result.retryAfter}s`
    );
    return createRateLimitResponse(config, result);
  }

  return null;
}

/**
 * Get client identifier from request (user ID or IP address)
 */
export function getClientIdentifier(
  userId?: string,
  request?: Request
): string {
  if (userId) return `user:${userId}`;

  if (request) {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "unknown";
    return `ip:${ip}`;
  }

  return "unknown";
}

/**
 * Clear rate limit for a specific identifier (useful for testing or admin overrides)
 */
export async function clearRateLimit(identifier: string, endpoint?: string): Promise<void> {
  // Clear in-memory fallback
  if (endpoint) {
    const key = `${endpoint}:${identifier}`;
    fallbackStore.delete(key);
    try {
      await getSupabaseAdmin().from("rate_limits").delete().eq("key", key);
    } catch { /* ignore */ }
  } else {
    for (const key of Array.from(fallbackStore.keys())) {
      if (key.endsWith(`:${identifier}`)) fallbackStore.delete(key);
    }
    try {
      await getSupabaseAdmin().from("rate_limits").delete().like("key", `%:${identifier}`);
    } catch { /* ignore */ }
  }
}
