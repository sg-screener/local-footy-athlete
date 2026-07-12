/**
 * Domain types for Local Footy Athlete
 * Core business logic and data models
 */

import type {
  StrengthIntent,
  StrengthIntentDiagnostic,
} from '../rules/strengthPatternContributions';

// Footy role buckets for athletes. The legacy exact positions remain in the
// type so old persisted profiles can be read and normalized at the app edge.
export type RoleBucket = 'inside_mid' | 'outside_runner' | 'key_position_ruck_tall' | 'high_forward_back' | 'small_forward_back';
export type LegacyPosition = 'Small back' | 'Key back' | 'Midfielder' | 'Ruck' | 'Small forward' | 'Key forward';
export type Position = RoleBucket | LegacyPosition;

// Experience level types
export type ExperienceLevel = 'Complete beginner' | '1-2 years' | '2-5 years' | '5+ years';

// Subscription status types
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'cancelled' | 'expired';

// Training location types
export type TrainingLocation = 'Commercial gym' | 'Home gym' | 'Club gym' | 'Outdoor';

// Onboarding types for new user setup
export type AgeRange = 'Under 18' | '18-22' | '22-26' | '26-30' | '30+';

export type SeasonPhase = 'Off-season' | 'Pre-season' | 'In-season';

export type WeekKind = 'build' | 'deload';

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
  /** In-season usual competition day, used as a default per-week game anchor when
   *  no explicit game has been set on the calendar for that week. */
  usualGameDay?: DayOfWeek;
  teamTrainingDaysPerWeek?: number;
  teamTrainingDays?: DayOfWeek[];
  teamTrainingDuration?: TeamTrainingDuration;
  teamTrainingIntensity?: TeamTrainingIntensity;
  trainingDaysPerWeek?: number;
  trainingDaysUnsure?: boolean;
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

// Program phase types (Sam's 7 phases — retained for exercise selection/rep ranges)
export type ProgramPhase = 'Post-Season' | 'Early-Off-Season' | 'Base-Building' | 'Pre-Season-Skills' | 'Christmas-Block' | 'Return-to-Skills' | 'In-Season';

// ─── Coaching Engine Types ───

/** Readiness classification based on consistency, fitness, injuries, sprint exposure, season */
export type ReadinessLevel = 'low' | 'medium' | 'high';

/** Session tier — determines priority and skip-ability */
export type SessionTier = 'core' | 'optional' | 'recovery';

// Workout type enums (including conditioning variants)
export type WorkoutType =
  | 'Strength'
  | 'Conditioning'
  | 'Technical'
  | 'Recovery'
  | 'Mixed'
  | 'Flush-Out'
  | 'Sprint-Intervals'
  | 'Team Training'
  | 'Game'
  | 'Nordic-4x4'
  | 'Long-Run'
  | 'MetCon'
  | 'Flog-Friday'
  | '6x1km'
  | 'Hill-Sprints'
  | 'MAS-Training'
  | 'Tempo-Run'
  | 'Quality-Sprints';

// Exercise type enums
export type ExerciseType = 'Compound' | 'Isolation' | 'Plyometric' | 'Cardio' | 'Flexibility';

// Difficulty level
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

// Schedule event types
export type ScheduleEventType = 'Game' | 'Team Training' | 'Bye Week' | 'Injury';

// Coach message role
export type CoachMessageRole = 'user' | 'assistant';

// Intensity level
export type IntensityLevel = 'Light' | 'Moderate' | 'High' | 'Maximal';

/**
 * Typed proof that an already-owned deterministic rule materially shaped a
 * visible workout. Coach Notes consume this evidence; the evidence never
 * changes programming itself.
 */
export type DeterministicCoachNoteEffectKind =
  | 'progression_adaptation'
  | 'beginner_policy'
  | 'testing_bias'
  | 'subphase_policy'
  | 'bye_week';

