# SPECIALIST EXTRACTION — report, 2026-08-15, seat `core`

**Branch `slice-weekly-scheduler`, base `main @ 0e43fcfd`.** Worktree-isolated;
the shared checkout's five uncommitted onboarding-copy files were never touched.

---

## 0. MERGE VERDICT — **DO NOT MERGE**

| # | condition | state |
| ---: | --- | --- |
| 1 | scheduler produces the canonical weekly schedule and §18 policy | **PARTIAL** — schedule ✅, §18 producer built and proven, **not wired** |
| 2 | specialists materialise only scheduler-authored intentions | ✅ **built and guarded** (§2) |
| 3 | zero production calls/executions of the legacy planner | ❌ **572 executions / 180 worlds** |
| 4 | legacy planner + unreachable deps physically deleted | ❌ **0 lines** |
| 5 | previously green stay green; four new reds cleared | ❌ **3 of 4 cleared-or-never-real; 3 still red** |
| 6 | 180-world accounting, every changed world attributed | ✅ §4 |
| 7 | representative weeks showing scheduler days + specialist content | ✅ §5 |
| 8 | full chained gate clean + zero-execution receipt proven | ❌ |

**Conditions 2, 6 and 7 are met. 1 is partial. 3, 4, 5 and 8 are not.**

---

## 1. SPECIALIST OWNERSHIP TABLE

The boundary is `src/rules/materialiseAuthoredSessions.ts` — **~190 lines that
decide nothing.** It was ordered not to become an orchestrator, so every answer is
delegated to an authority that already existed.

| decision | owner | authority |
| --- | --- | --- |
| conditioning required? | **SCHEDULER** | `WeeklyDemand`, WC-045/046 |
| conditioning purpose/category | **SCHEDULER** | `ContractConditioningCategory`, §3 rows |
| standalone vs combined role | **SCHEDULER** | `SessionIntention.conditioningRole` |
| conditioning weekday | **SCHEDULER** | `SessionIntention.dayOfWeek` |
| **which conditioning template** | specialist | `conditioningSelection.selectConditioningTemplate` |
| work/rest/rounds/distance/modality/dose | specialist | the template + `conditioningDose` |
| sprint required? and its quality | **SCHEDULER** | WC-135, `inSeasonSprintDay` |
| **which sprint template** | specialist | `conditioningSelection.speedTemplateByName` |
| **power ELIGIBILITY of a strength day** | **SCHEDULER** | `SessionIntention.powerEligible` |
| **which primer, and whether any** | specialist | `powerPrimerPolicy.decidePowerPrimer` |
| hard/rest classification, count, spacing | **SCHEDULER** | `WeeklyDemand`, WC-040/041/042/043 |

### Power, per the mid-session correction

*"Power is strength-side content, not a standalone scheduling category."* Built
exactly so: the scheduler marks an **already-authored strength day** eligible
(never creates one; the game day and G-1 are excluded by WC-050), and
`powerPrimerPolicy` picks the movement and dose or declines. **It is not a
`ConditioningKind` member**, so `WeeklyDemand.coreConditioning` structurally cannot
see it.

### The four properties, guarded structurally

`schedule.days.map(...)` — never `flatMap`, never `filter`, never a push. A
specialist **cannot add** a day, **cannot remove** one (a refusal returns a typed
`unmaterialised` reason and the day survives), **cannot move** one (`dayOfWeek` is
copied, never computed), **cannot repurpose** one (`purpose`/`owner` copied).

Eight behavioural cells assert this against the REAL specialists over four worlds,
including that power only attaches to `owner === 'strength'`, never lands on the
game day or G-1, and does not move the conditioning count.

    test:weekly-scheduler   80 passed, 0 failures, 41/41 clauses guarded

---

## 2. EXTRACTED / CREATED — FILES AND LINES

