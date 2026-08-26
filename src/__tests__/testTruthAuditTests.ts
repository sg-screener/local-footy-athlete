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
ok('the truth audit is the first unit in the official chain',
  inventory.units[0]?.label === 'test:test-truth',
  inventory.units.slice(0, 3).map((unit: { label: string }) => unit.label));
ok('the audit derives the large chain instead of transcribing a second suite list',
  inventory.units.length > 300 && inventory.duplicateLabels.length === 0,
  { units: inventory.units.length, duplicates: inventory.duplicateLabels });
ok('missing commands are separated from product assertions',
  JSON.stringify(inventory.missingChainScripts) === JSON.stringify([
    'test:exposure-engine-priority',
    'test:in-season-midweek-row-verification',
  ]),
  inventory.missingChainScripts);
ok('chain-runner aggregates are separated from individual suite verdicts',
  JSON.stringify(inventory.chainRunnerAggregates) === JSON.stringify([
    'test:bible:parallel',
    'test:bible:serial-set',
  ]),
  inventory.chainRunnerAggregates);

const audit = buildAudit({
  pkg,
  baseline,
  decisionRegistry: emptyRegistry,
  repo: ROOT,
  unrunnableBaseline,
});
ok('known structural debt is visible without making the audit itself red',
  audit.ok && audit.structuralDebt.missingChainScripts.current.length === 2
    && audit.structuralDebt.chainRunnerAggregates.current.length === 2
    && audit.unrunnableSuiteBaseline.count === 6,
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

const unreviewed = classifyFailure('test:weekly-scheduler', inventory, {});
ok('an unreviewed assertion failure cannot direct a product-code change',
  unreviewed.kind === 'unreviewed_failure'
    && unreviewed.blocksOfficialChain
    && !unreviewed.mayDirectProductCodeChange,
  unreviewed);

const structural = classifyFailure('test:exposure-engine-priority', inventory, {
  'test:exposure-engine-priority': {
    kind: 'current_contract',
    reason: 'an attempted invalid promotion',
  },
});
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
ok('a current-contract decision without product, contract and witness receipts is refused',
  invalidErrors.length === 3,
  invalidErrors);

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
const current = classifyFailure('test:law-registry', inventory, validRegistry.decisions);
ok('only a fully evidenced current-contract decision may direct product work',
  validErrors.length === 0
    && current.kind === 'current_contract'
    && current.mayDirectProductCodeChange,
  { validErrors, current });

const reportAudit = buildAudit({
  pkg,
  baseline,
  decisionRegistry: emptyRegistry,
  failureLabels: ['test:exposure-engine-priority', 'test:weekly-scheduler'],
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
