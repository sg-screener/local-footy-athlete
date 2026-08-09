# LR-29 UNDO — THE TWO SCREEN-INDEPENDENT THIRDS, BUILT (2026-08-09)

Inbox item 1 (seat, 2026-08-09 evening). **No surface code**, per Sam's own
mock-first condition — the mock (`docs/UNDO_MOCK_2026-08-09.html`) is still
waiting on his four answers.

---

## THE HEADLINE — **UNDO IS DURABLE, AND IT IS NOT YET COMPLETE. BOTH ARE
## MEASURED, AND THE SECOND IS THE FINDING.**

```
[ledger-undo] target : dl-1 (plan_change)
[ledger-undo] OUTCOME: undone
UNDONE → BOOTED                     : IDENTICAL
did the change come BACK on boot?   : NO
ledger after boot                   : plan_change, reversal
```

The reversal producer lands, the boot honours it, and the annulled decision is
never replayed — **before or after a process death.** That is item (b)'s
question, and the answer is yes.

**And the undone week is not the pre-change week**, because the decision was
not the only thing the change wrote.

## WHAT WAS BUILT

| piece | file | what it is |
|---|---|---|
| the filter | `rules/decisionLedgerReplay.ts` | one pure function deciding what a replay replays |
| the producer | `store/undoLastDecision.ts` | append a `reversal`, re-derive. Two statements. |
| the honouring | `quiescentBoot.ts` | the early return finally has its producer |
| the gate | `test:undo-reversal`, 10 cells | **5 mutations, 5 red** |

**ZERO NEW STORED STATE.** An undo is one appended decision; the week is
derived. **North star: TOWARD** — the reversal was already in the vocabulary,
and this makes the vocabulary mean something instead of adding to it.

**THE TWO PLACES UNDO MEANS SOMETHING ARE ONE FILTER.** The moment the athlete
taps (`settleDerivedWorldAfterDecision`) and every relaunch (`rebuildDerivedWorld`)
were already one body; the replay SET is now decided in a function neither
owns, so they cannot drift. Cell [8] fails if the boot grows its own opinion.

## THE FINDING — **A DECISION IS NOT THE ONLY THING A DECISION WRITES**

Measured, not suspected. `npm run tape:lr29-undo-durability`:

```
BEFORE  08-08: Lower Hinge  08-09: —        calendar marks: (none in week)
ACTED   08-08: —            08-09: Hinge    calendar marks: 2026-08-08:rest
UNDONE  08-08: —            08-09: Hinge    calendar marks: 2026-08-08:rest
BOOTED  08-08: —            08-09: Hinge    calendar marks: 2026-08-08:rest
```

**A `move_session` writes a calendar `rest` mark on the source day.** That mark
is not a ledger decision. Annul + re-derive removes the decision and the mark
stays — so Friday stays empty, the session stays on Saturday, and the athlete's
undo visibly did not undo.

This is the dependency list's §3 fork arriving in the athlete's most visible
feature: *"the replay's input set is the ledger PLUS the fact stores."* It was
predicted as an architecture note; it is now a reproducible symptom.

**AND THE BOOT-ORDER RULING ALREADY SAYS SO, in its own words** —
`quiescentBoot.ts`: *"`rest` marks are NOT fixture marks and are left
untouched. They are carried by their own doors."* That was correct for its
question and is exactly what makes undo incomplete for this one.

### IT IS NOT PATCHED HERE, deliberately

Making the undo door reach into the calendar store would give the mark a second
owner and put a per-decision-kind special case in the one door that must stay
kind-agnostic. That is the move CLAUDE.md names. **§4 is the ruling it needs.**

## THE CONTROL THAT MAKES THE FINDING BELIEVABLE

Every verdict compares a re-derived week against the generated one, and that is
only about undo if a re-derivation with NOTHING to undo reproduces it. So the
tape relaunches on an **empty ledger** first:

```
[control] does a boot with NO decisions reproduce the generated week? YES
```

**The boot is faithful.** Had it not been, a perfect undo would have looked
broken and this report would have blamed the wrong layer.

## A CORRECTION TO THE FIFTY-SECOND PASS, AND IT IS NOT SMALL

