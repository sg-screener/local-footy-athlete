# LFA System Architecture Audit
**Date:** 2026-04-29
**Scope:** End-to-end system for the local-footy-athlete AFL training app
**Purpose:** Single source of truth for a planned full-system rewrite and optimisation
**Tone:** Brutally honest. Where the system is fragile, conflicted, or duplicated, it is named.

---

## 1. SYSTEM OVERVIEW

### What this app actually is
A solo-developer React Native / Expo app that produces a season-aware strength & conditioning program for an Australian Rules football athlete. The program is rebuilt deterministically from an onboarding profile and is then nudged week-by-week by an LLM "coach" that the athlete chats with.

The core promise: *"Give me your fixtures, your role, your injuries, and I will lay out the smartest training week for you. If life happens, tell me, and I'll change it."*

### The three first-class objects
1. **Profile** — `OnboardingData` in `profileStore`. Drives which template the athlete sits on (in-season / pre-season / off-season), team day count, usual game day, role, dislikes/injuries.
2. **Microcycle (program)** — `currentMicrocycle.workouts: Workout[]`, ordinarily 7 entries indexed Mon→Sun. Built by `generateProgramFromProfile`, persisted in `programStore`.
3. **Calendar marks + overrides** — `markedDays` in `calendarStore` (one-off `game | rest | noGame`) and `dateOverrides` in `programStore` (per-date manual `Workout` swaps written by the coach).

### The four "actors" that mutate state
- **Onboarding flow** — writes profileStore, calls `generateProgramFromProfile`, writes programStore.
- **Phase-shift / config UI** — same as above, re-runs the generator.
- **Calendar UI** — writes calendarStore (game/rest/noGame) and conditionally calls the program rebuild seam (`onGameStateChanged`).
- **Coach chat (LLM + deterministic guards/engines)** — writes `dateOverrides` in programStore and `excluded/pinned` in athletePreferencesStore.

### The two layers that everything reads through at render time
- `sessionResolver.resolveWeekWithConditioning(monday, state)` — the **single canonical interpreter** of "what happens on a given day."
- `coachWeekDiff.snapshotCurrentWeek` — wraps the resolver and emits a `DayFingerprint[]` used by the coach's grounding guard.

If you remember nothing else about this codebase, remember: **the resolver is the truth. The microcycle is just one input.**

### High-level flow
```
Onboarding → profileStore
   ↓
generateProgramFromProfile (engine + AI for exercise choice)
   ↓
programStore.currentMicrocycle (Mon→Sun template)
   ↓                            ↑
Calendar overrides ←———————————— coach actions (chat)
   ↓
sessionResolver (priority ladder)
   ↓
ResolvedDay[] → DayWorkoutScreen / Program tab / Calendar / coach diff
```

### Tech stack
React Native 0.81, Expo SDK 54, Zustand (persisted via AsyncStorage), React Query, Supabase Edge Functions (Deno), Anthropic Claude (`claude-sonnet-4-6` primary, `claude-haiku-4-5-20251001` fallback). No backend besides Supabase. No server-side state about training plans — the device is authoritative.

---

## 2. CURRENT ARCHITECTURE (AS IMPLEMENTED)

### 2.1 Onboarding & program generation
`generateProgramFromProfile(profile, opts?)` in `src/utils/programGeneration.ts` is the single seam that builds a microcycle. It runs in three stages:

1. **`coachingEngine.generateMicrocycle(profile)`** — pure deterministic engine. Decides per-day session **type** (the abstract focus: `L-sq`, `L-hi`, `U-pu`, `U-pl`, `L-co`, `U-co`, `team`, `recovery`, `aerobic_base`, `sprint`, `vo2`, `glycolytic`, `optional`, etc.) and emits structural metadata (`strengthPattern`, `conditioningCategory`, `sessionTier`, `focus`, `isTeamDay`).
2. **AI generate-mode call** to the `coach-chat` edge function — given the focus + tags, fills in actual exercise *names*, sets/reps, conditioning protocol bodies. The model may *enrich* but it must not *redefine* the structural fields. (Memory: "AI enriches, engine defines.")
3. **Microcycle assembly** — strength pool rotation (`exercisePools.ts`, anchor/accessory split, deterministic mini-cycle index), naming pass (`resolveSessionDisplayName` in `sessionNaming.ts`), post-validation passes:
   - Pre-season strength balance (1L+1U+1FB at core=3)
   - Pre-season 4-exposure (2L+2U at core=4)
   - Pre-season region sequencing (Lower-leaning standalones)
   - In-season 3-exposure (Lower+Pull+Push)
   - In-season conditioning floor
   - In-season push/pull balance safety net
   - Movement-pattern integrity (pre-season post-validation swap)
   - Adjacency (max 2 consecutive same-region)
   - Universal "Team training" team-day label

The output is a 7-element `Workout[]` keyed by day-of-week index, NOT by date.

### 2.2 The store layer (Zustand, persisted)
| Store | Owns | Notes |
|---|---|---|
| `profileStore` | `OnboardingData`, `isOnboardingComplete` | Source of truth for athlete identity. |
| `programStore` | `currentMicrocycle`, `dateOverrides`, `overrideContexts`, `sessionFeedback`, `weightOverrides` | The most heavily read store. `dateOverrides` is the coach's primary write target. |
| `calendarStore` | `markedDays` (`'game' | 'rest' | 'noGame'`) | One-off marks scoped by the resolver's window logic; virtual games are NOT stored here. |
| `athletePreferencesStore` | `excluded[]`, `pinned[]`, `activeInjuries[]` | Affects *next* program generation, not current week. |
| `coachMemoryStore` | `notes[]` | Coach observations passed back to the LLM as context. |
| `uiStore` | `activeTab`, `theme`, `designVersion`, `isOnline` | UI prefs only, no domain truth. |

All persist to AsyncStorage. There is **no server-authoritative copy**. If a phone wipes, the program is gone.

### 2.3 The resolver — `sessionResolver.resolveWeekWithConditioning`
The resolver runs a 3-pass week resolution per call (pass 1: per-day priority ladder; pass 2: conditioning insertion; pass 3: post-pass adjustments) and returns `ResolvedDay[]` for a Mon→Sun week. The per-day priority ladder is, in order:

1. **Manual override** (`dateOverrides[date]`) — short-circuits everything else.
2. **Calendar mark `'rest'`** — emits a Recovery shell.
3. **Calendar mark `'game'`** — virtual game session.
4. **Calendar mark `'noGame'`** — suppresses the virtual game on `usualGameDay`.
5. **Virtual game on `usualGameDay`** for in-season.
6. **Game-proximity** (G−1 / G+1 logic).
7. **Microcycle template** — `currentMicrocycle.workouts[dayIndex]`.
8. **Conditioning insertion** (separate pass).
9. **Recovery / fallback** if nothing landed.

`getEffectiveGameDates` window-scopes one-off `game` marks to the resolver's centre-week (off-DOW one-off games don't trigger a microcycle rebuild — memory).

### 2.4 The coach chat path
Two layers of *deterministic* logic sit in front of the LLM, then the edge function, then the post-LLM grounding gate.

**Client-side (CoachScreen.tsx → handleSend):**
1. **Injury clarification guard** (`injuryClarificationGuard.ts`) — if injury keyword/descriptor present and severity unknown, returns the canonical "How bad is it? Rough pain out of 10." reply locally and skips the API. Mirrored on the edge function for safety.
2. **Injury adjustment engine** (`injuryAdjustmentEngine.ts`) — if severity ≥ 5 with parseable body part, mutates the program directly via `applyCoachAction`, builds the reply from the diff, skips the API entirely. Severity tiers ≥5/≥7/≥8 govern aggressiveness; lower-limb injuries also emit `add_weekly_override {rule: 'no_running'}`. Mandatory recovery-shell fallback if nothing else lands.
3. **Snapshot before** — `snapshotCurrentWeek()` captures `DayFingerprint[]`.
4. **API call** to `coach-chat` edge function with messages, profile, microcycle context, coach notes.
5. **Apply returned actions** via `applyCoachActions`.
6. **Snapshot after** + `diffWeekSnapshots` + `filterDiffFromDate(rawDiff)`.
7. **Grounding guard** — if AI claimed program changes:
   - Real diff exists → reply is built from the diff (`summarizeDiffBullets`), AI's free-text is suppressed.
   - No diff → "I tried to adjust it, but no program changes were applied."
   - Ambiguous matches → "That could mean a few exercises…"

**Edge function (`supabase/functions/coach-chat`):**
- Two modes: `mode: 'generate'` (program creation) and default `chat` mode.
- 10 tools available in chat mode (per memory + earlier explores): `set_manual_override`, `lighten_session`, `replace_exercise_at_date`, `ban_exercise_globally`, `set_preferred_alternative`, `add_weekly_override`, `add_coach_note`, etc.
- Multi-step Anthropic tool loop (cap = 5 iterations) with `tool_choice` forcing on the first turn.
- Embedded mirror of the client injury guard for defence-in-depth.
- Primary model `claude-sonnet-4-6`, fallback `claude-haiku-4-5-20251001`.

### 2.5 UI rendering
The resolver is called *every render* (no memoisation) by `useResolvedWeek` / `useResolvedDay` / `useMonthIndicators`. Cost is small (~7 days). `useIsFocused()` forces re-render on tab focus. Re-render chain on coach action: store mutation → all subscribers → resolver re-runs → DayWorkoutScreen / Program tab / Calendar all re-paint.

**Screens currently active:**
- `CoachScreen` (chat)
- `HomeScreen` / `DayWorkoutScreen` / `DayWorkoutScreenV2` (per-day delivery)
- `ProgramDetailScreen` (template view of the microcycle)
- `CalendarScreen` (month grid + game/rest marks)
- Onboarding stack (22 screens)

**Dormant/broken screens (per memory):** `CurrentWeekScreen`, `CustomizeWorkoutScreen` — unreachable with broken behaviour.

---

## 3. DATA FLOW (CRITICAL)

### 3.1 Read path on every screen render
```
React component
  → useResolvedWeek() or useResolvedDay()
    → useScheduleState() reads:
        profileStore.onboardingData
        programStore.currentMicrocycle
        programStore.dateOverrides
        programStore.overrideContexts
        calendarStore.markedDays
    → resolveWeekWithConditioning(monday, state)
      → 3-pass resolution, returns ResolvedDay[]
  → component renders from ResolvedDay
```
No caching. Every render reads every relevant store and recomputes the week. This is correct for diff fidelity but is structurally wasteful.

### 3.2 Write paths (4 distinct entry points)
**A. Onboarding completion / phase-shift.** Profile written → `generateProgramFromProfile` → programStore replaced. Calendar marks NOT cleared. Overrides NOT cleared (this is a hidden time-bomb when the phase changes).

**B. Calendar UI mark.** User taps a date → `setMarkedDay(date, 'game'|'rest'|'noGame')`. Resolver picks it up next render. Per memory `project_oneoff_game_scoping`, off-DOW one-off games are window-scoped and *do not* trigger microcycle rebuild.

**C. Coach action via LLM.** Edge function returns a typed `CoachAction[]`. Client `applyCoachActions` dispatches each:
- `lighten_session` → `setManualOverride(date, lightened)` in programStore.
- `replace_exercise_at_date` → `setManualOverride(date, replacedWorkout)` in programStore.
- `ban_exercise_globally` → `addExclusion()` in athletePreferencesStore.
- `set_preferred_alternative` → exclusion + pin in athletePreferencesStore.
- `add_weekly_override` → walks Mon→Sun, calls `setManualOverride()` per affected day.
- `add_coach_note` → `coachMemoryStore.addNote()`.

**D. Coach action via deterministic injury engine.** Same set of `applyCoachAction` calls, just emitted client-side without the LLM round trip.

### 3.3 The grounding loop (the cleverest piece of the system)
```
Snapshot before
   ↓
API call OR injury engine
   ↓
applyCoachActions (mutates stores)
   ↓
Snapshot after
   ↓
Diff (workoutName + exerciseNames + source)
   ↓
If diff non-empty → reply is "summarizeDiffBullets(diff)" (canonical, grounded)
If diff empty + AI claimed change → "tried to adjust it, but no program changes were applied"
```

