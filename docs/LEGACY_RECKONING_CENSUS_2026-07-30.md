# Legacy Reckoning Census — 2026-07-30

**Read-only.** No code changed. The concurrent session owns the `src/` lane;
nothing here touched it.

**Why this exists.** The profile-wipe saga (`docs/LOST_ONBOARDING_DIAGNOSIS_2026-07-30.md`)
cost five device round trips and three of Sam's onboardings. Every layer in it
was individually defensible. What made it lethal was that the store predated the
laws it was eventually judged by — nobody owned the write, nobody could name the
writer, and the record could not correct itself. Sam's ruling: **stop waiting for
pre-law code to break. Map it, and schedule its reckonings deliberately.**

This document is the map. Part 1 states the law book as one list. Part 2 sweeps
the subsystems against it. Part 3 is the single ranked reckoning list (queued
items folded in, not kept as a second list). Part 4 proposes the ratchet.

**Method.** Static source trace over 796 non-test source files plus
`supabase/functions/`, cross-read against `AGENTS.md`, `CLAUDE.md`, the Master
Plan's Process Law, and 20 ruling/reassessment/audit docs. Creation and
last-touch dates come from `git log --diff-filter=A`, which is how "predates the
law" is decided rather than asserted. Prior censuses
(`LIVE_LEGACY_WIRING_CENSUS_2026-07-24.md`, `READINESS_CENSUS_SWEEP_2026-07-29.md`,
`NON_BIBLE_TEST_ROT_SWEEP_2026-07-29.md`, the §18 retirement ledger, the
dead-affordance inventory) were re-verified against current source rather than
carried forward — four of their twelve findings are now closed and are marked so.

**The law era.** The repo starts 2026-05-04. `acceptedStateTransaction.ts` lands
2026-07-15; the §18 ownership reassessment 2026-07-22. Everything created before
2026-07-15 and not re-owned since is **pre-law by construction** — that is 100%
of `src/utils/coach*`'s core, the generation engine, the session resolver, and
ten of the twelve persisted stores.

---

# PART 1 — THE LAW BOOK

Derived from the record, not from any one document. Each law names the gate that
proves it today, or `—` where nothing does. **A law with no gate is a stated
intention, not an enforced law**, and that distinction does most of the work in
Part 3.

## A. Ownership

