/**
 * R-344 — the same lift's own accepted load is carried into a rebuilt week.
 * Run: npm run test:accepted-load-carry
 */
import assert from 'node:assert/strict';
import type { Workout, WorkoutExercise } from '../types/domain';
import {
  carryOwnAcceptedLoads,
  carryOwnAcceptedLoadsIntoWorkout,
} from '../rules/acceptedLoadCarry';

let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

function row(id: string, name: string, kg: number | undefined, role = 'main_strength'): WorkoutExercise {
  return {
    id, workoutId: 'w', exerciseId: `ex-${name}`, exerciseOrder: 1,
    prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 120,
    ...(kg === undefined ? {} : { prescribedWeightKg: kg }),
    exercise: { id: `ex-${name}`, name } as never,
    section18Evidence: { role } as never,
  } as unknown as WorkoutExercise;
}
function workout(dayOfWeek: number, exercises: WorkoutExercise[]): Workout {
  return { id: `w${dayOfWeek}`, dayOfWeek, workoutType: 'Strength', exercises } as unknown as Workout;
}
const load = (w: Workout, name: string) =>
  w.exercises.find((r) => r.exercise?.name === name)?.prescribedWeightKg;

console.log('\n[R-344] own accepted load carried into a rebuilt week');

run('the same lift on the same day takes the accepted load over the estimate', () => {
  const accepted = [workout(1, [row('a1', 'Back Squat', 100), row('a2', 'Pull-Ups', 12.5)])];
  const rebuilt = [workout(1, [row('b1', 'Back Squat', 95), row('b2', 'Pull-Ups', 0)])];
  const out = carryOwnAcceptedLoads({ accepted, rebuilt });
  assert.equal(load(out[0], 'Back Squat'), 100);
  assert.equal(load(out[0], 'Pull-Ups'), 12.5);
});

run('a lift that moved to another day takes the week\'s one accepted load', () => {
  const accepted = [workout(1, [row('a1', 'Back Squat', 100)]), workout(3, [row('a3', 'RDLs', 82.5)])];
  const rebuilt = [workout(3, [row('b1', 'Back Squat', 95), row('b2', 'RDLs', 77.5)])];
  const out = carryOwnAcceptedLoads({ accepted, rebuilt });
  assert.equal(load(out[0], 'Back Squat'), 100);
  assert.equal(load(out[0], 'RDLs'), 82.5);
});

run('a lift the accepted week never carried keeps the compiler\'s own load (R-096 clause 5)', () => {
  const accepted = [workout(1, [row('a1', 'Back Squat', 100)])];
  const rebuilt = [workout(1, [row('b1', 'Front Squat', 80)])];
  const out = carryOwnAcceptedLoads({ accepted, rebuilt });
  assert.equal(load(out[0], 'Front Squat'), 80);
  assert.equal(out[0], rebuilt[0], 'an untouched session is returned as the same object');
});

run('two accepted loads for one lift on other days is ambiguous and leaves the row alone', () => {
  const accepted = [workout(1, [row('a1', 'Calf Raises', 40, 'strength_accessory')]),
    workout(3, [row('a3', 'Calf Raises', 50, 'strength_accessory')])];
  const rebuilt = [workout(5, [row('b1', 'Calf Raises', 30, 'strength_accessory')])];
  assert.equal(load(carryOwnAcceptedLoads({ accepted, rebuilt })[0], 'Calf Raises'), 30);
});

run('same day, same lift twice: the id decides, else the row is left alone', () => {
  const accepted = workout(1, [row('a1', 'Calf Raises', 40, 'strength_accessory'),
    row('a2', 'Calf Raises', 50, 'strength_accessory')]);
  const byId = carryOwnAcceptedLoadsIntoWorkout({
    rebuilt: workout(1, [row('a2', 'Calf Raises', 30, 'strength_accessory')]),
    acceptedSameDay: accepted, acceptedWeek: [accepted],
  });
  assert.equal(load(byId, 'Calf Raises'), 50);
  const noId = carryOwnAcceptedLoadsIntoWorkout({
    rebuilt: workout(1, [row('zz', 'Calf Raises', 30, 'strength_accessory')]),
    acceptedSameDay: accepted, acceptedWeek: [accepted],
  });
  assert.equal(load(noId, 'Calf Raises'), 30);
});

run('a different role is a different lift: a main-lift RDL does not feed a support RDL', () => {
  const accepted = [workout(1, [row('a1', 'RDLs', 82.5, 'main_strength')])];
  const rebuilt = [workout(1, [row('b1', 'RDLs', 60, 'strength_accessory')])];
  assert.equal(load(carryOwnAcceptedLoads({ accepted, rebuilt })[0], 'RDLs'), 60);
});

run('an accepted blank is the athlete\'s choice and is carried as blank', () => {
  const accepted = [workout(1, [row('a1', 'Goblet Squat', undefined)])];
  const rebuilt = [workout(1, [row('b1', 'Goblet Squat', 24)])];
  assert.equal(load(carryOwnAcceptedLoads({ accepted, rebuilt })[0], 'Goblet Squat'), undefined);
});

console.log(`\nAccepted load carry: ${passed} passed / ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
