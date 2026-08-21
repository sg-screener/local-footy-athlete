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
  calendarWeeksBefore,
  combineProvenance,
  conditioningSRPE,
  deriveSessionLoad,
  journalWeekStartOf,
  liftTonnageKg,
  signedValue,
  type ConstantProvenance,
  type Derived,
  type JournalLoadConstant,
  type JournalLoadModel,
  teamTrainingSRPE,
  gameSRPE,
  strengthSRPE,
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

/**
 * THE TABLE'S ENTRIES, READ AT THE DECLARED TYPE RATHER THAN THE NARROWED ONE.
 *
 * `as const satisfies …` pins every entry's `provenance` to the LITERAL it
 * currently holds. Once Sam signed the last constant on 2026-08-09 the compiler
 * concluded that `provenance` can only ever be `'signed'`, and `e.provenance ===
 * 'proposed'` stopped being a test and became a type error — seven of them.
 *
 * THAT IS THE COMPILER BEING RIGHT ABOUT TODAY AND WRONG ABOUT THE POINT. The
 * cells it refused are the ones guarding the NEXT proposed constant, and the
 * two easy answers both cost something: deleting them removes the guard, and
 * dropping `as const` from the table loosens the values Sam just signed. So the
 * READ is widened to `JournalLoadConstant`, the type the table already declares
 * it satisfies, and the table keeps its literals.
 */
const CONSTANT_ENTRIES: readonly (readonly [string, JournalLoadConstant<unknown>])[] =
  Object.entries(JOURNAL_LOAD_CONSTANTS);

function provenanceOf(key: keyof typeof JOURNAL_LOAD_CONSTANTS): ConstantProvenance {
  return (JOURNAL_LOAD_CONSTANTS[key] as JournalLoadConstant<unknown>).provenance;
}

