#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'test-truth-baseline.json');
const DECISIONS_PATH = path.join(__dirname, 'test-truth-decisions.json');
const UNRUNNABLE_BASELINE_PATH = path.join(__dirname, 'unrunnable-suite-baseline.json');

const DECISION_KINDS = new Set([
  'current_contract',
  'rewrite_test',
  'retire_test',
  'test_infrastructure',
  'aggregate',
]);

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deriveChainInventory(pkg) {
  const chain = pkg.scripts && pkg.scripts['test:bible'];
  if (typeof chain !== 'string' || !chain.trim()) {
    throw new Error('package.json has no non-empty test:bible script');
  }

  const commands = chain.split('&&').map((part) => part.trim()).filter(Boolean);
  const units = commands.map((command, index) => {
    const match = command.match(/^npm run (test:[A-Za-z0-9:_-]+)$/);
    if (match) return { index, label: match[1], command, scripted: true };
    const file = command.match(/([A-Za-z0-9_.-]+)\.ts\b/);
    return {
      index,
      label: file ? `chain:${file[1]}` : `chain:${index}`,
      command,
      scripted: false,
    };
  });

  const duplicateLabels = [...new Set(units
    .map((unit) => unit.label)
    .filter((label, index, labels) => labels.indexOf(label) !== index))].sort();
  const missingChainScripts = units
    .filter((unit) => unit.scripted && !pkg.scripts[unit.label])
    .map((unit) => unit.label)
    .sort();
  const chainRunnerAggregates = units
    .filter((unit) => unit.scripted
      && /(?:^|\s)node\s+scripts\/bible-runner\.js\b/.test(pkg.scripts[unit.label] || ''))
    .map((unit) => unit.label)
    .sort();

  return { units, duplicateLabels, missingChainScripts, chainRunnerAggregates };
}

function compareDebt(current, baseline) {
  const currentSet = new Set(current);
  const baselineSet = new Set(baseline);
  return {
    current,
    newItems: current.filter((item) => !baselineSet.has(item)),
    resolvedItems: baseline.filter((item) => !currentSet.has(item)),
  };
}

