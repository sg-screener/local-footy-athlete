# Session Explanation System — Design Document

Deterministic, template-based system that explains "why this session looks like this" using reason codes derived from existing resolver, progression, and conditioning logic. No AI-generated text. No freeform paragraphs.

---

## Part 1 — Reason Codes

Every reason code maps 1:1 to an existing decision point in the codebase. Codes are grouped by priority tier (used for selection order in Part 3).

### Priority 1: Game Proximity

| Code | Trigger | Source |
|---|---|---|
| `GP_PLUS_1` | Day after a game → recovery | `applyGameProximity()` G+1 branch |
| `GP_MINUS_1` | Day before a game → arms/pump | `applyGameProximity()` G-1 branch |
| `GP_MINUS_2` | 2 days before a game → moderate load | `applyGameProximity()` G-2 branch |
| `GP_GAME_DAY` | Calendar marked as game | `resolveDate()` Priority 3 |
| `GP_FREED_SLOT` | Template game without calendar mark → optional session | `resolveDate()` Priority 4 |

### Priority 2: Safety / Protection

| Code | Trigger | Source |
|---|---|---|
| `SAFE_DGW` | Double game week detected (2+ games) | `resolveWeekWithConditioning()` DGW guard |
| `SAFE_DGW_REST` | Second G+1 in DGW → full rest | DGW guard, g1Indices.length ≥ 2 |
| `SAFE_INJURY` | Injury avoid flag active → deload | `progressionRules` Step 2 |
| `SAFE_LOW_READINESS` | Readiness = low → soft deload candidate | `progressionRules` Step 3 |
| `SAFE_HIGH_RPE` | Recent RPE ≥ 8 → soft deload candidate | `progressionRules` Step 3 |
| `SAFE_MISSED` | Missed sessions this week → soft deload candidate | `progressionRules` Step 3 |
| `SAFE_POST_OVERREACH` | Post-overreach mandatory deload | `progressionRules` Step 2 |
| `SAFE_RETURN` | Returning from ≥2 weeks off → reduced load | `progressionRules` Step 1 |

### Priority 3: Progression (Strength)

| Code | Trigger | Source |
|---|---|---|
| `PROG_BUILD` | Progression state = build | `resolveProgression()` → build |
| `PROG_MAINTAIN` | Progression state = maintain | `resolveProgression()` → maintain |
| `PROG_HOLD` | Progression state = hold (game proximity) | `resolveProgression()` → hold |
| `PROG_DELOAD` | Progression state = deload (scheduled/soft) | `resolveProgression()` → deload |
| `PROG_OVERREACH` | Progression state = overreach | `resolveProgression()` → overreach |
| `PROG_MICRO_UP` | In-season lower body micro-progression | loadDelta = micro_up + isLowerBody + In-season |

### Priority 4: Conditioning

| Code | Trigger | Source |
|---|---|---|
| `COND_PLACED` | Conditioning session placed on empty day | `resolveWeekWithConditioning()` Pass 2 |
| `COND_BUILD` | Conditioning progression state = build | `resolveConditioningProgression()` |
| `COND_HOLD` | Conditioning progression state = hold | `resolveConditioningProgression()` |
| `COND_DELOAD` | Conditioning progression state = deload | `resolveConditioningProgression()` |
| `COND_BLOCKED_GAME` | Conditioning blocked by 48h game buffer | `conditioningRules` game buffer |
| `COND_BLOCKED_STACK` | Conditioning blocked by stacking guard | `conditioningRules` stacking guard |
| `COND_BLOCKED_INSEASON` | Tier A blocked in-season | `conditioningRules` in-season rule |
| `COND_LOAD_GUARD` | Conditioning capped by weekly load spike guard | `conditioningProgressionRules` Guard C |

### Priority 5: Recovery

| Code | Trigger | Source |
|---|---|---|
| `REC_PLACED` | Recovery session placed on empty day | `resolveWeekWithConditioning()` Pass 3 |
| `REC_PASSIVE` | Passive recovery (low readiness / pre-game) | `resolveRecovery()` → passive |
| `REC_ACTIVE` | Active recovery (standard fill) | `resolveRecovery()` → active |
| `REC_EXTENDED` | Extended recovery (fallback) | `resolveRecovery()` → extended |
| `REC_FULL_REST` | Day left empty — full rest | source = 'none' after all passes |
| `NO_SESSION_OPTIMAL` | Empty day is the best rest placement for the week | source = 'none' + surrounded by training days |

---

## Part 2 — Explanation Templates

Each template is a single sentence. Tone: like a coach talking to you, not a system reporting to you.

### Game Proximity

