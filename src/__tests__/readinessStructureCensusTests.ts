/**
 * READINESS NEVER SETS STRUCTURE — the ratchet that pins Sam's Batch 0 ruling
 * while the batches land.
 *
 * THE RULING (Sam, 2026-07-28): structure comes from phase + schedule facts;
 * capacity/readiness affects DOSE only — "dose down, never block" extends to
 * weekly session counts. Readiness and injury never set structure; injury flows
 * through its own law family.
 *
 * WHY A CENSUS AND NOT A BAN. There are 65 readiness edges across 14 files and
 * 48 of them violate the ruling today. A gate that failed on all 48 the day it
 * landed would be disabled by the first person it blocked — that is the lesson
 * of the whole provenance unit, and the reason the load-ratio gate grew one
 * cluster at a time. So every edge is DECLARED with a verdict, and the gate
 * ratchets:
 *
 *   - a file's actual edge count must equal its declared count, so a new
 *     readiness edge anywhere fails until someone classifies it;
 *   - the `structure_pending_removal` total may never exceed its baseline, so
 *     the debt can only shrink;
 *   - a file with no edges left must be removed from the census, so the list
 *     cannot outlive the problem and start reading as approval.
 *
 * That last one matters most. `LOAD_RULING_PENDING` was an empty Set whose
 * emptiness read as "everything is ruled" when it meant "nothing was ever put
 * here". A census that keeps naming files it has already fixed rots the same
 * way, in the other direction.
 *
 * Run: npm run test:readiness-structure-law
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  READINESS_STRUCTURE_LAW,
  READINESS_EDGE_CENSUS,
  STRUCTURE_DEBT_BASELINE,
  SUPERSEDED_EXEMPTION_CLAIMS,
  readinessEdgesIn,
} from '../data/readinessStructureCensus';
import { stripComments } from './support/sourceText';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** Every product file under src/, tests and node_modules excluded. */
function productFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (/\.tsx?$/.test(entry.name)) out.push(path.relative(src, full));
    }
  };
  walk(src);
  return out;
}

console.log('\n[1] The ruling is attributed and still says what the census enforces');
{
  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(READINESS_STRUCTURE_LAW.ruledOn),
    READINESS_STRUCTURE_LAW.ruledOn);

  const wherePath = path.join(repoRoot, READINESS_STRUCTURE_LAW.where);
  ok('the attributed document exists', fs.existsSync(wherePath), READINESS_STRUCTURE_LAW.where);

  if (fs.existsSync(wherePath)) {
    const doc = fs.readFileSync(wherePath, 'utf8');
    ok('the ruling appears verbatim in the attributed document',
      doc.includes(READINESS_STRUCTURE_LAW.quote),
      `not found: ${READINESS_STRUCTURE_LAW.quote.slice(0, 80)}...`);
  }

  // The two halves the census actually turns on. A ruling paraphrased into a
  // gate can drift from the ruling; this pins the words the verdicts rest on.
  ok('the ruling states that readiness affects dose',
    /DOSE only/i.test(READINESS_STRUCTURE_LAW.quote));
  ok('the ruling states that readiness never sets structure',
    /never set structure/i.test(READINESS_STRUCTURE_LAW.quote));
}

console.log('\n[2] Every declared file exists and carries the edges it claims');
{
  for (const entry of READINESS_EDGE_CENSUS) {
    const filePath = path.join(src, entry.file);
    ok(`${entry.file}: exists`, fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) continue;

    const actual = readinessEdgesIn(fs.readFileSync(filePath, 'utf8'));
    ok(`${entry.file}: declares its actual edge count (${actual})`,
      actual === entry.edges,
      `declared ${entry.edges}, found ${actual} — reclassify the change, do not retune the number`);

    ok(`${entry.file}: still has at least one edge`, actual > 0,
      'no edges left — delete this entry; a census that outlives its problem reads as approval');
  }
}

