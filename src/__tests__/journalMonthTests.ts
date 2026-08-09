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
 * THE MONTHLY REVIEW — the design's "where progression lives", layer 5 of the
 * load ruling.
 *
 * VERIFICATION STRATEGY (L12). This is the unit's first DRAWN surface, so the
 * defect classes change shape: a chart lies by its geometry, not by its number.
 *
 *   - A DISHONEST CHART CAN RENDER. Sam ruled "never one floating dot". [2]
 *     asserts the guard lives in the DERIVATION — a too-short series comes back
 *     null, so the surface cannot render it even if a future author forgets.
 *     A cell that only checked the component would leave the rule one refactor
 *     from being lost.
 *   - AN ABSENCE CAN BE PLOTTED AS A ZERO. A week the athlete did not condition
 *     is not a week of zero conditioning; plotting it draws a collapse that never
 *     happened. [3] asserts absent weeks are excluded, not zeroed.
 *   - A FLAT SERIES CAN READ AS A COLLAPSE. With every value identical the range
 *     is zero, and the naive scale puts the line on the floor. [5] asserts the
 *     flat case sits mid-height — the honest picture of no change.
 *   - A CHART WALL CAN GROW. [6] asserts the surface renders at most two charts,
 *     because building one per available series is the easy failure Sam's guard
 *     names.
 *
 * Run: npm run test:journal-month
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { MIN_POINTS_FOR_A_TREND, buildJournalMonth } from '../rules/journalMonth';
import { TREND_MIN_WEEKS } from '../rules/journalWeek';
import type { JournalLoadWeekTotals } from '../rules/journalLoad';
import type { StrengthTopSet } from '../rules/journalStrengthTrend';
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

const week = (weekStart: string, conditioningSRPE: number): JournalLoadWeekTotals => ({
  weekStart,
  strengthMainLiftTonnageKg: 0,
  conditioningSRPE,
  sessionsMeasured: 1,
  sessionsRecorded: 1,
  liftsUnmeasured: 0,
  regions: {},
  patternTonnageKg: { squat: 0, hinge: 0, push: 0, pull: 0 },
  upperLowerTonnageKg: { upper: 0, lower: 0 },
});

const topSet = (weightKg: number): StrengthTopSet => ({ weightKg, reps: null });

const WEEKS = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22',
  '2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'];

const series = (
  name: string,
  kgs: readonly number[],
): ReadonlyMap<string, readonly { weekStart: string; topSet: StrengthTopSet }[]> =>
  new Map([[name, kgs.map((kg, i) => ({ weekStart: WEEKS[i], topSet: topSet(kg) }))]]);

const EMPTY_SERIES: ReadonlyMap<
  string, readonly { weekStart: string; topSet: StrengthTopSet }[]
> = new Map();

// ─── [1] The threshold is not a new constant ─────────────────────────────

console.log('\n[1] THE THRESHOLD IS BORROWED, NOT INVENTED');
{
  // A SECOND THRESHOLD WOULD LET A CHART APPEAR WHILE THE WORDS BESIDE IT STILL
  // SAID "your Journal is building". The data-state schedule already answers
  // "when may the app claim a direction".
  ok('the trend threshold IS the data-state schedule\'s own number',
    MIN_POINTS_FOR_A_TREND === TREND_MIN_WEEKS,
    { MIN_POINTS_FOR_A_TREND, TREND_MIN_WEEKS });
}

// ─── [2] Never one floating dot — enforced in the DERIVATION ─────────────

