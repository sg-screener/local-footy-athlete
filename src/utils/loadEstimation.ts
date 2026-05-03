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

import type { OnboardingData, SquatStrength, BenchStrength } from '../types/domain';
import { EXERCISE_TAGS } from '../data/exerciseTags';

// ─── Constants ───

const DEFAULT_BODYWEIGHT_KG = 82; // Average AFL player if not provided

// ─── Anchor 1RM Estimation ───

/**
 * Convert a categorical squat strength level to an estimated 1RM multiplier
 * relative to bodyweight. Conservative — better to start light.
 */
const SQUAT_MULTIPLIERS: Record<SquatStrength, number> = {
  "I don't squat":       0.6,
  'Less than bodyweight': 0.8,
  'Around bodyweight':    1.0,
  '1.5x bodyweight':     1.5,
  '2x bodyweight+':      2.0,
  'Not sure':            0.8,
};

const BENCH_MULTIPLIERS: Record<BenchStrength, number> = {
  "I don't bench":        0.4,
  'Less than bodyweight': 0.65,
  'Around bodyweight':    1.0,
  '1.25x bodyweight':    1.25,
  '1.5x bodyweight+':    1.5,
  'Not sure':            0.65,
};

export interface AnchorEstimates {
  bodyweightKg: number;
  squat1RM: number;
  bench1RM: number;
}

/**
 * Derive numeric 1RM estimates from onboarding data.
 * Returns conservative estimates — starting too light is always better than too heavy.
 */
export function estimateAnchors(data: OnboardingData): AnchorEstimates {
  const bw = data.weightKg || DEFAULT_BODYWEIGHT_KG;
  const squatMul = SQUAT_MULTIPLIERS[data.squatStrength || 'Not sure'];
  const benchMul = BENCH_MULTIPLIERS[data.benchStrength || 'Not sure'];

  return {
    bodyweightKg: bw,
    squat1RM: bw * squatMul,
    bench1RM: bw * benchMul,
  };
}

// ─── Exercise Classification ───

export type LoadAnchor = 'squat' | 'bench';
export type EquipmentClass = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell';

export interface ExerciseLoadProfile {
  /** Which anchor 1RM to derive from */
  anchor: LoadAnchor;
  /** Fraction of anchor 1RM → working weight (NOT a 1RM percentage) */
  ratio: number;
  /** Equipment type — determines rounding increment */
  equipment: EquipmentClass;
}

/**
 * Exercises that are genuinely bodyweight-based.
 * These should show "BW" in the UI. Everything else gets a load estimate.
 */
