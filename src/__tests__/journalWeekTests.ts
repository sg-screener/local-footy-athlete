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
 * THE JOURNAL'S WEEK — slice 1 of the journal unit.
 *
 * What is under test is a DERIVATION, so the class of defect that matters is not
 * "the number is wrong" but "the Journal grew a second opinion about a fact the
 * app already owns", and "the Journal said something confident about data it
 * does not have".
 *
 * VERIFICATION STRATEGY (L12). Four classes, gated separately because they fail
 * differently:
 *
 *   - THE RULING can be mis-transcribed. Sam ruled five day shapes and three
 *     weights; every shape is asserted from the input that is supposed to
 *     produce it, and the weights are asserted as VALUES (2/1/0) because a
 *     ruling about numbers is checked as numbers.
 *   - OWNERSHIP can leak. `isHardDay` belongs to `countWeeklyExposures`. Cell
 *     group [3] moves ONLY that input and requires the answer to move with it —
 *     a Journal that re-derived hardness would ignore the change and stay green
 *     on a whole-week fixture. That is the cell that would catch the next
 *     `intensity-never-feeds-identity`.
 *   - THE TWO QUESTIONS can collapse into one. Sam: easy days "don't effect
 *     fatigue but count as sessions". Written as `loadWeight > 0`, the session
 *     count would silently drop every recovery day. [4] asserts the two answers
 *     DISAGREE on exactly that day — a cell that passes only if the two
 *     questions are genuinely separate.
 *   - HONESTY can decay. [5] and [6] assert the absent cases: a session with no
 *     recorded reason is COUNTED as unexplained rather than explained away, an
 *     unanswered session is not a skipped one, and the load comparison is null
 *     and marked unavailable below four weeks of history.
 *
 * Run: npm run test:journal-week
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import {
  JOURNAL_LOAD_WEIGHTS,
  LOAD_COMPARISON_MIN_WEEKS,
  TREND_MIN_WEEKS,
  buildJournalWeek,
  deriveJournalDataState,
  type JournalSessionOutcome,
} from '../rules/journalWeek';
import type { VisibleDay, VisiblePart } from '../rules/visibleProjection';
import type { WeeklyExposureCounts } from '../rules/weeklyExposureCounts';
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

// ─── Fixtures ────────────────────────────────────────────────────────────
//
// Built from the REAL exported shapes, so a change to `VisibleDay` or
// `WeeklyExposureCounts` reaches this suite through the compiler rather than
// through a hand-copied duplicate that would quietly drift.

const WEEK_START = '2026-08-10';
const D = (n: number): string => `2026-08-${String(10 + n).padStart(2, '0')}`;

function part(countsTowardLoad: boolean): VisiblePart {
  return {
    id: `part-${countsTowardLoad ? 'load' : 'recovery'}`,
    kind: countsTowardLoad ? 'strength' : 'recovery',
    headline: 'Strength' as VisiblePart['headline'],
    bucket: 'Strength' as VisiblePart['bucket'],
    detail: null,
    rows: [],
    capabilities: {
      canSwap: false, canMove: false, canRemove: false, canEditRows: false,
    },
    countsTowardLoad,
  };
}

function day(
  date: string,
  kind: VisibleDay['kind'],
  parts: readonly VisiblePart[],
): VisibleDay {
  return {
    date,
    kind,
    headline: 'Day' as VisibleDay['headline'],
    parts,
    capabilities: {
      canAdd: false, canMoveWholeDay: false, canRemoveWholeDay: false, refusal: null,
    },
    owner: 'plan',
  };
}

const trainingLoadDay = (date: string): VisibleDay => day(date, 'training', [part(true)]);
const recoveryDay = (date: string): VisibleDay => day(date, 'training', [part(false)]);
const restDay = (date: string): VisibleDay => day(date, 'rest', []);
const gameDay = (date: string): VisibleDay => day(date, 'game', [part(true)]);

/** Only the field this module reads is populated; the rest is shape. */
function exposures(hardDates: readonly string[], allDates: readonly string[]): WeeklyExposureCounts {
  return {
    hardExposures: 0,
    hardDays: hardDates.length,
    mainStrengthExposures: 0,
    conditioningExposures: 0,
    extraConditioningSessions: 0,
    runningExposures: 0,
    sprintCodExposures: 0,
    gunshowSessions: 0,
    recoverySessions: 0,
    teamTrainingSessions: 0,
    games: 0,
    byCategory: {},
    days: allDates.map((date) => ({
      date,
      workoutName: null,
      workoutNames: [],
      units: [],
      isHardDay: hardDates.includes(date),
    })),
  };
}

const outcome = (
  completion: JournalSessionOutcome['completion'],
  over: Partial<JournalSessionOutcome> = {},
): JournalSessionOutcome => ({
  completion, reason: null, feeling: null, soreness: null, ...over,
});

