/**
 * WHAT EACH EXERCISE *REQUIRES* — SAM'S OWN ANSWERS, 2026-08-13.
 *
 * **AUTHORED BY HIM, NOT DERIVED.** Every row is transcribed from
 * `docs/EXERCISE_EQUIPMENT_FOR_SAM.md` and `..._PART2.md`, which he filled in
 * himself. **An empty list means bodyweight — needs nothing**, which is his own
 * convention from the sheet header. Nothing here is a guess; where he wrote a
 * phrase (`45 deg back extension`, `sand bag / dead ball`, `ab wheel`) it is
 * mapped to the tag vocabulary and nothing else was changed.
 *
 * ── WHY THIS EXISTS, AND WHY THE EXISTING FIELD COULD NOT DO IT ────────────
 *
 * `TRUE_BODYWEIGHT_EXERCISES` (`loadEstimation.ts`) answers **"does this carry
 * external LOAD"** — its docstring says *"These should show 'BW' in the UI"* —
 * and it is correct for that. It was being asked **"can this athlete do it with
 * no kit"**, a different question, and it is wrong on that one in BOTH
 * directions: a `Pull-Up` carries no load and needs a BAR; a `Walking Lunge` is
 * load-classed `dumbbell`, and Sam says it needs dumbbells, while a
 * `Reverse Lunge` needs nothing.
 *
 * **THAT CONFLATION IS WHY A BODYWEIGHT-ONLY ATHLETE WAS PRESCRIBED PULL-UPS,
 * DIPS AND INVERTED ROWS** — all three carry no load, and all three need
 * apparatus. R-083 is his ruling that they should not be:
 * *"ya can't do much with overhead pushing or pull or even horizontal pulling
 * without equipment - i can't account for everyone and if they want to train
 * properly they'll sign up to a gym"*.
 *
 * **TWO QUESTIONS, TWO FIELDS. Do not merge this with the load list** — moving
 * `Pull-Ups` out of that one would make a pull-up display a load estimate.
 */
