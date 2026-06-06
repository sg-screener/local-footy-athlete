/**
 * Domain types for Local Footy Athlete
 * Core business logic and data models
 */
export type Position = 'Small back' | 'Key back' | 'Midfielder' | 'Ruck' | 'Small forward' | 'Key forward';
export type ExperienceLevel = 'Complete beginner' | '1-2 years' | '2-5 years' | '5+ years';
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'cancelled' | 'expired';
export type TrainingLocation = 'Commercial gym' | 'Home gym' | 'Club gym' | 'Outdoor';
export type AgeRange = 'Under 18' | '18-22' | '22-26' | '26-30' | '30+';
export type SeasonPhase = 'Off-season' | 'Pre-season' | 'In-season';
export type GameDay = 'Friday' | 'Saturday' | 'Sunday' | 'Varies';
export type TeamTrainingDuration = '60 minutes' | '90 minutes' | '2 hours';
export type TeamTrainingIntensity = 'Light' | 'Moderate' | 'Hard' | 'Very intense';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type SessionDuration = 30 | 45 | 60 | 75 | 90;
export type SquatStrength = "I don't squat" | 'Less than bodyweight' | 'Around bodyweight' | '1.5x bodyweight' | '2x bodyweight+' | 'Not sure';
export type BenchStrength = "I don't bench" | 'Less than bodyweight' | 'Around bodyweight' | '1.25x bodyweight' | '1.5x bodyweight+' | 'Not sure';
export type ConditioningLevel = 'Poor' | 'Average' | 'Good' | 'Elite';
export type SprintExposure = 'No sprint training' | 'Occasionally' | '2+ times per week';
export type RecentTrainingLoad = 'Hardly at all' | 'A bit' | 'Pretty consistent' | 'Very consistent';
export type BiggestLimitation = 'Strength' | 'Speed' | 'Endurance' | 'Size' | 'Injury history' | 'Mobility' | 'Power & explosiveness';
export type InjurySeverity = 'Mild' | 'Moderate' | 'Severe';
export type InjuryTiming = 'Running' | 'Lifting' | 'Both' | 'Constant';
export type InjuryCategory = 'lower-body' | 'upper-body' | 'lower-back' | 'other';
export interface OnboardingInjury {
    bodyArea: string;
    description: string;
    severity?: InjurySeverity;
    whenItHurts?: InjuryTiming;
    movementTriggers?: string[];
    notes?: string;
}
export interface ProgramAvailabilityConstraint {
    id: string;
    kind: 'unavailable_day' | 'time_limit' | 'travel';
    scope: 'permanent' | 'temporary';
    dayOfWeek?: DayOfWeek;
    startDate?: string;
    endDate?: string;
    maxSessionMinutes?: number;
    reason?: string;
    active?: boolean;
    createdAt?: string;
    updatedAt?: string;
}
export interface OnboardingData {
    firstName?: string;
    ageRange?: AgeRange;
    position?: Position;
    motivation?: string;
    heightCm?: number;
    weightKg?: number;
    seasonPhase?: SeasonPhase;
    gameDay?: GameDay;
    teamTrainingDaysPerWeek?: number;
    teamTrainingDays?: DayOfWeek[];
    teamTrainingDuration?: TeamTrainingDuration;
    teamTrainingIntensity?: TeamTrainingIntensity;
    trainingDaysPerWeek?: number;
    preferredTrainingDays?: DayOfWeek[];
    availabilityConstraints?: ProgramAvailabilityConstraint[];
    sessionDurationMinutes?: SessionDuration;
    trainingLocation?: TrainingLocation;
    equipment?: string[];
    experienceLevel?: ExperienceLevel;
    squatStrength?: SquatStrength;
    benchStrength?: BenchStrength;
    conditioningLevel?: ConditioningLevel;
    sprintExposure?: SprintExposure;
    recentTrainingLoad?: RecentTrainingLoad;
    injuries?: OnboardingInjury[];
    goals?: string[];
    biggestLimitation?: BiggestLimitation;
    biggestFrustration?: string;
    successVision?: string;
}
export type ProgramPhase = 'Post-Season' | 'Early-Off-Season' | 'Base-Building' | 'Pre-Season-Skills' | 'Christmas-Block' | 'Return-to-Skills' | 'In-Season';
/** Readiness classification based on consistency, fitness, injuries, sprint exposure, season */
export type ReadinessLevel = 'low' | 'medium' | 'high';
/** Session tier — determines priority and skip-ability */
export type SessionTier = 'core' | 'optional' | 'recovery';
export type WorkoutType = 'Strength' | 'Conditioning' | 'Technical' | 'Recovery' | 'Mixed' | 'Flush-Out' | 'Sprint-Intervals' | 'Team Training' | 'Game' | 'Nordic-4x4' | 'Long-Run' | 'MetCon' | 'Flog-Friday' | '6x1km' | 'Hill-Sprints' | 'MAS-Training' | 'Tempo-Run' | 'Quality-Sprints';
export type ExerciseType = 'Compound' | 'Isolation' | 'Plyometric' | 'Cardio' | 'Flexibility';
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
export type ScheduleEventType = 'Game' | 'Team Training' | 'Bye Week' | 'Injury';
export type CoachMessageRole = 'user' | 'assistant';
export type IntensityLevel = 'Light' | 'Moderate' | 'High' | 'Maximal';
/**
 * Override Context — structured metadata for manual overrides.
 *
 * When a manual override is created because of game proximity (e.g. coach
 * sets a "Pre-game Arms / Pump" session), this records the intent so the
 * system can detect when the game context changes and the override may be
 * stale.  This avoids brittle string-matching on workout names.
 *
 * Stored alongside the Workout in dateOverrides.
 */
