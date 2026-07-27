/**
 * The ONE representation-aware seam in the power differential harness.
 *
 * Everything else the harness records — taxonomy units, weekly exposure counts,
 * session components, finisher counts, counted-row budgets, §18 keep/strip — is
 * read through production APIs that must not change at all across the
 * power-row redesign. This file is the deliberate exception: it answers "what
 * power work does the athlete have on this day, and what dose" WITHOUT
 * committing to where that fact is stored.
 *
 * Stage 1-2  → read `workout.powerBlock` (power was a block beside the list).
 * Stage 3+   → reads `role: 'power'` rows out of `workout.exercises[]`.  ← HERE
 *
 * FLIPPED AT STAGE 3, which is the whole reason the seam exists. Every other
 * recorded value had to survive the flip untouched; the golden's power entries
 * changed shape exactly once, here, and that change is the redesign rather than
 * a regression.
 *
 * ## What the fence looks like now
 *
 * It used to be a stored object on the block: `hardExposure: false,
 * mainStrength: false, conditioningCredit: 'none', isFinisher: false`. That
 * object was documentation — the real guarantee was that power was not in the
 * list every counter iterates.
 *
 * Now the guarantee is the role, and this projection records something
 * STRONGER than the old copied object: whether the production choke point
 * actually excludes the row, and what §18 evidence it carries. A stored `false`
 * could lie; `participatesInCounting(row) === false` is the counters' own
 * answer.
 */

import type { Workout } from '../../types/domain';
import { participatesInCounting, powerRows } from '../../rules/sessionRowCounting';

export interface ProjectedPowerItem {
  /** Identity — what the athlete is told to do. */
  exercise: string;
  /** Dose — owned by `powerPrimerPolicy`, never by the pool. */
  sets: number;
  repsMin: number;
  repsMax: number;
  equipmentRequired: string[];
  /** Placement in the one list. Power is pre-lift, so this should lead. */
  order: number;
}

export interface ProjectedPower {
  kind: string;
  family: string;
  items: ProjectedPowerItem[];
  notes: string[];
  /**
   * The fence as the row era states it — measured, not copied.
   *
   * `countedByAnything` is the production choke point's own verdict, and
   * `section18Role` is what the §18 evaluator sees. If either ever reads
   * differently the athlete's power has started earning credit its fence denies,
   * and the golden says so.
   */
  fence: {
    role: string;
    countedByAnything: boolean;
    section18Role: string | null;
  };
}

/**
 * Project a day's power work, or null when the day carries none.
 *
 * Reads the CURRENT representation (`role: 'power'` rows). Multiple power rows
 * on one day are projected as one entry with several items — the shape the block
 * era used for its options list, so the recorded structure stays comparable.
 */
export function projectPower(
  workout: Partial<Workout> | null | undefined,
): ProjectedPower | null {
  const rows = powerRows(workout);
  if (rows.length === 0) return null;
  const primary = rows[0];
  return {
    kind: primary.power?.kind ?? 'unknown',
    family: primary.power?.family ?? 'unknown',
    items: rows.map((row) => ({
      exercise: String(row.exercise?.name ?? ''),
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      equipmentRequired: [...(row.exercise?.equipmentRequired ?? [])].sort(),
      order: row.exerciseOrder,
    })),
    notes: rows.map((row) => row.notes ?? '').filter(Boolean),
    fence: {
      role: String(primary.role ?? ''),
      countedByAnything: rows.some(participatesInCounting),
      section18Role: primary.section18Evidence?.role ?? null,
    },
  };
}

/** Days in a week that carry power, by `dayOfWeek`. Used for §18 keep/strip. */
export function powerDays(workouts: readonly Workout[]): number[] {
  return workouts
    .filter((workout) => projectPower(workout) !== null)
    .map((workout) => workout.dayOfWeek)
    .sort((a, b) => a - b);
}
