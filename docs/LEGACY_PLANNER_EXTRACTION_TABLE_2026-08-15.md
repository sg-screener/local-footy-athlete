# LEGACY WEEKLY PLANNER — EXTRACTION / DELETION TABLE

**2026-08-15, seat `core`. Branch `slice-weekly-scheduler`, base `main @ 0e43fcfd`.**

## THE ANSWER FIRST

**The two-session cap cannot complete "zero production executions of the legacy
weekly planner", and this table is the stop Sam pre-authorised.** Nothing is
merged. The branch remains a dual-planner architecture and **must not be merged**.

The blocker is not the planner's size. It is one object:

> **`weeklyExposureContractV2` — 1,674 lines, consumed by 34 non-test modules.**

The order is "make the scheduler own the week **and §18 contract** end-to-end".
§18's contract is not a generation-only artefact: the store, hydration ingress, the
journal, the coach's program-edit path, the session resolver, offer placement,
safety policy and the accepted-week gateway all read it. Re-homing it is a
repo-wide unit, not a scheduler unit.

**I did not start it, because a half-moved §18 contract would leave the repo worse
than the unmergeable branch it replaced.**

---

## 1. MEASURED, NOT ESTIMATED

`scripts/probe-planner-surface.ts` wraps `buildCoachingPlan` and generates the real
180-world corpus, recording executions and which `CoachingPlan` fields are read
afterwards through a tracking proxy.

    worlds generated:               180
    buildCoachingPlan EXECUTIONS:   572   (3.18 per world)

**ALL FOURTEEN `CoachingPlan` FIELDS ARE READ. NOTHING IS DEAD.**

| field | reads | who needs it |
| --- | ---: | --- |
| `coreSessions` | 844 | session counts |
| `weeklyPlan` | 784 | the retained content adapter + the composer seam |
| `capacity` | 572 | **shared** — see §3 |
| `optionalSessions` | 528 | counts |
| `recoverySessions` | 528 | counts |
| `capacityFactors` | 392 | capacity provenance |
| `hardExposureCap` | 392 | hard-day budget |
| `existingHardExposures` | 392 | hard-day budget |
| `remainingHardBudget` | 392 | hard-day budget |
| `offseasonSubphase` | 392 | phase overlay |
| `preseasonSubphase` | 392 | phase overlay |
| `weeklyExposureContract` | 392 | §18 v1 |
| `weeklyExposureContractV2` | 392 | **§18 v2 — the blocker** |
| `constraints` | 392 | `AIConstraints` |

**Zero executions therefore requires replacing all fourteen.** There is no subset
that gets there.

---

## 2. DELETE — and **NOT ONE OF THESE IS DELETABLE TODAY**

The obvious candidates have zero EXTERNAL consumers, which is why an earlier read
of this looked like free wins. **They all have internal callers inside the planner**
— they die WITH `buildCoachingPlan`, never before it.

| owner | lines | external consumers | internal callers | test refs | verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| `enforceInSeasonPushPullBalance` | **206** | 0 | 2 | 3 | delete WITH the planner |
| `scoreStrengthSequence` | **44** | 0 | 3 | 1 | delete WITH the planner |
| `classifyGenerationAdjacencyRegion` | **43** | 0 | 7 | 3 | delete WITH the planner |
| `buildCoachingPlan` | **727** | 3 | — | many | the planner itself |
| **immediately deletable today** | **0** | | | | **evidence says none** |

**Deleting any of them now would be deletion on assumption**, which is the thing
the mission forbids. The grep that shows "0 consumers" excludes the file they live
in — the same shape that cost this repo a restore once already.

Planner-owned total once the replacement lands: **1,020 lines** (`buildCoachingPlan`
727 + the three above 293), out of `coachingEngine.ts`'s 9,075.

---

## 3. EXTRACT — used OUTSIDE generation, so they must move, not die

| owner | lines | consumers outside generation | destination |
| --- | ---: | --- | --- |
| `calculateCapacity` | 39 | `feedbackAdapter.ts`, `progressionRules.ts` | its own module — **the standing capacity band is not a scheduling calculation** and has two readers that have nothing to do with the weekly plan |
| `onboardingToCoachingInputs` | 3 | `sessionResolver.ts`, `clubSeasonScope.ts`, `temporarySourceFactTransaction.ts`, `coachProgramEdit.ts`, `scheduleDebug.ts`, `generateProgram.ts` | a profile→facts adapter; the scheduler needs the same facts |
| `classifyGenerationSession` | 3 | `defaultProgram.ts` (the RETAINED content adapter) | stays with the adapter it serves |

---

## 4. REPLACE — the three production entry points

