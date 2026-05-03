/**
 * API request and response types
 * Types for Supabase and external API interactions
 */

import {
  UserProfile,
  TrainingProgram,
  Microcycle,
  Workout,
  WorkoutExercise,
  Exercise,
  LoggedWorkout,
  LoggedSet,
  CoachConversation,
  CoachMessage,
  ScheduleEvent,
} from './domain';

/**
 * Generic API Response Wrapper
 */

export interface ApiResponse<T> {
  data: T;
  error: ApiError | null;
  success: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination
 */

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Auth Requests and Responses
 */

export interface SignUpRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface SignUpResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface SignOutRequest {
  session_id: string;
}

/**
 * User Profile Requests and Responses
 */

export interface GetUserProfileResponse extends ApiResponse<UserProfile> {}

export interface UpdateUserProfileRequest extends Partial<UserProfile> {
  id: string;
}

export interface UpdateUserProfileResponse extends ApiResponse<UserProfile> {}

export interface CreateUserProfileRequest {
  email: string;
  displayName: string;
  age: number;
  position: string;
  experienceLevel: string;
}

/**
 * Training Program Requests and Responses
 */

export interface GetTrainingProgramResponse extends ApiResponse<TrainingProgram> {}

export interface ListTrainingProgramsResponse extends ApiResponse<TrainingProgram[]> {}

export interface CreateTrainingProgramRequest {
  userId: string;
  name: string;
  description: string;
  programPhase: string;
  startDate: string;
  endDate: string;
  primaryFocus: string;
  daysPerWeek: number;
}

export interface CreateTrainingProgramResponse extends ApiResponse<TrainingProgram> {}

export interface UpdateTrainingProgramRequest extends Partial<TrainingProgram> {
  id: string;
}

export interface UpdateTrainingProgramResponse extends ApiResponse<TrainingProgram> {}

export interface DeleteTrainingProgramRequest {
  id: string;
}

export interface DeleteTrainingProgramResponse extends ApiResponse<null> {}

/**
 * Microcycle Requests and Responses
 */

export interface GetMicrocycleResponse extends ApiResponse<Microcycle> {}

export interface ListMicrocyclesResponse extends ApiResponse<Microcycle[]> {}

export interface CreateMicrocycleRequest {
  programId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  deloadWeek: boolean;
  intensityMultiplier: number;
}

export interface CreateMicrocycleResponse extends ApiResponse<Microcycle> {}

export interface UpdateMicrocycleRequest extends Partial<Microcycle> {
  id: string;
}

export interface UpdateMicrocycleResponse extends ApiResponse<Microcycle> {}

/**
 * Workout Requests and Responses
 */

export interface GetWorkoutResponse extends ApiResponse<Workout> {}

export interface ListWorkoutsResponse extends ApiResponse<Workout[]> {}

export interface CreateWorkoutRequest {
  microcycleId: string;
  dayOfWeek: number;
  name: string;
  description: string;
  durationMinutes: number;
  intensity: string;
  workoutType: string;
}

export interface CreateWorkoutResponse extends ApiResponse<Workout> {}

export interface UpdateWorkoutRequest extends Partial<Workout> {
  id: string;
}

export interface UpdateWorkoutResponse extends ApiResponse<Workout> {}

export interface DeleteWorkoutRequest {
  id: string;
}

export interface DeleteWorkoutResponse extends ApiResponse<null> {}

/**
 * Workout Exercise Requests and Responses
 */

export interface GetWorkoutExerciseResponse extends ApiResponse<WorkoutExercise> {}

export interface ListWorkoutExercisesResponse extends ApiResponse<WorkoutExercise[]> {}

export interface CreateWorkoutExerciseRequest {
  workoutId: string;
  exerciseId: string;
  exerciseOrder: number;
  prescribedSets: number;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  prescribedWeightKg?: number;
  prescribedRpe?: number;
  restSeconds: number;
  tempo?: string;
  notes?: string;
}

export interface CreateWorkoutExerciseResponse extends ApiResponse<WorkoutExercise> {}

export interface UpdateWorkoutExerciseRequest extends Partial<WorkoutExercise> {
  id: string;
}

export interface UpdateWorkoutExerciseResponse extends ApiResponse<WorkoutExercise> {}

export interface DeleteWorkoutExerciseRequest {
  id: string;
}

export interface DeleteWorkoutExerciseResponse extends ApiResponse<null> {}

/**
 * Exercise Requests and Responses
 */

export interface GetExerciseResponse extends ApiResponse<Exercise> {}

export interface ListExercisesRequest extends PaginationParams {
  muscleGroup?: string;
  exerciseType?: string;
  equipment?: string;
  difficulty?: string;
  searchQuery?: string;
}

export interface ListExercisesResponse extends ApiResponse<PaginatedResponse<Exercise>> {}

export interface CreateExerciseRequest {
  name: string;
  description: string;
  muscleGroups: string[];
  exerciseType: string;
  equipmentRequired: string[];
  difficultyLevel: string;
  videoUrl?: string;
  formNotes?: string;
  externalId?: string;
}

export interface CreateExerciseResponse extends ApiResponse<Exercise> {}

export interface UpdateExerciseRequest extends Partial<Exercise> {
  id: string;
}

export interface UpdateExerciseResponse extends ApiResponse<Exercise> {}

/**
 * Logged Workout Requests and Responses
 */

export interface GetLoggedWorkoutResponse extends ApiResponse<LoggedWorkout> {}

export interface ListLoggedWorkoutsRequest extends PaginationParams {
  userId: string;
  startDate?: string;
  endDate?: string;
  completed?: boolean;
}

export interface ListLoggedWorkoutsResponse extends ApiResponse<PaginatedResponse<LoggedWorkout>> {}

export interface CreateLoggedWorkoutRequest {
  userId: string;
  workoutId: string;
  loggedDate: string;
  durationMinutes?: number;
  perceivedDifficulty?: number;
  notes?: string;
}

export interface CreateLoggedWorkoutResponse extends ApiResponse<LoggedWorkout> {}

export interface UpdateLoggedWorkoutRequest extends Partial<LoggedWorkout> {
  id: string;
}

export interface UpdateLoggedWorkoutResponse extends ApiResponse<LoggedWorkout> {}

export interface CompleteLoggedWorkoutRequest {
  id: string;
  completedAt: string;
  durationMinutes: number;
  perceivedDifficulty: number;
}

export interface CompleteLoggedWorkoutResponse extends ApiResponse<LoggedWorkout> {}

/**
 * Logged Set Requests and Responses
 */

export interface GetLoggedSetResponse extends ApiResponse<LoggedSet> {}

export interface ListLoggedSetsResponse extends ApiResponse<LoggedSet[]> {}

export interface CreateLoggedSetRequest {
  loggedWorkoutId: string;
  workoutExerciseId: string;
  setNumber: number;
  actualReps?: number;
  actualWeightKg?: number;
  actualRpe?: number;
  notes?: string;
}

export interface CreateLoggedSetResponse extends ApiResponse<LoggedSet> {}

export interface UpdateLoggedSetRequest extends Partial<LoggedSet> {
  id: string;
}

export interface UpdateLoggedSetResponse extends ApiResponse<LoggedSet> {}

/**
 * Coach Conversation Requests and Responses
 */

export interface GetCoachConversationResponse extends ApiResponse<CoachConversation> {}

export interface ListCoachConversationsResponse extends ApiResponse<CoachConversation[]> {}

export interface CreateCoachConversationRequest {
  userId: string;
  topic: string;
  title: string;
  initialMessage: string;
}

export interface CreateCoachConversationResponse extends ApiResponse<CoachConversation> {}

export interface UpdateCoachConversationRequest extends Partial<CoachConversation> {
  id: string;
}

export interface UpdateCoachConversationResponse extends ApiResponse<CoachConversation> {}

/**
 * Coach Message Requests and Responses
 */

export interface GetCoachMessageResponse extends ApiResponse<CoachMessage> {}

export interface ListCoachMessagesResponse extends ApiResponse<CoachMessage[]> {}

export interface SendCoachMessageRequest {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface SendCoachMessageResponse extends ApiResponse<CoachMessage> {}

export interface StreamCoachMessageRequest {
  conversationId: string;
  userMessage: string;
}

export interface StreamCoachMessageChunk {
  token: string;
  fullMessage: string;
  isComplete: boolean;
}

/**
 * Schedule Event Requests and Responses
 */

export interface GetScheduleEventResponse extends ApiResponse<ScheduleEvent> {}

export interface ListScheduleEventsRequest {
  userId: string;
  startDate?: string;
  endDate?: string;
  eventType?: string;
}

export interface ListScheduleEventsResponse extends ApiResponse<ScheduleEvent[]> {}

export interface CreateScheduleEventRequest {
  userId: string;
  eventType: string;
  eventName: string;
  startDate: string;
  endDate: string;
  modifiesProgram: boolean;
  notes?: string;
}

export interface CreateScheduleEventResponse extends ApiResponse<ScheduleEvent> {}

export interface UpdateScheduleEventRequest extends Partial<ScheduleEvent> {
  id: string;
}

export interface UpdateScheduleEventResponse extends ApiResponse<ScheduleEvent> {}

export interface DeleteScheduleEventRequest {
  id: string;
}

export interface DeleteScheduleEventResponse extends ApiResponse<null> {}

/**
 * Bulk Operations
 */

export interface BulkCreateLoggedSetsRequest {
  loggedWorkoutId: string;
  sets: CreateLoggedSetRequest[];
}

export interface BulkCreateLoggedSetsResponse extends ApiResponse<LoggedSet[]> {}

export interface BulkUpdateLoggedSetsRequest {
  sets: UpdateLoggedSetRequest[];
}

export interface BulkUpdateLoggedSetsResponse extends ApiResponse<LoggedSet[]> {}

/**
 * Stats and Analytics
 */

export interface TrainingStatsRequest {
  userId: string;
  startDate?: string;
  endDate?: string;
}

export interface TrainingStatsResponse extends ApiResponse<{
  totalWorkoutsLogged: number;
  totalExercisesLogged: number;
  totalSetsLogged: number;
  averageWorkoutDuration: number;
  averagePerceivedDifficulty: number;
  exerciseStats: Array<{
    exerciseId: string;
    exerciseName: string;
    timesPerformed: number;
    bestWeight: number;
    averageReps: number;
    totalVolume: number;
  }>;
}> {}

export interface ProgressChartDataRequest {
  userId: string;
  exerciseId: string;
  startDate?: string;
  endDate?: string;
  metric: 'weight' | 'reps' | 'volume' | 'rpe';
}

export interface ProgressChartDataResponse extends ApiResponse<{
  points: Array<{
    date: string;
    value: number;
  }>;
  trend: number;
  maxValue: number;
  minValue: number;
}> {}

/**
 * Sync Operations
 */

export interface SyncLoggedWorkoutRequest {
  loggedWorkoutId: string;
  lastSyncTime?: string;
}

export interface SyncLoggedWorkoutResponse extends ApiResponse<LoggedWorkout> {}

export interface BulkSyncLoggedWorkoutsRequest {
  loggedWorkoutIds: string[];
  lastSyncTime?: string;
}

export interface BulkSyncLoggedWorkoutsResponse extends ApiResponse<LoggedWorkout[]> {}

/**
 * Error Response Types
 */

export enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
}
