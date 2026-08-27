import type { DayOfWeek } from '../types/domain';
import {
  canonicalFixtureKindForResolvedPhase,
  type FixtureAvailabilityKind,
  type FixtureConditionedAvailability,
} from './fixtureConditionedAvailability';
import { isoDateForWeekday } from '../utils/appDate';
import type { WeeklySchedulerInputs } from './weeklyScheduler';

const DAY_NAMES: readonly DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export interface CanonicalWeeklyFixtureAnchor {
  readonly id: string;
  readonly dateISO: string;
  readonly kind: FixtureAvailabilityKind;
}

/**
 * The complete fixture input for one compiler run. Dates and kinds are semantic
 * facts; no consumer has to infer them from a workout name or session label.
 */
export interface CanonicalWeeklyFixtureState {
  readonly kind: 'fixture_state';
  readonly id: string;
  readonly weekStartISO: string;
  readonly fixtures: readonly CanonicalWeeklyFixtureAnchor[];
  readonly effectiveAvailableDayNumbers?: readonly number[];
  readonly releasedFixtureDayNumbers: readonly number[];
  readonly adjacentFixtureDates: readonly string[];
}

function dayNumber(day: DayOfWeek): number {
  return DAY_NAMES.indexOf(day);
}

function anchor(dateISO: string, kind: FixtureAvailabilityKind): CanonicalWeeklyFixtureAnchor {
  return { id: `${kind}:${dateISO}`, dateISO: dateISO.slice(0, 10), kind };
}

/** Translation only: calendar/profile ownership has already resolved the facts. */
export function canonicalFixtureStateFrom(args: {
  readonly weekStartISO: string;
  readonly availability?: FixtureConditionedAvailability;
  readonly targetFixtureDay?: DayOfWeek | null;
  readonly seasonPhase: string;
}): CanonicalWeeklyFixtureState | null {
  if (!args.availability && args.targetFixtureDay === undefined) return null;

  const weekStartISO = args.weekStartISO.slice(0, 10);
  const offSeason = args.seasonPhase === 'Off-season';
  const fixtureKind = canonicalFixtureKindForResolvedPhase(args.seasonPhase);
  const proposed = offSeason
    ? []
    : args.availability
    ? args.availability.proposedFixtures.map((fixture) =>
        anchor(fixture.date, fixture.kind))
    : args.targetFixtureDay === null
      ? []
      : [anchor(
          isoDateForWeekday(weekStartISO, dayNumber(args.targetFixtureDay!)),
          fixtureKind,
        )];
  const fixtures = proposed;
  const adjacentFixtureDates = (offSeason ? [] : args.availability?.adjacentFixtureDates ?? [])
    .map((date) => date.slice(0, 10));
  const releasedFixtureDayNumbers = (offSeason ? [] : args.availability?.releasedFixtures ?? [])
    .map((fixture) => new Date(`${fixture.date.slice(0, 10)}T12:00:00`).getDay());
  const effectiveAvailableDayNumbers = args.availability
    ? offSeason
      ? args.availability.days
          .filter((day) =>
            day.provenance.includes('explicit_available')
            && day.blockedBy.every((reason) => reason === 'fixture_occupied'))
          .map((day) => day.dayNumber)
      : [...args.availability.effectiveAvailableDayNumbers]
    : undefined;

  return {
    kind: 'fixture_state',
    id: `fixture-week:${weekStartISO}`,
    weekStartISO,
    fixtures,
    ...(effectiveAvailableDayNumbers
      ? { effectiveAvailableDayNumbers }
      : {}),
    releasedFixtureDayNumbers: Array.from(new Set(releasedFixtureDayNumbers)).sort(),
    adjacentFixtureDates: Array.from(new Set(adjacentFixtureDates)).sort(),
  };
}

/** Apply the typed state to the scheduler input inside the compiler boundary. */
export function schedulerInputsWithFixtureState(
  scheduler: WeeklySchedulerInputs,
  fixture: CanonicalWeeklyFixtureState | null | undefined,
): WeeklySchedulerInputs {
  if (!fixture) return scheduler;
  const gameDays = fixture.fixtures.map((entry) =>
    new Date(`${entry.dateISO}T12:00:00`).getDay());
  return {
    ...scheduler,
    ...(fixture.effectiveAvailableDayNumbers
      ? { gymAccessDays: [...fixture.effectiveAvailableDayNumbers] }
      : {}),
    gameDay: gameDays[0] ?? null,
    gameDays,
    fixtureProximityDates: Array.from(new Set([
      ...fixture.fixtures.map((entry) => entry.dateISO),
      ...fixture.adjacentFixtureDates,
    ])).sort(),
    releasedFixtureDays: [...fixture.releasedFixtureDayNumbers],
  };
}
