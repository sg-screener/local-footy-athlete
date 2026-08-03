/**
 * THE LAW THAT PROTECTS THE LAW — Sam's §9, gated.
 *
 * TOTALS-OR-RED is only worth having if it cannot quietly stop applying. Two
 * ways it can, both observed during the 2026-08-03 rollout:
 *
 *   1. A NEW SUITE JOINS THE CHAIN UNARMED. It exits 0 on a drained loop and
 *      the chain reads that as green — the exact defect that hid
 *      `onboardingReliabilityTests` for three days.
 *   2. A SUITE ENDS IN `process.exit(0)`. That HARD-OVERRIDES `process.exitCode`,
 *      so the arm is erased at the last instruction. Proven by a mutation that
 *      SURVIVED on `seasonPhaseSkewRepairTests` — the suite looked armed, the
 *      law did not hold, and nothing said so. Fourteen suites carried the
 *      construct; all fourteen are now gone.
 *
 * So this suite reads the `test:bible` chain out of `package.json` — the same
 * list the gate actually runs — and holds every member to both properties. A
 * suite the chain has never heard of cannot be checked here, which is why the
 * list is DERIVED rather than hand-maintained: adding a suite to the chain is
 * what enrols it, and there is no second list to forget.
 *
 * COMMENTS ARE STRIPPED BEFORE SCANNING, and that is not a detail: the first
 * version of this scan reported fourteen violations that were its own
 * explanatory comments quoting `process.exit(0)`. A gate that reads code must
 * read CODE (AGENTS.md, "a gate that reads code is coupled to code SHAPE").
 *
 * Run: npm run test:totals-or-red-law
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import fs from 'fs';
import path from 'path';

let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');

/** Comment-free source. The scan reads code, never prose about code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
}

/** Every suite file the `test:bible` chain actually runs. */
function chainSuiteFiles(): string[] {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const chain = pkg.scripts['test:bible'];
  assert(chain, 'test:bible is gone from package.json');
  const scripts = [...chain.matchAll(/npm run (test:[a-zA-Z0-9:-]+)/g)].map((m) => m[1]);
  // The chain's first link runs a file directly rather than via a script.
  const direct = [...chain.matchAll(/sucrase-node (src\/\S+\.ts)/g)].map((m) => m[1]);
  const files = new Set<string>(direct);
  for (const name of scripts) {
    const command = pkg.scripts[name];
    if (!command) continue;
    const match = /(src\/\S+\.ts)/.exec(command);
    if (match) files.add(match[1]);
  }
  return [...files].sort();
}

// This file is EXEMPT from its own scans, and says why rather than being
// quietly filtered: it carries the banned construct as a REGEX LITERAL — code,
// not a comment, so the stripper cannot remove it. The law statement is not a
// surviving instance of what it bans (the writer-audit's precedent).
const SELF = '__tests__/totalsOrRedLawTests.ts';
const SUITES = chainSuiteFiles().filter((file) => !file.endsWith(SELF));

console.log('\n-- TOTALS-OR-RED, gated (Sam\'s §9) --');
console.log(`  chain suites discovered: ${SUITES.length}`);

run('every suite in the bible chain is ARMED', () => {
  const unarmed = SUITES.filter((file) =>
    !/\barmTotalsOrRed\s*\(\s*\)/.test(code(fs.readFileSync(path.join(repoRoot, file), 'utf8'))));
  assert(unarmed.length === 0,
    `suite(s) in test:bible with no arm — they exit 0 on a drained loop and the `
    + `chain calls that green: ${unarmed.join(', ')}. Add the two lines from `
    + 'src/__tests__/support/totalsOrRed.ts.');
});

run('every suite in the bible chain CLEARS through the owner', () => {
  const noClear = SUITES.filter((file) =>
    !/\btotalsPrinted\s*\(/.test(code(fs.readFileSync(path.join(repoRoot, file), 'utf8'))));
  assert(noClear.length === 0,
    `armed suite(s) with no clear would be permanently red: ${noClear.join(', ')}`);
});

run('no suite in the chain can un-arm itself with process.exit(0)', () => {
  // THE BYPASS, banned. `process.exit(0)` and `process.exit(x > 0 ? 1 : 0)`
  // both write the exit code directly and erase the arm — the second is
  // *especially* seductive because it looks like careful reporting.
  const bypassing = SUITES.filter((file) => /process\.exit\(\s*(?:0\s*\)|[A-Za-z_.[\]]+(?:\.length)?\s*>\s*0\s*\?\s*1\s*:\s*0\s*\))/
    .test(code(fs.readFileSync(path.join(repoRoot, file), 'utf8'))));
  assert(bypassing.length === 0,
    `suite(s) end by asserting their own success, which hard-overrides the arm: `
    + `${bypassing.join(', ')}. Delete the call — totalsPrinted() already set the `
    + 'code from the report. A mutation SURVIVED on exactly this construct.');
});

run('the owner states the law it enforces', () => {
  // Non-vacuity: if the owner were reduced to no-ops, every cell above would
  // still pass while the law did nothing.
  const owner = fs.readFileSync(
    path.join(repoRoot, 'src/__tests__/support/totalsOrRed.ts'), 'utf8');
  assert(/process\.exitCode\s*=\s*1/.test(code(owner)),
    'armTotalsOrRed no longer arms — the whole chain is unprotected');
  assert(/failureCount\s*>\s*0\s*\?\s*1\s*:\s*0/.test(code(owner)),
    'totalsPrinted no longer reports the failure count — a red suite would clear green');
});

console.log(`\nTOTALS-OR-RED law totals: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
