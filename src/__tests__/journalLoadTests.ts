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
 * THE LOAD MODEL — the journal unit's load slice.
 *
 * VERIFICATION STRATEGY (L12). What would catch the NEXT defect of each class,
 * not merely this one. Six classes, gated separately because they fail
 * differently:
 *
 *   - THE RULING can be mis-transcribed. Sam's numbers are asserted as VALUES
 *     (2/1/0, a four-week window, 50/50, 0.8-1.3) because a ruling about numbers
 *     is checked as numbers — `a-ruling-premise-is-a-claim-too`.
 *   - PROVENANCE CAN LEAK, and this is the class the whole slice turns on. An
 *     unsigned constant reaching an athlete is the failure the order exists to
 *     prevent, so [2] asserts the mechanism in BOTH directions: a proposed
 *     constant makes every value downstream of it proposed, `signedValue`
 *     refuses it, and the SIGNED outputs stay signed. A cell that only checked
 *     "the headline is hidden today" would pass forever after someone marked a
 *     constant signed without Sam.
 *   - HONESTY CAN DECAY into invented precision. [3] and [5] assert the null
 *     cases as first-class answers: a partial session with no per-set detail is
 *     UNMEASURED rather than scaled by a guess, a history week with no
 *     measurement is EXCLUDED rather than averaged in as a zero, and a thinly
 *     logged week gets NO comparison rather than a confident one.
 *   - OWNERSHIP CAN LEAK. Patterns and muscles have owners. [4] sweeps this
 *     module's SOURCE and requires it declares no rival table — the cell that
 *     would catch the next `one-predicate-grows-copies-in-other-modules`.
 *   - THE RUNG CAN CREEP INTO THE RATIO. [6] asserts the fallback weight never
 *     becomes a term in a comparison, which is the boundary the plan doc §2b
 *     had to rule on.
 *   - THE SURFACE CAN READ AROUND THE DOOR. [9] requires the screen reach every
 *     derived value through `signedValue` and never through `.value`.
 *
 * Run: npm run test:journal-load
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import {
  JOURNAL_LOAD_CONSTANTS,
  buildJournalLoadModel,
  combineProvenance,
  conditioningSRPE,
  deriveSessionLoad,
  journalWeekStartOf,
  liftTonnageKg,
  signedValue,
  type JournalLoadSessionInput,
  type PlannedLift,
} from '../rules/journalLoad';
import { JOURNAL_LOAD_WEIGHTS } from '../rules/journalWeek';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
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
// REAL AUTHORED NAMES, not invented ones. `Back Squat`, `Bench Press` and
// `Barbell Row` carry rows in BOTH signed sheets, so a fixture that stops
// resolving is telling the truth about the sheets rather than about itself —
// which is the whole point of not hand-writing a muscle list here.

const THIS_WEEK = '2026-08-10'; // a Monday

function weeksBefore(mondayISO: string, n: number): string {
  const date = new Date(`${mondayISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7 * n);
  return date.toISOString().slice(0, 10);
}

function lift(over: Partial<StrengthExercisePerformanceLog> = {}): StrengthExercisePerformanceLog {
  return {
    exerciseId: 'ex-1',
    workoutExerciseId: 'we-1',
    exerciseName: 'Back Squat',
    prescribedSets: 3,
    prescribedRepsMin: 4,
    prescribedRepsMax: 6,
    weightKg: 100,
    completion: 'full',
    ...over,
  };
}

function session(
  date: string,
  over: Partial<JournalLoadSessionInput> = {},
): JournalLoadSessionInput {
  return {
    date,
    strength: [],
    conditioning: null,
    fallbackWeight: null,
    ...over,
  };
}

/** A week of four measured strength sessions at a given tonnage per session. */
function measuredWeek(mondayISO: string, kgPerSession: number): JournalLoadSessionInput[] {
  return [0, 1, 2, 3].map((offset) => {
    const date = new Date(`${mondayISO}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return session(date.toISOString().slice(0, 10), {
      // 1 set x 1 rep x kg — the arithmetic is deliberately trivial so a cell
      // that fails is failing about the MODEL, not about its own fixture.
      strength: [lift({ prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1, weightKg: kgPerSession })],
    });
  });
}

// ─── [1] The ruling, as values ───────────────────────────────────────────

