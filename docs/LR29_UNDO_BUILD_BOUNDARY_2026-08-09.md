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

---

# ADDENDUM — §4 CLOSED AND THE TOAST BUILT (2026-08-09, later)

Inbox item 1 (a)(b)(c). Rulings committed as authored first: `d60aecb8`.

## §4 — RULED (a), AND THE DECISION TURNED OUT TO BE ALREADY MADE

The seat ruled option (a), *"the mark becomes part of the decision"*. Measuring
it first found **the ruling already existed, for the sibling door, in the same
file, 160 lines above the offending line**:

> **A DELETION DOOR NEVER WRITES A CALENDAR MARK (Sam, 2026-07-30)** … *"there
> is no session here today" and "this is a rest day" are different claims.*

The MOVE door still did exactly what the deletion door was ruled out of. And
the emptiness was **already owned twice**: the constraint this same function
builds carries `wholeDayRestOwned`, and `rules/userRemovalConstraints` already
pushes the canonical rest stub for that shape — the mechanism installed when the
deletion ruling found that removing the mark ALONE put the derived G-1 session
straight back onto the cleared day.

**So the fix is a DELETION, not a replacement:** one of two representations
goes, the decision's vocabulary grows by nothing. That is option (a)'s intent
reached by the seat's own preferred mechanism (Elegant Solution Requirement —
prefer what removes representations).

```
ACTED   marks: (none in week)   — no mark written; the day still empties
UNDONE  week shape IDENTICAL to BEFORE, marks (none)
BOOTED  IDENTICAL — durable
both routes restore; probe non-vacuous
```

**Undo is COMPLETE for `move_session`, which it was not at `ca89ff7f`.**

## THE TOAST — undo's athlete-visible face

`rules/undoToast.ts` (pure model) · `components/UndoToast.tsx` ·
`rules/undoToastCopy.ts` (batch 29, PROPOSED) · mounted once on `HomeScreenV2`.

**IT READS THE LEDGER; NO DOOR RAISES IT.** `useHomeScreen` alone lands changes
at **ten** `executeProgramControlActionDurably` call sites. A toast raised at
each is ten places to forget and ten to word differently. Every landed decision
already appends exactly one ledger entry, so the toast is a READING — a door
gets its toast by existing. A coach-authored change would appear for free, which
is exactly why whether it SHOULD is parked (item (c)) rather than answered by a
missing wire.

**TRANSIENCE WITHOUT A CLOCK.** The first model compared `occurredAt` to now;
that is a device clock, and it raises a toast for a previous session's change if
the app relaunches quickly. It watches the newest undoable entry's IDENTITY
instead — same reason `lastUndoableEntry` picks by ledger order.

**ONE TAP IS ONE STEP.** After an undo the seen-marker is taken from the ledger
again, so it becomes the decision BEFORE the annulled one and the toast does not
re-offer what the undo uncovered. A toast that did would be a recent-changes
list reached one tap at a time — the thing Sam ruled against.

**THE WORDS ARE NOT MINE.** `phraseFor` is exported from `rules/journalChanges`
and reused, so the toast cannot grow a rival vocabulary; its `default: return
null` is the honest-outcome law, and cell [14] proves an unmapped kind shows
NOTHING rather than a code name. Only the frame (`"You"`) and the action
(`"Undo"`) are new, and both are PROPOSED.

## NOT COVERED — honestly

- **NO DEVICE EVIDENCE. DEPTH 0.** No cell mounts the toast; the fade, the
  6-second dwell, where it sits over the week and whether it covers anything are
  unverified by eye. **The whole surface is unseen.**
- **THE COPY GATES ARE GREEN AND THAT IS NOT EVIDENCE.** The extractor walks
  `screens`/`components`/`navigation` (`SURFACE_ROOTS`); the toast's strings live
  in `rules/`, so they are invisible to it and the ceiling did not move. This is
  the known ~150-string `utils`/`rules` gap, **declared rather than ridden** —
  batch 29 exists in the module and NOT on the sheet.
- **UNDO IS PROVEN COMPLETE FOR ONE DECISION KIND.** Every other kind may have
  its own non-ledger side-writer producing the identical symptom. `side-writer-
  outside-the-ledger` sighting 1; the compression rule is a CENSUS, not another
  per-kind fix.
- **The toast is mounted on `HomeScreenV2` only.** A change landed from
  `DayWorkoutScreenV2` appends its entry and raises the toast when the athlete
  returns — not where they were standing. Named, not fixed.
- **Item (c), undo of a coach-authored decision, is PARKED** to the coach
  kickoff as ordered. The mechanism does not read provenance, so it would
  currently offer one.
