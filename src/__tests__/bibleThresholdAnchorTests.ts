/**
 * BIBLE THRESHOLD ANCHORS — the citation pass (Batch 5 of the engine-thresholds unit).
 *
 * THE DEFECT this closes. The provenance inventory found 276 code comments that
 * attribute a decision to Sam and exactly ONE that cites a document. Everything
 * else is self-certifying: the code is both the claim and the only evidence for
 * it. A reader cannot tell a comment recording something Sam actually ruled from
 * a comment someone wrote to make a number look ruled.
 *
 * A subset of the engine thresholds do not need a ruling at all — the Programming
 * Bible already states them. Those are CITATIONS, not decisions, and this is the
 * gate that makes a citation falsifiable in both directions:
 *
 *   Bible -> registry   the quoted sentence is still in the Bible, verbatim, and
 *                       still states the numbers it is cited for.
 *   registry -> code    the cited site still exists and still carries a marker
 *                       naming the anchor, so a reader at the code can find it.
 *
 * Without the second direction a citation rots silently: the Bible sentence stays
 * true while the code drifts away from it, and the registry goes on asserting a
 * relationship that no longer holds. Without the first, an edit to the Bible
 * quietly withdraws the support for a number nobody re-reads.
 *
 * `phaseRepSchemes.ts` is the model. Its header states the Bible section AND
 * quotes the numbers it derives — the only large cluster in the repo whose
 * provenance could be verified without asking anyone. It cost its author a
 * paragraph. This makes that discipline enforceable rather than admirable.
 *
 * Run: npm run test:bible-anchors
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  BIBLE_SOURCE,
  BIBLE_THRESHOLD_ANCHORS,
  INJURY_SEVERITY_THRESHOLD_CONSUMERS,
  MERGED_SEVERITY_SCALE_DEFERRALS,
} from '../data/bibleThresholdAnchors';
import { stripComments, statesWholeNumber } from './support/sourceText';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[1] The registry is populated and internally well-formed');
{
  ok('there is at least one anchor', BIBLE_THRESHOLD_ANCHORS.length > 0,
    'an empty registry is the LOAD_RULING_PENDING defect — absence rendered as approval');

  const ids = BIBLE_THRESHOLD_ANCHORS.map((a) => a.id);
  ok('anchor ids are unique', new Set(ids).size === ids.length,
    `duplicates: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);

  for (const anchor of BIBLE_THRESHOLD_ANCHORS) {
    ok(`${anchor.id}: names a Bible section`, anchor.section.length > 0);
    ok(`${anchor.id}: carries a non-empty quote`, anchor.quote.trim().length > 0);
    ok(`${anchor.id}: governs at least one code site`, anchor.sites.length > 0,
      'an anchor with no site cites nothing and cannot rot visibly');
    ok(`${anchor.id}: explains what the number means`, anchor.meaning.length > 0);
  }
}

console.log('\n[2] Bible -> registry: every quote is still there, verbatim');
{
  const biblePath = path.join(repoRoot, BIBLE_SOURCE);
  ok('the Bible exists at the attributed path', fs.existsSync(biblePath), BIBLE_SOURCE);

  const bible = fs.readFileSync(biblePath, 'utf8');
  for (const anchor of BIBLE_THRESHOLD_ANCHORS) {
    ok(`${anchor.id}: quote appears verbatim in the Bible`,
      bible.includes(anchor.quote),
      `not found: ${anchor.quote.slice(0, 90)}...`);
  }
}

console.log('\n[3] THE BINDING: the quote states the numbers it is cited for');
{
  // Not "a real sentence exists" but "that sentence says THESE numbers". Without
  // this, a threshold could drift to any value while still citing a genuine
  // Bible line — a citation that no longer supports what it is cited for, which
  // is precisely the failure the provenance unit exists to close.
  for (const anchor of BIBLE_THRESHOLD_ANCHORS) {
    if (anchor.statesNoNumbers) {
      // A typed exemption, not a silent pass. Some Bible rules are CATEGORICAL
      // ("no programmed sessions on game day") and licence an exclusion rather
      // than a magnitude. Those must say so and say why.
      ok(`${anchor.id}: categorical anchor gives a reason`,
        anchor.statesNoNumbers.length > 0);
      ok(`${anchor.id}: categorical anchor declares no numbers`,
        anchor.states.length === 0,
        'an anchor cannot be both categorical and numeric');
      continue;
    }

    ok(`${anchor.id}: declares the numbers it licenses`, anchor.states.length > 0,
      'a numeric anchor with no declared numbers is unfalsifiable — mark it categorical or state them');

    for (const n of anchor.states) {
      ok(`${anchor.id}: quote states ${n} as a whole number`,
        statesWholeNumber(anchor.quote, n),
        `quote "${anchor.quote.slice(0, 90)}..." does not state ${n}`);
    }
  }
}

console.log('\n[4] registry -> code: the cited site exists and names its anchor');
{
  for (const anchor of BIBLE_THRESHOLD_ANCHORS) {
    for (const site of anchor.sites) {
      const filePath = path.join(src, site.file);
      ok(`${anchor.id}: ${site.file} exists`, fs.existsSync(filePath));
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, 'utf8');
      ok(`${anchor.id}: ${site.file} still defines ${site.symbol}`,
        stripComments(raw).includes(site.symbol),
        'the cited symbol was renamed or removed — the citation now points at nothing');

      // The marker is what makes the citation reachable FROM the code. A
      // registry nobody can find from the site it governs is a document, not a
      // binding.
      ok(`${anchor.id}: ${site.file} carries the anchor marker`,
        raw.includes(`BIBLE_ANCHOR: ${anchor.id}`),
        `add "// BIBLE_ANCHOR: ${anchor.id}" at the decision`);
    }
  }
}

console.log('\n[5] Every marker in the codebase resolves to a real anchor');
{
  // The reverse direction. Without it, a marker naming a deleted or misspelled
  // anchor reads exactly like a valid citation — the "authored-ness spread
  // across documents, nothing reconciles them" gap, one layer down.
  const known = new Set(BIBLE_THRESHOLD_ANCHORS.map((a) => a.id));
  const orphans: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const match of text.matchAll(/BIBLE_ANCHOR:\s*([a-z0-9_]+)/g)) {
        if (!known.has(match[1])) {
          orphans.push(`${path.relative(src, full)} -> ${match[1]}`);
        }
      }
    }
  };
  walk(src);

  ok('no marker names an unknown anchor', orphans.length === 0, orphans.join('\n      '));
}

console.log('\n[6] Injury severity numbers live in ONE owner');
{
  // These thresholds are already ruled — Bible Sections 8/17.G, owned by
  // `rules/injurySeverityBands.ts`, which 16 files import. Three sites wrote
  // their own literals instead. A second representation of a ruled fact is not
  // a pending decision; it is a drift waiting to happen, and it is why the
  // owner's own header says consumers "should not own their own numeric
  // thresholds".
  const owner = 'rules/injurySeverityBands.ts';

  ok('the consumer list is populated', INJURY_SEVERITY_THRESHOLD_CONSUMERS.length > 0);

  for (const rel of INJURY_SEVERITY_THRESHOLD_CONSUMERS) {
    const filePath = path.join(src, rel);
    ok(`${rel} exists`, fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) continue;

    const code = stripComments(fs.readFileSync(filePath, 'utf8'));

    // Any comparison of a severity-shaped expression against a BAND EDGE.
    // `> 0` asks whether an injury exists at all and `<= 10` is the scale's own
    // domain; neither restates a band, so neither is a second representation.
    const literalThresholds = [...code.matchAll(
      /\b[A-Za-z_$][\w$.?]*[Ss]everity\b[^;{}\n]{0,40}?(?:[<>]=?|===?)\s*(\d+)/g)]
      .filter((m) => m[1] !== '0' && m[1] !== '10')
      .map((m) => m[0].trim());

    ok(`${rel}: no numeric injury-severity threshold of its own`,
      literalThresholds.length === 0,
      `found: ${literalThresholds.join(' | ')} — use ${owner}`);

    ok(`${rel}: reads the severity-band owner`,
      /injurySeverityBands/.test(fs.readFileSync(filePath, 'utf8')),
      `must import from ${owner} rather than restating its numbers`);
  }
}

console.log('\n[7] What is NOT fixed says so, and says which batch owns it');
{
  // `ActiveConstraint.severity` carries BOTH an injury severity and a fatigue
  // severity on one 1-10 field, so a threshold on it is neither cleanly injury
  // nor cleanly fatigue and cannot be collapsed onto the injury owner without
  // deciding that merge first. Those sites are deferred — and the deferral is
  // RECORDED, because a file quietly missing from the enforced list is
  // indistinguishable from a file that was checked and found clean. That is the
  // LOAD_RULING_PENDING defect, and it is the one this unit keeps re-finding.
  // PAID (Sam, 2026-07-28, Batch 4). This asserted the list was POPULATED,
  // which was right while the merge was undecided and is wrong now: the ruling
  // that one 1-10 scale serves injury and fatigue answered the question all
  // five entries were waiting on, so the honest state is empty.
  //
  // Emptiness is asserted rather than the entry merely being deleted, because an
  // empty list with nothing asserting WHY is the `LOAD_RULING_PENDING` defect —
  // an unfilled park reading as a completed review. A new merged-scale
  // threshold must be declared here, and this line makes that loud.
  ok('the merged-scale debt is paid', MERGED_SEVERITY_SCALE_DEFERRALS.length === 0,
    MERGED_SEVERITY_SCALE_DEFERRALS.map((d) => d.file).join(', '));

  const enforced = new Set(INJURY_SEVERITY_THRESHOLD_CONSUMERS);
  for (const deferral of MERGED_SEVERITY_SCALE_DEFERRALS) {
    ok(`${deferral.file}: deferral names a reason`, deferral.reason.length > 0);
    ok(`${deferral.file}: deferral names the owning batch`, deferral.owningBatch.length > 0);
    ok(`${deferral.file}: exists`, fs.existsSync(path.join(src, deferral.file)));
    ok(`${deferral.file}: is not also claimed as enforced`, !enforced.has(deferral.file),
      'a file cannot be both collapsed onto the owner and deferred');
  }
}

console.log('\n[8] No injury-band literal escapes both lists');
{
  // The completeness check. Enforced files are proven clean by [6]; deferred
  // files are proven declared by [7]. Anything matching the pattern in NEITHER
  // list is a site nobody has looked at, which is exactly what a sweep is for.
  const declared = new Set([
    ...INJURY_SEVERITY_THRESHOLD_CONSUMERS,
    ...MERGED_SEVERITY_SCALE_DEFERRALS.map((d) => d.file),
  ]);
  const undeclared: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const rel = path.relative(src, full);
      if (declared.has(rel)) continue;
      const code = stripComments(fs.readFileSync(full, 'utf8'));
      // Presence and clamp checks are not thresholds: `> 0` asks whether an
      // injury exists at all, and `<= 10` is the scale's own domain. Neither
      // restates a band edge.
      const hits = [...code.matchAll(
        /\b[A-Za-z_$][\w$.?]*[Ss]everity\b[^;{}\n]{0,40}?(?:[<>]=?|===?)\s*(\d+)/g)]
        .filter((m) => m[1] !== '0' && m[1] !== '10')
        .map((m) => `${rel}: ${m[0].trim()}`);
      undeclared.push(...hits);
    }
  };
  walk(src);

  ok('every injury-band literal is either collapsed or declared deferred',
    undeclared.length === 0,
    undeclared.join('\n      '));
}

console.log('\n[9] The owner still says what the consumers now depend on');
{
  // Collapsing the literals onto the owner only helps if the owner's numbers are
  // the ones that were there. Pin the two band edges the three fixed sites used.
  const {
    classifyBibleInjurySeverity,
    injurySeverityRemovesRiskyWork,
  } = require('../rules/injurySeverityBands');

  ok('6 still removes risky work (was the `< 6` literal)',
    injurySeverityRemovesRiskyWork(6) && !injurySeverityRemovesRiskyWork(5));
  ok('8 still opens the pause band (was the `>= 8` literal)',
    classifyBibleInjurySeverity(8).band === 'pause_affected_8_10' &&
    classifyBibleInjurySeverity(7).band !== 'pause_affected_8_10');
  ok('4 still opens the reduce band (was the `>= 4` literal)',
    classifyBibleInjurySeverity(4).band === 'reduce_affected_4_5' &&
    classifyBibleInjurySeverity(3).band === 'avoid_trigger_1_3');
}

const total = passed + failures.length;
console.log(`\nBible threshold anchors: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
