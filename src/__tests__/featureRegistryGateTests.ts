/**
 * THE FEATURE REGISTRY'S GATE — the same mechanism as `test:law-registry`,
 * pointed at features.
 *
 * SEAT_INBOX item 11: *"Copy `lawRegistry.ts` exactly; do not design a second
 * mechanism. Seed it honestly and let the number be ugly."*
 *
 * ## WHAT THIS GATE DOES **NOT** DO, AND THE DIFFERENCE IS RULED
 *
 * `test:law-registry` FAILS while any law reads `UNENFORCED`, because Sam ruled
 * a rule with nothing watching it is a rule not followed — *"WHY CAN'T YOU JUST
 * MAKE SURE EVERY FUCKING RULE IS FOLLOWED FROM RIGHT NOW"*.
 *
 * **An UNPROVEN FEATURE is not that.** A feature nobody has proved yet is a
 * feature nobody has proved yet; the app is not breaking a promise by having
 * one. Item 11's own instruction — *"seed it honestly and let the number be
 * ugly"* — asks for the count to be VISIBLE, not for the chain to stop. Reding
 * on `UNPROVEN` would mean the only way to add a row is to have finished it
 * first, and the roster would fill with lies or stay empty.
 *
 * So this gate holds the things that make the number TRUSTWORTHY — every row
 * well-formed, every named script real, every in-chain claim true, and the
 * roster honest about its own incompleteness — and PRINTS the count.
 *
 * Run: npm run test:feature-registry
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import {
  FEATURE_REGISTRY,
  FEATURE_REGISTRY_SCOPE,
  type FeatureRow,
} from '../rules/featureRegistry';

const repoRoot = path.join(__dirname, '..', '..');

let passed = 0;
let failed = 0;
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
    failed += 1;
    failures.push(`${name}: ${(error as Error)?.message ?? String(error)}`);
    console.error(`  FAIL ${name}\n      ${(error as Error)?.message ?? String(error)}`);
  }
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const bibleChain = packageJson.scripts['test:bible'] ?? '';

/** Pure: ways one row can be malformed. Shared by the gate and its liveness arm. */
export function rowFaults(row: FeatureRow): string[] {
  const faults: string[] = [];
  if (!row.id.startsWith('FEAT-')) faults.push('id does not start with FEAT-');
  if (row.feature.trim().length < 20) faults.push('the feature sentence is too short to mean anything');
  if (row.askedFor.trim().length < 10) faults.push('askedFor names no source');
  if (row.proof.state === 'held') {
    if (!row.proof.by.trim()) faults.push('held with no named guard');
    if (row.proof.receipt.trim().length < 40) faults.push('held with no real receipt');
  } else {
    if (!row.proof.wouldTake.trim()) faults.push('UNPROVEN without saying what a proof would take');
    if (row.proof.receipt.trim().length < 40) faults.push('UNPROVEN with no receipt for the absence');
  }
  return faults;
}

// ── [1] EVERY ROW IS WELL-FORMED ───────────────────────────────────────────

run('the registry is non-empty and every row is well-formed', () => {
  assert(FEATURE_REGISTRY.length > 0, 'the feature registry is empty');
  const broken = FEATURE_REGISTRY
    .map((row) => ({ id: row.id, faults: rowFaults(row) }))
    .filter((entry) => entry.faults.length > 0);
  assert(broken.length === 0,
    broken.map((entry) => `${entry.id}: ${entry.faults.join('; ')}`).join(' | '));
  const ids = FEATURE_REGISTRY.map((row) => row.id);
  assert(new Set(ids).size === ids.length,
    `duplicate feature id(s): ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}. `
    + 'Rows are retired, never reused.');
});

// ── [2] A NAMED GUARD IS A REAL ONE ────────────────────────────────────────
//
// The failure this prevents is the registry's whole point: a row that CLAIMS a
// proof and names a script nobody wrote reads greener than an honest UNPROVEN.

run('every named guard is a script that EXISTS', () => {
  const missing = FEATURE_REGISTRY
    .filter((row) => row.proof.state === 'held')
    .map((row) => ({ id: row.id, by: (row.proof as { by: string }).by }))
    .filter((entry) => !packageJson.scripts[entry.by]);
  assert(missing.length === 0,
    `feature(s) claiming a guard that does not exist: ${missing.map((entry) =>
      `${entry.id} -> ${entry.by}`).join(', ')}`);
});

