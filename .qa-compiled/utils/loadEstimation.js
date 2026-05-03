"use strict";
/**
 * Load Estimation — Intelligent starting weight defaults.
 *
 * Converts onboarding strength data (categorical squat/bench levels + bodyweight)
 * into credible starting weights for every exercise in the system.
 *
 * DESIGN:
 *   1. Convert categorical strength levels → estimated 1RM (kg)
 *   2. Map each exercise to an anchor lift (squat or bench) + working ratio
 *   3. Return a sensible working weight for the exercise's typical rep range
 *   4. Explicitly classify truly-bodyweight exercises (BW is the exception, not default)
 *
 * The ratios are NOT 1RM percentages — they're "what would a real athlete load
 * for this exercise given their anchor 1RM". They bake in the rep-range discount
 * so the output is a direct working weight, not a 1RM.
 *
 * ROUNDING:
 *   - Barbell exercises: 2.5 kg increments
 *   - Dumbbell exercises: 2.5 kg increments (per hand)
 *   - Cable/machine exercises: 5 kg increments
 *
 * ADDING EXERCISES:
 *   Append to EXERCISE_LOAD_MAP. The system falls back to a heuristic
 *   for unknown exercises (using exercise tags if available).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXERCISE_LOAD_MAP = exports.TRUE_BODYWEIGHT_EXERCISES = void 0;
exports.estimateAnchors = estimateAnchors;
exports.resolveExerciseName = resolveExerciseName;
exports.roundToEquipment = roundToEquipment;
exports.estimateStartingWeight = estimateStartingWeight;
exports.isTrueBodyweightExercise = isTrueBodyweightExercise;
exports.applyLoadEstimates = applyLoadEstimates;
const exerciseTags_1 = require("../data/exerciseTags");
// ─── Constants ───
const DEFAULT_BODYWEIGHT_KG = 82; // Average AFL player if not provided
// ─── Anchor 1RM Estimation ───
/**
 * Convert a categorical squat strength level to an estimated 1RM multiplier
 * relative to bodyweight. Conservative — better to start light.
 */
const SQUAT_MULTIPLIERS = {
    "I don't squat": 0.6,
    'Less than bodyweight': 0.8,
    'Around bodyweight': 1.0,
    '1.5x bodyweight': 1.5,
    '2x bodyweight+': 2.0,
    'Not sure': 0.8,
};
const BENCH_MULTIPLIERS = {
    "I don't bench": 0.4,
    'Less than bodyweight': 0.65,
    'Around bodyweight': 1.0,
    '1.25x bodyweight': 1.25,
    '1.5x bodyweight+': 1.5,
    'Not sure': 0.65,
};
/**
 * Derive numeric 1RM estimates from onboarding data.
 * Returns conservative estimates — starting too light is always better than too heavy.
 */
function estimateAnchors(data) {
    const bw = data.weightKg || DEFAULT_BODYWEIGHT_KG;
    const squatMul = SQUAT_MULTIPLIERS[data.squatStrength || 'Not sure'];
    const benchMul = BENCH_MULTIPLIERS[data.benchStrength || 'Not sure'];
    return {
        bodyweightKg: bw,
        squat1RM: bw * squatMul,
        bench1RM: bw * benchMul,
    };
}
/**
 * Exercises that are genuinely bodyweight-based.
 * These should show "BW" in the UI. Everything else gets a load estimate.
 */
exports.TRUE_BODYWEIGHT_EXERCISES = new Set([
    // Upper body BW
    'Pull-Ups',
    'Chin-Ups',
    'Push-ups',
    'Explosive Push-Ups',
    'Dips',
    'Clap Push-Ups',
    'Inverted Rows',
    // Lower body BW / plyo
    'Box Jumps',
    'Broad Jumps',
    'Jump Squats',
    'Lateral Bounds',
    'Depth Jumps',
    'Nordic Curls',
    // Conditioning / cardio (no external load)
    'Sprint Intervals',
    'Tempo Run',
    'Hill Sprints',
    'Quality Sprints',
    'MAS Training',
    'Flush Run',
    'Long Run',
    // Recovery / mobility (no load)
    'Dead Bug (All Variations)',
    'Bird Dog',
    'Side Plank (Weighted Optional)',
]);
/**
 * Map exercise names to their load profile.
 *
 * Ratio interpretation:
 *   If anchor 1RM = 120kg and ratio = 0.25, working weight = 30kg.
 *   This is the weight the athlete would actually load for the exercise's
 *   typical rep range (e.g. 3×8-12 for accessories).
 *
 * Dumbbell ratios are PER HAND.
 */
