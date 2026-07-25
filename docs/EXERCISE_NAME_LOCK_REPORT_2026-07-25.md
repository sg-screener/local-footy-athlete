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

## Sam's rulings — ALL SIX CLOSED (2026-07-25)

The lock surfaced **six** names offered by the "Add exercise" affordance in
`src/screens/home/DayWorkoutScreenV2.tsx` — a live, reachable screen — that the
app could not cue. Every one of the six now renders a real curated cue. The
`awaiting_sam_ruling` queue is **empty**, and the gate asserts that emptiness.

### Renames — the vocabulary already had the movement

| Was offered | Now offers |
|---|---|
| `T-Spine Openers` | **Open Book Thoracic Rotation** |
| `Bike Flush Finisher` | **Easy Bike** |
| `Tempo Run Finisher` | **Tempo Run** |

### Redirects — the vocabulary genuinely lacked what they named

Sam's call was to point each at the nearest curated movement rather than author
new content. **Two of the three changed the prescription**, because a name and
its dose are not independent:

| Was offered | Now offers | Prescription change |
|---|---|---|
| `Split Squat` | **Reverse Lunges** | none — 2 × 8-10 per side already suited it |
| `Calf Isometric Hold` | **Single-Leg Calf Raise** | `duration` 30-45s → **`reps` 12-15 per side**. The old entry was an isometric HOLD; the curated raise is rep-counted, so keeping the duration would have prescribed "30-45 seconds" of a rep movement. |
| `Hip Mobility Flow` | **Hip 90/90 Stretch** | `duration_minutes` 5-8 → **`duration` 30-45s per side**. 5-8 minutes of a FLOW became seconds of a single stretch hold. |

