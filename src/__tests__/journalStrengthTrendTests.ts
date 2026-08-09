(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * THE STRENGTH LINE — Monday card item 2.
 *
 * VERIFICATION STRATEGY (L12). The class of defect here is **a record of work
 * nobody did**, which is worse than a wrong number because it is believable:
 *
 *   - A SKIPPED LIFT CARRIES A PRESCRIBED WEIGHT. `weightKg` on a skipped row is
 *     what was ASKED FOR, not what was lifted; counting it reports a personal
 *     best for a session the athlete told us they did not do. [2] asserts it is
 *     excluded — the cell that would catch the next "the number is right and the
 *     story is false".
 *   - "LAST WEEK" CAN MEAN TWO THINGS. The load slice already paid for confusing
 *     the calendar week with the last week the athlete logged. [4] asserts the
 *     comparison is the CALENDAR week, with a fixture where the two disagree.
 *   - AN ABSENCE CAN DRESS AS A RECORD. A lift with no previous week has no
 *     direction, and a lift not trained this week has no line at all. [3] and [5]
 *     assert both, because an arrow is a claim that a comparison happened.
 *   - AN ORDER CAN BE UNSTABLE. Two lifts at the same load must not swap between
 *     renders. [6] asserts the tie-break.
 *
 * Run: npm run test:journal-strength-trend
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { buildJournalStrengthTrend } from '../rules/journalStrengthTrend';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const THIS_WEEK = '2026-08-10'; // a Monday
const LAST_WEEK = '2026-08-03';

function lift(over: Partial<StrengthExercisePerformanceLog> = {}): StrengthExercisePerformanceLog {
  return {
    exerciseId: 'ex-1',
    workoutExerciseId: 'we-1',
    exerciseName: 'Back Squat',
    prescribedSets: 3,
    prescribedRepsMin: 4,
    prescribedRepsMax: 6,
    weightKg: 100,
    completion: 'full',
    ...over,
  };
}

const build = (sessions: { date: string; strength: StrengthExercisePerformanceLog[] }[]) =>
  buildJournalStrengthTrend({ weekStart: THIS_WEEK, sessions });

// ─── [1] The top set is the heaviest recorded ────────────────────────────

console.log('\n[1] THE TOP SET');
{
  const lifts = build([
    { date: THIS_WEEK, strength: [lift({ weightKg: 100 })] },
    { date: '2026-08-12', strength: [lift({ weightKg: 120 })] },
    { date: '2026-08-14', strength: [lift({ weightKg: 110 })] },
  ]);
  ok('the heaviest of the week is the top set',
    lifts.length === 1 && lifts[0].thisWeek.weightKg === 120, lifts);

  ok('logged reps ride the top set when the athlete logged them',
    build([{ date: THIS_WEEK, strength: [lift({ actualReps: 5 })] }])[0].thisWeek.reps === 5);

  // NULL IS NOT ZERO AND IS NOT THE PRESCRIPTION. Printing the prescribed range
  // beside a real weight would read as a record of work nobody recorded.
  ok('reps are NULL when no per-set detail was logged — never the prescription',
    build([{ date: THIS_WEEK, strength: [lift()] }])[0].thisWeek.reps === null);

  ok('a lift with no recorded weight gets no line at all',
    build([{ date: THIS_WEEK, strength: [lift({ weightKg: null })] }]).length === 0);
}

// ─── [2] A skipped lift is not a top set ─────────────────────────────────

console.log('\n[2] A SKIPPED LIFT IS NOT A RECORD');
{
  // The believable defect: `weightKg` on a skipped row is the PRESCRIBED weight.
  // Counting it reports a best for a session the athlete said they did not do.
  const lifts = build([
    { date: THIS_WEEK, strength: [lift({ weightKg: 100 })] },
    { date: '2026-08-12', strength: [lift({ weightKg: 200, completion: 'skipped' })] },
  ]);
  ok('a skipped lift does not become the week\'s top set',
    lifts.length === 1 && lifts[0].thisWeek.weightKg === 100, lifts);

  ok('a week of nothing but skipped lifts produces no lines',
    build([{ date: THIS_WEEK, strength: [lift({ completion: 'skipped' })] }]).length === 0);

  // A PARTIAL SESSION STILL HAPPENED. Only `skipped` means "did not do it".
  ok('a partial lift still counts — it was performed',
    build([{ date: THIS_WEEK, strength: [lift({ completion: 'partial' })] }])[0]
      .thisWeek.weightKg === 100);
}

// ─── [3] The arrow is a claim that a comparison happened ─────────────────

console.log('\n[3] DIRECTION — and `new` is a first-class answer');
{
  const withHistory = (thisKg: number, lastKg: number) => build([
    { date: THIS_WEEK, strength: [lift({ weightKg: thisKg })] },
    { date: LAST_WEEK, strength: [lift({ weightKg: lastKg })] },
  ])[0];

  ok('heavier than last week is UP', withHistory(110, 100).direction === 'up');
  ok('lighter than last week is DOWN', withHistory(90, 100).direction === 'down');
  ok('the same weight is FLAT', withHistory(100, 100).direction === 'flat');

  // FLAT IS EXACT EQUALITY, AND THAT IS DELIBERATE. The moment a tolerance
  // appears ("within 2.5kg counts as flat") it becomes a CONSTANT, and it goes
  // in the load model's signing table with the others rather than being decided
  // here in silence.
  ok('a half-kilo more is UP, not flat — there is no unsigned tolerance',
    withHistory(100.5, 100).direction === 'up');

  // AN ARROW WITH NOTHING BEHIND IT IS A CLAIM THAT DID NOT HAPPEN.
  const firstTime = build([{ date: THIS_WEEK, strength: [lift()] }])[0];
  ok('a lift with no previous week is NEW, never flat',
    firstTime.direction === 'new' && firstTime.lastWeek === null, firstTime);
}

// ─── [4] "Last week" is the CALENDAR week ────────────────────────────────

console.log('\n[4] "LAST WEEK" MEANS LAST WEEK');
{
  // THE FIXTURE WHERE THE TWO READINGS DISAGREE, which is the only kind that
  // proves anything. The athlete last squatted four weeks ago; "up on last week"
  // would be a sentence about a week that did not happen.
  const gapped = build([
    { date: THIS_WEEK, strength: [lift({ weightKg: 120 })] },
    { date: '2026-07-13', strength: [lift({ weightKg: 100 })] }, // four weeks back
  ])[0];
  ok('a lift not trained LAST week is NEW, not compared against months ago',
    gapped.direction === 'new' && gapped.lastWeek === null, gapped);

  const contiguous = build([
    { date: THIS_WEEK, strength: [lift({ weightKg: 120 })] },
    { date: '2026-08-05', strength: [lift({ weightKg: 100 })] }, // mid last week
  ])[0];
  ok('and any day inside last week counts as last week',
    contiguous.direction === 'up' && contiguous.lastWeek?.weightKg === 100, contiguous);
}

// ─── [5] A lift not trained this week has no line ────────────────────────

console.log('\n[5] THE CARD REPORTS THIS WEEK');
{
  const lifts = build([
    { date: THIS_WEEK, strength: [lift({ exerciseName: 'Back Squat' })] },
    { date: LAST_WEEK, strength: [lift({ exerciseName: 'Bench Press' })] },
  ]);
  ok('a lift trained only LAST week gets no row — an absence is not a record',
    lifts.length === 1 && lifts[0].exerciseName === 'Back Squat',
    lifts.map((l) => l.exerciseName));
}

// ─── [6] The order is stable ─────────────────────────────────────────────

console.log('\n[6] ORDER — heaviest first, and deterministic at a tie');
{
  const lifts = build([{
    date: THIS_WEEK,
    strength: [
      lift({ exerciseName: 'Bench Press', weightKg: 80 }),
      lift({ exerciseName: 'Back Squat', weightKg: 140 }),
      lift({ exerciseName: 'Barbell Row', weightKg: 80 }),
    ],
  }]);
  ok('heaviest first', lifts[0].exerciseName === 'Back Squat', lifts.map((l) => l.exerciseName));
  // WITHOUT THE TIE-BREAK these two swap with Map insertion order — a diff
  // nobody can explain and a screenshot nobody can reproduce.
  ok('and a tie breaks by name, so the order never wobbles',
    lifts[1].exerciseName === 'Barbell Row' && lifts[2].exerciseName === 'Bench Press',
    lifts.map((l) => l.exerciseName));
}

// ─── [7] The surface ─────────────────────────────────────────────────────

console.log('\n[7] THE SURFACE');
{
  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the screen source was read', screen.length > 4000, screen.length);
  ok('the screen builds the trend rather than deriving lifts itself',
    /\bbuildJournalStrengthTrend\s*\(/.test(screen));

  // ── `journal-strength-none` WAS RETIRED, AND SAM PUT IT BACK ──
  //
  // THIS CELL HAS NOW BEEN RE-POINTED TWICE IN TWO DAYS, and the second move is
  // the interesting one. Sam's UI ruling (2026-08-09 morning) made the front
  // page exception-based, so the whole lifts card went absent on a week with no
  // logged weights and this cell asserted the sentence was GONE. The boundary
  // report flagged it as the one withdrawal of nine that removed INFORMATION —
  // "you logged no weights" and "you did no lifting" became indistinguishable —
  // and his signing session (same day, decision C3) reversed exactly that one.
  //
  // SO THE ASSERTION IS INVERTED RATHER THAN DELETED, and it is stronger than
  // either previous form: the line must be PRESENT, and it must be the sentence
  // the copy sheet carries. A cell that merely stopped forbidding the string
  // would pass against a screen that dropped it again.
  const screenCode = screen
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('the stripped screen source is substantial, not an empty slice',
    screenCode.length > 4000, screenCode.length);
  ok('the restored empty state is on the screen, in code and not in a comment',
    /journal-strength-none/.test(screenCode)
    && /No lifts recorded with a weight this week\./.test(screenCode),
    screenCode.match(/No lifts recorded[^\n]*/g));

  const start = screenCode.indexOf('function StrengthLines');
  const end = screenCode.indexOf('\nfunction ', start + 1);
  ok('the StrengthLines component was located', start > 0 && end > start, { start, end });
  const region = screenCode.slice(start, end);
  ok('and the located region is substantial', region.length > 200, region.length);

  // THE LINE IS IN THE EMPTY BRANCH, NOT MERELY IN THE FILE. A source scan that
  // only proved the string exists somewhere would pass with it rendered beside
  // a populated lifts card — `a-count-taken-for-a-record`, source-scan form:
  // locate the region, then assert what makes it run.
  ok('a week with no logged weights renders the honest line, in the zero branch',
    /lifts\.length === 0\)\s*\{/.test(region)
    && /journal-strength-none/.test(region)
    && /No lifts recorded with a weight this week\./.test(region), region);
  ok('and the line does NOT ride along when there are lifts to show',
    (region.match(/No lifts recorded with a weight this week\./g) ?? []).length === 1,
    region.match(/No lifts recorded with a weight this week\./g));

  // NO SIGNED-CONSTANT DOOR HERE, AND THE ABSENCE IS THE POINT: this module has
  // no constants to wait on, which is exactly why its number can ship while the
  // load headline cannot.
  const trend = readFileSync(join(__dirname, '..', 'rules', 'journalStrengthTrend.ts'), 'utf8');
  ok('the trend module source was read', trend.length > 2000, trend.length);
  const code = trend.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('the trend module declares no threshold constant of its own',
    !/TOLERANCE|THRESHOLD|_CONSTANTS\b/.test(code), code.match(/[A-Z_]{6,}/g));
  ok('and it reads week identity from the ONE owner, not its own date maths',
    /\bjournalWeekStartOf\s*\(/.test(code) && /\bcalendarWeeksBefore\s*\(/.test(code)
    && !/getUTCDay\s*\(/.test(code));
}

console.log(`\njournalStrengthTrendTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure derivation with hand-built '
  + 'session records. No walked athlete, and no cell mounts a surface.');
console.log('  NOT COVERED: "anchor lift" is read as "the main lifts the app already '
  + 'records" (`strengthLogging.isMainStrengthExercise`), because the app has NO '
  + 'anchor-lift concept — `isAnchor` elsewhere means a game/team-training anchor DAY. '
  + 'A narrower authored set is a Sam ruling, not a predicate this file should guess. '
  + 'No device evidence; the kg figure is unverified by eye.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
