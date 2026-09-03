/**
 * WHICH STRENGTH DAY A FIXTURE REPAIR ADDS — Sam, 2026-09-03.
 *
 * When a fixture change frees a day and the week's main-strength target is one
 * short, the fixture repair adds one strength day from the compiler's target
 * week. Until 2026-09-03 it took the target's FIRST strength day, whatever the
 * accepted week already covered: a four-day athlete whose Saturday game moved
 * to Sunday kept Monday's combined lower (squat + hinge) and gained Friday as
 * a second squat day with the same lifts — two squats, one hinge, Leg Press
 * twice (cohort F004, weeks 29/41/47). R-087 orders the week's slots
 * "uncovered first, then repeat freely"; R-089 pairs every squat with a hinge
 * and every single-leg knee with a single-leg hip; R-317/R-318 spend each
 * identity once a week. This owner ranks the target's strength days by those
 * three rules, in that order, and names the missing purpose.
 *
 * Pure over its arguments: the accepted strength days' typed patterns and the
 * target days' typed patterns. No store, no clock.
 */
import type { Workout } from '../types/domain';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';

/** Sam's counted pairs (R-089): a squat is matched with a hinge, a single-leg knee with a single-leg hip; push with pull. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['squat', 'hinge'],
  ['single_leg_knee', 'single_leg_hip'],
  ['push', 'pull'],
];

function plannedPatternsOf(workout: Workout): readonly string[] {
  return workout.strengthIntent?.plannedPatterns ?? [];
}

function countPatterns(workouts: readonly Workout[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const workout of workouts) {
    for (const pattern of plannedPatternsOf(workout)) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return counts;
}

function pairingImbalance(counts: ReadonlyMap<string, number>): number {
  return PAIRS.reduce((total, [left, right]) =>
    total + Math.abs((counts.get(left) ?? 0) - (counts.get(right) ?? 0)), 0);
}

export interface StrengthTemplateRank {
  readonly index: number;
  readonly workout: Workout;
  /** Patterns this template would bring that the accepted week does not cover yet. */
  readonly uncovered: readonly string[];
  /** Sam's pairing imbalance AFTER adding this template (0 = every pair matched). */
  readonly imbalance: number;
  /** Patterns this template repeats that the accepted week already holds. */
  readonly repeated: readonly string[];
}

/**
 * Rank candidate strength days for the week's missing purpose. Order:
 * 1. the most uncovered patterns (R-087: "slots the week has not covered go first");
 * 2. the smallest pairing imbalance after the add (R-089: a squat with a hinge,
 *    a single-leg knee with a single-leg hip);
 * 3. the fewest repeated patterns (R-087: "then repeat freely", but as little
 *    as the week needs);
 * 4. the target's own order.
 */
export function rankStrengthTemplatesForWeek(
  accepted: readonly Workout[],
  candidates: readonly Workout[],
): StrengthTemplateRank[] {
  const acceptedCounts = countPatterns(accepted);
  const ranked = candidates.map((workout, index) => {
    const patterns = plannedPatternsOf(workout);
    const uncovered = patterns.filter((pattern) => !acceptedCounts.has(pattern));
    const repeated = patterns.filter((pattern) => acceptedCounts.has(pattern));
    const after = new Map(acceptedCounts);
    for (const pattern of patterns) after.set(pattern, (after.get(pattern) ?? 0) + 1);
    return { index, workout, uncovered, imbalance: pairingImbalance(after), repeated };
  });
  return ranked.sort((left, right) =>
    right.uncovered.length - left.uncovered.length
    || left.imbalance - right.imbalance
    || left.repeated.length - right.repeated.length
    || left.index - right.index);
}

/** Main and accessory strength identities the accepted week already spends (R-318: once per week). */
export function acceptedStrengthIdentities(accepted: readonly Workout[]): ReadonlySet<string> {
  const identities = new Set<string>();
  for (const workout of accepted) {
    for (const row of workout.exercises ?? []) {
      const role = row.section18Evidence?.role;
      if (role !== 'main_strength' && role !== 'strength_accessory') continue;
      const name = row.exercise?.name;
      if (name) identities.add(canonicalExerciseName(name));
    }
  }
  return identities;
}

/* ── R-317/R-318 ON THE ADDED DAY: AN IDENTITY THE WEEK ALREADY SPENDS IS RE-SELECTED ──
 *
 * The chosen template is a copy of a compiler day, so its lifts may already
 * stand on the accepted days (Leg Press on Monday AND on the added Friday).
 * Each repeated main or accessory identity is re-selected through the same
 * weekly selector and safety gate composition uses, from the same pool as its
 * seat; a seat with no legal unused lift keeps its row and is reported.
 */
