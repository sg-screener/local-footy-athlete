# Precedence ownership — the map, 2026-08-04

**What this is.** Sam's Option C ruling added to Stage B: *"The precedence
divergence between live and accepted resolvers is Stage B's to fix in the same
motion — one ordering, one owner."* This document is the **measured map of what
that sentence actually covers**, written before any of it is built.

**What this is NOT.** Not a plan, not a design, not a recommendation to
execute. The unification is deliberately unstarted — it is the novel core of
the L16 slice and Sam reserved it (2026-08-04). Read this to know the terrain,
then decide the approach fresh.

**Measured on `main` `936bbf7`.** Every line receipt below was verified by
reading the file this session, except where a receipt is marked
`(pre-Task-A)` — `planChangeProducer.ts` line numbers shifted in
`0221d4d` and those receipts were taken before it.

---

## 1. The headline: there are SIX copies, not four

The identity document
(`docs/STAGE_B_STAGE0_DATEOVERRIDES_IDENTITY_2026-08-03.md` §3) says two
derivation stacks disagree, "plus two more hand-rolled copies". The second
number is wrong: **`postGenerationConstraintValidation.ts` contains three
separate compose loops, not one.** So the surface area of "one ordering, one
owner" is six sites, in five files.

| # | File · function | Lines (fn / loop) | Consumes | §18 |
|---|---|---|---|---|
| 1 | `src/utils/sessionResolver.ts` · `_resolveDateRaw` | `951-1137` | overrides, marks, overlay, base, injury, proximity, conditioning | no — it is the gateway's *dependency* |
| 2 | `src/rules/acceptedEffectiveWeek.ts` · `rebaseAcceptedEffectiveWeek` | `89-187` / `104-127` | overrides, overlay, base, **constraints**, marks | yes, last |
| 3a | `src/utils/postGenerationConstraintValidation.ts` · `resolveLiveDateMutationExposure` | `700-776` / `725-741` | overrides, overlay, base | no |
| 3b | same file · `finaliseLiveDateCandidateAgainstWeek` | `1475-1560` / `1525-1541` | overrides, overlay, base | yes `:1545` |
| 3c | same file · `validateLiveWeekOverlayWrite` | `1674-1845` / `1711-1723` | overrides, *locally validated* overlay map, base | yes `:1740` |
| 4 | `src/dev/e2e/devE2ESeedRegistry.ts` · `effectiveWorkoutForDate` | `441-456` | overrides, overlay, base | no |

### The two orderings that actually contradict

**Site 1** (`sessionResolver.ts:939-1019`, priority comment at `:939-948`):

```
P1 manual override  (:962-965, returns immediately, source: 'manual')
P2 calendar mark    (:967-985  rest → null; game → createGameStub)
P3 virtual game     (:987-1009)
   overlay (:1011) ?? base microcycle (:1016-1019)
P4 game proximity   (:1021-1043)
P5 freed game slot  (:1045-1092)
P6 recovery→derived pool (:1094-1127) / unmodified template (:1129-1136)
```

**Site 2** (`acceptedEffectiveWeek.ts:104-127`, then `:144-171`):

```
compose:  base < overlay < override          (:115-126)
then:     applyUserRemovalConstraintsToWeek  (:144-157)
then:     marks + §18 gateway                (:159-171)
```

