/**
 * Exercise Cues — Static coaching cue library.
 *
 * Each exercise gets a primaryCue (mechanics) and secondaryCue (intent/control).
 * Cues tell the athlete HOW to perform the movement. Nothing about why it's
 * in the program, what day it is, or what comes next.
 *
 * Fallback: if an exercise has no entry, the system uses the MovementPattern
 * from exerciseTags.ts to select a family-level cue pair.
 *
 * PROVENANCE: Authored by Sam, 2026-07-23. Additions require Sam sign-off.
 *
 * EXERCISE_CUES is generated from Sam's authored sheet
 * (docs/CUE_CHANGESET_2026-07-23.md, "Final cue library"). It is not edited by
 * hand: `src/__tests__/authoredCueLibraryTests.ts` parses that document and
 * fails the build on any divergence, so a reworded cue cannot ship.
 *
 * ADDING CUES:
 *   Add to the changeset document first, with Sam's sign-off, then mirror it
 *   here. primaryCue = mechanics, position, range, bracing.
 *   secondaryCue = intent, control, tempo, tension.
 *   3–8 words ideal, 18 words hard cap. No fluff.
 */

import type { MovementPattern } from './exerciseTags';

// ─── Types ───

export interface ExerciseCue {
  primaryCue: string;
  secondaryCue: string;
}

// ─── Part 1: Family Rules ───
//
// Each movement family defines what the primary and secondary cues
// should focus on, and what language to avoid.
//
// These rules are documentation for authors AND the input to the
// fallback system. The FAMILY_FALLBACKS record below encodes the
// default cue pair for each family.

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

// ─── Part 4: Fallback System ───
//
// When an exercise has no entry in EXERCISE_CUES, look up its
// MovementPattern from EXERCISE_TAGS and return the family fallback.
// This guarantees every exercise gets a useful cue pair, never
// "Focus on proper form."

export const FAMILY_FALLBACKS: Record<MovementPattern, ExerciseCue> = {
  squat:            { primaryCue: 'Sit into the hips, chest up.',       secondaryCue: 'Control the descent.' },
  lunge:            { primaryCue: 'Front shin vertical, trunk tall.',   secondaryCue: 'Steady on each rep.' },
  hinge:            { primaryCue: 'Push hips back, flat back.',         secondaryCue: 'Feel the hamstrings load.' },
  plyo:             { primaryCue: 'Land soft, absorb with hips.',       secondaryCue: 'Max intent, quality reps.' },
  horizontal_push:  { primaryCue: 'Set the shoulder blades, then press.', secondaryCue: 'Control down, drive up.' },
  vertical_push:    { primaryCue: 'Ribs down, press to full lockout.', secondaryCue: 'Press hard, finish strong.' },
  horizontal_pull:  { primaryCue: 'Pull to the torso, retract scaps.', secondaryCue: 'Squeeze at the top, slow return.' },
  vertical_pull:    { primaryCue: 'Start from a dead hang, lead with lats.', secondaryCue: 'Control the lowering.' },
  carry:            { primaryCue: 'Tall posture, shoulders packed.',    secondaryCue: 'Breathe and walk steady.' },
  core:             { primaryCue: 'Brace through the trunk.',          secondaryCue: 'Hold without shifting.' },
  isolation_upper:  { primaryCue: 'Control the full range.',           secondaryCue: 'Squeeze at peak contraction.' },
  isolation_lower:  { primaryCue: 'Control the full range.',           secondaryCue: 'Squeeze at peak contraction.' },
  conditioning:     { primaryCue: 'Hold the prescribed effort.',       secondaryCue: 'Breathe rhythmically.' },
};

// ─── Part 2: Lookup Function ───

