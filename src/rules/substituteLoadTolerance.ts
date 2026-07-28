/**
 * substituteLoadTolerance.ts — how far a substitute's load may sit from the
 * exercise it replaces before that difference is worth telling the athlete.
 *
 * SAM'S RULING (2026-07-28, Batch 6):
 * > Substitute tolerance blessed at +/-0.2 loadRatio, both sites to one owner.
 *
 * The same 0.2 lived at two sites in `exerciseSubstitutes`: one deciding whether
 * load counts as a DIFF AXIS between two candidates, the other deciding whether
 * to label a substitute "lighter load" to the athlete. They are two readings of
 * one judgement — how big a load gap is a real change — and they must move
 * together or the app will show a substitute as equivalent on one screen and
 * lighter on another.
 *
 * The unit is `loadRatio`, the slot-reference multiplier owned by the load
 * chain. 0.2 of it is the gap Sam considers meaningful.
 */

export const SUBSTITUTE_LOAD_TOLERANCE_RULING = {
  ruledOn: '2026-07-28',
  where: 'docs/BATCH4_BATCH6_RULINGS_2026-07-28.md',
  quote: 'Substitute tolerance blessed at +/-0.2 loadRatio, both sites to one owner.',
} as const;

/** A loadRatio gap at or above this is a real difference, in either direction. */
export const SUBSTITUTE_LOAD_TOLERANCE = 0.2;

/** Symmetric: "these differ on load", regardless of which way. */
export function loadRatioDiffersMeaningfully(a: number, b: number): boolean {
  return Math.abs(a - b) >= SUBSTITUTE_LOAD_TOLERANCE;
}

/** Directional: "this substitute is meaningfully LIGHTER than the original". */
export function isMeaningfullyLighter(originalRatio: number, candidateRatio: number): boolean {
  return originalRatio - candidateRatio >= SUBSTITUTE_LOAD_TOLERANCE;
}

/**
 * Directional the other way. Found while collapsing the two Sam named: a THIRD
 * copy of the same 0.2, written as `loadDelta <= -0.2`, labelling a substitute
 * "heavier load". Same judgement, same number, negated — and the easiest of the
 * three to leave behind, because it does not look like the other two.
 */
export function isMeaningfullyHeavier(originalRatio: number, candidateRatio: number): boolean {
  return candidateRatio - originalRatio >= SUBSTITUTE_LOAD_TOLERANCE;
}
