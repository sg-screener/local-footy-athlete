(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { formatExerciseDisplayName } from '../utils/exerciseDisplay';

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

eq('handles null defensively', formatExerciseDisplayName(null), '');
eq('handles blank defensively', formatExerciseDisplayName('   '), '');

if (fail > 0) {
  console.error(`\nexerciseDisplayTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nexerciseDisplayTests passed: ${pass}`);
