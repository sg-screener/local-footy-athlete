/**
 * Strength Progression Integration — Wires resolveProgression() into live workouts.
 *
 * Pure functions. No React. No Zustand. No side effects.
 *
 * This module sits between the resolver/builder and the final workout output.
 * It takes a Workout (from template or tag-aware builder), classifies each
 * exercise by role, runs resolveProgression() for primary/secondary lifts,
 * and adjusts prescriptions (sets, reps, weight, rest).
 *
 * EXERCISE ROLE CLASSIFICATION:
 *   - primary_strength:   compound movements (squat, hinge, horizontal/vertical push/pull)
 *                         with load: moderate or high
 *   - secondary_strength: compound movements with load: low, OR lunges
 *   - excluded:           isolation_upper, core, conditioning, carry, plyo,
 *                         and all exercises NOT in EXERCISE_TAGS
 *
 * Accessories, trunk work, isolation, and pump exercises are EXCLUDED
 * from progression — they keep their template prescriptions unchanged.
 *
 * INTEGRATION POINTS:
 *   - Called on template workouts after resolveDate() returns them (Priority 6)
 *   - Called inside buildTagAwareSession() after exercise selection
 *   - Called by the resolver for any strength or mixed session with strength
 *     rows entering the live flow
 */

import type {
  Workout,
  WorkoutExercise,
  SeasonPhase,
  ReadinessLevel,
  SessionFeeling,
  LoggedWorkout,
  LoggedSet,
} from '../types/domain';
import { EXERCISE_TAGS, type ExerciseTag, type Region } from '../data/exerciseTags';
import {
  resolveProgression,
  type ProgressionInput,
  type ProgressionOutput,
  type ProgressionState,
} from './progressionRules';
import {
  type ExerciseRole,
  type CompletionQuality,
  type TrendSignal,
  feelingToRPE,
  deriveTrend,
  extractExposureHistory,
  extractSlotExposureHistory,
  deriveCompletionQuality,
  countConsecutiveBuildWeeks,
  estimateWeeksSinceDeload,
} from './progressionHelpers';
import type { FeedbackCompletion, FeedbackFeeling, SessionFeedback } from '../store/programStore';
import { analyzeFeedbackPatterns, applyPatternBiases } from './feedbackPatterns';
import { type AdaptationResult, applyReadinessBias } from './feedbackAdapter';
import type { ProgramBlockState } from './programBlockState';

// ─── Feedback → Domain Feeling Bridge ───

/**
 * Map the UI FeedbackFeeling to the domain SessionFeeling used by progression.
 *
 *   very_easy → Strong  (felt easy = body is strong / well-recovered)
 *   easy      → Good    (comfortable effort)
 *   good      → Average (neutral / appropriate difficulty = repeat)
 *   hard      → Sore    (fatigued / beat up)
 *   very_hard → Cooked  (smashed / needs recovery)
 */
const FEEDBACK_TO_SESSION_FEELING: Record<FeedbackFeeling, SessionFeeling> = {
  very_easy: 'Strong',
  easy: 'Good',
  good: 'Average',
  hard: 'Sore',
  very_hard: 'Cooked',
};

export function feedbackFeelingToSessionFeeling(fb: FeedbackFeeling): SessionFeeling {
  return FEEDBACK_TO_SESSION_FEELING[fb] ?? 'Good';
}