console.log('\n[1] SAM\'S NUMBERS, ASSERTED AS NUMBERS');
{
  const c = JOURNAL_LOAD_CONSTANTS;

  ok('the fallback rung is 2 / 1 / 0, Sam\'s own numbers',
    c.fallbackDayWeights.value.hard === 2
    && c.fallbackDayWeights.value.moderate === 1
    && c.fallbackDayWeights.value.easy === 0,
    c.fallbackDayWeights.value);
  ok('and it is SIGNED', c.fallbackDayWeights.provenance === 'signed');

  // ONE VALUE, TWO READERS. The day-shape derivation in `journalWeek` consumes
  // the same rung; if the two ever disagree the athlete's week total and the
  // load model's fallback would be different numbers for one ruling.
  ok('the rung in the constants table IS the rung `journalWeek` applies',
    c.fallbackDayWeights.value.hard === JOURNAL_LOAD_WEIGHTS.hard
    && c.fallbackDayWeights.value.moderate === JOURNAL_LOAD_WEIGHTS.moderate
    && c.fallbackDayWeights.value.easy === JOURNAL_LOAD_WEIGHTS.easy);

  ok('the stream window is four weeks, and SIGNED (it is in the ruling body)',
    c.streamNormalWindowWeeks.value === 4 && c.streamNormalWindowWeeks.provenance === 'signed');

  ok('the stream weighting is the proposed 50/50, and PROPOSED',
    c.streamWeighting.value.strength === 0.5
    && c.streamWeighting.value.conditioning === 0.5
    && c.streamWeighting.provenance === 'proposed');

  ok('the sweet-spot band is the proposed 0.8-1.3, and PROPOSED',
    c.sweetSpotBand.value.low === 0.8
    && c.sweetSpotBand.value.high === 1.3
    && c.sweetSpotBand.provenance === 'proposed');

  ok('tonnage-modulated-by-effort is OFF by default, as the order requires',
    c.tonnageModulatedByEffort.value === false
    && c.tonnageModulatedByEffort.provenance === 'proposed');

  ok('the region-normal window is PROPOSED, separately from the stream window',
    c.regionNormalWindowWeeks.provenance === 'proposed');

  // EVERY constant states where it came from. A number with no source is the
  // shape `a-ruling-premise-is-a-claim-too` is about.
  const entries = Object.entries(c);
  ok('every constant carries a non-empty source', entries.length > 0
    && entries.every(([, entry]) => typeof entry.source === 'string' && entry.source.length > 8),
    entries.filter(([, e]) => !e.source || e.source.length <= 8).map(([k]) => k));
  ok('and every PROPOSED constant says so in its source, for Sam\'s eye',
    entries.filter(([, e]) => e.provenance === 'proposed')
      .every(([, e]) => e.source.includes('PROPOSED')),
    entries.filter(([, e]) => e.provenance === 'proposed' && !e.source.includes('PROPOSED'))
      .map(([k]) => k));

  // The signing batch is a FACT about the table, printed so the boundary report
  // and Sam's batch cannot drift apart by hand-counting.
  const proposed = entries.filter(([, e]) => e.provenance === 'proposed').map(([k]) => k);
  console.log(`      SIGNING BATCH: ${proposed.length} PROPOSED of ${entries.length} constants `
    + `(distinct keys): ${proposed.join(', ')}`);
}

// ─── [2] Provenance travels with the number ──────────────────────────────

console.log('\n[2] PROVENANCE PROPAGATION — the mechanism, in both directions');
{
  ok('nothing contributing is SIGNED — a count derived from no constant is honest',
    combineProvenance() === 'signed');
  ok('all signed stays signed', combineProvenance('signed', 'signed') === 'signed');
  ok('ONE proposed contributor makes the whole value proposed',
    combineProvenance('signed', 'proposed', 'signed') === 'proposed');

  ok('`signedValue` returns the value when signed',
    signedValue({ value: 7, provenance: 'signed' }) === 7);
  ok('and REFUSES it when proposed — the surface cannot render it by accident',
    signedValue({ value: 7, provenance: 'proposed' }) === null);

  // The real model, at HEAD. This is the both-directions cell: it names which
  // outputs are signed TODAY, so marking a constant signed without Sam moves it
  // and reds here rather than silently lighting a line on his phone.
  const model = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 3), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 4), 100),
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });

  ok('coverage is SIGNED — no constant feeds a count of what was logged',
    model.coverage.provenance === 'signed');
  ok('the fallback rung is SIGNED — Sam signed 2/1/0',
    model.fallbackLoad.provenance === 'signed');
  ok('the headline continuum is PROPOSED — weighting and band are unsigned',
    model.headline.provenance === 'proposed');
  ok('the per-stream comparison is PROPOSED — the coverage floor is unsigned',
    model.strengthStream.provenance === 'proposed'
    && model.conditioningStream.provenance === 'proposed');
  ok('the region observations are PROPOSED — window and secondary share unsigned',
    model.regionObservations.provenance === 'proposed');
  ok('the plan-vs-done verdict is PROPOSED — its threshold is unsigned',
    model.patternBalance.provenance === 'proposed');
  ok('but the completed pattern SHARES stand signed — no constant feeds them',
    model.patternSharesDone.provenance === 'signed');

  // THE HEADLINE EXISTS. A model that simply never computed one would satisfy
  // "the headline is hidden" forever — so the number is asserted present behind
  // the refusal, which is what makes Sam's signature alone enough to ship it.
  ok('the headline IS computed behind the refusal, not merely absent',
    model.headline.value !== null && Math.abs(model.headline.value.ratio - 1) < 1e-9,
    model.headline.value);
  ok('and `signedValue` is what hides it', signedValue(model.headline) === null);
}

