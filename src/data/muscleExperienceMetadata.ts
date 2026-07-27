/**
 * Muscle + experience metadata — the D11 muscle-block build data.
 *
 * SOURCE OF TRUTH: `docs/MUSCLE_EXPERIENCE_FINAL_2026-07-25.xlsx`
 * (Sam, AUTHORED FINAL, sign-off 2026-07-25). 193 exercises across 24 pools.
 *
 * A typed projection, held to the sheet by `muscleExperienceEqualityTests` in
 * both directions. Do not hand-edit a muscle tag or a gate here; change the
 * sheet.
 *
 * NOT WIRED YET: nothing selects on this. Stage B consumes it.
 *
 * ── The experience crosswalk ──
 *
 * Three vocabularies of athlete experience exist, each for a good reason:
 *
 *   1. The onboarding answer (`types/domain.ts` `ExperienceLevel`) — what the
 *      athlete actually told us, in years.
 *   2. The Bible's ONE ladder (Section 11, Section 5) — what the app reasons
 *      on: new -> developing -> consistent -> advanced.
 *   3. This sheet's gates — how Sam authored each exercise's minimum.
 *
 * `EXPERIENCE_CROSSWALK` is Sam's authored bridge between all three (Bible
 * Section 11, "THE EXPERIENCE CROSSWALK", Sam 2026-07-27). It is the ONLY
 * mapping: the Bible states "No other crosswalk may exist." A second one
 * anywhere would be the second beginner/experienced representation that
 * Section 11 forbids, and would decide athlete-visible gating by accident.
 *
 * Read it through `visibleGatesForOnboardingAnswer`. Do not re-derive it.
 */

/* ── Muscle vocabulary ── */

/**
 * Every muscle group the authored sheet uses. `Midline` is the trunk
 * vocabulary — "Core" and "Trunk" are retired app-wide (D13).
 *
 * `—` in the sheet means "no secondary muscle" and is a placeholder, never a
 * group; it is dropped on the way in.
 */
export type MuscleGroup =
  | 'Quads'
  | 'Glutes'
  | 'Hamstrings'
  | 'Hips'
  | 'Groin'
  | 'Calves'
  | 'Low back'
  | 'Upper back'
  | 'Lats'
  | 'Chest'
  | 'Shoulders'
  | 'Triceps'
  | 'Biceps'
  | 'Traps'
  | 'Midline'
  | 'Knee'
  | 'Feet'
  | 'Outer hip'
  | 'Grip';

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'Quads',
  'Glutes',
  'Hamstrings',
  'Hips',
  'Groin',
  'Calves',
  'Low back',
  'Upper back',
  'Lats',
  'Chest',
  'Shoulders',
  'Triceps',
  'Biceps',
  'Traps',
  'Midline',
  'Knee',
  'Feet',
  'Outer hip',
  'Grip',
];

/* ── Experience ── */

/**
 * Experience types and the crosswalk are owned by `rules/experienceCrosswalk`,
 * which is the single authored bridge between the onboarding answer, the ladder
 * and these gates (Bible Section 11: "No other crosswalk may exist").
 *
 * Re-exported here so a consumer reading muscle metadata does not need to know
 * which module owns the gate vocabulary — but there is exactly one definition.
 */
export type {
  ExperienceGate,
  TrainingAgeLevel,
  ExperienceCrosswalkRow,
} from '../rules/experienceCrosswalk';
export {
  EXPERIENCE_GATES,
  EXPERIENCE_GATE_SOURCE_TEXT,
  EXPERIENCE_CROSSWALK,
  ONBOARDING_EXPERIENCE_ANSWERS,
  REGRESSION_CONVENTION,
  TRAINING_AGE_LEVELS as EXPERIENCE_LADDER,
  ladderLevelForOnboardingAnswer,
  visibleGatesForOnboardingAnswer,
  visibleGatesForLadderLevel,
  isExerciseAutoProgrammableFor,
} from '../rules/experienceCrosswalk';

import type { ExperienceGate } from '../rules/experienceCrosswalk';

/**
 * Spelling variants that WERE in the FINAL sheet and have been corrected.
 *
 * Sam authorised the corrections on 2026-07-27 rather than leaving them
 * normalised-on-read: 'Everyone' twice and one lowercase 'midline'. They are now
 * fixed in the workbook itself and recorded in its change-log row and in Bible
 * Section 19.
 *
 * The list stays as a RECORD, and the equality suite asserts the sheet now
 * carries none of them — so this cannot quietly become a tolerated-variants list
 * again. A new variant fails the build instead of being absorbed.
 */
