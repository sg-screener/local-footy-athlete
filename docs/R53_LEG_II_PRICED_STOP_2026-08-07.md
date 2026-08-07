# R5.3 LEG (ii) — PRICED, and the price is FIVE RED SUITES — 2026-08-07

Answers the OPTION 1 ruling (land legs (ii)+(iii)+(iv) together), whose own
first condition was **leg (ii)'s single measurement run FIRST — price before
build, as always.** That run is done.

**STOP. Nothing built.** The price is not a set of fixture re-pins; it is
five suites failing on correctness and law.

## The measurement

Controlled, both arms in the **same worktree** on `scratch/r53-pricing-7`,
all 154 `test:bible` suites (`test:compile` excluded — scaffold-baseline
artifact, verified passing on the branch):

| config | failures |
|---|---|
| flags off (control) | 6 |
| `LEG_II=1 LEG_III=1 LEG_IV=1 LFA_BASIS=visible` | 11 |

Diffed as SETS, not counts:

- **NEW: 5** — `accepted-state-transactions`, `fact-horizon`,
  `program-control-durable`, `work-bill`, `action-walker:deep`
- **FIXED: 0**

The control's 6 are the 5 scaffold-only reds (verified pre-existing) plus
`fixture-identity`. For contrast, the previously measured
(iii)+(iv)+basis arm was **0 new / 0 fixed** — so every one of these five
belongs to **leg (ii) alone**.

## What the five actually are

Not re-pins. Each names a law or a correctness property:

1. **`fact-horizon` — completed days are REWRITTEN.**
   > T4 `illness_severe` rewrote 2 completed day(s): `2026-07-20`
   > "Mixed/core/High/4ex" → "Mixed/core/Moderate/5ex"; `2026-07-21`
   > "Team Training/core/High/3ex" → "Team Training/core/Moderate/3ex"

   Same failure for `cooked_week`. Tier 4 is reaching back into days the
   athlete has already DONE.

2. **`accepted-state-transactions` — determinism and atomicity.**
   > `[property] hydration remains deterministic and idempotent` —
   > "Pre-season hydration drifted"
   > `[property] a fixture MOVE publishes its dependent week once …` —
   > "following-week dependency was not committed in the same snapshot"

3. **`program-control-durable` — a durable move stops being visible.**
   > `a move committed durably reaches the visible week` — FAIL

4. **`work-bill` — billing exceeds the decision.**
   > `add: a category add bills only its decision + declared mirrors` — FAIL

5. **`action-walker:deep` — L13's deep gate, law L-P3 violated.**
   > SEED 2 — L-P3 TEMPLATE = PROJECTION. `2026-08-10`: the session list
   > omits `["speed"]` and invents `["support"]` — template
   > `["conditioning","power","strength","support"]` / projection
   > `["conditioning","power","speed","strength"]`.

   **Minimal failing history: 6 actions.** Not a deep-state curiosity — it
   is reachable almost immediately.

## STOP — and what the seat needs to weigh

The OPTION 1 ruling's grounds were sound and are not disputed here: leg (ii)
*was* always part of the ruled four-leg unit, and a 2-of-3 install would
have kept the publisher composing against the stored contract. Nothing in
this report argues for the rejected options.

What is new is the **price**, which had never been measured until this run
and which the ruling explicitly ordered measured before building. It is:

- **five suites red**, none of them cosmetic;
- covering **already-completed days, hydration determinism, transaction
  atomicity, durable-move visibility, work billing, and a deep-walker
  law**;
- with **nothing fixed** in exchange, on this suite set.

Under the standing conditions (price before build; full `test:bible`
UNPIPED per commit; STOP at law violations in signed behaviour), leg (ii)
cannot be landed in this state, and therefore neither can the
(ii)+(iii)+(iv) unit as one commit.

Three shapes the seat might rule, offered without taking one:

1. **Fix leg (ii) before landing the unit** — treat these five as leg
   (ii)'s remaining build, priced individually. The `fact-horizon` one
   (rewriting completed days) looks like the root: several of the others
   are consistent with tier 4 reaching further than it should.
2. **Land (iii)+(iv) alone anyway**, accepting the resolver read stays on
   the stored contract — but this is the 2-of-3 install already ruled
   known-wrong, so it would need the fixture-identity residual accepted
   explicitly and temporarily.
3. **Re-scope leg (ii)** so tier 4's reach excludes completed days and the
   dependent-week snapshot, then re-price. This is the narrowest change
   consistent with the five failures having one root.

Recommendation, stated not taken: **option 1 above** — but only after the
`fact-horizon` root is diagnosed, because if one cause explains three or
four of the five the price may be much smaller than five suites.

## NOT COVERED

- **The five failures were characterised, NOT diagnosed.** No root cause
  was established; the "one root" suggestion above is a hypothesis from the
  failure text, and by this unit's own executes-on-path law it is worth
  nothing until measured.
- Leg (ii) was measured only in combination with (iii)+(iv)+basis. Leg (ii)
  ALONE was not measured, so the attribution is "the five appear when
  (ii) is added to (iii)+(iv)", not "(ii) alone causes them".
- `test:compile` excluded (scaffold-baseline artifact; passes on branch).
- The parity conformance gate is not built — it comes after the unit lands.
- Condition 1's re-measure stays parked.
- Nothing built into `feat/r53-v3-switchover`.

## L12 — what catches the NEXT one of this class

The class: **a leg carried through many rulings on the strength of its
DESIGN, never once priced.** Leg (ii) has been named as part of the
four-leg unit since the convergence ruling, was reasoned about repeatedly,
and its cost was assumed rather than measured until the moment it was
ordered built.

The catch is the rule this unit has now hit twice: **price every leg
independently before it enters a build order, not when it reaches the front
of one.** Legs (iii) and (iv) were priced early and are free; leg (ii) was
priced last and is not. Had all four been swept the same way at the same
time — the sweep-not-serial law applied to PRICING rather than to
debugging — the build order itself would have been chosen knowing this.