function contractReferenceExists(reference, repo = REPO) {
  if (/^LAW-[A-Za-z0-9-]+$/.test(reference)) {
    const source = fs.readFileSync(path.join(repo, 'src/rules/lawRegistry.ts'), 'utf8');
    return source.includes(`id: '${reference}'`);
  }
  if (/^R-\d{3}$/.test(reference)) {
    const source = fs.readFileSync(path.join(repo, 'docs/RULINGS_REGISTRY.md'), 'utf8');
    return new RegExp(`\\b${reference}\\b`).test(source);
  }
  if (/^docs\/[A-Za-z0-9_./-]+(?:#[A-Za-z0-9_.-]+)?$/.test(reference)) {
    return fs.existsSync(path.join(repo, reference.split('#')[0]));
  }
  return false;
}

function validateDecisions(registry, pkg, repo = REPO) {
  const errors = [];
  if (!registry || registry.schemaVersion !== 1 || !registry.decisions
      || typeof registry.decisions !== 'object' || Array.isArray(registry.decisions)) {
    return ['decision registry must have schemaVersion 1 and a decisions object'];
  }

  for (const [label, decision] of Object.entries(registry.decisions)) {
    if (!pkg.scripts[label]) errors.push(`${label}: no package.json script exists`);
    if (!decision || !DECISION_KINDS.has(decision.kind)) {
      errors.push(`${label}: unknown decision kind ${decision && decision.kind}`);
      continue;
    }
    if (typeof decision.reason !== 'string' || decision.reason.trim().length < 12) {
      errors.push(`${label}: reason must explain the decision`);
    }
    if (decision.kind !== 'current_contract') continue;

    if (!Array.isArray(decision.productionPaths) || decision.productionPaths.length === 0) {
      errors.push(`${label}: current_contract needs at least one production path`);
    } else {
      for (const relativePath of decision.productionPaths) {
        const isProduction = typeof relativePath === 'string'
          && /^src\//.test(relativePath)
          && !/^src\/__tests__\//.test(relativePath)
          && fs.existsSync(path.join(repo, relativePath));
        if (!isProduction) errors.push(`${label}: invalid production path ${relativePath}`);
      }
    }
    if (!Array.isArray(decision.contractRefs) || decision.contractRefs.length === 0) {
      errors.push(`${label}: current_contract needs a current contract reference`);
    } else {
      for (const reference of decision.contractRefs) {
        if (!contractReferenceExists(reference, repo)) {
          errors.push(`${label}: unresolved contract reference ${reference}`);
        }
      }
    }
    if (typeof decision.witnessScript !== 'string' || !pkg.scripts[decision.witnessScript]) {
      errors.push(`${label}: current_contract needs an existing witnessScript`);
    }
  }
  return errors;
}

function classifyFailure(label, inventory, decisions) {
  if (inventory.missingChainScripts.includes(label)) {
    return {
      label,
      kind: 'test_infrastructure',
      blocksOfficialChain: true,
      mayDirectProductCodeChange: false,
      reason: 'the chain names a command that does not exist',
    };
  }
  if (inventory.chainRunnerAggregates.includes(label)) {
    return {
      label,
      kind: 'aggregate',
      blocksOfficialChain: true,
      mayDirectProductCodeChange: false,
      reason: 'this chain entry launches the chain runner again; it is not a product verdict',
    };
  }

  const decision = decisions[label];
  if (!decision) {
    return {
      label,
      kind: 'unreviewed_failure',
      blocksOfficialChain: true,
      mayDirectProductCodeChange: false,
      reason: 'the failure has not been checked against the current product contract',
    };
  }
  return {
    label,
    kind: decision.kind,
    blocksOfficialChain: true,
    mayDirectProductCodeChange: decision.kind === 'current_contract',
    reason: decision.reason,
  };
}

function buildAudit({
  pkg,
  baseline,
  decisionRegistry,
  failureLabels = [],
  repo = REPO,
  unrunnableBaseline = { count: 0, files: [] },
}) {
  const inventory = deriveChainInventory(pkg);
  const decisions = decisionRegistry.decisions || {};
  const decisionErrors = validateDecisions(decisionRegistry, pkg, repo);
  const structuralDebt = {
    missingChainScripts: compareDebt(
      inventory.missingChainScripts,
      baseline.missingChainScripts || [],
    ),
    chainRunnerAggregates: compareDebt(
      inventory.chainRunnerAggregates,
      baseline.chainRunnerAggregates || [],
    ),
  };
  const classifications = failureLabels
    .filter(Boolean)
    .map((label) => classifyFailure(label, inventory, decisions));
  const counts = classifications.reduce((result, item) => {
    result[item.kind] = (result[item.kind] || 0) + 1;
    return result;
  }, {});
  const faults = [
    ...inventory.duplicateLabels.map((label) => `duplicate chain label: ${label}`),
    ...structuralDebt.missingChainScripts.newItems
      .map((label) => `new missing chain script: ${label}`),
    ...structuralDebt.chainRunnerAggregates.newItems
      .map((label) => `new chain-runner aggregate: ${label}`),
    ...decisionErrors,
  ];

  return {
    chain: {
      unitCount: inventory.units.length,
      scriptedUnitCount: inventory.units.filter((unit) => unit.scripted).length,
    },
    structuralDebt,
    decisions: {
      reviewedCount: Object.keys(decisions).length,
      currentContractCount: Object.values(decisions)
        .filter((decision) => decision.kind === 'current_contract').length,
      errors: decisionErrors,
    },
    unrunnableSuiteBaseline: {
      count: unrunnableBaseline.count || 0,
      files: unrunnableBaseline.files || [],
    },
    failures: { inputCount: classifications.length, counts, classifications },
    faults,
    ok: faults.length === 0,
  };
}

function formatAudit(audit) {
  const lines = [
    'TEST TRUTH AUDIT',
    'A red suite is evidence to review. It is not permission to change product behaviour.',
    `Chain: ${audit.chain.unitCount} units (${audit.chain.scriptedUnitCount} npm scripts).`,
    `Known broken chain entries: ${audit.structuralDebt.missingChainScripts.current.length} missing commands; `
      + `${audit.structuralDebt.chainRunnerAggregates.current.length} chain-runner aggregates.`,
    `Known unrunnable test files: ${audit.unrunnableSuiteBaseline.count} `
      + '(held by the same first gate through test:unrunnable-suites).',
    `Reviewed current-product contracts: ${audit.decisions.currentContractCount}.`,
  ];
  if (audit.failures.inputCount) {
    const counts = Object.entries(audit.failures.counts)
      .map(([kind, count]) => `${kind}=${count}`)
      .join(', ');
    lines.push(`Failure evidence: ${audit.failures.inputCount} labels; ${counts}.`);
    lines.push(`Failures allowed to direct product-code changes: ${audit.failures.classifications
      .filter((item) => item.mayDirectProductCodeChange).length}.`);
  }
  if (audit.structuralDebt.missingChainScripts.resolvedItems.length
      || audit.structuralDebt.chainRunnerAggregates.resolvedItems.length) {
    lines.push('Structural debt fell; update the baseline when the repair is accepted.');
  }
  if (audit.faults.length) lines.push(`NEW AUDIT FAULTS:\n${audit.faults.map((fault) => `  - ${fault}`).join('\n')}`);
  lines.push(`TEST_TRUTH_EXIT=${audit.ok ? 0 : 1}`);
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { failures: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--failures') args.failures = argv[++i];
    else if (argv[i] === '--json') args.json = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pkg = loadJson(path.join(REPO, 'package.json'));
  const baseline = loadJson(BASELINE_PATH);
  const decisionRegistry = loadJson(DECISIONS_PATH);
  const unrunnableBaseline = loadJson(UNRUNNABLE_BASELINE_PATH);
  const failureLabels = args.failures
    ? fs.readFileSync(path.resolve(args.failures), 'utf8').split(/\r?\n/).map((line) => line.trim())
    : [];
  const audit = buildAudit({
    pkg,
    baseline,
    decisionRegistry,
    failureLabels,
    unrunnableBaseline,
  });
  console.log(args.json ? JSON.stringify(audit, null, 2) : formatAudit(audit));
  return audit.ok ? 0 : 1;
}

module.exports = {
  buildAudit,
  classifyFailure,
  deriveChainInventory,
  formatAudit,
  validateDecisions,
};

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`TEST TRUTH ABORT: ${error.message}`);
    process.exitCode = 2;
  }
}
