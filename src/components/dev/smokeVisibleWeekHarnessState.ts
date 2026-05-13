/**
 * Pure state-derivation for SmokeCoachBikeHarness.
 *
 * Extracted into its own module so the contract tests can require it
 * from sucrase-node WITHOUT pulling in react-native (which uses Flow
 * `import typeof` syntax that the test runner can't parse).
 *
 * Anything that depends on JSX or React belongs in
 * SmokeCoachBikeHarness.tsx; anything that's a pure
 * (input → state) function belongs here.
 */

import {
  SMOKE_WEDNESDAY_WORKOUT_NAME,
  SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY,
} from '../../data/smokeCoachBikeFlowProgram';

export type SmokeVisibleWeekHarnessState =
  | 'inactive'
  | 'pending'
  | 'ready'
  | 'missing';

export type SmokeVisibleWeekHarnessReason =
  | 'smoke-flow-not-active'
  | 'no-active-route-yet'
  | 'no-resolved-week-yet'
  | 'no-week-days-yet'
  | 'route-not-coach'
  | 'no-resolved-week'
  | 'no-wednesday-day'
  | 'wednesday-has-no-workout'
  | 'wednesday-not-easy-aerobic-flush'
  | 'no-rower-before-change'
  | 'ok';

export interface SmokeVisibleWeekHarnessResult {
  state: SmokeVisibleWeekHarnessState;
  reason: SmokeVisibleWeekHarnessReason;
  route: string | null;
  weekDump: string;
  wedText?: string;
  hasEasyAerobicFlush?: boolean;
  hasRower?: boolean;
}

export type SmokeWednesdayOpenTargetReason =
  | 'no-visible-week-data'
  | 'no-Wednesday-date-in-week'
  | 'Wednesday-day-has-no-workout'
  | 'Wednesday-not-easy-aerobic-flush'
  | 'DayWorkout-route-params-unavailable'
  | 'ok';

export interface SmokeWednesdayOpenTarget {
  date: string;
  workoutId: string;
  title: string;
}

export interface SmokeWednesdayOpenTargetResult {
  state: 'ready' | 'missing';
  reason: SmokeWednesdayOpenTargetReason;
  target: SmokeWednesdayOpenTarget | null;
  wedText: string;
  hasEasyAerobicFlush: boolean;
}

const EASY_AEROBIC_FLUSH_TOKEN = 'easy aerobic flush';
const ROWER_SMOKE_RE = /\b(rower|rowing|row)\b/i;

function appendSmokeText(parts: string[], value: any) {
  if (typeof value === 'string' && value.trim()) {
    parts.push(value.trim());
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    parts.push(String(value));
  }
}

function collectSmokeTextValues(value: any, parts: string[], seen = new Set<any>()) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number') {
    appendSmokeText(parts, value);
    return;
  }
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectSmokeTextValues(item, parts, seen));
    return;
  }
  Object.values(value).forEach((child) => collectSmokeTextValues(child, parts, seen));
}

export function normalizeSmokeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function compactSmokeText(text: string): string {
  const normalized = normalizeSmokeText(text);
  return normalized.length > 500 ? `${normalized.slice(0, 500)}...` : normalized;
}

export function collectWednesdaySmokeText(wedDay: any): string {
  if (!wedDay) return '';
  const parts: string[] = [];
  const workout = wedDay?.workout ?? wedDay;
  [
    wedDay?.title,
    wedDay?.name,
    wedDay?.label,
    wedDay?.type,
    wedDay?.category,
    wedDay?.workoutType,
    workout?.title,
    workout?.name,
    workout?.displayName,
    workout?.label,
    workout?.description,
    workout?.summary,
    workout?.type,
    workout?.category,
    workout?.workoutType,
    workout?.duration,
    workout?.durationText,
  ].forEach((value) => appendSmokeText(parts, value));
  (workout?.conditioningBlock?.options ?? workout?.options ?? []).forEach((opt: any) => {
    [
      opt?.title,
      opt?.name,
      opt?.label,
      opt?.description,
      opt?.summary,
      opt?.type,
      opt?.category,
      opt?.duration,
      opt?.durationText,
    ].forEach((value) => appendSmokeText(parts, value));
  });
  (workout?.exercises ?? []).forEach((wx: any) => {
    [
      wx?.title,
      wx?.name,
      wx?.description,
      wx?.notes,
      wx?.exercise?.title,
      wx?.exercise?.name,
      wx?.exercise?.description,
      wx?.exercise?.notes,
    ].forEach((value) => appendSmokeText(parts, value));
  });
  collectSmokeTextValues(workout?.coachNotes, parts);
  collectSmokeTextValues(workout?.blocks, parts);
  collectSmokeTextValues(workout?.sections, parts);
  collectSmokeTextValues(workout?.visibleFields, parts);
  return Array.from(new Set(parts)).join(' || ');
}

export function collectVisibleWedText(w: any): string {
  return collectWednesdaySmokeText({ workout: w });
}

export function formatWeekDump(weekDays: any): string {
  if (weekDays === undefined || weekDays === null) {
    return '(weekDays=undefined)';
  }
  if (!Array.isArray(weekDays)) {
    return `(weekDays=${typeof weekDays})`;
  }
  if (weekDays.length === 0) return '(weekDays=[])';
  return weekDays
    .map((d: any) => {
      const w = d?.workout;
      const type = w?.workoutType ?? w?.type ?? '-';
      const day = d?.short ?? `dow=${d?.dayOfWeek}`;
      return `${day}/${d?.date}=${w?.name ?? 'rest'}[${type}]`;
    })
    .join(', ');
}

