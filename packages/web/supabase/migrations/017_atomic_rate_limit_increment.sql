-- Migration: 017_atomic_rate_limit_increment
-- Adds a Postgres function that atomically increments a rate-limit counter,
-- eliminating the select-then-upsert race in the application layer. Under
-- concurrency two requests could read the same count and both write count+1,
-- letting a burst slip past the configured limit. A single INSERT .. ON CONFLICT
-- with the increment computed server-side closes that window.
--
-- The window resets when the stored reset_at has passed; otherwise the count is
-- incremented in place and the existing reset_at is preserved.

CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key       TEXT,
  p_window_ms BIGINT
)
RETURNS TABLE (out_count INTEGER, out_reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now   TIMESTAMPTZ := NOW();
  v_reset TIMESTAMPTZ := v_now + (p_window_ms * INTERVAL '1 millisecond');
BEGIN
  INSERT INTO rate_limits (key, count, reset_at, updated_at)
  VALUES (p_key, 1, v_reset, v_now)
  ON CONFLICT (key)
  DO UPDATE SET
    count      = CASE WHEN rate_limits.reset_at < v_now THEN 1 ELSE rate_limits.count + 1 END,
    reset_at   = CASE WHEN rate_limits.reset_at < v_now THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END,
    updated_at = v_now
  RETURNING rate_limits.count, rate_limits.reset_at INTO out_count, out_reset_at;

  RETURN NEXT;
END;
$$;

-- Only the service-role key (used by the server via getSupabaseAdmin) may call this.
REVOKE ALL ON FUNCTION increment_rate_limit(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_rate_limit(TEXT, BIGINT) TO service_role;
