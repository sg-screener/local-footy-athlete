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
  | 'machine'
  // Sam's audit ruling 1, 2026-07-31: the box joins the checklist as the 10th
  // equipment question, and Depth Jumps' requirement maps to it.
  | 'plyo_box'
  // ── ITEM 46/47, 2026-08-13. THE KIT AN ATHLETE COULD NOT TELL US ABOUT. ──
  //
  // The authored library already REQUIRED these words — `Back Squat` has said
  // `['Barbell', 'Rack']` all along — but the bridge collapsed `Rack` and
  // `Trap Bar` onto `barbell`, so a tick could never match the requirement.
  // Sam, on his own edit of the equipment sheet: *"a home gym with dumbbells
  // and a bar but no rack still gets a back squat"* — that is the defect, and
  // it is a MISSING QUESTION, not a missing filter.
  //
  // Each of these is askable ONLY because an authored row demands it; the
  // checklist is derived (`derivedEquipmentChecklistTags`) and reds in both
  // directions, so a tag nothing requires cannot ship here.
  | 'rack'
  | 'trap_bar'
  | 'swiss_ball'
  | 'ab_wheel'
  | 'back_extension_bench'
  | 'dip_bars'
  | 'rings_trx'
  // ── THE KIT SAM'S OWN SHEET REQUIRED AND NOBODY COULD BE ASKED ABOUT ──
  //
  // `EXERCISE_EQUIPMENT_REQUIREMENT["Bear Carry"] = ['sandbag']` — his answer,
  // transcribed from `docs/EXERCISE_EQUIPMENT_FOR_SAM.md`, where he wrote
  // "sand bag / dead ball". The word had no tag, so `exerciseIsAvailableWith`
  // asked for a thing no athlete could ever own and **Bear Carry was refused on
  // every kit forever, silently.**
  //
  // It survived the both-directions vocabulary gate because that gate derives
  // from FIVE authored sources and Sam's sheet was not one of them — see
  // `rules/equipmentVocabulary.ts`, where the sheet is now read FIRST.
  | 'sandbag';

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
  | 'neck'
  | 'ribs';

export type PoolEquipmentRequirement = EquipmentTag | readonly EquipmentTag[];

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
  equipment: PoolEquipmentRequirement[];
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
  equipment: PoolEquipmentRequirement[] = [],
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

const BAND_PULL_APART = ex('band-pull-apart', 'Band Pull-Apart', 3, 15, 20, 20,
  'Squeeze shoulder blades together. Good for posture.', ['bands'], []);
const FACE_PULL = ex('face-pull', 'Face Pull', 3, 15, 20, 30,
  'Pull high, open hands out. Great for posture.', ['cables'], []);
const INCLINE_Y_RAISE = ex('incline-y-raise', 'Incline Y Raise', 3, 10, 12, 30,
  'Face-down on incline bench. Thumbs up, arms out.', ['dumbbells', 'bench'], ['shoulder']);

export const BICEPS_POOL: PoolExercise[] = [
  ex('hammer-curl',       'Hammer Curl',                2, 10, 12, 45, 'Neutral grip. Works the forearms too.',       ['dumbbells'], ['elbow', 'wrist']),
  ex('incline-db-curl',   'Incline Dumbbell Curl',      3, 10, 12, 45, '30° incline. Big stretch at the bottom.',     ['dumbbells', 'bench'], ['shoulder', 'elbow']),
  ex('band-curl',         'Banded Bicep Curl',          3, 15, 20, 30, 'Peak tension at top. Good pump finisher.',    ['bands'],     ['elbow']),
  ex('concentration-curl','Concentration Curl',         2, 12, 15, 30, 'Seated, elbow on inner thigh. Slow negatives.', ['dumbbells'], ['elbow']),
  ex('bw-chin-curl',      'Chin-Up Negative (Slow)',    2, 4,  6,  60, '5-second lowering phase. Biceps and back.',   ['pullup_bar'],['shoulder', 'elbow']),
  ex('barbell-bicep-curl','Bicep Curl (Barbell)',       3, 10, 12, 45, 'Keep elbows still. Curl without leaning back.', ['barbell'],  ['elbow', 'wrist']),
  ex('dumbbell-bicep-curl','Bicep Curl (Dumbbell)',     3, 10, 12, 45, 'Keep elbows still. Control both directions.',  ['dumbbells'],['elbow', 'wrist']),
  ex('lying-db-curl',     'Lying Dumbbell Curl',        2, 10, 12, 45, 'Lie flat. Let the arms stretch at the bottom.', ['dumbbells'],['shoulder', 'elbow']),
];

