/**
 * SAM'S SLOT LAW, HELD (R-014, 2026-08-13).
 *
 * His acceptance criteria, verbatim from the order: *"a new cell per slot: a
 * lower day with no hinge is RED, a lower day with two squats is RED, an upper
 * day missing vertical is RED. Sam's sentence is the assertion — nothing else
 * needs authoring."* These are those cells.
 *
 * THE SESSIONS HERE ARE SYNTHETIC ON PURPOSE. The rule must be provable
 * independently of what the generator happens to emit this week — a cell that
 * waited for a real week to contain two squats would be certifying whatever
 * generation does today. The measured state of real weeks is recorded in the
 * registry (19 of 70 days cover every slot) and belongs to the composer unit.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  LOWER_SLOTS,
  UPPER_FULL_SLOTS,
  sessionSlotCoverage,
  slotDayKindFor,
  slotsFilledByRow,
} from '../rules/sessionSlotCoverage';
import type { WorkoutExercise } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** A row carrying only what the rule reads: a name, and optionally a role. */
function row(name: string, role?: WorkoutExercise['role']): WorkoutExercise {
  return {
    id: `row:${name}`, workoutId: 'w', exerciseId: name, exerciseOrder: 0,
    prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 120,
    ...(role ? { role } : {}),
    exercise: { id: name, name } as WorkoutExercise['exercise'],
  } as WorkoutExercise;
}

console.log('\n[1] The oracle reads real exercises — non-vacuity first');
{
  // If these do not resolve, every "missing" assertion below is trivially true
  // and the suite proves nothing. This is the cell that stops that.
  ok('a barbell squat fills the squat slot',
    slotsFilledByRow(row('Back Squat')).includes('squat'),
    JSON.stringify(slotsFilledByRow(row('Back Squat'))));
  ok('an RDL fills the hinge slot',
    slotsFilledByRow(row('RDLs')).includes('hinge'));
  // THE CANONICALISATION THIS RULE DEPENDS ON. Before 2026-08-13 this name
  // resolved to NOTHING, and a "no hinge" finding would have fired on a day
  // that had one.
  ok('"Romanian Deadlift" fills the hinge slot — the canonical join holds',
    slotsFilledByRow(row('Romanian Deadlift')).includes('hinge'),
    JSON.stringify(slotsFilledByRow(row('Romanian Deadlift'))));
  ok('a lunge fills single-leg KNEE, never the squat slot',
    slotsFilledByRow(row('Walking Lunges')).includes('single_leg_knee')
      && !slotsFilledByRow(row('Walking Lunges')).includes('squat'));
}

console.log('\n[2] HIS ACCEPTANCE CRITERIA, one cell each');
{
  // "a lower day with no hinge is RED"
  const noHinge = [row('Back Squat'), row('Walking Lunges'), row('Leg Extension')];
  ok('[SAM] a lower day with NO HINGE names the missing slot',
    sessionSlotCoverage(noHinge, 'lower').missing.includes('hinge'),
    JSON.stringify(sessionSlotCoverage(noHinge, 'lower').missing));

  // "a lower day with two squats is RED" — his Bible :227 says an athlete is
  // better served by a squat and a hinge than by two squats.
  const twoSquats = [row('Back Squat'), row('Front Squat'), row('Leg Extension')];
  const twoSquatCoverage = sessionSlotCoverage(twoSquats, 'lower');
  ok('[SAM] a lower day with TWO SQUATS reports the doubled slot',
    twoSquatCoverage.duplicated.includes('squat'),
    JSON.stringify(twoSquatCoverage.duplicated));
  ok('[SAM] ...and that same day is still missing its hinge',
    twoSquatCoverage.missing.includes('hinge'));

  // "an upper day missing vertical is RED"
  const noVertical = [row('Bench Press'), row('Barbell Row'), row('Bicep Curls')];
  const upper = sessionSlotCoverage(noVertical, 'upper_full');
  ok('[SAM] an upper day with NO VERTICAL names both vertical slots',
    upper.missing.includes('vertical_push') && upper.missing.includes('vertical_pull'),
    JSON.stringify(upper.missing));
}

