/**
 * THE COACH'S ANSWER — DERIVED FROM THE WEEK, AND GATED AT ITS MOUTH.
 *
 * Slice 2 of the coach rebuild (docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S2:
 * *"IT ANSWERS FROM THE BRAIN"*). This module is the whole of the answering,
 * and like the opener it is a pure function of the projection — no store, no
 * clock, no navigation, no React (L14).
 *
 * ## THE SHAPE IS SLICE 1's, ON PURPOSE
 *
 * `coachOpener` returns `{ text, grounds }` so that *"does every day the coach
 * names exist in the week it was given, under that day's own projected name?"*
 * is a cell rather than a worry. An answer is the same object with the same
 * duty, so it has the same shape. A second answer shape would be a second thing
 * to verify and a second thing to forget to verify.
 *
 * ## L-C1 IS ENFORCED IN TWO DIRECTIONS, NOT ASSERTED
 *
 * *"When a recorded rule answers, it answers from the rule; when NO rule
 * answers, it ASKS or says it doesn't know — it never invents policy."*
 *
 * 1. **UPWARD** — every word of an answer that names training comes from the
 *    projection: `visibleDayLeadHeadline(day)` for a day's name (the SAME call
 *    the week row and the opener make) and `part.headline` for a part. The only
 *    strings this module contributes are batch 31's separators and its two
 *    honest limits. There is no branch anywhere below that composes a training
 *    noun.
 * 2. **DOWNWARD** — `answerable()` returns a subject only when the week can
 *    answer it completely. `unknown` is not a failure path, it is the law's
 *    floor, and it produces the same honest sentence slice 1 shipped.
 *
 * ## THE TRUTH GATE IS THE SALVAGE LAYER, RE-POINTED VERBATIM
 *
 * `verifiedCoachCommunication` was built after the coach claimed a change it
 * had not made — *"Sub in: easy aerobic conditioning…"* against a program with
 * no such session. Its validator refuses any reply that claims a mutation while
 * `appliedChanges` is empty.
 *
 * **In slice 2 `appliedChanges` is ALWAYS empty**, because slice 2 applies
 * nothing. So every answer this module produces is run past that validator with
 * an empty communication, and a reply that ever said *"I adjusted your week"*
 * would be refused and replaced by the honest no-answer. That makes read-only a
 * structural claim about the coach's MOUTH, matching the import ban's
 * structural claim about the screen's CODE — and it is the frozen module used
 * unchanged, which is what "re-point, do not rewrite" was asking for.
 *
 * It is not a formality either: the gate is what will still be standing when
 * S3 arrives and `appliedChanges` stops being empty. The wiring is the same;
 * only the input changes.
 *
 * ## WHAT COULD NOT BE RE-POINTED, SAID HERE RATHER THAN OMITTED
 *
 * `resolveCoachTargetFrame` (`utils/coachTargetFrame.ts`) is the salvage target
 * resolver and it is NOT used, for two measured reasons. Its input is
 * `visibleWeek: ResolvedDay[]` — the legacy week shape — so feeding it would
 * mean building a SECOND representation of the week inside the coach's read
 * path, which is precisely the count the architecture reassessment ruled
 * against. And it imports `COACH_CONTEXT_TTL_MS` from a zustand store module,
 * so importing it drags a store into a read-only screen's module graph, where
 * the screen's own import ban would not see it. Slice 2's targeting is a DATE
 * looked up in the week it was handed (`coachQuestion.namedDate`), which is
 * what `decisionLedger.ts:9-11` says a decision may name anyway.
 */

import {
  COACH_ANSWER_COPY,
  COACH_OPENER_COPY,
  COACH_TAB_COPY,
} from './coachTabCopy';
import { coachOpener } from './coachOpener';
import { visibleDayLeadHeadline } from './visibleDayDetail';
import type { CoachQuestion } from './coachQuestion';
import { weekdayName } from '../utils/appDate';
import type { VisibleDay, VisibleWeek } from './visibleProjection';
import {
  validateCoachCommunicationTruth,
  type VerifiedCoachCommunication,
} from '../utils/verifiedCoachCommunication';

