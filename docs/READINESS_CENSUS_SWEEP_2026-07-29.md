# Readiness census sweep — paying the final 27 edges

**Date:** 2026-07-29
**Law:** `READINESS_STRUCTURE_LAW` (Sam, 2026-07-28, `docs/BATCH0_RULING_APPLIED_2026-07-28.md`)

> Structure comes from phase + schedule facts; capacity/readiness affects DOSE
> only — "dose down, never block" extends to weekly session counts. The contract
> varies by schedule inputs (available days, team days, game anchors) as
> Sam-authored columns; readiness and injury never set structure — injury flows
> through its own law family.

The census (`src/data/readinessStructureCensus.ts`) declared 27 remaining
structure edges across seven files. This unit classifies every one of them and
pays it, leaving an honestly-declared dose-only remainder.

---

## 1. The boundary rule this sweep applies

Every prior batch drew the dose/structure line by argument. Enough edges have now
been read at their consumers to state it as a test:

> An edge is **DOSE** when the session still happens and only its size,
> intensity or modality changes.
> An edge is **STRUCTURE** when a session, a required exposure, or a count
> disappears — including a "cap" that removes a distinct Bible-floored exposure,
> and including anything that suppresses a floor.

Two consequences that were not obvious before reading the consumers:

- **A conditioning category downgrade is dose.** `hardSessionCap`,
  `allowedCategories` and `categoryPriority` do not delete sessions. They filter
  the category priority list, and `categoryPriority.length === 0` falls back to
  `['aerobic_base']` (`coachingEngine.ts:2411-2414`). The week keeps the same
  number of conditioning sessions; they become easy aerobic. That is exactly
  "dose down, never block".
- **…except through the sprint channel.** `blocksConditioningCategoryForGeneration`
  is also the producer of `injuryAllowsSprint` (`coachingEngine.ts:3058`), so a
  readiness-set `hardSessionCap: 0` denies the standalone sprint outright. Sprint
  is a distinct exposure with a year-round Bible floor of 1 and a typed-reason
  requirement for any reduction below it. That is the one path by which a
  category cap becomes a block, and it is why the zero cap dies while the
  aerobic-only category list stays.

This is the memory lesson from the engine-thresholds unit applied literally:
*verify what a number does before presenting it for ruling.* Three fields the
census described as blocks turned out to be modality switches; one field it did
not mention at all turned out to be the real block.

## 2. Verdicts

### `utils/coachingEngine.ts` — 18 edges → 8 dose, 10 structure

| Line | What readiness decided | Verdict | Disposition |
|---|---|---|---|
| 645 | Gates the game-week conditioning-frequency reduction on low readiness | structure | **Deleted outright.** The first attempt was to ungate it, on the reading that "non-team app slots at G-3 or earlier" is a calendar fact. Ungating it immediately produced a conditioning shortfall against the legacy contract on the bible harness's in-season game week (expected 3, delivered 2), which exposed what it actually was: a SECOND authority reducing a count the contract owns, so the planner built to the reduced number while acceptance judged against the contract's. Its own detail sentence gave the premise away — "REDUCED-PARTICIPATION field anchors" is derived from capacity, not from the calendar. The contract's own spacing reduction still cuts STRENGTH around G, G-1 and G+1; conditioning at G-2/G-1 is not unsafe, it is easy, which is a dose. |
| 1231 | Withholds an easy off-feet aerobic component from a 6-day early off-season week | structure | Delete the readiness clause. The count is the contract's `optionalRecoveryAerobic.plannerSelectedCount`, and there is nothing lighter than an easy off-feet component to dose down to. |
| 1758 | `lighterByeWeek` — one strength exposure instead of two | structure | Re-derive from the contract: `identity.mode === 'in_season_bye_recovery'`, falling back to `weekKind === 'deload'` when no contract is present. This also removes the two injury triggers, which the same law forbids ("injury flows through its own law family"), and collapses a second representation of a decision `byeRecoveryMode` already owns. |
| 2503 | Early off-season conditioning target 1 instead of 2 | structure | Delete → 2 (the already-authored non-low value). Contract-less fallback path only. |
| 2516 | Early off-season `MIN_COND_FLOOR` 0 instead of 1 | structure | Delete → availability alone decides. A floor readiness can zero is not a floor. |
| 2527 | `avoidCombinedDays` on low readiness | structure | Delete → availability alone. `avoidCombinedDays` suppresses the H5a safety net that enforces `MIN_COND_FLOOR` (`coachingEngine.ts:5156`), so this silently drops conditioning exposures. |
| 3057 | `readinessAllowsSprint` into the sprint exposure gate | structure | Delete. Denies a Bible-floored exposure. |
| 3310 | `readiness !== 'high'` → `sprint_readiness` refusal | structure | Delete. Same block, one layer down. |
| 5979 | `readinessAllowsSprint` at the sprint top-up tail | structure | Delete. With both producers gone, `readinessAllowsSprint` and the `readiness_denied` reason are retired from `sprintExposureGate` entirely — there is no field left to grow the block back on. |
| 7938 | `sprintLoading = 'do-not-add'` for a low-readiness athlete who does no sprint training | structure | Delete → `'conservative'` (the authored non-low value). The scheduled deload and injury still say `'do-not-add'`. |
| 2383 | Forces off-feet aerobic when running is enabled by default | **dose** | Modality. The session happens either way. |
| 2390 | Forces off-feet aerobic below high readiness | **dose** | Modality. |
| 3210 | Standalone tempo goes off-feet | **dose** | Modality. |
| 3289 | TT-adjacent standalone tempo backs off to easy aerobic | **dose** | Intensity. |
| 3322 | Tempo backs off to easy aerobic | **dose** | Intensity. |
| 3332 | Hard conditioning backs off to easy aerobic | **dose** | Intensity. |
| 7962 | `conditioningLoading = 'moderate'` | **dose** | An AI prompt hint about size, not about count. |
| 8005 | `rampUp` note — "do NOT prescribe full volume immediately" | **dose** | Volume advice. |

