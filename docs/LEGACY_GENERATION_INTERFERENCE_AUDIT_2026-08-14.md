# LEGACY GENERATION INTERFERENCE AUDIT — 2026-08-14

**Measurement only. Nothing was fixed, deleted, rebaselined or registered by this
audit.** Seat: `tracer`. Every number below was taken in an isolated worktree;
the shared checkout stayed on `main` throughout.

---

## 1. EXACT BASE

- **Branch `slice-b1-cp2`, commit `943e030b0d8798f2caefd75ede931c346dd31c47`**
  — the latest composer checkpoint (`wip(B1-cp2): HARD STOP`). The same commit
  is the tip of `slice-b1-pivot` and `legacy-strength-builder-preserved`.
- Its own receipt reads **SWEEP AT THE STOP: 173 built / 7 refused** — and this
  audit confirms the 7 refused are exactly the seven composed-route worlds
  (`composedRouteAdmits`: Pre-season/2d/club × 3 kits × weeks 1–2, plus the
  In-season/2d/club/dumbbells control). **At this base, no composed week
  reaches storage or an athlete — every composed world throws
  `Section18WeekAcceptanceError` at the gateway.** All composed-route
  measurements below are therefore taken at the boundaries the route does
  reach (composer output → §18 input), which is where the interference lives.
- Measured in a detached worktree at that commit with temporary probes
  (`__AUDIT_TAP__` boundary taps + `__AUDIT_ATTR__` mutator taps). **All probes
  were discarded with the worktree; none of them exist in any tracked branch.**

## 2. THE PRODUCTION LIFECYCLE, AS BUILT

### 2.1 Entry points (all funnel into `generateProgramLocally`, `src/services/api/generateProgram.ts:1018`)

| # | Entry | Site |
|---|---|---|
| E1 | Onboarding completion | `src/screens/onboarding/CompleteScreen.tsx:302` |
| E2 | Rebuild hook | `src/hooks/useProgramRebuild.ts:118` (UI: HomeScreenV2:1407, HomeScreen:589, CoachTabScreen:534) |
| E3 | Local week rebuild | `src/utils/weekRebuild.ts:647` → `commitRebuiltProgram:779` |
| E4 | Block rollover | `src/utils/programBlockRollover.ts:107` (auto from `useHomeScreen.ts:340`) |
| E5 | Accepted-state transaction | `src/store/acceptedStateTransaction.ts:1951` |
| E6 | Profile/phase transaction | `src/store/profileProgramTransaction.ts:203` |
| E7 | Temporary-source-fact transaction | `src/store/temporarySourceFactTransaction.ts:532` |
| E8 | **Quiescent boot** | `src/store/quiescentBoot.ts:480` — every launch |
| E9 | Coach program-setup edit | `src/utils/coachProgramEdit.ts:1881` via `coachTurnController.ts:3460` |
| E10 | Store-side gateway fallback | `src/utils/postGenerationConstraintValidation.ts:887-903`, wired at `programStore.ts:938/:946/:1323` and six other sites |

### 2.2 The per-week pipeline (`buildGeneratedMicrocycles`, `generateProgram.ts:538`)

```
composedRouteAdmits (:647)  ──no──►  legacy arm: sourceCoachWorkouts = []
        │yes                          (everything synthesised from fallbacks)
        ▼
composeWeek (:695) → composedWeekToCoachInputs (:711)
        ▼
buildCanonicalCandidate (:740)
  └ buildWorkoutsFromCoach (defaultProgram.ts:1720)   ← the legacy builder
      completeCoachWorkoutsFromPlan → fallbackExercisesForPlanEntry (:1356, :2571)
      applyPoolRotation (:2605) · findOrCreateExercise (:660)
      prescription passes (:2652,:2662,:2664,:2674) · deloads · S+C append (:2701)
      speed rows (:2796) · POWER ROW PREPEND (:2899) · finaliseWorkoutAfterMutation (:1868)
        ▼
acceptSection18Week (:808)   ← §18 gateway (safety finaliser, power budget,
  regenerate/safeFallback arms (:837-844)   repair search, offer placement)
        ▼
rebindDerivedSessionProvenance (:846) → applyOptionalTopUps (:873)
→ withCraftSafeTopUps (:897) → microcycle (:977)
        ▼
bakeMicrocycleStrengthProgression (generateProgram.ts:1140)  ← POST-acceptance
        ▼
commitRebuiltProgram → accepted-state transaction
  (the store RE-RUNS the gateway on every commit: programStore.ts:1278-1365)
```

