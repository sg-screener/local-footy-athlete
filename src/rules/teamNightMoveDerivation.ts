import type { Workout, WeekScopedWorkoutOverlay } from '../types/domain';
import type { TemporaryScheduleFact } from './temporarySourceFact';
import type { ResolvedDay } from '../utils/sessionResolver';
import { splitAcceptedSessionForAthleteMove } from '../utils/sessionComponents';
import { stackSessionOntoTeamAnchor } from '../utils/canonicalPlanChangeCandidateMaterializer';
import { getTeamTrainingWorkoutState } from '../utils/teamTraining';

/**
 * THE ONE-OFF TEAM-NIGHT MOVE'S RULED EFFECT (Sam, signed 2026-08-02):
 * "team training is on <target day> instead of <usual day>, for the week of
 * <date>". The week re-derives around the fact — and "re-derives" means the
 * ANCHOR RELOCATES within the week the athlete actually has, not that
 * generation invents a new week:
 *
 *   - the LANDING day obeys the doubling law (2026-07-30, ruling 3): the
 *     anchor lands COMBINED beside whatever the day already holds, and the
 *     anchor stays an anchor on its new day;
 *   - the VACATED day re-derives to what remains of it without the anchor
 *     (its gym/conditioning content stays; a team-only night becomes rest);
 *   - EVERY OTHER DAY IS CONSERVED BYTE-FOR-BYTE, by construction: the
 *     overlay carries exactly two dates, and both resolvers fall through to
 *     the untouched base on every missing key (the same sparse-overlay shape
 *     the deriving lane's remainder boundary already uses).
 *
 * This module authors CONTENT for the deriving lane's team-night branch; the
 * lane itself (commitDerivingSourceFactScopedRegen) still owns the contract
 * fixpoint, the fact-linked reversible adjustment, and the atomic §18-gated
 * commit — so resolving the fact cascade-reverts byte-exact exactly like
 * every other deriving fact. No new content authority: the split and stack
 * owners are the same ones the athlete move door already uses.
 */

export function isTeamNightMoveFact(
  fact: unknown,
): fact is TemporaryScheduleFact & { scheduleKind: 'team_night_move' } {
  return !!fact && typeof fact === 'object' &&
    (fact as { factKind?: string }).factKind === 'schedule' &&
    (fact as { scheduleKind?: string }).scheduleKind === 'team_night_move';
}

export type TeamNightMoveOverlayResult =
  | { ok: true; overlay: WeekScopedWorkoutOverlay }
  | {
      ok: false;
      code: 'fact_outside_week' | 'no_team_anchor_on_source_day';
    };

function resolvedDayFor(date: string, workout: Workout | null): ResolvedDay {
  const dow = new Date(`${date}T12:00:00`).getDay();
  return {
    date,
    dayOfWeek: dow,
    short: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dow],
    isToday: false,
    workout,
    source: workout ? 'manual' : 'none',
  } as ResolvedDay;
}

/**
 * Build the sparse two-date overlay for one `team_night_move` fact over the
 * week's CURRENT effective content (base + earlier overlays + athlete edits,
 * exactly what `rebaseAcceptedEffectiveWeek` returned to the caller).
 */
export function buildTeamNightMoveWeekOverlay(args: {
  fact: TemporaryScheduleFact;
  weekStart: string;
  /** The week the athlete actually has, keyed by ISO date. */
  effectiveWorkoutsByDate: ReadonlyMap<string, Workout | null>;
  now: string;
}): TeamNightMoveOverlayResult {
  const fromDate = args.fact.teamNightFromDate;
  const toDate = args.fact.teamNightToDate;
  const weekEnd = (() => {
    const date = new Date(`${args.weekStart}T12:00:00`);
    date.setDate(date.getDate() + 6);
    return date.toISOString().slice(0, 10);
  })();
  if (!fromDate || !toDate ||
    fromDate < args.weekStart || fromDate > weekEnd ||
    toDate < args.weekStart || toDate > weekEnd) {
    return { ok: false, code: 'fact_outside_week' };
  }

  const sourceWorkout = args.effectiveWorkoutsByDate.get(fromDate) ?? null;
  if (!sourceWorkout || !getTeamTrainingWorkoutState(sourceWorkout).hasTeamTraining) {
    return { ok: false, code: 'no_team_anchor_on_source_day' };
  }

  // The split owner the move door already uses: ONE snapshot yields both what
  // leaves (the team component) and what stays. A team-only night has no
  // non-team section to survive, so the split refuses `scope_not_on_day` when
  // the projection carries no separate section — in that case the whole
  // workout IS the anchor and the day becomes rest.
  const teamState = getTeamTrainingWorkoutState(sourceWorkout);
  let movedAnchor: Workout;
  let remaining: Workout | null;
  if (teamState.isTeamTrainingOnly) {
    movedAnchor = sourceWorkout;
    remaining = null;
  } else {
    const split = splitAcceptedSessionForAthleteMove({
      day: resolvedDayFor(fromDate, sourceWorkout),
      scope: 'team_component',
    });
    if (split.ok === false) {
      // The day renders team training without a snapshot 'session' section
      // (name-composed combos). Conservative fallback: the whole day travels
      // as the anchor container and nothing remains — never invent a split
      // the snapshot cannot see.
      movedAnchor = sourceWorkout;
      remaining = null;
    } else {
      movedAnchor = split.movedWorkout;
      remaining = split.remainingWorkout;
    }
  }

  const toDow = new Date(`${toDate}T12:00:00`).getDay();
  const fromDow = new Date(`${fromDate}T12:00:00`).getDay();
  const relocatedAnchor: Workout = {
    ...movedAnchor,
    dayOfWeek: toDow,
    isTeamDay: true,
  };
  const landingExisting = args.effectiveWorkoutsByDate.get(toDate) ?? null;
  // Doubling law: an occupied landing day lands COMBINED — the anchor arrives,
  // the day's own session stays, nothing travels back to the source.
  const landing = landingExisting
    ? stackSessionOntoTeamAnchor({ anchorDay: relocatedAnchor, addition: landingExisting })
    : relocatedAnchor;

  const overlayId = `week-overlay:${args.weekStart}:team_night_move:${toDate}`;
  // DELIBERATELY NO CONTRACT ON THE OVERLAY. Attaching the finalised
  // evaluation contract (even with the anchor relocated) makes the rebase
  // re-author planner-derived rows on untouched days — the exact
  // conservation the law forbids. Without one, both resolvers keep the
  // base week's contract and the two overlaid dates are the whole change;
  // the §18 gate still validates the committed week (validateWeekStarts).
  const overlay: WeekScopedWorkoutOverlay = {
    id: overlayId,
    weekStart: args.weekStart,
    weekEnd,
    anchorDate: toDate,
    reason: 'team_night_move',
    workoutsByDate: {
      [fromDate]: remaining,
      [toDate]: { ...landing, dayOfWeek: toDow },
    },
    createdAt: args.now,
    updatedAt: args.now,
  };
  return { ok: true, overlay };
}
