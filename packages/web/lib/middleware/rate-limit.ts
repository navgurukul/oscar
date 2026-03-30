/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse by limiting requests per user/IP within time windows.
 * Uses in-memory storage with automatic cleanup.
 */

import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
  firstRequestAt: number;
}

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Custom error message to return when rate limit is exceeded
   */
  message?: string;

  /**
   * Skip rate limiting for certain conditions (e.g., webhooks with valid signatures)
   */
  skip?: (identifier: string) => boolean;
}

// In-memory storage for rate limits
// Key format: "endpoint:identifier"
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Start automatic cleanup of expired rate limit entries
 */
function startCleanup() {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => rateLimitStore.delete(key));

    if (keysToDelete.length > 0) {
      console.log(
        `[Rate Limit] Cleaned up ${keysToDelete.length} expired entries`
      );
    }
  }, CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load
startCleanup();

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier for the rate limit (e.g., userId or IP address)
 * @param endpoint - API endpoint name for separate rate limit buckets
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
} {
  // Skip rate limiting if configured
  if (config.skip?.(identifier)) {
    return { allowed: true, remaining: config.maxRequests, resetAt: 0 };
  }

  const key = `${endpoint}:${identifier}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // No entry exists or entry has expired - allow request
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
      firstRequestAt: now,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Entry exists and hasn't expired
  if (entry.count < config.maxRequests) {
    // Within limit - increment and allow
    entry.count++;
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  // Rate limit exceeded
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return {
    allowed: false,
    remaining: 0,
    resetAt: entry.resetAt,
    retryAfter,
  };
}

/**
 * Create a rate limit response with proper headers
 */
export function createRateLimitResponse(
  config: RateLimitConfig,
  result: ReturnType<typeof checkRateLimit>
): NextResponse {
  const message =
    config.message ||
    `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`;

  return NextResponse.json(
    {
      error: message,
      retryAfter: result.retryAfter,
    },
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
 * Apply rate limiting to an API route
 * Returns null if allowed, or a NextResponse if rate limited
 *
 * @example
 * const rateLimitResult = applyRateLimit(userId, "format-api", { maxRequests: 10, windowMs: 60000 });
 * if (rateLimitResult) return rateLimitResult;
 */
export function applyRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): NextResponse | null {
  const result = checkRateLimit(identifier, endpoint, config);

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
 * Get current rate limit status for an identifier
 * Useful for showing users their remaining quota
 */
export function getRateLimitStatus(
  identifier: string,
  endpoint: string,
  maxRequests: number
): { used: number; remaining: number; resetAt: number | null } {
  const key = `${endpoint}:${identifier}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  if (!entry || entry.resetAt < now) {
    return {
      used: 0,
      remaining: maxRequests,
      resetAt: null,
    };
  }

  return {
    used: entry.count,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Clear rate limit for a specific identifier (useful for testing or admin overrides)
 */
export function clearRateLimit(identifier: string, endpoint?: string): void {
  if (endpoint) {
    const key = `${endpoint}:${identifier}`;
    rateLimitStore.delete(key);
  } else {
    // Clear all entries for this identifier
    const keysToDelete: string[] = [];
    rateLimitStore.forEach((_, key) => {
      if (key.endsWith(`:${identifier}`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => rateLimitStore.delete(key));
  }
}

/**
 * Get client identifier from request (user ID or IP address)
 */
export function getClientIdentifier(
  userId?: string,
  request?: Request
): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address for unauthenticated requests
  if (request) {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "unknown";
    return `ip:${ip}`;
  }

  return "unknown";
}
