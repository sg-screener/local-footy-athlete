# STATUS — seat `restart`

Claimed 2026-08-18. Name checked against `ls docs/STATUS_*.md` at claim time —
`RESTART` was free (31 other status files exist; none is this name).

Mission: **MID-BLOCK RESTART CONSERVATION.** Base `main @ c68b00d7`, branch
`feat/mid-block-restart-conservation`, worktree `scratchpad/wt-restart`, control
worktree `scratchpad/wt-control` detached at the same commit. CAP 2 sessions.

Sam's rule, verbatim: *"A restart inside an accepted block may not re-author that
block. With no dated fact change, the visible week before and after restart must
be identical."*

This is the own unit the journey merge named and did not cover: *"a mid-block
restart re-generates conditioning templates and can drop a strength row —
reported, own unit."*

## THE INSTRUMENT — `npm run test:mid-block-restart`

`src/__tests__/midBlockRestartConservationTests.ts`. Production doors only, reusing
`src/__tests__/support/athleteJourney.ts`: cold start → onboarding → install →
train into the middle of the accepted block → **a genuine process death**
(`relaunchApp`: stores emptied, their writes flushed, disk restored, hydration
registry rehydrated, `runQuiescentBoot`) → the same week again. The clock is held
on the same day either side and **no door is walked and nothing is recorded
between the two captures**, so any difference is the app re-authoring an accepted
block.

