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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  READINESS_STRUCTURE_LAW,
  READINESS_EDGE_CENSUS,
  STRUCTURE_DEBT_BASELINE,
  STRUCTURE_DEBT_FOUNDING_CEILING,
  SUPERSEDED_EXEMPTION_CLAIMS,
  capacityEdgesIn,
  homonymBandComparisonsIn,
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
/**
 * ⚠ IT REFUSES TO RETURN A THIN LIST, AND THAT REFUSAL IS THE POINT.
 *
 * **MEASURED BY MUTATION, 2026-08-13 (inbox item 58, seat `patterns`).** Making
 * this function `return []` left the whole suite **94/94 GREEN**. Both sweeps
 * that stand on it — [5]'s undeclared-edge census and [8]'s homonym gate — read
 * "no offenders" off an empty list and reported perfect health.
 *
 * **THAT IS THE EXACT SHAPE R-041's OWN HISTORY IS ABOUT.** Its row records a
 * guard that said *"nothing reds if they re-merge"* while the homonym re-merged
 * in ten sites over seventeen days. A gate that cannot tell NO VIOLATIONS from
 * NO FILES LOOKED AT is not a weaker version of a gate; it is the same silence
 * wearing a green badge.
 *
 * THROWN, NOT ASSERTED, because two blocks depend on it and a cell in one of
 * them would leave the other still standing on sand. The floor is deliberately
 * far below the real count (549 product files on 2026-08-13) — it is a tripwire
 * for a broken walk, not a ratchet on how big the app is.
 */
const PRODUCT_FILE_FLOOR = 200;

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
  if (out.length < PRODUCT_FILE_FLOOR) {
    throw new Error(
      `productFiles() found ${out.length} files under ${src}, below the floor of `
      + `${PRODUCT_FILE_FLOOR}. Every sweep in this suite would pass over nothing and `
      + 'report health. Fix the walk — do not lower this.');
  }
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

    const actual = capacityEdgesIn(fs.readFileSync(filePath, 'utf8'));
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

  ok('the census records at least one surviving dose consumer',
    READINESS_EDGE_CENSUS.some((e) => e.verdict === 'dose'));

  // RE-POINTED at the terminal state (2026-07-29). This used to require at least
  // one `structure_pending_removal` entry, on the reasoning that a census which
  // is all-dose would pass every other assertion while proving nothing. That was
  // right while debt existed and is exactly backwards once it is paid: it would
  // demand a violation be kept on the books to satisfy a gate.
  //
  // What must stay true is that the census can still SAY "structure", so the
  // next violation has somewhere to be declared rather than being quietly filed
  // as dose. That is a property of the vocabulary, not of the contents.
  {
    const censusSource = fs.readFileSync(
      path.join(src, 'data/readinessStructureCensus.ts'), 'utf8');
    ok('the census can still declare a structure violation',
      /'structure_pending_removal'/.test(censusSource),
      'the verdict must remain expressible even when nothing carries it');
    ok('an all-dose census is only honest at a zero baseline',
      READINESS_EDGE_CENSUS.some((e) => e.verdict === 'structure_pending_removal') ||
        STRUCTURE_DEBT_BASELINE === 0,
      `baseline ${STRUCTURE_DEBT_BASELINE} with no structure entry to account for it`);
  }
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

  // DIRECTION 4, backported from the legacy reckoning census (2026-07-30).
  //
  // The three directions above are CIRCULAR. Both of the first two compare the
  // debt against STRUCTURE_DEBT_BASELINE, so a new readiness->structure edge can
  // be admitted by raising the declared count and the baseline together — which
  // is precisely how someone declares a violation into a census instead of
  // fixing it. Proven against the legacy census on 2026-07-30: the whole suite
  // stayed green while brand-new surface was admitted.
  //
  // The ceiling is FROZEN AT ZERO because the debt was paid to zero on
  // 2026-07-29. The ruling is fully discharged, so this census may never again
  // DECLARE a structure violation. Every future one is fixed, not filed.
  ok(`the baseline (${STRUCTURE_DEBT_BASELINE}) never exceeds the founding ceiling `
    + `(${STRUCTURE_DEBT_FOUNDING_CEILING})`,
    STRUCTURE_DEBT_BASELINE <= STRUCTURE_DEBT_FOUNDING_CEILING,
    'a readiness->structure edge is being DECLARED rather than fixed. The debt was paid '
    + 'to zero on 2026-07-29 and the ceiling was tightened to match, so there is no '
    + 'headroom to declare into. Raising the ceiling needs a ruling, not an edit.');
}

