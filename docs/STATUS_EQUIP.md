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

## FINDING 1 — A FUTURE-DATED AWAY ANSWER BECOMES NO CONSTRAINT AT ALL

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

## NEXT — THE REMAINING BUILD ORDER

1. ~~ONE EQUIPMENT OWNER, RESOLVED PER DAY.~~ **DONE — slice 1.**
2. ~~THE RECORD IS THE PERMANENT ANSWER.~~ **DONE — slice 1.**
3. **DELETE THE LEGACY TRAVEL/EQUIPMENT AUTHORITY** in the in-generation pass
   (findings 4 and 5); the composer already owns both questions. **This is the
   `BURN THE BOATS` target and it is the biggest remaining piece:** travel alone
   still refuses the week and still deletes six of the athlete's own lifts.
4. **SANDBAG** — Sam's sheet joins the vocabulary derivation (finding 6).

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
