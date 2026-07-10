/**
 * Beginner deterministic generation tests.
 *
 * Run: sucrase-node src/__tests__/beginnerDeterministicProgramTests.ts
 */

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { EXERCISE_LOAD_MAP, estimateStartingWeight } from '../utils/loadEstimation';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../utils/coachingEngine';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import type { OnboardingData, SeasonPhase, Workout } from '../types/domain';

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

function profile(
  seasonPhase: SeasonPhase,
  experienceLevel: OnboardingData['experienceLevel'],
  equipment: string[] = ['Full Gym'],
): OnboardingData {
  return {
    seasonPhase,
    experienceLevel,
    equipment,
    trainingLocation: 'Commercial gym',
    weightKg: 80,
    squatStrength: experienceLevel === 'Complete beginner' ? "I don't squat" : 'Around bodyweight',
    benchStrength: experienceLevel === 'Complete beginner' ? "I don't bench" : 'Around bodyweight',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    sprintExposure: 'Occasionally',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    injuries: [],
  };
}

const coachStrength = [
  {
    dayOfWeek: 1,
    name: 'Lower Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 5 },
      { name: 'Bulgarian Split Squats', sets: 3, repsMin: 10, repsMax: 12 },
      { name: 'Nordic Lower', sets: 3, repsMin: 3, repsMax: 5 },
    ],
  },
  {
    dayOfWeek: 2,
    name: 'Upper Pull',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Pull-Ups', sets: 3, repsMin: 5, repsMax: 8 },
      { name: 'Barbell Row', sets: 3, repsMin: 6, repsMax: 10 },
      { name: 'Face Pull', sets: 3, repsMin: 12, repsMax: 15 },
    ],
  },
  {
    dayOfWeek: 3,
    name: 'Upper Push',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Bench Press', sets: 4, repsMin: 4, repsMax: 6 },
      { name: 'Overhead Press', sets: 3, repsMin: 6, repsMax: 8 },
      { name: 'Dips', sets: 3, repsMin: 8, repsMax: 12 },
    ],
  },
  {
    dayOfWeek: 4,
    name: 'Lower Hinge',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Deadlift', sets: 4, repsMin: 3, repsMax: 5 },
    ],
  },
];

function buildStrengthWeek(
  data: OnboardingData,
  availableEquipment = FULL_GYM_EQUIPMENT,
): Workout[] {
  return buildWorkoutsFromCoach(
    coachStrength,
    `mc-${data.experienceLevel}-${data.seasonPhase}`,
    undefined,
    data,
    { miniCycleNumber: 1, weekInBlock: 1, weekStartISO: '2026-07-06' },
    { excluded: [], pinned: [], availableEquipment },
  );
}

function buildOutageWeek(
  data: OnboardingData,
  availableEquipment = FULL_GYM_EQUIPMENT,
): Workout[] {
  const plan = buildCoachingPlan(onboardingToCoachingInputs(data));
  return buildWorkoutsFromCoach(
    [],
    `mc-outage-${data.experienceLevel}-${data.seasonPhase}`,
    plan.weeklyPlan,
    data,
    { miniCycleNumber: 1, weekInBlock: 1, weekStartISO: '2026-07-06' },
    { excluded: [], pinned: [], availableEquipment },
  );
}

function exerciseNames(workouts: Workout[]): string[] {
  return workouts.flatMap((workout) =>
    workout.exercises.map((exercise) => exercise.exercise?.name ?? ''),
  );
}

console.log('\n[1] pure training-age policy');
{
  const beginner = resolveTrainingAgePolicy('Complete beginner');
  const developing = resolveTrainingAgePolicy('1-2 years');
  ok('complete beginner receives the new-athlete policy', beginner.level === 'new');
  ok('beginner policy caps core sessions', beginner.maxCoreSessions === 2);
  ok('beginner policy targets controlled RPE 6-7',
    beginner.targetRpeMin === 6 && beginner.targetRpeMax === 7);
  ok('developing athletes keep the normal deterministic dose',
    developing.level === 'developing' && developing.maxCoreSessions === null);
}

console.log('\n[2] beginner pool selection and useful content');
{
  const workouts = buildStrengthWeek(profile('Pre-season', 'Complete beginner'));
  const names = exerciseNames(workouts);
  ok('beginner receives useful strength rows', names.length >= 6, names.join(', '));
  ok('beginner does not default to Back Squat', !names.includes('Back Squat'), names.join(', '));
  ok('beginner does not default to strict Pull-Ups', !names.includes('Pull-Ups'), names.join(', '));
  ok('beginner does not default to barbell bench or row',
    !names.includes('Bench Press') && !names.includes('Barbell Row'), names.join(', '));
  ok('beginner receives simple squat, push and pull options',
    names.includes('Goblet Squat') &&
      (names.includes('DB Bench Press') || names.includes('Push-ups')) &&
      (names.includes('Seated Cable Row') || names.includes('Single-Arm DB Row') || names.includes('Lat Pulldown')),
    names.join(', '));
  ok('beginner receives a simpler hinge option',
    names.includes('Trap Bar Deadlift') ||
      names.includes('Single-Leg RDL') ||
      names.includes('Glute Bridge'),
    names.join(', '));
  const trapBar = workouts.flatMap((workout) => workout.exercises)
    .find((exercise) => exercise.exercise?.name === 'Trap Bar Deadlift');
  const normalTrapBarEstimate = estimateStartingWeight(
    'Trap Bar Deadlift',
    profile('Pre-season', 'Complete beginner'),
  ) ?? 0;
  ok('beginner external-load estimate is capped below the normal estimate',
    !!trapBar &&
      (trapBar.prescribedWeightKg ?? 0) > 0 &&
      (trapBar.prescribedWeightKg ?? 0) <= normalTrapBarEstimate * 0.8,
    `beginner=${trapBar?.prescribedWeightKg}, normal=${normalTrapBarEstimate}`);

  const outageWorkouts = buildOutageWeek(profile('Pre-season', 'Complete beginner'));
  const outageNames = exerciseNames(outageWorkouts);
  ok('empty coach response still builds a useful deterministic beginner week',
    outageWorkouts.length > 0 && outageNames.length > 0,
    outageNames.join(', '));
  ok('empty coach response does not restore advanced adult defaults',
    !outageNames.includes('Back Squat') &&
      !outageNames.includes('Pull-Ups') &&
      !outageNames.includes('Bench Press') &&
      !outageNames.includes('Barbell Row'),
    outageNames.join(', '));
}

