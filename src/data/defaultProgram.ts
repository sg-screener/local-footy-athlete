import {
  TrainingProgram,
  Microcycle,
  Workout,
  WorkoutExercise,
  Exercise,
  UserProfile,
  SessionTier,
  OnboardingData,
  ConditioningBlock,
  IntensityLevel,
  WorkoutType,
} from '../types/domain';
import type { SessionAllocation } from '../utils/coachingEngine';
import { computeBlockBounds } from '../utils/sessionResolver';
import { logger } from '../utils/logger';
import { applyLoadEstimates } from '../utils/loadEstimation';
import {
  buildConditioningTemplate,
  conditioningFlavourToExerciseName,
  conditioningCategoryToExerciseName,
  conditioningWorkoutType,
  isRunningBasedConditioning,
  switchToOffFeetModality,
  tagAsShiftedFromRun,
  conditioningDateHash,
  SPEED_SPRINT_TEMPLATES,
  type ErgModality,
  type ConditioningFeel,
  type ConditioningVariant,
} from '../utils/sessionBuilder';
import { resolveSessionDisplayName } from '../utils/sessionNaming';
import {
  applyPoolRotation,
  findPoolEntry,
  type RotationContext,
  type AthletePoolPrefs,
} from './exercisePoolsStrength';

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
    description: 'Nordic hamstring lower — eccentric posterior-chain isolation',
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
  const today = new Date();
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
      [
        { exerciseId: 'ex-sprint-intervals', sets: 10, repsMin: 1, repsMax: 1, weight: 0, rest: 60, notes: 'Footy training' },
      ],
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
      [
        { exerciseId: 'ex-tempo-run', sets: 1, repsMin: 1, repsMax: 1, weight: 0, rest: 0, notes: 'Footy training' },
      ],
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
        { exerciseId: 'ex-nordic-lower', sets: 3, repsMin: 6, repsMax: 8, weight: 0, rest: 90 },
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

  // Apply intelligent load estimates if onboarding data is available
  const finalWorkouts = onboardingData
    ? workouts.map(w => ({
        ...w,
        exercises: applyLoadEstimates(w.exercises, onboardingData),
      }))
    : workouts;

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

/**
 * Convert coach AI workout JSON into app Workout[] format
 */
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
    options: [
      {
        title: headlineName,
        description: '',
        exerciseIds: condBlock.map((ex) => ex.id),
      },
    ],
  };
}

