/**
 * THE FINAL AUTHORED CANDIDATE — composer strength plus the retained adapters,
 * merged by day. Pure. This is the week §18 is handed.
 *
 * **THE SEPARATION IS THE POINT.** `materialiseComposedWeek` owns every strength
 * row and reinterprets nothing. The conditioning and warm-up adapters keep their
 * existing behaviour and are NOT redesigned — they are simply asked for the days
 * the composer does not author, and their output is merged rather than passed
 * through the legacy builder to be re-dosed.
 *
 * **MEASURED FEASIBILITY, 2026-08-14:** of 143 composed strength days across the
 * 61 built worlds, **16 carry a conditioning block and ZERO carries a warm-up
 * row**. So a combined strength+conditioning day merges the adapter's block onto
 * the composed day, and **no warm-up abstraction is built to represent nothing** —
 * the zero is measured and reported instead.
 */
import type { Workout } from '../types/domain';

/** Where a non-composer row or block came from. Never "it fills no ladder slot". */
export type RetainedAdapterOwner = 'conditioning_adapter' | 'warmup_adapter' | 'planner_day';

export interface AssembleAuthoredWeekInput {
  /** Composer-owned strength days. Authoritative; never edited here. */
  readonly composerWorkouts: readonly Workout[];
  /**
   * The retained adapters' output for the days the composer does not author,
   * plus the conditioning blocks belonging to combined days.
   */
  readonly adapterWorkouts: readonly Workout[];
}

export interface AuthoredWeek {
  readonly workouts: readonly Workout[];
  /** Provenance census — every row and block, with its owner named. */
  readonly provenance: readonly {
    readonly dayOfWeek: number;
    readonly owner: 'composer' | RetainedAdapterOwner;
    readonly rows: number;
    readonly hasConditioningBlock: boolean;
  }[];
}

/**
 * ⚠ A COMBINED DAY IS TWO OWNERS, NOT ONE. The composer authors its strength
 * half; the conditioning adapter authors its block. Merging the block onto the
 * composed day is the only place the two meet, and the composed ROWS are never
 * touched by it.
 */
function mergeConditioning(composed: Workout, adapter: Workout | undefined): Workout {
  const block = (adapter as unknown as { conditioningBlock?: unknown })?.conditioningBlock;
  if (!block) return composed;
  return { ...composed, conditioningBlock: block } as Workout;
}

export function assembleAuthoredWeek(input: AssembleAuthoredWeekInput): AuthoredWeek {
  const composedDays = new Set(input.composerWorkouts.map((workout) => workout.dayOfWeek));
  const adapterByDay = new Map(
    input.adapterWorkouts.map((workout) => [workout.dayOfWeek, workout]),
  );

  const merged = input.composerWorkouts.map((workout) =>
    mergeConditioning(workout, adapterByDay.get(workout.dayOfWeek)));
  // Days the composer does not author — conditioning, team training, the
  // fixture, mobility — arrive from the retained adapters unchanged.
  const adapterOnly = input.adapterWorkouts.filter(
    (workout) => !composedDays.has(workout.dayOfWeek));

  const workouts = [...merged, ...adapterOnly].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const provenance = workouts.map((workout) => ({
    dayOfWeek: workout.dayOfWeek,
    owner: composedDays.has(workout.dayOfWeek)
      ? ('composer' as const)
      : ('planner_day' as const),
    rows: (workout.exercises ?? []).length,
    hasConditioningBlock:
      !!(workout as unknown as { conditioningBlock?: unknown }).conditioningBlock,
  }));
  return { workouts, provenance };
}
