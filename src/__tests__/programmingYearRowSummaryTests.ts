import assert from 'node:assert/strict';
import {
  summarizeProgrammingYearRows,
  type ProgrammingYearVisibleDay,
} from '../rules/programmingYearRowSummary';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const days: ProgrammingYearVisibleDay[] = [{
  date: '2026-09-28', type: 'Mixed', tier: 'required',
  warmup: [
    { name: 'Lat Stretch', catalogueIdentity: 'Lat Stretch' },
    { name: 'Scap Push-Up', catalogueIdentity: 'Scap Push-Up' },
  ],
  rows: [
    { name: 'Bench Press', catalogueIdentity: 'Bench Press', role: 'main_lift' },
    { name: 'Box Jumps', catalogueIdentity: 'Box Jumps', role: 'power' },
    { name: 'Side Plank', catalogueIdentity: 'Side Plank', role: 'midline' },
    { name: 'Band Pull-Apart', catalogueIdentity: 'Band Pull-Apart', role: 'prehab' },
    { name: '4 × 4 VO₂ Max', catalogueIdentity: '4 × 4 VO₂ Max', role: 'conditioning' },
  ],
}, {
  date: '2026-09-29', type: 'Mobility', tier: 'optional',
  rows: [
    { name: 'Elephant Walks', catalogueIdentity: 'Elephant Walks', role: 'prehab' },
  ],
}];

check('content buckets partition every main-session row exactly once', () => {
  const summary = summarizeProgrammingYearRows(days);
  assert.deepEqual(summary.mainSessionRowsByContent, {
    mainStrength: 1, power: 1, core: 1, prehab: 1,
    mobilityRecovery: 1, conditioning: 1, unclassified: 0,
  });
  assert.equal(Object.values(summary.mainSessionRowsByContent)
    .reduce((sum, count) => sum + count, 0), summary.mainSessionRows);
});

check('the workload headline includes Movement Prep', () => {
  const summary = summarizeProgrammingYearRows(days);
  assert.equal(summary.mainSessionRows, 6);
  assert.equal(summary.movementPrepRows, 2);
  assert.equal(summary.totalAthleteVisibleRows, 8);
});

check('optional sessions are an orthogonal subtotal, not a hidden content bucket', () => {
  const summary = summarizeProgrammingYearRows(days);
  assert.equal(summary.optionalSessionDays, 1);
  assert.equal(summary.optionalSessionRows, 1);
  assert.equal(summary.mainSessionRowsByContent.mobilityRecovery, 1);
});

check('duplicate detection uses canonical identity rather than display text', () => {
  const summary = summarizeProgrammingYearRows([{
    date: '2026-10-01', type: 'Strength', tier: 'required', rows: [
      { name: 'Pull-Up', catalogueIdentity: 'Pull-Ups', role: 'main_lift' },
      { name: 'Pull-Ups', catalogueIdentity: 'Pull-Ups', role: 'accessory' },
    ],
  }]);
  assert.deepEqual(summary.duplicateCanonicalRows, [{
    date: '2026-10-01', catalogueIdentity: 'Pull-Ups', occurrences: 2,
  }]);
});

check('different canonical rows are not collapsed because their copy looks related', () => {
  const summary = summarizeProgrammingYearRows([{
    date: '2026-10-02', type: 'Strength', tier: 'required', rows: [
      { name: 'Side Plank', catalogueIdentity: 'Side Plank', role: 'midline' },
      { name: 'Copenhagen Plank', catalogueIdentity: 'Copenhagen Plank (Half)', role: 'prehab' },
    ],
  }]);
  assert.equal(summary.duplicateCanonicalRows.length, 0);
});

check('team-training anchors count as visible workload without entering exercise identity checks', () => {
  const summary = summarizeProgrammingYearRows([{
    date: '2026-10-03', type: 'Team Training', tier: 'required', rows: [
      { name: 'Club session', role: 'team_training' },
      { name: 'Bench Press', catalogueIdentity: 'Bench Press', role: 'main_lift' },
    ],
  }]);
  assert.equal(summary.mainSessionRows, 2);
  assert.equal(summary.mainSessionRowsByContent.unclassified, 1);
  assert.equal(summary.mainSessionRowsByContent.mainStrength, 1);
  assert.deepEqual(summary.duplicateCanonicalRows, []);
});

console.log(`Programming year row summary: ${passed}/6 passed`);
