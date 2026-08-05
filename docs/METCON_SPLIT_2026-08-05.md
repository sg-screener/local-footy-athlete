# MetCon re-authoring — what applies now, what pins to the coach rebuild

Sam re-authored the MetCon session on 2026-08-05
(`docs/METCON_RESIGN_AND_SIGNOFFS_2026-08-05.md` §3, ruling (b): general
MetCon, burpees in, off-legs identity retired). He asked the terminal to
determine which parts may apply immediately and which are coach-write changes
held by LR-6, and to record the split explicitly so nothing is lost.

Every claim below was MEASURED on this tree.

---

## The test applied

LR-6's ratified boundary (Sam, 2026-08-03, recorded on the census entry):

> Routing a coach caller through an owned store door — NAME AT THE DOOR,
> identical call, identical context, identical transaction — is
> STORE-OWNERSHIP work and is NOT held by this STOP. What is held is changing
> what a coach path DECIDES. **The test is behaviour: if the coach path would
> produce a different write, it is LR-6 work and it stops.**

So the question for each part of the re-authoring is not "does it touch a
frozen file" — it is **does it change what the coach path decides**.

## APPLIES NOW

**1. The category DEFINITION.** Recorded verbatim in the sign-off doc, which
is committed. It is prose for the books; it is not code and decides nothing.

**2. The athlete-rendered DESCRIPTION** — shipped, in
`utils/coachRevisionTemplates.ts`:

> 28 min MetCon: rotate stations — ergs (bike/row/ski/assault), carries, and
> burpees. 60 s work, 30 s rest. Hard but repeatable — enough recovery to keep
> technique and output consistent every round.

This carries the actual content of the re-authoring: burpees in, 60 s work /
30 s rest, and the "Mostly off legs." sentence retired. It decides nothing —
same `templateId`, same bye-only placement, same offer-on-the-ask, same 28
minutes — so no coach path produces a different DECISION because of it.

It also RETIRES the PROPOSED reword parked at §11 ("Vary how hard you push and
how long you recover between stations."), which was never signed and is now
withdrawn: Sam's own sentence carries no ratio, so the display-times rule that
prompted the proposal is satisfied by the signing itself.

**3. The equality-gated sheet cells: NONE EXIST.** Sam's instruction was that
any equality-gated cells naming MetCon update in lockstep. Measured: a scan of
every `.xlsx` in the tree finds **no cell containing "MetCon" or "Off-Legs"**,
in shared strings or anywhere else. Sam's conditioning FINAL ruling 20 already
retired the name from the conditioning vocabulary
(`data/conditioningTemplates.ts:1356-1360`), and `test:muscle-experience`
asserts positively that the muscle sheet has no MetCon row. There is nothing
to update in lockstep, and this is a measurement rather than an assumption.

## PINNED TO THE COACH REBUILD (LR-6)

**The NAME.** `label: 'MetCon - Off-Legs'` is unchanged, and this is the one
part of the signing that is held.

The label is not a matching key itself — measured: every consumer matches on
`templateId` (`'metcon_offlegs'`), never on the label
(`planChangeProducer.ts:1192/1868/1933`, `coachRevisionPolicy.ts:132/152`).
But the label becomes `workout.name` (`coachRevisionTemplates.ts:352/383/471/
497/612`), and **session names are live matching keys the frozen coach
router/executor string-compares**. That is not a guess: the buttons/UI unit
measured it and could not delete the three inference rules for exactly this
reason — 2/9/972 of 30,937 distinct `resolveSessionDisplayName` inputs are
still LIVE producers of frozen coach keys
(`docs/BUTTONS_UI_UNIT_BOUNDARY_2026-07-31.md` §Task 11, item 11).

Renaming therefore changes what a coach path DECIDES, which is precisely what
LR-6's behaviour test holds. It rides the coach-pipeline unit that lifts LR-6.

**What the pin costs, stated plainly:** until it lifts, an athlete offered this
session sees the name "MetCon - Off-Legs" above a description that says
"28 min MetCon" and no longer mentions legs. That is a visible inconsistency
and it is the honest price of the freeze — the alternative is a frozen-layer
behaviour change made in the dark. Nothing is lost: the signed name is
recorded here and in the sign-off doc, and the unit that lifts LR-6 owes it.

## Not touched

The placement rules are unchanged, as Sam ruled: bye-week-only, offered on the
ask, never auto-programmed, and the game-week ask still refuses to flush
alternatives. `test:session-type-charter` and `test:conditioning-templates`
both still pass.