### 2.3 Storage and hydration — **the program is never persisted**

- `programStore.ts:2457-2466` `partialize` writes an **inputs-only envelope**
  (`generationAnchorISO`, `seasonPhaseClock`, `sessionFeedback`,
  `weightOverrides`, `temporarySourceFacts`, `injuryEpisodes`). Verified live:
  the persisted envelope in every traced world carried
  `inputs: true, currentProgram: false`.
- Every launch **regenerates**: `quiescentBoot.ts:366-550` wipes the derived
  world, calls `generateProgramLocally` (`:480`), re-derives fixture marks,
  commits, and replays the decision ledger. **Generation is the hydration
  engine.** Measured: the post-boot week was fingerprint-identical to the
  committed week in every world that completed boot.
- The whole legacy hydration-canonicalisation pipeline
  (`canonicaliseHydratedState` → `canonicaliseHydratedWorkout`,
  `programStore.ts:616-1739`) has **no production caller** — the repo's own
  receipt is `src/rules/featureRegistry.ts:213`.

### 2.4 Projection (athlete-visible)

`useScheduleState` → `buildProgramTabProjectedWeek`
(`visibleProgramReadModel.ts:149`) → `resolveWeekWithConditioning`
(`sessionResolver.ts:1715`) → `projectVisibleDay`
(`visibleProgramProjection.ts:202`) → `project()`
(`projectVisibleWeek.ts:663`). The §18 gateway **runs again at read time**
(`sessionResolver.ts:1927` tier four).

## 3. BOUNDARY FINGERPRINT RESULTS

Fingerprint = ordered days/sessions, canonical identities, roles/patterns,
prescriptions, typed removal records, conditioning-block signature. IDs and
timestamps excluded. Boundaries: **a** composer output · **b** §18 input ·
**c** gateway-selected · **c2** post top-ups · **d0** returned program (post
progression-bake) · **d1** store-committed · **e** post-boot regeneration ·
**f** projection.

| World | a→b | b→c | c→c2 | c2→d0 | d0→d1 | d1→e | e→f |
|---|---|---|---|---|---|---|---|
| COMPOSED Pre/2d/club/FullGym w1 | **6 changes** | refused | — | — | — | — | — |
| COMPOSED Pre/2d/club/FullGym w2 | **6 changes** | refused | — | — | — | — | — |
| COMPOSED Pre/2d/club/Bodyweight w1 | **20 changes** | refused | — | — | — | — | — |
| COMPOSED Pre/2d/club/Bodyweight w2 | (w1 refuses first — w2 unreached) | refused | — | — | — | — | — |
| COMPOSED Pre/2d/club/DbBands w1 | **8 changes** | refused | — | — | — | — | — |
| COMPOSED Pre/2d/club/DbBands w2 | **8 changes** | refused | — | — | — | — | — |
| COMPOSED In/2d/club/DbBands w1 (control) | **8 changes** | refused | — | — | — | — | — |
| LEGACY In/4d/club/FullGym w1 | n/a | **3 changes** (`repaired`) | clean | clean | clean | clean | **renames** |
| LEGACY Off/3d/noclub/Bodyweight w1 | n/a | clean (`repaired`) | clean | clean | clean | clean | **renames** |
| LEGACY Off/5d/club/DbBands w2 | n/a | clean (`repaired`) | clean | **2 weight rewrites** | clean | clean | **renames + rows added/dropped** |
| LEGACY Pre/4d/noclub/FullGym w1 | n/a | **2 changes** (`repaired`) | clean | **6 weight rewrites** | clean | not measured (see §10) | — |