export type DeterministicCoachNoteEffectReason =
  | 'adaptation_reduced'
  | 'adaptation_held'
  | 'adaptation_increased'
  | 'beginner_conservative_prescription'
  | 'testing_lower_strength'
  | 'testing_upper_strength'
  | 'testing_aerobic'
  | 'testing_speed'
  | 'testing_robustness'
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason'
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason'
  | 'bye_build'
  | 'bye_recovery';

export interface DeterministicCoachNoteEffectSeed {
  kind: DeterministicCoachNoteEffectKind;
  reason: DeterministicCoachNoteEffectReason;
  /** Stable decision owner, used for evidence replacement before week dedupe. */
  ownerKey: string;
}

export interface DeterministicPrescriptionProofRow {
  exerciseId: string;
  exerciseName: string;
  prescribedSets: number;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  prescribedWeightKg?: number;
  restSeconds: number;
  notes?: string;
}

export type DeterministicCoachNoteEffectProof =
  | {
      type: 'prescription';
      rows: DeterministicPrescriptionProofRow[];
    }
  | {
      type: 'session_shape';
      name: string;
      workoutType: WorkoutType;
      sessionTier?: SessionTier;
      conditioningCategory?: Workout['conditioningCategory'];
      exerciseNames: string[];
      hasSpeedBlock: boolean;
      hasPowerBlock: boolean;
    }
  | {
      type: 'recovery_addon';
      focusAreas: string[];
    };

export interface DeterministicCoachNoteEffectEvidence
  extends DeterministicCoachNoteEffectSeed {
  proof: DeterministicCoachNoteEffectProof;
}

/**
 * Attached conditioning kind for strength + conditioning days.
 *
 * `hasCombinedConditioning` remains the backward-compatible presence flag.
 * This field distinguishes the Bible's attached-conditioning dose:
 *   - finisher: small add-on after strength, usually 8-15min, skippable
 *   - component: proper planned conditioning block, usually 20-30min
 *   - speed_component / recovery_addon: reserved typed placeholders
 */
export type AttachedConditioningKind =
  | 'finisher'
  | 'component'
  | 'speed_component'
  | 'recovery_addon';

export type SpeedWorkKind =
  | 'true_speed'
  | 'repeated_sprint'
  | 'cod';

export type SpeedBlockPlacement =
  | 'standalone'
  | 'pre_lift';

export interface SpeedBlockCountingFence {
  hardExposure: true;
  mainStrength: false;
  conditioningCredit: 'none';
  createsHardDay: true;
  sprintCodExposure: true;
}

export interface SpeedBlock {
  id: string;
  title: string;
  label: string;
  kind: SpeedWorkKind;
  placement: SpeedBlockPlacement;
  durationMinutes: number;
  prescription: string;
  notes?: string[];
  exerciseIds?: string[];
  counting: SpeedBlockCountingFence;
}

/**
 * Low-dose power / explosive primer block (Bible § Power work).
 *
 * This is NOT conditioning and NOT a finisher. It is a small, fast, high-quality
 * block placed EARLY in a strength session (or paired as contrast with the main
 * lift). It carries its own counting fence so it is never counted as a
 * conditioning component or a hard exposure. Rendered as a distinct block — it
 * is intentionally kept OUT of `workout.exercises` so exercise-name classifiers
 * never confuse a jump/throw with a strength or conditioning row.
 */
export type PowerFamily = 'lower' | 'upper';
export type PowerKind = 'primer' | 'contrast';

export interface PowerBlockOption {
  /** Display name, e.g. "Vertical Jump" or "Explosive Push-up". */
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Equipment the option needs; empty = bodyweight. */
  equipmentRequired: string[];
}

export interface PowerBlockCountingFence {
  hardExposure: false;
  mainStrength: false;
  conditioningCredit: 'none';
  isFinisher: false;
}

export interface PowerBlock {
  id: string;
  kind: PowerKind;
  family: PowerFamily;
  /** Display title, e.g. "Power Primer" or "Contrast Power". */
  title: string;
  /** One-line prescription summary, e.g. "3 x 3 — full rest, fast & sharp". */
  prescription: string;
  /** Always fresh / early in the session. */
  placement: 'pre_lift';
  options: PowerBlockOption[];
  notes: string[];
  counting: PowerBlockCountingFence;
}

