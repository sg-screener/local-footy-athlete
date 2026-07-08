(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  EXERCISE_TAGS,
  type MovementPattern,
  type Region,
} from '../data/exerciseTags';
import {
  BICEPS_POOL,
  TRICEPS_POOL,
  DELTS_POOL,
  UPPER_BACK_PUMP_POOL,
  GROIN_ADDUCTORS_POOL,
  CALVES_POOL,
  LOWER_PREHAB_POOL,
  TRUNK_ANTI_ROTATION_POOL,
  SHOULDER_HEALTH_POOL,
  HAMSTRING_LIGHT_POOL,
  type PoolExercise,
} from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import {
  estimateStartingWeight,
  resolveExerciseName,
} from '../utils/loadEstimation';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n    ${detail}` : ''));
    console.log(`  FAIL ${name}${detail ? `\n    ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const onboarding = {
  weightKg: 82,
  squatStrength: 'Around bodyweight',
  benchStrength: 'Around bodyweight',
} as any;

console.log('\n[exerciseBibleLibrary] Programming Bible exercise metadata');

const expectedTags: Array<{
  name: string;
  movement: MovementPattern;
  region: Region;
}> = [
  { name: 'Vertical Jump', movement: 'plyo', region: 'lower' },
  { name: 'Countermovement Jump', movement: 'plyo', region: 'lower' },
  { name: 'RFE Split Squat Jump', movement: 'plyo', region: 'lower' },
  { name: 'Explosive Push-Ups', movement: 'horizontal_push', region: 'upper' },
  { name: 'Banded TKE', movement: 'isolation_lower', region: 'lower' },
  { name: 'Slant Board Step-Down', movement: 'lunge', region: 'lower' },
  { name: 'Step-Down', movement: 'lunge', region: 'lower' },
  { name: 'Spanish Squat Hold', movement: 'isolation_lower', region: 'lower' },
  { name: 'Tempo Step-Up', movement: 'lunge', region: 'lower' },
  { name: 'Bottoms-Up KB Press', movement: 'vertical_push', region: 'upper' },
  { name: 'Bottoms-Up KB Carry', movement: 'carry', region: 'upper' },
  { name: 'Half-Kneeling Landmine Press', movement: 'vertical_push', region: 'upper' },
  { name: 'Scap Push-Up', movement: 'horizontal_push', region: 'upper' },
  { name: 'Banded External Rotation', movement: 'isolation_upper', region: 'upper' },
  { name: 'Bosch Hold', movement: 'isolation_lower', region: 'lower' },
  { name: 'Copenhagen Plank', movement: 'isolation_lower', region: 'lower' },
  { name: 'Short-Lever Copenhagen', movement: 'isolation_lower', region: 'lower' },
  { name: 'Long-Lever Copenhagen', movement: 'isolation_lower', region: 'lower' },
  { name: 'Groin Squeeze (Band Adductor)', movement: 'isolation_lower', region: 'lower' },
  { name: 'Single-Leg Calf Raise', movement: 'isolation_lower', region: 'lower' },
  { name: 'Seated Calf Raise', movement: 'isolation_lower', region: 'lower' },
  { name: 'Swiss Ball Hamstring Curl', movement: 'isolation_lower', region: 'lower' },
  { name: 'Bird Dog', movement: 'core', region: 'upper' },
  { name: 'Inverted Row (Bodyweight)', movement: 'horizontal_pull', region: 'upper' },
  { name: 'Chin-Up Negative (Slow)', movement: 'vertical_pull', region: 'upper' },
];

for (const expected of expectedTags) {
  const tags = EXERCISE_TAGS[expected.name];
  ok(`${expected.name} has tags`, Boolean(tags));
  eq(`${expected.name} movement`, tags?.movement, expected.movement);
  eq(`${expected.name} region`, tags?.region, expected.region);
}

console.log('\n[exerciseBibleLibrary] aliases resolve to canonical names');

const aliases: Array<[string, string]> = [
  ['TKE', 'Banded TKE'],
  ['terminal knee extension', 'Banded TKE'],
  ['slant board step down', 'Slant Board Step-Down'],
  ['bottoms up press', 'Bottoms-Up KB Press'],
  ['bottoms-up kettlebell press', 'Bottoms-Up KB Press'],
  ['half kneeling landmine press', 'Half-Kneeling Landmine Press'],
  ['explosive pushup', 'Explosive Push-Ups'],
  ['speed bench press', 'Speed Bench'],
  ['rear foot elevated split squat jump', 'RFE Split Squat Jump'],
  ['rfess jump', 'RFE Split Squat Jump'],
  ['Copenhagen', 'Copenhagen Plank'],
  ['short lever copenhagen', 'Short-Lever Copenhagen'],
  ['long lever copenhagen', 'Long-Lever Copenhagen'],
  ['mcgill curl up', 'McGill Sit Up'],
  ['cable chop', 'Woodchop (Standing)'],
  ['inverted rows', 'Inverted Row (Bodyweight)'],
];

for (const [input, expected] of aliases) {
  eq(`${input} resolves`, resolveExerciseName(input), expected);
}

console.log('\n[exerciseBibleLibrary] power stress and injury cautions');

for (const name of ['Vertical Jump', 'Countermovement Jump', 'Box Jumps', 'Broad Jumps', 'RFE Split Squat Jump']) {
  const tags = EXERCISE_TAGS[name];
  ok(`${name} is marked as power`, tags?.power === true);
  ok(
    `${name} carries lower-limb cautions`,
    tags?.injury.knee !== 'good' &&
      tags?.injury.calf !== 'good' &&
      tags?.injury.ankle !== 'good' &&
      tags?.injury.hamstring !== 'good',
  );
}

for (const name of ['Explosive Push-Ups', 'Speed Bench']) {
  const tags = EXERCISE_TAGS[name];
  ok(`${name} is marked as power`, tags?.power === true);
  ok(
    `${name} carries upper-limb cautions`,
    tags?.injury.shoulder !== 'good' &&
      tags?.injury.elbow !== 'good' &&
      tags?.injury.wrist !== 'good',
  );
}

ok(
  'Banded TKE is knee-cautioned S&C accessory work',
  EXERCISE_TAGS['Banded TKE']?.injury.knee === 'caution' &&
    EXERCISE_TAGS['Banded TKE']?.load === 'low',
);

ok(
  'Copenhagen variants are groin/pubalgia-cautioned',
  ['Copenhagen Plank', 'Short-Lever Copenhagen', 'Long-Lever Copenhagen'].every((name) => {
    const tags = EXERCISE_TAGS[name];
    return tags?.injury.adductor === 'caution' && tags?.injury.pubalgia === 'caution';
  }),
);

console.log('\n[exerciseBibleLibrary] load and no-load handling');

eq('TKE does not get fake load', estimateStartingWeight('TKE', onboarding), null);
eq('Copenhagen does not get fake load', estimateStartingWeight('Copenhagen', onboarding), null);
eq('Bosch Hold does not get fake load', estimateStartingWeight('Bosch Hold', onboarding), null);
ok(
  'Bottoms-up KB press gets a light kettlebell estimate',
  typeof estimateStartingWeight('bottoms up press', onboarding) === 'number',
);

console.log('\n[exerciseBibleLibrary] existing derived pools are tagged');

const derivedPools: PoolExercise[][] = [
  BICEPS_POOL,
  TRICEPS_POOL,
  DELTS_POOL,
  UPPER_BACK_PUMP_POOL,
  GROIN_ADDUCTORS_POOL,
  CALVES_POOL,
  LOWER_PREHAB_POOL,
  TRUNK_ANTI_ROTATION_POOL,
  SHOULDER_HEALTH_POOL,
  HAMSTRING_LIGHT_POOL,
];

for (const exercise of derivedPools.flat()) {
  const canonical = resolveExerciseName(exercise.name);
  ok(
    `${exercise.name} resolves to tagged metadata`,
    Boolean(EXERCISE_TAGS[exercise.name] || EXERCISE_TAGS[canonical]),
    `canonical=${canonical}`,
  );
}

console.log('\n[exerciseBibleLibrary] specialist additions do not alter strength rotation pools');

const rotationPoolNames = new Set(
  Object.values(STRENGTH_POOLS).flatMap((slot) => [
    ...slot.anchor.entries.map((entry) => entry.name),
    ...slot.accessory.entries.map((entry) => entry.name),
  ]),
);

for (const name of [
  'Vertical Jump',
  'Countermovement Jump',
  'RFE Split Squat Jump',
  'Banded TKE',
  'Bottoms-Up KB Press',
  'Bottoms-Up KB Carry',
  'Spanish Squat Hold',
  'Bosch Hold',
]) {
  ok(`${name} is not in deterministic strength rotation`, !rotationPoolNames.has(name));
}

console.log('\n[exerciseBibleLibrary] future/product-decision exercises remain out');

for (const name of ['Medicine Ball Chest Pass', 'Medicine Ball Slam']) {
  ok(`${name} not added yet`, !EXERCISE_TAGS[name]);
}

if (fail > 0) {
  console.error(`\nexerciseBibleLibraryTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nexerciseBibleLibraryTests passed: ${pass}`);
