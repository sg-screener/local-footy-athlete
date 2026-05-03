# Session Resolution Architecture — Final Design

## Core Principle

**Automatic schedule adjustments are DERIVED, not stored.**

When a game moves from Saturday to Sunday, the resolver computes G+1 recovery, G-1 load reduction, etc. at read time from source truth. No persisted cache of "what blockAdjuster computed last time."

`dateOverrides` is renamed to `manualOverrides` and reserved exclusively for explicit human edits — a user swapping exercises, a coach overriding a session. Everything else is derived.

---

## What Changes From Today

### Current Flow (store-then-read)

```
User marks game on Calendar
  → calendarStore.setGameDay('2026-04-11')
  → blockAdjuster.recomputeWeekOverrides(...)
  → programStore.replaceOverridesForDates(...)   ← WRITES derived data to store
  → screens read dateOverrides + markedDays + template
```

**Problems:**
- dateOverrides can go stale if recompute isn't triggered
- Persisted derived state creates a second hidden program
- Three screens implement their own read pipeline
- Tab freezing caused stale reads from the override cache

### New Flow (derive-on-read)

```
User marks game on Calendar
  → calendarStore.setGameDay('2026-04-11')
  → done. No further writes needed.

Any screen renders
  → useSchedule hook reads raw state (template + marks + manualOverrides)
  → calls resolveDate() which:
      1. checks manualOverrides[date] → return if exists
      2. checks calendar marks → game day? rest day?
      3. computes game proximity (G+1, G-1, G-2) from ALL game dates
      4. returns template (possibly modified by proximity rules)
  → screen renders resolved output
```

**Benefits:**
- No stale override cache
- Game-day handler becomes a one-liner (just update calendarStore)
- Every screen always sees the same truth
- blockAdjuster.ts scheduling logic moves into the resolver — one location

---

## Layer 1 — Persisted State

### programStore

```typescript
interface ProgramState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;

  // ONLY for explicit human/coach edits. Not for automatic game adjustments.
  // Key: ISO date 'YYYY-MM-DD', Value: manually-authored Workout
  manualOverrides: Record<string, Workout>;

  // UI state (not relevant to resolution)
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentProgram: (program: TrainingProgram | null) => void;
  setCurrentMicrocycle: (microcycle: Microcycle | null) => void;
  setManualOverride: (date: string, workout: Workout) => void;
  removeManualOverride: (date: string) => void;
  clearManualOverrides: () => void;
  addExerciseToWorkout: (workoutId: string, exercise: WorkoutExercise) => void;
}
```

**What's removed:**
- `dateOverrides` → renamed to `manualOverrides`, never written by automatic logic
- `todayWorkout` → derivable via `resolveDate(today, state)`
- `replaceOverridesForDates()` → no longer needed (automatic adjustments are derived)
- `resetDateOverrides()` → replaced by `clearManualOverrides()`

### calendarStore

Unchanged. Already clean.

```typescript
interface CalendarState {
  markedDays: Record<string, CalendarDayType>;  // 'game' | 'rest'
  selectedDate: string | null;
  // actions...
}
```

### What IS the source of truth?

| Data | Source | Persisted? |
|---|---|---|
| Block structure (dates, workouts by dayOfWeek) | `currentProgram` + `currentMicrocycle` | Yes |
| Game days and rest days | `calendarStore.markedDays` | Yes |
| Manual workout swaps | `programStore.manualOverrides` | Yes |
| G+1 recovery, G-1 reduction, G-2 moderation | **Derived by resolver** | **No** |
| Calendar dot indicators | **Derived by resolver** | **No** |
| "What workout is on Thursday?" | **Derived by resolver** | **No** |

---

## Layer 2 — Pure Resolver (`src/utils/sessionResolver.ts`)

Zero React. Zero Zustand. Pure functions only.

### Input Type

