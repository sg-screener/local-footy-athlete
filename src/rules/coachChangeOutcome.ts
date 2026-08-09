/**
 * WHAT THE COACH SAYS AFTER THE DOOR RAN — AND IT IS ONLY ALLOWED TO SAY IT
 * BECAUSE THE WEEK MOVED.
 *
 * AGENTS.md, the fifth step of the coach pipeline: *"verify the visible program
 * state changed before claiming it did."* Slice 2 installed the instrument that
 * makes that a structural claim rather than a promise — every coach sentence
 * runs past `validateCoachCommunicationTruth` — and it ran with an ALWAYS-EMPTY
 * communication, because slice 2 applied nothing.
 *
 * **This module is that same gate with its input finally non-empty.** The
 * boundary said it out loud: *"it is also the piece that does not move at S3:
 * only the input changes."* Nothing about the wiring is different here. What is
 * different is where `appliedChanges` comes from, and the answer is the one
 * thing that cannot flatter the coach: the visible week the athlete was looking
 * at before, and the visible week they are looking at now.
 *
 * ## THE DOOR'S "ok" IS NOT THE EVIDENCE, AND THAT DISTINCTION IS THE WHOLE
 * ## REASON THE TRUTH GATE EXISTS
 *
 * `executeProgramControlActionDurably` returns `ok`, `changedProgram` and a
 * typed `outcome`, and every one of those is the DOOR's account of itself. The
 * incident that produced `verifiedCoachCommunication` was a layer believing
 * exactly such an account: the engine wrote a constraint, reported success, and
 * the card announced sessions that were not in the program. So the door's
 * result selects which SITUATION the athlete is in — refused, no-op, applied —
 * and the visible diff decides whether the coach is permitted to claim it.
 *
 * A door that reports `applied` over a week that did not visibly move produces
 * `appliedChanges: []` here, which arms `FORBIDDEN_WHEN_NO_APPLIED`, which
 * refuses *"I moved…"* and leaves the athlete with the honest sentence. That
 * case is not defensive decoration: it is what the door's own visible
 * verification exists to prevent, checked a second time by the layer that would
 * be doing the lying.
 *
 * ## THE REFUSAL IS THE DOOR'S SENTENCE, NOT THIS MODULE'S
 *
 * When the door refuses it carries a message — *"I couldn't safely make that
 * change, so the plan is untouched."* — and the coach speaks it verbatim. The
 * door owns why it refused; paraphrasing it here would be a second account of
 * one refusal, the same rule that makes `coachProposal` speak
 * `DayCapabilities.refusal` verbatim. This module's own refusal sentence is the
 * floor for a door that refuses without saying why.
 *
 * L14: pure. The door result is an ARGUMENT — this module executes nothing.
 */

import { COACH_ANSWER_COPY, COACH_CHANGE_COPY, COACH_OPENER_COPY } from './coachTabCopy';
import { describeVisibleDay } from './coachAnswer';
import { weekdayName } from '../utils/appDate';
import type { VisibleWeek } from './visibleProjection';
import type { ProgramControlAction } from '../types/programControlAction';
import {
  validateCoachCommunicationTruth,
  type AppliedChange,
  type VerifiedCoachCommunication,
} from '../utils/verifiedCoachCommunication';

export type CoachChangeVerdict =
  /** The week moved and the coach said so. */
  | 'applied'
  /** The door ran and nothing the athlete can see is different. */
  | 'no_change'
  /** The door refused. The plan is untouched. */
  | 'refused'
  /** The truth gate refused the coach's own sentence. */
  | 'gated';

export interface CoachChangeOutcome {
  readonly text: string;
  readonly verdict: CoachChangeVerdict;
  readonly appliedChanges: readonly AppliedChange[];
  readonly violations: readonly string[];
}

/** The half of the door's result this module is allowed to read. */
export interface CoachDoorResult {
  readonly ok: boolean;
  readonly outcome?: 'applied' | 'no_change' | 'refused';
  readonly message?: string;
}

/**
 * THE ATHLETE SAID NO.
 *
 * A function returning a constant, and it earns its existence: declining is the
 * one coach turn that has no rule input at all — no question, no door result,
 * nothing but a tap. Left as a constant the SCREEN reached for, it would be the
 * single place the surface chose a word, and "the screen authors no reply"
 * would become "the screen authors one reply", which is not a law anybody can
 * hold. Every sentence the coach says now comes out of `rules/`.
 */
export function coachChangeDeclined(): string {
  return COACH_CHANGE_COPY.changeCancelled;
}

/**
 * WHAT CHANGED ON THE GLASS, DERIVED FROM THE ONE PROJECTION.
 *
 * A date's entry exists only when the day the athlete READS is different — the
 * day's name and the list of what is on it, through `describeVisibleDay`, which
 * is the same account the answer and the card give. Anything that changed
 * underneath without changing that is, for the purposes of a sentence to the
 * athlete, not a change; and anything that changed it IS one, whatever the
 * store did.
 *
 * `kind: 'session_replaced'` for every entry, and it is the true one of the
 * seven available: on each of the two dates, what the day showed was replaced
 * by something else. The union has no `session_moved` member — **it was written
 * for a substitution incident and has never had one** — and adding a member to
 * a frozen salvage type to make one word nicer is a change to a module three
 * other consumers switch on. Recorded here rather than done.
 */
