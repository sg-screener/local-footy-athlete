import type { Workout, WorkoutExercise } from '../types/domain';
import type { ComposedGap } from './composeWeek';
import type { DeloadDoor } from './deloadWeekRules';
import type { SlotDayKind } from './sessionSlotCoverage';

/** R-334: an ordinary healthy split strength session stays useful. */
export const MINIMUM_USEFUL_STRENGTH_EXERCISES = 4;

export const MINIMUM_USEFUL_STRENGTH_KINDS: ReadonlySet<SlotDayKind> = new Set([
  'lower_squat',
  'lower_hinge',
  'upper_split_push',
  'upper_split_pull',
]);

export type UsefulStrengthReductionReason =
  | 'scheduled_deload'
  | 'injury'
  | 'illness'
  | 'low_readiness'
  | 'game_proximity'
  | 'restricted_equipment'
  | 'restricted_availability'
  | 'athlete_exclusions'
  | 'catalogue_exhausted'
  | 'deliberately_short_session';

export interface UsefulStrengthSessionContractEvidence {
  readonly protocolVersion: 1;
  readonly applies: boolean;
  readonly minimum: number;
  readonly delivered: number;
  readonly status: 'met' | 'reduced_for_typed_reason' | 'unexplained_shortfall';
  readonly reductionReasons: readonly UsefulStrengthReductionReason[];
}

/**
 * Counts only the work that can make an ordinary strength session useful.
 * Core is welcome extra work but cannot hide a two-lift session; power, speed,
 * conditioning, mobility and movement prep are excluded by their typed role.
 */
export function rowCountsTowardUsefulStrengthMinimum(row: WorkoutExercise): boolean {
  const role = row.section18Evidence?.role;
  if (role !== 'main_strength' && role !== 'strength_accessory') return false;
  const slot = row.section18Evidence?.slot;
  return slot !== 'core' && slot !== 'midline';
}

export function usefulStrengthExerciseCount(workout: Workout): number {
  return workout.exercises.filter(rowCountsTowardUsefulStrengthMinimum).length;
}

export function minimumUsefulStrengthApplies(kind: SlotDayKind | null | undefined): boolean {
  return !!kind && MINIMUM_USEFUL_STRENGTH_KINDS.has(kind);
}

export function reductionReasonsFromComposer(args: {
  readonly deloadDoor?: DeloadDoor | null;
  readonly gaps?: readonly ComposedGap[];
}): UsefulStrengthReductionReason[] {
  const reasons = new Set<UsefulStrengthReductionReason>();
  if (args.deloadDoor === 'scheduled') reasons.add('scheduled_deload');
  if (args.deloadDoor === 'readiness') reasons.add('low_readiness');
  if (args.deloadDoor === 'illness') reasons.add('illness');
  for (const gap of args.gaps ?? []) {
    if (gap.cause === 'kit') reasons.add('restricted_equipment');
    if (gap.cause === 'exclusion') reasons.add('athlete_exclusions');
    if (gap.cause === 'already_on_day') reasons.add('catalogue_exhausted');
  }
  return [...reasons];
}

/** Stamp the final session; save/restart carries this evidence without guessing. */
export function withUsefulStrengthSessionContract(
  workout: Workout,
  reductionReasons: readonly UsefulStrengthReductionReason[] = [],
): Workout {
  const kind = workout.composedDayShape;
  if (!minimumUsefulStrengthApplies(kind)) return workout;
  const delivered = usefulStrengthExerciseCount(workout);
  const uniqueReasons = [...new Set(reductionReasons)].sort();
  const status = delivered >= MINIMUM_USEFUL_STRENGTH_EXERCISES
    ? 'met'
    : uniqueReasons.length > 0
      ? 'reduced_for_typed_reason'
      : 'unexplained_shortfall';
  return {
    ...workout,
    usefulStrengthSessionContract: {
      protocolVersion: 1,
      applies: true,
      minimum: MINIMUM_USEFUL_STRENGTH_EXERCISES,
      delivered,
      status,
      reductionReasons: uniqueReasons,
    },
  };
}