That pass reported the Coach Notes snapshot route REFUSING (`safely-rejected`,
`maximum_breach`) and drew a route-asymmetry finding from it. **The refusal is
real and reproducible — and it is world-dependent in a way the pass did not
say.** It happens in a freshly generated and committed world (revision 3). Ask
the same route on a world that has BOOTED once — which is every world an
athlete ever opens — and it returns `restored` and puts the week back.

So the corrected claim: **`acceptedStateTransaction.ts:509`'s forward-only
asymmetry is real in the source and was demonstrated in a world an athlete
would rarely be in.** It remains a reason to prefer the ledger route; it is no
longer evidence that the athlete's existing undo is broken. **The previous
report over-reached and this one says so.**

`a ruling premise is a claim too` — **applied to my own report this time.**

## THE VACUITY THE FIRST SEQUENCE SHIPPED, CAUGHT BEFORE IT WAS REPORTED

The first ordering asked the snapshot route first. It succeeded, put the week
back, and the ledger undo then ran against an already-restored week — so
*"the ledger route restored the week: YES"* was true and meaningless in the same
breath. Each route now gets a world it actually has to change, and the second
act runs on the booted world. **Item 1's lesson, second application, this time
caught by reading the sequence rather than by a red cell.**

## THE THREE LOOSE THREADS FROM THE PRE-CONTROL RUN — SETTLED

Item (c). None survives.

1. *"the boot logged the move's replay `refused`"* — the world had a live
   `rest` mark and an already-applied effect; the replayed move found its own
   target occupied. Not a defect of the replay: the same shape the fixture
   boot-order ruling names, and it does not occur in the controlled sequence.
2. *"zero reversible adjustments where one was active"* — **expected and
   correct.** `rebuildDerivedWorld` wipes the adjustment ledger by design
   (`quiescentBoot.ts:354`): the record is a derived output, rebuilt by replay.
   An adjustment for an annulled decision SHOULD be gone.
3. *"a week matching neither photograph"* — the same calendar `rest` mark,
   which is now §4's subject. **It was the finding, seen before it was
   understood.**

## §4 — THE RULING THIS BUILD NEEDS BEFORE THE NEXT ONE

**Who owns a calendar mark that a program decision caused?** Three routes, and
the seat should put them to Sam as lettered options:

- **(a) The mark becomes part of the decision.** `move_session` already carries
  `fromDate`/`toDate`; the replay could re-author the mark from the decision it
  belongs to. Removes a representation. Biggest change, best end state.
- **(b) The mark is DERIVED, not stored.** "This day is rest" is arguably a
  reading of the week, not a fact about it. Deepest, and touches doors well
  outside undo.
- **(c) The undo door cascades to fact stores.** Cheapest, and the one this
  repo's own rules argue against — a second owner and a per-kind special case.

**RECOMMENDED: (a).** It is the only one that keeps undo kind-agnostic while
leaving the calendar's other doors alone. **Not decided here.**

## WHAT IS DELIBERATELY NOT DONE

**The order's (a) asked for ONE producer behind TWO doors** — the undo button
and `clearReversibleAdjustment`. The second door is **NOT re-pointed, and it is
a STOP with a reason rather than an omission.**

The snapshot route carries `displacedOriginalState.calendarFacts`, so it CAN
put the `rest` mark back. The ledger route cannot, until §4 is ruled.
**Re-pointing it today would trade a complete-but-brittle undo for a
robust-but-incomplete one, and the athlete would lose material they currently
get back.** `athleteSessionMoveTests` cell 21 is re-aimed to pin the two routes
as separate and to red on the day somebody unifies them.

## NOT COVERED — honestly

- **NO SURFACE. No button, no bar, no sheet.** Mock-first, per Sam's condition.
- **ONE decision kind measured end to end (`move_session`).** `fixture_add`,
  `fixture_remove`, `fixture_move` and the other `plan_change` kinds are
  covered by the filter's unit cells and by NO world-level run. **A different
  kind may have its own non-ledger writer, and this report cannot say it does
  not.**
- **`undoLastDecision` has no product caller yet** — the door exists, the tape
  drives it, no screen does. That is the mock-first boundary, and it also means
  **no device evidence, DEPTH 0.**
- **Undo of a COACH-authored decision is untested.** The ledger records
  provenance but the door does not read it, and whether an athlete may undo a
  coach's change is a design question nobody has asked.
- The `maximum_breach` in `2026-07-27` is still not traced to a cause.
