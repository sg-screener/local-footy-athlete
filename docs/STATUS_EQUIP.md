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

## NEXT — THE BUILD ORDER

1. **ONE EQUIPMENT OWNER, RESOLVED PER DAY.** `composeWeek` takes a kit *per
   planned day*, not one per week, so a mid-week span is representable at all.
   The permanent profile stays the base; dated removals subtract only on the days
   they cover.
2. **THE RECORD IS THE PERMANENT ANSWER.** `baseLegal` is decided against the
   PERMANENT kit minus permanent-only changes; the dated removal moves to the
   day-scoped set, which makes `substitutedFor` fire for the first time and gives
   the mission's base/substitute split a live path.
3. **DELETE THE LEGACY TRAVEL/EQUIPMENT AUTHORITY** in the in-generation pass;
   the composer already owns both questions.
4. **SANDBAG** — the sheet joins the vocabulary derivation.

## NOT COVERED YET

- Session-scope (`applySessionEquipment`) not yet driven in the trace.
- Injury + away combination not yet run.
- Nothing has been seen on glass.
- The two `test:composer-b1` reds and the `test:edge-generation-equipment` red on
  base are recorded, not diagnosed.