export function buildWorkoutsFromCoach(
  coachWorkouts: Array<{
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
  }>,
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
  const planLookup = weeklyPlan ? buildPlanLookup(weeklyPlan) : null;

  // ── Build a synthetic dateStr for deterministic variety ──
  // AI-generated workouts don't have a real date at build time,
  // so we use today + dayOfWeek offset for template hashing.
  const today = new Date();
  const todayDow = today.getDay(); // 0=Sun
  function syntheticDateStr(dayOfWeek: number): string {
    const offset = ((dayOfWeek - todayDow) + 7) % 7;
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }

  // Infer strength region from a SessionAllocation.focus string on
  // combined S+C days. Used by the conditioning builder to force
  // ergometer modality when pairing a lower lift with sprint/glycolytic
  // work, so we don't hammer the legs twice in one session.
  // Mirrors the keyword checks in coachingEngine.getSessionRegion, scoped
  // to the strength fragment (everything before the "+ ... finisher" suffix).
  function inferStrengthRegionFromFocus(
    focus: string | undefined,
  ): 'lower' | 'upper' | 'full' | undefined {
    if (!focus) return undefined;
    const strengthPart = focus.split('+')[0].toLowerCase();
    if (
      strengthPart.includes('lower body') ||
      strengthPart.includes('hip-dominant lower') ||
      strengthPart.includes('squat') ||
      strengthPart.includes('hinge') ||
      strengthPart.includes('leg')
    ) return 'lower';
    if (
      strengthPart.includes('upper body') ||
      strengthPart.includes('push') ||
      strengthPart.includes('pull')
    ) return 'upper';
    if (strengthPart.includes('full body')) return 'full';
    return undefined;
  }

  function normalizeGeneratedWorkoutType(
    cw: { name: string; workoutType: string },
    planEntry: SessionAllocation | null,
  ): WorkoutType {
    const raw = String(cw.workoutType || '').trim().toLowerCase();
    const text = `${cw.name || ''} ${planEntry?.focus || ''}`.toLowerCase();

    if (planEntry?.isTeamDay || raw === 'team' || raw === 'team training') {
      return 'Team Training';
    }
    if (raw === 'strength') return 'Strength';
    if (raw === 'conditioning') return 'Conditioning';
    if (raw === 'recovery') return 'Recovery';
    if (raw === 'mixed') return 'Mixed';
    if (raw === 'game') return 'Game';

    // Older generate-mode schema incorrectly described workoutType as a tier.
    // Treat those values as sessionTier only and infer the app-level type.
    if (raw === 'core' || raw === 'optional') {
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
  ): string {
    return resolveSessionDisplayName({
      name,
      focus,
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
  const sortedCw = [...coachWorkouts].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const usedErgs = new Set<ErgModality>();
  let lastErg: ErgModality | undefined; // last erg used on the immediately-preceding day
  let lastErgDow = -2;
  let runStreak = 0;
  let prevDow = -2;
  for (const cw of sortedCw) {
    const planEntry = planLookup?.get(cw.dayOfWeek) ?? null;
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
    const candidateName = planEntry.conditioningCategory
      ? conditioningCategoryToExerciseName(
          planEntry.conditioningCategory,
          dateStr,
          rotationContext?.miniCycleNumber,
        )
      : conditioningFlavourToExerciseName(planEntry.conditioningFlavour, dateStr);
    const isCombined = !!planEntry.hasCombinedConditioning;
    // Infer the strength region being paired on combined days so the
    // conditioning builder can auto-shift to an ergometer when pairing a
    // lower-body lift with sprint or glycolytic work. "Lower body" /
    // "hip-dominant" / "squat" / "hinge" / "leg" all count as lower.
    const strengthRegion: 'lower' | 'upper' | 'full' | undefined =
      !isCombined ? undefined
      : inferStrengthRegionFromFocus(planEntry.focus);

    // ── Assign feel (density/psychological character) per session ──
    // Deterministic per date + category so sessions feel distinct but
    // stay reproducible. Categories without meaningful feel variation
    // (pure speed micro-doses) fall back to undefined.
    const cat = planEntry.conditioningCategory;
    const engineFeel: ConditioningFeel | undefined = planEntry.conditioningFeel as ConditioningFeel | undefined;
    const feel: ConditioningFeel | undefined =
      engineFeel ? engineFeel
      : (cat === 'aerobic_base' || cat === 'vo2' || cat === 'glycolytic' || cat === 'sprint')
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
        || (cat === 'sprint' && strengthRegion === 'lower')
      );
    // Standalone aerobic_base (Long Nasal Run) MAY pick an erg. When we
    // have an unused erg available, hint it to bias away from run to
    // spread modality load across the week — but only after run exposure
    // has already been used once, so we preserve running as the default.
    const willUseErgStandaloneAero =
      !isCombined && cat === 'aerobic_base' && usedErgs.size < 3;
    let ergHint: ErgModality | undefined;
    if (willUseErgCombined) {
      const pool: ErgModality[] =
        (strengthRegion === 'lower' && (cat === 'sprint' || cat === 'glycolytic'))
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
    } else if (willUseErgStandaloneAero && planEntry.ergModality) {
      ergHint = planEntry.ergModality as ErgModality;
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
    const isConsecutive = cw.dayOfWeek - prevDow === 1;
    const candidateIsRun = isRunningBasedConditioning(candidateName);
    const isProtectedSpeed = SPEED_SPRINT_TEMPLATES.has(candidateName);
    // A day counts as run-exposure if EITHER the conditioning candidate
    // is run-based OR the athlete has team training on the same day
    // (team = sprints + skills + contact = running).
    const dayIsRun = candidateIsRun || isTeamDay;

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
      const offFeet = planEntry.conditioningVariant === 'reduced' && cat === 'aerobic_base'
        ? buildConditioningTemplate(candidateName, dateStr, {
            variant: 'reduced',
            ergModality: planEntry.ergModality as ErgModality | undefined,
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
            strengthRegion,
            feel,
            ergModality: ergHint,
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
          strengthRegion,
          feel,
          ergModality: ergHint,
          variant: planEntry.conditioningVariant as ConditioningVariant | undefined,
        }),
        shiftedFromRun: false,
      };
    }

    conditioningByDow.set(cw.dayOfWeek, resolved);
    prevDow = cw.dayOfWeek;
  }

  return coachWorkouts.map((cw) => {
    const workoutId = `w-coach-${cw.dayOfWeek}`;
    const planEntry = planLookup?.get(cw.dayOfWeek) ?? null;
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

    // ──────────────────────────────────────────────────────────────────────
    // STANDALONE CONDITIONING — fully deterministic, AI exercises IGNORED
    // ──────────────────────────────────────────────────────────────────────
    const isStandaloneConditioning = planEntry
      && planEntry.conditioningFlavour
      && !planEntry.hasCombinedConditioning;

    if (isStandaloneConditioning) {
      const resolved = conditioningByDow.get(cw.dayOfWeek);
      const dateStr = syntheticDateStr(cw.dayOfWeek);
      const exerciseName = resolved?.exerciseName
        ?? (planEntry.conditioningCategory
          ? conditioningCategoryToExerciseName(
              planEntry.conditioningCategory,
              dateStr,
              rotationContext?.miniCycleNumber,
            )
          : conditioningFlavourToExerciseName(planEntry.conditioningFlavour!, dateStr));
      const condExercises = resolved?.exercises
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
        : exerciseName;
      const condWorkoutType = resolved?.shiftedFromRun
        || isReducedAerobicBase
        ? 'Conditioning'
        : conditioningWorkoutType(exerciseName);

      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} STANDALONE CONDITIONING — flavour="${planEntry.conditioningFlavour}" → template="${exerciseName}"${resolved?.shiftedFromRun ? ' [SHIFTED off-feet]' : ''} (AI exercises IGNORED: ${cw.exercises.length} discarded)`);

      return {
        id: workoutId,
        microcycleId,
        dayOfWeek: cw.dayOfWeek,
        name: resolveSessionDisplayName({
          name: displayName,
          focus: planEntry?.focus,
          isTeamDay: planEntry?.isTeamDay,
          conditioningFlavour: planEntry?.conditioningFlavour,
          hasCombinedConditioning: planEntry?.hasCombinedConditioning,
          tier: planEntry?.tier,
        }),
        description: '',
        intensity: canonicalIntensity,
        workoutType: condWorkoutType as any,
        sessionTier: canonicalTier,
        conditioningFlavour: planEntry.conditioningFlavour,
        durationMinutes: 0,
        exercises: condExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Workout;
    }

    // ──────────────────────────────────────────────────────────────────────
    // STRENGTH (or non-conditioning) — AI generates exercises
    // ──────────────────────────────────────────────────────────────────────
    // Per-session pool usage tracker. Prevents two AI-suggested exercises
    // in the same (slot, role) from collapsing to the same rotation pick.
    const poolUsage = rotationContext
      ? new Map<string, Set<string>>()
      : undefined;

    const aiExercises: WorkoutExercise[] = cw.exercises.map((ex, index) => {
      // Cross-cycle variation: rewrite AI-suggested name to the
      // rotation-selected pool variant when applicable. Non-pool exercises
      // (carry, core, isolation, anything untagged) pass through unchanged.
      const resolvedName = rotationContext && poolUsage
        ? applyPoolRotation(ex.name, rotationContext, poolUsage, athletePrefs)
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

    // Apply load estimates for exercises missing weights
    let finalExercises = onboardingData
      ? applyLoadEstimates(validatedExercises, onboardingData)
      : validatedExercises;

    // Resolved conditioning block — assembled below for combined S+C days.
    let resolvedConditioningBlock: ConditioningBlock | undefined;

    // ──────────────────────────────────────────────────────────────────────
    // COMBINED S+C — AI strength + deterministic conditioning appended
    // ──────────────────────────────────────────────────────────────────────
    if (planEntry?.hasCombinedConditioning && planEntry.conditioningFlavour) {
      // Strip any AI-generated conditioning exercises from the strength block.
      // The AI sometimes adds conditioning filler — we replace it entirely.
      // Walk backwards from the tail (same logic as DayWorkoutScreen) to find
      // where conditioning exercises start, then chop them off.
      const COND_KEYWORDS = /finisher|zone\s*2|aerobic|tempo|interval|conditioning|repeat\s*effort|threshold|MAS|sprint|jog|run|bike|row|ski|swim/i;
      let splitIdx = finalExercises.length;
      for (let i = finalExercises.length - 1; i >= 0; i--) {
        const name = finalExercises[i].exercise?.name || '';
        const notes = finalExercises[i].notes || '';
        if (COND_KEYWORDS.test(name) || COND_KEYWORDS.test(notes)) {
          splitIdx = i;
        } else {
          break; // stop as soon as we hit a non-conditioning exercise
        }
      }
      const strengthBlock = splitIdx > 0
        ? finalExercises.slice(0, splitIdx)
        : finalExercises;

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
          strengthRegion: inferStrengthRegionFromFocus(planEntry.focus),
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
      );

      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} COMBINED S+C — strength=${strengthBlock.length} exercises (AI) + conditioning="${condExName}"${resolved?.shiftedFromRun ? ' [SHIFTED off-feet]' : ''} (template, ${condBlock.length} exercises)`);
    } else {
      logger.debug(`[BUILDER-TRACE] day=${cw.dayOfWeek} aiName="${cw.name}" aiType="${cw.workoutType}" aiTier="${cw.sessionTier}" → canonicalTier="${canonicalTier}" intensity="${canonicalIntensity}" planEntry=${planEntry ? `"${planEntry.tier} / ${planEntry.focus?.substring(0, 40)}"` : 'NONE'}`);
    }

    return {
      id: workoutId,
      microcycleId,
      dayOfWeek: cw.dayOfWeek,
      name: resolveSessionDisplayName({
        name: cw.name,
        focus: planEntry?.focus,
        isTeamDay: planEntry?.isTeamDay,
        conditioningFlavour: planEntry?.conditioningFlavour,
        hasCombinedConditioning: planEntry?.hasCombinedConditioning,
        tier: planEntry?.tier,
      }),
      description: '',
      intensity: canonicalIntensity,
      workoutType: normalizeGeneratedWorkoutType(cw, planEntry),
      sessionTier: canonicalTier,
      ...(planEntry?.hasCombinedConditioning ? { hasCombinedConditioning: true } : {}),
      ...(planEntry?.conditioningFlavour ? { conditioningFlavour: planEntry.conditioningFlavour } : {}),
      ...(planEntry?.conditioningCategory ? { conditioningCategory: planEntry.conditioningCategory } : {}),
      ...(resolvedConditioningBlock ? { conditioningBlock: resolvedConditioningBlock } : {}),
      durationMinutes: 0,
      exercises: finalExercises,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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
  position: 'Midfielder',
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
const _defaultBounds = computeBlockBounds(new Date());

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
