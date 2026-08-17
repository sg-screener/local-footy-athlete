/**
 * The rotation owner's `ComposerInputs` fields, defaulted for suites whose
 * subject is NOT rotation.
 *
 * `rules/exerciseRotation.ts` made block identity a REQUIRED composer input, on
 * purpose: an optional block number with a silent fallback is how selection came
 * to be keyed by the phase week in the first place. Suites that compose a week
 * to ask about something else — exclusions, severance, slice B1 — still have to
 * state it, and this is the one place that says what "block 1, first week, no
 * pins, no recorded history" is, so the answer cannot drift between them.
 *
 * ⚠ **ROTATION SUITES MUST NOT USE THIS.** A cell about rotation states its own
 * block, week and history, or it is asserting against this file's opinion rather
 * than against the athlete's world.
 */
export const COMPOSER_ROTATION_DEFAULTS = {
  blockNumber: 1,
  pinnedIdentities: [],
  progressedIdentities: [],
} as const;
