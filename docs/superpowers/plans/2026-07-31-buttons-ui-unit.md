# Buttons/UI Unit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the one-projection migration (every athlete-facing surface consumes `project()`) and implement the 13 Sam-signed design rulings, ending with the combined device-pass checklist that closes branch `fix/g1-ownership-and-move-scoping`.

**Architecture:** `project()` (`src/rules/projectVisibleWeek.ts`) becomes the single owner of what the athlete sees — rows, headlines, capabilities — and the four legacy projections (`resolveWeekWithConditioning` card path, `useDayWorkout` composition, `snapshotProjectedDay` menu path, raw `workout.name` reads) are retired surface-by-surface. The 13 design rulings are built ON the projection, once, with SignedCopy. The walker gains a declared DEPTH tier (L13) so surface-agreement cells 1 and 4 red honestly before surfaces move, and L-P1/L-P2/L-P4 arm in `test:bible` in their green commits.

**Tech Stack:** React Native + TypeScript, sucrase-node standalone test suites (no jest), inline `react-native-svg` icons, `test:bible` 108-suite `&&` chain.

## Global Constraints

- `test:bible` EXIT=0 before EVERY commit. Run `git branch --show-current` immediately before every commit (shared tree).
- Every new or changed athlete-visible string is appended to `docs/COPY_SHEET_RULINGS_2026-07-30.md` under **"Batch 6 — PROPOSED, NOT SIGNED (buttons/UI unit, 2026-07-31)"** in the SAME commit that ships it (else `copyRulingsBindingTests` reds). Sam is asked ONCE, at the end — batch, don't trickle.
- Strings Sam already authored in `docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md` ("Short on time today", "Away this week?", "I'm injured", "I'm sick/flat today") are Sam-authored copy — record them in Batch 6 as SIGNED-BY-RULING with a pointer to the rulings file, not as proposals.
- The copy ceiling `ATHLETE_VISIBLE_GAP_CEILING` (`signedCopyExtractionTests.ts:183`, currently 187) ratchets DOWN in the same commit whenever strings leave the surfaces (repeat-week deletion, SignedCopy conversion). Never up.
- Icons are terminal-proposed imagery (inline SVG, matching `HomeScreenV2.tsx:2152-2170` helpers), checked at Sam's device pass. No per-icon signing; nonsense pairings are defects.
- LR-6 stands: NO coach pipeline logic changes. Coach chips removal (Task 10) and coach-snapshot read-model migration are UI/read-model only; `coachTurnController`, resolvers, executors untouched.
- New stored state is presumed wrong (north star). This unit stores nothing new; the only fact-shape change (today-scoped busy, Task 7) is a payload on the EXISTING `set_schedule_modifier` door.
- Every task's commit message states: convergence direction, L12 (what catches the next defect of this class), depth per L13 (what depth the verification reached), NOT-COVERED.
- L11: no device pass until the whole unit is green — the checklist at the end is ONE combined pass.

## Task order and why

1. Repeat-week dies first — shrinks every surface the rest touches.
2. `project()` completes (rows/detail/registered headlines) — everything renders from it.
3. Walker depth tier — honest reds on cells 1/4 recorded BEFORE surfaces move (reassessment stage 3; L13).
4. Menu surface → projection + four-action redesign (rulings 7-9).
5. Card surface → projection.
6. Title + content surfaces → projection.
7. Week-screen buttons (rulings 2-6).
8. Edit-exercises inline re-jig (ruling 12).
9. Option-sheet icon pass (ruling 10).
10. Coach: snapshot read-model → projection; chips removed (ruling 13).
11. Deletions + L-P2/L-P4/L-P1 armed; ceilings settled.
12. Batch-6 copy proposal finalised + boundary report + combined device-pass checklist.

---

### Task 1: Repeat-week dies entirely (ruling 1)

**Files:**
- Delete: `src/utils/repeatWeek.ts`, `src/__tests__/repeatWeekTests.ts`, `src/__tests__/repeatWeekTransactionTests.ts`, `src/__tests__/repeatWeekUIContractTests.ts`
- Modify: `src/screens/home/HomeScreenV2.tsx` (lines 596-655 result/active/ingress cards, 911-934 confirm sheet), `src/screens/home/useHomeScreen.ts` (state 238-243, 375, 569-595; handlers 2009-2076; returns 2208-2216), `src/store/reversibleAdjustmentTransaction.ts:902`, `src/types/domain.ts:972` (drop `'repeat_week'` from the overlay-reason union), `src/utils/stableTestId.ts:131-140`, the dev/e2e harness references (`explorerProductionBindings.ts`, `explorerActionBridge.ts:54,258`, `explorerCapabilityMatrix.ts:129-137`, `explorerPairwiseGenerator.ts:347-352,490,522`, `explorerChainShrinker.ts:320`, `explorerLiveEligibility.ts:192`, `devE2EScenarioManifestRegistry.ts:26`, `devE2ESeedIds.ts:12,40`, `devE2ESeedRegistry.ts` seed `repeat-week-phase-transition`, `explorerRenderReceiptBindings.ts`, `explorerScenarioContracts.ts`, `explorerSmokeScenarioManifests.ts`), incidental test references (list in survey: `acceptedStateTransactionTests`, `athleteSessionDeletionTests`, `athleteSessionMoveTests`, `chainedMutationContinuityTests`, `conditioningVisibleIdentityTests`, `devE2EStableTestIdTests`, `explorerLifecycleWitnessUITests`, `explorerProductionBindingTests`, `explorerRenderedObservationUITests`, `fixtureConditionedReplanTests`, `postGenerationConstraintValidationTests`, `seasonPhaseClockTests`, `section18AcceptedWeekGatewayTests`, `section18SafetyBoundaryTests`, `standaloneConditioningOwnershipTests`, `workoutLogProgressionWiringTests`, `bibleConformance/observations/*`), `package.json` (remove repeat-week test scripts from `test:bible` chain and script list), `src/__tests__/signedCopyExtractionTests.ts:183` (lower ceiling), `docs/COPY_SHEET_RULINGS_2026-07-30.md` (Batch 6: record the 13 repeat-week strings as RETIRED-BY-RULING, HOME_SCREEN_REDESIGN ruling 1)