**Liveness proofs (all restored afterwards).** The three edges that read clean
everywhere were each proven able to detect a rewrite: a mutant identity
injected post-gateway reddened **c→c2 only**; one injected inside
`commitRebuiltProgram` reddened **d0→d1 only**; one injected inside the boot's
regeneration reddened **d1→e only**. Every natural-positive edge (a→b, b→c,
c2→d0, e→f) had already demonstrated detection on real mutations. A green
trace on the other edges is therefore evidence, not silence.

## 4. OBSERVED SEMANTIC MUTATIONS, WITH EXECUTED file:line

### 4.1 Composer output → §18 input (composed route, EXECUTED at base)

1. **A power row the composer never authored is prepended to every composed
   day.** `defaultProgram.ts:2899` (`buildPowerRow` :1593). Executed in all 7
   composed worlds (`Explosive Push-up` / `Vertical Jump` at position 0).
   *Legacy content mutation.*
2. **The composed session name and type are rewritten** from the plan entry
   (`Team training + Upper body - combined push + pull …` →
   `Team Training + Upper Body Strength`), via the builder's naming
   (`resolveSessionDisplayName`, `defaultProgram.ts:2854` family). *Legacy
   content mutation of day identity.*
3. **The composer's typed kit-gap records are dropped on the floor.**
   `composedWeekToCoachInputs` (`composedWeekToWorkouts.ts:37`) has no carrier
   for `ComposedWeek.gaps`, and `Workout.equipmentRemovals` **does not exist in
   src at this commit** (verified: zero grep hits; the only commit carrying it,
   `375f32ce`, is unmerged). R-083's "say the kit is the cause" evidence dies
   at this exact boundary. *Legacy content mutation (loss of typed evidence).*
4. **Composed roles and patterns are re-inferred, not carried (R-092).** On the
   bodyweight world every composed `main_strength` row re-classified
   `strength_accessory` with `mainStrengthPattern: null`
   (`withSection18WorkoutEvidence`, `workoutCanonicalisation.ts:1123` →
   `section18WorkoutEvidence.ts:156`, provenance `canonical_row_classifier`).
   This is what turns an honest composed week into a
   `required_minimum_shortfall:main_strength` refusal. *Legacy content
   mutation; the direct cause of the 7 refusals.*
5. **Composed prescriptions are rewritten** (`Glute Bridge` 5-8 → 6-10,
   `weightKg null → 0`): the ungated prescription passes
   `applyPhaseRepSchemesToWorkoutExercises` (`defaultProgram.ts:2652`),
   `applyLoadEstimates` (`:2662`), `applySubphaseMainLiftLoadMultiplier`
   (`:2664`), `applyTrainingAgePrescription` (`:2674`). *Legacy content
   mutation of the authored dose.*
6. **The drift branch strips composed rows through callers that never pass the
   `composed` flag.** Executed with `composed:false` against composer-authored
   rows (`Back Squat`, `Single-Leg RDL`, `Walking Lunges` …) at
   `workoutCanonicalisation.ts:858-869`, reached via the §18 safety finaliser
   (`section18SafetyFinaliser.ts:226/:286` — `canonicalContextFor` :163 never
   threads `composed`) and the gateway's power-budget re-finalise
   (`section18AcceptedWeekGateway.ts:557`). This is the measured mechanism
   behind CP2's "repair stripped Back Squat and Single-Leg RDL". **Clause (f)'s
   stand-down covers exactly one of the six production `finaliseWorkoutAfterMutation`
   call sites (`defaultProgram.ts:1868`).** *Legacy content mutation.*
7. `strengthIntent` is stamped from the plan entry (null → typed intent) —
   *required validation/enrichment, not interference* — recorded for
   completeness.

### 4.2 §18 input → gateway output (both routes)

8. **The weekly power budget strips power rows under `status=repaired`.**
   `section18AcceptedWeekGateway.ts:557` (`withoutPowerRows` +
   re-finalise). Executed on both legacy full-gym worlds (the rows the builder
   inserted at :2899 are removed again here) and inside composed-world repair
   churn. *The gateway is un-inserting the builder's own insertion — one
   mechanism wearing two mutations.* Classified: required validation **of a
   defect the builder created**; after severance the pair must not survive as
   insert-then-strip.
