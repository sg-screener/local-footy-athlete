/**
 * COACH REBUILD, SLICE 2 — IT ANSWERS FROM THE BRAIN, AND IT STILL CHANGES
 * NOTHING.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S2. Five claims, each with its own
 * way of going wrong, which is why they are five sections:
 *
 *   - **THE VOCABULARY DEGRADES INTO A COPY.** "Re-pointed, not rewritten" is
 *     satisfied on day one by three string literals that happen to match the
 *     frozen union, and is broken on day two by a rename nobody notices. [1]
 *     pins the narrowing to the salvage union's own declaration.
 *   - **THE READER DEGRADES INTO GUESSING.** The cheap way to make a coach look
 *     clever is to answer when unsure. [2] pins what it REFUSES as hard as what
 *     it recognises, because the refusals are the read-only boundary.
 *   - **THE ANSWER DEGRADES INTO COMPOSITION** — the same failure ruling 1
 *     retired `summariseDay` for, one slice later. [3] proves every training
 *     word in an answer came out of the projection.
 *   - **THE TRUTH GATE DEGRADES INTO DECORATION.** A validator that is called
 *     but can never fail is worse than none, because it reads like protection.
 *     [4] makes it BITE on a real answer and proves the honest sentence
 *     replaces the refused one.
 *   - **READ-ONLY DEGRADES BY ONE IMPORT,** now one hop further out than slice
 *     1 could see. [5].
 *
 * WHAT THIS SUITE CANNOT DO, said here rather than in the report: no screen is
 * mounted and no athlete is walked. Sections [2], [3] and [4] execute the pure
 * derivations over hand-built weeks; [1] and [5] read SOURCE. **Whether the
 * coach answers a question Sam actually types is Sam's eye and a device, and
 * nothing here claims it.**
 *
 * Run: npm run test:coach-tab-slice2
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { coachAnswer } from '../rules/coachAnswer';
import { lexicalQuestionReader } from '../rules/coachQuestion';
import type { CoachAnswerableKind } from '../rules/coachQuestion';
import { COACH_ANSWER_COPY, COACH_OPENER_COPY, COACH_TAB_COPY } from '../rules/coachTabCopy';
import { coachOpener } from '../rules/coachOpener';
import { FORBIDDEN_WHEN_NO_APPLIED } from '../utils/verifiedCoachCommunication';
import type { SignedCopy } from '../rules/signedCopy';
import type {
  VisibleDay,
  VisibleDayKind,
  VisibleWeek,
} from '../rules/visibleProjection';

const SRC = path.resolve(__dirname, '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(SRC, ...parts), 'utf8');
const stripComments = (source: string) =>
  source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

const questionSource = read('rules', 'coachQuestion.ts');
const questionCode = stripComments(questionSource);
const answerSource = read('rules', 'coachAnswer.ts');
const answerCode = stripComments(answerSource);
const intentSource = read('utils', 'coachIntent.ts');

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

// ─── THE WORLD THE SECTIONS BELOW SHARE ──────────────────────────────────────

const signed = (text: string) => text as unknown as SignedCopy;

function day(
  date: string,
  kind: VisibleDayKind,
  buckets: readonly string[],
): VisibleDay {
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
        canMove: false, canRemove: false, canSwap: false, canEditRows: false,
      } as VisibleDay['parts'][number]['capabilities'],
      countsTowardLoad: true,
    })) as VisibleDay['parts'],
    capabilities: {
      canAdd: false, canMoveWholeDay: false, canRemoveWholeDay: false, refusal: null,
    } as VisibleDay['capabilities'],
    owner: 'generation' as VisibleDay['owner'],
  };
}

// Monday 2026-08-10 .. Sunday 2026-08-16. Saturday is the fixture.
const WEEK: VisibleWeek = {
  weekStart: '2026-08-10',
  days: [
    day('2026-08-10', 'training', ['Strength']),
    day('2026-08-11', 'training', ['Conditioning']),
    day('2026-08-12', 'rest', []),
    day('2026-08-13', 'training', ['Upper Push', 'Easy Aerobic Flush']),
    day('2026-08-14', 'rest', []),
    day('2026-08-15', 'game', []),
    day('2026-08-16', 'rest', []),
  ],
};
const MONDAY = '2026-08-10';

const ask = (message: string, todayISO = MONDAY) =>
  lexicalQuestionReader.read({ message, week: WEEK, todayISO });
const answer = (message: string, todayISO = MONDAY) =>
  coachAnswer({ question: ask(message, todayISO), week: WEEK, todayISO });

console.log('\n[0] The subjects were found — nothing below is claimed about an empty string');
{
  ok('the reader source was read and is substantial', questionSource.length > 4000, questionSource.length);
  ok('and its stripped code is substantial, not comment-only', questionCode.length > 1500, questionCode.length);
  ok('the answer source was read', answerSource.length > 4000, answerSource.length);
  ok('and its stripped code is substantial', answerCode.length > 1500, answerCode.length);
  ok('the salvage intent module was read', intentSource.length > 10000, intentSource.length);
}

// ─── [1] THE VOCABULARY IS THE SALVAGE LAYER'S ───────────────────────────────

console.log('\n[1] RE-POINTED, NOT REWRITTEN — the question kinds are the frozen union\'s');
{
  // TYPE-LEVEL, and it is the strongest cell in this section even though it
  // prints nothing at runtime: this assignment only compiles while
  // `CoachAnswerableKind` really is a subset of the frozen union. Delete the
  // `Extract` and widen the type, and `tsc` reds.
  const narrowed: CoachAnswerableKind = 'program_explanation';
  ok('the narrowed kind is inhabited', narrowed === 'program_explanation');

  ok(
    'the narrowing is an Extract over the salvage union, not a fresh literal set',
    /Extract<\s*CoachIntentKind/.test(questionCode)
      && /import type \{ CoachIntentKind \} from '\.\.\/utils\/coachIntent'/.test(questionCode),
    'three matching literals satisfy "re-pointed" on day one and stop being '
      + 'true the day somebody renames one upstream',
  );

  // AND THE UPSTREAM UNION REALLY DECLARES THEM. The type is erased at runtime,
  // so this is a source scan — and it is anchored before it counts, because a
  // `slice` between two markers that both missed returns something a regex is
  // happy to pass over.
  const unionStart = intentSource.indexOf('export type CoachIntentKind =');
  const unionEnd = intentSource.indexOf(';', unionStart);
  const union = unionStart >= 0 && unionEnd > unionStart
    ? intentSource.slice(unionStart, unionEnd)
    : '';
  ok(
    'the CoachIntentKind declaration was located and holds its whole union',
    union.length > 200 && /general_question/.test(union) && union.split('|').length >= 15,
    `${union.length} chars, ${union.split('|').length - 1} members`,
  );
  for (const kind of ['program_explanation', 'session_mismatch_question', 'general_question']) {
    ok(
      `the frozen union still declares '${kind}'`,
      new RegExp(`\\|\\s*'${kind}'`).test(union),
      'the narrowing names it; if the union stops declaring it the type is a '
        + 'lie the compiler catches, and this cell says which one moved',
    );
  }

  // THE TARGET IS A DATE, AND NOTHING ELSE. `decisionLedger.ts:9-11`.
  ok(
    'the reader resolves a DATE and never a session or item id',
    /targetDateISO/.test(questionCode)
      && !/targetItemId|sessionId|itemId/.test(questionCode),
    'a derived id drifts across engine versions; a date does not',
  );
}

// ─── [2] THE READER — WHAT IT PLACES, AND WHAT IT REFUSES ────────────────────

console.log('\n[2] THE READER — positive recognition, and the refusals are the boundary');
{
  const friday = ask('what am I doing friday?');
  ok('a day question resolves to that day in the week',
    friday.subject === 'day_work' && friday.targetDateISO === '2026-08-14',
    JSON.stringify(friday));
  ok('and it carries a kind from the salvage vocabulary',
    friday.kind === 'program_explanation', friday.kind);

  ok('"today" resolves through the week, not by assumption',
    ask('whats on today?').targetDateISO === MONDAY,
    JSON.stringify(ask('whats on today?')));
  ok('"tomorrow" resolves to the next day in the week',
    ask('what am I training tomorrow?').targetDateISO === '2026-08-11',
    JSON.stringify(ask('what am I training tomorrow?')));

  ok('a bare day reference is itself enough of a subject',
    ask('what about wednesday?').subject === 'day_work'
      && ask('what about wednesday?').targetDateISO === '2026-08-12',
    JSON.stringify(ask('what about wednesday?')));

  ok('the fixture question is recognised as its own subject',
    ask("when's my next game?").subject === 'next_game',
    JSON.stringify(ask("when's my next game?")));
  ok('and a week question is recognised as its own subject',
    ask('what does this week look like?').subject === 'week_shape',
    JSON.stringify(ask('what does this week look like?')));

  // ── THE REFUSALS. Each of these is a message the coach must NOT answer, and
  // together they are the read-only boundary expressed in the reader itself.
  const REFUSED: ReadonlyArray<readonly [string, string]> = [
    ['move friday\'s session to sunday', 'a mutation request is not a question'],
    ['swap the deadlifts for something else', 'a mutation request with no question mark'],
    ['', 'an empty message'],
    ['hello', 'a greeting'],
    ['my calf is sore', 'a fact report — S3/S4 territory, not slice 2'],
    ['what am I doing?', 'a day question that names no day — guessing "today" '
      + 'would be answering a question nobody asked'],
  ];
  for (const [message, why] of REFUSED) {
    const result = ask(message);
    ok(
      `refused, and the coach will say it does not know: "${message}" (${why})`,
      result.subject === 'unknown' && result.targetDateISO === null,
      JSON.stringify(result),
    );
  }

  // ── A DAY THE COACH CANNOT SEE IS DISTINCT FROM A DAY IT WAS NOT GIVEN.
  const shortWeek: VisibleWeek = { weekStart: '2026-08-10', days: WEEK.days.slice(0, 3) };
  const outside = lexicalQuestionReader.read({
    message: 'what am I doing saturday?', week: shortWeek, todayISO: MONDAY,
  });
  ok(
    'a named day outside the visible week is flagged, not silently dropped',
    outside.subject === 'day_work' && outside.targetDateISO === null && outside.outOfWeek,
    JSON.stringify(outside),
  );

  // AND THE LOOKUP GOES THROUGH THE WEEK RATHER THAN THROUGH ARITHMETIC. This
  // is the cell that reds if somebody ever computes "next Friday" from a clock:
  // the same word against two different weeks must give two different answers.
  const otherWeek: VisibleWeek = {
    weekStart: '2026-08-17',
    days: [day('2026-08-21', 'training', ['Strength'])],
  };
  const fridayElsewhere = lexicalQuestionReader.read({
    message: 'friday?', week: otherWeek, todayISO: '2026-08-17',
  });
  ok(
    'the same weekday word resolves to whichever Friday the given week holds',
    fridayElsewhere.targetDateISO === '2026-08-21'
      && friday.targetDateISO === '2026-08-14',
    `${fridayElsewhere.targetDateISO} vs ${friday.targetDateISO}`,
  );
}

// ─── [3] THE ANSWER — EVERY TRAINING WORD CAME OUT OF THE PROJECTION ─────────

console.log('\n[3] THE ANSWER — derived, short, and grounded in days that exist');
{
  const thursday = answer('what am I doing thursday?');
  ok('a day with parts is answered with the parts\' own headlines',
    thursday.text === 'Thursday: Upper Push, Easy Aerobic Flush.',
    thursday.text);
  ok('and its grounds name that day and those parts',
    thursday.verdict === 'answered'
      && JSON.stringify(thursday.grounds.dates) === JSON.stringify(['2026-08-13'])
      && JSON.stringify(thursday.grounds.usedProjectionNames)
        === JSON.stringify(['Upper Push', 'Easy Aerobic Flush']),
    JSON.stringify(thursday.grounds));

  // NO BRANCH ON DAY KIND. A rest day and a game day are answered by the same
  // three lines, using the name the PROJECTION gave them.
  ok('a rest day is answered with the name the projection gave it',
    answer('what about friday?').text === 'Friday: Rest Day.',
    answer('what about friday?').text);
  ok('and a fixture day likewise',
    answer('what about saturday?').text === 'Saturday: Game Day.',
    answer('what about saturday?').text);

  ok('the fixture question names the day the game is on',
    answer("when's my next game?").text === 'Game Saturday.',
    answer("when's my next game?").text);

  // AND IT IS NOT THE OPENER'S FIXTURE RULE. The opener suppresses a game that
  // is today or tomorrow because its day clause already names it; an athlete
  // who ASKS must be told anyway.
  const eveOfGame = coachAnswer({
    question: lexicalQuestionReader.read({
      message: "when's my next game?", week: WEEK, todayISO: '2026-08-14',
    }),
    week: WEEK,
    todayISO: '2026-08-14',
  });
  ok(
    'a game tomorrow is still named when the athlete asks for it',
    eveOfGame.text === 'Game Saturday.'
      && coachOpener({ week: WEEK, todayISO: '2026-08-14' }).grounds.nextFixture === null,
    `${eveOfGame.text} | opener fixture is suppressed as designed`,
  );

  const noFixture: VisibleWeek = {
    weekStart: '2026-08-10',
    days: WEEK.days.filter((d) => d.kind !== 'game'),
  };
  ok(
    'a week with no fixture gets the honest sentence about what the coach can see',
    coachAnswer({
      question: lexicalQuestionReader.read({
        message: "when's my next game?", week: noFixture, todayISO: MONDAY,
      }),
      week: noFixture,
      todayISO: MONDAY,
    }).text === COACH_ANSWER_COPY.noGameInWeek,
  );

  // THE WEEK QUESTION IS THE OPENER, BYTE FOR BYTE. A second week summary would
  // be two accounts of one week inside one screen.
  const weekAnswer = answer('what does this week look like?');
  ok(
    'the week question is answered with the opener\'s own sentence',
    weekAnswer.text === coachOpener({ week: WEEK, todayISO: MONDAY }).text,
    weekAnswer.text,
  );

  // L-C1 AS AN ASSERTION RATHER THAN A HOPE, the slice-1 cell carried forward:
  // every day an answer names must be a day in the week it was given.
  const grounded = [
    answer('what am I doing thursday?'),
    answer("when's my next game?"),
    answer('what does this week look like?'),
  ];
  ok(
    'every date in every answer\'s grounds is a day in the week it was given',
    grounded.every((entry) => entry.grounds.dates.every(
      (date) => WEEK.days.some((d) => d.date === date),
    )),
    grounded.map((entry) => entry.grounds.dates.join('+')).join(' | '),
  );
  ok(
    'and every projection name in the grounds actually appears in the sentence',
    grounded.every((entry) => entry.grounds.usedProjectionNames.every(
      (name) => entry.text.includes(name),
    )),
    'grounds that do not appear in the text are a receipt for a different '
      + 'sentence, which is worse than no receipt',
  );

  // THE HONEST FLOOR — and the answering rule owns the words, not the screen.
  ok(
    'an unrecognised message gets the honest no-answer from the RULE',
    answer('move friday to sunday').text === COACH_TAB_COPY.noAnswerYet
      && answer('move friday to sunday').verdict === 'no_rule',
    answer('move friday to sunday').verdict,
  );
  ok(
    'and a day it cannot see gets its own, different admission',
    coachAnswer({
      question: lexicalQuestionReader.read({
        message: 'what about saturday?',
        week: { weekStart: '2026-08-10', days: WEEK.days.slice(0, 3) },
        todayISO: MONDAY,
      }),
      week: { weekStart: '2026-08-10', days: WEEK.days.slice(0, 3) },
      todayISO: MONDAY,
    }).text === COACH_ANSWER_COPY.dayNotInWeek,
    '"I can only see this week" and "I don\'t have an answer" are different '
      + 'admissions and the athlete deserves the true one',
  );

  // SHORT IS THE RULING, SO SHORT IS A CELL (Sam: "get to the point").
  const longest = Math.max(...WEEK.days.map(
    (d) => answer(`what about ${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${d.date}T00:00:00Z`).getUTCDay()]}?`).text.length,
  ));
  ok('the longest day answer over the whole week is under 80 characters',
    longest < 80, longest);
}

// ─── [4] THE TRUTH GATE BITES ────────────────────────────────────────────────

console.log('\n[4] THE TRUTH GATE — re-pointed salvage, and it can actually fail');
{
  ok(
    'every answer is validated by the salvage truth gate',
    /validateCoachCommunicationTruth\(/.test(answerCode)
      && /from '\.\.\/utils\/verifiedCoachCommunication'/.test(answerCode),
    'the module that exists because the coach once claimed a change it had not '
      + 'made is the right one to hold the mouth shut while slice 2 makes none',
  );
  ok(
    'and it is validated against a communication with NOTHING applied',
    /appliedChanges: \[\]/.test(answerCode)
      && /canSayProgramUpdated: false/.test(answerCode),
    'canSayProgramUpdated:false is what arms FORBIDDEN_WHEN_NO_APPLIED',
  );
  ok(
    'the gate runs on the ONE exit, so no arm can bypass it',
    /return gate\(draft\);/.test(answerCode)
      && (answerCode.match(/function gate\(/g) ?? []).length === 1,
    'a second exit is how a validator becomes decoration',
  );

  // ── AND IT BITES, PROVEN ON A REAL ANSWER RATHER THAN ON THE VALIDATOR.
  //
  // A cell that called `validateCoachCommunicationTruth` itself would prove the
  // validator works, which was never in doubt — it has 58 cells of its own. The
  // claim here is that slice 2's answers GO THROUGH it. So the projection is
  // given a part whose headline is a forbidden claim, the answer is built from
  // that headline exactly as it would build any other, and the reply that comes
  // back must be the honest sentence instead.
  const lyingWeek: VisibleWeek = {
    weekStart: '2026-08-10',
    days: [day('2026-08-10', 'training', ['I adjusted your week'])],
  };
  const refused = coachAnswer({
    question: lexicalQuestionReader.read({
      message: 'what am I doing monday?', week: lyingWeek, todayISO: MONDAY,
    }),
    week: lyingWeek,
    todayISO: MONDAY,
  });
  ok(
    'a reply that would claim a change is REFUSED and replaced, not repaired',
    refused.verdict === 'refused'
      && refused.text === COACH_TAB_COPY.noAnswerYet
      && refused.violations.length > 0,
    `${refused.verdict} | ${refused.text} | ${refused.violations.join(', ')}`,
  );
  ok(
    'and the refusal names which forbidden claim it caught',
    refused.violations.some((violation) => /forbidden claim/.test(violation)),
    refused.violations.join(', '),
  );
  ok(
    'a refused answer carries no grounds — it is not a half-answer',
    refused.grounds.dates.length === 0
      && refused.grounds.usedProjectionNames.length === 0,
    JSON.stringify(refused.grounds),
  );

  // THE CONTROL, because a gate that refuses everything is not a gate. The same
  // week with an ordinary headline must answer normally.
  const honestWeek: VisibleWeek = {
    weekStart: '2026-08-10',
    days: [day('2026-08-10', 'training', ['Lower Squat'])],
  };
  const allowed = coachAnswer({
    question: lexicalQuestionReader.read({
      message: 'what am I doing monday?', week: honestWeek, todayISO: MONDAY,
    }),
    week: honestWeek,
    todayISO: MONDAY,
  });
  ok(
    'and an ordinary answer passes the same gate untouched',
    allowed.verdict === 'answered' && allowed.text === 'Monday: Lower Squat.',
    `${allowed.verdict} | ${allowed.text}`,
  );

  // NO ANSWER SLICE 2 CAN PRODUCE CONTAINS A FORBIDDEN CLAIM. The sweep is over
  // every answer the whole week can produce, so it covers the honest sentences
  // and the derived ones together.
  const everyAnswer = [
    ...WEEK.days.map((d) => answer(`what about ${d.date.slice(8)}?`)),
    ...['what am I doing thursday?', "when's my next game?",
      'what does this week look like?', 'hello', 'move friday to sunday',
    ].map((message) => answer(message)),
  ];
  const offending = everyAnswer.filter((entry) =>
    FORBIDDEN_WHEN_NO_APPLIED.some((pattern) => pattern.test(entry.text)));
  ok(
    'no answer slice 2 can produce contains a mutation claim',
    offending.length === 0,
    offending.map((entry) => entry.text).join(' | '),
  );
}

// ─── [5] READ-ONLY, ONE HOP OUT ──────────────────────────────────────────────

console.log('\n[5] READ-ONLY — the answering layer cannot reach a writer either');
{
  const FORBIDDEN: ReadonlyArray<{ readonly pattern: RegExp; readonly why: string }> = [
    { pattern: /from '[^']*\/store\//, why: 'a zustand store is a writer with a getter attached' },
    { pattern: /programControlActions/, why: 'the door S3 will use, behind the change card' },
    { pattern: /decisionLedger/, why: 'appending a decision is a mutation that reads like a log' },
    { pattern: /Transaction/, why: 'accepted-state transactions are the write path' },
    { pattern: /coachActions|coachTurnController|coachCommand|coachProgramEdit/, why: 'the frozen beta pipeline (LR-6)' },
    { pattern: /applyProgramAdjustment|weekRebuild|generateProgram/, why: 'generation and adjustment writers' },
    { pattern: /AsyncStorage|persist/, why: 'slice 2 stores nothing — an answer is not a record' },
  ];
  // THE BLOCK IS PROVEN FOUND BY A KNOWN MEMBER, NOT BY A COUNT. A threshold
  // is the wrong instrument here twice over: `coachQuestion` has exactly ONE
  // runtime import because its other two are `import type` and erased, so a
  // count both fails on a correct module and would pass on an empty match if
  // the regex ever stopped matching the shape.
  const EXPECTED_MEMBER: Readonly<Record<string, RegExp>> = {
    coachQuestion: /from '\.\.\/utils\/appDate'/,
    coachAnswer: /from '\.\.\/utils\/verifiedCoachCommunication'/,
  };
  for (const [label, code] of [['coachQuestion', questionCode], ['coachAnswer', answerCode]] as const) {
    const imports = code.match(/^import(?!\s+type\s)[\s\S]*?from\s+'[^']+';/gm) ?? [];
    ok(
      `${label}'s runtime import block was located and holds its known member`,
      imports.some((line) => EXPECTED_MEMBER[label].test(line)),
      imports.join(' | '),
    );
    for (const { pattern, why } of FORBIDDEN) {
      const offenders = imports.filter((line) => pattern.test(line));
      ok(
        `${label} imports nothing matching ${pattern} (${why})`,
        offenders.length === 0,
        offenders.join(' | '),
      );
    }
  }

  // AND NEITHER READS A CLOCK. `todayISO` is an argument, as it is for the
  // opener — the refusal `wornWorldBootTests` protects elsewhere, honoured here
  // because it costs nothing.
  ok('the reader invents no today', !/todayISOLocal|new Date\(\)/.test(questionCode));
  ok('the answering rule invents no today', !/todayISOLocal|new Date\(\)/.test(answerCode));

  // THE ABSENCE OF A VIOLATION IS NOT THE PRESENCE OF THE PRACTICE.
  ok(
    'the answering rule names days through the shared projection owner',
    /visibleDayLeadHeadline\(day\)/.test(answerCode),
    'ruling 1: the coach reads the same projection — the same call the week row '
      + 'and the opener make, not an equivalent rule',
  );
  ok(
    'and it composes no training noun of its own',
    !/'(Strength|Conditioning|Rest|Mobility|Speed|Game)/.test(answerCode),
    'a training word in this module is a word the projection did not authorise',
  );
}

// ─── [6] BATCH 31 ────────────────────────────────────────────────────────────

console.log('\n[6] BATCH 31 — one module owns every new word, and it is unruled');
{
  const copySource = read('rules', 'coachTabCopy.ts');
  ok('batch 31 declares itself PROPOSED',
    /BATCH 31[\s\S]{0,160}PROPOSED/.test(copySource),
    'Sam has not read these; a module claiming otherwise is a false provenance');
  ok('the answering rule reads its words from the batch, not its own literals',
    /COACH_ANSWER_COPY\./.test(answerCode)
      && !/'[:,]\s'/.test(answerCode),
    'a separator chosen at a call site is a call site authoring athlete text');
  ok('every batch-31 string is non-empty',
    Object.values(COACH_ANSWER_COPY)
      .every((value) => typeof value === 'string' && value.length > 0));
  ok('the answering rule reuses batch 30\'s full stop rather than declaring a second',
    /COACH_OPENER_COPY\.fullStop/.test(answerCode)
      && COACH_OPENER_COPY.fullStop === '.',
    'two full stops in two batches is two owners of one character');
}

const total = passed + failures.length;
console.log(`\nCoach tab slice 2 totals: passed=${passed}/${total} failures=${failures.length}`);
console.log(
  '  DEPTH (L13): 0 — the weeks above are hand-built. No walker run, no '
  + 'accumulated world, no screen mounted, no athlete walked.',
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
