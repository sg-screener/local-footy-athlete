-- ============================================================
-- LOCAL FOOTY ATHLETE - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ============================================================
-- MIGRATION 001: INITIAL SCHEMA
-- ============================================================

-- Create enums for better data integrity
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced', 'professional');
CREATE TYPE position_type AS ENUM ('forward', 'midfielder', 'defender', 'ruck', 'utility');
CREATE TYPE subscription_status AS ENUM ('free', 'premium', 'team');
CREATE TYPE program_phase AS ENUM ('Off-Season', 'Pre-Season', 'In-Season', 'Finals');
CREATE TYPE workout_type AS ENUM ('strength', 'conditioning', 'skill', 'recovery', 'mobility');
CREATE TYPE exercise_type AS ENUM ('compound', 'isolation', 'cardio', 'mobility', 'plyometric');
CREATE TYPE modification_type AS ENUM ('skip', 'reschedule', 'intensity_adjustment', 'exercise_swap');
CREATE TYPE schedule_event_type AS ENUM ('game', 'match', 'rest_day', 'recovery_session', 'other');

-- Profiles table - extending Supabase auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  age INT,
  height_cm INT,
  weight_kg DECIMAL(5, 2),
  position position_type,
  experience_level experience_level DEFAULT 'beginner',
  club_name TEXT,
  jersey_number INT,

  -- Equipment and facilities
  has_gym_access BOOLEAN DEFAULT true,
  has_home_equipment BOOLEAN DEFAULT false,
  training_location TEXT,

  -- Training preferences
  days_per_week INT DEFAULT 4,
  training_time_preference TEXT,

  -- Health and injury history
  injury_history TEXT[] DEFAULT ARRAY[]::TEXT[],
  current_injuries TEXT,

  -- Goals and preferences
  primary_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  secondary_goals TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Account management
  subscription_status subscription_status DEFAULT 'free',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  onboarding_completed BOOLEAN DEFAULT false,
  profile_picture_url TEXT,

  -- Audit timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Training programs table
CREATE TABLE training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  program_phase program_phase DEFAULT 'Off-Season',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  microcycles_count INT DEFAULT 12,
  primary_focus TEXT,
  intensity_level INT DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Microcycles (weekly training blocks) table
CREATE TABLE microcycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_deload_week BOOLEAN DEFAULT false,
  intensity_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_week_per_program UNIQUE(program_id, week_number)
);

-- Workouts table (sessions within a microcycle)
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microcycle_id UUID NOT NULL REFERENCES microcycles(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  session_number INT,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT,
  intensity INT CHECK (intensity >= 1 AND intensity <= 10),
  workout_type workout_type,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Exercises master list table
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  external_exercise_db_id TEXT,
  muscle_groups TEXT[] DEFAULT ARRAY[]::TEXT[],
  exercise_type exercise_type NOT NULL,
  equipment_required TEXT[] DEFAULT ARRAY[]::TEXT[],
  video_url TEXT,
  gif_url TEXT,
  form_notes TEXT,
  difficulty_level INT CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN exercises.gif_url IS 'Cached animated GIF URL from ExerciseDB API. Populated once via admin script, not fetched at runtime.';

-- Workout exercises (exercise prescriptions for workouts)
CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  exercise_order INT NOT NULL,
  prescribed_sets INT,
  prescribed_reps_min INT,
  prescribed_reps_max INT,
  prescribed_weight_kg DECIMAL(6, 2),
  prescribed_rpe INT CHECK (prescribed_rpe >= 1 AND prescribed_rpe <= 10),
  rest_seconds INT,
  tempo TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_exercise_order UNIQUE(workout_id, exercise_order)
);

-- Logged workouts (user workout completion)
CREATE TABLE logged_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE SET NULL,
  logged_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INT,
  perceived_difficulty INT CHECK (perceived_difficulty >= 1 AND perceived_difficulty <= 10),
  session_feeling TEXT,
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Logged sets (individual set tracking for completed workouts)
CREATE TABLE logged_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_workout_id UUID NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE RESTRICT,
  set_number INT NOT NULL,
  actual_reps INT,
  actual_weight_kg DECIMAL(6, 2),
  actual_rpe INT CHECK (actual_rpe >= 1 AND actual_rpe <= 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_set_per_workout UNIQUE(logged_workout_id, workout_exercise_id, set_number)
);

