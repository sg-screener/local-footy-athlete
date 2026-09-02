/**
 * SESSION SHAPES, HELD (R-014 as superseded by R-317).
 *
 * A combined lower day still covers squat and hinge. Dedicated Lower Squat and
 * Lower Hinge days deliberately do not: the week owns those two bilateral
 * seats and assigns one to each day.
 *
 * THE SESSIONS HERE ARE SYNTHETIC ON PURPOSE. The rule must be provable
 * independently of what the generator happens to emit this week — a cell that
 * waited for a real week to contain two squats would be certifying whatever
 * generation does today. The measured state of real weeks is recorded in the
 * registry (19 of 70 days cover every slot) and belongs to the composer unit.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  LOWER_HINGE_SLOTS,
  LOWER_SLOTS,
  LOWER_SQUAT_SLOTS,
  UPPER_FULL_SLOTS,
  UPPER_SPLIT_PULL_SLOTS,
  UPPER_SPLIT_PUSH_SLOTS,
  patternsCompletingLadder,
  slotDayKindForPatterns,
  slotsForExerciseName,
  type SessionSlot,
  sessionSlotCoverage,
  slotDayKindFor,
  slotsFilledByRow,
  slotIsTrainableOnKit,
} from '../rules/sessionSlotCoverage';
import type { WorkoutExercise } from '../types/domain';
import type { EquipmentTag } from '../data/exercisePools';
import { decideExerciseForBlock, type BlockExerciseSelection } from '../rules/blockExerciseSelection';
import { composedIdentityFor } from '../rules/composedRowLegality';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';

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

console.log('\n[2] Combined-lower and upper-full shapes remain exact');
{
  // A compressed/combined lower day still owns both bilateral seats.
  const noHinge = [row('Back Squat'), row('Walking Lunges'), row('Leg Extension')];
  ok('a COMBINED lower day with no hinge names the missing slot',
    sessionSlotCoverage(noHinge, 'lower').missing.includes('hinge'),
    JSON.stringify(sessionSlotCoverage(noHinge, 'lower').missing));

  // "a lower day with two squats is RED" — his Bible :227 says an athlete is
  // better served by a squat and a hinge than by two squats.
  const twoSquats = [row('Back Squat'), row('Front Squat'), row('Leg Extension')];
  const twoSquatCoverage = sessionSlotCoverage(twoSquats, 'lower');
  ok('a COMBINED lower day with two squats reports the doubled slot',
    twoSquatCoverage.duplicated.includes('squat'),
    JSON.stringify(twoSquatCoverage.duplicated));
  ok('that COMBINED day is still missing its hinge',
    twoSquatCoverage.missing.includes('hinge'));

  // "an upper day missing vertical is RED"
  const noVertical = [row('Bench Press'), row('Barbell Row'), row('Bicep Curls')];
  const upper = sessionSlotCoverage(noVertical, 'upper_full');
  ok('a FULL upper day with no vertical names both vertical slots',
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
    cov.missing.length === 0
      && cov.filled.length === LOWER_SLOTS.filter((slot) => slot !== 'football_robustness').length,
    `missing=${JSON.stringify(cov.missing)} filled=${JSON.stringify(cov.filled)}`);

  const completeUpper = [
    row('Bench Press'), row('Barbell Row'),
    row('Overhead Press'), row('Pull-Ups'), row('Bicep Curls'),
  ];
  const upperCov = sessionSlotCoverage(completeUpper, 'upper_full');
  ok('[SAM] an upper day covering both planes and directions is COMPLETE',
    upperCov.missing.length === 0
      && upperCov.filled.length === UPPER_FULL_SLOTS.filter(
        (slot) => !['football_robustness', 'push_accessory_1', 'pull_accessory_1'].includes(slot)).length,
    `missing=${JSON.stringify(upperCov.missing)}`);

  const completePush = [
    row('Bench Press'), row('Overhead Press'),
    row('DB Bench Press'),
    row('Tricep Pushdown'), row('Lateral Raise'), row('Ab Wheel'),
  ];
  const pushCov = sessionSlotCoverage(completePush, 'upper_split_push');
  ok('[SAM] split PUSH is horizontal + vertical + core before weekly robustness allocation',
    pushCov.missing.length === 0
      && pushCov.filled.length === 3
      && UPPER_SPLIT_PUSH_SLOTS.length === 6,
    `missing=${JSON.stringify(pushCov.missing)} filled=${JSON.stringify(pushCov.filled)}`);

  const completePull = [
    row('Barbell Row'), row('Pull-Ups'),
    row('Band Pull-Apart'),
    row('Bicep Curl (Dumbbell)'), row('Shrugs'), row('Ab Wheel'),
  ];
  const pullCov = sessionSlotCoverage(completePull, 'upper_split_pull');
  ok('[SAM] split PULL is horizontal + vertical + core before weekly robustness allocation',
    pullCov.missing.length === 0
      && pullCov.filled.length === 3
      && UPPER_SPLIT_PULL_SLOTS.length === 6,
    `missing=${JSON.stringify(pullCov.missing)} filled=${JSON.stringify(pullCov.filled)}`);

  ok('[SAM] required split uppers declare no direct arm or delt-pump seat',
    [...UPPER_SPLIT_PUSH_SLOTS, ...UPPER_SPLIT_PULL_SLOTS].every((slot) =>
      !['biceps', 'triceps', 'shoulders', 'traps', 'arm_or_shoulder'].includes(slot)));
  ok('[SAM] isolation support fills support while a compound press does not',
    slotsFilledByRow(row('Band Pull-Apart')).includes('pull_accessory_1')
      && slotsFilledByRow(row('Band Pull-Apart')).includes('shoulders')
      && !slotsFilledByRow(row('Dips')).includes('push_accessory_1'),
    JSON.stringify({ isolation: slotsFilledByRow(row('Band Pull-Apart')),
      compound: slotsFilledByRow(row('Dips')) }));
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
  ok('dedicated squat and hinge names keep distinct lower purposes',
    slotDayKindFor('Lower Squat') === 'lower_squat'
      && slotDayKindFor('Lower Hinge') === 'lower_hinge');
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

  // ── THE DECLARED GAP IS CLOSED, AND IT UNDER-COUNTED ITSELF ──────────────
  //
  // Two cells here used to assert that the owner classifies NOTHING for
  // "Upper Body Strength" and "Full Body Strength", carrying the note *"if this
  // now resolves, the owner was fixed — delete this cell and celebrate"*.
  //
  // **THE DECLARATION MISSED THE COMMONEST NAME IN THE APP.** Measured
  // 2026-08-13 over 6 generated worlds x 4 weeks: 46 of 94 strength days
  // answered to no ladder, and the biggest single unjudged name was
  // `Lower Body Strength` — 20 days — which the declaration never mentioned.
  // A declared gap is a claim too.
  //
  // THE FIX IS A DELEGATION, NOT THE REGEX THE DECLARATION REFUSED. Those
  // strings are rows in `data/strengthSessionVariants.ts`, the authored set, and
  // each states its own `plannedPatterns`. The authored set answers first; the
  // text probes keep the names it does not hold.
  ok('the authored set classifies "Lower Body Strength" — 20 days, previously unjudged',
    slotDayKindFor('Lower Body Strength') === 'lower');
  ok('the authored set classifies "Upper Body Strength" as a FULL upper day',
    slotDayKindFor('Upper Body Strength') === 'upper_full');
  // NON-VACUITY IN THE OTHER DIRECTION: the authored lookup must not start
  // answering for names it does not hold, or it becomes the regex it replaced.
  ok('a name the authored set does not hold still falls to the text probes',
    slotDayKindFor('Team Training + Upper Push') === 'upper_split_push'
      && slotDayKindFor('Made Up Session') === null);
  // ⚠ STILL UNJUDGED, AND DELIBERATELY. `Full Body Strength` plans squat + push
  // + pull, which is a MIXED day, and `slotDayKindForPatterns` returns null for
  // mixed by rule. **Sam ruled a lower ladder and an upper ladder; he has never
  // ruled a full-body one.** Filling one in here would be this seat writing
  // product law. 4 of the 94 days are in this state.
  ok('OPEN QUESTION: "Full Body Strength" answers to no ladder Sam has ruled',
    slotDayKindFor('Full Body Strength') === null,
    'if this resolves, a full-body ladder was authored — say who ruled it');
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

console.log('\n[7] Dedicated lower shapes and the compressed combined shape');
{
  const squat = (names: readonly string[]) =>
    sessionSlotCoverage(names.map((n) => row(n)), 'lower_squat');
  const hinge = (names: readonly string[]) =>
    sessionSlotCoverage(names.map((n) => row(n)), 'lower_hinge');
  const combined = (names: readonly string[]) =>
    sessionSlotCoverage(names.map((n) => row(n)), 'lower');

  ok('the dedicated squat shape does not request a bilateral hinge',
    !LOWER_SQUAT_SLOTS.includes('hinge'));
  ok('the dedicated hinge shape does not request a bilateral squat',
    !LOWER_HINGE_SLOTS.includes('squat'));
  // R-342 (Sam, 2026-09-02): "there just isn't much meat on the bones of the
  // sessions" — the third seat is a loaded lower accessory, not a third drill.
  const seatCount = (ladder: readonly SessionSlot[], slot: SessionSlot) =>
    ladder.filter((candidate) => candidate === slot).length;
  ok('[R-342] both split lower shapes seat one loaded lower accessory and two robustness seats',
    seatCount(LOWER_SQUAT_SLOTS, 'loaded_lower_accessory') === 1
      && seatCount(LOWER_HINGE_SLOTS, 'loaded_lower_accessory') === 1
      && seatCount(LOWER_SQUAT_SLOTS, 'football_robustness') === 2
      && seatCount(LOWER_HINGE_SLOTS, 'football_robustness') === 2
      && LOWER_SQUAT_SLOTS.length === 5 && LOWER_HINGE_SLOTS.length === 5,
    JSON.stringify({ LOWER_SQUAT_SLOTS, LOWER_HINGE_SLOTS }));
  ok('[R-342] the loaded accessory seat sits third, ahead of the robustness seats',
    LOWER_SQUAT_SLOTS[2] === 'loaded_lower_accessory'
      && LOWER_HINGE_SLOTS[2] === 'loaded_lower_accessory');
  const loadedSquat = squat(['Back Squat', 'Reverse Lunges', 'Leg Extension']);
  const loadedHinge = hinge(['RDLs', 'Single Leg RDL', 'Back Extension']);
  ok('[R-342] a lower-isolation row fills the split day\'s loaded accessory seat',
    !loadedSquat.missing.includes('loaded_lower_accessory')
      && !loadedHinge.missing.includes('loaded_lower_accessory'),
    JSON.stringify({ squat: loadedSquat.missing, hinge: loadedHinge.missing }));
  ok('[R-342] a prehab drill never fills the loaded seat; the female low-fatigue seat still takes it',
    !slotsForExerciseName('Crab Walks').includes('loaded_lower_accessory')
      && !slotsForExerciseName('Bosch Hold').includes('loaded_lower_accessory')
      && slotsForExerciseName('Crab Walks').includes('lower_accessory')
      && slotsForExerciseName('Leg Extension').includes('loaded_lower_accessory')
      && slotsForExerciseName('Back Extension').includes('loaded_lower_accessory'),
    JSON.stringify({ crab: slotsForExerciseName('Crab Walks'), leg: slotsForExerciseName('Leg Extension') }));
  // R-342: the split ladders carry a loaded lower accessory seat, so a
  // complete day carries a loaded isolation row too.
  const completeSquat = squat(['Back Squat', 'Reverse Lunges', 'Single Leg RDL', 'Leg Extension']);
  ok('a dedicated squat day is complete without a bilateral hinge',
    completeSquat.missing.length === 0,
    JSON.stringify(completeSquat.missing));
  const completeHinge = hinge(['RDLs', 'Single Leg RDL', 'Bulgarian Split Squats', 'Back Extension']);
  ok('a dedicated hinge day is complete without a bilateral squat',
    completeHinge.missing.length === 0,
    JSON.stringify(completeHinge.missing));

  // ── AND THE COMBINED DAYS, WHICH WERE THE LAST 3-ROW LOWER FALLBACK ──────
  //
  // **`Lower Body Strength` is the commonest strength day the app builds — 20
  // of 94 in a 6-world x 4-week sweep — and it shipped three rows.** Naming BOTH
  // lower patterns had somehow bought FEWER of Sam's slots than naming one.
  const oldCombinedLower = combined(['Back Squat', 'RDLs', 'Pallof Press']);
  ok('[:227] the OLD combined-lower fallback had NEITHER single-leg slot',
    oldCombinedLower.missing.includes('single_leg_knee')
      && oldCombinedLower.missing.includes('single_leg_hip'),
    JSON.stringify(oldCombinedLower.missing));
  const newCombinedSquatLed = combined(['Back Squat', 'RDLs', 'Reverse Lunges', 'Single Leg RDL', 'Pallof Press']);
  ok('[:227] the squat-led COMBINED fallback covers every slot, none doubled',
    newCombinedSquatLed.missing.length === 0 && newCombinedSquatLed.duplicated.length === 0,
    `missing=${JSON.stringify(newCombinedSquatLed.missing)} dup=${JSON.stringify(newCombinedSquatLed.duplicated)}`);
  const newCombinedHingeLed = combined(['RDLs', 'Goblet Squat', 'Bulgarian Split Squats', 'Single Leg RDL', 'Pallof Press']);
  ok('[:227] the hinge-led COMBINED fallback covers every slot, none doubled',
    newCombinedHingeLed.missing.length === 0 && newCombinedHingeLed.duplicated.length === 0,
    `missing=${JSON.stringify(newCombinedHingeLed.missing)} dup=${JSON.stringify(newCombinedHingeLed.duplicated)}`);

  // THE UPPER COMBINED DAY ANSWERS TO BOTH PLANES AND BOTH DIRECTIONS —
  // *"push pull on the horizontal, push pull on the vertical then … arm work"*.
  const upper = (names: readonly string[]) => sessionSlotCoverage(names.map((n) => row(n)), 'upper_full');
  const oldCombinedUpper = upper(['Bench Press', 'Chest Supported Row', 'Face Pulls']);
  ok('[SAM] the OLD combined-upper fallback had NEITHER vertical',
    oldCombinedUpper.missing.includes('vertical_push')
      && oldCombinedUpper.missing.includes('vertical_pull'),
    JSON.stringify(oldCombinedUpper.missing));
  const newCombinedUpper = upper(['Bench Press', 'Chest Supported Row', 'Overhead Press', 'Pull-Ups', 'Face Pulls']);
  ok('[SAM] the push-led COMBINED upper fallback covers every slot',
    newCombinedUpper.missing.length === 0,
    `missing=${JSON.stringify(newCombinedUpper.missing)}`);
  const newCombinedUpperPullLed = upper(['Pull-Ups', 'Incline DB Bench', 'Barbell Row', 'Overhead Press', 'Face Pulls']);
  ok('[SAM] the pull-led COMBINED upper fallback covers every slot',
    newCombinedUpperPullLed.missing.length === 0,
    `missing=${JSON.stringify(newCombinedUpperPullLed.missing)}`);
}

// ── THE SLOT SURVIVES ROTATION, WHICH IS WHERE IT WAS BEING LOST ───────────
//
// **THE COMPOSER PUT THE ROW IN AND `applyPoolRotation` TOOK IT BACK OUT.**
// `Single-Leg RDL` shared a (slot, role) pair with `Hip Thrusts`,
// `Kettlebell Swings` and `Glute Bridge` — three BILATERAL hinges — and a pool
// slot is an interchangeability claim (R-076). So the single-leg hip lift
// rotated into a second heavy hinge: 20 days missing `single_leg_hip` and 22
// reporting a doubled `hinge` across 6 worlds x 4 weeks, one defect wearing two
// numbers.
//
// This is R-080's ruling landing on its sibling slot. R-080 split the SQUAT
// accessory pool for the identical reason — *"a lunge may not rotate into a
// squat"* — and the hinge pool one slot over was never looked at.
console.log('\n[7b] A single-leg hip lift may not rotate into a bilateral hinge');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { STRENGTH_POOLS } = require('../data/exercisePoolsStrength') as any;
  const entries = STRENGTH_POOLS.hinge.accessory.entries as Array<{ name: string; group?: string }>;
  const groupOf = (name: string) => entries.find((e) => e.name === name)?.group;

  // NON-VACUITY: if the pool is ever renamed or emptied, `groupOf` returns
  // undefined for everything and a naive inequality check passes on nothing.
  ok('[non-vacuity] the hinge accessory pool holds the rows this cell judges',
    entries.length >= 4 && entries.every((e) => typeof e.group === 'string'),
    `entries=${JSON.stringify(entries.map((e) => [e.name, e.group]))}`);
  ok('Single-Leg RDL is NOT interchangeable with Hip Thrusts',
    groupOf('Single-Leg RDL') !== groupOf('Hip Thrusts'));
  ok('...nor with Kettlebell Swings or Glute Bridge',
    groupOf('Single-Leg RDL') !== groupOf('Kettlebell Swings')
      && groupOf('Single-Leg RDL') !== groupOf('Glute Bridge'));
  // AND THE THREE BILATERAL HINGES STAY INTERCHANGEABLE WITH EACH OTHER — the
  // split narrows exactly one thing and must not quietly narrow rotation twice.
  ok('the three bilateral hinges still rotate among themselves',
    groupOf('Hip Thrusts') === groupOf('Kettlebell Swings')
      && groupOf('Hip Thrusts') === groupOf('Glute Bridge'));

  // ── AND THE BEHAVIOURAL HALF, BECAUSE THE TABLE CELLS ABOVE ARE STRUCTURE ──
  //
  // ⚠ THE GROUP CELLS ALONE ARE NOT ENOUGH, AND THAT WAS MEASURED, NOT ASSUMED.
  // Collapsing the two groups back into one reddens the three cells above — and
  // **the generated census below stayed green at 1 of 7**, because its three
  // worlds x one week never reach the rotation index that spends the slot. A
  // structural assertion about a table is not an assertion about what the
  // athlete is handed. This drives the real rotation over a full block.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // Retired: the deleted index-based applyPoolRotation writer. The existing
  // block-selection owner now consumes recorded choices and a slot-scoped pool.
  const legalCandidates = selectableExerciseNames().filter(name =>
    slotsFilledByRow(row(name)).includes('single_leg_hip')).map(composedIdentityFor);
  ok('current selection has a real single-leg hip candidate pool', legalCandidates.length > 0);
  const history: BlockExerciseSelection[] = [];
  const rotated: string[] = [];
  for (let cycle = 1; cycle <= 4; cycle += 1) {
    const inputs = { phase: 'Pre-season' as const, blockNumber: cycle, slot: 'single_leg_hip' as const,
      group: null, role: 'single_leg' as const, legalCandidates, previousSelection: history.at(-1) ?? null,
      currentBlockSelection: null, recentSelections: [...history].reverse(), progressedIdentities: [], pinnedIdentities: [] };
    const selection = decideExerciseForBlock(inputs);
    const record: BlockExerciseSelection = { blockNumber: cycle, blockStartISO: `2026-0${cycle + 1}-02`,
      slot: inputs.slot, group: null, role: inputs.role, identity: selection.identity, seatIndex: 0 };
    for (let week = 1; week <= 4; week += 1) {
      rotated.push(decideExerciseForBlock({ ...inputs, currentBlockSelection: record }).identity);
    }
    history.push(record);
  }
  ok('[non-vacuity] rotation was actually exercised over a whole block',
    rotated.length === 16 && rotated.every((name) => name.length > 0));
  const lostTheSlot = rotated.filter(
    (name) => !slotsFilledByRow(row(name)).includes('single_leg_hip'));
  ok('rotation never spends the single-leg hip slot on a bilateral hinge',
    lostTheSlot.length === 0,
    `rotated into: ${[...new Set(lostTheSlot)].join(', ')}`);
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
  ok('a dedicated squat day refuses a bilateral hinge',
    !admits(['squat'], 'hinge'));
  ok('a dedicated hinge day refuses a bilateral squat',
    !admits(['hinge'], 'squat'));

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
  ok('a squat+push day does not invent an unplanned hinge', !admits(['squat', 'push'], 'hinge'));
  ok('a squat+push day still refuses a pull', !admits(['squat', 'push'], 'pull'));
  ok('a combined lower day admits both authored patterns',
    admits(['squat', 'hinge'], 'squat') && admits(['squat', 'hinge'], 'hinge'));

  // A PULL DAY CAN NOW COVER ITS LADDER AT ALL — the cell that would have caught
  // the one-direction constant, and which did not exist when it shipped.
  // The old three-row "complete" expectation predates the six-slot split
  // decisions (2026-08-21 and R305). Keep direction/order checks against its current shape.
  const pullRows = ['Barbell Row', 'Pull-Ups', 'Band Pull-Apart',
    'Bicep Curl (Dumbbell)', 'Shrugs', 'Ab Wheel'].map(name => row(name));
  const pullDay = sessionSlotCoverage(pullRows, 'upper_split_pull');
  ok('a pull day covered by pull work reports NOTHING missing',
    pullDay.missing.length === 0, JSON.stringify(pullDay.missing));
  const pushDay = sessionSlotCoverage(
    ['Bench Press', 'Overhead Press', 'DB Bench Press',
      'Tricep Pushdown', 'Lateral Raise', 'Ab Wheel'].map(name => row(name)), 'upper_split_push');
  ok('a push day covered by push work reports NOTHING missing',
    pushDay.missing.length === 0, JSON.stringify(pushDay.missing));
  // AND THE DIRECTIONS DO NOT SATISFY EACH OTHER — the non-vacuity for the pair
  // above, without which both could pass on an oracle that reports nothing ever.
  const pullJudgedAsPush = sessionSlotCoverage(
    [row('Barbell Row'), row('Pull-Ups'), row('Bicep Curls')], 'upper_split_push');
  ok('pull work does NOT satisfy a push day',
    pullJudgedAsPush.missing.includes('horizontal_push'),
    JSON.stringify(pullJudgedAsPush.missing));

  // ── THE APP'S OWN PULL DAY, WHICH THE ORACLE USED TO FAIL ──────────────
  // `Pull-Ups + Barbell Row + Face Pulls` was reported missing arm work AND
  // doubling horizontal pull, 12 times across a 5-world sweep. It is a complete
  // day by Sam's split sentence — a vertical, a horizontal, and accessory work.
  const realPullDay = sessionSlotCoverage(
    [row('Pull-Ups'), row('Barbell Row'), row('Face Pulls')], 'upper_split_pull');
  ok('the historical three-row pull day is incomplete under the current split contract',
    realPullDay.missing.length === 1 && realPullDay.missing.includes('core'), JSON.stringify(realPullDay.missing));
  ok('face pulls do not silently replace the required core seat',
    realPullDay.missing.includes('core'));
  // AND THE ANCHOR IS STILL AN ANCHOR — the non-vacuity. Two ROWS with nowhere
  // else to go is still his "two squats" shape and must still report doubled.
  const twoAnchors = sessionSlotCoverage(
    [row('Barbell Row'), row('Chest Supported Row'), row('Pull-Ups')], 'upper_split_pull');
  ok('two horizontal-pull ANCHORS still report a doubled slot',
    twoAnchors.duplicated.includes('horizontal_pull'),
    JSON.stringify(twoAnchors.duplicated));
  // ORDER-INDEPENDENCE, which is the whole reason the matching is exact rather
  // than greedy. The same rows in a different order must give the same answer.
  const reversed = sessionSlotCoverage(
    [...pullRows].reverse(), 'upper_split_pull');
  ok('the answer does not depend on row order',
    JSON.stringify(reversed.missing) === JSON.stringify(pullDay.missing)
      && JSON.stringify(reversed.duplicated) === JSON.stringify(pullDay.duplicated),
    `missing=${JSON.stringify(reversed.missing)} dup=${JSON.stringify(reversed.duplicated)}`);

  // ── THE LADDER FROM THE PLAN'S PATTERNS, not from a session title ──────
  // This is what lets the canonicaliser ask "does this accessory belong on THIS
  // day" — the check that was missing when a day named `Lower Squat` shipped
  // Bicep Curls, Tricep Pushdowns and Face Pulls alongside one Back Squat.
  ok('a squat-led plan entry is a dedicated SQUAT day',
    slotDayKindForPatterns(['squat'] as any) === 'lower_squat');
  ok('a hinge-led plan entry is a dedicated HINGE day',
    slotDayKindForPatterns(['hinge'] as any) === 'lower_hinge');
  ok('push+pull is a FULL upper day',
    slotDayKindForPatterns(['push', 'pull'] as any) === 'upper_full');
  ok('pull alone is a PULL split',
    slotDayKindForPatterns(['pull'] as any) === 'upper_split_pull');
  // A MIXED day answers to no single ladder, and guessing one would judge a real
  // defect under the wrong rule. null means "no ladder", which keeps the
  // caller's previous behaviour rather than inventing one.
  ok('a MIXED lower+upper plan entry has NO single ladder',
    slotDayKindForPatterns(['squat', 'push'] as any) === null);
  ok('[non-vacuity] no patterns means no ladder',
    slotDayKindForPatterns([] as any) === null);
  // AND THE LOWER LADDER HAS NO ARM SLOT — the fact the whole fix rests on.
  ok('the required LOWER ladder contains football robustness but no arm work',
    LOWER_SLOTS.includes('football_robustness') && !LOWER_SLOTS.includes('arm_or_shoulder'));

  // NON-VACUITY: an empty intent admits nothing, so the caller's own
  // `intendedPatterns.size > 0` check is what turns the guard on — not this.
  ok('[non-vacuity] no plan patterns means no admissions',
    patternsCompletingLadder([]).size === 0);
}

// ── THE ORACLE POINTED AT WHAT THE APP ACTUALLY SHIPS ─────────────────────
//
// **EVERY CELL ABOVE FEEDS THIS ORACLE HAND-BUILT ROWS.** They prove it answers
// correctly; **not one of them asks whether a week the app GENERATES passes it.**
// That is the fixture-fidelity law one step on — a suite can be entirely green
// about a rule the product breaks on every build, and this one was.
//
// **WHAT IT FOUND, 2026-08-13:** an off-season BODYWEIGHT week ships a
// *"Lower Squat"* day missing `hinge`, `single_leg_knee` AND `single_leg_hip` —
// three of the five slots R-014 names in Sam's own words (*"lower body strength
// should have a hinge, a squat, a single leg knee, a single leg hip, and
// accessory and/or some core"*). **The full-gym worlds pass**, so this is not the
// ladder being unbuildable; it is the ladder going unchecked where equipment is
// thin, and bodyweight single-leg work plainly exists (lunges, single-leg RDL,
// step-ups).
//
// **A RATCHET, NOT A PIN.** It asserts the deficient count does not GROW. Pinning
// the exact number would red on every legitimate improvement; asserting zero
// today would be a knowingly-red cell in a chain suite. The number falls or the
// cell reds — the same shape as the typecheck gate and the UNENFORCED count.
{
  const { generateProgramLocally } = require('../services/api/generateProgram') as any;
  const CENSUS_BASE = {
    ...athleteAnswers(ARCHETYPES[6]),
    trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete', trainingDaysPerWeek: 5,
    equipmentAnswer: presetEquipmentAnswer('commercial_gym', '2026-07-13'),
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday',
    recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
  };
  const CENSUS_WORLDS: Array<[string, unknown]> = [
    ['in-season full gym', { ...CENSUS_BASE, seasonPhase: 'In-season' }],
    ['pre-season full gym', { ...CENSUS_BASE, seasonPhase: 'Pre-season' }],
    ['off-season bodyweight', {
      ...CENSUS_BASE, seasonPhase: 'Off-season',
      equipment: ['Bodyweight Only'], teamTrainingDays: [],
      seasonFinishedOn: '2026-06-15',
      equipmentAnswer: { tags: {}, modalities: {}, answeredOn: '2026-07-13' },
    }],
  ];
  // ── A LOWER DAY MUST CONTAIN LOWER WORK ────────────────────────────────
  //
  // **THE DEFECT: a leg day shipped ARM WORK because its own description said
  // the word "accessory".** The plan entry's focus reads *"Lower body - squat
  // emphasis (quad-dominant: squat, lunge, leg press; optional quad ACCESSORY:
  // leg extension)"*, and `fallbackExercisesForPlanEntry`'s
  // `/accessor|prehab|gunshow|pump|low-fatigue/i` branch matched inside it —
  // BEFORE any pattern branch — returning
  // `Bicep Curls · Tricep Pushdowns · Face Pulls · Calf Raises · Pallof Press`.
  //
  // Measured on the bodyweight world, the day named `Lower Squat`:
  //   before  missing=[hinge, single_leg_knee, single_leg_hip]
  //   after   missing=[]
  //
  // THIS CELL IS THE FLOOR, NOT THE LADDER. Coverage is already ratcheted below;
  // this asserts the cruder thing that ratchet cannot say — that a day the plan
  // calls LOWER contains at least one squat-or-hinge row at all. A day of curls
  // named "Lower Squat" is a different kind of wrong from a day missing a slot.
  const lowerDaysWithoutLowerWork: string[] = [];

  /** Measured 2026-08-13. Lower it when a day is fixed; never raise it. */
  const DEFICIENT_CEILING = 1;
  let laddered = 0;
  const deficient: string[] = [];
  for (const [label, profile] of CENSUS_WORLDS) {
    const program = generateProgramLocally(profile as never, {
      todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
    });
    for (const workout of (program?.microcycles?.[0]?.workouts ?? [])) {
      const kind = slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []);
      if (!kind) continue;
      if (kind === 'lower') {
        // ⚠ THE FIRST VERSION OF THIS ASKED "does the day contain ANY lower
        // row" AND ITS MUTANT SURVIVED. The defective day was
        // `Bicep Curls · Tricep Pushdowns · Tib Raises · Pallof Press · Back
        // Squat` — it HAS a squat, so "any lower row" was satisfied while the
        // day was three-quarters arm work. Caught by removing the production
        // guard and watching this cell stay green.
        //
        // THE HONEST QUESTION IS THE OPPOSITE ONE: Sam's LOWER ladder contains
        // no `arm_or_shoulder` slot at all, so an arm row on a leg day is not
        // "extra" — it is the wrong body half, and one is enough to say so.
        const armRows = (workout.exercises ?? [])
          .filter((row) => slotsFilledByRow(row).includes('arm_or_shoulder'))
          .map((row) => String(row?.exercise?.name ?? '?'));
        if (armRows.length > 0) {
          lowerDaysWithoutLowerWork.push(`${label} | ${workout.name} -> ${armRows.join(', ')}`);
        }
      }
      laddered += 1;
      const coverage = sessionSlotCoverage(workout.exercises ?? [], kind,
        resolveEquipmentCapabilities(profile as never).tags as EquipmentTag[]);
      if (coverage.missing.length > 0 || coverage.duplicated.length > 0) {
        deficient.push(`${label} | ${workout.name} [${kind}] missing=${JSON.stringify(coverage.missing)} duplicated=${JSON.stringify(coverage.duplicated)}`);
      }
    }
  }
  // NON-VACUITY FIRST, AND IT IS THE WHOLE RISK HERE: a census that generated no
  // laddered day would report ZERO deficient and look like perfect health.
  ok('[non-vacuity] the census actually reached laddered days',
    laddered >= 3, `laddered days seen: ${laddered}`);
  ok('no generated day is missing MORE of Sam\'s ladder than it was',
    deficient.length <= DEFICIENT_CEILING,
    `${deficient.length} deficient of ${laddered} (ceiling ${DEFICIENT_CEILING})\n     ${deficient.join('\n     ')}`);

  // THE FLOOR, BENEATH THE LADDER RATCHET ABOVE. A day of curls named
  // "Lower Squat" is a different kind of wrong from a day missing one slot, and
  // the ratchet cannot say it — it counts deficiencies, not absurdities.
  ok('a LOWER day carries no arm/shoulder work — his ladder has no such slot',
    lowerDaysWithoutLowerWork.length === 0,
    `arm work on leg days: ${lowerDaysWithoutLowerWork.join(' | ')}`);
  console.log(`\n  SLOT CENSUS: ${deficient.length} deficient of ${laddered} laddered days (ceiling ${DEFICIENT_CEILING})`);
  for (const line of deficient) console.log(`    ${line}`);
}

