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
  completedLoadAU: conditioningSRPE,
  sessionsMeasured: 1,
  sessionsRecorded: 1,
  liftsUnmeasured: 0,
  regions: {},
  patternTonnageKg: { squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0, push: 0, pull: 0 },
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

}

console.log(`\njournalMonthTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure monthly derivation. No cell '
  + 'mounts a component or walks an athlete.');
console.log('  NOT COVERED: no current screen consumes this model; the retired Journal UI '
  + 'is gone and the Coach dashboard is not built yet. Visual chart behaviour is therefore '
  + 'not claimed or tested here.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
