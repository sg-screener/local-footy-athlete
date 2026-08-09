/**
 * COACH REBUILD, SLICE 1 — THE TAB TALKS AND CHANGES NOTHING.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S1. Four claims, and each one
 * degrades in its own way, which is why they are four sections rather than one:
 *
 *   - **READ-ONLY DEGRADES BY ONE IMPORT.** Nobody adds a mutation to a coach
 *     screen on purpose; they import a store to read something and then use it.
 *     [1] bans the imports rather than the writes, because "I did not write a
 *     mutation" is a claim about today and an import ban is a claim about every
 *     day after it.
 *   - **THE OPENER DEGRADES INTO COMPOSITION.** The first time the sentence
 *     needs a word the projection does not carry, the cheap fix is to format it
 *     on the screen — and that is ruling 1's `summariseDay` returning under a
 *     new name. [2] pins that the day's name in the coach's mouth is the SAME
 *     CALL the week row makes, and [3] proves the sentence over real shapes.
 *   - **THE NIKE BAR DEGRADES SILENTLY (L-C3).** A composer that stops riding
 *     the keyboard looks identical in source review and is only wrong on a
 *     phone. [4] pins the primitives whose absence causes it.
 *   - **A SECOND DESIGN LANGUAGE IS BORN ONE HEX AT A TIME** — the journal's
 *     style law, applied here on its first day rather than after the drift.
 *
 * WHAT THIS SUITE CANNOT DO, said here rather than in the report: this repo
 * ships no native renderer. Sections [1], [2], [4] and [5] read SOURCE. Section
 * [3] is the only one that executes anything, and what it executes is the pure
 * derivation — never the screen. **Whether the composer is actually reachable
 * with the keypad up is Sam's eye and a device, and nothing here claims it.**
 *
 * Run: npm run test:coach-tab-slice1
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { coachOpener, coachOpenerGrounds } from '../rules/coachOpener';
import { COACH_OPENER_COPY, COACH_TAB_COPY } from '../rules/coachTabCopy';
import { WEEKDAY_NAMES, shortWeekdayDateLabel, weekdayName } from '../utils/appDate';
import { visibleDayLeadHeadline } from '../rules/visibleDayDetail';
import type { SignedCopy } from '../rules/signedCopy';
import type {
  VisibleDay,
  VisibleDayKind,
  VisibleWeek,
} from '../rules/visibleProjection';

const SRC = path.resolve(__dirname, '..');
const read = (...parts: string[]) => fs.readFileSync(path.join(SRC, ...parts), 'utf8');

/** Comment lines stripped: a note is output, never evidence. */
const stripComments = (source: string) =>
  source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

const SCREEN_PATH = ['screens', 'coach', 'CoachTabScreen.tsx'] as const;
const screenSource = read(...SCREEN_PATH);
const screenCode = stripComments(screenSource);
const openerSource = read('rules', 'coachOpener.ts');
const openerCode = stripComments(openerSource);
const navigator = stripComments(read('navigation', 'AppNavigator.tsx'));

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

console.log('\n[0] The subjects were found — nothing below is claimed about an empty string');
{
  ok('the screen source was read and is substantial', screenSource.length > 4000, screenSource.length);
  ok('and its stripped code is substantial, not comment-only', screenCode.length > 2000, screenCode.length);
  ok('the opener rule source was read', openerSource.length > 2000, openerSource.length);
  ok('the navigator source was read', navigator.length > 2000, navigator.length);
}

// ─── [1] ZERO MUTATION PATHS, ENFORCED AT THE IMPORT ─────────────────────────

