(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — pre-season subphase generation must be deterministic');
};

import type { OnboardingData } from '../types/domain';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type OnboardingToCoachingInputsOptions,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  resolvePreseasonSubphase,
  type PreseasonSubphase,
} from '../rules/preseasonSubphase';
import { getPreseasonSubphasePolicy } from '../rules/preseasonSubphasePolicy';
import { evaluateSprintExposureGate } from '../rules/sprintExposureGate';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail === undefined ? '' : `\n      ${String(detail)}`}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard',
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Barbell', 'Dumbbells', 'Bench', 'Cable machine'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Elite',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Strength, speed, repeat efforts',
};

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return { ...BASE_PROFILE, ...overrides };
}

function planFor(
  data: OnboardingData,
  options: Partial<OnboardingToCoachingInputsOptions>,
): SessionAllocation[] {
  return buildCoachingPlan(onboardingToCoachingInputs(data, {
    availabilityDateISO: '2026-07-06',
    ...options,
  })).weeklyPlan;
}

function strengthSessions(plan: SessionAllocation[]): SessionAllocation[] {
  return plan.filter((session) => !!session.strengthPattern);
}

function appConditioning(plan: SessionAllocation[]): SessionAllocation[] {
  return plan.filter((session) => !!session.conditioningCategory);
}

function hardConditioning(plan: SessionAllocation[]): SessionAllocation[] {
  return appConditioning(plan).filter((session) =>
    session.conditioningCategory === 'vo2' ||
    session.conditioningCategory === 'glycolytic' ||
    session.conditioningCategory === 'sprint',
  );
}

function speedTopUps(plan: SessionAllocation[]): SessionAllocation[] {
  return plan.filter((session) =>
    session.speedWorkKind === 'true_speed' || session.conditioningCategory === 'sprint',
  );
}

function teamAnchors(plan: SessionAllocation[]): SessionAllocation[] {
  return plan.filter((session) => session.isTeamDay);
}

function planText(plan: SessionAllocation[]): string {
  return plan.map((session) => [
    session.dayOfWeek,
    session.tier,
    session.strengthPattern,
    session.conditioningCategory,
    session.conditioningVariant,
    session.speedWorkKind,
    session.isTeamDay ? 'TEAM' : '',
  ].filter(Boolean).join(':')).join(' | ');
}

console.log('\n-- Pre-season subphase resolver and policy --');

eq('week 1 resolves early pre-season',
  resolvePreseasonSubphase({ seasonPhase: 'Pre-season', weekInBlock: 1 }),
  'early_preseason');
eq('week 2 resolves mid pre-season',
  resolvePreseasonSubphase({ seasonPhase: 'Pre-season', weekInBlock: 2 }),
  'mid_preseason');
eq('week 3 resolves mid pre-season',
  resolvePreseasonSubphase({ seasonPhase: 'Pre-season', weekInBlock: 3 }),
  'mid_preseason');
eq('week 4 resolves late pre-season',
  resolvePreseasonSubphase({ seasonPhase: 'Pre-season', weekInBlock: 4 }),
  'late_preseason');
eq('global week state wraps into the current four-week block',
  resolvePreseasonSubphase({ seasonPhase: 'Pre-season', weekNumber: 5 }),
  'early_preseason');
eq('missing pre-season week defaults to mid',
  resolvePreseasonSubphase({ seasonPhase: 'Pre-season' }),
  'mid_preseason');
eq('explicit override wins for deterministic simulations',
  resolvePreseasonSubphase({
    seasonPhase: 'Pre-season',
    weekInBlock: 2,
    explicitSubphase: 'late_preseason',
  }),
  'late_preseason');
eq('non-pre-season phases do not resolve a pre-season subphase',
  resolvePreseasonSubphase({ seasonPhase: 'Off-season', weekInBlock: 1 }),
  null);

{
  const early = getPreseasonSubphasePolicy('early_preseason', { teamTrainingExposures: 2 });
  const mid = getPreseasonSubphasePolicy('mid_preseason', { teamTrainingExposures: 2 });
  const lateMatch = getPreseasonSubphasePolicy('late_preseason', {
    teamTrainingExposures: 2,
    hasPracticeMatch: true,
  });
  eq('early pre-season uses reduced hard-conditioning dose', early.conditioning.hardDose, 'reduced');
  eq('early pre-season avoids large combined days', early.sessions.combinedStrengthConditioning, 'avoid');
  eq('mid pre-season keeps the full strength build ceiling', mid.strength.coreSessionCap, 4);
  eq('late practice-match week adds no app-side hard conditioning', lateMatch.conditioning.hardSessionCap, 0);
  eq('late practice match satisfies sprint/COD top-up need', lateMatch.speedSprint.practiceMatchSatisfiesTarget, true);
}

console.log('\n-- Sprint/COD top-up by pre-season subphase --');

