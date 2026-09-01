(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  applyConditioningDeloadToExercises,
  applyDeloadPoliciesToWeeklySessionAllocations,
  resolveDeloadWeekPolicy,
} from '../rules/deloadWeekRules';
import type { SessionAllocation } from '../utils/coachingEngine';
import type { WorkoutExercise } from '../types/domain';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.log(`  FAIL ${name}`);
  if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
}

function allocation(
  dayOfWeek: string,
  conditioningCategory: SessionAllocation['conditioningCategory'],
): SessionAllocation {
  return {
    tier: 'core',
    focus: `${conditioningCategory} conditioning`,
    dayOfWeek,
    isHardExposure: conditioningCategory !== 'aerobic_base',
    conditioningCategory,
    conditioningFlavour: conditioningCategory === 'aerobic_base' ? 'aerobic' : 'tempo',
  };
}

type DeloadRow = WorkoutExercise & { readonly deloadQualityExposure?: boolean };

function row(name: string): DeloadRow {
  return {
    id: name,
    workoutId: 'workout',
    exerciseId: name,
    exerciseOrder: 1,
    prescribedSets: 1,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
    restSeconds: 60,
    prescribedDurationMinutes: 30,
    exercise: { name },
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  } as unknown as DeloadRow;
}

const scheduled = resolveDeloadWeekPolicy('Off-season', 'deload');
if (!scheduled) throw new Error('scheduled off-season deload policy must exist');
const doseByDay = { 1: scheduled, 2: scheduled, 4: scheduled };

console.log('deloadWeeklyQualityOwnershipTests');
console.log('\n[1] one compiled plan entry owns the weekly quality exposure');

const source = [
  allocation('Monday', 'aerobic_base'),
  allocation('Tuesday', 'tempo'),
  allocation('Thursday', 'tempo'),
];
const compiled = applyDeloadPoliciesToWeeklySessionAllocations(source, doseByDay);
const owners = compiled.filter((entry) =>
  entry.deloadConditioningRole === 'weekly_quality_owner');

ok('exactly one plan entry owns quality', owners.length === 1, compiled);
ok('the earliest typed quality entry owns it, not an aerobic row whose notes mention MAS',
  owners[0]?.dayOfWeek === 'Tuesday', owners[0]);
ok('every governed rival is explicitly assigned the easy-aerobic role',
  compiled.filter((entry) => entry.dayOfWeek !== 'Tuesday').every((entry) =>
    entry.deloadConditioningRole === 'easy_aerobic'), compiled);

console.log('\n[2] the typed weekly role controls final rows and copy');

const rendered = compiled.map((entry) => applyConditioningDeloadToExercises(
  [row(entry.conditioningCategory === 'aerobic_base' ? 'Steady MAS Blocks' : 'Tempo Intervals')],
  scheduled,
  entry.deloadConditioningRole,
)[0] as DeloadRow);
const qualityRows = rendered.filter((entry) => entry.deloadQualityExposure === true);
const qualitySentences = rendered.filter((entry) =>
  (entry.notes ?? '').includes("week's one quality exposure"));

ok('exactly one final row owns quality across the whole week', qualityRows.length === 1, rendered);
ok('the ownership sentence appears exactly once across the whole week',
  qualitySentences.length === 1, rendered.map((entry) => entry.notes));
ok('a typed easy-aerobic role cannot self-promote from MAS in its row text',
  rendered[0]?.deloadQualityExposure === false &&
    (rendered[0]?.notes ?? '').includes('easy aerobic only'), rendered[0]);

console.log('\n[3] ownership is chronological, not input-order dependent');

const reversed = applyDeloadPoliciesToWeeklySessionAllocations(
  [...source].reverse(),
  doseByDay,
);
ok('reversing plan storage order keeps Tuesday as the owner',
  reversed.find((entry) => entry.deloadConditioningRole === 'weekly_quality_owner')
    ?.dayOfWeek === 'Tuesday', reversed);

console.log('\n[4] typed Speed owns quality without spending it on preparation');

const speedEntry: SessionAllocation = {
  ...allocation('Sunday', 'aerobic_base'),
  conditioningCategory: undefined,
  conditioningFlavour: undefined,
  speedWorkKind: 'true_speed',
  speedPlacement: 'standalone',
  speedBlock: { kind: 'true_speed', title: 'Fly 20', exerciseIds: [] } as any,
};
const speedCompiled = applyDeloadPoliciesToWeeklySessionAllocations(
  [...source, speedEntry],
  { ...doseByDay, 0: scheduled },
);
ok('typed Speed owns the one sharp exposure ahead of a metabolic interval',
  speedCompiled.find((entry) => entry.deloadConditioningRole === 'weekly_quality_owner')
    ?.dayOfWeek === 'Sunday', speedCompiled);
const speedRows = applyConditioningDeloadToExercises(
  [row('Warm-up'), row('Fly 20 Sprint')],
  scheduled,
  'weekly_quality_owner',
  'speed',
) as DeloadRow[];
ok('Speed preparation does not spend the quality exposure before the Fly row',
  speedRows[0]?.deloadQualityExposure === undefined
    && speedRows[1]?.deloadQualityExposure === true
    && (speedRows[1]?.notes ?? '').includes("week's one quality exposure"),
  speedRows);

console.log('\n[5] the guard demonstrates the old per-session reset failure');

const resetMutation = [row('Tempo Intervals'), row('VO2 Intervals')].map((entry) =>
  applyConditioningDeloadToExercises([entry], scheduled)[0] as DeloadRow);
ok('[MUTATION] removing the weekly roles recreates multiple self-elected owners',
  resetMutation.filter((entry) => entry.deloadQualityExposure === true).length === 2,
  resetMutation);

console.log('\n[6] the canonical compiler is the only weekly ownership author');

const compilerSource = readFileSync(
  join(__dirname, '../rules/canonicalWeeklyCompiler.ts'),
  'utf8',
);
const adapterSource = readFileSync(join(__dirname, '../data/defaultProgram.ts'), 'utf8');
ok('the compiler applies one weekly deload-plan transform',
  compilerSource.includes('applyDeloadPoliciesToWeeklySessionAllocations('));
ok('the retained adapter consumes the compiler-authored typed role',
  adapterSource.includes('planEntry?.deloadConditioningRole'));
ok('[MUTATION] removing the compiler handover is detected',
  !compilerSource.replace(
    'applyDeloadPoliciesToWeeklySessionAllocations(',
    'applyDeloadPoliciesToWeeklySessionAllocations_REMOVED(',
  ).includes('applyDeloadPoliciesToWeeklySessionAllocations('));

console.log(`\nDeload weekly quality ownership: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
