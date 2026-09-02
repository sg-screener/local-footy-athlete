import type { Workout, WorkoutExercise } from '../types/domain';
import { automaticExerciseRouteForIdentity } from './automaticWeeklyExerciseSelection';
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
  if (slot === 'core' || slot === 'midline') return false;
  return usefulStrengthIdentityCounts(row.exercise?.name ?? '');
}

/**
 * R-342 (Sam, 2026-09-02): a prehab drill is not one of the four. R-334 let
 * *"relevant lower-body prehab or robustness"* count, and the generated year
 * showed what that bought: a Lower Hinge of RDL, Hamstring Curl, Nordic Lower
 * and Crab Walks was "four useful rows". The route is the same typed answer
 * the weekly selector already uses for ownership (`prehab` vs `strength`), so
 * a loaded robustness row such as Nordic Lower or Copenhagen Plank (Half) still
 * counts and a band walk or hold does not. Shared with the composer's
 * redundancy pruning so the two never disagree about what is useful.
 */
export function usefulStrengthIdentityCounts(identity: string): boolean {
  return automaticExerciseRouteForIdentity(identity) !== 'prehab';
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