9. **Gateway status was `repaired` for every single built world in the trace
   (4/4 legacy).** No world was accepted as offered. *Required validation
   today; evidence the candidate-builder and the gateway disagree
   systematically.*
10. **The regenerate/safeFallback arms** (`generateProgram.ts:837-844`) — on
    THIS branch they rebuild from the composed source; on `main` they rebuild
    from `[]`, i.e. from `fallbackExercisesForPlanEntry`, and CP2 measured
    them publishing a **legacy week under `status=regenerated` for four of
    seven composed worlds** while the verdict read `accepted`. See
    ALREADY-SEVERED.

### 4.3 Post-acceptance, pre-store

11. **`bakeMicrocycleStrengthProgression` rewrites `prescribedWeightKg` after
    §18 has judged the week.** `generateProgram.ts:1140` →
    `sessionResolver.ts:1694/1709`. Executed: RDLs 65 → 67.5 (Off/5d w2);
    six rows +2.5kg (Pre/4d w1). *Post-gateway prescription mutation on every
    route, composed included.*

### 4.4 Store commit and relaunch

12. The store re-runs the gateway on every commit
    (`programStore.ts:1278-1365`) and re-sorts/renormalises days
    (`:956-964`, `:1233-1248`) — **measured clean** on all traced worlds
    (d0→d1 unchanged), with liveness proven. *Required validation.*
13. Relaunch = regeneration (`quiescentBoot.ts:480`). Measured deterministic
    (d1→e unchanged) in every world that completed boot. *Required
    behaviour — but note: any generation-time interference re-executes on
    every launch, forever, because generation IS hydration.*

### 4.5 Projection (athlete-visible)

14. **Identity renames at the glass**: stored `Romanian Deadlift` shown as
    `RDLs` (`loadEstimation.ts:329` via `projectVisibleWeek.ts:395` →
    `canonicalExerciseName`); stored `Pallof Press` shown as
    `Band Pallof Press`; `Face Pulls` → `Face Pull`. *Presentation-only at
    this site — but the same resolver keys loads and cues, so a mis-resolution
    is not harmless.*
15. **Rows the store never held are shown, and stored rows are not.** On the
    Off/5d world the projection materialises six arm rows (`Concentration
    Curl`, `Hammer Curl`, …) for the Gunshow/prehab day at read time
    (`sessionResolver.ts:1819-1863` → `buildDerivedSession`) and drops the
    four stored `Bodyweight Conditioning Circuit` rows
    (`projectVisibleWeek.ts:448-471`, declared as walker-law debt).
    *Declared presentation transforms; listed because they make the glass an
    unreliable witness of storage.*
16. **An unknown identity vanishes silently at projection.** The liveness
    mutant (`AUDIT MUTANT ROW`) survived commit and relaunch untouched but was
    never shown. *No owner said anything.* (One-liner also filed in the
    FINDINGS LEDGER.)

## 5. CLASSIFICATION — EVERY MECHANISM, ONE BUCKET

**A = EXECUTED LEGACY INTERFERENCE** (post-composition, changes meaning; must
be severed before the composer is authoritative). **B = REACHABLE, NOT
EXECUTED** in the measured worlds. **C = LEGACY AND UNREACHABLE.**
**D = SHARED RETAINED DEPENDENCY.** **AS = ALREADY-SEVERED on this branch**
(receipts; still live on `main`).