// ─── [3] The two native streams ──────────────────────────────────────────

console.log('\n[3] STREAM MEASUREMENT — prescribed, actual, and the honest nulls');
{
  ok('tonnage is sets x mid-rep-range x kg from the prescribed snapshot',
    liftTonnageKg(lift()) === 3 * 5 * 100, liftTonnageKg(lift()));

  ok('real logged sets and reps WIN over the prescription',
    liftTonnageKg(lift({ completedSets: 2, actualReps: 3 })) === 2 * 3 * 100);

  ok('a skipped lift is ZERO — a measurement, not a hole',
    liftTonnageKg(lift({ completion: 'skipped' })) === 0);

  ok('a lift with no weight recorded is UNMEASURED, never zero',
    liftTonnageKg(lift({ weightKg: null })) === null);

  // THE HONESTY CELL. The app knows some of it happened and not how much.
  // Scaling the prescription by a guess is exactly "invents precision".
  ok('a PARTIAL lift with no per-set detail is UNMEASURED, not scaled by a guess',
    liftTonnageKg(lift({ completion: 'partial' })) === null);
  ok('and a partial lift WITH per-set detail is measured from that detail',
    liftTonnageKg(lift({ completion: 'partial', completedSets: 2, actualReps: 4 })) === 2 * 4 * 100);

  ok('sRPE is the athlete\'s rating times the session\'s minutes',
    conditioningSRPE({ rpe: 7, totalTimeMinutes: 40 }) === 280);
  ok('a conditioning log missing either half is UNMEASURED',
    conditioningSRPE({ rpe: 7 }) === null && conditioningSRPE({ totalTimeMinutes: 40 }) === null);
  ok('and no conditioning log at all is unmeasured', conditioningSRPE(null) === null);

  const noStrength = deriveSessionLoad(session('2026-08-10', {
    conditioning: { rpe: 6, totalTimeMinutes: 30 },
  }));
  ok('a session that recorded NO main lifts has zero main-lift tonnage, not null',
    noStrength.strengthMainLiftTonnageKg === 0,
    noStrength.strengthMainLiftTonnageKg);
  ok('and it is still MEASURED, through its conditioning stream',
    noStrength.measured === true);

  const allUnmeasured = deriveSessionLoad(session('2026-08-10', {
    strength: [lift({ weightKg: null })],
  }));
  ok('a session whose only lift is unmeasurable is UNMEASURED, and says how many',
    allUnmeasured.strengthMainLiftTonnageKg === null
    && allUnmeasured.liftsUnmeasured === 1
    && allUnmeasured.measured === false);
}

// ─── [4] Ownership — no rival table lives here ───────────────────────────

