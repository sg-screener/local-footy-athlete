import {
  TrainingProgram,
  Microcycle,
  Workout,
  WorkoutExercise,
  Exercise,
  UserProfile,
  SessionTier,
  OnboardingData,
  SeasonPhase,
  AttachedConditioningKind,
  ConditioningBlock,
  IntensityLevel,
  SpeedBlock,
  PowerBlock,
  PowerBlockOption,
  WorkoutType,
} from '../types/domain';
import {
  classifyGenerationSession,
  type SessionAllocation,
} from '../utils/coachingEngine';
import { logger } from '../utils/logger';
import { addDaysISO, computeBlockBounds } from '../utils/programBlockState';
import {
  dayOfWeekForISODate,
  todayISOLocal,
} from '../utils/appDate';
import {
  applyLoadEstimates,
  EXERCISE_LOAD_MAP,
  estimateStartingWeight,
  isTrueBodyweightExercise,
  resolveExerciseName,
  roundToEquipment,
} from '../utils/loadEstimation';
import {
  buildConditioningTemplate,
  condEx,
  conditioningFlavourToExerciseName,
  conditioningCategoryToExerciseName,
  conditioningWorkoutType,
  isRunningBasedConditioning,
  switchToOffFeetModality,
  tagAsShiftedFromRun,
  conditioningDateHash,
  selectDefaultAerobicErgModalityFromHash,
  SPEED_SPRINT_TEMPLATES,
  type ErgModality,
  type ConditioningFeel,
  type ConditioningVariant,
} from '../utils/sessionBuilder';
import {
  ACCESSORY_REP_GUIDELINES,
  LOWER_SECONDARY_REP_GUIDELINES,
  resolveMainLiftRepSchemes,
  type AccessoryGuideline,
  type RepScheme,
} from '../rules/phaseRepSchemes';
import {
  resolveOffseasonSubphase,
  type OffseasonSubphase,
} from '../rules/offseasonSubphase';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import {
  applyStrengthDeloadToExercises,
  deloadConditioningCategory,
  deloadConditioningFlavour,
  isHardDeloadConditioningCategory,
  resolveDeloadWeekPolicy,
  type DeloadWeekPolicy,
} from '../rules/deloadWeekRules';
import {
  canonicalStrengthLabel,
  isConditioningOnlyText,
  resolveSessionDisplayName,
} from '../utils/sessionNaming';
import {
  applyPoolRotation,
  classifyPoolSlot,
  findPoolEntry,
  type RotationContext,
  type AthletePoolPrefs,
  type PoolSlotKey,
} from './exercisePoolsStrength';
import { isTeamTrainingItem } from '../utils/teamTraining';
import {
  attachPrescriptionEffectEvidence,
  attachSessionEffectEvidence,
  buildPrescriptionEffectEvidence,
} from '../utils/deterministicCoachNoteFactory';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import {
  mainPatternsForLegacyStrengthPattern,
  normalizeStrengthIntent,
  type StrengthIntent,
} from '../rules/strengthPatternContributions';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import {
  applyResolvedConditioningSubstitution,
  resolveWeeklyConditioningFeasibility,
} from '../rules/conditioningFeasibility';

/**
 * Default exercises used in the training program
 */
