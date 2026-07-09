import {
  buildWeekShapeSnapshot,
  type WeekShapeCountsSummary,
  type WeekShapeDayLabel,
  type WeekShapeSnapshot,
  type WeekShapeSummaryInput,
} from './weekShapeSummary';

type CountKey = keyof WeekShapeCountsSummary;

export type ExpectedCount =
  | number
  | {
    min?: number;
    max?: number;
    label?: string;
  };

export interface ExpectedWeekShape {
  id: string;
  days?: Partial<Record<WeekShapeDayLabel, string>>;
  counts?: Partial<Record<CountKey, ExpectedCount>>;
  anchors?: {
    teamTrainingDays?: WeekShapeDayLabel[];
    fixtureDays?: WeekShapeDayLabel[];
    fixtureLabel?: string;
  };
  hardDays?: WeekShapeDayLabel[];
  gMinusOneLightDays?: WeekShapeDayLabel[];
  stackedDays?: string[];
}

const DAY_ORDER: WeekShapeDayLabel[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HEALTHY_TWO_TEAM_TRAINING_BYE: Omit<ExpectedWeekShape, 'id'> = {
  days: {
    Mon: 'gunshow/prehab',
    Tue: 'team training + upper strength',
    Wed: 'recovery',
    Thu: 'team training',
    Fri: 'recovery',
    Sat: 'lower strength',
    Sun: 'rest',
  },
  counts: {
    hardDays: 3,
    mainStrength: 2,
    conditioning: 2,
    running: 2,
    sprintCod: 2,
  },
  anchors: {
    teamTrainingDays: ['Tue', 'Thu'],
    fixtureDays: [],
    fixtureLabel: 'game',
  },
  hardDays: ['Tue', 'Thu', 'Sat'],
  stackedDays: ['Tue: team training + upper strength'],
};

const EXPECTED_WEEK_SHAPES: Record<string, ExpectedWeekShape> = {
  S1: {
    id: 'S1',
    days: {
      Mon: 'full body strength + easy conditioning',
      Tue: 'team training + upper strength',
      Wed: 'easy conditioning',
      Thu: 'team training + upper strength',
      Fri: 'gunshow/prehab',
      Sat: 'game',
      Sun: 'recovery',
    },
    counts: {
      hardDays: 3,
      mainStrength: 3,
      conditioning: 5,
      running: 3,
      sprintCod: 3,
    },
    anchors: {
      teamTrainingDays: ['Tue', 'Thu'],
      fixtureDays: ['Sat'],
      fixtureLabel: 'game',
    },
    hardDays: ['Tue', 'Thu', 'Sat'],
    gMinusOneLightDays: ['Fri'],
    stackedDays: [
      'Mon: full body strength + easy conditioning',
      'Tue: team training + upper strength',
      'Thu: team training + upper strength',
    ],
  },
  S4: {
    id: 'S4',
    ...HEALTHY_TWO_TEAM_TRAINING_BYE,
  },
  E1: {
    id: 'E1',
    ...HEALTHY_TWO_TEAM_TRAINING_BYE,
  },
};

export function expectedWeekShapeForScenarioId(id: string | undefined): ExpectedWeekShape | null {
  return id ? EXPECTED_WEEK_SHAPES[id] ?? null : null;
}

function icon(ok: boolean): string {
  return ok ? '✅' : '❌';
}

function list(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : 'none';
}

function sameSet(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = [...(a ?? [])].sort();
  const right = [...(b ?? [])].sort();
  return JSON.stringify(left) === JSON.stringify(right);
}

function countLabel(expected: ExpectedCount): string {
  if (typeof expected === 'number') return String(expected);
  if (expected.label) return expected.label;
  if (expected.min !== undefined && expected.max !== undefined) return `${expected.min}-${expected.max}`;
  if (expected.min !== undefined) return `at least ${expected.min}`;
  if (expected.max !== undefined) return `at most ${expected.max}`;
  return 'any';
}

function countBounds(expected: ExpectedCount): { min: number; max: number } {
  if (typeof expected === 'number') return { min: expected, max: expected };
  return {
    min: expected.min ?? Number.NEGATIVE_INFINITY,
    max: expected.max ?? Number.POSITIVE_INFINITY,
  };
}

function countMatches(expected: ExpectedCount, actual: number): boolean {
  const bounds = countBounds(expected);
  return actual >= bounds.min && actual <= bounds.max;
}

function countMax(expected: ExpectedCount): number {
  return countBounds(expected).max;
}

function countMin(expected: ExpectedCount): number {
  return countBounds(expected).min;
}

function expectedCountsLine(
  label: string,
  key: CountKey,
  expected: ExpectedWeekShape,
  actual: WeekShapeSnapshot,
): string | null {
  const expectedCount = expected.counts?.[key];
  const actualCount = actual.counts?.[key];
  if (expectedCount === undefined || actualCount === undefined) return null;
  const ok = countMatches(expectedCount, actualCount);
  return `  ${label}: expected ${countLabel(expectedCount)} | actual ${actualCount} ${icon(ok)}`;
}

function compareLinesForDays(expected: ExpectedWeekShape, actual: WeekShapeSnapshot): string[] {
  const lines: string[] = ['  DAYS:'];
  for (const day of DAY_ORDER) {
    const expectedShape = expected.days?.[day];
    if (!expectedShape) continue;
    const actualShape = actual.days[day] ?? 'missing';
    const ok = expectedShape === actualShape;
    lines.push(`  ${day}: expected ${expectedShape} | actual ${actualShape} ${icon(ok)}`);
  }
  return lines;
}

function compareLinesForCounts(expected: ExpectedWeekShape, actual: WeekShapeSnapshot): string[] {
  const lines = ['  COUNTS:'];
  const countLines = [
    expectedCountsLine('Hard days', 'hardDays', expected, actual),
    expectedCountsLine('Main strength', 'mainStrength', expected, actual),
    expectedCountsLine('Conditioning', 'conditioning', expected, actual),
    expectedCountsLine('Running', 'running', expected, actual),
    expectedCountsLine('Sprint/COD', 'sprintCod', expected, actual),
  ].filter((line): line is string => !!line);
  return countLines.length > 0 ? [...lines, ...countLines] : [];
}

function compareLinesForAnchors(expected: ExpectedWeekShape, actual: WeekShapeSnapshot): string[] {
  const lines = ['  ANCHORS:'];
  const anchorLines: string[] = [];
  if (expected.anchors?.teamTrainingDays) {
    const ok = sameSet(expected.anchors.teamTrainingDays, actual.anchors.teamTrainingDays);
    anchorLines.push(`  Team training: expected ${list(expected.anchors.teamTrainingDays)} | actual ${list(actual.anchors.teamTrainingDays)} ${icon(ok)}`);
  }
  if (expected.anchors?.fixtureDays) {
    const fixture = expected.anchors.fixtureLabel ?? actual.anchors.fixtureLabel;
    const ok = sameSet(expected.anchors.fixtureDays, actual.anchors.fixtureDays);
    anchorLines.push(`  ${fixture}: expected ${list(expected.anchors.fixtureDays)} | actual ${list(actual.anchors.fixtureDays)} ${icon(ok)}`);
  }
  return anchorLines.length > 0 ? [...lines, ...anchorLines] : [];
}

function compareLinesForDrift(expected: ExpectedWeekShape, actual: WeekShapeSnapshot): string[] {
  const lines = ['  DRIFT CHECKS:'];
  if (expected.hardDays) {
    const unexpected = actual.hardDays.filter((day) => !expected.hardDays!.includes(day));
    lines.push(`  Unexpected hard days: expected ${list(expected.hardDays)} | actual ${list(actual.hardDays)} ${icon(unexpected.length === 0)}`);
  }

  const mainStrengthExpectation = expected.counts?.mainStrength;
  if (mainStrengthExpectation !== undefined && actual.counts) {
    const min = countMin(mainStrengthExpectation);
    const ok = actual.counts.mainStrength >= min;
    lines.push(`  Missing strength sessions: expected ${countLabel(mainStrengthExpectation)} | actual ${actual.counts.mainStrength} ${icon(ok)}`);
  }

  for (const [label, key] of [
    ['Extra conditioning', 'conditioning'],
    ['Extra running', 'running'],
    ['Extra sprint/COD', 'sprintCod'],
  ] as const) {
    const expectation = expected.counts?.[key];
    if (expectation === undefined || !actual.counts) continue;
    const max = countMax(expectation);
    const ok = actual.counts[key] <= max;
    lines.push(`  ${label}: expected ${countLabel(expectation)} | actual ${actual.counts[key]} ${icon(ok)}`);
  }

  if (expected.gMinusOneLightDays) {
    const missing = expected.gMinusOneLightDays.filter((day) => !actual.gMinusOneLightDays.includes(day));
    lines.push(`  G-1 light day: expected ${list(expected.gMinusOneLightDays)} | actual ${list(actual.gMinusOneLightDays)} ${icon(missing.length === 0)}`);
  }

  if (expected.stackedDays) {
    const ok = sameSet(expected.stackedDays, actual.stackedDays);
    lines.push(`  Stacked days: expected ${list(expected.stackedDays)} | actual ${list(actual.stackedDays)} ${icon(ok)}`);
  }

  return lines;
}

export function renderExpectedWeekShapeDiff(
  input: WeekShapeSummaryInput & {
    scenarioId?: string;
    expected?: ExpectedWeekShape | null;
  },
): string {
  const actual = buildWeekShapeSnapshot(input);
  const expected = input.expected ?? expectedWeekShapeForScenarioId(input.scenarioId);
  const lines = ['  EXPECTED VS ACTUAL:'];

  if (!actual) {
    lines.push('  Actual week shape unavailable: resolver did not return a week.');
    return lines.join('\n');
  }

  if (!expected) {
    lines.push(`  No expected week shape registered for ${input.scenarioId ?? 'this scenario'} yet.`);
    return lines.join('\n');
  }

  lines.push(...compareLinesForDays(expected, actual));
  lines.push('');
  lines.push(...compareLinesForCounts(expected, actual));
  lines.push('');
  lines.push(...compareLinesForAnchors(expected, actual));
  lines.push('');
  lines.push(...compareLinesForDrift(expected, actual));
  return lines.join('\n');
}
