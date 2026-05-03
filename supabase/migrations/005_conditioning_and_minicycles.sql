-- Migration 005: Add conditioning session types, update enums, add mini-cycle support
-- Aligns database with Sam's coaching philosophy

-- ============================================================
-- 1. UPDATE PROGRAM PHASE ENUM (7 phases instead of 4)
-- ============================================================
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Post-Season';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Early-Off-Season';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Base-Building';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Pre-Season-Skills';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Christmas-Block';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Return-to-Skills';
-- 'In-Season', 'Pre-Season', 'Off-Season' already exist from original enum

-- ============================================================
-- 2. ADD CONDITIONING SESSION TYPES TO WORKOUT TYPE ENUM
-- ============================================================
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'flush_out';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'sprint_intervals';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'nordic_4x4';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'long_run';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'metcon';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'flog_friday';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS '6x1km';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'hill_sprints';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'mas_training';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'tempo_run';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'quality_sprints';
ALTER TYPE workout_type ADD VALUE IF NOT EXISTS 'gun_show';

-- ============================================================
-- 3. ADD SESSION FEELING TYPE (replaces perceived_difficulty)
-- ============================================================
CREATE TYPE session_feeling AS ENUM ('cooked', 'strong', 'good', 'average', 'sore');

-- ============================================================
-- 4. ADD MINI-CYCLE SUPPORT TO MICROCYCLES TABLE
-- ============================================================
ALTER TABLE microcycles
  ADD COLUMN IF NOT EXISTS mini_cycle_number INT DEFAULT 1;

-- ============================================================
-- 5. ADD SESSION FEELING TO LOGGED WORKOUTS
-- ============================================================
ALTER TABLE logged_workouts
  ADD COLUMN IF NOT EXISTS session_feeling session_feeling;

-- ============================================================
-- 6. ADD CONDITIONING SESSION DETAILS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS conditioning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,

  -- Session type matches the conditioning workout_type values
  session_type TEXT NOT NULL,

  -- Protocol details
  work_seconds INT,          -- e.g., 10s for sprint intervals, 30s for flush-outs
  rest_seconds INT,          -- e.g., 50s for sprint intervals, 30s for flush-outs
  rounds INT,                -- e.g., 6 for 6x10s sprints
  total_duration_minutes INT, -- e.g., 30 for flush-outs

  -- Equipment/modality
  modality TEXT,             -- e.g., 'assault_bike', 'rower', 'ski_erg', 'running', 'mixed'

  -- Intensity guidance
  effort_level TEXT,         -- e.g., 'maximal', 'conversational', '80_percent', 'high'

  -- Distance targets (for MAS, 6x1km, tempo runs, etc.)
  distance_meters INT,
  pace_target TEXT,          -- e.g., 'start every 7min', '15:15 intervals'

  -- Notes and description
  description TEXT,
  coaching_cues TEXT,        -- Sam's specific coaching notes for this session type

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE TRIGGER update_conditioning_sessions_updated_at
  BEFORE UPDATE ON conditioning_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. SEED CONDITIONING SESSION TEMPLATES
-- ============================================================
-- These are Sam's conditioning session library as reusable templates

CREATE TABLE IF NOT EXISTS conditioning_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  session_type TEXT NOT NULL,
  description TEXT NOT NULL,
  coaching_cues TEXT,

  -- Default protocol
  default_work_seconds INT,
  default_rest_seconds INT,
  default_rounds INT,
  default_duration_minutes INT,
  default_modality TEXT,
  default_effort_level TEXT,
  default_distance_meters INT,
  default_pace_target TEXT,

  -- When to use
  recommended_phases TEXT[] DEFAULT ARRAY[]::TEXT[],  -- which phases this is good for
  recommended_frequency TEXT,                         -- e.g., '1-2x per week', 'once every 2 weeks'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_conditioning_templates_updated_at
  BEFORE UPDATE ON conditioning_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed Sam's conditioning session library
