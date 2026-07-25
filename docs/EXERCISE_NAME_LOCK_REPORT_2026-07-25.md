# Hardcoded exercise-name lock — sweep report (Stage 3)

**The census gap Sam caught.** The vocabulary switch closed the *generator's*
naming rights: the prompt offers selectable pool membership, and acceptance
refuses anything else. It said nothing about names written directly into **code**,
which bypass every one of those gates.

That class has already cost us three times:

- `Medicine Ball Overhead Throw` lived in `buildPowerBlock` for months — no cue,
  no video, no pool, and no gate that could see it.
- `Leg Curl`, a name Sam **retired**, still sits in a journal fixture.
- the **live** "Add exercise" affordance on the session screen offers **six**
  names the app cannot cue, so the athlete gets a blank card. That is the device
  run-5 failure, reached through a different door.

`src/rules/exerciseNameLiteralSweep.ts` extracts them; `npm run test:exercise-name-lock`
is the gate, and it is in `test:bible`. **An exercise-name literal in code that
does not resolve to the locked vocabulary now FAILS THE BUILD.**

## How a literal is detected — precision, not a keyword guess

A string counts as an exercise name only when it sits in `name:` /
`exerciseName:` inside an object that **also carries prescription fields**
(`sets`, `reps`, `repsMin/Max`, `exerciseOrder`, `equipmentRequired`,
`prescriptionType`, durations, `restSeconds`), or inside a **bare** string array
whose identifier ends in `EXERCISES`.

An exercise written by a builder always comes with its dose. A store key, a
screen route, an icon name and a session title never do. The first draft of this
sweep matched every `name:` in the codebase and returned 88 unresolved strings —
mostly store keys and onboarding screen names. Unreadable lists do not get ruled
on, they get rubber-stamped, so the detector was tightened until the residual was
small enough to actually read.

**Scope**: all `.ts`/`.tsx` under `src/` **except** the six curated content
registries. `data/defaultProgram.ts` is deliberately IN scope despite its path —
it is the program builder, and `buildPowerBlock` is the exact class of site this
lock exists to police. Test files are out of scope: they name retired exercises
in order to ban them, and nothing in them reaches an athlete.

## Sam's rulings applied — three swaps done, three still owed

The lock originally surfaced **six** names offered by the "Add exercise"
affordance in `src/screens/home/DayWorkoutScreenV2.tsx` (a live, reachable
screen) that the app could not cue. Sam ruled on 2026-07-25.

### APPLIED — three approved swaps (2026-07-25)

Each named a movement the curated vocabulary already had under its real name, so
these were renames, not content decisions. All three now render a real cue,
verified through `buildCueText`:

| Was offered | Now offers | Cue it renders |
|---|---|---|
| `T-Spine Openers` | **Open Book Thoracic Rotation** | "Knees stacked, rotate through the upper back. Follow the hand with the eyes." |
| `Bike Flush Finisher` | **Easy Bike** | "Conversational pace, legs turning over. This is recovery, not training." |
| `Tempo Run Finisher` | **Tempo Run** | "Hold the pace, settle into the rhythm. Controlled breathing throughout." |

Prescriptions and notes are unchanged — the notes ("Easy-moderate pace.",
"Smooth, not a test.") already carried the intent that the invented "Finisher"
suffix was trying to express, so nothing about the dose needed to move.

### STILL OWED — three names, and they need authoring, not mapping

These are the ones that survived the swap pass precisely because they are *not*
renames. Each names a movement the curated vocabulary **does not contain at all**,
so closing it means either ADDING an entry — cue + video + pool placement — or
dropping the suggestion. That is content authoring and it is Sam's.

They remain parked under `awaiting_sam_ruling`, and the gate still asserts both
that they render no cue and that this report names them.

