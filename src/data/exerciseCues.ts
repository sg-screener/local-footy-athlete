/**
 * Exercise Cues — Static coaching cue library.
 *
 * Each exercise gets a primaryCue (mechanics) and secondaryCue (intent/control).
 * Cues tell the athlete HOW to perform the movement. Nothing about why it's
 * in the program, what day it is, or what comes next.
 *
 * Fallback: an exercise with no entry renders NO cue. The one exception is
 * conditioning — see PENDING_CONDITIONING_CUE, which is not authored.
 *
 * PROVENANCE: Authored by Sam, 2026-07-23. Additions require Sam sign-off.
 * COPYEDIT: Sam-authorised mechanical punctuation pass (2026-07-24) — terminal
 * stops + a stray trailing comma fixed on 43 cues, zero word changes. Applied
 * identically to the changeset doc so doc↔code equality holds.
 *
 * EXERCISE_CUES is a projection of Sam's authored sheet,
 * `docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx` — the `primaryCue` /
 * `secondaryCue` columns, on the same row that already owns each exercise's
 * muscles and experience gate. It is not edited by hand:
 * `src/__tests__/authoredCueLibraryTests.ts` parses that sheet and binds it to
 * this file IN BOTH DIRECTIONS, so neither a reworded cue nor an unfiled one
 * can ship.
 *
 * Authored-ness used to be spread across three documents with nothing
 * reconciling them, and the gate read only one — so 31 cues lived here that it
 * had never heard of. All were Sam's; none had been filed. The sheet is now the
 * only door. See docs/CUE_RECONCILIATION_DIAGNOSIS_2026-07-28.md.
 *
 * ADDING CUES:
 *   Add the row to the master sheet first, with Sam's sign-off, then mirror it
 *   here. primaryCue = mechanics, position, range, bracing.
 *   secondaryCue = intent, control, tempo, tension.
 *   3–8 words ideal, 18 words hard cap. No fluff.
 */

import type { MovementPattern } from './exerciseTags';

// ─── Types ───

import { resolveTemplateByName } from '../rules/conditioningSelection';

export interface ExerciseCue {
  primaryCue: string;
  secondaryCue: string;
}

// ─── Part 1: Family Rules ───
//
// Each movement family defines what the primary and secondary cues
// should focus on, and what language to avoid.
//
// These rules are documentation for authors. They used to double as the input
// to a fallback table that supplied a default pair per family; that table is
// gone (Sam, 2026-07-28) and nothing derives a cue from these rows now. They
// describe how to WRITE a cue, not what to render when one is missing.

/*
┌──────────────────────────┬──────────────────────────────────┬────────────────────────────────┬───────────────────────────────┐
│ Family                   │ Primary cue focus                │ Secondary cue focus            │ Avoid                         │
├──────────────────────────┼──────────────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ squat                    │ depth, torso position, knee track│ tempo on descent, bracing      │ "sit back" (misleading)       │
│ hinge                    │ hip hinge cue, back flat         │ tension through posterior chain │ "deadlift" as a verb          │
│ lunge / split squat      │ front shin angle, trunk upright  │ control the split, no wobble   │ "step forward" (vague)        │
│ horizontal_push          │ shoulder blade set, bar path     │ press intent, lockout          │ "chest day" language           │
│ incline_push             │ angle cue, shoulder protection   │ drive through palms             │ "upper chest" bro-science     │
│ vertical_push            │ overhead lockout, rib cage down  │ press hard, finish strong      │ "military" (dated)            │
│ horizontal_pull          │ retract scaps, pull to torso     │ squeeze at peak, control return│ "rowing machine" confusion    │
│ vertical_pull            │ initiate with lats, full hang    │ control the negative           │ "bicep curl" crossover cues   │
│ carry                    │ tall posture, packed shoulders   │ breathe, don't rush            │ "cardio" framing              │
│ trunk_anti_rotation      │ resist rotation, brace position  │ hold without shifting          │ "abs" (reductive)             │
│ trunk_flexion_extension  │ controlled range, no momentum    │ slow and deliberate            │ "crunch" language             │
│ groin / adductor         │ inner thigh engagement, position │ controlled squeeze or hold     │ "stretch" when it's strength  │
│ calf                     │ full range, heel drop            │ slow lowering, pause at bottom │ "bounce" (harmful)            │
│ hamstring_iso            │ hip or knee angle, hold position │ tension through full hold      │ "stretching" confusion        │
│ shoulder_ext_rotation    │ elbow pinned, controlled arc     │ light and precise              │ "rotator cuff" clinical talk  │
│ plyo / jump              │ land soft, absorb with hips      │ max intent, quality reps       │ "jump higher" (outcome)       │
│ sprint / acceleration    │ drive through ground, arm action │ relax face and shoulders       │ "run faster" (outcome)        │
│ conditioning (bike/tempo)│ hold the prescribed effort       │ breathe rhythmically           │ "push through" hype           │
│ isolation_upper          │ control the range, no momentum   │ squeeze at peak contraction    │ "pump" as instruction         │
│ core (general)           │ brace position, neutral spine    │ breathe behind the brace       │ "engage core" (meaningless)   │
└──────────────────────────┴──────────────────────────────────┴────────────────────────────────┴───────────────────────────────┘
*/

