import { readFileSync } from 'fs';
import { join } from 'path';
import type { Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  validateProgramWeek,
  validatorDaysFromResolvedWeek,
} from '../rules/weekStructureValidator';
import {
  expectedWeekShapeForScenarioId,
  renderExpectedWeekShapeDiff,
  type ExpectedWeekShape,
} from './weekPlanQA/weekShapeDiff';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

const NOW = '2026-07-10T00:00:00.000Z';

function workout(name: string, overrides: Partial<Workout> = {}): Workout {
  return {
    id: `w-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 1,
    name,
    description: name,
    durationMinutes: 45,
    intensity: 'Moderate',
    workoutType: 'Strength',
    exercises: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function day(date: string, short: string, workoutForDay: Workout | null, source: ResolvedDay['source'], indicator: ResolvedDay['indicator']): ResolvedDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay(),
    short,
    isToday: false,
    workout: workoutForDay,
    source,
    indicator,
  };
}

function baselineWeek(): ResolvedDay[] {
  return [
    day('2026-03-23', 'MON', workout('Lower body strength', { intensity: 'High', sessionTier: 'core' }), 'template', 'core'),
    day('2026-03-24', 'TUE', workout('Team training + Upper body - pull emphasis', {
      dayOfWeek: 2,
      intensity: 'High',
      sessionTier: 'core',
      workoutType: 'Team Training',
      ...({ isTeamDay: true } as Partial<Workout>),
    }), 'template', 'core'),
    day('2026-03-25', 'WED', workout('Recovery Session', {
      dayOfWeek: 3,
      intensity: 'Light',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
    }), 'recovery', 'recovery'),
    day('2026-03-26', 'THU', workout('Team training - field session (sprint + skills)', {
      dayOfWeek: 4,
      intensity: 'High',
      sessionTier: 'core',
      workoutType: 'Team Training',
      ...({ isTeamDay: true } as Partial<Workout>),
    }), 'template', 'core'),
    day('2026-03-27', 'FRI', workout('Gunshow', { dayOfWeek: 5, intensity: 'Light', sessionTier: 'optional' }), 'gameProximity', 'optional'),
    day('2026-03-28', 'SAT', workout('Game Day', { dayOfWeek: 6, intensity: 'High', workoutType: 'Game' }), 'game', 'game'),
    day('2026-03-29', 'SUN', null, 'none', null),
  ];
}

function reportFor(resolvedWeek: ResolvedDay[]) {
  return validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolvedWeek),
    profile: {
      seasonPhase: 'In-season',
      teamTrainingIntensity: 'Hard',
      conditioningLevel: 'Good',
    },
  });
}

function scenarioIdsFromHarness(): string[] {
  const harnessPath = join(process.cwd(), 'src/__tests__/weekPlanQA.ts');
  const harness = readFileSync(harnessPath, 'utf8');
  const scenarioSection = harness.slice(harness.indexOf('const scenarios: Scenario[] = ['));
  return [...scenarioSection.matchAll(/\bid:\s*'([SE]\d+)'/g)].map((match) => match[1]);
}

console.log('weekPlanQAWeekShapeDiffTests');

console.log('\n[1] expected-vs-actual diff prints matching days, counts, anchors, and drift checks');
{
  const resolvedWeek = baselineWeek();
  const report = reportFor(resolvedWeek);
  const expected: ExpectedWeekShape = {
    id: 'TEST',
    days: {
      Mon: 'lower strength',
      Tue: 'team training + upper strength',
      Wed: 'recovery',
      Thu: 'team training',
      Fri: 'gunshow/prehab',
      Sat: 'game',
      Sun: 'rest',
    },
    counts: {
      hardDays: report.counts.hardDays,
      mainStrength: report.counts.mainStrengthExposures,
      conditioning: report.counts.conditioningExposures,
      running: report.counts.runningExposures,
      sprintCod: report.counts.sprintCodExposures,
    },
    anchors: {
      teamTrainingDays: ['Tue', 'Thu'],
      fixtureDays: ['Sat'],
      fixtureLabel: 'game',
    },
    hardDays: ['Mon', 'Tue', 'Thu', 'Sat'],
    gMinusOneLightDays: ['Fri'],
    stackedDays: ['Tue: team training + upper strength'],
  };
  const output = renderExpectedWeekShapeDiff({
    scenarioId: 'TEST',
    expected,
    resolvedWeek,
    validationReport: report,
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    weekKind: 'build',
  });
  ok('prints expected-vs-actual heading', output.includes('EXPECTED VS ACTUAL:'));
  ok('prints day comparison', output.includes('Tue: expected team training + upper strength | actual team training + upper strength ✅'));
  ok('prints count comparison', output.includes(`Hard days: expected ${report.counts.hardDays} | actual ${report.counts.hardDays} ✅`));
  ok('prints anchor comparison', output.includes('Team training: expected Tue, Thu | actual Tue, Thu ✅'));
  ok('prints G-1 light day comparison', output.includes('G-1 light day: expected Fri | actual Fri ✅'));
  ok('prints stacked-day comparison', output.includes('Stacked days: expected Tue: team training + upper strength | actual Tue: team training + upper strength ✅'));
}

console.log('\n[2] diff calls out changed counts, anchors, hard days, G-1, and stacking');
{
  const resolvedWeek = baselineWeek();
  const report = reportFor(resolvedWeek);
  const expected: ExpectedWeekShape = {
    id: 'DRIFT',
    days: {
      Mon: 'lower strength',
      Fri: 'recovery',
    },
    counts: {
      hardDays: { max: 2, label: 'at most 2' },
      mainStrength: { min: 3, label: 'at least 3' },
      conditioning: { max: 2, label: 'at most 2' },
      running: { max: 2, label: 'at most 2' },
      sprintCod: { max: 2, label: 'at most 2' },
    },
    anchors: {
      teamTrainingDays: ['Tue'],
      fixtureDays: ['Fri'],
      fixtureLabel: 'game',
    },
    hardDays: ['Mon'],
    gMinusOneLightDays: ['Thu'],
    stackedDays: [],
  };
  const output = renderExpectedWeekShapeDiff({
    scenarioId: 'DRIFT',
    expected,
    resolvedWeek,
    validationReport: report,
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    weekKind: 'build',
  });
  ok('flags day drift', output.includes('Fri: expected recovery | actual gunshow/prehab ❌'));
  ok('flags count drift', output.includes(`Hard days: expected at most 2 | actual ${report.counts.hardDays} ❌`));
  ok('flags anchor drift', output.includes('game: expected Fri | actual Sat ❌'));
  ok('flags unexpected hard days', output.includes('Unexpected hard days: expected Mon | actual Mon, Tue, Thu, Sat ❌'));
  ok('flags missing strength sessions', output.includes(`Missing strength sessions: expected at least 3 | actual ${report.counts.mainStrengthExposures} ❌`));
  ok('flags extra sprint/COD', output.includes(`Extra sprint/COD: expected at most 2 | actual ${report.counts.sprintCodExposures} ❌`));
  ok('flags missing G-1 light day', output.includes('G-1 light day: expected Thu | actual Fri ❌'));
  ok('flags stacked-day differences', output.includes('Stacked days: expected none | actual Tue: team training + upper strength ❌'));
}

console.log('\n[3] missing expected shape falls back safely');
{
  const output = renderExpectedWeekShapeDiff({
    scenarioId: 'S99',
    resolvedWeek: baselineWeek(),
    validationReport: reportFor(baselineWeek()),
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
  });
  ok('prints safe missing expected shape message', output.includes('No expected week shape registered for S99 yet.'));
}

console.log('\n[4] registered expectations and scenario count stay stable');
{
  ok('S1 has a registered expected week shape', !!expectedWeekShapeForScenarioId('S1'));
  eq('scenario count does not change', scenarioIdsFromHarness().length, 17);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
