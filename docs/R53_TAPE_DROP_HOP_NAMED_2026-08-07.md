# R5.3 THE TAPE — the drop hop is NAMED, and it is inside signed behaviour — 2026-08-07

Answers the upgraded seat order (Sam's sweep-not-serial method call).
**Attribution only — nothing built.** Tape preserved at `f91ea404` on
`scratch/r53-pricing-7`, gated on `LFA_TAPE` and inert by default.

## Method — one run, both worlds, diff the tapes

`src/utils/probeTape.ts` imports nothing, so any domain module can call it
without a cycle. It tapes every write and transform touching the freed
week's `workoutsByDate` across the whole commit path — build, publication,
staging, republish, commit — recording payload size, non-null count, day
names, contract presence and a trimmed stack at each hop. Both worlds in
one run; then diff by sequence.

**The executes-on-path law is satisfied by construction:** a hop that does
not run leaves no line, so absence is evidence rather than an assumption.
Every suspect from the previous serial passes is re-tested in this same
run, ranked by the diff instead of by guesses.

## The diff — the tapes disagree on payload at exactly ONE hop

The hop sequence is identical up to index 10. Payload comparison:

| idx | hop | flags off | leg (v) |
|---|---|---|---|
| 8 | `H3.publish:proposed` | 0/0 `v2=T` | 0/0 `v2=F` |
| 9 | `H6.rev:input.proposal` | 0/0 `v2=T` | 0/0 `v2=F` |
| 10 | `H7.rev:staged.proposal` | 0/0 `v2=T` | 0/0 `v2=F` |
| **11** | **`H8.rev:store-after-accepted-commit`** | **2/2** `v2=T` | **0/0** `v2=T` |
| 12 | `H9.store:after-reversible-commit` | 2/2 `v2=T` | 0/0 `v2=T` |

The payload is **empty in both worlds** all the way through publication and
staging — the deliberate `workoutsByDate: {}` — and is materialised
**inside `commitAcceptedStateTransaction` itself**.

Staging does not fill it (H7 identical both sides), which rules out
`stageReversibleAdjustmentCreationTransaction`.

## The discriminator is the published declaration

Within everything taped, the **only** difference in the proposal between
the two worlds is `exposureContractV2` on the proposed overlay.

Note what the tape also shows: **both worlds end with a contract in the
store** (`v2=T` at H8 either way) — the transaction mints or repairs one
regardless. Only the world whose *proposed* overlay carried the
declaration gets its **payload** materialised. Running
`LFA_LEGV_SCOPE=both` (retiring the legacy contract as well) reproduces
the same hop and the same `0/0`, so it is the declaration's presence that
matters, not which field carries it.

## Every earlier suspect, excluded by the same run

- `buildWeekScopedWorkoutOverlay` builds a full 7-day payload
  **identically in both worlds** (H1: 7/4–7/6 on both sides).
- The staged rolling-horizon projections are byte-identical (H5, and the
  earlier `REPAIR` probe: same `outcome`, `weekStarts`, payload).
- `additionalOverlays` never collide with the primary week.
- `commitWeekScopedOverlay` replaces wholesale — no merge.
- `validateLiveWeekOverlayWrite` never executes on this path.

That is five hypotheses settled in one run, which is the point of the
method change.

## STOP — the condition is met

The order said: *"If the tape shows the drop inside a decision payload or
signed behaviour, STOP with the hop named."*

The drop is inside **`commitAcceptedStateTransaction`** — the signed
accept-and-reduce owner (`operation: forward_decision` / `restoration`).
That is signed behaviour, so this is the STOP with the hop named, not a
narrowing to build against.

**Named hop:** `commitAcceptedStateTransaction`, between `staged.proposal`
and the store, gated on the proposed overlay carrying `exposureContractV2`.

**What this means for the build order** (the seat's call, not this
terminal's): the freed day's content is materialised by the signed commit
*because the publication declares a contract*. Retiring the declaration
therefore removes content the commit would otherwise materialise — which
is the fixture-identity law's own test failing, and it is not something
leg (iii) obviously supplies, since leg (iii) changes read-time derivation
while this is a write-time materialisation.

## NOT COVERED

- **Which line inside `commitAcceptedStateTransaction` materialises the
  payload was NOT narrowed** — the STOP condition fired at the function
  boundary, and going further would mean attributing inside signed
  behaviour. Named as the next question if the seat wants it opened.
- Condition 1's re-measure stays parked, as ordered.
- Nothing built; `feat/r53-v3-switchover` unchanged except this report.
- Only `test:athlete-session-deletion` and `test:athlete-session-move`
  were run on the scaffold (both green with the tape inert); no full
  bible there — scaffold branch, probes only.
- The tape covers the DELETION suite's path. Whether the same hop owns the
  drop on other paths was not measured.

## L12 — what catches the NEXT one of this class

This pass is itself the answer, and it is Sam's, not mine: **sweep, don't
serialise.** Three consecutive passes each tested one named suspect, and
each was refuted at a cost of a full round trip — the payload emptying
"is leg (v)'s scope", "is the merge", "is the declaration's reader". One
tape settled all five suspects plus the real hop in a single run, and it
could not have confirmed a false mechanism, because the tape records
execution rather than plausibility.

The general rule: **when the question is "where does X change?", instrument
the whole path once and diff, rather than testing candidate owners one at a
time.** A diff over a full tape is ranked evidence; a serial hypothesis is
a guess with a round trip attached. This is the matrix law and the batch
law in a third setting, which is why Sam called it rather than the seat.
