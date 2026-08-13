/**
 * Domain types for Local Footy Athlete
 * Core business logic and data models
 */

import type {
  StrengthIntent,
  StrengthIntentDiagnostic,
} from '../rules/strengthPatternContributions';
import type { AthletePlacement } from '../rules/athletePlacement';

// Footy role buckets for athletes. The legacy exact positions remain in the
// type so old persisted profiles can be read and normalized at the app edge.
export type RoleBucket = 'inside_mid' | 'outside_runner' | 'key_position_ruck_tall' | 'high_forward_back' | 'small_forward_back';
export type LegacyPosition = 'Small back' | 'Key back' | 'Midfielder' | 'Ruck' | 'Small forward' | 'Key forward';
export type Position = RoleBucket | LegacyPosition;

// Experience level types
export type ExperienceLevel = 'Complete beginner' | '1-2 years' | '2-5 years' | '5+ years';

/** Who produced a recorded 2km time. Every one routes through `recordTwoKmTime`. */
export type TwoKmTimeTrialSource = 'onboarding' | 'profile_edit' | 'session_log';

/**
 * The athlete's answer to "what's your recent 2km time?" (D14).
 *
 * `seconds: null` is a REAL ANSWER — "I haven't tested it" — not an absence.
 * This follows the `SquatStrength` precedent, where "I don't squat / not sure"
 * is a first-class value rather than an empty field, and it matters
 * mechanically: the onboarding step registry resumes an interrupted flow from
 * the first unsatisfied step, so a skip that wrote nothing would send the
 * athlete back to a screen they had already dismissed.
 *
 * One shape, not a discriminated union — `strictNullChecks` is off in this repo,
 * so a union would not narrow on its discriminant.
 *
 * There is deliberately NO `masKmh` field. MAS is derived from `seconds` on
 * demand (`data/twoKmTimeTrial`), never stored beside it: a stored MAS is a
 * second representation of the same fact, and second representations drift.
 */
export interface TwoKmTimeTrialAnswer {
  /** Seconds for the 2km, or `null` for "haven't tested". */
  readonly seconds: number | null;
  /** ISO date the answer was recorded. */
  readonly recordedOn: string;
  readonly source: TwoKmTimeTrialSource;
}

// Subscription status types
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'cancelled' | 'expired';

// Training location types
export type TrainingLocation = 'Commercial gym' | 'Home gym' | 'Club gym' | 'Outdoor';

/** Whether profile equipment is an exhaustive user declaration or legacy positive-only data. */
export type EquipmentSelectionCompleteness = 'complete' | 'legacy_incomplete';

/**
 * Canonical conditioning-machine capabilities; treadmill is deliberately not
 * off-feet. `bike_erg` and `air_bike` are SEPARATE questions (Sam's audit
 * ruling 2, 2026-07-31: "different for sure") — the library's native-air-bike
 * rows and the flywheel rule can only be respected if the athlete's answer can
 * tell the two apart. A session that just needs "a bike" renders on either.
 */
export type ConditioningEquipmentModality = 'bike_erg' | 'air_bike' | 'row' | 'ski' | 'treadmill';

/**
 * One athlete decision about one piece of equipment. The two values carry
 * different SILENCES (Sam's ownership sheet §2.2, 2026-07-31): an item left
 * unmarked means "not today" — the app may ask again or offer it — while
 * `never` is a standing instruction to stop offering it, permanently. For
 * capability resolution the two are identical: neither is programmed on.
 */
export type EquipmentPossession = 'have' | 'never';

/**
 * THE EQUIPMENT ANSWER — a typed profile decision (Sam's ruling 2, 2026-07-31).
 *
 * The keys an athlete is asked about are DERIVED from the exercise library
 * (`rules/equipmentVocabulary`), never authored beside it. Availability is a
 * derivation over this answer plus dated temporary facts; nothing stores its
 * output. Under L15 this is the only baseline-equipment shape anything writes
 * from now on — `equipment` + `equipmentSelectionCompleteness` are read-ingress
 * only.
 */
export interface EquipmentAnswer {
  /** Per askable equipment tag; absent = not today. */
  readonly tags: Readonly<Partial<Record<import('../data/exercisePools').EquipmentTag, EquipmentPossession>>>;
  /** Per conditioning machine; absent = not today. */
  readonly modalities: Readonly<Partial<Record<ConditioningEquipmentModality, EquipmentPossession>>>;
  /** ISO date of the answer/last edit — what makes "answered" representable. */
  readonly answeredOn: string;
}

