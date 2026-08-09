/**
 * WHAT THE ATHLETE ASKED, AS A TYPE — SLICE 2's READING LAYER.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S2: *"Read-only Q&A grounded in the
 * program, the week, and recorded rules per L-C1. The salvage layer (intent,
 * target resolution, clarifiers, truth gate) is re-pointed here, not
 * rewritten."*
 *
 * ## THE VOCABULARY IS THE SALVAGE LAYER'S, AND THE COMPILER PROVES IT
 *
 * `CoachAnswerableKind` is an `Extract<>` over `CoachIntentKind` — the frozen
 * pipeline's own intent union. Not a copy of three strings, not a parallel
 * enum: a NARROWING, so the day somebody renames or deletes
 * `program_explanation` upstream, this file stops compiling instead of quietly
 * owning a second vocabulary. That is what "re-pointed, not rewritten" has to
 * mean in a type system, and it costs nothing at runtime because
 * `import type` is erased — no frozen module enters the graph.
 *
 * ## THE TARGET IS A DATE, BY THE LEDGER'S OWN LAW
 *
 * `decisionLedger.ts:9-11`: decisions name DATE + SLOT and never derived session
 * ids, *"a derived id can drift across engine versions, a date cannot"*. A
 * question about a day resolves to the day's ISO date in the week the coach was
 * handed, and to nothing else. There is no session id, no item id and no
 * `targetItemId` anywhere in this module — those are S3's problem and, per the
 * ledger's law, they are not the shape S3 should reach for either.
 *
 * ## WHAT IT WILL NOT DO, AND THE DIRECTION IS THE SAFETY
 *
 * The reader recognises questions POSITIVELY. It has no notion of "is this a
 * mutation request" — it does not need one, because anything it fails to place
 * as an answerable question becomes `unknown`, and `unknown` is answered by the
 * coach saying it does not know. "Move Friday's session to Sunday" is not
 * recognised, so it is not answered. A negative test (*is this a mutation?*)
 * would have to be exhaustive to be safe; a positive one is safe by being
 * incomplete, which is the direction a read-only slice should fail in.
 *
 * ## THIS IMPLEMENTATION IS THE SEAM'S FIRST, NOT THE SEAM'S CONTRACT
 *
 * `CoachQuestionReader` is the interface; `lexicalQuestionReader` is a LEXICAL
 * implementation of it. The salvage layer's own architecture is the same shape
 * — `CoachIntentClassifier` (`utils/coachIntent.ts:443`) with an LLM-backed
 * implementation behind it — and this is that seam re-pointed at data the
 * rebuild actually has. Stated plainly because AGENTS.md is right that phrase
 * matching is not an intelligence layer: what makes this legitimate is that the
 * OUTPUT is typed and the answer is DERIVED from the projection, so a better
 * reader replaces this one without a single answer changing.
 *
 * L14: pure. No React, no store, no navigation, no clock — `todayISO` is an
 * argument, as it is for the opener.
 */

import type { CoachIntentKind } from '../utils/coachIntent';
import { WEEKDAY_NAMES } from '../utils/appDate';
import type { VisibleWeek } from './visibleProjection';

/**
 * THE KINDS SLICE 2 MAY ANSWER — a subset of the salvage intent union.
 *
 * `Extract` rather than a literal union: if one of these three names leaves
 * `CoachIntentKind`, this line is a type error rather than a divergence.
 *
 * - `program_explanation` — "what am I doing Friday", "what's on this week".
 * - `session_mismatch_question` — reserved by the same narrowing; slice 2 does
 *   not yet produce it, and it is listed so the subset is the salvage layer's
 *   READ-ONLY family rather than an arbitrary three.
 * - `general_question` — the honest floor: a question with no rule behind it.
 */
export type CoachAnswerableKind = Extract<
  CoachIntentKind,
  'program_explanation' | 'session_mismatch_question' | 'general_question'
>;

/**
 * WHAT THE QUESTION IS ABOUT.
 *
 * Deliberately coarse. Each subject is a thing the VISIBLE WEEK can answer
 * completely, which is the test for whether a subject belongs here at all: if
 * answering it would need a fact the projection does not carry, the coach does
 * not have a rule for it and the honest answer is `unknown`.
 */