function build(args: {
  days: readonly VisibleDay[];
  hardDates?: readonly string[];
  outcomesByDate?: Record<string, JournalSessionOutcome>;
  weeksOfHistory?: number;
}) {
  return buildJournalWeek({
    weekStart: WEEK_START,
    days: args.days,
    exposures: exposures(args.hardDates ?? [], args.days.map((d) => d.date)),
    outcomesByDate: args.outcomesByDate ?? {},
    weeksOfHistory: args.weeksOfHistory ?? 1,
  });
}

const shapeOf = (week: ReturnType<typeof build>, date: string) =>
  week.days.find((d) => d.date === date)?.shape;
const weightOf = (week: ReturnType<typeof build>, date: string) =>
  week.days.find((d) => d.date === date)?.loadWeight;

// ─── [1] SAM'S DAY-SHAPE RULING, EVERY BRANCH ────────────────────────────

console.log('\n[1] THE WEEK-SHAPE RULING (Sam, 2026-08-08 §2)');
{
  const week = build({
    days: [restDay(D(0)), gameDay(D(1)), trainingLoadDay(D(2)),
      trainingLoadDay(D(3)), recoveryDay(D(4))],
    hardDates: [D(2)],
  });

  ok('a rest day shows as itself', shapeOf(week, D(0)) === 'rest', shapeOf(week, D(0)));
  ok('a game day shows as itself', shapeOf(week, D(1)) === 'game', shapeOf(week, D(1)));
  ok('a flagged hard day is HARD', shapeOf(week, D(2)) === 'hard', shapeOf(week, D(2)));
  ok('any other training day is MODERATE ("Moderate = normal training")',
    shapeOf(week, D(3)) === 'moderate', shapeOf(week, D(3)));
  ok('a recovery/mobility day is EASY', shapeOf(week, D(4)) === 'easy', shapeOf(week, D(4)));

  ok('every day in the week got a shape — no day silently dropped',
    week.days.length === 5 && week.days.every((d) => !!d.shape));
}

// ─── [2] THE SIGNED WEIGHTS, AS NUMBERS ──────────────────────────────────

console.log('\n[2] THE LOAD WEIGHTS — SIGNED 2 / 1 / 0');
{
  // A ruling stated as numbers is checked as numbers (AGENTS.md counting law).
  ok('hard = 2', JOURNAL_LOAD_WEIGHTS.hard === 2, JOURNAL_LOAD_WEIGHTS.hard);
  ok('moderate = 1', JOURNAL_LOAD_WEIGHTS.moderate === 1, JOURNAL_LOAD_WEIGHTS.moderate);
  ok('easy = 0 — "easy days don\'t effect fatigue"',
    JOURNAL_LOAD_WEIGHTS.easy === 0, JOURNAL_LOAD_WEIGHTS.easy);

  ok('there is NO game weight and NO rest weight to disagree with the classifier',
    !('game' in JOURNAL_LOAD_WEIGHTS) && !('rest' in JOURNAL_LOAD_WEIGHTS),
    Object.keys(JOURNAL_LOAD_WEIGHTS));

  const week = build({
    days: [trainingLoadDay(D(0)), trainingLoadDay(D(1)), recoveryDay(D(2)), restDay(D(3))],
    hardDates: [D(0)],
  });
  ok('the week total is the sum of its days (2+1+0+0)', week.load.thisWeek === 3,
    week.load.thisWeek);
}

// ─── [3] HARDNESS IS READ FROM ITS OWNER, NEVER RE-DERIVED ───────────────

console.log('\n[3] OWNERSHIP — the classifier owns hardness');
{
  // The SAME projection, twice, differing ONLY in what the exposure classifier
  // says. A Journal that re-derived hardness from the day's parts would answer
  // identically both times and this pair would not move.
  const days = [trainingLoadDay(D(0))];
  const soft = build({ days, hardDates: [] });
  const hard = build({ days, hardDates: [D(0)] });

  ok('unflagged, the identical day is MODERATE', shapeOf(soft, D(0)) === 'moderate');
  ok('flagged by the classifier, the identical day is HARD', shapeOf(hard, D(0)) === 'hard');
  ok('and the load follows the classifier, not the parts',
    weightOf(soft, D(0)) === 1 && weightOf(hard, D(0)) === 2,
    [weightOf(soft, D(0)), weightOf(hard, D(0))]);

  // A GAME TAKES THE HARD WEIGHT THROUGH THE EXISTING OWNER.
  // `stressClassification.ts:59` returns 'high' for a game, so a real game day
  // arrives here already flagged. The ruling never priced a game and did not
  // need to — this asserts the mechanism that makes that true, rather than a
  // constant nobody signed.
  const gameWeek = build({ days: [gameDay(D(0))], hardDates: [D(0)] });
  ok('a game day carries the HARD weight without a game constant existing',
    weightOf(gameWeek, D(0)) === JOURNAL_LOAD_WEIGHTS.hard, weightOf(gameWeek, D(0)));
  ok('and it still SHOWS as Game, not as Hard',
    shapeOf(gameWeek, D(0)) === 'game', shapeOf(gameWeek, D(0)));
}