// Onboarding types for new user setup
export type AgeRange = 'Under 18' | '18-22' | '22-26' | '26-30' | '30+';

export type SeasonPhase = 'Off-season' | 'Pre-season' | 'In-season';

export type WeekKind = 'build' | 'deload';

export type TeamTrainingDuration = '60 minutes' | '90 minutes' | '2 hours';

export type TeamTrainingIntensity = 'Light' | 'Moderate' | 'Hard' | 'Very intense';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';


export type SquatStrength = "I don't squat" | 'Less than bodyweight' | 'Around bodyweight' | '1.5x bodyweight' | '2x bodyweight+' | 'Not sure';

export type BenchStrength = "I don't bench" | 'Less than bodyweight' | 'Around bodyweight' | '1.25x bodyweight' | '1.5x bodyweight+' | 'Not sure';

export type ConditioningLevel = 'Poor' | 'Average' | 'Good' | 'Elite';

export type SprintExposure = 'No sprint training' | 'Occasionally' | '2+ times per week';

export type RecentTrainingLoad = 'Hardly at all' | 'A bit' | 'Pretty consistent' | 'Very consistent';

export type BiggestLimitation = 'Strength' | 'Speed' | 'Endurance' | 'Size' | 'Injury history' | 'Mobility' | 'Power & explosiveness';

/**
 * The authored goal set (Sam, 2026-07-30 — "the goal OPTION list pinned as an authored
 * set, gated both directions"). The labels, the option order and the both-directions gate
 * live in `rules/motivationGoals.ts`; only the union lives here, so `OnboardingData` can
 * name it without importing a rule module.
 */
export type MotivationGoal =
  | 'make_senior_team'
  | 'dominate_level'
  | 'fresh_on_game_day'
  | 'stay_injury_free'
  | 'stronger_and_fitter'
  | 'build_muscle'
  | 'stay_consistent';

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
  /**
   * RETIRED FOR WRITING (L15, Sam's ruling 2026-07-30). The joined display sentence.
   *
   * `goals` + `motivationOther` are the stored decision now; this string is READ-INGRESS
   * ONLY, lifted by `rules/motivationGoals.ts` for profiles written before them. Nothing
   * writes it again — `motivationGoalsTests` fails the build if anything does.
   */
  motivation?: string;
  /** The athlete's own words from the "Other" tile, kept apart from the authored set. */
  motivationOther?: string;
  heightCm?: number;
  weightKg?: number;
  seasonPhase?: SeasonPhase;
  /**
   * The onboarding screen's game-day answer. ANY day of the week — Sam,
   * 2026-08-12: *"i can't know when every single club in aus is going to play a
   * game"*. This used to be a `GameDay` enum of Friday/Saturday/Sunday/'Varies',
   * which could not hold a midweek fixture at all.
   *
   * READ IT THROUGH `rules/gameAnchor.ts`, never directly: a profile written
   * before 2026-08-12 can still hold the legacy `'Varies'`, which was never a
   * day and means what `undefined` means.
   */
  gameDay?: DayOfWeek;
  /** In-season usual competition day, used as a default per-week game anchor when
   *  no explicit game has been set on the calendar for that week. Same rule:
   *  read it through `rules/gameAnchor.ts`. */
  usualGameDay?: DayOfWeek;
  teamTrainingDaysPerWeek?: number;
  teamTrainingDays?: DayOfWeek[];
  teamTrainingDuration?: TeamTrainingDuration;
  teamTrainingIntensity?: TeamTrainingIntensity;
  trainingDaysPerWeek?: number;
  trainingDaysUnsure?: boolean;
  preferredTrainingDays?: DayOfWeek[];
  availabilityConstraints?: ProgramAvailabilityConstraint[];
  trainingLocation?: TrainingLocation;
  equipment?: string[];
  /**
   * Modern saves are exhaustive. Legacy/default itemised lists only prove
   * positive availability and may be supplemented by the location baseline.
   */
  equipmentSelectionCompleteness?: EquipmentSelectionCompleteness;
  /** The typed equipment decision. Outranks every legacy equipment shape. */
  equipmentAnswer?: EquipmentAnswer;
  experienceLevel?: ExperienceLevel;
  squatStrength?: SquatStrength;
  benchStrength?: BenchStrength;
  /**
   * The athlete's 2km time trial (D14). `seconds: null` is a real answer —
   * "haven't tested" — not an absence, so a skip is distinguishable from a
   * step never reached.
   *
   * MAS is DERIVED from this, never stored beside it. See `data/twoKmTimeTrial`.
   */
  twoKmTimeTrial?: TwoKmTimeTrialAnswer;
  conditioningLevel?: ConditioningLevel;
  sprintExposure?: SprintExposure;
  recentTrainingLoad?: RecentTrainingLoad;
  injuries?: OnboardingInjury[];
  /**
   * THE ATHLETE'S CHOSEN GOALS — the stored decision (Sam, 2026-07-30).
   *
   * Was `string[]` and had NO WRITER at all: three surfaces read it, nothing ever filled
   * it, and the real answer lived in the `motivation` sentence beside it. It is now the
   * typed owner, written by the Motivation door, with the display string derived.
   */
  goals?: MotivationGoal[];
  biggestLimitation?: BiggestLimitation;
  biggestFrustration?: string;
  successVision?: string;
}

