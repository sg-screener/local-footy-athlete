# Stage B — Stage 1 implementation plan (L16 vertical slice), 2026-08-03

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans
> (inline execution, this session). Steps use checkbox (`- [ ]`) syntax.

**Goal:** one honest loop — the athlete's live week derived from authored
contract + declared days + decision surfaces under ONE precedence ordering,
proven load → display → change → repair → approve → persist →
relaunch-identical by the walker — while the three Option C retirements land
(typed re-add restoration, lighter-day derivation, precedence unification).

**Architecture:** four sub-stages, one commit each, on
`feat/stage-b-stage1-l16-slice`. Each sub-stage ends with its own gates green
and a written differential prediction verified. No conditioning-template
import from the four `isStageBLanded` files (that flips the STAGE_B_DOOMED
gate, which is the switchover stage's payload, not stage 1's).

**Base:** main `936bbf7`. All line receipts below verified this session.

## Global constraints (bind every task)

- **Differential law:** any golden movement must match the predictions in §P
  below; regenerate with `npm run test:stage-b-generation-differential -- --write`
  in the same commit ONLY for predicted movement; unpredicted movement is a
  STOP.
- **Census ratchet:** a detector count drop lands with its census edit and
  baseline drop IN THE SAME COMMIT (`LEGACY_DEBT_BASELINE`,
  `legacyReckoningCensus.ts:853`).
- **L11:** new action vocabulary + matrix coverage in the same stage.
  **L14:** new domain logic callable from a plain test. **L15:** no writer of
  a superseded shape. **Instrumentation rule:** every new writer/derivation
  emits to the athlete action tape from birth.
- **Totals-or-red:** any touched/added suite keeps `armTotalsOrRed()` at
  module top + `totalsPrinted(n)` at exit; no `process.exit(0)`.
- **Environment law:** `git branch --show-current` before EVERY commit.
  Commit before any mutation-testing. No stash, no `git checkout -- <file>`.
- **Pre-existing reds never misattributed:** `test:plan-change-producer`
  fails broadly on main TODAY (~50 FAILs incl. [13]/[14]/[17]/[18]/[19]; not
  in the bible chain). `test:block-state`, `fixtureMutationTransactionTests`,
  `programControlActionsTests`, `devE2EDefaultSeedInstallationTests`,
  `test:row-counting` are declared carried reds (LR-14s).

## §P — Differential predictions (written BEFORE code, per the golden law)

The stage-0 golden pins FRESH GENERATION ONLY (14 scenarios × ≤4 weeks,
pinned clock, no athlete history, no overrides/overlays/marks beyond the
contract's own fixture anchors, no readiness facts, no removal constraints).

| Sub-stage | Prediction | Why |
|---|---|---|
| A (typed re-add restoration + dead deferral deletion) | **ZERO golden movement** | touches `planChangeProducer`/`acceptedStateTransaction` mutation lanes only; `generateProgramLocally` and everything it calls is untouched |
| B (lighter-day → deriving lane) | **ZERO golden movement** | touches the lighter-day door + reversible-adjustment lane only; no generation-path file changes |
| C (precedence unification) | **ZERO golden movement** | fresh generation writes no overrides/overlays/constraints; the §18 gateway already blanks `manualOverrides`/`weekScopedOverlays` (`section18AcceptedWeekGateway.ts:248-250`) and will receive empty constraints; the override-vs-mark flip cannot bite when overrides are empty |
| D (walker relaunch cell + L14 prefs injection) | **ZERO golden movement** | harness + options-plumbing only; the injected `athletePrefs` default is the same store read the engine does today |

**Consequence:** the differential gate must stay green at every sub-stage
with NO `--write`. A single differing line at any point is unpredicted
movement → STOP, diagnose, do not regenerate.

**Predicted reds elsewhere (deliberate, each converted in the same commit):**

1. `coachScreenUAEFlowTests` section [6] "injury override wins over calendar
   marks" (`:434-462`) — pins the LIVE ordering the ruling retires. Flips to
   assert marks-over-override, citing the ruling.
2. `readinessSourceFactOwnershipTests` R5 (`:401`, comment `:419`) — pins the
   dateOverride channel for the lighter-day trim. Flips to assert the overlay
   channel + `dateOverrides` untouched.
3. `programOverrideOwnershipTests` (`:291-325`) — uses `writer: 'lighter_day'`
   as its normal-write case; that writer id retires from the closed union.
   Cell switches to a surviving writer id.
4. `planChangeProducerTests` [20] source-text cells (`:2195-2223`) begin to
   PASS once the legacy call sites are deleted — incidental improvement in an
   already-red, unchained suite; recorded, not claimed as this stage's test.

## §0 — Measured correction to the ruling's premise (record in boundary report)

The Option C text says Stage B retires "the two athlete routes (occupied-day
stack adds, no-template swaps)". Measured on main `936bbf7`:

- **Occupied-day stack adds no longer defer.** Migrated to the typed path
  (`planChangeProducer.ts:1950-1971` "OCCUPIED-DAY STACK ADDS COME HOME";
  corroborated `acceptedStateTransaction.ts:2619-2620`). The only live
  emitter of `add_defers_to_legacy_stack` is the **active-removal re-add**:
  a whole-session bin (`status: 'active'`, `scope: 'whole_session'`, no
  `remainingWorkout`) being un-pinned by a fresh add
  (`planChangeProducer.ts:1972-1982`). Un-pinning works today ONLY via the
  legacy writer's side effect (`programStore.ts:2779-2790` flips constraints
  to `restored`/`explicit_re_add`).
- **`no_template_for_category` is a no-op double refusal.** The legacy path
  runs the identical `resolveTemplatePlanChange` lookup and refuses with the
  same code (`planChangeProducer.ts:1069-1070` → `:2996-3003`), never
  reaching `applyCoachRevisionDateOverrides`.
  `docs/STACK_PRIMITIVE_RETIREMENT_DIAGNOSIS_2026-07-23.md:344-376` reached
  the same verdict.

So sub-stage A = build the ONE missing typed capability (restoration), then
delete the whole deferral mechanism. Same end state as the ruling orders
(zero athlete-side legacy-writer reachability, LR-3 4→2), sharper diagnosis.
The census founding text also carries drifted line numbers — corrected in the
same commit with a dated note. The ruled-on identity doc is NOT edited
(submission preserved verbatim); the correction rides the boundary report.

---

### Task A: typed re-add restoration; the athlete deferral dies; LR-3 4→2

**Files:**
- Modify: `src/store/acceptedStateTransaction.ts` (~`:3071-3183`
  `stageAthleteSessionAdditionTransaction`, ~`:3119-3137` dedupe block)
- Modify: `src/utils/planChangeProducer.ts` (`:1723-1742` defer-sets,
  `:1972-1982` restoration error, `:2236-2262` preview guard, `:2747-2753`
  commit guard, `:2371-2380` + `:3006-3059` legacy call sites, import `:48`)
- Modify: `src/data/legacyReckoningCensus.ts` (`:448-469` LR-3 entry, `:853`
  baseline 76→74)
- Test: `src/__tests__/athleteActionWalkerTests.ts` (new deterministic cell
  beside the nine armour cells)
- Test: whichever suite owns `stageAthleteSessionAdditionTransaction` cells
  (locate at implementation; `athletePlacementOwnershipTests.ts` /
  `g1LandingAskFlowTests.ts:1074` test 28 are the existing pins)