-- AI Coach conversations
CREATE TABLE ai_coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI Coach messages
CREATE TABLE ai_coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_coach_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schedule events (games, rest days, etc.)
CREATE TABLE schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  modifies_program BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Program modifications (changes to training programs)
CREATE TABLE program_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  modification_type modification_type NOT NULL,
  description TEXT,
  trigger_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  daily_reminder_enabled BOOLEAN DEFAULT true,
  reminder_time TIME DEFAULT '07:00:00',
  weight_unit VARCHAR(3) DEFAULT 'kg',
  theme VARCHAR(20) DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conditioning sessions table
CREATE TABLE conditioning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  work_seconds INT,
  rest_seconds INT,
  rounds INT,
  total_duration_minutes INT,
  modality TEXT,
  effort_level TEXT,
  distance_meters INT,
  pace_target TEXT,
  description TEXT,
  coaching_cues TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conditioning templates (Sam's session library)
CREATE TABLE conditioning_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  session_type TEXT NOT NULL,
  description TEXT NOT NULL,
  coaching_cues TEXT,
  default_work_seconds INT,
  default_rest_seconds INT,
  default_rounds INT,
  default_duration_minutes INT,
  default_modality TEXT,
  default_effort_level TEXT,
  default_distance_meters INT,
  default_pace_target TEXT,
  recommended_phases TEXT[] DEFAULT ARRAY[]::TEXT[],
  recommended_frequency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TRIGGERS: Auto-update updated_at columns
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_programs_updated_at BEFORE UPDATE ON training_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_microcycles_updated_at BEFORE UPDATE ON microcycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workout_exercises_updated_at BEFORE UPDATE ON workout_exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_logged_workouts_updated_at BEFORE UPDATE ON logged_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_logged_sets_updated_at BEFORE UPDATE ON logged_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_coach_conversations_updated_at BEFORE UPDATE ON ai_coach_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON schedule_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_modifications_updated_at BEFORE UPDATE ON program_modifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conditioning_sessions_updated_at BEFORE UPDATE ON conditioning_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conditioning_templates_updated_at BEFORE UPDATE ON conditioning_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION 002: INDEXES
-- ============================================================

CREATE INDEX idx_logged_workouts_user_date ON logged_workouts(user_id, logged_date DESC);
CREATE INDEX idx_logged_workouts_user_completed ON logged_workouts(user_id, completed);
CREATE INDEX idx_logged_workouts_workout_id ON logged_workouts(workout_id);
CREATE INDEX idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX idx_workout_exercises_exercise_id ON workout_exercises(exercise_id);
CREATE INDEX idx_microcycles_program_id ON microcycles(program_id);
CREATE INDEX idx_microcycles_program_week ON microcycles(program_id, week_number);
CREATE INDEX idx_workouts_microcycle_id ON workouts(microcycle_id);
CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
CREATE INDEX idx_exercises_type ON exercises(exercise_type);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty_level);
CREATE INDEX idx_ai_coach_messages_conversation ON ai_coach_messages(conversation_id, created_at DESC);
CREATE INDEX idx_ai_coach_conversations_user ON ai_coach_conversations(user_id, created_at DESC);
CREATE INDEX idx_training_programs_user ON training_programs(user_id, is_active);
CREATE INDEX idx_training_programs_user_phase ON training_programs(user_id, program_phase);
CREATE INDEX idx_training_programs_dates ON training_programs(start_date, end_date);
CREATE INDEX idx_schedule_events_user_date ON schedule_events(user_id, start_date);
CREATE INDEX idx_schedule_events_user_type ON schedule_events(user_id, event_type);
CREATE INDEX idx_logged_sets_logged_workout ON logged_sets(logged_workout_id);
CREATE INDEX idx_logged_sets_exercise ON logged_sets(workout_exercise_id);
CREATE INDEX idx_program_modifications_program ON program_modifications(program_id);
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_subscription ON profiles(subscription_status);
CREATE INDEX idx_microcycles_mini_cycle ON microcycles(program_id, mini_cycle_number);
CREATE INDEX idx_conditioning_sessions_workout ON conditioning_sessions(workout_id);
CREATE INDEX idx_conditioning_templates_type ON conditioning_templates(session_type);
CREATE INDEX idx_exercises_gif_url_null ON exercises (name) WHERE gif_url IS NULL;

