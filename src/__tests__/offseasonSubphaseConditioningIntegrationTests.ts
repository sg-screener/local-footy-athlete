(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { OnboardingData, Workout } from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
} from '../utils/coachingEngine';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';

const WEEK_START = '2026-07-06';
const HARD_CATEGORIES = new Set(['sprint', 'vo2', 'glycolytic']);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  fail += 1;
  failures.push(name);
  console.log(`  FAIL ${name}`);
  if (detail !== undefined) console.log(`       ${JSON.stringify(detail)}`);
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Build strength and fitness',
};

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return { ...BASE_PROFILE, ...overrides };
}

function planFor(
  weekNumber: number,
  profileData: OnboardingData = BASE_PROFILE,
): CoachingPlan {
  return buildCoachingPlan(onboardingToCoachingInputs(profileData, {
    miniCycleNumber: 1,
    weekInBlock: weekNumber,
    weekNumber,
    weekKind: 'build',
  }));
}

function buildWeek(
  plan: CoachingPlan,
  profileData: OnboardingData = BASE_PROFILE,
  availableEquipment: readonly ('bodyweight' | 'bike_or_treadmill')[] = ['bodyweight', 'bike_or_treadmill'],
): Workout[] {
  return buildWorkoutsFromCoach(
    [],
    'mc-offseason-policy',
    plan.weeklyPlan,
    profileData,
    {
      miniCycleNumber: 1,
      weekInBlock: 1,
      weekStartISO: WEEK_START,
      weekKind: 'build',
    },
    { availableEquipment },
  );
}

function categories(plan: CoachingPlan): string[] {
  return plan.weeklyPlan
    .map((session) => session.conditioningCategory)
    .filter((category): category is NonNullable<typeof category> => !!category);
}

function exposureCounts(workouts: Workout[]) {
  return countWeeklyExposures(workouts.map((workout) => ({
    date: `2026-07-${String(5 + workout.dayOfWeek).padStart(2, '0')}`,
    workout,
  })));
}

function workoutText(workouts: Workout[]): string {
  return workouts.map((workout) => [
    workout.name,
    workout.conditioningCategory,
    ...workout.exercises.map((exercise) => exercise.exercise?.name ?? ''),
  ].filter(Boolean).join(' ')).join(' | ');
}

function planText(plan: CoachingPlan): string {
  return plan.weeklyPlan.map((session) => [
    session.dayOfWeek,
    session.strengthPattern,
    session.conditioningCategory,
    session.attachedConditioningKind,
    session.focus,
  ].filter(Boolean).join(' ')).join(' | ');
}

console.log('offseasonSubphaseConditioningIntegrationTests');

console.log('\n[1] early off-season weeks 1-2');
for (const weekNumber of [1, 2]) {
  const plan = planFor(weekNumber);
  const workouts = buildWeek(plan);
  const cats = categories(plan);
  const counts = exposureCounts(workouts);
  const coreStrength = plan.weeklyPlan.filter((session) =>
    session.tier === 'core' && !!session.strengthPattern);
  const supportRecovery = plan.weeklyPlan.filter((session) =>
    session.tier === 'optional' || session.tier === 'recovery');

  ok(`week ${weekNumber} uses aerobic_base only`,
    cats.length > 0 && cats.every((category) => category === 'aerobic_base'),
    cats);
  ok(`week ${weekNumber} has no hard conditioning category`,
    cats.every((category) => !HARD_CATEGORIES.has(category)),
    cats);
  eq(`week ${weekNumber} has no running conditioning exposure`, counts.runningExposures, 0);
  eq(`week ${weekNumber} has no sprint/COD exposure`, counts.sprintCodExposures, 0);
  ok(`week ${weekNumber} marks aerobic work off-feet`,
    plan.weeklyPlan
      .filter((session) => session.conditioningCategory === 'aerobic_base')
      .every((session) => session.conditioningOffFeet === true),
    plan.weeklyPlan);
  ok(`week ${weekNumber} builds visible off-feet aerobic work`,
    /bike|row|ski/i.test(workoutText(workouts)) && !/Long Nasal Run/.test(workoutText(workouts)),
    workoutText(workouts));
  ok(`week ${weekNumber} keeps 2-3 useful core strength sessions`,
    coreStrength.length >= 2 && coreStrength.length <= 3,
    planText(plan));
  ok(`week ${weekNumber} includes optional/support or recovery work`,
    supportRecovery.length >= 1,
    planText(plan));
}

