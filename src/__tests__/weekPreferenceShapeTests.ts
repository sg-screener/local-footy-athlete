/**
 * IS THIS A WEEK SAM WOULD WRITE — the rules, held.
 *
 * Seat item 5. `test:qa` PRINTS the preference report across all 17 scenarios;
 * this suite is where the report's rules are enforced, and the split is
 * deliberate: `test:qa` carries 84 pre-existing failures, so a verdict wired
 * into its exit code would be indistinguishable from them on every run.
 * **Printing is not enforcing** — the harness measures, these cells decide.
 *
 * THE BASELINE IS READ FROM DISK, NOT FABRICATED. A cell that only ever sees
 * hand-written rows would pass while the committed baseline rotted into a shape
 * the comparator cannot read.
 *
 * Run: npm run test:preference-shape
 */

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import {
  PREFERENCE_AXES,
  comparePreferenceRuns,
  preferenceRow,
  preferenceTable,
  type WeekPreferenceRow,
} from '../rules/weekPreferenceShape';

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const BASELINE_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'preference-baseline.json');

/** A week that satisfies both ruled preferences, unless overridden. */
function row(overrides: Partial<Parameters<typeof preferenceRow>[0]> = {}): WeekPreferenceRow {
  return preferenceRow({
    scenarioId: 'X',
    hardDays: 4,
    anchorHardDays: 2,
    moderateDays: 1,
    preferredHardDayMax: 4,
    permittedHardDayMax: 5,
    ...overrides,
  });
}

run('the score counts RULED preferences and nothing else', () => {
  assert(PREFERENCE_AXES.length === 2,
    `the axes changed to ${PREFERENCE_AXES.length}; a new axis is a new RULING and needs its quote in the module`);
  assert(row().score === 2 && row().samShapeMet, 'a week meeting both preferences did not score 2');
  assert(row({ moderateDays: 0 }).score === 1, 'a week with no moderate day still scored 2');
  assert(row({ hardDays: 5 }).score === 1, 'a fifth hard day did not cost the hard-day preference');
  assert(row({ hardDays: 5, moderateDays: 0 }).score === 0, 'a week meeting neither preference scored above 0');
});

run('a fifth hard day is UNPREFERRED, never illegal', () => {
  // Sam, 2026-08-12: "4 hard days plus 1 moderate/easy day is prefered but 5
  // hard days is okay". Stand-down A exists because this was nearly enforced.
  const five = row({ hardDays: 5 });
  assert(five.hardViolation === false, 'five hard days was reported as a hard violation — stand-down A');
  assert(five.score === 1, 'the fifth hard day cost more than the one preference it breaches');
  assert(row({ hardDays: 6 }).hardViolation === true, 'six hard days passed the permitted maximum of five');
});

run('the preferred maximum is READ from the contract, never hard-coded', () => {
  // The off-season scenarios carry preferredMax 2 / permitted 4. A cell that
  // assumed 4 and 5 would call those weeks unpreferred for having 3 hard days.
  const offSeason = row({ hardDays: 2, preferredHardDayMax: 2, permittedHardDayMax: 4 });
  assert(offSeason.score === 2, 'a week at ITS OWN preferred maximum was marked unpreferred');
  assert(row({ hardDays: 3, preferredHardDayMax: 2, permittedHardDayMax: 4 }).score === 1,
    'a week over its own preferred maximum kept the preference');
  assert(row({ hardDays: 5, preferredHardDayMax: 2, permittedHardDayMax: 4 }).hardViolation,
    'a week over its own PERMITTED maximum was not a hard violation');
});

run('a regression, an improvement and a hard failure are three different answers', () => {
  const before = [row({ scenarioId: 'A' }), row({ scenarioId: 'B', moderateDays: 0 })];
  const after = [
    row({ scenarioId: 'A', moderateDays: 0 }),
    row({ scenarioId: 'B' }),
  ];
  const comparison = comparePreferenceRuns(before, after);
  assert(comparison.regressions.join() === 'A', `expected A to regress, got ${comparison.regressions.join()}`);
  assert(comparison.improvements.join() === 'B', `expected B to improve, got ${comparison.improvements.join()}`);
  assert(comparison.clean === false, 'a run with a regression reported itself clean');

  const illegal = comparePreferenceRuns(
    [row({ scenarioId: 'A' })],
    [row({ scenarioId: 'A', hardDays: 9 })],
  );
  assert(illegal.hardFailures.join() === 'A', 'a new hard violation was not a hard failure');
  assert(illegal.regressions.length === 0,
    'a hard failure was ALSO counted as a preference regression — one event, two names, '
    + 'and the blocking one must not be diluted by the advisory one');
});

