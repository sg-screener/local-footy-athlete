/**
 * BLOCK TWO ROTATION — FIRST TRACE.
 *
 * Drives real `generateProgramLocally` worlds across build block 1 → deload →
 * build block 2 → build block 3 and prints, per movement slot: the selected
 * exercise, its role and pattern/group, the retain-or-rotate decision, the
 * reason, and the prescribed-load source.
 *
 * Run: npx sucrase-node scripts/trace-rotation.ts
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

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { fullKitEquipmentAnswer } from '../src/__tests__/support/equipmentAnswerFixture';
import { findPoolEntry, STRENGTH_POOLS } from '../src/data/exercisePoolsStrength';
import { DEFAULT_EXERCISES } from '../src/data/defaultProgram';
import type { OnboardingData, TrainingProgram, Workout } from '../src/types/domain';

/**
 * Rows carry an `exerciseId` slug, not the pool's display name. Resolve it the
 * way the app does: the default library by id, else de-slugify `ex-custom-*`
 * and match a pool entry case-insensitively.
 */
const BY_ID = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e.name]));
const POOL_BY_LOWER = new Map<string, string>();
for (const slotKey of Object.keys(STRENGTH_POOLS)) {
  const bySlot = (STRENGTH_POOLS as Record<string, Record<string, { entries: { name: string }[] }>>)[slotKey];
  for (const role of Object.keys(bySlot)) {
    for (const entry of bySlot[role].entries) {
      POOL_BY_LOWER.set(entry.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), entry.name);
    }
  }
}
function resolveName(exerciseId: string): string | null {
  const known = BY_ID.get(exerciseId);
  if (known) return known;
  if (!exerciseId.startsWith('ex-custom-')) return null;
  const slug = exerciseId.slice('ex-custom-'.length);
  return POOL_BY_LOWER.get(slug) ?? null;
}

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
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: 85,
  } as unknown as OnboardingData;
}

const BLOCK_STARTS = ['2026-07-06', '2026-08-03', '2026-08-31'];

function build(blockNumber: number, todayISO: string): TrainingProgram {
  return generateProgramLocally(athlete(), {
    todayISO,
    blockNumber,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
}

interface Row {
  slot: string;
  role: string;
  name: string;
  weightKg: number | undefined;
  sets: number;
}

/** Every strength row in a microcycle, keyed by pool slot + role. */
function rowsFor(program: TrainingProgram, weekIndex: number): Row[] {
  const mc = (program.microcycles ?? [])[weekIndex] as unknown as { workouts?: Workout[] };
  const out: Row[] = [];
  for (const w of mc?.workouts ?? []) {
    for (const ex of (w as unknown as { exercises?: unknown[] }).exercises ?? []) {
      const e = ex as { exerciseId?: string; prescribedWeightKg?: number; prescribedSets?: number };
      const name = resolveName(e.exerciseId ?? '');
      if (!name) continue;
      const found = findPoolEntry(name);
      if (!found) continue; // not a strength-pool row
      out.push({
        slot: found.slot,
        role: found.role,
        name,
        weightKg: e.prescribedWeightKg,
        sets: e.prescribedSets ?? 0,
      });
    }
  }
  return out;
}

function key(r: Row): string {
  return `${r.slot}/${r.role}`;
}

/** Distinct exercise names seen for each slot+role across a whole block. */
function blockMap(program: TrainingProgram): Map<string, Map<number, string[]>> {
  const m = new Map<string, Map<number, string[]>>();
  const weeks = (program.microcycles ?? []).length;
  for (let wi = 0; wi < weeks; wi++) {
    for (const r of rowsFor(program, wi)) {
      const k = key(r);
      if (!m.has(k)) m.set(k, new Map());
      const perWeek = m.get(k)!;
      const list = perWeek.get(wi) ?? [];
      if (!list.includes(r.name)) list.push(r.name);
      perWeek.set(wi, list);
    }
  }
  return m;
}

function loadsFor(program: TrainingProgram): Map<string, (number | undefined)[]> {
  const m = new Map<string, (number | undefined)[]>();
  const weeks = (program.microcycles ?? []).length;
  for (let wi = 0; wi < weeks; wi++) {
    for (const r of rowsFor(program, wi)) {
      const k = `${key(r)}|${r.name}`;
      const list = m.get(k) ?? [];
      list.push(r.weightKg);
      m.set(k, list);
    }
  }
  return m;
}

const programs = BLOCK_STARTS.map((start, i) => build(i + 1, start));

console.log('\n================ FIRST TRACE — FULL-GYM ATHLETE ================');
console.log('Pre-season, 3 training days, full kit. Blocks 1/2/3, each 3 build weeks + deload.\n');

const allKeys = new Set<string>();
const maps = programs.map((p) => {
  const m = blockMap(p);
  for (const k of m.keys()) allKeys.add(k);
  return m;
});

const sorted = [...allKeys].sort();

console.log('--- PER-SLOT EXERCISE IDENTITY BY WEEK (w1 w2 w3 = build, w4 = deload) ---\n');
for (const k of sorted) {
  console.log(`SLOT ${k}`);
  for (let bi = 0; bi < programs.length; bi++) {
    const perWeek = maps[bi].get(k);
    if (!perWeek) {
      console.log(`  block ${bi + 1}: (absent)`);
      continue;
    }
    const cells: string[] = [];
    for (let wi = 0; wi < 4; wi++) {
      const names = perWeek.get(wi);
      cells.push(names && names.length ? names.join('+') : '—');
    }
    console.log(`  block ${bi + 1}: w1=${cells[0]} | w2=${cells[1]} | w3=${cells[2]} | deload=${cells[3]}`);
  }
  console.log('');
}

console.log('--- LOADS BY SLOT+EXERCISE (per week, kg) ---\n');
for (let bi = 0; bi < programs.length; bi++) {
  console.log(`block ${bi + 1}:`);
  const l = loadsFor(programs[bi]);
  for (const [k, v] of [...l.entries()].sort()) {
    console.log(`  ${k} -> ${v.map((x) => (x === undefined ? 'blank' : String(x))).join(', ')}`);
  }
  console.log('');
}