| # | Law | Source | Gate |
|---|---|---|---|
| **L-A1** | **One owner per fact.** A fact has exactly one owner. Two representations of the same decision is the defect, not the disagreement between them. | AGENTS.md escalation Q2/Q4; `weeklyDoseOwnership`; `seasonPhaseOwner` | `test:section18-ownership`, `test:weekly-dose-ownership`, `test:phase-ownership`, `test:single-estimation-owner`, `test:severity-scale`, `test:readiness-ownership` |
| **L-A2** | **One door per write.** Every write of a fact goes through its owner. *A guard only one of two callers passes through is not a guard.* | LOST_ONBOARDING §2; `profileMirrorNarrowing.ts` | `test:profile-mirror-narrowing` (profile store **only**) |
| **L-A3** | **Athlete-placed outranks derived.** The placement stamp alone is ownership; every landing door writes it, and derivers must ask the same question about the athlete's day. | `athletePlacement.ts`, `g1LandingAsk.ts`, commits `bccee2d`/`9d48931` | `test:placement-ownership`, `test:g1-landing-ask-flow`, `test:displacement-sweep` |
| **L-A4** | **Live answers outrank snapshots.** When a stored snapshot is missing answers the live profile has, the RECORD is what is wrong. It is re-minted, not republished. | LOST_ONBOARDING §"The residue, closed"; `staleAcceptedSnapshotRepair` | `test:accepted-state-transactions`, `test:profile-mirror-narrowing` |
| **L-A5** | **A derived property never decides identity.** Not intensity, not position, not name. Read the authored structure. **Widening the heuristic is not the fix.** | MASTER_PLAN PART 3 (Sam's standing class) | `test:readiness-illness-law`, `test:deload-law`, `test:session-template` (intensity leg only) |
| **L-A6** | **The clock owns season phase**; `profile.seasonPhase` is its input, never its answer. | `seasonPhaseOwner.ts`, merge `46fe2df` | `test:phase-clock`, `test:phase-ownership`, `test:phase-shift-atomicity`, `test:phase-skew-repair` |
| **L-A7** | **Deletion doors don't decide schedule facts.** A door that removes a session must not also write what the day *is*. | `LOCKED_DAY_DIAGNOSIS_2026-07-30.md` §3 | `test:deletion-calendar-ownership` (**in flight, uncommitted**) |
| **L-A8** | **Facts record; constraints derive; the visible week is a projection.** | Process Law L6 | `test:temporary-source-facts`, `test:render-truth`, `test:visible-program-projection` |

## B. Derivation

| # | Law | Source | Gate |
|---|---|---|---|
| **L-B1** | **Structure from phase + schedule; dose from capacity.** Readiness never sets structure; "dose down, never block" extends to weekly session counts. | Sam 2026-07-28, `BATCH0_RULING_APPLIED` | `test:readiness-structure-law`, `test:readiness-dose-sweep` |
| **L-B2** | **Injury flows through its own law family** — never through the readiness channel. | same ruling | `test:injury-authority`, `test:fact-horizon` |
| **L-B3** | **Ask when no fact answers; derive when one does.** The smallest useful clarification, once. | AGENTS.md coach rule 3; bye-recovery ruling `4becbd7` | `test:g1-landing-ask-flow`, `test:coach-clarifier-advance` |
| **L-B4** | **A preference changes future planning; it never invalidates accepted history.** | Sam 2026-07-28, `readinessStructureCensus.ts` preamble | `test:accepted-state-transactions` (indirect) |
| **L-B5** | **No invented numbers.** Every load-bearing number is Sam-authored and gated from both directions. Absence rendered as approval is the repo-wide defect this closed. | provenance lock `2f633ee`..`0e983eb` | `test:bible-anchors`, `test:anchor-multipliers`, `test:load-ratio-rulings`, `test:pending-lists`, `test:capacity-rubric`, `test:exposure-contract-equality` |
| **L-B6** | **The vocabulary IS the pool.** AI naming rights removed; hardcoded exercise-name literals fail the build. | `ada0510`, `3639841`, `958a1fc` | `test:exercise-name-lock`, `test:locked-list`, `test:generation-vocabulary`, `test:authored-cues` — **scoped to `src/` only** |

## C. Honesty

| # | Law | Source | Gate |
|---|---|---|---|
| **L-C1** | **Visible success, refusal and failure — never silence.** Any tap that implies success must demonstrably do the thing; false-Done is a release blocker. | Process Law L6 | `test:athlete-safe-refusal`, `test:coach-failure-copy`, `test:onboarding-generation-outcome`, `test:accept-boundary-contract` |
| **L-C2** | **No dead affordances.** Every visible control works or does not exist. | Process Law L5 | `test:no-rebuild-affordance` + the dead-affordance inventory (a document, not a gate) |
| **L-C3** | **Raw error codes and developer strings never reach the athlete.** Curated copy owner; diagnostics log-side only. | `planChangeRefusalCopy.ts`; FULLSWEEP item 8 | `test:coach-failure-copy` (coach surface only) |
| **L-C4** | **A refusal is a result.** Refusing in words beats a silent partial apply. | `programMutationRefusal.ts`, `98d2dee`, `9d86e4c` | `test:move-scoping`, `test:athlete-safe-refusal` |

## D. Instrumentation

| # | Law | Source | Gate |
|---|---|---|---|
| **L-D1** | **Every writer on the tape.** Applied or refused, a write names its writer and the counts either side of it. | LOST_ONBOARDING addendum ¶4 | `test:action-log`, `test:profile-mirror-narrowing` (profile store only) |
| **L-D2** | **Instrumentation must be alive where the defects are.** Not `__DEV__`-only, not test-only. *A diagnostic that is off on the build the defect lives on is a green gate that lies.* | AGENTS.md §"Instrumentation" | `test:action-log`, `test:athlete-action-diagnostics` |
| **L-D3** | **A fixture whose input cannot exhibit the defect proves nothing**, however many assertions it carries. | same, 2026-07-29 | `ed634f3` (fixture seeded from real device bytes) |

## E. Gates and process

| # | Law | Source | Gate |
|---|---|---|---|
| **L-E1** | **A gate that reads code is coupled to code SHAPE.** After any de-duplication, re-verify the gate still matches. | AGENTS.md §"De-duplication" | — (a discipline, unenforceable by construction) |
| **L-E2** | **Declared debt only goes down**, and the baseline equals the current debt so paying leaves no re-spendable slack. **A census must be able to die.** | `readinessStructureCensus.ts` | `test:readiness-structure-law` |
| **L-E3** | **A suite that reports nothing is worse than no suite.** | `NON_BIBLE_TEST_ROT_SWEEP_2026-07-29.md` | — (the sweep is a document; nothing runs it) |
| **L-E4** | **Mutation-test the gate**, and commit before mutation-testing. | AGENTS.md Environment Facts; several unit reports | — |
| **L-E5 … L-E14** | **Process Law L1–L10** — whole-app scope; mandatory NOT-COVERED; cold-start passes; device is arbiter; no dead affordances; honest actions; Sam gates; reporting calibration; checkpoint discipline; **Sam's phone is the definition of done**. | `MASTER_PLAN_2026-07-23.md` PART 1 | — |

**Count: 25 standing laws.** Eleven have a gate that proves them across the whole
app. Eight have a gate that proves them **on one file or one surface** and are
silently unenforced everywhere else — L-A2, L-C3 and L-D1 are the three that
produced this census.

---

# PART 2 — SUBSYSTEM SWEEP

## 2.1 Persisted stores — the athlete's durable state

Twelve `persist(...)` stores. `appHydrationGate.ts` registers all twelve and
`onboardingReliabilityTests` D1 fails the build if a thirteenth escapes — that
part is solid. What is **not** covered is who may write them.

| Store | Created | Write owner | On the tape | What an athlete loses |
|---|---|---|---|---|
| `profileStore` | 05-04 | ✅ `applyProfileOnboardingWrite` (one door, refuses, names its writer) | ✅ | — *(closed 2026-07-29)* |
| `programStore` | 05-04 | ⚠️ accepted-state transaction for *accepted* state; **`setManualOverride` is an unowned raw primitive** | partial — hydration/persistence only | the visible week |
| `calendarStore` | 05-04 | ❌ six writers marked `COMPATIBILITY-ONLY` in their own JSDoc, with three live callers | ❌ | game/rest days → the whole week's structure |
| `readinessStore` | 06-05 | ❌ (projects from accepted facts on read, but writes freely) | ❌ | today's readiness signal |
| `coachUpdatesStore` | 05-04 | ❌ | ✅ | coach notes / adjustment cards |
| `coachMutationHistoryStore` | 05-13 | ❌ | ❌ | the mutation history AGENTS.md requires for follow-up resolution |
| `coachPreferencesStore` | 05-13 | ❌ | ❌ | modality preferences |
| `athletePreferencesStore` | 05-04 | ❌ | ❌ | exclusions, pins, active injuries |
| `coachStore` | 05-04 | ❌ | ❌ | chat history |
| `coachMemoryStore` | 05-04 | ❌ | ❌ | coach notes |
| `uiStore` / `authStore` | 05-04 | ❌ | ❌ | negligible |

**Eleven of twelve have no single write owner and nine have no tape.** (The table
above marks `programStore` ⚠️ rather than ❌ because its *accepted* state is
owned; the gate counts it as unowned, because ownership means one door **and**
typed refusals **and** the writer on the tape, and `setManualOverride` has none
of the three. That is what LR-1 exists for.) Every one of them is the profile
store's shape as it was on 2026-07-28 — the day before the fix.

Two hand-maintained registries must agree about this set and nothing checks that
they do: `appHydrationGate.PERSISTED_STORE_HYDRATION_REGISTRY` (12 entries) and
`resetCoach.ts` (22 hand-listed `clear:` closures spanning persisted and
in-memory stores). A store added to one and not the other is a silent gap in
either boot or reset.

**Not persisted, and worth a decision rather than an assumption:**
`workoutLogStore` (logged sets, in-memory — they do not survive a relaunch),
`pendingCoachClarifierStore`, `coachContextStateStore`.

## 2.2 The raw program-write primitive

`programStore.setManualOverride` describes itself honestly:

```
// Raw storage primitive. User-facing tap/coach edit paths must run
// pre-commit risk checks before reaching this; undo/rebuild/system
// cleanup paths intentionally keep direct access.
```

**16 files reference it, 18 call sites.** Among them: `PlanChangeSheet.tsx:261`
(a screen, injecting it into the producer), `defaultDevE2ESeedCoordinator.ts:303`
(a dev seam writing product state), `coachActions.ts` (8 call sites),
`coachTurnController.ts`, `coachUndoEngine.ts`, `coachModalitySwapOrchestrator.ts`,
`applyAdjustmentEvents.ts`, `lighterDayTransaction.ts`, `programControlActions.ts`,
`coachRevisionOverrideWriter.ts`.

This is L-A2 unenforced on the store that holds the week. It is the same shape
that took four device round trips to name a writer in the profile store, with
one difference that makes it worse: the profile store had two writers and this
has sixteen.

## 2.3 The coach pipeline

49 modules under `src/utils/coach*`, plus 5 edge functions. Core created
2026-05-13, i.e. two months before the first ownership law.

**A single athlete request has at least six typed representations** before it
reaches a transaction:

`CoachIntentPayload` (`coachIntent.ts`) → `CoachMutateOperation`/`CoachCommandTarget`
(`coachCommandRouter.ts`) → `ProgramEditDraftAction` (`coachProgramEditDraft.ts`) →
`CoachRevisionIntent` (`coachRevisionProposal.ts`) → `CoachResolvedTarget`/`CoachTargetFrame`
(`coachTargetFrame.ts`) → `CoachPlanChangeKind` (`coachPlan.ts`)

— plus the LLM's tool-call JSON from `coach-chat/index.ts`, plus the tap door's
own `PlanChange`. `coachIntentDispatcher.ts:104` still names its fallback "the
legacy /coach-chat".

This is precisely what the CLAUDE.md escalation rule exists to stop, and its
question 2 ("how many representations of the user request exist?") has an answer
of at least eight. **Six of the nine suites that crash silently on load are in
this cluster** (`coach-orchestration`, `coach-live-wiring`, `coach-live-path-v2`,
`coach-note-display`, `coach-update-card-ui`, plus `injury-episode-commands`) —
the least-owned surface is also the least-observed one.

## 2.4 §18 retirement-ledger residuals — re-verified, still open

`planChangeProducer.ts` still defers four cases to the legacy writer
`coachRevisionOverrideWriter.applyCoachRevisionDateOverrides`:

- `:1583` occupied-day stack add
- `:1594` add onto a day with an active removal constraint
- `:1596` / `:778` `no_template_for_category`
- `:1365` "Occupied-day stacks stay on the legacy writer"

`coachTurnController.ts:2343,2429` calls the same legacy writer directly. Both
terminate through `setManualOverride`, so they reach accepted-state validation
but bypass the dedicated-transaction pattern the tap doors were migrated onto.

## 2.5 The generation engine and the resolver

`coachingEngine.ts` — **8,229 lines**, created 2026-05-04, still the largest file
in the repo. The readiness census paid its 18 structure edges to zero, and the
weekly-dose ownership unit deleted 280 lines, so it is *partly* under L-B1 and
L-A1. Nothing else about it is owned.

`sessionResolver.ts` — created 2026-05-04. Its documented resolution priority
puts **"manual override" first and derives game-proximity fillers on every
render**. L-A3 (athlete-placed outranks derived) was written on top of this
ladder rather than into it, which is why the current code has to *refuse* a move
onto a G+1 filler day (`planChangeProducer.ts:1508`) — "it is regenerated every
render, so a real session moved onto its day is silently overwritten." That
refusal is a containment, and the ladder is what it contains.

## 2.6 The accepted-profile mirror readers

The publication side is now closed (one door, refusal, tape, self-repairing
record). The **reader** side is not: ~30 live files read
`profileStore.onboardingData` as a decision input rather than reading the
accepted snapshot. `liveAthleteContext.ts` (commit `e0fb218`) consolidated the
session-builder derivation and has **two** callers. The July-24 census found
"the reader set is entirely decision-feeding, none display-only"; that is still
true.

## 2.7 Rendering projections

Three modules answer "what does the athlete see": `visibleProgramProjection.ts`
(2 exports), `visibleProgramReadModel.ts` (9 exports, created 05-13),
`weeklyPlanDisplay.ts`. Plus per-screen derivation in `useHomeScreen.ts` (2,235
lines) and `DayWorkoutScreenV2.tsx` (3,723 lines). L-A8 says the visible week is
a projection; it does not say from which of these.

## 2.8 Dev / E2E seams that touch product state

`defaultDevE2ESeedCoordinator.ts` writes product state through raw doors:
`useProfileStore.getState().clear()` (:100), `updateOnboardingData` (:497),
`completeOnboarding` (:500), `useProgramStore.getState().setManualOverride` (:303).
The profile calls now land on the one door (so they are taped and refusable);
the program call does not.

The 54-file `src/dev/e2e/` explorer harness reads product stores widely. Nothing
found writes accepted state outside the coordinator — but see NOT-COVERED.

## 2.9 The client/server vocabulary boundary

`hardcodedExerciseNameLockTests` fails the build on exercise-name literals — and
sweeps `src/` only. `supabase/functions/coach-chat/index.ts` (2,605 lines) carries
**39 lines** containing canonical exercise-name literals, outside the lock.
`injuryClarificationGuard.ts:13` states outright that the edge function "carries
an embedded mirror" of it. L-A1 and L-B6 stop at the network boundary.

## 2.10 The gates themselves

238 `test:*` scripts. **81 chained into `test:bible`; 157 outside it.** The
2026-07-29 rot sweep ran 155: **97 pass, 49 assert_fail, 9 LOAD_CRASH** (report
nothing at all). All 9 reproduce on clean `main`. `test:bible` also stops at the
first failing suite, so a recorded failure count is a floor, never a total.

---

# PART 3 — THE RECKONING LIST

One list. Queued items (5D.1–5D.4, G+1 storage form, producer fixtures,
add-optional→typed transaction, InjuryTag spelling, role-vocab collapse,
position-feeds-identity, renderer unit) are folded in at their rank rather than
kept separately; where a queued item *is* one of these units, it says so.

Ranked by **blast radius × law-violations**. Sizes: S ≈ a session, M ≈ 2–3
sessions, L ≈ a staged unit with a device gate, XL ≈ needs a reassessment before
it can be sized.

## Tier 1 — an athlete loses answers or accepted content

| # | Unit | Founding evidence | Laws it must land under | Size |
|---|---|---|---|---|
| **LR-1** | **One door to the program store.** Give `setManualOverride` the treatment `applyProfileOnboardingWrite` got: a single owner, typed refusals, writer named on the tape, build failure on a second writer. | `programStore.ts:1629` self-describes as a "raw storage primitive"; 18 call sites in 16 files, incl. a screen and a dev seed | L-A2, L-A1, L-A8, L-D1 | **L** |
| **LR-2** | **The other ten persisted stores get owners** (*= 5D.1 generalised*). Each store proves it can never delete an athlete answer, or is retired. Collapse `appHydrationGate`'s registry and `resetCoach`'s 22 clears into **one** store registry that both derive from. | §2.1; `calendarStore`'s own `COMPATIBILITY-ONLY` JSDoc with three live callers | L-A2, L-D1, L-E2 | **L** |
| **LR-3** | **§18 residuals leave the legacy writer.** Four producer deferrals + two direct `coachTurnController` calls migrate onto the transaction owners. | `planChangeProducer.ts:1365,1583,1594,1596`; `coachTurnController.ts:2343,2429` | L-A1, L-A2, L-A3, L-C1 | **M** |
| **LR-4** | **Mirror readers migrate to the accepted snapshot.** ~30 decision-feeding readers of `profileStore.onboardingData`; extend `liveAthleteContext` from 2 callers to all of them, largest first (`CoachScreen`'s AI-context spread, `ProfileScreen`'s edit-draft seed). | §2.6; LIVE_LEGACY #2, re-verified | L-A4, L-A1 | **M** |
| **LR-5** | **Failure-state sweep** (*= 5D.2*). Fault-inject every transaction mid-flight; assert the surviving state is whole and the athlete is told. | Season-phase skew: profile write landed, rebuild failed, nothing disclosed it | L-C1, L-C4, L-A8 | **L** |

## Tier 2 — the athlete sees a wrong, silent, or unreachable week

| # | Unit | Founding evidence | Laws | Size |
|---|---|---|---|---|
| **LR-6** | **Coach request representations: eight → one.** The escalation reassessment CLAUDE.md already requires, written before any further coach code. Its answer to Q2 is the finding, not the input. | §2.3; `coachIntentDispatcher.ts:104` "the legacy /coach-chat" | AGENTS.md escalation rule, L-A1, L-B3 | **XL** — reassessment first |
| **LR-7** | **The G+1 / derived-filler storage form.** A resolver-owned filler regenerated every render cannot be moved onto, so the producer refuses. Decide whether derived fillers are stored or derived, once, and delete the containment. | `planChangeProducer.ts:1508,1673`; `sessionResolver.ts` priority ladder | L-A3, L-A8 | **M** |
| **LR-8** | **`skipConstraintProjection` — a fact recorded that changes nothing.** Busy week / away days / missing equipment durably record a fact and never re-validate the materialised week. Either it rebuilds or it stops being a control. | `temporarySourceFactTransaction.ts:527,708`; dead-affordance inventory G7/G8/G9 | L-A8, L-C2, L-C1 | **M** |
| **LR-9** | **DELOAD_LAW row classification reads the authored structure** (*= 5D.4*). `isConditioningExerciseRow` decides from a regex over the name while `conditioningBlock.options[].exerciseIds` names the rows outright. **The regex is not to be widened.** | Registry templates "Flush Out — 2min On / 1min Off" and "3 x 8min zone 2 Rower" classify as strength accessories; accessory trim deletes the only row | L-A5 | **M** — `g1LandingAskFlowTests` 26 goes red on landing; that is the signal to delete the containment |
| **LR-10** | **Deletion doors stop writing schedule facts.** *In flight in the concurrent lane* (`deletionCalendarOwnershipTests.ts` + `userRemovalConstraints.ts` uncommitted). Listed so it is not double-scheduled. | `LOCKED_DAY_DIAGNOSIS_2026-07-30.md` §3 | L-A7, L-A1 | **S** (in flight) |
| **LR-11** | **Add-optional onto the typed transaction.** The last athlete door that reaches the store by injecting `setManualOverride` from a screen. Subsumed by LR-1 if LR-1 lands first; cheap to do alone if it does not. | `PlanChangeSheet.tsx:261` | L-A2, L-C1 | **S** |
| **LR-12** | **`coachingEngine.ts` — 8,229 lines, pre-law.** Readiness edges paid; nothing else owned. Needs decomposition into owned units before it can be sized honestly. | Created 2026-05-04, still the largest file in the repo | L-A1, L-B1, L-B5 | **XL** — decompose first |
| **LR-27** | **Every door routes through the owner that already exists.** *Sam QUEUED this 2026-07-30 as option 2 of the injury "Other" ruling — "the convergent fix, 'shin' must mean the same thing at every door."* **Sharper than first written: the single owner LANDED on 2026-07-28** — `data/injuryRegions.ts`, generated from `INJURY_MATRIX_RULINGS_2026-07-28.json`, 13 regions, and its own header names the five copies it replaced. Two of those copies are still in the tree: `sessionBuilder.INJURY_BODY_AREA_MAP` and `programAdjustmentEngine.BODY_PART_TO_BUCKET`. So this is not three accidental maps — it is one owner plus copies that survived their own consolidation. The guided door was the third and is now wired (2026-07-30). | `docs/INJURY_OTHER_PATH_TRACE_2026-07-30.md`; the owner's own header: "`guidedInjuryControl` sent 'rib' to the shoulder, which stopped being true the moment ribs became a region" | L-A1, L-B3 | **M** |
| **LR-13** | **The visible week has one projection.** Collapse `visibleProgramProjection` / `visibleProgramReadModel` / `weeklyPlanDisplay` + per-screen derivation to one owner (*= the queued renderer unit*). | §2.7 | L-A8, L-A1 | **M** |

## Tier 3 — honesty, vocabulary, and the gates

| # | Unit | Founding evidence | Laws | Size |
|---|---|---|---|---|
| **LR-14** | **Nine silent suites and 49 red ones.** A suite that reports nothing is worse than none: fix or delete the 9 `LOAD_CRASH`, triage the 49 `assert_fail`, and add the static "does this suite still load" scan as a recurring check. | `NON_BIBLE_TEST_ROT_SWEEP_2026-07-29.md`; `profileResetUITests` asserted nothing for weeks | L-E3, L-D3 | **M** |
| **LR-15** | **The vocabulary lock crosses the network boundary.** 39 exercise-name literal lines in `coach-chat/index.ts` outside the sweep; `injuryClarificationGuard`'s embedded server mirror. | §2.9 | L-B6, L-A1 | **M** |
| **LR-16** | **Raw `error.message` reaching a native Alert.** 4 sites in `reversibleAdjustmentTransaction.ts` → `useHomeScreen.ts:1683`. `injuryEpisodeTransaction.ts` was hardened; this module was missed. | LIVE_LEGACY #8, re-verified still open | L-C3 | **S** |
| **LR-17** | **Dev/E2E seams write product state through owners.** `defaultDevE2ESeedCoordinator.ts:303`'s raw `setManualOverride`; the profile calls already land on the one door. | §2.8 | L-A2, Process L3 | **S** |
| **LR-18** | **`workoutLogStore` is in-memory.** Logged sets do not survive a relaunch, with four readers. Decide: persist it, or delete it and the surfaces that feed it. | `workoutLogStore.ts` has no `persist(...)` | L-C1, L-C2 | **S** — diagnosis, then a ruling |
| **LR-19** | **Position feeds identity** (row order standing in for role). Queued from the power-row redesign; named in MASTER_PLAN PART 3. | Power-row ownership reassessment | L-A5 | **M** |
| **LR-20** | **Role-vocabulary collapse.** The second unit queued from the power-row redesign. | same | L-A1, L-B6 | **M** |
| **LR-21** | **`InjuryTag` vs the injury-matrix region vocabulary.** Two 13-region vocabularies (`exercisePools.ts:35` and the matrix's authored regions) with no gate holding them equal. | Injury matrix Phase 1 shipped 1,937 authored cells against a separately-declared tag union | L-A1, L-B6 | **S** |
| **LR-22** | **Producer fixtures.** `test:plan-change-producer` is `assert_fail` on `main` (recorded 259/21). Its fixtures predate move-scoping and G-1 ownership. | Rot sweep line 137 | L-D3, L-E3 | **S** |
| **LR-23** | **Coach clarifier and context stores are in-memory.** A clarifier spent across a relaunch, and coach context rebuilt from nothing, are both silent. | `pendingCoachClarifierStore`, `coachContextStateStore` have no `persist(...)` | L-B3, L-C1 | **S** — diagnosis |
| **LR-24** | **Action-log coverage completion** (*= 5D.3 remainder*). The tape covers the transaction owners and the profile store. It does not cover the ten unowned stores (LR-2) or the raw program-write primitive (LR-1) — it lands with them, not before. | §2.1 tape column | L-D1, L-D2 | folded into LR-1/LR-2 |
| **LR-25** | **Snapshot-based undo is the mirror-wipe shape.** `displacedOriginalState` stores a derived output and republishes it later, which is the class that wiped the profile. Convergent form: **undo = remove the decision from the ledger and re-derive.** That deletes the corrupt-snapshot class entirely, and with it the reason the accepted-state boundary needs a `restoration` operation kind at all. | Sam's forward-only ruling, 2026-07-29 — regression 23 corrupts a stored snapshot to `requiredMinimum: 99` and the boundary must refuse it, because nobody ever stated that number | L-A2, north star | **L** — queued, NOT built |
| **LR-26** | **One week's contract has THREE homes.** `microcycle.exposureContractV2`, `weekScopedOverlays[week].exposureContractV2` and `exposureContractsByWeek[week]` are three stores of one week's contract, and a door that refreshed one left the others stale. The derived COUNTS were collapsed by Sam's derive-at-read ruling (2026-07-29) and no longer go stale; what remains is the AUTHORED targets, which are inputs and legitimately stored — but stored three times. Collapse to one home. **No sync job and no fourth writer, under any version.** | Walker seed 1: move a session off a day, add one back, mark a game — the move refreshed the overlay's contract, the add wrote only a date override | L-A1, L-A2, north star | **M** — queued, NOT built |

> ## BOOKKEEPING RECONCILIATION — 2026-08-05
>
> **This document is the FOUNDING census of 2026-07-30. It is not the live
> ledger.** The live ledger is `src/data/legacyReckoningCensus.ts`, which is
> typed, gated by `test:legacy-census` in `test:bible`, and carries the
> ratchet. Where the two disagree, the code is authoritative and this
> document is history. Read the numbering below before quoting an LR id.
>
> **The live ledger carries 30 units (LR-1 … LR-30), and 30 is the RATIFIED
> ceiling** (Sam, 2026-08-05, `docs/DAY_CLOSE_RULINGS_2026-08-05.md` ruling 1).
> Four were added after this document was written, all by ruling, all during
> Stage B:
>
> | Live id | Unit | Filed |
> |---|---|---|
> | **LR-27** | `derivedSessionProvenance` nests a full displaced-session snapshot, and it GROWS on every relaunch — measured 3→4 chain depth and 66,947→139,331 bytes across ONE relaunch | 2026-08-04, ruled; PAID at its root `92484f3` |
> | **LR-28** | The displaced-ACCEPTED-session restoration still stores a workout copy — LR-27's residue, separated so a paid unit cannot claim an unpaid surface | 2026-08-05, ruling 1 |
> | **LR-29** | Undo restores from stored before-state instead of replaying decisions — LR-26's before side, kept by ruling until undo is rebuilt | 2026-08-05, ruling 2 |
> | **LR-30** | One week's contract still has more than one home — the v1 `exposureContract` is still being MINTED onto every fresh microcycle. **This document's own LR-26, refiled**; see the paragraph below | 2026-08-05, Priority D ruling D-1 |
>
> **AND ONE UNIT WAS FILED AS SCOPE ON AN EXISTING ONE, not as a 31st.** Sam's
> D-2 ruling of 2026-08-05 (`docs/DAY_CLOSE_RULINGS_2026-08-05.md` ruling 2,
> option a) filed the **hydration-repair in-place branch**
> (`programStore.ts:1216-1219`) on the census, *scoped to the coach rebuild*.
> The worn-world probe (`docs/D2_WORN_WORLD_PROBE_2026-08-05.md`) had measured
> that the branch guards a surface **athletes no longer write at all** — zero
> `dateOverrides` across five relaunch cycles of a purpose-built worn world —
> so its entire surviving population is coach writes and restores. It is
> therefore recorded in **LR-6's** scope, held by that unit's standing STOP,
> and pinned there by `test:legacy-census`. It is not an LR-31, because the
> same document ratified the ceiling at 30 and the ledger is at 30 of 30: a
> thirty-first unit needs Sam's word, not a bump taken while filing.
>
> **AND ONE CANDIDATE IS HELD WITHOUT AN ID, for the same reason.** Filed
> 2026-08-06 out of finding 3's step 2, which ruled it ADJACENT and out of that
> unit's scope: an all-optional early off-season week SELECTS three optional
> main-strength sessions (`optionalMainStrengthSelected = 3`) with push and pull
> both safe, and under a Severe hamstring restriction offers **none** — measured
> 3 (healthy control) vs 0 (restricted) on the differential matrix. The `3 -> 1`
> half is pre-existing; step 2's `1 -> 0` is understood and correct (the `1` was
> manufactured by the safety finaliser's frequency-ceiling consolidation pass).
> Recorded in `docs/QUEUE_ALL_OPTIONAL_RESTRICTED_STRENGTH_OFFER_2026-08-06.md`
> with the measurements. It does NOT map cleanly onto a current unit's subject,
> so unlike the D-2 branch above it cannot simply be scoped onto one — and it is
> not an LR-31, on the same ground: the ceiling is 30 of 30 and a thirty-first
> unit needs Sam's word. Assigning it is a review-seat call.
>
> **IDS WERE RECYCLED, so this document's numbering is not the live one.**
> Two divergences, both real:
>
> - **This document's LR-27** ("Every door routes through the owner that
>   already exists" — the body-part vocabulary) was **PAID and DELETED on
>   2026-08-03**, and the id was reused for the provenance unit above. What
>   holds that line now is behavioural, not a census row:
>   `test:injury-routing-divergence` pins every door at zero divergence from
>   `data/injuryRegions.ts`.
> - **This document's LR-25 and LR-26 are NOT the live LR-25 and LR-26.** The
>   live entries under those numbers are the plan-change producer's legacy
>   tail, and the reversible-adjustment ledger's snapshots.
>
> **AND ONE UNIT DECLARED HERE WAS NEVER TYPED INTO THE LEDGER AT ALL:**
> this document's **LR-26, "One week's contract has THREE homes"**. It was not
> paid — `git log -S` finds it has never appeared in
> `src/data/legacyReckoningCensus.ts` in any form. It was dropped in the
> transcription from this document to code, and stayed dropped for six days
> while its subject went on being true. Refiled 2026-08-05 as a live unit by
> the Priority D batch (`docs/PRIORITY_D_RULINGS_2026-08-05.md`, D-1), which
> is also paying the contained half of it.
>
> The lesson is the census's own: a ledger that lives in two places has two
> answers, and the one nobody gates is the one that rots. This block exists so
> that reading this file cannot mislead again.

**26 units — the ~25 stop-rule is now exceeded by one; LR-25 and LR-26 are
the same family (stored derivations) and schedule together.** They do, however,
consolidate naturally into **five families**, which is the better unit of
scheduling: *(i)* store ownership — LR-1, LR-2, LR-11, LR-17, LR-18, LR-23, LR-24, LR-25, LR-26;
*(ii)* the coach pipeline — LR-6, LR-12, LR-15; *(iii)* projection and placement —
LR-3, LR-7, LR-9, LR-13, LR-19, LR-20; *(iv)* honesty — LR-5, LR-8, LR-10, LR-16;
*(v)* gates — LR-14, LR-21, LR-22.

## Sam's sequencing ruling (2026-07-30)

Census approved. The ranked list stands as ordered above, with four decisions
fixed:

1. **LR-1 + LR-2 run together as the next major unit** — after the current G-1
   branch merges, and before Stage B. The stores get one door and the full tape
   before the engine builds on them. LR-24 rides in with them: a tape over a
   store with no write owner records writes it cannot attribute.
2. **LR-14 runs in parallel.** No design needed.
3. **LR-6 is a standing STOP.** No coach-pipeline work of any kind — no new
   resolver, guard, fallback, compatibility branch, phrase handler or finaliser
   patch — before its reassessment is written and approved. CLAUDE.md's seven
   questions are the form it takes.
4. **Everything else holds its census rank**, and the ratchet keeps the surface
   from growing meanwhile.

Flags accepted on the record: **these are candidate units pending device
confirmation, and the census pays nothing by itself.**

The gate pins (1) and (3) directly — LR-1 and LR-2 must carry a byte-identical
sequencing string so the ruling cannot drift apart in a later edit, and LR-6's
status must remain `stop`.

---

# PART 4 — THE RATCHET

**Built and green, 2026-07-30** — `src/data/legacyReckoningCensus.ts` +
`src/__tests__/legacyReckoningCensusTests.ts`, wired into `test:bible` as
`test:legacy-census`. In the `readinessStructureCensus.ts` mould, which is the
only ratchet in this repo that has already been paid to zero.

## Shape

`src/data/legacyReckoningCensus.ts` + `src/__tests__/legacyReckoningCensusTests.ts`,
wired into `test:bible`.

Every unit above is an entry. A detector-backed one declares **the detector that
counts it** and **the count it is holding the line at**; a `tracked_only` one
declares **why no detector can hold it**:

```ts
{ id: 'LR-1',
  laws: ['L-A2', 'L-A1', 'L-A8', 'L-D1'],
  blastRadius: 'accepted_content',
  founding: 'programStore.ts:1629 describes itself as a "Raw storage primitive"…',
  status: 'scheduled',
  sequence: LR1_LR2_SEQUENCE,   // byte-identical to LR-2's; the gate pins it
  detector: 'rawProgramWriteRefs',
  declared: 27 }
```

The gate refuses an entry that names a law outside the law book, a
detector-backed entry with no count, and a `tracked_only` entry with no reason.

## The detectors

Single-idiom, deliberately not parsers, each **pinned from both sides** so a
change in what it counts fails loudly instead of re-baselining (this is
`readinessStructureCensusTests` block [7], and it is the part that stops the
census lying to itself):

Nine were proposed. **Four shipped**, and the five that did not are the more
useful result — each was dropped for a reason now recorded in the census file
itself, on the unit it would have held:

| Detector | Counts | Measured |
|---|---|---|
| `rawProgramWriteRefs` | `.setManualOverride` property accesses outside the defining store | **27** across 13 files |
| `unownedPersistedStores` | `persist(...)` stores in `src/store` whose registry entry has `owner: null` — **and a store the registry has never heard of counts as unowned by default** | **11** of 12 |
| `legacyOverrideWriterRefs` | `applyCoachRevisionDateOverrides(` calls, excluding the definition | **4** across 2 files |
| `mirrorDecisionReads` | single-expression live-profile reads outside the store, `liveAthleteContext` and the accepted projection | **74** across 34 files |

**Total declared debt: 116.**

Dropped, with the reason recorded on the unit:

- `untapedStoreWrites` — collapsed into `unownedPersistedStores`; the registry
  records `taped` per store, and a separate count would double-count LR-2.
- `coachRequestRepresentations` (LR-6) — counting exported type names counts
  vocabulary, not representations, and goes green on a rename.
- `rawErrorToAthlete` (LR-16) — the idiom is byte-identical whether it reaches
  an `Alert` or a log line. It would count 24 sites and demand the 20 correct
  ones be "fixed", which is how a gate teaches people to switch it off.
- `vocabularyLiteralsOutsideLock` (LR-15) — the surface is under `supabase/`,
  outside the `src/` tree every detector here walks. Extending the existing name
  lock to that root **is** the unit.
- `silentSuites` (LR-14) — a suite that reports nothing is found by running it.
  The static precursor predicted only 3 of the 9 and belongs to LR-14 as a
  recurring check, not here as a count.

Three further units (LR-11 add-optional, LR-17 dev seams, LR-24 tape
completion) are deliberately **not** given detectors because their call sites are
already inside `rawProgramWriteRefs`. A second count of the same reference would
corrupt the baseline.

**Four of twenty-four units are ratcheted.** That number is honest rather than
aspirational, and it is meant to rise by finding a detector for an existing
unit — never by admitting a new one.

### A declared hole

`mirrorDecisionReads` sees a single-expression read only. A two-step read
(`const p = useProfileStore.getState();` then `p.onboardingData`) is invisible to
it, so **74 is a floor, not a total**. This is pinned as an explicit assertion in
block [7] so it is a known hole rather than a silent one. Widening it into a
parser is not the fix; migrating the readers is.

Two exemption decisions worth recording, because both could have been taken the
convenient way:

- `acceptedStateTransaction.ts` carries 13 of the 74 and was **not** exempted.
  Only two of them are snapshot reconciliation; the other eleven read the live
  profile as decision input, which is the defect. Exempting the file would have
  dropped the count to 61 and hidden them.
- `rawProgramWriteRefs` exempts only `programStore.ts` — the file that *defines*
  the primitive. `coachRevisionOverrideWriter.ts`'s three references stay
  counted even though LR-3 retires that whole writer, because two units reducing
  the same number is the ratchet working, not a double-count.

## The three directions, plus the fourth

The readiness census ratchets in three directions. This one needs a fourth,
because its subject is *pre-law surface* rather than *classified edges*:

1. **Per-entry count must match the detector.** A new `setManualOverride` caller
   makes `actual > declared` and fails until someone classifies it.
2. **Total debt may never exceed `LEGACY_DEBT_BASELINE`.** It only shrinks.
3. **`LEGACY_DEBT_BASELINE` must equal the current total**, so paying debt
   tightens the ratchet instead of leaving re-spendable slack.
4. **Nothing may create headroom.** Directions 2 and 3 are circular on their
   own — both compare the total against `LEGACY_DEBT_BASELINE`, so a newcomer
   can raise a declared count and the baseline together and stay green. Three
   clauses close every route:

   - **4** — `LEGACY_DEBT_BASELINE ≤ LEGACY_DEBT_FOUNDING_BASELINE` (116, frozen
     the day the census landed).
   - **4a** — per unit, `declared ≤ foundingCount`. **A global ceiling alone is
     not enough**, and this was demonstrated rather than argued: one unit of
     LR-2 debt was genuinely paid (giving `uiStore` an owner) and the freed unit
     spent on brand-new LR-1 surface. The suite passed **289/289 while admitting
     a violation that did not exist when the census landed**. Paid debt must
     retire, not become a budget. **Slack retires where it was earned.**
   - **4b** — `LEGACY_DEBT_FOUNDING_BASELINE` must equal the sum of the per-unit
     founding counts, so the ceiling cannot be edited on its own.
   - **4c** — the census holds no more than `LEGACY_CENSUS_FOUNDING_UNIT_COUNT`
     (24) units, so headroom cannot be manufactured by adding a twenty-fifth.

   **Old surface may be declared; new surface may only be fixed.**

### What direction 4 is not

**No constant in a file makes an edit impossible.** Every number here is
editable, and it would be dishonest to claim otherwise in a document about gates
that lie. What the four clauses do is remove every route that looks like
ordinary bookkeeping and leave only routes that read as a lie in a diff:
lowering a `foundingCount` (which records a measurement), raising a constant
whose name carries its founding date, or adding a twenty-fifth unit to a list
that says it was founded with twenty-four.

The genuinely stronger form is to compare against the value **committed in git**
rather than the value in the file — history is the one input an editor cannot
set. That was considered and not built: it would make the gate depend on git
being present and on a non-shallow clone, a real cost for a tripwire that is
already loud. If the raise-both move is ever actually attempted, that is the
escalation.

### Backported to the readiness census (2026-07-30)

The same hole was in `readinessStructureCensus.ts`, so
`STRUCTURE_DEBT_FOUNDING_CEILING` was added there and **frozen at zero**. Its
debt was paid to zero on 2026-07-29, so unlike this census it grandfathers
nothing: there is no headroom to declare into, and **every future
readiness→structure edge must be fixed rather than filed**. Mutation-tested by
reclassifying a `dose` entry as `structure_pending_removal` and raising the
baseline to match — caught. `test:readiness-structure-law` 86/86.

### A detector-backed unit does not die at zero — it becomes a ban

The readiness census deletes an entry when its count reaches zero, because a
list that keeps naming solved problems reads as approval. That is right for a
*classification* census and **wrong for a retirement one**, which this is.

Found by testing the shrink path: deleting a paid-off unit orphaned its detector
and turned the gate red, which would have forced people to keep dead entries
alive — the exact rot the census warns about, built into its own gate. Worse,
deleting the entry deletes the detector, so the retired surface could come back
unobserved.

So a paid unit is marked `retired`, keeps its entry, and holds its detector at
**zero forever**. Verified both ways: LR-3 retired to zero stays green, and the
same surface reappearing goes red. `tracked_only` units still die the ordinary
way — nothing counts them, so nothing is lost by deleting them.

## Two properties carried over deliberately

- **The census must be able to die.** When an entry's detector reaches zero, the
  entry is deleted. A list that keeps naming problems it has already fixed rots
  into something that reads as a considered position while no longer describing
  reality.
- **Declared, not banned.** A gate that failed on all 24 units on day one would
  be switched off by the first person it blocked. That is what the provenance
  inventory predicted for any all-at-once gate, and why the load-ratio work grew
  one cluster at a time.

## What it is not

It is not a substitute for LR-1 through LR-24. It stops the surface **growing**
while they are scheduled; nothing about it fixes a single existing unit. The
readiness census took a year of accumulated edges to zero over one unit only
because the ruling that classified them came first — **the ratchet holds the
line; the rulings pay the debt.**

## What the gates say

- `npm run test:legacy-census` — **289/289, EXIT=0**, wired into `test:bible`.
- `npm run test:compile` — **PASSED**, no file regressed against the baseline
  (467 errors, unchanged).
- `test:bible` was **not** run end-to-end: the working tree carries a concurrent
  session's uncommitted changes to six files, so a red would be unattributable.
  See NOT-COVERED.

### Mutation-tested — eleven mutations, eleven caught

A gate nobody tried to defeat is a gate of unknown strength. Each mutation was
applied to a committed tree and reverted from the session scratchpad, never by
`git checkout` (AGENTS.md).

| # | Mutation | Caught by |
|---|---|---|
| 1 | New `.setManualOverride` reference in an unrelated file | direction 1 + completeness (27→28) |
| 2 | New persisted store the registry has never heard of | direction 1 + completeness (11→12) |
| 3 | **Raise `declared` AND `LEGACY_DEBT_BASELINE` together to absorb mutation 1** | **direction 4** — the circular escape, blocked |
| 4 | LR-2's sequencing string drifted away from LR-1's | block [8] |
| 5 | LR-6 downgraded from `stop` to `scheduled` | block [8] |
| 6 | Debt paid down, baseline left high (re-spendable slack) | direction 3 |
| 7 | **Pay 1 unit of LR-2, spend it on new LR-1 surface** — *passed 289/289 before the fix* | **direction 4a**, added because of it |
| 8 | Manufacture headroom by adding a 25th unit | direction 4c |
| 9 | Edit the founding ceiling without a per-unit account | direction 4b |
| 10 | A retired surface returns (`applyCoachRevisionDateOverrides` reappears) | block [3] retirement clause |
| 11 | *(readiness census)* Reclassify a `dose` entry as structure and raise the baseline | `STRUCTURE_DEBT_FOUNDING_CEILING` |

Mutation 3 is the move a newcomer would actually make — declare the new
violation rather than fix it. **Mutation 7 is the one that found a real defect
in this design**: a single global ceiling let debt paid on one unit fund a new
violation on another, and the whole suite stayed green while doing it. That is
what per-unit founding counts exist for, and it is why the backport to the
readiness census carries the corrected shape rather than the shipped one.

---

# NOT COVERED (Process Law L2)

- **The ratchet holds four units of twenty-four.** LR-5 through LR-24 minus
  LR-3 and LR-4 are recorded, ranked and unenforced. Nothing stops LR-6's eight
  representations becoming nine, or a fourth visible-week projection appearing.
  Each says why in the census file; none of those reasons is "it does not
  matter".
- **`mirrorDecisionReads` is a floor.** Two-step reads through a local are
  invisible to it. 74 is what one idiom sees, not what exists.
- **The baseline was measured against a shared working tree.** The concurrent
  session's uncommitted edits were checked and touch none of the four counted
  idioms (verified, not assumed) — but if that session lands a file carrying
  one, `test:bible` goes red for them, and the census file is where the message
  points. That is the ratchet working; it is still worth knowing before it
  happens.
- **No device pass, no Maestro run.** Every finding is a static source trace.
  Per L4 the device is arbiter, and per L10 nothing here is "done" — these are
  candidate units, not verified defects.
- **No gate was executed.** `test:bible` was not run: the working tree carries a
  concurrent session's uncommitted changes throughout this census (the specific
  files moved while it was being written — `acceptedStateTransaction.ts` and
  `userRemovalConstraints.ts` at the start, `athleteActionLog.ts` and
  `coachRevisionPolicy.ts` by the end), so any result would describe neither
  `main` nor this branch. All gate names and pass/fail states are read from
  `package.json`, the 2026-07-29 rot sweep, and prior unit reports.
- **The in-flight lane was not read for correctness.** LR-10 is listed from its
  diagnosis document, not from the uncommitted diff.
- **`src/dev/e2e/`'s 54 files were sampled, not swept.** Writes to product state
  were traced through `defaultDevE2ESeedCoordinator` and `explorerProductionBindings`
  only; the explorer's other 52 modules were checked for store *reads* and not
  exhaustively for writes.
- **Supabase beyond `coach-chat`.** The other four edge functions were sized and
  scanned for exercise-name literals (all zero) but not read for legacy
  mutation or copy patterns.
- **`src/components/` (12 files) and the 21 onboarding screens** were not swept
  for legacy wiring; the onboarding *store* path was, via the profile-wipe
  record.
- **Blast-radius bands are judgement, not measurement.** "What an athlete loses"
  in §2.1 is read from what each store feeds, not from an observed failure.
- **LR-19, LR-20 and LR-21 are carried from the queue on their originating
  reports' evidence.** Independent founding evidence was found for LR-21 (two
  parallel 13-region vocabularies); LR-19 and LR-20 are cited from the power-row
  reassessment without re-derivation.
- **No estimate-vs-actual (L8)** — this is the first unit of its kind, so there
  is no previous estimate to calibrate against. Sizes are relative bands only.
