/**
 * Sam's S&C Rules Engine
 *
 * TypeScript implementation of Sam's coaching philosophy and training rules
 * Used for generating program previews on the client side
 *
 * Sam's Core Philosophy:
 * - 7 phases matching AFL calendar
 * - 3-4 week mini-cycles with same program then small variation
 * - Progressive overload: Compounds 5→8→increase→back to 5, Accessories 10→15→increase→back to 10
 * - NO RPE tracking, NO scheduled deloads, NO per-set logging
 * - Movement patterns: squat, hinge, push horizontal, push vertical, pull horizontal, pull vertical, carry
 * - Simple session feedback: Cooked/Strong/Good/Average/Sore
 *
 * Key concept: COMPOUND vs ACCESSORY
 * - Compound lifts (squat, bench, deadlift, OHP, rows, pull-ups) follow phase-specific rep ranges
 * - Accessories (lateral raise, skull crushers, curls, face pulls) ALWAYS stay 8-15 reps regardless of phase
 * - Rep ranges are flexible guidelines, not hard rules — use judgment
 *
 * Functions:
 * - getTrainingSplit(daysPerWeek): Get the workout split for a given frequency
 * - selectExercisesForWorkout(focus, profile, availableExercises): Select appropriate exercises
 * - calculateProgressiveOverload(weekInMiniCycle, currentReps, currentWeight, category): Progressive overload model
 * - filterExercises(exercises, profile, rulesConfig): Filter exercises by constraints
 * - classifyExercise(name): Classify exercise as Compound or Accessory
 * - getRepRangeForExercise(exerciseName, phase): Get appropriate rep range based on exercise category
 */

import type {
  Position,
  ExperienceLevel,
  ProgramPhase,
  Exercise,
  UserProfile,
} from '../types/domain';

/**
 * Program Phase Configuration (Sam's 7 phases)
 * Defines training parameters for each season phase
 *
 * IMPORTANT: Rep ranges are FLEXIBLE GUIDELINES, not hard rules.
 * - compoundRepRange: default range for big compound lifts (squat, bench, deadlift, OHP, rows)
 * - accessoryRepRange: default range for accessories/isolation (lateral raise, skull crushers, curls, etc.)
 * The AI coach has judgment to deviate from these based on context (e.g. 3x5 bench in-season is fine
 * if the athlete has been doing 3x3 for a while).
 */
export interface PhaseConfig {
  compoundRepRange: [number, number];
  accessoryRepRange: [number, number];
  setRange: [number, number];
  intensityMultiplier: number;
  durationWeeks: number;
  focus: string;
  miniCycleDuration: number; // 3-4 weeks
}

/**
 * Exercise category - determines which rep range to use
 * Compounds follow phase-based rep ranges (heavier)
 * Accessories always stay in moderate-high rep ranges (8-15)
 */
export type ExerciseCategory = 'Compound' | 'Accessory';

/**
 * Classify an exercise as compound or accessory
 * Compounds: multi-joint movements that are the "big lifts"
 * Accessories: isolation/single-joint or lighter supplementary work
 */
export const COMPOUND_EXERCISES = new Set([
  'Back Squat', 'Box Squat', 'Front Squat', 'Deadlift', 'Trap Bar Deadlift',
  'RDLs', 'Bench Press', 'DB Bench Press', 'Incline Bench', 'Close Grip Bench',
  'Overhead Press', 'DB Shoulder Press', 'Landmine Press', 'Barbell Row',
  'Single-Arm DB Row', 'Pull-Ups', 'Chin-Ups', 'Dips',
  'Bulgarian Split Squats', 'Hip Thrusts', 'Farmer Carry', 'Suitcase Carry',
]);

export function classifyExercise(exerciseName: string): ExerciseCategory {
  return COMPOUND_EXERCISES.has(exerciseName) ? 'Compound' : 'Accessory';
}

/**
 * Training Split Definition
 */
export interface TrainingSplit {
  days: WorkoutDayDefinition[];
  description: string;
}

/**
 * Individual workout day definition
 */
export interface WorkoutDayDefinition {
  name: string;
  focus: string;
  defaultType:
    | 'Strength'
    | 'Conditioning'
    | 'Technical'
    | 'Recovery'
    | 'Mixed'
    | 'Flush-Out'
    | 'Sprint-Intervals'
    | 'Nordic-4x4'
    | 'Long-Run'
    | 'MetCon'
    | 'Flog-Friday'
    | '6x1km'
    | 'Hill-Sprints'
    | 'MAS-Training'
    | 'Tempo-Run'
    | 'Quality-Sprints';
  defaultIntensity: 'Light' | 'Moderate' | 'High' | 'Maximal';
}

