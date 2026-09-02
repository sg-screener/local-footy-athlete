/**
 * THE SAME LIFT'S OWN ACCEPTED LOAD, CARRIED INTO A REBUILT WEEK.
 *
 * R-344 (Sam, 2026-09-02). A week rebuilt by a one-week stub — a bye, the
 * week after a moved game, a readiness reduction — is regenerated without the
 * block's progression, so its rows carry the compiler's STARTING estimate
 * (or nothing at all for a bodyweight lift). Measured on the 52-week year:
 * every bye week and every week after a Sunday game showed Back Squat 95 /
 * Bench 80 / RDL 77.5 — the onboarding guess — against the athlete's accepted
 * 100 / 85 / 82.5, and a weighted Pull-Up read "BW". The athlete then logged
 * the lower numbers and the next boundary progressed from those.
 *
 * R-096 clause 1: the exact exercise's own recorded number outranks the
 * estimate. This is that clause applied at the rebuild, with ONE owner:
 * `canonicalWeeklySourceFactCompiler` (readiness, R-034) and the fixture
 * projection both read it, so the two rebuild doors cannot drift.
 *
 * WHAT IT CARRIES, AND WHAT IT LEAVES:
 *   · a row whose SAME lift (name + role) sits on the same accepted day —
 *     by id, else as the day's only such row — takes that row's load;
 *   · else a lift that MOVED days takes the week's load when the accepted
 *     week has exactly one load for it;
 *   · a lift the accepted week never carried keeps the compiler's own load
 *     (R-096 clause 5: nothing is ever seeded from an outgoing exercise);
 *   · an ambiguous match (two accepted loads for one lift) leaves the row
 *     alone rather than guessing.
 * The carried value is the accepted row's own, blank included — an accepted
 * blank is the athlete's choice and stays theirs.
 */
import type { Workout, WorkoutExercise } from '../types/domain';
import {
  automaticExerciseRouteForIdentity,
  workoutExerciseWasAutomaticallySelected,
} from './automaticWeeklyExerciseSelection';

/**
 * Item 1 (Sam, 2026-09-02): the accepted week's automatic STRENGTH identities
 * by weekday, for a one-week rebuild's composer. Power, mobility and prehab
 * rows are outside the once-per-week rule and are not listed.
 */
export function acceptedAutomaticIdentitiesByDay(
  accepted: readonly Workout[],
): Readonly<Record<number, readonly string[]>> {
  const byDay: Record<number, string[]> = {};
  for (const workout of accepted) {
    for (const row of workout.exercises ?? []) {
      const name = row.exercise?.name;
      if (!name || !workoutExerciseWasAutomaticallySelected(row)) continue;
      // Power rows are chosen by the block power selection, not the strength
      // ledger, and sit outside the once-per-week rule.
      if (row.role === 'power' || row.section18Evidence?.role === 'power') continue;
      // A MAIN lift follows the block's recorded seat and may land on a
      // different weekday when the week reshapes (a Sunday game turns Monday
      // into recovery and the squat moves to Wednesday). Listing it would
      // block the athlete's own squat on the rebuilt day; the once-per-week
      // rule for mains is the block record's, not this seed's.
      if (row.section18Evidence?.role === 'main_strength') continue;
      if (automaticExerciseRouteForIdentity(name) !== 'strength') continue;
      (byDay[workout.dayOfWeek] ??= []).push(name);
    }
  }
  return byDay;
}

function liftKey(row: WorkoutExercise): string | null {
  const name = row.exercise?.name;
  if (!name) return null;
  return `${name}|${row.section18Evidence?.role ?? ''}`;
}

function ownRowOnDay(
  row: WorkoutExercise,
  accepted: Workout | null | undefined,
): WorkoutExercise | undefined {
  if (!accepted) return undefined;
  const key = liftKey(row);
  if (!key) return undefined;
  const matches = (accepted.exercises ?? []).filter((old) => liftKey(old) === key);
  return matches.find((old) => old.id === row.id)
    ?? (matches.length === 1 ? matches[0] : undefined);
}

function ownRowInWeek(
  row: WorkoutExercise,
  acceptedWeek: readonly Workout[],
): WorkoutExercise | undefined {
  const key = liftKey(row);
  if (!key) return undefined;
  const matches = acceptedWeek
    .flatMap((workout) => workout.exercises ?? [])
    .filter((old) => liftKey(old) === key);
  if (matches.length === 0) return undefined;
  const loads = new Set(matches.map((old) => old.prescribedWeightKg ?? null));
  return loads.size === 1 ? matches[0] : undefined;
}

/**
 * WHAT A DOOR CARRIES. `'loads'` is the readiness reduction (R-034: the reduced
 * dose is the compiler's, only the load is the athlete's). `'loads_and_dose'`
 * is the fixture rebuild (Sam, 2026-09-02, item 1): a bye or a moved game is
 * not a lighter week, so the same lift keeps its accepted sets and reps too —
 * the earned extra set, the very-hard-block reduction, the in-block wave.
 */
export type AcceptedCarry = 'loads' | 'loads_and_dose';

/** One rebuilt session, given the accepted session on its day and the accepted week. */
export function carryOwnAcceptedLoadsIntoWorkout(args: {
  readonly rebuilt: Workout;
  readonly acceptedSameDay: Workout | null | undefined;
  readonly acceptedWeek: readonly Workout[];
  readonly carry?: AcceptedCarry;
}): Workout {
  const carry = args.carry ?? 'loads';
  let touched = false;
  const exercises = (args.rebuilt.exercises ?? []).map((row) => {
    const own = ownRowOnDay(row, args.acceptedSameDay)
      ?? ownRowInWeek(row, args.acceptedWeek);
    if (!own) return row;
    const next = { ...row, prescribedWeightKg: own.prescribedWeightKg };
    if (carry === 'loads_and_dose') {
      next.prescribedSets = own.prescribedSets;
      next.prescribedRepsMin = own.prescribedRepsMin;
      next.prescribedRepsMax = own.prescribedRepsMax;
    }
    const same = next.prescribedWeightKg === row.prescribedWeightKg
      && next.prescribedSets === row.prescribedSets
      && next.prescribedRepsMin === row.prescribedRepsMin
      && next.prescribedRepsMax === row.prescribedRepsMax;
    if (same) return row;
    touched = true;
    return next;
  });
  return touched ? { ...args.rebuilt, exercises } : args.rebuilt;
}

/** A whole rebuilt week against the accepted week, matched by weekday. */
export function carryOwnAcceptedLoads(args: {
  readonly accepted: readonly Workout[];
  readonly rebuilt: readonly Workout[];
  readonly carry?: AcceptedCarry;
}): Workout[] {
  return args.rebuilt.map((workout) => carryOwnAcceptedLoadsIntoWorkout({
    rebuilt: workout,
    acceptedSameDay: args.accepted.find((old) => old.dayOfWeek === workout.dayOfWeek) ?? null,
    acceptedWeek: args.accepted,
    carry: args.carry,
  }));
}
