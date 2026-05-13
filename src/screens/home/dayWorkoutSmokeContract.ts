export type DayWorkoutSmokeContractState = 'ready' | 'failed';

export type DayWorkoutSmokeContractReason =
  | 'ok'
  | 'missing-workout-data'
  | 'contract-error'
  | 'missing-title-token'
  | 'missing-bike-token'
  | 'missing-20min-token'
  | 'missing-easy-intensity-token'
  | 'forbidden-token-present';

export interface DayWorkoutSmokeContractResult {
  state: DayWorkoutSmokeContractState;
  reason: DayWorkoutSmokeContractReason;
  title: string;
  text: string;
  hasEasyAerobicFlush: boolean;
  hasBike: boolean;
  has20min: boolean;
  hasEasyIntensity: boolean;
  forbiddenTokens: string[];
  routeParams: string;
  label: string;
}

const REQUIRED_TITLE_RE = /\beasy\s+aerobic\s+flush\b/i;
const BIKE_RE = /\bbike\b/i;
const TWENTY_MIN_RE = /\b20\s*min\b/i;
const EASY_INTENSITY_RE = /\beasy\b|3\s*[-–]\s*4\s*\/\s*10/i;
const FORBIDDEN_TOKENS = [
  'Rower',
  'Rowing',
  'Assault',
  'Assault Bike Intervals',
  '[Swapped to bike]',
];

function appendSmokeText(parts: string[], value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    parts.push(value.trim());
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    parts.push(String(value));
  }
}

// Keys whose values are internal identifiers, not user-visible text.
// Template exercise IDs (e.g. "ex-easy-aerobic-flush-rower") keep the
// original modality token even after a preference rewrite — including
// them in the smoke text would false-positive the forbidden-token check.
const SKIP_KEYS = new Set([
  'id',
  'exerciseId',
  'workoutId',
  'templateId',
  'conditioningOptionId',
  'blockId',
  'sectionId',
]);

function collectSmokeText(
  value: unknown,
  parts: string[],
  seen = new Set<unknown>(),
  _key?: string,
) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number') {
    appendSmokeText(parts, value);
    return;
  }
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectSmokeText(item, parts, seen));
    return;
  }
  for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
    if (SKIP_KEYS.has(k)) continue;
    collectSmokeText(child, parts, seen, k);
  }
}

export function compactDayWorkoutSmokeText(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 700 ? `${compact.slice(0, 700)}...` : compact;
}

export function collectDayWorkoutSmokeText(workout: any): string {
  if (!workout) return '';
  const parts: string[] = [];
  [
    workout?.name,
    workout?.title,
    workout?.workoutType,
    workout?.type,
    workout?.category,
    workout?.description,
    workout?.summary,
    workout?.notes,
    workout?.duration,
    workout?.durationText,
  ].forEach((value) => appendSmokeText(parts, value));
  collectSmokeText(workout?.conditioningBlock, parts);
  collectSmokeText(workout?.options, parts);
  collectSmokeText(workout?.exercises, parts);
  collectSmokeText(workout?.coachNotes, parts);
  collectSmokeText(workout?.blocks, parts);
  collectSmokeText(workout?.sections, parts);
  collectSmokeText(workout?.visibleFields, parts);
  return Array.from(new Set(parts)).join(' || ');
}

function buildLabel(args: {
  state: DayWorkoutSmokeContractState;
  reason: DayWorkoutSmokeContractReason;
  title: string;
  text: string;
  hasEasyAerobicFlush: boolean;
  hasBike: boolean;
  has20min: boolean;
  hasEasyIntensity: boolean;
  forbiddenTokens: string[];
  routeParams: string;
}): string {
  return (
    `state=${args.state} reason=${args.reason} title=${args.title} ` +
    `text=${args.text || '(empty)'} ` +
    `hasEasyAerobicFlush=${args.hasEasyAerobicFlush} hasBike=${args.hasBike} ` +
    `has20min=${args.has20min} hasEasyIntensity=${args.hasEasyIntensity} ` +
    `forbiddenTokens=${args.forbiddenTokens.length > 0 ? args.forbiddenTokens.join(',') : 'none'} ` +
    `routeParams=${args.routeParams}`
  );
}

