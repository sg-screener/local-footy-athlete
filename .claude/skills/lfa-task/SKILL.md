---
name: lfa-task
description: Start a unit of work in this repo from ONE observable outcome. Forces acceptance criteria, a ruling search before asking Sam, a data-flow trace before editing, and a vertical slice with proof.
disable-model-invocation: true
---

# /lfa-task — one observable outcome, worked to proof

**$ARGUMENTS is ONE observable outcome.** Not a file, not a component, not "look
at X". If it cannot be written as *something an athlete or a suite can observe*,
say so and stop — an unobservable outcome cannot be finished, only abandoned.

Live tree state, injected so nothing below is guessed:

- Branch: !`git --no-optional-locks branch --show-current`
- Working tree: !`git --no-optional-locks status --short`
- Last three commits: !`git --no-optional-locks log --oneline -3`

---

## 1. WRITE THE CRITERIA BEFORE ANYTHING ELSE

State, in the answer, before any tool call that changes a file:

- **DONE WHEN** — the observable thing that will be true. One sentence.
- **NON-GOALS** — what this unit deliberately does not do. At least one.
- **THE PROOF** — which existing suite or cell will fail if this breaks. If the
  answer is "none", **the unit includes writing it**; a claim with no cell is
  prose.

## 2. SEARCH THE RULINGS BEFORE ASKING SAM ANYTHING

**He has already ruled on more than you think, and asking twice is the
granted-permission defect** — it has fired four times.

Search first: `src/rules/lawRegistry.ts`, `docs/SEAT_INBOX.md`'s stand-downs,
`AGENTS.md`, `CLAUDE.md`, and the `docs/STOP_*` reports for the area. **Only
ask Sam what the search did not answer**, and quote what you found so he can see
you looked.

## 3. TRACE THE DATA FLOW BEFORE EDITING

Name, before the first edit: **who writes it, who reads it, and where it is
persisted.** If any of those three is "I do not know yet", trace it — do not
guess and do not start at the surface. A fix at the wrong altitude is the defect
this repo pays for most often.

## 4. EXTEND, DO NOT ADD

Prefer, in this order: use the existing owner → extend the existing owner →
create a new one. **A second predicate for a question something already answers
is the two-owners defect**, and every guard, resolver, fallback and
compatibility branch is that defect wearing a helpful name.

## 5. THE SLICE IS VERTICAL OR IT IS NOT DONE (L16)

A unit lands with **all** of: the writer, the reader, a reachable entry point an
athlete can get to, persistence if it claims any, and a test. **Four of five is
not eighty percent — it is a feature nobody can use.**

## 6. PROOF, BY KIND OF CHANGE

- **UI** — simulator proof. `scripts/dev-e2e/run-maestro-ios.sh`, never bare
  `maestro test`. If the simulator cannot run, say **PARKED**, never "done".
- **Generation, repair, scheduling or coaching rules** — the full scenario
  report, and the sweep diffed **name for name** against its baseline. A red
  COUNT that matches is not a set that matches.
- **Anything else** — the targeted suites, plus one mutation per new cell: break
  the thing on purpose and watch that cell, and only that cell, go red.

## 7. REPORT WHAT HAPPENED, NOT WHAT WAS ATTEMPTED

**WORKING** (name the test that fails if it breaks) · **BUILT** (code exists,
nothing checks it) · **WRITTEN** (a doc says it, no code). **The words "done",
"shipped", "in", "handled" and "sorted" are banned.**

Anything not covered is stated as **NOT COVERED** with its reason. A gap you
name is a boundary; a gap you omit is a lie with better manners.
