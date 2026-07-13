(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { STRENGTH_BIBLE_RULES } from './expectations/strengthRules';
import { COMPONENT_BIBLE_RULES } from './expectations/componentRules';
import { SLICE3_BIBLE_RULES } from './expectations/slice3Rules';
import { SLICE4_BIBLE_RULES } from './expectations/slice4Rules';
import { verifyExpectationImportBoundary } from './expectations/importBoundaryTests';
import { STRENGTH_GOLDEN_SCENARIOS } from './scenarios/strengthGoldens';
import { COMPONENT_GOLDEN_SCENARIOS } from './scenarios/componentGoldens';
import { SLICE3_GOLDEN_SCENARIOS } from './scenarios/slice3Goldens';
import { SLICE4_GOLDEN_SCENARIOS } from './scenarios/slice4Goldens';
import { buildStrengthScenarioTrace } from './observations/buildStrengthTrace';
import { buildComponentScenarioTrace } from './observations/buildComponentTrace';
import { buildSlice3ScenarioTrace } from './observations/buildSlice3Trace';
import { buildSlice4ScenarioTrace } from './observations/buildSlice4Trace';
import {
  evaluateStrengthTrace,
  STRENGTH_INVARIANT_IDS,
} from './invariants/strengthIntentInvariants';
import {
  COMPONENT_INVARIANT_IDS,
  evaluateComponentTrace,
} from './invariants/sessionComponentInvariants';
import { evaluateSlice3Trace, SLICE3_INVARIANT_IDS } from './invariants/slice3Invariants';
import { evaluateSlice4Trace, SLICE4_INVARIANT_IDS } from './invariants/pathEquivalenceInvariants';
import { renderConformanceFailure } from './report/renderConformanceFailure';
import { runSmokeMutationGate } from './registry/mutationGate';
import { SMOKE_MUTATIONS } from './registry/mutationCatalogue';
import { evaluateMetamorphicSuite } from './observations/evaluateMetamorphicRelations';
import type {
  ComponentGoldenScenario,
  ComponentScenarioTrace,
  InvariantFailure,
  StrengthGoldenScenario,
  StrengthScenarioTrace,
  Slice3GoldenScenario,
  Slice3ScenarioTrace,
  Slice4GoldenScenario,
  Slice4ScenarioTrace,
  AllTraceStage,
} from './types';

const TARGET_RUNTIME_MS = 12_000;
const WARNING_RUNTIME_MS = 18_000;
const HARD_RUNTIME_MS = 30_000;
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
  if (COMPONENT_BIBLE_RULES.length !== 7) {
    fail(`Expected exactly seven Slice 2 component rules, found ${COMPONENT_BIBLE_RULES.length}`);
  }
  const componentIds = new Set(COMPONENT_BIBLE_RULES.map((rule) => rule.id));
  if (componentIds.size !== COMPONENT_BIBLE_RULES.length) fail('Component Bible rule IDs must be unique');
  for (const rule of COMPONENT_BIBLE_RULES) {
    if (!bible.includes(rule.anchorQuote)) {
      fail(`${rule.id} anchor quote is no longer present in the Programming Bible`);
    }
    if (rule.applicableScenarios.length === 0) fail(`${rule.id} has no declared golden scenario`);
  }
  if (SLICE3_BIBLE_RULES.length !== 22) {
    fail(`Expected exactly twenty-two Slice 3 Bible rules, found ${SLICE3_BIBLE_RULES.length}`);
  }
  const slice3Ids = new Set(SLICE3_BIBLE_RULES.map((rule) => rule.id));
  if (slice3Ids.size !== SLICE3_BIBLE_RULES.length) fail('Slice 3 Bible rule IDs must be unique');
  for (const rule of SLICE3_BIBLE_RULES) {
    if (!bible.includes(rule.anchorQuote)) {
      fail(`${rule.id} anchor quote is no longer present in the Programming Bible`);
    }
    if (rule.applicableScenarios.length === 0) fail(`${rule.id} has no declared golden scenario`);
  }
  if (SLICE4_BIBLE_RULES.length !== 20) {
    fail(`Expected exactly twenty Slice 4 Bible/canonical rules, found ${SLICE4_BIBLE_RULES.length}`);
  }
  const slice4Ids = new Set(SLICE4_BIBLE_RULES.map((rule) => rule.id));
  if (slice4Ids.size !== SLICE4_BIBLE_RULES.length) fail('Slice 4 rule IDs must be unique');
  for (const rule of SLICE4_BIBLE_RULES) {
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
  const componentReport = renderConformanceFailure({
    invariantId: 'INV_WEEK_DETAIL_COMPONENT_AGREEMENT',
    ruleId: 'ALL-COMP-PROJECTION-01',
    scenarioId: 'mixed-strength-aerobic',
    stage: 'visible_detail',
    expected: ['strength', 'conditioning'],
    actual: ['strength'],
    missing: ['conditioning'],
    extra: [],
    path: 'visible program projection',
    planEntryId: 'pe_monday_lower',
    weekComponents: ['strength', 'conditioning'],
    detailComponents: ['strength'],
  });
  for (const fragment of [
    'RULE      ALL-COMP-PROJECTION-01',
    'ENTRY     pe_monday_lower',
    'WEEK      [strength, conditioning]',
    'DETAIL    [strength]',
  ]) {
    if (!componentReport.includes(fragment)) fail(`Component failure renderer omitted: ${fragment}`);
  }
}

function withoutRoutineProductionLogs<T>(build: () => T): T {
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
    return build();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

function buildTraceWithoutRoutineProductionLogs(
  scenario: StrengthGoldenScenario,
): StrengthScenarioTrace {
  return withoutRoutineProductionLogs(() => buildStrengthScenarioTrace(scenario));
}

function buildComponentTraceWithoutRoutineProductionLogs(
  scenario: ComponentGoldenScenario,
): ComponentScenarioTrace {
  return withoutRoutineProductionLogs(() => buildComponentScenarioTrace(scenario));
}

function buildSlice3TraceWithoutRoutineProductionLogs(
  scenario: Slice3GoldenScenario,
): Slice3ScenarioTrace {
  return withoutRoutineProductionLogs(() => buildSlice3ScenarioTrace(scenario));
}

function buildSlice4TraceWithoutRoutineProductionLogs(
  scenario: Slice4GoldenScenario,
): Slice4ScenarioTrace {
  return withoutRoutineProductionLogs(() => buildSlice4ScenarioTrace(scenario));
}

function stageRank(stage: AllTraceStage): number {
  return [
    'allocation', 'generated_fallback', 'resolved_effective',
    'visible_week', 'visible_detail', 'weekly_accounting',
    'path_input', 'path_output', 'stored_before_rehydrate', 'rehydrated',
    'rehydrated_twice', 'post_rehydrate_edit', 'post_rehydrate_rebuild',
  ].indexOf(stage);
}

function main(): void {
  const startedAt = performance.now();
  const repoRoot = path.resolve(__dirname, '../../..');
  const expectationsDir = path.join(__dirname, 'expectations');

  console.log('Bible conformance harness — Slices 1–4 programming, write-path and persistence equivalence');
  console.log('Reference date: 2026-03-23 | Timezone: Australia/Melbourne');

  const boundary = verifyExpectationImportBoundary(expectationsDir);
  if (boundary.violations.length > 0) fail(boundary.violations.join('\n'));
  verifyRuleRegistry(repoRoot);
  verifyFailureRenderer();

  if (STRENGTH_GOLDEN_SCENARIOS.length !== 3) {
    fail(`Expected exactly three strength goldens, found ${STRENGTH_GOLDEN_SCENARIOS.length}`);
  }
  if (COMPONENT_GOLDEN_SCENARIOS.length !== 5) {
    fail(`Expected exactly five component goldens, found ${COMPONENT_GOLDEN_SCENARIOS.length}`);
  }
  if (SLICE3_GOLDEN_SCENARIOS.length !== 14) {
    fail(`Expected exactly fourteen Slice 3 goldens, found ${SLICE3_GOLDEN_SCENARIOS.length}`);
  }
  if (SLICE4_GOLDEN_SCENARIOS.length !== 13) {
    fail(`Expected exactly thirteen Slice 4 goldens, found ${SLICE4_GOLDEN_SCENARIOS.length}`);
  }

  const allFailures: InvariantFailure[] = [];
  const strengthAppliedInvariantIds = new Set<string>();
  const componentAppliedInvariantIds = new Set<string>();
  let strengthInvariantApplicationPasses = 0;
  let strengthInvariantApplications = 0;
  let componentInvariantApplicationPasses = 0;
  let componentInvariantApplications = 0;
  let strengthScenarioPasses = 0;
  let componentScenarioPasses = 0;
  const slice3AppliedInvariantIds = new Set<string>();
  let slice3InvariantApplicationPasses = 0;
  let slice3InvariantApplications = 0;
  let slice3ScenarioPasses = 0;
  const slice4AppliedInvariantIds = new Set<string>();
  let slice4InvariantApplicationPasses = 0;
  let slice4InvariantApplications = 0;
  let slice4ScenarioPasses = 0;
  let pathComparisons = 0;
  let persistenceRoundTrips = 0;
  let legacyMigrations = 0;

  for (const scenario of STRENGTH_GOLDEN_SCENARIOS) {
    if (scenario.referenceDate !== '2026-03-23' || scenario.timezone !== 'Australia/Melbourne') {
      fail(`${scenario.id} must own the fixed Slice 1 date and timezone`);
    }
    const trace = buildTraceWithoutRoutineProductionLogs(scenario);
    const results = evaluateStrengthTrace(trace);
    const failures = results.flatMap((result) => result.failures);
    for (const result of results) {
      if (!result.applied) continue;
      strengthAppliedInvariantIds.add(result.invariantId);
      strengthInvariantApplications++;
      if (result.failures.length === 0) strengthInvariantApplicationPasses++;
    }
    allFailures.push(...failures);
    if (failures.length === 0) strengthScenarioPasses++;
    console.log(`  ${failures.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} (${trace.runtimeMs.toFixed(1)}ms)`);
  }

  for (const scenario of COMPONENT_GOLDEN_SCENARIOS) {
    if (scenario.referenceDate !== '2026-03-23' || scenario.timezone !== 'Australia/Melbourne') {
      fail(`${scenario.id} must own the fixed Slice 2 date and timezone`);
    }
    const trace = buildComponentTraceWithoutRoutineProductionLogs(scenario);
    const results = evaluateComponentTrace(trace);
    const failures = results.flatMap((result) => result.failures);
    for (const entry of results) {
      if (!entry.applied) continue;
      componentAppliedInvariantIds.add(entry.invariantId);
      componentInvariantApplications++;
      if (entry.failures.length === 0) componentInvariantApplicationPasses++;
    }
    allFailures.push(...failures);
    if (failures.length === 0) componentScenarioPasses++;
    console.log(`  ${failures.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} (${trace.runtimeMs.toFixed(1)}ms)`);
  }

  for (const scenario of SLICE3_GOLDEN_SCENARIOS) {
    const expectedDate = scenario.id.startsWith('early-offseason-') && scenario.id !== 'early-offseason-healthy'
      ? '2026-07-13' : '2026-03-23';
    if (scenario.referenceDate !== expectedDate || scenario.timezone !== 'Australia/Melbourne') {
      fail(`${scenario.id} must own its fixed Slice 3 date and timezone`);
    }
    const trace = buildSlice3TraceWithoutRoutineProductionLogs(scenario);
    const results = evaluateSlice3Trace(trace);
    const failures = results.flatMap((entry) => entry.failures);
    for (const entry of results) {
      if (!entry.applied) continue;
      slice3AppliedInvariantIds.add(entry.invariantId);
      slice3InvariantApplications++;
      if (entry.failures.length === 0) slice3InvariantApplicationPasses++;
    }
    allFailures.push(...failures);
    if (failures.length === 0) slice3ScenarioPasses++;
    console.log(`  ${failures.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} (${trace.runtimeMs.toFixed(1)}ms)`);
  }

  for (const scenario of SLICE4_GOLDEN_SCENARIOS) {
    if (scenario.referenceDate !== '2026-03-23' || scenario.timezone !== 'Australia/Melbourne') {
      fail(`${scenario.id} must own the fixed Slice 4 date and timezone`);
    }
    const trace = buildSlice4TraceWithoutRoutineProductionLogs(scenario);
    const results = evaluateSlice4Trace(trace);
    const failures = results.flatMap((entry) => entry.failures);
    for (const entry of results) {
      if (!entry.applied) continue;
      slice4AppliedInvariantIds.add(entry.invariantId);
      slice4InvariantApplications++;
      pathComparisons++;
      if (entry.failures.length === 0) slice4InvariantApplicationPasses++;
    }
    persistenceRoundTrips += trace.observations.filter((entry) => entry.stage === 'rehydrated').length;
    if (scenario.id === 'legacy-program-rehydrate') legacyMigrations++;
    allFailures.push(...failures);
    if (failures.length === 0) slice4ScenarioPasses++;
    const pathTiming = trace.observations.map((entry) =>
      `${entry.pathId}:${entry.runtimeMs.toFixed(1)}ms`).join(', ');
    console.log(`  ${failures.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} (${trace.runtimeMs.toFixed(1)}ms; ${pathTiming})`);
  }

  const missingInvariantImplementations = STRENGTH_INVARIANT_IDS.filter(
    (id) => !strengthAppliedInvariantIds.has(id),
  );
  if (missingInvariantImplementations.length > 0) {
    fail(`Invariant(s) never applied: ${missingInvariantImplementations.join(', ')}`);
  }
  const missingComponentInvariantImplementations = COMPONENT_INVARIANT_IDS.filter(
    (id) => !componentAppliedInvariantIds.has(id),
  );
  if (missingComponentInvariantImplementations.length > 0) {
    fail(`Component invariant(s) never applied: ${missingComponentInvariantImplementations.join(', ')}`);
  }
  const missingSlice3InvariantImplementations = SLICE3_INVARIANT_IDS.filter(
    (id) => !slice3AppliedInvariantIds.has(id),
  );
  if (missingSlice3InvariantImplementations.length > 0) {
    fail(`Slice 3 invariant(s) never applied: ${missingSlice3InvariantImplementations.join(', ')}`);
  }
  const missingSlice4InvariantImplementations = SLICE4_INVARIANT_IDS.filter(
    (id) => !slice4AppliedInvariantIds.has(id),
  );
  if (missingSlice4InvariantImplementations.length > 0) {
    fail(`Slice 4 invariant(s) never applied: ${missingSlice4InvariantImplementations.join(', ')}`);
  }

  const coveredRules = new Set(STRENGTH_BIBLE_RULES.flatMap((rule) =>
    rule.applicableScenarios.filter((scenarioId) =>
      STRENGTH_GOLDEN_SCENARIOS.some((scenario) => scenario.id === scenarioId),
    ).length > 0 ? [rule.id] : [],
  ));
  const coveredComponentRules = new Set(COMPONENT_BIBLE_RULES.flatMap((rule) =>
    rule.applicableScenarios.some((scenarioId) =>
      COMPONENT_GOLDEN_SCENARIOS.some((scenario) => scenario.id === scenarioId)) ? [rule.id] : [],
  ));
  const coveredSlice3Rules = new Set(SLICE3_BIBLE_RULES.flatMap((rule) =>
    rule.applicableScenarios.some((scenarioId) =>
      SLICE3_GOLDEN_SCENARIOS.some((scenario) => scenario.id === scenarioId)) ? [rule.id] : [],
  ));
  const coveredSlice4Rules = new Set(SLICE4_BIBLE_RULES.flatMap((rule) =>
    rule.applicableScenarios.some((scenarioId) =>
      SLICE4_GOLDEN_SCENARIOS.some((scenario) => scenario.id === scenarioId)) ? [rule.id] : [],
  ));
  const failedRules = new Set(allFailures.map((failure) => failure.ruleId));
  const strengthRulePasses = Array.from(coveredRules).filter((ruleId) => !failedRules.has(ruleId)).length;
  const componentRulePasses = Array.from(coveredComponentRules).filter((ruleId) => !failedRules.has(ruleId)).length;
  const slice3RulePasses = Array.from(coveredSlice3Rules).filter((ruleId) => !failedRules.has(ruleId)).length;
  const slice4RulePasses = Array.from(coveredSlice4Rules).filter((ruleId) => !failedRules.has(ruleId)).length;
  const failedInvariants = new Set(allFailures.map((failure) => failure.invariantId));
  const strengthInvariantPasses = STRENGTH_INVARIANT_IDS.filter(
    (invariantId) => strengthAppliedInvariantIds.has(invariantId) && !failedInvariants.has(invariantId),
  ).length;
  const componentInvariantPasses = COMPONENT_INVARIANT_IDS.filter(
    (invariantId) => componentAppliedInvariantIds.has(invariantId) && !failedInvariants.has(invariantId),
  ).length;
  const slice3InvariantPasses = SLICE3_INVARIANT_IDS.filter(
    (invariantId) => slice3AppliedInvariantIds.has(invariantId) && !failedInvariants.has(invariantId),
  ).length;
  const slice4InvariantPasses = SLICE4_INVARIANT_IDS.filter(
    (invariantId) => slice4AppliedInvariantIds.has(invariantId) && !failedInvariants.has(invariantId),
  ).length;

  const metamorphicSmoke = withoutRoutineProductionLogs(() => evaluateMetamorphicSuite(true));
  const failedMetamorphicSmoke = metamorphicSmoke.filter((entry) => !entry.passed);
  if (failedMetamorphicSmoke.length > 0) {
    const first = failedMetamorphicSmoke[0];
    fail(`Metamorphic smoke ${first.id} failed: expected ${JSON.stringify(first.expected)}, actual ${JSON.stringify(first.actual)}`);
  }

  if (allFailures.length > 0) {
    const first = [...allFailures].sort((left, right) => stageRank(left.stage) - stageRank(right.stage))[0];
    console.error('\nFirst-divergence failure:');
    console.error(`\n${renderConformanceFailure(first)}`);
    if (allFailures.length > 1) {
      console.error(`\n${allFailures.length - 1} downstream failure(s) omitted.`);
    }
  }

  let mutationKills = 0;
  let mutationReports: string[] = [];
  const mutationMode = process.env.BIBLE_MUTATIONS ?? 'smoke';
  if (allFailures.length === 0 && mutationMode !== 'none') {
    const mutations = runSmokeMutationGate();
    mutationKills = mutations.filter((entry) => entry.killed).length;
    mutationReports = mutations.map((entry) => entry.report);
    for (const entry of mutations) console.log(`  PASS mutation ${entry.id} killed at ${entry.firstStage}`);
  }

  const totalMs = performance.now() - startedAt;
  const scenarioPasses = strengthScenarioPasses + componentScenarioPasses + slice3ScenarioPasses + slice4ScenarioPasses;
  const scenarioTotal = STRENGTH_GOLDEN_SCENARIOS.length + COMPONENT_GOLDEN_SCENARIOS.length + SLICE3_GOLDEN_SCENARIOS.length + SLICE4_GOLDEN_SCENARIOS.length;
  const rulePasses = strengthRulePasses + componentRulePasses + slice3RulePasses + slice4RulePasses;
  const ruleTotal = STRENGTH_BIBLE_RULES.length + COMPONENT_BIBLE_RULES.length + SLICE3_BIBLE_RULES.length + SLICE4_BIBLE_RULES.length;
  const mutationTotal = mutationMode === 'none' ? 0 : SMOKE_MUTATIONS.length;
  console.log('\nSummary');
  console.log(`  Scenarios:         ${scenarioPasses}/${scenarioTotal} (strength ${strengthScenarioPasses}/${STRENGTH_GOLDEN_SCENARIOS.length}, component ${componentScenarioPasses}/${COMPONENT_GOLDEN_SCENARIOS.length}, Slice 3 ${slice3ScenarioPasses}/${SLICE3_GOLDEN_SCENARIOS.length}, Slice 4 ${slice4ScenarioPasses}/${SLICE4_GOLDEN_SCENARIOS.length})`);
  console.log(`  Rules:             ${rulePasses}/${ruleTotal}`);
  console.log(`  Strength rules:    ${strengthRulePasses}/${STRENGTH_BIBLE_RULES.length}`);
  console.log(`  Component rules:   ${componentRulePasses}/${COMPONENT_BIBLE_RULES.length}`);
  console.log(`  Conditioning rules:${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'conditioning' && !failedRules.has(rule.id)).length}/${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'conditioning').length}`);
  console.log(`  Power rules:       ${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'power' && !failedRules.has(rule.id)).length}/${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'power').length}`);
  console.log(`  Spacing rules:     ${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'spacing' && !failedRules.has(rule.id)).length}/${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'spacing').length}`);
  console.log(`  Constraint rules:  ${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'constraint' && !failedRules.has(rule.id)).length}/${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'constraint').length}`);
  console.log(`  Exposure rules:    ${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'exposure' && !failedRules.has(rule.id)).length}/${SLICE3_BIBLE_RULES.filter((rule) => rule.category === 'exposure').length}`);
  console.log(`  Equivalence rules: ${slice4RulePasses}/${SLICE4_BIBLE_RULES.length}`);
  console.log(`  Strength invariants:  ${strengthInvariantPasses}/${STRENGTH_INVARIANT_IDS.length} (${strengthInvariantApplicationPasses}/${strengthInvariantApplications} applications)`);
  console.log(`  Component invariants: ${componentInvariantPasses}/${COMPONENT_INVARIANT_IDS.length} (${componentInvariantApplicationPasses}/${componentInvariantApplications} applications)`);
  console.log(`  Slice 3 invariants:   ${slice3InvariantPasses}/${SLICE3_INVARIANT_IDS.length} (${slice3InvariantApplicationPasses}/${slice3InvariantApplications} applications)`);
  console.log(`  Slice 4 invariants:   ${slice4InvariantPasses}/${SLICE4_INVARIANT_IDS.length} (${slice4InvariantApplicationPasses}/${slice4InvariantApplications} applications)`);
  console.log(`  Path comparisons:  ${pathComparisons}`);
  console.log(`  Persistence:       ${persistenceRoundTrips} round trip(s), ${legacyMigrations} legacy migration(s)`);
  console.log(`  Metamorphic smoke: ${metamorphicSmoke.length}/${metamorphicSmoke.length}`);
  console.log(`  Mutations:         ${mutationTotal} injected, ${mutationKills} active, ${mutationKills}/${mutationTotal} killed`);
  console.log(`  Boundary:   ${boundary.checkedFiles.length} expectation file(s), 0 forbidden imports`);
  console.log(`  Runtime:    ${totalMs.toFixed(1)}ms (target <${TARGET_RUNTIME_MS}ms)`);
  console.log('  Deferred:   Team Training rendering log-button/startFinished baseline remains outside the executable harness');

  if (mutationReports.length > 0) {
    console.log('\nMutation first-divergence proofs');
    for (const report of mutationReports) console.log(`\n${report}`);
  }
  if (totalMs > WARNING_RUNTIME_MS) {
    console.warn(`Bible harness runtime warning: ${totalMs.toFixed(1)}ms exceeds ${WARNING_RUNTIME_MS}ms`);
  }
  if (totalMs > HARD_RUNTIME_MS) {
    fail(`Bible harness runtime ${totalMs.toFixed(1)}ms exceeds hard ceiling ${HARD_RUNTIME_MS}ms`);
  }
  if (allFailures.length > 0 || mutationKills !== mutationTotal) process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
}
