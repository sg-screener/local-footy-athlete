/**
 * Shared visible-session classification contract.
 *
 * Locks the existing Programming Bible kernel semantics while consumers move
 * away from their local classifiers.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  classifyVisibleSession,
  countWeeklyExposures,
  type ConditioningRole,
  type VisibleSessionClassification,
} from '../rules';
import type {
  RecoveryAddonBlock,
  SpeedBlock,
  Workout,
  WorkoutExercise,
} from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

const NOW = '2026-07-10T00:00:00.000Z';
let exerciseId = 0;

function exercise(name: string): WorkoutExercise {
  exerciseId += 1;
  return {
    id: `we-${exerciseId}`,
    workoutId: 'workout',
    exerciseId: `exercise-${exerciseId}`,
    exerciseOrder: exerciseId,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    restSeconds: 90,
    exercise: {
      id: `exercise-${exerciseId}`,
      name,
      description: '',
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  } as WorkoutExercise;
}

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

function category(result: VisibleSessionClassification, value: string): boolean {
  return result.categories.includes(value as VisibleSessionClassification['categories'][number]);
}

function conditioningRole(result: VisibleSessionClassification): ConditioningRole | null {
  return result.units.find((unit) => unit.contributions.conditioning > 0)?.conditioningRole ?? null;
}

function assertWeeklyParity(name: string, input: Workout, result: VisibleSessionClassification): void {
  const weekly = countWeeklyExposures([{ date: '2026-07-06', workout: input }]);
  eq(`${name}: adapter contributions match weekly counter`, {
    hardExposures: result.contributions.hardExposures,
    hardDays: result.contributions.hardDay,
    mainStrength: result.contributions.mainStrength,
    conditioning: result.contributions.conditioning,
    extraConditioning: result.contributions.extraConditioning,
    running: result.contributions.running,
    sprintCod: result.contributions.sprintCod,
    teamTraining: result.contributions.teamAnchors,
    games: result.contributions.gameAnchors,
  }, {
    hardExposures: weekly.hardExposures,
    hardDays: weekly.hardDays,
    mainStrength: weekly.mainStrengthExposures,
    conditioning: weekly.conditioningExposures,
    extraConditioning: weekly.extraConditioningSessions,
    running: weekly.runningExposures,
    sprintCod: weekly.sprintCodExposures,
    teamTraining: weekly.teamTrainingSessions,
    games: weekly.games,
  });
}

console.log('sessionClassificationAdapterTests');

console.log('\n[1] team and fixture anchors');
{
  const team = workout('Team Training', { workoutType: 'Team Training', intensity: 'High' });
  const result = classifyVisibleSession(team, { teamTrainingIntensity: 'Hard' });
  ok('team training is a team anchor', result.anchors.teamTraining && category(result, 'team_training'), result);
  eq('normal/hard team training is high stress', result.stressLevel, 'high');
  eq('normal/hard team training creates one hard exposure/day',
    [result.contributions.hardExposures, result.contributions.hardDay], [1, 1]);
  eq('team training contributes one conditioning/running/sprint-COD exposure',
    [result.contributions.conditioning, result.contributions.running, result.contributions.sprintCod], [1, 1, 1]);
  assertWeeklyParity('team training', team, result);
}
{
  const team = workout('Light Team Training - skills and touch', {
    workoutType: 'Team Training',
    intensity: 'Light',
  });
  const result = classifyVisibleSession(team, { teamTrainingIntensity: 'Light' });
  eq('light team training downshifts to medium', result.stressLevel, 'medium');
  eq('light team training does not create a hard exposure/day',
    [result.contributions.hardExposures, result.contributions.hardDay], [0, 0]);
  eq('light team training still contributes one anchor exposure per kernel rules',
    [result.contributions.conditioning, result.contributions.running, result.contributions.sprintCod], [1, 1, 1]);
}
for (const name of ['Game Day', 'Practice Match']) {
  const fixture = workout(name, { workoutType: 'Game', intensity: 'High' });
  const result = classifyVisibleSession(fixture);
  ok(`${name} is a game anchor`, result.anchors.game && category(result, 'game'), result);
  eq(`${name} is high and contributes conditioning/running/sprint-COD`, {
    stress: result.stressLevel,
    conditioning: result.contributions.conditioning,
    running: result.contributions.running,
    sprintCod: result.contributions.sprintCod,
  }, { stress: 'high', conditioning: 1, running: 1, sprintCod: 1 });
}

console.log('\n[2] strength regions, stress, and main-strength credit');
for (const test of [
  {
    name: 'Upper Body Strength',
    exercises: [exercise('Bench Press'), exercise('Barbell Row')],
    category: 'upper_strength',
    region: 'upper',
    stress: 'medium',
    hardDay: 0,
  },
  {
    name: 'Lower Body Strength',
    exercises: [exercise('Back Squat'), exercise('RDL')],
    category: 'lower_strength',
    region: 'lower',
    stress: 'high',
    hardDay: 1,
  },
  {
    name: 'Full Body Strength',
    exercises: [exercise('Back Squat'), exercise('Bench Press')],
    category: 'full_body_strength',
    region: 'full_body',
    stress: 'medium',
    hardDay: 0,
  },
] as const) {
  const input = workout(test.name, { exercises: test.exercises });
  const result = classifyVisibleSession(input);
  ok(`${test.name} uses canonical category`, category(result, test.category), result.categories);
  eq(`${test.name} uses canonical region/stress`,
    [result.strengthRegion, result.stressLevel], [test.region, test.stress]);
  eq(`${test.name} contributes one main strength and expected hard day`,
    [result.contributions.mainStrength, result.contributions.hardDay], [1, test.hardDay]);
  assertWeeklyParity(test.name, input, result);
}

console.log('\n[3] support and recovery components stay outside main credits');
for (const name of ['Gunshow', 'Prehab & Accessories', 'Upper body accessory pump']) {
  const result = classifyVisibleSession(workout(name, { intensity: 'Light' }));
  ok(`${name} stays gunshow/prehab`, category(result, 'gunshow_prehab'), result.categories);
  eq(`${name} has no main strength/conditioning/hard-day credit`, {
    mainStrength: result.contributions.mainStrength,
    conditioning: result.contributions.conditioning,
    hardDay: result.contributions.hardDay,
  }, { mainStrength: 0, conditioning: 0, hardDay: 0 });
}
{
  const recoveryAddon: RecoveryAddonBlock = {
    id: 'recovery-addon',
    title: 'Mobility reset',
    label: 'Mobility',
    kind: 'mobility',
    focusArea: 'mobility_reset',
    optional: true,
    skipPolicy: 'no_penalty',
    durationMinutes: 10,
    exercises: [],
    counting: {
      hardExposure: false,
      mainStrength: false,
      conditioningCredit: 'none',
      createsHardDay: false,
      sprintCodExposure: false,
    },
  };
  const base = workout('Recovery Session', {
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    intensity: 'Light',
  });
  const attached = { ...base, recoveryAddons: [recoveryAddon] };
  const withoutAddon = classifyVisibleSession(base);
  const withAddon = classifyVisibleSession(attached);
  eq('recovery_addon does not change classification contributions',
    withAddon.contributions, withoutAddon.contributions);
  eq('recovery_addon contributes no hard/conditioning/main strength credit', {
    hard: withAddon.contributions.hardExposures,
    conditioning: withAddon.contributions.conditioning,
    mainStrength: withAddon.contributions.mainStrength,
  }, { hard: 0, conditioning: 0, mainStrength: 0 });
}

console.log('\n[4] speed, conditioning component, and finisher ownership');
{
  const speedBlock: SpeedBlock = {
    id: 'speed-block',
    title: 'Acceleration exposure',
    label: 'Speed',
    kind: 'true_speed',
    placement: 'standalone',
    durationMinutes: 15,
    prescription: '4 x 20m accelerations',
    counting: {
      hardExposure: true,
      mainStrength: false,
      conditioningCredit: 'none',
      createsHardDay: true,
      sprintCodExposure: true,
    },
  };
  const speed = workout('Acceleration Exposure', { speedBlock, intensity: 'High' });
  const result = classifyVisibleSession(speed);
  ok('speedBlock classifies as sprint/COD', category(result, 'sprint'), result.categories);
  eq('speedBlock counts sprint/COD and running but not conditioning/main strength', {
    sprintCod: result.contributions.sprintCod,
    running: result.contributions.running,
    conditioning: result.contributions.conditioning,
    mainStrength: result.contributions.mainStrength,
  }, { sprintCod: 1, running: 1, conditioning: 0, mainStrength: 0 });
  eq('speedBlock is hard but has no conditioning ownership',
    [result.contributions.hardDay, conditioningRole(result)], [1, null]);
}
{
  const component = workout('Upper Body Strength + Tempo Conditioning', {
    workoutType: 'Mixed',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningCategory: 'tempo',
    conditioningFlavour: 'tempo',
    exercises: [exercise('Bench Press'), exercise('Barbell Row'), exercise('Tempo Conditioning Component - Bike')],
  });
  const result = classifyVisibleSession(component);
  eq('conditioning component contributes one conditioning exposure', result.contributions.conditioning, 1);
  eq('conditioning component keeps full component ownership',
    [conditioningRole(result), result.units.find((unit) => unit.contributions.conditioning > 0)?.conditioningCredit],
    ['component', 'full']);
}
{
  const finisher = workout('Lower Body Strength + Easy Aerobic Finisher', {
    workoutType: 'Mixed',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    conditioningCategory: 'aerobic_base',
    conditioningFlavour: 'aerobic',
    exercises: [exercise('Back Squat'), exercise('RDL'), exercise('Easy Bike')],
  });
  const result = classifyVisibleSession(finisher);
  eq('finisher preserves existing weekly conditioning exposure contribution', result.contributions.conditioning, 1);
  eq('finisher remains explicitly partial/finisher classification',
    [conditioningRole(result), result.units.find((unit) => unit.contributions.conditioning > 0)?.conditioningCredit],
    ['finisher', 'partial']);
  assertWeeklyParity('conditioning finisher', finisher, result);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
