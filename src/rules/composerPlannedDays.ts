/**
 * THE PLANNER → COMPOSER ADAPTER. Plan in, composer input out. Pure, and
 * deliberately thin: it names no exercise, chooses no dose and drops no row.
 * Every decision belongs to `composeWeek`; this only changes shape.
 *
 * **THIS FILE USED TO HOLD ITS OWN OPPOSITE, AND THAT HALF IS DELETED
 * (2026-08-14).** `composedWeekToCoachInputs` converted the composer's finished
 * week BACK into `CoachGeneratedWorkoutInput` so the legacy builder could
 * rebuild it — re-dosing every row, re-inferring every role and stamping the
 * acceptance envelope as a by-product. That conversion was the last thing
 * standing between the composer and the athlete. Composer rows now reach domain
 * `Workout`s directly through `materialiseComposedWeek` +
 * `assembleAuthoredWeek`, so the round trip has no caller and is gone, along
 * with the `composed: true` marker that only existed to make the legacy passes
 * stand down over rows they should never have seen.
 */
import type { SessionAllocation } from '../utils/coachingEngine';
import type { ComposerPlannedDay } from './composeWeek';

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
      isTeamDay: entry.isTeamDay === true,
      planEntryId: entry.planEntryId ?? '',
      strengthIntent: entry.strengthIntent,
      name: String(entry.focus ?? ''),
      workoutType: entry.isTeamDay ? 'Team Training' : 'Strength',
      sessionTier: String(entry.tier ?? 'core'),
    });
  }
  return out;
}
