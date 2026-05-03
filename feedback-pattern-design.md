# Feedback Pattern Recognition — Design Document

Pure helper layer. No AI. No NLP. No new stores. No backend. Deterministic only.

---

## 1. Pattern Summary Model

A single interface derived on-the-fly from recent `SessionFeedback` entries. Never persisted — computed at read time like session explanations.

```typescript
interface FeedbackPatternSummary {
  /** Number of feedback entries in the analysis window. */
  sampleSize: number;

  /** Feeling trend across the window. */
  fatigueTrend: 'rising' | 'stable' | 'falling';

  /** Completion trend across the window. */
  completionTrend: 'consistent' | 'declining' | 'sporadic';

  /** Whether the program difficulty seems well-calibrated. */
  progressionConfidence: 'under_challenged' | 'well_matched' | 'over_reached';

  /** Which specific pattern flags are active. */
  activeFlags: PatternFlag[];
}
```

**PatternFlag** — a string union. Each flag has a single clear detection rule and a single clear effect. No ambiguity.

```typescript
type PatternFlag =
  | 'FATIGUE_STREAK'        // 3+ of last 4 sessions: hard or very_hard
  | 'EASE_STREAK'           // 3+ of last 4 sessions: very_easy or easy
  | 'COMPLETION_DROP'       // 2+ of last 4 sessions: partial or skipped
  | 'COOKED_REPEAT'         // 2+ of last 3 sessions: very_hard
  | 'FULL_COMPLETION_RUN'   // last 4 sessions: all full completion
  | 'MIXED_SIGNALS';        // hard/very_hard feeling BUT full completion (gutting it out)
```

### Analysis Window

Fixed window: **last 4 sessions with recorded feedback**, ordered by date descending. Not calendar days — actual sessions where the athlete submitted feedback. If fewer than 3 entries exist, `sampleSize` is below threshold and the pattern layer returns `null` (no influence).

Minimum sample: **3 feedback entries**. Below this, the system has insufficient data and stays silent.

---

## 2. Detection Rules

All rules are pure boolean checks over the feedback window. No weighting, no scoring, no ML.

### FATIGUE_STREAK

```
Count entries where feeling is 'hard' or 'very_hard'.
If count >= 3 out of last 4 → flag active.
```

Interpretation: Athlete is accumulating fatigue faster than they're recovering. The program might be too aggressive, or external stressors are draining them.

### EASE_STREAK

```
Count entries where feeling is 'very_easy' or 'easy'.
If count >= 3 out of last 4 → flag active.
```

Interpretation: The athlete is under-stimulated. Loads are too conservative. The program should push harder.

### COMPLETION_DROP

```
Count entries where completion is 'partial' or 'skipped'.
If count >= 2 out of last 4 → flag active.
```

Interpretation: Athlete can't finish prescribed work. Could be fatigue, time constraints, or programming mismatch. System should reduce volume before the athlete disengages entirely.

### COOKED_REPEAT

```
Count entries where feeling is 'very_hard'.
If count >= 2 out of last 3 → flag active.
```

Interpretation: More urgent than FATIGUE_STREAK. Back-to-back "cooked" sessions suggest the athlete is in or approaching an overreach state that wasn't triggered by the scheduled overreach mechanism.

### FULL_COMPLETION_RUN

```
All entries in the window have completion === 'full'.
AND sampleSize >= 4.
```

Interpretation: Athlete is consistently completing all prescribed work. Combined with feeling data, this signals whether to maintain or push.

### MIXED_SIGNALS

```
Most recent session has feeling 'hard' or 'very_hard'
AND completion 'full'.
AND at least 2 of last 4 share this pattern.
```

Interpretation: The athlete is "gutting it out" — finishing everything but reporting that it's beating them up. This is a warning sign the progression engine might miss because completion quality looks fine.

### Derived Fields

**fatigueTrend** — derived from feeling distribution:

```
feelings = last 4 entries mapped to numeric:
  very_easy = 1, easy = 2, good = 3, hard = 4, very_hard = 5

If average >= 4.0 → 'rising'
If average <= 2.0 → 'falling'
Else → 'stable'
```

**completionTrend** — derived from completion distribution:

```
fullCount = entries with completion === 'full'

If fullCount === sampleSize → 'consistent'
If fullCount <= sampleSize / 2 → 'declining'
Else → 'sporadic'
```

**progressionConfidence** — combined assessment:

