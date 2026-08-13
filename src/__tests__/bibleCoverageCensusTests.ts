/**
 * BIBLE-TO-CODE COVERAGE — SEAT_INBOX item 64, step two: the ratchet.
 *
 * **NOT ITEM 61.** `test:vocabulary-census` counts CODE-to-CODE drift — one
 * concept written as two word-lists inside the app. **This counts BIBLE-to-CODE
 * ABSENCE: a rule Sam wrote down that has no enforcer at all.** Different
 * corpus, different failure. **The two numbers must never be added.**
 *
 * ## THE SIGHTING THAT ORDERED IT
 *
 * Bible `:227` gives a lower day five slots. `sessionSlotCoverage.ts` CHECKS
 * five. `coachingEngine.ts` PLANS four and has never asked for a single-leg
 * slot. **Both files are correct on their own; nothing ever compared them to the
 * prose.** Sam: *"if everything is written down in the bible, why can the app
 * not even program single leg work?"* Every suite was green for months.
 *
 * ## WHAT IS DERIVED, NOT TYPED
 *
 * The item requires the mapping be machine-held and **derived where derivation
 * is possible**. It is, end to end, and this suite hand-types no mapping at all:
 *
 *   rule lines   `scripts/bible-rule-census.js`'s definition, re-implemented
 *                here over the same corpus.
 *   enforcers    `data/bibleThresholdAnchors.ts` — each entry quotes a Bible
 *                sentence verbatim and each is named by a `BIBLE_ANCHOR: <id>`
 *                marker in production code. **An anchor counts ONLY when both
 *                halves exist**, because a registry row nothing cites is a
 *                claim, and a marker citing no row is a dangling name.
 *   held lines   located by FINDING each anchor's quote in the Bible. No line
 *                number is written down anywhere; edit the Bible and the map
 *                moves with it.
 *
 * ## THE NUMBER, AND IT IS NOT COMFORTABLE
 *
 *     RULE LINES 1003 · HELD 8 · DEBT 995 · COVERAGE 0.8%
 *
 * **Eight.** The mechanism to cite the Bible from code exists, is bidirectional,
 * is tested — and reaches eight rule lines out of a thousand. That is the size
 * of this class, and the item asked for it ordered by what an athlete would
 * notice, which is in `docs/STATUS_BIBLE.md`, not here.
 *
 * DEPTH (L13): 0 — two source reads. It never generates a week. What it does NOT
 * measure is whether an enforcer is CORRECT; a line counts as held when a cited
 * enforcer names it, which is exactly the claim `:227` shows can be true while
 * the app does something else. **Coverage is not conformance.**
 *
 * Run: npm run test:bible-coverage
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0; let failed = 0; const failures: string[] = [];
function run(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1; failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const ROOT = path.join(__dirname, '..', '..');
const BIBLE_PATH = path.join(ROOT, 'docs', 'LFA_PROGRAMMING_BIBLE.md');
const ANCHORS_PATH = path.join(ROOT, 'src', 'data', 'bibleThresholdAnchors.ts');

// ── RULE LINES — the same definition as scripts/bible-rule-census.js ────────
const NORMATIVE = [
  /\bmust\b/i, /\bnever\b/i, /\balways\b/i, /\bonly\b/i, /\bmay not\b/i,
  /\bmay\b/i, /\bcannot\b/i, /\bcan ?not\b/i, /\bshould\b/i, /\bshall\b/i,
  /\bforbidden\b/i, /\billegal\b/i, /\brequired?\b/i, /\brequires\b/i,
  /\bexception\b/i, /\bat least\b/i, /\bat most\b/i, /\bmaximum\b/i,
  /\bminimum\b/i, /\bno more than\b/i, /\bno fewer than\b/i,
  /\bdoes not\b/i, /\bdo not\b/i, /\bis not\b/i, /\bare not\b/i,
  /\bcounts? (as|toward|against)\b/i, /\bper (week|session|day)\b/i, /->/,
];
const isHeading = (t: string): boolean => {
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^\d+(\.\d+)*\s/.test(t) && t.length < 80) return true;
  if (/^([*\-+|]|\d+[.)]\s)/.test(t)) return false;
  return t.length < 60 && !/[.!?:]$/.test(t);
};

const bibleLines = fs.readFileSync(BIBLE_PATH, 'utf8').split('\n');
let changelogFrom = bibleLines.length;
bibleLines.forEach((l, i) => {
  if (/^19\.\s*Amendment changelog/i.test(l.trim())) changelogFrom = i;
});
const ruleLineNumbers = new Set<number>();
bibleLines.forEach((raw, i) => {
  const line = raw.trim();
  if (!line || isHeading(line) || i >= changelogFrom) return;
  if (NORMATIVE.some((re) => re.test(line))) ruleLineNumbers.add(i + 1);
});

// ── ENFORCERS — derived from the anchor registry AND the code markers ───────
const anchorSrc = fs.readFileSync(ANCHORS_PATH, 'utf8');
const anchorIds = [...anchorSrc.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);

/** Every `BIBLE_ANCHOR: <id>` naming an anchor from production code. */
function markersInCode(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/__tests__|__scratch|node_modules/.test(full)) walk(full);
      } else if (/\.tsx?$/.test(entry.name) && full !== ANCHORS_PATH) {
        for (const m of fs.readFileSync(full, 'utf8').matchAll(/BIBLE_ANCHOR: *([a-z0-9_]+)/g)) {
          found.add(m[1]);
        }
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  return found;
}
const markers = markersInCode();

