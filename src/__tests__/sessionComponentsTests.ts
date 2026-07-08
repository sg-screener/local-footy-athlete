/**
 * Session component detection tests.
 *
 * Run: npx sucrase-node src/__tests__/sessionComponentsTests.ts
 */

import {
  componentPartialReasonLabel,
  componentQuestionLabel,
  componentSkipReasonLabel,
  getSessionComponents,
} from '../utils/sessionComponents';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function ex(id: string, name: string): any {
  return {
    id,
    exerciseId: id.replace(/^we-/, 'ex-'),
    exercise: { id: id.replace(/^we-/, 'ex-'), name },
    prescribedSets: 3,
    prescribedRepsMin: 8,
    prescribedRepsMax: 10,
    restSeconds: 90,
  };
}

function kinds(workout: any): string[] {
  return getSessionComponents(workout).map((component) => component.kind);
}

section('1. Standalone strength');
{
  const workout = {
    name: 'Upper Pull',
    workoutType: 'Strength',
    exercises: [ex('we-row', 'Chest Supported Row')],
  };
  const components = getSessionComponents(workout);
  assert(components.length === 1, 'standalone strength has one component');
  assert(components[0].kind === 'strength', 'standalone strength detects strength');
  assert(
    componentQuestionLabel(components[0], components.length) === 'Did you complete it?',
    'standalone strength keeps simple completion copy',
  );
}

section('2. Team Training + Upper Push');
{
  const workout = {
    name: 'Team Training + Upper Push',
    workoutType: 'Strength',
    exercises: [ex('we-bench', 'Bench Press')],
  };
  const components = getSessionComponents(workout);
  assert(kinds(workout).join(',') === 'strength,team_training', 'team + upper detects strength and team');
  assert(
    componentQuestionLabel(components[0], components.length) === 'Did you complete the strength work?',
    'combined strength asks about strength work',
  );
  assert(
    componentQuestionLabel(components[1], components.length) === 'Did you complete team training?',
    'combined team asks about team training',
  );
  assert(
    componentSkipReasonLabel(components[0]) === 'Why did you skip the strength work?',
    'strength skip reason copy is component-specific',
  );
  assert(
    componentSkipReasonLabel(components[1]) === 'Why did you skip team training?',
    'team skip reason copy is component-specific',
  );
  assert(
    componentPartialReasonLabel(components[1]) === 'Why did you only complete part of team training?',
    'team partial reason copy is component-specific',
  );
}

section('3. Strength + conditioning');
{
  const workout = {
    name: 'Lower Body Strength + Hard Conditioning',
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    exercises: [ex('we-squat', 'Back Squat'), ex('we-bike', 'Assault Bike Intervals')],
    conditioningBlock: {
      options: [{ title: 'Hard Conditioning', exerciseIds: ['we-bike'] }],
    },
  };
  const components = getSessionComponents(workout);
  assert(kinds(workout).join(',') === 'strength,conditioning', 'S+C detects strength and conditioning');
  assert(
    componentSkipReasonLabel(components[1]) === 'Why did you skip the conditioning?',
    'conditioning skip reason copy is component-specific',
  );
  assert(
    componentPartialReasonLabel(components[0]) === 'Why did you only complete part of the strength work?',
    'strength partial reason copy is component-specific',
  );
}

section('4. Removed components disappear');
{
  const conditioningRemoved = {
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    exercises: [ex('we-squat', 'Back Squat')],
    conditioningBlock: {
      options: [{ title: 'Hard Conditioning', exerciseIds: ['we-bike-removed'] }],
    },
  };
  assert(
    kinds(conditioningRemoved).join(',') === 'strength',
    'removed conditioning is not logged from stale block ids',
  );

  const teamRemoved = {
    name: 'Upper Push',
    workoutType: 'Strength',
    exercises: [ex('we-bench', 'Bench Press')],
  };
  assert(kinds(teamRemoved).join(',') === 'strength', 'removed team training is not logged');
}

section('5. Single-component non-strength sessions');
{
  const teamOnly = {
    name: 'Team Training',
    workoutType: 'Team Training',
    exercises: [],
  };
  assert(kinds(teamOnly).join(',') === 'team_training', 'team only detects team component');

  const conditioningOnly = {
    name: 'Aerobic Base',
    workoutType: 'Conditioning',
    exercises: [ex('we-run', 'Zone 2 Run')],
  };
  assert(kinds(conditioningOnly).join(',') === 'conditioning', 'conditioning only detects conditioning');
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
