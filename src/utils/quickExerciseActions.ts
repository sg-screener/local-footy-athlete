import type { OnboardingData } from '../types/domain';
import { resolveExerciseName } from './loadEstimation';
import { legalAddAlternativesForExercise } from './addExerciseCandidates';
import { exerciseSessionFamily, type ExerciseSessionFamily } from '../rules/exerciseSessionFamily';
import { classifyExerciseRole } from './sessionRoles';
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
 * completes families that ladder never modelled, but only from the original
 * exercise leaf. "Same Strength family" is not similarity: treating it as one
 * is how Box Jumps reached a Pallof Press slot. The one exception is a typed
 * visible section correcting an ambiguous name (for example Half Copenhagen
 * inside Mobility / Warm-up); there the section's family is the stronger fact.
 * Both sources use the same safety owner.
 */
export function rankedQuickSwapChoices(args: {
  originalExercise: string;
  reason: TapSwapReason;
  environment: TapSwapEnvironment;
  existingExerciseNames?: readonly string[];
  profile?: OnboardingData | null;
  /** The visible section owns the family when the row name is ambiguous. */
  requiredFamily?: ExerciseSessionFamily;
}): TapSwapChoice[] {
  const specialised = getTapSwapChoices({
    originalExercise: args.originalExercise,
    reason: args.reason,
    environment: args.environment,
    existingExerciseNames: args.existingExerciseNames,
    recoveryAllowed: false,
  }).filter((choice) => choice.kind === 'exercise'
    && !!choice.name
    && (!args.requiredFamily || exerciseSessionFamily(choice.name) === args.requiredFamily));
  const typedFamilyCorrectsName = !!args.requiredFamily
    && exerciseSessionFamily(args.originalExercise) !== args.requiredFamily;
  const originalRole = classifyExerciseRole(args.originalExercise);
  const completion = legalAddAlternativesForExercise({
    originalExercise: args.originalExercise,
    environment: args.environment,
    existingExerciseNames: [
      ...(args.existingExerciseNames ?? []),
      args.originalExercise,
    ],
    profile: args.profile,
    requiredFamily: args.requiredFamily,
    replacingExerciseName: args.originalExercise,
  }).filter((candidate) => typedFamilyCorrectsName || (
    candidate.proximity === 'same_leaf'
      && classifyExerciseRole(candidate.name) === originalRole
  ))
    .map((candidate): TapSwapChoice => ({
    kind: 'exercise',
    name: candidate.name,
    hierarchyTier: candidate.proximity === 'same_leaf'
      ? 'same_movement_pattern'
      : 'similar_muscle_group',
    source: 'add_hierarchy_fallback',
    reason: candidate.proximity === 'same_leaf'
      ? 'Legal option from the same exercise group.'
      : 'Legal option from the same session family.',
    /**
     * ⚠ **A SWAP IS NOT AN ADD, SO IT DOES NOT BRING THE ADD MENU'S DOSE.**
     *
     * `swapSuggestionPayload`'s header already states the rule this line was
     * breaking: *"The DOSE carries over from the row being replaced — sets, rep
     * range, rest, per-side. A dose belongs to the SLOT the new movement steps
     * into."* `buildSwapSuggestionPayload` spreads a choice's `prescription`
     * LAST, so `sets` / `repsMin` / `repsMax` copied out of the Add candidate
     * displaced the slot's dose every time this source won.
     *
     * **SEEN ON GLASS 2026-09-04.** Inside a Recovery session, swapping the
     * authored `Outdoor Walk` (`1 × 10 min`, the recovery pool's own dose) for
     * `Light Walk or Stationary Bike` rendered **`2 × 12 min`** — `bandFor`'s
     * untagged default, wearing the outgoing row's `duration_minutes` unit. Sam
     * ruled that row at ten minutes (`LAW-standalone-mobility-recovery-session-
     * parity`: *"one easy-cardio effort at 5-10 minutes"*, shown as one high-end
     * target), so the Add menu's guess was overwriting a signed dose.
     *
     * **WHAT STILL COMES ACROSS IS WHAT BELONGS TO THE EXERCISE, NOT THE SLOT** —
     * its unit (`prescriptionType`), whether it is per side, its note and its
     * load. Those are facts about the movement and cannot be inherited from the
     * row leaving — `perSide` above all, because a unilateral movement stepping
     * into a bilateral slot must still read "/ side". Rest is named in the
     * header's dose list, so it stays with the slot too.
     *
     * ⚠ **A WIDER DIVERGENCE IS MEASURED AND NOT FIXED HERE.** `bandFor`
     * re-derives a dose from tags for names whose dose is AUTHORED in
     * `POOL_REGISTRY` — 88 of the 105 pool names disagree with their own pool
     * entry (`Face Pull` authored `3 × 15-20`, offered `2 × 10-12`). That is a
     * second dose owner for authored rows and it belongs to the Add menu, not to
     * this swap seam; it changes every Add dose in the app and needs its own
     * ruling and device pass. Reported, not swept.
     */
    prescription: {
      notes: candidate.notes,
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