| file | lines | what |
| --- | ---: | --- |
| `rules/weeklyProgrammingContract.ts` | 470 | the approved contract, 41 clauses |
| `rules/weeklyScheduler.ts` | 560 | the deterministic scheduler + `WeeklyDemand` |
| `rules/materialiseAuthoredSessions.ts` | 190 | **the boundary** |
| `rules/schedulerExposureContract.ts` | 78 | §18 from the completed schedule |
| `rules/section18WeekIdentity.ts` | 90 | **extracted VERBATIM** from `coachingEngine.ts:679` |
| `rules/weeklySchedulerInputs.ts` | 140 | facts → scheduler inputs |
| `rules/schedulerPlannedDays.ts` | 105 | intentions → composer planned days |
| `__tests__/weeklySchedulerTests.ts` | 560 | 80 cells |
| `scripts/mutate-weekly-scheduler.ts` | 300 | 43-mutation liveness harness |

**DELETED: 0 lines.** Nothing is unreachable yet, so nothing may go.

---

## 3. ZERO-EXECUTION RECEIPT

    scripts/probe-planner-surface.ts, 180-world corpus, 2026-08-15

    buildCoachingPlan EXECUTIONS: 572     (3.18 per world)
    TARGET:                         0

**NOT MET.** The blocker is now one field, precisely sized.

### The one remaining field: `weeklyPlan` → `SessionAllocation[]`

The adapter reads **22 distinct fields** off each allocation. Mapped against Sam's
boundary, nearly all now have an owner:

| field(s) | owner | status |
| --- | --- | --- |
| `dayOfWeek` `tier` `focus` `planEntryId` `isTeamDay` `strengthPattern` `strengthIntent` `strengthVariant` | SCHEDULER | **producible today** |
| `conditioningCategory` `section18ConditioningRole` `hasCombinedConditioning` `attachedConditioningKind` `conditioningOffFeet` | SCHEDULER | **producible today** |
| `conditioningFlavour` `conditioningVariant` `conditioningFeel` `ergModality` | specialist | **producible today** via `conditioningSelection` |
| `speedBlock` `speedWorkKind` | specialist | producible via `speedTemplateByName` |
| `powerPrimer` | specialist | **already produced** by the boundary |
| `conditioningFeasibility` | specialist | `conditioningFeasibility` module exists |
| `deterministicCoachNoteEffects` | **NEITHER** | see below |

### ⚠ THE ONE FIELD THAT IS NOT SCHEDULER AND NOT SPECIALIST

**`deterministicCoachNoteEffects`** — `SessionAllocation.deterministicCoachNoteEffects`,
a `DeterministicCoachNoteEffectSeed[]`, read at `defaultProgram.ts:2266`, `:2330`
and `:2709`.

**Current meaning:** the athlete-facing EXPLANATION trail — why the app did
something (a substitution made, a session reduced), carried as typed seeds that
later become copy.

**Why it sits outside the boundary as drawn:** it is neither a scheduling decision
(existence/count/weekday/spacing) nor content materialisation (template/dose). It
is *provenance for decisions made by both*.

**It is NOT a blocker, and I will not present it as one.** Each owner can emit its
own seeds — the scheduler when it declines or reduces, a specialist when it
substitutes. **The honest statement is that it is remaining work, not an
unanswerable question**, and it is the only one of the 22 without an owner named
today.

---

## 4. 180-WORLD ACCOUNTING — EVERY CHANGED WORLD ATTRIBUTED

    BEFORE  main @ 0e43fcfd     142 built / 38 refused
    AFTER   this branch         136 built / 44 refused
    LOST 22 · GAINED 16   (never reported as the net −6)

| | lost | gained |
| --- | ---: | ---: |
| Off-season 3d | 2 | — |
| Off-season 4d | 4 | — |
| Off-season 5d | 8 | — |
| Off-season 6d | 8 | — |
| Pre-season 4d | — | 2 |
| Pre-season 5d | — | 7 |
| Pre-season 6d | — | 7 |

