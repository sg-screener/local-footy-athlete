/**
 * COACH SCREEN ENTRY SURFACE — source-level contract (ruling 13).
 *
 * Sam's design ruling 13 (`docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`):
 * "All seven preset question chips REMOVED from the Coach screen (I missed a
 * session / I'm sore / Feeling cooked this week / Game day changed / Swap an
 * exercise / Busy week / I'm injured). The athlete just talks to the coach via
 * the input. UI-surface change only — no coach pipeline logic is touched (LR-6
 * stop on coach work stands)."
 *
 * Both halves of that ruling are pinned here as source contracts — the same
 * style as `exerciseEditEntrySurfaceContractTests` (the repository ships no
 * native component renderer, so these read the file rather than mount it):
 *
 *   1. The retired entry surface is actually gone — no `QUICK_ACTIONS` array,
 *      no `QuickAction` type, no chip render, no chip styles, and no
 *      `handleQuickAction` handler left as dead code behind them. The seven
 *      label strings are asserted individually, because a partial retirement
 *      (six chips gone, one kept) is exactly the shape a careless edit takes.
 *   2. The surviving entry surface — the input the athlete now types into —
 *      still exists, so "the chips are gone" cannot be satisfied by deleting
 *      the way in altogether.
 *   3. THE LR-6 LINE, as a contract rather than a promise. The chip removal is
 *      a UI-surface change; the pipeline the input feeds is frozen. Every
 *      pipeline symbol CoachScreen owned before the chips left must still be
 *      named in the file, so a future rewrite of the entry surface cannot
 *      quietly take a send path or a client guard out with it.
 *
 * WHY `route.params.prefill` SURVIVES AND IS PINNED — AND WHY ITS ORIGINAL
 * REASON NO LONGER HOLDS (R5.7, 2026-08-07). The stated reason was that "other
 * screens navigate to Coach with a `prefill` param (the day-menu 'Ask the
 * coach' doors)". **There are now ZERO such producers** — the beta coach cut
 * (§6, decision C(a), signed; Sam's "MAKE THE CUT" 2026-08-07) removed the
 * `CoachTab` tab and all three `navigate('CoachTab')` doors. The assertion
 * still stands, but on a DIFFERENT ground: LR-6 freezes CoachScreen and its
 * pipeline in the tree, so the param path must not be quietly deleted while
 * the screen is frozen. A passing gate whose stated reason has become false is
 * a gate nobody can trust, so the reason is corrected here rather than left.
 *
 * THE RULING'S OWN EXPECTATION IS CORRECTED TOO. R5.7 was scoped believing it
 * would INVERT cell [2] ("R5.7 inverts that cell"). Measured: it does not. This
 * suite reads CoachScreen's source, R5.7 cuts the ENTRY and not the screen, and
 * the suite passes 33/33 untouched. Nothing was inverted, and nothing needed to
 * be — recorded so the next reader does not go looking for a flip that never
 * happened.
 *
 * WHAT R5.7 DID OWE, AND WHAT SECTION [4] IS. A cut with no gate watching the
 * deleted surface is one careless import from coming back — the repo's own law
 * ("the gate must watch the deleted surface"). Section [4] is that ratchet.
 *
 * Run: npm run test:coach-entry-surface
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

const SCREEN = path.resolve(__dirname, '..', 'screens', 'coach', 'CoachScreen.tsx');
const source = fs.readFileSync(SCREEN, 'utf8');

const PACKET = path.resolve(__dirname, '..', 'utils', 'coachContextPacket.ts');
const packetSource = fs.readFileSync(PACKET, 'utf8');

/**
 * Every PRODUCT source, as [repo-relative path, body]. Tests and dev/E2E are
 * excluded on purpose: section [4] asks what can REACH the coach in the app
 * that ships, and a suite naming the route is evidence rather than a door.
 */
function readProductSources(): Array<[string, string]> {
  const root = path.resolve(__dirname, '..');
  const out: Array<[string, string]> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'dev' || entry.name === 'node_modules') {
          continue;
        }
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        // CODE LINES ONLY, and the reason is a caught defect rather than a
        // precaution: the first run of section [4] failed on AppNavigator
        // because the COMMENT explaining the cut contains the very string the
        // cell forbids. A note is output, never evidence — the same law
        // `signedCopyExtractionTests` and cell [1] already follow.
        const body = fs.readFileSync(full, 'utf8')
          .split('\n')
          .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
          .join('\n');
        out.push([path.relative(root, full), body]);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * The screen with its comment lines stripped.
 *
 * The retired strings are ordinary English — "I'm sore" also appears inside a
 * comment explaining what the injury guard does with a message that names no
 * body part. Asserting against raw source would make that prose un-writable and
 * would pass/fail on wording rather than on what ships, so the string
 * retirements are checked against CODE lines only. This mirrors
 * `signedCopyExtractionTests`'s own extractor, which skips comment lines for the
 * same reason.
 */