export type CoachQuestionSubject =
  /** "What am I doing Friday / today / tomorrow?" — one day's work. */
  | 'day_work'
  /** "When's my next game?" — the fixture in the week. */
  | 'next_game'
  /** "What's on this week?" — the week's shape. */
  | 'week_shape'
  /**
   * "WHY IS FRIDAY HEAVY?" — a request for a REASON, and the week holds none.
   *
   * ADDED 2026-08-10 AFTER SAM'S DEVICE, AND IT IS A DEFECT FIX RATHER THAN A
   * FEATURE. Both the slice-2 boundary and NOW.md told Sam that *"why is Friday
   * heavy?"* was refused. **It was not.** The message carries a day marker, the
   * day beat the week by the specificity rule, and the coach answered
   * *"Friday: Lower Squat."* — the athlete asks WHY and is told WHAT, with no
   * sign that the question was missed. That is worse than a refusal, and it is
   * the failure L-C1 exists to prevent: confidently answering a question nobody
   * asked.
   *
   * It is a SUBJECT and not a filter because the reader recognises positively:
   * a reason question is a real, well-formed question about a thing the visible
   * week cannot answer, so it is placed and then answered honestly. **The
   * Bible-grounded "why" layer fills this arm; until it does, this is a seam
   * rather than a hole.**
   */
  | 'reason'
  /** No recorded rule answers this. L-C1's floor. */
  | 'unknown';

export interface CoachQuestion {
  readonly kind: CoachAnswerableKind;
  readonly subject: CoachQuestionSubject;
  /**
   * The day the question is about, as an ISO date in the week the reader was
   * given — never a session id (the ledger's targeting law).
   *
   * `null` means the question named no day OR named one the coach cannot see;
   * the two are distinguished by `outOfWeek`, because "you didn't say which
   * day" and "that day is not in your week" are different answers.
   */
  readonly targetDateISO: string | null;
  /** True when a day WAS named and it is not in the week the coach can see. */
  readonly outOfWeek: boolean;
}

export interface ReadCoachQuestionInput {
  readonly message: string;
  readonly week: VisibleWeek;
  readonly todayISO: string;
}

/**
 * THE SEAM. One method, data in, a typed question out, no side effects.
 *
 * The LLM-backed reader implements this same interface when it arrives; nothing
 * downstream of it changes, because everything downstream consumes
 * `CoachQuestion` and the projection.
 */
export interface CoachQuestionReader {
  read(input: ReadCoachQuestionInput): CoachQuestion;
}

const UNKNOWN: CoachQuestion = {
  kind: 'general_question',
  subject: 'unknown',
  targetDateISO: null,
  outOfWeek: false,
};

/**
 * IS THIS A QUESTION AT ALL?
 *
 * A question mark, or an opening interrogative. Both, because athletes drop the
 * mark constantly and "whats on friday" is unmistakably a question — and
 * because requiring the mark would make punctuation the difference between an
 * answer and a shrug.
 */
const INTERROGATIVE = /^\s*(what|whats|what's|when|whens|when's|which|why|do|does|am|is|are|have|how)\b/i;

/**
 * A REQUEST FOR A REASON.
 *
 * `why` and `how come`, word-bounded. It is tested BEFORE the subject table and
 * outranks every entry in it, because a reason question that also names a day
 * is still a reason question — which is exactly the two-marker shape the
 * slice-2 boundary said an ordered table cannot see, and exactly how this
 * defect reached Sam's phone.
 */
const REASON_MARKER = /\b(?:why|how\s+come)\b/i;

/**
 * SUBJECT MARKERS — a table, so the subjects are a list somebody can read and
 * count rather than a chain of conditions somebody has to trace.
 *
 * Order matters and is the specific-before-general rule: "when is my next game"
 * mentions no day but does mention a fixture, and "what am I doing on game day"
 * must not be read as a fixture question. `next_game` is therefore tested
 * against a phrase that names the fixture as the SUBJECT, not merely mentions
 * it.
 */
