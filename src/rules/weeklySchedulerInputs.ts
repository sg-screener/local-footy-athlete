/**
 * THE ATHLETE'S FACTS → `WeeklySchedulerInputs`. One place, so generation does not
 * assemble them inline and quietly disagree with the guards.
 *
 * **EVERY INPUT IS ALREADY AUTHORISED ELSEWHERE.** Nothing here invents a fact:
 * gym access is the athlete's preferred training days, club nights and game day
 * are their own answers, age comes from the onboarding range, readiness from the
 * generation constraints, and explicit unavailability from the active constraints
 * the away/busy doors already write.
 */
import type { DayOfWeek, OnboardingData } from '../types/domain';
import type { OffseasonSubphase } from './offseasonSubphase';
import type {
  SchedulerReadiness,
  WeeklyScheduleRefusal,
  WeeklySchedulerInputs,
} from './weeklyScheduler';
import type { ContractPhase, OffseasonBlock } from './weeklyProgrammingContract';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { awaySpansFromConstraints, dateIsInsideAwaySpan } from './awaySpans';
import { storedGameAnchor } from './gameAnchor';
import type { FixtureConditionedAvailability } from './fixtureConditionedAvailability';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];

function dayNumber(name: unknown): number | null {
  const index = DAY_NAMES.indexOf(String(name ?? ''));
  return index < 0 ? null : index;
}

function dayNumbers(names: readonly unknown[] | undefined): number[] {
  return (names ?? []).map(dayNumber).filter((n): n is number => n !== null);
}

/** The ISO date a weekday falls on in the week beginning `weekStartISO`. */
function dateForDayNumber(weekStartISO: string, dayOfWeek: number): string {
  const monday = new Date(`${weekStartISO.slice(0, 10)}T12:00:00`);
  const offset = (dayOfWeek + 6) % 7;   // Monday is index 0 in a Mon-start week
  monday.setDate(monday.getDate() + offset);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1)
    .padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function shiftedDateISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * ── R-020, STATED AS DATA RATHER THAN AS A DELETION ────────────────────────
 *
 * Sam: *"yes clear team training and games while away"* — and, twice over,
 * *"if yes, follow same program"*. **The club's work comes off; the athlete's own
 * does not.**
 *
 * ⚠ **THIS IS THE FIX `postGenerationConstraintValidation` NAMED AND DID NOT
 * BUILD.** Its travel branch carried the note *"THE REAL FIX IS IN THE PLAN —
 * the allocator must not mark a day `isTeamDay` inside a live travel span"*, and
 * until then it deleted club-bound days AFTER the week was composed. Measured
 * 2026-08-17 (`npm run trace:equipment-scopes`, boundary B8) with a FULL
 * commercial gym and no equipment change at all: Tuesday and Thursday were
 * collapsed to REST as "team-training only" while carrying **six of the
 * athlete's own lifts** — `Barbell Row`, `Lat Pulldown`, `Band Pull-Apart`,
 * `Bench Press`, `DB Shoulder Press`, `Banded External Rotation` — and §18 then
 * refused the whole week for training no squat, hinge, push or pull. **A trip
 * with a full gym produced no week at all.**
 *
 * A day cannot be over-deleted here because there is nothing to delete: the trip
 * simply removes the club night and the fixture from the facts the scheduler is
 * told about, and it then plans the week it would have planned for an athlete
 * with a free night. That is also why nothing needs to know about "an away week"
 * — there is no such week kind, only a week whose club inputs are smaller.
 *
 * **THE SPAN OWNER IS `awaySpans.ts`**, shared with the derived-week contract, so
 * the read side and the plan side cannot disagree about which days are inside a
 * trip (`test:away-span-ownership` is the round-trip proof).
 */
function clubInputsAfterTravel(args: {
  weekStartISO: string;
  clubNights: readonly number[];
  gameDays: readonly number[];
  fixtureProximityDates?: readonly string[];
  activeConstraints: readonly unknown[] | undefined;
}): { clubNights: number[]; gameDays: number[]; fixtureProximityDates?: string[] } {
  const spans = awaySpansFromConstraints(
    args.activeConstraints as readonly ActiveConstraint[] | undefined,
  );
  if (spans.length === 0) {
    return {
      clubNights: [...args.clubNights],
      gameDays: [...args.gameDays],
      fixtureProximityDates: args.fixtureProximityDates === undefined
        ? undefined : [...args.fixtureProximityDates],
    };
  }
  const away = (day: number): boolean =>
    dateIsInsideAwaySpan(dateForDayNumber(args.weekStartISO, day), spans);
  return {
    clubNights: args.clubNights.filter((day) => !away(day)),
    gameDays: args.gameDays.filter((day) => !away(day)),
    fixtureProximityDates: args.fixtureProximityDates?.filter((date) =>
      !dateIsInsideAwaySpan(date, spans)),
  };
}

