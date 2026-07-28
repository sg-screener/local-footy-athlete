/**
 * THE EXPERIENCE CROSSWALK — the single owner of "how experienced is this
 * athlete, and what may they be programmed?"
 *
 * SOURCE OF TRUTH: `docs/LFA_PROGRAMMING_BIBLE.md` Section 11, "THE EXPERIENCE
 * CROSSWALK" (Sam, authored 2026-07-27). Held to that text by
 * `muscleExperienceEqualityTests`.
 *
 * Three vocabularies of experience exist, each for a good reason:
 *
 *   1. The ONBOARDING ANSWER (`ExperienceLevel`) — what the athlete told us,
 *      in years. 'Complete beginner' | '1-2 years' | '2-5 years' | '5+ years'.
 *   2. The LADDER (`TrainingAgeLevel`) — what the app reasons on.
 *      new -> developing -> consistent -> advanced.
 *   3. The AUTHORED GATES (`ExperienceGate`) — how Sam gated each exercise in
 *      the muscle/experience sheet, in years-of-training.
 *
 * This module is the ONLY bridge between them. Bible Section 11 states it
 * outright: "No other crosswalk may exist." That is not stylistic — Section 11
 * also forbids a second beginner/experienced representation, and a duplicate
 * mapping decides athlete-visible gating by accident the moment the two copies
 * drift. `resolveTrainingAgePolicy` used to carry its own copy of the
 * onboarding -> ladder half; it now derives from here.
 *
 * The ladder type lives HERE rather than in `trainingAgePolicy` so that the
 * policy can depend on the crosswalk without a cycle. `trainingAgePolicy`
 * re-exports `TrainingAgeLevel`, so every existing import of it still resolves.
 */

import type { ExperienceLevel } from '../types/domain';

/* ── The ladder ── */

/**
 * The ONE experience ladder for the whole app (Bible Section 11). Every gated
 * exercise, template or method declares its minimum on this ladder.
 */
export type TrainingAgeLevel = 'new' | 'developing' | 'consistent' | 'advanced';

/** The ladder in order, least to most experienced. */
export const TRAINING_AGE_LEVELS: readonly TrainingAgeLevel[] = [
  'new',
  'developing',
  'consistent',
  'advanced',
];

/** Whether `level` sits at or above `minimum` on the ladder. */
export function meetsTrainingAgeMinimum(
  level: TrainingAgeLevel,
  minimum: TrainingAgeLevel,
): boolean {
  return TRAINING_AGE_LEVELS.indexOf(level) >= TRAINING_AGE_LEVELS.indexOf(minimum);
}

/* ── The authored gates ── */

/**
 * An experience gate as Sam authored it in
 * `docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`.
 */
export type ExperienceGate =
  | 'everyone'
  | 'everyone_regression'
  | 'one_plus_years'
  | 'two_plus_years'
  | 'advanced_only';

export const EXPERIENCE_GATES: readonly ExperienceGate[] = [
  'everyone',
  'everyone_regression',
  'one_plus_years',
  'two_plus_years',
  'advanced_only',
];

/** The authored spelling of each gate, from the sheet's own legend row. */
export const EXPERIENCE_GATE_SOURCE_TEXT: Readonly<Record<ExperienceGate, string>> = {
  everyone: 'everyone',
  everyone_regression: 'everyone (regression)',
  one_plus_years: '1+ years',
  two_plus_years: '2+ years',
  advanced_only: 'advanced only',
};

/**
 * The regression convention, from Bible Section 11: an exercise marked
 * "everyone (regression)" is AUTO-PROGRAMMED for new-to-training athletes only.
 * Every other athlete reaches it through one of three doors — never by
 * auto-programming.
 */
export const REGRESSION_CONVENTION = {
  autoProgrammedFor: ['new'] as readonly TrainingAgeLevel[],
  reachableByOthersVia: [
    'the injury door',
    'an equipment constraint',
    'the athlete’s own pick',
  ] as readonly string[],
  neverAutoProgrammedForOthers: true,
} as const;

/* ── The crosswalk ── */

/**
 * Every onboarding answer the app can produce. Typed against the shipped
 * `ExperienceLevel` union, so a new onboarding option cannot appear without
 * the crosswalk gaining a row for it.
 */
export const ONBOARDING_EXPERIENCE_ANSWERS: readonly ExperienceLevel[] = [
  'Complete beginner',
  '1-2 years',
  '2-5 years',
  '5+ years',
];

export interface ExperienceCrosswalkRow {
  readonly onboardingAnswer: ExperienceLevel;
  readonly ladderLevel: TrainingAgeLevel;
  /** Every authored gate this athlete may be AUTO-PROGRAMMED exercises from. */
  readonly visibleGates: readonly ExperienceGate[];
}

