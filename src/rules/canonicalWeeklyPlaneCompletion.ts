/** Final weekly movement-plane completion through the canonical selector. */
import { POOL_REGISTRY, type PoolExercise } from '../data/exercisePools';
import type { OnboardingData, Workout } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { buildAutomaticStrengthSupportRow } from '../utils/sessionBuilder';
import {
  assessTapSwapCandidateSafety,
  resolveTapSwapEnvironment,
} from '../utils/tapSwapHierarchy';
import {
  createAutomaticWeeklyExerciseSelector,
  workoutExerciseWasAutomaticallySelected,
} from './automaticWeeklyExerciseSelection';
import { exerciseSuppliesLowerBodyFrontal } from './movementPlaneProgramming';
import { isPowerRow } from './sessionRowCounting';
import { stableDecisionOrder } from './stableDecisionDiversity';

export type WeeklyMovementPlaneException = {
  readonly protocolVersion: 1;
  readonly kind: 'lower_body_frontal_unavailable';
  readonly weekStartISO: string;
  readonly reason:
    | 'no_existing_strength_session'
    | 'no_safe_legal_unused_exercise';
  readonly consideredExercises: readonly string[];
  readonly consideredDates: readonly {
    readonly dateISO: string;
    readonly safeExercises: readonly string[];
    readonly selectorEligibleExercises: readonly string[];
    readonly rejected: readonly { readonly exercise: string; readonly reason: string }[];
  }[];
};

export type WeeklyLowerFrontalCompletion =
  | { readonly status: 'already_present'; readonly workoutsByDate: Readonly<Record<string, Workout>> }
  | { readonly status: 'added'; readonly workoutsByDate: Readonly<Record<string, Workout>>; readonly dateISO: string;
      readonly exercise: string }
  | { readonly status: 'unavailable'; readonly workoutsByDate: Readonly<Record<string, Workout>>;
      readonly exception: WeeklyMovementPlaneException };

function automaticRows(workouts: readonly Workout[]) {
  return workouts.flatMap((workout) => workout.exercises
    .filter(workoutExerciseWasAutomaticallySelected));
}

function hasMeaningfulLowerFrontal(workouts: readonly Workout[]): boolean {
  return automaticRows(workouts).some((row) => exerciseSuppliesLowerBodyFrontal(
    row.exercise?.name ?? '', isPowerRow(row) ? 'power' : 'strength',
  ));
}

function isLowerStrengthSession(workout: Workout): boolean {
  const patterns = workout.strengthIntent?.effectivePatterns ?? [];
  return patterns.some((pattern) => pattern === 'squat' || pattern === 'hinge'
    || pattern === 'single_leg_knee' || pattern === 'single_leg_hip');
}

function existingStrengthDates(
  workoutsByDate: Readonly<Record<string, Workout>>,
): Array<readonly [string, Workout]> {
  return Object.entries(workoutsByDate)
    .filter(([, workout]) => {
      if (workout.workoutType === 'Game' || workout.workoutType === 'Rest'
        || workout.workoutType === 'Recovery') return false;
      const components = getSessionComponentRows(workout);
      return components.strengthRows.length > 0 || isLowerStrengthSession(workout);
    })
    .sort(([leftDate, left], [rightDate, right]) =>
      Number(!isLowerStrengthSession(left)) - Number(!isLowerStrengthSession(right))
      || leftDate.localeCompare(rightDate));
}

function withException(
  workoutsByDate: Readonly<Record<string, Workout>>,
  exception: WeeklyMovementPlaneException,
): Readonly<Record<string, Workout>> {
  const entries = Object.entries(workoutsByDate).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return workoutsByDate;
  // Anchor-only Team Training/Game rows are rebuilt from calendar facts and do
  // not own compiler disclosures. Keep the exception on the first existing
  // strength session so composition, save and restart carry it together.
  const [firstDate, first] = existingStrengthDates(workoutsByDate)[0] ?? entries[0];
  return {
    ...workoutsByDate,
    [firstDate]: { ...first, weeklyMovementPlaneExceptions: [exception] },
  };
}

/**
 * Completes the FINAL generated week, after fixture and source-fact repair.
 * It never creates a day and never bypasses the weekly selector or safety gate.
 */
