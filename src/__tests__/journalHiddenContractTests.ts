(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/**
 * THE JOURNAL IS HIDDEN — Sam, 2026-08-09, after his own eye pass.
 *
 * > "journal looks really bad - i'm not sure it's actually useful as it is -
 * > maybe we come back to it... i'd like all the journal stuff hidden for now -
 * > keep the data behind the scenses because it might be useful for the coach."
 *
 * Ruling: `docs/JOURNAL_HIDDEN_RULING_2026-08-09.md`. This suite is the ratchet
 * that ruling requires — **the gate must watch the deleted surface**, or one
 * restored import brings back a screen its owner has ruled on and nothing
 * notices. R5.7's coach cut is the precedent in shape and in wording: ENTRY
 * SURFACE GONE, MACHINERY FROZEN NOT DELETED.
 *
 * VERIFICATION STRATEGY (L12) — what catches the NEXT defect of each class:
 *
 *   - THE SURFACE COMES BACK BY ACCIDENT. A tab block is twenty lines and a
 *     `navigate` call is one. [1] sweeps the whole PRODUCT tree for either,
 *     rather than reading the navigator alone, because the door that returns is
 *     rarely the door that left.
 *   - THE HIDE BECOMES A RETIREMENT. Sam kept the data on purpose: it is the
 *     coach rebuild's input. [2] pins every module and [5] pins every suite in
 *     the chain, so "hidden" cannot decay into "deleted" one tidy-up at a time.
 *   - A NOTIFICATION FIRES INTO A SURFACE THAT IS NOT THERE. The ruling says
 *     "unreachable = nothing can ever fire". That is a CLAIM, and it is only
 *     true of future schedules — **the OS is the store**, and it kept what the
 *     surface put there. [3] proves both halves: nothing reachable can arm it,
 *     and the navigator cancels what is already armed.
 *   - THE HIDE TAKES THE RECORD WITH IT. The two data-CREATING taps are
 *     seat-ruled to stay (ruling 3, Sam's veto open) and they live on a
 *     different screen. [4] proves that screen is still REACHABLE — hop by
 *     hop, each anchor proven found — because "it still exists" is not the
 *     claim; "an athlete can still answer it" is.
 *
 * SOURCE-SCAN LAW (AGENTS.md) applies throughout: comment lines are stripped
 * before any assertion, every anchor is proven FOUND before its position is
 * used, and no cell is a bare count.
 *
 * Run: npm run test:journal-hidden
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';

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

const SRC = resolve(__dirname, '..');
const ROOT = resolve(SRC, '..');

/**
 * A file with its COMMENT LINES REMOVED.
 *
 * A gate reading source cannot tell a comment from a shipped line, and this
 * repo has paid for that four times. The hide's own comment quotes the tab it
 * removed — of course it does, that is what a record of a removal looks like —
 * so a raw-source cell would fail on the note explaining why it passes.
 */
function strip(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

function read(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), 'utf8');
}

/**
 * Every PRODUCT source as [repo-relative path, stripped body].
 *
 * `__tests__` and `dev` are excluded deliberately, the same way
 * `coachEntrySurfaceContractTests` excludes them: the question is what can
 * REACH the Journal in the app that ships. A suite naming the route is
 * evidence, not a door.
 */
function productSources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'dev' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push([relative(SRC, full), strip(readFileSync(full, 'utf8'))]);
      }
    }
  };
  walk(SRC);
  return out;
}

const PRODUCT = productSources();
const navigator = strip(read('navigation', 'AppNavigator.tsx'));

// ─── [1] THE ENTRY SURFACE IS GONE ───────────────────────────────────────

