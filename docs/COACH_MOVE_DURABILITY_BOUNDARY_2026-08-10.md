# COACH MOVE DURABILITY — THE DOOR RAN, AND IT HAD NEVER RUN

**Unit:** SEAT INBOX 2026-08-10, items 1, 2 and 3.
**Tape:** `npm run tape:coach-move-durability`
**Gate:** `test:coach-tab-slice3` section [7].

---

## ONE LINE

**The coach's move did not land.** The tape the seat ordered was built, run, and
on its first run it measured the athlete's own tap moving the week and recording
a `plan_change` while the coach's identical move — same world, same two days,
same door, same run — returned `ok: false` and changed nothing. **Every free
claim downstream of it was vacuous rather than false: there was nothing to
record, nothing to undo, and nothing to survive the night.** The cause is one
argument. It is fixed, the tape now reports the two arms byte-for-byte identical
through a relaunch, and undo unwinds a coach-landed move and stays unwound.

---

## §1 — WHAT THE TAPE FOUND, IN THE ORDER IT FOUND IT

### (a) THE COACH'S MOVE NEVER RAN

`CoachTabScreen.handleConfirm` called the door as:

```ts
executeProgramControlActionDurably(action, { todayISO })
```

and `executePlanChangeAction` — which every plan-change action reaches — opens
with:

```ts
if (!context.visibleWeek || !context.todayISO) {
  return fallbackResult(action, { route: 'guided_follow_up_sheet', … },
    'Cannot safely apply this day/session action without the current visible week.');
}
```

So the coach proposed correctly, drew the card correctly, took the athlete's yes
— **and the door refused the call before it looked at the action.**

The measurement, one run, one world:

| | coach arm | athlete's tap (control) |
|---|---|---|
| door `ok` | `false` | `true` |
| door `outcome` | *(none)* | `applied` |
| week moved | **NO** | **YES** |
| ledger | `[]` | `[plan_change]` |

### (b) AND THE ATHLETE WAS SHOWN THE DEVELOPER'S SENTENCE

`coachChangeOutcome` speaks the door's refusal verbatim, by design and for a
good reason — the door owns why it refused, and a paraphrase would be a second
account of one refusal. But the sentence above was never addressed to an
athlete. **The coach said, out loud, to Sam's face: *"Cannot safely apply this
day/session action without the current visible week."***

That is a second defect and it survives the first one's fix, because the first
one's fix only removes today's way of reaching it.

### (c) THE TRUTH GATE WAS NOT AT FAULT AND DID NOT FIRE

Worth recording, because it looks like a gate failure and is not. The coach
refused; it did not claim a move it had not made. `FORBIDDEN_WHEN_NO_APPLIED`
guards the coach's MOUTH and the mouth was honest. **The failure was upstream of
everything slice 3 gated.**

---

## §2 — WHY SLICE 3's 116 CELLS WERE ALL GREEN THROUGH THIS

This is the part worth carrying forward, and it is not "we needed more cells".

Slice 3's [5] proves the coach's OUTPUT is a `ProgramControlAction` on the
allow-list. Its [6] proves `move_session` reaches `applyPlanChange` and that
`applyPlanChange` appends a `plan_change`. Both readings are TRUE, and they were
true while the coach's move was dead.

**Every one of them is a claim about a function. The defect was in an
ARGUMENT.** A suite that reads "the right function is called" is blind, by
construction, to "it is called with what it needs" — and the door's context is
optional (`visibleWeek?: ResolvedDay[]`), so forgetting it is a runtime sentence
rather than a compile error.

That is the general shape, and it is L12's answer for this class:

> **A call site proven to exist is not a call site proven to be correct. When a
> door takes an optional context that changes whether it acts at all, the cell
> that names the door must also name the ARGUMENTS — or a tape must run it.**

---

## §3 — THE FIX, AND THE OPTION THAT WAS REJECTED

CLAUDE.md's elegant-solution requirement: two options, compared before coding.

**OPTION A (taken) — the screen hands the door the week it is already holding.**
`useResolvedWeek()` returns `{ weekDays, visibleWeek }` from ONE
`projectWeekFor(monday, state)` call: `weekDays` is `ResolvedDay[]`, and
`visibleWeek` is `project()` **over that same array**. The screen destructured
half of one derivation. It now destructures both and passes `weekDays` — the
identical argument `PlanChangeSheet` passes at the identical door.

Zero new representations, zero new state, no guard, no fallback, no resolver.
It is the approved reassessment's own ruling (*"the athlete's own door executes
it"*) wired rather than re-argued.

**OPTION B (rejected) — the door derives the week itself.** It could: the
imperative schedule state is reachable from `utils/`. That would delete the
argument and make the whole class unrepresentable, which is a real attraction.

