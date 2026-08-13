(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { getOffseasonSubphasePolicy } from '../rules/offseasonSubphasePolicy';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. Added when this suite was wired into test:bible — an unarmed suite
// in the chain exits 0 on a drained loop and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

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

// RE-POINTED (Sam's readiness law, 2026-07-28; applied 2026-07-29). Four
// assertions in this block asserted the SUPERSEDED behaviour: that low readiness
// zeroes the hard-session cap and writes `blocked_low_readiness` onto running and
// speed. Capacity affects dose only, so those are now the things that must NOT
// move — see docs/READINESS_CENSUS_SWEEP_2026-07-29.md.
console.log('\n[4] low-capacity dosing (structure untouched)');
{
  const normal = getOffseasonSubphasePolicy('late_offseason');
  const low = getOffseasonSubphasePolicy('late_offseason', { capacity: 'low' });
  eq('low capacity narrows conditioning to aerobic base', low.conditioning.allowedCategories, ['aerobic_base']);
  eq('low capacity biases the modality off-feet', low.conditioning.modalityBias, 'off_feet');
  eq('low capacity caps RPE at 7', low.strength.targetRpeMax, 7);
  eq('low capacity increases optional/support bias', low.sessions.optionalSupportBias, 'high');

  eq('low capacity does not move the hard-conditioning cap',
    low.conditioning.hardSessionCap, normal.conditioning.hardSessionCap);
  eq('low capacity does not block running', low.running.policy, normal.running.policy);
  eq('low capacity does not block speed', low.speedSprint.policy, normal.speedSprint.policy);
  eq('low capacity does not reduce the core-session bias',
    low.sessions.coreBias, normal.sessions.coreBias);
  eq('low capacity does not avoid combined days',
    low.sessions.lowAvailabilityCombinedDays, normal.sessions.lowAvailabilityCombinedDays);

  ok('low-capacity derivation does not mutate the base policy',
    normal.conditioning.hardSessionCap === 1 &&
      normal.speedSprint.policy === 'existing_late_offseason_gate',
    normal);
  ok('low-capacity policy explains the dosing',
    low.reasons.some((reason) => /Low capacity/.test(reason)),
    low.reasons);
}

console.log('\nSummary');
console.log(`  Pass: ${pass}`);
totalsPrinted(fail);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
