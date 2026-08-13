#!/usr/bin/env node
/**
 * BIBLE GAP TRIAGE — SEAT_INBOX item 64, step three. Sam, 2026-08-13:
 * *"triage the 995 into three buckets and only report the third. Grep each
 * rule's distinctive words; if the concept appears nowhere in the codebase,
 * that's a real gap."*
 *
 * ## THE THREE BUCKETS
 *
 *   1. BUILT — the rule's distinctive words appear in PRODUCTION code. The
 *      concept exists; only the citation is missing. Not a gap.
 *   2. TEST/DOC ONLY — the words appear in the repo but only in suites or docs.
 *      Ambiguous: something knows the word, no shipped code does.
 *   3. **ABSENT — the concept appears NOWHERE.** A rule Sam wrote that the
 *      codebase has never heard of. **This is the only bucket reported.**
 *
 * ## HOW A "DISTINCTIVE WORD" IS CHOSEN, MECHANICALLY
 *
 * Rare, content-bearing terms: alphabetic tokens of 4+ characters, minus
 * English/football stopwords, minus any token appearing in more than 2% of rule
 * lines (a word used everywhere distinguishes nothing). A line with no
 * distinctive term is UNJUDGEABLE and reported separately rather than counted
 * as a gap — absence of a term is not absence of a concept.
 *
 * ## MATCHING IS CASE- AND SEPARATOR-BLIND, WHICH IS THE WHOLE DIFFICULTY
 *
 * The Bible says *"single-leg knee-dominant"*; the code says `single_leg_knee`
 * and `singleLegKnee`. Both sides are flattened to lowercase letters only, so
 * `singleleg` matches all three spellings. **Without this every rule reads as a
 * gap and the census would report 995 catastrophes.**
 *
 * ## THE NUMBER IS NOT IMPROVED BY NARROWING
 *
 * Sam: *"don't narrow the rule-line definition to improve the percentage."* The
 * rule-line definition is imported unchanged from the step-one census. This
 * script only SORTS the 995; it cannot change how many there are.
 *
 * Run: node scripts/bible-gap-triage.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ── 1. THE RULE LINES — the step-one definition, unchanged ─────────────────
const NORMATIVE = [
  /\bmust\b/i, /\bnever\b/i, /\balways\b/i, /\bonly\b/i, /\bmay not\b/i,
  /\bmay\b/i, /\bcannot\b/i, /\bcan ?not\b/i, /\bshould\b/i, /\bshall\b/i,
  /\bforbidden\b/i, /\billegal\b/i, /\brequired?\b/i, /\brequires\b/i,
  /\bexception\b/i, /\bat least\b/i, /\bat most\b/i, /\bmaximum\b/i,
  /\bminimum\b/i, /\bno more than\b/i, /\bno fewer than\b/i,
  /\bdoes not\b/i, /\bdo not\b/i, /\bis not\b/i, /\bare not\b/i,
  /\bcounts? (as|toward|against)\b/i, /\bper (week|session|day)\b/i, /->/,
];
const isHeading = (t) => {
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^\d+(\.\d+)*\s/.test(t) && t.length < 80) return true;
  if (/^([*\-+|]|\d+[.)]\s)/.test(t)) return false;
  return t.length < 60 && !/[.!?:]$/.test(t);
};
const bible = fs.readFileSync(path.join(ROOT, 'docs', 'LFA_PROGRAMMING_BIBLE.md'), 'utf8').split('\n');
let changelogFrom = bible.length;
bible.forEach((l, i) => { if (/^19\.\s*Amendment changelog/i.test(l.trim())) changelogFrom = i; });
const rules = [];
bible.forEach((raw, i) => {
  const line = raw.trim();
  if (!line || isHeading(line) || i >= changelogFrom) return;
  if (NORMATIVE.some((re) => re.test(line))) rules.push({ n: i + 1, line });
});

// ── 2. THE CODEBASE, FLATTENED ─────────────────────────────────────────────
/**
 * ⚠ THE FIRST MATCHER FLATTENED THE WHOLE CODEBASE TO ONE STRING AND USED
 * `includes()`. IT WAS WORTHLESS AND THE CONTROLS PROVED IT: `tuba` matched,
 * and so did `ncil`, `tion`, `rate`, `oral` — any four letters that happen to
 * fall inside some identifier. It reported 953 of 995 rules as BUILT, which is
 * a fact about substring collisions and nothing about the app.
 *
 * This one indexes TOKENS: every identifier and string in the source, split on
 * camelCase, snake_case and hyphens, lowercased. `single_leg_knee` yields
 * `single`, `leg`, `knee`, so the Bible's "single-leg knee-dominant" matches on
 * its parts and `tuba` matches nothing.
 */
const tokenise = (s) => s
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .toLowerCase()
  .split(/[^a-z]+/)
  .filter((t) => t.length >= 4);