export type RecoveryAddonKind =
  | 'mobility'
  | 'trunk'
  | 'carries'
  | 'prehab'
  | 'breathing';

export interface RecoveryAddonExercise {
  id: string;
  name: string;
  prescription: string;
  notes?: string;
  source?: 'exercise_pool' | 'mobility_flow_template' | 'local';
}

export interface RecoveryAddonCountingFence {
  hardExposure: false;
  mainStrength: false;
  conditioningCredit: 'none';
  createsHardDay: false;
  sprintCodExposure: false;
}

export interface RecoveryAddonBlock {
  id: string;
  title: string;
  label: string;
  kind: RecoveryAddonKind;
  focusArea: string;
  optional: true;
  skipPolicy: 'no_penalty';
  durationMinutes: number;
  exercises: RecoveryAddonExercise[];
  placementNote?: string;
  restrictions?: string[];
  cautions?: string[];
  templateId?: string;
  counting: RecoveryAddonCountingFence;
}

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
   *                      injury handler (severity-known path)
   *   - 'program_adjustment': deterministic user-requested program edit
   *                      verified against the visible program before reply
   *
   * Intentionally narrow — only values actively consumed by staleOverrideDetector
   * and the UAE event applier. Do NOT expand into a general-purpose metadata
   * layer for all overrides.
   */
  intent: 'gameProximity' | 'dismissed' | 'injury' | 'program_adjustment';
  /** ISO date of the game this override was relative to (for gameProximity only). */
  relatedGameDate?: string;
  /** Human-readable label shown in stale-override warnings (for gameProximity only). */
  label?: string;
  /** Active modifier that owns this override, so clearing the note can remove the real program effect. */
  activeModifierId?: string;
}

