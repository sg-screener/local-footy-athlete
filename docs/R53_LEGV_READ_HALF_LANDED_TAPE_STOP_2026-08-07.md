# R5.3 — THE READ HALF IS LANDED; THE TAPE ANSWERED THE TWO; AND IT STOPS ON A DECISION PAYLOAD (2026-08-07)

LOOP CHECK: confirmation-taken-from-the-thing-I-produced-rather-than-the-thing-I-measured
— harness-lies sighting 6, mine, and the third form of it today (a `tail -3`
read as a verdict; a background job's "launched" echo read as proof it ran; a
partial tape file read as a complete run). Sighting 2 of any shape orders the
compression, so this one is structural and not another reminder: **the sweep
runner is now the only sanctioned way to answer "is this suite green", and a
tape is not read until its runner has written its exit line.** The first two
cost time; the third I caught and flagged before building on it, which is the
only reason this report's numbers stand.

Twenty-first pass. Answers inbox item 1 (a) and (b). **(a) IS LANDED. (b) STOPS
on its own stated condition**, and (c) is therefore NOT reached: **V3 is not
closed.**

## THE HEADLINE

| step | result |
|---|---|
| (a) the read half | **LANDED** on the branch, `8ca5ae24`, unflagged, all three selection lines |
| its gate | `test:compile` EXIT 0; `test:bible` EXIT 1 on the declared red, **18/1 — byte-identical to before it landed** |
| (b) the two unexplained | **ANSWERED BY TAPE** — and they were never "missing content" |
| what actually moves | **the CONTRACT gets harder**: `required` 2 → 3, while the week's content is byte-identical |
| the cause | the stored declaration is the only carrier of the week's **accumulated authorised reductions** |
| the fix I built and measured | the deriver reads the removal RECORD — real (15,000 → 10,924 verdicts), **and it does not rebuild the stack** |
| the stop | those reductions are **decision-linked** — ledger + restoration — which is (b)'s own stop condition |

## (a) THE READ HALF, LANDED

`8ca5ae24`. The week's identity derives from the athlete's facts through the
same single owner generation asks, installed at all three contract-selection
lines. Measured free before landing (readers-alone arm, control set exactly),
and the gate after landing is byte-identical to the gate before it: EXIT 1 at
`test:program-control-durable`, 18 passed / 1 failed. Nothing regressed.

## (b) THE TAPE — FOUR WATCH POINTS, BOTH CELLS, BOTH ARMS, ONE RUN

File-backed, with a positive control in every arm (`control:seam-installed`
fires 1/1; `build:overlay` 578/594 and 19/19; `store:write` 411/399 and 78/78).
No zero below is a silent zero.

**THE CANDIDATE I CARRIED IN WAS REFUTED, cheaply and first.**
`programUsesCurrentContracts` — the hydration predicate that calls an overlay
with content and no declaration "not current contracts" — fires **0 times in
both arms, in both suites**. It reads exactly like the mechanism and is not on
the path. Recorded so nobody re-runs it.

**AND THE "MISSING CONTENT" READING WAS WRONG TOO.** `phase-structure` is the
clean case: builds 19/19, store writes 78/78, overlay transitions 31/31, and
**zero payload-losing transitions in either arm**. The builder's payload-size
distribution is identical across arms; the ONLY field that changes is
`hasDeclaration`. The content is all there.

**WHAT MOVES IS THE CONTRACT THE WEEK IS JUDGED AGAINST:**

| §18 verdict (domain, actual, required) | writer OFF | writer ON |
|---|---|---|
| `main_strength` 0 → required **3** | 0 | 1,004 |
| `main_strength` 1 → required **3** | 2 | 2,392 |
| `main_strength` 2 → required **3** | 262 | 1,599 |
| `conditioning` 1 → required **2** | 375 | 0 |
| `conditioning` 1 → required **3** | 12 | 267 |

`actual` spans the same range in both arms. `required` climbs. The week is not
short of work — it is being asked for more.

**AND THE DECIDING FIELD SAYS WHY.** Recording `reductions.length` at the
verdict:

| judging contract carries | writer OFF | writer ON |
|---|---|---|
| **0** reductions | 1,231 of 2,704 (46%) | 12,945 of 15,000 (86%) |
| 1 | 607 | 420 |
| 2 | 416 | 1,635 |
| 4 or 6 | **448** | **0 — the stack caps at 2** |

