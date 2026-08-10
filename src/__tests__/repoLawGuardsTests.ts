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

// ── LAW-one-plan ───────────────────────────────────────────────────────────
//
// Sam, 2026-08-10, was told three different things were the plan. Two of the
// three carried NO supersession marker — grep for "supersed" over
// V1_LAUNCH_DEFINITION returned nothing — while a release gate still pointed
// readers at one of them. A retired plan that does not say it is retired is
// indistinguishable from the live one.

/** The one governing plan. Everything else claiming to be a plan must yield. */
const GOVERNING_PLAN = 'PUBLISH_ROADMAP_2026-08-05.md';

/** Pure: rival plan docs with no supersession marker in their first lines. */
function unmarkedRivalPlans(
  docs: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return docs
    .filter((doc) => path.basename(doc.file) !== GOVERNING_PLAN)
    .filter((doc) => !/SUPERSEDED/i.test(doc.text.split('\n').slice(0, 12).join('\n')))
    .map((doc) => path.basename(doc.file));
}

run('exactly one document presents itself as the plan', () => {
  const plans = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .filter((file) => /^(V1_LAUNCH_DEFINITION|MASTER_PLAN|PUBLISH_ROADMAP)/.test(path.basename(file)));
  assert(plans.some((file) => path.basename(file) === GOVERNING_PLAN),
    `the governing plan ${GOVERNING_PLAN} is gone — nothing would be in charge`);
  const unmarked = unmarkedRivalPlans(plans.map((file) => ({
    file, text: fs.readFileSync(file, 'utf8'),
  })));
  assert(unmarked.length === 0,
    `plan document(s) with no SUPERSEDED marker in their opening lines: ${unmarked.join(', ')}. `
    + `A retired plan that does not say so is indistinguishable from ${GOVERNING_PLAN}.`);
});

/** A doc carrying real status boxes is a status surface, plan or not. */
const STATUS_BOX = /^\s*- \[[ x]\]/gm;
const SUPERSESSION_BANNER = /SUPERSEDED|PARKED|ARCHIVE|HISTORIC|NOT A PLAN/i;

/** Pure: status-carrying docs that neither ARE the plan nor say they are not. */
function unmarkedStatusSurfaces(
  docs: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return docs
    .filter((doc) => path.basename(doc.file) !== GOVERNING_PLAN)
    // Two or fewer boxes is a note, not a checklist. Three is a surface.
    .filter((doc) => (doc.text.match(STATUS_BOX) ?? []).length >= 3)
    .filter((doc) => !SUPERSESSION_BANNER.test(doc.text.split('\n').slice(0, 12).join('\n')))
    .map((doc) => path.basename(doc.file));
}

run('no second document ships an unmarked status checklist', () => {
  // SAM ASKED IT DIRECTLY, 2026-08-10: "am i going to get given an old roadmap
  // again?" — answered with a guard rather than a promise. A doc does not have
  // to CALL itself a plan to be handed over as one; carrying status boxes is
  // enough. Measured when this landed: nine such docs, all nine bannered.
  const docs = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  assert(docs.length > 100, `only ${docs.length} docs found — the scan is reading the wrong tree`);
  const unmarked = unmarkedStatusSurfaces(docs);
  assert(unmarked.length === 0,
    `doc(s) carrying a status checklist with no supersession/archive banner in their `
    + `opening lines: ${unmarked.join(', ')}. Either it is ${GOVERNING_PLAN}, or it says `
    + 'plainly what it is — otherwise it can be handed over as the plan.');
});

run('no release gate points readers at a superseded plan', () => {
  const gate = fs.readFileSync(path.join(repoRoot, 'docs', 'FINAL_QA_CHECKLIST.md'), 'utf8');
  // The checklist may DISCUSS a retired plan; it may not send the reader to it
  // as the thing to check off. The `[ ]` box is what makes it an instruction.
  const sendsReaderAway = gate.split('\n')
    .filter((line) => /^\s*- \[[ x]\]/.test(line))
    .filter((line) => /V1_LAUNCH_DEFINITION|MASTER_PLAN_2026-07-23/.test(line));
  assert(sendsReaderAway.length === 0,
    `FINAL_QA_CHECKLIST has checkbox line(s) pointing at a superseded plan: `
    + `${sendsReaderAway.map((l) => l.trim().slice(0, 70)).join(' | ')}`);
});

// ── LAW-do-as-instructed ───────────────────────────────────────────────────
//
// Sam, 2026-08-10: *"why can't we ever be on the same page? seriously, tell me"*.
// Four times in one day an instruction came back re-scoped instead of done: "it's
// a tweak" answered with why it was bigger; "delete them" answered with a banner;
// "every law guarded" answered with a ranked shortlist; "parity" answered with a
// kind-by-kind slice plan. **Each one cost him a message to drag it back.**
//
// The law is not "never disagree" — it is **never re-scope SILENTLY**. So the
// guard checks the only part of this that touches the repo: an inbox item that
// withdraws or re-shapes an instruction must QUOTE HIS WORDS and say what is
// being changed. Disagreeing out loud passes; quietly substituting a different
// unit does not.

const RESCOPE_WORDS = /\b(WITHDRAWN|withdraw|re-?scope|re-?shape|instead of|supersede[sd]?|narrow(ed)?|widen(ed)?)\b/i;

/**
 * Pure: does a re-scoping ORDER quote the instruction and name the change?
 *
 * SCOPED TO ORDERS, NOT REPORTS, AND ITS FIRST RUN IS WHY. The law's own text
 * governs "an order in this inbox that RE-SCOPES a Sam instruction". The first
 * version tested every block and flagged four — **all four were terminal
 * ANNOTATIONS using the word "superseded" descriptively**, e.g. "both ancestors
 * now carry a SUPERSEDED banner". That is the word, not the act: a vocabulary
 * gate reading a legal use as a violation. Terminal blocks are marked
 * `[TERMINAL,` and are reports of work done, not instructions being re-shaped.
 */
