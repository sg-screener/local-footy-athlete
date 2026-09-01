/**
 * ONE OWNER OF WEEK IDENTITY.
 *
 * The proof cells for defect D1 of the §18 ownership reassessment
 * (`docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-08-05.md`, approved by Sam
 * 2026-08-05). Measured root of device finding 5b:
 *
 *   > The accepted program says "this is block week 2"; the scoped regen
 *   > re-derives "week 1" from a date. Same class as the deload-shape
 *   > falsification — two owners of one fact.
 *
 * The block grid has exactly one owner: the STORED ANCHOR
 * (`blockState.blockStartDate` + `blockState.blockNumber`). Every other
 * statement about "which week of which block is this date" is a derivation
 * FROM that anchor. Before this unit, generation derived the block NUMBER from
 * the anchor (`getCurrentBlockNumberForGeneration`) and the block START from
 * `todayISO` — two owners of one grid, which disagree for every date that is
 * not itself a block start.
 *
 * The consequence is not cosmetic. The block's strength allocation alternates
 * by `weekNumber % 2`, so re-authoring an even-parity week as week 1 plans the
 * MIRROR week's patterns: the pinned history (pull/squat) and the regenerated
 * remainder (pull/squat) then cover two patterns instead of four, §18 fires
 * `pattern_imbalance`, and the athlete's stored fact is rolled back.
 *
 * These cells assert the BLOCK POSITION THE GENERATOR WAS GIVEN — never
 * downstream content — so they stay true when the allocator changes.
 *
 * Run: npm run test:week-identity
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

(global as unknown as { localStorage: unknown }).localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { readFileSync } from 'fs';
import type { OnboardingData } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  getBlockNumberForDate,
  resolveBlockGridPosition,
} from '../utils/programBlockState';
import {
  getBlockPositionForGeneration,
  getCurrentBlockNumberForGeneration,
  useProgramStore,
} from '../store/programStore';
import {
  acceptSection18Week,
  requireSection18AcceptedWeek,
  runSection18AcceptedWeekGateway,
} from '../rules/section18AcceptedWeekGateway';
import { buildSection18WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { emptyEvaluationSurfaces } from './evaluationSurfacesTestSupport';

const PROFILE: Partial<OnboardingData> = {
  gender: 'male', seasonPhase: 'In-season',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 1,
  teamTrainingDays: ['Tuesday'],
  gameDay: 'Saturday',
  usualGameDay: 'Saturday',
  sprintExposure: 'Occasionally',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Pretty consistent',
  injuries: [],
  motivation: 'Get stronger',
  experienceLevel: '5+ years',
  trainingLocation: 'Commercial gym',
  equipmentAnswer: {
    tags: {
      dumbbells: 'have', barbell: 'have', cables: 'have', bands: 'have',
      bench: 'have', machine: 'have', pullup_bar: 'have', foam_roller: 'have',
      kettlebell: 'have', plyo_box: 'have',
    },
    modalities: {
      bike_erg: 'have', row: 'have', air_bike: 'have', treadmill: 'have',
    },
    answeredOn: '2026-07-20',
  },
};

/** Sam's world: the block starts 2026-07-27, his pass week is the SECOND. */
const BLOCK_START = '2026-07-27';
const WEEK_2 = '2026-08-03';
const WEEK_3 = '2026-08-10';
const WEEK_4 = '2026-08-17';
/** First Monday of the NEXT block. */
const NEXT_BLOCK_START = '2026-08-24';
const NOW = '2026-08-03T00:00:00.000Z';

