import path from 'node:path';
import { generatePairwiseScenarios } from './pairwise/generatePairwiseScenarios';
import { generatePropertyCases } from './generated/deterministicGenerator';
import { verifyShrinkerAcceptance } from './shrink/deterministicShrinker';
import { MUTATION_CATALOGUE, SMOKE_MUTATIONS, verifyMutationCatalogue } from './registry/mutationCatalogue';
import { buildCoverageReport } from './registry/coverageRegistry';
import { renderCoverageMarkdown } from './report/generateCoverageReport';
import { verifyExpectationImportBoundary } from './expectations/importBoundaryTests';

let passed = 0;
function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed++;
  console.log(`  PASS ${label}`);
}

const seed = '20260323';
const pairA = generatePairwiseScenarios(seed);
const pairB = generatePairwiseScenarios(seed);
check('pairwise generation is seed-deterministic', JSON.stringify(pairA) === JSON.stringify(pairB));
check('pairwise matrix stays in the bounded 40-80 range', pairA.scenarios.length >= 40 && pairA.scenarios.length <= 80);
check('pairwise matrix covers every supported pair', pairA.percentage === 100 && pairA.coveredPairs === pairA.totalPairs);

const propertiesA = generatePropertyCases({ seed, countPerDomain: 12 });
const propertiesB = generatePropertyCases({ seed, countPerDomain: 12 });
check('property generation is seed-deterministic', JSON.stringify(propertiesA) === JSON.stringify(propertiesB));
check('all seven property domains generate twelve cases', propertiesA.length === 84);
check('single-case reproduction selects exactly one case', generatePropertyCases({ seed, caseId: 'conditioning-03' }).length === 1);

const shrink = verifyShrinkerAcceptance();
check('shrinker returns a smaller same-failure witness', shrink.reduced);

verifyMutationCatalogue();
check('mutation registry preserves 49 accepted smoke probes', SMOKE_MUTATIONS.length === 49);
check('mutation registry adds twelve full probes', MUTATION_CATALOGUE.length === 61);

const reportA = buildCoverageReport(seed, pairA);
const reportB = buildCoverageReport(seed, pairB);
check('coverage JSON model is deterministic', JSON.stringify(reportA) === JSON.stringify(reportB));
check('coverage registry has 53 rules and no missing mutation rationale', reportA.rules.length === 53 && reportA.rules.every((rule) => rule.mutationIds.length > 0 || rule.exemptions.length > 0));
check('coverage Markdown is deterministic', renderCoverageMarkdown(reportA) === renderCoverageMarkdown(reportB));

const boundary = verifyExpectationImportBoundary(path.join(__dirname, 'expectations'));
check('expectation/property/metamorphic/registry import fence is clean', boundary.violations.length === 0);

console.log(`\nslice5InfrastructureTests: ${passed} passed, 0 failed`);
