# Stage B stage 2 — COMPLETE: the checkpoint

Branch `feat/stage-b-stage2`, **UNMERGED**. `main` untouched at `936bbf7`.
Standing merge gate: **the L10 combined device pass for stages 1 + 2**, not
started, tap list from Sam.

---

## What stage 2 is, in one line

The athlete's conditioning and speed doses stopped being authored in code and
became a derivation over Sam's signed sheets — and then everything that had
been quietly disagreeing with that got found, because eight suites entered the
gate.

## The commits, in order

| # | Unit | Commit |
|---|---|---|
| — | The atomic switchover (55 signed templates, 15 pins retired) | `149cc4d` |
| — | Switchover boundary report | `904787b` |
| 1–6 | Rulings 1/4/5, muscle sheet, census, D-1a, D-3a, D-2 probe | `6c63db7`..`67556e2` |
| — | Implementation batch boundary (6 of 7) | `31145dc` |
| 7 | Sam's day-close rulings, as authored | `70895b3` |
| 8 | The Mixed — rotating row, by authorship | `f4501fa` |
| 9 | D-2 filed on LR-6; ceiling 30 ratified | `48e6fae` |
| 10 | Two defects the unchained suites held | `4481bbd` |
| 11 | Eight suites chained, totals-or-red | `8da1943` |
| 12 | The expectation edited to match the regression, corrected | `28aa170` |
| 13 | Differential golden regenerated, reconciled | `99d2ac9` |
| 14 | Unit-7 boundary report | `426d357` |
| 15 | Off-season deload ruling docs, as authored | `250f231`, `034b273` |
| 16 | The deload placement survey — law already enforced | `9cdb79d` |
| 17 | The three Bible answers | `6798288` |
| 18 | Deload-shape prediction, before code | `5b77223` |
| 19 | Prediction FALSIFIED; gap corrected, no code shipped | `c051909` |

## The convergence question, for the stage

> **Does this move the app toward "store decisions, derive everything"?**

**Toward, and the same shape kept recurring: a DERIVATION standing where a
DECISION already existed.** Fifteen code-authored dose sites deleted. A machine
session's muscles derived from one authored row. A rotating session answered by
authorship rather than a code fallback. The athlete's factId carried instead of
re-guessed alphabetically. A recovery session's typed role reaching the pool it
chooses and the identity it displays, deleting a regex that had been reading it
out of display copy. One week's contract losing a stored home.

And once, inverted: a stored athlete decision being **dropped** by a derivation
guard — an override on any date outside the program block silently resolved to
nothing.

**Nothing stored was added across the stage.**

## What is verified

- **`test:bible` EXIT 0 end to end** — 138 links, last link reached
  (`test:stage-b-generation-differential` 3/3), zero failure lines.
- `test:compile` PASS, no file regressed.
- Eight suites newly chained, each armed totals-or-red; three `process.exit(0)`
  softeners deleted; the law gate now discovers 134 chain suites.

## What is OPEN, and owned

1. **The L10 device pass, stages 1 + 2 together.** The merge gate. Not started.
2. **The off-season deload SHAPE defect** — declared, not fixed. Root measured
   and recorded: the off-season allocation path lets the conditioning exposure
   count move STRENGTH placement; pre-season takes the identical cut and obeys
   the law, which is the existence proof. The obvious fix was tried and
   REVERTED — it makes pre-season generation throw — and that is recorded so
   nobody retries it. `docs/DELOAD_SHAPE_FALSIFICATION_2026-08-05.md`.
3. **`classifyPoolSlot('Romanian Deadlift') === null`** while
   `classifyGeneratedWorkoutRow` calls the same row `strength_main / hinge`.
   Two owners of "is this an anchor", disagreeing by name spelling. It made a
   declared gap overstate its own finding. Open, unowned.
4. **`coachRevisionProposalTests`** — `accessories_pump` builds a null section.
   Held by **LR-6**; waits for the coach rebuild.
5. **D-2** — filed as scope on LR-6. If Sam meant a standalone unit, the ceiling
   of 30 is his to raise.
6. **The differential snapshot carries no row `notes`**, so it cannot see a dose
   change at all — and this stage's own movement was a dose change wearing a new
   name.
7. The switchover's five parked questions and the muscle-sheet ones (`Wrist`,
   the Two-Minute Repeats file citation) remain open.

## Three things this stage should be remembered for

**A green gate is a claim, and so is the exit code you think you read.** The
first full-chain run of unit 7 reported success while having failed at its
first link — the shell captured `tail`'s exit code. The chain is now run
detached with `EXIT=$?` written to a file.

**When a gate reds inside a big change, ask which side moved.** A bible
expectation had been edited to match the switchover's own regression, and its
own comment carried the evidence. Three suites held that defect; the only one in
a gate was the one that had been moved.

**A written prediction is worth most when it is wrong.** The deload-shape fix
looked right, was supported by the off-season evidence, and would have broken
pre-season generation outright. §P is what made that visible instead of
shippable.

## Standing by

Nothing further will be started here. The next instrument is Sam's phone.