// Program phase types (Sam's 7 phases — retained for exercise selection/rep ranges)
export type ProgramPhase = 'Post-Season' | 'Early-Off-Season' | 'Base-Building' | 'Pre-Season-Skills' | 'Christmas-Block' | 'Return-to-Skills' | 'In-Season';

// ─── Coaching Engine Types ───

/**
 * THE ATHLETE'S STANDING CAPACITY BAND — "this athlete's baseline is low".
 *
 * RENAMED from `ReadinessLevel` (Sam, 2026-08-13) to end the homonym R-041 and
 * R-064 have recorded, UNENFORCED, since 2026-07-27. Two unrelated signals were
 * both called "readiness" and nothing in the repo could tell them apart:
 *
 *   CAPACITY (this type)   — computed from two onboarding answers by
 *   `data/capacityRubric.ts`. Reads no facts. Changes only when the PROFILE
 *   changes. It affects DOSE only; it never sets structure
 *   (`data/readinessStructureCensus.ts`).
 *
 *   THE DECLARATION        — "tired" / "wrecked" / "absolutely cooked", said by
 *   the athlete about TODAY (R-038). It keeps the name `readiness`:
 *   `ReadinessSignal`, `GenerationReadinessConstraint`, `rules/readinessIllnessLaw.ts`.
 *
 * The two must never be assigned to one another. Sam cut that conflation once
 * already, at `calculateReadiness`'s laundering site and at Contract v2's
 * `cookedReadiness` — a detrained athlete was handed the safety envelope of a
 * man who had declared himself wrecked. The rename is what makes the next
 * attempt a COMPILE ERROR rather than a comment somebody has to read.
 */
export type CapacityBand = 'low' | 'medium' | 'high';

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
  | 'Rest'
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
  | 'bye_week'
  // The G-2 quality-lower session (ruling 4a + the signing batch, Sam
  // 2026-08-06). Its own kind because it is the INTERSECTION of two facts —
  // a paused region and a fixture two days out — and neither alone produces
  // it: `subphase_policy` is a phase decision and `bye_week` is a fixture
  // absence, so folding it into either would let the note fire on a week
  // that never built the session.
  | 'injury_game_proximity';

export type DeterministicCoachNoteEffectReason =
  | 'adaptation_reduced'
  | 'adaptation_held'
  | 'adaptation_increased'
  | 'beginner_conservative_prescription'
  // 'testing_lower_strength' / 'testing_upper_strength' REMOVED 2026-07-31 with the
  // squat/bench gap-lean they explained (Sam's ruling, 2026-07-30).
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
  | 'bye_recovery'
  | 'g2_quality_lower';

/**
 * The specifics a COMPOSED sentence needs, stated by whoever makes the decision.
 *
 * Sam's signed G-2 sentence names three things — the session's day, the paused
 * body part and the fixture's day — and every one of them varies by world. A
 * static string carrying "Thursday", "shoulder" and "Saturday" would be a note
 * that LIES the moment the athlete's shoulder is a hamstring or the game moves,
 * which is worse than no note. So the sentence is composed, and these are its
 * inputs, resolved where the session is placed (the placer knows all three) and
 * never re-derived downstream.
 *
 * Derived, never persisted: it rides on the allocation and then on the workout's
 * `deterministicCoachNoteEvidence`, both of which are rebuilt every derive.
 */
