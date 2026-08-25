/**
 * R-227 — days before the program's start are VISIBLE BUT INERT.
 *
 * Sam, 2026-08-26 (launch-audit finding #12): *"grey them out - shows the
 * athlete they are there without being able to do something in the past."*
 * The audit case: onboarding on a Tuesday produced a Monday (before the app
 * held a program) showing a full CORE session with "Start Session" and the
 * Tired/Sick/Injured chips — an obligation that was never real.
 *
 * One owner: `dayPredatesProgram` beside the navigation bounds that already
 * read the program's own dated span, so the two cannot disagree about where
 * the program begins. Three consumers, each anchored below: the day row's
 * action cluster, the day-first status card, the week board's controls.
 *
 * Run: npm run test:pre-program-days
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { dayPredatesProgram } from '../utils/sessionResolver';

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

run('no program, no gate — nothing is greyed while nothing exists yet', () => {
  assert(dayPredatesProgram('2026-08-24', null) === false, 'null program');
  assert(dayPredatesProgram('2026-08-24', {} as never) === false, 'no startDate');
  assert(dayPredatesProgram('2026-08-24', { startDate: 'garbage' } as never) === false,
    'an unparseable startDate must not grey the whole week');
});

/* ── THE THREE CONSUMERS, at the source level ────────────────────────────── */

const repoRoot = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(repoRoot, 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
const board = fs.readFileSync(path.join(repoRoot, 'screens', 'home', 'WeekBoard.tsx'), 'utf8');

run('the day row is inert before the start — note instead of Start Session', () => {
  assert(/preProgram \? \(/.test(home) && home.includes('day-pre-program-note'),
    'the pre-program branch is gone from the day row action cluster');
  assert(/preProgram=\{dayPredatesProgram\(day\.date, currentProgram\)\}/.test(home),
    'the row no longer derives the flag from the program span');
});

run('the day-first status card (Tired/Sick/Injured) stands down on a pre-start day', () => {
  assert(/dayFirst\s*&&\s*!dayPredatesProgram\(weekDays\[selectedIdx\]/.test(home.replace(/\n\s*/g, ' ')),
    'the readiness chips render on a day before the program existed');
});

run('the board freezes pre-start rows — no add, no bin, no drag', () => {
  assert(/preProgram: dayPredatesProgram\(day\.date, currentProgram\)/.test(home),
    'the board rows no longer carry the flag');
  assert(/box\.kind !== 'game' && !frozen/.test(board),
    'the bin/drag gates no longer respect frozen');
  assert(/if \(frozen\) \{[\s\S]{0,200}styles\.emptyBox/.test(board),
    'a frozen empty day still offers the add doorway');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
