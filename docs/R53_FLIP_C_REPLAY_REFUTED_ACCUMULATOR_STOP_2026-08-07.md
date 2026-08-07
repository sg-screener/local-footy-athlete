# R5.3 — THE FLIP (c): THE REPLAY IS REFUTED BY MEASUREMENT, AND THE PIECE IS NAMED (2026-08-07)

LOOP CHECK: **a-control-red-belongs-to-the-instrument-only-if-removing-it-helps**
— applied in advance this time. Arm 2 was built to answer *"how much of the 8
does the replay pay?"*, and the answer is the number that decides (c). It paid
**zero**. That is a design refuted by one sweep instead of by a threading pass
through ten callers.

Twenty-eighth pass. Answers inbox item 1 (c). **NOTHING BUILT** — both arms are
flag-gated (`LFA_FLIP_DOOR=1|2`), inert by default.

## THE HEADLINE

| arm | failures of 156 | vs the arm before it |
|---|---|---|
| **control** — move (ii) landed, flags off | **2** | the branch's declared set |
| **arm 1** — drop the overlay rung | **9** | 8 new, `fixture-identity` FIXED |
| **arm 2** — rung-drop **+ (c)'s replay** | **14** | **0 paid, 5 new** |

**The replay paid ZERO of the eight and cost five more**
(`legacy-census`, `power-counting`, `section18-gateway`,
`stage-b-generation-differential`, `surface-agreement`).

## WHAT ARM 2 WAS, AND ITS HONEST LIMITS

(c) frames the fix as: *the week's accumulated identity — mode, authorised
in-week changes — derives by replaying the week's decisions onto the base
contract at read.* Arm 2 is that, in the only form the door can express: the door
drops the overlay rung and returns
`deriveWeekContract(baseContract, {profile, markedDays, temporarySourceFacts})`
from the live world.

**Stated before the result is read, not after:** arm 2 replays IDENTITY
(fixtures + source facts) and **not** the accumulated reductions, because the
reduction arithmetic is measured against the COMPOSED WEEK and no caller of this
door has one. Class D was therefore *expected* to survive arm 2. Class A was
not — and that is the finding.

## THE FINDING — CLASS A IS THE ACCUMULATOR TOO

The recorded sentence for class A is *"the accepted week no longer knows what
kind of week it is"*, which reads as an identity problem: mode, anchor state,
fixture day. **If it were, arm 2 would have paid it** — `deriveWeekContract` is
precisely the owner of mode/anchor/fixture-day derived from the athlete's facts,
and arm 2 hands its output to every door caller.

It paid none of the three:

| suite | arm 1 | arm 2 |
|---|---|---|
| `accepted-state-transactions` | red | **red** |
| `athlete-session-deletion` | red | **red** |
| `illness-clear-game-week` | red | **red** |

**So the state those cells miss was never derivable from fixtures and source
facts.** It was written onto the overlay's declaration by DECISION doors — the
bye-build and practice-match table selections, the illness authoring, the
in-week authorised changes — and the covering microcycle's contract is
generation's output, which knows nothing about any decision taken after it.

**Class A and class D are the same class.** Both are the ACCUMULATOR. The
recorded sentence is right about the symptom and wrong about the recoverable
input, and that correction is only visible because the replay was measured
rather than assumed.

## THE PIECE, NAMED — (c)'s STOP CONDITION MET

(c): *"If any piece of accumulated identity cannot be recomputed from ledger +
facts, that is the classification STOP — name the piece."*

**THE PIECE: the week's DECISION-ACCUMULATED contract state.** Concretely, and
in the order the evidence names it:

1. **`authorisedReductions`** — the accumulator proper. Cannot be recomputed at
   the door: the arithmetic is measured against the composed week, and no door
   caller holds one. Measured: three Restore/reduction cells survive both arms.
2. **The decision-authored identity** — table selection (bye-build,
   practice-match), illness authoring, in-week authorised changes. **Measured
   not recomputable from fixtures + facts**: arm 2 supplies exactly those inputs
   and pays nothing.

Both need the DECISION LEDGER replayed onto the base, not the facts. That is
`LR-29 undo-as-replay` — already recorded on this branch as the future of undo,
sized, and **not built**.

## AND A SECOND REFUTATION: THE DOOR IS THE WRONG PLACE TO DERIVE

Arm 2's five new reds are their own finding. The door is called from hydration
and from stored-shape validation as well as from live reads; handing all of them
a derivation against the LIVE world is wrong for several by construction. So
(c)'s literal instruction — *"the accessor's implementation switches from storage
to deriver"* — is refuted independently of the accumulator: **there is no single
world the door can derive against.** Deriving belongs where the world is already
in hand, which is what `acceptedEffectiveWeek` and `sessionResolver` already do
and what the other eight callers cannot do.

**CAVEAT, stated rather than buried:** arm 2 is a scaffold that reads the store
from a rules module. Some of its five new reds may be scaffold artefacts rather
than design defects; they were not individually diagnosed. **Nothing here rests
on them** — the decisive number is the ZERO paid, which no scaffold defect can
manufacture.

## THE STOP

**(c)'s own stop condition is met and the piece is named. (d) is NOT reached and
V3 is NOT closed.** The flip does not land: it would ship the accumulator loss,
which is a decision payload — the same STOP this unit has now reached from four
directions (the writer re-price, the debt deletions, the Restore path, and now
the replay).

What is genuinely new and worth carrying forward:

- the eight reds are **one class**, not two, and that class is the accumulator;
- the class is **not** payable by fact-replay, measured, not argued;
- the door is the wrong place to derive, measured;
- the flip's other promises still hold — parity byte-equal in all three worlds,
  `fixture-identity` fixed, and the athlete's `Lower Squat|8` Monday.

## WHAT IS MEASURED AND WHAT IS NOT

**MEASURED.** Three arms at 156 suites each with a world-identity preamble
(`head=4f12b82e`, `symbol=LFA_FLIP_DOOR files_with_symbol=1`, arm printed);
failure SETS diffed, never totals; `test:compile` EXIT 0 with no file regressed
under arm 2's code.

**NOT MEASURED.** Arm 2's five new reds are not individually diagnosed. Class B
(`phase-structure` 8, the lighter-day walker cells) remains characterised by text
only, in three passes now. The ledger-replay fix (LR-29) is not built, not
scaffolded, and not priced. No device evidence.
