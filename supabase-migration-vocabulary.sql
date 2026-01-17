-- Migration: Add user_vocabulary table for custom vocabulary/name recognition
-- Run this migration in your Supabase SQL Editor

-- Create user_vocabulary table
CREATE TABLE user_vocabulary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  pronunciation TEXT NULL,  -- Optional: how the term might sound (e.g., "Sauvic" for "Souvik")
  context TEXT NULL,        -- Optional: category/usage hint (e.g., "Person", "Technical Term")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

-- Ensure unique terms per user
UNIQUE(user_id, term) );

-- Index for fast user-specific queries
CREATE INDEX idx_user_vocabulary_user_id ON user_vocabulary (user_id);

-- Enable Row Level Security
ALTER TABLE user_vocabulary ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own vocabulary
CREATE POLICY "Users can view own vocabulary" ON user_vocabulary FOR
SELECT USING (auth.uid () = user_id);

-- Policy: Users can insert their own vocabulary
CREATE POLICY "Users can insert own vocabulary" ON user_vocabulary FOR INSERT
WITH
    CHECK (auth.uid () = user_id);

-- Policy: Users can update their own vocabulary
CREATE POLICY "Users can update own vocabulary" ON user_vocabulary
FOR UPDATE
    USING (auth.uid () = user_id);

-- Policy: Users can delete their own vocabulary
CREATE POLICY "Users can delete own vocabulary" ON user_vocabulary FOR DELETE USING (auth.uid () = user_id);