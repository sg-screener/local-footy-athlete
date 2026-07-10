# Progression / Week Number / Blocks / Deloads — Investigation (2026-07-09)

READ-ONLY. No code changed. Bible authority: `docs/LFA_PROGRAMMING_BIBLE.md` (§13 lines 3501-3666, deload rules lines 94/108/730, block rules lines 729-730/3109-3110/3143-3149/3179-3182, 10%/week cap line 89).

Scope guard honoured: nothing here touches attachedConditioningKind / conditioning components (Codex, in flight), rebuild architecture, coach chat/LLM, Coach Notes, or injury modifiers (inspected flow only).

---

## A. Plain-English diagnosis

The app has a good progression *brain* and no progression *memory*. Both rule engines (strength and conditioning) implement the Bible's ladder almost exactly — good = small nudge up, average = repeat, bad = hold/back off, deload on fatigue signals or after N weeks. But every input that requires knowing "what week are we in" or "what happened last week" is a hardcoded constant. The program never knows it's week 4 because every generation stamps `weekNumber: 1, miniCycleNumber: 1, weekInBlock: 1`, nothing ever rolls a week over, and `weeksSinceDeload` is frozen at 2 — one below the lowest deload threshold, so the scheduled deload branch is mathematically unreachable. Block 2 is never generated because nothing ever asks for it.

The one loop that IS real: post-session feedback (feeling/soreness/difficulty) is captured, persisted, and read back at session-resolution time to nudge the *next matching session* (readiness bias, volume adjustment, block-progression flag, pattern streak detection). That's a genuine, working, Bible-shaped feedback loop — but it's a read-time filter on one session, not a program-level signal. Conditioning progression gets none of it: its call site feeds 7 dummy inputs.

So: Week 4 behaves like Week 1 because, to the code, it *is* Week 1.

## B. Files involved

| File | Role |
|---|---|
| `src/utils/progressionRules.ts` | Strength progression state machine (build/maintain/hold/deload/return/overreach). Real logic, starved inputs. |
| `src/utils/conditioningProgressionRules.ts` | Conditioning progression resolver. Real logic, dummy inputs. |
| `src/utils/strengthProgressionIntegration.ts` | `buildProgressionContext()` :528-612 — hardcodes `weeksSinceDeload: 2`, `consecutiveBuildWeeks: 2`, `missedSessionsThisWeek: 0` (:597-599, also DEFAULT :136-142). |
| `src/utils/progressionHelpers.ts` | `estimateWeeksSinceDeload()` :355 — exists, **never called in production** (tests only). |
| `src/utils/sessionResolver.ts` | :1135-1147 calls `buildProgressionContext` with `workoutHistory: []` (:1143); reads feedback + patterns (real); applies `applyStrengthProgression` with `lastPerformedWeights`. |
| `src/utils/sessionBuilder.ts` | :2703-2722 conditioning `progressionInput` — `recentRPE: 6`, `completionQuality: 'full'`, `lastSessionProgressed: false`, `previousWeekLoad: 0`, `currentReps/Intervals/Rest` all constants. |
| `src/services/api/generateProgram.ts` | :109/:129/:132-133/:806/:892 — every generation path stamps `weekNumber: 1`, `miniCycleNumber: 1`, `weekInBlock: 1`, `intensityMultiplier: 1.0`. |
| `src/types/domain.ts` | :280-287 `Microcycle.weekNumber / miniCycleNumber / intensityMultiplier` exist; no block start date / lifecycle fields anywhere. |
| `src/utils/feedbackAdapter.ts`, `src/utils/feedbackPatterns.ts` | Real: feeling/soreness/difficulty → readiness bias, volume adjustment, block-progression; streak detection (FATIGUE_STREAK, COOKED_REPEAT, COMPLETION_DROP). |
| `src/utils/sessionFeedbackForm.ts` + `programStore.ts` | Feedback capture + persistence (`sessionFeedback: Record<date, SessionFeedback>`), incl. conditioning performance logs and partial/skip reasons (`too_hard_today` etc.). |
| `src/utils/weekRebuild.ts`, `src/screens/home/useHomeScreen.ts` | All rebuild triggers are manual (onboarding, phase shift, game tap, plan changes). No week rollover, no block-expiry trigger. |

## C. Root causes