/**
 * ⚠ THE AGE RANGE IS A BAND, AND THE SELECTOR NEEDS A NUMBER.
 *
 * `AgeRange` is `'Under 18' | '18-22' | '22-26' | '26-30' | '30+'` and the
 * contract's boundary is 27. **`'26-30'` STRADDLES IT**, so the band alone cannot
 * answer "is this athlete 27 or younger".
 *
 * The band's TOP is used, which is the conservative reading: a `26-30` athlete is
 * treated as 30 and does NOT qualify on age. That is deliberate — decision 14's
 * other arm (consistently completing three with high readiness and low fatigue) is
 * the route for an older athlete, and **guessing young would hand a fourth session
 * to someone the contract does not cover.** Recorded because it is a real
 * boundary the source does not resolve, not a silent rounding.
 */
export function ageFromRange(range: OnboardingData['ageRange']): number | null {
  switch (range) {
    case 'Under 18': return 17;
    case '18-22': return 22;
    case '22-26': return 26;
    case '26-30': return 30;   // straddles 27 — conservative, see docstring
    case '30+': return 31;
    default: return null;
  }
}

/** The contract's three off-season blocks, from the app's subphase vocabulary. */
export function offseasonBlockFrom(
  subphase: OffseasonSubphase | null,
): OffseasonBlock | null {
  switch (subphase) {
    case 'early_offseason': return 'early_optional';
    case 'mid_offseason': return 'transition';
    case 'late_offseason': return 'normal_build';
    default: return null;
  }
}

/** Thrown when the contract cannot build a legal week. Carries the typed refusal. */
export class WeeklyScheduleRefusedError extends Error {
  readonly code = 'weekly_schedule_refused';

  readonly refusal: WeeklyScheduleRefusal;

  constructor(refusal: WeeklyScheduleRefusal) {
    super(`Weekly schedule refused (${refusal.finding}: ${refusal.clauseId})`);
    this.name = 'WeeklyScheduleRefusedError';
    this.refusal = refusal;
  }
}