/**
 * THE RECEIPT. Every day the answer was entitled to use, and no others.
 *
 * `dates` is the assertable half: a gate walks it and requires each entry to be
 * a day in the week the answer was given. `usedProjectionNames` is the other
 * half — the exact strings taken out of the projection — so a cell can prove
 * the sentence was ASSEMBLED from them rather than merely accompanied by them.
 */
export interface CoachAnswerGrounds {
  readonly dates: readonly string[];
  readonly usedProjectionNames: readonly string[];
}

export type CoachAnswerVerdict =
  /** The week answered it. */
  | 'answered'
  /** A real question the projection cannot reach. The coach says its limit. */
  | 'out_of_view'
  /** No recorded rule answers. L-C1's floor. */
  | 'no_rule'
  /**
   * THE TRUTH GATE REFUSED THE REPLY. Should be unreachable in slice 2 — it is
   * here because "should be unreachable" is a claim, and a verdict is how the
   * claim gets measured instead of assumed.
   */
  | 'refused';

export interface CoachAnswer {
  readonly text: string;
  readonly verdict: CoachAnswerVerdict;
  readonly grounds: CoachAnswerGrounds;
  /** The violations the truth gate found. Empty on every non-`refused` answer. */
  readonly violations: readonly string[];
}

/**
 * SLICE 2 APPLIES NOTHING, AND THIS OBJECT IS THAT FACT IN THE SALVAGE LAYER'S
 * OWN VOCABULARY.
 *
 * Every field is the empty/false case, and `canSayProgramUpdated: false` is
 * what arms `FORBIDDEN_WHEN_NO_APPLIED` inside the validator. Built fresh per
 * answer rather than shared, so nothing downstream can accumulate into it.
 */
function nothingApplied(): VerifiedCoachCommunication {
  return {
    appliedChanges: [],
    activeGuidance: [],
    optionalAdvice: [],
    canSayProgramUpdated: false,
    canSayProgramChanged: false,
  };
}

const NO_GROUNDS: CoachAnswerGrounds = { dates: [], usedProjectionNames: [] };

/**
 * THE ANSWER.
 *
 * One switch over the subject, and each arm is three lines, because each arm's
 * whole job is to pick days out of the week and let the projection do the
 * naming. An arm that grew a paragraph would be an arm that started composing.
 */
export function coachAnswer(args: {
  readonly question: CoachQuestion;
  readonly week: VisibleWeek;
  readonly todayISO: string;
}): CoachAnswer {
  const draft = draftAnswer(args);
  return gate(draft);
}

function draftAnswer(args: {
  readonly question: CoachQuestion;
  readonly week: VisibleWeek;
  readonly todayISO: string;
}): CoachAnswer {
  const { question, week, todayISO } = args;

  switch (question.subject) {
    case 'day_work': {
      // THE DAY WAS NAMED AND THE COACH CANNOT SEE IT. Its own sentence,
      // because "I can only see this week" and "I don't have an answer for
      // that yet" are different admissions and the athlete deserves the true
      // one.
      if (question.outOfWeek || question.targetDateISO === null) {
        return honest(COACH_ANSWER_COPY.dayNotInWeek, 'out_of_view');
      }
      const day = week.days.find((candidate) => candidate.date === question.targetDateISO);
      if (!day) return honest(COACH_ANSWER_COPY.dayNotInWeek, 'out_of_view');
      return dayAnswer(day);
    }

    case 'next_game': {
      // THE FIRST FIXTURE FROM TODAY ONWARD, located in the projection and
      // never computed from a clock. Dates compare correctly as ISO strings.
      // Deliberately NOT the opener's fixture: the opener suppresses a game
      // that is today or tomorrow because its day clause already names it,
      // and an athlete asking "when's my next game" must be told even so.
      const fixture = week.days.find(
        (day) => day.kind === 'game' && day.date >= todayISO,
      );
      if (!fixture) return honest(COACH_ANSWER_COPY.noGameInWeek, 'answered');
      const text = COACH_OPENER_COPY.fixtureLead
        + COACH_ANSWER_COPY.wordJoin
        + weekdayName(fixture.date)
        + COACH_OPENER_COPY.fullStop;
      return {
        text,
        verdict: 'answered',
        grounds: { dates: [fixture.date], usedProjectionNames: [] },
        violations: [],
      };
    }

    case 'week_shape': {
      // THE COACH ALREADY HAS A SENTENCE FOR THIS AND IT IS THE ONE IT OPENED
      // WITH. Producing a second week summary here would be two accounts of one
      // week — the exact defect ruling 1 retired `summariseDay` to kill, one
      // slice later and inside the same screen.
      const opener = coachOpener({ week, todayISO });
      const dates = [opener.grounds.nextFixture, opener.grounds.today, opener.grounds.tomorrow]
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .map((entry) => entry.date);
      const names = [opener.grounds.today, opener.grounds.tomorrow]
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .map((entry) => entry.name);
      return {
        text: opener.text,
        verdict: 'answered',
        grounds: { dates, usedProjectionNames: names },
        violations: [],
      };
    }

    case 'unknown':
    default:
      return honest(COACH_TAB_COPY.noAnswerYet, 'no_rule');
  }
}

