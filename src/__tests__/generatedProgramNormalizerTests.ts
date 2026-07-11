/**
 * Generated-program normaliser regression tests.
 *
 * Run: npm run test:generated-program-normalizer
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { DayOfWeek, OnboardingData, Workout } from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import { buildInitialGeneratedCoachingPlan } from '../services/api/generateProgram';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { projectVisibleDay } from '../utils/visibleProgramProjection';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function section(name: string): void {
  console.log(`\n${name}`);
}

const PROFILE: OnboardingData = {
  firstName: 'MixedSessionTester',
  ageRange: '25-34',
  position: 'inside_mid',
  motivation: 'Get stronger, run longer',
  goals: ['Build Strength', 'Improve Fitness'],
  experienceLevel: 'Intermediate' as any,
  squatStrength: '1.5x BW' as any,
  benchStrength: '1x BW' as any,
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 6,
  preferredTrainingDays: [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Monday', 'Wednesday'],
  teamTrainingIntensity: 'High',
  teamTrainingDuration: '90 min' as any,
  sessionDurationMinutes: 60 as any,
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
} as OnboardingData;

const DAY_NUMBER: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function exercise(name: string) {
  return { name, sets: 3, repsMin: 5, repsMax: 8 };
}

function structuralShape(plan: readonly SessionAllocation[]) {
  return plan.map((session) => ({
    dayOfWeek: session.dayOfWeek,
    tier: session.tier,
    strengthPattern: session.strengthPattern ?? null,
    isTeamDay: session.isTeamDay ?? false,
    hasCombinedConditioning: session.hasCombinedConditioning ?? false,
    conditioningCategory: session.conditioningCategory ?? null,
  }));
}

function conditioningIds(workout: Workout): Set<string> {
  return new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds),
  );
}

function strengthNames(workout: Workout): string[] {
  const ids = conditioningIds(workout);
  return (workout.exercises ?? [])
    .filter((row) => !ids.has(row.id))
    .map((row) => row.exercise?.name ?? '')
    .filter(Boolean);
}

function visible(workout: Workout, date: string): Workout | null {
  return projectVisibleDay({
    day: {
      date,
      dayOfWeek: workout.dayOfWeek,
      short: 'DAY',
      isToday: false,
      workout,
      source: 'template',
      indicator: workout.sessionTier ?? null,
    } as any,
    activeInjury: null,
    todayISO: '2026-07-06',
    extraConstraints: [],
    modalityPreferences: {},
  }).day.workout;
}

const inputs = onboardingToCoachingInputs(PROFILE, {
  availabilityDateISO: '2026-07-06',
});

section('[1] Edge prompt and first client microcycle share one block-state plan');
{
  const promptPlan = buildInitialGeneratedCoachingPlan({
    coachingInputs: inputs,
    profile: PROFILE,
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  const firstMicrocyclePlan = buildCoachingPlan({
    ...inputs,
    miniCycleNumber: 1,
    weekInBlock: 1,
    weekNumber: 1,
    weekKind: 'build',
  });
  eq(
    'edge prompt structure equals the first normalised block week',
    structuralShape(promptPlan.weeklyPlan),
    structuralShape(firstMicrocyclePlan.weeklyPlan),
  );
}

section('[2] Edge-style mixed sessions retain strength plus typed conditioning');
const midPlan = buildCoachingPlan({
  ...inputs,
  miniCycleNumber: 2,
  weekInBlock: 2,
  weekNumber: 2,
  weekKind: 'build',
});
const edgeWorkouts = [
  {
    dayOfWeek: 1,
    name: 'Team Training + Upper Push',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [exercise('Bench Press'), exercise('Overhead Press'), exercise('Dips')],
  },
  {
    dayOfWeek: 2,
    name: 'Lower Hinge + Easy Off-Feet Aerobic',
    // Deliberately wrong edge enum: deterministic component structure wins.
    workoutType: 'Conditioning',
    sessionTier: 'core',
    exercises: [
      exercise('Romanian Deadlift'),
      exercise('Hip Thrusts'),
      exercise('Nordic Lower'),
      exercise('Easy Zone 2 Bike'),
    ],
  },
  {
    dayOfWeek: 3,
    name: 'Team Training - Field Session',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [],
  },
  {
    dayOfWeek: 4,
    name: 'Full Body Recovery',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: [exercise('Mobility Flow')],
  },
  {
    dayOfWeek: 5,
    name: 'Upper Pull',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [exercise('Pull-Ups'), exercise('Barbell Row'), exercise('Face Pulls')],
  },
  {
    dayOfWeek: 6,
    name: 'Lower Squat + Easy Off-Feet Aerobic',
    workoutType: 'Mixed',
    sessionTier: 'core',
    exercises: [
      exercise('Back Squat'),
      exercise('Bulgarian Split Squats'),
      exercise('Leg Extension'),
      exercise('Easy Zone 2 Bike'),
    ],
  },
];
const built = buildWorkoutsFromCoach(
  edgeWorkouts,
  'mc-generated-mixed',
  midPlan.weeklyPlan,
  PROFILE,
  {
    miniCycleNumber: 2,
    weekInBlock: 2,
    weekStartISO: '2026-07-13',
    weekKind: 'build',
  },
);
const workoutOn = (day: DayOfWeek) => built.find((workout) => workout.dayOfWeek === DAY_NUMBER[day])!;
const tuesday = workoutOn('Tuesday');
const friday = workoutOn('Friday');
const saturday = workoutOn('Saturday');

ok('Lower Hinge retains meaningful lower strength rows', strengthNames(tuesday).length >= 3, strengthNames(tuesday));
ok('Lower Hinge retains a separate conditioning block', !!tuesday.conditioningBlock?.options.length);
eq('Lower Hinge is structurally Mixed despite wrong edge enum', tuesday.workoutType, 'Mixed' as any);
ok('Lower Squat retains meaningful lower strength rows', strengthNames(saturday).length >= 3, strengthNames(saturday));
ok('Lower Squat retains a separate conditioning block', !!saturday.conditioningBlock?.options.length);
eq('Lower Squat remains structurally Mixed', saturday.workoutType, 'Mixed' as any);
ok('Upper Pull remains visible strength', classifyVisibleSession(friday).contributions.mainStrength === 1, friday);
ok('Team Training + Upper Push preserves the anchor', classifyVisibleSession(workoutOn('Monday')).anchors.teamTraining);
ok('Team Training + Upper Push preserves upper strength', classifyVisibleSession(workoutOn('Monday')).contributions.mainStrength === 1);

const visibleTuesday = visible(tuesday, '2026-07-14');
const visibleSaturday = visible(saturday, '2026-07-18');
ok('visible projection does not flatten Lower Hinge to Aerobic Base', !!visibleTuesday && visibleTuesday.workoutType === 'Mixed' && strengthNames(visibleTuesday).length >= 3, visibleTuesday);
ok('visible projection does not flatten Lower Squat to Aerobic Base', !!visibleSaturday && visibleSaturday.workoutType === 'Mixed' && strengthNames(visibleSaturday).length >= 3, visibleSaturday);

const usefulStrength = built.reduce(
  (total, workout) => total + classifyVisibleSession(workout).contributions.mainStrength,
  0,
);
ok('healthy six-day Mon-Sat pre-season week retains four useful strength contributions', usefulStrength >= 4, built.map((workout) => ({ name: workout.name, type: workout.workoutType })));

section('[3] Required strength shells get deterministic content fallback');
{
  const upperPlan = midPlan.weeklyPlan.filter((session) => session.dayOfWeek === 'Friday');
  const [emptyUpper] = buildWorkoutsFromCoach([{
    dayOfWeek: 5,
    name: 'Upper Pull',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [],
  }], 'mc-empty-upper', upperPlan, PROFILE);
  ok('empty Upper Pull shell receives safe plan strength rows', emptyUpper.exercises.length >= 3, emptyUpper.exercises.map((row) => row.exercise?.name));
  ok('empty Upper Pull shell does not collapse to Rest', !!visible(emptyUpper, '2026-07-17'));
}

console.log(`\nGenerated program normalizer tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
