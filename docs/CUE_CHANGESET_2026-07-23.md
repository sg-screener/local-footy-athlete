# Cue + Pool Changeset — Sam's authored pass (2026-07-23)

Source of truth: Sam's edited review sheet, parsed verbatim. Apply EXACTLY —
no rewording. Where secondary is blank, store empty (render omits).

## Rule changes

- Cue word cap: 12 → 18 (Sam's authored cues take precedence over the old cap).
- File provenance header: 'Authored by Sam, 2026-07-23. Additions require Sam sign-off.'

## Renames (unify ALL references: cues, pools, tags, videos, loadEstimation, tests)

- Bike Sprints → Air Bike Sprints
- Straight-Arm Pulldown → Single-Arm Pulldown
- Tib Raise / Tibialis Raise → Tib Raises (single canonical name everywhere)
- Copenhagen Plank → Copenhagen Plank (Half)  (Long-Lever Copenhagen stays)

## Deletions (remove from cues + pools + tags + all references)

- Zercher Carry (Sam: 'should not be a lift')
- Flog Friday (session concept removed from conditioning rules)
- Short-Lever Copenhagen (duplicate of Copenhagen Plank (Half))
- Bottoms-Up KB Carry
- Clap Push-Ups ('no need if we have explosive push-ups')
- Groin Squeeze (Band Adductor) (the generic Groin Squeeze stays — see the 2026-07-24 amendment)
- MetCon (dead entry — Sam, 2026-07-24)

## Pool additions (Sam-approved; conditioning names need NO pool action — already selectable via conditioning system)

- Goblet Squat — strength — squat accessory
- Bottoms-Up KB Press — prehab — shoulder
- Speed Bench — strength — horizontal push (speed intent)
- Single-Arm DB Bench Press — strength — horizontal push
- Single-Leg Leg Press — strength — single-leg knee-dominant
- Single-Leg Squat (to Box) — strength — single-leg knee-dominant
- Long-Lever Copenhagen — prehab — groin/adductor
- Scap Push-Up — prehab — shoulder/scap

## Kept decisions

- Light Circuits: KEEP (recovery-builder block).
- Conditioning cues: kept as Sam edited (no stripping).
- Depth Jumps / Lateral Bounds: sheet cues below are canonical — align the power pool spec cues to these.

## Amendment — Sam's rulings, 2026-07-24

Applying this changeset exposed four names it did not cover and one it could
not place. Sam ruled on each; the library below already reflects them.

- **Child's Pose with Breathing** — KEEP, cue authored (was falling back to the
  generic family cue).
- **World's Greatest Stretch** — KEEP, cue authored (same).
- **MetCon** — DELETE (dead entry); added to Deletions above.
- **Single-Arm DB Floor Press** — KEEP with its existing cue. It is the Bible's
  pressing injury-swap, so it stays out of this sheet but stays in the library.
  (The library is therefore the sheet PLUS this entry, not a wholesale replace.)
- **Z-Press** — secondary extended with Sam's variation note. `PoolEntry` has no
  `notes` field to hold it, and the 18-word cap does, so it rides the cue.
- **Groin Squeeze** — UNIFIED (Sam, 2026-07-24). The med-ball and band variants
  collapse into ONE generic exercise named `Groin Squeeze`, cue reworded to
  cover the no-equipment case. It is **bodyweight — no equipment requirement**,
  so every athlete can always be given it. The band version stays deleted.
  (This also closes a pre-existing orphan: `recoveryAddonBuilder` already
  prescribed a bare "Groin Squeeze" that matched no cue, video, pool or tag.)
- **Abductor Machine** — NEW exercise (Sam, 2026-07-24). Cue + video + tags ship;
  its own hip/glute classification, NOT a mirror of Adductor Machine (it works
  the glutes/outer hip, not the groin).

  **It is deliberately NOT in a strength pool.** Sam's ruling — "glute/hip
  accessories only, never a swap candidate for groin/adductor work" — cannot be
  expressed today: `PoolEntry` is `{name, loadRatio}` with no muscle-block field,
  and `getSlotSiblings` returns a slot's whole role array, so pooling it would
  make it a rotation and swap sibling of Adductor Machine. Unpooled, the ruling
  holds trivially. The grouping mechanism is the first item of the Phase 4.3
  programming pass (see PROGRAMMING_DESIGN_SESSION D3/D11); Abductor Machine
  joins the pool then.

## Final cue library (name → primary | secondary)