```typescript
import type { Workout, Microcycle, TrainingProgram, CalendarDayType } from '../types/domain';

export interface ScheduleState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  manualOverrides: Record<string, Workout>;
  markedDays: Record<string, CalendarDayType>;
}
```

### Output Type

```typescript
export interface ResolvedDay {
  date: string;               // YYYY-MM-DD
  dayOfWeek: number;          // 0=Sun..6=Sat
  short: string;              // MON, TUE, etc.
  isToday: boolean;
  workout: Workout | null;
  source:
    | 'manual'          // from manualOverrides
    | 'game'            // calendar mark → game stub
    | 'rest'            // calendar mark → rest
    | 'gameProximity'   // template modified by G+1/G-1/G-2 rules
    | 'template'        // unmodified template workout
    | 'none';           // no workout (out of block or rest day)
  indicator: 'core' | 'optional' | 'recovery' | 'game' | 'rest' | null;
}
```

### Core Function: `resolveDate()`

This is the single source of truth. Every other function calls it.

```typescript
export function resolveDate(date: string, state: ScheduleState): ResolvedDay {
  const { currentProgram, currentMicrocycle, manualOverrides, markedDays } = state;
  const dow = dateToDayOfWeek(date);
  const today = formatDate(new Date());
  const inBlock = isInBlock(date, currentProgram);

  // ── Priority 1: Manual override (human/coach authored) ──
  if (manualOverrides[date]) {
    return buildDay(date, dow, today, manualOverrides[date], 'manual');
  }

  // ── Priority 2: Calendar marks (game / rest) ──
  const mark = markedDays[date];
  if (mark === 'rest') {
    return buildDay(date, dow, today, null, 'rest');
  }
  if (mark === 'game') {
    return buildDay(date, dow, today, createGameStub(date, dow), 'game');
  }

  // ── Priority 3: Template + game proximity rules ──
  if (!inBlock || !currentMicrocycle) {
    return buildDay(date, dow, today, null, 'none');
  }

  const templateWorkout = currentMicrocycle.workouts.find(w => w.dayOfWeek === dow) || null;

  // Check game proximity — does a nearby game modify this session?
  const allGameDates = getAllGameDates(markedDays);
  const proximityResult = applyGameProximity(date, templateWorkout, allGameDates, currentMicrocycle);

  if (proximityResult) {
    return buildDay(date, dow, today, proximityResult, 'gameProximity');
  }

  // ── Priority 4: Unmodified template ──
  return buildDay(date, dow, today, templateWorkout, templateWorkout ? 'template' : 'none');
}
```

### Game Proximity Rules (moved from blockAdjuster)

```typescript
function applyGameProximity(
  date: string,
  templateWorkout: Workout | null,
  gameDates: string[],
  microcycle: Microcycle,
): Workout | null {
  if (!templateWorkout) return null;

  const gameDateSet = new Set(gameDates);

  // G+1: day after a game → recovery
  if (gameDateSet.has(shiftDate(date, -1))) {
    if (templateWorkout.sessionTier !== 'recovery' && templateWorkout.workoutType !== 'Game') {
      return createRecoveryWorkout(date, microcycle.id, 'Post-game recovery');
    }
  }

  // G-1: day before a game → demote heavy lower/compound
  if (gameDateSet.has(shiftDate(date, 1))) {
    if (templateWorkout.sessionTier === 'core' && isLowerOrHeavy(templateWorkout)) {
      return {
        ...templateWorkout,
        id: `proximity-preGame-${date}`,
        sessionTier: 'optional',
        intensity: 'Light',
        description: `${templateWorkout.description} (pre-game — reduced load)`,
        exercises: [...templateWorkout.exercises],
      };
    }
  }

  // G-2: 2 days before a game → moderate lower-dominant
  if (gameDateSet.has(shiftDate(date, 2))) {
    if (isLowerDominant(templateWorkout) && templateWorkout.sessionTier === 'core') {
      return {
        ...templateWorkout,
        id: `proximity-nearGame-${date}`,
        intensity: 'Moderate',
        description: `${templateWorkout.description} (48h to game — moderate load)`,
        exercises: [...templateWorkout.exercises],
      };
    }
  }

  return null;  // no proximity effect
}
```