console.log('\n[1] READ-ONLY — the screen cannot reach a writer');
{
  const imports = screenCode.match(/^import[\s\S]*?from\s+'[^']+';/gm) ?? [];
  ok('the import block was located', imports.length >= 8, imports.length);

  // Every module family that can change the athlete's world. The list is
  // FAMILIES rather than names on purpose: a ban on `programStore` is one
  // rename from useless, a ban on `store/` is not.
  const FORBIDDEN: ReadonlyArray<{ readonly pattern: RegExp; readonly why: string }> = [
    { pattern: /from '[^']*\/store\//, why: 'a zustand store is a writer with a getter attached' },
    { pattern: /programControlActions/, why: 'the door that executes a ProgramControlAction (S3, behind the change card)' },
    { pattern: /decisionLedger/, why: 'appending a decision is a mutation even when it reads like a log' },
    { pattern: /Transaction/, why: 'accepted-state transactions are the write path' },
    { pattern: /coachActions|coachTurnController|coachCommand/, why: 'the frozen beta pipeline (LR-6)' },
    { pattern: /applyProgramAdjustment|weekRebuild|generateProgram/, why: 'generation and adjustment writers' },
    { pattern: /AsyncStorage|persist/, why: 'slice 1 stores nothing — the conversation dies with the screen' },
  ];
  for (const { pattern, why } of FORBIDDEN) {
    const offenders = imports.filter((line) => pattern.test(line));
    ok(
      `the screen imports nothing matching ${pattern} (${why})`,
      offenders.length === 0,
      offenders.join(' | '),
    );
  }

  // AND THE ABSENCE OF A VIOLATION IS NOT THE PRESENCE OF THE PRACTICE. A screen
  // importing nothing at all would satisfy every cell above.
  ok(
    'the screen reads the week through the shared projection door',
    /import \{ useResolvedWeek \} from '\.\.\/\.\.\/hooks\/useSchedule'/.test(screenCode),
    'the coach must see the week the Program tab sees — a private derivation '
      + 'here is ruling 1\'s `summariseDay` returning under a new name',
  );
  ok(
    'and it hands that week to the opener rule rather than reading days itself',
    /coachOpener\(\{ week: visibleWeek, todayISO \}\)/.test(screenCode),
    'the screen must pass the projection through, not walk it',
  );

  // NO STATE LEAVES THE COMPONENT. `useState` is the whole store.
  ok(
    'the conversation lives in component state and nowhere else',
    /useState<readonly CoachTurn\[\]>/.test(screenCode)
      && !/useEffect\([^)]*\)[\s\S]{0,200}(save|persist|write|append)/i.test(screenCode),
    'zero new stored state — the slice is read-only in the north-star sense too',
  );
}

// ─── [2] THE COACH'S WORDS FOR A DAY ARE THE WEEK ROW'S WORDS ────────────────

console.log('\n[2] ONE NAMING — the coach may not describe a day a second way');
{
  ok(
    'the opener names a day through `visibleDayLeadHeadline`',
    /visibleDayLeadHeadline\(day\)/.test(openerCode),
    'ruling 1: the coach reads the same projection. Not an equivalent rule — '
      + 'the same call the week row makes',
  );
  const homeScreen = stripComments(read('screens', 'home', 'HomeScreenV2.tsx'));
  ok(
    'and HomeScreenV2 still names its rows through the SAME function',
    /visibleDayLeadHeadline\(day\)/.test(homeScreen),
    'this cell is the other half of the claim: if the week row stops calling it, '
      + '"the same call" becomes false and the coach silently owns a second '
      + 'naming with nothing red',
  );
  ok(
    'the opener composes no day name of its own',
    !/workout\.name|\.headline\b[\s\S]{0,40}\+|resolveSessionDisplayName/.test(openerCode),
    'a `+` beside a headline is the composition ruling 1 retired',
  );
  ok(
    'the opener reads no clock — today is an argument',
    !/todayISOLocal|new Date\(\)/.test(openerCode),
    'the anchor ruling: nothing derived may invent today',
  );
}

// ─── [3] THE SENTENCE, OVER REAL SHAPES ──────────────────────────────────────

