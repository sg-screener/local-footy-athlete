/**
 * ONE READING SEAM — SLICE 3's ANSWER TO THE RESOLVER CLASS.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S3: *"IT CHANGES THINGS. The change
 * card (L-C2) + confirm + execution through executeProgramControlAction."*
 *
 * ## WHY THIS MODULE EXISTS AT ALL, AND IT IS THE ORDER'S OWN WARNING
 *
 * The obvious S3 move is a `CoachRequestReader` beside slice 2's
 * `CoachQuestionReader` — one reads questions, one reads change requests, the
 * screen tries them in some order. **That order is a table, and this is the
 * defect the slice-2 boundary named**: *"a resolver that picks the FIRST
 * matching rule from an ordered table answers by table order, and a test set
 * with one marker per message can never observe the ordering."*
 *
 * A change request phrased politely IS a question: *"can you move Friday's
 * session to Sunday?"* carries an interrogative marker AND a move marker. With
 * two readers in sequence the question reader wins, and the coach answers a
 * question the athlete did not ask instead of proposing the change they did.
 * The message that exposes it is the FIRST message anybody would type.
 *
 * So there is ONE reading seam. A message is read once, by one rule, and comes
 * out as either a question (slice 2's, unchanged) or a change request. The
 * families cannot be tried in an order because there is no order to try.
 *
 * ## THE PRECEDENCE RULE, AND WHY IT CAN FAVOUR THE CHANGE
 *
 * A change verb with a day beats an interrogative. That looks like the unsafe
 * direction — slice 2's safety was that anything unrecognised becomes `unknown`
 * — and it is not, because of L-C2: **a change request produces a CARD, never a
 * mutation.** Mis-reading a question as a request costs the athlete a card they
 * decline. Mis-reading a request as a question costs them the feature. The card
 * is what makes this precedence safe, which is L-C2 doing structural work
 * rather than decorative work.
 *
 * `unknown` is still the floor: a message with no change verb and no answerable
 * subject is `unknown`, and the coach says it does not know.
 *
 * ## THE MARKER MATRIX CAME BEFORE THIS FILE
 *
 * Ordered by the seat: *"build the matrix before the resolver, not after its
 * first survivor."* `coachTabSlice3Tests` [1] enumerates every pair of marker
 * families that can co-occur in one message and pins what the reader must
 * return for each — including the pairs this module gets right by accident
 * today, so that it stops being an accident.
 *
 * L14: pure. No React, no store, no clock — `todayISO` is an argument.
 */

import {
  lexicalQuestionReader,
  namedDaysInMessageOrder,
  type CoachQuestion,
  type NamedDay,
} from './coachQuestion';
import type { VisibleWeek } from './visibleProjection';

/**
 * THE CHANGE KINDS SLICE 3 MAY REQUEST.
 *
 * ONE, and the smallness is the order's: *"Allow-listed kinds first — start
 * from the doors that already reach the ledger … one kind at a time behind the
 * same card."* `move_session` is the first because it is the door the undo unit
 * proved end to end, it appends its own `plan_change` decision inside
 * `applyPlanChange`, and it is the mock's first chip.
 *
 * It is a string literal union rather than a re-use of `ProgramControlActionType`
 * on purpose: the door's vocabulary has 26 members and the coach may request
 * ONE. Widening this union is the commit that teaches the proposal, the card
 * and the gate a second kind, together.
 */
export type CoachChangeKind = 'move_session';

/**
 * WHAT THE ATHLETE ASKED THE COACH TO CHANGE.
 *
 * Days are DATES looked up in the week the coach was handed, by the ledger's
 * own targeting law (`decisionLedger.ts:9-11` — a decision names a date, never
 * a derived session id). `null` with `named: true` is a day the athlete named
 * that the coach cannot see; `named: false` is a day they never named. The
 * proposal layer answers those two differently and that is why they are
 * distinct here.
 */
export interface CoachChangeRequest {
  readonly kind: CoachChangeKind;
  readonly from: NamedDay | null;
  readonly to: NamedDay | null;
}