export const TRUE_BODYWEIGHT_EXERCISES = new Set([
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
  'Nordic Lower',
  // Conditioning / cardio (no external load)
  'Sprint Intervals',
  'Tempo Run',
  'Hill Sprints',
  'Quality Sprints',
  'MAS Training',
  'Flush Run',
  'Long Run',
  // Recovery / mobility (no load)
  'Dead Bug',
  'McGill Sit Up',
  'Bird Dog',
  'Side Plank',
  'Ab Wheel',
  'Dead Hang',
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
export const EXERCISE_LOAD_MAP: Record<string, ExerciseLoadProfile> = {
  // ═══ LOWER BODY — BARBELL PRIMARY ═══
  'Back Squat':           { anchor: 'squat', ratio: 0.82, equipment: 'barbell' },
  'Front Squat':          { anchor: 'squat', ratio: 0.70, equipment: 'barbell' },
  'Box Squat':            { anchor: 'squat', ratio: 0.75, equipment: 'barbell' },
  'Deadlift':             { anchor: 'squat', ratio: 1.00, equipment: 'barbell' },
  'Trap Bar Deadlift':    { anchor: 'squat', ratio: 0.90, equipment: 'barbell' },
  'RDLs':                 { anchor: 'squat', ratio: 0.65, equipment: 'barbell' },
  'Hip Thrusts':          { anchor: 'squat', ratio: 0.70, equipment: 'barbell' },

  // ═══ LOWER BODY — DUMBBELL / UNILATERAL ═══
  'Bulgarian Split Squats': { anchor: 'squat', ratio: 0.22, equipment: 'dumbbell' },
  'Walking Lunges':         { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  'Reverse Lunges':         { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  'Step Ups':               { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  'Goblet Squat':           { anchor: 'squat', ratio: 0.22, equipment: 'dumbbell' },
  'Single-Leg RDL':         { anchor: 'squat', ratio: 0.15, equipment: 'dumbbell' },
  'Kettlebell Swings':      { anchor: 'squat', ratio: 0.20, equipment: 'kettlebell' },

  // ═══ LOWER BODY — MACHINE ═══
  'Leg Press':              { anchor: 'squat', ratio: 1.30, equipment: 'machine' },
  'Single-Leg Leg Press':   { anchor: 'squat', ratio: 0.60, equipment: 'machine' },
  'Calf Raises':            { anchor: 'squat', ratio: 0.50, equipment: 'machine' },

  // ═══ UPPER BODY — BARBELL PRIMARY ═══
  'Bench Press':            { anchor: 'bench', ratio: 0.82, equipment: 'barbell' },
  'Incline Bench':          { anchor: 'bench', ratio: 0.72, equipment: 'barbell' },
  'Close Grip Bench':       { anchor: 'bench', ratio: 0.75, equipment: 'barbell' },
  'Overhead Press':         { anchor: 'bench', ratio: 0.58, equipment: 'barbell' },
  'Barbell Row':            { anchor: 'bench', ratio: 0.70, equipment: 'barbell' },
  'Speed Bench':            { anchor: 'bench', ratio: 0.55, equipment: 'barbell' },
  'Bicep Curl (Barbell)':   { anchor: 'bench', ratio: 0.30, equipment: 'barbell' },

  // ═══ UPPER BODY — DUMBBELL ═══
  'DB Bench Press':           { anchor: 'bench', ratio: 0.32, equipment: 'dumbbell' },
  'Incline DB Bench':         { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
  'DB Shoulder Press':        { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
  'Seated DB Press':          { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
  'Half-Kneeling Single-Arm Overhead Press': { anchor: 'bench', ratio: 0.18, equipment: 'dumbbell' },
  'Single-Arm DB Row':        { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
  'Single-Arm DB Bench Press': { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
  'Single-Arm DB Floor Press': { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
  'Lateral Raise':            { anchor: 'bench', ratio: 0.09, equipment: 'dumbbell' },

  // ═══ UPPER BODY — CABLE / MACHINE ═══
  'Seated Cable Row':         { anchor: 'bench', ratio: 0.50, equipment: 'cable' },
  'Lat Pulldown':             { anchor: 'bench', ratio: 0.55, equipment: 'cable' },
  'Single-Arm Lat Pulldown':  { anchor: 'bench', ratio: 0.30, equipment: 'cable' },
  'Face Pull':                { anchor: 'bench', ratio: 0.18, equipment: 'cable' },
  'Cable Face Pull':          { anchor: 'bench', ratio: 0.18, equipment: 'cable' },
  'Chest Supported Row':      { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' },
  'Landmine Press':           { anchor: 'bench', ratio: 0.35, equipment: 'barbell' },
  'Explosive Landmine Press': { anchor: 'bench', ratio: 0.25, equipment: 'barbell' },

  // ═══ CORE (low load — most are BW but some use cable/band) ═══
  'Woodchop (Standing)':      { anchor: 'bench', ratio: 0.12, equipment: 'cable' },
  'Woodchop (Half Kneeling)': { anchor: 'bench', ratio: 0.10, equipment: 'cable' },
  'Hanging Leg Raise':        { anchor: 'bench', ratio: 0.00, equipment: 'bodyweight' }, // True BW
  'Weighted Dead Bug':        { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },

  // ═══ ARMS / PUMP (pool exercises from derived sessions) ═══
  'Bicep Curl (Dumbbell)':      { anchor: 'bench', ratio: 0.15, equipment: 'dumbbell' },
  'Hammer Curl':                { anchor: 'bench', ratio: 0.12, equipment: 'dumbbell' },
  'Incline Dumbbell Curl':      { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
  'Lying Dumbbell Curl':        { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
  'Concentration Curl':         { anchor: 'bench', ratio: 0.08, equipment: 'dumbbell' },
  'Tricep Pushdown':            { anchor: 'bench', ratio: 0.20, equipment: 'cable' },
  'Overhead Tricep Extension':  { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
  'Skull Crushers':             { anchor: 'bench', ratio: 0.18, equipment: 'dumbbell' },  // Usually EZ bar or DBs, not full barbell
  'Dumbbell Skull Crusher':     { anchor: 'bench', ratio: 0.14, equipment: 'dumbbell' },
  'Dumbbell Kickback':          { anchor: 'bench', ratio: 0.08, equipment: 'dumbbell' },
  'Tricep Circuit (Dirty 30)':  { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
  'Rear Delt Fly':              { anchor: 'bench', ratio: 0.09, equipment: 'dumbbell' },
  'Incline Y Raise':            { anchor: 'bench', ratio: 0.07, equipment: 'dumbbell' },
  'Chest Supported DB Row':     { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
  'Chest-Supported DB Row':     { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
  'Shrugs':                     { anchor: 'bench', ratio: 0.30, equipment: 'dumbbell' },
  'Single-Arm Shrug':           { anchor: 'bench', ratio: 0.18, equipment: 'dumbbell' },

  // ═══ COMMON GYM EXERCISES (missing from original map) ═══
  'Cable Fly':                  { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
  'Cable Chest Fly':            { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
  'Leg Extension':              { anchor: 'squat', ratio: 0.30, equipment: 'machine' },
  'Hack Squat':                 { anchor: 'squat', ratio: 0.80, equipment: 'machine' },
  'Machine Chest Press':        { anchor: 'bench', ratio: 0.65, equipment: 'machine' },
  'Pec Deck':                   { anchor: 'bench', ratio: 0.30, equipment: 'machine' },
};

// ─── Exercise Name Aliases ───
//
// AI-generated programs often use different phrasing for the same exercise.
// This map normalises common variants to the canonical names used in
// EXERCISE_LOAD_MAP and TRUE_BODYWEIGHT_EXERCISES.
//
// Keys are lowercase. Lookup is: lowercase(input) → canonical name.

const EXERCISE_ALIASES: Record<string, string> = {
  // ── Bench variants ──
  'flat bench press':         'Bench Press',
  'barbell bench press':      'Bench Press',
  'bb bench press':           'Bench Press',
  'flat bench':               'Bench Press',
  'db bench':                 'DB Bench Press',
  'dumbbell bench press':     'DB Bench Press',
  'flat db press':            'DB Bench Press',
  'flat db bench':            'DB Bench Press',
  'dumbbell bench':           'DB Bench Press',
  'neutral grip db press':    'DB Bench Press',
  'db incline press':         'Incline DB Bench',
  'incline dumbbell press':   'Incline DB Bench',
  'incline dumbbell bench':   'Incline DB Bench',
  'incline db press':         'Incline DB Bench',
  'db incline bench':         'Incline DB Bench',
  'dumbbell incline press':   'Incline DB Bench',
  'incline barbell bench':    'Incline Bench',
  'incline barbell press':    'Incline Bench',
  'barbell incline press':    'Incline Bench',
  'close-grip bench press':   'Close Grip Bench',
  'close-grip bench':         'Close Grip Bench',
  'cgbp':                     'Close Grip Bench',

  // ── Squat variants ──
  'barbell squat':            'Back Squat',
  'barbell back squat':       'Back Squat',
  'high bar squat':           'Back Squat',
  'low bar squat':            'Back Squat',
  'bb squat':                 'Back Squat',
  'goblet squats':            'Goblet Squat',
  'db goblet squat':          'Goblet Squat',
  'dumbbell goblet squat':    'Goblet Squat',
  'split squats':             'Bulgarian Split Squats',
  'rear foot elevated split squat': 'Bulgarian Split Squats',
  'rfess':                    'Bulgarian Split Squats',
  'bulgarian split squat':    'Bulgarian Split Squats',
  'db split squat':           'Bulgarian Split Squats',

  // ── Deadlift / Hinge variants ──
  'conventional deadlift':    'Deadlift',
  'barbell deadlift':         'Deadlift',
  'hex bar deadlift':         'Trap Bar Deadlift',
  'romanian deadlift':        'RDLs',
  'rdl':                      'RDLs',
  'barbell rdl':              'RDLs',
  'db rdl':                   'Single-Leg RDL',   // DB RDL usually means single-leg
  'single leg rdl':           'Single-Leg RDL',
  'single-leg romanian deadlift': 'Single-Leg RDL',
  'hip thrust':               'Hip Thrusts',
  'barbell hip thrust':       'Hip Thrusts',
  'bb hip thrust':            'Hip Thrusts',
  'glute bridge':             'Hip Thrusts',

  // ── Press variants ──
  'ohp':                      'Overhead Press',
  'strict press':             'Overhead Press',
  'military press':           'Overhead Press',
  'barbell overhead press':   'Overhead Press',
  'standing press':           'Overhead Press',
  'dumbbell shoulder press':  'DB Shoulder Press',
  'db press':                 'DB Shoulder Press',
  'seated db press':          'Seated DB Press',
  'seated dumbbell press':    'Seated DB Press',
  'seated overhead db press': 'Seated DB Press',
  'dumbbell press':           'DB Shoulder Press',
  'arnold press':             'DB Shoulder Press',
  'half-kneeling sa ohp':                   'Half-Kneeling Single-Arm Overhead Press',
  'half-kneeling single arm overhead press': 'Half-Kneeling Single-Arm Overhead Press',
  'half kneeling single arm overhead press': 'Half-Kneeling Single-Arm Overhead Press',
  'half-kneeling single-arm press':         'Half-Kneeling Single-Arm Overhead Press',

  // ── Row variants ──
  'bent-over row':            'Barbell Row',
  'bb row':                   'Barbell Row',
  'bent over barbell row':    'Barbell Row',
  'pendlay row':              'Barbell Row',
  'dumbbell row':             'Single-Arm DB Row',
  'db row':                   'Single-Arm DB Row',
  'one-arm db row':           'Single-Arm DB Row',
  'one arm dumbbell row':     'Single-Arm DB Row',
  'cable row':                'Seated Cable Row',
  'seated row':               'Seated Cable Row',

  // ── Pull variants ──
  'pull-up':                  'Pull-Ups',
  'pull up':                  'Pull-Ups',
  'pullup':                   'Pull-Ups',
  'pullups':                  'Pull-Ups',
  'chin-up':                  'Chin-Ups',
  'chin up':                  'Chin-Ups',
  'chinup':                   'Chin-Ups',
  'chinups':                  'Chin-Ups',
  'lat pulldowns':            'Lat Pulldown',
  'lat pull-down':            'Lat Pulldown',
  'wide grip pulldown':       'Lat Pulldown',
  'single arm lat pulldown':  'Single-Arm Lat Pulldown',
  'single-arm pulldown':      'Single-Arm Lat Pulldown',
  'single arm pulldown':      'Single-Arm Lat Pulldown',
  'one-arm lat pulldown':     'Single-Arm Lat Pulldown',
  'unilateral lat pulldown':  'Single-Arm Lat Pulldown',

  // ── Push-up / Dip variants ──
  'push-up':                  'Push-ups',
  'push up':                  'Push-ups',
  'pushup':                   'Push-ups',
  'pushups':                  'Push-ups',
  'dip':                      'Dips',
  'tricep dips':              'Dips',
  'chest dips':               'Dips',
  'parallel bar dips':        'Dips',
  'explosive push-ups':       'Explosive Push-Ups',
  'explosive push ups':       'Explosive Push-Ups',
  'explosive pushups':        'Explosive Push-Ups',
  'plyo push-ups':            'Explosive Push-Ups',
  'plyometric push-ups':      'Explosive Push-Ups',

  // ── Lunge variants ──
  'lunges':                   'Walking Lunges',
  'db lunges':                'Walking Lunges',
  'dumbbell lunges':          'Walking Lunges',
  'forward lunges':           'Walking Lunges',
  'reverse lunge':            'Reverse Lunges',
  'db reverse lunge':         'Reverse Lunges',
  'step-ups':                 'Step Ups',
  'step ups':                 'Step Ups',
  'db step ups':              'Step Ups',
  'dumbbell step ups':        'Step Ups',

  // ── Isolation / Accessories ──
  'lateral raises':           'Lateral Raise',
  'side raises':              'Lateral Raise',
  'side lateral raise':       'Lateral Raise',
  'db lateral raise':         'Lateral Raise',
  'dumbbell lateral raise':   'Lateral Raise',
  'face pull':                'Face Pull',
  'face pulls':               'Face Pull',
  'band face pull':           'Face Pull',
  'cable face pull':          'Cable Face Pull',
  'rear delt fly':            'Rear Delt Fly',
  'rear delt flyes':          'Rear Delt Fly',
  'reverse fly':              'Rear Delt Fly',
  'shrug':                    'Shrugs',
  'dumbbell shrugs':          'Shrugs',
  'db shrugs':                'Shrugs',
  'barbell shrugs':           'Shrugs',
  'single arm shrug':         'Single-Arm Shrug',
  'single-arm shrugs':        'Single-Arm Shrug',
  'y raise':                  'Incline Y Raise',
  'incline y raises':         'Incline Y Raise',
  'barbell curl':             'Bicep Curl (Barbell)',
  'barbell curls':            'Bicep Curl (Barbell)',
  'bb curl':                  'Bicep Curl (Barbell)',
  'ez bar curl':              'Bicep Curl (Barbell)',
  'bicep curl':               'Bicep Curl (Dumbbell)',
  'bicep curls':              'Bicep Curl (Dumbbell)',
  'db bicep curl':            'Bicep Curl (Dumbbell)',
  'dumbbell bicep curl':      'Bicep Curl (Dumbbell)',
  'hammer curls':             'Hammer Curl',
  'db hammer curl':           'Hammer Curl',
  'dumbbell hammer curl':     'Hammer Curl',
  'incline db curl':          'Incline Dumbbell Curl',
  'incline db curls':         'Incline Dumbbell Curl',
  'incline dumbbell curls':   'Incline Dumbbell Curl',
  'lying db curl':            'Lying Dumbbell Curl',
  'lying dumbbell curls':     'Lying Dumbbell Curl',
  'concentration curls':      'Concentration Curl',
  'tricep pushdown':          'Tricep Pushdown',
  'tricep pushdowns':         'Tricep Pushdown',
  'cable pushdown':           'Tricep Pushdown',
  'cable tricep pushdown':    'Tricep Pushdown',
  'rope pushdown':            'Tricep Pushdown',
  'rope tricep pushdown':     'Tricep Pushdown',
  'tricep extension':         'Overhead Tricep Extension',
  'overhead extension':       'Overhead Tricep Extension',
  'overhead tricep ext':      'Overhead Tricep Extension',
  'skull crusher':            'Skull Crushers',
  'lying tricep extension':   'Skull Crushers',
  'db skull crusher':         'Dumbbell Skull Crusher',
  'dumbbell skull crushers':  'Dumbbell Skull Crusher',
  'tricep kickback':          'Dumbbell Kickback',
  'tricep kickbacks':         'Dumbbell Kickback',
  'db kickback':              'Dumbbell Kickback',
  'dumbbell kickbacks':       'Dumbbell Kickback',
  'dumbbell tricep kickbacks':'Dumbbell Kickback',
  'dirty 30':                 'Tricep Circuit (Dirty 30)',

  // ── Lower machine ──
  'calf raise':               'Calf Raises',
  'standing calf raise':      'Calf Raises',
  'machine calf raise':       'Calf Raises',

  // ── Plyo ──
  'box jump':                 'Box Jumps',
  'broad jump':               'Broad Jumps',
  'jump squat':               'Jump Squats',
  'squat jump':               'Jump Squats',
  'depth jump':               'Depth Jumps',
  'lateral bound':            'Lateral Bounds',

  // ── KB ──
  'kb swings':                'Kettlebell Swings',
  'kettlebell swing':         'Kettlebell Swings',
  'kb swing':                 'Kettlebell Swings',

  // ── Core ──
  'pallof':                   'Band Pallof Press',
  'pallof press':             'Band Pallof Press',
  'ab rollout':               'Ab Wheel',
  'ab wheel rollout':         'Ab Wheel',
  'hanging leg raises':       'Hanging Leg Raise',
  'leg raise':                'Hanging Leg Raise',
  'dead bug':                 'Dead Bug',
  'dead bugs':                'Dead Bug',
  'dead bug (all variations)':'Dead Bug',
  'banded dead bug':          'Banded Dead Bug',
  'weighted dead bug':        'Weighted Dead Bug',
  'mcgill sit up':            'McGill Sit Up',
  'mcgill situp':             'McGill Sit Up',
  'mcgill sit-up':            'McGill Sit Up',
  'woodchop':                 'Woodchop (Standing)',
  'standing woodchop':        'Woodchop (Standing)',
  'cable woodchop':           'Woodchop (Standing)',
  'cable woodchops':          'Woodchop (Standing)',
  'band woodchop':            'Woodchop (Standing)',
  'cable or band woodchop':   'Woodchop (Standing)',
  'half-kneeling cable chop': 'Woodchop (Half Kneeling)',
  'half-kneeling chop':       'Woodchop (Half Kneeling)',
  'half kneeling woodchop':   'Woodchop (Half Kneeling)',
  'half-kneeling cable or band chop': 'Woodchop (Half Kneeling)',
  'side plank (weighted optional)': 'Side Plank',
  'bird dogs':                'Bird Dog',

  // ── Misc ──
  'chest supported row':      'Chest Supported Row',
  'chest supported db row':   'Chest Supported DB Row',
  'incline db row':           'Chest Supported DB Row',
  'nordic curl':              'Nordic Lower',
  'nordic curls':             'Nordic Lower',
  'nordic ham curl':          'Nordic Lower',
  'nordic hamstring curl':    'Nordic Lower',
  'nordic lower':             'Nordic Lower',
  'nordic lowers':            'Nordic Lower',
  'single leg squat':         'Single-Leg Squat (to Box)',
  'pistol squat':             'Single-Leg Squat (to Box)',

  // ── Cable fly variants ──
  'cable fly':                  'Cable Fly',
  'cable flyes':                'Cable Fly',
  'cable chest fly':            'Cable Chest Fly',
  'cable flys':                 'Cable Fly',
  'cable crossover':            'Cable Fly',

  // ── Machine variants ──
  'leg extensions':             'Leg Extension',
  'machine leg extension':      'Leg Extension',
  'knee extension':             'Leg Extension',
  'hack squats':                'Hack Squat',
  'machine hack squat':         'Hack Squat',
  'machine chest press':        'Machine Chest Press',
  'chest press machine':        'Machine Chest Press',
  'pec deck':                   'Pec Deck',
  'pec fly machine':            'Pec Deck',

  // ── Band Pull-Apart ──
  'band pull-apart':            'Band Pull-Apart',
  'band pull apart':            'Band Pull-Apart',
  'band pull aparts':           'Band Pull-Apart',
  'band pull-aparts':           'Band Pull-Apart',

  // ── Prehab / rehab aliases ──
  'tibialis raise':             'Tib Raise',
  'tibialis raises':            'Tib Raise',
  'tib raises':                 'Tib Raise',
  'tib raise':                  'Tib Raise',
  'copenhagen plank':           'Copenhagen Plank',
  'single-leg calf raise':     'Single-Leg Calf Raise',
  'single leg calf raise':     'Single-Leg Calf Raise',
  'seated calf raise':         'Seated Calf Raise',
  'seated calf raises':        'Seated Calf Raise',
  'inverted row':               'Inverted Row (Bodyweight)',
  'inverted rows':              'Inverted Rows',
  'bodyweight row':             'Inverted Row (Bodyweight)',
  // ── Foam roll renames ──
  'foam roll quads':            'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll quads, glutes & adductors': 'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll — quads, glutes & adductors': 'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll quads & hip flexors': 'Foam Roll — Hip Flexor, Quad, Adductors',
  'foam roll thoracic spine':   'Foam Roll — T-Spine',
  'foam roll t-spine':          'Foam Roll — T-Spine',
  'foam roll — thoracic spine & lats': 'Foam Roll — T-Spine',
  'foam roll lats':             'Foam Roll — Lats',
  'foam roll it band':          'Foam Roll — IT Band',
  'foam roll itb':              'Foam Roll — IT Band',
  // ── Mobility renames ──
  'couch stretch':              'Couch Stretch',
  'couch stretch (hip flexor)': 'Couch Stretch',
  'pec doorway stretch':        'Chest / Pec Stretch (Doorway)',
  'pec / chest doorway stretch':'Chest / Pec Stretch (Doorway)',
  'doorway pec stretch':        'Chest / Pec Stretch (Doorway)',
  'chest doorway stretch':      'Chest / Pec Stretch (Doorway)',
  'lat stretch':                'Lat Stretch',
  'dead hang':                  'Dead Hang',
  'bar hang':                   'Dead Hang',
  'toe stretch':                'Toe Stretch',
  'calf stretch':               'Calf Stretch',
  'standing calf stretch':      'Calf Stretch',
  // ── Groin squeeze rename ──
  'band adductor squeeze':      'Groin Squeeze (Band Adductor)',
  'adductor squeeze':           'Groin Squeeze (Band Adductor)',
  'groin squeeze':              'Groin Squeeze (Band Adductor)',
};

/**
 * Resolve an exercise name to its canonical form.
 * Tries: exact match → alias lookup → lowercase alias lookup.
 * Returns the original name if no match found.
 */
export function resolveExerciseName(name: string): string {
  // Exact match in load map or BW set
  if (EXERCISE_LOAD_MAP[name] || TRUE_BODYWEIGHT_EXERCISES.has(name)) return name;

  // Try alias lookup
  const lower = name.toLowerCase().trim();
  if (EXERCISE_ALIASES[lower]) return EXERCISE_ALIASES[lower];

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
  'Band Pull-Apart',            // Single canonical (was: Band Pull-Apart (delts) + Band Pull-Aparts)
  'Copenhagen Plank',
  'Single-Leg Calf Raise',
  'Seated Calf Raise',
  'Tib Raise',
  'Tibialis Raise',             // exercisePools uses this variant
  'Dead Bug',
  'Banded Dead Bug',
  'McGill Sit Up',
  'Bird Dog',
  'Side Plank',
  'Ab Wheel',
  // BW prehab / stability (exercisePools bodyweight-tagged)
  'Swiss Ball Hamstring Curl',
  'Band Pallof Press',
  'Banded External Rotation',
  'Banded Bicep Curl',
  'Banded Tricep Pushdown',
  'Groin Squeeze (Band Adductor)',
  'Chin-Up Negative (Slow)',
  'Inverted Row (Bodyweight)',
  // Tissue quality
  'Foam Roll — Hip Flexor, Quad, Adductors',
  'Foam Roll — T-Spine',
  'Foam Roll — IT Band',
  'Foam Roll — Lats',
  'Foam Roll — Calves & Outer Shins',
  'Lacrosse Ball Glute Release',
  // Mobility
  'Hip 90/90 Stretch',
  "World's Greatest Stretch",
  'Couch Stretch',
  'Open Book Thoracic Rotation',
  'Pigeon Stretch',
  'Adductor Rockback',
  'Cat-Cow',
  'Deep Squat Hold',
  'Chest / Pec Stretch (Doorway)',
  'Lat Stretch',
  'Dead Hang',
  'Toe Stretch',
  'Calf Stretch',
  // Cardio / conditioning (recovery context)
  'Outdoor Walk',
  'Light Skipping',
  // Breathing
  'Crocodile Breathing',
  '90-90 Breathing',
  '90/90 Breathing',              // exercisePools uses slash variant
  'Box Breathing',
  "Child's Pose with Breathing",
]);

// ─── Rounding ───

const ROUND_INCREMENTS: Record<EquipmentClass, number> = {
  barbell: 2.5,
  dumbbell: 2.5,
  cable: 5,
  machine: 5,
  kettlebell: 4, // KBs come in 4kg jumps (8, 12, 16, 20, 24...)
  bodyweight: 0,
};

/** Round a weight to the nearest equipment-appropriate increment. */
export function roundToEquipment(weight: number, equipment: EquipmentClass): number {
  const inc = ROUND_INCREMENTS[equipment];
  if (inc <= 0) return Math.round(weight);
  return Math.round(weight / inc) * inc;
}

// ─── Minimums ───

const MIN_WEIGHTS: Record<EquipmentClass, number> = {
  barbell: 20,    // Empty Olympic bar
  dumbbell: 5,    // Lightest useful DB
  cable: 5,       // One plate
  machine: 10,    // Lightest useful machine load
  kettlebell: 8,  // Lightest standard KB
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
export function estimateStartingWeight(
  exerciseName: string,
  onboardingData: OnboardingData,
): number | null {
  const resolved = resolveExerciseName(exerciseName);

  // True bodyweight exercises always return null
  if (TRUE_BODYWEIGHT_EXERCISES.has(resolved)) return null;

  // Prehab / rehab / tissue work — no fake precision
  if (PREHAB_NO_LOAD_EXERCISES.has(resolved)) return null;

  const anchors = estimateAnchors(onboardingData);
  const profile = EXERCISE_LOAD_MAP[resolved];

  if (profile) {
    if (profile.equipment === 'bodyweight') return null;

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
function estimateFromTags(
  exerciseName: string,
  anchors: AnchorEstimates,
): number | null {
  const tags = EXERCISE_TAGS[exerciseName];
  if (!tags) {
    // No tags — try name-pattern heuristic before giving up
    return estimateFromNamePattern(exerciseName, anchors);
  }

  // Plyo → always bodyweight
  if (tags.movement === 'plyo') return null;

  // Core → mostly bodyweight or very light
  if (tags.movement === 'core') {
    if (tags.load === 'low') return null; // Likely true BW core
    return 10;
  }

  // Conditioning → no weight
  if (tags.movement === 'conditioning') return null;

  // Choose anchor based on region
  const anchor1RM = tags.region === 'lower' || tags.region === 'full'
    ? anchors.squat1RM
    : anchors.bench1RM;

  // Approximate ratio by load level
  const loadRatios: Record<string, number> = {
    high: 0.65,
    moderate: 0.35,
    low: 0.15,
  };
  const ratio = loadRatios[tags.load] || 0.25;

  // Determine equipment class from the exercise's known equipment
  let equipment: EquipmentClass = 'barbell';
  if (tags.load === 'low') equipment = 'dumbbell';
  if (tags.unilateral) equipment = 'dumbbell';

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
function estimateFromNamePattern(
  exerciseName: string,
  anchors: AnchorEstimates,
): number | null {
  const lower = exerciseName.toLowerCase();

  // ── Pattern → {anchor, ratio, equipment} ──
  // Checked BEFORE BW keywords so "Farmers Walk" matches carry, not "walk"
  type PatternMatch = { anchor: 'squat' | 'bench'; ratio: number; equipment: EquipmentClass };

  const patterns: [RegExp, PatternMatch][] = [
    // Heavy compounds — squat-anchored
    [/squat|deadlift|clean|snatch/,   { anchor: 'squat', ratio: 0.65, equipment: 'barbell' }],
    [/lunge|split|step.?up/,          { anchor: 'squat', ratio: 0.18, equipment: 'dumbbell' }],
    [/leg.?press|hack/,               { anchor: 'squat', ratio: 0.80, equipment: 'machine' }],
    [/leg.?curl|hamstring/,           { anchor: 'squat', ratio: 0.25, equipment: 'machine' }],
    [/leg.?ext|knee.?ext/,            { anchor: 'squat', ratio: 0.30, equipment: 'machine' }],
    [/calf/,                          { anchor: 'squat', ratio: 0.45, equipment: 'machine' }],
    [/hip.?thrust|glute.?bridge/,     { anchor: 'squat', ratio: 0.65, equipment: 'barbell' }],

    // Heavy compounds — bench-anchored
    [/bench|chest.?press|floor.?press/, { anchor: 'bench', ratio: 0.65, equipment: 'barbell' }],
    [/overhead.?press|shoulder.?press|military/, { anchor: 'bench', ratio: 0.50, equipment: 'barbell' }],
    [/row/,                           { anchor: 'bench', ratio: 0.55, equipment: 'barbell' }],
    [/pull.?down|pulldown/,           { anchor: 'bench', ratio: 0.50, equipment: 'cable' }],

    // Isolation — bench-anchored
    [/fly|flye|crossover|pec/,        { anchor: 'bench', ratio: 0.15, equipment: 'cable' }],
    [/curl/,                          { anchor: 'bench', ratio: 0.12, equipment: 'dumbbell' }],
    [/tricep|pushdown|extension|skull|crush/, { anchor: 'bench', ratio: 0.15, equipment: 'cable' }],
    [/raise|lateral|delt/,            { anchor: 'bench', ratio: 0.09, equipment: 'dumbbell' }],
    [/shrug/,                         { anchor: 'bench', ratio: 0.28, equipment: 'dumbbell' }],
    [/face.?pull|rear.?delt/,         { anchor: 'bench', ratio: 0.15, equipment: 'cable' }],

    // Carries
    [/carry|farmer|suitcase/,         { anchor: 'squat', ratio: 0.25, equipment: 'dumbbell' }],
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
  if (bwKeywords.some(kw => lower.includes(kw))) return null;

  // Absolute last resort — a conservative moderate dumbbell weight
  // scaled to bodyweight. Better than a fixed 20kg for all athletes.
  const fallback = roundToEquipment(anchors.bodyweightKg * 0.15, 'dumbbell');
  return Math.max(fallback, MIN_WEIGHTS.dumbbell);
}

/**
 * Check if an exercise is genuinely bodyweight-based.
 * Uses name resolution → explicit BW set → prehab set → tag fallback.
 */
export function isTrueBodyweightExercise(exerciseName: string): boolean {
  const resolved = resolveExerciseName(exerciseName);

  if (TRUE_BODYWEIGHT_EXERCISES.has(resolved)) return true;
  if (PREHAB_NO_LOAD_EXERCISES.has(resolved)) return true;

  // Fallback: check exercise tags for plyo or conditioning patterns
  const tags = EXERCISE_TAGS[resolved];
  if (tags) {
    if (tags.movement === 'plyo') return true;
    if (tags.movement === 'conditioning') return true;
  }

  // Name-pattern catch-all for obvious BW movements the AI might invent
  const lower = resolved.toLowerCase();
  if (/push.?up|pull.?up|chin.?up|dip(?:s|$)|plank|burpee/.test(lower)) return true;

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
export function applyLoadEstimates(
  exercises: import('../types/domain').WorkoutExercise[],
  onboardingData: OnboardingData,
  lastPerformedWeights?: Record<string, number | null>,
): import('../types/domain').WorkoutExercise[] {
  return exercises.map(ex => {
    const name = ex.exercise?.name || '';

    // If it's true bodyweight / prehab, leave it as-is
    if (isTrueBodyweightExercise(name)) return ex;

    // Priority 1: athlete's actual performed weight from history
    if (lastPerformedWeights && ex.exerciseId in lastPerformedWeights) {
      const performed = lastPerformedWeights[ex.exerciseId];
      if (performed !== null && performed !== undefined && performed > 0) {
        return { ...ex, prescribedWeightKg: performed };
      }
    }

    // Priority 2: if the exercise already has a real weight, keep it
    const hasWeight = ex.prescribedWeightKg && ex.prescribedWeightKg > 0;
    if (hasWeight) return ex;

    // Priority 3: estimate from onboarding data
    const estimated = estimateStartingWeight(name, onboardingData);
    if (estimated === null || estimated <= 0) return ex;

    return { ...ex, prescribedWeightKg: estimated };
  });
}