### `rules/powerPrimerPolicy.ts` — 3 edges → 3 dose

| Line | What readiness decided | Verdict | Disposition |
|---|---|---|---|
| 153 | Low readiness → `null`, no power block at all | structure → **dose** | Sam's ruling (2): a shrunk sharp primer via `deloadPowerDose`, never `null`. The dose transform is authored and already in force for deload weeks; low capacity now uses the same one. |
| 177 | G-2 primer requires high readiness | structure → **dose** | The G-2 *window* is a schedule fact and stays; the readiness half shrinks the dose instead of removing the block. |
| 201 | Contrast eligibility requires high readiness | **dose** | Contrast (3 x 3-5) vs primer (3 x 3) is size, and the power block exists either way. This is the permitted direction and needed no change. |

### `utils/workoutCanonicalisation.ts` — 2 edges → 2 dose

| Line | What readiness decided | Verdict | Disposition |
|---|---|---|---|
| 491 | Low readiness → `power_removed` | structure → **removed input** | The removal dies and the finaliser does NOT shrink in its place. The dose has one owner: `decidePowerPrimer` shrinks once, where the block is decided, and the finaliser cannot tell an already-shrunk row from a full one — a shrink here would compound on every re-canonicalisation of the same week. Same split the deload law already uses. |
| 454 | `gMinusTwoBlocked` includes `readiness !== 'high'` | structure → **removed input** | The experience requirement and the G-2 window stay. Found while removing it: `readiness` was optional on the context and only ONE producer ever set it, so every other caller answered "not high" and removed the G-2 primer by default. The field is deleted from `WorkoutCanonicalisationContext` entirely, which is what makes the removal unrepresentable rather than merely discouraged. |

### `rules/offseasonSubphasePolicy.ts` — 1 edge → dose

The low-readiness branch survives, carrying dose only.

