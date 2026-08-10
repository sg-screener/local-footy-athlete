/**
 * REPO-CHECK GUARDS FOR PROCESS LAWS — one suite, several laws.
 *
 * ## WHY ONE SUITE AND NOT THREE SCRIPTS
 *
 * Sam, 2026-08-10, invoking his own Elegant Solution Requirement by name:
 * *"i just want the most elegant solution… THEN I SHOULD STOP HAVING TO DEAL
 * WITH THE SAME FUCKING PROBLEMS OVER AND OVER"*. **49 guards is 49 more things
 * to maintain.** The registry's batch-2 audit named the collapses; this is the
 * first of them built.
 *
 * A PROCESS law's guard is a REPO CHECK — a script that reads the docs, the
 * inbox and the tree — and it goes in the same chain and reds the same way as an
 * app cell. Three such laws share one instrument here, and a fourth joins by
 * adding a section rather than a script.
 *
 * ## THE LAWS THIS SUITE HOLDS
 *
 * - `LAW-no-secrets-committed` — AGENTS.md "Working Style". **The largest gap in
 *   the registry between the cost of a violation and the cost of its guard:** a
 *   committed key is unrecoverable from history, and the guard is a regex.
 * - `LAW-seat-coordination` — the inbox's SECTION STRUCTURE. Violated and
 *   repaired by hand on 2026-08-10 (`74070cf2`), which is exactly the class a
 *   structural gate catches.
 * - `LAW-L2-not-covered-section` — MASTER_PLAN PART 1, L2. Every boundary report
 *   carries a NOT-COVERED section; omitting it is itself a defect.
 *
 * ## WHAT ITS FIRST RUN FOUND, REPORTED RATHER THAN FIXED QUIETLY
 *
 * **Two of thirty-nine boundary docs carry no NOT-COVERED section** —
 * `R53_FIXTURE_BOOT_ORDER_BOUNDARY_2026-08-06.md` and
 * `V3_BOUNDARY_BANKED_2026-08-07.md`. That is a real finding with a name, and
 * per Sam's ruling it is reported the moment it appears rather than deferred
 * into a list. They are carried as a NAMED, DATED exception below — not as a
 * loosened rule — so the cell red is about NEW omissions from today.
 *
 * ## LIVENESS (`LAW-green-gate-is-a-claim`)
 *
 * Every checker is a pure function over inputs the cells supply. The final cell
 * feeds each one a FABRICATED violation and asserts it is caught, so a green
 * here cannot mean "the scan read nothing".
 *
 * Run: npm run test:repo-law-guards
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import fs from 'fs';
import path from 'path';

let passed = 0;
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
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');

/** Every file under a directory, recursively, skipping build output. */
function filesUnder(dir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

// ── LAW-no-secrets-committed ───────────────────────────────────────────────
//
// The patterns are BUILT FROM PIECES rather than written whole. A scanner whose
// own source contains the literal it hunts either matches itself or has to
// exclude itself, and a self-exclusion is the hole a real key would sit in.

const SECRET_PATTERNS: readonly { readonly name: string; readonly re: RegExp }[] = [
  // OpenAI-style secret key.
  { name: 'openai-secret-key', re: new RegExp(['s', 'k-'].join('') + '[A-Za-z0-9_-]{24,}') },
  // A JWT with a real payload — Supabase anon/service keys ship in this shape.
  { name: 'jwt', re: new RegExp(['ey', 'J'].join('') + '[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}') },
  // AWS access key id.
  { name: 'aws-access-key-id', re: new RegExp(['AK', 'IA'].join('') + '[0-9A-Z]{16}') },
  // A named credential assigned a long literal.
  {
    name: 'assigned-credential-literal',
    re: /(?:api[_-]?key|secret[_-]?key|service[_-]?role|access[_-]?token|password)\s*[:=]\s*['"][A-Za-z0-9._\-/+]{24,}['"]/i,
  },
];

interface SecretHit { readonly file: string; readonly pattern: string; }

/** Pure: the credential-shaped strings in a set of (path, contents) pairs. */
function secretHits(
  sources: readonly { readonly file: string; readonly text: string }[],
): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const source of sources) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(source.text)) hits.push({ file: source.file, pattern: pattern.name });
    }
  }
  return hits;
}

// ── LAW-seat-coordination (the inbox's SECTION STRUCTURE) ──────────────────