1. **No block lifecycle state.** Nothing persists "block started on date X". Without that, weekInBlock, weeksSinceDeload, consecutiveBuildWeeks, and "time for block 2" are all uncomputable — hence the hardcoded constants. This is THE root cause; everything else is downstream.
2. **No time-based regeneration trigger.** Rebuilds only fire from user actions. The calendar advancing does nothing, so even if block state existed, nobody would consume it week-over-week.
3. **Generation call sites predate the progression engines.** `buildWorkoutsFromCoach` accepts `{ miniCycleNumber, weekInBlock }` and sessionBuilder rotates lift variants off `miniCycleNumber` (:991-995) — the plumbing exists but all three callers pass literal 1s.
4. **Conditioning progression call site has no data source wired.** The feedback store contains conditioning logs (time/cals/rounds/RPE), but `sessionBuilder` builds its `progressionInput` from constants because nobody threads the feedback map into that path.
5. **`weeksSinceDeload: 2` default + threshold ≥4/≥6 = scheduled deload dead on arrival** (`progressionRules.ts:118-131`).

## D. What the Bible says (relevant, condensed)

- 3-4 week blocks; "new program every 3-4 weeks", deload = "changing the program and starting with a lighter week in the new program" (lines 94, 108, 730). Block-to-block = same stimulus, slight lift variation (729, 3147).
- Progress when the athlete is handling the work, **not because the calendar moved** (3512, 3609). Good session = small nudge up; average = repeat; bad = hold/back off (3521-3524). Load ≤10%/week (89).
- Main lifts tracked properly; accessories = useful support work, no strict progression (3526-3538).
- Conditioning: progress off logged time/distance/pace/cals/rounds/RPE; gradual; never aggressive in-season/sore/sick/high team load (3539-3574).
- Sprint: quality-based exposure, never fatigue-chased (3575-3584).
- Deload when: cooked, poor sleep, high soreness, performance drop, niggle, repeated brutal sessions, multiple misses, high game/TT load — or roughly every 4 weeks (3585-3601, 94). Deload = less volume / lighter / fewer hard sessions / repeat week / remove finishers.
- Repeat a week on misses/disruption/struggle (3602-3609). Feedback must influence future programming (3619-3632). One miss = move/skip, never cram; several = reduce and restart momentum (3633-3642). Too easy once = small bump; repeatedly = proper dose increase (3643-3654). Too hard once = repeat/slightly reduce; repeatedly = reduce program dose (3655-3666).
- Training age scales progression speed: new = slow/simple, developing = 3-4wk blocks + rep progression, experienced = block-to-block not weekly (3028-3188).

## E. What the code currently does

