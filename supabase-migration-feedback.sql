-- Migration: Add feedback columns to notes table
-- Description: Adds columns to track user feedback on AI formatting quality
-- Date: 2024

-- Add feedback_helpful column (boolean to track yes/no response)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS feedback_helpful BOOLEAN DEFAULT NULL;

-- Add feedback_reasons column (array of text to store reason tags)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS feedback_reasons TEXT [] DEFAULT NULL;

-- Add feedback_other_text column (free-text when 'other' is selected)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS feedback_other_text TEXT DEFAULT NULL;

-- Add feedback_timestamp column (timestamp of when feedback was given)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS feedback_timestamp TIMESTAMPTZ DEFAULT NULL;

-- Add index on feedback_helpful for faster queries on feedback statistics
CREATE INDEX IF NOT EXISTS idx_notes_feedback_helpful ON notes (feedback_helpful)
WHERE
    feedback_helpful IS NOT NULL;

-- Add index on feedback_timestamp for ordering by feedback time
CREATE INDEX IF NOT EXISTS idx_notes_feedback_timestamp ON notes (feedback_timestamp DESC)
WHERE
    feedback_timestamp IS NOT NULL;

-- Add comment to document the feedback system
COMMENT ON COLUMN notes.feedback_helpful IS 'User feedback: true if formatting was helpful, false if not, null if no feedback yet';

COMMENT ON COLUMN notes.feedback_reasons IS 'Array of reason tags when feedback is negative: too_short, missed_key_info, incorrect_grammar, wrong_tone, poor_formatting, other';

COMMENT ON COLUMN notes.feedback_other_text IS 'Free-text detail provided when user selects reason "other"';

COMMENT ON COLUMN notes.feedback_timestamp IS 'Timestamp when user submitted feedback';

-- Optional: Create a view for feedback analytics
CREATE OR REPLACE VIEW feedback_stats AS
SELECT
    COUNT(*) FILTER (
        WHERE
            feedback_helpful IS NOT NULL
    ) as total_feedback,
    COUNT(*) FILTER (
        WHERE
            feedback_helpful = true
    ) as helpful_count,
    COUNT(*) FILTER (
        WHERE
            feedback_helpful = false
    ) as not_helpful_count,
    ROUND(
        100.0 * COUNT(*) FILTER (
            WHERE
                feedback_helpful = true
        ) / NULLIF(
            COUNT(*) FILTER (
                WHERE
                    feedback_helpful IS NOT NULL
            ),
            0
        ),
        2
    ) as helpful_percentage,
    COUNT(*) as total_notes
FROM notes;

-- Grant access to the view (adjust roles as needed)
GRANT SELECT ON feedback_stats TO authenticated;

-- Optional: Create a view for recent negative feedback
CREATE OR REPLACE VIEW recent_negative_feedback AS
SELECT
    id,
    title,
    raw_text,
    original_formatted_text,
    feedback_reasons,
    feedback_timestamp
FROM notes
WHERE
    feedback_helpful = false
    AND feedback_reasons IS NOT NULL
ORDER BY feedback_timestamp DESC
LIMIT 50;

-- Grant access to the view
GRANT SELECT ON recent_negative_feedback TO authenticated;