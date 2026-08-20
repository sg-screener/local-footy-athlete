# HANDOFF — A PROFILE CHANGE REGENERATES TWICE, AND THE SECOND BUILD EATS THE FIRST

**Owner: the settings / persistence lane. Raised by seat `finish-coach-product`
on 2026-08-20 while building R-105. NOT FIXED HERE, by Sam's ruling.**

**Sam, 2026-08-20, ruling on it:**

> *"Do not add a warning saying 60 of 90 loads may move. That is a transaction
> defect, not intended product behaviour. Existing exercises must retain
> progression from their own history; new exercises use their own history or
> authored starting estimate. Record the exact double-regeneration handoff for
> the settings/persistence lane."*

So the intended behaviour is stated and is not what the app does:

- **an exercise that was already in the program keeps the progression its OWN
  history earned;**
- **an exercise that is new to the program starts from its own history if it has
  one, and otherwise from its authored starting estimate.**

---

## THE MEASUREMENT

Instrument: `npm run test:coach-weekly-reduction`, section [7]. One athlete,
cold-started through `CompleteScreen`'s own three calls, 28 days recorded through
`recordDay`, rolled over through `rolloverProgramBlock`, then a real
`confirmWeeklyCommitment` for a larger weekly commitment.

| measured | value |
| --- | --- |
| prescriptions in the delivered block | 90 |
| differing between a PRE-acceptance build and the delivered program | **60** |
| what differs | **loads only** |
| the DAY SET, before vs after | **identical** (`d1,d2,d3,d4,d6`) |
| `weightOverrides` before vs after the transaction | **byte-identical** |
| the delivered program vs the same builder re-run AFTER acceptance | **exactly equal** |

**THE LAST ROW IS THE FINDING.** The program the athlete is left on is reproduced
exactly by re-running the builder *after* acceptance — whose `previousProgram` is
then the FIRST build. So a profile change produces a program, publishes it, and
then regenerates on top of it; the second build reads the first as its previous
program and re-derives loads from it.

**The override sweep is NOT the cause** — `weightOverrides` are byte-identical
across the transaction, so this was checked and excluded rather than assumed.

## THE TWO PRODUCERS, NAMED

| producer | `progressionHistory` | `previousProgram` |
| --- | --- | --- |
| `store/profileProgramTransaction.ts` → `factFreeBase` | **none passed** | the program before the change |
| `utils/weekRebuild.ts` → `generateProgramForProfileFromStore` | the store's `sessionFeedback` / `weightOverrides` / `blockState` / `acceptedBlocks` | the program before the change |

`factFreeBase` builds what the transaction publishes. The program the athlete
ends up on matches the SECOND shape, built again afterwards.

`generateProgramForProfileFromStore` and its explicit-input twin
`generateProgramForProfile` were extracted from `rebuildLocalWeek`'s step 1 by
this seat, verbatim, so both callers share one argument list. **That extraction
is available to the fix and is not itself the fix.**

## WHAT A FIX HAS TO DECIDE

1. **Which producer owns the program after a profile change** — one of them, not
   both. Two builders with different generation inputs is the two-representations
   defect this repo exists to kill.
2. **Whether `factFreeBase` should pass `progressionHistory` at all**, or whether
   the transaction should stop building a program and let the rebuild owner do it.
3. **How Sam's rule is expressed once there is one producer:** an existing
   exercise keeps its own history's progression; a new exercise uses its own
   history or its authored starting estimate. Today the answer depends on which
   of two builds the athlete happens to receive.

## WHAT THE COACH LANE DID INSTEAD, SO IT IS NOT MISTAKEN FOR A FIX

The optional-session preview **claims structure and does not claim loads**: the
day, whether it is new or joins a day already trained, the session's typed
components, and the week's authored load context (`weekKind`, `deloadDoor`,
`intensityMultiplier`, the training-day counts). Those are identical across both
builds and are therefore true whichever one lands. **No warning about moving
loads was added — Sam ruled that out, because it would be the app apologising for
a defect instead of fixing it.**

## HOW TO SEE IT AGAIN

```
npm run test:coach-weekly-reduction
```

Section [7] prints, on every run:

```
MEASURED: 60 of 90 prescriptions differ between a pre-acceptance build and the
delivered program (loads only; the day set is identical). Cause: the profile
change regenerates twice.
```

That line is a measurement, not an assertion — it will follow the defect if the
number moves, and it will still be printed when the defect is gone (as `0 of N`).
