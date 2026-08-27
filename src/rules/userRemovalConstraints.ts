import type { UserRemovalConstraint, UserRemovalScope, Workout } from '../types/domain';
import {
  compileCanonicalAthleteEditedContract,
  compileCanonicalAthleteEditedWeek,
} from './canonicalWeeklyAthleteEditCompiler';
export { activeUserRemovalConstraintsForWeek } from './canonicalWeeklyAthleteEditState';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

/** Compatibility adapter for diagnostic suites; production calls the compiler. */
export function applyUserRemovalConstraintsToWeek(args: {
  workouts: readonly Workout[];
  weekStart: string;
  constraints?: readonly UserRemovalConstraint[];
}): Workout[] {
  return compileCanonicalAthleteEditedWeek({
    workouts: args.workouts,
    weekStartISO: args.weekStart,
    constraints: args.constraints,
  });
}

export function userRemovalConstraintId(args: {
  date: string;
  scope: UserRemovalScope;
  workout: Workout;
}): string {
  return [
    'user-removal',
    args.date.slice(0, 10),
    args.scope,
    args.workout.planEntryId ?? args.workout.id,
  ].join(':');
}

export function userMoveConstraintId(args: {
  sourceDate: string;
  targetDate: string;
  workout: Workout;
}): string {
  return [
    'user-move',
    args.sourceDate.slice(0, 10),
    args.targetDate.slice(0, 10),
    args.workout.planEntryId ?? args.workout.id,
  ].join(':');
}

/** Compatibility adapter for old diagnostics; product callers use the compiler. */
export function applyAthleteRemovalTypedReduction(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  constraint: UserRemovalConstraint;
}): WeeklyExposureContractV2 {
  return compileCanonicalAthleteEditedContract({
    contract: args.contract,
    workouts: args.workouts,
    weekStartISO: args.weekStart,
    constraints: [args.constraint],
  });
}
