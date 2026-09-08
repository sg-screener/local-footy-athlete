(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

const {
  buildAudit,
  classifyFailure,
  deriveChainInventory,
  formatAudit,
  validateDecisions,
} = require('../../scripts/test-truth-audit');

const ROOT = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'scripts/test-truth-baseline.json'),
  'utf8',
));
const unrunnableBaseline = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'scripts/unrunnable-suite-baseline.json'),
  'utf8',
));
const decisionRegistry = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'scripts/test-truth-decisions.json'),
  'utf8',
));
const emptyRegistry = { schemaVersion: 1, decisions: {} };

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
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
}

console.log('testTruthAuditTests');

const inventory = deriveChainInventory(pkg);
ok('the truth audit is the first unit in the diagnostic fleet',
  inventory.units[0]?.label === 'test:test-truth',
  inventory.units.slice(0, 3).map((unit: { label: string }) => unit.label));
ok('the audit derives the large chain instead of transcribing a second suite list',
  inventory.units.length > 300 && inventory.duplicateLabels.length === 0,
  { units: inventory.units.length, duplicates: inventory.duplicateLabels });
ok('the diagnostic fleet contains no missing commands',
  inventory.missingChainScripts.length === 0,
  inventory.missingChainScripts);
ok('the diagnostic fleet contains no chain-runner aggregates',
  inventory.chainRunnerAggregates.length === 0,
  inventory.chainRunnerAggregates);

const audit = buildAudit({
  pkg,
  baseline,
  decisionRegistry: emptyRegistry,
  repo: ROOT,
  unrunnableBaseline,
});
ok('known structural debt is visible without making the audit itself red',
  audit.ok && audit.structuralDebt.missingChainScripts.current.length === 0
    && audit.structuralDebt.chainRunnerAggregates.current.length === 0
    && audit.unrunnableSuiteBaseline.count === 0,
  audit.faults);

const inventedPackage = JSON.parse(JSON.stringify(pkg));
inventedPackage.scripts['test:bible'] += ' && npm run test:new-ghost-suite';
const mutationAudit = buildAudit({
  pkg: inventedPackage,
  baseline,
  decisionRegistry: emptyRegistry,
  repo: ROOT,
  unrunnableBaseline,
});
ok('liveness: a newly missing command makes the audit red',
  !mutationAudit.ok
    && mutationAudit.faults.includes('new missing chain script: test:new-ghost-suite'),
  mutationAudit.faults);

const unreviewed = classifyFailure('test:weekly-scheduler', inventory, {}, pkg, ROOT);
ok('an unreviewed assertion failure cannot direct a product-code change',
  unreviewed.kind === 'unreviewed_failure'
    && unreviewed.blocksOfficialChain
    && !unreviewed.mayDirectProductCodeChange,
  unreviewed);

const inventedInventory = deriveChainInventory(inventedPackage);
const structural = classifyFailure('test:new-ghost-suite', inventedInventory, {
  'test:new-ghost-suite': {
    kind: 'current_contract',
    reason: 'an attempted invalid promotion',
  },
}, inventedPackage, ROOT);
ok('structural faults cannot be promoted into product verdicts by a decision row',
  structural.kind === 'test_infrastructure' && !structural.mayDirectProductCodeChange,
  structural);

const invalidRegistry = {
  schemaVersion: 1,
  decisions: {
    'test:weekly-scheduler': {
      kind: 'current_contract',
      reason: 'claims current authority without any receipts',
      productionPaths: [],
      contractRefs: [],
      witnessScript: 'test:not-real',
    },
  },
};
const invalidErrors = validateDecisions(invalidRegistry, pkg, ROOT);
const invalidCurrent = classifyFailure(
  'test:weekly-scheduler',
  inventory,
  invalidRegistry.decisions,
  pkg,
  ROOT,
);
ok('a current-contract decision without product, contract and witness receipts is refused',
  invalidErrors.length === 3
    && invalidCurrent.kind === 'invalid_decision'
    && !invalidCurrent.mayDirectProductCodeChange,
  { invalidErrors, invalidCurrent });

const validRegistry = {
  schemaVersion: 1,
  decisions: {
    'test:law-registry': {
      kind: 'current_contract',
      reason: 'the live law register is the current production subject',
      productionPaths: ['src/rules/lawRegistry.ts'],
      contractRefs: ['LAW-L14-domain-purity'],
      witnessScript: 'test:law-registry',
    },
  },
};
const validErrors = validateDecisions(validRegistry, pkg, ROOT);
const current = classifyFailure('test:law-registry', inventory, validRegistry.decisions, pkg, ROOT);
ok('only a fully evidenced current-contract decision may direct product work',
  validErrors.length === 0
    && current.kind === 'current_contract'
    && current.mayDirectProductCodeChange,
  { validErrors, current });

