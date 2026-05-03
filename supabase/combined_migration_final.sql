-- ============================================================
-- LOCAL FOOTY ATHLETE - COMPLETE DATABASE SETUP (FIXED)
-- ============================================================

-- STEP 1: ENUMS
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced', 'professional');
CREATE TYPE position_type AS ENUM ('forward', 'midfielder', 'defender', 'ruck', 'utility');
CREATE TYPE subscription_status AS ENUM ('free', 'premium', 'team');
CREATE TYPE program_phase AS ENUM ('Off-Season', 'Pre-Season', 'In-Season', 'Finals', 'Post-Season', 'Early-Off-Season', 'Base-Building', 'Pre-Season-Skills', 'Christmas-Block', 'Return-to-Skills');
CREATE TYPE workout_type AS ENUM ('strength', 'conditioning', 'skill', 'recovery', 'mobility', 'flush_out', 'sprint_intervals', 'nordic_4x4', 'long_run', 'metcon', 'flog_friday', '6x1km', 'hill_sprints', 'mas_training', 'tempo_run', 'quality_sprints', 'gun_show');
CREATE TYPE exercise_type AS ENUM ('compound', 'isolation', 'cardio', 'mobility', 'plyometric');
CREATE TYPE modification_type AS ENUM ('skip', 'reschedule', 'intensity_adjustment', 'exercise_swap');
CREATE TYPE schedule_event_type AS ENUM ('game', 'match', 'rest_day', 'recovery_session', 'other');
CREATE TYPE session_feeling AS ENUM ('cooked', 'strong', 'good', 'average', 'sore');

-- STEP 2: TABLES
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
  has_gym_access BOOLEAN DEFAULT true,
  has_home_equipment BOOLEAN DEFAULT false,
  training_location TEXT,
  days_per_week INT DEFAULT 4,
  training_time_preference TEXT,
  injury_history TEXT[] DEFAULT ARRAY[]::TEXT[],
  current_injuries TEXT,
  primary_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  secondary_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  subscription_status subscription_status DEFAULT 'free',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  onboarding_completed BOOLEAN DEFAULT false,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE microcycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  mini_cycle_number INT DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_deload_week BOOLEAN DEFAULT false,
  intensity_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_week_per_program UNIQUE(program_id, week_number)
);

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

COMMENT ON COLUMN exercises.gif_url IS 'Cached animated GIF URL from ExerciseDB API.';

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

CREATE TABLE logged_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE SET NULL,
  logged_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INT,
  perceived_difficulty INT CHECK (perceived_difficulty >= 1 AND perceived_difficulty <= 10),
  session_feeling session_feeling,
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE ai_coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_coach_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE program_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  modification_type modification_type NOT NULL,
  description TEXT,
  trigger_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- STEP 3: TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_programs_updated_at BEFORE UPDATE ON training_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_microcycles_updated_at BEFORE UPDATE ON microcycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON workouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workout_exercises_updated_at BEFORE UPDATE ON workout_exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_logged_workouts_updated_at BEFORE UPDATE ON logged_workouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_logged_sets_updated_at BEFORE UPDATE ON logged_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_coach_conversations_updated_at BEFORE UPDATE ON ai_coach_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON schedule_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_modifications_updated_at BEFORE UPDATE ON program_modifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conditioning_sessions_updated_at BEFORE UPDATE ON conditioning_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conditioning_templates_updated_at BEFORE UPDATE ON conditioning_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 4: INDEXES
CREATE INDEX idx_logged_workouts_user_date ON logged_workouts(user_id, logged_date DESC);
CREATE INDEX idx_logged_workouts_user_completed ON logged_workouts(user_id, completed);
CREATE INDEX idx_logged_workouts_workout_id ON logged_workouts(workout_id);
CREATE INDEX idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX idx_workout_exercises_exercise_id ON workout_exercises(exercise_id);
CREATE INDEX idx_microcycles_program_id ON microcycles(program_id);
CREATE INDEX idx_microcycles_program_week ON microcycles(program_id, week_number);
CREATE INDEX idx_microcycles_mini_cycle ON microcycles(program_id, mini_cycle_number);
CREATE INDEX idx_workouts_microcycle_id ON workouts(microcycle_id);
CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
CREATE INDEX idx_exercises_type ON exercises(exercise_type);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty_level);
CREATE INDEX idx_exercises_gif_url_null ON exercises (name) WHERE gif_url IS NULL;
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
CREATE INDEX idx_conditioning_sessions_workout ON conditioning_sessions(workout_id);
CREATE INDEX idx_conditioning_templates_type ON conditioning_templates(session_type);