function rescopeBlocksMissingTheirQuote(blocks: readonly string[]): number[] {
  return blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => !block.includes('[TERMINAL,'))
    .filter(({ block }) => RESCOPE_WORDS.test(block))
    // His words, quoted. The inbox quotes with *"…"* or > blockquote.
    .filter(({ block }) => !/\*"[^"]{8,}"\*/.test(block) && !/^\s*>\s+/m.test(block))
    .map(({ index }) => index);
}

run('an inbox item that re-scopes an instruction quotes the instruction', () => {
  const inbox = fs.readFileSync(path.join(repoRoot, 'docs', 'SEAT_INBOX.md'), 'utf8');
  const unprocessed = inbox.split(/^## /m).find((section) => section.startsWith('Unprocessed'));
  assert(unprocessed, 'no Unprocessed section to read');
  // One block per top-level item.
  const blocks = unprocessed.split(/\n(?=[0-9]+[a-z]*\. )/).filter((b) => b.trim().length > 0);
  assert(blocks.length > 0, 'the Unprocessed queue parsed to no items');
  const bad = rescopeBlocksMissingTheirQuote(blocks);
  assert(bad.length === 0,
    `${bad.length} queue order(s) re-scope an instruction without quoting it. `
    + 'Silent re-scoping is the defect (LAW-do-as-instructed); disagreeing out loud is allowed.');
});

// ── THE LOOP CHECK LINE, AND THE TWO LAWS THAT RIDE ON IT ─────────────────
//
// THE COLLAPSE the batch-2 audit named: `LAW-loop-check-line` already requires
// every boundary report to open with "LOOP CHECK: <shape> — sighting N". **Read
// that number and `LAW-second-wall` (an alternative on the table at N>=2) and
// `LAW-loop-audit` (a compression proposal at N>=3) stop being unmechanisable
// and become the same check.** Three laws, one cell — which is the answer to
// Sam's "49 guards is 49 more things to maintain".
//
// THE FORMAT LAW'S OWN TEXT IS "No line, no valid order", effective 2026-08-07,
// and its founding sentence is *"reminders don't execute"*. **Measured when this
// landed: of 27 boundary reports dated on or after that day, 21 CARRY NO LOOP
// CHECK LINE.** The law was written, and then ignored by 78% of the reports
// written under it — which is the registry's whole thesis, in the law that
// exists to stop exactly this.
//
// The 21 are DATED DEBT with a ratchet. Reports dated before the law are out of
// scope; a report dated on or after it is in scope from today.

const FORMAT_LAW_DATE = '2026-08-07';

/** Boundary reports written under the FORMAT LAW with no LOOP CHECK line. */
const LOOP_CHECK_DEBT: readonly string[] = [
  'COACH_MOVE_DURABILITY_BOUNDARY_2026-08-10.md', 'COACH_ROW1_L_C4_BOUNDARY_2026-08-10.md',
  'COACH_SLICE1_BOUNDARY_2026-08-09.md', 'COACH_SLICE2_BOUNDARY_2026-08-10.md',
  'COACH_SLICE3_BOUNDARY_2026-08-10.md', 'DAY_FIRST_SLICE2_BOUNDARY_2026-08-08.md',
  'JOURNAL_FEEL_SLICE_BOUNDARY_2026-08-09.md', 'JOURNAL_HIDDEN_BOUNDARY_2026-08-09.md',
  'JOURNAL_LOAD_SLICE_BOUNDARY_2026-08-09.md', 'JOURNAL_MONTHLY_REVIEW_BOUNDARY_2026-08-09.md',
  'JOURNAL_NIGGLE_SLICE_BOUNDARY_2026-08-09.md', 'JOURNAL_NOTIFICATION_BOUNDARY_2026-08-09.md',
  'JOURNAL_PROOF_PATH_BOUNDARY_2026-08-09.md', 'JOURNAL_SIGNING_BOUNDARY_2026-08-09.md',
  'JOURNAL_STRENGTH_LINE_BOUNDARY_2026-08-09.md', 'JOURNAL_UI_SLICE_BOUNDARY_2026-08-09.md',
  'JOURNAL_UNIT_BOUNDARY_2026-08-09.md', 'JOURNAL_WEEK_JOB_BOUNDARY_2026-08-09.md',
  'LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md', 'R5_BOUNDARY_REPORT_2026-08-07.md',
  'V3_BOUNDARY_BANKED_2026-08-07.md',
];

/** Reports written under the FORMAT LAW, by basename. */
function reportsUnderTheFormatLaw(
  docs: readonly { readonly file: string; readonly text: string }[],
): { readonly name: string; readonly text: string }[] {
  return docs
    .filter((doc) => /BOUNDARY/.test(path.basename(doc.file)))
    .map((doc) => ({ name: path.basename(doc.file), text: doc.text }))
    .filter((doc) => (/(\d{4}-\d{2}-\d{2})/.exec(doc.name)?.[1] ?? '') >= FORMAT_LAW_DATE);
}

/** Pure: reports with no LOOP CHECK line in their opening. */
function reportsWithoutALoopCheck(
  reports: readonly { readonly name: string; readonly text: string }[],
): string[] {
  return reports
    .filter((r) => !/LOOP CHECK/i.test(r.text.split('\n').slice(0, 14).join('\n')))
    .map((r) => r.name);
}

/**
 * Pure: reports whose LOOP CHECK reports sighting >= 2 and state no DISPOSITION.
 * `LAW-second-wall` and `LAW-loop-audit` made mechanical — both said in their own
 * rows that the sighting number is what a guard would read.
 *
 * **CORRECTED ON ITS FIRST RUN, AND THE CORRECTION IS THE LAW'S OWN WORDS.** The
 * first version demanded an alternative or a compression, and flagged
 * `COACH_SLICE1_BOUNDARY_2026-08-09.md` — whose line reads *"sighting 2 …
 * **iterate, and it paid before any code was written**"*. That is not a
 * violation: a LOOP CHECK reports repeated WALLS (compress) **and practices that
 * PAY (iterate)**, and the FORMAT LAW's own template is
 * "sighting N — **iterate or compress**". A cell stricter than the law it
 * guards produces reds nobody can act on, and gets turned off. So the
 * requirement is a stated DISPOSITION, which is what the law asks for.
 */
function repeatSightingsWithNoDisposition(
  reports: readonly { readonly name: string; readonly text: string }[],
): string[] {
  return reports
    .filter((r) => {
      const sighting = /sighting\s+(\d+)/i.exec(r.text);
      return !!sighting && Number(sighting[1]) >= 2;
    })
    .filter((r) => !/COMPRESS|COMPRESSION|alternative|reassessment|iterate/i.test(r.text))
    .map((r) => r.name);
}

run('every boundary report written under the FORMAT LAW opens with a LOOP CHECK', () => {
  const docs = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const reports = reportsUnderTheFormatLaw(docs);
  assert(reports.length > 10, `only ${reports.length} in-scope reports — the scan is wrong`);
  const missing = reportsWithoutALoopCheck(reports);
  const unexpected = missing.filter((name) => !LOOP_CHECK_DEBT.includes(name));
  assert(unexpected.length === 0,
    `report(s) written under the FORMAT LAW with no LOOP CHECK line: ${unexpected.join(', ')}. `
    + 'The law\'s own words are "No line, no valid order".');
  console.log(`      (${reports.length} reports under the law; ${LOOP_CHECK_DEBT.length} pre-existing omissions carried as dated debt)`);
});

run('a repeated sighting states its disposition — iterate or compress', () => {
  // LAW-second-wall (N>=2) and LAW-loop-audit (N>=3), both riding the number the
  // LOOP CHECK line already carries.
  const docs = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const bad = repeatSightingsWithNoDisposition(reportsUnderTheFormatLaw(docs));
  assert(bad.length === 0,
    `report(s) reporting sighting >= 2 that state no disposition: ${bad.join(', ')}. `
    + 'The FORMAT LAW\'s template is "sighting N — iterate or compress"; second-wall '
    + 'requires an alternative on the table before a third attempt at the same wall.');
});

run('the LOOP CHECK debt only shrinks', () => {
  const docs = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const missing = new Set(reportsWithoutALoopCheck(reportsUnderTheFormatLaw(docs)));
  const paid = LOOP_CHECK_DEBT.filter((name) => !missing.has(name));
  assert(paid.length === 0,
    `these reports gained a LOOP CHECK line — delete them from LOOP_CHECK_DEBT: ${paid.join(', ')}`);
});

// ── LAW-claim-needs-a-cell, ON THE SURFACE SAM ACTUALLY READS ─────────────
//
// The law: *a sentence saying the app does or does not do X, anywhere Sam reads
// it, is pinned by a named cell or written OPEN-UNKNOWN.* Its founding case is
// *"why is Friday heavy? is refused"* — a claim that reached him and was FALSE,
// with no cell holding it.
//
// The general form is not mechanisable; **the highest-value instance is.**
// `docs/NOW.md` is the single status surface and its `⚠` blocks are what Sam
// reads first. **Measured when this landed: 10 such blocks, FIVE with no receipt
// and no OPEN-UNKNOWN — two of them written the same day by the author of this
// cell.** All five now carry a named cell, tape, commit, or an explicit
// OPEN-UNKNOWN / NOT ON GLASS.
//
// A completeness-word gate was measured first and REJECTED: the whole of docs/
// yields two hits and both use "exhaustive" descriptively. **A cell that cannot
// fail is worse than no cell** — `LAW-green-gate-is-a-claim`.

const CLAIM_RECEIPT = /`test:|`npm run|`tape:|\b[0-9a-f]{7,40}\b|\.tsx?:\d+|OPEN-UNKNOWN|NOT ON GLASS/;

/** Pure: Sam-facing blocks with neither a receipt nor an honest unknown. */
function samFacingClaimsWithoutAReceipt(nowFile: string): string[] {
  return nowFile
    .split(/\n(?=- \*\*)/)
    .filter((block) => block.slice(0, 40).includes('\u26a0'))
    .filter((block) => !CLAIM_RECEIPT.test(block))
    .map((block) => block.trim().split('\n')[0].slice(0, 70));
}

run('every Sam-facing claim in NOW.md carries a receipt or says OPEN-UNKNOWN', () => {
  const now = fs.readFileSync(path.join(repoRoot, 'docs', 'NOW.md'), 'utf8');
  const blocks = now.split(/\n(?=- \*\*)/).filter((b) => b.slice(0, 40).includes('\u26a0'));
  assert(blocks.length >= 3, `only ${blocks.length} Sam-facing blocks found — the scan is wrong`);
  const bare = samFacingClaimsWithoutAReceipt(now);
  assert(bare.length === 0,
    `Sam-facing claim(s) with no named cell/tape/commit and no OPEN-UNKNOWN: `
    + `${bare.join(' | ')}. The founding case reached him and was FALSE.`);
});

// ── INSTRUMENTATION THAT IS DEAD BY REFERENCE ─────────────────────────────
//
// `LAW-instrumentation-alive`: *a dead or unrun instrument is not coverage.*
// Its founding case is eight of eleven Maestro flows crashing for 23 days.
// **THIS CELL DOES NOT CATCH THAT CASE** — a crash needs the flow to RUN, which
// needs a device — and the row stays UNENFORCED for exactly that reason. What it
// catches is the cheaper sibling: a flow that names a file which is not there,
// and a flow NOTHING can reach. Measured when this landed: **0 broken runFlow
// targets, 7 flows reachable from no script, no doc and no other flow.**

/**
 * **EMPTY, AND THAT IS THE MEASUREMENT, NOT AN OMISSION.** This list held seven
 * flows until the scan above was corrected three times; under the corrected scan
 * **every flow in `.maestro/` is reachable and there are ZERO orphans.** The
 * seven were artefacts of a scan that read too little — which is why the debt was
 * re-derived after each fix instead of being trusted. Nothing may join this list
 * without a receipt showing the flow is genuinely unreachable.
 */
const ORPHAN_FLOW_DEBT: readonly string[] = [];

/**
 * Every flow this text runs, in BOTH shapes Maestro allows.
 *
 * **THE FIRST VERSION READ ONLY THE ONE-LINE FORM, AND THIS REPO USES THE OTHER
 * ONE.** Every flow here is written `- runFlow:` / newline / `    file: x.yaml`,
 * so the scan matched NOTHING and "0 broken references" was a vacuous green. Its
 * liveness probe passed because the probe was written in the one-line form —
 * **a fixture that does not match the world it claims to test**
 * (`a fixture is a claim too`). Both forms are probed now.
 */
function runFlowTargets(text: string): string[] {
  return [
    ...[...text.matchAll(/runFlow:[ \t]*\n[ \t]*file:[ \t]*([^\s#]+\.yaml)/g)].map((m) => m[1]),
    ...[...text.matchAll(/runFlow:[ \t]+([^\s#]+\.yaml)/g)].map((m) => m[1]),
  ].map((t) => t.replace(/["']/g, ''));
}

/** Pure: runFlow targets that do not resolve, given (flow, text) pairs. */
function brokenFlowReferences(
  flows: readonly { readonly file: string; readonly text: string }[],
  exists: (candidate: string) => boolean,
): string[] {
  const bad: string[] = [];
  for (const flow of flows) {
    for (const target of runFlowTargets(flow.text)) {
      const resolved = path.normalize(path.join(path.dirname(flow.file), target));
      if (!exists(resolved)) bad.push(`${flow.file} -> ${target}`);
    }
  }
  return bad;
}

run('no Maestro flow names a file that is not there', () => {
  const files = filesUnder(path.join(repoRoot, '.maestro'), ['.yaml']);
  assert(files.length > 5, `only ${files.length} flows found — the scan is reading the wrong tree`);
  const flows = files.map((file) => ({
    file: path.relative(repoRoot, file), text: fs.readFileSync(file, 'utf8'),
  }));
  const broken = brokenFlowReferences(flows, (c) => fs.existsSync(path.join(repoRoot, c)));
  assert(broken.length === 0, `flow reference(s) that do not resolve: ${broken.join(', ')}`);
});

run('no Maestro flow is reachable from nothing', () => {
  const files = filesUnder(path.join(repoRoot, '.maestro'), ['.yaml'])
    .map((file) => path.relative(repoRoot, file));
  const referenced = new Set<string>();
  for (const file of files) {
    const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    for (const target of runFlowTargets(text)) {
      referenced.add(path.normalize(path.join(path.dirname(file), target)));
    }
  }
  // NAMED ANYWHERE A HUMAN OR A SCRIPT COULD INVOKE IT — and this corpus took
  // THREE corrections to get right, each one a flow wrongly called an orphan:
  //   1. `docs/` + `scripts/*.sh|js` only → nine helper flows looked orphaned;
  //      SUITES name flows directly (`explorerLiveRunnerTests`).
  //   2. adding `src/__tests__/*.ts` → two still looked orphaned;
  //      `scripts/explorer-app-launch.ts` is TypeScript, and
  //      `src/dev/e2e/README.md` is a .md outside `docs/`.
  // **An orphan claim is a claim about the WHOLE repo, so the scan has to read
  // the whole repo.** Narrowing it is how a live instrument gets called dead.
  const named = [
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    // THIS FILE IS EXCLUDED, AND MUTATION TESTING FOUND OUT WHY — for the SECOND
    // time in this suite's life. A flow name written in this suite's own source
    // (a debt entry, a comment, a probe) counted as the flow being "named", so
    // removing its only real mention reddened nothing. **A gate that reads
    // sources must never read its own.** Same defect as the rule-id scan next
    // door, recurring because the two scans were written days apart.
    ...['docs', 'scripts', 'src'].flatMap((dir) =>
      filesUnder(path.join(repoRoot, dir), ['.md', '.ts', '.tsx', '.sh', '.js', '.json'])
        .filter((f) => f !== __filename)
        .map((f) => fs.readFileSync(f, 'utf8'))),
  ].join('\n');
  // MATCHED BY BASENAME, DELIBERATELY. `FINAL_QA_CHECKLIST` tells a human to run
  // `fixture-move.yaml`; nothing in the repo writes its full path. **A flow named
  // anywhere a person or script can act on it is INVOKABLE, and that is what
  // "alive" means here.** Full-path matching called seven live flows dead — the
  // fourth and last correction to this scan.
  const orphans = files.filter((file) =>
    !referenced.has(path.normalize(file)) && !named.includes(path.basename(file)));
  const unexpected = orphans.filter((file) => !ORPHAN_FLOW_DEBT.includes(file));
  assert(unexpected.length === 0,
    `Maestro flow(s) no script, doc or other flow can reach: ${unexpected.join(', ')}. `
    + 'An instrument nobody runs is not coverage.');
  console.log(`      (${files.length} flows; ${ORPHAN_FLOW_DEBT.length} pre-existing orphans carried as dated debt)`);
});

run('the orphan-flow debt only shrinks', () => {
  // THIS RATCHET WAS WRONG TOO, and it is why the empty list above is empty. It
  // used to check that a debt entry still EXISTED as a file — which passes
  // forever, even after the flow becomes reachable again. A ratchet must ask the
  // question the cell it guards asks: is this still an orphan?
  assert(ORPHAN_FLOW_DEBT.length === 0,
    `ORPHAN_FLOW_DEBT is non-empty: ${ORPHAN_FLOW_DEBT.join(', ')}. `
    + 'Re-derive it against the corrected scan before trusting it — the first seven entries '
    + 'were artefacts of a scan that read too little.');
});

// ── THE FOUR PROCESS LAWS SAM RE-WORDED HIMSELF (2026-08-10) ──────────────
//
// He was put the six laws no script could check, one per line, with a proposed
// re-wording each — his own rule that an uncheckable law is a FINDING, never a
// quiet UNENFORCED row. **He ruled all six**, and five of them land here or
// beside them; the sixth (`LAW-sam-chat-simplicity`) he guarded with a named
// person, because its subject is the conversation and no file will ever see it.
//
// A section rather than four scripts, per this suite's own opening argument:
// 49 guards is 49 more things to maintain.

/**
 * L4 + L10, RE-WORDED BY SAM ONTO THE DOC SURFACE.
 *
 * His words: *nothing may be written as done/working for an athlete-visible
 * behaviour without a device or simulator receipt.*
 *
 * The literal laws could not be mechanised — L4 says a CELL is not the arbiter,
 * so no cell can be its judge, and L10 turns on an event outside the repo. What
 * they PROTECT is checkable, and it is this: a claim reaching Sam that something
 * works must either carry device evidence or say it has none.
 *
 * **`NOT ON GLASS` and `UNSEEN` count as passing, and that is the point.** The
 * law is not "never claim anything unseen" — it is "never claim it SILENTLY".
 */
const DONE_WORDS = /\b(FIXED|DONE|IT NOW|NOW IT|WORKS|WORKING|LANDED|BUILT AND|SHIPPED)\b/i;
const DEVICE_RECEIPT = /NOT ON GLASS|NOT SEEN|UNSEEN|OPEN-UNKNOWN|on glass|device pass|simulator|on (his|your) phone|npx expo run/i;

/** Pure: Sam-facing blocks claiming something is done with no device word either way. */
function doneClaimsWithNoDeviceWord(nowFile: string): string[] {
  return nowFile
    .split(/\n(?=- \*\*)/)
    .filter((block) => block.slice(0, 40).includes('⚠'))
    .filter((block) => DONE_WORDS.test(block))
    .filter((block) => !DEVICE_RECEIPT.test(block))
    .map((block) => block.trim().split('\n')[0].slice(0, 70));
}

run('no athlete-visible thing is called done without saying whether it was seen', () => {
  const now = fs.readFileSync(path.join(repoRoot, 'docs', 'NOW.md'), 'utf8');
  const claiming = now
    .split(/\n(?=- \*\*)/)
    .filter((b) => b.slice(0, 40).includes('⚠'))
    .filter((b) => DONE_WORDS.test(b));
  assert(claiming.length >= 1,
    `no done-claiming Sam-facing block found in NOW.md — the scan is not reading it`);
  const bare = doneClaimsWithNoDeviceWord(now);
  assert(bare.length === 0,
    `done/working claim(s) with no device word either way: ${bare.join(' | ')}. `
    + 'Say NOT ON GLASS. The law is not "never claim it unseen", it is "never claim it silently".');
});

/**
 * `LAW-rule-dont-ask`, RE-WORDED BY SAM: *any question put to Sam carries a
 * receipt that the Bible and ruling docs were searched first.*
 *
 * The surface is the STOP reports' blocked-on-Sam sections, because that is
 * where questions actually reach him. A blocking item citing nothing is a
 * question that may already have an answer in the repo.
 */
const SAM_BLOCK_HEADING = /^##+ .*BLOCKED ON SAM.*$/im;
const SEARCH_RECEIPT = /docs\/[A-Za-z0-9_.-]+|`[A-Za-z0-9_.-]+\.(ts|tsx|json|md)`|LAW-[a-z0-9-]+|:\d{3,4}\b|verified|checked|measured/i;

/** Pure: blocked-on-Sam items with no evidence anything was searched first. */
function samQuestionsWithNoSearchReceipt(doc: string): string[] {
  const heading = doc.match(SAM_BLOCK_HEADING);
  if (!heading) return [];
  const after = doc.slice(doc.indexOf(heading[0]) + heading[0].length);
  const section = after.split(/\n##+ /)[0];
  return section
    .split(/\n(?=\d+\. )/)
    .map((item) => item.trim())
    .filter((item) => /^\d+\. /.test(item))
    .filter((item) => !SEARCH_RECEIPT.test(item))
    .map((item) => item.split('\n')[0].slice(0, 70));
}

run('every question put to Sam shows what was searched first', () => {
  const stops = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .filter((file) => /STOP/i.test(path.basename(file)))
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }))
    .filter((doc) => SAM_BLOCK_HEADING.test(doc.text));
  assert(stops.length >= 1, 'no STOP report with a blocked-on-Sam section — the scan is wrong');
  const bare = stops.flatMap((doc) =>
    samQuestionsWithNoSearchReceipt(doc.text).map((item) => `${path.basename(doc.file)}: ${item}`));
  assert(bare.length === 0,
    `question(s) put to Sam citing nothing that was checked first: ${bare.join(' | ')}. `
    + 'If the laws answer it even partially, rule it and cite the law.');
});