| caller | what it wants | replacement |
| --- | --- | --- |
| `generateProgram.ts:686` | the week's allocation + §18 contract | `scheduleWeek` (**built**) + a scheduler-derived exposure contract (**not built**) |
| `generateProgram.ts:451-452` | a plan for the first block state | same |
| `coachProgramEdit.ts:2067` | a deterministic plan to diff an edit against | same |
| `scheduleDebug.ts:145` | a plan to print | same |

---

## 5. THE BLOCKER, SIZED

**`weeklyExposureContractV2` — `src/rules/weeklyExposureContractV2.ts`, 1,674
lines, 34 non-test consumer modules:**

```
store/          programStore · programHydrationIngress · acceptedStateTransaction
                reversibleAdjustmentTransaction
rules/          section18AcceptedWeekGateway · section18EffectiveWeekEvaluator
                section18SafetyPolicy · section18SafetyFinaliser · section18CraftTier
                section18OfferPlacement · section18WorkoutEvidence
                generatedWeekContract · derivedWeekContract · derivedSessionProvenance
                storedWeekDeclaration · acceptedEffectiveWeek · journalWeekJob
                conditioningSelection · conditioningFeasibility · sessionRowCounting
                userRemovalConstraints · reversibleAdjustmentLedger
                weekStructureValidator · weeklyExposureContract
                weeklyExposureContractBuilders
utils/          sessionResolver · weekRebuild · planChangeProducer
                section18ProgramObservation · postGenerationConstraintValidation
                coachingEngine
services/       generateProgram          data/  readinessStructureCensus
dev/            devE2ESeedRegistry       types/ domain
```

**Why it is the whole job.** The scheduler already computes what §18's *strength*
policy needs. §18 additionally owns conditioning exposures, sprint credit, rest
days, hard-day budget, anchors, readiness/bye/injury interactions, and the
achieved-vs-required ledger that the accepted-week gateway and the journal read
back. Sam's contract owns the first half of that list; the second half is not in
the approved document at all.

**So "the scheduler owns the §18 contract end-to-end" is a decision about the other
half too, and the approved contract does not answer it.** That is a genuine gap
between the order and the source, reported rather than invented around.

---

## 6. THE ORDER OF WORK THAT WOULD ACTUALLY GET THERE

Each step is independently verifiable and none of them is a dual-planner state.

1. **Extract `calculateCapacity`** to its own module (39 lines, 2 external readers).
   Cheap, unblocks nothing, removes a shared calculation from the planner's body.
2. **Extract `onboardingToCoachingInputs`** likewise (6 readers).
3. **Move §18's phase policy table into the weekly contract.** `weeklyExposureContractV2`
   holds a per-phase `strength / conditioning / sprint / rest / hardDays` table that
   **duplicates the approved contract's §3 and §6** — this is the "useful
   calculations" extraction, and it is the step that makes the rest possible.
4. **Build the exposure contract from the scheduler's week** — the same object
   shape, so all 34 consumers keep working unchanged. **This is the large step.**
5. **Repoint `generateProgram`'s 2 call sites, then `coachProgramEdit`, then
   `scheduleDebug`.**
6. **Prove zero executions** with `scripts/probe-planner-surface.ts` over the full
   corpus, then **physically delete** `buildCoachingPlan` + the three internal-only
   owners (1,020 lines) and report the count.
7. Clear the four reds and re-run the complete chained gate.

**Steps 1–2 are safe now. Step 3 is the pivot. Step 4 is the multi-session unit.**

---

## 7. THE BRANCH AS IT STANDS — NOT MERGEABLE, AND NOT CLAIMED OTHERWISE

    142 built / 38 refused   ->   136 built / 44 refused
    22 worlds lost · 16 gained · 4 suites green -> red

Kept as evidence, not as a candidate. What is sound and would survive a rebase onto
whatever step 4 produces:

- `weeklyProgrammingContract.ts` — 41 clauses, stable ids, §-provenance,
  mechanically derived registry;
- `weeklyScheduler.ts` — deterministic, exhaustive, typed refusals;
- **72 guard cells, 0 failures, 41/41 clauses guarded, all 72 seen RED** by a
  43-mutation harness;
- `docs/weekly-scheduler-layouts/README.md` — 11 layouts and 12 weeks generated
  from the typed contract.

**No ratchet, floor, ceiling or allow-list was reset at any point.**

---

## 8. NOT COVERED

- Steps 1–7 above. None started.
- The four red suites remain red.
- The §18 conditioning/sprint/rest half that the approved contract does not cover
  (§5) — a question for Sam, not a gap I should fill.
- No simulator, no phone.

Agent: core