const tokenSet = (files) => {
  const set = new Set();
  for (const f of files) for (const t of tokenise(fs.readFileSync(f, 'utf8'))) set.add(t);
  return set;
};
function collect(dir, pred, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(full)) collect(full, pred, acc); }
    else if (pred(full)) acc.push(full);
  }
  return acc;
}
const srcFiles = collect(path.join(ROOT, 'src'), (f) => /\.tsx?$/.test(f));
const prodFiles = srcFiles.filter((f) => !/__tests__|__scratch/.test(f));
const testFiles = srcFiles.filter((f) => /__tests__/.test(f));
const PROD = tokenSet(prodFiles);
const TEST = tokenSet(testFiles);

// ── 3. DISTINCTIVE TERMS ───────────────────────────────────────────────────
const STOP = new Set(('the a an and or of to in is it that this for on at as be are was not no do does if they '
  + 'their them you your he his we so but with from by has have had can will just only more than when what which '
  + 'who how any all one its there here now then been were out about into over under after before both each '
  + 'should must never always may cannot shall per week day session sessions week weeks days also very same '
  + 'other another these those such would could also every some most least more less first second third '
  + 'app athlete athletes training train trained session work working rules rule sam').split(/\s+/));
const termsOf = (line) => [...new Set((line.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [])
  .flatMap((t) => t.split('-')).filter((t) => t.length >= 4 && !STOP.has(t)))];

const df = new Map();
rules.forEach((r) => { for (const t of termsOf(r.line)) df.set(t, (df.get(t) ?? 0) + 1); });
const COMMON = Math.max(3, Math.ceil(rules.length * 0.02));
const distinctive = (line) => termsOf(line).filter((t) => (df.get(t) ?? 0) <= COMMON);

// ── 4. TRIAGE ──────────────────────────────────────────────────────────────
const held = new Set([105, 110, 132, 4890, 4898, 4904, 4908, 4918]);
const built = []; const testOnly = []; const absent = []; const unjudgeable = [];
for (const r of rules) {
  if (held.has(r.n)) continue;
  const terms = distinctive(r.line);
  if (terms.length === 0) { unjudgeable.push(r); continue; }
  const missing = terms.filter((t) => !PROD.has(t));
  const coverage = (terms.length - missing.length) / terms.length;
  const row = { ...r, terms, missing, coverage };
  if (terms.some((t) => PROD.has(t))) built.push(row);
  else if (terms.some((t) => TEST.has(t))) testOnly.push(row);
  else absent.push(row);
}

/**
 * ⚠ THE STRICT TEST IS NEARLY BLIND AND THIS TIER IS THE EVIDENCE.
 * "Absent" means EVERY distinctive term is missing from production code, and the
 * codebase contains almost every football word, so it fires once in 995. The
 * founding case proves the weakness rather than being caught by it: `:227`
 * scores BUILT because `single_leg_knee` IS a `SessionSlot` — the word is there
 * and the planner still never asks for it. **Word present, rule absent.**
 * So this tier reports lines where MOST of the distinctive vocabulary is
 * missing: a weaker claim, honestly labelled, and the only one with any
 * discriminating power at this granularity.
 */
const thin = built.filter((r) => r.coverage < 0.5).sort((a, b) => a.coverage - b.coverage);

// ── 5. RANK BY WHAT AN ATHLETE WOULD NOTICE ────────────────────────────────
// Weighted by whether the rule governs what lands in a SESSION (a lift, a dose,
// a day) rather than an internal concern. Sam: "rank by what an athlete would
// notice, not by how easy they are."
const NOTICE = [
  [/\b(exercise|lift|squat|hinge|press|pull|row|lunge|curl|sprint|run|jump)\w*/i, 3],
  [/\b(set|rep|dose|minute|second|distance|metre|meter|km)\w*/i, 3],
  [/\b(session|day|week|rest|recovery|deload|warm-?up)\w*/i, 2],
  [/\b(injur|pain|sore|sick|risk|safe)\w*/i, 3],
  [/\b(game|match|team training|fixture)\w*/i, 2],
];
const noticeScore = (line) => NOTICE.reduce((s, [re, w]) => s + (re.test(line) ? w : 0), 0);
absent.forEach((a) => { a.score = noticeScore(a.line); });
absent.sort((a, b) => b.score - a.score || a.n - b.n);
thin.forEach((t) => { t.score = noticeScore(t.line); });
thin.sort((a, b) => b.score - a.score || a.coverage - b.coverage);

// ── 6. VALIDATION — both directions, before any number is believed ─────────
const probe = (n) => (built.find((r) => r.n === n) ? 'BUILT'
  : testOnly.find((r) => r.n === n) ? 'TEST-ONLY'
  : absent.find((r) => r.n === n) ? 'ABSENT'
  : unjudgeable.find((r) => r.n === n) ? 'UNJUDGEABLE' : 'held/absent-from-corpus');