`DayFingerprint` tracks **only** `workoutName`, `exerciseNames`, `source`. It does NOT track sessionTier, sets, reps, intensity, or conditioning protocol bodies. This is the single most important blind spot in the entire grounding system (see §6.3 and §12).

### 3.4 What is *not* on the data flow
- There is no event log. State changes are not journalled.
- There is no audit trail of why an override was written. `overrideContexts` records *some* metadata but is not consistently consumed.
- There is no offline queue or conflict resolution — single device, last-write-wins.
- No analytics, no telemetry of what the LLM does in production.

---

## 4. PROGRAM GENERATION (DETAILED)

### 4.1 Inputs
`OnboardingData` carries: phase (in-season / pre-season / off-season), `usualGameDay`, `teamTrainingDays[]`, role (forward/midfielder/etc.), training history, dislikes/exclusions, active injuries, weekly volume preference, equipment, etc.

### 4.2 Stage 1 — `coachingEngine.generateMicrocycle`
Pure functional engine. Outputs a `Microcycle` whose workouts each carry typed metadata (`strengthPattern`, `conditioningCategory`, `sessionTier`, `focus`, `isTeamDay`). This is where every season-shape decision lives:
- Pre-season balance heuristics (H-PRE-6, 7, 8, 9, 10, 11, 12) — see memory for IDs.
- In-season heuristics (H-IS-3, push/pull balance, conditioning floor).
- Adjacency constraint (max 2 consecutive same-region).
- Team-day reconciliation at engine-input boundary (`onboardingToCoachingInputs` unions teamTrainingDays into selectedDays).
- Conditioning category planning by phase.

### 4.3 Stage 2 — AI fill-in
Edge function, `mode: 'generate'`. Receives the engine's per-day specs and returns fleshed-out exercise names, conditioning protocols, cues. This is the *only* place the LLM is allowed near program structure, and even here it operates on a strict contract: it may change names of pool-managed slots only via the rotation, it must respect strengthPattern, it must not invent new session types.

### 4.4 Stage 3 — assembly + post-validation
- **Strength pool rotation** (`exercisePools.ts`, `exerciseTags.ts`) — anchor/accessory split across 10 slots; deterministic mini-cycle index produces cross-cycle variation. Athlete preferences (excluded/pinned, injury-bias) are an optional 4th arg with Option-2 fallback logging.
- **Naming pass** — `resolveSessionDisplayName` is the canonical seam (memory: `project_canonical_naming_system`). All athlete-facing names must flow through it.
- **Post-validation passes** — listed in §2.1. The order matters; e.g., adjacency runs *before* the team-label pass because `isTeamDay` is populated after adjacency.

### 4.5 What can go wrong here (named honestly)
- **AI scope creep.** Memory `feedback_ai_enriches_engine_defines` exists because the AI has historically reached past its lane. The contract is enforced by post-validation, not by prompt discipline alone.
- **Pool rotation fragility.** `findOrCreateExercise` must guard pool-managed names (memory `project_findorcreate_pool_guard`); without that guard "Deadlift" silently collapses into "Trap Bar Deadlift" and the rotation desyncs.
- **Stale .js siblings** in `src/` (memory `reference_stale_js_gotcha`) — Metro and `sucrase-node` both prefer `.js` over `.ts`; compiled artefacts can shadow source. This is a footgun every refactor.
- **Phase shift does not clear overrides.** A profile flip to a new phase regenerates the microcycle, but `dateOverrides` from the prior phase still mask it on those dates. This is a structural bug, not a missing feature.

### 4.6 Validation gates that exist
- `npm run test:scenarios` (scenarioHarness — canonical engine validation)
- `npm run qa:athlete` (memory: source of truth for engine/plan changes)
- `npm run test:pools` / `test:variation` / `test:conditioning-rotation`
- `npm run test:coach-prompt` (prompt contract)
- `npm run test:injury-guard` / `test:injury-client-guard` / `test:injury-engine`
- `npm run test:qa` / `test:bounds`

There is no integration-level "user types message → reply rendered" test. Coach-side correctness is validated unit-by-unit and trusted to compose.

---

## 5. PROGRAM MODIFICATION (VERY IMPORTANT)

This is the most fragile and most ambitious part of the system. Modifications happen via four pathways, and the system's correctness depends on each one writing through the same `dateOverrides` seam.

### 5.1 Pathway A — Calendar mark
User marks a date `game` / `rest` / `noGame` in the Calendar. Resolver consumes this directly via priority levels 2–4. No write to programStore. **Issue:** the resolver layers calendar marks *over* any pre-existing manual override for that date (manual override is priority 1) — the override silently wins, and the user has no way to see this collision in the UI.

### 5.2 Pathway B — Phase shift
Profile changes phase → `generateProgramFromProfile` rebuilds the microcycle. **As noted in §4.5, prior overrides are not cleared.** Memory `project_unified_program_rebuild` says "calendarStore overrides are display-only, never structural," which is half the picture: dateOverrides can absolutely structurally mask the new microcycle.

### 5.3 Pathway C — Coach via LLM
The edge function returns an action list. Each action mutates either programStore or athletePreferencesStore. The grounding gate then either echoes the diff or calls out the no-op.

**Issues here:**
- **Tool surface area is broad.** 10 tools. The LLM can plausibly call any of them. Test coverage of *which* tool the LLM picks for which user message is thin.
- **Multi-step tool loop cap = 5.** If the LLM tries 5 wrong tools and hits the cap, the user sees a generic message and the program is unchanged. There's no automatic retry with a corrected prompt.
- **Action atomicity.** If three tool calls come back and the second one throws, the first has already mutated the store. There is no rollback.
- **Diff fingerprint blind spots.** The fingerprint tracks only workoutName + exerciseNames + source. So:
  - A `lighten_session` with `level: 'optional'` (halves sets, sets sessionTier='optional') is **invisible** in the diff. The injury engine's mandatory recovery-shell fallback exists *specifically* because of this (memory `project_injury_adjustment_engine`).
  - A `replace_exercise_at_date` that swaps an exercise for one with the same name is invisible.
  - A weight change via `weightOverrides` is invisible.
