# The deload-shape unit — the prediction was FALSIFIED, and the root moved

Companion to `docs/DELOAD_SHAPE_PREDICTION_2026-08-05.md`. **No code shipped.**
The tree carries only the declared gap's corrected text.

---

## What happened

The prediction (§2) proposed deleting the contract's conditioning **count** cut
on deload weeks, on the reasoning that `DELOAD_LAW`'s dose layer already owns
how much less conditioning a deload week carries — two owners of one reduction.

The off-season evidence supported it exactly: with the cut removed, the deload
week became structurally identical to the build weeks, sets 3 → 2. Sam's
sentence.

**Then the harness contradicted it, and the contradiction is decisive.**

## The falsification

`test:section18-planner` was EXIT 0 before the change and EXIT 1 after —
verified by restoring the baseline and re-running, so the attribution is
measured, not assumed:

```
FAIL CROSS_PATH Section 18 final-week rejection
     (planner_selected_target_miss:conditioning:3)
```

It is not a soft red. **Pre-season generation THROWS**
(`Section18WeekAcceptanceError`): the un-cut contract asks the deload week for
4 core conditioning exposures, the allocator places 3, and §18 refuses the
week. An athlete would get no program at all.

## The root, sharpened — and it is NOT where the prediction put it

Measuring the pre-season deload week on the **baseline** (cut in place) is what
turned the diagnosis around:

| day | pre-season build (wk 3) | pre-season deload (wk 4) |
|---|---|---|
| 1 | Upper Push, Mixed | Upper Push, Mixed |
| 2 | Lower Squat, Mixed | Lower Squat, **Strength** |
| 3 | Upper Pull, Mixed | Upper Pull, Mixed |
| 4 | Prehab & Accessories | Prehab & Accessories |
| 5 | Lower Hinge, Mixed | Lower Hinge, **Strength** |

**Pre-season takes the identical count cut and obeys the law.** Same days, same
session names, same composition; only the conditioning attachments drop, which
is the recorded, authorised reduction. Off-season, given the same cut, moves
Upper Pull from day 4 to day 5, moves Lower Squat to day 4, and splits the
combined squat+hinge lower session in two.

So:

- The **count cut is legitimate** and load-bearing. It is what keeps the deload
  contract achievable; deleting it breaks generation outright.
- The defect is in the **off-season allocation path**, which lets the
  conditioning exposure count influence *strength* placement. Pre-season's does
  not, and pre-season is the proof that the law is satisfiable under the cut.

The prediction's "two owners of one reduction" reading was WRONG, and the
mechanism that caught it is exactly the one §P exists for: a written prediction
the harness could contradict.

## A second defect, unchanged and still open

The unit-7 declared gap claimed the deload week's day 2 "loses its anchor lift
entirely". **False** — it carries Romanian Deadlift 3×6-10.
`classifyPoolSlot('Romanian Deadlift')` returns **NULL** (the pool registry
spells it `RDLs`) while `classifyGeneratedWorkoutRow` calls the same row
`strength_main / hinge`. **Two owners of "is this row an anchor", disagreeing by
name spelling.** Separate defect, separate owner, still open.

## State of the tree

- **No product code changed.** `weeklyExposureContractBuilders.ts` is byte-identical
  to its committed version.
- The declared gap `offseason_block2_deload_week_restructures_the_days` **stays
  declared**, with its text corrected: the false anchor claim is retracted in
  place, the measured root is recorded, the failed fix is recorded so nobody
  retries it, and the owner is renamed to the off-season allocation path.
- `test:deload-week` 42 passed, 3 declared gap(s), 0 failed. `test:compile`
  PASS.

## What the next attempt needs

The off-season allocator must hold strength placement invariant to the
conditioning exposure count — the property pre-season already has. That is a
change inside the off-season allocation path, not the contract, and it wants
its own diagnosis of *why* the two phases differ before any code.

**Not attempted here.** Pushing a second guess through the same harness on the
same day is how the fix-by-fix pattern L11 forbids begins.
