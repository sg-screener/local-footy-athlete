(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { getOffseasonSubphasePolicy } from '../rules/offseasonSubphasePolicy';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  fail += 1;
  failures.push(name);
  console.log(`  FAIL ${name}`);
  if (detail !== undefined) console.log(`       ${JSON.stringify(detail)}`);
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

console.log('offseasonSubphasePolicyTests');

console.log('\n[1] early off-season defaults');
{
  const policy = getOffseasonSubphasePolicy('early_offseason');
  eq('early blocks running by default', policy.running.enabledByDefault, false);
  eq('early blocks running by subphase', policy.running.allowedBySubphase, false);
  eq('early blocks sprint/COD', policy.speedSprint.allowedBySubphase, false);
  eq('early allows aerobic base only', policy.conditioning.allowedCategories, ['aerobic_base']);
  eq('early hard conditioning cap is zero', policy.conditioning.hardSessionCap, 0);
  eq('early prefers off-feet conditioning', policy.conditioning.modalityBias, 'off_feet');
  eq('early uses body-armour rep bias', policy.strength.repBias, 'body_armour_8_12');
  eq('early rep range is 8-12', [policy.strength.repsMin, policy.strength.repsMax], [8, 12]);
  eq('early RPE target is 6-7', [policy.strength.targetRpeMin, policy.strength.targetRpeMax], [6, 7]);
  eq('early increases optional/support bias', policy.sessions.optionalSupportBias, 'high');
  eq('early avoids brutal low-availability S+C compression',
    policy.sessions.lowAvailabilityCombinedDays,
    'avoid');
  ok('early excludes VO2 and glycolytic',
    !policy.conditioning.allowedCategories.includes('vo2') &&
      !policy.conditioning.allowedCategories.includes('glycolytic'),
    policy.conditioning.allowedCategories);
}

console.log('\n[2] mid off-season transition');
{
  const policy = getOffseasonSubphasePolicy('mid_offseason');
  eq('mid allows aerobic base and tempo',
    policy.conditioning.allowedCategories,
    ['aerobic_base', 'tempo']);
  eq('mid has no default hard conditioning', policy.conditioning.hardSessionCap, 0);
  eq('mid still blocks sprint/COD', policy.speedSprint.allowedBySubphase, false);
  eq('mid running is conditional, not default', policy.running.enabledByDefault, false);
  eq('mid running policy is careful re-entry', policy.running.policy, 'careful_reentry_if_healthy');
  eq('mid strength bridges through 6-10 reps',
    [policy.strength.repBias, policy.strength.repsMin, policy.strength.repsMax],
    ['bridge_6_10', 6, 10]);
}

console.log('\n[3] late off-season build');
{
  const policy = getOffseasonSubphasePolicy('late_offseason');
  ok('late allows harder conditioning categories',
    policy.conditioning.allowedCategories.includes('vo2') &&
      policy.conditioning.allowedCategories.includes('glycolytic'),
    policy.conditioning.allowedCategories);
  eq('late hard conditioning cap is one', policy.conditioning.hardSessionCap, 1);
  eq('late allows gradual running re-entry', policy.running.policy, 'gradual_reentry');
  eq('late allows speed by subphase', policy.speedSprint.allowedBySubphase, true);
  eq('late keeps existing speed intent',
    policy.speedSprint.policy,
    'existing_late_offseason_gate');
  eq('late strength uses established 6-8 bias',
    [policy.strength.repBias, policy.strength.repsMin, policy.strength.repsMax],
    ['strength_6_8', 6, 8]);
}

console.log('\n[4] low-readiness tightening');
{
  const normal = getOffseasonSubphasePolicy('late_offseason');
  const low = getOffseasonSubphasePolicy('late_offseason', { readiness: 'low' });
  eq('low readiness narrows conditioning to aerobic base', low.conditioning.allowedCategories, ['aerobic_base']);
  eq('low readiness removes hard conditioning', low.conditioning.hardSessionCap, 0);
  eq('low readiness blocks running', low.running.policy, 'blocked_low_readiness');
  eq('low readiness blocks speed', low.speedSprint.policy, 'blocked_low_readiness');
  eq('low readiness caps RPE at 7', low.strength.targetRpeMax, 7);
  eq('low readiness increases optional/support bias', low.sessions.optionalSupportBias, 'high');
  ok('low-readiness derivation does not mutate the base policy',
    normal.conditioning.hardSessionCap === 1 &&
      normal.speedSprint.policy === 'existing_late_offseason_gate',
    normal);
  ok('low-readiness policy explains the tightening',
    low.reasons.some((reason) => /Low readiness/.test(reason)),
    low.reasons);
}

console.log('\nSummary');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
