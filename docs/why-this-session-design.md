# "Why This Session" — v1 Design

## 1. Intent Model

Six intents, derived entirely from `ResolvedDay.source` (the field the resolver already sets). No description parsing.

| Intent | Derived from | What the athlete needs to know |
|---|---|---|
| `programmed` | `source: 'template'` or `source: 'manual'` | This is your scheduled strength work |
| `game` | `source: 'game'` | It's game day |
| `game_adjusted` | `source: 'gameProximity'` | Something changed because of your game |
| `conditioning` | `source: 'conditioning'` | Fitness work placed in a gap |
| `recovery` | `source: 'recovery'` | Recovery placed in a gap |
| `rest` | `source: 'rest'` or `source: 'none'` | Nothing today — deliberate |

Why these six: each one maps 1:1 to a `source` value (or a pair of obviously-equivalent values). No inspection of `name`, `description`, or `workoutType` needed. The resolver already did the hard thinking — we just translate its decision into coaching language.

`game_adjusted` is intentionally one bucket. The athlete doesn't need to know the difference between G-1 arms, G-2 moderation, freed-slot prehab, or fatigue-guard prehab at the copy level. They need to know: "your game changed what's here today." The workout card already shows the session name and exercises — the explanation provides the *why*, not the *what*.

---

## 2. Copy Library

One headline, one body per intent. Voice: direct, calm, no jargon.

```typescript
const COPY: Record<SessionIntent, { headline: string; body: string }> = {
  programmed: {
    headline: 'Scheduled session',
    body: 'This is your programmed session for today. Loading and volume match your current training block.',
  },
  game: {
    headline: 'Game day',
    body: 'Everything this week has been structured around today. Trust your prep.',
  },
  game_adjusted: {
    headline: 'Adjusted for game week',
    body: 'This session was shaped by your game schedule. The type and intensity are set to keep you fresh where it counts.',
  },
  conditioning: {
    headline: 'Conditioning',
    body: 'Fitness work placed on a day your body can handle it without interfering with strength or games.',
  },
  recovery: {
    headline: 'Recovery',
    body: 'Light movement to help your body adapt. This is part of the program, not filler.',
  },
  rest: {
    headline: 'Rest day',
    body: 'Nothing scheduled. Recovery happens when you stop training.',
  },
};
```

---

## 3. Context Adjustments

Three modifiers. Each appends a single sentence to `body`. Applied in order, all three can stack (worst case: optional game-adjusted session 1 day out — all three apply, that's fine, it's three short sentences).

```typescript
const CONTEXT_SUFFIX: Record<string, string> = {
  gameTomorrow:
    'Game tomorrow — everything today should leave you feeling better, not more tired.',
  gameIn2Days:
    'Game in two days. Intensity is managed accordingly.',
  optional:
    'This session is optional. Skip it if you're carrying fatigue — the week still holds without it.',
};
```

**When they fire:**

| Modifier | Condition |
|---|---|
| `gameTomorrow` | `daysToGame === 1` and intent is NOT `game` |
| `gameIn2Days` | `daysToGame === 2` and intent is NOT `game` |
| `optional` | `workout.sessionTier === 'optional'` |

`daysToGame` is already computed in the resolver's recovery pass. Thread it through or recompute from `gameDates` — it's a trivial scan.

---

## 4. TypeScript Implementation

One file: `src/utils/sessionExplainer.ts`

