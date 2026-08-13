/**
 * LAW-coach-no-phrase-handlers, MECHANISED AS A RATCHET.
 *
 * THE LAW: "Coach bugs are fixed at the typed intent/context/executor layer,
 * never as phrase-by-phrase special cases." (AGENTS.md "Coach Intelligence
 * Rules"; `.claude/rules/coach-and-plan-edits.md`.)
 *
 * Its registry row named its own gate: *"a gate counting phrase-literal branches
 * in the coach read/proposal path and failing on growth — the shape signedCopy
 * uses for strings."* This is that gate.
 *
 * ## ⚠ WHAT THE NUMBER IS, STATED BEFORE IT IS USED
 *
 * `LAW-count-names-instrument` was sighted FIVE times on the day this was
 * written, once inside a guard I had built that morning. So the unit is named
 * first and precisely:
 *
 *   THIS COUNTS: `/…/.test(` regex-literal sites, and `.includes('…')` /
 *   `.includes("…")` sites with a 4+ character literal, in `src/utils/*coach*.ts`,
 *   WITH COMMENTS STRIPPED.
 *
 *   IT IS NOT a count of "phrase handlers". A date regex and an id-list
 *   `.includes` both land in it. **That over-counting is ACCEPTABLE for a
 *   RATCHET and would be fatal for a THRESHOLD** — the claim is never "there are
 *   N phrase handlers", it is "this file grew a new text-literal branch", which
 *   is true whatever the branch turns out to be. A reviewer then decides.
 *
 * ## WHY PER-FILE AND NOT A TOTAL
 *
 * A total lets a deletion in one file pay for growth in another, which is how a
 * ratchet silently stops ratcheting. Per-file localises the growth to the file
 * that must justify it. `a-count-taken-for-a-record` and
 * `harness-lies-tail-not-exit-line` are the same lesson from two directions.
 *
 * ## HOW TO LAND A LEGITIMATE INCREASE
 *
 * Run with `--update`, and say in the commit WHY the coach path needed another
 * text-literal branch. **The baseline is a reviewable file, not a magic number**,
 * for exactly the reason the census hook announces instead of refusing: a gate
 * that blocks honest work with no exit gets disabled, and then the law reads
 * guarded while nothing guards it.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
    return;
  }
  fail++;
  failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
}

const COACH_DIR = path.join(__dirname, '..', 'utils');
const BASELINE = path.join(__dirname, '..', '..', 'scripts', 'coach-phrase-baseline.json');

/**
 * A comment is not a shipped branch. `a-comment-is-not-a-shipped-string` — and
 * on the day this was written, an unstripped scan of the rulings registry
 * reported 2 hits that were BOTH prose, which killed a gate proposal outright.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function phraseBranches(source: string): number {
  const code = codeOnly(source);
  const regexTests = code.match(/\/[^/\n]{4,}\/[gimsuy]*\.test\(/g)?.length ?? 0;
  const singleQuoted = code.match(/\.includes\(\s*'[^']{4,}'/g)?.length ?? 0;
  const doubleQuoted = code.match(/\.includes\(\s*"[^"]{4,}"/g)?.length ?? 0;
  return regexTests + singleQuoted + doubleQuoted;
}

function measure(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const file of fs.readdirSync(COACH_DIR).sort()) {
    if (!file.endsWith('.ts') || !/coach/i.test(file)) continue;
    const count = phraseBranches(fs.readFileSync(path.join(COACH_DIR, file), 'utf8'));
    if (count > 0) out[file] = count;
  }
  return out;
}

console.log('coachPhraseHandlerRatchetTests');

const current = measure();

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`  WROTE baseline: ${Object.keys(current).length} files, ` +
    `${Object.values(current).reduce((a, b) => a + b, 0)} branches`);
  process.exit(0);
}

// ── NON-VACUITY FIRST ────────────────────────────────────────────────────────
// A scan that silently found nothing would make every ratchet cell below pass
// forever. This is the shape that made a 693-line suite run zero assertions for
// sixteen days.
ok('the scan reaches the coach path at all', Object.keys(current).length > 10,
  Object.keys(current).length);
ok('the scan finds the known-heaviest file', (current['coachCommandRouter.ts'] ?? 0) > 50,
  current['coachCommandRouter.ts']);
// ⚠ BOTH COMMENT FORMS, AND THE SECOND CELL EXISTS BECAUSE A MUTANT EXPOSED ITS
// ABSENCE. The first version of this cell tested ONLY `//`. Deleting the BLOCK
// comment stripper therefore changed nothing and no cell reddened — the stripper
// was real, correct, and completely unheld. `a-vocabulary-gate-is-blind-to-a-
// legal-word`: mutate each BRANCH, not just the output.
//
// (And the mutation that found it had itself silently failed to apply the first
// time — `sed` no-ops on this mount. The "surviving mutant" was a DEAD
// INSTRUMENT, and the gap was only found by checking the probe was in.)
ok('LINE comments are stripped — a commented-out branch does not count',
  phraseBranches("// if (/hello there/.test(x)) {}\nconst a = 1;") === 0,
  phraseBranches("// if (/hello there/.test(x)) {}\nconst a = 1;"));
ok('BLOCK comments are stripped too',
  phraseBranches("/* if (/hello there/.test(x)) {} */\nconst a = 1;") === 0,
  phraseBranches("/* if (/hello there/.test(x)) {} */\nconst a = 1;"));
ok('a real branch DOES count', phraseBranches("if (/hello there/.test(x)) {}") === 1,
  phraseBranches("if (/hello there/.test(x)) {}"));

if (!fs.existsSync(BASELINE)) {
  ok('baseline exists', false, BASELINE);
} else {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;

  // ── THE RATCHET, PER FILE ─────────────────────────────────────────────────
  const grew: string[] = [];
  for (const [file, count] of Object.entries(current)) {
    const was = baseline[file] ?? 0;
    if (count > was) grew.push(`${file}: ${was} -> ${count}`);
  }
  ok('NO coach file grew a text-literal branch', grew.length === 0, grew);

  // A NEW coach file with phrase branches is growth too — it would otherwise
  // enter at "not in the baseline" and be invisible. The founding shape:
  // a-suite-can-die-at-import, where absence read as health.
  const newFiles = Object.keys(current).filter((f) => !(f in baseline));
  ok('no NEW coach file arrives carrying text-literal branches', newFiles.length === 0, newFiles);

  // Falling is always allowed, and is the point — record it so the direction is
  // visible in the log rather than only in a diff.
  const before = Object.values(baseline).reduce((a, b) => a + b, 0);
  const after = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(`  (ratchet: ${after} branches across ${Object.keys(current).length} files; ` +
    `baseline ${before}. Falling is free; growth needs --update and a reason.)`);
}

console.log(`\ncoachPhraseHandlerRatchetTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
