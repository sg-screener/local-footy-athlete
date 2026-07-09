/**
 * Phase-aware strength prescription tests.
 *
 * Run: sucrase-node src/__tests__/phaseRepPrescriptionTests.ts
 */

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import type { OnboardingData } from '../types/domain';
import type { SessionAllocation } from '../utils/coachingEngine';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

function profile(seasonPhase: OnboardingData['seasonPhase']): OnboardingData {
  return {
    seasonPhase,
    weightKg: 90,
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
  } as OnboardingData;
}

function findExercise(workout: ReturnType<typeof buildWorkoutsFromCoach>[number], name: string) {
  return workout.exercises.find((exercise) => exercise.exercise?.name === name);
}

function reps(exercise: { prescribedSets: number; prescribedRepsMin: number; prescribedRepsMax: number } | undefined) {
  return exercise
    ? `${exercise.prescribedSets} x ${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`
    : '<missing>';
}

section('[1] deterministic fallback consumes phase rep schemes');
{
  const plan: SessionAllocation[] = [{
    dayOfWeek: 'Monday',
    tier: 'core',
    focus: 'Lower body - squat emphasis (quad-dominant: squat, lunge, leg press)',
    isHardExposure: true,
    strengthPattern: 'lower',
    stressLevel: 'high',
  }];
  const [workout] = buildWorkoutsFromCoach([], 'mc-phase-fallback', plan, profile('In-season'));
  const squat = findExercise(workout, 'Back Squat');
  ok('in-season lower main lift uses low reps',
    squat?.prescribedSets === 3 && squat.prescribedRepsMin === 2 && squat.prescribedRepsMax === 4,
    reps(squat));
}

section('[2] AI-normalised main lifts are phase-aware');
{
  const [inSeasonUpper] = buildWorkoutsFromCoach([{
    dayOfWeek: 1,
    name: 'Upper Pull',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [{ name: 'Pull-Ups', sets: 3, repsMin: 8, repsMax: 12 }],
  }], 'mc-phase-upper', undefined, profile('In-season'));
  const pullUps = findExercise(inSeasonUpper, 'Pull-Ups');
  ok('in-season upper pull does not default to off-season reps',
    pullUps?.prescribedSets === 3 && pullUps.prescribedRepsMin === 4 && pullUps.prescribedRepsMax === 6,
    reps(pullUps));

  const [preSeasonLower] = buildWorkoutsFromCoach([{
    dayOfWeek: 2,
    name: 'Lower Squat',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [{ name: 'Back Squat', sets: 3, repsMin: 8, repsMax: 10 }],
  }], 'mc-phase-pre', undefined, profile('Pre-season'));
  const preSquat = findExercise(preSeasonLower, 'Back Squat');
  ok('pre-season main lift uses 4-6 style reps',
    preSquat?.prescribedSets === 3 && preSquat.prescribedRepsMin === 4 && preSquat.prescribedRepsMax === 6,
    reps(preSquat));

  const [offSeasonLower] = buildWorkoutsFromCoach([{
    dayOfWeek: 3,
    name: 'Lower Squat',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [{ name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 5 }],
  }], 'mc-phase-off', undefined, profile('Off-season'));
  const offSquat = findExercise(offSeasonLower, 'Back Squat');
  ok('off-season main lift uses 6-8 style reps',
    offSquat?.prescribedSets === 3 && offSquat.prescribedRepsMin === 6 && offSquat.prescribedRepsMax === 8,
    reps(offSquat));
}

section('[3] accessories and gunshow stay accessory-style');
{
  const [lowerWithAccessory] = buildWorkoutsFromCoach([{
    dayOfWeek: 4,
    name: 'Lower Squat',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Bulgarian Split Squats', sets: 4, repsMin: 5, repsMax: 6 },
    ],
  }], 'mc-phase-accessory', undefined, profile('In-season'));
  const splitSquat = findExercise(lowerWithAccessory, 'Bulgarian Split Squats');
  ok('accessories remain accessory-style reps',
    splitSquat?.prescribedSets === 3 && splitSquat.prescribedRepsMin === 8 && splitSquat.prescribedRepsMax === 15,
    reps(splitSquat));

  const [gunshow] = buildWorkoutsFromCoach([{
    dayOfWeek: 5,
    name: 'Gunshow',
    workoutType: 'Strength',
    sessionTier: 'optional',
    exercises: [
      { name: 'Skull Crushers', sets: 5, repsMin: 5, repsMax: 5 },
      { name: 'Hammer Curl', sets: 4, repsMin: 5, repsMax: 5 },
    ],
  }], 'mc-phase-gunshow', undefined, profile('Off-season'));
  const skulls = findExercise(gunshow, 'Skull Crushers');
  const curls = findExercise(gunshow, 'Hammer Curl');
  ok('gunshow isolation anchor stays pump/accessory style',
    skulls?.prescribedSets === 3 && skulls.prescribedRepsMin === 10 && skulls.prescribedRepsMax === 20,
    reps(skulls));
  ok('gunshow accessory stays pump/accessory style',
    curls?.prescribedSets === 3 && curls.prescribedRepsMin === 10 && curls.prescribedRepsMax === 20,
    reps(curls));

  const [prehabAccessory] = buildWorkoutsFromCoach([{
    dayOfWeek: 6,
    name: 'Upper body hypertrophy / trunk & accessories',
    workoutType: 'Strength',
    sessionTier: 'optional',
    exercises: [{ name: 'Bench Press', sets: 3, repsMin: 5, repsMax: 5 }],
  }], 'mc-phase-prehab', undefined, profile('In-season'));
  const accessoryBench = findExercise(prehabAccessory, 'Bench Press');
  ok('accessory/prehab context does not use main-lift reps',
    accessoryBench?.prescribedSets === 3 && accessoryBench.prescribedRepsMin === 8 && accessoryBench.prescribedRepsMax === 15,
    reps(accessoryBench));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`phaseRepPrescriptionTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
