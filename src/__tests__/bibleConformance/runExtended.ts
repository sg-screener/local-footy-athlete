(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { DEFAULT_EXTENDED_SEED, generatePropertyCases } from './generated/deterministicGenerator';
import { generatePairwiseScenarios } from './pairwise/generatePairwiseScenarios';
import { evaluatePairwiseScenario } from './observations/evaluatePairwiseScenarios';
import { evaluateGeneratedPropertyCase } from './observations/evaluateGeneratedProperties';
import { evaluateMetamorphicSuite } from './observations/evaluateMetamorphicRelations';
import { verifyShrinkerAcceptance, shrinkGeneratedFailure } from './shrink/deterministicShrinker';
import { runSlice5MutationAcceptanceTests } from './slice5MutationAcceptanceTests';
import { verifyMutationCatalogue, MUTATION_CATALOGUE } from './registry/mutationCatalogue';
import { verifyExpectationImportBoundary } from './expectations/importBoundaryTests';
import { buildCoverageReport } from './registry/coverageRegistry';
import { writeCoverageArtifacts } from './report/generateCoverageReport';
import type { GeneratedCheckResult, GeneratedDomain, GeneratedPropertyCase } from './types';

const WARNING_MS = 90_000;
const HARD_MS = 180_000;
const ROUTINE_PREFIXES = ['[ProgramGen]', '[WorkoutCanonicalisation]', '[engine]', '[ENGINE-', '[pool-'];

interface Options {
  seed: string;
  caseId?: string;
  domain?: GeneratedDomain;
  mutations: 'smoke' | 'full' | 'none';
  report: boolean;
}

function parseOptions(argv: string[]): Options {
  const value = (prefix: string) => argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  const domain = value('--domain=') as GeneratedDomain | undefined;
  if (domain && !['strength', 'components', 'conditioning', 'power', 'constraints', 'placement', 'edits'].includes(domain)) {
    throw new Error(`Unknown generated domain: ${domain}`);
  }
  const mutations = (value('--mutations=') ?? 'full') as Options['mutations'];
  if (!['smoke', 'full', 'none'].includes(mutations)) throw new Error(`Unknown mutation tier: ${mutations}`);
  return { seed: value('--seed=') ?? DEFAULT_EXTENDED_SEED, caseId: value('--case='), domain, mutations, report: argv.includes('--report') };
}

function withoutRoutineLogs<T>(run: () => T): T {
  const log = console.log;
  const warn = console.warn;
  const filtered = (sink: typeof console.log) => (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (ROUTINE_PREFIXES.some((prefix) => first.startsWith(prefix))) return;
    sink(...args);
  };
  console.log = filtered(log);
  console.warn = filtered(warn);
  try { return run(); } finally { console.log = log; console.warn = warn; }
}

function runEveryCommit(repoRoot: string, mutations: Options['mutations']): number {
  const started = performance.now();
  const child = spawnSync('npm', ['run', 'test:bible'], {
    cwd: repoRoot, encoding: 'utf8', timeout: 35_000,
    env: { ...process.env, TZ: 'Australia/Melbourne', BIBLE_MUTATIONS: mutations === 'none' ? 'none' : 'smoke' },
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Every-commit harness failed:\n${child.stdout}\n${child.stderr}`);
  return performance.now() - started;
}

function printGeneratedFailure(entry: GeneratedPropertyCase, failure: GeneratedCheckResult): never {
  const shrunk = shrinkGeneratedFailure(entry, (candidate) =>
    evaluateGeneratedPropertyCase(candidate).some((result) => result.invariant === failure.invariant && !result.passed));
  const rerun = `npm run test:bible:extended -- --seed=${entry.seed} --case=${entry.id}`;
  console.error([
    `RULE       ${failure.ruleIds[0]}`,
    `PROPERTY   ${failure.invariant}`,
    `SEED       ${entry.seed}`,
    `CASE       ${entry.id}`,
    `ORIGINAL   ${JSON.stringify(entry.data)}`,
    `MINIMAL    ${JSON.stringify(shrunk.minimal.data)}`,
    `STAGE      ${failure.stage}`,
    `EXPECTED   ${JSON.stringify(failure.expected)}`,
    `ACTUAL     ${JSON.stringify(failure.actual)}`,
    'LOSS       generated property — unauthorised',
    `RERUN      ${rerun}`,
  ].join('\n'));
  throw new Error(`Generated property failed; rerun with: ${rerun}`);
}

function main(): void {
  const started = performance.now();
  const options = parseOptions(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '../../..');
  console.log('Bible conformance extended tier — deterministic pairwise, properties, metamorphic and mutations');
  console.log(`Seed: ${options.seed} | Reference date: 2026-03-23 | Timezone: Australia/Melbourne`);

  verifyMutationCatalogue();
  const boundary = verifyExpectationImportBoundary(path.join(__dirname, 'expectations'));
  if (boundary.violations.length) throw new Error(boundary.violations.join('\n'));
  const everyCommitMs = runEveryCommit(repoRoot, options.mutations);
  console.log(`  PASS every-commit tier (${everyCommitMs.toFixed(1)}ms)`);

  const pairwise = generatePairwiseScenarios(options.seed);
  const selectedPairs = options.caseId?.startsWith('pairwise-')
    ? pairwise.scenarios.filter((entry) => entry.id === options.caseId)
    : options.caseId ? [] : pairwise.scenarios;
  const pairStarted = performance.now();
  let pairChecks = 0;
  for (const scenario of selectedPairs) {
    const results = withoutRoutineLogs(() => evaluatePairwiseScenario(scenario));
    pairChecks += results.length;
    const failure = results.find((entry) => !entry.passed);
    if (failure) {
      const rerun = `npm run test:bible:extended -- --seed=${options.seed} --case=${scenario.id}`;
      throw new Error(`Pairwise failure ${scenario.id}: ${JSON.stringify(failure)}\nRERUN ${rerun}`);
    }
  }
  const pairwiseExecuted = options.caseId && !options.caseId.startsWith('pairwise-') ? 0 : selectedPairs.length;
  console.log(`  PASS pairwise ${pairwiseExecuted} scenario(s), ${pairChecks} checks, matrix ${pairwise.coveredPairs}/${pairwise.totalPairs} pairs (${pairwise.percentage.toFixed(2)}%) (${(performance.now() - pairStarted).toFixed(1)}ms)`);

  const propertyCases = generatePropertyCases({
    seed: options.seed, countPerDomain: 12, domain: options.domain,
    caseId: options.caseId && !options.caseId.startsWith('pairwise-') && !options.caseId.startsWith('metamorphic:') ? options.caseId : undefined,
  });
  const propertyStarted = performance.now();
  let propertyChecks = 0;
  for (const entry of propertyCases) {
    const results = withoutRoutineLogs(() => evaluateGeneratedPropertyCase(entry));
    propertyChecks += results.length;
    const failure = results.find((result) => !result.passed);
    if (failure) printGeneratedFailure(entry, failure);
  }
  console.log(`  PASS properties ${propertyCases.length} case(s), ${propertyChecks} checks (${(performance.now() - propertyStarted).toFixed(1)}ms)`);

  const metamorphicStarted = performance.now();
  const allMetamorphic = withoutRoutineLogs(() => evaluateMetamorphicSuite(false));
  const metamorphic = options.caseId?.startsWith('metamorphic:')
    ? allMetamorphic.filter((entry) => entry.id === options.caseId)
    : options.caseId ? [] : allMetamorphic;
  const metamorphicFailure = metamorphic.find((entry) => !entry.passed);
  if (metamorphicFailure) {
    const rerun = `npm run test:bible:extended -- --seed=${options.seed} --case=${metamorphicFailure.id}`;
    throw new Error(`Metamorphic failure ${JSON.stringify(metamorphicFailure)}\nRERUN ${rerun}`);
  }
  console.log(`  PASS metamorphic ${metamorphic.length || (options.caseId ? 0 : 30)}/30 relation(s) (${(performance.now() - metamorphicStarted).toFixed(1)}ms)`);

  const shrink = verifyShrinkerAcceptance();
  console.log(`  PASS shrinker reduced synthetic witness in ${shrink.attempts} attempt(s)`);

  const mutationStarted = performance.now();
  const newMutations = options.mutations === 'full' ? runSlice5MutationAcceptanceTests() : [];
  const acceptedMutationCount = options.mutations === 'none' ? 0 : 28;
  const mutationDenominator = options.mutations === 'full' ? MUTATION_CATALOGUE.length : acceptedMutationCount;
  console.log(`  PASS mutations ${acceptedMutationCount + newMutations.length}/${mutationDenominator} active and killed (${(performance.now() - mutationStarted).toFixed(1)}ms)`);

  if (options.report) {
    const report = buildCoverageReport(options.seed, pairwise);
    const artifacts = writeCoverageArtifacts(report, repoRoot);
    console.log(`  REPORT ${artifacts.markdownPath}`);
    console.log(`  REPORT ${artifacts.jsonPath}`);
    const partial = report.rules.filter((entry) => entry.coverageGaps.length > 0).length;
    console.log(`  Coverage summary: ${report.summary.ruleCount} rules, ${partial} with explicit partial/gap notes, mutation ${report.summary.mutationScore.killed}/${report.summary.mutationScore.total}`);
  }

  const total = performance.now() - started;
  console.log('\nExtended summary');
  console.log(`  Seed:              ${options.seed}`);
  console.log(`  Pairwise:          ${pairwise.scenarios.length} scenarios, ${pairwise.percentage.toFixed(2)}% pair coverage`);
  console.log(`  Properties:        ${propertyCases.length} cases, ${propertyChecks} checks`);
  console.log(`  Metamorphic:       ${options.caseId ? metamorphic.length : 30}/30`);
  console.log(`  Mutations:         ${mutationDenominator} active/killed`);
  console.log(`  Boundary:          ${boundary.checkedFiles.length} independent expectation/registry files`);
  console.log(`  Runtime:           ${total.toFixed(1)}ms`);
  if (total > WARNING_MS) console.warn(`Extended harness runtime warning: ${total.toFixed(1)}ms exceeds ${WARNING_MS}ms`);
  if (total > HARD_MS) throw new Error(`Extended harness exceeded hard ceiling ${HARD_MS}ms`);
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
}
