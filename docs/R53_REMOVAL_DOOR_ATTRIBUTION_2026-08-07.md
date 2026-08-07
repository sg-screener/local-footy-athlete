# R5.3 — THE REMOVAL-DECISION GAP, ATTRIBUTED FROM THE WRITE SIDE (2026-08-07)

# **NO DOOR FAILS TO APPEND. THE 159 ARE 40 ROWS FROM 23 DECISIONS, EVERY ONE ALREADY RECORDED AS A TYPED DECISION — AND THE LINK IS EMPTY BECAUSE IT IS COMPUTED BEFORE THE REDUCTION EXISTS.**

LOOP CHECK: **a-count-taken-for-a-record** — this is the third sighting of the
same shape in this unit (`a-red-count-is-a-claim`, the harness `tail -3` batch,
and now a per-store-write occurrence total read as a count of decisions). Under
the loop-audit law that is a MANDATORY AUDIT, and the compression is proposed at
the end of this report rather than left for a fourth run.

Twenty-third pass. Answers inbox item 1 (a), and reaches (c). **NOTHING BUILT
into the branch.** The tape is flag-gated on a scratch branch, inert by default.

---

## THE ORDER, AND WHAT IT ASSUMED

> *(a) ATTRIBUTE FIRST, one run: which door(s)/path(s) produced the 159
> unrecorded removal decisions in the acted worlds — tape the WRITE side of
> those removals the same way. Name the door.*

The order's own framing — "a removal class R2's extraction MISSED plus (likely)
a door still writing removals without appending" — is a premise, and
`a-ruling-premise-is-a-claim-too` applies to it exactly as it applied to mine.
So the tape re-derives the read side's number instead of inheriting it.

**Method.** A tape on the same store seam the replay bind used. At the store
write where an unrecorded removal reduction FIRST enters an overlay it captures
the calling frames. No code reading, no contract diffing: a door that writes a
removal has to be on that stack. Plus a second tape at the link computation
itself (`decisionDerivedLinkedReductions`), because only that call can say what
it saw when it looked.

**Coverage.** All **156 suites**, through `scripts/sweep.sh` so one red cannot
truncate the run — which it otherwise would have: a plain `test:bible` stopped
at suite 81. 83 suite processes produced records; **5 produced sightings**.
Branch failure set measured in the same pass: **2 of 156**
(`test:program-control-durable`, `test:fixture-identity`) — exactly the set
`docs/NOW.md` already declares, so nothing new is red.

---

## CORRECTION 1 — **THE 159 IS AN OCCURRENCE COUNT, NOT A COUNT OF DECISIONS**

The replay bind compared on **every store write**. A single unrecorded reduction
that survives N writes is counted N times. Measured on the same axis, both ways:

| axis | count |
|---|---|
| occurrences, the replay bind's own unit | **330** |
| distinct (week, metric, reason, targets, identity) | **40** |
| distinct removal DECISIONS (deletion identities) | **23** |

The read side's 159 and this run's 317 `ledgerIdentityAbsent` occurrences are the
same measurement in the same unit, ± the world (the bind ran on
`scratch/r53-legv-replay`, which carries other scaffolds; this ran on the branch).
**The instruments agree. What was wrong was the noun.** "159 athlete-removal
decisions the ledger does not record" is **40 reduction rows authored by 23
removal decisions** — one removal lowers several metrics, and each lowered metric
is its own row. The order of magnitude matters: this is a bounded, nameable set,
not a systemic loss of the athlete's history.

## CORRECTION 2 — **"ABSENT" WAS ASKED OF THE WEEK, NOT OF THE LEDGER**

The bind's `identityAbsent` test looked only at linked reductions whose
`weekStart` matched the week under comparison. An identity the ledger records for
another week fails that test while being perfectly well recorded. Split properly:

| class | occurrences | distinct |
|---|---|---|
| `ledgerIdentityAbsent` — recorded nowhere in the ledger | 317 | **39** |
| `valueDrift` — recorded, different targets | 13 | 1 |
| `otherWeekOnly` / `clearedOnly` | 0 | 0 |

---

## (a) THE ANSWER — **EVERY SIGHTING HAS A CLAIMING ADJUSTMENT. ZERO DOORS FAIL TO APPEND.**

| cause | distinct |
|---|---|
| `emptyLink` — an adjustment DOES claim the constraint id, its `linkedTypedReductions` does not carry the reduction | **40** |
| `noAdjustment` — no adjustment claims the constraint at all | **0** |
| `clearedOnly` | 0 |