console.log('\n[4] OWNERSHIP — the model asks the owners and declares no rival table');
{
  const modulePath = join(__dirname, '..', 'rules', 'journalLoad.ts');
  const source = readFileSync(modulePath, 'utf8');

  // ANCHOR FIRST (AGENTS.md, the anchoring law). Every assertion below is about
  // a region of this file; if the read failed, `''` would satisfy every "does
  // not contain" check and the cell would read as a clean pass.
  ok('the module source was actually read', source.length > 4000, source.length);

  ok('it asks the movement owner for a main pattern',
    /\bmainPatternForExerciseMovement\s*\(/.test(source));
  ok('it asks the signed exercise sheet for muscles',
    /\bmuscleMetadataFor\s*\(/.test(source));
  ok('it asks the signed conditioning sheet for muscles',
    /\bconditioningSessionMuscles\s*\(/.test(source));
  ok('and it asks the tag owner for the movement and the upper/lower region',
    /\bgetExerciseTags\s*\(/.test(source));

  // A RIVAL TABLE IS WHAT THIS CELL IS ABOUT — not the absence of a word. The
  // failure shape is a literal name-keyed map appearing here, which is how the
  // predicate grew four copies last time.
  ok('it declares no exercise-name -> pattern table of its own',
    !/'(Back Squat|Bench Press|Barbell Row|Front Squat|Deadlift)'\s*:/.test(source));
  ok('it declares no muscle list of its own',
    !/'(Quads|Glutes|Hamstrings|Chest|Lats)'\s*(,|\])/.test(source));

  // THE ONE VOCABULARY TRANSLATION IT DOES OWN, held to one place. The logger
  // says `assault_bike`; the sheet says `air_bike`. Two call sites doing that
  // conversion is two chances to disagree.
  const conversions = source.match(/'air_bike'/g) ?? [];
  ok('the logger-to-sheet modality translation exists exactly once',
    conversions.length === 2, // the return type union, and the single mapping
    conversions.length);

  // Region loads are never summed ACROSS regions — the distribution does not
  // conserve a total, so a cross-region sum would be a meaningless number.
  ok('the module never sums across regions', !/sumRegions|totalRegionLoad/.test(source));
}

// ─── [5] Ratio space — the normal, and the coverage refusal ──────────────

console.log('\n[5] RATIO SPACE — the normal, and when the comparison is REFUSED');
{
  const fourWeeksOfHistory = [
    ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
    ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
    ...measuredWeek(weeksBefore(THIS_WEEK, 3), 100),
    ...measuredWeek(weeksBefore(THIS_WEEK, 4), 100),
  ];

  const doubled = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [...measuredWeek(THIS_WEEK, 200), ...fourWeeksOfHistory],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  const stream = doubled.strengthStream.value;
  ok('a week at twice its normal reads as a ratio of 2',
    stream !== null && Math.abs(stream.ratio - 2) < 1e-9, stream);
  ok('and the normal is the mean of the four-week window, in the stream\'s own unit',
    stream !== null && stream.normal === 400 && stream.weeksUsed === 4, stream);

  // RAW UNITS NEVER CROSS STREAMS (the ruling's law). The conditioning stream of
  // a strength-only week has nothing to compare, and the strength stream is
  // unaffected by that absence.
  ok('the conditioning stream is null when nothing conditioning was ever logged',
    doubled.conditioningStream.value === null);
  ok('and the headline still exists, on the one stream that has a normal',
    doubled.headline.value !== null && Math.abs(doubled.headline.value.ratio - 2) < 1e-9,
    doubled.headline.value);

  const tooLittleHistory = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  ok('below four measured weeks there is NO comparison, not a smaller one',
    tooLittleHistory.strengthStream.value === null && tooLittleHistory.headline.value === null);

  // A HISTORY WEEK WITH NO MEASUREMENT IS EXCLUDED, NOT AVERAGED IN AS ZERO —
  // averaging a blank week in would halve the normal and manufacture a spike.
  const withABlankWeek = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 3), 100),
      session(weeksBefore(THIS_WEEK, 4), {}), // recorded, measured nothing
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  ok('a blank history week does not become a zero in the normal — it is excluded',
    withABlankWeek.strengthStream.value === null,
    withABlankWeek.strengthStream.value);

  // THE COVERAGE REFUSAL. The same history, but THIS week barely logged.
  const thinlyLogged = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      session(THIS_WEEK, { strength: [lift({ prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1 })] }),
      ...fourWeeksOfHistory,
    ],
    sessionsPlannedThisWeek: 6,
    plannedStrength: [],
  });
  ok('a week too thinly logged to compare honestly gets NO comparison',
    thinlyLogged.strengthStream.value === null && thinlyLogged.headline.value === null);
  ok('and its coverage says so in counts the athlete can be shown',
    thinlyLogged.coverage.value.sessionsMeasured === 1
    && thinlyLogged.coverage.value.sessionsPlanned === 6,
    thinlyLogged.coverage.value);
}

// ─── [6] The fallback rung stops where the plan doc ruled ────────────────

