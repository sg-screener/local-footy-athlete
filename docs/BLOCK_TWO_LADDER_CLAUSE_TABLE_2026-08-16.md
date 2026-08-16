# BLOCK TWO — PROGRESSION LADDER AND RECOVERY RESPONSE: THE CLAUSE TABLE

Seat `ladder`. Base `3b5b59d0` (main). Branch `feat/block-two-ladder`.

Authority: `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`, sections
"Progression order", "High readiness and low soreness", "Low readiness or high
soreness". Registry rows already carrying part of it: **R-096**, **R-097**,
**R-098**, **R-099**.

**THIS TABLE IS THE MISSION'S FIRST DELIVERABLE AND IT IS MEASURED, NOT READ
OFF.** Every "REUSE" row names the function that already does the work and the
suite that reds if it stops. Every "BUILD" row states what is missing.

## BEFORE

| # | Required behaviour | Production owner today | Guard today | Verdict |
| --- | --- | --- | --- | --- |
| **PROGRESSION ORDER** | | | | |
| P1 | Increase load through the canonical load owner | `rules/blockBoundaryProgression.ts` — `decideBlockBoundaryLoads` + `applyBlockBoundaryProgression`, called at `services/api/generateProgram.ts:1615` (R-096/R-097) | `test:block-two-progression` | **REUSE — complete** |
| P2 | When load must not increase, add ONE set where appropriate | **NONE AT THE BOUNDARY.** `utils/progressionRules.ts` `buildBuildOutput` does emit `setsDelta: 'add_one'`, but it emits it **together with `loadDelta: 'up'`** on the same lift in the same rollover — the opposite of the ordered ladder — and it applies no session set ceiling | the freeze's own table is covered by `test:strength-progression-inputs`; **nothing covers the ORDER** | **BUILD** |
| P3 | Offer one extra weekly session when phase, scheduler and gym availability allow; never add silently | the legality probe exists and is count-agnostic (`rules/weeklyCommitmentLegality.ts`); the question → card → answer → ledger machinery exists **for the SMALLER direction only** (`rules/weeklyCommitmentQuestion.ts`, `store/weeklyCommitmentAnswer.ts`, `screens/home/useBlockBoundaryPrompts.ts`) | `test:block-two-difficult-missed`, `test:block-two-screen-delivery` | **BUILD, reusing all four** |
| **SET RULES** | | | | |
| S1 | At most one set, to an eligible main or secondary lift | — | — | **BUILD** |
| S2 | Never exceed the 16 main/secondary working-set session ceiling | the number exists — `SET_CEILING = 16`, `rules/weeklyLegality.ts:329`, module-private. **WC-030's week-time check tests the LAYOUT's declared ceiling, never an actual session's total** (`weeklyLegality.ts:253`) | `test:clause-enforcement`, `test:weekly-scheduler` | **BUILD the count, REUSE the constant** |
| S3 | Accessories and core do not count toward that ceiling | `rules/weeklyProgrammingContract.slotCountsTowardSetBudget`, fed by `WorkoutExercise.section18Evidence.slot` — present on every composed row (measured) | `test:clause-enforcement` | **REUSE** |
| S4 | Do not add reps to manufacture progression | R-098 holds reps on the REDUCTION path; nothing holds them on an ADD path that does not exist yet | `test:block-two-difficult-missed` | **BUILD (assertion)** |
| S5 | Never increase load and sets on the same exercise in the same rollover | **NONE — and the in-block freeze actively breaks it** (`buildBuildOutput` at 3 consecutive full completions, and `buildOverreach`) | — | **BUILD** |
| S6 | Athlete-visible prescriptions remain editable | `store/programStore` manual override + weight override doors | `test:program-control-durable`, `test:athlete-prefs-ownership` | **REUSE** |
| **HIGH READINESS / LOW SORENESS — QUALITY-SPECIFIC** | | | | |
| Q1 | strength easy, conditioning hard → progress strength only | `readBlockHistory` returns **one whole-block verdict**. It reads `feeling`/`soreness` only on dates that carry strength logs and **never reads `SessionFeedback.conditioning` at all** | `test:block-two-progression` | **BUILD** |
| Q2 | conditioning easy, strength hard → progress conditioning only, hold strength volume | — | — | **BUILD (see NOT COVERED)** |
| Q3 | everything easy → load, then sets, then offer a session | P1 exists; P2/P3 do not | — | **BUILD** |
| Q4 | a difficult required quality is made achievable, never deleted | `applyBlockBoundaryConditioning` REPLACES and never deletes, by construction | `test:block-two-difficult-missed` | **REUSE** |
| **LOW READINESS / HIGH SORENESS** | | | | |
| L1 | remove or reduce hard conditioning first | `decideBlockBoundaryConditioning` (R-098) | `test:block-two-difficult-missed` | **REUSE** |
| L2 | reduce main- and secondary-lift sets | `decideBlockBoundaryVolume` / `applyBlockBoundaryVolume` (R-098) | same | **REUSE** |
| L3 | replace remaining conditioning with easier aerobic work | `applyBlockBoundaryConditioning` → `EASIER_AEROBIC_CATEGORY` (R-098) | same | **REUSE** |
| L4 | retain meaningful load while doing less | load is held under `history.reduces` (R-096/R-098) | same | **REUSE** |
| L5 | never add load, sets or sessions in this state | load: held and guarded. **sets and sessions: the owners do not exist, so the gate cannot exist either** | — | **BUILD (gate)** |
| L6 | hard conditioning falls BEFORE strength volume | the call order at `generateProgram.ts:1642-1665` is already the contract's | **the order itself is not asserted anywhere** | **BUILD (assertion)** |
| L7 | injury restrictions outrank these adjustments | the injury system | `test:injury-authority`, `test:injury-progression` | **REUSE** |

