/**
 * R-241 — repeated weekly strength patterns use distinct, block-stable seats.
 *
 * The athlete-facing failure was a three-day week with Bench Press, Back Squat
 * and RDLs each prescribed twice while DB Bench Press and Pull-Ups never
 * appeared. The old selection record was keyed only by movement slot, so every
 * occurrence of `horizontal_push` restored the same one block-wide answer.
 *
 * This suite drives the real generator. It does not hand-build composed rows.
 * Run: npm run test:weekly-strength-variety
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { generateProgramLocally } from '../services/api/generateProgram';
import {
  blockSelectionHistory,
  useBlockSelectionHistoryStore,
} from '../store/blockSelectionHistoryStore';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import type { OnboardingData, SeasonPhase, TrainingProgram } from '../types/domain';

armTotalsOrRed();

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

const DAYS: Readonly<Record<number, readonly string[]>> = {
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sunday'],
};

function athlete(args: {
  gender: 'male' | 'female';
  phase: SeasonPhase;
  gymDays: number;
  club: boolean;
}): OnboardingData {
  return {
    gender: args.gender,
    seasonPhase: args.phase,
    gameDay: args.phase === 'Off-season' ? undefined : 'Saturday',
    trainingDaysPerWeek: args.gymDays,
    preferredTrainingDays: [...DAYS[args.gymDays]],
    teamTrainingDaysPerWeek: args.club && args.phase !== 'Off-season' ? 2 : 0,
    teamTrainingDays: args.club && args.phase !== 'Off-season'
      ? ['Tuesday', 'Thursday'] : [],
    equipmentAnswer: presetEquipmentAnswer('commercial_gym'),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: args.gender === 'female' ? 65 : 85,
  } as unknown as OnboardingData;
}

interface WeeklyRow {
  readonly day: number;
  readonly session: string;
  readonly slot: string;
  readonly name: string;
}

function strengthRows(program: TrainingProgram, cycleIndex = 0): WeeklyRow[] {
  const cycle = program.microcycles[cycleIndex];
  if (!cycle) return [];
  return cycle.workouts.flatMap((workout) =>
    (workout.exercises ?? [])
      .filter((row) => slotCountsTowardSetBudget(row.section18Evidence?.slot))
      .map((row) => ({
        day: workout.dayOfWeek,
        session: workout.name,
        slot: String(row.section18Evidence?.slot ?? ''),
        name: String(row.exercise?.name ?? ''),
      })));
}

interface World {
  readonly id: string;
  readonly rows: readonly WeeklyRow[];
}

const worlds: World[] = [];
for (const phase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  for (const gymDays of [3, 4, 5, 6]) {
    for (const gender of ['male', 'female'] as const) {
      for (const club of phase === 'Off-season' ? [false] : [false, true]) {
        const id = `${gender}/${phase}/${gymDays}d/${club ? 'club' : 'noclub'}`;
        const program = quiet(() => generateProgramLocally(
          athlete({ gender, phase, gymDays, club }),
          {
            todayISO: '2026-08-03',
            blockNumber: 1,
            microcycleLimit: 1,
            selectionHistory: [],
            recordSelections: false,
          },
        ));
        worlds.push({ id, rows: strengthRows(program) });
      }
    }
  }
}

run('the real 3–6 day matrix generated every requested world', () => {
  assert(worlds.length === 40, `expected 40 worlds, got ${worlds.length}`);
  assert(worlds.every((world) => world.rows.length > 0),
    `empty strength output: ${worlds.filter((world) => world.rows.length === 0).map((world) => world.id).join(', ')}`);
});

const VARIETY_SLOTS = new Set([
  'squat', 'hinge', 'single_leg_knee',
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
]);

run('a repeated weekly slot does not prescribe the same exercise twice', () => {
  const collisions: string[] = [];
  const collisionWorlds = new Set<string>();
  for (const world of worlds) {
    const bySlot = new Map<string, WeeklyRow[]>();
    for (const row of world.rows) {
      if (!VARIETY_SLOTS.has(row.slot)) continue;
      bySlot.set(row.slot, [...(bySlot.get(row.slot) ?? []), row]);
    }
    for (const [slot, rows] of bySlot) {
      const byName = new Map<string, WeeklyRow[]>();
      for (const row of rows) byName.set(row.name, [...(byName.get(row.name) ?? []), row]);
      for (const [name, repeated] of byName) {
        if (repeated.length < 2) continue;
        collisionWorlds.add(world.id);
        collisions.push(`${world.id}/${slot}: ${name} on ${repeated.map((row) => row.day).join('+')}`);
      }
    }
  }
  assert(collisions.length === 0,
    `${collisions.length} repeated weekly exercise identities across `
      + `${collisionWorlds.size}/${worlds.length} profile worlds:\n`
      + collisions.slice(0, 30).join('\n'));
});

run('a repeated upper pattern uses both a main lift and a real variation', () => {
  const world = worlds.find((entry) => entry.id === 'male/Pre-season/4d/noclub');
  assert(world, 'the named four-day control world was not generated');
  const names = world.rows.map((row) => row.name);
  assert(names.some((name) => /DB Bench/i.test(name)),
    `no DB Bench variation in ${names.join(' | ')}`);
  assert(names.some((name) => /Pull-Ups|Chin-Ups/i.test(name)),
    `no Pull-Up/Chin-Up in ${names.join(' | ')}`);
});

run('each weekly seat stays stable across all four weeks of the block', () => {
  const program = quiet(() => generateProgramLocally(
    athlete({ gender: 'male', phase: 'Pre-season', gymDays: 4, club: false }),
    {
      todayISO: '2026-08-03',
      blockNumber: 1,
      selectionHistory: [],
      recordSelections: false,
    },
  ));
  const seatMaps = program.microcycles.map((_, index) => {
    const bySlot = new Map<string, string[]>();
    for (const row of strengthRows(program, index)) {
      if (!VARIETY_SLOTS.has(row.slot)) continue;
      bySlot.set(row.slot, [...(bySlot.get(row.slot) ?? []), row.name]);
    }
    return new Map([...bySlot.entries()].flatMap(([slot, names]) =>
      names.map((name, seatIndex) => [`${slot}:${seatIndex}`, name] as const)));
  });
  assert(seatMaps.length === 4, `expected four weeks, got ${seatMaps.length}`);
  const base = seatMaps[0];
  const changes: string[] = [];
  seatMaps.slice(1, 3).forEach((week, weekIndex) => {
    for (const [seat, identity] of week) {
      if (base.get(seat) !== identity) {
        changes.push(`week ${weekIndex + 2} ${seat}: ${base.get(seat)} -> ${identity}`);
      }
    }
  });
  /* The deload may drop supporting rows, which shifts a surviving row's visible
   * occurrence index. It may not introduce a new identity for the slot. */
  const baseIdentitiesBySlot = new Map<string, Set<string>>();
  for (const [seat, identity] of base) {
    const slot = seat.replace(/:\d+$/, '');
    const identities = baseIdentitiesBySlot.get(slot) ?? new Set<string>();
    identities.add(identity);
    baseIdentitiesBySlot.set(slot, identities);
  }
  for (const [seat, identity] of seatMaps[3]) {
    const slot = seat.replace(/:\d+$/, '');
    if (!baseIdentitiesBySlot.get(slot)?.has(identity)) {
      changes.push(`deload ${slot}: introduced ${identity}`);
    }
  }
  assert(changes.length === 0,
    `weekly seats changed inside one block:\n${changes.join('\n')}`);
});

