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
  type OnboardingToCoachingInputsOptions,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  applyGenerationConstraintsToProfile,
  buildGenerationConstraintContext,
} from '../utils/generationConstraints';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { generateProgramLocally } from '../services/api/generateProgram';
import { evaluateSprintExposureGate } from '../rules/sprintExposureGate';
import { resolveOffseasonSubphase } from '../rules/offseasonSubphase';
import { selectLateOffseasonSpeedTemplate } from '../rules/speedTemplates';
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
  inputOptions: Partial<OnboardingToCoachingInputsOptions> = {},
): CoachingPlan {
  const context = buildGenerationConstraintContext({
    activeConstraints: constraints,
    todayISO: TODAY,
  });
  const constrainedProfile = applyGenerationConstraintsToProfile(profileData, context);
  return buildCoachingPlan(onboardingToCoachingInputs(constrainedProfile, {
    ...inputOptions,
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
      session.speedWorkKind,
    ].filter(Boolean).join(' '),
  ).join(' | ');
}

function builtWorkoutsFor(
  plan: CoachingPlan,
  profileData: OnboardingData = BASE_PROFILE,
): Workout[] {
  return buildWorkoutsFromCoach([], 'sp-speed-micro-dose', plan.weeklyPlan, profileData);
}

function speedWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter((workout) => workout.speedBlock?.kind === 'true_speed');
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
    teamTrainingDays: [2],
    gameOrPracticeMatchDays: [6],
    weekKind: 'deload',
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('pre-season deload still counts team/game anchors',
    gate.anchorSprintCodExposures,
    2,
    JSON.stringify(gate));
  eq('pre-season deload denies only app-added sprint',
    gate.allowStandaloneSprint,
    false,
    JSON.stringify(gate));
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
  eq('off-season week 1 resolves early',
    resolveOffseasonSubphase({ seasonPhase: 'Off-season', miniCycleNumber: 1, weekInBlock: 1 }),
    'early_offseason');
  eq('off-season week 3 resolves mid',
    resolveOffseasonSubphase({ seasonPhase: 'Off-season', miniCycleNumber: 1, weekInBlock: 3 }),
    'mid_offseason');
  eq('off-season week 4 resolves late',
    resolveOffseasonSubphase({ seasonPhase: 'Off-season', miniCycleNumber: 1, weekInBlock: 4 }),
    'late_offseason');
  eq('unknown off-season week defaults conservatively to early',
    resolveOffseasonSubphase({ seasonPhase: 'Off-season' }),
    'early_offseason');
}