/** The model's fields that carry provenance — the ones a signature can darken. */
type DerivedField = {
  [K in keyof JournalLoadModel]: JournalLoadModel[K] extends Derived<unknown> ? K : never;
}[keyof JournalLoadModel];

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
  ok('the rung in the constants table IS `journalWeek`\'s object, not a copy',
    c.fallbackDayWeights.value === JOURNAL_LOAD_WEIGHTS);

  ok('the stream window is four weeks, and SIGNED (it is in the ruling body)',
    c.streamNormalWindowWeeks.value === 4 && c.streamNormalWindowWeeks.provenance === 'signed');

  // ─── THE SIGNING SESSION, 2026-08-09 ───────────────────────────────────
  //
  // THESE FOUR CELLS USED TO ASSERT `proposed`, AND THEY WENT RED THE DAY THE
  // SIGNATURE LANDED. That is what they were for: `a-cell-that-reds-when-its-
  // own-unit-lands`. They are RE-AIMED at the new truth rather than deleted,
  // because a table nobody checks is how a value drifts away from the ruling
  // that authorised it. The VALUES are unchanged by the signing — Sam took
  // every number as proposed — so a cell that only watched provenance would
  // have let the numbers move on the same day.

  ok('the stream weighting is 50/50, and SIGNED 2026-08-09',
    c.streamWeighting.value.strength === 0.5
    && c.streamWeighting.value.conditioning === 0.5
    && c.streamWeighting.provenance === 'signed');

  ok('the sweet-spot band is 0.8-1.3, and SIGNED 2026-08-09',
    c.sweetSpotBand.value.low === 0.8
    && c.sweetSpotBand.value.high === 1.3
    && c.sweetSpotBand.provenance === 'signed');

  // SIGNED AS OFF IS NOT THE SAME AS OFF BY DEFAULT, and the distinction is the
  // cell's subject. Turning it on is now a ruling, not a default flip.
  ok('tonnage-modulated-by-effort is OFF, and that OFF is SIGNED',
    c.tonnageModulatedByEffort.value === false
    && c.tonnageModulatedByEffort.provenance === 'signed');

  ok('the region-normal window is four weeks, and SIGNED',
    c.regionNormalWindowWeeks.value === 4
    && c.regionNormalWindowWeeks.provenance === 'signed');

  ok('the region-hot ratio is 1.15, and SIGNED',
    c.regionHotRatio.value === 1.15 && c.regionHotRatio.provenance === 'signed');

  ok('the secondary share is half a primary, and SIGNED',
    c.regionSecondaryShare.value === 0.5 && c.regionSecondaryShare.provenance === 'signed');

  ok('the pattern-drift threshold is 0.25, and SIGNED',
    c.patternDriftThreshold.value === 0.25
    && c.patternDriftThreshold.provenance === 'signed');

  ok('the coverage floor is 0.5, and SIGNED',
    c.minimumWeekCoverage.value === 0.5 && c.minimumWeekCoverage.provenance === 'signed');

  // EVERY constant states where it came from. A number with no source is the
  // shape `a-ruling-premise-is-a-claim-too` is about.
  const entries = CONSTANT_ENTRIES;
  ok('every constant carries a non-empty source', entries.length > 0
    && entries.every(([, entry]) => typeof entry.source === 'string' && entry.source.length > 8),
    entries.filter(([, e]) => !e.source || e.source.length <= 8).map(([k]) => k));
  ok('and every PROPOSED constant says so in its source, for Sam\'s eye',
    entries.filter(([, e]) => e.provenance === 'proposed')
      .every(([, e]) => e.source.includes('PROPOSED')),
    entries.filter(([, e]) => e.provenance === 'proposed' && !e.source.includes('PROPOSED'))
      .map(([k]) => k));

  // THE CELL ABOVE IS VACUOUS TODAY AND SAYING SO IS THE POINT — the table holds
  // zero proposed entries after 2026-08-09, so it asserts over an empty set
  // (`a-bind-can-be-green-and-empty`). It is kept because it is the guard the
  // NEXT constant needs, and the counterpart below is what carries weight now.
  ok('every SIGNED constant names who signed it, and no longer reads PROPOSED',
    entries.filter(([, e]) => e.provenance === 'signed')
      .every(([, e]) => e.source.includes('Sam ') && !e.source.includes('PROPOSED')),
    entries.filter(([, e]) => e.provenance === 'signed'
      && (!e.source.includes('Sam ') || e.source.includes('PROPOSED'))).map(([k]) => k));

  // THE EIGHT SAM SIGNED ON 2026-08-09, BY NAME. The work order lists them, and
  // a list in a report is checked as a list — `a-ruling-premise-is-a-claim-too`.
  // Two entries were signed EARLIER (the rung, the stream window) and are
  // asserted absent from this set, so the batch cannot quietly grow or shrink.
  const SIGNING_SESSION = 'Sam 2026-08-09, signing session';
  const signedToday = entries.filter(([, e]) => e.source.startsWith(SIGNING_SESSION))
    .map(([k]) => k).sort();
  ok('the signing session moved EXACTLY the eight the order names',
    JSON.stringify(signedToday) === JSON.stringify([
      'minimumWeekCoverage', 'patternDriftThreshold', 'regionHotRatio',
      'regionNormalWindowWeeks', 'regionSecondaryShare', 'streamWeighting',
      'sweetSpotBand', 'tonnageModulatedByEffort',
    ]), signedToday);

  // The signing batch is a FACT about the table, printed so the boundary report
  // and Sam's batch cannot drift apart by hand-counting.
  const proposed = entries.filter(([, e]) => e.provenance === 'proposed').map(([k]) => k);
  console.log(`      SIGNING BATCH: ${proposed.length} PROPOSED of ${entries.length} constants `
    + `(distinct keys): ${proposed.join(', ')}`);
  console.log(`      SIGNED 2026-08-09: ${signedToday.length} of ${entries.length} `
    + `(distinct keys): ${signedToday.join(', ')}`);
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

  // ─── AFTER THE SIGNATURE: EVERY OUTPUT IS SIGNED ───────────────────────
  //
  // These five cells asserted `proposed` until 2026-08-09 and are the reason
  // the flip could not be silent. The claim they carry now is the OTHER half of
  // the same mechanism: Sam signed the constants and the OUTPUTS followed, with
  // no line of surface code touched.
  ok('the headline continuum is SIGNED — weighting and band both carry Sam',
    model.headline.provenance === 'signed');
  ok('the per-stream comparison is SIGNED — the coverage floor is signed',
    model.strengthStream.provenance === 'signed'
    && model.conditioningStream.provenance === 'signed');
  ok('the region observations are SIGNED — window and secondary share signed',
    model.regionObservations.provenance === 'signed');
  ok('the plan-vs-done verdict is SIGNED — its threshold is signed',
    model.patternBalance.provenance === 'signed');
  ok('and the completed pattern SHARES still stand signed — no constant feeds them',
    model.patternSharesDone.provenance === 'signed');

  // THE HEADLINE EXISTS, AND IT NOW REACHES THE SURFACE. The old form of this
  // cell asserted the number was computed BEHIND the refusal; today the same
  // number comes back through the door.
  ok('the headline IS computed, and the value is the ratio it always was',
    model.headline.value !== null && Math.abs(model.headline.value.ratio - 1) < 1e-9,
    model.headline.value);
  ok('and `signedValue` now RELEASES it — this is what Sam\'s signature bought',
    signedValue(model.headline) === model.headline.value);
}

