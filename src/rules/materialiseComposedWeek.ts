/**
 * THE HANDOVER — `ComposedWeek` in, domain `Workout` rows out. Pure.
 *
 * **THIS IS THE BOUNDARY THE PREVIOUS THREE SESSIONS DID NOT BUILD.** Until now
 * the composer's week was flattened into `CoachGeneratedWorkoutInput` and handed
 * to `buildWorkoutsFromCoach` — the legacy builder — which re-dosed every row,
 * rewrote identities and dropped some of them entirely. **No composer-authored
 * row passes through that builder any more.**
 *
 * **IT REINTERPRETS NOTHING.** Identity, order, role, pattern, dose category,
 * sets, reps and load arrive already decided (`composeWeek` + `composedDose`)
 * and are copied. The only things minted here are ids and timestamps, which are
 * not composition.
 */
import { findOrCreateExercise } from '../data/defaultProgram';
import {
  applyStrengthDeloadToExercises,
  type DeloadWeekPolicy,
} from './deloadWeekRules';
import type { ComposedDay, ComposedGap, ComposedWeek } from './composeWeek';
import type { Workout, WorkoutExercise } from '../types/domain';

export interface MaterialisationContext {
  readonly microcycleId: string;
  /** Plan tiers/names arrive on the composed day; nothing is renamed here. */
  readonly weekStartISO: string;
  /**
   * THE GOVERNED DOSE INSTRUCTION FOR THIS DAY — deload, readiness or illness.
   *
   * **This exists because the resolved policy reached only the retained
   * adapter.** `buildWorkoutsFromCoach` applied `applyStrengthDeloadToExercises`
   * to the rows it built; composer rows never enter that builder, so a composed
   * week was the ONLY week in the app whose strength ignored an active deload,
   * an illness reduction or a readiness window. An athlete told the app they
   * were ill and their lifts did not move.
   *
   * **IT IS A FUNCTION OF THE DAY, NOT THE WEEK — R-035.** A readiness
   * declaration governs its dated window; a Thursday declaration must not
   * retro-deload Monday. The caller resolves that with the existing owner's own
   * predicate and hands the answer down; nothing here re-derives a window.
   *
   * Null for a day the instruction does not govern. Absent for an ordinary week,
   * which is why an ordinary week is byte-identical.
   */
  readonly deloadPolicyForDay?: (dayOfWeek: number) => DeloadWeekPolicy | null;
}

/** The composer's own provenance, carried onto every row it authored. */
export const COMPOSER_ROW_PROVENANCE = 'composer_declaration' as const;

function materialiseRow(
  row: ComposedDay['rows'][number],
  workoutId: string,
  index: number,
): WorkoutExercise {
  const exercise = findOrCreateExercise(row.identity);
  const stamp = new Date().toISOString();
  return {
    id: `we-${workoutId}-${index}`,
    workoutId,
    exerciseId: exercise.id,
    exerciseOrder: index + 1,
    prescribedSets: row.sets,
    prescribedRepsMin: row.repsMin,
    prescribedRepsMax: row.repsMax,
    prescribedWeightKg: row.load,
    restSeconds: 0,
    exercise,
    createdAt: stamp,
    updatedAt: stamp,
    // The composer DECIDES the role (R-092); §18 reads this rather than
    // re-inferring it from the exercise name.
    section18Evidence: {
      protocolVersion: 1,
      role: row.role,
      strengthPattern: row.mainStrengthPattern,
      mainStrengthPattern: row.role === 'main_strength' ? row.mainStrengthPattern : null,
      provenance: COMPOSER_ROW_PROVENANCE,
    },
    ...(row.qualityLimit ? { notes: 'Stop when speed or technique drops.' } : {}),
  } as unknown as WorkoutExercise;
}

/**
 * ⚠ THE TYPED GAP CARRIER, AND IT HAS ONE OWNER.
 *
 * `composedGaps` sits on the WORKOUT because a gap names a DAY — *"no vertical
 * pull on Tuesday, you'd need a pull-up bar"*. Putting the same fact on the
 * microcycle and the program as well would be three representations of one
 * decision, which is what `NORTH_STAR.md` presumes wrong; the day is the
 * smallest shape that can carry it truthfully.
 *
 * **MEASURED BEFORE THIS EXISTED: 176 typed gaps across 86 worlds were composed
 * and NONE survived materialisation**, because `CoachGeneratedWorkoutInput` had
 * no field to put them in and the adapter simply dropped them.
 */
function gapsForDay(week: ComposedWeek, dayOfWeek: number): readonly ComposedGap[] {
  return week.gaps.filter((gap) => gap.dayOfWeek === dayOfWeek);
}

export function materialiseComposedWeek(
  week: ComposedWeek,
  context: MaterialisationContext,
): Workout[] {
  return week.days.map((day) => {
    const workoutId = `w-composed-${context.microcycleId}-${day.dayOfWeek}`;
    const gaps = gapsForDay(week, day.dayOfWeek);
    const composedRows = day.rows.map((row, index) => materialiseRow(row, workoutId, index));
    // ── THE GOVERNED DOSE, APPLIED ONCE, BY THE EXISTING OWNER ──────────────
    //
    // **`applyStrengthDeloadToExercises` is the app's ONE deload arithmetic and
    // it is called here rather than reimplemented inside the composer.** The
    // mission forbids a second deload table, and re-deriving "half the sets,
    // keep 2-3 accessories or half whichever is less, hold the weight unless
    // the athlete is beat up" in a second place is exactly that table.
    //
    // ONCE: composer rows never enter `buildWorkoutsFromCoach`, so this is the
    // only place the law reaches them. The adapter's own rows are deloaded on
    // its side, as they always were.
    //
    // A day the instruction does not govern gets `null` and is untouched —
    // which is what keeps an ordinary week byte-identical.
    const policy = context.deloadPolicyForDay?.(day.dayOfWeek) ?? null;
    const exercises = policy
      ? applyStrengthDeloadToExercises(composedRows, policy)
      : composedRows;
    return {
      id: workoutId,
      microcycleId: context.microcycleId,
      dayOfWeek: day.dayOfWeek,
      name: day.name,
      description: '',
      // A deloaded day is not a High-intensity day. The intensity ceiling is
      // the policy's, not the composer's optimism.
      intensity: policy ? 'Moderate' : 'High',
      workoutType: day.workoutType,
      sessionTier: day.sessionTier,
      planEntryId: day.planEntryId,
      durationMinutes: 0,
      exercises,
      ...(gaps.length > 0 ? { composedGaps: gaps } : {}),
    } as unknown as Workout;
  });
}
