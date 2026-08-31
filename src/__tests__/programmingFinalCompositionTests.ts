import assert from 'node:assert/strict';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { chooseInjurySessionAdditions } from '../utils/injurySessionAdjustment';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { classifyExerciseRiskForBucket } from '../rules/injuryExerciseRisk';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const dateISO = '2026-07-15';
const profile = athleteAnswers(ARCHETYPES.find((entry) =>
  entry.id === 'male-3-experienced-gym')!);

function shoulderAdditions(): string[] {
  const environment = resolveTapSwapEnvironment({
    date: dateISO,
    profile,
    activeConstraints: [],
    readinessSignal: null,
    primaryInjury: { bucket: 'shoulder', severity: 6 },
  });
  return chooseInjurySessionAdditions({
    environment,
    profile,
    keptRowNames: [],
    pausedRowNames: ['Bench Press', 'DB Shoulder Press', 'Tricep Pushdown'],
    weekExerciseNames: ['Bench Press', 'DB Shoulder Press', 'Tricep Pushdown'],
    otherMainStrengthPatterns: ['push', 'pull'],
    excludedByAthlete: [],
    pausedCount: 3,
    originalRowCount: 6,
    injuredHalf: 'upper',
    keptSets: 0,
    dateISO,
  }).map((candidate) => candidate.name);
}

check('a limiting shoulder injury produces a nonempty lower-body and midline block', () => {
  const names = shoulderAdditions();
  assert.ok(names.length > 0, 'the final injury block was empty');
  assert.ok(names.every((name) =>
    classifyExerciseRiskForBucket(name, 'shoulder', 6) === 'good'),
  JSON.stringify(names));
  assert.ok(names.every((name) => !/tricep/i.test(name)), JSON.stringify(names));
});

check('injury composition is independent of strength catalogue order', () => {
  const before = shoulderAdditions();
  const arrays = Object.values(STRENGTH_POOLS).flatMap((pool) =>
    [pool.anchor.entries, pool.accessory.entries]);
  for (const entries of arrays) entries.reverse();
  try {
    assert.deepEqual(shoulderAdditions(), before);
  } finally {
    for (const entries of arrays) entries.reverse();
  }
});

console.log(`programming final composition: ${passed} passed`);
