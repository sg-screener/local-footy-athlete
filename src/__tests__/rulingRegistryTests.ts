/**
 * THE ASK GATE THAT RUNS THE SEARCH ITSELF — SEAT_INBOX item 32.
 *
 * **SAM, 2026-08-13, choosing between the two gates that got built:** *"if you
 * built a gate that runs the search itself, keep that one over the state-your-grep
 * version."*
 *
 * **THE REGISTRY IS `docs/RULINGS_REGISTRY.md` AND THERE IS ONLY ONE.** This
 * seat briefly built a second one in TypeScript, 14 rows, while the terminal was
 * committing the real one — **and a second list of rulings is the exact defect
 * item 32 exists to end.** The duplicate is deleted; this suite reads the ONE
 * file. **CHECK THE ROW COUNT BEFORE ADDING OR TRIMMING** — Sam had to say so,
 * because the duplicate was built without looking.
 *
 * ## WHY THIS GATE AND NOT THE DECLARATION
 *
 * `scripts/seat-inbox-hook.sh` requires a `REGISTRY-GREP:` line on an AWAITING
 * SAM entry, and its own comment states the limit honestly: *"It cannot verify
 * the grep was honest. It CAN make 'I never checked' a thing you have to lie
 * about."* **A gate satisfied by typing a line is satisfied by typing a false
 * line, and it would have passed all three of the re-asks that caused this
 * item.**
 *
 * So this suite does not ask whether an agent SAYS it grepped. **It greps.** It
 * reads every question pointed at Sam, searches the registry itself, and reds
 * when a question hits a ruling whose `R-nnn` it does not cite. The declaration
 * hook is left alone and unduplicated — it catches "I never checked"; this
 * catches "I checked and was wrong", which is what actually happened.
 *
 * ## THE MATCHER IS THE WHOLE SUITE, SO IT IS PINNED IN BOTH DIRECTIONS
 *
 * A matcher that hits nothing passes every re-ask; a matcher that hits
 * everything refuses every question. **[3c] pins both ends against the real
 * case**: the two questions Sam was actually handed must be caught, and an
 * unrelated question must not be.
 *
 * Run: npm run test:ruling-registry
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
let failed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}
function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY = path.join(ROOT, 'docs', 'RULINGS_REGISTRY.md');
const INBOX = path.join(ROOT, 'docs', 'SEAT_INBOX.md');

console.log('\n-- The ask gate: it runs the grep itself (SEAT_INBOX item 32) --');

interface Row { id: string; text: string; status: string }

function rows(): Row[] {
  const src = fs.readFileSync(REGISTRY, 'utf8');
  const out: Row[] = [];
  // A row opens with `**R-nnn**` and runs to the next row or heading.
  const lines = src.split('\n');
  let current: { id: string; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const body = current.body.join(' ');
    // **DO NOT ENUMERATE THE STATUS VOCABULARY — READ THE ROW'S SHAPE.**
    // The header says "two states only" (BUILT / UNENFORCED). The rows use at
    // least five: R-008 is `PARKED BY SAM`, R-014 is `UNRULED`, R-030 is
    // `BINDING`. **Every one of those is RIGHT** — "he parked it", "he has
    // never ruled it" and "this binds every reply" are real states the two
    // cannot express — and the list is still growing as the terminal writes.
    // **A gate that enumerates them reds once per new word its author invents**,
    // which is a gate fighting its own registry. So this reads the FORMAT the
    // rows actually share: `R-nnn · ruling · meaning · `STATUS``, status last
    // and in backticks. That catches a row with no status at all, which is the
    // only thing worth catching, and never argues about vocabulary.
    const tail = body.split('·').pop() ?? '';
    const status = (/`([^`]+)`/.exec(tail)?.[1] ?? '').trim();
    out.push({ id: current.id, text: body, status });
    current = null;
  };
  for (const line of lines) {
    const head = /^\*\*(R-\d+)\*\*/.exec(line);
    if (head) { flush(); current = { id: head[1], body: [line] }; continue; }
    if (/^#{1,3} /.test(line)) { flush(); continue; }
    if (current) current.body.push(line);
  }
  flush();
  return out;
}

