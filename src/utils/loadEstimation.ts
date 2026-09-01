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
import type { ExperienceLevel } from '../types/domain';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import {
  isSeatedGoodMorningIdentity,
  seatedGoodMorningVariantAllowsExperience,
} from '../rules/seatedGoodMorningVariants';
import {
  BENCH_ANCHOR_MULTIPLIERS,
  SQUAT_ANCHOR_MULTIPLIERS,
} from '../data/anchorMultipliers';
import {
  EQUIPMENT,
  normaliseAutomaticLoadChange,
  prescribableWeight,
  roundDownToLattice,
  type AutomaticLoadKind,
  type EquipmentKind,
} from '../data/equipmentLattice';

// ─── Anchor 1RM Estimation ───
//
// The multiplier ladders are AUTHORED and live in `data/anchorMultipliers` —
// Sam ruled them 2026-07-28. They are not restated here: one owner, so a change
// to the ruling cannot leave a stale copy behind in this module.

export interface AnchorEstimates {
  bodyweightKg: number;
  squat1RM: number;
  bench1RM: number;
}

/**
 * Derive 1RM anchors from onboarding data, or REFUSE.
 *
 * FAIL LOUD (Sam, 2026-07-28): "Missing bodyweight: FAIL LOUD, no default."
 * This used to substitute `DEFAULT_BODYWEIGHT_KG = 82` ("average AFL player").
 * That number was a guess about the athlete's body which then prescribed every
 * load in the app — the whole chain hangs off it. With no recorded bodyweight
 * there is no anchor, so nothing is prescribed and the card shows "—".
 *
 * Same principle as the render-truth "BW", applied at the top of the chain
 * rather than the bottom: absence renders as absence.
 *
 * Rarely reached now — onboarding requires a bodyweight in 30–200 kg before it
 * will advance — but still reachable for profiles created before that gate.
 *
 * @returns the anchors, or null when no bodyweight is recorded.
 */
