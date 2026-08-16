/**
 * ANCHOR SURVIVAL — the game and every club night must reach the built week.
 *
 *   npm run test:anchor-survival
 *
 * **Sam, 2026-08-15:** *"The scheduler's output is the COMPLETE seven-day week.
 * Game and club training are first-class scheduler-owned anchors—not specialist
 * content and not optional adapter additions."*
 *
 * ## THESE CELLS WERE WRITTEN TO BE RED
 *
 * They were authored while the pipeline was known broken, and they are the
 * specification of the fix rather than a description of today's behaviour. A
 * guard written after the fact tends to describe whatever the code already does;
 * these were written first, on purpose.
 *
 * ## THEY TEST THE OWNERSHIP CLASS, NEVER A WEEKDAY
 *
 * The mission forbids patching *"Tuesday, Thursday, Saturday, 'Team Training',
 * 'Game' or 'Rest' by name"*. So every cell below reads a TYPED property — the
 * anchor flags the scheduler set and the workout type the app assigns — and the
 * weekdays are inputs to a fixture, never constants a cell asserts against by
 * name. Change the athlete's club nights and the same cells still hold.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../services/api/generateProgram');

/**
 * THE ANCHOR WORLD. Club nights and the fixture are deliberately NOT the app's
 * historical defaults — a cell that only passes for Tue/Thu/Sat is testing a
 * template, not an ownership rule.
 */
const CLUB_DAY_NAMES = ['Wednesday', 'Friday'] as const;
// **MOVED Sunday -> Monday on 2026-08-16, and the reason matters.** With a
// recurring SUNDAY fixture this athlete's Monday is G+1 and Saturday is G-1, so
// only Wednesday and Friday stay legal — and Friday is G-2, which may not hold a
// Full Body session. That world now returns a TYPED REFUSAL, correctly. Anchors
// are this suite's subject, so it needs a world that BUILDS; the G-2 refusal is
// asserted deliberately in `test:cyclic-proximity` instead of silently
// disabling nine anchor cells here.
//
// Still NOT the app's historical defaults: club stays Wednesday/Friday.
const GAME_DAY_NAME = 'Monday' as const;
const DAY_NUMBER: Readonly<Record<string, number>> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
const CLUB_DAYS = CLUB_DAY_NAMES.map((name) => DAY_NUMBER[name]);
const GAME_DAY = DAY_NUMBER[GAME_DAY_NAME];

function buildAnchorWeek(): { workouts: any[]; refusal: string | null } {
  try {
    const program = generateProgramLocally({
      trainingLocation: 'Commercial gym',
      equipmentSelectionCompleteness: 'complete',
      recentTrainingLoad: 'Pretty consistent',
      conditioningLevel: 'Average',
      seasonPhase: 'In-season',
      gameDay: GAME_DAY_NAME,
      trainingDaysPerWeek: 4,
      // Gym access DELIBERATELY overlaps both club nights, so the same-day
      // gym + club case is exercised rather than assumed away.
      preferredTrainingDays: ['Wednesday', 'Thursday', 'Friday', 'Saturday'],
      equipment: ['Full Gym'],
      teamTrainingDays: [...CLUB_DAY_NAMES],
    } as never, {
      todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
    } as never);
    return { workouts: program?.microcycles?.[0]?.workouts ?? [], refusal: null };
  } catch (error: any) {
    return { workouts: [], refusal: String(error?.message ?? error) };
  }
}

const week = buildAnchorWeek();
const dayOf = (n: number) => week.workouts.find((w: any) => w.dayOfWeek === n);
const typeOf = (n: number) => String(dayOf(n)?.workoutType ?? '(absent)');

console.log('\n[0] The week builds at all — non-vacuity before every verdict');
ok('the anchor world produces a week', week.workouts.length > 0,
  week.refusal ?? 'no workouts and no refusal');

console.log('\n[1] The game survives as a Game');
{
  // TYPED: the app's own fixture type, not the string "Saturday".
  ok('the fixture day carries the app\'s GAME workout type',
    typeOf(GAME_DAY) === 'Game',
    `${GAME_DAY_NAME} is "${typeOf(GAME_DAY)}"`);
  ok('the fixture day is present in the week at all',
    dayOf(GAME_DAY) !== undefined,
    JSON.stringify(week.workouts.map((w: any) => [w.dayOfWeek, w.workoutType])));
}

console.log('\n[2] Every club night survives as Team Training');
{
  // ⚠ These were originally written as `type === 'Team Training' || isTeamDay`,
  // and the OR made them USELESS: `isTeamDay` is set by a path that pre-dates
  // this work, so removing the assembler's anchor defence — which is what
  // actually stops a club night being retyped once gym work is merged onto it —
  // left all four cells green. **A hedge in an assertion is a hole in it.** The
  // two facts are asserted separately, so each has something that can kill it.
  for (const name of CLUB_DAY_NAMES) {
    const day = DAY_NUMBER[name];
    ok(`club night ${name} carries the TEAM TRAINING type`,
      typeOf(day) === 'Team Training',
      `${name} is "${typeOf(day)}"`);
    ok(`club night ${name} declares itself a team day`,
      dayOf(day)?.isTeamDay === true,
      `${name} isTeamDay=${String(dayOf(day)?.isTeamDay)}`);
  }
  ok('every club night the athlete declared is present',
    CLUB_DAYS.every((day) => dayOf(day) !== undefined),
    JSON.stringify(CLUB_DAYS.map((d) => [d, typeOf(d)])));
}

console.log('\n[3] A same-day gym + club combination preserves BOTH components');
{
  // The athlete's gym access overlaps both club nights, so at least one day must
  // hold club training AND app strength content.
  const combined = week.workouts.filter((w: any) =>
    CLUB_DAYS.includes(w.dayOfWeek)
    && (w.exercises ?? []).some((row: any) =>
      row.section18Evidence?.role === 'main_strength'
      || row.section18Evidence?.role === 'strength_accessory'));
  ok('at least one club night also carries app strength content',
    combined.length > 0,
    JSON.stringify(CLUB_DAYS.map((d) => [d, typeOf(d), (dayOf(d)?.exercises ?? []).length])));
  ok('...and that day still declares itself a team day',
    combined.every((w: any) => w.isTeamDay === true || String(w.workoutType).includes('Team')),
    JSON.stringify(combined.map((w: any) => [w.dayOfWeek, w.workoutType, w.isTeamDay])));
}

console.log('\n[4] No anchor is ever converted to Rest');
{
  const anchorsAsRest = [...CLUB_DAYS, GAME_DAY]
    .filter((day) => /rest/i.test(typeOf(day)));
  ok('no club night and no fixture day is a Rest day',
    anchorsAsRest.length === 0,
    `converted to Rest: ${JSON.stringify(anchorsAsRest.map((d) => [d, typeOf(d)]))}`);
}

console.log('\n[5] No anchor is replaced by app conditioning');
{
  const anchorsAsConditioning = [...CLUB_DAYS, GAME_DAY]
    .filter((day) => /conditioning|sprint-intervals/i.test(typeOf(day)));
  ok('no anchor day has been overwritten by an app conditioning session',
    anchorsAsConditioning.length === 0,
    `overwritten: ${JSON.stringify(anchorsAsConditioning.map((d) => [d, typeOf(d)]))}`);
}

const total = passed + failures.length;
console.log(`\nAnchor survival: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
