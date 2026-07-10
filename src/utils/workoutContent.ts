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