/** An anchor holds a Bible line only when BOTH halves exist and the quote lands. */
const heldLines = new Set<number>();
const unlocatable: string[] = [];
const uncited: string[] = [];
for (const block of anchorSrc.split(/id: '/).slice(1)) {
  const id = block.slice(0, block.indexOf("'"));
  if (!markers.has(id)) { uncited.push(id); continue; }
  const quoteMatch = /quote: ((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+)/.exec(block);
  if (!quoteMatch) { unlocatable.push(`${id} (no quote)`); continue; }
  const quote = [...quoteMatch[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((m) => m[1].replace(/\\'/g, "'")).join('');
  const probe = quote.slice(0, 60);
  const index = bibleLines.findIndex((l) => l.includes(probe));
  if (index < 0) { unlocatable.push(id); continue; }
  heldLines.add(index + 1);
}

const heldRuleLines = [...heldLines].filter((n) => ruleLineNumbers.has(n)).sort((a, b) => a - b);
const debt = ruleLineNumbers.size - heldRuleLines.length;

console.log('\n-- Bible-to-code coverage (SEAT_INBOX item 64) --');
console.log('   NOT item 61: that is code-to-code drift, this is bible-to-code ABSENCE.');

run('[1] NON-VACUITY — the corpus and the anchor registry both read',
  ruleLineNumbers.size > 500 && anchorIds.length > 0 && markers.size > 0,
  `rules=${ruleLineNumbers.size} anchors=${anchorIds.length} markers=${markers.size}`);

// THE FOUNDING CASE, ASSERTED IN BOTH DIRECTIONS. If :227 ever stops being seen
// as a rule, this census has gone blind on the exact line that ordered it; if it
// ever becomes held, that is a real win and this cell says so out loud.
run('[2] the founding sighting :227 is a RULE LINE and is NOT held',
  ruleLineNumbers.has(227) && !heldLines.has(227),
  `isRule=${ruleLineNumbers.has(227)} isHeld=${heldLines.has(227)} — if it is now HELD, `
  + 'delete this cell and bank the win in the ceiling below.');

// EVERY ANCHOR MUST BE CITED FROM CODE AND MUST LOCATE IN THE BIBLE. This is the
// derivation's integrity: a registry row nothing cites is a claim, and a quote
// that no longer appears is a Bible edit that silently withdrew its own support.
run('[3] every anchor is cited from code and its quote still lands in the Bible',
  uncited.length === 0 && unlocatable.length === 0,
  { uncited, unlocatable });

// ── THE RATCHET, BOTH DIRECTIONS ────────────────────────────────────────────
//
// MEASURED 2026-08-13, seat `bible`: RULE LINES 1003 · HELD 8 · DEBT 995.
//
// ⚠ THE FLOOR IS NOT SYMMETRY FOR ITS OWN SAKE. `patterns` proved on the ladder
// census the same day that a ceiling-only ratchet cannot tell "we fixed it" from
// "we stopped looking" — blind the oracle and it reads clean and green. Here the
// blinding is one predicate wide: narrow the rule-line definition and the debt
// falls without a single rule being enforced.
const DEBT_CEILING = 995;

run('[4] the Bible debt only falls',
  debt <= DEBT_CEILING,
  `${debt} rule lines have no named enforcer, above the ceiling of ${DEBT_CEILING}. `
  + 'Cite the rule from code with a BIBLE_ANCHOR marker and a registry entry — or '
  + 'raise this deliberately in the commit that adds the rule, never by drift.');

run('[5] a real improvement is BANKED — lower the ceiling in the commit that paid it',
  debt >= DEBT_CEILING - 10,
  `only ${debt} rule lines are unheld but the ceiling is still ${DEBT_CEILING}. `
  + 'If enforcers landed, lower DEBT_CEILING here in the same commit. If instead '
  + 'the rule-line DEFINITION narrowed, that is the defect — the debt fell because '
  + 'the census stopped looking, not because a rule got enforced.');

console.log(`\nBIBLE COVERAGE CENSUS: ${heldRuleLines.length} of ${ruleLineNumbers.size} rule lines `
  + `have a named enforcer — DEBT ${debt} (ceiling ${DEBT_CEILING}), coverage `
  + `${((heldRuleLines.length / ruleLineNumbers.size) * 100).toFixed(1)}%`);
console.log(`  held rule lines: ${heldRuleLines.join(', ')}`);
console.log(`  anchors: ${anchorIds.length} registry entries, ${markers.size} cited from code, `
  + `${heldLines.size} Bible lines located`);

console.log(`\nBible coverage census: ${passed} passed, ${failed} failed`);
console.log('  DEPTH (L13): 0 — two source reads. Coverage is NOT conformance: a line '
  + 'counts as held when a cited enforcer names it, which :227 shows can be true '
  + 'while the app does something else.');
totalsPrinted(failed);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
