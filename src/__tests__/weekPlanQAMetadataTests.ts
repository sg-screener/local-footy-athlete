import { readFileSync } from 'fs';
import { join } from 'path';
import {
  WEEK_PLAN_QA_SCENARIO_METADATA,
  humanNameFromLegacyName,
  metadataForScenario,
  parseScenarioId,
  scenarioContextLine,
  scenarioDisplayLabel,
  scenarioTocLine,
} from './weekPlanQA/scenarioMetadata';

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

console.log('weekPlanQAMetadataTests');

console.log('\n[1] every current QA scenario has readable metadata');
{
  const ids = WEEK_PLAN_QA_SCENARIO_METADATA.map((entry) => entry.id);
  eq('metadata covers the current 17 scenarios', ids.length, 17);
  eq('metadata IDs are unique', new Set(ids).size, ids.length);
  for (const entry of WEEK_PLAN_QA_SCENARIO_METADATA) {
    ok(`${entry.id} has a human-readable name`, entry.humanName.trim().length > 0);
    ok(`${entry.id} has a phase`, entry.phase.trim().length > 0);
    ok(`${entry.id} has an intent`, entry.scenarioIntent.trim().length > 0);
    ok(`${entry.id} has availability context`, entry.availabilitySummary.trim().length > 0);
  }
}

console.log('\n[2] metadata stays in lockstep with the harness scenario list');
{
  const harnessIds = scenarioIdsFromHarness();
  const metadataIds = WEEK_PLAN_QA_SCENARIO_METADATA.map((entry) => entry.id);
  const metadataNames = WEEK_PLAN_QA_SCENARIO_METADATA.map((entry) => entry.humanName);
  eq('scenario count does not change', harnessIds.length, 17);
  eq('metadata IDs match harness IDs', metadataIds, harnessIds);
  eq('human-readable scenario names stay stable', metadataNames, [
    'In-season, Saturday game, two team trainings',
    'In-season, Sunday game, six-day availability',
    'In-season, Friday night game',
    'In-season bye week',
    'Off-season, five days, team Tuesday/Thursday',
    'Off-season four-day low availability',
    'Off-season six days with three team trainings',
    'In-season, Saturday game, team Monday/Wednesday',
    'In-season, Saturday game, one team training',
    'In-season, Saturday game, three consecutive team trainings',
    'Pre-season with Saturday practice match',
    'Pre-season, no practice match',
    'Edit flow, remove Saturday game',
    'Edit flow, move Saturday game to Sunday',
    'Edit flow, add Saturday game back',
    'In-season low availability with Saturday game',
    'In-season low readiness with injuries',
  ]);
}

console.log('\n[3] QA output helpers include ID, name, context, and intent');
{
  const input = { id: 'S11', name: 'S11: Pre-season, Sat game, 5 days' };
  const metadata = metadataForScenario(input);
  eq('S11 resolves to human name', metadata.humanName, 'Pre-season with Saturday practice match');
  ok('display label includes ID and human name', scenarioDisplayLabel(input).includes('S11 — Pre-season with Saturday practice match'));
  ok('context line includes phase', scenarioContextLine(input).includes('Phase: Pre-season'));
  ok('context line includes game context', scenarioContextLine(input).includes('Game: Saturday'));
  ok('context line includes team context', scenarioContextLine(input).includes('Team: Tuesday, Thursday'));
  ok('context line includes availability context', scenarioContextLine(input).includes('5 available days: Monday-Friday'));
  ok('catalog line includes intent', scenarioTocLine(input).includes('Guards pre-season practice-match/game stress'));
}

console.log('\n[4] missing metadata falls back safely');
{
  const fallbackInput = {
    name: 'X99: Mystery QA scenario',
    onboarding: {
      seasonPhase: 'Off-season' as const,
      gameDay: undefined,
      teamTrainingDays: ['Monday' as const],
      preferredTrainingDays: ['Monday' as const, 'Wednesday' as const],
    },
  };
  const metadata = metadataForScenario(fallbackInput);
  eq('unknown ID parses from legacy name', parseScenarioId(fallbackInput.name), 'X99');
  eq('legacy name strips old ID prefix', humanNameFromLegacyName(fallbackInput.name), 'Mystery QA scenario');
  eq('fallback preserves parsed ID', metadata.id, 'X99');
  eq('fallback preserves readable legacy name', metadata.humanName, 'Mystery QA scenario');
  ok('fallback display label is still readable', scenarioDisplayLabel(fallbackInput).includes('X99 — Mystery QA scenario'));
  ok('fallback context includes availability', scenarioContextLine(fallbackInput).includes('2 available days: Monday, Wednesday'));
  ok('fallback intent is explicit', scenarioTocLine(fallbackInput).includes('Intent not specified'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