console.log('\n[2] SAM\'S GUARD LIVES WHERE IT CANNOT BE FORGOTTEN');
{
  const oneWeek = buildJournalMonth({
    weeks: [week(WEEKS[0], 300)],
    strengthSeries: EMPTY_SERIES,
  });
  ok('a single week yields NO conditioning series — not a one-dot chart',
    oneWeek.conditioningSeries === null, oneWeek.conditioningSeries);
  ok('and it reports the building state', oneWeek.building === true);

  const justUnder = buildJournalMonth({
    weeks: WEEKS.slice(0, MIN_POINTS_FOR_A_TREND - 1).map((w) => week(w, 300)),
    strengthSeries: EMPTY_SERIES,
  });
  ok('one point short of the threshold still yields nothing',
    justUnder.conditioningSeries === null, justUnder.conditioningSeries?.length);

  const exactly = buildJournalMonth({
    weeks: WEEKS.slice(0, MIN_POINTS_FOR_A_TREND).map((w) => week(w, 300)),
    strengthSeries: EMPTY_SERIES,
  });
  ok('at the threshold the series appears',
    exactly.conditioningSeries?.length === MIN_POINTS_FOR_A_TREND,
    exactly.conditioningSeries?.length);
  ok('and the building state clears', exactly.building === false);

  // THE SAME GUARD FOR STRENGTH, asserted separately because a shared helper
  // could be applied to one and not the other.
  const shortLift = buildJournalMonth({
    weeks: [], strengthSeries: series('Back Squat', [100, 105]),
  });
  ok('a lift with too little history gets no chart either',
    shortLift.strengthSeries.size === 0, Array.from(shortLift.strengthSeries.keys()));
}

// ─── [3] An absence is not a zero ────────────────────────────────────────

console.log('\n[3] AN UNTRAINED WEEK IS ABSENT, NOT ZERO');
{
  // Plotting a week the athlete did not condition at 0 draws a collapse that
  // never happened — the number is right and the picture is a lie.
  // SIX TRAINED WEEKS AND TWO BLANK ONES — the trained count must clear the
  // threshold on its own, or this cell would be measuring the guard from [2]
  // instead of the absent-is-not-zero rule it is about.
  const withGaps = buildJournalMonth({
    weeks: [
      week(WEEKS[0], 300), week(WEEKS[1], 0), week(WEEKS[2], 320),
      week(WEEKS[3], 0), week(WEEKS[4], 310), week(WEEKS[5], 330),
      week(WEEKS[6], 340), week(WEEKS[7], 350),
    ],
    strengthSeries: EMPTY_SERIES,
  });
  ok('weeks with no conditioning are excluded from the series',
    withGaps.conditioningSeries?.every((point) => point.value > 0) === true,
    withGaps.conditioningSeries);
  ok('and only the trained weeks are plotted — six, not eight',
    withGaps.conditioningSeries?.length === 6, withGaps.conditioningSeries?.length);
}

// ─── [4] Order and the satisfaction line ─────────────────────────────────

console.log('\n[4] OLDEST FIRST, AND THE GAIN IS FIRST-TO-LAST');
{
  const outOfOrder = buildJournalMonth({
    weeks: [week(WEEKS[3], 300), week(WEEKS[0], 100), week(WEEKS[1], 200),
      week(WEEKS[2], 250), week(WEEKS[4], 350), week(WEEKS[5], 400)],
    strengthSeries: EMPTY_SERIES,
  });
  ok('the series is oldest-first however the weeks arrive',
    outOfOrder.conditioningSeries?.map((p) => p.value).join(',') === '100,200,250,300,350,400',
    outOfOrder.conditioningSeries?.map((p) => p.value));

  const gained = buildJournalMonth({
    weeks: [], strengthSeries: series('Trap Bar Deadlift', [100, 102.5, 105, 110, 115, 112.5]),
  });
  ok('the gain is measured first point to last, not best to last',
    gained.gains[0]?.deltaKg === 12.5, gained.gains[0]);
  ok('and it names both ends so the sentence can say "since"',
    gained.gains[0]?.fromWeekStart === WEEKS[0]
    && gained.gains[0]?.toWeekStart === WEEKS[5], gained.gains[0]);

  // A GAIN NEEDS TWO POINTS, NOT SIX. It is a comparison of two recorded
  // weights rather than a claimed direction, so the chart threshold does not
  // bind it — a chart needs shape, a sentence needs only both ends.
  const twoPoints = buildJournalMonth({
    weeks: [], strengthSeries: series('Back Squat', [100, 110]),
  });
  ok('two points are enough for the sentence even with no chart',
    twoPoints.gains[0]?.deltaKg === 10 && twoPoints.strengthSeries.size === 0,
    twoPoints.gains[0]);

  // A LOSS IS REPORTED, NOT HIDDEN. A review that only speaks when the news is
  // good is a cheerleader, and the design excludes gamification by name.
  const lost = buildJournalMonth({
    weeks: [], strengthSeries: series('Bench Press', [100, 90]),
  });
  ok('a loss is reported honestly rather than dropped',
    lost.gains[0]?.deltaKg === -10, lost.gains[0]);

  ok('a lift that did not move produces no sentence at all',
    buildJournalMonth({ weeks: [], strengthSeries: series('Row', [100, 100]) })
      .gains.length === 0);
}