export interface CorrectedSpellingVariant {
  readonly was: string;
  readonly now: string;
  readonly where: string;
}

export const CORRECTED_SPELLING_VARIANTS: readonly CorrectedSpellingVariant[] = [
  { was: 'Everyone', now: 'everyone', where: 'Suitcase Carry — experience level' },
  { was: 'Everyone', now: 'everyone', where: 'Skull Crushers — experience level' },
  {
    was: 'midline',
    now: 'Midline',
    where: 'Chin-Up Negative (Slow) — secondary muscle groups',
  },
];

/* ── An entry ── */

export interface ExerciseMuscleEntry {
  /** Exercise name. Must match the selectable vocabulary — see the reconciliation lists. */
  readonly exercise: string;
  /** The authored pool this exercise sits in. */
  readonly pool: string;
  readonly primary: readonly MuscleGroup[];
  readonly secondary: readonly MuscleGroup[];
  readonly experienceGate: ExperienceGate;
  /** Sam's authored note, verbatim. Empty when he left none. */
  readonly note: string;
  /**
   * Whether the note carries a ⚑ mark. Sam signed the sheet FINAL with 20 of
   * these present: they annotate gates he considers genuinely debatable, not
   * blockers. Preserved so the debate is visible rather than lost.
   */
  readonly flagged: boolean;
}

/** The 24 authored pools, in sheet order. */
export const MUSCLE_METADATA_POOLS: readonly string[] = [
  'Lower squat',
  'Lower hinge',
  'Upper push horizontal',
  'Upper push vertical',
  'Upper pull horizontal',
  'Upper pull vertical',
  'Lower plyometric',
  'Carries',
  'Accessories upper',
  'Accessories lower',
  'Shoulders',
  'Upper back',
  'Groin / adductors',
  'Calves',
  'Lower prehab',
  'Midline',
  'Shoulder health',
  'Hamstring (light)',
  'Tissue quality',
  'Mobility',
  'Easy cardio (zone 1)',
  'Breathing reset',
  'Conditioning',
  'Power',
];

/* ── Reconciliation with the selectable vocabulary ── */

/**
 * Selectable exercises the authored sheet gives no metadata for.
 *
 * EMPTY as of Sam's 2026-07-27 reconciliation: he ruled `Single-Arm Pulldown`
 * KEEP and authored its row, closing the only gap. The list and its gate stay so
 * a future selectable addition without metadata is caught rather than assumed.
 */
export const SELECTABLE_WITHOUT_METADATA: readonly string[] = [];

export interface MetadataWithoutSelectableExercise {
  readonly exercise: string;
  readonly reason: string;
}

/**
 * Metadata entries for exercises that are not selectable YET. All eight are
 * the staged power pool (`POWER_POOL_PENDING`), which Stage A.3 makes
 * selectable — so this list should empty itself as that stage lands.
 */