- **90/90 Breathing**: Knees and hips at 90, exhale fully. | Pause at the bottom of each breath.
- **Ab Wheel**: Roll out only as far as you can control. | Ribs down, slightly rounded back, no sagging at hips
- **Abductor Machine**: Push the knees apart against the pads. | (none)
- **Adductor Machine**: Squeeze knees together | (none)
- **Adductor Rockback**: Wide knees, one leg out straight to side, rock hips back to the heels. | Hold the end range, breathe.
- **Air Bike Sprints**: Explosive effort. | Recover fully between sprints.
- **Back Squat**: Sit into the hips, chest up. | Own the bottom position.
- **Band Pallof Press**: Press out, resist the pull. | Hips stay square, slight knee and hip bend
- **Band Pull-Apart**: Squeeze the shoulder blades together. | Elbows straight, controlled return.
- **Banded Bicep Curl**: Elbows pinned, curl against the band. | Slow on the way down.
- **Banded Dead Bug**: Band behind head, pull band with straight arms toward knees, ribs down. | Lower back stays glued to the floor.
- **Banded External Rotation**: Elbow at 90 degrees, rotate against the band. | Slow and controlled arc.
- **Banded Tricep Pushdown**: Lock the elbows, press to full extension. | Constant tension, no slack.
- **Barbell Row**: Hinge forward, pull to the belly. | Squeeze the shoulder blades at the top.
- **Bear Carry**: Hug the load tight, ribs down, | Short steady steps, no leaning back.
- **Bench Press**: Shoulder blades pinched, bend bar like snapping a twig, feet planted. | Bar to chest, press hard to lockout.
- **Bicep Curl (Barbell)**: Elbows glued to the sides, full range. | No swinging, control the bar path.
- **Bicep Curl (Dumbbell)**: Neutral start, supinate as you curl. | Smooth tempo, squeeze at the top.
- **Bird Dog**: Extend arm and opposite leg, no shift, tuck hips under you | Slow and controlled.
- **Bottoms-Up KB Press**: Bell vertical, wrist stacked. | Press smooth, keep ribs down.
- **Box Breathing**: Four counts in, hold, out, hold. | Stay relaxed, find the rhythm.
- **Box Jumps**: Jump up, step down. | Land soft, absorb with the hips.
- **Box Squat**: Sit back to the box, pause, then drive. | Explode off the box.
- **Broad Jumps**: Drive forward, land balanced. | Stick the landing.
- **Bulgarian Split Squats**: Slight lean forward | Control the descent, no bouncing.
- **Cable Face Pull**: Pull to the forehead, open the hands out. | Squeeze the rear delts.
- **Calf Raises**: Elevate balls of feet on step, full heel drop, rise onto the big toe. | Pause high, lower slowly.
- **Calf Stretch**: Heel down, drive knee toward the wall. | Switch to bent-knee for the soleus.
- **Cat-Cow**: Round fully, then extend fully. | Match each position to a breath.
- **Chest / Pec Stretch (Doorway)**: Forearm on the doorframe, step the foot through. | Big stretch through the chest, breathe slow.
- **Chest Supported Row**: Chest on the pad, pull straight back. | Retract and hold for a beat.
- **Chest-Supported DB Row**: Chest on the pad, pull to the hips, can do on incline bench. | Squeeze the shoulder blades back.
- **Child's Pose with Breathing**: Sink back onto the heels, arms long. | Slow breaths into the back.
- **Chin-Up Negative (Slow)**: Jump to the top, lower slowly, can pull yourself up if you can | Fight gravity the whole way.
- **Chin-Ups**: Palms facing you, full range. | Control the lowering.
- **Close Grip Bench**: Hands at or inside shoulder width, elbows tight. | Triceps do the work.
- **Concentration Curl**: Elbow braced on the inner thigh. | Strict curl, no body swing.
- **Copenhagen Plank (Half)**: Top leg on the bench, drive through the inner thigh | Hold tension, no dropping.
- **Couch Stretch**: Back knee to the wall, squeeze the glute. | Tall trunk, no arching.
- **Crocodile Breathing**: Face down, breathe into the belly. | Feel the floor push back on the exhale.
- **DB Bench Press**: Shoulder blades set on the bench. | Control the dumbbells down and drive.
- **DB Shoulder Press**: Start at the shoulders, press to lockout. | No arching through the lower back.
- **Dead Bug**: Lower back stays flat on the floor. | Opposite arm and leg, slow.
- **Dead Hang**: Passive hang, shoulders open and relaxed. | Breathe - let the spine decompress.
- **Deadlift**: Keep bar close, get tight through the lats | Flat back from start to lockout.
- **Deep Squat Hold**: Sit between the heels, chest up. | Breathe and hold position.
- **Depth Jumps**: Step off, explode off the ground | Minimum ground contact time.
- **Dips**: Lean slightly forward, elbows back. | Control the descent.
- **Dumbbell Kickback**: One knee on bench, one hand on bench, extend to full lockout. | Squeeze at the top, slow return.
- **Dumbbell Skull Crusher**: Lower to the sides of the head, press up. | Elbows stay fixed in place.
- **Easy Bike**: Conversational pace, legs turning over. | This is recovery, not training.
- **Easy Row**: Controlled rhythm, long strokes. | This is active recovery, not training.
- **Easy Ski**: Smooth technique, conversational pace. | Focus on form, not intensity.
- **Explosive Landmine Press**: Split stance, drive hard into the bar. | Full lockout, reset quickly.
- **Face Pull**: Pull to the forehead, open the hands out. | Squeeze the rear delts, slow return.
- **Farmer Carry**: Shoulders packed, walk tall. | Breathe and keep moving.
- **Flush Run**: Easy jog, nothing above zone one or two | Move and loosen up.
- **Foam Roll — Calves & Outer Shins**: Slow passes, pause on tender spots. | Breathe through each hold.
- **Foam Roll — Hip Flexor, Quad, Adductors**: Work the full length, hold on knots. | Relax into the pressure.
- **Foam Roll — IT Band**: Side-lying, slow passes from hip to knee. | Stack the legs to dial pressure.
- **Foam Roll — Lats**: Side-lying with arm overhead. | Roll under the armpit, breathe into it.
- **Foam Roll — T-Spine**: Mid-back over the roller, support the head. | Open the ribs and breathe.
- **Front Squat**: Elbows high, sit between the heels. | Stay tall through the trunk.
- **Goblet Squat**: Elbows inside the knees at the bottom. | Smooth tempo, no rushing.
- **Groin Squeeze**: Squeeze the ball between the knees — or your fists if no ball. | Hold each squeeze for a beat.
- **Half-Kneeling Single-Arm Overhead Press**: Half-kneel, press straight overhead, knee on ground = arm overhead | Fight the rotation, ribs stay down.
- **Hammer Curl**: Neutral grip, no swinging. | Control both directions.
- **Hanging Leg Raise**: Stay tight through midline, breath | No swinging.
- **Hill Sprints**: Drive the knees, lean into the hill. | Walk back for full recovery.
- **Hip 90/90 Stretch**: Front and back legs at 90 degrees. | Stay tall, shift weight gently.
- **Hip Thrusts**: Drive through the heels, squeeze at the top. | Ribs down, no overextending.
- **Incline Bench**: Set the blades on the incline | Press through the palms.
- **Incline DB Bench**: Elbows at 45 degrees, full stretch at the bottom. | Drive up and together.
- **Incline Dumbbell Curl**: Let the arm stretch at the bottom. | Slow curl, squeeze at the top.
- **Incline Treadmill Walk**: Moderate incline, steady pace. | No holding the rails.
- **Incline Y Raise**: Chest on the incline, arms to a Y. | Light weight, pause at the top.
- **Inverted Row (Bodyweight)**: Straight body, pull chest to bar. | Scale with foot position.
- **Jump Squats**: Quarter squat, jump with intent. | Land soft, reset between reps.
- **Kettlebell Swings**: Snap the hips, KB should come back down fast | Power from hips, don’t lift with arms
- **Lacrosse Ball Glute Release**: Sit on the ball, shift to find the spot. | Hold 30-60 seconds per side.
- **Landmine Press**: Split stance, press at an angle, follow the arc. | Stable base, strong finish.
- **Lat Pulldown**: Pull to the collarbone, lean slightly back, push chest at bottom | Squeeze at the bottom, slow return.
- **Lat Stretch**: Hold a rack or doorframe, hips back. | Sink the chest, breathe under the armpit, slight lean to one side
- **Lateral Bounds**: Push off outside leg | Stick each landing before the next.
- **Lateral Raise**: Light weight, lead with the elbows. | No momentum, strict form.
- **Leg Extension**: Drive feet to ceiling, lean back slightly if possible | (none)
- **Leg Press**: Full depth without lower back rounding. | Push through the whole foot.
- **Light Circuits**: Low intensity rounds, controlled transitions. | This is recovery, not intensity.
- **Light Skipping**: Soft ground contacts, stay light. | Easy rhythm, not intensity.
- **Light Walk or Stationary Bike**: Conversational effort, keep moving. | This is blood flow, not training.
- **Long Run**: Steady aerobic pace, find your rhythm. | Settle in, breathe steadily.
- **Long-Lever Copenhagen**: Top ankle supported, hips high. | Don’t let hips drop
- **Lying Dumbbell Curl**: Lie flat, arms stretch at the bottom. | Control both directions, no momentum.
- **McGill Sit Up**: Hands under the lower back, lift the shoulder blades only. | Drive low back into hands slightly
- **Neutral-Grip Pulldown**: Use V grip attachment, puff chest out as hands come down | (none)
- **Nordic Lower**: Lower as slow as you can. | Fight gravity the whole way down.
- **Open Book Thoracic Rotation**: Knees stacked, rotate through the upper back. | Follow the hand with the eyes.
- **Outdoor Walk**: Easy pace, arms swinging naturally. | Get outside and move.
- **Overhead Carry**: Stand tall, arms overhead, stay tight through midline | (none)
- **Overhead Press**: Ribs down, bar finishes over the ears. | Press hard and finish strong.
- **Overhead Tricep Extension**: Full stretch at the bottom, press to lockout. | Elbows stay pointed forward.
- **Pigeon Stretch**: Front shin across bench, square the hips. | Sink in and breathe.
- **Pull-Ups**: Dead hang to chin over bar, any grip is fine | Initiate with the lats, not the arms.
- **Push-ups**: Body in a straight line, elbows at 45. | Chest to floor, full lockout.
- **Quality Sprints**: Max intent every rep, full recovery between. | If speed drops, the set is done.
- **RDLs**: Push hips back, bar slides down leg | Feel the hamstrings load on the way down.
- **Rear Delt Fly**: Rest on incline bench, pinch the shoulder blades. | Light weight, feel the squeeze.
- **Reverse Lunges**: Step back, drop straight down. | Front knee tracks over the toe.
- **Row Intervals**: Full catch, explosive drive. | Maintain power, recover completely.
- **Scap Push-Up**: Keep elbows locked, glide shoulder blades. | Move slowly, no sagging hips.
- **Seated Cable Row**: Sit tall, pull to the sternum. | Slow on the return.
- **Seated Calf Raise**: Bent knee, full range top to bottom. | Slow tempo, no bouncing.
- **Seated DB Press**: Back flat against the pad, press to lockout. | Ribs down, control the descent.
- **Shrugs**: Shoulders straight up to ears, no roll. | Squeeze at the top, controlled lower.
- **Side Plank**: Stack the hips, straight line from head to feet, can add weight to top hip | Breathe behind the brace.
- **Single-Arm DB Bench Press**: Fight the rotation | Brace hard through the trunk.
- **Single-Arm DB Row**: Elbow drives past the torso, pull to belly | Keep the hips and shoulders square.
- **Single-Arm Lat Pulldown**: Pull the handle to the shoulder, lead with the lat, V grip attachment | Control the return, full stretch at the top.
- **Single-Arm Pulldown**: Use V grip on pulldown machine | Stay tight through midline
- **Single-Arm Shrug**: One side at a time, shoulder straight up. | Pause at the top, controlled lower.
- **Single-Leg Calf Raise**: Full drop at the bottom, pause, then rise. | Three-second lowering.
- **Single-Leg Leg Press**: Keep the hips square on the pad. | Control on the way down.
- **Single-Leg RDL**: Hinge at the hip, soft knee. | Balance and control over speed.
- **Single-Leg Squat (to Box)**: Sit to the box under control. | Keep the knee tracking straight.
- **Skull Crushers**: Lower to the sides of the head, press up, use straight or Z bar | Full range, elbows stay in place.
- **Speed Bench**: Light load, explosive intent, pause at chest. | Drive hard, fast lockout.
- **Sprint Intervals**: Drive through the ground, arms straight. | Full recovery between efforts.
- **Step Ups**: Use top leg to drive movement | Don’t bounce with leg on ground
- **Suitcase Carry**: Walk tall, don’t lean | Don’t rest weight on thigh
- **Swiss Ball Hamstring Curl**: Keep hips high, | Curl heels into butt
- **Tempo Run**: Hold the pace, settle into the rhythm. | Controlled breathing throughout.
- **Tib Raises**: Lean back against wall, lift toes to sky, can use a Tib bar if you have one | Controlled reps, full range.
- **Toe Stretch**: Tuck toes under, sit back into the heels. | Build tolerance gradually.
- **Trap Bar Deadlift**: Tight through the lats, push the floor away | Hips and shoulders rise together.
- **Tricep Circuit (Dirty 30)**: Move through all three positions without rest. | Empty the triceps by the final rep.
- **Tricep Pushdown**: Keep elbows pinned, press to full lockout. | Constant tension, no jerking.
- **Walking Lunges**: Long stride, trunk upright. | Steady and deliberate.
- **Weighted Dead Bug**: Hold weight plate or dumbbells, extended arms overhead and feet out, low back pinned to ground | Slow extension, full exhale.
- **Woodchop (Half Kneeling)**: Drive with the trunk, arms guide. | Controlled rotation, not a throw.
- **Woodchop (Standing)**: Rotate through the torso, not the arms. | Feet stay planted.
- **World's Greatest Stretch**: Lunge deep, elbow to instep. | Then rotate and reach to the sky.
- **Z-Press**: Sit up tall, slight lean back when pressing | Stay tight through midline. Can be done seated on a bench, or with dumbbells.