// ─── [4] TWO QUESTIONS, ONE STORE ────────────────────────────────────────

console.log('\n[4] LOAD AND COMPLETION ARE DIFFERENT QUESTIONS');
{
  const week = build({ days: [recoveryDay(D(0)), restDay(D(1))] });

  ok('an easy day weighs ZERO in load', weightOf(week, D(0)) === 0);
  ok('and STILL counts as a session — Sam\'s explicit consequence',
    week.work.sessionsPlanned === 1, week.work);
  ok('a rest day is not a session at all', week.days[1].isSession === false);

  // The cell that fails if the two questions are ever collapsed into one.
  const easy = week.days[0];
  ok('the two answers DISAGREE on the easy day, which is the whole point',
    easy.loadWeight === 0 && easy.isSession === true);
}

// ─── [5] HONEST ABSENCE — the Journal never invents a why ────────────────

console.log('\n[5] HONEST ABSENCE (rider 1)');
{
  const week = build({
    days: [trainingLoadDay(D(0)), trainingLoadDay(D(1)), trainingLoadDay(D(2))],
    outcomesByDate: {
      [D(0)]: outcome('skipped'),                                 // no reason recorded
      [D(1)]: outcome('skipped', { reason: 'sick_low_energy' }),  // reason recorded
      // D(2): nothing recorded at all
    },
  });

  ok('a skipped session with no recorded reason is COUNTED as unexplained',
    week.work.missingReasons === 1, week.work);
  ok('a skipped session WITH a reason is not counted as unexplained',
    week.days[1].outcome?.reason === 'sick_low_energy');
  ok('an unanswered session is NOT a skipped one',
    week.work.notAnswered === 1 && week.work.skipped === 2, week.work);
  ok('an unanswered day carries a null outcome, never a fabricated one',
    week.days[2].outcome === null);
  ok('nothing recorded about how the week felt is stated as such',
    week.felt.nothingRecorded === true);

  const felt = build({
    days: [trainingLoadDay(D(0))],
    outcomesByDate: { [D(0)]: outcome('full', { feeling: 'hard', soreness: 'mild' }) },
  });
  ok('and when it IS recorded, it is counted',
    felt.felt.feelingsRecorded === 1 && felt.felt.sorenessRecorded === 1
      && felt.felt.nothingRecorded === false, felt.felt);
}

// ─── [6] THE DATA-STATE SCHEDULE ─────────────────────────────────────────

console.log('\n[6] PROGRESSIVE DATA STATES (addendum 11)');
{
  ok('week 1 is the building state', deriveJournalDataState(1) === 'first_week');
  ok('weeks 2-3 are early', deriveJournalDataState(2) === 'early'
    && deriveJournalDataState(3) === 'early');
  ok(`week ${LOAD_COMPARISON_MIN_WEEKS} unlocks load`,
    deriveJournalDataState(LOAD_COMPARISON_MIN_WEEKS) === 'load_ready');
  ok(`week ${TREND_MIN_WEEKS} unlocks trends`,
    deriveJournalDataState(TREND_MIN_WEEKS) === 'trends_ready');
  ok('the boundary is exact, not approximate',
    deriveJournalDataState(LOAD_COMPARISON_MIN_WEEKS - 1) === 'early'
    && deriveJournalDataState(TREND_MIN_WEEKS - 1) === 'load_ready');

  const young = build({ days: [trainingLoadDay(D(0))], weeksOfHistory: 1 });
  ok('below four weeks the comparison is null AND marked unavailable',
    young.load.comparison === null && young.load.comparisonAvailable === false);
  ok('this week\'s own load is still derivable with no history at all',
    young.load.thisWeek === 1, young.load.thisWeek);

  const grown = build({
    days: [trainingLoadDay(D(0))],
    weeksOfHistory: LOAD_COMPARISON_MIN_WEEKS,
  });
  ok('at four weeks the comparison becomes available (still unbuilt in slice 1)',
    grown.load.comparisonAvailable === true && grown.load.comparison === null);
}

// ─── [7] THE SURFACE — reachable, and a READER ───────────────────────────

