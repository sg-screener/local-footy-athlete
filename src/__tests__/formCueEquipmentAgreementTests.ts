/**
 * FORM CUES AND THE EXERCISE SETUP MUST AGREE.
 *
 * Regression for the 2026-08-26 rebuild report: Crab Walks had an authored cue
 * but no Form cues control. The renderer was correctly suppressing mismatched
 * equipment; the canonical requirement, pool, cue and selected-implement owner
 * disagreed. This focused suite guards the whole class without depending on the
 * broader visible-surface suite's unrelated pre-existing failures.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { POOL_REGISTRY, type EquipmentTag } from '../data/exercisePools';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { equipmentRequiredFor } from '../data/exerciseEquipmentRequirement';
import { CUE_REQUIRED_APPARATUS } from '../data/cueImplement';
import { resolveSelectedImplement } from '../rules/selectedImplement';
import { cueForImplement } from '../screens/home/dayWorkoutHelpers';
import { equipmentClassFor } from '../utils/loadEstimation';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const FULL_KIT: EquipmentTag[] = [
  'bodyweight', 'dumbbells', 'barbell', 'cables', 'machine', 'bands', 'bench',
  'pullup_bar', 'kettlebell', 'plyo_box', 'rack', 'trap_bar', 'rings_trx',
  'dip_bars', 'swiss_ball', 'ab_wheel', 'back_extension_bench', 'sandbag',
  'foam_roller', 'bike_or_treadmill',
];

console.log('\nFORM CUE / EQUIPMENT AGREEMENT');

const setupAgreementCases: ReadonlyArray<{
  name: string;
  expectedImplement: EquipmentTag;
}> = [
  { name: 'Crab Walks', expectedImplement: 'bands' },
  { name: 'Side Plank Row', expectedImplement: 'bands' },
  { name: 'Inverted Row (Bodyweight)', expectedImplement: 'rings_trx' },
  { name: 'Speed Trap Bar Deadlift', expectedImplement: 'trap_bar' },
];

for (const example of setupAgreementCases) {
  const selected = resolveSelectedImplement({
    exerciseName: example.name,
    availableTags: FULL_KIT,
  });
  const cue = cueForImplement(example.name, selected.implement, FULL_KIT);
  check(`${example.name} resolves the setup its authored cue uses`,
    selected.implement === example.expectedImplement && cue.text !== null,
    `selected=${String(selected.implement)} cue=${String(cue.text)}`);
}

check('Crab Walks and Side Plank Row share the canonical band answer',
  JSON.stringify(equipmentRequiredFor('Crab Walks')) === '["bands"]'
    && JSON.stringify(equipmentRequiredFor('Side Plank Row')) === '["bands"]',
  `${JSON.stringify(equipmentRequiredFor('Crab Walks'))} / ${JSON.stringify(equipmentRequiredFor('Side Plank Row'))}`);

const NO_BENCH = FULL_KIT.filter((tag) => tag !== 'bench');
const benchCueNames = [
  'Copenhagen Plank (Half)',
  'RFE Split Squat Jump',
  'Single-Leg Hip Thrust',
] as const;

for (const name of benchCueNames) {
  const selected = resolveSelectedImplement({ exerciseName: name, availableTags: FULL_KIT });
  check(`${name} remains a bodyweight movement`,
    selected.implement === 'bodyweight', String(selected.implement));
  check(`${name} shows its authored cue when a bench is present`,
    cueForImplement(name, selected.implement, FULL_KIT).text !== null);
  const withoutBench = cueForImplement(name, selected.implement, NO_BENCH);
  check(`${name} withholds bench-specific wording when no bench is present`,
    withoutBench.text === null && withoutBench.missingCueForImplement === true);
}

check('Pigeon Stretch keeps its cue with improvised household support',
  cueForImplement('Pigeon Stretch','bodyweight',['bodyweight']).text !== null);

check('bench dependencies are typed rather than inferred from cue prose',
  benchCueNames.every((name) => CUE_REQUIRED_APPARATUS[name]?.includes('bench')),
  JSON.stringify(CUE_REQUIRED_APPARATUS));

const fullKitCueOmissions = Object.keys(EXERCISE_CUES).filter((name) => {
  const selected = resolveSelectedImplement({ exerciseName: name, availableTags: FULL_KIT });
  return cueForImplement(name, selected.implement, FULL_KIT).text === null;
}).sort();

check('full-kit census leaves no curated Form cue missing',
  JSON.stringify(fullKitCueOmissions) === '[]',
  JSON.stringify(fullKitCueOmissions));

check('the safety guard still withholds the barbell RDL cue on dumbbells',
  cueForImplement('RDLs', 'dumbbells', FULL_KIT).text === null);
const skullCrushers = resolveSelectedImplement({
  exerciseName: 'Skull Crushers',
  availableTags: FULL_KIT,
});
const dumbbellSkullCrusher = resolveSelectedImplement({
  exerciseName: 'Dumbbell Skull Crusher',
  availableTags: FULL_KIT,
});
check('Skull Crushers is the bar/EZ-bar variation and keeps that name',
  skullCrushers.implement === 'barbell'
    && cueForImplement('Skull Crushers', skullCrushers.implement, FULL_KIT).text !== null,
  String(skullCrushers.implement));
const skullCrushersPoolRow = POOL_REGISTRY.triceps.find((row) => row.name === 'Skull Crushers');
check('Skull Crushers has one barbell answer across requirement, pool and load',
  JSON.stringify(equipmentRequiredFor('Skull Crushers')) === '["barbell"]'
    && JSON.stringify(skullCrushersPoolRow?.equipment) === '["barbell"]'
    && equipmentClassFor('Skull Crushers') === 'barbell',
  `${JSON.stringify(equipmentRequiredFor('Skull Crushers'))} / `
    + `${JSON.stringify(skullCrushersPoolRow?.equipment)} / ${String(equipmentClassFor('Skull Crushers'))}`);
check('Dumbbell Skull Crusher remains the separate dumbbell variation',
  dumbbellSkullCrusher.implement === 'dumbbells'
    && cueForImplement('Dumbbell Skull Crusher', dumbbellSkullCrusher.implement, FULL_KIT).text !== null,
  String(dumbbellSkullCrusher.implement));

console.log(`\nForm cue equipment totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) process.exitCode = 1;