// ─── [4b] Consistency carries its denominator ────────────────────────────

console.log('\n[4b] CONSISTENCY — a percentage without its evidence is a claim');
{
  const work = (weekStart: string, planned: number, full: number, partial = 0) =>
    ({ weekStart, sessionsPlanned: planned, completedFull: full, completedPartial: partial });

  const consistent = buildJournalMonth({
    weeks: [], strengthSeries: EMPTY_SERIES,
    work: [work(WEEKS[0], 5, 4), work(WEEKS[1], 5, 5)],
  }).consistency;
  ok('the rate is done over planned across the counted weeks',
    consistent?.sessionsDone === 9 && consistent?.sessionsPlanned === 10
    && consistent?.rate === 0.9, consistent);
  ok('and it says how many weeks it counted, so the number cannot overclaim',
    consistent?.weeksCounted === 2, consistent);

  // PARTIALS COUNT AS DONE — the same ruling `DidTheWorkHappen` already applies
  // one screen up. A second answer to "did that session happen" would be the
  // two-owners defect at a different time scale.
  ok('a partial session counts as done, exactly as the weekly section counts it',
    buildJournalMonth({
      weeks: [], strengthSeries: EMPTY_SERIES, work: [work(WEEKS[0], 4, 2, 2)],
    }).consistency?.rate === 1);

  // A WEEK THE ATHLETE HAD NO PLAN IN IS NOT A WEEK THEY MISSED. Counting it
  // would drag the rate down for a bye or a pre-onboarding week, and `weeksCounted`
  // would overclaim how much month the number speaks for. No other fixture mixes
  // a planned week with an unplanned one, which is exactly why a mutation
  // deleting this filter survived the first pass.
  const mixed = buildJournalMonth({
    weeks: [], strengthSeries: EMPTY_SERIES,
    work: [work(WEEKS[0], 5, 5), work(WEEKS[1], 0, 0)],
  }).consistency;
  ok('a week with no plan is excluded, not counted as a missed one',
    mixed?.weeksCounted === 1 && mixed?.sessionsPlanned === 5 && mixed?.rate === 1,
    mixed);

  // A RATE OVER NOTHING IS 0%, WHICH READS AS TOTAL FAILURE to an athlete who
  // simply has no history. Null is the honest answer.
  ok('no planned sessions yields NULL, never 0%',
    buildJournalMonth({
      weeks: [], strengthSeries: EMPTY_SERIES, work: [work(WEEKS[0], 0, 0)],
    }).consistency === null);
  ok('and no work data at all yields null too',
    buildJournalMonth({ weeks: [], strengthSeries: EMPTY_SERIES }).consistency === null);

  // THE BUILDING STATE MUST NOT LIE ABOUT A PRESENCE. A month with a real
  // consistency figure and no chart yet is not empty.
  ok('a month with consistency but no chart is NOT "still building"',
    buildJournalMonth({
      weeks: [], strengthSeries: EMPTY_SERIES, work: [work(WEEKS[0], 5, 5)],
    }).building === false);
  ok('and a month with nothing at all still is',
    buildJournalMonth({ weeks: [], strengthSeries: EMPTY_SERIES }).building === true);

  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the surface shows the COUNT beside the percentage, not the percentage alone',
    /journal-month-consistency/.test(screen)
    && /sessionsDone\}/.test(screen) && /sessionsPlanned\}/.test(screen));
}

// ─── [4d] The month in flags ─────────────────────────────────────────────