Kinds seen in the stored world: `explicit_user_override` ×3,547,
`spacing_safety_conflict` ×102, `deload_policy` ×4.

**THE MECHANISM, NAMED:** the stored declaration is not a cached identity. It
is an **ACCUMULATOR** — every transaction that authorises a reduction writes it
onto the week's contract, and the stack deepens over the week's life. Retire the
declaration and every reader falls back to the base microcycle's contract, which
carries none of them, so §18 demands work the athlete's own decisions had
already excused. That single sentence covers BOTH unexplained cells: a
lighter-day trim refused (`required_minimum_shortfall:main_strength:2`), and a
flush that survives a rebuild because the harder contract still wants it.

## THE FIX I BUILT, AND ITS HONEST RESULT

`derivedWeekContract.ts:191` was asking the wrong field. The §18 gateway blanks
`userRemovalConstraints` (`section18AcceptedWeekGateway.ts:379`) once the
removals are folded into the composed week; `withRemovalLedger` then asked that
emptied field whether a decision explains the week. `removalDecisions` is the
RECORD, never blanked, created by the removal-record-split ruling for exactly
this question — **this is that ruling's second consumer**, the first being the
repair search's stand-down (1,045 of 1,045 entries with `constraints=(none)`).

Threaded at all three sites. `test:compile` PASSED at baseline.

**MEASURED, and it is not enough:**

| | before the fix | after |
|---|---|---|
| shortfall verdicts (walker, writer arm) | 15,000 | **10,924** |
| share judged against a ZERO-reduction contract | 86% | **87%** |
| deepest reduction stack | 2 | **2** |
| failing suites, full 156 | 9 | **9, identical set** |

So the fix is live and removes a quarter of the spurious verdicts, and it does
**not** rebuild the accumulated stack. Reporting it as a win because the first
number moved would be the same error as reading a totals line. **The removal
record is not the carrier of what was lost.**

## WHY THIS STOPS — (b)'s OWN CONDITION, MET

The ruling permits exactly one stop: if the two unexplained "touch a decision
payload or signed behaviour". They do, and here is the line:

- `reversibleAdjustmentLedger.ts:419` builds `linkedTypedReductions` from
  `contract.authorisedReductions`.
- `acceptedStateTransaction.ts:1141`, `:1163`, `:2761` read the same field on
  the restoration path.

The contract's authorised reductions are **bound to deletion identities and
linked into the reversible-adjustment ledger** — they are the mechanism by which
"Restore removes only its typed reduction and preserves an unrelated reduction"
is true. Retiring the declaration without a derivation that reproduces the stack
changes what a Restore does. That is a decision payload, so the writer does not
retire on my say-so.

**And it is one fix past the point where guessing should stop.** I built one
correction, measured it, and it did not pay. A second guess before a ruling is
the stop-patching shape this repo names explicitly.

## FOR THE SEAT — THE SHAPE THE ANSWER LOOKS LIKE

The accumulated reductions are the last thing the stored declaration owns that
nothing else does. Two candidate homes, and the choice is architectural, not
mine to take:

1. **The adjustment ledger already holds them** (`linkedTypedReductions`), so
   the deriver could rebuild the stack by replaying the week's adjustments —
   decisions in, contract out, which is the north star exactly. Cost: unknown;
   the ledger's per-adjustment records would need to be sufficient, and the tape
   says the record alone is not.
2. **The reductions are re-derived from the facts** the way the mode now is —
   but `explicit_user_override` is an athlete decision, not a fact, so this
   likely only covers `spacing_safety_conflict` / `deload_policy`.

Option 1 is the one that matches the convergence rule. Neither is priced.

## NOT COVERED

- The three content suites (`athlete-session-deletion`,
  `accepted-state-transactions`, `illness-clear-game-week`) were NOT separately
  taped. They are consistent with the same sentence — a harder contract changes
  which repairs run and which tables are selected — but that is a reading of
  their failure text, not a measurement of their worlds.
- Whether replaying the adjustment ledger reproduces the stack: unmeasured, and
  it is the whole of option 1.
- `illness-clear-game-week` G3's re-point question is still open and still must
  not be re-pointed until the derived week is measured at that coordinate.
- The tape instrumentation lives on the scaffold only
  (`scratch/r53-legv-readers`) and must be stripped before any product landing —
  it touches `weekRebuild`, the evaluator and the hydration ingress.
- No device evidence. Monday's `Vertical Jump` still waits on the writer.
