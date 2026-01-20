-- Migration: Add is_starred column to notes table
-- This enables users to mark notes as favorites for quick access

-- Add is_starred column with default value of false
ALTER TABLE notes ADD COLUMN is_starred BOOLEAN NOT NULL DEFAULT false;

-- Create partial index for efficient filtering of starred notes
CREATE INDEX idx_notes_is_starred ON notes(is_starred) WHERE is_starred = true;

-- Add comment for documentation
COMMENT ON COLUMN notes.is_starred IS 'Whether the note is marked as a favorite/starred by the user';
