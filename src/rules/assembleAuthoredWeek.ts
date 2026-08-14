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
  /**
   * Strength rows on a composed day that the composer did not declare.
   * **The slice's acceptance gate asserts this is 0.** Anything else means the
   * retained adapter is still authoring lifts.
   */
  readonly retainedStrengthRows: number;
}

/** Roles the COMPOSER owns. Every other row on the day is the adapter's. */
const COMPOSER_OWNED_ROLES = new Set(['main_strength', 'strength_accessory']);

function rowRole(row: unknown): string | null {
  const typed = row as { section18Evidence?: { role?: string }; role?: string };
  return typed.section18Evidence?.role ?? typed.role ?? null;
}

/**
 * ⚠ A COMBINED DAY IS TWO OWNERS, NOT ONE — AND THE ADAPTER'S HALF IS MORE THAN
 * A CONDITIONING BLOCK.
 *
 * **THIS FUNCTION USED TO COPY ONE FIELD, AND THAT COST THREE SESSIONS.** It
 * took `conditioningBlock` from the adapter's day and threw the rest of that
 * day away — including **`speedBlock`, which is the app's ONLY source of sprint
 * credit** (`section18EffectiveWeekEvaluator.ts:670`). A composed week
 * therefore lost its sprint night and was refused
 * `required_minimum_shortfall:sprint_high_speed:0`, and because the refusal
 * arrived with a null `section18Evidence` on the same day, the envelope got the
 * blame. Measured 2026-08-14: that envelope is inert — `null` and
 * `{conditioningRole:'none'}` are the same statement at
 * `section18EffectiveWeekEvaluator.ts:317-318`, and its `provenance` field has
 * no reader anywhere in the repo.
 *
 * **SO THE MERGE IS THE OTHER WAY UP.** The adapter's day is the BASE — it
 * carries the whole non-strength envelope it always built — and the composer
 * overlays what it owns: the strength rows, and the session's identity.
 * Nothing about a composed row is reinterpreted; nothing the adapter authored
 * for that day is silently dropped.
 */
function mergeOntoAdapterDay(composed: Workout, adapter: Workout | undefined): Workout {
  if (!adapter) return composed;
  const adapterRows = (adapter.exercises ?? []).filter(
    (row) => !COMPOSER_OWNED_ROLES.has(rowRole(row) ?? ''));
  const composerRows = composed.exercises ?? [];
  // Power leads, then the lifts, then everything else the day carries. That is
  // the order the app already renders and the order the counting fence expects.
  const power = adapterRows.filter((row) => rowRole(row) === 'power');
  const rest = adapterRows.filter((row) => rowRole(row) !== 'power');
  const exercises = [...power, ...composerRows, ...rest]
    .map((row, index) => ({ ...row, exerciseOrder: index + 1 }));
  const adapterAny = adapter as unknown as Record<string, unknown>;
  const carriedConditioning = adapterAny.conditioningBlock;
  return {
    // THE ADAPTER'S DAY IS THE BASE, so every non-strength thing it built —
    // `speedBlock` above all — survives by NOT being enumerated away.
    ...adapter,
    // ── BUT IDENTITY IS THE COMPOSER'S, AND THIS IS NOT COSMETIC ────────────
    //
    // **MEASURED 2026-08-14: taking the adapter's identity too cost 12 worlds.**
    // Deprived of its lifts, the adapter types a composed lower-body day as
    // `workoutType: 'Conditioning'` with `conditioningRole: 'optional_flush'` —
    // it is describing the seed it was left with, not the session that exists.
    // §18 then reads a strength day as a flush and refuses the week for missing
    // main strength. The composer knows what it built; the adapter no longer
    // does.
    name: composed.name,
    description: composed.description,
    // ⚠ A DAY THAT CARRIES BOTH IS `Mixed`, AND THE BOOT ALREADY KNEW THAT.
    //
    // The composer types its day `Strength` because strength is all it authors.
    // When the adapter has hung conditioning on the same day, the day is not a
    // strength day any more — and `programHydrationProjection` retypes it
    // `Mixed` at the store boundary regardless. Measured by the boot receipt:
    // leaving the composer's type here made generation and relaunch disagree on
    // exactly one field, which is two owners for one fact.
    workoutType: carriedConditioning ? 'Mixed' : composed.workoutType,
    sessionTier: composed.sessionTier,
    intensity: composed.intensity,
    planEntryId: composed.planEntryId ?? adapter.planEntryId,
    // ── AND THE ENVELOPE ONLY SPEAKS WHERE IT HAS SOMETHING TO SAY ──────────
    //
    // The adapter's workout-level `section18Evidence` describes ITS content. It
    // is kept only when the adapter actually contributed conditioning to this
    // day; otherwise it is dropped, because an absent envelope and
    // `conditioningRole: 'none'` are the same statement
    // (`section18EffectiveWeekEvaluator.ts:317-318`) and keeping a stale
    // `optional_flush` is a false one.
    ...(carriedConditioning
      ? {}
      : { section18Evidence: undefined, conditioningCategory: undefined,
          hasCombinedConditioning: false }),
    exercises,
  } as Workout;
}

export function assembleAuthoredWeek(input: AssembleAuthoredWeekInput): AuthoredWeek {
  const composedDays = new Set(input.composerWorkouts.map((workout) => workout.dayOfWeek));
  const adapterByDay = new Map(
    input.adapterWorkouts.map((workout) => [workout.dayOfWeek, workout]),
  );

  const merged = input.composerWorkouts.map((workout) =>
    mergeOntoAdapterDay(workout, adapterByDay.get(workout.dayOfWeek)));
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
  // THE GATE THIS FILE EXISTS TO MAKE CHECKABLE: after assembly, not one
  // strength row on a composed day may belong to the retained adapter.
  const retainedStrengthRows = workouts
    .filter((workout) => composedDays.has(workout.dayOfWeek))
    .flatMap((workout) => workout.exercises ?? [])
    .filter((row) => COMPOSER_OWNED_ROLES.has(rowRole(row) ?? '')
      && (row as unknown as { section18Evidence?: { provenance?: string } })
        .section18Evidence?.provenance !== 'composer_declaration').length;
  return { workouts, provenance, retainedStrengthRows };
}
