# STATUS — seat `variety`

Opened 2026-09-04. Owner of Sam's main-lift variety programme, approved that
morning off the root-cause report in this file's first section.

**Branch:** `integrate/2026-09-04-morning`.
**Nobody else writes this file.**

---

## THE APPROVED PLAN, IN SAM'S ORDER (2026-09-04)

He reordered my proposed order himself. The order below is HIS, verbatim in
intent, and the slices are worked in it:

1. **Fix the role-label source of truth.** ← SLICE 1, this file's first entry
2. **Grade eligible mains A/B/none.**
3. **Build the two-or-three-at-a-time rotation rule.**
4. **Then unglue the four tracked lifts.**
5. **Add Bulgarian split squat separately.**
6. **Weight tracking last.**

**Why HIS order is better than mine and it is worth writing down.** I proposed
ungluing the four lifts second. He moved it to fourth, behind grading and the
stagger. That is correct and I had it wrong: ungluing first would have put all
six main seats into rotation with no grade filter and no stagger, so every seat
would have rotated on the same block boundary and could have promoted
`Glute Bridge` or `Incline Push-Up` into a main seat. **The pins are load-bearing
scaffolding until the things that replace them exist.**

### His three ruling answers, same conversation

- **Unglue the four tracked lifts — YES.**
- **RDLs rotate in-season — YES, but only at block boundaries.** (Rotation is
  already block-boundary-only, so this is a constraint on the implementation,
  not a new cadence: whatever replaces `phasePinsSlot` may not move a lift
  mid-block.)
- **Bulgarian split squat as a real squat main — YES, but separately, later.**
- **On weight tracking, deferring it is safe because:** *"it doesn't matter if a
  lift isn't tracked for 4 weeks, it will just update the next time it is."*

---

## SLICE 1 — THE MAIN-LIFT BADGE IS THE COMPOSER'S DECISION

### The defect, measured before any change

Driver: `scripts/run-programming-selection-trace-year.cjs`, full 52 weeks, male
athlete, 13,335 typed selection traces.

| measurement | value |
| --- | --- |
| `lower_squat` days shipping **no `main_lift` row at all** | **14 of 14** |
| squat main-seat decisions the composer actually made | **406 of 406** (`Leg Press`) |
| reason recorded for those decisions | `single_legal_candidate` |

The composer chose a main lift for the squat seat every single week. The athlete
never saw one.

### Root cause

`utils/sessionRoles.ts` `classifyExerciseRole` answered from **which array the
name sits in** — `STRENGTH_POOLS[slot].anchor.entries` vs `.accessory.entries`:

```ts
const slot = classifyPoolSlot(canonical);
if (slot?.role === 'anchor') return 'main_lift';
```

That is a property of the EXERCISE. The badge is a property of the SEAT IT
FILLED. `Leg Press` lives on the accessory bench and filled the squat main seat,
so the glass called it accessory work.

**R-092 had already settled the ownership** — *"the composer DECIDES the role;
§18 reads this rather than re-inferring it from the exercise name"* — and both
row producers have been writing `section18Evidence.role` all along:

- `rules/materialiseComposedWeek.ts:141` for composed days;
- `data/defaultProgram.ts:2388` (`ex.composedRole`) for the retained adapter.

**Nothing was missing. The screen was simply a second authority and it won**,
because `utils/sessionTemplate.ts` fell straight from `row?.role` to the name
classifier and never looked at the evidence sitting on the row.

### The change

One resolver, `sessionRoleForRow(row, rawName)` in `utils/sessionRoles.ts`:

- `section18Evidence.role === 'main_strength'` → `main_lift`;
- `=== 'strength_accessory'` → the name classifier, but its `main_lift` answer
  is suppressed (this closes the INVERSE leak: an anchor name such as
  `Barbell Row` sitting in a second-pull supporting seat no longer wears the
  main-lift badge);
- no evidence → the name classifier, unchanged.

Two readers now call it:

- `utils/sessionTemplate.ts` — the one owner every screen builds its list from,
  and the one the preserved year driver reads (`item.role`), so the app and the
  annual evidence move together.
- `rules/mainLiftPatternLaw.ts` `isMainLift` — R-070's *"one main per pattern"*
  reader. Left on the bare name classifier it would have disagreed with the
  glass: blind to a real second main off the accessory bench, and able to flag a
  supporting `Barbell Row` that is not one.