console.log('\n[3] Every entry is typed: verdict, reason, and an owner for the debt');
{
  for (const entry of READINESS_EDGE_CENSUS) {
    ok(`${entry.file}: has a verdict`,
      entry.verdict === 'dose' || entry.verdict === 'structure_pending_removal',
      String(entry.verdict));
    ok(`${entry.file}: says what readiness decides there`, entry.what.length > 0);
    ok(`${entry.file}: says what happens to it`, entry.disposition.length > 0);

    if (entry.verdict === 'structure_pending_removal') {
      // Debt with no owner is debt nobody pays.
      ok(`${entry.file}: names the batch that removes it`,
        !!entry.owningBatch && entry.owningBatch.length > 0,
        'a structure violation must name its owning batch');
    }
  }

  // Both classes must be real. A census that is all-dose would pass every other
  // assertion while proving nothing.
  ok('the census records at least one surviving dose consumer',
    READINESS_EDGE_CENSUS.some((e) => e.verdict === 'dose'));
  ok('the census records the structure debt',
    READINESS_EDGE_CENSUS.some((e) => e.verdict === 'structure_pending_removal'));
}

console.log('\n[4] THE RATCHET — structure debt may shrink, never grow');
{
  const debt = READINESS_EDGE_CENSUS
    .filter((e) => e.verdict === 'structure_pending_removal')
    .reduce((n, e) => n + e.edges, 0);

  ok(`structure debt (${debt}) is at or below the baseline (${STRUCTURE_DEBT_BASELINE})`,
    debt <= STRUCTURE_DEBT_BASELINE,
    'a new readiness->structure edge was added; the ruling forbids it');

  // The other direction: once the debt is paid down, the baseline must follow it
  // or the ratchet stops ratcheting and silently re-permits what was removed.
  ok(`the baseline is tightened to the current debt (${debt})`,
    debt === STRUCTURE_DEBT_BASELINE,
    `debt fell to ${debt} — lower STRUCTURE_DEBT_BASELINE to match, or the slack is re-spendable`);
}

console.log('\n[5] COMPLETENESS — no readiness edge is undeclared');
{
  const declared = new Set(READINESS_EDGE_CENSUS.map((e) => e.file));
  const undeclared: string[] = [];

  for (const rel of productFiles()) {
    if (declared.has(rel)) continue;
    if (rel === 'data/readinessStructureCensus.ts') continue; // the census itself
    const count = readinessEdgesIn(fs.readFileSync(path.join(src, rel), 'utf8'));
    if (count > 0) undeclared.push(`${rel} (${count})`);
  }

  ok('every file with a readiness edge is in the census',
    undeclared.length === 0,
    undeclared.join('\n      '));
}

console.log('\n[6] The superseded exemption comments are gone');
{
  // The old readiness law scoped itself to the readiness DECLARATION and
  // deliberately exempted the CAPACITY score. Three sites argue for that
  // exemption in their own comments. Sam's ruling closes it, so those comments
  // now argue against the law they sit inside — which reads to the next person
  // as an unresolved disagreement rather than a settled one.
  for (const claim of SUPERSEDED_EXEMPTION_CLAIMS) {
    const filePath = path.join(src, claim.file);
    ok(`${claim.file}: exists`, fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) continue;

    const text = fs.readFileSync(filePath, 'utf8');
    ok(`${claim.file}: no longer claims the capacity-score exemption`,
      !text.includes(claim.supersededText),
      `still present: "${claim.supersededText}"`);
  }
}

console.log('\n[7] The detector counts what it claims to count');
{
  // A census built on a detector nobody checked is a census of whatever the
  // regex happened to match. Pin it on both sides.
  ok('counts an equality test against a level',
    readinessEdgesIn("if (readiness === 'low') return 1;") === 1);
  ok('counts a negated test against a level',
    readinessEdgesIn("if (readiness !== 'high') return 2;") === 1);
  ok('counts a qualified reference',
    readinessEdgesIn("if (input.readiness === 'medium') return 3;") === 1);
  ok('ignores comments',
    readinessEdgesIn("// readiness === 'low' used to gate this\nconst x = 1;") === 0);
  ok('ignores an unrelated identifier',
    readinessEdgesIn("if (soreness === 'low') return 1;") === 0);
  ok('ignores a readiness reference with no level comparison',
    readinessEdgesIn('const r = deriveReadiness(profile);') === 0);
}

const total = passed + failures.length;
console.log(`\nReadiness structure census: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
