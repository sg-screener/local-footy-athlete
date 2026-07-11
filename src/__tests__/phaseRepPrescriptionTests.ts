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
  ok('off-season without week context uses conservative early body-armour reps',
    offSquat?.prescribedSets === 3 && offSquat.prescribedRepsMin === 8 && offSquat.prescribedRepsMax === 12,
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
  ok('in-season Bulgarian split squats use lower-soreness accessory reps',
    splitSquat?.prescribedSets === 3 && splitSquat.prescribedRepsMin === 6 && splitSquat.prescribedRepsMax === 8,
    reps(splitSquat));

  const [inSeasonLunges] = buildWorkoutsFromCoach([{
    dayOfWeek: 4,
    name: 'Lower Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 3, repsMin: 3, repsMax: 4 },
      { name: 'Walking Lunges', sets: 3, repsMin: 12, repsMax: 15 },
    ],
  }], 'mc-phase-lunges', undefined, profile('In-season'));
  const walkingLunges = findExercise(inSeasonLunges, 'Walking Lunges');
  ok('in-season lunge-style work is not forced to 8-15 reps',
    walkingLunges?.prescribedSets === 3 && walkingLunges.prescribedRepsMin === 6 && walkingLunges.prescribedRepsMax === 8,
    reps(walkingLunges));

  const [preSeasonAccessory] = buildWorkoutsFromCoach([{
    dayOfWeek: 4,
    name: 'Lower Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 6 },
      { name: 'Bulgarian Split Squats', sets: 3, repsMin: 12, repsMax: 15 },
    ],
  }], 'mc-phase-pre-accessory', undefined, profile('Pre-season'));
  const preSeasonSplitSquat = findExercise(preSeasonAccessory, 'Bulgarian Split Squats');
  ok('pre-season lower accessories use a moderate bridge range',
    preSeasonSplitSquat?.prescribedSets === 3 &&
      preSeasonSplitSquat.prescribedRepsMin === 6 &&
      preSeasonSplitSquat.prescribedRepsMax === 10,
    reps(preSeasonSplitSquat));

  const [offSeasonAccessory] = buildWorkoutsFromCoach([{
    dayOfWeek: 4,
    name: 'Lower Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 3, repsMin: 6, repsMax: 8 },
      { name: 'Bulgarian Split Squats', sets: 3, repsMin: 8, repsMax: 12 },
    ],
  }], 'mc-phase-off-accessory', undefined, profile('Off-season'));
  const offSeasonSplitSquat = findExercise(offSeasonAccessory, 'Bulgarian Split Squats');
  ok('off-season lower accessories retain hypertrophy-style reps',
    offSeasonSplitSquat?.prescribedSets === 3 &&
      offSeasonSplitSquat.prescribedRepsMin === 8 &&
      offSeasonSplitSquat.prescribedRepsMax === 15,
    reps(offSeasonSplitSquat));

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
  ok('in-season upper accessory work can retain higher reps',
    accessoryBench?.prescribedSets === 3 && accessoryBench.prescribedRepsMin === 8 && accessoryBench.prescribedRepsMax === 15,
    reps(accessoryBench));
}

section('[4] off-season subphases materialise their strength bias');
{
  const lowerPlan: SessionAllocation[] = [{
    dayOfWeek: 'Monday',
    tier: 'core',
    focus: 'Lower body - squat emphasis (quad-dominant: squat, lunge, leg press)',
    isHardExposure: true,
    strengthPattern: 'lower',
    stressLevel: 'high',
  }];

  let earlyWeight = 0;
  for (const weekInBlock of [1, 2]) {
    const [early] = buildWorkoutsFromCoach(
      [],
      `mc-phase-early-${weekInBlock}`,
      lowerPlan,
      profile('Off-season'),
      { miniCycleNumber: 1, weekInBlock, weekKind: 'build' },
    );
    const squat = findExercise(early, 'Back Squat');
    ok(`early off-season week ${weekInBlock} uses 8-12 main-lift reps`,
      squat?.prescribedSets === 3 && squat.prescribedRepsMin === 8 && squat.prescribedRepsMax === 12,
      reps(squat));
    ok(`early off-season week ${weekInBlock} targets RPE 6-7`,
      /Target RPE 6-7/i.test(squat?.notes ?? ''),
      squat?.notes);
    ok(`early off-season week ${weekInBlock} avoids grindy 6-8 lower work`,
      !(squat?.prescribedRepsMin === 6 && squat.prescribedRepsMax === 8),
      reps(squat));
    if (weekInBlock === 1) earlyWeight = squat?.prescribedWeightKg ?? 0;
  }

  const [mid] = buildWorkoutsFromCoach(
    [],
    'mc-phase-mid',
    lowerPlan,
    profile('Off-season'),
    { miniCycleNumber: 1, weekInBlock: 3, weekKind: 'build' },
  );
  const midSquat = findExercise(mid, 'Back Squat');
  ok('mid off-season uses a 6-10 bridge prescription',
    midSquat?.prescribedSets === 3 && midSquat.prescribedRepsMin === 6 && midSquat.prescribedRepsMax === 10,
    reps(midSquat));
  ok('mid off-season targets controlled RPE 6-8',
    /Target RPE 6-8/i.test(midSquat?.notes ?? ''),
    midSquat?.notes);

  const [late] = buildWorkoutsFromCoach(
    [],
    'mc-phase-late',
    lowerPlan,
    profile('Off-season'),
    { miniCycleNumber: 1, weekInBlock: 4, weekKind: 'build' },
  );
  const lateSquat = findExercise(late, 'Back Squat');
  ok('late off-season preserves the existing lower 3x6-8 prescription',
    lateSquat?.prescribedSets === 3 && lateSquat.prescribedRepsMin === 6 && lateSquat.prescribedRepsMax === 8,
    reps(lateSquat));
  ok('starting loads bridge upward from early to mid to late',
    earlyWeight > 0 &&
      earlyWeight < (midSquat?.prescribedWeightKg ?? 0) &&
      (midSquat?.prescribedWeightKg ?? 0) < (lateSquat?.prescribedWeightKg ?? 0),
    `early=${earlyWeight}, mid=${midSquat?.prescribedWeightKg}, late=${lateSquat?.prescribedWeightKg}`);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`phaseRepPrescriptionTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
