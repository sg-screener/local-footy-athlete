/**
 * THE READINESS LAW + THE ILLNESS LAW — Sam, 2026-07-27.
 *
 *   docs/LFA_PROGRAMMING_BIBLE.md §14 + §19
 *
 * Readiness: low readiness means THE NEXT 7 DAYS ARE DELOADED — a rolling
 * window from the declaration day, not the remainder of the calendar week.
 * Declare on Friday and the following week deloads, not just the weekend.
 *
 * Illness: three tiers, all riding the deload law. Severity decides exactly
 * TWO things — deload or not, optional or not.
 *
 *   mild      training unchanged; logged as a fact that can lower readiness
 *   moderate  deloaded while the fact is ACTIVE (illness horizon, NOT 7 days)
 *   severe    deloaded AND every session optional while active
 *
 * Both replace the invented four-tier readiness system. The tier TYPE is
 * retired, not just its numbers: readiness exposes deloaded-or-not and nothing
 * else, so it cannot grow graduations back.
 *
 * Run: npm run test:readiness-illness-law
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  READINESS_DELOAD_WINDOW_DAYS,
  resolveReadinessDeload,
  resolveIllnessDirective,
  isDateInReadinessDeloadWindow,
  type IllnessSeverityTier,
} from '../rules/readinessIllnessLaw';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/* ── The window ── */

console.log('\n[1] THE READINESS WINDOW — rolling 7 days, not remainder-of-week');

ok('the window is 7 days', READINESS_DELOAD_WINDOW_DAYS === 7,
  `got ${READINESS_DELOAD_WINDOW_DAYS}`);

// Sam's worked example. 2026-07-31 is a Friday.
const FRIDAY = '2026-07-31';
const declared = resolveReadinessDeload({ declaredOnISO: FRIDAY, lowReadiness: true });

ok('a low-readiness declaration produces a deload', declared !== null);
ok('the window starts on the declaration day',
  declared?.startISO === FRIDAY, `got ${declared?.startISO}`);
ok('the window ends 7 days later, on the following Thursday',
  declared?.endISO === '2026-08-06', `got ${declared?.endISO}`);

// The whole point of the ruling: NOT the remainder of the calendar week.
for (const [label, date] of [
  ['Friday (declaration day)', '2026-07-31'],
  ['Saturday', '2026-08-01'],
  ['Sunday — old behaviour stopped here', '2026-08-02'],
  ['Monday of the NEXT week', '2026-08-03'],
  ['Wednesday of the next week', '2026-08-05'],
  ['Thursday — last day of the window', '2026-08-06'],
] as const) {
  ok(`${label} is inside the window`,
    isDateInReadinessDeloadWindow(date, declared!), date);
}

ok('the 8th day is OUTSIDE the window',
  !isDateInReadinessDeloadWindow('2026-08-07', declared!));
ok('the day before the declaration is outside the window',
  !isDateInReadinessDeloadWindow('2026-07-30', declared!));

ok('normal readiness produces no deload',
  resolveReadinessDeload({ declaredOnISO: FRIDAY, lowReadiness: false }) === null);

/* ── No graduations ── */

console.log('\n[2] NO TIERS — readiness says deloaded-or-not, and nothing else');

ok('readiness exposes only a window, never a magnitude',
  declared !== null
    && !('tier' in declared)
    && !('severity' in declared)
    && !('reduction' in declared),
  Object.keys(declared ?? {}).join(', '));

// NOTE — two structural assertions belong to the MIGRATION commit, not here:
// that no production file still names a retired tier, and that
// weeklyExposureContractBuilders no longer zeroes main_strength. The law is
// authored and encoded; retiring the 81 call sites is its own pass, and
// asserting the end state before that pass would ship a red gate.
/* ── Illness ── */

console.log('\n[3] THE ILLNESS LAW — three tiers, exactly two decisions');

const TIERS: readonly IllnessSeverityTier[] = ['mild', 'moderate', 'severe'];

ok('exactly three illness tiers exist', TIERS.length === 3);

{
  const mild = resolveIllnessDirective('mild');
  ok('MILD does not deload', mild.deloaded === false);
  ok('MILD does not make sessions optional', mild.sessionsOptional === false);
}
{
  const moderate = resolveIllnessDirective('moderate');
  ok('MODERATE deloads', moderate.deloaded === true);
  ok('MODERATE does not make sessions optional', moderate.sessionsOptional === false);
}
{
  const severe = resolveIllnessDirective('severe');
  ok('SEVERE deloads', severe.deloaded === true);
  ok('SEVERE makes every session optional', severe.sessionsOptional === true);
}

ok('severity decides EXACTLY two things and carries no other numbers',
  TIERS.every((tier) => {
    const keys = Object.keys(resolveIllnessDirective(tier)).sort();
    return keys.join(',') === 'deloaded,sessionsOptional';
  }),
  Object.keys(resolveIllnessDirective('moderate')).join(', '));

// The horizons are deliberately different, and confusing them is the obvious
// mistake: illness is open until cleared, readiness is a fixed 7 days.
ok('illness does NOT use the readiness 7-day window',
  resolveIllnessDirective('moderate').deloaded === true
    && !('windowDays' in resolveIllnessDirective('moderate')));

/* ── The Bible ── */

console.log('\n[4] AUTHORED — both laws recorded');

const bible = fs.readFileSync(path.join(repoRoot, 'docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8');
ok('the readiness law is in the Bible', bible.includes('THE READINESS LAW (Sam, 2026-07-27)'));
ok('the illness law is in the Bible', bible.includes('THE ILLNESS LAW (Sam, 2026-07-27)'));
ok('the Bible states there is no full pause', /There is no "full pause"/.test(bible));
ok('the Bible states readiness never removes sessions',
  /Readiness never REMOVES sessions/.test(bible));

/* ── Result ── */

console.log(
  `\nReadiness + illness law: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
