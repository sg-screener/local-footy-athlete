/** Final-workout athlete-edit projection owned by the canonical compiler. */
import type { UserRemovalConstraint, Workout } from '../types/domain';
import {
  canonicalWeeklyAthleteEditStateFrom,
  type CanonicalWeeklyAthleteEditState,
} from './canonicalWeeklyAthleteEditState';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function compileCanonicalAthleteEditedWeek(args: {
  readonly workouts: readonly Workout[];
  readonly weekStartISO: string;
  readonly edits?: CanonicalWeeklyAthleteEditState;
  readonly constraints?: readonly UserRemovalConstraint[];
}): Workout[] {
  const edits = args.edits ?? canonicalWeeklyAthleteEditStateFrom({
    weekStartISO: args.weekStartISO,
    constraints: args.constraints,
  });
  const byDay = new Map<number, Workout>(
    args.workouts.map((workout) => [workout.dayOfWeek, clone(workout)]),
  );
  for (const placement of edits.placements) {
    byDay.delete(placement.dayOfWeek);
    if (placement.workout) byDay.set(placement.dayOfWeek, clone(placement.workout));
  }
  return [...byDay.values()].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}