import { STRENGTH_POOLS, patternToSlot, type PoolSlotKey } from '../data/exercisePoolsStrength';
import { findOrCreateExercise } from '../data/defaultProgram';
import { getExerciseTags } from '../data/exerciseTags';
import type { OnboardingData, WorkoutExercise } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import type { SessionSlot } from './sessionSlotCoverage';
import {
  createAutomaticWeeklyExerciseSelector,
  workoutExerciseWasAutomaticallySelected,
} from './automaticWeeklyExerciseSelection';
import { assessTapSwapCandidateSafety, resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { loadForReplacementExercise } from './blockBoundaryProgression';

/** The pool a seat draws from; single-leg seats draw the bilateral pool's unilateral accessories. */
function poolKeyForSeat(slot: string | undefined, exerciseName: string): PoolSlotKey | null {
  if (slot === 'single_leg_knee') return 'squat';
  if (slot === 'single_leg_hip') return 'hinge';
  if (slot && slot in STRENGTH_POOLS) return slot as PoolSlotKey;
  const movement = getExerciseTags(exerciseName)?.movement;
  return movement ? patternToSlot(movement) : null;
}

export interface RepeatedIdentityReselection {
  readonly workout: Workout;
  readonly replaced: ReadonlyArray<{ readonly from: string; readonly to: string; readonly slot: string }>;
  readonly unresolved: readonly string[];
}

export function reselectRepeatedStrengthIdentities(args: {
  readonly template: Workout;
  readonly accepted: readonly Workout[];
  readonly dateISO: string;
  readonly profile: OnboardingData;
  readonly activeConstraints?: readonly ActiveConstraint[];
  readonly gameDates?: readonly string[];
}): RepeatedIdentityReselection {
  const spent = acceptedStrengthIdentities(args.accepted);
  const isStrengthRow = (row: WorkoutExercise) =>
    row.section18Evidence?.role === 'main_strength' || row.section18Evidence?.role === 'strength_accessory';
  const nameOf = (row: WorkoutExercise) => canonicalExerciseName(row.exercise?.name ?? '');
  const repeated = (args.template.exercises ?? []).filter((row) => isStrengthRow(row) && spent.has(nameOf(row)));
  if (repeated.length === 0) return { workout: args.template, replaced: [], unresolved: [] };

  const selector = createAutomaticWeeklyExerciseSelector([
    ...args.accepted.flatMap((workout) => (workout.exercises ?? [])
      .filter(workoutExerciseWasAutomaticallySelected)
      .map((row) => row.exercise?.name ?? '')),
    ...(args.template.exercises ?? [])
      .filter((row) => isStrengthRow(row) && !spent.has(nameOf(row)))
      .map((row) => row.exercise?.name ?? ''),
  ].filter(Boolean));
  const environment = resolveTapSwapEnvironment({
    date: args.dateISO,
    profile: args.profile,
    activeConstraints: [...(args.activeConstraints ?? [])],
    gameDates: args.gameDates,
  });
  const dayKind = args.template.composedDayShape ?? null;
  const replaced: Array<{ from: string; to: string; slot: string }> = [];
  const unresolved: string[] = [];
  let exercises = [...(args.template.exercises ?? [])];
  for (const row of repeated) {
    const from = row.exercise?.name ?? '';
    const slot = row.section18Evidence?.slot;
    const poolKey = poolKeyForSeat(slot, from);
    if (!poolKey) { unresolved.push(from); continue; }
    const pool = STRENGTH_POOLS[poolKey];
    const onDay = new Set(exercises.map(nameOf));
    const candidates = [...pool.anchor.entries, ...pool.accessory.entries]
      .map((entry) => entry.name)
      .filter((name) => !spent.has(canonicalExerciseName(name)) && !onDay.has(canonicalExerciseName(name)))
      .filter((name) => assessTapSwapCandidateSafety(name, environment, { sourceExercise: from }).safe);
    const choice = selector.chooseFallback({
      sameCategory: candidates,
      accessories: [],
      prehab: [],
      requestedSlot: (slot ?? poolKey) as SessionSlot,
      dayKind,
      // R-317: a spent weekly main seat is never re-spent — "later compatible
      // work is typed support rather than another main lift". The replacement
      // is asked for as support, and a replaced main row becomes typed support.
      requestedAsMain: false,
    });
    if (!choice) { unresolved.push(from); continue; }
    selector.accept(choice);
    const exercise = findOrCreateExercise(choice.identity);
    const weight = loadForReplacementExercise({ exerciseName: choice.identity, onboardingData: args.profile });
    exercises = exercises.map((candidate) => candidate !== row ? candidate : {
      ...row,
      exerciseId: exercise.id,
      exercise: { ...exercise },
      ...(weight !== undefined ? { prescribedWeightKg: weight } : {}),
      ...(row.section18Evidence
        ? { section18Evidence: { ...row.section18Evidence, role: 'strength_accessory' as const, mainStrengthPattern: null } }
        : {}),
    });
    replaced.push({ from, to: choice.identity, slot: String(slot ?? poolKey) });
  }
  return { workout: { ...args.template, exercises }, replaced, unresolved };
}
