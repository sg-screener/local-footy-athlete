/**
 * Canonical typed evidence for the Section 18 observer.
 *
 * Text/visible identity is allowed inside the existing canonical row owner,
 * but the independent evaluator consumes only the serialised evidence emitted
 * here. Legacy hydration can explicitly preserve unknown evidence.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { classifyGeneratedWorkoutRow } from './generatedWorkoutRowClassification';
import type {
  Section18ConditioningRole,
  Section18ConditioningStress,
  WorkoutExerciseSection18Evidence,
  WorkoutSection18Evidence,
} from './weeklyExposureContractV2';

export type Section18EvidenceMode = 'infer' | 'preserve_legacy_unknown';

function rowName(row: WorkoutExercise): string {
  return String(row.exercise?.name ?? row.exerciseId ?? '').trim();
}

function inferredRowEvidence(
  row: WorkoutExercise,
  index: number,
): WorkoutExerciseSection18Evidence {
  const classification = classifyGeneratedWorkoutRow({
    name: rowName(row),
    sets: row.prescribedSets,
    repsMax: row.prescribedRepsMax,
    index,
  });
  const role: WorkoutExerciseSection18Evidence['role'] = classification.kind === 'recovery_addon'
    ? 'recovery_support'
    : classification.kind === 'strength_main'
      ? 'main_strength'
      : classification.kind;
  return {
    protocolVersion: 1,
    role,
    mainStrengthPattern: classification.kind === 'strength_main'
      ? classification.mainPattern
      : null,
    provenance: 'canonical_row_classifier',
  };
}

function hasConditioning(workout: Workout): boolean {
  return !!workout.conditioningBlock?.options.length ||
    !!workout.conditioningCategory ||
    workout.hasCombinedConditioning === true;
}

function conditioningRole(workout: Workout): Section18ConditioningRole {
  if (!hasConditioning(workout)) return 'none';
  if (workout.sessionTier === 'optional' || workout.sessionTier === 'recovery') {
    return workout.conditioningCategory === 'aerobic_base'
      ? 'optional_flush'
      : 'optional_noncore';
  }
  return 'core';
}

function conditioningStress(
  workout: Workout,
  role: Section18ConditioningRole,
): Section18ConditioningStress {
  if (role === 'none') return 'unknown';
  if (role === 'optional_flush') return 'light';
  switch (workout.conditioningCategory) {
    case 'vo2':
    case 'glycolytic':
    case 'sprint':
      return 'hard';
    case 'tempo':
      return 'moderate';
    case 'aerobic_base':
      // Section 18 explicitly treats controlled long slow aerobic as moderate.
      return workout.sessionTier === 'recovery' ? 'light' : 'moderate';
    default:
      return 'unknown';
  }
}

function legacyUnknownWorkoutEvidence(workout: Workout): WorkoutSection18Evidence {
  return {
    protocolVersion: 1,
    conditioningRole: hasConditioning(workout) ? 'legacy_unknown' : 'none',
    conditioningStress: hasConditioning(workout) ? 'unknown' : 'unknown',
    provenance: 'legacy_unknown',
  };
}

/** Attach or preserve typed evidence without changing prescriptions or layout. */
export function withSection18WorkoutEvidence(
  workout: Workout,
  mode: Section18EvidenceMode,
  provenance: WorkoutSection18Evidence['provenance'] = 'planner_and_canonical_content',
): Workout {
  if (mode === 'preserve_legacy_unknown') {
    return {
      ...workout,
      exercises: (workout.exercises ?? []).map((row) => row.section18Evidence
        ? row
        : {
            ...row,
            section18Evidence: {
              protocolVersion: 1,
              role: 'legacy_unknown',
              mainStrengthPattern: null,
              provenance: 'legacy_unknown',
            },
          }),
      section18Evidence: workout.section18Evidence ?? legacyUnknownWorkoutEvidence(workout),
    };
  }

  const role = conditioningRole(workout);
  return {
    ...workout,
    exercises: (workout.exercises ?? []).map((row, index) => ({
      ...row,
      section18Evidence: inferredRowEvidence(row, index),
    })),
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: role,
      conditioningStress: conditioningStress(workout, role),
      provenance,
    },
  };
}