function atNoon(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00`);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayForDate(dateISO: string): string {
  const d = atNoon(dateISO);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  d.setDate(d.getDate() + mondayOffset);
  return formatDate(d);
}

function strengthCompletion(feedback: SessionFeedback): FeedbackCompletion {
  const strengthComponent = feedback.components?.find((component) => component.kind === 'strength');
  return strengthComponent?.completion ?? feedback.completion;
}

function completedSetCount(completion: FeedbackCompletion, prescribedSets: number): number {
  const targetSets = Math.max(0, Math.floor(prescribedSets || 0));
  if (completion === 'skipped') return 0;
  if (completion === 'partial') return Math.max(1, Math.ceil(targetSets / 2));
  return targetSets;
}

function feedbackStrengthSets(
  feedback: SessionFeedback,
  loggedWorkoutId: string,
): LoggedSet[] {
  const completion = strengthCompletion(feedback);
  if (completion === 'skipped') return [];

  const sets: LoggedSet[] = [];
  for (const lift of feedback.strength ?? []) {
    const setCount = completedSetCount(completion, lift.prescribedSets);
    const reps = Math.max(1, lift.prescribedRepsMax || lift.prescribedRepsMin || 1);
    for (let setNumber = 1; setNumber <= setCount; setNumber++) {
      sets.push({
        id: `${loggedWorkoutId}-${lift.exerciseId}-${setNumber}`,
        loggedWorkoutId,
        // The progression helpers key local feedback history by canonical exerciseId.
        workoutExerciseId: lift.exerciseId,
        setNumber,
        actualReps: reps,
        actualWeightKg: lift.weightKg ?? undefined,
        createdAt: `${feedback.dateStr}T12:00:00.000Z`,
        updatedAt: `${feedback.dateStr}T12:00:00.000Z`,
      });
    }
  }
  return sets;
}

export function deriveMissedStrengthSessionsThisWeek(
  feedbackMap: Record<string, SessionFeedback>,
  beforeDate: string,
): number {
  const weekStart = mondayForDate(beforeDate);
  return Object.values(feedbackMap).filter((feedback) => (
    feedback.dateStr >= weekStart &&
    feedback.dateStr < beforeDate &&
    strengthCompletion(feedback) === 'skipped'
  )).length;
}

export function buildStrengthWorkoutHistoryFromFeedback(
  feedbackMap: Record<string, SessionFeedback>,
  beforeDate: string,
): LoggedWorkout[] {
  return Object.values(feedbackMap)
    .filter((feedback) => feedback.dateStr < beforeDate)
    .filter((feedback) => (feedback.strength?.length ?? 0) > 0 || strengthCompletion(feedback) === 'skipped')
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
    .map((feedback): LoggedWorkout => {
      const loggedWorkoutId = `feedback-strength-${feedback.dateStr}`;
      const completion = strengthCompletion(feedback);
      return {
        id: loggedWorkoutId,
        userId: 'local',
        workoutId: loggedWorkoutId,
        loggedDate: feedback.dateStr,
        completedAt: completion === 'skipped' ? undefined : `${feedback.dateStr}T12:00:00.000Z`,
        sessionFeeling: feedback.feeling ? feedbackFeelingToSessionFeeling(feedback.feeling) : undefined,
        notes: feedback.notes,
        completed: completion !== 'skipped',
        synced: true,
        sets: feedbackStrengthSets(feedback, loggedWorkoutId),
        createdAt: `${feedback.dateStr}T12:00:00.000Z`,
        updatedAt: `${feedback.dateStr}T12:00:00.000Z`,
      };
    });
}

// ─── Types ───

export interface StrengthProgressionContext {
  seasonPhase: SeasonPhase;
  readiness: ReadinessLevel;
  daysToGame: number | null;
  daysSinceGame: number | null;
  doubleGameWeek: boolean;
  /** From onboarding injury list — true if any 'avoid' severity injury is active. */
  injuryAvoidFlag: boolean;
  /** Recent session feeling. Defaults to 'Good' if unknown. */
  sessionFeeling: SessionFeeling;
  /** Number of missed scheduled sessions this week. */
  missedSessionsThisWeek: number;
  /** Weeks since last deload (0 if unknown). */
  weeksSinceDeload: number;
  /** Consecutive weeks with completed strength sessions. */
  consecutiveBuildWeeks: number;
  /** Weeks off training (0 = no gap). */
  weeksOffTraining: number;
  /** Post-overreach deload trigger. */
  recentDeloadTrigger: 'overreach' | null;
  /** Workout history (newest first) for exposure/trend/completion analysis. */
  workoutHistory: LoggedWorkout[];
  /**
   * Minimum weight increment in kg for barbell/primary/secondary lifts.
   * Adjusted weights snap to the nearest multiple of this value.
   * Default: 2.5 (standard Olympic barbell plates).
   * Typical values: 2.5 (barbell), 1.0 (machine/dumbbell), 0.5 (micro plates).
   */
  loadIncrementKg?: number;

  // ─── Explicit adaptation overrides (from feedbackAdapter) ───

  /**
   * Explicit per-exercise set adjustment from feedback adaptation.
   *   -1 = reduce by 1 set, 0 = no change, +1 = allow adding 1 set.
   * Applied directly after progression resolves — no indirect signals.
   */
  adaptationVolumeAdjustment?: -1 | 0 | 1;
  /**
   * When true, cap load increases at current level (no micro_up, up).
   * Applied directly after progression resolves.
   */
  adaptationBlockProgression?: boolean;
}

/** Safe defaults when no history or detailed context is available. */
export const DEFAULT_PROGRESSION_CONTEXT: StrengthProgressionContext = {
  seasonPhase: 'Off-season',
  readiness: 'medium',
  daysToGame: null,
  daysSinceGame: null,
  doubleGameWeek: false,
  injuryAvoidFlag: false,
  sessionFeeling: 'Good',
  missedSessionsThisWeek: 0,
  weeksSinceDeload: 2,
  consecutiveBuildWeeks: 2,
  weeksOffTraining: 0,
  recentDeloadTrigger: null,
  workoutHistory: [],
  loadIncrementKg: 2.5,
};

export interface BuildProgressionContextOptions {
  blockState?: Pick<
    ProgramBlockState,
    'weekInBlock' | 'weeksSinceDeload' | 'consecutiveBuildWeeks'
  >;
  missedSessionsThisWeek?: number;
  weeksOffTraining?: number;
  recentDeloadTrigger?: 'overreach' | null;
}

// ─── Exercise Role Classification ───

/** Movement patterns that qualify as primary or secondary strength. */
const PRIMARY_MOVEMENTS = new Set([
  'squat', 'hinge', 'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
]);

/** Movement patterns that are always secondary (never primary). */
const SECONDARY_MOVEMENTS = new Set(['lunge']);

/** Movement patterns excluded from progression entirely. */
const EXCLUDED_MOVEMENTS = new Set([
  'isolation_upper', 'isolation_lower', 'core', 'conditioning', 'carry', 'plyo',
]);

/**
 * Classify an exercise into a progression role.
 *
 * Returns null for exercises that should not receive progression
 * (accessories, trunk, isolation, pump, conditioning, untagged).
 */
export function classifyExerciseRole(exerciseName: string): ExerciseRole | null {
  const tags = EXERCISE_TAGS[exerciseName];
  if (!tags) return null;

  // Excluded patterns get no progression
  if (EXCLUDED_MOVEMENTS.has(tags.movement)) return null;

  // Secondary: lunges, or primary patterns with low load
  if (SECONDARY_MOVEMENTS.has(tags.movement)) return 'secondary_strength';
  if (PRIMARY_MOVEMENTS.has(tags.movement)) {
    return tags.load === 'low' ? 'secondary_strength' : 'primary_strength';
  }

  // Everything else (carry, etc.) is excluded
  return null;
}

export function workoutHasProgressableStrengthRows(workout: Workout): boolean {
  if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') {
    return false;
  }
  return workout.exercises.some((exercise) =>
    !!classifyExerciseRole(exercise.exercise?.name || '')
  );
}

/**
 * Determine if an exercise is lower body from its tags.
 */
export function isLowerBodyExercise(exerciseName: string): boolean {
  const tags = EXERCISE_TAGS[exerciseName];
  if (!tags) return false;
  return tags.region === 'lower';
}

/**
 * When a pool-managed exercise has no direct lastPerformedWeight entry
 * (typical for a first-block-after-rotation exercise), look for any
 * sibling in the same (slot, role) that has one. Return the sibling's
 * weight normalized to the target via load ratios.
 *
 * Returns undefined if no sibling has a logged weight, or if the target
 * isn't pool-managed (caller already handled direct lookup).
 *
 * Uses require() to avoid a top-level circular dependency with
 * defaultProgram.ts (which imports this module indirectly via the
 * pool system).
 */
function resolveSiblingPerformedWeight(
  targetName: string,
  lastPerformedWeights: Record<string, number | null>,
): number | null | undefined {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pools = require('../data/exercisePoolsStrength') as typeof import('../data/exercisePoolsStrength');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const program = require('../data/defaultProgram') as typeof import('../data/defaultProgram');

  const hit = pools.findPoolEntry(targetName);
  if (!hit) return undefined;
  const { entry: targetEntry, slot, role } = hit;
  const siblings = pools.getSlotSiblings(slot, role);

  for (const sibling of siblings) {
    if (sibling.name === targetName) continue;
    const siblingId = program.findOrCreateExercise(sibling.name).id;
    if (!(siblingId in lastPerformedWeights)) continue;
    const weight = lastPerformedWeights[siblingId];
    if (weight === null) return null; // sibling is bodyweight
    if (weight === undefined) continue;
    if (sibling.loadRatio <= 0 || targetEntry.loadRatio <= 0) {
      return weight; // translation undefined — pass through
    }
    return weight * (targetEntry.loadRatio / sibling.loadRatio);
  }
  return undefined;
}

// ─── Load Rounding ───

/** Default load increment (standard Olympic barbell plates: 1.25kg per side). */
const DEFAULT_LOAD_INCREMENT_KG = 2.5;

/**
 * Round a weight to the nearest multiple of the configured load increment.
 * Ensures results are deterministic and plate-realistic.
 *
 * Examples with 2.5kg increment: 101.25 → 102.5, 68.75 → 70.0
 * Examples with 1.0kg increment:  101.25 → 101.0, 68.75 → 69.0
 */
export function roundToIncrement(weight: number, incrementKg: number): number {
  if (incrementKg <= 0) return weight; // safety: avoid division by zero
  return Math.round(weight / incrementKg) * incrementKg;
}

// ─── Prescription Adjustment ───

/** How a prescription changes based on progression output. */
interface PrescriptionDelta {
  setsChange: number;         // +1, 0, -1, -2
  repsMinChange: number;      // for micro_up: 0, for down: -2
  repsMaxChange: number;
  weightMultiplier: number;   // 1.0 = no change, 0.6–0.8 = deload, 1.025 = micro_up
  restChange: number;         // seconds
}

/**
 * Map a ProgressionOutput to concrete prescription deltas.
 */
function outputToPrescriptionDelta(output: ProgressionOutput): PrescriptionDelta {
  const delta: PrescriptionDelta = {
    setsChange: 0,
    repsMinChange: 0,
    repsMaxChange: 0,
    weightMultiplier: 1.0,
    restChange: 0,
  };

  // Load delta
  switch (output.loadDelta) {
    case 'micro_up':
      delta.weightMultiplier = 1.025; // +2.5%
      break;
    case 'up':
      delta.weightMultiplier = 1.05; // +5%
      break;
    case 'down':
      delta.weightMultiplier = 0.95; // -5%
      delta.repsMinChange = -1;
      delta.repsMaxChange = -1;
      break;
    case 'big_down':
      delta.weightMultiplier = 0.7; // -30% (middle of 20-40% range)
      delta.repsMinChange = -2;
      delta.repsMaxChange = -2;
      break;
  }

  // Sets delta
  switch (output.setsDelta) {
    case 'add_one':
      delta.setsChange = 1;
      break;
    case 'drop_one':
      delta.setsChange = -1;
      break;
    case 'drop_two':
      delta.setsChange = -2;
      break;
  }

  // RPE delta → rest adjustment
  switch (output.rpeDelta) {
    case 'push':
      delta.restChange = -15; // shorter rest = higher RPE
      break;
    case 'pull':
      delta.restChange = 15; // longer rest = lower RPE
      break;
  }

  return delta;
}

/**
 * Apply a prescription delta to a WorkoutExercise.
 * Returns a new WorkoutExercise with adjusted prescription.
 * Enforces minimum floors (1 set, 3 reps, 0kg, 30s rest).
 *
 * NOTE: Progression state is NOT appended to exercise.notes.
 * It lives on _progressionResults metadata (per-exercise) for any
 * system that needs it (e.g. sessionExplanation). Exercise notes
 * stay clean for the athlete.
 */
function applyDelta(
  exercise: WorkoutExercise,
  delta: PrescriptionDelta,
  loadIncrementKg: number = DEFAULT_LOAD_INCREMENT_KG,
): WorkoutExercise {
  const newSets = Math.max(1, exercise.prescribedSets + delta.setsChange);
  const newRepsMin = Math.max(3, exercise.prescribedRepsMin + delta.repsMinChange);
  const newRepsMax = Math.max(3, exercise.prescribedRepsMax + delta.repsMaxChange);
  const newRest = Math.max(30, exercise.restSeconds + delta.restChange);

  // Weight: apply multiplier if prescribed weight exists, round to load increment
  let newWeight = exercise.prescribedWeightKg;
  if (newWeight !== undefined && newWeight !== null && newWeight > 0) {
    newWeight = roundToIncrement(delta.weightMultiplier * newWeight, loadIncrementKg);
  }

  return {
    ...exercise,
    prescribedSets: newSets,
    prescribedRepsMin: newRepsMin,
    prescribedRepsMax: newRepsMax,
    prescribedWeightKg: newWeight,
    restSeconds: newRest,
    // notes preserved as-is — no progression tags appended
    updatedAt: new Date().toISOString(),
  };
}

// ─── Main API ───

/**
 * Apply strength progression to all eligible exercises in a workout.
 *
 * Classifies each exercise by role, runs resolveProgression() for
 * primary and secondary lifts, and adjusts prescriptions. Accessories,
 * trunk, isolation, and pump exercises are left unchanged.
 *
 * @param workout          - The strength or mixed workout to process
 * @param ctx              - Progression context (season, readiness, history, etc.)
 * @param lastPerformedWeights - Optional map of exerciseId → last performed weight (from weightOverrides store).
 *                               When provided, uses performed weight as baseline instead of template weight.
 *                               null = bodyweight, undefined = use template weight.
 * @returns                - A new Workout with adjusted prescriptions + metadata
 */
export function applyStrengthProgression(
  workout: Workout,
  ctx: StrengthProgressionContext,
  lastPerformedWeights?: Record<string, number | null>,
): Workout & { _progressionResults?: Record<string, ProgressionOutput> } {
  // Only process sessions that actually contain progressable strength rows.
  if (!workoutHasProgressableStrengthRows(workout)) return workout;

  const rpe = feelingToRPE(ctx.sessionFeeling);
  const results: Record<string, ProgressionOutput> = {};
  const now = new Date().toISOString();

  const newExercises = workout.exercises.map(ex => {
    const name = ex.exercise?.name || '';
    const role = classifyExerciseRole(name);

    // Skip non-progression exercises
    if (!role) return ex;

    // Build progression input for this exercise. Use slot-keyed history
    // so rotated pool anchors (e.g. Back Squat → Front Squat) inherit
    // the prior block's exposure trend with load normalized via the
    // pool's load ratios. Non-pool exercises fall through to the
    // per-ID extractor inside extractSlotExposureHistory.
    const exposures = extractSlotExposureHistory(
      ctx.workoutHistory,
      name,
      ex.exerciseId,
      3,
    );
    const trend = deriveTrend(exposures);

    // Derive completion quality from most recent workout containing this exercise
    let completionQuality: CompletionQuality = 'full';
    let consecutiveFullCompletions = 1;
    for (const w of ctx.workoutHistory) {
      const matchingSets = w.sets.filter(s => s.workoutExerciseId === ex.exerciseId);
      if (matchingSets.length > 0) {
        completionQuality = deriveCompletionQuality(
          matchingSets,
          ex.prescribedSets,
          ex.prescribedWeightKg,
        );
        // Count consecutive full completions
        if (completionQuality === 'full') {
          consecutiveFullCompletions = 1;
          for (let i = 1; i < ctx.workoutHistory.length; i++) {
            const olderSets = ctx.workoutHistory[i].sets.filter(
              s => s.workoutExerciseId === ex.exerciseId
            );
            if (olderSets.length === 0) break;
            const olderQ = deriveCompletionQuality(olderSets, ex.prescribedSets, ex.prescribedWeightKg);
            if (olderQ === 'full') {
              consecutiveFullCompletions++;
            } else {
              break;
            }
          }
        } else {
          consecutiveFullCompletions = 0;
        }
        break; // only need the most recent exposure
      }
    }

    const input: ProgressionInput = {
      exerciseRole: role,
      seasonPhase: ctx.seasonPhase,
      readiness: ctx.readiness,
      completionQuality,
      weeksSinceDeload: ctx.weeksSinceDeload,
      consecutiveBuildWeeks: ctx.consecutiveBuildWeeks,
      recentRPE: rpe,
      daysToGame: ctx.daysToGame,
      daysSinceGame: ctx.daysSinceGame,
      doubleGameWeek: ctx.doubleGameWeek,
      weeksOffTraining: ctx.weeksOffTraining,
      injuryAvoidFlag: ctx.injuryAvoidFlag,
      recentDeloadTrigger: ctx.recentDeloadTrigger,
      missedSessionsThisWeek: ctx.missedSessionsThisWeek,
      sessionFeeling: ctx.sessionFeeling,
      trend,
      isLowerBody: isLowerBodyExercise(name),
      consecutiveFullCompletions,
    };

    const output = resolveProgression(input);
    results[name] = output;

    // Apply the progression decision to the prescription
    const delta = outputToPrescriptionDelta(output);

    // ── Explicit adaptation overrides ──
    // blockProgression: cap load at current level (no increases)
    if (ctx.adaptationBlockProgression) {
      if (delta.weightMultiplier > 1.0) delta.weightMultiplier = 1.0;
      if (delta.repsMinChange > 0) delta.repsMinChange = 0;
      if (delta.repsMaxChange > 0) delta.repsMaxChange = 0;
    }
    // volumeAdjustment: directly adjust sets (-1 or +1)
    if (ctx.adaptationVolumeAdjustment) {
      delta.setsChange += ctx.adaptationVolumeAdjustment;
    }

    // Use last performed weight as baseline if available.
    // Pool rotation note: if the exercise is pool-managed and has no
    // direct entry, fall back to a sibling's last performed weight
    // normalized by load ratio. Same seam as exposure-history transfer.
    let baseEx = ex;
    if (lastPerformedWeights) {
      let performedWeight: number | null | undefined;
      if (ex.exerciseId in lastPerformedWeights) {
        performedWeight = lastPerformedWeights[ex.exerciseId];
      } else {
        const siblingWeight = resolveSiblingPerformedWeight(
          name,
          lastPerformedWeights,
        );
        if (siblingWeight !== undefined) performedWeight = siblingWeight;
      }
      if (performedWeight !== undefined) {
        baseEx = {
          ...ex,
          prescribedWeightKg: performedWeight ?? undefined,
        };
      }
    }

    const increment = ctx.loadIncrementKg ?? DEFAULT_LOAD_INCREMENT_KG;
    return applyDelta(baseEx, delta, increment);
  });

  return {
    ...workout,
    exercises: newExercises,
    updatedAt: now,
    _progressionResults: results,
  };
}

/**
 * Build a StrengthProgressionContext from available schedule state.
 *
 * Assembles context from the same data sources already available
 * in the resolver/builder pipeline. No new stores or services needed.
 *
 * @param seasonPhase      - From ScheduleState
 * @param readiness        - From ScheduleState (default 'medium')
 * @param gameDates        - All game dates in the block
 * @param dateStr          - The date being resolved
 * @param injuries         - From AthleteContext
 * @param markedDays       - Calendar marks for doubleGameWeek detection
 * @param workoutHistory   - From workoutService (passed in, not fetched here)
 */
export function buildProgressionContext(
  seasonPhase: SeasonPhase,
  readiness: ReadinessLevel,
  gameDates: string[],
  dateStr: string,
  injuries: Array<{ bodyArea: string; severity?: string }>,
  markedDays: Record<string, string>,
  workoutHistory: LoggedWorkout[] = [],
  feedbackFeeling?: FeedbackFeeling | null,
  recentFeedback: SessionFeedback[] = [],
  adaptation?: AdaptationResult | null,
  options: BuildProgressionContextOptions = {},
): StrengthProgressionContext {
  // Compute game proximity
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  let daysToGame: number | null = null;
  let daysSinceGame: number | null = null;
  for (const gd of gameDates) {
    const [gy, gm, gdd] = gd.split('-').map(Number);
    const gameDate = new Date(gy, gm - 1, gdd, 12, 0, 0, 0);
    const diffMs = gameDate.getTime() - date.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && (daysToGame === null || diffDays < daysToGame)) {
      daysToGame = diffDays;
    }
    if (diffDays < 0 && (daysSinceGame === null || -diffDays < daysSinceGame)) {
      daysSinceGame = -diffDays;
    }
  }

  // Detect double game week from the week containing dateStr
  const dow = date.getDay();
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(date.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
  let gamesThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    const checkStr = checkDate.toISOString().split('T')[0];
    if (markedDays[checkStr] === 'game') gamesThisWeek++;
  }
  const doubleGameWeek = gamesThisWeek >= 2;

  // Injury avoid flag
  const injuryAvoidFlag = injuries.some(
    i => i.severity && i.severity.toLowerCase() !== 'mild'
  );

  // Determine session feeling: adaptation override > explicit feedback > default
  let sessionFeeling: SessionFeeling = 'Good';
  if (adaptation?.feelingOverride) {
    sessionFeeling = adaptation.feelingOverride;
  } else if (feedbackFeeling) {
    sessionFeeling = feedbackFeelingToSessionFeeling(feedbackFeeling);
  }

  // Determine readiness: start with passed-in, apply adaptation bias
  let adjustedReadiness = readiness;
  if (adaptation) {
    adjustedReadiness = applyReadinessBias(adjustedReadiness, adaptation);
  }

  const historyWeeksSinceDeload = estimateWeeksSinceDeload(workoutHistory);
  const historyBuildWeeks = countConsecutiveBuildWeeks(workoutHistory);
  const weeksSinceDeload = historyWeeksSinceDeload > 0
    ? historyWeeksSinceDeload
    : options.blockState?.weeksSinceDeload ?? DEFAULT_PROGRESSION_CONTEXT.weeksSinceDeload;
  const consecutiveBuildWeeks = historyBuildWeeks > 0
    ? historyBuildWeeks
    : options.blockState?.consecutiveBuildWeeks ?? DEFAULT_PROGRESSION_CONTEXT.consecutiveBuildWeeks;

  const baseCtx: StrengthProgressionContext = {
    seasonPhase,
    readiness: adjustedReadiness,
    daysToGame,
    daysSinceGame,
    doubleGameWeek,
    injuryAvoidFlag,
    sessionFeeling,
    missedSessionsThisWeek: options.missedSessionsThisWeek ?? 0,
    weeksSinceDeload,
    consecutiveBuildWeeks,
    weeksOffTraining: options.weeksOffTraining ?? 0,
    recentDeloadTrigger: options.recentDeloadTrigger ?? null,
    workoutHistory,
    // Explicit adaptation overrides — applied directly in applyStrengthProgression
    adaptationVolumeAdjustment: adaptation?.volumeAdjustment ?? 0,
    adaptationBlockProgression: adaptation?.blockProgression ?? false,
  };

  // Apply feedback pattern biases (single-step adjustments only).
  // Returns unmodified ctx if insufficient feedback data.
  const patternSummary = analyzeFeedbackPatterns(recentFeedback);
  return applyPatternBiases(baseCtx, patternSummary);
}
