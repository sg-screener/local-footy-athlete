/**
 * durableFactHorizon — the SINGLE owner of "how long is this fact true?".
 *
 * Before Stage 1 four representations answered that question and the first
 * silently truncated the rest:
 *
 *   1. the ProgramControlAction's `scope` string ('current_week' / 'today_only')
 *   2. the fact's `effectiveFrom`/`effectiveUntil` pair, minted by
 *      `temporaryFactScope({kind:'week'})` as `mondayFor(anchor) .. +6`
 *   3. the week-mode derivation's own overlap predicate
 *   4. the authored overlay's key set (exactly one week)
 *
 * Both bounds in (2) were invented rather than reported: the END was truncated
 * to the report week's Sunday, so "I'm properly sick" silently stopped being
 * true at midnight on Sunday; and the START was back-dated to Monday, over days
 * that had already happened — on a Friday report that rewrote three sessions the
 * athlete had already completed. `status: 'active'` and `effectiveUntil` could
 * disagree, because **"active until cleared" had no representation in the type**.
 *
 * After Stage 1 there is one representation: the horizon below. It has an
 * explicit start that is never earlier than the moment the athlete spoke, and an
 * end that is either a date or genuinely OPEN. Every consumer reads it through
 * this module; `durableFactHorizonTests` T5 pins that statically, so the fix
 * cannot decay back into per-consumer rules.
 *
 * See `docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`
 * (Option B1, approved).
 */

import type { TemporarySourceFact, TemporarySourceFactScope } from './temporarySourceFact';

/**
 * The one effect window.
 *
 * `endsAfter: null` means OPEN — true until the athlete resolves it. It is not
 * "unknown" and not "forever": an open fact ends when the athlete says it ends,
 * which is the only authority that was ever entitled to end it.
 */
export interface DurableFactHorizon {
  /** First date this fact shapes. Never earlier than the report. */
  startsFrom: string;
  /** Last date, or `null` for open-until-resolved. */
  endsAfter: string | null;
}

/** `TemporarySourceFact` without importing the value module (avoids a cycle). */
function isInjury(fact: TemporarySourceFact): boolean {
  return 'episodeId' in fact;
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}

function mondayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function laterOf(left: string, right: string): string {
  return left >= right ? left : right;
}

/**
 * Mint the window for a DURABLE STATE fact — severe illness, cooked fatigue,
 * repeated poor sleep. These are statements about the athlete's body that stay
 * true until the athlete says otherwise, so the window is open-ended.
 *
 * The start is `max(anchorDate, todayISO)` and nothing else. There is
 * deliberately no `mondayFor` here: back-dating to Monday is the defect this
 * replaces. Reported on Friday, it starts Friday. Reported on Friday about next
 * week (the athlete is looking at next week's card), it starts next Monday.
 */
export function durableStateFactScope(args: {
  anchorDate: string;
  todayISO: string;
}): TemporarySourceFactScope {
  const from = laterOf(args.anchorDate.slice(0, 10), args.todayISO.slice(0, 10));
  return { kind: 'open', from, until: null };
}

/**
 * The effect window of any fact.
 *
 * Non-injury facts carry their own window; an `until` of `null` is open.
 * Injury episodes still express their reach as `affectedWeeks` — that is
 * Stage 2's subject (see Addendum A), and Stage 1 deliberately reports it
 * unchanged rather than quietly widening a horizon no test covers yet.
 */
export function factHorizon(fact: TemporarySourceFact): DurableFactHorizon {
  if (isInjury(fact)) {
    const weeks = [...(fact as { affectedWeeks: string[] }).affectedWeeks].sort();
    const reported = (fact as { onsetOrReportedDate?: string }).onsetOrReportedDate?.slice(0, 10);
    const first = weeks[0] ?? reported ?? '1970-01-01';
    const last = weeks[weeks.length - 1] ?? first;
    // Same start rule as every durable state fact: never earlier than the
    // report. An injury reported Friday shapes Friday onward — the Monday of
    // its affected week is bookkeeping, not licence to rewrite done days.
    return {
      startsFrom: reported && reported > first ? reported : first,
      endsAfter: addDays(last, 6),
    };
  }
  const nonInjury = fact as { effectiveFrom: string; effectiveUntil: string | null };
  return { startsFrom: nonInjury.effectiveFrom, endsAfter: nonInjury.effectiveUntil ?? null };
}

/** Is the fact in effect on this date? */
export function horizonCoversDate(horizon: DurableFactHorizon, dateISO: string): boolean {
  const date = dateISO.slice(0, 10);
  if (date < horizon.startsFrom) return false;
  return horizon.endsAfter === null || date <= horizon.endsAfter;
}

export function factHorizonCoversDate(fact: TemporarySourceFact, dateISO: string): boolean {
  return horizonCoversDate(factHorizon(fact), dateISO);
}

/** Does the fact reach any day of the week beginning `weekStartISO`? */
export function horizonCoversWeek(horizon: DurableFactHorizon, weekStartISO: string): boolean {
  const weekStart = weekStartISO.slice(0, 10);
  const weekEnd = addDays(weekStart, 6);
  if (horizon.startsFrom > weekEnd) return false;
  return horizon.endsAfter === null || horizon.endsAfter >= weekStart;
}

export function factHorizonCoversWeek(fact: TemporarySourceFact, weekStartISO: string): boolean {
  return horizonCoversWeek(factHorizon(fact), weekStartISO);
}

/** Has the fact's window elapsed as of `onDate`? Open horizons never elapse. */
export function factHorizonHasElapsed(fact: TemporarySourceFact, onDate: string): boolean {
  const horizon = factHorizon(fact);
  return horizon.endsAfter !== null && horizon.endsAfter < onDate.slice(0, 10);
}

export function isOpenHorizon(fact: TemporarySourceFact): boolean {
  return factHorizon(fact).endsAfter === null;
}

/**
 * Which of `candidateWeekStarts` this fact reaches, in order.
 *
 * An open horizon is unbounded, so the caller supplies the weeks that actually
 * exist — the accepted program's microcycles. "Every week until cleared" then
 * means "every week the athlete has", which is the only bound that is honest
 * about what the app can author.
 */
export function factHorizonWeeks(
  fact: TemporarySourceFact,
  candidateWeekStarts: readonly string[],
): string[] {
  return Array.from(new Set(candidateWeekStarts.map((week) => week.slice(0, 10))))
    .filter((week) => factHorizonCoversWeek(fact, week))
    .sort();
}

/**
 * The first date in `weekStartISO` this fact may shape. Days before it are
 * PAST relative to the report and must survive untouched, Done or not: a
 * session the athlete already did cannot be re-prescribed retrospectively
 * (L6, honest actions).
 */
export function firstShapedDateInWeek(
  fact: TemporarySourceFact,
  weekStartISO: string,
): string {
  const weekStart = weekStartISO.slice(0, 10);
  return laterOf(weekStart, factHorizon(fact).startsFrom);
}

/** The Monday of the week a fact begins in. */
export function horizonStartWeek(fact: TemporarySourceFact): string {
  return mondayFor(factHorizon(fact).startsFrom);
}