run('acceptance records both seats; legacy one-seat rows lift to seat zero', () => {
  useBlockSelectionHistoryStore.setState({ selections: [] } as never);
  quiet(() => generateProgramLocally(
    athlete({ gender: 'male', phase: 'Pre-season', gymDays: 4, club: false }),
    {
      todayISO: '2026-08-03',
      blockNumber: 1,
      recordSelections: 'author',
      selectionHistory: [],
    },
  ));
  const horizontalPresses = blockSelectionHistory()
    .filter((selection) => selection.slot === 'horizontal_push');
  assert(horizontalPresses.length >= 2,
    `acceptance recorded ${horizontalPresses.length} horizontal-push seat(s)`);
  assert(new Set(horizontalPresses.map((selection) => selection.seatIndex)).size
      === horizontalPresses.length,
  `seat keys collided: ${JSON.stringify(horizontalPresses)}`);
  assert(new Set(horizontalPresses.map((selection) => selection.identity)).size
      === horizontalPresses.length,
  `accepted seats cloned one identity: ${JSON.stringify(horizontalPresses)}`);

  const first = horizontalPresses[0];
  useBlockSelectionHistoryStore.setState({
    selections: [{
      blockNumber: first.blockNumber,
      blockStartISO: first.blockStartISO,
      slot: first.slot,
      group: first.group,
      role: first.role,
      identity: first.identity,
    }],
  } as never);
  assert(blockSelectionHistory()[0]?.seatIndex === 0,
    `legacy row did not lift to seat zero: ${JSON.stringify(blockSelectionHistory()[0])}`);
  useBlockSelectionHistoryStore.setState({ selections: [] } as never);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