| Field | Verdict | Disposition |
|---|---|---|
| `conditioning.allowedCategories: ['aerobic_base']` | dose | Intensity. Sprint is not in this pool (`CATEGORY_PRIORITY_OFF` filters it out — the late-off-season speed gate owns sprint), so narrowing it removes no exposure. |
| `conditioning.defaultCategory: 'aerobic_base'` | dose | Intensity. |
| `conditioning.modalityBias: 'off_feet'` | dose | Modality. Currently has no consumer; kept because it is the declared dose intent and the engine reaches the same outcome through edges 2383/2390. |
| `strength.targetRpeMax → min(base, 7)` | dose | Consumed by `phaseRepSchemes`. |
| `sessions.optionalSupportBias: 'high'` | dose | Adds optional work — the permitted direction. |
| `conditioning.hardSessionCap: 0` | **structure, deleted** | The sprint-denial channel of §1. The aerobic-only category list already delivers the intensity intent. |
| `running.allowedBySubphase/enabledByDefault: false`, `policy: 'blocked_low_readiness'` | **structure, deleted** | Readiness must not write "blocked". The off-feet outcome is unchanged: with the policy at base, `policyRequiresOffFeetAerobic` still returns true for low readiness through edge 2383. |
| `speedSprint.allowedBySubphase: false` | **structure, deleted** | A declared block on a Bible-floored exposure. (It has no consumer today, which is precisely how a block survives review.) |
| `sessions.coreBias: 'reduced'` | **structure, deleted** | A declared core-session count cut. Also unconsumed. |
| `sessions.lowAvailabilityCombinedDays: 'avoid'` | **structure, deleted** | Feeds `avoidCombinedDays`; suppresses the conditioning floor. |

### `rules/preseasonSubphasePolicy.ts` — 1 edge → dose

| Field | Verdict | Disposition |
|---|---|---|
| `conditioning.categoryPriority: ['aerobic_base']` | dose | Intensity. |
| `conditioning.hardDose: 'reduced'` | dose | Consumed at `coachingEngine.ts:2401` → `conditioningVariant: 'reduced'`. |
| `strength.volumeBias: 'controlled'` | dose | Declared dose intent. |
| `conditioning.hardSessionCap: 0` | **structure, deleted** | Sprint-denial channel. |
| `conditioning.targetCap → min(base, 1)` | **structure, deleted** | A count. |
| `conditioning.minimumAppExposures: 0` | **structure, deleted** | Zeroes the floor `MIN_COND_FLOOR` reads. |
| `speedSprint.targetExposures: 0` | **structure, deleted** | Bible Section 2 sets a year-round floor of 1 and requires a typed authorised reason below it. Low readiness was never one; Sam confirmed the floor stands. |
| `strength.coreSessionCap → min(base, 2)` | **structure, deleted** | A count. |
| `sessions.combinedStrengthConditioning: 'avoid'` | **structure, deleted** | Suppresses the conditioning floor. |

### `rules/weeklyExposureContractBuilders.ts` — 1 edge → 0 (entry deleted)

`byeRecoveryMode` becomes schedule-triggered only: an explicit `byeMode` or
`weekKind === 'deload'`. Both the readiness trigger and the
`pauseAffectedTraining` injury trigger go — Sam's ruling 4 says the scheduled
deload is the intended entry condition, and the mode carries a strength maximum
of 2 against a build week's 3, so either trigger cuts a session.

### `utils/conditioningRules.ts` — 1 edge → 0 (entry deleted)

`inferFresh(activeInjuries, readiness)` decided bye-week freshness, which sets
`maxTierA` (1 vs 0) and `maxTierB` (2 vs 1) — a tier block and a count. It dies.
`WeekLog` gains `byeMode: 'build' | 'recovery'`, carried from the microcycle's
accepted contract (`identity.mode === 'in_season_bye_recovery'`) with
`weekKind === 'deload'` as the fallback, so the same authority decides bye mode
here as everywhere else.

`WeekLog.readiness` **stays**: its other consumer is conditioning progression,
which is a declared dose site (`utils/conditioningProgressionRules.ts`).

---

## 3. What the sweep does not decide — for Sam

These are decisions nobody has authored. They are listed, not invented.

0. **In-season bye recovery now has no producer.** This is the one that needs a
   ruling before device acceptance. Ruling 4 says bye recovery is entered by the
   SCHEDULED deload — but `resolveSeasonPhaseWeekKind` schedules deloads in
   pre-season (every 4th week) and off-season (after week 4) and **never
   in-season**. With capacity and injury removed as triggers, and the illness
   door deliberately changing the dose rather than `weekKind`, nothing in
   generation can now produce an `in_season_bye_recovery` week. The mode, its
   contract row (strength 2/2/2, two full-rest days) and its visible shape are
   all still implemented and still reachable through an explicit `byeMode`, and
   they are still gated at the contract (`readinessDoseSweepTests` block [5]) and
   at the planner (`section18PhasePlannerTests` scenarios 12-14, which supply the
   deload week explicitly). What is missing is the in-season schedule fact that
   enters it. **Question for Sam: which in-season week is a bye recovery week?**
   The likely answers are a bye round the club schedules, or an in-season deload
   in the block plan — both are his to author, not mine to infer.