// ─── [2b] The refusal still works, proven over the REAL model ────────────
//
// THE HAZARD THIS CELL EXISTS FOR. Before 2026-08-09, section [2] proved the
// darkening end-to-end for free: real constants were proposed, so real outputs
// were dark. Signing every constant took that evidence away — every remaining
// proof of the refusal ran over HAND-BUILT `Derived` values, which prove
// `signedValue` and say nothing about whether `buildJournalLoadModel` still
// WIRES its constants into what it returns.
//
// That gap is not theoretical. The next author adds a constant, writes
// `{ value, provenance: 'signed' }` by hand instead of `derived(value, ...)`,
// and nothing reds: everything is signed today, so a hardcoded 'signed' and a
// live combination are indistinguishable. The mechanism would be dead while
// reading green — `a-green-gate-is-a-claim`, and the exact shape the load
// slice's own comment warned about ("a cell that only checked 'the headline is
// hidden today' would pass forever").
//
// So the constant is un-signed AT RUNTIME and the real model is rebuilt. The
// table is a plain object (`as const` is a type-level claim, not a freeze), so
// this is a cast rather than a new door in the module: adding an injection
// point for a test would be a second representation of the constants.

console.log('\n[2b] THE REFUSAL, PROVEN OVER THE REAL MODEL AFTER THE SIGNING');
{
  function modelNow() {
    return buildJournalLoadModel({
      weekStart: THIS_WEEK,
      sessions: [
        ...measuredWeek(THIS_WEEK, 100),
        ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
        ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
        ...measuredWeek(weeksBefore(THIS_WEEK, 3), 100),
        ...measuredWeek(weeksBefore(THIS_WEEK, 4), 100),
      ],
      sessionsPlannedThisWeek: 4,
      plannedStrength: [
        { exerciseName: 'Back Squat', sets: 1, repsMin: 1, repsMax: 1, weightKg: 100 },
        { exerciseName: 'Bench Press', sets: 1, repsMin: 1, repsMax: 1, weightKg: 100 },
      ],
    });
  }

  // Each entry: the constant to un-sign, and the outputs that must go dark.
  const WIRING: readonly {
    key: keyof typeof JOURNAL_LOAD_CONSTANTS;
    darkens: readonly DerivedField[];
  }[] = [
    { key: 'sweetSpotBand', darkens: ['headline'] },
    { key: 'streamWeighting', darkens: ['headline'] },
    { key: 'minimumWeekCoverage', darkens: ['headline', 'strengthStream', 'conditioningStream'] },
    { key: 'regionSecondaryShare', darkens: ['regionObservations'] },
    { key: 'regionHotRatio', darkens: ['regionObservations'] },
    { key: 'regionNormalWindowWeeks', darkens: ['regionObservations'] },
    { key: 'patternDriftThreshold', darkens: ['patternBalance'] },
  ];

  // THE ASSERTION IS ON `provenance`, NOT ON `signedValue`, AND THE FIRST DRAFT
  // OF THIS CELL GOT IT WRONG. `signedValue` returns null for an UNSIGNED value
  // and for an ABSENT one alike — so "it came back" read false for
  // `conditioningStream` on a strength-only fixture, where the comparison is
  // legitimately null. Reading the refusal through a door that conflates two
  // answers cannot tell them apart; provenance can. `signedValue` is then
  // asserted separately, on an output whose value is known present.
  for (const { key, darkens } of WIRING) {
    const entry = JOURNAL_LOAD_CONSTANTS[key] as unknown as { provenance: string };
    const restore = entry.provenance;

    // PROVE THE MUTATION APPLIED BEFORE READING ITS RESULT — the strength
    // line's lesson (`a mutation that never applied reports as a survivor`),
    // and it applies to a mutation the harness performs on itself too.
    entry.provenance = 'proposed';
    const applied = provenanceOf(key) === 'proposed';

    const mutated = modelNow();
    const wentDark = darkens.every((output) => mutated[output].provenance === 'proposed');

    entry.provenance = restore;
    const restored = provenanceOf(key) === restore;
    const lit = modelNow();
    const cameBack = darkens.every((output) => lit[output].provenance === 'signed');

    ok(`un-signing \`${key}\` darkens ${darkens.join(' + ')} — and signing it back lights them`,
      applied && wentDark && restored && cameBack,
      { applied, wentDark, restored, cameBack });
  }

  // AND THE DOOR ITSELF STILL REFUSES, over a value that is demonstrably THERE.
  // Without the `!== null` half this would pass against a model that computed
  // nothing at all — the vacuous form the load slice already had to refuse once.
  {
    const entry = JOURNAL_LOAD_CONSTANTS.sweetSpotBand as unknown as { provenance: string };
    entry.provenance = 'proposed';
    const applied = provenanceOf('sweetSpotBand') === 'proposed';
    const dark = modelNow();
    entry.provenance = 'signed';
    const litAgain = modelNow();

    ok('`signedValue` refuses a headline that EXISTS, and releases the same one after',
      applied
      && dark.headline.value !== null
      && signedValue(dark.headline) === null
      && signedValue(litAgain.headline) === litAgain.headline.value
      && litAgain.headline.value !== null,
      { applied, computedWhileDark: dark.headline.value });
  }

  // THE TABLE IS LEFT EXACTLY AS FOUND. A cell that mutates shared module state
  // and does not prove it put it back is a fixture that poisons every cell
  // after it, and the failure would appear somewhere else entirely.
  ok('the constants table is restored — every entry SIGNED, as Sam left it',
    CONSTANT_ENTRIES.every(([, e]) => e.provenance === 'signed'),
    CONSTANT_ENTRIES.filter(([, e]) => e.provenance !== 'signed').map(([k]) => k));
}

