# The deload-shape unit — differential prediction, BEFORE the code

§P discipline. Written and committed before any implementation, so the harness
can contradict it.

---

## 1. The diagnosis, measured

Sam's law: **"Same week, same days; the structure doesn't change, the load
does."**

Block 2 of a 5-day off-season athlete (phase entry 2026-07-06), weeks 1–3 of
the block are **byte-identical in structure**. Only week 4 — the deload — is
different. So this is not week-to-week rotation; the deload week is genuinely
planned differently.

| day | build week (phase wk 7) | deload week (phase wk 8), BEFORE |
|---|---|---|
| 1 | Upper Push, Mixed — Landmine Press 3 | Upper Push, Mixed — Landmine Press **2** |
| 2 | Lower Body Strength, Mixed — Front Squat 3, Trap Bar Deadlift 3 | **Lower Hinge, Strength** — Romanian Deadlift 3 |
| 3 | Long Aerobic Intervals | Long Aerobic Intervals |
| 4 | Upper Pull, Mixed — Chin-Ups 3, Chest Supported Row 3 | **Lower Squat, Strength** — Back Squat 3 |
| 5 | Lower Squat, Strength — Front Squat 3 | **Upper Pull, Strength** — Chin-Ups 2, Chest Supported Row 3 |

Pull moves day 4 → day 5. Squat moves day 5 → day 4. The single combined lower
session (squat + hinge) SPLITS into two. Three of five days stop carrying
conditioning at all.

### The root — two owners of one reduction

`weeklyExposureContractBuilders.ts` cuts the conditioning **exposure COUNT** on
a deload week (`appConditioningAfterDeload`, ~4 → 2). `DELOAD_LAW` in
`deloadWeekRules.ts` separately halves the conditioning **WORK** on the rows it
already owns ("one quality exposure max, the rest easy aerobic").

**Two representations of "how much less conditioning on a deload week."** The
count cut is the one that reshapes the week: with two fewer conditioning
exposures, days that were combined become strength-only, and the allocator lays
the strength sessions out differently as a side effect. That side effect is
recorded NOWHERE — the reduction ledger records the conditioning count, not the
strength reshuffle it causes.

This is the same shape the file already fixed once, for power: three deload
doors were removing power while the law said keep it, and the fix was to let
the dose layer own it alone.

### Experiment already run (reverted)

Removing the count cut and regenerating: **week 4 becomes structurally
identical to weeks 1–3** — same days, same session names, same exercises, same
combined/standalone split — with sets 3 → 2 throughout. Sam's sentence, exactly.

### A SECOND, INDEPENDENT DEFECT found on the way — and a correction to my own

The unit-7 declared gap claimed day 2 "loses its anchor lift entirely". **That
claim is FALSE.** The session carries Romanian Deadlift 3×6-10, a main hinge
lift. The claim came from the suite's `mainRows()` helper asking
`classifyPoolSlot('Romanian Deadlift')`, which returns **NULL** — the pool
registry spells it `RDLs` — while `classifyGeneratedWorkoutRow` correctly calls
the same row `strength_main / hinge`.

**Two owners of "is this row an anchor", disagreeing by name spelling.** That is
the repo's standing class, and it made my own declared gap overstate its
finding. Recorded here rather than quietly dropped.

## 2. What the code change will be

Delete the conditioning **count** cut from the deload branch. Keep the recorded
`main_strength / session_intensity_percent` reduction. `DELOAD_LAW`'s dose layer
remains the single owner of how much less conditioning a deload week carries.

## 3. PREDICTIONS — what moves

### 3.1 The differential golden: MOVES, in exactly six scenarios

Six scenarios carry a deload week and no others do:

| scenario | deload week |
|---|---|
| `offseason-mid` | week 1 |
| `offseason-late-advanced` | week 3 |
| `preseason-early-solo` | week 4 |
| `preseason-late` | week 2 |
| `preseason-two-team-days` | week 4 |
| `preseason-team-and-game` | week 4 |

**Predicted: every changed line lives inside one of those six weeks.** A
changed line in a BUILD week would be the harness firing and a STOP.

Predicted change within them: conditioning exposures restored to the build
week's count, so sessions that had become strength-only carry their combined
conditioning again, day assignments return to the build week's, and strength
set counts stay at their already-deloaded values.

### 3.2 `test:deload-week`: the three DECLARED GAPS go GREEN, and that must fail

The gap `offseason_block2_deload_week_restructures_the_days` covers the three
`Off-season day N keeps main lift` cells. Once the structure holds, those cells
PASS.

**The declared-gap mechanism's property 2 then fires: a stale declaration
FAILS.** That is predicted, correct, and must be paid IN THE SAME COMMIT by
deleting the declaration. A gap cannot outlive its defect.

Predicted end state: `42 + 3 = 45 passed, 0 declared gap(s), 0 failed`.

### 3.3 Predicted UNCHANGED — reasoned, not hoped

- **`section18PhasePlannerTests`** cross-path cell reads
  `(plannerSelectedTarget === 4 || typedConditioningReduction)`. With no count
  cut, `plannerSelectedTarget` stays 4 and the first disjunct carries it.
- **`preseasonExposureContractTests`** asserts only that SOME `deload_policy`
  reduction exists. The intensity reduction stays, so it does.
- **Power on deload weeks** — untouched; the law already owns it.
- **Deload STRENGTH dose** (halved sets, 1-set floor, load HELD) — untouched;
  a different owner.
- **Deload placement** (weeks 8/12/16…) — untouched. This unit changes shape,
  never placement.
- **In-season** — no scheduled deloads exist there (D16), so nothing moves.

### 3.4 Predicted at risk — named so a red is not a surprise

- `recoveryAddonCoverage` reads `weekKind === 'deload'` for add-on targets; a
  week now carrying more conditioning may shift add-on counts.
- `weeklyDoseOwnership`, `section18SafetyBoundary`, `readinessDoseSweep`,
  `yearRoundExposureConformance` all touch deload contracts.
- The bible slice-1 conformance run generates blocks; if any scenario reaches a
  deload week its component counts move.

**If any of these reds, it is diagnosed to a root before anything is
regenerated — not absorbed into the golden.**

## 4. What is explicitly NOT in this unit

- **The `classifyPoolSlot('Romanian Deadlift')` = NULL defect.** Real, found
  here, and a different owner. It does not block this unit because the shape
  fix is verified on session/day structure, not on that helper. Reported.
- **Deload placement.** Settled by the survey; the week-8 deload stays.
- **The readiness/illness door.** Decided un-gated; untouched.