export const METADATA_WITHOUT_SELECTABLE_EXERCISE: readonly MetadataWithoutSelectableExercise[] = [
  { exercise: 'Vertical Jump', reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.' },
  { exercise: 'Pogo Hops', reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.' },
  { exercise: 'Lateral Jump', reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.' },
  { exercise: 'Kneeling Jump', reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.' },
  {
    exercise: 'RFE Split Squat Jump',
    reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.',
  },
  {
    exercise: 'Explosive Push-up',
    reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.',
  },
  { exercise: 'Speed Bench', reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.' },
  {
    exercise: 'Speed Trap Bar Deadlift',
    reason: 'POWER_POOL_PENDING — becomes selectable in Stage A.3.',
  },
];

/* ── The 193 authored entries ── */

/** Generated from the sheet and held to it by `npm run test:muscle-experience`. */
export const EXERCISE_MUSCLE_METADATA: readonly ExerciseMuscleEntry[] = [
  /* ── Lower squat ── */
  {
    exercise: 'Back Squat',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hips', 'Midline', 'Low back'],
    experienceGate: 'two_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Front Squat',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Midline', 'Upper back'],
    experienceGate: 'two_plus_years',
    note: '⚑ rack-position mobility/technique demand is higher than back squat, but could reasonably be 1+ years.',
    flagged: true,
  },
  {
    exercise: 'Box Squat',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'High Box Squat',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Walking Lunges',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bulgarian Split Squats',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Hips'],
    experienceGate: 'two_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Reverse Lunges',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Step Ups',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Goblet Squat',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Midline'],
    experienceGate: 'everyone_regression',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Leg Press',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Single-Leg Leg Press',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Single-Leg Squat (to Box)',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bodyweight Squat',
    pool: 'Lower squat',
    primary: ['Quads', 'Glutes'],
    secondary: [],
    experienceGate: 'everyone_regression',
    note: '',
    flagged: false,
  },

  /* ── Lower hinge ── */
  {
    exercise: 'Deadlift',
    pool: 'Lower hinge',
    primary: ['Hamstrings', 'Glutes', 'Low back'],
    secondary: ['Upper back', 'Midline'],
    experienceGate: 'two_plus_years',
    note: '⚑ straight-bar technical demand; app\'s own beginner curriculum substitutes Trap Bar instead, but 1+ years is defensible too.',
    flagged: true,
  },
  {
    exercise: 'Trap Bar Deadlift',
    pool: 'Lower hinge',
    primary: ['Hamstrings', 'Glutes', 'Low back'],
    secondary: ['Quads', 'Upper back'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'RDLs',
    pool: 'Lower hinge',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Upper back', 'Midline'],
    experienceGate: 'one_plus_years',
    note: '⚑ hamstring tagged \'avoid\' (highest injury rating) + high eccentric demand, but could arguably be 1+ years.',
    flagged: true,
  },
  {
    exercise: 'Single-Leg RDL',
    pool: 'Lower hinge',
    primary: ['Hamstrings', 'Glutes'],
    secondary: ['Hips', 'Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Hip Thrusts',
    pool: 'Lower hinge',
    primary: ['Glutes'],
    secondary: ['Hamstrings', 'Low back'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Kettlebell Swings',
    pool: 'Lower hinge',
    primary: ['Glutes', 'Hamstrings'],
    secondary: ['Midline', 'Low back'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Glute Bridge',
    pool: 'Lower hinge',
    primary: ['Glutes'],
    secondary: ['Hamstrings'],
    experienceGate: 'everyone_regression',
    note: '',
    flagged: false,
  },

  /* ── Upper push horizontal ── */
  {
    exercise: 'Bench Press',
    pool: 'Upper push horizontal',
    primary: ['Chest'],
    secondary: ['Triceps', 'Shoulders'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Incline Bench',
    pool: 'Upper push horizontal',
    primary: ['Chest', 'Shoulders'],
    secondary: ['Triceps'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Close Grip Bench',
    pool: 'Upper push horizontal',
    primary: ['Triceps', 'Chest'],
    secondary: ['Shoulders'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'DB Bench Press',
    pool: 'Upper push horizontal',
    primary: ['Chest'],
    secondary: ['Triceps', 'Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Incline DB Bench',
    pool: 'Upper push horizontal',
    primary: ['Chest', 'Shoulders'],
    secondary: ['Triceps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Push-ups',
    pool: 'Upper push horizontal',
    primary: ['Chest'],
    secondary: ['Triceps', 'Shoulders', 'Midline'],
    experienceGate: 'everyone_regression',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Dips',
    pool: 'Upper push horizontal',
    primary: ['Chest', 'Triceps'],
    secondary: ['Shoulders'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Single-Arm DB Bench Press',
    pool: 'Upper push horizontal',
    primary: ['Chest'],
    secondary: ['Triceps', 'Midline'],
    experienceGate: 'two_plus_years',
    note: 'anti-rotation control under unilateral load; low stability + caution lateWeek in the source tags.',
    flagged: false,
  },
  {
    exercise: 'Single-Arm DB Floor Press',
    pool: 'Upper push horizontal',
    primary: ['Chest', 'Triceps'],
    secondary: ['Midline'],
    experienceGate: 'one_plus_years',
    note: '⚑ shorter ROM protects the shoulder vs. the bench variant, so this may be gentler than the sibling above — could be \'everyone\'.',
    flagged: true,
  },

  /* ── Upper push vertical ── */
  {
    exercise: 'Overhead Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders'],
    secondary: ['Triceps', 'Midline', 'Traps'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Landmine Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders', 'Chest'],
    secondary: ['Triceps'],
    experienceGate: 'one_plus_years',
    note: '⚑ SAFE injury profile suggests this could reasonably be \'everyone\'; not in the app\'s own beginner curriculum, so left at 1+ years.',
    flagged: true,
  },
  {
    exercise: 'DB Shoulder Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders'],
    secondary: ['Triceps'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Seated DB Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders'],
    secondary: ['Triceps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Half-Kneeling Single-Arm Overhead Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders'],
    secondary: ['Triceps', 'Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Explosive Landmine Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders', 'Chest'],
    secondary: ['Triceps'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Z-Press',
    pool: 'Upper push vertical',
    primary: ['Shoulders'],
    secondary: ['Triceps', 'Midline'],
    experienceGate: 'two_plus_years',
    note: '⚑ no leg drive raises the midline/shoulder stability demand, but could be 1+ years.',
    flagged: true,
  },

  /* ── Upper pull horizontal ── */
  {
    exercise: 'Barbell Row',
    pool: 'Upper pull horizontal',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps', 'Midline'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Chest Supported Row',
    pool: 'Upper pull horizontal',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps'],
    experienceGate: 'everyone',
    note: '⚑ not in the app\'s literal beginner list (Single-Arm DB Row is), but SAFE injury profile reads as beginner-friendly — could be 1+ years instead.',
    flagged: true,
  },
  {
    exercise: 'Single-Arm DB Row',
    pool: 'Upper pull horizontal',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps', 'Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Seated Cable Row',
    pool: 'Upper pull horizontal',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Face Pull',
    pool: 'Upper pull horizontal',
    primary: ['Shoulders', 'Upper back'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Rear Delt Fly',
    pool: 'Upper pull horizontal',
    primary: ['Shoulders', 'Upper back'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Band Pull-Apart',
    pool: 'Upper pull horizontal',
    primary: ['Upper back', 'Shoulders'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Upper pull vertical ── */
  {
    exercise: 'Pull-Ups',
    pool: 'Upper pull vertical',
    primary: ['Lats', 'Upper back'],
    secondary: ['Biceps'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Chin-Ups',
    pool: 'Upper pull vertical',
    primary: ['Lats', 'Biceps'],
    secondary: ['Upper back'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lat Pulldown',
    pool: 'Upper pull vertical',
    primary: ['Lats', 'Upper back'],
    secondary: ['Biceps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Neutral-Grip Pulldown',
    pool: 'Upper pull vertical',
    primary: ['Lats', 'Upper back'],
    secondary: ['Biceps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Single-Arm Lat Pulldown',
    pool: 'Upper pull vertical',
    primary: ['Lats'],
    secondary: ['Biceps', 'Upper back', 'Midline'],
    experienceGate: 'everyone',
    note: 'MERGED per Sam: absorbs Single-Arm Pulldown (alias). Keeping this name + cue — say the word to flip the name.',
    flagged: false,
  },

  /* ── Lower plyometric ── */
  {
    exercise: 'Box Jumps',
    pool: 'Lower plyometric',
    primary: ['Quads', 'Glutes'],
    secondary: ['Calves'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Broad Jumps',
    pool: 'Lower plyometric',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Calves'],
    experienceGate: 'two_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Jump Squats',
    pool: 'Lower plyometric',
    primary: ['Quads', 'Glutes'],
    secondary: ['Calves'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lateral Bounds',
    pool: 'Lower plyometric',
    primary: ['Quads', 'Glutes'],
    secondary: ['Groin', 'Calves'],
    experienceGate: 'two_plus_years',
    note: '⚑ adductor tagged \'avoid\' (highest injury rating) for a unilateral lateral landing — genuinely borderline vs. advanced-only.',
    flagged: true,
  },
  {
    exercise: 'Depth Jumps',
    pool: 'Lower plyometric',
    primary: ['Quads', 'Glutes'],
    secondary: ['Calves', 'Hamstrings'],
    experienceGate: 'advanced_only',
    note: 'knee + ankle both tagged \'avoid\'; classic high eccentric-overload drop-jump reserved for qualified athletes.',
    flagged: false,
  },

  /* ── Carries ── */
  {
    exercise: 'Farmer Carry',
    pool: 'Carries',
    primary: ['Midline', 'Upper back'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bear Carry',
    pool: 'Carries',
    primary: ['Midline', 'Upper back'],
    secondary: ['Shoulders'],
    experienceGate: 'two_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Suitcase Carry',
    pool: 'Carries',
    primary: ['Midline'],
    secondary: ['Upper back', 'Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Overhead Carry',
    pool: 'Carries',
    primary: ['Shoulders', 'Midline'],
    secondary: ['Upper back'],
    experienceGate: 'two_plus_years',
    note: '',
    flagged: false,
  },

  /* ── Accessories upper ── */
  {
    exercise: 'Shrugs',
    pool: 'Accessories upper',
    primary: ['Upper back'],
    secondary: ['Traps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Skull Crushers',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: 'elbow-strain-prone lockout under barbell load vs. the dumbbell version.',
    flagged: false,
  },
  {
    exercise: 'Bicep Curl (Barbell)',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bicep Curl (Dumbbell)',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Hammer Curl',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Incline Dumbbell Curl',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lying Dumbbell Curl',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Banded Bicep Curl',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone_regression',
    note: 'Regression per Sam 2026-07-25: above-beginner doesn\'t need banded curls',
    flagged: false,
  },
  {
    exercise: 'Concentration Curl',
    pool: 'Accessories upper',
    primary: ['Biceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Tricep Pushdown',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Banded Tricep Pushdown',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Overhead Tricep Extension',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Dumbbell Skull Crusher',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: 'same elbow lockout concern as the barbell version, lighter load.',
    flagged: false,
  },
  {
    exercise: 'Dumbbell Kickback',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Tricep Circuit (Dirty 30)',
    pool: 'Accessories upper',
    primary: ['Triceps'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lateral Raise',
    pool: 'Accessories upper',
    primary: ['Shoulders'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Incline Y Raise',
    pool: 'Accessories upper',
    primary: ['Shoulders', 'Upper back'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Single-Arm Shrug',
    pool: 'Accessories upper',
    primary: ['Upper back'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Accessories lower ── */
  {
    exercise: 'Nordic Lower',
    pool: 'Accessories lower',
    primary: ['Hamstrings'],
    secondary: [],
    experienceGate: 'two_plus_years',
    note: 'hamstring tagged \'avoid\'; classic high-eccentric-overload movement — standard guidance is an eccentric-strength base before loading this.',
    flagged: false,
  },
  {
    exercise: 'Hamstring Curl',
    pool: 'Accessories lower',
    primary: ['Hamstrings'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Leg Extension',
    pool: 'Accessories lower',
    primary: ['Quads'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Calf Raises',
    pool: 'Accessories lower',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Tib Raises',
    pool: 'Accessories lower',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: 'targets tibialis anterior (shin) specifically; \'Calves\' is the closest plain-language bucket.',
    flagged: false,
  },
  {
    exercise: 'Single-Leg Hip Thrust',
    pool: 'Accessories lower',
    primary: ['Glutes'],
    secondary: ['Hamstrings'],
    experienceGate: 'everyone_regression',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Back Extension',
    pool: 'Accessories lower',
    primary: ['Hamstrings', 'Glutes', 'Low back'],
    secondary: ['Midline'],
    experienceGate: 'everyone',
    note: 'targets lower-back extensors specifically; \'Midline\' is the closest plain-language bucket.',
    flagged: false,
  },

  /* ── Upper pull vertical ── */
  {
    exercise: 'Chin-Up Negative (Slow)',
    pool: 'Upper pull vertical',
    primary: ['Lats', 'Biceps'],
    secondary: ['Upper back', 'Midline'],
    experienceGate: 'everyone_regression',
    note: 'Moved per Sam from Arms—biceps (it lived in the biceps pool; now vertical pull).',
    flagged: false,
  },
  {
    exercise: 'Single-Arm Pulldown',
    pool: 'Upper pull vertical',
    primary: ['Lats'],
    secondary: ['Upper back', 'Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Shoulders ── */
  {
    exercise: 'Cable Face Pull',
    pool: 'Shoulders',
    primary: ['Shoulders', 'Upper back'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Upper back ── */
  {
    exercise: 'Chest-Supported DB Row',
    pool: 'Upper back',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Inverted Row (Bodyweight)',
    pool: 'Upper back',
    primary: ['Upper back', 'Lats'],
    secondary: ['Biceps'],
    experienceGate: 'everyone_regression',
    note: '',
    flagged: false,
  },

  /* ── Groin / adductors ── */
  {
    exercise: 'Copenhagen Plank (Half)',
    pool: 'Groin / adductors',
    primary: ['Groin'],
    secondary: ['Midline'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Long-Lever Copenhagen',
    pool: 'Groin / adductors',
    primary: ['Groin'],
    secondary: ['Midline'],
    experienceGate: 'two_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Groin Squeeze',
    pool: 'Groin / adductors',
    primary: ['Groin'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Cossack Squat',
    pool: 'Groin / adductors',
    primary: ['Groin', 'Quads'],
    secondary: ['Glutes', 'Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lateral Lunge',
    pool: 'Groin / adductors',
    primary: ['Groin', 'Quads'],
    secondary: ['Glutes', 'Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },

  /* ── Calves ── */
  {
    exercise: 'Single-Leg Calf Raise',
    pool: 'Calves',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Seated Calf Raise',
    pool: 'Calves',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Lower prehab ── */
  {
    exercise: 'Banded TKE',
    pool: 'Lower prehab',
    primary: ['Quads', 'Knee'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bosch Hold',
    pool: 'Lower prehab',
    primary: ['Hamstrings', 'Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Spanish Squat Hold',
    pool: 'Lower prehab',
    primary: ['Quads', 'Knee'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Slant Board Step-Down',
    pool: 'Lower prehab',
    primary: ['Quads', 'Knee'],
    secondary: ['Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Crab Walks',
    pool: 'Lower prehab',
    primary: ['Glutes', 'Hips'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Midline ── */
  {
    exercise: 'Band Pallof Press',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Dead Bug',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone_regression',
    note: 'Regression confirmed by Sam: plain version — advanced get Banded/Weighted Dead Bug instead',
    flagged: false,
  },
  {
    exercise: 'Banded Dead Bug',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Weighted Dead Bug',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'McGill Sit Up',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Ab Wheel',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'two_plus_years',
    note: '⚑ progressive anti-extension skill move; pubalgia tagged \'avoid\' — could arguably be 1+ years depending on how far the rollout range is regressed.',
    flagged: true,
  },
  {
    exercise: 'Hanging Leg Raise',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Hips'],
    experienceGate: 'one_plus_years',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bird Dog',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Glutes'],
    experienceGate: 'everyone_regression',
    note: 'Regression confirmed by Sam: foundational motor control — or does it belong in the flow?',
    flagged: false,
  },
  {
    exercise: 'Side Plank',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Plank',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone_regression',
    note: 'Regression confirmed by Sam: plain plank — advanced get Stir the Pot / Side Plank Row / Ab Wheel',
    flagged: false,
  },
  {
    exercise: 'Hollow Hold',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Stir the Pot',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Dragon Flag',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'advanced_only',
    note: 'lower back tagged \'avoid\'; classic advanced core skill move, high eccentric demand through the full posterior chain.',
    flagged: false,
  },
  {
    exercise: 'Side Plank Row',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Upper back'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Woodchop (Standing)',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Woodchop (Half Kneeling)',
    pool: 'Midline',
    primary: ['Midline'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Shoulder health ── */
  {
    exercise: 'Banded External Rotation',
    pool: 'Shoulder health',
    primary: ['Shoulders'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Bottoms-Up KB Press',
    pool: 'Shoulder health',
    primary: ['Shoulders'],
    secondary: ['Midline'],
    experienceGate: 'everyone',
    note: '⚑ wrist/shoulder stabilisation demand is real even at light load — could be 1+ years.',
    flagged: true,
  },
  {
    exercise: 'Scap Push-Up',
    pool: 'Shoulder health',
    primary: ['Shoulders', 'Upper back'],
    secondary: ['Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Scap Pull Ups',
    pool: 'Shoulder health',
    primary: ['Shoulders', 'Upper back', 'Lats'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Hamstring (light) ── */
  {
    exercise: 'Swiss Ball Hamstring Curl',
    pool: 'Hamstring (light)',
    primary: ['Hamstrings'],
    secondary: ['Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Tissue quality ── */
  {
    exercise: 'Foam Roll — Hip Flexor, Quad, Adductors',
    pool: 'Tissue quality',
    primary: ['Quads', 'Groin'],
    secondary: ['Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Foam Roll — T-Spine',
    pool: 'Tissue quality',
    primary: ['Upper back'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Foam Roll — IT Band',
    pool: 'Tissue quality',
    primary: ['Quads'],
    secondary: ['Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Foam Roll — Lats',
    pool: 'Tissue quality',
    primary: ['Lats'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Foam Roll — Calves & Outer Shins',
    pool: 'Tissue quality',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lacrosse Ball Glute Release',
    pool: 'Tissue quality',
    primary: ['Glutes'],
    secondary: ['Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Mobility ── */
  {
    exercise: 'Hip 90/90 Stretch',
    pool: 'Mobility',
    primary: ['Hips'],
    secondary: ['Groin'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Cat-Cow',
    pool: 'Mobility',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'World\'s Greatest Stretch',
    pool: 'Mobility',
    primary: ['Hips', 'Groin'],
    secondary: ['Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Deep Squat Hold',
    pool: 'Mobility',
    primary: ['Hips', 'Groin'],
    secondary: ['Calves'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Couch Stretch',
    pool: 'Mobility',
    primary: ['Quads', 'Hips'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Open Book Thoracic Rotation',
    pool: 'Mobility',
    primary: ['Upper back'],
    secondary: ['Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Pigeon Stretch',
    pool: 'Mobility',
    primary: ['Hips', 'Glutes'],
    secondary: ['Groin'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Adductor Rockback',
    pool: 'Mobility',
    primary: ['Groin'],
    secondary: ['Hips'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Chest / Pec Stretch (Doorway)',
    pool: 'Mobility',
    primary: ['Chest'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Lat Stretch',
    pool: 'Mobility',
    primary: ['Lats'],
    secondary: ['Shoulders'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Dead Hang',
    pool: 'Mobility',
    primary: ['Lats', 'Shoulders'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Toe Stretch',
    pool: 'Mobility',
    primary: ['Calves', 'Feet'],
    secondary: [],
    experienceGate: 'everyone',
    note: 'targets the foot/ankle specifically; \'Calves\' is the closest plain-language bucket.',
    flagged: false,
  },
  {
    exercise: 'Calf Stretch',
    pool: 'Mobility',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'QL Back Extension',
    pool: 'Mobility',
    primary: ['Midline'],
    secondary: [],
    experienceGate: 'everyone',
    note: 'targets the quadratus lumborum (side of lower back) specifically; \'Midline\' is the closest plain-language bucket.',
    flagged: false,
  },
  {
    exercise: 'ATG Split Squat',
    pool: 'Mobility',
    primary: ['Quads', 'Hips'],
    secondary: ['Groin', 'Calves'],
    experienceGate: 'everyone',
    note: '⚑ deep ankle/hip mobility demand — some athletes may need to regress the range; could be 1+ years.',
    flagged: true,
  },
  {
    exercise: 'Elephant Walks',
    pool: 'Mobility',
    primary: ['Hamstrings'],
    secondary: ['Calves'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Butterfly Stretch',
    pool: 'Mobility',
    primary: ['Groin', 'Hips'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Pissing Dog Against Wall',
    pool: 'Mobility',
    primary: ['Glutes', 'Hips'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Jefferson Curl',
    pool: 'Mobility',
    primary: ['Upper back', 'Low back', 'Hamstrings'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Dumbbell Pullovers',
    pool: 'Mobility',
    primary: ['Upper back', 'Shoulders'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Easy cardio (zone 1) ── */
  {
    exercise: 'Light Walk or Stationary Bike',
    pool: 'Easy cardio (zone 1)',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Incline Treadmill Walk',
    pool: 'Easy cardio (zone 1)',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Outdoor Walk',
    pool: 'Easy cardio (zone 1)',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Light Skipping',
    pool: 'Easy cardio (zone 1)',
    primary: ['Calves'],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Breathing reset ── */
  {
    exercise: '90/90 Breathing',
    pool: 'Breathing reset',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Crocodile Breathing',
    pool: 'Breathing reset',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Box Breathing',
    pool: 'Breathing reset',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Child\'s Pose with Breathing',
    pool: 'Breathing reset',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },

  /* ── Conditioning ── */
  {
    exercise: 'Sprint Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed; hamstring/calf tagged \'avoid\'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Hill Sprints',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed; hamstring/calf tagged \'avoid\'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Quality Sprints',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed; hamstring/calf tagged \'avoid\'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'MAS Training',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed; hamstring/calf tagged \'avoid\'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Flying Sprints',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'MAS 15:15 Blocks',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Tabata Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Inverse Tabata',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Max Effort Sprint Accumulation',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Free Sprint Session',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ field sprint at top-end speed; hamstring/calf tagged \'avoid\'. Gate here is conditioning base, not lifting experience, so this ladder may not be the right instrument at all.',
    flagged: true,
  },
  {
    exercise: 'Long Run',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: '6x1km',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: '1km Repeat Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: '4x4 VO2',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: '200m/400m Repeat Runs',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'one_plus_years',
    note: '⚑ sprint-adjacent speed endurance at high impact — the training-age ladder is a rough fit for a session format.',
    flagged: true,
  },
  {
    exercise: 'Footy Fartlek',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Hard Row Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Hard SkiErg Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Hard Assault Bike Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Erg EMOM',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Tempo Run',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Long Nasal Run',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: '30:30 Tempo Blocks',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Tempo Intervals (1min on / 1min easy)',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Cruise Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Bike/Row/Ski Tempo Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Air Bike Sprints',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Row Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'SkiErg Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Assault Bike Intervals',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Flush Run',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Easy Bike',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Easy Row',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Easy Ski',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Easy Swim',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },
  {
    exercise: 'Light Circuits',
    pool: 'Conditioning',
    primary: [],
    secondary: [],
    experienceGate: 'everyone',
    note: 'session format, not an individual movement — no meaningful muscle group.',
    flagged: false,
  },

  /* ── Power ── */
  {
    exercise: 'Vertical Jump',
    pool: 'Power',
    primary: ['Glutes', 'Quads', 'Calves'],
    secondary: ['Hamstrings', 'Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Pogo Hops',
    pool: 'Power',
    primary: ['Calves'],
    secondary: ['Quads', 'Midline'],
    experienceGate: 'everyone',
    note: 'takes over when lower niggle (your spec)',
    flagged: false,
  },
  {
    exercise: 'Lateral Jump',
    pool: 'Power',
    primary: ['Glutes', 'Outer hip'],
    secondary: ['Quads', 'Calves', 'Midline'],
    experienceGate: 'everyone',
    note: 'your spec: beginner friendly',
    flagged: false,
  },
  {
    exercise: 'Kneeling Jump',
    pool: 'Power',
    primary: ['Glutes', 'Quads'],
    secondary: ['Hamstrings', 'Midline'],
    experienceGate: 'two_plus_years',
    note: 'your spec: consistent+',
    flagged: false,
  },
  {
    exercise: 'RFE Split Squat Jump',
    pool: 'Power',
    primary: ['Quads', 'Glutes'],
    secondary: ['Hamstrings', 'Calves', 'Midline'],
    experienceGate: 'two_plus_years',
    note: 'FLAG — gate proposed, confirm',
    flagged: false,
  },
  {
    exercise: 'Explosive Push-up',
    pool: 'Power',
    primary: ['Chest', 'Triceps'],
    secondary: ['Shoulders', 'Midline'],
    experienceGate: 'everyone',
    note: '',
    flagged: false,
  },
  {
    exercise: 'Speed Bench',
    pool: 'Power',
    primary: ['Chest', 'Triceps'],
    secondary: ['Shoulders', 'Lats'],
    experienceGate: 'two_plus_years',
    note: 'FLAG — gate proposed, confirm',
    flagged: false,
  },
  {
    exercise: 'Speed Trap Bar Deadlift',
    pool: 'Power',
    primary: ['Glutes', 'Hamstrings'],
    secondary: ['Quads', 'Upper back', 'Grip'],
    experienceGate: 'two_plus_years',
    note: 'FLAG — gate proposed, confirm',
    flagged: false,
  },

];

/** Metadata for one exercise, or null when the sheet carries none. */
export function muscleMetadataFor(exercise: string): ExerciseMuscleEntry | null {
  return EXERCISE_MUSCLE_METADATA.find((entry) => entry.exercise === exercise) ?? null;
}

/** Every entry whose primary OR secondary tags include a muscle group. */
export function exercisesTargeting(muscle: MuscleGroup): readonly ExerciseMuscleEntry[] {
  return EXERCISE_MUSCLE_METADATA.filter(
    (entry) => entry.primary.includes(muscle) || entry.secondary.includes(muscle),
  );
}

/** Every entry in one authored pool. */
export function exercisesInMetadataPool(pool: string): readonly ExerciseMuscleEntry[] {
  return EXERCISE_MUSCLE_METADATA.filter((entry) => entry.pool === pool);
}
