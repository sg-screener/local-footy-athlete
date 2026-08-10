/**
 * THE CHANGE CARD — L-C2's CONTRACT, AS A PROJECTION OF THE ACTION.
 *
 * Sam's ruling 2 on the mock, verbatim: *"I really like the little pop up 'the
 * change' that makes it clear what was changed and why."* The kickoff turned it
 * into law:
 *
 *   **L-C2 THE CHANGE CARD IS THE CONTRACT.** *"No coach mutation without the
 *   card — what changes, from what, to what, and why, before the athlete's yes.
 *   The card renders from the ProgramControlAction itself (one projection — no
 *   surface composes its own words about a change), so card and change cannot
 *   drift."*
 *
 * ## "FROM THE ACTION ITSELF" IS A SIGNATURE, NOT A HABIT
 *
 * This function takes the action and the week and returns every word the card
 * shows. It cannot drift from the change because it has nothing else to read:
 * there is no request, no message, no conversation and no intent in scope. A
 * card built from the athlete's SENTENCE would be a card describing what they
 * asked for; this one describes what the door is about to be given.
 *
 * The week is here for one reason and it is not composition: the action names
 * two DATES, and a date is not a thing an athlete recognises. The week turns
 * a date into the day's own projected name — through `describeVisibleDay`, the
 * SAME function the coach's answer uses, so the card and the answer cannot come
 * to describe Friday differently.
 *
 * ## WHAT THE CARD MAY NOT DO, AND IT IS ENFORCED BY WHAT IT RETURNS
 *
 * It returns DATA, not a sentence. The screen renders labelled fields and adds
 * no words of its own; there is no place for it to, because every string it
 * needs is in this object. A card that returned prose would leave the surface
 * deciding how to lay out a claim about the athlete's program, and a surface
 * that lays out a claim is a surface that can make one.
 *
 * L14: pure.
 */

import { COACH_CHANGE_COPY } from './coachTabCopy';
import { describeVisibleDay } from './coachAnswer';
import type { VisibleWeek } from './visibleProjection';
import type { ProgramControlAction } from '../types/programControlAction';

export interface CoachChangeCardField {
  readonly label: string;
  readonly value: string;
}

/**
 * ONE WAY THROUGH A DAY, IN THE OWNER'S OWN WORDS.
 *
 * `label` and `sub` are `moveOptionsForDay`'s `MOVE_SCOPE_COPY` verbatim — the
 * strings the athlete's own picker renders. NOTHING here is coach-authored, and
 * that is the whole point of L-C4: on a day the athlete is offered *"Just the
 * gym session"*, the coach offers that same row, from that same call, or it has
 * a second opinion about what the day can do.
 *
 * `action` is finished. The row carries the action it means, so the screen
 * executes a choice rather than assembling one — a screen that built the
 * payload would be a second author of `payload.scope`.
 */
export interface CoachChangeCardChoice {
  readonly id: string;
  readonly label: string;
  readonly sub: string;
  readonly action: ProgramControlAction;
}

export interface CoachChangeCard {
  readonly title: string;
  /** What changes, from what, to what, and why — L-C2's four, in order. */
  readonly fields: readonly CoachChangeCardField[];
  /**
   * The ways through this day, when there is more than one. EMPTY when the day
   * offers exactly one — a single row is not a choice, and rendering a chooser
   * with one option is two names for one action (`moveOptionsForDay` makes the
   * same call for the sheet's picker).
   *
   * ON THE CARD, not in a follow-up message: the seat's order is that the
   * choice needs no second turn of context. A coach that asked *"which part?"*
   * in prose would be re-authoring a question the owner already answers in
   * signed words.
   */
  readonly choices: readonly CoachChangeCardChoice[];
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  /**
   * Every date the card was entitled to name, and every projection string it
   * used. Slice 1's grounds pattern: *"does every day the coach names exist in
   * the week it was given, under that day's own projected name?"* is a cell
   * rather than a worry.
   */
  readonly grounds: {
    readonly dates: readonly string[];
    readonly usedProjectionNames: readonly string[];
  };
}

/**
 * THE CARD FOR AN ACTION, OR `null` FOR AN ACTION THIS SLICE CANNOT DRAW.
 *
 * `null` rather than a generic card, because a generic card is how a second
 * kind ships without anybody deciding it should. The seat's LOOP CHECK on this
 * slice is `kind-by-kind-behind-one-card`, and its compression rule is that a
 * second kind needing its own card VARIANT must be answered by generalising
 * this function rather than by branching it a third time. `null` is what makes
 * the addition of a kind a visible act.
 */
export function changeCardFor(args: {
  readonly action: ProgramControlAction;
  readonly week: VisibleWeek;
  /**
   * The ways this day may move, READ FROM THE OWNER (`moveOptionsForDay`, via
   * `listPlanChangeOptionsForDay`) by the caller and passed in whole.
   *
   * Passed rather than fetched because this module is L14-pure and the owner
   * needs the resolved week, which this one does not have and must not acquire:
   * a second read of the day here would be a second answer to "what can move
   * off it". One row means one way through and no chooser.
   */
  readonly moveScopes?: readonly { readonly id: string; readonly label: string; readonly sub: string }[];
}): CoachChangeCard | null {
  const { action, week } = args;
  if (action.type !== 'move_session') return null;

  const from = describeDate(week, action.payload.fromDate);
  const to = describeDate(week, action.payload.toDate);
  if (!from || !to) return null;

  const offered = args.moveScopes ?? [];
  const choices: CoachChangeCardChoice[] = offered.length > 1
    ? offered.map((scope) => ({
      id: scope.id,
      label: scope.label,
      sub: scope.sub,
      action: {
        ...action,
        payload: {
          ...action.payload,
          // `whole_day` is the door's meaning for an ABSENT scope, so the row
          // that means "all of it" sends nothing rather than sending the word.
          // Two spellings of one instruction is how the omitted-scope
          // assumption became invisible in the first place.
          ...(scope.id === 'whole_day' ? {} : { scope: scope.id as never }),
        },
      },
    }))
    : [];

  return {
    title: COACH_CHANGE_COPY.moveTitle,
    fields: [
      { label: COACH_CHANGE_COPY.fromLabel, value: from.text },
      { label: COACH_CHANGE_COPY.toLabel, value: to.text },
      { label: COACH_CHANGE_COPY.whyLabel, value: COACH_CHANGE_COPY.whyYouAsked },
    ],
    choices,
    confirmLabel: COACH_CHANGE_COPY.confirmLabel,
    cancelLabel: COACH_CHANGE_COPY.cancelLabel,
    grounds: {
      dates: [action.payload.fromDate, action.payload.toDate],
      usedProjectionNames: [...from.usedProjectionNames, ...to.usedProjectionNames],
    },
  };
}

function describeDate(week: VisibleWeek, dateISO: string) {
  const day = week.days.find((candidate) => candidate.date === dateISO);
  return day ? describeVisibleDay(day) : null;
}
