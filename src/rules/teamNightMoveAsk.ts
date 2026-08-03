import type { DayOfWeek, OnboardingData } from '../types/domain';
import type { TeamNightMoveRouteId } from '../utils/planChangeTypes';
import { registerSignedCopy, signedCopy, signedCopyEntry } from './signedCopy';
import { sortSetupDays } from './profileSetupChange';

/**
 * THE TEAM-NIGHT MOVE ASK — Sam's ruling (2026-08-01), designed in
 * docs/TEAM_NIGHT_MOVABILITY_SHEET_2026-08-01.md and SIGNED whole on
 * 2026-08-02 (docs/PARKED_QUESTIONS_2026-08-01.md §3): all seven strings stand
 * verbatim; choice 1 — MOVE raises the ask, SWAP on a team night stays refused
 * with its already-signed sentence (the club's session is not a type to
 * trade); choice 2 — the permanent route confirms INLINE in the ask, and
 * `teamTrainingDays` still writes through its one setup owner
 * (`commitProfileProgramTransaction`, change kind `profile_setup`).
 *
 * The pattern is the G-1 ask's (destination asks, typed routes, one funnel):
 * a route label NAMES its consequence, and the route the athlete picks travels
 * back on the change as `teamNightRoute` — absent means "not asked yet", and
 * the producer answers with the ask instead of applying anything.
 *
 * ONE-OFF = a dated schedule fact (`scheduleKind: 'team_night_move'`) through
 * the approved deriving lane; the week re-derives around it and resolving the
 * fact undoes it clean. PERMANENT = a `teamTrainingDays` profile answer
 * through the program-setup owner — never a second writer, never a deep-link.
 */

export const TEAM_NIGHT_MOVE_ROUTE_IDS = ['this_week_only', 'permanent'] as const;

export interface TeamNightMoveAskContext {
  /** The team night being moved FROM (ISO date). */
  fromDate: string;
  /** The day it is being moved TO (ISO date). */
  toDate: string;
  /** Weekday name of the target day, e.g. "Wednesday". */
  targetDayName: DayOfWeek;
  /** Weekday name of the vacated usual day, e.g. "Tuesday". */
  usualDayName: DayOfWeek;
  /** The Monday of the affected week (ISO date). */
  weekStart: string;
}

const DAY_NAMES: readonly DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function weekdayNameForDate(dateISO: string): DayOfWeek {
  return DAY_NAMES[new Date(`${dateISO.slice(0, 10)}T12:00:00`).getDay()];
}

function mondayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "3 Aug" — the week-of date the one-off route names. */
export function formatWeekOfDate(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

/**
 * Build the ask context for a team-night move. Pure — the caller (the
 * producer's preview funnel) has already established the source day holds a
 * team anchor; this only names the days the signed strings speak about.
 */
export function teamNightMoveAskContext(args: {
  fromDate: string;
  toDate: string;
}): TeamNightMoveAskContext {
  return {
    fromDate: args.fromDate.slice(0, 10),
    toDate: args.toDate.slice(0, 10),
    targetDayName: weekdayNameForDate(args.toDate),
    usualDayName: weekdayNameForDate(args.fromDate),
    weekStart: mondayFor(args.fromDate),
  };
}

/**
 * THE SEVEN SIGNED STRINGS (Sam, 2026-08-02 — signed as proposed in the
 * team-night movability sheet). Registered rather than inlined in the sheet
 * component so the extraction ceiling holds and L-P2 can vouch for them.
 * Do not edit a string here without Sam's sign-off and the matching copy-sheet
 * edit (Batch 10).
 */
const PROVENANCE = 'Sam, 2026-08-02 — team-night movability sheet signed whole '
  + '(docs/TEAM_NIGHT_MOVABILITY_SHEET_2026-08-01.md; '
  + 'docs/PARKED_QUESTIONS_2026-08-01.md §3): all seven strings as proposed.';

registerSignedCopy([
  {
    id: 'team_night_move_ask_title',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: 'Move team training?',
  },
  {
    id: 'team_night_move_ask_body',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: 'Is this a one-off, or has your club changed nights?',
  },
  {
    id: 'team_night_move_route_this_week_only',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: "Just this week — training's moved for the week of {date}",
  },
  {
    id: 'team_night_move_route_permanent',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: 'Permanent — my team now trains {day}s',
  },
  {
    id: 'team_night_move_back',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: 'Go back — leave it where it is',
  },
  {
    id: 'team_night_move_success_this_week_only',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: 'Got it — team training is on {day} this week only.',
  },
  {
    id: 'team_night_move_success_permanent',
    source: 'signed_sentence',
    provenance: PROVENANCE,
    text: 'Got it — your team nights are updated and your program follows.',
  },
]);

/**
 * Render a registered signed template whose placeholders are DATA (a weekday
 * name, a date) rather than numbers. `signedCopy`'s param type deliberately
 * refuses bare strings so free text can never ride a template into an athlete
 * sentence; here the interpolations are calendar facts derived from the
 * change's own dates, and the TEMPLATE — the signed words — still has exactly
 * one source, the registry entry.
 */
function renderSignedDateTemplate(id: string, params: Record<string, string>): string {
  const entry = signedCopyEntry(id);
  if (!entry) throw new Error(`unsigned team-night copy: ${id}`);
  return entry.text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? params[key] : whole);
}

export const TEAM_NIGHT_MOVE_ASK = {
  title: (): string => signedCopy('team_night_move_ask_title'),
  body: (): string => signedCopy('team_night_move_ask_body'),
  routeLabel: (route: TeamNightMoveRouteId, context: TeamNightMoveAskContext): string =>
    route === 'this_week_only'
      ? renderSignedDateTemplate('team_night_move_route_this_week_only', {
          date: formatWeekOfDate(context.weekStart),
        })
      : renderSignedDateTemplate('team_night_move_route_permanent', {
          day: context.targetDayName,
        }),
  backLabel: (): string => signedCopy('team_night_move_back'),
  successMessage: (route: TeamNightMoveRouteId, context: TeamNightMoveAskContext): string =>
    route === 'this_week_only'
      ? renderSignedDateTemplate('team_night_move_success_this_week_only', {
          day: context.targetDayName,
        })
      : signedCopy('team_night_move_success_permanent'),
} as const;

/**
 * The PERMANENT route's whole input to the one setup owner: the athlete's team
 * days with the vacated weekday replaced by the target weekday. A patch, not a
 * write — `commitProfileProgramTransaction({ kind: 'profile_setup', patch })`
 * remains the only writer of `teamTrainingDays` (grep-gated).
 */
export function teamNightPermanentPatch(
  profile: Pick<OnboardingData, 'teamTrainingDays'>,
  context: Pick<TeamNightMoveAskContext, 'usualDayName' | 'targetDayName'>,
): Partial<OnboardingData> {
  const days = sortSetupDays(Array.from(new Set([
    ...((profile.teamTrainingDays ?? []) as DayOfWeek[])
      .filter((day) => day !== context.usualDayName),
    context.targetDayName,
  ])));
  return {
    teamTrainingDays: days,
    teamTrainingDaysPerWeek: days.length,
  };
}
