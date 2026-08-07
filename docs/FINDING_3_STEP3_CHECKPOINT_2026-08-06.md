# FINDING 3 STEP 3 — TWO BOUNDARIES WITNESSED, FOUR CELLS RELABELLED

Step 3 of the approved build order. `src/__tests__/weekBudgetPlacementOwnership-
Tests.ts`, chained into `test:bible` after `test:placement-ownership`.

The first draft ran 6/6 green and **witnessed nothing** — five of six cells
survived every mutant that should kill them. This is what changed, and what the
honest reckoning cost.

## The matrix, before and after

`X` = the cell reds, killing the mutant.

| mutant | C1 | C2 | B1 | C3 | C4 | B2 |
|---|---|---|---|---|---|---|
| A — budget removed (`freeSlots` ignores the quota) | . | . | . | . | . | . |
| B — attach-first comparator reverted | . | . | **X** | . | . | . |
| C — `:776` `Math.max` restored | . | . | . | . | . | . |
| D — demote loop caps at the authored MAX again | . | . | . | . | . | **X** |

Before the rework only `B2` killed anything — `A+B together` also survived.

## What fixed B1, and it was the WORLD, not the assertion

The first cell 2 asserted "the repair attached while a spare day was still
available" in the off-season restricted world. Measured: that world does not
pressure the ordering at all. A 4-strength / 3-conditioning demand occupies four
days with three spare, at 6 preferred days **and at 7**, so attaching happens
through the eligibility filter's training order and the comparator changes
nothing. The golden bisection had already said as much — reverting the comparator
moved `preseason-team-and-game` and **only** that scenario.

So `B1` moved to the practice-match world and to the invariant the ruling actually
implies:

> a standalone core-conditioning day and a strength-only day must never coexist
> while the contract permits combining — the repair had an attachable day in its
> candidate list and reached past it.

Stated as the PAIR rather than as a count, so it describes the choice and not one
week's shape. Under mutant B it reds with the days named:
`standalone core conditioning on day(s) [3] AND strength-only work on day(s) [1,4]`.

## What could NOT be witnessed, and why that is a finding

**C1 — the working-day budget.** The budget can only bind when the days a week
WANTS exceed `7 − fullRest.required`. Measured across every reachable off-season
shape — 6 and 7 preferred days, restricted and healthy — the demand occupies four
days against an allowance of five, with a spare rest day left over. Adding
preferred days does not help: it adds allowance as fast as it adds candidates.

Day-pressure was attempted in the ruled order and none of it bit:

| attempt | result |
|---|---|
| fewer preferred days | *reduces* pressure — unoccupied days become rest, so the quota is met more easily |
| 7 preferred days | identical output to 6: occupied 4, rest 3, required 2 |
| restriction + anchors | anchors occupy days the repair cannot use, but shrink the demand with them |

So `restBudgetSpare()` is a correct guard with **no reachable subject** — the same
shape as Sam's ruling that "a path nothing can reach is a fixture with no
subject". It is kept because it is cheap and right, not because anything proves it
fires. **If a mode ever authors `fullRest.required` of 3, or a demand needing five
distinct days, C1 becomes witnessable and should be promoted then.** That
condition is written into the suite header so the next person inherits it.

**C4 — the derived declaration.** Masked by B2's own mechanism: with the demote
loop obeying the declaration, no flush is ever stamped in mid off-season, so a
restored `Math.max(policyMin, countInPlan)` reads 0 regardless. This **corrects
step 2's boundary report**: after the demote fix, `:776`'s `Math.max` was DEAD
rather than wrong, so retiring it removed dead code rather than changing
behaviour.

**C2, C3** — true properties already witnessed elsewhere (cell 10 in
`phaseStructureConformanceTests`, gateway cell 46), unwitnessable here.

## The reckoning

Four cells lost their boundary names. They are now `C1`–`C4`, each carrying
`[cover]` in its own printed name, under section headers that say
`Regression cover:` rather than naming a boundary. Only `B1` and `B2` print under
`WITNESSED BOUNDARY:`.

Nothing was deleted: every property asserted is true and worth holding. What was
removed is the *claim* that they pin the mechanisms — because a cell keeping a
boundary name it does not hold is exactly how `a gate passing on coordinates it
never builds` gets written, and this suite would have been the sixth sighting.

## Against the approval

The approval asked for the reassessment's four boundaries, mutation-checked. Two
are witnessed (`B1`, `B2`). Two are not, and the reason is measured rather than
assumed: one has no reachable subject, one is masked by a sibling fix that makes
its mutant inert. That is reported here rather than dressed as four green
boundaries.