/**
 * Post-coach DayWorkout open target. This intentionally does NOT check
 * for Rower: after the coach turns, the correct Wednesday visible workout
 * is Easy Aerobic Flush on Bike, and DayWorkout is the truth surface for
 * verifying the final no-rower/no-assault contract.
 */
export function deriveSmokeWednesdayOpenTarget(args: {
  weekDays: any;
}): SmokeWednesdayOpenTargetResult {
  const weekDays = args.weekDays;
  if (!Array.isArray(weekDays) || weekDays.length === 0) {
    return {
      state: 'missing',
      reason: 'no-visible-week-data',
      target: null,
      wedText: '',
      hasEasyAerobicFlush: false,
    };
  }

  const wed = weekDays.find((d: any) => d?.dayOfWeek === 3) ?? null;
  if (!wed) {
    return {
      state: 'missing',
      reason: 'no-Wednesday-date-in-week',
      target: null,
      wedText: '',
      hasEasyAerobicFlush: false,
    };
  }

  const workout = wed.workout;
  if (!workout) {
    return {
      state: 'missing',
      reason: 'Wednesday-day-has-no-workout',
      target: null,
      wedText: '',
      hasEasyAerobicFlush: false,
    };
  }

  const wedText = collectWednesdaySmokeText(wed);
  const haystack = normalizeSmokeText(wedText);
  const expectedWedName = normalizeSmokeText(SMOKE_WEDNESDAY_WORKOUT_NAME);
  const hasEasyAerobicFlush =
    haystack.includes(EASY_AEROBIC_FLUSH_TOKEN) ||
    (expectedWedName.length > 0 && haystack.includes(expectedWedName));
  const compactWedText = compactSmokeText(wedText);

  if (!hasEasyAerobicFlush) {
    return {
      state: 'missing',
      reason: 'Wednesday-not-easy-aerobic-flush',
      target: null,
      wedText: compactWedText,
      hasEasyAerobicFlush,
    };
  }

  if (!wed.date || !workout.id) {
    return {
      state: 'missing',
      reason: 'DayWorkout-route-params-unavailable',
      target: null,
      wedText: compactWedText,
      hasEasyAerobicFlush,
    };
  }

  return {
    state: 'ready',
    reason: 'ok',
    target: {
      date: String(wed.date),
      workoutId: String(workout.id),
      title: String(workout.name ?? workout.title ?? SMOKE_WEDNESDAY_WORKOUT_NAME),
    },
    wedText: compactWedText,
    hasEasyAerobicFlush,
  };
}

/**
 * Pure state machine. Input → exactly one of four states + a typed
 * reason + the resolved route + a compact week dump for diagnostics.
 *
 * The order of checks IS the priority order — earlier checks shadow
 * later ones. The harness's correctness invariant is that every input
 * shape produces a non-empty `state` value drawn from the closed enum.
 */
export function deriveSmokeVisibleWeekHarnessState(args: {
  smokeFlowActive: boolean;
  actualCurrentRoute: string | null;
  weekDays: any;
}): SmokeVisibleWeekHarnessResult {
  const route = args.actualCurrentRoute;
  const weekDump = formatWeekDump(args.weekDays);

  if (!args.smokeFlowActive) {
    return {
      state: 'inactive',
      reason: 'smoke-flow-not-active',
      route,
      weekDump,
    };
  }
  if (route === null) {
    return {
      state: 'pending',
      reason: 'no-active-route-yet',
      route,
      weekDump,
    };
  }
  if (args.weekDays === undefined || args.weekDays === null) {
    return {
      state: 'pending',
      reason: 'no-resolved-week-yet',
      route,
      weekDump,
    };
  }
  if (route !== 'Coach') {
    return {
      state: 'missing',
      reason: 'route-not-coach',
      route,
      weekDump,
    };
  }
  if (!Array.isArray(args.weekDays) || args.weekDays.length === 0) {
    return {
      state: 'missing',
      reason: 'no-resolved-week',
      route,
      weekDump,
    };
  }
  const wed = args.weekDays.find((d: any) => d?.dayOfWeek === 3) ?? null;
  if (!wed) {
    return {
      state: 'missing',
      reason: 'no-wednesday-day',
      route,
      weekDump,
    };
  }
  const workout = wed.workout;
  if (!workout) {
    return {
      state: 'missing',
      reason: 'wednesday-has-no-workout',
      route,
      weekDump,
    };
  }
  const wedText = collectWednesdaySmokeText(wed);
  const haystack = normalizeSmokeText(wedText);
  const expectedWedName = normalizeSmokeText(SMOKE_WEDNESDAY_WORKOUT_NAME);
  const hasEasyAerobicFlush =
    haystack.includes(EASY_AEROBIC_FLUSH_TOKEN) ||
    (expectedWedName.length > 0 && haystack.includes(expectedWedName));
  const hasRower =
    ROWER_SMOKE_RE.test(haystack) ||
    SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY.test(wedText);
  const compactWedText = compactSmokeText(wedText);

  if (!hasEasyAerobicFlush) {
    return {
      state: 'missing',
      reason: 'wednesday-not-easy-aerobic-flush',
      route,
      weekDump,
      wedText: compactWedText,
      hasEasyAerobicFlush,
      hasRower,
    };
  }
  if (!hasRower) {
    return {
      state: 'missing',
      reason: 'no-rower-before-change',
      route,
      weekDump,
      wedText: compactWedText,
      hasEasyAerobicFlush,
      hasRower,
    };
  }
  return {
    state: 'ready',
    reason: 'ok',
    route,
    weekDump,
    wedText: compactWedText,
    hasEasyAerobicFlush,
    hasRower,
  };
}