console.log('\n[3] THE OPENER — short, and every claim in it is a day in the week');
{
  const signed = (text: string) => text as unknown as SignedCopy;

  function day(date: string, kind: VisibleDayKind, bucket: string | null): VisibleDay {
    return {
      date,
      kind,
      headline: signed(kind === 'game' ? 'Game Day' : kind === 'rest' ? 'Rest Day' : 'Training Day'),
      parts: bucket === null ? [] : [{
        id: `${date}-p1`,
        kind: 'strength',
        headline: signed(bucket),
        bucket: signed(bucket),
        detail: null,
        rows: [],
        capabilities: {
          canMove: false, canRemove: false, canSwap: false, canEditRows: false,
        } as VisibleDay['parts'][number]['capabilities'],
        countsTowardLoad: true,
      }],
      capabilities: {
        canAdd: false, canMoveWholeDay: false, canRemoveWholeDay: false, refusal: null,
      } as VisibleDay['capabilities'],
      owner: 'generation' as VisibleDay['owner'],
    };
  }

  // Monday 2026-08-10 .. Sunday 2026-08-16. Saturday 2026-08-15 is the fixture.
  const week: VisibleWeek = {
    weekStart: '2026-08-10',
    days: [
      day('2026-08-10', 'training', 'Strength'),
      day('2026-08-11', 'training', 'Conditioning'),
      day('2026-08-12', 'rest', null),
      day('2026-08-13', 'training', 'Strength'),
      day('2026-08-14', 'rest', null),
      day('2026-08-15', 'game', null),
      day('2026-08-16', 'rest', null),
    ],
  };

  // The control: the fixture is real and the day names are the ones the week row
  // would show. A sentence asserted against hand-written expectations would pass
  // just as well if the naming owner were bypassed entirely.
  ok(
    'the fixture day names itself "Game Day" through the shared owner',
    visibleDayLeadHeadline(week.days[5]) === 'Game Day',
    visibleDayLeadHeadline(week.days[5]),
  );
  ok(
    'and a training day names itself by its BUCKET, not its day headline',
    visibleDayLeadHeadline(week.days[0]) === 'Strength',
    visibleDayLeadHeadline(week.days[0]),
  );

  const monday = coachOpener({ week, todayISO: '2026-08-10' });
  ok(
    'Monday: the fixture leads, then today, then tomorrow',
    monday.text === 'Game Saturday. Strength today. Conditioning tomorrow.',
    monday.text,
  );
  ok(
    'and the grounds name exactly the three days the sentence used',
    monday.grounds.today?.date === '2026-08-10'
      && monday.grounds.tomorrow?.date === '2026-08-11'
      && monday.grounds.nextFixture?.date === '2026-08-15',
    JSON.stringify(monday.grounds),
  );

  // L-C1 AS AN ASSERTION RATHER THAN A HOPE: every day the sentence names must
  // be a day in the projection. This is the cell that reds if the coach ever
  // starts inventing.
  const namedDates = [monday.grounds.today, monday.grounds.tomorrow, monday.grounds.nextFixture]
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  ok(
    'every day the opener speaks about exists in the week it was given',
    namedDates.every((entry) => week.days.some((d) => d.date === entry.date)),
    namedDates.map((entry) => entry.date).join(', '),
  );
  ok(
    'and every name it uses is that day\'s own projected name',
    namedDates.every((entry) => {
      const source = week.days.find((d) => d.date === entry.date);
      return source !== undefined && entry.name === visibleDayLeadHeadline(source);
    }),
    namedDates.map((entry) => `${entry.date}=${entry.name}`).join(', '),
  );

  // THE FIXTURE IS NOT NAMED TWICE. Friday's tomorrow IS the game, so the
  // fixture clause must stand down — the "Strength + Strength" dedupe lesson one
  // layer up.
  const friday = coachOpener({ week, todayISO: '2026-08-14' });
  ok(
    'Friday: the fixture is tomorrow, so it is named once, as tomorrow',
    friday.text === 'Rest Day today. Game Day tomorrow.'
      && friday.grounds.nextFixture === null,
    `${friday.text} | fixture=${JSON.stringify(friday.grounds.nextFixture)}`,
  );

  // Game day itself: no fixture clause, because today already is it.
  const saturday = coachOpener({ week, todayISO: '2026-08-15' });
  ok(
    'Saturday: game day names itself and no fixture clause is added',
    saturday.text === 'Game Day today. Rest Day tomorrow.'
      && saturday.grounds.nextFixture === null,
    saturday.text,
  );

  // Sunday: tomorrow is outside this week. The coach must say only what it can
  // see rather than reaching for a day it was not given.
  const sunday = coachOpener({ week, todayISO: '2026-08-16' });
  ok(
    'Sunday: tomorrow is next week, so the opener speaks only of today',
    sunday.text === 'Rest Day today.' && sunday.grounds.tomorrow === null,
    sunday.text,
  );

  // A week the coach is not in. The honest answer, not a greeting.
  const elsewhere = coachOpener({ week, todayISO: '2026-09-01' });
  ok(
    'a today outside the week gets the honest sentence, not an empty one',
    elsewhere.text === COACH_OPENER_COPY.noWeek,
    elsewhere.text,
  );
  ok(
    'and an empty week gets it too',
    coachOpener({ week: { weekStart: '2026-08-10', days: [] }, todayISO: '2026-08-10' })
      .text === COACH_OPENER_COPY.noWeek,
  );

  // SHORT IS THE RULING, SO SHORT IS A CELL. Sam: "I want the coach to mostly
  // get to the point." Three clauses is the maximum the builder can produce, and
  // this reds the day somebody adds a fourth.
  const longest = coachOpener({ week, todayISO: '2026-08-10' }).text;
  ok(
    'the longest possible opener is three clauses and under 80 characters',
    longest.split(COACH_OPENER_COPY.clauseJoin).length === 3 && longest.length < 80,
    `${longest.length} chars: ${longest}`,
  );

  // GROUNDS AND TEXT ARE THE SAME DERIVATION ASKED TWICE.
  ok(
    'coachOpenerGrounds agrees with the grounds coachOpener returns',
    JSON.stringify(coachOpenerGrounds({ week, todayISO: '2026-08-10' }))
      === JSON.stringify(monday.grounds),
  );
}

