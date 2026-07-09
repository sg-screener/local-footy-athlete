import { readFileSync } from 'fs';
import { join } from 'path';
import type { WeekFinding } from '../rules/weekStructureValidator';
import {
  WEEK_PLAN_QA_ALLOWED_FINDINGS,
  allowedFindingPolicyKey,
  classifyValidatorFindings,
  findUnusedAllowedFindingPolicies,
  renderAllowedFinding,
  validateAllowedFindingPolicy,
  type AllowedFindingPolicy,
} from './weekPlanQA/allowedFindings';
import { WEEK_PLAN_QA_SCENARIO_METADATA } from './weekPlanQA/scenarioMetadata';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function scenarioIdsFromHarness(): string[] {
  const harnessPath = join(process.cwd(), 'src/__tests__/weekPlanQA.ts');
  const harness = readFileSync(harnessPath, 'utf8');
  const scenarioSection = harness.slice(harness.indexOf('const scenarios: Scenario[] = ['));
  return [...scenarioSection.matchAll(/\bid:\s*'([SE]\d+)'/g)].map((match) => match[1]);
}

function finding(overrides: Partial<WeekFinding> = {}): WeekFinding {
  return {
    ruleId: 'cap_conditioningExposures_under',
    severity: 'info',
    message: '2 conditioning exposures (Bible target >= 3)',
    dates: [],
    sessions: [],
    canOverride: true,
    bibleRef: 'Section 17.B',
    ...overrides,
  };
}

console.log('weekPlanQAAllowedFindingsTests');

console.log('\n[1] allowed findings are explicit, scenario-scoped, and reasoned');
{
  const harnessIds = scenarioIdsFromHarness();
  const metadataIds = new Set(WEEK_PLAN_QA_SCENARIO_METADATA.map((entry) => entry.id));
  const errors = validateAllowedFindingPolicy(WEEK_PLAN_QA_ALLOWED_FINDINGS, harnessIds);
  eq('allowed finding policy validates cleanly', errors, []);
  ok('scenario count does not change', harnessIds.length === 17);
  for (const policy of WEEK_PLAN_QA_ALLOWED_FINDINGS) {
    ok(`${policy.scenarioId}:${policy.ruleId} has a reason`, policy.reason.trim().length > 0);
    ok(`${policy.scenarioId}:${policy.ruleId} is scenario-scoped`, metadataIds.has(policy.scenarioId));
    ok(`${policy.scenarioId}:${policy.ruleId} has a stable matcher`, policy.ruleId.trim().length > 0);
    ok(`${policy.scenarioId}:${policy.ruleId} does not allow hard_stop`, policy.severity !== 'hard_stop');
  }
}

console.log('\n[2] allowed info finding is classified and rendered without failing');
{
  const result = classifyValidatorFindings('S3', [
    finding({ ruleId: 'cap_conditioningExposures_under', severity: 'info' }),
  ]);
  eq('allowed info finding does not become unallowed', result.unallowed.length, 0);
  eq('allowed info finding is matched', result.allowed.length, 1);
  const rendered = renderAllowedFinding(result.allowed[0], 'S3 - Friday game').join('\n');
  ok('rendered output says Allowed finding', rendered.includes('Allowed finding: S3 - Friday game'));
  ok('rendered output includes status', rendered.includes('Status: info-only'));
  ok('rendered output includes reason', rendered.includes('Reason:'));
}

console.log('\n[3] true unallowed findings remain failures');
{
  const wrongScenario = classifyValidatorFindings('S1', [
    finding({ ruleId: 'cap_conditioningExposures_under', severity: 'info' }),
  ]);
  eq('same finding is unallowed in the wrong scenario', wrongScenario.unallowed.length, 1);

  const unknownRule = classifyValidatorFindings('S3', [
    finding({ ruleId: 'g2_hard_conditioning', severity: 'strong', message: 'Hard conditioning too close to game.' }),
  ]);
  eq('unknown strong finding is unallowed', unknownRule.unallowed.length, 1);
}

console.log('\n[4] stale allowed findings are detected');
{
  const policy = WEEK_PLAN_QA_ALLOWED_FINDINGS[0];
  const stale = findUnusedAllowedFindingPolicies(new Set(), [policy]);
  eq('unused allowance is stale', stale, [policy]);

  const used = findUnusedAllowedFindingPolicies(new Set([allowedFindingPolicyKey(policy)]), [policy]);
  eq('used allowance is not stale', used, []);
}

console.log('\n[5] malformed policy fails loudly');
{
  const malformed: AllowedFindingPolicy = {
    scenarioId: 'S99',
    ruleId: 'cap_maxHardDays_over',
    severity: 'hard_stop',
    status: 'expected',
    reason: '',
  };
  const errors = validateAllowedFindingPolicy([malformed], scenarioIdsFromHarness());
  ok('unknown scenario is reported', errors.some((error) => error.includes('unknown scenario ID')), errors);
  ok('missing reason is reported', errors.some((error) => error.includes('must include a reason')), errors);
  ok('hard_stop allowance is rejected', errors.some((error) => error.includes('may not allow hard_stop')), errors);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
