-- Migration: Add gif_url column to exercises table
-- Stores cached ExerciseDB GIF URLs so we don't need runtime API calls

-- Add gif_url column
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS gif_url TEXT;

-- Add index for quick lookups of exercises that still need GIFs populated
CREATE INDEX IF NOT EXISTS idx_exercises_gif_url_null ON exercises (name) WHERE gif_url IS NULL;

-- Comment explaining the column
COMMENT ON COLUMN exercises.gif_url IS 'Cached animated GIF URL from ExerciseDB API. Populated once via admin script, not fetched at runtime.';
