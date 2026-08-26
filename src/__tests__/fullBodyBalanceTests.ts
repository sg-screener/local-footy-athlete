/**
 * R-234 — A FULL-BODY DAY WITH NOTHING MISSING BALANCES (Sam, 2026-08-26).
 *
 * *"lowers + uppers + full body (full body - should match whats missing in
 * rest of week or balance out program as well as possible)"* — answering the
 * profiles audit's F-A: in pre/off-season 3-day worlds (both genders) the
 * full_body plan day devolved to `composedDayKind(...) ?? 'lower'` and
 * shipped a day NAMED full_body carrying Monday's exact mains and zero upper
 * rows. R-087 is untouched: body-spanning gaps still make a coverage day.
 *
 * The same build closed the door/boot asymmetry the balance day exposed:
 * the block record is keyed by weekly slot occurrence, and the in-run record is
 * visible to later days in the same generation (one seat, one answer per block).
 *
 * Run: npm run test:full-body-balance
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { generateProgramLocally } from '../services/api/generateProgram';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import type { OnboardingData, TrainingProgram } from '../types/domain';

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

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

function athlete(gender: 'male' | 'female', phase: string): OnboardingData {
  return {
    gender, seasonPhase: phase,
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: phase === 'Off-season' ? 0 : 2,
    teamTrainingDays: phase === 'Off-season' ? [] : ['Tuesday', 'Thursday'],
    equipmentAnswer: presetEquipmentAnswer('commercial_gym'),
    injuries: [], goals: ['Get stronger'], experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
    weightKg: gender === 'female' ? 65 : 85,
  } as unknown as OnboardingData;
}

interface Day {
  readonly label: string;
  readonly rows: ReadonlyArray<{
    readonly name: string;
    readonly slot: string;
  }>;
}
function firstWeek(gender: 'male' | 'female', phase: string): Day[] {
  const program = quiet(() => generateProgramLocally(athlete(gender, phase), {
    todayISO: '2026-08-03', blockNumber: 1,
  })) as TrainingProgram;
  const cycle = program.microcycles[0] as {
    workouts: Array<{
      name?: string;
      exercises?: Array<{
        exercise?: { name?: string };
        name?: string;
        section18Evidence?: { slot?: string };
      }>;
    }>;
  };
  return cycle.workouts.map((workout) => ({
    label: String(workout.name ?? ''),
    rows: (workout.exercises ?? []).map((row) => ({
      name: row.exercise?.name ?? row.name ?? '',
      slot: String(row.section18Evidence?.slot ?? ''),
    })),
  }));
}

const PUSH_SLOTS = new Set(['horizontal_push', 'vertical_push']);
const PULL_SLOTS = new Set(['horizontal_pull', 'vertical_pull']);
const LOWER_SLOTS = new Set(['squat', 'hinge', 'single_leg_knee']);

for (const gender of ['male', 'female'] as const) {
  for (const phase of ['Pre-season', 'Off-season'] as const) {
    run(`${gender} ${phase} 3-day: the full-body day balances — legs AND a push AND a pull`, () => {
      const days = firstWeek(gender, phase);
      const fullBody = days.find((day) => /full[_ ]?body/i.test(day.label));
      assert(fullBody, `no full-body day in: ${days.map((day) => day.label).join(', ')}`);
      const names = fullBody.rows.map((row) => row.name).join(', ');
      assert(fullBody.rows.some((row) => LOWER_SLOTS.has(row.slot)),
        `no lower row on the full-body day: ${names}`);
      assert(fullBody.rows.some((row) => PUSH_SLOTS.has(row.slot)),
        `no push row on the full-body day (the pre-R-234 duplicate-lower shape): ${names}`);
      assert(fullBody.rows.some((row) => PULL_SLOTS.has(row.slot)),
        `no pull row on the full-body day: ${names}`);
    });

    run(`${gender} ${phase} 3-day: the full-body day is not the lower day's duplicate`, () => {
      const days = firstWeek(gender, phase);
      const fullBody = days.find((day) => /full[_ ]?body/i.test(day.label));
      const lower = days.find((day) => /^lower/i.test(day.label));
      assert(fullBody && lower, 'week no longer holds a lower day and a full-body day');
      const lowerNames = lower.rows.map((row) => row.name);
      const shared = fullBody.rows
        .map((row) => row.name)
        .filter((name) => lowerNames.includes(name));
      assert(shared.length < Math.min(fullBody.rows.length, lower.rows.length),
        `the full-body day repeats the lower day wholesale: ${shared.join(', ')}`);
    });
  }
}

/* ── The source-level halves ─────────────────────────────────────────────── */

const composer = fs.readFileSync(
  path.join(__dirname, '..', 'rules', 'composeWeek.ts'), 'utf8');

run('the balance arm exists and coverage still outranks it (R-087 untouched)', () => {
  assert(/isBalanceShape/.test(composer)
    && /isR093Shape \|\| isCoverageDay \|\| isBalanceShape/.test(composer),
    'the balance arm is gone — the full-body day falls back to a duplicate lower again');
  assert(/&& !isCoverageDay/.test(composer),
    'balance no longer yields to R-087 coverage');
});

run('the in-run block record is visible to later days (one seat, one answer per block)', () => {
  assert(/\?\? selectionsThisBlock\.find\(\(entry\) =>[\s\S]*?entry\.slot === slot && selectionSeatIndex\(entry\) === seatIndex\) \?\? null/.test(composer),
    'the install-vs-boot record asymmetry is back — bin Monday, relaunch, and the '
    + "full-body day's pull flips (measured: Pull-Ups → Lat Pulldown)");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
