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

section('4. Optional finisher is its own component');
{
  const workout = {
    name: 'Upper Pull + Aerobic Finisher',
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    exercises: [ex('we-row', 'Chest Supported Row'), ex('we-bike', 'Easy Bike Finisher')],
    conditioningBlock: {
      options: [{ title: 'Aerobic Finisher', exerciseIds: ['we-bike'] }],
    },
  };
  const components = getSessionComponents(workout as any);
  assert(kinds(workout as any).join(',') === 'strength,finisher', 'finisher is separate from strength');
  assert(
    components[1].completionPolicy === 'optional_no_penalty',
    'finisher is optional for aggregate completion',
  );
  assert(
    componentQuestionLabel(components[1], components.length) === 'Did you complete the finisher?',
    'finisher gets component-specific completion copy',
  );
}

section('5. Power, speed and recovery add-on metadata become honest components');
{
  const powerAndUpper = {
    name: 'Upper Strength',
    workoutType: 'Strength',
    exercises: [ex('we-bench', 'Bench Press')],
    powerBlock: {
      id: 'power-1',
      title: 'Power Primer',
      placement: 'pre_lift',
      prescription: '3 x 3 — full rest, fast & sharp',
      options: [{ name: 'Explosive Push-up', sets: 3, repsMin: 3, repsMax: 3 }],
      notes: ['Do this fresh.'],
      counting: {
        hardExposure: false,
        mainStrength: false,
        conditioningCredit: 'none',
        isFinisher: false,
      },
    },
  };
  const powerComponents = getSessionComponents(powerAndUpper as any);
  assert(kinds(powerAndUpper as any).join(',') === 'power,strength', 'power + upper detects both components');
  assert(
    componentQuestionLabel(powerComponents[0], powerComponents.length) === 'Did you complete the power work?',
    'power gets a separate completion question',
  );
  assert(
    componentSkipReasonLabel(powerComponents[0]) === 'Why did you skip the power work?',
    'power skip reason copy is component-specific',
  );
  assert(
    powerComponents[0].completionPolicy === 'required',
    'programmed power is completion-bearing but remains separate from strength',
  );
  assert(
    !kinds(powerAndUpper as any).some((kind) =>
      kind === 'conditioning' || kind === 'finisher' || kind === 'recovery_addon'),
    'power does not masquerade as conditioning, finisher, or recovery add-on',
  );

  const speedAndUpper = {
    name: 'Upper Strength + Speed',
    workoutType: 'Strength',
    exercises: [ex('we-bench', 'Bench Press')],
    speedBlock: {
      id: 'speed-1',
      title: 'Acceleration micro-dose',
      label: 'Speed',
      kind: 'true_speed',
      placement: 'pre_lift',
      durationMinutes: 12,
      prescription: '4 x 15m accelerations',
      counting: {},
    },
  };
  const speedComponents = getSessionComponents(speedAndUpper as any);
  assert(kinds(speedAndUpper as any).join(',') === 'speed,strength', 'speed + upper detects both components');
  assert(
    componentQuestionLabel(speedComponents[0], speedComponents.length) === 'Did you complete the speed work?',
    'speed gets component-specific completion copy',
  );

  const strengthAndAddon = {
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    exercises: [ex('we-squat', 'Back Squat')],
    recoveryAddons: [{
      id: 'addon-1',
      exercises: [{ id: 'bird-dog', name: 'Bird Dog', prescription: '2 x 6/side' }],
    }],
  };
  const addonComponents = getSessionComponents(strengthAndAddon as any);
  assert(
    kinds(strengthAndAddon as any).join(',') === 'strength,recovery_addon',
    'strength + recovery add-on detects both components',
  );
  assert(
    addonComponents[1].completionPolicy === 'optional_no_penalty',
    'recovery add-on is optional for aggregate completion',
  );
  assert(
    componentQuestionLabel(addonComponents[1], addonComponents.length) === 'Did you complete the recovery add-on?',
    'recovery add-on gets component-specific completion copy',
  );

  const recoveryAndAddon = {
    name: 'Recovery Session',
    workoutType: 'Recovery',
    exercises: [],
    recoveryAddons: [{
      id: 'addon-2',
      exercises: [{ id: 'breathing', name: 'Breathing Reset', prescription: '3 minutes' }],
    }],
  };
  assert(
    kinds(recoveryAndAddon as any).join(',') === 'recovery,recovery_addon',
    'optional add-on does not replace the main recovery component',
  );
}

section('6. Removed components disappear');
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

  const optionalComponentsRemoved = {
    name: 'Upper Pull',
    workoutType: 'Strength',
    exercises: [ex('we-row', 'Chest Supported Row')],
    speedBlock: undefined,
    powerBlock: undefined,
    recoveryAddons: [],
  };
  assert(
    kinds(optionalComponentsRemoved as any).join(',') === 'strength',
    'removed power, speed and recovery add-on metadata do not leave feedback fields',
  );
}

section('7. Single-component non-strength sessions');
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
