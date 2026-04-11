-- Migration: 003_rate_limits_table
-- Creates a persistent rate_limits table used by the server-side rate limiter.
-- Replaces the previous in-memory store so limits are shared across all
-- server instances and survive process restarts.

CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER      NOT NULL DEFAULT 1,
  reset_at   TIMESTAMPTZ  NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Speed up the periodic cleanup query that deletes expired rows.
CREATE INDEX IF NOT EXISTS rate_limits_reset_at_idx ON rate_limits (reset_at);

-- Only the service-role key (used by the server via getSupabaseAdmin) may
-- read or write this table. The anon/authenticated roles have no access.
REVOKE ALL ON TABLE rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE rate_limits FROM anon;
REVOKE ALL ON TABLE rate_limits FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rate_limits TO service_role;