| Code | Template |
|---|---|
| `GP_PLUS_1` | `"Recovery day — you played yesterday."` |
| `GP_MINUS_1` | `"Light arms and pump — game tomorrow."` |
| `GP_MINUS_2` | `"Dialled back today — game in 48 hours."` |
| `GP_GAME_DAY` | `"Game day."` |
| `GP_FREED_SLOT` | `"Game moved — use this slot however you like."` |

### Safety / Protection

| Code | Template |
|---|---|
| `SAFE_DGW` | `"Two games this week — keeping you fresh where it counts."` |
| `SAFE_DGW_REST` | `"Full rest — two games in one week is enough."` |
| `SAFE_INJURY` | `"Lighter today — working around an injury."` |
| `SAFE_LOW_READINESS` | `"Pulling back — your body's asking for less today."` |
| `SAFE_HIGH_RPE` | `"Easing up — the last few sessions hit hard."` |
| `SAFE_MISSED` | `"Scaled down — accounting for missed sessions this week."` |
| `SAFE_POST_OVERREACH` | `"Deload week — letting your body catch up after a hard block."` |
| `SAFE_RETURN` | `"Welcome back — easing you in after time away."` |

### Progression (Strength)

| Code | Template |
|---|---|
| `PROG_BUILD` | `"Stepped up from last week — you've earned a bit more load."` |
| `PROG_MAINTAIN` | `"Holding steady — you're getting quality work without needing to push up."` |
| `PROG_HOLD` | `"No changes today — keeping you sharp for the game."` |
| `PROG_DELOAD` | `"Pulling back this week — time to recover and reload."` |
| `PROG_OVERREACH` | `"Pushing harder this week — it's supposed to feel tough."` |
| `PROG_MICRO_UP` | `"Small bump on lower body — just enough to keep moving forward."` |

### Conditioning

| Code | Template |
|---|---|
| `COND_PLACED` | `"Conditioning fits well here without impacting your key sessions."` |
| `COND_BUILD` | `"Conditioning stepped up — building on last week."` |
| `COND_HOLD` | `"Conditioning held steady — no need to push more this week."` |
| `COND_DELOAD` | `"Lighter conditioning — giving your legs a break."` |
| `COND_BLOCKED_GAME` | `"No conditioning — too close to a game."` |
| `COND_BLOCKED_STACK` | `"No conditioning — yesterday was enough."` |
| `COND_BLOCKED_INSEASON` | `"Skipping high-intensity conditioning — saving it for the pitch."` |
| `COND_LOAD_GUARD` | `"Conditioning held steady — weekly load was already climbing fast."` |

### Recovery

| Code | Template |
|---|---|
| `REC_PLACED` | `"Light session to help you bounce back for tomorrow."` |
| `REC_PASSIVE` | `"Easy day — just let your body recover."` |
| `REC_ACTIVE` | `"Moving light — enough to loosen up without adding fatigue."` |
| `REC_EXTENDED` | `"Taking extra time to recharge before the next push."` |
| `REC_FULL_REST` | `"Full rest — your body needs a proper reset today."` |

### No Session

| Code | Template |
|---|---|
| `NO_SESSION_OPTIMAL` | `"No session today — this keeps you fresh for what's ahead."` |

---

## Part 3 — Assembly Logic

### Selection Rules

```
function assembleExplanation(reasons: ReasonCode[]): string
```

1. **Collect** all applicable reason codes for the session (each decision point emits 0 or 1 codes).
2. **Sort** by priority tier: game proximity (1) → safety (2) → progression (3) → conditioning (4) → recovery (5).
3. **Deduplicate** within tiers: keep only the highest-signal code per tier. Dedup rules:
   - Safety tier: `SAFE_POST_OVERREACH` > `SAFE_INJURY` > `SAFE_RETURN` > `SAFE_DGW` > `SAFE_LOW_READINESS` > `SAFE_HIGH_RPE` > `SAFE_MISSED`
   - Progression tier: `PROG_DELOAD` > `PROG_OVERREACH` > `PROG_BUILD` > `PROG_MICRO_UP` > `PROG_HOLD` > `PROG_MAINTAIN`
   - Conditioning tier: any `COND_BLOCKED_*` > `COND_DELOAD` > `COND_BUILD` > `COND_HOLD` > `COND_PLACED` > `COND_LOAD_GUARD`
   - Recovery tier: `REC_PASSIVE` > `REC_ACTIVE` > `REC_EXTENDED` > `REC_PLACED` > `NO_SESSION_OPTIMAL` > `REC_FULL_REST`