// ─── [3] The two native streams ──────────────────────────────────────────

console.log('\n[3] STREAM MEASUREMENT — prescribed, actual, and the honest nulls');
{
  ok('tonnage is sets x approved rep target x kg from the prescribed snapshot',
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
    stream !== null && stream.normal === 1200 && stream.weeksUsed === 4, stream);

  // RAW UNITS NEVER CROSS STREAMS (the ruling's law). The conditioning stream of
  // a strength-only week has nothing to compare, and the strength stream is
  // unaffected by that absence.
  ok('the conditioning stream is null when nothing conditioning was ever logged',
    doubled.conditioningStream.value === null);
  ok('and the headline still exists, on the one stream that has a normal',
    doubled.headline.value !== null && Math.abs(doubled.headline.value.ratio - 2) < 1e-9,
    doubled.headline.value);

  // THE WINDOW IS A BOUND, NOT A LABEL. A fifth week exists and is deliberately
  // unlike the other four; the normal must ignore it. Without this cell the
  // window constant could be deleted entirely and every other comparison cell
  // would stay green — they never supply more history than the window holds,
  // which is exactly how a mutation survives a suite that looks thorough.
  const olderThanTheWindow = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 100),
      ...fourWeeksOfHistory,
      ...measuredWeek(weeksBefore(THIS_WEEK, 5), 900),
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  const windowed = olderThanTheWindow.strengthStream.value;
  ok('a week OLDER than the window does not move the normal',
    windowed !== null && windowed.normal === 1200 && windowed.weeksUsed === 4,
    windowed);

  // THE WINDOW IS CALENDAR WEEKS, NOT "THE LAST FOUR WEEKS I LOGGED IN". This
  // is the cell that separates those two readings, and the first version of the
  // module got it wrong: three recent weeks plus one from four months ago is
  // four RECORDED weeks and is not a four-week normal. Nothing above would have
  // noticed — every other fixture logs contiguously, which is exactly the
  // condition under which the two readings agree.
  const gappedHistory = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 2), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 3), 100),
      ...measuredWeek(weeksBefore(THIS_WEEK, 17), 100), // four months ago
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  });
  ok('a gap in the window is a GAP — the normal does not reach back to fill it',
    gappedHistory.strengthStream.value === null,
    gappedHistory.strengthStream.value);
  ok('and the module still REPORTS the old week as recorded history',
    gappedHistory.history.length === 4,
    gappedHistory.history.map((week) => week.weekStart));

  ok('the calendar window is the four weeks that just happened, most recent first',
    calendarWeeksBefore(THIS_WEEK, 4).join(',')
      === [1, 2, 3, 4].map((n) => weeksBefore(THIS_WEEK, n)).join(','),
    calendarWeeksBefore(THIS_WEEK, 4));

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

