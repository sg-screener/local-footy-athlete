/**
 * Supabase Edge Function: generate-program
 *
 * Generates a complete personalized training program for a user based on:
 * - User profile (position, experience, equipment, injuries)
 * - Current season phase (auto-detected by month)
 * - Training frequency preferences
 *
 * Implements Sam's Mini-Cycle Programming:
 * - Programs built in 3-4 week mini-cycles
 * - Same exercises repeat each week within a block (just add weight)
 * - After mini-cycle completes, rotate exercise variations
 * - Progressive overload: start at 5 reps → work to 8 → increase weight → back to 5
 * - NO scheduled deload weeks (listen to body)
 * - NO RPE tracking
 *
 * POST /generate-program
 * Body: {
 *   user_id: string,
 *   program_phase?: ProgramPhase,
 *   resolvedEquipmentTags?: CanonicalEquipmentTag[]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   programId?: string,
 *   error?: string
 * }
 */

import {
  createSupabaseClient,
  errorResponse,
  successResponse,
  parseJsonBody,
  validateRequired,
  now,
  addDays,
  log,
  withRetry,
  chunk,
} from '../shared/utils.ts';

import {
  type DbUserProfile,
  type GenerateProgramRequest,
  type GenerateProgramResponse,
  type RulesConfig,
  ProgramPhase,
  Position,
  ExperienceLevel,
  IntensityLevel,
  WorkoutType,
} from '../shared/types.ts';
import {
  edgeExerciseRequirementsAreAvailable,
  normalizeResolvedEquipmentTags,
  type CanonicalEquipmentTag,
} from '../shared/equipment.ts';

/**
 * Sam's AFL S&C Rules Configuration - Mini-Cycle Programming Edition
 *
 * CRITICAL: Rep ranges are FLEXIBLE GUIDELINES, not hard rules.
 * - compoundRepRange: default range for big compound lifts (squat, bench, deadlift, OHP, rows)
 * - accessoryRepRange: default range for accessories/isolation (lateral raise, skull crushers, curls, etc.)
 * Accessories ALWAYS stay in the 8-15 rep range regardless of phase.
 * The AI coach can deviate from compound ranges when it makes sense
 * (e.g. 3x5 bench in-season is fine if they've been on 3x3 for a while).
 */

/**
 * Compound exercises - multi-joint, big lifts that follow phase-specific heavier rep ranges
 */
const COMPOUND_EXERCISE_NAMES = new Set([
  'Back Squat', 'Box Squat', 'Front Squat', 'Deadlift', 'Trap Bar Deadlift',
  'RDLs', 'Bench Press', 'DB Bench Press', 'Incline Bench', 'Close Grip Bench',
  'Overhead Press', 'DB Shoulder Press', 'Landmine Press', 'Barbell Rows',
  'DB Rows', 'Pendlay Rows', 'Pull-ups', 'Chin-ups', 'Dips',
  'Bulgarian Split Squats', 'Hip Thrusts', 'Farmer Carries', 'Suitcase Carries',
]);

function isCompoundExercise(exerciseName: string): boolean {
  return COMPOUND_EXERCISE_NAMES.has(exerciseName);
}