let passed = 0;
let failed = 0;

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, test: () => void): void {
  try { test(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failed += 1; console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

function resetProgramStore(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
}

console.log('\n-- One owner of week identity (§18 reassessment D1) --');

// ── W1 — the anchor resolves a WHOLE position, not a number in isolation.
// `getBlockNumberForDate` advanced the block number across block boundaries
// while nothing derived the matching block START from the same anchor. One
// resolver now returns both, so they cannot disagree by construction.
run('W1 the stored anchor resolves block number, block start and week-in-block together', () => {
  const anchor = { blockStartDate: BLOCK_START, blockNumber: 1 };
  const cases: ReadonlyArray<[string, number, string, number]> = [
    [BLOCK_START, 1, BLOCK_START, 1],
    [WEEK_2, 1, BLOCK_START, 2],
    ['2026-08-09', 1, BLOCK_START, 2],   // the Sunday of week 2 is still week 2
    [WEEK_3, 1, BLOCK_START, 3],
    [WEEK_4, 1, BLOCK_START, 4],
    [NEXT_BLOCK_START, 2, NEXT_BLOCK_START, 1],
    ['2026-08-31', 2, NEXT_BLOCK_START, 2],
  ];
  for (const [dateISO, blockNumber, blockStart, weekInBlock] of cases) {
    const position = resolveBlockGridPosition(anchor, dateISO);
    assert(position.blockNumber === blockNumber
      && position.blockStart === blockStart
      && position.weekInBlock === weekInBlock,
      `${dateISO}: expected block ${blockNumber} starting ${blockStart} week ${weekInBlock}, `
      + `got ${JSON.stringify(position)}`);
  }
});

// ── W2 — the legacy number-only reader must not drift from the new resolver.
// It is kept (many call sites want only the number) but it is now a projection
// of the same owner, not a second arithmetic.
run('W2 getBlockNumberForDate is a projection of the one resolver', () => {
  for (const dateISO of [BLOCK_START, WEEK_2, WEEK_3, WEEK_4, NEXT_BLOCK_START, '2026-09-14']) {
    const viaResolver = resolveBlockGridPosition(
      { blockStartDate: BLOCK_START, blockNumber: 3 }, dateISO).blockNumber;
    const viaLegacy = getBlockNumberForDate(BLOCK_START, 3, dateISO);
    assert(viaResolver === viaLegacy,
      `${dateISO}: resolver says block ${viaResolver}, getBlockNumberForDate says ${viaLegacy}`);
  }
});

// ── W3 — THE CONSERVATION LAW. A scoped regen of week N re-authors week N.
//
// This is the cell finding 5b never had. It asserts the block position the
// generator was GIVEN — `weekNumber` on the microcycle it returns — against the
// position that same week holds in a full four-week generation of the same
// block. Content is deliberately not compared: the claim is about identity.
run('W3 a single-week regen of block week 2 re-authors WEEK 2, not week 1', () => {
  resetProgramStore();
  const wholeBlock = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: BLOCK_START,
    blockNumber: 1,
  });
  assert(wholeBlock.microcycles.length === 4,
    `the fixture is wrong: a full block generated ${wholeBlock.microcycles.length} weeks`);
  const week2InBlock = wholeBlock.microcycles[1]!;
  assert(week2InBlock.startDate.slice(0, 10) === WEEK_2,
    `the fixture is wrong: block week 2 starts ${week2InBlock.startDate.slice(0, 10)}, not ${WEEK_2}`);

  const scoped = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: WEEK_2,
    blockNumber: 1,
    blockStartISO: BLOCK_START,
    microcycleLimit: 1,
  });
  assert(scoped.microcycles.length === 1,
    `a single-week regen produced ${scoped.microcycles.length} weeks`);
  const authored = scoped.microcycles[0]!;
  assert(authored.startDate.slice(0, 10) === WEEK_2,
    `the regen of ${WEEK_2} authored the week starting ${authored.startDate.slice(0, 10)}`);
  assert(authored.weekNumber === week2InBlock.weekNumber,
    `WEEK IDENTITY LOST: re-authoring ${WEEK_2} produced week ${authored.weekNumber} of the block `
    + `while that same week is week ${week2InBlock.weekNumber} in the accepted block. `
    + 'Two owners of one fact — the accepted program and a date re-derivation.');
});

// ── W4 — the law holds for EVERY week of the block, both parities. Week 2 is
// the one Sam's device hit; asserting only week 2 would be a coordinate, not a
// law, and the odd weeks are exactly the ones that passed by accident before.
run('W4 the conservation law holds for all four weeks of the block', () => {
  resetProgramStore();
  const wholeBlock = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: BLOCK_START,
    blockNumber: 2,
  });
  const weekStarts = [BLOCK_START, WEEK_2, WEEK_3, WEEK_4];
  for (const [index, weekStart] of weekStarts.entries()) {
    const scoped = generateProgramLocally(PROFILE as OnboardingData, {
      todayISO: weekStart,
      blockNumber: 2,
      blockStartISO: BLOCK_START,
      microcycleLimit: 1,
    });
    const authored = scoped.microcycles[0]!;
    const expected = wholeBlock.microcycles[index]!;
    assert(authored.weekNumber === expected.weekNumber
      && authored.startDate.slice(0, 10) === weekStart,
      `regen of ${weekStart} (block week ${index + 1}) authored week ${authored.weekNumber} `
      + `starting ${authored.startDate.slice(0, 10)}; the block holds week ${expected.weekNumber}`);
    assert(authored.weekNumber % 2 === expected.weekNumber % 2,
      `PARITY FLIP on ${weekStart}: the allocator alternates on weekNumber % 2, and the regen `
      + `handed it ${authored.weekNumber} where the block says ${expected.weekNumber}`);
  }
});