run('every in_chain claim is true', () => {
  // THE ID COMES FROM THE ROW, NEVER FROM AN INDEX. The first cut of this cell
  // filtered, then mapped `FEATURE_REGISTRY[index].id` — and after a filter the
  // index no longer addresses the same row, so every failure would have named
  // the WRONG feature. It passed, because nothing was lying yet; a green cell
  // is a claim, and this one was about to make a false one.
  const lying = FEATURE_REGISTRY
    .filter((row) => row.proof.state === 'held')
    .map((row) => ({ id: row.id, ...(row.proof as { by: string; chainStatus: string }) }))
    .filter((entry) => entry.chainStatus === 'in_chain'
      && !bibleChain.includes(`npm run ${entry.by}`));
  assert(lying.length === 0,
    `${lying.map((entry) => `${entry.id} declares in_chain but package.json's `
      + `test:bible never runs ${entry.by}`).join('; ')}. A check nobody runs is `
    + 'not a check.');
});

// ── [3] THE ROSTER IS HONEST ABOUT WHAT IT DOES NOT COVER ─────────────────
//
// The failure mode a registry invites: it LOOKS like a census, so an absent
// feature reads as a non-existent one. Item 11 asked for it seeded honestly.

run('the roster declares its own incompleteness', () => {
  assert(FEATURE_REGISTRY_SCOPE.trim().length > 80,
    'FEATURE_REGISTRY_SCOPE does not say what the roster covers, so its silence '
    + 'will be read as coverage');
  assert(/\bNOT\b[^.]*census|not a census/i.test(FEATURE_REGISTRY_SCOPE),
    'the scope note no longer says plainly that this is not a census of the app '
    + '— that sentence is what stops an absent row being read as an absent '
    + 'feature');
});

// ── [4] `built_unreachable` IS THE STATE WORTH NAMING ─────────────────────
//
// The field laws do not need. A feature can be built, tested and unreachable —
// `CLAUDE.md`: DONE MEANS THE ATHLETE CAN SEE IT. A row claiming a proof AND
// athlete reach must have a receipt that mentions how it was SEEN.

run('an athlete-reachable held feature says how it was seen', () => {
  const unseen = FEATURE_REGISTRY
    .filter((row) => row.reachable === 'athlete_reachable' && row.proof.state === 'held')
    .filter((row) => !/glass|screenshot|maestro|simulator|photograph|\.png/i
      .test((row.proof as { receipt: string }).receipt));
  assert(unseen.length === 0,
    `${unseen.map((row) => row.id).join(', ')} claims an athlete can reach it AND `
    + 'that it is proven, but its receipt never says how it was SEEN. '
    + 'CLAUDE.md: DONE MEANS THE ATHLETE CAN SEE IT — a green id proves '
    + 'presence, not placement.');
});

// ── [5] THE CHECKER REDS ON A FABRICATED BAD ROW (liveness) ───────────────

run('the checkers red on fabricated bad rows (liveness)', () => {
  assert(rowFaults({
    id: 'nope-wrong-prefix',
    feature: 'A perfectly reasonable sentence about a feature that exists.',
    askedFor: 'somewhere real',
    reachable: 'internal',
    proof: { state: 'held', by: 'test:x', chainStatus: 'in_chain', receipt: 'x'.repeat(50) },
  }).some((fault) => /FEAT-/.test(fault)), 'a bad id prefix passed');
  assert(rowFaults({
    id: 'FEAT-thin',
    feature: 'A perfectly reasonable sentence about a feature that exists.',
    askedFor: 'somewhere real',
    reachable: 'internal',
    proof: { state: 'UNPROVEN', claim: 'BUILT', wouldTake: '', receipt: 'x'.repeat(50) },
  }).some((fault) => /wouldTake|what a proof/.test(fault)),
  'an UNPROVEN row that does not say what a proof would take passed');
  assert(rowFaults({
    id: 'FEAT-ok',
    feature: 'A perfectly reasonable sentence about a feature that exists.',
    askedFor: 'somewhere real',
    reachable: 'internal',
    proof: { state: 'held', by: 'test:x', chainStatus: 'in_chain', receipt: 'too short' },
  }).some((fault) => /receipt/.test(fault)), 'a held row with no real receipt passed');
});

const held = FEATURE_REGISTRY.filter((row) => row.proof.state === 'held').length;
const unreachable = FEATURE_REGISTRY
  .filter((row) => row.reachable === 'built_unreachable').length;
console.log(
  `\nFEATURE REGISTRY: ${FEATURE_REGISTRY.length} rows, ${held} held, `
  + `${FEATURE_REGISTRY.length - held} UNPROVEN, ${unreachable} built but unreachable`,
);
console.log(`feature registry gate totals: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(`Failing: ${failures.map((f) => f.split(':')[0]).join(', ')}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
