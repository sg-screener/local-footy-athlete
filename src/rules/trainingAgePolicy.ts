import type { ExperienceLevel, SeasonPhase } from '../types/domain';
import { ladderLevelForProfile } from './experienceCrosswalk';

/**
 * The app's one experience ladder. DEFINED in `experienceCrosswalk`, which owns
 * the mapping from the onboarding answer, and re-exported here so that every
 * existing `TrainingAgeLevel` import keeps resolving.
 */
export type { TrainingAgeLevel } from './experienceCrosswalk';
export { TRAINING_AGE_LEVELS, meetsTrainingAgeMinimum } from './experienceCrosswalk';

import type { TrainingAgeLevel } from './experienceCrosswalk';

export type TrainingAgePoolSlot =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'isolation_lower';

export interface TrainingAgePolicy {
  level: TrainingAgeLevel;
  maxCoreSessions: number | null;
  maxHardExposures: Readonly<Record<SeasonPhase, number>> | null;
  maxOptionalSessions: number | null;
  maxExercisesPerStrengthSession: number;
  maxSetsPerExercise: number | null;
  compoundRepMin: number | null;
  compoundRepMax: number | null;
  targetRpeMin: number | null;
  targetRpeMax: number | null;
  initialLoadMultiplier: number;
  avoidCombinedStrengthConditioning: boolean;
  exercisePriority: Readonly<Partial<Record<TrainingAgePoolSlot, readonly string[]>>>;
}

const NORMAL_POLICY: Omit<TrainingAgePolicy, 'level'> = {
  maxCoreSessions: null,
  maxHardExposures: null,
  maxOptionalSessions: null,
  /**
   * SEVEN, ruled by Sam 2026-08-13 as **R-088**: *"7 strength exercises can be a
   * cap… so 7 is the max the app should set"*.
   *
   * **IT WAS 6, AND NOBODY EVER AUTHORED THE 6.** Bible `:122` says *"6-7
   * exercises"* and *"full body strength and 7 exercises"*; R-087 restates that
   * size as unmoved. **The unauthored 6 is the same defect R-013 abolished the
   * beginner's 3 for** — and it survived only because nothing enforced the cap,
   * so the number was never wrong out loud.
   *
   * **WHAT IT COUNTS IS `exerciseBudgetRows`, NOT SESSION ROWS** — the mobility
   * warm-up, the prehab flow and the mobility half of every R-015 superset are
   * all free of it. **AND IT BINDS THE APP, NOT THE ATHLETE:** *"a user should
   * be able to add as many of their own things on top of it as they choose"*.
   */
  maxExercisesPerStrengthSession: 7,
  maxSetsPerExercise: null,
  compoundRepMin: null,
  compoundRepMax: null,
  targetRpeMin: null,
  targetRpeMax: null,
  initialLoadMultiplier: 1,
  avoidCombinedStrengthConditioning: false,
  exercisePriority: {},
};

const BEGINNER_EXERCISE_PRIORITY: TrainingAgePolicy['exercisePriority'] = {
  squat: [
    'Goblet Squat',
    'Step Ups',
    'Bodyweight Squat',
    'Reverse Lunges',
    'Box Squat',
  ],
  hinge: [
    'Trap Bar Deadlift',
    'Single-Leg RDL',
    'Glute Bridge',
    'Hip Thrusts',
  ],
  horizontal_push: [
    'DB Bench Press',
    'Push-ups',
    'Incline DB Bench',
  ],
  vertical_push: [
    'Seated DB Press',
    'Half-Kneeling Single-Arm Overhead Press',
    'Push-ups',
  ],
  horizontal_pull: [
    'Seated Cable Row',
    'Single-Arm DB Row',
    'Inverted Row (Bodyweight)',
  ],
  vertical_pull: [
    'Lat Pulldown',
    'Neutral-Grip Pulldown',
    'Inverted Row (Bodyweight)',
  ],
  isolation_lower: [
    'Glute Bridge',
    'Bodyweight Squat',
  ],
};

/**
 * The new-athlete policy — DOSE ONLY (Sam, 2026-07-27, Bible §11).
 *
 * A sweep found twelve beginner-only limits here; most were invented rather
 * than authored, and one CONTRADICTED §11 (it capped sets at 2 while the Bible
 * says 2-3). Sam's ruling: training age changes the DOSE, the COMPLEXITY and
 * the PROGRESSION SPEED — not the structure of the week.
 *
 * So every STRUCTURAL field now matches the universal policy, and the only
 * differences left are the dose values §11 actually authors. The rules-kernel
 * suite asserts that: a new beginner-only structural limit fails the build.
 *
 * What died, and why:
 *   maxCoreSessions / maxOptionalSessions / maxHardExposures — the universal
 *     Section 17 B caps and the Section 18 phase table govern every training
 *     age. The Section 18 line that once authored a beginner mid-off-season
 *     structure was retired by Sam on 2026-07-27, so nothing is left for a
 *     beginner-only core cap to rest on.
 *   maxExercisesPerStrengthSession: 3 — never authored. "Do not overload them
 *     with too many exercises" is guidance about dose, not a numeric limit, and
 *     a beginner-only cap is the second beginner/experienced representation
 *     §11 forbids.
 *   avoidCombinedStrengthConditioning — steered beginners away from combined
 *     sessions the Bible PREFERS.
 */
const NEW_ATHLETE_POLICY: TrainingAgePolicy = {
  level: 'new',
  ...NORMAL_POLICY,
  // ── The authored §11 dose, and nothing else ──
  /** "Start with 2-3 sets on most lifts." The code used to forbid the 3. */
  maxSetsPerExercise: 3,
  compoundRepMin: 4,
  compoundRepMax: 8,
  /** "Not close to failure" — Sam blessed 6-7, so the number is authored now. */
  targetRpeMin: 6,
  targetRpeMax: 7,
  /**
   * Beginners start at 50% of the calculated load and adjust from there
   * (Sam, 2026-07-27). A starting point, not a ceiling: load is athlete-owned
   * per D1. Supersedes an invented 0.75.
   */
  initialLoadMultiplier: 0.5,
  /** §11's "Good options" — simple, safe, easy-to-learn movements. */
  exercisePriority: BEGINNER_EXERCISE_PRIORITY,
};
/**
 * The policy body for an athlete at a ladder level.
 *
 * The onboarding answer -> ladder mapping is NOT repeated here: it is authored
 * law owned by `experienceCrosswalk` (Bible Section 11, "No other crosswalk may
 * exist"). This function only decides which policy body rides on a level, which
 * is the part that genuinely belongs to the policy.
 */
export function resolveTrainingAgePolicy(
  experienceLevel: ExperienceLevel | null | undefined,
): TrainingAgePolicy {
  const level = ladderLevelForProfile(experienceLevel);
  return level === 'new' ? NEW_ATHLETE_POLICY : { level, ...NORMAL_POLICY };
}
