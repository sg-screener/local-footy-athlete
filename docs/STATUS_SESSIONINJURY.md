# STATUS — seat `sessioninjury`

**Branch:** `feat/session-injury-review` (worktree, off `main` `da1dbf89`).
**Owner:** this seat only. Nobody else writes this file.
**Mission (Sam, 2026-08-20):** the Active Session Injury selection-and-review
flow. Ask for the area ONCE, find EVERY affected exercise, walk the approved
ladder, show ONE review, apply together. Injury stays separate from Remove.

---

## THE BASELINE, MEASURED BEFORE ANY CHANGE (worktree at `da1dbf89`)

| suite | baseline |
| --- | --- |
| `test:injury-fallback-journey` | 172 pass / 0 fail |
| `test:session-change-sequence` | 22 pass, ALL GREEN |
| `test:mid-block-restart` | **THROWS** — `validateLiveProgramWrite is not a function`. **RED ON `main` ITSELF, not mine.** |
| `test:session-change-hub` | 65 pass |
| `test:injury-recomposition` | 41 pass |
| `test:tap-swap-hierarchy` | 25 pass |
| `test:exercise-edit-entry-surface` | 46 / 46 |
| `test:plan-change-producer` | **64 failures, RED ON `main`** — failure set captured and diffed |
| `test:compile` | **77 files over baseline, RED ON `main`** — set captured and diffed |

---

## WHAT WAS ALREADY BUILT, AND WHAT WAS ACTUALLY MISSING

**Steps 2, 3 and the honesty rule were already done and signed.**
`unsafeRowsForInjury` finds every affected row; `planInjuryRecomposition` walks
the approved ladder (`rules/injuryFallbackLadder`, six rungs) and records honest
omissions; `injuryRecompositionMessage` derives the sentence from what actually
landed. R-115's `rules/injuryWithheldRows` already keeps an injury omission out
of the Remove list.

**What was missing was the athlete's half of it:**

1. **The flow asked for an EXERCISE first.** The Injury chip opened
   `pick_exercise`, so the athlete had to do the app's job of finding the
   affected work — and then only the row they named was reviewed.
2. **There was no review.** `set_injury_modifier` fired the moment the guided
   flow closed. The session was already recomposed before the athlete saw
   anything, and the `confirm_swap` shown afterwards covered ONE row of however
   many the injury had touched.

## WHAT LANDED

### 1. ONE OWNER FOR THE INJURY PASS'S INPUTS

`resolveInjuryRecompositionInputs` (exported from `utils/programControlActions`)
is now called by BOTH `recomposeSessionForInjury` (the write) and
`buildSessionInjuryReview` (the review). A review is a promise, and the only way
a promise is kept is if the thing that made it and the thing that keeps it ask
the identical question of the identical world.

**The one thing that moves between the two calls is the fact itself** — the
review runs before the constraint is stored, the write after. That is closed by
passing the pending constraint as `primaryInjury`, which
`resolveTapSwapEnvironment` folds into `injurySeverities` and now into
`medicalStop`. **That `medicalStop` clause is not a new opinion** —
`getTapSwapChoices` already computed `medicalStop || primaryInjury?.seriousSymptoms`
privately; `injuryRequiresChange` read the raw field and did not. One question,
one answer, decided at the owner. **MEASURED INERT** for every caller that
existed before it (the guided sheet hard-codes `seriousSymptoms: false`), and
`[1]` carries that as a standing control.

### 2. `utils/sessionInjuryReview.ts` — THE REVIEW, AND NOTHING ELSE

It invents no safety rule and no ladder. Every question it asks already had a
signed owner; it reads the plan and renames its parts for the athlete. A row is
`'substitution'` or `'withheld'` — **there is deliberately no `'removed'` kind**,
so no surface downstream can read a review row as an athlete Remove decision.

### 3. THE SCREEN

`openSessionInjuryFlow` opens the guided sheet from the hub with no row;
`reviewSessionInjury` builds the review and **writes nothing**;
`applySessionInjuryReview` applies all of it through the one durable door on
approval. `'injury'` left `ExercisePickAction` — Swap and Remove still need a
row because they genuinely are about one. **The five-action hub and the Add
hierarchy are untouched.**

---

## THE NUMBERS

`test:session-injury-review` — **39 pass / 0 fail**, on a real generated week
through the real doors, with the injured area chosen BY MEASUREMENT.

**MUTATIONS (all bite):**

| # | mutation | result |
| --- | --- | --- |
| M1 | `nothingChanges` can never be true | reds 2 |
| M2 | withheld rows dropped from the review | liveness reds, 8 cells skipped |
| M3 | pending injury stops feeding `medicalStop` | reds 1 |
| M4 | a withheld row reported as a substitution | liveness reds, 8 cells skipped |
| M5 | the red-flag predicate always answers false | reds 2 |

⚠ **M2 REDDENED NOTHING IN THE FIRST CUT, AND THAT IS THE FINDING.** A sweep of
13 areas x 5 severities x every training day of a real generated fortnight
produced **not one omission** — the approved ladder's rungs 5 and 6 are large
enough that an ordinary injury always has a legal answer. So the `withheld`
cells were green and EMPTY. The world that reaches them is the RED FLAG (8-10
plus serious symptoms), where `getTapSwapChoices` returns rest only: **all 5
rows withheld, 0 substitutions.** Section `[8]` is that world, and it is where
R-115 is re-proved end to end.

## THE THREE ORDERED CHECKS, AFTER

| suite | after | vs baseline |
| --- | --- | --- |
| `test:injury-fallback-journey` | 172 / 0 | identical |
| `test:session-change-sequence` | 22, ALL GREEN | identical |
| `test:mid-block-restart` | throws | identical — **still `main`'s break, not mine** |
| `test:exercise-edit-entry-surface` | 48 / 48 | +2 cells, both stricter |
| `test:plan-change-producer` | 64 failures | **failure set diffed byte-for-byte: IDENTICAL to `main`** |
| `test:compile` | 77 files | **set diffed: IDENTICAL to `main`, zero product files added** |

**THREE CELLS WERE INVERTED, NOT DELETED.** `exercise-edit-entry-surface` pinned
the route Sam's ruling removes (`action === 'injury') onInjuryStart(exercise)`).
The two flow-owner rows are RE-POINTED to the functions that replaced them, and
the doors cell now asserts the OPPOSITE and asserts more: that
`ExercisePickAction` has no `'injury'` member left to route on, and that the
door leads to the review.

---

## LOG

- 2026-08-20 — worktree off `da1dbf89`, baseline measured, defects named.
- 2026-08-20 — the review owner, the screen flow, the suite, the mutations.
- 2026-08-20 — **NOT MERGED. Sam's approval not given and not assumed.**