**Interfaces:**
- Produces: `AthleteSessionAdditionTransactionInput` gains
  `restoredConstraintIds?: string[]` (or equivalent staged flip);
  `resolveAthleteMutation`'s add branch returns `ok: true, kind:
  'add_session'` for the re-add case instead of
  `add_defers_to_legacy_stack`.

Steps:

- [ ] **A1 — failing test first:** a walker-style deterministic cell: fresh
  install → onboard → generate → bin an occupied day through the door
  (`remove_session`, whole session) → re-add a category onto that day
  through the door. Assert: outcome `applied`; the prior constraint is
  `status: 'restored', restorationReason: 'explicit_re_add'`; the day shows
  the added session; **`useProgramStore.getState().dateOverrides` has no
  entry for the date**; a decision witness for the add is on the action
  tape; L3/L4b hold (reuse `checkInvariants`). Expected failure mode today:
  the add lands via the legacy writer, so the dateOverrides assertion REDS.
- [ ] **A2 — typed restoration:** in
  `stageAthleteSessionAdditionTransaction`, where the day carries active
  whole-session constraints with no `remainingWorkout` (today's defer
  condition), stage those constraints flipped to
  `{status: 'restored', restoredAt, restorationReason: 'explicit_re_add'}`
  (match the `programStore.ts:2779-2790` side-effect semantics: every active
  constraint on that date) and proceed with the normal empty-day add
  contract (`originalWorkout` = rest placeholder — the day IS visibly empty).
  The existing dedupe/noChange block must not swallow this case.
- [ ] **A3 — resolver:** `resolveAthleteMutation` add branch returns the
  typed resolution for the re-add case; delete `add_defers_to_legacy_stack`
  emission. Remove `no_template_for_category` from BOTH defer-sets (the
  typed refusal is byte-identical; prove with a quick test that the refusal
  sentence for an unknown category is unchanged).
- [ ] **A4 — delete the mechanism:** defer-sets, `defersToLegacy` guards,
  both legacy call sites in `planChangeProducer.ts`, the import. Keep
  `coachTurnController.ts:2343/:2429` (coach-owned, LR-6).
- [ ] **A5 — census, same commit:** LR-3 `declared: 4→2`; founding text
  corrected (dated note: occupied-day adds retired earlier, re-add
  restoration + dead deferral retired here; line receipts refreshed);
  sequence updated (athlete share PAID `<this commit>`, coach share LR-6/5B);
  `LEGACY_DEBT_BASELINE` 76→74.
- [ ] **A6 — gates:** `test:legacy-census`, `test:g1-landing-ask-flow`
  (test 28 must pass through the typed path), `test:athlete-door-matrix`,
  `test:action-walker`, `test:action-walker:deep`, `test:compile`,
  `test:stage-b-generation-differential` (must be green with NO --write),
  targeted transaction suites.
- [ ] **A7 — verify branch, commit.**

### Task B: lighter-day trim becomes a deriving-lane derivation

**Files:**
- Modify: `src/utils/lighterDayTransaction.ts` (`:62-103`)
- Modify: `src/store/programStore.ts` (`ProgramOverrideWriterId` union
  `:2577` — retire `'lighter_day'`)
- Reference precedents: team-night sparse overlay
  (`temporarySourceFactTransaction.ts:474-499`),
  `buildDerivingSourceFactAdjustment` (`:490`),
  `commitReversibleAdjustmentCreationTransaction` (`weekRebuild.ts:804`)
- Test: `src/__tests__/readinessSourceFactOwnershipTests.ts` (R5/R6/R12),
  `src/__tests__/programOverrideOwnershipTests.ts` (`:291-325`),
  `src/__tests__/athleteActionWalkerTests.ts` (new `accept_lighter_day`
  action + vocabulary non-vacuity)

**Interfaces:**
- Produces: `applyLighterDayForToday` unchanged signature; the commit now
  stages a sparse `WeekScopedWorkoutOverlay` (`reason:
  'readiness_reduction'` — already in the union, `types/domain.ts:981-1007`)
  `workoutsByDate: {[date]: trimmed}` plus a reversible adjustment keyed on
  `sourceFactId` (team-night shape), and writes NOTHING to `dateOverrides`.

Steps:

- [ ] **B1 — failing tests first:** flip R5's channel assertion (overlay
  entry exists for the date; `dateOverrides` untouched) and add: accept →
  today lighter (R6 semantics unchanged); clear the fact → cascade-undo
  restores today byte-identical (R12 semantics unchanged, now via overlay
  removal); the decision witness lands on the tape.
- [ ] **B2 — convert the transaction:** same trim
  (`applyLighterDayTrim(resolvedToday)`), same refusal on empty changes,
  same disclosure copy; the write becomes the staged sparse overlay + the
  fact-linked reversible adjustment; tape emission from birth (reuse the
  transaction's trace; event name chosen from the existing union or added
  to it AND to `DECISION_EVENTS` — the accept is an athlete decision).
- [ ] **B3 — retire the writer id:** remove `'lighter_day'` from the closed
  union; `programOverrideOwnershipTests` normal-write cell switches to a
  surviving writer. A future lighter-day override write is now a COMPILE
  error.
- [ ] **B4 — walker vocabulary (L11, same stage):** new action
  `accept_lighter_day` — only proposable when a today-scoped readiness fact
  is active (mirror the offer's gate,
  `HomeScreenV2.tsx:906-908`); performs `applyLighterDayForToday` through
  the real door; add to the non-vacuity gate's required-proposals list only
  if reachability is deterministic enough (else assert it was proposed ≥0
  and cover with a deterministic cell: declare fact → accept → laws hold →
  clear → restored).
- [ ] **B5 — strengthen the LR-1 walker claim:** the `:2464` cell's claim
  text ("remaining writers: coach pipeline, lighter-day, LR-3 residuals")
  updates — after A+B, NO athlete-reachable door writes `dateOverrides`;
  assert it over the walked worlds including the new action.
- [ ] **B6 — gates:** `test:readiness-source-fact-ownership` (or its chain
  name), `test:program-override-ownership`, `test:action-walker`,
  `test:action-walker:deep`, `test:compile`, differential green NO --write.
- [ ] **B7 — verify branch, commit.**

Parked (NOT this task): the hydration-repair in-place branch
(`programStore.ts:1216-1219`) — with the lighter-day writer gone, the
athlete-authored-override population it repairs shrinks to coach writes +
restores; whether it should narrow is Sam's, flagged in the boundary report.

### Task C: one precedence ordering, one owner

**Files:**
- Create: `src/rules/dayPrecedence.ts` — dependency-light owner (types +
  `userRemovalConstraints` only; MUST NOT import `sessionResolver`,
  `acceptedEffectiveWeek`, or the gateway — those import it; the cycle risk
  is real: gateway → sessionResolver already exists)
- Modify: `src/utils/sessionResolver.ts` (`:939-1019` — P1/P2 flip; consume
  owner for surface-compose; apply constraints), `ScheduleState` (`:94-178`,
  add `userRemovalConstraints`), adapters `src/hooks/useSchedule.ts:95-235`
  + `src/utils/coachWeekDiff.ts:191-195`
- Modify: `src/rules/acceptedEffectiveWeek.ts` (`:104-127` loop delegates to
  the owner; behaviour identical)
- Modify: `src/utils/postGenerationConstraintValidation.ts` (`:725-741`,
  `:1525-1541`, `:1711-1723` — three compose loops delegate; the fourth
  `microcycleForWeek` copy at `:1695-1704` collapses onto the shared one)
- Modify: `src/dev/e2e/devE2ESeedRegistry.ts` (`:441-456` delegates)
- Modify: `src/rules/section18AcceptedWeekGateway.ts` (`:248-250` — blank
  constraints explicitly alongside the two blanked surfaces, with the
  documented reason)
- Test: new `src/__tests__/dayPrecedenceOwnershipTests.ts` (chained) +
  `coachScreenUAEFlowTests.ts:434-462` conversion

**Interfaces:**
- Produces: `composeDaySurfaces({date, dayOfWeek, base, overlay,
  dateOverrides}) → {workout, owner: 'date_override'|'week_overlay'|
  'base_microcycle'|'empty'}` with the accepted stack's exact semantics
  (truthy override lookup, hasOwnProperty overlay lookup — byte-compatible
  with `acceptedEffectiveWeek.ts:115-126` so Task C is behaviour-preserving
  for the accepted stack); plus the ordering statement (marks and
  constraints sit ABOVE composed content; §18 last) as the module's law
  comment, and a per-date constraint-application helper shared with
  `applyUserRemovalConstraintsToWeek`.

Steps:

- [ ] **C1 — failing tests first** (`dayPrecedenceOwnershipTests.ts`):
  (1) marked-rest + dateOverride → live resolver shows REST (Sam's device
  finding, `programStore.ts:1187-1196`, currently inverted on live);
  (2) active whole-session removal constraint + coach dateOverride → live
  resolver honours the constraint (currently constraints are invisible to
  live); (3) agreement property: for a composed world (base + overlay +
  override + mark + constraint), live `resolveDate` content ==
  `rebaseAcceptedEffectiveWeek().visibleWorkouts` content for every day;
  (4) source-text cell: the four consumer files reference the owner and
  contain no local surface-compose (regex on the deleted loop shapes — the
  de-duplication lesson from AGENTS.md: assert the gate still sees the
  values after collapse).
- [ ] **C2 — the owner module** with the exact accepted-stack semantics.
- [ ] **C3 — accepted stack delegates** (no behaviour change; its suites
  stay green untouched).
- [ ] **C4 — live resolver converges:** mark check moves ABOVE the manual
  override (P1/P2 flip, `:962-985`); compose step delegates; constraints
  applied per-date after compose (owner order: compose < constraints <
  marks, with game/proximity/freed-slot steps unchanged below); adapters
  feed `userRemovalConstraints`. The injury-filter manual-exemption
  (`:930`) is UNCHANGED this stage (its interaction with constraint-honour
  is noted in the boundary report, not silently altered).
- [ ] **C5 — the three pGCV loops + devE2E copy delegate;** gateway blanks
  constraints explicitly.
- [ ] **C6 — convert `coachScreenUAEFlowTests` [6]** to the ruled ordering
  (marks over overrides), citing the ruling in the cell comment.
- [ ] **C7 — gates:** `test:derived-repair-ownership`,
  `test:athlete-placement-ownership`, `test:surface-agreement`,
  `test:section18-gateway` (names per package.json), `test:athlete-door-matrix`,
  both walker tiers, `test:compile`, differential green NO --write.
  Deep-walker offences here are INFORMATION (the flip is athlete-visible in
  marked/override worlds): any new offence is triaged against the ruling
  before conversion — a red that shows the OLD ordering was load-bearing
  somewhere is a STOP-and-diagnose, not a loosened assertion (L13).
- [ ] **C8 — verify branch, commit.**

### Task D: the L16 slice proof + L14 payment + boundary report

**Files:**
- Modify: `src/__tests__/athleteActionWalkerTests.ts` (relaunch-identical
  cell; depth reporting)
- Modify: `src/services/api/generateProgram.ts` (`:148-191` options gains
  `athletePrefs?`; `:855` reads the option with the store read as the
  boundary default)
- Reference: `simulateProcessRelaunch` precedent
  (`src/__tests__/onboardingReliabilityTests.ts:188-204`)
- Create: `docs/STAGE_B_STAGE1_BOUNDARY_REPORT_2026-08-03.md`

Steps:

- [ ] **D1 — relaunch-identical walker cell (async, deterministic):** fixed
  seed → bounded walk through the full loop (onboard → generate [load +
  approve: `commitRebuiltProgram` → `commitAcceptedStateTransaction`] →
  one door change → §18 repair path exercised by the commit → persist) →
  capture the semantic snapshot of the visible week
  (`snapshotSemanticWorkout` per day + `projectedWeek`) → simulate process
  relaunch (persistence flush, in-memory stores reset, hydrate from
  storage) → re-capture → assert byte-identical. Record the walked
  athlete's live week mode in the cell's claim (ONE mode, named — the
  slice's honest scope). Two seeds: one off-season world, one in-season
  game-week world (still "one mode per loop"; two loops).
- [ ] **D2 — L14 payment:** `athletePrefs` injection point; the store read
  survives only as the boundary default; differential harness untouched
  (prediction ZERO holds because the default is the same read).
- [ ] **D3 — placement × domain matrix:** stage 1 places nothing new —
  state this explicitly in the boundary report instead of a vacuous
  extension.
- [ ] **D4 — full chain:** `npm run test:bible` end-to-end EXIT=0 (the
  stage 0 report's NOT-COVERED explicitly owes a full-chain run; this
  stage pays it).
- [ ] **D5 — boundary report** with: north-star direction; the §0 measured
  correction; L12 (what catches the next defect of each class: the
  agreement property test, the source-text no-local-compose cell, the
  compile-error on retired writer ids, the census completeness detector);
  L13 depth reached (walker tiers + relaunch cell depth); NOT-COVERED
  (stored-program rendering lens still absent; three unreached modes;
  hydration-repair in-place branch unadjudicated; live injury-filter
  manual-exemption interaction; coach writers untouched per LR-6; no device
  pass — L10 remains open until Sam's pass); parked-for-Sam list; **the
  %MAS range-vs-binary question** (both representations with receipts:
  `masCopy.ts:26-34` + `:97-101` self-declared conflict; template rows
  `conditioningTemplates.ts:851-1159`; `deriveMas` currently has zero
  generation-path consumers — the conflict is latent until MAS becomes a
  number; options + recommendation for Sam to pick the owner).
- [ ] **D6 — verify branch, commit; leave branch unmerged** pending Sam's
  read of the boundary report (device pass is the unit's L10 close, and
  stage 1 is not the unit's end).

## Self-review notes

- Spec coverage: Option C items 2/3/4 → Tasks C/A/B; "one ordering, one
  owner" → C; L16 loop walker-proven → D1; golden-against-predictions → §P
  enforced at every task's gate step; %MAS rides D5; LR-3 payment → A5;
  L11/L13/L14/L15 → B4/C7/D2/A4+B3.
- The stage does NOT touch: conditioning templates import (STAGE_B_DOOMED
  trap), `masCopy.ts` behaviour, coach pipeline writers, the multi-date
  coach bypass (`coachTurnController.ts:2452-2466` — LR-6), the safety
  projection's own commit (`postGenerationConstraintValidation.ts:1910` —
  only its compose loops delegate).
- Order rationale: A and B shrink the override-writer population BEFORE C
  flips what overrides lose to, so the flip's blast radius at C is
  coach-written overrides only.
