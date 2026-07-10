# Slice 3.4 — Deload / Lighter Week Generation Plan (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md`. Out of scope by instruction: injury/readiness modifier implementation, Coach Notes, rebuild architecture, coach chat/LLM, speed model, recovery_addon model.

**Preconditions (verify before starting).** This plan assumes the progression-block work Codex is finishing is actually live: `programBlockState.ts` persisted (blockStartDate/blockNumber in the store, not hardcoded `weekInBlock: 1`), real `weeksSinceDeload`/`consecutiveBuildWeeks`/`workoutHistory` at the generation call sites, and feedback flowing into `progressionRules.ts`. At the audit HEAD, persistence and call-site inputs were still partly hardcoded (`strengthProgressionIntegration.ts` fallbacks, `sessionBuilder.ts:2703-2722` conditioning inputs) — if any remain stubbed when 3.4 starts, stop and hand back to the progression slices; do not work around them.

## A. Plain-English deload model

Deload is a **week kind, not a punishment**. Every generated week is either a build week or a deload week, decided by one resolver before generation runs. Around week 4 of a block the athlete gets a lighter week by default (Bible: "once every 4 weeks or so… I've always liked 3-4 weekly cycles", deload = "changing the program and starting with a lighter week in the new program"). Fatigue signals can bring it forward; nothing can silently skip it just because the calendar looks fine ("Do not progress just because a week passed"). A deload week keeps the same session skeleton — same days, same session types, same main movement patterns — but everything is turned down: fewer sets, lighter loads, no grinders, no hard conditioning, no finishers. It is never "do nothing": main lifts stay in at reduced dose, easy aerobic stays in, recovery work is encouraged (Bible lists recovery sessions as belonging "during deload weeks").

Two deload mechanisms exist and must stay distinct:

1. **Per-session reactive deload** — already live in `progressionRules.ts` (6-state) and `conditioningProgressionRules.ts` (4-state): hard triggers (overreach, double game week, injury-avoid) and 2+ soft signals produce per-exercise load/set pullbacks. This slice does not change that machinery.
2. **Week-level generated deload** — missing entirely. `resolveIntensityMultiplier()` is a stub returning 1.0 (`programBlockState.ts:118`), no generation path produces a lighter week 4, and the "scheduled deload" branch in `progressionRules.ts:132-146` is both unreachable (inputs) and Bible-conflicted (requires a fatigue signal; Bible's calendar deload is the default, fatigue only brings it earlier; thresholds 4 in-season/6 off-season vs Bible 3-4 everywhere; and `weeksSinceDeload = weekInBlock - 1` means week 4 yields 3, so a ≥4 threshold never fires even with live inputs — a definition mismatch to normalize).

## B. Trigger hierarchy

Ordered; first match wins. One pure resolver owns this (`resolveWeekKind(blockState, weekSignals): 'build' | 'deload'`).

1. **Safety states (out of scope, already own their lane).** Injury 8-10 pause, bedridden, sickness — handled by injury/readiness modifiers, not by deload. Deload never overrides them and never duplicates them.
2. **Scheduled (calendar) deload — the default.** `weekInBlock === 4` (3-4 week blocks) ⇒ deload week, no fatigue signal required. Equivalent framing for block transitions: the last week of a block is the deload, and block N+1 week 1 resumes building (with variation rotation owned by the existing block machinery — not this slice).
3. **Earned (early) deload.** Bible "When to deload" list (§ ~3585-3598): cooked, repeated poor sleep, high soreness, niggle appearing, conditioning feels brutal repeatedly, multiple missed sessions, high game/team-training load. Rule of thumb mirroring the live per-session logic: **one hard signal** (overreach flag, double game week) or **two+ soft signals sustained across ≥2 sessions/check-ins** (poor feedback ≥2 sessions, missed ≥2 sessions this week, low readiness, high soreness) ⇒ promote this week to deload even if weekInBlock < 4. Promoting resets the block clock (deload week ends the block).
4. **Suppression/shaping (never full deny).** In-season game protection is untouched — deload changes doses, never the G-window structure, game-day rest, or TT anchors. A deload week must never delete sessions or collapse days to rest; it reshapes them.

Inputs available: blockState (weekInBlock/weeksSinceDeload — normalize the off-by-one definition first), feedback aggregates from `programStore` SessionFeedback, missed-session counts, readiness level. The resolver only reads them; producing them stays with the progression slices.

## C. Per-phase behaviour

- **Off-season:** full calendar deload every 4th week. Lifting: sets down (drop 1-2 per exercise), load down ~10-15% (intensityMultiplier 0.85-0.9), same exercises, no grinders (RPE cap ~6-7), drop 1-2 accessories. Conditioning: Bible says off-season "may need less deload in terms of conditioning" — keep 1-2 easy/moderate aerobic, remove glycolytic/vo2/hard intervals, remove finishers.
- **Pre-season:** same 3-4 week rhythm. Volume down more than intensity (late pre-season is already shorter/sharper); keep one quality low-volume touch per big pattern; hard conditioning out, tempo/easy stays; sprint handled by its own model — deload week simply requests zero extra hard exposures (existing eligibility laws then keep sprint out without this slice touching the speed lane).
- **In-season:** in-season weeks are already maintenance-dosed; calendar deload matters less and fatigue-triggered deload matters more ("Deload when fatigue signs build"). Bible's in-season deload is behavioural: "make sessions optional for one week…, if they want to train still they can — encourage lighter weights, adjust sets and reps" (§ ~170). So: doses down as above, sessions flagged optional-tier, game/TT/G-window untouched. **Defer in-season to a later sub-slice** — it needs the optional-tier semantics and interacts with the most protected phase.
- **Bye week:** dual mode (mini-pre-season vs deload-reset) is Slice 2.2's territory. Interface only: when 2.2 asks "readiness good?", a deload-flagged week answers "use deload-reset mode". No bye generation here.
- **Game week:** never reduced below safety; deload does not touch game-day freshness rules; a double-game week is itself an earned-deload hard trigger (already in `progressionRules.ts`).

## D. Files likely affected

- `src/utils/programBlockState.ts` — replace the `resolveIntensityMultiplier` stub (:118, always 1.0); add `weekKind` derivation; fix the weeksSinceDeload/weekInBlock off-by-one definition.
- New `src/rules/deloadWeekRules.ts` (or extend `programBlockState.ts`) — pure `resolveWeekKind()` + per-phase deload prescription policy (set/load/RPE/conditioning rules) as data, mirroring the rules-kernel style.
- `src/utils/coachingEngine.ts` — generation consumes `weekKind`: hard-exposure requests turned down (hard conditioning candidates removed, finisher allocation off), conditioning zone selection restricted to easy/tempo.
- `src/utils/sessionBuilder.ts` — prescription application: sets drop, load multiplier, RPE cap, accessory trim; conditioning duration floor so sessions stay real.
- `src/utils/strengthProgressionIntegration.ts` / `src/utils/progressionRules.ts` — scheduled-deload branch (:132-146) reconciled with the week-level resolver so there is ONE calendar-deload owner (resolver wins; per-session machinery keeps reactive triggers only); threshold normalized to 3-4 weeks all phases.
- `src/utils/conditioningProgressionRules.ts` — deload state alignment (no double-dipping: if the week is deload-generated, per-session deload shouldn't stack another -10min on top).
- Tests: `programBlockStateTests.ts`, new `deloadWeekGenerationTests.ts`, `weekPlanQA.ts` scenarios (week-4 variants), `strengthProgressionInputsTests.ts`, `conditioningProgressionInputsTests.ts`.

## E. Tests needed

1. **Week-4 lighter week:** off-season and pre-season scenario at weekInBlock 4 ⇒ every strength session has fewer sets and reduced load markers vs week 1-3 of the same scenario; no vo2/glycolytic/hard intervals; zero finishers; ≥1 easy aerobic kept; same number of sessions and same session days as the build weeks (no deletion).
2. **Weeks 1-3 unchanged:** byte-identical week shapes vs pre-slice snapshots (QA diff tooling).
3. **Feedback-triggered early deload:** two consecutive poor-feedback sessions + low readiness ⇒ resolver promotes the next week to deload at weekInBlock 2-3; single soft signal does NOT promote.
4. **Low readiness alone:** does not trigger week-level deload (needs a second signal) — but existing per-session pullbacks still fire (regression on `progressionRules` states).
5. **In-season game protection:** in-season generation byte-identical in the first slice (deferred phase); later sub-slice: deload week keeps game-day rest, G-window rules, TT anchors untouched, sessions marked optional-tier.
6. **No full program deletion / useful work remains:** for every deload scenario — session count preserved; every strength day retains its main lift(s); at least one conditioning touch survives; no day collapses to rest that wasn't rest in the build week.
7. **No double-dipping:** a deload-generated week fed through per-session progression does not stack a second reduction (set floor ≥2, duration floor respected).
8. **Trigger unit tests:** `resolveWeekKind` table-driven — calendar, hard signal, 2-soft-signals, signal-persistence requirement, block-clock reset after deload.
9. **Off-by-one fix:** weekInBlock 4 ⇔ scheduled deload fires (the old ≥4 weeksSinceDeload definition would have required week 5).

## F. Behaviour risk

Medium-high overall, contained by staging. This is the first time generation deliberately produces a different week from the same profile — snapshot discipline is the main guard. Specific hazards: double reduction (week-level deload stacking on per-session deload — covered by test 7); the scheduled-deload branch in `progressionRules.ts` fighting the new resolver (resolve by making the resolver the single calendar owner in the same PR); in-season is the riskiest phase and is explicitly deferred; bye-week interplay deferred to 2.2. First slice touches off/pre-season only, is deterministic (calendar trigger only), and every effect passes through one multiplier + one policy file, so reverting is one flag.

## G. Codex-ready implementation prompt — Slice 3.4a (calendar deload, off/pre-season)

> **Task: Slice 3.4a — generate the Bible's calendar deload week (off-season + pre-season only). READ `docs/LFA_PROGRAMMING_BIBLE.md` deload rules first (§1 phase notes ~lines 94/108, strength ~727-730, progression ~3106-3110/3585-3609) and `docs/SLICE_3_4_DELOAD_PLAN_2026-07-09.md`.**
>
> **Precondition check (abort if false):** `programBlockState` is persisted and generation call sites receive real `weekInBlock` (not hardcoded 1). If still stubbed, stop and report — do not fake inputs.
>
> **Change.**
> 1. In `src/utils/programBlockState.ts`: implement `resolveWeekKind(blockState, seasonPhase): 'build' | 'deload'` — deload when `weekInBlock === 4` (3-4 week blocks; no fatigue signal required) and phase is Off-season or Pre-season; In-season always returns 'build' in this slice. Replace the `resolveIntensityMultiplier` stub (currently always 1.0, ~:118): deload ⇒ 0.85 off-season / 0.9 pre-season, build ⇒ 1.0. Fix the weeksSinceDeload definition so week 4 of a block actually satisfies the scheduled threshold (currently `weekInBlock - 1` vs `>= 4` — off by one).
> 2. New `src/rules/deloadWeekRules.ts` (kernel style, data + pure functions): per-phase deload prescription policy — strength: drop 1 set per exercise (floor 2), load multiplier applied, RPE cap 7, drop the last 1-2 accessories (never the main lift or the first accessory), same exercises; conditioning: allowed categories = easy aerobic + tempo only, no finishers, keep ≥1 conditioning touch/week; hard-exposure request target for the week = 2 (down from max(core,4)).
> 3. Consume `weekKind` in generation: `coachingEngine.ts` — when 'deload', exclude hard conditioning categories from placement candidates, disable finisher allocation, lower the hard-exposure target per the policy; `sessionBuilder.ts` — apply set/load/RPE/accessory rules to strength prescriptions and easy-tier templates for conditioning. Session count, session days, and session types must be unchanged from the build-week skeleton.
> 4. Reconcile the unreachable scheduled-deload branch in `progressionRules.ts:132-146`: calendar deload is now owned by `resolveWeekKind`; that branch keeps ONLY reactive semantics (leave hard/soft trigger logic untouched). Guard against double reduction: when the week is deload-generated, per-session deload state must not further drop sets below the floor or stack a second load cut — clamp in one place, in the policy file.
>
> **Do NOT touch:** in-season generation (must be byte-identical — snapshot-prove it), bye-week logic, game/TT/G-window rules, injury/readiness modifiers, Coach Notes, rebuild architecture, coach chat, sprint eligibility, recovery_addon, block rotation/variation logic, conditioning component enum.
>
> **Tests.** New `src/__tests__/deloadWeekGenerationTests.ts`: (1) off-season week 4 — every strength session ≥1 fewer set and multiplier applied vs week 3 same scenario, no hard conditioning, zero finishers, ≥1 easy aerobic, session count/days identical; (2) pre-season week 4 equivalent at 0.9; (3) weeks 1-3 snapshots unchanged; (4) in-season all weeks unchanged; (5) no day collapses to rest; main lifts present every strength day; (6) double-dip clamp: deload week + per-session 'deload' state ⇒ set floor holds; (7) table-driven `resolveWeekKind` cases incl. the off-by-one regression (week 4 fires, week 3 doesn't, week 1 of next block builds). Extend `weekPlanQA` with week-4 variants of two existing scenarios and commit before/after snapshots. Run the full test board; known pre-existing failures per roadmap — do not chase.

**Follow-on sub-slices (not in 3.4a):** 3.4b earned/early deload (feedback/missed/readiness promotion via `resolveWeekKind` signals — needs signal aggregation ownership agreed with the progression work), 3.4c in-season optional-tier deload, then bye-week handoff to Slice 2.2 and deload Coach Note to CN-3.