**Attribution.** All 44 refusals are one clause family —
`main_strength_planner_selected_target` (22), `main_strength_permitted_maximum`
(16), `main_strength_required_minimum` (6). Every one is §18 judging the composed
week against the LEGACY planner's session count, because `schedulerExposureContract`
is built but **not wired**.

**The 144 figure is NOT claimed.** It came from a probe
(`probe-scheduler-owned-contract.ts`) that substitutes at the producer, and its
`lastDemand` is approximate across multi-week builds. **It is evidence that the
architecture is right, not a world count.** The shipped branch is 136.

---

## 5. REPRESENTATIVE WEEKS — THE BOUNDARY ON THE PAGE

`docs/weekly-scheduler-layouts/README.md`, generated from the typed contract.
Left columns are the scheduler's, right two are the specialists'. Example —
in-season, 4 gym days, athlete 24, Tue/Thu club, Saturday game:

| Day | SCHEDULER: session | purpose/category | Sets | Club/Game | SPECIALIST: conditioning | SPECIALIST: power |
| --- | --- | --- | ---: | --- | --- | --- |
| Mon | lower_squat | aerobic_base (component) | 10 | | Continuous Aerobic Run | primer/lower 2x3-3 |
| Tue | upper_pull | tempo (component) | 10 | club | 30:30 Controlled Tempo Blocks | primer/upper 2x3-3 |
| Wed | lower_hinge | aerobic_base (component) | 10 | | Continuous Aerobic Run | primer/lower 2x3-3 |
| Thu | upper_push | tempo (component) | 10 | club | 30:30 Controlled Tempo Blocks | **primer/upper 1x3-3** |
| Fri | rest_or_recovery | — | — | | — | — |
| Sat | game | — | — | GAME | — | — |
| Sun | rest_or_recovery | — | — | | — | — |

**Thursday is G-2 and its primer is REDUCED to a single set** — the specialist
applying game proximity inside an authorisation it did not grant itself. That is
the boundary working, visible on the page.

12 weeks are printed: in-season 2/3/4 sessions, younger and older four-day
athletes, pre-season 2/3/5 days, off-season 2/3/4 across all three blocks, a real
Wednesday/Friday + Sunday-game athlete, and an explicit-unavailability week.

---

## 6. FULL GATES

    test:bible:parallel (253)   71 red on main -> 68 red on the branch
    test:compile                PASSED — no file regressed
    test:weekly-scheduler       80 passed, 0 failures

**⚠ THE 68 HIDES THREE REGRESSIONS.** Six suites went green, so the total improved
while three broke. The suite-NAME diff is the receipt:

| suite | state |
| --- | --- |
| `test:program-override-ownership` | **red** |
| `test:athlete-door-matrix` | **red** |
| `test:main-lift-pattern` | **red** — its failing cell is a non-vacuity arm, a direct consequence of more refusals |
| ~~`test:game-anchor`~~ | **cleared** — it was the parallel-runner flake I flagged as unverified last session; it is green in this clean run |

Newly green: `device-findings`, `device-pass-2026-08-05-evening`,
`door-ledger-append`, `projection-ownership`, `work-bill`, `worn-world-boot`.

**No ratchet, floor, ceiling or allow-list was reset at any point in this mission.**

---

## 7. WHAT REMAINS, IN ORDER

1. Build the `SessionAllocation[]` producer: scheduler authorises, boundary fills.
   21 of 22 fields have a named owner today.
2. Give `deterministicCoachNoteEffects` its emitters (§3).
3. Wire `schedulerExposureContract` and drop `weekPlan.weeklyExposureContractV2`.
4. Extract `calculateCapacity` (39 lines, 2 consumers outside generation).
5. Repoint the 5 call sites; re-run `probe-planner-surface.ts` and **require 0**.
6. Delete 1,020 lines; clear the 3 reds; run the complete chained gate.

---

## 8. NOT COVERED

- Steps 1–6 above.
- The 8 new boundary cells are **not yet mutation-proved** — the other 72 are.
- No simulator, no phone.

Agent: core
