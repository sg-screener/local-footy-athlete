import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  UserRemovalConstraint,
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
import { applyUserRemovalConstraintsToWeek } from './userRemovalConstraints';
import { athletePlacementForDateOverride } from './athletePlacement';
import { composeDaySurfaces } from './dayPrecedence';
import type { DaySurfaceOwner } from './dayPrecedence';

/** Alias, not a second declaration — the owner set is `dayPrecedence`'s. */
export type AcceptedWeekSurfaceOwner = DaySurfaceOwner;

export interface AcceptedEffectiveWeekSurfaces {
  currentProgram: TrainingProgram | null;
  currentMicrocycle?: Microcycle | null;
  dateOverrides: Readonly<Record<string, Workout>>;
  weekScopedOverlays: Readonly<Record<string, WeekScopedWorkoutOverlay>>;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
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
    // Tier 2 of THE ordering, stated once in `rules/dayPrecedence.ts`. This
    // loop WAS the definition — the owner module was written from it verbatim,
    // so delegating here is behaviour-preserving by construction and every
    // accepted-state suite stays green untouched.
    const base = baseMicrocycle?.workouts.find((candidate) =>
      candidate.dayOfWeek === dayOfWeek) ?? null;
    dates.push(composeDaySurfaces({ date, dayOfWeek, dateOverrides: args.surfaces.dateOverrides, overlay, base }));
  }

  // OWNERSHIP TRAVELS WITH THE CONTENT, or the derivers downstream cannot ask.
  //
  // `dates` above knows exactly which days the athlete owns — `owner` is
  // computed one loop up. Flattening to a bare workout list used to throw that
  // away, and `resolveFinalVisibleSection18Week` then resolved with
  // `manualOverrides: {}` (rightly — the content is already composed), leaving
  // an athlete-owned day indistinguishable from a template day. The G+1
  // recovery deriver regenerated over it while the screen, which answers
  // ownership its own way, went on showing the athlete's session.
  //
  // `date_override` is an athlete-owned surface; `week_overlay` is not — a
  // scoped-regen overlay is authored by a source fact, not by the athlete — and
  // `base_microcycle` is the derived plan itself. An existing stamp always
  // wins: a session that arrived here carrying its constraint provenance keeps
  // it rather than being relabelled by the surface it happens to sit on.
  const composedWorkouts = applyUserRemovalConstraintsToWeek({
    workouts: dates.flatMap((entry) => {
      if (!entry.workout) return [];
      if (entry.owner !== 'date_override' || entry.workout.athletePlacement) {
        return [entry.workout];
      }
      return [{
        ...entry.workout,
        athletePlacement: athletePlacementForDateOverride({ placedDate: entry.date }),
      }];
    }),
    weekStart,
    constraints: args.surfaces.userRemovalConstraints,
  });
  const markedDays = { ...args.markedDays };
  const visibleWorkouts = resolveFinalVisibleSection18Week({
    contract,
    workouts: composedWorkouts,
    weekStart,
    profile: args.profile ?? undefined,
    scheduleState: { markedDays },
    userRemovalConstraints: args.surfaces.userRemovalConstraints,
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