const DEFAULT_RULES_CONFIG: RulesConfig = {
  phases: {
    [ProgramPhase.PostSeason]: {
      repRange: [3, 5],  // compound default (used as fallback)
      setRange: [2, 3],
      intensityMultiplier: 0.7,
      miniCycleDuration: 3,
      durationWeeks: 2,
      focus: 'Complete rest, light movement only',
    },
    [ProgramPhase.EarlyOffSeason]: {
      repRange: [8, 10],
      setRange: [3, 4],
      intensityMultiplier: 1.0,
      miniCycleDuration: 4,
      durationWeeks: 4,
      focus: 'Pure hypertrophy, light cardio',
    },
    [ProgramPhase.BaseBuilding]: {
      repRange: [5, 8],
      setRange: [3, 4],
      intensityMultiplier: 1.1,
      miniCycleDuration: 4,
      durationWeeks: 6,
      focus: 'Hypertrophy to strength blend, aerobic base',
    },
    [ProgramPhase.PreSeasonSkills]: {
      repRange: [3, 5],
      setRange: [3, 5],
      intensityMultiplier: 1.2,
      miniCycleDuration: 4,
      durationWeeks: 6,
      focus: 'Heavy strength, 3x5 or 4x4, 2 conditioning',
    },
    [ProgramPhase.ChristmasBlock]: {
      repRange: [3, 5],
      setRange: [3, 5],
      intensityMultiplier: 1.25,
      miniCycleDuration: 4,
      durationWeeks: 6,
      focus: 'THE most important block, 4+ conditioning, 3-5 strength',
    },
    [ProgramPhase.ReturnToSkills]: {
      repRange: [3, 5],
      setRange: [2, 3],
      intensityMultiplier: 1.15,
      miniCycleDuration: 4,
      durationWeeks: 4,
      focus: 'Volume drops, quality work',
    },
    [ProgramPhase.InSeason]: {
      repRange: [3, 5],  // Was [3, 3] — now flexible: sets of 3 is the default but 5 is fine too
      setRange: [2, 3],
      intensityMultiplier: 0.9,
      miniCycleDuration: 3,
      durationWeeks: 26,
      focus: 'Maintenance, 3 gym sessions min, flush-outs, bike sprints, Gun Show Friday',
    },
  },

  splits: {
    3: {
      days: [
        { name: 'Lower Strength', focus: 'Squat + Hinge', defaultType: 'Strength', defaultIntensity: 'Maximal' },
        { name: 'Upper Strength', focus: 'Push + Pull', defaultType: 'Strength', defaultIntensity: 'High' },
        { name: 'Full Body/Conditioning', focus: 'Full Body + Conditioning', defaultType: 'Mixed', defaultIntensity: 'Moderate' },
      ],
      description: '3 days per week - Lower, Upper, Full Body/Conditioning',
    },
    4: {
      days: [
        { name: 'Lower Strength', focus: 'Squat Focus', defaultType: 'Strength', defaultIntensity: 'Maximal' },
        { name: 'Upper Strength', focus: 'Push + Pull Strength', defaultType: 'Strength', defaultIntensity: 'Maximal' },
        { name: 'Lower Hypertrophy/Power', focus: 'Hinge + Power', defaultType: 'Mixed', defaultIntensity: 'High' },
        { name: 'Upper Hypertrophy + Gun Show', focus: 'Hypertrophy + Arms', defaultType: 'Mixed', defaultIntensity: 'High' },
      ],
      description: '4 days per week - Lower Strength, Upper Strength, Lower Hypertrophy/Power, Upper Hypertrophy + Gun Show',
    },
    5: {
      days: [
        { name: 'Lower Strength', focus: 'Squat Focus', defaultType: 'Strength', defaultIntensity: 'Maximal' },
        { name: 'Upper Push', focus: 'Pressing Movements', defaultType: 'Strength', defaultIntensity: 'High' },
        { name: 'Upper Pull', focus: 'Pulling Movements', defaultType: 'Strength', defaultIntensity: 'High' },
        { name: 'Lower Power/Conditioning', focus: 'Hinge + Conditioning', defaultType: 'Mixed', defaultIntensity: 'Moderate' },
        { name: 'Gun Show Friday', focus: 'Arms + Accessories', defaultType: 'Mixed', defaultIntensity: 'Moderate' },
      ],
      description: '5 days per week - Lower Strength, Upper Push, Upper Pull, Lower Power/Conditioning, Gun Show Friday',
    },
  },

  positionPriorities: {
    [Position.Ruck]: [
      'Overhead Press',
      'Bench Press',
      'Pull-ups',
      'Deadlift',
      'Back Squat',
      'Rows',
      'Farmer Carries',
      'Box Squat',
      'Bulgarian Split Squats',
      'RDLs',
      'Dips',
      'Chin-ups',
    ],
    [Position.Forward]: [
      'Back Squat',
      'Bench Press',
      'Deadlift',
      'Bulgarian Split Squats',
      'Box Jumps',
      'Dips',
      'RDLs',
      'Single Leg Work',
      'Farmer Carries',
      'Rows',
      'Overhead Press',
      'Landmine Press',
    ],
    [Position.Midfielder]: [
      'Back Squat',
      'Deadlift',
      'Pull-ups',
      'Bulgarian Split Squats',
      'RDLs',
      'Farmer Carries',
      'Rows',
      'Chin-ups',
      'Overhead Press',
      'Bench Press',
      'Box Squat',
      'Suitcase Carries',
    ],
    [Position.Defender]: [
      'Back Squat',
      'Deadlift',
      'Pull-ups',
      'RDLs',
      'Bulgarian Split Squats',
      'Rows',
      'Farmer Carries',
      'Single Leg Work',
      'Bench Press',
      'Overhead Press',
      'Chin-ups',
      'Box Squat',
    ],
  },

  injuryRestrictions: {
    'ACL_Injury': [
      'Full Back Squat',
      'Deep Lunges',
      'Plyometric Drills',
      'Side to Side Movements',
      'Jump Squats',
    ],
    'Lower_Back_Pain': [
      'Heavy Deadlifts',
      'Hyperextensions',
      'Weighted Sits-ups',
      'Heavy Back Squats',
    ],
    'Shoulder_Impingement': [
      'Overhead Press',
      'Pull-ups',
      'Bench Press',
      'Dumbbell Flyes',
      'Lateral Raises',
    ],
    'Hamstring_Strain': [
      'Nordic Hamstring Curls',
      'Heavy Deadlifts',
      'Explosive Movements',
      'Heavy Sprints',
      'Plyometric Drills',
    ],
  },

  equipmentSubstitutions: {
    'Barbell': ['Dumbbells', 'Kettlebells'],
    'Dumbbells': ['Barbells', 'Kettlebells', 'Resistance Bands'],
    'Bench': ['Floor', 'Swiss Ball', 'Dumbbell'],
    'Rack': ['TRX', 'Rings', 'Resistance Bands'],
  },
};