**`classifyExerciseRole` is NOT deleted and that is deliberate.** Athlete
additions and legacy stored weeks carry no evidence; for them the pool lookup is
still the honest answer. What it may no longer do is overrule a decided row.

### The precedent this follows rather than invents

`rules/deloadWeekRules.ts:387-401` already reads `section18Evidence.role` first
and falls back to the pool registry — same fact, same precedence, ruled earlier
for the same reason (two readers of one row disagreeing). Slice 1 makes the
screen agree with a rule the app already had.

**KNOWN DUPLICATION, NOT PAID OFF HERE.** `deloadWeekRules` keeps its own inline
copy of that precedence because its fallback resolves aliases with
`resolveExerciseName` rather than `canonicalExerciseName`, and its own comment
records the defect that alias handling was written to fix. Folding it into the
shared resolver is a second behaviour change and does not belong in this slice.
**Next convergence, named here so it is not lost.**

### Guard

`test:visible-surfaces` section **[12]**, both directions, driving the real
materialiser and the real session-template owner:

- a main lift off the accessory bench badges Main Lift;
- an anchor name in a supporting seat does NOT;
- the squat day the athlete opens carries a visible main lift.

Born RED on both directional cells, for the stated reasons, before the fix.

### Gates

| gate | before (HEAD control) | after |
| --- | --- | --- |
| `test:compile` | 0 errors | **0 errors** |
| `test:visible-surfaces` | 69 passed / 1 failed | **76 passed / 1 failed** |
| `test:main-lift-pattern` | — | **23/23** |
| `test:slot-coverage` | — | **92/92** |
| `test:row-counting` | — | **45/45** |
| `test:session-template` | 87 / **1** | 87 / **1** (same cell) |
| `test:role-buckets` | 53 / **1** | 53 / **1** (same cell) |

**PRE-EXISTING REDS ON THIS BRANCH, CONTROLLED AT HEAD AND NOT MINE.** Each was
re-run with all four of my files restored to `HEAD` and failed identically:

- `test:visible-surfaces` — *"Pigeon Stretch: bodyweight row keeps its cue when
  the required bench exists"*
- `test:session-template` — *"the numeric index is back in the row header"*
- `test:role-buckets` — *"screen title is Sam's approved position copy"*
- `test:session-execution-checklist` — five cells refusing with *"Fixture
  mutation requires an accepted profile and program"*

**The control was taken by backing my four files up to scratchpad and
`git checkout HEAD -- <the four paths>`, never `git stash`** — this is a shared
checkout and a whole-tree write would have taken another seat's work with it.

---

### Slice 1 status word

**WORKING** — the composer's main-lift decision reaches the athlete's session
list, and an anchor-named supporting row no longer claims the badge. Breaks
`test:visible-surfaces` [12] if it regresses.

---

## SLICE 5 (TAKEN OUT OF ORDER) — B-STANCE RDL

Sam sent the signed intake mid-slice, 2026-09-04, with *"add this into the
exercise list as well - so we have another single leg hip dominant lift"*. Taken
now rather than at its planned position because it is pure content addition: it
touches no selector, no cadence and no rotation rule, so it cannot interfere
with slices 2-4, and the group it widens is the one the pool file has been
complaining about in writing since 2026-08-13.

Intake: `docs/EXERCISE_INTAKE_B_STANCE_RDL_2026-09-04.md`. Ruling: **R-368**.
Law: `LAW-b-stance-rdl-intake`. Guard: `test:b-stance-rdl`, **18/18**, chained
into `test:exercise-intake`.

### What was touched, and why each one

| file | why |
| --- | --- |
| `data/exercisePoolsStrength.ts` | the row itself — hinge accessory, `single_leg_hip`, `loaded_lower_secondary_compound` |
| `data/exerciseTags.ts` | demand + all thirteen injury ratings |
| `data/exerciseCues.ts` | Sam's two cue lines verbatim |
| `data/exerciseEquipmentRequirement.ts` | `[['dumbbells', 'barbell']]` |
| `data/exerciseMovementPlaneMetadata.ts` | sagittal, frontal + transverse behind |
| `data/muscleExperienceMetadata.ts` | muscles, pool, experience gate, note |
| `rules/exerciseVariationFamily.ts` | `romanian_deadlift` — R-233 covers it on arrival |
| `utils/loadEstimation.ts` | the identical load profile row + three aliases |
| `services/exerciseVideoService.ts` | the intake video + aliases |
| `docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx` | the signed workbook the equality suites read |

