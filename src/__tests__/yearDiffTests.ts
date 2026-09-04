/**
 * THE YEAR DIFF — the instrument that answers "what did this do to the athlete".
 *
 * Run: `npm run test:year-diff`.
 *
 * ⚠ **AN INSTRUMENT NOBODY CHECKS IS AN INSTRUMENT THAT CAN READ ZERO FOREVER.**
 * A differ that never reports a difference passes every "no change" run
 * silently, and a "NOTHING CHANGED" banner is exactly the output someone acts
 * on — it is what tells them their fix reached nothing. So each cell here
 * MUTATES a summary and requires the differ to see it.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diffCounts, diffAthlete } = require('../../scripts/year-diff.cjs') as {
  diffCounts: (a: Record<string, number>, b: Record<string, number>) => { key: string; was: number; now: number }[];
  diffAthlete: (a: unknown, b: unknown) => Record<string, unknown>;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { summariseAthlete } = require('../../scripts/year-summary.cjs') as {
  summariseAthlete: (year: unknown) => Record<string, unknown>;
};

const repoRoot = path.resolve(__dirname, '../..');

/** One athlete-year, small but shaped exactly like the driver's output. */
const YEAR = {
  weeks: [{
    number: 1,
    days: [
      { date: '2026-09-28', type: 'Strength', name: 'lower', rows: [
        { name: 'Back Squat', role: 'main_lift', dose: '3 × 5' },
        { name: 'Single-Leg RDL', role: 'accessory', dose: '3 × 8 / side' },
      ] },
      { date: '2026-09-29', type: 'Mobility', name: 'Mobility', rows: [
        { name: 'Cat-Cow', role: 'prehab', dose: '2 × 10' },
      ] },
    ],
  }],
};
const clone = () => JSON.parse(JSON.stringify(YEAR));

console.log('\nYEAR DIFF — the instrument, mutation-checked\n');

run('non-vacuity: the summary actually counts the fixture', () => {
  const s = summariseAthlete(YEAR) as any;
  assert.equal(s.weeks, 1);
  assert.equal(s.totalRows, 3);
  assert.equal(s.rowsByRole.main_lift, 1);
  assert.equal(s.exerciseRole['Back Squat [main_lift]'], 1);
  assert.equal(s.doses['Single-Leg RDL :: 3 × 8 / side'], 1);
});

run('an IDENTICAL year reports no difference — the loud no-op must be reachable', () => {
  assert.deepEqual(diffAthlete(summariseAthlete(YEAR), summariseAthlete(clone())), {});
});

/* ── Each mutation below is a REAL defect shape from 2026-09-04. ── */

run('MUTATION: a role changes — the main-lift badge defect', () => {
  const after = clone();
  after.weeks[0].days[0].rows[0].role = 'accessory';
  const d = diffAthlete(summariseAthlete(YEAR), summariseAthlete(after)) as any;
  assert(d.rowsByRole, 'a row moving between roles must be reported');
  assert(d.exerciseRole.some((r: any) => r.key === 'Back Squat [main_lift]' && r.now === 0));
});

run('MUTATION: a dose loses "/ side" — the per-side defect', () => {
  const after = clone();
  after.weeks[0].days[0].rows[1].dose = '3 × 8';
  const d = diffAthlete(summariseAthlete(YEAR), summariseAthlete(after)) as any;
  assert(d.doses, 'a changed dose string must be reported');
  assert(d.doses.some((r: any) => r.key.includes('/ side') && r.now === 0));
});

run('MUTATION: a lift that may never lead a day appears as a main lift', () => {
  const after = clone();
  after.weeks[0].days[0].rows.push({ name: 'Kettlebell Swings', role: 'main_lift', dose: '3 × 8' });
  const d = diffAthlete(summariseAthlete(YEAR), summariseAthlete(after)) as any;
  assert(d.exerciseRole.some((r: any) =>
    r.key === 'Kettlebell Swings [main_lift]' && r.was === 0 && r.now === 1),
  'a NEW exercise/role pair is the shape no assertion existed to catch');
});

run('MUTATION: a session becomes a rest day', () => {
  const after = clone();
  after.weeks[0].days[1].type = 'none';
  after.weeks[0].days[1].rows = [];
  const d = diffAthlete(summariseAthlete(YEAR), summariseAthlete(after)) as any;
  assert(d.dayTypes, 'a day changing type must be reported');
  assert(d.totalRows, 'losing a row must be reported');
});

run('MUTATION: the driver stops early — fewer weeks reached', () => {
  const after = clone();
  after.weeks = [];
  const d = diffAthlete(summariseAthlete(YEAR), summariseAthlete(after)) as any;
  assert(d.weeks && d.weeks.now === 0, 'a truncated run must not read as "no change"');
});

run('key ORDER is never reported as a change', () => {
  assert.deepEqual(diffCounts({ a: 1, b: 2 }, { b: 2, a: 1 }), []);
});

run('the committed baseline exists and covers both athletes', () => {
  const file = path.join(repoRoot, 'docs/YEAR_BASELINE.json');
  assert(fs.existsSync(file), 'docs/YEAR_BASELINE.json is missing — run npm run year:baseline');
  const baseline = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const gender of ['male', 'female']) {
    assert(baseline[gender], `baseline has no ${gender} athlete`);
    assert(baseline[gender].weeks === 52, `${gender} baseline is ${baseline[gender].weeks} weeks, not a full year`);
    assert(baseline[gender].totalRows > 500, `${gender} baseline holds only ${baseline[gender].totalRows} rows`);
  }
});

console.log(`\nYear diff: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(`\nFAILURES:\n${failures.map((n) => `  - ${n}`).join('\n')}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exitCode = 1;