console.log('\n[1] THE ENTRY SURFACE IS GONE (ruling 1)');
{
  ok('the product tree was walked and is substantial',
    PRODUCT.length > 100, PRODUCT.length);
  ok('the navigator source was found and is substantial',
    navigator.length > 2000, navigator.length);

  ok('AppNavigator registers no Journal tab',
    !/<Tab\.Screen[^>]*name=["'`]JournalTab["'`]/s.test(navigator));

  // A COUNT IS NEVER THE WHOLE ASSERTION. The number is meaningless unless the
  // tabs that SURVIVE are named — a navigator holding three tabs none of which
  // is Program would satisfy a bare count perfectly.
  //
  // RE-AIMED 2026-08-09, NOT LOOSENED. This read "two tabs remain, not three".
  // The two was never this gate's law: the journal's absence is, and the total
  // was whatever the navigator happened to hold on the day it was written. Sam
  // approved the coach tab (docs/COACH_TAB_MOCK_2026-08-09.html) and slice 1
  // mounted it, so the total moved to three with the journal still gone. The
  // cell that matters is the one directly above — no `JournalTab` block — and
  // this one now pins the exact SET, which is strictly stronger than a number:
  // it reds both when a tab appears and when one silently vanishes.
  const tabBlocks = navigator.match(/<Tab\.Screen\b/g) ?? [];
  ok('three tabs remain, and none of them is the journal',
    tabBlocks.length === 3, tabBlocks.length);
  const survivors = ['ProgramTab', 'CoachTab', 'ProfileTab']
    .map((name) => ({ name, at: navigator.indexOf(`name="${name}"`) }));
  const missing = survivors.filter((tab) => tab.at < 0).map((tab) => tab.name);
  ok('and both surviving tabs are PRESENT before any claim is made about them',
    missing.length === 0, missing);

  // THE DOOR THAT RETURNS IS RARELY THE DOOR THAT LEFT — so the sweep is over
  // the product tree, not over the navigator that happens to hold it today.
  const mounts = PRODUCT.filter(([, body]) => /component=\{JournalScreen\}/.test(body));
  ok('no product source mounts the Journal screen as a route',
    mounts.length === 0, mounts.map(([file]) => file));

  const doors = PRODUCT.filter(([, body]) => /navigate\(\s*['"`]JournalTab/.test(body));
  ok('no product source navigates to the Journal tab',
    doors.length === 0, doors.map(([file]) => file));

  const testIds = PRODUCT.filter(([, body]) => /['"`]tab-journal['"`]/.test(body));
  ok('and the tab button is gone with it — no product source names its testID',
    testIds.length === 0, testIds.map(([file]) => file));
}

// ─── [2] THE MACHINERY IS FROZEN, NOT DELETED ────────────────────────────

console.log('\n[2] THE MACHINERY IS FROZEN, NOT DELETED (ruling 2 + 4)');
{
  // Sam's own reason, and it is the whole point of a hide rather than a
  // retirement: "keep the data behind the scenses because it might be useful
  // for the coach". The coach rebuild reads this record. A tidy-up that
  // deleted an unreachable module would be deleting the coach's input.
  const FROZEN: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['the screen itself', ['screens', 'journal', 'JournalScreen.tsx']],
    ['the week derivation', ['rules', 'journalWeek.ts']],
    ['the load model', ['rules', 'journalLoad.ts']],
    ['the monthly review', ['rules', 'journalMonth.ts']],
    ['what changed', ['rules', 'journalChanges.ts']],
    ['niggle history', ['rules', 'journalNiggleHistory.ts']],
    ['the strength line', ['rules', 'journalStrengthTrend.ts']],
    ['this week\'s job', ['rules', 'journalWeekJob.ts']],
    ['week status', ['rules', 'journalWeekStatus.ts']],
    ['the note store', ['store', 'journalNoteStore.ts']],
    ['the reminder rule', ['rules', 'journalReminder.ts']],
    ['the reminder service', ['services', 'journalReminderService.ts']],
  ];
  for (const [what, parts] of FROZEN) {
    let size = 0;
    try {
      size = read(...parts).length;
    } catch {
      size = 0;
    }
    ok(`${what} is still in the tree and substantial`, size > 500, { parts, size });
  }

  // The import is the reachability cell slice 1 wrote, re-aimed rather than
  // deleted: it used to prove the screen was WIRED, and now proves it is still
  // KEPT. Restoring the surface is one Tab.Screen block, exactly as R5.7 left
  // the coach.
  ok('AppNavigator still imports the Journal screen (frozen, not retired)',
    /import\s+JournalScreen\s+from\s+['"]\.\.\/screens\/journal\/JournalScreen['"]/
      .test(navigator));
}

// ─── [3] NOTHING CAN EVER FIRE — measured, not promised ──────────────────

console.log('\n[3] NOTHING CAN EVER FIRE (ruling 1) — and the OS kept what it was given');
{
  // HALF ONE: nothing reachable can ARM it. The opt-in is a tap on the hidden
  // screen and nowhere else, so the sweep asserts the caller SET rather than
  // the absence of a call — an opt-in that moved to a reachable screen would
  // pass an absence cell and re-arm the feature.
  //
  // THE DECLARATION IS NOT A CALL, and the first run of this cell said it was:
  // the service that OWNS `enableJournalReminder` contains the identifier, so
  // the sweep read its own owner as a second opt-in. `a count taken for a
  // record` in its source-scan form — the instrument counted OCCURRENCES of a
  // name and the claim was about CALL SITES. The owner is asserted separately
  // and by its declaration, so it cannot silently drop out of the set either.
  const OWNER = join('services', 'journalReminderService.ts');
  const mentions = PRODUCT.filter(([, body]) => /\benableJournalReminder\b/.test(body));
  const owner = mentions.find(([file]) => file === OWNER);
  ok('the opt-in still has exactly one owner, and it declares it',
    owner !== undefined && /export async function enableJournalReminder\s*\(/.test(owner[1]),
    mentions.map(([file]) => file));
  const enablers = mentions
    .filter(([file]) => file !== OWNER)
    .map(([file]) => file);
  ok('and the only product caller of the opt-in is the hidden screen',
    enablers.length === 1 && enablers[0] === join('screens', 'journal', 'JournalScreen.tsx'),
    enablers);

  // The two modules allowed to talk to the notification centre's scheduler,
  // named rather than counted. The proof panel's service is in the list because
  // it exists; it is reached only from the hidden screen, which the next cell
  // proves — so it is as dark as the opt-in.
  const schedulers = PRODUCT
    .filter(([, body]) => /\bscheduleNotificationAsync\s*\(/.test(body))
    .map(([file]) => file);
  ok('and only the reminder service and its proof can schedule anything at all',
    schedulers.length === 2
    && schedulers.includes(join('services', 'journalReminderService.ts'))
    && schedulers.includes(join('services', 'journalReminderProof.ts')),
    schedulers);

  const proofMounts = PRODUCT
    .filter(([, body]) => /JournalReminderProofPanel/.test(body))
    .map(([file]) => file);
  ok('the dev proof panel is reachable only from the hidden screen — it is dark too',
    proofMounts.every((file) => file === join('screens', 'journal', 'JournalScreen.tsx')
      || file === join('components', 'dev', 'JournalReminderProofPanel.tsx')),
    proofMounts);

  // HALF TWO, AND IT IS THE HALF THE RULING'S OWN WORDING DOES NOT COVER. A
  // weekly trigger accepted before today keeps firing every Monday whether the
  // app is opened or not. Hiding a surface does not reach into the OS store.
  //
  // THE END ANCHOR IS `<Tab.Navigator` AND NOT `return (`, because the first
  // version of this cell located a 175-character region: the mount logger's
  // own `return () => logger.info(...)` is a `return (` too. It reported the
  // region as missing rather than passing on it, which is the anchoring law
  // doing its job — but a cell that cannot find its subject proves nothing
  // either way, so the anchor is one that appears once.
  const effectStart = navigator.indexOf('export default function AppNavigator');
  const effectEnd = navigator.indexOf('<Tab.Navigator', effectStart + 1);
  ok('the navigator body was located and is substantial',
    effectStart > 0 && effectEnd > effectStart && effectEnd - effectStart > 200,
    { effectStart, effectEnd });
  const body = navigator.slice(effectStart, effectEnd);
  ok('and it cancels the reminder on mount, through the service door',
    /disableJournalReminder\s*\(\s*\)/.test(body), body.length);

  // THE TAP DOOR WENT WITH THE TAB. Navigating to a name the navigator does not
  // know throws, and a notification delivered between the last schedule and the
  // cancel is exactly the case that would have found it — with the athlete not
  // yet in the app, which is the worst place in this app to crash.
  ok('and the notification tap door is gone, not left pointing at a missing tab',
    !/addNotificationResponseReceivedListener/.test(navigator));
}

// ─── [4] THE TWO DATA-CREATING TAPS STAY ─────────────────────────────────

console.log('\n[4] THE TWO DATA-CREATING TAPS STAY (ruling 3 — seat-ruled, Sam\'s veto open)');
{
  // Hiding these would stop the record Sam explicitly said to keep. They live
  // on the session feedback panel, not on the Journal, so the hide does not
  // touch them — but "does not touch them" is a claim about REACHABILITY, and
  // reachability is what this block proves, hop by hop.
  const form = strip(read('utils', 'sessionFeedbackForm.ts'));
  ok('the effort question is still authored',
    /expectation:\s*'How did that go\?'/.test(form));

  const panel = strip(read('components', 'SessionFeedbackPanel.tsx'));
  ok('the panel source was found and is substantial', panel.length > 5000, panel.length);
  ok('and it still builds the post-game rating and the effort answer into its payload',
    /gameFeel:\s*isGameDay \? gameFeel : null/.test(panel)
    && /expectation,/.test(panel)
    && /expectationReason:/.test(panel));

  const dayWorkout = strip(read('screens', 'home', 'DayWorkoutScreenV2.tsx'));
  ok('the day workout screen still mounts the panel',
    /<SessionFeedbackPanel\b/.test(dayWorkout));

  // THE LAST HOP, AND IT IS THE ONE THAT MAKES THE OTHERS MEAN ANYTHING. A
  // panel mounted by a screen no navigator registers is as hidden as the
  // Journal — which is precisely the failure this ruling is asking us not to
  // repeat somewhere else.
  ok('and the Program stack still registers the day workout route it lives on',
    /<ProgramStack\.Screen\b[^>]*name="DayWorkout"/s.test(navigator));
}

// ─── [5] THE DATA LAYER STAYS LIVE IN THE CHAIN ──────────────────────────

console.log('\n[5] THE DATA LAYER STAYS LIVE IN THE CHAIN (ruling 2)');
{
  // A hidden surface's suites are the first thing a future tidy-up drops from
  // the chain — they test a screen nobody can open. They are not testing the
  // screen: they are testing the record the coach rebuild will read, and a
  // derivation nothing runs is a derivation nothing can trust when it does.
  const pkg = readFileSync(join(ROOT, 'package.json'), 'utf8');
  const bibleAt = pkg.indexOf('"test:bible"');
  const bibleEnd = pkg.indexOf('\n', bibleAt);
  ok('the chain definition was located', bibleAt > 0 && bibleEnd > bibleAt,
    { bibleAt, bibleEnd });
  const chain = pkg.slice(bibleAt, bibleEnd);

  const SUITES = [
    'test:journal-week', 'test:journal-load', 'test:journal-feel',
    'test:journal-strength-trend', 'test:journal-week-job',
    'test:journal-niggle-history', 'test:journal-month', 'test:journal-changes',
    'test:journal-note-ownership', 'test:journal-ui', 'test:journal-reminder',
    'test:journal-hidden',
  ];
  const absent = SUITES.filter((suite) => !chain.includes(`npm run ${suite}`));
  ok('every journal suite — including this one — still runs in test:bible',
    absent.length === 0, absent);
}

console.log(`\njournalHiddenContractTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — this is a SOURCE contract. No athlete is walked and no '
  + 'screen is mounted, because what is being asserted is the absence of a route, which '
  + 'is a property of the wiring rather than of a state.');
console.log('  NOT COVERED, first line: NOBODY HAS SEEN THE TAB BAR WITH TWO TABS IN IT. '
  + 'That the remaining two lay out correctly at the tab bar\'s fixed height, that no '
  + 'other screen linked to the Journal by a route this sweep does not spell the same '
  + 'way, and that the cancel actually empties the notification centre are all '
  + 'unverified. THE CANCEL IS THE ONE THAT MATTERS: no cell here calls the OS, so '
  + '"the reminder is cancelled" is proven only as far as "the door is called on mount". '
  + 'Whether a schedule was ever accepted on Sam\'s device is unknown to this repo — he '
  + 'may never have tapped the opt-in, in which case there is nothing to cancel and the '
  + 'call is a no-op.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