/**
 * ONE DAY, IN THE PROJECTION'S OWN WORDS.
 *
 * The rule has no branch on day KIND. A day is answered by what it HAS: its
 * parts if it has any, and otherwise its lead headline — which is already
 * "Rest Day" for a rest day and "Game Day" for a fixture, because that is what
 * the projection named it. A `kind === 'rest'` branch here would be this module
 * deciding what a rest day is called, and the projection has already decided.
 */
function dayAnswer(day: VisibleDay): CoachAnswer {
  const described = describeVisibleDay(day);
  return {
    text: described.text + COACH_OPENER_COPY.fullStop,
    verdict: 'answered',
    grounds: { dates: [day.date], usedProjectionNames: described.usedProjectionNames },
    violations: [],
  };
}

/**
 * ONE DAY, NAMED AND ENUMERATED — THE COACH'S ONLY ACCOUNT OF A DAY.
 *
 * EXPORTED FOR SLICE 3, and the export is the point. The change card has to say
 * what is on the day a session is leaving and what is on the day it is landing
 * on. Composing that inside the card would be a SECOND account of a day inside
 * the same screen — ruling 1's `summariseDay` defect, one slice later, exactly
 * as *"what's on this week"* would have been had it not returned the opener's
 * own sentence.
 *
 * So the card calls this. The day the card and the answer disagree about what
 * Friday holds is the day somebody deletes this function, not the day somebody
 * writes a second one.
 *
 * No trailing full stop: an answer is a sentence and a card line is a line.
 * The caller adds the punctuation its own surface needs, and that is the only
 * thing either of them chooses.
 */
export function describeVisibleDay(day: VisibleDay): {
  readonly text: string;
  readonly usedProjectionNames: readonly string[];
} {
  const items: string[] = day.parts.length > 0
    ? day.parts.map((part) => String(part.headline))
    : [String(visibleDayLeadHeadline(day))];

  return {
    text: weekdayName(day.date)
      + COACH_ANSWER_COPY.dayLabelJoin
      + items.join(COACH_ANSWER_COPY.itemJoin),
    usedProjectionNames: items,
  };
}

function honest(text: string, verdict: CoachAnswerVerdict): CoachAnswer {
  return { text, verdict, grounds: NO_GROUNDS, violations: [] };
}

/**
 * THE MOUTH GATE — the last thing between a derived sentence and the athlete.
 *
 * A refused answer does not get repaired, softened or explained; it is replaced
 * wholesale by the honest no-answer. Repairing it would mean this module
 * deciding which part of a false claim to keep, and a coach that edits its own
 * false claims is the surface the truth gate was written about.
 */
function gate(answer: CoachAnswer): CoachAnswer {
  const result = validateCoachCommunicationTruth({
    communication: nothingApplied(),
    replyText: answer.text,
  });
  if (result.ok) return answer;
  return {
    text: COACH_TAB_COPY.noAnswerYet,
    verdict: 'refused',
    grounds: NO_GROUNDS,
    violations: result.violations,
  };
}