console.log('\n[4d] FLAGS — counts of what was SAID, never a trend word');
{
  const flag = (weekStart: string, soreness: number, differed: number, games: number) =>
    ({ weekStart, sorenessRecorded: soreness, differedFromPlan: differed, gameFeelsRecorded: games });

  const flags = buildJournalMonth({
    weeks: [], strengthSeries: EMPTY_SERIES,
    flags: [flag(WEEKS[0], 2, 1, 1), flag(WEEKS[1], 1, 0, 1)],
  }).flags;
  ok('the flags are summed across the weeks',
    flags?.sorenessRecorded === 3 && flags?.sessionsThatDiffered === 1
    && flags?.gamesRated === 2, flags);
  ok('and it says how many weeks it counted',
    flags?.weeksCounted === 2, flags);

  // A ROW OF ZEROES IS NOT A MONTH IN FLAGS. An athlete who answered nothing
  // should see the honest absence, not a report about a month that did not
  // happen.
  ok('a month where nothing was answered yields NULL, not a row of zeroes',
    buildJournalMonth({
      weeks: [], strengthSeries: EMPTY_SERIES, flags: [flag(WEEKS[0], 0, 0, 0)],
    }).flags === null);
  ok('and no flag data at all yields null too',
    buildJournalMonth({ weeks: [], strengthSeries: EMPTY_SERIES }).flags === null);

  ok('a month with flags but no chart is NOT "still building"',
    buildJournalMonth({
      weeks: [], strengthSeries: EMPTY_SERIES, flags: [flag(WEEKS[0], 1, 0, 0)],
    }).building === false);

  // NO TREND WORD ANYWHERE. The design calls this a trend; the app can only
  // honestly count. A direction claimed from a count is the diagnosis the load
  // ruling forbids.
  const source = readFileSync(join(__dirname, '..', 'rules', 'journalMonth.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('the module claims no direction about the flags',
    !/rising|falling|worsening|improving|trending/i.test(code),
    code.match(/rising|falling|worsening|improving|trending/gi));

  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the flags line is rendered', /testID="journal-month-flags"/.test(screen));
}

// ─── [4c] The balance picture ships because it waits on nothing ──────────

console.log('\n[4c] THE BALANCE PICTURE — signed provenance, so it renders');
{
  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the screen source was read', screen.length > 4000, screen.length);

  // LOAD-RULING LAYER 4, AND IT CAN SHIP WHERE THE CONTINUUM CANNOT.
  // `patternSharesDone` is derived from NO constant, so it carries SIGNED
  // provenance; the plan-vs-done VERDICT is the half that waits on Sam's
  // threshold. What the athlete DID is a measurement, not a judgement.
  ok('the balance line is rendered', /testID="journal-month-balance"/.test(screen));
  ok('and it is read through `signedValue`, like every other derived value',
    /signedValue\(loadModel\.patternSharesDone\)/.test(screen));

  // IT MUST NOT READ `.value` AROUND THE DOOR — the mechanism the load slice
  // built exists precisely so a new surface cannot bypass it.
  const start = screen.indexOf('function MonthlyReview');
  const end = screen.indexOf('\n/**', start);
  const region = screen.slice(start, end);
  ok('the monthly region was located and is substantial',
    start > 0 && end > start && region.length > 400, region.length);
  ok('the monthly section never reads `.value` off a derived value',
    !/\bloadModel\.[A-Za-z]+\.value\b/.test(region), region.match(/\.value\b/g));
}

// ─── [5] A flat series is not a collapse ─────────────────────────────────

console.log('\n[5] THE CHART\'S GEOMETRY');
{
  const chart = readFileSync(
    join(__dirname, '..', 'components', 'journal', 'TrendChart.tsx'), 'utf8');
  ok('the chart source was read', chart.length > 2000, chart.length);
  const code = chart.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // WITH EVERY VALUE IDENTICAL THE RANGE IS ZERO. The naive scale divides by it
  // and puts the line on the floor, which reads as "you collapsed" to an athlete
  // who was perfectly consistent.
  ok('a zero range is handled explicitly rather than divided by',
    /range === 0/.test(code), code.match(/range[^\n]*/g));
  ok('and the flat case sits mid-height, not at the bottom',
    /height \/ 2/.test(code));

  // SVG Y GROWS DOWNWARD. Without the flip a heavier lift would be drawn LOWER,
  // which inverts the whole story the chart tells.
  ok('the y axis is flipped so a bigger value sits higher',
    /height - \(\(value - min\) \/ range\)/.test(code));

  ok('it draws with the PROVEN library, not an unimported one',
    /from 'react-native-svg'/.test(code)
    && !/victory-native|react-native-skia/.test(code));
}

// ─── [6] No chart walls ──────────────────────────────────────────────────

console.log('\n[6] NO CHART WALLS');
{
  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the screen source was read', screen.length > 4000, screen.length);

  const start = screen.indexOf('function MonthlyReview');
  const end = screen.indexOf('\n/**', start);
  ok('the monthly section was located', start > 0 && end > start, { start, end });
  const region = screen.slice(start, end);
  ok('and the located region is substantial', region.length > 400, region.length);

  // AT MOST TWO CHARTS. Building one per available series is the easy failure
  // Sam's guard names, and the data for five of them is already sitting there.
  const charts = region.match(/<TrendChart\b/g) ?? [];
  ok('the monthly section renders AT MOST two charts', charts.length <= 2, charts.length);

  // ONE LIFT, NOT ALL OF THEM.
  ok('only one lift is charted, chosen deterministically',
    /sort\(\(a, b\) => b\[1\]\.length - a\[1\]\.length \|\| a\[0\]\.localeCompare\(b\[0\]\)\)/
      .test(region));

  ok('the building state is rendered rather than an empty box',
    /testID="journal-month-building"/.test(screen));

  // THE WEEKLY SECTIONS STAY WORDS. Sam: "anything on the weekly card stays a
  // line of words, not a graph."
  //
  // ASSERTED BY CONTAINMENT, NOT BY A LINE RANGE. The first version of this cell
  // sliced from `LoadSection` to the note marker and failed — because
  // `MonthlyReview` is DEFINED inside that span. A source range is about where
  // code sits in a file; the claim is about which component draws. Every
  // `<TrendChart` must lie inside the monthly region and nowhere else.
  const chartAt: number[] = [];
  for (let i = screen.indexOf('<TrendChart'); i !== -1; i = screen.indexOf('<TrendChart', i + 1)) {
    chartAt.push(i);
  }
  ok('every chart in the app sits inside the monthly section',
    chartAt.length > 0 && chartAt.every((at) => at > start && at < end),
    { chartAt, start, end });
}

// ─── [7] C5 — the month WORD, never the ISO date ─────────────────────────
//
// SAM'S DECISION C5, 2026-08-09: '"since {date}" renders the MONTH WORD ("since
// March") — the closed-twelve month table already exists on the screen; no
// locale dependence.'
//
// HIS PREMISE WAS ONE WORD OFF AND CHECKING IT WAS THE WORK. A closed twelve did
// exist on the screen — but it held `Mar`, not `March`, so "the table already
// exists" was true of the mechanism and false of the word. The fix is one table
// of full words with the abbreviations DERIVED from it, rather than a second
// literal twelve that agrees until somebody edits one.
//
// THESE ARE SOURCE CELLS AND THAT IS A REAL LIMIT, STATED. `monthWordSince`
// lives in a `.tsx` that cannot be imported by a node test, and moving it to
// `rules/` would take athlete-visible words out of the copy gates' scope —
// which is `a green gate watching nothing`, already paid for three times in
// this unit. So the words are checked where they are authored, by parsing the
// table out of the source and computing over it.

console.log('\n[7] C5 — THE MONTH WORD (Sam 2026-08-09)');
{
  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('the stripped screen source is substantial', code.length > 4000, code.length);

  // ── The table, parsed rather than assumed ──
  const wordsBlock = /const MONTH_WORDS = \[([\s\S]*?)\] as const;/.exec(code);
  ok('the MONTH_WORDS table was located in code, not in a comment',
    wordsBlock !== null, wordsBlock?.[1]);
  const words = (wordsBlock?.[1] ?? '').match(/'([A-Za-z]+)'/g)?.map((q) => q.slice(1, -1)) ?? [];

  const EXPECTED_WORDS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  ok('it is a CLOSED TWELVE, in calendar order, spelled in full',
    JSON.stringify(words) === JSON.stringify(EXPECTED_WORDS), words);

  // ── The abbreviations are DERIVED, and the week label provably did not move ──
  //
  // THIS IS THE CELL THAT MAKES THE REFACTOR SAFE. Batch 26 shipped the week
  // label as "3 – 9 Aug" off a literal twelve; that literal is gone, so nothing
  // else would notice if the derivation produced "Augu" or "Au". The previous
  // table is written out here as the CONTRACT the derivation must reproduce.
  const PREVIOUS_ABBREVIATIONS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const lengthMatch = /const MONTH_ABBREVIATION_LENGTH = (\d+);/.exec(code);
  const abbreviationLength = Number(lengthMatch?.[1] ?? NaN);
  ok('the abbreviation length is declared, not inlined at the call',
    abbreviationLength === 3, lengthMatch?.[1]);
  ok('and the DERIVED abbreviations are exactly the twelve batch 26 shipped',
    JSON.stringify(words.map((w) => w.slice(0, abbreviationLength)))
      === JSON.stringify(PREVIOUS_ABBREVIATIONS),
    words.map((w) => w.slice(0, abbreviationLength)));
  ok('the abbreviations are derived from the words, not a second literal twelve',
    /MONTH_ABBREVIATIONS = MONTH_WORDS/.test(code)
    && !/'Jan',\s*'Feb'/.test(code),
    code.match(/'Jan'[^\n]*/g));

  // ── No ISO date reaches the athlete through the gain sentence ──
  //
  // THE DEFECT C5 FIXES, ASSERTED AS AN ABSENCE. `${gain.fromWeekStart}` put
  // "2026-04-06" in the one line an athlete reads without opening anything, and
  // a comment three lines above claimed it read "since 6 Apr" — the claim and
  // the code disagreed for a whole slice, which is why the absence is gated now
  // rather than trusted to a reviewer's eye.
  ok('no sentence interpolates the raw week-start date any more',
    !/\$\{gain\.fromWeekStart\}/.test(code),
    code.match(/\$\{gain\.fromWeekStart\}[^\n]*/g));

  const sinceCalls = code.match(/monthWordSince\s*\(/g) ?? [];
  ok('both gain sentences go through `monthWordSince` — the drawer row and the review',
    sinceCalls.length === 3, sinceCalls.length);

  // ── The year rider, and the anchor it uses ──
  ok('the year is spoken only when the month is not in the viewed week\'s year',
    /getUTCFullYear\(\) === viewed\.getUTCFullYear\(\)/.test(code));
  ok('and "this year" is the VIEWED WEEK, never the device clock',
    !/new Date\(\)/.test(code), code.match(/new Date\(\)[^\n]*/g));

  // ── An unsayable month drops the line rather than falling back to the ISO ──
  ok('an unparseable date returns null instead of the raw string',
    /if \(Number\.isNaN\(from\.getTime\(\)\) \|\| Number\.isNaN\(viewed\.getTime\(\)\)\) return null;/
      .test(code));
  ok('and the review DROPS a gain it cannot date, rather than printing the ISO',
    /if \(since === null\) return null;/.test(code));
}

console.log(`\njournalMonthTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure derivation plus SOURCE reads of '
  + 'the chart and the screen. NOTHING HERE RENDERS AN SVG: no cell mounts a component, so '
  + 'the geometry is argued from the scaling code rather than measured from a drawn frame.');
console.log('  NOT COVERED, and it matters more here than anywhere else in this unit: '
  + 'A CHART IS THE FIRST THING WHOSE DEFECTS ARE MOSTLY VISUAL. Line weight, how 6-12 '
  + 'points read at 64px tall, whether the last-point dot is visible, and whether two '
  + 'charts stacked feel like a wall are ALL unverified — Sam\'s eye is the instrument for '
  + 'this slice. The load-continuum chart (ruling layer 5) is NOT built: it is downstream '
  + 'of the unsigned band constants and would be dark anyway.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
