/**
 * Semantic content invariant for edited / filtered workouts.
 *
 * Titles, notes and stale classification metadata do not make a session real.
 * Typed anchors and rendered training blocks do.
 */

import type { Workout } from '../types/domain';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';

export function hasMeaningfulWorkoutContent(
  workout: Workout | null | undefined,
): boolean {
  if (!workout) return false;

  const classification = classifyVisibleSession(workout);
  if (classification.anchors.game || classification.anchors.teamTraining) return true;

  if ((workout.exercises ?? []).length > 0) return true;
  if ((workout.conditioningBlock?.options ?? []).length > 0) return true;
  if (workout.speedBlock) return true;
  if (workout.powerBlock) return true;
  if ((workout.recoveryAddons ?? []).length > 0) return true;

  return false;
}

export function shouldCollapseWorkoutToRest(
  workout: Workout | null | undefined,
): boolean {
  return !!workout && !hasMeaningfulWorkoutContent(workout);
}

/**
 * Persistable Rest shell for write boundaries whose schema requires a Workout.
 * Visible projection subsequently represents this honest empty shell as null.
 */
export function collapseWorkoutToRest(workout: Workout): Workout {
  return {
    ...workout,
    name: 'Rest',
    description: 'Rest day.',
    durationMinutes: 0,
    intensity: 'Light',
    workoutType: 'Rest' as any,
    sessionTier: 'recovery',
    strengthIntent: undefined,
    strengthIntentDiagnostics: undefined,
    strengthPatternContributions: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    section18ConditioningRole: undefined,
    section18Evidence: undefined,
    conditioningBlock: undefined,
    coachAddedConditioningLabel: undefined,
    speedBlock: undefined,
    powerBlock: undefined,
    recoveryAddons: undefined,
    exercises: [],
    ...({ isTeamDay: false } as any),
  };
}
