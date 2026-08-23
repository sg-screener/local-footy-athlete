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
import {
  COACH_GREETING_COPY_ID,
  COACH_OPENER_COPY,
  COACH_TAB_COPY,
  coachGreeting,
} from '../rules/coachTabCopy';
import { signedCopyEntry } from '../rules/signedCopy';
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
    { pattern: /decisionLedger/, why: 'appending a decision is a mutation even when it reads like a log' },
    { pattern: /Transaction/, why: 'accepted-state transactions are the write path' },
    { pattern: /coachActions|coachTurnController|coachCommand/, why: 'the retired beta pipeline' },
    { pattern: /applyProgramAdjustment|weekRebuild|generateProgram/, why: 'generation and adjustment writers' },
    { pattern: /AsyncStorage|persist/, why: 'the conversation dies with the screen — zero stored state' },
  ];
  for (const { pattern, why } of FORBIDDEN) {
    const offenders = imports.filter((line) => pattern.test(line));
    ok(
      `the screen imports nothing matching ${pattern} (${why})`,
      offenders.length === 0,
      offenders.join(' | '),
    );
  }

  // ── SLICE 3: THE BAN ON THE DOOR BECAME A BAN ON A SECOND DOOR ─────────────
  //
  // `programControlActions` left the list above on 2026-08-10, and that is the
  // slice this gate was waiting for: S3 is *"it changes things"*, and a screen
  // that changes things reaches a writer by definition. A ban that outlives the
  // reason for it is a ban somebody deletes in a hurry, so it is REPLACED
  // rather than removed, by the claim that actually protects the athlete now:
  //
  //   **exactly one writer, named, and it is the athlete's own tap door.**
  //
  // Counting is not the instrument — `a count taken for a record`, fourteen
  // sightings. The set of imported writer SYMBOLS is compared to a declared
  // set, so a second door arriving reds this cell whether or not the first one
  // is still there, and a rename reds it too.
  const doorImports = imports.filter((line) => /programControlActions/.test(line));
  const doorSymbols = doorImports
    .flatMap((line) => [...line.matchAll(/\b(execute|route)[A-Za-z]+\b/g)].map((m) => m[0]))
    .sort();
  ok(
    'the screen reaches EXACTLY the athlete tap door and nothing else in it',
    doorSymbols.join(',') === 'executeProgramControlActionDurably',
    doorSymbols.join(',') || '(no door imported)',
  );
  ok(
    'and it is the DURABLE door, not the synchronous one',
    !/\bexecuteProgramControlAction\b(?!Durably)/.test(screenCode),
    'the synchronous variant skips the accepted-state commit, so a coach change '
      + 'made through it would not survive a relaunch — the exact loss the '
      + 'overnight pass measured on the exercise door',
  );
  ok(
    'the door is entered from exactly one place in the screen',
    (screenCode.match(/executeProgramControlActionDurably\(/g) ?? []).length === 1,
    'two call sites is two chances to send an action the card never showed',
  );

  // AND THE ABSENCE OF A VIOLATION IS NOT THE PRESENCE OF THE PRACTICE. A screen
  // importing nothing at all would satisfy every cell above.
  ok(
    'the screen reads the week through the shared projection door',
    /import \{ useResolvedWeek \} from '\.\.\/\.\.\/hooks\/useSchedule'/.test(screenCode),
    'the coach must see the week the Program tab sees — a private derivation '
      + 'here is ruling 1\'s `summariseDay` returning under a new name',
  );
  ok(
    'the empty conversation does not auto-render a week summary',
    !/coachOpener|coach-tab-opener/.test(screenCode),
    'week context remains available to answer a question, but is no longer a second automatic bubble',
  );

  // NO STATE LEAVES THE COMPONENT. `useState` is the whole store.
  ok(
    'the conversation lives in component state and nowhere else',
    /useState<readonly CoachTurn\[\]>/.test(screenCode)
      && !/useEffect\([^)]*\)[\s\S]{0,200}(save|persist|write|append)/i.test(screenCode),
    'zero new stored state — the slice is read-only in the north-star sense too',
  );

  // ── AND THE BAN GOES ONE HOP FURTHER, BECAUSE IT HAD TO ────────────────────
  //
  // A BAN ON THE SCREEN'S OWN IMPORT LIST IS A BAN ON ONE LINE OF A GRAPH.
  // Slice 2 moved the thinking into `rules/` modules, and the cheapest way to
  // give the coach a store from now on is not to import one here — it is to
  // import one from `rules/coachAnswer`, where this section was not looking.
  // The screen's list would stay spotless and the gate would stay green.
  //
  // So every `rules/` module the screen pulls in is opened and swept with the
  // SAME patterns. One hop, not a full transitive walk: one hop is what covers
  // the modules this slice authored, and a claim about a whole graph is a claim
  // this cell cannot honestly make.
  const ruleModules = [...screenCode.matchAll(/from '\.\.\/\.\.\/rules\/([A-Za-z]+)'/g)]
    .map((match) => match[1]);
  ok(
    'the screen\'s rules/ imports were enumerated and there are some',
    ruleModules.length >= 3,
    ruleModules.join(', '),
  );
  const FORBIDDEN_ONE_HOP: ReadonlyArray<RegExp> = [
    /from '[^']*\/store\//,
    /programControlActions/,
    /decisionLedger/,
    /Transaction/,
    /applyProgramAdjustment|weekRebuild|generateProgram/,
    /AsyncStorage/,
  ];
  for (const moduleName of ruleModules) {
    const source = stripComments(read('rules', `${moduleName}.ts`));
    // `import type` is ERASED — it creates no runtime edge, and counting it as
    // one is the eleventh-sighting mistake from the overnight pass. A type from
    // a store module is a shape, not a store.
    const runtimeImports = source.match(/^import(?!\s+type\s)[\s\S]*?from\s+'[^']+';/gm) ?? [];
    const offenders = runtimeImports.filter((line) =>
      FORBIDDEN_ONE_HOP.some((pattern) => pattern.test(line)));
    ok(
      `rules/${moduleName} reaches no writer either`,
      offenders.length === 0,
      offenders.join(' | '),
    );
  }
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
    return { gaps: [], /* surface 4, 2026-08-17: a day carries its typed kit gaps; empty is the normal answer */
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
  const week: VisibleWeek = { explanations: [], /* surface 5, 2026-08-17: the week carries its block-boundary sentences; empty is a first block */
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
    coachOpener({ week: { explanations: [], /* surface 5, 2026-08-17: the week carries its block-boundary sentences; empty is a first block */ weekStart: '2026-08-10', days: [] }, todayISO: '2026-08-10' })
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
  //
  // ── RE-AIMED AT SLICE 3, AND THE ANCHOR MOVED OFF THE FUNCTION BODY ────────
  //
  // SECOND TIME THIS ANCHOR HAS REDDENED ON A CORRECT EDIT, and twice is the
  // sighting that changes the instrument rather than the pattern. Slice 2 added
  // `visibleWeek` to a dependency array; slice 1's fix re-anchored on the
  // producer's closing brace — and slice 3 split `handleSend` into a delegating
  // one-liner plus a `send` that has three branches, so the brace anchor missed
  // too. **An anchor on a function BODY is coupled to the body**, and the body
  // is the thing every slice edits.
  //
  // So the claim is expressed where it is actually stable: there is ONE
  // appender of coach turns in this file, it takes its text as an ARGUMENT, and
  // no caller of it passes words. That is the law slice 1 wrote ("the screen
  // authors no reply") stated so that adding a branch cannot break the cell and
  // adding a SENTENCE cannot pass it.
  const sayBody = /const say = useCallback\(\(text: string\) => \{[\s\S]*?\n  \}, \[\]\);/
    .exec(screenCode)?.[0] ?? '';
  ok(
    'the coach-turn appender was located and is substantial',
    sayBody.length > 100 && /setTurns\(/.test(sayBody)
      && /\}, \[\]\);\s*$/.test(sayBody),
    `${sayBody.length} chars`,
  );
  // COUNTED ON THE OBJECT LITERAL, NOT THE WORD — `a count taken for a record`,
  // caught on this cell's first run at slice 1: a file-wide sweep for
  // `speaker: 'coach'` counted TWO and the second was the TYPE DECLARATION
  // (`readonly speaker: 'coach' | 'athlete'`). The trailing comma is what
  // separates an emitted turn from a declared shape.
  ok(
    'exactly one place in the screen emits a coach turn',
    (screenCode.match(/speaker: 'coach',/g) ?? []).length === 1,
    'a second appender is a second voice, one edit from disagreeing with the first',
  );
  ok(
    'and it takes the sentence as an argument rather than choosing one',
    /const say = useCallback\(\(text: string\)/.test(screenCode)
      && /text,?\s*\}/.test(sayBody),
    'an appender that could pick a word is a screen that authors replies',
  );
  // EVERY CALLER OF IT PASSES A RULE'S RETURN VALUE. Enumerated rather than
  // asserted in the negative: a ban on literals would pass a caller that read a
  // copy constant, which is how the cancel path very nearly shipped.
  const sayCalls = [...screenCode.matchAll(/\bsay\(([\s\S]*?)\);/g)].map((m) => m[1].trim());
  ok(
    'every coach sentence in the screen is a rule call and there are some',
    // ⚠ ENUMERATED, AND R-105 ADDED THREE NAMES TO THE LIST — NOT A WILDCARD.
    // The weekly-reduction conversation moved onto this screen, so the coach can
    // now also say what the transaction reported, that the athlete declined, and
    // that the rebuild refused. All three are `rules/projectionCopy` renderers
    // over SIGNED entries, so the property this cell holds — *the screen names
    // the rule, never the words* — is unchanged. A ban on literals would have
    // let them through without anyone naming them, which is why this is a list.
    sayCalls.length >= 3 && sayCalls.every((argument) =>
      /^(coachAnswer|coachChangeOutcome|coachChangeDeclined)\(/.test(argument)
      || /^commitment(Confirmed|Declined|Failed)Sentence\(/.test(argument)
      || /^proposal\.text$/.test(argument)),
    sayCalls.join(' | '),
  );
  ok(
    'the screen names no copy constant on any coach-turn path',
    sayCalls.every((argument) => !/COACH_[A-Z_]+_COPY\./.test(argument))
      && !/text: '[^']+'/.test(screenCode),
    'the fallback, the refusal and the decline all live in rules/ — a copy '
      + 'constant reached from here would be the screen owning a case',
  );
}

// ─── [6] THE WEEKDAY TABLE — ONE OWNER, ABBREVIATIONS DERIVED ────────────────

console.log('\n[6] WEEKDAYS — full words own the table, short forms are derived');
{
  // ALL SEVEN WORDS, NOT THE TWO ENDS — a survivor found this cell, and the
  // survivor is worth recording. It read `length === 7 && [0] === 'Sunday' &&
  // [6] === 'Saturday'`, and a mutation changing 'Tuesday' to 'Tues' PASSED it:
  // the derived-abbreviation cell below stayed green too, because 'Tues'.slice(
  // 0, 3) is still 'Tue'. So both cells were true and the athlete would have
  // read "Game Tues". These seven are BATCH 30 COPY, and copy is pinned by its
  // words — the abbreviation is what is derived, never the word it comes from.
  const EXPECTED_WEEKDAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];
  ok('the seven weekday words are exactly the seven batch 30 declares',
    JSON.stringify(WEEKDAY_NAMES) === JSON.stringify(EXPECTED_WEEKDAYS),
    WEEKDAY_NAMES.join(','));

  // AND THE TABLE IS INDEXED, NOT MERELY POPULATED. A correct set in the wrong
  // ORDER satisfies the cell above perfectly. 2026-08-09 is a Sunday, so these
  // seven consecutive dates walk the table start to finish through the one
  // owner of the JS-weekday conversion.
  const walkedWeek = ['09', '10', '11', '12', '13', '14', '15']
    .map((dayOfMonth) => weekdayName(`2026-08-${dayOfMonth}`));
  ok('and seven consecutive real dates read the table in order',
    JSON.stringify(walkedWeek) === JSON.stringify(EXPECTED_WEEKDAYS),
    walkedWeek.join(','));

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

console.log('\n[7] BATCH 30 — one module owns every new word, and the greeting is Sam\'s');
{
  const copySource = read('rules', 'coachTabCopy.ts');
  ok('the batch declares itself RULED, not PROPOSED',
    /BATCH 30[\s\S]{0,120}RULED/.test(copySource)
      && !/BATCH 30[\s\S]{0,120}PROPOSED/.test(copySource),
    'Sam ruled these words on 2026-08-09; a module still calling itself '
      + 'PROPOSED is a provenance claim that has gone stale');
  ok('the opener imports its fragments from the batch, not its own literals',
    /from '\.\/coachTabCopy'/.test(openerCode)
      && !/'\. '|'today'|'tomorrow'/.test(openerCode),
    'a second copy home is a second vocabulary');
  ok('every batch-30 string is non-empty',
    [...Object.values(COACH_OPENER_COPY), ...Object.values(COACH_TAB_COPY)]
      .every((value) => typeof value === 'string' && value.length > 0));

  // ── SAM'S GREETING, WORD FOR WORD ──────────────────────────────────────────
  //
  // PINNED AS THE WHOLE SENTENCE, not as a prefix and not as a length. This is
  // the M10 lesson from this suite's own first run, applied before the drift
  // rather than after it: a cell that checked the two ENDS of a weekday word
  // stayed green while the middle changed and the athlete read "Game Tues".
  // A verbatim quote is pinned verbatim or it is not pinned.
  const GREETING = "G'day, I'm your S&C coach. I can answer fitness questions "
    + 'and make changes to your program.';
  ok('the greeting is exactly the sentence Sam gave, character for character',
    coachGreeting() === GREETING,
    coachGreeting());

  // AND IT IS SIGNED IN THE STRICT SENSE — an entry in the sheet, with a
  // provenance a reader can check. Batch 30's other words are module constants
  // and say so; this one is the only verbatim quote in the batch and it is the
  // only one that earns a registry row.
  const entry = signedCopyEntry(COACH_GREETING_COPY_ID);
  ok('the greeting is in the signed-copy sheet, not a module constant',
    entry !== null && entry.text === GREETING,
    JSON.stringify(entry));
  ok('and its provenance is a signed sentence carrying the date it was signed',
    entry?.source === 'signed_sentence' && /2026-08-09/.test(entry?.provenance ?? ''),
    `${entry?.source} | ${entry?.provenance}`);

  // THE HONESTY GAP IS RECORDED WHERE THE WORDS ARE. The greeting promises an
  // ability S3 delivers; Sam ruled the gap acceptable because the app has no
  // users but his devices. That ruling has a condition attached, and a
  // condition nobody can find is a condition nobody honours — so the module
  // that holds the sentence must hold the re-check trigger too.
  ok('the module records the beta-gate re-check the greeting ships under',
    /beta gate/i.test(copySource) && /S3/.test(copySource),
    'the sentence becomes true at S3; if a beta gate arrives first, the seat '
      + 're-checks it, and that is written beside the words');

  // THE SCREEN SHOWS ONLY IT. Sam superseded the second automatic week-shape
  // bubble and starter chip on 2026-08-11; typed session moves still go through
  // the proposal path below.
  const greetingAt = screenCode.indexOf('coachGreeting()');
  ok('the greeting bubble is rendered',
    greetingAt >= 0 && /<Bubble speaker="coach" text=\{coachGreeting\(\)\}/.test(screenCode),
    `greeting=${greetingAt}`);
  ok('no second automatic bubble survives',
    !/text=\{opener\.text\}|coach-tab-opener/.test(screenCode));
  ok('the empty-state Move a session chip is absent',
    !/coach-tab-chip-move|moveChipLabel/.test(screenCode));
}

// ─── [8] THE OPENER'S SENTENCE CONTAINS NOTHING BUT ITS SOURCES ──────────────

console.log('\n[8] THE OPENER DECOMPOSES — every word in it came from somewhere named');
{
  // WHY THIS SECTION EXISTS, AND IT IS A STATED SUBSTITUTE FOR A STRONGER THING.
  // `SignedCopy` makes "this string was authored" a COMPILE-TIME fact, and the
  // opener cannot have it: it composes with a space, with ". ", and with a
  // trailing full stop, and `joinSignedCopy` cannot express a suffix at all —
  // the alternative is widening `FILLED_PLACEHOLDER` to admit words, which
  // `signedCopy.ts` names as a loosening of the L-P2 runtime law. So the claim
  // is made here at RUNTIME instead: strip every fragment the opener is allowed
  // to use and every day name the projection gave it, and what remains must be
  // nothing. A fourth word from anywhere reds this.
  function day(date: string, kind: VisibleDayKind, bucket: string | null): VisibleDay {
    return { gaps: [], /* surface 4, 2026-08-17: a day carries its typed kit gaps; empty is the normal answer */
      date,
      kind,
      headline: ('Game Day') as unknown as SignedCopy,
      parts: bucket === null ? [] : [{
        id: `${date}-p1`,
        kind: 'strength',
        headline: bucket as unknown as SignedCopy,
        bucket: bucket as unknown as SignedCopy,
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
  const week: VisibleWeek = { explanations: [], /* surface 5, 2026-08-17: the week carries its block-boundary sentences; empty is a first block */
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

  const ALLOWED_FRAGMENTS: readonly string[] = [
    COACH_OPENER_COPY.fixtureLead,
    COACH_OPENER_COPY.today,
    COACH_OPENER_COPY.tomorrow,
    COACH_OPENER_COPY.clauseJoin,
    COACH_OPENER_COPY.fullStop,
    ...WEEKDAY_NAMES,
    ' ',
  ];

  // Longest first, so "Strength" is never eaten by a shorter fragment that
  // happens to be a prefix of it. Ordering is the whole correctness of a
  // strip-and-check, and getting it wrong makes the cell pass on rubbish.
  const dayNames = week.days.map((d) => String(visibleDayLeadHeadline(d)));
  const strippers = [...ALLOWED_FRAGMENTS, ...dayNames]
    .sort((a, b) => b.length - a.length);

  const residues: string[] = [];
  for (const todayISO of week.days.map((d) => d.date)) {
    let text = coachOpener({ week, todayISO }).text;
    for (const fragment of strippers) {
      text = text.split(fragment).join('');
    }
    if (text.length > 0) residues.push(`${todayISO}: "${text}"`);
  }
  ok(
    'every day of the week produces a sentence made only of named fragments',
    residues.length === 0,
    residues.join(' | '),
  );

  // THE CONTROL, because a strip-and-check that strips everything proves
  // nothing. An invented word must survive the same strippers.
  let control = 'Game Saturday. Strength today. Probably a light jog.';
  for (const fragment of strippers) control = control.split(fragment).join('');
  ok(
    'and an invented clause DOES leave a residue — the instrument can fail',
    control.length > 0,
    `control residue: "${control}"`,
  );
}

const total = passed + failures.length;
console.log(`\nCoach tab slice 1 totals: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