// ─── [6] The fallback rung is NOT here, and cannot be ───────────────────

console.log('\n[6] THE FALLBACK RUNG — one owner, and this module cannot reach it');
{
  // THE STRONGEST FORM OF "IT NEVER ENTERS RATIO SPACE" IS THAT IT CANNOT.
  //
  // The first version of this module took a per-session rung weight at its door
  // and summed one, which made it a SECOND OWNER of a number `journalWeek`
  // already derives — from the week's DAYS rather than from its recorded
  // sessions, so the two disagreed for any week not yet fully logged, and a week
  // with nothing recorded read as a rung of zero.
  //
  // The rung is now absent from the input, the session shape and the model. This
  // cell asserts that absence STRUCTURALLY, because a behavioural assertion
  // about a field that no longer exists is not an assertion at all.
  const modulePath = join(__dirname, '..', 'rules', 'journalLoad.ts');
  const source = readFileSync(modulePath, 'utf8');
  ok('the module source was actually read (anchor before claiming)',
    source.length > 4000, source.length);

  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  ok('the code declares no rung weight on a session or a model',
    !/\bfallbackWeight\b|\bfallbackLoad\b/.test(codeOnly),
    codeOnly.match(/\bfallback\w*/g));

  // BUT THE SIGNED VALUE IS STILL LISTED, because a signing table that omits the
  // signed constants is a worse record than none — and it POINTS AT the owner
  // rather than restating it. Identity, not equality: two literals that happen
  // to match is the shape nothing notices until they stop matching.
  ok('the table lists the rung by pointing at `journalWeek`\'s own object',
    JOURNAL_LOAD_CONSTANTS.fallbackDayWeights.value === JOURNAL_LOAD_WEIGHTS);

  // AND THE BOUNDARY THE PLAN DOC RULED still holds where it can be observed: a
  // week with recorded sessions and no measured history gets no comparison.
  // Nothing stands in for the streams.
  const noMeasuredHistory = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      session(THIS_WEEK, { strength: [lift()] }),
      session('2026-08-12', { strength: [lift()] }),
    ],
    sessionsPlannedThisWeek: 2,
    plannedStrength: [],
  });
  ok('no measured history means NO comparison — nothing stands in for the streams',
    noMeasuredHistory.headline.value === null
    && noMeasuredHistory.strengthStream.value === null);
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
    squat.regions.Quads === 300 && squat.regions.Glutes === 300, squat.regions);
  ok('and a secondary carries the proposed share of it',
    squat.regions.Hips === 300 * JOURNAL_LOAD_CONSTANTS.regionSecondaryShare.value,
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

  // ── THE HOT THRESHOLD — the UI slice's earned card, and why it exists ──
  //
  // BEFORE THIS, ANY EXCEEDANCE WAS AN OBSERVATION. An athlete who trained one
  // kilogram harder than last month earned an attention card, every week, which
  // is the exact opposite of Sam's organising rule ("an athlete learns that
  // seeing a card means pay attention"). His UI ruling names the region-hot line
  // as one of his constants, so a threshold now stands between the two.
  //
  // THE CELL MOVES THE WEEK ACROSS THE LINE IN BOTH DIRECTIONS, which is what
  // makes it a threshold test rather than a bigger-number test. A single
  // assertion that 200-over-100 is hot would pass with no threshold at all.
  const hotRatio = JOURNAL_LOAD_CONSTANTS.regionHotRatio.value;
  const atRatio = (multiplier: number) => buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [
      ...measuredWeek(THIS_WEEK, 100 * multiplier),
      ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
    ],
    sessionsPlannedThisWeek: 4,
    plannedStrength: [],
  }).regionObservations.value;

  ok('a region a hair over its previous best is NOT hot',
    atRatio(1.01).length === 0, atRatio(1.01));
  ok('a region exactly ON the threshold IS hot — the edge is inclusive, stated',
    atRatio(hotRatio).length > 0, { hotRatio, observed: atRatio(hotRatio).length });
  ok('and a region well past it is hot',
    atRatio(2).length > 0, atRatio(2).length);

  // THE CARD WAS DARK UNTIL SAM SIGNED, AND NOW IT IS NOT. This cell read
  // `=== null` until 2026-08-09; the ratio and the observation are unchanged,
  // and the only thing that moved is the signature on `regionHotRatio`.
  ok('the observations are SIGNED, so the earned card renders — the flip, seen',
    atRatio(2).length > 0
    && signedValue(buildJournalLoadModel({
      weekStart: THIS_WEEK,
      sessions: [
        ...measuredWeek(THIS_WEEK, 200),
        ...measuredWeek(weeksBefore(THIS_WEEK, 1), 100),
      ],
      sessionsPlannedThisWeek: 4,
      plannedStrength: [],
    }).regionObservations)?.length === atRatio(2).length);
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

  // ── THE DRIFT VERDICT — and the finding that came with it ──
  //
  // `patternDriftThreshold` HAS BEEN IN THE SIGNING TABLE SINCE THE LOAD SLICE
  // AND NOTHING CONSUMED ITS VALUE. `patternBalance` carried its PROVENANCE — so
  // everything downstream was correctly dark — but no code ever compared
  // anything to 0.25, which means Sam signing it would have changed nothing on
  // any screen. A constant listed for signature that no reader reads is a worse
  // record than an omission, because the table asserts it matters.
  //
  // It has a reader now, and these cells are what make that true rather than
  // claimed.
  const threshold = JOURNAL_LOAD_CONSTANTS.patternDriftThreshold.value;
  const squatDrift = balance?.drifts.find((d) => d.pattern === 'squat');
  const pushDrift = balance?.drifts.find((d) => d.pattern === 'push');
  ok('a pattern done far above its plan is a drift, and the sign says which way',
    squatDrift !== undefined && squatDrift.delta > 0, balance?.drifts);
  ok('a pattern done far BELOW its plan is a drift too, with the opposite sign',
    pushDrift !== undefined && pushDrift.delta < 0, balance?.drifts);
  ok('and the drifts are ordered biggest first',
    (balance?.drifts.length ?? 0) >= 2
    && Math.abs(balance!.drifts[0].delta) >= Math.abs(balance!.drifts[1].delta),
    balance?.drifts);

  // THE THRESHOLD IS PROVEN TO BE A THRESHOLD — a week inside it earns nothing.
  // Without this the feature is "list every pattern", which the cells above
  // would not distinguish from a working line.
  const balanced = buildJournalLoadModel({
    weekStart: THIS_WEEK,
    sessions: [session(THIS_WEEK, {
      strength: [
        lift({ prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1, weightKg: 100 }),
        lift({
          exerciseName: 'Bench Press',
          prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1, weightKg: 100,
        }),
      ],
    })],
    sessionsPlannedThisWeek: 1,
    plannedStrength: plan,
  });
  ok('a week that matched its plan drifts NOWHERE — the earned card stays away',
    balanced.patternBalance.value?.drifts.length === 0,
    { threshold, drifts: balanced.patternBalance.value?.drifts });

  // AND IT IS LIT NOW, which is what the threshold's first signature bought.
  // The identity check is deliberate: `signedValue` must hand back the SAME
  // object the model computed, not a truthy stand-in.
  ok('the balance verdict is SIGNED, so its card renders — the first reader, lit',
    signedValue(drifted.patternBalance) === drifted.patternBalance.value
    && drifted.patternBalance.value !== null);
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

  // THE COVERAGE SENTENCE HAS THREE FORMS, and the third is the one that would
  // otherwise ship a visibly broken number. `sessionsPlanned` counts the days
  // the projection asks work of; `sessionsMeasured` counts dates the athlete
  // logged detail on. They answer different questions, so measured CAN exceed
  // planned — and "6 of 5" on the one line that actually ships would cost trust
  // in every other number on the screen. The denominator is DROPPED there, not
  // clamped: clamping states a falsehood quietly instead of loudly.
  const evidenceStart = screen.indexOf('function loadEvidenceLine');
  const evidenceEnd = screen.indexOf('\n}', evidenceStart);
  ok('the evidence line builder was located',
    evidenceStart > 0 && evidenceEnd > evidenceStart, { evidenceStart, evidenceEnd });
  const evidence = screen.slice(evidenceStart, evidenceEnd);
  ok('and the located builder is substantial, not an empty slice',
    evidence.length > 200, evidence.length);
  ok('it drops the denominator when measured exceeds planned',
    /sessionsMeasured\s*>\s*coverage\.sessionsPlanned/.test(evidence));
  ok('and it never clamps the count to hide the case',
    !/Math\.(min|max)/.test(evidence));

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

