/**
 * PROBE — what does generation actually produce for a healthy full-gym athlete,
 * block 1 vs block 2, and what load does a strength row carry?
 *
 * Not a guard. Diagnostic only. Run: sucrase-node scripts/probe-block-two.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { fullKitEquipmentAnswer } from '../src/__tests__/support/equipmentAnswerFixture';
import type { OnboardingData, Workout } from '../src/types/domain';

const BLOCK_1_START = '2026-07-06'; // Monday
const BLOCK_2_START = '2026-08-03'; // Monday, +4 weeks

function athlete(): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
  } as unknown as OnboardingData;
}

function strengthRows(workouts: readonly Workout[]) {
  const rows: { day: string; workout: string; name: string; sets: number; weight: unknown }[] = [];
  for (const w of workouts) {
    if (w.workoutType !== 'Strength' && w.workoutType !== 'Mixed') continue;
    for (const ex of w.exercises ?? []) {
      rows.push({
        day: String(w.dayOfWeek),
        workout: w.name,
        name: ex.exercise?.name ?? ex.exerciseId,
        sets: Number(ex.prescribedSets),
        weight: ex.prescribedWeightKg,
      });
    }
  }
  return rows;
}

function report(label: string, blockNumber: number, todayISO: string) {
  try {
    const program = generateProgramLocally(athlete(), { todayISO, blockNumber });
    const mc = program.microcycles ?? [];
    console.log(`\n===== ${label} (blockNumber=${blockNumber}, todayISO=${todayISO}) =====`);
    console.log(`microcycles: ${mc.length}  program ${program.startDate} → ${program.endDate}`);
    const week1 = mc[0];
    if (!week1) {
      console.log('NO MICROCYCLE');
      return null;
    }
    const rows = strengthRows(week1.workouts ?? []);
    console.log(`week 1 strength rows: ${rows.length}`);
    for (const r of rows) {
      console.log(`  day=${r.day} [${r.workout}] ${r.name}  sets=${r.sets}  weightKg=${JSON.stringify(r.weight)}`);
    }
    return rows;
  } catch (error) {
    console.log(`\n===== ${label} REFUSED =====`);
    console.log(`  ${(error as Error).name}: ${(error as Error).message}`);
    console.log(`  code=${JSON.stringify((error as { code?: string }).code)}`);
    return null;
  }
}

const b1 = report('BLOCK 1', 1, BLOCK_1_START);
const b2 = report('BLOCK 2', 2, BLOCK_2_START);

if (b1 && b2) {
  const n1 = new Set(b1.map((r) => r.name));
  const n2 = new Set(b2.map((r) => r.name));
  const retained = [...n2].filter((n) => n1.has(n));
  const rotatedIn = [...n2].filter((n) => !n1.has(n));
  console.log('\n===== BLOCK 1 → BLOCK 2 =====');
  console.log(`  block 1 distinct: ${[...n1].join(', ')}`);
  console.log(`  block 2 distinct: ${[...n2].join(', ')}`);
  console.log(`  RETAINED (${retained.length}): ${retained.join(', ')}`);
  console.log(`  ROTATED IN (${rotatedIn.length}): ${rotatedIn.join(', ')}`);
  const anyWeight = b2.some((r) => typeof r.weight === 'number' && r.weight > 0);
  console.log(`  any block-2 row carries a numeric load? ${anyWeight}`);
}
