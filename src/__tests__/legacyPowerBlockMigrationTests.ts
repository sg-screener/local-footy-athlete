/**
 * The stored-program migration — Stage 5, the last of the power-row redesign.
 *
 *   docs/POWER_ROW_OWNERSHIP_REASSESSMENT_2026-07-27.md §6
 *
 * `workout.powerBlock` was persisted (the program store has no `partialize`), so
 * every athlete who generated before 2026-07-28 has power sitting in storage in
 * a shape nothing reads any more. This suite is the proof that it comes back,
 * unchanged, and that the ways it could go wrong are loud rather than quiet.
 *
 * Sam's four requirements, one section each:
 *
 *   [1] runs at read ingress, unconditionally, before any write can persist
 *   [2] idempotent; the degenerate both-present case is defined LOUDLY
 *   [3] unmappable legacy content fails loud, never drops
 *   [4] PARITY — a serialised pre-Stage-3 program, migrated, counts identically
 *       to the same program generated fresh
 *
 * Run: npm run test:power-migration
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};
process.env.TZ = 'Australia/Melbourne';

import fs from 'node:fs';
import path from 'node:path';

import type { TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import {
  LegacyPowerBlockMigrationError,
  hasUnmigratedPowerBlock,
  migrateStoredPowerBlock,
  migrateStoredPowerBlocks,
} from '../rules/legacyPowerBlockMigration';
import { powerRows } from '../rules/sessionRowCounting';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { getSessionComponents } from '../utils/sessionComponents';
import { canonicaliseHydratedProgram } from '../store/programStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { POWER_SCENARIOS } from './powerCountingDifferential/scenarios';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function threw(run: () => unknown): LegacyPowerBlockMigrationError | Error | null {
  try {
    run();
    return null;
  } catch (error) {
    return error as Error;
  }
}

function quietly<T>(build: () => T): T {
  const real = { log: console.log, info: console.info, warn: console.warn };
  console.log = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;
  try {
    return build();
  } finally {
    console.log = real.log;
    console.info = real.info;
    console.warn = real.warn;
  }
}

function strengthRow(id: string, name: string, order: number): WorkoutExercise {
  return {
    id: `${id}:row:${order}`,
    workoutId: id,
    exerciseId: `ex-${order}`,
    exerciseOrder: order,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 100,
    restSeconds: 120,
    exercise: {
      id: `ex-${order}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}

/** A workout in the shape a pre-Stage-3 build persisted. */
function legacyWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'legacy-1',
    microcycleId: 'mc',
    dayOfWeek: 1,
    name: 'Lower Squat',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [strengthRow('legacy-1', 'Back Squat', 1)],
    powerBlock: {
      kind: 'primer',
      family: 'lower',
      options: [{ name: 'Vertical Jump', sets: 3, repsMin: 3, repsMax: 3 }],
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Workout;
}

/* ── 1. Read ingress, unconditionally, before any write ───────────── */

console.log('\n[1] The migration runs at read ingress, above every branch');

{
  // STRUCTURAL. `canonicaliseHydratedState` early-returns for an
  // `accepted_canonical` program and skips the whole boundary canonicalisation —
  // and accepted-canonical is exactly what a Stage 2 build's program IS. A
  // migration placed inside that canonicalisation would miss the athletes who
  // most need it. So the call must sit ABOVE the branch, and this asserts the
  // ordering in the source rather than trusting a comment.
  const store = fs.readFileSync(path.join(repoRoot, 'src/store/programStore.ts'), 'utf8');
  const migrateAt = store.indexOf('const persistedState = migrateHydratedStatePowerBlocks(');
  const branchAt = store.indexOf("if (options.ingressKind === 'accepted_canonical')");
  ok(
    'hydration migrates before the accepted_canonical branch',
    migrateAt > 0 && branchAt > 0 && migrateAt < branchAt,
    `migrate@${migrateAt} branch@${branchAt}`,
  );

  // Every hydration surface, not just the program. A workout can reach the app
  // through an override, a week overlay or today's cached session, and each of
  // those was serialised with its block too.
  for (const surface of [
    'next.currentProgram',
    'next.currentMicrocycle',
    'next.todayWorkout',
    'next.dateOverrides',
    'next.weekScopedOverlays',
  ]) {
    ok(`the migration covers ${surface.replace('next.', '')}`, store.includes(surface));
  }

  ok(
    'publishing a program still carrying a block is refused at the write boundary',
    /assertNoUnmigratedPowerBlock\(program\);/.test(store),
  );
}