```
If EASE_STREAK active AND FULL_COMPLETION_RUN active → 'under_challenged'
If COOKED_REPEAT active OR (FATIGUE_STREAK AND COMPLETION_DROP) → 'over_reached'
Else → 'well_matched'
```

---

## 3. Influence Rules

The pattern layer produces **biases**, not overrides. These biases feed into existing context fields that the progression/conditioning/recovery engines already read. The engines don't know or care where the values came from — they just see the same inputs they always have.

### 3.1 Strength Progression Influence

The pattern layer modifies fields on `StrengthProgressionContext` before it reaches `resolveProgression()`.

| Flag | Field Modified | Effect |
|---|---|---|
| FATIGUE_STREAK | `readiness` | Downgrade by one tier: high→medium, medium→low |
| COOKED_REPEAT | `sessionFeeling` | Force to `'Cooked'` (triggers soft deload when combined with other signals) |
| EASE_STREAK + FULL_COMPLETION_RUN | `consecutiveBuildWeeks` | Add +1 (makes build/overreach more likely) |
| COMPLETION_DROP | `missedSessionsThisWeek` | Add +1 (contributes to soft deload signal count) |
| MIXED_SIGNALS | `readiness` | Downgrade by one tier (same as FATIGUE_STREAK — the athlete is hiding fatigue behind completion) |

**Mechanism:** A single function `applyPatternBiases(ctx, summary)` that mutates a copy of `StrengthProgressionContext` and returns it. Called in `buildProgressionContext()` after all other fields are set, before the context is returned.

```typescript
function applyPatternBiases(
  ctx: StrengthProgressionContext,
  summary: FeedbackPatternSummary | null,
): StrengthProgressionContext {
  if (!summary) return ctx;
  const biased = { ...ctx };
  // ... apply flag-based modifications
  return biased;
}
```

### 3.2 Conditioning Progression Influence

The pattern layer modifies the `readiness` and `WeekLog` fields that conditioning already reads.

| Flag | Effect on Conditioning |
|---|---|
| FATIGUE_STREAK | Readiness downgrade → conditioning caps tighten (B-low + C only when readiness = low) |
| COOKED_REPEAT | Same as FATIGUE_STREAK but stronger signal — if readiness was already low, no additional change (floor) |
| EASE_STREAK + FULL_COMPLETION_RUN | No direct conditioning change — conditioning is already volume-controlled by caps. The strength system pushing harder is sufficient. |
| COMPLETION_DROP | Readiness downgrade → conditioning tier selection becomes more conservative |

**Mechanism:** The pattern summary biases `readiness` on the `ScheduleState` before the conditioning pass runs. Same `readiness` field, same downstream logic. No new conditioning inputs.

### 3.3 Recovery Placement Influence

Recovery already selects category based on `readiness`:

- low → passive
- medium → active
- high → extended

The pattern layer's readiness downgrade naturally shifts recovery toward more passive categories. No direct recovery changes needed.

One addition: if `COOKED_REPEAT` is active and there is at least one empty day in the week with no session, the recovery resolver should prefer `null` (full rest) over placing a recovery session. This is implemented as a **pre-check** before calling `resolveRecovery()`:

```typescript
if (summary?.activeFlags.includes('COOKED_REPEAT') && weekRecoveryCount >= 1) {
  // Already have at least one recovery session. Additional empty days → full rest.
  return null; // skip recovery, let them rest
}
```

This means: "If the athlete has reported being smashed twice recently and they've already had one recovery session this week, don't fill more empty slots — give them actual rest."

---

## 4. Hard Boundaries (Untouchable)

The pattern layer MUST NOT override or bypass:

| Rule | Why |
|---|---|
| Game proximity (G-1, G-2, G+1) | Physical safety and match readiness are non-negotiable |
| Injury rules (avoid flag, lower-limb blocks) | Medical safety |
| Hard deload triggers (post-overreach, DGW, injury) | These are emergency overrides — pattern data is slower-reacting |
| Conditioning placement caps (48h buffer, stacking guard) | Game proximity and structural constraints |
| Conditioning in-season Tier A block | Season-level safety rule |
| Return-to-training gate (weeksOffTraining >= 2) | Ramp protocol is mandatory regardless of past feedback |

**Implementation:** The pattern layer runs AFTER hard rules have been applied to context but BEFORE the context reaches the priority chain in `resolveProgression()`. Hard rules in steps 1-5 of the chain still fire first and override everything.

