# LR-29 UNDO — WHICH ROUTE CAN CARRY THE BUTTON (2026-08-09)

**Instrument:** `npm run tape:lr29-undo-durability`
(`src/__tests__/lr29UndoDurabilityTape.ts`). Deliberately NOT in `test:bible`:
it asserts nothing and passes nothing. It prints a measurement.

**World:** Sam's 2026-08-05 pass fixture, generated 2026-08-01, four weeks.
State reached by ACTING through the real program-control door, per the standing
ruling that hand-built state proves only that state survives.

**Why this tape exists.** Sam's ruling
(`docs/UNDO_SHAPE_RULING_2026-08-09.md`) rests on a claim about an existing
surface — *"you can already undo changes using coaches notes for older
things."* A ruling premise is a claim too. This measures it.

---

## THE HEADLINE — **THE SHAPE SAM RULED IS UNAFFECTED. THE MECHANISM UNDER IT
## IS NOT THE ONE HIS GROUNDS ASSUME.**

```
did the ACT change the week?       YES
did the UNDO restore the week?     NO
[undo] OUTCOME : safely-rejected
[undo] REASON  : Accepted-state ledger mismatch for 2026-07-27:
                 re-evaluation produced blockers maximum_breach
[control] forward move BACK 2026-08-09 → 2026-08-08 : LANDED
```

**The Coach Notes undo route REFUSED in this world.** The athlete's move stayed
put, the adjustment stayed `active`, and the week was untouched by the tap that
exists to untouch it.

## THE CONTROL IS WHAT MAKES THAT READABLE

One refusal has two readings — *this world refuses this material change* or
*this world refuses RESTORATIONS* — and they are indistinguishable from a single
run. That is the sibling tape's own lesson: an unreadable comparison must not be
reported as a finding.

So the same unwinding was expressed the other way: a forward `move_session`
back to where it came from, through the door the athlete used to move it.
**Same world, same week, same two dates, same material end state. Only the
ROUTE differs.**

| route | outcome | resulting week |
|---|---|---|
| restore the stored snapshot (Coach Notes) | **`safely-rejected`** | unchanged — still moved |
| the same unwinding as a forward decision | **LANDED** | **byte-identical to the pre-move week** |

**The variable is isolated to the route.** This world does not refuse the
change. It refuses the restoration.

## AND THE REASON IS A CONDITION, NOT A GAP — SECOND SIGHTING IN TWO TAPES

`acceptedStateTransaction.ts:509` is not a bug. It is a documented, deliberate
asymmetry that says so in its own comment:

> **ACCEPT-AND-REDUCE, FORWARD ONLY (Sam, 2026-07-29).** … A RESTORATION gets
> the old behaviour and must: it is replaying state that was accepted once, so
> a week it cannot reproduce means the stored snapshot is corrupt. Publishing a
> reduced version of a corrupt snapshot would merge a defect into accepted
> state.

So a forward decision that cannot meet its contract is **accepted and reduced**,
with the shortfall disclosed in Sam's signed words. A RESTORATION that hits the
same violation **throws**.

**THE CONSEQUENCE, STATED PLAINLY: undo-by-snapshot is held to a stricter
standard than the act it reverses.** An athlete can move a session into a world
that carries a shortfall — the app accepts it and tells them — and then cannot
take it back, because taking it back is judged by a rule the taking never had to
pass. The blocker cited here is `maximum_breach` in **2026-07-27, a past week
the move never touched.**

**Undo-by-annul-and-re-derive does not inherit that.** It re-derives FORWARD
from the remaining decisions, so it takes the forward path by construction and
gets accept-and-reduce like any other derivation.

**That is a measured argument for the mechanism the kickoff addendum already
ruled** — *"undo a program decision = annul its ledger entry and re-derive"* —
and it is stronger than the north-star argument that was the only one available
before this run. The ledger route is not merely tidier. **It is the one that can
complete.**

## THE SEAM IS ALREADY TYPED, AND ALREADY INERT

`types/decisionLedger.ts:38` declares the kind, with a comment written for
exactly this day:

> `| { kind: 'reversal'; reversedEntryId: string }`
> *Undo is a decision too: a reversal APPENDS, it never rewrites (LR-29).*

`quiescentBoot.ts:122` refuses to replay it, and names its own successor:

> *No reversal producer exists yet (undo door lands with LR-29's heir); a
> reversal entry is declared, typed, and inert until then.*

**This unit IS that heir.** Every photograph in the run confirms the seam is
still dark: `ledger holds a reversal? : NO`, in all five.

`athleteSessionMoveTests` cell 21 pins the absence and reds the moment a
reversal producer starts writing — so the gate that watches this build already
exists and was written to fail on the day it lands.

## WHAT THE UNDO UNIT THEREFORE IS

Smaller than the replay unit it lives inside, and in a different place from
where a button suggests:

1. **A reversal PRODUCER** — the undo door appends
   `{ kind: 'reversal', reversedEntryId }`. One append, no rewrite.
2. **THE REPLAY MUST HONOUR IT** — `quiescentBoot` currently returns early on
   `reversal`. Until it filters reversed entries out of the replay set, an undo
   is a display that dies at the app boundary. **This is upstream of any
   screen.**
3. **The button** — one step, per the ruling, mock-first.

Item 3 is the smallest of the three, and it is the only one anybody can see.

## WHAT THIS RUN DID *NOT* ANSWER, AND IT IS NOT MINOR

**Durability was NOT measured, because the restore never succeeded.** The
question the tape was built to ask — *does an undo survive a relaunch* — needs a
successful undo to ask it of, and this world would not produce one. The BOOTED
photograph here is the boot of a world where the undo REFUSED and a forward move
landed instead, which answers a different question.

**One observation from the first run, recorded because it is unexplained rather
than because it is understood.** In the run before the control was added — a
world holding the refused restore and nothing else — the boot logged
*`a ledger decision no longer applies on replay { kind: 'move_session', outcome:
'refused' }`*, came back with **zero** reversible adjustments where the pre-boot
world had one active, and produced a week matching **neither** the acted nor the
pre-move shape (`2026-08-09: Hard Conditioning + Lower Hinge`, a compound that
existed in no photograph). That is three loose threads and this tape does not
pull any of them. **Named, not concluded, not hunted.**

## NOT COVERED — honestly

- **ONE decision kind (`session_move`), ONE week, ONE world, DEPTH 1.** A
  different kind may restore cleanly; this run says nothing about it.
- **The `maximum_breach` in 2026-07-27 was not traced to its cause**, and
  whether it is ambient in every generated world or particular to this fixture
  is unmeasured. The route asymmetry does not depend on the answer — the control
  isolates it — but how OFTEN undo refuses in the field does.
- **No device evidence.** Harness measurement only.
- **The tape asserts nothing.** A green exit code means the process ran. Only
  the printed lines are the result.
- **Nothing was built for undo.** No producer, no replay change, no screen.
