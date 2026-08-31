(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { formatExerciseDisplayName } from '../utils/exerciseDisplay';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. Added when this suite was wired into test:bible — an unarmed suite
// in the chain exits 0 on a drained loop and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function eq(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       ${JSON.stringify({ expected, actual })}`);
  }
}

console.log('\n[exerciseDisplay] display-only exercise title formatting');

eq(
  'formats row with parenthetical',
  formatExerciseDisplayName('incline DB row (chest supported)'),
  'Incline DB Row (Chest Supported)',
);

eq(
  'formats normal words',
  formatExerciseDisplayName('bicep curls'),
  'Bicep Curls',
);

eq(
  'preserves acronyms inside and outside parentheses',
  formatExerciseDisplayName('single arm half kneeling OHP (DB)'),
  'Single Arm Half Kneeling OHP (DB)',
);

eq(
  'preserves duration units and Zone 2',
  formatExerciseDisplayName('45min zone 2 ski'),
  '45min Zone 2 Ski',
);

eq(
  'preserves common gym acronyms',
  formatExerciseDisplayName('bb rdl iso hold into EMOM'),
  'BB RDL ISO Hold Into EMOM',
);

eq(
  'preserves ATG in the canonical split-squat name',
  formatExerciseDisplayName('ATG Split Squat'),
  'ATG Split Squat',
);

eq('handles null defensively', formatExerciseDisplayName(null), '');
eq('handles blank defensively', formatExerciseDisplayName('   '), '');

const shorterDisplayNames = [
  ['Single-Leg Squat (to Box)', 'Single-Leg Box Squat'],
  ['Single-Arm DB Bench Press', '1-Arm DB Bench Press'],
  ['Single-Arm DB Floor Press', '1-Arm DB Floor Press'],
  ['Half-Kneeling Single-Arm Overhead Press', 'Half-Kneeling 1-Arm Press'],
  ['Inverted Row (Bodyweight)', 'Inverted Row'],
  ['Single-Arm Lat Pulldown', '1-Arm Lat Pulldown'],
  ['Banded Tricep Pushdown', 'Band Tricep Pushdown'],
  ['Chin-Up Negative (Slow)', 'Slow Chin-Up Negative'],
  ['Bicep Curl (Barbell)', 'Barbell Bicep Curl'],
  ['Bicep Curl (Dumbbell)', 'Dumbbell Bicep Curl'],
  ['Copenhagen Plank (Half)', 'Half Copenhagen'],
  ['Woodchop (Half Kneeling)', 'Half-Kneeling Woodchop'],
  ['Banded External Rotation', 'Band External Rotation'],
  ['Swiss Ball Hamstring Curl', 'Swiss Ball Ham Curl'],
  ['Foam Roll — Hip Flexor, Quad, Adductors', 'Foam Roll: Thighs'],
  ['Foam Roll — Calves & Outer Shins', 'Foam Roll: Calves & Shins'],
  ['Lacrosse Ball Glute Release', 'Glute Ball Release'],
  ['Open Book Thoracic Rotation', 'Open Book Rotation'],
  ['Chest / Pec Stretch (Doorway)', 'Doorway Pec Stretch'],
  ['Pissing Dog Against Wall', 'Wall Hip Opener'],
  ['Light Walk or Stationary Bike', 'Light Walk / Bike'],
  ["Child's Pose with Breathing", "Child's Pose + Breathing"],
] as const;

for (const [canonicalName, displayName] of shorterDisplayNames) {
  eq(
    `uses shorter display name for ${canonicalName}`,
    formatExerciseDisplayName(canonicalName),
    displayName,
  );
}

if (fail > 0) {
  console.error(`\nexerciseDisplayTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nexerciseDisplayTests passed: ${pass}`);
totalsPrinted(fail);