{
  const early = evaluateSprintExposureGate({
    phase: 'Pre-season',
    preseasonSubphase: 'early_preseason',
    teamTrainingDays: [2],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('early pre-season one team exposure meets progressive sprint target', early.target, 1);
  eq('early pre-season does not add sprint on top of that team exposure', early.allowStandaloneSprint, false);

  const mid = evaluateSprintExposureGate({
    phase: 'Pre-season',
    preseasonSubphase: 'mid_preseason',
    teamTrainingDays: [2],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('mid pre-season retains the Bible target of two sprint/COD exposures', mid.target, 2);
  eq('mid pre-season may fill a genuine one-exposure gap', mid.allowStandaloneSprint, true);

  const lateMatch = evaluateSprintExposureGate({
    phase: 'Pre-season',
    preseasonSubphase: 'late_preseason',
    gameOrPracticeMatchDays: [6],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('late practice match blocks extra sprint/COD', lateMatch.allowStandaloneSprint, false);
}

console.log('\n-- Early, mid and late generation behaviour --');

const earlyPlan = planFor(BASE_PROFILE, {
  weekInBlock: 1,
  weekNumber: 1,
  weekKind: 'build',
});
eq('early pre-season exposure contract keeps four meaningful strength sessions',
  strengthSessions(earlyPlan).length,
  4);
ok('early pre-season exposure contract covers squat, hinge, push and pull',
  (['squat', 'hinge', 'push', 'pull'] as const).every((pattern) =>
    earlyPlan.some((session) => session.strengthIntent?.plannedPatterns?.includes(pattern))),
  planText(earlyPlan));
eq('early pre-season places the two app conditioning remainders on valid strength days',
  earlyPlan.filter((session) => session.hasCombinedConditioning).length,
  2);
ok('early pre-season keeps hard conditioning controlled',
  hardConditioning(earlyPlan).length <= 1 &&
    hardConditioning(earlyPlan).every((session) => session.conditioningVariant === 'reduced'),
  planText(earlyPlan));
eq('early pre-season team anchors cover sprint/COD without an app top-up',
  speedTopUps(earlyPlan).length,
  0);
eq('early pre-season preserves both team anchors', teamAnchors(earlyPlan).length, 2);

const earlyNoTeamPlan = planFor(profile({
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
}), {
  weekInBlock: 1,
  weekNumber: 1,
  weekKind: 'build',
});
ok('early pre-season without field anchors still builds conditioning progressively',
  appConditioning(earlyNoTeamPlan).length >= 1 &&
    appConditioning(earlyNoTeamPlan).every((session) =>
      session.conditioningCategory === 'aerobic_base' ||
      session.conditioningCategory === 'tempo' ||
      session.conditioningCategory === 'vo2'),
  planText(earlyNoTeamPlan));
ok('early pre-season hard conditioning is always the reduced dose',
  hardConditioning(earlyNoTeamPlan).every((session) => session.conditioningVariant === 'reduced'),
  planText(earlyNoTeamPlan));

const midPlan = planFor(BASE_PROFILE, {
  weekInBlock: 2,
  weekNumber: 2,
  weekKind: 'build',
});
ok('mid pre-season keeps meaningful strength work',
  strengthSessions(midPlan).length >= 3,
  planText(midPlan));
ok('mid pre-season keeps meaningful conditioning including team anchors',
  teamAnchors(midPlan).length + appConditioning(midPlan).length >= 3,
  planText(midPlan));
eq('mid pre-season preserves both team anchors', teamAnchors(midPlan).length, 2);

const lateMatchProfile = profile({
  gameDay: 'Saturday',
  usualGameDay: 'Saturday',
});
const latePlan = planFor(lateMatchProfile, {
  weekInBlock: 4,
  weekNumber: 4,
  weekKind: 'build',
});
ok('late pre-season controls strength volume around practice match load',
  strengthSessions(latePlan).length <= 3,
  planText(latePlan));
eq('late pre-season practice-match week adds no hard conditioning',
  hardConditioning(latePlan).length,
  0);
eq('late pre-season practice-match week adds no extra sprint/COD',
  speedTopUps(latePlan).length,
  0);
eq('late pre-season avoids large combined S+C days',
  latePlan.filter((session) => session.hasCombinedConditioning).length,
  0);
eq('late pre-season preserves both team anchors', teamAnchors(latePlan).length, 2);
{
  const friday = latePlan.find((session) => session.dayOfWeek === 'Friday');
  const thursday = latePlan.find((session) => session.dayOfWeek === 'Thursday');
  ok('practice-match G-1 remains light and free of lower/conditioning work',
    !!friday &&
      friday.tier !== 'core' &&
      !friday.strengthPattern &&
      !friday.conditioningCategory &&
      !friday.speedWorkKind,
    planText(latePlan));
  ok('practice-match G-2 keeps the team anchor without extra conditioning',
    !!thursday && thursday.isTeamDay === true && !thursday.conditioningCategory,
    planText(latePlan));
}

console.log('\n-- Readiness and beginner precedence --');

const LOW_PROFILE = profile({
  recentTrainingLoad: 'Hardly at all',
  conditioningLevel: 'Poor',
  sprintExposure: 'No sprint training',
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
});
for (const [subphase, weekInBlock] of [
  ['early_preseason', 1],
  ['mid_preseason', 2],
  ['late_preseason', 4],
] as Array<[PreseasonSubphase, number]>) {
  const plan = planFor(LOW_PROFILE, {
    preseasonSubphase: subphase,
    weekInBlock,
    weekNumber: weekInBlock,
    weekKind: 'build',
  });
  ok(`${subphase} low readiness caps strength at two`,
    strengthSessions(plan).length <= 2,
    planText(plan));
  eq(`${subphase} low readiness removes hard conditioning`, hardConditioning(plan).length, 0);
  eq(`${subphase} low readiness removes sprint top-ups`, speedTopUps(plan).length, 0);
  eq(`${subphase} low readiness avoids combined S+C`,
    plan.filter((session) => session.hasCombinedConditioning).length,
    0);
}

{
  const beginner = planFor(profile({
    experienceLevel: 'Complete beginner',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }), {
    preseasonSubphase: 'mid_preseason',
    weekInBlock: 2,
    weekNumber: 2,
    weekKind: 'build',
  });
  ok('beginner pre-season retains the beginner core-session cap',
    strengthSessions(beginner).length <= 2,
    planText(beginner));
  eq('beginner pre-season retains the no-combined-day policy',
    beginner.filter((session) => session.hasCombinedConditioning).length,
    0);
}

console.log(`\npreseasonSubphaseTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
