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

## PATH A — MUTATION RUN, 24 MUTATIONS, ALL SEEN RED

Control 52/52 green. Four mutations SURVIVED the first pass and each one named a
real hole, none of which reading would have found:

**M1 — the contract's own number was decoration.** Raising
`HARD_BLOCK_MAIN_LIFT_SETS` from 3 to 4 changed nothing. `resolveComposedDose`
clamps every main lift to three, so the AUTHORED ceiling was doing all the work
and the constant could never bind. The "Deadlift runs at 3 sets" cell was passing
for the wrong reason. Closed by a decision-layer cell that hands the rule an
authored FOUR-set main lift — the only coordinate where the contract's number is
the binding one, and one generation does not produce.

**M5 — two doors, one fixture.** The fixture answered `very_hard` AND `high`
together, so deleting either reader left the other carrying the verdict. Closed
by an effort-only fixture and a soreness-only fixture, plus a cell that an
ordinary `hard` block does NOT reduce.

**M7 — the deload clamp had no coordinates.** It only bites for an exercise that
has recorded history AND appears in the deload week, and the generated fixture
puts `Deadlift` in no week-4 session. Closed by a decision-layer cell.

**M11 — reps added back are invisible against the control.** The comparison is
"hard block vs well-recovered block"; adding reps to the freeze's already-lowered
range lands the row exactly ON the control's number and the comparison stays
silent. Closed by asserting the volume owner moves `prescribedSets` AND NOTHING
ELSE — which also kills M10 a second way.

**M9 was weak rather than dead.** An accessory sits at the two-set floor already,
so reducing it and refusing to reduce it produce the same number. The cell now
asserts NO DECISION EXISTS, not that the number did not move.

## PATH B — MUTATION RUN, 20 MUTATIONS, ALL SEEN RED

Control 86/86 green. One mutation SURVIVED the first pass:

**B5 — `partial` counted as attendance, and no fixture had one.** The attendance
blocks were built from `full` and `skipped` only, so a rule that treated a
half-done session as a completed one had no coordinate to fail on. **`partial` is
the commonest real answer for exactly this question's athlete** — the one whose
life is getting in the way. Closed by a fully-partial block that reads as ZERO
attendance and therefore ASKS.

## THE MEASUREMENT THAT DECIDED PATH B'S SHAPE

The production legality probe (which asks generation, not a table), over nine
worlds at `6117a9fd`:

| phase | d=3 | d=4 | d=5 |
| --- | --- | --- | --- |
| Pre-season | **[]** | [3] | [4,3] |
| In-season | **[]** | [3] | [4,3] |
| Off-season | [2] | [3,2] | [3,2] |

**A pre-season or in-season athlete already at three sessions has NO legal
smaller programme** — `main_strength_permitted_minimum` refuses two — so the
honest answer for them is no question at all (`no_legal_smaller_commitment`).
It cost a crashed test run to find: the first version of the confirm cell tried
to rebuild a 3-day pre-season athlete at 2 and generation refused outright.

## SUITE SWEEP — BRANCH vs CONTROL, IDENTICAL

39 suites run in this tree and in a clean `6117a9fd` worktree. **The pass/fail
set is identical except `test:block-two-difficult-missed`, which does not exist
at control.** Every red in the sweep is the parked baseline:
`block-rollover`, `block-state`, `week-rebuild`, `deload-week`, `readiness`,
`readiness-ownership`, `conditioning-identity`, `conditioning-rotation`,
`quiescent-boot`, `weekly-dose-ownership`, `projection-ownership`,
`surface-agreement`, `law-registry`, `ruling-registry`, `repo-law-guards`,
`ladder-wide`.

`test:compile` returns 468 errors / 6 worse pairs — the base's own numbers, and
all six pre-existing files. No new pair.