/**
 * Exercise variation groups for mini-cycle rotation
 * When rotating between mini-cycles, swap within the same movement pattern
 */
const EXERCISE_VARIATION_GROUPS: Record<string, string[]> = {
  'Squat': ['Back Squat', 'Box Squat', 'Bulgarian Split Squats'],
  'Hinge': ['Deadlift', 'RDLs', 'Trap Bar Deadlift'],
  'Push Horizontal': ['Bench Press', 'DB Bench Press', 'Incline Bench', 'Dips'],
  'Push Vertical': ['Overhead Press', 'Landmine Press', 'DB Shoulder Press'],
  'Pull Horizontal': ['Barbell Rows', 'DB Rows', 'Cable Rows'],
  'Pull Vertical': ['Pull-ups', 'Chin-ups', 'Lat Pulldowns'],
  'Carry': ['Farmer Carries', 'Suitcase Carries'],
};

/**
 * Main handler for generate-program edge function
 */
Deno.serve(async (req: Request) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Parse request body
    const body = await parseJsonBody<GenerateProgramRequest>(req);
    const error = validateRequired(body, ['user_id']);
    if (error) {
      return errorResponse(error, 400);
    }

    const { user_id, program_phase } = body;
    const resolvedEquipmentTags = normalizeResolvedEquipmentTags(body.resolvedEquipmentTags);
    log('generate-program', 'Received request', {
      user_id,
      program_phase,
      equipmentSource: resolvedEquipmentTags ? 'resolved_tags' : 'legacy_profile',
      resolvedEquipmentTags: resolvedEquipmentTags ?? [],
    });

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Fetch user profile
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userError || !userProfile) {
      return errorResponse(`User not found: ${user_id}`, 404);
    }

    log('generate-program', 'User profile loaded', { position: userProfile.position });

    // Determine program phase (auto-detect or use provided)
    const phase = program_phase || determineProgramPhase();
    const phaseConfig = DEFAULT_RULES_CONFIG.phases[phase];

    if (!phaseConfig) {
      return errorResponse(`Invalid program phase: ${phase}`, 400);
    }

    // Fetch available exercises
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .eq('active', true);

    if (exercisesError || !exercises || exercises.length === 0) {
      return errorResponse('No exercises available', 500);
    }

    log('generate-program', `Loaded ${exercises.length} exercises`);

    // Create training program
    const programStartDate = new Date();
    const programEndDate = addDays(programStartDate, phaseConfig.durationWeeks * 7);

    const { data: programData, error: programError } = await supabase
      .from('training_programs')
      .insert({
        user_id,
        name: `${phase} Program - ${formatDateShort(programStartDate)}`,
        description: `Mini-cycle programming: ${phaseConfig.focus}`,
        program_phase: phase,
        start_date: programStartDate.toISOString().split('T')[0],
        end_date: programEndDate.toISOString().split('T')[0],
        primary_focus: phaseConfig.focus,
        is_active: true,
      })
      .select('id')
      .single();

    if (programError || !programData) {
      return errorResponse('Failed to create training program', 500);
    }

    const programId = programData.id;
    log('generate-program', 'Created program', { programId });

    // Get training split based on days per week
    const daysPerWeek = userProfile.days_per_week || 3;
    const split = DEFAULT_RULES_CONFIG.splits[daysPerWeek];

    if (!split) {
      return errorResponse(`Invalid days per week: ${daysPerWeek}`, 400);
    }

    // Generate mini-cycles
    const miniCycles = generateMiniCycles(
      programStartDate,
      phaseConfig.durationWeeks,
      phaseConfig.miniCycleDuration
    );

    log('generate-program', `Generated ${miniCycles.length} mini-cycles`, {
      duration: phaseConfig.durationWeeks,
      miniCycleDuration: phaseConfig.miniCycleDuration,
    });

    // Generate microcycles (weeks) and workouts
    let totalWorkoutsCreated = 0;
    const miniCycleExerciseMaps: Record<number, Record<string, string[]>> = {};

    for (const miniCycle of miniCycles) {
      // For each mini-cycle, pre-select exercises that will repeat across all weeks
      const miniCycleExercises = preSelectExercisesForMiniCycle(
        split,
        userProfile,
        exercises,
        phaseConfig,
        DEFAULT_RULES_CONFIG,
        miniCycle.miniCycleNumber,
        resolvedEquipmentTags,
      );
      miniCycleExerciseMaps[miniCycle.miniCycleNumber] = miniCycleExercises;

      // Generate weeks within this mini-cycle
      for (const week of miniCycle.weeks) {
        const { data: microcycleData, error: microcycleError } = await supabase
          .from('microcycles')
          .insert({
            program_id: programId,
            week_number: week.weekNumber,
            mini_cycle_number: miniCycle.miniCycleNumber,
            start_date: week.startDate.toISOString().split('T')[0],
            end_date: week.endDate.toISOString().split('T')[0],
            deload_week: false, // No deloads in Sam's programming
            intensity_multiplier: 1.0,
          })
          .select('id')
          .single();

        if (microcycleError || !microcycleData) {
          throw new Error(`Failed to create microcycle for week ${week.weekNumber}`);
        }

        // Generate workouts for this week
        for (let dayIndex = 0; dayIndex < split.days.length; dayIndex++) {
          const day = split.days[dayIndex];
          const workoutDate = addDays(week.startDate, dayIndex);

          const { data: workoutData, error: workoutError } = await supabase
            .from('workouts')
            .insert({
              microcycle_id: microcycleData.id,
              name: day.name,
              description: `${day.focus} - Week ${week.weekNumber}`,
              duration_minutes: calculateWorkoutDuration(day.focus),
              intensity: day.defaultIntensity,
              workout_type: day.defaultType,
              day_of_week: dayIndex,
            })
            .select('id')
            .single();

          if (workoutError || !workoutData) {
            throw new Error(`Failed to create workout for ${day.name}`);
          }

          // Assign exercises for this workout (same exercises as week 1 of mini-cycle)
          await assignExercisesToWorkout(
            supabase,
            workoutData.id,
            day.focus,
            userProfile,
            miniCycleExercises[day.focus] || [],
            phaseConfig,
            week.weekNumberInMiniCycle
          );

          totalWorkoutsCreated++;
        }
      }
    }

    log('generate-program', `Created ${totalWorkoutsCreated} workouts`);

    const response: GenerateProgramResponse = {
      success: true,
      programId,
      message: `Successfully generated ${phase} program (${miniCycles.length} mini-cycles) with ${totalWorkoutsCreated} workouts`,
    };

    return successResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('generate-program', 'Error', message);
    return errorResponse(`Generation failed: ${message}`, 500, error);
  }
});