-- STEP 5: ROW LEVEL SECURITY
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

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "training_programs_select_own" ON training_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "training_programs_insert_own" ON training_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_programs_update_own" ON training_programs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "training_programs_delete_own" ON training_programs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "microcycles_select_own" ON microcycles FOR SELECT USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = microcycles.program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "microcycles_insert_own" ON microcycles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "microcycles_update_own" ON microcycles FOR UPDATE USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = microcycles.program_id AND training_programs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "microcycles_delete_own" ON microcycles FOR DELETE USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = microcycles.program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_select_own" ON workouts FOR SELECT USING (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = workouts.microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_insert_own" ON workouts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_update_own" ON workouts FOR UPDATE USING (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = workouts.microcycle_id AND training_programs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workouts_delete_own" ON workouts FOR DELETE USING (EXISTS (SELECT 1 FROM microcycles JOIN training_programs ON training_programs.id = microcycles.program_id WHERE microcycles.id = workouts.microcycle_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "exercises_select_all" ON exercises FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "exercises_insert_admin" ON exercises FOR INSERT WITH CHECK (false);
CREATE POLICY "exercises_update_admin" ON exercises FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "workout_exercises_select_own" ON workout_exercises FOR SELECT USING (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_exercises.workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workout_exercises_insert_own" ON workout_exercises FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workout_exercises_update_own" ON workout_exercises FOR UPDATE USING (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_exercises.workout_id AND training_programs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "workout_exercises_delete_own" ON workout_exercises FOR DELETE USING (EXISTS (SELECT 1 FROM workouts JOIN microcycles ON microcycles.id = workouts.microcycle_id JOIN training_programs ON training_programs.id = microcycles.program_id WHERE workouts.id = workout_exercises.workout_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "logged_workouts_select_own" ON logged_workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "logged_workouts_insert_own" ON logged_workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logged_workouts_update_own" ON logged_workouts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logged_workouts_delete_own" ON logged_workouts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "logged_sets_select_own" ON logged_sets FOR SELECT USING (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_sets.logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "logged_sets_insert_own" ON logged_sets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "logged_sets_update_own" ON logged_sets FOR UPDATE USING (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_sets.logged_workout_id AND logged_workouts.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "logged_sets_delete_own" ON logged_sets FOR DELETE USING (EXISTS (SELECT 1 FROM logged_workouts WHERE logged_workouts.id = logged_sets.logged_workout_id AND logged_workouts.user_id = auth.uid()));
CREATE POLICY "ai_coach_conversations_select_own" ON ai_coach_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_coach_conversations_insert_own" ON ai_coach_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_coach_conversations_update_own" ON ai_coach_conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_coach_conversations_delete_own" ON ai_coach_conversations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "ai_coach_messages_select_own" ON ai_coach_messages FOR SELECT USING (EXISTS (SELECT 1 FROM ai_coach_conversations WHERE ai_coach_conversations.id = ai_coach_messages.conversation_id AND ai_coach_conversations.user_id = auth.uid()));
CREATE POLICY "ai_coach_messages_insert_own" ON ai_coach_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ai_coach_conversations WHERE ai_coach_conversations.id = conversation_id AND ai_coach_conversations.user_id = auth.uid()));
CREATE POLICY "ai_coach_messages_delete_own" ON ai_coach_messages FOR DELETE USING (EXISTS (SELECT 1 FROM ai_coach_conversations WHERE ai_coach_conversations.id = ai_coach_messages.conversation_id AND ai_coach_conversations.user_id = auth.uid()));
CREATE POLICY "schedule_events_select_own" ON schedule_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "schedule_events_insert_own" ON schedule_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_events_update_own" ON schedule_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_events_delete_own" ON schedule_events FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "program_modifications_select_own" ON program_modifications FOR SELECT USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_modifications.program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "program_modifications_insert_own" ON program_modifications FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "program_modifications_delete_own" ON program_modifications FOR DELETE USING (EXISTS (SELECT 1 FROM training_programs WHERE training_programs.id = program_modifications.program_id AND training_programs.user_id = auth.uid()));
CREATE POLICY "user_preferences_select_own" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete_own" ON user_preferences FOR DELETE USING (auth.uid() = user_id);

-- STEP 6: SEED EXERCISES (80+)
INSERT INTO exercises (name, description, muscle_groups, exercise_type, equipment_required, difficulty_level) VALUES
('Back Squat', 'Barbell squat with bar on back shoulders', ARRAY['quadriceps', 'glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Front Squat', 'Barbell squat with bar on front shoulders', ARRAY['quadriceps', 'glutes', 'core', 'upper back'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Deadlift', 'Barbell lift from ground to hip height', ARRAY['hamstrings', 'glutes', 'lower back', 'upper back', 'core'], 'compound', ARRAY['barbell', 'plates'], 5),
('Romanian Deadlift', 'Hinge movement emphasizing hamstrings', ARRAY['hamstrings', 'glutes', 'lower back', 'upper back'], 'compound', ARRAY['barbell', 'dumbbell'], 3),
('Bench Press', 'Barbell pressing for chest, shoulders, triceps', ARRAY['chest', 'triceps', 'shoulders'], 'compound', ARRAY['barbell', 'bench', 'squat rack'], 4),
('Incline Bench Press', 'Angled bench press for upper chest', ARRAY['chest', 'shoulders', 'triceps'], 'compound', ARRAY['barbell', 'incline bench'], 3),
('Decline Bench Press', 'Downward angle bench press for lower chest', ARRAY['chest', 'triceps', 'shoulders'], 'compound', ARRAY['barbell', 'decline bench'], 3),
('Barbell Row', 'Bent-over row for upper back and lats', ARRAY['upper back', 'lats', 'biceps', 'lower back'], 'compound', ARRAY['barbell', 'plates'], 4),
('Pendulum Row', 'Machine row reducing lower back strain', ARRAY['upper back', 'lats', 'biceps'], 'compound', ARRAY['pendulum machine'], 2),
('Overhead Press', 'Standing barbell press for shoulders', ARRAY['shoulders', 'triceps', 'upper chest', 'core'], 'compound', ARRAY['barbell', 'squat rack'], 4),
('Push Press', 'Overhead press with leg drive', ARRAY['shoulders', 'triceps', 'legs', 'core'], 'compound', ARRAY['barbell'], 4),
('Power Clean', 'Olympic lift for explosive power', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 5),
('Hang Clean', 'Olympic lift from hip height', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 4),
('Hip Thrust', 'Barbell hip extension for glutes', ARRAY['glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['barbell', 'bench'], 3),
('Bulgarian Split Squat', 'Single leg squat with rear foot elevated', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'compound', ARRAY['dumbbell', 'bench'], 3),
('Lunges', 'Single leg movement for quads and glutes', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'compound', ARRAY['dumbbell', 'barbell'], 2),
('Walking Lunges', 'Dynamic lunge variation', ARRAY['quadriceps', 'glutes', 'hamstrings', 'core'], 'compound', ARRAY['dumbbell', 'barbell'], 2),
('Goblet Squat', 'Dumbbell squat held at chest', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['dumbbell', 'kettlebell'], 2),
('Kettlebell Swings', 'Dynamic hip hinge for power', ARRAY['glutes', 'hamstrings', 'lower back', 'core'], 'compound', ARRAY['kettlebell'], 2),
('Box Jumps', 'Jump onto elevated box', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY['plyo box'], 4),
('Broad Jumps', 'Horizontal jumping for power', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves'], 'plyometric', ARRAY[]::TEXT[], 4),
('Vertical Jumps', 'Maximal height jumping', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY[]::TEXT[], 4),
('Single Leg Hops', 'Hopping on one leg for balance', ARRAY['quadriceps', 'glutes', 'calves', 'core'], 'plyometric', ARRAY[]::TEXT[], 3),
('Bounding', 'Exaggerated stride running', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves'], 'plyometric', ARRAY[]::TEXT[], 3),
('Lateral Bounds', 'Side-to-side bounding', ARRAY['adductors', 'abductors', 'glutes', 'quadriceps'], 'plyometric', ARRAY[]::TEXT[], 3),
('Pull-ups', 'Bodyweight pulling for lats and biceps', ARRAY['lats', 'biceps', 'upper back', 'core'], 'compound', ARRAY['pull-up bar'], 4),
('Chin-ups', 'Underhand grip pull-up', ARRAY['biceps', 'lats', 'upper back', 'core'], 'compound', ARRAY['pull-up bar'], 4),
('Assisted Pull-ups', 'Band assisted pull-up', ARRAY['lats', 'biceps', 'upper back', 'core'], 'compound', ARRAY['pull-up machine', 'resistance band'], 2),
('Lat Pulldown', 'Machine lat pulldown', ARRAY['lats', 'biceps', 'upper back'], 'compound', ARRAY['lat pulldown machine'], 2),
('Seated Cable Row', 'Machine row for upper back', ARRAY['upper back', 'lats', 'biceps'], 'compound', ARRAY['cable machine'], 2),
('Face Pulls', 'Cable exercise for rear shoulders', ARRAY['rear shoulders', 'upper back', 'biceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Band Pull-Aparts', 'Resistance band for rear delts', ARRAY['rear shoulders', 'upper back', 'scapula'], 'isolation', ARRAY['resistance band'], 1),
('Push-ups', 'Bodyweight chest pressing', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY[]::TEXT[], 2),
('Close Grip Push-ups', 'Push-up for tricep emphasis', ARRAY['triceps', 'chest', 'shoulders'], 'compound', ARRAY[]::TEXT[], 3),
('Dips', 'Bodyweight pressing for chest and triceps', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY['dip bars', 'bench'], 3),
('Assisted Dips', 'Machine assisted dip', ARRAY['chest', 'triceps', 'shoulders', 'core'], 'compound', ARRAY['dip machine', 'resistance band'], 2),
('Dumbbell Bench Press', 'Dumbbell bench press', ARRAY['chest', 'triceps', 'shoulders', 'stabilizer muscles'], 'compound', ARRAY['dumbbell', 'bench'], 3),
('Dumbbell Incline Press', 'Dumbbell incline pressing', ARRAY['chest', 'shoulders', 'triceps'], 'compound', ARRAY['dumbbell', 'incline bench'], 3),
('Tricep Dips', 'Bench dip for triceps', ARRAY['triceps', 'chest', 'shoulders'], 'isolation', ARRAY['bench'], 2),
('Rope Tricep Pushdown', 'Cable tricep pushdown', ARRAY['triceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Skull Crushers', 'Lying tricep extension', ARRAY['triceps'], 'isolation', ARRAY['barbell', 'dumbbell', 'bench'], 2),
('Tricep Rope Extensions', 'Overhead cable tricep extension', ARRAY['triceps'], 'isolation', ARRAY['cable machine', 'rope'], 1),
('Lateral Raises', 'Dumbbell side raise for shoulders', ARRAY['lateral shoulders', 'core'], 'isolation', ARRAY['dumbbell'], 1),
('Front Raises', 'Dumbbell front raise', ARRAY['anterior shoulders', 'core'], 'isolation', ARRAY['dumbbell'], 1),
('Reverse Pec Deck', 'Machine rear shoulder exercise', ARRAY['rear shoulders', 'upper back'], 'isolation', ARRAY['pec deck machine'], 1),
('Shoulder Shrugs', 'Dumbbell shrug for traps', ARRAY['traps', 'upper back'], 'isolation', ARRAY['dumbbell', 'barbell'], 1),
('Plank', 'Isometric core exercise', ARRAY['core', 'shoulders', 'lower back'], 'isolation', ARRAY[]::TEXT[], 1),
('Side Plank', 'Single-side plank for obliques', ARRAY['obliques', 'lateral core', 'shoulders'], 'isolation', ARRAY[]::TEXT[], 1),
('Pallof Press', 'Cable anti-rotation core exercise', ARRAY['core', 'obliques', 'shoulders'], 'isolation', ARRAY['cable machine'], 2),
('Cable Woodchops', 'Rotational core exercise', ARRAY['core', 'obliques', 'shoulders'], 'isolation', ARRAY['cable machine'], 2),
('Dead Bug', 'Lying core stability exercise', ARRAY['core', 'lower back'], 'isolation', ARRAY[]::TEXT[], 1),
('Bird Dog', 'Quadruped core stability exercise', ARRAY['core', 'lower back', 'glutes'], 'isolation', ARRAY[]::TEXT[], 1),
('Hanging Leg Raises', 'Hanging core exercise', ARRAY['core', 'hip flexors'], 'isolation', ARRAY['pull-up bar'], 3),
('Ab Wheel Rollouts', 'Core rollout exercise', ARRAY['core', 'shoulders', 'lower back'], 'isolation', ARRAY['ab wheel'], 3),
('Russian Twists', 'Rotational core for obliques', ARRAY['obliques', 'core'], 'isolation', ARRAY['medicine ball', 'weight plate'], 1),
('Calf Raises', 'Standing calf raise', ARRAY['calves'], 'isolation', ARRAY['barbell', 'dumbbell'], 1),
('Seated Calf Raises', 'Seated calf raise', ARRAY['calves'], 'isolation', ARRAY['calf machine'], 1),
('Leg Press', 'Machine squat for leg strength', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'compound', ARRAY['leg press machine'], 2),
('Leg Curl', 'Machine hamstring isolation', ARRAY['hamstrings'], 'isolation', ARRAY['leg curl machine'], 1),
('Leg Extension', 'Machine quad isolation', ARRAY['quadriceps'], 'isolation', ARRAY['leg extension machine'], 1),
('Battle Ropes', 'Wave exercise for conditioning', ARRAY['core', 'shoulders', 'cardio system'], 'cardio', ARRAY['battle ropes'], 2),
('Sled Push', 'Heavy sled push', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['weighted sled'], 2),
('Prowler Push', 'Prowler sled push', ARRAY['quadriceps', 'glutes', 'core'], 'compound', ARRAY['prowler sled'], 2),
('Sled Drag', 'Sled dragging for posterior chain', ARRAY['glutes', 'hamstrings', 'lower back'], 'compound', ARRAY['weighted sled', 'rope'], 2),
('Dumbbell Rows', 'Single arm dumbbell row', ARRAY['upper back', 'lats', 'biceps', 'core'], 'compound', ARRAY['dumbbell'], 2),
('Dumbbell Flyes', 'Dumbbell chest fly', ARRAY['chest', 'shoulders', 'stabilizer muscles'], 'isolation', ARRAY['dumbbell', 'bench'], 2),
('Dumbbell Pullovers', 'Chest and back pullover', ARRAY['chest', 'lats', 'core'], 'compound', ARRAY['dumbbell', 'bench'], 2),
('Dumbbell Overhead Press', 'Standing dumbbell shoulder press', ARRAY['shoulders', 'triceps', 'core'], 'compound', ARRAY['dumbbell'], 2),
('Dumbbell Curls', 'Dumbbell bicep curl', ARRAY['biceps', 'forearms'], 'isolation', ARRAY['dumbbell'], 1),
('Hammer Curls', 'Neutral grip dumbbell curl', ARRAY['biceps', 'brachialis', 'forearms'], 'isolation', ARRAY['dumbbell'], 1),
('Power Snatch', 'Olympic snatch for explosive power', ARRAY['quadriceps', 'hamstrings', 'glutes', 'shoulders', 'core'], 'compound', ARRAY['barbell', 'bumper plates'], 5),
('Hang Power Clean', 'Clean from hip height', ARRAY['quadriceps', 'hamstrings', 'glutes', 'upper back', 'shoulders'], 'compound', ARRAY['barbell', 'bumper plates'], 4),
('Thoracic Foam Rolling', 'Self-myofascial release', ARRAY['thoracic spine', 'upper back'], 'mobility', ARRAY['foam roller'], 1),
('Hip Mobility Work', 'Dynamic hip stretching', ARRAY['hips', 'core'], 'mobility', ARRAY[]::TEXT[], 1),
('Pigeon Pose', 'Hip opener stretch', ARRAY['glutes', 'hip flexors', 'hips'], 'mobility', ARRAY[]::TEXT[], 1),
('Cat-Cow Stretch', 'Spinal mobilization', ARRAY['spine', 'core'], 'mobility', ARRAY[]::TEXT[], 1),
('Jump Rope', 'Rope skipping for conditioning', ARRAY['calves', 'core', 'cardiovascular system'], 'cardio', ARRAY['jump rope'], 1),
('Rowing Machine', 'Full body cardio machine', ARRAY['lats', 'upper back', 'legs', 'core', 'cardiovascular system'], 'cardio', ARRAY['rowing machine'], 2),
('Assault Bike', 'Fan bike for high intensity', ARRAY['legs', 'cardiovascular system', 'core'], 'cardio', ARRAY['assault bike'], 2),
('Sprints', 'High-speed running', ARRAY['quadriceps', 'hamstrings', 'glutes', 'calves', 'cardiovascular system'], 'cardio', ARRAY[]::TEXT[], 2),
('Hill Sprints', 'Incline sprints', ARRAY['quadriceps', 'glutes', 'hamstrings', 'calves', 'cardiovascular system'], 'cardio', ARRAY[]::TEXT[], 3),
('Shuttle Runs', 'Directional running for agility', ARRAY['legs', 'cardiovascular system', 'core'], 'cardio', ARRAY[]::TEXT[], 2);

-- STEP 7: SEED CONDITIONING TEMPLATES
INSERT INTO conditioning_templates (name, session_type, description, coaching_cues, default_work_seconds, default_rest_seconds, default_rounds, default_duration_minutes, default_modality, default_effort_level, recommended_phases, recommended_frequency) VALUES
('Flush-Out Session', 'flush_out', '30 on/30 off for 30 min. Rotate bike, ski, rower.', 'Keep it easy. Recovery, not fitness.', 30, 30, NULL, 30, 'mixed', 'moderate', ARRAY['In-Season', 'Return-to-Skills'], '1-2x per week in-season'),
('Sprint Intervals - 6x10s', 'sprint_intervals', '6x10s flat out on assault bike, start every 1 min.', 'MAXIMAL effort. Secret weapon for in-season conditioning.', 10, 50, 6, 15, 'assault_bike', 'maximal', ARRAY['In-Season', 'Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),
('Sprint Intervals - 3x20s', 'sprint_intervals', '3x20s flat out on assault bike, start every 2 min.', 'MAXIMAL effort. Longer efforts, more rest.', 20, 100, 3, 15, 'assault_bike', 'maximal', ARRAY['In-Season', 'Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),
('Nordic 4x4', 'nordic_4x4', '4 rounds of 4 min at high intensity.', 'Uncomfortable but sustainable for 4 min.', 240, 180, 4, 30, 'mixed', 'high', ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week'),
('Long Slow Run', 'long_run', '35-50 min conversational pace.', 'If you cannot talk, slow down.', NULL, NULL, NULL, 45, 'running', 'conversational', ARRAY['Early-Off-Season', 'Base-Building', 'Pre-Season-Skills'], '1x per week, Oct-Feb'),
('MetCon', 'metcon', 'Mix of intervals, running, bodyweight, carries.', 'Scale to any level. Variety is the point.', NULL, NULL, NULL, 25, 'mixed', 'high', ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week'),
('Flog Friday', 'flog_friday', 'Gut-wrenching conditioning for fitness and grit.', 'Builds mental toughness. Not every week.', NULL, NULL, NULL, 30, 'mixed', 'maximal', ARRAY['Pre-Season-Skills', 'Christmas-Block'], 'As needed'),
('6x1km Efforts', '6x1km', '6x1km running, start every 7 min.', 'Keep quality high all 6 efforts.', NULL, NULL, 6, 42, 'running', 'high', ARRAY['Base-Building', 'Pre-Season-Skills', 'Christmas-Block'], '1x per week'),
('Hill Sprints', 'hill_sprints', 'Sprint up, walk down. Power session.', 'When sprints look rubbish, session is done.', NULL, NULL, 8, 25, 'running', 'maximal', ARRAY['Pre-Season-Skills', 'Christmas-Block'], '1x per week'),
('MAS Training 15:15', 'mas_training', '15s on/15s off, 4-5 rounds of 8 reps.', 'Science-backed maximal aerobic speed method.', 15, 15, 40, 30, 'running', 'high', ARRAY['Pre-Season-Skills', 'Christmas-Block'], '1-2x per week'),
('Tempo Runs', 'tempo_run', '30 min at 70-80% effort.', 'Not a sprint — controlled quality.', NULL, NULL, NULL, 30, 'running', '80_percent', ARRAY['Base-Building', 'Pre-Season-Skills'], '1x per week'),
('Quality Sprint Session', 'quality_sprints', '10-15x100m at 80%, start every 2 min.', 'Quality running at high speed.', NULL, NULL, 12, 30, 'running', '80_percent', ARRAY['Pre-Season-Skills', 'Christmas-Block', 'Return-to-Skills'], '1x per week');

-- DONE!