**The premise that a door writes removals without appending is REFUTED.** In
every one of the 40, the door appended, the ledger claims the constraint, and
39 of 40 still hold the decision in the removal-constraint surface
(`userRemovalConstraints` — a persisted INPUT, not an output).

**And the link looked in the right place.** For **40 of 40**, the sighting's week
IS in the claiming adjustment's `rollingDependencyWeeks`. The "wrong week set"
hypothesis — mine — is refuted by its own measurement.

### The doors, ranked (full captured chains, innermost frame first)

| n | chain | door |
|---|---|---|
| 16 | `acceptedStateTransaction:837` ← `:1459` ← `weekRebuild:902` ← `:569` ← `:727` | the **fixture week-overlay rebuild** (`rebuildLocalWeek`, scope `weekOverlay`) — and it names no removal constraint, see mechanism 2 |
| 8 | `:837` ← `:3371` ← `planChangeProducer:2676` | **`commitAthleteSessionMoveTransaction`** |
| 5 | `:837` ← `temporarySourceFactTransaction:608/882` ← `coachMutationTransaction:233/857` | the **coach mutation / temporary-fact** path |
| 4+4 | `:837` ← `:3291` ← `planChangeProducer:2718` / `:2830` | **`commitAthleteSessionDeletionTransaction`** (two producer routes) |
| 2 | `:837` ← `:2450` ← `:2361` ← `calendarStore:53/164` | the calendar-mark path (walker-driven) |
| 1 | `:837` ← `:3564` ← `planChangeProducer:2775` | **`commitAthleteSessionAdditionTransaction`** |

`acceptedStateTransaction.ts:837` is the store publish itself and is the seam on
every chain, not a door — recorded so the innermost frame is never mistaken for
the attribution.

