/**
 * THE RULINGS FILE AND THE SHEET ARE EQUAL, BOTH DIRECTIONS.
 *
 * `artifacts/COPY_SHEET_RULINGS_2026-07-30.md` is the AUTHORING SOURCE — Sam's
 * signed rulings, compiled conversationally via Cowork. Sam's instruction: "it is
 * equality-bound both directions once implemented."
 *
 * Both directions, because one direction is worthless:
 *   - every REPLACEMENT Sam signed must actually be in the code, or the app still
 *     says the thing he replaced;
 *   - every string he RETIRED must be gone, or both versions ship;
 *   - and no signed-copy entry may exist that he never ruled, or the sheet has
 *     grown its own vocabulary — which is the defect wearing a process.
 *
 * This is the cue-reconciliation pattern (`test:cue-join`, "the muscle sheet owns
 * cues BOTH directions") applied to sentences.
 *
 * WHAT IS ENFORCED TODAY. Batches 1-3 are signed in the file; batch 4 is pending.
 * The suite parses the file, and for every REPLACEMENT ruling asserts the new
 * wording is present in the named surface and the old wording is absent. It does
 * not yet require every string to be `SignedCopy` — that is the surface rewiring,
 * and it needs batch 4 plus the retirement of sentence-assembly the file's own
 * terminal note flags ("line 455 fragment 'this session' suggests
 * sentence-assembly in code — retire composition-by-concatenation, don't sign
 * fragments").
 *
 * Run: npm run test:copy-rulings-binding
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}

const ROOT = path.join(__dirname, '..', '..');
const RULINGS = path.join(ROOT, 'artifacts', 'COPY_SHEET_RULINGS_2026-07-30.md');

/**
 * Every REPLACEMENT Sam signed, as (old, new) pairs.
 *
 * Parsed from the file rather than transcribed, so the file stays the source: a
 * transcription would be a second copy of the rulings, which is the shape being
 * removed everywhere else in this unit.
 */
function replacements(): { old: string; next: string }[] {
  const text = fs.readFileSync(RULINGS, 'utf8');
  const out: { old: string; next: string }[] = [];
  // Old: "..."   ... New (Sam-signed): "..."      (may span lines)
  const flat = text.replace(/\n\s*/g, ' ');
  const pattern = /Old:\s*"([^"]+)"[^"]*?New \(Sam-signed\):\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(flat)) !== null) {
    out.push({ old: match[1].trim(), next: match[2].trim() });
  }
  // The REPLACED-with-arrow form: "Message the coach" → **"Ask Coach"**
  const arrow = /REPLACED:\s*"([^"]+)"\s*(?:→|->)\s*\*\*"([^"]+)"\*\*/g;
  while ((match = arrow.exec(flat)) !== null) {
    out.push({ old: match[1].trim(), next: match[2].trim() });
  }
  return out;
}

function surfaceSources(): { file: string; text: string }[] {
  const dirs = ['screens/home', 'screens/coach', 'components'];
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    const full = path.join(ROOT, 'src', dir);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push({ file: rel, text: fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8') });
      }
    }
  };
  dirs.forEach(walk);
  return out;
}

console.log('\n-- Copy rulings binding (Sam ruling 2, equality both directions) --');

const RULED = replacements();
const SOURCES = surfaceSources();

run('the rulings file is present and parses', () => {
  assert(fs.existsSync(RULINGS),
    'artifacts/COPY_SHEET_RULINGS_2026-07-30.md is missing — it is the authoring '
    + 'source, and without it nothing can be signed');
  assert(RULED.length >= 4,
    `only ${RULED.length} replacement rulings parsed from the file. Batches 1-3 `
    + 'record at least four (two in batch 1, two in batch 2, one in batch 3) — the '
    + 'parser has drifted from the document format.');
});

run('every string Sam RETIRED is gone from the surfaces', () => {
  // Direction one. If the old wording survives anywhere an athlete can read it,
  // his ruling did not land and both versions ship.
  const offences: string[] = [];
  for (const ruling of RULED) {
    for (const source of SOURCES) {
      if (source.text.includes(ruling.old)) {
        offences.push(`${source.file}: still says "${ruling.old}"`);
      }
    }
  }
  assert(offences.length === 0,
    `wording Sam replaced is still in the app:\n        ${offences.join('\n        ')}`);
});

run('every string Sam SIGNED is in the surfaces', () => {
  // Direction two. A ruling that was recorded but never applied is a ruling he
  // will have to make twice.
  const missing = RULED
    .filter((ruling) => !SOURCES.some((source) => source.text.includes(ruling.next)))
    .map((ruling) => `"${ruling.next}"`);
  assert(missing.length === 0,
    `wording Sam signed is not in the app: ${missing.join(', ')}. The rulings file `
    + 'is the authoring source; the code must equal it.');
});

run('the template-blank law has no engine-internal filler', () => {
  // Batch 2 ruling 1: a blank inside signed copy may only be filled from Sam's
  // signed vocabulary or the exercise master sheet. `allocation.focus` and its
  // relatives are structurally barred.
  const banned = ['allocation.focus', 'session.focus'];
  const offences: string[] = [];
  for (const source of SOURCES) {
    for (const token of banned) {
      if (source.text.includes(token)) offences.push(`${source.file}: uses ${token}`);
    }
  }
  assert(offences.length === 0,
    `a surface reads engine-internal text that could reach a signed blank:\n        `
    + `${offences.join('\n        ')}\n      Sam's template-blank law: an unmapped `
    + 'engine value fails the build rather than falling back.');
});

console.log(`\nCopy rulings binding totals: ${passed} passed, ${failed} failed`);
console.log(`  replacement rulings bound: ${RULED.length}`);
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