### Wrapper Functions

```typescript
/** Resolve 7 days (Mon→Sun) for the week starting at mondayStr. */
export function resolveWeek(mondayStr: string, state: ScheduleState): ResolvedDay[] {
  const days: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(resolveDate(addDays(mondayStr, i), state));
  }
  return days;
}

/** Resolve indicator for every date in a month. Used by Calendar grid. */
export function resolveMonthIndicators(
  year: number,
  month: number,
  state: ScheduleState,
): Record<string, ResolvedDay['indicator']> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: Record<string, ResolvedDay['indicator']> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateString(year, month, d);
    result[dateStr] = resolveDate(dateStr, state).indicator;
  }
  return result;
}

/** Block bounds helper. */
export function getBlockBounds(state: ScheduleState): {
  startDate: string | null;
  endDate: string | null;
  nextBlockDate: string | null;
} { ... }
```

---

## Layer 3 — Shared Hooks (`src/hooks/useSchedule.ts`)

Thin wrappers. Read stores → call resolvers → return results.

```typescript
import { useState, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { resolveDate, resolveWeek, resolveMonthIndicators, getBlockBounds } from '../utils/sessionResolver';
import type { ScheduleState, ResolvedDay } from '../utils/sessionResolver';

/** Read raw state from both stores. Individual selectors for reactivity. */
function useScheduleState(): ScheduleState {
  return {
    currentProgram: useProgramStore((s) => s.currentProgram),
    currentMicrocycle: useProgramStore((s) => s.currentMicrocycle),
    manualOverrides: useProgramStore((s) => s.manualOverrides),
    markedDays: useCalendarStore((s) => s.markedDays),
  };
}

/** Single date resolution. Used by DayWorkoutScreen. */
export function useResolvedDay(date: string | undefined): ResolvedDay | null {
  const state = useScheduleState();
  if (!date) return null;
  return resolveDate(date, state);
}

/** Navigable week resolution. Used by Program tab. */
export function useResolvedWeek() {
  const state = useScheduleState();
  useIsFocused();  // subscribe to focus changes to force re-render on tab switch
  const [weekOffset, setWeekOffset] = useState(0);

  const mondayStr = getMondayStr(weekOffset);
  const weekDays = resolveWeek(mondayStr, state);
  const weekLabel = formatWeekLabel(mondayStr);
  const isThisWeek = weekOffset === 0;

  const goToPrev = useCallback(() => setWeekOffset(o => o - 1), []);
  const goToNext = useCallback(() => setWeekOffset(o => o + 1), []);
  const goToThisWeek = useCallback(() => setWeekOffset(0), []);

  return { weekDays, weekLabel, weekOffset, isThisWeek, goToPrev, goToNext, goToThisWeek };
}

/** Month indicators. Used by Calendar grid. */
export function useMonthIndicators(year: number, month: number) {
  const state = useScheduleState();
  return resolveMonthIndicators(year, month, state);
}

/** Block bounds. Used by Calendar info card. */
export function useBlockBounds() {
  const state = useScheduleState();
  return getBlockBounds(state);
}
```

---

## Layer 4 — Screens (render only)

### HomeScreen.tsx (Program tab)

```typescript
import { useResolvedWeek } from '../../hooks/useSchedule';

export default function HomeScreen() {
  const { weekDays, weekLabel, goToPrev, goToNext, ... } = useResolvedWeek();
  // render week nav + day rows — zero resolution logic
}
```

### DayWorkoutScreen.tsx

```typescript
import { useResolvedDay } from '../../hooks/useSchedule';

export const DayWorkoutScreen = () => {
  const date = route.params?.date;
  const resolved = useResolvedDay(date);
  const workout = resolved?.workout;
  // render workout details — zero resolution logic
}
```

