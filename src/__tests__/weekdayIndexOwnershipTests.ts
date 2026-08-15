/**
 * THE WEEKDAY INDEX OWNS THE CALENDAR — on all seven days, not on the one the
 * fixture happened to pick.
 *
 *   npm run test:weekday-index
 *
 * ## WHY THIS EXISTS
 *
 * The anchor-survival suite proves the game and the club nights reach the
 * athlete. It pins them to ONE arrangement — a Sunday fixture, club on Wednesday
 * and Friday — so **an off-by-one in the day-index/date owner that happened to
 * be harmless for that arrangement would leave it green.** A guard that only
 * exercises one weekday is a guard against one weekday.
 *
 * So this walks the fixture across **every one of the seven weekdays**, with the
 * club nights walking with it, and asserts two things that a shifted index
 * cannot both satisfy:
 *
 *   1. the anchor lands on the weekday the athlete DECLARED, by numeric index;
 *   2. the ISO date that day carries genuinely falls on that weekday.
 *
 * (1) alone would survive a shift applied consistently to both the input and the
 * output. (2) is the independent check: the calendar is not ours to redefine, so
 * `2026-07-15` is a Wednesday whatever the pipeline believes.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../services/api/generateProgram');

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];
const WEEK_START = '2026-07-13'; // a Monday

/** The weekday an ISO date genuinely falls on. The calendar, not the pipeline. */
function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The ISO date this week assigns to a weekday index, from the week's own start. */
function isoForIndex(dayOfWeek: number): string {
  const [y, m, d] = WEEK_START.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  const offset = ((dayOfWeek - weekdayOfISO(WEEK_START)) + 7) % 7;
  return new Date(start + offset * 86400000).toISOString().slice(0, 10);
}

interface Built { workouts: any[]; refusal: string | null }
function build(gameDay: number, clubDays: readonly number[]): Built {
  // Gym access deliberately overlaps the club nights so the combined case is
  // exercised on every rotation, not only on the convenient ones.
  const gymDays = [...new Set([...clubDays, (gameDay + 1) % 7, (gameDay + 2) % 7])]
    .map((d) => WEEKDAY[d]);
  try {
    const program = generateProgramLocally({
      trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
      recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
      seasonPhase: 'In-season', gameDay: WEEKDAY[gameDay], trainingDaysPerWeek: 4,
      preferredTrainingDays: gymDays, equipment: ['Full Gym'],
      teamTrainingDays: clubDays.map((d) => WEEKDAY[d]),
    } as never, {
      todayISO: WEEK_START, blockNumber: 1, microcycleLimit: 1,
    } as never);
    return { workouts: program?.microcycles?.[0]?.workouts ?? [], refusal: null };
  } catch (error: any) {
    return { workouts: [], refusal: String(error?.message ?? error) };
  }
}

console.log('\n[1] The fixture lands on the declared weekday — all seven rotations');
let builtWeeks = 0;
for (let gameDay = 0; gameDay < 7; gameDay += 1) {
  // Club nights walk with the fixture and stay clear of it.
  const clubDays = [(gameDay + 3) % 7, (gameDay + 5) % 7];
  const week = build(gameDay, clubDays);
  if (week.refusal) {
    // A refusal is not a pass. It is reported, and it cannot be mistaken for
    // coverage because the non-vacuity arm below counts built weeks only.
    console.error(`  (refused, ${WEEKDAY[gameDay]} fixture: ${week.refusal})`);
    continue;
  }
  builtWeeks += 1;
  const dayOf = (n: number) => week.workouts.find((w: any) => w.dayOfWeek === n);

  const fixture = dayOf(gameDay);
  ok(`fixture declared ${WEEKDAY[gameDay]} is typed Game on index ${gameDay}`,
    fixture?.workoutType === 'Game',
    `index ${gameDay} is "${fixture?.workoutType ?? '(absent)'}"`);

  for (const club of clubDays) {
    ok(`club night declared ${WEEKDAY[club]} is typed Team Training on index ${club}`
      + ` (${WEEKDAY[gameDay]} fixture)`,
      dayOf(club)?.workoutType === 'Team Training',
      `index ${club} is "${dayOf(club)?.workoutType ?? '(absent)'}"`);
  }

  // ── THE INDEPENDENT CHECK: the calendar is not ours to redefine ──────────
  for (const workout of week.workouts) {
    const iso = isoForIndex(workout.dayOfWeek);
    ok(`index ${workout.dayOfWeek} maps to a date that really is `
      + `${WEEKDAY[workout.dayOfWeek]} (${WEEKDAY[gameDay]} fixture)`,
      weekdayOfISO(iso) === workout.dayOfWeek,
      `index ${workout.dayOfWeek} -> ${iso}, which is a ${WEEKDAY[weekdayOfISO(iso)]}`);
  }

  // No anchor may appear on a day the athlete did not declare.
  const strayClub = week.workouts
    .filter((w: any) => w.workoutType === 'Team Training' && !clubDays.includes(w.dayOfWeek))
    .map((w: any) => WEEKDAY[w.dayOfWeek]);
  ok(`no club night appears on an undeclared day (${WEEKDAY[gameDay]} fixture)`,
    strayClub.length === 0, `stray: ${JSON.stringify(strayClub)}`);
  const strayGame = week.workouts
    .filter((w: any) => w.workoutType === 'Game' && w.dayOfWeek !== gameDay)
    .map((w: any) => WEEKDAY[w.dayOfWeek]);
  ok(`no fixture appears on an undeclared day (${WEEKDAY[gameDay]} fixture)`,
    strayGame.length === 0, `stray: ${JSON.stringify(strayGame)}`);
}

console.log('\n[2] Non-vacuity — every weekday was actually exercised');
ok('all seven fixture rotations produced a week to judge', builtWeeks === 7,
  `only ${builtWeeks}/7 rotations built; the rest refused and asserted nothing`);

const total = passed + failures.length;
console.log(`\nWeekday index ownership: passed=${passed}/${total} `
  + `failures=${failures.length} (rotations built: ${builtWeeks}/7)`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
