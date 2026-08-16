/**
 * PROBE — two otherwise-identical full-gym athletes across a block boundary.
 *
 * A: completed Block 1, good recovery, recorded loads.
 * B: no qualifying history.
 *
 * Not a guard — a diagnostic that prints what the boundary actually did, so the
 * guards written next are written against measured behaviour rather than hope.
 * Run: TZ=Australia/Melbourne sucrase-node scripts/probe-block-two.ts
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
import type { SessionFeedback } from '../src/store/programStore';
import type { OnboardingData, Workout } from '../src/types/domain';

const BLOCK_1_START = '2026-07-06';
const BLOCK_2_START = '2026-08-03';

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
  const rows: { name: string; weight: unknown }[] = [];
  for (const w of workouts) {
    if (w.workoutType !== 'Strength' && w.workoutType !== 'Mixed') continue;
    for (const ex of w.exercises ?? []) {
      rows.push({ name: ex.exercise?.name ?? ex.exerciseId, weight: ex.prescribedWeightKg });
    }
  }
  return rows;
}

/** Block 1's actual rows, so the history we record is history that happened. */
const block1 = generateProgramLocally(athlete(), {
  todayISO: BLOCK_1_START,
  blockNumber: 1,
  progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
});
const block1Rows = strengthRows(block1.microcycles[0]?.workouts ?? []);
console.log('===== BLOCK 1 (week 1) =====');
for (const r of block1Rows) console.log(`  ${r.name}  weightKg=${JSON.stringify(r.weight)}`);

/**
 * Athlete A's history. Sessions marked FULL, recovery answered and good, and a
 * load recorded per main lift — the three facts the contract allows.
 *
 * ⚠ NO `completedSets` AND NO `actualReps`. The app does not record them unless
 * the athlete logged per-set detail, and the contract forbids inventing them
 * from a completed marker. If progression ever needs them, it must be because
 * they were logged — not because this fixture was generous.
 */
const RECORDED_LOADS: Record<string, number> = {
  Deadlift: 100,
  'Goblet Squat': 40,
  'Bench Press': 80,
  'Barbell Row': 60,
};

function athleteAHistory(): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  const dates = [
    '2026-07-06', '2026-07-08', '2026-07-10',
    '2026-07-13', '2026-07-15', '2026-07-17',
    '2026-07-20', '2026-07-22', '2026-07-24',
    '2026-07-27', '2026-07-29', '2026-07-31',
  ];
  const names = Object.keys(RECORDED_LOADS);
  for (const dateStr of dates) {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: names.map((exerciseName, i) => ({
        exerciseId: `ex-${i}`,
        workoutExerciseId: `wex-${i}`,
        exerciseName,
        prescribedSets: 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        weightKg: RECORDED_LOADS[exerciseName],
        completion: 'full' as const,
      })),
    } as SessionFeedback;
  }
  return feedback;
}

function block2For(label: string, sessionFeedback: Record<string, SessionFeedback>) {
  const program = generateProgramLocally(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
  });
  const rows = strengthRows(program.microcycles[0]?.workouts ?? []);
  console.log(`\n===== BLOCK 2 — ${label} =====`);
  for (const r of rows) {
    const prior = RECORDED_LOADS[r.name];
    const tag = prior === undefined
      ? 'ROTATED/new'
      : `retained (last recorded ${prior}kg)`;
    console.log(`  ${r.name}  weightKg=${JSON.stringify(r.weight)}   ${tag}`);
  }
  return rows;
}

const aRows = block2For('ATHLETE A (completed, good recovery, loads recorded)', athleteAHistory());
const bRows = block2For('ATHLETE B (no qualifying history)', {});

console.log('\n===== VERDICT =====');
for (const name of Object.keys(RECORDED_LOADS)) {
  const a = aRows.find((r) => r.name === name);
  const b = bRows.find((r) => r.name === name);
  if (!a) continue;
  console.log(
    `  ${name}: recorded ${RECORDED_LOADS[name]}kg → A=${JSON.stringify(a.weight)} B=${JSON.stringify(b?.weight)}`,
  );
}
const aRotated = aRows.filter((r) => RECORDED_LOADS[r.name] === undefined);
const rotatedWithLoad = aRotated.filter((r) => typeof r.weight === 'number');
console.log(`  A rotated rows: ${aRotated.length}; carrying ANY numeric load: ${rotatedWithLoad.length}`);
if (rotatedWithLoad.length > 0) {
  console.log(`    ⚠ ${rotatedWithLoad.map((r) => `${r.name}=${r.weight}`).join(', ')}`);
}