export function estimateAnchors(data: OnboardingData): AnchorEstimates | null {
  const bw = data.weightKg;
  if (!bw || bw <= 0) return null;

  const squatMul = SQUAT_ANCHOR_MULTIPLIERS[data.squatStrength || 'Not sure'];
  const benchMul = BENCH_ANCHOR_MULTIPLIERS[data.benchStrength || 'Not sure'];

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
  'Seated Single-Leg Pike Lift',
  'Standing Knee Extension',
  'Horse Stance Hold',
  'Seated Good Morning',
  'SL 45° Back Extension',
  'SL 45° Back Extension Hold',
  'Reverse Nordic Curl',
  // Upper body BW
  'Pull-Ups',
  'Chin-Ups',
  'Push-ups',
  'Explosive Push-up',
  'Dips',
  'Scap Push-Up',
  'Scap Pull Ups',
  'Inverted Row (Bodyweight)',
  'Chin-Up Negative (Slow)',
  'Bodyweight Squat',
  'Glute Bridge',
  'Plank',
  'Hollow Hold',
  'Dragon Flag',
  'Stir the Pot',
  // Lower body BW / plyo
  'Vertical Jump',
  'Box Jumps',
  'Broad Jumps',
  'Jump Squats',
  'Lateral Bounds',
  'RFE Split Squat Jump',
  'Depth Jumps',
  // Sam's locked list (2026-07-24): bodyweight additions.
  'Cossack Squat',
  'Lateral Lunge',
  'ATG Split Squat',
  'Pogo Hops',
  'Kneeling Jump',
  'Lateral Jump',
  'Slant Board Step-Down',
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
  'Back Squat':           { anchor: 'squat', ratio: 0.8, equipment: 'barbell' },
  'Front Squat':          { anchor: 'squat', ratio: 0.5, equipment: 'barbell' },
  'Box Squat':            { anchor: 'squat', ratio: 0.9, equipment: 'barbell' },
  // Sam, 2026-07-25: High Box Squat is 1.2 x Box Squat — a higher box is a
  // shorter range, so heavier, not lighter. 0.75 x 1.2 = 0.90.
  'High Box Squat':       { anchor: 'squat', ratio: 1.08, equipment: 'barbell' },
  'Deadlift':             { anchor: 'squat', ratio: 0.75, equipment: 'barbell' },
  'Trap Bar Deadlift':    { anchor: 'squat', ratio: 0.90, equipment: 'barbell' },
  'RDLs':                 { anchor: 'squat', ratio: 0.65, equipment: 'barbell' },
  'Hip Thrusts':          { anchor: 'squat', ratio: 0.70, equipment: 'barbell' },

  // ═══ LOWER BODY — DUMBBELL / UNILATERAL ═══
  'Bulgarian Split Squats': { anchor: 'squat', ratio: 0.2, equipment: 'dumbbell' },
  'Walking Lunges':         { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  'Reverse Lunges':         { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  'Step Ups':               { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  'Goblet Squat':           { anchor: 'squat', ratio: 0.22, equipment: 'dumbbell' },
  'Bodyweight Squat':       { anchor: 'squat', ratio: 0.00, equipment: 'bodyweight' },
  // Glute Bridge deliberately has NO profile: Sam ruled it
  // bodyweight-with-optional (2026-07-25). It sits in
  // TRUE_BODYWEIGHT_EXERCISES, which short-circuits before this map is read,
  // so a 0.00 entry here was a second representation of the same fact. The
  // cue's "add weight to hips if you can" is the whole instruction.
  'Single-Leg RDL':         { anchor: 'squat', ratio: 0.15, equipment: 'dumbbell' },
  'Kettlebell Swings':      { anchor: 'squat', ratio: 0.20, equipment: 'kettlebell' },

  // ═══ LOWER BODY — MACHINE ═══
  'Leg Press':              { anchor: 'squat', ratio: 1.0, equipment: 'machine' },

  // ═══ CARRIES — stored and displayed PER HAND (Sam, 2026-07-24) ═══
  // Farmer's total is 0.71 x bench across both hands; the number the athlete
  // sees is one hand's worth. Suitcase is a single dumbbell at the same
  // per-hand load. Their cues state this.
  'Farmer Carry':           { anchor: 'bench', ratio: 0.4, equipment: 'dumbbell' },
  'Suitcase Carry':         { anchor: 'bench', ratio: 0.4, equipment: 'dumbbell' },
  'Overhead Carry':         { anchor: 'bench', ratio: 0.20, equipment: 'dumbbell' },

  // ═══ SAM'S LOCKED-LIST LOAD RULINGS (2026-07-25) ═══
  'Single-Leg Hip Thrust':  { anchor: 'squat', ratio: 0.20, equipment: 'dumbbell' },
  // NOTE: 'machine' rounds to 5 kg increments, so this surfaces 25 kg at Sam's
  // reference athlete rather than the 22.5 kg his note quotes. Re-classing it as
  // 'dumbbell' would hit 22.5 but would also mis-gate equipment availability —
  // a leg-curl stack is not a dumbbell. Flagged in the report; ratio ships as ruled.
  'Hamstring Curl':         { anchor: 'squat', ratio: 0.25, equipment: 'machine' },
  'Back Extension':         { anchor: 'squat', ratio: 0.15, equipment: 'dumbbell' },
  // 40 kg reference (~0.45 x squat). Pool placement still owned by the power unit.
  'Speed Trap Bar Deadlift': { anchor: 'squat', ratio: 0.45, equipment: 'barbell' },

  // ═══ MACHINE / ACCESSORY ADDITIONS (Sam, 2026-07-24) ═══
  // Same machine as Lat Pulldown, different handle — mirrors it exactly.
  'Neutral-Grip Pulldown':  { anchor: 'bench', ratio: 0.5, equipment: 'cable' },
  'Single-Leg Squat (to Box)': { anchor: 'squat', ratio: 0.15, equipment: 'dumbbell' },
  'Z-Press':                { anchor: 'bench', ratio: 0.35, equipment: 'barbell' },

  'Single-Leg Leg Press':   { anchor: 'squat', ratio: 0.60, equipment: 'machine' },
  'Calf Raises':            { anchor: 'squat', ratio: 0.50, equipment: 'machine' },

  // ═══ UPPER BODY — BARBELL PRIMARY ═══
  'Bench Press':            { anchor: 'bench', ratio: 0.8, equipment: 'barbell' },
  'Incline Bench':          { anchor: 'bench', ratio: 0.7, equipment: 'barbell' },
  'Close Grip Bench':       { anchor: 'bench', ratio: 0.75, equipment: 'barbell' },
  'Overhead Press':         { anchor: 'bench', ratio: 0.6, equipment: 'barbell' },
  'Barbell Row':            { anchor: 'bench', ratio: 0.70, equipment: 'barbell' },
  'Speed Bench':            { anchor: 'bench', ratio: 0.55, equipment: 'barbell' },

  // ═══ UPPER BODY — DUMBBELL ═══
  'DB Bench Press':           { anchor: 'bench', ratio: 0.3, equipment: 'dumbbell' },
  'Incline DB Bench':         { anchor: 'bench', ratio: 0.3, equipment: 'dumbbell' },
  'DB Shoulder Press':        { anchor: 'bench', ratio: 0.2, equipment: 'dumbbell' },
  'Seated DB Press':          { anchor: 'bench', ratio: 0.2, equipment: 'dumbbell' },
  'Half-Kneeling Single-Arm Overhead Press': { anchor: 'bench', ratio: 0.2, equipment: 'dumbbell' },
  'Single-Arm DB Row':        { anchor: 'bench', ratio: 0.3, equipment: 'dumbbell' },
  'Single-Arm DB Bench Press': { anchor: 'bench', ratio: 0.3, equipment: 'dumbbell' },
  'Single-Arm DB Floor Press': { anchor: 'bench', ratio: 0.22, equipment: 'dumbbell' },
  'Lateral Raise':            { anchor: 'bench', ratio: 0.1, equipment: 'dumbbell' },

  // ═══ UPPER BODY — CABLE / MACHINE ═══
  'Seated Cable Row':         { anchor: 'bench', ratio: 0.50, equipment: 'cable' },
  'Lat Pulldown':             { anchor: 'bench', ratio: 0.55, equipment: 'cable' },
  'Single-Arm Lat Pulldown':  { anchor: 'bench', ratio: 0.30, equipment: 'cable' },
  'Face Pull':                { anchor: 'bench', ratio: 0.2, equipment: 'cable' },
  'Cable Face Pull':          { anchor: 'bench', ratio: 0.2, equipment: 'cable' },
  'Chest Supported Row':      { anchor: 'bench', ratio: 0.3, equipment: 'dumbbell' },
  'Landmine Press':           { anchor: 'bench', ratio: 0.35, equipment: 'barbell' },
  'Bear Carry':               { anchor: 'squat', ratio: 0.30, equipment: 'dumbbell' },

  // ═══ CORE (low load — most are BW but some use cable/band) ═══
  'Woodchop (Standing)':      { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
  'Woodchop (Half Kneeling)': { anchor: 'bench', ratio: 0.10, equipment: 'cable' },
  'Hanging Leg Raise':        { anchor: 'bench', ratio: 0.00, equipment: 'bodyweight' }, // True BW
  'Weighted Dead Bug':        { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },

  // ═══ ARMS / PUMP (pool exercises from derived sessions) ═══
  'Bicep Curl (Dumbbell)':      { anchor: 'bench', ratio: 0.15, equipment: 'dumbbell' },
  'Hammer Curl':                { anchor: 'bench', ratio: 0.15, equipment: 'dumbbell' },
  'Incline Dumbbell Curl':      { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
  'Lying Dumbbell Curl':        { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
  'Concentration Curl':         { anchor: 'bench', ratio: 0.1, equipment: 'dumbbell' },
  'Tricep Pushdown':            { anchor: 'bench', ratio: 0.20, equipment: 'cable' },
  'Overhead Tricep Extension':  { anchor: 'bench', ratio: 0.15, equipment: 'cable' },
  'Skull Crushers':             { anchor: 'bench', ratio: 0.2, equipment: 'barbell' },
  'Dumbbell Skull Crusher':     { anchor: 'bench', ratio: 0.15, equipment: 'dumbbell' },
  'Dumbbell Kickback':          { anchor: 'bench', ratio: 0.1, equipment: 'dumbbell' },
  'Tricep Circuit (Dirty 30)':  { anchor: 'bench', ratio: 0.10, equipment: 'dumbbell' },
  'Rear Delt Fly':              { anchor: 'bench', ratio: 0.1, equipment: 'dumbbell' },
  'Chest-Supported DB Row':     { anchor: 'bench', ratio: 0.2, equipment: 'dumbbell' },
  'Shrugs':                     { anchor: 'bench', ratio: 0.30, equipment: 'dumbbell' },
  'Single-Arm Shrug':           { anchor: 'bench', ratio: 0.2, equipment: 'dumbbell' },

  // ═══ COMMON GYM EXERCISES (missing from original map) ═══
  'Leg Extension':              { anchor: 'squat', ratio: 0.30, equipment: 'machine' },
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
  'bottoms up press':                       'Bottoms-Up KB Press',
  'bottoms-up press':                       'Bottoms-Up KB Press',
  'bottoms up kb press':                    'Bottoms-Up KB Press',
  'bottoms-up kb press':                    'Bottoms-Up KB Press',
  'bottoms up kettlebell press':            'Bottoms-Up KB Press',
  'bottoms-up kettlebell press':            'Bottoms-Up KB Press',
  'bear carry':                             'Bear Carry',
  'bear carries':                           'Bear Carry',
  'bear hug carry':                         'Bear Carry',
  // Carry family — the AI backend emits plural/possessive/"walk" spellings the
  // curated vocabulary does not use (census #4 / Part B "Farmers Carry").
  'farmer carry':                           'Farmer Carry',
  'farmers carry':                          'Farmer Carry',
  "farmer's carry":                         'Farmer Carry',
  'farmer carries':                         'Farmer Carry',
  'farmers carries':                        'Farmer Carry',
  'farmer walk':                            'Farmer Carry',
  'farmers walk':                           'Farmer Carry',
  "farmer's walk":                          'Farmer Carry',
  'suitcase carries':                       'Suitcase Carry',
  'suitcase walk':                          'Suitcase Carry',
  'overhead carries':                       'Overhead Carry',
  'overhead walk':                          'Overhead Carry',

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
  'scap push-up':             'Scap Push-Up',
  'scap push up':             'Scap Push-Up',
  'scap pushup':              'Scap Push-Up',
  'scapular push-up':         'Scap Push-Up',
  'scapular push up':         'Scap Push-Up',
  'speed bench press':        'Speed Bench',

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
  'slant board step down':    'Slant Board Step-Down',
  'slant-board step-down':    'Slant Board Step-Down',

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
  'standing calf raises':     'Calf Raises',
  'machine calf raise':       'Calf Raises',

  // ── Plyo ──
  'vertical jump':             'Vertical Jump',
  'vertical jumps':            'Vertical Jump',
  'box jump':                 'Box Jumps',
  'broad jump':               'Broad Jumps',
  'jump squat':               'Jump Squats',
  'squat jump':               'Jump Squats',
  'rfe split squat jump':      'RFE Split Squat Jump',
  'rfe split squat jumps':     'RFE Split Squat Jump',
  'rfess jump':                'RFE Split Squat Jump',
  'rear foot elevated split squat jump': 'RFE Split Squat Jump',
  'rear-foot elevated split squat jump': 'RFE Split Squat Jump',
  'rear foot elevated jump':   'RFE Split Squat Jump',
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
  'mcgill curl up':           'McGill Sit Up',
  'mcgill curl-up':           'McGill Sit Up',
  'woodchop':                 'Woodchop (Standing)',
  'standing woodchop':        'Woodchop (Standing)',
  'cable woodchop':           'Woodchop (Standing)',
  'cable woodchops':          'Woodchop (Standing)',
  'cable chop':               'Woodchop (Standing)',
  'cable chops':              'Woodchop (Standing)',
  'cable lift':               'Woodchop (Half Kneeling)',
  'cable lifts':              'Woodchop (Half Kneeling)',
  'half-kneeling cable lift': 'Woodchop (Half Kneeling)',
  'half kneeling cable lift': 'Woodchop (Half Kneeling)',
  'low to high cable lift':   'Woodchop (Half Kneeling)',
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
  // Spelling-variant twin collapsed by Sam's ruling (2026-07-28): one exercise,
  // one ratio. Both spellings stay RESOLVABLE so stored programs and athlete
  // history written under the retired spelling keep working.
  'chest supported db row':   'Chest-Supported DB Row',
  'incline db row':           'Chest-Supported DB Row',
  'nordic curl':              'Nordic Lower',
  'nordic curls':             'Nordic Lower',
  'nordic ham curl':          'Nordic Lower',
  'nordic hamstring curl':    'Nordic Lower',
  'nordic lower':             'Nordic Lower',
  'nordic lowers':            'Nordic Lower',
  'single leg squat':         'Single-Leg Squat (to Box)',
  'pistol squat':             'Single-Leg Squat (to Box)',

  // ── Cable fly variants ──

  // ── Machine variants ──
  'leg extensions':             'Leg Extension',
  'machine leg extension':      'Leg Extension',
  'knee extension':             'Leg Extension',

  // ── Band Pull-Apart ──
  'band pull-apart':            'Band Pull-Apart',
  'band pull apart':            'Band Pull-Apart',
  'band pull aparts':           'Band Pull-Apart',
  'band pull-aparts':           'Band Pull-Apart',
  'external rotation':          'Banded External Rotation',
  'band external rotation':     'Banded External Rotation',
  'banded external rotation':   'Banded External Rotation',
  'shoulder external rotation': 'Banded External Rotation',

  // ── Prehab / rehab aliases ──
  'tke':                        'Banded TKE',
  'banded tke':                 'Banded TKE',
  'terminal knee extension':    'Banded TKE',
  'band terminal knee extension': 'Banded TKE',
  'banded terminal knee extension': 'Banded TKE',
  'spanish squat':              'Spanish Squat Hold',
  'spanish squat hold':         'Spanish Squat Hold',
  'spanish squat iso':          'Spanish Squat Hold',
  'tibialis raise':             'Tib Raises',
  'tibialis raises':            'Tib Raises',
  'tib raises':                 'Tib Raises',
  'tib raise':                  'Tib Raises',
  'copenhagen':                 'Copenhagen Plank (Half)',
  'copenhagen plank':           'Copenhagen Plank (Half)',
  'copenhagen planks':          'Copenhagen Plank (Half)',
  'short lever copenhagen':     'Copenhagen Plank (Half)',
  'short-lever copenhagen':     'Copenhagen Plank (Half)',
  'short lever copenhagen plank': 'Copenhagen Plank (Half)',
  'long lever copenhagen':      'Long-Lever Copenhagen',
  'long-lever copenhagen':      'Long-Lever Copenhagen',
  'long lever copenhagen plank': 'Long-Lever Copenhagen',
  'single-leg calf raise':     'Single-Leg Calf Raise',
  'single leg calf raise':     'Single-Leg Calf Raise',
  'seated calf raise':         'Seated Calf Raise',
  'seated calf raises':        'Seated Calf Raise',
  'bosch hold':                 'Bosch Hold',
  'bosch holds':                'Bosch Hold',
  'swiss ball curl':            'Swiss Ball Hamstring Curl',
  'swiss ball hamstring curl':  'Swiss Ball Hamstring Curl',
  'swiss ball hamstring curls': 'Swiss Ball Hamstring Curl',
  'inverted row':               'Inverted Row (Bodyweight)',
  'inverted rows':              'Inverted Row (Bodyweight)',
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
  // ── Sam's locked-list merges (2026-07-24): variants of ONE canonical entry ──
  // The upper power default: every spelling of the explosive push-up now points
  // at the single "Explosive Push-up" entry.
  'explosive push-ups':         'Explosive Push-up',
  'explosive push ups':         'Explosive Push-up',
  'explosive push-up':          'Explosive Push-up',
  'explosive pushup':           'Explosive Push-up',
  'explosive pushups':          'Explosive Push-up',
  // Each is a spelling the token signature cannot collapse on its own, because
  // the two names do not share a word set ("RFE" vs "Bulgarian", "Jumps" vs
  // "Hops"). An alias is a curator's explicit ruling about what a spelling
  // means, which is exactly what a merge is.
  'seated db ohp':              'Seated DB Press',
  'seated dumbbell ohp':        'Seated DB Press',
  'rfe split squat':            'Bulgarian Split Squats',
  'rfe split squats':           'Bulgarian Split Squats',
  'pogo jump':                  'Pogo Hops',
  'pogo jumps':                 'Pogo Hops',
  'pogo hop':                   'Pogo Hops',
  // Legacy saved-data ingress only. Current pools and writers contain only the
  // canonical identity; the selected implement carries the old barbell fact.
  'seated good morning (barbell)': 'Seated Good Morning',
  // ── Groin squeeze rename ──
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

// ─── Athlete-Chosen Load ───
//
// The third honest answer to "how is this exercise loaded", added 2026-07-28
// for Sam's Dumbbell Pullovers ruling. The other two could not express it:
//
//   TRUE_BODYWEIGHT / PREHAB_NO_LOAD — both return null (correct), but both
//     also make `isTrueBodyweightExercise` true, and `formatWeight`
//     (useDayWorkout.ts) renders the label off that. A dumbbell exercise would
//     read "BW", and "BW + 12kg" once the athlete entered a weight.
//   EXERCISE_LOAD_MAP — `ExerciseLoadProfile` REQUIRES `anchor` + `ratio`, so
//     any entry derives a working weight from the athlete's squat/bench 1RM.
//     Sam ruled this load athlete-chosen; there is no honest ratio to publish.
//
// Leaving a name out of all three is the worst option: the name-pattern
// fallback invented 12.5kg for Dumbbell Pullovers.
//
// So: NO prescribed weight (null, like the sets above) but NOT bodyweight —
// the card shows "—" until the athlete enters their own number, which then
// renders verbatim as "12kg". Sam, 2026-07-28.
export const ATHLETE_CHOSEN_LOAD_EXERCISES = new Set([
  'Rotational Medicine-Ball Throw',
  'Medicine-Ball Slam',
  'Rotational Medicine-Ball Slam',
  'Dumbbell Pullovers',
]);

/**
 * Exercises that prescribe their EQUIPMENT MINIMUM, not a ratio of an anchor.
 *
 * SAM'S RULING (2026-07-28): *"these prescribe the equipment minimum by default
 * (20 kg barbell curl, 8 kg bottoms-up KB press, etc.)"*.
 *
 * Each of these previously carried a ratio that FLOORED OUT — it computed below
 * the equipment minimum, so the athlete always received the minimum and the
 * ratio never applied. Those numbers looked like decisions and decided nothing.
 * A dead ratio is worse than no ratio: it invites tuning that changes no
 * athlete's card, and it reads as authored intent to the next person.
 *
 * So the minimum is now the STATED prescription rather than an accident of
 * arithmetic, and the ratio is gone rather than left dead in the map.
 */
export const EQUIPMENT_MINIMUM_PRESCRIPTIONS: Record<string, EquipmentKind> = {
  'Bicep Curl (Barbell)': 'barbell',
  'Bottoms-Up KB Press': 'kettlebell',
  'Explosive Landmine Press': 'barbell',
  'Incline Y Raise': 'dumbbell',
};

/** True when load is real but athlete-chosen — no estimate, and never "BW". */
export function isAthleteChosenLoadExercise(exerciseName: string): boolean {
  return ATHLETE_CHOSEN_LOAD_EXERCISES.has(resolveExerciseName(exerciseName));
}

// ─── Prehab / Rehab Exercise Handling ───
//
// Small prehab and tissue-quality exercises should NOT get load estimates
// that imply false precision. Band work, BW mobility, foam rolling, etc.
// are better left without a weight — the UI shows "—" which is fine.

const PREHAB_NO_LOAD_EXERCISES = new Set([
  // Pool exercises that are inherently unloaded or band-only
  'Band Pull-Apart',            // Single canonical (was: Band Pull-Apart (delts) + Band Pull-Aparts)
  'Banded TKE',
  'Slant Board Step-Down',
  'Spanish Squat Hold',
  'Copenhagen Plank (Half)',
  'Long-Lever Copenhagen',
  'Groin Squeeze',
  // Zone-1 cyclical recovery — no external load by definition.
  'Incline Treadmill Walk',
  'Light Walk or Stationary Bike',
  'Single-Leg Calf Raise',
  'Seated Calf Raise',
  'Tib Raises',
  'Tib Raises',             // exercisePools uses this variant
  'Bosch Hold',
  // Sam's locked list (2026-07-24): band / mobility additions — no external
  // load, so no fake precision on the card.
  'Crab Walks',
  'Crab Hold',
  'Side Plank Row',
  'QL Back Extension',
  'Elephant Walks',
  'Dead Bug',
  'Banded Dead Bug',
  'McGill Sit Up',
  'Bird Dog',
  'Side Plank',
  'Ab Wheel',
  'Scap Push-Up',
  // BW prehab / stability (exercisePools bodyweight-tagged)
  'Swiss Ball Hamstring Curl',
  'Band Pallof Press',
  'Banded External Rotation',
  'Banded Bicep Curl',
  'Banded Tricep Pushdown',
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
  'Bench Thoracic Extension',
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
  'Butterfly Stretch',
  'Pissing Dog Against Wall',
  'Jefferson Curl',
  // Cardio / conditioning (recovery context)
  'Outdoor Walk',
  // Breathing
  'Crocodile Breathing',
  '90-90 Breathing',
  '90/90 Breathing',              // exercisePools uses slash variant
  'Box Breathing',
  "Child's Pose with Breathing",
]);

/** The control the session row should offer for an exercise's real load. */
export type LoadControlMode =
  | 'kilograms'
  | 'bodyweight_plus'
  | 'band'
  | 'bodyweight'
  | 'none';

export type BandResistance = 'thin' | 'medium' | 'thick';

export const BAND_RESISTANCE_LEVELS: readonly BandResistance[] = [
  'thin', 'medium', 'thick',
];

export function stepBandResistance(
  current: BandResistance,
  direction: -1 | 1,
): BandResistance {
  const currentIndex = BAND_RESISTANCE_LEVELS.indexOf(current);
  const nextIndex = Math.max(
    0,
    Math.min(BAND_RESISTANCE_LEVELS.length - 1, currentIndex + direction),
  );
  return BAND_RESISTANCE_LEVELS[nextIndex];
}

/**
 * Bodyweight movements where the athlete can add an external load without
 * changing the exercise's identity.
 */
export const BODYWEIGHT_LOADABLE_EXERCISES = new Set([
  'Seated Good Morning',
  'SL 45° Back Extension',
  'SL 45° Back Extension Hold',
  'Dips',
  'Pull-Ups',
  'Chin-Ups',
  'Push-ups',
  'Inverted Row (Bodyweight)',
  'Glute Bridge',
  'Bosch Hold',
  'Long-Lever Copenhagen',
  'Seated Calf Raise',
  'Single-Leg Calf Raise',
]);

/** Exercises whose resistance is described by band thickness, never kilos. */
export const BAND_RESISTANCE_EXERCISES = new Set([
  'Band Pull-Apart',
  'Banded TKE',
  'Spanish Squat Hold',
  'Crab Walks',
  'Side Plank Row',
  'Banded Dead Bug',
  'Band Pallof Press',
  'Banded External Rotation',
  'Banded Bicep Curl',
  'Banded Tricep Pushdown',
]);

/**
 * One UI answer for load controls. The selected implement is accepted because
 * Woodchops can genuinely be performed with either a cable or a band.
 */
export function resolveLoadControlMode(
  exerciseName: string,
  selectedImplement?: string | null,
  experienceLevel?: ExperienceLevel | null,
): LoadControlMode {
  const resolved = resolveExerciseName(exerciseName);
  if (isSeatedGoodMorningIdentity(resolved)) {
    if (selectedImplement === 'barbell' || selectedImplement === 'dumbbells') {
      return 'kilograms';
    }
    return seatedGoodMorningVariantAllowsExperience(
      'dumbbells', experienceLevel) ? 'bodyweight_plus' : 'bodyweight';
  }
  if (selectedImplement === 'bands' || BAND_RESISTANCE_EXERCISES.has(resolved)) {
    return 'band';
  }
  if (BODYWEIGHT_LOADABLE_EXERCISES.has(resolved)) return 'bodyweight_plus';
  if (PREHAB_NO_LOAD_EXERCISES.has(resolved)) return 'none';
  if (TRUE_BODYWEIGHT_EXERCISES.has(resolved)) return 'bodyweight';
  return 'kilograms';
}

export function formatBandResistance(resistance: BandResistance): string {
  return resistance.charAt(0).toUpperCase() + resistance.slice(1);
}

export function formatLoadControlLabel(
  mode: LoadControlMode,
  weightKg: number | null,
  bandResistance: BandResistance = 'medium',
): string {
  if (mode === 'band') return formatBandResistance(bandResistance);
  if (mode === 'bodyweight') return 'BW';
  if (mode === 'none') return '';
  if (mode === 'bodyweight_plus') {
    return weightKg && weightKg > 0 ? `BW + ${weightKg}kg` : 'BW';
  }
  if (weightKg === null || weightKg === undefined || weightKg === 0) return '-';
  return `${weightKg}kg`;
}

// ─── Rounding ───

/**
 * Rounding and minimums now come from the single authored owner,
 * `data/equipmentLattice` — Sam ruled them 2026-07-28. This module used to
 * define `ROUND_INCREMENTS` and `MIN_WEIGHTS` itself, and `defaultProgram`
 * carried a byte-identical third copy of the minimums.
 */

/** Round to a loadable weight. Kept as the module's public name; delegates. */
export function roundToEquipment(weight: number, equipment: EquipmentClass): number {
  return roundDownToLattice(weight, equipment);
}

// ─── Load Authority: the single owner of "how is this loaded?" ───
//
// RENDER-TRUTH (Sam, 2026-07-28). Every athlete-facing load claim — the "BW"
// on a card, the kilograms in a weight field — must derive from something
// authored. This resolver is the only thing entitled to answer, and it answers
// by NAMING its source.
//
// It replaces three heuristics that answered without one:
//
//   estimateFromNamePattern  an 18-row regex→ratio table — a second load map
//                            keyed by name, authored by nobody. It invented
//                            12.5kg for Dumbbell Pullovers, and closed with an
//                            "absolute last resort" of bodyweight × 0.15 that
//                            gave a confident number to ANY unrecognised name,
//                            including ones the generator invents.
//   estimateFromTags         a hardcoded 10kg for loaded core.
//   tag-category promotion   movement === 'plyo' | 'conditioning' → "BW".
//
// A movement category is not an authority on kilograms, and a name is not
// evidence about load. Where nothing authored covers an exercise the honest
// answer is `unauthored`, which renders as absence — not as the confident
// "BW" that made the Pullovers card lie while every gate passed.

/** Where a load claim came from. `unauthored` is a real answer, not a failure. */
export type LoadAuthority =
  | { kind: 'bodyweight'; source: 'TRUE_BODYWEIGHT_EXERCISES' }
  | { kind: 'unloaded'; source: 'PREHAB_NO_LOAD_EXERCISES' }
  | { kind: 'athlete_chosen'; source: 'ATHLETE_CHOSEN_LOAD_EXERCISES' }
  | { kind: 'prescribed'; source: 'EXERCISE_LOAD_MAP'; profile: ExerciseLoadProfile }
  | { kind: 'equipment_minimum'; source: 'EQUIPMENT_MINIMUM_PRESCRIPTIONS'; equipment: EquipmentKind }
  | { kind: 'unauthored' };

/**
 * Resolve which authored source, if any, governs this exercise's load.
 *
 * Order matters and mirrors the authored precedence:
 *   1. athlete-chosen — real external load, nothing honest to prescribe
 *   2. true bodyweight — ruled unloaded
 *   3. prehab / no-load — ruled unloaded and intentionally has no load label
 *   4. the ruled ratio map
 *   5. nothing — say so
 */
export function resolveLoadAuthority(exerciseName: string): LoadAuthority {
  const resolved = resolveExerciseName(exerciseName);

  if (ATHLETE_CHOSEN_LOAD_EXERCISES.has(resolved)) {
    return { kind: 'athlete_chosen', source: 'ATHLETE_CHOSEN_LOAD_EXERCISES' };
  }
  if (TRUE_BODYWEIGHT_EXERCISES.has(resolved)) {
    return { kind: 'bodyweight', source: 'TRUE_BODYWEIGHT_EXERCISES' };
  }
  if (PREHAB_NO_LOAD_EXERCISES.has(resolved)) {
    return { kind: 'unloaded', source: 'PREHAB_NO_LOAD_EXERCISES' };
  }
  const minimumEquipment = EQUIPMENT_MINIMUM_PRESCRIPTIONS[resolved];
  if (minimumEquipment) {
    return {
      kind: 'equipment_minimum',
      source: 'EQUIPMENT_MINIMUM_PRESCRIPTIONS',
      equipment: minimumEquipment,
    };
  }

  const profile = EXERCISE_LOAD_MAP[resolved];
  if (profile) {
    // A ratio of 0 on bodyweight equipment is an authored "unloaded", not a
    // prescription of nothing.
    if (profile.equipment === 'bodyweight') {
      return { kind: 'bodyweight', source: 'TRUE_BODYWEIGHT_EXERCISES' };
    }
    return { kind: 'prescribed', source: 'EXERCISE_LOAD_MAP', profile };
  }

  return { kind: 'unauthored' };
}

/**
 * Which equipment an exercise needs, from the authority rather than the raw map.
 *
 * Reading `EXERCISE_LOAD_MAP[name]?.equipment` directly is a trap: a missing
 * entry is indistinguishable from "no equipment requirement", and callers
 * uniformly treat undefined as "allowed for everyone". When Sam's ruling moved
 * four exercises off ratios onto `EQUIPMENT_MINIMUM_PRESCRIPTIONS`, that alone
 * silently made a barbell curl available to an athlete with no barbell — the
 * pool filter stopped seeing its equipment. One owner answers this now.
 *
 * @returns the equipment kind, or null when nothing authored says.
 */
export function equipmentClassFor(exerciseName: string): EquipmentKind | null {
  const authority = resolveLoadAuthority(exerciseName);
  switch (authority.kind) {
    case 'prescribed': return authority.profile.equipment;
    case 'equipment_minimum': return authority.equipment;
    case 'bodyweight': return 'bodyweight';
    default: return null;
  }
}

/**
 * The implement class that owns an AUTOMATIC load change. This is deliberately
 * narrower than equipment feasibility: weighted bodyweight needs an external
 * plate rung without pretending Pull-Ups require a barbell to be selectable.
 */
export function automaticLoadKindForExercise(
  exerciseName: string,
): AutomaticLoadKind | null {
  const resolved = resolveExerciseName(exerciseName);
  if (BODYWEIGHT_LOADABLE_EXERCISES.has(resolved)) return 'weighted_bodyweight';
  const equipment = equipmentClassFor(resolved);
  return equipment === 'bodyweight' ? null : equipment;
}

/**
 * One exercise-aware automatic load-normalisation door. The accepted/logged
 * base stays exact; only the new app-authored target is snapped to the typed
 * implement lattice.
 */
export function normaliseAutomaticExerciseLoadChange(args: {
  readonly exerciseName: string;
  readonly baseKg: number;
  readonly targetKg: number;
}): number | null {
  const kind = automaticLoadKindForExercise(args.exerciseName);
  return kind ? normaliseAutomaticLoadChange({
    baseKg: args.baseKg,
    targetKg: args.targetKg,
    kind,
  }) : null;
}

/**
 * THE RENDER SEAM. One input, one decision.
 *
 * The label and the number used to be decided separately — `formatWeight`
 * asked `isTrueBodyweightExercise` for the label and `estimateStartingWeight`
 * for the number, so the two could disagree about the same exercise. They
 * disagreed on Dumbbell Pullovers. Deriving both from a single resolved
 * authority is what makes that disagreement unrepresentable.
 *
 * @param authority the resolved source of truth for this exercise
 * @param weightKg  the athlete's own entry or a prescribed value; null if none
 */
export function formatLoadLabel(authority: LoadAuthority, weightKg: number | null): string {
  if (authority.kind === 'bodyweight') {
    return weightKg && weightKg > 0 ? `BW + ${weightKg}kg` : 'BW';
  }
  if (authority.kind === 'unloaded') return '-';
  // athlete_chosen, prescribed and unauthored all render the number if there
  // is one and a dash if there is not. None of them may claim "BW": for
  // athlete_chosen that is the Pullovers defect, and for unauthored it would
  // be a claim we have no basis for.
  if (weightKg === null || weightKg === undefined || weightKg === 0) return '-';
  return `${weightKg}kg`;
}

// ─── Public API ───

/**
 * Estimate a starting working weight for a named exercise.
 *
 * Returns a number ONLY for `prescribed` authority — an entry in the ruled
 * EXERCISE_LOAD_MAP. Bodyweight, athlete-chosen and unauthored all return
 * null, because none of them has an authored ratio to compute from.
 *
 * @returns weight in kg, or null when nothing authored prescribes one.
 */
export function estimateStartingWeight(
  exerciseName: string,
  onboardingData: OnboardingData,
): number | null {
  const authority = resolveLoadAuthority(exerciseName);

  // Ruled to prescribe the equipment minimum — no anchor, no ratio, and so no
  // dependence on the athlete's strength answers.
  if (authority.kind === 'equipment_minimum') {
    return EQUIPMENT[authority.equipment].minimumKg;
  }
  if (authority.kind !== 'prescribed') return null;

  const anchors = estimateAnchors(onboardingData);
  if (anchors === null) return null;

  const { profile } = authority;
  const anchor1RM = profile.anchor === 'squat' ? anchors.squat1RM : anchors.bench1RM;
  return prescribableWeight(anchor1RM * profile.ratio, profile.equipment);
}

/**
 * Check if an exercise is genuinely bodyweight-based.
 *
 * True only when an authored source says so. An exercise nothing covers is
 * NOT bodyweight — it is unknown, and the caller must render it as unknown.
 */
export function isTrueBodyweightExercise(exerciseName: string): boolean {
  return resolveLoadAuthority(exerciseName).kind === 'bodyweight';
}

/**
 * THE STARTING WEIGHT AN ATHLETE ACTUALLY SEES. One owner, both paths.
 *
 * `estimateStartingWeight` answers a narrower question — what the authored
 * ratio computes — and knows nothing about who is lifting. This applies the
 * athlete-level adjustment Sam ruled on 2026-07-27: "Beginners start at 50% of
 * the calculated load and adjust from there."
 *
 * WHY THIS EXISTS. The generation path applied that multiplier; the render-time
 * fallback in `useDayWorkout` called `estimateStartingWeight` directly and did
 * not. The same complete beginner could read 27.5 kg on a freshly generated
 * card and 52.5 kg on one that fell through to the fallback — one question,
 * two owners, the same shape as the load-label defect one layer up. Both paths
 * now call this, and `singleLoadEstimationOwnerTests` asserts no other module
 * in product code reads `initialLoadMultiplier` at all.
 *
 * Rounding happens AFTER the multiplier. Halving and then snapping to the bar
 * increment is not the same as snapping and then halving, and the athlete has
 * to load a real bar.
 */
export function startingWeightForAthlete(
  exerciseName: string,
  onboardingData: OnboardingData,
): number | null {
  const authority = resolveLoadAuthority(exerciseName);
  // An equipment minimum is the lightest loadable option already — the beginner
  // multiplier has nothing left to take off it.
  if (authority.kind === 'equipment_minimum') {
    return EQUIPMENT[authority.equipment].minimumKg;
  }
  if (authority.kind !== 'prescribed') return null;

  const base = estimateStartingWeight(exerciseName, onboardingData);
  if (base === null) return null;

  const { initialLoadMultiplier } = resolveTrainingAgePolicy(onboardingData.experienceLevel);
  if (initialLoadMultiplier === 1) return base;

  const { equipment } = authority.profile;
  return prescribableWeight(base * initialLoadMultiplier, equipment);
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