const codeSource = source
  .split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join('\n');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[1] The seven preset chips are gone (ruling 13)');
{
  ok(
    'no QUICK_ACTIONS array',
    !/QUICK_ACTIONS/.test(source),
    'ruling 13 retires the chips entirely — the array is the feature, and a '
      + 'lingering array is a render one JSX line away from returning',
  );
  ok(
    'no QuickAction type',
    !/\bQuickAction\b/.test(source),
    'the interface existed only to type the retired array',
  );
  ok(
    'no handleQuickAction handler',
    !/handleQuickAction/.test(source),
    'the chips were its only caller — retiring the surface with the callback '
      + 'still defined would be new dead code, not a retirement',
  );
  ok(
    'no quick-action styles',
    !/quickActionsContainer/.test(source)
      && !/quickActionChip/.test(source)
      && !/quickActionText/.test(source),
    'four StyleSheet entries (container, chip, chipPressed, text) existed only '
      + 'for the chip row',
  );
  ok(
    'the message list has no chip ListFooterComponent',
    !/ListFooterComponent[\s\S]{0,200}messages\.length === 1/.test(source),
    'the chips rendered as the FlatList footer on the welcome-only turn — that '
      + 'render position must not survive the array\'s deletion',
  );

  const RETIRED_LABELS = [
    'I missed a session',
    "I'm sore",
    'Feeling cooked this week',
    'Game day changed',
    'Swap an exercise',
    'Busy week',
    "I'm injured",
  ];
  for (const label of RETIRED_LABELS) {
    ok(
      `the chip label ${JSON.stringify(label)} is gone`,
      !codeSource.includes(label),
      'ruling 13 names all seven — a partial retirement leaves the athlete one '
        + 'preset question and no explanation for why that one survived',
    );
  }

  const RETIRED_PREFILLS = [
    "I missed yesterday's session - ",
    "I'm pretty sore today, especially in my ",
    "I'm feeling cooked this week - can we lighten the load?",
    "My game day's changed - ",
    'Can you swap ',
    "I've got a busy week ahead - ",
    "I've picked up a niggle - ",
  ];
  for (const prefill of RETIRED_PREFILLS) {
    ok(
      `the chip prefill ${JSON.stringify(prefill)} is gone`,
      !codeSource.includes(prefill),
      'each chip carried a half-written message into the input; the prefills '
        + 'retire with the labels, not after them',
    );
  }
}

console.log('\n[2] The surviving entry surface — the athlete types');
{
  ok(
    'the coach input still exists',
    source.includes('coach-input') || /inputRef/.test(source),
    'ruling 13: "The athlete just talks to the coach via the input" — deleting '
      + 'the chips must not delete the way in',
  );
  ok(
    'the send control still exists',
    /coach-send/.test(source) || /handleSend/.test(source),
    'the input needs its send path; the chips never owned it and must not take '
      + 'it with them',
  );
  ok(
    'the route `prefill` param path survives',
    /route\.params\?\.prefill/.test(source) && /setInputValue\(prefill\)/.test(source),
    'other screens navigate to Coach with a prefill param — ruling 13 retires '
      + 'the CHIPS, not prefilling, so this producer stays',
  );
}

console.log('\n[3] THE LR-6 LINE — the pipeline behind the input is untouched');
{
  // Ruling 13 is explicit: "UI-surface change only — no coach pipeline logic is
  // touched (LR-6 stop on coach work stands)." These are the pipeline symbols
  // CoachScreen named before the chips left. Each must still be here, so the
  // entry-surface edit cannot quietly retire a send path, a guard or a store.
  const PIPELINE_SYMBOLS = [
    'handleCoachTurn',
    'coachTurnController',
    'buildProgramTabProjectedWeek',
    'buildScheduleStateImperative',
    'applyProgramAdjustment',
    'resolveInjuryFromMessage',
    'createOrUpdateInjuryEpisode',
    'computeVisibleDiff',
    'snapshotVisibleWorkout',
  ];
  for (const symbol of PIPELINE_SYMBOLS) {
    ok(
      `${symbol} still named in CoachScreen (LR-6: UI only)`,
      new RegExp(`\\b${symbol}\\b`).test(source),
      `ruling 13 changes the entry surface and nothing else — ${symbol} is `
        + 'pipeline the chips never owned',
    );
  }
}