The only fields the pattern layer touches — `readiness`, `sessionFeeling`, `missedSessionsThisWeek`, `consecutiveBuildWeeks` — are all consumed AFTER the hard deload triggers (steps 1-3) have already been evaluated. Pattern biases can contribute to soft deload (step 3) and influence the season/readiness matrix (step 6), but they cannot bypass hard deloads or game proximity.

---

## 5. Implementation Approach

### New File

```
src/utils/feedbackPatterns.ts
```

Pure functions. No React. No Zustand. No side effects. Same conventions as `progressionHelpers.ts`.

### Exports

```typescript
// Types
export type PatternFlag = ...;
export interface FeedbackPatternSummary { ... }

// Main API
export function analyzeFeedbackPatterns(
  recentFeedback: SessionFeedback[],  // newest first, from store
): FeedbackPatternSummary | null;       // null if insufficient data

// Bias applicator
export function applyPatternBiases(
  ctx: StrengthProgressionContext,
  summary: FeedbackPatternSummary | null,
): StrengthProgressionContext;
```

### Integration Points

**1. `buildProgressionContext()` in `strengthProgressionIntegration.ts`:**

Currently returns context directly. After the pattern layer is implemented:

```typescript
// At the end of buildProgressionContext():
const feedbackEntries = ... // passed in as new parameter
const summary = analyzeFeedbackPatterns(feedbackEntries);
return applyPatternBiases(ctx, summary);
```

`buildProgressionContext()` gains one new parameter: `recentFeedback: SessionFeedback[]` (default `[]`).

**2. Resolver call site in `sessionResolver.ts`:**

The resolver already reads `state.sessionFeedback`. Instead of only extracting the most recent feeling, it passes the last N entries:

```typescript
// Replace single-feeling extraction with:
const allFeedback = Object.values(state.sessionFeedback || {})
  .filter(fb => fb.dateStr < day.date)
  .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
  .slice(0, 4);  // analysis window

const progressionCtx = buildProgressionContext(
  ...,
  allFeedback,  // new parameter
);
```

**3. Conditioning readiness bias:**

Applied in `resolveWeekWithConditioning()` before the conditioning pass, using the same `analyzeFeedbackPatterns()` call:

```typescript
const summary = analyzeFeedbackPatterns(allFeedback);
const biasedReadiness = summary?.activeFlags.includes('FATIGUE_STREAK')
  || summary?.activeFlags.includes('COOKED_REPEAT')
  ? downgradeReadiness(state.readiness)
  : state.readiness;
```

**4. Recovery rest-preference:**

Applied in the recovery pass (Pass 3), as a pre-check before `resolveRecovery()` is called.

### Session Explanation Integration

Three new reason codes for the explanation system:

```typescript
| 'PATTERN_FATIGUE'     // "Recent sessions have been tough — backing off a bit."
| 'PATTERN_EASE'        // "You've been cruising — time to push a little more."
| 'PATTERN_COMPLETION'  // "You've been cutting sessions short — reducing the load to help you finish."
```

Priority tier: **3** (same as progression codes). These codes are detected by checking `summary.activeFlags` in `collectReasonCodes()`.

### No New Stores

The pattern layer reads from the existing `sessionFeedback: Record<string, SessionFeedback>` in `programStore`. It computes on the fly, returns a summary, and discards it. Nothing is persisted.

### No Schema Changes

`SessionFeedback` stays exactly as-is. `StrengthProgressionContext` stays exactly as-is. The pattern layer only reads existing types and writes to existing context fields.

### Test File

```
src/__tests__/feedbackPatternTests.js
```

Sections:
1. Insufficient data (< 3 entries → null)
2. FATIGUE_STREAK detection (boundary: 2/4 = no, 3/4 = yes)
3. EASE_STREAK detection
4. COMPLETION_DROP detection
5. COOKED_REPEAT detection (2/3 boundary)
6. FULL_COMPLETION_RUN detection
7. MIXED_SIGNALS detection
8. fatigueTrend derivation (average thresholds)
9. completionTrend derivation
10. progressionConfidence derivation
11. applyPatternBiases — readiness downgrade
12. applyPatternBiases — sessionFeeling override
13. applyPatternBiases — consecutiveBuildWeeks boost
14. applyPatternBiases — hard boundaries not bypassed (verify deload/injury/game proximity still fire after biases)
15. Integration with buildProgressionContext (end-to-end)
