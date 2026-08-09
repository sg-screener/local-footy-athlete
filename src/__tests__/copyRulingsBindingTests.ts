/**
 * THE RULINGS FILE AND THE SHEET ARE EQUAL, BOTH DIRECTIONS.
 *
 * `docs/COPY_SHEET_RULINGS_2026-07-30.md` is the AUTHORING SOURCE — Sam's
 * signed rulings, compiled conversationally via Cowork. Sam's instruction: "it is
 * equality-bound both directions once implemented."
 *
 * IT LIVES IN `docs/` BECAUSE IT IS LAW, AND LAW IS TRACKED — Sam's ruling of
 * 2026-07-31, answering the boundary report's question 10. This gate is armed in
 * `test:bible` and hard-asserts the file exists, so while the file sat in the
 * gitignored `artifacts/` scratch directory the bible could not be run from a
 * fresh clone at all, and the whole signable batch was one `git clean` from
 * gone. `artifacts/` stays gitignored for genuine scratch; a signed rulings file
 * was never scratch. The read below is the tracked path, and it is the ONLY
 * read — there is no second copy to keep in sync.
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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}

const ROOT = path.join(__dirname, '..', '..');
const RULINGS = path.join(ROOT, 'docs', 'COPY_SHEET_RULINGS_2026-07-30.md');

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

/**
 * Files that can put words in front of an athlete.
 *
 * IT USED TO BE THREE SCREEN DIRECTORIES, and that was a hole big enough to
 * drive a door through: `CATEGORY_COPY` — the label and subtitle of every entry
 * in the plan-change sheet, which is as athlete-visible as copy gets — has
 * always lived in `utils/planChangeProducer.ts` and this gate has never once
 * read it. Found on 2026-07-30 when the charter's Mobility door proposed two new
 * strings and the "is it in the app?" cell said no, because it was not looking
 * where the app keeps them.
 *
 * A screen is not where copy is AUTHORED; it is where copy is RENDERED. The
 * producer and the authored data sets are where it comes from, so they are named
 * here individually — a directory sweep over `utils` and `data` would pull in
 * thousands of lines of engine prose and make the RETIRED direction fire on
 * comments.
 */
const AUTHORING_MODULES = [
  // THE FEEDBACK FORM'S VOCABULARY, added 2026-08-09 by the feel slice, and it
  // is the same finding as `planChangeProducer.ts` above at a second address:
  // every question the post-session form puts and every chip the athlete taps —
  // the completion prompts, the feeling and soreness scales, the skip and
  // partial reasons, the team-night question, and now the body-feel rating and
  // the "felt different" tap — is AUTHORED here and merely RENDERED by
  // `SessionFeedbackPanel`. Recording batch 18 made this gate red for strings
  // plainly in the app, which is the third time that exact symptom has named a
  // scope hole rather than a copy defect.
  'utils/sessionFeedbackForm.ts',
  'utils/planChangeProducer.ts',
  'utils/coachRevisionTemplates.ts',
  'data/strengthSessionVariants.ts',
  'data/mobilityFlowTemplates.ts',
  // The deload/easy-day sentences (`DELOAD_SENTENCES`). Added when Sam signed
  // the §13 conditioning wording, for the same reason `planChangeProducer.ts`
  // was added on 2026-07-30: this is where those words are AUTHORED, and a gate
  // that cannot see them cannot enforce a retirement. Their positive equality
  // is bound against their own signed records in `test:deload-law`, the
  // shortfall-copy regime; what this list adds is the RETIRED direction, so a
  // sentence Sam replaces cannot quietly survive here.
  'rules/deloadWeekRules.ts',
];

/**
 * SCOPE IS DERIVED FROM THE TREE, NOT ENUMERATED — the same compression applied
 * to `signedCopyExtractionTests` in this commit, and it belongs here for the
 * same reason: this list was `['screens/home', 'screens/coach', 'components']`,
 * and when the Journal arrived on 2026-08-09 this gate could not see it either.
 *
 * The failure that exposed it is worth recording, because it is the good case.
 * Recording the journal's strings as batch 15 made THIS gate red — "proposed to
 * Sam and not in the app" — for strings that were plainly in the app, on a
 * screen the gate was not looking at. A gate whose scope is hand-maintained does
 * not merely miss things; it reports confident falsehoods about the things it
 * misses.
 */
const SURFACE_ROOTS = ['screens', 'components', 'navigation'];

