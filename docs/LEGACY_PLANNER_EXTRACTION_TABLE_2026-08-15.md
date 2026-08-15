# LEGACY WEEKLY PLANNER — 14-FIELD OWNERSHIP, CUTOVER STATUS, DELETION CENSUS

**2026-08-15, seat `core`. Branch `slice-weekly-scheduler`, base `main @ 0e43fcfd`.**
Worktree-isolated. The shared checkout's five uncommitted onboarding-copy files
were never touched.

---

## 0. MERGE VERDICT — **DO NOT MERGE**

Sam's seven conditions, measured:

| condition | state |
| --- | --- |
| scheduler produces the complete canonical week/§18 contract | **PARTIAL** — producer built and PROVEN (§2), not wired |
| zero production executions of the legacy planner | ❌ **572 executions / 180 worlds** (§3) |
| legacy planner and generation-only deps deleted | ❌ **0 lines deleted** (§4) |
| specialist modules cannot redesign the schedule | **not reached** — specialists not yet extracted |
| all four new reds cleared | ❌ still red |
| complete gates without threshold resets | **no thresholds reset**, gates not re-run at completion |
| 180-world accounting explicit | ✅ §5 |

**Not merged. Not a dual-planner merge. The branch carries the proven architecture
and the extraction, and stops where the remaining unit begins.**

---

## 1. THE 14-FIELD OWNERSHIP TABLE

Every field measured live by `scripts/probe-planner-surface.ts` (read-tracking
proxy over the real 180-world corpus). Classified per Sam's three buckets.

| # | field | reads | bucket | destination |
| ---: | --- | ---: | --- | --- |
| 1 | `coreSessions` | 844 | **① scheduler** | `WeeklyDemand.mainStrength` — **built** |
| 2 | `weeklyPlan` | 784 | **① + ②** | scheduler AUTHORISES the day; a specialist materialises content — **the remaining unit** |
| 3 | `capacity` | 572 | **② extract** | `calculateCapacity` (39 lines) — **2 consumers outside generation** (`feedbackAdapter`, `progressionRules`); a standing band, not a scheduling decision |
| 4 | `optionalSessions` | 528 | **① scheduler** | WC-130 optionality — `SessionIntention.optional` — **built** |
| 5 | `recoverySessions` | 528 | **① scheduler** | `owner: 'rest_or_recovery'` — **built** |
| 6 | `capacityFactors` | 392 | **② extract** | moves with `capacity` |
| 7 | `hardExposureCap` | 392 | **① scheduler** | WC-040 — `GLOBAL_RULES.hardDays` — **built and enforced as legality** |
| 8 | `existingHardExposures` | 392 | **① scheduler** | anchors — `WeeklyDemand.hardDays` — **built** |
| 9 | `remainingHardBudget` | 392 | **① scheduler** | derived from 7 − 8 — **built** |
| 10 | `offseasonSubphase` | 392 | **② extract** | `resolveOffseasonSubphase` — **already a separate module**, mapped by `offseasonBlockFrom` |
| 11 | `preseasonSubphase` | 392 | **② extract** | `resolvePreseasonSubphase` — already separate |
| 12 | `weeklyExposureContract` (V1) | 392 | **② extract** | `buildWeeklyExposureContract` — **already a separate module** (`weeklyExposureContractBuilders.ts:912`), callable without the planner |
| 13 | `weeklyExposureContractV2` | 392 | **① scheduler-derived** | `schedulerExposureContract.ts` — **built and PROVEN, not wired** (§2) |
| 14 | `constraints` (`AIConstraints`) | 392 | **① + ②** | **NOT obsolete** — read at 3 sites in `generateProgram` plus `sessionRowCounting`. I expected the AI severance (R-091) to have killed it; it has not. |

**Nothing is bucket ③ (obsolete). All fourteen are live**, which is why no subset
reaches zero executions.

---

## 2. PRODUCER CUTOVER — BUILT AND PROVEN BY MEASUREMENT

### The correction that made this tractable

I had reported the 34 `weeklyExposureContractV2` consumers as 34 rewrites.
**They are consumers of the DATA SHAPE, not callers of the planner.** The shape is
produced by ONE pure function, `buildSection18WeeklyExposureContractV2`, taking a
typed input. **Replacing its producer touches none of the 34.**

### The experiment, run before building the cutover

`scripts/probe-scheduler-owned-contract.ts` substitutes at the producer and
re-measures the real 180-world corpus.

| configuration | built | refused |
| --- | ---: | ---: |
| `main @ 0e43fcfd` baseline | 142 | 38 |
| branch as it stood | 136 | 44 |
| substituting `plannerSelected` ONLY | 138 | 42 |
| **also pinning §18's main-strength POLICY to the schedule** | **144** | **36** |

**144 is above the baseline. The architecture is correct.**

### ⚠ AND IT CORRECTED MY OWN HYPOTHESIS

