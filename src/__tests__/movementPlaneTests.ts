/** R-327 — typed movement-plane metadata, selector ordering and weekly holes. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  EXERCISE_MOVEMENT_PLANES,
  movementPlaneMetadataFor,
  type MovementPlane,
} from '../data/exerciseMovementPlaneMetadata';
import { decideExerciseForBlock } from '../rules/blockExerciseSelection';
import { createAutomaticWeeklyExerciseSelector } from '../rules/automaticWeeklyExerciseSelection';
import {
  auditMovementPlaneCoverage,
  preferredMovementPlaneCohort,
} from '../rules/movementPlaneProgramming';
import { athleticPlaneExposureForPowerExercise } from '../rules/powerExercisePool';
import { readSheetRecords } from './support/xlsxReader';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

const expected = new Map<string, { primaryPlane: MovementPlane; secondaryPlanes: readonly MovementPlane[] }>();
function add(
  names: readonly string[],
  primaryPlane: MovementPlane,
  secondaryPlanes: readonly MovementPlane[] = [],
): void {
  for (const exercise of names) {
    assert(!expected.has(exercise), `duplicate expected classification: ${exercise}`);
    expected.set(exercise, { primaryPlane, secondaryPlanes });
  }
}

add(['Back Squat', 'Front Squat', 'Box Squat', 'High Box Squat', 'Single-Leg Leg Press',
  'Goblet Squat', 'Leg Press', 'Bodyweight Squat'], 'sagittal');
add(['Walking Lunges', 'Bulgarian Split Squats', 'Reverse Lunges', 'Step Ups'],
  'sagittal', ['frontal']);
add(['Single-Leg Squat (to Box)'], 'sagittal', ['frontal', 'transverse']);
add(['Deadlift', 'Trap Bar Deadlift', 'RDLs', 'Hip Thrusts', 'Kettlebell Swings',
  'Glute Bridge'], 'sagittal');
add(['Single-Leg RDL'], 'sagittal', ['frontal', 'transverse']);
add(['Bench Press', 'DB Bench Press', 'Single-Arm DB Bench Press',
  'Single-Arm DB Floor Press'], 'transverse');
add(['Incline Bench', 'Close Grip Bench', 'Incline DB Bench', 'Push-ups', 'Incline Push-Up'],
  'transverse', ['sagittal']);
add(['Dips'], 'sagittal');
add(['Overhead Press', 'DB Shoulder Press', 'Seated DB Press', 'Z-Press'],
  'frontal', ['sagittal']);
add(['Landmine Press'], 'sagittal', ['frontal']);
add(['Half-Kneeling Single-Arm Overhead Press'], 'frontal', ['transverse']);
add(['Barbell Row', 'Chest Supported Row', 'Single-Arm DB Row', 'Seated Cable Row',
  'Chest-Supported DB Row', 'Inverted Row (Bodyweight)'], 'transverse', ['sagittal']);
add(['Pull-Ups', 'Band-Assisted Pull-Up', 'Lat Pulldown'], 'frontal', ['sagittal']);
add(['Chin-Ups', 'Neutral-Grip Pulldown', 'Single-Arm Lat Pulldown'],
  'sagittal', ['frontal']);
add(['Chin-Up Negative (Slow)'], 'sagittal', ['frontal']);
add(['Cossack Squat', 'Lateral Lunge'], 'frontal', ['sagittal']);
add(['Skull Crushers', 'Bicep Curl (Barbell)', 'Bicep Curl (Dumbbell)', 'Hammer Curl',
  'Incline Dumbbell Curl', 'Lying Dumbbell Curl', 'Banded Bicep Curl',
  'Concentration Curl', 'Tricep Pushdown', 'Banded Tricep Pushdown',
  'Overhead Tricep Extension', 'Dumbbell Skull Crusher', 'Dumbbell Kickback',
  'Tricep Circuit (Dirty 30)'], 'sagittal');
add(['Shrugs', 'Lateral Raise', 'Single-Arm Shrug'], 'frontal');
add(['Incline Y Raise'], 'frontal', ['sagittal']);
add(['Rear Delt Fly', 'Band Pull-Apart'], 'transverse');
add(['Face Pull', 'Cable Face Pull'], 'transverse', ['frontal']);
add(['Banded 90/90 External Rotation'], 'transverse');
add(['Nordic Lower', 'Hamstring Curl', 'Leg Extension', 'Calf Raises', 'Tib Raises',
  'Back Extension', 'Seated Calf Raise'], 'sagittal');
add(['SL 45° Back Extension', 'Single-Leg Hip Thrust'],
  'sagittal', ['frontal', 'transverse']);
add(['Single-Leg Calf Raise'], 'sagittal', ['frontal']);
add(['Groin Squeeze'], 'frontal');
add(['Copenhagen Plank (Half)', 'Long-Lever Copenhagen'], 'frontal', ['transverse']);
add(['Box Jumps', 'Broad Jumps', 'Jump Squats'], 'sagittal');
add(['Depth Jumps', 'RFE Split Squat Jump'], 'sagittal', ['frontal', 'transverse']);
add(['Lateral Bounds'], 'frontal', ['transverse']);
add(['Farmer Carry', 'Overhead Carry'], 'sagittal', ['frontal', 'transverse']);
add(['Bear Carry'], 'sagittal', ['transverse']);
add(['Suitcase Carry'], 'sagittal', ['frontal']);
add(['Reverse Nordic Curl', 'Standing Knee Extension', 'Seated Single-Leg Pike Lift',
  'Banded TKE', 'Spanish Squat Hold', 'Swiss Ball Hamstring Curl'], 'sagittal');
add(['Bosch Hold', 'SL 45° Back Extension Hold'], 'sagittal', ['frontal', 'transverse']);
add(['Slant Board Step-Down'], 'sagittal', ['frontal']);
add(['Crab Walks'], 'frontal', ['transverse']);
add(['Dead Bug', 'Banded Dead Bug', 'Weighted Dead Bug', 'McGill Sit Up', 'Ab Wheel',
  'Hanging Leg Raise', 'Plank', 'Hollow Hold', 'Dragon Flag'], 'sagittal');
add(['Bird Dog'], 'sagittal', ['transverse']);
add(['Side Plank', 'Side Plank Row'], 'frontal', ['transverse']);
add(['Band Pallof Press'], 'transverse');
add(['Woodchop (Standing)', 'Woodchop (Half Kneeling)'], 'transverse', ['sagittal']);
add(['Stir the Pot'], 'multiplanar');
add(['Explosive Landmine Press'], 'sagittal', ['transverse']);
add(['Medicine-Ball Slam', 'Pogo Hops', 'Vertical Jump', 'Kneeling Jump'], 'sagittal');
add(['Explosive Push-up'], 'transverse', ['sagittal']);
add(['Rotational Medicine-Ball Throw', 'Rotational Medicine-Ball Slam'],
  'transverse', ['sagittal']);
add(['Lateral Jump'], 'frontal', ['transverse']);
add(['Single-Leg Hop and Stick'], 'sagittal', ['frontal', 'transverse']);
add(['Scap Pull Ups'], 'frontal', ['sagittal']);

const auditedAutomaticMeaningfulIdentities = [
  'Explosive Landmine Press',
  'Medicine-Ball Slam',
  'Explosive Push-up',
  'Pogo Hops',
  'Vertical Jump',
  'Rotational Medicine-Ball Throw',
  'Rotational Medicine-Ball Slam',
  'Lateral Jump',
  'Single-Leg Hop and Stick',
  'Scap Pull Ups',
  'Kneeling Jump',
] as const;

run('the canonical metadata is exactly Sam\'s named classification set', () => {
  assert.equal(EXERCISE_MOVEMENT_PLANES.length, expected.size);
  assert.deepEqual(new Set(EXERCISE_MOVEMENT_PLANES.map((row) => row.exercise)),
    new Set(expected.keys()));
  for (const [exercise, value] of expected) {
    assert.deepEqual(movementPlaneMetadataFor(exercise), { exercise, ...value }, exercise);
  }
});

run('primary and secondary planes are valid, unique and non-conflicting', () => {
  for (const row of EXERCISE_MOVEMENT_PLANES) {
    assert(!row.secondaryPlanes.includes(row.primaryPlane), row.exercise);
    assert.equal(new Set(row.secondaryPlanes).size, row.secondaryPlanes.length, row.exercise);
    if (row.primaryPlane === 'multiplanar' || row.primaryPlane === 'not_applicable') {
      assert.equal(row.secondaryPlanes.length, 0, row.exercise);
    }
  }
});

run('the 11 automatically programmed meaningful audit identities have zero metadata gaps', () => {
  const missing = auditedAutomaticMeaningfulIdentities
    .filter((identity) => !movementPlaneMetadataFor(identity));
  assert.deepEqual(missing, []);
});

run('Exercise Master and typed metadata agree in both directions', () => {
  const workbook = path.resolve(__dirname, '../../docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx');
  const rows = readSheetRecords(workbook, 'Exercise Master', 6);
  const sheetTagged = new Set<string>();
  for (const row of rows) {
    const primary = row['Primary Plane'].trim();
    const secondary = row['Secondary Plane(s)'].split(',').map((part) => part.trim()).filter(Boolean);
    const typed = movementPlaneMetadataFor(row.Exercise);
    if (!primary) {
      assert.equal(typed, undefined, `${row.Exercise} is typed but blank in the workbook`);
      assert.equal(secondary.length, 0, `${row.Exercise} has secondary planes without a primary`);
      continue;
    }
    sheetTagged.add(row.Exercise);
    assert(typed, `${row.Exercise} is in the workbook but absent from typed metadata`);
    assert.equal(typed.primaryPlane, primary, row.Exercise);
    assert.deepEqual(typed.secondaryPlanes, secondary, row.Exercise);
  }
  assert.deepEqual(sheetTagged, new Set(EXERCISE_MOVEMENT_PLANES.map((row) => row.exercise)));

  const unanswered = rows.map((row) => row.Exercise)
    .filter((exercise) => !movementPlaneMetadataFor(exercise));
  const questionText = fs.readFileSync(path.resolve(
    __dirname, '../../docs/MOVEMENT_PLANE_QUESTIONS_2026-09-02.md',
  ), 'utf8').split('## NOT COVERED')[0];
  const recordedQuestions = questionText.split('\n')
    .filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
  assert.equal(recordedQuestions.length, unanswered.length);
  assert.deepEqual(new Set(recordedQuestions), new Set(unanswered));
});

run('the weekly selector exposes frontal as a tie-break until meaningful lower work fills it', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  assert.deepEqual(selector.movementPlaneContextFor('lower_accessory')
    .missingUsefulPlanes, ['frontal', 'transverse']);
  selector.accept({ identity: 'Crab Walks', requestedSlot: 'football_robustness',
    dayKind: 'lower_squat', route: 'prehab', requestedAsMain: false });
  assert.deepEqual(selector.movementPlaneContextFor('lower_accessory')
    .missingUsefulPlanes, []);
});

run('same-primary-plane replacement wins only inside the legal equal cohort', () => {
  assert.deepEqual(preferredMovementPlaneCohort(
    ['Dips', 'Incline Bench'], { referenceIdentity: 'Bench Press' },
  ), ['Incline Bench']);
  const selected = decideExerciseForBlock({
    phase: 'Off-season', blockNumber: 1, slot: 'horizontal_push', group: null,
    role: 'accessory', legalCandidates: ['Dips', 'Incline Bench'],
    previousSelection: null, currentBlockSelection: null, recentSelections: [],
    progressedIdentities: [], pinnedIdentities: [],
    movementPlaneContext: { referenceIdentity: 'Bench Press' },
  });
  assert.equal(selected.identity, 'Incline Bench');
});

run('an accepted current-block choice is restored before plane tie-breaking', () => {
  const selected = decideExerciseForBlock({
    phase: 'Off-season', blockNumber: 2, slot: 'horizontal_push', group: null,
    role: 'accessory', legalCandidates: ['Dips', 'Incline Bench'],
    previousSelection: null,
    currentBlockSelection: { blockNumber: 2, blockStartISO: '2026-09-07',
      slot: 'horizontal_push', seatIndex: 0, group: null, role: 'accessory', identity: 'Dips' },
    recentSelections: [], progressedIdentities: [], pinnedIdentities: [],
    movementPlaneContext: { referenceIdentity: 'Bench Press' },
  });
  assert.equal(selected.identity, 'Dips');
});

run('lower frontal coverage counts meaningful lower work, not upper or mobility rows', () => {
  const missing = auditMovementPlaneCoverage({
    exerciseRows: [
      { identity: 'Lateral Raise', contribution: 'strength' },
      { identity: 'Horse Stance Hold', contribution: 'mobility' },
    ], athleticExposures: [], daysSinceLastTrunkTransverse: 15,
  });
  assert(missing.findings.some((finding) => finding.kind === 'missing_lower_body_frontal'));
  const filled = auditMovementPlaneCoverage({
    exerciseRows: [{ identity: 'Cossack Squat', contribution: 'strength' }],
    athleticExposures: [], daysSinceLastTrunkTransverse: 15,
  });
  assert(!filled.findings.some((finding) => finding.kind === 'missing_lower_body_frontal'));
});

run('gym transverse or multiplanar work is required separately from Team Training', () => {
  const teamOnly = auditMovementPlaneCoverage({
    exerciseRows: [{ identity: 'Back Squat', contribution: 'strength' }],
    athleticExposures: ['team_training'], daysSinceLastTrunkTransverse: 4,
  });
  assert(teamOnly.athleticTransversePresent);
  assert(!teamOnly.gymTransverseOrMultiplanarPresent);
  assert(teamOnly.findings.some((finding) =>
    finding.kind === 'missing_gym_transverse_or_multiplanar'));

  const secondaryCounts = auditMovementPlaneCoverage({
    exerciseRows: [{ identity: 'Single-Leg RDL', contribution: 'strength' }],
    athleticExposures: ['team_training'], daysSinceLastTrunkTransverse: 4,
  });
  assert(secondaryCounts.gymTransverseOrMultiplanarPresent);
  assert(!secondaryCounts.findings.some((finding) =>
    finding.kind === 'missing_gym_transverse_or_multiplanar'));

  const mobilityDoesNotCount = auditMovementPlaneCoverage({
    exerciseRows: [{ identity: 'Banded 90/90 External Rotation', contribution: 'mobility' }],
    athleticExposures: ['team_training'], daysSinceLastTrunkTransverse: 4,
  });
  assert(!mobilityDoesNotCount.gymTransverseOrMultiplanarPresent);
});

run('athletic transverse coverage uses typed exposure, never conditioning names', () => {
  const straight = auditMovementPlaneCoverage({ exerciseRows: [],
    athleticExposures: ['straight_line_acceleration'], daysSinceLastTrunkTransverse: 4 });
  assert(straight.findings.some((finding) => finding.kind === 'missing_athletic_transverse'));
  for (const exposure of ['team_training', 'cod_decel', 'rotational_med_ball'] as const) {
    const result = auditMovementPlaneCoverage({ exerciseRows: [],
      athleticExposures: [exposure], daysSinceLastTrunkTransverse: 4 });
    assert(!result.findings.some((finding) => finding.kind === 'missing_athletic_transverse'), exposure);
  }
  assert.equal(athleticPlaneExposureForPowerExercise('Rotational Medicine-Ball Slam'),
    'rotational_med_ball');
  assert.equal(athleticPlaneExposureForPowerExercise('Medicine-Ball Slam'), undefined);
});

run('trunk transverse is a soft 7–14 day finding and named trunk work clears it', () => {
  assert(!auditMovementPlaneCoverage({ exerciseRows: [], athleticExposures: [],
    daysSinceLastTrunkTransverse: 6 }).findings.some((row) => row.kind === 'trunk_transverse_due'));
  assert(auditMovementPlaneCoverage({ exerciseRows: [], athleticExposures: [],
    daysSinceLastTrunkTransverse: 14 }).findings.some((row) => row.kind === 'trunk_transverse_due'));
  assert(!auditMovementPlaneCoverage({
    exerciseRows: [{ identity: 'Side Plank Row', contribution: 'trunk' }],
    athleticExposures: [], daysSinceLastTrunkTransverse: 14,
  }).findings.some((row) => row.kind === 'trunk_transverse_due'));
});

console.log(`\nMovement planes: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length) process.exit(1);