- **Grounding fallback is asymmetric.** "I tried to adjust it" is shown when the AI claimed a change but no diff appeared. There is *no* equivalent message when the AI claimed nothing but the engine fired anyway — that case currently says "Program updated" which can read confusingly.

### 5.4 Pathway D — Coach via deterministic injury engine (severity-known)
`applyInjuryAdjustment` fully owns the turn. Skips the LLM entirely. Builds the reply from the diff. This is the **most reliable** modification path in the system because there is zero ambiguity between intent and outcome — the engine writes overrides, then reads its own writes back as the reply. It's the architectural pattern the rest of the system should aspire to.

**Caveat per memory:** `extractInjuryContext` requires `isInjury || hasNegativeDescriptor` from `detectInjurySignals`. Bare "hamstring 6/10" is NOT enough — needs an injury keyword (hurt, sore, tweaked) or descriptor (cooked, pinged, gone). This is by design (prevents false-fire on "quad day 6/10 reps") but it means a slightly different phrasing falls through to the LLM where reliability is lower.

### 5.5 The race no one has acknowledged
Pathways A and C can write within the same week. There is no UI surface that explains the precedence. A user who marks Saturday `game` in the calendar and then asks the coach "make Saturday a rest day" will end up with `dateOverrides[Saturday] = recovery shell` masking the calendar `game` mark, because manual override is priority 1. Whether that's "correct" depends on intent the system never asked about.

---

## 6. CURRENT PROBLEMS / FAILURE MODES

These are the ones I can name with confidence from memory, code reading, and explore findings. Each is a real failure mode, not a hypothetical.

### 6.1 LLM hallucinated program updates
**What happens:** LLM says "I removed your deadlifts" without calling any tool. Pre-grounding gate, the user saw the message and trusted it. Post-grounding gate, the gate now suppresses the AI text and shows the canonical diff message.
**Where the fix lives:** `coachWeekDiff.ts` grounding logic + CoachScreen.handleSend lines 434–474.
**Residual risk:** Diff fingerprint blind spots (§6.3) — the AI can claim "I made your session lighter" and *successfully* call `lighten_session level=optional`, the diff sees no change, and the user gets the "tried to adjust it" fallback. That's a worse UX than the original hallucination because the engine *did do something* but the system is telling the user it didn't.

### 6.2 Severity-unknown injury reports
**What happened previously:** LLM would launch into freeform empathy + sometimes mutate the program with no severity signal.
**What happens now:** Client guard intercepts, edge mirror intercepts, returns canonical "How bad is it? Rough pain out of 10."
**Residual risk:** Off-keyword phrasings ("my groin is cooked, can't run") *do* fire — but ones that lack any injury keyword (e.g., "feeling 6/10 today") slip through. The injury guard intentionally has tight conditions.

### 6.3 Diff fingerprint blind spots (the most dangerous open issue)
The fingerprint is `{ workoutName, exerciseNames, source }`. Consequences:
- `level: 'optional'` lightening is invisible.
- Same-name exercise swap is invisible.
- Weight changes via `weightOverrides` are invisible.
- SessionTier changes alone are invisible.
- Conditioning protocol body changes are invisible (the conditioning *insertion* is visible because `source` changes; *body* edits are not).
**Impact:** False negatives in grounding, "tried to adjust it" message shown when the engine actually did work.

### 6.4 Phase-shift overrides leakage
Previously discussed in §5.2. A user who shifts from pre-season to in-season will retain any pre-season-era `dateOverrides` on those calendar dates, masking the new microcycle. There's no cleanup.

### 6.5 Calendar mark ↔ manual override collision
§5.1. Manual override (priority 1) silently wins over calendar marks (priorities 2–4). No UI surface explains this.

### 6.6 No memoisation of resolver, but no cache invalidation either
Resolver is called every render. Cheap, but combined with the write paths (4 distinct seams) means visual lag on heavy navigation isn't impossible. More importantly: there's no surface that says "this date has been re-resolved because X changed" — debugging is blind.

### 6.7 Dormant screens with broken behaviour
Memory `project_dormant_screens`: `CurrentWeekScreen` and `CustomizeWorkoutScreen` are unreachable with broken behaviour. They are technical debt that will trip a future refactor.

### 6.8 No server-authoritative state
A wiped device = a wiped program. There is no backup, no sync, no cross-device. For a single-user app this is acceptable today; for any growth path it is fatal.

### 6.9 Test coverage is unit-by-unit, not end-to-end
The harness tests engine output, the injury engine tests the engine, the prompt contract tests the prompt. Nothing tests "user types message → reply rendered → store mutated → next render shows new exercise." The grounding gate is tested in isolation.

### 6.10 The 5-step tool loop cap
Edge function caps Anthropic tool loop at 5 iterations. If the LLM thrashes through 5 wrong tools, the user sees nothing actionable. There's no automatic retry, no "ask the user a clarifying question" mechanism baked in beyond what the LLM happens to choose.

### 6.11 Stale `.js` siblings shadowing `.ts`
Memory `reference_stale_js_gotcha`. Real footgun every refactor.

### 6.12 `addWeeklyOverride` uses `new Date()` directly
Per the prior conversation's debugging notes. This makes tests date-dependent (`coachActionsTests` failed on 2026-04-29 because they hardcoded 2026-04-20 as Monday). Also makes the function non-deterministic in any context that expects to inject a clock.

### 6.13 No clean separation between "current week" and "future weeks"
The injury engine filters to `d.date >= todayISO` before mutating. The grounding gate filters past dates from the diff. But the resolver itself doesn't know "today" — it resolves any week passed in. This is fine, but several callers reach for `new Date()` directly when they should pass `todayISO` through.

### 6.14 No analytics / telemetry of LLM behaviour
We don't know which tools the LLM calls in production, how often the grounding gate fires the "tried to adjust it" fallback, how often the 5-step cap is hit. We're flying blind on the most expensive and least deterministic component in the system.

---

## 7. SYSTEM CONFLICTS

These are not bugs — they are *philosophical mismatches* between subsystems. Each one is currently papered over with a specific guard or post-validation pass; remove the patch and the conflict resurfaces.

