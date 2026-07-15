import type { DayOfWeek, OnboardingData, Workout } from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import type { AcceptedEffectiveWeekSurfaces } from './acceptedEffectiveWeek';
import { addDaysISO } from '../utils/programBlockState';

export interface RollingHorizonSearchResult<T, S> {
  candidate: T[];
  score: S;
  searchedCandidates: number;
  truncated: boolean;
}

/** Bounded deterministic Cartesian search shared by rolling-horizon owners. */
export function searchRollingHorizonCandidateCombinations<T, S>(args: {
  candidateGroups: readonly (readonly T[])[];
  score: (candidate: readonly T[]) => S;
  compare: (left: S, right: S) => number;
  signature: (candidate: readonly T[]) => string;
  maxCandidates?: number;
}): RollingHorizonSearchResult<T, S> | null {
  const maxCandidates = Math.max(1, args.maxCandidates ?? 64);
  if (args.candidateGroups.length === 0 || args.candidateGroups.some((group) => group.length === 0)) {
    return null;
  }
  const combinations: T[][] = [];
  const initial = args.candidateGroups.map(() => 0);
  const frontier: number[][] = [initial];
  const seen = new Set([initial.join(',')]);
  while (frontier.length > 0 && combinations.length < maxCandidates) {
    frontier.sort((left, right) =>
      left.reduce((total, value) => total + value, 0) -
        right.reduce((total, value) => total + value, 0) ||
      left.join(',').localeCompare(right.join(',')));
    const indices = frontier.shift()!;
    combinations.push(indices.map((candidateIndex, groupIndex) =>
      args.candidateGroups[groupIndex][candidateIndex]));
    for (let groupIndex = 0; groupIndex < indices.length; groupIndex++) {
      if (indices[groupIndex] + 1 >= args.candidateGroups[groupIndex].length) continue;
      const neighbour = [...indices];
      neighbour[groupIndex] += 1;
      const key = neighbour.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(neighbour);
    }
  }
  const truncated = frontier.length > 0;
  const scored = combinations.map((candidate) => ({
    candidate,
    score: args.score(candidate),
    signature: args.signature(candidate),
  })).sort((left, right) =>
    args.compare(left.score, right.score) || left.signature.localeCompare(right.signature));
  const winner = scored[0];
  return winner ? {
    candidate: winner.candidate,
    score: winner.score,
    searchedCandidates: scored.length,
    truncated,
  } : null;
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dayNameForDate(date: string): DayOfWeek {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${date}T12:00:00`).getDay()
  ] as DayOfWeek;
}

function datesInWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => addDaysISO(weekStart, offset));
}

/** Calendar proximity is only the seed; persisted dependencies close the horizon below. */
export function fixtureProtectionWeekStartsForMarks(args: {
  before: Readonly<Record<string, CalendarDayType>>;
  after: Readonly<Record<string, CalendarDayType>>;
}): string[] {
  const dates = new Set([...Object.keys(args.before), ...Object.keys(args.after)]);
  const changedGames = Array.from(dates).filter((date) =>
    (args.before[date] === 'game') !== (args.after[date] === 'game'));
  const weeks = new Set<string>();
  for (const date of changedGames) {
    for (const offset of [-2, -1, 0, 1]) {
      weeks.add(mondayForDate(addDaysISO(date, offset)));
    }
  }
  return Array.from(weeks).sort();
}

/** Exact fixture identities used by persisted provenance validity. */
export function effectiveFixtureDatesForWeeks(args: {
  profile: OnboardingData;
  markedDays: Readonly<Record<string, CalendarDayType>>;
  weekStarts: readonly string[];
}): Set<string> {
  const fixtures = new Set(Object.entries(args.markedDays)
    .filter(([, mark]) => mark === 'game')
    .map(([date]) => date.slice(0, 10)));
  const recurringDay = (args.profile.usualGameDay || args.profile.gameDay) as DayOfWeek | undefined;
  if (args.profile.seasonPhase !== 'In-season' || !recurringDay ||
    !['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .includes(recurringDay)) {
    return fixtures;
  }
  for (const rawWeekStart of args.weekStarts) {
    const weekStart = mondayForDate(rawWeekStart);
    const dates = datesInWeek(weekStart);
    if (dates.some((date) => args.markedDays[date] === 'game')) continue;
    const recurringDate = dates.find((date) => dayNameForDate(date) === recurringDay);
    if (!recurringDate) continue;
    if (args.markedDays[recurringDate] === 'noGame' || args.markedDays[recurringDate] === 'rest') {
      continue;
    }
    fixtures.add(recurringDate);
  }
  return fixtures;
}

/** Smallest deterministic dependency closure for a fixture mutation. */
export function rollingHorizonDependencyClosure(args: {
  seedWeekStarts: readonly string[];
  changedTriggerDates?: readonly string[];
  surfaces: AcceptedEffectiveWeekSurfaces;
}): string[] {
  const changedTriggerDates = new Set((args.changedTriggerDates ?? []).map((date) =>
    date.slice(0, 10)));
  const weeks = new Set(args.seedWeekStarts.map(mondayForDate));
  const workouts: Workout[] = [
    ...(args.surfaces.currentProgram?.microcycles.flatMap((microcycle) => microcycle.workouts) ?? []),
    ...(args.surfaces.currentMicrocycle?.workouts ?? []),
    ...Object.values(args.surfaces.dateOverrides),
    ...Object.values(args.surfaces.weekScopedOverlays).flatMap((overlay) =>
      Object.values(overlay.workoutsByDate).filter((workout): workout is Workout => !!workout)),
  ];
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const workout of workouts) {
      for (const record of workout.derivedSessionProvenance ?? []) {
        const dependency = record.dependency;
        if (!dependency) continue;
        const connected = changedTriggerDates.has(dependency.source.date) ||
          changedTriggerDates.has(dependency.target.date) ||
          weeks.has(dependency.source.weekStart) ||
          weeks.has(dependency.target.weekStart);
        if (!connected) continue;
        for (const weekStart of [
          dependency.source.weekStart,
          dependency.target.weekStart,
          mondayForDate(dependency.restoration.targetDate),
        ]) {
          if (weeks.has(weekStart)) continue;
          weeks.add(weekStart);
          expanded = true;
        }
      }
    }
  }
  return Array.from(weeks).sort();
}

/** Calendar fixture mutations seed their G-relative protection window, then close over provenance. */
export function rollingHorizonWeekStartsForMutation(args: {
  before: Readonly<Record<string, CalendarDayType>>;
  after: Readonly<Record<string, CalendarDayType>>;
  surfaces: AcceptedEffectiveWeekSurfaces;
}): string[] {
  const changedFixtureDates = Array.from(
    new Set([...Object.keys(args.before), ...Object.keys(args.after)]),
  ).filter((date) => (args.before[date] === 'game') !== (args.after[date] === 'game'));
  return rollingHorizonDependencyClosure({
    seedWeekStarts: fixtureProtectionWeekStartsForMarks({
      before: args.before,
      after: args.after,
    }),
    changedTriggerDates: changedFixtureDates,
    surfaces: args.surfaces,
  });
}

/** Persist reversible fixture projections with the accepted session they displaced. */
export function materialiseVisibleSystemWork(args: {
  canonical: readonly Workout[];
  visible: readonly Workout[];
}): Workout[] {
  const visibleByIdentity = new Map(args.visible.flatMap((workout) => {
    const identity = workout.planEntryId ?? workout.id;
    return identity ? [[identity, workout] as const] : [];
  }));
  const derivedByDay = new Map(args.visible.flatMap((workout) =>
    workout.derivedSessionProvenance?.some((record) => !!record.dependency)
      ? [[workout.dayOfWeek, workout] as const]
      : []));
  return args.canonical.map((workout) => {
    const identity = workout.planEntryId ?? workout.id;
    // Preserve the already accepted prescription for an unchanged session,
    // without materialising unrelated visible-only gap fill. Dependency-owned
    // work remains authoritative by day because it may deliberately displace
    // a canonical session while its trigger is active.
    return derivedByDay.get(workout.dayOfWeek) ?? visibleByIdentity.get(identity) ?? workout;
  })
    .concat(Array.from(derivedByDay.entries())
      .filter(([day]) => !args.canonical.some((workout) => workout.dayOfWeek === day))
      .map(([, workout]) => workout))
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}
