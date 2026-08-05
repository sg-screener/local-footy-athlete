import type { Workout } from '../types/domain';

/**
 * THE COMPOSED-OPTIONAL MARKER DIES WHERE THE DAY GAINS CONDITIONING.
 *
 * `composedOptionalKind` means "this workout IS one composed Gunshow /
 * Accessories / Mobility session" — ruling 7-e, signed 2026-08-01: the door's
 * name alone, rows are contents not card vocabulary. A day that gains a
 * conditioning part is no longer that, so the marker cannot survive the write
 * that adds it.
 *
 * FOUR SITES LEARNED THIS SEPARATELY, AND A FIFTH WOULD HAVE LEARNED IT THE
 * SAME WAY:
 *
 *   • `stackTemplate` clears it on combining — "the marker dies with the purity
 *     it describes" (2026-08-01, the first payment);
 *   • the §18 repair clears it when it promotes an accessory slot to required
 *     strength — "whoever repurposes a day owns clearing what the day WAS";
 *   • the engine's conditioning-attach spread (`plan[i] = { ...s, … }`) did
 *     not, and a Gunshow day kept claiming purity while carrying conditioning;
 *   • both adjustment-event attach sites did not, for the same reason.
 *
 * Each was found separately by the deep walker as its own L-P6 offence, which
 * is the signature of a rule living at call sites instead of at an owner. So
 * the rule stops being something a caller has to remember: a clone whose patch
 * INTRODUCES conditioning clears the marker, and there is one place to change
 * if the set of conditioning fields ever grows.
 *
 * DELIBERATELY NOT DONE AT THE PROJECTION. A projection that quietly repaired
 * the marker would make L-P6 unfalsifiable — the law could never fire again —
 * and would leave the leak in the domain with only its symptom gone.
 */
export function patchIntroducesConditioning(overrides: Partial<Workout>): boolean {
  return overrides.hasCombinedConditioning === true
    || overrides.conditioningBlock !== undefined
    || overrides.conditioningCategory !== undefined
    || overrides.conditioningFlavour !== undefined
    || (overrides as { attachedConditioningKind?: unknown }).attachedConditioningKind !== undefined;
}

/** The marker fields a conditioning-introducing clone must drop. */
export function composedOptionalClearingPatch(
  overrides: Partial<Workout>,
): Pick<Workout, 'composedOptionalKind'> | Record<string, never> {
  return patchIntroducesConditioning(overrides) ? { composedOptionalKind: undefined } : {};
}
