import type {
  ExperienceLevel,
  PerformanceTestCategory,
  PerformanceTestId,
  PerformanceTestResult,
  PerformanceTesting,
  TwoKmTimeTrialAnswer,
} from '../types/domain';
import {
  deriveMas,
  MAS_FROM_TIME_TRIAL_MULTIPLIER,
  validateTwoKmTime,
  type DerivedMas,
} from './twoKmTimeTrial';

export interface PerformanceTestDefinition {
  readonly id: PerformanceTestId;
  readonly category: PerformanceTestCategory;
  readonly label: string;
  readonly valueKind: 'seconds' | 'calories';
  readonly distanceMetres?: number;
  readonly inputHint: string;
  readonly inputPlaceholder: string;
}

export const PERFORMANCE_TESTS = [
  { id: 'two_km_tt', category: 'aerobic', label: '2km TT', valueKind: 'seconds', distanceMetres: 2000, inputHint: 'Time (m:ss)', inputPlaceholder: '7:15' },
  { id: 'three_km_tt', category: 'aerobic', label: '3km TT', valueKind: 'seconds', distanceMetres: 3000, inputHint: 'Time (m:ss)', inputPlaceholder: '12:00' },
  { id: 'four_hundred_m_run', category: 'anaerobic', label: '400m run', valueKind: 'seconds', distanceMetres: 400, inputHint: 'Time (m:ss)', inputPlaceholder: '1:15' },
  { id: 'one_min_air_bike', category: 'anaerobic', label: '1 min max cal air bike', valueKind: 'calories', inputHint: 'Calories', inputPlaceholder: '28' },
  { id: 'one_hundred_m_sprint', category: 'sprint', label: '100m sprint', valueKind: 'seconds', distanceMetres: 100, inputHint: 'Time (seconds)', inputPlaceholder: '12.40' },
  { id: 'twenty_m_electronic_sprint', category: 'sprint', label: '20m sprint (electronically timed)', valueKind: 'seconds', distanceMetres: 20, inputHint: 'Time (seconds)', inputPlaceholder: '3.20' },
] as const satisfies readonly PerformanceTestDefinition[];

export const PERFORMANCE_TEST_CATEGORIES: readonly PerformanceTestCategory[] = [
  'aerobic', 'anaerobic', 'sprint',
];

export const DEFAULT_PERFORMANCE_TEST: Readonly<Record<PerformanceTestCategory, PerformanceTestId>> = {
  aerobic: 'two_km_tt',
  anaerobic: 'four_hundred_m_run',
  sprint: 'one_hundred_m_sprint',
};

export function performanceTestDefinition(id: PerformanceTestId): PerformanceTestDefinition {
  const definition = PERFORMANCE_TESTS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown performance test: ${id}`);
  return definition;
}

export function performanceTestsForCategory(category: PerformanceTestCategory): readonly PerformanceTestDefinition[] {
  return PERFORMANCE_TESTS.filter((test) => test.category === category);
}

export function selectedPerformanceTest(
  testing: PerformanceTesting | undefined,
  category: PerformanceTestCategory,
): PerformanceTestId {
  const selected = testing?.selections[category];
  return selected && performanceTestDefinition(selected).category === category
    ? selected
    : DEFAULT_PERFORMANCE_TEST[category];
}

export function resultsForPerformanceTest(
  testing: PerformanceTesting | undefined,
  testId: PerformanceTestId,
): readonly PerformanceTestResult[] {
  return (testing?.results ?? [])
    .filter((result) => result.testId === testId)
    .slice()
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export function recordPerformanceTestResult(
  testing: PerformanceTesting | undefined,
  result: PerformanceTestResult,
): PerformanceTesting {
  const refusal = validatePerformanceTestResult(result.testId, result.value);
  if (refusal) throw new Error(refusal);
  const definition = performanceTestDefinition(result.testId);
  return {
    selections: {
      ...(testing?.selections ?? {}),
      [definition.category]: result.testId,
    },
    results: [...(testing?.results ?? []), result],
  };
}

export function validatePerformanceTestResult(testId: PerformanceTestId, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return 'Enter a result greater than zero.';
  if (testId === 'two_km_tt') {
    const validation = validateTwoKmTime(value);
    return validation.ok ? null : validation.message ?? 'Enter a valid 2km time.';
  }
  return null;
}

export function parsePerformanceTestResult(testId: PerformanceTestId, raw: string): number | null {
  const definition = performanceTestDefinition(testId);
  const value = raw.trim();
  if (!value) return null;
  let parsed: number;
  if (definition.valueKind === 'seconds' && value.includes(':')) {
    const match = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(value);
    if (!match) return null;
    parsed = Number(match[1]) * 60 + Number(match[2]);
  } else {
    parsed = Number(value);
  }
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clock(value: number, decimals: boolean): string {
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  const renderedSeconds = decimals
    ? seconds.toFixed(2).padStart(5, '0')
    : String(Math.round(seconds)).padStart(2, '0');
  return `${minutes}:${renderedSeconds}`;
}

export function formatPerformanceTestResult(testId: PerformanceTestId, value: number): string {
  const definition = performanceTestDefinition(testId);
  if (definition.valueKind === 'calories') return `${Number.isInteger(value) ? value : value.toFixed(1)} cal`;
  if (definition.distanceMetres && definition.distanceMetres <= 100) return `${value.toFixed(2)} sec`;
  return clock(value, !Number.isInteger(value));
}

export interface PerformanceTestComparison {
  readonly direction: 'up' | 'down';
  readonly status: 'improved' | 'worse';
  readonly percent: number;
}

export function comparePerformanceTestResults(
  testId: PerformanceTestId,
  previous: number | undefined,
  latest: number,
): PerformanceTestComparison | null {
  if (!previous || latest === previous) return null;
  const higher = latest > previous;
  const higherIsBetter = performanceTestDefinition(testId).valueKind === 'calories';
  return {
    direction: higher ? 'up' : 'down',
    status: higher === higherIsBetter ? 'improved' : 'worse',
    percent: Math.abs(latest - previous) / previous * 100,
  };
}

/** Latest selected aerobic result, used at read time to derive the athlete's MAS. */
export function selectedAerobicResult(testing: PerformanceTesting | undefined): {
  readonly seconds: number;
  readonly distanceKm: number;
} | null {
  const testId = selectedPerformanceTest(testing, 'aerobic');
  const definition = performanceTestDefinition(testId);
  const results = resultsForPerformanceTest(testing, testId);
  const latest = results[results.length - 1];
  if (!latest || !definition.distanceMetres) return null;
  return { seconds: latest.value, distanceKm: definition.distanceMetres / 1000 };
}

/**
 * The current Progress aerobic test outranks the legacy onboarding-only 2km
 * answer. Both 2km and 3km use honest average speed: distance ÷ time × 1.00.
 */
export function deriveMasFromPerformanceTesting(
  performanceTesting: PerformanceTesting | undefined,
  legacyTwoKmAnswer: TwoKmTimeTrialAnswer | undefined,
  experienceLevel: ExperienceLevel,
): DerivedMas {
  const aerobic = selectedAerobicResult(performanceTesting);
  if (!aerobic) return deriveMas(legacyTwoKmAnswer, experienceLevel);
  return {
    masKmh: (aerobic.distanceKm / (aerobic.seconds / 3600)) * MAS_FROM_TIME_TRIAL_MULTIPLIER,
    source: 'measured',
    seconds: aerobic.seconds,
  };
}
