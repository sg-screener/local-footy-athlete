import type { DayOfWeek, OnboardingData } from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { ActiveConstraint } from '../store/coachUpdatesStore';

export type FixtureAvailabilityKind = 'game' | 'practice_match';

export type AvailabilityProvenance =
  | 'explicit_available'
  | 'released_game_day'
  | 'released_practice_match_day'
  | 'bye_usual_game_day';

export type AvailabilityBlockReason =
  | 'fixture_occupied'
  | 'explicit_unavailable'
  | 'calendar_rest_commitment'
  | 'safety_readiness_unavailable';

export interface TargetWeekFixture {
  date: string;
  kind: FixtureAvailabilityKind;
}

export interface EffectiveAvailabilityDay {
  date: string;
  dayOfWeek: DayOfWeek;
  dayNumber: number;
  available: boolean;
  provenance: AvailabilityProvenance[];
  blockedBy: AvailabilityBlockReason[];
}

export interface FixtureConditionedAvailability {
  weekStart: string;
  storedPreferredTrainingDays: DayOfWeek[];
  storedTrainingDaysPerWeek: number | null;
  usualGameDay: DayOfWeek | null;
  priorFixtures: TargetWeekFixture[];
  proposedFixtures: TargetWeekFixture[];
  releasedFixtures: Array<TargetWeekFixture & { provenance: AvailabilityProvenance }>;
  days: EffectiveAvailabilityDay[];
  effectiveAvailableDates: string[];
  effectiveAvailableDayNumbers: number[];
  effectiveAvailableDayNames: DayOfWeek[];
  effectiveWeeklyTrainingCapacity: number;
}

export interface ResolveFixtureConditionedAvailabilityInput {
  profile: OnboardingData;
  weekStart: string;
  priorFixtures?: readonly TargetWeekFixture[];
  proposedFixtures?: readonly TargetWeekFixture[];
  proposedMarkedDays?: Readonly<Record<string, CalendarDayType>>;
  /** A known bye releases the usual game day even without a prior explicit mark. */
  byeUsualGameDay?: boolean;
  /** Typed safety/readiness projection supplied by the constraint owner. */
  safetyUnavailableDates?: readonly string[];
  activeConstraints?: readonly ActiveConstraint[];
}

const DAY_NAMES: readonly DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateForDay(weekStart: string, day: DayOfWeek): string {
  const dayNumber = DAY_NAMES.indexOf(day);
  const offset = dayNumber === 0 ? 6 : dayNumber - 1;
  return addDays(weekStart, offset);
}

function isDateInWeek(date: string, weekStart: string): boolean {
  return date >= weekStart && date <= addDays(weekStart, 6);
}

function fixtureKind(profile: OnboardingData): FixtureAvailabilityKind {
  return profile.seasonPhase === 'Pre-season' ? 'practice_match' : 'game';
}

function recurringFixture(profile: OnboardingData, weekStart: string): TargetWeekFixture[] {
  const day = (profile.usualGameDay || profile.gameDay) as DayOfWeek | undefined;
  return day ? [{ date: dateForDay(weekStart, day), kind: fixtureKind(profile) }] : [];
}

/** Resolve fixture anchors from the accepted target-week calendar view. */
export function targetWeekFixtures(args: {
  profile: OnboardingData;
  weekStart: string;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
}): TargetWeekFixture[] {
  const explicit = Object.entries(args.markedDays ?? {})
    .filter(([date, mark]) => isDateInWeek(date, args.weekStart) && mark === 'game')
    .map(([date]) => ({ date, kind: fixtureKind(args.profile) }));
  if (explicit.length > 0) return explicit.sort((left, right) => left.date.localeCompare(right.date));
  const explicitBye = Object.entries(args.markedDays ?? {})
    .some(([date, mark]) => isDateInWeek(date, args.weekStart) && mark === 'noGame');
  return explicitBye ? [] : recurringFixture(args.profile, args.weekStart);
}

function activeUnavailableDates(
  profile: OnboardingData,
  weekStart: string,
): Set<string> {
  const unavailable = new Set<string>();
  for (const constraint of profile.availabilityConstraints ?? []) {
    if (constraint.active === false || constraint.kind !== 'unavailable_day' || !constraint.dayOfWeek) {
      continue;
    }
    const date = dateForDay(weekStart, constraint.dayOfWeek);
    if (constraint.startDate && constraint.startDate > date) continue;
    if (constraint.endDate && constraint.endDate < date) continue;
    unavailable.add(date);
  }
  return unavailable;
}

function fullPause(activeConstraints: readonly ActiveConstraint[]): boolean {
  return activeConstraints.some((constraint) =>
    constraint.type === 'injury' &&
    constraint.status !== 'resolved' &&
    constraint.adjustmentLevel === 'training_paused');
}

function releaseProvenance(kind: FixtureAvailabilityKind): AvailabilityProvenance {
  return kind === 'practice_match'
    ? 'released_practice_match_day'
    : 'released_game_day';
}

