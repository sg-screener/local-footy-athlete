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
 * ADDING CUES:
 *   Append to EXERCISE_CUES. Follow the rules in FAMILY_RULES.
 *   primaryCue = mechanics, position, range, bracing.
 *   secondaryCue = intent, control, tempo, tension.
 *   3–8 words ideal, 12 words hard cap. No full sentences. No fluff.
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

  // ═══════════════════════════════════════════════════
  // SQUAT
  // ═══════════════════════════════════════════════════

  'Back Squat': {
    primaryCue: 'Sit into the hips, chest up.',
    secondaryCue: 'Own the bottom position.',
  },
  'Front Squat': {
    primaryCue: 'Elbows high, sit between the heels.',
    secondaryCue: 'Stay tall through the trunk.',
  },
  'Goblet Squat': {
    primaryCue: 'Elbows inside the knees at the bottom.',
    secondaryCue: 'Smooth tempo, no rushing.',
  },
  'Box Squat': {
    primaryCue: 'Sit back to the box, pause, then drive.',
    secondaryCue: 'Explode off the box.',
  },
  'Leg Press': {
    primaryCue: 'Full depth without lower back rounding.',
    secondaryCue: 'Push through the whole foot.',
  },
  'Single-Leg Leg Press': {
    primaryCue: 'Keep the hips square on the pad.',
    secondaryCue: 'Control on the way down.',
  },

  // ═══════════════════════════════════════════════════
  // HINGE
  // ═══════════════════════════════════════════════════

  'Trap Bar Deadlift': {
    primaryCue: 'Push the floor away.',
    secondaryCue: 'Hips and shoulders rise together.',
  },
  'Deadlift': {
    primaryCue: 'Wedge into the bar, then push the floor.',
    secondaryCue: 'Flat back from start to lockout.',
  },
  'RDLs': {
    primaryCue: 'Push hips back, bar stays close.',
    secondaryCue: 'Feel the hamstrings load on the way down.',
  },
  'Single-Leg RDL': {
    primaryCue: 'Hinge at the hip, soft knee.',
    secondaryCue: 'Balance and control over speed.',
  },
  'Hip Thrusts': {
    primaryCue: 'Drive through the heels, squeeze at the top.',
    secondaryCue: 'Ribs down, no overextending.',
  },
  'Kettlebell Swings': {
    primaryCue: 'Snap the hips, arms are just along for the ride.',
    secondaryCue: 'Power from the hinge, not the arms.',
  },
  'Nordic Lower': {
    primaryCue: 'Lower as slow as you can.',
    secondaryCue: 'Fight gravity the whole way down.',
  },

  // ═══════════════════════════════════════════════════
  // LUNGE / SPLIT SQUAT
  // ═══════════════════════════════════════════════════

  'Bulgarian Split Squats': {
    primaryCue: 'Front shin stays vertical.',
    secondaryCue: 'Control the descent, no bouncing.',
  },
  'Walking Lunges': {
    primaryCue: 'Long stride, trunk upright.',
    secondaryCue: 'Steady and deliberate.',
  },
  'Reverse Lunges': {
    primaryCue: 'Step back, drop straight down.',
    secondaryCue: 'Front knee tracks over the toe.',
  },
  'Step Ups': {
    primaryCue: 'Drive through the top foot only.',
    secondaryCue: "Don't push off the back leg.",
  },
  'Single-Leg Squat (to Box)': {
    primaryCue: 'Sit to the box under control.',
    secondaryCue: 'Keep the knee tracking straight.',
  },

  // ═══════════════════════════════════════════════════
  // HORIZONTAL PUSH
  // ═══════════════════════════════════════════════════

  'Bench Press': {
    primaryCue: 'Shoulder blades pinched, feet planted.',
    secondaryCue: 'Bar to chest, press hard to lockout.',
  },
  'DB Bench Press': {
    primaryCue: 'Shoulder blades set on the bench.',
    secondaryCue: 'Control the dumbbells down and drive.',
  },
  'Incline Bench': {
    primaryCue: 'Set the blades on the incline.',
    secondaryCue: 'Press through the palms.',
  },
  'Incline DB Bench': {
    primaryCue: 'Elbows at 45 degrees, full stretch at the bottom.',
    secondaryCue: 'Drive up and together.',
  },
  'Close Grip Bench': {
    primaryCue: 'Hands inside shoulder width, elbows tight.',
    secondaryCue: 'Triceps do the work.',
  },
  'Push-ups': {
    primaryCue: 'Body in a straight line, elbows at 45.',
    secondaryCue: 'Chest to floor, full lockout.',
  },
  'Dips': {
    primaryCue: 'Lean slightly forward, elbows back.',
    secondaryCue: 'Control the descent.',
  },
  'Single-Arm DB Floor Press': {
    primaryCue: 'Brace the trunk, press from the floor.',
    secondaryCue: "Don't let the torso rotate.",
  },
  'Single-Arm DB Bench Press': {
    primaryCue: 'Fight the rotation, press even.',
    secondaryCue: 'Brace hard through the trunk.',
  },

  // ═══════════════════════════════════════════════════
  // VERTICAL PUSH
  // ═══════════════════════════════════════════════════

  'Overhead Press': {
    primaryCue: 'Ribs down, bar finishes over the ears.',
    secondaryCue: 'Press hard and finish strong.',
  },
  'DB Shoulder Press': {
    primaryCue: 'Start at the shoulders, press to lockout.',
    secondaryCue: 'No arching through the lower back.',
  },
  'Landmine Press': {
    primaryCue: 'Press at an angle, follow the arc.',
    secondaryCue: 'Stable base, strong finish.',
  },

  // ═══════════════════════════════════════════════════
  // HORIZONTAL PULL
  // ═══════════════════════════════════════════════════

  'Barbell Row': {
    primaryCue: 'Hinge forward, pull to the belly.',
    secondaryCue: 'Squeeze the shoulder blades at the top.',
  },
  'Chest Supported Row': {
    primaryCue: 'Chest on the pad, pull straight back.',
    secondaryCue: 'Retract and hold for a beat.',
  },
  'Seated Cable Row': {
    primaryCue: 'Sit tall, pull to the sternum.',
    secondaryCue: 'Slow on the return.',
  },
  'Single-Arm DB Row': {
    primaryCue: 'Elbow drives past the torso.',
    secondaryCue: 'Keep the hips and shoulders square.',
  },

  // ═══════════════════════════════════════════════════
  // VERTICAL PULL
  // ═══════════════════════════════════════════════════

  'Pull-Ups': {
    primaryCue: 'Dead hang to chin over bar.',
    secondaryCue: 'Initiate with the lats, not the arms.',
  },
  'Chin-Ups': {
    primaryCue: 'Palms facing you, full range.',
    secondaryCue: 'Control the lowering.',
  },
  'Lat Pulldown': {
    primaryCue: 'Pull to the collarbone, lean slightly back.',
    secondaryCue: 'Squeeze at the bottom, slow return.',
  },

  // ═══════════════════════════════════════════════════
  // CARRY
  // ═══════════════════════════════════════════════════

  'Farmer Carry': {
    primaryCue: 'Shoulders packed, walk tall.',
    secondaryCue: 'Breathe and keep moving.',
  },
  'Suitcase Carry': {
    primaryCue: "Stay tall - don't lean into the weight.",
    secondaryCue: 'Resist the side bend.',
  },
  'Bear Carry': {
    primaryCue: 'Hug the load tight, ribs down.',
    secondaryCue: 'Short steady steps, no leaning back.',
  },
  'Bottoms-Up KB Carry': {
    primaryCue: 'Bell vertical, wrist stacked over elbow.',
    secondaryCue: 'Walk slowly, keep the shoulder packed.',
  },

  // ═══════════════════════════════════════════════════
  // TRUNK / CORE
  // ═══════════════════════════════════════════════════

  'Dead Bug': {
    primaryCue: 'Lower back stays flat on the floor.',
    secondaryCue: 'Opposite arm and leg, slow.',
  },
  'Bird Dog': {
    primaryCue: 'Extend arm and opposite leg, no shift.',
    secondaryCue: 'Slow and controlled.',
  },
  'Side Plank': {
    primaryCue: 'Stack the hips, straight line from head to feet.',
    secondaryCue: 'Breathe behind the brace.',
  },
  'Woodchop (Half Kneeling)': {
    primaryCue: 'Drive with the trunk, arms guide.',
    secondaryCue: 'Controlled rotation, not a throw.',
  },
  'Woodchop (Standing)': {
    primaryCue: 'Rotate through the torso, not the arms.',
    secondaryCue: 'Feet stay planted.',
  },
  'Ab Wheel': {
    primaryCue: 'Roll out only as far as you can control.',
    secondaryCue: 'Ribs down, no sagging.',
  },
  'Hanging Leg Raise': {
    primaryCue: 'Curl the pelvis, not just the legs.',
    secondaryCue: 'No swinging.',
  },
  'Banded Dead Bug': {
    primaryCue: 'Drive feet into the band, ribs down.',
    secondaryCue: 'Lower back stays glued to the floor.',
  },
  'Weighted Dead Bug': {
    primaryCue: 'Dumbbells locked overhead, ribs stitched down.',
    secondaryCue: 'Slow extension, full exhale.',
  },
  'McGill Sit Up': {
    primaryCue: 'Hands under the lower back, lift the shoulder blades only.',
    secondaryCue: 'No spinal flexion - short, controlled lift.',
  },

  // ═══════════════════════════════════════════════════
  // GROIN / ADDUCTOR
  // ═══════════════════════════════════════════════════

  'Copenhagen Plank': {
    primaryCue: 'Top leg on the bench, drive through the inner thigh.',
    secondaryCue: 'Hold tension, no dropping.',
  },
  'Short-Lever Copenhagen': {
    primaryCue: 'Top knee supported, hips stacked.',
    secondaryCue: 'Controlled hold, no groin pinch.',
  },
  'Long-Lever Copenhagen': {
    primaryCue: 'Top ankle supported, hips high.',
    secondaryCue: 'Short controlled holds only.',
  },
  'Groin Squeeze (Band Adductor)': {
    primaryCue: 'Squeeze the band between the knees.',
    secondaryCue: 'Hold each squeeze for a beat.',
  },

  // ═══════════════════════════════════════════════════
  // CALF
  // ═══════════════════════════════════════════════════

  'Single-Leg Calf Raise': {
    primaryCue: 'Full drop at the bottom, pause, then rise.',
    secondaryCue: 'Three-second lowering.',
  },
  'Calf Raises': {
    primaryCue: 'Full heel drop, rise onto the big toe.',
    secondaryCue: 'Pause high, lower slowly.',
  },
  'Seated Calf Raise': {
    primaryCue: 'Bent knee, full range top to bottom.',
    secondaryCue: 'Slow tempo, no bouncing.',
  },
  'Tib Raise': {
    primaryCue: 'Pull the toes up against the resistance.',
    secondaryCue: 'Controlled reps, full range.',
  },
  'Tibialis Raise': {
    primaryCue: 'Pull the toes up against the resistance.',
    secondaryCue: 'Controlled reps, full range.',
  },

  // ═══════════════════════════════════════════════════
  // HAMSTRING (LIGHT / PREHAB)
  // ═══════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════
  // SHOULDER HEALTH
  // ═══════════════════════════════════════════════════

  'Banded External Rotation': {
    primaryCue: 'Elbow at 90 degrees, rotate against the band.',
    secondaryCue: 'Slow and controlled arc.',
  },
  'Scap Push-Up': {
    primaryCue: 'Keep elbows locked, glide shoulder blades.',
    secondaryCue: 'Move slowly, no sagging hips.',
  },
  'Bottoms-Up KB Press': {
    primaryCue: 'Bell vertical, wrist stacked.',
    secondaryCue: 'Press smooth, keep ribs down.',
  },
  // ═══════════════════════════════════════════════════
  // PLYO / JUMP
  // ═══════════════════════════════════════════════════

  'Box Jumps': {
    primaryCue: 'Jump up, step down.',
    secondaryCue: 'Land soft, absorb with the hips.',
  },
  'Broad Jumps': {
    primaryCue: 'Drive forward, land balanced.',
    secondaryCue: 'Stick the landing.',
  },
  'Lateral Bounds': {
    primaryCue: 'Push off hard, land and hold.',
    secondaryCue: 'Stick each landing before the next.',
  },
  'Depth Jumps': {
    primaryCue: 'Step off, hit the ground, explode.',
    secondaryCue: 'Minimum ground contact time.',
  },
  'Jump Squats': {
    primaryCue: 'Quarter squat, jump with intent.',
    secondaryCue: 'Land soft, reset between reps.',
  },

  // ═══════════════════════════════════════════════════
  // ARMS / PUMP
  // ═══════════════════════════════════════════════════

  'Hammer Curl': {
    primaryCue: 'Neutral grip, no swinging.',
    secondaryCue: 'Control both directions.',
  },
  'Incline Dumbbell Curl': {
    primaryCue: 'Let the arm stretch at the bottom.',
    secondaryCue: 'Slow curl, squeeze at the top.',
  },
  'Overhead Tricep Extension': {
    primaryCue: 'Full stretch at the bottom, press to lockout.',
    secondaryCue: 'Elbows stay pointed forward.',
  },
  'Cable Face Pull': {
    primaryCue: 'Pull to the forehead, open the hands out.',
    secondaryCue: 'Squeeze the rear delts.',
  },
  'Rear Delt Fly': {
    primaryCue: 'Bent over, pinch the shoulder blades.',
    secondaryCue: 'Light weight, feel the squeeze.',
  },
  'Chest-Supported DB Row': {
    primaryCue: 'Chest on the pad, pull to the hips.',
    secondaryCue: 'Squeeze the shoulder blades back.',
  },
  'Inverted Row (Bodyweight)': {
    primaryCue: 'Straight body, pull chest to bar.',
    secondaryCue: 'Scale with foot position.',
  },

  // ═══════════════════════════════════════════════════
  // CONDITIONING
  // ═══════════════════════════════════════════════════

  'Sprint Intervals': {
    primaryCue: 'Drive through the ground, arms straight.',
    secondaryCue: 'Full recovery between efforts.',
  },
  'Tempo Run': {
    primaryCue: 'Hold the pace, settle into the rhythm.',
    secondaryCue: 'Controlled breathing throughout.',
  },
  'Flog Friday': {
    primaryCue: 'Match the effort to each station.',
    secondaryCue: 'Empty the tank.',
  },
  'Hill Sprints': {
    primaryCue: 'Drive the knees, lean into the hill.',
    secondaryCue: 'Walk back for full recovery.',
  },
  'Easy Bike': {
    primaryCue: 'Conversational pace, legs turning over.',
    secondaryCue: 'This is recovery, not training.',
  },
  'Flush Run': {
    primaryCue: 'Easy jog, nothing above zone one.',
    secondaryCue: 'Move and loosen up.',
  },
  'MetCon': {
    primaryCue: 'Pace across stations, don\'t redline early.',
    secondaryCue: 'Sustain output, finish strong.',
  },
  'Quality Sprints': {
    primaryCue: 'Max intent every rep, full recovery between.',
    secondaryCue: 'If speed drops, the set is done.',
  },

  // ═══════════════════════════════════════════════════
  // POOL: BREATHING & RESET
  // ═══════════════════════════════════════════════════

  '90/90 Breathing': {
    primaryCue: 'Knees and hips at 90, exhale fully.',
    secondaryCue: 'Pause at the bottom of each breath.',
  },
  'Box Breathing': {
    primaryCue: 'Four counts in, hold, out, hold.',
    secondaryCue: 'Stay relaxed, find the rhythm.',
  },
  'Crocodile Breathing': {
    primaryCue: 'Face down, breathe into the belly.',
    secondaryCue: 'Feel the floor push back on the exhale.',
  },

  // ═══════════════════════════════════════════════════
  // POOL: MOBILITY
  // ═══════════════════════════════════════════════════

  'Adductor Rockback': {
    primaryCue: 'Wide knees, rock hips back to the heels.',
    secondaryCue: 'Hold the end range, breathe.',
  },
  'Cat-Cow': {
    primaryCue: 'Round fully, then extend fully.',
    secondaryCue: 'Match each position to a breath.',
  },
  'Couch Stretch': {
    primaryCue: 'Back knee to the wall, squeeze the glute.',
    secondaryCue: 'Tall trunk, no arching.',
  },
  'Lat Stretch': {
    primaryCue: 'Hold a rack or doorframe, hips back.',
    secondaryCue: 'Sink the chest, breathe under the armpit.',
  },
  'Dead Hang': {
    primaryCue: 'Passive hang, shoulders open and relaxed.',
    secondaryCue: 'Breathe - let the spine decompress.',
  },
  'Toe Stretch': {
    primaryCue: 'Tuck toes under, sit back into the heels.',
    secondaryCue: 'Build tolerance gradually.',
  },
  'Calf Stretch': {
    primaryCue: 'Heel down, drive knee toward the wall.',
    secondaryCue: 'Switch to bent-knee for the soleus.',
  },
  'Chest / Pec Stretch (Doorway)': {
    primaryCue: 'Forearm on the doorframe, step the foot through.',
    secondaryCue: 'Big stretch through the chest, breathe slow.',
  },
  'Deep Squat Hold': {
    primaryCue: 'Sit between the heels, chest up.',
    secondaryCue: 'Breathe and hold position.',
  },
  'Hip 90/90 Stretch': {
    primaryCue: 'Front and back legs at 90 degrees.',
    secondaryCue: 'Stay tall, shift weight gently.',
  },
  'Open Book Thoracic Rotation': {
    primaryCue: 'Knees stacked, rotate through the upper back.',
    secondaryCue: 'Follow the hand with the eyes.',
  },
  'Pigeon Stretch': {
    primaryCue: 'Front shin across, square the hips.',
    secondaryCue: 'Sink in and breathe.',
  },

  // ═══════════════════════════════════════════════════
  // POOL: TISSUE QUALITY
  // ═══════════════════════════════════════════════════

  'Foam Roll — Calves & Outer Shins': {
    primaryCue: 'Slow passes, pause on tender spots.',
    secondaryCue: 'Breathe through each hold.',
  },
  'Foam Roll — Hip Flexor, Quad, Adductors': {
    primaryCue: 'Work the full length, hold on knots.',
    secondaryCue: 'Relax into the pressure.',
  },
  'Foam Roll — T-Spine': {
    primaryCue: 'Mid-back over the roller, support the head.',
    secondaryCue: 'Open the ribs and breathe.',
  },
  'Foam Roll — IT Band': {
    primaryCue: 'Side-lying, slow passes from hip to knee.',
    secondaryCue: 'Stack the legs to dial pressure.',
  },
  'Foam Roll — Lats': {
    primaryCue: 'Side-lying with arm overhead.',
    secondaryCue: 'Roll under the armpit, breathe into it.',
  },
  'Lacrosse Ball Glute Release': {
    primaryCue: 'Sit on the ball, shift to find the spot.',
    secondaryCue: 'Hold 30-60 seconds per side.',
  },

  // ═══════════════════════════════════════════════════
  // POOL: EASY CARDIO
  // ═══════════════════════════════════════════════════

  'Incline Treadmill Walk': {
    primaryCue: 'Moderate incline, steady pace.',
    secondaryCue: 'No holding the rails.',
  },
  'Light Skipping': {
    primaryCue: 'Soft ground contacts, stay light.',
    secondaryCue: 'Easy rhythm, not intensity.',
  },
  'Light Walk or Stationary Bike': {
    primaryCue: 'Conversational effort, keep moving.',
    secondaryCue: 'This is blood flow, not training.',
  },
  'Outdoor Walk': {
    primaryCue: 'Easy pace, arms swinging naturally.',
    secondaryCue: 'Get outside and move.',
  },

  // ═══════════════════════════════════════════════════
  // POOL: ACCESSORIES
  // ═══════════════════════════════════════════════════

  'Band Pallof Press': {
    primaryCue: 'Press out, resist the pull.',
    secondaryCue: 'Hips stay square.',
  },
  'Banded Bicep Curl': {
    primaryCue: 'Elbows pinned, curl against the band.',
    secondaryCue: 'Slow on the way down.',
  },
  'Banded Tricep Pushdown': {
    primaryCue: 'Lock the elbows, press to full extension.',
    secondaryCue: 'Constant tension, no slack.',
  },
  'Chin-Up Negative (Slow)': {
    primaryCue: 'Jump to the top, lower for five seconds.',
    secondaryCue: 'Fight gravity the whole way.',
  },
  'Concentration Curl': {
    primaryCue: 'Elbow braced on the inner thigh.',
    secondaryCue: 'Strict curl, no body swing.',
  },
  'Dumbbell Kickback': {
    primaryCue: 'Hinge forward, extend to full lockout.',
    secondaryCue: 'Squeeze at the top, slow return.',
  },
  'Dumbbell Skull Crusher': {
    primaryCue: 'Lower to the sides of the head, press up.',
    secondaryCue: 'Elbows stay fixed in place.',
  },
  'Seated DB Press': {
    primaryCue: 'Back flat against the pad, press to lockout.',
    secondaryCue: 'Ribs down, control the descent.',
  },
  'Half-Kneeling Single-Arm Overhead Press': {
    primaryCue: 'Half-kneel, press straight overhead.',
    secondaryCue: 'Fight the rotation, ribs stay down.',
  },
  'Single-Arm Lat Pulldown': {
    primaryCue: 'Pull the handle to the shoulder, lead with the lat.',
    secondaryCue: 'Control the return, full stretch at the top.',
  },
  'Swiss Ball Hamstring Curl': {
    primaryCue: 'Hips up, curl the ball in and out.',
    secondaryCue: "Don't let the hips drop.",
  },

  // ═══════════════════════════════════════════════════
  // CANONICAL SHOULDER / UPPER-BACK / ARM CUES
  // ═══════════════════════════════════════════════════

  'Lateral Raise': {
    primaryCue: 'Light weight, lead with the elbows.',
    secondaryCue: 'No momentum, strict form.',
  },
  'Tricep Pushdown': {
    primaryCue: 'Keep elbows pinned, press to full lockout.',
    secondaryCue: 'Constant tension, no jerking.',
  },
  'Face Pull': {
    primaryCue: 'Pull to the forehead, open the hands out.',
    secondaryCue: 'Squeeze the rear delts, slow return.',
  },
  'Band Pull-Apart': {
    primaryCue: 'Squeeze the shoulder blades together.',
    secondaryCue: 'Elbows straight, controlled return.',
  },
  'Single-Arm Shrug': {
    primaryCue: 'One side at a time, shoulder straight up.',
    secondaryCue: 'Pause at the top, controlled lower.',
  },
  'Tricep Circuit (Dirty 30)': {
    primaryCue: 'Move through all three positions without rest.',
    secondaryCue: 'Empty the triceps by the final rep.',
  },

  // ═══════════════════════════════════════════════════
  // HIGH-VALUE FAMILY-FALLBACK UPGRADES
  // ═══════════════════════════════════════════════════

  'Bicep Curl (Barbell)': {
    primaryCue: 'Elbows glued to the sides, full range.',
    secondaryCue: 'No swinging, control the bar path.',
  },
  'Bicep Curl (Dumbbell)': {
    primaryCue: 'Neutral start, supinate as you curl.',
    secondaryCue: 'Smooth tempo, squeeze at the top.',
  },
  'Lying Dumbbell Curl': {
    primaryCue: 'Lie flat, arms stretch at the bottom.',
    secondaryCue: 'Control both directions, no momentum.',
  },
  'Skull Crushers': {
    primaryCue: 'Lower to the sides of the head, press up.',
    secondaryCue: 'Full range, elbows stay in place.',
  },
  'Shrugs': {
    primaryCue: 'Shoulders straight up, no roll.',
    secondaryCue: 'Squeeze at the top, controlled lower.',
  },
  'Clap Push-Ups': {
    primaryCue: 'Explosive ascent, catch the clap.',
    secondaryCue: 'Land soft, reset between reps.',
  },
  'Speed Bench': {
    primaryCue: 'Light load, explosive intent, pause at chest.',
    secondaryCue: 'Drive hard, fast lockout.',
  },
  'Incline Y Raise': {
    primaryCue: 'Chest on the incline, arms to a Y.',
    secondaryCue: 'Light weight, pause at the top.',
  },
  'Explosive Landmine Press': {
    primaryCue: 'Fast setup, drive hard into the bar.',
    secondaryCue: 'Full lockout, reset quickly.',
  },
  'Bike Sprints': {
    primaryCue: 'Steady cadence, explosive effort.',
    secondaryCue: 'Recover fully between sprints.',
  },
  'Row Intervals': {
    primaryCue: 'Full catch, explosive drive.',
    secondaryCue: 'Maintain power, recover completely.',
  },
  'Easy Row': {
    primaryCue: 'Controlled rhythm, long strokes.',
    secondaryCue: 'This is active recovery, not training.',
  },
  'Easy Ski': {
    primaryCue: 'Smooth technique, conversational pace.',
    secondaryCue: 'Focus on form, not intensity.',
  },
  'Long Run': {
    primaryCue: 'Steady aerobic pace, find your rhythm.',
    secondaryCue: 'Settle in, breathe steadily.',
  },
  'Light Circuits': {
    primaryCue: 'Low intensity rounds, controlled transitions.',
    secondaryCue: 'This is recovery, not intensity.',
  },
};