export const DEFAULT_EXERCISES: Exercise[] = [
  // Lower Strength
  {
    id: 'ex-squat',
    name: 'Back Squat',
    description: 'Heavy compound leg exercise',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings'],
    equipmentRequired: ['Barbell', 'Rack'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-bulgarian-split',
    name: 'Bulgarian Split Squats',
    description: 'Single leg squat variation',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: ['Dumbbells', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-rdl',
    name: 'RDLs',
    description: 'Romanian Deadlifts - posterior chain',
    exerciseType: 'Compound',
    muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-leg-press',
    name: 'Leg Press',
    description: 'Machine leg press exercise',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: ['Machine'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-goblet-squat',
    name: 'Goblet Squat',
    description: 'Squat with dumbbell',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-bodyweight-squat',
    name: 'Bodyweight Squat',
    description: 'Controlled squat pattern for technique and range',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-glute-bridge',
    name: 'Glute Bridge',
    description: 'Bodyweight hip extension and hinge pattern',
    exerciseType: 'Compound',
    muscleGroups: ['Glutes', 'Hamstrings'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-calf-raises',
    name: 'Calf Raises',
    description: 'Standing calf raise',
    exerciseType: 'Isolation',
    muscleGroups: ['Calves'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Upper Strength
  {
    id: 'ex-bench-press',
    name: 'Bench Press',
    description: 'Heavy chest press',
    exerciseType: 'Compound',
    muscleGroups: ['Chest', 'Triceps', 'Front Shoulders'],
    equipmentRequired: ['Barbell', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-overhead-press',
    name: 'Overhead Press',
    description: 'Standing shoulder press',
    exerciseType: 'Compound',
    muscleGroups: ['Shoulders', 'Triceps', 'Chest'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-db-rows',
    name: 'Single-Arm DB Row',
    description: 'Dumbbell rows',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-inverted-row',
    name: 'Inverted Row (Bodyweight)',
    description: 'Bodyweight row with an adjustable torso angle',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-face-pulls',
    name: 'Face Pulls',
    description: 'Rear delt and back exercise',
    exerciseType: 'Isolation',
    muscleGroups: ['Rear Delts', 'Back'],
    equipmentRequired: ['Cable Machine'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-tricep-dips',
    name: 'Dips',
    description: 'Bodyweight or weighted dips',
    exerciseType: 'Compound',
    muscleGroups: ['Triceps', 'Chest', 'Shoulders'],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Lower Hypertrophy
  {
    id: 'ex-trap-bar-deadlift',
    name: 'Trap Bar Deadlift',
    description: 'Deadlift with trap bar',
    exerciseType: 'Compound',
    muscleGroups: ['Glutes', 'Hamstrings', 'Quadriceps', 'Lower Back'],
    equipmentRequired: ['Trap Bar'],
    difficultyLevel: 'Advanced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-hip-thrusts',
    name: 'Hip Thrusts',
    description: 'Barbell hip thrusts',
    exerciseType: 'Compound',
    muscleGroups: ['Glutes', 'Hamstrings'],
    equipmentRequired: ['Barbell', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-walking-lunges',
    name: 'Walking Lunges',
    description: 'Walking lunge steps',
    exerciseType: 'Compound',
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-leg-extension',
    name: 'Leg Extension',
    description: 'Machine quad isolation',
    exerciseType: 'Isolation',
    muscleGroups: ['Quads'],
    equipmentRequired: ['Machine'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-nordic-lower',
    name: 'Nordic Lower',
    description: 'Nordic hamstring lower - eccentric posterior-chain isolation',
    exerciseType: 'Isolation',
    muscleGroups: ['Hamstrings'],
    equipmentRequired: [],
    difficultyLevel: 'Advanced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Upper Hypertrophy
  {
    id: 'ex-pullups',
    name: 'Pull-Ups',
    description: 'Bodyweight pullups',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-incline-db-bench',
    name: 'Incline DB Bench',
    description: 'Incline dumbbell bench press',
    exerciseType: 'Compound',
    muscleGroups: ['Upper Chest', 'Front Shoulders', 'Triceps'],
    equipmentRequired: ['Dumbbells', 'Bench'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-barbell-rows',
    name: 'Barbell Row',
    description: 'Barbell bent-over rows',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-lateral-raises',
    name: 'Lateral Raise',
    description: 'Dumbbell lateral raises',
    exerciseType: 'Isolation',
    muscleGroups: ['Shoulders'],
    equipmentRequired: ['Dumbbells'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-barbell-curls',
    name: 'Bicep Curl (Barbell)',
    description: 'Barbell bicep curls',
    exerciseType: 'Isolation',
    muscleGroups: ['Biceps'],
    equipmentRequired: ['Barbell'],
    difficultyLevel: 'Beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Conditioning
  {
    id: 'ex-sprint-intervals',
    name: 'Sprint Intervals',
    description: '100m sprint repeats',
    exerciseType: 'Cardio',
    muscleGroups: [],
    equipmentRequired: [],
    difficultyLevel: 'Advanced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ex-tempo-run',
    name: 'Tempo Run',
    description: 'Sustained running pace',
    exerciseType: 'Cardio',
    muscleGroups: [],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Create workout exercises for a given workout
 */
function createWorkoutExercises(workoutId: string, exercises: any[]): WorkoutExercise[] {
  return exercises.map((ex, index) => ({
    id: `we-${workoutId}-${index}`,
    workoutId,
    exerciseId: ex.exerciseId,
    exerciseOrder: index + 1,
    prescribedSets: ex.sets,
    prescribedRepsMin: ex.repsMin,
    prescribedRepsMax: ex.repsMax,
    prescribedWeightKg: ex.weight,
    restSeconds: ex.rest,
    notes: ex.notes,
    exercise: DEFAULT_EXERCISES.find((e) => e.id === ex.exerciseId),
    // Explicit superset fields — only populated when template data provides them
    ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
    ...(ex.supersetOrder ? { supersetOrder: ex.supersetOrder } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Create a workout for a specific day
 */
function createWorkout(
  microcycleId: string,
  dayOfWeek: number,
  name: string,
  description: string,
  intensity: IntensityLevel,
  type: WorkoutType,
  exercises: any[],
  durationMinutes: number,
  sessionTier?: 'core' | 'optional' | 'recovery'
): Workout {
  const workoutId = `w-${dayOfWeek}`;
  return {
    id: workoutId,
    microcycleId,
    dayOfWeek,
    name,
    description,
    intensity,
    workoutType: type,
    sessionTier,
    durationMinutes,
    exercises: createWorkoutExercises(workoutId, exercises),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create the default microcycle (1 week)
 */
function createDefaultMicrocycle(programId: string, onboardingData?: OnboardingData): Microcycle {
  const today = new Date(`${todayISOLocal()}T12:00:00`);
  const { blockStart } = computeBlockBounds(today);
  const startDate = new Date(blockStart + 'T12:00:00');

  // Microcycle = 1 week (Mon–Sun)
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const workouts: Workout[] = [
    // Monday: Lower Strength
    createWorkout(
      'mc-1',
      1,
      'Lower Strength',
      'Heavy leg day with squat focus',
      'High',
      'Strength',
      [
        { exerciseId: 'ex-squat', sets: 4, repsMin: 5, repsMax: 5, weight: 100, rest: 180 },
        { exerciseId: 'ex-bulgarian-split', sets: 3, repsMin: 8, repsMax: 12, weight: 30, rest: 90 },
        { exerciseId: 'ex-rdl', sets: 3, repsMin: 8, repsMax: 10, weight: 80, rest: 120 },
        { exerciseId: 'ex-goblet-squat', sets: 3, repsMin: 10, repsMax: 12, weight: 20, rest: 90 },
        { exerciseId: 'ex-calf-raises', sets: 3, repsMin: 12, repsMax: 15, weight: 0, rest: 60 },
      ],
      75,
      'core'
    ),

    // Tuesday: Team Training
    createWorkout(
      'mc-1',
      2,
      'Team Training',
      'Footy training night',
      'Moderate',
      'Team Training',
      [],
      45,
      'core'
    ),

    // Wednesday: Upper Strength
    createWorkout(
      'mc-1',
      3,
      'Upper Strength',
      'Heavy pressing day',
      'High',
      'Strength',
      [
        { exerciseId: 'ex-bench-press', sets: 4, repsMin: 5, repsMax: 5, weight: 80, rest: 180 },
        { exerciseId: 'ex-overhead-press', sets: 3, repsMin: 6, repsMax: 8, weight: 50, rest: 120 },
        { exerciseId: 'ex-db-rows', sets: 3, repsMin: 8, repsMax: 10, weight: 35, rest: 90 },
        { exerciseId: 'ex-face-pulls', sets: 3, repsMin: 12, repsMax: 15, weight: 0, rest: 60 },
        { exerciseId: 'ex-tricep-dips', sets: 3, repsMin: 8, repsMax: 12, weight: 0, rest: 90 },
      ],
      75,
      'core'
    ),

    // Thursday: Team Training
    createWorkout(
      'mc-1',
      4,
      'Team Training',
      'Footy training night',
      'Moderate',
      'Team Training',
      [],
      40,
      'core'
    ),

    // Friday: Lower Hinge
    createWorkout(
      'mc-1',
      5,
      'Lower Hinge',
      'Hip hinge focus with high volume',
      'Moderate',
      'Strength',
      [
        { exerciseId: 'ex-trap-bar-deadlift', sets: 4, repsMin: 6, repsMax: 8, weight: 120, rest: 150 },
        { exerciseId: 'ex-hip-thrusts', sets: 3, repsMin: 10, repsMax: 12, weight: 80, rest: 90 },
        { exerciseId: 'ex-walking-lunges', sets: 3, repsMin: 10, repsMax: 10, weight: 30, rest: 90 },
        { exerciseId: 'ex-nordic-lower', sets: 3, repsMin: 3, repsMax: 5, weight: 0, rest: 90 },
        { exerciseId: 'ex-leg-extension', sets: 3, repsMin: 10, repsMax: 12, weight: 0, rest: 90 },
        { exerciseId: 'ex-calf-raises', sets: 3, repsMin: 12, repsMax: 15, weight: 0, rest: 60 },
      ],
      80,
      'optional'
    ),

    // Saturday: Upper Push
    createWorkout(
      'mc-1',
      6,
      'Upper Push',
      'Low-fatigue push and arm accessory work',
      'Moderate',
      'Strength',
      [
        { exerciseId: 'ex-incline-db-bench', sets: 3, repsMin: 8, repsMax: 10, weight: 30, rest: 90 },
        { exerciseId: 'ex-overhead-press', sets: 3, repsMin: 6, repsMax: 8, weight: 45, rest: 120 },
        { exerciseId: 'ex-lateral-raises', sets: 3, repsMin: 12, repsMax: 15, weight: 10, rest: 60 },
        { exerciseId: 'ex-tricep-dips', sets: 3, repsMin: 8, repsMax: 12, weight: 0, rest: 90 },
        { exerciseId: 'ex-barbell-curls', sets: 3, repsMin: 10, repsMax: 12, weight: 30, rest: 60 },
      ],
      80,
      'optional'
    ),

    // Sunday: Rest day (no workout)
  ];

  const phaseAwareWorkouts = onboardingData?.seasonPhase
    ? workouts.map((workout) => ({
        ...workout,
        exercises: applyPhaseRepSchemesToWorkoutExercises(workout.exercises, {
          seasonPhase: onboardingData.seasonPhase,
          workoutName: workout.name,
          workoutType: workout.workoutType,
        }),
      }))
    : workouts;

  // Apply intelligent load estimates if onboarding data is available
  const finalWorkouts = onboardingData
    ? phaseAwareWorkouts.map(w => ({
        ...w,
        exercises: applyTrainingAgePrescription(
          applyLoadEstimates(w.exercises, onboardingData),
          onboardingData,
          {
            seasonPhase: onboardingData.seasonPhase,
            workoutName: w.name,
            workoutType: w.workoutType,
          },
        ),
      }))
    : phaseAwareWorkouts;

  return {
    id: 'mc-1',
    programId,
    weekNumber: 1,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    miniCycleNumber: 1,
    intensityMultiplier: 1.0,
    workouts: finalWorkouts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Find an exercise by name (case-insensitive partial match) or create a simple one.
 *
 * Exported so the cross-cycle variation layer can resolve pool sibling
 * names to their canonical Exercise.id — needed for progression transfer
 * (pulling logged sets across rotated anchors in the same slot).
 */
export function findOrCreateExercise(name: string): Exercise {
  const lower = name.toLowerCase();

  // Pass 1 — exact match (case-insensitive). Always preferred.
  const exact = DEFAULT_EXERCISES.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;

  // Pass 2 — fuzzy substring match, but ONLY for non-pool-managed names.
  //
  // The strength pool system canonicalises exercise names upstream; once a
  // name is in a pool, its identity is authoritative and must not be
  // collapsed onto a different pool member via substring match. Without
  // this guard "Deadlift" would be fuzzy-matched to "Trap Bar Deadlift"
  // (because "trap bar deadlift".includes("deadlift") is true), silently
  // breaking cross-cycle anchor rotation. For non-pool AI-suggested names
  // (typos, regional variants) the fuzzy fallback is still useful.
  if (!findPoolEntry(name)) {
    const fuzzy = DEFAULT_EXERCISES.find(
      (e) => e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase()),
    );
    if (fuzzy) return fuzzy;
  }

  // Pass 3 — fall through to a custom Exercise.
  return {
    id: `ex-custom-${lower.replace(/[^a-z0-9]/g, '-')}`,
    name,
    description: name,
    exerciseType: 'Compound',
    muscleGroups: [],
    equipmentRequired: [],
    difficultyLevel: 'Intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export type CoachGeneratedWorkoutInput = {
  planEntryId?: string;
  strengthIntent?: StrengthIntent;
  dayOfWeek: number;
  name: string;
  workoutType: string;
  sessionTier?: string;
  exercises: Array<{
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    notes?: string;
    supersetGroup?: string;
    supersetOrder?: number;
    pairType?: string;
  }>;
};

type PhasePrescriptionContext = {
  seasonPhase?: SeasonPhase;
  offseasonSubphase?: OffseasonSubphase | null;
  workoutName?: string;
  workoutType?: string;
  planEntry?: SessionAllocation | null;
};

const MAIN_LIFT_POOL_SLOTS = new Set<PoolSlotKey>([
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

const REP_ACCESSORY_POOL_SLOTS = new Set<PoolSlotKey>([
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'isolation_upper',
  'isolation_lower',
]);

const MIN_SUBPHASE_LOAD_BY_EQUIPMENT = {
  barbell: 20,
  dumbbell: 5,
  cable: 5,
  machine: 10,
  kettlebell: 8,
  bodyweight: 0,
} as const;

function baseSetsFromScheme(scheme: RepScheme): number {
  const match = /^(\d+)x/i.exec(scheme.base);
  const parsed = match ? Number(match[1]) : 3;
  return Math.min(scheme.setsMax, Math.max(scheme.setsMin, parsed || 3));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function mainLiftSchemeForSlot(
  slot: PoolSlotKey,
  seasonPhase: SeasonPhase,
  offseasonSubphase?: OffseasonSubphase | null,
): RepScheme | null {
  const schemes = resolveMainLiftRepSchemes(seasonPhase, offseasonSubphase);
  if (slot === 'squat' || slot === 'hinge') return schemes.lower;
  if (slot === 'horizontal_push' || slot === 'vertical_push') return schemes.upperPush;
  if (slot === 'horizontal_pull' || slot === 'vertical_pull') return schemes.upperPull;
  return null;
}

function appendRepSchemeIntent(
  notes: string | undefined,
  scheme: RepScheme,
): string | undefined {
  if (scheme.targetRpeMin === undefined || scheme.targetRpeMax === undefined) return notes;
  const target = `Target RPE ${scheme.targetRpeMin}-${scheme.targetRpeMax}. ${scheme.intent}`;
  if (!notes) return target;
  if (notes.includes(target)) return notes;
  return `${notes} ${target}`;
}

function accessoryGuidelineForExercise(
  exerciseName: string,
  slot: PoolSlotKey,
  context: PhasePrescriptionContext,
  isLowerSecondary: boolean,
): AccessoryGuideline {
  const text = `${exerciseName} ${context.workoutName ?? ''} ${context.planEntry?.focus ?? ''}`;
  if (/nordic/i.test(exerciseName)) return ACCESSORY_REP_GUIDELINES.nordics;
  if (slot === 'isolation_upper' || /gunshow|pump|arms?|bicep|tricep|curl|pushdown|lateral raise|rear delt|face pull/i.test(text)) {
    return ACCESSORY_REP_GUIDELINES.pump;
  }
  if (isLowerSecondary && context.seasonPhase) {
    return LOWER_SECONDARY_REP_GUIDELINES[context.seasonPhase];
  }
  return ACCESSORY_REP_GUIDELINES.general;
}

function isAccessoryPrescriptionContext(context: PhasePrescriptionContext): boolean {
  if (context.planEntry?.strengthPattern || context.planEntry?.hasCombinedConditioning) return false;
  const text = `${context.workoutName ?? ''} ${context.workoutType ?? ''} ${context.planEntry?.focus ?? ''}`;
  return /\b(gunshow|prehab|pump|accessor|trunk|arms?|bicep|tricep|delts?)\b/i.test(text);
}

function isStrengthPrescriptionContext(context: PhasePrescriptionContext): boolean {
  if (!context.seasonPhase) return false;
  const planEntry = context.planEntry;

  if (planEntry?.conditioningFlavour && !planEntry.hasCombinedConditioning) return false;
  if (planEntry?.tier === 'recovery') return false;

  const text = `${context.workoutName ?? ''} ${context.workoutType ?? ''} ${planEntry?.focus ?? ''}`;
  if (/\b(recovery|mobility|foam rolling|conditioning|aerobic|tempo|sprint|interval|game)\b/i.test(text) &&
      !/\b(strength|upper|lower|push|pull|squat|hinge|full body|gunshow|accessor|prehab|pump)\b/i.test(text)) {
    return false;
  }

  if (planEntry?.strengthPattern) return true;
  if (planEntry?.hasCombinedConditioning) return true;
  return /\b(strength|upper|lower|push|pull|squat|hinge|full body|gunshow|accessor|prehab|pump)\b/i.test(text);
}

function applyPhaseRepSchemeToExercise(
  exercise: WorkoutExercise,
  context: PhasePrescriptionContext,
): WorkoutExercise {
  if (!isStrengthPrescriptionContext(context) || exercise.prescriptionType && exercise.prescriptionType !== 'reps') {
    return exercise;
  }

  const seasonPhase = context.seasonPhase!;
  const exerciseName = exercise.exercise?.name ?? '';
  const classification = classifyPoolSlot(resolveExerciseName(exerciseName));
  if (!classification) return exercise;

  const { slot, role } = classification;
  const accessoryContext = isAccessoryPrescriptionContext(context);
  if (!accessoryContext && role === 'anchor' && MAIN_LIFT_POOL_SLOTS.has(slot)) {
    const scheme = mainLiftSchemeForSlot(slot, seasonPhase, context.offseasonSubphase);
    if (!scheme) return exercise;
    return {
      ...exercise,
      prescribedSets: baseSetsFromScheme(scheme),
      prescribedRepsMin: scheme.repsMin,
      prescribedRepsMax: scheme.repsMax,
      notes: appendRepSchemeIntent(exercise.notes, scheme),
    };
  }

  if (!REP_ACCESSORY_POOL_SLOTS.has(slot)) return exercise;
  const lowerSecondary =
    (slot === 'squat' || slot === 'hinge') &&
    (role === 'accessory' || accessoryContext);
  const guideline = accessoryGuidelineForExercise(
    exerciseName,
    slot,
    context,
    lowerSecondary,
  );
  if (guideline.unit !== 'reps') return exercise;
  const setsFallback = Math.min(guideline.setsMax, Math.max(guideline.setsMin, exercise.prescribedSets || guideline.setsMin));
  return {
    ...exercise,
    prescribedSets: clampInt(exercise.prescribedSets, guideline.setsMin, guideline.setsMax, setsFallback),
    prescribedRepsMin: guideline.min,
    prescribedRepsMax: guideline.max,
  };
}

function applyPhaseRepSchemesToWorkoutExercises(
  exercises: WorkoutExercise[],
  context: PhasePrescriptionContext,
): WorkoutExercise[] {
  return exercises.map((exercise) => applyPhaseRepSchemeToExercise(exercise, context));
}

function applySubphaseMainLiftLoadMultiplier(
  exercises: WorkoutExercise[],
  context: PhasePrescriptionContext,
): WorkoutExercise[] {
  if (context.seasonPhase !== 'Off-season' || !context.offseasonSubphase) return exercises;
  if (!isStrengthPrescriptionContext(context) || isAccessoryPrescriptionContext(context)) return exercises;

  return exercises.map((exercise) => {
    const name = exercise.exercise?.name ?? '';
    const classification = classifyPoolSlot(resolveExerciseName(name));
    if (!classification || classification.role !== 'anchor' || !MAIN_LIFT_POOL_SLOTS.has(classification.slot)) {
      return exercise;
    }
    const scheme = mainLiftSchemeForSlot(
      classification.slot,
      context.seasonPhase!,
      context.offseasonSubphase,
    );
    const multiplier = scheme?.loadMultiplier ?? 1;
    const weight = exercise.prescribedWeightKg ?? 0;
    if (multiplier >= 1 || weight <= 0) return exercise;

    const resolvedName = resolveExerciseName(name);
    const equipment = EXERCISE_LOAD_MAP[resolvedName]?.equipment;
    const adjustedWeight = equipment
      ? Math.max(
          MIN_SUBPHASE_LOAD_BY_EQUIPMENT[equipment],
          roundToEquipment(weight * multiplier, equipment),
        )
      : Math.round((weight * multiplier) / 2.5) * 2.5;
    return { ...exercise, prescribedWeightKg: adjustedWeight };
  });
}

function appendBeginnerTechniqueIntent(
  notes: string | undefined,
  targetRpeMin: number,
  targetRpeMax: number,
): string {
  let next = notes ?? '';
  if (!new RegExp(`Target RPE ${targetRpeMin}-${targetRpeMax}`, 'i').test(next)) {
    next = `${next}${next ? ' ' : ''}Target RPE ${targetRpeMin}-${targetRpeMax}.`;
  }
  const technique = 'Use controlled technique and stop well before failure.';
  if (!next.includes(technique)) next = `${next}${next ? ' ' : ''}${technique}`;
  return next;
}

function applyTrainingAgePrescription(
  exercises: WorkoutExercise[],
  onboardingData: OnboardingData,
  context: PhasePrescriptionContext,
): WorkoutExercise[] {
  const policy = resolveTrainingAgePolicy(onboardingData.experienceLevel);
  if (
    policy.level !== 'new' ||
    !isStrengthPrescriptionContext(context) ||
    policy.maxSetsPerExercise === null ||
    policy.compoundRepMin === null ||
    policy.compoundRepMax === null ||
    policy.targetRpeMin === null ||
    policy.targetRpeMax === null
  ) {
    return exercises;
  }

  return exercises.map((exercise) => {
    if (exercise.prescriptionType && exercise.prescriptionType !== 'reps') return exercise;
    const exerciseName = exercise.exercise?.name ?? '';
    const classification = classifyPoolSlot(exerciseName);
    if (!classification) return exercise;

    const compound = MAIN_LIFT_POOL_SLOTS.has(classification.slot);
    const repsMin = compound
      ? Math.min(
          policy.compoundRepMax,
          Math.max(policy.compoundRepMin, exercise.prescribedRepsMin),
        )
      : exercise.prescribedRepsMin;
    const repsMax = compound
      ? Math.max(
          repsMin,
          Math.min(policy.compoundRepMax, exercise.prescribedRepsMax),
        )
      : exercise.prescribedRepsMax;

    let prescribedWeightKg = exercise.prescribedWeightKg;
    if (!isTrueBodyweightExercise(exerciseName)) {
      const estimated = estimateStartingWeight(exerciseName, onboardingData);
      const equipment = EXERCISE_LOAD_MAP[resolveExerciseName(exerciseName)]?.equipment;
      if (estimated && equipment) {
        const beginnerCap = roundToEquipment(
          estimated * policy.initialLoadMultiplier,
          equipment,
        );
        prescribedWeightKg = prescribedWeightKg && prescribedWeightKg > 0
          ? Math.min(prescribedWeightKg, beginnerCap)
          : beginnerCap;
      }
    }

    return {
      ...exercise,
      prescribedSets: Math.max(1, Math.min(policy.maxSetsPerExercise, exercise.prescribedSets || 1)),
      prescribedRepsMin: repsMin,
      prescribedRepsMax: repsMax,
      prescribedWeightKg,
      notes: appendBeginnerTechniqueIntent(
        exercise.notes,
        policy.targetRpeMin,
        policy.targetRpeMax,
      ),
    };
  });
}

/**
 * Day name → JS dayOfWeek number (0=Sun..6=Sat).
 * Must match coachingEngine's DAY_NAMES indexing.
 */
const PLAN_DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Convert the coaching engine's weeklyPlan into a day-of-week lookup.
 * Key: numeric dayOfWeek (0–6). Value: the engine's SessionAllocation.
 * Used to enforce deterministic structural fields over AI output.
 */
function buildPlanLookup(
  weeklyPlan: SessionAllocation[],
): Map<number, SessionAllocation> {
  const lookup = new Map<number, SessionAllocation>();
  for (const entry of weeklyPlan) {
    if (entry.dayOfWeek) {
      const dow = PLAN_DAY_MAP[entry.dayOfWeek];
      if (dow !== undefined) lookup.set(dow, entry);
    }
  }
  return lookup;
}

function buildPlanIdentityLookup(
  weeklyPlan: SessionAllocation[],
): Map<string, SessionAllocation> {
  return new Map(
    weeklyPlan
      .filter((entry): entry is SessionAllocation & { planEntryId: string } => !!entry.planEntryId)
      .map((entry) => [entry.planEntryId, entry]),
  );
}

function resolveGeneratedPlanEntry(
  workout: Pick<CoachGeneratedWorkoutInput, 'dayOfWeek' | 'planEntryId'>,
  planIdentityLookup: Map<string, SessionAllocation> | null,
  planLookup: Map<number, SessionAllocation> | null,
): SessionAllocation | null {
  const identityMatch = workout.planEntryId
    ? planIdentityLookup?.get(workout.planEntryId)
    : undefined;
  if (
    identityMatch?.dayOfWeek &&
    PLAN_DAY_MAP[identityMatch.dayOfWeek] === workout.dayOfWeek
  ) {
    return identityMatch;
  }
  return planLookup?.get(workout.dayOfWeek) ?? null;
}

function fallbackWorkoutTypeForPlanEntry(entry: SessionAllocation): string {
  if (entry.isTeamDay) return 'Team Training';
  if (entry.speedWorkKind === 'true_speed' && !entry.strengthPattern) return 'Sprint-Intervals';
  if (entry.tier === 'recovery' || /recovery|mobility|foam rolling/i.test(entry.focus)) {
    return 'Recovery';
  }
  if (entry.conditioningFlavour && !entry.hasCombinedConditioning) return 'Conditioning';
  if (entry.hasCombinedConditioning) return 'Mixed';
  return 'Strength';
}

function fallbackNameForPlanEntry(entry: SessionAllocation): string {
  if (entry.isTeamDay) return 'Team Training';
  if (entry.speedWorkKind === 'true_speed' && !entry.strengthPattern) {
    return entry.speedBlock?.title ?? 'Quality Speed Micro-dose';
  }
  if (entry.tier === 'recovery' || /recovery|mobility|foam rolling/i.test(entry.focus)) {
    return 'Recovery Session';
  }
  if (entry.conditioningFlavour && !entry.hasCombinedConditioning) return 'Conditioning';
  // Low-fatigue accessory/prehab slots (typical G-1 content) must not fall
  // through to a main-lift label — the resolver's G-1 pass expects a light
  // session here, and "Gunshow" is the canonical athlete-facing name.
  if (/accessor|prehab|gunshow|pump|low-fatigue/i.test(entry.focus)) return 'Gunshow';
  if (entry.strengthIntent) {
    return canonicalStrengthLabel(
      normalizeStrengthIntent(entry.strengthIntent).effectivePatterns,
    ) ?? 'Strength Session';
  }
  return 'Strength Session';
}

function fallbackExercisesForPlanEntry(entry: SessionAllocation): CoachGeneratedWorkoutInput['exercises'] {
  const strengthText = strengthFocusForPlanEntry(entry);
  const lower = strengthText.toLowerCase();
  const contributions = entry.strengthIntent?.plannedPatterns ?? entry.strengthPatternContributions ??
    mainPatternsForLegacyStrengthPattern(entry.strengthPattern);

  if (entry.isTeamDay && contributions.length === 0) return [];
  if (entry.tier === 'recovery' || /recovery|mobility|foam rolling/i.test(lower)) {
    return [{ name: 'Mobility Flow', sets: 1, repsMin: 10, repsMax: 15, notes: 'Easy mobility and recovery work' }];
  }
  if (entry.speedWorkKind === 'true_speed' && !entry.strengthPattern) {
    return [{ name: entry.speedBlock?.title ?? 'Quality Speed Micro-dose', sets: 1, repsMin: 1, repsMax: 1 }];
  }
  if (entry.conditioningFlavour && !entry.hasCombinedConditioning) {
    return [{ name: 'Conditioning', sets: 1, repsMin: 1, repsMax: 1 }];
  }
  // Low-fatigue accessories / gunshow / prehab (typical G-1 slot): light
  // pump + prehab work, never main pressing — the previous fallthrough to
  // the default bench/OHP/dips block put main lifts on the day before a game.
  if (/accessor|prehab|gunshow|pump|low-fatigue/i.test(lower)) {
    return [
      { name: 'Bicep Curls', sets: 2, repsMin: 10, repsMax: 15 },
      { name: 'Tricep Pushdowns', sets: 2, repsMin: 10, repsMax: 15 },
      { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15 },
      { name: 'Calf Raises', sets: 2, repsMin: 10, repsMax: 15 },
      { name: 'Pallof Press', sets: 2, repsMin: 8, repsMax: 12 },
    ];
  }
  if (contributions.length === 2 && contributions.includes('hinge') && contributions.includes('pull')) {
    return [
      { name: 'RDLs', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Pull-Ups', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Hamstring Curl', sets: 2, repsMin: 10, repsMax: 12 },
      { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15 },
      { name: 'Pallof Press', sets: 2, repsMin: 10, repsMax: 12 },
    ];
  }
  if (entry.strengthIntent?.archetype === 'full_body') {
    const lowerName = contributions.includes('hinge') ? 'RDLs' : 'Back Squat';
    return [
      { name: lowerName, sets: 3, repsMin: 5, repsMax: 8 },
      { name: 'Bench Press', sets: 3, repsMin: 6, repsMax: 8 },
      { name: 'Single-Arm DB Row', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Pallof Press', sets: 2, repsMin: 8, repsMax: 12 },
    ];
  }
  if (contributions.includes('squat') && contributions.includes('hinge')) {
    const squatPrimary = entry.strengthIntent?.primaryPattern !== 'hinge';
    return squatPrimary
      ? [
          { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 8 },
          { name: 'RDLs', sets: 2, repsMin: 8, repsMax: 10, notes: 'Secondary maintenance dose' },
          { name: 'Pallof Press', sets: 2, repsMin: 8, repsMax: 12 },
        ]
      : [
          { name: 'RDLs', sets: 3, repsMin: 5, repsMax: 8 },
          { name: 'Goblet Squat', sets: 2, repsMin: 8, repsMax: 10, notes: 'Secondary maintenance dose' },
          { name: 'Pallof Press', sets: 2, repsMin: 8, repsMax: 12 },
        ];
  }
  if (contributions.includes('push') && contributions.includes('pull')) {
    const pushPrimary = entry.strengthIntent?.primaryPattern !== 'pull';
    return pushPrimary
      ? [
          { name: 'Bench Press', sets: 3, repsMin: 5, repsMax: 8 },
          { name: 'Chest Supported Row', sets: 3, repsMin: 8, repsMax: 10 },
          { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15 },
        ]
      : [
          { name: 'Pull-Ups', sets: 3, repsMin: 5, repsMax: 8 },
          { name: 'Incline DB Bench', sets: 3, repsMin: 8, repsMax: 10 },
          { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15 },
        ];
  }
  if (contributions.length === 1 && contributions[0] === 'hinge') {
    return [
      { name: 'RDLs', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Hip Thrusts', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Hamstring Curl', sets: 2, repsMin: 10, repsMax: 12 },
    ];
  }
  if (contributions.length === 1 && contributions[0] === 'squat') {
    return [
      { name: 'Back Squat', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Reverse Lunges', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Leg Extension', sets: 2, repsMin: 10, repsMax: 12 },
    ];
  }
  if (contributions.length === 1 && contributions[0] === 'pull') {
    return [
      { name: 'Pull-Ups', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Chest Supported Row', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15 },
    ];
  }
  if (contributions.length === 1 && contributions[0] === 'push') {
    return [
      { name: 'Overhead Press', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Incline DB Bench', sets: 3, repsMin: 8, repsMax: 12 },
      { name: 'Lateral Raise', sets: 2, repsMin: 12, repsMax: 15 },
    ];
  }
  if (/hip-dominant|hinge|rdl|hamstring/i.test(lower)) {
    return [
      { name: 'RDLs', sets: 3, repsMin: 6, repsMax: 8 },
      { name: 'Hip Thrusts', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Nordic Lower', sets: 2, repsMin: 3, repsMax: 5 },
    ];
  }
  if (/squat|quad|lower body/i.test(lower)) {
    return [
      { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 8 },
      { name: 'Bulgarian Split Squats', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Leg Extension', sets: 2, repsMin: 10, repsMax: 12 },
    ];
  }
  if (/pull|row|pull-up/i.test(lower)) {
    return [
      { name: 'Pull-Ups', sets: 3, repsMin: 5, repsMax: 8 },
      { name: 'Barbell Row', sets: 3, repsMin: 6, repsMax: 10 },
      { name: 'Face Pulls', sets: 2, repsMin: 12, repsMax: 15 },
    ];
  }
  if (/full body/i.test(lower)) {
    return [
      { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 8 },
      { name: 'Bench Press', sets: 3, repsMin: 5, repsMax: 8 },
      { name: 'Single-Arm DB Row', sets: 3, repsMin: 8, repsMax: 10 },
    ];
  }
  return [
    { name: 'Bench Press', sets: 3, repsMin: 5, repsMax: 8 },
    { name: 'Overhead Press', sets: 3, repsMin: 6, repsMax: 8 },
    { name: 'Dips', sets: 2, repsMin: 8, repsMax: 12 },
  ];
}

function strengthFocusForPlanEntry(entry: SessionAllocation): string {
  const parts = String(entry.focus ?? '')
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part && !/^team training\b/i.test(part));
  if (parts.length > 0) return parts[0];
  return entry.isTeamDay ? '' : String(entry.focus ?? '');
}

function completeCoachWorkoutsFromPlan(
  coachWorkouts: CoachGeneratedWorkoutInput[],
  weeklyPlan?: SessionAllocation[],
): CoachGeneratedWorkoutInput[] {
  if (!weeklyPlan?.length) return coachWorkouts;

  const existingDows = new Set(coachWorkouts.map((workout) => workout.dayOfWeek));
  const additions: CoachGeneratedWorkoutInput[] = [];

  for (const entry of weeklyPlan) {
    if (!entry.dayOfWeek) continue;
    const dayOfWeek = PLAN_DAY_MAP[entry.dayOfWeek];
    if (dayOfWeek === undefined || existingDows.has(dayOfWeek)) continue;
    additions.push({
      planEntryId: entry.planEntryId,
      strengthIntent: entry.strengthIntent,
      dayOfWeek,
      name: fallbackNameForPlanEntry(entry),
      workoutType: fallbackWorkoutTypeForPlanEntry(entry),
      sessionTier: entry.tier,
      exercises: fallbackExercisesForPlanEntry(entry),
    });
    existingDows.add(dayOfWeek);
  }

  if (additions.length > 0) {
    logger.warn('[ProgramGen] AI omitted weekly plan days; completing from deterministic plan', {
      missingDays: additions.map((workout) => workout.dayOfWeek),
    });
  }

  return [...coachWorkouts, ...additions].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/**
 * Build Workout domain objects from AI-generated JSON.
 *
 * STRUCTURAL FIELDS (tier, intensity) are AUTHORITATIVE from the coaching
 * engine's weeklyPlan — the AI is not trusted for these. The AI controls
 * exercise selection, names, progression, and coaching detail.
 *
 * "Code decides the dose. AI decides the details."
 *
 * @param coachWorkouts  — Parsed JSON from the AI edge function
 * @param microcycleId   — Microcycle ID for the generated workouts
 * @param weeklyPlan     — Coaching engine's deterministic session allocations.
 *                          When provided, tier and intensity are enforced from
 *                          the plan. Omit only for legacy/fallback callers.
 */
/**
 * Validate and strip invalid or excessive superset pairings.
 *
 * Rules enforced:
 *   1. Max 1 paired block per workout (strip all groups beyond the first)
 *   2. Pairing only allowed on core strength sessions
 *   3. Each group must have exactly 2 exercises (strip incomplete groups)
 *   4. pairType must be 'contrast' | 'superset' | 'circuit' (strip unknown)
 */
function validatePairings(
  exercises: WorkoutExercise[],
  tier: SessionTier | undefined,
): WorkoutExercise[] {
  // Rule 2: only core strength sessions may have pairings
  if (tier !== 'core') {
    return exercises.map((ex) => {
      if (ex.supersetGroup) {
        logger.warn(`[PairingValidator] Stripped pairing on non-core session: ${ex.exercise?.name}`);
        const { supersetGroup, supersetOrder, pairType, ...rest } = ex;
        return rest as WorkoutExercise;
      }
      return ex;
    });
  }

  // Collect groups
  const groups = new Map<string, number>();
  for (const ex of exercises) {
    if (ex.supersetGroup) {
      groups.set(ex.supersetGroup, (groups.get(ex.supersetGroup) || 0) + 1);
    }
  }

  // Rule 3: strip incomplete groups (not exactly 2 members)
  const invalidGroups = new Set<string>();
  for (const [group, count] of groups) {
    if (count !== 2) {
      logger.warn(`[PairingValidator] Stripped group "${group}" — has ${count} exercises (expected 2)`);
      invalidGroups.add(group);
    }
  }

  // Rule 1: only keep the first valid group, strip the rest
  let allowedGroup: string | null = null;
  const excessGroups = new Set<string>();
  for (const ex of exercises) {
    if (ex.supersetGroup && !invalidGroups.has(ex.supersetGroup)) {
      if (allowedGroup === null) {
        allowedGroup = ex.supersetGroup;
      } else if (ex.supersetGroup !== allowedGroup) {
        logger.warn(`[PairingValidator] Stripped excess group "${ex.supersetGroup}" — max 1 pair per session`);
        excessGroups.add(ex.supersetGroup);
      }
    }
  }

  const stripGroups = new Set([...invalidGroups, ...excessGroups]);

  // Rule 4: validate pairType
  const VALID_PAIR_TYPES = new Set(['contrast', 'superset', 'circuit']);

  return exercises.map((ex) => {
    if (!ex.supersetGroup) return ex;
    if (stripGroups.has(ex.supersetGroup)) {
      const { supersetGroup, supersetOrder, pairType, ...rest } = ex;
      return rest as WorkoutExercise;
    }
    // Validate pairType
    if (ex.pairType && !VALID_PAIR_TYPES.has(ex.pairType)) {
      logger.warn(`[PairingValidator] Unknown pairType "${ex.pairType}" — stripping`);
      return { ...ex, pairType: undefined };
    }
    return ex;
  });
}

/**
 * Build a resolved ConditioningBlock from the assembled condBlock exercises.
 *
 * Emits a single option representing the prescribed conditioning session.
 * The `options` array is kept as the data-model contract so multi-modality
 * "Choose one" variants (e.g. run / bike / row for a zone-2 session) can be
 * added later without touching the renderer — but a block always has at
 * least one option, and all options within a block share the same intent.
 *
 * No "flush" or "supplementary" concept at this layer: every session has
 * exactly one conditioning intent. Aerobic flush was removed from the
 * combined S+C path so it can no longer appear as a secondary block.
 */
function buildConditioningBlock(
  flavour: 'aerobic' | 'tempo' | 'high-intensity',
  condBlock: WorkoutExercise[],
  attachedKind?: AttachedConditioningKind,
): ConditioningBlock | undefined {
  if (!condBlock || condBlock.length === 0) return undefined;

  // Headline row = the first non-warm-up / non-cool-down exercise, used
  // as the option title so the description matches what the athlete will
  // actually do.
  const headline =
    condBlock.find((ex) => {
      const n = (ex.exercise?.name || '').toLowerCase();
      return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
    }) ?? condBlock[condBlock.length - 1];
  const headlineName = headline.exercise?.name || 'Conditioning';

  return {
    intent: flavour,
    ...(attachedKind ? { attachedKind } : {}),
    options: [
      {
        title: headlineName,
        description: '',
        exerciseIds: condBlock.map((ex) => ex.id),
      },
    ],
  };
}

function buildSpeedBlock(
  planEntry: SessionAllocation,
  speedExercises: WorkoutExercise[],
): SpeedBlock | undefined {
  if (!planEntry.speedBlock) return undefined;
  return {
    ...planEntry.speedBlock,
    exerciseIds: speedExercises.map((exercise) => exercise.id),
  };
}

/**
 * Render the engine's typed power-primer intent into a display PowerBlock.
 *
 * The concrete exercise is chosen here (where equipment is known). Bodyweight
 * jumps / explosive push-ups are the primary option and always available, so
 * equipment can only ADD a medicine-ball variant — it can never force an
 * unavailable implement. The block is intentionally NOT added to
 * `workout.exercises` and carries a counting fence marking it non-conditioning,
 * non-finisher, non-hard.
 */
function buildPowerBlock(
  spec: NonNullable<SessionAllocation['powerPrimer']>,
  workoutId: string,
  availableEquipment: ReadonlyArray<string> | undefined,
): PowerBlock {
  const hasMedBall = (availableEquipment ?? []).some((e) => /med(icine)?[\s_-]*ball/i.test(e));
  const repsLabel = spec.repsMin === spec.repsMax ? `${spec.repsMin}` : `${spec.repsMin}-${spec.repsMax}`;
  const options: PowerBlockOption[] = [];

  if (spec.family === 'lower') {
    options.push({
      name: spec.reduced ? 'Pogo Jumps' : 'Vertical Jump',
      sets: spec.sets,
      repsMin: spec.repsMin,
      repsMax: spec.repsMax,
      equipmentRequired: [],
    });
    if (hasMedBall && !spec.reduced) {
      options.push({
        name: 'Medicine Ball Overhead Throw',
        sets: spec.sets,
        repsMin: spec.repsMin,
        repsMax: spec.repsMax,
        equipmentRequired: ['Medicine Ball'],
      });
    }
  } else {
    options.push({
      name: 'Explosive Push-up',
      sets: spec.sets,
      repsMin: spec.repsMin,
      repsMax: spec.repsMax,
      equipmentRequired: [],
    });
    if (hasMedBall) {
      options.push({
        name: 'Medicine Ball Chest Pass',
        sets: spec.sets,
        repsMin: spec.repsMin,
        repsMax: spec.repsMax,
        equipmentRequired: ['Medicine Ball'],
      });
    }
  }

  const notes = [
    'Do this fresh, early in the session — before the main lifts.',
    'Every rep fast and sharp. Stop or reduce if reps get slow or sloppy.',
  ];
  if (spec.kind === 'contrast') {
    notes.push('Contrast: perform sharply straight after your heavy set, then rest fully before the next round.');
  }

  return {
    id: `power-${workoutId}`,
    kind: spec.kind,
    family: spec.family,
    title: spec.kind === 'contrast' ? 'Contrast Power' : 'Power Primer',
    prescription: `${spec.sets} x ${repsLabel} — full rest, fast & sharp`,
    placement: 'pre_lift',
    options,
    notes,
    counting: {
      hardExposure: false,
      mainStrength: false,
      conditioningCredit: 'none',
      isFinisher: false,
    },
  };
}

function buildExercisesForSpeedBlock(
  speedBlock: SpeedBlock | undefined,
  dateStr: string,
): WorkoutExercise[] {
  if (!speedBlock) {
    return buildConditioningTemplate('Free Sprint Session', dateStr, {
      variant: 'micro_dose',
    });
  }

  const prefix = `speed-${dateStr}-${speedBlock.id}`;
  if (speedBlock.id.startsWith('late_offseason_low_risk_acceleration')) {
    return [
      condEx(`${prefix}-warmup`, 'Speed warm-up', 1, 1, 1, 1, 0,
        '8-10min easy movement, skips, marches and 2-3 relaxed build-ups'),
      distanceSpeedEx(`${prefix}-accels`, 'Short hills or controlled accelerations (10-15m)', 2, 4, 10, 15, 90,
        '4-6 x 10-15m. Full walk-back rest. Crisp reps only, not grindy.'),
    ];
  }
  if (speedBlock.id.startsWith('late_offseason_acceleration_build')) {
    return [
      condEx(`${prefix}-warmup`, 'Speed warm-up', 1, 1, 1, 1, 0,
        '10min easy movement, sprint drills and 3 relaxed 10m build-ups'),
      distanceSpeedEx(`${prefix}-accels`, 'Acceleration build reps (10-20m)', 2, 4, 10, 20, 120,
        '4-6 x 10-20m accelerations. Full walk-back rest. Stop before speed drops.'),
    ];
  }
  if (speedBlock.id.startsWith('late_offseason_build_up_intro')) {
    return [
      condEx(`${prefix}-warmup`, 'Speed warm-up', 1, 1, 1, 1, 0,
        '10-12min easy movement, drills and 3 relaxed build-ups'),
      distanceSpeedEx(`${prefix}-buildups`, 'Smooth build-ups (20-30m)', 2, 3, 20, 30, 150,
        '3-5 x 20-30m build-ups. Smooth, not all-out. Full rest between reps.'),
    ];
  }

  return buildConditioningTemplate('Free Sprint Session', dateStr, {
    variant: 'micro_dose',
  });
}

function distanceSpeedEx(
  id: string,
  name: string,
  order: number,
  sets: number,
  repsMin: number,
  repsMax: number,
  rest: number,
  notes: string,
): WorkoutExercise {
  return {
    ...condEx(id, name, order, sets, repsMin, repsMax, rest, notes),
    prescriptionType: 'distance',
  };
}

function stripConditioningSuffix(focus: string): string {
  return focus
    .replace(/\s+\+\s+.*(?:conditioning|finisher|interval|aerobic|tempo|sprint|zone\s*2).*$/i, '')
    .trim();
}

function deloadPlanEntry(
  entry: SessionAllocation,
  policy: DeloadWeekPolicy | null,
): SessionAllocation {
  if (!policy) return entry;
  const category = entry.conditioningCategory;
  const isHardConditioning =
    isHardDeloadConditioningCategory(category) ||
    entry.conditioningFlavour === 'high-intensity';
  if (!isHardConditioning) return entry;

  const next: SessionAllocation = {
    ...entry,
    isHardExposure: false,
  };

  if (entry.hasCombinedConditioning) {
    const strengthFocus = stripConditioningSuffix(entry.focus);
    return {
      ...next,
      focus: strengthFocus || entry.focus,
      hasCombinedConditioning: false,
      attachedConditioningKind: undefined,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
      conditioningVariant: undefined,
      conditioningFeel: undefined,
      conditioningOffFeet: undefined,
      ergModality: undefined,
    };
  }

  const safeCategory = deloadConditioningCategory(category) ?? 'aerobic_base';
  const safeFlavour = deloadConditioningFlavour(category) ?? 'aerobic';
  return {
    ...next,
    focus: safeCategory === 'tempo'
      ? 'Tempo conditioning (deload week, controlled 6-7/10)'
      : 'Easy aerobic conditioning (deload week)',
    conditioningCategory: safeCategory,
    conditioningFlavour: safeFlavour,
    conditioningVariant: safeCategory === 'aerobic_base' ? 'reduced' : 'standard',
    conditioningFeel: safeCategory === 'tempo' ? 'flowing' : undefined,
  };
}

export function buildWorkoutsFromCoach(
  coachWorkouts: CoachGeneratedWorkoutInput[],
  microcycleId: string = 'mc-1',
  weeklyPlan?: SessionAllocation[],
  onboardingData?: OnboardingData,
  /**
   * Optional rotation context for the cross-cycle exercise variation system.
   * When provided, AI-suggested exercises that map to a managed strength
   * pool slot (squat, hinge, horizontal_push/vertical_push, horizontal_pull/
   * vertical_pull, carry, isolation_upper, isolation_lower, plyo) are
   * rewritten to the rotation-selected variant for this block/week. When
   * omitted, names pass through unchanged (backwards-compatible default).
   */
  rotationContext?: RotationContext,
  /**
   * Optional per-athlete pool overrides (exclusion / pinning / active-injury
   * filter). Threaded into `applyPoolRotation` → `selectPoolEntryAvoiding`.
   * When undefined (or every pref field is empty), behaviour is identical
   * to the refinement-2 baseline — no filter, no bias.
   */
  athletePrefs?: AthletePoolPrefs,
): Workout[] {
  const effectiveAthletePrefs = onboardingData?.experienceLevel
    ? {
        excluded: athletePrefs?.excluded ?? [],
        pinned: athletePrefs?.pinned ?? [],
        ...athletePrefs,
        experienceLevel: onboardingData.experienceLevel,
      }
    : athletePrefs;
  const offseasonSubphase = resolveOffseasonSubphase({
    seasonPhase: onboardingData?.seasonPhase,
    explicitSubphase: rotationContext?.offseasonSubphase,
  });
  const deloadPolicy = resolveDeloadWeekPolicy(
    onboardingData?.seasonPhase,
    rotationContext?.weekKind,
  );
  const profileEquipment = resolveEquipmentCapabilities(onboardingData);
  const availableEquipment = effectiveAthletePrefs?.availableEquipment ?? profileEquipment.tags;
  const conditioningModalities = effectiveAthletePrefs?.conditioningModalities ?? (
    effectiveAthletePrefs?.availableEquipment
      ? effectiveAthletePrefs.availableEquipment.includes('bike_or_treadmill')
        ? profileEquipment.conditioningModalities.length > 0
          ? profileEquipment.conditioningModalities
          : ['bike', 'row', 'ski', 'treadmill']
        : []
      : profileEquipment.conditioningModalities
  );
  const equipmentCapabilities = {
    ...profileEquipment,
    tags: [...availableEquipment],
    conditioningModalities: [...conditioningModalities],
  };
  const effectiveWeeklyPlan = weeklyPlan
    ? resolveWeeklyConditioningFeasibility(
        weeklyPlan.map((entry) => deloadPlanEntry(entry, deloadPolicy)),
        {
          phase: onboardingData?.seasonPhase,
          offseasonSubphase,
          equipment: equipmentCapabilities,
          profile: onboardingData,
        },
      )
    : undefined;
  const planLookup = effectiveWeeklyPlan ? buildPlanLookup(effectiveWeeklyPlan) : null;
  const planIdentityLookup = effectiveWeeklyPlan
    ? buildPlanIdentityLookup(effectiveWeeklyPlan)
    : null;
  const feasibleCoachWorkouts = coachWorkouts.flatMap((workout) => {
    const planEntry = resolveGeneratedPlanEntry(workout, planIdentityLookup, planLookup);
    const plannerOwnsConditioning = !!planEntry?.conditioningCategory ||
      planEntry?.hasCombinedConditioning === true;
    const conditioningRemoved = planEntry?.conditioningFeasibility?.status === 'removed';
    if (!planEntry || (plannerOwnsConditioning && !conditioningRemoved)) return [workout];
    const strengthRemains = !!planEntry.strengthPattern ||
      !!planEntry.strengthIntent?.plannedPatterns.length;
    const withoutUnselectedConditioning = {
      ...workout,
      exercises: (workout.exercises ?? []).filter((exercise, index) =>
        classifyGeneratedWorkoutRow({
          name: exercise.name,
          sets: exercise.sets,
          repsMax: exercise.repsMax,
          index,
        }).kind !== 'conditioning'),
    };
    if (!strengthRemains && withoutUnselectedConditioning.exercises.length === 0) return [];
    return [withoutUnselectedConditioning];
  });
  const edgeProvidedDays = new Set(feasibleCoachWorkouts.map((workout) => workout.dayOfWeek));
  const completedCoachWorkouts = completeCoachWorkoutsFromPlan(
    feasibleCoachWorkouts,
    effectiveWeeklyPlan,
  );

  const finaliseBuiltWorkout = (
    workout: Workout,
    planEntry: SessionAllocation | null,
  ): Workout => {
    const result = finaliseWorkoutAfterMutation(workout, {
      phase: onboardingData?.seasonPhase,
      offseasonSubphase,
      weekKind: rotationContext?.weekKind,
      profile: onboardingData,
      planIntentValid: !!planEntry?.planEntryId &&
        workout.planEntryId === planEntry.planEntryId,
    });
    if (result.actions.length > 0) {
      logger.warn('[WorkoutCanonicalisation] Generated workout finalised', {
        microcycleId,
        dayOfWeek: workout.dayOfWeek,
        planEntryId: workout.planEntryId ?? null,
        actions: result.actions,
      });
    }
    return result.workout;
  };

  // ── Build a synthetic dateStr for deterministic variety ──
  // Generated workouts are day-of-week keyed. When the caller passes a
  // weekStartISO, hash against that real generated week; legacy callers fall
  // back to today's week for backward compatibility.
  const todayISO = todayISOLocal();
  const todayDow = dayOfWeekForISODate(todayISO); // 0=Sun
  function syntheticDateStr(dayOfWeek: number): string {
    if (rotationContext?.weekStartISO) {
      const mondayBasedOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return addDaysISO(rotationContext.weekStartISO, mondayBasedOffset);
    }
    const offset = ((dayOfWeek - todayDow) + 7) % 7;
    return addDaysISO(todayISO, offset);
  }

  // The conditioning builder uses the shared generation projection to decide
  // whether a combined day needs an off-feet modality. Typed strengthPattern
  // wins; legacy focus text is handled by the same adapter fallback.
  function strengthRegionForPlanEntry(
    entry: SessionAllocation,
  ): 'lower' | 'upper' | 'full' | undefined {
    const region = classifyGenerationSession(entry).strengthRegion;
    if (region === 'full_body') return 'full';
    return region === 'lower' || region === 'upper' ? region : undefined;
  }

  function normalizeGeneratedWorkoutType(
    cw: { name: string; workoutType: string },
    planEntry: SessionAllocation | null,
  ): WorkoutType {
    const raw = String(cw.workoutType || '').trim().toLowerCase();
    const text = `${cw.name || ''} ${planEntry?.focus || ''}`.toLowerCase();

    // The deterministic plan owns structure. Resolve typed anchors/components
    // before considering the edge-provided label so a Mixed session cannot be
    // downgraded to Conditioning merely because the model chose that enum.
    if (planEntry?.isTeamDay || raw === 'team' || raw === 'team training') {
      return 'Team Training';
    }
    if (planEntry?.speedWorkKind === 'true_speed' && !planEntry.strengthPattern) return 'Sprint-Intervals';
    if (planEntry?.tier === 'recovery') return 'Recovery';
    if (planEntry?.hasCombinedConditioning && planEntry.conditioningFlavour) return 'Mixed';
    if (planEntry?.conditioningFlavour && !planEntry.hasCombinedConditioning) return 'Conditioning';
    if (planEntry?.strengthPattern) return 'Strength';

    if (raw === 'strength') return 'Strength';
    if (raw === 'conditioning') return 'Conditioning';
    if (raw === 'recovery') return 'Recovery';
    if (raw === 'mixed') {
      if (planEntry?.hasCombinedConditioning) return 'Mixed';
      if (planEntry?.conditioningFlavour) return 'Conditioning';
      return 'Strength';
    }
    if (raw === 'game') return 'Game';

    // Older generate-mode schema incorrectly described workoutType as a tier.
    // Treat those values as sessionTier only and infer the app-level type.
    if (raw === 'core' || raw === 'optional') {
      if (planEntry?.speedWorkKind === 'true_speed' && !planEntry.strengthPattern) return 'Sprint-Intervals';
      if (planEntry?.conditioningFlavour && !planEntry.hasCombinedConditioning) {
        return 'Conditioning';
      }
      if (planEntry?.hasCombinedConditioning) {
        return 'Mixed';
      }
      if (/\b(recovery|mobility|flush|restore|reset)\b/.test(text)) {
        return 'Recovery';
      }
      if (/\b(conditioning|aerobic|tempo|sprint|interval|run|bike|row|ski)\b/.test(text)) {
        return 'Conditioning';
      }
      return 'Strength';
    }

    if (/\b(recovery|mobility|flush|restore|reset)\b/.test(text)) return 'Recovery';
    if (/\b(conditioning|aerobic|tempo|sprint|interval|run|bike|row|ski)\b/.test(text)) {
      return 'Conditioning';
    }
    return 'Strength';
  }

  // ── Team-day name enforcement ──
  // Guarantees that any day marked isTeamDay in the engine plan has its
  // workout.name lead with "Team Training" — independent of what the AI
  // generator produced. Handles three upstream patterns:
  //   1. Name already starts with "Team Training" → leave as-is
  //   2. Name ends with "... + Team Training" (old AI convention) →
  //      swap to "Team Training + ..."
  //   3. Name is pure gym/accessory/recovery label (e.g. "Upper Pull",
  //      "Recovery Session") → prefix "Team Training + "
  //   4. Empty/missing → default to "Team Training"
  // This is the last line of defence; the AI prompt now emits the correct
  // order, but we must not rely on model adherence for a label Sam
  // considers non-negotiable.
  // Deprecated: delegated to resolveSessionDisplayName (the single naming
  // source of truth). Kept only for backward-compatible call sites that
  // don't have access to the engine's SessionAllocation. New code should
  // call resolveSessionDisplayName directly with the planEntry.
  function enforceTeamDayName(
    name: string | undefined,
    isTeamDay: boolean | undefined,
    focus?: string,
    strengthPattern?: SessionAllocation['strengthPattern'],
  ): string {
    return resolveSessionDisplayName({
      name,
      focus,
      strengthPattern,
      isTeamDay,
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // RUN-LOAD GUARD — pre-resolve conditioning templates for the week so
  // we never program 3 consecutive days of running exposure.
  //
  // "Run exposure" = any day that hammers ground-contact running:
  //   • A day whose conditioning candidate is a running template (MAS,
  //     tempo intervals, long runs, etc.); OR
  //   • A TEAM TRAINING day (sprints + skills + contact = pure run load,
  //     even if no formal conditioning block is programmed on that day).
  //
  // We walk the week in day-of-week order tracking `runStreak` across both
  // species. When a day would be the 3rd-in-a-row run exposure AND it
  // carries a running conditioning candidate, we convert that candidate
  // to off-feet (bike / row / SkiErg). Pure speed/sprint templates
  // (Flying Sprints, Free Sprint Session, Max Effort Sprint Accumulation)
  // are NEVER converted — running IS the goal there.
  //
  // Team days that are themselves the 3rd run exposure can't be converted
  // (field session is the whole point); we let them stand but refuse to
  // add a running conditioning block on top — the cond-day enforcement
  // downstream prevents that, and the engine's H-PRE-12 already caps the
  // broader field-load streak so a 3-team-day-in-a-row scenario wouldn't
  // slip through.
  //
  // Output: a map dayOfWeek → resolved conditioning, used by the workout
  // builder below instead of re-resolving the template per-day.
  // ──────────────────────────────────────────────────────────────────────
  type ConditioningResolution = {
    exerciseName: string;
    exercises: WorkoutExercise[];
    shiftedFromRun: boolean;
  };
  const conditioningByDow = new Map<number, ConditioningResolution>();

  // 1. First pass: pick the candidate template name for every day that has
  //    conditioning, in day-of-week order, applying the run-load guard.
  //
  // Also maintain a weekly set of erg modalities already used. When a
  // session would use an erg (combined vo2/glyco, lower-paired sprint,
  // off-feet conversion, or aerobic default), prefer an UNUSED modality
  // from the pool so the athlete doesn't end up on the bike twice in
  // one week unless we've exhausted options.
  const sortedCw = [...completedCoachWorkouts].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const usedErgs = new Set<ErgModality>();
  let lastErg: ErgModality | undefined; // last erg used on the immediately-preceding day
  let lastErgDow = -2;
  let runStreak = 0;
  let prevDow = -2;
  for (const cw of sortedCw) {
    const planEntry = resolveGeneratedPlanEntry(cw, planIdentityLookup, planLookup);
    const isTeamDay = !!planEntry?.isTeamDay;
    const isConsecutiveFromPrev = cw.dayOfWeek - prevDow === 1;

    // Non-conditioning day: still update the run streak if it's a team
    // day (team training = running exposure). Pure rest / strength / recovery
    // days break the streak.
    if (!planEntry?.conditioningFlavour) {
      if (isTeamDay) {
        runStreak = isConsecutiveFromPrev ? runStreak + 1 : 1;
      } else {
        runStreak = 0;
      }
      prevDow = cw.dayOfWeek;
      continue;
    }
    const dateStr = syntheticDateStr(cw.dayOfWeek);
    // Prefer category when the planner assigned one (off-season / pre-
    // season). Falls back to flavour-based mapping for legacy phases.
    let candidateName = planEntry.conditioningCategory
      ? conditioningCategoryToExerciseName(
          planEntry.conditioningCategory,
          dateStr,
          rotationContext?.miniCycleNumber,
        )
      : conditioningFlavourToExerciseName(planEntry.conditioningFlavour, dateStr);
    // 4B standalone tempo modality law: when the engine ruled this week's
    // tempo off-feet (typed field on the plan entry — the single
    // representation of that decision), force the erg tempo template.
    if (
      planEntry.conditioningCategory === 'tempo' &&
      planEntry.conditioningOffFeet &&
      isRunningBasedConditioning(candidateName)
    ) {
      candidateName = 'Bike/Row/Ski Tempo Intervals';
    }
    const isCombined = !!planEntry.hasCombinedConditioning;
    const attachedConditioningKind = isCombined
      ? planEntry.attachedConditioningKind ?? 'finisher'
      : undefined;
    // Infer the strength region being paired on combined days so the
    // conditioning builder can auto-shift to an ergometer when pairing a
    // lower-body lift with sprint or glycolytic work. "Lower body" /
    // "hip-dominant" / "squat" / "hinge" / "leg" all count as lower.
    const strengthRegion: 'lower' | 'upper' | 'full' | undefined =
      !isCombined ? undefined
      : strengthRegionForPlanEntry(planEntry);

    // ── Assign feel (density/psychological character) per session ──
    // Deterministic per date + category so sessions feel distinct but
    // stay reproducible. Categories without meaningful feel variation
    // (pure speed micro-doses) fall back to undefined.
    const cat = planEntry.conditioningCategory;
    const engineFeel: ConditioningFeel | undefined = planEntry.conditioningFeel as ConditioningFeel | undefined;
    const feel: ConditioningFeel | undefined =
      engineFeel ? engineFeel
      : (cat === 'aerobic_base' || cat === 'tempo' || cat === 'vo2' || cat === 'glycolytic' || cat === 'sprint')
        ? (['grindy', 'sharp', 'flowing'] as const)[conditioningDateHash(`${dateStr}-${cat}`) % 3]
        : undefined;

    // ── Pick erg modality with weekly repeat-avoidance ──
    // Session will use an erg if: combined vo2/glyco/aerobic (always erg),
    // combined sprint on lower pairing (erg), or (later) off-feet swap.
    // We pre-pick here so the weekly-tracker sees each session exactly once.
    const willUseErgCombined =
      isCombined && (
        cat === 'vo2' || cat === 'glycolytic'
        || cat === 'aerobic_base'
        || cat === 'tempo' // 4B: combined tempo finishers are erg-based
        || (cat === 'sprint' && strengthRegion === 'lower')
      );
    // Standalone aerobic_base uses the same deterministic weighted erg
    // default as combined zone-2 work. Explicit/off-feet decisions remain
    // authoritative, and weekly repeat avoidance only affects fallback.
    const willUseErgStandaloneAero =
      !isCombined && cat === 'aerobic_base' &&
      (planEntry.conditioningOffFeet === true || usedErgs.size < 3);
    let ergHint: ErgModality | undefined;
    const generatedModality = (cw.exercises ?? [])
      .map((exercise, index) => classifyGeneratedWorkoutRow({
        name: exercise.name,
        sets: exercise.sets,
        repsMax: exercise.repsMax,
        index,
      }))
      .find((classification) => classification.kind === 'conditioning')
      ?.conditioningModality;
    const generatedErg = generatedModality === 'bike' || generatedModality === 'row' ||
      generatedModality === 'ski' || generatedModality === 'mixed'
      ? generatedModality
      : undefined;
    const explicitErg = (planEntry.ergModality as ErgModality | undefined) ?? generatedErg;
    if (explicitErg && (willUseErgCombined || (!isCombined && cat === 'aerobic_base'))) {
      // Typed engine/athlete choice always wins over default weighting and
      // weekly variety. This was previously overwritten on combined days.
      ergHint = explicitErg;
      usedErgs.add(ergHint);
    } else if (willUseErgCombined) {
      const weightedAerobicDefault = selectDefaultAerobicErgModalityFromHash(
        conditioningDateHash(dateStr),
      );
      const weightedAerobicFallbacks: Record<Exclude<ErgModality, 'bike_erg'>, ErgModality[]> = {
        bike: ['bike', 'mixed', 'row', 'ski'],
        mixed: ['mixed', 'bike', 'row', 'ski'],
        row: ['row', 'bike', 'mixed', 'ski'],
        ski: ['ski', 'mixed', 'bike', 'row'],
      };
      const pool: ErgModality[] = cat === 'aerobic_base'
        ? weightedAerobicFallbacks[weightedAerobicDefault]
        : (strengthRegion === 'lower' && (cat === 'sprint' || cat === 'glycolytic'))
          ? ['ski', 'row', 'bike', 'mixed']
          : ['bike', 'row', 'ski', 'mixed'];
      // Preference order:
      //   1. Unused this week AND not yesterday's erg (best — fresh modality
      //      with no day-adjacent repeat).
      //   2. Unused this week, even if it was yesterday's erg (rare — pool
      //      size 4 usually gives us option 1).
      //   3. Not yesterday's erg, accepting a weekly repeat (we'd rather
      //      repeat Wed's bike on Fri than use yesterday's bike again).
      //   4. Pool fallback — no alternatives remain.
      const isConsecutiveDayErg = cw.dayOfWeek === lastErgDow + 1;
      ergHint =
        pool.find(m => !usedErgs.has(m) && m !== (isConsecutiveDayErg ? lastErg : undefined))
        ?? pool.find(m => !usedErgs.has(m))
        ?? pool.find(m => m !== (isConsecutiveDayErg ? lastErg : undefined))
        ?? pool[0];
      usedErgs.add(ergHint);
    } else if (willUseErgStandaloneAero) {
      const weightedDefault = selectDefaultAerobicErgModalityFromHash(
        conditioningDateHash(dateStr),
      );
      const pool: ErgModality[] = weightedDefault === 'bike'
        ? ['bike', 'mixed', 'row', 'ski']
        : weightedDefault === 'mixed'
          ? ['mixed', 'bike', 'row', 'ski']
          : weightedDefault === 'row'
            ? ['row', 'bike', 'mixed', 'ski']
            : ['ski', 'mixed', 'bike', 'row'];
      ergHint = pool.find((modality) => !usedErgs.has(modality)) ?? pool[0];
      usedErgs.add(ergHint);
    }
    // Persist on plan entry so downstream code (and any diagnostic output)
    // sees the decisions made by this pass. Feel from the engine wins;
    // only fall back to hash-derived feel if the engine left it blank.
    if (ergHint) {
      planEntry.ergModality = ergHint;
      lastErg = ergHint;
      lastErgDow = cw.dayOfWeek;
    }
    if (!planEntry.conditioningFeel && feel) planEntry.conditioningFeel = feel;
    const templateErgModality = (ergHint ?? planEntry.ergModality) as ErgModality | undefined;
    const isConsecutive = cw.dayOfWeek - prevDow === 1;
    const candidateIsRun = isRunningBasedConditioning(candidateName);
    const forcedOffFeet =
      planEntry.conditioningOffFeet === true &&
      candidateIsRun &&
      templateErgModality !== undefined;
    const isProtectedSpeed = SPEED_SPRINT_TEMPLATES.has(candidateName);
    // A day counts as run-exposure if EITHER the conditioning candidate
    // is run-based OR the athlete has team training on the same day
    // (team = sprints + skills + contact = running).
    const dayIsRun = (candidateIsRun && !forcedOffFeet) || isTeamDay;

    // Update running streak of CONSECUTIVE run-exposure days.
    if (dayIsRun && isConsecutive) {
      runStreak += 1;
    } else if (dayIsRun) {
      runStreak = 1;
    } else {
      runStreak = 0;
    }

    let resolved: ConditioningResolution;
    // Rule: Hard cap of 2 consecutive running days.
    // When we hit a 3rd field-load day whose conditioning candidate is
    // running, it MUST be converted off-feet. (Team days themselves
    // can't be converted — that's handled by the engine's H-PRE-12.)
    if (candidateIsRun && runStreak >= 3 && !isProtectedSpeed) {
      // 3rd (or later) consecutive run — convert to off-feet.
      const offFeet = isCombined
        ? buildConditioningTemplate(candidateName, dateStr, {
            combined: true,
            attachedConditioningKind,
            strengthRegion,
            feel,
            ergModality: templateErgModality,
            variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
          })
        : planEntry.conditioningVariant === 'reduced' && cat === 'aerobic_base'
          ? buildConditioningTemplate(candidateName, dateStr, {
              variant: 'reduced',
              ergModality: templateErgModality,
            })
          : switchToOffFeetModality(candidateName, dateStr);
      if (offFeet && offFeet.length > 0) {
        const tagged = tagAsShiftedFromRun(offFeet);
        resolved = {
          exerciseName: candidateName, // keep original name for flavour mapping
          exercises: tagged,
          shiftedFromRun: true,
        };
        // After conversion the cond block is off-feet. If the day is ALSO
        // a team day, it still carries a running stimulus via the field
        // session — keep the streak at its current value so the following
        // day's enforcement remains correct. Otherwise the day no longer
        // counts as run exposure — reset so a 4th day can be run again.
        if (!isTeamDay) runStreak = 0;
      } else {
        // Couldn't convert (shouldn't happen for normal templates) — accept
        // the run but log it.
        resolved = {
          exerciseName: candidateName,
          exercises: buildConditioningTemplate(candidateName, dateStr, {
            combined: isCombined,
            attachedConditioningKind,
            strengthRegion,
            feel,
            ergModality: templateErgModality,
            variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
          }),
          shiftedFromRun: false,
        };
        logger.warn(
          `[RunLoadGuard] day=${cw.dayOfWeek} 3rd consecutive run "${candidateName}" — no off-feet conversion available`,
        );
      }
      logger.debug(
        `[RunLoadGuard] day=${cw.dayOfWeek} converted "${candidateName}" to off-feet (3rd consecutive run-exposure day)`,
      );
    } else {
      resolved = {
        exerciseName: candidateName,
        exercises: buildConditioningTemplate(candidateName, dateStr, {
          combined: isCombined,
          attachedConditioningKind,
          strengthRegion,
          feel,
          ergModality: templateErgModality,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
        }),
        shiftedFromRun: forcedOffFeet,
      };
    }

    conditioningByDow.set(cw.dayOfWeek, resolved);
    prevDow = cw.dayOfWeek;
  }

  return completedCoachWorkouts.map((cw) => {
    const workoutId = `w-coach-${cw.dayOfWeek}`;
    const planEntry = resolveGeneratedPlanEntry(cw, planIdentityLookup, planLookup);
    const aiTier = (cw.sessionTier as SessionTier) || undefined;
    let canonicalTier: SessionTier | undefined;
    let canonicalIntensity: 'Light' | 'Moderate' | 'High' = 'Moderate';

    if (planEntry) {
      canonicalTier = planEntry.tier;
      canonicalIntensity = planEntry.isHardExposure
        ? 'High'
        : planEntry.tier === 'core' ? 'Moderate' : 'Light';

      if (aiTier && aiTier !== canonicalTier) {
        logger.warn(
          `[ProgramGen] AI tier drift: day ${cw.dayOfWeek} (${cw.name}) ` +
          `AI="${aiTier}" vs engine="${canonicalTier}" — using engine tier`
        );
      }
    } else {
      canonicalTier = aiTier;
    }

    if (deloadPolicy && canonicalIntensity === 'High') {
      canonicalIntensity = 'Moderate';
    }

    // ──────────────────────────────────────────────────────────────────────
    // STANDALONE CONDITIONING / TRUE SPEED - deterministic, AI exercises ignored
    // ──────────────────────────────────────────────────────────────────────
    const isStandaloneSpeed = planEntry?.speedWorkKind === 'true_speed' && !planEntry.strengthPattern;
    const isStandaloneConditioning = planEntry
      && planEntry.conditioningFlavour
      && !planEntry.hasCombinedConditioning;

    if (isStandaloneConditioning || isStandaloneSpeed) {
      const resolved = conditioningByDow.get(cw.dayOfWeek);
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const exerciseName = isStandaloneSpeed
        ? 'Free Sprint Session'
        : resolved?.exerciseName
        ?? (planEntry.conditioningCategory
          ? conditioningCategoryToExerciseName(
              planEntry.conditioningCategory,
              dateStr,
              rotationContext?.miniCycleNumber,
            )
          : conditioningFlavourToExerciseName(planEntry.conditioningFlavour!, dateStr));
      const condExercises = isStandaloneSpeed
        ? buildExercisesForSpeedBlock(planEntry.speedBlock, dateStr)
        : resolved?.exercises
        ?? buildConditioningTemplate(exerciseName, dateStr, {
          feel: planEntry.conditioningFeel as ConditioningFeel | undefined,
          ergModality: planEntry.ergModality as ErgModality | undefined,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
        });
      // Stamp workoutId on all exercises
      for (const ex of condExercises) {
        ex.workoutId = workoutId;
      }

      // If the run-load guard shifted this session, reflect that in the
      // workout name + workoutType so the downstream UI doesn't read as
      // a run when the prescription is bike/row/ski.
      const isReducedAerobicBase =
        planEntry.conditioningVariant === 'reduced' && planEntry.conditioningCategory === 'aerobic_base';
      const headlineExerciseName = condExercises.find((ex) => {
        const n = (ex.exercise?.name || '').toLowerCase();
        return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
      })?.exercise?.name;
      const displayName = resolved?.shiftedFromRun || isReducedAerobicBase
        ? (headlineExerciseName || exerciseName)
        : isStandaloneSpeed
          ? (planEntry.speedBlock?.title ?? 'Quality Speed Micro-dose')
          : exerciseName;
      const condWorkoutType = isStandaloneSpeed
        ? 'Sprint-Intervals'
        : resolved?.shiftedFromRun
        || isReducedAerobicBase
        ? 'Conditioning'
        : conditioningWorkoutType(exerciseName);
      const speedBlock = isStandaloneSpeed
        ? buildSpeedBlock(planEntry, condExercises)
        : undefined;

      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} ${isStandaloneSpeed ? 'STANDALONE SPEED' : 'STANDALONE CONDITIONING'} - flavour="${planEntry.conditioningFlavour}" -> template="${exerciseName}"${resolved?.shiftedFromRun ? ' [SHIFTED off-feet]' : ''} (AI exercises IGNORED: ${cw.exercises.length} discarded)`);

      const standaloneWorkout: Workout = {
        id: workoutId,
        microcycleId,
        dayOfWeek: cw.dayOfWeek,
        name: resolveSessionDisplayName({
          name: displayName,
          focus: planEntry?.focus,
          strengthPattern: planEntry?.strengthPattern,
          strengthIntent: planEntry?.strengthIntent,
          isTeamDay: planEntry?.isTeamDay,
          conditioningFlavour: planEntry?.conditioningFlavour,
          hasCombinedConditioning: planEntry?.hasCombinedConditioning,
          tier: planEntry?.tier,
        }),
        description: '',
        intensity: canonicalIntensity,
        workoutType: condWorkoutType as any,
        sessionTier: canonicalTier,
        ...(planEntry.planEntryId ? { planEntryId: planEntry.planEntryId } : {}),
        ...(!isStandaloneSpeed ? { conditioningFlavour: planEntry.conditioningFlavour } : {}),
        // 4B: carry the energy-system category onto conditioning workouts
        // so the rules kernel classifies from the typed field. True speed
        // uses speedBlock instead, so it never looks like conditioning.
        ...(!isStandaloneSpeed && planEntry.conditioningCategory
          ? { conditioningCategory: planEntry.conditioningCategory }
          : {}),
        ...(!isStandaloneSpeed && planEntry.section18ConditioningRole
          ? { section18ConditioningRole: planEntry.section18ConditioningRole }
          : {}),
        ...(planEntry.conditioningFeasibility
          ? { conditioningFeasibility: planEntry.conditioningFeasibility }
          : {}),
        ...(speedBlock ? { speedBlock } : {}),
        durationMinutes: 0,
        exercises: condExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Workout;
      const finalWorkout = applyResolvedConditioningSubstitution(
        finaliseBuiltWorkout(standaloneWorkout, planEntry),
      );
      return attachSessionEffectEvidence(
        finalWorkout,
        planEntry.deterministicCoachNoteEffects,
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // STRENGTH (or non-conditioning) — AI generates exercises
    // ──────────────────────────────────────────────────────────────────────
    // Per-session pool usage tracker. Prevents two AI-suggested exercises
    // in the same (slot, role) from collapsing to the same rotation pick.
    const poolUsage = rotationContext
      ? new Map<string, Set<string>>()
      : undefined;

    const filteredAiExercises = (cw.exercises ?? []).filter((ex) =>
      !isTeamTrainingItem({
        name: ex.name,
        exerciseName: ex.name,
        workoutType: (ex as any).workoutType,
      }),
    );
    const classifiedRows = filteredAiExercises.map((exercise, index) => ({
      exercise,
      classification: classifyGeneratedWorkoutRow({
        name: exercise.name,
        sets: exercise.sets,
        repsMax: exercise.repsMax,
        index,
      }),
    }));
    const requiresStrengthContent =
      edgeProvidedDays.has(cw.dayOfWeek) &&
      !!planEntry?.strengthPattern &&
      !/\b(gunshow|prehab|pump|accessor|low-fatigue)\b/i.test(`${cw.name} ${planEntry?.focus ?? ''}`);
    // Preserve any plausible strength/support row from the edge. Fall back
    // only for an empty shell or a payload made entirely of conditioning
    // rows; the normaliser must not discard unusual but valid strength work.
    const aiHasStrengthContent = classifiedRows.some(({ classification }) =>
      classification.kind === 'strength_main' || classification.kind === 'strength_accessory');
    const fallbackStrengthExercises = requiresStrengthContent && !aiHasStrengthContent
      ? fallbackExercisesForPlanEntry(planEntry!)
      : [];
    const sourceAiExercises: CoachGeneratedWorkoutInput['exercises'] = fallbackStrengthExercises.length > 0
      ? fallbackStrengthExercises
      : filteredAiExercises;

    if (fallbackStrengthExercises.length > 0) {
      logger.warn('[ProgramGen] Edge workout lacked strength content required by deterministic plan; using safe plan fallback', {
        dayOfWeek: cw.dayOfWeek,
        workoutName: cw.name,
        strengthPattern: planEntry?.strengthPattern,
        strengthIntent: planEntry?.strengthIntent,
        receivedExercises: filteredAiExercises.map((exercise) => exercise.name),
      });
    }

    const aiExercises: WorkoutExercise[] = sourceAiExercises.map((ex, index) => {
      // Cross-cycle variation: rewrite AI-suggested name to the
      // rotation-selected pool variant when applicable. Non-pool exercises
      // (carry, core, isolation, anything untagged) pass through unchanged.
      const resolvedName = rotationContext && poolUsage
        ? applyPoolRotation(ex.name, rotationContext, poolUsage, effectiveAthletePrefs)
        : ex.name;
      const exercise = findOrCreateExercise(resolvedName);
      return {
        id: `we-${workoutId}-${index}`,
        workoutId,
        exerciseId: exercise.id,
        exerciseOrder: index + 1,
        prescribedSets: ex.sets,
        prescribedRepsMin: ex.repsMin,
        prescribedRepsMax: ex.repsMax,
        prescribedWeightKg: ex.weight || 0,
        restSeconds: 0,
        notes: ex.notes,
        ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
        ...(ex.supersetOrder ? { supersetOrder: ex.supersetOrder } : {}),
        ...(ex.pairType ? { pairType: ex.pairType as any } : {}),
        exercise,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    // Validate superset pairings (deterministic rules)
    const validatedExercises = validatePairings(aiExercises, canonicalTier);
    const phaseAwareExercises = applyPhaseRepSchemesToWorkoutExercises(validatedExercises, {
      seasonPhase: onboardingData?.seasonPhase,
      offseasonSubphase,
      workoutName: cw.name,
      workoutType: cw.workoutType,
      planEntry,
    });

    // Apply load estimates for exercises missing weights
    let finalExercises = onboardingData
      ? applyLoadEstimates(phaseAwareExercises, onboardingData)
      : phaseAwareExercises;
    finalExercises = applySubphaseMainLiftLoadMultiplier(finalExercises, {
      seasonPhase: onboardingData?.seasonPhase,
      offseasonSubphase,
      workoutName: cw.name,
      workoutType: cw.workoutType,
      planEntry,
    });
    let beginnerPrescriptionEvidence = null;
    if (onboardingData) {
      const beforeTrainingAge = finalExercises;
      finalExercises = applyTrainingAgePrescription(finalExercises, onboardingData, {
        seasonPhase: onboardingData.seasonPhase,
        offseasonSubphase,
        workoutName: cw.name,
        workoutType: cw.workoutType,
        planEntry,
      });
      if (resolveTrainingAgePolicy(onboardingData.experienceLevel).level === 'new') {
        beginnerPrescriptionEvidence = buildPrescriptionEffectEvidence({
          seed: {
            kind: 'beginner_policy',
            reason: 'beginner_conservative_prescription',
            ownerKey: `training-age:${cw.dayOfWeek}`,
          },
          before: beforeTrainingAge,
          after: finalExercises,
        });
      }
    }

    // Resolved conditioning block — assembled below for combined S+C days.
    let resolvedConditioningBlock: ConditioningBlock | undefined;
    const normalizedWorkoutType = normalizeGeneratedWorkoutType(cw, planEntry);

    // ──────────────────────────────────────────────────────────────────────
    // COMBINED S+C — AI strength + deterministic conditioning appended
    // ──────────────────────────────────────────────────────────────────────
    if (planEntry?.hasCombinedConditioning && planEntry.conditioningFlavour) {
      // Deterministic plan conditioning replaces edge-authored conditioning.
      // Classification is shared with the final post-mutation path; location
      // inside the raw exercise array is irrelevant.
      const rawStrengthBlock = finalExercises.filter((exercise, index) =>
        classifyGeneratedWorkoutRow({
          name: exercise.exercise?.name ?? '',
          sets: exercise.prescribedSets,
          repsMax: exercise.prescribedRepsMax,
          index,
        }).kind !== 'conditioning');
      const strengthBlock = deloadPolicy
        ? applyStrengthDeloadToExercises(rawStrengthBlock, deloadPolicy)
        : rawStrengthBlock;

      // Build deterministic conditioning block and append. The block was
      // pre-resolved above by the run-load guard; fall back to a fresh
      // build only if the guard did not produce a resolution for this day.
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const resolved = conditioningByDow.get(cw.dayOfWeek);
      const condExName = resolved?.exerciseName
        ?? (planEntry.conditioningCategory
          ? conditioningCategoryToExerciseName(
              planEntry.conditioningCategory,
              dateStr,
              rotationContext?.miniCycleNumber,
            )
          : conditioningFlavourToExerciseName(planEntry.conditioningFlavour, dateStr));
      const condBlock = resolved?.exercises
        ?? buildConditioningTemplate(condExName, dateStr, {
          combined: true,
          attachedConditioningKind: planEntry.attachedConditioningKind ?? 'finisher',
          strengthRegion: strengthRegionForPlanEntry(planEntry),
          feel: planEntry.conditioningFeel as ConditioningFeel | undefined,
          ergModality: planEntry.ergModality as ErgModality | undefined,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
        });

      // Re-number: strength exercises keep their order, conditioning appends after
      const maxOrder = strengthBlock.length;
      for (let i = 0; i < condBlock.length; i++) {
        condBlock[i].workoutId = workoutId;
        condBlock[i].exerciseOrder = maxOrder + i + 1;
      }

      finalExercises = [...strengthBlock, ...condBlock];

      // Resolve the conditioning block once, here — single source of truth
      // for the renderer. Title/description/exerciseIds are populated together
      // so header and rows can't drift. Single-intent, no flush sub-block.
      resolvedConditioningBlock = buildConditioningBlock(
        planEntry.conditioningFlavour,
        condBlock,
        planEntry.attachedConditioningKind ?? 'finisher',
      );

      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} COMBINED S+C — strength=${strengthBlock.length} exercises (AI) + conditioning="${condExName}"${resolved?.shiftedFromRun ? ' [SHIFTED off-feet]' : ''} (template, ${condBlock.length} exercises)`);
    } else {
      if (
        deloadPolicy &&
        normalizedWorkoutType !== 'Conditioning' &&
        normalizedWorkoutType !== 'Recovery' &&
        normalizedWorkoutType !== 'Game'
      ) {
        finalExercises = applyStrengthDeloadToExercises(finalExercises, deloadPolicy);
      }
      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} aiName="${cw.name}" aiType="${cw.workoutType}" aiTier="${cw.sessionTier}" → canonicalTier="${canonicalTier}" intensity="${canonicalIntensity}" planEntry=${planEntry ? `"${planEntry.tier} / ${planEntry.focus?.substring(0, 40)}"` : 'NONE'}`);
    }

    let resolvedSpeedBlock: SpeedBlock | undefined;
    if (planEntry?.speedWorkKind === 'true_speed' && planEntry.speedPlacement === 'pre_lift') {
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const speedExercises = buildExercisesForSpeedBlock(planEntry.speedBlock, dateStr);
      for (let i = 0; i < speedExercises.length; i++) {
        speedExercises[i].workoutId = workoutId;
        speedExercises[i].exerciseOrder = i + 1;
      }
      finalExercises = finalExercises.map((exercise) => ({
        ...exercise,
        exerciseOrder: exercise.exerciseOrder + speedExercises.length,
      }));
      finalExercises = [...speedExercises, ...finalExercises];
      resolvedSpeedBlock = buildSpeedBlock(planEntry, speedExercises);
    }

    // ── Power primer (Bible § Power work) ──
    // Rendered as a distinct block, NOT interleaved into exercises. Skipped on
    // deload weeks even if the engine stamped it, so a deload never carries
    // fatiguing power.
    let resolvedPowerBlock: PowerBlock | undefined;
    if (planEntry?.powerPrimer && !deloadPolicy) {
      resolvedPowerBlock = buildPowerBlock(
        planEntry.powerPrimer,
        workoutId,
        effectiveAthletePrefs?.availableEquipment ?? onboardingData?.equipment,
      );
    }

    // Deterministic plan intent always wins. Edge-authored typed intent is
    // accepted only for legacy/no-plan callers; names/focus never reconstruct it.
    const canonicalStrengthIntent = planEntry?.strengthIntent ?? cw.strengthIntent;
    const builtWorkout: Workout = {
      id: workoutId,
      microcycleId,
      dayOfWeek: cw.dayOfWeek,
      name: resolveSessionDisplayName({
        name: cw.name,
        focus: planEntry?.focus,
        exercises: finalExercises,
        strengthPattern: planEntry?.strengthPattern,
        strengthIntent: canonicalStrengthIntent,
        isTeamDay: planEntry?.isTeamDay,
        conditioningFlavour: planEntry?.conditioningFlavour,
        hasCombinedConditioning: planEntry?.hasCombinedConditioning,
        tier: planEntry?.tier,
      }),
      description: '',
      intensity: canonicalIntensity,
      workoutType: normalizedWorkoutType,
      sessionTier: canonicalTier,
      ...(planEntry?.planEntryId ? { planEntryId: planEntry.planEntryId } : {}),
      ...(canonicalStrengthIntent
        ? { strengthIntent: normalizeStrengthIntent(canonicalStrengthIntent) }
        : {}),
      ...(planEntry?.strengthPatternContributions?.length
        ? { strengthPatternContributions: [...planEntry.strengthPatternContributions] }
        : {}),
      ...(planEntry?.hasCombinedConditioning ? { hasCombinedConditioning: true } : {}),
      ...(planEntry?.attachedConditioningKind ? { attachedConditioningKind: planEntry.attachedConditioningKind } : {}),
      ...(planEntry?.conditioningFlavour ? { conditioningFlavour: planEntry.conditioningFlavour } : {}),
      ...(planEntry?.conditioningCategory ? { conditioningCategory: planEntry.conditioningCategory } : {}),
      ...(planEntry?.section18ConditioningRole
        ? { section18ConditioningRole: planEntry.section18ConditioningRole }
        : {}),
      ...(planEntry?.conditioningFeasibility
        ? { conditioningFeasibility: planEntry.conditioningFeasibility }
        : {}),
      ...(resolvedConditioningBlock ? { conditioningBlock: resolvedConditioningBlock } : {}),
      ...(resolvedSpeedBlock ? { speedBlock: resolvedSpeedBlock } : {}),
      ...(resolvedPowerBlock ? { powerBlock: resolvedPowerBlock } : {}),
      durationMinutes: 0,
      exercises: finalExercises,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const finalWorkout = applyResolvedConditioningSubstitution(
      finaliseBuiltWorkout(builtWorkout, planEntry),
    );
    return attachPrescriptionEffectEvidence(
      attachSessionEffectEvidence(
        finalWorkout,
        planEntry?.deterministicCoachNoteEffects,
      ),
      beginnerPrescriptionEvidence,
    );
  });
}

/**
 * Default user profile
 */
export const DEFAULT_PROFILE: UserProfile = {
  id: 'user-default',
  email: 'athlete@localfooty.app',
  displayName: 'Athlete',
  age: 25,
  position: 'inside_mid',
  experienceLevel: '2-5 years',
  hasBarbell: true,
  hasDumbbells: true,
  hasFullGym: true,
  trainingLocation: 'Commercial gym',
  daysPerWeek: 6,
  injuryHistory: [],
  primaryGoals: ['Build Strength', 'Improve Performance'],
  subscriptionStatus: 'active',
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Default training program
 */
// Compute week-aligned block bounds once at module load
const _defaultBounds = computeBlockBounds(new Date(`${todayISOLocal()}T12:00:00`));

export const DEFAULT_PROGRAM: TrainingProgram = {
  id: 'prog-1',
  userId: 'user-default',
  name: 'Foundation Strength Program',
  description: 'Build strength and conditioning with 6 training days per week',
  programPhase: 'Pre-Season-Skills',
  startDate: new Date(_defaultBounds.blockStart + 'T12:00:00').toISOString(),
  endDate: new Date(_defaultBounds.blockEnd + 'T12:00:00').toISOString(),
  primaryFocus: 'Strength and Conditioning',
  isActive: true,
  microcycles: [createDefaultMicrocycle('prog-1')],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
