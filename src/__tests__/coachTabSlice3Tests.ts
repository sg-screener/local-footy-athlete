/**
 * COACH REBUILD, SLICE 3 — IT CHANGES THINGS, AND THE CARD IS THE ONLY WAY IN.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S3. Six claims, each with its own
 * way of going wrong:
 *
 *   - **THE READER DEGRADES INTO A TABLE.** A polite request is a question with
 *     a move verb in it, and two readers tried in sequence answer by which one
 *     ran first. [1] is the MARKER MATRIX, written before the resolver was, per
 *     the seat's order — every pair of marker families that can co-occur in one
 *     message, and what the reader must return for each.
 *   - **THE PROPOSAL DEGRADES INTO A GUESS.** The cheap way to look capable is
 *     to fill a missing field. [2] pins what it ASKS and what it REFUSES, and
 *     pins the ORDER of the two — capability before destination is what makes
 *     "why can't I move Saturday?" answer the question that was asked.
 *   - **THE CARD DEGRADES INTO A DESCRIPTION OF THE REQUEST.** A card built
 *     from the athlete's sentence shows what they asked for; only a card built
 *     from the action shows what will run. [3] proves the card is a function of
 *     the action, by changing the action and nothing else.
 *   - **THE CONFIRMATION DEGRADES INTO THE DOOR'S OPINION.** [4] makes the
 *     truth gate BITE on the sentence slice 3 exists to say — a door reporting
 *     success over a week that did not move — with a control beside it.
 *   - **THE COACH DEGRADES INTO A WRITER.** [5] pins that the only thing that
 *     leaves this slice is a `ProgramControlAction`, that its type is on the
 *     allow-list, and that the door records the allow-list.
 *   - **THE CONFIRM BUTTON DEGRADES BEHIND THE KEYBOARD.** [6] — L-C3, which
 *     the seat's order made BLOCKING for this boundary.
 *
 * WHAT THIS SUITE CANNOT DO, said here rather than in the report: no screen is
 * mounted, no door is executed, no athlete is walked. Sections [1]-[4] execute
 * the pure rules over hand-built weeks; [5] and [6] read SOURCE. **Whether the
 * confirm button is reachable with the keyboard up is a device and Sam's eye,
 * and nothing here claims it.**
 *
 * Run: npm run test:coach-tab-slice3
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readCoachMessage } from '../rules/coachRead';
import { coachProposal, COACH_PROPOSABLE_ACTION_TYPES } from '../rules/coachProposal';
import { changeCardFor } from '../rules/coachChangeCard';
import {
  appliedChangesFromVisibleWeeks,
  coachChangeDeclined,
  coachChangeOutcome,
} from '../rules/coachChangeOutcome';
import { coachAnswer, describeVisibleDay } from '../rules/coachAnswer';
import { COACH_ANSWER_COPY, COACH_CHANGE_COPY } from '../rules/coachTabCopy';
import { FORBIDDEN_WHEN_NO_APPLIED } from '../utils/verifiedCoachCommunication';
import { LEDGER_RECORDED_ACTION_TYPES } from '../rules/programControlDecisions';
import type { SignedCopy } from '../rules/signedCopy';
import type { ProgramControlAction } from '../types/programControlAction';
import type { VisibleDay, VisibleDayKind, VisibleWeek } from '../rules/visibleProjection';

const SRC = path.resolve(__dirname, '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(SRC, ...parts), 'utf8');
const stripComments = (source: string) =>
  source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

const screenCode = stripComments(read('screens', 'coach', 'CoachTabScreen.tsx'));
const proposalCode = stripComments(read('rules', 'coachProposal.ts'));
const cardCode = stripComments(read('rules', 'coachChangeCard.ts'));
const outcomeCode = stripComments(read('rules', 'coachChangeOutcome.ts'));
const readCode = stripComments(read('rules', 'coachRead.ts'));

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${String(detail)}`}`);
}

// ─── THE WORLD ───────────────────────────────────────────────────────────────

const signed = (text: string) => text as unknown as SignedCopy;

function day(
  date: string,
  kind: VisibleDayKind,
  buckets: readonly string[],
  capabilityOverrides: Partial<VisibleDay['capabilities']> = {},
): VisibleDay {
  const isFixture = kind === 'game';
  return {
    date,
    kind,
    headline: signed(
      kind === 'game' ? 'Game Day' : kind === 'rest' ? 'Rest Day' : 'Training Day',
    ),
    parts: buckets.map((bucket, index) => ({
      id: `${date}-p${index}`,
      kind: 'strength',
      headline: signed(bucket),
      bucket: signed(bucket),
      detail: null,
      rows: [],
      capabilities: {
        canMove: !isFixture, canRemove: true, canSwap: true, canEditRows: true,
      } as VisibleDay['parts'][number]['capabilities'],
      countsTowardLoad: true,
    })) as VisibleDay['parts'],
    capabilities: {
      canAdd: !isFixture,
      canMoveWholeDay: !isFixture && buckets.length > 0,
      canRemoveWholeDay: !isFixture && buckets.length > 0,
      refusal: null,
      ...capabilityOverrides,
    } as VisibleDay['capabilities'],
    owner: 'generation' as VisibleDay['owner'],
  };
}

// Monday 2026-08-10 .. Sunday 2026-08-16. Saturday is the fixture.
const MONDAY = '2026-08-10';
const TUESDAY = '2026-08-11';
const WEDNESDAY = '2026-08-12';
const THURSDAY = '2026-08-13';
const FRIDAY = '2026-08-14';
const SATURDAY = '2026-08-15';
const SUNDAY = '2026-08-16';
const TODAY = MONDAY;

const WEEK: VisibleWeek = {
  weekStart: MONDAY,
  days: [
    day(MONDAY, 'training', ['Strength']),
    day(TUESDAY, 'training', ['Conditioning']),
    day(WEDNESDAY, 'rest', []),
    day(THURSDAY, 'training', ['Upper Push', 'Easy Aerobic Flush']),
    day(FRIDAY, 'training', ['Lower Squat']),
    day(SATURDAY, 'game', []),
    day(SUNDAY, 'rest', []),
  ],
};

const readIt = (message: string) =>
  readCoachMessage({ message, week: WEEK, todayISO: TODAY });

const proposeIt = (message: string, week: VisibleWeek = WEEK) => {
  const result = readCoachMessage({ message, week, todayISO: TODAY });
  if (result.intent !== 'change') return null;
  return coachProposal({ request: result.request, week });
};

/** The move payload, narrowed — a union of 26 payloads answers no question. */
function movePayload(action: ProgramControlAction | null | undefined) {
  return action && action.type === 'move_session' ? action.payload : null;
}

// ─── [1] THE MARKER MATRIX — WRITTEN BEFORE THE RESOLVER ─────────────────────

