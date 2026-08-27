/** Compatibility adapter for candidate validation and historical diagnostics.
 * Live day/week screens receive the fully compiled result from the resolver. */
import type { ResolvedDay } from './sessionResolver';
import { logger } from './logger';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { compileCanonicalDayConstraints, type CanonicalDayConstraintInput as ProjectInput, type CanonicalDayConstraintOutcome as ProjectOutcome } from '../rules/canonicalWeeklyConstraintCompiler';
export type { ProjectInput, ProjectOutcome };
export function projectVisibleDay(input: ProjectInput): ProjectOutcome {
  return compileCanonicalDayConstraints({ ...input, modalityPreferences: input.modalityPreferences ?? useCoachPreferencesStore.getState().modalityPreferences });
}

/**
 * Convenience wrapper that logs at the visible boundary and returns
 * the projected day. Use this from screen-level hooks/components.
 */
export function projectAndLog(
  input: ProjectInput & { surface?: 'home' | 'detail' | 'calendar' },
): ResolvedDay {
  const surface = input.surface ?? 'home';
  const traceEnabled =
    process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS === 'true' &&
    process.env.DEBUG_SCHEDULE_TRACE === 'true';
  if (!traceEnabled) {
    return projectVisibleDay(input).day;
  }
  const beforeExercises = (input.day.workout?.exercises ?? [])
    .map((e: any) => e.exercise?.name)
    .filter(Boolean);
  logger.debug('[visible-program] project_input', {
    surface,
    date: input.day.date,
    source: input.day.source,
    workoutName: input.day.workout?.name ?? null,
    beforeExercises,
    extraConstraintIds: (input.extraConstraints ?? []).map((c) => c.id),
    overrideContextIntent: input.overrideContext?.intent ?? null,
  });
  const out = projectVisibleDay(input);
  const afterExercises = (out.day.workout?.exercises ?? [])
    .map((e: any) => e.exercise?.name)
    .filter(Boolean);
  logger.debug('[visible-program] project_output', {
    surface,
    date: out.day.date,
    workoutName: out.day.workout?.name ?? null,
    beforeExercises,
    afterExercises,
    coachNotes: out.day.workout?.coachNotes ?? [],
    injuryFilterApplied: out.injuryFilterApplied,
    removedByName: out.removedNames,
    replacedByName: out.replacementNames,
  });
  return out.day;
}
