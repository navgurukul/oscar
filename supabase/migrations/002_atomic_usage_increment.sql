-- Migration: 002_atomic_usage_increment
-- Adds a Postgres function that atomically increments recording_count,
-- eliminating the read-then-write race condition in the application layer.

CREATE OR REPLACE FUNCTION increment_recording_usage(
  p_user_id   UUID,
  p_month_year TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  INSERT INTO usage_tracking (user_id, month_year, recording_count, updated_at)
  VALUES (p_user_id, p_month_year, 1, NOW())
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    recording_count = usage_tracking.recording_count + 1,
    updated_at      = NOW()
  RETURNING recording_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- Only the service-role key (used by the server) should be able to call this.
REVOKE ALL ON FUNCTION increment_recording_usage(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_recording_usage(UUID, TEXT) TO service_role;
