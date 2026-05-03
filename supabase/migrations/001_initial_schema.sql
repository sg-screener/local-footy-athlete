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
  form_notes TEXT,
  difficulty_level INT CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
  actual_rpe INT CHECK (actual_rpe >= 1 AND actual_rpe >= 10),
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
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

CREATE TRIGGER update_ai_coach_messages_updated_at BEFORE UPDATE ON ai_coach_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON schedule_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_modifications_updated_at BEFORE UPDATE ON program_modifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