console.log('\n[7] SURFACE LAWS');
{
  const navigator = readFileSync(join(__dirname, '../navigation/AppNavigator.tsx'), 'utf8');
  const screen = readFileSync(join(__dirname, '../screens/journal/JournalScreen.tsx'), 'utf8');

  // THE LESSON OF THE PURGE, MADE A CELL. The previous journal tree was deleted
  // because it was unreachable from App.tsx — barrel files nothing imported. A
  // Journal that exists but is not wired is the same defect wearing this unit's
  // name, so reachability is asserted, not assumed.
  ok('AppNavigator imports the Journal screen',
    /import\s+JournalScreen\s+from\s+['"]\.\.\/screens\/journal\/JournalScreen['"]/.test(navigator));
  ok('AppNavigator registers a JournalTab wired to that component',
    /<Tab\.Screen\b[\s\S]{0,200}?name="JournalTab"[\s\S]{0,200}?component=\{JournalScreen\}/.test(navigator),
  );

  // A COUNT IS NEVER THE WHOLE ASSERTION (AGENTS.md source-scan law). Locate
  // the region, prove it was found, THEN assert what makes it run.
  const tabBlocks = navigator.match(/<Tab\.Screen\b/g) ?? [];
  ok('the region was found — three tabs now, not two',
    tabBlocks.length === 3, tabBlocks.length);
  // A MUTATION SURVIVED HERE AND THE CELL IS WRITTEN THE WAY IT IS BECAUSE OF
  // IT. The first version compared three `indexOf` results directly. `indexOf`
  // returns -1 when the anchor is MISSING, and -1 is less than everything — so
  // renaming `ProgramTab` satisfied "Program comes before Journal" vacuously
  // and the cell stayed green while the tab it anchors on had vanished. This is
  // AGENTS.md's source-scan law in its exact wording: "prove the region was
  // found" before asserting anything about it. The positions are proven present
  // FIRST; only then are they compared.
  const tabOrder = ['ProgramTab', 'JournalTab', 'ProfileTab']
    .map((name) => ({ name, at: navigator.indexOf(`name="${name}"`) }));
  const missing = tabOrder.filter((tab) => tab.at < 0).map((tab) => tab.name);
  ok('all three tab anchors are PRESENT before any order is claimed',
    missing.length === 0, missing);
  ok('and the Journal tab sits between Program and Profile',
    missing.length === 0
    && tabOrder[0].at < tabOrder[1].at && tabOrder[1].at < tabOrder[2].at,
    tabOrder);

  // THE LOAD-BEARING LAW OF SLICE 1: the Journal is a reading surface. It opens
  // no door, commits no transaction and writes no store. This is the cell that
  // reds the day someone adds the note input to this screen instead of building
  // it as its own input with its own armoured store.
  ok('the screen source was found and is non-trivial', screen.length > 1000, screen.length);

  const WRITER_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
    ['a transaction commit', /\bcommit[A-Za-z]*Transaction\s*\(/],
    ['a mutation transaction', /\brun[A-Za-z]*Transaction\s*\(/],
    ['a direct store write', /\.\s*setState\s*\(/],
    ['a ledger append', /\bappend[A-Za-z]*(Decision|Entry|Ledger)\s*\(/],
    ['a persisted-store setter', /\buse[A-Za-z]*Store\.getState\(\)\.\s*set/],
  ];
  const writers = WRITER_PATTERNS
    .filter(([, pattern]) => pattern.test(screen))
    .map(([name]) => name);
  ok('the Journal screen reaches NO writer — it is a reading surface',
    writers.length === 0, writers);

  // The honest states are RENDERED, not merely derivable. Each is anchored by a
  // testID so the assertion is about a node the athlete can be shown, and so an
  // on-device explorer can find it.
  for (const testId of [
    'journal-no-reason-recorded',
    'journal-felt-nothing-recorded',
    'journal-load-building',
  ]) {
    ok(`the screen renders the honest state \`${testId}\``,
      new RegExp(`testID="${testId}"`).test(screen));
  }

  // The strip must render from the DERIVATION's days, not from its own loop over
  // the raw week — otherwise Sam's ruling would have a second implementation.
  ok('the strip renders the derived days, not a re-derived week',
    /<WeekShapeStrip\s+days=\{week\.days\}\s*\/>/.test(screen));
  ok('and the screen asks the classifier for hardness rather than deciding it',
    /\bcountWeeklyExposures\s*\(/.test(screen));
}

console.log(`\njournalWeekTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure derivation with hand-built '
  + 'projection days. It does NOT walk an athlete through a real week, and no cell '
  + 'here mounts a surface.');
console.log('  NOT COVERED: the load COMPARISON is not built (slice 1 ships the honest '
  + 'state only), so `comparisonAvailable` is asserted as a gate and never as a number. '
  + 'The rolling four-week average derives from RECORDED HISTORY, not from projections '
  + 'of past weeks, and that derivation is its own slice.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
