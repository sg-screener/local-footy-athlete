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
import { describeVisibleDay } from '../rules/coachAnswer';
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
  ok(
    'an action this slice cannot draw returns no card',
    changeCardFor({
      action: { ...action, type: 'bin_session', payload: { date: FRIDAY } } as ProgramControlAction,
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
    /\{pending \? \([\s\S]{0,200}?\) : null\}\s*<View style=\{styles\.composer\}>/.test(screenCode),
    'a card that replaced the composer would be a modal without a dismiss',
  );

  // THE SCREEN STILL DECIDES NOTHING ABOUT WORDS.
  ok(
    'the card component composes no string of its own',
    !/>\s*[A-Za-z][A-Za-z ,'’.]{4,}\s*</.test(cardComponent)
      && (cardComponent.match(/\{card\./g) ?? []).length >= 5,
    'every string on the card came from changeCardFor',
  );

  // ── AND THE DEVICE HALF, NAMED SO IT CANNOT READ AS CLOSED ──
  ok(
    'this section is source placement and says so',
    true,
    'DEPTH 0 — no screen mounted, no keyboard raised, no tap made',
  );
}

const total = passed + failures.length;
console.log(`\nCoach tab slice 3 totals: passed=${passed}/${total} failures=${failures.length}`);
console.log(
  '  DEPTH (L13): 0 — the weeks above are hand-built and no door was executed. '
  + 'The change has never run against a real store, no walker was used, no '
  + 'accumulated world, no screen mounted, no keyboard raised.',
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
