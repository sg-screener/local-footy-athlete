/**
 * missedSessions.ts — deterministic detection of past, unlogged training
 * sessions (audit gap: a day that simply passes un-opened is invisible to
 * the app, so its picture of the week silently drifts from reality).
 *
 * ## ONE ITEM PER MISSED THING, NOT PER DAY — SAM, 2026-08-22
 *
 * *"this will be needed for any session that is skipped including games team
 * training and core programmed sessions ... Did you do Thursday strength? ...
 * Also should be Did you complete team training yesterday?"*
 *
 * A Thursday can hold a gym session AND a club night. They are logged through
 * two different doors and skipped independently — the club form has carried
 * that asymmetry since 2026-08-21 — so a single "Did you do Thursday?" cannot
 * be answered: yes to one half is no to the other. This module now emits one
 * `MissedSession` per unlogged COMPONENT KIND, and each carries the door it
 * belongs to.
 *
 * A thing counts as "missed" when ALL of these hold:
 *   - the date is strictly in the past (date < todayISO)
 *   - the day carried a real commitment (not a rest day)
 *   - the athlete never answered for THAT KIND — a saved club night does not
 *     mark the gym session logged, and vice versa
 *
 * ⚠ **GAMES ARE CHASED NOW, AND RECOVERY DAYS ARE TOO.** They were both
 * excluded as "not worth chasing"; Sam's ruling is *"any session that is
 * skipped"*, and both are sessions the athlete either did or did not do. A REST
 * day is still never chased — there is nothing to have done.
 *
 * Pure + input-driven so it unit-tests without stores.
 */

import type { ResolvedDay } from './sessionResolver';
import type { SessionFeedback } from '../store/programStore';
import { getSessionComponents } from './sessionComponents';

/**
 * WHICH DOOR ANSWERS IT. Not a presentation detail: each kind has its own form,
 * its own skip payload and its own idea of what "already logged" means.
 *   - `session`        the programmed work — opens the session view to be ticked
 *   - `team_training`  the club night — opens the club form in place
 *   - `game`           the fixture — opens the game form in place
 */
export type MissedSessionKind = 'session' | 'team_training' | 'game';

export interface MissedSession {
  date: string;
  /** Short label for the prompt, e.g. "Tuesday". */
  weekdayLabel: string;
  /** Session name as shown on the plan, when available. */
  sessionName: string | null;
  /** The door this item is answered through. */
  kind: MissedSessionKind;
  /** True when this item IS the club night. Kept as the flag older callers read. */
  isTeamTraining: boolean;
}

/**
 * A REST DAY, WHICH IS THE ONLY THING THAT IS NEVER CHASED. Recovery SESSIONS
 * (a Mobility day with seven movements) used to be filtered out here with rest;
 * they are a session the athlete did or did not do, and Sam's ruling is "any
 * session that is skipped". A day with no workout, or one named rest, is not.
 */
function isRestDay(day: ResolvedDay): boolean {
  const workout = day.workout;
  if (!workout) return true;
  const name = String(workout.name ?? '').toLowerCase();
  return name === 'rest' || name === 'rest day';
}

function isGame(day: ResolvedDay): boolean {
  return day.workout?.workoutType === 'Game';
}

/**
 * HAS THIS KIND BEEN ANSWERED? Per COMPONENT, never per day.
 *
 * The forms write per-component answers and carry the others through untouched
 * (`ClubTrainingFeedbackPanel`'s own note records why: a club save that claimed
 * the gym's components made Sam's day read as finished and locked him out of
 * logging the gym). Reading the day's single `completion` here would undo that
 * on the way back in — the club night would silence the gym's prompt.
 *
 * A record with no `components` at all is a legacy or whole-day answer, and its
 * `completion` speaks for everything.
 */