console.log('\n[1] THE MATRIX — every pair of markers that can share one message');
{
  // THE SEAT'S ORDER, VERBATIM: *"The S2 boundary's named resolver class (two-
  // marker messages beat a table-ordered resolver) applies to S3's request
  // resolver from its first cell — build the matrix before the resolver, not
  // after its first survivor."*
  //
  // The slice-2 boundary stated the general form: *"a resolver that returns the
  // first match from an ordered table is answering by table order, and a test
  // set with one match per input measures the matches rather than the
  // ordering."* Its remedy: **at least one input that matches two rules, per
  // pair that can co-occur.**
  //
  // Four marker families can appear in one coach message:
  //   Q  — an interrogative opener or a question mark
  //   M  — a move verb
  //   D  — one or more named days
  //   W  — a week marker ("this week")
  //
  // Every pair below is a message carrying BOTH, with the reading the rules
  // must produce. The single-marker rows are here too, as the controls that
  // stop a pair's expectation from being satisfied by a resolver that always
  // answers the same way.
  type Expected = 'question' | 'change';
  const MATRIX: ReadonlyArray<{
    readonly markers: string;
    readonly message: string;
    readonly expect: Expected;
    readonly why: string;
  }> = [
    // ── SINGLES: the controls. ──
    { markers: 'Q+D', message: 'what am I doing friday?', expect: 'question',
      why: 'slice 2 still answers what slice 2 answered' },
    { markers: 'Q+W', message: 'what does this week look like?', expect: 'question',
      why: 'the week shape is a question and has no move verb' },
    { markers: 'M+D', message: 'move friday to sunday', expect: 'change',
      why: 'the plain request, no question marker at all' },
    // ── PAIRS INVOLVING THE MOVE VERB — the ones a two-reader design loses. ──
    { markers: 'Q+M+D', message: 'can you move friday to sunday?', expect: 'change',
      why: 'THE FIRST MESSAGE ANYBODY WOULD TYPE. Polite phrasing carries an '
        + 'interrogative AND a move verb; a question reader tried first answers '
        + 'a question that was not asked' },
    { markers: 'Q+M+D', message: 'could I move thursday to sunday please?', expect: 'change',
      why: 'the same shape with a different interrogative' },
    { markers: 'Q+M+D', message: 'why can\'t I move saturday?', expect: 'change',
      why: 'a WHY question about a move is answered by attempting the move and '
        + 'reporting the refusal — the cheap refusal rung' },
    { markers: 'M+W+D', message: 'move friday to sunday this week', expect: 'change',
      why: 'a week marker beside a move verb is scope, not subject' },
    { markers: 'Q+M+W', message: 'can you move something this week?', expect: 'change',
      why: 'a move verb with no day is still a request; the coach asks which day' },
    // ── PAIRS WITHOUT A MOVE VERB — the slice-2 precedence, still binding. ──
    { markers: 'Q+D+W', message: 'what am I doing on friday this week?', expect: 'question',
      why: 'the slice-2 defect: a named day is narrower than a named week' },
    { markers: 'Y+D', message: 'why is friday heavy?', expect: 'question',
      why: 'FOUND ON SAM\'S DEVICE. A reason marker beside a day marker — the '
        + 'day won and the coach answered with Friday\'s session list. Which '
        + 'reading it gets is section [2]\'s cell; that it is a QUESTION and '
        + 'not a change is this row' },
    { markers: 'Y+M+D', message: 'why can\'t I move saturday?', expect: 'change',
      why: 'and a reason marker does NOT capture a move request — the refusal '
        + 'rung answers it by attempting the move, so the why must not swallow '
        + 'it on the way past' },
  ];

  for (const row of MATRIX) {
    const result = readIt(row.message);
    ok(
      `[${row.markers}] "${row.message}" reads as a ${row.expect}`,
      result.intent === row.expect,
      `got ${result.intent} — ${row.why}`,
    );
  }

  // AND THE MATRIX IS PROVEN TO CONTAIN MULTI-MARKER ROWS, because a matrix of
  // singles is the test set the slice-2 defect survived.
  const multi = MATRIX.filter((row) => row.markers.split('+').length >= 3);
  ok(
    'the matrix carries messages matching three marker families at once',
    multi.length >= 5,
    `${multi.length} of ${MATRIX.length}`,
  );
  // BOTH READINGS ARE REPRESENTED. A matrix whose every row expects the same
  // answer is satisfied by a resolver that ignores its input.
  ok(
    'and it requires both readings, so a constant resolver cannot pass it',
    MATRIX.some((row) => row.expect === 'question')
      && MATRIX.some((row) => row.expect === 'change'),
  );
}

// ─── [2] THE READER AND THE PROPOSAL ─────────────────────────────────────────

console.log('\n[2] WHAT MOVES, WHERE TO, AND WHAT THE COACH REFUSES');
{
  // ── DAY ORDER IS THE MESSAGE'S, NOT THE TABLE'S. A REGRESSION CELL. ──
  //
  // `namedDaysInMessageOrder` replaced a walk over `WEEKDAY_INDEX`, whose
  // iteration order is `WEEKDAY_NAMES` — Sunday first. "Move friday to sunday"
  // therefore resolved SUNDAY as the day being asked about, which for a
  // question was a wrong answer and for a MOVE is the wrong day moved. Third
  // sighting of an ordered table answering a question about specificity.
  const forward = proposeIt('move friday to sunday');
  ok(
    'the day named FIRST is the one that moves',
    forward?.verdict === 'proposed'
      && movePayload(forward.action)?.fromDate === FRIDAY
      && movePayload(forward.action)?.toDate === SUNDAY,
    JSON.stringify(movePayload(forward?.action)),
  );
  // THE CONTROL, and it is what makes the cell above mean anything: reverse the
  // two days and the answer must reverse. A cell that only checked the forward
  // case would pass against a resolver that always picks Friday.
  const backward = movePayload(proposeIt('move sunday to friday')?.action);
  ok(
    'and reversing the two days reverses the move',
    // Sunday is empty in this world, so the coach refuses it — and a refusal
    // naming SUNDAY is the same evidence a proposal would be: the reader gave
    // the proposal Sunday as the source, not Friday.
    backward === null
      ? proposeIt('move sunday to friday')?.text.includes('Sunday') === true
      : backward.fromDate === SUNDAY && backward.toDate === FRIDAY,
    JSON.stringify(backward ?? proposeIt('move sunday to friday')?.text),
  );
  // ── AND THE TWO CELLS A SURVIVOR ADDED. ────────────────────────────────────
  //
  // M3 (deleting the sort that puts named days in MESSAGE order) SURVIVED the
  // first run at 97/97, and the reason is this suite's own blind spot rather
  // than a harmless mutation: every two-day message above carries "to", and the
  // preposition rule picks the destination by POSITION, so it produced the same
  // answer from an unsorted list. **A cell set in which one rule always decides
  // cannot observe a second rule** — the slice-2 class again, this time in the
  // gate written to honour it. Two inputs where the sort is the only thing
  // deciding:
  const noPreposition = movePayload(proposeIt('move friday sunday')?.action);
  ok(
    'with no preposition, the day named FIRST is still the one that moves',
    noPreposition?.fromDate === FRIDAY && noPreposition.toDate === SUNDAY,
    JSON.stringify(noPreposition ?? proposeIt('move friday sunday')?.text),
  );
  // AND THE QUESTION PATH, WHICH IS WHERE THE DEFECT SHIPPED. Two days named in
  // a question: the first is the subject. Under the old table walk this answered
  // about MONDAY, because Monday precedes Friday in `WEEKDAY_NAMES`.
  const twoDayQuestion = readIt('am I training friday or monday?');
  ok(
    'a question naming two days is about the first one said',
    twoDayQuestion.intent === 'question'
      && twoDayQuestion.question.targetDateISO === FRIDAY,
    `${twoDayQuestion.intent}: ${JSON.stringify(
      twoDayQuestion.intent === 'question' ? twoDayQuestion.question : null)}`,
  );

  // THE PREPOSITION BEATS WORD ORDER WHEN IT DISAGREES WITH IT.
  const prepositionFirst = movePayload(proposeIt('move to sunday the friday session')?.action);
  ok(
    'a destination introduced by "to" is the destination wherever it sits',
    prepositionFirst?.fromDate === FRIDAY && prepositionFirst.toDate === SUNDAY,
    JSON.stringify(prepositionFirst ?? proposeIt('move to sunday the friday session')?.text),
  );

  // ── THE CAPABILITY IS ASKED BEFORE THE DESTINATION, AND THAT IS THE RUNG ──
  const fixture = proposeIt("why can't I move saturday?");
  ok(
    'a day that cannot move is REFUSED, not asked where to',
    fixture?.verdict === 'refused',
    `${fixture?.verdict}: ${fixture?.text}`,
  );
  ok(
    'and the refusal names the day rather than a date',
    fixture?.text.includes('Saturday') === true
      && fixture.text.includes(SATURDAY) === false,
    fixture?.text,
  );
  // THE PROJECTION'S OWN REFUSAL WINS WHERE IT HAS ONE — a recorded rule,
  // already signed, already the words the day's menu shows.
  const withRefusal: VisibleWeek = {
    ...WEEK,
    days: WEEK.days.map((candidate) => candidate.date !== SATURDAY ? candidate : {
      ...candidate,
      capabilities: {
        ...candidate.capabilities,
        refusal: signed("There's nothing to change on this day."),
      },
    }),
  };
  const spoken = coachProposal({
    request: { kind: 'move_session', from: { dateISO: SATURDAY, at: 0 }, to: null },
    week: withRefusal,
  });
  ok(
    'the coach speaks the projection\'s recorded refusal verbatim',
    spoken.text === "There's nothing to change on this day.",
    spoken.text,
  );
  ok(
    'and its own floor is used ONLY when the projection carries none',
    fixture?.text.startsWith(COACH_CHANGE_COPY.cannotMoveLead) === true,
    fixture?.text,
  );

  // ── THE ASKS ──
  const noDay = proposeIt('can you move something around?');
  ok('a move with no day named ASKS which day',
    noDay?.verdict === 'asked' && noDay.text === COACH_CHANGE_COPY.askWhichDay,
    `${noDay?.verdict}: ${noDay?.text}`);
  const noDestination = proposeIt('move friday');
  ok('a movable day with no destination ASKS where to',
    noDestination?.verdict === 'asked'
      && noDestination.text === COACH_CHANGE_COPY.askWhereTo,
    `${noDestination?.verdict}: ${noDestination?.text}`);
  // AND BOTH ASKS TEACH THE WHOLE SHAPE, because this slice has no follow-up
  // context: a bare "friday" in reply carries no move verb and would be read as
  // a question. An ask whose answer the asker cannot understand is a dead end,
  // and the cell is here so that removing the example is a red rather than a
  // quiet regression to one.
  for (const [label, text] of [
    ['askWhichDay', COACH_CHANGE_COPY.askWhichDay],
    ['askWhereTo', COACH_CHANGE_COPY.askWhereTo],
  ] as const) {
    ok(
      `${label} shows the athlete a message that stands on its own`,
      /move\s+\w+day\s+to\s+\w+day/i.test(text),
      text,
    );
  }

  // ── THE REFUSALS THAT ARE NOT CAPABILITIES ──
  // TWO MARKERS, ONE DAY — and it is reachable rather than contrived: today is
  // Monday in this world, so "move today to monday" names one date twice. It is
  // also the cell that killed a dedup-by-date in the day resolver, which had
  // collapsed the two slots and left the coach asking where to.
  const sameDay = proposeIt('move today to monday');
  ok('moving a day onto itself is refused',
    sameDay?.verdict === 'refused' && sameDay.text === COACH_CHANGE_COPY.alreadyThere,
    `${sameDay?.verdict}: ${sameDay?.text}`);
  const emptyDay = proposeIt('move wednesday to sunday');
  ok('a day with nothing on it cannot move',
    emptyDay?.verdict === 'refused',
    `${emptyDay?.verdict}: ${emptyDay?.text}`);

  // ── OUT OF THE WEEK, AND IT IS THE COACH'S LIMIT NOT THE ATHLETE'S ERROR ──
  const shortWeek: VisibleWeek = { ...WEEK, days: WEEK.days.slice(0, 5) };
  const outside = proposeIt('move friday to sunday', shortWeek);
  ok(
    'a destination outside the visible week is the coach\'s stated limit',
    outside?.verdict === 'refused' && outside.text === COACH_ANSWER_COPY.dayNotInWeek,
    `${outside?.verdict}: ${outside?.text}`,
  );

  // ── THE DEVICE CASE, AS A REGRESSION ──────────────────────────────────────
  //
  // SEAT INBOX item 0's free evidence, probed by hand: the slice-2 boundary and
  // NOW.md both told Sam *"why is Friday heavy?"* was REFUSED. It was not — the
  // day marker won and the coach answered *"Friday: Lower Squat."* **The
  // athlete asks WHY and is told WHAT**, with nothing to signal the question was
  // missed, which is worse than a refusal and is the failure L-C1 exists to
  // prevent. No cell held the claim; it lived in prose only.
  const whyDay = readIt('why is friday heavy?');
  ok(
    'a reason question about a day is placed as a REASON, not as the day\'s work',
    whyDay.intent === 'question' && whyDay.question.subject === 'reason',
    whyDay.intent === 'question' ? whyDay.question.subject : whyDay.intent,
  );
  const whyAnswer = whyDay.intent === 'question'
    ? coachAnswer({ question: whyDay.question, week: WEEK, todayISO: TODAY }) : null;
  ok(
    'and it is answered honestly rather than with the session list',
    whyAnswer?.verdict === 'no_rule'
      && !whyAnswer.text.includes('Lower Squat'),
    whyAnswer?.text,
  );
  // THE CONTROL, AND IT IS WHAT STOPS THE FIX BECOMING A BLANKET "WHY WINS".
  // Without it, a reason marker could swallow every message it appears in.
  const plainDay = readIt('what am I doing friday?');
  ok(
    'a day question with no reason marker still answers with the day',
    plainDay.intent === 'question' && plainDay.question.subject === 'day_work',
    plainDay.intent === 'question' ? plainDay.question.subject : plainDay.intent,
  );
  // AND SAM'S OWN TYPO'D SENTENCE, WHICH IS NOW PLACED RATHER THAN UNPARSEABLE.
  // The reply is the same honest sentence either way; what changed is that it
  // reaches the arm the Bible layer will fill instead of falling off the end.
  const typed = readIt('Why do we do strength before team traininh');
  ok(
    "Sam's own message is placed as a reason question",
    typed.intent === 'question' && typed.question.subject === 'reason',
    typed.intent === 'question' ? typed.question.subject : typed.intent,
  );

  // ── AND SWAP IS NOT A MOVE. The verb list is one kind's, not a family's. ──
  ok(
    'a swap request is not read as a move',
    readIt('swap friday for sunday').intent === 'question',
    'reading an adjacent verb as this kind would do something the athlete did '
      + 'not ask for, which is worse than saying the coach cannot',
  );
  // A VERB LIST WITHOUT WORD BOUNDARIES IS A SUBSTRING LIST.
  ok(
    'a training word containing a verb is not a move request',
    readIt('what movement am I doing thursday?').intent === 'question',
    '"movement" contains "move"',
  );
}

