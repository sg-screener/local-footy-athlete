(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * THIS WEEK'S JOB — Monday card / addendum Group 1 item 4.
 *
 * VERIFICATION STRATEGY (L12). Three classes, and the first one is here because
 * THE MODULE FAILED IT ON ITS FIRST VERSION:
 *
 *   - A STORED TALLY IS DERIVED OUTPUT AND GOES STALE. The first version read
 *     `achievedCount` and `unresolvedMinimumShortfall` off the stored contract
 *     and rendered a completion verdict from them;
 *     `section18ShortfallCopyTests` refused it — "no caller reads an achieved
 *     tally off a stored contract". [3] and [4] now assert the module touches
 *     neither, so the next reader cannot reintroduce a Monday snapshot as
 *     Thursday's truth.
 *   - THE JOURNAL CAN GROW A SECOND OPINION ABOUT WHAT THE WEEK ASKS. [4] sweeps
 *     the source and requires it builds no contract and counts no sessions.
 *   - A CONTRACT NOUN CAN REACH THE ATHLETE. [2] asserts the athlete word comes
 *     from the EXISTING owner, that domains with no word are dropped rather than
 *     rendered by their code name, and that Sam's forbidden vocabulary holds on
 *     this surface too.
 *
 * Run: npm run test:journal-week-job
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { buildJournalWeekJob } from '../rules/journalWeekJob';
import {
  ATHLETE_FORBIDDEN_VOCABULARY,
  ATHLETE_WORD_FOR_DOMAIN,
} from '../rules/section18ShortfallDisclosure';
import type { Section18NumericPolicy } from '../rules/weeklyExposureContractV2';
import { readFileSync } from 'fs';
import { join } from 'path';

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

// ─── Fixtures ────────────────────────────────────────────────────────────
//
// Only the fields this module reads are populated; the contract is enormous and
// a hand-built whole would be a second copy of a type nobody maintains here.

function policy(over: Partial<Section18NumericPolicy> = {}): Section18NumericPolicy {
  return {
    requiredMinimum: 2,
    defaultTarget: 3,
    preferredRange: { min: 2, max: 4 },
    permittedMaximum: null,
    plannerSelectedTarget: null,
    plannerSelectionKind: 'default',
    achievedCount: 0,
    unresolvedMinimumShortfall: 0,
    unresolvedPlannerSelectedShortfall: null,
    maximumBreach: null,
    ...over,
  } as Section18NumericPolicy;
}

const contract = (over: {
  strength?: Partial<Section18NumericPolicy>;
  conditioning?: Partial<Section18NumericPolicy>;
  sprint?: Partial<Section18NumericPolicy>;
} = {}) => ({
  mainStrength: { exposure: policy(over.strength) },
  conditioning: { core: policy(over.conditioning ?? { defaultTarget: 2 }) },
  sprintHighSpeed: { exposure: policy(over.sprint ?? { defaultTarget: 0 }) },
}) as never;

// ─── [1] The asks come off the contract ──────────────────────────────────

console.log('\n[1] THE ASKS');
{
  const job = buildJournalWeekJob(contract());
  ok('a contract with no week yields no job', buildJournalWeekJob(null) === null);
  ok('the asks are read from the contract\'s own policies',
    job !== null && job.asks.length === 2, job?.asks);

  ok('a domain the week does not ask for is dropped, not shown as zero',
    job !== null && !job.asks.some((a) => a.domain === 'sprint_high_speed'), job?.asks);

  // THE PLANNER'S NUMBER IS WHAT THIS ATHLETE'S WEEK WAS BUILT TO.
  // `defaultTarget` is what Section 18 asks of everybody.
  const planned = buildJournalWeekJob(contract({
    strength: { defaultTarget: 3, plannerSelectedTarget: 4 },
  }));
  ok('the planner\'s selected target wins over the default',
    planned?.asks.find((a) => a.domain === 'main_strength')?.target === 4,
    planned?.asks);
  ok('and the default stands in when the planner selected nothing',
    buildJournalWeekJob(contract())?.asks
      .find((a) => a.domain === 'main_strength')?.target === 3);
}

// ─── [2] The athlete's words, from the one owner ─────────────────────────

console.log('\n[2] THE ATHLETE\'S WORDS');
{
  const job = buildJournalWeekJob(contract());
  ok('each ask carries the athlete word, not the contract noun',
    job !== null
    && job.asks.find((a) => a.domain === 'main_strength')?.athleteWord === 'strength'
    && job.asks.find((a) => a.domain === 'conditioning')?.athleteWord === 'conditioning',
    job?.asks.map((a) => a.athleteWord));

  // THE WORD COMES FROM THE OWNER'S TABLE, so it cannot drift from what the
  // shortfall disclosure says about the same domain.
  ok('and the word IS the owner\'s, not a copy that agrees today',
    job?.asks.find((a) => a.domain === 'main_strength')?.athleteWord
      === ATHLETE_WORD_FOR_DOMAIN.main_strength);

  // SAM'S FORBIDDEN VOCABULARY, ENFORCED ON A NEW SURFACE. "Exposure" is a
  // contract noun and may never reach an athlete.
  for (const ask of job?.asks ?? []) {
    ok(`"${ask.athleteWord}" is not forbidden vocabulary`,
      !ATHLETE_FORBIDDEN_VOCABULARY.includes(ask.athleteWord.toLowerCase()));
  }
}

// ─── [3] The tallies are OFF LIMITS, and the gate said so ────────────────

console.log('\n[3] IT READS POLICY, NEVER A STORED TALLY');
{
  // THIS CELL EXISTS BECAUSE THE FIRST VERSION FAILED IT. The module read
  // `achievedCount` and `unresolvedMinimumShortfall` straight off the stored
  // contract, and `section18ShortfallCopyTests` went red with exactly the right
  // sentence: "no caller reads an achieved tally off a stored contract".
  //
  // A TARGET is policy — a decision about what the week asks, and stable.
  // An ACHIEVED TALLY is derived output, and a stored one goes stale beside the
  // facts it came from: the athlete trains on Thursday and the snapshot still
  // says what it said on Monday. The gate is the north star in miniature.
  const withStaleTallies = buildJournalWeekJob(contract({
    strength: { achievedCount: 99, unresolvedMinimumShortfall: 7 },
  }));
  const ask = withStaleTallies?.asks.find((a) => a.domain === 'main_strength');
  ok('an ask carries the TARGET and nothing else',
    ask !== undefined && Object.keys(ask).sort().join(',') === 'athleteWord,domain,target',
    ask && Object.keys(ask));
  ok('a wildly wrong stored tally cannot change what is reported',
    ask?.target === 3, ask);
  ok('and the job carries no verdict at all — that is the ledger\'s to give',
    withStaleTallies !== null && !('satisfied' in withStaleTallies),
    withStaleTallies && Object.keys(withStaleTallies));
}

// ─── [4] It asks. It does not count, and it does not build. ──────────────

console.log('\n[4] OWNERSHIP — the contract already knows');
{
  const source = readFileSync(join(__dirname, '..', 'rules', 'journalWeekJob.ts'), 'utf8');
  ok('the module source was read', source.length > 2000, source.length);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // THE TRAP THE MONDAY CARD PLAN NAMED IN ADVANCE. Building a contract, or
  // counting sessions, would each be a second answer to a question Section 18
  // already answers.
  ok('it builds no contract of its own',
    !/build[A-Za-z]*ExposureContract/.test(code), code.match(/build\w+/g));
  ok('it does not re-derive achieved counts from a projection',
    !/\bVisibleDay\b|\bcountWeeklyExposures\b|sessionFeedback/.test(code));
  // AND IT TOUCHES NO STORED TALLY, which is the law
  // `section18ShortfallCopyTests` enforces app-wide and which this module
  // violated on its first version.
  ok('it reads NO stored achieved tally — the gate\'s law, asserted locally too',
    !/\bachievedCount\b/.test(code)
    && !/\bunresolvedMinimumShortfall\b/.test(code),
    code.match(/achieved\w*|unresolved\w*/g));
  ok('and it takes the athlete word from the owner rather than a local table',
    /\bATHLETE_WORD_FOR_DOMAIN\b/.test(code)
    && !/main_strength:\s*'strength'/.test(code));

  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the screen source was read', screen.length > 4000, screen.length);
  ok('the screen reads the contract off the microcycle rather than composing one',
    /exposureContractV2/.test(screen) && /\bbuildJournalWeekJob\s*\(/.test(screen));

  // THREE-STATE RENDERING, ASSERTED AT THE SURFACE. A `!job.satisfied` test
  // would render the unknown state as a failure, which is the whole point of
  // the null.
  const jobStart = screen.indexOf('function WeekJob');
  const jobEnd = screen.indexOf('\n/**', jobStart);
  ok('the WeekJob component was located', jobStart > 0 && jobEnd > jobStart,
    { jobStart, jobEnd });
  const region = screen.slice(jobStart, jobEnd);
  ok('and the located region is substantial', region.length > 300, region.length);
  // THE SURFACE STATES THE ASK AND CLAIMS NOTHING ABOUT COMPLETION. "Did the
  // work happen" one section down answers that from recorded outcomes; a second
  // verdict here, from a stale snapshot, would be two answers to one question.
  ok('the surface renders no completion verdict at all',
    !/satisfied/.test(region), region.match(/satisfied[^\n]*/g));
  for (const testId of ['journal-job-none', 'journal-job-asks']) {
    ok(`the screen renders \`${testId}\``, new RegExp(`testID="${testId}"`).test(screen));
  }
}

console.log(`\njournalWeekJobTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure derivation with a hand-built '
  + 'contract slice. It does NOT generate a real week, and no cell here mounts a surface.');
console.log('  NOT COVERED: the fixture populates only the three numeric policies this '
  + 'module reads — a change to the CONTRACT\'S shape reaches this suite through the '
  + 'compiler, not through the fixture. Whether `achievedCount` is kept current by the '
  + 'resolver on a live device is NOT asserted here and is the one thing that would '
  + 'make the status line wrong while every cell stayed green. No device evidence.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
