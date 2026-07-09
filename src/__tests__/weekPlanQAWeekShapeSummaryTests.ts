import { readFileSync } from 'fs';
import { join } from 'path';
import type { Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  validateProgramWeek,
  validatorDaysFromResolvedWeek,
} from '../rules/weekStructureValidator';
import { renderWeekShapeSummary } from './weekPlanQA/weekShapeSummary';

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

const NOW = '2026-07-09T00:00:00.000Z';

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

function scenarioIdsFromHarness(): string[] {
  const harnessPath = join(process.cwd(), 'src/__tests__/weekPlanQA.ts');
  const harness = readFileSync(harnessPath, 'utf8');
  const scenarioSection = harness.slice(harness.indexOf('const scenarios: Scenario[] = ['));
  return [...scenarioSection.matchAll(/\bid:\s*'([SE]\d+)'/g)].map((match) => match[1]);
}

console.log('weekPlanQAWeekShapeSummaryTests');

console.log('\n[1] readable week-shape summary includes Mon-Sun sessions, counts, anchors, and notes');
{
  const resolvedWeek: ResolvedDay[] = [
    day('2026-03-23', 'MON', workout('Lower body strength', { intensity: 'High', sessionTier: 'core' }), 'template', 'core'),
    day('2026-03-24', 'TUE', workout('Team training + Upper body - pull emphasis', {
      intensity: 'High',
      sessionTier: 'core',
      workoutType: 'Team Training',
      dayOfWeek: 2,
      ...({ isTeamDay: true } as Partial<Workout>),
    }), 'template', 'core'),
    day('2026-03-25', 'WED', workout('Recovery Session', {
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      intensity: 'Light',
      dayOfWeek: 3,
    }), 'recovery', 'recovery'),
    day('2026-03-26', 'THU', workout('Team training - field session (sprint + skills)', {
      intensity: 'High',
      sessionTier: 'core',
      workoutType: 'Team Training',
      dayOfWeek: 4,
      ...({ isTeamDay: true } as Partial<Workout>),
    }), 'template', 'core'),
    day('2026-03-27', 'FRI', workout('Gunshow', {
      intensity: 'Light',
      sessionTier: 'optional',
      dayOfWeek: 5,
    }), 'gameProximity', 'optional'),
    day('2026-03-28', 'SAT', workout('Game Day', {
      intensity: 'High',
      workoutType: 'Game',
      dayOfWeek: 6,
    }), 'game', 'game'),
    day('2026-03-29', 'SUN', null, 'none', null),
  ];
  const report = validateProgramWeek({
    days: validatorDaysFromResolvedWeek(resolvedWeek),
    profile: {
      seasonPhase: 'Pre-season',
      teamTrainingIntensity: 'Hard',
      conditioningLevel: 'Good',
    },
  });
  const output = renderWeekShapeSummary({
    resolvedWeek,
    validationReport: report,
    seasonPhase: 'Pre-season',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    weekKind: 'build',
  });

  ok('includes Mon session', output.includes('Mon: lower strength'));
  ok('includes Tue stacked session', output.includes('Tue: team training + upper strength'));
  ok('includes Wed recovery session', output.includes('Wed: recovery'));
  ok('includes Thu team training anchor', output.includes('Thu: team training'));
  ok('includes Fri light/gunshow session', output.includes('Fri: gunshow/prehab'));
  ok('includes Sat practice match', output.includes('Sat: practice match'));
  ok('includes Sun rest', output.includes('Sun: rest'));
  ok('includes hard-day count', output.includes('Hard days:'));
  ok('includes main-strength count', output.includes('Main strength:'));
  ok('includes conditioning exposure count', output.includes('Conditioning:'));
  ok('includes running exposure count', output.includes('Running:'));
  ok('includes sprint/COD exposure count', output.includes('Sprint/COD:'));
  ok('includes week kind when available', output.includes('Week kind: build'));
  ok('includes week context', output.includes('Week context: Pre-season practice match week | Deload: no'));
  ok('includes team/practice anchors', output.includes('Anchors: TT Tue, Thu; practice match Sat'));
  ok('includes stacked-day summary', output.includes('Stacked days: Tue: team training + upper strength'));
  ok('includes G-1 light note', output.includes('Fri kept light before Sat practice match.'));
  ok('includes sprint/COD anchor note', output.includes('Team training and practice match count as sprint/COD exposure.'));
}

console.log('\n[2] missing resolved week falls back safely');
{
  const output = renderWeekShapeSummary({
    resolvedWeek: null,
    validationReport: null,
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    teamTrainingDays: ['Tuesday', 'Thursday'],
    weekKind: null,
  });
  ok('prints unavailable message', output.includes('Week shape unavailable'));
}

console.log('\n[3] scenario count stays fixed');
{
  eq('scenario count does not change', scenarioIdsFromHarness().length, 17);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
