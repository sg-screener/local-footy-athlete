# R5.3 — LEG (v)'s WRITER, RE-PRICED AGAINST THE CURRENT BRANCH (2026-08-07)

# **8 NEW REDS, 1 FIXED. THE READ HALVES DID NOT PAY THE WRITER'S PRICE — AND THE MEASUREMENTS DO NOT SUPPORT CLOSING V3.**

Twenty-fifth pass, continuing under (d). **NOTHING BUILT into the branch from
the writer arm** — the scaffold is flag-gated on
`scratch/r53-legv-writer-reprice` (`ec490090`). Two harness fixes DID land,
because pricing found them and they are defects either way.

---

## WHY RE-PRICE AT ALL

The recorded price — *writer-alone 11 reds, unit 9 of 156* — was measured
before the read half landed (`8ca5ae24`) and before reduction ownership derived
(`08212473`). **That world no longer exists**, so the number was not a claim
about this one. The seat's own compression ("the readers derive, THEN the writer
stops") predicts the writer should get cheaper. It is worth knowing whether it
did.

**Control:** the branch itself, `2 of 156` (`program-control-durable`,
`fixture-identity`).
**Arm:** `LFA_SCAFFOLD_LEGV_WRITER=1`, both publication sites together, whole
bible through `scripts/sweep.sh`.

## THE PRICE

**`SWEEP RESULT: failures=9 of 156`.** Diffed as a SET, not as a total:

| | suite |
|---|---|
| **FIXED (1)** | `test:fixture-identity` — **the prize, exactly as the declared debt entry predicted** ("with it retired, `test:fixture-identity` is 6/6 and this diff is gone") |
| carried | `test:program-control-durable` (the branch's other declared red, unmoved) |
| **NEW (8)** | `accepted-state-transactions`, `athlete-session-deletion`, `illness-clear-game-week`, `fact-horizon`, `derived-week-lawfulness`, `action-walker`, `action-walker:deep`, `phase-structure` |

**8 new, 1 fixed.** Against the previously recorded "unit 9", this is the same
order. **The read halves were free AND they did not pay the writer down.** That
is the honest answer to the compression's implicit promise: deriving first buys
correctness of shape, not a cheaper writer.

## WHAT THE NEW REDS ARE — text diffed, not counted

Classified as far as this pass took them:

1. **`derived-week-lawfulness` — DECLARED DEBT, PRE-AUTHORISED.** Its parity
   gate carries its own non-vacuity assertion: *"a world whose stored overlay
   carries no payload at all would pass byte-equality by having nothing to
   disagree about."* With the writer retired there is no materialised week, so
   the gate correctly refuses to measure. Its declared entry already says
   `expiresWhen: the accepted week carries no stored exposureContractV2`. **This
   red IS the expiry firing.**
2. **`action-walker` — a RATCHET WORKING, plus my own cell.** Two distinct
   cells: *"every declared red still reds — stale debt fails, it does not expire
   quietly"* fires because a declared red
   (`session_list_calls_a_conditioning_day_recovery`) stops redding in the arm —
   the second pre-authorised deletion. And my new Restore cell, which is dealt
   with below.
3. **`athlete-session-deletion`, `accepted-state-transactions`,
   `illness-clear-game-week`, `fact-horizon`, `phase-structure`,
   `action-walker:deep` — NOT DIAGNOSED IN THIS PASS.** They are counted and
   named, nothing more. `fact-horizon` was previously attributed to the
   one-owner boundary; whether that still holds is not re-established here and I
   am not carrying the old attribution forward as if it were.

---

## THE PRICING FOUND TWO DEFECTS IN WORK I HAD JUST LANDED

Both in the Restore cell from `08212473`. **Neither could red on the branch** —
they only appear once the writer stops, which is why the arm found them and the
gate did not.

1. **The cell read the STORED DECLARATION.** It located its reduction through
   `weekScopedOverlays[…].exposureContractV2` — the exact surface leg (v)
   retires — and so reported *"the walked world authored no reduction"* about a
   world that had authored one. **A cell that reds when its own unit lands is
   measuring the storage, not the app.** Fixed to read the DERIVED contract
   first with the stored payload as fallback: the correction the deletion suite
   had already made for its own fixture (`athleteSessionDeletionTests.ts:418`).
2. **It undid a superseded decision.** It restored the reduction's own
   adjustment, which a later removal in the same loop had superseded; the door
   answered `superseded` and nothing was compared. It now undoes newest-first,
   which is what an athlete does and what the ledger permits.

Both fixes LANDED on the branch (`151030d4`) — action walker 22/22. They are
improvements independent of leg (v).

## AND A THIRD FINDING, WHICH IS THE ONE THAT MATTERS

With the fixes in, the cell still reds **in the writer arm only**, and its
message is the finding:

> every ownership comparison during these Restores had an EMPTY owned set

Measured at the bind, writer arm: **7 consumer calls, 7 contract reduction rows
seen, `derivedTotal` 0, `storedTotal` 0, `divergent` 0.**

Read that carefully, because it says two things and only one of them is
comfortable:

- **My derivation is SAFE in both arms.** Derived and stored agree — 0
  divergent — with the writer on and with it off. Nothing in the unit landed at
  `08212473` breaks when the writer retires.
- **But with the writer retired, the restoration path's typed-reduction
  ownership goes VACUOUS.** The contracts the Restore consumers manipulate carry
  reduction rows, and *none* of them is owned by the adjustment being undone, on
  either method. Restore stops having typed reductions to reverse — not because
  the derivation lost them, but because the contracts it works on
  (`beforeExposureContract` from displaced state, and an overlay that no longer
  declares one) are not the derived contract the athlete sees.

**That is the seat's own earlier STOP, reached from a new direction:**
*"retiring the declaration without reproducing the stack changes what a Restore
does — that is a decision payload."* The read half made the VISIBLE week derive.
It did not make the RESTORE path derive, and the restore path is where the
athlete's undo lives.

---

## THIS IS A STOP, ON (d)'s OWN TERMS

The ruling ends: *"the pre-ruled run home resumes unchanged through parity
expiry, condition 1, cells 5/6 re-pin, **and the words only if the measurements
support them**."*

The measurements do not support them. **V3 is not closed and I am not saying it
is.** Landing the writer today would ship 8 new red suites, two of which are
pre-authorised debt and six of which are undiagnosed, and would leave Restore
with no typed reduction to reverse.

**What I would want ruled before the next step**, stated as questions rather
than as a design I have chosen:

1. Does the restoration path get the same treatment the visible week got — i.e.
   should `displacedOriginalState.beforeExposureContract` and the overlay read
   at Restore become DERIVED reads? That is the fourth consumer, and this pass
   is the first measurement that names it.
2. Are the two pre-authorised deletions (the parity-gate entry and the declared
   red) to be taken NOW, ahead of the writer, so the arm's price drops to 6 and
   the remaining set is all genuinely undiagnosed?
3. Do the six undiagnosed reds get attributed before the writer lands, or is the
   writer landed with them declared? The recorded precedent is attribution
   first.

## NOT COVERED

- **Six of the eight new reds are named and NOT diagnosed.** No failure text
  beyond `action-walker`'s was read in this pass.
- The vacuity finding rests on ONE world (the walker's) at 7 consumer calls. It
  is a strong signal and a narrow one.
- The old attribution of `fact-horizon` to the one-owner boundary is **not**
  re-established; it is not carried forward.
- The writer scaffold touches two publication sites only. Whether those are
  still the complete set of declaration writers on the current branch was not
  re-censused this pass.
- **No device evidence.** Nothing has changed on Sam's phone.