console.log('\n[3] The complete day — the rule must be satisfiable');
{
  // NON-VACUITY FOR THE WHOLE SUITE. Eight "is missing" assertions all pass on a
  // rule that reports everything missing forever. This one has to come back
  // EMPTY, and it is built from Sam's own fill order.
  const completeLower = [
    row('Back Squat'),            // squat
    row('Romanian Deadlift'),     // hinge
    row('Bulgarian Split Squats'),// single-leg knee
    row('Single Leg RDL'),        // single-leg hip
    row('Pallof Press'),          // accessory / core
  ];
  const cov = sessionSlotCoverage(completeLower, 'lower');
  ok('[SAM] a lower day built to his fill order is COMPLETE',
    cov.missing.length === 0 && cov.filled.length === LOWER_SLOTS.length,
    `missing=${JSON.stringify(cov.missing)} filled=${JSON.stringify(cov.filled)}`);

  const completeUpper = [
    row('Bench Press'), row('Barbell Row'),
    row('Overhead Press'), row('Pull-Ups'), row('Bicep Curls'),
  ];
  const upperCov = sessionSlotCoverage(completeUpper, 'upper_full');
  ok('[SAM] an upper day covering both planes and directions is COMPLETE',
    upperCov.missing.length === 0 && upperCov.filled.length === UPPER_FULL_SLOTS.length,
    `missing=${JSON.stringify(upperCov.missing)}`);
}

console.log('\n[4] Power and conditioning ride on top — they fill NO slot');
{
  // *"then you can throw power and stuff in there"*. Power is already exempt
  // from counting; it must not be able to satisfy a strength slot either, or a
  // day of jumps would read as a covered lower day.
  // ⚠ THESE USE AN EXERCISE THAT WOULD OTHERWISE FILL A SLOT, AND THAT IS THE
  // WHOLE POINT. The first draft used 'Trap Bar Jump' and 'Tempo Run' — both
  // resolve to patterns this rule ignores anyway, so removing the role guard
  // changed nothing and the mutant SURVIVED. The cells were green and empty.
  // A power-role BACK SQUAT is the discriminating case: the exercise fills the
  // squat slot, so only the ROLE can be what stops it.
  ok('a POWER row fills no slot — even when the exercise would',
    slotsFilledByRow(row('Back Squat', 'power')).length === 0,
    JSON.stringify(slotsFilledByRow(row('Back Squat', 'power'))));
  ok('a CONDITIONING row fills no slot — even when the exercise would',
    slotsFilledByRow(row('RDLs', 'conditioning')).length === 0,
    JSON.stringify(slotsFilledByRow(row('RDLs', 'conditioning'))));
  ok('a MOBILITY row fills no slot — even when the exercise would',
    slotsFilledByRow(row('Back Squat', 'mobility')).length === 0);
  // And the day is still judged on its lifts.
  const powerHeavy = [row('Trap Bar Jump', 'power'), row('Lateral Bounds', 'power'), row('Back Squat')];
  ok('a day of power plus one squat is still missing its hinge',
    sessionSlotCoverage(powerHeavy, 'lower').missing.includes('hinge'));
}

console.log('\n[5] The day kind is DELEGATED to the one owner, not re-inferred');
{
  // sessionNaming.inferStrengthMovementPatterns already answers "what movement
  // is this session about". A second regex here would be a second
  // representation of a question the app has already answered once.
  ok('a squat day and a hinge day are both LOWER',
    slotDayKindFor('Lower Squat') === 'lower' && slotDayKindFor('Lower Hinge') === 'lower');
  ok('a push-only or pull-only day is a SPLIT day',
    slotDayKindFor('Upper Push') === 'upper_split' && slotDayKindFor('Upper Pull') === 'upper_split');
  ok('a team night carrying a lift is still judged on the lift',
    slotDayKindFor('Team Training + Upper Pull') === 'upper_split');
  ok('a conditioning day answers to NO slot list',
    slotDayKindFor('Continuous Aerobic') === null);

  // ⚠ THE OWNER'S GAP, ASSERTED SO IT CANNOT BE FORGOTTEN — not patched here.
  // "Upper Body Strength" and "Full Body Strength" are two of Sam's seven signed
  // strength sessions (Bible §20.5) and the shared inference returns NOTHING for
  // them, so those days are currently unjudged. Catching them with a local regex
  // would restore the second representation this delegation exists to remove.
  ok('DECLARED GAP: the shared owner does not classify "Upper Body Strength"',
    slotDayKindFor('Upper Body Strength') === null,
    'if this now resolves, the owner was fixed — delete this cell and celebrate');
  ok('DECLARED GAP: the shared owner does not classify "Full Body Strength"',
    slotDayKindFor('Full Body Strength') === null);
}

console.log(
  `\nSession slot coverage: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