/**
 * `LAW-sam-is-not-the-wire` — Sam, 2026-08-10.
 *
 * He spent a day pasting the seat's orders to the terminal and the terminal's
 * reports back to the seat. Both halves were removable and neither needed his
 * hands. **What that leaves him is decisions, device testing, and things only he
 * has** — his partner's templates, his Apple ID, his exports.
 *
 * **The checkable half: if a turn asks him for anything else, that is the
 * defect.** So every item in a blocked-on-Sam section must be one of those three
 * kinds. An item asking him to relay, paste, forward or confirm-a-report is the
 * shape this cell exists to catch — it is the routing role coming back.
 */
const RELAY_ASK = /\b(relay|paste|forward|copy (this|it) (to|back)|send (this|it) to the seat|tell the seat|read (this|it) (to|back))\b/i;

/** Pure: blocked-on-Sam items that ask him to be the wire again. */
function samItemsAskingHimToRelay(doc: string): string[] {
  const heading = doc.match(SAM_BLOCK_HEADING);
  if (!heading) return [];
  const section = doc.slice(doc.indexOf(heading[0]) + heading[0].length).split(/\n##+ /)[0];
  return section
    .split(/\n(?=\d+\. )/)
    .map((item) => item.trim())
    .filter((item) => /^\d+\. /.test(item))
    .filter((item) => RELAY_ASK.test(item))
    .map((item) => item.split('\n')[0].slice(0, 70));
}

run('nothing asks Sam to be the wire', () => {
  const stops = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .filter((file) => /STOP/i.test(path.basename(file)))
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }))
    .filter((doc) => SAM_BLOCK_HEADING.test(doc.text));
  assert(stops.length >= 1, 'no STOP report with a blocked-on-Sam section — the scan is wrong');
  const relays = stops.flatMap((doc) =>
    samItemsAskingHimToRelay(doc.text).map((item) => `${path.basename(doc.file)}: ${item}`));
  assert(relays.length === 0,
    `item(s) asking Sam to route information: ${relays.join(' | ')}. `
    + 'The seat reads the repo; he gives decisions, device time, and what only he has.');
});

