/**
 * THE FOUR-BLOCK TABLES — the mission's "PRINT FOR SAM".
 *
 * Four consecutive real blocks for a full-gym athlete and a dumbbell/partial-kit
 * athlete. Each block's history is HARVESTED FROM THE BLOCK THE GENERATOR
 * ACTUALLY PRODUCED and logged as completed, so block N+1's retain-or-rotate
 * decision runs against the athlete's real recorded loads rather than an
 * authored fixture.
 *
 * Run: npx sucrase-node scripts/rotation-tables.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null, setItem: () => undefined,
    removeItem: () => undefined, clear: () => undefined,
  },
};

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { fullKitEquipmentAnswer } from '../src/__tests__/support/equipmentAnswerFixture';
import { slotCountsTowardSetBudget } from '../src/rules/weeklyProgrammingContract';
import type { SessionFeedback } from '../src/store/programStore';
import type { OnboardingData, TrainingProgram } from '../src/types/domain';

const BLOCK_STARTS = ['2026-07-06', '2026-08-03', '2026-08-31', '2026-09-28'];
const BLOCK_DATES: string[][] = [
  ['2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
    '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31'],
  ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-10', '2026-08-12', '2026-08-14',
    '2026-08-17', '2026-08-19', '2026-08-21', '2026-08-24', '2026-08-26', '2026-08-28'],
  ['2026-08-31', '2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09', '2026-09-11',
    '2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25'],
];

/**
 * ⚠ **MAIN/SECONDARY IS THE ROW'S OWN `section18Evidence.slot`, NOT ANCHOR-BENCH
 * MEMBERSHIP.** The first version of this table keyed off the pool's anchor
 * bench and printed NOTHING for the dumbbell athlete — every anchor is a barbell
 * lift, so a partial-kit athlete's main lift comes off the accessory bench and
 * was invisible. `slotCountsTowardSetBudget` is the app's own answer to "is this
 * row main/secondary work", and it is kit-blind.
 */
function mainSlotOf(row: { section18Evidence?: { slot?: string } }): string | null {
  const slot = row.section18Evidence?.slot;
  return slotCountsTowardSetBudget(slot) ? String(slot) : null;
}

function athlete(equipmentAnswer: unknown): OnboardingData {
  return {
    seasonPhase: 'Pre-season', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer, injuries: [], goals: ['Get stronger'],
    experienceLevel: '2-5 years', sprintExposure: 'Occasionally',
    conditioningLevel: 'Good', recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
  } as unknown as OnboardingData;
}

function logBlock(
  program: TrainingProgram, dates: readonly string[],
): Record<string, SessionFeedback> {
  const sessions: SessionFeedback['strength'][] = [];
  for (const mc of program.microcycles) {
    for (const w of mc.workouts) {
      const rows = (w.exercises ?? [])
        .filter((r) => r.role !== 'conditioning' && (r.exercise?.name ?? '') !== '')
        .map((r) => ({
          exerciseId: r.exerciseId, workoutExerciseId: r.id,
          exerciseName: r.exercise?.name ?? '', prescribedSets: r.prescribedSets,
          prescribedRepsMin: r.prescribedRepsMin, prescribedRepsMax: r.prescribedRepsMax,
          weightKg: r.prescribedWeightKg ?? null, completion: 'full' as const,
        }));
      if (rows.length > 0) sessions.push(rows);
    }
  }
  const out: Record<string, SessionFeedback> = {};
  dates.forEach((dateStr, i) => {
    out[dateStr] = {
      dateStr, completion: 'full', feeling: 'good', soreness: 'mild',
      strength: sessions[i % Math.max(1, sessions.length)] ?? [],
    } as SessionFeedback;
  });
  return out;
}

/** Main-lift identity + load per slot, for the build weeks and the deload. */
function readBlock(program: TrainingProgram) {
  const build = new Map<string, { name: string; kg: number | undefined }>();
  const deload = new Map<string, string>();
  for (const [wi, mc] of program.microcycles.entries()) {
    for (const w of mc.workouts) {
      for (const e of w.exercises ?? []) {
        const name = e.exercise?.name ?? '';
        const slot = mainSlotOf(e as never);
        if (!name || !slot) continue;
        if (wi < 3 && !build.has(slot)) build.set(slot, { name, kg: e.prescribedWeightKg });
        if (wi === 3) deload.set(slot, name);
      }
    }
  }
  return { build, deload };
}