/**
 * Sam's authored table, Bible Section 11.
 *
 * Two boundary rulings are part of the law:
 *
 *   1. Regressions are visible to complete beginners ONLY. A "1-2 years"
 *      athlete never sees them. This governs AUTO-PROGRAMMING; the injury
 *      door, an equipment constraint and the athlete's own pick stay open to
 *      everyone, per REGRESSION_CONVENTION.
 *   2. "2+ years" includes the "2-5 years" onboarding answer.
 *
 * Two consequences worth naming, because both look like bugs and are not:
 * `new` does NOT see `1+ years` work — a beginner gets the everyone tier plus
 * regressions and nothing above it; and `advanced` is the only level that
 * LOSES a tier by moving up, because it sees everything except regressions.
 */
export const EXPERIENCE_CROSSWALK: readonly ExperienceCrosswalkRow[] = [
  {
    onboardingAnswer: 'Complete beginner',
    ladderLevel: 'new',
    visibleGates: ['everyone', 'everyone_regression'],
  },
  {
    onboardingAnswer: '1-2 years',
    ladderLevel: 'developing',
    visibleGates: ['everyone', 'one_plus_years'],
  },
  {
    onboardingAnswer: '2-5 years',
    ladderLevel: 'consistent',
    visibleGates: ['everyone', 'one_plus_years', 'two_plus_years'],
  },
  {
    onboardingAnswer: '5+ years',
    ladderLevel: 'advanced',
    visibleGates: ['everyone', 'one_plus_years', 'two_plus_years', 'advanced_only'],
  },
];

/**
 * The ladder level an athlete with NO recorded onboarding answer is treated as.
 *
 * Long-standing shipped behaviour (`resolveTrainingAgePolicy`'s `default:`
 * branch). Kept explicit and named rather than left as a fallthrough, because
 * it is a real programming decision: an athlete we know nothing about is
 * programmed as `consistent`, not as a beginner.
 */
export const UNRECORDED_EXPERIENCE_LADDER_LEVEL: TrainingAgeLevel = 'consistent';

function crosswalkRow(answer: ExperienceLevel): ExperienceCrosswalkRow {
  const row = EXPERIENCE_CROSSWALK.find((candidate) => candidate.onboardingAnswer === answer);
  if (!row) throw new Error(`experience: no crosswalk row for onboarding answer "${answer}"`);
  return row;
}

/** The ladder level for a recorded onboarding answer. */
export function ladderLevelForOnboardingAnswer(answer: ExperienceLevel): TrainingAgeLevel {
  return crosswalkRow(answer).ladderLevel;
}

/**
 * The ladder level for a possibly-absent onboarding answer.
 *
 * The single entry point callers should use when the profile may be
 * incomplete — it applies `UNRECORDED_EXPERIENCE_LADDER_LEVEL` rather than
 * making every caller reinvent the default.
 */
export function ladderLevelForProfile(
  answer: ExperienceLevel | null | undefined,
): TrainingAgeLevel {
  if (answer === null || answer === undefined) return UNRECORDED_EXPERIENCE_LADDER_LEVEL;
  const row = EXPERIENCE_CROSSWALK.find((candidate) => candidate.onboardingAnswer === answer);
  return row ? row.ladderLevel : UNRECORDED_EXPERIENCE_LADDER_LEVEL;
}

/**
 * The authored gates an athlete may be auto-programmed exercises from.
 *
 * Throws rather than defaulting on an unmapped answer: silently falling back to
 * the `everyone` tier would quietly strip an experienced athlete's whole
 * exercise range, which reads as "the app got boring" rather than as a bug.
 */
export function visibleGatesForOnboardingAnswer(
  answer: ExperienceLevel,
): readonly ExperienceGate[] {
  return crosswalkRow(answer).visibleGates;
}

/** The authored gates visible at a ladder level. */
export function visibleGatesForLadderLevel(
  level: TrainingAgeLevel,
): readonly ExperienceGate[] {
  const row = EXPERIENCE_CROSSWALK.find((candidate) => candidate.ladderLevel === level);
  if (!row) throw new Error(`experience: no crosswalk row for ladder level "${level}"`);
  return row.visibleGates;
}

/** Whether an exercise's gate admits this athlete for AUTO-PROGRAMMING. */
export function isExerciseAutoProgrammableFor(
  gate: ExperienceGate,
  answer: ExperienceLevel,
): boolean {
  return visibleGatesForOnboardingAnswer(answer).includes(gate);
}