export const EXERCISE_EQUIPMENT_REQUIREMENT: Readonly<Record<string, readonly string[]>> = {
  "Ab Wheel": ['ab_wheel'],
  "Back Extension": ['back_extension_bench'],
  "Back Squat": ['barbell', 'rack'],
  "Band Pallof Press": ['bands'],
  "Band Pull-Apart": ['bands'],
  "Banded Bicep Curl": ['bands'],
  "Banded Dead Bug": ['bands'],
  "Banded External Rotation": ['bands'],
  "Banded TKE": ['bands'],
  "Banded Tricep Pushdown": ['bands'],
  "Barbell Row": ['barbell'],
  "Bear Carry": ['sandbag'],
  "Bench Press": ['barbell', 'bench'],
  "Bicep Curl (Barbell)": ['barbell'],
  "Bicep Curl (Dumbbell)": ['dumbbells'],
  "Bird Dog": [],
  "Bodyweight Squat": [],
  "Bosch Hold": [],
  "Bottoms-Up KB Press": ['kettlebell'],
  "Box Jumps": ['plyo_box'],
  "Box Squat": ['barbell', 'rack'],
  "Broad Jumps": [],
  "Bulgarian Split Squats": ['bench', 'dumbbells'],
  "Cable Face Pull": ['cables'],
  "Calf Raises": [],
  "Chin-Up Negative (Slow)": ['pullup_bar'],
  "Chin-Ups": ['pullup_bar'],
  "Close Grip Bench": ['barbell', 'bench'],
  "Concentration Curl": ['dumbbells'],
  "Copenhagen Plank (Half)": [],
  "Cossack Squat": [],
  "Crab Walks": [],
  "DB Bench Press": ['bench', 'dumbbells'],
  "DB Shoulder Press": ['dumbbells'],
  "Dead Bug": [],
  "Deadlift": ['barbell'],
  "Depth Jumps": ['plyo_box'],
  "Dips": ['dip_bars'],
  "Dragon Flag": [],
  "Dumbbell Kickback": ['dumbbells'],
  "Dumbbell Skull Crusher": ['dumbbells'],
  "Explosive Landmine Press": ['barbell'],
  "Explosive Push-up": [],
  "Face Pull": ['cables'],
  "Face Pulls": ['cables'],
  "Farmer Carry": ['dumbbells'],
  "Front Squat": ['barbell', 'rack'],
  "Glute Bridge": [],
  "Goblet Squat": ['dumbbells'],
  "Groin Squeeze": [],
  "Half-Kneeling Single-Arm Overhead Press": ['dumbbells'],
  "Hammer Curl": ['dumbbells'],
  "Hamstring Curl": ['machine'],
  "Hanging Leg Raise": ['pullup_bar'],
  "High Box Squat": ['barbell', 'bench', 'rack'],
  "Hip Thrusts": ['barbell', 'bench'],
  "Hollow Hold": [],
  "Incline Bench": ['barbell', 'bench'],
  "Incline DB Bench": ['bench', 'dumbbells'],
  "Incline Dumbbell Curl": ['dumbbells'],
  "Incline Y Raise": ['bench', 'dumbbells'],
  "Inverted Row (Bodyweight)": ['rings_trx'],
  "Jump Squats": [],
  "Kettlebell Swings": ['kettlebell'],
  "Kneeling Jump": [],
  "Landmine Press": ['barbell'],
  "Lat Pulldown": ['machine'],
  "Lateral Bounds": [],
  "Lateral Jump": [],
  "Lateral Lunge": [],
  "Lateral Raise": ['dumbbells'],
  "Leg Extension": ['machine'],
  "Leg Press": ['machine'],
  "Long-Lever Copenhagen": [],
  "Lying Dumbbell Curl": ['dumbbells'],
  "McGill Sit Up": [],
  "Neutral-Grip Pulldown": ['machine'],
  "Nordic Lower": [],
  "Overhead Carry": ['dumbbells'],
  "Overhead Press": ['barbell', 'rack'],
  "Overhead Tricep Extension": ['dumbbells'],
  "Plank": [],
  "Pogo Hops": [],
  "Pull-Ups": ['pullup_bar'],
  "Push-ups": [],
  "RDLs": ['barbell'],
  "RFE Split Squat Jump": [],
  "Rear Delt Fly": ['dumbbells'],
  "Reverse Lunges": [],
  "Scap Pull Ups": ['pullup_bar'],
  "Scap Push-Up": [],
  "Seated Calf Raise": ['dumbbells'],
  "Seated DB Press": ['dumbbells'],
  "Shrugs": ['dumbbells'],
  "Side Plank": [],
  "Single-Arm DB Bench Press": ['bench', 'dumbbells'],
  "Single-Arm DB Floor Press": ['dumbbells'],
  "Single-Arm DB Row": ['dumbbells'],
  "Single-Arm Lat Pulldown": ['machine'],
  "Single-Arm Pulldown": ['machine'],
  "Single-Arm Shrug": ['dumbbells'],
  "Single-Leg Calf Raise": [],
  "Single-Leg Hip Thrust": [],
  "Single-Leg Leg Press": ['machine'],
  "Single-Leg RDL": ['barbell'],
  "Single-Leg Squat (to Box)": ['plyo_box'],
  "Skull Crushers": ['dumbbells'],
  "Slant Board Step-Down": [],
  "Spanish Squat Hold": ['bands'],
  "Speed Bench": ['barbell', 'bench'],
  "Speed Trap Bar Deadlift": ['trap_bar'],
  "Sprint Intervals": [],
  "Step Ups": ['plyo_box'],
  "Stir the Pot": ['swiss_ball'],
  "Suitcase Carry": ['dumbbells'],
  "Swiss Ball Hamstring Curl": ['swiss_ball'],
  "Tempo Run": [],
  "Tib Raises": [],
  "Trap Bar Deadlift": ['trap_bar'],
  "Tricep Circuit (Dirty 30)": ['barbell'],
  "Tricep Pushdown": ['cables'],
  "Vertical Jump": [],
  "Walking Lunges": ['dumbbells'],
  "Weighted Dead Bug": ['dumbbells'],
  "Woodchop (Half Kneeling)": ['cables'],
  "Woodchop (Standing)": ['cables'],
  "Z-Press": ['barbell'],
};