function componentAnswered(
  record: SessionFeedback | undefined,
  match: (componentId: string) => boolean,
): boolean {
  if (!record) return false;
  const components = (record as { components?: readonly { componentId: string; completion?: unknown }[] })
    .components;
  if (!components || components.length === 0) return record.completion != null;
  return components.some((entry) => match(entry.componentId) && entry.completion != null);
}

function weekdayLabelForDate(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateISO;
  return parsed.toLocaleDateString('en-AU', { weekday: 'long' });
}

/**
 * Return every past, unlogged trainable day in the visible week, oldest
 * first. The caller typically prompts for the LAST entry (most recent).
 */
export function detectMissedSessions(args: {
  weekDays: ResolvedDay[];
  todayISO: string;
  sessionFeedback: Record<string, SessionFeedback>;
  /**
   * Dates before this are HISTORY from before the program existed (E6):
   * plan rows minted for the week's earlier days are display context, not
   * commitments — the athlete could never have done them, so they are never
   * prompted about and never counted missed. Normally the program's local
   * creation date (`programHistoryBoundaryFromCreatedAt`).
   */
  programHistoryBeforeISO?: string | null;
}): MissedSession[] {
  const { weekDays, todayISO, sessionFeedback } = args;
  const out: MissedSession[] = [];
  for (const day of weekDays) {
    if (day.date >= todayISO) continue; // today + future are not "missed" yet
    if (args.programHistoryBeforeISO && day.date < args.programHistoryBeforeISO) continue;
    if (!day.workout) continue;
    if (isRestDay(day)) continue;
    const record = sessionFeedback[day.date];
    const name = day.workout.name ?? null;
    const base = {
      date: day.date,
      weekdayLabel: weekdayLabelForDate(day.date),
      sessionName: name,
    };

    // A FIXTURE IS ONE THING AND ONLY ONE. Its form asks about the match; a
    // game day carries no gym components to ask about separately.
    if (isGame(day)) {
      if (!componentAnswered(record, () => true)) {
        out.push({ ...base, kind: 'game', isTeamTraining: false });
      }
      continue;
    }

    const components = getSessionComponents(day.workout as Parameters<typeof getSessionComponents>[0]);
    const hasTeam = components.some((component) => component.kind === 'team_training');
    const hasProgrammed = components.some((component) => component.kind !== 'team_training');

    // THE PROGRAMMED HALF, and it is asked about even when the club half is
    // already logged — which is the whole reason this loop stopped keying on
    // the day.
    if (hasProgrammed && !componentAnswered(record, (id) => id !== 'team_training')) {
      out.push({ ...base, kind: 'session', isTeamTraining: false });
    }
    if (hasTeam && !componentAnswered(record, (id) => id === 'team_training')) {
      out.push({ ...base, kind: 'team_training', isTeamTraining: true });
    }
  }
  return out.sort((a, b) => (a.date === b.date
    ? a.kind.localeCompare(b.kind)
    : a.date.localeCompare(b.date)));
}

/** The single day to prompt about (most recent missed), or null. */
export function mostRecentMissedSession(args: {
  weekDays: ResolvedDay[];
  todayISO: string;
  sessionFeedback: Record<string, SessionFeedback>;
  programHistoryBeforeISO?: string | null;
}): MissedSession | null {
  const all = detectMissedSessions(args);
  return all.length > 0 ? all[all.length - 1] : null;
}

/**
 * The signup boundary in LOCAL calendar terms. A Thursday-morning signup in
 * Melbourne is still Wednesday in UTC, so slicing the raw ISO instant would
 * exempt one day too few.
 */