// ── AND THE SAME CENSUS ASKS THE OTHER QUESTION: CAN HE ACTUALLY DO IT? ────
//
// **A BODYWEIGHT-ONLY ATHLETE IS PRESCRIBED A BARBELL BACK SQUAT.** Measured
// 2026-08-13, not inferred, on a generated off-season week for a profile whose
// equipment answer is `['Bodyweight Only']`.
//
// **WHY NOTHING CATCHES IT — TWO REASONS, EITHER ALONE ENOUGH:**
//   1. `postGenerationConstraintValidation` filters rows by
//      `row.exercise?.equipmentRequired`, and **every production site sets that
//      to `[]`** (`workoutCanonicalisation.ts:449`, `coachActions.ts:617`/`:760`,
//      `applyAdjustmentEvents.ts:739`). An empty list passes unconditionally.
//   2. That filter only runs when a **temporary** equipment FACT is live. The
//      athlete's standing profile answer is not a constraint, so on an ordinary
//      week the branch is skipped before the empty data even matters.
//
// **THE DATA IS NOT MISSING — THE VOCABULARY IS SPLIT.** `exercisePools.ts` has
// 91 entries and **90 carry `equipment: EquipmentTag[]`**. But `Back Squat`,
// `Tricep Pushdowns` and the rest of the main lifts are **in no pool** — they
// live in `exerciseTags.ts`, which has no equipment column. **The half that needs
// gating least is the half carrying the gate.**
//
// ⚠ THE LIST BELOW IS TEST FIXTURE DATA AND IS DELIBERATELY SMALL AND OBVIOUS.
// It is NOT a substitute for the missing column and must not become one — every
// entry is a lift whose equipment is not arguable (a Back Squat needs a barbell).
// **When `ExerciseTag` gains its column, this list should be DELETED and the
// cell should read the real requirement.**
{
  const { generateProgramLocally } = require('../services/api/generateProgram') as any;
  const NEEDS_KIT: Readonly<Record<string, string>> = {
    'Back Squat': 'barbell', 'Front Squat': 'barbell', 'Deadlift': 'barbell',
    'Romanian Deadlift': 'barbell', 'RDLs': 'barbell', 'Bench Press': 'barbell',
    'Overhead Press': 'barbell', 'Barbell Row': 'barbell',
    'Trap Bar Deadlift': 'barbell', 'Hip Thrusts': 'barbell', 'Power Clean': 'barbell',
    'Tricep Pushdowns': 'cables', 'Face Pulls': 'cables', 'Cable Face Pull': 'cables',
    'Seated Cable Row': 'cables', 'Lat Pulldown': 'cables',
    'Leg Extension': 'machine', 'Hamstring Curl': 'machine', 'Leg Press': 'machine',
  };
  /** Measured 2026-08-13. Lower it as the gap closes; never raise it. */
  const KIT_VIOLATION_CEILING = 5;
  const bodyweightProfile = {
    ...athleteAnswers({ ...ARCHETYPES[6], equipment: 'bodyweight', initialPhase: 'Off-season', extraGame: false }),
    trainingLocation: 'Commercial gym', equipment: ['Bodyweight Only'],
    equipmentSelectionCompleteness: 'complete', trainingDaysPerWeek: 5,
    equipmentAnswer: { tags: {}, modalities: {}, answeredOn: '2026-07-13' },
    seasonFinishedOn: '2026-06-15',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDays: [], gameDay: 'Saturday', seasonPhase: 'Off-season',
    recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
  };
  const program = generateProgramLocally(bodyweightProfile as never, {
    todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
  });
  const workouts = program?.microcycles?.[0]?.workouts ?? [];
  const violations: string[] = [];
  let rowsSeen = 0;
  for (const workout of workouts) {
    for (const row of (workout.exercises ?? [])) {
      rowsSeen += 1;
      const rowName = String(row?.exercise?.name ?? '');
      if (NEEDS_KIT[rowName]) {
        violations.push(`${workout.name} | ${rowName} (needs ${NEEDS_KIT[rowName]})`);
      }
    }
  }
  // NON-VACUITY: a week that generated no rows would report ZERO violations and
  // look like perfect health — the same trap the slot census guards against.
  ok('[non-vacuity] the equipment census actually saw prescribed rows',
    rowsSeen >= 10, `rows seen: ${rowsSeen}`);
  ok('a bodyweight athlete is prescribed no MORE kit-requiring lifts than before',
    violations.length <= KIT_VIOLATION_CEILING,
    `${violations.length} violations (ceiling ${KIT_VIOLATION_CEILING})\n     ${violations.join('\n     ')}`);
  console.log(`\n  EQUIPMENT CENSUS: ${violations.length} kit-requiring lifts prescribed to a BODYWEIGHT athlete (ceiling ${KIT_VIOLATION_CEILING})`);
  for (const line of violations) console.log(`    ${line}`);
}

