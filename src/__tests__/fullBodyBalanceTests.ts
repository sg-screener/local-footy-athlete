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
 * the block record is keyed by slot, and the in-run record is now visible to
 * later days in the same generation (one slot, one answer per block).
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
  readonly names: readonly string[];
}
function firstWeek(gender: 'male' | 'female', phase: string): Day[] {
  const program = quiet(() => generateProgramLocally(athlete(gender, phase), {
    todayISO: '2026-08-03', blockNumber: 1,
  })) as TrainingProgram;
  const cycle = program.microcycles[0] as {
    workouts: Array<{ name?: string; exercises?: Array<{ exercise?: { name?: string }; name?: string }> }>;
  };
  return cycle.workouts.map((workout) => ({
    label: String(workout.name ?? ''),
    names: (workout.exercises ?? []).map((row) => row.exercise?.name ?? row.name ?? ''),
  }));
}

const PUSHES = /Bench Press|Push-?up|Shoulder Press|Overhead Press|Dip/i;
const PULLS = /Row|Pull-?Up|Pulldown|Chin/i;
const LOWERS = /Squat|RDL|Deadlift|Lunge|Leg Press|Bulgarian|Step Up/i;

for (const gender of ['male', 'female'] as const) {
  for (const phase of ['Pre-season', 'Off-season'] as const) {
    run(`${gender} ${phase} 3-day: the full-body day balances — legs AND a push AND a pull`, () => {
      const days = firstWeek(gender, phase);
      const fullBody = days.find((day) => /full[_ ]?body/i.test(day.label));
      assert(fullBody, `no full-body day in: ${days.map((day) => day.label).join(', ')}`);
      const names = fullBody.names.join(', ');
      assert(fullBody.names.some((name) => LOWERS.test(name)),
        `no lower row on the full-body day: ${names}`);
      assert(fullBody.names.some((name) => PUSHES.test(name)),
        `no push row on the full-body day (the pre-R-234 duplicate-lower shape): ${names}`);
      assert(fullBody.names.some((name) => PULLS.test(name)),
        `no pull row on the full-body day: ${names}`);
    });

    run(`${gender} ${phase} 3-day: the full-body day is not the lower day's duplicate`, () => {
      const days = firstWeek(gender, phase);
      const fullBody = days.find((day) => /full[_ ]?body/i.test(day.label));
      const lower = days.find((day) => /^lower/i.test(day.label));
      assert(fullBody && lower, 'week no longer holds a lower day and a full-body day');
      const shared = fullBody.names.filter((name) => lower.names.includes(name));
      assert(shared.length < Math.min(fullBody.names.length, lower.names.length),
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

run('the in-run block record is visible to later days (one slot, one answer per block)', () => {
  assert(/\?\? selectionsThisBlock\.find\(\(entry\) => entry\.slot === slot\) \?\? null/.test(composer),
    'the install-vs-boot record asymmetry is back — bin Monday, relaunch, and the '
    + "full-body day's pull flips (measured: Pull-Ups → Lat Pulldown)");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