// ─── Part 4: The one pending pair ───
//
// There used to be a family-fallback TABLE here: thirteen cue pairs, one per
// MovementPattern, returned whenever an exercise had no entry of its own.
//
// Sam deleted twelve of them on 2026-07-28. They fired for no exercise — every
// name that could reach them was `conditioning` — and they appeared in no
// authored document, so they were a safety net nobody had written. Shrinking
// the table to its one live key would have left twelve empty slots a later unit
// could refill with no gate noticing, so the table went with them. Fail loud.
//
// What survives is one pair, and it is NOT authored.

/**
 * The conditioning cue that ships today. **UNRULED — NOT Sam-authored.**
 *
 * It renders on the selectable conditioning sessions that have no cue of their
 * own. Sam saw it on 2026-07-28 and deliberately did not rule on it: the 55
 * authored conditioning templates each carry his own `effortCue`, and Stage B
 * switches selection onto them, so ruling now would author a cue with a shelf
 * life. It stays, attributed, until then. `Easy Swim` cannot resolve to a
 * template (`ConditioningModality` has no swim) and gets a Sam-authored cue at
 * Stage B.
 *
 * TRIPWIRE: if the app approaches real athletes before Stage B lands, this
 * comes back to Sam. It ships today only because there are no live users.
 *
 * Recorded in `docs/CUE_RECONCILIATION_DIAGNOSIS_2026-07-28.md`, and pinned by
 * `authoredCueLibraryTests` — which asserts the sheet marks all 23 of its
 * exercises `PENDING — Stage B` rather than letting them read as authored.
 */
export const PENDING_CONDITIONING_CUE: ExerciseCue = {
  primaryCue: 'Hold the prescribed effort.',
  secondaryCue: 'Breathe rhythmically.',
};

// ─── Part 2: Lookup Function ───

/**
 * Get the coaching cue pair for an exercise.
 *
 * Lookup order:
 *   1. Exact name match in EXERCISE_CUES
 *   2. Case-insensitive match in EXERCISE_CUES
 *   3. The pending conditioning pair, for conditioning only
 *   4. The generic pair — which `buildCueText` suppresses, so it renders
 *      nothing rather than filler
 *
 * Step 3 is deliberately not a table lookup. Every other movement family falls
 * through to the suppressed generic and renders no cue at all, which is the
 * loud failure Sam chose over an unauthored default.
 *
 * @param exerciseName - The exercise name as it appears in the workout
 * @param movementPattern - Optional MovementPattern from exerciseTags.ts
 */
export function getExerciseCue(
  exerciseName: string,
  movementPattern?: MovementPattern | null,
): ExerciseCue {
  // 1. Exact match
  if (EXERCISE_CUES[exerciseName]) {
    return EXERCISE_CUES[exerciseName];
  }

  // 2. Case-insensitive match
  const lower = exerciseName.toLowerCase();
  for (const [key, cue] of Object.entries(EXERCISE_CUES)) {
    if (key.toLowerCase() === lower) return cue;
  }

  // 3. An authored conditioning template's own cue (Stage B landed,
  // 2026-08-05). This is the supersession the pending-pair note above always
  // promised: the 55 signed templates each carry Sam's `effortCue`, and both
  // lines here are the workbook's fields VERBATIM, equality-gated to the
  // sheet. Not a table copy — the workbook stays the one owner.
  const template = resolveTemplateByName(exerciseName);
  if (template) {
    return { primaryCue: template.effortCue, secondaryCue: template.intensity };
  }

  // 3b. The one pending pair — legacy conditioning only, and not authored.
  if (movementPattern === 'conditioning') {
    return PENDING_CONDITIONING_CUE;
  }

  // 4. Safe generic (never "Focus on proper form")
  return {
    primaryCue: 'Control the movement.',
    secondaryCue: 'Stay tight through the full range.',
  };
}

// ─── Part 3: Exercise Cue Library ───

