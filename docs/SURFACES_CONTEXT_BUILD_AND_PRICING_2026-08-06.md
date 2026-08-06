# SURFACES-CONTEXT BUILD + FINAL PRICING — 2026-08-06

`SURFACES_CONTEXT_RULING_2026-08-06.md`, built and priced.
**The unit is BUILT and GREEN. The final pricing is NOT green — STOP.**
Build on `feat/r53-v3-switchover` at `dc8e8aef`; pricing on
`scratch/r53-pricing-4` (`ae242d43`), nothing merged.

## The build — conditions 1, 2, 3

`Section18AcceptedWeekGatewayInput`'s optional `userRemovalConstraints`
array is now a REQUIRED `AcceptedEffectiveWeekSurfaces`, and the field inside
the surfaces is required too. The same change runs one layer up
(`BuildFixtureMinimalReplanInput`), because leaving it optional there would
have reinstalled the class where the gateway could no longer see it.

Default-to-live is exactly one line — `buildFixtureProjection`'s
`args.sourceSurfaces ?? liveAcceptedEffectiveWeekSurfaces()`. Every other site
passes the surfaces it means: hydration passes the snapshot ARRIVING (the live
store still holds the world being replaced), the four
`postGenerationConstraintValidation` write validators pass the live world, the
deriver passes the state it is deriving from, and the delete-vs-move dual set
is two named surfaces objects — the composition surface withholds the proposed
constraint so the binned target survives as a relocation template, and
`evaluationSurfaces` carries it because the week is judged where the decision
landed.

**One reading was measured and refuted.** Wiring generation to the live world
made a rebuild-after-deletion refuse its own week (`athleteSessionDeletionTests`
regression 11): generation applies the SUBTRACTION without the COMPENSATION,
because the relocation and the typed reduction are accepted state a generator
has none of. So generation states the world it is BUILDING, at one named site,
with that cell as its payer. My earlier reading — that the store "IS the truth"
at generation — was wrong, and the cell is what proved it.

### Condition 1 — the probe's own taxonomy, re-run

Same instrument, same ten suites, 8,528 production entries on both sides:

```
                BEFORE      AFTER
agree            2,918      5,324
absent/empty     2,398          0   (no longer expressible; folded into agree)
PROPOSAL         2,827      2,827   preserved, and per door identical
FORGOTTEN          328          0   ✔
STATUS-DIFF         54         54
STALE                3        323
```

`FORGOTTEN 328 → 0` ✔. `PROPOSAL 2,827` preserved exactly — 241 / 331 / 7 / 3 /
631 / 361 / 1,253 per door, unchanged.

### Condition 2 — triaged to causes, not declared

- **STATUS-DIFF 54** — the re-add restoration staged and not yet committed: 45
  are the same constraint id reading `restored` in the proposal and `active` in
  the store, 9 the same with a second constraint present. This is the PROPOSAL
  class differing in STATUS rather than membership, and it is correct: the week
  must be judged where the athlete's re-add has landed.
- **STALE 3** (pre-existing, unchanged by this unit) — the reversible-adjustment
  UNDO, staging the world with the adjustment removed while the store still
  holds it (`reversibleAdjustmentTransaction.ts:830/906` →
  `acceptedStateTransaction.ts:729/770`). PROPOSAL's exact mirror.
- **STALE +320** — generation's one declared site (160 at `generateProgram`, 160
  the same calls' inner frames at `wholeWeekRepairEngine`). Payer named above.

### Condition 3 — priced, NOT pinned

`programStore.ts:902` is now `:915`, fed `hydratingSurfaces` — the snapshot
under hydration, not the live store, because during hydration the live store
holds the world being REPLACED. Measured 88 times in the witness set, every one
with an empty constraint set: **no cell exercises snapshot-vs-live, so the
distinction is wired and reasoned but unproven. That pin is OWED** and is named
here rather than implied by a green suite.

### The unit's own gate

```
deletion 24/24·5/5·3/3   accepted-state 23/23·10/10·10/10   move 22/22
gateway 91/0   phase-structure 11/11   whole-week-repair 14/14
week-identity 9/9   derived-repair 4/4   day-precedence 6/6
deletion-calendar 4/4  quiescent-boot 4/4  deriving-device 9/9
full bible: 138 suites, EXIT 1 at test:fixture-identity (cells 3/5/6 — the
unit's standing red, unmoved); the 18 suites after it in the chain run
separately, all EXIT 0, incl. action-walker:deep 20/0
typecheck gate PASSED — 459 against baseline, no file regressed
```

## Condition 5 — the final pricing, and the STOP

Scaffold merged onto the built unit (one conflict, imports; the scaffold's
repair search and the deriver door rewired to surfaces). All legs on:

```
                        PREVIOUS (89223151)   NOW
derived-week lawfulness      12/12 ✔          12/12 ✔   all worlds, incl. cell 3's
phase-structure              11/11 ✔          11/11 ✔
action-walker                20/0  ✔          20/0  ✔
action-walker:deep           19/1             19/1
fixture-identity             3/3 (needs 6/6)  3/3
deletion                     17/24·5/5·3/3    17/24·5/5·3/3
accepted-state               22/23·8/10·10/10 22/23·8/10·10/10
derived-repair-ownership     4/0              4/0
section18-gateway            —                91/0
athlete-session-move         —                21/1
```

**IDENTICAL ON EVERY ROW. The precondition unit is behaviour-neutral under the
scaffold, and it did not recover cells 15/16.** `relocated=undefined:undefined`
is exactly what it was.

### The residual, named

The ruling this unit descends from held that the search relocates over a
decision because five of twelve callers never passed the constraints. **That
diagnosis is now refuted by measurement.** Every door states its world,
`FORGOTTEN` is zero, and the cells fail identically.

Instrumenting the search's own entry — 1,045 relocate probes across the
deletion suite — gives one answer and only one:

```
1045  rules/wholeWeekRepairEngine.ts:113  <-  utils/sessionResolver.ts:955
      constraints=(none)      standDown=false      (1045 of 1045)
```

**Every entry to the repair search arrives through the TIER-4 DERIVER door, and
none through a deletion-transaction door.** The five forgotten doors were
generation, live-write validation and hydration — none of them is on the repair
path, so closing them was never going to move these cells.

And the deriver's constraints are empty for a signed reason.
`resolveFinalVisibleSection18Week` builds its `ScheduleState` with
`userRemovalConstraints: []` deliberately
(`section18AcceptedWeekGateway.ts:380`, "blanked explicitly from 2026-08-04"):
the removals have ALREADY been folded into `constrainedWorkouts` above, and
re-feeding them would apply each twice — which for a bin would re-remove the
`remainingWorkout` remainder it left behind. Tier 4 runs downstream of that
state, so `args.state.userRemovalConstraints` is `[]` at every search entry.

**That reason is right for APPLICATION and wrong for the SEARCH'S QUESTION.**
The search does not want to re-apply the removal. It wants to know whether a
DECISION explains the gap, so it can stand down and let the deletion class's own
relocation — the one that records the typed ownership making a restore
reversible — run first. A field emptied because it has already been APPLIED is
invisible to a later question about WHY the week looks the way it does.

So the residual is not a census and not a threading defect. It is a **consumed
input**: one representation carrying two questions, emptied by the first
consumer before the second consumer is asked. Which is the same disease this
whole unit has been treating, one layer further in.

Still owed and untouched: condition 4's clock fix — and the number MOVED, 146
wall-clock stamps → **172** (4 distinct) under the merged tree, because more
derivation now runs. Condition 3's pin, as named above.
