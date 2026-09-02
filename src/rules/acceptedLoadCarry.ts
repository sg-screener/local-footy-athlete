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

/** One rebuilt session, given the accepted session on its day and the accepted week. */
export function carryOwnAcceptedLoadsIntoWorkout(args: {
  readonly rebuilt: Workout;
  readonly acceptedSameDay: Workout | null | undefined;
  readonly acceptedWeek: readonly Workout[];
}): Workout {
  let touched = false;
  const exercises = (args.rebuilt.exercises ?? []).map((row) => {
    const own = ownRowOnDay(row, args.acceptedSameDay)
      ?? ownRowInWeek(row, args.acceptedWeek);
    if (!own || own.prescribedWeightKg === row.prescribedWeightKg) return row;
    touched = true;
    return { ...row, prescribedWeightKg: own.prescribedWeightKg };
  });
  return touched ? { ...args.rebuilt, exercises } : args.rebuilt;
}

/** A whole rebuilt week against the accepted week, matched by weekday. */
export function carryOwnAcceptedLoads(args: {
  readonly accepted: readonly Workout[];
  readonly rebuilt: readonly Workout[];
}): Workout[] {
  return args.rebuilt.map((workout) => carryOwnAcceptedLoadsIntoWorkout({
    rebuilt: workout,
    acceptedSameDay: args.accepted.find((old) => old.dayOfWeek === workout.dayOfWeek) ?? null,
    acceptedWeek: args.accepted,
  }));
}
