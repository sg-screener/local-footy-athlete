/**
 * R-227 REVISED — days before the athlete's start do not exist on Week view.
 *
 * Sam, later on 2026-08-26, replaced the earlier grey-card ruling: *"Hide any
 * sessions before you entered"* and *"sessions ... greyed out because you
 * sign up after that date should just be removed from weekly view entirely"*.
 *
 * One owner: `weekViewDaysFromAthleteStart`, using `dayPredatesProgram` beside
 * the navigation bounds. The normal Week list and Manage Week consume the same
 * filtered collection. Stored program content is not deleted.
 *
 * Run: npm run test:pre-program-days
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import {
  dayPredatesProgram,
  weekViewDaysFromAthleteStart,
} from '../utils/sessionResolver';

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

run('the audit case: Tuesday signup, Monday predates the program', () => {
  const program = { startDate: '2026-08-25T09:00:00.000Z' } as never;
  assert(dayPredatesProgram('2026-08-24', program) === true,
    'the Monday before a Tuesday start must be pre-program');
  assert(dayPredatesProgram('2026-08-25', program) === false,
    'the start day itself is IN the program');
  assert(dayPredatesProgram('2026-08-26', program) === false,
    'a later day is in the program');
});

run("the block's Monday is not the athlete's start — Sam's phone case", () => {
  // Measured 2026-08-26: program.startDate is the block's MONDAY, so a
  // Wednesday signup left Mon/Tue tappable and Tuesday raised a missed-
  // session ask on signup morning. The athlete's own start day (signup /
  // generation anchor) outranks the block Monday.
  const mondayProgram = { startDate: '2026-08-24T09:00:00.000Z' } as never;
  assert(dayPredatesProgram('2026-08-25', mondayProgram, '2026-08-26') === true,
    'Tuesday predates a Wednesday signup even though the block began Monday');
  assert(dayPredatesProgram('2026-08-26', mondayProgram, '2026-08-26') === false,
    'the signup day itself is IN the program');
  assert(dayPredatesProgram('2026-08-25', mondayProgram, null) === false,
    'without an athlete start, the block Monday remains the boundary');
  assert(dayPredatesProgram('2026-08-23', mondayProgram, '2026-08-20') === true,
    'an anchor EARLIER than the block start never un-greys pre-block days');
});

run('no program, no gate — nothing is hidden while nothing exists yet', () => {
  assert(dayPredatesProgram('2026-08-24', null) === false, 'null program');
  assert(dayPredatesProgram('2026-08-24', {} as never) === false, 'no startDate');
  assert(dayPredatesProgram('2026-08-24', { startDate: 'garbage' } as never) === false,
    'an unparseable startDate must not grey the whole week');
});

run('Wednesday signup removes Monday and Tuesday sessions from Week view entirely', () => {
  const program = { startDate: '2026-08-24T09:00:00.000Z' } as never;
  const days = [
    { date: '2026-08-24', session: 'Monday strength' },
    { date: '2026-08-25', session: 'Tuesday conditioning' },
    { date: '2026-08-26', session: 'Wednesday strength' },
    { date: '2026-08-27', session: 'Thursday mobility' },
  ];
  const visible = weekViewDaysFromAthleteStart(days, program, '2026-08-26');
  assert(visible.map((day) => day.date).join(',') === '2026-08-26,2026-08-27',
    `Week view retained ${visible.map((day) => day.date).join(',')}`);
  assert(days.length === 4,
    'the Week-view filter mutated or deleted the stored source collection');
});

run('the block start remains the fallback when no signup anchor exists', () => {
  const program = { startDate: '2026-08-25T09:00:00.000Z' } as never;
  const days = [
    { date: '2026-08-24' },
    { date: '2026-08-25' },
    { date: '2026-08-26' },
  ];
  assert(weekViewDaysFromAthleteStart(days, program, null)
    .map((day) => day.date).join(',') === '2026-08-25,2026-08-26',
  'the program start fallback no longer filters the pre-program date');
});

/* ── THE TWO WEEK CONSUMERS, at the source level ─────────────────────────── */

const repoRoot = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(repoRoot, 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
const board = fs.readFileSync(path.join(repoRoot, 'screens', 'home', 'WeekBoard.tsx'), 'utf8');

run('the normal Week list consumes the one filtered day collection', () => {
  assert(/const weekViewDays = useMemo\(\(\) => weekViewDaysFromAthleteStart\(/.test(home),
    'the shared Week-view collection is absent');
  assert(/weekViewDays\.map\(\(day\) => renderDayRow\(day, weekDays\.indexOf\(day\)\)\)/.test(home),
    'the normal Week list does not render the shared filtered collection');
});

run('the day-first status card (Tired/Sick/Injured) stands down on a pre-start day', () => {
  assert(/dayFirst\s*&&\s*!dayPredatesProgram\(weekDays\[selectedIdx\]/.test(home.replace(/\n\s*/g, ' ')),
    'the readiness chips render on a day before the program existed');
});

run('Manage Week consumes the same filtered days and has no grey/frozen mode', () => {
  assert(/weekViewDays\.map\(\(day\) => \(\{/.test(home),
    'Manage Week is not built from the shared filtered collection');
  assert(!/preProgram/.test(board) && !/frozen/.test(board),
    'Manage Week still has a grey or frozen pre-start presentation');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
