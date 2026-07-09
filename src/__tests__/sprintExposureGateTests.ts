(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import type { OnboardingData, Workout } from '../types/domain';
import type {
  ActiveConstraint,
  ActiveFatigueConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  applyGenerationConstraintsToProfile,
  buildGenerationConstraintContext,
} from '../utils/generationConstraints';
import { evaluateSprintExposureGate } from '../rules/sprintExposureGate';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';

const TODAY = '2026-07-06';
const DAY_NUM: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T, detail?: string): void {
  ok(name, actual === expected, detail ?? `expected ${String(expected)}, got ${String(actual)}`);
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
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
  return {
    ...BASE_PROFILE,
    ...overrides,
  };
}

function injury(bodyPart: string, severity = 5): ActiveInjuryConstraint {
  return {
    id: `injury-${bodyPart}`,
    type: 'injury',
    bodyPart,
    bucket: bodyPart as any,
    region: 'lower_body',
    severity,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: TODAY,
    triggers: ['sprinting', 'high-speed running', 'change of direction'],
    rules: ['avoid sprint/COD while unsafe'],
    safeFocus: ['Upper strength', 'Easy bike'],
    advice: [],
  };
}

function fatigue(severity = 5): ActiveFatigueConstraint {
  return {
    id: `fatigue-${severity}`,
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: TODAY,
    reasonLabel: 'cooked',
    source: 'tap',
    rules: ['poor readiness', 'avoid sprint and hard conditioning'],
    safeFocus: ['Main lift if moving well', 'Easy recovery'],
    advice: [],
  };
}

function planFor(
  profileData: OnboardingData,
  constraints: ActiveConstraint[] = [],
): CoachingPlan {
  const context = buildGenerationConstraintContext({
    activeConstraints: constraints,
    todayISO: TODAY,
  });
  const constrainedProfile = applyGenerationConstraintsToProfile(profileData, context);
  return buildCoachingPlan(onboardingToCoachingInputs(constrainedProfile, {
    availabilityDateISO: TODAY,
    generationConstraints: context,
  }));
}

function sprintSessions(plan: CoachingPlan): SessionAllocation[] {
  return plan.weeklyPlan.filter((session) => session.conditioningCategory === 'sprint');
}

function planText(plan: CoachingPlan): string {
  return plan.weeklyPlan.map((session) =>
    [
      session.dayOfWeek,
      session.tier,
      session.focus,
      session.conditioningCategory,
      session.conditioningVariant,
      session.attachedConditioningKind,
    ].filter(Boolean).join(' '),
  ).join(' | ');
}

