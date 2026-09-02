/**
 * Item 1 (Sam, 2026-09-02) — a one-week rebuild composes against the accepted
 * week it is rebuilding: a day it replaces may not repeat an automatic
 * strength identity the accepted week carries on a day it keeps.
 * Run: npm run test:rebuilt-week-ledger
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { generateProgramLocally } from '../services/api/generateProgram';
import { acceptedAutomaticIdentitiesByDay } from '../rules/acceptedLoadCarry';
import {
  automaticExerciseRouteForIdentity,
  workoutExerciseWasAutomaticallySelected,
} from '../rules/automaticWeeklyExerciseSelection';
import type { OnboardingData, Workout } from '../types/domain';

let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}
function quietly<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const TODAY = '2026-09-07';
function profile(phase: 'Off-season' | 'Pre-season' | 'In-season', days: number): OnboardingData {
  const preferred = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].slice(0, days);
  return {
    firstName: 'ledger', ageRange: '22-26', gender: 'male', position: 'inside_mid',
    heightCm: 180, weightKg: 82, motivation: 'Build strength and football fitness',
    goals: ['stronger_and_fitter'], seasonPhase: phase,
    seasonFinishedOn: phase === 'Off-season' ? '2026-09-06' : undefined,
    trainingDaysPerWeek: days, preferredTrainingDays: preferred as never,
    teamTrainingDays: [], teamTrainingDaysPerWeek: 0,
    usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
    gameDay: phase === 'In-season' ? 'Saturday' : undefined,
    trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete', injuries: [], experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', conditioningLevel: 'Good',
    sprintExposure: '2+ times per week', recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 480, recordedOn: TODAY, source: 'onboarding' },
  } as OnboardingData;
}
function generate(athlete: OnboardingData, acceptedWeekIdentitiesByDay?: Readonly<Record<number, readonly string[]>>): Workout[] {
  return quietly(() => generateProgramLocally(athlete, {
    todayISO: TODAY, previousProgram: null, microcycleLimit: 1,
    weekAcceptance: 'forward_decision',
    ...(acceptedWeekIdentitiesByDay ? { acceptedWeekIdentitiesByDay } : {}),
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: athlete.seasonPhase!, phaseEntryWeekStartISO: TODAY,
      originProvenance: 'explicit_user_phase_change', persistenceProvenance: 'preserved_persisted_state',
    },
  } as never)).microcycles[0]?.workouts ?? [];
}
const automaticStrength = (workout: Workout): string[] => (workout.exercises ?? [])
  .filter((row) => workoutExerciseWasAutomaticallySelected(row)
    && row.role !== 'power' && row.section18Evidence?.role !== 'power')
  .map((row) => row.exercise?.name ?? '')
  .filter((name) => name && automaticExerciseRouteForIdentity(name) === 'strength');

console.log('\n[item 1] a rebuilt day cannot repeat what the accepted week keeps on other days');

const worlds = (['Off-season', 'Pre-season', 'In-season'] as const).flatMap((phase) =>
  [3, 4, 5].map((days) => ({ phase, days, athlete: profile(phase, days) })));

run('the seed is honoured in every world: no composed day repeats an identity listed on another accepted day', () => {
  let daysChecked = 0; let seededIdentities = 0;
  for (const world of worlds) {
    // The "accepted week" is the world's own first composition; the rebuild is
    // asked to compose again while treating every accepted day as kept.
    const accepted = generate(world.athlete);
    const seed = acceptedAutomaticIdentitiesByDay(accepted);
    seededIdentities += Object.values(seed).flat().length;
    const rebuilt = generate(world.athlete, seed);
    for (const workout of rebuilt) {
      const elsewhere = new Set(Object.entries(seed)
        .filter(([day]) => Number(day) !== workout.dayOfWeek)
        .flatMap(([, ids]) => ids));
      const clash = automaticStrength(workout).filter((name) => elsewhere.has(name));
      assert.deepEqual(clash, [], `${world.phase}/${world.days}d day ${workout.dayOfWeek}: ${clash.join(', ')}`);
      daysChecked += 1;
    }
  }
  assert(daysChecked >= 9 && seededIdentities >= 30, `non-vacuity: ${daysChecked} days, ${seededIdentities} seeded identities`);
});

run('the seed changes the answer: without it the same rebuild repeats at least one kept identity somewhere', () => {
  // Liveness for the cell above: a world where the unseeded composition puts
  // an identity on a day the seed would have forbidden. The seed is the
  // accepted week SHIFTED by one weekday, so every day's own identities are
  // now "on another day" and the unseeded rebuild must collide with them.
  let collisions = 0;
  for (const world of worlds) {
    const accepted = generate(world.athlete);
    const shifted: Record<number, string[]> = {};
    for (const [day, ids] of Object.entries(acceptedAutomaticIdentitiesByDay(accepted))) {
      shifted[(Number(day) + 1) % 7] = [...ids];
    }
    const unseeded = generate(world.athlete);
    for (const workout of unseeded) {
      const elsewhere = new Set(Object.entries(shifted)
        .filter(([day]) => Number(day) !== workout.dayOfWeek).flatMap(([, ids]) => ids));
      collisions += automaticStrength(workout).filter((name) => elsewhere.has(name)).length;
    }
    const seeded = generate(world.athlete, shifted);
    for (const workout of seeded) {
      const elsewhere = new Set(Object.entries(shifted)
        .filter(([day]) => Number(day) !== workout.dayOfWeek).flatMap(([, ids]) => ids));
      const clash = automaticStrength(workout).filter((name) => elsewhere.has(name));
      assert.deepEqual(clash, [], `${world.phase}/${world.days}d shifted seed day ${workout.dayOfWeek}: ${clash.join(', ')}`);
    }
  }
  assert(collisions > 0, 'the unseeded rebuild never collided with the shifted seed — the guard could not see the defect');
});

console.log(`\nRebuilt week ledger: ${passed} passed / ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
