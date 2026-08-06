# R5 — THE RECKONING: DELETION SEQUENCE

Executes slice R5 of `docs/SHELL_REBUILD_PLAN_2026-08-05.md` (approved
2026-08-05, `docs/SHELL_REBUILD_PLAN_APPROVAL_2026-08-05.md`). R1–R4 are
landed and Sam-passed on hardware.

**Baseline, measured before any deletion:** full `test:bible` on `91446fe3`,
clean tree, **printed `TRUE_EXIT=0`**, chain reached its last suite
(`test:stage-b-generation-differential`, 3 passed / 0 failed).

---

## §1 The finding that sets the order

R5 was written as a deletion slice. It is not one, and the code says so
before any judgement is applied.

The persisted surfaces are **already** inputs-only: `programStore`'s
`partialize` (`programStore.ts:2223`) writes six keys — the generation
anchor, the season-phase clock, session feedback, weight overrides,
temporary source facts, injury episodes. The envelope, `dateOverrides`,
`weekScopedOverlays`, `userRemovalConstraints`, `acceptedMaterialContext`
and the exposure contracts are **not persisted**. R1.3 did that.

What survives is not stored output. It is a **second composition engine**,
alive in memory and still driving the doors:

- a live door appends its ledger entry **and** publishes a materialised
  replan (`fixtureMutationTransaction.ts:310` `rebaseAcceptedEffectiveWeek`,
  then `:804` `appendDecisionEntry`);
- boot throws that published week away and **resolves** instead
  (`quiescentBoot.rebuildDerivedWorld`: regenerate, then replay the ledger
  through the door interpreters).

So the week an athlete sees after a tap is built by a different engine than
the week they see after a relaunch. That is not a hypothesis — it is what
two declared reds already measure:

| Cell | Suite | What it measures | `paidBy` says |
|---|---|---|---|
| `fixture-identity-3` | `test:fixture-identity` | published week ≠ derived week on three untouched days (Monday's session identity and size, two team-night pairings) | "R5, when `derive()` has no rivals and there is no published week left to disagree — the plan's own switchover" |
| `3` | `test:fact-door-inputs` | a hamstring injury derives Lower Squat + Continuous Aerobic before the relaunch and Upper Push + Upper Pull after it | "R5 (the switchover: `derive()` becomes the only week authority)" |

**Therefore the deletion cannot come first.** `acceptedStateTransaction.ts`
and its family are not orphans waiting to be swept; they are the live
replan engine. Deleting them before the doors stop calling them is exactly
R5's named failure mode — a half-completed deletion. The switchover comes
first, the deletions cascade behind it, and each census retirement rides in
the commit that removes its surface.

## §2 The measured deletion surface

Non-test referrers, measured on `91446fe3`:

| File | Lines | Non-test referrers | Role today |
|---|---|---|---|
| `acceptedStateTransaction.ts` | 3,587 | 20 | the accepted-state boundary; still transacted per door |
| `programStore.ts` | 2,594 | many | door surface + derive cache + the replan's home |
| `temporarySourceFactTransaction.ts` | 1,246 | 7 | fact door body — still transacts, does not yet append+derive |
| `coachMutationTransaction.ts` | 951 | 8 | the generic transaction envelope every door runs inside |
| `reversibleAdjustmentTransaction.ts` | 920 | 6 | stored before-state undo (LR-29) |
| `injuryEpisodeTransaction.ts` | 875 | 6 | fact door body |
| `fixtureMutationTransaction.ts` | 835 | 5 | fixture door: publishes a replan **and** appends |
| `sessionOutcomeTransaction.ts` | 528 | 5 | results door |
| `profileProgramTransaction.ts` | 460 | 4 | phase-shift door |
| `programHydrationIngress.ts` | 379 | 1 | hydration migration — category R1.3 abolished |
| `acceptedStateColdStart.ts` | 283 | 18 | accepted-context normalisers, widely imported |
| `programHydrationProjection.ts` | 219 | 1 | hydration migration |
| `appHydrationGate.ts` | 217 | 3 | **boot entry, still live** — calls `runQuiescentBoot` |

`appHydrationGate` is listed for deletion in plan §1 under "hydration
migration ceases to exist as a category". Measured: the *migration* is the
dead category; the file is also the persisted-store hydration-readiness gate
that `useInitializeApp` and `RootNavigator` mount on, and the registry
`onboardingReliabilityTests` D1 uses to fail the build on an unregistered
store — which is the same enumeration §7's structural sweep needs. **Ruled:
the migration path is deleted, the readiness gate and its registry survive
and become §7's input.** Deleting the gate would delete the enumeration the
completion condition is defined over.

LR-13's rivals, separately: `useSchedule.useScheduleState` (413),
`ScheduleDebugPanel`'s third copy, `coachWeekDiff.buildScheduleStateImperative`
(already delegating), `visibleProgramProjection` (380),
`visibleProgramReadModel` (795), `weeklyPlanDisplay` (166).

## §3 The batches — each a verified stop

Every batch ends with full `test:bible` **`TRUE_EXIT=0` read off the printed
line**, a clean tree, and its census ceiling drop in the same commit. No
batch begins before the previous one is green.

**R5.1 — THE SWITCHOVER.** Doors stop publishing a materialised replan.
A door appends its decision and the week re-derives, one owner, the same
body boot already runs. Pays `fixture-identity-3` and `fact-door-inputs`
cell 3 — both cells are deleted in the greening commit, per the ratchet
direction. Nothing is deleted yet; the replan engine simply loses its
callers.

**R5.2 — LR-13: the rivals die.** With one authority live, the declared
rival (`useScheduleState`), the debug panel's third copy, and the surplus
projections are deleted. Retires LR-13 with its ceiling drop.

**R5.3 — the accepted-state layer.** `acceptedStateTransaction`,
`coachMutationTransaction`'s envelope, `acceptedMaterialContext` and the
mirrors. Empties `workBillTests.DECLARED_MIRROR_BILL` (six stores) — rule 2
of that suite forces it. Retires LR-4, LR-26, LR-30.

**R5.4 — the hydration category.** `programHydrationIngress`,
`programHydrationProjection`, `acceptedStateColdStart`'s migration half,
`appHydrationGate`'s migration path. Retires LR-8.

**R5.5 — reversal by decision.** `reversibleAdjustmentTransaction` and the
stored before-state. Retires LR-28, LR-29.

**R5.6 — the fact and results door bodies.** `temporarySourceFactTransaction`,
`injuryEpisodeTransaction`, `profileProgramTransaction`,
`sessionOutcomeTransaction` become append+derive. Retires LR-3, LR-7;
verifies and closes LR-10/LR-11.

**R5.7 — the coach cut (§6).** The free-text entry point does not appear in
the beta build. Decision C(a), signed. Any copy this changes ships PROPOSED.

**R5.8 — the structural sweep (§7) + the bible re-link.** A permanent suite
enumerating every persisted key, failing on any key not declared profile /
fact / decision / result, with the coach-era stores as a dated, shrink-only
exception list. Suites that drove old transaction internals move to the
doors' new bodies; totals-or-red everywhere. Census reconciled and the
founding-count bookkeeping settled.

## §4 What is NOT in R5

- Sam's combined device pass. **It is the merge gate, and the review seat
  writes the tap list.** This seat does not send him to his phone.
- `fact-door-inputs` cell 6 (the stranded session cap) — its own `paidBy`
  names "a named unit", not a slice boundary. It is carried, not paid here,
  unless R5.6 lands its owner as a by-product.
- LR-6 and the 29k coach pipeline. The STOP holds; §6 is a scope cut, not a
  retirement.
- Performance numbers. Re-derive-per-tap replaces replan-per-tap; the cost
  is measured on a Release build at R6, and nothing here quotes a figure.

## §5 NOT-COVERED

- The batch boundaries above are ruled from the measured referrer graph, not
  from a trial deletion. A batch that turns out to be entangled is re-cut at
  its own boundary and this document is corrected, not worked around.
- No device pass, no Maestro run. Every finding in §1 and §2 is a static
  source trace plus the two suites' own declared measurements.
- `src/dev/e2e/` (54 files) references the replaced machinery through
  `explorerProductionBindings` and `defaultDevE2ESeedCoordinator`. Both are
  in the referrer counts; the explorer's other modules were not swept.
