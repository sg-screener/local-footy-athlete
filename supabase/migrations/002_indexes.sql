-- Performance indexes for frequently queried tables

-- Logged workouts indexes
CREATE INDEX idx_logged_workouts_user_date ON logged_workouts(user_id, logged_date DESC);
CREATE INDEX idx_logged_workouts_user_completed ON logged_workouts(user_id, completed);
CREATE INDEX idx_logged_workouts_workout_id ON logged_workouts(workout_id);

-- Workout exercises indexes
CREATE INDEX idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX idx_workout_exercises_exercise_id ON workout_exercises(exercise_id);

-- Microcycles indexes
CREATE INDEX idx_microcycles_program_id ON microcycles(program_id);
CREATE INDEX idx_microcycles_program_week ON microcycles(program_id, week_number);

-- Workouts indexes
CREATE INDEX idx_workouts_microcycle_id ON workouts(microcycle_id);

-- Exercises indexes (for muscle group filtering)
CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
CREATE INDEX idx_exercises_type ON exercises(exercise_type);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty_level);

-- AI Coach indexes
CREATE INDEX idx_ai_coach_messages_conversation ON ai_coach_messages(conversation_id, created_at DESC);
CREATE INDEX idx_ai_coach_conversations_user ON ai_coach_conversations(user_id, created_at DESC);

-- Training programs indexes
CREATE INDEX idx_training_programs_user ON training_programs(user_id, is_active);
CREATE INDEX idx_training_programs_user_phase ON training_programs(user_id, program_phase);
CREATE INDEX idx_training_programs_dates ON training_programs(start_date, end_date);

-- Schedule events indexes
CREATE INDEX idx_schedule_events_user_date ON schedule_events(user_id, start_date);
CREATE INDEX idx_schedule_events_user_type ON schedule_events(user_id, event_type);

-- Logged sets indexes
CREATE INDEX idx_logged_sets_logged_workout ON logged_sets(logged_workout_id);
CREATE INDEX idx_logged_sets_exercise ON logged_sets(workout_exercise_id);

-- Program modifications indexes
CREATE INDEX idx_program_modifications_program ON program_modifications(program_id);

-- User preferences indexes
CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- Profiles indexes for common queries
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_subscription ON profiles(subscription_status);