const REGISTRY_ROWS = rows();

// ── THE MATCHER ────────────────────────────────────────────────────────────
/**
 * Distinctive multi-word phrases from a row. Two consecutive non-stopword
 * words is the unit: single words ("game", "training") fire on everything, and
 * whole sentences never fire at all.
 */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'that', 'this',
  'for', 'on', 'at', 'as', 'be', 'are', 'was', 'not', 'no', 'do', 'does', 'if',
  'they', 'their', 'them', 'you', 'your', 'he', 'his', 'i', 'we', 'so', 'but',
  'with', 'from', 'by', 'has', 'have', 'had', 'can', 'will', 'just', 'only',
  'more', 'than', 'when', 'what', 'which', 'who', 'how', 'any', 'all', 'one',
  'its', 'there', 'here', 'now', 'then', 'been', 'were', 'up', 'out', 'about',
]);

function phrases(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/`[^`]*`/g, ' ')          // code spans are enforcement sites, not ruling words
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < words.length - 1; i += 1) {
    if (STOP.has(words[i]) || STOP.has(words[i + 1])) continue;
    if (words[i].length < 3 || words[i + 1].length < 3) continue;
    out.add(`${words[i]} ${words[i + 1]}`);
  }
  return [...out];
}

/**
 * Only the RULING half of a row feeds the matcher — the verbatim quote and the
 * plain-English meaning beside it — never its receipt prose. A row's receipt
 * names commits, files and the story of the re-ask, and matching on that makes
 * every question about any file collide with every ruling ever recorded.
 */
function rulingHalf(row: Row): string {
  const cut = row.text.search(/`?(BUILT|UNENFORCED)/);
  return cut > 0 ? row.text.slice(0, cut) : row.text;
}

const ROW_PHRASES = new Map(REGISTRY_ROWS.map((r) => [r.id, phrases(rulingHalf(r))]));

/**
 * HOW MANY ROWS EACH PHRASE APPEARS IN — the whole precision of this matcher.
 *
 * **A FLAT "TWO PHRASES" THRESHOLD FAILED THE FOUNDING CASE, MEASURED.** The
 * two-games re-ask shares exactly ONE phrase with R-001 ("second game"), so a
 * count-only rule dropped it — the gate would have been green on the very
 * question that caused this item. **Rarity is what carries the signal:**
 * "team training" is the vocabulary of the whole app and appears in many rows;
 * "second game" appears in one, and a question containing it is about that row.
 */
const PHRASE_ROWS = new Map<string, number>();
for (const list of ROW_PHRASES.values()) {
  for (const p of new Set(list)) PHRASE_ROWS.set(p, (PHRASE_ROWS.get(p) ?? 0) + 1);
}

/**
 * PHRASES THAT ARE UNIQUE BY ACCIDENT AND CARRY NO SIGNAL.
 *
 * **UNIQUENESS WAS DOING TWO JOBS AND ONLY DESERVED ONE.** The matcher asks
 * "does this question contain a phrase that belongs to exactly one row" — a good
 * question, because *"second game"* or *"floor number"* really do name their
 * ruling. **But a phrase can be unique to one row for a reason that has nothing
 * to do with subject**, and R-075 is the case that proved it: it quotes Sam
 * REJECTING an answer — *"your Saturday Rest Day is the wrong case"* — which
 * made `rest day` unique to it. From that moment *"what colour should the rest
 * day icon be on the profile screen"* matched R-075, and [3c]'s
 * fire-on-everything guard reddened. **The words came from the answer he threw
 * out, not from what the ruling is about.**
 *
 * These are the app's day-type nouns. They appear in ordinary questions about
 * UI, copy and layout that no ruling here governs. **A ruling that is genuinely
 * about one of them will still be matched by its own distinctive phrasing** —
 * R-020's *"clear team training and games while away"* is not on this list and
 * neither is R-006's *"full rest days"*.
 *
 * ⚠ ADD TO THIS LIST ONLY WITH A MEASURED FALSE POSITIVE, never pre-emptively:
 * every entry is a phrase the gate can no longer catch a re-ask with, so the
 * list is a cost, not a tidy-up.
 */