Both changed doses now match the curated pool entry exactly (`CALVES_POOL`,
`MOBILITY_POOL`), including their notes ("3-second lowering.", "Breathe into the
stretch."). Copy adapted only where the old text described a thing that no longer
exists — a flow you move through is not a hold you breathe into.

**Flow-capable suggestions are a POSSIBLE FUTURE BUILD, not now** (Sam's ruling).
The table can only emit single exercises, so a suggestion naming a
`MOBILITY_FLOW_TEMPLATES` entry has nowhere to land. `Hip 90/90 Stretch` is the
honest single-movement stand-in until the table learns templates.

### Not a lock finding, still open

`Tempo Run` under "Conditioning finisher" is a real `B-low`/high-impact tempo run
rather than a flush. It resolves and cues, so the lock is satisfied — but whether
it is the right *dose* for a finisher slot is Sam's device read, and it stays as
the finisher pending that.

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

**46 distinct literals across 97 positions** — 41 resolve outright,
5 carry a typed exemption, **0 unaccounted**, and **0 parked awaiting a ruling**.
Regenerated after the final three redirects landed.

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
| `Calf Raises` | RESOLVES | `data/defaultProgram.ts:190`<br>`data/defaultProgram.ts:1079` |
| `Chest Supported Row` | RESOLVES | `data/defaultProgram.ts:1120`<br>`data/defaultProgram.ts:1146` |
| `Conditioning` | exempt `session_label` | `data/defaultProgram.ts:1069` |
| `Copenhagen Plank (Half)` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:347` |
| `Dead Bug` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:344` |
| `Dips` | RESOLVES | `data/defaultProgram.ts:258`<br>`data/defaultProgram.ts:1188` |
| `Easy Bike` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:371`<br>`utils/tapSwapHierarchy.ts:190` |
| `Face Pulls` | RESOLVES → `Face Pull` | `data/defaultProgram.ts:247`<br>`data/defaultProgram.ts:1078`<br>`data/defaultProgram.ts:1088`<br>`data/defaultProgram.ts:1121`<br>`data/defaultProgram.ts:1126`<br>`data/defaultProgram.ts:1147`<br>`data/defaultProgram.ts:1175`<br>`screens/home/DayWorkoutScreenV2.tsx:330` |
| `Glute Bridge` | RESOLVES | `data/defaultProgram.ts:179` |
| `Goblet Squat` | RESOLVES | `data/defaultProgram.ts:157`<br>`data/defaultProgram.ts:1111` |
| `Hamstring Curl` | RESOLVES | `data/defaultProgram.ts:1087`<br>`data/defaultProgram.ts:1133` |
| `Hip 90/90 Stretch` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:361` |
| `Hip Thrust` | RESOLVES → `Hip Thrusts` | `screens/home/DayWorkoutScreenV2.tsx:340` |
| `Hip Thrusts` | RESOLVES | `data/defaultProgram.ts:282`<br>`data/defaultProgram.ts:1132`<br>`data/defaultProgram.ts:1160` |
| `Incline DB Bench` | RESOLVES | `data/defaultProgram.ts:339`<br>`data/defaultProgram.ts:1125`<br>`data/defaultProgram.ts:1153` |
| `Inverted Row (Bodyweight)` | RESOLVES | `data/defaultProgram.ts:236` |
| `Lateral Raise` | RESOLVES | `data/defaultProgram.ts:361`<br>`data/defaultProgram.ts:1154` |
| `Leg Extension` | RESOLVES | `data/defaultProgram.ts:304`<br>`data/defaultProgram.ts:1140`<br>`data/defaultProgram.ts:1168` |
| `Leg Press` | RESOLVES | `data/defaultProgram.ts:146` |
| `Mobility Flow` | exempt `recovery_flow` | `data/defaultProgram.ts:1063` |
| `Nordic Lower` | RESOLVES | `data/defaultProgram.ts:315`<br>`data/defaultProgram.ts:1161` |
| `Open Book Thoracic Rotation` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:364` |
| `Overhead Press` | RESOLVES | `data/defaultProgram.ts:214`<br>`data/defaultProgram.ts:1152`<br>`data/defaultProgram.ts:1187` |
| `Pallof Press` | RESOLVES → `Band Pallof Press` | `data/defaultProgram.ts:1080`<br>`data/defaultProgram.ts:1089`<br>`data/defaultProgram.ts:1098`<br>`data/defaultProgram.ts:1107`<br>`data/defaultProgram.ts:1112`<br>`screens/home/DayWorkoutScreenV2.tsx:343` |
| `Pull-Ups` | RESOLVES | `data/defaultProgram.ts:328`<br>`data/defaultProgram.ts:1086`<br>`data/defaultProgram.ts:1124`<br>`data/defaultProgram.ts:1145`<br>`data/defaultProgram.ts:1173` |
| `Push-Ups` | RESOLVES → `Push-ups` | `screens/home/DayWorkoutScreenV2.tsx:331` |
| `RDLs` | RESOLVES | `data/defaultProgram.ts:135`<br>`data/defaultProgram.ts:1085`<br>`data/defaultProgram.ts:1106`<br>`data/defaultProgram.ts:1110`<br>`data/defaultProgram.ts:1131`<br>`data/defaultProgram.ts:1159` |
| `Reverse Lunges` | RESOLVES | `data/defaultProgram.ts:1139`<br>`screens/home/DayWorkoutScreenV2.tsx:339` |
| `Single-Arm DB Row` | RESOLVES | `data/defaultProgram.ts:225`<br>`data/defaultProgram.ts:1097`<br>`data/defaultProgram.ts:1182` |
| `Single-Leg Calf Raise` | RESOLVES | `screens/home/DayWorkoutScreenV2.tsx:353` |
| `Sprint Intervals` | RESOLVES | `data/defaultProgram.ts:385` |
| `Tempo Run` | RESOLVES | `data/defaultProgram.ts:396`<br>`screens/home/DayWorkoutScreenV2.tsx:372` |
| `Trap Bar Deadlift` | RESOLVES | `data/defaultProgram.ts:271` |
| `Tricep Pushdowns` | RESOLVES → `Tricep Pushdown` | `data/defaultProgram.ts:1077` |
| `Walking Lunges` | RESOLVES | `data/defaultProgram.ts:293` |