export interface OverrideContext {
    /**
     * Why this override was created.
     *   - 'gameProximity': override was set because of a nearby game (G-1, G+1, etc.)
     *   - 'dismissed':     user reviewed a stale warning and chose to keep the override
     *   - 'injury':        override emitted by the Universal Adjustment Engine
     *   - 'program_adjustment': deterministic user-requested program edit
     *
     * Intentionally narrow — only values actively consumed by staleOverrideDetector.
     * Do NOT expand into a general-purpose metadata layer for all overrides.
     */
    intent: 'gameProximity' | 'dismissed' | 'injury' | 'program_adjustment';
    /** ISO date of the game this override was relative to (for gameProximity only). */
    relatedGameDate?: string;
    /** Human-readable label shown in stale-override warnings (for gameProximity only). */
    label?: string;
}
export type SessionFeeling = 'Cooked' | 'Strong' | 'Good' | 'Average' | 'Sore';
/**
 * User Profile
 * Represents a registered user and their preferences
 */
export interface UserProfile {
    id: string;
    email: string;
    displayName: string;
    age: number;
    position: Position;
    experienceLevel: ExperienceLevel;
    profileImageUrl?: string;
    hasBarbell: boolean;
    hasDumbbells: boolean;
    hasFullGym: boolean;
    trainingLocation: TrainingLocation;
    daysPerWeek: number;
    injuryHistory: string[];
    primaryGoals: string[];
    subscriptionStatus: SubscriptionStatus;
    onboardingCompleted: boolean;
    createdAt: string;
    updatedAt: string;
}
/**
 * Training Program
 * Represents a complete training plan for a user
 */