// ── W5 — a caller that states nothing keeps the fresh-block meaning. Omitting
// the anchor is not a bug to guard against: a first generation genuinely starts
// its block on the athlete's own week. This is the SAME contract `blockNumber`
// already had (`?? 1`), so the new input adds no second meaning.
run('W5 with no anchor stated, generation still starts the block on the target week', () => {
  resetProgramStore();
  const fresh = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: WEEK_2,
    microcycleLimit: 1,
  });
  const authored = fresh.microcycles[0]!;
  assert(authored.startDate.slice(0, 10) === WEEK_2,
    `a fresh single-week generation authored ${authored.startDate.slice(0, 10)}, not ${WEEK_2}`);
  assert(authored.weekNumber === 1,
    `a fresh block's first week must be week 1, got ${authored.weekNumber}`);
});

// ── W6 — the store hands generation ONE position. The scoped regen must not
// assemble the grid from two reads (number from the anchor, start from a date);
// the store exposes the whole position, and the number-only helper is the same
// value projected out of it.
run('W6 the store hands out one block position, and the number helper agrees with it', () => {
  resetProgramStore();
  const program = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: BLOCK_START,
    blockNumber: 1,
  });
  useProgramStore.getState().setCurrentProgram(program);
  const stored = useProgramStore.getState().blockState;
  assert(stored?.blockStartDate === BLOCK_START && stored?.blockNumber === 1,
    `the anchor did not persist: ${JSON.stringify(stored)}`);

  const position = getBlockPositionForGeneration(WEEK_2);
  assert(position.blockStart === BLOCK_START && position.blockNumber === 1
    && position.weekInBlock === 2,
    `the store resolved ${JSON.stringify(position)} for ${WEEK_2}`);
  assert(position.blockNumber === getCurrentBlockNumberForGeneration(WEEK_2),
    'the store\'s two block readers disagree — the number helper is not a projection '
    + `of the position (${position.blockNumber} vs ${getCurrentBlockNumberForGeneration(WEEK_2)})`);

  const nextBlock = getBlockPositionForGeneration(NEXT_BLOCK_START);
  assert(nextBlock.blockNumber === 2 && nextBlock.blockStart === NEXT_BLOCK_START
    && nextBlock.weekInBlock === 1,
    `crossing the block boundary resolved ${JSON.stringify(nextBlock)}`);
});

console.log('\n-- The gate informs, it never vetoes a fact (§18 reassessment D3) --');

/** A whole authored week with squat twice and no hinge/push — the exact
 *  `pattern_imbalance` shape Sam's device produced, built directly so the cell
 *  does not depend on any generator staying broken. `regenerate` and
 *  `safeFallback` return the same candidate, which is what makes the gateway's
 *  search terminate at `impossible` rather than repair its way out. */
function impossibleWeekInput() {
  const candidate = () => ({
    contract: patternContract(),
    workouts: [
      section18StrengthWorkout('mon', 1, ['Back Squat']),
      section18StrengthWorkout('tue', 2, ['Front Squat']),
    ],
  });
  return { ...candidate(), weekStart: WEEK_2, profile: PROFILE as OnboardingData,
    surfaces: emptyEvaluationSurfaces(),
    regenerate: candidate, safeFallback: candidate };
}

function patternContract() {
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: 'In-season',
    declaredSubphase: 'bye_build',
    mode: 'in_season_bye_build',
    blockNumber: 1,
    weekInBlock: 2,
    globalWeek: 2,
    weekKind: 'build',
    // No anchors at all: the week under test must fail on PATTERNS and nothing
    // else, or the cell would be pinning an unrelated safety contradiction.
    anchorState: 'none',
    teamTrainingDays: [],
    participationProvenance: 'derived_healthy_unrestricted',
    fixtureDays: [],
    capacity: 'medium',
    plannerSelected: {
      mainStrength: 4, coreConditioning: 0, sprintHighSpeed: 0, powerPrimers: 0,
    },
    currentProductionClaimsAnchorCredit: false,
  });
}

function section18StrengthWorkout(id: string, dayOfWeek: number, names: readonly string[]) {
  return finaliseWorkoutAfterMutation({
    id,
    microcycleId: 'week-identity-week',
    dayOfWeek,
    name: 'Strength Session',
    description: '',
    durationMinutes: 50,
    intensity: 'High',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: names.map((name, index) => ({
      id: `${id}-row-${index}`,
      workoutId: id,
      exerciseId: `exercise-${name.toLowerCase().replace(/\W+/g, '-')}`,
      exerciseOrder: index + 1,
      prescribedSets: 4,
      prescribedRepsMin: 5,
      prescribedRepsMax: 5,
      prescribedWeightKg: 60,
      restSeconds: 120,
      exercise: {
        id: `exercise-${name.toLowerCase().replace(/\W+/g, '-')}`,
        name,
        description: '',
        exerciseType: 'Compound',
        muscleGroups: [],
        equipmentRequired: [],
        difficultyLevel: 'Intermediate',
        createdAt: NOW,
        updatedAt: NOW,
      },
      createdAt: NOW,
      updatedAt: NOW,
    })),
    createdAt: NOW,
    updatedAt: NOW,
  } as never, {
    offseasonSubphase: 'not_off_season',
    phase: 'In-season',
  }).workout;
}

