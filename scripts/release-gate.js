#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { validateDecisions } = require('./test-truth-audit');

const REPO = path.resolve(__dirname, '..');
const RELEASE_SCRIPT = 'test:release';
const RELEASE_COMMAND = 'node scripts/release-gate.js';
const BOOTSTRAP_SCRIPT = 'test:test-truth';
const TYPECHECK_SCRIPT = 'test:compile';
const TYPECHECK_COMMAND = 'node scripts/typecheck-gate.js';
const FORBIDDEN_WITNESSES = new Set([
  RELEASE_SCRIPT,
  BOOTSTRAP_SCRIPT,
  TYPECHECK_SCRIPT,
  'test:bible',
  'test:bible:parallel',
  'test:bible:serial-set',
]);

function readJson(relativePath, repo = REPO) {
  return JSON.parse(fs.readFileSync(path.join(repo, relativePath), 'utf8'));
}

function deriveReleaseGate(pkg, decisionRegistry, repo = REPO) {
  if (pkg.scripts?.[RELEASE_SCRIPT] !== RELEASE_COMMAND) {
    throw new Error(`${RELEASE_SCRIPT} must be exactly '${RELEASE_COMMAND}'`);
  }
  if (pkg.scripts?.[TYPECHECK_SCRIPT] !== TYPECHECK_COMMAND) {
    throw new Error(`real typecheck ${TYPECHECK_SCRIPT} must be exactly '${TYPECHECK_COMMAND}'`);
  }
  const decisionErrors = validateDecisions(decisionRegistry, pkg, repo);
  if (decisionErrors.length > 0) {
    throw new Error(`invalid test-truth decisions:\n${decisionErrors.join('\n')}`);
  }

  const contracts = Object.entries(decisionRegistry.decisions)
    .filter(([, decision]) => decision.kind === 'current_contract')
    .map(([label, decision]) => ({
      label,
      witnessScript: decision.witnessScript,
      productionPaths: decision.productionPaths,
      contractRefs: decision.contractRefs,
    }));
  if (contracts.length === 0) {
    throw new Error('release gate has zero current contracts');
  }

  const witnesses = new Map();
  for (const contract of contracts) {
    const witness = contract.witnessScript;
    if (!/^test:[A-Za-z0-9:_-]+$/.test(witness)) {
      throw new Error(`${contract.label}: invalid witness command ${witness}`);
    }
    if (FORBIDDEN_WITNESSES.has(witness)) {
      throw new Error(`${contract.label}: infrastructure command ${witness} cannot witness product behaviour`);
    }
    const existing = witnesses.get(witness) || [];
    existing.push(contract.label);
    witnesses.set(witness, existing);
  }

  return {
    contracts,
    units: [
      {
        label: BOOTSTRAP_SCRIPT,
        role: 'test_infrastructure',
        contracts: [],
      },
      {
        label: TYPECHECK_SCRIPT,
        role: 'typecheck',
        contracts: [],
      },
      ...[...witnesses.entries()].map(([label, labels]) => ({
        label,
        role: 'current_contract',
        contracts: labels,
      })),
    ],
  };
}

function runUnits(units, execute) {
  const results = [];
  for (const unit of units) {
    const result = execute(unit);
    results.push({ ...unit, ...result });
    if (result.exit !== 0) break;
  }
  return {
    exit: results.length === units.length && results.every((result) => result.exit === 0) ? 0 : 1,
    results,
  };
}

function executeUnit(unit) {
  const started = Date.now();
  const child = spawnSync('npm', ['run', unit.label], {
    cwd: REPO,
    env: { ...process.env, TZ: 'Australia/Melbourne' },
    stdio: 'inherit',
  });
  return {
    exit: child.status === 0 ? 0 : 1,
    signal: child.signal || null,
    ms: Date.now() - started,
  };
}

function main(argv = process.argv.slice(2)) {
  const allowed = new Set(['--list']);
  const unknown = argv.filter((argument) => !allowed.has(argument));
  if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(', ')}`);

  const pkg = readJson('package.json');
  const decisionRegistry = readJson('scripts/test-truth-decisions.json');
  const gate = deriveReleaseGate(pkg, decisionRegistry);

  console.log(`RELEASE GATE SCOPE: ${gate.contracts.length} current product contracts + test-truth bootstrap + real all-scope typecheck.`);
  console.log('DIAGNOSTIC FLEET: excluded from release authority; run npm run test:bible or scripts/sweep.sh when investigating it.');
  if (argv.includes('--list')) {
    for (const unit of gate.units) {
      console.log(`${unit.role}\t${unit.label}\t${unit.contracts.join(',') || '-'}`);
    }
    console.log('RELEASE_GATE_EXIT=0');
    return 0;
  }

  const result = runUnits(gate.units, (unit) => {
    console.log(`\nRELEASE UNIT: ${unit.label} (${unit.role})`);
    return executeUnit(unit);
  });
  console.log(`\nRELEASE GATE RESULT: ${result.results.filter((item) => item.exit === 0).length}/${gate.units.length} units green.`);
  console.log(`RELEASE_GATE_EXIT=${result.exit}`);
  return result.exit;
}

module.exports = {
  BOOTSTRAP_SCRIPT,
  RELEASE_COMMAND,
  RELEASE_SCRIPT,
  deriveReleaseGate,
  runUnits,
};

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`RELEASE GATE REFUSED: ${error.message}`);
    console.error('RELEASE_GATE_EXIT=2');
    process.exitCode = 2;
  }
}
