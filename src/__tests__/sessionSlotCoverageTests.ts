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
  patternsCompletingLadder,
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
  // AND THE SPLIT CARRIES ITS DIRECTION. Judging a pull day against push slots
  // made every Upper Pull day unsatisfiable — 12 of 20 misses in a 5-world sweep
  // were this oracle, not the app.
  ok('a push-only day is a PUSH split, a pull-only day is a PULL split',
    slotDayKindFor('Upper Push') === 'upper_split_push'
      && slotDayKindFor('Upper Pull') === 'upper_split_pull');
  ok('a team night carrying a lift is still judged on the lift',
    slotDayKindFor('Team Training + Upper Pull') === 'upper_split_pull');
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

console.log('\n[6] A unilateral lift fills its SINGLE-LEG slot, not the bilateral one');
{
  // FOUND BY USING THE RULE ON SAM'S OWN FILL ORDER. The first version had a
  // unilateral hinge fill BOTH `hinge` and `single_leg_hip`, so a day built
  // exactly to Bible :227 reported `duplicated: [hinge]` — the rule flagged his
  // own prescription. His list requires a heavy hinge AND a single-leg hip lift,
  // and a single-leg hip lift IS a hinge; counting the overlap made the two
  // impossible to satisfy at once.
  ok('a single-leg RDL is the single-leg HIP slot, not a second heavy hinge',
    JSON.stringify(slotsFilledByRow(row('Single Leg RDL'))) === JSON.stringify(['single_leg_hip']),
    JSON.stringify(slotsFilledByRow(row('Single Leg RDL'))));
  // ...so a day with ONLY a single-leg RDL is still MISSING its heavy hinge,
  // which is what his fill order separates.
  ok('a day with only a single-leg RDL still lacks the heavy hinge',
    sessionSlotCoverage([row('Back Squat'), row('Single Leg RDL')], 'lower').missing.includes('hinge'));
}

console.log('\n[7] THE TWO PRODUCTION FALLBACKS, judged by his own rule');
{
  // These are the exact lists `defaultProgram.ts` returns. The squat one is LIVE
  // — measured firing 6 times across 5 generated worlds.
  const fallback = (names: readonly string[]) => sessionSlotCoverage(names.map((n) => row(n)), 'lower');

  const oldSquat = fallback(['Back Squat', 'Reverse Lunges', 'Leg Extension']);
  ok('[:227] the OLD squat fallback had NO HINGE',
    oldSquat.missing.includes('hinge') && oldSquat.missing.includes('single_leg_hip'),
    JSON.stringify(oldSquat.missing));
  const oldHinge = fallback(['RDLs', 'Hip Thrusts', 'Hamstring Curl']);
  ok('[:227] the OLD hinge fallback was TWO HINGES — his exact "two squats" shape',
    oldHinge.duplicated.includes('hinge') && oldHinge.missing.includes('squat'),
    `dup=${JSON.stringify(oldHinge.duplicated)} missing=${JSON.stringify(oldHinge.missing)}`);

  // AND THE REPLACEMENTS COVER THE BODY. If either of these ever reds, a
  // fallback has drifted back off his fill order.
  const newSquat = fallback(['Back Squat', 'RDLs', 'Reverse Lunges', 'Single Leg RDL', 'Leg Extension']);
  ok('[:227] the squat-led fallback now covers every slot, none doubled',
    newSquat.missing.length === 0 && newSquat.duplicated.length === 0,
    `missing=${JSON.stringify(newSquat.missing)} dup=${JSON.stringify(newSquat.duplicated)}`);
  const newHinge = fallback(['RDLs', 'Back Squat', 'Bulgarian Split Squats', 'Single Leg RDL', 'Pallof Press']);
  ok('[:227] the hinge-led fallback now covers every slot, none doubled',
    newHinge.missing.length === 0 && newHinge.duplicated.length === 0,
    `missing=${JSON.stringify(newHinge.missing)} dup=${JSON.stringify(newHinge.duplicated)}`);
}

// ── THE LADDER ADMISSION RULE — what stopped `main_pattern_drift` eating it ──
//
// `intendedPatterns` names the day's MAIN LIFT, never its whole content. These
// cells hold the rule that lets a hinge stand on a squat-led day WITHOUT
// weakening the guard that keeps a day on its plan.
console.log('\n[8] A row that completes the day\'s ladder is not drift');
{
  const admits = (intended: string[], pattern: string) =>
    patternsCompletingLadder(intended as any).has(pattern as any);

  // THE FIX ITSELF. Measured before it: `DRIFT-DROP "Deadlift" pattern=hinge
  // intended=[squat] workout="Lower Squat"` — one line in the away suite, zero
  // across the whole QA corpus. After it, that line is gone.
  ok('a squat-led day ADMITS a hinge — :227, "a squat and a hinge, not two squats"',
    admits(['squat'], 'hinge'));
  ok('a hinge-led day ADMITS a squat — the ladder is indivisible in both directions',
    admits(['hinge'], 'squat'));

  // AND THE GUARD IS NOT WEAKENED, which is the half that makes this safe. The
  // order was explicit: do not delete the drift guard.
  ok('a squat-led day still REFUSES a push — a bench press on leg day is drift',
    !admits(['squat'], 'push'));
  ok('a squat-led day still REFUSES a pull',
    !admits(['squat'], 'pull'));

  // THE UPPER SPLIT DOES NOT COLLAPSE. Sam: *"if you upper body pull or upper
  // body push then it just becomes horizontal movement, vertical movement, more
  // arm work"* — the DIRECTION collapses, so a push day never admits a pull.
  ok('a push-only day REFUSES a pull — the split is a direction, not a region',
    !admits(['push'], 'pull'));
  ok('a full upper day admits both directions', admits(['push', 'pull'], 'pull'));

  // A MIXED DAY TAKES THE UNION OF THE HALVES IT NAMES, and the pull answer is
  // what proves it is a union rather than "anything goes once two are named".
  ok('a squat+push day admits a hinge', admits(['squat', 'push'], 'hinge'));
  ok('a squat+push day still refuses a pull', !admits(['squat', 'push'], 'pull'));

  // A PULL DAY CAN NOW COVER ITS LADDER AT ALL — the cell that would have caught
  // the one-direction constant, and which did not exist when it shipped.
  const pullDay = sessionSlotCoverage(
    [row('Barbell Row'), row('Pull-Ups'), row('Bicep Curls')], 'upper_split_pull');
  ok('a pull day covered by pull work reports NOTHING missing',
    pullDay.missing.length === 0, JSON.stringify(pullDay.missing));
  const pushDay = sessionSlotCoverage(
    [row('Bench Press'), row('Overhead Press'), row('Lateral Raise')], 'upper_split_push');
  ok('a push day covered by push work reports NOTHING missing',
    pushDay.missing.length === 0, JSON.stringify(pushDay.missing));
  // AND THE DIRECTIONS DO NOT SATISFY EACH OTHER — the non-vacuity for the pair
  // above, without which both could pass on an oracle that reports nothing ever.
  const pullJudgedAsPush = sessionSlotCoverage(
    [row('Barbell Row'), row('Pull-Ups'), row('Bicep Curls')], 'upper_split_push');
  ok('pull work does NOT satisfy a push day',
    pullJudgedAsPush.missing.includes('horizontal_push'),
    JSON.stringify(pullJudgedAsPush.missing));

  // NON-VACUITY: an empty intent admits nothing, so the caller's own
  // `intendedPatterns.size > 0` check is what turns the guard on — not this.
  ok('[non-vacuity] no plan patterns means no admissions',
    patternsCompletingLadder([]).size === 0);
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