**Week/block model:** `Microcycle` has `weekNumber/miniCycleNumber/intensityMultiplier` but all generation paths write 1/1/1.0. `miniCycleNumber` genuinely drives lift-variation pool rotation in sessionBuilder (Bible's block-to-block variation — mechanism exists, input never varies). No block start date, no rollover, no automatic regeneration; block 2+ is never generated. Week 4 is a re-render of the same single-week program.

**Strength progression:** `progressionRules.ts` implements the Bible ladder + hard triggers (overreach, double game week, injury) + soft triggers (2+ of: low readiness, RPE≥8, missed session, cooked) + scheduled deload (≥4wk in-season / ≥6wk otherwise, requires 1 fatigue signal). `applyStrengthProgression` differentiates main lifts vs accessories via ExerciseRole and uses `lastPerformedWeights` from weight overrides. Phase affects thresholds. But `workoutHistory` is always `[]` and the week counters are constants — so only the *feedback-driven* states are reachable; anything *history/time-driven* is not.

**Conditioning progression:** `resolveConditioningProgression` is real (phase gates, tiers, injury/game guards) and its output *is* applied (duration delta). Inputs at `sessionBuilder.ts:2703-2722`: readiness, injuries, daysToGame, doubleGameWeek, weekly count/load are real; RPE, completion quality, last-session-progressed, previous-week load, current reps/intervals/rest are dummies. Logged conditioning performance (which the feedback form captures!) never reaches it.

**Deloads:** deload *prescription* exists (`buildDeload`: ~70% load, drop two sets, longer rest) and soft/hard triggers work off feedback-derived readiness/feeling. Scheduled deload can never fire (counter frozen at 2). No "lighter week 4" is ever generated at program level; deload only exists as per-session dampening. Bible's preferred form — new block starting with a lighter week — has no implementation at all (`intensityMultiplier` is the obvious hook, always 1.0).

**Feedback loop:** capture is complete (completion full/partial/skipped + reasons incl. `too_hard_today`, feeling 5-scale, soreness 4-scale, difficulty 1-10, performance logs, notes). Consumption: strength sessions get session-type-matched adaptation + pattern biases at resolve time — next matching session only. Missed sessions: COMPLETION_DROP pattern adds +1 to `missedSessionsThisWeek` bias; no weekly aggregation, no repeat-week rule, no reschedule of a missed session. "Too easy": `very_easy` feeling flows into the adaptation path, but exercise-level too-easy/too-hard concern markers and partial reasons have no consumer. `readinessOverride` still has no producer. Conditioning sessions get zero feedback consumption.

## F. Gap classification

**A. Already implemented (real):** strength ladder + trigger engine; conditioning resolver + phase gates; deload prescription math; feedback capture + persistence; feedbackAdapter/feedbackPatterns → next-session adaptation; readiness quick-check → progression context; lastPerformedWeights; main-vs-accessory differentiation; miniCycle→lift-variation rotation mechanism; phase-dependent thresholds; phaseRepSchemes (wired, phase-level only — no week-level variation).

**B. Implemented but not connected:** `estimateWeeksSinceDeload()` (never called); `workoutHistory` param (always `[]`); miniCycle rotation (only ever fed 1); `intensityMultiplier` (always 1.0, consumed nowhere meaningful); scheduled-deload branch (unreachable); conditioning performance logs (captured, never read); `readinessOverride` (no producer — known from prior audit).

**C. Fake/stub/dummy:** `weeksSinceDeload: 2`, `consecutiveBuildWeeks: 2`, `missedSessionsThisWeek: 0` (strengthProgressionIntegration :136-142/:597-599); `weekNumber/miniCycleNumber/weekInBlock = 1` (generateProgram :109/:129/:132/:806/:892); conditioning `recentRPE: 6 / completionQuality: 'full' / lastSessionProgressed: false / previousWeekLoad: 0 / currentReps 6 / currentIntervals 4 / currentRest const` (sessionBuilder :2703-2722).

**D. Missing:** block lifecycle (start date, week rollover, block N+1 generation); week-4-lighter / new-block-lighter-first-week generation; repeat-week rule; missed-session weekly aggregation + move-forward/skip logic; consumers for too-easy/too-hard markers; conditioning feedback loop end-to-end; training-age progression-speed scaling into the context (trainingAge captured, never read — prior audit).

**E. Bible conflict:** (1) off/pre-season scheduled deload threshold is **6** weeks; Bible says 3-4 week cycles everywhere (94/108/730). (2) Scheduled deload **requires** a fatigue signal; Bible's "once every 4 weeks or so" is a default, softened by "when fatigued too" — a signal-gated 4-week deload is defensible, a signal-gated 6-week one is not. (3) Adaptation is next-matching-session only; Bible expects feedback to shape *future programming* incl. week repeats and program dose — partial conflict, mostly gap D.

**F. Good enough for MVP:** the read-time strength adaptation ladder (it IS the Bible's nudge/repeat/back-off, just narrow); accessory non-progression; sprint progression (Bible wants quality-based exposure; sprint is barely programmed pending the late-block model — nothing to progress yet, defer); per-session deload dampening as the fatigue response while block-level deload is built.

## G. Recommended slice order

Constraint honoured: Slice 3 (conditioning) is quarantined until Codex lands attachedConditioningKind — same file region (`sessionBuilder` conditioning paths). Slices 1/2/4/5 don't touch it.

### Slice 1 — Block/week state model (FIRST)
**Goal:** the program knows what week of which block it is in, from persisted state, not hardcoded literals. Persist `blockStartDate` + `blockNumber` (programStore, alongside currentProgram; set on every full generation); derive `weekInBlock` (1-4) and `weeksSinceDeload` from dates at read time; thread real `{ miniCycleNumber: blockNumber, weekInBlock }` into the three `buildWorkoutsFromCoach` call sites and real `weeksSinceDeload/consecutiveBuildWeeks` into `buildProgressionContext`. No behaviour change to *placement*; rebuild door (`weekRebuild.ts`) used as-is — state rides through `collectWeekRebuildContext`, no architecture change.
**Files:** `programStore.ts`, `services/api/generateProgram.ts`, `utils/weekRebuild.ts` (context plumbing only), `utils/strengthProgressionIntegration.ts`, `utils/sessionResolver.ts`, `types/domain.ts`.
**Risk:** medium — touches programStore persistence (migration default: blockStartDate = program.createdAt) and the derived value flips lift-variation rotation + can newly enable scheduled deloads (guard: keep deload threshold behaviour unchanged this slice by clamping, or accept and test).
**Who:** Fable designs state shape + defaults (half a page), Codex implements. (Prior roadmap tagged block plumbing Fable-owned; the *design* is; the mechanical wiring is Codex-safe.)
**Tests:** new `test:block-state` — persistence + migration default; weekInBlock arithmetic across DST/Sunday-start weeks; rotation changes at block boundary only; all three generation call sites receive derived values; existing suites green (kernel/validator/QA/rotation especially — rotation indexes shift only when blockNumber>1).

### Slice 2 — Strength progression wiring
**Goal:** kill remaining strength dummies: real `missedSessionsThisWeek` (aggregate this week's `sessionFeedback` completion), real `workoutHistory` (or explicitly delete the param and lean on feedback+weights — decide once, both Bible-legal), `consecutiveBuildWeeks` from block state, call `estimateWeeksSinceDeload` as fallback when block state absent.
**Files:** `sessionResolver.ts`, `strengthProgressionIntegration.ts`, `progressionHelpers.ts`.
**Risk:** low-medium — soft-deload trigger (missed ≥1) becomes reachable; expect more hold/deload states in disrupted weeks (that's the Bible working).
**Who:** Codex. **Tests:** extend `strengthProgressionIntegrationTests` + `feedbackPatternTests`: missed-count aggregation, threshold reachability, no-feedback week unchanged.

### Slice 3 — Conditioning progression wiring (AFTER Codex's component work lands)
**Goal:** feed `progressionInput` from real data: last matching conditioning feedback (difficulty→recentRPE, completion→completionQuality), previousWeekLoad from prior week's resolved sessions, current reps/intervals/duration/rest from the actual template being built, `lastSessionProgressed` from stored `_progressionState`.
**Files:** `sessionBuilder.ts` (conditioning builder), `sessionResolver.ts` or wherever feedback map is threaded, `conditioningProgressionRules.ts` (input types only).
**Risk:** medium — merge risk with Codex's component model is the whole reason to sequence it here; also progression deltas will start actually moving durations.
**Who:** Codex (after rebase on component model). **Tests:** `progressionTests` extension: dummy→real input parity cases, in-season aggression guard, "same work feeling easier" progresses.

### Slice 4 — Deload / lighter-week generation
**Goal:** Bible's deload shape: at weekInBlock 4 (or hard/soft trigger escalation), next generation = new block, `blockNumber+1` (lift variation rotates), first week lighter (`intensityMultiplier` ~0.85-0.9 actually consumed: fewer sets via existing deload prescription path, finishers removed, no extra hard conditioning). Also align threshold: 4 weeks all phases (fix Bible conflict E1/E2 — calendar deload allowed without signal, per §94; "don't progress on calendar" governs *progression*, not *backing off*).
**Files:** `generateProgram.ts`, `coachingEngine.ts` (inputs only — intensity flag into scorer/finisher paths), `defaultProgram.ts`, `progressionRules.ts` (threshold), `strengthProgressionIntegration.ts`.
**Risk:** high — first program-level behaviour change; interacts with finisher/component rules. Needs Sam sign-off on the lighter-week recipe before implementation.
**Who:** Fable designs + implements core; Codex mops up call sites/tests.
**Tests:** week-4 generation produces lighter week; trigger-based early deload; in-season game-week interplay; QA sweep additions.

### Slice 5 — Feedback loop completion
**Goal:** repeat-week rule (multiple misses/too-hard → next block repeats current dose instead of progressing); consume too-easy/too-hard markers (repeated too-easy → dose bump per §3646; repeated too-hard → dose reduction §3658); one-miss move-forward/skip decision.
**Files:** `feedbackPatterns.ts`, `feedbackAdapter.ts`, `generateProgram.ts` (block-transition decision), possibly `programStore`.
**Risk:** medium. **Who:** Codex with a tight spec. **Tests:** pattern→block-decision matrix.

### Slice 6 — Tests/QA hardening
Block-lifecycle integration test (simulate 5 weeks: generate → log feedback → roll over → assert block 2, rotated lifts, lighter week, progression applied); QA scenario for a "cooked" athlete week. Codex.

## Recommended next slice (single answer)

**Slice 1 — block/week state model.** Zero overlap with Codex's conditioning components, it's the root cause of "Week 4 = Week 1 / weekNumber always 1 / block 2+ never generated", and every other slice (deloads, block-to-block variation, consecutiveBuildWeeks, even the late-block sprint model from the 4A backlog) is blocked on it. Small persisted surface, mechanical wiring, high leverage.

## Codex-ready first prompt (Slice 1)

> READ the repo conventions in AGENTS.md first. Systemic fix, no phrase/edge-case patches. Do NOT touch: conditioning attachment/component code paths, weekRebuild architecture decisions, coach chat/LLM, injury modifiers.
>
> **Task: introduce a persisted block/week model and replace hardcoded week literals with derived values.**
>
> 1. `src/types/domain.ts` + `src/state/programStore.ts` (verify actual store path): add persisted `blockState: { blockStartDate: string /* ISO date */, blockNumber: number }` alongside the current program. Set it on every FULL program generation (onboarding, phase shift, program create): `blockStartDate = generation date (Monday of that week), blockNumber = previous.blockNumber + 1` when the previous program completed ≥3 weeks, else `1` for fresh-slate flows (onboarding, profile reset — same places that clear overrides). Week rebuilds (game tap, plan changes) must NOT reset blockState — they rebuild a week inside the same block. Migration: existing users without blockState → `{ blockStartDate: currentProgram.createdAt ?? today, blockNumber: 1 }`.
> 2. Add pure helpers in a new `src/utils/blockState.ts`: `weekInBlock(blockStartDate, today): number` (1-based, Monday-anchored, clamp ≥1) and `weeksSinceDeload(blockStartDate, today): number` (= weekInBlock − 1 for now; deload generation is a later slice). Unit-test DST boundaries and Sunday dates.
> 3. `src/services/api/generateProgram.ts`: all three `buildWorkoutsFromCoach` call sites (~:109, :806, :892) currently pass `{ miniCycleNumber: 1, weekInBlock: 1 }` and stamp `weekNumber: 1, miniCycleNumber: 1, intensityMultiplier: 1.0` (~:129-133). Replace with derived `miniCycleNumber = blockState.blockNumber`, `weekInBlock = weekInBlock(...)`, `weekNumber = weekInBlock`. Keep `intensityMultiplier: 1.0` (consumed in a later slice).
> 4. `src/utils/sessionResolver.ts` (~:1135) + `src/utils/strengthProgressionIntegration.ts` (`buildProgressionContext` :528-612, defaults :136-142): add optional block-state params; pass real `weeksSinceDeload` and `consecutiveBuildWeeks = max(0, weekInBlock − 1)` from the store. Keep current constants (2/2) ONLY as fallback when blockState is absent. IMPORTANT behavioural guard for this slice: in `src/utils/progressionRules.ts` the scheduled-deload branch (:118-131) becomes reachable at weekInBlock ≥5 in-season. That is intended Bible behaviour — leave the branch untouched, but add tests capturing exactly when it now fires so the change is explicit, not accidental.
> 5. Note: `sessionBuilder.ts:991-995` rotates exercise pools off `miniCycleNumber` — with blockNumber >1 lift variants rotate. Add a test asserting rotation changes ONLY at block boundaries, and that a mid-block week rebuild keeps the same variants.
> 6. New suite `npm run test:block-state` mirroring existing test script patterns (sucrase-node). All existing suites must stay green: rules kernel, week validator, stress, week-rebuild, game-rebuild, rotation, variation, pools, QA (163+/0). Do not modify existing test expectations except where a test hardcoded miniCycleNumber 1 as a *literal input* — never weaken assertions.
>
> Deliverable: implementation + tests + one-paragraph summary of exactly which runtime behaviours changed (expected: none for a brand-new user in week 1; rotation + progression context change from week 2+).

---

*Verified directly this session: `strengthProgressionIntegration.ts:597-599` (hardcoded 0/2/2), `sessionResolver.ts:1143` (`workoutHistory: []`), `sessionBuilder.ts:2703-2722` (conditioning dummies), `progressionRules.ts:118-131` (threshold 4/6 + signal gate), `estimateWeeksSinceDeload` production callers: none. Line numbers elsewhere from same-day sweep; re-verify before editing.*