| Name offered today | Renders | What closing it actually requires |
|---|---|---|
| `Split Squat` | no cue | The census flagged plain split squat as a **distinct, easier regression** from `Bulgarian Split Squats`, not a synonym — a real athlete progression the app is missing. Either author it (cue + video + squat-slot placement) or drop the suggestion and let the Lower-body slot offer `Bulgarian Split Squats` / `Reverse Lunges`. |
| `Calf Isometric Hold` | no cue | Nothing equivalent exists. `Single-Leg Calf Raise` is a different movement (dynamic, not an isometric hold), so swapping to it would change the prescription. Author it, or drop the suggestion — the Prehab slot still offers `Copenhagen Plank (Half)`. |
| `Hip Mobility Flow` | no cue | This is a **flow**, not a movement: `MOBILITY_FLOW_TEMPLATES` already has **Hips/Adductors/Groin Reset**. The clean fix is for the suggestion to point at a flow TEMPLATE rather than name a movement, which is a small structural change to the suggestion table (it currently only knows how to emit single exercises). Flagged as design, not a one-liner. |

## Typed exemption kinds

| Kind | Meaning |
|---|---|
| `not_an_exercise` | A category, id or description that sits beside prescription fields but is never rendered as an exercise name |
| `session_label` | The name of a session or block, not a movement |
| `recovery_flow` | One card standing for a template of movements, not a single movement to cue |
| `conditioning_prescription` | A free-text dose ("3 x 8min zone 2 Rower"); conditioning rows are exempt from the cue contract by render path |
| `dead_mock_fixture` | Mock data in a screen unreachable from `App.tsx`. **Self-liquidating** — once the Phase 1.6 purge deletes the file, the staleness assertion forces the exemption out too |
| `awaiting_sam_ruling` | A real exercise name that does not resolve. Listed above; renders no cue until ruled |

The gate also keeps the exemption list honest: an exemption for a name that now
resolves, or for a literal the sweep no longer finds, **fails the build**. The
list cannot rot into a hiding place.

## The complete sweep

**47 distinct literals across 97 positions** — 39 resolve outright,
8 carry a typed exemption, **0 unaccounted**. Regenerated after the three
approved swaps landed.