console.log('\n[3] beginner dose and intensity');
for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  const workouts = buildStrengthWeek(profile(seasonPhase, 'Complete beginner'));
  const strengthRows = workouts.flatMap((workout) => workout.exercises)
    .filter((exercise) => classifyPoolSlot(exercise.exercise?.name ?? ''));
  const compoundRows = strengthRows.filter((exercise) => {
    const slot = classifyPoolSlot(exercise.exercise?.name ?? '')?.slot;
    return slot && !['isolation_upper', 'isolation_lower', 'carry', 'plyo'].includes(slot);
  });
  ok(`${seasonPhase} beginner rows use no more than 2 sets`,
    strengthRows.length > 0 && strengthRows.every((exercise) => exercise.prescribedSets <= 2),
    strengthRows.map((exercise) => `${exercise.exercise?.name}:${exercise.prescribedSets}`).join(', '));
  ok(`${seasonPhase} beginner compound work stays in the 4-8 technique range`,
    compoundRows.length > 0 && compoundRows.every((exercise) =>
      exercise.prescribedRepsMin >= 4 && exercise.prescribedRepsMax <= 8),
    compoundRows.map((exercise) =>
      `${exercise.exercise?.name}:${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`).join(', '));
  ok(`${seasonPhase} beginner rows carry controlled RPE guidance`,
    strengthRows.every((exercise) => /Target RPE 6-7/i.test(exercise.notes ?? '')),
    strengthRows.map((exercise) => `${exercise.exercise?.name}:${exercise.notes}`).join(' | '));
}

console.log('\n[4] beginner weekly dose and combined-day guard');
for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  const data = profile(seasonPhase, 'Complete beginner');
  const plan = buildCoachingPlan(onboardingToCoachingInputs(data));
  ok(`${seasonPhase} beginner plan caps core sessions at 2`, plan.coreSessions <= 2,
    `core=${plan.coreSessions}`);
  ok(`${seasonPhase} beginner hard-exposure cap is conservative`, plan.hardExposureCap <= 3,
    `cap=${plan.hardExposureCap}`);
  ok(`${seasonPhase} beginner has no hard conditioning attached to strength`,
    plan.weeklyPlan.every((session) =>
      !session.hasCombinedConditioning ||
      session.conditioningCategory === 'aerobic_base' ||
      session.conditioningCategory === 'tempo'),
    plan.weeklyPlan.map((session) =>
      `${session.dayOfWeek}:${session.conditioningCategory ?? '-'}:${session.hasCombinedConditioning ?? false}`).join(', '));
}

console.log('\n[5] equipment and established-athlete preservation');
{
  const bodyweight = buildStrengthWeek(
    profile('Pre-season', 'Complete beginner', ['Bodyweight Only']),
    ['bodyweight'],
  );
  const bodyweightNames = exerciseNames(bodyweight);
  const unavailableWeighted = bodyweightNames.filter((name) => {
    const equipment = EXERCISE_LOAD_MAP[name]?.equipment;
    return equipment && equipment !== 'bodyweight';
  });
  ok('bodyweight-only beginner path has no weighted equipment prescriptions',
    unavailableWeighted.length === 0,
    `${bodyweightNames.join(', ')}; unavailable=${unavailableWeighted.join(', ')}`);
  ok('bodyweight-only beginner path still has useful strength work',
    bodyweightNames.includes('Bodyweight Squat') &&
      bodyweightNames.includes('Glute Bridge') &&
      bodyweightNames.includes('Push-ups') &&
      bodyweightNames.includes('Inverted Row (Bodyweight)'),
    bodyweightNames.join(', '));

  for (const experienceLevel of ['1-2 years', '2-5 years', '5+ years'] as const) {
    const workouts = buildStrengthWeek(profile('Pre-season', experienceLevel));
    const names = exerciseNames(workouts);
    ok(`${experienceLevel} keeps established adult anchor selection`,
      names.includes('Back Squat') && names.includes('Pull-Ups') && names.includes('Bench Press'),
      names.join(', '));
    const squat = workouts.flatMap((workout) => workout.exercises)
      .find((exercise) => exercise.exercise?.name === 'Back Squat');
    ok(`${experienceLevel} keeps the normal 3-set phase prescription`,
      squat?.prescribedSets === 3,
      `${squat?.prescribedSets}`);
  }
}

console.log(`\nbeginnerDeterministicProgramTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.error(failures.map((failure) => `  - ${failure}`).join('\n'));
process.exit(fail > 0 ? 1 : 0);