export function weeklySchedulerInputsFrom(args: {
  readonly profile: OnboardingData;
  readonly weekStartISO: string;
  readonly offseasonSubphase: OffseasonSubphase | null;
  readonly generationConstraints?: {
    readonly readiness?: { readonly deloaded?: boolean } | null;
  } | null;
  readonly activeConstraints?: readonly unknown[];
  readonly exposureContract?: { readonly anchors?: unknown } | null;
  /**
   * The accepted calendar's fixture for THIS week. `undefined` means the
   * profile's recurring default, `null` means a bye, and a day means an actual
   * or moved fixture. The distinction is material: collapsing `null` into the
   * profile default silently resurrects a game the athlete removed.
   */
  readonly targetFixtureDay?: DayOfWeek | null;
  /** Canonical effective app-training days for this target week, when resolved. */
  readonly targetWeekAvailability?: FixtureConditionedAvailability;
  /** WC-136. Rotates the authored hard conditioning quality at the block boundary. */
  readonly miniCycleNumber?: number | null;
  /** WC-136. A scheduled deload week is never authored hard conditioning. */
  readonly weekKind?: 'build' | 'deload' | null;
}): WeeklySchedulerInputs {
  const profile = args.profile as OnboardingData & {
    preferredTrainingDays?: readonly string[];
    teamTrainingDays?: readonly string[];
    gameDay?: string;
  };
  // R-079: Off-season has no club training and no fixtures. The profile keeps
  // the athlete's standing club answers for the next phase; the dated scheduler
  // input represents THIS week and must not turn those dormant answers into
  // hard anchors. This is phase projection, not destructive profile cleanup.
  const offSeason = profile.seasonPhase === 'Off-season';

  // ⚠ READINESS IS READ CONSERVATIVELY, AND THAT IS THE CONTRACT'S OWN BIAS.
  // Decision 14: *"Low readiness never adds work."* The app has a typed deload
  // signal; it has no typed "consistently completes three comfortably" signal, so
  // that arm is FALSE until one exists rather than assumed true. The effect is
  // that an older athlete stays on three sessions — the contract's default.
  const readiness: SchedulerReadiness = {
    lowReadiness: args.generationConstraints?.readiness?.deloaded === true,
    highReadiness: false,
    lowFatigue: false,
    consistentlyCompletesThree: false,
  };

  // Explicit unavailability, from the constraints the away/busy doors write.
  const unavailableDays = new Set<number>();
  for (const raw of args.activeConstraints ?? []) {
    const constraint = raw as {
      type?: string;
      unavailableWeekdays?: readonly unknown[];
      unavailableDates?: readonly unknown[];
    };
    if (constraint.type !== 'schedule') continue;
    for (const weekday of constraint.unavailableWeekdays ?? []) {
      const n = typeof weekday === 'number' ? weekday : dayNumber(weekday);
      if (n !== null) unavailableDays.add(n);
    }
  }

  // R-020: a live trip takes the club's work off the facts the scheduler plans
  // from. See `clubInputsAfterTravel` for what this replaces and why.
  const targetGameDays = offSeason
    ? []
    : args.targetWeekAvailability
    ? args.targetWeekAvailability.proposedFixtures.map((fixture) =>
        new Date(`${fixture.date}T12:00:00`).getDay())
    : [args.targetFixtureDay === undefined
        // THE ONE OWNER, not the legacy field. This read was
        // `dayNumber(profile.gameDay)`, which ignored `usualGameDay` — so an
        // athlete whose only anchor is the usual game day (the phase-shift
        // flow's field, and `storedGameAnchor`'s PREFERRED field) got a BYE
        // week from this path while `onboardingToCoachingInputs` said
        // `hasGame: true` for the same profile. Two owners for "what day is
        // the game on" is the exact disease `rules/gameAnchor.ts` was ruled
        // to end (Sam, 2026-08-12). Measured: every in-season stage-b
        // scenario built `in_season_bye_build` where the pre-demolition
        // planner built `in_season_game_week`. An explicit `null` still means
        // "the athlete removed the game" and still wins over the profile.
        ? dayNumber(storedGameAnchor(profile))
        : dayNumber(args.targetFixtureDay)]
      .filter((day): day is number => day !== null);
  const explicitTargetWeek = args.targetWeekAvailability !== undefined
    || args.targetFixtureDay !== undefined;
  const actualFixtureDates = args.targetWeekAvailability
    ? args.targetWeekAvailability.proposedFixtures.map((fixture) => fixture.date)
    : args.targetFixtureDay !== undefined && args.targetFixtureDay !== null
      ? [dateForDayNumber(args.weekStartISO, dayNumber(args.targetFixtureDay)!)]
      : [];
  // Same owner as the fallback above — this read also skipped `usualGameDay`.
  const usualGameDay = dayNumber(storedGameAnchor(profile));
  const usualDateThisWeek = usualGameDay === null
    ? null : dateForDayNumber(args.weekStartISO, usualGameDay);
  /**
   * CROSS-WEEK PROXIMITY COMES FROM THE CALENDAR, NOT FROM A ±7 GUESS.
   *
   * Launch audit 2026-08-25, finding #5. This list used to append the usual
   * game day shifted ±7 — a fabricated neighbouring fixture, the same
   * ±7-invention pattern the craft tier was cured of. A game MOVED to Sunday
   * was therefore invisible to the FOLLOWING week's plan: its Monday computed
   * proximity against a phantom Saturday (G+2) instead of the real Sunday
   * (G+1), and the athlete was given a full strength session the morning
   * after their game — a Bible hard line ("G+1: rest or recovery only; a
   * Sunday fixture protects the following Monday").
   *
   * The availability owner now derives the adjacent weeks' REAL fixtures with
   * the same rules it uses for this week (explicit marks beat a bye beats the
   * recurring day). The ±7 synthesis survives only as the fallback for the
   * legacy `targetFixtureDay` path, which carries no calendar to read.
   */
  const fixtureProximityDates = explicitTargetWeek
    ? Array.from(new Set([
        ...actualFixtureDates,
        ...(args.targetWeekAvailability
          ? args.targetWeekAvailability.adjacentFixtureDates
          : usualDateThisWeek === null ? [] : [
              shiftedDateISO(usualDateThisWeek, -7),
              shiftedDateISO(usualDateThisWeek, 7),
            ]),
      ]))
    : undefined;
  // R-130: read off the profile, one field, no derivation. Only 'female'
  // changes anything downstream (the scheduler's G−1 Primer pass).
  const athleteGender = profile.gender === 'male' || profile.gender === 'female'
    ? profile.gender
    : undefined;
  const club = clubInputsAfterTravel({
    weekStartISO: args.weekStartISO,
    clubNights: offSeason ? [] : dayNumbers(profile.teamTrainingDays),
    gameDays: targetGameDays,
    fixtureProximityDates,
    activeConstraints: args.activeConstraints,
  });

  return {
    weekStartISO: args.weekStartISO,
    phase: profile.seasonPhase as ContractPhase,
    offseasonBlock: offseasonBlockFrom(args.offseasonSubphase),
    gymAccessDays: args.targetWeekAvailability
      ? [...args.targetWeekAvailability.effectiveAvailableDayNumbers]
      : dayNumbers(profile.preferredTrainingDays),
    clubNights: club.clubNights,
    gameDay: club.gameDays[0] ?? null,
    gameDays: club.gameDays,
    fixtureProximityDates: club.fixtureProximityDates,
    // **ALWAYS RECURRING FROM ONBOARDING.** The athlete names a usual game day,
    // which by definition means there was one last week too. Nothing in the
    // profile can say "first fixture ever", so nothing here may claim it — and
    // claiming it is precisely how Lower landed on G+1.
    fixtureRecurrence: 'recurring' as const,
    age: ageFromRange(profile.ageRange),
    athleteGender,
    readiness,
    unavailableDays: [...unavailableDays],
    releasedFixtureDays: args.targetWeekAvailability?.days
      .filter((day) => day.provenance.some((value) =>
        value === 'released_game_day'
        || value === 'released_practice_match_day'
        || value === 'bye_usual_game_day'))
      .map((day) => day.dayNumber) ?? [],
    miniCycleNumber: args.miniCycleNumber ?? null,
    weekKind: args.weekKind ?? null,
  };
}