console.log('\n── VALIDATION: the triage must place two known cases correctly ──');
console.log(`  :227 the single-leg ladder  -> ${probe(227)}`
  + '   (must be BUILT: `single_leg_knee` IS a SessionSlot; the concept exists, the enforcement does not)');
const accel = rules.find((r) => /acceleration/i.test(r.line) && !/deceleration/i.test(r.line));
if (accel) {
  console.log(`  :${accel.n} an acceleration rule  -> ${probe(accel.n)}`);
}
const CONTROLS=['zzzznotaword','flibbertigibbet','quokka','marzipan','tuba','walrus','lentil','bagpipe','ncil','tion'];
const falseMatches=CONTROLS.filter((c)=>PROD.has(c));
console.log(`  nonsense controls that FALSELY match: ${falseMatches.length} of ${CONTROLS.length}` + (falseMatches.length?` -> ${falseMatches.join(', ')}`:' (matcher is clean)'));
console.log(`  token index: ${PROD.size} distinct production tokens`);

console.log('\n══ BIBLE GAP TRIAGE — the 995, sorted ══');
console.log(`  1. BUILT (words in production code, citation missing)   ${built.length}`);
console.log(`  2. TEST/DOC ONLY (no production code knows the word)    ${testOnly.length}`);
console.log(`  3. ABSENT — the codebase has never heard of it          ${absent.length}`);
console.log(`     unjudgeable (no distinctive term)                    ${unjudgeable.length}`);
console.log(`     total                                               ${built.length + testOnly.length + absent.length + unjudgeable.length} of ${rules.length - held.size}`);

console.log('\n── BUCKET 3, STRICT: EVERY distinctive term missing ──');
absent.forEach((a) => {
  console.log(`  [notice ${a.score}] :${String(a.n).padStart(4)}  ${a.line.slice(0, 100)}`);
  console.log(`         nowhere in the codebase: ${a.terms.slice(0, 6).join(', ')}`);
});

console.log('\n── ⚠ AND THE STRICT TEST IS NEARLY BLIND. THE EVIDENCE IS THE FOUNDING CASE ──');
console.log('  :227 scores BUILT because `single_leg_knee` IS a SessionSlot — the word is');
console.log('  there and the planner still never asks for it. WORD PRESENT, RULE ABSENT.');
console.log('  Word-presence cannot tell a built rule from an unbuilt one, so the strict');
console.log('  bucket firing once in 995 is a fact about the METHOD, not about the app.\n');
console.log(`── THE WEAKER CUT WITH ACTUAL DISCRIMINATING POWER: most vocabulary missing (${thin.length} lines) ──`);
thin.slice(0, 20).forEach((t) => {
  console.log(`  [notice ${t.score}] ${Math.round(t.coverage * 100)}% known  :${String(t.n).padStart(4)}  ${t.line.slice(0, 84)}`);
  console.log(`         missing: ${t.missing.slice(0, 6).join(', ')}`);
});
console.log('');

// ── 7. COVERAGE DISTRIBUTION — the evidence for the method's weakness ───────
if (process.argv.includes('--distribution')) {
  const buckets = {};
  built.forEach((r) => { const b = Math.floor(r.coverage * 10) / 10; buckets[b] = (buckets[b] ?? 0) + 1; });
  console.log('COVERAGE DISTRIBUTION of the BUILT lines — fraction of distinctive terms the code knows:');
  Object.keys(buckets).sort((a, b) => a - b)
    .forEach((k) => console.log(`  ${(k * 100).toFixed(0).padStart(3)}%  ${String(buckets[k]).padStart(4)} lines`));
  console.log('\nTHE SIX LOWEST-COVERAGE LINES:');
  built.slice().sort((a, b) => a.coverage - b.coverage).slice(0, 6).forEach((r) => {
    console.log(`  ${String(Math.round(r.coverage * 100)).padStart(3)}%  :${r.n}  ${r.line.slice(0, 78)}`);
    console.log(`         missing: ${r.missing.join(', ')}`);
  });
}

if (process.argv.includes('--explain')) {
  const n = Number(process.argv[process.argv.indexOf('--explain') + 1]);
  const row = [...built, ...absent, ...testOnly].find((r) => r.n === n)
    ?? unjudgeable.find((r) => r.n === n);
  const r = rules.find((x) => x.n === n);
  console.log(`:${n}  ${r ? r.line : '(not a rule line)'}`);
  console.log(`  all terms        ${termsOf(r.line).join(', ')}`);
  console.log(`  distinctive      ${distinctive(r.line).join(', ')}`);
  if (row && row.missing) console.log(`  missing from code ${row.missing.join(', ') || '(none)'}`);
}