export const TRICEPS_POOL: PoolExercise[] = [
  ex('tricep-pushdown',   'Tricep Pushdown',            3, 12, 15, 45, 'Full lockout at the bottom. Keep elbows pinned.', ['cables'], ['elbow', 'wrist']),
  ex('overhead-ext',      'Overhead Tricep Extension',  2, 10, 12, 45, 'Cable or dumbbell. Full stretch at bottom.',  ['cables'],    ['shoulder', 'elbow']),
  ex('kickback',          'Dumbbell Kickback',          2, 12, 15, 30, 'Hinge forward, lock elbow. Squeeze at top.',  ['dumbbells'], ['elbow']),
  ex('band-pushdown',     'Banded Tricep Pushdown',     3, 15, 20, 30, 'Anchor band overhead. Constant tension.',     ['bands'],     ['elbow']),
  ex('skull-crusher-db',  'Dumbbell Skull Crusher',     3, 10, 12, 45, 'Lying on bench. Lower toward temples, press up.', ['dumbbells', 'bench'], ['elbow', 'shoulder']),
  ex('skull-crushers',    'Skull Crushers',             3, 10, 12, 45, 'Lower beside the head. Keep the elbows in place.', [['dumbbells', 'barbell']], ['elbow', 'shoulder']),
  ex('dirty-30',          'Tricep Circuit (Dirty 30)',  2, 30, 30, 45, 'Move through all three positions without rest.', ['barbell'], ['elbow', 'shoulder']),
];

export const DELTS_POOL: PoolExercise[] = [
  ex('lateral-raise',     'Lateral Raise',              3, 12, 15, 45, 'Light weight, strict form. No momentum.',     ['dumbbells'], ['shoulder']),
  ex('cable-face-pull',   'Cable Face Pull',            3, 15, 20, 30, 'Pull to forehead, open hands out at the top.', ['cables'],    []),
  ex('rear-delt-fly',     'Rear Delt Fly',              3, 12, 15, 30, 'Bent over or machine. Pinch shoulder blades.',['dumbbells'], ['shoulder', 'lower_back']),
  ex('shrugs',            'Shrugs',                     3, 10, 12, 45, 'Straight up, pause at the top. No rolling.',  ['dumbbells'], ['wrist', 'lower_back']),
  ex('single-arm-shrug',  'Single-Arm Shrug',           3, 10, 12, 45, 'One side at a time. Full range, slight pause at top.', ['dumbbells'], ['wrist', 'lower_back']),
  INCLINE_Y_RAISE,
  FACE_PULL,
  BAND_PULL_APART,
];

/**
 * Gunshow movements that are too similar to prescribe together.
 * IDs are used because display aliases may change without changing exercise identity.
 */
// BIBLE_ANCHOR: gunshow_two_two_two
export const GUNSHOW_DO_NOT_PAIR_IDS: ReadonlyArray<readonly [string, string]> = [
  ['lying-db-curl', 'incline-db-curl'],
  ['tricep-pushdown', 'band-pushdown'],
  ['skull-crusher-db', 'skull-crushers'],
  ['skull-crusher-db', 'dirty-30'],
  ['shrugs', 'single-arm-shrug'],
  ['face-pull', 'cable-face-pull'],
  ['face-pull', 'band-pull-apart'],
  ['dumbbell-bicep-curl', 'hammer-curl'],
];

const GUNSHOW_DO_NOT_PAIR_KEYS = new Set(
  GUNSHOW_DO_NOT_PAIR_IDS.map(([left, right]) => [left, right].sort().join('|')),
);

export function gunshowExercisesCanPair(left: PoolExercise, right: PoolExercise): boolean {
  return !GUNSHOW_DO_NOT_PAIR_KEYS.has([left.id, right.id].sort().join('|'));
}

export const UPPER_BACK_PUMP_POOL: PoolExercise[] = [
  BAND_PULL_APART,
  FACE_PULL,
  ex('chest-supported-row','Chest-Supported DB Row',     3, 10, 12, 45, 'Light weight. Squeeze shoulder blades back.', ['dumbbells', 'bench'], ['lower_back']),
  ex('bw-inv-row',        'Inverted Row (Bodyweight)',   3, 8,  12, 45, 'Underhand or overhand. Scale with angle.',    ['pullup_bar'],['shoulder']),
  INCLINE_Y_RAISE,
];

