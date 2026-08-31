import type { LoggedSet, Workout, WorkoutExercise } from '../types/domain';
import { getExerciseTags, type MovementPattern } from '../data/exerciseTags';
import { carriesStrengthComponent } from './sessionComponents';
import {
  type OneRepMaxBasis,
  RIR_ESTIMATE_METHOD, selectedTrackedLifts, trackedLiftId,
  type LastSetEstimateInput, type TrackedLiftChoices,
} from '../rules/estimatedOneRepMax';
import type { SessionExecutionItemResult } from './sessionExecutionChecklist';
import { displayReps } from '../rules/prescriptionDisplay';

export type StrengthLogCompletion = 'full' | 'partial' | 'skipped';

export interface StrengthExercisePerformanceLog {
  /** New captures never use legacy prescribed/best-set estimate fallbacks. */
  estimateCaptureVersion?: 1;
  lastSetEstimate?: LastSetEstimateInput;
  exerciseId: string;
  workoutExerciseId: string;
  exerciseName: string;
  prescribedSets: number;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  weightKg?: number | null;
  completion: StrengthLogCompletion;
  /**
   * ACTUAL performance captured from the workout log (real logged sets),
   * when available. Progression prefers these over the prescribed snapshot;
   * both are omitted when the athlete didn't log per-set detail, in which case
   * progression falls back to the prescribed values above.
   */
  /** Number of sets actually logged/completed for this lift. */
  completedSets?: number;
  /** Representative reps actually achieved (conservative — see builder). */
  actualReps?: number;
  /**
   * The real weight-and-reps pair used by the Progress estimate. This remains
   * separate from the conservative progression summary above: pairing its
   * maximum weight with its minimum reps can combine two different sets.
   */
  oneRepMaxBasis?: OneRepMaxBasis;
}