// ─── [4] L-C3 — THE COMPOSER RIDES THE KEYBOARD ──────────────────────────────

console.log('\n[4] THE NIKE BAR — no control may be occluded by the keypad');
{
  ok(
    'the composer is the KeyboardSafeArea FOOTER, not laid out above the keypad',
    /<KeyboardSafeArea[^>]*footer=\{composer\}/s.test(screenCode),
    'a footer rides KeyboardStickyView on the UI thread; content laid out above '
      + 'the keyboard is content the keyboard covers (dogfood finding E3)',
  );
  ok(
    'the input is AppTextInput, so a single-line field keeps its submit key',
    /<AppTextInput\b/.test(screenCode) && !/(?<![\w.])<TextInput[\s/>]/.test(screenCode),
    'E4: the "done" return key is the second way off the keyboard, and the '
      + 'convention owner is the only thing that guarantees it',
  );
  ok(
    'the send control is reachable while the keyboard is up',
    /keyboardShouldPersistTaps="handled"/.test(screenCode),
    'E4: Continue needed a blank-space tap first — the same defect, on send',
  );
  ok(
    'the conversation drags the keyboard away',
    /keyboardDismissMode="interactive"/.test(screenCode),
  );
  ok(
    'submitting from the keyboard sends, and does not blur the field',
    /onSubmitEditing=\{handleSend\}/.test(screenCode) && /blurOnSubmit=\{false\}/.test(screenCode),
    'Sam: "no hidden enter button behind the keyboard pop ups"',
  );
  ok(
    'the send control is at least 44pt square with hit slop (no dead tap zone)',
    /width: 44,\s*\n\s*height: 44,/.test(screenCode) && /hitSlop=/.test(screenCode),
  );
  ok(
    'the send control declares its disabled state to assistive tech',
    /accessibilityState=\{\{ disabled: !canSend \}\}/.test(screenCode)
      && /accessibilityLabel=\{COACH_TAB_COPY\.sendAccessibilityLabel\}/.test(screenCode),
    'a glyph button with no name is a dead control to a screen reader',
  );

  // THE TAB BAR IS A STATIC BOTTOM INSET, AND A STICKY FOOTER OVERSHOOTS ONE.
  // This is the run-3 onboarding finding in a place the screen cannot fix,
  // because the tab bar is not the screen's layout.
  // THE CLOSING `/>` IS ANCHORED AT THE BLOCK'S OWN INDENTATION, and that is a
  // caught defect rather than a precaution: `[\s\S]*?\/>` stopped at the INLINE
  // `<CoachIcon … />` inside `tabBarIcon`, returning a 140-character slice that
  // was non-trivial, looked like a block, and did not contain the option being
  // asserted. A prove-the-region cell reds on that; a length check alone did not.
  const coachTabBlock = /<Tab\.Screen\s+name="CoachTab"[\s\S]*?\n\s{8}\/>/.exec(navigator)?.[0] ?? '';
  ok(
    'the WHOLE CoachTab block was located — its last line is in the slice',
    coachTabBlock.length > 300 && /listeners=/.test(coachTabBlock),
    `${coachTabBlock.length} chars, listeners present: ${/listeners=/.test(coachTabBlock)}`,
  );
  ok(
    'and the tab bar hides while the keyboard is up',
    /tabBarHideOnKeyboard: true/.test(coachTabBlock),
    'an 84pt tab bar under a KeyboardStickyView footer is exactly the inset the '
      + 'run-3 CTA overshot by',
  );
}

// ─── [5] ONE DESIGN LANGUAGE, AND ONE VOCABULARY ─────────────────────────────

