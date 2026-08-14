/**
 * THE ADAPTER — plan in, composer in, builder input out. Pure, and deliberately
 * thin: it names no exercise, chooses no dose and drops no row. Every decision
 * belongs to `composeWeek`; this only changes shape.
 *
 * `composed: true` travels on each produced workout so the passes downstream can
 * stand down (clause f): `applyPoolRotation` does not rewrite a composed row and
 * the canonicaliser does not remove or restore one.
 */
import type { CoachGeneratedWorkoutInput } from '../data/defaultProgram';
import type { SessionAllocation } from '../utils/coachingEngine';
import type { ComposedWeek, ComposerPlannedDay } from './composeWeek';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The planner's strength days, in the composer's own input shape. */
export function composedPlannedDaysFrom(
  weeklyPlan: readonly SessionAllocation[],
): ComposerPlannedDay[] {
  const out: ComposerPlannedDay[] = [];
  for (const entry of weeklyPlan) {
    const dayOfWeek = DAY_NAMES.indexOf(String(entry.dayOfWeek ?? ''));
    if (dayOfWeek < 0 || !entry.strengthIntent?.plannedPatterns?.length) continue;
    out.push({
      dayOfWeek,
      planEntryId: entry.planEntryId ?? '',
      strengthIntent: entry.strengthIntent,
      name: String(entry.focus ?? ''),
      workoutType: entry.isTeamDay ? 'Team Training' : 'Strength',
      sessionTier: String(entry.tier ?? 'core'),
    });
  }
  return out;
}

export function composedWeekToCoachInputs(week: ComposedWeek): CoachGeneratedWorkoutInput[] {
  return week.days.map((day) => ({
    composed: true,
    planEntryId: day.planEntryId,
    strengthIntent: undefined,
    dayOfWeek: day.dayOfWeek,
    name: day.name,
    workoutType: day.workoutType,
    sessionTier: day.sessionTier,
    exercises: day.rows.map((row) => ({
      name: row.identity,
      sets: row.sets,
      repsMin: row.repsMin,
      repsMax: row.repsMax,
    })),
  }));
}