**It is rejected for a reason worth writing down: the caller's week is not
always the app's week.** The Program tab navigates — an athlete can be looking
at last week. A door that re-derived "the current week" would be free to act on
a week nobody is reading, and the screen would have no way to say otherwise.
**The door asks the caller BECAUSE the caller is the one who knows which week
the athlete is looking at.** The optionality is the flaw; the argument is
correct.

**AND THE SECOND DEFECT'S FIX IS A TYPED DISTINCTION, NOT A PHRASE.**
`coachChangeOutcome` now borrows the door's words only on the arm where the door
authored an athlete-facing sentence — `outcome === 'refused'`. A door returning
`ok: false` with **no** outcome has failed a precondition and is addressing a
caller; the coach uses its own signed refusal. The door already draws this
distinction in its own type. Nothing here recognises a phrase.

---

## §4 — WHAT THE TAPE MEASURES NOW

```
   [probe] the move both arms will make: 2026-08-08 (Saturday) → 2026-08-09 (Sunday)
   [coach] athlete types : "can you move Saturday to Sunday?"
   [coach] read as       : change     → proposal: proposed
   [door]  ok: true · outcome: applied
   [coach] SAYS          : "I moved Saturday to Sunday."

   COACH-ACTED  vs TAP-ACTED   : IDENTICAL
   COACH-BOOTED vs TAP-BOOTED  : IDENTICAL
   the DECISION each arm recorded : IDENTICAL
     coach: {"kind":"plan_change","change":{"kind":"move_session","fromDate":"2026-08-08","toDate":"2026-08-09"}}
     tap  : {"kind":"plan_change","change":{"kind":"move_session","fromDate":"2026-08-08","toDate":"2026-08-09"}}

   undo outcome : undone · UNDONE back to the floor? YES · survived relaunch? YES
```

**The two decisions are byte-identical**, which is the order's own wording and
is also the answer to the parked authorship question in its measured form: the
ledger records the CHANGE, and the change the coach drafted is indistinguishable
from the change the athlete tapped. That remains a ruling for Sam — the
measurement does not settle whether it SHOULD be.

**THE CONTROL RAN AND IT IS CLEAN.** The two arms are separately-reached worlds,
so the tape reaches the world twice with nothing landed and compares before it
compares anything else: `[control] is reaching the world repeatable? YES`.
Without that line the cross-arm verdict would be unattributable, and this repo
has paid for a control it did not take (the sibling tape's three "side-writers",
all three its own instrument).

**THE PROBE ASSERTS ITS PRECONDITIONS.** The source day is chosen through
`capabilities.canMoveWholeDay` — the field `coachProposal` itself consults — so
the tape cannot mistake a REFUSAL for a durability finding. If the athlete's own
tap fails to move the week, the run says the reading is vacuous and refuses to
report a coach finding.

---

## §5 — THE MIRROR, AND WHY IT IS PINNED

The tap arm calls `programControlActionForPlanChange`, `PlanChangeSheet`'s own
extracted owner. Its doc comment says why that owner exists: *"a harness that
mirrors a screen drifts from it; a harness that CALLS it cannot"* — a device
suite once hand-copied the sheet's payload and kept the bug after the sheet was
fixed.

**`handleConfirm` has no such owner**: it lives inside a component, and the tape
COPIES its context object. That copy is exactly the thing that just went wrong,
one layer over. So it is not left on trust — section [7] reads the screen's own
call site and reds if it stops passing a visible week, and a further cell
compares it to the SHEET's call site so *"the same door"* is a claim about the
arguments and not only about the function.

Extracting a coach door-owner beside the sheet's was considered and not done in
this pass: it would move the executor import out of the screen, and slice 1's
import ban asserts the screen reaches ONE writer BY NAME. Re-aiming that ban is
a real change to the slice's own safety claim and belongs in a pass that argues
it, not in a fix. **Named here rather than done.**

---

## §6 — GATE

- Full unpiped chain `GATE_EXIT=1`: exits at `test:program-control-durable` with
  **1 FAIL cell** — main's declared red, 92 suites reached.
- `test:compile` **PASSED**, totals **35 / 51 / 373 — byte-identical to
  baseline.**
- `test:coach-tab-slice3` **127 cells** (116 → 127), section [7] added,
  **8 mutations, 8 red, no survivors.** No cell deleted; the suite's DEPTH line
  was re-worded, because it said *"no door was executed"* full stop and a door
  is now executed by the tape it names.
- **Sweep 2 of 174 = the declared set exactly** (`test:program-control-durable`,
  `test:fixture-identity`). **The denominator did NOT move**, and that is
  correct: `tape:coach-move-durability` asserts nothing and prints a
  measurement, so it is a tape and not a gate. Section [7] is what the chain
  sees of its finding.

