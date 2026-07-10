/**
 * Conditioning ownership through in-season push/pull balance repair.
 *
 * Run: sucrase-node src/__tests__/conditioningBalanceRepairTests.ts
 */

import {
  enforceInSeasonPushPullBalance,
  onboardingToCoachingInputs,
  type CoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import type { OnboardingData } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `: ${detail}` : ''));
    console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`);
  }
}

function inputs(overrides: Partial<OnboardingData> = {}): CoachingInputs {
  return onboardingToCoachingInputs({
    seasonPhase: 'In-season',
    experienceLevel: '2-5 years',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    sprintExposure: 'Occasionally',
    injuries: [],
    ...overrides,
  });
}

function hasPushPull(plan: SessionAllocation[]): boolean {
  const coversPush = plan.some((session) =>
    session.strengthPattern === 'push' ||
    session.strengthPattern === 'upper_combined' ||
    session.strengthPattern === 'full_body');
  const coversPull = plan.some((session) =>
    session.strengthPattern === 'pull' ||
    session.strengthPattern === 'upper_combined' ||
    session.strengthPattern === 'full_body');
  return coversPush && coversPull;
}

function conditioningCount(plan: SessionAllocation[]): number {
  return plan.filter((session) =>
    !!session.conditioningCategory || !!session.hasCombinedConditioning).length;
}

console.log('\n[1] planned component survives balance repair');
{
  const component: SessionAllocation = {
    tier: 'optional',
    focus: 'Optional support + controlled tempo conditioning component (20-24min)',
    dayOfWeek: 'Monday',
    isHardExposure: false,
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningFlavour: 'tempo',
    conditioningCategory: 'tempo',
    conditioningVariant: 'reduced',
    conditioningFeel: 'controlled',
  };
  const teamDay: SessionAllocation = {
    tier: 'core',
    focus: 'Team training - field session',
    dayOfWeek: 'Tuesday',
    isHardExposure: true,
    isTeamDay: true,
  };
  const lower: SessionAllocation = {
    tier: 'core',
    focus: 'Lower body strength',
    dayOfWeek: 'Wednesday',
    isHardExposure: true,
    strengthPattern: 'lower',
  };
  const plan = [component, teamDay, lower];
  enforceInSeasonPushPullBalance(plan, inputs({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
  }));

  ok('component metadata remains intact',
    component.hasCombinedConditioning === true &&
      component.attachedConditioningKind === 'component' &&
      component.conditioningCategory === 'tempo',
    JSON.stringify(component));
  ok('component copy remains intact', /conditioning component/i.test(component.focus), component.focus);
  ok('repair still restores push and pull through another safe path',
    hasPushPull(plan),
    plan.map((session) => `${session.dayOfWeek}:${session.strengthPattern ?? '-'}`).join(', '));
  ok('lower strength remains present',
    plan.some((session) => session.strengthPattern === 'lower'));

  const upperComponent: SessionAllocation = {
    tier: 'core',
    focus: 'Upper body - push emphasis + controlled tempo conditioning component (20-24min)',
    dayOfWeek: 'Monday',
    isHardExposure: false,
    strengthPattern: 'push',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningFlavour: 'tempo',
    conditioningCategory: 'tempo',
  };
  const inPlacePlan = [upperComponent, { ...lower }];
  enforceInSeasonPushPullBalance(inPlacePlan, inputs());
  ok('in-place upper promotion preserves component ownership',
    upperComponent.strengthPattern === 'upper_combined' &&
      upperComponent.hasCombinedConditioning === true &&
      upperComponent.attachedConditioningKind === 'component' &&
      upperComponent.conditioningCategory === 'tempo',
    JSON.stringify(upperComponent));
  ok('in-place upper promotion preserves visible component wording',
    /conditioning component/i.test(upperComponent.focus),
    upperComponent.focus);
}

console.log('\n[2] finisher remains removable garnish');
{
  const finisher: SessionAllocation = {
    tier: 'optional',
    focus: 'Optional support + easy aerobic finisher (10min)',
    dayOfWeek: 'Monday',
    isHardExposure: false,
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
  };
  const lower: SessionAllocation = {
    tier: 'core',
    focus: 'Lower body strength',
    dayOfWeek: 'Tuesday',
    isHardExposure: true,
    strengthPattern: 'lower',
  };
  const plan = [finisher, lower];
  enforceInSeasonPushPullBalance(plan, inputs({
    trainingDaysPerWeek: 2,
    preferredTrainingDays: ['Monday', 'Tuesday'],
  }));

  ok('finisher can be removed to host required upper balance',
    !finisher.hasCombinedConditioning &&
      finisher.attachedConditioningKind === undefined &&
      finisher.conditioningCategory === undefined,
    JSON.stringify(finisher));
  ok('finisher removal still restores push and pull', hasPushPull(plan));
}

console.log('\n[3] valid conditioning removal re-checks game-week floor');
{
  const standalone: SessionAllocation = {
    tier: 'optional',
    focus: 'Aerobic base - 25min easy bike',
    dayOfWeek: 'Monday',
    isHardExposure: false,
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
  };
  const tuesdayLower: SessionAllocation = {
    tier: 'core',
    focus: 'Lower body strength',
    dayOfWeek: 'Tuesday',
    isHardExposure: true,
    strengthPattern: 'lower',
  };
  const wednesdayLower: SessionAllocation = {
    tier: 'core',
    focus: 'Lower body strength support',
    dayOfWeek: 'Wednesday',
    isHardExposure: true,
    strengthPattern: 'lower_combined',
  };
  const thursday: SessionAllocation = {
    tier: 'recovery',
    focus: 'Mobility, foam rolling, light movement',
    dayOfWeek: 'Thursday',
    isHardExposure: false,
  };
  const friday: SessionAllocation = {
    tier: 'recovery',
    focus: 'Mobility, foam rolling, light movement',
    dayOfWeek: 'Friday',
    isHardExposure: false,
  };
  const plan = [standalone, tuesdayLower, wednesdayLower, thursday, friday];
  const gameInputs = inputs({
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    conditioningLevel: 'Elite',
  });
  const before = conditioningCount(plan);
  enforceInSeasonPushPullBalance(plan, gameInputs);

  ok('test starts with one real conditioning exposure', before === 1, `before=${before}`);
  ok('balance repair restores push and pull', hasPushPull(plan));
  ok('game-week conditioning floor remains satisfied after repair',
    conditioningCount(plan) >= 1,
    plan.map((session) =>
      `${session.dayOfWeek}:${session.conditioningCategory ?? '-'}:${session.attachedConditioningKind ?? '-'}`).join(', '));
}

console.log(`\nconditioningBalanceRepairTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.error(failures.map((failure) => `  - ${failure}`).join('\n'));
process.exit(fail > 0 ? 1 : 0);
