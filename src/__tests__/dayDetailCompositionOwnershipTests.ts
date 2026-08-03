/**
 * ONE COMPOSITION OF THE DAY DETAIL, AND IT IS ON THE WAY OUT.
 *
 * `composeDayDetail` was extracted verbatim from `useDayWorkout`'s memo so the
 * detail surface could be asserted from a harness — without it,
 * `surfaceAgreementTests` was comparing two domain projections that agree while
 * the two defects Sam photographed were absent from the comparison.
 *
 * This suite exists so the extraction cannot quietly become a permanent second
 * projection. Two things are pinned:
 *
 *   1. ONE production caller — `rules/projectVisibleWeek.ts`. It was two while the
 *      migration was in flight (Task 2 added `project()`, which populates `rows`
 *      from this composition rather than re-deriving one); Task 6 took
 *      `useDayWorkout.ts` off the list when the day-detail screen started
 *      rendering `project()`'s parts. A SECOND surface starting to compose its own
 *      detail is the defect class re-forming, and it must fail here rather than on
 *      his phone.
 *   2. PURITY. Same inputs, same answer — no store reads, no clock, no profile.
 *      The moment it reads anything else it stops being replaceable by
 *      `project()`, which is path 3 of the reassessment's deletion list.
 *
 * Run: npm run test:day-detail-composition-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import { composeDayDetail } from '../utils/dayDetailComposition';

let passed = 0;
let failed = 0;
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
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const SRC = path.join(__dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  const full = path.join(SRC, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

console.log('\n-- Day detail composition ownership --');

run('exactly one production caller composes the day detail, and it is the projection', () => {
  // THE RATCHET CLOSED (Task 6 of the buttons/UI unit, 2026-07-31). Task 2 widened
  // this pin to TWO callers on purpose — `project()` populates its `rows` from this
  // same composition rather than re-deriving one — and said what would shrink it
  // back: the day-detail screen rendering `project()`'s parts instead of composing
  // its own account. That landed, so `screens/home/useDayWorkout.ts` is off the
  // list and the composition is an internal of the projection, which is the only
  // shape in which it can be deleted outright (reassessment §5, path 3 of nine).
  //
  // ONE, not "at most two". A screen that starts composing again fails here rather
  // than on his phone.
  const ALLOWED_CALLERS = new Set([
    'rules/projectVisibleWeek.ts',
  ]);
  const callers = sourceFiles('').filter((file) => {
    if (file === 'utils/dayDetailComposition.ts') return false;
    const source = fs.readFileSync(path.join(SRC, file), 'utf8');
    return /composeDayDetail\s*\(/.test(source);
  });
  assert(
    callers.length === ALLOWED_CALLERS.size && callers.every((file) => ALLOWED_CALLERS.has(file)),
    `the day detail is composed in ${JSON.stringify(callers)}. Exactly the one named `
    + `caller is allowed (${JSON.stringify([...ALLOWED_CALLERS])}) — a SECOND surface `
    + 'composing its own detail is the split re-forming.');
});

run('the composition is pure', () => {
  // Asserted structurally: a pure function cannot import a store or a clock. This
  // is what keeps it replaceable by `project()` rather than becoming a rival to
  // it.
  const source = fs.readFileSync(path.join(SRC, 'utils/dayDetailComposition.ts'), 'utf8');
  const banned = ['useProgramStore', 'useProfileStore', 'useCalendarStore',
    'useReadinessStore', 'todayISOLocal', 'appDateNow', 'new Date('];
  const found = banned.filter((token) => source.includes(token));
  assert(found.length === 0,
    `the composition reads ${JSON.stringify(found)} — it must depend on nothing but `
    + 'its arguments, or it is not a surface and cannot be replaced by the projection');
});

run('same inputs give the same answer', () => {
  const workout = {
    id: 'w', microcycleId: 'm', dayOfWeek: 0, name: 'Recovery Session',
    description: '', durationMinutes: 30, intensity: 'Light',
    workoutType: 'Recovery', sessionTier: 'recovery', exercises: [],
  } as never;
  const a = JSON.stringify(composeDayDetail(workout, workout));
  const b = JSON.stringify(composeDayDetail(workout, workout));
  assert(a === b, 'the composition is not deterministic');
});

run('a null day composes an empty detail rather than throwing', () => {
  const empty = composeDayDetail(null, null);
  assert(empty.exerciseCount === 0 && empty.conditioningOptions.length === 0,
    'an empty day did not compose an empty detail');
});

console.log(`\nDay detail composition ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