/**
 * Get the coaching cue pair for an exercise.
 *
 * Lookup order:
 *   1. Exact name match in EXERCISE_CUES
 *   2. Case-insensitive match in EXERCISE_CUES
 *   3. MovementPattern fallback from FAMILY_FALLBACKS
 *   4. Safe generic fallback (should never reach this)
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

  // 3. Family fallback
  if (movementPattern && FAMILY_FALLBACKS[movementPattern]) {
    return FAMILY_FALLBACKS[movementPattern];
  }

  // 4. Safe generic (never "Focus on proper form")
  return {
    primaryCue: 'Control the movement.',
    secondaryCue: 'Stay tight through the full range.',
  };
}

// ─── Part 3: Exercise Cue Library ───

export const EXERCISE_CUES: Record<string, ExerciseCue> = {
  '90/90 Breathing': {
    primaryCue: 'Knees and hips at 90, exhale fully.',
    secondaryCue: 'Pause at the bottom of each breath.',
  },
  'Ab Wheel': {
    primaryCue: 'Roll out only as far as you can control.',
    secondaryCue: 'Ribs down, slightly rounded back, no sagging at hips',
  },
  'Abductor Machine': {
    primaryCue: 'Push the knees apart against the pads.',
    secondaryCue: '',
  },
  'Adductor Machine': {
    primaryCue: 'Squeeze knees together',
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
  'Back Squat': {
    primaryCue: 'Sit into the hips, chest up.',
    secondaryCue: 'Own the bottom position.',
  },
  'Band Pallof Press': {
    primaryCue: 'Press out, resist the pull.',
    secondaryCue: 'Hips stay square, slight knee and hip bend',
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
  'Barbell Row': {
    primaryCue: 'Hinge forward, pull to the belly.',
    secondaryCue: 'Squeeze the shoulder blades at the top.',
  },
  'Bear Carry': {
    primaryCue: 'Hug the load tight, ribs down,',
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
    primaryCue: 'Extend arm and opposite leg, no shift, tuck hips under you',
    secondaryCue: 'Slow and controlled.',
  },
  'Bottoms-Up KB Press': {
    primaryCue: 'Bell vertical, wrist stacked.',
    secondaryCue: 'Press smooth, keep ribs down.',
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
    primaryCue: 'Slight lean forward',
    secondaryCue: 'Control the descent, no bouncing.',
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
    primaryCue: 'Jump to the top, lower slowly, can pull yourself up if you can',
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
    primaryCue: 'Top leg on the bench, drive through the inner thigh',
    secondaryCue: 'Hold tension, no dropping.',
  },
  'Couch Stretch': {
    primaryCue: 'Back knee to the wall, squeeze the glute.',
    secondaryCue: 'Tall trunk, no arching.',
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
    primaryCue: 'Keep bar close, get tight through the lats',
    secondaryCue: 'Flat back from start to lockout.',
  },
  'Deep Squat Hold': {
    primaryCue: 'Sit between the heels, chest up.',
    secondaryCue: 'Breathe and hold position.',
  },
  'Depth Jumps': {
    primaryCue: 'Step off, explode off the ground',
    secondaryCue: 'Minimum ground contact time.',
  },
  'Dips': {
    primaryCue: 'Lean slightly forward, elbows back.',
    secondaryCue: 'Control the descent.',
  },
  'Dumbbell Kickback': {
    primaryCue: 'One knee on bench, one hand on bench, extend to full lockout.',
    secondaryCue: 'Squeeze at the top, slow return.',
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
  'Explosive Landmine Press': {
    primaryCue: 'Split stance, drive hard into the bar.',
    secondaryCue: 'Full lockout, reset quickly.',
  },
  'Face Pull': {
    primaryCue: 'Pull to the forehead, open the hands out.',
    secondaryCue: 'Squeeze the rear delts, slow return.',
  },
  'Farmer Carry': {
    primaryCue: 'Shoulders packed, walk tall.',
    secondaryCue: 'Breathe and keep moving.',
  },
  'Flush Run': {
    primaryCue: 'Easy jog, nothing above zone one or two',
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
    secondaryCue: 'Stay tall through the trunk.',
  },
  'Goblet Squat': {
    primaryCue: 'Elbows inside the knees at the bottom.',
    secondaryCue: 'Smooth tempo, no rushing.',
  },
  'Groin Squeeze (Med ball)': {
    primaryCue: 'Squeeze the ball between the knees.',
    secondaryCue: 'Hold each squeeze for a beat.',
  },
  'Half-Kneeling Single-Arm Overhead Press': {
    primaryCue: 'Half-kneel, press straight overhead, knee on ground = arm overhead',
    secondaryCue: 'Fight the rotation, ribs stay down.',
  },
  'Hammer Curl': {
    primaryCue: 'Neutral grip, no swinging.',
    secondaryCue: 'Control both directions.',
  },
  'Hanging Leg Raise': {
    primaryCue: 'Stay tight through midline, breath',
    secondaryCue: 'No swinging.',
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
  'Incline Bench': {
    primaryCue: 'Set the blades on the incline',
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
  'Jump Squats': {
    primaryCue: 'Quarter squat, jump with intent.',
    secondaryCue: 'Land soft, reset between reps.',
  },
  'Kettlebell Swings': {
    primaryCue: 'Snap the hips, KB should come back down fast',
    secondaryCue: 'Power from hips, don’t lift with arms',
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
    primaryCue: 'Pull to the collarbone, lean slightly back, push chest at bottom',
    secondaryCue: 'Squeeze at the bottom, slow return.',
  },
  'Lat Stretch': {
    primaryCue: 'Hold a rack or doorframe, hips back.',
    secondaryCue: 'Sink the chest, breathe under the armpit, slight lean to one side',
  },
  'Lateral Bounds': {
    primaryCue: 'Push off outside leg',
    secondaryCue: 'Stick each landing before the next.',
  },
  'Lateral Raise': {
    primaryCue: 'Light weight, lead with the elbows.',
    secondaryCue: 'No momentum, strict form.',
  },
  'Leg Extension': {
    primaryCue: 'Drive feet to ceiling, lean back slightly if possible',
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
  'Light Skipping': {
    primaryCue: 'Soft ground contacts, stay light.',
    secondaryCue: 'Easy rhythm, not intensity.',
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
    secondaryCue: 'Don’t let hips drop',
  },
  'Lying Dumbbell Curl': {
    primaryCue: 'Lie flat, arms stretch at the bottom.',
    secondaryCue: 'Control both directions, no momentum.',
  },
  'McGill Sit Up': {
    primaryCue: 'Hands under the lower back, lift the shoulder blades only.',
    secondaryCue: 'Drive low back into hands slightly',
  },
  'Neutral-Grip Pulldown': {
    primaryCue: 'Use V grip attachment, puff chest out as hands come down',
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
    primaryCue: 'Stand tall, arms overhead, stay tight through midline',
    secondaryCue: '',
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
  'Pull-Ups': {
    primaryCue: 'Dead hang to chin over bar, any grip is fine',
    secondaryCue: 'Initiate with the lats, not the arms.',
  },
  'Push-ups': {
    primaryCue: 'Body in a straight line, elbows at 45.',
    secondaryCue: 'Chest to floor, full lockout.',
  },
  'Quality Sprints': {
    primaryCue: 'Max intent every rep, full recovery between.',
    secondaryCue: 'If speed drops, the set is done.',
  },
  'RDLs': {
    primaryCue: 'Push hips back, bar slides down leg',
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
  'Row Intervals': {
    primaryCue: 'Full catch, explosive drive.',
    secondaryCue: 'Maintain power, recover completely.',
  },
  'Scap Push-Up': {
    primaryCue: 'Keep elbows locked, glide shoulder blades.',
    secondaryCue: 'Move slowly, no sagging hips.',
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
    primaryCue: 'Stack the hips, straight line from head to feet, can add weight to top hip',
    secondaryCue: 'Breathe behind the brace.',
  },
  'Single-Arm DB Bench Press': {
    primaryCue: 'Fight the rotation',
    secondaryCue: 'Brace hard through the trunk.',
  },
  'Single-Arm DB Row': {
    primaryCue: 'Elbow drives past the torso, pull to belly',
    secondaryCue: 'Keep the hips and shoulders square.',
  },
  'Single-Arm Lat Pulldown': {
    primaryCue: 'Pull the handle to the shoulder, lead with the lat, V grip attachment',
    secondaryCue: 'Control the return, full stretch at the top.',
  },
  'Single-Arm Pulldown': {
    primaryCue: 'Use V grip on pulldown machine',
    secondaryCue: 'Stay tight through midline',
  },
  'Single-Arm Shrug': {
    primaryCue: 'One side at a time, shoulder straight up.',
    secondaryCue: 'Pause at the top, controlled lower.',
  },
  'Single-Leg Calf Raise': {
    primaryCue: 'Full drop at the bottom, pause, then rise.',
    secondaryCue: 'Three-second lowering.',
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
    primaryCue: 'Lower to the sides of the head, press up, use straight or Z bar',
    secondaryCue: 'Full range, elbows stay in place.',
  },
  'Speed Bench': {
    primaryCue: 'Light load, explosive intent, pause at chest.',
    secondaryCue: 'Drive hard, fast lockout.',
  },
  'Sprint Intervals': {
    primaryCue: 'Drive through the ground, arms straight.',
    secondaryCue: 'Full recovery between efforts.',
  },
  'Step Ups': {
    primaryCue: 'Use top leg to drive movement',
    secondaryCue: 'Don’t bounce with leg on ground',
  },
  'Suitcase Carry': {
    primaryCue: 'Walk tall, don’t lean',
    secondaryCue: 'Don’t rest weight on thigh',
  },
  'Swiss Ball Hamstring Curl': {
    primaryCue: 'Keep hips high,',
    secondaryCue: 'Curl heels into butt',
  },
  'Tempo Run': {
    primaryCue: 'Hold the pace, settle into the rhythm.',
    secondaryCue: 'Controlled breathing throughout.',
  },
  'Tib Raises': {
    primaryCue: 'Lean back against wall, lift toes to sky, can use a Tib bar if you have one',
    secondaryCue: 'Controlled reps, full range.',
  },
  'Toe Stretch': {
    primaryCue: 'Tuck toes under, sit back into the heels.',
    secondaryCue: 'Build tolerance gradually.',
  },
  'Trap Bar Deadlift': {
    primaryCue: 'Tight through the lats, push the floor away',
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
  'Walking Lunges': {
    primaryCue: 'Long stride, trunk upright.',
    secondaryCue: 'Steady and deliberate.',
  },
  'Weighted Dead Bug': {
    primaryCue: 'Hold weight plate or dumbbells, extended arms overhead and feet out, low back pinned to ground',
    secondaryCue: 'Slow extension, full exhale.',
  },
  'Woodchop (Half Kneeling)': {
    primaryCue: 'Drive with the trunk, arms guide.',
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
    primaryCue: 'Sit up tall, slight lean back when pressing',
    secondaryCue: 'Stay tight through midline. Can be done seated on a bench, or with dumbbells.',
  },
  // Not in Sam's sheet by design — the Bible's pressing injury-swap.
  'Single-Arm DB Floor Press': {
    primaryCue: 'Brace the trunk, press from the floor.',
    secondaryCue: "Don't let the torso rotate.",
  },
};