console.log('\n[2] early low readiness and low availability');
{
  const lowProfile = profile({
    conditioningLevel: 'Poor',
    recentTrainingLoad: 'Hardly at all',
  });
  const lowPlan = planFor(1, lowProfile);
  const lowCategories = categories(lowPlan);
  ok('low-readiness early week is aerobic/recovery only',
    lowCategories.every((category) => category === 'aerobic_base') &&
      lowPlan.weeklyPlan.every((session) =>
        session.conditioningFlavour !== 'high-intensity' && session.speedWorkKind !== 'true_speed'),
    lowPlan.weeklyPlan);
  ok('low-readiness early week caps core strength at two sessions',
    lowPlan.weeklyPlan.filter((session) =>
      session.tier === 'core' && !!session.strengthPattern).length <= 2,
    planText(lowPlan));
  ok('low-readiness early week has at least two recovery/support days',
    lowPlan.weeklyPlan.filter((session) =>
      session.tier === 'optional' || session.tier === 'recovery').length >= 2,
    planText(lowPlan));
  ok('low-readiness early week still contains useful strength work',
    lowPlan.weeklyPlan.some((session) => !!session.strengthPattern),
    planText(lowPlan));

  const shortProfile = profile({
    trainingDaysPerWeek: 2,
    preferredTrainingDays: ['Monday', 'Thursday'],
  });
  const shortPlan = planFor(1, shortProfile);
  const combined = shortPlan.weeklyPlan.filter((session) => session.hasCombinedConditioning);
  ok('low availability does not create brutal early S+C days',
    combined.length === 0,
    combined);
  ok('low availability keeps two useful strength sessions instead of compressing more work',
    shortPlan.weeklyPlan.filter((session) => !!session.strengthPattern).length === 2,
    planText(shortPlan));

  const fourDayPlan = planFor(1, profile({
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    recentTrainingLoad: 'Pretty consistent',
  }));
  ok('four-day early week keeps three core strength sessions',
    fourDayPlan.weeklyPlan.filter((session) =>
      session.tier === 'core' && !!session.strengthPattern).length === 3,
    planText(fourDayPlan));
  ok('four-day early week keeps one optional aerobic support session',
    fourDayPlan.weeklyPlan.filter((session) =>
      session.tier === 'optional' && session.conditioningCategory === 'aerobic_base').length === 1,
    planText(fourDayPlan));
  ok('four-day early week does not stack conditioning onto strength',
    !fourDayPlan.weeklyPlan.some((session) => session.hasCombinedConditioning),
    planText(fourDayPlan));
}

console.log('\n[3] mid and late category breadth');
{
  const mid = planFor(3);
  const midCategories = categories(mid);
  ok('mid uses aerobic_base and controlled tempo only',
    midCategories.includes('aerobic_base') &&
    midCategories.includes('tempo') &&
      midCategories.every((category) => category === 'aerobic_base' || category === 'tempo'),
    planText(mid));
  ok('mid still blocks sprint',
    !mid.weeklyPlan.some((session) =>
      session.conditioningCategory === 'sprint' || session.speedWorkKind === 'true_speed'),
    mid.weeklyPlan);
  ok('mid bridges back toward normal off-season core volume',
    mid.weeklyPlan.filter((session) =>
      session.tier === 'core' && !!session.strengthPattern).length >= 3,
    planText(mid));

  const lateProfile = profile({
    trainingDaysPerWeek: 7,
    preferredTrainingDays: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ],
  });
  const late = planFor(4, lateProfile);
  const lateCategories = categories(late);
  ok('late permits a broader conditioning category',
    lateCategories.some((category) => category !== 'aerobic_base'),
    planText(late));
  ok('late keeps hard conditioning within the policy cap',
    lateCategories.filter((category) => HARD_CATEGORIES.has(category)).length <= 1,
    lateCategories);
  ok('late preserves the existing speed gate output',
    late.weeklyPlan.some((session) => session.speedWorkKind === 'true_speed'),
    late.weeklyPlan);
}

console.log('\n[4] no off-feet equipment fallback');
{
  const plan = planFor(1);
  const workouts = buildWeek(plan, BASE_PROFILE, ['bodyweight']);
  const text = workoutText(workouts);
  ok('bodyweight-only fallback creates no fake conditioning metadata',
    workouts.every((workout) =>
      workout.conditioningCategory === undefined &&
      workout.conditioningFlavour === undefined &&
      !workout.hasCombinedConditioning),
    text);
  ok('bodyweight-only fallback does not prescribe unavailable ergs or running',
    !/bike|row|ski|run|sprint/i.test(text),
    text);
  ok('bodyweight-only fallback keeps useful strength or recovery work',
    workouts.some((workout) => workout.workoutType === 'Strength') &&
      workouts.some((workout) => workout.workoutType === 'Recovery'),
    workouts.map((workout) => `${workout.name}:${workout.workoutType}`));
}

console.log('\nSummary');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