/**
 * `LAW-plain-coach-english`, AND SAM'S RE-WORDING IS BETTER THAN THE SEAT'S.
 *
 * The seat proposed checking NOW.md's prose. He said: *"it is APP WORDING, and
 * wording already has a register"* — `signedCopy.ts`. Every word the athlete
 * reads already passes one door; this makes that door refuse engineering
 * vocabulary, which is both narrower and exactly right.
 */
const JARGON = /\b(planEntryId|microcycle|overlay|canonical\w*|gateway|invariant|hydrat\w*|powerBlock|exposureContract|subphase|null|undefined|payload|serialis\w*|envelope|projection|L-[A-Z]\d)\b/i;

/** Pure: signed athlete-facing strings carrying engineering vocabulary. */
function signedStringsWithJargon(
  entries: readonly { readonly id: string; readonly text: string }[],
): string[] {
  return entries
    .filter((entry) => JARGON.test(entry.text))
    .map((entry) => `${entry.id}: "${entry.text.slice(0, 50)}"`);
}

run('no word the athlete reads is engineering vocabulary', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { signedCopyEntries } = require('../rules/signedCopy') as {
    signedCopyEntries: () => readonly { id: string; text: string }[];
  };
  // The sheet is populated by the modules that register into it, so importing
  // them is what makes this cell non-vacuous. A sheet read before its
  // registrars load is an empty sheet and a vacuous green.
  require('../rules/unreadableWorldReset');
  require('../rules/teamNightSize');
  require('../rules/coachTabCopy');
  require('../rules/projectionCopy');
  const entries = signedCopyEntries();
  assert(entries.length >= 5, `only ${entries.length} signed entries loaded — the sheet is not populated`);
  const jargon = signedStringsWithJargon(entries);
  assert(jargon.length === 0,
    `athlete-facing signed string(s) carrying engineering words: ${jargon.join(' | ')}. `
    + '"L-P6 invariant" says nothing he can act on.');
});

