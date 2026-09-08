/** Historical log adapters and legacy exercise eligibility.
 * Active dose decisions belong to blockBoundaryProgression and its canonical compiler.
 * R-380 removed the per-session writer; its diagnostic model lives under __tests__. */
import type {
  Workout,
  WorkoutExercise,
  SeasonPhase,
  CapacityBand,
  SessionFeeling,
  LoggedWorkout,
  LoggedSet,
} from '../types/domain';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import type { ExerciseRole } from './progressionHelpers';
import type { FeedbackCompletion, FeedbackFeeling, SessionFeedback } from '../store/programStore';
import type { AdaptationResult } from './feedbackAdapter';
import type { ProgramBlockState } from './programBlockState';
import { participatesInCounting } from '../rules/sessionRowCounting';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';

// ─── Feedback → Domain Feeling Bridge ───

/**
 * Map the UI FeedbackFeeling to the domain SessionFeeling used by progression.
 *
 *   very_easy → Strong  (felt easy = body is strong / well-recovered)
 *   easy      → Good    (comfortable effort)
 *   good      → Average (neutral / appropriate difficulty = repeat)
 *   hard      → Average (effort does not imply soreness)
 *   very_hard → Cooked  (smashed / needs recovery)
 */
const FEEDBACK_TO_SESSION_FEELING: Record<FeedbackFeeling, SessionFeeling> = {
  very_easy: 'Strong',
  easy: 'Good',
  good: 'Average',
  hard: 'Average',
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

/**
 * Is this feedback for a session that actually contained gym strength work?
 *
 * Used to keep strength progression / miss detection from counting team
 * training or conditioning-only sessions as gym strength (Bible: "team
 * training completion does not imply gym strength completion").
 *
 * Rules:
 *   • has an explicit 'strength' component → yes
 *   • carries a strength performance snapshot → yes
 *   • has components but NONE is strength (e.g. team / conditioning only) → no
 *   • legacy feedback with no components → yes (backward compatible)
 */
function isStrengthSessionFeedback(feedback: SessionFeedback): boolean {
  if ((feedback.strength?.length ?? 0) > 0) return true;
  const components = feedback.components;
  if (components && components.length > 0) {
    return components.some((component) => component.kind === 'strength');
  }
  return true; // no component breakdown → treat as strength (legacy behaviour)
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
    // Prefer REAL logged data (actual completed-set count / reps) when the
    // snapshot carries it; otherwise fall back to the prescribed-derived
    // approximation from the feedback completion.
    const setCount = typeof lift.completedSets === 'number'
      ? Math.max(0, Math.floor(lift.completedSets))
      : completedSetCount(completion, lift.prescribedSets);
    const reps = typeof lift.actualReps === 'number' && lift.actualReps > 0
      ? lift.actualReps
      : Math.max(1, lift.prescribedRepsMax || lift.prescribedRepsMin || 1);
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
    isStrengthSessionFeedback(feedback) &&
    strengthCompletion(feedback) === 'skipped'
  )).length;
}

export function buildStrengthWorkoutHistoryFromFeedback(
  feedbackMap: Record<string, SessionFeedback>,
  beforeDate: string,
): LoggedWorkout[] {
  return Object.values(feedbackMap)
    .filter((feedback) => feedback.dateStr < beforeDate)
    .filter((feedback) => isStrengthSessionFeedback(feedback))
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
  /**
   * The off-season subphase, when the phase clock has resolved one.
   *
   * READ for one purpose: to resolve the same authored dose band generation
   * used, so progression is bounded by the row's own band rather than by the
   * generic off-season one. It matters — `early_offseason` authors a maximum
   * of THREE sets where plain off-season allows four, and it is the default
   * the subphase resolver falls back to when phase-clock context is missing.
   * WRITTEN by `buildProgressionContext` from the caller's phase clock.
   */
  offseasonSubphase?: OffseasonSubphase | null;
  capacity: CapacityBand;
  /**
   * Recent fatigue patterns — the vote the feedback biases used to cast by
   * writing 'low' into `capacity` above. See `ProgressionInput` for why it has
   * its own name (Sam, 2026-08-13, the readiness homonym).
   */
  recentFatiguePattern: boolean;
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
  capacity: 'medium',
  // No history means no fatigue evidence — NOT "assume fatigued". The default
  // must be the absence of the signal, or every historyless athlete carries a
  // free soft-deload vote.
  recentFatiguePattern: false,
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
};

export interface BuildProgressionContextOptions {
  blockState?:
    & Pick<ProgramBlockState, 'weekInBlock' | 'weeksSinceDeload' | 'consecutiveBuildWeeks'>
    // `phaseResolution` is read for its `offseasonSubphase` alone — the
    // authored dose band differs inside off-season, and the phase CLOCK is the
    // ruled owner of that answer. Both live producers
    // (`getProgramBlockStateForDate`, `getStoredBlockStateForDate`) already
    // return it, so progression reads the clock's answer rather than deriving
    // a second one. OPTIONAL, because a caller assembling a partial block
    // state is not obliged to answer a question about the season clock — it
    // then falls back to the phase's own band, which is what shipped before.
    & Partial<Pick<ProgramBlockState, 'phaseResolution'>>;
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
 * Whether an exercise may receive load/volume progression, and at which tier.
 *
 * Returns null for exercises that should not progress (accessories, trunk,
 * isolation, pump, conditioning, untagged).
 *
 * RENAMED from `classifyExerciseRole` (Sam, 2026-07-28) to end a homonym:
 * `sessionRoles.classifyExerciseRole` answers "what KIND of work is this row"
 * with the six-member `SessionRole` vocabulary, and this one answers "may this
 * row progress" with primary/secondary/null. Two exported functions with the
 * same name and disjoint return vocabularies is an import waiting to go to the
 * wrong place. `sessionRowCountingTests` still asserts the two vocabularies are
 * disjoint, so a future merge stays loud.
 */
export function classifyProgressionEligibility(exerciseName: string): ExerciseRole | null {
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

/**
 * A row must opt into strength progression by both exercise type and compiler
 * route. Shoulder prehab can contain a low-load press, but its authored purpose
 * is joint control rather than progressive strength overload; reading only the
 * display name turned that typed prehab row into an ordinary secondary lift.
 */
export function rowCanReceiveStrengthProgression(exercise: WorkoutExercise): boolean {
  if (!participatesInCounting(exercise)) return false;
  if (exercise.section18Evidence?.slot === 'shoulder_prehab') return false;
  return classifyProgressionEligibility(exercise.exercise?.name || '') !== null;
}

export function workoutHasProgressableStrengthRows(workout: Workout): boolean {
  if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') {
    return false;
  }
  return workout.exercises.some(rowCanReceiveStrengthProgression);
}

/**
 * Determine if an exercise is lower body from its tags.
 */
export function isLowerBodyExercise(exerciseName: string): boolean {
  const tags = EXERCISE_TAGS[exerciseName];
  if (!tags) return false;
  return tags.region === 'lower';
}
