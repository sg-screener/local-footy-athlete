# THE LR-29 REPLAY UNIT — KICKOFF (filed 2026-08-07)

**Status: FILED, NOT STARTED.** Sequenced as the next ENGINE unit **after the
merge gate** (Sam's combined device pass), per Sam's Option B ruling. Nothing in
this document is a build instruction yet.

## THE OPENING LAW — READ THIS BEFORE ANYTHING ELSE

> **The unit's first act is the FULL MEASURED DEPENDENCY LIST. No build, no
> scaffold, no "small first step" until it exists.**

This is not ceremony. V3 spent four passes discovering dependencies one at a
time — a writer that turned out to be a fifth site in no census, a payload that
turned out to be the mechanism, a class that turned out to be one class. Each
discovery invalidated the plan built on the previous one. **The dependency list
is the deliverable that makes the second pass cheaper than the first**, and
§8 SECOND-WALL LAW makes it mandatory rather than advisable: the
`remove-then-discover-the-lean` shape has now been sighted five times on this
work, and the only thing that ever broke it was measuring the whole surface
before moving.

## WHAT THE UNIT IS

**Replay the athlete's DECISION LEDGER onto the base contract at read, so the
week's accumulated identity derives instead of being read from storage.**

Then, and only then, the stored declaration retires as a read authority — which
is the V3 remainder, and which makes every writer of it (the five found and any
sixth) harmless without any of them being touched.

## THE CLASS SENTENCE — WHAT MUST BE RECOVERED

**The week's DECISION-ACCUMULATED contract state.** Two pieces, both measured:

1. **`authorisedReductions`** — the accumulator proper. The stored declaration
   accumulates the week's authorised reductions as decisions land. Its arithmetic
   is measured against the COMPOSED WEEK, which no reader of the declaration door
   holds. Symptom: Restore cannot find the reduction it owns.
2. **The decision-authored identity** — bye-build and practice-match table
   selection, illness authoring, in-week authorised changes. **Measured NOT
   recomputable from fixtures + source facts**: flip arm 2 supplies exactly those
   inputs and paid none of it.

The earlier recorded sentence — *"the accepted week no longer knows what kind of
week it is"* — is right about the SYMPTOM and wrong about the recoverable input.
Both pieces above are one class. Do not re-split them.

## THE FOUR REFUTED ROUTES — DO NOT RE-RUN THESE

| # | route | result | report |
|---|---|---|---|
| 1 | retire the writer | 8 new / 1 fixed; Restore's reduction ownership goes VACUOUS | `R53_LEGV_WRITER_REPRICED_STOP_2026-08-07.md` |
| 2 | fill the declaration at the writer | 4 sites, **0 leaves moved**; author is a 5th site; mechanism is the PAYLOAD | `R53_FLIP_MOVE_I_WRITER_NAMED_BY_TAPE_2026-08-07.md` |
| 3 | drop the overlay rung | 9 of 156, set **byte-identical to route 1** | `R53_FLIP_MOVE_III_PRICED_STOP_2026-08-07.md` |
| 4 | replay identity from FACTS at the door | 14 of 156, **paid ZERO**; the door is the wrong place to derive | `R53_FLIP_C_REPLAY_REFUTED_ACCUMULATOR_STOP_2026-08-07.md` |

**Route 4's second finding is the design constraint the unit inherits:** the
declaration door is called from hydration and stored-shape validation as well as
from live reads, so **there is no single world it can derive against.** Deriving
belongs where the world is already in hand — which is what `acceptedEffectiveWeek`
and `sessionResolver` already do, and what the other eight door callers cannot.

## SIZING MEASUREMENTS ALREADY IN HAND

- **The decision ledger is COMPLETE.** Write-side tape, all 156 suites: **330
  occurrences = 40 rows = 23 decisions**, `noAdjustment` 0 of 40, and **no door
  fails to append**. The earlier "159 missing decisions" framing was struck.
  (`R53_REMOVAL_DOOR_ATTRIBUTION_2026-08-07.md`)
- **A replay primitive already exists and is idempotent.**
  `deriveWeekContract`'s `withRemovalLedger` applies a constraint's typed
  reduction to a contract and SKIPS one already present.
- **The declaration owns 16 fields: 4 resolved, 12 blocked.** Resolved at depth:
  `protocolVersion`, `authority`, `source`, `equipment`. Blocked:
  `authorisedReductions` plus the six dose sections it feeds, and
  `anchors`/`safety`/`identity`/`migration`/`governedFromISO`.
  (`R53_OWNERSHIP_CENSUS_AND_REPLAY_2026-08-07.md`)
- **The price of the remainder, both arms: 8 new / 1 fixed of 156**, with
  `fixture-identity` as the fix. Cell-level failure text for all eight is
  recorded in `R53_FLIP_CLASS_CONFIRMED_ACCUMULATOR_NAMED_2026-08-07.md`.
- **The prize, measured:** all three parity worlds go BYTE-EQUAL and Monday
  returns as `2026-08-10=Lower Squat|8` (Vertical Jump present).

## PARKED SCAFFOLDS — ALL INERT, NONE LANDED

| scaffold | where | what it does |
|---|---|---|
| `LFA_FLIP_DOOR=1` | `src/rules/storedWeekDeclaration.ts` | drops the overlay rung |
| `LFA_FLIP_DOOR=2` | same | rung-drop + fact-replay from the live world (route 4) |
| `LFA_SCAFFOLD_LEGV_WRITER=1` | `src/rules/derivedWeekContract.ts` | the writer stops storing the declaration |
| `LFA_TAPE_DECLARATION_DOOR=1` | `src/rules/storedWeekDeclaration.ts` | the census tape, complete by construction |
| `stash@{0}` "flip-move-i-wip" | working tree | route 2's four-site build |
| `scratch/r53-legv-*`, `scratch/r53-pricing-*` | branches | every earlier instrument |

## KNOWN OPEN QUESTIONS THE DEPENDENCY LIST MUST ANSWER

1. Which readers need the ACCUMULATED contract, and which only need the base?
   (The door serves 10 readers; only some compose a week.)
2. Where does the composed week exist at the moment each reader asks? The
   reduction arithmetic needs it and route 4 proved the door does not have it.
3. Is the decision ledger sufficient to replay the *decision-authored identity*
   (table selection, illness authoring) — or only the reductions? Completeness
   was measured for removals; **not for the other decision kinds.**
4. What happens to the three Class B cells (`phase-structure` 8, the lighter-day
   walker cells)? Characterised by text in three passes, still not mechanised.
5. Does the parity gate survive the unit, and in what form? It currently
   compares stored vs derived; when storage stops answering, its left-hand side
   needs re-aiming at "no read answers from storage".

## DEBTS THAT RETIRE WITH THIS UNIT

- the parity gate's declared entry `stored_declaration_costs_mondays_power_row`
  — its `expiresWhen` is met the moment nothing at read can answer from the
  stored declaration, and it retires **PAID** (measured: the comparison stays
  non-vacuous and goes byte-equal);
- the D13-paid entry `session_list_calls_a_conditioning_day_recovery` —
  MOVED-shaped, **not** claimed paid; re-check its reach when the unit lands;
- the stored declaration's physical deletion, already a line item in R5's big
  delete and explicitly **deferred out of R5** by Sam's ruling until this unit
  retires the read path.

## ADDENDUM 2026-08-09 (Sam): UNDO IS THIS UNIT'S VISIBLE FACE

Sam, verbatim: "there should just be an undo button somewhere probably?
for everything as well that is - not just adding and removing a game."

RULED DIRECTION, recorded by the seat: universal undo becomes the
replay unit's athlete-visible deliverable (VISIBLE-FIRST applied to the
one unit that had no visible face). Grounds: the ledger IS the enabler —
undo a program decision = annul its ledger entry and re-derive; that is
only honest once replay can reconstruct state from the remaining
decisions, which is this unit's exact job. Undo is therefore not scope
creep on LR-29; it is its proof on a phone.

Boundaries the seat holds until Sam rules otherwise:
- Program DECISIONS undo via the ledger. Recorded FACTS (a saved session
  outcome, a journal note) are NOT program decisions — their undo is
  remove-last-entry at their own store's door, designed separately, and
  a logged session should not silently vanish.
- Depth/shape (one-step undo vs a wind-back "recent changes" list) is an
  OPEN design choice — seat brings lettered options + recommendation at
  unit opening. Not pre-decided here.
- The dependency list's finding stands: the ledger has no vocabulary yet
  for illness/injury/readiness/phase — what "everything" covers at v1
  follows from that map, stated honestly, never overclaimed.
