/**
 * Supabase Edge Function: sync-exercises
 *
 * Syncs exercises from ExerciseDB API to local database
 * Can be called periodically via cron job or manually via API
 *
 * POST /sync-exercises
 * Body: {
 *   limit?: number (default 100),
 *   offset?: number (default 0)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   syncedCount?: number,
 *   message?: string,
 *   error?: string
 * }
 */

import {
  createSupabaseClient,
  errorResponse,
  successResponse,
  parseJsonBody,
  log,
  withRetry,
  chunk,
} from '../shared/utils.ts';

import {
  type SyncExercisesRequest,
  type SyncExercisesResponse,
  ExerciseType,
  DifficultyLevel,
} from '../shared/types.ts';

/**
 * Mapping from ExerciseDB equipment to our standard equipment types
 */
const EQUIPMENT_MAPPING: Record<string, string[]> = {
  barbell: ['Barbell'],
  dumbbell: ['Dumbbells'],
  kettlebell: ['Kettlebells'],
  cable: ['Cable Machine'],
  machine: ['Machine'],
  'body weight': ['None'],
  resistance_band: ['Resistance Bands'],
  medicine_ball: ['Medicine Ball'],
  'exercise ball': ['Swiss Ball'],
  'pull-up bar': ['Pull-up Bar'],
  'plyometric box': ['Plyometric Box'],
};

/**
 * Mapping from ExerciseDB target to our muscle groups
 */
const MUSCLE_GROUP_MAPPING: Record<string, string[]> = {
  chest: ['Chest'],
  back: ['Back', 'Lats'],
  biceps: ['Biceps'],
  triceps: ['Triceps'],
  forearms: ['Forearms'],
  shoulders: ['Shoulders', 'Deltoids'],
  neck: ['Neck'],
  traps: ['Trapezius'],
  quads: ['Quadriceps'],
  hamstrings: ['Hamstrings'],
  calves: ['Calves'],
  glutes: ['Glutes'],
  adductors: ['Adductors'],
  abductors: ['Abductors'],
  abs: ['Abs', 'Core'],
  obliques: ['Obliques'],
  forearm_flexors: ['Forearm Flexors'],
};

/**
 * Default AFL-relevant exercises we want to prioritize
 */
const AFL_PRIORITY_EXERCISES = [
  'Barbell Back Squat',
  'Barbell Deadlift',
  'Bench Press',
  'Barbell Rows',
  'Pull-ups',
  'Overhead Press',
  'Dumbbell Rows',
  'Bulgarian Split Squat',
  'Power Clean',
  'Box Jump',
  'Lateral Bounds',
  'Single Leg Squat',
  'Nordic Hamstring Curl',
  'TRX Suspension',
];

/**
 * Main handler for sync-exercises edge function
 */
Deno.serve(async (req: Request) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Parse optional request body
    let limit = 100;
    let offset = 0;

    try {
      const body = await parseJsonBody<SyncExercisesRequest>(req);
      if (body.limit) limit = Math.min(body.limit, 500); // Max 500 per call
      if (body.offset) offset = body.offset;
    } catch {
      // No body is fine for sync
    }

    log('sync-exercises', 'Starting sync', { limit, offset });

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Fetch exercises from ExerciseDB API
    const exercises = await fetchExercisesFromExerciseDB(limit, offset);
    log('sync-exercises', `Fetched ${exercises.length} exercises from ExerciseDB`);

    // Transform exercises to our schema
    const transformedExercises = exercises.map((ex) => transformExercise(ex));

    // Batch insert/upsert exercises
    const batchSize = 50;
    const batches = chunk(transformedExercises, batchSize);
    let syncedCount = 0;

    for (const batch of batches) {
      const { error } = await supabase
        .from('exercises')
        .upsert(batch, { onConflict: 'external_id' });

      if (error) {
        console.error('Batch upsert error:', error);
        // Continue with next batch even if one fails
      } else {
        syncedCount += batch.length;
      }
    }

    log('sync-exercises', 'Sync completed', { syncedCount });

    const response: SyncExercisesResponse = {
      success: true,
      syncedCount,
      message: `Successfully synced ${syncedCount} exercises`,
    };

    return successResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('sync-exercises', 'Error', message);
    return errorResponse(`Sync failed: ${message}`, 500, error);
  }
});