**Score: 9 of 20 required behaviours already have a production owner AND a guard.
11 are the build.**

## THE THREE MEASUREMENTS THIS TABLE RESTS ON

All taken at `3b5b59d0` against real `generateProgramLocally` worlds, 24 athlete
worlds swept (3 phases × 2 conditioning levels × 2 sprint exposures × {3,4}
training days), 16 built and 8 refused.

**1. `section18Evidence` CARRIES THE SLOT ON EVERY COMPOSED ROW.** A generated
`WorkoutExercise` holds
`section18Evidence: { role: 'main_strength', strengthPattern: 'squat', slot: 'squat',
provenance: 'composer_declaration' }`. So the accessory/core exclusion (S3) has a
real production input and needs no new field and no name list.

**2. NO GENERATED WORLD CONTAINS HARD CONDITIONING — STILL TRUE ON `main`.**
`conditioningCategory` was `aerobic_base` in **64 of 64** conditioning days across
all 16 built worlds. `sprint`, `vo2`, `glycolytic` and `cod_decel` — the four
`HARD_CONDITIONING_CATEGORIES` — appear **zero** times. This reproduces the
finding R-098 already records at `6117a9fd`; `composeWeek` merging did not change
it.

**3. THERE IS NO CONDITIONING-ONLY DAY. THERE ARE PLENTY OF STRENGTH-ONLY DAYS.**
Day shapes across the same sweep: **strength-only 144, combined 64,
conditioning-only 0.** Conditioning always rides a strength day as an attached
component.

## SO: CAN THE APP DISTINGUISH STRENGTH DIFFICULTY FROM CONDITIONING DIFFICULTY?

**YES, AND THE ANSWER IS NOT THE SESSION FEELING.** Stated in full because the
mission requires a STOP if it is no.

| quality | the recorded field | why it is unambiguous |
| --- | --- | --- |
| **conditioning** | `SessionFeedback.conditioning.rpe` | it is the CONDITIONING RPE input on the feedback panel (`SessionFeedbackPanel.tsx:1412`, written at `:850`), never written from a strength answer |
| **strength** | `feeling` / `soreness` on a date whose session carried strength work and **no** conditioning | 144 of 208 generated days are strength-only, so the coordinate is abundant |

**AND THE CONDITIONING THE APP ACTUALLY GENERATES IS LOGGED WITH AN RPE.**
Measured: the `aerobic_base` component generation emits ("Steady Blocks (3×8 min
or 4×6 min)") returns `getConditioningLoggingConfig → level: 'trackable'` with
`fields: [mode, totalTimeMinutes, distanceMeters, calories, roundsCompleted,
intervalsCompleted, bestInterval, averagePace, **rpe**]`. The RPE input is on the
screen for the conditioning the athlete is actually given.

**THE RPE→VERDICT BAND IS NOT NEW POLICY.** It is the SIGNED effort vocabulary
read across: `rules/effortScale.ts` names `7 — hard` and `8 — very hard`, and
`blockBoundaryProgression`'s existing bands already put the feeling `hard` in the
GOOD set and `very_hard` in the HARD set. So RPE ≤ 7 is the good band and RPE ≥ 8
is the hard band, by word identity with a vocabulary Sam signed on 2026-08-12 —
no second scale is minted.

`SessionFeedback.difficulty` is deliberately **NOT** used as the strength signal:
`SessionFeedbackPanel.tsx:911` writes it as
`executionSummary ? sessionRpeValue : conditioningRpeValue`, so on its own it does
not say which question it answered.

## NOT COVERED BY THIS MISSION — STATED UP FRONT

- **Q2's "progress conditioning" half has no reachable coordinate.** Measurement 2
  above: every generated conditioning exposure is already `aerobic_base`, the
  easiest authored category. "Progress conditioning through the existing
  phase-approved template progression" has no rung to climb to in any world the
  app can build today. The producer that is missing is a scheduler/§18 change that
  emits `tempo`, `vo2`, `sprint` or `glycolytic` exposures, and that is outside
  this mission's stated boundaries.
- **L1/L3's hard-conditioning coordinate is likewise unreachable** for the same
  reason, and is already owned and guarded by R-098 against constructed trees.
