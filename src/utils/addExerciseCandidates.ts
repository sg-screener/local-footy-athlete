/**
 * WHAT THE ATHLETE MAY ADD TO A SESSION — THE APP'S OWN VOCABULARY, FILTERED
 * BY THE APP'S OWN LEGALITY OWNER.
 *
 * Sam, 2026-08-19: *"Add any legal exercise, mobility or conditioning
 * component. Remove nothing. Respect equipment, injury and genuine session
 * limits. Own load authority."*
 *
 * ⚠ **WHAT THIS REPLACES.** The day screen held a HAND-WRITTEN table of twelve
 * suggestions — two per "kind" — and offered the first one the session did not
 * already contain. It was not *any* legal exercise (twelve names out of the
 * whole vocabulary), it asked NOTHING about the athlete's kit or their injuries,
 * and every entry carried a hand-typed set/rep band. An athlete with no barbell
 * and a bad shoulder was offered the same two upper-body options as everyone
 * else.
 *
 * **NO NEW DATA AND NO SECOND LEGALITY OPINION.** The names come from
 * `selectableVocabularyGroups()` — the one vocabulary every generator draws
 * from, already grouped and already labelled, and already covering strength,
 * mobility, prehab, power and conditioning. The filter is
 * `assessTapSwapCandidateSafety`, the same function the swap ladder uses to
 * decide whether an athlete may be offered a movement at all, so Add and Swap
 * cannot disagree about what is safe today.
 *
 * ── WHY THE 7-EXERCISE CAP IS NOT APPLIED HERE ─────────────────────────────
 *
 * `REGISTRY-GREP: R-088`. Sam ruled it in the same breath as the number:
 * *"7 is the max the app should set and **a user should be able to add as many
 * of their own things on top of it as they choose**"*. The cap binds the
 * PLANNER, not the athlete. So *"respect ... genuine session limits"* means
 * equipment, injury and safety — the limits that could hurt someone — and NOT
 * the app's own budget, which exists to stop the app over-programming.
 *
 * WRITER: none, this stores nothing. READER: `screens/home/DayWorkoutScreenV2`.
 * TEST: `src/__tests__/exerciseAddCandidatesTests.ts`.
 */

import { selectableVocabularyGroups } from '../data/selectableExerciseVocabulary';
import { assessTapSwapCandidateSafety, type TapSwapEnvironment } from './tapSwapHierarchy';
import { resolveExerciseName, startingWeightForAthlete } from './loadEstimation';
import { getExerciseTags } from '../data/exerciseTags';
import type { OnboardingData } from '../types/domain';

export interface AddCandidate {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** `null` when the movement has no prescribable load — bodyweight, mobility. */
  weightKg: number | null;
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes';
  perSide?: boolean;
}

export interface AddCandidateGroup {
  label: string;
  candidates: AddCandidate[];
}

/**
 * How many names one group offers. Enough to be a real choice, few enough that
 * the sheet is a decision rather than a catalogue; the athlete can pick another
 * group for more.
 */
export const ADD_CANDIDATES_PER_GROUP = 6;

/**
 * THE ATHLETE'S OWN LOAD, FROM THE ONE OWNER.
 *
 * `startingWeightForAthlete` already answers "what should THIS athlete lift on
 * THIS movement" from their onboarding anchors and training age, and returns
 * `null` for anything with no prescribable load. Reading it here is what makes
 * an added row carry its own number rather than inheriting one from whatever it
 * was typed next to.
 */
function loadFor(name: string, profile: OnboardingData | null | undefined): number | null {
  if (!profile) return null;
  try {
    return startingWeightForAthlete(name, profile);
  } catch {
    // A movement the estimator has no anchor for is not an error; it is a row
    // the athlete loads themselves.
    return null;
  }
}

/**
 * The authored band for a movement, by what the movement IS.
 *
 * Deliberately coarse and deliberately NOT a second dose engine: an ADDED row
 * is the athlete's own top-up, not a programmed exposure, and
 * `resolveComposedDose` answers a question about a row the COMPOSER selected
 * for a slot — it needs the slot, the phase and the main-lift role, none of
 * which an ad-hoc add has. Inventing those to reach it would be inventing the
 * answer. So the band comes off the movement's own tags.
 */
function bandFor(name: string): Pick<AddCandidate, 'sets' | 'repsMin' | 'repsMax' | 'prescriptionType' | 'perSide'> {
  const tags = getExerciseTags(resolveExerciseName(name));
  if (!tags) return { sets: 2, repsMin: 8, repsMax: 12 };
  if (tags.movement === 'conditioning') {
    return { sets: 1, repsMin: 8, repsMax: 10, prescriptionType: 'duration_minutes' };
  }
  if (tags.movement === 'carry') {
    return { sets: 2, repsMin: 30, repsMax: 45, prescriptionType: 'duration', perSide: tags.unilateral };
  }
  if (tags.movement === 'core') {
    return { sets: 2, repsMin: 8, repsMax: 12, perSide: tags.unilateral };
  }
  if (tags.movement === 'plyo') {
    return { sets: 3, repsMin: 3, repsMax: 5, perSide: tags.unilateral };
  }
  if (tags.load === 'high') {
    return { sets: 3, repsMin: 5, repsMax: 8, perSide: tags.unilateral };
  }
  return { sets: 2, repsMin: 10, repsMax: 12, perSide: tags.unilateral };
}

/**
 * EVERY GROUP THE ATHLETE MAY ADD FROM TODAY.
 *
 * A group whose every member is unsafe or already on the day is ABSENT, not
 * empty — the same rule Swap's menu follows, so a category the athlete taps
 * always has something behind it.
 */
export function legalAddCandidateGroups(args: {
  environment: TapSwapEnvironment;
  existingExerciseNames?: readonly string[];
  profile?: OnboardingData | null;
}): AddCandidateGroup[] {
  const present = new Set(
    (args.existingExerciseNames ?? []).map((name) => resolveExerciseName(name).toLowerCase()),
  );
  const groups: AddCandidateGroup[] = [];
  for (const group of selectableVocabularyGroups()) {
    const candidates: AddCandidate[] = [];
    for (const name of group.names) {
      if (candidates.length >= ADD_CANDIDATES_PER_GROUP) break;
      // REMOVE NOTHING, AND REPLACE NOTHING. A name already on the day is not
      // offered, because adding it would either duplicate the row or invite a
      // caller to overwrite it — and an Add that overwrites is a Swap.
      if (present.has(resolveExerciseName(name).toLowerCase())) continue;
      if (!assessTapSwapCandidateSafety(name, args.environment).safe) continue;
      candidates.push({
        name,
        ...bandFor(name),
        weightKg: loadFor(name, args.profile),
      });
    }
    if (candidates.length > 0) groups.push({ label: group.label, candidates });
  }
  return groups;
}