{
  const program: TrainingProgram = {
    id: 'p', userId: 'u', name: '', description: '',
    programPhase: 'Base-Building',
    startDate: '2026-07-06T12:00:00', endDate: '2026-08-02T12:00:00',
    microcycles: [{
      id: 'mc', programId: 'p', weekNumber: 1,
      startDate: '2026-07-06T12:00:00', endDate: '2026-07-12T12:00:00',
      workouts: [legacyWorkout()],
      createdAt: '', updatedAt: '',
    }],
    primaryFocus: '', isActive: true, createdAt: '', updatedAt: '',
  } as unknown as TrainingProgram;

  const hydrated = quietly(() => canonicaliseHydratedProgram(program));
  const workout = hydrated.microcycles[0].workouts[0];
  // What THIS layer owns is that the legacy field does not survive ingress.
  // Whether the resulting row then survives is a different owner's decision:
  // a contractless legacy week runs the §18 gateway, which may legitimately
  // strip power on its own budget. Asserting row survival here would be
  // asserting the gateway's behaviour through the migration's test, and would
  // go red for reasons that have nothing to do with the migration.
  ok('the exported program ingress migrates the legacy field away', !workout.powerBlock);
  ok(
    'and the migration itself produced the row the gateway then judged',
    powerRows(migrateStoredPowerBlocks(program.microcycles[0].workouts)[0])[0]
      ?.exercise?.name === 'Vertical Jump',
  );
}

/* ── 2. Idempotent; both-present is loud ──────────────────────────── */

console.log('\n[2] Idempotent, and the degenerate case is loud');

{
  const migrated = migrateStoredPowerBlock(legacyWorkout());
  ok('the block is gone after migration', !migrated.powerBlock);
  ok('the power row leads the list', migrated.exercises[0]?.role === 'power');
  ok('the strength row survives untouched',
    migrated.exercises.some((row) => row.exercise?.name === 'Back Squat'));

  // A LIFT, not a re-decision. Re-running the policy or the selector here would
  // hand the athlete a different exercise or dose than the one they were
  // prescribed and may already have trained.
  const row = powerRows(migrated)[0];
  ok('identity is lifted verbatim', row?.exercise?.name === 'Vertical Jump');
  ok('dose is lifted verbatim',
    row?.prescribedSets === 3 && row?.prescribedRepsMin === 3 && row?.prescribedRepsMax === 3);
  ok('family and kind are lifted verbatim',
    row?.power?.family === 'lower' && row?.power?.kind === 'primer');
  ok('the row carries power Section 18 evidence, not a name-classified one',
    row?.section18Evidence?.role === 'power');

  // Idempotence, and by IDENTITY — the migration runs on every read forever, so
  // a fresh object per read would churn every downstream memo.
  const again = migrateStoredPowerBlock(migrated);
  ok('re-migrating is a strict no-op', again === migrated);

  const modern = { ...legacyWorkout(), powerBlock: undefined } as Workout;
  ok('a post-Stage-3 workout is returned unchanged, by identity',
    migrateStoredPowerBlock(modern) === modern);

  const list = [modern, modern];
  ok('a list with nothing to migrate keeps its array identity',
    migrateStoredPowerBlocks(list) === list);
}

{
  // BOTH PRESENT. Nothing in the app can produce this: the migration removes the
  // block it lifts and no writer creates one. It means two builds disagreed, and
  // picking a winner would discard one athlete's real prescription.
  const both = migrateStoredPowerBlock(legacyWorkout());
  const conflicted = { ...both, powerBlock: legacyWorkout().powerBlock } as Workout;
  const error = threw(() => migrateStoredPowerBlock(conflicted));
  ok('a workout with BOTH a block and power rows throws', error !== null);
  ok('the throw names the conflict rather than a generic failure',
    /BOTH/.test(error?.message ?? ''), error?.message);
  ok('the throw is typed', error instanceof LegacyPowerBlockMigrationError);
}

/* ── 3. Unmappable content fails loud, never drops ────────────────── */

console.log('\n[3] Unmappable legacy content fails loud');

{
  const cases: Array<[string, unknown]> = [
    ['no options at all', { kind: 'primer', family: 'lower', options: [] }],
    ['an option with no name', {
      kind: 'primer', family: 'lower',
      options: [{ name: '   ', sets: 3, repsMin: 3, repsMax: 3 }],
    }],
    ['an option with no usable dose', {
      kind: 'primer', family: 'lower',
      options: [{ name: 'Vertical Jump', sets: undefined, repsMin: 3, repsMax: 3 }],
    }],
    ['an unknown family', {
      kind: 'primer', family: 'sideways',
      options: [{ name: 'Vertical Jump', sets: 3, repsMin: 3, repsMax: 3 }],
    }],
    ['an unknown kind', {
      kind: 'superset', family: 'lower',
      options: [{ name: 'Vertical Jump', sets: 3, repsMin: 3, repsMax: 3 }],
    }],
  ];
  for (const [label, block] of cases) {
    const error = threw(() =>
      migrateStoredPowerBlock({ ...legacyWorkout(), powerBlock: block } as Workout));
    ok(`${label} throws rather than dropping the work`,
      error instanceof LegacyPowerBlockMigrationError, error?.message ?? 'no throw');
  }
}

