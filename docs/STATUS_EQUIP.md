# STATUS — seat `equip`

Mission: **EQUIPMENT SCOPES AND AWAY/HOLIDAY PROGRAMMING**.
Worktree: `/Users/samgeurts/Documents/lfa-equip`, branch `feat/equipment-scopes`,
**base hash `6b617847`** (`main` tip at start, clean).
Started 2026-08-17. Cap: 3 sessions. This is session 1.

---

## THE INSTRUMENT

`npm run trace:equipment-scopes` → `scripts/trace-equipment-scopes.ts`, writing
`docs/EQUIPMENT_SCOPE_TRACE_2026-08-17.md`.

It drives **`generateProgramLocally`** — the real door — nine times, and taps two
live functions on the wire rather than rebuilding their inputs:

- `composeWeek`, for the base selection, `substitutedFor` and `gaps`, **none of
  which reach the generated program**, so a program-only trace cannot see them;
- `validateWorkoutAgainstActiveConstraints`, the in-generation constraint pass,
  which can answer `workout: null` and have the caller collapse the day to REST
  **while narrating nothing**.

The facts (equipment fact, travel span) are built by the same builders the
athlete's own doors call — `createTemporaryEquipmentFact` with a `window` scope
(the `missing_for_span` branch of `set_equipment_modifier`) and
`createTemporaryScheduleFact` with `scheduleKind: 'travel'` — and reach
generation only through `composeTemporarySourceFactCompatibility`.

---

## MEASURED BASELINE ON `6b617847` — BEFORE ANY CHANGE OF MINE

Run 2026-08-17 in this worktree.

| suite | result |
| --- | --- |
| `test:equipment-vocabulary` | 84/0 GREEN |
| `test:equipment-answer` | 41/0 GREEN |
| `test:dated-equipment-fact` | 3/0 GREEN |
| `test:exercise-exclusions` | GREEN |
| `test:exercise-rotation` | 93/0 GREEN |
| `test:weekly-scheduler` | 96/96 GREEN |
| `test:edge-generation-equipment` | **37 passed, 1 FAILED** — *"live full-generation request uses the shared payload builder"* |
| `test:composer-b1` | **44 passed, 2 FAILED** — *"[anti-overfit] the composer names no world, kit label, phase or day count"*, *"[input: phaseClock] the week number changes what is selected"* |
| `test:away-flow` | **THROWS** `generated_week_refused` — `main_strength_required_minimum` expected 2 actual 0, plus "the week trains no squat / hinge / push / pull" |
| `test:away-span-ownership` | 8/0 cells green, **exit 1** |

**These four reds are NOT mine.** `test:away-flow`'s throw carries the same
signature this trace reproduces from first principles below, which is the
strongest evidence that the away defect is real and not a fixture artefact.

---

## THE TRACE — NINE BOUNDARIES, AND WHAT THEY MEASURED

The athlete: In-season, Saturday game, Tuesday+Thursday club, **Commercial Gym —
19 tags, all five machines**. Week Monday `2026-08-10`. Trip `2026-08-12` →
`2026-08-16` (last day away), return `2026-08-17`.

| id | world | composer kit | week published? |
| --- | --- | --- | --- |
| B0 | normal, no temporary change | 19 | YES |
| B1 | travel span only, mid-week start | 19 | YES |
| B2 | travel + kit removal, mid-week start | **19** | YES |
| B3 | boot **during** the trip | **19** | YES |
| B4 | return-date boot | 19 | YES |
| B5 | next block after return | 19 | YES |
| B6 | control — same removal, span starts on the week Monday | **3** | **REFUSED** |
| B7 | control — kit removal only, no travel | **3** | **REFUSED** |
| B8 | control — travel only, **full 19-tag gym** | 19 | **REFUSED** |

---

## FINDING 1 — ⚠ **WITHDRAWN 2026-08-17. THIS WAS MY HARNESS, NOT THE APP.**

**The claim below is FALSE and is kept, struck through, because a withdrawn
finding that vanishes teaches nobody.** It said a future-dated away answer
produces no constraint. It does — *in the trace*, because
`constraintsFor` passed `onDate: todayISO` to
`composeTemporarySourceFactCompatibility`, which makes
`activeTemporarySourceFacts` drop every fact whose horizon does not cover today.

**NOT ONE PRODUCTION CALLER PASSES `onDate`.** `temporarySourceFactTransaction`
(both sites), `profileProgramTransaction`, `acceptedStateColdStart` and the
dev-E2E seed coordinator all omit it, so the real app keeps the fact, projects it
to a constraint carrying its own `startDate`/`expiresAt`, and lets the per-date
filters decide which days it touches.

**I copied the `onDate` from `scripts/print-week.ts`'s `awayConstraintsFor`,
which invented it**, and then reported the result as an app defect for a whole
session — including in a report to Sam. The trace now composes constraints
exactly as the store does. This is the repo's own documented trap: an under-fed
harness answers "no" rather than failing.

**What the fix actually turned on was FINDING 2**, which was real: the kit was
resolved at ONE date for a whole week. With that fixed and the harness corrected,
a mid-week trip now resolves per day —

```
composer PERMANENT kit (19): …            ← Mon/Tue, he is home
composer DATED kit day 3 (3): bodyweight, dumbbells, bands
composer DATED kit day 4 (3): …  day 5 (3): …  day 6 (3): …  day 0 (3): …
```

~~THE WITHDRAWN CLAIM FOLLOWS.~~

## ~~FINDING 1 — A FUTURE-DATED AWAY ANSWER BECOMES NO CONSTRAINT AT ALL~~

**Boundary: `activeTemporarySourceFacts` (`rules/temporarySourceFact.ts:620`),
called by `composeTemporarySourceFactCompatibility` with a single `onDate`.**

An athlete who marks his trip on the Monday for a Wednesday departure produces a
correct, correctly-dated fact — the trace prints it: `equipment:without
2026-08-12 .. 2026-08-16 removes: barbell, cables, machine, bench, pullup_bar,
kettlebell, plyo_box, rack, trap_bar, swiss_ball, ab_wheel,
back_extension_bench, dip_bars, rings_trx, foam_roller`.