function workoutFromAllocation(session: SessionAllocation, index: number): Workout {
  const now = '2026-07-06T12:00:00.000Z';
  const dayOfWeek = session.dayOfWeek ? DAY_NUM[session.dayOfWeek] ?? index : index;
  const hasConditioning = !!session.conditioningCategory;
  const isStandaloneConditioning = hasConditioning && !session.hasCombinedConditioning && !session.strengthPattern;
  const workout: Workout = {
    id: `sp-gate-${index}`,
    microcycleId: 'sp-gate-week',
    dayOfWeek,
    name: session.isTeamDay ? `Team Training - ${session.focus}` : session.focus,
    description: session.focus,
    durationMinutes: 60,
    intensity: session.stressLevel === 'high' ? 'High' : session.stressLevel === 'low' ? 'Light' : 'Moderate',
    workoutType: isStandaloneConditioning ? 'Conditioning' : 'Strength',
    sessionTier: session.tier,
    hasCombinedConditioning: session.hasCombinedConditioning,
    attachedConditioningKind: session.attachedConditioningKind,
    conditioningFlavour: session.conditioningFlavour,
    conditioningCategory: session.conditioningCategory,
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
  if (session.isTeamDay) {
    (workout as unknown as { isTeamDay: boolean }).isTeamDay = true;
  }
  return workout;
}

function exposureCounts(plan: CoachingPlan) {
  return countWeeklyExposures(plan.weeklyPlan.map((session, index) => ({
    date: `2026-07-${String(6 + index).padStart(2, '0')}`,
    workout: workoutFromAllocation(session, index),
  })));
}

console.log('\n-- SP-1. Sprint exposure gate rule --');

{
  const gate = evaluateSprintExposureGate({
    phase: 'Pre-season',
    teamTrainingDays: [2, 4],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('pre-season 2 team trainings deny extra sprint', gate.allowStandaloneSprint, false, JSON.stringify(gate));
  eq('team trainings count toward sprint/COD target', gate.anchorSprintCodExposures, 2, JSON.stringify(gate));
}

{
  const gate = evaluateSprintExposureGate({
    phase: 'Pre-season',
    teamTrainingDays: [2],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('pre-season 1 team training allows one top-up', gate.allowStandaloneSprint, true, JSON.stringify(gate));
  eq('one existing team sprint exposure leaves one target exposure', gate.remainingSprintCodExposures, 1, JSON.stringify(gate));

  const afterTopUp = evaluateSprintExposureGate({
    phase: 'Pre-season',
    teamTrainingDays: [2],
    plannedOnFeetSprintExposures: 1,
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('pre-season 1 team training allows at most one top-up', afterTopUp.allowStandaloneSprint, false, JSON.stringify(afterTopUp));
}

{
  const gate = evaluateSprintExposureGate({
    phase: 'Pre-season',
    teamTrainingDays: [2],
    gameOrPracticeMatchDays: [6],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('practice match/game counts as sprint/COD exposure', gate.anchorSprintCodExposures, 2, JSON.stringify(gate));
  eq('practice match plus one team training denies extra sprint', gate.allowStandaloneSprint, false, JSON.stringify(gate));
}

{
  const gate = evaluateSprintExposureGate({
    phase: 'Pre-season',
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('pre-season 0 team/game exposures may allow sprint if healthy', gate.allowStandaloneSprint, true, JSON.stringify(gate));
}

{
  const gate = evaluateSprintExposureGate({
    phase: 'In-season',
    teamTrainingDays: [2, 4],
    gameOrPracticeMatchDays: [6],
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('in-season 2 team trainings plus game deny extra sprint', gate.allowStandaloneSprint, false, JSON.stringify(gate));
  eq('in-season anchors count as 3 sprint/COD exposures', gate.anchorSprintCodExposures, 3, JSON.stringify(gate));
}

{
  const injured = evaluateSprintExposureGate({
    phase: 'Pre-season',
    readinessAllowsSprint: true,
    injuryAllowsSprint: false,
  });
  eq('unsafe lower-limb injury denies sprint top-up', injured.allowStandaloneSprint, false, JSON.stringify(injured));

  const lowReadiness = evaluateSprintExposureGate({
    phase: 'Pre-season',
    readinessAllowsSprint: false,
    injuryAllowsSprint: true,
  });
  eq('low readiness denies sprint top-up', lowReadiness.allowStandaloneSprint, false, JSON.stringify(lowReadiness));
}

console.log('\n-- SP-1. Generation consults the gate --');

{
  const plan = planFor(profile({
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
  }));
  eq('pre-season with 2 team trainings adds no extra sprint/COD', sprintSessions(plan).length, 0, planText(plan));
}

{
  const plan = planFor(profile({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Wednesday'],
  }));
  ok('pre-season with 1 team training allows at most 1 app sprint top-up',
    sprintSessions(plan).length <= 1,
    planText(plan));
}

{
  const plan = planFor(profile({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
    gameDay: 'Saturday',
  }));
  eq('pre-season practice match/game plus team training adds no extra sprint/COD', sprintSessions(plan).length, 0, planText(plan));
}

{
  const plan = planFor(profile({
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }));
  ok('pre-season with 0 team/game exposures may add up to one sprint if healthy',
    sprintSessions(plan).length <= 1,
    planText(plan));
}

{
  const plan = planFor(profile({
    seasonPhase: 'In-season',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    gameDay: 'Saturday',
  }));
  eq('in-season with 2 team trainings plus game adds no extra sprint/COD', sprintSessions(plan).length, 0, planText(plan));
}

for (const bodyPart of ['hamstring', 'groin', 'calf', 'Achilles', 'knee', 'ankle', 'hip']) {
  const plan = planFor(profile(), [injury(bodyPart, 5)]);
  eq(`${bodyPart} issue denies extra sprint when unsafe`, sprintSessions(plan).length, 0, planText(plan));
}

{
  const plan = planFor(profile(), [fatigue(5)]);
  eq('low readiness denies/downgrades sprint/COD before placement', sprintSessions(plan).length, 0, planText(plan));
}

{
  const plan = planFor(profile());
  const bad = sprintSessions(plan).filter((session) =>
    session.hasCombinedConditioning || session.attachedConditioningKind === 'finisher',
  );
  eq('sprint/COD is never placed as a finisher', bad.length, 0, planText(plan));
}

{
  const plan = planFor(profile());
  const sprintCount = sprintSessions(plan).length;
  const counts = exposureCounts(plan);
  eq('app sprint/COD counts as sprint/COD exposure', counts.sprintCodExposures, sprintCount, JSON.stringify(counts.byCategory));
  eq('app sprint/COD does not count as normal conditioning', counts.conditioningExposures, counts.extraConditioningSessions, JSON.stringify(counts.byCategory));
}

{
  const healthy = planFor(profile({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Wednesday'],
  }));
  ok('healthy normal pre-season week still produces useful work',
    healthy.weeklyPlan.length >= 4 && healthy.weeklyPlan.some((session) => !!session.strengthPattern),
    planText(healthy));
  ok('healthy normal pre-season week stays within sprint/COD cap',
    exposureCounts(healthy).sprintCodExposures <= 3,
    planText(healthy));
}

if (fail > 0) {
  console.error(`\nSP-1 sprint exposure gate tests failed: ${fail}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`\nSP-1 sprint exposure gate tests passed: ${pass}`);