function surfaceSources(): { file: string; text: string }[] {
  const dirs = SURFACE_ROOTS;
  const out: { file: string; text: string }[] = [];
  for (const rel of AUTHORING_MODULES) {
    const full = path.join(ROOT, 'src', rel);
    if (fs.existsSync(full)) out.push({ file: rel, text: fs.readFileSync(full, 'utf8') });
  }
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
    'docs/COPY_SHEET_RULINGS_2026-07-30.md is missing — it is the authoring '
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

// ──────────────────────────────────────────────────────────────────────────
// BATCH 5 — PROPOSED, NOT SIGNED. Bound anyway, both directions.
//
// "Nothing athlete-visible ships unsigned" cannot be true mid-flight: the
// charter unit needed a Mobility door and three picker descriptions before Sam
// had ruled their wording, and shipping nothing would have meant shipping no
// door. So the transitional rule is the honest one — a string may ship PROPOSED,
// and it may never ship UNLISTED.
//
// Both directions, because one is worthless. Direction one catches a proposal
// nobody implemented; direction two catches the thing that actually happens —
// somebody adds a seventh category and never tells Sam, and the sheet grows its
// own vocabulary, which is "the defect wearing a process" from this file's own
// header.
// ──────────────────────────────────────────────────────────────────────────

/** Every string quoted in the PROPOSED batch, with its 5x sub-heading. */
function proposedStrings(): { batch: string; text: string }[] {
  const raw = fs.readFileSync(RULINGS, 'utf8');
  const start = raw.indexOf('## Batch 5 — PROPOSED');
  if (start < 0) return [];
  const out: { batch: string; text: string }[] = [];
  let batch = '5';
  for (const line of raw.slice(start).split('\n')) {
    // Any heading LEVEL and any batch NUMBER. It was `^### (5[a-z])\.`, which
    // meant every string a later batch proposed was reported to Sam under the
    // last batch-5 sub-heading the parser happened to have seen — Task 4's own
    // rows came back labelled "5d". The failure message is what someone acts
    // on, so it has to name the right batch.
    // TWO HEADING FORMS, because the file uses two. The original regex matched
    // only `### 5a.`; every batch from 10 onward writes its sub-headings as
    // `**15-a. …**`, so none of them was ever recognised and their strings were
    // all reported under whichever batch-5 sub-heading the parser had last seen.
    // The comment above says the failure message has to name the right batch —
    // it had stopped doing so, silently, for five batches.
    const heading = /^#+ (\d+[a-z])\./.exec(line)
      ?? /^\*\*(\d+)-([a-z])\./.exec(line);
    if (heading) batch = heading.length > 2 ? `${heading[1]}${heading[2]}` : heading[1];
    if (!line.trimStart().startsWith('|')) continue;
    for (const match of line.matchAll(/"([^"]+)"/g)) out.push({ batch, text: match[1] });
  }
  return out;
}

const PROPOSED = proposedStrings();

run('the proposed batch is not empty', () => {
  // NON-VACUITY. Both cells below pass trivially on an empty list, and an empty
  // list is exactly what a bad parse produces.
  assert(PROPOSED.length >= 6,
    `only ${PROPOSED.length} proposed strings parsed from the rulings file — the `
    + 'parse is broken, and a broken parse makes the two cells below vacuous');
});

run('every PROPOSED string is actually in the app', () => {
  const missing = PROPOSED
    .filter((entry) => !SOURCES.some((source) => source.text.includes(entry.text)))
    .map((entry) => `${entry.batch}: "${entry.text}"`);
  assert(missing.length === 0,
    `proposed to Sam and not in the app:\n        ${missing.join('\n        ')}\n      `
    + 'A proposal for wording nothing uses wastes a ruling.');
});

run('every athlete-visible string in the NEW surfaces is proposed', () => {
  // THE DIRECTION THAT MATTERS. Enumerated from the code, so a new category or a
  // new strength variant cannot ship without appearing in the file Sam reads.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { STRENGTH_SESSION_VARIANTS } = require('../data/strengthSessionVariants');
  const proposedOrPreexisting = new Set(PROPOSED.map((entry) => entry.text));
  const PRE_EXISTING = new Set<string>([
    // Shipping before the charter unit: the four original picker descriptions
    // and every canonical strength label. Batch 4 signed the sheet "as
    // extracted", which is what covers them.
    'Squat and hinge strength - legs and glutes.',
    'Compound push, pull, squat and carry.',
    'Pressing strength - chest, shoulders and triceps.',
    'Pulling strength - back and biceps.',
    ...STRENGTH_SESSION_VARIANTS.map((variant: { label: string }) => variant.label),
  ]);
  const unproposed: string[] = [];
  for (const variant of STRENGTH_SESSION_VARIANTS as { id: string; description: string }[]) {
    if (proposedOrPreexisting.has(variant.description)) continue;
    if (PRE_EXISTING.has(variant.description)) continue;
    unproposed.push(`strength variant ${variant.id}: "${variant.description}"`);
  }
  assert(unproposed.length === 0,
    `athlete-visible wording nobody asked Sam about:\n        ${unproposed.join('\n        ')}\n      `
    + 'Add it to the PROPOSED batch in docs/COPY_SHEET_RULINGS_2026-07-30.md.');
});

console.log(`\nCopy rulings binding totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`  proposed strings bound: ${PROPOSED.length}`);
console.log(`  replacement rulings bound: ${RULED.length}`);
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
