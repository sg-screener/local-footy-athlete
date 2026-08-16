# STATUS — seat `blocktwo-difficult`

Mission: BLOCK TWO — DIFFICULT AND MISSED BLOCKS. Base `6117a9fd` (main).
Branch `feat/block-two-difficult-missed`, isolated worktree.

Own file per CLAUDE.md law 3. `docs/STATUS_BLOCKTWO.md` belongs to the seat that
built the successful-progression path and is not touched here.

## BASELINE, MEASURED AT `6117a9fd` BEFORE ANY EDIT

- `test:block-two-progression` — 37 passed, 0 failed.
- `test:ladder-wide` — **140 worlds built, 40 refused, 0 deficient of 368
  laddered days**, and **one cell already RED at base: `most worlds actually
  built`** (13/14). That red is the parked baseline, not this mission's.

## FOUR MEASUREMENTS THAT SHAPED THE BUILD

**1. A VERY-HARD BLOCK ALREADY COLLAPSES TO ONE SET, AND THAT CONTRADICTS THE
APPROVED CONTRACT.** Generating block 2 for the same athlete against three
histories (identical except the recovery answers) gives, for `Deadlift`:

| history | block 2 |
| --- | --- |
| good / mild | `3 × 4-6 @ 102.5` |
| **very_hard / high** | **`1 × 4-4 @ 100`** |
| very_easy / none | `4 × 4-6 @ 102.5` |

Every strength row behaves the same way — `3 → 1` sets, and the rep range is
pulled down too (`6-10 → 4-8`, `8-12 → 6-10`, `12-15 → 10-13`). The contract
says a very-hard block reduces a FOUR-set main lift to THREE. One set is not
that number, and reps are not on its reduction list at all.

**The load is already held correctly** (100, not 102.5) — clause 1 of path A was
true before this mission.

**2. THE FOUR-SET MAIN LIFT IS REAL AND THE COMPOSER NEVER AUTHORS IT.**
`resolveComposedDose` clamps every main lift to 3 (`min(setsMax, max(setsMin, 3))`).
Four sets appear only when the authoring-time freeze ADDS a set after an easy
block — which is exactly the contract's own progression order. So a four-set main
lift in block 1 is an athlete whose block 0 went easily, and it reaches block 2
through the recorded `StrengthExercisePerformanceLog.prescribedSets`.

**3. NO REACHABLE GENERATED WORLD CONTAINS HARD CONDITIONING.** 48 worlds swept
(3 phases × {3,4} training days × {Poor,Good} conditioning × {Never,Regularly}
sprint × {0,2} team days). Every world that built produced ONLY
`aerobic_base` and `tempo` components — `hard=0` in all of them. The rest
refused (`sprint_high_speed_required_minimum`, `hard_day_permitted_maximum`,
`main_strength_permitted_maximum`, `required_safe_patterns_present:hinge`).

Consequence, stated rather than hidden: the hard-conditioning clauses (A4, A5)
are built and guarded against constructed workout trees carrying hard
conditioning, and wired into the real generation path — but **no generated
fixture can exercise them today**, and making generation emit hard conditioning
is a scheduler change this mission's boundaries forbid.

**4. `soreness` HAS NO `severe`.** The vocabulary is `none | mild | moderate |
high`. A fixture written with `severe` type-errors but still RUNS under
sucrase — it silently becomes "not in the good set", which reads as a working
guard. High is the top of the scale.