**The read side's offered candidate is CONFIRMED as one producer of five:**
`temporarySourceFactTransaction` (the report offered `:376`'s unconditional
`linkedTypedReductions: []` "as a candidate only, not taped on the failing
path"). It is now taped on the failing path — 5 of 40, third-largest, not the
root.

### Claiming adjustment kind, and metric

| kind | n |  | metric | n |
|---|---|---|---|---|
| `session_add` | 16 | | `strength_pattern_count` | 15 |
| `session_delete` | 10 | | `main_strength_frequency` | 14 |
| `session_move` | 8 | | `conditioning_core_frequency` | 8 |
| `session_component_delete` | 6 | | `sprint_high_speed_frequency` | 3 |

---

## THE MECHANISM — measured at the link's own call

`decisionDerivedLinkedReductions` computes the link by walking
`rollingDependencyWeeks` and asking the **DERIVED** contract for each week which
reductions the constraint owns. Taped at that call (action walker):

| measure | value |
|---|---|
| calls | 568 |
| calls with constraint ids | 568 |
| weeks walked | 568 |
| derived contract was null | **0** |
| reductions actually linked | 163 |

**MY FIRST READING OF THIS WAS WRONG AND ITS OWN MEASUREMENT KILLED IT.** From
the aggregate alone ("470 of 568 week-walks found no owned reduction") I
concluded the deriver could not reproduce the reduction — census item 5 restated
at the write side. The per-week join refutes that outright:

| at the moment the link is computed | weeks |
|---|---|
| **stored carries an owned reduction, derived does not** | **0** |
| both carry it | 96 |
| derived carries it, stored does not | 2 |
| neither carries it | 470 |

**Zero.** Not once in 568 walks does the stored contract hold a reduction the
deriver misses. The 470 are ordinary rolling-horizon weeks the constraint does
not speak for. So the link is not defeated by the deriver — **at the moment it
runs, the reduction does not exist in either contract.**

### And a SECOND mechanism, which the same tape found by asking about its own gap

`decisionDerivedLinkedReductions` returns `[]` immediately when the door named no
removal constraint, so those calls never appear in the 568 above. Taped at that
early return:

| | n |
|---|---|
| **calls skipped — the door named no constraint id, no link attempted** | **59** |
| weeks that therefore went unwalked | 66 |

The largest door in the attribution is one of these. The fixture week-overlay
rebuild (`weekRebuild.ts:577`) passes `linkedConstraintIds` but **never**
`linkedUserRemovalConstraintIds` — so a week-overlay rebuild that republishes the
week carrying the athlete's existing removals forward records none of them. Its
adjustment is real, appended and reversible; its typed-reduction link is empty by
construction.

### The mechanism, as the record states it

The link is computed while the transaction is **STAGED**. The reduction is
materialised into the stored overlay when it **COMMITS** — downstream, and after
the link has already been written. **The link is computed before the thing it is
meant to link exists.** This is the materialisation hop this unit already named
from the other side (`docs/R53_TAPE_DROP_HOP_NAMED_2026-08-07.md`: the payload is
materialised inside `commitAcceptedStateTransaction`, gated on the proposed
overlay's `exposureContractV2`), now reached independently from the write side.

That is an ORDERING defect, not a missing decision and not a deriver limit —
which is a materially different thing to fix from what the order assumed.

**So the 40 have two mechanisms, neither of them a door failing to append:**

1. **The link runs too early.** The decision's own adjustment computes its link
   while staged; the reduction is materialised at commit. 0 of 568 weeks show the
   deriver falling short of the stored copy, so timing is what is left.
2. **The link is never attempted.** 59 adjustment creations name no removal
   constraint, so no later republication of the week repairs (1) either — most
   visibly the fixture week-overlay rebuild, the single largest door at 16 of 40.

---

## (c) THE STOP CONDITION IS **NOT** TRIPPED

> *(c) if any of the 159 cannot be expressed as an EXISTING typed decision …
> STOP with that shape named; new decision vocabulary is Sam's to sign.*

Asked of the record, not of the code. At every sighting the decision ledger was
read and searched for a `plan_change` on the removal's own date:

| | n |
|---|---|
| sighting has a same-date `plan_change` on the decision ledger | **37 / 40** |
| sighting has nothing for that date | **3** |

`remove_session`, `move_session` and `add_template` are existing members of
`AthleteDecision`/`PlanChange`, and `planChangeProducer.ts:2397` appends one on
every landed plan change. **No new decision vocabulary is required, so the stop
does not fire.** A date match is evidence the SHAPE exists, not proof that a
given entry is the one — stated as the former.

**The 3 that find nothing are reported rather than rounded away.** All three are
in the deep walker, whose later scenarios reach some removals through direct
transaction calls rather than through `applyPlanChange`, so an absent entry there
says something about that world's route, not about whether the shape exists.
They do not trip (c) — (c) asks whether a removal CAN be expressed, and these can
be, in the same `plan_change` the other 37 carry. But they are three worlds where
a removal landed and the decision ledger did not hear about it, and that is worth
a look on its own terms.

---

## (b) — ITS PREMISE DOES NOT SURVIVE THE MEASUREMENT

The ruling pre-ruled a two-half fix. Against what the write side shows:

- **(b)(i) "the door appends"** — already true. 0 of 40 lack an append; the
  R1 doors-append law is gated by `test:door-ledger-append` and holds.
- **(b)(ii) "an R2-style one-time extraction lifts existing stored reductions
  into typed ledger decisions"** — the decisions are already there. What is
  missing is a row in `linkedTypedReductions`, which is **a stored mirror of
  derived arithmetic inside the reversible-adjustment ledger, not an input**.
  Filling it in is extending a stored-output surface: the north star's
  presumed-wrong case, and the exact shape R5 exists to retire. The extraction
  shape already exists for migration
  (`reversibleAdjustmentLedger.ts:413 legacyLinkedTypedReductions`) and scans
  contracts by identity, so building it live would install a second, live
  copy of the thing being retired.

With the mechanism corrected, a third option appears that the order could not
have named: **the link is computed at the wrong moment.** Moving it after the
materialisation would fill the mirror without any extraction at all. That is the
cheap fix, and it is worth stating plainly that it is *available* — and equally
plainly that it buys a more complete stored copy of derived arithmetic.

The convergence answer this unit owes: **filling the mirror, by any of the three
routes, moves AWAY from "store decisions, derive everything else."** The deriver
already owns this arithmetic — `derivedWeekContract.ts:162 withRemovalLedger`
applies `applyAthleteRemovalTypedReduction` from the persisted constraints, the
app's one owner of what a removal does to a contract, and the join above shows it
is not the limiting factor (0 of 568 weeks where it fell short of the stored
copy). The direction that converges is to make the reduction stack **derive from
the removal decisions** and retire `linkedTypedReductions`, not to complete it.

That is a design call and this report does not take it. **It goes back to the
seat as the pre-ruled design question, with the premise corrected and a third
option on the table.**

---

## CONTROLS

- **Positive controls, pooled over 156 suites:** 4,450 store writes, 2,567 weeks
  compared, 3,691 stored reductions seen, 1,043 decision reductions seen, 6,386
  adjustments, 1,391 linked reductions, 4,210 constraints. No zero above is a
  bare zero.
- **`noAdjustment = 0` IS A MEASURED ZERO, NOT A BARE ONE.** The control arm
  (`LFA_REMOVAL_DOOR_MUTATE=drop_claims`) blinds the claim side and re-runs the
  same five suites: the same **40** rows, the same 39/1 class split, and the
  cause flips to **`noAdjustment` 40 / 40**. The classifier can produce the value
  it never produced in the real arm, so its absence there is a result.
- **The 5-suite witness batch reproduces the 156-suite sweep exactly** — 330
  occurrences, 40 distinct, 39/1, 40/40 `emptyLink`. Those five ARE the complete
  producing set, and a re-run is cheap.
- **The tape is behaviour-preserving:** `test:program-control-durable` exits 1
  with the tape on and with it off, identically; the sweep's failure set is the
  declared 2 of 156.
- **World identity printed** by the sweep preamble on every arm (cwd, HEAD,
  symbol present), per the harness-lies compression.
- **`test:compile` EXIT 0** with the scaffold in place — no file regressed
  against the typecheck baseline.

---

## LOOP AUDIT — third sighting of **a-count-taken-for-a-record**

Required by `docs/SEAT_LOOP_AUDIT_LAW_2026-08-07.md`: at three, propose the
compression rather than run it a fourth time.

**What repeated.** A number produced by an instrument was carried into a ruling
as if it counted the thing it was named after.
1. `a-red-count-is-a-claim` — "3 red both sides" hid one cell improving and two
   regressing.
2. harness-lies sighting 5 — a `tail -3` totals line reported six-for-six green
   while four suites exited 1.
3. **this pass** — "159 athlete-removal DECISIONS the ledger does not record"
   was 330 per-store-write occurrences of 40 rows from 23 decisions, and the
   word "absent" meant absent-from-this-week, not absent-from-the-ledger.

**What each cost.** Sighting 1: a day. Sighting 2: a withdrawn claim and a
re-run. Sighting 3: a full ruling — (b)(i), (b)(ii) and (c) were all written
against a premise the write side does not support, and building them as written
would have appended decisions that already exist and extended a stored-output
mirror this unit exists to retire.

**What stayed invariant — this sentence is the standing rule:**

> **A number reported by an instrument names the instrument's unit, not the
> domain noun. Before a count enters a ruling, state its unit and its
> denominator, and give the distinct count of the domain object beside it.**

**What still varies — the stop-conditions.** A count may enter a ruling
un-restated when it is already expressed in the domain object's own unit and the
instrument's dedup key is that object's identity. When either is unclear, the
number is an occurrence count until proven otherwise.

**Smallest structural change.** The three reporting instruments in this unit
(`reductionReplayEquality`, `declarationCensus`, `removalDoorTape`) all emit
`control` blocks already. The compression is one convention, not new machinery:
**every `results` counter emits as a pair — occurrences and distinct — with the
dedup key named in the field.** This tape now does that (`occurrences` vs
`results.distinct` vs `results.distinctIdentities`), and it is what turned the
159 back into 23. Proposed as the standing shape for any future tape.

## NOT COVERED

- **The ordering mechanism is established by elimination, not by a direct tape of
  the materialising write.** The join proves the reduction is in neither contract
  when the link runs, and the stored overlay carries it moments later; the
  commit-time materialisation is the hop already named from the other side. A
  tape ON that write, showing the same identity appearing, would close it
  outright and has not been run.
- **Distinct DECISIONS (23)** is summed per suite process, so a decision reached
  by two processes could be counted twice. It is an upper bound on 23, not an
  exact figure; the direction of the correction (159 → tens) is unaffected.
- The **1 sighting whose constraint is absent** from the removal surface is
  unexplained, and the **1 `valueDrift`** row is not diagnosed.
- The **20 "replay invents a reduction"** cases from the read side remain
  unattributed; this tape does not look at that direction.
- `session_add` claiming a removal constraint (16 of 40, the largest kind) is
  recorded, not explained.
- **No device evidence.** Nothing has changed on Sam's phone.
- The tape touches `acceptedStateTransaction.ts` and `weekRebuild.ts` and is
  scaffold — it must be stripped before any product landing, like the other
  three instruments.
