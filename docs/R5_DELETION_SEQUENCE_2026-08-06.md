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

> **R5.2 IS RE-CUT (2026-08-06), per §5's own clause.** The batch was measured
> before deletion and it does not hold as written. Three corrections:
>
> **(a) The owner was WRONG where the rival was RIGHT, and that is now fixed.**
> `assembleScheduleState` read `onboardingData?.seasonPhase` directly;
> `useScheduleState` resolves it through `ownSeasonPhase` — the CLOCK — and its
> own comment records the incident that caused the change ("a failed phase-shift
> rebuild left the visible week built from one and labelled by the other",
> phase-ownership collapse `46fe2df`). Deleting the rival first would have
> deleted the only correct copy of a paid ruling. It matters more in the owner
> than it did in the rival: since **R5.1 this is the boot authority**
> (`quiescentBoot:154` → `buildScheduleStateImperative` → here), so a skewed
> world derived its week under the profile's answer on every relaunch. Gate
> written first and RED on HEAD (L11); now green, `test:bible` `TRUE_EXIT=0`,
> differential golden byte-identical.
>
> **(b) `buildScheduleStateImperative` is NOT a rival and must not be deleted.**
> It already delegates (`coachWeekDiff:127` → `assembleScheduleState(
> gatherDeriveInputs())`), and `derivedWeekOwnershipTests` fails the build if it
> stops. It has 23 product referrers. §2 listed it under "LR-13's rivals"; that
> is a census note, not a deletion target.
>
> **(c) The projection trio is NOT payable in R5.2.**
> `visibleProgramReadModel` (23 product referrers) and `visibleProgramProjection`
> sit inside `coachCommandExecutor` / `coachTurnController` / `coachProgramEdit`
> — **the coach pipeline, under LR-6's standing STOP**, which §4 says holds.
> `modalityPreferences` is the same story: it is not on `ScheduleState` at all
> and never reaches the resolver; it feeds `visibleProgramProjection`, so it is
> projection-path work, not an assembly gap. LR-13 therefore CANNOT be retired
> by this batch and its ceiling does not drop here.
>
> **What remains of R5.2:** retiring the reactive rival itself. It is a private
> assembly behind six exported hooks, so it is a delegation, not a file
> deletion — and this repo has **no mounted-render test** (the suite says so in
> its own header), so the reactivity it exists for cannot be verified by
> execution here. That makes it a **device-pass item**, and it is carried to
> Sam's combined pass rather than landed blind.

**R5.3 — the accepted-state layer.** `acceptedStateTransaction`,
`coachMutationTransaction`'s envelope, `acceptedMaterialContext` and the
mirrors. Empties `workBillTests.DECLARED_MIRROR_BILL` (six stores) — rule 2
of that suite forces it. Retires LR-4, LR-26, LR-30.

