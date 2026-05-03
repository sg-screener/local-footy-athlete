# Progression Rule Design — Complete Specification

**Status:** Design only — not yet implemented
**Covers:** Strength progression (Sections 1–12) and Conditioning progression (Section 13)

---

## 1. Types

```typescript
type ProgressionState = 'build' | 'maintain' | 'hold' | 'deload' | 'return' | 'overreach';

type ExerciseRole = 'primary_strength' | 'secondary_strength';
// Accessories and trunk work are excluded from progression tracking.

type TrendSignal = 'up' | 'flat' | 'down';

interface ProgressionInput {
  exerciseRole: ExerciseRole;
  seasonPhase: SeasonPhase;
  readiness: ReadinessLevel;
  completionQuality: CompletionQuality;
  weeksSinceDeload: number;
  consecutiveBuildWeeks: number;
  recentRPE: number;              // bridged from SessionFeeling
  daysToGame: number | null;
  daysSinceGame: number | null;
  doubleGameWeek: boolean;
  weeksOffTraining: number;        // 0 = no gap
  injuryAvoidFlag: boolean;        // from coaching engine or manual flag
  recentDeloadTrigger: 'overreach' | null;
  missedSessionsThisWeek: number;  // scheduled but not logged
  sessionFeeling: SessionFeeling;  // raw qualitative input
  trend: TrendSignal;              // derived from last 2–3 exposures
}

interface ProgressionOutput {
  state: ProgressionState;
  loadDelta: 'micro_up' | 'up' | 'none' | 'down' | 'big_down';
  setsDelta: 'add_one' | 'none' | 'drop_one' | 'drop_two';
  rpeDelta: 'push' | 'none' | 'pull';
  note: string;  // human-readable reason for logging/UI
}
```

---

## 2. SessionFeeling → RPE Bridge

Maps qualitative feeling to numeric RPE for rule evaluation:

| SessionFeeling | Bridged RPE |
|---|---|
| Cooked | 10 |
| Sore | 8 |
| Strong | 7 |
| Good | 6 |
| Average | 5 |

---

## 3. Completion Quality Derivation

Derived from logged sets vs prescribed:

- **full** — all prescribed sets completed at or above target load
- **partial** — ≥50% of sets completed, or load reduced mid-session
- **failed** — <50% of sets completed, or session abandoned

---

## 4. Trend Signal

Derived from the last 2–3 logged exposures of the same exercise. Compares load × reps across sessions.

```
trend = deriveTrend(recentExposures: { load: number, reps: number }[]): TrendSignal
```

**Rules:**

- If fewer than 2 exposures exist → `'flat'` (insufficient data)
- Compare most recent to oldest in the window:
  - Volume (load × reps) increased ≥ 5% → `'up'`
  - Volume decreased ≥ 5% → `'down'`
  - Otherwise → `'flat'`

**Usage:** Trend is a secondary input only. It does not override primary state resolution. It informs two specific decisions:

1. **Build → Hold gate**: If `trend === 'down'` and state would be `build`, downgrade to `hold` (athlete trending the wrong way despite readiness saying build — something's off).
2. **Maintain confidence**: If `trend === 'up'` during `maintain`, allow the note to reflect "progressing well within maintenance band" for coaching UI feedback. No mechanical change.

Trend never triggers deload, never overrides season phase rules, never promotes state upward.

---

## 5. Progression States

| State | Intent | Load | Sets | RPE target |
|---|---|---|---|---|
| **build** | Progressive overload | Micro-up or up | Add one (when earned) | Push toward 7–8 |
| **maintain** | Hold current capacity | None | None | Stay 6–7 |
| **hold** | Freeze — don't regress, don't push | None | None | Stay ≤ 6 |
| **deload** | Active recovery — reduce everything | Big down (−20–40%) | Drop two | Pull to ≤ 5 |
| **return** | Rebuild after gap/deload | Ramped up from reduced baseline | None initially | Conservative, ≤ 6 |
| **overreach** | Planned functional overreach (off-season only) | Up aggressively | Add one | Push 8–9 |

---

## 6. State Resolution Logic — `resolveProgression()`

Eight-step priority chain. **This function makes the final state decision.** The builder receives the output and applies it without modification.

```
Step 1 — Return-to-training gate
  if weeksOffTraining >= 2 → state = 'return'

Step 2 — Hard deload triggers (any ONE fires immediately)
  if recentDeloadTrigger === 'overreach' → state = 'deload'
  if doubleGameWeek → state = 'deload'
  if injuryAvoidFlag → state = 'deload'

Step 3 — Soft deload triggers (require 2+ concurrent to fire)
  softCount = 0
  if readiness === 'low' → softCount++
  if recentRPE >= 8 → softCount++
  if missedSessionsThisWeek >= 1 → softCount++
  if sessionFeeling === 'Cooked' → softCount++
  if softCount >= 2 → state = 'deload'

Step 4 — Scheduled deload cycle
  if weeksSinceDeload >= 4 (in-season) or >= 6 (pre/off-season)
    → state = 'deload'

Step 5 — Game proximity hold
  if daysToGame !== null && daysToGame <= 2 → state = 'hold'

Step 6 — Season phase + readiness matrix (see below)

Step 7 — Trend gate
  if resolved state === 'build' && trend === 'down' → state = 'hold'

Step 8 — Overreach decision (off-season only)
  if seasonPhase === 'Off-season'
    && readiness === 'high'
    && consecutiveBuildWeeks >= 3
    && recentRPE <= 7
    && trend !== 'down'
    → state = 'overreach'
```

**Step 6 — Season phase × readiness matrix:**

| Phase | Low readiness | Medium readiness | High readiness |
|---|---|---|---|
| **In-season** | hold | maintain | maintain (upper body) / in-season build (lower body — see §6a) |
| **Pre-season** | maintain | build | build |
| **Off-season** | maintain | build | build (→ overreach check at Step 8) |

---

## 6a. In-Season Lower Body Build

In-season, high readiness unlocks conservative lower body micro-progression instead of blanket maintain. This recognizes that athletes can make small lower body gains in-season under the right conditions.

**Gate — all must be true:**
- `readiness === 'high'`
- `recentRPE <= 6`
- `daysToGame === null || daysToGame >= 3`
- `doubleGameWeek === false`
- `trend !== 'down'`

**If gate passes:**
- `state = 'build'`
- `loadDelta = 'micro_up'` (small load increment only — e.g., 1–2.5 kg)
- `setsDelta = 'none'` (never add sets in-season lower body)
- `rpeDelta = 'none'` (stay within current RPE band, do not push)
- `note = 'In-season lower body micro-progression — conditions met'`

**If gate fails:**
- Fall back to `maintain` as normal

This applies to `primary_strength` and `secondary_strength` exercises tagged as lower body. Upper body in-season high readiness remains `maintain` (upper body has less game-day injury risk from micro-progression, but the gains are also smaller and not worth the fatigue trade — maintain is the right call).

---

## 7. Progression Mechanics by State

**Build:**
- Load: micro_up after each full-completion session; up after 2 consecutive full completions
- Sets: add_one after 3 consecutive full completions at current load
- RPE: push — target 7–8 range
- If completion is partial: load stays, sets stay (no regression from one partial)
- If completion is failed: load drops one step, sets stay → next session re-attempts

**Maintain:**
- Load: none — hold current working weight
- Sets: none — hold current volume
- RPE: stay 6–7 range
- If completion drops to failed → transition to hold

**Hold:**
- Load: none — freeze
- Sets: none — freeze
- RPE: pull to ≤ 6
- Exit: readiness returns to medium+ on next resolution

**Deload:**
- Load: big_down (−20–40% of working weight)
- Sets: drop_two
- RPE: pull to ≤ 5
- Duration: 1 week, then transition to return
- Source tracking: note records which trigger caused the deload

**Return:**
- Week 1: 60% of pre-gap working weight, baseline sets
- Week 2: 80% of pre-gap working weight, baseline sets
- Week 3+: re-enter normal state resolution
- RPE cap: ≤ 6 throughout return phase
- If return follows deload: start at 80% (not 60%) — deload is shorter gap

**Overreach (off-season only):**
- Load: up aggressively (larger jumps than build)
- Sets: add_one
- RPE: push 8–9 (intentionally high)
- Duration: max 2 consecutive weeks
- Auto-exits to deload after 2 weeks regardless of performance
- `resolveProgression()` makes this decision at Step 8 — builder receives `state: 'overreach'` and applies the mechanics

---

## 8. Deload Triggers — Full Specification

### Hard Triggers (any single one fires immediately)

| Trigger | Condition | Rationale |
|---|---|---|
| Post-overreach | `recentDeloadTrigger === 'overreach'` | Mandatory recovery after planned functional overreach |
| Double game week | `doubleGameWeek === true` | Two games demand full physiological recovery; training load must drop |
| Injury avoidance | `injuryAvoidFlag === true` | Coaching engine or manual flag indicating injury risk; immediate load reduction |

### Soft Triggers (require 2+ concurrent to fire)

| Trigger | Condition | Rationale |
|---|---|---|
| Low readiness | `readiness === 'low'` | Single low readiness day is normal; combined with other signals = real fatigue |
| High RPE | `recentRPE >= 8` | One tough session is fine; if athlete also feels cooked or missed sessions = overreaching |
| Missed sessions | `missedSessionsThisWeek >= 1` | Life happens; but combined with low readiness or high RPE = athlete needs a break |
| Cooked feeling | `sessionFeeling === 'Cooked'` | Qualitative red flag; alone it's noted, combined with other signals = deload |

**Why the split:** Hard triggers represent clear physiological or structural states where continuing to push has an unacceptable risk profile regardless of context. Soft triggers are individually noisy — a single bad day is normal. Requiring 2+ concurrent soft triggers filters noise while still catching genuine accumulated fatigue patterns.

---

## 9. Return-to-Training Logic

- **Gap detection**: `weeksOffTraining >= 2` triggers return state
- **Ramp protocol**: 60% → 80% → normal (or 80% → normal post-deload)
- **RPE cap**: ≤ 6 throughout return
- **No set additions**: Volume holds at baseline during return
- **Exit**: After ramp weeks complete, normal state resolution resumes

---

## 10. RPE Integration

- RPE is bridged from SessionFeeling (§2), not directly input by athlete
- Used in: deload soft triggers (≥ 8), build load decisions, overreach gate (≤ 7), in-season lower body gate (≤ 6)
- RPE targets per state guide the `rpeDelta` output field
- Future: if direct RPE logging is added, it replaces the bridge (bridge is fallback)

---

## 11. Game Context Rules

- **G−2 or closer**: hold (Step 5)
- **G+1**: handled by game proximity in resolver, not progression
- **Double game week**: hard deload trigger (Step 2)
- **In-season lower body**: gate requires `daysToGame >= 3` (§6a)
- **In-season upper body**: maintain regardless of readiness

---

## 12. Architecture Fit

- `resolveProgression()` is a pure function — no React, no Zustand, no side effects
- Lives in `src/utils/progressionRules.ts`
- Called by the session builder after exercise selection, before set/load prescription
- Builder receives `ProgressionOutput` and applies `loadDelta`, `setsDelta`, `rpeDelta` mechanically — **builder does not make progression state decisions**
- `deriveTrend()` is a pure helper in the same file, called to compute `trend` before passing to `resolveProgression()`
- Progression history (last working weight, consecutive build weeks, etc.) stored in existing exercise log data — no new persistence layer needed
- `weeksSinceDeload` and `consecutiveBuildWeeks` derived from session history at resolve time

---

---

# Section 13 — Conditioning Progression

---

## 13.1 Types

```typescript
type ConditioningProgressionState = 'build' | 'maintain' | 'hold' | 'deload';
// No 'overreach' or 'return' — conditioning doesn't need that complexity.

type ConditioningTierLabel = 'A' | 'B-high' | 'B-low' | 'C';

interface ConditioningProgressionInput {
  tier: ConditioningTierLabel;
  readiness: ReadinessLevel;
  recentRPE: number;                 // bridged from SessionFeeling same as strength
  completionQuality: CompletionQuality;
  activeInjuries: InjuryFlag[];      // injuries with 'avoid' or 'modify' affecting the modality
  seasonPhase: SeasonPhase;
  weeklyConditioningCount: number;   // from WeekLog — how many conditioning sessions this week
  daysToGame: number | null;
  doubleGameWeek: boolean;
  highFatigueStrengthThisWeek: boolean; // true if any strength session this week had RPE ≥ 8
  lastSessionProgressed: boolean;    // did the previous exposure of this tier progress a variable?
  weeklyLoad: number;               // current week's weighted conditioning load
  previousWeekLoad: number;          // prior week's weighted conditioning load
}

interface ConditioningProgressionOutput {
  state: ConditioningProgressionState;
  adjustment: ConditioningAdjustment;
  note: string;
}

interface ConditioningAdjustment {
  repsDelta: number;        // e.g. +1, 0, -2
  intervalsDelta: number;   // e.g. +1, 0, -1
  durationDelta: number;    // minutes: e.g. +5, 0, -5
  restDelta: number;        // seconds: e.g. 0, -5, +10 (negative = harder)
  intensityDelta: 'none' | 'slight_up' | 'slight_down' | 'big_down';
}
// Only ONE non-zero field per output when state is 'build'.
// Deload may reduce multiple fields simultaneously.
```

---

## 13.2 State Resolution Logic — `resolveConditioningProgression()`

Five-step priority chain. First match wins.

```
Step 1 — Hard deload triggers (any ONE fires immediately)
  if doubleGameWeek → state = 'deload'
  if activeInjuries includes 'avoid' affecting this modality → state = 'deload'

Step 2 — Soft deload triggers (require 2+ concurrent)
  softCount = 0
  if readiness === 'low' → softCount++
  if recentRPE >= 8 → softCount++
  if completionQuality === 'failed' → softCount++
  if softCount >= 2 → state = 'deload'

Step 3 — Game proximity hold
  if daysToGame !== null && daysToGame <= 2 → state = 'hold'

Step 4 — Season phase default
  In-season → maintain
  Pre-season early → build
  Pre-season late (≤ 2 weeks to season) → maintain
  Off-season → build

Step 5 — Tier constraint (can only downgrade, never upgrade)
  Tier A:
    if seasonPhase === 'In-season' → cap at 'maintain' (even if Step 4 said build)
    Off-season/pre-season → allow build from Step 4
  Tier B-high:
    if seasonPhase === 'In-season' → cap at 'maintain'
    Off-season/pre-season → allow build from Step 4
  Tier B-low:
    allow whatever Step 4 resolved (build allowed in all phases)
  Tier C:
    always cap at 'maintain' regardless of Step 4
```

**After resolution — three final guards:**

```
Guard A — High fatigue strength week
  if highFatigueStrengthThisWeek && state === 'build' → downgrade to 'maintain'

Guard B — No consecutive progression
  if lastSessionProgressed && state === 'build' → downgrade to 'maintain'
  (athlete must earn the next progression by completing a maintain session first)

Guard C — Weekly load spike (§13.8)
  only activates when weeklyLoad > previousWeekLoad
  if previousWeekLoad > 0
    && weeklyLoad > previousWeekLoad
    && (weeklyLoad - previousWeekLoad) / previousWeekLoad > 0.35
    → downgrade 'build' to 'maintain'
```

---

## 13.3 Progression Mechanics by Tier

Each tier has a defined set of progressable variables and caps. When state is `build`, exactly ONE variable advances. The builder picks the variable using this priority: the variable that has been static the longest advances first (simple staleness heuristic — no tracking infrastructure needed beyond the last prescription).

### Tier A — Sprint Work

| Variable | Progression step | Cap |
|---|---|---|
| Reps | +1 per exposure | Max 8 reps per set (quality ceiling — sprint form degrades beyond this) |
| Distance | +5–10m per exposure | Max 40m (longer becomes aerobic) |
| Rest reduction | −5s per exposure | Min 90s between efforts (full phosphocreatine recovery threshold) |

**Constraints:**
- Never increase distance AND reduce rest in the same session
- If `completionQuality === 'partial'` on previous exposure → repeat current prescription, do not progress
- Lower limb injury at 'modify' level → hold (not deload, but freeze all variables)

### Tier B-high — Intervals / Circuit / Tempo Efforts

| Variable | Progression step | Cap |
|---|---|---|
| Rounds / intervals | +1 per exposure | Max 8 rounds (beyond this, session duration becomes excessive) |
| Total volume | +10% estimated work per exposure | Cap at 40 min total session time |
| Rest reduction (density) | −5–10s between intervals | Min 30s rest (below this compromises work quality) |

**Constraints:**
- If weekly conditioning count is already at cap → do not progress (volume is maxed)
- `completionQuality === 'failed'` → next exposure drops one round and holds

### Tier B-low — Steady State / Low-Intensity Intervals

| Variable | Progression step | Cap |
|---|---|---|
| Duration | +5 min per exposure | Max 40 min (diminishing returns beyond this for non-endurance athletes) |
| Interval count | +1 per exposure | Max 6 intervals |

**Constraints:**
- This is the safest bucket — progression is allowed in all season phases
- If readiness is medium and RPE was ≤ 6 last session → eligible to build even in-season (no additional gate needed — Step 5 already allows it)

### Tier C — Recovery Conditioning

- No progression. Ever.
- Output is always `state: 'maintain'` with all adjustment fields at zero
- Tier C exists for recovery benefit, not adaptation. Progressing it defeats the purpose.

---

## 13.4 Deload Mechanics

Deload reduces load without removing the session entirely (placement rules still decide whether the session exists — progression only adjusts its parameters).

| Tier | Deload action |
|---|---|
| A | Drop reps by 2, increase rest by 15s, reduce distance by 10m. Apply whichever fields are above their baseline. |
| B-high | Drop 2 rounds/intervals, increase rest by 15s. If already at minimum rounds, reduce intensity to 'big_down'. |
| B-low | Reduce duration by 10 min (floor at 15 min). Reduce interval count by 1. |
| C | No change (already at minimum). |

**Deload duration:** 1 conditioning cycle (the next exposure of that tier). After deload, state resolves fresh on the subsequent exposure — it does not auto-return to build.

**Full removal:** Only occurs when the hard deload trigger is an injury at 'avoid' level affecting the specific modality. In that case, the output sets all adjustment fields to zero and adds `note: 'Session skipped — injury avoidance'`. The builder checks this note and does not prescribe exercises for that modality. Placement is unaffected (the slot stays allocated; the builder just produces an empty/rest session for it).

---

## 13.5 Constraints Summary

1. **One variable per session.** When `state === 'build'`, exactly one field in `ConditioningAdjustment` is non-zero. The rest are zero.

2. **No stacking.** If the previous exposure of this tier progressed a variable (`lastSessionProgressed === true`), the current exposure must be `maintain` at minimum. Athlete earns the next step by completing a non-progressed session first.

3. **Strength fatigue guard.** If any strength session this week logged RPE ≥ 8, conditioning cannot build. The body is already under high mechanical stress — adding conditioning progression on top is counterproductive.

4. **Weekly cap respect.** If `weeklyConditioningCount` is at the phase cap (from existing placement rules), do not add volume-based progressions (rounds, intervals, duration). Rest reduction is still allowed since it doesn't extend session time.

5. **Placement independence.** `resolveConditioningProgression()` never changes which day conditioning appears, which tier is selected, or whether the session exists. It only adjusts parameters within an already-placed session.

6. **Cap enforcement.** Every progressable variable has a hard cap (defined in §13.3). If a variable is at cap, it is ineligible for progression. If all variables for a tier are at cap, the session stays at maintain regardless of state resolution.

---

## 13.6 Integration

```
resolveConditioningProgression(input: ConditioningProgressionInput): ConditioningProgressionOutput
```

- Pure function, no side effects, no persistence
- Lives in `src/utils/conditioningProgressionRules.ts` (new file, separate from strength progression)
- Called inside `buildConditioningSession()` after tier and exercise selection, before final parameter prescription
- Builder receives the output and applies adjustments to the session's reps, duration, intervals, and rest values
- Builder does not make state decisions — it applies what the function returns
- `lastSessionProgressed` derived from the previous logged session of the same tier at build time — no new storage needed
- `highFatigueStrengthThisWeek` derived from WeekLog strength sessions at build time

**Call sequence:**
```
buildConditioningSession()
  → select tier (existing logic, unchanged)
  → select exercises (existing logic, unchanged)
  → resolveConditioningProgression(input)  // NEW
  → apply adjustments to prescribed parameters  // NEW
  → return session
```

---

## 13.7 Conditioning Load Model

Each conditioning session carries a weight based on its tier:

| Tier | Weight |
|---|---|
| A | 3 |
| B-high | 2 |
| B-low | 1 |
| C | 0.5 |

```
weeklyLoad = sum of weights for all conditioning sessions placed this week
previousWeekLoad = same calculation for the prior week
```

Both values are derived from WeekLog data at resolve time. No new persistence needed.

---

## 13.8 Weekly Conditioning Load Guard

A soft constraint that prevents large week-to-week spikes in total conditioning load. This guard only affects progression decisions — never placement, tier selection, or hard rule outcomes.

### Activation Rule

**The load guard only activates when `weeklyLoad > previousWeekLoad`.** If load is equal or decreasing, the guard does not apply — progression proceeds based on the other resolution steps.

### Spike Detection

```
if weeklyLoad > previousWeekLoad && previousWeekLoad > 0:
  loadIncrease = (weeklyLoad - previousWeekLoad) / previousWeekLoad
else:
  guard does not activate — skip to output
```

**Threshold:** `loadIncrease > 0.35` (35% — midpoint of the 30–40% band, simple and deterministic)

### Effect When Spike Detected

When the guard activates and `loadIncrease > 0.35`:

- Any session that would resolve to `state: 'build'` is downgraded to `'maintain'`
- Sessions already at `'maintain'`, `'hold'`, or `'deload'` are unaffected
- The adjustment output zeroes all progression fields (reps, intervals, duration, rest all stay at current values)
- `note: 'Conditioning load spike detected — progression paused this week'`

This means the athlete still trains at their current level — they just don't advance any variables until the load stabilizes.

### Priority

This guard sits **after** the full state resolution chain (Steps 1–5 plus Guards A and B from §13.2) but **before** the final output is returned. It can only downgrade, never upgrade.

```
resolveConditioningProgression()
  → Step 1–5 (state resolution)
  → Guard A (strength fatigue)
  → Guard B (no consecutive progression)
  → Guard C (weekly load spike)
  → return final output
```

Hard rules always win. If Step 1 already set `'deload'` due to injury or double game week, the load guard never runs — the state is already more restrictive. The guard only activates when the resolved state is `'build'` and the load spike threshold is exceeded.

### Edge Cases

**First week of program / no prior data:** `previousWeekLoad` is zero or undefined. The guard does not fire — there's no baseline to compare against. Progression is allowed normally.

**Returning from bye week or break:** `previousWeekLoad` will be zero. Same as above — guard does not fire. The return-to-training gate in strength progression handles deconditioning risk; conditioning placement rules already handle bye weeks by not placing sessions.

**Week where placement adds a new tier:** If the resolver places an extra Tier A session this week that didn't exist last week, the load jump is real and the guard catches it. The new session still runs (placement is untouched), but it runs at maintain parameters instead of progressing.

**Load equal or decreasing:** Guard does not activate. The athlete's conditioning load is stable or dropping — there is no spike to protect against.

**Double game week:** Already caught by hard deload trigger in Step 1. The load guard is redundant here but harmless — deload is already more restrictive than maintain.

### Why 35%

The acute:chronic workload ratio literature suggests spikes above ~1.3–1.5× increase injury risk in team sport athletes. 35% maps to 1.35× — conservative enough to catch genuine spikes while permitting normal week-to-week variation (adding one B-low session to a typical week is ~15–20% increase, well under the threshold). A fixed percentage is simpler and more predictable than a rolling average model, and good enough for a conditioning system where the tier weights are already coarse approximations.