// ── THE TEAM NIGHT'S OWN LOAD (seat item 6, 2026-08-12) ───────────────────
//
// `TeamTrainingSessionOutcome` stores effort AND durationMinutes, is written by
// the feedback panel and validated at the transaction boundary — and until today
// NOTHING read it. Third sighting in one day of a value computed and never
// consumed. `docs/EXPERIENCED_LOAD_MEASUREMENT_2026-08-12.md` §6.
ok('a rated team night produces sRPE in the same unit as conditioning',
  teamTrainingSRPE({ effort: 7, durationMinutes: 90 }) === 630,
  teamTrainingSRPE({ effort: 7, durationMinutes: 90 }));
// HALF A MEASUREMENT IS NOT A MEASUREMENT — the same rule conditioningSRPE lives
// by, because a session counted at half its load is worse than one counted at
// none.
ok('a team night with no minutes is unmeasured, not half-counted',
  teamTrainingSRPE({ effort: 7, durationMinutes: 0 } as never) === null);
ok('a team night with no effort is unmeasured, not half-counted',
  teamTrainingSRPE({ effort: 0, durationMinutes: 90 } as never) === null);
ok('a day that was not a team night produces no number',
  teamTrainingSRPE(null) === null);

{
  const derived = deriveSessionLoad({
    date: '2026-07-14', strength: [], conditioning: null,
    teamTraining: { effort: 6, durationMinutes: 75 },
  });
  ok('the derived session carries the team night', derived.teamTrainingSRPE === 450,
    derived.teamTrainingSRPE);
  // THE FLAG IS THE POINT: without it the week reports "unmeasured" for a day
  // whose load the athlete supplied in full.
  ok('a day the athlete rated in full counts as measured', derived.measured === true);
  const without = deriveSessionLoad({ date: '2026-07-14', strength: [], conditioning: null });
  ok('a day with no team night produces no team-night number',
    without.teamTrainingSRPE === null && without.measured === false);
}

