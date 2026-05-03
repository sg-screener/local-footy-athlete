/**
 * Exercise Pools — Categorised exercise catalog for derived sessions.
 *
 * Each pool exercise has:
 *   - identity (id, name, notes)
 *   - prescription defaults (sets, reps, rest)
 *   - constraint tags (equipment, contraindications, fatigue level)
 *
 * The sessionBuilder selects from these pools based on the athlete's
 * profile, injuries, and equipment access. This replaces the hardcoded
 * exercise lists that were previously baked into sessionResolver.ts.
 *
 * ADDING EXERCISES:
 *   Just append to the relevant category array. The builder will
 *   automatically include them in rotation.
 */

// ─── Types ───

export type FatigueLevel = 'low' | 'moderate' | 'high';

export type EquipmentTag =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'cables'
  | 'bands'
  | 'bench'
  | 'foam_roller'
  | 'bike_or_treadmill'
  | 'pullup_bar'
  | 'kettlebell'
  | 'machine';

export type InjuryTag =
  | 'shoulder'
  | 'knee'
  | 'ankle'
  | 'lower_back'
  | 'hip'
  | 'groin'
  | 'hamstring'
  | 'wrist'
  | 'elbow'
  | 'quad'
  | 'calf'
  | 'neck';

export type ExerciseCategory =
  // Arms / Pump
  | 'biceps'
  | 'triceps'
  | 'delts'
  | 'upper_back_pump'
  // Prehab & Accessories
  | 'groin_adductors'
  | 'calves'
  | 'lower_prehab'
  | 'trunk_anti_rotation'
  | 'shoulder_health'
  | 'hamstring_light'
  // Recovery
  | 'tissue_quality'
  | 'mobility'
  | 'easy_cardio'
  | 'breathing_reset';

export interface PoolExercise {
  id: string;
  name: string;
  notes: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  /** How to interpret repsMin/repsMax: 'reps' (default), 'duration' (seconds), 'duration_minutes' (minutes), 'distance' (metres). */
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
  /** True if prescription is per side (e.g. "30s per side"). */
  perSide?: boolean;
  /** Equipment needed. Empty = bodyweight only. */
  equipment: EquipmentTag[];
  /** Injury areas that make this exercise unsafe. */
  contraindications: InjuryTag[];
  /** Fatigue cost. Derived sessions should stay low/moderate. */
  fatigue: FatigueLevel;
}

// ─── Helper to define exercises concisely ───

interface ExOptions {
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
  perSide?: boolean;
}