### The workbook edit, receipted

`openpyxl`, inserted at the **Lower hinge** position immediately after
Single-Leg RDL — **never appended**. Verified by diffing every cell of every
data row against a pre-edit copy: **218 -> 219 data rows, and 0 rows differing
apart from the insert.** A CHANGE LOG line was added to the sheet's own log
cell, which is that file's existing convention. Pre-edit copy kept in scratchpad
for the life of the branch.

### The one cell that had to change, and why it is not a loosening

`rdlFamilyPairingTests` asserted *"Single-Leg RDL still lives where it owns the
day (In-season 3-day)"*. It went red — because the seat now legitimately
**rotates** to B-Stance RDL (least-recently-used: a never-used option is the
most eligible). **The property that cell protects is that the guard does not
ERASE the single-leg hip seat, and that property held perfectly.** Naming the
identity was an accident of scarcity: with one loaded option in the group, "the
seat survived" and "Single-Leg RDL survived" were the same sentence.

The cell now asks for the SEAT, and carries a **non-vacuity that reds if the
loaded group ever falls back to one option** — so a future change cannot pass it
by making the question easier.

### Gates

| gate | before | after |
| --- | --- | --- |
| `test:compile` | 0 errors | **0 errors** |
| `test:b-stance-rdl` | (new) | **18/18** |
| `test:muscle-experience` | 97/97 | **97/97** (sheet 216 -> 217, everyone 146 -> 147) |
| `test:movement-planes` | 13/13 | **13/13** (mirror updated) |
| `test:authored-cues` | 56/56 | **56/56** |
| `test:rdl-family` | 7 / **1** | 7 / **1** (same pre-existing cell) |
| `test:locked-list` | 32 / **1** | 32 / **1** (same cell) |
| `test:pools` | 487 / **5** | 487 / **5** (same five) |
| `test:law-registry` | 13 / **1** | 13 / **1** (21 unenforced laws, none of them this one) |

All controlled at `HEAD` by backing the nine files up to scratchpad and
`git checkout HEAD -- <the nine paths>`, never `git stash`.

### NOT MINE, FOUND IN PASSING — one line, another seat's

`test:pools` fails `isolation_lower/accessory has 7 entries (got 8)`. The pool
genuinely holds eight: `T-Bar Tib Raises` was added on 2026-09-02 and the
count assertion in `exercisePoolsStrengthTests.ts:598` was never bumped. **It is
red on `HEAD` with none of my files present.** Left alone deliberately — fixing
another seat's stale count inside this commit would make the attribution a lie.
The other four `test:pools` reds are the squat-rotation cells, also pre-existing,
and they are what slice 4 is about.

### NOT COVERED — RAISED WITH SAM, NOT DECIDED HERE

**Per-side dosing does not render, for the whole class.** Sam's sheet says
B-Stance RDL's repetitions are per side. Measured on the preserved 52-week
driver, `Single-Leg RDL`, `Walking Lunges` and `Bulgarian Split Squats` ALL ship
as plain `3 × 8` with no `/ side`, while `Half Copenhagen` and `Bosch Hold` ship
`3 × 30s / side` correctly. The reason: `perSide` is only ever read off an
authored prehab/carry pool entry (`composedDose.ts`) and is never derived from
`unilateral: true`, which is the field that already knows.

Fixing it for B-Stance alone would be the name-special-case
`.claude/rules/coach-and-plan-edits.md` forbids. Fixing the class changes what
three shipping lifts prescribe — 8 per side is not 8 — which is a dose change
and Sam's call. **B-Stance ships matching Single-Leg RDL exactly until he
rules.**

---

## STATUS WORDS — WHOLE SEAT

- **WORKING** — slice 1: the composer's main-lift decision reaches the athlete's
  session list. Held by `test:visible-surfaces` [12].
- **WORKING** — slice 5: B-Stance RDL ships as a second loaded single-leg hip
  option. Held by `test:b-stance-rdl` (18/18), chained into
  `test:exercise-intake`.
