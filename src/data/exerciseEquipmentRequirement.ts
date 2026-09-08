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
/**
 * ONE ROW OF SAM'S SHEET.
 *
 * A bare tag is REQUIRED. A nested array is an OR-GROUP — any one of them will
 * do. Added 2026-08-14 for his answer *"Romanian Deadlift needs barbell or
 * dumbbells"*, which the flat list could not say: written flat it reads as
 * needing BOTH, and a dumbbell-only athlete loses a hinge they can perform.
 *
 * The OR lives in the SHEET, not in a second lookup beside it — a rule that
 * knew "barbell and dumbbells are interchangeable for hinges" would be a second
 * authority on Sam's answers, and the first exercise where that is false would
 * split them.
 */
import { POOL_REGISTRY } from './exercisePools';

export type EquipmentRequirement = string | readonly string[];

export const EXERCISE_EQUIPMENT_REQUIREMENT: Readonly<Record<string, readonly EquipmentRequirement[]>> = {
  "Incline Push-Up": [["bench", "plyo_box"]],
  "Single-Leg Hop and Stick": [],
  "Foam Roller Thoracic Extension": ["foam_roller", ["dumbbells", "barbell"]],
  "Band-Assisted Pull-Up": ["bands", ["rack", "pullup_bar"]],
  "90/90 Breathing": [],
  "ATG Split Squat": [],
  "Butterfly Stretch": [],
  "Calf Stretch": [],
  "Chest / Pec Stretch (Doorway)": [],
  "Couch Stretch": [],
  "Elephant Walks": [],
  "Lat Stretch": [],
  "Pissing Dog Against Wall": [],
  "Pigeon Stretch": [],
  "Sleeper Stretch": [],
  "Bench Thoracic Extension": [["bench", "plyo_box"]],
  "Rotational Medicine-Ball Slam": ["medicine_ball"],
  "Medicine-Ball Slam": ["medicine_ball"],
  "Rotational Medicine-Ball Throw": ["medicine_ball"],
  "Reverse Nordic Curl": [],
  "SL 45° Back Extension Hold": ["back_extension_bench"],
  "SL 45° Back Extension": ["back_extension_bench"],
  "Seated Good Morning": [["bench", "plyo_box"], ["barbell", "dumbbells"]],
  "Crab Hold": [],
  "Standing Knee Extension": [],
  "Seated Single-Leg Pike Lift": [],
  "Horse Stance Hold": [],
  "Ab Wheel": ['ab_wheel'],
  "Back Extension": ['back_extension_bench'],
  "Back Squat": ['barbell', 'rack'],
  "Band Pallof Press": ['bands'],
  // Sam, 2026-08-14: *"Pallof Press needs a band."* The unbanded spelling was
  // absent and read UNKNOWN; it is the same movement as the row above.
  "Pallof Press": ['bands'],
  "Band Pull-Apart": ['bands'],
  "Banded Bicep Curl": ['bands'],
  "Banded Dead Bug": ['bands'],
  "Banded External Rotation": ['bands'],
  "Banded 90/90 External Rotation": ['bands'],
  "Banded TKE": ['bands'],
  "Banded Tricep Pushdown": ['bands'],
  // R-372: barbell OR dumbbells, resolved first-available. The two-handed
  // dumbbell version is the same movement; `Single-Arm DB Row` remains the
  // separate one-handed lift.
  "Bent Row": [['dumbbells', 'barbell']],
  // R-368, Sam's signed intake 2026-09-04: *"Barbell OR dumbbell"*. **DUMBBELLS
  // LEAD for the same reason Single-Leg RDL's row does** — the OR-group resolves
  // first-available, so a dumbbell athlete gets a dumbbell B-stance and nothing
  // about their session changes when a barbell comes or goes.
  //
  // ⚠ **NO KETTLEBELL, AND DELIBERATELY NOT `BODYWEIGHT_CAPABLE`.** Single-Leg
  // RDL is both; this sheet says barbell or dumbbell and nothing was widened
  // past it. An unloaded B-stance is not a regression Sam authored.
  "B-Stance RDL": [['dumbbells', 'barbell']],
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
  // Sam, 2026-08-14: *"Chest Supported Row, needs a bench and dumbbels"*. It was
  // absent from the sheet entirely, so it read UNKNOWN and passed every kit.
  "Chest Supported Row": ['bench', 'dumbbells'],
  // Sam, 2026-08-14: *"Chest-Supported DB Row needs — bench and dumbbells"*.
  // It was absent, so it read UNKNOWN and passed a bodyweight kit — one of the
  // two silences `docs/POOL_CENSUS_2026-08-14.md` measured and B1 CP1 reported.
  "Chest-Supported DB Row": ['bench', 'dumbbells'],
  "Close Grip Bench": ['barbell', 'bench'],
  "Concentration Curl": ['dumbbells'],
  "Copenhagen Plank (Half)": [],
  "Cossack Squat": [],
  // The current equipment census, the pool and Sam's authored cue all prescribe
  // a band. The older filled-in sheet still says bodyweight; following that
  // stale row made the selected-implement owner suppress the band cue entirely.
  "Crab Walks": ['bands'],
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
  // ⚠ Sam, 2026-08-18, ruling AGAINST the widening this branch asked about:
  // *"Inverted Row: a pull-up bar does NOT qualify. Retain its genuine
  // ring/suspension equipment requirement."*
  //
  // **THIS ROW IS DELIBERATELY UNCHANGED, and that is the ruling rather than an
  // oversight.** Its cue says *"pull chest to bar"*, which reads like a pull-up
  // bar would do — it will not. This is the exercise the session-equipment door
  // used to offer to athletes who could not perform it, and R-103's legality
  // filter is what stops that; widening the sheet here would have re-opened it.
  "Inverted Row (Bodyweight)": ['rings_trx'],
  "Jump Squats": [],
  "Kettlebell Swings": ['kettlebell'],
  "Kneeling Jump": [],
  "Landmine Press": ['barbell'],
  // R-371 (Sam, 2026-09-04): *"lat pulldown should be a cable machine only
  // thing"*. A pulldown is a cable movement; filing it under Weight machines
  // meant an athlete who ticked Cable machine but not Weight machines got a
  // Seated Cable Row and no pulldown off the same stack.
  "Lat Pulldown": ['cables'],
  "Lateral Bounds": [],
  "Lateral Jump": [],
  "Lateral Lunge": [],
  "Lateral Raise": ['dumbbells'],
  "Leg Extension": ['machine'],
  "Leg Press": ['machine'],
  "Long-Lever Copenhagen": [],
  "Lying Dumbbell Curl": ['dumbbells'],
  "McGill Sit Up": [],
  "Neutral-Grip Pulldown": ['cables'],
  "Nordic Lower": [],
  "Overhead Carry": ['dumbbells'],
  "Overhead Press": ['barbell', 'rack'],
  "Overhead Tricep Extension": ['dumbbells'],
  "Plank": [],
  "Pogo Hops": [],
  "Pull-Ups": ['pullup_bar'],
  "Push-ups": [],
  // Sam, 2026-08-14: *"Romanian Deadlift needs barbell or dumbbells"*. The two
  // spellings are ONE exercise — `resolveExerciseName` maps `Romanian Deadlift`
  // here — so they carry one answer or the oracle contradicts itself by spelling.
  "RDLs": [['barbell', 'dumbbells']],
  "Romanian Deadlift": [['barbell', 'dumbbells']],
  "RFE Split Squat Jump": ['bench'],
  "Rear Delt Fly": ['dumbbells'],
  "Reverse Lunges": [],
  "Scap Pull Ups": ['pullup_bar'],
  "Scap Push-Up": [],
  "Seated Calf Raise": ['dumbbells'],
  // Sam, 2026-08-14: *"Seated Cable Row needs — cable machine"*. The second
  // sheet silence CP1 reported: absent from the table, so it read LEGAL on a
  // bodyweight kit and on dumbbells+bands.
  "Seated Cable Row": ['cables'],
  "Seated DB Press": ['dumbbells'],
  "Shrugs": ['dumbbells'],
  "Side Plank": [],
  // The current equipment census and pool both prescribe bands. This spelling
  // was absent from the older filled-in sheet, so it fell through to the
  // bodyweight load classifier and its authored band cue was suppressed.
  "Side Plank Row": ['bands'],
  "Single-Arm DB Bench Press": ['bench', 'dumbbells'],
  "Single-Arm DB Floor Press": ['dumbbells'],
  "Single-Arm DB Row": ['dumbbells'],
  "Single-Arm Lat Pulldown": ['cables'],
  "Single-Arm Shrug": ['dumbbells'],
  "Single-Leg Calf Raise": [],
  "Single-Leg Hip Thrust": [],
  "Single-Leg Leg Press": ['machine'],
  // Sam, 2026-08-18: *"Single-Leg RDL is legal with dumbbells or a kettlebell,
  // as well as any already authored barbell option. Bodyweight is only the
  // unloaded regression."* **DUMBBELLS LEAD, and the order is the ruling, not a
  // formatting choice** — the OR-GROUP is resolved first-available, so a
  // dumbbell athlete gets a dumbbell single-leg RDL and nothing about their
  // session changes when a barbell comes or goes. It also settles this row's
  // long-standing disagreement between the sheet (`barbell`) and the load
  // classifier (`dumbbell`) in the classifier's favour, which is what the
  // exercise actually is.
  //
  // It stays in `BODYWEIGHT_CAPABLE` below: unloaded is the REGRESSION, not the
  // default, and `resolveSelectedImplement` will not answer bodyweight for a row
  // carrying load.
  "Single-Leg RDL": [['dumbbells', 'kettlebell', 'barbell']],
  "Single-Leg Squat (to Box)": ['plyo_box'],
  // Sam, 2026-08-26: keep the athlete-facing name "Skull Crushers" for the
  // straight/EZ-bar variation. "Dumbbell Skull Crusher" already exists as its
  // own movement with its own requirement and cue, so this row is barbell-only.
  "Skull Crushers": ['barbell'],
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
  "T-Bar Tib Raises": ["tib_bar"],
  "Trap Bar Deadlift": ['trap_bar'],
  "Tricep Circuit (Dirty 30)": ['barbell'],
  "Tricep Pushdown": ['cables'],
  "Vertical Jump": [],
  "Walking Lunges": ['dumbbells'],
  "Weighted Dead Bug": ['dumbbells'],
  "Woodchop (Half Kneeling)": ['cables'],
  "Woodchop (Standing)": ['cables'],
  // Sam, 2026-08-18: *"Z-Press: legal with barbell OR dumbbells."* Its authored
  // cue already said so (*"Can be done seated on a bench, or with dumbbells"*);
  // the sheet is the half that was behind. Barbell stays first, unchanged.
  "Z-Press": [['barbell', 'dumbbells']],
};