/**
 * `LAW-commit-before-mutation-testing` — GUARDED WITHOUT RE-WORDING.
 *
 * Sam: *"git proves this one outright."*
 *
 * **WHAT THIS CELL HOLDS, EXACTLY:** no committed script, tape or tool in this
 * repo reverts a file with `git checkout --` or `git stash` — the two
 * mechanisms whose founding case lost an hour of unrelated wiring twice in one
 * session on 2026-07-28, because both take every other edit in the file with
 * them.
 *
 * **WHAT IT DOES NOT HOLD:** a human typing either at a prompt. That half stays
 * loud rather than checked, and saying so here is the difference between a
 * guard and a guard that reads wider than it is.
 */
const DESTRUCTIVE_REVERT = /git\s+(checkout\s+--|stash\b)/;

/**
 * A MENTION IS NOT A USE — and this cell's FIRST RUN flagged the two files that
 * DEFINE the law, because both spell the forbidden command out in prose.
 *
 * **THE FIRST FIX WAS WRONG TOO AND ITS OWN LIVENESS PROBE CAUGHT IT.** Stripping
 * every string literal made the TypeScript scan blind by construction: in a `.ts`
 * file a shell command is ALWAYS inside a string, so "strip the strings" removes
 * exactly the uses this cell exists to find. It would have gone green and read
 * nothing.
 *
 * So the discriminator is not comment-vs-code, it is **EXECUTION**: in TS/JS the
 * command counts only where it is being HANDED TO A SHELL. In a `.sh` file every
 * line is execution, so any occurrence counts.
 */