const SUBJECT_MARKERS: ReadonlyArray<{
  readonly subject: Exclude<CoachQuestionSubject, 'unknown'>;
  readonly marker: RegExp;
}> = [
  {
    subject: 'next_game',
    marker: /\b(?:next\s+(?:game|match|fixture)|when\s+(?:is|are|s)?\s*(?:my|the)?\s*(?:next\s+)?(?:game|match|fixture))\b/i,
  },
  {
    subject: 'week_shape',
    marker: /\b(?:this\s+week|the\s+week|my\s+week|week\s+look|on\s+this\s+week)\b/i,
  },
  {
    subject: 'day_work',
    marker: /\b(?:doing|training|on|session|workout|scheduled|got)\b/i,
  },
];

/** Weekday word → its index in `WEEKDAY_NAMES`, built from the one table. */
const WEEKDAY_INDEX: ReadonlyMap<string, number> = new Map(
  WEEKDAY_NAMES.flatMap((name, index) => [
    [name.toLowerCase(), index] as const,
    [name.slice(0, 3).toLowerCase(), index] as const,
  ]),
);

/**
 * ONE NAMED DAY.
 *
 * `null` dateISO with `named: true` is a day the athlete named that the coach
 * cannot see — the distinction the answering layer turns into *"I can only see
 * this week."* rather than *"I don't know."*
 */
export interface NamedDay {
  readonly dateISO: string | null;
  /** Where in the message the day was named. The ordering key — see below. */
  readonly at: number;
}

/**
 * EVERY DAY THE MESSAGE NAMED, IN THE ORDER THE ATHLETE SAID THEM.
 *
 * "Friday" does not become a date by arithmetic; it becomes a date by finding
 * the day IN THE WEEK THE COACH WAS GIVEN whose weekday matches. So the coach
 * can only ever name a day it can see, by construction, and the whole class of
 * "the coach answered about a day outside your week" is unreachable rather than
 * tested for. `today` and `tomorrow` resolve through the same lookup.
 *
 * ── ORDERED BY POSITION IN THE MESSAGE, AND THAT IS A FIX ──────────────────
 *
 * This used to walk `WEEKDAY_INDEX` and return the first weekday whose word
 * appeared anywhere — so the day the coach picked was decided by the order of
 * `WEEKDAY_NAMES` (Sunday first), not by the order of the sentence. *"Move
 * friday to sunday"* resolved SUNDAY as the day being asked about, and *"am I
 * training friday or monday?"* answered about Monday.
 *
 * It is the slice-2 precedence defect a third time — **an ordered table
 * answering a question about specificity** — and slice 3 is what forced it out,
 * because a move needs TWO days and their ORDER is the whole difference between
 * "from" and "to". The rule is now the athlete's word order, which is the only
 * ordering that is about the message rather than about this file.
 */
export function namedDaysInMessageOrder(
  message: string,
  week: VisibleWeek,
  todayISO: string,
): readonly NamedDay[] {
  const lower = message.toLowerCase();
  const found: NamedDay[] = [];

  const relative: ReadonlyArray<readonly [RegExp, string]> = [
    [/\btoday\b/, todayISO],
    [/\btomorrow\b/, nextDayISO(todayISO)],
  ];
  for (const [pattern, dateISO] of relative) {
    const at = lower.search(pattern);
    if (at >= 0) found.push({ dateISO: dateInWeek(week, dateISO), at });
  }

  for (const [word, index] of WEEKDAY_INDEX) {
    const at = lower.search(new RegExp(`\\b${word}\\b`));
    if (at < 0) continue;
    found.push({ dateISO: match(week, index), at });
  }

  // NOT DEDUPED BY DATE, AND THE FIRST VERSION OF THIS FUNCTION WAS.
  //
  // Collapsing two markers that resolve to one date looks like tidying and is a
  // behaviour change: *"move today to monday"* on a Monday names the same day
  // twice, and that is a REQUEST WITH A SOURCE AND A DESTINATION — the coach
  // has to be able to see both to say *"it's already on that day."* Deduping
  // left it holding one day and asking where to, which is the coach failing to
  // notice what the athlete said. Two markers are two slots; whether they point
  // at the same day is the proposal's question, not this function's.

  return found.sort((a, b) => a.at - b.at);
}