/**
 * Helper: Determine program phase based on current month
 */
function determineProgramPhase(): ProgramPhase {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  // Australian AFL Calendar (rough mapping)
  // January-February: Pre-Season-Skills or Christmas-Block (if still in season)
  // March-September: In-Season
  // October: Return-to-Skills
  // November-December: Christmas-Block preparation

  if (month >= 3 && month <= 9) {
    return ProgramPhase.InSeason;
  } else if (month === 10) {
    return ProgramPhase.ReturnToSkills;
  } else if (month === 11 || month === 12) {
    return ProgramPhase.ChristmasBlock;
  } else if (month === 1 || month === 2) {
    return ProgramPhase.PreSeasonSkills;
  }

  return ProgramPhase.BaseBuilding; // Fallback
}

/**
 * Helper: Generate mini-cycles for the program
 * Returns array of mini-cycles with weeks grouped within each
 */
interface MiniCycleWeek {
  weekNumber: number;
  weekNumberInMiniCycle: number;
  startDate: Date;
  endDate: Date;
}

interface MiniCycle {
  miniCycleNumber: number;
  weeks: MiniCycleWeek[];
}

function generateMiniCycles(
  startDate: Date,
  totalWeeks: number,
  miniCycleDuration: 3 | 4
): MiniCycle[] {
  const miniCycles: MiniCycle[] = [];
  let currentDate = new Date(startDate);
  let weekNumber = 1;
  let miniCycleNumber = 1;

  while (weekNumber <= totalWeeks) {
    const weeks: MiniCycleWeek[] = [];
    const weeksInThisMiniCycle = Math.min(miniCycleDuration, totalWeeks - weekNumber + 1);

    for (let i = 0; i < weeksInThisMiniCycle; i++) {
      const weekStartDate = new Date(currentDate);
      const weekEndDate = addDays(currentDate, 6);

      weeks.push({
        weekNumber,
        weekNumberInMiniCycle: i + 1,
        startDate: weekStartDate,
        endDate: weekEndDate,
      });

      currentDate = addDays(currentDate, 7);
      weekNumber++;
    }

    miniCycles.push({
      miniCycleNumber,
      weeks,
    });

    miniCycleNumber++;
  }

  return miniCycles;
}