{
  const early = evaluateSprintExposureGate({
    phase: 'Off-season',
    offseasonSubphase: 'early_offseason',
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('early off-season denies app-added sprint', early.allowStandaloneSprint, false, JSON.stringify(early));

  const mid = evaluateSprintExposureGate({
    phase: 'Off-season',
    offseasonSubphase: 'mid_offseason',
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('mid off-season denies app-added sprint for now', mid.allowStandaloneSprint, false, JSON.stringify(mid));

  const late = evaluateSprintExposureGate({
    phase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('late off-season may allow one app-added sprint if healthy', late.allowStandaloneSprint, true, JSON.stringify(late));
  eq('late off-season target is one sprint/COD exposure', late.target, 1, JSON.stringify(late));

  const lateDeload = evaluateSprintExposureGate({
    phase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    weekKind: 'deload',
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('late off-season deload denies app-added sprint',
    lateDeload.allowStandaloneSprint,
    false,
    JSON.stringify(lateDeload));
  eq('late off-season deload keeps the late-offseason speed target visible',
    lateDeload.target,
    1,
    JSON.stringify(lateDeload));

  const afterTopUp = evaluateSprintExposureGate({
    phase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    plannedOnFeetSprintExposures: 1,
    readinessAllowsSprint: true,
    injuryAllowsSprint: true,
  });
  eq('late off-season allows at most one app-added sprint', afterTopUp.allowStandaloneSprint, false, JSON.stringify(afterTopUp));
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

console.log('\n-- SP-2. Quality sprint micro-dose output --');

{
  const p = profile({
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  });
  const plan = planFor(p);
  const workouts = builtWorkoutsFor(plan, p);
  const speed = speedWorkouts(workouts);
  eq('pre-season with 0 anchor exposures may add one quality sprint micro-dose',
    speed.length,
    1,
    workouts.map((workout) => `${workout.dayOfWeek}: ${workout.name}`).join(' | '));
  ok('speed micro-dose has acceleration/build-up prescription',
    /10-20m|acceleration|build-up/i.test(speed[0]?.speedBlock?.prescription ?? '') &&
    (speed[0]?.exercises ?? []).some((exercise) => /acceleration|build-up/i.test(exercise.exercise?.name ?? '')),
    JSON.stringify(speed[0]?.speedBlock));
}

{
  const p = profile({
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Wednesday'],
  });
  const plan = planFor(p);
  const speed = speedWorkouts(builtWorkoutsFor(plan, p));
  ok('pre-season with 1 anchor exposure adds at most one quality sprint micro-dose',
    speed.length <= 1,
    speed.map((workout) => workout.name).join(' | '));
}

{
  const p = profile({
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
  });
  const plan = planFor(p);
  eq('pre-season with 2+ anchor exposures adds no sprint micro-dose',
    speedWorkouts(builtWorkoutsFor(plan, p)).length,
    0,
    planText(plan));
}

{
  const p = profile({
    seasonPhase: 'In-season',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    gameDay: 'Saturday',
  });
  const plan = planFor(p);
  eq('in-season still adds no extra sprint micro-dose',
    speedWorkouts(builtWorkoutsFor(plan, p)).length,
    0,
    planText(plan));
}

{
  const p = profile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: undefined,
  });
  const plan = planFor(p, [], { miniCycleNumber: 1, weekInBlock: 1, weekNumber: 1 });
  eq('early off-season still adds no sprint',
    speedWorkouts(builtWorkoutsFor(plan, p)).length,
    0,
    planText(plan));
}

console.log('\n-- SP-3. Late off-season sprint subphase --');

{
  const p = profile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: undefined,
  });
  const early = planFor(p, [], { miniCycleNumber: 1, weekInBlock: 1, weekNumber: 1 });
  const mid = planFor(p, [], { miniCycleNumber: 1, weekInBlock: 3, weekNumber: 3 });
  const late = planFor(p, [], {
    miniCycleNumber: 1,
    weekInBlock: 4,
    weekNumber: 4,
    weekKind: 'build',
  });
  eq('early off-season generation denies app-added sprint',
    speedWorkouts(builtWorkoutsFor(early, p)).length,
    0,
    planText(early));
  eq('mid off-season generation denies app-added sprint for now',
    speedWorkouts(builtWorkoutsFor(mid, p)).length,
    0,
    planText(mid));
  eq('late off-season generation may add one quality sprint micro-dose',
    speedWorkouts(builtWorkoutsFor(late, p)).length,
    1,
    planText(late));
  const lateDeload = planFor(p, [], {
    miniCycleNumber: 1,
    weekInBlock: 4,
    weekNumber: 4,
    weekKind: 'deload',
  });
  eq('late off-season deload generation denies app-added sprint',
    speedWorkouts(builtWorkoutsFor(lateDeload, p)).length,
    0,
    planText(lateDeload));
  ok('healthy non-sprint off-season week still has useful strength',
    early.weeklyPlan.some((session) => !!session.strengthPattern) &&
    early.weeklyPlan.length >= 4,
    planText(early));
}

{
  const p = profile({
    seasonPhase: 'Pre-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  });
  const plan = planFor(p, [], { weekKind: 'deload' });
  eq('pre-season deload generation denies app-added sprint micro-dose',
    speedWorkouts(builtWorkoutsFor(plan, p)).length,
    0,
    planText(plan));
}

for (const bodyPart of ['hamstring', 'groin', 'calf', 'Achilles', 'knee', 'ankle', 'hip']) {
  const p = profile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: undefined,
  });
  const late = planFor(p, [injury(bodyPart, 5)], {
    miniCycleNumber: 1,
    weekInBlock: 4,
    weekNumber: 4,
    weekKind: 'build',
  });
  eq(`late off-season ${bodyPart} issue denies sprint when unsafe`,
    speedWorkouts(builtWorkoutsFor(late, p)).length,
    0,
    planText(late));
}

{
  const p = profile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: undefined,
  });
  const lateCooked = planFor(p, [fatigue(5)], {
    miniCycleNumber: 1,
    weekInBlock: 4,
    weekNumber: 4,
  });
  eq('low readiness denies late off-season sprint',
    speedWorkouts(builtWorkoutsFor(lateCooked, p)).length,
    0,
    planText(lateCooked));

  const lateHealthy = planFor(p, [], {
    miniCycleNumber: 1,
    weekInBlock: 4,
    weekNumber: 4,
    weekKind: 'build',
  });
  const speed = speedWorkouts(builtWorkoutsFor(lateHealthy, p))[0];
  ok('late off-season sprint is not a finisher',
    !!speed &&
    !speed.hasCombinedConditioning &&
    speed.attachedConditioningKind === undefined,
    JSON.stringify({ hasCombined: speed?.hasCombinedConditioning, attached: speed?.attachedConditioningKind }));
  ok('late off-season sprint is not conditioning',
    !!speed &&
    speed.conditioningBlock === undefined &&
    speed.conditioningCategory === undefined &&
    speed.conditioningFlavour === undefined,
    JSON.stringify({
      category: speed?.conditioningCategory,
      flavour: speed?.conditioningFlavour,
      block: speed?.conditioningBlock,
    }));
}

{
  const p = profile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: undefined,
  });
  const program = generateProgramLocally(p, { todayISO: TODAY, activeConstraints: [] });
  const week1Speed = speedWorkouts(program.microcycles[0]?.workouts ?? []);
  const week4Speed = speedWorkouts(program.microcycles[3]?.workouts ?? []);
  eq('generated off-season block keeps week 1 sprint-free',
    week1Speed.length,
    0,
    week1Speed.map((workout) => workout.name).join(' | '));
  eq('generated off-season block keeps deload week 4 sprint-free',
    week4Speed.length,
    0,
    week4Speed.map((workout) => workout.name).join(' | '));
}

console.log('\n-- SP-4. Late off-season speed templates --');

{
  const first = selectLateOffseasonSpeedTemplate({
    seasonPhase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    weekNumber: 4,
  });
  eq('first late off-season build exposure selects low-risk acceleration',
    first?.id,
    'late_offseason_low_risk_acceleration',
    JSON.stringify(first));

  const second = selectLateOffseasonSpeedTemplate({
    seasonPhase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    weekNumber: 5,
  });
  eq('later late off-season exposure can progress to acceleration build',
    second?.id,
    'late_offseason_acceleration_build',
    JSON.stringify(second));

  const third = selectLateOffseasonSpeedTemplate({
    seasonPhase: 'Off-season',
    offseasonSubphase: 'late_offseason',
    weekNumber: 6,
  });
  eq('later late off-season exposure can progress to build-up intro',
    third?.id,
    'late_offseason_build_up_intro',
    JSON.stringify(third));
}

{
  const p = profile({
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: undefined,
  });
  const firstPlan = planFor(p, [], {
    miniCycleNumber: 1,
    weekInBlock: 4,
    weekNumber: 4,
    weekKind: 'build',
  });
  const firstSpeed = speedWorkouts(builtWorkoutsFor(firstPlan, p))[0];
  ok('late_offseason build week selects a late off-season speed template when gate allows',
    firstSpeed?.speedBlock?.id.startsWith('late_offseason_') ?? false,
    JSON.stringify(firstSpeed?.speedBlock));
  ok('first late_offseason generated speed uses low-risk acceleration template',
    firstSpeed?.speedBlock?.id.startsWith('late_offseason_low_risk_acceleration') ?? false,
    JSON.stringify(firstSpeed?.speedBlock));
  ok('low-risk acceleration rows use hills or controlled short acceleration',
    (firstSpeed?.exercises ?? []).some((exercise) =>
      /short hills|controlled accelerations|10-15m/i.test(exercise.exercise?.name ?? '') &&
      exercise.prescriptionType === 'distance',
    ),
    firstSpeed?.exercises.map((exercise) => `${exercise.exercise?.name}:${exercise.prescriptionType}`).join(' | '));

  const laterPlan = planFor(p, [], {
    miniCycleNumber: 2,
    weekInBlock: 1,
    weekNumber: 5,
    weekKind: 'build',
  });
  const laterSpeed = speedWorkouts(builtWorkoutsFor(laterPlan, p))[0];
  ok('later late_offseason generated speed uses acceleration build when week position is available',
    laterSpeed?.speedBlock?.id.startsWith('late_offseason_acceleration_build') ?? false,
    JSON.stringify(laterSpeed?.speedBlock));

  if (firstSpeed) {
    const counts = countWeeklyExposures([{ date: TODAY, workout: firstSpeed }]);
    eq('late off-season speed template counts as sprint/COD exposure',
      counts.sprintCodExposures,
      1,
      JSON.stringify(counts.byCategory));
    eq('late off-season speed template does not count as conditioning',
      counts.conditioningExposures,
      0,
      JSON.stringify(counts.byCategory));
  } else {
    ok('late off-season speed template counts as sprint/COD exposure', false, 'no speed workout generated');
    ok('late off-season speed template does not count as conditioning', false, 'no speed workout generated');
  }
}

{
  const p = profile();
  const plan = planFor(p);
  const speed = speedWorkouts(builtWorkoutsFor(plan, p))[0];
  ok('sprint micro-dose appears before fatigue, not after lower/conditioning',
    !!speed &&
    speed.speedBlock?.placement === 'pre_lift' &&
    !speed.exercises.some((exercise) => /squat|hinge|deadlift|rdl/i.test(exercise.exercise?.name ?? '')),
    JSON.stringify({
      placement: speed?.speedBlock?.placement,
      rows: speed?.exercises.map((exercise) => exercise.exercise?.name),
    }));
  ok('sprint micro-dose is not a finisher',
    !!speed &&
    speed.hasCombinedConditioning &&
    speed.attachedConditioningKind === 'component',
    JSON.stringify({ hasCombined: speed?.hasCombinedConditioning, attached: speed?.attachedConditioningKind }));
  ok('sprint micro-dose preserves separately required conditioning',
    !!speed &&
    speed.conditioningBlock !== undefined &&
    speed.conditioningCategory !== undefined &&
    speed.conditioningFlavour !== undefined,
    JSON.stringify({
      category: speed?.conditioningCategory,
      flavour: speed?.conditioningFlavour,
      block: speed?.conditioningBlock,
    }));
}

{
  const p = profile();
  const plan = planFor(p);
  const speed = speedWorkouts(builtWorkoutsFor(plan, p))[0];
  const counts = countWeeklyExposures([{ date: TODAY, workout: speed }]);
  eq('sprint micro-dose counts as sprint/COD exposure', counts.sprintCodExposures, 1, JSON.stringify(counts.byCategory));
  eq('separate component still counts as conditioning', counts.conditioningExposures, 1, JSON.stringify(counts.byCategory));
  eq('separate component still counts as app conditioning', counts.extraConditioningSessions, 1, JSON.stringify(counts.byCategory));
}

{
  const p = profile({
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: 'Saturday',
  });
  const plan = planFor(p);
  const badGameWindow = speedWorkouts(builtWorkoutsFor(plan, p))
    .filter((workout) => workout.dayOfWeek === 4 || workout.dayOfWeek === 5);
  eq('G-1/G-2 placement is denied for sprint micro-dose',
    badGameWindow.length,
    0,
    badGameWindow.map((workout) => `${workout.dayOfWeek}: ${workout.name}`).join(' | '));
}

{
  const p = profile();
  const injured = planFor(p, [injury('hamstring', 5)]);
  eq('unsafe injury denies sprint micro-dose',
    speedWorkouts(builtWorkoutsFor(injured, p)).length,
    0,
    planText(injured));

  const cooked = planFor(p, [fatigue(5)]);
  eq('low readiness denies sprint micro-dose',
    speedWorkouts(builtWorkoutsFor(cooked, p)).length,
    0,
    planText(cooked));
}

if (fail > 0) {
  console.error(`\nSprint exposure gate tests failed: ${fail}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`\nSprint exposure gate tests passed: ${pass}`);