console.log('\n[5] STYLE LAW + COPY — the screen authors neither colours nor words');
{
  const hexes = screenCode.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
  ok('the screen declares NO raw colour literal', hexes.length === 0, hexes);
  const functional = screenCode.match(/\brgba?\s*\(/g) ?? [];
  ok('and no rgb()/rgba() literal either', functional.length === 0, functional);
  const tokenReads = screenCode.match(/\bcolors\.[a-z]/gi) ?? [];
  ok('and it reads the colour tokens, and reads them a lot', tokenReads.length >= 12, tokenReads.length);

  // EVERY ATHLETE-VISIBLE STRING COMES FROM BATCH 30. The sweep is over JSX text
  // children and the prose-bearing props, which is `signedCopyExtraction`'s own
  // precision rule — a testID or a style value is not a word.
  const proseProps = screenCode.match(/(?:placeholder|accessibilityLabel|title)=\{?"[^"]{4,}"/g) ?? [];
  ok(
    'no prose-bearing prop carries a bare string literal',
    proseProps.length === 0,
    proseProps,
  );
  const jsxText = screenCode.match(/>\s*[A-Za-z][A-Za-z ,'’.]{4,}\s*</g) ?? [];
  ok('no JSX text child is a bare string literal', jsxText.length === 0, jsxText);
  ok(
    'and the batch it does read is batch 30',
    /COACH_TAB_COPY\./.test(screenCode) && /from '\.\.\/\.\.\/rules\/coachTabCopy'/.test(screenCode),
  );

  // The one answer slice 1 has, and it is the law rather than a stub.
  //
  // COUNTED INSIDE THE TURN PRODUCER, NOT FILE-WIDE — `a count taken for a
  // record`, caught on this cell's first run. A file-wide sweep for
  // `speaker: 'coach'` counted TWO, and the second was the TYPE DECLARATION
  // (`readonly speaker: 'coach' | 'athlete'`). The instrument counted a
  // character sequence; the claim is about replies the screen can EMIT, and
  // only the state updater emits any.
  const sendBody = /const handleSend = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[draft\]\);/
    .exec(screenCode)?.[0] ?? '';
  ok(
    'the turn producer was located and is substantial',
    sendBody.length > 200 && /setTurns\(/.test(sendBody),
    `${sendBody.length} chars`,
  );
  ok(
    'the only reply the screen can produce is the honest no-answer (L-C1)',
    /text: COACH_TAB_COPY\.noAnswerYet/.test(sendBody)
      && (sendBody.match(/speaker: 'coach'/g) ?? []).length === 1,
    'a second coach reply in slice 1 would be an answer nobody derived',
  );
}

// ─── [6] THE WEEKDAY TABLE — ONE OWNER, ABBREVIATIONS DERIVED ────────────────

console.log('\n[6] WEEKDAYS — full words own the table, short forms are derived');
{
  ok('seven weekdays, Sunday first (JS order, matching dayOfWeekForISODate)',
    WEEKDAY_NAMES.length === 7 && WEEKDAY_NAMES[0] === 'Sunday' && WEEKDAY_NAMES[6] === 'Saturday',
    WEEKDAY_NAMES.join(','));

  // THE C5 PRECEDENT, PROVEN RATHER THAN ASSERTED. Before today the abbreviation
  // list was its own array of seven literals. These are the seven it held; if
  // slicing the full words ever stops reproducing them byte-for-byte, this reds
  // instead of the app quietly shipping "Wed" as "Wedn".
  const SHIPPED_BEFORE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const derived = WEEKDAY_NAMES.map((name) => name.slice(0, 3));
  ok(
    'the derived three-letter forms are byte-identical to the seven that shipped',
    JSON.stringify(derived) === JSON.stringify(SHIPPED_BEFORE),
    derived.join(','),
  );
  // 2026-08-15 is a Saturday. One real date through both doors, so the table is
  // proven to be INDEXED correctly and not merely to contain the right words.
  ok('weekdayName reads the table by date', weekdayName('2026-08-15') === 'Saturday');
  ok('and the existing short label still reads "Sat 15/8"',
    shortWeekdayDateLabel('2026-08-15') === 'Sat 15/8',
    shortWeekdayDateLabel('2026-08-15'));
}

// ─── [7] BATCH 30 IS DECLARED, NOT SCATTERED ─────────────────────────────────

console.log('\n[7] BATCH 30 — one module owns every new word');
{
  const copySource = read('rules', 'coachTabCopy.ts');
  ok('the batch declares itself PROPOSED and unruled',
    /BATCH 30[\s\S]{0,200}PROPOSED/.test(copySource));
  ok('the opener imports its fragments from the batch, not its own literals',
    /from '\.\/coachTabCopy'/.test(openerCode)
      && !/'\. '|'today'|'tomorrow'/.test(openerCode),
    'a second copy home is a second vocabulary');
  ok('every batch-30 string is non-empty',
    [...Object.values(COACH_OPENER_COPY), ...Object.values(COACH_TAB_COPY)]
      .every((value) => typeof value === 'string' && value.length > 0));
}

const total = passed + failures.length;
console.log(`\nCoach tab slice 1 totals: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