### 7.1 LLM autonomy ↔ deterministic engine ownership
The LLM is allowed to call tools that mutate the program. The engine is the source of truth for structural shape. These two are reconciled today by:
- Heavy tool-contract design.
- Post-LLM grounding gate (suppress AI text when diff disagrees).
- Pre-LLM deterministic intercepts (injury guard, injury engine).

The reconciliation is *behavioural*. There is no architectural firewall stopping the LLM from calling a tool that emits a structurally invalid microcycle (e.g., 4 lower-body sessions in a row). The post-validation passes only run during program generation, not after coach actions.

### 7.2 Microcycle template (day-of-week) ↔ overrides (date-keyed)
The microcycle is indexed Mon→Sun (an abstract week). Overrides are indexed by ISO date (a real day). The resolver bridges them, but every other consumer must remember: "Monday's template" and "April 27's override" are addressed differently. This causes off-by-one bugs every time someone forgets which axis they're on.

### 7.3 Calendar marks ↔ virtual games
For in-season, the resolver renders a virtual game on `usualGameDay` every week unless suppressed by a `noGame` mark. The calendar store also accepts one-off `game` marks on other days. The interaction: a one-off `game` on Wednesday + virtual game on Saturday = two games that week, which the engine never planned for. The resolver renders both because nothing tells it to suppress the virtual.

### 7.4 athletePreferencesStore (forward-only) ↔ dateOverrides (current-week)
A coach action like `ban_exercise_globally` writes to athletePreferencesStore. This affects the *next* program generation. It does NOT change the current week. The athlete can ask "stop programming squats" and see no immediate change in their week. The grounding gate captures only the current-week diff, so this action looks like a no-op from the diff's perspective and triggers the "tried to adjust it" fallback. It's a false negative.

### 7.5 sessionFeedback / weightOverrides ↔ resolver
Workout completion logs and weight overrides exist in programStore but are not currently fed into the resolver. The resolver doesn't know whether a user actually completed a session or what weight they used. So planning never adapts based on actual execution. This is a missing feedback loop that the engine's structural intelligence cannot compensate for.

### 7.6 Coach memory ↔ system prompt context
`coachMemoryStore.notes` is sent to the edge function. The LLM may write to it via `add_coach_note`. This creates a long-running narrative that the LLM can shape — and that shape is not constrained. The engine never reads coach memory; only the LLM does. So the LLM can drift its understanding of the athlete over time without any deterministic check against the canonical profile.

---

## 8. IDEAL ARCHITECTURE (PROPOSED)

The current system has a strong instinct (deterministic engine, LLM enriches) but fragile execution (4 write paths, blind spots in fingerprinting, no event log). The ideal architecture preserves the instinct and hardens the execution.

### 8.1 First principle: every program-state change is an event
Replace direct store mutations with an **append-only event log**. Each event has shape:
```
{ id, ts, source: 'onboarding' | 'phase-shift' | 'calendar' | 'coach-llm' | 'coach-engine',
  actor: 'system' | 'user' | 'llm', kind, payload, expectedDiff, observedDiff }
```
Derived state (`currentMicrocycle`, `dateOverrides`, etc.) is rebuilt by replaying events. This gives:
- Audit trail (who changed what, when, why).
- Deterministic snapshots at any point in time.
- Free undo.
- Trivial rollback when an action errors mid-batch.

### 8.2 Second principle: one resolver, many lenses
Keep the resolver as the truth function. But it should accept a `today` parameter (no internal `new Date()`), an `events` log, and emit a `ResolvedWeek` plus a `Decision[]` array explaining *why* each day landed where it did. The Decision array is what the UI uses for the "this date has been overridden because X" surface.

### 8.3 Third principle: enrich the fingerprint, or replace it with the event log
The current `DayFingerprint = { workoutName, exerciseNames, source }` is the wrong abstraction for grounding. Two options:
- **Option A — fat fingerprint:** add sessionTier, sets, reps, weights, conditioning protocol body. More expensive to compare but covers all blind spots.
- **Option B — diff the events, not the state:** if every change is an event, the grounding gate just reads "what events did this turn emit?" and replies from those. No state diffing needed.

Option B is cleaner and naturally extends to multi-action actions (the "tried to adjust it" message becomes provably correct: zero events emitted = nothing happened).

### 8.4 Fourth principle: tool-call sandboxing
The LLM's tools should not write to stores directly. They should emit *intents* into a queue. A deterministic apply step validates each intent against invariants (e.g., "no 3 lower-body days in a row," "no removing future games," "no editing past dates") and either commits or rejects. Rejected intents become user-visible "I tried to do X but it conflicts with Y" messages — which is what users actually want.

### 8.5 Fifth principle: separate read models
Calendar, Program tab, Day screen, and Coach diff each want different views of the same truth. Today they all call `resolveWeekWithConditioning`. The ideal:
- **CoachReadModel** — `{ before, after, diff, decisions }` for grounding.
- **CalendarReadModel** — month grid of indicators.
- **WeekReadModel** — Mon→Sun resolved days for the Program tab.
- **DayReadModel** — full session detail for DayWorkoutScreen.

Each is a thin projection over the resolver + events.

### 8.6 Sixth principle: server-authoritative with offline-first
The current single-device persistence is a ceiling. The ideal is Supabase-authoritative state with an offline event queue that flushes on reconnect. Last-write-wins is fine for single-user; conflict resolution becomes "events serialise on the server."

### 8.7 Seventh principle: telemetry on the LLM path
Every coach turn should emit:
- Tools called.
- Tool errors.
- Grounding outcome (`grounded-from-diff` / `tried-to-adjust-no-diff` / `ambiguous` / `5-step-cap-hit`).
- Latency.
- Model used (primary/fallback).

Without this, the LLM is a black box. With it, you can answer "is the grounding gate firing too often?" in production.

### 8.8 Layout
```
Profile  (event-sourced)
  ↓
Engine.generateMicrocycle (deterministic)
  ↓
Microcycle (append-only)
  ↓
Events (calendar, coach, phase-shift) → applyEvents → derived state
  ↓
Resolver.resolveWeek(events, today) → ResolvedWeek + Decisions
  ↓
{ CoachReadModel, CalendarReadModel, WeekReadModel, DayReadModel }
  ↓
UI
```

