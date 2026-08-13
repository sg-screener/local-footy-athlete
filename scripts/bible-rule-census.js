#!/usr/bin/env node
/**
 * THE BIBLE RULE CENSUS — SEAT_INBOX item 64, step one.
 *
 * **THIS IS NOT ITEM 61.** Item 61 (`vocab`) counts CODE-to-CODE drift: one
 * concept written as two word-lists inside the app. This counts BIBLE-to-CODE
 * ABSENCE: a rule that exists in Sam's prose and has no enforcer at all.
 * Different corpus, different number, and they must never be added together.
 *
 * ## THE DEFINITION, STATED BEFORE THE NUMBER
 *
 * A **RULE LINE** is a non-empty line of `docs/LFA_PROGRAMMING_BIBLE.md` that is
 * NORMATIVE — it says what the app must, must not, or always does — decided by
 * three mechanical tests applied in order. No per-line judgement is made.
 *
 *   1. NOT A HEADING. A heading is a line under 60 characters with no
 *      sentence-ending punctuation, or a section-numbered line (`3.`, `20.5`).
 *      Headings name territory; they do not rule.
 *   2. NOT HISTORY. Section 19 (the amendment changelog) records what CHANGED
 *      and when. Those lines are normative in grammar and settled in fact —
 *      counting them would inflate the census with the app's own diary. The
 *      boundary is stated and the excluded count is printed, so nobody has to
 *      take my word for the size of the exclusion.
 *   3. CARRIES A NORMATIVE TOKEN — a modal, a prohibition, a threshold, or an
 *      ordering arrow. The token list is printed with the result.
 *
 * **THE DEFINITION IS DELIBERATELY WIDE.** It over-counts rather than under-
 * counts, because the item's own warning is *"if the number is in the thousands,
 * say so; do not quietly narrow the definition until it is comfortable."* Every
 * narrowing here is a NAMED CATEGORY with its own count, so the number can be
 * re-derived at any width.
 *
 * Run: node scripts/bible-rule-census.js
 */

const fs = require('fs');
const path = require('path');

const BIBLE = path.join(__dirname, '..', 'docs', 'LFA_PROGRAMMING_BIBLE.md');

/** Modals, prohibitions, thresholds and ordering arrows. */
const NORMATIVE = [
  /\bmust\b/i, /\bnever\b/i, /\balways\b/i, /\bonly\b/i, /\bmay not\b/i,
  /\bmay\b/i, /\bcannot\b/i, /\bcan ?not\b/i, /\bshould\b/i, /\bshall\b/i,
  /\bforbidden\b/i, /\billegal\b/i, /\brequired?\b/i, /\brequires\b/i,
  /\bexception\b/i, /\bat least\b/i, /\bat most\b/i, /\bmaximum\b/i,
  /\bminimum\b/i, /\bno more than\b/i, /\bno fewer than\b/i,
  /\bdoes not\b/i, /\bdo not\b/i, /\bis not\b/i, /\bare not\b/i,
  /\bcounts? (as|toward|against)\b/i, /\bper (week|session|day)\b/i,
  /->/,
];

const HEADING_MAX = 60;
/**
 * ⚠ THE FIRST VERSION OF THIS CALLED 1,846 LINES HEADINGS, and it was wrong in
 * a way worth keeping on the record: `* Barbell work` and `Avoid / reduce` are
 * CONTENT — a bullet is a list item, never a section title. A bullet, a table
 * row or a numbered list entry is content by construction, whatever its length.
 * The over-wide version is still runnable with `--wide-headings` so the
 * sensitivity of the whole census to this one test can be seen, not asserted.
 */
const WIDE = process.argv.includes('--wide-headings');
const isHeading = (line) => {
  const t = line.trim();
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^\d+(\.\d+)*\s/.test(t) && t.length < 80) return true;
  if (!WIDE && /^([*\-+|]|\d+[.)]\s)/.test(t)) return false;
  return t.length < HEADING_MAX && !/[.!?:]$/.test(t);
};

const lines = fs.readFileSync(BIBLE, 'utf8').split('\n');

// Section 19 is the amendment changelog and runs to the end of the file.
let changelogFrom = lines.length;
lines.forEach((l, i) => {
  if (/^19\.\s*Amendment changelog/i.test(l.trim())) changelogFrom = i;
});

const rules = []; const headings = []; const history = []; const narrative = [];
lines.forEach((raw, i) => {
  const line = raw.trim();
  const n = i + 1;
  if (!line) return;
  if (isHeading(line)) { headings.push({ n, line }); return; }
  if (i >= changelogFrom) { history.push({ n, line }); return; }
  if (NORMATIVE.some((re) => re.test(line))) rules.push({ n, line });
  else narrative.push({ n, line });
});

const clip = (s, w = 108) => (s.length > w ? `${s.slice(0, w - 1)}…` : s);

console.log('\n══ BIBLE RULE CENSUS — SEAT_INBOX item 64, step one ══');
console.log('    NOT item 61. That is code-to-code drift; this is bible-to-code ABSENCE.\n');
console.log(`  corpus                 docs/LFA_PROGRAMMING_BIBLE.md, ${lines.length} lines`);
console.log(`  RULE LINES             ${rules.length}`);
console.log(`  headings (excluded)    ${headings.length}`);
console.log(`  changelog (excluded)   ${history.length}   — section 19, from line ${changelogFrom + 1}`);
console.log(`  narrative (no token)   ${narrative.length}`);
console.log(`  accounted              ${rules.length + headings.length + history.length + narrative.length}`
  + ` of ${lines.filter((l) => l.trim()).length} non-empty`);

console.log('\n── TWENTY THE DEFINITION CAUGHT ──');
const step = Math.max(1, Math.floor(rules.length / 20));
rules.filter((_, i) => i % step === 0).slice(0, 20)
  .forEach((r) => console.log(`  :${String(r.n).padStart(4)}  ${clip(r.line)}`));

console.log('\n── FIVE IT DELIBERATELY DID NOT ──');
const misses = [
  ...headings.slice(Math.floor(headings.length / 2), Math.floor(headings.length / 2) + 2)
    .map((h) => ({ ...h, why: 'HEADING — names territory, rules nothing' })),
  ...narrative.slice(Math.floor(narrative.length / 3), Math.floor(narrative.length / 3) + 2)
    .map((h) => ({ ...h, why: 'NARRATIVE — no normative token; states purpose or context' })),
  ...history.slice(0, 1)
    .map((h) => ({ ...h, why: 'CHANGELOG — records what changed, does not rule' })),
];
misses.forEach((m) => console.log(`  :${String(m.n).padStart(4)}  ${clip(m.line, 88)}\n         ${m.why}`));

console.log('\n── THE TOKENS ──');
console.log(`  ${NORMATIVE.map((r) => String(r).replace(/^\/\\b|\\b\/i?$|^\/|\/i?$/g, '')).join(' · ')}`);
console.log('');

if (process.argv.includes('--json')) {
  fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1],
    JSON.stringify({ rules, headings, history, narrative }, null, 1));
}