run('over-fitting is REJECTED — one big gain, broad regression', () => {
  // Sam's oldest fear, made mechanical: "I don't want to get 2 weeks down the
  // line and realise that a weekly template optimised for that and that alone."
  const before = ['A', 'B', 'C', 'D'].map((id) => row({ scenarioId: id, moderateDays: 0 }));
  const after = [
    row({ scenarioId: 'A' }),
    row({ scenarioId: 'B', hardDays: 5, moderateDays: 0 }),
    row({ scenarioId: 'C', hardDays: 5, moderateDays: 0 }),
    row({ scenarioId: 'D', moderateDays: 0 }),
  ];
  const comparison = comparePreferenceRuns(before, after);
  assert(comparison.improvements.join() === 'A', 'the single gain was not seen');
  assert(comparison.regressions.join() === 'B,C', `expected B,C to regress, got ${comparison.regressions.join()}`);
  assert(comparison.overFitting === true, 'two regressions for one gain was not called over-fitting');

  // AND THE OPPOSITE, so the flag cannot be a constant: a broad gain with one
  // regression is NOT over-fitting. It is a change with a cost to state.
  const broadGain = comparePreferenceRuns(
    ['A', 'B', 'C'].map((id) => row({ scenarioId: id, moderateDays: 0 })),
    [row({ scenarioId: 'A' }), row({ scenarioId: 'B' }), row({ scenarioId: 'C', hardDays: 5, moderateDays: 0 })],
  );
  assert(broadGain.overFitting === false, 'a broad improvement with one cost was called over-fitting');
  assert(broadGain.clean === false, 'the one regression was not reported at all');
});

run('a scenario that vanishes is not a pass', () => {
  const comparison = comparePreferenceRuns([row({ scenarioId: 'A' }), row({ scenarioId: 'B' })],
    [row({ scenarioId: 'A' })]);
  assert(comparison.scenarios.some((entry) =>
    entry.scenarioId === 'B' && entry.verdict === 'missing_scenario'),
    'a scenario present in the baseline and absent from the run was not reported');
  assert(comparison.clean === false,
    'dropping the failing week reported clean — the cheapest way to satisfy any preference');
});

run('the committed baseline is real, current and readable by the comparator', () => {
  assert(fs.existsSync(BASELINE_PATH), `${BASELINE_PATH} is missing — the report has nothing to compare against`);
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as WeekPreferenceRow[];
  assert(Array.isArray(baseline) && baseline.length >= 17,
    `the baseline holds ${baseline.length} scenarios; the harness runs 17`);
  for (const entry of baseline) {
    assert(typeof entry.scenarioId === 'string' && entry.scenarioId.length > 0,
      'a baseline row has no scenario id');
    // THE ROW MUST BE REPRODUCIBLE FROM ITS OWN NUMBERS. A baseline whose stored
    // verdict disagrees with the rule that produced it is a stale claim, and it
    // would silently decide every future comparison.
    const recomputed = preferenceRow({
      scenarioId: entry.scenarioId,
      hardDays: entry.hardDays,
      anchorHardDays: entry.anchorHardDays,
      moderateDays: entry.moderateDays,
      preferredHardDayMax: entry.preferredHardDayMax,
      permittedHardDayMax: entry.permittedHardDayMax,
    });
    assert(recomputed.score === entry.score && recomputed.hardViolation === entry.hardViolation
      && recomputed.samShapeMet === entry.samShapeMet,
      `${entry.scenarioId}: the stored verdict does not follow from its own numbers `
      + `(stored ${entry.score}/${entry.hardViolation}, recomputed ${recomputed.score}/${recomputed.hardViolation})`);
  }
  const identical = comparePreferenceRuns(baseline, baseline);
  assert(identical.clean && identical.regressions.length === 0 && identical.improvements.length === 0,
    'the baseline does not compare clean against itself');
});

run('the table renders every scenario the comparison saw', () => {
  const comparison = comparePreferenceRuns([row({ scenarioId: 'A' })], [row({ scenarioId: 'A', moderateDays: 0 })]);
  const lines = preferenceTable(comparison, [row({ scenarioId: 'A', moderateDays: 0 })]);
  assert(lines.length === 2, `expected a header and one row, got ${lines.length}`);
  assert(lines[1].includes('A') && lines[1].includes('preference_regression'),
    'the rendered row does not name the scenario and its verdict');
});

console.log(`\nweek preference shape totals: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
