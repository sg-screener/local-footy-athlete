/**
 * PENDING-LIST HONESTY + the Stage B pin.
 *
 * SAM'S RULING (2026-07-28): "a pending list must distinguish 'ruled empty by
 * Sam' from 'never populated' — absence must never render as approval anywhere
 * the gate looks."
 *
 * THE DEFECT THIS CLOSES. `LOAD_RULING_PENDING` is an empty Set, and
 * `exerciseLockedListTests` asserts that emptiness: "nothing is parked awaiting
 * a load ruling." That assertion is true, passing, and misleading. Nothing is
 * parked because nothing was ever put there — 71 of the 77 entries in
 * EXERCISE_LOAD_MAP predate the park and were never ruled at all. An empty
 * pending list currently reads as "everything is ruled".
 *
 * That is the same shape as `inj()` defaulting to 'good', one layer up:
 * ABSENCE RENDERED AS APPROVAL. A default must never impersonate a ruling, and
 * an empty list must never impersonate a completed one.
 *
 * So a pending list is no longer an array. It is a state:
 *
 *   populated       — items await a ruling. Honest, and visibly unfinished.
 *   ruled_empty     — Sam emptied it. Requires attribution that RESOLVES.
 *   never_populated — nobody has done the work. FAILS THE BUILD.
 *
 * The third state is the point. It is what an empty array silently was.
 *
 * THE STAGE B PIN. Sam's second ruling: conditioning dose machinery that Stage
 * B deletes must not go in front of him — ruling on doomed values is wasted
 * time. Those decisions are pinned `dies_at_stage_b`. The pin is not a comment:
 * while Stage B is unlanded every pinned symbol must still exist, and once
 * Stage B lands every pinned symbol must be gone. A pin that outlives what it
 * pinned is how a stale exemption becomes a hiding place.
 *
 * Run: npm run test:pending-lists
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  PENDING_LISTS,
  STAGE_B_DOOMED,
  isStageBPathLanded,
  pendingListProblems,
} from '../data/provenancePendingLists';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function okEmpty(name: string, offenders: readonly string[], detail?: string): void {
  ok(name, offenders.length === 0,
    `${detail ? `${detail}\n      ` : ''}${[...offenders].sort().join('\n      ')}`);
}

console.log('\n[1] No pending list is silently empty');
{
  ok('there are pending lists to check', Object.keys(PENDING_LISTS).length > 0);

  // `never_populated` is the state an empty array used to occupy without
  // admitting it. Reaching it must fail rather than read as done.
  okEmpty('no pending list is in the never_populated state',
    Object.entries(PENDING_LISTS)
      .filter(([, l]) => l.status === 'never_populated')
      .map(([name]) => name),
    'this list has never been worked. Populate it, or have Sam rule it empty '
    + 'with attribution — an empty list is not evidence of a completed review');
}

console.log('\n[2] "Ruled empty" requires attribution that RESOLVES');
{
  // Otherwise `ruled_empty` becomes the new silent default: the cheapest way
  // past a lock is always to write yourself a pass.
  const problems = pendingListProblems(repoRoot);
  okEmpty('every ruled_empty list carries a resolvable attribution', problems,
    'ruledOn must be an ISO date and `where` must name a file that exists');
}

console.log('\n[3] The Stage B pin is real while its path is unlanded');
{
  ok('the pin names doomed symbols', STAGE_B_DOOMED.length > 0,
    'an empty pin would mean the cross-reference was never done');

  // PER PATH (Sam's ruling, 2026-08-05). Each path answers for its own pins:
  // an unlanded path must still hold every symbol it pinned.
  for (const pinPath of ['athlete', 'coach'] as const) {
    const landed = isStageBPathLanded(src, pinPath);
    console.log(`      (Stage B ${pinPath} path landed: ${landed})`);
    if (landed) continue;
    // Every pinned symbol must still be there. If one has already gone, the
    // pin is stale and must be removed — a pin for code that no longer exists
    // makes the list unreadable, exactly like a stale literal exemption.
    const missing = STAGE_B_DOOMED.filter((d) => d.path === pinPath).filter((d) => {
      const file = path.join(src, d.file);
      if (!fs.existsSync(file)) return true;
      return !new RegExp(`\\b${d.symbol}\\b`).test(fs.readFileSync(file, 'utf8'));
    }).map((d) => `${d.file}:${d.symbol}`);
    okEmpty(`no ${pinPath} pin is stale (every pinned symbol still exists)`, missing,
      'this symbol is already gone — delete the pin');
  }
}

console.log('\n[4] A landed path retires its own pins');
{
  // The pin exists to keep doomed values out of Sam's ruling queue WHILE they
  // are doomed-but-alive. The moment selection moves onto the authored sheet,
  // a surviving pinned symbol is a second conditioning dose authority sitting
  // beside the equality-bound one — which is the exact defect the sheet exists
  // to remove.
  //
  // SPLIT BY PATH, 2026-08-05, by Sam's ruling on
  // `docs/STAGE_B_PRIORITY_C_BLOCKER_2026-08-05.md`. The all-or-nothing form
  // could not be satisfied: five of the twenty pins are coach doses, and
  // replacing them changes what the coach path WRITES, which LR-6's ratified
  // stop test holds. The athlete path now answers for its fifteen, and the
  // coach path stays pinned.
  //
  // THE COST, STATED RATHER THAN HIDDEN: while the athlete path is landed and
  // the coach path is not, five coach doses KNOWINGLY survive as a second dose
  // authority beside Sam's 55 signed templates. That is ruled, not accidental,
  // and it ends when the coach rebuild lifts LR-6.
  for (const pinPath of ['athlete', 'coach'] as const) {
    if (!isStageBPathLanded(src, pinPath)) {
      ok(`the ${pinPath} path is unlanded, so its pins stay live (checked in [3])`, true);
      continue;
    }
    const survivors = STAGE_B_DOOMED.filter((d) => d.path === pinPath).filter((d) => {
      const file = path.join(src, d.file);
      return fs.existsSync(file)
        && new RegExp(`\\b${d.symbol}\\b`).test(fs.readFileSync(file, 'utf8'));
    }).map((d) => `${d.file}:${d.symbol}`);
    okEmpty(`the ${pinPath} path has landed, so every pin it owns is deleted`, survivors,
      'these were pinned as dying with this path. The path landed and they are '
      + 'still here, so they now compete with the authored templates');
  }

  // THE SPLIT MUST NOT BECOME A HIDING PLACE. A coach pin may only sit in a
  // coach consumer file, and an athlete pin only in an athlete one — otherwise
  // a symbol could be relabelled `coach` to escape the athlete path's landing
  // while living in the code the athlete path just switched over.
  const athleteFiles = new Set([
    'utils/sessionBuilder.ts', 'data/defaultProgram.ts', 'utils/conditioningRules.ts',
    'rules/speedTemplates.ts', 'utils/coachingEngine.ts',
  ]);
  const misfiled = STAGE_B_DOOMED
    .filter((d) => (d.path === 'athlete') !== athleteFiles.has(d.file))
    .map((d) => `${d.file}:${d.symbol} is labelled ${d.path}`);
  okEmpty('every pin\'s path matches the file it lives in', misfiled,
    'relabelling a pin is how a symbol would escape its path\'s landing');
}

console.log('\n[5] Every pinned decision names why it is doomed');
{
  okEmpty('every pin cites the authored template that supersedes it',
    STAGE_B_DOOMED.filter((d) => !d.supersededBy || d.supersededBy.trim().length < 3)
      .map((d) => `${d.file}:${d.symbol}`),
    'a pin without a named replacement is an assertion that something will '
    + 'replace it, which is how doomed code stops being doomed and just stays');

  // The named replacement must actually be one of the 55 authored templates,
  // not a plausible-sounding name.
  const templates = fs.readFileSync(path.join(src, 'data/conditioningTemplates.ts'), 'utf8');
  okEmpty('every named replacement exists in the authored templates',
    STAGE_B_DOOMED
      .filter((d) => d.supersededBy && !templates.includes(`'${d.supersededBy}'`))
      .map((d) => `${d.file}:${d.symbol} -> ${d.supersededBy}`),
    'the sheet does not carry a template by that name');
}

const total = passed + failures.length;
console.log(`\nPending-list honesty + Stage B pin: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
