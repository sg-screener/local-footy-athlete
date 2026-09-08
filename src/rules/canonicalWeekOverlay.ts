import type { TrainingProgram, Workout, WeekScopedWorkoutOverlay } from '../types/domain';
import { addDaysISO as addDays } from '../utils/programBlockState';

function cloneWorkoutForOverlay(
  workout: Workout,
  date: string,
  overlayId: string,
): Workout {
  const suffix = `:week-overlay:${date}`;
  const id = workout.id.endsWith(suffix) ? workout.id : `${workout.id}${suffix}`;
  const dow = new Date(`${date}T12:00:00`).getDay();
  return {
    ...workout,
    id,
    microcycleId: overlayId,
    dayOfWeek: dow,
    exercises: (workout.exercises ?? []).map((exercise) => ({
      ...exercise,
      workoutId: id,
    })),
  };
}

export function compileWeekOverlay(args: {
  program: TrainingProgram;
  weekStart: string;
  anchorDate: string | null;
  reason: WeekScopedWorkoutOverlay['reason'];
  authoredAtISO: string;
}): WeekScopedWorkoutOverlay {
  const sourceMicrocycle = args.program.microcycles?.[0];
  if (!sourceMicrocycle) {
    throw new Error('Cannot build week overlay without a source microcycle');
  }

  const now = args.authoredAtISO;
  const overlayId = `week-overlay:${args.weekStart}:${args.reason}:${args.anchorDate ?? 'no-anchor'}`;
  const byDow = new Map<number, Workout>();
  for (const workout of sourceMicrocycle.workouts ?? []) {
    byDow.set(workout.dayOfWeek, workout);
  }

  const workoutsByDate: Record<string, Workout | null> = {};
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(args.weekStart, offset);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const workout = byDow.get(dow) ?? null;
    workoutsByDate[date] = workout ? cloneWorkoutForOverlay(workout, date, overlayId) : null;
  }

  return {
    id: overlayId,
    weekStart: args.weekStart,
    weekEnd: addDays(args.weekStart, 6),
    anchorDate: args.anchorDate,
    reason: args.reason,
    // NO v1 CONTRACT ON A NEW OVERLAY (L15, Sam's D-1 ruling 2026-08-05).
    // This copied `sourceMicrocycle.exposureContract` verbatim, and because
    // hydrate re-materialises fixture-mark overlays through here, a superseded
    // shape was written on launches — L15's subject exactly ("superseded
    // formats are never written again, by anything, ever"). The V2 lift below
    // is a READ-INGRESS lift, which is the sanctioned direction: it migrates a
    // legacy microcycle's v1 into the current shape on the way in. Nothing
    // reads an overlay's v1 field — every consumer falls back to the
    // microcycle's — so the copy bought nothing but a stale second home.
    // The microcycle-level writer is what remains, and it is filed as LR-30.
    // LEG (v) WRITER, PRICING SCAFFOLD — publication site 1 of 2. The
    // DECLARATION retires at its OWNER, not at one call site; both sites
    // retire together or the world is half-stored. The readers already derive
    // (leg (v)'s read half, landed at 8ca5ae24) and the reduction-ownership
    // consumers already derive (08212473). Inert without the flag.
    // The persisted v1 -> v2 upgrade is deleted (demolition area 4): a stored
    // world predating the v2 declaration has no one to serve.
    // R-229 S5: the LEGV writer flag is DEMOLISHED, un-landed. Its premise
    // ("the stored declaration stops being written") belonged to a world where
    // the declaration was one durable input; boot now regenerates the program
    // wholesale under live facts, so the declaration is re-authored per boot
    // and every judge derives on read (S4c) — retiring this write would only
    // blind the cannot-derive fallback. Priced, measured, and closed.
    exposureContractV2: sourceMicrocycle.exposureContractV2,
    restDayReasonByDay: sourceMicrocycle.restDayReasonByDay,
    workoutsByDate,
    createdAt: now,
    updatedAt: now,
  };
}
