/**
 * A SUITE NOBODY CAN RUN IS WHERE STALE ASSERTIONS GO TO LIVE.
 *
 * ## The founding case is four hours old and it was mine
 *
 * `powerPrimerPolicyTests.ts` — 56 cells — was named by NO npm script. Nothing
 * in the chain could run it, nothing outside the chain either. When it was
 * finally run it held **two cells asserting a ruling Sam had RETIRED**: that low
 * readiness removes power entirely, which his readiness law (2026-07-28) replaced
 * with *"capacity/readiness affects DOSE only"*. `powerPrimerPolicy.ts:26-35`
 * documents the change in full. The cells had been wrong for weeks and could not
 * fail, because nothing ran them.
 *
 * **A suite that cannot be run is not "extra coverage". It is a claim nobody
 * checks, and it rots in the direction of the code it was written against.**
 * `a-suite-can-die-at-import-and-sed-i-no-ops` is the same disease one step
 * further along — there the suite ran and asserted nothing; here it does not run
 * at all, which is worse, because a pass count of zero is at least printable.
 *
 * ## Why a RATCHET and not a red
 *
 * Measured before building: **56 of 395 suites are unrunnable today.** A hard
 * assert would red on arrival with no path down — the shape refused for
 * `LAW-L9-checkpoint-discipline` and for the completeness-word gate. So the count
 * is DECLARED and may only FALL. Wiring one suite in is a one-line change to
 * `package.json`; nobody has to fix 56 to land a commit.
 *
 * ## What this counts, stated before the number is used
 *
 * `LAW-count-names-instrument` was sighted five times on the day this was
 * written, twice inside guards I had just built. So: this counts FILES matching
 * `*Tests.ts` in `src/__tests__` whose **basename appears nowhere in any
 * `package.json` script**, and which are **not imported by any other file** under
 * `src/` or `scripts/`. The second half matters — a suite can legitimately be
 * driven by a runner rather than by a script of its own, and counting those as
 * orphans would be the instrument's unit standing in for the domain's.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the printed totals clears
// it. I wired 24 suites into the chain today and every one of them was UNARMED,
// which made `test:totals-or-red-law`'s red BIGGER. These two are mine by
// authorship, so they are armed first.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

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

const ROOT = path.join(__dirname, '..', '..');
const TEST_DIR = path.join(ROOT, 'src', '__tests__');
const BASELINE = path.join(ROOT, 'scripts', 'unrunnable-suite-baseline.json');

/** Every basename referenced anywhere in package.json's scripts. */
function scriptText(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return Object.values(pkg.scripts as Record<string, string>).join('\n');
}

/**
 * Imported by something else? A suite driven by a runner is RUNNABLE even with
 * no script of its own, and calling it an orphan would be a false positive that
 * teaches people to ignore this cell.
 */
function referencedElsewhere(base: string): boolean {
  // NO SHELL. `execFileSync` with an argument array — a filename is not user
  // input here, but a name carrying a shell metacharacter would silently change
  // the command, and a scan that quietly searches for the wrong thing is the
  // dead-instrument shape this whole suite exists to catch.
  const stem = base.replace(/\.ts$/, '');
  try {
    const out = execFileSync('grep', [
      '-rl', '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.sh',
      '--', stem, 'src', 'scripts',
    ], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').filter(Boolean).some((f) => path.basename(f) !== base);
  } catch {
    // grep exits 1 when nothing matches — that is "no other reference", not an
    // error, and it is the answer this function exists to return.
    return false;
  }
}

function unrunnable(): string[] {
  const scripts = scriptText();
  return fs.readdirSync(TEST_DIR)
    .filter((f) => /Tests\.ts$/.test(f))
    .filter((f) => !scripts.includes(f))
    .filter((f) => !referencedElsewhere(f))
    .sort();
}

console.log('unrunnableSuiteRatchetTests');

const current = unrunnable();
const total = fs.readdirSync(TEST_DIR).filter((f) => /Tests\.ts$/.test(f)).length;

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify({ count: current.length, files: current }, null, 2)}\n`);
  console.log(`  WROTE baseline: ${current.length} unrunnable of ${total}`);
  // ⚠ NO `process.exit(0)` HERE, AND THE LAW IS RIGHT TO BAN IT.
  // `process.exit(0)` writes the code DIRECTLY and hard-overrides the arm, so a
  // suite that crashed on the way to this line would still exit 0. I wrote that
  // bypass into this file this morning and `test:totals-or-red-law` named it —
  // my own guard, catching my own suite. `totalsPrinted(0)` clears through the
  // OWNER instead, which is the one act that means "I have something true to say".
  totalsPrinted(0);
} else {

// ── NON-VACUITY FIRST ────────────────────────────────────────────────────────
ok('the scan finds the test directory at all', total > 100, total);
ok('the scan can distinguish runnable from unrunnable',
  current.length > 0 && current.length < total, { unrunnable: current.length, total });

if (!fs.existsSync(BASELINE)) {
  ok('baseline exists', false, BASELINE);
} else {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as { count: number; files: string[] };
  const known = new Set(baseline.files);
  const arrivals = current.filter((f) => !known.has(f));

  // THE RATCHET. Falling is free; a NEW unrunnable suite is the thing to catch,
  // because that is a suite being written today that nothing will ever run.
  ok('no NEW unrunnable suite has arrived', arrivals.length === 0, arrivals);
  ok('the unrunnable count has not RISEN', current.length <= baseline.count,
    { was: baseline.count, now: current.length });

  const fixed = baseline.files.filter((f) => !current.includes(f));
  console.log(`  (ratchet: ${current.length} unrunnable of ${total}; baseline ${baseline.count}.` +
    `${fixed.length ? ` WIRED IN SINCE: ${fixed.join(', ')}.` : ''} Falling is free.)`);
}

}
console.log(`\nunrunnableSuiteRatchetTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