// ── THE GAME'S OWN LOAD (seat item 17, Sam ruled 2026-08-12) ──────────────
//
// The question sat under AWAITING SAM since item 6. Sam: *"yes don't we do 'how
// long was your game?' and multiply by game RPE for a score that counts toward
// load?"* — and the app already asked both halves, validated both, and read
// NEITHER. FULL, NOT WEIGHTED: he was given full / discounted / excluded and
// chose full, so no coefficient appears here or in the rule.
ok('a rated game produces sRPE in the same unit as the other three',
  gameSRPE({ bodyRpe: 8, timeOnGroundMinutes: 100, playedWholeGame: true, feel: 3 }) === 800,
  gameSRPE({ bodyRpe: 8, timeOnGroundMinutes: 100, playedWholeGame: true, feel: 3 }));
// THE RULING IS FULL, AND THIS IS THE CELL THAT WOULD CATCH A DISCOUNT. A
// weighting is a Bible change, not a tweak, so a coefficient smuggled in later
// reds here rather than quietly shrinking every athlete's game load.
ok('a game is counted FULL — no weighting is applied to the minutes',
  gameSRPE({ bodyRpe: 5, timeOnGroundMinutes: 120, playedWholeGame: true, feel: 3 })
    === 5 * 120);
// HALF A MEASUREMENT IS NOT A MEASUREMENT — the rule both siblings live by. A
// game the athlete never rated must not read as a LIGHT game.
ok('a game with no minutes is unmeasured, not half-counted',
  gameSRPE({ bodyRpe: 8, timeOnGroundMinutes: 0, playedWholeGame: false, feel: 3 } as never)
    === null);
ok('a game with no body RPE is unmeasured, not half-counted',
  gameSRPE({ bodyRpe: 0, timeOnGroundMinutes: 90, playedWholeGame: true, feel: 3 } as never)
    === null);
ok('a day that was not a game produces no number', gameSRPE(null) === null);

