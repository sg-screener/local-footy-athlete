/**
 * ONE SEMANTIC ANSWER TO "WHAT DID THE ATHLETE PUT ON EACH DAY?"
 *
 * Add, swap, move and remove doors persist typed user-removal constraints.
 * This module translates those records once for one Monday-start week. The
 * compiler consumes the resulting day placements; read surfaces never
 * interpret mutation kind, remainingWorkout or wholeDayRestOwned themselves.
 */
import type { UserRemovalConstraint, Workout } from '../types/domain';
import { athletePlacementFor } from './athletePlacement';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function endOfWeek(weekStart: string): string {
  const end = new Date(`${weekStart.slice(0, 10)}T12:00:00`);
  end.setDate(end.getDate() + 6);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
}

function dateIsInWeek(dateISO: string, weekStart: string, weekEnd: string): boolean {
  const date = dateISO.slice(0, 10);
  return date >= weekStart && date <= weekEnd;
}

export function activeUserRemovalConstraintsForWeek(
  constraints: readonly UserRemovalConstraint[] | undefined,
  weekStart: string,
): UserRemovalConstraint[] {
  const start = weekStart.slice(0, 10);
  const end = endOfWeek(start);
  return (constraints ?? [])
    .filter((constraint) => constraint.status === 'active' &&
      (dateIsInWeek(constraint.targetDate, start, end) ||
        (!!constraint.moveTargetDate && dateIsInWeek(constraint.moveTargetDate, start, end))))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id));
}

export interface CanonicalWeeklyAthleteEditPlacement {
  readonly dateISO: string;
  readonly dayOfWeek: number;
  readonly constraintId: string;
  /** Null means the athlete owns an empty day without inventing a calendar rest fact. */
  readonly workout: Workout | null;
}

export interface CanonicalWeeklyAthleteEditState {
  readonly kind: 'weekly_athlete_edits';
  readonly id: string;
  readonly weekStartISO: string;
  readonly activeConstraintIds: readonly string[];
  readonly placements: readonly CanonicalWeeklyAthleteEditPlacement[];
}

function ownedWorkout(args: {
  constraint: UserRemovalConstraint;
  dateISO: string;
  workout: Workout;
}): Workout {
  return {
    ...clone(args.workout),
    dayOfWeek: new Date(`${args.dateISO.slice(0, 10)}T12:00:00`).getDay(),
    athletePlacement: athletePlacementFor({
      constraintId: args.constraint.id,
      placedDate: args.dateISO.slice(0, 10),
    }),
  };
}

function ownedRest(
  constraint: UserRemovalConstraint,
  dateISO: string,
): Workout {
  return {
    ...clone(constraint.originalWorkout),
    id: `athlete-rest:${constraint.id}`,
    planEntryId: undefined,
    dayOfWeek: new Date(`${dateISO}T12:00:00`).getDay(),
    name: 'Rest',
    description: '',
    durationMinutes: 0,
    intensity: 'Low',
    workoutType: 'Rest',
    sessionTier: 'recovery',
    exercises: [],
    conditioningBlock: undefined,
    speedBlock: undefined,
    strengthIntent: undefined,
    strengthPatternContributions: undefined,
    hasCombinedConditioning: false,
    athletePlacement: athletePlacementFor({
      constraintId: constraint.id,
      placedDate: dateISO,
    }),
  } as unknown as Workout;
}

export function canonicalWeeklyAthleteEditStateFrom(args: {
  readonly weekStartISO: string;
  readonly constraints?: readonly UserRemovalConstraint[];
}): CanonicalWeeklyAthleteEditState {
  const weekStartISO = args.weekStartISO.slice(0, 10);
  const weekEndISO = endOfWeek(weekStartISO);
  const active = activeUserRemovalConstraintsForWeek(args.constraints, weekStartISO);
  // A later accepted decision on the same day wins. The map records that
  // ordering once so every consumer sees the same placement.
  const byDate = new Map<string, CanonicalWeeklyAthleteEditPlacement>();

  for (const constraint of active) {
    const sourceDate = constraint.targetDate.slice(0, 10);
    if (dateIsInWeek(sourceDate, weekStartISO, weekEndISO)) {
      const workout = constraint.remainingWorkout
        ? ownedWorkout({ constraint, dateISO: sourceDate, workout: constraint.remainingWorkout })
        : constraint.wholeDayRestOwned
          ? ownedRest(constraint, sourceDate)
          : null;
      byDate.set(sourceDate, {
        dateISO: sourceDate,
        dayOfWeek: new Date(`${sourceDate}T12:00:00`).getDay(),
        constraintId: constraint.id,
        workout,
      });
    }

    const targetDate = constraint.moveTargetDate?.slice(0, 10);
    if (constraint.mutationKind === 'move' && targetDate && constraint.movedWorkout &&
      dateIsInWeek(targetDate, weekStartISO, weekEndISO)) {
      byDate.set(targetDate, {
        dateISO: targetDate,
        dayOfWeek: new Date(`${targetDate}T12:00:00`).getDay(),
        constraintId: constraint.id,
        workout: ownedWorkout({
          constraint,
          dateISO: targetDate,
          workout: constraint.movedWorkout,
        }),
      });
    }
  }

  return {
    kind: 'weekly_athlete_edits',
    id: `athlete-edits-week:${weekStartISO}`,
    weekStartISO,
    activeConstraintIds: active.map((constraint) => constraint.id),
    placements: [...byDate.values()].sort((left, right) =>
      left.dateISO.localeCompare(right.dateISO)),
  };
}
