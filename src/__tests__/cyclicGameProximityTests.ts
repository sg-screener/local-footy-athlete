/**
 * GAME PROXIMITY IS CYCLIC — the week is a printing convention, not a reset.
 *
 *   npm run test:cyclic-proximity
 *
 * **Sam, 2026-08-16:** *"A recurring Sunday game makes Monday G+1 from the
 * PREVIOUS fixture."*
 *
 * ## THE DEFECT
 *
 * Proximity was `orderIndex(day) - orderIndex(gameDay)` inside one Monday→Sunday
 * array, so a **Sunday** fixture made Monday `-6` — six days *before* the game,
 * wide open — when Monday is one day AFTER last Sunday's game. Lower plus 30–50
 * minutes of conditioning went onto G+1, which WC-050 reserves for rest or
 * recovery. **For a Sunday fixture the G+1 rule was unreachable entirely.**
 *
 * ## WHY EVERY WEEKDAY, NOT JUST SUNDAY
 *
 * Only a fixture at an END of the array is affected, so a suite fixed on a
 * mid-week game cannot see it. The whole matrix is walked, and the cells that
 * would have been red before the fix are exactly the ones at the boundary — which
 * is the point: **a rule that only works in the middle of an array is not a rule
 * about the athlete's week.**
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  gameProximity, scheduleWeek, type WeeklySchedulerInputs,
} from '../rules/weeklyScheduler';
import { PURPOSE_IS_LOWER } from '../rules/weeklyProgrammingContract';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];

function inputsFor(gameDay: number, over: Partial<WeeklySchedulerInputs> = {}) {
  return {
    weekStartISO: '2026-07-13',
    phase: 'In-season',
    offseasonBlock: null,
    // Every day reachable, so a day left empty was a RULE's doing and not an
    // availability accident — the distinction the old fixture could not make.
    gymAccessDays: [0, 1, 2, 3, 4, 5, 6],
    clubNights: [],
    gameDay,
    fixtureRecurrence: 'recurring',
    age: 24,
    readiness: {
      lowReadiness: false, highReadiness: false,
      lowFatigue: false, consistentlyCompletesThree: false,
    },
    unavailableDays: [],
    ...over,
  } as WeeklySchedulerInputs;
}

console.log('\n[1] The proximity function itself, on all 7x7 day/game pairs');
{
  for (let game = 0; game < 7; game += 1) {
    for (let day = 0; day < 7; day += 1) {
      const p = gameProximity(day, game, 'recurring');
      // Recurring: both directions always exist and always sum to 7 (or are 0,0
      // on the game day). A linear index cannot satisfy this.
      const sane = day === game
        ? p.daysSincePreviousGame === 0 && p.daysUntilNextGame === 0
        : (p.daysSincePreviousGame ?? -1) + (p.daysUntilNextGame ?? -1) === 7;
      ok(`recurring ${WEEKDAY[game]} game: ${WEEKDAY[day]} has a coherent offset`,
        sane, `since=${p.daysSincePreviousGame} until=${p.daysUntilNextGame}`);
    }
  }
  // THE HEADLINE CASE, named so a regression is unmistakable.
  const mondayAfterSunday = gameProximity(1, 0, 'recurring');
  ok('a recurring SUNDAY game makes MONDAY G+1, not G-6',
    mondayAfterSunday.daysSincePreviousGame === 1,
    JSON.stringify(mondayAfterSunday));
  const sundayBeforeMonday = gameProximity(0, 1, 'recurring');
  ok('a recurring MONDAY game makes SUNDAY G-1, across the boundary',
    sundayBeforeMonday.daysUntilNextGame === 1,
    JSON.stringify(sundayBeforeMonday));
}

console.log('\n[2] A first fixture has NO previous game — and says so');
{
  // Sunday game, Monday earlier in the array: with no prior fixture there is
  // genuinely nothing behind Monday.
  const first = gameProximity(1, 0, 'first_fixture_no_previous');
  ok('first fixture: Monday before a Sunday game has NO previous game',
    first.daysSincePreviousGame === null,
    JSON.stringify(first));
  ok('first fixture: Monday still counts down to that Sunday',
    first.daysUntilNextGame === 6, JSON.stringify(first));
  // A day AFTER the game inside the same week has a previous game either way.
  const after = gameProximity(2, 1, 'first_fixture_no_previous');
  ok('first fixture: the day after an in-week game is still G+1',
    after.daysSincePreviousGame === 1, JSON.stringify(after));
  ok('null means NO SUCH FIXTURE, never "far away"',
    gameProximity(1, null, 'recurring').daysSincePreviousGame === null);
}

console.log('\n[3] Every usual game weekday: nothing heavy on G+1 or G-1');
{
  let scheduled = 0;
  for (let game = 0; game < 7; game += 1) {
    const result: any = scheduleWeek(inputsFor(game));
    if (result?.refused) {
      console.error(`  (refused, ${WEEKDAY[game]} game: ${result.finding})`);
      continue;
    }
    scheduled += 1;
    const gPlusOne = (game + 1) % 7;
    const gMinusOne = (game + 6) % 7;
    const gMinusTwo = (game + 5) % 7;
    const dayOf = (n: number) => result.days.find((d: any) => d.dayOfWeek === n);

    ok(`${WEEKDAY[game]} game: G+1 (${WEEKDAY[gPlusOne]}) holds no strength`,
      dayOf(gPlusOne)?.owner !== 'strength',
      `owner=${dayOf(gPlusOne)?.owner} purpose=${dayOf(gPlusOne)?.purpose}`);
    ok(`${WEEKDAY[game]} game: G+1 (${WEEKDAY[gPlusOne]}) holds no app conditioning`,
      dayOf(gPlusOne)?.conditioning === null,
      `conditioning=${dayOf(gPlusOne)?.conditioning}`);
    ok(`${WEEKDAY[game]} game: G-1 (${WEEKDAY[gMinusOne]}) holds no strength`,
      dayOf(gMinusOne)?.owner !== 'strength',
      `owner=${dayOf(gMinusOne)?.owner} purpose=${dayOf(gMinusOne)?.purpose}`);

    const gMinusTwoDay = dayOf(gMinusTwo);
    ok(`${WEEKDAY[game]} game: G-2 (${WEEKDAY[gMinusTwo]}) carries no LOWER purpose`,
      !gMinusTwoDay?.purpose || !PURPOSE_IS_LOWER[gMinusTwoDay.purpose as never],
      `purpose=${gMinusTwoDay?.purpose}`);
    ok(`${WEEKDAY[game]} game: G-2 (${WEEKDAY[gMinusTwo]}) offers no lower-body power`,
      !(gMinusTwoDay?.powerEligible
        && gMinusTwoDay?.purpose
        && PURPOSE_IS_LOWER[gMinusTwoDay.purpose as never]),
      `powerEligible=${gMinusTwoDay?.powerEligible} purpose=${gMinusTwoDay?.purpose}`);
  }
  ok('all seven game weekdays produced a schedule to judge', scheduled === 7,
    `only ${scheduled}/7 scheduled`);
}

console.log('\n[4] The Sunday world specifically — the reported defect');
{
  const result: any = scheduleWeek(inputsFor(0));
  ok('Sunday-game world schedules', !result?.refused, result?.finding);
  if (!result?.refused) {
    const monday = result.days.find((d: any) => d.dayOfWeek === 1);
    ok('Sunday game: MONDAY is not a strength day',
      monday?.owner !== 'strength', `owner=${monday?.owner} purpose=${monday?.purpose}`);
    ok('Sunday game: MONDAY carries no conditioning',
      monday?.conditioning === null, `conditioning=${monday?.conditioning}`);
    console.log(`      Sunday-game week: ${result.days
      .map((d: any) => `${WEEKDAY[d.dayOfWeek]}=${d.purpose ?? d.owner}`).join(' ')}`);
  }
}

console.log('\n[5] Off-leg is the SCHEDULER\'s request, not the specialist\'s idea');
{
  // Sam, 2026-08-16: "The scheduler must explicitly request off-leg conditioning
  // when pairing conditioning with Lower. The specialist may choose bike/row/ski,
  // but must not invent the off-leg requirement itself."
  let lowerPairs = 0;
  let upperPairs = 0;
  for (let game = 0; game < 7; game += 1) {
    const result: any = scheduleWeek(inputsFor(game));
    if (result?.refused) continue;
    for (const day of result.days) {
      if (day.owner !== 'strength' || day.conditioning === null) continue;
      if (PURPOSE_IS_LOWER[day.purpose as never]) {
        lowerPairs += 1;
        ok(`${WEEKDAY[game]} game: LOWER + conditioning on ${WEEKDAY[day.dayOfWeek]}`
          + ' is typed off_leg by the scheduler',
          day.conditioning === 'off_leg',
          `conditioning=${day.conditioning} purpose=${day.purpose}`);
      } else {
        upperPairs += 1;
        // The negative arm: if off_leg were applied blanket-fashion the intent
        // would carry no information at all.
        ok(`${WEEKDAY[game]} game: UPPER + conditioning on ${WEEKDAY[day.dayOfWeek]}`
          + ' is NOT off_leg',
          day.conditioning !== 'off_leg',
          `conditioning=${day.conditioning} purpose=${day.purpose}`);
      }
    }
  }
  ok('the off-leg intent was exercised on real lower pairings', lowerPairs > 0,
    `lower pairings seen: ${lowerPairs}`);
  ok('...and contrasted against real upper pairings', upperPairs > 0,
    `upper pairings seen: ${upperPairs}`);
}

const total = passed + failures.length;
console.log(`\nCyclic game proximity: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