4. **Tier 1 exclusivity**: If a game proximity code (tier 1) is present, **show only that reason** — do not append a second. Game proximity messages are self-explanatory and a second reason adds noise.
5. **Otherwise, select top 2** reason codes from the sorted, deduped list.
6. **Look up** templates, concatenate with a space. Output is 1–2 sentences.

### Worked Examples

**Example A — Monday, in-season, game on Saturday, high readiness, build state:**
- Reasons collected: `PROG_BUILD`
- Output: `"Stepped up from last week — you've earned a bit more load."`

**Example B — Thursday, game Friday, DGW:**
- Reasons collected: `GP_MINUS_1`, `SAFE_DGW`
- Tier 1 present → show only tier 1
- Output: `"Light arms and pump — game tomorrow."`

**Example C — Sunday, post-game, conditioning blocked:**
- Reasons collected: `GP_PLUS_1`, `COND_BLOCKED_GAME`
- Tier 1 present → show only tier 1
- Output: `"Recovery day — you played yesterday."`

**Example D — Wednesday, off-season, empty day, conditioning placed, build state:**
- Reasons collected: `COND_PLACED`, `COND_BUILD`
- Dedup conditioning tier: `COND_BUILD` wins over `COND_PLACED`
- Output: `"Conditioning stepped up — building on last week."`

**Example E — Rest day after all passes:**
- Reasons collected: `REC_FULL_REST`
- Output: `"Full rest — your body needs a proper reset today."`

**Example F — Low readiness + scheduled deload:**
- Reasons collected: `SAFE_LOW_READINESS`, `PROG_DELOAD`
- Top 2: `SAFE_LOW_READINESS` (tier 2), `PROG_DELOAD` (tier 3)
- Output: `"Pulling back — your body's asking for less today. Pulling back this week — time to recover and reload."`

**Example G — Empty day surrounded by training, no game proximity:**
- Reasons collected: `NO_SESSION_OPTIMAL`
- Output: `"No session today — this keeps you fresh for what's ahead."`

### Edge Cases

- **Manual override**: If `source === 'manual'`, emit no reason codes. The session was explicitly chosen by the user/coach — no explanation needed. Optionally: `"Session set manually."`
- **No reasons collected**: Should not happen (every session has a source), but fallback to empty string.
- **Game day**: `GP_GAME_DAY` alone. Output: `"Game day."`

---

## Part 4 — Integration Plan

### New File

`src/utils/sessionExplanation.ts`

Contains:
- `ReasonCode` type (string union of all codes above)
- `REASON_TEMPLATES` constant (Record<ReasonCode, string>)
- `TIER_PRIORITY` mapping (ReasonCode → 1–5)
- `assembleExplanation(reasons: ReasonCode[]): string`
- `collectReasonCodes(day: ResolvedDay, progressionResults, conditioningMeta): ReasonCode[]`

### Where It Gets Called

**Not inside the resolver.** The resolver remains pure scheduling. Explanation is a read-only projection layer on top of resolver output.

```
resolveWeekWithConditioning()  →  ResolvedDay[]
                                        ↓
                         explainSession(day)  →  string
```

Call site: wherever the UI renders a session card or detail view. The function reads:
- `day.source` (game, gameProximity, rest, conditioning, recovery, template, manual, none)
- `day.workout._progressionResults` (strength progression metadata, already attached)
- `day.workout._progressionState` (conditioning progression metadata, already attached)
- `day.workout._progressionNote` (conditioning progression note, already attached)
- Schedule state context passed alongside (seasonPhase, readiness, markedDays for DGW detection)

### ResolvedDay Extension

Add one optional field to `ResolvedDay`:

```typescript
export interface ResolvedDay {
  // ... existing fields ...
  /** Deterministic 1–2 sentence explanation of why this session was chosen. */
  explanation?: string;
}
```

Populated by a post-processing step after `resolveWeekWithConditioning()` returns, or lazily by the UI layer. The resolver itself does not need to change.

### What Metadata Is Already Available (No New Data Needed)

| Data | Where It Lives |
|---|---|
| Session source (game proximity, conditioning, recovery, etc.) | `ResolvedDay.source` |
| Strength progression state + note | `workout._progressionResults[exerciseName].state` |
| Conditioning progression state + note | `workout._progressionState`, `workout._progressionNote` |
| Recovery category | `workout.description` contains category string |
| DGW detection | Count games in markedDays for the week |
| Injury flag | `athleteContext.injuries` |
| Readiness | `ScheduleState.readiness` |
| Season phase | `ScheduleState.seasonPhase` |

All inputs already exist. The explanation system reads existing outputs — it produces nothing new, stores nothing, and has no side effects.
