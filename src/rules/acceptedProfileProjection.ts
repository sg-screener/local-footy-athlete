import type { OnboardingData } from '../types/domain';
import type {
  ActiveConstraint,
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';

export const ACCEPTED_PROFILE_CONSTRAINT_PREFIX = 'accepted-profile-projection:';

export function isAcceptedProfileConstraint(
  constraint: ActiveConstraint,
): boolean {
  return constraint.id.startsWith(ACCEPTED_PROFILE_CONSTRAINT_PREFIX);
}

export function composeAcceptedProfileConstraints(
  profile: OnboardingData,
  now: string,
): ActiveScheduleConstraint[] {
  return (profile.availabilityConstraints ?? [])
    .filter((constraint) => constraint.scope === 'permanent' && constraint.active !== false)
    .map((constraint): ActiveScheduleConstraint | null => {
      const base = {
        id: `${ACCEPTED_PROFILE_CONSTRAINT_PREFIX}${constraint.id}`,
        type: 'schedule' as const,
        severity: 5,
        status: 'active' as const,
        startDate: constraint.startDate?.slice(0, 10) ?? '0000-01-01',
        lastUpdatedAt: constraint.updatedAt ?? now,
        source: 'tap' as const,
        expiresAt: constraint.endDate?.slice(0, 10),
        modifierAffects: ['current_week', 'future_generation'] as
          ActiveScheduleConstraint['modifierAffects'],
        rules: [] as string[],
        safeFocus: ['Eligible available days', 'Highest-priority work'],
        advice: [] as string[],
      };
      if (constraint.kind === 'unavailable_day' && constraint.dayOfWeek) {
        return {
          ...base,
          scheduleKind: 'unavailable_weekdays',
          unavailableWeekdays: [constraint.dayOfWeek],
          reasonLabel: `${constraint.dayOfWeek} unavailable`,
          modifierTitle: `${constraint.dayOfWeek} unavailable`,
          modifierBody: `Your accepted profile marks ${constraint.dayOfWeek} unavailable.`,
          rules: [`unavailable weekday: ${constraint.dayOfWeek}`],
        };
      }
      if (constraint.kind === 'time_limit' && constraint.dayOfWeek &&
        constraint.maxSessionMinutes) {
        return {
          ...base,
          scheduleKind: 'time_cap',
          maxSessionMinutes: constraint.maxSessionMinutes,
          timeCapWeekdays: [constraint.dayOfWeek],
          reasonLabel: `${constraint.maxSessionMinutes}-minute permanent cap`,
          modifierTitle: `${constraint.dayOfWeek} time cap`,
          modifierBody: `${constraint.dayOfWeek} sessions are capped at ${constraint.maxSessionMinutes} minutes.`,
          rules: [`maximum session duration ${constraint.maxSessionMinutes} minutes`],
        };
      }
      if (constraint.kind === 'travel') {
        return {
          ...base,
          scheduleKind: 'travel',
          unavailableDates: constraint.startDate && constraint.endDate
            ? datesBetween(constraint.startDate, constraint.endDate)
            : [],
          reasonLabel: 'Permanent travel availability',
          modifierTitle: 'Travel availability active',
          modifierBody: 'Your accepted profile contains a bounded travel period.',
        };
      }
      return null;
    })
    .filter((constraint): constraint is ActiveScheduleConstraint => !!constraint)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function datesBetween(from: string, until: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from.slice(0, 10)}T12:00:00`);
  const end = until.slice(0, 10);
  while (dates.length < 370) {
    const date = cursor.toISOString().slice(0, 10);
    if (date > end) break;
    dates.push(date);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