{
  const derived = deriveSessionLoad({
    date: '2026-07-18', strength: [], conditioning: null,
    game: { bodyRpe: 9, timeOnGroundMinutes: 80, playedWholeGame: false, feel: 3 },
  });
  ok('the derived session carries the game', derived.gameSRPE === 720, derived.gameSRPE);
  // A GAME DAY IS THE ONE THE ATHLETE IS MOST LIKELY TO NOTICE MISSING from the
  // week's coverage, which is why the flag matters more here than anywhere.
  ok('a game the athlete rated in full counts as measured', derived.measured === true);
  const without = deriveSessionLoad({ date: '2026-07-18', strength: [], conditioning: null });
  ok('a day with no game produces no game number',
    without.gameSRPE === null && without.measured === false);
  // THE FOUR ARE INDEPENDENT: a game must not be mistaken for a team night by
  // any reader, so one day carrying both keeps both numbers distinct.
  const both = deriveSessionLoad({
    date: '2026-07-18', strength: [], conditioning: null,
    teamTraining: { effort: 6, durationMinutes: 75 },
    game: { bodyRpe: 9, timeOnGroundMinutes: 80, playedWholeGame: false, feel: 3 },
  });
  ok('a game and a team night on one day stay separate numbers',
    both.gameSRPE === 720 && both.teamTrainingSRPE === 450,
    `${both.gameSRPE} / ${both.teamTrainingSRPE}`);

  // A READER THAT STOPS AT `deriveSessionLoad` IS THE DEFECT ITEM 10 EXISTS TO
  // CATCH — and it is exactly how both halves of a game sat validated and unread
  // for as long as they did. The derivation above is worth nothing if the screen
  // never hands it the game, so the PRODUCER is asserted too. A source scan
  // because the wiring is the claim: the input the screen builds must carry the
  // field, not merely be capable of carrying it.
  const producer = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the journal producer was actually read', producer.length > 4000, producer.length);
  ok('the journal producer hands the game to the load model',
    /game:\s*feedback\?\.game\s*\?\?\s*null/.test(producer),
    'JournalScreen builds JournalLoadSessionInput without `game` — the number is '
    + 'computed and never fed, which is the defect this item names');
}

// ── THE STRENGTH SESSION'S OWN DURATION (seat item 18, Sam ruled 2026-08-12) ──
//
// The last of the four kinds. Sam: *"i think do a for now and I will think of if
// thats good enough long term"* — option (a), ACTUAL minutes. The 1-10 effort
// was already stored as `difficulty`; actual minutes was the only missing half.
ok('a rated, timed strength session produces sRPE in the same unit as the other three',
  strengthSRPE(7, 55) === 385, strengthSRPE(7, 55));
// PLANNED MINUTES ARE NOT THE FALLBACK — that is option (b), which Sam did NOT
// choose. Substituting them would make the column look complete when it is not.
ok('a session with effort but no timing is unmeasured, not back-filled',
  strengthSRPE(7, null) === null);
ok('a session timed but never rated is unmeasured', strengthSRPE(null, 55) === null);
ok('a zero duration is not an answer', strengthSRPE(7, 0) === null);

{
  const derived = deriveSessionLoad({
    date: '2026-07-15', strength: [], conditioning: null,
    difficulty: 8, actualMinutes: 45,
  });
  ok('the derived session carries the strength session', derived.strengthSRPE === 360,
    derived.strengthSRPE);
  ok('a strength session the athlete rated and timed counts as measured',
    derived.measured === true);
  const halfAnswered = deriveSessionLoad({
    date: '2026-07-15', strength: [], conditioning: null, difficulty: 8,
  });
  ok('effort alone does not make a session measured',
    halfAnswered.strengthSRPE === null && halfAnswered.measured === false);
  // THE FOUR ARE INDEPENDENT.
  const producer = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the journal producer hands BOTH strength halves to the load model',
    /difficulty:\s*feedback\?\.difficulty\s*\?\?\s*null/.test(producer)
    && /actualMinutes:\s*feedback\?\.actualMinutes\s*\?\?\s*null/.test(producer),
    'JournalScreen builds JournalLoadSessionInput without the strength halves');
}

// ALL FOUR KINDS ARE REAL — the sentence item 6 has been reaching for since it
// was written, asserted rather than announced.
{
  const kinds: readonly unknown[] = [
    conditioningSRPE, teamTrainingSRPE, gameSRPE, strengthSRPE,
  ];
  ok('all four kinds of experienced load exist, and are four distinct functions',
    kinds.every((fn) => typeof fn === 'function') && new Set(kinds).size === 4,
    kinds.map((fn) => typeof fn));
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
