-- Enable Row Level Security on all tables
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

-- PROFILES POLICIES
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for onboarding)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- TRAINING PROGRAMS POLICIES
-- Users can select their own programs
CREATE POLICY "training_programs_select_own" ON training_programs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own programs
CREATE POLICY "training_programs_insert_own" ON training_programs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own programs
CREATE POLICY "training_programs_update_own" ON training_programs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own programs
CREATE POLICY "training_programs_delete_own" ON training_programs
  FOR DELETE USING (auth.uid() = user_id);

-- MICROCYCLES POLICIES
-- Users can select microcycles of their own programs
CREATE POLICY "microcycles_select_own" ON microcycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = microcycles.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can insert microcycles for their own programs
CREATE POLICY "microcycles_insert_own" ON microcycles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can update microcycles of their own programs
CREATE POLICY "microcycles_update_own" ON microcycles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = microcycles.program_id
      AND training_programs.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can delete microcycles of their own programs
CREATE POLICY "microcycles_delete_own" ON microcycles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = microcycles.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- WORKOUTS POLICIES
-- Users can select workouts from their own programs
CREATE POLICY "workouts_select_own" ON workouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM microcycles
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE microcycles.id = workouts.microcycle_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can insert workouts for their own programs
CREATE POLICY "workouts_insert_own" ON workouts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM microcycles
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE microcycles.id = microcycle_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can update workouts of their own programs
CREATE POLICY "workouts_update_own" ON workouts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM microcycles
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE microcycles.id = workouts.microcycle_id
      AND training_programs.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM microcycles
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE microcycles.id = microcycle_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can delete workouts from their own programs
CREATE POLICY "workouts_delete_own" ON workouts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM microcycles
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE microcycles.id = workouts.microcycle_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- EXERCISES POLICIES
-- All authenticated users can read exercises
CREATE POLICY "exercises_select_all" ON exercises
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins or service role can insert exercises
CREATE POLICY "exercises_insert_admin" ON exercises
  FOR INSERT WITH CHECK (false);

-- Only admins or service role can update exercises
CREATE POLICY "exercises_update_admin" ON exercises
  FOR UPDATE USING (false)
  WITH CHECK (false);

-- WORKOUT EXERCISES POLICIES
-- Users can select workout exercises from their own programs
CREATE POLICY "workout_exercises_select_own" ON workout_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workouts
      JOIN microcycles ON microcycles.id = workouts.microcycle_id
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE workouts.id = workout_exercises.workout_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can insert workout exercises for their own programs
CREATE POLICY "workout_exercises_insert_own" ON workout_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      JOIN microcycles ON microcycles.id = workouts.microcycle_id
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE workouts.id = workout_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can update workout exercises of their own programs
CREATE POLICY "workout_exercises_update_own" ON workout_exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workouts
      JOIN microcycles ON microcycles.id = workouts.microcycle_id
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE workouts.id = workout_exercises.workout_id
      AND training_programs.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      JOIN microcycles ON microcycles.id = workouts.microcycle_id
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE workouts.id = workout_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can delete workout exercises from their own programs
CREATE POLICY "workout_exercises_delete_own" ON workout_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workouts
      JOIN microcycles ON microcycles.id = workouts.microcycle_id
      JOIN training_programs ON training_programs.id = microcycles.program_id
      WHERE workouts.id = workout_exercises.workout_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- LOGGED WORKOUTS POLICIES
-- Users can select their own logged workouts
CREATE POLICY "logged_workouts_select_own" ON logged_workouts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own logged workouts
CREATE POLICY "logged_workouts_insert_own" ON logged_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own logged workouts
CREATE POLICY "logged_workouts_update_own" ON logged_workouts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own logged workouts
CREATE POLICY "logged_workouts_delete_own" ON logged_workouts
  FOR DELETE USING (auth.uid() = user_id);

-- LOGGED SETS POLICIES
-- Users can select logged sets from their own logged workouts
CREATE POLICY "logged_sets_select_own" ON logged_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM logged_workouts
      WHERE logged_workouts.id = logged_sets.logged_workout_id
      AND logged_workouts.user_id = auth.uid()
    )
  );

-- Users can insert logged sets for their own logged workouts
CREATE POLICY "logged_sets_insert_own" ON logged_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM logged_workouts
      WHERE logged_workouts.id = logged_workout_id
      AND logged_workouts.user_id = auth.uid()
    )
  );

-- Users can update logged sets from their own logged workouts
CREATE POLICY "logged_sets_update_own" ON logged_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM logged_workouts
      WHERE logged_workouts.id = logged_sets.logged_workout_id
      AND logged_workouts.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM logged_workouts
      WHERE logged_workouts.id = logged_workout_id
      AND logged_workouts.user_id = auth.uid()
    )
  );

-- Users can delete logged sets from their own logged workouts
CREATE POLICY "logged_sets_delete_own" ON logged_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM logged_workouts
      WHERE logged_workouts.id = logged_sets.logged_workout_id
      AND logged_workouts.user_id = auth.uid()
    )
  );

-- AI COACH CONVERSATIONS POLICIES
-- Users can select their own conversations
CREATE POLICY "ai_coach_conversations_select_own" ON ai_coach_conversations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "ai_coach_conversations_insert_own" ON ai_coach_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "ai_coach_conversations_update_own" ON ai_coach_conversations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "ai_coach_conversations_delete_own" ON ai_coach_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- AI COACH MESSAGES POLICIES
-- Users can select messages from their own conversations
CREATE POLICY "ai_coach_messages_select_own" ON ai_coach_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_coach_conversations
      WHERE ai_coach_conversations.id = ai_coach_messages.conversation_id
      AND ai_coach_conversations.user_id = auth.uid()
    )
  );

-- Users can insert messages in their own conversations
CREATE POLICY "ai_coach_messages_insert_own" ON ai_coach_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_coach_conversations
      WHERE ai_coach_conversations.id = conversation_id
      AND ai_coach_conversations.user_id = auth.uid()
    )
  );

-- Users can delete messages from their own conversations
CREATE POLICY "ai_coach_messages_delete_own" ON ai_coach_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ai_coach_conversations
      WHERE ai_coach_conversations.id = ai_coach_messages.conversation_id
      AND ai_coach_conversations.user_id = auth.uid()
    )
  );

-- SCHEDULE EVENTS POLICIES
-- Users can select their own schedule events
CREATE POLICY "schedule_events_select_own" ON schedule_events
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own schedule events
CREATE POLICY "schedule_events_insert_own" ON schedule_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own schedule events
CREATE POLICY "schedule_events_update_own" ON schedule_events
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own schedule events
CREATE POLICY "schedule_events_delete_own" ON schedule_events
  FOR DELETE USING (auth.uid() = user_id);

-- PROGRAM MODIFICATIONS POLICIES
-- Users can select modifications for their own programs
CREATE POLICY "program_modifications_select_own" ON program_modifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = program_modifications.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can insert modifications for their own programs
CREATE POLICY "program_modifications_insert_own" ON program_modifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Users can delete modifications from their own programs
CREATE POLICY "program_modifications_delete_own" ON program_modifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = program_modifications.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- USER PREFERENCES POLICIES
-- Users can select their own preferences
CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "user_preferences_insert_own" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "user_preferences_update_own" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "user_preferences_delete_own" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);
