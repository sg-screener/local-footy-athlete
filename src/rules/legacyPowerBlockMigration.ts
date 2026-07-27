/**
 * The one-time read-path migration that lifts a stored `powerBlock` into
 * `role: 'power'` rows — Stage 5, the last of the power-row redesign.
 *
 *   docs/POWER_ROW_OWNERSHIP_REASSESSMENT_2026-07-27.md §6 and its risks section
 *
 * ## Why a migration is not optional
 *
 * `workout.powerBlock` was PERSISTED. The program store has no `partialize`, so
 * the whole of `currentProgram` — microcycles, workouts and their blocks — was
 * serialised for every athlete who generated before 2026-07-28. Since Stage 4
 * nothing writes the field and nothing renders it, so an unmigrated program is
 * an athlete whose power work is present in storage and invisible on the screen.
 * Left alone until the next regeneration, a mid-block athlete simply loses their
 * primer.
 *
 * ## Where it runs, and why THERE
 *
 * At read ingress, unconditionally, before anything can write. That placement is
 * the whole safety argument: nothing writes `powerBlock` any more, so a program
 * that reaches a write path still carrying one gets persisted with its power
 * silently dropped on the next round trip. Migrating at ingress makes that path
 * impossible rather than unlikely, and `legacyPowerBlockMigrationTests` pins a
 * guard at the write boundary as the second lock.
 *
 * ## What it refuses to do
 *
 * Guess. Three cases fail loudly rather than resolve quietly:
 *
 *   BOTH PRESENT — a stored block AND power rows on the same workout. Nothing
 *   in the app can produce that: the migration removes the block it lifts, and
 *   no writer creates one. It means two builds disagreed about the same
 *   workout, and picking a winner would silently discard one athlete's real
 *   prescription. Throws.
 *
 *   UNMAPPABLE — a block with no options, an option with no name, or a
 *   family/kind outside the authored vocabulary. The alternative is dropping
 *   work the athlete was prescribed, which is the one outcome Sam ruled out by
 *   name ("no silent loss"). Throws.
 *
 *   Everything else is a strict no-op. A post-Stage-3 program — power rows, no
 *   block — is returned unchanged, by identity, so the migration can run on
 *   every read forever without cost or drift.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { hasPowerRow } from './sessionRowCounting';

const FAMILIES: ReadonlySet<string> = new Set(['lower', 'upper']);
const KINDS: ReadonlySet<string> = new Set(['primer', 'contrast']);

export class LegacyPowerBlockMigrationError extends Error {
  readonly code = 'legacy_power_block_unmigratable' as const;

  constructor(reason: string, readonly workoutId: string) {
    super(`[legacyPowerBlockMigration] ${reason} (workout ${workoutId})`);
    this.name = 'LegacyPowerBlockMigrationError';
  }
}

/**
 * The row a stored option becomes.
 *
 * Identity, dose and family/kind come from the stored block — this is a LIFT,
 * not a re-decision. Re-running `decidePowerPrimer` or `selectPowerExercise`
 * here would hand the athlete a different exercise or a different dose than the
 * one they were actually prescribed and may already have trained, which is a
 * silent rewrite wearing a migration's clothes.
 *
 * The two things the block never carried are supplied because the row era
 * requires them: the authored `role`, and the Section 18 evidence that keeps
 * `Explosive Push-up` from being read as a main lift by name.
 */
function rowFromOption(
  workout: Workout,
  option: { name: string; sets: number; repsMin: number; repsMax: number },
  family: 'lower' | 'upper',
  kind: 'primer' | 'contrast',
  index: number,
): WorkoutExercise {
  const slug = option.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const stamp = workout.updatedAt ?? workout.createdAt ?? '';
  return {
    id: `migrated-power-${workout.id}-${index}`,
    workoutId: workout.id,
    exerciseId: `migrated-power-${slug}`,
    // Power is pre-lift and leads the list; the row order carries that fact.
    exerciseOrder: 0,
    prescribedSets: option.sets,
    prescribedRepsMin: option.repsMin,
    prescribedRepsMax: option.repsMax,
    restSeconds: 120,
    notes: kind === 'contrast'
      ? 'Do this fresh, early in the session — before the main lifts. Contrast: perform sharply straight after your heavy set, then rest fully before the next round.'
      : 'Do this fresh, early in the session — before the main lifts.',
    role: 'power',
    power: { family, kind },
    section18Evidence: {
      protocolVersion: 1,
      role: 'power',
      strengthPattern: null,
      mainStrengthPattern: null,
      provenance: 'canonical_row_classifier',
    },
    exercise: {
      id: `migrated-power-${slug}`,
      name: option.name,
      description: option.name,
      muscleGroups: [],
      exerciseType: 'Plyometric',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: stamp,
      updatedAt: stamp,
    },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/**
 * Lift one workout's stored block into rows. Returns the SAME object when there
 * is nothing to do, so callers can apply it everywhere without copying a week.
 */
export function migrateStoredPowerBlock(workout: Workout): Workout {
  const block = workout.powerBlock;
  if (!block) return workout;

  if (hasPowerRow(workout)) {
    throw new LegacyPowerBlockMigrationError(
      'workout carries BOTH a stored powerBlock and power rows; nothing in the app ' +
      'can produce that, and choosing a winner would discard real prescribed work',
      workout.id,
    );
  }
  if (!FAMILIES.has(String(block.family))) {
    throw new LegacyPowerBlockMigrationError(
      `stored powerBlock has an unknown family "${block.family}"`,
      workout.id,
    );
  }
  if (!KINDS.has(String(block.kind))) {
    throw new LegacyPowerBlockMigrationError(
      `stored powerBlock has an unknown kind "${block.kind}"`,
      workout.id,
    );
  }
  const options = block.options ?? [];
  if (options.length === 0) {
    throw new LegacyPowerBlockMigrationError(
      'stored powerBlock carries no options, so there is no exercise to lift',
      workout.id,
    );
  }
  for (const option of options) {
    if (!String(option?.name ?? '').trim()) {
      throw new LegacyPowerBlockMigrationError(
        'stored powerBlock option has no exercise name',
        workout.id,
      );
    }
    if (!Number.isFinite(option.sets) || !Number.isFinite(option.repsMin) ||
        !Number.isFinite(option.repsMax)) {
      throw new LegacyPowerBlockMigrationError(
        `stored powerBlock option "${option.name}" has no usable dose`,
        workout.id,
      );
    }
  }

  const rows = options.map((option, index) =>
    rowFromOption(workout, option, block.family, block.kind, index));
  const { powerBlock: _lifted, ...rest } = workout;
  return { ...rest, exercises: [...rows, ...(workout.exercises ?? [])] };
}

/** Every workout in a list, migrated. Same array identity when nothing moved. */
export function migrateStoredPowerBlocks(
  workouts: readonly Workout[],
): Workout[] {
  let changed = false;
  const next = workouts.map((workout) => {
    const migrated = migrateStoredPowerBlock(workout);
    if (migrated !== workout) changed = true;
    return migrated;
  });
  return changed ? next : (workouts as Workout[]);
}

/** Whether anything in a list still carries the legacy field. The write guard. */
export function hasUnmigratedPowerBlock(
  workouts: readonly (Workout | null | undefined)[],
): boolean {
  return workouts.some((workout) => !!workout?.powerBlock);
}