/**
 * Helper: Pre-select exercises for a mini-cycle
 * These same exercises will be used for all weeks in the mini-cycle
 * Between mini-cycles, rotate exercise variations
 */
function preSelectExercisesForMiniCycle(
  split: any,
  userProfile: DbUserProfile,
  allExercises: any[],
  phaseConfig: any,
  rulesConfig: RulesConfig,
  miniCycleNumber: number,
  resolvedEquipmentTags: readonly CanonicalEquipmentTag[] | null,
): Record<string, string[]> {
  const miniCycleExercises: Record<string, string[]> = {};

  for (const day of split.days) {
    const focus = day.focus;
    const filteredExercises = filterExercisesForWorkout(
      allExercises,
      focus,
      userProfile,
      rulesConfig,
      resolvedEquipmentTags,
    );

    if (filteredExercises.length === 0) {
      console.warn(`No exercises found for workout focus: ${focus}`);
      miniCycleExercises[focus] = [];
      continue;
    }

    // Select 4-6 exercises for this focus area
    const exerciseCount = Math.floor(Math.random() * 3) + 4; // 4-6 exercises
    const selectedExercises = randomSelect(filteredExercises, exerciseCount);

    // Store exercise IDs for this focus
    miniCycleExercises[focus] = selectedExercises.map((ex) => ex.id);
  }

  return miniCycleExercises;
}

/**
 * Helper: Calculate workout duration based on focus area
 */
function calculateWorkoutDuration(focus: string): number {
  const focusMap: Record<string, number> = {
    'Squat Focus': 75,
    'Squat + Hinge': 75,
    'Push + Pull': 75,
    'Push + Pull Strength': 75,
    'Full Body + Conditioning': 60,
    'Hinge + Power': 70,
    'Pressing Movements': 70,
    'Pulling Movements': 70,
    'Hinge + Conditioning': 60,
    'Arms + Accessories': 45,
    'Default': 60,
  };
  return focusMap[focus] || focusMap['Default'];
}

/**
 * Helper: Determine intensity level based on default intensity
 */
function determineIntensity(defaultIntensity: any): IntensityLevel {
  if (typeof defaultIntensity === 'string') {
    return defaultIntensity as IntensityLevel;
  }
  return IntensityLevel.High;
}

/**
 * Helper: Format date in short format
 */
function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Helper: Assign exercises to a workout
 * For mini-cycle programming, same exercises repeat each week within a block
 *
 * CRITICAL: Different rep ranges for compounds vs accessories
 * - Compounds follow phase-specific repRange (e.g. 3-5 in-season)
 * - Accessories ALWAYS get 10-15 reps regardless of phase
 *   (lateral raises, skull crushers, curls should never be sets of 3)
 *
 * Progressive overload: start at min reps, work up to max, then increase weight and back to min
 */