console.log('\n[6] THE FALLBACK RUNG — whole for this week, never a term in a ratio');
{
  const allShapesKnown = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      session(THIS_WEEK, { fallbackWeight: 2 }),
      session('2026-08-12', { fallbackWeight: 1 }),
      session('2026-08-14', { fallbackWeight: 0 }),
    ],
    sessionsPlannedThisWeek: 3,
    plannedStrength: [],
  });
  ok('with every shape known the rung sums Sam\'s weights',
    allShapesKnown.fallbackLoad.value === 3, allShapesKnown.fallbackLoad.value);

  // A PARTIAL SUM WOULD READ AS A SMALL WEEK, which is worse than no number.
  const oneShapeUnknown = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      session(THIS_WEEK, { fallbackWeight: 2 }),
      session('2026-08-12', { fallbackWeight: null }),
    ],
    sessionsPlannedThisWeek: 2,
    plannedStrength: [],
  });
  ok('one unknown shape makes the whole rung null, never a partial sum',
    oneShapeUnknown.fallbackLoad.value === null);

  // THE BOUNDARY THE PLAN DOC RULED. A week with a full rung and no measured
  // history still has no comparison — the rung is not a stand-in denominator.
  ok('a whole rung does NOT produce a comparison the streams cannot support',
    allShapesKnown.headline.value === null
    && allShapesKnown.strengthStream.value === null);
}

// ─── [7] The region layer ────────────────────────────────────────────────

console.log('\n[7] REGION LAYER — observation, never diagnosis');
{
  const squat = deriveSessionLoad(session(THIS_WEEK, {
    strength: [lift({ prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1, weightKg: 100 })],
  }));
  // Back Squat's SIGNED row: primary Quads + Glutes, secondary Hips, Midline,
  // Low back. The numbers come from the sheet, not from this file.
  ok('a primary muscle carries the session\'s whole load',
    squat.regions.Quads === 100 && squat.regions.Glutes === 100, squat.regions);
  ok('and a secondary carries the proposed share of it',
    squat.regions.Hips === 100 * JOURNAL_LOAD_CONSTANTS.regionSecondaryShare.value,
    squat.regions);
  ok('a muscle the sheet does not name gets nothing',
    squat.regions.Chest === undefined);

  const conditioning = deriveSessionLoad(session(THIS_WEEK, {
    conditioning: { sessionName: '10 m Acceleration Reps', rpe: 5, totalTimeMinutes: 20 },
  }));
  ok('conditioning load reaches the muscles the signed conditioning sheet names',
    conditioning.regions.Glutes === 100 && conditioning.regions.Quads === 100,
    conditioning.regions);

  const unknownModality = deriveSessionLoad(session(THIS_WEEK, {
    conditioning: { sessionName: 'Something Unauthored', mode: 'swim', rpe: 5, totalTimeMinutes: 20 },
  }));
  ok('a session the sheets cannot answer for carries NO region load — absent, not invented',
    Object.keys(unknownModality.regions).length === 0);
  ok('and it is still measured as sRPE — the streams do not depend on the sheet',
    unknownModality.conditioningSRPE === 100);

  // AN OBSERVATION IS AN ORDERING FACT — this week beat every week in the
  // window. It is not a threshold and it is not a diagnosis.
  const biggestWeek = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 200),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  const quads = biggestWeek.regionObservations.value.find((o) => o.region === 'Quads');
  ok('a region that beat every week in the window is observed',
    quads !== undefined && quads.thisWeek > quads.previousBest, quads);
  ok('and the observation states how many weeks it looked at',
    quads !== undefined && quads.weeksCompared === 2, quads);

  const quietWeek = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 50),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  ok('a region that did NOT beat its window is not observed — no filler lines',
    quietWeek.regionObservations.value.length === 0);
}

// ─── [8] Pattern balance — plan vs done ──────────────────────────────────