- **NOT YET STARTED** — slice 2 (grade eligible mains A/B/none), slice 3 (the
  two-or-three-at-a-time rotation rule), slice 4 (unglue the four tracked
  lifts), Bulgarian split squat, weight tracking.

### OPEN WITH SAM

1. **Per-side dosing for loaded unilateral lower lifts.** See slice 5's NOT
   COVERED. Changes what three shipping lifts prescribe, so it is his call.
2. **`isolation_lower/accessory has 7 entries (got 8)`** — another seat's stale
   count from the T-Bar Tib Raises intake, red on `HEAD`, blocking `test:pools`.

---

## THE RELEASE GATE — CONTROLLED AT BOTH ENDS, 2026-09-04

**`npm run test:release` is RED on this branch and it was red before this seat
existed.** Proven, not asserted: the gate was run twice, on two trees, to
completion.

| | baseline `cf1e5118` (before slice 1) | current (slices 1 + 5 committed) |
| --- | --- | --- |
| athlete-weeks | **416 green / 416 reached / 416 required** | **416 green / 416 reached / 416 required** |
| distinct failure keys | 1 | 1 |
| the key | `canonical_only` | `canonical_only` |
| unresolved candidate owners | **1 / 1170** | **1 / 1170** |
| units | **11/31 green** | **11/31 green** |
| verdict | `RELEASE_GATE_EXIT=1` | `RELEASE_GATE_EXIT=1` |

**Identical at every line.** The baseline was taken in an ISOLATED
`git worktree` at `/private/tmp/lfa-variety-baseline`, detached at `cf1e5118`,
with `node_modules` symlinked — never by reverting the shared checkout, which
would have taken another seat's work with it.

**WHAT IS ACTUALLY BLOCKING IT IS NOT THE PROGRAMME.** Every one of the 416
athlete-weeks is green on both sides. The gate stops on the executable-ownership
census: **one unresolved candidate owner out of 1,170**, with 0 rival functions
and 0 derived publishers. That is the writer-census tail, not a defect in a
generated week.

**AND THE NEW CODE DID NOT ADD TO IT.** `sessionRoleForRow` is a new exported
function and the census counts function owners, so this was checked directly
rather than assumed: `scanSources` reports `1 / 1170` on the current tree,
**the same numerator AND the same denominator** as the baseline report.

⚠ **THE FIRST RUN OF THIS GATE WAS DISCARDED AND THE REASON IS WORTH KEEPING.**
It was started before the B-Stance edits and finished after them, so it read a
tree that changed underneath it — a control that did not see one tree, and
therefore no control at all. It reported the same 11/31, which is exactly what
made it tempting to keep. Both runs above were started against a quiet tree and
nothing was edited while either ran.

---

## R-369 — A ONE-SIDED LIFT SAYS "/ SIDE" (Sam: *"1 yes"*, 2026-09-04)

Raised as slice 5's NOT COVERED; he answered yes, then yes again to applying it
to all twenty rather than the four he first named.

### Measured, both athletes, before and after

| | male | female |
| --- | --- | --- |
| one-sided rows in the year | 432 | 453 |
| saying `/ side` BEFORE | 232 | 251 |
| **wrong BEFORE** | **200** | **202** |
| **wrong AFTER** | **0** | **0** |
| total rows | 1710 → 1710 | 1711 → 1711 |

### Six sites, one owner

`data/exerciseTags.resolvePerSide(name, authored?)`. Five row builders answered
"does this count one side" from five places, each right about its own rows and
blind outside them:

| builder | what it read before |
| --- | --- |
| `rules/composedDose` band categories | nothing — no authored field exists there |
| `utils/sessionBuilder` power rows | only the tag's `prescription` |
| `utils/sessionBuilder` pool rows | only the pool entry |
| `data/defaultProgram.buildPowerRow` | only the tag's `prescription` |
| `utils/addExerciseCandidates` | **`unilateral` — the only one already right** |

That last row is the whole diagnosis: the manual **Add** door got this right and
automatic programming did not, because only one of the five ever asked the field
that already knew.

### ⚠ THE SIXTH SITE, AND WHY THE PROCESS FOUND IT WHEN A UNIT TEST WOULD NOT

**Fixing the dose resolver returned a BYTE-IDENTICAL year.** 182 rows still
wrong, same count, same names.