const GENERIC_PHRASES = new Set<string>([
  'rest day',
  'training day',
  'game day',
  'team training',
]);

export function rulingsMatching(questionText: string): Row[] {
  const hay = ` ${questionText.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  return REGISTRY_ROWS.filter((row) => {
    const hits = (ROW_PHRASES.get(row.id) ?? []).filter((p) => hay.includes(` ${p} `));
    // **A PHRASE UNIQUE TO ONE ROW, OR NOTHING. THE `hits.length >= 2` FALLBACK
    // IS REMOVED — IT FIRED ON A LEGITIMATE QUESTION AND THAT IS THE WORSE
    // FAILURE.** On 2026-08-13 the terminal wrote a well-formed AWAITING SAM
    // entry — its own REGISTRY-GREP line named five rows and argued the gap —
    // and this matcher flagged it against R-014 (the session-floor ruling) and
    // R-059 (no day-strip on the day screen), neither of which is remotely its
    // subject. **A long, careful question accumulates generic two-word overlaps
    // ("team training", "rest day") until any row can reach two.**
    // **A FALSE POSITIVE HERE COSTS MORE THAN A MISS**: it blocks a real
    // question and teaches the next agent that the gate cries wolf, which is how
    // a wall becomes a formality. Uniqueness is the whole signal — "second game",
    // "floor number question" — so that is now the only test.
    return hits.some((p) => (PHRASE_ROWS.get(p) ?? 0) === 1 && !GENERIC_PHRASES.has(p));
    // **⚠ STILL IMPRECISE, AND SAYING SO RATHER THAN TUNING IT BLIND.** After
    // this tightening the matcher STILL flags the terminal's 2026-08-13 AWAITING
    // SAM entry (the vacated-Saturday question) against R-014 and R-059 — two
    // rulings that are not its subject. That entry is well formed: it carries a
    // REGISTRY-GREP naming five rows and argues why the gap is real.
    // **THE GATE IS THEREFORE RED ON A LEGITIMATE QUESTION, WHICH IS THE FAILURE
    // MODE THAT MATTERS MOST** — a wall that cries wolf becomes a formality.
    // Two-word phrase overlap is too coarse a signal for a long, careful
    // question, and the fix is a better matcher, not a looser threshold. Named
    // here rather than half-tuned at the end of a long turn; the honest
    // interim is that a flagged question should cite the rows and say they do
    // not apply, which is a true statement and what the gate is asking for.
  });
}

// ── [1] THE ONE REGISTRY IS THERE AND PARSES ───────────────────────────────
run('[1] the registry exists and every row has an id and a status', () => {
  assert(fs.existsSync(REGISTRY), `${REGISTRY} is gone — the ONE list must exist`);
  assert(REGISTRY_ROWS.length > 0, 'no R-nnn rows parsed; the shape changed under this gate');
  const ids = new Set<string>();
  for (const row of REGISTRY_ROWS) {
    assert(!ids.has(row.id), `duplicate row id ${row.id}`);
    ids.add(row.id);
    assert(row.status.length > 0,
      `${row.id} ends with no backticked status. Every row is `
      + '`R-nnn · ruling · meaning · `STATUS``, and a ruling whose state cannot be '
      + 'read is one no agent can act on.');
  }
});

// ── [1b] A BUILT ROW NAMES A SITE THAT EXISTS ──────────────────────────────
// A ruling whose enforcer cannot be opened is a ruling nobody can check, and
// "BUILT" on a file that has been renamed is worse than UNENFORCED — it stops
// the next agent looking.
run('[1b] every BUILT row naming a file:line names one that EXISTS', () => {
  const broken: string[] = [];
  for (const row of REGISTRY_ROWS) {
    for (const m of row.text.matchAll(/`((?:src|scripts|docs)\/[A-Za-z0-9_./-]+\.(?:tsx|ts|md|sh)):(\d+)`/g)) {
      const full = path.join(ROOT, m[1]);
      if (!fs.existsSync(full)) { broken.push(`${row.id} -> ${m[1]} (no such file)`); continue; }
      const count = fs.readFileSync(full, 'utf8').split('\n').length;
      if (Number(m[2]) > count) broken.push(`${row.id} -> ${m[1]}:${m[2]} (file has ${count} lines)`);
    }
  }
  assert(broken.length === 0, `unopenable enforcement site(s): ${broken.join(', ')}`);
});

// ── [1c] A COMMIT RECEIPT THAT DOES NOT RESOLVE IS A FABRICATION ───────────
// Item 33: "Red on a row with a receipt that does not resolve." **THE FOUNDING
// CASE IS THE REGISTRY AUTHOR'S OWN**, recorded in its seeding commit: *"I
// caught myself fabricating a citation"*. A plausible-looking SHA is the easiest
// false receipt in this repo to write and the hardest to notice.
run('[1c] every BUILT <commit> receipt names a commit that EXISTS', () => {
  const shas = new Set<string>();
  for (const row of REGISTRY_ROWS) {
    for (const m of row.text.matchAll(/BUILT\s+`?([0-9a-f]{7,40})`?/g)) shas.add(m[1]);
  }
  // NON-VACUITY: zero receipts would pass this trivially, and "no commits cited"
  // is equally produced by "none exist" and "the regex stopped matching".
  assert(shas.size > 0,
    'no commit receipts found at all. Either the registry stopped citing commits '
    + 'or this cell stopped seeing them — both are worth knowing.');
  const missing: string[] = [];
  for (const sha of shas) {
    try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); }
    catch { missing.push(sha); }
  }
  assert(missing.length === 0,
    `commit receipt(s) that do not resolve: ${missing.join(', ')}. A ruling `
    + 'pointing at a commit that does not exist is a fabricated receipt.');
});

// ── [2] THE UNENFORCED COUNT FALLS AND NEVER RISES SILENTLY ────────────────
// Item 33 cell 2, the same ratchet `test:law-registry` runs. **A ruling Sam made
// that the app does not carry out is the honest state to be IN and the wrong
// state to STAY in.** Raising this number is allowed — new rulings arrive
// unenforced — but only deliberately, in the commit that earns it, so the trend
// cannot drift the wrong way while every individual pass looks reasonable.
// **RAISED 11 -> 12 ON 2026-08-13, DELIBERATELY AND WITH ITS REASON**, which is
// what this cell's own message demands. R-014 arrived unenforced in `37d91482`:
// Sam ruled the session FLOOR out of existence — *"because the number of
// exercises is not important the total work being done evenly across the body
// is"* — and "a session is the right size when its pattern slots are filled" has
// no enforcer yet. **A new ruling landing UNENFORCED is the honest state to be
// in; drifting there quietly is not.** The ratchet fired on a real change inside
// an hour of being built, which is the only proof it works that counts.
//
// **RAISED 12 -> 13 ON 2026-08-13, AND IT FIRED AGAIN THE SAME WAY.** Item 35
// carried THREE new rulings from Sam and ordered them into the registry in the
// commit that records them. Two land BUILT — R-072 (the three equipment scopes)
// and R-074 (the 4-5 min set cap, built in `97c8d41b`). **R-073 lands
// UNENFORCED:** *"yeah well that sounds shit and not good"* on a main-strength
// cut the app makes by INFERENCE rather than proof. Nothing enforces "a cut must
// be proven" today, and saying so is the honest state.
//
// **NOTE THE SHAPE: three rulings arrived, ONE raised this number.** That is the
// ratchet doing exactly its job — it does not punish new rulings, it makes the
// unenforced ones impossible to add quietly.
const UNENFORCED_CEILING = 13;
run('[2] the UNENFORCED ruling count only falls', () => {
  const unenforced = REGISTRY_ROWS.filter((row) => /UNENFORCED/i.test(row.status));
  assert(unenforced.length <= UNENFORCED_CEILING,
    `${unenforced.length} rulings are UNENFORCED, above the ceiling of `
    + `${UNENFORCED_CEILING}: ${unenforced.map((r) => r.id).join(', ')}. Build the `
    + 'enforcer, or raise the ceiling deliberately in the commit that adds the row '
    + '— never let it drift.');
  // AND A CEILING THAT OUTLIVED ITS DEBT IS A LIE THE OTHER WAY. If the count
  // has fallen, the ceiling comes down with it in the same commit, exactly like
  // the typecheck and signed-copy ratchets.
  assert(unenforced.length >= UNENFORCED_CEILING - 2,
    `only ${unenforced.length} rulings are UNENFORCED but the ceiling is still `
    + `${UNENFORCED_CEILING}. Lower it in the commit that paid the debt, or the `
    + 'ratchet stops ratcheting.');
});

// ── THE QUESTIONS CURRENTLY POINTED AT SAM ─────────────────────────────────
/**
 * THE MARKER IS READ ON THE ITEM HEAD LINE, NEVER WHEREVER THE WORDS APPEAR.
 * The first version of this scanner matched the phrase anywhere and flagged two
 * non-questions: a paragraph QUOTING the marker while withdrawing it, and the
 * inbox's own legend of legal values. A gate that cannot tell a marker from a
 * mention of one reds on the records that prove it worked.
 */
function questionSites(source?: string): { label: string; text: string }[] {
  const lines = (source ?? fs.readFileSync(INBOX, 'utf8')).split('\n');
  const sites: { label: string; text: string }[] = [];
  const itemHead = /^[0-9][0-9A-Za-z-]*\.\s+\*\*/;
  for (let i = 0; i < lines.length; i += 1) {
    if (!itemHead.test(lines[i]) || !/BLOCKED-BY:\s*sam/i.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && !itemHead.test(lines[end])) end += 1;
    sites.push({ label: `inbox:${i + 1}`, text: lines.slice(i, end).join('\n') });
  }
  const start = lines.findIndex((line) => /^## AWAITING SAM/.test(line));
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && !/^## /.test(lines[end])) end += 1;
    let current: string[] | null = null;
    const flush = () => {
      if (!current) return;
      const text = current.join('\n');
      if (!/^-\s*\*\*(ANSWERED|⚠ STALE|STALE)/.test(text)) sites.push({ label: 'awaiting-sam', text });
      current = null;
    };
    for (let i = start + 1; i < end; i += 1) {
      if (/^- /.test(lines[i])) { flush(); current = [lines[i]]; }
      else if (current) current.push(lines[i]);
    }
    flush();
  }
  return sites;
}

const sites = questionSites();

// ── [3] THE GATE GREPS. IT DOES NOT ASK WHETHER YOU GREPPED. ───────────────
run('[3] no question to Sam re-asks a ruling without citing its row', () => {
  // **ZERO QUESTION SITES IS THE SUCCESS STATE, NOT A BROKEN SCANNER — AND THE
  // TWO ARE INDISTINGUISHABLE FROM THIS NUMBER ALONE.** That is the
  // a-zero-is-the-most-dangerous-number law, and it fired on this cell: the
  // first version asserted `sites.length > 0`, which was right while questions
  // existed and became WRONG the moment the queue was cleared — it reddened on
  // the exact outcome item 33 exists to produce ("he stops seeing questions he
  // has already answered"). **The scanner's liveness is proven against a
  // SYNTHETIC inbox in [3b] instead, so the live count is free to be zero.**
  const offences: string[] = [];
  for (const site of sites) {
    const uncited = rulingsMatching(site.text).filter((row) => !site.text.includes(row.id));
    if (uncited.length > 0) {
      offences.push(`${site.label} hits ${uncited.map((r) => r.id).join(' + ')} uncited`);
    }
  }
  assert(offences.length === 0,
    `${offences.length} question(s) re-ask a ruling on the registry: ${offences.join('; ')}. `
    + 'Open the row. If the question survives it, cite the R-nnn and say what is new.');
});

// ── [3b] AND THE SCANNER STILL FINDS A QUESTION WHEN THERE IS ONE ──────────
// The half that makes a live count of zero trustworthy. Fed a synthetic inbox,
// the scanner must find the blocked item and must NOT find the two shapes that
// fooled its first version: a paragraph QUOTING the marker, and a legend line
// listing the legal values.
run('[3b] the scanner finds a real question, and only a real one (liveness)', () => {
  const synthetic = [
    '## Unprocessed',
    '',
    '9. **BLOCKED-BY: sam — a genuine open question.**',
    '    Something only he can rule.',
    '',
    '10. **NOT BLOCKED — withdrawn.**',
    '    I marked this item `BLOCKED-BY: sam` and was wrong to.',
    '',
    '**`BLOCKED-BY: sam`**, **`BLOCKED-BY: other-agent`** or **`BLOCKED-BY: external`**',
    'are the three legal values.',
  ].join('\n');
  const found = questionSites(synthetic);
  assert(found.length === 1,
    `the scanner found ${found.length} sites in a fragment holding exactly ONE `
    + `question: ${JSON.stringify(found.map((f) => f.label))}. It is either blind `
    + 'to the marker or fooled by a mention of it.');
  assert(found[0].text.includes('a genuine open question'),
    'the scanner found a site, but not the one that is actually a question');
});

// ── [3c] THE MATCHER IS PINNED AT BOTH ENDS, AGAINST THE REAL CASE ─────────
run('[3c] it catches the re-asks Sam was handed, and not an unrelated question', () => {
  const q1 = 'Can someone have two games in one week? The app only has room for one game, '
    + 'so a second game has nowhere to live.';
  const q2 = 'The smallest a gym session is allowed to be — one number. Keep sessions for gym '
    + 'the same before footy training is being broken.';
  const ids = (t: string) => rulingsMatching(t).map((r) => r.id);
  assert(ids(q1).length > 0,
    `the two-games re-ask is not caught at all; matched ${JSON.stringify(ids(q1))}`);
  assert(ids(q2).length > 0,
    `the session-size re-ask is not caught at all; matched ${JSON.stringify(ids(q2))}`);
  // AND IT MUST NOT FIRE ON EVERYTHING — a matcher that refuses every question
  // is the same uselessness wearing a red.
  const unrelated = ids('what colour should the rest day icon be on the profile screen');
  assert(unrelated.length === 0,
    `the matcher fires on an unrelated question (${JSON.stringify(unrelated)}) — it would `
    + 'refuse every question ever asked');
});

// ── [4] AND THE SECOND LIST STAYS DEAD ─────────────────────────────────────
// This seat built a rival 14-row registry in TypeScript on 2026-08-13 while the
// real one was being committed. Sam: "The registry has 33 rows, not 14 — check
// before you add or trim." A second list is the defect item 32 exists to end,
// so its absence is now a cell rather than a memory.
run('[4] there is no second rulings registry', () => {
  assert(!fs.existsSync(path.join(ROOT, 'src', 'rules', 'rulingRegistry.ts')),
    'src/rules/rulingRegistry.ts is back. There is ONE registry and it is '
    + 'docs/RULINGS_REGISTRY.md — a rival list is the defect, not a convenience.');
});

console.log(`\nask gate: ${passed} passed, ${failed} failed`);
console.log(`  ${REGISTRY_ROWS.length} rulings on the registry, ${sites.length} question site(s) to Sam`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
