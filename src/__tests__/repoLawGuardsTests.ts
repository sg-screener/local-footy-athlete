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

/**
 * `LAW-no-order-hidden-from-the-stop-hook`.
 *
 * THE DEFECT, AND IT HAS A COST IN SAM'S DAY. `scripts/seat-inbox-hook.sh`
 * bounds its scan at the next `## ` heading
 * (`awk '/^## Unprocessed/{f=1;next} f&&/^## /{exit}'`). So a `## ` heading
 * written INSIDE the unprocessed region truncates the scan, and **every order
 * below it becomes invisible: the terminal ends its turn believing the queue is
 * answered and Sam has to type "check inbox" himself.** He is the message bus
 * again — the courier toll the hook's own comments already price.
 *
 * FOUNDING CASE, 2026-08-12, AND IT WAS THIS TERMINAL'S. Repairing a
 * concurrent-write corruption, it re-homed the rescued block under a `## `
 * heading. Masked only because orders sat above it and kept the hook blocking.
 * **Repairing by hand a file that has a parser, without reading the parser, is
 * the same class of mistake as the corruption it was fixing.**
 *
 * SIGHTING 5 of the class the hook's comments catalogue twice — "the scan
 * infers 'an order exists' from an artefact". Every previous instance was fixed
 * INSIDE the hook and stayed invisible to anything else. **This is the first
 * one with a gate over the FILE**, which is the half that was always missing:
 * the hook cannot detect the heading that stops it reading.
 *
 * WHAT THIS HOLDS: the unprocessed region contains no `## ` heading before its
 * terminator, so nothing in it can be hidden. Sub-headings must be `###`.
 * WHAT IT DOES NOT: it does not check that the orders are GOOD, or that anyone
 * acted on them.
 */
const INBOX_ORDERS_START = '## Unprocessed';
const INBOX_ORDERS_END = '## SAFE FOR A PARALLEL AGENT';

/** Pure: `## ` headings inside the unprocessed region that truncate the scan. */
function headingsHidingOrders(markdown: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(INBOX_ORDERS_START));
  if (start < 0) return ['the unprocessed region is gone — this gate reads nothing'];
  const end = lines.findIndex((line, i) => i > start && line.startsWith(INBOX_ORDERS_END));
  if (end < 0) return [`the region terminator "${INBOX_ORDERS_END}" is gone — this gate reads nothing`];
  return lines
    .slice(start + 1, end)
    .filter((line) => /^## /.test(line))
    .map((line) => line.trim());
}

