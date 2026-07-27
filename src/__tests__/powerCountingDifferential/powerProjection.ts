/**
 * The ONE representation-aware seam in the power differential harness.
 *
 * Everything else the harness records — taxonomy units, weekly exposure counts,
 * session components, finisher counts, counted-row budgets, §18 keep/strip —
 * is read through production APIs that must not change at all across the
 * power-row redesign. This file is the deliberate exception: it answers
 * "what power work does the athlete have on this day, and what dose" WITHOUT
 * committing to where that fact is stored.
 *
 * Stage 1-2  → reads `workout.powerBlock` (power is a block beside the list).
 * Stage 3-5  → reads `role: 'power'` rows out of `workout.exercises[]`.
 *
 * Both stages must produce the SAME projection for the same scenario. That is
 * the whole point: the snapshot is representation-neutral, so a diff means the
 * athlete's power work actually changed, not that it moved house.
 *
 * Sam's counting fence lives here too, in projected form. `hardExposure: false,
 * mainStrength: false, conditioningCredit: 'none', isFinisher: false` is
 * recorded per power item so a stage that silently drops the fence — or lets a
 * power row start earning main-strength proof, the `Explosive Push-up` trap —
 * shows up as a snapshot diff rather than as a quiet behaviour change.
 */

import type { Workout } from '../../types/domain';

export interface ProjectedPowerFence {
  hardExposure: boolean;
  mainStrength: boolean;
  conditioningCredit: string;
  isFinisher: boolean;
}

export interface ProjectedPowerItem {
  /** Identity — what the athlete is told to do. */
  exercise: string;
  /** Dose — owned by `powerPrimerPolicy`, never by the pool. */
  sets: number;
  repsMin: number;
  repsMax: number;
  equipmentRequired: string[];
}

export interface ProjectedPower {
  kind: string;
  family: string;
  title: string;
  prescription: string;
  placement: string;
  items: ProjectedPowerItem[];
  notes: string[];
  fence: ProjectedPowerFence;
}

/**
 * Project a day's power work, or null when the day carries none.
 *
 * Reads the CURRENT representation (`workout.powerBlock`). When power becomes a
 * row this function changes and nothing else in the harness does.
 */
export function projectPower(
  workout: Partial<Workout> | null | undefined,
): ProjectedPower | null {
  const block = workout?.powerBlock;
  if (!block) return null;
  return {
    kind: block.kind,
    family: block.family,
    title: block.title,
    prescription: block.prescription,
    placement: block.placement,
    items: block.options.map((option) => ({
      exercise: option.name,
      sets: option.sets,
      repsMin: option.repsMin,
      repsMax: option.repsMax,
      equipmentRequired: [...option.equipmentRequired].sort(),
    })),
    notes: [...block.notes],
    fence: {
      hardExposure: block.counting.hardExposure,
      mainStrength: block.counting.mainStrength,
      conditioningCredit: block.counting.conditioningCredit,
      isFinisher: block.counting.isFinisher,
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
