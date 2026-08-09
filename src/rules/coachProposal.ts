/**
 * THE COACH'S PROPOSAL — A DOOR ACTION, OR AN HONEST REASON THERE ISN'T ONE.
 *
 * docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md §0, ruled: *"the coach's
 * output becomes a ProgramControlAction; the athlete's own door executes it; the
 * ledger records the door's vocabulary verbatim. No coach writer, no coach
 * adapter, no ninth representation. Undo/replay/durability arrive free through
 * the door."*
 *
 * This module is that sentence as a function. Its OUTPUT is the door's own type
 * and nothing else — there is no coach command, no coach event, no intermediate
 * shape, and nothing here writes anything. It is a pure function from a typed
 * request and the visible week to either an action or a sentence.
 *
 * ## THE ORDER OF THE CHECKS IS THE DESIGN, NOT HOUSEKEEPING
 *
 * The source day's CAPABILITY is checked before the destination is asked for.
 * That ordering is what makes *"why can't I move Saturday?"* answer correctly:
 * the message names one day and no destination, and asking *"which day do you
 * want to move it to?"* would be the coach ignoring the actual question. Asking
 * the capability first means the athlete gets the refusal they asked for.
 *
 * The seat's order called that the *"cheap refusal rung"* and made it
 * conditional — *"rides S3 only if it costs a day nothing."* It costs nothing:
 * the proposal has to consult `capabilities` anyway, because L-C1 forbids the
 * coach proposing what the door would refuse without showing the refusal
 * honestly. The rung fell out of the check that was already required.
 *
 * ## THE REFUSAL IS THE PROJECTION'S OWN SENTENCE WHERE IT HAS ONE
 *
 * `DayCapabilities.refusal` is a `SignedCopy` — a recorded rule, already signed,
 * already the words the day's own menu shows. The coach speaks it verbatim. A
 * paraphrase here would be a second account of one refusal, and the athlete
 * would get different words from the coach than from the day they are looking
 * at. Only where the projection carries NO refusal does this module supply one,
 * and what it supplies says what the coach cannot do rather than why — the why
 * would be coaching policy, and L-C1 forbids inventing it.
 *
 * L14: pure. Every import is `import type` except the copy module and the day
 * describer, neither of which touches a store, a clock or React.
 */

import { COACH_ANSWER_COPY, COACH_CHANGE_COPY, COACH_OPENER_COPY } from './coachTabCopy';
import { changeCardFor, type CoachChangeCard } from './coachChangeCard';
import { weekdayName } from '../utils/appDate';
import type { CoachChangeRequest } from './coachRead';
import type { VisibleDay, VisibleWeek } from './visibleProjection';
import type { ProgramControlAction } from '../types/programControlAction';

/**
 * WHY THE COACH IS NOT PROPOSING A CHANGE, TYPED.
 *
 * A verdict rather than only a sentence, because the screen shows an ASK and a
 * REFUSAL differently — an ask leaves the conversation open, a refusal closes
 * it — and a surface deciding which is which by reading the words would be the
 * surface parsing prose the coach wrote.
 */
/**
 * THE ACTION TYPES THE COACH MAY PROPOSE — S3's ALLOW-LIST.
 *
 * The seat's order: *"Allow-listed kinds first — start from the doors that
 * already reach the ledger."* `move_session` qualifies for a reason worth
 * writing down, because it is NOT the reason the exercise door qualifies:
 *
 *   - the exercise types are in `rules/programControlDecisions`'
 *     `LEDGER_RECORDED_ACTION_TYPES`, appended by the door itself;
 *   - `move_session` is deliberately ABSENT from that list, and appends its own
 *     `{ kind: 'plan_change' }` decision inside `applyPlanChange`
 *     (`planChangeProducer.ts:2392-2401`) — *"a decision that LANDED is appended
 *     to the ledger, verbatim and typed, in the same act."* Listing it in both
 *     places would append two decisions for one act and cost the athlete two
 *     taps to undo one move.
 *
 * So *"the coach only proposes what the door records"* is true of this list by
 * two different mechanisms, and `coachTabSlice3Tests` [6] pins both rather than
 * pinning the one that happens to apply to the first kind.
 */
export const COACH_PROPOSABLE_ACTION_TYPES = ['move_session'] as const;

export type CoachProposalVerdict =
  /** A door action is ready and the card can render. */
  | 'proposed'
  /** A required field is missing. The coach asks for it. */
  | 'asked'
  /** The change cannot be made, and the coach says so. */
  | 'refused';