function ex(
  id: string,
  name: string,
  sets: number,
  repsMin: number,
  repsMax: number,
  restSeconds: number,
  notes: string,
  equipment: EquipmentTag[] = [],
  contraindications: InjuryTag[] = [],
  fatigue: FatigueLevel = 'low',
  opts?: ExOptions,
): PoolExercise {
  return {
    id, name, notes, sets, repsMin, repsMax, restSeconds, equipment, contraindications, fatigue,
    ...(opts?.prescriptionType ? { prescriptionType: opts.prescriptionType } : {}),
    ...(opts?.perSide ? { perSide: opts.perSide } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════
// ARMS / PUMP pools
// ═══════════════════════════════════════════════════════════════

export const BICEPS_POOL: PoolExercise[] = [
  ex('hammer-curl',       'Hammer Curl',                2, 10, 12, 45, 'Neutral grip. Works the forearms too.',       ['dumbbells'], ['elbow', 'wrist']),
  ex('incline-db-curl',   'Incline Dumbbell Curl',      3, 10, 12, 45, '30° incline. Big stretch at the bottom.',     ['dumbbells', 'bench'], ['shoulder', 'elbow']),
  ex('band-curl',         'Banded Bicep Curl',          3, 15, 20, 30, 'Peak tension at top. Good pump finisher.',    ['bands'],     ['elbow']),
  ex('concentration-curl','Concentration Curl',         2, 12, 15, 30, 'Seated, elbow on inner thigh. Slow negatives.', ['dumbbells'], ['elbow']),
  ex('bw-chin-curl',      'Chin-Up Negative (Slow)',    2, 4,  6,  60, '5-second lowering phase. Biceps and back.',   ['pullup_bar'],['shoulder', 'elbow']),
];

export const TRICEPS_POOL: PoolExercise[] = [
  ex('tricep-pushdown',   'Tricep Pushdown',            3, 12, 15, 45, 'Full lockout at the bottom. Keep elbows pinned.', ['cables'], ['elbow', 'wrist']),
  ex('overhead-ext',      'Overhead Tricep Extension',  2, 10, 12, 45, 'Cable or dumbbell. Full stretch at bottom.',  ['cables'],    ['shoulder', 'elbow']),
  ex('kickback',          'Dumbbell Kickback',          2, 12, 15, 30, 'Hinge forward, lock elbow. Squeeze at top.',  ['dumbbells'], ['elbow']),
  ex('band-pushdown',     'Banded Tricep Pushdown',     3, 15, 20, 30, 'Anchor band overhead. Constant tension.',     ['bands'],     ['elbow']),
  ex('skull-crusher-db',  'Dumbbell Skull Crusher',     3, 10, 12, 45, 'Lying on bench. Lower toward temples, press up.', ['dumbbells', 'bench'], ['elbow', 'shoulder']),
];

export const DELTS_POOL: PoolExercise[] = [
  ex('lateral-raise',     'Lateral Raise',              3, 12, 15, 45, 'Light weight, strict form. No momentum.',     ['dumbbells'], ['shoulder']),
  ex('cable-face-pull',   'Cable Face Pull',            3, 15, 20, 30, 'Pull to forehead, open hands out at the top.', ['cables'],    []),
  ex('seated-db-press',   'Seated DB Press',            3, 8,  12, 45, 'Seated, back supported. Press to lockout.',   ['dumbbells', 'bench'], ['shoulder']),
  ex('rear-delt-fly',     'Rear Delt Fly',              3, 12, 15, 30, 'Bent over or machine. Pinch shoulder blades.',['dumbbells'], ['shoulder', 'lower_back']),
  ex('shrugs',            'Shrugs',                     3, 10, 12, 45, 'Straight up, pause at the top. No rolling.',  ['dumbbells'], ['wrist', 'lower_back']),
  ex('single-arm-shrug',  'Single-Arm Shrug',           3, 10, 12, 45, 'One side at a time. Full range, slight pause at top.', ['dumbbells'], ['wrist', 'lower_back']),
];

export const UPPER_BACK_PUMP_POOL: PoolExercise[] = [
  ex('band-pull-apart',   'Band Pull-Apart',            3, 15, 20, 20, 'Squeeze shoulder blades together. Good for posture.', ['bands'],     []),
  ex('face-pull',         'Face Pull',                  3, 15, 20, 30, 'Pull high, open hands out. Great for posture.',['cables'],    []),
  ex('chest-supported-row','Chest-Supported DB Row',     3, 10, 12, 45, 'Light weight. Squeeze shoulder blades back.', ['dumbbells', 'bench'], ['lower_back']),
  ex('bw-inv-row',        'Inverted Row (Bodyweight)',   3, 8,  12, 45, 'Underhand or overhand. Scale with angle.',    ['pullup_bar'],['shoulder']),
  ex('incline-y-raise',   'Incline Y Raise',            3, 10, 12, 30, 'Face-down on incline bench. Thumbs up, arms out.', ['dumbbells', 'bench'], ['shoulder']),
];

// ═══════════════════════════════════════════════════════════════
// PREHAB & ACCESSORIES pools
// ═══════════════════════════════════════════════════════════════

export const GROIN_ADDUCTORS_POOL: PoolExercise[] = [
  ex('copenhagen-plank',  'Copenhagen Plank',           3, 20, 30, 45, 'Builds inner thigh strength.',                ['bodyweight'],['groin', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('groin-squeeze',     'Groin Squeeze (Band Adductor)', 3, 10, 12, 30, 'Squeeze band between knees and hold.',     ['bands'],    ['groin'],          'low', { prescriptionType: 'reps' }),
];

/**
 * CALVES — general calf work. Appropriate in mixed prehab sessions
 * regardless of upper/lower focus. Low systemic cost.
 */
export const CALVES_POOL: PoolExercise[] = [
  ex('calf-raise',        'Single-Leg Calf Raise',      3, 12, 15, 30, '3-second lowering.',                          ['bodyweight'],[],        'low', { prescriptionType: 'reps', perSide: true }),
  ex('seated-calf',       'Seated Calf Raise',          3, 15, 20, 30, 'Bent knee, slow tempo. Targets deep calf.',   ['machine'],   [],        'low', { prescriptionType: 'reps' }),
];

/**
 * LOWER PREHAB — ankle / shin / tibialis work.
 *
 * Context-specific: only eligible in lower-body or recovery/prehab sessions.
 * NOT a neutral filler. These exercises exist to support ankle and shin
 * health and should only appear when the session intent includes lower-body
 * or explicit prehab goals.
 *
 * Session eligibility:
 *   ✓ Lower strength/hypertrophy (as accessory)
 *   ✓ Extended recovery (low-load prehab)
 *   ✗ Upper sessions
 *   ✗ Arms / pump
 *   ✗ Generic prehab_accessories (use calves instead)
 */
export const LOWER_PREHAB_POOL: PoolExercise[] = [
  ex('tib-raise',         'Tibialis Raise',             2, 15, 20, 30, 'Front of shins. Helps prevent shin splints.', ['bodyweight'],['ankle'], 'low', { prescriptionType: 'reps' }),
];

export const TRUNK_ANTI_ROTATION_POOL: PoolExercise[] = [
  ex('band-pallof',       'Band Pallof Press',          3, 10, 12, 45, 'Band at chest height. Press out and hold.',   ['bands'],     [],                     'low', { prescriptionType: 'reps' }),
  ex('dead-bug',          'Dead Bug',                   3, 8,  10, 30, 'Opposite arm and leg. Keep core tight.',      ['bodyweight'],[],                     'low', { prescriptionType: 'reps', perSide: true }),
  ex('banded-dead-bug',   'Banded Dead Bug',            3, 8,  10, 30, 'Band around feet adds anti-extension challenge.', ['bands'], [],                    'low', { prescriptionType: 'reps', perSide: true }),
  ex('weighted-dead-bug', 'Weighted Dead Bug',          3, 6,  8,  45, 'Hold dumbbells overhead. Slow and controlled.', ['dumbbells'], [],                  'low', { prescriptionType: 'reps', perSide: true }),
  ex('mcgill-situp',      'McGill Sit Up',              3, 8,  10, 30, 'One knee bent, hands under low back. Lift shoulder blades only.', ['bodyweight'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('ab-wheel',          'Ab Wheel',                   3, 6,  10, 60, 'Roll out, brace hard, no low-back sag.',      ['bodyweight'],['lower_back', 'shoulder'], 'moderate', { prescriptionType: 'reps' }),
  ex('hanging-leg-raise', 'Hanging Leg Raise',          3, 6,  10, 60, 'Dead hang from bar. No swing.',               ['pullup_bar'],['shoulder'],            'moderate', { prescriptionType: 'reps' }),
  ex('bird-dog',          'Bird Dog',                   2, 8,  10, 30, 'Slow and controlled.',                        ['bodyweight'],['lower_back'],         'low', { prescriptionType: 'reps', perSide: true }),
  ex('side-plank',        'Side Plank',                 2, 30, 45, 30, 'Stack hips. Breathe.',                        ['bodyweight'],['shoulder'],            'low', { prescriptionType: 'duration', perSide: true }),
  ex('woodchop-standing', 'Woodchop (Standing)',        2, 10, 12, 45, 'Cable or band, high to low. Rotate from torso.', ['cables', 'bands'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('woodchop-hk',       'Woodchop (Half Kneeling)',   2, 10, 12, 45, 'Half-kneeling. Controlled rotation. Light weight.', ['cables', 'bands'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('suitcase-carry',    'Suitcase Carry',             2, 30, 40, 45, 'Stay tall, don\'t lean.',                     ['dumbbells'], ['lower_back', 'wrist'],'low', { prescriptionType: 'distance', perSide: true }),
];

export const SHOULDER_HEALTH_POOL: PoolExercise[] = [
  ex('band-pull-apart-sh','Band Pull-Apart',            3, 15, 20, 20, 'Squeeze shoulder blades together at the top.', ['bands'],     [],          'low', { prescriptionType: 'reps' }),
  ex('band-ext-rot',      'Banded External Rotation',   2, 15, 20, 20, 'Elbow at 90°. Rotate out against band.',     ['bands'],     ['shoulder'],'low', { prescriptionType: 'reps' }),
];

export const HAMSTRING_LIGHT_POOL: PoolExercise[] = [
  ex('swiss-ball-curl',   'Swiss Ball Hamstring Curl',  2, 10, 12, 45, 'Hips up. Roll ball in and out.',              ['bodyweight'],['hamstring', 'lower_back'], 'low', { prescriptionType: 'reps' }),
];

// ═══════════════════════════════════════════════════════════════
// RECOVERY pools
// ═══════════════════════════════════════════════════════════════

export const TISSUE_QUALITY_POOL: PoolExercise[] = [
  ex('foam-roll-lower',   'Foam Roll — Hip Flexor, Quad, Adductors', 1, 90, 120, 0, 'Spend extra time on tender spots.',                ['foam_roller'], [], 'low', { prescriptionType: 'duration' }),
  ex('foam-roll-upper',   'Foam Roll — T-Spine',                   1, 60, 90,  0, 'Roll slowly, breathe into tight spots.',              ['foam_roller'], [], 'low', { prescriptionType: 'duration' }),
  ex('foam-roll-itband',  'Foam Roll — IT Band',                   1, 45, 60,  0, 'Side-lying. Slow passes from hip to knee.',           ['foam_roller'], [], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('foam-roll-lats',    'Foam Roll — Lats',                      1, 45, 60,  0, 'Side-lying, arm overhead. Roll under the armpit.',    ['foam_roller'], [], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('foam-roll-calves',  'Foam Roll — Calves & Outer Shins',      1, 60, 60,  0, 'Cross legs for more pressure.',                       ['foam_roller'], [], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('lacrosse-glute',    'Lacrosse Ball Glute Release',            1, 60, 90,  0, 'Sit on ball, find trigger points.',                   ['bodyweight'], [],  'low', { prescriptionType: 'duration', perSide: true }),
];

export const MOBILITY_POOL: PoolExercise[] = [
  ex('hip-90-90',         'Hip 90/90 Stretch',           2, 30, 45, 30, 'Breathe into the stretch.',                    ['bodyweight'], ['hip', 'knee'],  'low', { prescriptionType: 'duration', perSide: true }),
  ex('cat-cow',           'Cat-Cow',                     2, 10, 12, 15, 'Slow and controlled. Match movement to breath.', ['bodyweight'], [],             'low', { prescriptionType: 'reps' }),
  ex('worlds-greatest',   "World's Greatest Stretch",    2, 5,  5,  15, 'Hold each position 3 seconds.',                ['bodyweight'], [],              'low', { prescriptionType: 'reps', perSide: true }),
  ex('deep-squat-hold',   'Deep Squat Hold',             2, 30, 45, 20, 'Chest up, heels down. Breathe.',               ['bodyweight'], ['knee', 'ankle'],'low', { prescriptionType: 'duration' }),
  ex('couch-stretch',     'Couch Stretch',                2, 30, 45, 15, 'Rear foot elevated. Big stretch through the hip flexor and quad.', ['bodyweight'], ['knee', 'hip'], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('thoracic-rotation', 'Open Book Thoracic Rotation', 2, 8,  10, 15, 'Side-lying. Follow hand with eyes.',            ['bodyweight'], [],              'low', { prescriptionType: 'reps', perSide: true }),
  ex('pigeon-stretch',    'Pigeon Stretch',              2, 30, 45, 15, 'Deep hip external rotation.',                   ['bodyweight'], ['hip', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('adductor-rock',     'Adductor Rockback',           2, 10, 12, 15, 'Wide knees, rock back. Groin opener.',          ['bodyweight'], ['groin'],       'low', { prescriptionType: 'reps' }),
  ex('pec-doorway',       'Chest / Pec Stretch (Doorway)', 2, 30, 45, 15, 'Forearm on doorframe. Step through gently.', ['bodyweight'], ['shoulder'],     'low', { prescriptionType: 'duration', perSide: true }),
  ex('lat-stretch',       'Lat Stretch',                  2, 30, 45, 15, 'Hold a rack or doorframe. Hips back, sink under.', ['bodyweight'], ['shoulder'], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('dead-hang',         'Dead Hang',                    2, 20, 30, 30, 'Passive hang from a bar. Decompresses spine and shoulders.', ['pullup_bar'], ['shoulder', 'elbow'], 'low', { prescriptionType: 'duration' }),
  ex('toe-stretch',       'Toe Stretch',                  2, 30, 45, 15, 'Toes tucked, sit back onto heels. Builds foot resilience.', ['bodyweight'], ['ankle'], 'low', { prescriptionType: 'duration' }),
  ex('calf-stretch',      'Calf Stretch',                 2, 30, 45, 15, 'Wall or step. Straight-leg then bent-knee variation.', ['bodyweight'], ['ankle', 'calf'], 'low', { prescriptionType: 'duration', perSide: true }),
];

/**
 * Easy Cyclical / Cardio — Zone 1, conversational pace ONLY.
 *
 * Rules:
 *   - No fatigue accumulation. If the athlete finishes feeling more tired, it was too hard.
 *   - No intervals, surges, tempo changes, or intensity work of any kind.
 *   - Heart rate should stay low enough to hold a full conversation.
 *   - Used in Active Recovery and Extended Recovery sessions, and on G+1.
 *   - This is NOT conditioning. It is a recovery modality.
 */
export const EASY_CARDIO_POOL: PoolExercise[] = [
  ex('walk-or-bike',      'Light Walk or Stationary Bike', 1, 15, 20, 0, 'Conversational pace. Keep heart rate low.',  ['bike_or_treadmill'], [],                      'low', { prescriptionType: 'duration_minutes' }),
  ex('incline-walk',      'Incline Treadmill Walk',        1, 10, 15, 0, 'Low speed, moderate incline. Easy effort.',  ['bike_or_treadmill'], [],                      'low', { prescriptionType: 'duration_minutes' }),
  ex('outdoor-walk',      'Outdoor Walk',                  1, 15, 20, 0, 'Easy pace. Fresh air, clear head.',          ['bodyweight'],        [],                      'low', { prescriptionType: 'duration_minutes' }),
  ex('light-skip',        'Light Skipping',                1, 3,  5,  0, 'Easy rhythm. Wakes up the ankles.',          ['bodyweight'],        ['ankle', 'calf', 'knee'], 'low', { prescriptionType: 'duration_minutes' }),
];

export const BREATHING_RESET_POOL: PoolExercise[] = [
  ex('90-90-breathing',   '90/90 Breathing',             1, 8,  10, 0, 'Inhale through nose 4 sec, exhale 8 sec. Ribs down.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
  ex('crocodile-breath',  'Crocodile Breathing',         1, 8,  10, 0, 'Prone. Breathe into belly against floor.',            ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
  ex('box-breathing',     'Box Breathing',               1, 5,  5,  0, '4-sec inhale, 4-sec hold, 4-sec exhale, 4-sec hold.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
  ex('child-pose-breath', "Child's Pose with Breathing", 1, 60, 90, 0, 'Deep belly breaths. Relax everything.',               ['bodyweight'], [], 'low', { prescriptionType: 'duration' }),
];

// ═══════════════════════════════════════════════════════════════
// Pool Registry — maps category to its exercise pool
// ═══════════════════════════════════════════════════════════════

export const POOL_REGISTRY: Record<ExerciseCategory, PoolExercise[]> = {
  // Arms / Pump
  biceps: BICEPS_POOL,
  triceps: TRICEPS_POOL,
  delts: DELTS_POOL,
  upper_back_pump: UPPER_BACK_PUMP_POOL,
  // Prehab & Accessories
  groin_adductors: GROIN_ADDUCTORS_POOL,
  calves: CALVES_POOL,
  lower_prehab: LOWER_PREHAB_POOL,
  trunk_anti_rotation: TRUNK_ANTI_ROTATION_POOL,
  shoulder_health: SHOULDER_HEALTH_POOL,
  hamstring_light: HAMSTRING_LIGHT_POOL,
  // Recovery
  tissue_quality: TISSUE_QUALITY_POOL,
  mobility: MOBILITY_POOL,
  easy_cardio: EASY_CARDIO_POOL,
  breathing_reset: BREATHING_RESET_POOL,
};