Coach LLM tools → Intents → InvariantChecker → Events. Coach engine (injury) → Events directly. Grounding reads events emitted *this turn*.

---

## 9. IDEAL BEHAVIOUR FLOWS

These are the concrete user journeys the ideal architecture should make trivial.

### 9.1 Injury, severity unknown
**User:** "tweaked my hammy."
**System:**
1. Client guard fires. No event emitted.
2. Reply: "How bad is it? Rough pain out of 10."
**User:** "6/10."
**System:**
1. Client guard does NOT fire (severity now present).
2. Injury engine fires. Emits events:
   - `RemoveAvoidExercises { bucket: hamstring, week, futureOnly }`
   - `AddWeeklyOverride { rule: no_running, week }`
   - `LightenOrRecoverSession { date: nextCore, level: recovery }` (only if first two emitted nothing)
3. Reply built from events:
   - "Nasty — let's protect that hammy this week."
   - "Program changes:\n• Tue: removed RDLs\n• Thu: removed sprints"
   - "Avoid this week:\n• Running"
   - "Program updated — check your week."

### 9.2 Injury, severity known
Identical to 9.1 step 2 onward — no clarifier round trip needed.

### 9.3 Missed session
**User:** "Missed Tuesday's session."
**System (today):** Underspecified. The LLM might log a coach note, or do nothing visible.
**System (ideal):**
1. LLM intent: `MarkSessionSkipped { date: yesterday }` + optional `RebalanceWeek { from: yesterday }`.
2. InvariantChecker validates (e.g., can't rebalance if today is Sunday).
3. If valid, events committed. Reply built from events.
4. If invalid, LLM gets back the rejection and asks user to clarify (e.g., "Want me to push it to Friday or skip it?").

### 9.4 Schedule change
**User:** "Game's been moved to Sunday this week."
**System:**
1. LLM intent: `MoveGame { from: usualGameDay, to: Sunday, scope: this_week }`.
2. InvariantChecker rebalances the resolver's window-scoped one-off game logic.
3. Events emitted: `AddCalendarMark { date: Sunday, kind: game }`, `AddCalendarMark { date: usualGameDay, kind: noGame, scope: this_week }`.
4. Resolver picks up the moved game on next read. Game-proximity logic re-shapes G−1 and G+1 around Sunday.
5. Reply: "Game moved to Sunday. Saturday's now a recovery shell, Friday becomes captain's run. Week reshaped."

### 9.5 "I want to do less running"
**System:** This is a global preference, not a current-week change.
1. LLM intent: `AddPreference { kind: reduce_running, weight: -1 }` against `athletePreferencesStore`.
2. Reply: "Got it — I'll trim running across future weeks. (No change to this week's plan unless you want me to.)"
3. If user confirms current-week change: `AddWeeklyOverride { rule: no_running, week }` event.

### 9.6 "Make Saturday a rest day"
1. LLM intent: `LightenSession { date: Saturday, level: recovery }`.
2. InvariantChecker: is Saturday the game day? If yes, reject ("That's your game day — want to mark it 'no game' first?"). If no, accept.
3. Event committed. Reply built from event.

---

## 10. SCENARIO LIBRARY

Concrete inputs the system must handle. Each is paired with current behaviour and ideal behaviour.

### 10.1 "tweaked my hammy 6/10"
- **Current:** Injury engine fires, emits per-exercise removals + no-running override; reply built from diff. ✓ Working.
- **Ideal:** Same, but reply derived from events not state diff (eliminates the "level: 'optional' invisible" risk).

### 10.2 "hammy"  (severity unknown)
- **Current:** Client guard fires, returns canonical clarifier. ✓ Working.
- **Ideal:** Same.

### 10.3 "hamstring 6/10" (no descriptor)
- **Current:** Falls through to LLM (engine refuses; guard refuses). LLM may handle correctly; may not.
- **Ideal:** `extractInjuryContext` rules relaxed OR client guard fires asking "is something hurting?" — explicit clarifier rather than implicit fall-through.

### 10.4 "feeling cooked this week"
- **Per memory:** This is the lone vague phrase that's *actionable as-is*. Engine should treat as global lightening intent.
- **Current:** LLM-handled; outcome variable.
- **Ideal:** Engine path emits `LightenWeek { tier: optional }` events.

### 10.5 "make today recovery"
- **Current:** LLM tool `lighten_session level=recovery` → manual override. ✓.
- **Ideal:** Same, plus InvariantChecker confirms it's not a game day.

### 10.6 "swap deadlifts for trap bar deadlifts"
- **Current:** Pool guard fires (memory `project_findorcreate_pool_guard`), substitution succeeds without breaking rotation. ✓.
- **Ideal:** Same, plus reply explicitly notes "this affects future weeks too" via `set_preferred_alternative`-equivalent intent.

### 10.7 "stop programming squats"
- **Current:** `ban_exercise_globally` → athletePreferencesStore. Current week unchanged. Diff empty → "tried to adjust it" misleading message.
- **Ideal:** Reply explicitly says "Squats removed from future weeks. Want me to swap this week's squats too?"

### 10.8 Game moved to Sunday this week
- **Current:** Calendar mark + memory `project_oneoff_game_scoping` window-scopes correctly. Microcycle NOT rebuilt for off-DOW move. ✓.
- **Ideal:** Same; plus the resolver's Decision array surfaces the move in UI.

### 10.9 Phase shift mid-block
- **Current:** Microcycle regenerates; dateOverrides retained — masks new program. Failure mode.
- **Ideal:** Phase shift event also clears overrides scoped to the prior phase.

### 10.10 Two clarifier-loop turns ("hammy" → "actually it's my groin")
- **Current:** Each turn evaluated independently. The conversation history is sent to the LLM but the deterministic guard re-evaluates the *current* turn only. If the user says "actually it's my groin" alone, no body part + no severity → no fire → LLM-handled.
- **Ideal:** Conversation-aware guard maintains pending-injury state across turns.

### 10.11 Coach action conflicts with structural invariant
- **Current:** No invariant check. LLM could in theory create a structurally bad week.
- **Ideal:** InvariantChecker rejects, replies "Can't do that because [reason]."

### 10.12 Past-date adjustment requested
- **Current:** Engine filters to `d.date >= todayISO`. LLM tools have no equivalent guard.
- **Ideal:** InvariantChecker rejects past-date intents with explicit message.

### 10.13 Empty/no future sessions in the week
- **Current:** Engine returns "I couldn't find any future sessions this week to adjust." ✓.
- **Ideal:** Same.

### 10.14 Conditioning-only change
- **Current:** Conditioning protocol body changes are invisible in the fingerprint. Diff blind spot.
- **Ideal:** Event-based grounding sees the change.

### 10.15 Same-name exercise swap
- **Current:** Diff invisible.
- **Ideal:** Event-based grounding sees the swap.

### 10.16 LLM tool-loop cap hit
- **Current:** Generic message, program unchanged.
- **Ideal:** Telemetry logs the cap hit; user sees a specific "I'm having trouble with this — could you try rephrasing?" message.

### 10.17 LLM hallucinates a tool that doesn't exist
- **Current:** Edge function would error / return malformed action; client probably ignores.
- **Ideal:** Edge function rejects unknown tools at the protocol level; LLM is given an error message and may retry within the cap.

### 10.18 Network failure mid-coach-turn
- **Current:** User sees a network error. No state changed (good).
- **Ideal:** Same; offline queue holds the message for retry.

### 10.19 Two coach actions, second errors
- **Current:** First mutated state, second errored. Inconsistent state.
- **Ideal:** Event log lets the apply step be all-or-nothing.

### 10.20 User asks "what did you change?"
- **Current:** LLM has to reconstruct from history.
- **Ideal:** Event log is queryable. "Tuesday: removed RDLs, swapped squats for goblet squats. Done at 3:42pm."

---

## 11. SYSTEM RULES (NON-NEGOTIABLES)

These are the invariants the rewrite must preserve. Violating any one of these is a regression.

### R1. The engine defines structure; the AI enriches.
Memory `feedback_ai_enriches_engine_defines`. Structural fields (`strengthPattern`, `conditioningCategory`, `sessionTier`, `focus`, `isTeamDay`) come from the engine, never from the AI.

### R2. The resolver is the single source of truth at render time.
No screen reads `currentMicrocycle.workouts[i]` directly. Everyone reads through `resolveWeekWithConditioning` (or its read-model successors).

### R3. Past dates are immutable.
The injury engine, the LLM tools, and any future modification path must all filter to `date >= todayISO` before mutating.

### R4. Grounding gates the LLM.
The LLM's free-text claims about program changes are suppressed; the canonical reply is built from observed change (today: state diff; ideally: events).

### R5. Severity-unknown injury reports get a clarifier, never an action.
Memory `feedback_coach_ambiguity_triage`. Both client and edge enforce this.

### R6. Exercise-registry changes propagate through all 6 surfaces.
Memory `feedback_exercise_registry_all_surfaces`: tags, pools (both files), aliases, video map, cues, load estimation. No patching the video map alone.

### R7. Pool-managed exercise names are guarded against fuzzy substring collapse.
Memory `project_findorcreate_pool_guard`.

### R8. Names flow through `resolveSessionDisplayName`.
Memory `project_canonical_naming_system`. No ad-hoc string manipulation in screens.

### R9. UI variants share a single orchestration hook.
Memory `feedback_ui_variant_shared_hook`.

### R10. Glow / lime accent is a completion signal, not a "ready" signal.
Memory `feedback_glow_for_completion_only`.

### R11. Substitute exercises, don't drop the pattern.
Memory `feedback_substitute_dont_drop_pattern`. When the engine refuses an exercise, it offers a named substitute from the family ladder.

### R12. Adjacency: max 2 consecutive same-region sessions.
Memory `project_adjacency_constraint`.

### R13. Pre-season strength balance per phase rules.
Memories `project_preseason_strength_balance`, `project_preseason_4exposure_priority`, etc.

### R14. In-season push/pull balance is a safety net that runs as a post-pass.
Memory `project_inseason_pushpull_balance`. Strength balance > conditioning when the two conflict.

### R15. Onboarding/phase-shift/game-state-change all funnel through `generateProgramFromProfile`.
Memory `project_unified_program_rebuild`.

### R16. One-off game marks scoped by DOW; off-DOW one-offs do NOT trigger microcycle rebuild.
Memory `project_oneoff_game_scoping`.

### R17. The harness (`npm run qa:athlete`) is the canonical validation gate for engine/plan changes.
Memory `feedback_harness_is_source_of_truth`. Add a persona before fixing any UI bug.

### R18. No post-resolve bandaids.
Memory `feedback_no_post_resolve_bandaids`. Fix planning logic in the engine; never use resolver renaming as primary correction.

---

## 12. GAPS / HOLES / RISKS

The honest list of things the system does not do today, and the cost of leaving them undone.

### 12.1 No event log
Single biggest gap. Without events, every grounding logic, every audit, every undo has to be reconstructed from state diffing — which is exactly why the fingerprint blind spots are hard to close.
**Cost of leaving it:** ongoing diff blind-spot bugs, no audit, no undo, no replay-based testing.

### 12.2 No invariant checker on coach actions
The engine's structural invariants (adjacency, balance, pattern integrity) run only at program-generation time. After a coach action, nothing checks. The LLM is trusted not to break the week's shape.
**Cost of leaving it:** subtle structural regressions only catch in user testing.

### 12.3 No telemetry on the LLM path
We do not know, in production, how often the grounding gate fires the "tried to adjust it" fallback, how often the 5-step cap hits, what the latency distribution looks like, or which tools are most-used.
**Cost of leaving it:** debugging by anecdote.

### 12.4 No server-authoritative state
Single-device persistence. A wipe = a wipe.
**Cost of leaving it:** no backup, no multi-device, no support workflow. Acceptable for v1; fatal for growth.

### 12.5 No end-to-end coach test
Unit tests cover engine, resolver, guards, prompt contract. Nothing tests "user types message → reply rendered → store mutated → next render reflects change."
**Cost of leaving it:** integration regressions only catch on manual QA.

### 12.6 Diff fingerprint blind spots
§6.3. Documented in memory, with the injury-engine recovery-shell fallback as the workaround. The workaround is a load-bearing duct-tape.
**Cost of leaving it:** every new modification kind has to consider whether it's visible in the fingerprint.

### 12.7 Phase-shift override leakage
§5.2. Real bug.
**Cost of leaving it:** users who change phase mid-block get wrong sessions for any date that had a prior override.

### 12.8 Calendar mark / manual override collision is silent
§5.1. No UI.
**Cost of leaving it:** users surprised by which one wins.

### 12.9 athletePreferencesStore changes look like no-ops in the diff
§7.4. Triggers the misleading "tried to adjust it" message.
**Cost of leaving it:** "stop programming squats" feels broken.

### 12.10 No feedback loop from completion logs to planning
§7.5. The resolver doesn't know what got done.
**Cost of leaving it:** the program is ballistic — fired once, never adjusted by execution reality.

### 12.11 Coach memory is LLM-shaped
§7.6. The narrative drifts; engine never reads it.
**Cost of leaving it:** the coach's "model of the athlete" can decay invisibly.

### 12.12 Conversation-aware injury state across turns
§10.10. The deterministic guard re-evaluates each turn in isolation.
**Cost of leaving it:** clarifier loops can fall out of state when the user re-phrases.

### 12.13 No retry / fallback when tool loop cap hits
§10.16. Generic message, program unchanged.
**Cost of leaving it:** rare but disastrous when it occurs.

### 12.14 Dormant broken screens
Memory `project_dormant_screens`. `CurrentWeekScreen`, `CustomizeWorkoutScreen`.
**Cost of leaving it:** technical debt, rebase friction.

### 12.15 `addWeeklyOverride` and friends call `new Date()` directly
§6.12. Non-injectable clock.
**Cost of leaving it:** date-dependent test flakiness; harder to write deterministic integration tests.

### 12.16 Stale `.js` siblings in `src/`
Memory `reference_stale_js_gotcha`.
**Cost of leaving it:** every refactor risks a `.js` shadow.

### 12.17 `isolation_upper` anchor caveat
Memory `project_isolation_upper_anchor_caveat`. Anchors are nominal, loadRatios are physically meaningless.
**Cost of leaving it:** revisit before isolation progression features ship.

### 12.18 No abuse / safety guard on the LLM beyond severity-unknown injury
The LLM has 10 tools. If a user prompts adversarially ("delete all my sessions"), the system relies on tool design + grounding gate + post-validation. There's no red-team layer.
**Cost of leaving it:** low risk for a single-user app, real risk if the surface broadens.

### 12.19 No A/B harness
We can't compare two engine versions on the same persona without manual diffing. The scenario harness is excellent for asserting outputs, less good for differential analysis.
**Cost of leaving it:** engine evolution is high-friction.

### 12.20 Single model dependency
Primary `claude-sonnet-4-6`, fallback `claude-haiku-4-5-20251001`. If both Anthropic models are down, the chat path is dead. Deterministic engine paths still work.
**Cost of leaving it:** acceptable for a research preview; concerning for a production app.

---

## Appendix A — File map (high-confidence, all paths are real today)

**Stores**
- `src/store/profileStore.ts`
- `src/store/programStore.ts` (~338 lines)
- `src/store/calendarStore.ts` (~131 lines)
- `src/store/athletePreferencesStore.ts` (~142 lines)
- `src/store/coachMemoryStore.ts` (~48 lines)
- `src/store/uiStore.ts` (~63 lines)

**Engine & generation**
- `src/utils/programGeneration.ts` (`generateProgramFromProfile`)
- `src/utils/coachingEngine.ts` (`generateMicrocycle`)
- `src/utils/sessionResolver.ts` (resolver)
- `src/utils/sessionBuilder.ts`
- `src/utils/sessionNaming.ts` (`resolveSessionDisplayName`)
- `src/utils/staleOverrideDetector.ts`
- `src/utils/exerciseFilter.ts`
- `src/utils/exerciseScorer.ts`
- `src/data/exercisePools.ts`
- `src/data/exerciseTags.ts`

**Coach**
- `src/screens/coach/CoachScreen.tsx` (~623 lines)
- `src/utils/coachActions.ts` (~750 lines)
- `src/utils/coachWeekDiff.ts` (~373 lines)
- `src/utils/injuryClarificationGuard.ts`
- `src/utils/injuryAdjustmentEngine.ts`
- `supabase/functions/coach-chat/` (edge function)

**UI**
- `src/hooks/useSchedule.ts` (`useScheduleState`, `useResolvedWeek`, `useResolvedDay`, `useMonthIndicators`)
- `src/screens/home/DayWorkoutScreen.tsx` / `DayWorkoutScreenV2.tsx`
- `src/screens/home/useDayWorkout.ts`
- `src/screens/program/ProgramDetailScreen.tsx`
- `src/screens/calendar/CalendarScreen.tsx`

**Tests**
- `src/__tests__/scenarioHarness.js` (`npm run test:scenarios`)
- `src/__tests__/scenarioQA/index.ts` (`npm run qa:athlete`)
- `src/__tests__/exercisePoolsStrengthTests.ts` (`npm run test:pools`)
- `src/__tests__/variedProgramPersonaTests.ts` (`npm run test:variation`)
- `src/__tests__/conditioningRotationTests.ts` (`npm run test:conditioning-rotation`)
- `src/__tests__/coachPromptContractTests.ts` (`npm run test:coach-prompt`)
- `src/__tests__/injuryClarificationGuardTests.ts` (`npm run test:injury-guard`)
- `src/__tests__/coachScreenInjuryClientGuardTests.ts` (`npm run test:injury-client-guard`)
- `src/__tests__/injuryAdjustmentEngineTests.ts` (`npm run test:injury-engine`)
- `src/__tests__/weekPlanQA.ts` (`npm run test:qa`)
- `src/__tests__/blockBoundsTests.js` (`npm run test:bounds`)

---

## Appendix B — One-line summary of the system

> A deterministic season-aware engine plans the week; an LLM coach modifies it through a tool surface gated by deterministic guards; the resolver is the only thing that decides what an athlete sees on a given day; and the entire system's correctness depends on the grounding loop catching the LLM whenever it lies.

Tighten that loop, log the events, fence the LLM behind invariants, and the rewrite writes itself.