export interface CoachProposal {
  readonly verdict: CoachProposalVerdict;
  /** Present only on `proposed`. The door's vocabulary, nothing else. */
  readonly action: ProgramControlAction | null;
  /**
   * Present exactly when `action` is — and that pairing is the point.
   *
   * The card is built HERE rather than by the caller so that "a proposed action
   * without a card" is unrepresentable. L-C2 says there is no coach mutation
   * without the card; a caller that had to remember to ask for one would be a
   * caller that could forget, and forgetting would execute. The card is still
   * built from the ACTION alone (`changeCardFor` sees no request and no
   * message) — this module only puts the two in the same envelope.
   */
  readonly card: CoachChangeCard | null;
  /** Present on `asked` and `refused`. Empty on `proposed` — the card speaks. */
  readonly text: string;
  /** Every date this proposal was entitled to use. Slice 1's grounds pattern. */
  readonly dates: readonly string[];
}

/**
 * THE SOURCE OF A COACH-AUTHORED ACTION.
 *
 * `initiatedBy: 'tap'` and not `'system'`, and that is deliberate: the athlete
 * taps Confirm on the card, and the door is entered by a tap in the only sense
 * the field means — a human decided, at the moment it happened. A coach that
 * stamped `'system'` would be claiming autonomy the change card exists to deny
 * it.
 */
const COACH_TAB_SOURCE = {
  screen: 'coach_tab',
  surface: 'coach_change_card',
  initiatedBy: 'tap',
} as const;

export function coachProposal(args: {
  readonly request: CoachChangeRequest;
  readonly week: VisibleWeek;
}): CoachProposal {
  const { request, week } = args;

  // ── 1. WHAT MOVES ────────────────────────────────────────────────────────
  if (request.from === null) return ask(COACH_CHANGE_COPY.askWhichDay);
  if (request.from.dateISO === null) return refuse(COACH_ANSWER_COPY.dayNotInWeek);
  const from = dayIn(week, request.from.dateISO);
  if (!from) return refuse(COACH_ANSWER_COPY.dayNotInWeek);

  // ── 2. CAN IT? — BEFORE ASKING WHERE TO, AND THAT IS THE REFUSAL RUNG ────
  if (!from.capabilities.canMoveWholeDay) {
    return refuse(
      from.capabilities.refusal !== null
        ? String(from.capabilities.refusal)
        : COACH_CHANGE_COPY.cannotMoveLead
          + COACH_ANSWER_COPY.wordJoin
          + weekdayName(from.date)
          + COACH_OPENER_COPY.fullStop,
      [from.date],
    );
  }

  // ── 3. WHERE TO ──────────────────────────────────────────────────────────
  if (request.to === null) return ask(COACH_CHANGE_COPY.askWhereTo, [from.date]);
  if (request.to.dateISO === null) return refuse(COACH_ANSWER_COPY.dayNotInWeek, [from.date]);
  const to = dayIn(week, request.to.dateISO);
  if (!to) return refuse(COACH_ANSWER_COPY.dayNotInWeek, [from.date]);
  if (to.date === from.date) return refuse(COACH_CHANGE_COPY.alreadyThere, [from.date]);

  // ── 4. THE DOOR'S OWN VOCABULARY, AND NOTHING OF THIS MODULE'S ───────────
  //
  // NO `payload.scope`. That field is the COMPONENT the athlete picked ("just
  // the gym session") and the athlete picked nothing — they named two days. An
  // omitted scope is the door's whole-day move, which is what was asked for;
  // inventing a component here would be the coach choosing on their behalf.
  //
  // `requiresRebuild: false` and `oneOffOnly: true` match what the Program
  // tab's own sheet sends for this kind (`programControlActionForPlanChange`),
  // because this IS that door and a second set of flags would be a second
  // opinion about one action.
  const action: ProgramControlAction = {
    type: 'move_session',
    source: COACH_TAB_SOURCE,
    scope: 'today_only',
    payload: { fromDate: from.date, toDate: to.date },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  };

  // AN ACTION THIS SLICE CANNOT DRAW IS AN ACTION IT DOES NOT PROPOSE.
  // `changeCardFor` returns null for a kind it has no card for, and L-C2 makes
  // the card the precondition of the change rather than its illustration.
  const card = changeCardFor({ action, week });
  if (!card) return refuse(COACH_CHANGE_COPY.changeRefused, [from.date, to.date]);

  return { verdict: 'proposed', action, card, text: '', dates: [from.date, to.date] };
}

function dayIn(week: VisibleWeek, dateISO: string): VisibleDay | null {
  return week.days.find((day) => day.date === dateISO) ?? null;
}

function ask(text: string, dates: readonly string[] = []): CoachProposal {
  return { verdict: 'asked', action: null, card: null, text, dates };
}

function refuse(text: string, dates: readonly string[] = []): CoachProposal {
  return { verdict: 'refused', action: null, card: null, text, dates };
}