export interface DeterministicCoachNoteEffectDetail {
  /** Day the session sits on, e.g. 'Thursday'. */
  sessionDayName?: string;
  /** The paused body part as the ATHLETE named it, e.g. 'shoulder'. */
  pausedBodyPart?: string;
  /** Day the fixture sits on, e.g. 'Saturday'. */
  fixtureDayName?: string;
}

export interface DeterministicCoachNoteEffectSeed {
  kind: DeterministicCoachNoteEffectKind;
  reason: DeterministicCoachNoteEffectReason;
  /** Stable decision owner, used for evidence replacement before week dedupe. */
  ownerKey: string;
  /** Present only for reasons whose copy is composed rather than constant. */
  detail?: DeterministicCoachNoteEffectDetail;
}

export type ConditioningFeasibilityReason =
  | 'available_capability'
  | 'deterministic_available_replacement'
  | 'safe_equivalent_substitution'
  | 'no_permitted_off_feet_modality'
  | 'no_safe_equivalent_substitute'
  | 'readiness_blocks_conditioning';

export type ConditioningSubstitutionFamily =
  | 'selected_modality'
  | 'bike'
  | 'row'
  | 'ski'
  | 'mixed'
  | 'treadmill'
  | 'outdoor_running'
  | 'hill_running_or_walking'
  | 'brisk_walking'
  | 'bodyweight_circuit'
  | 'safe_mixed_modal';

/** Serializable allocation-owned result consumed by edge and fallback generation. */
export interface ConditioningFeasibilityDecision {
  status: 'feasible' | 'replaced' | 'removed';
  requestedModality?: 'bike' | 'bike_erg' | 'row' | 'ski' | 'mixed';
  resolvedModality?: 'bike' | 'bike_erg' | 'row' | 'ski' | 'mixed';
  allowedModalities: Array<'bike' | 'row' | 'ski' | 'mixed'>;
  /** Ordered proof that substitution was attempted before removal/reduction. */
  attemptedSubstitutionFamilies?: ConditioningSubstitutionFamily[];
  resolvedSubstitutionFamily?: ConditioningSubstitutionFamily;
  /** Stable machine-readable reason detail for reduction ledgers and QA. */
  feasibilityDetail?: string;
  reason: ConditioningFeasibilityReason;
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
      hasConditioningComponent: boolean;
      conditioningModalities: string[];
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
  /**
   * The authored conditioning template this block renders (Stage B
   * switchover). Rows derive from the template by name — never from
   * string-prefix matching on `id`, which is the coupling this replaced.
   */
  templateName?: string;
}

/**
 * LEGACY STORED SHAPE — read only, and only until Stage 5 migrates it.
 *
 * Power is a ROW now (`role: 'power'`, see `WorkoutExercise.role`). Nothing in
 * the app writes this field; `sessionRowCountingTests` fails the build if
 * anything starts.
 *
 * It survives on the type for one reason: it WAS persisted. The program store
 * has no `partialize`, so the whole of `currentProgram` — microcycles,
 * workouts and their `powerBlock` — was serialised to storage for every athlete
 * who generated a program before 2026-07-28. Deleting the field outright would
 * be a tolerant reader by accident (JSON keeps unknown keys, TS types are
 * erased) rather than by decision, and Stage 5's migration would have to reach
 * for it through a cast.
 *
 * So the rich `PowerBlock` type is retired and this narrow door replaces it:
 * exactly the fields a migration needs to lift a stored block into a power row,
 * and nothing else. The counting fence is deliberately NOT here — the fence now
 * lives in the authored role, read at one choke point
 * (`src/rules/sessionRowCounting.ts`), and a second copy of it on a legacy
 * shape would be the parallel representation this unit exists to remove.
 */
export interface LegacyStoredPowerBlock {
  kind: 'primer' | 'contrast';
  family: 'lower' | 'upper';
  options: Array<{
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
  }>;
}

export type RecoveryAddonKind =
  | 'mobility'
  | 'trunk'
  | 'carries'
  | 'prehab'
  | 'breathing';

