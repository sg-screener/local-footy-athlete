/**
 * THE SAME FACT IN TWO VOCABULARIES — SEAT_INBOX item 61, censused.
 *
 * **THE CLASS, in the item's own words:** *"one concept, two word-lists, no
 * total mapping, and the gap is SILENT — an unmapped value becomes an empty
 * result or a plausible neighbour instead of an error."* Three sightings were
 * found by three different seats on 2026-08-13 before anyone noticed they were
 * one shape:
 *
 *   1. **Conditioning** — `categoryToFlavour` DECLARES `: CondFlavour` and its
 *      switch covers 5 of `CondCategory`'s 6. `cod_decel` returns `undefined`
 *      at every call site, which is why COD cannot be placed at all.
 *   2. **Equipment** — the library requires `Cable Machine`, `Trap Bar`,
 *      `Rack`; the athlete ticks `cables`, `machine`, `barbell`. The bridge is
 *      a 20-branch regex chain over a bare `string`, and
 *      `equipmentRequirementsAreAvailable` says in its own doc that **unknown
 *      labels PASS**.
 *   3. **Away** — *"I'm away"* stored in two formats, each half of the app
 *      reading one.
 *
 * ## WHAT THIS SUITE IS AND IS NOT
 *
 * It is **a census with a ratchet**, not a fix. The item asks for the count —
 * *"that number is the size of this class, and nobody knows it yet"* — and the
 * count is worth nothing if it can climb back while nobody looks. So the number
 * is measured here, pinned, and allowed only to fall.
 *
 * **IT DOES NOT FIX ANY OF THE 93.** Ninety-three sites is not one unit, several
 * of them move generated output, and the sharpest one (`categoryToFlavour`) is a
 * DESIGN call this repo has already priced: `CondFlavour` is
 * `aerobic | tempo | high-intensity` and `flavourToCategory` maps
 * `high-intensity` back to `glycolytic`, so **any** mapping makes COD return as
 * a different category — the 4A ruling forbids exactly that. A census that
 * quietly "fixed" it by picking a flavour would be inventing law.
 *
 * ## HOW IT COUNTS, AND WHY THE INSTRUMENT IS GATED
 *
 * A **VOCABULARY** is a type alias whose body is a union of ≥2 string literals
 * (aliases resolved one level, so `type CondCategory = OffseasonConditioning
 * Category` counts as its target's word-list).
 *
 * A **CROSSWALK** is a function or `Record<>` translating one vocabulary into
 * another. It is **TOTAL** when the compiler can prove every input member has an
 * output: a `Record<A, B>` over a union, or an exhaustive switch with no escape
 * hatch. It is **NOT TOTAL** when the input side is a bare `string`, when the
 * return admits `null`/`undefined`, when the map is `Partial<Record<>>`, or when
 * a signature declares totality its body does not deliver.
 *
 * **THE PARSER IS GATED ON THE THREE KNOWN SIGHTINGS AND THAT IS THE POINT.**
 * Four successive versions of it MISSED them — first a line-at-a-time regex
 * (every one of the three has a multi-line signature), then one blind to
 * comments interleaved in a union (`EquipmentTag` has prose between its
 * members), then one blind to `type A = B` aliases, then one blind to inline
 * literal unions in a parameter. **A census instrument that cannot find the
 * cases you already know about is measuring its own blind spot**, and this seat
 * published a wrong count from exactly that hole an hour earlier. So cells [1]
 * and [2] re-find all three, by name, and the number is not reported unless they
 * are found.
 *
 * DEPTH (L13): 0 — a source read. It never generates a week, so no athlete
 * state can change what it says. What it does NOT measure is whether an
 * unchecked crosswalk is REACHED at runtime; a site is counted for being
 * uncheckABLE, which is the claim.
 *
 * Run: npm run test:vocabulary-census
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

let passed = 0; let failed = 0; const failures: string[] = [];
function run(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1; failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const ROOT = path.join(__dirname, '..');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/__tests__|__scratch|node_modules/.test(full) && !/dev[/\\]e2e/.test(full)) {
        sourceFiles(full, acc);
      }
    } else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Comments go FIRST — prose interleaved in a union hid the whole equipment
 *  sighting from three versions of this parser. */