/**
 * Pure: what is structurally wrong with an inbox document, if anything.
 *
 * TWO CORRECTIONS THIS CHECKER NEEDED ON ITS OWN FIRST RUN, both reported in
 * the boundary rather than quietly patched:
 *
 * 1. **A HEADING IS ONLY A HEADING AT COLUMN 0.** The first version trimmed each
 *    line, so an INDENTED QUOTATION of the law inside an order's prose —
 *    `*"the seat writes orders in ## Unprocessed"*` at SEAT_INBOX.md:317 — read
 *    as a second queue. The suite next door learned this exact lesson about
 *    comments quoting `process.exit(0)`: **a gate that reads a document must
 *    read its STRUCTURE, not text that looks like structure.**
 * 2. **THE ARCHIVE LEGITIMATELY REPEATS.** Requiring exactly one
 *    `## Previously (now processed)` was this author's invention, not the law —
 *    past batches keep their own processed sections verbatim, by convention. The
 *    law says the seat's queue is ONE and comes FIRST. That is what is checked.
 */
function inboxStructureFaults(inbox: string): string[] {
  const faults: string[] = [];
  const headings = inbox.split('\n')
    .map((line, index) => ({ line, index }))
    // Column 0 only. An indented `## ` is prose about a heading, not a heading.
    .filter((entry) => entry.line.startsWith('## '));
  const unprocessed = headings.filter((entry) => /^## Unprocessed\b/.test(entry.line));
  if (unprocessed.length === 0) faults.push('no `## Unprocessed` heading — the seat has nowhere to write');
  if (unprocessed.length > 1) {
    faults.push(`\`## Unprocessed\` appears ${unprocessed.length} times — orders would split across two queues`);
  }
  if (unprocessed.length === 1 && headings[0] !== unprocessed[0]) {
    faults.push(`\`## Unprocessed\` is not the first section (first is "${headings[0]?.line}") — `
      + 'terminal-owned sections live BELOW the seat\'s queue, never above it');
  }
  const processed = headings.filter((entry) => /^## Previously \(now processed\)/.test(entry.line));
  if (processed.length === 0) {
    faults.push('no `## Previously (now processed)` heading — processed orders have nowhere to go');
  } else if (unprocessed.length === 1 && processed[0].index < unprocessed[0].index) {
    faults.push('a processed section sits ABOVE the unprocessed queue');
  }
  return faults;
}

// ── LAW-L2-not-covered-section ─────────────────────────────────────────────

/**
 * NAMED, DATED EXCEPTIONS — not a loosened rule.
 *
 * Both predate this guard and are reported as findings in the boundary that
 * introduced it. A doc leaves this list by gaining its section; **nothing may
 * join it.** That is the ratchet shape the charter already uses for debt.
 */
const NOT_COVERED_EXCEPTIONS: readonly string[] = [
  'R53_FIXTURE_BOOT_ORDER_BOUNDARY_2026-08-06.md',
  'V3_BOUNDARY_BANKED_2026-08-07.md',
];

/** Pure: boundary docs with no NOT-COVERED section. */
function docsMissingNotCovered(
  docs: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return docs
    .filter((doc) => !/NOT.{0,2}COVERED/i.test(doc.text))
    .map((doc) => path.basename(doc.file));
}

// ── THE CELLS ──────────────────────────────────────────────────────────────

run('no credential-shaped literal is committed under src/ or scripts/', () => {
  const files = [
    ...filesUnder(path.join(repoRoot, 'src'), ['.ts', '.tsx', '.js', '.json']),
    ...filesUnder(path.join(repoRoot, 'scripts'), ['.ts', '.js', '.sh', '.json']),
    path.join(repoRoot, 'app.json'),
    path.join(repoRoot, 'eas.json'),
  ].filter((file) => fs.existsSync(file) && file !== __filename);
  assert(files.length > 100, `the scan found only ${files.length} files — it is reading the wrong tree`);
  const hits = secretHits(files.map((file) => ({
    file: path.relative(repoRoot, file),
    text: fs.readFileSync(file, 'utf8'),
  })));
  assert(hits.length === 0,
    `credential-shaped literal(s) committed: ${hits.map((h) => `${h.file} (${h.pattern})`).join(', ')}. `
    + 'A committed key is unrecoverable from history — rotate it, then remove it.');
});

run('the seat inbox keeps its section structure', () => {
  const inbox = fs.readFileSync(path.join(repoRoot, 'docs', 'SEAT_INBOX.md'), 'utf8');
  const faults = inboxStructureFaults(inbox);
  assert(faults.length === 0, `docs/SEAT_INBOX.md: ${faults.join('; ')}`);
});

run('every boundary report carries a NOT-COVERED section', () => {
  const docs = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .filter((file) => /BOUNDARY/.test(path.basename(file)));
  assert(docs.length > 20, `only ${docs.length} boundary docs found — the scan is reading the wrong tree`);
  const missing = docsMissingNotCovered(docs.map((file) => ({
    file, text: fs.readFileSync(file, 'utf8'),
  })));
  const unexpected = missing.filter((name) => !NOT_COVERED_EXCEPTIONS.includes(name));
  assert(unexpected.length === 0,
    `boundary report(s) with no NOT-COVERED section: ${unexpected.join(', ')}. `
    + 'L2: omitting it is itself a defect — say what was not looked at.');
  console.log(`      (${docs.length} boundary docs; ${NOT_COVERED_EXCEPTIONS.length} named pre-existing exceptions)`);
});

run('the NOT-COVERED exception list only shrinks', () => {
  // THE RATCHET. Without this, the exception list is a place to hide a new
  // omission, and the law would decay one entry at a time.
  const docs = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .filter((file) => /BOUNDARY/.test(path.basename(file)));
  const missing = new Set(docsMissingNotCovered(docs.map((file) => ({
    file, text: fs.readFileSync(file, 'utf8'),
  }))));
  const paid = NOT_COVERED_EXCEPTIONS.filter((name) => !missing.has(name));
  assert(paid.length === 0,
    `these docs gained their NOT-COVERED section — delete them from NOT_COVERED_EXCEPTIONS: ${paid.join(', ')}`);
});

run('the checkers red on fabricated violations (liveness)', () => {
  // A GREEN GATE IS A CLAIM. Each checker is fed something it must catch; if the
  // reads above were reduced to no-ops, every cell would still pass.
  const fakeKey = ['s', 'k-'].join('') + 'A'.repeat(40);
  assert(secretHits([{ file: 'fake.ts', text: `const k = "${fakeKey}";` }]).length > 0,
    'a credential-shaped literal passed the secret scan');
  assert(secretHits([{ file: 'fake.ts', text: 'const k = "hello world";' }]).length === 0,
    'the secret scan flags ordinary strings — it would be ignored within a week');

  assert(inboxStructureFaults('# X\n\n## Processed\n\n1. a\n').length > 0,
    'an inbox with no Unprocessed section passed');
  assert(inboxStructureFaults(
    '# X\n\n## Unprocessed\n\n1. a\n\n## Unprocessed\n\n## Previously (now processed)\n').length > 0,
    'a DOUBLE Unprocessed section passed — orders would split across two queues');
  assert(inboxStructureFaults(
    '# X\n\n## Terminal holds\n\n## Unprocessed\n\n## Previously (now processed)\n').length > 0,
    'a terminal-owned section ABOVE the seat\'s queue passed');
  assert(inboxStructureFaults(
    '# X\n\n## Unprocessed\n\n(none)\n\n## Previously (now processed)\n').length === 0,
    'a well-formed inbox was reported faulty — the cell would be turned off');
  // REGRESSION, this suite's own first run: an INDENTED quotation of the law
  // inside an order read as a second queue. A heading is only a heading at
  // column 0, and the archive legitimately repeats its processed sections.
  assert(inboxStructureFaults(
    '# X\n\n## Unprocessed\n\n1. the seat writes orders in\n   ## Unprocessed, never below\n\n'
    + '## Previously (now processed)\n\n## Previously (now processed)\n').length === 0,
    'an indented QUOTATION of a heading, or a repeated archive section, was read as structure');

  assert(docsMissingNotCovered([{ file: 'a/B_BOUNDARY.md', text: 'we did things' }]).length === 1,
    'a boundary doc with no NOT-COVERED section passed');
  assert(docsMissingNotCovered([{ file: 'a/B_BOUNDARY.md', text: '## NOT COVERED\nnothing' }]).length === 0,
    'a doc WITH the section was reported missing');
});

console.log(`\nrepo law guards totals: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