/**
 * An add-on row is a curated NAME and a DOSE.
 *
 * It carried a `notes?: string` until Sam's run-7 ruling 3 (2026-07-27). That
 * field was the transport for per-exercise text hardcoded in
 * `recoveryAddonBuilder` — display words that never passed through
 * `EXERCISE_CUES`. The row's coaching text now comes from the curated layer at
 * render, via `buildCueText(name)`, exactly like every other row; the field is
 * deleted rather than left unused so the channel cannot be reopened by a patch.
 */
/**
 * `source` lost `'mobility_flow_template'` on 2026-07-30 with the flow bundles it
 * named. Every add-on row now comes out of a curated pool, so there is one value
 * left that a writer can legitimately produce — and L15 says a retired shape is
 * never written again, by anything, rather than kept as a tolerated option.
 */
export interface RecoveryAddonExercise {
  id: string;
  name: string;
  prescription: string;
  source?: 'exercise_pool' | 'local';
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

  // Training preferences. Location is optional and coach-context only
  // (Sam's audit ruling 3, 2026-07-31): nothing programs off it.
  trainingLocation?: TrainingLocation;
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

  /** Canonical persisted entry clock for the user-selected season phase. */
  seasonPhaseClock?: import('../rules/seasonPhaseClock').SeasonPhaseClock;

  /**
   * R1.3 (shell rebuild): the todayISO this program was GENERATED with — the
   * generation records its own input, so the anchor can never drift from
   * what actually ran. Persisted as an input; the quiescent boot regenerates
   * with exactly this day.
   */
  generationAnchorISO?: string;

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
  /**
   * Which door deloaded this week, when it was not the scheduled one.
   *
   * Deliberately SEPARATE from `weekKind`: that is the block plan's structural
   * statement about the week, and Sam's law holds structure constant while the
   * work shrinks. An athlete declaring "wrecked" changes the dose, not what kind
   * of week the plan says this is. Recorded rather than inferred so the applied
   * deload stays observable — a dose transform with no trace is untestable.
   */
  deloadDoor?: 'readiness' | 'illness';

  /** Phase-owned weekly exposure intent accepted against final effective content. */
  exposureContract?: import('../rules/weeklyExposureContract').WeeklyExposureContract;

  /**
   * Section 18 policy observation contract. This runs alongside the legacy
   * acceptance contract until the final commit-gateway slice is approved.
   */
  exposureContractV2?: import('../rules/weeklyExposureContractV2').WeeklyExposureContractV2;

