/**
 * Pairing Validation Tests
 *
 * Verifies that the deterministic pairing validator in buildWorkoutsFromCoach:
 *   - Strips pairings on non-core sessions
 *   - Caps at max 1 paired block per session
 *   - Strips incomplete groups (not exactly 2 exercises)
 *   - Passes through valid contrast pairs
 */

const { buildWorkoutsFromCoach } = require('/tmp/lfa-compiled/data/defaultProgram');

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) { pass++; }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

// ─── Helper: build a workout with given exercises and tier ───
function buildSingle(exercises, tier = 'core') {
  const result = buildWorkoutsFromCoach([{
    dayOfWeek: 1,
    name: 'Test Workout',
    workoutType: 'Strength',
    sessionTier: tier,
    exercises,
  }], 'mc-test');
  return result[0];
}

console.log('\n=== Section 1: Valid Contrast Pair on Core Session ===');
{
  const workout = buildSingle([
    { name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 1, pairType: 'contrast' },
    { name: 'Box Jump', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 2, pairType: 'contrast' },
    { name: 'RDLs', sets: 3, repsMin: 8, repsMax: 10 },
  ]);

  assert(workout.exercises[0].supersetGroup === 'A', 'First exercise keeps supersetGroup');
  assert(workout.exercises[0].supersetOrder === 1, 'First exercise keeps supersetOrder 1');
  assert(workout.exercises[0].pairType === 'contrast', 'First exercise keeps pairType');
  assert(workout.exercises[1].supersetGroup === 'A', 'Second exercise keeps supersetGroup');
  assert(workout.exercises[1].supersetOrder === 2, 'Second exercise keeps supersetOrder 2');
  assert(!workout.exercises[2].supersetGroup, 'Third exercise has no supersetGroup');
}

console.log('\n=== Section 2: Pairing Stripped on Non-Core (Optional) ===');
{
  const workout = buildSingle([
    { name: 'Lateral Raise', sets: 3, repsMin: 12, repsMax: 15, supersetGroup: 'A', supersetOrder: 1, pairType: 'superset' },
    { name: 'Face Pull', sets: 3, repsMin: 12, repsMax: 15, supersetGroup: 'A', supersetOrder: 2, pairType: 'superset' },
  ], 'optional');

  assert(!workout.exercises[0].supersetGroup, 'Optional session: supersetGroup stripped from ex 1');
  assert(!workout.exercises[0].pairType, 'Optional session: pairType stripped from ex 1');
  assert(!workout.exercises[1].supersetGroup, 'Optional session: supersetGroup stripped from ex 2');
}

console.log('\n=== Section 3: Pairing Stripped on Recovery ===');
{
  const workout = buildSingle([
    { name: 'Foam Roll', sets: 1, repsMin: 30, repsMax: 30, supersetGroup: 'A', supersetOrder: 1 },
    { name: 'Stretch', sets: 1, repsMin: 30, repsMax: 30, supersetGroup: 'A', supersetOrder: 2 },
  ], 'recovery');

  assert(!workout.exercises[0].supersetGroup, 'Recovery session: supersetGroup stripped');
  assert(!workout.exercises[1].supersetGroup, 'Recovery session: supersetGroup stripped');
}

console.log('\n=== Section 4: Max 1 Pair — Excess Groups Stripped ===');
{
  const workout = buildSingle([
    { name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 1, pairType: 'contrast' },
    { name: 'Box Jump', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 2, pairType: 'contrast' },
    { name: 'Bench Press', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'B', supersetOrder: 1, pairType: 'contrast' },
    { name: 'Clap Push Up', sets: 4, repsMin: 5, repsMax: 5, supersetGroup: 'B', supersetOrder: 2, pairType: 'contrast' },
    { name: 'RDLs', sets: 3, repsMin: 8, repsMax: 10 },
  ]);

  // Group A should survive (first encountered)
  assert(workout.exercises[0].supersetGroup === 'A', 'First group preserved');
  assert(workout.exercises[1].supersetGroup === 'A', 'First group preserved (second member)');
  // Group B should be stripped (excess)
  assert(!workout.exercises[2].supersetGroup, 'Second group stripped (ex 3)');
  assert(!workout.exercises[3].supersetGroup, 'Second group stripped (ex 4)');
  // Standalone unaffected
  assert(!workout.exercises[4].supersetGroup, 'Standalone still standalone');
}

console.log('\n=== Section 5: Incomplete Group (1 member) Stripped ===');
{
  const workout = buildSingle([
    { name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 1, pairType: 'contrast' },
    { name: 'RDLs', sets: 3, repsMin: 8, repsMax: 10 },
  ]);

  // Group A only has 1 member — should be stripped
  assert(!workout.exercises[0].supersetGroup, 'Incomplete group stripped');
  assert(!workout.exercises[0].pairType, 'Incomplete group pairType stripped');
}

console.log('\n=== Section 6: Incomplete Group (3 members) Stripped ===');
{
  const workout = buildSingle([
    { name: 'Back Squat', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 1 },
    { name: 'Box Jump', sets: 4, repsMin: 3, repsMax: 3, supersetGroup: 'A', supersetOrder: 2 },
    { name: 'Goblet Squat', sets: 3, repsMin: 10, repsMax: 12, supersetGroup: 'A', supersetOrder: 3 },
  ]);

  // Group A has 3 members — should be stripped (expected exactly 2)
  assert(!workout.exercises[0].supersetGroup, '3-member group stripped (ex 1)');
  assert(!workout.exercises[1].supersetGroup, '3-member group stripped (ex 2)');
  assert(!workout.exercises[2].supersetGroup, '3-member group stripped (ex 3)');
}

console.log('\n=== Section 7: No Pairing Data — Passes Through Clean ===');
{
  const workout = buildSingle([
    { name: 'Back Squat', sets: 4, repsMin: 5, repsMax: 5 },
    { name: 'RDLs', sets: 3, repsMin: 8, repsMax: 10 },
    { name: 'Calf Raises', sets: 3, repsMin: 12, repsMax: 15 },
  ]);

  assert(workout.exercises.length === 3, 'All 3 exercises present');
  assert(!workout.exercises[0].supersetGroup, 'No pairing on ex 1');
  assert(!workout.exercises[1].supersetGroup, 'No pairing on ex 2');
  assert(!workout.exercises[2].supersetGroup, 'No pairing on ex 3');
}

console.log(`\n══════════════════════════════════════════════════`);
console.log(`Pairing Validation Tests: ${pass} passed, ${fail} failed`);
console.log(`══════════════════════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