/** Sam's sheet convention: absent from the table is UNKNOWN, not bodyweight. */
export function equipmentRequiredFor(name: string): readonly EquipmentRequirement[] | null {
  const explicit = EXERCISE_EQUIPMENT_REQUIREMENT[name];
  if (explicit) return explicit;
  // Authored support-pool apparatus is evidence too. All admission routes ask
  // this owner, rather than treating a missing equipment-sheet row as no kit.
  const pooled = Object.values(POOL_REGISTRY).flat().filter(row => row.name === name);
  if (pooled.length === 0) return null;
  return pooled.flatMap(row => row.equipment).filter(tag => tag !== 'bodyweight');
}

/**
 * THE REQUIREMENT IN WORDS, and the reason it is a function rather than a
 * `join` at each caller.
 *
 * `null` means the sheet does not know this exercise — which is NOT the same as
 * "needs nothing", and printing an empty string for both is exactly the
 * confusion that shipped a removal record reading `requires: []` for
 * `Romanian Deadlift`. An unknown exercise is never refused, so it should never
 * be described as if it were.
 */
export function equipmentRequirementLabel(name: string): string | null {
  const required = equipmentRequiredFor(name);
  if (required === null) return null;
  if (required.length === 0) return 'nothing';
  return required
    .map((entry) => (Array.isArray(entry) ? entry.join(' or ') : String(entry)))
    .join(' + ');
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
 * **R-086 CLOSED THE ORIGINAL LIST AT TWO; R-316 ADDS ONE NAMED VARIANT
 * CONTRACT.** Asked
 * directly whether `Deadlift` and `Goblet Squat` should join, Sam said
 * **"leave it at two"** (2026-08-13). **THIS IS A CLOSURE, NOT A BACKLOG —
 * do not add a third by inference and do not "complete" the list.** Anything
 * not here follows the sheet verbatim: kit missing, exercise refused.
 *
 * `Seated Good Morning` and `Foam Roller Thoracic Extension` are the later
 * additions: R-316 and R-323 explicitly make their loading implements optional
 * while retaining their support requirements. Any further entry still needs a
 * new ruling and registry row.
 * The current additions are pinned in `test:exercise-intake`, so a quiet
 * change to either support/regression contract reds on arrival.
 */
export const BODYWEIGHT_CAPABLE: ReadonlySet<string> = new Set([
  // Sam, 2026-08-13, setting this unit's acceptance test: *"Walking Lunges is
  // classed dumbbell but can be done unloaded"* and *"Walking Lunges and
  // Single Leg RDL must read legal"* on a bodyweight kit.
  'Walking Lunges',
  'Single-Leg RDL',
  // R-316: the loading implement is optional, but a bench or box is not.
  'Seated Good Morning',
  // R-323: beginners can omit the held weight, but the roller is still required.
  'Foam Roller Thoracic Extension',
]);

/** Support requirements that remain mandatory for an unloaded regression. */
const BODYWEIGHT_REGRESSION_REQUIREMENTS:
Readonly<Partial<Record<string, readonly EquipmentRequirement[]>>> = {
  'Seated Good Morning': [['bench', 'plyo_box']],
  'Foam Roller Thoracic Extension': ['foam_roller'],
};

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
  // A bare tag is required; an OR-group is satisfied by any one of its members.
  const satisfied = (entry: EquipmentRequirement): boolean =>
    Array.isArray(entry) ? entry.some((tag) => kit.has(tag)) : kit.has(entry as string);
  if (required.every(satisfied)) return true;
  // Missing something — but the movement may survive losing its LOAD.
  if (!BODYWEIGHT_CAPABLE.has(name)) return false;
  const retained = BODYWEIGHT_REGRESSION_REQUIREMENTS[name] ?? [];
  return retained.every(satisfied);
}