// ── A1 — the ownership boundary itself, at the gateway. Same unacceptable
// candidate, two operations, two outcomes. A restoration is replaying a week
// that was accepted once, so a week it cannot reproduce means the snapshot is
// corrupt and it must throw; a forward decision is the athlete stating
// something, and the best achievable week is published for the transaction to
// disclose. One distinction — the one `acceptedStateTransaction` already ruled.
run('A1 an impossible week throws for a restoration and publishes for a forward decision', () => {
  const rejected = impossibleWeekInput();
  // The fixture must genuinely be unacceptable, or both halves of this cell are
  // vacuous — the shape this repo has named "a gate passing on coordinates it
  // never builds".
  const verdict = runSection18AcceptedWeekGateway(rejected);
  const blockers = verdict.evaluation.blockingViolations.map((finding) => finding.code);
  assert(verdict.status === 'impossible',
    `the fixture is wrong, not the rule: the gateway returned ${verdict.status} `
    + `(blockers ${JSON.stringify(blockers)})`);
  assert(blockers.includes('pattern_restore_failure'),
    'the fixture must fail because required safe patterns are absent — '
    + `and it failed on ${JSON.stringify(blockers)} instead`);

  let restorationError: unknown = null;
  try {
    acceptSection18Week({ ...rejected, operation: 'restoration' });
  } catch (error) { restorationError = error; }
  assert((restorationError as { code?: string } | null)?.code === 'section18_week_rejected',
    'a restoration did NOT throw on an impossible week — a corrupt stored snapshot would '
    + `be published in reduced form, which is the mirror-wipe shape (got ${restorationError})`);

  const forward = acceptSection18Week({ ...rejected, operation: 'forward_decision' });
  assert(forward.status === 'impossible',
    `a forward decision must be told the truth about its week, got status=${forward.status}`);
  assert(forward.canonicalWorkouts.length > 0 && forward.contract != null,
    'a forward decision was not handed the best achievable week the search selected — '
    + 'there is nothing to publish and nothing to disclose');
});

// ── A2 — the strict door is the same door. `requireSection18AcceptedWeek` has
// many callers and none of them changed meaning; it is now that one function
// under a restoration, so the two cannot drift into separate rules.
run('A2 requireSection18AcceptedWeek is acceptSection18Week under a restoration', () => {
  const rejected = impossibleWeekInput();
  let strictError: unknown = null;
  try { requireSection18AcceptedWeek(rejected); } catch (error) { strictError = error; }
  assert((strictError as { code?: string } | null)?.code === 'section18_week_rejected',
    `the strict door stopped being strict: ${strictError}`);

  // And it is the SAME door: the strict function and an explicit restoration
  // fail identically, down to the rejection signature. If they ever diverge,
  // one of them has grown a rule of its own.
  let explicitError: unknown = null;
  try {
    acceptSection18Week({ ...impossibleWeekInput(), operation: 'restoration' });
  } catch (error) { explicitError = error; }
  assert((explicitError as Error | null)?.message === (strictError as Error).message,
    'the strict door and an explicit restoration no longer fail the same way:\n'
    + `  strict:      ${(strictError as Error).message}\n`
    + `  restoration: ${(explicitError as Error | null)?.message}`);
});

// ── A3 — the deriving lane says which it is. The whole defect was a lane that
// carries an athlete's stated fact reaching the gate as a restoration, so the
// statement of operation is asserted at the source, not inferred from behaviour.
run('A3 the deriving lane states forward_decision where it generates', () => {
  const source = readFileSync(
    `${__dirname}/../store/temporarySourceFactTransaction.ts`, 'utf8');
  const generateAt = source.indexOf('generateProgramLocally(profile, {');
  assert(generateAt > 0, 'the scoped regen call site moved — this cell cannot see it');
  const call = source.slice(generateAt, source.indexOf('});', generateAt));
  assert(/weekAcceptance:\s*'forward_decision'/.test(call),
    'the scoped regen does not state weekAcceptance: \'forward_decision\' — an athlete\'s '
    + 'stated fact reaches the §18 gate as a restoration and can be vetoed by it');
  assert(/blockStartISO:\s*blockPosition\.blockStart/.test(call),
    'the scoped regen does not carry the accepted block start — week identity has two '
    + 'owners again (D1)');
});

console.log(`\n${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) process.exit(1);