const decomment = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const FILES = sourceFiles(path.join(ROOT)).filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`));
const CLEAN = new Map(FILES.map((f) => [f, decomment(fs.readFileSync(f, 'utf8'))] as const));

// ── VOCABULARIES ───────────────────────────────────────────────────────────
const vocab = new Map<string, string[]>();
const aliasOf = new Map<string, string>();
for (const file of FILES) {
  const re = /(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  const src = CLEAN.get(file)!;
  while ((m = re.exec(src))) {
    const literals = m[2].match(/'[^']+'/g) ?? [];
    const remainder = m[2].replace(/'[^']+'/g, '').replace(/[\s|]/g, '');
    if (literals.length >= 2 && remainder === '') {
      vocab.set(m[1], literals.map((s) => s.slice(1, -1)));
    } else if (/^[A-Za-z0-9_]+$/.test(m[2].trim())) {
      aliasOf.set(m[1], m[2].trim());
    }
  }
}
for (const [name, target] of aliasOf) {
  if (vocab.has(target) && !vocab.has(name)) vocab.set(name, vocab.get(target)!);
}
const isVocab = (n: string): boolean => vocab.has(n);
const bare = (t: string): string => t.replace(/readonly\s+/g, '').replace(/\[\]/g, '').trim();
const membersOf = (t: string): string[] | null => {
  if (isVocab(t)) return vocab.get(t)!;
  const literals = t.match(/'[^']+'/g);
  return literals ? literals.map((s) => s.slice(1, -1)) : null;
};

// ── CROSSWALKS ─────────────────────────────────────────────────────────────
interface Crosswalk {
  file: string; line: number; site: string;
  from: string; to: string; total: boolean; why: string;
}
const crosswalks: Crosswalk[] = [];
const PARAM_TYPE = "(?:[A-Za-z0-9_]+|(?:'[^']+'\\s*(?:\\|\\s*'[^']+'\\s*)+))";
const FN = new RegExp(
  '(?:function\\s+([A-Za-z0-9_]+)|const\\s+([A-Za-z0-9_]+)\\s*=)\\s*\\(\\s*[A-Za-z0-9_]+\\s*:\\s*('
  + PARAM_TYPE + ')[\\s\\S]{0,400}?\\)\\s*:\\s*((?:readonly\\s+)?[A-Za-z0-9_]+(?:\\[\\])?)'
  + '((?:\\s*\\|\\s*(?:null|undefined))*)\\s*\\{', 'g');
const MAP = /(Partial<)?Record<\s*([A-Za-z0-9_]+)\s*,\s*((?:readonly\s+)?[A-Za-z0-9_]+(?:\[\])?)\s*>/g;

for (const file of FILES) {
  const src = CLEAN.get(file)!;
  const lineAt = (index: number): number => src.slice(0, index).split('\n').length;
  let m: RegExpExecArray | null;
  FN.lastIndex = 0;
  while ((m = FN.exec(src))) {
    const site = `fn ${m[1] ?? m[2]}`;
    const from = m[3].trim();
    const to = bare(m[4]);
    const optional = (m[5] ?? '').replace(/\s/g, '');
    if (!isVocab(to) || from === to) continue;
    const inputMembers = membersOf(from);
    if (!inputMembers && from !== 'string') continue;
    // Body exhaustiveness — a signature that CLAIMS totality its switch does
    // not deliver is the sharpest form of this defect and the live COD wall.
    const after = src.slice(m.index + m[0].length);
    let depth = 1; let end = 0;
    while (end < after.length && depth > 0) {
      const c = after[end]; if (c === '{') depth += 1; else if (c === '}') depth -= 1; end += 1;
    }
    const body = after.slice(0, end);
    const cases = new Set((body.match(/case\s+'[^']+'/g) ?? [])
      .map((s) => /'([^']+)'/.exec(s)![1]));
    const hasDefault = /\bdefault\s*:/.test(body);
    let total: boolean; let why: string;
    if (from === 'string') {
      total = false; why = 'input side is untyped `string` — there is no word-list to check against';
    } else if (optional) {
      total = false; why = `returns \`${optional}\` — an unmapped member is a silent miss`;
    } else if (cases.size > 0 && !hasDefault && inputMembers && cases.size < inputMembers.length) {
      total = false;
      why = `DECLARED TOTAL AND IS NOT — switch covers ${cases.size} of ${inputMembers.length}, `
        + `missing: ${inputMembers.filter((x) => !cases.has(x)).join(', ')}`;
    } else { total = true; why = 'union in, union out, exhaustive'; }
    crosswalks.push({
      file, line: lineAt(m.index), site,
      from: isVocab(from) ? from : (inputMembers ? `inline(${inputMembers.length})` : from),
      to, total, why,
    });
  }
  MAP.lastIndex = 0;
  while ((m = MAP.exec(src))) {
    const from = m[2]; const to = bare(m[3]);
    if (!isVocab(from) || !isVocab(to) || from === to) continue;
    crosswalks.push({
      file, line: lineAt(m.index), site: 'map', from, to, total: !m[1],
      why: m[1] ? 'Partial<Record<> — the compiler permits a missing key'
        : 'Record<> over a union — compiler-enforced',
    });
  }
}