**Interfaces:**
- Produces: a week screen whose bottom section no longer mentions repeat-week; a smaller 187→N ceiling; no `repeatWeekIntoNextWeek` symbol anywhere.

**L15 decision (read-side):** stored overlays with `reason: 'repeat_week'` may exist on Sam's device. The WRITER dies; the READ boundary gains an ingress lift that DROPS `repeat_week` overlays at hydration (the underlying week re-derives — the overlay was derived output, dropping it is convergence). Do not keep the union member for the writer's sake; keep it only inside the hydration lift's local type, with a comment naming this ruling.

- [ ] **Step 1: Write the failing writer-absence test.** Add to `src/__tests__/storedStateWriterAuditTests.ts` (the writer-audit suite already gated at bible #88) an assertion that no source file outside the hydration lift contains `repeat_week` or `repeatWeekIntoNextWeek`:

```ts
run('repeat-week has no writer and no surface (HOME_SCREEN_REDESIGN ruling 1)', () => {
  const offenders = walkSrc().filter((f) =>
    !f.includes('hydration') &&
    read(f).match(/repeat_week|repeatWeek/i)
  );
  assert(offenders.length === 0, `repeat-week survives in: ${offenders.join(', ')}`);
});
```

(Adapt `walkSrc`/`read` to that suite's existing helpers.)
- [ ] **Step 2: Run it, confirm it fails** listing every file from the inventory above.
- [ ] **Step 3: Delete in dependency order:** tests first (the three suites + `package.json` scripts), then UI (HomeScreenV2 blocks, useHomeScreen state/handlers — the `Card`/`Button` blocks at 596-655 and the confirm sheet at 911-934 go entirely), then harness references, then `src/utils/repeatWeek.ts`, then the store branch (`reversibleAdjustmentTransaction.ts:902` — also delete `stageClearRepeatWeekAdjustment` it calls), then the domain union member. Add the hydration ingress lift: where overlays are hydrated (follow `legacy_precanonical`/hydration-upgrade-path code — `src/__tests__/hydrationUpgradePathTests.ts` names the module), filter `overlay.reason === 'repeat_week'` out, with a test in the hydration suite proving a stored repeat_week overlay hydrates to an absent overlay and the week still derives.
- [ ] **Step 4: Ratchet the ceiling.** Run `npm run test:signed-copy-extraction`; read the new count from `artifacts/athlete-visible-copy-sheet.json`; set `ATHLETE_VISIBLE_GAP_CEILING` to exactly that count.
- [ ] **Step 5: Record retirement in the copy file.** Batch 6 section: the 13 strings (survey list: "Repeat this week into next week" ×2, "Repeated week active", "This week is using the saved Repeat Week overlay…", "Restore previous target week", "Repeat this week?", "We'll save this displayed week into next week…", "Repeated week saved…", "Repeat Week wasn't saved…", "Restoring the previous target week…", "Previous target week restored and saved.", "A newer change owns this week…", "Repeat Week couldn't be restored…", "Repeat Week wasn't restored…") listed as RETIRED.
- [ ] **Step 6: Full gate.** `npm run test:bible` → EXIT=0. `npm run test:compile` must not regress.
- [ ] **Step 7: Commit** (verify branch first): `feat(buttons): repeat-week dies entirely — ruling 1, and the ceiling drops with it`

---

### Task 2: project() completes — rows, detail, signed headlines

**Files:**
- Modify: `src/rules/projectVisibleWeek.ts` (`rows` at :134, `detail` at :200, headline registration), `src/rules/signedCopy.ts` (none expected — registry API suffices)
- Create: `src/rules/projectionCopy.ts` (the registration module for projection headline entries)
- Test: `src/__tests__/projectionOwnershipTests.ts` (extend), `src/__tests__/surfaceAgreementTests.ts` (cells now evaluate `project()` not just `projectParts()`)

**Interfaces:**
- Consumes: `composeDayDetail(workout, rawWorkout): ComposedDayDetail` (`src/utils/dayDetailComposition.ts:55`), `signedCopy(id, params)` / `registerSignedCopy(entries)` (`src/rules/signedCopy.ts`), existing pinned vocabulary: `canonicalStrengthLabel` (the seven strength labels, pinned by `strengthSessionVariantTests` B3), `CATEGORY_COPY` (`src/utils/planChangeProducer.ts:192-241`).
- Produces: `project(args): VisibleWeek` that does NOT throw for any generated week; `VisiblePart.rows: VisibleRow[]` populated from the same derivation `composeDayDetail` uses; `VisiblePart.detail: SignedCopy | null` populated; `projectionCopy.ts` exporting `registerProjectionCopy(): void` called from `projectVisibleWeek.ts` module scope.

- [ ] **Step 1: Failing test.** In `projectionOwnershipTests.ts` replace cell 2 (":134 accepts UnsignedCopyError as proof") with the positive claim:

```ts
run('project() evaluates without throwing and every headline is registered copy', () => {
  const week = buildProgramTabProjectedWeek(/* existing fixture args used at :115 */);
  const visible = project({ week, weekStart });
  for (const day of visible.days) {
    assert(isSignedCopyText(day.headline), `unregistered day headline ${day.date}`);
    for (const part of day.parts) {
      assert(isSignedCopyText(part.headline), `unregistered part headline ${part.id}`);
      assert(Array.isArray(part.rows), 'rows populated');
    }
  }
});
```

Also update cell 6 (:207) which currently REQUIRES the throw — it becomes "an unregistered id still throws" using a deliberately bogus id.
- [ ] **Step 2: Run → fails with `UnsignedCopyError`.**
- [ ] **Step 3: Implement `projectionCopy.ts`.** Entries with `source: 'authored_sheet'` where text already exists in the 187 sheet / pinned labels, `source: 'sam_ruling'` (provenance: HOME_SCREEN/COPY_SHEET rulings) otherwise. Required ids (from `projectVisibleWeek.ts` helpers): `day.headline.training`, `day.headline.rest`, `day.headline.game`, `part.headline.<kind>` for every `VisiblePartKind`, `day.refusal.nothing_to_change`. Part headlines come from the EXISTING signed vocabulary — strength part headlines are the pinned `canonicalStrengthLabel` outputs; conditioning/mobility/gunshow/prehab from `CATEGORY_COPY` labels; team-training its existing label. Any string with no existing signed source goes in Batch 6 as PROPOSED in this commit.
- [ ] **Step 4: Populate `rows` and `detail`.** Inside `partsForWorkout`, call the same row derivation `composeDayDetail` uses (import from `dayDetailComposition` — this makes the composition an internal of the projection, which Task 6 completes by removing the hook's own call). Map its component rows to `VisibleRow`. `detail` = the part's existing sub-line where one is signed, else `null`.
- [ ] **Step 5: The dayDetailComposition ownership pin changes.** `dayDetailCompositionOwnershipTests.ts:65` asserts exactly one production caller (`useDayWorkout`). It now has two (projection + hook, until Task 6). Update the pin to name BOTH callers explicitly with a comment that Task 6 shrinks it back to one (the projection); do not loosen it to "any callers".
- [ ] **Step 6: `npm run test:projection-ownership && npm run test:day-detail-composition-ownership && npm run test:signed-copy-extraction && npm run test:copy-rulings-binding`** all green, then full `test:bible`.
- [ ] **Step 7: Commit:** `feat(projection): project() speaks — rows, detail and registered headlines, no throw left`

---

### Task 3: The walker depth tier (L13) — honest reds recorded

**Files:**
- Modify: `src/__tests__/athleteActionWalkerTests.ts` (budget declaration, L-P invariants), `src/__tests__/support/athleteActionWalker.ts` (only if a depth knob is needed beyond length), `package.json` (new script `test:action-walker:deep`)
- Do NOT add the deep tier to `test:bible` in this task (its L-P cells are red by design until Tasks 4-6; arming happens in green commits).

**Interfaces:**
- Consumes: `walk({host, seed, length})` (`athleteActionWalker.ts:193`), `projectParts` (`projectVisibleWeek.ts:148`), `composeDayDetail`, `resolveWeekWithConditioning` (card), `buildProgramTabProjectedWeek` (canonical), `listPlanChangeOptionsForDay` (menu).
- Produces: a DECLARED deep tier — `DEPTH_TIER = { walks: 3, length: 90, minWeeksAdvanced: 4 }` — separate from the bounded tier, per L13 ("a shallow gate that looks like the deep one is the exact failure this law exists to prevent"); walker invariants `L-P1` (card name === canonical name), `L-P3` (card partIds === canonical partIds; detail kinds === projectParts kinds), `L-P4` (menu capabilities equal for equal parts-shapes) evaluated after every action, with a `DECLARED_RED` entry mechanism per cell.

- [ ] **Step 1: Add the L-P invariants to `checkInvariants`** (beside L4b at :528), each reusing `surfaceAgreementTests.ts`'s comparison bodies (`assertSurfacesAgree` :247-277 is the reference — port the comparisons, not the fixture). Guard each behind the tier: they run in BOTH tiers (a law is a law), but reds are collected, not thrown, when the cell id is in `DECLARED_RED` (:604, currently empty).
- [ ] **Step 2: Declare the deep tier.** In `athleteActionWalkerTests.ts` beside :585:

```ts
// L13: the deep tier is DECLARED, not a scaled shallow tier. Depth means
// accumulated life: many edits, weeks of advance_time, one program.
const DEEP = process.env.WALKER_TIER === 'deep';
const WALK_COUNT  = DEEP ? 3  : EXTENDED ? 200 : 10;
const WALK_LENGTH = DEEP ? 90 : EXTENDED ? 60  : 14;
```

In the deep tier, bias `proposeAction` so `advance_time` lands ≥ `minWeeksAdvanced` weeks total per walk (raise its probability, keep `days ∈ {1,2,7}`), and assert at walk end that `todayISO` moved ≥ 28 days — a deep walk that stayed in one week FAILS the tier declaration.
- [ ] **Step 3: `package.json`:** `"test:action-walker:deep": "TZ=Australia/Melbourne WALKER_TIER=deep sucrase-node src/__tests__/athleteActionWalkerTests.ts"`.
- [ ] **Step 4: Run the deep tier.** Expect L-P1/L-P3/L-P4 reds in accumulated state (this is cells 1 and 4 going red HONESTLY — the L13 evidence Sam is owed). Record every red cell id + the shrunk action history (`shrink`/`describeHistory` output) in the commit message and in `DECLARED_RED` with a pointer to the task that turns each green (Task 4 → L-P4, Task 5 → L-P1 card half, Task 6 → L-P3/L-P1 detail half).
- [ ] **Step 5: Verify the bounded tier + full bible still green** (bounded tier reds, if any, must also be declared or fixed — do not loosen assertions; L13 forbids it).
- [ ] **Step 6: Commit:** `test(walker): the deep tier is declared, and cells 1 and 4 finally red for the right reason`

---

### Task 4: Menu surface → projection; the four-action menu (rulings 7, 8, 9)

**Files:**
- Modify: `src/screens/home/PlanChangeSheet.tsx` (delete the intermediate `menu` step 488-517; `edit_session` becomes the entry step; `MenuOption` gains `icon`; add-kind step restructured; `pick_category` recovery filter and `pick_strength` filters replaced), `src/utils/planChangeProducer.ts` (`listPlanChangeOptionsForDay` consumes `ProjectedDayParts.capabilities`; `visibleSessionKindsForWorkout` :216-222 and `hasSession` retired; `CATEGORY_COPY` recovery entry removed from ADD/SWAP offers), `src/utils/planChangeTypes.ts` (only if the category list itself changes — see decision), `src/screens/home/HomeScreenV2.tsx` (the `onMakeChange` entry unchanged in placement; sheet opens on the four-action step)
- Test: `src/__tests__/athleteDoorMatrixTests.ts` (menu cells), new cells in `projectionOwnershipTests.ts`, `copyRulingsBindingTests` via Batch 6

**Interfaces:**
- Consumes: `projectParts` capabilities (`ProjectedDayParts.capabilities`: `canAdd`/`canMoveWholeDay`/`canRemoveWholeDay` + per-part `PartCapabilities`), `PLAN_CHANGE_CATEGORY_IDS`.
- Produces: `PlanChangeSheet` whose first step is the four-action menu — Swap this session / Add to this day / Move this session / Remove this session / Back — each row `{label, sub, icon}`; option availability derived ONLY from projection capabilities (an empty day renders Add enabled, the rest disabled — no `hasSession` question asked); Add step offering exactly five rows: Strength (→ Upper/Lower/Full picker), Conditioning (→ light/hard picker), Gunshow, Mobility, Accessories(=prehab door — see decision); `MenuOption({label, sub, icon, danger, onPress, testID})`.

**Decisions locked here:**
- Ruling 9's "Accessories" maps to the `prehab` door (the charter split accessories → gunshow + prehab; ruling lists Gunshow separately, so the fifth row is the prehab door). Its LABEL ("Accessories" vs "Prehab") is a Batch-6 copy question — ship the row wired to `prehab` with both label candidates listed in Batch 6, current label rendered from the proposed entry.
- `recovery` leaves the add/swap menus (ruling 9: five types only; swap sub-line drops "recovery"). The `recovery` member of `PLAN_CHANGE_CATEGORY_IDS` stays (the charter still charters the type; the resolver/G+1 world still uses it) — only the SHEET stops offering it. Record in the charter debt list if `sessionTypeCharterTests` direction-2 observes the door change; lower the relevant ceiling in the same commit if one moves.
- The intermediate menu's "I'm not 100%" row moves per ruling 7 (it lives on the week screen only — Task 7 renames it there); "Something else - ask the coach" row dies (Coach tab covers it). Their strings → Batch 6 RETIRED.

- [ ] **Step 1: Failing matrix cells.** In `athleteDoorMatrixTests.ts` add a menu-shape law to `assertLaws`: for every cell, `listPlanChangeOptionsForDay(...)` must expose the four actions with availability equal to the projection's capabilities for that day (`projectParts` on the same week). On today's code this fails for recovery/empty days (defect 4's shape).
- [ ] **Step 2: Run → red on the known coordinates** (recovery-day and empty-day cells).
- [ ] **Step 3: Rewire the producer.** `listPlanChangeOptionsForDay` takes the projected day (or computes `projectParts` from its `visibleWeek` argument — no new argument threading beyond what callers have), and answers capability questions from `capabilities` only. Delete `visibleSessionKindsForWorkout` and the `hasSession` derivation. `snapshotProjectedDay` remains for its coach consumers (LR-6) but the MENU path stops calling it.
- [ ] **Step 4: Rebuild the sheet.** `step` union loses `'menu'`; initial step = `'edit_session'` (rename to `'actions'`). Four rows + Back, icons via new `icon` prop on `MenuOption` (pattern-match `SheetOption` at `HomeScreenV2.tsx:2005-2040`: fixed icon chip, accent/danger tints). Proposed icons: Swap = arrows-cycle, Add = plus, Move = arrow-right-to-bracket, Remove = minus/trash (danger). Add step: five rows (Strength/Conditioning/Gunshow/Mobility/Accessories) with icons (dumbbell / heart-pulse / flexed-arm curve / stretch figure / shield); Strength row → existing `pick_strength` filtered to `strength_upper|strength_lower|strength_full`; Conditioning row → existing `pick_conditioning`; Gunshow, Mobility, Accessories(prehab) commit directly through the existing category door (`applyPlanChange`/producer path — the real doors built this week; note `mobility` was previously UNREACHABLE from this sheet, `PlanChangeSheet.tsx:643` — this task makes it reachable). Swap step mirrors the same five. Recovery rows removed. Update swap sub-line copy (drops "recovery") → Batch 6.
- [ ] **Step 5: Copy + tests.** Batch 6 additions: any new sub-lines, the swap sub rewrite, retired intermediate-menu strings, the Accessories/Prehab label question. Run `test:copy-rulings-binding`, `test:session-type-charter`, matrix, walker bounded, then full bible.
- [ ] **Step 6: Deep tier check:** L-P4 cells now green at depth → remove them from `DECLARED_RED`, and ARM: add `"test:action-walker:deep"`... no — L-P4's home in bible is the matrix + walker laws. Arm L-P4 by adding the menu-capability law cell ids to the GATED suites (matrix law from Step 1 is already in bible via `athleteDoorMatrixTests`). Record in commit message: "L-P4 armed".
- [ ] **Step 7: Commit:** `feat(menu): the four-action menu IS the menu, on the projection's own capabilities — L-P4 armed`

---

### Task 5: Card surface → projection

**Files:**
- Modify: `src/screens/home/HomeScreenV2.tsx` (`:1356` `weeklyPlanTitle(day.workout)`, `:1365` `weeklyPlanSecondaryLabel`, `:2449` `· ${day.workout.name}`, `:1422` accessibility label), `src/screens/home/useHomeScreen.ts` / `src/hooks/useSchedule.ts:282-298` (`useResolvedWeek` returns the projected `VisibleWeek` beside/instead of raw days), `src/utils/weeklyPlanDisplay.ts` (retired from the card path)
- Test: deep tier L-P1 card cells; `surfaceAgreementTests.ts` cells 1/3

**Interfaces:**
- Consumes: `project()` (Task 2), `useResolvedWeek`.
- Produces: card rows rendering `day.headline` and `parts.map(p => p.headline)`; no `workout.name`, `weeklyPlanTitle`, or `splitSessionName` on the card path.

- [ ] **Step 1:** Extend `useSchedule`'s week helper to expose `visibleWeek: VisibleWeek` computed via `project({ week: buildProgramTabProjectedWeek(...), weekStart })` — one call site, memoised like the current week memo.
- [ ] **Step 2:** Replace the card reads: title = `visibleDay.headline`, secondary = parts beyond the first joined per current layout, accessibility label from the same strings. TypeScript makes drift impossible: the values are `SignedCopy`.
- [ ] **Step 3:** Run deep tier — L-P1 card cells green → out of `DECLARED_RED`. Run `surfaceAgreementTests` (cells 1 and 3 must pass THROUGH the new path). Full bible.
- [ ] **Step 4: Commit:** `feat(card): the card reads the projection — one name, signed, and splitSessionName loses its last card caller`

---

### Task 6: Title + content surfaces → projection

**Files:**
- Modify: `src/screens/home/useDayWorkout.ts` (`:86` stays on `useResolvedDay` for INPUT state, but composition at `:373` and the identity/titling reads are replaced by the projected day; the hook keeps weights/receipts/keyboard), `src/screens/home/DayWorkoutScreenV2.tsx:1047` (title = `day.headline` per-part headlines from projection), `src/utils/visibleWorkoutIdentity.ts` (retired from the title path)
- Test: `dayDetailCompositionOwnershipTests.ts` (pin returns to ONE caller: the projection), deep tier L-P3/L-P1 detail cells, `surfaceAgreementTests` cell 2 (the one real red today — must go green here)

**Interfaces:**
- Consumes: `project()`; the day's `VisibleDay` located by date from the projected week.
- Produces: detail title + section list rendered from `parts[].headline` + `parts[].rows`; `composeDayDetail`'s only production caller is `projectVisibleWeek.ts`.

- [ ] **Step 1:** Thread the projected `VisibleDay` into `useDayWorkout` (compute in the hook from the same projected week the card uses — one projection call per screen family, or a shared context; prefer the existing `useSchedule` helper from Task 5).
- [ ] **Step 2:** Replace `derived` (`:373`) consumers: section rendering, conditioning option titles, row grouping now come from `parts`/`rows`. Delete the hook's own `composeDayDetail` call. Input-handling (weights, receipts, logging) keeps its existing state reads.
- [ ] **Step 3:** Title: `DayWorkoutScreenV2.tsx:1047` renders the projected day/part headlines, not `deriveVisibleWorkoutIdentity`.
- [ ] **Step 4:** Restore the one-caller pin in `dayDetailCompositionOwnershipTests` (caller = `src/rules/projectVisibleWeek.ts`).
- [ ] **Step 5:** Run: `surfaceAgreementTests` — cell 2 (defect 2, the intervals-inside-recovery-template mechanism) must be GREEN now; deep tier L-P1/L-P3 green → `DECLARED_RED` empties. ARM: add `test:surface-agreement` to `test:bible` (remove its `process.exit(0)` softener at `:374`) and add `test:action-walker:deep` to `test:bible` (position: end of chain, after `test:action-walker`; it is ~3 walks and bounded). L-P1/L-P3 armed.
- [ ] **Step 6:** Full bible. **Commit:** `feat(detail): title and content read the projection — cell 2 green, L-P1/L-P3 armed, the deep tier joins the gate`

---

### Task 7: Week-screen buttons (rulings 2-6)

**Files:**
- Modify: `src/screens/home/HomeScreenV2.tsx` (bottom section 658-796 region: busy/away entry 680-697 replaced by two buttons; readiness entry 700-730 relabelled; new injured button; `BusyAwaySheet` 2372-2467 split), `src/screens/home/useHomeScreen.ts` (`handleApplyBusyWeekReduce` :1474-1491 gains today scope), `src/utils/programControlActions.ts` (`set_schedule_modifier` payload — only if a today-scope field is needed), the durable transaction consumer of that payload (`src/store/temporarySourceFactTransaction.ts` — trace from `executeProgramControlActionDurably`)
- Test: matrix/walker doors for the two new buttons; a today-scope test proving the busy fact touches only today

**Interfaces:**
- Consumes: `executeProgramControlActionDurably`, `GuidedInjuryFlowSheet` (existing, unchanged), `WeekReadinessSheet` (existing).
- Produces: bottom section rows, in order: "No game this week - add one" (unchanged) · **"Short on time today"** · **"Away this week?"** · **"I'm sick/flat today"** · **"I'm injured"** · "Missing equipment?" (unchanged) · practice-match (unchanged) · phase card (unchanged). Every row has an icon (ruling 6).

**The scope decision (signed sentences never lie):** the busy half currently writes `set_schedule_modifier` `{severity: 5, reasonLabel: 'Busy week'}` with week semantics. Under the ruled copy "Short on time today" the fact MUST be today-scoped: trace how the durable transaction consumes `severity`/`reasonLabel`; give the payload an explicit today horizon (reuse the existing `scope: 'today_only'` vocabulary seen at `useHomeScreen.ts:1626,1667`); the acceptance test acts the button and asserts today's session lightened AND every other day's projection unchanged (`weekFingerprint` on the other six days). If the transaction cannot scope to today, THAT is the implementation gap this task pays — do not ship week semantics under today copy, and do not fork a new fact kind (one door, scoped payload).

- [ ] **Step 1: Failing walker/matrix door test** for the two new doors: `short_on_time_today` (asserts today-only effect) and `away_this_week` (existing clear-days semantics, new entry).
- [ ] **Step 2: Split the sheet.** "Short on time today" commits directly (no submenu — the old sheet's busy row committed immediately too); "Away this week?" opens the existing day-picker step (`step === 'away'` block becomes its own sheet). `BusyAwaySheet`'s menu step dies. Retired strings ("Busy or away this week?", "Busy week — keep me training, go lighter", "Away some days — clear them") → Batch 6 RETIRED; new labels are Sam-authored per ruling → Batch 6 SIGNED-BY-RULING; sub-lines proposed.
- [ ] **Step 3: Rename readiness entry.** `:725` fallback label `"I'm not 100%"` → `"I'm sick/flat today"` (ruling 4; `resolveVisibleReadinessState` continues to own the active-fact title). The readiness sheet's internal flow is unchanged.
- [ ] **Step 4: "I'm injured" button** (ruling 3): new row opening `GuidedInjuryFlowSheet` directly (the same `onInjury` wiring the readiness sheet uses at `:2279` — entry moves up a level; the readiness sheet's "Something hurts" row STAYS, both route to one owner, `handleApplyGuidedInjury`).
- [ ] **Step 5: Icons** (ruling 6): short-on-time = hourglass; away = plane/globe (reuse the away globe SVG); sick/flat = existing pulse; injured = existing `hurtIcon` bandage/plus-cross; keep dumbbell + game icons. All inline SVG per house pattern.
- [ ] **Step 6:** Batch 6 updated; `test:copy-rulings-binding`, matrix, walker, full bible. **Commit:** `feat(week-screen): four honest doors — short-on-time is today-scoped because the copy says so`

---

### Task 8: Edit-exercises inline re-jig (ruling 12)

**Files:**
- Modify: `src/screens/home/DayWorkoutScreenV2.tsx`: entry `:1152-1163` ("Edit exercises" link) replaced by a top-of-page icon row; `ExerciseChangeAction` :2248-2263 replaced by two per-row icon buttons; `ExerciseEditSheet` steps `menu` (2508-2532) and `exercise_menu` (2533-2561) deleted; remaining steps (`pick_exercise`, `swap_reason`, `add_kind`, `confirm_*`, `future_scope`, `injury_*`, `coach_fallback`, `result`) survive as the guided flows behind the new entries.

**Interfaces:**
- Consumes: existing callbacks — `openSpecificExerciseEditor` :567, `prepareSwap` :622, `removeExerciseToday` :933, `prepareAdd` :638, `openExerciseInjuryFlow` :591, the no-equipment concern path `prepareConcern` :654. **These flows are unchanged; only the entry surface changes** (ruling 12's explicit boundary).
- Produces: per exercise row — swap button (arrow-in-circle icon) entering `swap_reason` for THAT exercise, and a "−" remove button entering `confirm_remove` for that exercise; top of session page — icon row: "+" (→ `add_kind`), equipment icon (→ no-equipment flow), injury icon (→ something-hurts flow). No intermediate sheet.

- [ ] **Step 1: Failing UI-contract test** (pattern: `repeatWeekUIContractTests` was one; follow `keyboardConventionContractTests` house style): source assertions that `ExerciseEditSheet` has no `menu`/`exercise_menu` step, that `ExerciseHeaderRow` renders swap + remove testIDs per row, that the top icon row exists with three testIDs.
- [ ] **Step 2: Implement.** Row buttons: `Pressable` icons beside the exercise name (swap: circular-arrows SVG; remove: "−" in circle, danger tint). Top row: three `Pressable` icon chips under the sticky header. Step-machine initial states: swap button → `{kind:'swap_reason', exercise}`; remove → `{kind:'confirm_remove', exercise}`; "+" → `{kind:'add_kind'}`; equipment → `{kind:'concern_reason'}` preselected `No equipment`; injury → `openExerciseInjuryFlow` needs an exercise — from the top row it enters `{kind:'pick_exercise', intent:'injury'}` (existing step, existing wiring).
- [ ] **Step 3:** Retired strings ("Edit exercises", "Make a focused change inside this session.", the menu/exercise_menu row labels, "Change") → Batch 6 RETIRED; new accessibility labels proposed.
- [ ] **Step 4:** Full bible. **Commit:** `feat(session): editing is one tap from the page — the modal menu retires, the flows stay`

---

### Task 9: Global icon rule on option sheets (ruling 10)

**Files:**
- Modify: `src/screens/home/GuidedInjuryFlowSheet.tsx` (`FlowOption` :359-392 gains `icon`), `src/screens/home/EquipmentLimitationSheet.tsx` (`MissingToggle` :164-189 gains icon per equipment tag/modality), `src/screens/home/HomeScreenV2.tsx` readiness sheet icon FIXES (ruling 10 names them: "Rough sleep" chevron → moon variant; "Totally cooked" zap → battery-empty/flame; "Sick — how bad?" droplets → thermometer scale), `PlanChangeSheet` rows already done in Task 4.

- [ ] **Step 1:** Add `icon?: ReactNode` to `FlowOption` and `MissingToggle` with the `SheetOption` chip pattern; icon-less rows are now a defect, so pass an icon at every call site: injury regions (upper = shoulder silhouette, lower = leg, back/midline = spine, Other = "?"), areas (reuse region icon), severities (1-3 bars), triggers (chips can share a small dot icon — propose, Sam eyeballs), equipment rows (dumbbell/bar/bench/band/bike/rower/ski per `EQUIPMENT_TAG_LABELS` keys).
- [ ] **Step 2:** Fix the named nonsense pairings in `WeekReadinessSheet`.
- [ ] **Step 3:** Icons are imagery — NO copy changes, so no Batch 6 entries. Full bible. **Commit:** `feat(sheets): every option row carries an icon that means something — ruling 10`

---

### Task 10: Coach — snapshot from the projection; chips removed (ruling 13)

**Files:**
- Modify: `src/screens/coach/CoachScreen.tsx` (`QUICK_ACTIONS` :620-628 and render :2298-2317 deleted; the screen's week reads at :1346,1426 take the projected week), `src/utils/coachContextPacket.ts:124,130` (the packet's day summaries read `VisibleDay` — `summariseDay` stops being a fifth composition and renders the projection's parts/headlines)
- NOT touched (LR-6): `coachTurnController`, `coachUndoEngine`, `coachRevisionProposal`, `coachModalitySwapOrchestrator`, `programEditWriteGuard` — they keep `buildProgramTabProjectedWeek`/`snapshotProjectedDay`; recorded as census debt, not migrated.

- [ ] **Step 1: Failing test:** a source contract that `CoachScreen.tsx` contains no `QUICK_ACTIONS` array and no quick-action styles; and a snapshot test that `coachContextPacket`'s day summary strings for a fixture week equal the projection's `athleteVisibleStrings(day)` vocabulary (no string in the packet that is not projection-derived).
- [ ] **Step 2:** Delete the chips (UI only — `handleQuickAction` dies with them if unreferenced). Rewire `coachContextPacket`'s summaries onto `VisibleDay` (`coachView` at `visibleProjection.ts:227` is the intended surface function).
- [ ] **Step 3:** Retired chip strings ×7 → Batch 6 RETIRED. Full bible (watch `test:coach-*` suites 49-51 — if any binds chip strings, that's the test following the feature out). **Commit:** `feat(coach): the chips retire and the coach's voice reads the same projection — LR-6 untouched`

---

### Task 11: Deletions + L-P2 armed + ceilings settled

**Files:**
- Delete/modify: `splitSessionName` (`src/utils/sessionNaming.ts:417`) — DELETED outright; its callers (`weeklyPlanDisplay.ts` — likely fully deletable now, `planChangeProducer.ts:25,916`, `sessionComponents.ts:8,84`) rewired to parts or deleted; `resolveSessionDisplayName`'s text-inference rules (focus inference, name inference, cleaned pass-through) deleted — typed callers (`defaultProgram.ts`, `fixtureMinimalReplan.ts`) keep the typed rules only.
- Modify: `src/__tests__/signedCopyExtractionTests.ts` — ceiling to the new (much lower) count; `src/__tests__/surfaceAgreementTests.ts` L-P2 cell: every string the four surfaces render satisfies `isSignedCopyText` (the runtime half) — ARMED in bible.

- [ ] **Step 1:** Failing L-P2 cell (runtime registry check over a rendered fixture week's `athleteVisibleStrings`).
- [ ] **Step 2:** Delete `splitSessionName` + rewire callers; delete the three inference rules; run the naming/strength-intent suites and fix the tests that pinned inference behaviour (they pinned the defect's mechanism — replace with parts-based claims, do not preserve inference).
- [ ] **Step 3:** Re-run extraction, ratchet `ATHLETE_VISIBLE_GAP_CEILING` to the new count. Every surviving surface string must be signed/proposed (Batch 1-6 complete coverage).
- [ ] **Step 4:** Full bible. **Commit:** `feat(projection): the name channel dies — splitSessionName deleted, L-P2 armed, the ceiling settles`

---

### Task 12: Batch 6 finalised + boundary report + COMBINED DEVICE PASS CHECKLIST

- [ ] **Step 1:** Tidy `docs/COPY_SHEET_RULINGS_2026-07-30.md` Batch 6 into one signable section: SIGNED-BY-RULING entries (pointers), PROPOSED entries (each with where-it-appears), RETIRED entries, open label questions (Accessories vs Prehab). Confirm `copyRulingsBindingTests` binds all of it both directions.
- [ ] **Step 2:** Boundary report (in the final commit message + a docs artifact): convergence (representations deleted: intermediate menus, name parsing, per-surface composition; stored state added: none), L12 (what catches the next defect: L-P laws armed as `surface === projection`, deep tier in the gate), L13 depth reached (deep tier parameters + weeks advanced), NOT-COVERED (snapshotProjectedDay's coach consumers, the 69 recovery branches beyond the migrated surfaces, §18 recovery-counting question — needs Sam, LR-6 coach pipeline).
- [ ] **Step 3:** Deliver the checklist, exactly one pass = merge:

```
COMBINED DEVICE PASS — fix/g1-ownership-and-move-scoping
1. The original five taps (G-1 unit): [enumerate from branch memory: the
   move-ask flow, G-1 add-optional routes, scoped move/bin taps]
2. Render checks: card vs day title vs day content identical wording on
   every day of the visible fortnight, incl. a G+1 recovery day.
3. New week-screen buttons: Short on time today (today lightens, week
   untouched) · Away this week? (picked days clear) · I'm sick/flat today
   (readiness sheet) · I'm injured (guided injury flow) · icons sensible.
4. Four-action menu straight from "Want to change something?"; Add offers
   Strength/Conditioning/Gunshow/Mobility/Accessories; no recovery row;
   swap/remove per-row on session page; top icon row (+ / equipment /
   injury); no Edit-exercises modal anywhere.
5. Coach screen: no chips; conversation input works.
6. Equipment step on FRESH INSTALL (the equipment unit's step, ticks =
   answers, NEVER surface present).
7. Kill-and-reopen: relaunch-identical week (L16 loop closes).
8. Icon eyeball pass (ruling 10): every option row, all sheets.
```

---

## Self-review notes

- Ruling 11 (injury "Other" data path) is ALREADY DONE — traced and reported in commit `4bb425a`. Not a task.
- Ruling 5 (equipment + practice-match unchanged) is a constraint on Task 7, not a task.
- Reassessment stages map: stage 1-2 landed pre-unit; stage 3 = Task 3; stage 4 = Tasks 4-6 + 10; stage 6 = Task 11. Stage 5 (recovery as day type, 69 branches, §18 recounting) is explicitly OUT of this unit's scope — it needs Sam's §18 ruling (reassessment open question 3) and is listed NOT-COVERED.
- Type consistency: `VisibleWeek`/`VisibleDay`/`VisiblePart`/`PartCapabilities` from `src/rules/visibleProjection.ts`; `ProjectedDayParts` capabilities pre-copy; `SignedCopy` only via `signedCopy(id)`.