| Literal | Verdict | Sites |
|---|---|---|
| `3 x 8min zone 2 Rower` | exempt `conditioning_prescription` | `utils/coachRevisionTemplates.ts:274` |
| `3 x 8min zone 2 SkiErg` | exempt `conditioning_prescription` | `utils/coachRevisionTemplates.ts:285` |
| `Back Squat` | RESOLVES | `data/defaultProgram.ts:113`<br>`data/defaultProgram.ts:1105`<br>`data/defaultProgram.ts:1138`<br>`data/defaultProgram.ts:1166`<br>`data/defaultProgram.ts:1180` |
| `Band Pull-Apart` | RESOLVES | `dev/e2e/defaultDevE2ESeedCoordinator.ts:321` |
| `Barbell Row` | RESOLVES | `data/defaultProgram.ts:350`<br>`data/defaultProgram.ts:1174` |
| `Bench Press` | RESOLVES | `data/defaultProgram.ts:203`<br>`data/defaultProgram.ts:1096`<br>`data/defaultProgram.ts:1119`<br>`data/defaultProgram.ts:1181`<br>`data/defaultProgram.ts:1186` |
| `Bicep Curl (Barbell)` | RESOLVES | `data/defaultProgram.ts:372` |
| `Bicep Curls` | RESOLVES → `Bicep Curl (Dumbbell)` | `data/defaultProgram.ts:1076` |
| `Bodyweight Squat` | RESOLVES | `data/defaultProgram.ts:168` |
| `Breathing Reset` | exempt `recovery_flow` | `utils/tapSwapHierarchy.ts:206` |
| `Bulgarian Split Squats` | RESOLVES | `data/defaultProgram.ts:124`<br>`data/defaultProgram.ts:1167` |
| `Calf Isometric Hold` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:343` |
| `Calf Raises` | RESOLVES | `data/defaultProgram.ts:190`<br>`data/defaultProgram.ts:1079` |
| `Chest Supported Row` | RESOLVES | `data/defaultProgram.ts:1120`<br>`data/defaultProgram.ts:1146` |
| `Conditioning` | exempt `session_label` | `data/defaultProgram.ts:1069` |
| `Copenhagen Plank (Half)` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:342` |
| `Dead Bug` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:339` |
| `Dips` | RESOLVES | `data/defaultProgram.ts:258`<br>`data/defaultProgram.ts:1188` |
| `Easy Bike` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:356`<br>`utils/tapSwapHierarchy.ts:190` |
| `Face Pulls` | RESOLVES → `Face Pull` | `data/defaultProgram.ts:247`<br>`data/defaultProgram.ts:1078`<br>`data/defaultProgram.ts:1088`<br>`data/defaultProgram.ts:1121`<br>`data/defaultProgram.ts:1126`<br>`data/defaultProgram.ts:1147`<br>`data/defaultProgram.ts:1175`<br>`screens/home/DayWorkoutScreenV2.tsx:330` |
| `Glute Bridge` | RESOLVES | `data/defaultProgram.ts:179` |
| `Goblet Squat` | RESOLVES | `data/defaultProgram.ts:157`<br>`data/defaultProgram.ts:1111` |
| `Hamstring Curl` | RESOLVES | `data/defaultProgram.ts:1087`<br>`data/defaultProgram.ts:1133` |
| `Hip Mobility Flow` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:346` |
| `Hip Thrust` | RESOLVES → `Hip Thrusts` | `screens/home/DayWorkoutScreenV2.tsx:335` |
| `Hip Thrusts` | RESOLVES | `data/defaultProgram.ts:282`<br>`data/defaultProgram.ts:1132`<br>`data/defaultProgram.ts:1160` |
| `Incline DB Bench` | RESOLVES | `data/defaultProgram.ts:339`<br>`data/defaultProgram.ts:1125`<br>`data/defaultProgram.ts:1153` |
| `Inverted Row (Bodyweight)` | RESOLVES | `data/defaultProgram.ts:236` |
| `Lateral Raise` | RESOLVES | `data/defaultProgram.ts:361`<br>`data/defaultProgram.ts:1154` |
| `Leg Extension` | RESOLVES | `data/defaultProgram.ts:304`<br>`data/defaultProgram.ts:1140`<br>`data/defaultProgram.ts:1168` |
| `Leg Press` | RESOLVES | `data/defaultProgram.ts:146` |
| `Mobility Flow` | exempt `recovery_flow` | `data/defaultProgram.ts:1063` |
| `Nordic Lower` | RESOLVES | `data/defaultProgram.ts:315`<br>`data/defaultProgram.ts:1161` |
| `Open Book Thoracic Rotation` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:349` |
| `Overhead Press` | RESOLVES | `data/defaultProgram.ts:214`<br>`data/defaultProgram.ts:1152`<br>`data/defaultProgram.ts:1187` |
| `Pallof Press` | RESOLVES → `Band Pallof Press` | `data/defaultProgram.ts:1080`<br>`data/defaultProgram.ts:1089`<br>`data/defaultProgram.ts:1098`<br>`data/defaultProgram.ts:1107`<br>`data/defaultProgram.ts:1112`<br>`screens/home/DayWorkoutScreenV2.tsx:338` |
| `Pull-Ups` | RESOLVES | `data/defaultProgram.ts:328`<br>`data/defaultProgram.ts:1086`<br>`data/defaultProgram.ts:1124`<br>`data/defaultProgram.ts:1145`<br>`data/defaultProgram.ts:1173` |
| `Push-Ups` | RESOLVES → `Push-ups` | `screens/home/DayWorkoutScreenV2.tsx:331` |
| `RDLs` | RESOLVES | `data/defaultProgram.ts:135`<br>`data/defaultProgram.ts:1085`<br>`data/defaultProgram.ts:1106`<br>`data/defaultProgram.ts:1110`<br>`data/defaultProgram.ts:1131`<br>`data/defaultProgram.ts:1159` |
| `Reverse Lunges` | RESOLVES | `data/defaultProgram.ts:1139` |
| `Single-Arm DB Row` | RESOLVES | `data/defaultProgram.ts:225`<br>`data/defaultProgram.ts:1097`<br>`data/defaultProgram.ts:1182` |
| `Split Squat` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:334` |
| `Sprint Intervals` | RESOLVES | `data/defaultProgram.ts:385` |
| `Tempo Run` | RESOLVES | `data/defaultProgram.ts:396`<br>`screens/home/DayWorkoutScreenV2.tsx:357` |
| `Trap Bar Deadlift` | RESOLVES | `data/defaultProgram.ts:271` |
| `Tricep Pushdowns` | RESOLVES → `Tricep Pushdown` | `data/defaultProgram.ts:1077` |
| `Walking Lunges` | RESOLVES | `data/defaultProgram.ts:293` |
