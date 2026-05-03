"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.POOL_REGISTRY = exports.BREATHING_RESET_POOL = exports.EASY_CARDIO_POOL = exports.MOBILITY_POOL = exports.TISSUE_QUALITY_POOL = exports.HAMSTRING_LIGHT_POOL = exports.SHOULDER_HEALTH_POOL = exports.TRUNK_ANTI_ROTATION_POOL = exports.LOWER_PREHAB_POOL = exports.CALVES_POOL = exports.GROIN_ADDUCTORS_POOL = exports.UPPER_BACK_PUMP_POOL = exports.DELTS_POOL = exports.TRICEPS_POOL = exports.BICEPS_POOL = void 0;
function ex(id, name, sets, repsMin, repsMax, restSeconds, notes, equipment = [], contraindications = [], fatigue = 'low', opts) {
    return {
        id, name, notes, sets, repsMin, repsMax, restSeconds, equipment, contraindications, fatigue,
        ...(opts?.prescriptionType ? { prescriptionType: opts.prescriptionType } : {}),
        ...(opts?.perSide ? { perSide: opts.perSide } : {}),
    };
}
// ═══════════════════════════════════════════════════════════════
// ARMS / PUMP pools
// ═══════════════════════════════════════════════════════════════
exports.BICEPS_POOL = [
    ex('cable-curl', 'Cable Bicep Curl', 3, 12, 15, 45, 'Controlled tempo. Squeeze at top.', ['cables'], ['elbow', 'wrist']),
    ex('hammer-curl', 'Hammer Curl', 2, 10, 12, 45, 'Neutral grip. Works the forearms too.', ['dumbbells'], ['elbow', 'wrist']),
    ex('incline-db-curl', 'Incline Dumbbell Curl', 3, 10, 12, 45, '30° incline. Big stretch at the bottom.', ['dumbbells', 'bench'], ['shoulder', 'elbow']),
    ex('band-curl', 'Banded Bicep Curl', 3, 15, 20, 30, 'Peak tension at top. Good pump finisher.', ['bands'], ['elbow']),
    ex('preacher-curl', 'Machine Preacher Curl', 3, 10, 12, 45, 'Strict isolation. No swinging.', ['machine'], ['elbow', 'wrist']),
    ex('concentration-curl', 'Concentration Curl', 2, 12, 15, 30, 'Seated, elbow on inner thigh. Slow negatives.', ['dumbbells'], ['elbow']),
    ex('bw-chin-curl', 'Chin-Up Negative (Slow)', 2, 4, 6, 60, '5-second lowering phase. Biceps and back.', ['pullup_bar'], ['shoulder', 'elbow']),
];
exports.TRICEPS_POOL = [
    ex('rope-pushdown', 'Rope Tricep Pushdown', 3, 12, 15, 45, 'Spread the rope at the bottom. Full lockout.', ['cables'], ['elbow', 'wrist']),
    ex('overhead-ext', 'Overhead Tricep Extension', 2, 10, 12, 45, 'Cable or dumbbell. Full stretch at bottom.', ['cables'], ['shoulder', 'elbow']),
    ex('kickback', 'Dumbbell Kickback', 2, 12, 15, 30, 'Hinge forward, lock elbow. Squeeze at top.', ['dumbbells'], ['elbow']),
    ex('close-grip-pushup', 'Close-Grip Push-Up', 3, 10, 15, 45, 'Hands inside shoulder width. Elbows tight.', ['bodyweight'], ['wrist', 'shoulder']),
    ex('band-pushdown', 'Banded Tricep Pushdown', 3, 15, 20, 30, 'Anchor band overhead. Constant tension.', ['bands'], ['elbow']),
    ex('diamond-pushup', 'Diamond Push-Up', 2, 8, 12, 45, 'Hands together under chest. Tricep dominant.', ['bodyweight'], ['wrist', 'shoulder']),
    ex('skull-crusher-db', 'Dumbbell Skull Crusher', 3, 10, 12, 45, 'Lying on bench. Lower toward temples, press up.', ['dumbbells', 'bench'], ['elbow', 'shoulder']),
];
exports.DELTS_POOL = [
    ex('lateral-raise', 'Dumbbell Lateral Raise', 3, 12, 15, 45, 'Light weight, strict form. No momentum.', ['dumbbells'], ['shoulder']),
    ex('face-pull', 'Cable Face Pull', 3, 15, 20, 30, 'Pull to forehead, open hands out at the top.', ['cables'], []),
    ex('band-pull-apart-d', 'Band Pull-Apart (delts)', 3, 15, 20, 20, 'Shoulder-width grip. Rear delt focus.', ['bands'], []),
    ex('seated-db-press-l', 'Light Seated DB Press', 2, 12, 15, 45, 'Light weight only. Pre-game friendly.', ['dumbbells', 'bench'], ['shoulder']),
    ex('cable-lat-raise', 'Cable Lateral Raise', 3, 12, 15, 45, 'Cross-body start. Constant tension.', ['cables'], ['shoulder']),
    ex('rear-delt-fly', 'Rear Delt Fly', 3, 12, 15, 30, 'Bent over or machine. Pinch shoulder blades.', ['dumbbells'], ['shoulder', 'lower_back']),
    ex('plate-front-raise', 'Plate Front Raise', 2, 10, 12, 30, 'Slow and controlled. Core engaged.', ['dumbbells'], ['shoulder']),
];
exports.UPPER_BACK_PUMP_POOL = [
    ex('band-pull-apart', 'Band Pull-Aparts', 3, 15, 20, 20, 'Squeeze shoulder blades together. Good for posture.', ['bands'], []),
    ex('face-pull-ub', 'Face Pull (upper back)', 3, 15, 20, 30, 'Pull high, open hands out. Great for posture.', ['cables'], []),
    ex('chest-supported-row', 'Chest-Supported DB Row', 3, 10, 12, 45, 'Light weight. Squeeze shoulder blades back.', ['dumbbells', 'bench'], ['lower_back']),
    ex('seated-cable-row-l', 'Light Seated Cable Row', 3, 12, 15, 45, 'Slow on the way down. Squeeze shoulder blades.', ['cables'], ['lower_back']),
    ex('bw-inv-row', 'Inverted Row (Bodyweight)', 3, 8, 12, 45, 'Underhand or overhand. Scale with angle.', ['pullup_bar'], ['shoulder']),
    ex('prone-y-raise', 'Prone Y Raise', 2, 10, 12, 30, 'Lying face down. Thumbs up, arms to Y.', ['bodyweight'], ['shoulder', 'lower_back']),
];
// ═══════════════════════════════════════════════════════════════
// PREHAB & ACCESSORIES pools
// ═══════════════════════════════════════════════════════════════
exports.GROIN_ADDUCTORS_POOL = [
    ex('copenhagen-plank', 'Copenhagen Plank', 3, 20, 30, 45, 'Builds inner thigh strength.', ['bodyweight'], ['groin', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('side-lying-add', 'Side-Lying Adduction', 2, 12, 15, 30, 'Slow raise. Inner thigh strength.', ['bodyweight'], ['groin', 'hip'], 'low', { prescriptionType: 'reps' }),
    ex('sumo-squat-hold', 'Sumo Squat Iso Hold', 2, 30, 45, 30, 'Wide stance, chest up. Hold it.', ['bodyweight'], ['groin', 'knee'], 'low', { prescriptionType: 'duration' }),
    ex('slider-add', 'Slider Adductor Slide', 2, 8, 10, 45, 'Controlled slide out and back.', ['bodyweight'], ['groin', 'hip'], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('band-add-squeeze', 'Band Adductor Squeeze', 3, 10, 12, 30, 'Squeeze band between knees and hold.', ['bands'], ['groin'], 'low', { prescriptionType: 'reps' }),
];
/**
 * CALVES — general calf work. Appropriate in mixed prehab sessions
 * regardless of upper/lower focus. Low systemic cost.
 */
exports.CALVES_POOL = [
    ex('calf-raise', 'Single-Leg Calf Raise', 3, 12, 15, 30, '3-second lowering.', ['bodyweight'], [], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('seated-calf', 'Seated Calf Raise', 3, 15, 20, 30, 'Bent knee, slow tempo. Targets deep calf.', ['machine'], [], 'low', { prescriptionType: 'reps' }),
    ex('eccentric-calf', 'Eccentric Calf Lower', 2, 8, 10, 45, '5-second lowering off a step.', ['bodyweight'], ['calf', 'ankle'], 'low', { prescriptionType: 'reps', perSide: true }),
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
exports.LOWER_PREHAB_POOL = [
    ex('tib-raise', 'Tibialis Raise', 2, 15, 20, 30, 'Front of shins. Helps prevent shin splints.', ['bodyweight'], ['ankle'], 'low', { prescriptionType: 'reps' }),
    ex('ankle-circle', 'Ankle Circles', 2, 10, 10, 15, 'Full range circles.', ['bodyweight'], [], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('band-dorsiflexion', 'Banded Ankle Dorsiflexion', 2, 15, 20, 20, 'Wrap band around forefoot. Pull toes up.', ['bands'], ['ankle'], 'low', { prescriptionType: 'reps' }),
];
exports.TRUNK_ANTI_ROTATION_POOL = [
    ex('pallof-press', 'Pallof Press', 3, 10, 12, 45, 'Resist the rotation, stay square.', ['cables'], [], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('band-pallof', 'Band Pallof Press', 3, 10, 12, 45, 'Band at chest height. Press out and hold.', ['bands'], [], 'low', { prescriptionType: 'reps' }),
    ex('dead-bug', 'Dead Bug', 3, 8, 10, 30, 'Opposite arm and leg. Keep core tight.', ['bodyweight'], [], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('bird-dog', 'Bird Dog', 2, 8, 10, 30, 'Slow and controlled.', ['bodyweight'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('side-plank', 'Side Plank', 2, 30, 45, 30, 'Stack hips. Breathe.', ['bodyweight'], ['shoulder'], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('half-kneel-chop', 'Half-Kneeling Cable Chop', 2, 10, 12, 45, 'Controlled rotation. Light weight.', ['cables'], ['lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('suitcase-carry', 'Suitcase Carry', 2, 30, 40, 45, 'Stay tall, don\'t lean.', ['dumbbells'], ['lower_back', 'wrist'], 'low', { prescriptionType: 'distance', perSide: true }),
];
exports.SHOULDER_HEALTH_POOL = [
    ex('band-pull-apart-sh', 'Band Pull-Aparts', 3, 15, 20, 20, 'Squeeze shoulder blades together at the top.', ['bands'], [], 'low', { prescriptionType: 'reps' }),
    ex('ext-rotation', 'Cable External Rotation', 2, 12, 15, 30, 'Elbow pinned to side. Slow and controlled.', ['cables'], ['shoulder'], 'low', { prescriptionType: 'reps' }),
    ex('band-ext-rot', 'Banded External Rotation', 2, 15, 20, 20, 'Elbow at 90°. Rotate out against band.', ['bands'], ['shoulder'], 'low', { prescriptionType: 'reps' }),
    ex('prone-t-raise', 'Prone T Raise', 2, 10, 12, 30, 'Lying face down, arms to T. Thumbs up.', ['bodyweight'], ['shoulder'], 'low', { prescriptionType: 'reps' }),
    ex('wall-slide', 'Wall Slide', 2, 10, 12, 20, 'Slide arms up maintaining wall contact.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
    ex('scap-pushup', 'Scapular Push-Up', 2, 10, 12, 20, 'Arms locked. Push shoulder blades apart, then squeeze.', ['bodyweight'], ['wrist'], 'low', { prescriptionType: 'reps' }),
];
exports.HAMSTRING_LIGHT_POOL = [
    ex('nordic-eccentric', 'Nordic Hamstring (Slow Lower)', 2, 4, 6, 60, 'Lower yourself slowly. Catch at the bottom.', ['bodyweight'], ['hamstring', 'knee'], 'low', { prescriptionType: 'reps' }),
    ex('single-leg-rdl-bw', 'Single-Leg RDL (Bodyweight)', 2, 8, 10, 30, 'Hinge at hip, knee soft.', ['bodyweight'], ['hamstring', 'lower_back'], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('slider-curl', 'Slider Hamstring Curl', 2, 8, 10, 45, 'Supine. Slide heels out and back.', ['bodyweight'], ['hamstring', 'knee'], 'low', { prescriptionType: 'reps' }),
    ex('band-leg-curl', 'Banded Leg Curl', 2, 12, 15, 30, 'Prone. Curl against band. Light resistance.', ['bands'], ['hamstring', 'knee'], 'low', { prescriptionType: 'reps' }),
    ex('swiss-ball-curl', 'Swiss Ball Hamstring Curl', 2, 10, 12, 45, 'Hips up. Roll ball in and out.', ['bodyweight'], ['hamstring', 'lower_back'], 'low', { prescriptionType: 'reps' }),
];
// ═══════════════════════════════════════════════════════════════
// RECOVERY pools
// ═══════════════════════════════════════════════════════════════
exports.TISSUE_QUALITY_POOL = [
    ex('foam-roll-lower', 'Foam Roll — Quads, Glutes & Adductors', 1, 90, 120, 0, 'Spend extra time on tender spots.', ['foam_roller'], [], 'low', { prescriptionType: 'duration' }),
    ex('foam-roll-upper', 'Foam Roll — Thoracic Spine & Lats', 1, 60, 90, 0, 'Roll slowly, breathe into tight spots.', ['foam_roller'], [], 'low', { prescriptionType: 'duration' }),
    ex('foam-roll-calves', 'Foam Roll — Calves & Outer Shins', 1, 60, 60, 0, 'Cross legs for more pressure.', ['foam_roller'], [], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('lacrosse-glute', 'Lacrosse Ball Glute Release', 1, 60, 90, 0, 'Sit on ball, find trigger points.', ['bodyweight'], [], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('pec-doorway', 'Pec / Chest Doorway Stretch', 1, 30, 45, 0, 'Open the chest. Breathe into the stretch.', ['bodyweight'], ['shoulder'], 'low', { prescriptionType: 'duration', perSide: true }),
];
exports.MOBILITY_POOL = [
    ex('hip-90-90', 'Hip 90/90 Stretch', 2, 30, 45, 30, 'Breathe into the stretch.', ['bodyweight'], ['hip', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('cat-cow', 'Cat-Cow', 2, 10, 12, 15, 'Slow and controlled. Match movement to breath.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
    ex('worlds-greatest', "World's Greatest Stretch", 2, 5, 5, 15, 'Hold each position 3 seconds.', ['bodyweight'], [], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('deep-squat-hold', 'Deep Squat Hold', 2, 30, 45, 20, 'Chest up, heels down. Breathe.', ['bodyweight'], ['knee', 'ankle'], 'low', { prescriptionType: 'duration' }),
    ex('couch-stretch', 'Couch Stretch (Hip Flexor)', 2, 30, 45, 15, 'Rear foot elevated.', ['bodyweight'], ['knee', 'hip'], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('thoracic-rotation', 'Open Book Thoracic Rotation', 2, 8, 10, 15, 'Side-lying. Follow hand with eyes.', ['bodyweight'], [], 'low', { prescriptionType: 'reps', perSide: true }),
    ex('pigeon-stretch', 'Pigeon Stretch', 2, 30, 45, 15, 'Deep hip external rotation.', ['bodyweight'], ['hip', 'knee'], 'low', { prescriptionType: 'duration', perSide: true }),
    ex('adductor-rock', 'Adductor Rockback', 2, 10, 12, 15, 'Wide knees, rock back. Groin opener.', ['bodyweight'], ['groin'], 'low', { prescriptionType: 'reps' }),
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
exports.EASY_CARDIO_POOL = [
    ex('walk-or-bike', 'Light Walk or Stationary Bike', 1, 15, 20, 0, 'Conversational pace. Keep heart rate low.', ['bike_or_treadmill'], [], 'low', { prescriptionType: 'duration_minutes' }),
    ex('incline-walk', 'Incline Treadmill Walk', 1, 10, 15, 0, 'Low speed, moderate incline. Easy effort.', ['bike_or_treadmill'], [], 'low', { prescriptionType: 'duration_minutes' }),
    ex('outdoor-walk', 'Outdoor Walk', 1, 15, 20, 0, 'Easy pace. Fresh air, clear head.', ['bodyweight'], [], 'low', { prescriptionType: 'duration_minutes' }),
    ex('light-skip', 'Light Skipping', 1, 3, 5, 0, 'Easy rhythm. Wakes up the ankles.', ['bodyweight'], ['ankle', 'calf', 'knee'], 'low', { prescriptionType: 'duration_minutes' }),
];
exports.BREATHING_RESET_POOL = [
    ex('90-90-breathing', '90/90 Breathing', 1, 8, 10, 0, 'Inhale through nose 4 sec, exhale 8 sec. Ribs down.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
    ex('crocodile-breath', 'Crocodile Breathing', 1, 8, 10, 0, 'Prone. Breathe into belly against floor.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
    ex('box-breathing', 'Box Breathing', 1, 5, 5, 0, '4-sec inhale, 4-sec hold, 4-sec exhale, 4-sec hold.', ['bodyweight'], [], 'low', { prescriptionType: 'reps' }),
    ex('child-pose-breath', "Child's Pose with Breathing", 1, 60, 90, 0, 'Deep belly breaths. Relax everything.', ['bodyweight'], [], 'low', { prescriptionType: 'duration' }),
];
// ═══════════════════════════════════════════════════════════════
// Pool Registry — maps category to its exercise pool
// ═══════════════════════════════════════════════════════════════
exports.POOL_REGISTRY = {
    // Arms / Pump
    biceps: exports.BICEPS_POOL,
    triceps: exports.TRICEPS_POOL,
    delts: exports.DELTS_POOL,
    upper_back_pump: exports.UPPER_BACK_PUMP_POOL,
    // Prehab & Accessories
    groin_adductors: exports.GROIN_ADDUCTORS_POOL,
    calves: exports.CALVES_POOL,
    lower_prehab: exports.LOWER_PREHAB_POOL,
    trunk_anti_rotation: exports.TRUNK_ANTI_ROTATION_POOL,
    shoulder_health: exports.SHOULDER_HEALTH_POOL,
    hamstring_light: exports.HAMSTRING_LIGHT_POOL,
    // Recovery
    tissue_quality: exports.TISSUE_QUALITY_POOL,
    mobility: exports.MOBILITY_POOL,
    easy_cardio: exports.EASY_CARDIO_POOL,
    breathing_reset: exports.BREATHING_RESET_POOL,
};
