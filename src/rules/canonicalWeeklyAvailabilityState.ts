/**
 * ONE SEMANTIC ANSWER TO "WHAT CAN THIS ATHLETE REACH THIS WEEK?"
 *
 * The athlete stores dated schedule and equipment facts. This module translates
 * those inputs once for one Monday-start week. The compiler then applies the
 * answer to scheduling, contracts, conditioning and composition; none of those
 * consumers re-read constraint words or date ranges.
 */
import type { EquipmentTag } from '../data/exercisePools';
import type {
  ActiveConstraint,
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import type {
  ConditioningEquipmentModality,
  OnboardingData,
} from '../types/domain';
import type { CoachingInputs } from '../utils/coachingEngine';
import {
  resolveEquipmentCapabilities,
  type ResolvedEquipmentCapabilities,
} from '../utils/equipmentAvailability';
import { isoDateForWeekday } from '../utils/appDate';
import { awaySpansFromConstraints, dateIsInsideAwaySpan } from './awaySpans';
import type { WeeklySchedulerInputs } from './weeklyScheduler';

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

function activeScheduleConstraints(
  constraints: readonly ActiveConstraint[] | undefined,
): ActiveScheduleConstraint[] {
  return (constraints ?? []).filter((constraint): constraint is ActiveScheduleConstraint =>
    constraint.type === 'schedule' && constraint.status !== 'resolved');
}

function scheduleConstraintAppliesOn(
  constraint: ActiveScheduleConstraint,
  dateISO: string,
): boolean {
  const date = dateISO.slice(0, 10);
  if (constraint.startDate?.slice(0, 10) > date) return false;
  if (constraint.expiresAt?.slice(0, 10) && constraint.expiresAt.slice(0, 10) < date) {
    return false;
  }
  return true;
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export interface CanonicalWeeklyCompositionAvailability {
  /** Permanent answer: the block-selection author records against this kit. */
  readonly permanentKit: readonly EquipmentTag[];
  /** Dated answer: the row composer ships against this kit on each affected day. */
  readonly temporaryKitByDayOfWeek?: Readonly<Record<number, readonly EquipmentTag[]>>;
  /** Contract answer: a pattern is achievable if it is reachable at least once. */
  readonly reachableKitAcrossWeek: readonly EquipmentTag[];
}

export interface CanonicalWeeklyAvailabilityState {
  readonly kind: 'weekly_availability';
  readonly id: string;
  readonly weekStartISO: string;
  readonly unavailableDayNumbers: readonly number[];
  readonly awayDayNumbers: readonly number[];
  readonly clubClosedDayNumbers: readonly number[];
  readonly permanentEquipment: ResolvedEquipmentCapabilities;
  readonly equipmentByDayOfWeek: Readonly<Record<number, ResolvedEquipmentCapabilities>>;
  readonly reachableEquipmentAcrossWeek: ResolvedEquipmentCapabilities;
  readonly composition: CanonicalWeeklyCompositionAvailability;
}

export function canonicalWeeklyAvailabilityStateFrom(args: {
  readonly profile: OnboardingData;
  readonly weekStartISO: string;
  readonly activeConstraints?: readonly ActiveConstraint[];
  /** Legacy/test ingress only. Product generation supplies active constraints. */
  readonly fallbackEquipment?: ResolvedEquipmentCapabilities;
}): CanonicalWeeklyAvailabilityState {
  const weekStartISO = args.weekStartISO.slice(0, 10);
  const schedules = activeScheduleConstraints(args.activeConstraints);
  const awaySpans = awaySpansFromConstraints(args.activeConstraints);
  const permanentEquipment = args.fallbackEquipment ??
    resolveEquipmentCapabilities(args.profile, [], weekStartISO);
  const equipmentByDayOfWeek: Record<number, ResolvedEquipmentCapabilities> = {};
  const reachableTags = new Set<EquipmentTag>();
  const reachableModalities = new Set<ConditioningEquipmentModality>();
  const unavailable = new Set<number>();
  const away = new Set<number>();
  const clubClosed = new Set<number>();
  const temporaryKitByDayOfWeek: Record<number, readonly EquipmentTag[]> = {};

  for (let day = 0; day < 7; day += 1) {
    const dateISO = isoDateForWeekday(weekStartISO, day);
    const isAway = dateIsInsideAwaySpan(dateISO, awaySpans);
    if (isAway) {
      away.add(day);
      clubClosed.add(day);
    }
    for (const constraint of schedules) {
      if (!scheduleConstraintAppliesOn(constraint, dateISO)) continue;
      if (constraint.scheduleKind === 'no_team_training') clubClosed.add(day);
      if (constraint.scheduleKind === 'travel' || constraint.scheduleKind === 'no_team_training') {
        continue;
      }
      if (constraint.unavailableDates?.some((date) => date.slice(0, 10) === dateISO) ||
        constraint.unavailableWeekdays?.includes(DAY_NAMES[day])) {
        unavailable.add(day);
      }
    }

    const equipment = args.activeConstraints
      ? resolveEquipmentCapabilities(args.profile, args.activeConstraints, dateISO)
      : permanentEquipment;
    equipmentByDayOfWeek[day] = equipment;
    for (const tag of equipment.tags) reachableTags.add(tag);
    for (const modality of equipment.conditioningModalities) {
      reachableModalities.add(modality);
    }
    if (!sameSet(equipment.tags, permanentEquipment.tags)) {
      temporaryKitByDayOfWeek[day] = [...equipment.tags];
    }
  }

  const reachableEquipmentAcrossWeek: ResolvedEquipmentCapabilities = {
    ...permanentEquipment,
    tags: [...reachableTags],
    conditioningModalities: [...reachableModalities],
  };
  return {
    kind: 'weekly_availability',
    id: `availability-week:${weekStartISO}`,
    weekStartISO,
    unavailableDayNumbers: [...unavailable].sort((left, right) => left - right),
    awayDayNumbers: [...away].sort((left, right) => left - right),
    clubClosedDayNumbers: [...clubClosed].sort((left, right) => left - right),
    permanentEquipment,
    equipmentByDayOfWeek,
    reachableEquipmentAcrossWeek,
    composition: {
      permanentKit: [...permanentEquipment.tags],
      ...(Object.keys(temporaryKitByDayOfWeek).length > 0
        ? { temporaryKitByDayOfWeek }
        : {}),
      reachableKitAcrossWeek: [...reachableTags],
    },
  };
}

/** The compiler's only schedule projection for travel and availability. */
export function schedulerInputsWithAvailabilityState(
  scheduler: WeeklySchedulerInputs,
  availability: CanonicalWeeklyAvailabilityState | null | undefined,
): WeeklySchedulerInputs {
  if (!availability) return scheduler;
  const away = new Set(availability.awayDayNumbers);
  const clubClosed = new Set(availability.clubClosedDayNumbers);
  const gameDays = (scheduler.gameDays ?? (scheduler.gameDay === null ? [] : [scheduler.gameDay]))
    .filter((day) => !away.has(day));
  return {
    ...scheduler,
    clubNights: scheduler.clubNights.filter((day) => !clubClosed.has(day)),
    gameDays,
    gameDay: gameDays[0] ?? null,
    fixtureProximityDates: scheduler.fixtureProximityDates?.filter((date) =>
      !dateIsInsideAwaySpan(date, awaySpansFromDayNumbers(
        availability.weekStartISO, availability.awayDayNumbers,
      ))),
    unavailableDays: Array.from(new Set([
      ...scheduler.unavailableDays,
      ...availability.unavailableDayNumbers,
    ])).sort((left, right) => left - right),
  };
}

function awaySpansFromDayNumbers(
  weekStartISO: string,
  days: readonly number[],
): { from: string; until: string }[] {
  return days.map((day) => {
    const date = isoDateForWeekday(weekStartISO, day);
    return { from: date, until: date };
  });
}

/** Keep legacy contract inputs aligned with the exact scheduler answer. */
export function coachingInputsWithAvailabilityState(
  coaching: CoachingInputs,
  scheduler: WeeklySchedulerInputs,
): CoachingInputs {
  const unavailable = new Set(scheduler.unavailableDays);
  const selectedNumbers = Array.from(new Set([
    ...scheduler.gymAccessDays.filter((day) => !unavailable.has(day)),
    ...scheduler.clubNights,
  ])).sort((left, right) => left - right);
  return {
    ...coaching,
    availableDays: selectedNumbers.length,
    selectedDays: selectedNumbers.map((day) => DAY_NAMES[day]),
    teamTrainingDaysPerWeek: scheduler.clubNights.length,
    teamTrainingDays: scheduler.clubNights.map((day) => DAY_NAMES[day]),
    hasGame: (scheduler.gameDays?.length ?? 0) > 0,
    gameDay: scheduler.gameDays?.[0] === undefined
      ? undefined
      : DAY_NAMES[scheduler.gameDays[0]],
  };
}