| Mechanism | Site | Bucket | Evidence |
|---|---|---|---|
| Power-row prepend into composed/all days | `defaultProgram.ts:2899` (:1593) | **A** | executed, all 11 worlds |
| Session name/type rewrite of composed days | `defaultProgram.ts:2854` family | **A** | executed, all composed worlds |
| Composed gap records dropped (no carrier) | `composedWeekToWorkouts.ts:37`; `Workout` lacks the field | **A** | executed (structural), all composed kit-limited worlds |
| Role/pattern re-inference (R-092 not carried) | `workoutCanonicalisation.ts:1123` → `section18WorkoutEvidence.ts:156` | **A** | executed; causes the 7 refusals |
| Prescription passes over composed dose | `defaultProgram.ts:2652/:2662/:2664/:2674` | **A** | executed (bodyweight world) |
| Drift strip via un-flagged finalise callers | `workoutCanonicalisation.ts:858` via `section18SafetyFinaliser.ts:226/:286`, gateway `:557` | **A** | executed, `composed:false` on composed rows |
| Weekly power-budget strip | `section18AcceptedWeekGateway.ts:557` | **A** (pair of :2899) | executed both routes |
| Progression bake post-acceptance | `generateProgram.ts:1140` → `sessionResolver.ts:1709` | **A** (ungated for composed) | executed, legacy worlds |
| `applyPoolRotation` identity rewrite | `defaultProgram.ts:2605` → `exercisePoolsStrength.ts:1103` | **A** on legacy (34/132/38/17 executions) | **AS** for composed rows (`:2601`, commit `1c827674`) |
| Rotation-refusal row drop | `defaultProgram.ts:2614` | **A** on legacy (48× bodyweight world) | composed rows exempt via same gate |
| Restore loop (`FALLBACK_PATTERN_EXERCISE`) | `workoutCanonicalisation.ts:895-914` (:181, :437) | **A** on legacy (114×/16× executions) | **AS** for the one flagged call site |
| `completeCoachWorkoutsFromPlan` fallback synthesis | `defaultProgram.ts:1356` | **A** on legacy (it authors every legacy day: 12–651 executions/world); **hole on composed route**: additions carry no `composed` flag | executed |
| Thin-day template substitution | `defaultProgram.ts:2560-2575` | **A** on legacy | **AS** for composed (`:2561`) |
| `findOrCreateExercise` fuzzy identity collapse | `defaultProgram.ts:673-678` | **B** | probe present, zero executions |
| Safety finaliser `safePatternFallbackRow` insertion | `section18SafetyFinaliser.ts:256` (:111-121) | **B** | probe present, zero executions |
| Safety consolidation main-lift clone | `section18SafetyFinaliser.ts:427-472` | **B** | probe present, zero executions |
| Gateway offer/core-conditioning builders (legacy-built sessions into any week) | `section18OfferPlacement.ts:490/:611` → `buildWorkoutsFromCoach([])` | **B** | not observed in traced worlds |
| `applyOptionalTopUps` / `withCraftSafeTopUps` | `generateProgram.ts:873/:897` | **B** | ran; added/withheld nothing in traced worlds (c→c2 clean, liveness-proven) |
| `validateWorkoutAgainstActiveConstraints` (both drift AND restore live — the one site where both can fire on composed rows) | `postGenerationConstraintValidation.ts:279/:547` | **B** | gated on hard constraints; none in traced worlds |
| Store-side regenerate/safeFallback twin (no composed awareness) | `postGenerationConstraintValidation.ts:887-903`, wired `programStore.ts:938/:946/:1323` +6 | **B** | not triggered in trace; the arm `generateProgram.ts:837` was fixed, this twin was not |
| `repairDisplacedStrengthCandidates` | gateway `:955-1155` | **B** (inert at generation: no `strengthTemplates` passed) | static |
| `applyUserRemovalConstraintsToWeek` at generation | gateway `:1374` | **B** (inert: `freshGenerationSurfaces()` has no removal decisions) | static |
| Hydration canonicalisation pipeline | `programStore.ts:616-1739` (`canonicaliseHydratedState` family) | **C** | no production caller; receipt `featureRegistry.ts:213` |
| `fixtureMinimalReplan.ts:404` `buildWorkoutsFromCoach` call | — | **D** (edit-route, not generation) | callers are weekRebuild/acceptedStateTransaction |
| `CoachScreen.tsx:20` dead `generateProgramFromProfile` import | — | **C** | zero calls in file |
| Legacy V1 exposure contract (persist-only read) | `generateProgram.ts:934` | **C**-leaning (separate retirement unit, per V1 cut doc) | static |
| `buildWorkoutsFromCoach` itself | `defaultProgram.ts:1720` | **D** | gateway offer placement + fixture replan + generation |
| `finaliseWorkoutAfterMutation` (module) | `workoutCanonicalisation.ts:634` | **D** | every edit + live-write + gateway caller (§4.6 of the storage map) |
| §18 gateway / evaluator / safety finaliser / offer placement | — | **D** | edit routes, projection tier-4, store commits |
| Pools data + lookups (`classifyPoolSlot`, `findPoolEntry`, `STRENGTH_POOLS`) | `exercisePoolsStrength.ts` | **D** | coach swap resolution, progression, slot coverage, composer itself |
| `sessionBuilder` / `sessionResolver` / projection stack | — | **D** | projection is a read-time consumer |
| Progression (`bakeMicrocycleStrengthProgression` machinery) | `sessionResolver.ts:1507-1694` | **D** (owner retained; its generation-time seat is the A-item above) | — |
| **AS-1: composed source replaces legacy source** | `generateProgram.ts:710-712` | **AS** (receipt `943e030b`) | on `main` the composed route does not exist; `fallbackExercisesForPlanEntry` authors everything |
| **AS-2: gateway arms rebuild the composed week** | `generateProgram.ts:837-844` | **AS** (receipt `943e030b`; CP2 measured `main`'s behaviour: legacy week published under `regenerated` for 4/7 worlds, rows stripped under `repaired`) | |
| **AS-3: rotation stands down for composed rows** | `defaultProgram.ts:2601` | **AS** (receipt `1c827674`) | |
| **AS-4: thin-day substitution stands down** | `defaultProgram.ts:2561` | **AS** (receipt `943e030b` branch) | |
| **AS-5: drift+restore stand down where flagged** | `workoutCanonicalisation.ts:859/:896` + `defaultProgram.ts:1875` | **AS-partial** (receipt `943e030b`) — measured: 5 of 6 production callers still unflagged | |
| **AS-6: contract derives kit-relative requirements (clause a)** | `coachingEngine.ts:830-838`, `weeklyExposureContractV2.ts:1293-1303` | **AS** (contract change, not a mutator) | |

**Counts: A = 13 · B = 10 · C = 4 · D = 8 · ALREADY-SEVERED = 6 (one partial).**

## 6. GENERATION-ONLY DELETION CANDIDATES (A + C + AS — complete against `main`'s behaviour)

Everything the composer pivot must delete or permanently sever, including what
this branch already stopped (a deletion list written against the branch alone
would silently re-admit AS-1..5 on merge-back):

1. `fallbackExercisesForPlanEntry` (`defaultProgram.ts:1072`) and both its
   call sites (`:1356`, `:2571`) — the legacy template author.
2. `applyPoolRotation` (`exercisePoolsStrength.ts:1103`) and its sole caller
   (`defaultProgram.ts:2605`) — including the refusal row-drop (`:2614`).
3. The restore loop + `FALLBACK_PATTERN_EXERCISE` + `fallbackPatternRow`
   (`workoutCanonicalisation.ts:181/:437/:895-914`) as a *generation-time*
   behaviour (the drift guard itself is shared — see severance order).
4. The power-row prepend (`defaultProgram.ts:2838/:2899`) **together with** the
   gateway power-budget strip's role as its undo (`gateway:557`) — power
   becomes a composed slot or it does not exist.
5. The prescription passes' authority over composed rows
   (`defaultProgram.ts:2652/:2662/:2664/:2674`) — extraction, not deletion:
   they remain the legacy route's owner until it dies with (1).
6. The session name/type re-derivation over composed days
   (`defaultProgram.ts:2854` family).
7. The generation-time seat of `bakeMicrocycleStrengthProgression`
   (`generateProgram.ts:1140`) over composed dose — progression itself is
   retained (D).
8. The gateway `regenerate`/`safeFallback` arms' ability to rebuild from `[]`
   (`main`'s behaviour at `generateProgram.ts:837-844`) **and its unfixed
   store-side twin** `buildSection18ProductionFallbackCandidate`
   (`postGenerationConstraintValidation.ts:887`, nine wire-ups).
9. The dead hydration pipeline (`programStore.ts:616-1739`) — bucket C,
   physically deletable now.
10. `CoachScreen.tsx:20` dead import — trivial C.

**NOT deletable despite appearing in generation:** `buildWorkoutsFromCoach`,
`finaliseWorkoutAfterMutation`, the §18 family, the pools, `sessionBuilder`,
`sessionResolver`, `generateProgramLocally` (it is the boot engine) — see §7.

## 7. SHARED DEPENDENCIES AND THEIR RETAINED CONSUMERS

| Shared thing | Retained consumers (beyond generation) |
|---|---|
| `finaliseWorkoutAfterMutation` | coach apply (`coachCommandExecutor.ts:3664`), athlete swap (`planChangeProducer.ts:1731`), every live write (`postGenerationConstraintValidation.ts:279/:547` ← `programStore.ts:548`), §18 finaliser/gateway |
| `buildWorkoutsFromCoach` | §18 offer placement (`section18OfferPlacement.ts:490/:611`), fixture replan (`fixtureMinimalReplan.ts:404`) |
| §18 gateway + evaluator + safety finaliser | store commits (`programStore.ts:1278-1365`), projection tier-4 (`sessionResolver.ts:1927`), coach executor (`coachCommandExecutor.ts:4092`), journal |
| Pools data/lookups | coach swap siblings (`coachCommandExecutor.ts:3099-3102`), progression (`strengthProgressionIntegration.ts:410/:449`), slot coverage census, the composer itself |
| `sessionBuilder` / `buildDerivedSession` | projection-time Gunshow/prehab (`sessionResolver.ts:1819-1863`), top-ups, gateway |
| `generateProgramLocally` | **the boot** (`quiescentBoot.ts:480`), all ten entries E1-E10 |
| Prescription/load modules (`loadEstimation`, phase rep schemes) | canonical name resolver at projection (`projectVisibleWeek.ts:395`), load/cue keying |

## 8. PROPOSED SEVERANCE ORDER — DEPENDENCIES ONLY

Each step is severable only after the ones above it; no quality ordering.

1. **Carry the composed declaration (role/pattern/dose) through to the stored
   row** (R-092) and **give the composed gap records a carrier field.** Nothing
   downstream can stand down while the row loses its own authorship at the
   first hop — every later severance would re-measure as a refusal spike.
2. **Thread `composed` through the remaining five `finaliseWorkoutAfterMutation`
   call sites** (finaliser `canonicalContextFor`, gateway `:557/:1155`,
   `postGenerationConstraintValidation.ts:279/:547`) — the flag exists; only
   one caller passes it. This kills A-6 without touching shared behaviour for
   legacy rows.
3. **Exempt composed rows from the four prescription passes and the power-row
   prepend** (`defaultProgram.ts` gates on `cw.composed`, same shape as
   `:2561/:2601`) — after 1, the composed dose is authoritative and checkable.
4. **Point the store-side fallback twin at the stored composed source**
   (`postGenerationConstraintValidation.ts:887`) — the same one-line shape as
   the fixed arms; must land before any composed week can be re-gated by the
   store (it re-gates on *every* commit and *every* launch).
5. **Widen `composedRouteAdmits`** world-family by world-family; each widening
   re-runs this audit's boundary trace as its receipt.
6. **Delete the legacy authors** — `fallbackExercisesForPlanEntry`, rotation +
   refusal drop, restore loop's generation seat, thin-day substitution — once
   no admitted world reaches them (their execution counters, §5, are the
   receipt they are dead).
7. **Physically delete bucket C now or at any point** (dead hydration pipeline,
   dead import): no dependency, any order.

## 9. NOT ESTABLISHED

- **Which exact caller executes each composed-row drift strip.** The probe
  recorded the executing branch (`workoutCanonicalisation.ts:858`) and
  `composed:false`; the caller set is inferred from the static map (only the
  finaliser/gateway callers are reachable with no hard constraints present),
  not from a per-call stack capture.
- Whether `applyStrengthProgression` can change row identity (not just
  prescription) — unread.
- Whether any composed identity falls outside `findPoolEntry` and is therefore
  exposed to the fuzzy collapse (probe says it never fired in these worlds;
  the vocabulary-level question is open).
- Whether `resolveWeek` inside the bake can substitute template content for a
  generated day.
- The store-side fallback twin's runtime behaviour (B by absence of trigger;
  never observed executing).
- `withCraftSafeTopUps` internals (caller contract only).

## 10. NOT COVERED

- **Composed worlds beyond §18**: at this base all seven refuse, so boundaries
  c→f were never traversed by a composed week. The c→f measurements are
  legacy-route only; they must be re-run the day a composed week is accepted.
- **`LEGACY Pre/4d/noclub` boundaries e/f**: a Pre-season athlete with zero
  team-training days cannot complete onboarding (`onboardingSteps.ts:127`
  requires `teamTrainingDays`), so the boot refuses to regenerate for it.
  (One-liner filed in the FINDINGS LEDGER.)
- Worlds with active constraints (travel/equipment/schedule) — so
  `validateWorkoutAgainstActiveConstraints`'s drift+restore pairing on
  composed rows (the one site where **both** can fire) was reachability-mapped
  but never executed here.
- Deload weeks, injury worlds, remainder-boundary (mid-week) generation,
  coach-edit-triggered regeneration (E9), and the athlete/coach edit routes'
  own writes — traced far enough to classify shared-vs-generation only.
- Week 3/4 of any block; only weeks 1–2 were fingerprinted.
- On-device/simulator confirmation of the projection findings (measured
  headlessly through the same functions the Program tab calls).

## 11. WHAT WOULD CATCH THE NEXT UNKNOWN LEGACY ROUTE

The audit's own instrument, made standing, in order of value:

1. **A boundary-fingerprint conformance cell**: compose → fingerprint at
   composer output → fingerprint the stored week → assert byte-equality of the
   semantic fingerprint (identities, roles, patterns, dose, removal records)
   for admitted worlds, with the refusal path asserted separately. CP2's
   receipt failed precisely because it measured *actions taken*, not *meaning
   preserved*; the fingerprint is the stronger invariant and this audit's
   mutants prove it reds at the right boundary. It catches any future mutator
   **without knowing its name** — which is the definition of the next unknown
   route.
2. **An execution counter on the legacy authors** (`fallbackExercisesForPlanEntry`,
   `applyPoolRotation`, restore loop) asserted **zero for admitted worlds** —
   the counters this audit added as probes, kept as a ratchet instead.
3. **A `composed`-flag totality check**: a static cell that every
   `finaliseWorkoutAfterMutation` call site reachable from generation either
   passes `composed` through or names why not — 5 of 6 currently do not, and
   nothing today reds when a seventh caller appears.
4. The projection gap (stored-vs-shown identity diff) as a declared-debt cell,
   so a silent row drop at the glass (the mutant's fate) is a red, not a
   mystery.

---

## FINGERPRINT METHOD & INSTRUMENT HONESTY

- Probes: 4 boundary taps in `generateProgram.ts`; 9 attribution taps in
  `defaultProgram.ts`, `workoutCanonicalisation.ts`,
  `section18SafetyFinaliser.ts`, `section18AcceptedWeekGateway.ts`; 3
  env-gated mutants (`weekRebuild.ts`, `quiescentBoot.ts`,
  `generateProgram.ts`). All discarded with the worktree.
- Harness: fresh-install reset → onboarding doors → `generateProgramLocally`
  → `commitRebuiltProgram` → flush → storage snapshot/restore → full store
  rehydration → `runQuiescentBoot()` → `buildProgramTabProjectedWeek` +
  `projectWithGapsMarked`. `__DEV__ = false` (production-faithful; the dev
  clock is not used — `todayISO` threaded explicitly).
- What fought the measurement: the worktree needed the main checkout's
  `node_modules` (symlink); the profile store's quarantine guard fires on
  harness resets (writes still proceed — noise, not loss); `w2` composed
  worlds cannot be fingerprinted past week 1 because week 1's refusal throws
  the whole call; the projected week's vocabulary differs from the stored
  week's, so the e→f edge compares identities and prescriptions, not full
  structure.

*Agent: tracer, 2026-08-14. Measured at `943e030b` in a discarded worktree.*
