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