export interface TrainingProgram {
    id: string;
    userId: string;
    name: string;
    description: string;
    programPhase: ProgramPhase;
    startDate: string;
    endDate: string;
    microcycles: Microcycle[];
    primaryFocus: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
/**
 * Microcycle
 * Represents a week within a training program (part of a 3-4 week mini-cycle)
 */
export interface Microcycle {
    id: string;
    programId: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
    miniCycleNumber: number;
    intensityMultiplier: number;
    workouts: Workout[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Workout
 * Represents a single training session
 */
export interface Workout {
    id: string;
    microcycleId: string;
    dayOfWeek: number;
    name: string;
    description: string;
    durationMinutes: number;
    intensity: IntensityLevel;
    workoutType: WorkoutType;
    sessionTier?: SessionTier;
    exercises: WorkoutExercise[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Workout Exercise
 * Represents a single exercise within a workout
 */
export interface WorkoutExercise {
    id: string;
    workoutId: string;
    exerciseId: string;
    exerciseOrder: number;
    prescribedSets: number;
    prescribedRepsMin: number;
    prescribedRepsMax: number;
    prescribedWeightKg?: number;
    /**
     * How to interpret the reps numbers:
     *   - 'reps': standard rep count (default if omitted)
     *   - 'duration': repsMin/repsMax are seconds (e.g. 30–45s hold)
     *   - 'duration_minutes': repsMin/repsMax are minutes (e.g. 15–20 min walk)
     *   - 'distance': repsMin/repsMax are metres
     */
    prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
    /** True if prescription is per side (e.g. "30s per side", "8 reps per side"). */
    perSide?: boolean;
    restSeconds: number;
    tempo?: string;
    notes?: string;
    exercise?: Exercise;
    /** Shared group ID (e.g. "A", "B"). Exercises with the same value are performed as a superset. */
    supersetGroup?: string;
    /** Order within the superset group (1, 2, ...). */
    supersetOrder?: number;
    /** Semantic type of the pairing — informs renderer badges and validation rules. */
    pairType?: 'contrast' | 'superset' | 'circuit';
    createdAt: string;
    updatedAt: string;
}
/**
 * Exercise
 * Represents an exercise in the exercise library
 */
export interface Exercise {
    id: string;
    name: string;
    description: string;
    externalId?: string;
    muscleGroups: string[];
    exerciseType: ExerciseType;
    equipmentRequired: string[];
    difficultyLevel: DifficultyLevel;
    videoUrl?: string;
    gifUrl?: string;
    formNotes?: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * Logged Workout
 * Represents a completed workout session
 */
export interface LoggedWorkout {
    id: string;
    userId: string;
    workoutId: string;
    loggedDate: string;
    completedAt?: string;
    durationMinutes?: number;
    sessionFeeling?: SessionFeeling;
    notes?: string;
    completed: boolean;
    synced: boolean;
    sets: LoggedSet[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Logged Set
 * Represents a single set within a logged workout
 */
export interface LoggedSet {
    id: string;
    loggedWorkoutId: string;
    workoutExerciseId: string;
    setNumber: number;
    actualReps?: number;
    actualWeightKg?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * Coach Conversation
 * Represents a conversation thread with the AI coach
 */
export interface CoachConversation {
    id: string;
    userId: string;
    topic: string;
    title: string;
    messages: CoachMessage[];
    createdAt: string;
    updatedAt: string;
}
/**
 * Coach Message
 * Represents a single message in a coach conversation
 */
export interface CoachMessage {
    id: string;
    conversationId: string;
    role: CoachMessageRole;
    content: string;
    tokensUsed?: number;
    createdAt: string;
}
/**
 * Schedule Event
 * Represents a special event that affects training schedule
 */
export interface ScheduleEvent {
    id: string;
    userId: string;
    eventType: ScheduleEventType;
    eventName: string;
    startDate: string;
    endDate: string;
    modifiesProgram: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * Aggregate types for convenience
 */
export interface WeeklySummary {
    microcycleId: string;
    weekNumber: number;
    workoutCount: number;
    totalDurationMinutes: number;
    averageIntensity: IntensityLevel;
    miniCycleNumber: number;
}
export interface TrainingStats {
    totalWorkoutsLogged: number;
    totalExercisesLogged: number;
    totalSetsLogged: number;
    averageWorkoutDuration: number;
    averagePerceivedDifficulty: number;
    currentProgram?: TrainingProgram;
}
export interface PersonalRecord {
    exerciseId: string;
    exerciseName: string;
    weightKg: number;
    reps: number;
    achievedDate: string;
    maxEver: boolean;
}