exports.EXERCISE_LOAD_MAP = {
    // ═══ LOWER BODY — BARBELL PRIMARY ═══
    'Back Squat': { anchor: 'squat', ratio: 0.82, equipment: 'barbell' },
    'Front Squat': { anchor: 'squat', ratio: 0.70, equipment: 'barbell' },
    'Box Squat': { anchor: 'squat', ratio: 0.75, equipment: 'barbell' },
    'Deadlift': { anchor: 'squat', ratio: 1.00, equipment: 'barbell' },
    'Trap Bar Deadlift': { anchor: 'squat', ratio: 0.90, equipment: 'barbell' },
    'RDLs': { anchor: 'squat', ratio: 0.65, equipment: 'barbell' },
    'Hip Thrusts': { anchor: 'squat', ratio: 0.70, equipment: 'barbell' },
    // ═══ LOWER BODY — DUMBBELL / UNILATERAL ═══
    'Bulgarian Split Squats': { anchor: 'squat', ratio: 0.22, equipment: 'dumbbell' },
    'Walking Lunges': { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
    'Reverse Lunges': { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
    'Step Ups': { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
    'Goblet Squat': { anchor: 'squat', ratio: 0.22, equipment: 'dumbbell' },
    'Single-Leg RDL': { anchor: 'squat', ratio: 0.15, equipment: 'dumbbell' },
    'Kettlebell Swings': { anchor: 'squat', ratio: 0.20, equipment: 'kettlebell' },
    // ═══ LOWER BODY — MACHINE ═══
    'Leg Press': { anchor: 'squat', ratio: 1.30, equipment: 'machine' },
    'Single-Leg Leg Press': { anchor: 'squat', ratio: 0.60, equipment: 'machine' },
    'Leg Curls': { anchor: 'squat', ratio: 0.25, equipment: 'machine' },
    'Calf Raises': { anchor: 'squat', ratio: 0.50, equipment: 'machine' },
    // ═══ UPPER BODY — BARBELL PRIMARY ═══
    'Bench Press': { anchor: 'bench', ratio: 0.82, equipment: 'barbell' },
    'Incline Bench': { anchor: 'bench', ratio: 0.72, equipment: 'barbell' },
    'Close Grip Bench': { anchor: 'bench', ratio: 0.75, equipment: 'barbell' },
    'Overhead Press': { anchor: 'bench', ratio: 0.58, equipment: 'barbell' },
    'Barbell Row': { anchor: 'bench', ratio: 0.70, equipment: 'barbell' },
    'Speed Bench': { anchor: 'bench', ratio: 0.55, equipment: 'barbell' },
    'Bicep Curl (Barbell)': { anchor: 'bench', ratio: 0.30, equipment: 'barbell' },
    // ═══ UPPER BODY — DUMBBELL ═══
    'DB Bench Press': { anchor: 'bench', ratio: 0.32, equipment: 'dumbbell' },
    'Incline DB Bench': { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
    'DB Shoulder Press': { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
    'Single-Arm DB Row': { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
    'Single-Arm DB Bench Press': { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
    'Single-Arm DB Floor Press': { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
    'Lateral Raise': { anchor: 'bench', ratio: 0.09, equipment: 'dumbbell' },
    // ═══ UPPER BODY — CABLE / MACHINE ═══
    'Seated Cable Row': { anchor: 'bench', ratio: 0.50, equipment: 'cable' },
    'Lat Pulldown': { anchor: 'bench', ratio: 0.55, equipment: 'cable' },
    'Face Pulls': { anchor: 'bench', ratio: 0.18, equipment: 'cable' },
    'Chest Supported Row': { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
    'Landmine Press': { anchor: 'bench', ratio: 0.35, equipment: 'barbell' },
    'Explosive Landmine Press': { anchor: 'bench', ratio: 0.25, equipment: 'barbell' },
    // ═══ CORE (low load — most are BW but some use cable/band) ═══
    'Cable or Band Woodchop': { anchor: 'bench', ratio: 0.12, equipment: 'cable' },
    'Hanging Leg Raise': { anchor: 'bench', ratio: 0.00, equipment: 'bodyweight' }, // True BW
    // ═══ ARMS / PUMP (pool exercises from derived sessions) ═══
    'Hammer Curl': { anchor: 'bench', ratio: 0.12, equipment: 'dumbbell' },
    'Incline DB Curl': { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
    'Cable Tricep Pushdown': { anchor: 'bench', ratio: 0.20, equipment: 'cable' },
    'Overhead Tricep Extension': { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
    'Skull Crushers': { anchor: 'bench', ratio: 0.18, equipment: 'dumbbell' }, // Usually EZ bar or DBs, not full barbell
    'DB Lateral Raise': { anchor: 'bench', ratio: 0.09, equipment: 'dumbbell' },
    'Face Pull (Rear Delts)': { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
    'Band Pull-Apart (delts)': { anchor: 'bench', ratio: 0.00, equipment: 'bodyweight' }, // Band — no KG
    'Cable Face Pull': { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
    'Chest Supported DB Row': { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
    'DB Shrugs': { anchor: 'bench', ratio: 0.30, equipment: 'dumbbell' },
    // ═══ COMMON GYM EXERCISES (missing from original map) ═══
    'Cable Fly': { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
    'Cable Chest Fly': { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
    'Leg Extension': { anchor: 'squat', ratio: 0.30, equipment: 'machine' },
    'Hack Squat': { anchor: 'squat', ratio: 0.80, equipment: 'machine' },
    'Machine Chest Press': { anchor: 'bench', ratio: 0.65, equipment: 'machine' },
    'Pec Deck': { anchor: 'bench', ratio: 0.30, equipment: 'machine' },
};
// ─── Exercise Name Aliases ───
//
// AI-generated programs often use different phrasing for the same exercise.
// This map normalises common variants to the canonical names used in
// EXERCISE_LOAD_MAP and TRUE_BODYWEIGHT_EXERCISES.
//
// Keys are lowercase. Lookup is: lowercase(input) → canonical name.
const EXERCISE_ALIASES = {
    // ── Bench variants ──
    'flat bench press': 'Bench Press',
    'barbell bench press': 'Bench Press',
    'bb bench press': 'Bench Press',
    'flat bench': 'Bench Press',
    'db bench': 'DB Bench Press',
    'dumbbell bench press': 'DB Bench Press',
    'flat db press': 'DB Bench Press',
    'flat db bench': 'DB Bench Press',
    'dumbbell bench': 'DB Bench Press',
    'neutral grip db press': 'DB Bench Press',
    'db incline press': 'Incline DB Bench',
    'incline dumbbell press': 'Incline DB Bench',
    'incline dumbbell bench': 'Incline DB Bench',
    'incline db press': 'Incline DB Bench',
    'db incline bench': 'Incline DB Bench',
    'dumbbell incline press': 'Incline DB Bench',
    'incline barbell bench': 'Incline Bench',
    'incline barbell press': 'Incline Bench',
    'barbell incline press': 'Incline Bench',
    'close-grip bench press': 'Close Grip Bench',
    'close-grip bench': 'Close Grip Bench',
    'cgbp': 'Close Grip Bench',
    // ── Squat variants ──
    'barbell squat': 'Back Squat',
    'barbell back squat': 'Back Squat',
    'high bar squat': 'Back Squat',
    'low bar squat': 'Back Squat',
    'bb squat': 'Back Squat',
    'goblet squats': 'Goblet Squat',
    'db goblet squat': 'Goblet Squat',
    'dumbbell goblet squat': 'Goblet Squat',
    'split squats': 'Bulgarian Split Squats',
    'rear foot elevated split squat': 'Bulgarian Split Squats',
    'rfess': 'Bulgarian Split Squats',
    'bulgarian split squat': 'Bulgarian Split Squats',
    'db split squat': 'Bulgarian Split Squats',
    // ── Deadlift / Hinge variants ──
    'conventional deadlift': 'Deadlift',
    'barbell deadlift': 'Deadlift',
    'hex bar deadlift': 'Trap Bar Deadlift',
    'romanian deadlift': 'RDLs',
    'rdl': 'RDLs',
    'barbell rdl': 'RDLs',
    'db rdl': 'Single-Leg RDL', // DB RDL usually means single-leg
    'single leg rdl': 'Single-Leg RDL',
    'single-leg romanian deadlift': 'Single-Leg RDL',
    'hip thrust': 'Hip Thrusts',
    'barbell hip thrust': 'Hip Thrusts',
    'bb hip thrust': 'Hip Thrusts',
    'glute bridge': 'Hip Thrusts',
    // ── Press variants ──
    'ohp': 'Overhead Press',
    'strict press': 'Overhead Press',
    'military press': 'Overhead Press',
    'barbell overhead press': 'Overhead Press',
    'standing press': 'Overhead Press',
    'dumbbell shoulder press': 'DB Shoulder Press',
    'db press': 'DB Shoulder Press',
    'seated db press': 'DB Shoulder Press',
    'dumbbell press': 'DB Shoulder Press',
    'arnold press': 'DB Shoulder Press',
    // ── Row variants ──
    'bent-over row': 'Barbell Row',
    'bb row': 'Barbell Row',
    'bent over barbell row': 'Barbell Row',
    'pendlay row': 'Barbell Row',
    'dumbbell row': 'Single-Arm DB Row',
    'db row': 'Single-Arm DB Row',
    'one-arm db row': 'Single-Arm DB Row',
    'one arm dumbbell row': 'Single-Arm DB Row',
    'cable row': 'Seated Cable Row',
    'seated row': 'Seated Cable Row',
    // ── Pull variants ──
    'pull-up': 'Pull-Ups',
    'pull up': 'Pull-Ups',
    'pullup': 'Pull-Ups',
    'pullups': 'Pull-Ups',
    'chin-up': 'Chin-Ups',
    'chin up': 'Chin-Ups',
    'chinup': 'Chin-Ups',
    'chinups': 'Chin-Ups',
    'lat pulldowns': 'Lat Pulldown',
    'lat pull-down': 'Lat Pulldown',
    'wide grip pulldown': 'Lat Pulldown',
    // ── Push-up / Dip variants ──
    'push-up': 'Push-ups',
    'push up': 'Push-ups',
    'pushup': 'Push-ups',
    'pushups': 'Push-ups',
    'dip': 'Dips',
    'tricep dips': 'Dips',
    'chest dips': 'Dips',
    'parallel bar dips': 'Dips',
    'explosive push-ups': 'Explosive Push-Ups',
    'explosive push ups': 'Explosive Push-Ups',
    'explosive pushups': 'Explosive Push-Ups',
    'plyo push-ups': 'Explosive Push-Ups',
    'plyometric push-ups': 'Explosive Push-Ups',
    // ── Lunge variants ──
    'lunges': 'Walking Lunges',
    'db lunges': 'Walking Lunges',
    'dumbbell lunges': 'Walking Lunges',
    'forward lunges': 'Walking Lunges',
    'reverse lunge': 'Reverse Lunges',
    'db reverse lunge': 'Reverse Lunges',
    'step-ups': 'Step Ups',
    'step ups': 'Step Ups',
    'db step ups': 'Step Ups',
    'dumbbell step ups': 'Step Ups',
    // ── Isolation / Accessories ──
    'lateral raises': 'Lateral Raise',
    'side raises': 'Lateral Raise',
    'side lateral raise': 'Lateral Raise',
    'db lateral raise': 'Lateral Raise',
    'dumbbell lateral raise': 'Lateral Raise',
    'face pull': 'Face Pulls',
    'band face pull': 'Face Pulls',
    'cable face pull': 'Face Pulls',
    'rear delt fly': 'Face Pull (Rear Delts)',
    'rear delt flyes': 'Face Pull (Rear Delts)',
    'reverse fly': 'Face Pull (Rear Delts)',
    'barbell curl': 'Bicep Curl (Barbell)',
    'barbell curls': 'Bicep Curl (Barbell)',
    'bb curl': 'Bicep Curl (Barbell)',
    'ez bar curl': 'Bicep Curl (Barbell)',
    'bicep curl': 'Bicep Curl (Dumbbell)',
    'bicep curls': 'Bicep Curl (Dumbbell)',
    'db bicep curl': 'Bicep Curl (Dumbbell)',
    'dumbbell bicep curl': 'Bicep Curl (Dumbbell)',
    'hammer curls': 'Hammer Curl',
    'db hammer curl': 'Hammer Curl',
    'dumbbell hammer curl': 'Hammer Curl',
    'tricep pushdown': 'Cable Tricep Pushdown',
    'tricep pushdowns': 'Cable Tricep Pushdown',
    'cable pushdown': 'Cable Tricep Pushdown',
    'rope pushdown': 'Cable Tricep Pushdown',
    'tricep extension': 'Overhead Tricep Extension',
    'overhead extension': 'Overhead Tricep Extension',
    'skull crusher': 'Skull Crushers',
    'lying tricep extension': 'Skull Crushers',
    // ── Lower machine ──
    'leg curl': 'Leg Curls',
    'hamstring curl': 'Leg Curls',
    'lying leg curl': 'Leg Curls',
    'seated leg curl': 'Leg Curls',
    'calf raise': 'Calf Raises',
    'standing calf raise': 'Calf Raises',
    'seated calf raise': 'Calf Raises',
    'machine calf raise': 'Calf Raises',
    // ── Plyo ──
    'box jump': 'Box Jumps',
    'broad jump': 'Broad Jumps',
    'jump squat': 'Jump Squats',
    'squat jump': 'Jump Squats',
    'depth jump': 'Depth Jumps',
    'lateral bound': 'Lateral Bounds',
    // ── KB ──
    'kb swings': 'Kettlebell Swings',
    'kettlebell swing': 'Kettlebell Swings',
    'kb swing': 'Kettlebell Swings',
    // ── Core ──
    'pallof': 'Band Pallof Press',
    'pallof press': 'Band Pallof Press',
    'ab rollout': 'Ab Wheel',
    'ab wheel rollout': 'Ab Wheel',
    'hanging leg raises': 'Hanging Leg Raise',
    'leg raise': 'Hanging Leg Raise',
    'dead bug': 'Dead Bug (All Variations)',
    'dead bugs': 'Dead Bug (All Variations)',
    'woodchop': 'Cable or Band Woodchop',
    'cable woodchop': 'Cable or Band Woodchop',
    'cable woodchops': 'Cable or Band Woodchop',
    'band woodchop': 'Cable or Band Woodchop',
    'half-kneeling cable chop': 'Half-Kneeling Cable or Band Chop',
    'half-kneeling chop': 'Half-Kneeling Cable or Band Chop',
    'bird dogs': 'Bird Dog',
    // ── Misc ──
    'chest supported row': 'Chest Supported Row',
    'chest supported db row': 'Chest Supported DB Row',
    'incline db row': 'Chest Supported DB Row',
    'nordic curl': 'Nordic Curls',
    'nordic ham curl': 'Nordic Curls',
    'nordic hamstring curl': 'Nordic Curls',
    'single leg squat': 'Single-Leg Squat (to Box)',
    'pistol squat': 'Single-Leg Squat (to Box)',
    // ── Cable fly variants ──
    'cable fly': 'Cable Fly',
    'cable flyes': 'Cable Fly',
    'cable chest fly': 'Cable Chest Fly',
    'cable flys': 'Cable Fly',
    'cable crossover': 'Cable Fly',
    // ── Machine variants ──
    'leg extensions': 'Leg Extension',
    'machine leg extension': 'Leg Extension',
    'knee extension': 'Leg Extension',
    'hack squats': 'Hack Squat',
    'machine hack squat': 'Hack Squat',
    'machine chest press': 'Machine Chest Press',
    'chest press machine': 'Machine Chest Press',
    'pec deck': 'Pec Deck',
    'pec fly machine': 'Pec Deck',
    // ── Band Pull-Apart (without qualifier) ──
    'band pull-apart': 'Band Pull-Apart (delts)',
    'band pull apart': 'Band Pull-Apart (delts)',
    'band pull aparts': 'Band Pull-Apart (delts)',
    // ── Prehab / rehab aliases ──
    'tibialis raise': 'Tib Raise',
    'tibialis raises': 'Tib Raise',
    'tib raises': 'Tib Raise',
    'tib raise': 'Tib Raise',
    'banded ankle dorsiflexion': 'Banded Ankle Dorsiflexion',
    'copenhagen plank': 'Copenhagen Plank',
    'single-leg calf raise': 'Single-Leg Calf Raise',
    'single leg calf raise': 'Single-Leg Calf Raise',
    'nordic hamstring': 'Nordic Hamstring (Slow Lower)',
    'nordic eccentric': 'Nordic Hamstring (Slow Lower)',
    'inverted row': 'Inverted Row (Bodyweight)',
    'inverted rows': 'Inverted Rows',
    'bodyweight row': 'Inverted Row (Bodyweight)',
};
/**
 * Resolve an exercise name to its canonical form.
 * Tries: exact match → alias lookup → lowercase alias lookup.
 * Returns the original name if no match found.
 */
function resolveExerciseName(name) {
    // Exact match in load map or BW set
    if (exports.EXERCISE_LOAD_MAP[name] || exports.TRUE_BODYWEIGHT_EXERCISES.has(name))
        return name;
    // Try alias lookup
    const lower = name.toLowerCase().trim();
    if (EXERCISE_ALIASES[lower])
        return EXERCISE_ALIASES[lower];
    // Try without trailing 's' (pluralisation)
    if (lower.endsWith('s') && EXERCISE_ALIASES[lower.slice(0, -1)]) {
        return EXERCISE_ALIASES[lower.slice(0, -1)];
    }
    return name;
}
// ─── Prehab / Rehab Exercise Handling ───
//
// Small prehab and tissue-quality exercises should NOT get load estimates
// that imply false precision. Band work, BW mobility, foam rolling, etc.
// are better left without a weight — the UI shows "—" which is fine.
const PREHAB_NO_LOAD_EXERCISES = new Set([
    // Pool exercises that are inherently unloaded or band-only
    'Band Pull-Apart (delts)',
    'Band Pull-Apart', // Tags version (without qualifier)
    'Copenhagen Plank',
    'Single-Leg Calf Raise',
    'Tib Raise',
    'Tibialis Raise', // exercisePools uses this variant
    'Ankle Circles',
    'Dead Bug',
    'Bird Dog',
    'Side Plank',
    'Single-Leg RDL (Bodyweight)',
    // BW prehab / stability (exercisePools bodyweight-tagged)
    'Prone T Raise',
    'Wall Slide',
    'Side-Lying Adduction',
    'Sumo Squat Iso Hold',
    'Swiss Ball Hamstring Curl',
    'Banded Leg Curl',
    'Band Pallof Press',
    'Banded External Rotation',
    'Banded Ankle Dorsiflexion',
    'Banded Bicep Curl',
    'Banded Tricep Pushdown',
    'Band Adductor Squeeze',
    'Chin-Up Negative (Slow)',
    'Inverted Row (Bodyweight)',
    'Nordic Hamstring (Slow Lower)',
    // Tissue quality
    'Foam Roll — Quads & Hip Flexors',
    'Foam Roll — Quads, Glutes & Adductors', // exercisePools variant
    'Foam Roll — Calves & Outer Shins',
    'Foam Roll — Thoracic Spine & Lats',
    'Lacrosse Ball Glute Release',
    'Pec / Chest Doorway Stretch',
    // Mobility
    'Hip 90/90 Stretch',
    "World's Greatest Stretch",
    'Couch Stretch (Hip Flexor)',
    'Open Book Thoracic Rotation',
    'Pigeon Stretch',
    'Adductor Rockback',
    'Cat-Cow',
    'Deep Squat Hold',
    // Cardio / conditioning (recovery context)
    'Outdoor Walk',
    'Light Skipping',
    // Breathing
    'Crocodile Breathing',
    '90-90 Breathing',
    '90/90 Breathing', // exercisePools uses slash variant
    'Box Breathing',
    "Child's Pose with Breathing",
]);
// ─── Rounding ───
const ROUND_INCREMENTS = {
    barbell: 2.5,
    dumbbell: 2.5,
    cable: 5,
    machine: 5,
    kettlebell: 4, // KBs come in 4kg jumps (8, 12, 16, 20, 24...)
    bodyweight: 0,
};
/** Round a weight to the nearest equipment-appropriate increment. */
function roundToEquipment(weight, equipment) {
    const inc = ROUND_INCREMENTS[equipment];
    if (inc <= 0)
        return Math.round(weight);
    return Math.round(weight / inc) * inc;
}
// ─── Minimums ───
const MIN_WEIGHTS = {
    barbell: 20, // Empty Olympic bar
    dumbbell: 5, // Lightest useful DB
    cable: 5, // One plate
    machine: 10, // Lightest useful machine load
    kettlebell: 8, // Lightest standard KB
    bodyweight: 0,
};
// ─── Public API ───
/**
 * Estimate a starting working weight for a named exercise.
 *
 * Resolution order:
 *   1. Resolve name aliases (AI phrasing → canonical name)
 *   2. Check true bodyweight set → null
 *   3. Check prehab/no-load set → null
 *   4. Look up EXERCISE_LOAD_MAP → calculated weight
 *   5. Fall back to tag-based heuristic
 *
 * @returns weight in kg, or null if the exercise is genuinely bodyweight / unloaded.
 */
function estimateStartingWeight(exerciseName, onboardingData) {
    const resolved = resolveExerciseName(exerciseName);
    // True bodyweight exercises always return null
    if (exports.TRUE_BODYWEIGHT_EXERCISES.has(resolved))
        return null;
    // Prehab / rehab / tissue work — no fake precision
    if (PREHAB_NO_LOAD_EXERCISES.has(resolved))
        return null;
    const anchors = estimateAnchors(onboardingData);
    const profile = exports.EXERCISE_LOAD_MAP[resolved];
    if (profile) {
        if (profile.equipment === 'bodyweight')
            return null;
        const anchor1RM = profile.anchor === 'squat' ? anchors.squat1RM : anchors.bench1RM;
        const raw = anchor1RM * profile.ratio;
        const rounded = roundToEquipment(raw, profile.equipment);
        return Math.max(rounded, MIN_WEIGHTS[profile.equipment]);
    }
    // ── Fallback: use exercise tags to make a reasonable guess ──
    return estimateFromTags(resolved, anchors);
}
/**
 * Heuristic fallback for exercises not in EXERCISE_LOAD_MAP.
 * Uses exercise tags (movement pattern, region, load level) to pick
 * a conservative starting weight.
 */
function estimateFromTags(exerciseName, anchors) {
    const tags = exerciseTags_1.EXERCISE_TAGS[exerciseName];
    if (!tags) {
        // No tags — try name-pattern heuristic before giving up
        return estimateFromNamePattern(exerciseName, anchors);
    }
    // Plyo → always bodyweight
    if (tags.movement === 'plyo')
        return null;
    // Core → mostly bodyweight or very light
    if (tags.movement === 'core') {
        if (tags.load === 'low')
            return null; // Likely true BW core
        return 10;
    }
    // Conditioning → no weight
    if (tags.movement === 'conditioning')
        return null;
    // Choose anchor based on region
    const anchor1RM = tags.region === 'lower' || tags.region === 'full'
        ? anchors.squat1RM
        : anchors.bench1RM;
    // Approximate ratio by load level
    const loadRatios = {
        high: 0.65,
        moderate: 0.35,
        low: 0.15,
    };
    const ratio = loadRatios[tags.load] || 0.25;
    // Determine equipment class from the exercise's known equipment
    let equipment = 'barbell';
    if (tags.load === 'low')
        equipment = 'dumbbell';
    if (tags.unilateral)
        equipment = 'dumbbell';
    const raw = anchor1RM * ratio;
    const rounded = roundToEquipment(raw, equipment);
    return Math.max(rounded, MIN_WEIGHTS[equipment]);
}
/**
 * Last-resort heuristic for completely unknown exercises (no tags, no map entry).
 * Parses the exercise name for common movement keywords and picks
 * a conservative anchor + ratio. Better than a flat number because it
 * scales with the athlete's strength level.
 *
 * Returns null for anything that looks like BW / conditioning.
 * Returns a conservative moderate weight as absolute fallback.
 */
function estimateFromNamePattern(exerciseName, anchors) {
    const lower = exerciseName.toLowerCase();
    const patterns = [
        // Heavy compounds — squat-anchored
        [/squat|deadlift|clean|snatch/, { anchor: 'squat', ratio: 0.65, equipment: 'barbell' }],
        [/lunge|split|step.?up/, { anchor: 'squat', ratio: 0.18, equipment: 'dumbbell' }],
        [/leg.?press|hack/, { anchor: 'squat', ratio: 0.80, equipment: 'machine' }],
        [/leg.?curl|hamstring/, { anchor: 'squat', ratio: 0.25, equipment: 'machine' }],
        [/leg.?ext|knee.?ext/, { anchor: 'squat', ratio: 0.30, equipment: 'machine' }],
        [/calf/, { anchor: 'squat', ratio: 0.45, equipment: 'machine' }],
        [/hip.?thrust|glute.?bridge/, { anchor: 'squat', ratio: 0.65, equipment: 'barbell' }],
        // Heavy compounds — bench-anchored
        [/bench|chest.?press|floor.?press/, { anchor: 'bench', ratio: 0.65, equipment: 'barbell' }],
        [/overhead.?press|shoulder.?press|military/, { anchor: 'bench', ratio: 0.50, equipment: 'barbell' }],
        [/row/, { anchor: 'bench', ratio: 0.55, equipment: 'barbell' }],
        [/pull.?down|pulldown/, { anchor: 'bench', ratio: 0.50, equipment: 'cable' }],
        // Isolation — bench-anchored
        [/fly|flye|crossover|pec/, { anchor: 'bench', ratio: 0.15, equipment: 'cable' }],
        [/curl/, { anchor: 'bench', ratio: 0.12, equipment: 'dumbbell' }],
        [/tricep|pushdown|extension|skull|crush/, { anchor: 'bench', ratio: 0.15, equipment: 'cable' }],
        [/raise|lateral|delt/, { anchor: 'bench', ratio: 0.09, equipment: 'dumbbell' }],
        [/shrug/, { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' }],
        [/face.?pull|rear.?delt/, { anchor: 'bench', ratio: 0.15, equipment: 'cable' }],
        // Carries
        [/carry|farmer|suitcase/, { anchor: 'squat', ratio: 0.25, equipment: 'dumbbell' }],
    ];
    for (const [pattern, match] of patterns) {
        if (pattern.test(lower)) {
            const anchor1RM = match.anchor === 'squat' ? anchors.squat1RM : anchors.bench1RM;
            const raw = anchor1RM * match.ratio;
            const rounded = roundToEquipment(raw, match.equipment);
            return Math.max(rounded, MIN_WEIGHTS[match.equipment]);
        }
    }
    // ── BW / conditioning keywords → no weight ──
    // Checked AFTER patterns so "Farmers Walk" matches carry pattern, not "walk"
    const bwKeywords = ['run', 'sprint', 'jog', 'walk', 'plank', 'stretch', 'foam', 'mobility', 'breathing', 'jump', 'bound', 'skip'];
    if (bwKeywords.some(kw => lower.includes(kw)))
        return null;
    // Absolute last resort — a conservative moderate dumbbell weight
    // scaled to bodyweight. Better than a fixed 20kg for all athletes.
    const fallback = roundToEquipment(anchors.bodyweightKg * 0.15, 'dumbbell');
    return Math.max(fallback, MIN_WEIGHTS.dumbbell);
}
/**
 * Check if an exercise is genuinely bodyweight-based.
 * Uses name resolution → explicit BW set → prehab set → tag fallback.
 */
function isTrueBodyweightExercise(exerciseName) {
    const resolved = resolveExerciseName(exerciseName);
    if (exports.TRUE_BODYWEIGHT_EXERCISES.has(resolved))
        return true;
    if (PREHAB_NO_LOAD_EXERCISES.has(resolved))
        return true;
    // Fallback: check exercise tags for plyo or conditioning patterns
    const tags = exerciseTags_1.EXERCISE_TAGS[resolved];
    if (tags) {
        if (tags.movement === 'plyo')
            return true;
        if (tags.movement === 'conditioning')
            return true;
    }
    // Name-pattern catch-all for obvious BW movements the AI might invent
    const lower = resolved.toLowerCase();
    if (/push.?up|pull.?up|chin.?up|dip(?:s|$)|plank|burpee/.test(lower))
        return true;
    return false;
}
/**
 * Apply load estimates to an array of workout exercises.
 * Fills in weight for any exercise that has weight=0 or undefined
 * and is NOT a true bodyweight exercise.
 *
 * Priority order for each exercise:
 *   1. lastPerformedWeights (athlete's actual history) — best signal
 *   2. Existing template weight (if > 0) — keep it
 *   3. Onboarding-derived estimate — intelligent default
 *   4. Leave as-is (true BW / prehab / unknown)
 *
 * Pure function — returns a new array without mutating the input.
 *
 * @param exercises         - Exercises to process
 * @param onboardingData    - Athlete profile for estimation
 * @param lastPerformedWeights - Optional map of exerciseId → last performed weight.
 *                               Prioritised over estimates when available.
 */
function applyLoadEstimates(exercises, onboardingData, lastPerformedWeights) {
    return exercises.map(ex => {
        const name = ex.exercise?.name || '';
        // If it's true bodyweight / prehab, leave it as-is
        if (isTrueBodyweightExercise(name))
            return ex;
        // Priority 1: athlete's actual performed weight from history
        if (lastPerformedWeights && ex.exerciseId in lastPerformedWeights) {
            const performed = lastPerformedWeights[ex.exerciseId];
            if (performed !== null && performed !== undefined && performed > 0) {
                return { ...ex, prescribedWeightKg: performed };
            }
        }
        // Priority 2: if the exercise already has a real weight, keep it
        const hasWeight = ex.prescribedWeightKg && ex.prescribedWeightKg > 0;
        if (hasWeight)
            return ex;
        // Priority 3: estimate from onboarding data
        const estimated = estimateStartingWeight(name, onboardingData);
        if (estimated === null || estimated <= 0)
            return ex;
        return { ...ex, prescribedWeightKg: estimated };
    });
}