`activeTemporarySourceFacts` then filters facts by `factHorizonCoversDate(fact,
onDate)`. `2026-08-12 .. 2026-08-16` does not cover `2026-08-10`, so **the fact
is dropped and NO constraint is produced.** B2's resolver reads 19 tags with the
removal sitting right there in the fact list.

**What the athlete gets:** B2's visible Wednesday `2026-08-12` — the first day of
the trip — reads **`Back Squat`, `RDLs`, `Bulgarian Split Squats`**. He is in a
hotel with a squat rack on the screen.

---

## FINDING 2 — THE KIT IS RESOLVED AT ONE DATE AND A WHOLE WEEK IS COMPOSED AGAINST IT

**Boundary: `buildGeneratedMicrocycles` (`services/api/generateProgram.ts:858`),
`resolveEquipmentCapabilities(profile, args.activeConstraints,
blockState.weekStart)`.**

B3 is the proof, and it is a disagreement **inside a single run**:

```
resolver tags (3): bodyweight, dumbbells, bands      ← asked for 2026-08-14, inside the span
composer kit  (19): bodyweight, barbell, dumbbells, … ← asked for the WEEK START
```

Booting on the Thursday of the trip, the constraint IS live and the resolver
answers correctly — and the composer still receives the full commercial gym,
because it asks at `blockState.weekStart`, which precedes the span.

B6 is the control that isolates the date argument and nothing else: **the
identical removal, moved to start on the week's own Monday, gives the composer a
3-tag kit.** Same fact, same athlete, same week; only the start date differs.

**A week is one kit answer. A trip is a date range. The two cannot both be
right, and today the week wins.**

---

## FINDING 3 — WHEN THE REMOVAL DOES REACH THE COMPOSER, IT REWRITES THE RECORDED BASE SELECTION

**Boundary: `composeWeek` (`rules/composeWeek.ts:1238`).** `inputs.kit` is applied
inside `legalUnder`, which feeds **both** `baseLegal` and `legal`. The file says
so in its own words: *"Equipment is deliberately in BOTH … an exercise the
athlete genuinely cannot perform is replaced in the base selection rather than
retained with a warning."*

That is right for a **permanent** kit change and wrong for a **temporary** one,
and the composer cannot tell them apart — `kit` is one flat list of strings with
no notion of which removals expire.

Measured, B6 against B0 — the rows `composeWeek` hands out as `selections`, which
is exactly what `recordBlockSelections` persists:

```
squat              Back Squat             -> Goblet Squat
horizontal_pull    Barbell Row            -> Single-Arm DB Row
horizontal_push    Bench Press            -> Single-Arm DB Floor Press
single_leg_knee    Bulgarian Split Squats -> Cossack Squat
accessory_or_core  Ab Wheel               -> Band Pallof Press
vertical_pull      Lat Pulldown           -> (slot gone entirely)
```

**Nine slots recorded instead of ten, five of them the trip's answer.** On the
accepted path (`recordSelections: true`) a five-day holiday becomes the
athlete's permanent rotation history.

**AND `substitutedFor` IS NEVER POPULATED — IN ANY OF THE NINE BOUNDARIES.** The
temporary-substitute record exists (`composeWeek.ts:1351`) and has **zero readers
anywhere outside `composeWeek.ts`**. It cannot fire on a kit change *by
construction*: the kit is in `baseLegal`, so there is never a base to be
substituted *away from*. The mission's *"store the base selection separately from
the temporary substitute"* has a written field and no live path.

---

## FINDING 4 — THE TRAVEL PASS DELETES THE ATHLETE'S OWN SESSIONS AND REFUSES THE WEEK

**This is the biggest one, and it needs NO equipment change to fire.**

**B8: travel fact only, FULL 19-tag commercial gym, composer output
byte-identical to B0's — and the week is REFUSED:**

```
main_strength_required_minimum   expected 2, actual 0
required_safe_patterns_present   the week trains no squat
required_safe_patterns_present   the week trains no hinge
required_safe_patterns_present   the week trains no push
required_safe_patterns_present   the week trains no pull
```

The composer emitted **four** `main_strength` rows covering exactly those four
patterns. The constraint-pass tap says what happened to them:

```
2026-08-10 day1 "lower_squat"    rows 5 -> 2   removed: Back Squat, RDLs, Bulgarian Split Squats
2026-08-11 day2 "Team Training"  rows 3 -> NULL (caller collapses to REST)  removed: Barbell Row, Lat Pulldown, Band Pull-Apart
2026-08-12 day3 "lower_hinge"    rows 5 -> 2   removed: Back Squat, RDLs, Bulgarian Split Squats
2026-08-13 day4 "Team Training"  rows 3 -> NULL (caller collapses to REST)  removed: Bench Press, DB Shoulder Press, Banded External Rotation
2026-08-15 day6 "Game"           rows 0 -> NULL (caller collapses to REST)
```

Two separate defects, both in
`validateWorkoutAgainstActiveConstraints`
(`utils/postGenerationConstraintValidation.ts`), which
`buildCanonicalCandidate` runs **inside generation** on every composed workout
whenever any hard constraint is live:

**(4a) A day that carries the athlete's OWN strength is collapsed as
"team-training only".** The `travelling` branch (`:366`) tests `fixtureStub ||
team.isTeamTrainingOnly` and returns `workout: null`; the caller collapses to
rest. Tuesday and Thursday carried six of the athlete's own lifts — the club's
night and his gym session are merged into one workout by
`assembleAuthoredWeek`, and `isTeamTrainingOnly` still answers true. **Six lifts
he could do anywhere are deleted because the club is shut.** That is exactly what
R-018 (*"if yes, follow same program"*) and R-020 (*"the athlete's own sessions
stay"*) forbid, and exactly the defect the item-28 comment two files away claims
was already removed.

**(4b) Merely having a hard constraint routes the composed week through a second
canonicalisation that destroys main lifts.** Monday and Wednesday lose `Back
Squat`, `RDLs` and `Bulgarian Split Squats` **with a full commercial gym and no
equipment constraint of any kind**. `hasEquipmentConstraint` is false on that
run, so `availableEquipment` is null and the equipment filter never runs; the
loss is `finaliseWorkoutAfterMutation(..., restoreMissingPlanPatterns: false)` at
the foot of the pass. On B0 the pass never runs at all
(`hardPostGenerationConstraints.length === 0`), which is the only reason the
ordinary week survives. **The pass is not idempotent on a composed week.**

---

## FINDING 5 — A SECOND EQUIPMENT AUTHORITY, READING OLD PROGRAM CONTENT

`validateWorkoutAgainstActiveConstraints:518` filters rows with
`equipmentRequirementsAreAvailable(row.exercise?.equipmentRequired, …)` — the
**authored `equipmentRequired` strings carried on the materialised row** — while
the composer and the pool walk ask `exerciseIsAvailableWith`, Sam's sheet, which
knows OR-groups and `BODYWEIGHT_CAPABLE`.

Measured in B7 (dumbbells + bands): **`RDLs` is removed.** Sam's sheet answers
`[['barbell','dumbbells']]` — an OR-group — and the athlete HAS dumbbells, so the
sheet says legal. The row's authored string says barbell, and the flat reader
says no. **Two authorities, one question, and the loser is the athlete's hinge**
— which is then reported back as `required_safe_patterns_present: the week trains
no hinge`.

This is the mission's *"Nothing else may infer equipment from … old program
content"* violated by name.

---

## FINDING 6 — SANDBAG: THE SHEET IS NOT A VOCABULARY SOURCE

`EXERCISE_EQUIPMENT_REQUIREMENT["Bear Carry"] = ['sandbag']`
(`data/exerciseEquipmentRequirement.ts:61`). `sandbag` is **not** in the
`EquipmentTag` union, not in `EQUIPMENT_TAG_LABELS`, not in
`FULL_GYM_EQUIPMENT`, and not askable.

The cause is structural, not a missing entry: `deriveEquipmentVocabulary`
(`rules/equipmentVocabulary.ts:152`) derives the checklist from **five** sources —
`POOL_REGISTRY`, `STRENGTH_POOLS`, `POWER_EXERCISE_POOL`, `DEFAULT_EXERCISES`,
`CONDITIONING_META`/`CONDITIONING_TEMPLATES` — and **Sam's own signed sheet is not
one of them.** The gate that is supposed to red in both directions cannot see the
requirement, so `Bear Carry` is refused on every kit forever and nobody is told.

The fix is to make the sheet a vocabulary source, not to whitelist Bear Carry.

---

## WHAT THIS MEANS FOR THE MISSION

The mission's framing — *"the current away feature already exists, reconcile it
with the new scheduler and composer"* — assumed a working away flow that needed
joining up. **Measured, the away flow only appears to work because its fact is
silently dropped (Finding 1). The moment the constraint is genuinely live at the
week start, the week is refused (Finding 4) and the athlete's own sessions are
deleted (4a).**

So `BURN THE BOATS` applies squarely and the legacy authority is named:
**`validateWorkoutAgainstActiveConstraints`'s travel branch and its second
equipment filter are an executing legacy authority that rewrites and rejects the
composer's result.** They are in scope for removal by the mission's own words.

---

---

# SLICE 1 — LANDED. ONE EQUIPMENT OWNER, RESOLVED PER DAY.

**Findings 1, 2 and 3 are closed. Findings 4, 5 and 6 are open and are the next
slices.**

## WHAT MOVED

**`resolveEffectiveEquipmentWindow`** (`utils/equipmentAvailability.ts`) — the one
owner, answering both questions and keeping them apart: `permanent` (profile,
no constraints) and `byDate` (profile minus whatever applies that date).
`reachableAcrossWindow` is the week's own answer, for §18.

**`composeWeek`** takes `kit` (now documented as PERMANENT) **and** an optional
`temporaryKitByDayOfWeek`. `baseLegal` is decided against the permanent kit and
is what gets RECORDED; `legal` is decided against the day's kit and is what
SHIPS. Three consequences fall out rather than being coded:

- **The base returns on the return date with no expiry code anywhere** — the day
  simply stops carrying an entry.
- **`substitutedFor` has a live path for the first time.** It fired ZERO times in
  all nine measured boundaries before this, because with kit in `baseLegal` there
  was never a base to substitute away from.
- **A world with no dated removal passes `undefined` and is byte-identical.**

**One leak was found only after the split landed**, and it is worth writing down:
the R-080 variety narrowing descended from `legal` — today's kit — and its result
fed the BASE decision, so an away week still recorded
`accessory_or_core: Ab Wheel → Band Pallof Press`. It now narrows `baseLegal`.
**There is still exactly one variety computation**; it was pointed at the right
list.

**A second leak: `legal.length === 0` used to `continue` before the record was
written**, so a slot the athlete OWNS the kit for and cannot reach today lost its
history entirely — nine slots recorded instead of ten, `vertical_pull` gone
because a hotel room has no bar. The decision is now made and recorded first; the
gap is disclosed and the ROW dropped immediately after.

## THE MEASURED BEFORE AND AFTER — `npm run trace:equipment-scopes`

Base selection recorded, against the home week, per boundary:

| | before slice 1 | after |
| --- | --- | --- |
| B2 away, mid-week | 0 changed | 0 changed |
| B3 boot during trip | 0 changed | 0 changed |
| **B6 away, whole week** | **8 changed, 1 slot lost** | **0 changed, 0 lost** |
| **B7 kit removal only** | **8 changed, 1 slot lost** | **0 changed, 0 lost** |
| B5 next block | 8 changed (legitimate rotation) | 8 changed (unchanged) |

And the substitutes now exist and name what they replaced:

```
day 1 squat              shipped=Goblet Squat              base=Back Squat (kit_today)
day 1 single_leg_knee    shipped=Cossack Squat             base=Bulgarian Split Squats (kit_today)
day 2 horizontal_pull    shipped=Single-Arm DB Row         base=Barbell Row (kit_today)
day 4 horizontal_push    shipped=Single-Arm DB Floor Press base=Bench Press (kit_today)
```

## THE GUARD — `npm run test:equipment-scopes`, 7 cells, IN `test:bible`

Registered as `LAW-temporary-equipment-never-permanent`. Every cell drives
`generateProgramLocally` and reads the live composer through the trace's single
observer, so **the guard and the trace cannot drift into two answers about one
run**.

**MUTATION-PROVEN THREE WAYS**, tree restored byte-identical after each:

| mutant | result |
| --- | --- |
| `baseLegal` back on the dated kit (the original defect) | **4 cells red**, non-vacuity included |
| record the SHIPPED row instead of the base | **cell [2] red** |
| restore the skip that dropped an unfillable slot | **cells [2] and [3] red** |

**The controls are half the suite and they are not decoration.** Cell [6] changes
the athlete's PERMANENT answer and REQUIRES the record to move; cell [1] proves
the removal reached the composer before anything else is asked. Neither passes on
an app that has stopped reading equipment.

**A "freshest first" substitute was tried and BACKED OUT the same day.** It
shipped an Intermediate athlete `Bodyweight Squat` on a dumbbells-and-bands kit
because `Goblet Squat` had already been used that week and lost its freshness.
Cell [4] caught it on its first run. `legal[0]` is already ordered by
`hingePriorityFirst` over `experiencePreferred`, so its head is the best row the
athlete can do today, and Sam's ruling is explicit that regressions are for an
athlete with *"no loaded option"*.

## WORLDS LOST AND GAINED — SEPARATELY, AND BOTH ARE ZERO

Every number below was produced by running the same suite in **two worktrees at
once**: `lfa-equip` (this branch) and `lfa-base` (detached at `6b617847`).

| instrument | base `6b617847` | slice 1 |
| --- | --- | --- |
| `test:ladder-wide` | 140 worlds, **40 refused**, 0 deficient of 368 laddered days, ceiling 0 | **identical** |
| R-083 kit-blocked census | 84 days — `vertical_pull` 80, `horizontal_pull` 32, `vertical_push` 32 | **identical** |
| R-089 pair census | 2 shapes, 0 unmatched, 640 exposures | **identical** |
| `test:scenarios` | 62 passed, 3 failed | **62 passed, 3 failed — the same three, same assertion text** |
| `print:week` | 2 refused (`1-early-off-season`, `6-bodyweight-only`), 11 findings | **identical** |
| `test:compile` | 468 errors; product 35, devtools 51, tests 382; **6 file/scope pairs worse** | **468; product 35, devtools 51, tests 382; the same 6** |
| `test:law-registry` | 128 rows, 107 guarded, **21 UNENFORCED**; 12/2 | 129 rows, 108 guarded, **21 UNENFORCED**; 12/2 |

**ZERO worlds lost. ZERO gained. Zero type errors added in any scope.** The
UNENFORCED ratchet did not rise.

**⚠ `test:compile` FAILS ON THE BASE COMMIT ITSELF** — six `bibleConformance`
observation files exceed their baseline before I touched anything. That is
recorded here because a future reader will otherwise attribute it to this branch.

**Two of my own type errors were found by the gate and fixed, not baselined.**
Importing the trace into a suite pulled `scripts/print-week.ts` and
`scripts/trace-equipment-scopes.ts` into the tests scope for the first time, and
both declared `__DEV__` — which the tests project already declares. The repo
already had the convention written down
(`src/__tests__/sprintCreditEvidenceTests.ts:22`); both now follow it. **Nothing
moved but a declaration; the assignment is untouched in both files.**

---

# SLICE 2 — LANDED. THE BOATS ARE BURNED.

**Findings 4 and 5 are closed. Finding 6 (sandbag) is the last one open.**

## THE HEADLINE

**Every one of the nine trace boundaries now publishes a week. Zero refusals.**
Before slice 2, three of them produced nothing at all — including a trip taken
with a full commercial gym.

`test:away-flow` **went from THROWING to 47 passed, 2 failed.** It could not
produce a single cell on the base commit.

## WHAT MOVED

**The removal is in the PLAN now, not in a pass over a finished week.**
`weeklySchedulerInputs.clubInputsAfterTravel` takes the club night and the
fixture out of the facts the scheduler is told about, using the shared
`awaySpans.ts` owner so the plan side and the read side cannot disagree about
which days are inside a trip. **This is the fix
`postGenerationConstraintValidation`'s own comment named and did not build** —
*"the allocator must not mark a day `isTeamDay` inside a live travel span"*.

**`travel` and `equipment` were then removed from
`hardPostGenerationConstraints`.** Each removal names where the behaviour went:

| removed | went to |
| --- | --- |
| equipment filtering | `composeWeek`'s per-day kit (slice 1). It refuses an illegal row **before** authoring it and discloses a typed gap, and it asks the right oracle — the pass filtered on the materialised row's authored `equipmentRequired` STRING, which answers *"what kit does this use"*, while `exerciseIsAvailableWith` answers *"can this athlete do it"* and knows Sam's OR-groups. `RDLs` is legal on dumbbells by the sheet and was being deleted by the string, then reported to §18 as *"the week trains no hinge"*. |
| travel filtering | `clubInputsAfterTravel`, above. |

**Every other schedule kind still runs through that pass, untouched.**

## THE ATHLETE'S AWAY WEEK, WITH DUMBBELLS AND BANDS ONLY

Produced by the run that wrote this file — B6, previously REFUSED:

```
Mon  Strength    Goblet Squat · RDLs · Cossack Squat · Single-Leg RDL · Band Pallof Press
     Conditioning Bodyweight Conditioning Circuit
Tue  Strength    Single-Arm DB Row · Band Pull-Apart
     Conditioning Outdoor Running Intervals
Wed  Strength    Single-Arm DB Floor Press · DB Shoulder Press · Banded External Rotation
     Conditioning 20 s Max Sprint — Small Dose
Thu  Rest
Fri  Gunshow     Concentration Curl · Hammer Curl · Dumbbell Kickback ·
                 Banded Tricep Pushdown · Single-Arm Shrug · Lateral Raise
```

Every row is legal on a hotel kit. No club night, no fixture. The recorded block
selection is still `Back Squat / Barbell Row / Bench Press / Bulgarian Split
Squats / Ab Wheel`, untouched.

## THE GUARD — 13 cells now, and one of them exists because a mutant survived

**⚠ CELL [10] SURVIVED THE MUTANT THAT DISABLES THIS FIX.** Disabling the
plan-side removal left *"the club's work inside the span is gone"* green, because
the READ side hides club work from the projection whatever the plan did. So [10]
holds a real athlete-visible property and **nothing about this change**. `[10b]`
was added to hold the owner's contract directly, and it kills that mutant.

| mutant | result |
| --- | --- |
| plan-side removal disabled | **[10b] red** |
| `travel` restored to the in-generation filter | **[8] and [11] red** |

Registered as `LAW-away-removes-the-club-not-the-athlete`. Registry now 130 rows,
109 guarded, **21 UNENFORCED — the ratchet has not risen.**

## WORLDS LOST AND GAINED

| instrument | base `6b617847` | slice 2 |
| --- | --- | --- |
| `test:ladder-wide` | 140 worlds, 40 refused, 0 deficient of 368 | **identical** |
| `test:scenarios` | 62 / 3 | **62 / 3, same three** |
| `print:week` | 2 refused, 11 findings | **identical** |
| `test:compile` | 468; product 35, devtools 51 | **identical, same 6 pre-existing** |
| `test:weekly-scheduler` | 96/96 | **96/96** |
| `test:away-flow` | **THREW — no cells** | **47 passed, 2 failed** |

**Worlds gained: 3 of the trace's 9 boundaries now publish that did not.**
**Worlds lost: none.**

## THE TWO REMAINING `away-flow` REDS — LOCATED, NOT GUESSED

Neither is a regression from green: **the suite threw on the base commit and
produced no cells at all.**

**[13h]** *"every club night the trip removes comes back as CONDITIONING, one for
one"* — reads `awayClub: 6` of 8. **There is a SECOND scheduler-input builder:**
`coachingInputsToSchedulerInputs` (`generateProgram.ts`), which takes
`CoachingInputs`, hardcodes `unavailableDays: []` and has no constraint awareness
at all. Two representations of one fact, which is the defect class this repo
fights. Threading constraints into `buildInitialGeneratedCoachingPlan` needs its
own unit and its callers updated — **it is named here rather than half-built at
the tail of a session**, which the handoff says is how the last two nights went
wrong.

**[13f]** *"the away week is RE-AUTHORED, not the home week minus the club"* —
reads `dropped: 0, homeRows: 11, awayRows: 17`. The cell asserts `dropped > 0`;
the away week now GAINS six rows and drops none, which satisfies the cell's
stated INTENT more strongly than the assertion does. **It is left red and named
rather than edited to match the new behaviour**, because deciding that an
approved contract outranks it is a call worth making in daylight.

---

# SLICE 3 — LANDED. THE SANDBAG, FIXED AT THE AUTHORITY.

**Finding 6 is closed. All six findings from the trace are now closed.**

## THE DEFECT WAS AN AUTHORITY, NOT A MISSING ENTRY

`EXERCISE_EQUIPMENT_REQUIREMENT["Bear Carry"] = ['sandbag']` is Sam's own answer
from his sheet, where he wrote *"sand bag / dead ball"*. `sandbag` existed in no
tag union, no label map, no icon record and no checklist — so
`exerciseIsAvailableWith` asked every athlete for a thing none of them could own
and **Bear Carry was refused on every kit, forever, in silence.**

**The both-directions gate could not see it.** `deriveEquipmentVocabulary`
derived the checklist from FIVE authored sources and Sam's sheet was not one of
them. Worse, for this exercise the two authorities actively disagreed: the sheet
says `sandbag`, `equipmentClassFor` says `dumbbell` because that is what you load
it with, **so the checklist asked about dumbbells while availability asked for a
sandbag and the two never met.** That is R-083's load-versus-availability
conflation still living inside the vocabulary module.

## WHAT MOVED

**Sam's sheet is read FIRST** for any exercise it knows; the load class answers
only for names it does not. An OR-group demands EVERY member — *"barbell or
dumbbells"* means either satisfies the row, so the athlete must be asked about
both.

**`STRENGTH_NAME_TO_TAG` is DELETED and nothing moved.** Its one row
(`'Back Extension': 'back_extension_bench'`) was already in the sheet. It was a
per-name patch for exactly this general defect, and its own docstring named the
general defect.

## MEASURED — BASE vs AFTER

| | base `6b617847` | after |
| --- | --- | --- |
| derived checklist | 17 tags | **18 — gains exactly `sandbag`, loses nothing** |
| `unmappableRequirements` | 0 | 0 |
| `unclassifiedStrengthNames` | 0 | 0 |
| bench demand | 10 sites | **22** — `Bulgarian Split Squats` really does need one |
| rack demand | 1 site | **6** — `Back Squat` really does |
| bodyweight demand | 59 | **42** — the load class was answering for names the sheet knows |

Through the app's own oracle:

```
commercial gym   : true
same minus bag   : false
dumbbells only   : false
control Farmer   : true      ← carries generally are not broken
```

**No name whitelist and no Full-Gym exception exist.** Commercial = all askable,
so the sandbag is pre-ticked there and on **no other preset**; the signed club
and home lists are untouched.

## THE GUARD — 3 more cells, each mutation-proven

| mutant | result |
| --- | --- |
| a `Bear Carry` name exemption in the oracle | **[13] red** |
| the sheet stops being a vocabulary source | **[14] red** |
| the home preset quietly gains a sandbag | **[15] red** |

`test:equipment-scopes` is **16 cells**; `test:equipment-vocabulary` went 84 → 87,
all green. Registered as `LAW-every-authored-requirement-is-askable`. Registry
131 rows, 110 guarded, **21 UNENFORCED — the ratchet still has not risen.**

World census, `test:scenarios`, `print:week` and `test:compile` all identical to
base.

---

# SLICE 4 — `test:away-flow` IS GREEN, AND MY OWN DIAGNOSIS WAS WRONG

**`test:away-flow`: 51 passed, 0 failed.** It THREW on the base commit and
produced no cells at all.

## THE CORRECTION

Slice 2's write-up said [13h]'s `awayClub: 6` of 8 was caused by a second
scheduler-input builder, `coachingInputsToSchedulerInputs`. **Measured per week,
that is refuted: it is not on this path, and 6 is the correct answer.**

The trip in that fixture runs `2026-07-13` → `2026-07-19` — **one week** — and the
generator returns **four**. Three of those weeks belong to an athlete who is at
home.

```
home   13th{club 2, game 1, cond 0}  20th{2,1,0}  27th{2,1,0}  3rd{2,1,0}
away   13th{club 0, game 0, cond 4}  20th{2,1,0}  27th{2,1,0}  3rd{2,1,0}
```

**The old cell asserted `blockAway.club === 0` across the whole block — it
required a one-week trip to delete three weeks of club nights.** That contradicts
R-020's dated scope and Sam's own worked example: *"the game on the 15th should
be removed … but the next saturday the 22nd game is still alive"*. It passed only
because the old away pass filtered by constraint PRESENCE rather than by DATE.
**The cell had pinned the leak.**

## THE REWRITE IS STRICTER IN BOTH DIRECTIONS

Counting is now **per week**, not per block — a trip has dates, so a four-week
total cannot tell *"the club came off inside the span"* from *"the club came
off"*.

| cell | asserts |
| --- | --- |
| `[13g2]` | non-vacuity — the block really does straddle the trip |
| `[13h]` | inside the span, club **and** game are 0, and the conditioning gained covers what was removed |
| `[13h2]` | outside the span the weeks are **byte-identical** to the home block — which the old whole-block total could not check at all |

**`[13f]` lost its `dropped > 0` clause and got stronger.** Its stated fear is
*"it reds if away ever stops re-authoring and goes back to subtracting"*, and
that is the second clause — rows the home week never had. `dropped > 0` only
passed because the old pass DELETED rows: it pinned the symptom of the very
defect its own suite exists to catch. Measured after: `dropped 0, homeRows 11,
awayRows 17`. **A superset cannot be a subtraction.**

## MUTATION-PROVEN

| mutant | result |
| --- | --- |
| plan-side removal disabled | **4 cells red**, including `[13h]` |
| removal made span-BLIND (the exact old behaviour) | **`[13h2]` red, and nothing else** |

Census unchanged: `test:ladder-wide` 140 worlds / 40 refused / 0 deficient,
`test:scenarios` 62/3, `test:compile` 468 with the same 6 pre-existing,
`equipment-scopes` 16/0, `weekly-scheduler` 96/96, `equipment-vocabulary` 87/0.

---

# OPEN, MEASURED — A SECOND CONTENT PRODUCER IGNORES THE DAY'S KIT

**The trace's own legality audit found it, and it is athlete-facing.** On a
mid-week trip with dumbbells and bands, every composed STRENGTH row is legal —
and the **Gunshow** on the Friday ships **`Tricep Pushdown`, which needs
cables**, in a hotel room.

```
2026-08-14 [kit: 3]  Training Day
  Gunshow
    - Incline Dumbbell Curl
    - Banded Bicep Curl
    - Tricep Pushdown   ⚠ ILLEGAL ON THIS DAY'S KIT (needs cables)
```

**IT IS NOT THE BRANCH I FIRST BLAMED, AND THAT IS MEASURED RATHER THAN
ASSUMED.** `defaultProgram.ts`'s `composedOptional` branch calls
`buildDerivedSession('arms_pump', …, { equipmentTags: [...availableEquipment] })`
with the WEEK's kit, which looked like the obvious cause. I threaded a per-day
map to it and **the probe on that branch never fired once across all nine
boundaries** — so that branch does not author this Gunshow at all.

**The change was REVERTED rather than left in.** A field written by generation
and read by nobody on the live path is dead weight that a later reader will
trust, which is the defect class this repo fights hardest.

**WHERE THE NEXT SESSION STARTS:** find the producer that actually authors these
arms rows, then give it the same dated answer `composeWeek` already takes. The
one-owner shape is settled — `resolveEffectiveEquipmentWindow` →
`temporaryKitByDayOfWeekFrom` — so this is a wiring job into a producer that has
to be located first. **Do not re-patch `composedOptional`: it is proven inert
for this path.**

---

# SLICE 5 — THE PRODUCER, CLASSIFIED; THE CLASS, FIXED AT THE BOUNDARY

## THE PRODUCER, TRACED TO ITS EXACT OWNER

`Tricep Pushdown` is authored at **READ time**, not by generation:

```
sessionResolver.ts:925   applyGameProximity → buildDerivedSession('arms_pump', date, …, athlete)
```

Generation was innocent throughout. `defaultProgram`'s `composedOptional` branch —
the one I blamed in session 2 — **never fires on this path**, proven by a probe
that printed nothing across all nine boundaries.

## CLASSIFICATION — SPECIALIST, NOT A SECOND STRENGTH SELECTOR

`buildDerivedSession('arms_pump')` selects from exactly one authored recipe:

```
arms_pump: [ { biceps, count 2 }, { triceps, count 2 }, { delts, count 2 } ]
```

**It never selects squat, hinge, push or pull, and it never rewrites a composer
row's identity.** It is a legitimate Gunshow specialist. Per the ruling: its
recipe is KEPT and it is fed the canonical effective-day kit. **No second
strength selector was found and none was created.**

**But its PLACER is a different matter, and it is a real duplicate authority.**
`applyGameProximity` decides a whole day's identity and will displace a
composer-authored strength day. Measured on the away week: the composer authored
`day 5 lower_hinge` — `Goblet Squat`, **`RDLs` (a MAIN LIFT)**, `Cossack Squat`,
`Single-Leg RDL`, `Band Pallof Press` — and the athlete was shown a Gunshow,
because the read side re-derived a **phantom Saturday fixture inside the trip**
and called that Friday G−1. **§18 counted those rows; the athlete never got
them.**

## WHAT MOVED — ONE BOUNDARY, NOT SEVEN CALL SITES

**`withAthleteKitForDate` at the top of `_resolveDateRaw`.** There are seven
builder hand-offs inside one date resolution; scoping the STATE once means every
producer inside that date — Gunshow, freed-slot accessories, mobility flush,
post-game — receives the same effective day kit, including producers added later.
A world with no live fact returns the state by identity.

**The fixture derivation now honours the trip.** `getEffectiveGameDates` drops
virtual fixtures inside a live away span, through the same shared `awaySpans.ts`
owner the plan side uses. An **explicitly marked** game is left alone — a mark is
the athlete's own word; this removes only a fixture nobody stated.

## ⚠ THESE TWO CHANGES ARE PROVEN BY THE TRACE AND **NOT HELD BY A CHAIN CELL**

Stated plainly because a green gate is a claim.

**The trace proves both.** Reverting both (`mutant M`) and re-running
`npm run trace:equipment-scopes` restores the defect exactly:
`Tricep Pushdown ⚠ ILLEGAL ON THIS DAY'S KIT (needs cables)` on the Friday of a
mid-week trip. The control run reports **0**.

**The suite does not.** `test:equipment-scopes` [16]/[17] stay GREEN under both
mutants, separately and together. Three attempts to close that gap — adding a
mid-week world, adding a fixture cell, threading the recorded home history —
all still passed under mutation. **The suite's world does not reproduce the
composed week the trace's does, and I ran out of cap before finding why.**

**By this repo's three words these two changes are `BUILT`, not `WORKING`.**
They are correct, they are measured, and they are not guarded. That is the
central caveat of the merge verdict below.

## NEXT — THE REMAINING BUILD ORDER

1. ~~ONE EQUIPMENT OWNER, RESOLVED PER DAY.~~ **DONE — slice 1.**
2. ~~THE RECORD IS THE PERMANENT ANSWER.~~ **DONE — slice 1.**
3. **DELETE THE LEGACY TRAVEL/EQUIPMENT AUTHORITY** in the in-generation pass
   (findings 4 and 5); the composer already owns both questions. **This is the
   `BURN THE BOATS` target and it is the biggest remaining piece:** travel alone
   still refuses the week and still deletes six of the athlete's own lifts.
4. ~~DELETE THE LEGACY TRAVEL/EQUIPMENT AUTHORITY.~~ **DONE — slice 2.**
5. ~~SANDBAG.~~ **DONE — slice 3.**
6. ~~THE SECOND SCHEDULER-INPUT BUILDER.~~ **NOT A DEFECT — refuted by
   measurement in slice 4.** `coachingInputsToSchedulerInputs` is not on the
   away path; the two `away-flow` reds were stale cells pinning a leak.
7. **THE SECOND CONTENT PRODUCER** — locate whoever authors the Gunshow rows and
   feed it the per-day kit (see the open finding above).
8. **THE REMAINING MISSION PROOFS** — 15 worlds, the printed weeks for Sam, and
   the session-scope leg of the trace. All of them were blocked on the refusal
   that slice 2 removed.

## NOT COVERED YET

- **Findings 4, 5 and 6 are open.** An away week that genuinely starts on a
  Monday still REFUSES, so mission proofs 5, 6 and 14 cannot be produced and the
  printed weeks Sam asked for cannot be printed. That is the next slice and it is
  the one that unblocks the rest.
- Session-scope (`applySessionEquipment`) not yet driven in the trace.
- Injury + away combination not yet run.
- Nothing has been seen on glass.
- The two `test:composer-b1` reds and the `test:edge-generation-equipment` red on
  base are recorded, not diagnosed. Both are unchanged by slice 1.


---

# SLICE 6 — THE FRIDAY BLOCKER, TRACED AND CLOSED

## THE TRACE, LAYER BY LAYER

Mid-week trip, dumbbells and bands, Friday `2026-08-14`:

| layer | answer |
| --- | --- |
| scheduler intention | strength day allocated |
| **composer output** | `day 5 lower_hinge`, 5 rows, `RDLs` classified **`main_strength`** |
| materialised workout | `lower_hinge \| Strength \| 5 rows` |
| **stored accepted program** | `lower_hinge \| Strength \| 5 rows` |
| `resolveWeek` (base read) | `lower_hinge \| Strength \| 5 rows` |
| **`section18TierFour`** | **`Rest \| Rest \| 0 rows`** ← the loss |
| `applyAwayPass` | passes it through |
| visible projection | **Rest Day** |

**§18 counted those rows on the way in and the athlete never got them.** The
week that was judged and the week that shipped disagreed about a main lift.

## THE CLASS FIX

Tier 4 at read is a **conforming** pass. Its conform-back map installed a Rest
the gateway had invented for that weekday. It now **refuses any conformed
workout that carries no work over a day that does**, unless
`userRemovalConstraints` / `removalDecisions` name that exact date. The rule
reads the **shape of the answer** — never a weekday, a session name or a kit.

**AND IT RESOLVED A SPLIT I HAD CREATED.** `getEffectiveGameDates` exempted an
*explicitly marked* fixture inside a trip while the plan side dropped it
regardless — so the two sides disagreed about one Saturday, the plan built a
Friday lower day, and the read side called it G−1 and replaced it with a Gunshow
(`weekday 5 lost Goblet Squat, RDLs, Cossack Squat, Single-Leg RDL, Band Pallof
Press`). **A mark says a fixture exists; it does not say the athlete is in the
country for it.** The exemption is deleted; both sides give one answer.

## THE PRODUCER, CLASSIFIED — SPECIALIST, KEPT

`buildDerivedSession('arms_pump')` selects only `biceps ×2, triceps ×2, delts
×2`. It never selects squat, hinge, push or pull and never rewrites a composer
row's identity. **Its recipe is kept and it is fed the canonical effective-day
kit. No second strength selector exists, and none was created.**

## THE TWO EARLIER FIXES — ROUTE QUESTION RESOLVED

They were covering for each other. After unifying the fixture answer:

| owner | responsibility | guarded by |
| --- | --- | --- |
| tier-four boundary | a projection may not delete authored work | [19] [19b] [20] — mutant reds all three |
| span fixture filter | a fixture inside a trip does not survive | [19b] — mutant reds it alone |
| ~~`withAthleteKitForDate`~~ | read-side per-day equipment | **DELETED — proven inert, see below** |

## THE UNGUARDED FIX — DELETED, NOT KEPT

`withAthleteKitForDate` (read-side per-day equipment scoping, used by
`_resolveDateRaw` and `freedByTheTrip`) was the one production change with no
guard. **It is deleted.**

**PROVEN INERT BOTH WAYS, not assumed.** With it disabled:

| instrument | result |
| --- | --- |
| ten-world equipment trace | **byte-identical** |
| the five printed weeks | **byte-identical** |
| `test:equipment-scopes` | 24 / 0 |
| `test:away-flow` · `away-span-ownership` · `exercise-exclusions` | 51/0 · 8/0 · 52/0 |
| `test:scenarios` · `print:week` | 62/3 · same 2 refusals |

**AND THE REASON IS CAUSAL, NOT JUST EMPIRICAL — three routes, all closed:**

1. **Strength is composed at generation** against the per-day kit, and a
   projection may no longer replace a composer-authored session.
2. **The G−1 Gunshow cannot land inside a trip.** A fixture inside a live span is
   gone; a fixture *outside* the span leaves G−1 on a Rest template that
   proximity does not displace. That was the `Tricep Pushdown` route and it is
   shut. Measured directly: a Mon–Fri trip with the Saturday game surviving
   leaves Friday a Rest Day, not a Gunshow.
3. **`freedByTheTrip` authors CONDITIONING**, whose machine choice belongs to the
   modality owner, not to `AthleteContext.equipmentTags`.

**⚠ WHAT WOULD BRING IT BACK, named at the deletion site so this is a decision
and not amnesia:** any read-side producer that authors STRENGTH or ACCESSORY rows
on a date inside a live equipment span. The athlete-side property is held
regardless by `[16]`/`[21]`, which walk every visible row against that day's kit
whatever authored it.

## ACCEPTANCE

| criterion | result |
| --- | --- |
| zero composer-authored sessions disappear (home, away, departure, return, post-trip) | **PASS** — [19] + [19b] |
| every visible exercise legal for that day's kit | **PASS** — 134 rows, 10 worlds, **0 illegal** |
| printed dumbbell-away Friday shows the authored strength session | **PASS** — `Goblet Squat, RDLs, Cossack Squat, Single-Leg RDL, Band Pallof Press` |
| all new guards seen red | **PASS** — [19]/[19b]/[20] under the boundary mutant, [19b] under the span mutant |
| targeted gates + world census rerun | **PASS** — all at baseline |

`test:equipment-scopes` **24 / 0**. Registry 132 rows, 111 guarded, **21
UNENFORCED — the ratchet never rose.**

---

# MERGE VERDICT

**⚠ SUPERSEDED BY SLICE 6 — SEE THE FINAL VERDICT AT THE FOOT OF THIS FILE.**

**MERGE THE BRANCH, WITH ONE NAMED FOLLOW-UP HELD OPEN.**

Base `6b617847` → `bb952170`, six commits, branch `feat/equipment-scopes`.

## WHY MERGE

The branch takes the away/equipment flow from **broken in three ways that reach
the athlete** to **a week that builds, ships legal work, and leaves his history
alone**:

| | base `6b617847` | now |
| --- | --- | --- |
| a trip with a full gym | **NO WEEK AT ALL** (§18 refused it) | publishes |
| the athlete's own lifts on a club night inside a trip | **six deleted** | kept |
| a five-day holiday | **rewrote his permanent rotation history** | records nothing |
| `Bear Carry` | **refused on every kit, forever, silently** | legal when a sandbag is ticked |
| `test:away-flow` | **THREW — no cells at all** | 51 / 0 |
| illegal rows on an away day | `Tricep Pushdown` in a hotel | **0 of 115 rows, 10 worlds** |

**No world was lost.** `test:ladder-wide` 140 worlds / 40 refused / 0 deficient
of 368, `test:scenarios` 62/3 with the same three, `print:week` the same two
refusals, `test:compile` 468 with the same six pre-existing failures and **zero
added**, `test:law-registry` 21 UNENFORCED — **the ratchet never rose.**

Three laws entered guarded, each mutation-proven:
`LAW-temporary-equipment-never-permanent`,
`LAW-away-removes-the-club-not-the-athlete`,
`LAW-every-authored-requirement-is-askable`.

## WHY NOT A CLEAN MERGE — THE ONE THING TO WEIGH

**Slice 5's two read-side changes are `BUILT`, not `WORKING`.** They are correct
and the trace proves them under mutation; **`test:equipment-scopes` does not hold
them**, and three attempts to close that gap failed inside the cap. If the rule
here is "nothing merges unguarded", **hold slice 5 (`bb952170`) and merge the
five commits below it** — slices 1–4 are fully guarded and independently
valuable, and `bb952170` touches only `sessionResolver`, the suite and docs.

## WHAT MERGING DOES NOT FIX — THE ATHLETE STILL LOSES A DAY

On a dumbbells-only trip the program **stores** `day 5 lower_hinge, 5 rows`
including a main lift, and the athlete **reads Rest Day**. He trains one day
fewer than the composer authored. Located to the read side; not to a function.
**This is the first thing the next session should take**, and it is the same
class as slice 5: a read-side authority overriding composer-owned content.

An athlete away with **no equipment at all** still gets no week
(`main_strength_planner_selected_target` 4 vs 3). That is R-090's parked
territory and the fence forbids weakening §18 to reach it.

## NOT COVERED

Nothing has been seen on glass. The session scope (`applySessionEquipment`)
writes no fact by design (R-072) and is not exercised here. Of the mission's 15
proof worlds, 10 are covered by the trace; the session-change worlds (2 and 3)
and the injury+away combination (14) are not.


---

# FINAL VERDICT — AFTER THE BLOCKER SESSION

**MERGE.** Base `6b617847` → branch `feat/equipment-scopes`.

The blocking defect is closed at the boundary, not patched: **no composer-authored
session disappears in any of the five weeks**, and the rule that holds it names
no weekday, no session and no kit.

| | base `6b617847` | now |
| --- | --- | --- |
| a trip with a full gym | **no week at all** | publishes |
| the athlete's own lifts on a club night in a trip | **six deleted** | kept |
| a holiday | **rewrote permanent rotation history** | records nothing |
| the composed Friday on a dumbbell trip | **shown as Rest Day** | **shown as its authored strength session** |
| `Bear Carry` | **refused on every kit, silently** | legal when a sandbag is ticked |
| `test:away-flow` | **threw — no cells** | 51 / 0 |
| illegal visible rows | `Tricep Pushdown` in a hotel | **0 of 134, across 10 worlds** |

**No world lost.** `test:ladder-wide` 140 worlds / 40 refused / 0 deficient of
368, kit-blocked census 84; `test:scenarios` 62/3 with the same three;
`print:week` the same two refusals; `test:compile` 468 with the same six
pre-existing failures and **zero added**; `test:law-registry` **21 UNENFORCED,
unchanged**.

Four laws entered guarded and mutation-proven:
`LAW-temporary-equipment-never-permanent`,
`LAW-away-removes-the-club-not-the-athlete`,
`LAW-every-authored-requirement-is-askable`,
`LAW-a-projection-may-not-delete-authored-work`.

## THE ONE THING TO KNOW BEFORE MERGING

1. **An athlete away with NO equipment at all still gets no week**
   (`main_strength_planner_selected_target` 4 vs 3). That is R-090's parked
   territory and the fence forbids weakening §18 to reach it.

Nothing has been seen on glass.