export function deriveDayWorkoutSmokeContract(args: {
  workout: any;
  date?: string | null;
  workoutId?: string | null;
}): DayWorkoutSmokeContractResult {
  const routeParams = `date=${args.date ?? 'null'} workoutId=${args.workoutId ?? 'null'}`;

  // Missing-workout case — render `failed` with categorical reason so
  // the marker remains exhaustive even when navigation lands without a
  // workout. Maestro asserts `assertNotVisible smoke-dayworkout-contract-failed`
  // so this surfaces as the precise failure label upstream.
  if (!args.workout) {
    const title = '(missing)';
    const text = '';
    const label = buildLabel({
      state: 'failed',
      reason: 'missing-workout-data',
      title,
      text,
      hasEasyAerobicFlush: false,
      hasBike: false,
      has20min: false,
      hasEasyIntensity: false,
      forbiddenTokens: [],
      routeParams,
    });
    return {
      state: 'failed',
      reason: 'missing-workout-data',
      title,
      text,
      hasEasyAerobicFlush: false,
      hasBike: false,
      has20min: false,
      hasEasyIntensity: false,
      forbiddenTokens: [],
      routeParams,
      label,
    };
  }

  const title = String(args.workout?.name ?? args.workout?.title ?? '(missing)');
  const text = compactDayWorkoutSmokeText(collectDayWorkoutSmokeText(args.workout));
  const hasEasyAerobicFlush = REQUIRED_TITLE_RE.test(text);
  const hasBike = BIKE_RE.test(text);
  const has20min = TWENTY_MIN_RE.test(text);
  const hasEasyIntensity = EASY_INTENSITY_RE.test(text);
  const forbiddenTokens = FORBIDDEN_TOKENS.filter((token) =>
    text.toLowerCase().includes(token.toLowerCase()),
  );

  let state: DayWorkoutSmokeContractState;
  let reason: DayWorkoutSmokeContractReason;
  if (
    hasEasyAerobicFlush &&
    hasBike &&
    has20min &&
    hasEasyIntensity &&
    forbiddenTokens.length === 0
  ) {
    state = 'ready';
    reason = 'ok';
  } else {
    state = 'failed';
    // Priority: forbidden-token leak first (the most actionable signal
    // — the row→bike rewrite is the regression we're guarding against),
    // then missing required tokens in declaration order.
    if (forbiddenTokens.length > 0) reason = 'forbidden-token-present';
    else if (!hasEasyAerobicFlush) reason = 'missing-title-token';
    else if (!hasBike) reason = 'missing-bike-token';
    else if (!has20min) reason = 'missing-20min-token';
    else reason = 'missing-easy-intensity-token';
  }

  const label = buildLabel({
    state,
    reason,
    title,
    text,
    hasEasyAerobicFlush,
    hasBike,
    has20min,
    hasEasyIntensity,
    forbiddenTokens,
    routeParams,
  });

  return {
    state,
    reason,
    title,
    text,
    hasEasyAerobicFlush,
    hasBike,
    has20min,
    hasEasyIntensity,
    forbiddenTokens,
    routeParams,
    label,
  };
}

/**
 * Build a "contract-error" failed result for the catch path on the
 * screen. Keeps the marker rendered with a categorical reason so the
 * mounted/ready/failed invariant is preserved even on a thrown derive.
 */
export function buildDayWorkoutSmokeContractErrorResult(args: {
  error: unknown;
  date?: string | null;
  workoutId?: string | null;
}): DayWorkoutSmokeContractResult {
  const routeParams = `date=${args.date ?? 'null'} workoutId=${args.workoutId ?? 'null'}`;
  const errStr = args.error instanceof Error ? args.error.message : String(args.error);
  const title = '(derive-threw)';
  const text = `contract-error: ${errStr}`;
  const label = buildLabel({
    state: 'failed',
    reason: 'contract-error',
    title,
    text,
    hasEasyAerobicFlush: false,
    hasBike: false,
    has20min: false,
    hasEasyIntensity: false,
    forbiddenTokens: [],
    routeParams,
  });
  return {
    state: 'failed',
    reason: 'contract-error',
    title,
    text,
    hasEasyAerobicFlush: false,
    hasBike: false,
    has20min: false,
    hasEasyIntensity: false,
    forbiddenTokens: [],
    routeParams,
    label,
  };
}
