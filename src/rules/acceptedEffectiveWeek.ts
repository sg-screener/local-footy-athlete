import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';
import {
  resolveFinalVisibleSection18Week,
} from './section18AcceptedWeekGateway';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
} from './section18EffectiveWeekEvaluator';

export type AcceptedWeekSurfaceOwner = 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty';

export interface AcceptedEffectiveWeekSurfaces {
  currentProgram: TrainingProgram | null;
  currentMicrocycle?: Microcycle | null;
  dateOverrides: Readonly<Record<string, Workout>>;
  weekScopedOverlays: Readonly<Record<string, WeekScopedWorkoutOverlay>>;
}

export interface AcceptedEffectiveWeekDate {
  date: string;
  dayOfWeek: number;
  owner: AcceptedWeekSurfaceOwner;
  workout: Workout | null;
}

export interface AcceptedEffectiveWeekSnapshot {
  weekStart: string;
  weekEnd: string;
  baseMicrocycle: Microcycle | null;
  overlay: WeekScopedWorkoutOverlay | null;
  contract: WeeklyExposureContractV2;
  markedDays: Record<string, CalendarDayType>;
  dates: AcceptedEffectiveWeekDate[];
  composedWorkouts: Workout[];
  visibleWorkouts: Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  stablePlanEntryIds: string[];
}

export class AcceptedEffectiveWeekUnavailableError extends Error {
  readonly code = 'accepted_effective_week_unavailable';

  constructor(weekStart: string, detail: string) {
    super(`Accepted effective week unavailable for ${weekStart}: ${detail}`);
    this.name = 'AcceptedEffectiveWeekUnavailableError';
  }
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function microcycleForWeek(
  surfaces: AcceptedEffectiveWeekSurfaces,
  weekStart: string,
): Microcycle | null {
  return surfaces.currentProgram?.microcycles.find((candidate) =>
    weekStart >= candidate.startDate.slice(0, 10) &&
    weekStart <= candidate.endDate.slice(0, 10)) ?? (
    surfaces.currentMicrocycle &&
    weekStart >= surfaces.currentMicrocycle.startDate.slice(0, 10) &&
    weekStart <= surfaces.currentMicrocycle.endDate.slice(0, 10)
      ? surfaces.currentMicrocycle
      : null
  );
}

/**
 * Sole precedence owner for a currently accepted athlete-visible week.
 *
 * The returned mutation source is always date override > explicit overlay
 * entry (including null) > base microcycle, resolved once with the accepted
 * calendar marks and carried Contract v2.
 */
export function rebaseAcceptedEffectiveWeek(args: {
  surfaces: AcceptedEffectiveWeekSurfaces;
  weekStart: string;
  profile: OnboardingData | null | undefined;
  markedDays: Readonly<Record<string, CalendarDayType>>;
}): AcceptedEffectiveWeekSnapshot {
  const weekStart = args.weekStart.slice(0, 10);
  const weekEnd = addDays(weekStart, 6);
  const overlay = args.surfaces.weekScopedOverlays[weekStart] ?? null;
  const baseMicrocycle = microcycleForWeek(args.surfaces, weekStart);
  const contract = overlay?.exposureContractV2 ?? baseMicrocycle?.exposureContractV2;
  if (!contract) {
    throw new AcceptedEffectiveWeekUnavailableError(weekStart, 'Contract v2 is missing');
  }

  const dates: AcceptedEffectiveWeekDate[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(weekStart, offset);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const manual = args.surfaces.dateOverrides[date];
    const hasOverlayEntry = !!overlay && Object.prototype.hasOwnProperty.call(
      overlay.workoutsByDate,
      date,
    );
    const base = baseMicrocycle?.workouts.find((candidate) =>
      candidate.dayOfWeek === dayOfWeek) ?? null;
    dates.push(manual
      ? { date, dayOfWeek, owner: 'date_override', workout: manual }
      : hasOverlayEntry
        ? {
            date,
            dayOfWeek,
            owner: 'week_overlay',
            workout: overlay!.workoutsByDate[date] ?? null,
          }
        : base
          ? { date, dayOfWeek, owner: 'base_microcycle', workout: base }
          : { date, dayOfWeek, owner: 'empty', workout: null });
  }

  const composedWorkouts = dates.flatMap((entry) => entry.workout ? [entry.workout] : []);
  const markedDays = { ...args.markedDays };
  const visibleWorkouts = resolveFinalVisibleSection18Week({
    contract,
    workouts: composedWorkouts,
    weekStart,
    profile: args.profile ?? undefined,
    scheduleState: { markedDays },
  });
  const evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts: visibleWorkouts,
    weekStart,
  });

  return {
    weekStart,
    weekEnd,
    baseMicrocycle,
    overlay,
    contract,
    markedDays,
    dates,
    composedWorkouts,
    visibleWorkouts,
    evaluation,
    stablePlanEntryIds: visibleWorkouts.flatMap((workout) =>
      workout.planEntryId ? [workout.planEntryId] : []),
  };
}