// ── R-084 / R-083: A SLOT THE KIT CANNOT TRAIN IS NOT A COVERAGE DEFECT ─────
//
// **Sam, 2026-08-13, ruling R-084:** *"single leg hip thrust is an accessory"* —
// and with it: **"leave it, they need a gym for that. Stop flagging the
// single-leg hip slot as missing on a bodyweight kit — R-083 says that pattern
// is simply unavailable, not a defect. And the single-leg hip pool being one
// exercise is intentional: it's meant to repeat."**
//
// THE SLOT IS ONE EXERCISE DEEP BY DESIGN. `single_leg_hip` is filled only by
// `Single-Leg RDL` (the only `hinge` + `unilateral` tag in the table), and his
// own equipment sheet answers `['barbell']` for it. So a no-kit athlete cannot
// fill it — **and that is the kit's answer, not a hole in the composer.**
//
// THIS IS DERIVED, NEVER A SPECIAL CASE FOR ONE SLOT. The oracle asks, for each
// required slot, whether ANY tagged exercise that fills it is legal on the kit.
// Name a bodyweight single-leg hip lift tomorrow and this stops firing on its
// own; take the barbell away from a squat and the squat slot goes the same way.
console.log('\n[R-084] a slot the kit cannot train is UNAVAILABLE, not MISSING');
{
  const BODYWEIGHT: readonly EquipmentTag[] = ['bodyweight'];
  const FULL_GYM: readonly EquipmentTag[] = [
    'bodyweight', 'dumbbells', 'barbell', 'rack', 'bench', 'cables', 'machine', 'bands',
  ];
  // A no-kit lower day built as well as a no-kit athlete CAN build one.
  const noKitLowerDay = [
    row('Bodyweight Squat'), row('Single-Leg Squat (to Box)'),
    row('Pallof Press'),
  ];
  // R-233 permits the hamstring pair to fill single-leg hip. Nordic Lower
  // therefore cannot be used as a fixture claiming this slot is absent.
  ok('the approved Nordic option satisfies the single-leg hip slot',
    !sessionSlotCoverage([...noKitLowerDay, row('Nordic Lower')], 'lower', BODYWEIGHT).missing.includes('single_leg_hip'));

  // NON-VACUITY FIRST — if `single_leg_hip` were not required on a lower day at
  // all, every assertion below would pass on nothing.
  ok('[non-vacuity] the lower ladder really does require single_leg_hip',
    LOWER_SLOTS.includes('single_leg_hip'), JSON.stringify(LOWER_SLOTS));

  // ⚠ AND THIS IS THE CELL THAT CAUGHT ME. I asked Sam to rule on the premise
  // that a no-kit athlete CANNOT fill `single_leg_hip`, reading `['barbell']`
  // off his equipment sheet. **The sheet answers "what does it USE", and the
  // availability question is "can they PERFORM it" — the exact conflation that
  // file's own docstring warns about at length.** He had already ruled the
  // second question, and the opposite way:
  //
  //   *"Pull-Ups must read illegal, Walking Lunges and Single Leg RDL must read
  //   legal"* — on a bodyweight kit (`exerciseEquipmentRequirement.ts:29-35`).
  //
  // **So a no-kit athlete CAN do a Single-Leg RDL, and the slot IS trainable.**
  // Suppressing it would have hidden a REAL composer gap behind a kit excuse.
  ok('single_leg_hip IS trainable on bodyweight — Sam ruled the Single-Leg RDL legal unloaded',
    slotIsTrainableOnKit('single_leg_hip', BODYWEIGHT));
  const bw = sessionSlotCoverage(noKitLowerDay, 'lower', BODYWEIGHT);
  ok('so it is still reported MISSING on a no-kit lower day that lacks it',
    bw.missing.includes('single_leg_hip') && !bw.unavailable.includes('single_leg_hip'),
    `missing=${JSON.stringify(bw.missing)} unavailable=${JSON.stringify(bw.unavailable)}`);

  // ── WHAT THE MECHANISM DOES CATCH, AND IT IS R-083's OWN SENTENCE ─────────
  //
  // *"ya can't do much with overhead pushing or pull or even horizontal pulling
  // without equipment - i can't account for everyone and if they want to train
  // properly they'll sign up to a gym"* (R-083). **Derived independently, the
  // oracle names those three and only those three.** Nothing in the code spells
  // them; it asks the tag table and his sheet.
  const upperBw = sessionSlotCoverage([row('Push-Ups')], 'upper_full', BODYWEIGHT);
  ok('R-083: horizontal_pull, vertical_push and vertical_pull are UNAVAILABLE on a bodyweight kit',
    ['horizontal_pull', 'vertical_push', 'vertical_pull']
      .every((slot) => upperBw.unavailable.includes(slot as never)),
    `unavailable=${JSON.stringify(upperBw.unavailable)}`);
  ok('R-083: and they are NOT also reported missing — one answer, not two',
    ['horizontal_pull', 'vertical_push', 'vertical_pull']
      .every((slot) => !upperBw.missing.includes(slot as never)),
    `missing=${JSON.stringify(upperBw.missing)}`);
  ok('R-083: horizontal_push is still OWED — press-ups need nothing, so it is not excused',
    upperBw.filled.includes('horizontal_push') && !upperBw.unavailable.includes('horizontal_push'),
    `filled=${JSON.stringify(upperBw.filled)} unavailable=${JSON.stringify(upperBw.unavailable)}`);

  // THE EXEMPTION NARROWS EXACTLY ONE THING. A slot the kit CAN train is still a
  // defect when it is absent — otherwise this would excuse every gap.
  const bwNoSquat = sessionSlotCoverage(
    [row('Nordic Lower'), row('Pallof Press')], 'lower', BODYWEIGHT);
  ok('a slot the kit CAN train is still MISSING when absent',
    bwNoSquat.missing.includes('squat') && !bwNoSquat.unavailable.includes('squat'),
    `missing=${JSON.stringify(bwNoSquat.missing)} unavailable=${JSON.stringify(bwNoSquat.unavailable)}`);

  // AND A FULL-GYM ATHLETE IS UNCHANGED — the exemption is the kit's, not a
  // blanket amnesty. This is the cell that fails if the fix over-reaches.
  const gym = sessionSlotCoverage([row('Push-Ups')], 'upper_full', FULL_GYM);
  ok('a FULL-GYM athlete is excused NOTHING',
    gym.unavailable.length === 0 && gym.missing.includes('vertical_pull'),
    `missing=${JSON.stringify(gym.missing)} unavailable=${JSON.stringify(gym.unavailable)}`);

  // NO KIT SUPPLIED = OLD BEHAVIOUR, EXACTLY. Every existing caller passes two
  // arguments and must not shift underneath this change.
  const legacy = sessionSlotCoverage(noKitLowerDay, 'lower');
  ok('with no kit supplied the answer is unchanged from before',
    legacy.missing.includes('single_leg_hip') && legacy.unavailable.length === 0,
    `missing=${JSON.stringify(legacy.missing)}`);
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