1. **The low-readiness sprint dose.** The blocks are gone and the Bible floor
   keeps one sprint/high-speed exposure a week for a low-readiness athlete. What
   is *not* authored is a smaller sprint dose for that athlete — fewer reps, a
   shorter distance, a longer rest. Today the exposure is the same size at every
   readiness level. If low readiness should shrink it, the number is Sam's.
2. **The off-season low-readiness hard-conditioning dose.** Pre-season has an
   authored `hardDose: 'reduced'`; the off-season policy has no equivalent field
   and expressed the same intent as `hardSessionCap: 0`, which was a block. With
   the block gone, the aerobic-only category list carries the intent — but if
   Sam wants an explicit reduced hard dose in the off-season the way pre-season
   has one, that field and its value are his to author.
3. **`sessions.coreBias`, `optionalSupportBias`, `modalityBias`, `volumeBias`
   have no consumers.** Four declared policy fields that nothing reads. They are
   left alone by this sweep (removing them is a separate deletion unit), but
   they are the shape that lets a block hide in a declaration for a year.

---

## 4. Ratchet

`STRUCTURE_DEBT_BASELINE`: 27 → 0. Every remaining readiness edge in the census
is `dose`, with its reason recorded per file. Two entries are deleted outright
because their files have no readiness edge left, per the census's own rule that
a census must be able to die.

The census stays in place with a zero structure debt rather than being deleted,
because block [5] (completeness: no readiness edge is undeclared) and block [2]
(each file declares its actual count) are what stop the next readiness edge from
arriving unclassified. That is the part of the gate that still has work to do.

## 5. What the gates say

- `test:bible` EXIT=0, including the new `test:readiness-dose-sweep` (100/100)
  and `test:readiness-structure-law` (85/85), both now wired into it.
- `test:compile` passes; three test files improved and the baseline was locked.
- Seven adjacent suites (`test:readiness`, `preseason-subphase`,
  `preseason-exposure`, `weekly-spacing`, `poor-sleep`, `tap-swap-hierarchy`,
  `exposure-engine`) fail, and their failure sets are **byte-identical to `main`**
  — verified by diffing against a baseline worktree, not by assumption. They are
  pre-existing and must not be attributed to this unit.

### Authored expectations re-pointed (flagged, not quietly changed)

Each of these asserted the superseded law and would have failed on any correct
implementation of the ruling:

1. `ALL-READINESS-DOWNGRADE-01` (bible slice 3) — said low readiness REMOVES
   power. Its own anchor quote says *reduce*. Also recorded: its
   `hardConditioning: 0` leg is vacuous against its fixture, and was before.
2. `INV_READINESS_TRANSFORMATION_VALID` — required `power.kind === 'none'` and
   `low_readiness_power_blocked` evidence. Now requires a primer and NO such
   evidence.
3. `section18PhasePlannerTests` 12-14 — entered bye recovery via low readiness;
   now via a deload week. Scenario 12's "no power" became "a SHRUNK power dose",
   which two rulings (deload 2026-07-27, readiness 2026-07-28) both require.
4. `section18AcceptedWeekGatewayTests` 4, 5, 17, 45, P2, P6 — the "zero primers"
   pair whose own comment claimed the capacity exemption that has since closed,
   plus the bye-recovery fixture that low capacity used to route into the mode.
5. `offseasonSubphasePolicyTests` [4] — asserted the zero cap and the
   `blocked_low_readiness` policies; now asserts they do not move.
6. `sprintExposureGateTests` — one assertion ("low readiness denies sprint
   top-up") inverted; 16 `readinessAllowsSprint` literals deleted with the field.

### One golden regenerated

`powerCountingDifferential/snapshot.golden.json`, scenario `offseason-beginner`,
weeks 1-2 only. Bisected to a single edge (1231): a low-capacity athlete with six
available days now receives the easy off-feet aerobic component the contract had
already selected. Conditioning exposures are unchanged at 2; the week gains a
recovery session where a second standalone flush used to be.

**Gate:** `npm run test:readiness-structure-law`, `npm run test:readiness-dose-sweep`
