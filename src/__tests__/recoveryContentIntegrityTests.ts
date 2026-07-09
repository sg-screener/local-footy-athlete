(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { EXERCISE_CUES } from '../data/exerciseCues';
import {
  CALVES_POOL,
  GROIN_ADDUCTORS_POOL,
  LOWER_PREHAB_POOL,
  TRUNK_ANTI_ROTATION_POOL,
  type PoolExercise,
} from '../data/exercisePools';
import { classifyPoolSlot, STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_TAGS, type InjuryProfile } from '../data/exerciseTags';
import { ACCESSORY_REP_GUIDELINES } from '../rules/phaseRepSchemes';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import { EXERCISE_DEMO_VIDEOS, lookupExerciseDemo } from '../services/exerciseVideoService';
import type { Workout } from '../types/domain';
import { resolveExerciseName } from '../utils/loadEstimation';

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

function section(label: string) {
  console.log(`\n${label}`);
}

const INJURY_KEYS: Array<keyof InjuryProfile> = [
  'adductor',
  'pubalgia',
  'lowerBack',
  'knee',
  'hamstring',
  'calf',
  'ankle',
  'shoulder',
  'elbow',
  'wrist',
];

const REQUESTED_CONTENT: Array<{ label: string; canonical: string }> = [
  { label: 'Farmer Carry', canonical: 'Farmer Carry' },
  { label: 'Suitcase Carry', canonical: 'Suitcase Carry' },
  { label: 'Bear Carry', canonical: 'Bear Carry' },
  { label: 'Nordic Curl', canonical: 'Nordic Lower' },
  { label: 'Nordic Lower', canonical: 'Nordic Lower' },
  { label: 'Short-lever Copenhagen', canonical: 'Short-Lever Copenhagen' },
  { label: 'Long-lever Copenhagen', canonical: 'Long-Lever Copenhagen' },
  { label: 'Groin squeeze', canonical: 'Groin Squeeze (Band Adductor)' },
  { label: 'Side Plank', canonical: 'Side Plank' },
  { label: 'Bird Dog', canonical: 'Bird Dog' },
  { label: 'McGill Curl-Up', canonical: 'McGill Sit Up' },
  { label: 'Tibialis Raise', canonical: 'Tibialis Raise' },
  { label: 'Standing Calf Raise', canonical: 'Calf Raises' },
  { label: 'Seated Calf Raise', canonical: 'Seated Calf Raise' },
  { label: 'Single-Leg Calf Raise', canonical: 'Single-Leg Calf Raise' },
  { label: 'Pallof Press', canonical: 'Band Pallof Press' },
  { label: 'Cable Chop', canonical: 'Woodchop (Standing)' },
  { label: 'Cable Lift', canonical: 'Woodchop (Half Kneeling)' },
  { label: 'Face Pull', canonical: 'Face Pull' },
  { label: 'External Rotation', canonical: 'Banded External Rotation' },
  { label: 'Scap Push-Up', canonical: 'Scap Push-Up' },
  { label: 'Bottoms-Up KB Carry', canonical: 'Bottoms-Up KB Carry' },
  { label: 'Bottoms-Up KB Press', canonical: 'Bottoms-Up KB Press' },
];

function uniqueCanonicalNames(): string[] {
  return Array.from(new Set(REQUESTED_CONTENT.map((item) => item.canonical)));
}

function completeInjuryProfile(profile: InjuryProfile | undefined): boolean {
  return !!profile && INJURY_KEYS.every((key) => profile[key] === 'good' || profile[key] === 'caution' || profile[key] === 'avoid');
}

const poolByName = new Map<string, PoolExercise>();
for (const exercise of [
  ...GROIN_ADDUCTORS_POOL,
  ...CALVES_POOL,
  ...LOWER_PREHAB_POOL,
  ...TRUNK_ANTI_ROTATION_POOL,
]) {
  poolByName.set(exercise.name, exercise);
}

section('[1] requested recovery/prehab content has canonical metadata');
for (const name of uniqueCanonicalNames()) {
  const tags = EXERCISE_TAGS[name];
  ok(`${name} has exercise tags`, Boolean(tags));
  ok(`${name} has complete injury profile`, completeInjuryProfile(tags?.injury));
  ok(`${name} has direct cues`, Boolean(EXERCISE_CUES[name]));
  ok(`${name} has video mapping or explicit null`, Object.prototype.hasOwnProperty.call(EXERCISE_DEMO_VIDEOS, name));
  ok(`${name} is not hard conditioning`, tags?.movement !== 'conditioning');
}

section('[2] requested labels resolve to canonical records');
for (const item of REQUESTED_CONTENT) {
  eq(`${item.label} video alias`, lookupExerciseDemo(item.label).canonicalName, item.canonical);
  eq(`${item.label} load alias`, resolveExerciseName(item.label), item.canonical);
}

section('[3] injury profile rules match recovery add-on content');
for (const name of ['Short-Lever Copenhagen', 'Long-Lever Copenhagen', 'Groin Squeeze (Band Adductor)']) {
  const injury = EXERCISE_TAGS[name]?.injury;
  ok(`${name} respects groin/adductor`, injury?.adductor === 'caution' && injury?.pubalgia === 'caution');
}

ok('Nordic Lower avoids active hamstring issues', EXERCISE_TAGS['Nordic Lower']?.injury.hamstring === 'avoid');

for (const name of ['Farmer Carry', 'Suitcase Carry', 'Bear Carry', 'Bottoms-Up KB Carry']) {
  const injury = EXERCISE_TAGS[name]?.injury;
  ok(
    `${name} respects loaded-carry issues`,
    injury?.lowerBack === 'caution' &&
      injury?.shoulder === 'caution' &&
      injury?.elbow === 'caution' &&
      injury?.wrist === 'caution',
  );
}

for (const name of ['Calf Raises', 'Single-Leg Calf Raise', 'Seated Calf Raise', 'Tib Raise', 'Tibialis Raise']) {
  const injury = EXERCISE_TAGS[name]?.injury;
  ok(`${name} respects calf/Achilles`, injury?.calf === 'caution' && injury?.ankle === 'caution');
}

for (const name of ['Face Pull', 'Cable Face Pull', 'Banded External Rotation', 'Scap Push-Up', 'Bottoms-Up KB Press']) {
  ok(`${name} respects shoulder pain`, EXERCISE_TAGS[name]?.injury.shoulder === 'caution');
}

section('[4] prescriptions stay low-fatigue accessory style');
const nordics = ACCESSORY_REP_GUIDELINES.nordics;
ok('Nordic prescription is 2-3 x 3-5', nordics.setsMin === 2 && nordics.setsMax === 3 && nordics.min === 3 && nordics.max === 5);

const carries = ACCESSORY_REP_GUIDELINES.carries;
ok(
  'carry guideline supports 2-4 x 20-60m or time note',
  carries.setsMin === 2 &&
    carries.setsMax === 4 &&
    carries.min === 20 &&
    carries.max === 60 &&
    carries.unit === 'metres' &&
    /30-60 seconds/i.test(carries.note),
);

const suitcase = poolByName.get('Suitcase Carry');
ok('Suitcase Carry has distance prescription', suitcase?.prescriptionType === 'distance' && suitcase.repsMin >= 20 && suitcase.repsMax <= 60);

const sidePlank = poolByName.get('Side Plank');
ok('Side Plank is controlled hold work', sidePlank?.prescriptionType === 'duration' && sidePlank.sets >= 2 && sidePlank.sets <= 3 && sidePlank.repsMin >= 30 && sidePlank.repsMax <= 60);

for (const name of ['McGill Sit Up', 'Bird Dog']) {
  const exercise = poolByName.get(name);
  ok(`${name} is controlled corrective core`, exercise?.prescriptionType === 'reps' && exercise.sets <= 3 && exercise.repsMax <= 10);
}

for (const name of ['Single-Leg Calf Raise', 'Seated Calf Raise', 'Tibialis Raise']) {
  const exercise = poolByName.get(name);
  ok(`${name} stays 2-3 x 8-20 style`, exercise?.sets >= 2 && exercise.sets <= 3 && exercise.repsMin >= 8 && exercise.repsMax <= 20);
}

section('[5] content stays out of main-strength and hard-exposure counts');
const mainStrengthSlots = new Set(['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']);
for (const name of uniqueCanonicalNames()) {
  const slot = classifyPoolSlot(name);
  const isMainStrengthAnchor = !!slot && mainStrengthSlots.has(slot.slot) && slot.role === 'anchor';
  ok(`${name} is not a main-strength anchor`, !isMainStrengthAnchor);
}

const carryAnchorNames = STRENGTH_POOLS.carry.anchor.entries.map((entry) => entry.name);
ok('Bear Carry is available in the carry pool', carryAnchorNames.includes('Bear Carry'));
ok('Bear Carry load ratio is moderate relative to Farmer Carry', STRENGTH_POOLS.carry.anchor.entries.some((entry) => entry.name === 'Bear Carry' && entry.loadRatio > 0 && entry.loadRatio < 1));

function workoutExercise(name: string, order: number): any {
  return {
    id: `we-${order}`,
    workoutId: 'recovery-content',
    exerciseId: `ex-${order}`,
    exerciseOrder: order,
    prescribedSets: 2,
    prescribedRepsMin: 8,
    prescribedRepsMax: 12,
    prescribedWeightKg: 0,
    restSeconds: 45,
    exercise: {
      id: `ex-${order}`,
      name,
      description: name,
      exerciseType: 'Accessory',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Beginner',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

const prehabWorkout: Workout = {
  id: 'recovery-content',
  microcycleId: 'mc-ra',
  dayOfWeek: 1,
  name: 'Prehab & Accessories',
  description: 'Recovery add-on content fixture',
  durationMinutes: 30,
  intensity: 'Light' as any,
  workoutType: 'Strength' as any,
  sessionTier: 'optional' as any,
  exercises: uniqueCanonicalNames().map((name, idx) => workoutExercise(name, idx + 1)),
  createdAt: '',
  updatedAt: '',
} as Workout;

const counts = countWeeklyExposures([{ date: '2026-07-09', workout: prehabWorkout }]);
eq('recovery/prehab content creates zero hard exposures', counts.hardExposures, 0);
eq('recovery/prehab content creates zero main strength exposures', counts.mainStrengthExposures, 0);

if (fail > 0) {
  console.error(`\nrecoveryContentIntegrityTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nrecoveryContentIntegrityTests passed: ${pass}`);