const EXECUTED_DESTRUCTIVE_REVERT =
  /\b(execSync|execFileSync|exec|spawnSync|spawn|\$)\s*\(\s*[`'"][^`'"]*git\s+(checkout\s+--|stash\b)/;

/** Pure: committed tooling that reverts by a mechanism which eats neighbours. */
function toolingThatRevertsDestructively(
  files: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return files
    .filter((entry) => (/\.(ts|tsx|js)$/.test(entry.file)
      ? EXECUTED_DESTRUCTIVE_REVERT.test(entry.text)
      : DESTRUCTIVE_REVERT.test(entry.text.replace(/^\s*#.*$/gm, ' '))))
    .map((entry) => path.relative(repoRoot, entry.file));
}

run('no committed tool reverts a file by a mechanism that eats its neighbours', () => {
  // THIS FILE IS EXCLUDED FROM ITS OWN SCAN, and it is the only exclusion.
  // Its liveness probes below hand the checker `execSync("git stash")` as a
  // FIXTURE, which is indistinguishable from a use by any reader that does not
  // know it is reading a test of itself. Excluding one named file is honest;
  // widening the pattern until the fixture slips through would blind the cell
  // for every other file too — `a fixture is a claim too`, from the other side.
  const selfExclusion = path.join(repoRoot, 'src', '__tests__', 'repoLawGuardsTests.ts');
  const walked = [
    ...filesUnder(path.join(repoRoot, 'scripts'), ['.sh', '.js', '.ts']),
    ...filesUnder(path.join(repoRoot, 'src'), ['.ts', '.tsx']),
  ];
  assert(walked.includes(selfExclusion), 'the self-exclusion names a file the walk does not reach');
  const scanned = walked
    .filter((file) => file !== selfExclusion)
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  assert(scanned.length > 50, `only ${scanned.length} files scanned — the walk is wrong`);
  const destructive = toolingThatRevertsDestructively(scanned);
  assert(destructive.length === 0,
    `tool(s) reverting with git checkout --/stash: ${destructive.join(', ')}. `
    + 'Copy the file back from the scratchpad instead — both of these take every '
    + 'unrelated edit in the file with them, twice in one session on 2026-07-28.');
});

run('the checkers red on fabricated violations (liveness)', () => {
  // ── the four Sam re-worded, probed BOTH directions ──
  assert(doneClaimsWithNoDeviceWord('- **⚠ SAM: IT WORKS NOW.** trust me\n').length === 1,
    'a done-claim with no device word passed');
  assert(doneClaimsWithNoDeviceWord('- **⚠ SAM: IT WORKS NOW.** NOT ON GLASS yet\n').length === 0,
    'an honestly-unseen claim was flagged — the law is about silence, not caution');

  assert(samQuestionsWithNoSearchReceipt(
    '## WHAT IS BLOCKED ON SAM\n\n1. **Which colour?** your call\n').length === 1,
    'a question to Sam citing nothing passed');
  assert(samQuestionsWithNoSearchReceipt(
    '## WHAT IS BLOCKED ON SAM\n\n1. **Which colour?** docs/RULING.md says nothing\n').length === 0,
    'a question that cites what it searched was flagged');

  assert(samItemsAskingHimToRelay(
    '## WHAT IS BLOCKED ON SAM\n\n1. **Paste this report to the seat.**\n').length === 1,
    'an item asking Sam to route information passed — the routing role came back');
  assert(samItemsAskingHimToRelay(
    '## WHAT IS BLOCKED ON SAM\n\n1. **His Apple ID for eas.json.**\n').length === 0,
    'a thing only Sam has was flagged as a relay ask');

  assert(signedStringsWithJargon([{ id: 'x', text: 'Your microcycle is ready' }]).length === 1,
    'an athlete-facing string carrying engineering vocabulary passed');
  assert(signedStringsWithJargon([{ id: 'x', text: 'Your week is ready' }]).length === 0,
    'plain coach English was flagged as jargon');

  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.sh', text: 'git checkout -- src/a.ts' }]).length === 1,
    'a destructive revert in committed tooling passed');
  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.sh', text: 'git checkout main' }]).length === 0,
    'an ordinary branch checkout was flagged as a destructive revert');
  // THE FIRST-RUN FALSE POSITIVE, PINNED. This cell flagged the two files that
  // DEFINE the law because both spell the command out in prose.
  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.ts', text: '// never use git stash here\nconst x = 1;' }]).length === 0,
    'a COMMENT naming the forbidden command was read as a use of it');
  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.ts', text: 'const doc = "reverting with git stash loses edits";' }]).length === 0,
    'a PROSE STRING naming the forbidden command was read as a use of it');
  // AND THE OPPOSITE FAULT, which the first fix walked straight into: in a .ts
  // file the command is ALWAYS inside a string, so a scan that strips strings
  // is blind by construction and goes green having read nothing.
  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.ts', text: 'execSync("git stash");' }]).length === 1,
    'a REAL execution was missed — the scan strips the only place a command can live');
  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.ts', text: 'execSync(`git checkout -- src/a.ts`);' }]).length === 1,
    'a real execution in a template literal escaped the scan');
  // A shell file is execution end to end, but its COMMENTS are still prose.
  assert(toolingThatRevertsDestructively(
    [{ file: '/x/a.sh', text: '# do not git stash here\necho ok' }]).length === 0,
    'a shell COMMENT naming the command was read as a use of it');


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

  const boxes = '- [x] a\n- [ ] b\n- [x] c\n';
  assert(unmarkedStatusSurfaces([{ file: 'd/OLD_PLAN.md', text: `# Old\n${boxes}` }]).length === 1,
    'a second doc shipping an unmarked status checklist passed — Sam\'s "am i going to get given an old roadmap again?" case');
  assert(unmarkedStatusSurfaces([{ file: 'd/OLD_PLAN.md', text: `# Old\n> **SUPERSEDED**\n${boxes}` }]).length === 0,
    'a bannered status doc was flagged');
  assert(unmarkedStatusSurfaces([{ file: 'd/NOTE.md', text: '# Note\n- [x] one thing\n' }]).length === 0,
    'a one-box note was treated as a status surface — the gate would be noise');

  assert(rescopeBlocksMissingTheirQuote(['1. The unit is WITHDRAWN and re-scoped smaller.']).length === 1,
    'a silent re-scope passed — the exact defect LAW-do-as-instructed names');
  assert(rescopeBlocksMissingTheirQuote(['1. WITHDRAWN. His words: *"no it is a tweak"* — narrowing to one step.']).length === 0,
    'a re-scope that QUOTES the instruction was flagged — disagreeing out loud is allowed');
  assert(rescopeBlocksMissingTheirQuote(['1. **[TERMINAL, 2026-08-10 — both ancestors carry a SUPERSEDED banner.]**']).length === 0,
    'a terminal REPORT using the word descriptively was read as a re-scoping ORDER');

  const under = [{ name: 'X_BOUNDARY_2026-08-09.md', text: 'we built things' }];
  assert(reportsWithoutALoopCheck(under).length === 1, 'a report with no LOOP CHECK line passed');
  assert(reportsWithoutALoopCheck(
    [{ name: 'X_BOUNDARY_2026-08-09.md', text: 'LOOP CHECK: shape — sighting 1' }]).length === 0,
    'a report WITH a LOOP CHECK line was flagged');
  // Scope: the law is dated, so an older report is not in breach of it.
  assert(reportsUnderTheFormatLaw(
    [{ file: 'd/X_BOUNDARY_2026-07-23.md', text: 'no loop check here' }]).length === 0,
    'a report predating the FORMAT LAW was pulled into its scope');

  assert(repeatSightingsWithNoDisposition(
    [{ name: 'Y_BOUNDARY_2026-08-09.md', text: 'LOOP CHECK shape — sighting 3. moving on.' }]).length === 1,
    'a third sighting with no disposition passed — that is the loop-audit law');
  assert(repeatSightingsWithNoDisposition(
    [{ name: 'Y_BOUNDARY_2026-08-09.md', text: 'sighting 2 — iterate, and it paid.' }]).length === 0,
    'a stated disposition of ITERATE was read as a violation — the law says "iterate or compress"');
  assert(repeatSightingsWithNoDisposition(
    [{ name: 'Y_BOUNDARY_2026-08-09.md', text: 'sighting 1 — first time, nothing owed.' }]).length === 0,
    'a FIRST sighting was required to carry a disposition');

  assert(samFacingClaimsWithoutAReceipt('- **\u26a0 SAM: the app now does X.** Trust me.').length === 1,
    'a bare Sam-facing claim passed — the founding case reached him and was FALSE');
  assert(samFacingClaimsWithoutAReceipt('- **\u26a0 SAM: the app does X.** Held by `test:thing`.').length === 0,
    'a receipted claim was flagged');
  assert(samFacingClaimsWithoutAReceipt('- **\u26a0 SAM: it might do X.** OPEN-UNKNOWN.').length === 0,
    'an honest OPEN-UNKNOWN was flagged — the law offers it as the alternative');
  assert(samFacingClaimsWithoutAReceipt('- **A note with no warning mark.** No receipt here.').length === 0,
    'a non-Sam-facing note was pulled into scope');

  // THE MULTI-LINE FORM FIRST — it is the one this repo actually writes, and a
  // probe in the other form is what let a vacuous scan ship green.
  const multiline = '- runFlow:\n    file: ../common/gone.yaml\n    env:\n      SEED_ID: x';
  assert(brokenFlowReferences([{ file: '.maestro/a.yaml', text: multiline }], () => false).length === 1,
    'the MULTI-LINE runFlow form — the only one this repo uses — was not read at all');
  assert(brokenFlowReferences([{ file: '.maestro/a.yaml', text: multiline }], () => true).length === 0,
    'a resolving multi-line reference was flagged');
  assert(brokenFlowReferences(
    [{ file: '.maestro/a.yaml', text: '- runFlow: ../common/gone.yaml' }], () => false).length === 1,
    'the one-line runFlow form was not read');
  assert(brokenFlowReferences(
    [{ file: '.maestro/a.yaml', text: 'appId: com.x\n- tapOn: thing' }], () => false).length === 0,
    'a flow with no runFlow at all was reported broken');

  assert(unmarkedRivalPlans([{ file: 'd/MASTER_PLAN_x.md', text: '# Plan\n\nthe road to done' }]).length === 1,
    'a rival plan with no SUPERSEDED marker passed — the 2026-08-10 case exactly');
  assert(unmarkedRivalPlans([{ file: 'd/MASTER_PLAN_x.md', text: '# Plan\n\n> **SUPERSEDED**\n' }]).length === 0,
    'a properly marked retired plan was flagged');
  assert(unmarkedRivalPlans([{ file: `d/${GOVERNING_PLAN}`, text: '# Roadmap\n' }]).length === 0,
    'the GOVERNING plan was required to mark itself superseded');
  // The marker must be near the TOP: a supersession buried on line 400 is one
  // nobody reads before planning from the file.
  assert(unmarkedRivalPlans([{
    file: 'd/MASTER_PLAN_x.md',
    text: '# Plan\n' + 'filler\n'.repeat(40) + '> **SUPERSEDED**\n',
  }]).length === 1, 'a supersession marker buried below the opening lines was accepted');
});

console.log(`\nrepo law guards totals: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
