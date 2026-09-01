/**
 * Canonical movement-plane metadata for exercises Sam classified on 2026-09-02.
 *
 * SOURCE OF TRUTH: `docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`, columns
 * `Primary Plane` and `Secondary Plane(s)`. The equality arm in
 * `movementPlaneTests` holds workbook and code in both directions.
 *
 * An absent row is deliberately unanswered. It is not `not_applicable` and no
 * caller may infer a plane from the exercise name, cue, muscles or pool.
 */

export type MovementPlane =
  | 'sagittal'
  | 'frontal'
  | 'transverse'
  | 'multiplanar'
  | 'not_applicable';

export interface ExerciseMovementPlaneMetadata {
  readonly exercise: string;
  readonly primaryPlane: MovementPlane;
  readonly secondaryPlanes: readonly MovementPlane[];
}

const rows: ExerciseMovementPlaneMetadata[] = [];

function add(
  exercises: readonly string[],
  primaryPlane: MovementPlane,
  secondaryPlanes: readonly MovementPlane[] = [],
): void {
  if ((primaryPlane === 'multiplanar' || primaryPlane === 'not_applicable')
    && secondaryPlanes.length > 0) {
    throw new Error(`${primaryPlane} cannot carry secondary movement planes`);
  }
  if (secondaryPlanes.includes(primaryPlane)
    || new Set(secondaryPlanes).size !== secondaryPlanes.length) {
    throw new Error(`Invalid secondary movement planes for ${exercises.join(', ')}`);
  }
  for (const exercise of exercises) {
    if (rows.some((row) => row.exercise === exercise)) {
      throw new Error(`Duplicate movement-plane metadata: ${exercise}`);
    }
    rows.push({ exercise, primaryPlane, secondaryPlanes: [...secondaryPlanes] });
  }
}

add(['Back Squat', 'Front Squat', 'Box Squat', 'High Box Squat', 'Single-Leg Leg Press',
  'Goblet Squat', 'Leg Press', 'Bodyweight Squat'], 'sagittal');
add(['Walking Lunges', 'Bulgarian Split Squats', 'Reverse Lunges', 'Step Ups'],
  'sagittal', ['frontal']);
add(['Single-Leg Squat (to Box)'], 'sagittal', ['frontal', 'transverse']);
add(['Deadlift', 'Trap Bar Deadlift', 'RDLs', 'Hip Thrusts', 'Kettlebell Swings',
  'Glute Bridge'], 'sagittal');
add(['Single-Leg RDL'], 'sagittal', ['frontal', 'transverse']);
add(['Bench Press', 'DB Bench Press', 'Single-Arm DB Bench Press',
  'Single-Arm DB Floor Press'], 'transverse');
add(['Incline Bench', 'Close Grip Bench', 'Incline DB Bench', 'Push-ups', 'Incline Push-Up'],
  'transverse', ['sagittal']);
add(['Dips'], 'sagittal');
add(['Overhead Press', 'DB Shoulder Press', 'Seated DB Press', 'Z-Press'],
  'frontal', ['sagittal']);
add(['Landmine Press'], 'sagittal', ['frontal']);
add(['Half-Kneeling Single-Arm Overhead Press'], 'frontal', ['transverse']);
add(['Barbell Row', 'Chest Supported Row', 'Single-Arm DB Row', 'Seated Cable Row',
  'Chest-Supported DB Row', 'Inverted Row (Bodyweight)'], 'transverse', ['sagittal']);
add(['Pull-Ups', 'Band-Assisted Pull-Up', 'Lat Pulldown'], 'frontal', ['sagittal']);
add(['Chin-Ups', 'Neutral-Grip Pulldown', 'Single-Arm Lat Pulldown'],
  'sagittal', ['frontal']);
add(['Chin-Up Negative (Slow)'], 'sagittal', ['frontal']);
add(['Cossack Squat', 'Lateral Lunge'], 'frontal', ['sagittal']);
add(['Skull Crushers', 'Bicep Curl (Barbell)', 'Bicep Curl (Dumbbell)', 'Hammer Curl',
  'Incline Dumbbell Curl', 'Lying Dumbbell Curl', 'Banded Bicep Curl',
  'Concentration Curl', 'Tricep Pushdown', 'Banded Tricep Pushdown',
  'Overhead Tricep Extension', 'Dumbbell Skull Crusher', 'Dumbbell Kickback',
  'Tricep Circuit (Dirty 30)'], 'sagittal');
add(['Shrugs', 'Lateral Raise', 'Single-Arm Shrug'], 'frontal');
add(['Incline Y Raise'], 'frontal', ['sagittal']);
add(['Rear Delt Fly', 'Band Pull-Apart'], 'transverse');
add(['Face Pull', 'Cable Face Pull'], 'transverse', ['frontal']);
add(['Banded 90/90 External Rotation'], 'transverse');
add(['Nordic Lower', 'Hamstring Curl', 'Leg Extension', 'Calf Raises', 'Tib Raises',
  'T-Bar Tib Raises', 'Back Extension', 'Seated Calf Raise'], 'sagittal');
add(['SL 45° Back Extension', 'Single-Leg Hip Thrust'],
  'sagittal', ['frontal', 'transverse']);
add(['Single-Leg Calf Raise'], 'sagittal', ['frontal']);
add(['Groin Squeeze'], 'frontal');
add(['Copenhagen Plank (Half)', 'Long-Lever Copenhagen'], 'frontal', ['transverse']);
add(['Box Jumps', 'Broad Jumps', 'Jump Squats'], 'sagittal');
add(['Depth Jumps', 'RFE Split Squat Jump'], 'sagittal', ['frontal', 'transverse']);
add(['Lateral Bounds'], 'frontal', ['transverse']);
add(['Farmer Carry', 'Overhead Carry'], 'sagittal', ['frontal', 'transverse']);
add(['Bear Carry'], 'sagittal', ['transverse']);
add(['Suitcase Carry'], 'sagittal', ['frontal']);
add(['Reverse Nordic Curl', 'Standing Knee Extension', 'Seated Single-Leg Pike Lift',
  'Banded TKE', 'Spanish Squat Hold', 'Swiss Ball Hamstring Curl'], 'sagittal');
add(['Bosch Hold', 'SL 45° Back Extension Hold'], 'sagittal', ['frontal', 'transverse']);
add(['Slant Board Step-Down'], 'sagittal', ['frontal']);
add(['Crab Walks'], 'frontal', ['transverse']);
add(['Dead Bug', 'Banded Dead Bug', 'Weighted Dead Bug', 'McGill Sit Up', 'Ab Wheel',
  'Hanging Leg Raise', 'Plank', 'Hollow Hold', 'Dragon Flag'], 'sagittal');
add(['Bird Dog'], 'sagittal', ['transverse']);
add(['Side Plank', 'Side Plank Row'], 'frontal', ['transverse']);
add(['Band Pallof Press'], 'transverse');
add(['Woodchop (Standing)', 'Woodchop (Half Kneeling)'], 'transverse', ['sagittal']);
add(['Stir the Pot'], 'multiplanar');

export const EXERCISE_MOVEMENT_PLANES: readonly ExerciseMovementPlaneMetadata[] = rows;

const BY_EXERCISE = new Map(rows.map((row) => [row.exercise, row]));

/** Exact canonical lookup. Unknown and unanswered identities return undefined. */
export function movementPlaneMetadataFor(
  exercise: string,
): ExerciseMovementPlaneMetadata | undefined {
  return BY_EXERCISE.get(exercise);
}