export const EXERCISE_CUES: Record<string, ExerciseCue> = {
  "Seated Good Morning (Barbell)": {"primaryCue": "Sit wide, brace, and hinge forward from the hips.", "secondaryCue": "Don't round the spine."},
  "Rotational Medicine-Ball Slam": {"primaryCue": "Reach tall onto toes, rotate hard, and slam outside the foot.", "secondaryCue": "Reset before each explosive repetition."},
  "Medicine-Ball Slam": {"primaryCue": "Reach tall onto toes and slam the ball straight down.", "secondaryCue": "Finish athletically with the hips and knees softly bent."},
  "Rotational Medicine-Ball Throw": {"primaryCue": "Load the outside hip, rotate hard, and throw through the wall.", "secondaryCue": ""},
  "Reverse Nordic Curl": {"primaryCue": "Squeeze the glutes and lean back from the knees.", "secondaryCue": "Keep knees, hips, and shoulders in one straight line."},
  "SL 45° Back Extension Hold": {"primaryCue": "Hold a straight line using the glute and hamstring.", "secondaryCue": "Keep the hips square and avoid hanging through the lower back."},
  "SL 45° Back Extension": {"primaryCue": "Hinge over the pad, then drive through the working hip.", "secondaryCue": "Keep the hips square and finish without arching the lower back."},
  "Seated Good Morning": {"primaryCue": "Sit wide, brace, and hinge forward from the hips.", "secondaryCue": "Don't round the spine."},
  "Crab Hold": {"primaryCue": "Press through hands and feet, then lift the hips high.", "secondaryCue": "Keep the chest open and hold."},
  "Standing Knee Extension": {"primaryCue": "Stand tall, lift one knee to 90 degrees, then straighten your leg.", "secondaryCue": ""},
  "Seated Single-Leg Pike Lift": {"primaryCue": "Lean slightly forward, lock the knee, and lift the heel.", "secondaryCue": "Pause at the top."},
  "Horse Stance Hold": {"primaryCue": "Take a wide stance and sink straight down between your feet.", "secondaryCue": "Push knees over toes and keep your torso tall."},
  '90/90 Breathing': {
    primaryCue: 'Knees and hips at 90, exhale fully.',
    secondaryCue: 'Pause at the bottom of each breath.',
  },
  'Ab Wheel': {
    primaryCue: 'Roll out only as far as you can control.',
    secondaryCue: 'Ribs down, slightly rounded back, no sagging at hips.',
  },
  // R-129's authored Primer row, in Sam's own dose words: *"3 accelerations
  // for 15m at 90%"*. The name lives in no selectable pool (deliberately — see
  // the signed-copy entry in `projectionCopy`), so no pool row could carry the
  // cue; without this entry a GENERATOR-placed Primer (R-130's female G−1)
  // refuses at the curated-cue contract, which the athlete-add door never runs.
  'Acceleration': {
    primaryCue: 'Build up to 90% effort over the 15m.',
    secondaryCue: '',
  },
  'ATG Split Squat': {
    primaryCue: 'Elevate front foot, body stays upright, drive hips to front heel, go slow and pause at bottom.',
    secondaryCue: '',
  },
  'Adductor Rockback': {
    primaryCue: 'Wide knees, one leg out straight to side, rock hips back to the heels.',
    secondaryCue: 'Hold the end range, breathe.',
  },
  'Air Bike Sprints': {
    primaryCue: 'Explosive effort.',
    secondaryCue: 'Recover fully between sprints.',
  },
  'Back Extension': {
    primaryCue: "Squeeze glutes at top, round slightly at bottom.",
    secondaryCue: "",
  },
  'Back Squat': {
    primaryCue: 'Sit into the hips, chest up.',
    secondaryCue: 'Own the bottom position.',
  },
  'Band Pallof Press': {
    primaryCue: 'Press out, resist the pull.',
    secondaryCue: 'Hips stay square, slight knee and hip bend.',
  },
  'Band Pull-Apart': {
    primaryCue: 'Squeeze the shoulder blades together.',
    secondaryCue: 'Elbows straight, controlled return.',
  },
  'Banded Bicep Curl': {
    primaryCue: 'Elbows pinned, curl against the band.',
    secondaryCue: 'Slow on the way down.',
  },
  'Banded Dead Bug': {
    primaryCue: 'Band behind head, pull band with straight arms toward knees, ribs down.',
    secondaryCue: 'Lower back stays glued to the floor.',
  },
  'Banded External Rotation': {
    primaryCue: 'Elbow at 90 degrees, rotate against the band.',
    secondaryCue: 'Slow and controlled arc.',
  },
  'Banded Tricep Pushdown': {
    primaryCue: 'Lock the elbows, press to full extension.',
    secondaryCue: 'Constant tension, no slack.',
  },
  'Banded TKE': {
    primaryCue: "Band behind knee, step back for tension, straighten knee and squeeze quads.",
    secondaryCue: "",
  },
  'Barbell Row': {
    primaryCue: 'Hinge forward, pull to the belly.',
    secondaryCue: 'Squeeze the shoulder blades at the top.',
  },
  'Bear Carry': {
    primaryCue: 'Hug the load tight, ribs down.',
    secondaryCue: 'Short steady steps, no leaning back.',
  },
  'Bench Press': {
    primaryCue: 'Shoulder blades pinched, bend bar like snapping a twig, feet planted.',
    secondaryCue: 'Bar to chest, press hard to lockout.',
  },
  'Bicep Curl (Barbell)': {
    primaryCue: 'Elbows glued to the sides, full range.',
    secondaryCue: 'No swinging, control the bar path.',
  },
  'Bicep Curl (Dumbbell)': {
    primaryCue: 'Neutral start, supinate as you curl.',
    secondaryCue: 'Smooth tempo, squeeze at the top.',
  },
  'Bird Dog': {
    primaryCue: 'Extend arm and opposite leg, no shift, tuck hips under you.',
    secondaryCue: 'Slow and controlled.',
  },
  'Bodyweight Squat': {
    primaryCue: "Sit back into hips, knees follow toes, chest tall.",
    secondaryCue: "",
  },
  'Bottoms-Up KB Press': {
    primaryCue: 'Bell vertical, wrist stacked.',
    secondaryCue: 'Press smooth, keep ribs down.',
  },
  'Bosch Hold': {
    primaryCue: "Single or double leg, slight knee bend, drive heel into ground, keep hips high.",
    secondaryCue: "",
  },
  'Box Breathing': {
    primaryCue: 'Four counts in, hold, out, hold.',
    secondaryCue: 'Stay relaxed, find the rhythm.',
  },
  'Box Jumps': {
    primaryCue: 'Jump up, step down.',
    secondaryCue: 'Land soft, absorb with the hips.',
  },
  'Box Squat': {
    primaryCue: 'Sit back to the box, pause, then drive.',
    secondaryCue: 'Explode off the box.',
  },
  'Broad Jumps': {
    primaryCue: 'Drive forward, land balanced.',
    secondaryCue: 'Stick the landing.',
  },
  'Bulgarian Split Squats': {
    primaryCue: 'Slight lean forward.',
    secondaryCue: 'Control the descent, no bouncing.',
  },
  'Butterfly Stretch': {
    primaryCue: 'Upper back and butt against wall, feet together, knees towards ground, add weight to knee if too easy',
    secondaryCue: '',
  },
  'Cable Face Pull': {
    primaryCue: 'Pull to the forehead, open the hands out.',
    secondaryCue: 'Squeeze the rear delts.',
  },
  'Calf Raises': {
    primaryCue: 'Elevate balls of feet on step, full heel drop, rise onto the big toe.',
    secondaryCue: 'Pause high, lower slowly.',
  },
  'Calf Stretch': {
    primaryCue: 'Heel down, drive knee toward the wall.',
    secondaryCue: 'Switch to bent-knee for the soleus.',
  },
  'Cat-Cow': {
    primaryCue: 'Round fully, then extend fully.',
    secondaryCue: 'Match each position to a breath.',
  },
  'Chest / Pec Stretch (Doorway)': {
    primaryCue: 'Forearm on the doorframe, step the foot through.',
    secondaryCue: 'Big stretch through the chest, breathe slow.',
  },
  'Chest Supported Row': {
    primaryCue: 'Chest on the pad, pull straight back.',
    secondaryCue: 'Retract and hold for a beat.',
  },
  'Chest-Supported DB Row': {
    primaryCue: 'Chest on the pad, pull to the hips, can do on incline bench.',
    secondaryCue: 'Squeeze the shoulder blades back.',
  },
  'Child\'s Pose with Breathing': {
    primaryCue: 'Sink back onto the heels, arms long.',
    secondaryCue: 'Slow breaths into the back.',
  },
  'Chin-Up Negative (Slow)': {
    primaryCue: 'Jump to the top, lower slowly, can pull yourself up if you can.',
    secondaryCue: 'Fight gravity the whole way.',
  },
  'Chin-Ups': {
    primaryCue: 'Palms facing you, full range.',
    secondaryCue: 'Control the lowering.',
  },
  'Close Grip Bench': {
    primaryCue: 'Hands at or inside shoulder width, elbows tight.',
    secondaryCue: 'Triceps do the work.',
  },
  'Concentration Curl': {
    primaryCue: 'Elbow braced on the inner thigh.',
    secondaryCue: 'Strict curl, no body swing.',
  },
  'Copenhagen Plank (Half)': {
    primaryCue: 'Top leg on the bench, drive through the inner thigh.',
    secondaryCue: 'Hold tension, no dropping.',
  },
  'Cossack Squat': {
    primaryCue: "Wide stance, sit onto one leg, other leg straight.",
    secondaryCue: "Heel down, chest up, push back through. Hold rack if needed.",
  },
  'Couch Stretch': {
    primaryCue: 'Back knee to the wall, squeeze the glute.',
    secondaryCue: 'Tall through the midline, no arching.',
  },
  'Crab Walks': {
    primaryCue: "Sit back into athletic position, band around feet, push off outside leg, keep knees slightly pointed out.",
    secondaryCue: "",
  },
  'Crocodile Breathing': {
    primaryCue: 'Face down, breathe into the belly.',
    secondaryCue: 'Feel the floor push back on the exhale.',
  },
  'DB Bench Press': {
    primaryCue: 'Shoulder blades set on the bench.',
    secondaryCue: 'Control the dumbbells down and drive.',
  },
  'DB Shoulder Press': {
    primaryCue: 'Start at the shoulders, press to lockout.',
    secondaryCue: 'No arching through the lower back.',
  },
  'Dead Bug': {
    primaryCue: 'Lower back stays flat on the floor.',
    secondaryCue: 'Opposite arm and leg, slow.',
  },
  'Dead Hang': {
    primaryCue: 'Passive hang, shoulders open and relaxed.',
    secondaryCue: 'Breathe - let the spine decompress.',
  },
  'Deadlift': {
    primaryCue: 'Keep bar close, get tight through the lats.',
    secondaryCue: 'Flat back from start to lockout.',
  },
  'Deep Squat Hold': {
    primaryCue: 'Sit between the heels, chest up.',
    secondaryCue: 'Breathe and hold position.',
  },
  'Depth Jumps': {
    primaryCue: 'Step off, explode off the ground.',
    secondaryCue: 'Minimum ground contact time.',
  },
  'Dips': {
    primaryCue: 'Lean slightly forward, elbows back.',
    secondaryCue: 'Control the descent.',
  },
  'Dragon Flag': {
    primaryCue: "Control the way down, low back should be slightly rounded and roll over ground.",
    secondaryCue: "",
  },
  'Dumbbell Kickback': {
    primaryCue: 'One knee on bench, one hand on bench, extend to full lockout.',
    secondaryCue: 'Squeeze at the top, slow return.',
  },
  'Dumbbell Pullovers': {
    primaryCue: "Rest upper back on bench, dumbbell over, don't allow ribs to flare up, pause at end range",
    secondaryCue: '',
  },
  'Dumbbell Skull Crusher': {
    primaryCue: 'Lower to the sides of the head, press up.',
    secondaryCue: 'Elbows stay fixed in place.',
  },
  'Easy Bike': {
    primaryCue: 'Conversational pace, legs turning over.',
    secondaryCue: 'This is recovery, not training.',
  },
  'Easy Row': {
    primaryCue: 'Controlled rhythm, long strokes.',
    secondaryCue: 'This is active recovery, not training.',
  },
  'Easy Ski': {
    primaryCue: 'Smooth technique, conversational pace.',
    secondaryCue: 'Focus on form, not intensity.',
  },
  'Elephant Walks': {
    primaryCue: "Place blocks at level you’re comfortable with, fold forward, bend and straight one leg at a time, slowly.",
    secondaryCue: "",
  },
  'Explosive Landmine Press': {
    primaryCue: 'Split stance, drive hard into the bar.',
    secondaryCue: 'Full lockout, reset quickly.',
  },
  'Explosive Push-up': {
    primaryCue: 'Explode up, hands leave the floor. Land soft.',
    secondaryCue: 'Stop when reps slow. Sore wrists? Elevate hands on box.',
  },
  'Erg EMOM': {
    primaryCue: "Hit X number of calories every minute, the faster you do them the more rest you get.",
    secondaryCue: "",
  },
  'Face Pull': {
    primaryCue: 'Pull to the forehead, open the hands out.',
    secondaryCue: 'Squeeze the rear delts, slow return.',
  },
  'Farmer Carry': {
    primaryCue: 'Shoulders packed, walk tall.',
    secondaryCue: 'Breathe and keep moving. Weight shown is per hand.',
  },
  '2km Time Trial': {
    primaryCue: 'Try to run this at the same pace for the entire 2km',
    secondaryCue: '',
  },
  'Flush Run': {
    primaryCue: 'Easy jog, nothing above zone one or two.',
    secondaryCue: 'Move and loosen up.',
  },
  'Foam Roll — Calves & Outer Shins': {
    primaryCue: 'Slow passes, pause on tender spots.',
    secondaryCue: 'Breathe through each hold.',
  },
  'Foam Roll — Hip Flexor, Quad, Adductors': {
    primaryCue: 'Work the full length, hold on knots.',
    secondaryCue: 'Relax into the pressure.',
  },
  'Foam Roll — IT Band': {
    primaryCue: 'Side-lying, slow passes from hip to knee.',
    secondaryCue: 'Stack the legs to dial pressure.',
  },
  'Foam Roll — Lats': {
    primaryCue: 'Side-lying with arm overhead.',
    secondaryCue: 'Roll under the armpit, breathe into it.',
  },
  'Foam Roll — T-Spine': {
    primaryCue: 'Mid-back over the roller, support the head.',
    secondaryCue: 'Open the ribs and breathe.',
  },
  'Front Squat': {
    primaryCue: 'Elbows high, sit between the heels.',
    secondaryCue: 'Stay tall through the midline.',
  },
  'Glute Bridge': {
    primaryCue: "Keep spine neutral, don’t arch low back, lift hips, squeeze glutes, add weight to hips if you can.",
    secondaryCue: "",
  },
  'Goblet Squat': {
    primaryCue: 'Elbows inside the knees at the bottom.',
    secondaryCue: 'Smooth tempo, no rushing.',
  },
  'Groin Squeeze': {
    primaryCue: 'Squeeze the ball between the knees — or your fists if no ball.',
    secondaryCue: 'Hold each squeeze for a beat.',
  },
  'Half-Kneeling Single-Arm Overhead Press': {
    primaryCue: 'Half-kneel, press straight overhead, knee on ground = arm overhead.',
    secondaryCue: 'Fight the rotation, ribs stay down.',
  },
  'Hammer Curl': {
    primaryCue: 'Neutral grip, no swinging.',
    secondaryCue: 'Control both directions.',
  },
  'Hamstring Curl': {
    primaryCue: 'Pad should be lower calf area, squeeze heels to butt.',
    secondaryCue: '',
  },
  'Hanging Leg Raise': {
    primaryCue: 'Stay tight through midline, breath.',
    secondaryCue: 'No swinging.',
  },
  'High Box Squat': {
    primaryCue: "High box to minimise soreness, slight pause at box, stay tight through midline.",
    secondaryCue: "",
  },
  'Hill Sprints': {
    primaryCue: 'Drive the knees, lean into the hill.',
    secondaryCue: 'Walk back for full recovery.',
  },
  'Hip 90/90 Stretch': {
    primaryCue: 'Front and back legs at 90 degrees.',
    secondaryCue: 'Stay tall, shift weight gently.',
  },
  'Hip Thrusts': {
    primaryCue: 'Drive through the heels, squeeze at the top.',
    secondaryCue: 'Ribs down, no overextending.',
  },
  'Hollow Hold': {
    primaryCue: "Stay tight, remember to breathe, low back pinned to floor.",
    secondaryCue: "",
  },
  'Incline Bench': {
    primaryCue: 'Set the blades on the incline.',
    secondaryCue: 'Press through the palms.',
  },
  'Incline DB Bench': {
    primaryCue: 'Elbows at 45 degrees, full stretch at the bottom.',
    secondaryCue: 'Drive up and together.',
  },
  'Incline Dumbbell Curl': {
    primaryCue: 'Let the arm stretch at the bottom.',
    secondaryCue: 'Slow curl, squeeze at the top.',
  },
  'Incline Treadmill Walk': {
    primaryCue: 'Moderate incline, steady pace.',
    secondaryCue: 'No holding the rails.',
  },
  'Incline Y Raise': {
    primaryCue: 'Chest on the incline, arms to a Y.',
    secondaryCue: 'Light weight, pause at the top.',
  },
  'Inverted Row (Bodyweight)': {
    primaryCue: 'Straight body, pull chest to bar.',
    secondaryCue: 'Scale with foot position.',
  },
  'Jefferson Curl': {
    primaryCue: 'Tuck your chin and slowly roll down one segment at a time. Add small weight when easy',
    secondaryCue: '',
  },
  'Jump Squats': {
    primaryCue: 'Quarter squat, jump with intent.',
    secondaryCue: 'Land soft, reset between reps.',
  },
  'Kettlebell Swings': {
    primaryCue: 'Snap the hips, KB should come back down fast.',
    secondaryCue: 'Power from hips, don’t lift with arms.',
  },
  'Kneeling Jump': {
    primaryCue: "Start in kneeling position, jump onto feet, land in a squat.",
    secondaryCue: "",
  },
  'Lacrosse Ball Glute Release': {
    primaryCue: 'Sit on the ball, shift to find the spot.',
    secondaryCue: 'Hold 30-60 seconds per side.',
  },
  'Landmine Press': {
    primaryCue: 'Split stance, press at an angle, follow the arc.',
    secondaryCue: 'Stable base, strong finish.',
  },
  'Lat Pulldown': {
    primaryCue: 'Pull to the collarbone, lean slightly back, push chest at bottom.',
    secondaryCue: 'Squeeze at the bottom, slow return.',
  },
  'Lat Stretch': {
    primaryCue: 'Hold a rack or doorframe, hips back.',
    secondaryCue: 'Sink the chest, breathe under the armpit, slight lean to one side.',
  },
  'Lateral Bounds': {
    primaryCue: 'Push off outside leg.',
    secondaryCue: 'Stick each landing before the next.',
  },
  'Lateral Jump': {
    primaryCue: "Jump off outside leg to the side, turn in air and land in a squat.",
    secondaryCue: "",
  },
  'Lateral Raise': {
    primaryCue: 'Light weight, lead with the elbows.',
    secondaryCue: 'No momentum, strict form.',
  },
  'Lateral Lunge': {
    primaryCue: "Big step sideways, sit into that hip.",
    secondaryCue: "Knee tracks over toes, drive back to standing.",
  },
  'Leg Extension': {
    primaryCue: 'Drive feet to ceiling, lean back slightly if possible.',
    secondaryCue: '',
  },
  'Leg Press': {
    primaryCue: 'Full depth without lower back rounding.',
    secondaryCue: 'Push through the whole foot.',
  },
  'Light Circuits': {
    primaryCue: 'Low intensity rounds, controlled transitions.',
    secondaryCue: 'This is recovery, not intensity.',
  },
  'Light Walk or Stationary Bike': {
    primaryCue: 'Conversational effort, keep moving.',
    secondaryCue: 'This is blood flow, not training.',
  },
  'Long Run': {
    primaryCue: 'Steady aerobic pace, find your rhythm.',
    secondaryCue: 'Settle in, breathe steadily.',
  },
  'Long-Lever Copenhagen': {
    primaryCue: 'Top ankle supported, hips high.',
    secondaryCue: 'Don’t let hips drop.',
  },
  'Lying Dumbbell Curl': {
    primaryCue: 'Lie flat, arms stretch at the bottom.',
    secondaryCue: 'Control both directions, no momentum.',
  },
  'McGill Sit Up': {
    primaryCue: 'Hands under the lower back, lift the shoulder blades only.',
    secondaryCue: 'Drive low back into hands slightly.',
  },
  'Neutral-Grip Pulldown': {
    primaryCue: 'Use V grip attachment, puff chest out as hands come down.',
    secondaryCue: '',
  },
  'Nordic Lower': {
    primaryCue: 'Lower as slow as you can.',
    secondaryCue: 'Fight gravity the whole way down.',
  },
  'Open Book Thoracic Rotation': {
    primaryCue: 'Knees stacked, rotate through the upper back.',
    secondaryCue: 'Follow the hand with the eyes.',
  },
  'Outdoor Walk': {
    primaryCue: 'Easy pace, arms swinging naturally.',
    secondaryCue: 'Get outside and move.',
  },
  'Overhead Carry': {
    primaryCue: 'Stand tall, arms overhead, stay tight through midline.',
    secondaryCue: 'Weight shown is per hand.',
  },
  'Overhead Press': {
    primaryCue: 'Ribs down, bar finishes over the ears.',
    secondaryCue: 'Press hard and finish strong.',
  },
  'Overhead Tricep Extension': {
    primaryCue: 'Full stretch at the bottom, press to lockout.',
    secondaryCue: 'Elbows stay pointed forward.',
  },
  'Pigeon Stretch': {
    primaryCue: 'Front shin across bench, square the hips.',
    secondaryCue: 'Sink in and breathe.',
  },
  'Pissing Dog Against Wall': {
    primaryCue: 'Keep back neutral, lift outside leg out and up, can use bent leg to start',
    secondaryCue: '',
  },
  'Plank': {
    primaryCue: "Keep spine neutral, brace midline, squeeze butt, breathe.",
    secondaryCue: "",
  },
  'Pull-Ups': {
    primaryCue: 'Dead hang to chin over bar, any grip is fine.',
    // The appended line absorbs the retired "weighted pull-ups" entry: one
    // movement, loaded when the athlete is ready (Sam, locked-list CUE EDIT).
    secondaryCue: 'Initiate with the lats, not the arms. Add weight once bodyweight sets feel easy.',
  },
  'Pogo Hops': {
    primaryCue: "Stand tall, jump and then bounce off the balls of your feet.",
    secondaryCue: "",
  },
  'Push-ups': {
    primaryCue: 'Body in a straight line, elbows at 45.',
    secondaryCue: 'Chest to floor, full lockout.',
  },
  'Quality Sprints': {
    primaryCue: 'Max intent every rep, full recovery between.',
    secondaryCue: 'If speed drops, the set is done.',
  },
  'QL Back Extension': {
    primaryCue: "Pin legs in 45 deg hyper, bend sideways slowly, don’t push too far, just enough to feel tension.",
    secondaryCue: "",
  },
  'RDLs': {
    primaryCue: 'Push hips back, bar slides down leg.',
    secondaryCue: 'Feel the hamstrings load on the way down.',
  },
  'Rear Delt Fly': {
    primaryCue: 'Rest on incline bench, pinch the shoulder blades.',
    secondaryCue: 'Light weight, feel the squeeze.',
  },
  'Reverse Lunges': {
    primaryCue: 'Step back, drop straight down.',
    secondaryCue: 'Front knee tracks over the toe.',
  },
  'RFE Split Squat Jump': {
    primaryCue: 'Back foot on bench, slight lean forward, jump straight up off the front leg.',
    secondaryCue: 'Land soft and controlled.',
  },
  'Row Intervals': {
    primaryCue: 'Full catch, explosive drive.',
    secondaryCue: 'Maintain power, recover completely.',
  },
  'Scap Push-Up': {
    primaryCue: 'Keep elbows locked, glide shoulder blades.',
    secondaryCue: 'Move slowly, no sagging hips.',
  },
  'Scap Pull Ups': {
    primaryCue: "dead hang from bar and relax, pull yourself higher only using your shoulder blades, don't bend arms",
    secondaryCue: '',
  },
  'Seated Cable Row': {
    primaryCue: 'Sit tall, pull to the sternum.',
    secondaryCue: 'Slow on the return.',
  },
  'Seated Calf Raise': {
    primaryCue: 'Bent knee, full range top to bottom.',
    secondaryCue: 'Slow tempo, no bouncing.',
  },
  'Seated DB Press': {
    primaryCue: 'Back flat against the pad, press to lockout.',
    secondaryCue: 'Ribs down, control the descent.',
  },
  'Shrugs': {
    primaryCue: 'Shoulders straight up to ears, no roll.',
    secondaryCue: 'Squeeze at the top, controlled lower.',
  },
  'Side Plank': {
    primaryCue: 'Stack the hips, straight line from head to feet, can add weight to top hip.',
    secondaryCue: 'Breathe behind the brace.',
  },
  'Side Plank Row': {
    primaryCue: "Side plank, row band to top of belly, resist rolling forward.",
    secondaryCue: "",
  },
  'Single-Arm DB Bench Press': {
    primaryCue: 'Fight the rotation.',
    secondaryCue: 'Brace hard through the midline.',
  },
  'Single-Arm DB Row': {
    primaryCue: 'Elbow drives past the torso, pull to belly.',
    secondaryCue: 'Keep the hips and shoulders square.',
  },
  'Single-Arm Lat Pulldown': {
    primaryCue: 'Pull the handle to the shoulder, lead with the lat, V grip attachment.',
    secondaryCue: 'Control the return, full stretch at the top.',
  },
  'Single-Arm Pulldown': {
    primaryCue: 'Use V grip on pulldown machine.',
    secondaryCue: 'Stay tight through midline.',
  },
  'Single-Arm Shrug': {
    primaryCue: 'One side at a time, shoulder straight up.',
    secondaryCue: 'Pause at the top, controlled lower.',
  },
  'Single-Leg Calf Raise': {
    primaryCue: 'Full drop at the bottom, pause, then rise.',
    secondaryCue: 'Three-second lowering.',
  },
  'Single-Leg Hip Thrust': {
    primaryCue: "Upper back on bench, add weight to hips, one leg up, drive hips to sky, squeeze glutes.",
    secondaryCue: "",
  },
  'Single-Leg Leg Press': {
    primaryCue: 'Keep the hips square on the pad.',
    secondaryCue: 'Control on the way down.',
  },
  'Single-Leg RDL': {
    primaryCue: 'Hinge at the hip, soft knee.',
    secondaryCue: 'Balance and control over speed.',
  },
  'Single-Leg Squat (to Box)': {
    primaryCue: 'Sit to the box under control.',
    secondaryCue: 'Keep the knee tracking straight.',
  },
  'Skull Crushers': {
    primaryCue: 'Lower to the sides of the head, press up, use straight or Z bar.',
    secondaryCue: 'Full range, elbows stay in place.',
  },
  'Slant Board Step-Down': {
    primaryCue: "Drive knee forward, tap opposite heel on ground, knee tracks over toes.",
    secondaryCue: "",
  },
  'Speed Bench': {
    primaryCue: 'Light load, explosive intent, pause at chest.',
    secondaryCue: 'Drive hard, fast lockout.',
  },
  'Spanish Squat Hold': {
    primaryCue: "Band behind knees, tension on bands, sit back into a squat and hold.",
    secondaryCue: "",
  },
  'Sprint Intervals': {
    primaryCue: 'Drive through the ground, arms straight.',
    secondaryCue: 'Full recovery between efforts.',
  },
  'Step Ups': {
    primaryCue: 'Use top leg to drive movement.',
    secondaryCue: 'Don’t bounce with leg on ground.',
  },
  'Speed Trap Bar Deadlift': {
    primaryCue: "Wrap band around each side of bar, stand on band, get tight, explode up, control down.",
    secondaryCue: "",
  },
  'Suitcase Carry': {
    primaryCue: 'Walk tall, don’t lean.',
    secondaryCue: 'Don’t rest weight on thigh.',
  },
  'Stir the Pot': {
    primaryCue: "Spine stays neutral, resist rotation through midline.",
    secondaryCue: "",
  },
  'Swiss Ball Hamstring Curl': {
    primaryCue: 'Keep hips high.',
    secondaryCue: 'Curl heels into butt.',
  },
  'Tempo Run': {
    primaryCue: 'Hold the pace, settle into the rhythm.',
    secondaryCue: 'Controlled breathing throughout.',
  },
  'Tib Raises': {
    primaryCue: 'Lean back against wall, lift toes to sky, can use a Tib bar if you have one.',
    secondaryCue: 'Controlled reps, full range.',
  },
  'Toe Stretch': {
    primaryCue: 'Tuck toes under, sit back into the heels.',
    secondaryCue: 'Build tolerance gradually.',
  },
  'Trap Bar Deadlift': {
    primaryCue: 'Tight through the lats, push the floor away.',
    secondaryCue: 'Hips and shoulders rise together.',
  },
  'Tricep Circuit (Dirty 30)': {
    primaryCue: 'Move through all three positions without rest.',
    secondaryCue: 'Empty the triceps by the final rep.',
  },
  'Tricep Pushdown': {
    primaryCue: 'Keep elbows pinned, press to full lockout.',
    secondaryCue: 'Constant tension, no jerking.',
  },
  'Vertical Jump': {
    primaryCue: 'Every rep fast and sharp. Land soft in athletic stance.',
    secondaryCue: 'Stop if reps get slow.',
  },
  'Walking Lunges': {
    primaryCue: 'Long stride, tall through the midline.',
    secondaryCue: 'Steady and deliberate.',
  },
  'Weighted Dead Bug': {
    primaryCue: 'Hold weight plate or dumbbells, extended arms overhead and feet out, low back pinned to ground.',
    secondaryCue: 'Slow extension, full exhale.',
  },
  'Woodchop (Half Kneeling)': {
    primaryCue: 'Drive with the midline, arms guide.',
    secondaryCue: 'Controlled rotation, not a throw.',
  },
  'Woodchop (Standing)': {
    primaryCue: 'Rotate through the torso, not the arms.',
    secondaryCue: 'Feet stay planted.',
  },
  'World\'s Greatest Stretch': {
    primaryCue: 'Lunge deep, elbow to instep.',
    secondaryCue: 'Then rotate and reach to the sky.',
  },
  'Z-Press': {
    primaryCue: 'Sit up tall, slight lean back when pressing.',
    secondaryCue: 'Stay tight through midline. Can be done seated on a bench, or with dumbbells.',
  },
  // Sam's locked list pools this into Upper push but authored no cue for it, so
  // the existing Bible pressing-injury-swap cue is what ships. Recorded in the
  // changeset's ADDITIONS entry ("Cue not authored — ships the existing …").
  'Single-Arm DB Floor Press': {
    primaryCue: 'Brace the midline, press from the floor.',
    secondaryCue: "Don't let the torso rotate.",
  },
};