### The eight mutations

| # | mutation | reds |
|---|---|---|
| 1 | the coach's door call drops `visibleWeek` (**the shipped defect**) | 3 |
| 2 | `weekDays` comes from a second `useResolvedWeek()` call | 1 |
| 3 | the door stops requiring the visible week | 1 |
| 4 | the coach borrows the door's words unconditionally (**defect (b)**) | 2 |
| 5 | the coach NEVER borrows the door's words (kills the control) | 2 |
| 6 | the tape script is removed from `package.json` | 1 |
| 7 | the SHEET stops passing the visible week | 1 |
| 8 | the anchor misses — the awaited call is renamed | 4 |

Mutations 1 and 4 are the two real defects re-introduced; both red. Mutation 5
is the control for 4 — without it, a module that never speaks the door's words
would satisfy the new cell and silently delete [4]'s behaviour.

---

## §7 — NOT COVERED

**FIRST LINE: NO REACT, AND NO DEVICE.** The tape calls the screens' own rule
functions with the screens' own arguments, in the screens' own order, but
**nothing is mounted.** A defect living in render order, in a stale closure, in
the settling effect's timing, or in the fact that `handleConfirm` captures
`weekDays` from a render that may be one behind, is outside what this tape can
see. `handleConfirm`'s dependency array now includes `weekDays` — that is a
source-level correctness reading, **not a measurement.**

**ONE ACTION KIND, ONE WEEK, ONE WORLD, L13 DEPTH 1.** `move_session` only, on
Sam's 2026-08-05 fixture, on a world reached by acting but not worn. A second
proposable kind arrives without a tape unless one is written for it.

**THE KEYBOARD IS STILL UNPROVEN ON GLASS.** Unchanged from the S3 boundary:
item 0's fix is in shape, every one of its cells reads source, and only Sam's
phone closes it. This pass did not touch it.

**THE COACH'S CONFIRM STILL HAS NO EXTRACTED OWNER** (§5). The mirror is pinned,
not eliminated.

**WHAT THE ATHLETE SEES WHEN A DOOR FAILS A PRECONDITION IS NOW *"I couldn't
make that change."*** — honest, but it tells them nothing about what to do next.
That is a copy question for the signing sitting, not a defect.

---

## §8 — PARKED FOR SAM

Carried unchanged from the S3 boundary, plus one:

1. **THE LEDGER RECORDS THE COACH'S MOVE AND THE ATHLETE'S MOVE IDENTICALLY —
   now MEASURED, byte-for-byte, not inferred.** Whether it SHOULD is still your
   ruling, and it is the other half of the athlete-tap-attributed-to-coach item.
2. Batch 31, still PROPOSED, one signing sitting.
3. Which request did it refuse that it should have proposed.

---

## §9 — THE CONVERGENCE RULE

**TOWARD, and by deletion rather than addition.** Zero new stored state. The fix
removes an argument omission; the tape stores nothing; the new cells read
source. The coach's decision reaching the ledger in the door's own vocabulary —
the reassessment's whole ruling — is, as of this pass, **a measurement instead
of a reading.**

---

## §10 — L12: WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

**(1) A CELL THAT NAMES A FUNCTION BUT NOT ITS ARGUMENTS.** §2 above. The
compression: **for any door whose optional context changes whether it acts, the
call-site cell asserts the context, and a second cell compares it to the
established caller's.** Section [7] is that shape for the coach; the next screen
to reach this door needs the same two cells in its own suite.

**(2) A SOURCE-LEVEL READING STANDING IN FOR A RUN — sighting 2.** The overnight
pass said its `ProgramControlAction` union reading was *"a type-level reading of
two unions, not a port, and the likeliest place this is wrong."* S3 said the same
of its own door reading. **Both were right, and the second one was wrong in the
predicted place.** The compression, and it is the standing rule this pass also
recorded in AGENTS.md: **a behaviour claim an athlete can experience is held by
a cell or a tape, or it is written OPEN-UNKNOWN.** A slice whose NOT-COVERED
first line says "the door has never run" should not ship its next slice before
the door runs — this one did, and the gap held a defect that made the whole
feature inert.

**(3) A REFUSAL SENTENCE WRITTEN FOR A CALLER, SPOKEN TO AN ATHLETE — UNFIXED AS
A CLASS.** The coach now borrows words only on the door's `'refused'` arm, which
closes it at the coach. **It is not closed at the door**: `fallbackResult` and
its siblings compose caller-facing sentences that any surface may render, and
nothing distinguishes them by type beyond the `outcome` field this pass leaned
on. Named, not built.