console.log('\n[4] The packet still feeds the frozen layers their exact shape');
{
  // Task 10's half B (the packet's day summaries reading the projection) is
  // NOT-COVERED: every prose field in the packet's day summary is a matching
  // key the frozen router/executor string-compare against a `ResolvedDay`
  // (`coachCommandRouter.findTargetVisibleSession`,
  // `coachCommandExecutor.isEmptyTargetForStandaloneConditioningAdd`). The
  // trace is in `.superpowers/sdd/2026-07-31-buttons-ui-unit/task-10-report.md`.
  // This cell pins the shape that trace depends on, so the NOT-COVERED reason
  // cannot go stale without a test noticing.
  ok(
    'the packet still builds currentWeek/nextWeek from buildProgramTabProjectedWeek',
    /const currentWeek = buildProgramTabProjectedWeek\(/.test(packetSource)
      && /const nextWeek = buildProgramTabProjectedWeek\(/.test(packetSource),
    'the frozen resolvers (`resolveCoachTargetFrame`, `buildProgramEditDraft`, '
      + '`autoBindUniqueModalityTarget`, `coachTurnController`) consume these as '
      + '`ResolvedDay[]`; changing the producer changes their behaviour, which '
      + 'LR-6 forbids',
  );
  ok(
    'the LLM day summary still carries the session name the executor matches on',
    /name: d\.workout\.name/.test(packetSource),
    '`serialisePacketForLLM`\'s `stripDay` is the LLM\'s only view of what is on '
      + 'a day. The names it shows are the vocabulary the classifier can return '
      + 'as `payload.targetSessionName`, which `coachCommandRouter` compares '
      + 'case-insensitively against `entry.sessionName`. Replacing them with '
      + 'projection headlines changes what the frozen router resolves',
  );
}

console.log('\n[4] R5.7 — THE BETA COACH CUT: the entry surface is GONE and stays gone');
{
  // THE GATE MUST WATCH THE DELETED SURFACE. R5.7 removed the `CoachTab` tab
  // and every door that navigated to it (§6, decision C(a), signed; Sam's
  // "MAKE THE CUT", 2026-08-07). Without a ratchet, one restored import or one
  // copied-in navigate call brings the beta chat surface back and no gate
  // notices — which is how a scope cut becomes a half-alive surface.
  //
  // It reads the PRODUCT tree, not this file's own subject: the cut is about
  // what can REACH the coach, and CoachScreen itself is deliberately untouched
  // (LR-6). Test sources are excluded — a suite naming the route is evidence,
  // not a door.
  const productSources = readProductSources();
  const navigateDoors = productSources.filter(([, body]) =>
    /navigate\(\s*['"`]CoachTab['"`]/.test(body));
  ok(
    'no product source navigates to CoachTab',
    navigateDoors.length === 0,
    'R5.7 cut all three doors (useHomeScreen, useDayWorkout, ProfileScreen). '
      + `A new one is the beta chat surface returning: ${
        navigateDoors.map(([file]) => file).join(', ') || 'none'}`,
  );
  const navigatorSource = productSources
    .find(([file]) => file.endsWith('AppNavigator.tsx'))?.[1] ?? '';
  ok(
    'AppNavigator registers no CoachTab tab screen',
    navigatorSource.length > 0
      && !/<Tab\.Screen[^>]*name=["'`]CoachTab["'`]/s.test(navigatorSource),
    'the tab is the surface C(a) hides entirely; the stack and CoachScreen '
      + 'stay in the tree FROZEN, which is a scope cut, not a retirement',
  );
  ok(
    'the frozen coach stack is still in the tree (LR-6, not a retirement)',
    /CoachStackNavigator/.test(navigatorSource) && /CoachScreen/.test(navigatorSource),
    'R5.7 is §6\'s scope cut. Deleting the stack would make it a retirement, '
      + 'which LR-6 forbids and which restoring the tab could not undo',
  );
}

console.log(`\nCoach entry-surface totals: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