console.log('\n[8] PATTERN BALANCE — plan vs done, from the existing pattern owner');
{
  const plan: PlannedLift[] = [
    { exerciseName: 'Back Squat', sets: 1, repsMin: 1, repsMax: 1, weightKg: 100 },
    { exerciseName: 'Bench Press', sets: 1, repsMin: 1, repsMax: 1, weightKg: 100 },
  ];

  // The athlete planned an even squat/push week and did only the squatting.
  const drifted = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [session(THIS_WEEK, {
      strength: [lift({ prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1, weightKg: 100 })],
    })],
    sessionsPlannedThisWeek: 1,
    plannedStrength: plan,
  });
  const balance = drifted.patternBalance.value;
  const squatShare = balance?.shares.find((s) => s.pattern === 'squat');
  const pushShare = balance?.shares.find((s) => s.pattern === 'push');
  ok('the plan\'s shares come from the plan',
    squatShare?.plannedShare === 0.5 && pushShare?.plannedShare === 0.5, balance?.shares);
  ok('and the done shares come from what was actually recorded',
    squatShare?.doneShare === 1 && pushShare?.doneShare === 0, balance?.shares);
  ok('uppers vs lowers is answered from the tag owner\'s region, not a new list',
    balance !== null && balance.upperSharePlanned === 0.5 && balance.upperShareDone === 0,
    balance);

  const noPlan = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [session(THIS_WEEK, { strength: [lift()] })],
    sessionsPlannedThisWeek: 1,
    plannedStrength: [],
  });
  ok('with no plan to compare against there is NO balance verdict',
    noPlan.patternBalance.value === null);
  ok('but the completed shares still stand, and stay signed',
    noPlan.patternSharesDone.value.length === 4
    && noPlan.patternSharesDone.provenance === 'signed');
}

// ─── [9] Week identity, and the surface's one door ───────────────────────

console.log('\n[9] WEEK IDENTITY, AND THE SURFACE READS ONLY THROUGH THE DOOR');
{
  ok('a Monday is its own week start', journalWeekStartOf('2026-08-10') === '2026-08-10');
  ok('a Sunday belongs to the Monday before it', journalWeekStartOf('2026-08-16') === '2026-08-10');
  ok('and an unparseable date is null rather than a wrong week',
    journalWeekStartOf('not-a-date') === null);

  const screenPath = join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx');
  const screen = readFileSync(screenPath, 'utf8');
  ok('the screen source was actually read', screen.length > 4000, screen.length);

  ok('the screen builds the load model rather than deriving load itself',
    /\bbuildJournalLoadModel\s*\(/.test(screen));
  ok('and it reads derived values through `signedValue`',
    /\bsignedValue\s*\(/.test(screen));

  // THE DOOR IS THE POINT. Reading `.value` off a derived value is how an
  // unsigned number reaches the athlete, and it is the one move this whole
  // mechanism exists to make impossible.
  const loadRegionStart = screen.indexOf('function LoadSection');
  const loadRegionEnd = screen.indexOf('// ─── The note');
  ok('the Load section was located in the screen',
    loadRegionStart > 0 && loadRegionEnd > loadRegionStart,
    { loadRegionStart, loadRegionEnd });
  const loadRegion = screen.slice(loadRegionStart, loadRegionEnd);
  ok('and the located region is substantial, not an empty slice',
    loadRegion.length > 300, loadRegion.length);
  ok('the Load section never reads `.value` off a derived value',
    !/\bload\.[A-Za-z]+\.value\b/.test(loadRegion), loadRegion.match(/\b\w+\.value\b/g));

  // THE HONEST STATES ARE RENDERED, not merely derivable — anchored by testID
  // so an on-device explorer can find them.
  for (const testId of ['journal-load-evidence', 'journal-load-building']) {
    ok(`the screen renders \`${testId}\``, new RegExp(`testID="${testId}"`).test(screen));
  }

  // THE SIGNED-ONLY LINES EXIST IN CODE so that Sam's signature alone ships
  // them. A screen with no headline line at all would pass every "it is hidden"
  // cell above and still need a code change on the day he signs.
  ok('the headline line exists behind the refusal, ready for the signature',
    /testID="journal-load-headline"/.test(screen));
  ok('the region observation line exists behind the refusal too',
    /testID="journal-load-region"/.test(screen));
}

console.log(`\njournalLoadTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure derivation with hand-built '
  + 'session records. It does NOT walk an athlete through five real weeks, and no cell '
  + 'here mounts a surface.');
console.log('  NOT COVERED: the effort tap on strength sessions is NOT built (the '
  + 'modulation constant defaults OFF, so it would change no visible number — it lands '
  + 'with the "felt different" slice). Charts are layer 5 and deferred to the monthly '
  + 'review by the ruling. The fallback rung is proven WHOLE for the current week and '
  + 'proven ABSENT from ratio space; whether it should ever enter ratio space is Sam\'s '
  + 'open question (docs/JOURNAL_LOAD_SLICE_PLAN_2026-08-09.md §2b). No cell asserts '
  + 'what the athlete SEES on a device.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