/**
 * Exercise filter criteria
 */
export interface ExerciseFilter {
  position?: Position;
  injuries?: string[];
  experience?: ExperienceLevel;
  equipment?: string[];
  muscleGroups?: string[];
}

/**
 * SAM'S AFL S&C RULES CONFIGURATION
 *
 * This is the core business logic that defines all training parameters,
 * exercise selections, and program structure aligned with Sam's coaching philosophy.
 */
export const AFL_RULES_CONFIG = {
  /**
   * Phase Configurations - Sam's 7 phases
   * Each phase has specific rep ranges, set ranges, and focus
   * NO RPE targets, NO deload frequencies
   */
  /**
   * Phase Configurations - Sam's 7 phases
   *
   * Rep ranges are DEFAULTS / GUIDELINES — not hard caps.
   * Compounds follow heavier phase-specific ranges.
   * Accessories ALWAYS stay in the 8-15 rep range regardless of phase
   * (e.g. lateral raises, skull crushers, curls should never be sets of 3).
   *
   * The AI coach can deviate from these when it makes sense
   * (e.g. 3x5 bench in-season is totally fine if the athlete has been doing 3x3 for a while).
   */
  phases: {
    'Post-Season': {
      compoundRepRange: [3, 5] as [number, number],
      accessoryRepRange: [10, 15] as [number, number],
      setRange: [2, 3] as [number, number],
      intensityMultiplier: 0.6,
      durationWeeks: 2,
      focus: 'Complete rest and recovery',
      miniCycleDuration: 2,
    } as PhaseConfig,

    'Early-Off-Season': {
      compoundRepRange: [8, 10] as [number, number],
      accessoryRepRange: [10, 15] as [number, number],
      setRange: [3, 4] as [number, number],
      intensityMultiplier: 0.8,
      durationWeeks: 4,
      focus: 'Pure hypertrophy, light cardio',
      miniCycleDuration: 4,
    } as PhaseConfig,

    'Base-Building': {
      compoundRepRange: [5, 8] as [number, number],
      accessoryRepRange: [10, 15] as [number, number],
      setRange: [3, 4] as [number, number],
      intensityMultiplier: 0.95,
      durationWeeks: 6,
      focus: 'Hypertrophy-strength blend, aerobic base',
      miniCycleDuration: 4,
    } as PhaseConfig,

    'Pre-Season-Skills': {
      compoundRepRange: [3, 5] as [number, number],
      accessoryRepRange: [10, 15] as [number, number],
      setRange: [3, 4] as [number, number],
      intensityMultiplier: 1.0,
      durationWeeks: 6,
      focus: '3-5 gym days, 2 conditioning, strength focus',
      miniCycleDuration: 4,
    } as PhaseConfig,

    'Christmas-Block': {
      compoundRepRange: [3, 5] as [number, number],
      accessoryRepRange: [8, 12] as [number, number],
      setRange: [3, 5] as [number, number],
      intensityMultiplier: 1.1,
      durationWeeks: 6,
      focus: 'THE most important block: 4+ conditioning, 3-5 strength',
      miniCycleDuration: 3,
    } as PhaseConfig,

    'Return-to-Skills': {
      compoundRepRange: [3, 5] as [number, number],
      accessoryRepRange: [10, 15] as [number, number],
      setRange: [2, 3] as [number, number],
      intensityMultiplier: 0.95,
      durationWeeks: 4,
      focus: 'Volume drops, fitness ~90%, quality work',
      miniCycleDuration: 4,
    } as PhaseConfig,

    'In-Season': {
      compoundRepRange: [3, 5] as [number, number],
      accessoryRepRange: [10, 15] as [number, number],
      setRange: [2, 3] as [number, number],
      intensityMultiplier: 0.9,
      durationWeeks: 26,
      focus: 'Maintenance: 3 gym sessions min, flush-outs, bike sprints, Gun Show Friday',
      miniCycleDuration: 4,
    } as PhaseConfig,
  } as Record<ProgramPhase, PhaseConfig>,

  /**
   * Training Splits - Sam's structure
   * Define workout schedules based on days per week
   * Focused on movement patterns: squat, hinge, push horizontal, push vertical, pull horizontal, pull vertical, carry
   */
  splits: {
    1: {
      days: [
        {
          name: 'Full Body Strength',
          focus: 'Squat, Bench/OHP, Row/Pull-up, Carries',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
      ],
      description: '1 day per week - Full Body',
    } as TrainingSplit,

    2: {
      days: [
        {
          name: 'Lower Body Strength',
          focus: 'Squat, RDLs, Bulgarian Split Squats, Carries',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Upper Body Strength',
          focus: 'Bench Press, Overhead Press, Rows, Pull-ups',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
      ],
      description: '2 days per week - Lower, Upper',
    } as TrainingSplit,

    3: {
      days: [
        {
          name: 'Lower (Squat + Hinge)',
          focus: 'Box Squat, Bulgarian Split Squats, RDLs, Farmer Carries',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Upper (Push + Pull)',
          focus: 'Bench Press, Overhead Press, Rows, Pull-ups',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Full Body or Conditioning',
          focus: 'Full body mix or conditioning session',
          defaultType: 'Mixed',
          defaultIntensity: 'Moderate',
        },
      ],
      description: '3 days per week - Lower, Upper, Full Body/Conditioning',
    } as TrainingSplit,

    4: {
      days: [
        {
          name: 'Lower Strength',
          focus: 'Squat focus: Back Squat, Box Squat',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Upper Strength',
          focus: 'Bench Press, Overhead Press, Rows',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Lower Hypertrophy/Power',
          focus: 'Bulgarian Split Squats, RDLs, Box Jumps',
          defaultType: 'Mixed',
          defaultIntensity: 'Moderate',
        },
        {
          name: 'Upper Hypertrophy + Gun Show',
          focus: 'Dips, Accessory work, Arms',
          defaultType: 'Mixed',
          defaultIntensity: 'Moderate',
        },
      ],
      description: '4 days per week - Lower Strength, Upper Strength, Lower Hyper/Power, Upper Hyper + Arms',
    } as TrainingSplit,

    5: {
      days: [
        {
          name: 'Lower Strength',
          focus: 'Back Squat, Deadlift focus',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Upper Push',
          focus: 'Bench Press, Overhead Press, Dips',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Upper Pull',
          focus: 'Pull-ups, Chin-ups, Rows',
          defaultType: 'Strength',
          defaultIntensity: 'High',
        },
        {
          name: 'Lower Power/Conditioning',
          focus: 'RDLs, Bulgarian Split Squats, Carries, Conditioning',
          defaultType: 'Mixed',
          defaultIntensity: 'Moderate',
        },
        {
          name: 'Gun Show Friday',
          focus: 'Arms, shoulders, accessory work',
          defaultType: 'Mixed',
          defaultIntensity: 'Moderate',
        },
      ],
      description: '5 days per week - Lower, Upper Push, Upper Pull, Lower Power/Cond, Gun Show',
    } as TrainingSplit,
  } as Record<number, TrainingSplit>,

  /**
   * Position-Specific Exercise Priorities (Sam's approved exercises only)
   * NO Olympic lifts, NO speed ladders, NO complex agility drills
   * Focus on movement patterns: squat, hinge, push horizontal, push vertical, pull horizontal, pull vertical, carry
   */
  positionPriorities: {
    Ruck: [
      'Overhead Press',
      'Bench Press',
      'Pull-Ups',
      'Deadlift',
      'Back Squat',
      'Rows',
      'Farmer Carry',
      'Box Squat',
      'Bulgarian Split Squat',
      'RDLs',
      'Dips',
      'Chin-Ups',
    ] as string[],

    Forward: [
      'Back Squat',
      'Bench Press',
      'Deadlift',
      'Bulgarian Split Squats',
      'Box Jumps',
      'Dips',
      'RDLs',
      'Single Leg Work',
      'Farmer Carry',
      'Rows',
      'Overhead Press',
      'Landmine Press',
    ] as string[],

    Midfielder: [
      'Back Squat',
      'Deadlift',
      'Pull-Ups',
      'Bulgarian Split Squats',
      'RDLs',
      'Farmer Carry',
      'Rows',
      'Chin-Ups',
      'Overhead Press',
      'Bench Press',
      'Box Squat',
      'Suitcase Carry',
    ] as string[],

    Defender: [
      'Back Squat',
      'Deadlift',
      'Pull-Ups',
      'RDLs',
      'Bulgarian Split Squats',
      'Rows',
      'Farmer Carry',
      'Single Leg Work',
      'Bench Press',
      'Overhead Press',
      'Chin-Ups',
      'Box Squat',
    ] as string[],
  } as Partial<Record<Position, string[]>>,

  /**
   * Injury Restrictions
   * Exercises to avoid for specific injury types
   */
  injuryRestrictions: {
    ACL_Injury: [
      'Full Back Squat',
      'Deep Lunges',
      'Plyometric Drills',
      'Side to Side Movements',
      'Jump Squats',
      'Lateral Bounds',
      'Lateral Lunges',
    ] as string[],

    Lower_Back_Pain: [
      'Heavy Deadlifts',
      'Hyperextensions',
      'Weighted Sit-ups',
      'Power Clean',
      'Heavy Back Squats',
      'Overhead Carries',
      'Heavy Bent Over Rows',
    ] as string[],

    Shoulder_Impingement: [
      'Overhead Press',
      'Pull-Ups',
      'Bench Press',
      'Dumbbell Flyes',
      'Lateral Raise',
      'Upright Rows',
      'Behind the Neck Press',
    ] as string[],

    Hamstring_Strain: [
      'Nordic Lower',
      'Heavy Deadlifts',
      'Explosive Movements',
      'Heavy Sprints',
      'Plyometric Drills',
      'Jump Squats',
      'Bounds',
    ] as string[],

    Elbow_Tendinitis: [
      'Bench Press',
      'Tricep Work',
      'Upright Rows',
      'Barbell Row',
      'Pull-Ups',
      'Close Grip Bench',
    ] as string[],
  } as Record<string, string[]>,

  /**
   * Equipment Substitution Rules
   * Exercises can be substituted if equipment is unavailable
   */
  equipmentSubstitutions: {
    Barbell: ['Dumbbells', 'Kettlebells', 'Resistance Bands'] as string[],
    Dumbbells: ['Barbells', 'Kettlebells', 'Resistance Bands'] as string[],
    Bench: ['Floor', 'Swiss Ball', 'Dumbbell'] as string[],
    Rack: ['TRX', 'Rings', 'Resistance Bands'] as string[],
    'Pull-up Bar': ['TRX', 'Resistance Bands'] as string[],
  } as Record<string, string[]>,
};

/**
 * Get training split for a given days per week
 *
 * @param daysPerWeek Number of training days (3-5 per Sam's philosophy)
 * @returns Training split with workout day definitions
 */
export function getTrainingSplit(daysPerWeek: number): TrainingSplit | null {
  // Clamp to available split range (1-5). 6+ uses the 5-day split.
  const clamped = Math.max(1, Math.min(daysPerWeek, 5));
  return AFL_RULES_CONFIG.splits[clamped] || null;
}

/**
 * Select exercises for a workout based on filters
 *
 * @param focus Workout focus area (e.g., "Lower Strength")
 * @param userProfile User's profile and constraints
 * @param availableExercises Pool of exercises to select from
 * @param count Number of exercises to select (default 4-6)
 * @returns Selected exercises
 */
export function selectExercisesForWorkout(
  focus: string,
  userProfile: UserProfile,
  availableExercises: Exercise[],
  count: number = 4
): Exercise[] {
  // Filter exercises based on user constraints
  const filtered = filterExercises(
    availableExercises,
    {
      position: userProfile.position,
      injuries: userProfile.injuryHistory,
      experience: userProfile.experienceLevel,
      equipment: getAvailableEquipment(userProfile),
    },
    AFL_RULES_CONFIG
  );

  if (filtered.length === 0) {
    return availableExercises.slice(0, count);
  }

  // Prioritize position-specific exercises
  const positionPriorities = AFL_RULES_CONFIG.positionPriorities[userProfile.position] || [];
  const prioritized = filtered.filter((ex) => positionPriorities.includes(ex.name));

  // Use prioritized if available, otherwise use filtered
  const pool = prioritized.length > 0 ? prioritized : filtered;

  // Randomly select from pool without replacement
  return randomSelectMultiple(pool, count);
}

/**
 * Calculate progressive overload following Sam's model
 *
 * COMPOUNDS (squat, bench, deadlift, OHP, rows, etc.):
 * - Start at 5 reps → work up to 8 → increase weight → back to 5
 * - Weight increases: 2.5kg jumps
 *
 * ACCESSORIES (lateral raise, skull crushers, curls, etc.):
 * - Start at 10 reps → work up to 15 → increase weight → back to 10
 * - Weight increases: 1.25kg jumps (or next DB up)
 *
 * These are GUIDELINES — the AI coach uses judgment to adjust.
 * No RPE tracking, listen to the body for recovery.
 *
 * @param weekInMiniCycle Which week in the current 3-4 week mini-cycle (1-4)
 * @param currentReps Current reps being hit
 * @param currentWeight Current weight being lifted
 * @param exerciseCategory Whether exercise is Compound or Accessory
 * @returns {reps: number, weight: number, notes: string} Next prescribed reps and weight
 */
export function calculateProgressiveOverload(
  weekInMiniCycle: number,
  currentReps: number,
  currentWeight: number,
  exerciseCategory: ExerciseCategory
): { reps: number; weight: number; notes: string } {
  if (exerciseCategory === 'Compound') {
    // COMPOUNDS: 5→8→increase→back to 5
    const minReps = 5;
    const maxReps = 8;
    const weightIncrease = 2.5;

    if (currentReps < minReps) {
      return {
        reps: minReps,
        weight: currentWeight,
        notes: 'Building back to base 5-rep range',
      };
    }

    if (currentReps >= minReps && currentReps < maxReps) {
      return {
        reps: Math.min(currentReps + 1, maxReps),
        weight: currentWeight,
        notes: 'Building volume, add reps',
      };
    }

    if (currentReps >= maxReps) {
      return {
        reps: minReps,
        weight: Math.round((currentWeight + weightIncrease) * 2) / 2,
        notes: 'Hit 8 reps, increase weight, reset to 5-rep range',
      };
    }
  } else {
    // ACCESSORIES: 10→15→increase→back to 10
    const minReps = 10;
    const maxReps = 15;
    const weightIncrease = 1.25;

    if (currentReps < minReps) {
      return {
        reps: minReps,
        weight: currentWeight,
        notes: 'Building back to base 10-rep range for accessory work',
      };
    }

    if (currentReps >= minReps && currentReps < maxReps) {
      return {
        reps: Math.min(currentReps + 1, maxReps),
        weight: currentWeight,
        notes: 'Building volume on accessory, add reps',
      };
    }

    if (currentReps >= maxReps) {
      return {
        reps: minReps,
        weight: Math.round((currentWeight + weightIncrease) * 2) / 2,
        notes: 'Hit 15 reps, bump weight, reset to 10-rep range',
      };
    }
  }

  return {
    reps: exerciseCategory === 'Compound' ? 5 : 10,
    weight: currentWeight,
    notes: 'Continue with current weight and reps',
  };
}

/**
 * Filter exercises based on user constraints
 *
 * @param exercises List of exercises to filter
 * @param filter Filter criteria
 * @param rulesConfig Rules configuration
 * @returns Filtered exercises
 */
export function filterExercises(
  exercises: Exercise[],
  filter: ExerciseFilter,
  rulesConfig: typeof AFL_RULES_CONFIG
): Exercise[] {
  let filtered = exercises;

  // Filter by available equipment
  if (filter.equipment && filter.equipment.length > 0) {
    filtered = filtered.filter((ex) => {
      const required = ex.equipmentRequired || [];
      return required.some((req) => filter.equipment?.includes(req));
    });
  }

  // Filter out exercises restricted by injuries
  if (filter.injuries && filter.injuries.length > 0) {
    const injuryExercises = new Set<string>();
    for (const injury of filter.injuries) {
      const restrictions = rulesConfig.injuryRestrictions[injury];
      if (restrictions) {
        restrictions.forEach((ex) => injuryExercises.add(ex));
      }
    }
    filtered = filtered.filter((ex) => !injuryExercises.has(ex.name));
  }

  // Filter by experience level
  if (filter.experience) {
    const difficulty = experienceToDifficulty(filter.experience);
    filtered = filtered.filter((ex) => {
      // Allow exercises at or below experience level
      const diffLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
      const exIndex = diffLevels.indexOf(ex.difficultyLevel);
      const userIndex = diffLevels.indexOf(difficulty);
      return exIndex <= userIndex;
    });
  }

  return filtered;
}

/**
 * Get available equipment for a user
 *
 * @param userProfile User's profile
 * @returns List of available equipment
 */
export function getAvailableEquipment(userProfile: UserProfile): string[] {
  const equipment: string[] = [];

  if (userProfile.hasBarbell) equipment.push('Barbell');
  if (userProfile.hasDumbbells) equipment.push('Dumbbells');
  if (userProfile.hasFullGym) {
    equipment.push('Cable Machine', 'Machine', 'Kettlebells', 'Medicine Ball', 'Plyometric Box');
  }

  // Add basic equipment that doesn't require anything
  equipment.push('Body Weight', 'Resistance Bands');

  return equipment;
}

/**
 * Convert experience level to difficulty level
 */
function experienceToDifficulty(
  experience: ExperienceLevel
): 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' {
  switch (experience) {
    case 'Complete beginner':
      return 'Beginner';
    case '1-2 years':
      return 'Intermediate';
    case '2-5 years':
      return 'Advanced';
    case '5+ years':
      return 'Expert';
    default:
      return 'Advanced';
  }
}

/**
 * Randomly select N items from array without replacement
 */
function randomSelectMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * Get phase configuration for current program phase
 *
 * @param phase Program phase
 * @returns Phase configuration
 */
export function getPhaseConfig(phase: ProgramPhase): PhaseConfig {
  return AFL_RULES_CONFIG.phases[phase];
}

/**
 * Get the appropriate rep range for an exercise based on its category and current phase.
 * Compounds use the phase-specific compoundRepRange.
 * Accessories ALWAYS use accessoryRepRange (8-15 range) regardless of phase.
 */
export function getRepRangeForExercise(
  exerciseName: string,
  phase: ProgramPhase
): [number, number] {
  const config = AFL_RULES_CONFIG.phases[phase];
  const category = classifyExercise(exerciseName);
  return category === 'Compound' ? config.compoundRepRange : config.accessoryRepRange;
}

/**
 * Get recommended rest periods based on exercise category
 * Compounds get longer rest (they're heavier), accessories get shorter rest
 */
export function getRestPeriod(minReps: number): number {
  if (minReps <= 5) return 180; // 3 minutes for heavy strength
  if (minReps <= 12) return 90; // 90 seconds for hypertrophy
  return 45; // 45 seconds for endurance
}

/**
 * Validate if a program phase is valid (Sam's 7 phases)
 */
export function isValidPhase(phase: any): phase is ProgramPhase {
  return [
    'Post-Season',
    'Early-Off-Season',
    'Base-Building',
    'Pre-Season-Skills',
    'Christmas-Block',
    'Return-to-Skills',
    'In-Season',
  ].includes(phase);
}

/**
 * Get workout type recommendations for focus area
 */
export function getWorkoutTypeForFocus(
  focus: string
):
  | 'Strength'
  | 'Conditioning'
  | 'Technical'
  | 'Recovery'
  | 'Mixed'
  | 'Flush-Out'
  | 'Sprint-Intervals'
  | 'Nordic-4x4'
  | 'Long-Run'
  | 'MetCon'
  | 'Flog-Friday'
  | '6x1km'
  | 'Hill-Sprints'
  | 'MAS-Training'
  | 'Tempo-Run'
  | 'Quality-Sprints' {
  const lower = focus.toLowerCase();

  // Strength-focused
  if (lower.includes('strength') || lower.includes('squat') || lower.includes('deadlift')) {
    return 'Strength';
  }

  // Conditioning variants (Sam's types)
  if (lower.includes('flush')) return 'Flush-Out';
  if (lower.includes('sprint') && lower.includes('interval')) return 'Sprint-Intervals';
  if (lower.includes('nordic')) return 'Nordic-4x4';
  if (lower.includes('long') && lower.includes('run')) return 'Long-Run';
  if (lower.includes('metcon')) return 'MetCon';
  if (lower.includes('flog')) return 'Flog-Friday';
  if (lower.includes('1km')) return '6x1km';
  if (lower.includes('hill')) return 'Hill-Sprints';
  if (lower.includes('mas')) return 'MAS-Training';
  if (lower.includes('tempo')) return 'Tempo-Run';
  if (lower.includes('quality') && lower.includes('sprint')) return 'Quality-Sprints';

  // Fallback
  if (lower.includes('conditioning')) return 'Conditioning';
  if (lower.includes('power') || lower.includes('explosive')) return 'Mixed';
  if (lower.includes('recovery')) return 'Recovery';

  return 'Mixed';
}
