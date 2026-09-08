(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

const {
  BOOTSTRAP_SCRIPT,
  RELEASE_COMMAND,
  RELEASE_SCRIPT,
  deriveReleaseGate,
  runUnits,
} = require('../../scripts/release-gate');

const ROOT = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'scripts/test-truth-decisions.json'),
  'utf8',
));

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

function refused(body: () => unknown, pattern: RegExp): boolean {
  try {
    body();
    return false;
  } catch (error) {
    return pattern.test(error instanceof Error ? error.message : String(error));
  }
}

function documentsCanonicalGate(source: string): boolean {
  return source.includes('| release gate | `npm run test:release`')
    && source.includes('`npm run test:bible` is historical diagnostic evidence')
    && source.includes('has no release authority');
}

console.log('releaseGateContractTests');

const gate = deriveReleaseGate(pkg, registry, ROOT);
const currentContracts = Object.entries(registry.decisions)
  .filter(([, decision]: [string, any]) => decision.kind === 'current_contract');
const expectedWitnesses = new Set(currentContracts.map(([, decision]: [string, any]) =>
  decision.witnessScript));
const actualWitnesses = new Set(gate.units
  .filter((unit: any) => unit.role === 'current_contract')
  .map((unit: any) => unit.label));

function foundationsBeforeYear(units: Array<{ label: string }>): boolean {
  const year = units.findIndex(unit => unit.label === 'test:compiler-year');
  return year >= 0 && ['test:weekly-writer-zero', 'test:leg-programming', 'test:canonical-weekly-compiler']
    .every(label => {
      const index = units.findIndex(unit => unit.label === label);
      return index >= 2 && index < year;
    });
}
function uniqueWitnesses(units: Array<{ label: string; role: string }>): boolean {
  const labels = units.filter(unit => unit.role === 'current_contract').map(unit => unit.label);
  return new Set(labels).size === labels.length;
}
ok('ownership and focused programming checks precede the annual replay', foundationsBeforeYear(gate.units));
const withoutLeg = gate.units.filter((unit: any) => unit.label !== 'test:leg-programming');
const legUnit = gate.units.find((unit: any) => unit.label === 'test:leg-programming');
ok('liveness: a missing or delayed programming prerequisite fails the order check',
  !!legUnit && !foundationsBeforeYear(withoutLeg) && !foundationsBeforeYear([...withoutLeg, legUnit]));
ok('reordering keeps each validated witness exactly once', uniqueWitnesses(gate.units));
ok('liveness: a duplicated witness fails the uniqueness check',
  !!legUnit && !uniqueWitnesses([...gate.units, legUnit]));

ok('the release command has one canonical owner',
  RELEASE_SCRIPT === 'test:release'
    && RELEASE_COMMAND === 'node scripts/release-gate.js'
    && pkg.scripts[RELEASE_SCRIPT] === RELEASE_COMMAND,
  pkg.scripts[RELEASE_SCRIPT]);
const agentContract = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
ok('the agent command table names release and diagnostic authority honestly',
  documentsCanonicalGate(agentContract));
ok('liveness: removing the canonical command from the agent contract is detected',
  !documentsCanonicalGate(agentContract.replace('npm run test:release', 'npm run test:bible')));
ok('the gate starts with test truth and carries no diagnostic-fleet command',
  gate.units[0]?.label === BOOTSTRAP_SCRIPT
    && gate.units.every((unit: any) => !/^test:bible(?::|$)/.test(unit.label))
    && pkg.scripts[BOOTSTRAP_SCRIPT].split(' && ').includes('npm run test:year-diff'),
  gate.units);
ok('the real all-scope typecheck runs after bootstrap, before product witnesses',
  gate.units[1]?.label === 'test:compile'
    && gate.units.filter((unit: any) => unit.label === 'test:compile').length === 1,
  gate.units);
const missingTypecheck = JSON.parse(JSON.stringify(pkg));
delete missingTypecheck.scripts['test:compile'];
ok('liveness: missing or redirected real typecheck refuses release',
  refused(() => deriveReleaseGate(missingTypecheck, registry, ROOT), /real typecheck/)
    && refused(() => deriveReleaseGate({ ...pkg, scripts: { ...pkg.scripts,
      'test:compile': 'node scripts/test-typecheck-gate.js' } }, registry, ROOT), /real typecheck/));
const typecheckRed = runUnits(gate.units, (unit: any) => ({
  exit: unit.label === 'test:compile' ? 1 : 0, ms: 1,
}));
ok('liveness: an actual typecheck failure blocks all product witnesses',
  typecheckRed.exit === 1 && typecheckRed.results.length === 2
    && typecheckRed.results[1].label === 'test:compile');
ok('every validated current contract contributes its witness automatically',
  currentContracts.length > 0
    && expectedWitnesses.size === actualWitnesses.size
    && [...expectedWitnesses].every((label) => actualWitnesses.has(label)),
  { contracts: currentContracts.length, expectedWitnesses, actualWitnesses });
ok('no rewrite, retirement, aggregate or tooling row enters the release gate',
  gate.units.slice(1).every((unit: any) =>
    unit.contracts.every((label: string) => registry.decisions[label].kind === 'current_contract')),
  gate.units);

const invalidPromotion = JSON.parse(JSON.stringify(registry));
invalidPromotion.decisions['test:weekly-scheduler'] = {
  kind: 'current_contract',
  reason: 'mutation tries to promote an old red without current receipts',
  productionPaths: [],
  contractRefs: [],
  witnessScript: 'test:weekly-scheduler',
};
ok('liveness: an unevidenced promotion makes the release gate refuse to start',
  refused(() => deriveReleaseGate(pkg, invalidPromotion, ROOT), /invalid test-truth decisions/));

const recursiveWitness = JSON.parse(JSON.stringify(registry));
recursiveWitness.decisions['test:deriving-device-commit'].witnessScript = 'test:release';
ok('liveness: infrastructure cannot masquerade as a product witness',
  refused(() => deriveReleaseGate(pkg, recursiveWitness, ROOT), /infrastructure command/));

const redirectedPackage = JSON.parse(JSON.stringify(pkg));
redirectedPackage.scripts['test:release'] = 'npm run test:bible';
ok('liveness: redirecting release back to the red diagnostic fleet is refused',
  refused(() => deriveReleaseGate(redirectedPackage, registry, ROOT), /must be exactly/));

const reached: string[] = [];
const stopped = runUnits(gate.units, (unit: any) => {
  reached.push(unit.label);
  return { exit: reached.length === 2 ? 1 : 0, ms: 1 };
});
ok('liveness: the runner stops on the first red unit and returns red',
  stopped.exit === 1 && reached.length === 2 && stopped.results.length === 2,
  { reached, stopped });

const completed = runUnits(gate.units, () => ({ exit: 0, ms: 1 }));
ok('the runner is green only after every derived unit is green',
  completed.exit === 0 && completed.results.length === gate.units.length,
  completed);

console.log(`\nreleaseGateContractTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
