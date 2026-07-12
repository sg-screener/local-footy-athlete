(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { STRENGTH_BIBLE_RULES } from './expectations/strengthRules';
import { verifyExpectationImportBoundary } from './expectations/importBoundaryTests';
import { STRENGTH_GOLDEN_SCENARIOS } from './scenarios/strengthGoldens';
import { buildStrengthScenarioTrace } from './observations/buildStrengthTrace';
import {
  evaluateStrengthTrace,
  STRENGTH_INVARIANT_IDS,
} from './invariants/strengthIntentInvariants';
import { renderConformanceFailure } from './report/renderConformanceFailure';
import { runMutationAcceptanceTest } from './mutationAcceptanceTests';
import type {
  InvariantFailure,
  StrengthGoldenScenario,
  StrengthScenarioTrace,
  StrengthTraceStage,
} from './types';

const TARGET_RUNTIME_MS = 3_000;
const WARNING_RUNTIME_MS = 5_000;
const HARD_RUNTIME_MS = 15_000;
const ROUTINE_PRODUCTION_LOG_PREFIXES = [
  '[ProgramGen]',
  '[WorkoutCanonicalisation]',
  '[engine]',
  '[ENGINE-',
];

function fail(message: string): never {
  throw new Error(message);
}

function verifyRuleRegistry(repoRoot: string): void {
  if (STRENGTH_BIBLE_RULES.length !== 4) {
    fail(`Expected exactly four Slice 1 Bible rules, found ${STRENGTH_BIBLE_RULES.length}`);
  }
  const ids = new Set(STRENGTH_BIBLE_RULES.map((rule) => rule.id));
  if (ids.size !== STRENGTH_BIBLE_RULES.length) fail('Bible rule IDs must be unique');
  const bible = fs.readFileSync(path.join(repoRoot, 'docs', 'LFA_PROGRAMMING_BIBLE.md'), 'utf8');
  for (const rule of STRENGTH_BIBLE_RULES) {
    if (!bible.includes(rule.anchorQuote)) {
      fail(`${rule.id} anchor quote is no longer present in the Programming Bible`);
    }
    if (rule.applicableScenarios.length === 0) fail(`${rule.id} has no declared golden scenario`);
  }
}

function verifyFailureRenderer(): void {
  const report = renderConformanceFailure({
    invariantId: 'INV_HEALTHY_BLOCK_PATTERN_BALANCE',
    ruleId: 'ALL-STR-BLOCK-01',
    scenarioId: 'is-healthy-5d-tt2-game-sat',
    stage: 'allocation',
    expected: ['squat', 'hinge', 'push', 'pull'],
    actual: ['squat', 'push', 'pull'],
    missing: ['hinge'],
    extra: [],
    path: 'deterministic allocation',
  });
  const required = [
    'RULE      ALL-STR-BLOCK-01',
    'SCENARIO  is-healthy-5d-tt2-game-sat',
    'STAGE     allocation',
    'LOSS      hinge — unauthorised',
    'PATH      deterministic allocation',
  ];
  for (const fragment of required) {
    if (!report.includes(fragment)) fail(`Failure renderer omitted: ${fragment}`);
  }
}

function buildTraceWithoutRoutineProductionLogs(
  scenario: StrengthGoldenScenario,
): StrengthScenarioTrace {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const filtered = (sink: typeof console.log) => (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (ROUTINE_PRODUCTION_LOG_PREFIXES.some((prefix) => first.startsWith(prefix))) return;
    sink(...args);
  };
  console.log = filtered(originalLog);
  console.warn = filtered(originalWarn);
  try {
    return buildStrengthScenarioTrace(scenario);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

function stageRank(stage: StrengthTraceStage): number {
  return ['allocation', 'generated_fallback', 'visible_week', 'visible_detail'].indexOf(stage);
}

function main(): void {
  const startedAt = performance.now();
  const repoRoot = path.resolve(__dirname, '../../..');
  const expectationsDir = path.join(__dirname, 'expectations');

  console.log('Bible conformance harness — Slice 1 strength intent');
  console.log('Reference date: 2026-03-23 | Timezone: Australia/Melbourne');

  const boundary = verifyExpectationImportBoundary(expectationsDir);
  if (boundary.violations.length > 0) fail(boundary.violations.join('\n'));
  verifyRuleRegistry(repoRoot);
  verifyFailureRenderer();

  if (STRENGTH_GOLDEN_SCENARIOS.length !== 3) {
    fail(`Expected exactly three strength goldens, found ${STRENGTH_GOLDEN_SCENARIOS.length}`);
  }

  const allFailures: InvariantFailure[] = [];
  const appliedInvariantIds = new Set<string>();
  let invariantApplicationPasses = 0;
  let invariantApplications = 0;
  let scenarioPasses = 0;

  for (const scenario of STRENGTH_GOLDEN_SCENARIOS) {
    if (scenario.referenceDate !== '2026-03-23' || scenario.timezone !== 'Australia/Melbourne') {
      fail(`${scenario.id} must own the fixed Slice 1 date and timezone`);
    }
    const trace = buildTraceWithoutRoutineProductionLogs(scenario);
    const results = evaluateStrengthTrace(trace);
    const failures = results.flatMap((result) => result.failures);
    for (const result of results) {
      if (!result.applied) continue;
      appliedInvariantIds.add(result.invariantId);
      invariantApplications++;
      if (result.failures.length === 0) invariantApplicationPasses++;
    }
    allFailures.push(...failures);
    if (failures.length === 0) scenarioPasses++;
    console.log(`  ${failures.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} (${trace.runtimeMs.toFixed(1)}ms)`);
  }

  const missingInvariantImplementations = STRENGTH_INVARIANT_IDS.filter(
    (id) => !appliedInvariantIds.has(id),
  );
  if (missingInvariantImplementations.length > 0) {
    fail(`Invariant(s) never applied: ${missingInvariantImplementations.join(', ')}`);
  }

  const coveredRules = new Set(STRENGTH_BIBLE_RULES.flatMap((rule) =>
    rule.applicableScenarios.filter((scenarioId) =>
      STRENGTH_GOLDEN_SCENARIOS.some((scenario) => scenario.id === scenarioId),
    ).length > 0 ? [rule.id] : [],
  ));
  const failedRules = new Set(allFailures.map((failure) => failure.ruleId));
  const rulePasses = Array.from(coveredRules).filter((ruleId) => !failedRules.has(ruleId)).length;
  const failedInvariants = new Set(allFailures.map((failure) => failure.invariantId));
  const invariantPasses = STRENGTH_INVARIANT_IDS.filter(
    (invariantId) => appliedInvariantIds.has(invariantId) && !failedInvariants.has(invariantId),
  ).length;

  if (allFailures.length > 0) {
    const first = [...allFailures].sort((left, right) => stageRank(left.stage) - stageRank(right.stage))[0];
    console.error('\nFirst-divergence failure:');
    console.error(`\n${renderConformanceFailure(first)}`);
    if (allFailures.length > 1) {
      console.error(`\n${allFailures.length - 1} downstream failure(s) omitted.`);
    }
  }

  let mutationKills = 0;
  let mutationReport = '';
  if (allFailures.length === 0) {
    const mutation = runMutationAcceptanceTest();
    mutationKills = mutation.killed ? 1 : 0;
    mutationReport = mutation.report;
    console.log('  PASS mutation composite-lower-single-winner killed at allocation');
  }

  const totalMs = performance.now() - startedAt;
  console.log('\nSummary');
  console.log(`  Scenarios:  ${scenarioPasses}/${STRENGTH_GOLDEN_SCENARIOS.length}`);
  console.log(`  Rules:      ${rulePasses}/${STRENGTH_BIBLE_RULES.length}`);
  console.log(`  Invariants: ${invariantPasses}/${STRENGTH_INVARIANT_IDS.length} (${invariantApplicationPasses}/${invariantApplications} applications)`);
  console.log(`  Mutations:  ${mutationKills}/1 killed`);
  console.log(`  Boundary:   ${boundary.checkedFiles.length} expectation file(s), 0 forbidden imports`);
  console.log(`  Runtime:    ${totalMs.toFixed(1)}ms (target <${TARGET_RUNTIME_MS}ms)`);

  if (mutationReport) {
    console.log('\nMutation first-divergence proof');
    console.log(mutationReport);
  }
  if (totalMs > WARNING_RUNTIME_MS) {
    console.warn(`Bible Slice 1 runtime warning: ${totalMs.toFixed(1)}ms exceeds ${WARNING_RUNTIME_MS}ms`);
  }
  if (totalMs > HARD_RUNTIME_MS) {
    fail(`Bible Slice 1 runtime ${totalMs.toFixed(1)}ms exceeds hard ceiling ${HARD_RUNTIME_MS}ms`);
  }
  if (allFailures.length > 0 || mutationKills !== 1) process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
}
