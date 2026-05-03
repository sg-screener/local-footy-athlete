# Training Engine — Internal Architecture Note

Last updated after feedback pattern layer implementation. This covers the live pipeline end-to-end. Read this before touching any rule logic.

---

## Pipeline Overview

Every screen calls the same pipeline through hooks. No screen resolves sessions independently.

```
Zustand stores ──→ useScheduleState() ──→ resolveWeekWithConditioning()
                                              │
                                              ├─ Pass 1:  Base resolution + strength progression
                                              ├─ Interpass: DGW second-G+1 → full rest
                                              ├─ Pass 2:  Conditioning placement
                                              └─ Pass 3:  Recovery placement
                                              │
                                              ▼
                                        ResolvedDay[]
```

Data flows one direction. Each pass is additive — never displaces a prior pass. Everything is derived at read time, nothing cached.

---

## Resolver Responsibilities (`sessionResolver.ts`)

Owns the three-pass orchestration. Pure functions, no React, no Zustand.

**`resolveDate()`** — atomic unit. 7-step priority for a single date:
1. Manual override (human/coach edit)
2. Calendar mark: rest → null
3. Calendar mark: game → game stub
4. Template says game but calendar doesn't → freed slot (optional prehab)
5. Template + game proximity (G+1 recovery, G-1 arms/pump, G-2 moderate)
6. Unmodified template
7. No workout

**`resolveWeekWithConditioning()`** — the main pipeline:

Pass 1 resolves all 7 days via `resolveDate()`, then runs the strength progression post-process on any `Strength` session with `source === 'template' | 'manual'`. Between Pass 1 and Pass 2, a DGW guard converts the second G+1 recovery to full rest.

The resolver does NOT decide exercise selection, set/rep schemes, or conditioning tier. It delegates those to the builder and rule engines.

---

## Builder Responsibilities (`sessionBuilder.ts`)

Produces fully-formed `Workout` objects. Called by the resolver, never by screens directly.

**`buildDerivedSession(type, ...)`** — creates recovery/prehab/arms sessions from a category-based slot system. Filters exercise pool by injury + equipment, uses `dateHash()` for deterministic rotation.

**`buildConditioningSession(dateStr, ...)`** — builds conditioning context, calls `resolveConditioning()` for tier selection, then `resolveConditioningProgression()` for week-over-week adjustments. Returns null if nothing fits. Stores progression metadata as `_progressionState` / `_progressionAdjustment` on the workout.

Session types: `recovery`, `passive_recovery`, `extended_recovery`, `prehab_accessories`, `arms_pump`.

---

## Strength Progression (`progressionRules.ts` + `strengthProgressionIntegration.ts`)

Two files, two concerns:

**`progressionRules.ts`** — the state machine. `resolveProgression(input) → output`. Six states: build, maintain, hold, deload, return, overreach. Eight-step priority chain:

1. **Return gate** — `weeksOffTraining ≥ 2` → return state (60-80% load)
2. **Hard deload** — any ONE of: post-overreach trigger, DGW, injury avoid → deload
3. **Soft deload** — requires 2+ concurrent signals: low readiness, RPE ≥ 8, missed sessions, feeling cooked
4. **Scheduled deload** — cycle threshold (4 weeks in-season, 6 off-season) + at least 1 fatigue signal
5. **Game proximity hold** — `daysToGame ≤ 2` → hold
6. **Season/readiness matrix** — the default state assignment
7. **Trend gate** — if build + downward trend → downgrade to hold
8. **Overreach** — off-season only, high readiness, 3+ build weeks, RPE ≤ 7, no downward trend

Steps 1-2 are hard overrides. Steps 3+ are influenced by the pattern bias layer.

**`strengthProgressionIntegration.ts`** — wiring layer. Classifies exercises by role (primary/secondary/excluded), builds `StrengthProgressionContext` from schedule state, calls `resolveProgression()` per exercise, maps output deltas to prescription changes.

Exercise role classification: primary = compound + moderate/high load; secondary = lunges + low-load compounds; excluded = isolation, core, conditioning, carry, plyo, untagged. Only primary and secondary get progression — everything else keeps template prescriptions.

Load rounding uses configurable `loadIncrementKg` (default 2.5kg, barbell plates).

---

## Conditioning Pass (`conditioningRules.ts`)

**`resolveConditioning(ctx, weekLog) → ConditioningResult | null`**

Tiers: A (field sprints), B-high (hard cardio), B-low (moderate cardio), C (recovery flush).

Selection pipeline:
1. Date-level tier filtering (game proximity, late-week)
2. Stacking guard — no A/B-high within 24h of each other
3. Strength interaction — high-fatigue strength blocks A+B-high; moderate blocks A
4. Weekly caps by season phase (in-season: 0A/1B; off-season: 2A/2B)
5. Injury filtering — modality-aware (blocks running, allows bike/row/ski)
6. Select highest eligible tier, deterministic within tier

