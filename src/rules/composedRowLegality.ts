/**
 * THE ONE LEGALITY OWNER ON THE COMPOSED PATH.
 *
 * `docs/POOL_CENSUS_2026-08-14.md` measured the app asking "can this athlete do
 * this exercise" of TWO owners that disagree on **4 (exercise x kit) pairs**:
 * `exerciseAllowedByEquipment` falls back to the LOAD classifier where Sam's
 * sheet is silent, and `exerciseIsAvailableWith` reads the sheet alone. Two
 * owners means a row can be legal to the selector and illegal to the remover —
 * and the reverse is how a bodyweight athlete was handed a `Chest Supported Row`.
 *
 * **THE ORDER IS FIXED AND BOTH STEPS MATTER.** (1) Canonical identity, because
 * Sam's sheet is keyed `Band Pallof Press` while builders emit `Pallof Press`,
 * and asking the raw spelling returns "unknown, allow". (2) The equipment sheet
 * oracle, carrying his 2026-08-14 corrections and OR-groups. **The load
 * classifier is not consulted anywhere the composed path can reach.**
 *
 * It does not "fix" the sheet's silences: absent from the table is UNKNOWN and
 * therefore ALLOWED, which is Sam's own convention, and the fix for a wrong
 * answer is a sheet row from him rather than a cleverer inference here — R-083's
 * registry row says the same in the same words.
 *
 * **SCOPE: the composed path only.** The legacy path's two checks are untouched.
 */
import {
  BODYWEIGHT_CAPABLE,
  equipmentRequirementLabel,
  exerciseIsAvailableWith,
} from '../data/exerciseEquipmentRequirement';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';

/** The canonical identity every composed row is selected, judged and stored by. */
export type ComposedExerciseIdentity = string;

export function composedIdentityFor(rawName: string): ComposedExerciseIdentity {
  return canonicalExerciseName(String(rawName ?? '').trim());
}

/** The composed path's only legality answer. An unanswered kit is not refused. */
export function composedRowIsLegal(
  rawName: string,
  kit: readonly string[] | undefined,
): boolean {
  return exerciseIsAvailableWith(composedIdentityFor(rawName), kit);
}

/**
 * Why a row is impossible, in the sheet's own words — clause (e)'s raw material.
 * `null` when legal, or when the sheet has no row: unknown is never refused, so
 * it is never described as refused either.
 */
export function composedRowGapReason(
  rawName: string,
  kit: readonly string[] | undefined,
): string | null {
  if (composedRowIsLegal(rawName, kit)) return null;
  return equipmentRequirementLabel(composedIdentityFor(rawName));
}

/**
 * R-086 closes this set at two. **The B1 ruling (Sam, 2026-08-14) confirms its
 * consequence for the composer:** for a temporary bodyweight/away athlete an
 * unloaded `Single-Leg RDL` COUNTS as a valid single-leg-hip exercise, weighted
 * versions preferred where the kit allows. That preference is expressed by the
 * authored pool ORDER in `composeWeek`, never by widening this set.
 */
export function composedRowSurvivesLosingItsLoad(rawName: string): boolean {
  return BODYWEIGHT_CAPABLE.has(composedIdentityFor(rawName));
}