// ═══════════════════════════════════════════════════════════════
// PREHAB & ACCESSORIES pools
// ═══════════════════════════════════════════════════════════════

/**
 * GROIN / ADDUCTORS.
 *
 * Sam's locked-list changeset (2026-07-24) retired the Adductor and Abductor
 * Machines, so the whole of groin coverage is now these four: two Copenhagens,
 * the squeeze, and the two lateral patterns he added in their place.
 */
export const GROIN_ADDUCTORS_POOL: PoolExercise[] = [
  ex('copenhagen-plank',  'Copenhagen Plank (Half)',           3, 20, 30, 45, 'Builds inner thigh strength.',                ['bodyweight'],['groin', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('copenhagen-long',   'Long-Lever Copenhagen',             3, 15, 25, 45, 'Full lever. Hips high, no dropping.',         ['bodyweight'],['groin', 'knee'], 'moderate', { prescriptionType: 'duration', perSide: true }),
  ex('groin-squeeze',     'Groin Squeeze',                     3, 10, 12, 30, 'Ball or fists between the knees. Squeeze and hold.', [],            ['groin'],         'low', { prescriptionType: 'reps' }),
  ex('cossack-squat',     'Cossack Squat',                     3, 6,  8,  45, 'Sit onto one leg, other leg straight. Hold a rack if needed.', ['bodyweight'], ['groin', 'knee'], 'moderate', { prescriptionType: 'reps', perSide: true }),
  ex('lateral-lunge',     'Lateral Lunge',                     3, 8,  10, 45, 'Big step sideways, sit into that hip.',        ['bodyweight'], ['groin', 'knee'], 'moderate', { prescriptionType: 'reps', perSide: true }),
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
 * LOWER PREHAB — knee / hip / ankle / shin tissue work.
 *
 * Context-specific: only eligible in lower-body or recovery/prehab sessions.
 * NOT a neutral filler. These exercises exist to support lower-limb joint
 * health and should only appear when the session intent includes lower-body
 * or explicit prehab goals.
 *
 * Sam's locked-list changeset (2026-07-24) widened this from ankle/shin work
 * alone to the full lower-limb prehab set — the five entries below were all
 * already tagged and are now selectable rather than orphaned.
 *
 * Session eligibility:
 *   ✓ Lower strength/hypertrophy (as accessory)
 *   ✓ Extended recovery (low-load prehab)
 *   ✗ Upper sessions
 *   ✗ Arms / pump
 *   ✗ Generic prehab_accessories (use calves instead)
 */
export const LOWER_PREHAB_POOL: PoolExercise[] = [
  ex('tib-raise',         'Tib Raises',             2, 15, 20, 30, 'Front of shins. Helps prevent shin splints.', ['bodyweight'],['ankle'], 'low', { prescriptionType: 'reps' }),
  ex('banded-tke',        'Banded TKE',             2, 15, 20, 30, 'Band behind the knee. Straighten and squeeze the quad.', ['bands'], ['knee'], 'low', { prescriptionType: 'reps' }),
  ex('bosch-hold',        'Bosch Hold',             2, 20, 30, 30, 'Drive the heel down, hips high. Single or double leg.', ['bodyweight'], ['hamstring', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
  ex('spanish-squat',     'Spanish Squat Hold',     2, 20, 30, 30, 'Band behind the knees. Sit back and hold.',   ['bands'], ['knee'], 'low', { prescriptionType: 'duration' }),
  ex('slant-step-down',   'Slant Board Step-Down',  2, 8,  10, 30, 'Knee tracks over the toes. Tap, don\'t drop.', ['bodyweight'], ['knee'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('crab-walks',        'Crab Walks',             2, 10, 12, 30, 'Band around the feet. Push off the outside leg.', ['bands'], ['hip', 'knee'], 'low', { prescriptionType: 'reps', perSide: true }),
];

export const TRUNK_ANTI_ROTATION_POOL: PoolExercise[] = [
  ex('band-pallof',       'Band Pallof Press',          3, 10, 12, 45, 'Band at chest height. Press out and hold.',   ['bands'],     [],                     'low', { prescriptionType: 'reps' }),
  ex('dead-bug',          'Dead Bug',                   3, 8,  10, 30, 'Opposite arm and leg. Keep the midline tight.',      ['bodyweight'],[],                     'low', { prescriptionType: 'reps', perSide: true }),
  ex('banded-dead-bug',   'Banded Dead Bug',            3, 8,  10, 30, 'Band around feet adds anti-extension challenge.', ['bands'], [],                    'low', { prescriptionType: 'reps', perSide: true }),
  ex('weighted-dead-bug', 'Weighted Dead Bug',          3, 6,  8,  45, 'Hold dumbbells overhead. Slow and controlled.', ['dumbbells'], [],                  'low', { prescriptionType: 'reps', perSide: true }),
  ex('mcgill-situp',      'McGill Sit Up',              3, 8,  10, 30, 'One knee bent, hands under low back. Lift shoulder blades only.', ['bodyweight'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('ab-wheel',          'Ab Wheel',                   3, 6,  10, 60, 'Roll out, brace hard, no low-back sag.',      ['ab_wheel'],['lower_back', 'shoulder'], 'moderate', { prescriptionType: 'reps' }),
  ex('hanging-leg-raise', 'Hanging Leg Raise',          3, 6,  10, 60, 'Dead hang from bar. No swing.',               ['pullup_bar'],['shoulder'],            'moderate', { prescriptionType: 'reps' }),
  ex('bird-dog',          'Bird Dog',                   2, 8,  10, 30, 'Slow and controlled.',                        ['bodyweight'],['lower_back'],         'low', { prescriptionType: 'reps', perSide: true }),
  ex('side-plank',        'Side Plank',                 2, 30, 45, 30, 'Stack hips. Breathe.',                        ['bodyweight'],['shoulder'],            'low', { prescriptionType: 'duration', perSide: true }),
  // Sam's locked-list additions (2026-07-24) — the anti-extension block the
  // Bible names alongside Dead Bug, plus the loaded side-plank variant.
  ex('plank',             'Plank',                      2, 30, 45, 30, 'Neutral spine, squeeze the glutes, breathe.', ['bodyweight'],['shoulder'],            'low', { prescriptionType: 'duration' }),
  ex('hollow-hold',       'Hollow Hold',                2, 20, 30, 30, 'Low back pinned to the floor. Stay tight.',   ['bodyweight'],['lower_back'],          'low', { prescriptionType: 'duration' }),
  ex('stir-the-pot',      'Stir the Pot',               2, 8,  10, 30, 'Forearms on the ball. Resist the rotation.',  ['bodyweight'],['lower_back', 'shoulder'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('dragon-flag',       'Dragon Flag',                2, 4,  6,  60, 'Control the way down. Roll through the back.', ['bodyweight'],['lower_back', 'shoulder'], 'moderate', { prescriptionType: 'reps' }),
  ex('side-plank-row',    'Side Plank Row',             2, 8,  10, 30, 'Row the band in, resist rolling forward.',    ['bands'],     ['shoulder'],            'low', { prescriptionType: 'reps', perSide: true }),
  ex('woodchop-standing', 'Woodchop (Standing)',        2, 10, 12, 45, 'Cable or band, high to low. Rotate from torso.', ['cables', 'bands'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('woodchop-hk',       'Woodchop (Half Kneeling)',   2, 10, 12, 45, 'Half-kneeling. Controlled rotation. Light weight.', ['cables', 'bands'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('suitcase-carry',    'Suitcase Carry',             2, 30, 40, 45, 'Stay tall, don\'t lean.',                     ['dumbbells'], ['lower_back', 'wrist'],'low', { prescriptionType: 'distance', perSide: true }),
];

export const SHOULDER_HEALTH_POOL: PoolExercise[] = [
  ex('band-pull-apart-sh','Band Pull-Apart',            3, 15, 20, 20, 'Squeeze shoulder blades together at the top.', ['bands'],     [],          'low', { prescriptionType: 'reps' }),
  ex('band-ext-rot',      'Banded External Rotation',   2, 15, 20, 20, 'Elbow at 90°. Rotate out against band.',     ['bands'],     ['shoulder'],'low', { prescriptionType: 'reps' }),
  ex('bottoms-up-press',  'Bottoms-Up KB Press',        2, 6,  8,  45, 'Bell inverted. Wrist stacked, ribs down.',    ['kettlebell'],['shoulder', 'wrist'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('scap-push-up',      'Scap Push-Up',               2, 10, 15, 30, 'Elbows locked. Glide the shoulder blades.',   ['bodyweight'],['shoulder', 'wrist'], 'low', { prescriptionType: 'reps' }),
  // Sam's authored addition (2026-07-28). Equipment-gated on the bar, so
  // `filterPool` drops it for Home gym and Outdoor.
  //
  // Contraindication is shoulder ONLY. That is narrower than the Scap Push-Up
  // sibling above, which also gates `wrist` — the divergence was raised with
  // Sam and CONFIRMED DELIBERATE (2026-07-28). A passive bar hang loads the
  // wrist differently from a locked-out push-up position. Settled, not an
  // oversight: do not "restore" wrist here.
  ex('scap-pull-up',      'Scap Pull Ups',              2, 10, 10, 30, 'Pause 1 sec at top each rep', ['pullup_bar'], ['shoulder'], 'low', { prescriptionType: 'reps' }),
];

export const HAMSTRING_LIGHT_POOL: PoolExercise[] = [
  ex('swiss-ball-curl',   'Swiss Ball Hamstring Curl',  2, 10, 12, 45, 'Hips up. Roll ball in and out.',              ['swiss_ball'],['hamstring', 'lower_back'], 'low', { prescriptionType: 'reps' }),
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
  // Sam's locked-list additions (2026-07-24).
  ex('ql-back-extension', 'QL Back Extension',            2, 8,  10, 15, 'Pinned in a 45° hyper. Bend sideways slowly.', ['bodyweight'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('atg-split-squat',   'ATG Split Squat',              2, 6,  8,  30, 'Front foot elevated. Slow, pause at the bottom.', ['bodyweight'], ['knee', 'hip'], 'low', { prescriptionType: 'reps', perSide: true }),
  ex('elephant-walks',    'Elephant Walks',               2, 8,  10, 15, 'Fold forward over blocks. Alternate legs slowly.', ['bodyweight'], ['hamstring', 'lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
  // Sam's authored additions (2026-07-28). `notes` carries his coaching
  // instruction for the hold/tempo the typed dose fields cannot express;
  // nothing parses it.
  ex('butterfly-stretch', 'Butterfly Stretch',            2, 6,  10, 30, 'Hold each rep 6–10 seconds',             ['bodyweight'], ['ankle', 'knee', 'hip', 'groin'], 'low', { prescriptionType: 'reps' }),
  ex('pissing-dog-wall',  'Pissing Dog Against Wall',     2, 6,  6,  30, 'Each side. Hold each rep 5 seconds',     ['bodyweight'], ['hip', 'lower_back'],             'low', { prescriptionType: 'reps' }),
  ex('jefferson-curl',    'Jefferson Curl',               2, 5,  5,  30, 'Slow reps',                              ['bodyweight'], ['lower_back', 'hamstring', 'neck'], 'low', { prescriptionType: 'reps' }),
  // Sam's authored addition (2026-07-28). Equipment-gated like `dead-hang`:
  // `filterPool` drops it for any athlete whose location lacks the tags, so
  // Home gym (dumbbells, no bench) and Outdoor never see it. `bench` is carried
  // because the cue requires one — Sam's ruling, 2026-07-28.
  ex('db-pullovers',      'Dumbbell Pullovers',           2, 10, 10, 30, 'Hold each rep for 2-3 seconds',          ['dumbbells', 'bench'], ['shoulder', 'ribs'], 'low', { prescriptionType: 'reps' }),
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
  ex('walk-or-bike',      'Light Walk or Stationary Bike', 1, 5, 10, 0, 'Conversational pace. Keep heart rate low.',  ['bike_or_treadmill'], [],                      'low', { prescriptionType: 'duration_minutes' }),
  ex('incline-walk',      'Incline Treadmill Walk',        1, 5, 10, 0, 'Low speed, moderate incline. Easy effort.',  ['bike_or_treadmill'], [],                      'low', { prescriptionType: 'duration_minutes' }),
  ex('outdoor-walk',      'Outdoor Walk',                  1, 5, 10, 0, 'Easy pace. Fresh air, clear head.',          ['bodyweight'],        [],                      'low', { prescriptionType: 'duration_minutes' }),
];

export const BREATHING_RESET_POOL: PoolExercise[] = [
  ex('90-90-breathing',   '90/90 Breathing',             1, 8,  10, 0, 'Inhale through nose 4 sec, exhale 8 sec. Ribs down.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
  ex('crocodile-breath',  'Crocodile Breathing',         1, 8,  10, 0, 'Prone. Breathe into belly against floor.',            ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
  ex('box-breathing',     'Box Breathing',               1, 10, 10, 0, '4-sec inhale, 4-sec hold, 4-sec exhale, 4-sec hold.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
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