> **R5.3 IS RE-CUT (2026-08-06), per §5's own clause, and the re-cut moves the
> SLICE BOUNDARY rather than this batch's contents.** Measured before deleting,
> as R5.2 was. Six corrections, and the first one governs the rest.
>
> **(a) R5.1 IS ONE DOOR OF N, so R5.3's precondition does not hold.**
> `settleDerivedWorldAfterDecision` has exactly ONE caller in the entire tree:
> `injuryEpisodeTransaction.ts:622`. The fixture door still publishes a
> materialised replan (`fixtureMutationTransaction.ts:370`,
> `rebuildLocalWeek({ scope: 'weekOverlay' })`) and still appends at `:804`.
> `fixture-identity-3` is STILL RED and still measures exactly this — run on
> this tree it reports the published week disagreeing with derivation on 3 of 7
> days (Monday's session identity and size, two team-night pairings). R5.1's own
> commit (`cdb78b48`) is honest about it: it deleted `fact-door-inputs` cell 3
> and did NOT delete `fixture-identity-3`. §3's R5.1 line claims both cells are
> paid in the greening commit; **one was.** Every deletion in R5.3–R5.6 rests on
> "derive() has no rivals", and derive() has rivals at every door but one.
>
> **(b) The remaining doors are NOT the injury door's 14-line wrap.** The injury
> fact is one of the six PERSISTED keys, so regeneration reads it back as an
> input and settling is free. The fixture decision is not persisted — it lives in
> the LEDGER, and replay interprets it by calling
> `executeFixtureMutationInMemory` (`quiescentBoot.ts:174`), which is the replan
> engine. So settling a fixture decision re-publishes the overlay through the
> very engine the switchover exists to retire, and cell 3 would still red. The
> door also derives its own control flow from the replan's product —
> `executeCandidate` returns `no_change` when `result.reversibleAdjustmentId` is
> absent — so its outcome semantics move with it. This is a UNIT, not a wrap, and
> it is what the rest of R5 is blocked behind.
>
> **(c) LR-4 cannot retire here.** Live count 71 across 34 files, equal to its
> declared 71 (detector re-run on this tree). R5.3's whole surface holds **15**:
> `acceptedStateTransaction` 13, `coachMutationTransaction` 2. The other 56 are
> the coach pipeline under LR-6's STOP (`coachTurnController` 6,
> `planChangeProducer` 6, `coachCommandExecutor` 2, `coachRevisionTemplateContext`
> 1, `resetCoach` 1), the R5.2 device-pass rival (`useSchedule` 5), R5.5/R5.6 door
> bodies (`reversibleAdjustmentTransaction` 3, `temporarySourceFactTransaction` 3,
> `fixtureMutationTransaction` 2, `profileProgramTransaction` 2), and ~13 in
> onboarding and home screens that no R5 batch names at all. LR-4 is a
> CROSS-SLICE unit; no single batch retires it and its ceiling does not drop here.
>
> **(d) LR-26 cannot retire here, and its own census entry says who does.**
> The record TYPE lives in `rules/reversibleAdjustmentLedger.ts` and the restore
> path that reads the before side in full is
> `reversibleAdjustmentTransaction.ts` — both **R5.5**. R5.3 would delete two
> writer sites (`acceptedStateTransaction.ts:1332,1562`) and leave the type, the
> reader and the restore machinery standing until R5.5: a writer deleted while
> its reader lives is R5's own named failure mode. The before side also has 63
> reads in `coachCommandExecutor` and 16 in `coachProgramEdit` — LR-6's STOP, the
> same wall R5.2's projection trio hit. The entry states outright that the before
> side "becomes derivable, and deletes, when undo is rebuilt as
> replay-from-decisions: that is LR-29." **LR-26 retires in R5.5 with LR-29.**
>
> **(e) LR-30 cannot retire here.** Its named surviving owner is the
> GENERATION-time writer, and the measurement agrees: `exposureContract` refs are
> `postGenerationConstraintValidation` 62, `programStore` 57, `generateProgram`
> 17, and `acceptedStateTransaction` only 11. `assertEffectiveMicrocycleExposure`
> is defined in `postGenerationConstraintValidation.ts:688`. None of the bulk is
> in R5.3's surface. LR-30 is a generation-contract cut and needs its own batch.
>
> **(f) LR-8 IS MIS-ASSIGNED TO R5.4, and its founding count is STALE.** LR-8 is
> `skipConstraintProjection` — the fact door recording a fact that changes
> nothing — which has no relationship to the hydration category R5.4 deletes.
> Its founding names two call sites in `temporarySourceFactTransaction.ts`; there
> are now **three** product sites: `temporarySourceFactTransaction.ts:630,925`
> and `profileProgramTransaction.ts:393`. The third is an UNCOUNTED COPY of the
> declared shape, found by this measurement and corrected in the census in the
> same commit. And the flag is a field of the accepted-state proposal
> (`acceptedStateTransaction.ts:213`, consumed at `:724`), so what actually pays
> LR-8 is the switchover at the fact door plus this layer's deletion — **R5.6,
> not R5.4.**
>
> **R5.4 is also not the clean cut it reads as.** `programStore` uses six live
> symbols from the two hydration modules (`dropRetiredWeekOverlaysAtHydration`,
> `requireProgramHydrationIngress`, `ProgramHydrationIngressError`,
> `PROGRAM_STORE_PERSISTENCE_VERSION`, `projectHydratedStateDerivedFields`,
> `projectAcceptedMaterialContextDerivedFields`). This is the SAME finding §2
> already ruled for `appHydrationGate`, arrived at from the other end: **the
> migration is the dead category, the ingress classifier and the hydration
> projection are live readers.** R5.4 is a migration-half cut, not a file cut.
>
> **(g) WHAT THE SWITCHOVER IS WORTH, MEASURED — and it is an athlete-visible
> defect, not a tidiness argument.** A scratch probe drove the DURABLE fixture
> door (`executeFixtureMutationTransaction`, the one that appends) on the rest-
> Saturday world, then relaunched, then dropped only the published output.
> Three things came out of it:
>
> 1. **One fixture decision has THREE durable representations.** The persisted
>    life-fact (`calendarStore.partialize` writes `markedDays`), the ledger entry
>    (`fixture_add`), and the published overlay (`weekScopedOverlays['2026-08-10']`
>    — keyed by week START, so it is the whole week).
> 2. **Post-tap and post-relaunch AGREE, 0 of 7 days.** So the two engines do not
>    disagree ACROSS A RELAUNCH at this door, and the R5 §1 framing ("the week
>    after a tap is built by a different engine than the week after a relaunch")
>    is not what cell 3 measures here — replay re-runs the replan
>    (`executeFixtureMutationInMemory`) and REPUBLISHES the same overlay. The
>    published week always wins; the resolve never gets to be the answer.
> 3. **The replan and the resolve disagree 3 of 7, and the RESOLVE IS RIGHT.**
>    Against the pre-decision week: the pure resolve changes **2 of 7** days —
>    exactly the two the decision touches (Friday `Lower Hinge|7 -> Gunshow|6`,
>    the G-1 demotion; Saturday `REST -> Game Day`). The published replan changes
>    **5 of 7**, and the extra three are days the athlete never touched:
>
>    | Day | published replan | pure resolve |
>    |---|---|---|
>    | Mon 2026-08-10 | `Lower Body Strength` **4 exercises** | `Lower Squat` **8 exercises** |
>    | Tue 2026-08-11 | `Team Training + Upper Push` | `Team Training + Upper Pull` |
>    | Thu 2026-08-13 | `Team Training + Upper Pull` | `Team Training + Upper Push` |
>
>    So adding a Saturday practice match today costs the athlete **half their
>    Monday session** (eight exercises down to four) and **swaps both team-night
>    pairings**, for no reason either week can justify. The resolve keeps them and
>    still delivers the Game Day and the G-1 demotion. This is what
>    `fixture-identity-3` has been declaring since 2026-08-05, priced.
>
> **(h) THE ENTRY GATE WAS BUILT, AND IT PASSES — the overlay does NOT carry
> conservation.** §2's header says the overlay is how a fixture change conserves
> the athlete's other decisions, so the unit could not start until that was
> measured. A second probe made the athlete clear a Wednesday through the real
> door (`applyPlanChange`, which appends a `plan_change` entry), THEN added the
> Saturday fixture through the durable door, then dropped only the published
> overlay. **The cleared Wednesday survives the resolve, and survives a
> relaunch** — it is carried by `userRemovalConstraints` and the ledger, not by
> the overlay. So conservation is already decision-borne, and deleting the
> publish does not trade a known defect for a conservation loss. **The switchover
> at this door is unblocked.**
>
> **(i) AND THE GATE FOUND SOMETHING WORSE, now pinned as `fixture-identity-5`.**
> On the two-decision world, **post-tap and post-relaunch DISAGREE on 3 of 7
> days** — where the single-decision world agreed on 0 of 7. So R5 §1's framing
> ("the week after a tap is built by a different engine than the week after a
> relaunch") is literally true; it just needs two decisions of different kinds to
> surface. One untouched Monday, composed three ways:
>
> | engine | Monday 2026-08-10 |
> |---|---|
> | pure resolve (the pre-fixture Monday, untouched) | `Lower Squat` **8** |
> | published replan, at the tap | `Lower Squat` **7** |
> | ledger replay, after the relaunch | `Lower Body Strength` **4** |
>
> Both team-night pairings swap with it. Neither decision is lost — this is one
> week composed three ways, and **a relaunch alone is enough to change what the
> athlete trains.**
>
> This was UNMEASURED, and the reason is the shape this repo has now named six
> times: `quiescentBootTests` already asserts exactly this law — *"the world is
> its inputs: the visible week survives a relaunch by derivation"* — and it
> PASSES, because it acts ONE decision (`actOneDelete`) and a single-decision
> world happens to agree. **The assertion was right and the fixture coordinate
> was missing.** `fixture-identity-5` builds the missing coordinate, asserts the
> athlete's decisions survive FIRST (so decision loss reds as a worse finding
> than composition drift), and is declared red against the fixture-door
> switchover.
>
> **(j) FIRST DESIGN CANDIDATE, REFUTED BY MUTATION — do not spend a session on
> it.** The obvious reading of (b) is that boot applies the fixture TWICE — once
> as the persisted life-fact fed to `commitRebuiltProgram`
> (`quiescentBoot.ts:304`) and once through the replan in `replayEntry`
> (`:180`) — and that the doubling is what makes the relaunched week differ. It
> is structurally true that both happen. **It is not the cause.** Mutation:
> `return` before the fixture branch of `replayEntry`, making `fixture_add`,
> `fixture_remove` and `fixture_move` replay inert. Result: `fixture-identity-3`
> and `fixture-identity-5` both still red with **byte-identical** diffs, and
> cells 1, 2 and 4 stay green. So deleting the fixture replay interpreter does
> not pay either cell, and "one application instead of two" is not the unit.
>
> Stated precisely, because the negative result is only worth what it actually
> covers: removing the fixture replay does not change these two cells' outcomes
> on these worlds. `test:quiescent-boot` and `test:worn-world-boot` were NOT run
> under the mutation, so this is not a claim that the interpreter is dead code.
>
> What it leaves: the divergence is between the DOOR's replan overlay at tap time
> and `commitRebuiltProgram`'s own composition at boot time (plus `plan_change`
> replay ordering), not between one fixture application and two. Note the shape
> of the three answers before attributing them — boot's Monday
> (`Lower Body Strength|4`) equals the single-decision world's PUBLISHED Monday,
> while the tap's Monday in the two-decision world is `Lower Squat|7` and the pure
> resolve is `Lower Squat|8`. The next seat should attribute each of those three
> to its producer before changing any of them.
>
> **THE RE-SEQUENCE.** The switchover is not batch 1 of 8; it is batches 1..k,
> one per door, and it must finish before any deletion. Nothing in R5.3–R5.6 is
> payable until it does. What that makes the next unit: **finish the switchover
> at the fixture door**, which is what `fixture-identity-3` has been waiting for
> since 2026-08-05 and the only declared red in R5 still measuring the two
> engines. R5.7 (the coach scope cut) and R5.8 (the structural sweep) are
> independent of the switchover and stay payable in place.

**R5.4 — the hydration category.** `programHydrationIngress`,
`programHydrationProjection`, `acceptedStateColdStart`'s migration half,
`appHydrationGate`'s migration path. Retires LR-8 — **NO: see the R5.3 re-cut
(f). LR-8 is the fact door's flag and is paid in R5.6. R5.4 retires nothing
until a census entry is filed for the hydration migration itself.**

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