function match(week: VisibleWeek, weekdayIndex: number): string | null {
  return week.days.find((day) => jsWeekday(day.date) === weekdayIndex)?.date ?? null;
}

/**
 * The one day a QUESTION is about: the first the athlete named.
 *
 * A question carries one subject, so the first named day is it. A REQUEST can
 * carry two (from and to) and reads the ordered list above directly.
 */
function namedDate(
  message: string,
  week: VisibleWeek,
  todayISO: string,
): { readonly dateISO: string | null; readonly named: boolean } {
  const days = namedDaysInMessageOrder(message, week, todayISO);
  if (days.length === 0) return { dateISO: null, named: false };
  return { dateISO: days[0].dateISO, named: true };
}

function dateInWeek(week: VisibleWeek, dateISO: string): string | null {
  return week.days.some((day) => day.date === dateISO) ? dateISO : null;
}

/**
 * THE LEXICAL READER — the seam's first implementation.
 *
 * Three steps, in this order, and the order is the safety: it must look like a
 * question, it must be about something the week can answer, and only then does
 * it get a day. A message that fails any step is `unknown`, which the answering
 * layer turns into the coach saying it does not know.
 */
export const lexicalQuestionReader: CoachQuestionReader = {
  read({ message, week, todayISO }: ReadCoachQuestionInput): CoachQuestion {
    const text = (message ?? '').trim();
    if (text.length === 0) return UNKNOWN;
    if (!text.includes('?') && !INTERROGATIVE.test(text)) return UNKNOWN;

    const day = namedDate(text, week, todayISO);

    const marked = SUBJECT_MARKERS.find(({ marker }) => marker.test(text))?.subject;

    // ── PRECEDENCE, AND IT IS A NAMED DAY BEATING A NAMED WEEK ────────────────
    //
    // FOUND BY PROBING RATHER THAN BY A CELL, which is the honest provenance:
    // "what am I doing on friday this week?" carries BOTH markers, the table is
    // searched in order, and week_shape sits above day_work — so the coach
    // answered with the week's shape and never mentioned Friday. Nothing was
    // red; the cell set simply had no message carrying two markers.
    //
    // The rule is specificity, not table order: a NAMED DAY is a narrower
    // question than a week, so it wins. `next_game` stays above both because
    // "is my next game on saturday?" names a day and is still a fixture
    // question. A named day is also a subject in its own right — "what about
    // Friday?" carries no verb this table knows and is unmistakably about
    // Friday's work.
    //
    // AND A REASON OUTRANKS ALL THREE, which is the same rule one step further
    // out: *"why is friday heavy?"* names a day AND asks for a reason, and the
    // day won. The athlete got Friday's session list. A reason is the narrowest
    // thing a message can be about — it is about the WHY of whatever else it
    // names — so it wins over anything it co-occurs with.
    const subject: CoachQuestionSubject = REASON_MARKER.test(text)
      ? 'reason'
      : marked === 'next_game'
        ? 'next_game'
        : day.named
          ? 'day_work'
          : marked ?? 'unknown';
    if (subject === 'unknown') return UNKNOWN;

    // A DAY QUESTION WITH NO DAY IN IT IS NOT A DAY QUESTION. "What am I
    // doing?" without a day is a question the coach cannot target, and
    // guessing "today" would be the coach answering a question nobody asked.
    if (subject === 'day_work' && !day.named) return UNKNOWN;

    return {
      kind: 'program_explanation',
      subject,
      targetDateISO: subject === 'day_work' ? day.dateISO : null,
      outOfWeek: subject === 'day_work' && day.named && day.dateISO === null,
    };
  },
};

/**
 * The JS weekday index (0 = Sunday) of an ISO date, by UTC arithmetic on a
 * date with no time in it. The same choice `coachOpener.nextDayISO` makes and
 * for the same reason: this module claims purity, and `new Date(iso)` with a
 * local timezone is where that claim would quietly become false.
 */
function jsWeekday(dateISO: string): number {
  const [year, month, day] = isoParts(dateISO);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function nextDayISO(dateISO: string): string {
  const [year, month, day] = isoParts(dateISO);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function isoParts(dateISO: string): readonly [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.slice(0, 10));
  if (!match) throw new Error(`Invalid ISO date: ${dateISO}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