/**
 * Helper: Fetch exercises from ExerciseDB API
 */
async function fetchExercisesFromExerciseDB(
  limit: number,
  offset: number
): Promise<any[]> {
  // ExerciseDB API endpoint - free tier available
  const url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}&offset=${offset}`;

  const apiKey = Deno.env.get('EXERCISEDB_API_KEY');
  if (!apiKey) {
    console.warn('EXERCISEDB_API_KEY not configured, will use sample data');
    return generateSampleExercises();
  }

  return withRetry(async () => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }

    return await response.json();
  });
}

/**
 * Helper: Transform ExerciseDB format to our database schema
 */
function transformExercise(exerciseDB: any): any {
  const name = exerciseDB.name || '';
  const target = exerciseDB.target || '';
  const equipment = exerciseDB.equipment || '';

  // Determine exercise type
  let exerciseType = ExerciseType.Isolation;
  const compounds = ['squat', 'deadlift', 'bench press', 'row', 'pull', 'clean', 'snatch'];
  const plyo = ['jump', 'bound', 'explosive', 'plyometric'];
  const cardio = ['run', 'cycle', 'row', 'sprint', 'conditioning'];

  const nameLower = name.toLowerCase();
  if (compounds.some((c) => nameLower.includes(c))) {
    exerciseType = ExerciseType.Compound;
  } else if (plyo.some((p) => nameLower.includes(p))) {
    exerciseType = ExerciseType.Plyometric;
  } else if (cardio.some((c) => nameLower.includes(c))) {
    exerciseType = ExerciseType.Cardio;
  }

  // Determine difficulty level based on exercise characteristics
  let difficulty = DifficultyLevel.Intermediate;
  const easyMovements = ['leg press', 'chest press', 'lat pulldown', 'leg curl'];
  const hardMovements = ['pistol squat', 'one-arm', 'single leg', 'handstand'];

  if (easyMovements.some((m) => nameLower.includes(m))) {
    difficulty = DifficultyLevel.Beginner;
  } else if (hardMovements.some((m) => nameLower.includes(m))) {
    difficulty = DifficultyLevel.Advanced;
  }

  // Map equipment
  const equipmentArray = EQUIPMENT_MAPPING[equipment.toLowerCase()] || [equipment];

  // Map target muscle groups
  const muscleGroups = MUSCLE_GROUP_MAPPING[target.toLowerCase()] || [target];

  return {
    external_id: exerciseDB.id || `${name}_${target}`,
    name: name.charAt(0).toUpperCase() + name.slice(1), // Proper case
    description: `${name} - Target: ${target}, Equipment: ${equipment}`,
    muscle_groups: muscleGroups,
    exercise_type: exerciseType,
    equipment_required: equipmentArray,
    difficulty_level: difficulty,
    video_url: exerciseDB.gifUrl || null,
    form_notes: generateFormNotes(name, target),
    active: true,
  };
}

/**
 * Helper: Generate form notes based on exercise
 */
function generateFormNotes(name: string, target: string): string {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('squat')) {
    return 'Keep chest up, weight in heels, depth to parallel. Knees track over toes.';
  }
  if (nameLower.includes('deadlift')) {
    return 'Flat back, shoulders over bar. Drive through heels. Keep bar close to body.';
  }
  if (nameLower.includes('bench press')) {
    return 'Scapula retracted, feet planted. Lower to chest, press through heels.';
  }
  if (nameLower.includes('row')) {
    return 'Retract scapula, drive elbows back. Squeeze at top, control descent.';
  }
  if (nameLower.includes('pull')) {
    return 'Full range of motion from dead hang. Chest to bar when possible. Control eccentric.';
  }
  if (nameLower.includes('press')) {
    return 'Core braced, glutes squeezed. Full lockout at top. Avoid excessive back arch.';
  }

  return 'Maintain control throughout movement. Full range of motion. Smooth tempo.';
}

/**
 * Helper: Generate sample exercises for when API not available
 * Contains AFL-relevant strength and conditioning exercises
 */
function generateSampleExercises(): any[] {
  return [
    {
      id: 'barbell-back-squat',
      name: 'Barbell Back Squat',
      target: 'quads',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'barbell-deadlift',
      name: 'Barbell Deadlift',
      target: 'hamstrings',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'bench-press',
      name: 'Bench Press',
      target: 'chest',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'barbell-row',
      name: 'Barbell Rows',
      target: 'back',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'pull-ups',
      name: 'Pull-ups',
      target: 'back',
      equipment: 'pull-up bar',
      gifUrl: null,
    },
    {
      id: 'overhead-press',
      name: 'Overhead Press',
      target: 'shoulders',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'dumbbell-rows',
      name: 'Dumbbell Rows',
      target: 'back',
      equipment: 'dumbbell',
      gifUrl: null,
    },
    {
      id: 'bulgarian-split-squat',
      name: 'Bulgarian Split Squat',
      target: 'quads',
      equipment: 'dumbbell',
      gifUrl: null,
    },
    {
      id: 'power-clean',
      name: 'Power Clean',
      target: 'hamstrings',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'box-jump',
      name: 'Box Jump',
      target: 'glutes',
      equipment: 'plyometric box',
      gifUrl: null,
    },
    {
      id: 'lateral-bounds',
      name: 'Lateral Bounds',
      target: 'glutes',
      equipment: 'body weight',
      gifUrl: null,
    },
    {
      id: 'single-leg-squat',
      name: 'Single Leg Squat',
      target: 'quads',
      equipment: 'body weight',
      gifUrl: null,
    },
    {
      id: 'nordic-hamstring-curl',
      name: 'Nordic Hamstring Curl',
      target: 'hamstrings',
      equipment: 'body weight',
      gifUrl: null,
    },
    {
      id: 'trx-suspension',
      name: 'TRX Suspension Rows',
      target: 'back',
      equipment: 'cable',
      gifUrl: null,
    },
    {
      id: 'dumbbell-bench-press',
      name: 'Dumbbell Bench Press',
      target: 'chest',
      equipment: 'dumbbell',
      gifUrl: null,
    },
    {
      id: 'incline-bench-press',
      name: 'Incline Bench Press',
      target: 'chest',
      equipment: 'barbell',
      gifUrl: null,
    },
    {
      id: 'leg-press',
      name: 'Leg Press',
      target: 'quads',
      equipment: 'machine',
      gifUrl: null,
    },
    {
      id: 'leg-curl',
      name: 'Leg Curl',
      target: 'hamstrings',
      equipment: 'machine',
      gifUrl: null,
    },
    {
      id: 'seated-row',
      name: 'Seated Row',
      target: 'back',
      equipment: 'machine',
      gifUrl: null,
    },
    {
      id: 'cable-woodchop',
      name: 'Cable Woodchop',
      target: 'obliques',
      equipment: 'cable',
      gifUrl: null,
    },
    {
      id: 'lat-pulldown',
      name: 'Lat Pulldown',
      target: 'back',
      equipment: 'cable',
      gifUrl: null,
    },
    {
      id: 'cable-fly',
      name: 'Cable Fly',
      target: 'chest',
      equipment: 'cable',
      gifUrl: null,
    },
    {
      id: 'lateral-raise',
      name: 'Lateral Raise',
      target: 'shoulders',
      equipment: 'dumbbell',
      gifUrl: null,
    },
    {
      id: 'cable-bicep-curl',
      name: 'Cable Bicep Curl',
      target: 'biceps',
      equipment: 'cable',
      gifUrl: null,
    },
    {
      id: 'tricep-pushdown',
      name: 'Tricep Pushdown',
      target: 'triceps',
      equipment: 'cable',
      gifUrl: null,
    },
  ];
}