```typescript
import type { ResolvedDay } from './sessionResolver';
import type { SessionTier } from '../types/domain';

// ─── Types ───

export type SessionIntent =
  | 'programmed'
  | 'game'
  | 'game_adjusted'
  | 'conditioning'
  | 'recovery'
  | 'rest';

export interface SessionExplanation {
  headline: string;
  body: string;
}

// ─── Copy Config ───

const COPY: Record<SessionIntent, { headline: string; body: string }> = {
  programmed: {
    headline: 'Scheduled session',
    body: 'This is your programmed session for today. Loading and volume match your current training block.',
  },
  game: {
    headline: 'Game day',
    body: 'Everything this week has been structured around today. Trust your prep.',
  },
  game_adjusted: {
    headline: 'Adjusted for game week',
    body: 'This session was shaped by your game schedule. The type and intensity are set to keep you fresh where it counts.',
  },
  conditioning: {
    headline: 'Conditioning',
    body: 'Fitness work placed on a day your body can handle it without interfering with strength or games.',
  },
  recovery: {
    headline: 'Recovery',
    body: 'Light movement to help your body adapt. This is part of the program, not filler.',
  },
  rest: {
    headline: 'Rest day',
    body: 'Nothing scheduled. Recovery happens when you stop training.',
  },
};

// ─── Intent Derivation ───

function deriveIntent(source: ResolvedDay['source']): SessionIntent {
  switch (source) {
    case 'template':
    case 'manual':
      return 'programmed';
    case 'game':
      return 'game';
    case 'gameProximity':
      return 'game_adjusted';
    case 'conditioning':
      return 'conditioning';
    case 'recovery':
      return 'recovery';
    case 'rest':
    case 'none':
      return 'rest';
    default:
      return 'rest';
  }
}

// ─── Public API ───

/**
 * Generate the "Why this session" explanation for a resolved day.
 *
 * Pure function. No side effects, no external state, no AI calls.
 *
 * @param day - The resolved day from the scheduling pipeline
 * @param daysToGame - Days until next game (null if no upcoming game). Already
 *   available from gameDates scan — caller computes it.
 */
export function explainSession(
  day: ResolvedDay,
  daysToGame: number | null,
): SessionExplanation {
  const intent = deriveIntent(day.source);
  const { headline, body: baseBody } = COPY[intent];

  const suffixes: string[] = [];

  // Context: game proximity (only if this isn't the game itself)
  if (intent !== 'game') {
    if (daysToGame === 1) {
      suffixes.push(
        'Game tomorrow \u2014 everything today should leave you feeling better, not more tired.'
      );
    } else if (daysToGame === 2) {
      suffixes.push('Game in two days. Intensity is managed accordingly.');
    }
  }

  // Context: optional session
  if (day.workout?.sessionTier === 'optional') {
    suffixes.push(
      "This session is optional. Skip it if you\u2019re carrying fatigue \u2014 the week still holds without it."
    );
  }

  const body = suffixes.length > 0
    ? baseBody + ' ' + suffixes.join(' ')
    : baseBody;

  return { headline, body };
}
```

That's it. One type, one config object, two functions (one private, one exported), ~80 lines.

**Caller usage** (in a hook or component):

```typescript
const explanation = explainSession(resolvedDay, daysToNextGame);
// → { headline: 'Adjusted for game week', body: 'This session was shaped by...' }
```

---

## 5. What to Defer to v2

| Feature | Why defer |
|---|---|
| Split `game_adjusted` into G+1 / G-1 / G-2 / freed-slot sub-intents | Only if athletes ask "but *which* game rule changed this?" — the session name already answers that |
| Date-hash variant rotation (multiple headlines/bodies per intent) | Only if the single copy feels stale after real usage |
| Conditioning sub-variants (sprint cue vs tempo cue vs Flog Friday) | Only if generic conditioning copy feels wrong for specific session types |
| Season phase framing ("Off-season focus: building base") | Only if athletes are confused about why conditioning exists |
| Low readiness softener | Readiness-aware copy is valuable but needs UX for surfacing readiness first |
| Bye week context | Nice-to-have, not correctness-critical |
| `_resolverHint` field on Workout | Only needed if v2 splits `game_adjusted` — avoids description parsing then |
| Per-intent cue (actionable callout) | Third copy layer adds UI complexity — ship headline + body first, see if athletes want more |
| Modifier cap logic | Not needed when there are only 3 simple suffixes that can stack cleanly |