const invalidRetirement = {
  schemaVersion: 1,
  decisions: {
    'test:weekly-scheduler': {
      kind: 'retire_test',
      reason: 'tries to retire a suite without actually replacing it',
      retiredTestPaths: ['src/__tests__/weeklySchedulerTests.ts'],
      replacementScripts: ['test:not-real'],
    },
  },
};
const invalidRetirementErrors = validateDecisions(invalidRetirement, pkg, ROOT);
ok('liveness: retirement is refused while the old test exists or its replacement is absent',
  invalidRetirementErrors.length === 2
    && invalidRetirementErrors.some((error: string) => error.includes('retired test still exists'))
    && invalidRetirementErrors.some((error: string) => error.includes('replacementScripts')),
  invalidRetirementErrors);

const decisionErrors = validateDecisions(decisionRegistry, pkg, ROOT);
const censusCounts = Object.values(
  decisionRegistry.decisions as Record<string, { kind: string }>,
).reduce<Record<string, number>>(
  (counts, decision) => {
    counts[decision.kind] = (counts[decision.kind] || 0) + 1;
    return counts;
  },
  {},
);
ok('the measured failure census has a valid decision for every reviewed label',
  decisionRegistry.measuredCheckpoint === 'aa2167e2'
    // 193 measured rows + 3 guards promoted 2026-09-03 (seat censusaudit):
    // block-selection-authority, programming-selection-trace-observer,
    // legality-enforcer-liveness. + 1 on 2026-09-03 (seat integrate, R-363):
    // injury-matrix-sheet is release unit 31. Two additional rows hold the
    // empty-day screen journey and Coach bundle; settings is promoted in place.
    // R-383 adds the full annual repair journey witness.
    // R-380 adds the soreness witness; R-381 adds four-week preparation; R-382 adds dated conditioning access.
    // R-387 adds the manual Add, dose, dumbbell and retained-game repair witness.
    // R-389 adds the next-day Speed dose and placement witness.
    && Object.keys(decisionRegistry.decisions).length === 208
    && decisionErrors.length === 0,
  { checkpoint: decisionRegistry.measuredCheckpoint, decisionErrors });
ok('only witnessed contracts and the explicit ownership/year acceptance requirements can direct product work',
  censusCounts.current_contract === 46
    && ['test:undo-reversal', 'test:injury-recomposition', 'test:deload-law',
      'test:block-two-progression', 'test:strength-progression-inputs', 'test:training-logging',
      'test:readiness-load-retention', 'test:session-change-durability',
      'test:injury-fallback-journey', 'test:coach-weekly-reduction',
      'test:approved-icons', 'test:session-execution',
      'test:slot-coverage', 'test:power-counting', 'test:section18-v2', 'test:exercise-intake',
      'test:estimated-1rm', 'test:lived-history-foundations', 'test:session-section-add',
      'test:block-selection-authority', 'test:programming-selection-trace-observer',
      'test:legality-enforcer-liveness', 'test:injury-matrix-sheet',
      'test:settings-persistence', 'test:rest-day-reason', 'test:coach-chat-integration',
      'test:progression-dose-ownership', 'test:offseason-preparation', 'test:conditioning-gym-access', 'test:annual-audit-repairs', 'test:annual-audit-second-repairs', 'test:saturday-speed', 'test:full-body-erg-rest', 'test:whole-week-planning']
      .every(label => decisionRegistry.decisions[label]?.kind === 'current_contract'
        && decisionRegistry.decisions[label]?.witnessScript === label)
    && ['test:athlete-session-deletion', 'test:program-hydration-ownership',
      'test:fixture-mutation-transaction', 'test:temporary-source-facts']
      .every(label => decisionRegistry.decisions[label]?.witnessScript === 'test:canonical-weekly-compiler')
    && decisionRegistry.decisions['test:chained-mutation-continuity']?.witnessScript === 'test:compiler-year'
    && decisionRegistry.decisions['test:compiler-year']?.witnessScript === 'test:compiler-year'
    && decisionRegistry.decisions['test:weekly-writer-zero']?.witnessScript === 'test:weekly-writer-zero'
    && censusCounts.retire_test === 6
    && ['test:exercise-add-candidates', 'test:exercise-swap-choices'].every(label =>
      decisionRegistry.decisions[label]?.kind === 'retire_test'
      && decisionRegistry.decisions[label]?.replacementScripts?.includes('test:exercise-intake'))
    && decisionRegistry.decisions['test:game-local-rebuild']?.kind === 'retire_test'
    && decisionRegistry.decisions['test:dev-e2e-seeds']?.kind === 'test_infrastructure'
    && censusCounts.test_infrastructure === 4
    && decisionRegistry.decisions['test:plan-change-producer']?.kind === 'aggregate'
    && censusCounts.aggregate === 5
    && censusCounts.rewrite_test === 147,
  censusCounts);

const reportAudit = buildAudit({
  pkg: inventedPackage,
  baseline,
  decisionRegistry: emptyRegistry,
  failureLabels: ['test:new-ghost-suite', 'test:weekly-scheduler'],
  repo: ROOT,
  unrunnableBaseline,
});
const report = formatAudit(reportAudit);
ok('the human report states the boundary and counts classifications',
  report.includes('not permission to change product behaviour')
    && report.includes('test_infrastructure=1')
    && report.includes('unreviewed_failure=1')
    && report.includes('Failures allowed to direct product-code changes: 0.'),
  report);

console.log(`\ntestTruthAuditTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
