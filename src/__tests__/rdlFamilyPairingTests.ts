/**
 * R-233 — ONE RDL VARIANT PER DAY (Sam, 2026-08-26).
 *
 * *"why RDL's and Single leg RDLs are in the same session? this should not be
 * happening. I'd rather it be RDL's and nordics, or Single leg RDL's as the
 * main hinge and then hamstring curls or nordics as the other one."*
 *
 * Why it happened: in-season the hinge is pinned to RDLs (R-093), his :227
 * fill order also owes a single-leg hip row, and that pool is deliberately one
 * exercise (R-084) — Single-Leg RDL. Two requirements, one family. Measured
 * pre-fix over 12 worlds (3 phases x 2-5 training days): 6 worlds shipped the
 * pair, up to 8 colliding days per program.
 *
 * The build: the hamstring pair (Nordic Lower / Hamstring Curl) joins the
 * single-leg hip slot's vocabulary, and the SLOT YIELDS — when the day already
 * carries an RDL-family lift its candidates drop the family, so a hamstring
 * row takes the row instead. The hinge never yields (block stability).
 *
 * Run: npm run test:rdl-family
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { generateProgramLocally } from '../services/api/generateProgram';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import { injurySubstitutionBadge } from '../rules/injurySubstitutionSource';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
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

const DAY_SETS: Record<number, string[]> = {
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
};

function athlete(phase: string, days: number): OnboardingData {
  return {
    gender: 'male', seasonPhase: phase,
    trainingDaysPerWeek: days,
    preferredTrainingDays: DAY_SETS[days],
    teamTrainingDaysPerWeek: phase === 'Off-season' ? 0 : 2,
    teamTrainingDays: phase === 'Off-season' ? [] : ['Tuesday', 'Thursday'],
    ...(phase === 'In-season' ? { usualGameDay: 'Saturday' } : {}),
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [], goals: ['Get stronger'], experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
  } as unknown as OnboardingData;
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

interface DayRows {
  readonly names: readonly string[];
  readonly rows: ReadonlyArray<{
    readonly exercise?: { readonly name?: string };
    readonly name?: string;
    readonly substitutedFrom?: {
      readonly baseExerciseName: string;
      readonly cause: 'excluded_today' | 'kit_today' | 'injury' | 'already_on_day';
    };
  }>;
}
function generatedDays(phase: string, days: number): DayRows[] {
  const program = quiet(() => generateProgramLocally(athlete(phase, days), {
    todayISO: '2026-08-03', blockNumber: 2,
  })) as TrainingProgram;
  const out: DayRows[] = [];
  for (const cycle of program.microcycles) {
    for (const workout of (cycle as { workouts: Array<{ exercises?: Array<{ exercise?: { name?: string }; name?: string }> }> }).workouts) {
      const rows = workout.exercises ?? [];
      out.push({
        names: rows.map((row) => row.exercise?.name ?? row.name ?? ''),
        rows,
      });
    }
  }
  return out;
}

const isRdls = (name: string) => /^RDLs$/i.test(name);
const isSlRdl = (name: string) => /Single-?Leg RDL/i.test(name.replace(/‑/g, '-'));
const isHamstringRow = (name: string) => /Nordic Lower|Hamstring Curl/i.test(name);

/* ── The vocabulary half ─────────────────────────────────────────────────── */

run('the hamstring pair may hold the single-leg hip row — and only the pair', () => {
  assert(slotsForExerciseName('Nordic Lower').includes('single_leg_hip'),
    'Nordic Lower cannot stand in for the single-leg hip row');
  assert(slotsForExerciseName('Hamstring Curl').includes('single_leg_hip'),
    'Hamstring Curl cannot stand in for the single-leg hip row');
  assert(!slotsForExerciseName('Leg Extension').includes('single_leg_hip'),
    'a quad isolation row leaked into the single-leg hip slot');
  assert(slotsForExerciseName('Single-Leg RDL').includes('single_leg_hip'),
    'the unilateral hinge no longer fills its own slot');
});

/* ── The generated programs, in the worlds that used to collide ──────────── */

for (const [phase, days] of [['Off-season', 3], ['Pre-season', 4], ['In-season', 5]] as const) {
  run(`${phase} ${days}-day: no day carries two RDL-family lifts (pre-fix: collided)`, () => {
    const collisions = generatedDays(phase, days).filter((day) =>
      day.names.some(isRdls) && day.names.some(isSlRdl));
    assert(collisions.length === 0,
      `${collisions.length} day(s) still pair the variants: ${
        collisions.map((day) => day.names.join(', ')).join(' || ')}`);
  });
}

run('an Off-season RDL day carries a hamstring row in the vacated spot — replaced, not lost', () => {
  const rdlDays = generatedDays('Off-season', 3).filter((day) => day.names.some(isRdls));
  assert(rdlDays.length > 0, 'the world stopped producing RDL days at all');
  assert(rdlDays.every((day) => day.names.some(isHamstringRow)),
    `an RDL day shipped without Nordic/Curl: ${
      rdlDays.map((day) => day.names.join(', ')).join(' || ')}`);
});

run('Single-Leg RDL still lives where it owns the day (In-season 3-day)', () => {
  const days = generatedDays('In-season', 3);
  assert(days.some((day) => day.names.some(isSlRdl) && !day.names.some(isRdls)),
    'the guard erased Single-Leg RDL from worlds where it never collided');
});

run('healthy full-kit RDL de-dup is internal variety, never an equipment explainer', () => {
  const rows = generatedDays('Off-season', 3).flatMap((day) => day.rows);
  const deDuplicatedHamstring = rows.find((row) =>
    isHamstringRow(row.exercise?.name ?? row.name ?? '')
      && /Single-?Leg RDL/i.test(row.substitutedFrom?.baseExerciseName ?? ''));
  assert(deDuplicatedHamstring,
    'the full-kit control world no longer reaches the Single-Leg RDL -> hamstring de-dup');
  assert(deDuplicatedHamstring.substitutedFrom?.cause === 'already_on_day',
    `healthy full-kit de-dup was labelled ${deDuplicatedHamstring.substitutedFrom?.cause ?? 'none'}`);
  assert(injurySubstitutionBadge({
    substitution: deDuplicatedHamstring.substitutedFrom,
    displayName: (name) => name,
  }) === null,
  'automatic RDL-family variety still produces an athlete-facing swap explainer');
});

/* ── The guard, at the source level ──────────────────────────────────────── */

const composer = fs.readFileSync(
  path.join(__dirname, '..', 'rules', 'composeWeek.ts'), 'utf8');
run('the single-leg hip slot yields; the filter falls back rather than empties', () => {
  assert(/RDL_FAMILY_IDENTITIES/.test(composer)
    && /slot === 'single_leg_hip'/.test(composer),
    'the family guard is gone from the composer');
  assert(/filtered\.length > 0 \? filtered : list/.test(composer),
    'a kit with neither hamstring row must keep the repeated variant, not an empty slot');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