async function assignExercisesToWorkout(
  supabase: any,
  workoutId: string,
  focus: string,
  userProfile: DbUserProfile,
  exerciseIds: string[],
  phaseConfig: any,
  weekNumberInMiniCycle: number
) {
  if (exerciseIds.length === 0) {
    console.warn(`No exercises to assign for workout focus: ${focus}`);
    return;
  }

  const [compoundMinReps, compoundMaxReps] = phaseConfig.repRange;
  const accessoryMinReps = 10;
  const accessoryMaxReps = 15;
  const [minSets, maxSets] = phaseConfig.setRange;

  // First, look up exercise names to determine compound vs accessory
  const { data: exerciseDetails } = await supabase
    .from('exercises')
    .select('id, name')
    .in('id', exerciseIds);

  const exerciseNameMap: Record<string, string> = {};
  if (exerciseDetails) {
    for (const ex of exerciseDetails) {
      exerciseNameMap[ex.id] = ex.name;
    }
  }

  for (let i = 0; i < exerciseIds.length; i++) {
    const exerciseId = exerciseIds[i];
    const exerciseName = exerciseNameMap[exerciseId] || '';
    const isCompound = isCompoundExercise(exerciseName);

    // Use appropriate rep range based on exercise category
    const minReps = isCompound ? compoundMinReps : accessoryMinReps;
    const maxReps = isCompound ? compoundMaxReps : accessoryMaxReps;

    // Within a mini-cycle: progressive overload by reps
    // Week 1: Start at minReps
    // Week 2-3: Progress reps toward maxReps
    const progressedReps = Math.min(
      minReps + (weekNumberInMiniCycle - 1),
      maxReps
    );

    const sets = minSets + Math.floor(Math.random() * (maxSets - minSets + 1));

    const { error } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        exercise_order: i + 1,
        prescribed_sets: sets,
        prescribed_reps_min: progressedReps,
        prescribed_reps_max: Math.min(progressedReps + 2, maxReps),
        // NO prescribed_rpe - Sam doesn't use RPE tracking
        rest_seconds: calculateRestTime(minReps),
      });

    if (error) {
      console.error(`Failed to assign exercise ${exerciseId}:`, error);
    }
  }
}

/**
 * Helper: Filter exercises based on workout focus, user profile, and equipment
 */
function filterExercisesForWorkout(
  exercises: any[],
  focus: string,
  userProfile: DbUserProfile,
  rulesConfig: RulesConfig,
  resolvedEquipmentTags: readonly CanonicalEquipmentTag[] | null,
): any[] {
  let filtered = exercises;

  // Filter by available equipment
  filtered = filtered.filter((ex) => edgeExerciseRequirementsAreAvailable({
    requirements: ex.equipment_required || [],
    resolvedEquipmentTags: resolvedEquipmentTags ?? undefined,
    legacyProfile: userProfile,
  }));

  // Filter out exercises restricted by injuries
  const restrictions = rulesConfig.injuryRestrictions;
  const injuryExercises = new Set<string>();

  for (const injury of userProfile.injury_history || []) {
    if (restrictions[injury]) {
      restrictions[injury].forEach((ex) => injuryExercises.add(ex));
    }
  }

  filtered = filtered.filter((ex) => !injuryExercises.has(ex.name));

  // Filter by experience level
  const expLevel = userProfile.experience_level;
  filtered = filtered.filter((ex) => {
    if (expLevel === ExperienceLevel.Beginner && ex.difficulty_level === 'Expert')
      return false;
    return true;
  });

  // Prioritize position-specific exercises
  const positionPriorities = rulesConfig.positionPriorities[userProfile.position] || [];
  const prioritized = filtered.filter((ex) => positionPriorities.includes(ex.name));

  // Return prioritized exercises, fallback to filtered
  return prioritized.length > 0 ? prioritized : filtered;
}

/**
 * Helper: Calculate rest time based on rep range
 */
function calculateRestTime(minReps: number): number {
  // Heavy strength (1-5 reps): 3-5 minutes
  if (minReps <= 5) return 180;
  // Hypertrophy (6-12 reps): 90-120 seconds
  if (minReps <= 12) return 90;
  // Endurance (13+ reps): 45-60 seconds
  return 45;
}

/**
 * Helper: Random select from array
 */
function randomSelect<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}