  // Workouts in this week
  workouts: Workout[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export type DerivedSessionOrigin =
  | 'fixture_replacement'
  | 'fixture_recovery'
  | 'fixture_proximity'
  | 'contract_shortfall_repair'
  | 'required_core_relocation'
  | 'pattern_balance_repair'
  | 'rest_distribution_repair'
  | 'safety_substitution'
  | 'equipment_substitution'
  | 'optional_planner_addition';

export type DerivedSessionTargetMetric =
  | 'main_strength'
  | 'conditioning_core'
  | 'sprint_high_speed'
  | 'strength_pattern'
  | 'full_rest'
  | 'hard_day_distribution'
  | 'safe_session_content'
  | 'optional_non_core';

export type DerivedSessionScope =
  | 'session'
  | 'conditioning_component'
  | 'strength_component'
  | 'speed_component'
  | 'power_component'
  | 'recovery_component';

export type DerivedSessionLifecycleCondition =
  | { kind: 'contract_signature_matches'; signature: string }
  | { kind: 'fixture_absent'; fixtureDate: string | null }
  | { kind: 'fixture_present'; fixtureDate: string | null }
  | { kind: 'metric_shortfall_exists'; metric: DerivedSessionTargetMetric; target: number }
  | { kind: 'metric_target_satisfied'; metric: DerivedSessionTargetMetric; target: number }
  | { kind: 'date_available'; date: string }
  | { kind: 'constraint_active'; signature: string }
  | { kind: 'equipment_profile_matches'; signature: string };

export interface DerivedSessionCredit {
  metric: DerivedSessionTargetMetric;
  amount: number;
  conditioningRole?: import('../rules/weeklyExposureContractV2').Section18ConditioningRole;
  strengthPattern?: 'squat' | 'hinge' | 'push' | 'pull';
}

export interface DerivedSessionHistoryEntry {
  action: 'created' | 'relocated' | 'stacked' | 'substituted' | 'downgraded' | 'expired';
  date: string;
  fromDayOfWeek?: number;
  toDayOfWeek?: number;
  detail?: string;
}

export interface DerivedSessionDependencyEndpoint {
  date: string;
  weekStart: string;
}

export interface DerivedSessionRestoration {
  targetDate: string;
  sourcePlanEntryId: string | null;
  /** Exact accepted session displaced by the derived item; null means genuine empty state. */
  workout: Workout | null;
}

export interface DerivedSessionDependency {
  kind: 'fixture_to_session';
  source: DerivedSessionDependencyEndpoint;
  target: DerivedSessionDependencyEndpoint;
  crossesWeekBoundary: boolean;
  displacedSession: DerivedSessionRestoration;
  restoration: DerivedSessionRestoration;
}

/** Persisted lifecycle ownership for every system-derived session/component. */
export interface DerivedSessionProvenance {
  protocolVersion: 1 | 2;
  authorship: 'system';
  origin: DerivedSessionOrigin;
  scope: DerivedSessionScope;
  triggerSignature: string;
  targetMetric: DerivedSessionTargetMetric;
  credit: DerivedSessionCredit;
  originatingFixtureDate: string | null;
  originatingDate: string;
  validWhile: DerivedSessionLifecycleCondition[];
  invalidWhen: DerivedSessionLifecycleCondition[];
  history: DerivedSessionHistoryEntry[];
  sourcePlanEntryId: string | null;
  /** Present when a derived session displaces accepted work and must be reversible. */
  dependency?: DerivedSessionDependency;
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
  /**
   * "This day is anchored by team training."
   *
   * The generator has always written it (`coachingEngine` widens `Workout` with
   * an ad-hoc `& { isTeamDay?: boolean }` to do so) and `isTeamTrainingSession`
   * has always read it, but it was never declared here — so four call sites read
   * it through `as any` and no composition site could be type-checked against
   * it. It is declared now because the anchor is a fact about the DAY and has to
   * travel deliberately: splitting a combined day used to hand it to both halves
   * by inheritance, which sent the team night away with the gym session. See
   * `splitAcceptedSessionForAthleteMove`.
   */
  isTeamDay?: boolean;
  /**
   * WHICH WORD THIS FIXTURE WEARS. Stamped by the resolver's game-stub
   * factories from the season phase (`canonicalFixtureKind`,
   * `rules/fixtureConditionedAvailability.ts` — the app's ONE
   * phase→fixture-identity expression, the same one the §18 week mode uses,
   * so the label and the mode cannot disagree). LABEL ONLY, by ruling
   * 6-IV-4: `workoutType` stays `'Game'` and every `=== 'Game'` comparison
   * with it — the ~99 sites that decide week shape, locks and invariants are
   * untouched by construction. Read by `dayIsPracticeMatch` alone.
   */
  fixtureVariant?: 'practice_match';
  /**
   * WHICH CHARTER OPTIONAL TYPE THIS SESSION IS. The plan entry has carried
   * `composedOptionalKind` since the charter unit; the builder consumed and
   * discarded it, so a Gunshow reached the projection as name-only and the
   * signed part headline had nothing typed to read (combined device pass
   * 2026-08-01, fail 2). Stamped by `sessionBuilder.finaliseDerivedSession`
   * from the `DerivedSessionType` it already receives — one site, every
   * route (generator, athlete door, resolver derivation) funnels through it.
   * Carried, never inferred: a canonicalisation pass must not re-derive it
   * from names.
   */
  composedOptionalKind?: 'gunshow' | 'prehab' | 'mobility';
  /** Typed lifecycle ownership. Absence means non-disposable legacy/user/Coach work. */
  derivedSessionProvenance?: DerivedSessionProvenance[];
  /**
   * "The athlete put this session on this day." Derived from the owning
   * `UserRemovalConstraint` at the single ingress site and never persisted as a
   * second truth — see `rules/athletePlacement.ts` before adding a writer.
   */
  athletePlacement?: AthletePlacement;
  /** Canonical planned/effective strength contract. Existing typed intent always wins. */
  strengthIntent?: StrengthIntent;
  /**
   * The allocation's main-strength DOSE variant, carried onto the built day.
   * Mirrors `SessionAllocation.strengthVariant` and means the same thing.
   *
   * It rides this far for ONE reason: Sam's ruling 4a (2026-08-06) exempts the
   * authored 2x3 Vertical Jump from the weekly power-primer budget *when it
   * ships as part of the G-2 quality-lower session*. An exemption the CONTENT
   * owner knows and the VERDICT owner does not is precisely the asymmetry
   * `section18SafetyFinaliser` was written to kill ("content derived to match
   * its budget cannot contradict it"), so both read this one field:
   * `budgetedPowerSession` in the finaliser, and the primer ledger in
   * `section18EffectiveWeekEvaluator`. Derived, never persisted.
   *
   * BIBLE_ANCHOR: lower_strength_g3
   */
  strengthVariant?: 'standard' | 'quality_low_volume';
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
  conditioningCategory?: 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic' | 'cod_decel';
  /** Final allocation feasibility decision; display fields never override it. */
  conditioningFeasibility?: ConditioningFeasibilityDecision;

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
   * LEGACY STORED SHAPE — read only. Power is a `role: 'power'` row in
   * `exercises` now; nothing writes this. Present so Stage 5 can migrate
   * programs persisted before 2026-07-28 without a cast. See
   * `LegacyStoredPowerBlock`.
   */
  powerBlock?: LegacyStoredPowerBlock;

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

  /** Typed Section 18 component evidence; display copy never overrides it. */
  section18Evidence?: import('../rules/weeklyExposureContractV2').WorkoutSection18Evidence;

  /** Planner-owned conditioning identity preserved into canonical evidence. */
  section18ConditioningRole?: import('../rules/weeklyExposureContractV2').Section18ConditioningRole;

  // Exercises
  exercises: WorkoutExercise[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export type UserRemovalScope =
  | 'whole_session'
  | 'strength_component'
  | 'conditioning_component'
  | 'recovery_component'
  | 'team_component';

/**
 * Persisted athlete ownership for an explicitly binned accepted target.
 *
 * The concrete date/scope is the permission boundary. Stable accepted
 * identity is retained for audit/restoration, while `remainingWorkout`
 * preserves the exact component semantics of a stacked-day deletion.
 */
export interface UserRemovalConstraint {
  protocolVersion: 1;
  id: string;
  authorship: 'user';
  source: 'tap' | 'coach';
  /**
   * Legacy persisted surface name notwithstanding, this record is also the
   * typed source/target ownership for an athlete move. Older deletion rows
   * omit the field and therefore retain `deletion` semantics.
   */
  mutationKind?: 'deletion' | 'move';
  status: 'active' | 'restored';
  targetDate: string;
  scope: UserRemovalScope;
  targetPlanEntryId: string | null;
  targetWorkoutId: string;
  originalWorkout: Workout;
  remainingWorkout: Workout | null;
  equivalentExposureMayRelocate: boolean;
  wholeDayRestOwned: boolean;
  /** Athlete-owned destination for a move; absent for a deletion. */
  moveTargetDate?: string;
  moveTargetPlanEntryId?: string | null;
  moveTargetWorkoutId?: string;
  /** Exact accepted source prescription constrained onto moveTargetDate. */
  movedWorkout?: Workout;
  createdAt: string;
  restoredAt: string | null;
  restorationReason: 'explicit_restore' | 'explicit_re_add' | null;
}

export interface WeekScopedWorkoutOverlay {
  id: string;
  weekStart: string;
  weekEnd: string;
  anchorDate: string | null;
  /**
   * `accepted_week_repair` is the §18 accepted-week gateway's own repair of a
   * BASE-OWNED week. It used to be written into `dateOverrides` for want of an
   * overlay to hold it, which filed derived content under the athlete's
   * signature and — because a date override outranks a calendar mark on the
   * screen and is outranked by it in the accepted week — rendered a session on
   * days the athlete had marked as rest. See
   * docs/DERIVED_OVERRIDE_MATERIALISATION_REASSESSMENT_2026-07-30.md.
   */
  reason: 'one_off_game' | 'one_off_no_game' | 'readiness_reduction'
    | 'accepted_week_repair'
    /** One `team_night_move` fact's ruled effect: the anchor relocated within
     *  its week (sparse two-date overlay; every other day falls through). */
    | 'team_night_move';
  /** Re-resolved for this target week; never inherited blindly from the source week. */
  exposureContract?: import('../rules/weeklyExposureContract').WeeklyExposureContract;
  /** Parallel Section 18 policy contract for observational evaluation. */
  exposureContractV2?: import('../rules/weeklyExposureContractV2').WeeklyExposureContractV2;
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
  /** Typed accepted dose; visible projection must prefer this over display copy. */
  durationMinutes?: number;
  /** Typed accepted option intensity when it differs from the workout default. */
  intensity?: IntensityLevel;
  /**
   * The modality this option resolved to (Stage B switchover). Authored
   * template names never carry a machine name, so readers must never
   * keyword-guess the modality from the title — this field is the answer.
   */
  modality?: 'bike' | 'row' | 'ski' | 'running' | 'mixed';
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

  /** Typed canonical row-domain evidence for Section 18 evaluation. */
  section18Evidence?: import('../rules/weeklyExposureContractV2').WorkoutExerciseSection18Evidence;

  /**
   * What KIND of work this row is — authored by whoever builds the row, never
   * inferred from its name.
   *
   * The vocabulary is `SessionRole`, the same six the session screen already
   * orders by. It moved onto the row (Sam, 2026-07-27) so that the counting
   * fence has a home in the DATA rather than in the shape of the data. Power's
   * fence — not a hard exposure, not main strength, no conditioning credit, not
   * a finisher — used to be enforced by power simply not being in this list.
   * Once power is a row, `role: 'power'` is what carries the exemption, read at
   * exactly one place (`src/rules/sessionRowCounting.ts`).
   *
   * OPTIONAL, and the absence means something precise: this row has NOT been
   * declared exempt from counting, so it counts. That is the null hypothesis,
   * not a guess — contrast the off-season subphase, where absence was being
   * converted INTO a positive fact and had to become required. Here the field
   * only ever REMOVES a row from counting, so an unauthored row is treated
   * exactly as it is today and no count can move by omission.
   *
   * The vocabulary is deliberately general while only power migrates: the
   * remaining roles are render facts today (`classifyExerciseRole`), and
   * authoring all six at the 100-odd row builders would relocate name-inference
   * rather than retire it.
   */
  role?: import('../utils/sessionRoles').SessionRole;

  /**
   * The two power facts a row must carry that a name and a dose cannot express.
   *
   * Present if and only if `role === 'power'` — pinned by
   * `sessionRowCountingTests`. `family` is read by the §18 weekly budget (which
   * prefers family diversity across the week) and by the safety policy's
   * `prohibitedPowerFamilies`; `kind` distinguishes a standalone primer from
   * contrast work paired with the heavy set.
   *
   * Everything else the retired `PowerBlock` carried is already row data: the
   * exercise NAME is the row's exercise, the DOSE is `prescribedSets` and the
   * rep range, and the placement/contrast guidance is the row's `notes`. Only
   * these two had nowhere else to live, which is why they are the only survivors
   * of the block.
   */
  power?: {
    family: import('../rules/powerPrimerPolicy').PowerFamily;
    kind: import('../rules/powerPrimerPolicy').PowerKind;
  };

  /**
   * How to interpret the reps numbers:
   *   - 'reps': standard rep count (default if omitted)
   *   - 'duration': repsMin/repsMax are seconds (e.g. 30–45s hold)
   *   - 'duration_minutes': repsMin/repsMax are minutes (e.g. 15–20 min walk)
   *   - 'distance': repsMin/repsMax are metres
   */
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';

  /**
   * WHO NAMED THIS ROW — the emitter's own marker, set at build time.
   *
   * `'authored'` means every athlete-facing word on the row traces to a signed
   * source: an authored template name, or a sentence on the copy sheet. The
   * visible projection carries such a row; it refuses rows whose names a
   * builder composed out of planner nouns and numbers
   * (`isComposedPrescriptionRow`). Absent means "not claimed", which is the
   * honest default for every legacy and coach-authored row.
   *
   * A MARKER, NOT A LOOKUP: the projection must never decide what to carry by
   * asking whether the words happen to be registered — that makes the copy
   * sheet the authority over content. This says how the row was BUILT.
   */
  nameProvenance?: 'authored';
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