export function appliedChangesFromVisibleWeeks(args: {
  readonly before: VisibleWeek;
  readonly after: VisibleWeek;
  readonly dates: readonly string[];
}): readonly AppliedChange[] {
  const out: AppliedChange[] = [];
  for (const date of args.dates) {
    const before = args.before.days.find((day) => day.date === date);
    const after = args.after.days.find((day) => day.date === date);
    if (!before || !after) continue;
    const beforeText = describeVisibleDay(before).text;
    const afterText = describeVisibleDay(after).text;
    if (beforeText === afterText) continue;
    out.push({
      date,
      sessionName: afterText,
      kind: 'session_replaced',
      before: beforeText,
      after: afterText,
      visible: true,
    });
  }
  return out;
}

export function coachChangeOutcome(args: {
  readonly action: ProgramControlAction;
  readonly before: VisibleWeek;
  readonly after: VisibleWeek;
  readonly door: CoachDoorResult;
}): CoachChangeOutcome {
  const { action, door } = args;
  const dates = action.type === 'move_session'
    ? [action.payload.fromDate, action.payload.toDate]
    : [];

  const appliedChanges = appliedChangesFromVisibleWeeks({
    before: args.before,
    after: args.after,
    dates,
  });
  const communication = communicationFor(appliedChanges);

  // THE DOOR SELECTS THE SITUATION.
  if (!door.ok || door.outcome === 'refused') {
    return gate({
      text: door.message ?? COACH_CHANGE_COPY.changeRefused,
      verdict: 'refused',
      appliedChanges,
      communication,
    });
  }
  if (!communication.canSayProgramUpdated) {
    // Covers BOTH the door's own `no_change` and the case the truth gate was
    // built for — a door reporting success over a week that did not move. They
    // get one sentence because the athlete is in one situation: nothing they
    // can see is different.
    return gate({
      text: COACH_CHANGE_COPY.changeNoOp,
      verdict: 'no_change',
      appliedChanges,
      communication,
    });
  }

  return gate({
    text: movedSentence(action),
    verdict: 'applied',
    appliedChanges,
    communication,
  });
}

/**
 * THE CONFIRMATION, IN THE SAME TWO DAY NAMES THE CARD SHOWED.
 *
 * `weekdayName` on the action's own dates — not the card's text, not the
 * request's words. The card and this sentence are two renderings of one action
 * and both take their day names from the same function, so the day they
 * disagree is the day somebody gives one of them a different action.
 */
function movedSentence(action: ProgramControlAction): string {
  if (action.type !== 'move_session') return COACH_CHANGE_COPY.changeNoOp;
  return COACH_CHANGE_COPY.movedLead
    + COACH_ANSWER_COPY.wordJoin
    + weekdayName(action.payload.fromDate)
    + COACH_CHANGE_COPY.movedJoin
    + weekdayName(action.payload.toDate)
    + COACH_OPENER_COPY.fullStop;
}

/**
 * SLICE 3's COMMUNICATION, BUILT DIRECTLY RATHER THAN THROUGH
 * `buildVerifiedCommunication`.
 *
 * That builder's input is `VisibleDiffEntry[]`, a shape from the frozen
 * pipeline's own diffing layer. Constructing one would mean translating the
 * projection into a retired representation so a helper could translate it back
 * — a second representation of the week inside the coach's write path, which is
 * the count the architecture reassessment ruled against and the same reason
 * slice 2 declined to re-point `resolveCoachTargetFrame`.
 *
 * The object is the salvage layer's own TYPE either way, and
 * `canSayProgramUpdated` is computed by the same rule the builder uses: at
 * least one VISIBLE applied change.
 */
function communicationFor(
  appliedChanges: readonly AppliedChange[],
): VerifiedCoachCommunication {
  const visible = appliedChanges.some((change) => change.visible);
  return {
    appliedChanges: [...appliedChanges],
    activeGuidance: [],
    optionalAdvice: [],
    canSayProgramUpdated: visible,
    canSayProgramChanged: visible,
  };
}

/**
 * THE MOUTH GATE, SLICE 2's, UNCHANGED.
 *
 * A refused sentence is REPLACED, never repaired — repairing it would mean this
 * module deciding which half of a false claim to keep, and a coach that edits
 * its own false claims is the surface the truth gate was written about.
 */
function gate(draft: {
  readonly text: string;
  readonly verdict: CoachChangeVerdict;
  readonly appliedChanges: readonly AppliedChange[];
  readonly communication: VerifiedCoachCommunication;
}): CoachChangeOutcome {
  const result = validateCoachCommunicationTruth({
    communication: draft.communication,
    replyText: draft.text,
  });
  if (result.ok) {
    return {
      text: draft.text,
      verdict: draft.verdict,
      appliedChanges: draft.appliedChanges,
      violations: [],
    };
  }
  return {
    text: COACH_CHANGE_COPY.changeNoOp,
    verdict: 'gated',
    appliedChanges: draft.appliedChanges,
    violations: result.violations,
  };
}