const MAIN_STRENGTH_MOVEMENTS = new Set<MovementPattern>([
  'squat',
  'lunge',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

const CONDITIONING_NAME_RE =
  /conditioning|interval|run|sprint|bike|row|ski|swim|fartlek|tabata|mas|vo2|zone\s*2|warm-up|cool-down/i;

function isMainStrengthExercise(exercise: WorkoutExercise, index: number): boolean {
  const name = exercise.exercise?.name ?? '';
  if (!name) return false;

  // ⚠ A REGISTERED NAME'S ANSWER IS FINAL — the name regex is a fallback for
  // names the registry doesn't know. Asked first, its unbounded `row` matched
  // "Chest-Supported DB Row" and "Barbell Row" as rowing-machine conditioning,
  // so no rowing lift ever recorded a load (measured 2026-08-27 — the same
  // classifier defect as deloadWeekRules.isConditioningExerciseRow, found the
  // same day).
  const tags = getExerciseTags(name);
  if (!tags && CONDITIONING_NAME_RE.test(name)) return false;

  if (tags) {
    if (tags.movement === 'conditioning') return false;
    // ⚠ THIS USED TO ALSO REQUIRE `tags.load !== 'low'`, AND THAT CLAUSE LOST
    // A BEGINNER'S ENTIRE LIFTING HISTORY. "Low load" was standing in for
    // "accessory", but on a beginner program the MAIN lifts are the low-load
    // variants — Goblet Squat is authored `load: 'low'` — so none of their
    // lifts ever entered the feedback logs, the block boundary saw no
    // recorded history, and block 2 re-seeded Goblet Squat at the authored
    // 6kg estimate BELOW the athlete's recorded 12.5 (measured 2026-08-27,
    // Sam's overnight item 6). The movement pattern is the honest test:
    // a squat is a strength lift whatever its authored load rating, and
    // Sam's 2026-08-16 law — "recorded history for the EXACT exercise
    // always outranks the estimate" — needs the history to be recorded.
    return MAIN_STRENGTH_MOVEMENTS.has(tags.movement);
  }

  // Fallback for untagged generated exercises: early multi-set rows are
  // usually the main lifts, while later rows are usually accessories.
  return index < 3 && Number(exercise.prescribedSets) >= 2;
}

function resolvedWeightKg(
  exercise: WorkoutExercise,
  weightOverrides: Record<string, number | null> | undefined,
): number | null | undefined {
  const override = weightOverrides?.[exercise.exerciseId];
  if (override !== undefined) return override;
  const prescribed = Number(exercise.prescribedWeightKg);
  if (Number.isFinite(prescribed) && prescribed > 0) return prescribed;
  return undefined;
}

/**
 * Summarise the real logged sets for one lift into (completedSets, actualReps,
 * topWeightKg). `actualReps` is the MINIMUM reps across logged working sets —
 * a conservative "what they actually held" so one strong set never drives
 * over-progression. Returns null when no usable per-set detail was logged.
 */
function summariseLoggedSets(
  loggedSets: LoggedSet[] | undefined,
): {
  completedSets: number;
  actualReps?: number;
  topWeightKg?: number;
} | null {
  if (!loggedSets || loggedSets.length === 0) return null;
  const repsValues = loggedSets
    .map((s) => (typeof s.actualReps === 'number' ? s.actualReps : undefined))
    .filter((r): r is number => typeof r === 'number' && r > 0);
  const weightValues = loggedSets
    .map((s) => (typeof s.actualWeightKg === 'number' ? s.actualWeightKg : undefined))
    .filter((weight): weight is number => typeof weight === 'number' && weight > 0);
  return {
    completedSets: loggedSets.length,
    actualReps: repsValues.length > 0 ? Math.min(...repsValues) : undefined,
    topWeightKg: weightValues.length > 0 ? Math.max(...weightValues) : undefined,
  };
}

/**
 * Collect the real logged sets for a workout from the workout-log store,
 * keyed by workoutExerciseId, ready to feed `buildStrengthPerformanceLogs`.
 *
 * Only sets belonging to THIS workout's active logging session are trusted
 * (guards against stale sets from a different session). Returns undefined when
 * there is nothing usable — so the caller cleanly falls back to the prescribed
 * snapshot.
 */
export function collectLoggedStrengthSets(
  workout: Workout | null | undefined,
  loggedSets: Map<string, LoggedSet[]> | Record<string, LoggedSet[]> | undefined | null,
  activeWorkoutId?: string | null,
): Record<string, LoggedSet[]> | undefined {
  if (!workout || !loggedSets) return undefined;
  // Stale-session guard: if an active workout is known and it isn't this one,
  // its logged sets don't describe this workout.
  if (activeWorkoutId && activeWorkoutId !== workout.id) return undefined;

  const entries = loggedSets instanceof Map
    ? Array.from(loggedSets.entries())
    : Object.entries(loggedSets);
  const validIds = new Set((workout.exercises ?? []).map((exercise) => exercise.id));

  const record: Record<string, LoggedSet[]> = {};
  for (const [workoutExerciseId, sets] of entries) {
    if (validIds.has(workoutExerciseId) && Array.isArray(sets) && sets.length > 0) {
      record[workoutExerciseId] = sets;
    }
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

export function buildStrengthPerformanceLogs(
  workout: Workout | null | undefined,
  weightOverrides: Record<string, number | null> | undefined,
  completion: StrengthLogCompletion,
  /**
   * Optional real logged sets keyed by workoutExerciseId (from the workout log
   * store). When present, actual completed-set count / reps / top load are
   * captured so progression can prefer them over the prescribed snapshot.
   */
  loggedSetsByWorkoutExerciseId?: Record<string, LoggedSet[]>,
  options?: { readonly bodyWeightKg?: number; readonly lastSetInputs?: readonly LastSetEstimateInput[] },
): StrengthExercisePerformanceLog[] {
  // ── THE GYM WORK IS CREDITED WHEREVER IT FALLS (Sam, 2026-08-20) ──────────
  //
  // *"A gym session completed on the same date as club training counts as a
  // completed gym session ... each completed component keeps its own credit."*
  //
  // THIS LINE USED TO READ `workoutType !== 'Strength' && !== 'Mixed'`, and it
  // is where the athlete's lifts on a club night were LOST. A day whose gym
  // session shares a date with club training is stored as
  // `workoutType: 'Team Training'`, so this returned `[]` — no load, no set
  // count, nothing recorded — while `getSessionComponents` on the same workout
  // reported `["power","strength","team_training"]`. Everything downstream
  // inherited the silence: the completion numerator counts days with strength
  // logs, and there were none, so the athlete read as training half as often as
  // they did, and the block boundary had no loads to progress those lifts from.
  //
  // `carriesStrengthComponent` is the ONE component-aware answer, shared with
  // the denominator so both sides of the ratio count the same sessions.
  if (!carriesStrengthComponent(workout)) {
    return [];
  }

  return (workout.exercises ?? [])
    .filter((exercise, index) => isMainStrengthExercise(exercise, index))
    .map((exercise) => {
      const exerciseName = exercise.exercise?.name ?? exercise.exerciseId;
      const logged = summariseLoggedSets(loggedSetsByWorkoutExerciseId?.[exercise.id]);
      const prescribedWeight = resolvedWeightKg(exercise, weightOverrides);
      return {
        estimateCaptureVersion: 1 as const,
        ...(() => {
          const input = options?.lastSetInputs?.find((entry) =>
            entry.workoutExerciseId === exercise.id && entry.exerciseId === exercise.exerciseId
            && entry.liftId === trackedLiftId(exerciseName));
          return input ? { lastSetEstimate: input } : {};
        })(),
        exerciseId: exercise.exerciseId,
        workoutExerciseId: exercise.id,
        exerciseName,
        prescribedSets: Number(exercise.prescribedSets) || 0,
        prescribedRepsMin: Number(exercise.prescribedRepsMin) || 0,
        prescribedRepsMax: Number(exercise.prescribedRepsMax) || 0,
        // Prefer the real top logged load; fall back to the prescribed snapshot.
        weightKg: logged?.topWeightKg ?? prescribedWeight,
        completion,
        ...(logged ? { completedSets: logged.completedSets } : {}),
        ...(logged?.actualReps !== undefined ? { actualReps: logged.actualReps } : {}),
      };
    });
}

/** Last actually completed working set, including back-offs. Missing detail
 * remains missing; it cannot silently select an earlier, better-documented set. */
export function lastCompletedWorkingSet(sets: readonly LoggedSet[], nonDominant = false): LoggedSet | null {
  return sets.filter((set) => set.kind !== 'warmup' && set.completed !== false
    && (!nonDominant || set.side === 'non_dominant'))
    .reduce<LoggedSet | null>((last, set) => !last || set.setNumber >= last.setNumber ? set : last, null);
}

export function buildLastSetFeedbackInputs(args: {
  date: string;
  workout: Workout | null | undefined;
  choices?: TrackedLiftChoices;
  loggedSets?: Record<string, LoggedSet[]>;
  weightOverrides?: Record<string, number | null>;
  executionItems?: readonly SessionExecutionItemResult[];
  completion: StrengthLogCompletion | null;
  bodyWeightKg?: number;
  existing?: readonly StrengthExercisePerformanceLog[];
}): LastSetEstimateInput[] {
  if (!args.workout || args.completion === 'skipped') return [];
  const selected = new Set(selectedTrackedLifts(args.choices));
  return args.workout.exercises.flatMap((row) => {
    const liftId = trackedLiftId(row.exercise?.name ?? '');
    if (!liftId || !selected.has(liftId)) return [];
    const sets = args.loggedSets?.[row.id] ?? [];
    const anyLast = lastCompletedWorkingSet(sets);
    const tick = args.executionItems?.find((item) => item.itemId === `exercise:${row.id}`);
    // A partial workout is not evidence that every prescribed lift was done.
    const performed = args.executionItems !== undefined
      ? tick?.completed === true
      : anyLast !== null || args.completion === 'full';
    if (!performed) return [];
    const saved = args.existing?.find((entry) => entry.workoutExerciseId === row.id
      && entry.exerciseId === row.exerciseId)?.lastSetEstimate;
    if (saved && saved.liftId === liftId) return [{ ...saved }];
    const prescribedSets = Math.max(1, Number(row.prescribedSets) || 1);
    const sessionWeight = resolvedWeightKg(row, args.weightOverrides);
    return [{
      method: RIR_ESTIMATE_METHOD,
      liftId, exerciseId: row.exerciseId, workoutExerciseId: row.id,
      setId: `${args.date}:${row.id}:last-working-set`,
      setNumber: prescribedSets,
      source: 'athlete_confirmed_last_set' as const,
      actualWeightKg: liftId === 'pull_up' && sessionWeight == null ? 0 : sessionWeight ?? null,
      actualReps: displayReps(row.prescribedRepsMin, row.prescribedRepsMax),
      rir: null, skipped: false,
      ...(liftId === 'bulgarian_split_squat' ? { side: 'non_dominant' as const } : {}),
      ...(liftId === 'pull_up' ? { bodyWeightKg: args.bodyWeightKg ?? null } : {}),
    }];
  });
}
