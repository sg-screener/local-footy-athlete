/**
 * THE COACH'S FIRST SENTENCE — DERIVED FROM THE WEEK THE ATHLETE CAN SEE.
 *
 * Slice 1 of the coach rebuild (docs/COACH_REBUILD_KICKOFF_2026-08-09.md): the
 * tab "opens knowing your week". This module is the whole of that knowing, and
 * it is a pure function of the projection — no store, no clock, no navigation,
 * no React (L14).
 *
 * ## WHY IT READS `VisibleWeek` AND NOT A COACH PACKET
 *
 * Sam's ruling 1 already settled this for prose: *the coach reads the same
 * projection; `summariseDay` is retired as an independent composition.* A
 * surface with a VOICE is still a surface. So the opener is a `Surface<T>` in
 * everything but name — it receives the days the Program tab receives and may
 * not compose its own account of them.
 *
 * It goes one step stricter than `coachView` and the reason is worth stating:
 * a day's NAME comes from `visibleDayLeadHeadline`, which is the same function
 * `HomeScreenV2` calls for the week row. Not an equivalent function, not the
 * same rule re-implemented — the same call. So "Strength" in the coach's first
 * sentence and "Strength" on Tuesday's row are one derivation, and the day they
 * disagree is the day somebody deletes the shared owner. `coachView` drops
 * `bucket`, which is exactly the field that naming needs, so consuming it here
 * would have forced a second naming rule — the thing ruling 1 forbids.
 *
 * ## THE GROUNDS ARE RETURNED BESIDE THE WORDS, AND THAT IS L-C1 AS DATA
 *
 * L-C1 (the brain law) says the coach never states what no rule or fact
 * answers. That is unenforceable as prose, so `CoachOpener` carries the facts
 * the sentence was built from. A gate can then ask the only question that
 * matters — *does every claim in the text correspond to a day in the
 * projection?* — instead of asking whether the sentence looks plausible.
 *
 * ## NO CLOCK
 *
 * `todayISO` is an argument. The screen reads the clock through the same door
 * every other surface does; this module cannot invent today, which is the
 * refusal `wornWorldBootTests` exists to protect elsewhere and costs nothing to
 * honour here.
 */

import { weekdayName } from '../utils/appDate';
import { COACH_OPENER_COPY } from './coachTabCopy';
import { visibleDayLeadHeadline } from './visibleDayDetail';
import type { VisibleDayKind, VisibleWeek } from './visibleProjection';

/** One day, as the opener is allowed to know it. */
export interface CoachOpenerDay {
  readonly date: string;
  readonly kind: VisibleDayKind;
  /** `visibleDayLeadHeadline` — the week row's own words, not a second naming. */
  readonly name: string;
}

/**
 * THE RECEIPT. Every fact the sentence is entitled to use, and no others.
 *
 * `nextFixture` is deliberately null when the fixture is today or tomorrow: the
 * day clause already names it, and naming it twice is the "Strength + Strength"
 * failure the compound-bucket dedupe was written for, one layer up.
 */
export interface CoachOpenerGrounds {
  readonly todayISO: string;
  readonly today: CoachOpenerDay | null;
  readonly tomorrow: CoachOpenerDay | null;
  readonly nextFixture: CoachOpenerDay | null;
}

export interface CoachOpener {
  readonly text: string;
  readonly grounds: CoachOpenerGrounds;
}

function openerDay(
  week: VisibleWeek,
  dateISO: string,
): CoachOpenerDay | null {
  const day = week.days.find((candidate) => candidate.date === dateISO);
  if (!day) return null;
  return { date: day.date, kind: day.kind, name: visibleDayLeadHeadline(day) };
}

/**
 * WHAT THE COACH KNOWS ABOUT THIS WEEK.
 *
 * Split from the wording on purpose: the facts can be asserted against the
 * projection, and the sentence can be asserted against the facts, without
 * either test having to reason about the other.
 */
export function coachOpenerGrounds(args: {
  readonly week: VisibleWeek;
  readonly todayISO: string;
}): CoachOpenerGrounds {
  const { week, todayISO } = args;
  const today = openerDay(week, todayISO);
  const tomorrowISO = nextDayISO(todayISO);
  const tomorrow = openerDay(week, tomorrowISO);

  // The nearest fixture STRICTLY AFTER tomorrow. Days are compared as ISO
  // strings, which sort correctly and never construct a Date — the fixture is
  // located in the projection, never computed from a clock.
  const fixtureDay = week.days.find(
    (day) => day.kind === 'game' && day.date > tomorrowISO,
  );
  const nextFixture = fixtureDay ? openerDay(week, fixtureDay.date) : null;

  return { todayISO, today, tomorrow, nextFixture };
}

/**
 * THE SENTENCE.
 *
 * Short by construction: at most three clauses, each one a fact with no
 * connective tissue between them. There is no branch here that adds a reason,
 * because a reason is policy and L-C1 says policy comes from the Bible or from
 * a ruling, never from the sentence builder.
 */
export function coachOpener(args: {
  readonly week: VisibleWeek;
  readonly todayISO: string;
}): CoachOpener {
  const grounds = coachOpenerGrounds(args);
  return { text: openerText(grounds), grounds };
}

export function openerText(grounds: CoachOpenerGrounds): string {
  const clauses: string[] = [];
  if (grounds.nextFixture) {
    clauses.push(
      `${COACH_OPENER_COPY.fixtureLead} ${weekdayName(grounds.nextFixture.date)}`,
    );
  }
  if (grounds.today) {
    clauses.push(`${grounds.today.name} ${COACH_OPENER_COPY.today}`);
  }
  if (grounds.tomorrow) {
    clauses.push(`${grounds.tomorrow.name} ${COACH_OPENER_COPY.tomorrow}`);
  }
  if (clauses.length === 0) return COACH_OPENER_COPY.noWeek;
  return clauses.join(COACH_OPENER_COPY.clauseJoin) + COACH_OPENER_COPY.fullStop;
}

/**
 * Tomorrow, by calendar arithmetic on the ISO string's own day number.
 *
 * Local, and deliberately not `addDaysISO`: that helper builds a `Date` at noon
 * and formats it back, which is correct but drags a timezone-sensitive path
 * into a module whose whole claim is purity. Here the input is already a date
 * with no time in it, so UTC arithmetic on it is exact.
 */
function nextDayISO(dateISO: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.slice(0, 10));
  if (!match) throw new Error(`Invalid ISO date: ${dateISO}`);
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + 1,
  ));
  return date.toISOString().slice(0, 10);
}
