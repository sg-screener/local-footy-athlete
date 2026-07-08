/**
 * Training logging foundation tests.
 *
 * Run: npx sucrase-node src/__tests__/trainingLoggingTests.ts
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { getConditioningLoggingConfig } from '../utils/conditioningLogging';
import { buildStrengthPerformanceLogs } from '../utils/strengthLogging';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function ex(
  id: string,
  name: string,
  sets = 3,
  repsMin = 8,
  repsMax = 10,
  weight = 0,
): WorkoutExercise {
  return {
    id: `we-${id}`,
    workoutId: 'w-test',
    exerciseId: id,
    exerciseOrder: 1,
    prescribedSets: sets,
    prescribedRepsMin: repsMin,
    prescribedRepsMax: repsMax,
    prescribedWeightKg: weight,
    restSeconds: 90,
    exercise: {
      id,
      name,
      description: name,
      createdAt: '',
      updatedAt: '',
    } as any,
    createdAt: '',
    updatedAt: '',
  };
}

function workout(overrides: Partial<Workout>): Workout {
  return {
    id: 'w-test',
    microcycleId: 'mc-test',
    dayOfWeek: 1,
    name: 'Test Session',
    description: '',
    intensity: 'Moderate',
    workoutType: 'Strength',
    durationMinutes: 45,
    exercises: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Workout;
}

section('1. Conditioning logging config');
{
  const oneKm = workout({
    name: '1km Repeat Intervals',
    workoutType: 'Conditioning',
    conditioningCategory: 'vo2',
    exercises: [ex('cond-1km', '4 x 1km repeats', 1, 1, 1)],
  });
  const config = getConditioningLoggingConfig(oneKm);
  assert(config.level === 'trackable', '1km repeats request trackable conditioning logging');
  assert(config.fields.includes('intervalsCompleted'), '1km repeats include intervals completed');
  assert(config.fields.includes('distanceMeters'), '1km repeats include distance');
  assert(config.fields.includes('rpe'), '1km repeats include RPE');

  const easyBike = workout({
    name: 'Easy Bike',
    workoutType: 'Conditioning',
    conditioningCategory: 'aerobic_base',
    exercises: [ex('easy-bike', 'Easy bike', 1, 1, 1)],
  });
  assert(
    getConditioningLoggingConfig(easyBike).level === 'simple',
    'easy bike keeps simple feedback only',
  );

  const recovery = workout({
    name: 'Recovery Session',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: [ex('mobility', 'Mobility Flow', 1, 10, 15)],
  });
  assert(
    getConditioningLoggingConfig(recovery).level === 'simple',
    'recovery keeps simple feedback only',
  );
}

section('2. Strength logging snapshot');
{
  const strength = workout({
    name: 'Lower Strength',
    workoutType: 'Strength',
    exercises: [
      ex('ex-squat', 'Back Squat', 4, 5, 5, 100),
      ex('ex-rdl', 'RDLs', 3, 8, 10, 80),
      ex('ex-curl', 'Bicep Curl (Dumbbell)', 3, 10, 12, 12),
      ex('cond-bike', 'Bike Flush Finisher', 1, 8, 10, 0),
    ],
  });
  const logs = buildStrengthPerformanceLogs(
    strength,
    { 'ex-squat': 105 },
    'full',
  );
  assert(logs.length === 2, `main strength snapshot excludes accessories/conditioning (got ${logs.length})`);
  assert(logs[0].exerciseName === 'Back Squat', 'first main lift captured by name');
  assert(logs[0].weightKg === 105, 'weight override wins in strength snapshot');
  assert(logs[0].prescribedSets === 4, 'sets captured');
  assert(logs[0].prescribedRepsMin === 5 && logs[0].prescribedRepsMax === 5, 'rep range captured');
  assert(logs.every((entry) => entry.completion === 'full'), 'completion stamped on all main-lift logs');
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}

