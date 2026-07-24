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

## Sam's ruling owed — six live names that render NO cue

These are offered by the "Add exercise" affordance in
`src/screens/home/DayWorkoutScreenV2.tsx` (a **live, reachable** screen). Each is
parked under the typed kind `awaiting_sam_ruling`, listed here, and asserted by
the gate to still render no cue — so the park cannot go quiet.

| Name offered today | Renders | Proposed mapping (Sam's call) |
|---|---|---|
| `Split Squat` | no cue | The census flagged plain split squat as a **distinct, easier regression** from `Bulgarian Split Squats`, not a synonym — so this is an ADD (new curated entry), not a rename. Or drop the suggestion. |
| `Calf Isometric Hold` | no cue | No equivalent in the vocabulary. Nearest is `Single-Leg Calf Raise` (different movement). Needs an add or a drop. |
| `Hip Mobility Flow` | no cue | `MOBILITY_FLOW_TEMPLATES` already has **Hips/Adductors/Groin Reset** — the suggestion should point at a flow template, not invent a movement name. |
| `T-Spine Openers` | no cue | `Open Book Thoracic Rotation` is in the vocabulary and is the same drill. Straight swap, pending your yes. |
| `Bike Flush Finisher` | no cue | `Easy Bike` is in the vocabulary (conditioning, tier C flush). Straight swap, pending your yes. |
| `Tempo Run Finisher` | no cue | `Tempo Run` is in the vocabulary. Straight swap, pending your yes. |

I did **not** apply the three straight swaps: changing what the athlete is
offered is a content decision, and the whole point of this unit is that those
stop happening silently.

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

**60 distinct literals across 125 positions.**

| Literal | Verdict | Sites |
|---|---|---|
| `3 x 8min zone 2 Rower` | exempt `conditioning_prescription` | `utils/coachRevisionTemplates.ts:274` |
| `3 x 8min zone 2 SkiErg` | exempt `conditioning_prescription` | `utils/coachRevisionTemplates.ts:285` |
| `Ab Wheel` | RESOLVES | `components/AddExerciseModal.tsx:28`<br>`screens/journal/WorkoutHistoryDetailScreen.tsx:76` |
| `Back Squat` | RESOLVES | `data/defaultProgram.ts:113`<br>`data/defaultProgram.ts:1105`<br>`data/defaultProgram.ts:1138`<br>`data/defaultProgram.ts:1166`<br>`data/defaultProgram.ts:1180` |
| `Band Pull-Apart` | RESOLVES | `dev/e2e/defaultDevE2ESeedCoordinator.ts:321` |
| `Barbell Row` | RESOLVES | `data/defaultProgram.ts:350`<br>`data/defaultProgram.ts:1174`<br>`screens/program/WorkoutDetailScreen.tsx:77` |
| `Bench Press` | RESOLVES | `data/defaultProgram.ts:203`<br>`data/defaultProgram.ts:1096`<br>`data/defaultProgram.ts:1119`<br>`data/defaultProgram.ts:1181`<br>`data/defaultProgram.ts:1186`<br>`screens/program/ExerciseDetailScreen.tsx:25`<br>`screens/program/WorkoutDetailScreen.tsx:50` |
| `Bicep Curl (Barbell)` | RESOLVES | `data/defaultProgram.ts:372` |
| `Bicep Curls` | RESOLVES → `Bicep Curl (Dumbbell)` | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:1076` |
| `Bike Flush Finisher` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:350` |
| `Bodyweight Squat` | RESOLVES | `data/defaultProgram.ts:168` |
| `Breathing Reset` | exempt `recovery_flow` | `utils/tapSwapHierarchy.ts:206` |
| `Bulgarian Split Squats` | RESOLVES | `data/defaultProgram.ts:124`<br>`data/defaultProgram.ts:1167` |
| `Calf Isometric Hold` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:343` |
| `Calf Raises` | RESOLVES | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:190`<br>`data/defaultProgram.ts:1079`<br>`screens/journal/WorkoutHistoryDetailScreen.tsx:67` |
| `Chest Supported Row` | RESOLVES | `data/defaultProgram.ts:1120`<br>`data/defaultProgram.ts:1146` |
| `Conditioning` | exempt `session_label` | `data/defaultProgram.ts:1069` |
| `Copenhagen Plank (Half)` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:342` |
| `Dead Bug` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:339` |
| `Dips` | RESOLVES | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:258`<br>`data/defaultProgram.ts:1188` |
| `Dumbbell Bench Press` | RESOLVES → `DB Bench Press` | `screens/program/ExerciseDetailScreen.tsx:40` |
| `Easy Bike` | RESOLVES | `utils/tapSwapHierarchy.ts:190` |
| `Face Pulls` | RESOLVES → `Face Pull` | `data/defaultProgram.ts:247`<br>`data/defaultProgram.ts:1078`<br>`data/defaultProgram.ts:1088`<br>`data/defaultProgram.ts:1121`<br>`data/defaultProgram.ts:1126`<br>`data/defaultProgram.ts:1147`<br>`data/defaultProgram.ts:1175`<br>`screens/home/DayWorkoutScreenV2.tsx:330` |
| `Farmer Carry` | RESOLVES | `components/AddExerciseModal.tsx:28` |
| `Glute Bridge` | RESOLVES | `data/defaultProgram.ts:179` |
| `Goblet Squat` | RESOLVES | `data/defaultProgram.ts:157`<br>`data/defaultProgram.ts:1111` |
| `Hamstring Curl` | RESOLVES | `data/defaultProgram.ts:1087`<br>`data/defaultProgram.ts:1133` |
| `Hanging Leg Raise` | RESOLVES | `components/AddExerciseModal.tsx:28` |
| `Hip Mobility Flow` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:346` |
| `Hip Thrust` | RESOLVES → `Hip Thrusts` | `screens/home/DayWorkoutScreenV2.tsx:335` |
| `Hip Thrusts` | RESOLVES | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:282`<br>`data/defaultProgram.ts:1132`<br>`data/defaultProgram.ts:1160` |
| `Incline DB Bench` | RESOLVES | `data/defaultProgram.ts:339`<br>`data/defaultProgram.ts:1125`<br>`data/defaultProgram.ts:1153`<br>`screens/program/ExerciseDetailScreen.tsx:40` |
| `Incline DB Curls` | RESOLVES → `Incline Dumbbell Curl` | `components/AddExerciseModal.tsx:28` |
| `Inverted Row (Bodyweight)` | RESOLVES | `data/defaultProgram.ts:236` |
| `Lateral Raise` | RESOLVES | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:361`<br>`data/defaultProgram.ts:1154` |
| `Leg Curl` | exempt `dead_mock_fixture` | `screens/journal/WorkoutHistoryDetailScreen.tsx:58` |
| `Leg Extension` | RESOLVES | `data/defaultProgram.ts:304`<br>`data/defaultProgram.ts:1140`<br>`data/defaultProgram.ts:1168` |
| `Leg Press` | RESOLVES | `data/defaultProgram.ts:146`<br>`screens/journal/WorkoutHistoryDetailScreen.tsx:48` |
| `Mobility Flow` | exempt `recovery_flow` | `data/defaultProgram.ts:1063` |
| `Nordic Lower` | RESOLVES | `data/defaultProgram.ts:315`<br>`data/defaultProgram.ts:1161` |
| `Overhead Press` | RESOLVES | `data/defaultProgram.ts:214`<br>`data/defaultProgram.ts:1152`<br>`data/defaultProgram.ts:1187`<br>`screens/program/WorkoutDetailScreen.tsx:104` |
| `Pallof Press` | RESOLVES → `Band Pallof Press` | `data/defaultProgram.ts:1080`<br>`data/defaultProgram.ts:1089`<br>`data/defaultProgram.ts:1098`<br>`data/defaultProgram.ts:1107`<br>`data/defaultProgram.ts:1112`<br>`screens/home/DayWorkoutScreenV2.tsx:338` |
| `Pull-Ups` | RESOLVES | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:328`<br>`data/defaultProgram.ts:1086`<br>`data/defaultProgram.ts:1124`<br>`data/defaultProgram.ts:1145`<br>`data/defaultProgram.ts:1173` |
| `Push-ups` | RESOLVES | `screens/program/ExerciseDetailScreen.tsx:40` |
| `Push-Ups` | RESOLVES → `Push-ups` | `screens/home/DayWorkoutScreenV2.tsx:331` |
| `RDLs` | RESOLVES | `data/defaultProgram.ts:135`<br>`data/defaultProgram.ts:1085`<br>`data/defaultProgram.ts:1106`<br>`data/defaultProgram.ts:1110`<br>`data/defaultProgram.ts:1131`<br>`data/defaultProgram.ts:1159` |
| `Reverse Lunges` | RESOLVES | `data/defaultProgram.ts:1139` |
| `Romanian Deadlift` | RESOLVES → `RDLs` | `screens/journal/WorkoutHistoryDetailScreen.tsx:38` |
| `Seated Cable Row` | RESOLVES | `components/AddExerciseModal.tsx:28` |
| `Single-Arm DB Row` | RESOLVES | `data/defaultProgram.ts:225`<br>`data/defaultProgram.ts:1097`<br>`data/defaultProgram.ts:1182` |
| `Split Squat` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:334` |
| `Sprint Intervals` | RESOLVES | `data/defaultProgram.ts:385` |
| `Squat` | exempt `dead_mock_fixture` | `screens/journal/ExerciseHistoryScreen.tsx:20`<br>`screens/journal/WorkoutHistoryDetailScreen.tsx:27` |
| `T-Spine Openers` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:347` |
| `Tempo Run` | RESOLVES | `data/defaultProgram.ts:396` |
| `Tempo Run Finisher` | exempt `awaiting_sam_ruling` | `screens/home/DayWorkoutScreenV2.tsx:351` |
| `Trap Bar Deadlift` | RESOLVES | `data/defaultProgram.ts:271` |
| `Tricep Pushdowns` | RESOLVES → `Tricep Pushdown` | `components/AddExerciseModal.tsx:28`<br>`data/defaultProgram.ts:1077` |
| `Upper Body Strength` | exempt `session_label` | `screens/program/CustomizeWorkoutScreen.tsx:28`<br>`screens/program/WorkoutDetailScreen.tsx:30` |
| `Walking Lunges` | RESOLVES | `data/defaultProgram.ts:293` |
