/**
 * Shared types for Supabase Edge Functions
 * Used across generate-program, coach-send-message, and sync-exercises
 */

import { Database } from '../../../src/types/supabase';
import type { CanonicalEquipmentTag } from './equipment.ts';

export type DbUserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type DbTrainingProgram = Database['public']['Tables']['training_programs']['Row'];
export type DbMicrocycle = Database['public']['Tables']['microcycles']['Row'];
export type DbWorkout = Database['public']['Tables']['workouts']['Row'];
export type DbWorkoutExercise = Database['public']['Tables']['workout_exercises']['Row'];
export type DbExercise = Database['public']['Tables']['exercises']['Row'];
export type DbLoggedWorkout = Database['public']['Tables']['logged_workouts']['Row'];
export type DbCoachConversation = Database['public']['Tables']['coach_conversations']['Row'];
export type DbCoachMessage = Database['public']['Tables']['coach_messages']['Row'];

/**
 * Enums matching domain types
 */
export enum Position {
  Defender = 'Defender',
  Midfielder = 'Midfielder',
  Forward = 'Forward',
  Ruck = 'Ruck',
}

export enum ProgramPhase {
  PostSeason = 'Post-Season',
  EarlyOffSeason = 'Early-Off-Season',
  BaseBuilding = 'Base-Building',
  PreSeasonSkills = 'Pre-Season-Skills',
  ChristmasBlock = 'Christmas-Block',
  ReturnToSkills = 'Return-to-Skills',
  InSeason = 'In-Season',
}

export enum ExperienceLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export enum ExerciseType {
  Compound = 'Compound',
  Isolation = 'Isolation',
  Plyometric = 'Plyometric',
  Cardio = 'Cardio',
  Flexibility = 'Flexibility',
}

export enum IntensityLevel {
  Light = 'Light',
  Moderate = 'Moderate',
  High = 'High',
  Maximal = 'Maximal',
}

export enum SessionFeeling {
  Cooked = 'Cooked',
  Strong = 'Strong',
  Good = 'Good',
  Average = 'Average',
  Sore = 'Sore',
}

export enum WorkoutType {
  Strength = 'Strength',
  Conditioning = 'Conditioning',
  Technical = 'Technical',
  Recovery = 'Recovery',
  Mixed = 'Mixed',
}

export enum DifficultyLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
  Expert = 'Expert',
}

/**
 * Request/Response types for edge functions
 */

export interface GenerateProgramRequest {
  user_id: string;
  program_phase?: ProgramPhase;
  /** Canonical client-resolved availability; preferred over legacy DB booleans. */
  resolvedEquipmentTags?: CanonicalEquipmentTag[];
}

export interface GenerateProgramResponse {
  success: boolean;
  programId?: string;
  error?: string;
  message?: string;
}

export interface CoachSendMessageRequest {
  user_id: string;
  conversation_id: string;
  message: string;
}

export interface CoachSendMessageResponse {
  success: boolean;
  conversationId?: string;
  messageId?: string;
  response?: string;
  error?: string;
}

export interface SyncExercisesRequest {
  limit?: number;
  offset?: number;
}

export interface SyncExercisesResponse {
  success: boolean;
  syncedCount?: number;
  error?: string;
  message?: string;
}

/**
 * Rules Engine Configuration
 */

export interface PhaseConfig {
  repRange: [number, number]; // compound default rep range (flexible guideline, not hard rule)
  setRange: [number, number];
  intensityMultiplier: number;
  miniCycleDuration: 3 | 4; // mini-cycle duration in weeks
  durationWeeks: number;
  focus: string; // primary training focus
  // NOTE: Accessories ALWAYS use 10-15 reps regardless of phase.
  // repRange applies to compound lifts only and is a flexible guideline.
}

export interface TrainingSplit {
  days: WorkoutDay[];
  description: string;
}

export interface WorkoutDay {
  name: string;
  focus: string; // e.g., 'Lower', 'Upper', 'Push'
  defaultType: WorkoutType;
  defaultIntensity: IntensityLevel;
}

export interface ExerciseFilter {
  position?: Position;
  injuries?: string[];
  experience?: ExperienceLevel;
  equipment?: string[];
  muscleGroups?: string[];
}

export interface RulesConfig {
  phases: Record<ProgramPhase, PhaseConfig>;
  splits: Record<number, TrainingSplit>;
  positionPriorities: Record<Position, string[]>;
  injuryRestrictions: Record<string, string[]>; // injury type -> exercise blacklist
  equipmentSubstitutions: Record<string, string[]>;
}
