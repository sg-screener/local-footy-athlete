import type { OnboardingData } from '../types/domain';
import { resolveExerciseName } from './loadEstimation';
import { legalAddAlternativesForExercise } from './addExerciseCandidates';
import {
  getTapSwapChoices,
  type TapSwapChoice,
  type TapSwapEnvironment,
  type TapSwapReason,
} from './tapSwapHierarchy';

/**
 * The cursor for the row-level Quick Swap control.
 *
 * Ranking belongs to `tapSwapHierarchy`; this helper owns only the repeated-tap
 * behaviour Sam requested. It walks each legal answer once, then starts the
 * same ranked list again. The list is never re-ranked from the replacement,
 * so tap two means "the second-best answer for the original slot", not "the
 * best answer to a different question".
 */
export function nextQuickSwapChoice<T extends { name?: string | null }>(
  rankedChoices: readonly T[],
  attemptedNames: readonly string[],
): { choice: T; attemptedNames: readonly string[] } | null {
  const usable = rankedChoices.filter((choice) => String(choice.name ?? '').trim().length > 0);
  if (usable.length === 0) return null;

  const attempted = new Set(attemptedNames.map((name) => name.trim().toLowerCase()));
  let choice = usable.find((candidate) => !attempted.has(String(candidate.name).trim().toLowerCase()));
  let nextAttempted = [...attemptedNames];
  if (!choice) {
    choice = usable[0];
    nextAttempted = [];
  }
  return {
    choice,
    attemptedNames: [...nextAttempted, String(choice.name)],
  };
}

/**
 * One ranked answer space for every exercise family.
 *
 * The specialised swap ladder speaks first. Add's existing legal hierarchy
 * completes families that ladder never modelled (notably warm-up and
 * conditioning) and broadens a repeatedly tapped slot after its closest
 * answers are exhausted. Both sources use the same safety owner.
 */
export function rankedQuickSwapChoices(args: {
  originalExercise: string;
  reason: TapSwapReason;
  environment: TapSwapEnvironment;
  existingExerciseNames?: readonly string[];
  profile?: OnboardingData | null;
}): TapSwapChoice[] {
  const specialised = getTapSwapChoices({
    originalExercise: args.originalExercise,
    reason: args.reason,
    environment: args.environment,
    existingExerciseNames: args.existingExerciseNames,
    recoveryAllowed: false,
  }).filter((choice) => choice.kind === 'exercise' && !!choice.name);
  const completion = legalAddAlternativesForExercise({
    originalExercise: args.originalExercise,
    environment: args.environment,
    existingExerciseNames: [
      ...(args.existingExerciseNames ?? []),
      args.originalExercise,
    ],
    profile: args.profile,
  }).map((candidate): TapSwapChoice => ({
    kind: 'exercise',
    name: candidate.name,
    hierarchyTier: candidate.proximity === 'same_leaf'
      ? 'same_movement_pattern'
      : 'similar_muscle_group',
    source: 'add_hierarchy_fallback',
    reason: candidate.proximity === 'same_leaf'
      ? 'Legal option from the same exercise group.'
      : 'Legal option from the same session family.',
    prescription: {
      sets: candidate.sets,
      repsMin: candidate.repsMin,
      repsMax: candidate.repsMax,
      ...(candidate.weightKg !== null ? { weight: candidate.weightKg } : {}),
      ...(candidate.prescriptionType ? { prescriptionType: candidate.prescriptionType } : {}),
      ...(candidate.perSide !== undefined ? { perSide: candidate.perSide } : {}),
    },
  }));
  const seen = new Set<string>();
  return [...specialised, ...completion].filter((choice) => {
    const key = resolveExerciseName(choice.name ?? '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