`screens/home/dayWorkoutHelpers.formatStrengthSetsReps` — the strength card's
own renderer — never read `perSide` for REP rows. It delegated per-side only to
the timed formatter. So what the athlete saw turned on the **unit**, not the
movement: `Half Copenhagen` (seconds) said `/ side`, `Single-Leg RDL` (reps) did
not. **A unit test of the thing I changed would have passed and shipped
nothing.** Only re-running the year and reading the athlete's own string caught
it — `measure-what-the-athlete-reads-not-the-sheets`, paid again.

Then the year re-run after THAT still left 27 rows: the Gunshow arm seats and
two power lifts, which is how the fourth and fifth builders were found. **Three
year re-runs, each one narrowing the number: 182 → 27 → 9 → 0.**

### Surfaced, not caused — reported to Sam

`Dead Bug`, `Weighted Dead Bug` and `Banded Dead Bug` carry an authored
`perSide: true` on their pool entries while being tagged `unilateral: false`.
They were ALWAYS authored per side and the card was hiding it. **The tag and the
pool entry disagree for those three.** Not silently changed.

### The ownership census — 1/1170 unresolved to ZERO

Sam approved chasing it. What it was: `DayWorkoutScreenV2#MobilityExerciseList`,
reviewed and cleared as `projection_display`, then edited by `b1bdd403` ("add
ranked per-exercise quick actions") so its fingerprint no longer matched. **A
stale review, not a defect.** Re-read in full before re-signing: it still builds
one in-memory display row with `prescribedWeightKg` explicitly null and passes
the two new controls straight through to the existing handlers — which is the
delegation its recorded reason already described.

⚠ **AND MY OWN EDITS THEN INVALIDATED THREE MORE**, which is the mechanism
working exactly as designed: `buildPowerRow`, `poolExerciseToWorkoutExercise`
and `powerEntryToWorkoutExercise` all went `changed` the moment their `perSide`
line started calling the shared owner. All three re-signed with what changed;
all three stay `canonical_compiler`.

**`scanSources` now reports `ok: true`, 0 unresolved of 1170, 0 errors** — the
first time this branch has had a clean executable-ownership census. Whether that
lets `test:release` past `canonical_only` and onto the 20 units it has never
reached is the next thing to find out, and it is not claimed here.

### Gates

| gate | before | after |
| --- | --- | --- |
| `test:compile` | 0 errors | **0 errors** |
| `test:visible-surfaces` | 76 / 1 | **84 / 1** (section [13], 8 cells) |
| `test:composer-severance` | 7 pre-existing reds | **7** (+4 `[per-side]` cells green) |
| `test:pools` | 487 / 5 | **488 / 4** (the 7→8 count, its own commit) |
| `test:mobility-flow` | — | **64/0** |
| `test:power-pool` / `power-counting` / `primer-session` | — | **104/0, 12/0, 25/0** |
| `test:session-section-add` | — | **250/0** |
| `test:row-counting` | — | **45/45** |
| `test:b-stance-rdl` | 18/18 | **18/18** |
| writer census | 1/1170 unresolved | **0/1170, `ok: true`** |

---

## THE REST OF SAM'S LIST — R-371 to R-375, 2026-09-04

His order, worked in it. Slices 1 and 5 are above; this is everything after.

| ruling | what | measured |
| --- | --- | --- |
| **R-371** | a squat rack carries a chin-up bar; pulldowns are cables | a home gym with a rack had **ZERO** legal vertical pulls |
| **R-372** | Barbell Row → **Bent Row**, barbell OR dumbbells | ~40 files; history follows via a legacy alias |
| **R-373** | grade A/B/none + the seat routing, together | distinct main lifts **16 → 20**, ungraded-as-main **1 → 0** |
| **R-374** | two-or-three-per-block stagger; the four pins come off | distinct main lifts **→ 32**, most-repeated **52/52 → 39/52** |
| **R-375** | the load an athlete reads is the TOTAL | DB Bench 30 → 60; single-arm and Goblet unchanged |

### THE DAY'S HEADLINE, BOTH ATHLETES

| | this morning | tonight |
| --- | --- | --- |
| distinct main lifts across a year | **16** | **32** |
| most-repeated lift | **52 of 52 weeks** | **39 of 52** |
| ungraded lift leading a day | 1 | **0** |
| squat seat | `Leg Press` ×51 | five lifts rotating |

`Leg Press` ×51 was never a rotation defect: the trace's own reason was
`single_legal_candidate`, with Back/Front/Box/High Box rejected `equipment` (no
rack) and Goblet/Bodyweight rejected `experience`. **One legal squat existed.**
The five that replaced it were legal all along and unreachable, because a
unilateral lift only ever filled its single-leg slot.

### ⚠ WHAT ACTUALLY WENT WRONG TODAY — five, and every one is a class

1. **A fix at the resolver that never reached the renderer.** Per-side was
   resolved onto the row and the strength card never read the field for REP rows.
   The year came back **byte-identical**. A unit test of the thing I changed
   would have passed and shipped nothing.
2. **Ordering is not precedence.** `anchorCandidates` returned A, B, then
   ungraded; "last" was assumed to mean "lowest". The selector picks LEAST
   RECENTLY USED, and a never-given lift has infinite age — `Kettlebell Swings`
   led three hinge days.
3. **A preference applied before legality empties the seat.** Filtering to graded
   inside `anchorCandidates` asked *"does this pool contain graded lifts"* when
   the question is *"can THIS athlete do any"*. The week was REFUSED:
   `main_strength_required_minimum: expected 3, actual 2`.
4. **A rule that lived only in a comment was lost when the code moved.** The
   tracked-lift BYPASS ignored the current-block record — its comment said why.
   As a pin the record went back in front of it, and a supporting row's record
   was inherited by the main seat.
5. **A signed workbook missed twice.** `LOAD_RATIO_REVIEW` is a THIRD workbook
   beside the master sheet and the injury matrix. Neither R-368 nor R-372 touched
   it; R-375 found it.

**FOUR OF THE FIVE WERE FOUND BY RUNNING A YEAR AND READING WHAT AN ATHLETE
RECEIVES. None was found by a suite.** Every one passed the unit tests.

### AND TWO THINGS I GOT WRONG IN THE REPORTING

- **"Overhead Press got ZERO times in a full year"** — it was zero in ONE BLOCK.
  The suite that measured it compiles four weeks. A failing delivery count was
  read as an annual figure and written into R-374; corrected the same day in
  `6c9c9220`, before anyone relied on it.
- **I proposed fixing a "shared drawer" collision before measuring it.** It
  happens **once in thirteen blocks** and that one is benign. Sam's call: leave
  it. The measurement was cheap and should have come first.

### OPEN

- Five implement counts are my judgement, confirmed by Sam rather than authored
  by him: `Overhead Carry` (2); `Weighted Dead Bug`, `Tricep Circuit (Dirty 30)`,
  `Back Extension`, `Bear Carry` (1).
- Two `Accessories` sessions per athlete-year became rest under R-373. Sam:
  **leave**.
- `Leg Press` now appears once a year. Sam: *"i dont care that leg press isn't in
  there"*. Not chased.

---

## HANDOFF — read this and nothing else

**Branch `integrate/2026-09-04-morning`. Everything below is committed and green.**
R-367 to R-377: main-lift badge, B-Stance RDL, per-side, Dead Bug, rack implies
pull-up bar, pulldowns on cables, Bent Row, A/B grading + seat routing, the
two-or-three stagger, the four tracked lifts unglued, total load, and the
prohibited-pattern sweep. `test:compiler-year` is **416/416**.

**ONE THING IS OPEN AND IT IS NOT FROM TODAY.** `test:injury-authority` fails 6.
Four are one problem: **the scheduler has no injury input at all**, so two days
before a game it swaps the day to UPPER work for an athlete whose upper is
injured. Sam's ruling, verbatim: *"it can become whatever can fit that makes
sense that week — if nothing fits and they can't press then it's nothing … but
don't just pack junk in to fill it up."* The fix is threading the prohibited
patterns into `weeklyScheduler`; scope it before touching it. The other 2 are a
crash in the suite, not the app.

### HOW TO CHECK YOUR WORK — this is what actually caught things

1. **`npm run year:diff`.** Generates a year and prints what changed for the
   athlete. **Eight of today's fifteen defects were found this way and ZERO by
   the unit suites covering the changed code.**
2. **"Nothing changed" is a finding.** One fix today came back byte-identical —
   it had reached nothing. A green test cannot tell you that.
3. **Never edit a file while a run is reading it.** Three runs were binned today
   for exactly this.
4. **Control every red at HEAD before calling it pre-existing.** Back the files
   up to scratchpad and `git checkout HEAD -- <paths>`; never `git stash`.
5. **Read the pass count, not the exit code.** `test:release` prints
   `RELEASE_GATE_EXIT` and a pipe will mask it.
6. **`test:release` stops at the first red unit** — it shows one problem at a
   time. Three separate runs today, each revealing the next.
7. **There are THREE signed workbooks.** Master sheet, injury matrix, load
   ratios. A content change usually needs two or three. One was missed twice.

### THE SHAPE ALMOST EVERY DEFECT TOOK

**One fact with several owners, and the copies drifting.** The main-lift badge
had two. Per-side had five. The tracked-lift rule lived in three. Ordering was
mistaken for precedence; a preference was applied before legality; a rule that
existed only in a comment was lost when the code moved. **Before adding a
reader, find out who already owns the answer.**

## R-378 — THE SCHEDULER NOW KNOWS THE ATHLETE IS HURT (2026-09-04, seat variety)

**THE JOB AS HANDED OVER WAS THE WRONG JOB, AND THE REGISTRY SAID SO.** The
handoff asked for the G-2 day to be FILLED with the authored quality-lower (High
Box Squat 2x3 + Vertical Jump 2x3). **Sam cancelled that session on 2026-08-16
in R-095** — a Vertical Jump is plyometric and G-2 bars added lower-body power —
and R-095's own entry records that its omit-and-disclose guard never landed and
that `injuryAuthorityOwnershipTests` G2-G4 "still assert the old exception". Put
to Sam, he chose A and added one exception (R-378).

### THE DEFECT

`WeeklySchedulerInputs` had **no injury field at all**. The reduction ladder's
rung 1 offers `upper` wherever a constrained day may not hold heavy lower, so a
Saturday-game athlete with a paused shoulder was handed **Bench Press and Seated
DB Press two days before the game**. The ladder was doing exactly what it was
written to do; nothing had ever told it the substitute was unavailable.

### WHAT LANDED

- **One owner, two consumers.** `compileCanonicalWeek` derives
  `prohibitedPatterns` for the scheduler from the `injury` state it ALREADY
  receives, beside `appSprintPermitted` / `appRunningPermitted`. Not at the call
  sites: `WeeklySchedulerInputs` has **two** builders and a fact each must
  remember is a fact one will forget.
- **SUBSTITUTE, THEN DROP.** An impossible session is first swapped for a safe
  purpose that is still legal in place — same day, same count. Only when nothing
  fits is the day left empty. That is Sam's sentence in order: *"whatever can fit
  that makes sense … if nothing fits … then it's nothing"*.
- **APPLIED AFTER THE LADDER, NEVER INSIDE IT.** ⚠ The first version made a
  prohibited purpose illegal DURING the search. It fixed the G-2 day and then did
  something worse: a candidate ruled out mid-search sends the ladder down a rung,
  and a reduced rung is the authored SMALLER STRUCTURE — three split days become
  two FULL-BODY days. **Measured: a shoulder injury took one day from 12 sets to
  20 and gave another 12 where it had none.** An injury that ADDS work is the
  opposite of the ruling. `WC-064` is now `enforcedElsewhere`.
- **An empty `activeConstraints` array is TRUTHY**, and the row compiler's
  `args.activeConstraints ? rebuild : args.generationConstraints` therefore built
  a context from ZERO constraints and discarded the resolved one. The injury
  reached generation and arrived as no prohibition at all.
- **A conditioning session vouched for its own conditioning.**
  `hasVisibleConditioningContent` counts `isConditioningTypedWorkout` as content,
  so a day named "Aerobic Conditioning" holding Single-Arm DB Row, Dead Bug and
  Side Plank was never repaired. The new branch asks the ROWS, never the type.
- **Two duplicate purpose-to-pattern tables** (`schedulerPlannedDays`,
  `scheduleToCoachingPlan`) folded into `MAIN_PATTERNS_FOR_PURPOSE`. Both were
  written before R-087 widened `MainStrengthPattern` and neither was swept — the
  stale comment claimed the single-leg slots "cannot be named".
- **Two unguarded `.join`s on `injury.triggers`** crash generation on a
  constraint missing that field. Guarded; the malformed test payloads that
  exposed them (`as never` hid a missing required field) were fixed too.

### RECEIPTS

| gate | before | after |
| --- | --- | --- |
| `test:injury-authority` | 19 passed / 6 failed | **25 / 0** |
| `test:injury-recomposition` | 186 green | **186 green** |
| `test:compiler-year` | 416/416 | **416/416, 0 failure keys** |
| `test:compile` | 0 errors | **0 errors** |
| writer census | 0 unresolved | **0 unresolved / 1170** |
| `year:diff` | baseline | **one conditioning quality swapped, total rows UNCHANGED** |

**`test:release` still stops on 4 PRE-EXISTING failures** — `unilateral/{male,
female}/{no-rack,no-barbell}: required bilateral squat coverage stays honestly
bilateral`. **Controlled at HEAD in an isolated worktree: 10616 passed, 4 failed,
the same four.** Not this work's.

### WHAT IS STILL OWED

**THE DISCLOSURE HALF OF R-095.** The athlete is owed a reason their Thursday is
empty. `injury_game_proximity` exists in `types/domain` and in one test
assertion and **nowhere else in product code** — a note kind with no writer — and
its signed sentence (*"a short, sharp lower session instead of a full one"*)
describes the session R-095 cancelled. The scheduler now records a typed
omission disclosure; **the athlete-facing sentence is Sam's to write.** G7 pins
meanwhile that the CANCELLED sentence must never ship.

**THE YEAR IS PARTLY BLIND HERE.** Its shoulder episode is 4/10, which prohibits
`push` only, so the severe both-patterns case that prompted all this never occurs
in `year:diff`. The severe case is held by `test:injury-authority`.

## R-379 FOLLOW-UP — THE SHOWCASE SEED, AND THE WALL IT FOUND (2026-09-05)

Sam: *"give me a way to see it"*. `empty-day-reason-showcase` is that seed.

**IT DOES EMPTY DAYS, AND THAT ALONE WAS NEW.** Four gym days, ZERO club nights,
and both regions in the pause band. Measured on device: Tuesday and Thursday come
back as **Rest Day**. No other seed reaches that state, and neither does the
Injured door on the standard athlete: a severe shoulder alone empties NOTHING
(the scheduler substitutes), and a second severe injury only took a Tuesday down
to `Team Training`.

**AND IT DOES NOT SHOW THE REASON LINE, WHICH IS THE FINDING.**

The carry is proven on both sides of the gap:

- `buildDevE2ESeed('empty-day-reason-showcase')` produces a stored week whose
  `restDayReasonByDay` is `{4: 'injury'}`.
- feeding that week to `buildProgramTabProjectedWeek` gives day 4 its
  `restReason`, so the card would render the sentence.

**What breaks it is between those two, and it is already a known open item.**
`DevE2ESeedCoordinator`'s own ordering note records that *"an injury that severe
REBUILDS the program"*, and the injury path **validates the existing base rather
than re-authoring it** — the quarantined `I6` in `injuryAuthorityOwnershipTests`.
So the days are emptied by the ROW filters, and the scheduler, the only owner
that can say WHY a day is empty, never re-plans them.

**THE OWNER IS I6, NOT THIS SEED AND NOT R-379.** The reason reaches the athlete
on any week GENERATED with the injury known; it cannot reach a week the injury
door rebuilt, because that rebuild does not re-plan. Sam has been told plainly.

### Also landed here

**The dev-harness injury seed could only express ONE lower-body moderate
injury.** `region`, `severityBand`, `adjustmentLevel` and `triggers` were
hard-coded in two places, and `devE2ESeedTestSupport` modelled only the FIRST
episode with `.find` — the same "not just the first" lesson its own feedback
comment already recorded. All four are now optional and default to exactly what
was hard-coded, so `injury-case` is byte-identical.

| gate | result |
| --- | --- |
| `test:rest-day-reason` | **19/19** |
| `test:injury-authority` | **26/26** |
| `test:dev-e2e-seeds` | **109/109** |
| `test:compiler-year` | **416/416, 0 failure keys** |
| `test:compile` | **0 errors** |
| writer census | **0 unresolved / 1170** |
