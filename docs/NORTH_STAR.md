# NORTH STAR — what this app is

**Sam's sentence (2026-07-30, verbatim intent):**
An athlete onboards based on who they are → they adjust their program as life
gets in the way (injury, illness, season phase, schedule) → the programming is
set by the Bible → their training is tracked → they get recommendations,
warnings and readiness awareness. That's the whole thing.

## The architecture that sentence demands

> **Store only decisions. Derive everything else.**

The only things this app ever persists are INPUTS:

1. **Profile answers** — who the athlete is (onboarding + edits, one door).
2. **Life-facts** — typed, dated, athlete-declared or fixture-derived:
   injury, illness, readiness, games, byes, availability, team days.
3. **Athlete decisions** — the edit ledger: every add/move/swap/bin/route
   choice, recorded as a typed decision (the action tape is its skeleton).
4. **Training results** — what was actually done (logs, TT times, weights).

Everything the athlete SEES is a pure derivation:

```
visibleWeek = derive(Bible, profile, facts, decisions, results, today)
```

One function. No stored copies of its output that can go stale, be mirrored,
be overwritten, or disagree. When only inputs are stored, divergence between
"what the app decided" and "what the athlete sees" becomes UNREPRESENTABLE —
not tested away, impossible.

## Why this is law and not philosophy

Every major defect class this repo has suffered is a violation of this shape:

- stored outputs going stale beside live inputs (the profile-mirror wipe)
- two owners of one fact (phase skew, hard-day double authority)
- derived content overwriting athlete decisions (G-1/G+1 derivers)
- five publication shapes for one kind of decision (override / overlay /
  constraint / mark / snapshot)
- projections of stored outputs disagreeing with the outputs (render splits)

Each was expensive to find and would have been impossible to write under this
architecture.

## The convergence rule (binding on every unit)

Every unit — including Stage B and everything after — answers one question in
its boundary report:

> **Does this move the app toward "store decisions, derive everything", or
> away from it?**

- New stored state is presumed WRONG unless it is an input (a decision, a
  fact, an answer, a result). Storing derived output requires an explicit
  Sam-approved exception with a retirement plan.
- Existing result-stores (see LEGACY_RECKONING_CENSUS) are debt. Units that
  touch them convert them toward ledgers/inputs, never extend them.
- The five publication shapes converge to ONE: an athlete decision is
  recorded, the week is re-derived.

## How the current plan already serves this

- **Stage B** builds the derivation function over Sam's authored data.
- **LR-1/LR-2** (one door + tape per store) turn stores into ledgers.
- **The walker** (action-sequence harness) is this architecture's natural
  test: replay decisions, check laws, since state IS the decisions.
- **The Bible + sheets + 25 laws** are the authored inputs and invariants —
  they survive and outrank any implementation.

The road and the destination are the same. This document exists so no unit
ever again optimises a corner of the old shape instead of converging on this
one.
