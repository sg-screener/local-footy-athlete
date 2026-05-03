/**
 * React Navigation parameter types
 * Type-safe navigation throughout the app
 */

import { TrainingProgram, UserProfile, Workout, CoachConversation } from './domain';

/**
 * Root Navigator Stack
 * Top-level navigation structure
 */
export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  App: undefined;
  Splash: undefined;
};

/**
 * Auth Stack
 * Authentication flow
 */
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: {
    email: string;
  };
  VerifyEmail: {
    email: string;
  };
};

/**
 * Onboarding Stack
 * User setup and preferences during first launch
 */
export type OnboardingStackParamList = {
  Welcome: undefined;
  Name: undefined;
  Position: undefined;
  Motivation: undefined;
  BodyMeasurements: undefined;
  SeasonPhase: undefined;
  GameDay: undefined;
  TeamTrainingDays: undefined;
  TeamTrainingDuration: undefined;
  TeamTrainingIntensity: undefined;
  TrainingCommitment: undefined;
  PreferredTrainingDays: undefined;
  SessionDuration: undefined;
  GymExperience: undefined;
  SquatStrength: undefined;
  BenchStrength: undefined;
  ConditioningLevel: undefined;
  SprintExposure: undefined;
  RecentTrainingLoad: undefined;
  Injuries: undefined;
  Review: undefined;
  Complete: undefined;
};

/**
 * App Tab Navigator
 * Main app bottom tabs
 */
export type AppTabParamList = {
  HomeStack: undefined;
  ProgramStack: undefined;
  JournalStack: undefined;
  CoachStack: undefined;
  ProfileStack: undefined;
};

/**
 * Home Stack
 * Home tab navigation
 */
export type HomeStackParamList = {
  HomeScreen: undefined;
  TrainingOverview: {
    programId: string;
  };
  CurrentWeek: {
    microcycleId: string;
  };
  DayWorkout: {
    workoutId: string;
    date?: string;
    startFinished?: boolean;
  };
  QuickStart: {
    workoutId: string;
  };
  Stats: undefined;
  MakeAChange: undefined;
  WorkoutLogger: {
    workoutId: string;
  };
};

/**
 * Program Stack
 * Program management and planning
 */
export type ProgramStackParamList = {
  ProgramList: undefined;
  ProgramDetail: {
    programId: string;
  };
  ProgramCreate: undefined;
  ProgramEdit: {
    programId: string;
  };
  MicrocycleDetail: {
    microcycleId: string;
    programId: string;
  };
  WorkoutDetail: {
    workoutId: string;
  };
  ExerciseDetail: {
    exerciseId: string;
  };
  ExerciseLibrary: undefined;
  CustomizeWorkout: {
    workoutId: string;
  };
};

/**
 * Journal Stack
 * Workout logging and history
 */
export type JournalStackParamList = {
  JournalHome: undefined;
  LogWorkout: {
    workoutId: string;
  };
  WorkoutHistory: undefined;
  WorkoutHistoryDetail: {
    loggedWorkoutId: string;
  };
  PersonalRecords: undefined;
  ProgressCharts: undefined;
  ExerciseHistory: {
    exerciseId: string;
  };
  WeeklyReview: {
    microcycleId: string;
  };
};

/**
 * Coach Stack
 * AI coach interactions
 */
export type CoachStackParamList = {
  Coach: undefined;
  CoachChat: {
    conversationId?: string;
    topic?: string;
  };
  CoachHome: undefined;
  CoachConversations: undefined;
  CoachConversationDetail: {
    conversationId: string;
  };
  CoachTopics: undefined;
  CoachTopic: {
    topic: string;
  };
};

/**
 * Profile Stack
 * User profile and settings
 */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Preferences: undefined;
  TrainingPreferences: undefined;
  EquipmentSettings: undefined;
  GoalSettings: undefined;
  HealthSettings: undefined;
  InjuryManagement: undefined;
  NotificationSettings: undefined;
  Privacy: undefined;
  Terms: undefined;
  About: undefined;
  Help: undefined;
  Support: undefined;
  Feedback: undefined;
  Account: undefined;
  Subscription: undefined;
  DeleteAccount: undefined;
};

/**
 * Modal Stack
 * Modal presentations from any screen
 */
export type ModalStackParamList = {
  ExerciseSearch: {
    onSelect: (exerciseId: string) => void;
  };
  ExerciseFilter: {
    onApply: (filters: ExerciseFilters) => void;
  };
  TimePicker: {
    onSelect: (time: string) => void;
    initialTime?: string;
  };
  DatePicker: {
    onSelect: (date: string) => void;
    initialDate?: string;
  };
  RangePicker: {
    onSelect: (min: number, max: number) => void;
    initialMin?: number;
    initialMax?: number;
  };
  ConfirmAction: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isDangerous?: boolean;
  };
  ImagePicker: {
    onSelect: (imageUri: string) => void;
  };
};

/**
 * Navigation State Types
 */

export interface NavigationState {
  isLoading: boolean;
  isSignout: boolean;
  userToken: string | null;
}

/**
 * Route Params for Common Operations
 */

export interface ExerciseFilters {
  muscleGroups?: string[];
  exerciseTypes?: string[];
  equipmentRequired?: string[];
  difficultyLevel?: string;
  searchQuery?: string;
}

export interface LogWorkoutParams {
  workoutId: string;
  onComplete?: (loggedWorkoutId: string) => void;
  onCancel?: () => void;
}

export interface CreateProgramParams {
  phase: string;
  startDate: string;
  daysPerWeek: number;
  onComplete?: (programId: string) => void;
}

/**
 * Deep Linking Routes
 * URL schemes for deep linking
 */

export enum DeepLinkPath {
  // Home
  HOME = '/home',
  TRAINING_OVERVIEW = '/training/:programId',
  CURRENT_WEEK = '/week/:microcycleId',
  DAY_WORKOUT = '/workout/:workoutId',

  // Program
  PROGRAMS = '/programs',
  PROGRAM_DETAIL = '/programs/:programId',
  CREATE_PROGRAM = '/programs/create',

  // Journal
  JOURNAL = '/journal',
  LOG_WORKOUT = '/journal/log/:workoutId',
  WORKOUT_HISTORY = '/journal/history',
  PERSONAL_RECORDS = '/journal/records',

  // Coach
  COACH = '/coach',
  COACH_CHAT = '/coach/chat/:conversationId',

  // Profile
  PROFILE = '/profile',
  EDIT_PROFILE = '/profile/edit',
  SETTINGS = '/settings',
}

/**
 * Linking Configuration
 */

/**
 * Workout Stack
 * Workout logging and execution
 */
export type WorkoutStackParamList = {
  WorkoutLogger: {
    workoutId: string;
  };
};

/**
 * App Stack - Union of all main app stack param lists
 * Used for type-safe navigation within the app
 */
export type AppStackParamList =
  | HomeStackParamList
  | ProgramStackParamList
  | JournalStackParamList
  | CoachStackParamList
  | ProfileStackParamList
  | WorkoutStackParamList;

export interface LinkingConfig {
  prefixes: string[];
  config: {
    screens: {
      [key in RootStackParamList as string]: string | object;
    };
  };
}