{
  ok('the write-boundary detector sees an unmigrated workout',
    hasUnmigratedPowerBlock([legacyWorkout()]));
  ok('…and passes a migrated one',
    !hasUnmigratedPowerBlock([migrateStoredPowerBlock(legacyWorkout())]));
}

/* ── 4. PARITY ───────────────────────────────────────────────────── */

console.log('\n[4] PARITY — a migrated legacy program counts like a fresh one');

// The requirement in Sam's words: "a serialized pre-Stage-3 program, migrated,
// must produce counting output identical to the same program generated fresh
// through the Stage 3 projection."
//
// The pre-Stage-3 program is built by INVERTING a fresh week — taking each power
// row back to the block shape a Stage 2 build would have persisted, and removing
// the row. The inverse lives here, in the test, not in production: it exists to
// manufacture the historical artefact, and putting it in `src/` would be a
// writer for a field this stage just made read-only.
//
// Then the whole thing is JSON round-tripped, because "serialised" is the point —
// a structure that never left memory would not prove the stored shape survives.

function toLegacyBlock(row: WorkoutExercise) {
  return {
    kind: row.power!.kind,
    family: row.power!.family,
    options: [{
      name: String(row.exercise?.name ?? ''),
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
    }],
  };
}

function asPreStage3(workout: Workout): Workout {
  const rows = powerRows(workout);
  if (rows.length === 0) return workout;
  return {
    ...workout,
    powerBlock: toLegacyBlock(rows[0]) as Workout['powerBlock'],
    exercises: (workout.exercises ?? []).filter((row) => row.role !== 'power'),
  };
}

function countsFor(workouts: readonly Workout[], weekStart: string) {
  const days = workouts
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((workout) => {
      const date = new Date(`${weekStart}T12:00:00`);
      date.setDate(date.getDate() + (workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1));
      return {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        workout,
      };
    });
  const counts = countWeeklyExposures(days);
  const { days: _trail, ...scalars } = counts;
  return {
    ...scalars,
    perDay: days.map(({ workout }) => ({
      dayOfWeek: workout.dayOfWeek,
      taxonomy: classifyDaySessions(workout).map((unit) => `${unit.category}:${unit.modality}`),
      components: getSessionComponents(workout).map((component) => component.kind),
      power: powerRows(workout).map((row) => ({
        exercise: row.exercise?.name,
        sets: row.prescribedSets,
        reps: `${row.prescribedRepsMin}-${row.prescribedRepsMax}`,
        family: row.power?.family,
        kind: row.power?.kind,
        role: row.role,
        section18Role: row.section18Evidence?.role,
      })),
    })),
  };
}

{
  let compared = 0;
  let powerWeeks = 0;
  const mismatches: string[] = [];

  for (const scenario of POWER_SCENARIOS) {
    const program = quietly(() => generateProgramLocally(scenario.profile, {
      todayISO: '2026-07-13',
      previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: scenario.profile.seasonPhase,
        phaseEntryWeekStartISO: scenario.phaseEntryWeekStartISO ?? '2026-07-13',
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    } as never));

    for (const microcycle of program.microcycles) {
      const weekStart = microcycle.startDate.slice(0, 10);
      const fresh = microcycle.workouts;
      if (fresh.some((workout) => powerRows(workout).length > 0)) powerWeeks += 1;

      // Serialise as a pre-Stage-3 build would have, then read it back.
      const stored = JSON.parse(JSON.stringify(fresh.map(asPreStage3))) as Workout[];
      ok(
        `${scenario.id} w${microcycle.weekNumber}: the stored fixture really is legacy-shaped`,
        stored.every((workout) => powerRows(workout).length === 0),
      );
      const migrated = migrateStoredPowerBlocks(stored);

      const before = JSON.stringify(countsFor(fresh, weekStart));
      const after = JSON.stringify(countsFor(migrated, weekStart));
      compared += 1;
      if (before !== after) {
        mismatches.push(`${scenario.id} w${microcycle.weekNumber}`);
      }
    }
  }

  ok('the parity sweep actually compared weeks', compared >= 30, `${compared} weeks`);
  ok('and weeks that carry power', powerWeeks >= 5, `${powerWeeks} weeks with power`);
  ok(
    'every migrated legacy week counts identically to the fresh one',
    mismatches.length === 0,
    mismatches.join(', '),
  );
}

/* ── Result ───────────────────────────────────────────────────────── */

console.log(
  `\nLegacy power-block migration: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