-- ============================================================
-- MIGRATION 003: ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE microcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE logged_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logged_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Training Programs: users can only access their own
CREATE POLICY "training_programs_select_own" ON training_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "training_programs_insert_own" ON training_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_programs_update_own" ON training_programs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_programs_delete_own" ON training_programs FOR DELETE USING (auth.uid() = user_id);

-- Microcycles: users access through their programs
CREATE POLICY "microcycles_select_own" ON microcycles FOR SELECT USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = microcycles.program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "microcycles_insert_own" ON microcycles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "microcycles_update_own" ON microcycles FOR UPDATE USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = microcycles.program_id AND training_programs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "microcycles_delete_own" ON microcycles FOR DELETE USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = microcycles.program_id AND training_programs.user_id = auth.uid()));

-- Workouts: users access through their programs
CREATE POLICY "workouts_select_own" ON workouts FOR SELECT USING (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = workouts.microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_insert_own" ON workouts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_update_own" ON workouts FOR UPDATE USING (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = workouts.microcycle_id AND training_programs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_delete_own" ON workouts FOR DELETE USING (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = workouts.microcycle_id AND training_programs.user_id = auth.uid()));

-- Exercises: all authenticated users can read (shared library)
CREATE POLICY "exercises_select_all" ON exercises FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "exercises_insert_admin" ON exercises FOR INSERT WITH CHECK (false);
CREATE POLICY "exercises_update_admin" ON exercises FOR UPDATE USING (false) WITH CHECK (false);

-- Workout Exercises: users access through their programs
CREATE POLICY "workout_exercises_select_own" ON workout_exercises FOR SELECT USING (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_exercises.workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workout_exercises_insert_own" ON workout_exercises FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workout_exercises_update_own" ON workout_exercises FOR UPDATE USING (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_exercises.workout_id AND training_programs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workout_exercises_delete_own" ON workout_exercises FOR DELETE USING (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_exercises.workout_id AND training_programs.user_id = auth.uid()));

-- Logged Workouts: users can only access their own
CREATE POLICY "logged_workouts_select_own" ON logged_workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "logged_workouts_insert_own" ON logged_workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logged_workouts_update_own" ON logged_workouts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logged_workouts_delete_own" ON logged_workouts FOR DELETE USING (auth.uid() = user_id);

-- Logged Sets: users access through their logged workouts
CREATE POLICY "logged_sets_select_own" ON logged_sets FOR SELECT USING (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_sets.logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "logged_sets_insert_own" ON logged_sets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "logged_sets_update_own" ON logged_sets FOR UPDATE USING (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_sets.logged_workout_id AND logged_workouts.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "logged_sets_delete_own" ON logged_sets FOR DELETE USING (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_sets.logged_workout_id AND logged_workouts.user_id = auth.uid()));

-- AI Coach Conversations: users can only access their own
CREATE POLICY "ai_coach_conversations_select_own" ON ai_coach_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_coach_conversations_insert_own" ON ai_coach_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_coach_conversations_update_own" ON ai_coach_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_coach_conversations_delete_own" ON ai_coach_conversations FOR DELETE USING (auth.uid() = user_id);

-- AI Coach Messages: users access through their conversations
CREATE POLICY "ai_coach_messages_select_own" ON ai_coach_messages FOR SELECT USING (EXISTS (SELECT 1 FROM ai_coach_conversations WHERE ai_coach_conversations.id = ai_coach_messages.conversation_id AND ai_coach_conversations.user_id = auth.uid()));
CREATE POLICY "ai_coach_messages_insert_own" ON ai_coach_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ai_coach_conversations WHERE ai_coach_conversations.id = conversation_id AND ai_coach_conversations.user_id = auth.uid()));
CREATE POLICY "ai_coach_messages_delete_own" ON ai_coach_messages FOR DELETE USING (EXISTS (SELECT 1 FROM ai_coach_conversations WHERE ai_coach_conversations.id = ai_coach_messages.conversation_id AND ai_coach_conversations.user_id = auth.uid()));

-- Schedule Events: users can only access their own
CREATE POLICY "schedule_events_select_own" ON schedule_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "schedule_events_insert_own" ON schedule_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_events_update_own" ON schedule_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_events_delete_own" ON schedule_events FOR DELETE USING (auth.uid() = user_id);

-- Program Modifications: users access through their programs
CREATE POLICY "program_modifications_select_own" ON program_modifications FOR SELECT USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_modifications.program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "program_modifications_insert_own" ON program_modifications FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "program_modifications_delete_own" ON program_modifications FOR DELETE USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_modifications.program_id AND training_programs.user_id = auth.uid()));

-- User Preferences: users can only access their own
CREATE POLICY "user_preferences_select_own" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete_own" ON user_preferences FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- MIGRATION 004: SEED EXERCISE DATA (80+ exercises)
-- ============================================================

INSERT INTO exercises (name, description, muscle_groups, exercise_type, equipment_required, difficulty_level) VALUES

-- Barbell Compound Lifts
('Back Squat', 'Barbell squat with bar on back shoulders, fundamental lower body compound movement', ARRAY['quadriceps', 'glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Front Squat', 'Barbell squat with bar on front shoulders, emphasizes quads and core', ARRAY['quadriceps', 'glutes', 'core', 'upper back'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Deadlift', 'Barbell lift from ground to hip height, total body compound movement', ARRAY['hamstrings', 'glutes', 'lower back', 'upper back', 'core'], 'compound', ARRAY['barbell', 'plates'], 5),
('Romanian Deadlift', 'Hinge movement emphasizing hamstrings and posterior chain', ARRAY['hamstrings', 'glutes', 'lower back', 'upper back'], 'compound', ARRAY['barbell', 'dumbbell'], 3),
('Bench Press', 'Barbell pressing movement for chest, shoulders and triceps', ARRAY['chest', 'triceps', 'shoulders'], 'compound', ARRAY['barbell', 'bench', 'squat rack'], 4),
('Incline Bench Press', 'Angled bench press emphasizing upper chest and front shoulders', ARRAY['chest', 'shoulders', 'triceps'], 'compound', ARRAY['barbell', 'incline bench'], 3),
('Decline Bench Press', 'Angled downward bench press for lower chest emphasis', ARRAY['chest', 'triceps', 'shoulders'], 'compound', ARRAY['barbell', 'decline bench'], 3),
('Barbell Row', 'Bent-over row for upper back and lats', ARRAY['upper back', 'lats', 'biceps', 'lower back'], 'compound', ARRAY['barbell', 'plates'], 4),
('Pendulum Row', 'Machine row variation reducing lower back strain', ARRAY['upper back', 'lats', 'biceps'], 'compound', ARRAY['pendulum machine'], 2),
('Overhead Press', 'Standing or seated barbell pressing movement for shoulders and triceps', ARRAY['shoulders', 'triceps', 'upper chest', 'core'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Push Press', 'Overhead press with leg drive for power and strength', ARRAY['shoulders', 'triceps', 'legs', 'core'], 'compound', ARRAY['barbell'], 4),
('Power Clean', 'Olympic lift for explosive power and total body coordination', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 5),
('Hang Clean', 'Olympic lift variant starting from hip height, reduced technique difficulty', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 4),

-- Hip and Glute Focus
('Hip Thrust', 'Barbell hip extension for glute and posterior chain strength', ARRAY['glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['barbell', 'bench'], 3),
('Bulgarian Split Squat', 'Single leg squat variation with rear foot elevated', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'compound', ARRAY['dumbbell', 'bench'], 3),
('Lunges', 'Single leg movement for quadriceps, glutes and balance', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'compound', ARRAY['dumbbell', 'barbell'], 2),
('Walking Lunges', 'Dynamic lunge variation for functional leg strength', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'compound', ARRAY['dumbbell', 'barbell'], 2),
('Goblet Squat', 'Dumbbell or kettlebell squat held at chest', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['dumbbell', 'kettlebell'], 2),
('Kettlebell Swings', 'Dynamic hip hinge movement for power and conditioning', ARRAY['glutes', 'hamstrings', 'lower back', 'core'], 'compound', ARRAY['kettlebell'], 2),

-- Plyometric and Power
('Box Jumps', 'Jumping onto elevated box for explosive lower body power', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY['plyo box'], 4),
('Broad Jumps', 'Horizontal jumping for distance and power', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves'], 'plyometric', ARRAY[]::TEXT[], 4),
('Vertical Jumps', 'Maximal height jumping for explosive power', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY[]::TEXT[], 4),
('Single Leg Hops', 'Hopping on one leg for balance and unilateral power', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY[]::TEXT[], 3),
('Bounding', 'Running with exaggerated stride for speed and power development', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves'], 'plyometric', ARRAY[]::TEXT[], 3),
('Lateral Bounds', 'Side-to-side bounding for lateral power and agility', ARRAY['adductors', 'abductors', 'glutes', 'quadriceps'], 'plyometric', ARRAY[]::TEXT[], 3),

-- Upper Body Pulling
('Pull-ups', 'Bodyweight upper body pulling exercise for lats and biceps', ARRAY['lats', 'biceps', 'upper back', 'core'], 'compound', ARRAY['pull-up bar'], 4),
('Chin-ups', 'Underhand grip pull-up variation emphasizing biceps', ARRAY['biceps', 'lats', 'upper back', 'core'], 'compound', ARRAY['pull-up bar'], 4),
('Assisted Pull-ups', 'Machine or band assisted pull-up for progression', ARRAY['lats', 'biceps', 'upper back', 'core'], 'compound', ARRAY['pull-up machine', 'resistance band'], 2),
('Lat Pulldown', 'Machine movement for lat and upper back development', ARRAY['lats', 'biceps', 'upper back'], 'compound', ARRAY['lat pulldown machine'], 2),
('Seated Cable Row', 'Machine row for upper back and lat strength', ARRAY['upper back', 'lats', 'biceps'], 'compound', ARRAY['cable machine'], 2),
('Face Pulls', 'Rope cable exercise for rear shoulders and upper back', ARRAY['rear shoulders', 'upper back', 'biceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Band Pull-Aparts', 'Resistance band exercise for shoulder mobility and rear delts', ARRAY['rear shoulders', 'upper back', 'scapula'], 'isolation', ARRAY['resistance band'], 1),

-- Upper Body Pressing
('Push-ups', 'Bodyweight chest, shoulder and tricep pressing movement', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY[]::TEXT[], 2),
('Close Grip Push-ups', 'Push-up variation with hands closer for tricep emphasis', ARRAY['triceps', 'chest', 'shoulders'], 'compound', ARRAY[]::TEXT[], 3),
('Dips', 'Bodyweight pressing movement for chest and triceps', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY['dip bars', 'bench'], 3),
('Assisted Dips', 'Machine or band assisted dip for progression', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY['dip machine', 'resistance band'], 2),
('Dumbbell Bench Press', 'Dumbbell variation of bench press', ARRAY['chest', 'triceps', 'shoulders', 'stabilizer muscles'], 'compound', ARRAY['dumbbell', 'bench'], 3),
('Dumbbell Incline Press', 'Dumbbell incline pressing for upper chest', ARRAY['chest', 'shoulders', 'triceps'], 'compound', ARRAY['dumbbell', 'incline bench'], 3),

-- Tricep Isolation
('Tricep Dips', 'Bench dip variation using body weight', ARRAY['triceps', 'chest', 'shoulders'], 'isolation', ARRAY['bench'], 2),
('Rope Tricep Pushdown', 'Cable exercise for tricep isolation', ARRAY['triceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Skull Crushers', 'Barbell or dumbbell exercise for tricep strength', ARRAY['triceps'], 'isolation', ARRAY['barbell', 'dumbbell', 'bench'], 2),
('Tricep Rope Extensions', 'Overhead cable extension for long head of tricep', ARRAY['triceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),

-- Shoulder Isolation
('Lateral Raises', 'Dumbbell side raise for lateral shoulder development', ARRAY['lateral shoulders', 'core'], 'isolation', ARRAY['dumbbell'], 1),
('Front Raises', 'Dumbbell front raise for anterior shoulder', ARRAY['anterior shoulders', 'core'], 'isolation', ARRAY['dumbbell'], 1),
('Reverse Pec Deck', 'Machine exercise for rear shoulder development', ARRAY['rear shoulders', 'upper back'], 'isolation', ARRAY['pec deck machine'], 1),
('Shoulder Shrugs', 'Dumbbell or barbell shrug for trap strength', ARRAY['traps', 'upper back'], 'isolation', ARRAY['dumbbell', 'barbell'], 1),

-- Core and Stability
('Plank', 'Isometric core exercise for stability and endurance', ARRAY['core', 'shoulders', 'lower back'], 'isolation', ARRAY[]::TEXT[], 1),
('Side Plank', 'Single-side plank for obliques and lateral core', ARRAY['obliques', 'lateral core', 'shoulders'], 'isolation', ARRAY[]::TEXT[], 1),
('Pallof Press', 'Cable anti-rotation exercise for core stability', ARRAY['core', 'obliques', 'shoulders'], 'isolation', ARRAY['cable machine'], 2),
('Cable Woodchops', 'Rotational core exercise for power and stability', ARRAY['core', 'obliques', 'shoulders'], 'isolation', ARRAY['cable machine'], 2),
('Dead Bug', 'Lying core exercise for stability and coordination', ARRAY['core', 'lower back'], 'isolation', ARRAY[]::TEXT[], 1),
('Bird Dog', 'Quadruped core exercise for stability', ARRAY['core', 'lower back', 'glutes'], 'isolation', ARRAY[]::TEXT[], 1),
('Hanging Leg Raises', 'Hanging core exercise for lower ab strength', ARRAY['core', 'hip flexors'], 'isolation', ARRAY['pull-up bar'], 3),
('Ab Wheel Rollouts', 'Kneeling or standing core exercise for strength', ARRAY['core', 'shoulders', 'lower back'], 'isolation', ARRAY['ab wheel'], 3),
('Russian Twists', 'Rotational core exercise for obliques', ARRAY['obliques', 'core'], 'isolation', ARRAY['medicine ball', 'weight plate'], 1),

-- Calf and Ankle
('Calf Raises', 'Standing calf raise for ankle plantar flexors', ARRAY['calves'], 'isolation', ARRAY['barbell', 'dumbbell'], 1),
('Seated Calf Raises', 'Machine or seated calf raise variation', ARRAY['calves'], 'isolation', ARRAY['calf machine'], 1),

-- Lower Body Assistance
('Leg Press', 'Machine squat variation for leg strength', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'compound', ARRAY['leg press machine'], 2),
('Leg Curl', 'Machine exercise for hamstring isolation', ARRAY['hamstrings'], 'isolation', ARRAY['leg curl machine'], 1),
('Leg Extension', 'Machine exercise for quadriceps isolation', ARRAY['quadriceps'], 'isolation', ARRAY['leg extension machine'], 1),

-- Battle Ropes and Sled Work
('Battle Ropes', 'Wave-based exercise for power and conditioning', ARRAY['core', 'shoulders', 'cardio system'], 'cardio', ARRAY['battle ropes'], 2),
('Sled Push', 'Heavy sled push for lower body power and conditioning', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['weighted sled'], 2),
('Prowler Push', 'Prowler sled push for quad and glute development', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['prowler sled'], 2),
('Sled Drag', 'Sled dragging for posterior chain and conditioning', ARRAY['glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['weighted sled', 'rope'], 2),

-- Dumbbell Variations
('Dumbbell Rows', 'Single arm dumbbell row for back and core', ARRAY['upper back', 'lats', 'biceps', 'core'], 'compound', ARRAY['dumbbell'], 2),
('Dumbbell Flyes', 'Dumbbell chest fly for pectorals and stability', ARRAY['chest', 'shoulders', 'stabilizer muscles'], 'isolation', ARRAY['dumbbell', 'bench'], 2),
('Dumbbell Pullovers', 'Chest and back exercise with dumbbell', ARRAY['chest', 'lats', 'core'], 'compound', ARRAY['dumbbell', 'bench'], 2),
('Dumbbell Overhead Press', 'Standing dumbbell shoulder press', ARRAY['shoulders', 'triceps', 'core'], 'compound', ARRAY['dumbbell'], 2),
('Dumbbell Curls', 'Dumbbell bicep curl for arm strength', ARRAY['biceps', 'forearms'], 'isolation', ARRAY['dumbbell'], 1),
('Hammer Curls', 'Neutral grip dumbbell curl emphasizing brachialis', ARRAY['biceps', 'brachialis', 'forearms'], 'isolation', ARRAY['dumbbell'], 1),

-- Olympic and Power Variations
('Power Snatch', 'Olympic weightlifting movement for explosive power', ARRAY['quadriceps', 'hamstrings', 'glutes', 'shoulders', 'core'], 'compound', ARRAY['barbell', 'bumper plates'], 5),
('Hang Power Clean', 'Clean from hip height for power development', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 4),

-- Mobility and Flexibility
('Thoracic Foam Rolling', 'Self-myofascial release for thoracic mobility', ARRAY['thoracic spine', 'upper back'], 'mobility', ARRAY['foam roller'], 1),
('Hip Mobility Work', 'Dynamic and static stretching for hip range of motion', ARRAY['hips', 'core'], 'mobility', ARRAY[]::TEXT[], 1),
('Pigeon Pose', 'Hip opener stretch for glutes and hip flexors', ARRAY['glutes', 'hip flexors', 'hips'], 'mobility', ARRAY[]::TEXT[], 1),
('Cat-Cow Stretch', 'Spinal mobilization exercise for thoracic and lumbar spine', ARRAY['spine', 'core'], 'mobility', ARRAY[]::TEXT[], 1),

-- Conditioning
('Jump Rope', 'Rope skipping for cardiovascular conditioning and coordination', ARRAY['calves', 'core', 'cardiovascular system'], 'cardio', ARRAY['jump rope'], 1),
('Rowing Machine', 'Machine-based full body cardio and conditioning', ARRAY['lats', 'upper back', 'legs', 'core', 'cardiovascular system'], 'cardio', ARRAY['rowing machine'], 2),
('Assault Bike', 'Fan-based bike for high intensity conditioning', ARRAY['legs', 'cardiovascular system', 'core'], 'cardio', ARRAY['assault bike'], 2),
('Sprints', 'High-speed running for speed and power development', ARRAY['quadriceps', 'hamstrings', 'glutes', 'calves', 'cardiovascular system'], 'cardio', ARRAY[]::TEXT[], 2),
('Hill Sprints', 'Incline sprints for power and conditioning', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves', 'cardiovascular system'], 'cardio', ARRAY[]::TEXT[], 3),
('Shuttle Runs', 'Directional running for agility and conditioning', ARRAY['legs', 'cardiovascular system', 'core'], 'cardio', ARRAY[]::TEXT[], 2);

-- ============================================================
-- MIGRATION 005: CONDITIONING TEMPLATES (Sam's session library)
-- ============================================================

-- Add extra program phase values
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Post-Season';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Early-Off-Season';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Base-Building';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Pre-Season-Skills';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Christmas-Block';
ALTER TYPE program_phase ADD VALUE IF NOT EXISTS 'Return-to-Skills';

-- Add conditioning workout type values
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

-- Add mini_cycle_number to microcycles
ALTER TABLE microcycles ADD COLUMN IF NOT EXISTS mini_cycle_number INT DEFAULT 1;

-- Seed Sam's conditioning session templates
INSERT INTO conditioning_templates (name, session_type, description, coaching_cues, default_work_seconds, default_rest_seconds, default_rounds, default_duration_minutes, default_modality, default_effort_level, recommended_phases, recommended_frequency)
VALUES
  ('Flush-Out Session', 'flush_out', '30 seconds on, 30 seconds off for 30 minutes. Rotate through bike, ski erg, and rower. Gets blood flowing without impact stress.', 'Keep it easy. This is about recovery, not fitness. Rotate stations every few rounds. No impact on legs.', 30, 30, NULL, 30, 'mixed', 'moderate', ARRAY['In-Season', 'Return-to-Skills'], '1-2x per week in-season'),
  ('Sprint Intervals - 6x10s', 'sprint_intervals', 'Accumulate 1 minute of maximal sprinting on assault bike. 3 min warm-up, 1 min rest, then 6 x 10 seconds absolutely flat out, starting every 1 minute.', 'MAXIMAL effort. Not 80%. Not pretty hard. Absolutely everything you have got. This is the secret weapon for in-season conditioning.', 10, 50, 6, 15, 'assault_bike', 'maximal', ARRAY['In-Season', 'Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),
  ('Sprint Intervals - 3x20s', 'sprint_intervals', 'Accumulate 1 minute of maximal sprinting. 3 min warm-up, 1 min rest, then 3 x 20 seconds absolutely flat out, starting every 2 minutes.', 'Same deal as 6x10s — MAXIMAL effort. Longer efforts, fewer reps, more rest between.', 20, 100, 3, 15, 'assault_bike', 'maximal', ARRAY['In-Season', 'Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),
  ('Nordic 4x4', 'nordic_4x4', '4 rounds of 4 minutes at high intensity with rest between rounds. Great aerobic base builder and mental toughness session.', 'Can be done on bike, rower, running, or a mix. Keep the intensity honest — should be uncomfortable but sustainable for 4 minutes.', 240, 180, 4, 30, 'mixed', 'high', ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week'),
  ('Long Slow Run', 'long_run', 'One long slow run per week, 35-50 minutes. Conversational pace. Builds aerobic base without flogging the body.', 'Conversational pace — if you cannot talk, slow down. Best from October through February. Drop it once season kicks in.', NULL, NULL, NULL, 45, 'running', 'conversational', ARRAY['Early-Off-Season', 'Base-Building', 'Pre-Season-Skills'], '1x per week, Oct-Feb'),
  ('MetCon', 'metcon', 'Mix of intervals, running, bodyweight reps (push-ups, squats), and carries. Versatile and scalable.', 'Scale to any fitness level. Great for work capacity and general physical preparedness. Mix it up — variety is the point.', NULL, NULL, NULL, 25, 'mixed', 'high', ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week or every 2 weeks'),
  ('Flog Friday', 'flog_friday', 'A gut-wrenching conditioning session designed to improve fitness AND increase grit. Hard on purpose.', 'This builds mental toughness that separates blokes who fold in the last quarter from blokes who keep going. Not every week — use when the athlete needs to be tested.', NULL, NULL, NULL, 30, 'mixed', 'maximal', ARRAY['Pre-Season-Skills', 'Christmas-Block'], 'As needed — not every week'),
  ('6x1km Efforts', '6x1km', '6 x 1km running efforts, starting every 7 minutes. Faster runners get more rest, slower runners get less — self-regulating.', 'Great for aerobic power and running economy. A pre-season favourite. Keep quality high throughout all 6 efforts.', NULL, NULL, 6, 42, 'running', 'high', ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week in pre-season'),
  ('Hill Sprints', 'hill_sprints', 'Sprint up, walk back down. Plenty of rest between efforts. Power and speed session, not a cardio flog.', 'The incline naturally reduces injury risk. Keep the quality high. When sprints start looking rubbish, the session is done.', NULL, NULL, 8, 25, 'running', 'maximal', ARRAY['Pre-Season-Skills', 'Christmas-Block'], '1x per week'),
  ('MAS Training 15:15', 'mas_training', '15 seconds on, 15 seconds off, repeated for 8 reps. Rest 2 minutes, repeat for 4-5 total rounds. Hit distance benchmarks: 60m (unfit) to 100m (elite).', 'Science-backed method for improving maximal aerobic speed. Staple of professional football conditioning. Excellent engine builder.', 15, 15, 40, 30, 'running', 'high', ARRAY['Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),
  ('Tempo Runs', 'tempo_run', 'Controlled-pace running at 70-80% effort. Builds running economy and bridges base fitness to match-intensity running.', 'Most effective just before team training resumes. Teaches athletes to run efficiently. Not a sprint session — controlled quality.', NULL, NULL, NULL, 30, 'running', '80_percent', ARRAY['Base-Building', 'Pre-Season-Skills'], '1x per week'),
  ('Quality Sprint Session', 'quality_sprints', '10-15 x 100m sprint at 80%, starting every 2 minutes. Generous rest is deliberate — goal is quality running at high speed.', 'This is for SPRINTING, not another breather. Quality running at high speed. Develops actual speed and improves running mechanics.', NULL, NULL, 12, 30, 'running', '80_percent', ARRAY['Pre-Season-Skills', 'Christmas-Block', 'Return-to-Skills'], '1x per week');

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