INSERT INTO conditioning_templates (name, session_type, description, coaching_cues, default_work_seconds, default_rest_seconds, default_rounds, default_duration_minutes, default_modality, default_effort_level, recommended_phases, recommended_frequency)
VALUES
  ('Flush-Out Session', 'flush_out',
   '30 seconds on, 30 seconds off for 30 minutes. Rotate through bike, ski erg, and rower. Gets blood flowing without impact stress.',
   'Keep it easy. This is about recovery, not fitness. Rotate stations every few rounds. No impact on legs.',
   30, 30, NULL, 30, 'mixed', 'moderate',
   ARRAY['In-Season', 'Return-to-Skills'], '1-2x per week in-season'),

  ('Sprint Intervals - 6x10s', 'sprint_intervals',
   'Accumulate 1 minute of maximal sprinting on assault bike. 3 min warm-up, 1 min rest, then 6 x 10 seconds absolutely flat out, starting every 1 minute.',
   'MAXIMAL effort. Not 80%. Not pretty hard. Absolutely everything you have got. This is the secret weapon for in-season conditioning.',
   10, 50, 6, 15, 'assault_bike', 'maximal',
   ARRAY['In-Season', 'Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),

  ('Sprint Intervals - 3x20s', 'sprint_intervals',
   'Accumulate 1 minute of maximal sprinting. 3 min warm-up, 1 min rest, then 3 x 20 seconds absolutely flat out, starting every 2 minutes.',
   'Same deal as 6x10s — MAXIMAL effort. Longer efforts, fewer reps, more rest between.',
   20, 100, 3, 15, 'assault_bike', 'maximal',
   ARRAY['In-Season', 'Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),

  ('Nordic 4x4', 'nordic_4x4',
   '4 rounds of 4 minutes at high intensity with rest between rounds. Great aerobic base builder and mental toughness session.',
   'Can be done on bike, rower, running, or a mix. Keep the intensity honest — should be uncomfortable but sustainable for 4 minutes.',
   240, 180, 4, 30, 'mixed', 'high',
   ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week'),

  ('Long Slow Run', 'long_run',
   'One long slow run per week, 35-50 minutes. Conversational pace. Builds aerobic base without flogging the body.',
   'Conversational pace — if you cannot talk, slow down. Best from October through February. Drop it once season kicks in.',
   NULL, NULL, NULL, 45, 'running', 'conversational',
   ARRAY['Early-Off-Season', 'Base-Building', 'Pre-Season-Skills'], '1x per week, Oct-Feb'),

  ('MetCon', 'metcon',
   'Mix of intervals, running, bodyweight reps (push-ups, squats), and carries. Versatile and scalable.',
   'Scale to any fitness level. Great for work capacity and general physical preparedness. Mix it up — variety is the point.',
   NULL, NULL, NULL, 25, 'mixed', 'high',
   ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week or every 2 weeks'),

  ('Flog Friday', 'flog_friday',
   'A gut-wrenching conditioning session designed to improve fitness AND increase grit. Hard on purpose.',
   'This builds mental toughness that separates blokes who fold in the last quarter from blokes who keep going. Not every week — use when the athlete needs to be tested.',
   NULL, NULL, NULL, 30, 'mixed', 'maximal',
   ARRAY['Pre-Season-Skills', 'Christmas-Block'], 'As needed — not every week'),

  ('6x1km Efforts', '6x1km',
   '6 x 1km running efforts, starting every 7 minutes. Faster runners get more rest, slower runners get less — self-regulating.',
   'Great for aerobic power and running economy. A pre-season favourite. Keep quality high throughout all 6 efforts.',
   NULL, NULL, 6, 42, 'running', 'high',
   ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week in pre-season'),

  ('Hill Sprints', 'hill_sprints',
   'Sprint up, walk back down. Plenty of rest between efforts. Power and speed session, not a cardio flog.',
   'The incline naturally reduces injury risk. Keep the quality high. When sprints start looking rubbish, the session is done.',
   NULL, NULL, 8, 25, 'running', 'maximal',
   ARRAY['Pre-Season-Skills', 'Christmas-Block'], '1x per week'),

  ('MAS Training 15:15', 'mas_training',
   '15 seconds on, 15 seconds off, repeated for 8 reps. Rest 2 minutes, repeat for 4-5 total rounds. Hit distance benchmarks: 60m (unfit) to 100m (elite).',
   'Science-backed method for improving maximal aerobic speed. Staple of professional football conditioning. Excellent engine builder.',
   15, 15, 40, 30, 'running', 'high',
   ARRAY['Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),

  ('Tempo Runs', 'tempo_run',
   'Controlled-pace running at 70-80% effort. Builds running economy and bridges base fitness to match-intensity running.',
   'Most effective just before team training resumes. Teaches athletes to run efficiently. Not a sprint session — controlled quality.',
   NULL, NULL, NULL, 30, 'running', '80_percent',
   ARRAY['Base-Building', 'Pre-Season-Skills'], '1x per week'),

  ('Quality Sprint Session', 'quality_sprints',
   '10-15 x 100m sprint at 80%, starting every 2 minutes. Generous rest is deliberate — goal is quality running at high speed.',
   'This is for SPRINTING, not another breather. Quality running at high speed. Develops actual speed and improves running mechanics.',
   NULL, NULL, 12, 30, 'running', '80_percent',
   ARRAY['Pre-Season-Skills', 'Christmas-Block', 'Return-to-Skills'], '1x per week');

-- ============================================================
-- 8. ADD INDEX FOR MINI-CYCLE QUERIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_microcycles_mini_cycle
  ON microcycles(program_id, mini_cycle_number);

CREATE INDEX IF NOT EXISTS idx_conditioning_sessions_workout
  ON conditioning_sessions(workout_id);

CREATE INDEX IF NOT EXISTS idx_conditioning_templates_type
  ON conditioning_templates(session_type);