**The contradiction:** site 1 puts a manual override **above** the calendar
mark; site 2 composes the override first and applies marks **last**. On a day
that is both marked-rest and override-carrying, the two stacks return different
things — and that is not theoretical. Sam recorded the device consequence
himself at **`src/store/programStore.ts:1187-1196`** (inside
`canonicaliseAcceptedBoundaryState`, under the header *"A DERIVED REPAIR NEVER
LANDS ON THE ATHLETE'S SURFACE"*): the screen prescribed Lower Squat on a day
he had marked rest while the accepted week correctly held nothing, **three
actions from a fresh install**, and it went on to cost two further device
findings because the move door's target-identity check compares accepted
against visible and was correctly refusing about a day that disagreed with
itself.

Restated elsewhere in-repo, so the divergence is already three-times recorded:
`src/__tests__/derivedRepairOwnershipTests.ts:16-18` (verbatim),
`src/__tests__/athletePlacementOwnershipTests.ts:638-656` (a *second*
divergence axis — the gateway resolves with `manualOverrides: {}` so
athlete-owned days are invisible to derivers, and the visible resolver keeps
the session only because it answers ownership a different way, via the
`source === 'manual'` short-circuit), and
`src/rules/acceptedEffectiveWeek.ts:129-143` (the flattening that loses
`owner`).

### `userRemovalConstraints` is absent from four of six

Only sites 2 and (indirectly) the gateway read constraints.
**`userRemovalConstraints` does not appear anywhere in `sessionResolver.ts`**
and is not a field on `ScheduleState` (`:94-178`). So the athlete's strongest
decision surface — the thing that makes a bin survive §18 — **cannot beat an
override on the live path, because the live path cannot see it at all.**

Site 4 is subtler: `DevE2EWitnessState` *declares* `userRemovalConstraints`
(`:188`) but `effectiveWorkoutForDate` never consults it; it is read only at
`:1335` for separate witness matching.

## 2. The lookup divergence, and what an explicit `null` means at each site

An override entry can be a `Workout` **or** an explicit `null`. Whether `null`
is *visible* depends on how each site tests for presence — and they do not
agree.

| Site | Override lookup | Overlay lookup | An explicit `null` override means… |
|---|---|---|---|
| 1 | truthy (`if (manualOverrides[date])`, `:962`) | `hasOwnProperty` (`:879-897`) | **invisible** — falls through to marks/overlay/base |
| 2 | truthy (`const manual = …; manual ? …`, `:108,115`) | `hasOwnProperty` (`:109-112`) | **invisible** — falls through to overlay/base |
| 3a | `?? ` (`:733-739`) | `hasOwnProperty` | **invisible** (equivalent to truthy for `Workout \| null`) |
| 3b | `??` (`:1529-1539`) | `hasOwnProperty` | **invisible** |
| 3c | `??` (`:1714-1721`) | `hasOwnProperty` | **invisible** |
| 4 | **`hasOwnProperty`** (`:448-455`) | `hasOwnProperty` | **honoured — "this day is empty"** |

Two consequences worth carrying into any design:

1. **The product cannot express "the athlete cleared this day" as a null
   override.** Every product reader drops it. Emptiness is expressed instead
   through `userRemovalConstraints` + the canonical rest stub
   (`userRemovalConstraints.ts:49-85`, the `wholeDayRestOwned` branch, added
   precisely because a calendar mark outranked every deriver and Sam ruled that
   a deletion door does not speak for the calendar).
2. **The dev-E2E seed registry models a semantic the product does not
   implement.** Site 4 honours a null override; no product site does. Since
   `devE2EEntryBoundaryTests.ts:169` asserts production code never references
   that module, this is contained — but a witness built on site 4's semantics
   can assert a state no product reader would ever produce. That is the
   fixture-fidelity law (AGENTS.md) at the precedence layer.

Note the asymmetry inside sites 1 and 2: **overlay** entries *are*
`hasOwnProperty`-tested, so an explicit `null` **overlay** entry IS honoured
(site 2 records `owner: 'week_overlay'`, `workout: null`). One surface honours
explicit emptiness; the other silently discards it, in the same loop.

## 3. Why a two-stack edit does not deliver "one ordering"

**The §18 gateway re-enters the live resolver.**
`src/rules/section18AcceptedWeekGateway.ts:14` imports
`resolveWeekWithConditioning` from `sessionResolver`. Inside
`resolveFinalVisibleSection18Week` (`:184-271`) it synthesises a throwaway
`Microcycle`/`TrainingProgram` from the already-composed workouts (`:200-226`)
and calls the live resolver at `:271` with a `ScheduleState` that **hard-blanks
both override surfaces**:

```
section18AcceptedWeekGateway.ts:248-250
  const state: ScheduleState = {
    manualOverrides: {},
    weekScopedOverlays: {},
```

So the accepted stack's *final* step runs the live precedence code with the two
surfaces emptied, because their content has already been flattened into
`microcycle.workouts` — and that flattening is exactly what loses the `owner`
distinction (`acceptedEffectiveWeek.ts:129-143`).

Three things follow for anyone attempting unification:

- **Editing sites 1 and 2 to agree is not sufficient**, because site 2's last
  step *is* site 1 running against blanked inputs. A change to site 1's
  override-vs-mark ordering is a no-op inside the gateway (nothing to order)
  while being athlete-visible on the live path. The two halves of the same
  edit land in different worlds.
- **Ownership must survive the flattening**, or the gateway keeps re-deriving
  over athlete-owned days. Partially paid already: `athletePlacement` stamping
  (`acceptedEffectiveWeek.ts:147-153`, `rules/athletePlacement.ts`) exists so
  derivers can ask. Whether the stamp is now sufficient to retire the blanking
  is an open question, not a settled one.
- **The gateway also owns marks**, via `fixtureAwareMarkedDaysForWeek`
  (`:154-178`), which folds contract fixture anchors into `markedDays` with the
  explicit athlete mark winning (`:166-167`). Any "marks sit here in the
  ordering" statement has to account for that fold.

## 4. What else is duplicated alongside the precedence

Unification will collide with these; they are cheap to collapse but must not be
collapsed *silently* (AGENTS.md: a gate that reads code is coupled to code
shape — re-verify the equality gates still see the values after any
de-duplication).

- **`microcycleForWeek` — three copies:** `acceptedEffectiveWeek.ts:67-80`,
  inline at `postGenerationConstraintValidation.ts:1695-1704`,
  `programStore.ts:1096-1105`.
- **Monday arithmetic — five:** `acceptedEffectiveWeek.ts:61-65`,
  `pGCV.ts:109-113` plus inline `-((getDay()+6)%7)` at `:711-713,720,1497-1500`,
  `devE2ESeedRegistry.ts:233-248`, `programStore.ts:436-440`,
  `sessionResolver.ts:228,1177`.
- **Genuinely shared already:** `resolveWeekWithConditioning`
  (`sessionResolver.ts:1423` — site 1 natively, site 2 via the gateway),
  `applyUserRemovalConstraintsToWeek` (`rules/userRemovalConstraints.ts` — used
  by site 2 `:144` and the gateway `:194,664`, by nothing else),
  `selectMicrocycleForDate` (sites 1 and 3a),
  `athletePlacementForDateOverride` (site 2 only).

## 5. Who consumes each site (blast radius)

- **Site 1** — the whole render path. Two state adapters, both of which rename
  `dateOverrides → manualOverrides` and **both of which omit
  `userRemovalConstraints`**: `useSchedule.ts:95-235` (`:101`) and
  `coachWeekDiff.ts:191-195` (`buildScheduleStateImperative`). Consumers
  include `visibleProgramReadModel.ts:150,189`, the home/day screens,
  `CoachScreen.tsx`, and — importantly — the walker's own production bindings
  (`dev/e2e/explorerProductionBindings.ts:3-12`). Plus engines:
  `programAdjustmentEngine`, `applyAdjustmentEvents` (`:1514,1974`, injectable
  `resolveWeek` seam), `injuryAdjustmentEngine`, `coachModalitySwapOrchestrator`,
  `lighterDayTransaction:66`, `coachCommandExecutor`, `planChangeProducer`
  (pre-Task-A `:2598,2689`).
- **Site 2** — every accepted-state transaction: `programStore.ts:71,1109`,
  `acceptedStateTransaction.ts` (11 call sites), `temporarySourceFactTransaction`,
  `fixtureMutationTransaction`, `reversibleAdjustmentTransaction`,
  `coachCommandExecutor:4064`, `planChangeProducer` (pre-Task-A).
- **Site 3a** → `programStore.ts:419-434`. **Site 3b** → `validateLiveWorkoutWrite` /
  `validateLiveNullableWorkoutWrite` → `programStore.ts:397-410`, and thence
  `programEditWriteGuard:245`, `coachActions` (4 sites), `coachRevisionPolicy`,
  `coachRevisionOverrideWriter`, `canonicalPlanChangeCandidateMaterializer:19`.
  **Site 3c** → `programStore.ts:412-417` (`postValidateWeekOverlay`).
- **Site 4** — in-file only (`:1052,1086,1164,1273,1305`), consumed by the
  dev-E2E witness suites.

## 6. The instruments that already exist to prove a unification

This is the good news: the agreement property is **already gated**, so a
unification has a ready-made oracle rather than needing one built.

- **`src/__tests__/derivedRepairOwnershipTests.ts`** — `splitDays()` (`:159-176`)
  diffs the live week (`visibleWeek()`, `:150-152`) against
  `rebaseAcceptedEffectiveWeek(...).visibleWorkouts` by `planEntryId ?? id`, and
  asserts the divergence count is `0` (`:205,271,298`). Run:
  `npm run test:derived-repair-ownership`. **This is the single most useful
  existing asset for the unification.**
- `src/__tests__/athletePlacementOwnershipTests.ts:657-672+` — accepted vs
  screen across all seven days.
- `src/__tests__/surfaceAgreementTests.ts` — L-P1/L-P3 surface agreement;
  note its own record that `L-P3 TEMPLATE = PROJECTION` currently reds in
  declared shapes (now four, plus the combination declared 2026-08-04).
- `athleteDoorMatrixTests.ts:90,299`; `section18AcceptedWeekGatewayTests.ts:61,322,426`.

**Tests that pin the ordering being changed** — these are the conversions any
unification must make, each citing the ruling:

- `coachScreenUAEFlowTests.ts:434-462` §[6] *"Resolver priority — injury
  override wins over calendar marks"*, whose comment at `:453-454` names "the
  real resolver's Priority 1 manual-override path" explicitly.
- `coachInjuryIntegrationTests.ts:405-436` §[4], asserting `thu?.source ===
  'manual'` at `:432`.
- Also touching site 1's behaviour: `resolverInjuryFilterTests.ts:175-296`,
  `persistentInjuryStateTests.ts:277-290`, `devE2EClockTests.ts:210-246`.
- Pinning site 2's `owner` values: `chainedMutationContinuityTests.ts:605,847`
  (plus source-text assertions at `:729,732` that transaction and hydration
  both call `rebaseAcceptedEffectiveWeek`),
  `section18OwnershipInvariantTests.ts:177`, `coachAddSessionOwnershipTests.ts:159`,
  `acceptBoundaryContractTests.ts:6`.

## 7. Honest scope estimate for "one ordering, one owner"

Stated as ranges with the reasoning, because the ruling's phrase reads smaller
than the terrain.

**The irreducible core** — a precedence owner module plus site 2 delegating to
it, behaviour-preserving: *small*. Site 2's semantics become the definition;
nothing moves. Provable by existing suites staying green.

**Site 1 converging on that ordering** — *medium, and the only athlete-visible
part*. It is a real behaviour change (override-vs-mark flips; constraints
become visible to the live path for the first time). It requires
`ScheduleState` to gain `userRemovalConstraints` and **both adapters** to feed
it. Two named test conversions. The walker will report new offences in
marked/override worlds, and per L13 each is triaged against the ruling — a red
proving the old ordering was load-bearing somewhere is a stop-and-diagnose, not
an assertion to loosen.

**The three `pGCV` loops + site 4 delegating** — *small each, four times*, and
mostly mechanical. Watch that 3c reads a *locally validated* overlay map rather
than the stored one (`:1679-1690`), so it is not a straight substitution.

**The gateway's blanked re-entry (§3)** — *the genuine unknown*. This is where
the estimate stops being reliable. Retiring the blanking means the gateway must
distinguish athlete-owned from derived content *after* flattening, which is
what the `athletePlacement` stamp exists for — but whether the stamp is
complete enough to carry it has not been measured. **If it is not, the honest
answer may be that the flattening itself is the thing to retire, which is a
larger unit than the ruling's sentence implies.** That determination is a
prerequisite to any credible sizing, and it is cheap to make: check whether
every path that populates `composedWorkouts` stamps ownership.

**What would make the whole thing tractable:** the ordering has exactly one
honest definition already written down — site 2's — and one gated oracle
already asserting agreement (`derivedRepairOwnershipTests`). The work is
mostly *deletion of alternatives*, not invention. The risk is concentrated in
one place, and it is named above.

## 8. Explicitly not decided here

- Which ordering wins (site 2's is the obvious candidate and Sam's device
  finding supports it, but this document does not rule it).
- Whether the injury filter's manual-exemption (`sessionResolver.ts:930`,
  rationale `:906-918`) survives constraints becoming visible on the live path
  — the two interact and nobody has measured how.
- Whether the gateway's blanking retires or the flattening does (§7).
- Whether site 4 should be converted or simply deleted, given
  `devE2EEntryBoundaryTests.ts:169` already fences it off from production.