export type CoachRead =
  | { readonly intent: 'question'; readonly question: CoachQuestion }
  | { readonly intent: 'change'; readonly request: CoachChangeRequest };

export interface ReadCoachMessageInput {
  readonly message: string;
  readonly week: VisibleWeek;
  readonly todayISO: string;
}

/**
 * THE MOVE VERBS.
 *
 * A word an athlete uses to mean *put this work on a different day*. Word
 * boundaries throughout, so "movement" is not a move and "pushed" is not a
 * push — a verb list without `\b` is a substring list, and a substring list
 * matches inside the training vocabulary it is supposed to sit beside.
 *
 * `swap` is deliberately ABSENT. It is a different door (`swap_session`,
 * `swap_exercise`) and slice 3 has one kind; reading "swap Friday for Sunday"
 * as a move would be the coach doing something adjacent to what was asked,
 * which is worse than saying it cannot. It falls through to `unknown`.
 */
const MOVE_VERB = /\b(?:move|moving|moved|shift|shifting|shifted|reschedule|rescheduling|rescheduled|bump|bumping|bumped|push|pushing|pushed)\b/i;

/**
 * THE DESTINATION PREPOSITION — which of two named days is the "to".
 *
 * "Move Friday to Sunday" and "move to Sunday the Friday session" name the same
 * two days in different orders, and only the preposition tells them apart. When
 * it is present the day after it is the destination; when it is absent the
 * athlete's word order is the rule (first named is what moves).
 */
const DESTINATION_PREPOSITION = /\b(?:to|onto|into|across\s+to)\b/i;

/**
 * READ ONE MESSAGE, ONCE.
 *
 * The change test runs first and it is not a table position — it is the
 * specificity rule written out: a message carrying a move verb is a request to
 * move something, whatever else it also carries. A message without one is
 * handed to slice 2's reader unchanged, so every question the coach answered
 * yesterday it answers today, by the same code.
 */
export function readCoachMessage(input: ReadCoachMessageInput): CoachRead {
  const text = (input.message ?? '').trim();

  if (MOVE_VERB.test(text)) {
    return { intent: 'change', request: moveRequest(input, text) };
  }

  return {
    intent: 'question',
    question: lexicalQuestionReader.read({
      message: text,
      week: input.week,
      todayISO: input.todayISO,
    }),
  };
}

/**
 * WHICH DAY MOVES, AND WHERE TO.
 *
 * Both slots may be empty and an empty slot is not a failure — it is a question
 * the coach asks (L-C1: *"when NO rule answers, it ASKS"*). A request with no
 * source is *"which day do you want to move?"*, which is a better turn than a
 * guess and a much better turn than a shrug.
 */
function moveRequest(input: ReadCoachMessageInput, text: string): CoachChangeRequest {
  const days = namedDaysInMessageOrder(text, input.week, input.todayISO);
  if (days.length === 0) return { kind: 'move_session', from: null, to: null };

  const prepositionAt = text.search(DESTINATION_PREPOSITION);
  if (days.length === 1) {
    // ONE DAY AND A PREPOSITION BEFORE IT IS A DESTINATION, NOT A SOURCE.
    // "Move it to Sunday" names Sunday as where, not as what — and answering it
    // as "move Sunday somewhere" would move the wrong day.
    const isDestination = prepositionAt >= 0 && prepositionAt < days[0].at;
    return isDestination
      ? { kind: 'move_session', from: null, to: days[0] }
      : { kind: 'move_session', from: days[0], to: null };
  }

  // TWO OR MORE. The destination is the first day the preposition introduces;
  // the source is the first day that is not it. Beyond two named days the
  // athlete is describing something this kind cannot express, and the extras
  // are ignored rather than guessed at.
  const destination = prepositionAt >= 0
    ? days.find((day) => day.at > prepositionAt) ?? days[days.length - 1]
    : days[1];
  const source = days.find((day) => day !== destination) ?? null;
  return { kind: 'move_session', from: source, to: destination };
}