/**
 * ⚠ **THE BOUNDARY CANNOT COME FROM THE PROGRAM OBJECT, AND THAT IS WHY NOTHING
 * WAS EVER PROMPTED — FOUND 2026-08-22.**
 *
 * `programHistoryBoundaryFromCreatedAt` below is the E6 rule: days from before
 * the program existed are display context, never chased. Its input was
 * `currentProgram.createdAt` — and this app REGENERATES the program on every
 * launch, so that timestamp is always a few milliseconds old. The boundary was
 * therefore always TODAY, every past day was "history", and the prompt could
 * not fire for anyone. It had been dead in the live app for as long as the app
 * has regenerated at boot.
 *
 * MEASURED, NOT REASONED: Sam's own device had two unlogged past days in the
 * visible week and showed no prompt, with `currentProgram` absent from the
 * persisted store entirely — nothing but a fresh object to date it from.
 *
 * **THE DURABLE ANSWER IS A DECISION, NOT AN OBJECT.** An accepted block is
 * stored, keyed by the Monday it starts, and it exists because the athlete
 * accepted it — so the earliest one is the earliest date this program provably
 * existed. It survives boot, which is the whole property `createdAt` lacked.
 *
 * ⚠ **WHAT IT DOES NOT KNOW IS THE SIGNUP DAY.** An athlete who signed up on a
 * Wednesday has a block starting that Monday, so Monday and Tuesday can be
 * asked about. Dating that precisely needs a stored first-run date — a new
 * persisted fact, and a unit of its own. Named here rather than invented.
 */
export function programHistoryBoundaryFromAcceptedBlocks(
  acceptedBlockStarts: readonly string[],
): string | null {
  let earliest: string | null = null;
  for (const start of acceptedBlockStarts) {
    if (typeof start !== 'string' || !start.trim()) continue;
    if (!earliest || start < earliest) earliest = start;
  }
  return earliest;
}

export function programHistoryBoundaryFromCreatedAt(
  createdAt: string | undefined | null,
): string | null {
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** R-275: attendance yes/no plus an explicit route to reschedule the unlogged item. */
export type MissedSessionResponse = 'did_it' | 'skipped_it' | 'move_it';

/**
 * A skipped answer records attendance only. "Yes, log it" must go through the
 * real form so the app never invents effort or readiness answers.
 *
 * ⚠ **IT NAMES THE COMPONENTS IT IS ANSWERING FOR, AND CARRIES THE REST
 * THROUGH.** `sessionOutcomeTransaction` fans a bare day-level completion out
 * to EVERY component, so a whole-day `{ completion: 'skipped' }` from this
 * prompt would mark a club night skipped because the gym session was — the
 * mirror image of the defect Sam reported on 2026-08-21, when a club save
 * claimed the gym's components. This is the same recipe
 * `ClubTrainingFeedbackPanel` uses, pointed at the other half.
 */
export function missedSessionSkippedFeedback(
  date: string,
  options?: {
    readonly kind?: MissedSessionKind;
    readonly components?: readonly { id: string; kind: string; label: string }[];
    readonly existing?: SessionFeedback | null;
  },
): SessionFeedback {
  const kind = options?.kind;
  const components = options?.components;
  const existing = options?.existing ?? null;
  // No component list to answer for — the day-level answer is the honest one,
  // and it is what a game day and every legacy caller writes.
  if (!kind || !components || components.length === 0) {
    return { ...(existing ?? {}), dateStr: date, completion: 'skipped' } as SessionFeedback;
  }
  const answering = components.filter((component) => (kind === 'team_training'
    ? component.kind === 'team_training'
    : component.kind !== 'team_training'));
  if (answering.length === 0) {
    return { ...(existing ?? {}), dateStr: date, completion: 'skipped' } as SessionFeedback;
  }
  const answeringIds = new Set(answering.map((component) => component.id));
  const carried = ((existing as { components?: readonly { componentId: string }[] } | null)
    ?.components ?? []).filter((entry) => !answeringIds.has(entry.componentId));
  return {
    ...(existing ?? {}),
    dateStr: date,
    completion: existing?.completion ?? 'skipped',
    components: [
      ...carried,
      ...answering.map((component) => ({
        componentId: component.id,
        kind: component.kind,
        label: component.label,
        completion: 'skipped',
        partialReason: null,
        skipReason: null,
      })),
    ],
  } as SessionFeedback;
}