/** Sam's sheet convention: absent from the table is UNKNOWN, not bodyweight. */
export function equipmentRequiredFor(name: string): readonly string[] | null {
  return EXERCISE_EQUIPMENT_REQUIREMENT[name] ?? null;
}

/**
 * ── THE THIRD QUESTION, AND IT IS THE ONE AVAILABILITY ACTUALLY ASKS ────────
 *
 * The sheet above answers **"what kit does this exercise USE"**. That is not
 * the same as **"can this athlete PERFORM it at all"**, and Sam named the gap
 * himself when he set the acceptance test for this unit:
 *
 *   *"Pull-Ups must read illegal, Walking Lunges and Single Leg RDL must read
 *   legal"* — on a bodyweight kit.
 *
 * **HIS SHEET SAYS `Walking Lunges -> dumbbells` AND `Single-Leg RDL ->
 * barbell`**, so read verbatim BOTH come out illegal and both of his own
 * acceptance rows fail. **The sheet is not wrong — it is answering the other
 * question.** A walking lunge uses dumbbells and is still a walking lunge
 * without them; a pull-up without a bar is nothing at all.
 *
 * SO THERE ARE THREE FACTS, NOT TWO, AND EACH HAS ONE OWNER:
 *   1. **LOAD** — `TRUE_BODYWEIGHT_EXERCISES` (`loadEstimation.ts`): does it
 *      carry external load. Correct as it stands; **not touched by this unit.**
 *   2. **KIT USED** — the sheet above. Sam's, signed, unchanged.
 *   3. **PERFORMABLE UNLOADED** — this set. **A movement whose named kit only
 *      LOADS it, and which survives losing that load.**
 *
 * **WHY THIS IS AN AUTHORED LIST AND NOT A RULE OVER TAG KINDS.** The obvious
 * shortcut — "a missing LOADING implement (barbell/dumbbell/kettlebell) is
 * survivable, a missing APPARATUS is not" — reproduces every row Sam named,
 * and then quietly makes `Deadlift`, `Banded Bicep Curl` and `Goblet Squat`
 * legal on a bodyweight kit. A band curl without the band is not a curl, and a
 * goblet squat is DEFINED by the thing you hold. **A tag cannot tell you
 * whether a movement survives losing its load; only the movement can, and only
 * Sam can say so.**
 *
 * **IT HOLDS EXACTLY THE TWO HE HAS RULED.** Anything not here follows the
 * sheet verbatim. **Adding a row is a Sam ruling, never an inference** — the
 * moment it grows by guess it becomes the conflated field this unit exists to
 * delete.
 */
export const BODYWEIGHT_CAPABLE: ReadonlySet<string> = new Set([
  // Sam, 2026-08-13, setting this unit's acceptance test: *"Walking Lunges is
  // classed dumbbell but can be done unloaded"* and *"Walking Lunges and
  // Single Leg RDL must read legal"* on a bodyweight kit.
  'Walking Lunges',
  'Single-Leg RDL',
]);

/**
 * CAN THIS ATHLETE PERFORM THIS MOVEMENT AT ALL?
 *
 * The availability answer, and the ONLY one generation's equipment filter
 * should ask. Returns `true` when it cannot prove otherwise — an unknown
 * exercise and an unanswered kit both pass, so this refuses only what Sam's
 * own sheet says is impossible.
 */
export function exerciseIsAvailableWith(
  name: string,
  availableEquipment: readonly string[] | undefined,
): boolean {
  if (!availableEquipment?.length) return true;
  const required = equipmentRequiredFor(name);
  if (required === null) return true;        // not on his sheet — unknown, allow
  if (required.length === 0) return true;    // his convention: needs nothing
  const kit = new Set(availableEquipment);
  if (required.every((tag) => kit.has(tag))) return true;
  // Missing something — but the movement may survive losing its LOAD.
  return BODYWEIGHT_CAPABLE.has(name);
}
