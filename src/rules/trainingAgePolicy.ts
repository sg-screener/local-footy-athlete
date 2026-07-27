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
  maxExercisesPerStrengthSession: 6,
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

const NEW_ATHLETE_POLICY: TrainingAgePolicy = {
  level: 'new',
  maxCoreSessions: 2,
  maxHardExposures: {
    'In-season': 3,
    'Pre-season': 3,
    'Off-season': 3,
  },
  maxOptionalSessions: 1,
  maxExercisesPerStrengthSession: 3,
  maxSetsPerExercise: 2,
  compoundRepMin: 4,
  compoundRepMax: 8,
  targetRpeMin: 6,
  targetRpeMax: 7,
  initialLoadMultiplier: 0.75,
  avoidCombinedStrengthConditioning: true,
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