Substituting the selected count alone moved 136 → 138 — almost nothing. **The
disagreement was never the selection.** It is §18's per-phase REQUIRED MINIMUM and
PERMITTED MAXIMUM — a second authority on a number Sam has given the scheduler.
Pinning those to the schedule recovered 6 worlds, and that is precisely
*"§18 derives its acceptance contract from the scheduler's completed weekly
schedule. It is not an independent planner."*

**Had I built the cutover on the first hypothesis I would have shipped a producer
swap that fixed two worlds and called it the architecture.**

### What is built

- `WeeklyDemand` on the schedule — main strength, core conditioning (anchors
  count), sprint, running, full rest days, hard DAYS. Counted from the dated days.
- `schedulerExposureContract.ts` — §18's contract from the completed schedule.
- `section18WeekIdentity.ts` — **`section18ModeAndSubphase` extracted verbatim**
  from `coachingEngine.ts:679`, with its only private helper `underlyingModeFor`.
  Not one line of logic changed in the move.

### What is not

The 36 residual refusals under the experiment are not diagnosed; the probe's
`lastDemand` is approximate across multi-week builds and some residue may be the
probe rather than the design.

---

## 3. ZERO-EXECUTION RECEIPT

    scripts/probe-planner-surface.ts, 180-world corpus, measured 2026-08-15

    buildCoachingPlan EXECUTIONS: 572        (3.18 per world)
    TARGET:                         0

**The condition is NOT met.** Four production call sites remain:
`generateProgram.ts:451`, `:452`, `:686`, `coachProgramEdit.ts:2067`, plus
`scheduleDebug.ts:145`.

---

## 4. DELETION CENSUS — **0 LINES DELETED, AND NONE IS SAFE YET**

| owner | lines | external consumers | internal callers | verdict |
| --- | ---: | ---: | ---: | --- |
| `buildCoachingPlan` | 727 | 3 | — | blocked on §6 |
| `enforceInSeasonPushPullBalance` | 206 | 0 | **2** | dies WITH the planner |
| `scoreStrengthSequence` | 44 | 0 | **3** | dies WITH the planner |
| `classifyGenerationAdjacencyRegion` | 43 | 0 | **7** | dies WITH the planner |
| **total once unblocked** | **1,020** | | | of `coachingEngine.ts`'s 9,075 |

⚠ **The three zero-consumer owners looked like 293 lines of free deletion.** They
each have internal callers inside the planner. **The grep that showed "0 consumers"
excluded the file they live in** — the exact shape that cost this repo a restore
once already.

---

## 5. 180-WORLD ACCOUNTING

| | built | refused | lost | gained |
| --- | ---: | ---: | ---: | ---: |
| `main @ 0e43fcfd` | **142** | 38 | — | — |
| branch (current commit) | **136** | 44 | **22** | **16** |
| branch + proven cutover (measured, not wired) | **144** | 36 | — | — |

Lost and gained reported separately, never as a net. **No ratchet, floor, ceiling
or allow-list was reset at any point in this mission.**

---

## 6. THE REMAINING UNIT — SPECIALIST CONTENT MATERIALISATION

Field 2 (`weeklyPlan`) is the whole remaining job, and it is now precisely sized.
Measured over 1,718 real allocations, **24 fields are populated**:

    100%  tier · focus · dayOfWeek · isHardExposure · planEntryId · stressLevel
     83%  strengthPattern · strengthIntent · strengthPatternContributions
     47%  powerPrimer
     45%  hasCombinedConditioning · conditioningCategory · conditioningFlavour
          conditioningOffFeet · section18ConditioningRole
     39%  attachedConditioningKind      19%  isTeamDay
     18%  conditioningFeel              16%  conditioningVariant
     10%  deterministicCoachNoteEffects  9%  composedOptionalKind
      2%  speedWorkKind · speedPlacement · speedBlock

**The scheduler already owns the first two rows** — existence, weekday, tier,
hardness, purpose, strength intent. **Everything from `powerPrimer` down is
specialist CONTENT** — exactly what Sam's boundary assigns to narrow modules that
materialise an authorised session and may never add, remove, move or repurpose one.

Those specialists currently live INSIDE `buildCoachingPlan`. Extracting them —
conditioning selection, power-primer policy, speed placement — is the unit that
unblocks zero executions, and it is its own piece of work rather than the tail of
this one.

### Order of work

1. Extract the conditioning-content specialist (category, flavour, off-feet, role,
   variant, feel, attached kind) — driven BY the scheduler's authorised days.
2. Extract the power-primer and speed-placement specialists likewise.
3. Have the scheduler emit `SessionAllocation[]`: it authorises, specialists fill.
4. Wire `schedulerExposureContract` (proven in §2) and drop
   `weekPlan.weeklyExposureContractV2`.
5. Extract `calculateCapacity`; repoint the 4 call sites.
6. Re-run `probe-planner-surface.ts` — **require 0**.
7. Delete 1,020 lines; clear the four reds; run the complete chained gate.

---

## 7. NOT COVERED

- Steps 1–7 above.
- The four red suites remain red.
- `AIConstraints` is live and I do not yet know why the AI severance left it so.
- The 36 residual refusals under the proven cutover.
- No simulator, no phone.

Agent: core