Hard rules: 48h game buffer blocks everything. G+1 = Tier C only. In-season blocks Tier A entirely (except fresh bye week). Non-forcing — returns null if nothing fits.

---

## Recovery Pass (`recoveryRules.ts`)

**`resolveRecovery(daysToGame, daysSinceGame, seasonPhase, readiness, weekRecoveryCount, recentHighTier) → RecoveryResult | null`**

Runs on any day still empty after strength + conditioning passes.

Category by readiness: low → passive, medium → active, high → extended. Extended has guards: not within 48h of game, not after A/B-high conditioning yesterday (both fall back to active, not null).

Frequency cap per week: in-season = 2, pre/off-season = 3.

---

## Feedback + Pattern Layer (`feedbackPatterns.ts`)

Pure bias layer. Reads the last 4 sessions with recorded feedback, detects patterns, adjusts existing context fields by one step maximum. Returns null below 3 feedback entries.

Six flags:
- `FATIGUE_STREAK` — 3+ of 4 hard/very_hard
- `EASE_STREAK` — 3+ of 4 easy/very_easy
- `COMPLETION_DROP` — 2+ of 4 partial/skipped
- `COOKED_REPEAT` — 2+ of 3 very_hard
- `FULL_COMPLETION_RUN` — all 4 full completion
- `MIXED_SIGNALS` — 2+ of 4 hard+full (gutting it out)

**One-step constraint** — enforced by lookup maps (`READINESS_DOWN`, `FEELING_UP_ONE`). Multiple flags cannot stack on the same dimension. When `FATIGUE_STREAK` + `COOKED_REPEAT` both fire, only readiness moves (feeling stays). When `FATIGUE_STREAK` + `MIXED_SIGNALS` both fire, only one readiness downgrade applies.

Where it's applied:
- **Strength** — `applyPatternBiases()` inside `buildProgressionContext()` modifies readiness, sessionFeeling, consecutiveBuildWeeks, missedSessionsThisWeek
- **Conditioning** — `biasConditioningReadiness()` one-step downgrade before WeekLog construction in Pass 2
- **Recovery** — `shouldPreferRest()` skips recovery placement when cooked + already have 1 recovery this week

**Hard boundaries untouched** — game proximity, injury, hard deload triggers, conditioning caps, return-to-training gate all fire before pattern biases can influence the output.

---

## Explanation Layer (`sessionExplanation.ts`)

Read-only projection. Never modifies workouts or decisions. Answers "why does this session look like this?"

34 reason codes across 5 priority tiers. Assembly rules: Tier 1 (game proximity) is exclusive — if present, show only that. Otherwise dedup within tiers, take top 2 codes, concatenate templates.

Pattern codes (`PATTERN_FATIGUE`, `PATTERN_EASE`, `PATTERN_COMPLETION`) sit in Tier 3 alongside progression codes. Detected from `ExplanationContext.patternFlags`, which the `useSessionExplanation` hook populates from the store's feedback data.

State labels (Build/Maintain/Hold/Deload/Return/Overreach) derived from `_progressionResults` on the workout object. Displayed in `SessionStateBadge` as Title Case with color coding.

---

## Data Flow: Stores → Hooks → Resolver → UI

```
programStore        ─┐
  .currentProgram    │
  .currentMicrocycle │
  .dateOverrides     ├──→ useScheduleState() ──→ ScheduleState
  .sessionFeedback   │
calendarStore        │
  .markedDays       ─┤
profileStore         │
  .seasonPhase      ─┘

ScheduleState ──→ resolveWeekWithConditioning() ──→ ResolvedDay[]

ResolvedDay[] ──→ useWeekExplanations() ──→ SessionExplanation[]
                  (reads patternFlags from store)
```

No memoization on schedule data — derived on every render. The computation is trivial per week.

---

## Test Coverage

| Suite | Count | Covers |
|---|---|---|
| Feedback Patterns | 84 | Detection thresholds, bias one-step constraint, hard boundary preservation, integration |
| Session Explanation | 83 | Template completeness, tier exclusivity, assembly dedup, state labels, pattern codes |
| Strength Integration | 92 | Role classification, delta application, load rounding, DGW interaction |
| Progression Rules | 119 | All 8 priority steps, state transitions, edge cases |
| Tag System | 108 | Exercise tags, region mapping, conditioning metadata |
| Conditioning Builder | 138 | Tier selection, caps, stacking, injury filtering |
| Conditioning Wiring | 55 | Full pipeline: ScheduleState → conditioning placement |
| Recovery Wiring | 55 | Recovery placement, frequency caps, category selection |
| Scenario Harness | 65 | End-to-end golden scenarios |
| **Total** | **799** | |
