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
import { slotsFilledByRow } from './sessionSlotCoverage';
import { GLOBAL_RULES } from './weeklyProgrammingContract';

export type WeeklyMovementPlaneException = {
  readonly protocolVersion: 1;
  /**
   * `lower_body_frontal_unavailable` — R-357. `weekly_core_unavailable` — Sam,
   * 2026-09-03: one core row per week; the same honest exception when no
   * strength day can legally take one.
   */
  readonly kind: 'lower_body_frontal_unavailable' | 'weekly_core_unavailable';
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
  // Two completions may each have an exception to disclose on the same week;
  // the second appends to the first, it does not overwrite it.
  const kept = (first.weeklyMovementPlaneExceptions ?? []).filter((existing) => existing.kind !== exception.kind);
  return {
    ...workoutsByDate,
    [firstDate]: { ...first, weeklyMovementPlaneExceptions: [...kept, exception] },
  };
}

function stripExceptionKind(
  workoutsByDate: Readonly<Record<string, Workout>>,
  kind: WeeklyMovementPlaneException['kind'],
): Readonly<Record<string, Workout>> {
  return Object.fromEntries(Object.entries(workoutsByDate).map(([date, workout]) => {
    if (!workout.weeklyMovementPlaneExceptions?.some((exception) => exception.kind === kind)) return [date, workout];
    const remaining = workout.weeklyMovementPlaneExceptions.filter((exception) => exception.kind !== kind);
    return [date, { ...workout, weeklyMovementPlaneExceptions: remaining.length > 0 ? remaining : undefined }];
  }));
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
  const cleaned = stripExceptionKind(args.workoutsByDate, 'lower_body_frontal_unavailable');
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
      decision: assessTapSwapCandidateSafety(entry.name, environment, { route: 'automatic' }),
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

/* ── ONE CORE ROW PER WEEK — Sam, 2026-09-03 ──────────────────────────────────
 *
 * R-087's weekly set ends "… upper accessory · lower accessory · core". The
 * ladders a three-day week composes with (LOWER, UPPER_FULL, the full-body
 * shapes) carry no core seat — only the split-upper ladders do — so a Mon/Wed/
 * Fri athlete never saw trunk work on a strength day. Sam's ruling: guarantee
 * ONE core row per week, not one per lower day. The week is the unit, exactly
 * as R-357 treats the frontal plane: a week that already carries a core row is
 * untouched; otherwise one selector-approved trunk row lands on the strength
 * day with the most room, or the honest exception is written.
 */
export type WeeklyCoreCompletion =
  | { readonly status: 'already_present'; readonly workoutsByDate: Readonly<Record<string, Workout>> }
  | { readonly status: 'added'; readonly workoutsByDate: Readonly<Record<string, Workout>>; readonly dateISO: string;
      readonly exercise: string }
  | { readonly status: 'unavailable'; readonly workoutsByDate: Readonly<Record<string, Workout>>;
      readonly exception: WeeklyMovementPlaneException };

/** The ladder's own vocabulary decides what a core row is — never a name list. */
export function workoutCarriesCoreRow(workout: Workout): boolean {
  return (workout.exercises ?? []).some((row) => slotsFilledByRow(row).includes('core'));
}

function strengthRowCount(workout: Workout): number {
  return (workout.exercises ?? []).filter((row) => row.section18Evidence?.role !== 'conditioning').length;
}

export function completeWeeklyCore(args: {
  readonly weekStartISO: string;
  readonly workoutsByDate: Readonly<Record<string, Workout>>;
  readonly profile: OnboardingData;
  readonly activeConstraints?: readonly ActiveConstraint[];
  readonly gameDates?: readonly string[];
  /** R-354: dates before this are history and may not receive the row. */
  readonly placeableFromISO?: string;
}): WeeklyCoreCompletion {
  const cleaned = stripExceptionKind(args.workoutsByDate, 'weekly_core_unavailable');
  const workouts = Object.values(cleaned);
  if (workouts.some(workoutCarriesCoreRow)) return { status: 'already_present', workoutsByDate: cleaned };

  // The same day order as the frontal completion (a lower day first, then by
  // date) — the Bible seats midline after the accessories on any strength
  // day; a day already at WC-048's seven-movement ceiling is skipped so the
  // row never pushes a session past it.
  const dates = existingStrengthDates(cleaned)
    .filter(([dateISO]) => !args.placeableFromISO || dateISO >= args.placeableFromISO)
    .filter(([, workout]) => strengthRowCount(workout) < GLOBAL_RULES.dailyMovementCeiling);
  const considered = POOL_REGISTRY.trunk_anti_rotation.map((entry) => entry.name);
  if (dates.length === 0) {
    const exception: WeeklyMovementPlaneException = {
      protocolVersion: 1,
      kind: 'weekly_core_unavailable',
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
    POOL_REGISTRY.trunk_anti_rotation,
    `weekly-core:${args.weekStartISO}`,
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
      decision: assessTapSwapCandidateSafety(entry.name, environment, { route: 'automatic' }),
    }));
    const safe = decisions.filter(({ decision }) => decision.safe).map(({ entry }) => entry);
    const dayKind = workout.composedDayShape ?? null;
    const selectorEligibleExercises = safe.filter((entry) => selector.canUse({
      identity: entry.name,
      requestedSlot: 'core',
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
      requestedSlot: 'core',
      dayKind,
      requestedAsMain: false,
    });
    if (!choice) continue;
    const entry = safe.find((candidate) =>
      canonicalExerciseName(candidate.name) === canonicalExerciseName(choice.identity)) as PoolExercise;
    selector.accept(choice);
    // The Bible's session order: midline sits after the accessories and before
    // the finisher. Appending after an attached conditioning row put the core
    // row LAST at generation and before the finisher after a fixture repair
    // re-sorted the session (measured: the slice's move-back cell), so the
    // row goes in before the first conditioning row and the order is renumbered.
    const finisherAt = workout.exercises.findIndex((exercise) => exercise.section18Evidence?.role === 'conditioning');
    const at = finisherAt < 0 ? workout.exercises.length : finisherAt;
    const row = buildAutomaticStrengthSupportRow(entry, workout.id, at + 1, 'core');
    const exercises = [...workout.exercises.slice(0, at), row, ...workout.exercises.slice(at)]
      .map((exercise, index) => exercise.exerciseOrder === index + 1 ? exercise : { ...exercise, exerciseOrder: index + 1 });
    return {
      status: 'added',
      workoutsByDate: { ...cleaned, [dateISO]: { ...workout, exercises } },
      dateISO,
      exercise: entry.name,
    };
  }

  const exception: WeeklyMovementPlaneException = {
    protocolVersion: 1,
    kind: 'weekly_core_unavailable',
    weekStartISO: args.weekStartISO,
    reason: 'no_safe_legal_unused_exercise',
    consideredExercises: considered,
    consideredDates,
  };
  return { status: 'unavailable', workoutsByDate: withException(cleaned, exception), exception };
}