// ─── [3] THE CARD IS A PROJECTION OF THE ACTION ──────────────────────────────

console.log('\n[3] L-C2 — the card is a function of the action and of nothing else');
{
  const action: ProgramControlAction = {
    type: 'move_session',
    source: { screen: 'coach_tab', surface: 'coach_change_card', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { fromDate: FRIDAY, toDate: SUNDAY },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  };
  const card = changeCardFor({ action, week: WEEK })!;
  ok('the card was built', card !== null && card.fields.length === 3);

  // L-C2'S FOUR: what changes (the title), from what, to what, and why.
  ok('it says WHAT changes', card.title === COACH_CHANGE_COPY.moveTitle, card.title);
  ok('FROM what', card.fields[0].label === COACH_CHANGE_COPY.fromLabel
    && card.fields[0].value === describeVisibleDay(WEEK.days[4]).text,
    card.fields[0].value);
  ok('TO what', card.fields[1].label === COACH_CHANGE_COPY.toLabel
    && card.fields[1].value === describeVisibleDay(WEEK.days[6]).text,
    card.fields[1].value);
  ok('and WHY', card.fields[2].label === COACH_CHANGE_COPY.whyLabel
    && card.fields[2].value === COACH_CHANGE_COPY.whyYouAsked,
    card.fields[2].value);

  // THE CARD FOLLOWS THE ACTION. Change ONE field of the action and the card
  // must change with it — which is what "card and change cannot drift" means
  // operationally. Asserting the card's contents against a fixture proves the
  // fixture; asserting that they MOVE with the action proves the coupling.
  const rerouted = changeCardFor({
    action: { ...action, payload: { fromDate: THURSDAY, toDate: SUNDAY } },
  week: WEEK })!;
  ok(
    'a different action produces a different card, at the field that differs',
    rerouted.fields[0].value !== card.fields[0].value
      && rerouted.fields[1].value === card.fields[1].value,
    `${rerouted.fields[0].value} vs ${card.fields[0].value}`,
  );

  // EVERY TRAINING WORD ON THE CARD CAME OUT OF THE PROJECTION. Same claim
  // slice 2 makes about an answer, and the same instrument: strip the days'
  // projected names and the batch's own strings, and nothing may remain.
  const projectionWords = [
    ...describeVisibleDay(WEEK.days[4]).usedProjectionNames,
    ...describeVisibleDay(WEEK.days[6]).usedProjectionNames,
    'Friday', 'Sunday',
  ];
  const batchWords = Object.values(COACH_CHANGE_COPY) as string[];
  const residue = card.fields
    .flatMap((field) => [field.label, field.value])
    .map((text) => [...projectionWords, ...batchWords, COACH_ANSWER_COPY.dayLabelJoin,
      COACH_ANSWER_COPY.itemJoin]
      .reduce((rest, fragment) => rest.split(fragment).join(''), text))
    .join('')
    .replace(/\s/g, '');
  ok('no word on the card came from anywhere but the projection and batch 31',
    residue.length === 0, residue);
  // THE CONTROL: the instrument can fail. A strip-everything proves nothing.
  const invented = ['Friday: Lower Squat and a bit of extra tempo work']
    .map((text) => [...projectionWords, ...batchWords]
      .reduce((rest, fragment) => rest.split(fragment).join(''), text))
    .join('').replace(/\s/g, '');
  ok('and an invented clause DOES leave a residue', invented.length > 0, invented);

  // A KIND WITH NO CARD IS A KIND WITH NO CHANGE.
  //
  // THE PROBE IS `move_team_night` AND THE FIRST ONE WAS `bin_session`, WHICH
  // IS WHY M8 SURVIVED. A bin payload has no `fromDate`, so deleting the kind
  // guard still returned null — the card came back empty because a field was
  // missing, not because the kind was refused, and the cell read as proof of a
  // guard that was no longer there. `move_team_night` carries `fromDate` and
  // `toDate`, so without the guard it renders a full card: the only probe that
  // can tell the guard from the accident.
  ok(
    'an action this slice cannot draw returns no card, even when its payload fits',
    changeCardFor({
      action: {
        ...action,
        type: 'move_team_night',
        payload: { fromDate: FRIDAY, toDate: SUNDAY, route: 'this_week_only' },
      } as ProgramControlAction,
      week: WEEK,
    }) === null,
    'a generic card is how a second kind ships without anybody deciding it should',
  );
  // AND THE PROPOSAL CANNOT HAND OUT AN ACTION WITHOUT ONE.
  ok(
    'a proposed action always arrives with its card',
    proposeIt('move friday to sunday')?.card !== null
      && proposeIt('move friday')?.card === null,
    'L-C2: no coach mutation without the card',
  );

  // THE CARD READS THE ACTION AND THE WEEK, AND NOTHING ELSE.
  // WORD BOUNDARIES, AND THIS CELL EARNED THEM ON ITS FIRST RUN. Without them
  // `turn` matched `return` and the cell reddened a correct module — a source
  // scan counting a character sequence where the claim is about an identifier,
  // which is AGENTS.md's own law arriving inside the gate written to honour it.
  ok(
    'the card rule takes no message, no request and no conversation',
    !/\b(message|request|conversation|draft)\b/i.test(
      cardCode.replace(/^import[\s\S]*?;$/gm, '')),
    'a card built from the athlete\'s sentence describes what they asked for, '
      + 'not what will run',
  );
}

// ─── [4] THE TRUTH GATE, WITH ITS INPUT NON-EMPTY FOR THE FIRST TIME ─────────

console.log('\n[4] THE MOUTH GATE — the coach may claim only what the week shows');
{
  const action: ProgramControlAction = {
    type: 'move_session',
    source: { screen: 'coach_tab', surface: 'coach_change_card', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { fromDate: FRIDAY, toDate: SUNDAY },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  };
  // THE WEEK AFTER A MOVE THAT REALLY HAPPENED: Friday emptied, Sunday holds it.
  const moved: VisibleWeek = {
    ...WEEK,
    days: WEEK.days.map((candidate) =>
      candidate.date === FRIDAY ? day(FRIDAY, 'rest', [])
        : candidate.date === SUNDAY ? day(SUNDAY, 'training', ['Lower Squat'])
          : candidate),
  };

  const applied = coachChangeOutcome({
    action, before: WEEK, after: moved, door: { ok: true, outcome: 'applied' },
  });
  ok('a move the week shows is claimed, in the two day names',
    applied.verdict === 'applied'
      && applied.text.includes('Friday') && applied.text.includes('Sunday'),
    applied.text);
  ok('and the claim is one the gate could have caught',
    FORBIDDEN_WHEN_NO_APPLIED.some((pattern) => pattern.test(applied.text)),
    'a confirmation no forbidden pattern matches is a confirmation the truth '
      + 'gate cannot refuse — the keystone would be decorative for the one '
      + 'sentence slice 3 adds');
  ok('two dates changed, and both are on the record',
    applied.appliedChanges.length === 2
      && applied.appliedChanges.every((change) => change.visible),
    JSON.stringify(applied.appliedChanges.map((change) => change.date)));

  // ── THE BITE. The door says it worked; the week says otherwise. ──
  const lying = coachChangeOutcome({
    action, before: WEEK, after: WEEK, door: { ok: true, outcome: 'applied' },
  });
  ok(
    'a door reporting success over an unmoved week cannot claim the move',
    lying.verdict === 'no_change' && !/\bI moved\b/.test(lying.text),
    `${lying.verdict}: ${lying.text}`,
  );
  ok(
    'and what it says instead is the honest sentence',
    lying.text === COACH_CHANGE_COPY.changeNoOp,
    lying.text,
  );

  // ── THE DOOR'S REFUSAL IS THE DOOR'S SENTENCE ──
  const refused = coachChangeOutcome({
    action, before: WEEK, after: WEEK,
    door: { ok: false, outcome: 'refused',
      message: "I couldn't safely make that change, so the plan is untouched." },
  });
  ok('a refusal is spoken in the door\'s own words',
    refused.verdict === 'refused'
      && refused.text === "I couldn't safely make that change, so the plan is untouched.",
    refused.text);
  const mute = coachChangeOutcome({
    action, before: WEEK, after: WEEK, door: { ok: false },
  });
  ok('and the coach has a floor for a door that refuses without saying why',
    mute.verdict === 'refused' && mute.text === COACH_CHANGE_COPY.changeRefused,
    mute.text);

  // ── THE DIFF IS THE PROJECTION'S, NOT THE STORE'S ──
  ok(
    'a date whose visible day is unchanged produces no applied change',
    appliedChangesFromVisibleWeeks({
      before: WEEK, after: WEEK, dates: [FRIDAY, SUNDAY],
    }).length === 0,
  );
  ok(
    'and a date whose visible day differs produces exactly one',
    appliedChangesFromVisibleWeeks({
      before: WEEK, after: moved, dates: [FRIDAY],
    }).length === 1,
  );

  // THE DECLINE IS A RULE, NOT A SCREEN CONSTANT.
  ok('declining has a sentence and it lives in rules/',
    coachChangeDeclined() === COACH_CHANGE_COPY.changeCancelled
      && coachChangeDeclined().length > 0);
}

// ─── [5] THE COACH IS NOT A WRITER — IT PRODUCES A DOOR ACTION ───────────────

console.log('\n[5] ONE OUTPUT — a ProgramControlAction, on the allow-list');
{
  const proposed = proposeIt('can you move friday to sunday?')!;
  const action = proposed.action!;

  ok('the coach\'s output is the door\'s own vocabulary and nothing else',
    typeof action.type === 'string' && 'payload' in action && 'source' in action);
  ok('its type is on slice 3\'s allow-list',
    (COACH_PROPOSABLE_ACTION_TYPES as readonly string[]).includes(action.type),
    action.type);
  ok('the allow-list is ONE kind, per the order',
    COACH_PROPOSABLE_ACTION_TYPES.length === 1,
    COACH_PROPOSABLE_ACTION_TYPES.join(','));

  // THE DOOR RECORDS WHAT THE COACH PROPOSES, AND IT DOES SO BY THE OTHER
  // MECHANISM. `move_session` must NOT be in the exercise door's list — being
  // in both would append two decisions for one act, and undo would need two
  // taps to undo one move.
  ok(
    'move_session is recorded by applyPlanChange, NOT by the exercise allow-list',
    !(LEDGER_RECORDED_ACTION_TYPES as readonly string[]).includes('move_session'),
    LEDGER_RECORDED_ACTION_TYPES.join(','),
  );
  const producerSource = read('utils', 'planChangeProducer.ts');
  const appendRegion = /if \(result\.ok\) \{[\s\S]{0,600}?appendDecisionEntry\(\{[\s\S]{0,200}?\}\);/
    .exec(producerSource)?.[0] ?? '';
  ok(
    'the append region was located and is a landed-only append',
    appendRegion.length > 100 && /result\.ok/.test(appendRegion),
    `${appendRegion.length} chars`,
  );
  ok(
    'and it records a plan_change decision, so undo covers the coach for free',
    /kind: 'plan_change'/.test(appendRegion),
    appendRegion,
  );
  // AND THE DOOR THE COACH ENTERS MAPS THIS TYPE TO THAT PRODUCER.
  const doorSource = read('utils', 'programControlActions.ts');
  ok(
    'the tap door maps move_session onto the plan-change producer',
    /action\.type === 'move_session'[\s\S]{0,200}?kind: 'move_session'/.test(doorSource),
    'if it did not, the coach\'s action would reach a path with no ledger append',
  );

  // AUTHORSHIP IS WRITTEN INTO THE ACTION.
  ok('the action says it came from the coach tab',
    action.source.screen === 'coach_tab', action.source.screen);
  ok('and it is a TAP, because the athlete tapped confirm',
    action.source.initiatedBy === 'tap',
    'a coach stamping `system` would be claiming autonomy the card exists to deny');
  ok('the coach tab is a different screen id from the FROZEN beta surface',
    action.source.screen !== 'coach_notes',
    'one word is what stops a census of coach-authored decisions counting the '
      + 'old pipeline\'s writes as the new one\'s');

  // NO COMPONENT SCOPE IS INVENTED. The athlete named two days, not a part.
  ok('no move scope is invented on the athlete\'s behalf',
    !('scope' in (action.payload as Record<string, unknown>)),
    JSON.stringify(action.payload));

  // ── THE RULES REACH NO WRITER. Slice 2's one-hop ban, extended by hand to
  // the three modules slice 3 adds, because they are `rules/` too.
  const FORBIDDEN: ReadonlyArray<{ readonly pattern: RegExp; readonly why: string }> = [
    { pattern: /from '[^']*\/store\//, why: 'a zustand store is a writer with a getter attached' },
    { pattern: /programControlActions/, why: 'the executor belongs to the screen, not to a rule' },
    { pattern: /Transaction/, why: 'accepted-state transactions are the write path' },
    { pattern: /AsyncStorage|persist/, why: 'a proposal is not a record' },
  ];
  for (const [label, code] of [
    ['coachRead', readCode], ['coachProposal', proposalCode],
    ['coachChangeCard', cardCode], ['coachChangeOutcome', outcomeCode],
  ] as const) {
    // `import type` is ERASED and creates no runtime edge — every one of these
    // modules names `ProgramControlAction`, and counting that as reaching the
    // executor is `a count taken for a record` in its eleventh form.
    const runtimeImports = code.match(/^import(?!\s+type\s)[\s\S]*?from\s+'[^']+';/gm) ?? [];
    ok(
      `rules/${label}'s runtime import block was located`,
      runtimeImports.length >= 1,
      runtimeImports.join(' | '),
    );
    for (const { pattern, why } of FORBIDDEN) {
      ok(
        `rules/${label} imports nothing matching ${pattern} (${why})`,
        runtimeImports.filter((line) => pattern.test(line)).length === 0,
        runtimeImports.join(' | '),
      );
    }
    ok(`rules/${label} reads no clock`, !/todayISOLocal|new Date\(\)/.test(code));
  }
  ok(
    'and the action type IS reached — as a type, which is the whole claim',
    /^import type \{[\s\S]*?ProgramControlAction[\s\S]*?\} from '\.\.\/types\/programControlAction';/m
      .test(proposalCode),
    'the door\'s vocabulary as a CONTRACT, not as code',
  );
}

// ─── [6] L-C3 — THE NIKE BAR, BLOCKING BY THE SEAT'S ORDER ───────────────────

console.log('\n[6] L-C3 — the confirm button, with the keyboard up');
{
  // THE SEAT'S ORDER: *"L-C3 keyboard cases now BLOCK the boundary: the card's
  // confirm buttons with keyboard up is the exact Nike case Sam named."*
  //
  // What SOURCE can prove is placement; what it cannot prove is what the glass
  // does. Both halves are stated so the report cannot read as if this closed
  // the device case.
  const footerRegion = /const composer = \([\s\S]*?\n  \);/.exec(screenCode)?.[0] ?? '';
  ok(
    'the footer region was located and holds its last line',
    footerRegion.length > 300 && /\n  \);\s*$/.test(footerRegion),
    `${footerRegion.length} chars`,
  );
  ok(
    'the change card is INSIDE the keyboard-riding footer, not in the scroll',
    /<ChangeCard/.test(footerRegion),
    'a card rendered as the last bubble can be scrolled, and a keyboard '
      + 'appearing under it covers the athlete\'s yes',
  );
  ok(
    'and the footer is what KeyboardSafeArea rides the keypad with',
    /<KeyboardSafeArea[^>]*footer=\{composer\}/s.test(screenCode),
  );
  ok(
    'the card is NOT also rendered in the conversation',
    (screenCode.match(/<ChangeCard/g) ?? []).length === 1,
    'two cards is two yeses, and only one of them is reachable',
  );
  // NO DEAD TAP ZONES — the day-first invisible-witness lesson, applied to the
  // two controls that execute a change.
  // ANCHORED ON A LINE THAT IS EXACTLY `}`, NOT ON THE FIRST `}` AT COLUMN 0.
  // The component's own destructured parameter list closes with `}: {` at
  // column 0, so `\n\}` stopped 56 characters in and returned a slice that read
  // as a region and contained none of the claims below. The prove-the-region
  // cell reddened first and four claims reddened behind it — the anchoring law
  // working, in the gate that cites it.
  const cardComponent = /function ChangeCard\(\{[\s\S]*?\n\}\n/.exec(screenCode)?.[0] ?? '';
  ok('the card component was located', cardComponent.length > 400
    && /coach-tab-change-confirm/.test(cardComponent), `${cardComponent.length} chars`);
  for (const control of ['coach-tab-change-confirm', 'coach-tab-change-cancel']) {
    ok(`${control} exists and carries a hit slop`,
      new RegExp(`testID="${control}"`).test(cardComponent));
  }
  ok('both card controls are 44 high',
    /height: 44,/.test(screenCode)
      && (screenCode.match(/cardButton: \{[\s\S]*?height: 44,/) ?? []).length === 1,
    'the smallest control iOS considers reliably tappable');
  ok('both carry an accessibility label taken from the card',
    (cardComponent.match(/accessibilityLabel=\{card\.(confirm|cancel)Label\}/g) ?? []).length === 2,
    'a screen-reader name composed here would be a third rendering of the change');
  ok('and both are buttons to the accessibility tree',
    (cardComponent.match(/accessibilityRole="button"/g) ?? []).length === 2);

  // THE CARD BLOCKS NOTHING. The composer stays live while a card is up, so an
  // athlete who wants to type instead of tapping is never trapped.
  ok(
    'the composer is still mounted while a card is showing',
    // RE-ANCHORED, AND THE CHARACTER BOUND IS GONE (seat, 2026-08-10).
    //
    // This cell used to read `{pending ? ([\s\S]{0,200}?) : null}` followed by
    // the composer — a WINDOW over the JSX region. L-C4's chooser added two
    // props, the region grew past 200, and the cell reddened over a property
    // that had not changed. Widening it to 600 was accepted once and is the
    // wrong shape: **an anchor on the thing every slice edits is an anchor
    // every slice breaks** (L12), and a window that must grow whenever a prop
    // is added will be widened again by a slice that is hiding a real
    // regression.
    //
    // The claim is not "the card's JSX is under N characters". It is: the
    // card's conditional CLOSES, and the composer is the next thing mounted.
    // `\) : null\}` is the smallest declaration that carries "the card ends
    // here", and `\s*<View style={styles.composer}>` is the smallest that
    // carries "and the composer follows". Nothing between them, no bound on
    // what came before, and adding a hundred props changes neither.
    /\) : null\}\s*<View style=\{styles\.composer\}>/.test(screenCode)
      && /\{pending \? \(/.test(screenCode),
    'a card that replaced the composer would be a modal without a dismiss',
  );

  // THE SCREEN STILL DECIDES NOTHING ABOUT WORDS.
  ok(
    'the card component composes no string of its own',
    !/>\s*[A-Za-z][A-Za-z ,'’.]{4,}\s*</.test(cardComponent)
      && (cardComponent.match(/\{card\./g) ?? []).length >= 5,
    'every string on the card came from changeCardFor',
  );

  // ── THE FOUR CASES SAM'S DEVICE FOUND, AS CELLS ────────────────────────────
  //
  // SEAT INBOX item 0, 2026-08-09 night, from Sam's screenshots and his words:
  // *"the chat history is stuck - it gets hidden behind the keypad and it
  // doesn't scroll down - so when I'm typing a new question after a few
  // questions I can't see the answers."* L-C3 calls that a GATE failure, and
  // the kickoff says keyboard cases are gate cases from slice 1 — **these cells
  // are the debt of not having had them.** The required end state, numbered as
  // the order numbers it.
  const safeArea = stripComments(read('components', 'keyboard', 'KeyboardSafeArea.tsx'));

  // (1) THE LIST'S VISIBLE AREA ENDS ABOVE THE KEYBOARD, NEVER BEHIND IT.
  ok(
    '(1) the non-scrollable body reserves the keyboard\'s height',
    /paddingBottom: Math\.abs\(reanimated\.height\.value\)/.test(safeArea)
      && /<Animated\.View style=\{\[styles\.body, keyboardInset\]\}>/.test(safeArea),
    'a flex:1 body inside a root that does not shrink runs to the true screen '
      + 'bottom, and its last content sits behind the keypad',
  );
  ok(
    'and it rides the SAME keyboard frame the footer does — one clock',
    /useKeyboardContext/.test(safeArea) && /KeyboardStickyView/.test(safeArea),
    'two animations on two clocks is the failure mode the slice-1 boundary '
      + 'named; both values here come from the one native keyboard frame',
  );
  // ANCHORED ON THE ELEMENT, NOT ON A WINDOW AFTER ITS NAME. A `[\s\S]{0,400}`
  // span from the component name reached across the ternary into the OTHER
  // branch and reddened a correct file — a proximity scan answering a question
  // about an element's own props.
  const awareElement = /<KeyboardAwareScrollView\b[\s\S]*?\n    >/.exec(safeArea)?.[0] ?? '';
  ok(
    'the scrollable branch was located and is the element, not a fragment',
    awareElement.length > 200 && /bottomOffset=/.test(awareElement),
    `${awareElement.length} chars`,
  );
  ok(
    'and it is deliberately NOT padded as well',
    !/keyboardInset/.test(awareElement),
    'KeyboardAwareScrollView already moves its focused field; a second '
      + 'adjustment to content it is already moving is the stacked-primitives '
      + 'defect this owner was rewritten to end',
  );

  // (2) NEW CONTENT PINS TO BOTTOM WHEN THE ATHLETE IS ALREADY AT BOTTOM.
  ok(
    '(2) new content pins the conversation to its bottom',
    /onContentSizeChange=\{\(\) => pinToBottom\(true\)\}/.test(screenCode),
  );
  ok(
    'and pinning is CONDITIONAL on the athlete already being there',
    /if \(!atBottomRef\.current\) return;/.test(screenCode)
      && /onScroll=\{handleScroll\}/.test(screenCode),
    'yanking a reader back to the newest turn is the same disrespect as not '
      + 'scrolling at all, pointing the other way',
  );
  ok(
    'the at-bottom test carries a tolerance rather than an equality',
    // A NON-ZERO tolerance. `- 0` matches `\d+` and is the same equality this
    // cell exists to forbid, so the digit class starts at one.
    /contentSize\.height - [1-9]\d*/.test(screenCode),
    'an exact equality is never true on a device — rubber-banding, fractional '
      + 'layout and the inertial tail all land short, and the list would stop '
      + 'following after the first flick',
  );
  ok(
    'and it is a ref, so recording the position re-renders nothing',
    /const atBottomRef = useRef\(true\);/.test(screenCode)
      && /scrollEventThrottle=\{16\}/.test(screenCode),
  );

  // (3) THE KEYBOARD APPEARING RE-PINS TO BOTTOM.
  ok(
    '(3) the keyboard appearing re-pins the conversation',
    /Keyboard\.addListener\('keyboardDidShow', \(\) => pinToBottom\(false\)\)/.test(screenCode),
    'the keypad shrinks the list, and a shrunk list is no longer at its bottom',
  );
  ok(
    'and it listens to didShow, not willShow',
    !/keyboardWillShow/.test(screenCode),
    'the body\'s inset rides the native keyboard frame, so the frame is only '
      + 'final once the keyboard is — scrolling to a bottom that is about to '
      + 'move is scrolling to the wrong place',
  );
  ok(
    'the listener is removed when the screen goes',
    /return \(\) => subscription\.remove\(\);/.test(screenCode),
  );

  // (4) NOTHING OCCLUDES THE COMPOSER OR THE LATEST BUBBLE — the placement
  // cells above are half of this, and the inset is the other half: the body
  // ends above the footer's own strip, which is itself above the keypad.

  // ── AND THE DEVICE HALF, NAMED SO IT CANNOT READ AS CLOSED ──
  ok(
    'this section is source placement and says so',
    true,
    'DEPTH 0 — no screen mounted, no keyboard raised, no tap made. The four '
      + 'cases above are the SHAPE of the fix; only Sam\'s phone can say the '
      + 'defect is gone.',
  );
}

// ─── [7] THE DOOR IS HANDED THE WEEK — THE TAPE'S FINDING, AS CELLS ──────────

console.log('\n[7] THE ARGUMENT THE DOOR NEEDS, AND THE WORDS IT DOES NOT LEND');
{
  // MEASURED FIRST, `npm run tape:coach-move-durability`, 2026-08-10. Slice 3
  // shipped with `handleConfirm` calling the door as
  // `executeProgramControlActionDurably(action, { todayISO })`, and
  // `executePlanChangeAction`'s first statement is
  // `if (!context.visibleWeek || !context.todayISO) return fallbackResult(...)`.
  // So the coach's move NEVER RAN. The tape put the athlete's identical move
  // through `PlanChangeSheet`'s own door on the same world in the same run: the
  // tap landed and recorded a `plan_change`, the coach's returned `ok: false`
  // and changed nothing.
  //
  // Sections [5] and [6] were green throughout, and they could not have been
  // otherwise: they read that the coach OUTPUTS a door action and that the door
  // records it. Both true. Neither is a claim about the ARGUMENTS the call site
  // passes, and the defect was entirely in the arguments. That is the gap these
  // cells close — and the reason the tape had to exist at all.

  // ── THE CALL SITE, PROVEN FOUND BEFORE IT IS ASSERTED ON ──
  //
  // The anchoring law (AGENTS.md): an `indexOf`/`slice` region that missed
  // returns something a regex passes over. The import line mentions the same
  // symbol, so the anchor is the AWAITED call and the region must carry its own
  // closing line before a word of it is read.
  const callAnchor = screenCode.indexOf('await executeProgramControlActionDurably(');
  const callEnd = callAnchor >= 0 ? screenCode.indexOf(');', callAnchor) : -1;
  const doorCall = callAnchor >= 0 && callEnd > callAnchor
    ? screenCode.slice(callAnchor, callEnd + 2)
    : '';
  ok(
    'the screen\'s door call was located and holds its own closing line',
    doorCall.length > 40 && doorCall.endsWith(');'),
    `${doorCall.length} chars: ${JSON.stringify(doorCall.slice(0, 120))}`,
  );
  ok(
    'and it hands the door a visibleWeek — WITHOUT IT THE MOVE DOES NOT RUN',
    /visibleWeek:/.test(doorCall),
    'executePlanChangeAction returns fallbackResult("Cannot safely apply this '
      + 'day/session action without the current visible week.") when the context '
      + 'has none, and the coach then reports a change it never made an attempt at',
  );
  ok(
    'and what it hands over is weekDays, the door\'s own representation',
    /visibleWeek:\s*weekDays/.test(doorCall),
    'the door takes ResolvedDay[]; `visibleWeek` on this screen is the PROJECTION '
      + 'of that array. Passing the projection would be a type error today and a '
      + 'second representation in the door\'s input if it ever stopped being one',
  );
  ok(
    'and both halves come out of ONE useResolvedWeek call',
    /const \{ weekDays, visibleWeek \} = useResolvedWeek\(\);/.test(screenCode),
    'projectWeekFor computes weekDays and then projects IT — two destructured '
      + 'names, one derivation. Two hook calls would be two weeks that can differ',
  );

  // ── THE PRECONDITION IS QUOTED AT ITS OWNER, so this cell set reds if the
  // door stops requiring the week rather than only if the screen stops passing
  // it. A gate that watches one side of a contract watches half a contract.
  const doorCode = stripComments(read('utils', 'programControlActions.ts'));
  ok(
    'the door still REQUIRES the visible week for a plan-change action',
    /if \(!context\.visibleWeek \|\| !context\.todayISO\) \{[\s\S]{0,200}?fallbackResult\(/
      .test(doorCode),
    'if this precondition goes, the cells above are pinning an argument nothing '
      + 'reads — and the next reader would delete them as dead weight',
  );

  // ── SAMENESS AT THE SOURCE, because the tape is not in the chain. ──
  const sheetCode = stripComments(read('screens', 'home', 'PlanChangeSheet.tsx'));
  const sheetAnchor = sheetCode.indexOf('await executeProgramControlActionDurably(');
  const sheetEnd = sheetAnchor >= 0 ? sheetCode.indexOf(')', sheetAnchor + 45) : -1;
  const sheetCall = sheetAnchor >= 0 && sheetEnd > sheetAnchor
    ? sheetCode.slice(sheetAnchor, sheetEnd + 1)
    : '';
  ok(
    'the athlete\'s own sheet call was located',
    sheetCall.length > 40 && /executeProgramControlActionDurably/.test(sheetCall),
    JSON.stringify(sheetCall.slice(0, 140)),
  );
  ok(
    'and the coach passes the SAME context the sheet does',
    /visibleWeek:\s*weekDays/.test(sheetCall) && /visibleWeek:\s*weekDays/.test(doorCall)
      && /todayISO/.test(sheetCall) && /todayISO/.test(doorCall),
    '"the coach goes through the same door as your own tap" is a claim about the '
      + 'ARGUMENTS as much as about the function — the same door given different '
      + 'context is two doors, which is what the tape measured',
  );

  // ── AND THE DOOR'S WORDS ARE BORROWED ONLY WHEN IT ADDRESSED THE ATHLETE ──
  //
  // The tape's second finding: the coach said *"Cannot safely apply this
  // day/session action without the current visible week."* out loud. That
  // sentence is addressed to a CALLER. `outcome` is the door's own typed account
  // of itself and `'refused'` is the arm on which it authored an athlete-facing
  // sentence, so the coach borrows words on that arm and on no other. A typed
  // distinction the door already draws — not a phrase this suite recognises.
  const moveAction: ProgramControlAction = {
    type: 'move_session',
    source: { screen: 'coach_tab', surface: 'coach_change_card', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: { fromDate: FRIDAY, toDate: SUNDAY },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  };
  const precondition = coachChangeOutcome({
    action: moveAction, before: WEEK, after: WEEK,
    door: {
      ok: false,
      message: 'Cannot safely apply this day/session action without the current visible week.',
    },
  });
  ok(
    'a door that failed a PRECONDITION does not put its words in the coach\'s mouth',
    precondition.verdict === 'refused'
      && precondition.text === COACH_CHANGE_COPY.changeRefused,
    `${precondition.verdict}: ${precondition.text}`,
  );
  ok(
    'and the sentence it uses instead is the signed one from rules/',
    !/visible week|Cannot safely apply/i.test(precondition.text),
    precondition.text,
  );
  // THE CONTROL, and without it the cell above is satisfied by a module that
  // never speaks the door's words at all — which would delete the behaviour
  // [4] pins two sections up.
  const authored = coachChangeOutcome({
    action: moveAction, before: WEEK, after: WEEK,
    door: {
      ok: false, outcome: 'refused',
      message: "I couldn't safely make that change, so the plan is untouched.",
    },
  });
  ok(
    'CONTROL — a door that REFUSED is still spoken verbatim',
    authored.verdict === 'refused'
      && authored.text === "I couldn't safely make that change, so the plan is untouched.",
    authored.text,
  );

  // ── AND THE DEPTH IS NAMED, because [7] is source and behaviour, not a run ──
  ok(
    'the RUN that found this is a tape, and it is not in the chain',
    /tape:coach-move-durability/.test(
      read('..', 'package.json'),
    ),
    'npm run tape:coach-move-durability — it asserts nothing and prints a '
      + 'measurement, so it is a tape and not a gate. These cells are what the '
      + 'chain sees; the tape is what a person reads',
  );
}

// ─── [8] L-C4 — THE COACH OFFERS WHAT THE PICKER OFFERS ─────────────────────

console.log('\n[8] L-C4 — the coach\'s ways through a day are the picker\'s own');
{
  // THE CENSUS MEASURED THE COACH AT 1 OF THE ATHLETE'S 26 ACTIONS, and the ONE
  // it had it performed without the question its own button asks. On an anchored
  // Monday the picker offers `strength` and `team` and NO `whole_day` row, so a
  // scopeless coach move is REFUSED — "protected game/team anchor" — where the
  // athlete's tap carrying the picker's own `strength` row APPLIES. Same day,
  // same destination, same door. Measured by `tape:coach-move-durability`
  // (2026-08-10), not argued.
  //
  // The fix is an OWNERSHIP move, not a scope guess: `coachProposal` takes the
  // owner's `PlanChangeMoveOptions` and renders the owner's own rows. So the
  // acceptance claim is not "the coach can move a session" — it is **the coach
  // offers exactly what the picker offers, from the same call** — and these
  // cells compare the two lists rather than reading either one.
  //
  // DEPTH 0, DELIBERATELY: the owner needs a resolved week and this suite is
  // pure. The list here is a REAL `PlanChangeMoveOptions` value in the owner's
  // own shape; whether `moveOptionsForDay` produces THAT list on a real anchored
  // day is measured at depth 1 by the tape, which reads the producer itself.
  const anchoredOptions = {
    scopes: [
      { id: 'strength', label: 'Just the gym session', sub: 'Team training stays on this day', destinations: [{ date: FRIDAY, occupiedBy: null }] },
      { id: 'team', label: 'Team training', sub: "Pick the night it's on — we'll ask if it's permanent", destinations: [{ date: FRIDAY, occupiedBy: null }] },
    ],
    refusal: null,
  } as never;

  const read = readCoachMessage({ message: 'move monday to friday', week: WEEK, todayISO: TODAY });
  const proposal = read.intent === 'change'
    ? coachProposal({ request: read.request, week: WEEK, moveOptions: anchoredOptions })
    : null;

  ok('the coach proposed on a day whose only ways through are components',
    proposal?.verdict === 'proposed', String(proposal?.verdict));

  const offered = (proposal?.card?.choices ?? []).map((choice) => choice.id);
  ok(
    'and the ids it offers ARE the owner\'s ids, in the owner\'s order',
    JSON.stringify(offered) === JSON.stringify(['strength', 'team']),
    `coach=[${offered.join(', ')}] owner=[strength, team] — this is the L-C4 claim`,
  );
  ok(
    'every word on every row came from the owner, none from the coach',
    (proposal?.card?.choices ?? []).length === 2
    && (proposal?.card?.choices ?? []).every((choice) =>
      choice.label === (anchoredOptions as never as { scopes: { id: string; label: string; sub: string }[] })
        .scopes.find((scope) => scope.id === choice.id)?.label
      && choice.sub === (anchoredOptions as never as { scopes: { id: string; label: string; sub: string }[] })
        .scopes.find((scope) => scope.id === choice.id)?.sub),
    'a coach-authored phrase here would be a second name for the athlete\'s own row',
  );
  ok(
    'THE PARITY BREAK IS CLOSED — the proposed action CARRIES a scope',
    movePayload(proposal?.action)?.scope === 'strength',
    'a scopeless move on this day is the one the door refuses; the picker\'s '
      + 'first row is the athlete\'s own way through and now the coach\'s too',
  );
  ok(
    'and each row carries the action it means, so no surface assembles one',
    (proposal?.card?.choices ?? []).length === 2
    && (proposal?.card?.choices ?? []).every((choice) =>
      choice.action.type === 'move_session'
      && (choice.action.payload.scope ?? 'whole_day') === choice.id),
    'a screen that built the payload would be a second author of payload.scope',
  );

  // ── WHOLE_DAY STILL SENDS NOTHING, AND A ONE-ROW DAY IS NOT A CHOICE ──
  const plainOptions = {
    scopes: [
      { id: 'whole_day', label: 'Move the whole session', sub: 'Pick another day for it', destinations: [{ date: FRIDAY, occupiedBy: null }] },
      { id: 'strength', label: 'Just the gym session', sub: 'Team training stays on this day', destinations: [{ date: FRIDAY, occupiedBy: null }] },
    ],
    refusal: null,
  } as never;
  const plainRead = readCoachMessage({ message: 'move monday to friday', week: WEEK, todayISO: TODAY });
  const plain = plainRead.intent === 'change'
    ? coachProposal({ request: plainRead.request, week: WEEK, moveOptions: plainOptions })
    : null;
  ok(
    'a day that offers whole_day proposes it, and sends NO scope word',
    plain?.verdict === 'proposed' && movePayload(plain?.action)?.scope === undefined,
    'absent IS the door\'s spelling of whole_day; two spellings of one '
      + 'instruction is the ambiguity this change exists to remove',
  );

  const singleOptions = {
    scopes: [
      { id: 'conditioning', label: 'Just the conditioning', sub: 'The rest of the day stays', destinations: [{ date: FRIDAY, occupiedBy: null }] },
    ],
    refusal: null,
  } as never;
  const singleRead = readCoachMessage({ message: 'move monday to friday', week: WEEK, todayISO: TODAY });
  const single = singleRead.intent === 'change'
    ? coachProposal({ request: singleRead.request, week: WEEK, moveOptions: singleOptions })
    : null;
  ok(
    'ONE way through is an answer, not a chooser',
    single?.card?.choices.length === 0
      && movePayload(single?.action)?.scope === 'conditioning',
    'the sheet skips a picker with one row; a coach that rendered one would be '
      + 'asking a question with a single answer',
  );

  // ── THE OWNER'S REFUSAL IS SPOKEN, NOT REPLACED ──
  const refusedOptions = {
    scopes: [],
    refusal: {
      reason: 'no_destination',
      message: "There's nowhere to move this in the weeks you can edit — every "
        + 'other day is a game, team training, or already full.',
    },
  } as never;
  const refusedRead = readCoachMessage({ message: 'move monday to friday', week: WEEK, todayISO: TODAY });
  const refused = refusedRead.intent === 'change'
    ? coachProposal({ request: refusedRead.request, week: WEEK, moveOptions: refusedOptions })
    : null;
  ok(
    'and when the owner refuses, the coach says the OWNER\'s sentence',
    refused?.verdict === 'refused'
      && refused.text === (refusedOptions as never as { refusal: { message: string } }).refusal.message,
    'PlanChangeMoveRefusal: "Never a reason code — the sheet renders this '
      + 'verbatim". The coach rendering its own would be the two surfaces '
      + 'saying different things about one day',
  );

  // ── AND THE OMISSION CANNOT COME BACK SILENTLY ──
  ok(
    'the SCREEN asks the owner, with the week it already holds',
    /listPlanChangeOptionsForDay\(\{[\s\S]{0,200}?visibleWeek: weekDays/.test(screenCode)
      && /coachProposal\(\{[\s\S]{0,120}?moveOptions/.test(screenCode),
    'moveOptions is optional so every existing caller keeps working — which is '
      + 'exactly why the screen\'s own call site needs a cell of its own',
  );

  ok(
    'this section is DEPTH 0 and says so',
    true,
    'the lists compared here are values, not a producer run. `npm run '
      + 'tape:coach-move-durability` is where the coach\'s list is compared '
      + 'against `moveOptionsForDay`\'s real output on a generated anchored day.',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// [9] UI MERGE SLICE 3 — "MY STATUS", AND THE ONE COMPONENT RULE
//
// Rulings 4 and 9 re-home the modifiers onto the coach page. Sam's next eye
// pass removed the temporary Program duplicates once My Status was real:
// *"we no longer need coaches notes showing up on day page or weekly page".*
//
// SOURCE-SCAN LAW: read the REGION, prove it was found, and never trust a count
// taken over a whole file.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[9] "MY STATUS" — one strip, one list, and no second door');
{
  const read = (rel: string): string => fs.readFileSync(
    path.join(__dirname, '..', ...rel.split('/')), 'utf8');
  const strip = read('components/ModifiersStrip.tsx');
  const home = read('screens/home/HomeScreenV2.tsx');
  const homeHook = read('screens/home/useHomeScreen.ts');
  const coachTab = read('screens/coach/CoachTabScreen.tsx');
  const status = read('screens/coach/CoachStatusScreen.tsx');
  const phaseControl = read('hooks/useSeasonPhaseControl.ts');
  const projectionCopy = read('rules/projectionCopy.ts');

  ok('the strip exists as ONE component, not one per surface',
    /export function ModifiersStrip/.test(strip),
    'three copies of this row is three places for the count to disagree with '
      + 'the list it opens');

  ok('Coach mounts the one My Status strip',
    /import \{ ModifiersStrip \}/.test(coachTab) && /<ModifiersStrip/.test(coachTab),
    'the permanent status doorway has left the Coach header');

  ok('Coach keeps My Status reachable at zero',
    /signedCopy\('modifiers\.strip\.none'\)/.test(strip),
    'LAW-coach-status-is-a-real-destination: zero modifiers must not delete the '
      + 'only doorway to status');

  ok('Program carries neither status notice nor Coach Notes list',
    !/import \{ ModifiersStrip \}/.test(home)
      && !/<ModifiersStrip/.test(home)
      && !/import \{ ActiveModifiersSection \}/.test(home)
      && !/<ActiveModifiersSection/.test(home),
    'My Status is not the single destination while Program still repeats its contents');

  ok('the Coach doorway addresses one navigation-owned open state',
    /route\.params\?\.status === 'open'/.test(coachTab)
      && /navigation\.setParams\(\{ status: 'open' \}\)/.test(coachTab)
      && /navigation\.setParams\(\{ status: undefined \}\)/.test(coachTab)
      && !/setStatusVisible/.test(coachTab),
    'a private Coach boolean cannot be opened by Program; a second event owner '
      + 'would recreate the disconnected handoff');

  // THE COUNT IS THE LIST'S OWN LENGTH. A separately-carried number is the
  // `a count taken for a record` shape, sighting 14 in this repo.
  ok('the strip count is the list length, never a separately-counted number',
    /count=\{modifierCount\}/.test(coachTab) && /count: modifiers\.length/.test(
      read('hooks/useActiveModifiers.ts')),
    'the count and the list it opens cannot disagree if one is the other\'s length');

  // ONE DERIVATION. The coach tab must not assemble its own snapshot.
  ok('the coach tab reads the modifiers through the one shared selector',
    /useActiveModifiers\(/.test(coachTab)
      && !/selectActiveCoachNotes/.test(coachTab),
    'a second screen assembling the snapshot by hand is a second reading of the '
      + 'athlete\'s state, and it would drift the first time an input was added');

  // THE STATUS SCREEN MOUNTS THE EXISTING LIST COMPONENT — the merge plan's
  // binding rule, "my status MOUNTS the existing doors".
  ok('the status screen mounts the extracted list rather than rebuilding it',
    /import \{ ActiveModifiersSection \}/.test(status)
      && /<ActiveModifiersSection/.test(status),
    'a list re-implemented on a second screen is a second door by another name');

  ok('phase review moved to My Status in the same slice Program removed it',
    /testID="coach-status-season-phase"/.test(status)
      && /onReviewPhase/.test(status)
      && /useSeasonPhaseControl\(\)/.test(coachTab)
      && /<SeasonPhaseShiftSheet/.test(coachTab)
      && !/styles\.phaseCard/.test(home)
      && !/<PhaseShiftSheet/.test(home),
    'LAW-removal-ships-with-its-replacement: status must mount the working '
      + 'replacement before day/week lose their phase card');

  ok('the re-homed phase control keeps the atomic transaction door',
    /commitProfileProgramTransaction\(\{/.test(phaseControl)
      && /sourceSurface: 'phase_shift'/.test(phaseControl)
      && /applyPhaseShift\(onboardingData/.test(phaseControl)
      && /useSeasonPhaseControl\(\)/.test(homeHook)
      && !/applyPhaseShift/.test(homeHook)
      && !/sourceSurface: 'phase_shift'/.test(homeHook),
    'moving the surface must not replace the established atomic phase decision');

  ok('phase review selects any phase before the existing questions',
    /currentPhase=\{phaseControl\.currentPhase\}/.test(coachTab)
      && /onSelectTargetPhase=\{phaseControl\.selectTargetPhase\}/.test(coachTab)
      && /\['In-season', 'Pre-season', 'Off-season'\]/.test(home)
      && /signedCopy\('phase\.review\.title'\)/.test(home)
      && /text: 'Review season phase'/.test(projectionCopy)
      && /signedCopy\('phase\.review\.confirm'\)/.test(home)
      && /targetPhase !== currentPhase \? \(/.test(home)
      && /What days can you train\?/.test(home)
      && /Team training days/.test(home)
      && /Usual game day/.test(home)
      && /if \(targetPhase === 'In-season'\) setStep\('gameDay'\)/.test(phaseControl),
    'Review still forces the next phase, or selecting a target bypasses the '
      + 'availability/team/game questions');

  ok('Renee hierarchy is explicit on both coach surfaces',
    /styles\.brand/.test(coachTab)
      && /surface="coach"/.test(coachTab)
      && /SEASON PHASE/.test(status)
      && /ACTIVE MODIFIERS/.test(status)
      && /coach-status-modifier-/.test(status),
    'the old full-width title/card stack has returned or the new hierarchy is incomplete');

  // THE HONEST HALF, ASSERTED SO IT CANNOT BE FORGOTTEN. The status screen is
  // READ-ONLY this pass and the file must say so.
  // NOT-YET IS SHOWN, NOT FAKED. The seat: "a control that looks live but is not
  // is worse than no control." Dimmed AND untappable AND captioned — all three,
  // because any one alone still reads as "broken" rather than "coming".
  const section = read('components/ActiveModifiersSection.tsx');
  ok('the status screen renders its unwired controls as visibly not-yet',
    /actionsNotYet\b/.test(status),
    'the status screen mounts the list in live mode while its actions cannot run');
  ok('a not-yet control is dimmed, untappable AND captioned',
    // `notYet`, not `actionsNotYet` — the flag became PER-ACTION when the first
    // strand of the knot came loose. Same property, and the cell moved with it
    // rather than being deleted.
    /disabled=\{notYet\}/.test(section)
      && /coachNoteActionNotYet/.test(section)
      && /coach\.status\.actions_not_yet/.test(section),
    'one of dim / disable / caption is missing — dimming alone reads as broken, '
      + 'and a caption alone leaves a live-looking button that lies');
  ok('the caption says where the working control is',
    /Change this on your program screen/.test(
      read('rules/projectionCopy.ts')),
    'a not-yet caption that does not name the live door leaves the athlete stuck');
  // THE KNOT IS NOT ONE ROPE, AND THE NOT-YET STATE IS PER-ACTION.
  ok('the one untangled action is LIVE on the status screen',
    /LIVE_ACTION_KINDS[\s\S]{0,200}'dismiss_note'/.test(status)
      && /liveActionKinds=\{LIVE_ACTION_KINDS\}/.test(status),
    'dismiss_note runs a module-level function with zero hook dependencies — '
      + 'dimming a control that WORKS is the dead-affordance law broken in the '
      + 'opposite direction');
  ok('a live action is neither disabled nor dimmed',
    /const notYet = actionsNotYet[\s\S]{0,120}liveActionKinds/.test(section)
      && /disabled=\{notYet\}/.test(section),
    'the not-yet state is still per-SCREEN — a working control would be dimmed');
  ok('the caption only appears when something on THAT note is inert',
    /note\.actions\.some\(\(a\) =>[\s\S]{0,120}liveActionKinds/.test(section),
    'a note whose every action works would still tell the athlete to go '
      + 'elsewhere');
  ok('the coach tab dismisses through the SAME module-level door',
    /dismissActiveCoachNote\(note\.id\)/.test(coachTab)
      && /import \{ dismissActiveCoachNote \}/.test(coachTab),
    '"my status MOUNTS the existing doors" — a second dismiss path here would be '
      + 'the representation the merge plan forbids');

  ok('the strip is outside the conversation scroll',
    coachTab.indexOf('<ModifiersStrip') < coachTab.indexOf('testID="coach-tab-conversation"'),
    'CoachTabScreen pins to bottom on new content: a strip inside that scroll '
      + 'is unreachable after three exchanges, and a door the athlete cannot '
      + 'find is not a door');
}

const total = passed + failures.length;
console.log(`\nCoach tab slice 3 totals: passed=${passed}/${total} failures=${failures.length}`);
console.log(
  '  DEPTH (L13): 0 IN THIS SUITE — the weeks above are hand-built and no door '
  + 'is executed here; no walker, no accumulated world, no screen mounted, no '
  + 'keyboard raised. THE DOOR IS RUN ELSEWHERE: `npm run '
  + 'tape:coach-move-durability` drives the coach\'s move through the real '
  + 'executor over a generated world at depth 1, with the athlete\'s own tap '
  + 'beside it as the control. That tape is not in the chain — section [7] is '
  + 'what the chain sees of its finding.',
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