function table(label: string, equipment: unknown): void {
  const profile = athlete(equipment);
  const blocks: ReturnType<typeof readBlock>[] = [];
  const recorded: Set<string>[] = [];
  let history: Record<string, SessionFeedback> = {};

  for (let b = 0; b < 4; b++) {
    const program = generateProgramLocally(profile, {
      todayISO: BLOCK_STARTS[b], blockNumber: b + 1,
      progressionHistory: { sessionFeedback: history, weightOverrides: {}, blockState: null },
    });
    blocks.push(readBlock(program));
    recorded.push(new Set(Object.keys(history).length
      ? Object.values(history).flatMap((f) => (f.strength ?? []).map((s) => s.exerciseName))
      : []));
    if (b < 3) {
      history = { ...history, ...logBlock(program, BLOCK_DATES[b]) };
    }
  }

  /* Sam, 2026-08-17: main lifts, single-leg rows and accessories shown
   * SEPARATELY — they answer to different rotation rules and reading them in one
   * block hid the fact that single-leg was rotating every block as ordered. */
  const GROUP_OF = (slot: string): string =>
    slot === 'single_leg_knee' || slot === 'single_leg_hip'
      ? 'SINGLE-LEG (rotates every block)'
      : ['squat', 'hinge', 'horizontal_push', 'vertical_push',
        'horizontal_pull', 'vertical_pull'].includes(slot)
        ? 'MAIN BILATERAL (may hold two blocks)'
        : 'ACCESSORY (rotates every block)';

  console.log(`\n\n════ ${label} ════`);
  console.log('slot            | block 1        | deload         | block 2        '
    + '| block 3        | block 4        | decision at b2→b4          | load source');
  console.log('-'.repeat(150));

  const slots = new Set<string>();
  for (const b of blocks) for (const s of b.build.keys()) slots.add(s);

  const ordered = [...slots].sort((a, c) =>
    (GROUP_OF(a) + a).localeCompare(GROUP_OF(c) + c));
  let lastGroup = '';
  for (const slot of ordered) {
    if (GROUP_OF(slot) !== lastGroup) {
      lastGroup = GROUP_OF(slot);
      console.log(`\n  ── ${lastGroup} ──`);
    }
    const cells = blocks.map((b) => b.build.get(slot));
    const dl = blocks[0].deload.get(slot) ?? '—';
    const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

    const reasons: string[] = [];
    for (let i = 1; i < 4; i++) {
      const prev = cells[i - 1]?.name;
      const now = cells[i]?.name;
      if (!prev || !now) { reasons.push('—'); continue; }
      reasons.push(prev === now ? 'retained' : 'rotated');
    }
    // Load source: a name the athlete has already recorded seeds from its OWN
    // history; a name never seen takes the authored estimate, or stays blank.
    const b2 = cells[1];
    const loadSource = !b2
      ? '—'
      : recorded[1].has(b2.name)
        ? 'own recorded history'
        : (typeof b2.kg === 'number' && b2.kg > 0 ? 'authored anchor estimate' : 'blank / bodyweight');

    console.log(
      `${pad(slot, 15)} | ${pad(cells[0]?.name ?? '—', 14)} | ${pad(dl, 14)} `
      + `| ${pad(cells[1]?.name ?? '—', 14)} | ${pad(cells[2]?.name ?? '—', 14)} `
      + `| ${pad(cells[3]?.name ?? '—', 14)} | ${pad(reasons.join(' → '), 26)} | ${loadSource}`);
  }

  console.log('\n  loads by block (kg):');
  for (const slot of [...slots].sort()) {
    const l = blocks.map((b) => {
      const c = b.build.get(slot);
      return c ? `${c.name}=${c.kg ?? 'blank'}` : '—';
    });
    console.log(`    ${slot}: ${l.join('  |  ')}`);
  }
}

/**
 * ⚠ **A FIXTURE IS A CLAIM TOO.** The first version of this spread
 * `tags: ['dumbbells','bodyweight']` — but `EquipmentAnswer.tags` is a RECORD of
 * `tag -> 'have'`, not an array. The malformed answer resolved to no kit at all,
 * so the "partial-kit" table was silently a BODYWEIGHT athlete and every row
 * read Push-ups / Bodyweight Squat / Glute Bridge. This is the real answer a
 * dumbbells-and-bench athlete gives.
 */
const DUMBBELL = {
  tags: { dumbbells: 'have', bench: 'have' },
  modalities: {},
  answeredOn: '2026-07-01',
} as unknown as ReturnType<typeof fullKitEquipmentAnswer>;

table('FULL-GYM ATHLETE — Pre-season, 3 training days, full kit', fullKitEquipmentAnswer());
table('PARTIAL-KIT ATHLETE — Pre-season, 3 training days, dumbbells + bodyweight', DUMBBELL);
