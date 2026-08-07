# R5.3 — THE FLIP: MOVE (ii) DELIVERED FREE, MOVE (iii) PRICED — 8 NEW / 1 FIXED, AND THE SET IS THE WRITER ARM'S EXACTLY (2026-08-07)

LOOP CHECK: **a-count-taken-for-a-record** does NOT fire — the arms were diffed
as SETS, and diffing them as sets is what produced the pass's main finding. The
counts alone (8 new / 1 fixed, both arms) would have read as coincidence.

Twenty-sixth pass. Answers inbox item 1 (b), (c), (d) — the (ii) → (iii) unit.
**MOVE (ii) IS BUILT AND LANDED** (`e97c9a49`, unflagged, measured free).
**MOVE (iii) IS PRICED AND NOT BUILT** — flag-gated (`LFA_FLIP_DOOR`), inert by
default.

## THE HEADLINE

| step | result |
|---|---|
| move (ii) — one read door | **BUILT, LANDED, FREE** — sweep 2 of 156, the control set EXACTLY |
| move (iii) — flip the door | **PRICED: 9 of 156.** `fixture-identity` **FIXED**, 8 new |
| the parity worlds under the flip | **ALL THREE BYTE-EQUAL** — not "every difference declared" |
| the declared parity entry | **EXPIRED on its own terms, and it retires PAID, not MOVED** |
| the Monday | **`2026-08-10=Lower Squat|8`** in all three worlds — Vertical Jump lands |
| the seat's "the 8 will dissolve" prediction | **REFUTED — and the failure SET is byte-identical to the writer arm's** |
| the gate | **STOP: 6 of 8 reds NOT attributed**, and (b) forbids carrying any silently |

## MOVE (ii) — DELIVERED

Ten longhand copies of *"which contract does this week answer to?"* now go
through one owner, `src/rules/storedWeekDeclaration.ts`. Mechanical: every
caller asks the same question of the same candidates in the same order.

| gate | result |
|---|---|
| sweep, 156 suites | **2 failures — the control set EXACTLY**, 0 new / 0 fixed |
| `test:compile` | EXIT 0, no file regressed |
| full `test:bible` UNPIPED | `TRUE_EXIT=1` at `program-control-durable`, 1 FAIL — the declared red, same text |
| parity gate | 16/16, EXIT 0 |

**The census tape lives INSIDE the door**, so it is complete by construction once
the last longhand site is gone — not complete for the sites someone remembered
to instrument, which is the enumeration failure the ownership census's recording
Proxy existed to replace. Three worlds taped: 6,399 calls / 28 distinct
(reader|week|source) triples / 7 readers (parity); 146 / 17 / 7 (day-precedence);
6,136 / 50 / 8 (session-deletion).

**EXCLUDED AND STATED:** `section18ProgramObservation.resolveOverlaySection18Contract`
— its legacy-v1 migration rung sits BETWEEN the two stored candidates rather
than below them, so folding it into the door would be a behaviour change wearing
a refactor. Class B author doors and Class C hydration/shape sites stay, per the
census.

## MOVE (iii) — THE PRICE

The flip's entire behavioural content is behind `LFA_FLIP_DOOR=1`: the door stops
answering from the overlay declaration the write path authors, and the covering
microcycle's contract — which the deriver already treats as *"the identity to
derive FROM"* — answers instead. Priced before threading derivation inputs
through ten callers, deliberately.

World-identity preamble printed on both arms (`cwd`, `head=e97c9a49`,
`symbol=LFA_FLIP_DOOR files_with_symbol=1`, `arm=[LFA_FLIP_DOOR=1]`).

| arm | failures | vs control |
|---|---|---|
| **control** (move (ii) landed, flag off) | **2** | `program-control-durable`, `fixture-identity` |
| **the flip** (`LFA_FLIP_DOOR=1`) | **9** | 8 new, **`fixture-identity` FIXED** |

## THE PARITY WORLDS — BYTE-EQUAL, AND THE ENTRY RETIRES *PAID*

All three worlds report **`byte-equal`**, where the control reports *"every
difference declared"*. The ratchet cell then fails, correctly and by design:

```
FAIL every declared parity diff still happens — a paid one deletes
    a declared parity diff no longer happens in any world. The commit that
    turned it green owes the deletion of its entry — debt only ever moves down:
    stored_declaration_costs_mondays_power_row
      (expires when: the accepted week carries no stored `exposureContractV2`,
       so nothing at read can answer from it.)
```