console.log('\n[5] COMPLETENESS — no readiness edge is undeclared');
{
  const declared = new Set(READINESS_EDGE_CENSUS.map((e) => e.file));
  const undeclared: string[] = [];

  for (const rel of productFiles()) {
    if (declared.has(rel)) continue;
    if (rel === 'data/readinessStructureCensus.ts') continue; // the census itself
    const count = capacityEdgesIn(fs.readFileSync(path.join(src, rel), 'utf8'));
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
    capacityEdgesIn("if (capacity === 'low') return 1;") === 1);
  ok('counts a negated test against a level',
    capacityEdgesIn("if (capacity !== 'high') return 2;") === 1);
  ok('counts a qualified reference',
    capacityEdgesIn("if (input.capacity === 'medium') return 3;") === 1);
  ok('ignores comments',
    capacityEdgesIn("// capacity === 'low' used to gate this\nconst x = 1;") === 0);
  ok('ignores an unrelated identifier',
    capacityEdgesIn("if (soreness === 'low') return 1;") === 0);
  ok('ignores a capacity reference with no level comparison',
    capacityEdgesIn('const c = profileCapacityBandOrNull(profile);') === 0);
  // THE SPLIT ITSELF. After the rename the detector must be BLIND to the
  // declaration's word — otherwise the census silently re-absorbs the homonym
  // it was renamed to separate, and every count it reports is a count of both.
  ok('is blind to the DECLARATION word — that is the whole rename',
    capacityEdgesIn("if (readiness === 'low') return 1;") === 0);
}

console.log('\n[8] R-041 / R-064 — the homonym cannot re-merge');
{
  // Both rows read `UNENFORCED` from 2026-07-27 to 2026-08-13: "a naming
  // hazard, not a behaviour; nothing reds if they re-merge." This is the
  // something that reds.
  //
  // ── IT HAS NOW BEEN SEEN RED, WHICH IT HAD NOT BEEN WHEN IT SHIPPED ──────
  //
  // Inbox item 58 asked for exactly that: *"verify the new guard actually reds
  // on a re-merge, by mutation."* Done 2026-08-13 by seat `patterns`, in a
  // detached worktree, four real re-merges injected into real product files:
  //
  //   | mutation                                                  | result |
  //   | a `capacity === 'low'` renamed back in progressionRules   | RED    |
  //   | the NEGATED form `readiness !== 'high'`, a rules file      | RED    |
  //   | a QUALIFIED `athlete.readiness === 'medium'`               | RED    |
  //   | a `.tsx` navigation file, not a rules file                 | RED    |
  //
  // Each named the offending file and count in its own failure text. Two
  // further attempts MISSED — their injected code did not match the file they
  // were aimed at — and are recorded as missed rather than as survivors,
  // because "the gate is blind" and "the mutation missed" are different
  // findings and only one of them is about the gate.
  //
  // **AND A FIFTH MUTATION SURVIVED, WHICH IS WHY `productFiles` NOW THROWS.**
  // Making the walk return an empty list left this suite 94/94 GREEN — the
  // sweep below reported no offenders because it read no files. That is the
  // silence R-041's own row is a history of, and it is fixed at the walk rather
  // than here, because block [5] stands on the same list.
  //
  // Pinned from both sides FIRST, so a detector that matches nothing cannot
  // pass the sweep below by being inert — the exact way a green gate lies.
  ok('[gate] the homonym detector catches a bare band comparison',
    homonymBandComparisonsIn("if (readiness === 'low') return 1;") === 1);
  ok('[gate] it catches a qualified one',
    homonymBandComparisonsIn("if (input.readiness !== 'high') return 2;") === 1);
  ok('[gate] it ignores comments, so a history note is not a violation',
    homonymBandComparisonsIn("// readiness === 'low' used to gate this\nconst x = 1;") === 0);
  ok('[gate] it ignores the DECLARATION\'s real shape',
    homonymBandComparisonsIn('if (readiness.deloaded) return 1;') === 0);
  ok('[gate] it ignores `low_readiness`, a §18 reduction reason',
    homonymBandComparisonsIn("if (reasons.includes('low_readiness')) return 1;") === 0);
  ok('[gate] it ignores the capacity band under its own name',
    homonymBandComparisonsIn("if (capacity === 'low') return 1;") === 0);

  const offenders: string[] = [];
  for (const rel of productFiles()) {
    if (rel === 'data/readinessStructureCensus.ts') continue; // the detector itself
    const count = homonymBandComparisonsIn(fs.readFileSync(path.join(src, rel), 'utf8'));
    if (count > 0) offenders.push(`${rel} (${count})`);
  }
  ok('no product file compares a `readiness` against a capacity level',
    offenders.length === 0,
    `the homonym has re-merged in: ${offenders.join(', ')}. `
    + 'The DECLARATION is not a three-level band — it is {deloaded, sessionsOptional}, '
    + 'a ReadinessSignal, or one of R-038\'s tiers. A three-level comparison on it is '
    + 'the CAPACITY band wearing the wrong name. Rename it `capacity` (CapacityBand), '
    + 'or read the declaration\'s real shape.');
}

const total = passed + failures.length;
console.log(`\nReadiness structure census: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