// Session feeling (Sam's simple feedback model)
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

  // Equipment availability
  hasBarbell: boolean;
  hasDumbbells: boolean;
  hasFullGym: boolean;

  // Training preferences
  trainingLocation: TrainingLocation;
  daysPerWeek: number;

  // Health and history
  injuryHistory: string[];
  primaryGoals: string[];

  // Account status
  subscriptionStatus: SubscriptionStatus;
  onboardingCompleted: boolean;

  // Timestamps
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

  // Duration
  startDate: string; // ISO date
  endDate: string;   // ISO date

  // Structure
  microcycles: Microcycle[];

  // Characteristics
  primaryFocus: string;
  isActive: boolean;

  // Timestamps
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

  // Duration
  startDate: string; // ISO date
  endDate: string;   // ISO date

  // Characteristics
  miniCycleNumber: number; // Which 3-4 week block this week belongs to
  intensityMultiplier: number; // 0.7-1.3 typical range
  weekKind?: WeekKind;

  // Workouts in this week
  workouts: Workout[];

  // Timestamps
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
  dayOfWeek: number; // 0-6 (Sunday-Saturday)

  // Metadata
  name: string;
  description: string;
  durationMinutes: number;

  // Characteristics
  intensity: IntensityLevel;
  workoutType: WorkoutType;
  sessionTier?: SessionTier;

  /** Stable deterministic allocation identity used during generated-week normalisation. */
  planEntryId?: string;
  /** Canonical planned/effective strength contract. Existing typed intent always wins. */
  strengthIntent?: StrengthIntent;
  /** Development/audit proof for planned patterns absent after final filtering. */
  strengthIntentDiagnostics?: StrengthIntentDiagnostic[];
  /** @deprecated Compatibility projection of strengthIntent.plannedPatterns. */
  strengthPatternContributions?: Array<'squat' | 'hinge' | 'push' | 'pull'>;

  // Combined S+C metadata — set when session pairs strength + conditioning
  /** True when this day has a conditioning block appended after the strength block. */
  hasCombinedConditioning?: boolean;
  /** Dose/type of the attached conditioning block when `hasCombinedConditioning` is true. */
  attachedConditioningKind?: AttachedConditioningKind;
  /** Conditioning flavour for combined or standalone conditioning sessions. */
  conditioningFlavour?: 'aerobic' | 'tempo' | 'high-intensity';
  /**
   * Conditioning category — the energy-system classification used by the
   * weekly distribution tracker. Off-season and pre-season weeks must
   * cover each category at most once before duplicating.
   *
   * 'tempo' (added Phase 4B, 2026-07-09) is TRUE medium conditioning:
   * controlled repeat efforts at 6-7/10 — worked but composed. It is NOT
   * the old mislabelled VO2 work; vo2/glycolytic remain hard.
   */
  conditioningCategory?: 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic';

  /**
   * Resolved conditioning block — single source of truth for the renderer.
   *
   * Populated at build time for combined S+C days so that the UI never has to
   * re-derive title / description / row ownership by scanning exercise names.
   * Each sub-block owns its own title, description, and exerciseIds so titles
   * never drift from their rendered rows, and the main conditioning session is
   * cleanly separated from a supplementary flush (which is a distinct block,
   * not a peer within the same finisher).
   */
  conditioningBlock?: ConditioningBlock;

  /**
   * Low-volume true speed/COD work. This is not a conditioning block and
   * must not be rendered or counted as a finisher/component.
   */
  speedBlock?: SpeedBlock;

  /**
   * Low-dose power/explosive primer (Bible § Power work). Fresh, high-quality,
   * placed early. Not conditioning, not a finisher, not counted as a hard
   * exposure. Kept out of `exercises` so classifiers never confuse it with
   * strength or conditioning rows.
   */
  powerBlock?: PowerBlock;

  /**
   * Short display label for coach-added conditioning shown on weekly cards.
   * Example: "Pilates" or "Assault Bike Sprints". This keeps the Program tab
   * aligned with the visible row instead of falling back to the internal
   * energy-system label.
   */
  coachAddedConditioningLabel?: string;

  /**
   * Coach-authored notes attached to this session — surfaced as a visible
   * tag list on the Program tab, the day-detail screen, and the team-day
   * card. Distinct from `description` (which is sometimes empty,
   * sometimes a wall of free-form prose) so the UI has a clean,
   * structured place to render injury-driven changes like
   * "no sprinting / no high-speed running" without having to parse
   * description suffixes like "[Off-feet — injury swap]".
   *
   * Populated by `applyAdjustmentEvents` on top of the resolved workout
   * whenever an injury event modifies the day. Consumers should treat
   * this as the authoritative "what coach changed" list.
   */
  coachNotes?: string[];

  /**
   * Deterministic, truth-gated provenance for system Coach Notes. These rows
   * describe effects already present in this workout; they are not modifiers
   * and cannot alter generation, scoring, or placement.
   */
  deterministicCoachNoteEvidence?: DeterministicCoachNoteEffectEvidence[];

  /**
   * Optional low-fatigue support work attached after the main session.
   * This is display/programming content only: it is not main strength,
   * hard conditioning, or sprint/COD. It may be logged as an optional,
   * no-penalty feedback component without changing those counting fences.
   */
  recoveryAddons?: RecoveryAddonBlock[];

  // Exercises
  exercises: WorkoutExercise[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface WeekScopedWorkoutOverlay {
  id: string;
  weekStart: string;
  weekEnd: string;
  anchorDate: string | null;
  reason: 'one_off_game' | 'one_off_no_game' | 'repeat_week';
  workoutsByDate: Record<string, Workout | null>;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single conditioning prescription option.
 *
 * All options inside one ConditioningBlock share the SAME intent and are
 * training-equivalent (same purpose, equivalent fatigue cost). The renderer
 * shows one option as a direct prescription; multiple options render as a
 * "Choose one" block. Options never mix across intents — an aerobic flush
 * is NOT a valid option alongside an aerobic base run, because their
 * fatigue profiles differ.
 */
export interface ConditioningOption {
  /** Display title — e.g. "35min zone 2 run" or "1km Repeat Intervals". */
  title: string;
  /** Single-paragraph description / prescription summary for this option. */
  description: string;
  /**
   * IDs of WorkoutExercise entries (in workout.exercises) that belong to
   * this option. Rows are NEVER computed by scanning for keywords — the
   * renderer maps each id back to its exercise.
   */
  exerciseIds: string[];
}

/**
 * Resolved conditioning block — the single source of truth for the
 * conditioning section of a session.
 *
 * Design rules enforced by this shape:
 *   • Exactly one intent per session. No mixing aerobic + flush, tempo +
 *     aerobic, etc.
 *   • No "primary + optional secondary" split. If more than one option
 *     exists, they are equivalent choices — the renderer shows them under
 *     a "Choose one" header.
 *   • options.length >= 1. A session always has at least one prescription.
 */
export interface ConditioningBlock {
  /** Intent of the session — all options share this intent. */
  intent: 'aerobic' | 'tempo' | 'high-intensity';
  /** Dose/type when this block is attached to a strength session. */
  attachedKind?: AttachedConditioningKind;
  /**
   * Equivalent conditioning choices for this session. When length === 1
   * the renderer shows a single prescription; when length > 1 it shows
   * a "Choose one" selector. Never empty.
   */
  options: ConditioningOption[];
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

  // Prescription
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

  // Rest and tempo
  restSeconds: number;
  tempo?: string; // e.g., "3-1-2" for eccentric-pause-concentric

  // Additional info
  notes?: string;
  exercise?: Exercise;

  // Superset grouping (explicit only — set by templates or coach data)
  /** Shared group ID (e.g. "A", "B"). Exercises with the same value are performed as a superset. */
  supersetGroup?: string;
  /** Order within the superset group (1, 2, ...). */
  supersetOrder?: number;
  /** Semantic type of the pairing — informs renderer badges and validation rules. */
  pairType?: 'contrast' | 'superset' | 'circuit';

  // Timestamps
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
  externalId?: string; // Reference to external exercise database

  // Classification
  muscleGroups: string[]; // e.g., ['Quadriceps', 'Glutes']
  exerciseType: ExerciseType;
  equipmentRequired: string[]; // e.g., ['Barbell', 'Dumbbells']
  difficultyLevel: DifficultyLevel;

  // Resources
  videoUrl?: string;
  gifUrl?: string; // ExerciseDB animated GIF URL
  formNotes?: string;

  // Timestamps
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

  // Timing
  loggedDate: string; // ISO date
  completedAt?: string; // ISO datetime

  // Performance
  durationMinutes?: number;
  sessionFeeling?: SessionFeeling; // How athlete felt after session
  notes?: string;

  // Status
  completed: boolean;
  synced: boolean;

  // Sets within this workout
  sets: LoggedSet[];

  // Timestamps
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

  // Performance
  actualReps?: number;
  actualWeightKg?: number;

  // Feedback
  notes?: string;

  // Timestamps
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

  // Metadata
  topic: string;
  title: string;

  // Messages in this conversation
  messages: CoachMessage[];

  // Timestamps
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

  // Content
  role: CoachMessageRole;
  content: string;

  // API usage
  tokensUsed?: number;

  // Timestamps
  createdAt: string;
}

/**
 * Schedule Event
 * Represents a special event that affects training schedule
 */
export interface ScheduleEvent {
  id: string;
  userId: string;

  // Event details
  eventType: ScheduleEventType;
  eventName: string;

  // Duration
  startDate: string; // ISO date
  endDate: string;   // ISO date

  // Impact
  modifiesProgram: boolean;

  // Additional info
  notes?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Aggregate types for convenience
 */

// Weekly Summary
export interface WeeklySummary {
  microcycleId: string;
  weekNumber: number;
  workoutCount: number;
  totalDurationMinutes: number;
  averageIntensity: IntensityLevel;
  miniCycleNumber: number;
}

// Training Stats
export interface TrainingStats {
  totalWorkoutsLogged: number;
  totalExercisesLogged: number;
  totalSetsLogged: number;
  averageWorkoutDuration: number;
  averagePerceivedDifficulty: number;
  currentProgram?: TrainingProgram;
}

// Personal Record
export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  achievedDate: string;
  maxEver: boolean;
}
