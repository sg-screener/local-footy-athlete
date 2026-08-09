(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/**
 * THE JOURNAL'S UI LAWS — Sam's direction ruling, 2026-08-09
 * (docs/JOURNAL_UI_DIRECTION_RULING_2026-08-09.md).
 *
 * VERIFICATION STRATEGY (L12). The ruling has three parts that are ordinarily
 * unenforceable prose, and each one degrades in a different way. This suite
 * exists because "we followed the ruling" is a claim, and the next person to
 * touch this screen will not have read it.
 *
 *   - THE STYLE LAW DEGRADES ONE HEX AT A TIME. "Match the style of the rest of
 *     the app" is Sam's rider, and nothing in this repo has ever enforced it.
 *     The failure is never a redesign; it is one `#1B1B1E` copied out of a mock
 *     because no token was quite right, and then a second. [1] forbids raw
 *     colour literals on this screen outright, which is a rule a reviewer cannot
 *     forget to apply.
 *   - THE EXCEPTION RULE DEGRADES BY ONE HELPFUL EMPTY STATE. "Nothing appears
 *     unless it has something to say" is one `else` away from being false, and
 *     the person adding that `else` will believe they are improving the screen —
 *     an honest empty state is a virtue everywhere else in this app. [3] holds
 *     the line by naming the blocks that must be able to render nothing.
 *   - THE ORDER DEGRADES SILENTLY. Sam ruled the earned cards sit ABOVE the
 *     lifts, with a reason ("attention beats routine"). A block moved during an
 *     unrelated edit breaks a ruling nobody re-reads. [2] anchors the order.
 *
 * WHAT THIS SUITE CANNOT DO, said here rather than in the report: it reads
 * SOURCE. No cell mounts the screen, this repo has no render-level test, and
 * every assertion below is therefore about the shape of the code rather than
 * about pixels. **The appearance itself is Sam's eye and nothing else.**
 *
 * Run: npm run test:journal-ui
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const SCREEN_PATH = join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx');
const screen = readFileSync(SCREEN_PATH, 'utf8');
/** Comments stripped: a rule about what SHIPS is not a rule about prose. */
const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

console.log('\n[0] THE SUBJECT WAS FOUND');
{
  // AGENTS.md's anchoring law, applied to this suite's own input before any
  // assertion is made about it. Every cell below reads `code`; a truncated read
  // would satisfy most of them vacuously.
  ok('the screen source was read', screen.length > 8000, screen.length);
  ok('and the stripped code is substantial, not comment-only',
    code.length > 6000, code.length);
}

// ─── [1] THE STYLE LAW ───────────────────────────────────────────────────

console.log('\n[1] STYLE LAW — one design language, and it is the app\'s');
{
  // SAM'S RIDER, VERBATIM: "it needs to match the style of the rest of the app
  // too." The ruling turns that into "reuse the app's existing tokens and
  // components… The mock's specific hexes/fonts are NOT law; the app's are."
  //
  // A HEX LITERAL IS HOW A SECOND DESIGN SYSTEM IS BORN. Not by decision — by
  // one colour that no token quite matched, which the next screen then copies
  // because it is now precedent.
  const hexes = code.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
  ok('the screen declares NO raw colour literal — every colour is a theme token',
    hexes.length === 0, hexes);

  // AND NO rgb()/rgba() EITHER, which is the same violation spelled differently
  // and would sail past a hex sweep.
  const functionalColours = code.match(/\brgba?\s*\(/g) ?? [];
  ok('and no rgb()/rgba() literal either — the same violation, spelled around',
    functionalColours.length === 0, functionalColours);

  // THE TOKENS ARE ACTUALLY READ. A screen with no hexes and no `colors.` at all
  // would pass both cells above while rendering unstyled — the absence of a
  // violation is not the presence of the practice.
  const tokenReads = code.match(/\bcolors\.[a-z]/gi) ?? [];
  ok('the screen reads the colour tokens, and reads them a lot',
    tokenReads.length >= 20, tokenReads.length);

  // SPACING IS THE SAME LAW ONE STEP DOWN. Bare pixel numbers in a stylesheet
  // are the spacing scale being ignored. Four are DECLARED and named here — the
  // bar geometry, which is a drawing dimension rather than a spacing step and
  // has no token to read.
  const styleBlock = code.slice(code.indexOf('const styles = StyleSheet.create('));
  ok('the stylesheet was located', styleBlock.length > 1000, styleBlock.length);
  const paddings = styleBlock.match(/\b(padding|margin|gap)[A-Za-z]*:\s*-?\d/g) ?? [];
  ok('no padding, margin or gap is a bare number — all come from the spacing scale',
    paddings.length === 0, paddings);

  // THE SHARED CARD IS USED RATHER THAN RE-IMPLEMENTED. This screen previously
  // hand-rolled a card (background + radius + padding) that happened to match
  // `Card`; "happened to match" is the state that ends when one of them changes.
  ok('the screen imports the shared Card rather than rolling its own',
    /import \{ Card \} from '\.\.\/\.\.\/components\/common\/Card'/.test(code));
  ok('and mounts it', (code.match(/<Card\b/g) ?? []).length >= 4,
    (code.match(/<Card\b/g) ?? []).length);
}

// ─── [2] THE RULED ORDER ─────────────────────────────────────────────────

console.log('\n[2] THE ORDER SAM RULED — and the earned cards above the lifts');
{
  // THE ANCHORING LAW IN FULL (AGENTS.md, sighting 6). Every anchor is proven
  // PRESENT before any order is claimed, because `indexOf` returns -1 for a
  // missing anchor and -1 compares less than everything — so "the hero comes
  // before the strip" is satisfied by the hero having been deleted.
  const render = code.slice(code.indexOf('<SafeAreaView'));
  ok('the render tree was located', render.length > 500, render.length);

  const anchors = [
    { name: 'hero', at: render.indexOf('<Card style={styles.hero}') },
    { name: 'stat strip', at: render.indexOf('<StatStrip') },
    { name: 'week bars', at: render.indexOf('<WeekShapeStrip') },
    { name: 'earned cards', at: render.indexOf('<AttentionCards') },
    { name: 'lifts', at: render.indexOf('<StrengthLines') },
    { name: 'month drawer', at: render.indexOf('<MonthDrawer') },
    { name: 'note', at: render.indexOf('<WeekNote') },
  ];
  const missing = anchors.filter((a) => a.at < 0).map((a) => a.name);
  ok('every block in the ruling is PRESENT before any order is claimed',
    missing.length === 0, missing);

  const inOrder = missing.length === 0
    && anchors.every((a, i) => i === 0 || anchors[i - 1].at < a.at);
  ok('and they render in the ruled order: hero, strip, bars, earned, lifts, month, note',
    inOrder, anchors);

  // THE ONE ORDERING SAM GAVE A REASON FOR, asserted on its own so it cannot be
  // lost inside a passing sweep of the whole list: "Placement: ABOVE the lifts —
  // attention beats routine."
  const earned = render.indexOf('<AttentionCards');
  const lifts = render.indexOf('<StrengthLines');
  ok('earned cards sit ABOVE the lifts — attention beats routine',
    earned > 0 && lifts > 0 && earned < lifts, { earned, lifts });
}

// ─── [3] THE EXCEPTION RULE ──────────────────────────────────────────────

console.log('\n[3] EXCEPTION-BASED — a block with nothing to say renders nothing');
{
  // "Nothing appears unless it has something to say. A surface earning its place
  // by having news IS the design."
  //
  // ASSERTED PER BLOCK, AT THE BLOCK. A file-wide count of `return null` would
  // be satisfied by any five components returning null, including five that
  // always do.
  const blocks = [
    'WeekKinds',
    'DidTheWorkHappen',
    'HowTheWeekFelt',
    'WhatChanged',
    'WeekStatus',
    'StatStrip',
    'AttentionCards',
    'StrengthLines',
  ];
  for (const block of blocks) {
    const start = code.indexOf(`function ${block}(`);
    const end = code.indexOf('\nfunction ', start + 1);
    const region = start >= 0 && end > start ? code.slice(start, end) : '';
    ok(`\`${block}\` was located and is substantial`,
      region.length > 100, { block, length: region.length });
    ok(`and \`${block}\` can render nothing at all`,
      /return null/.test(region), block);
  }

  // THE ONE PERMANENT EXCEPTION, ASSERTED AS AN EXCEPTION rather than left as an
  // inconsistency someone later "fixes". Sam: "YOUR MONTH: the one permanent
  // drawer (progress always has something to say once history exists)."
  const drawerStart = code.indexOf('function MonthDrawer(');
  const drawerEnd = code.indexOf('\nfunction ', drawerStart + 1);
  const drawer = drawerStart >= 0 && drawerEnd > drawerStart
    ? code.slice(drawerStart, drawerEnd) : '';
  ok('the month drawer was located', drawer.length > 200, drawer.length);
  ok('and the month drawer is PERMANENT — the one block that never returns null',
    !/return null/.test(drawer), drawer.match(/return null[^\n]*/g));

  // THE THREE RETIRED EMPTY STATES, swept at the screen rather than only in the
  // three suites that owned them. Each of those suites asserts its own; this
  // asserts they are gone as a SET, so re-adding one does not merely red the
  // suite whose author is most likely to re-point it.
  for (const retired of [
    'You made no changes to this week',
    'No lifts recorded with a weight',
    'No niggles recorded',
  ]) {
    ok(`the retired empty state "${retired}" is gone`,
      !code.includes(retired), retired);
  }
}

// ─── [4] THE LETTERS DIE, THE SPOKEN NAMES LIVE ──────────────────────────

console.log('\n[4] WEEK SHAPE AS BARS — "the letters die; spoken names stay"');
{
  // SAM'S RULING SUPERSEDES BATCH 15-b, and it supersedes it in exactly one
  // direction: the LETTER goes, the NAME stays. Both halves are asserted,
  // because deleting the whole presentation table would satisfy the first.
  const start = code.indexOf('const SHAPE_PRESENTATION');
  const end = code.indexOf('const WEEKDAY_INITIALS');
  ok('the shape presentation table was located', start > 0 && end > start, { start, end });
  const table = code.slice(start, end);
  ok('and the table is substantial', table.length > 200, table.length);

  ok('no shape carries a single-letter abbreviation any more',
    !/\bletter\s*:/.test(table), table.match(/letter[^\n]*/g));

  // THIS CELL WAS WRONG ON ITS FIRST RUN AND THE FIX IS THE POINT. It swept the
  // WHOLE FILE for `'[HMEG]'` and went red on `'M'` — Monday's initial in
  // `WEEKDAY_INITIALS`, which is the bars' axis label and has nothing to do with
  // the retired shape letters.
  //
  // `a count taken for a record`, in its source-scan form: the instrument's unit
  // was "a quoted capital letter anywhere in the file", the domain noun is "a
  // shape abbreviation". Scoped to the table, it means what it says.
  ok('and the H/M/E/G shape letters are gone from the presentation table',
    !/'[HMEG]'/.test(table), table.match(/'[HMEG]'/g));

  // THE WEEKDAY INITIALS ARE A DIFFERENT THING AND MUST SURVIVE — without them
  // the bars are seven unlabelled columns and an athlete cannot tell Tuesday
  // from Thursday. Asserted so the over-broad sweep above can never be "fixed"
  // by deleting them.
  ok('the weekday initials survive — they label the bars, they are not shape letters',
    /const WEEKDAY_INITIALS = \['M', 'T', 'W', 'T', 'F', 'S', 'S'\]/.test(code));

  // THE HALF THAT WOULD BE EASY TO LOSE, and losing it makes the screen worse
  // for a non-sighted athlete in the commit that makes it better for everyone
  // else. Height cannot be read aloud; the spoken name is all they get.
  for (const spoken of ['Hard', 'Moderate', 'Easy', 'Game', 'Rest']) {
    ok(`the spoken name "${spoken}" survives for accessibility`,
      new RegExp(`label: '${spoken}'`).test(table), spoken);
  }
  ok('and the strip still labels every day for a screen reader',
    /accessibilityLabel=\{`\$\{presentation\.label\} day`\}/.test(code));

  // THE BARS THEMSELVES: four distinct heights plus an outlined game, which is
  // the ruling's own taxonomy. A table where every fraction is 1 would pass a
  // "bars exist" check and draw five identical bars.
  const fractions = (table.match(/heightFraction: ([\d.]+)/g) ?? [])
    .map((m) => m.replace('heightFraction: ', ''));
  ok('the bar heights are distinct — tall, mid, short, flat',
    new Set(fractions).size >= 4, fractions);
  ok('and a game is drawn outlined rather than taller',
    /game: \{[^}]*outlined: true/.test(table), table.match(/game: \{[^}]*\}/));
}

// ─── [5] NOTHING NEW IS STORED ───────────────────────────────────────────

console.log('\n[5] THE NORTH STAR — an appearance pass stores nothing');
{
  // THE CONVERGENCE RULE, ASSERTED RATHER THAN ASSERTED IN A REPORT. A UI slice
  // is the easiest place in the app to mint stored state by accident — a
  // "dismissed" flag on an earned card, a remembered drawer position — and each
  // one would be derived output pretending to be a preference.
  const writers = [
    'setState(', 'persist(', 'AsyncStorage', 'useProgramStore.setState',
    'recordDecision', 'appendLedger',
  ];
  for (const writer of writers) {
    ok(`the screen reaches no writer: \`${writer}\``,
      !code.includes(writer), writer);
  }

  // THE ONE DOOR, unchanged by this slice — a note is an ANSWER, so recording
  // one is an input write and the north star allows it.
  const doors = code.match(/\brecordJournalNote\s*\(/g) ?? [];
  ok('exactly one write door, and it is the note',
    doors.length === 1, doors.length);

  // AND THE EARNED CARDS READ THROUGH THE PROVENANCE DOOR, never around it.
  // This is the mechanism that keeps an unsigned threshold off the screen, and
  // a new card is exactly where someone would reach for `.value`.
  ok('no derived value is read around `signedValue`',
    !/\bloadModel\.[A-Za-z]+\.value\b/.test(code), code.match(/\.value\b/g));
  ok('and the band edges are read through the door too, not off the constant',
    /signedValue\(load\.sweetSpotBand\)/.test(code)
    && !/JOURNAL_LOAD_CONSTANTS/.test(code));
}

console.log(`\njournalUiLawsTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — every cell reads SOURCE. No walked athlete, and no cell '
  + 'mounts the screen.');
console.log('  NOT COVERED: THE APPEARANCE ITSELF. This suite proves the screen obeys the '
  + 'ruling\'s STRUCTURE — the order, the tokens, the nulls, the dead letters. It cannot '
  + 'prove the result looks right, that a three-tile strip is legible, that the bars scan '
  + 'as a week, or that the hero fits on a phone. Sam\'s eye is the only instrument for '
  + 'that and this slice has NOT had it. The hex sweep is scoped to this ONE file and says '
  + 'nothing about the rest of the app, where raw literals may well exist — widening it is '
  + 'a unit of its own, not a line to slip in here.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