function uniqueFixtures(fixtures: readonly TargetWeekFixture[]): TargetWeekFixture[] {
  const byDate = new Map<string, TargetWeekFixture>();
  for (const fixture of fixtures) byDate.set(fixture.date, fixture);
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Canonical target-week availability owner.
 *
 * Stored profile preferences are inputs only. Fixture release expands the
 * target-week view without writing those durable preferences back.
 */
export function resolveFixtureConditionedAvailability(
  input: ResolveFixtureConditionedAvailabilityInput,
): FixtureConditionedAvailability {
  const weekStart = input.weekStart.slice(0, 10);
  const priorFixtures = uniqueFixtures(input.priorFixtures ?? []);
  const proposedFixtures = uniqueFixtures(
    input.proposedFixtures ?? targetWeekFixtures({
      profile: input.profile,
      weekStart,
      markedDays: input.proposedMarkedDays,
    }),
  );
  const proposedFixtureDates = new Set(proposedFixtures.map((fixture) => fixture.date));
  const releasedFixtures = priorFixtures
    .filter((fixture) => !proposedFixtureDates.has(fixture.date))
    .map((fixture) => ({ ...fixture, provenance: releaseProvenance(fixture.kind) }));

  const usualGameDay = (input.profile.usualGameDay || input.profile.gameDay) as DayOfWeek | undefined;
  if (input.byeUsualGameDay && usualGameDay) {
    const date = dateForDay(weekStart, usualGameDay);
    if (
      !proposedFixtureDates.has(date) &&
      !releasedFixtures.some((fixture) => fixture.date === date)
    ) {
      releasedFixtures.push({
        date,
        kind: fixtureKind(input.profile),
        provenance: 'bye_usual_game_day',
      });
    }
  }

  const explicitAvailable = new Set(
    (input.profile.preferredTrainingDays ?? []).map((day) => dateForDay(weekStart, day)),
  );
  const explicitUnavailable = activeUnavailableDates(input.profile, weekStart);
  const calendarRest = new Set(
    Object.entries(input.proposedMarkedDays ?? {})
      .filter(([date, mark]) => isDateInWeek(date, weekStart) && mark === 'rest')
      .map(([date]) => date),
  );
  const safetyUnavailable = new Set(
    (input.safetyUnavailableDates ?? []).filter((date) => isDateInWeek(date, weekStart)),
  );
  if (fullPause(input.activeConstraints ?? [])) {
    for (let offset = 0; offset < 7; offset++) safetyUnavailable.add(addDays(weekStart, offset));
  }

  const releasedByDate = new Map(releasedFixtures.map((fixture) => [fixture.date, fixture]));
  const days: EffectiveAvailabilityDay[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(weekStart, offset);
    const dayNumber = new Date(`${date}T12:00:00`).getDay();
    const provenance: AvailabilityProvenance[] = [];
    const blockedBy: AvailabilityBlockReason[] = [];
    if (explicitAvailable.has(date)) provenance.push('explicit_available');
    const released = releasedByDate.get(date);
    if (released) provenance.push(released.provenance);
    if (proposedFixtureDates.has(date)) blockedBy.push('fixture_occupied');
    if (explicitUnavailable.has(date)) blockedBy.push('explicit_unavailable');
    if (calendarRest.has(date)) blockedBy.push('calendar_rest_commitment');
    if (safetyUnavailable.has(date)) blockedBy.push('safety_readiness_unavailable');
    days.push({
      date,
      dayOfWeek: DAY_NAMES[dayNumber],
      dayNumber,
      available: provenance.length > 0 && blockedBy.length === 0,
      provenance,
      blockedBy,
    });
  }

  const available = days.filter((day) => day.available);
  return {
    weekStart,
    storedPreferredTrainingDays: [...(input.profile.preferredTrainingDays ?? [])],
    storedTrainingDaysPerWeek: input.profile.trainingDaysPerWeek ?? null,
    usualGameDay: usualGameDay ?? null,
    priorFixtures,
    proposedFixtures,
    releasedFixtures,
    days,
    effectiveAvailableDates: available.map((day) => day.date),
    effectiveAvailableDayNumbers: available.map((day) => day.dayNumber),
    effectiveAvailableDayNames: available.map((day) => day.dayOfWeek),
    effectiveWeeklyTrainingCapacity: available.length,
  };
}

/** Baseline generation/rebuild adapter; still runs through the shared owner. */
export function resolveProfileTargetWeekAvailability(args: {
  profile: OnboardingData;
  weekStart: string;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
  activeConstraints?: readonly ActiveConstraint[];
}): FixtureConditionedAvailability {
  const proposedFixtures = targetWeekFixtures(args);
  const explicitBye = Object.entries(args.markedDays ?? {})
    .some(([date, mark]) => isDateInWeek(date, args.weekStart) && mark === 'noGame');
  return resolveFixtureConditionedAvailability({
    profile: args.profile,
    weekStart: args.weekStart,
    proposedFixtures,
    proposedMarkedDays: args.markedDays,
    byeUsualGameDay: explicitBye,
    activeConstraints: args.activeConstraints,
  });
}