const unchecked = crosswalks.filter((c) => !c.total);
const conceptsAtRisk = new Set(unchecked.map((c) => c.to));

console.log('\n-- The same fact in two vocabularies (SEAT_INBOX item 61) --');

// ── 1-2. THE INSTRUMENT IS GATED ON WHAT WE ALREADY KNOW ────────────────────
const findSite = (name: string): Crosswalk | undefined =>
  crosswalks.find((c) => c.site === `fn ${name}`);

run('[1] NON-VACUITY — the parser found vocabularies and crosswalks at all',
  vocab.size > 100 && crosswalks.length > 20,
  `${vocab.size} vocabularies, ${crosswalks.length} crosswalks`);

// EVERY ONE OF THE THREE HAS A MULTI-LINE SIGNATURE, AND FOUR PARSER VERSIONS
// MISSED THEM. This cell is the reason the number below can be believed.
run('[2] the three KNOWN sightings are re-found by name',
  !!findSite('equipmentTagsForRequirement')
  && !!findSite('categoryToFlavour')
  && !!findSite('flavourToCategory'),
  {
    equipment: findSite('equipmentTagsForRequirement')?.why ?? 'MISSED',
    conditioning: findSite('categoryToFlavour')?.why ?? 'MISSED',
    inverse: findSite('flavourToCategory')?.why ?? 'MISSED',
  });

run('[2b] and the two that are NOT total are classified as such',
  findSite('equipmentTagsForRequirement')?.total === false
  && findSite('categoryToFlavour')?.total === false,
  {
    equipment: findSite('equipmentTagsForRequirement')?.total,
    conditioning: findSite('categoryToFlavour')?.why,
  });

// THE INVERSE IS EXHAUSTIVE ON ITS OWN THREE MEMBERS AND IS STILL HALF OF THE
// DEFECT — six categories go in as three flavours and three come back, so COD
// returns as `glycolytic`. Asserted so nobody "fixes" it by adding a case.
run('[3] the conditioning pair is LOSSY, not merely incomplete',
  findSite('flavourToCategory')?.total === true,
  'flavourToCategory is exhaustive; the loss is the round trip, which is a '
  + 'DESIGN call (4A: flavour/category/label/stress must agree), not a missing case');

// ── 4. THE CENSUS, RATCHETED BOTH WAYS ──────────────────────────────────────
//
// MEASURED 2026-08-13, seat `arms`, inbox item 61:
//   459 vocabularies · 123 crosswalks · 30 compile-checked · 93 NOT total
//   across 59 distinct concepts, and 80 of the 93 share ONE cause:
//   the input side is a bare `string`.
//
// ⚠ THE CEILING IS PAIRED WITH A FLOOR, and that is not symmetry for its own
// sake: `patterns` proved on the ladder census the same day that a
// ceiling-only ratchet cannot tell "we fixed it" from "we stopped looking" —
// blind the oracle and it reads clean and green. The floor makes a big
// improvement RED until the author banks it by lowering the ceiling.
const UNCHECKED_CEILING = 93;

run('[4] no more unchecked crosswalks than when this was measured',
  unchecked.length <= UNCHECKED_CEILING,
  `${unchecked.length} unchecked crosswalks, above the ceiling of ${UNCHECKED_CEILING}. `
  + 'Make the translation total (a `Record<A, B>` over the union, or an '
  + 'exhaustive switch with no escape hatch) — or raise this deliberately in the '
  + 'commit that adds the site, never by drift.');

run('[4b] a real improvement is BANKED — lower the ceiling in the commit that paid it',
  unchecked.length >= UNCHECKED_CEILING - 10,
  `only ${unchecked.length} unchecked but the ceiling is still ${UNCHECKED_CEILING}. `
  + 'If a batch was made total, lower UNCHECKED_CEILING to the new number here. '
  + 'If instead the PARSER stopped seeing them, that is the defect — a census '
  + 'that reads clean because it went blind is worse than no census.');

console.log(`\nVOCABULARY CROSSWALK CENSUS: ${unchecked.length} unchecked of `
  + `${crosswalks.length} crosswalks (ceiling ${UNCHECKED_CEILING}) across `
  + `${conceptsAtRisk.size} concepts, from ${vocab.size} vocabularies`);

const causes = new Map<string, number>();
for (const c of unchecked) {
  const key = c.why.split('—')[0].trim();
  causes.set(key, (causes.get(key) ?? 0) + 1);
}
console.log('  by cause:');
for (const [key, n] of [...causes].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${key}`);
}

console.log(`\nVocabulary crosswalk census: ${passed} passed, ${failed} failed`);
console.log('  DEPTH (L13): 0 — a source read. Whether an unchecked crosswalk is '
  + 'REACHED at runtime is NOT covered; a site counts for being uncheckABLE.');
totalsPrinted(failed);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
