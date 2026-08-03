/**
 * The never-again lock: an exercise name hardcoded in CODE is held to the same
 * vocabulary as a generated one.
 *
 * THE GAP SAM CAUGHT. The vocabulary switch closed the generator's naming
 * rights — the prompt offers selectable pool membership and acceptance refuses
 * anything else. It said nothing about names written directly into code, which
 * bypass every one of those gates:
 *
 *   - `Medicine Ball Overhead Throw` lived in `buildPowerBlock` for months. No
 *     cue, no video, no pool, no gate that could see it.
 *   - the LIVE "Add exercise" affordance on the session screen still offers six
 *     names the app cannot cue, so the athlete gets a blank card — the exact
 *     device run-5 failure, reached through a different door.
 *
 * A literal in a builder is a name the athlete can see. So this suite extracts
 * every string literal sitting in an exercise-identity position across all code
 * outside the curated data layer, and requires each to EITHER resolve to the
 * locked vocabulary OR carry a typed exemption kind. Nothing silently survives.
 *
 * PRECISION, not a keyword guess. A literal is only treated as an exercise name
 * when it sits in `name:` / `exerciseName:` inside an object that ALSO carries
 * prescription fields (sets, reps, order, equipment, duration…), or inside a
 * bare string array whose identifier ends in EXERCISES. An exercise written by
 * a builder always comes with its dose; a store key, a screen route, an icon
 * name and a session title never do. That is what keeps the residual list small
 * enough to be read and ruled on rather than rubber-stamped.
 *
 * Run: npm run test:exercise-name-lock
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import {
  LITERAL_EXEMPTIONS,
  LITERAL_EXEMPTION_KINDS,
  POWER_POOL_PENDING,
  isSelectable,
  literalExemptionFor,
} from '../data/selectableExerciseVocabulary';
import {
  groupLiteralHits,
  sweepExerciseNameLiterals,
} from '../rules/exerciseNameLiteralSweep';
import { buildCueText } from '../screens/home/dayWorkoutHelpers';

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

/* ══ The sweep ══ */

const hits = sweepExerciseNameLiterals(src);
const byLiteral = groupLiteralHits(hits);

/* ══ The lock ══ */

function resolvesToVocabulary(literal: string): boolean {
  const canonical = canonicalExerciseName(literal);
  return isSelectable(canonical) || POWER_POOL_PENDING.has(canonical);
}

console.log('\n[1] The sweep actually swept');
{
  ok('the sweep found exercise-name literals across the codebase',
    byLiteral.size > 30, `found ${byLiteral.size} distinct literals in ${hits.length} positions`);

  // Proof the sweep reaches the BUILDERS, not just screens — the class that hid
  // Medicine Ball Overhead Throw. If defaultProgram ever stops being scanned,
  // this fails rather than the sweep quietly going blind.
  ok('the sweep reaches the program builder',
    hits.some((h) => h.file === 'data/defaultProgram.ts'),
    'data/defaultProgram.ts must be swept — buildPowerBlock lives there');
  ok('the sweep reaches the live session screen',
    hits.some((h) => h.file.endsWith('DayWorkoutScreenV2.tsx')),
    'the Add-exercise suggestion table lives there');
}

console.log('\n[2] THE LOCK — every hardcoded name resolves, or is typed');
{
  const unaccounted: string[] = [];
  for (const [literal, where] of byLiteral) {
    if (resolvesToVocabulary(literal)) continue;
    if (literalExemptionFor(literal)) continue;
    unaccounted.push(`${literal}   [${where.join(', ')}]`);
  }
  okEmpty('no hardcoded exercise name is unaccounted for', unaccounted,
    'each must resolve to the locked vocabulary or carry a typed exemption kind — '
    + 'add it to LITERAL_EXEMPTIONS with a kind, or fix the name');
}

console.log('\n[3] The exemption list stays honest');
{
  // An exemption for a name that now resolves is rot: it would hide the next
  // one. And an exemption for a literal the sweep no longer finds is dead
  // weight that makes the list unreadable.
  okEmpty('no exemption covers a name that already resolves',
    Object.keys(LITERAL_EXEMPTIONS).filter((n) => resolvesToVocabulary(n)),
    'these resolve now — delete the exemption and let the lock hold them');

  okEmpty('no exemption is stale (every one is still found by the sweep)',
    Object.keys(LITERAL_EXEMPTIONS).filter((n) => !byLiteral.has(n)),
    'the literal is gone from the codebase — delete the exemption');

  okEmpty('every kind records the ruling that created it',
    Object.entries(LITERAL_EXEMPTION_KINDS)
      .filter(([, spec]) => spec.ruling.trim().length < 40)
      .map(([kind]) => kind));
}

console.log('\n[4] `awaiting_sam_ruling` is a LOUD park, not a quiet one');
{
  const awaiting = Object.entries(LITERAL_EXEMPTIONS)
    .filter(([, kind]) => kind === 'awaiting_sam_ruling')
    .map(([name]) => name);

  // Emptiness is the proof. The kind surfaced six cueless names in the live
  // "Add exercise" table and Sam ruled every one, so nothing is parked — and
  // this assertion is what stops the next one being parked quietly.
  okEmpty('nothing is parked awaiting a ruling', awaiting,
    'each needs a row in docs/EXERCISE_NAME_LOCK_REPORT_2026-07-25.md first');

  // The two guards below carry the contract for when something IS parked again:
  // a parked name must genuinely render no cue, and must be visible in the report.
  okEmpty('every parked name genuinely renders no cue today',
    awaiting.filter((n) => buildCueText(n) !== null),
    'this now cues — it resolved, so remove the park');

  // And the park must be visible outside the code: the report names every one.
  const report = fs.readFileSync(
    path.join(src, '..', 'docs/EXERCISE_NAME_LOCK_REPORT_2026-07-25.md'), 'utf8');
  okEmpty('every parked name is listed in the report for Sam',
    awaiting.filter((n) => !report.includes(n)),
    'a park nobody can see is indistinguishable from no gate at all');
}

const total = passed + failures.length;
console.log(`\nHardcoded exercise-name lock: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