export function completeWeeklyLowerBodyFrontal(args: {
  readonly weekStartISO: string;
  readonly workoutsByDate: Readonly<Record<string, Workout>>;
  readonly profile: OnboardingData;
  readonly activeConstraints?: readonly ActiveConstraint[];
  readonly gameDates?: readonly string[];
  /**
   * R-354: days before this date are HISTORY (already done relative to the
   * report that triggered this completion) and may not receive the row. The
   * injury week fold skips them per stage; this pass walked every strength
   * date and put a Copenhagen plank on a Monday the athlete had already done.
   */
  readonly placeableFromISO?: string;
}): WeeklyLowerFrontalCompletion {
  const cleaned = Object.fromEntries(Object.entries(args.workoutsByDate).map(([date, workout]) => [
    date,
    workout.weeklyMovementPlaneExceptions
      ? { ...workout, weeklyMovementPlaneExceptions: undefined }
      : workout,
  ]));
  const workouts = Object.values(cleaned);
  if (hasMeaningfulLowerFrontal(workouts)) return { status: 'already_present', workoutsByDate: cleaned };

  const dates = existingStrengthDates(cleaned).filter(([dateISO]) =>
    !args.placeableFromISO || dateISO >= args.placeableFromISO);
  const considered = POOL_REGISTRY.groin_adductors.map((entry) => entry.name);
  if (dates.length === 0) {
    const exception: WeeklyMovementPlaneException = {
      protocolVersion: 1,
      kind: 'lower_body_frontal_unavailable',
      weekStartISO: args.weekStartISO,
      reason: 'no_existing_strength_session',
      consideredExercises: considered,
      consideredDates: [],
    };
    return { status: 'unavailable', workoutsByDate: withException(cleaned, exception), exception };
  }

  const selector = createAutomaticWeeklyExerciseSelector(automaticRows(workouts)
    .map((row) => row.exercise?.name ?? '').filter(Boolean));
  const rotated = stableDecisionOrder(
    POOL_REGISTRY.groin_adductors,
    `weekly-lower-frontal:${args.weekStartISO}`,
    (entry) => canonicalExerciseName(entry.name),
  );
  const consideredDates: Array<{
    dateISO: string;
    safeExercises: string[];
    selectorEligibleExercises: string[];
    rejected: Array<{ exercise: string; reason: string }>;
  }> = [];
  for (const [dateISO, workout] of dates) {
    const environment = resolveTapSwapEnvironment({
      date: dateISO,
      profile: args.profile,
      activeConstraints: args.activeConstraints ?? [],
      gameDates: args.gameDates,
    });
    const decisions = rotated.map((entry) => ({
      entry,
      decision: assessTapSwapCandidateSafety(entry.name, environment),
    }));
    const safe = decisions.filter(({ decision }) => decision.safe).map(({ entry }) => entry);
    // The completed session keeps its dedicated purpose: a frontal lunge may
    // not be appended to a Lower Hinge, so the selector is asked with the
    // day's composed shape and moves on to the next existing session instead.
    const dayKind = workout.composedDayShape ?? null;
    const selectorEligibleExercises = safe.filter((entry) => selector.canUse({
      identity: entry.name,
      requestedSlot: 'football_robustness',
      dayKind,
      route: 'strength',
      requestedAsMain: false,
    })).map((entry) => entry.name);
    consideredDates.push({
      dateISO,
      safeExercises: safe.map((entry) => entry.name),
      selectorEligibleExercises,
      rejected: decisions.filter(({ decision }) => !decision.safe).map(({ entry, decision }) => ({
        exercise: entry.name,
        reason: decision.reason,
      })),
    });
    const choice = selector.chooseFallback({
      sameCategory: safe.map((entry) => entry.name),
      accessories: [],
      prehab: [],
      requestedSlot: 'football_robustness',
      dayKind,
      requestedAsMain: false,
    });
    if (!choice) continue;
    const entry = safe.find((candidate) =>
      canonicalExerciseName(candidate.name) === canonicalExerciseName(choice.identity)) as PoolExercise;
    selector.accept(choice);
    const row = buildAutomaticStrengthSupportRow(
      entry,
      workout.id,
      Math.max(-1, ...workout.exercises.map((exercise) => exercise.exerciseOrder)) + 1,
      'football_robustness',
    );
    const completed = { ...cleaned, [dateISO]: { ...workout, exercises: [...workout.exercises, row] } };
    return {
      status: 'added',
      workoutsByDate: completed,
      dateISO,
      exercise: entry.name,
    };
  }

  const exception: WeeklyMovementPlaneException = {
    protocolVersion: 1,
    kind: 'lower_body_frontal_unavailable',
    weekStartISO: args.weekStartISO,
    reason: 'no_safe_legal_unused_exercise',
    consideredExercises: considered,
    consideredDates,
  };
  return { status: 'unavailable', workoutsByDate: withException(cleaned, exception), exception };
}