/** Pure: order-shaped, column-0 lines the hook's own scan can actually reach. */
function hookVisibleOrderLines(markdown: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(INBOX_ORDERS_START));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^## /.test(line)) break; // the hook stops here, and so do we
    if (!line || /^\s/.test(line)) continue;
    const norm = line
      .replace(/^[*_>#]+\s*/, '')
      .replace(/^[0-9]+\.\s*/, '')
      .replace(/^[-*+]\s*/, '')
      .replace(/^[*_]+/, '');
    if (/^\(?(none|nothing|queue empty|empty)\b/i.test(norm)) continue;
    if (/parked/i.test(line)) continue;
    out.push(line);
  }
  return out;
}

run('no seat order can hide from the stop hook behind a `##` heading', () => {
  const inbox = fs.readFileSync(path.join(repoRoot, 'docs', 'SEAT_INBOX.md'), 'utf8');

  // NON-VACUITY FIRST. A region the scan cannot find, or one holding no orders,
  // passes this cell trivially — and an empty parse is exactly what a bad
  // bound produces (the 2026-08-07 (a) misfire, in the other direction).
  const visible = hookVisibleOrderLines(inbox);
  assert(visible.length > 5,
    `the hook's own scan reaches only ${visible.length} order-shaped line(s) — `
    + 'the region bounds are wrong and every assertion here is vacuous');

  const hiding = headingsHidingOrders(inbox);
  assert(hiding.length === 0,
    `these '## ' heading(s) sit inside the unprocessed region and TRUNCATE the `
    + `stop hook's scan, hiding every order below them: ${JSON.stringify(hiding)}. `
    + 'Sub-headings inside `## Unprocessed` must be `###`. An order the hook '
    + 'cannot see ends the turn silently and makes Sam the courier.');
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

// PLAIN ENGLISH COUNTS, RULED 2026-08-10. The tag clash Sam was asked to settle
// dissolved into two AUDIENCES, not two rules: what he reads is plain English,
// what the repo carries keeps the machine-readable token. The law's intent is
// *every claim carries its status* — plain words satisfy that for a human reader
// exactly as the token does for a script, so this cell accepts both.
// WHITESPACE-TOLERANT, and its first run is why: the phrase "none of this has
// been on your phone" reds the moment prose re-wraps across a line, which it did
// within minutes of this cell landing. A gate over PROSE that cannot survive a
// line break is a gate that punishes editing, not a gate that checks anything.
const PLAIN_STATUS_SOURCE = [
  'not (yet )?proven', 'not (yet )?seen on your phone', 'not on your phone',
  'never been on your phone', 'not something you have seen',
  'never (actually )?(been shown|tapped|rendered)', 'never tapped on your phone',
  'has not been on your phone', 'none of (this|it) has been on your phone',
  'nothing here has been seen on your phone', 'waiting on your word',
  'still open', 'i have not proven', "do(n't| not) know yet",
].join('|').replace(/ /g, '\\s+');
const PLAIN_STATUS = new RegExp(PLAIN_STATUS_SOURCE, 'i');
const CLAIM_RECEIPT = new RegExp(
  ['`test:', '`npm run', '`tape:', '\\b[0-9a-f]{7,40}\\b', '\\.tsx?:\\d+',
    'OPEN-UNKNOWN', 'NOT ON GLASS', PLAIN_STATUS_SOURCE].join('|'), 'i');

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
// SAME AUDIENCE SPLIT (ruled 2026-08-10): the repo may say NOT ON GLASS; what
// Sam reads says it in plain words. Both are the law being satisfied, so both
// count here — a cell that accepted only the token would have forced jargon back
// into the one place he asked for none.
const DEVICE_RECEIPT = new RegExp(
  ['NOT ON GLASS', 'NOT SEEN', 'UNSEEN', 'OPEN-UNKNOWN', 'on glass', 'device pass',
    'simulator', 'on (his|your) phone', 'npx expo run', PLAIN_STATUS_SOURCE].join('|'), 'i');

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
/**
 * **AN ASK, NOT A MENTION — and this cell's own first run proved it needs the
 * distinction.** It flagged the STOP item that said *"this is a thing only he
 * can grant, not a report to relay"* — a sentence DENYING the ask, caught by a
 * scan that read the word and not the sentence.
 *
 * Sighting 2 of mention-vs-use inside one session; the first was the revert scan
 * flagging the two files that define its law. **COMPRESSION: a repo check over
 * PROSE matches an ASK — an imperative or a second-person request — never a bare
 * keyword**, because prose about a rule necessarily contains the rule's words.
 */
const RELAY_ASK = /(^|[.:*]\s*)(please\s+)?(relay|paste|forward|send|copy|route|tell the seat|read (this|it) (to|back))\b(?![^.]*\bnot\b)/i;

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

/**
 * `LAW-permission-is-granted-once` — seat, 2026-08-10, and its founding case is
 * this terminal, twice in a row.
 *
 * Sam ruled two file operations. The tool refused them, so the terminal put them
 * back to him as blocked-on-Sam items — **and then did it a second time in the
 * next report.** The seat's words: *"asking twice for a permission already
 * granted is the courier toll in a new coat."*
 *
 * **The checkable form: a blocked-on-Sam item is a DECISION, DEVICE TIME, or a
 * THING ONLY HE HAS. It is never a request for permission**, because permissions
 * live in the inbox and are granted until he withdraws them — so the fix for a
 * refused operation is to read the file, not to ask again.
 */
const PERMISSION_ASK = /\b(permission to|authoris\w+ (me|the)|may I|can I|allow me to|your (permission|say-so)|okay to|ok to)\b/i;

/** Pure: blocked-on-Sam items asking for permission rather than a decision. */
function samItemsAskingForPermission(doc: string): string[] {
  const heading = doc.match(SAM_BLOCK_HEADING);
  if (!heading) return [];
  const section = doc.slice(doc.indexOf(heading[0]) + heading[0].length).split(/\n##+ /)[0];
  return section
    .split(/\n(?=\d+\. )/)
    .map((item) => item.trim())
    .filter((item) => /^\d+\. /.test(item))
    .filter((item) => PERMISSION_ASK.test(item))
    .map((item) => item.split('\n')[0].slice(0, 70));
}

/**
 * `LAW-test-worlds-are-generated-or-real` — Sam, 2026-08-10.
 *
 * His words, and he named the risk before anyone measured it: *"I don't want to
 * use a practice week if it's not the most elegant way to ensure that all future
 * builds actually help the app instead of just optimising for this one tiny
 * week..."*
 *
 * **The rule: a test world is either GENERATED by the app's own generator from a
 * profile, or a REAL DEVICE EXPORT. Never hand-authored.** A hand-written week
 * is a third thing pretending to be either, and a suite green against one is
 * green against a world the app would never build.
 *
 * ## THE SEAT'S PREMISE IS PARTLY REFUTED, AND THAT IS THE FINDING
 *
 * The order said the existing seeds "are hand-authored". **Measured: they are
 * not.** `devE2ESeedRegistry.ts` builds every world through
 * `generateProgramLocally(profile, …)` and contains **zero** `workouts: [`,
 * `microcycles: [` or `exercises: [` literals. The rule Sam wants is already
 * how the registry works.
 *
 * **What HAS drifted is a different thing and is not fixed by this cell** — the
 * seeds' Mixed days projecting a single strength part, no seed row carrying a
 * power role, `equipment-restriction-case` failing to install. That is drift
 * BETWEEN a generated world and its projection, not hand-authoring, and calling
 * it hand-authoring would have sent the fix at the wrong layer.
 *
 * So this cell PINS a property the repo already has, which is the cheap half of
 * a law: it cannot rot silently now.
 */
const HAND_AUTHORED_WORLD = /^\s*(workouts|microcycles|exercises)\s*:\s*\[/m;

/** Pure: seed sources that build a world from a literal instead of the generator. */
function handAuthoredSeedWorlds(
  files: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return files
    .filter((entry) => HAND_AUTHORED_WORLD.test(stripBlockComments(entry.text)))
    .map((entry) => path.relative(repoRoot, entry.file));
}

function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

run('every test world is generated by the app, never hand-authored', () => {
  const registry = path.join(repoRoot, 'src', 'dev', 'e2e', 'devE2ESeedRegistry.ts');
  const text = fs.readFileSync(registry, 'utf8');
  // NON-VACUOUS: the file must actually build worlds through the generator, or
  // this cell is passing over a file that does nothing.
  assert(/generateProgramLocally\(/.test(text),
    'the seed registry does not call the generator — this cell is reading the wrong file');
  const handAuthored = handAuthoredSeedWorlds([{ file: registry, text }]);
  assert(handAuthored.length === 0,
    `seed world(s) built from a literal rather than the generator: ${handAuthored.join(', ')}. `
    + 'A hand-written week is a world the app would never build, and a suite green '
    + 'against it is green against nothing.');
});

/**
 * `LAW-seed-channel-is-first-class` — Sam, 2026-08-10, overruling a cheaper plan:
 * *"i dont care if it has to do 1 rebuild for 40 minutes - i care about the best
 * solution long term"*.
 *
 * A harness input arrives on **its own named, validated, fail-closed channel** —
 * never smuggled as a second meaning on an existing field. The temptation here
 * was real and was refused: a seed id could physically ride inside `e2eMetroUrl`
 * and dodge a native rebuild, and that is the two-meanings-on-one-field defect
 * that cost a pass the same morning with the `source` label.
 *
 * **WHAT THIS CELL HOLDS AND WHAT IT DOES NOT.** It reads the SOURCE: the key
 * exists under its own name, it is validated against a declared shape, and a
 * malformed value is fatal rather than degrading to "no seed" — which is how a
 * run goes green having tested an empty world. **It cannot prove the refusal
 * FIRES**; that needs a simulator launch with a bad value, and no run-through
 * completes yet. Stated here rather than implied, and the row says the same.
 *
 * It exists at all because the alternative was a new row entering `UNENFORCED`,
 * which LAW ZERO forbids from 2026-08-10 and which would have pushed the
 * unguarded count UP — the one direction Sam ruled it may never move.
 */
function seedChannelFaults(swift: string): string[] {
  const faults: string[] = [];
  const code = stripBlockComments(swift);
  if (!/seedIdKey\s*=\s*"e2eSeedId"/.test(code)) {
    faults.push('the seed channel has no key of its own');
  }
  if (!/seedIdPattern/.test(code)) faults.push('the seed id is not validated against a declared shape');
  // FAIL CLOSED, RE-AIMED 2026-08-10 — AND THE PROPERTY IS UNCHANGED, ONLY ITS
  // SPELLING IS. It used to look for `fatalError(…Invalid…)`, because a crash
  // was how this channel refused. Sam then ruled that a dev diagnostic may not
  // kill the app, so the ten `fatalError`s became typed refusals. **The thing
  // being protected was never the crash — it was that a malformed seed id can
  // never degrade into "no seed", which is how a run goes green having tested an
  // empty world.** So the check is: the malformed branch RECORDS a refusal AND
  // STOPS. A refusal without the stop would fall through and seed nothing
  // quietly, which is the exact defect the crash was standing in for.
  const refusesMalformedSeed = /refuse\(\s*"seed-id-[a-z-]+"/.test(code);
  const stopsAfterRefusing = /refuse\(\s*"seed-id-[a-z-]+"[\s\S]{0,200}?\breturn\b/.test(code);
  if (!refusesMalformedSeed || !stopsAfterRefusing) {
    faults.push('a malformed seed id does not fail closed');
  }
  // THE SMUGGLING CHECK, AND ITS FIRST VERSION WAS WRONG. It read the 200
  // characters after `launchArgumentKey` and flagged any mention of "seed" —
  // which fired on the seed key's own DECLARATION sitting two lines below it.
  // **Adjacency is not smuggling.** What smuggling would actually look like is
  // the seed being READ OUT OF the metro url; so the check is that the seed
  // value is only ever assigned from a read of its own key.
  const seedAssignments = code.match(/validatedSeedId\s*=\s*[^\n]+/g) ?? [];
  const smuggled = seedAssignments.filter((line) =>
    !/rawSeedId|nil/.test(line) || /metro|MetroUrl/i.test(line));
  if (smuggled.length > 0) {
    faults.push(`the seed value is assigned from something other than its own key: ${smuggled[0]}`);
  }
  return faults;
}

run('the seed channel is first-class — own name, own validation, fails closed', () => {
  const swift = fs.readFileSync(
    path.join(repoRoot, 'ios', 'LocalFootyAthlete', 'DevE2ELaunchDiagnostic.swift'), 'utf8');
  assert(/e2eMetroUrl/.test(swift), 'the launch diagnostic source is not the file being read');
  const faults = seedChannelFaults(swift);
  assert(faults.length === 0,
    `seed channel fault(s): ${faults.join('; ')}. A harness input rides its own `
    + 'validated channel or it is a second meaning on somebody else\'s field.');
});

/**
 * THE COVERAGE RATCHET — `LAW-no-hand-built-fixtures`, which has sat UNGUARDED
 * in the registry and is **exactly how the eleven existing seeds rotted**.
 *
 * **Sam, 2026-08-10, and he has been failed by this class before:** *"I don't
 * want to get 2 weeks down the line and realise that a fucking weekly template
 * optimised for that and that alone - its happened before and if it happens
 * again i'll fucking kill myself"*.
 *
 * The order names three failure conditions. **This cell holds the third — the
 * set of worlds under test may never shrink** — and it is the one buildable
 * without a device. Same shape as the UNENFORCED law count: coverage can only go
 * up, so a world can be added but never quietly dropped to make a suite green.
 *
 * **WHAT IS NOT HELD HERE, AND THE ROW SAYS SO TOO:** the DRIFT check — *does a
 * world's shape still match what the generator produces for that profile
 * today?* — is the condition that would have caught the eleven seeds the day
 * they went stale. It needs the generator run per profile and belongs with the
 * first run-through, which is where the order puts it: *"build it WITH the first
 * world"*, and one flow is not green yet.
 */
const SEED_COVERAGE_FLOOR = 11;

/** Pure: how many worlds the harness declares it covers. */
function declaredSeedWorldCount(seedIdsSource: string): number {
  const block = seedIdsSource.split('DEV_E2E_SEED_IDS = [')[1]?.split(']')[0] ?? '';
  return (block.match(/'[^']+'/g) ?? []).length;
}

run('the set of test worlds never shrinks', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'src', 'dev', 'e2e', 'devE2ESeedIds.ts'), 'utf8');
  const declared = declaredSeedWorldCount(source);
  assert(declared >= SEED_COVERAGE_FLOOR,
    `test worlds fell from ${SEED_COVERAGE_FLOOR} to ${declared}. Coverage ratchets `
    + 'UP only — a world removed to make a suite green is the failure Sam has '
    + 'already been bitten by. Raise the floor when you add; never lower it.');
});

run('nothing asks Sam for a permission he has already given', () => {
  const stops = filesUnder(path.join(repoRoot, 'docs'), ['.md'])
    .filter((file) => /STOP/i.test(path.basename(file)))
    .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }))
    .filter((doc) => SAM_BLOCK_HEADING.test(doc.text));
  assert(stops.length >= 1, 'no STOP report with a blocked-on-Sam section — the scan is wrong');
  const asks = stops.flatMap((doc) =>
    samItemsAskingForPermission(doc.text).map((item) => `${path.basename(doc.file)}: ${item}`));
  assert(asks.length === 0,
    `item(s) asking Sam for permission: ${asks.join(' | ')}. `
    + 'A permission recorded in the inbox is granted until he withdraws it — '
    + 'read the file rather than ask again. Blocked-on-Sam is decisions, device '
    + 'time, and things only he has.');
});

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

// ── THE HOT FILES HAVE A BUDGET ──────────────────────────────────────────────
//
// `LAW-hot-file-budget`. **The founding case is a bill.** Sam ran `/usage` on
// 2026-08-10: **126M tokens IN, 5k out, $68.95 for 1h43m** — and almost all of
// the input was READING, not thinking. Two files were re-read at every stop:
// `SEAT_INBOX.md` at **353KB** and `NOW.md` at **53KB**. Both had one line at the
// top saying what they were for — *"the review seat writes here; terminal reads
// at every stop"* and *"overwrite at every checkpoint (pointer, not history)"* —
// and both had quietly become history instead.
//
// **THIS IS THE SAME SHAPE AS EVERY OTHER ROT IN THIS REPO: correct when
// written, nobody watching it drift.** The registry's own pattern says the fix
// is not the trim, it is the alarm. The trim happened once and would grow back
// within a day; the alarm is what makes the trim hold.
//
// **WHY THESE NUMBERS.** They are not the current sizes — a budget set to what
// you just achieved reds on the next honest sentence. They are roughly **2x**
// the post-trim size, which is room for a week of normal appending and a hard
// stop well below the point where the file is worth what it costs to read:
//   - `NOW.md` — post-trim ~4KB, budget **24KB**. It is a POINTER; 24KB is
//     already generous for a status surface whose job is links.
//   - `SEAT_INBOX.md` — post-trim ~45KB, budget **96KB**. Orders are longer than
//     pointers and several may be live at once, so the ceiling is higher — but
//     it is a quarter of what the file reached.
// **The number matters less than the alarm existing**, and when one reds the
// answer is to ARCHIVE (verbatim, to a dated file), never to delete.
const HOT_FILE_BUDGETS: readonly { readonly file: string; readonly maxBytes: number }[] = [
  { file: 'docs/NOW.md', maxBytes: 24 * 1024 },
  { file: 'docs/SEAT_INBOX.md', maxBytes: 96 * 1024 },
];

/** Pure: the budgeted files that are over, with the overage named. */
function hotFilesOverBudget(
  sizes: readonly { readonly file: string; readonly bytes: number; readonly maxBytes: number }[],
): string[] {
  return sizes
    .filter((entry) => entry.bytes > entry.maxBytes)
    .map((entry) => `${entry.file} is ${Math.round(entry.bytes / 1024)}KB, `
      + `budget ${Math.round(entry.maxBytes / 1024)}KB`);
}

run('the files re-read at every stop stay inside their budget', () => {
  const sizes = HOT_FILE_BUDGETS.map((budget) => {
    const full = path.join(repoRoot, budget.file);
    assert(fs.existsSync(full), `${budget.file} is budgeted but does not exist — the budget is stale`);
    return { file: budget.file, bytes: fs.statSync(full).size, maxBytes: budget.maxBytes };
  });
  // NOT VACUOUS: a budget over a file that is never read is a green that means
  // nothing. Both files must actually have content to be over-budget ABOUT.
  assert(sizes.every((entry) => entry.bytes > 0), 'a budgeted hot file is empty');
  const over = hotFilesOverBudget(sizes);
  assert(over.length === 0,
    `hot file(s) over budget: ${over.join(' | ')}. ARCHIVE the processed part `
    + 'verbatim to a dated file and leave the pointer — do not delete it, and do '
    + 'not raise the budget to match the file. Sam pays for this one in dollars.');
});

// ── A DEV DIAGNOSTIC MUST NOT BE ABLE TO KILL THE APP ────────────────────────
//
// `LAW-diagnostic-refuses-never-crashes`. Sam's order, 2026-08-10, after the
// THIRD crash of one shape in a single day: *"A DEV DIAGNOSTIC MUST NOT BE ABLE
// TO KILL THE APP. It should refuse loudly — a visible marker the flow can
// assert on, a log line, a red screen — and let the app boot… A crash is the
// least debuggable possible signal: it destroys the process before anything can
// report why."*
//
// THE CENSUS HE ASKED FOR, MEASURED: `DevE2ELaunchDiagnostic.swift` held **TEN**
// hard `fatalError`s on the launch path, all reachable from
// `didFinishLaunchingWithOptions` — before one line of JavaScript. Three of them
// each cost a debugging cycle: the missing launch purpose (read as "the rig is
// dead" for 23 days), the resolved-bundle trap behind the reload flows, and the
// Metro URL — which fired because a runner was invoked without its `-e` binding
// and the app was handed the LITERAL string `${E2E_METRO_URL}`.
//
// **EVERY ONE OF THE THREE WAS AN INPUT MISTAKE OUTSIDE THE APP**, and each time
// the only evidence was an `.ips` file. The count is now zero.
//
// WHY A REPO CHECK AND NOT A CELL. Swift on the launch path cannot be exercised
// by this chain at all — it needs a device and a native rebuild. What IS
// checkable, cheaply and from here, is that the class does not come back, which
// is the half that rots.
const HARD_STOP = /\b(fatalError|assertionFailure|preconditionFailure)\s*\(|\bprecondition\s*\(/;
const IOS_APP_SOURCES = 'ios/LocalFootyAthlete';

/** Pure: launch-path sources that can still kill the process. */
function nativeSourcesThatCanCrash(
  files: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return files
    // A LINE COMMENT DESCRIBING THE BAN IS NOT THE BAN BEING BROKEN. Same
    // `a comment is not a shipped string` shape that bit the copy gate — from
    // the other side, where a comment produces a false RED.
    .filter((entry) => HARD_STOP.test(entry.text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ' ')))
    .map((entry) => entry.file);
}

run('no dev diagnostic on the launch path can kill the app', () => {
  const dir = path.join(repoRoot, IOS_APP_SOURCES);
  assert(fs.existsSync(dir), `${IOS_APP_SOURCES} is not there — this gate is reading nothing`);
  const files = fs.readdirSync(dir)
    .filter((name) => /\.(swift|m|mm)$/.test(name))
    .map((name) => ({
      file: `${IOS_APP_SOURCES}/${name}`,
      text: fs.readFileSync(path.join(dir, name), 'utf8'),
    }));
  assert(files.length >= 2, `only ${files.length} native source(s) scanned — the walk is wrong`);
  // NON-VACUITY: the file the order is about must be in the scan.
  assert(files.some((entry) => entry.file.endsWith('DevE2ELaunchDiagnostic.swift')),
    'the launch diagnostic is not in the scan — a green here would mean nothing');
  const crashing = nativeSourcesThatCanCrash(files);
  assert(crashing.length === 0,
    `native launch-path source(s) that can kill the process: ${crashing.join(', ')}. `
    + 'Refuse instead: NSLog the cause, record a typed code, let the app boot, and '
    + 'let the flow assert on `e2e-explorer-launch-error-<code>`. A crash cannot '
    + 'tell a bad URL from a bad seed id from a real boot defect.');
});

// AND THE REFUSAL HAS TO REACH A FLOW, OR IT IS JUST A QUIETER CRASH.
run('a native launch refusal becomes a marker a flow can assert on', () => {
  const swift = fs.readFileSync(
    path.join(repoRoot, IOS_APP_SOURCES, 'DevE2ELaunchDiagnostic.swift'), 'utf8');
  const entry = fs.readFileSync(
    path.join(repoRoot, 'src', 'dev', 'e2e', 'devE2EEntry.tsx'), 'utf8');
  assert(/launchRefusalCodes/.test(swift),
    'the Swift side no longer exports its refusals — a refusal nothing can read '
    + 'is a crash with better manners');
  assert(/constants\["launchRefusalCodes"\]/.test(swift),
    'the refusals are no longer put on the constants bridge, which is the one '
    + 'channel measured to reach JS');
  assert(/launchRefusalCodes/.test(entry) && /setDevE2EExplorerLaunchError/.test(entry),
    'the JS side no longer publishes native refusals as launch-error markers');
  // AND IT IS PUBLISHED BEFORE THE WORK THAT WILL FAIL BECAUSE OF IT, so the
  // marker naming the real cause is up before any consequential one.
  // THE CALL SITE, NOT THE IMPORT — and the first version of this line read the
  // bare name and found the import statement at the top of the file, so it
  // reported an ordering fault that did not exist. A scan that matches a name
  // anywhere matches its declaration first.
  const publishAt = entry.indexOf('  publishNativeLaunchRefusals();');
  const hydrateAt = entry.indexOf('hydrateExplorerNativeLaunchDiagnostic({');
  assert(publishAt > 0 && hydrateAt > 0 && publishAt < hydrateAt,
    'native refusals are published after the launch diagnostic is hydrated — the '
    + 'first marker up would be a consequence, not the cause');
});

// ── A REMOVAL SHIPS THE DAY ITS REPLACEMENT DOES ─────────────────────────────
//
// `LAW-removal-ships-with-its-replacement`. Sam's binding line on the UI merge is
// *"without destroying what i have now"*, and the seat generalised the call that
// honoured it: the season-phase box stayed on the day screen because its new home
// on the coach page does not exist yet, and deleting it would have left him with
// no way to change season phase at all.
//
// THE MECHANISABLE HALF is the merge plan's own REMOVAL LEDGER: a table whose
// whole purpose is that no removal ships without a row naming where the behaviour
// went. A row with an empty destination is a removal with nowhere to land, which
// is the defect stated as data.
const REMOVAL_LEDGER_DOC = 'UI_MERGE_PLAN_2026-08-10.md';

/** Pure: removal-ledger rows whose "where the behaviour goes" cell is empty. */
function removalsWithNoDestination(markdown: string): string[] {
  const heading = /^##+ .*REMOVAL LEDGER.*$/im.exec(markdown);
  if (!heading) return ['the removal ledger section is gone'];
  const section = markdown.slice(markdown.indexOf(heading[0]) + heading[0].length)
    .split(/\n##+ /)[0];
  return section.split('\n')
    .filter((line) => line.trimStart().startsWith('|'))
    // Header and the `| --- |` separator are not rows.
    .filter((line) => !/^\s*\|[\s|:-]*\|\s*$/.test(line) && !/\bRemoved\b/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    // `| a | b | c | d |` splits to ['', a, b, c, d, ''] — five cells of content.
    .filter((cells) => cells.length >= 6)
    .filter((cells) => cells[4].length === 0 || /^(TBD|\?|-+)$/i.test(cells[4]))
    .map((cells) => cells[2] || '(unnamed removal)');
}

run('no planned removal ships without naming where the behaviour went', () => {
  const full = path.join(repoRoot, 'docs', REMOVAL_LEDGER_DOC);
  assert(fs.existsSync(full), `${REMOVAL_LEDGER_DOC} is gone — this gate reads nothing`);
  const markdown = fs.readFileSync(full, 'utf8');
  // NON-VACUITY: an empty ledger passes trivially, and an empty ledger is what a
  // bad parse produces.
  const rows = markdown.split(/^##+ .*REMOVAL LEDGER.*$/im)[1] ?? '';
  assert((rows.split('\n').filter((l) => l.trimStart().startsWith('|')).length) >= 4,
    'the removal ledger parsed to fewer than four lines — the scan is wrong');
  const orphans = removalsWithNoDestination(markdown);
  assert(orphans.length === 0,
    `removal(s) with nowhere to land: ${orphans.join(', ')}. Sam's line is `
    + '"without destroying what i have now" — a removal ships the same day its '
    + 'replacement does, never before.');
});

// ── A WHITE SCREEN MUST BE IMPOSSIBLE TO REACH SILENTLY ──────────────────────
//
// `LAW-no-silent-blank-screen`. Sam's order, 2026-08-10, after losing time to a
// blank screen TWICE in one day (the log overlay that hid the tab bar, then
// this): *"a white screen must be impossible to reach silently."*
//
// FOUNDING CASE, MEASURED ON THE DEVICE. In `__DEV__` the navigator mounts only
// after `prepareDevE2EAppLaunch()` resolves. It returned a bare `false` on any
// failure and the effect returned — so the app rendered a root with NOTHING in
// it, forever, no error and no text. A harness run leaves a dev clock receipt;
// the next PLAIN launch reads a receipt with no checkpoint, the restore throws,
// and that is the white screen. **Every source-reading cell in this chain passed
// while it happened** — there is nothing wrong with code that did not run — which
// is why the real instrument is `.maestro/golden/dev-launch-refusal-speaks.yaml`
// and this cell only stops the SHAPE from coming back.
const BOOT_GATE_FILE = 'App.tsx';

/** Pure: the ways the dev boot gate can go dark without saying anything. */
function silentBlankScreenFaults(app: string): string[] {
  const faults: string[] = [];
  // The refusal must have somewhere to land. A boolean that is only ever used to
  // decide whether to mount cannot produce a message.
  if (!/dev-launch-refused/.test(app)) {
    faults.push('nothing renders when the development launch barrier refuses');
  }
  if (!/dev-launch-refused-reason/.test(app)) {
    faults.push('the refusal does not show WHY — a reasonless refusal is the blank screen with a border');
  }
  if (!/dev-launch-refused-clear/.test(app)) {
    faults.push('the refusal offers no way out — honest and still a dead end');
  }
  // AND THE REASON MUST COME FROM THE BARRIER, not be invented at the surface.
  // `prepareDevE2EAppLaunch` returning a bare boolean is the exact regression.
  if (/prepareDevE2EAppLaunch\(\)\.then\(\((?:ready|[a-z]+)\)/.test(app)) {
    faults.push('the barrier is being read as a bare boolean again — the reason cannot travel with it');
  }
  return faults;
}

run('a refused development launch can never render as a blank screen', () => {
  const full = path.join(repoRoot, BOOT_GATE_FILE);
  assert(fs.existsSync(full), `${BOOT_GATE_FILE} is gone — this gate reads nothing`);
  const app = fs.readFileSync(full, 'utf8');
  // NON-VACUITY: the file must actually contain the gate this cell is about.
  assert(/prepareDevE2EAppLaunch/.test(app),
    'App.tsx no longer runs the development launch barrier — this cell is watching nothing');
  const faults = silentBlankScreenFaults(app);
  assert(faults.length === 0,
    `${BOOT_GATE_FILE}: ${faults.join('; ')}. Sam lost time to a blank screen twice `
    + 'in one day. A refusal says what refused and offers the way out.');
});

// ── A FLOW PROVES PRESENCE, NEVER LAYOUT ────────────────────────────────────
//
// `LAW-flows-photograph-what-they-touch`. TWO FOUNDING CASES IN ONE PASS, both
// shipped past a GREEN flow: the coach status screen's close control rendered ON
// the status bar over the battery icon, and its title rendered at front-page
// size, swamping the one card beneath it.
//
// **THAT IS NOT A GAP IN THE ASSERTIONS. It is the honest limit of the
// instrument:** `assertVisible` answers *is this in the tree*, and every layout
// defect is a question about WHERE, which no id can carry. So the answer is not
// a cleverer assertion — it is that **the screenshots are load-bearing**, and the
// only thing a script can enforce is that they EXIST to be looked at.
const GOLDEN_FLOW_DIR = '.maestro/golden';

/** Pure: golden flows that visit surfaces and photograph none of them. */
function flowsThatPhotographNothing(
  flows: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return flows
    // A flow that only asserts and never navigates has one surface; the law is
    // about flows that MOVE and leave no picture of where they went.
    .filter((flow) => /(^|\n)\s*-\s*(tapOn|launchApp|runFlow)\b/.test(flow.text))
    .filter((flow) => !/takeScreenshot/.test(flow.text))
    .map((flow) => flow.file);
}

/**
 * FLOWS THAT LEGITIMATELY TAKE NO PICTURE, each with its reason.
 *
 * A dated, named list rather than a loosened rule — the same ratchet every other
 * debt here carries. Nothing joins it without a sentence saying why a photograph
 * would be meaningless for that flow.
 */
const NO_SCREENSHOT_EXEMPT: readonly string[] = [];

run('a golden flow photographs the surfaces it reaches', () => {
  const dir = path.join(repoRoot, GOLDEN_FLOW_DIR);
  assert(fs.existsSync(dir), `${GOLDEN_FLOW_DIR} is gone — this gate reads nothing`);
  const flows = fs.readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => ({
      file: `${GOLDEN_FLOW_DIR}/${name}`,
      text: fs.readFileSync(path.join(dir, name), 'utf8'),
    }));
  assert(flows.length >= 5, `only ${flows.length} golden flows scanned — the walk is wrong`);
  const blind = flowsThatPhotographNothing(flows)
    .filter((file) => !NO_SCREENSHOT_EXEMPT.includes(file));
  assert(blind.length === 0,
    `golden flow(s) that navigate and photograph nothing: ${blind.join(', ')}. `
    + 'A flow proves PRESENCE; every layout defect is a question about WHERE, '
    + 'which no id can carry. Two real ones shipped past green flows on '
    + '2026-08-10 — a control over the battery icon and a title swamping the '
    + 'screen. The screenshots are the instrument; take one.');
});

// ── AN INSTRUMENT THAT HAS NOT RUN IS NOT COVERAGE ──────────────────────────
//
// `LAW-instrumentation-alive`, and this is the cell that finally lets the row
// leave UNENFORCED. Its founding case: **eight Maestro flows crashed on launch
// for 23 DAYS** and every source-reading cell in the chain stayed green through
// it, because there is nothing wrong with a flow that does not run.
//
// **NO SOURCE SCAN CAN CATCH THAT.** The only evidence a flow ran is a record
// that it ran — so the guard is a RECEIPT with a staleness ratchet. Seven days,
// because the founding case was 23: the alarm fires three times over before that
// number is reachable again.
//
// WHAT IT CANNOT DO, STATED NOT IMPLIED: it cannot prove the receipt is honest.
// A row edited without a run defeats it, exactly as a LOOP CHECK line can be
// typed without the thinking. **That is the same trust every process law here
// runs on**, and the alternative — enforcing nothing — is what left 23 days
// invisible.
const RUN_RECEIPT = 'docs/GOLDEN_FLOW_RUN_RECEIPT.md';
const RUN_STALE_DAYS = 7;

/** Pure: golden flows absent from the receipt, plus the newest date it records. */
function runReceiptFaults(
  receipt: string,
  flowFiles: readonly string[],
  todayISO: string,
): string[] {
  const faults: string[] = [];
  for (const flow of flowFiles) {
    if (!receipt.includes(`\`${flow}\``)) {
      faults.push(`${flow} is not in the run receipt`);
    }
  }
  const dates = Array.from(receipt.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g))
    .map((m) => m[1])
    .filter((d) => d <= todayISO)
    .sort();
  const newest = dates[dates.length - 1];
  if (!newest) {
    faults.push('the run receipt records no run date at all');
    return faults;
  }
  const ageDays = Math.floor(
    (Date.parse(`${todayISO}T00:00:00Z`) - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000);
  if (ageDays > RUN_STALE_DAYS) {
    faults.push(`the newest recorded run is ${ageDays} days old (${newest}); `
      + `the founding case was 23 days of a dead rig`);
  }
  return faults;
}

run('the golden flows have actually been run, and recently', () => {
  const full = path.join(repoRoot, RUN_RECEIPT);
  assert(fs.existsSync(full), `${RUN_RECEIPT} is gone — the only evidence a flow ran`);
  const receipt = fs.readFileSync(full, 'utf8');
  const flows = fs.readdirSync(path.join(repoRoot, GOLDEN_FLOW_DIR))
    .filter((name) => name.endsWith('.yaml'));
  assert(flows.length >= 5, `only ${flows.length} golden flows found — the walk is wrong`);
  // `todayISO` from the clock, which is the ONE thing this cell needs from the
  // outside; everything else is a pure function of two files.
  const todayISO = new Date().toISOString().slice(0, 10);
  const faults = runReceiptFaults(receipt, flows, todayISO);
  assert(faults.length === 0,
    `${RUN_RECEIPT}: ${faults.join('; ')}. A blocked instrument does not hide `
    + 'zero defects — it hides an unknown number, and nine were found in two '
    + 'days once the rig ran.');
});

// ── NEVER DISABLE A SET BECAUSE PART OF IT IS BLOCKED ───────────────────────
//
// `LAW-never-disable-a-set-for-part-of-it`. THE LAW STANDS; ITS INSTRUMENT
// MOVED, 2026-08-12 (SEAT_INBOX item 8).
//
// The cell that lived here read `ActiveModifiersSection` for `liveActionKinds`,
// `disabled={notYet}` and `note.actions.some(`. It held the right property while
// SEVEN of the eight modifier controls were inert: the dimming had to be
// resolved per ACTION, so freeing a strand lit it up and retired its own caption.
//
// All eight are live on My Status now, so that machinery is deleted, and a cell
// anchored on deleted strings is a cell measuring nothing — which is exactly the
// silent-green shape the anchoring law is about. It is not enough to say the
// mechanism went; the LAW needs an instrument that still bites.
//
// ITS REPLACEMENT IS `test:my-status-modifiers`, and it is a STRONGER claim than
// this one was. The old cell asked "is the dimming per-action?". The new one
// asks "does every action in the vocabulary reach a door?", reading the eight
// kinds from `ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS` — the type's own value — so
// a ninth kind arriving with nowhere to go reds on the day it arrives. The
// founding case (dimming `dismiss_note`, which worked, and captioning it "Change
// this on your program screen for now") is preserved verbatim in the registry
// row's receipt.

// ── A NAME THAT COVERS TWO THINGS IS MEASURED APART FIRST ───────────────────
//
// `LAW-one-name-two-meanings`. No script can look at a NAME and know it covers
// two things — so what IS checkable is that the class keeps being counted. Five
// sightings in one day is what made it a law; a sixth must not be absorbed
// silently.
//
// RAISED TO 7 (2026-08-10): sighting 7 is `useHomeScreen` meaning both "the day
// screen's state" and "the app's rebuild owner". It is the first sighting where
// the law was applied BEFORE the code moved rather than found afterwards, and
// the measurement paid — the two paths driving the rebuild notice turned out to
// drive the same four pieces of state.
const TWO_MEANING_SIGHTINGS = 7;

run('the two-meanings class keeps counting its sightings', () => {
  const registry = fs.readFileSync(
    path.join(repoRoot, 'src', 'rules', 'lawRegistry.ts'), 'utf8');
  const rowAt = registry.indexOf("id: 'LAW-one-name-two-meanings'");
  assert(rowAt > 0, 'the two-meanings row is gone from the registry');
  const row = registry.slice(rowAt, rowAt + 3000);
  const numbered = (row.match(/\(\d\)/g) ?? []).length;
  assert(numbered >= TWO_MEANING_SIGHTINGS,
    `the row enumerates ${numbered} sightings; it must not fall below `
    + `${TWO_MEANING_SIGHTINGS}. The count is a ratchet — a new instance is `
    + 'added, never absorbed, and the ones already found are what make it a class.');
});

// ── LAW-one-startup-command ────────────────────────────────────────────────
//
// Seat inbox 0d(ii), Sam 2026-08-12: the startup recipe — environment, Metro,
// which simulator, which app — *"is rediscovered every session"*, and the order
// ends **"Do not leave several startup scripts or temporary variants behind —
// one."**
//
// A second startup script does not announce itself. It arrives as
// `qa-start-2.sh` or `run-dev-tmp.sh` in a hurry, both work for a week, and then
// they drift and the recipe is a question again. That is what this counts.
//
// SCOPE IS SCRIPT FILES, not npm scripts. `start`, `web` and
// `dev:coach-semantic-active` are one-line Expo passthroughs that have always
// existed and are not recipes; scoping the law to them would red on day one and
// be turned off by the end of the week.

const THE_STARTUP_SCRIPT = 'scripts/qa-start.sh';
const THE_STARTUP_COMMAND = 'lfa:dev';

/** Strips `#` and `//` line comments — prose naming a command is not a use. */
function withoutLineComments(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/(^|\s)(#|\/\/).*$/, '$1'))
    .join('\n');
}

/** Pure: committed scripts that start the dev server and are not THE one. */
function rivalStartupScripts(
  scripts: readonly { readonly file: string; readonly text: string }[],
): string[] {
  return scripts
    .filter((script) => script.file !== THE_STARTUP_SCRIPT)
    .filter((script) => /\bexpo start\b/.test(withoutLineComments(script.text)))
    .map((script) => script.file);
}

// ── LAW-definition-of-done ─────────────────────────────────────────────────
//
// `CLAUDE.md` gained a "WHAT COUNTS AS FINISHED" section on 2026-08-12 (0d(i)).
// The judgment half of that law — is the athlete-visible proof real — is what
// `lfa-verifier` and the completion gate carry. **The half a script can hold is
// that the section is THERE and that the commands it hands a new session are
// REAL**, because a command table is the part of a doc that rots first: a
// renamed npm script leaves the instruction looking authoritative and wrong.

const DONE_SECTION = '## WHAT COUNTS AS FINISHED';
const THE_THREE_WORDS: readonly string[] = ['WORKING', 'BUILT', 'WRITTEN'];

/**
 * Pure: commands a document names that do not exist.
 *
 * PLACEHOLDERS ARE NOT COMMANDS. The table deliberately writes
 * `npm run test:<name>` for "whichever suite this is", and a checker that reads
 * an angle bracket as a script name would red on correct prose — the fastest
 * way to get a cell deleted.
 */
function commandsNamedThatDoNotExist(
  markdown: string,
  npmScripts: readonly string[],
  fileExists: (relativePath: string) => boolean,
): string[] {
  const missing: string[] = [];
  // `<>` is INSIDE the character class deliberately: stopping the match at the
  // angle bracket turns `npm run test:<name>` into the script name `test:`,
  // which no package.json has — the placeholder must be matched to be skipped.
  for (const match of markdown.matchAll(/npm run ([A-Za-z0-9:._<>-]+)/g)) {
    const name = match[1];
    if (name.includes('<')) continue;
    if (!npmScripts.includes(name)) missing.push(`npm run ${name}`);
  }
  for (const match of markdown.matchAll(/\bscripts\/[A-Za-z0-9/_.-]+\.sh\b/g)) {
    if (!fileExists(match[0])) missing.push(match[0]);
  }
  return [...new Set(missing)];
}

run('there is exactly ONE startup script, and lfa:dev invokes it', () => {
  const scripts = filesUnder(path.join(repoRoot, 'scripts'), ['.sh', '.js', '.ts'])
    .map((file) => ({
      file: path.relative(repoRoot, file),
      text: fs.readFileSync(file, 'utf8'),
    }));
  assert(scripts.length > 10, `the scan found only ${scripts.length} scripts — it is reading the wrong tree`);
  assert(fs.existsSync(path.join(repoRoot, THE_STARTUP_SCRIPT)),
    `${THE_STARTUP_SCRIPT} is gone — the one command has nothing behind it`);

  const rivals = rivalStartupScripts(scripts);
  assert(rivals.length === 0,
    `a second startup script exists: ${rivals.join(', ')}. There is one recipe `
    + `(${THE_STARTUP_SCRIPT}); add a flag to it rather than a file beside it.`);

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const command: unknown = pkg.scripts?.[THE_STARTUP_COMMAND];
  assert(typeof command === 'string' && command.includes(THE_STARTUP_SCRIPT),
    `npm run ${THE_STARTUP_COMMAND} must invoke ${THE_STARTUP_SCRIPT}; it is ${String(command)}`);
});

run('CLAUDE.md says what counts as finished, and every command it names is real', () => {
  const claudeMd = fs.readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
  assert(claudeMd.includes(DONE_SECTION),
    `CLAUDE.md has lost "${DONE_SECTION}" — "finished" goes back to being decided fresh every session`);

  const sectionAt = claudeMd.indexOf(DONE_SECTION);
  const section = claudeMd.slice(sectionAt, claudeMd.indexOf('\n## ', sectionAt + 1));
  for (const word of THE_THREE_WORDS) {
    assert(section.includes(`**${word}**`),
      `the section no longer offers ${word} — the three words are the whole vocabulary`);
  }
  assert(/Banned:.*\bdone\b/i.test(section),
    'the banned-words line is gone, so "done" is legal again');

  // 0e(ii), Sam 2026-08-12. BOTH halves or neither: "auto memory is useful"
  // without the ban is how a ruling ends up in a machine-local, model-authored,
  // silently-truncated file instead of the registry — the trap he named.
  //
  // AND THE FIRST VERSION OF THIS ASSERTION DID NOT KILL ITS MUTANT. It matched
  // `/AUTO MEMORY/i`, so replacing the whole law with "Auto memory is handy."
  // left it green — a cell watching a HEADING rather than the rule under it.
  // It now reads the ban and its destination, which is the half that bites.
  // READ THE PARAGRAPH, NOT THE SECTION, and that is the second correction this
  // cell needed. Asserting `lawRegistry.ts` anywhere in the section could never
  // fail: the source-of-truth line four paragraphs up names the same file, so
  // deleting the destination from the memory rule left the cell green.
  const memoryRule = section.split(/\n\s*\n/).find((para) => /AUTO MEMORY/i.test(para)) ?? '';
  assert(memoryRule.length > 0, 'the auto-memory boundary is gone from the section entirely');
  // `\s+` between the words, not a space: this file hard-wraps at 80 columns and
  // the ban lands as "product\nlaw". The first version demanded a literal space
  // and reddened on the very paragraph it was written to protect.
  assert(/NEVER:?\s*\*{0,2}\s*product\s+law/i.test(memoryRule),
    'the "never product law" ban is gone from the auto-memory boundary — that '
    + 'ban IS the law; the permission half is just its context');
  assert(memoryRule.includes('lawRegistry.ts'),
    'the auto-memory boundary no longer names the registry as the place product '
    + 'law actually lives, so it bans a habit without offering the alternative');

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const missing = commandsNamedThatDoNotExist(
    claudeMd,
    Object.keys(pkg.scripts ?? {}),
    (relative) => fs.existsSync(path.join(repoRoot, relative)),
  );
  assert(missing.length === 0,
    `CLAUDE.md hands a new session commands that do not exist: ${missing.join(', ')}. `
    + 'A stale instruction reads exactly as authoritative as a true one.');
});

// ── LAW-canonical-athlete-flows ────────────────────────────────────────────
//
// Seat item 0e(i), Sam 2026-08-12: *"You do not need a brand-new temporary
// Maestro flow for every bug. Keep a handful of canonical athlete flows."*
//
// The census that built this list found the folder was NOT that: it held a
// permanent flow for moving a GAME and none for moving a SESSION, a deletion
// flow that stopped at one scope, and a readiness flow that opened both doors
// and pressed Cancel. The five below are the set; a new bug earns an ASSERTION
// INSIDE one of them, not a sixth file.
//
// THE FIFTH HAS NO FILE AND THAT IS NOT AN OMISSION. "Preview and approve a
// repaired week" has no door to tap: `SUPPORTED_ATHLETE_ACTIONS.md` 5.4 carries
// it as **DECIDED 2026-07-22, NOT BUILT**, and `PlanChangeSheet` applies a
// change and shows a result rather than proposing one. A flow written against
// it would be a fixture for a screen that does not exist. It is carried here as
// a NAMED gap so the set stays five and the missing one keeps saying so.

const CANONICAL_ATHLETE_FLOWS: readonly {
  readonly action: string;
  readonly file: string | null;
}[] = [
  { action: 'move a session', file: '.maestro/golden/session-move.yaml' },
  { action: 'delete a session', file: '.maestro/golden/lower-body-deletion.yaml' },
  { action: 'preview and approve a repaired week', file: null },
  { action: 'relaunch and prove persistence', file: '.maestro/golden/reload-standard-week.yaml' },
  {
    action: 'clear or reverse an adjustment',
    file: '.maestro/golden/readiness-adjust-and-clear.yaml',
  },
];

/** Pure: canonical actions whose named flow is not on disk. */
function canonicalFlowsMissing(
  entries: readonly { readonly action: string; readonly file: string | null }[],
  exists: (relativePath: string) => boolean,
): string[] {
  return entries
    .filter((entry) => entry.file !== null && !exists(entry.file))
    .map((entry) => `${entry.action} (${entry.file})`);
}

run('the five canonical athlete flows are all still on disk', () => {
  const missing = canonicalFlowsMissing(
    CANONICAL_ATHLETE_FLOWS,
    (relative) => fs.existsSync(path.join(repoRoot, relative)),
  );
  assert(missing.length === 0,
    `canonical athlete flow(s) gone: ${missing.join(', ')}. A bug earns an `
    + 'assertion inside one of these, never a sixth throwaway file — and none of '
    + 'them may be deleted without saying where its coverage went.');

  // THE RATCHET, and it points the other way from the usual one: the gap list
  // may only SHRINK. When 5.4 is built, its flow joins and this cell says so.
  const gaps = CANONICAL_ATHLETE_FLOWS.filter((entry) => entry.file === null);
  assert(gaps.length <= 1,
    `${gaps.length} canonical actions have no flow. One is carried by ruling `
    + '(SUPPORTED_ATHLETE_ACTIONS 5.4, DECIDED NOT BUILT); a second would mean '
    + 'the set is drifting back into "a flow per bug".');
  console.log(`      (${CANONICAL_ATHLETE_FLOWS.length} canonical actions; ${gaps.length} with no door to tap yet)`);
});

// ── LAW-stress-vocabulary-is-one-word ──────────────────────────────────────
//
// FOUNDING CASE, 2026-08-12, found while building the moderate-day advisory:
// `section18OfferPlacement.ts:508` wrote `stressLevel: 'moderate'` — a fourth
// word — for as long as the file existed. The union is `high | medium | low`
// and the §18 ledger counts a moderate day by `=== 'medium'`, so every offer
// that placer marked as the easier option was invisible to the count.
//
// **THE COMPILER COULD NOT HAVE CAUGHT IT AND NEVER WILL:** the array carrying
// it is cast `as never` two lines below. That is why this is a SOURCE SCAN and
// not a type. A cast is a promise the type system stops checking, so the check
// has to live where the cast cannot reach.

const STRESS_LEVEL_WORDS = ['high', 'medium', 'low'] as const;

/** Pure: `stressLevel:` writes whose string literal is not in the union. */
function stressLevelsOutsideTheUnion(
  sources: readonly { readonly file: string; readonly text: string }[],
): string[] {
  const faults: string[] = [];
  for (const source of sources) {
    // READ THE WHOLE ASSIGNMENT, NOT THE FIRST TOKEN AFTER THE COLON. The first
    // version of this scan matched `stressLevel:\s*'word'` and was BLIND TO ITS
    // OWN FOUNDING CASE, which is a ternary:
    //   `stressLevel: wantsHard ? 'high' : 'moderate',`
    // It passed the mutation that put the bad word back — a cell that cannot
    // catch the defect it was written for.
    for (const line of withoutLineComments(source.text).split('\n')) {
      const at = line.indexOf('stressLevel:');
      if (at < 0) continue;
      // COMPARISON OPERANDS ARE NOT WRITES, and the widened scan's first run
      // proved it: `stressLevel: args.stress === 'hard' ? 'high' : 'medium'`
      // writes two legal words and was flagged for the word it TESTS.
      const assignment = line.slice(at + 'stressLevel:'.length)
        .replace(/[=!]==?\s*'[a-z_]+'/g, '');
      for (const literal of assignment.matchAll(/'([a-z_]+)'/g)) {
        if (!(STRESS_LEVEL_WORDS as readonly string[]).includes(literal[1])) {
          faults.push(`${source.file}: '${literal[1]}'`);
        }
      }
    }
  }
  return faults;
}

run('no producer writes a stress level outside high/medium/low', () => {
  const files = filesUnder(path.join(repoRoot, 'src'), ['.ts', '.tsx'])
    .filter((file) => !file.includes('__tests__'));
  assert(files.length > 100, `the scan found only ${files.length} files — it is reading the wrong tree`);
  const faults = stressLevelsOutsideTheUnion(files.map((file) => ({
    file: path.relative(repoRoot, file),
    text: fs.readFileSync(file, 'utf8'),
  })));
  assert(faults.length === 0,
    `stress level(s) outside the union: ${faults.join(', ')}. The ledger counts a `
    + 'moderate day by `=== \'medium\'`; a fourth word is invisible to it, and a '
    + 'cast will hide the mistake from the compiler.');
});

run('the checkers red on fabricated violations (liveness)', () => {
  // ── the stress vocabulary, probed BOTH directions ──
  assert(stressLevelsOutsideTheUnion([{ file: 'a.ts', text: "stressLevel: 'moderate'," }]).length === 1,
    'the founding case itself passed the scan');
  assert(stressLevelsOutsideTheUnion([{ file: 'a.ts', text: "stressLevel: 'medium'," }]).length === 0,
    'a legal word was flagged');
  assert(stressLevelsOutsideTheUnion([{ file: 'a.ts', text: '// stressLevel: \'moderate\' once' }]).length === 0,
    'a COMMENT naming the old value was read as a write');
  assert(stressLevelsOutsideTheUnion([{ file: 'a.ts', text: 'stressLevel: computedStress,' }]).length === 0,
    'a computed stress level was flagged — the scan only judges literals');
  // THE FOUNDING CASE'S REAL SHAPE — a ternary. The first scan missed exactly
  // this and passed its own mutation.
  assert(stressLevelsOutsideTheUnion(
    [{ file: 'a.ts', text: "stressLevel: wantsHard ? 'high' : 'moderate'," }]).length === 1,
    'the ternary form of the founding case escaped the scan');
  assert(stressLevelsOutsideTheUnion(
    [{ file: 'a.ts', text: "stressLevel: wantsHard ? 'high' : 'medium'," }]).length === 0,
    'a legal ternary was flagged');
  // THE FIRST WIDENED RUN'S FALSE POSITIVE, PINNED: the word being TESTED is not
  // the word being written.
  assert(stressLevelsOutsideTheUnion(
    [{ file: 'a.ts', text: "stressLevel: args.stress === 'hard' ? 'high' : 'medium'," }]).length === 0,
    'a comparison operand was read as a written value');
  assert(stressLevelsOutsideTheUnion(
    [{ file: 'a.ts', text: "stressLevel: args.stress === 'hard' ? 'high' : 'moderate'," }]).length === 1,
    'a bad word alongside a comparison escaped the scan');

  // ── the canonical five, probed BOTH directions ──
  assert(canonicalFlowsMissing(
    [{ action: 'move', file: '.maestro/golden/gone.yaml' }], () => false).length === 1,
    'a canonical flow that is not on disk passed');
  assert(canonicalFlowsMissing(
    [{ action: 'move', file: '.maestro/golden/here.yaml' }], () => true).length === 0,
    'a canonical flow that exists was reported missing');
  assert(canonicalFlowsMissing(
    [{ action: 'preview a repaired week', file: null }], () => false).length === 0,
    'the DECLARED gap was counted as a missing file — it has no door to tap yet');

  // ── the one startup script, probed BOTH directions ──
  assert(rivalStartupScripts([{ file: 'scripts/qa-start-2.sh', text: 'npx expo start --port 8082' }]).length === 1,
    'a second startup script passed — that is the whole law');
  assert(rivalStartupScripts([{ file: THE_STARTUP_SCRIPT, text: 'npx expo start' }]).length === 0,
    'THE startup script was flagged as its own rival');
  assert(rivalStartupScripts([{ file: 'scripts/other.sh', text: '# never run expo start by hand' }]).length === 0,
    'a COMMENT naming the command was read as a use of it');
  assert(rivalStartupScripts([{ file: 'scripts/other.sh', text: 'echo hello' }]).length === 0,
    'an ordinary script was read as a startup recipe');

  // ── the commands CLAUDE.md names, probed BOTH directions ──
  assert(commandsNamedThatDoNotExist('run `npm run gone:away`', ['lfa:dev'], () => true).length === 1,
    'a command that does not exist passed — a stale instruction is the rot this catches');
  assert(commandsNamedThatDoNotExist('run `npm run lfa:dev`', ['lfa:dev'], () => true).length === 0,
    'a real command was reported missing');
  assert(commandsNamedThatDoNotExist('run `npm run test:<name>`', [], () => true).length === 0,
    'a PLACEHOLDER was read as a script name — the table writes one deliberately');
  assert(commandsNamedThatDoNotExist('see `scripts/gone.sh`', [], () => false).length === 1,
    'a named script file that does not exist passed');
  assert(commandsNamedThatDoNotExist('see `scripts/sweep.sh`', [], () => true).length === 0,
    'an existing script file was reported missing');

  // ── the order-hiding heading, probed BOTH directions ──
  // THE FOUNDING CASE, REBUILT: the exact shape this terminal wrote on
  // 2026-08-12 when it repaired the inbox by hand.
  // A DISTINCTIVE MARKER, because the first draft of this cell searched for a
  // phrase its own fixture did not contain: the "is it hidden?" assertion
  // passed by matching NOTHING, and only the "is it visible again?" assertion
  // noticed. A vacuous probe in a liveness cell is the disease the liveness
  // cell exists to catch.
  const MARKER = 'ORDER-BELOW-THE-HEADING';
  const hidden = [
    '## Unprocessed (newest first)', '',
    '1. a visible order', '',
    '## THE MERGE\'S LEFTOVERS', '',
    `2. ${MARKER}`, '',
    '## SAFE FOR A PARALLEL AGENT',
  ].join('\n');
  assert(headingsHidingOrders(hidden).length === 1,
    'the founding case — an order re-homed under its own `## ` heading — passed');
  // And the hook's real scan confirms WHY it matters: order 2 is unreachable.
  assert(hookVisibleOrderLines(hidden).some((l) => /a visible order/.test(l)),
    'the visibility model cannot even see the order ABOVE the heading — it is broken');
  assert(!hookVisibleOrderLines(hidden).some((l) => l.includes(MARKER)),
    'the visibility model disagrees with the hook it is modelling');
  // The corrected shape, which is what the seat actually wrote.
  const fixed = hidden.replace("## THE MERGE'S LEFTOVERS", "### THE MERGE'S LEFTOVERS");
  assert(headingsHidingOrders(fixed).length === 0,
    'a correctly `###`-nested sub-heading was flagged');
  assert(hookVisibleOrderLines(fixed).some((l) => l.includes(MARKER)),
    'the `###` fix does not actually make the order reachable — the fix is wrong');
  // A missing region is a READ FAILURE, never a silent pass.
  assert(headingsHidingOrders('# SEAT INBOX\n\nnothing here').length === 1,
    'a file with no unprocessed region passed as clean');

  // ── the whole-set disable: PROBED IN ITS NEW HOME ──
  // `wholeSetDisableFaults` went with its cell on 2026-08-12 (see the section
  // above). `LAW-never-disable-a-set-for-part-of-it` is now held by
  // `test:my-status-modifiers`, whose own liveness probe feeds
  // `coachNoteActionRoute` a kind with no door and requires it to answer null.
  // The probe lives beside the checker it probes; a liveness assertion left
  // behind here would be testing a function this file no longer has.

  // ── the run receipt, probed BOTH directions ──
  const OK_RECEIPT = '| `a.yaml` | 2026-08-10 | PASS |';
  assert(runReceiptFaults(OK_RECEIPT, ['a.yaml'], '2026-08-11').length === 0,
    'a receipt naming the flow with a fresh date was flagged');
  assert(runReceiptFaults(OK_RECEIPT, ['a.yaml', 'b.yaml'], '2026-08-11')
    .some((f) => /b\.yaml is not in the run receipt/.test(f)),
    'a flow missing from the receipt passed — a new flow could ship unrun');
  assert(runReceiptFaults(OK_RECEIPT, ['a.yaml'], '2026-09-02')
    .some((f) => /23 days old/.test(f)),
    'a 23-day-old receipt passed — that is the founding case exactly');
  assert(runReceiptFaults('no dates here', ['a.yaml'], '2026-08-11')
    .some((f) => /no run date at all/.test(f)),
    'a receipt with no date at all passed');

  // ── the photograph rule, probed BOTH directions ──
  assert(flowsThatPhotographNothing([
    { file: 'a.yaml', text: '- tapOn:\n    id: "x"\n- assertVisible:\n    id: "y"\n' },
  ]).length === 1, 'a flow that navigates and photographs nothing passed');
  assert(flowsThatPhotographNothing([
    { file: 'a.yaml', text: '- tapOn:\n    id: "x"\n- takeScreenshot: shot\n' },
  ]).length === 0, 'a flow that does photograph was flagged');
  assert(flowsThatPhotographNothing([
    { file: 'a.yaml', text: '- assertVisible:\n    id: "y"\n' },
  ]).length === 0, 'a flow that never moves was required to photograph');

  // ── the blank-screen ban, probed BOTH directions ──
  const GOOD_BOOT = 'prepareDevE2EAppLaunch().then(({ ready, reason }) => {})\n'
    + 'dev-launch-refused dev-launch-refused-reason dev-launch-refused-clear';
  assert(silentBlankScreenFaults(GOOD_BOOT).length === 0,
    'a boot gate that names its refusal, its reason and its way out was flagged');
  assert(silentBlankScreenFaults('prepareDevE2EAppLaunch().then((ready) => {})')
    .some((f) => /bare boolean/.test(f)),
    'the exact pre-fix shape — a bare boolean whose reason cannot travel — passed');
  assert(silentBlankScreenFaults('dev-launch-refused dev-launch-refused-clear')
    .some((f) => /show WHY/.test(f)),
    'a refusal with no reason passed — that is the blank screen with a border');
  assert(silentBlankScreenFaults('dev-launch-refused dev-launch-refused-reason')
    .some((f) => /way out/.test(f)),
    'a refusal with no escape passed — honest and still a dead end');

  // ── the removal ledger, probed BOTH directions ──
  const LEDGER_HEAD = '## THE REMOVAL LEDGER\n\n| # | Removed | Where it is | Where it goes |\n'
    + '| --- | --- | --- | --- |\n';
  assert(removalsWithNoDestination(`${LEDGER_HEAD}| 3 | the strip | here | the week view |\n`).length === 0,
    'a removal naming its destination was flagged');
  assert(removalsWithNoDestination(`${LEDGER_HEAD}| 3 | the strip | here |  |\n`).length === 1,
    'a removal with an EMPTY destination passed — that is the whole law');
  assert(removalsWithNoDestination(`${LEDGER_HEAD}| 3 | the strip | here | TBD |\n`).length === 1,
    'a removal whose destination is "TBD" passed — a placeholder is not a home');
  assert(removalsWithNoDestination('# no ledger here').length === 1,
    'a document with no removal ledger at all was read as having no orphans');

  // ── the crash ban, probed BOTH directions ──
  assert(nativeSourcesThatCanCrash([{ file: 'a.swift', text: 'fatalError("x")' }]).length === 1,
    'a live fatalError passed — the founding case exactly');
  assert(nativeSourcesThatCanCrash([{ file: 'a.swift', text: 'precondition(x > 0)' }]).length === 1,
    'a precondition passed — it kills the process the same way');
  assert(nativeSourcesThatCanCrash([{ file: 'a.swift', text: '// held TEN fatalError(s)' }]).length === 0,
    'a COMMENT naming the banned call was read as the call — a comment is not code');
  assert(nativeSourcesThatCanCrash([{ file: 'a.swift', text: 'refuse("code", "detail")' }]).length === 0,
    'a refusal was flagged as a crash');

  // ── the hot-file budget, probed BOTH directions ──
  assert(hotFilesOverBudget([{ file: 'docs/NOW.md', bytes: 60_000, maxBytes: 24_576 }]).length === 1,
    'a file well over its budget passed — the 53KB founding case exactly');
  assert(hotFilesOverBudget([{ file: 'docs/NOW.md', bytes: 4_000, maxBytes: 24_576 }]).length === 0,
    'a file inside its budget was flagged');
  assert(hotFilesOverBudget([{ file: 'docs/NOW.md', bytes: 24_576, maxBytes: 24_576 }]).length === 0,
    'a file exactly AT its budget was flagged — the boundary is inclusive');

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
    'a thing only Sam has was flagged as a routing ask');
  assert(declaredSeedWorldCount("DEV_E2E_SEED_IDS = [\n 'a',\n 'b',\n] as const") === 2,
    'the world counter cannot read the list it ratchets');
  assert(declaredSeedWorldCount('nothing here') === 0,
    'the world counter invented worlds from a source with none');

  assert(seedChannelFaults('let seedIdKey = "e2eSeedId"\nlet seedIdPattern = "^a$"\nrefuse("seed-id-malformed", "x")\n        return').length === 0,
    'a well-formed seed channel was flagged');
  assert(seedChannelFaults('let launchArgumentKey = "e2eMetroUrl"').length > 0,
    'a source with no seed channel at all passed');
  // THE FIRST-VERSION FALSE POSITIVE, PINNED: the two keys declared next to
  // each other is the CORRECT shape, not smuggling.
  assert(seedChannelFaults(
    'let launchArgumentKey = "e2eMetroUrl"\nlet seedIdKey = "e2eSeedId"\n'
    + 'let seedIdPattern = "^a$"\nrefuse("seed-id-malformed", "x")\n        return\nvalidatedSeedId = rawSeedId')
    .length === 0,
    'two keys declared next to each other were read as one smuggling the other');
  assert(seedChannelFaults(
    'let seedIdKey = "e2eSeedId"\nlet seedIdPattern = "^a$"\nrefuse("seed-id-malformed", "x")\n        return\n'
    + 'validatedSeedId = metroUrl.queryItem')
    .some((f) => /other than its own key/.test(f)),
    'a seed read out of the metro url passed — that is the smuggling this forbids');
  assert(seedChannelFaults('let seedIdKey = "e2eSeedId"\nlet seedIdPattern = "^a$"')
    .some((f) => /fail closed/.test(f)),
    'a seed channel that does not fail closed passed');
  // THE NEW FAILURE MODE THE RE-AIM CREATED, PROBED. Turning a crash into a
  // refusal introduces a way to refuse and then CARRY ON — which would seed
  // nothing, quietly, and is precisely what the crash was standing in for.
  assert(seedChannelFaults(
    'let seedIdKey = "e2eSeedId"\nlet seedIdPattern = "^a$"\n'
    + 'refuse("seed-id-malformed", "x")\nvalidatedSeedId = rawSeedId')
    .some((f) => /fail closed/.test(f)),
    'a seed channel that refuses and then keeps going passed — a refusal without '
    + 'a stop degrades into "no seed", the exact defect the crash prevented');

  assert(handAuthoredSeedWorlds(
    [{ file: '/x/s.ts', text: 'const seed = {\n  workouts: [\n    {}\n  ],\n};' }]).length === 1,
    'a hand-authored world literal passed');
  assert(handAuthoredSeedWorlds(
    [{ file: '/x/s.ts', text: 'return generateProgramLocally(profile, {});' }]).length === 0,
    'a generated world was flagged as hand-authored');
  assert(handAuthoredSeedWorlds(
    [{ file: '/x/s.ts', text: '// workouts: [ ] in a comment\nconst x = 1;' }]).length === 0,
    'a COMMENT describing the forbidden shape was read as the shape itself');

  assert(samItemsAskingForPermission(
    '## WHAT IS BLOCKED ON SAM\n\n1. **Permission to commit his exports.**\n').length === 1,
    'a re-ask for a granted permission passed — the courier toll in a new coat');
  assert(samItemsAskingForPermission(
    '## WHAT IS BLOCKED ON SAM\n\n1. **Local-only or sign-in? His call.**\n').length === 0,
    'a genuine DECISION was flagged as a permission re-ask');

  // THE FIRST-RUN FALSE POSITIVE, PINNED: a sentence DENYING the ask.
  assert(samItemsAskingHimToRelay(
    '## WHAT IS BLOCKED ON SAM\n\n1. **His Apple ID.** This is not a report to relay.\n').length === 0,
    'a sentence denying the ask was read as making it — mention is not use');

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