### CalendarScreen.tsx

```typescript
import { useMonthIndicators, useBlockBounds } from '../../hooks/useSchedule';

export default function CalendarScreen() {
  const indicators = useMonthIndicators(year, month);
  const bounds = useBlockBounds();

  // Game-day handlers become simple:
  const handleSetGameDay = () => {
    setGameDay(selectedDate);
    closeModal();
    // That's it. No recomputeAffectedWeek(). No replaceOverridesForDates().
    // The resolver will derive everything on next render.
  };
}
```

---

## How blockAdjuster Logic Maps Into the Resolver

| blockAdjuster function | New location | Change |
|---|---|---|
| `computeGameProximityOverride()` | `sessionResolver.applyGameProximity()` | Same logic, called at read time instead of write time |
| `createRecoveryWorkout()` | `sessionResolver.createRecoveryWorkout()` | Moved as-is |
| `createOptionalWorkout()` | `sessionResolver.createOptionalWorkout()` | Moved as-is |
| `isLowerDominant()`, `isLowerOrHeavy()` | `sessionResolver` (private helpers) | Moved as-is |
| `recomputeWeekOverrides()` | **Deleted** | No longer needed — resolver derives everything |
| `replaceOverridesForDates()` | **Deleted from programStore** | No longer needed |
| `isDateInBlock()` | `sessionResolver.isInBlock()` | Moved as-is |
| `getAffectedWeekDates()` | **Deleted** | No longer needed (no write-time computation) |
| `getWeekDates()` | **Deleted** | No longer needed |
| Game stub for template-game + removed-mark (Case C) | `resolveDate()` handles naturally | Template says game, no calendar mark → template shows through as game (or falls through to proximity check) |

### The tricky Case C

Today's blockAdjuster handles: "template says Game on Saturday, but user removed the game mark → override with an Optional session."

In the new resolver, this is handled naturally:
1. `markedDays['2026-04-11']` is undefined (user removed game)
2. No manual override exists
3. Template has a Game workout for Saturday (dayOfWeek=6)
4. `resolveDate()` reaches Priority 4 (template) → returns the template Game workout

**Wait — this is wrong.** If the user removed a game from a day that the AI template originally scheduled as a game, we should NOT show a game. The template's game-day placement is based on the original onboarding `gameDay` field. If the user's calendar says "no game here anymore," we need to respect that.

**Resolution:** Add a rule between Priority 2 and Priority 3:

```typescript
// ── Priority 2.5: Template says game but calendar doesn't ──
// If the template scheduled this as a game day but the user hasn't marked it
// as a game in the calendar, replace with a useful session.
if (templateWorkout?.workoutType === 'Game' && !mark) {
  return buildDay(date, dow, today, createOptionalWorkout(date, microcycleId, 'Freed game slot'), 'gameProximity');
}
```

This is exactly what blockAdjuster's Case C does today, but now it lives in the resolver.

---

## Migration Plan (6 steps, test after each)

### Step 1: Create `sessionResolver.ts`
- New file `src/utils/sessionResolver.ts`
- Implement `resolveDate()`, `resolveWeek()`, `resolveMonthIndicators()`, `getBlockBounds()`
- Move `createRecoveryWorkout()`, `createOptionalWorkout()`, `isLowerDominant()`, `isLowerOrHeavy()`, `applyGameProximity()` from blockAdjuster
- Export `ScheduleState` and `ResolvedDay` types
- **Test:** Write a simple unit test that calls `resolveDate()` with mock state and verifies game proximity, manual override priority, etc.
- **Nothing else changes yet.**

### Step 2: Create `useSchedule.ts`
- New file `src/hooks/useSchedule.ts`
- Implement `useScheduleState()`, `useResolvedDay()`, `useResolvedWeek()`, `useMonthIndicators()`, `useBlockBounds()`
- These all call `sessionResolver` functions
- **Nothing else changes yet.** Old hooks and screen logic still work.

