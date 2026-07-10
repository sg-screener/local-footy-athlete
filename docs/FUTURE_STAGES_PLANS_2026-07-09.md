# Future Bible Stages — Implementation Plans (2026-07-09)

Read-only planning. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md`. Aligned with `docs/BIBLE_IMPLEMENTATION_ROADMAP_2026-07-09.md`.

**Boundary rules honoured throughout:** nothing here overlaps Codex's current progression/block-state work (Slices 3.1/3.2) or the conditioning component enum (Slice 1.2). Where a plan depends on those, it consumes their outputs as a declared input and is queued behind them.

---

## 1. Speed / late off-season sprint model (≈ roadmap Slice 3.3)

**Plain-English goal.** The app finally prescribes sprinting like a footy S&C coach: a late off-season speed block (acceleration → hills → max velocity per Bible §7), a pre-season 2-sprint-exposures/week target that counts TT properly (1-TT athletes get warm-up micro-doses instead of nothing), and standalone speed sessions that are high quality and low fatigue — never conditioning in disguise.

**Current code gaps** (verified at HEAD):

- Off-season sprint is blanket-denied: `sprint_offseason_no_late_flag` (`coachingEngine.ts:1984`, honest comment "no late-block model yet"). Placement pool also filters sprint out pre-emptively (`:2391-2393`).
- Pre-season sprint denied if ANY TT or game exists (`sprint_covered_by_team_or_game`, `:1985`) — binary gate, no 1-TT exception, doesn't consume the kernel's `sprintCodExposures` count (`weeklyExposureCounts.ts:174-176` counts TT correctly; engine never reads it).
- Micro-dose/reduced templates exist (`sessionBuilder.ts:1637-1704`) with Sprint Rescue tier logic (`coachingEngine.ts:3958-3968`) but are unreachable — rescue aborts before the tiers because the deny rules empty `rescueEligible`.
- No warm-up-attachment architecture: micro-dose is only a standalone retrofit, never a strength-day warm-up header.
- Templates cover accel ladder/flying/shuttle feels but there is no hills step and no accel→hills→max-velocity progression ordering; no tests cover any positive sprint placement.

**Dependency.** Blocked by Slice 3.2 (subphase model gives `subPhase` input, e.g. `off_late`). Do not start until Codex's 3.1/3.2 land. This plan does NOT define subphase boundaries — it consumes the enum.

**Proposed slices.**

- **SP-1: Exposure-counted pre-season gate.** Replace the binary TT/game deny with kernel-count logic: target 2 sprint/COD exposures per week; TT and games count (already true in kernel); engine tops up the shortfall. 1 TT → one standalone or warm-up dose allowed; 2+ TT/game week → no extra. Files: `coachingEngine.ts:1979-1988` (eligibility), consume `weeklyExposureCounts.ts` from the engine, Sprint Rescue `:3758+`. This also makes micro-dose tiers reachable.
- **SP-2: Warm-up sprint micro-dose attachment.** New attachment point: prepend micro-dose (`buildSprintMicroDose`) to an eligible fresh strength day when the weekly target can't fit a standalone. Must respect no-sprint-finisher law (it is a warm-up, not a finisher — needs explicit taxonomy so counters and validators don't misclassify). Files: `sessionBuilder.ts` (warm-up block in session structure), `sessionTaxonomy.ts`, `weeklyExposureCounts.ts` (count warm-up dose as sprint exposure).
- **SP-3: Late off-season speed block.** When `subPhase === 'off_late'`: lift the off-season deny, add sprint back to placement candidates, and schedule the Bible §7 progression across the block's weeks — accel sessions first, hills mid, max-velocity last (needs a hills template added to the pool; ordering keyed off block-week input provided by 3.1 — read-only consumption, no changes to block state itself). Files: `coachingEngine.ts:1984/2391`, `sessionBuilder.ts` (hills template + progression selector).
- **SP-4: Quality guards.** Bible §7 laws as assertions: speed before fatigue work (day-order check), deny when sore/sick/cooked/low readiness (already partially present via `readiness !== 'high'`), never after heavy lower day, never as finisher.

**Files likely affected.** `src/utils/coachingEngine.ts` (1944-1952/1979-1988, 2378-2410, 3758-3968), `src/utils/sessionBuilder.ts` (950-954, 1360-1404, 1637-1704), `src/rules/weeklyExposureCounts.ts`, `src/rules/sessionTaxonomy.ts`, tests `finisherEligibilityTests.ts`, `rulesKernelTests.ts`, new `sprintPlacementTests.ts`, `weekPlanQA.ts` scenarios.

**Tests needed.** Positive placement: pre-season 0-TT high-readiness week gets 2 sprint exposures; 1-TT week gets exactly 1 top-up (standalone or warm-up dose); 2-TT/game week gets 0 extra. `off_late` week places a speed session and progression order holds across simulated weeks. Negative: in-season unchanged; no sprint finisher ever (grep-guard stays); low-readiness deny; G-window/TT-adjacency unchanged; off_early/off_mid still deny. Full board + QA week-shape diffs.

**Codex-ready first prompt** (after 3.2 lands):

> Task: SP-1 — pre-season sprint exposure target. READ `docs/LFA_PROGRAMMING_BIBLE.md` §7 and roadmap Slice 3.3 first. In `src/utils/coachingEngine.ts`, replace the binary standalone-sprint deny `sprint_covered_by_team_or_game` (~:1985) with exposure-counted logic: compute the week's sprint/COD exposures using the same definitions as `src/rules/weeklyExposureCounts.ts:174-176` (TT and game each count 1; on-feet sprint sessions count 1; off-feet sprint counts 0). Pre-season target = 2. If exposures < 2 and readiness is high, allow ONE standalone sprint placement (existing Sprint Rescue path); this makes the existing micro_dose/reduced tiers (~:3958-3968) reachable — do not change their logic. Keep every other deny: off-season blanket deny (`sprint_offseason_no_late_flag` — late block is a later slice), readiness gate, G-window, TT-day, TT-adjacent, no-sprint-finisher law. Do NOT touch block/week state, subphase derivation, conditioning components, or kernel counter definitions. Tests: new `src/__tests__/sprintPlacementTests.ts` — (1) pre-season 0-TT no-game high-readiness ⇒ sprint placed; (2) 1-TT ⇒ exactly one sprint top-up, not adjacent to TT; (3) 2-TT ⇒ none; (4) game week ⇒ none beyond game; (5) grep-guard: no sprint finishers; extend rulesKernelTests exposure assertions. Full test board + QA before/after week-shape diff in PR (expect pre-season diffs only; off/in-season must be byte-identical).

**Behaviour risk.** Medium. Pre-season weeks gain a hard exposure — bounded by the count target and existing freshness/adjacency laws. Off-season/in-season provably unchanged until SP-3. SP-3 is the risky one (new session type entering a phase that never had it) — gate behind subPhase and block-week inputs, land after 3.1/3.2 verified.

---

## 2. Recovery_addon model: carries, trunk, mobility, prehab

**Plain-English goal.** The Bible's low-fatigue support work — carries, trunk/core, mobility flows, prehab (adductor/calf/nordic/tib/rotator cuff) — stops being pool-luck and becomes a guaranteed, phase-aware layer: optional recovery/mobility add-ons on any day, guaranteed weekly coverage slots for core/adductor/calf, off-season mobility flow sessions, and gunshow/prehab days that serve body armour without creating fatigue.

**Current code gaps.**

- `recovery_addon` exists as a type value (`src/types/domain.ts:169-173`) but is fully inert — nothing produces or consumes it. Its semantics are proposed in `docs/CONDITIONING_COMPONENT_INVESTIGATION_2026-07-09.md` as part of the Slice 1.2 enum. **That enum is owned by the conditioning-component workstream — this plan builds the content layer on top and must not redefine kind semantics.**
- Carries: one exercise (Suitcase Carry) in `TRUNK_ANTI_ROTATION_POOL`; Bible names farmer/suitcase/bear carries with set/metre dosing (§ core/carry rules, Bible ~:930-945). Never guaranteed.
- Core/trunk: 11-exercise pool, coverage by pool luck only (roadmap area C).
- Mobility: 12-exercise pool used only inside recovery sessions (2 per session); Bible promises mobility flow sessions, especially off-season (~:102, :4005) — none exist as templates.
- Prehab: thin pools (2 adductor, 2 calf, 1 tib, 2 rotator cuff, 1 hamstring); **no Nordic curl at all** despite Bible hamstring emphasis; no guaranteed coverage. Roadmap parks "guaranteed adductor/calf/core coverage slots" in Slice 5.4.
- No attachment mechanism: sessions have a single conditioning block; "add a mobility flow to any day as optional" (Bible ~:119) has no home in the session structure.

**Dependency.** The addon-attachment slice should consume the `attachedConditioningKind` enum after Slice 1.2 lands (or use a separate optional-block field agreed with Sam if 1.2 is delayed). Pool/template slices have no dependency and can start any time.

**Proposed slices.**

- **RA-1: Content backfill (pure data).** Add missing exercises with tags/prescriptions: farmer/bear carry, Nordic (3-5 reps law, Bible ~:772/873), Copenhagen variants, McGill Big 3, calf/tib volume options, timed-prescription support (30-60s / 20-60m). Files: `src/data/exerciseTags.ts`, exercise pools (in `sessionBuilder.ts`/`defaultProgram.ts`). Zero placement change.
- **RA-2: Mobility flow session template.** A named low-stress session type (taxonomy: recovery-tier) usable as: off-season optional day, rest-day optional, game-adjacent-safe (Bible ~:77). Files: `sessionBuilder.ts` (template), `sessionTaxonomy.ts`/`stressClassification.ts` (classify as low stress, not counted against hard caps), display labels.
- **RA-3: Guaranteed weekly coverage slots.** Deterministic accessory allocation: each week guarantees ≥1 core/trunk, ≥1 adductor, ≥1 calf touch (phase-dosed: harder carries off/pre-season, familiar low-soreness in-season, Bible ~:943-944), placed into existing accessory blocks — not new sessions, no extra fatigue. Files: `coachingEngine.ts`/`sessionBuilder.ts` accessory selection, `weekPlanQA.ts` coverage assertions. (Absorbs the 5.4 rider; coordinate so 5.4 doesn't duplicate.)
- **RA-4: Recovery_addon attachment (after Slice 1.2).** Produce and render `recovery_addon` blocks: optional mobility/trunk add-on attachable to any day per Bible; 0 conditioning credit; never counted as exposure; skip never punished. Files: `coachingEngine.ts` allocation, session structure types, `weeklyExposureCounts.ts` (assert zero counting), UI session card optional block.

**Files likely affected.** `src/data/exerciseTags.ts`, `src/utils/sessionBuilder.ts`, `src/utils/defaultProgram.ts`, `src/rules/sessionTaxonomy.ts`, `src/rules/stressClassification.ts`, `src/utils/coachingEngine.ts`, `src/types/domain.ts` (consume only), `src/__tests__/weekPlanQA.ts` + new coverage tests.

**Tests needed.** RA-1: tag-integrity tests (every new exercise has full injury profile; Nordic reps ≤5). RA-2: mobility flow classified low-stress, allowed G-1, never counts toward hard caps. RA-3: per-phase QA assertion — every generated week contains core+adductor+calf touches; no week gains a session or exceeds duration caps. RA-4: addon never changes exposure counts; skip produces no progression penalty; card renders optional label.

**Codex-ready first prompt** (RA-1, can run now — no dependency):

> Task: RA-1 — backfill carries/trunk/mobility/prehab exercise content. READ `docs/LFA_PROGRAMMING_BIBLE.md` core/carry rules (~lines 918-947), accessories (~771-782), single-leg/nordic dosing (~854-873) first. Data-only change: add to the exercise pools and `src/data/exerciseTags.ts` — Farmer Carry, Bear Carry, Nordic Curl (3-5 rep max prescription), Copenhagen (short-lever + standard), McGill Big 3 (side plank, bird dog, McGill curl-up), Tibialis Raise, calf raise variants, Pallof/chop variants missing from `TRUNK_ANTI_ROTATION_POOL`. Every exercise gets a complete per-body-part injury profile (good/caution/avoid) consistent with Bible §8 trigger lists (e.g. Copenhagen = caution/avoid for adductor injury; Nordic = avoid for active hamstring). Support timed/distance prescriptions (2-4 × 30-60s or 20-60m) where the Bible specifies them. Do NOT change placement logic, conditioning components, session generation, or progression — if a pool is only reachable by luck today, leave reachability unchanged (that's RA-3). Tests: extend tag-integrity tests (all new entries have full InjuryProfile + valid category); snapshot test that generation output is UNCHANGED for the QA scenario board (pools grow, selection behaviour identical seed-for-seed if seeded; otherwise assert week shape unchanged). Full test board.

**Behaviour risk.** Low for RA-1/RA-2 (data + a new optional template). Medium for RA-3 (changes accessory contents of every week — but swaps within blocks, never adds sessions). RA-4 medium, fenced by Slice 1.2's enum semantics.

---

## 3. Deterministic Coach Notes (≈ roadmap Slice 5.3)

**Plain-English goal.** Every Coach Note is generated from what actually changed, never canned: game-change notes describe the real rebuild diff ("Added Saturday practice match. Protected Friday."), deload weeks announce themselves, and no card appears when nothing visibly changed.

**Current code gaps.**

- Game-change copy is canned and not truth-gated: `MakeAChangeScreen.tsx:131` hardcodes copy per change type regardless of what the rebuild actually did.
- The good pattern already exists: truth-gated "program updated" via `verifiedCoachCommunication.ts` (`canSayProgramUpdated` gates phrasing on a real diff) — game-change flow bypasses it.
- Zero-diff readiness card: card is created whenever guidance/optional arrays exist even if projection applied no visible change.
- Deterministic copy builders exist to extend (`coachReplyComposer.ts`, `constraintSummary.ts`); notes are correctly derived from constraint state (no independent note store — confirmed in the injury/readiness audit).
- No deload note seam is wired; the natural insertion point is the weekly note builder (`weeklyCoachUpdate.ts`) reading block state — **consume-only: read whatever 3.1's block-state store exposes, change nothing in it.**

**Proposed slices.**

- **CN-1: Diff-derived game-change copy.** Build note text from the rebuild result object (sessions added/moved/protected/removed), truth-gated by the same mechanism as `canSayProgramUpdated`; canned copy at `MakeAChangeScreen.tsx:131` becomes fallback-only when a diff is unavailable, and says less, not more.
- **CN-2: Zero-diff suppression.** A note/card renders only if its constraint produced ≥1 visible projection change or a real plan change; guidance-only readiness output degrades to inline chat reply, not a card.
- **CN-3: Deload/block notes (after 3.1 lands — consume-only).** When the resolved week is a deload or a new block, weekly note states it deterministically ("Deload week — loads pulled back on purpose").

**Files likely affected.** `src/screens/home/MakeAChangeScreen.tsx` (:131 region), `src/utils/verifiedCoachCommunication.ts`, `src/utils/coachReplyComposer.ts`, `src/utils/constraintSummary.ts`, `src/utils/activeProgramModifiers.ts` (zero-diff gate), `src/utils/weeklyCoachUpdate.ts`, rebuild diff producer (wherever the game-tap rebuild returns its result).

**Tests needed.** CN-1: for each game-change type, note text matches the actual diff (add a misbehaving-mock rebuild that does less than requested → note must describe the lesser reality, mirroring the contract-verification pattern from the revision migration). CN-2: readiness signal with no projection delta ⇒ no card; with delta ⇒ card. CN-3: deload week ⇒ note present; build week ⇒ absent. Regression: clearing notes still releases overrides.

**Codex-ready first prompt:**

> Task: CN-1/CN-2 — truth-gated, diff-derived Coach Notes. READ `docs/LFA_PROGRAMMING_BIBLE.md` "What creates Coach Note" (~lines 2592-2651) and roadmap Slice 5.3 first. (1) Replace the canned game-change copy at `src/screens/home/MakeAChangeScreen.tsx:131` with deterministic copy built from the actual rebuild diff: extend the truth-gating mechanism in `verifiedCoachCommunication.ts` (`canSayProgramUpdated` pattern) so game-change notes can only claim what the diff proves; write a pure builder `buildGameChangeNote(diff)` alongside the existing builders in `coachReplyComposer.ts`/`constraintSummary.ts`. Keep the canned string only as a fallback when no diff object exists, and make the fallback claim nothing specific. (2) Zero-diff suppression: in the card-creation path (`activeProgramModifiers.ts` / readiness card producer), render a card only when the constraint produced ≥1 visible projection change or plan change; guidance-only output goes to the chat reply, not a card. Do NOT touch: block/week state, conditioning components, projection/filter logic, injury thresholds, the LLM layer, or note-clearing semantics (clearing must still release overrides — keep its tests green). Tests: per game-change type, note text asserts against the diff, including a misbehaving-mock rebuild (does less than requested) where the note must describe reality; readiness zero-delta ⇒ no card, delta ⇒ card; full test board.

**Behaviour risk.** Low. Copy and card-visibility only; no program mutation paths touched. Main hazard is over-suppression (a real change with an unusual diff shape suppressing its note) — cover with diff-shape fixtures.

---

## 4. QA scenario cleanup / human-readable scenario names

**Plain-English goal.** The QA board reads like a coach's case list, not a cipher: every scenario has a self-explanatory name and manifest ("4-day off-season, no TT, intermediate, goal: size"), before/after week-shape diffs are produced by tooling instead of eyeballing print output, and every roadmap slice can point at named scenarios in its PR.

**Current code gaps.**

- Scenarios live in `src/__tests__/weekPlanQA.ts` as S1-S14 + E1-E3; ids are opaque, though a `name` field exists — there is no manifest, no type-safe registry, and roadmap docs refer to "S6/S7" which requires tribal knowledge.
- Output is `printScenario()` ASCII tables with inline assertions; comparison across a change is manual print-diffing. The roadmap's standing constraint ("QA before/after week-shape diff in the PR") has no tooling behind it.
- Scenario configs duplicate athlete-setup boilerplate; adding a persona (e.g. the SP/RA slices above will need new ones) means copy-paste.
- Some region/session classification inside QA duplicates kernel classifiers (roadmap 5.2 owns deleting that duplication — **out of scope here; do not consolidate classifiers in this stage**).

**Proposed slices.**

- **QA-1: Scenario registry.** Typed `ScenarioDef { id, slug, title, persona, phase, days, tt, game, goals, notes }`; slugs like `offseason-4day-no-tt-intermediate`; S-numbers kept as aliases so existing docs/tests don't break. Table-of-contents printed at board start.
- **QA-2: Week-shape snapshot + diff tool.** Serialize each scenario's resolved week to a stable snapshot (day → session kind/region/stress/conditioning category/duration); a script diffs snapshots between working tree and last committed snapshots and emits the PR-ready before/after block. Replaces manual print comparison; assertions unchanged.
- **QA-3: Persona builder cleanup.** One `buildAthlete(overrides)` factory; scenarios become data rows; adding a persona is one line. New scenarios needed by later stages (pre-season 0/1/2-TT for SP-1; coverage personas for RA-3) ride in here.

**Files likely affected.** `src/__tests__/weekPlanQA.ts` (main), possibly split into `weekPlanQA/scenarios.ts` + `weekPlanQA/render.ts` + `weekPlanQA/snapshot.ts`, `package.json` (script `test:qa-diff`), snapshot fixtures directory.

**Tests needed.** QA is itself test tooling: assert registry uniqueness (ids/slugs), snapshot round-trip stability (two runs, zero diff), diff tool detects a seeded synthetic change, and the full existing assertion set passes unchanged (byte-identical week shapes before/after the refactor — that IS the acceptance test).

**Codex-ready first prompt:**

> Task: QA-1/QA-2 — scenario registry + week-shape snapshot diff. Refactor `src/__tests__/weekPlanQA.ts` WITHOUT changing any generation behaviour: (1) introduce a typed scenario registry `ScenarioDef { id ('S6'), slug ('offseason-5day-no-tt'), title, persona fields }`; keep existing S/E ids as aliases; print a table of contents at board start; every scenario's existing config and assertions move over unchanged. (2) Add a week-shape snapshot: serialize each scenario's resolved week as stable JSON (per day: session kind, region, stress tier, conditioning category, duration, finisher/addon presence), written to `src/__tests__/__snapshots__/weekPlanQA/`; add script `test:qa-diff` that regenerates snapshots and prints a human-readable per-scenario diff vs the committed ones (for PR before/after blocks). (3) Acceptance: running the board before and after this refactor produces byte-identical week shapes for all scenarios (prove via the new snapshots — commit the baseline in the same PR); all existing assertions pass; no imports from generation code change semantics. Do NOT: consolidate classifiers (Slice 5.2 owns that), touch generation/engine files, rename test:* scripts already referenced by the roadmap, or alter assertion logic. Known pre-existing failures (strengthSequencingTests six-day pre-season Wednesday, test:qa tsc script, coachRevisionProposalControllerTests env) — do not chase.

**Behaviour risk.** Near zero for the app (test-only surface). Process risk: snapshot churn noise in PRs — mitigate by keeping snapshot fields coarse (shape, not exercise names) so only structural changes diff.

---

## Suggested sequencing (relative to current Codex work)

1. **Now, parallel-safe:** QA-1/QA-2 (test-only; also gives every later slice its diff tooling) and RA-1 (data-only). Both Codex-ready.
2. **After Slice 1.2 (component enum) lands:** RA-4 attachment; RA-2/RA-3 can go earlier if Sam wants coverage sooner.
3. **After Slices 3.1/3.2 land:** SP-1 → SP-2 → SP-3 (speed block), CN-3 deload notes.
4. **Anytime after a rebuild-diff object is confirmed available:** CN-1/CN-2.

Ownership defaults: QA-1/2/3, RA-1, CN-1/2 = Codex (mechanical, test-guarded). SP-3, RA-3 dose policy, CN diff-shape decisions = Fable design pass first.
