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
 * WHY `route.params.prefill` SURVIVES AND IS PINNED. The chips were not the
 * only producer of a prefilled input: other screens navigate to Coach with a
 * `prefill` param (the day-menu "Ask the coach" doors). Ruling 13 retires the
 * CHIPS, not prefilling — so the param path is asserted present, and its
 * absence would be a different feature dying by accident.
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

console.log(`\nCoach entry-surface totals: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