**The entry's own `expiresWhen` is met on its own terms** — nothing at read can
answer from the stored declaration, because the door refuses it. Its deletion is
owed in the flip's commit.

### A CORRECTION TO THE SEAT'S (c), IN THE GOOD DIRECTION

(c) predicted the parity gate goes **vacuous** and the entry retires
**MOVED-not-PAID**. **Both are refuted by measurement.** The flip drops only the
DECLARATION rung; the overlay's `workoutsByDate` payload still exists, so the
gate keeps its left-hand side — 5, 7 and 5 materialised days across the three
worlds, and the gate's own non-vacuity assertion passes. The comparison still
exists, is still exercised, and is **byte-equal**. That is a diff that stopped
happening, which is the definition of PAID. The "MOVED-not-PAID" phrase (c)
ordered into the record does not apply and is **not** being written.

## THE MAIN FINDING — THE 8 REDS ARE ONE CLASS, NOT EIGHT MYSTERIES

The seat expected the 8-red writer arm to dissolve under the flip: *"those reds
priced a removal that no longer happens — measure, don't assume."*

**Measured. It did not dissolve. The failure SET is byte-identical to the leg (v)
writer arm's** (`R53_LEGV_WRITER_REPRICED_STOP_2026-08-07.md`, line 34):

```
accepted-state-transactions, athlete-session-deletion, illness-clear-game-week,
fact-horizon, derived-week-lawfulness, action-walker, action-walker:deep,
phase-structure
```

Same eight, same one fixed. Two *different mechanisms* — the writer arm stops
WRITING the declaration, the flip arm stops READING it — produce the same
failure set to the suite.

**So the 8 reds belong to neither the writer nor the reader migration. They
belong to the one property both arms share: THE STORED DECLARATION STOPS
ANSWERING AT READ.** That is a re-attribution of the whole class, and it means
the writer arm's diagnostic work carries over wholesale rather than needing to be
redone — which is the first genuinely cheap thing about this class in three
passes.

## THE EIGHT, ATTRIBUTED AS FAR AS THEY ARE

1. **`derived-week-lawfulness` — DECLARED DEBT, PRE-AUTHORISED AND PAYABLE NOW.**
   The ratchet demanding its own entry's deletion, as quoted above. Not a
   regression; it is the debt this move pays.
2. **`fact-horizon` — PREVIOUSLY ATTRIBUTED** (the one-owner boundary). Failure
   text re-read this pass and unchanged: *T4 — "illness_severe rewrote 2
   completed day(s)"*. Carried, not re-derived. **Note the standing caveat from
   the writer pass: that old attribution was explicitly recorded as NOT
   re-confirmed, so it is a carried claim, not a measurement.**
3. **`action-walker` — a ratchet working plus a harness cell** (writer-pass
   diagnosis, carried).
4. **`accepted-state-transactions`, `athlete-session-deletion`,
   `illness-clear-game-week`, `phase-structure`, `action-walker:deep` — NOT
   DIAGNOSED.** Counted and named, nothing more, in this pass or the writer's.

## THE STOP

Inbox item 1 (b) is explicit: *"any red is attributed before the flip lands, none
carried silently."* **Five are undiagnosed and one is a carried-not-re-confirmed
claim. So the flip does NOT land.** The scaffold is committed inert so the next
pass starts from a priced arm rather than re-measuring.

**(d) is NOT reached and V3 is NOT closed** — on (d)'s own terms, "the words only
if they support it". They do not, yet. What the measurements DO support, and what
is new today: the endpoint is reachable, the parity worlds go byte-equal, the
athlete's Monday power row comes back, and the eight reds are one class with one
cause rather than eight.

## WHAT IS MEASURED AND WHAT IS NOT

**MEASURED.** Move (ii) at 156 suites (control set exactly), `test:compile`, full
`test:bible` UNPIPED, the parity gate, and the census tape in three worlds. Move
(iii) at 156 suites under a world-identity-verified arm, plus the parity gate
under the same arm, plus the set-diff against the writer arm's recorded set.

**NOT MEASURED, and nothing here rests on it.** The 5 undiagnosed suites' failure
TEXT was not read this pass (only `illness-clear-game-week` and `fact-horizon`
were sampled). No device evidence. `validateLiveWeekOverlayWrite` has fired **0
times** in every world taped, and `current_microcycle` has **never** been the
answering source — for those two rungs move (ii)'s behaviour-identity rests on
code equivalence, not on a measured world. The flip arm drops the overlay rung
only; the door does not yet DERIVE in place, so "the accessor's implementation
switches to the deriver" is priced by its behavioural equivalent, not built.