Every capture carries, per day: exercise NAME and canonical ID, ROLE, sets, reps,
LOAD, the conditioning TEMPLATE identity (`projectConditioningVisibleIdentity` —
the app's own conditioning read), plus the week's EXPLANATIONS, the athlete's
EXCLUSIONS, the accepted BLOCK STATE, the `acceptedBlocks` record and the
accepted BLOCK-SELECTION identity. A report that printed exercise names alone is
blind to three of the four ways this class shows up.

**TWO WORLDS**, because the admitted defect was seen on a shape the primary
journey athlete does not have:

1. **IN-SEASON, Saturday game** — three stated gym days, Friday protected as G-1,
   pure-strength gym days.
2. **PRE-SEASON, conditioning on the gym days** — two gym days, one club night, no
   fixture. This is the shape whose gym days carry a conditioning component, so
   the conditioning template is a visible column at all.

## MEASURED AT BASE — the defect, reproduced before any code changed

Both worlds, restart on the same day, no dated fact changed:

```
IN-SEASON   DIFFERENCES: 2
  2026-07-20 session: Full Body Strength -> full_body
  2026-07-22 session: Full Body Strength -> full_body

PRE-SEASON  DIFFERENCES: 5
  2026-07-20 session: Full Body Strength -> full_body
  2026-07-20 row LOST : Romanian Deadlift (ex-canonical-hinge) 3x6-10 @0
  2026-07-20 row NEW  : Single-Leg RDL (ex-custom-single-leg-rdl) 3x6-10 @17.5
  2026-07-22 session: Full Body Strength -> full_body
  blockSelections: 0 rows -> 9 rows
```

**The athlete's session loses its name and becomes a raw enum key on every
surface, and a hinge row is silently swapped for a different exercise.**

## THE CAUSE — attributed by bisection, not by reading

Six measurements, in the order they were taken:

| asked | answer |
| --- | --- |
| do boot's generation OPTIONS cause it? | **NO.** Re-running with the install options exactly, then adding each boot option one at a time, produced boot's week every time. |
| is generation stable call to call? | **YES.** Four calls in a fresh process, identical output. |
| does the ORDER of the install steps matter? | **NO.** Generating before or after `completeOnboarding`, before or after `seedOnboardingProgram` — same output. |
| what does `generateProgramLocally` actually return? | `full_body :: … Single-Leg RDL …` — **boot's week, not the accepted one.** |
| what does the store hold after install? | `Full Body Strength :: … Romanian Deadlift (ex-canonical-hinge) …` |
| which layer between them rewrites it? | **`validateLiveProgramWrite`** (`utils/postGenerationConstraintValidation`). Running it on the raw generated program reproduces the accepted week exactly. |

**`utils/postGenerationConstraintValidation` describes itself as *"final
canonicalisation and active-constraint boundary for program writes"* — and only
ONE of the two acceptance doors was running it.**

- `programStore.setCurrentProgram` (the onboarding install) validates its
  candidate, then calls the shared owner.
- `weekRebuild.commitRebuiltProgram` — the door the block ROLLOVER, every rebuild
  and `quiescentBoot` publish through — hands its generated program straight in.

So block 1 is accepted in one shape and republished in another, and the first
restart inside that block re-authors it. **A boundary a door can skip is not a
boundary.**

## THE FIX — one read, moved to the one owner both doors already reach

`stageAcceptedStateTransaction` (`src/store/acceptedStateTransaction.ts`) now
stamps the phase clock and runs the program-write boundary, microcycle by
microcycle, before `canonicaliseAcceptedStateCandidate` — the same pair, in the
same order, that the install door already applied.

- **Deliberately BELOW the `preserveExactAcceptedWorkouts` early return.** That
  branch means "these are the athlete's own exact workouts, keep them";
  re-canonicalising there would be this owner overruling the athlete.
- **The install door's existing call is left in place.** It needs the validated
  program to derive the block state and generation anchor that ride the same
  proposal. That is safe only because the boundary is **IDEMPOTENT — measured on a
  whole program**, and that claim is now held by a cell rather than by its own
  comment.
- No stored duplicate program, no exercise-name patch, no projection
  compatibility layer.

### ⚠ IT CANONICALISES. IT NEVER REFUSES — and that separation was MEASURED, not assumed

The first cut let the boundary's refusals escape. **The full 403-suite sweep
reddened three suites**, all with the same signature: a week the rebuild door has
ALWAYS published, now fatal at the moment of publication.

| suite | refusal |
| --- | --- |
| `test:block-two-boot-preservation` | `Section18WeekAcceptanceError: maximum_breach:conditioning:6` |
| `test:exercise-exclusions` | same |
| `test:illness-clear-game-week` | `temporary_schedule_max_sessions_not_preserved` |

Traced: the throw comes from `reason=quiescent_boot`. **A refusal there is not a
warning, it is an app that does not launch.**

Neither verdict belongs to this function, and **both already have owners at this
very transaction**: `assertAcceptedVisibleLedgerEquivalence` gates the accepted
week over the same `validateWeekStarts` a few lines below, and the constraint
context is staged above. Holding them here as well is one decision with two
representations, and this copy is the one with no repair path.

So a refusal now leaves THAT microcycle exactly as the producer wrote it and says
so through `logger.error`. **The catch wraps one call and nothing else**, so it
cannot swallow a fault from anywhere but the boundary it defers. This is the same
"keep the canonicalisation, defer the week acceptance" separation that
`validateLiveWorkoutWrite`'s own `deferWeekAcceptance` option documents for the
single-date door.

## ⚠ A THIRD FINDING, REAL AND NOT FIXED HERE

**The rebuild door publishes weeks the install door's boundary would refuse.**
Three worlds prove it. That is a genuine divergence and it wants a ruling — which
week should the athlete actually get — not a unilateral choice by this unit. It
is named here with its receipt and left alone. Making it fatal is not the answer;
the measurement above is what that costs.

## ONE FIXTURE REPAIRED — and the repair is neutral at base, which is why it is honest

`blockTwoBootPreservationTests.installWorld` promised, in its own docstring, to
install *"exactly as the rollover does"*. **It did not**: it wrote
`currentProgram` with a raw `useProgramStore.setState`, so its before-boot world
was a generated program that had never passed an acceptance door while its
after-boot world had. Every comparison in that suite therefore measured
ACCEPTANCE, not boot.

That was invisible while NEITHER door canonicalised. It stopped being invisible
the moment both did, and the fixture reported the canonicalisation as a boot
regression.

**The repair is the door, not the expectation.** It now publishes through
`commitRebuiltProgram`, which is what the rollover uses. Every assertion is
untouched and still exact.

**PROVED NEUTRAL:** the repaired fixture runs **20 passed, 0 failed against BASE
code** in the control worktree, and 20/0 on this branch. A fixture edited to
match a regression could not do that.

## THE SWEEP — GAINED 0

`scripts/sweep.sh`, 403 suites, both trees, same commit:

```
this branch  154 failures
base         155 failures
GAINED   : (none)
REPAIRED : test:readiness-ownership
```

`npm run test:compile` prints the SAME three over-baseline files as base
(`bibleConformance/observations/evaluateMetamorphicRelations`,
`…/evaluatePairwiseScenarios`, `support/acceptBlock`) — the gate is red on `main`
itself and this branch adds nothing to it.

`npm run test:athlete-journey` — **58 passed, 0 failed.**

## MUTATIONS — two run, two red

| id | mutation | result |
| --- | --- | --- |
| M1 | the shared owner reads the UNvalidated candidate again (the fix removed) | **KILLED** — both worlds red, 2 and 4 differences. Re-run against the FINAL design, not just the first cut. |
| M2 | the offer card's denominator restored to `currentSessionsPerWeek * 4` | **KILLED** — 2 cells red. Re-run against the FINAL design. |

## THE OFFER-CARD GUARD GAP — closed, with a world that can tell the two apart

`useBlockBoundaryPrompts` was corrected on 2026-08-17 to read the completion
denominator from `acceptedBlocks[previousBlockStart].requiredStrengthSessions`.
**Nothing held it.** Every world in `blockTwoExtraSessionTests` states an athlete
whose stated availability and delivered requirement are the same number, and its
`promptsFor` helper passes no `acceptedBlocks` at all, so the corrected read
resolves to 0 and the gate waves everything through. The journey merge recorded
this honestly as *"a branch no world this journey builds can discriminate"*.

**The discriminating world is an in-season athlete with a Saturday fixture.**
Friday is protected as G-1, so an athlete who asked for three gym days is given
two. Measured: `delivered=8 stated=12`. Complete every one of the eight and the
two calculations disagree —

```
delivered 8  ->  8 >= ceil(8 x 0.75) = 6   QUALIFIES
stated   12  ->  8 >= ceil(12 x 0.75) = 9  DOES NOT
```

— so an athlete who missed nothing is told they did not train enough and never
sees the card. Three cells now hold it, plus a LIVENESS cell asserting the two
numbers actually differ in this world (without it the guard would prove nothing).

## ⚠ WHY THAT GUARD IS NOT IN THE OFFER'S OWN SUITE

**`npm run test:block-two-extra-session` IS ALREADY BROKEN AT `main` @ c68b00d7.**
Measured in the control worktree at base: **18 passed, 4 failed, then it THROWS**
at its section [3] —

```
TypeError: Cannot read properties of null (reading 'sentence')
    at ExtraSessionOfferCard (src/screens/home/BlockBoundaryCards.tsx:164)
    at src/__tests__/blockTwoExtraSessionTests.ts:719
```

— so the process exits and **nothing after that line runs at all**. A guard
appended there would have been dead on arrival. **This breakage is NOT this
unit's and was not touched.** It is named here so the next seat does not buy the
diagnosis twice; it needs its own unit.

## ⚠ A SECOND MISSING CANONICAL INPUT — FOUND, MEASURED, NOT FIXED

**The install door never records what the accepted block chose**, and an earlier
seat's refutation of exactly this claim was itself measured on one athlete only.

Traced through `generateProgramLocally`'s own recording site:

```
IN-SEASON   recordSelections=undefined authored=9  block=2026-07-13  <- onboarding: records NOTHING
            recordSelections=true      authored=9  block=2026-07-13  limit=1 prev=yes
            recordSelections=true      authored=9  block=2026-07-20  limit=1 prev=yes
            recordSelections=true      authored=9  block=2026-07-27  limit=1 prev=yes
            recordSelections=true      authored=9  block=2026-08-03  limit=1 prev=yes
            -> 36 rows

PRE-SEASON  recordSelections=undefined authored=9  block=2026-07-13  <- onboarding: records NOTHING
            -> 0 rows
```

Two facts, and both are wrong in different directions:

1. **The in-season "36 rows" is not the block's selection history.** It is ONE
   block written FOUR times under FOUR fake block identities, by per-week repair
   regenerations (`microcycleLimit: 1`) that are not block authorship.
2. **The pre-season athlete triggers no repair, so nothing is recorded at all.**
   Their next block boundary rotates against a history their accepted block never
   wrote — the defect class `scripts/trace-selection-history.ts` was built to
   measure.

**`docs/…` note for the record: `memory/a-generation-input-must-survive-boot.md`
carries the refutation *"rotation is not starved and block 2 does rotate — 36
selections recorded"*. That measurement was taken on the IN-SEASON athlete, whose
36 come from the mis-keyed repair writes above. The original finding — that
`CompleteScreen`'s generation omits `recordSelections` — is TRUE.**

**NOT FIXED, and named rather than half-built.** `generateProgramFromProfile` has
FOUR production callers (onboarding, `useProgramRebuild`, `coachTurnController`,
`coachProgramEdit`), and only one of them installs what it builds, so it is the
wrong place for the flag; and removing `recordSelections` from the repair
regeneration would move rotation for every athlete. That is a decision about
which caller counts as accepting a block, and it is its own unit. It does not
affect the visible week either way — with the fix above, both worlds are
byte-identical across a restart regardless.

The suite reports it in words on every run, and the conservation cell deliberately
does NOT count it: a row appearing for the first time is acceptance never having
written it, whereas a REWRITE would be the accepted block being re-authored. The
rewrite case has its own cell and is green in both worlds.

## WHAT I HAVE NOT TOUCHED

No screen, no generation module, no store schema, no new stored state. The tree
carries five files: the new suite, its `package.json` script, the moved read in
`acceptedStateTransaction.ts`, one fixture repaired to use the door it claims to
model, and this document.

`git status` before every commit; `git commit -- <pathspec>` only.
