/**
 * Generation-side bridge to the shared Programming Bible classifier.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildCoachingPlan,
  classifyGenerationSession,
  onboardingToCoachingInputs,
  type GenerationSessionClassificationInput,
  type SessionAllocation,
} from '../utils/coachingEngine';
import type {
  OnboardingData,
  RecoveryAddonBlock,
  SpeedBlock,
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

function classify(
  overrides: Partial<GenerationSessionClassificationInput>,
  context: Parameters<typeof classifyGenerationSession>[1] = {},
) {
  return classifyGenerationSession({
    focus: 'Session',
    tier: 'core',
    ...overrides,
  }, context);
}

const speedBlock: SpeedBlock = {
  id: 'generation-speed',
  title: 'Quality Speed Micro-dose',
  label: 'Speed',
  kind: 'true_speed',
  placement: 'pre_lift',
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

const recoveryAddon: RecoveryAddonBlock = {
  id: 'generation-recovery-addon',
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

console.log('generationClassificationAdapterTests');

console.log('\n[1] strength candidate stress and region use the kernel');
for (const test of [
  { pattern: 'push', category: 'upper_strength', region: 'upper', stress: 'medium', hardDay: 0 },
  { pattern: 'pull', category: 'upper_strength', region: 'upper', stress: 'medium', hardDay: 0 },
  { pattern: 'lower', category: 'lower_strength', region: 'lower', stress: 'high', hardDay: 1 },
  { pattern: 'lower_combined', category: 'lower_strength', region: 'lower', stress: 'high', hardDay: 1 },
  { pattern: 'full_body', category: 'full_body_strength', region: 'full_body', stress: 'medium', hardDay: 0 },
] as const) {
  const result = classify({
    focus: `${test.pattern} candidate`,
    strengthPattern: test.pattern,
  });
  ok(`${test.pattern} maps to ${test.category}`,
    result.categories.includes(test.category), result.categories);
  eq(`${test.pattern} region/stress/hard-day contribution`, {
    region: result.strengthRegion,
    stress: result.stressLevel,
    hardDay: result.contributions.hardDay,
    mainStrength: result.contributions.mainStrength,
  }, {
    region: test.region,
    stress: test.stress,
    hardDay: test.hardDay,
    mainStrength: 1,
  });
}
eq('complete beginner upper follows kernel context shift',
  classify({ focus: 'Upper', strengthPattern: 'push' }, { experienceLevel: 'Complete beginner' }).stressLevel,
  'high');

console.log('\n[2] team and fixture anchors use shared stress/exposure rules');
{
  const hardTeam = classify({ focus: 'Team Training', isTeamDay: true }, {
    teamTrainingIntensity: 'Hard',
  });
  eq('hard team anchor classification', {
    anchor: hardTeam.anchors.teamTraining,
    stress: hardTeam.stressLevel,
    hardDay: hardTeam.contributions.hardDay,
    conditioning: hardTeam.contributions.conditioning,
    running: hardTeam.contributions.running,
    sprintCod: hardTeam.contributions.sprintCod,
  }, {
    anchor: true,
    stress: 'high',
    hardDay: 1,
    conditioning: 1,
    running: 1,
    sprintCod: 1,
  });

  const lightTeam = classify({ focus: 'Light Team Training', isTeamDay: true }, {
    teamTrainingIntensity: 'Light',
  });
  eq('light team anchor is medium and does not create a hard day', {
    anchor: lightTeam.anchors.teamTraining,
    stress: lightTeam.stressLevel,
    hardDay: lightTeam.contributions.hardDay,
  }, { anchor: true, stress: 'medium', hardDay: 0 });
}
for (const focus of ['Game Day', 'Practice Match']) {
  const fixture = classify({ focus, workoutType: 'Game', intensity: 'High' });
  eq(`${focus} fixture classification`, {
    anchor: fixture.anchors.game,
    stress: fixture.stressLevel,
    conditioning: fixture.contributions.conditioning,
    running: fixture.contributions.running,
    sprintCod: fixture.contributions.sprintCod,
  }, { anchor: true, stress: 'high', conditioning: 1, running: 1, sprintCod: 1 });
}

console.log('\n[3] accessory, recovery, speed, component, and finisher fences');
for (const focus of ['Gunshow', 'Low-fatigue accessories - trunk, calves, groin, shoulder prehab']) {
  const support = classify({ focus, tier: 'optional' });
  eq(`${focus} has no main/hard/conditioning credit`, {
    main: support.contributions.mainStrength,
    hard: support.contributions.hardDay,
    conditioning: support.contributions.conditioning,
  }, { main: 0, hard: 0, conditioning: 0 });
}
{
  const base = classify({ focus: 'Recovery Session', tier: 'recovery' });
  const withAddon = classify({
    focus: 'Recovery Session',
    tier: 'recovery',
    recoveryAddons: [recoveryAddon],
  });
  eq('recovery_addon preserves zero-credit recovery classification',
    withAddon.contributions, base.contributions);
  eq('recovery_addon creates no hard/conditioning/main strength credit', {
    hard: withAddon.contributions.hardDay,
    conditioning: withAddon.contributions.conditioning,
    main: withAddon.contributions.mainStrength,
  }, { hard: 0, conditioning: 0, main: 0 });
}
{
  const speed = classify({
    focus: 'Quality Speed Micro-dose + Upper strength',
    strengthPattern: 'push',
    speedBlock,
  });
  eq('speedBlock counts sprint/COD but not conditioning', {
    sprintCod: speed.contributions.sprintCod,
    conditioning: speed.contributions.conditioning,
    hardDay: speed.contributions.hardDay,
  }, { sprintCod: 1, conditioning: 0, hardDay: 1 });
}
{
  const component = classify({
    focus: 'Upper strength + controlled tempo component',
    strengthPattern: 'upper_combined',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningFlavour: 'tempo',
    conditioningCategory: 'tempo',
  });
  const conditioningUnit = component.units.find((unit) => unit.contributions.conditioning > 0);
  eq('conditioning component receives full conditioning classification', {
    contribution: component.contributions.conditioning,
    role: conditioningUnit?.conditioningRole,
    credit: conditioningUnit?.conditioningCredit,
  }, { contribution: 1, role: 'component', credit: 'full' });
}
eq('optional-tier hard conditioning remains a high-stress exposure',
  classify({
    focus: 'VO2 intervals',
    tier: 'optional',
    conditioningFlavour: 'high-intensity',
    conditioningCategory: 'vo2',
  }).stressLevel,
  'high');
{
  const finisher = classify({
    focus: 'Lower strength + easy aerobic finisher',
    strengthPattern: 'lower',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
  });
  const conditioningUnit = finisher.units.find((unit) => unit.contributions.conditioning > 0);
  eq('finisher remains garnish/partial classification', {
    role: conditioningUnit?.conditioningRole,
    credit: conditioningUnit?.conditioningCredit,
  }, { role: 'finisher', credit: 'partial' });
}

console.log('\n[4] generated candidate stress metadata stays adapter-aligned');
const profiles: Array<[string, Partial<OnboardingData>]> = [
  ['off-season', {
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    experienceLevel: '2-5 years',
    injuries: [],
  }],
  ['pre-season light team', {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Light',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    experienceLevel: '2-5 years',
    injuries: [],
  }],
];

for (const [label, profile] of profiles) {
  const inputs = onboardingToCoachingInputs(profile as OnboardingData);
  const plan = buildCoachingPlan(inputs).weeklyPlan;
  const context = {
    experienceLevel: inputs.experienceLevel,
    conditioningLevel: inputs.conditioningLevel,
    teamTrainingIntensity: inputs.teamTrainingIntensity,
  };
  const mismatches = plan.filter((session: SessionAllocation) =>
    session.stressLevel !== classifyGenerationSession(session, context).stressLevel);
  ok(`${label} generated stressLevel matches adapter for every session`,
    mismatches.length === 0,
    mismatches.map((session) => ({
      day: session.dayOfWeek,
      focus: session.focus,
      actual: session.stressLevel,
      expected: classifyGenerationSession(session, context).stressLevel,
    })));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
