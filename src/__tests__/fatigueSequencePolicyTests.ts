import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { resolveFatigueDayPolicy, type FatigueReportLevel } from '../rules/fatigueSequencePolicy';

armTotalsOrRed();
let pass = 0;
let fail = 0;
function ok(name: string, condition: unknown): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else { fail += 1; console.error(`  FAIL ${name}`); }
}
const report = (dateISO: string, level: FatigueReportLevel, factId = dateISO) =>
  ({ dateISO, level, factId });

console.log('\n[1] One day means exactly what the athlete selected');
ok('bit tired is noted only', resolveFatigueDayPolicy([report('2026-08-24', 'slight')], '2026-08-24').effect === 'none');
ok('pretty flat is lighter for that date', resolveFatigueDayPolicy([report('2026-08-24', 'moderate')], '2026-08-24').effect === 'lighter');
ok('cooked is rest for that date', resolveFatigueDayPolicy([report('2026-08-24', 'cooked')], '2026-08-24').effect === 'rest');
ok('the next day is unchanged after one cooked report', resolveFatigueDayPolicy([report('2026-08-24', 'cooked')], '2026-08-25').effect === 'none');

console.log('\n[2] Every two-day combination deloads from day two through Sunday');
for (const first of ['slight', 'moderate', 'cooked'] as const) {
  for (const second of ['slight', 'moderate', 'cooked'] as const) {
    const reports = [report('2026-08-24', first, 'a'), report('2026-08-25', second, 'b')];
    const dayTwo = resolveFatigueDayPolicy(reports, '2026-08-25');
    ok(`${first} + ${second} triggers`, dayTwo.consecutiveTrigger);
    ok(`${first} + ${second} has the right second-day effect`,
      dayTwo.effect === (second === 'cooked' ? 'rest' : 'deload'));
    ok(`${first} + ${second} deloads Sunday`, resolveFatigueDayPolicy(reports, '2026-08-30').effect === 'deload');
  }
}

console.log('\n[3] Calendar identity and week boundaries');
ok('two taps on one date are not a streak', !resolveFatigueDayPolicy([
  report('2026-08-24', 'slight', 'a'), report('2026-08-24', 'moderate', 'b'),
], '2026-08-24').consecutiveTrigger);
ok('a gap breaks the sequence', !resolveFatigueDayPolicy([
  report('2026-08-24', 'slight'), report('2026-08-26', 'slight'),
], '2026-08-26').consecutiveTrigger);
ok('Sunday then Monday triggers a fresh Monday-to-Sunday deload', (() => {
  const reports = [report('2026-08-30', 'slight'), report('2026-08-31', 'moderate')];
  const monday = resolveFatigueDayPolicy(reports, '2026-08-31');
  return monday.consecutiveTrigger && monday.deloadThroughISO === '2026-09-06'
    && resolveFatigueDayPolicy(reports, '2026-09-06').effect === 'deload';
})());
ok('cooked remains rest inside an active deload', resolveFatigueDayPolicy([
  report('2026-08-24', 'slight'), report('2026-08-25', 'slight'), report('2026-08-27', 'cooked'),
], '2026-08-27').effect === 'rest');

console.log(`\nfatigueSequencePolicyTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail) process.exit(1);