### Step 3: Migrate Program tab
- `HomeScreen.tsx` imports `useResolvedWeek` from `useSchedule.ts` (change one import path)
- Verify Program tab shows correct data including game proximity effects
- **Delete** old `src/hooks/useResolvedWeek.ts`

### Step 4: Migrate DayWorkoutScreen
- Import `useResolvedDay` from `useSchedule.ts`
- Remove inline `useResolvedWorkout()` function
- Screen now just reads `resolved.workout`

### Step 5: Migrate Calendar tab
- Replace `useSessionMap()` with `useMonthIndicators()` from `useSchedule.ts`
- Replace `useProgramBounds()` with `useBlockBounds()` from `useSchedule.ts`
- **Simplify game-day handlers:** Remove `recomputeAffectedWeek()` and `replaceOverridesForDates()` calls. Handler becomes just `setGameDay(date); closeModal();`
- Remove `useSessionMap` and `useProgramBounds` functions from CalendarScreen.tsx
- Remove `blockAdjuster` import from CalendarScreen.tsx

### Step 6: Clean up stores
- Rename `dateOverrides` → `manualOverrides` in programStore
- Remove `replaceOverridesForDates()` action
- Remove `resetDateOverrides()` → replace with `clearManualOverrides()`
- Remove `todayWorkout` from programStore
- **Retire** `src/utils/blockAdjuster.ts` (move any remaining helpers to sessionResolver, delete the file)
- Remove `useProgram.ts` → `getTodayWorkout()` (derivable)
- Write AsyncStorage migration to rename persisted key if needed (or just wipe overrides on upgrade — they're all automatic anyway)

---

## Performance Note

`resolveDate()` does a few map lookups and one `Set.has()` check per game proximity rule. For 7 days (Program tab), that's ~21 set lookups. For 31 days (Calendar), ~93 set lookups. Trivially fast — no memoization needed.

The `getAllGameDates()` call creates a `Set` from `markedDays` on each render. For the expected number of game dates (20-30 per season), this is negligible. If it ever becomes a concern, `useScheduleState()` could memoize the set.

---

## Rules Going Forward

1. **One pipeline, one function.** `resolveDate()` in `sessionResolver.ts` is the single authority.
2. **Stores hold intent only.** Template (AI), marks (user), manual overrides (user/coach). Nothing derived.
3. **Automatic adjustments are computed, not stored.** Game proximity lives in the resolver.
4. **Hooks are thin.** Read stores + call resolvers. No logic.
5. **Screens are thinner.** Call hooks + render. No resolution, no store reads for training data.
6. **No `useMemo` for schedule data.** Derive on every render. Memos cause staleness.
7. **Individual Zustand selectors always.** Never `useStore()` without a selector.
8. **Game-day handlers just update calendarStore.** No secondary write step. The resolver handles everything.

---

## File Structure After Refactor

```
src/
├── utils/
│   ├── sessionResolver.ts    ← NEW: pure resolver functions, all scheduling rules
│   ├── coachingEngine.ts     ← existing, unchanged
│   └── blockAdjuster.ts      ← DELETED (logic absorbed by sessionResolver)
├── hooks/
│   ├── useSchedule.ts        ← NEW: shared hooks for all screens
│   ├── useProgram.ts         ← existing, remove getTodayWorkout
│   └── ...
├── store/
│   ├── programStore.ts       ← rename dateOverrides → manualOverrides, remove todayWorkout
│   ├── calendarStore.ts      ← unchanged
│   └── ...
├── screens/
│   ├── home/
│   │   ├── HomeScreen.tsx     ← thin: useResolvedWeek() only
│   │   └── DayWorkoutScreen.tsx ← thin: useResolvedDay() only
│   └── calendar/
│       └── CalendarScreen.tsx ← thin: useMonthIndicators() + useBlockBounds()
```
