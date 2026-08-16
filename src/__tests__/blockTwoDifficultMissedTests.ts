/**
 * BLOCK TWO — THE DIFFICULT BLOCK, AND THE MISSED-SESSION QUESTION.
 *
 * Subject: `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`, the
 * "Completed but very hard" and "Low readiness or high soreness" sections.
 *
 *   1. a very-hard block never buys a load increase;
 *   2. a FOUR-set main lift becomes THREE;
 *   3. secondary-lift sets fall, and the load does not;
 *   4. hard conditioning falls before easy conditioning, and is REPLACED with
 *      approved easier aerobic work rather than removed;
 *   5. nothing is added — no rep, no kilo, no session;
 *   6. the deload week stays deloaded;
 *   7. the stored explanation matches the stored changes, and Sam's signed
 *      sentence renders only when both of its claims are true.
 *
 * These run against the REAL generation path — `generateProgramLocally` —
 * except where a cell says otherwise and says why.
 *
 * Run: npm run test:block-two-difficult-missed
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — block two must be fully local');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resolveWeekWithConditioning, type ScheduleState } from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  applyBlockBoundaryConditioning,
  decideBlockBoundaryConditioning,
  isLoadExplanationRow,
  isReductionExplanationRow,
  readBlockHistory,
  type BlockBoundaryReductionExplanationRow,
} from '../rules/blockBoundaryProgression';
import { blockBoundaryExplanationSentences } from '../rules/projectionCopy';
import type { SessionFeedback } from '../store/programStore';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const BLOCK_2_START = '2026-08-03';

/**
 * THE ATHLETE'S APPROVED SENTENCE, PINNED AS A LITERAL.
 *
 * Not imported from the registry entry. A cell that reads its expectation out of
 * the value under test cannot fail — that lesson cost this unit a whole mutation
 * run once already (`docs/STATUS_BLOCKTWO.md`, finding 2). These are the words
 * Sam approved on 2026-08-16 and they are written out as such.
 */
const APPROVED_REDUCED_SENTENCE =
  'You completed the last block, but it felt very hard and recovery was low, '
  + "so we've kept your training weights and reduced the amount of work in this "
  + 'block. You can change it if needed.';

/** The lift the guards track: barbell-required, main, and retained across blocks. */
const TRACKED = 'Deadlift';
const TRACKED_RECORDED_KG = 100;
/** What a WELL-RECOVERED block would have bought it — the control's number. */
const PROGRESSED_KG = 102.5;
/** Block 1 programmed the main lift at FOUR sets. The contract's own exhibit. */
const BLOCK_1_MAIN_LIFT_SETS = 4;
const CONTRACT_MAIN_LIFT_SETS = 3;

function athlete(): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: 85,
  } as unknown as OnboardingData;
}

/** The twelve dates of block 1 — three sessions a week for four weeks. */
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

/**
 * Athlete's recorded block 1.
 *
 * ⚠ **NO `completedSets` AND NO `actualReps`, DELIBERATELY.** The app writes
 * them only when the athlete logged per-set detail, and the approved contract
 * forbids claiming to know reps merely because a session was marked complete.
 * `prescribedSets` IS written — it is what the app ASKED FOR, not a claim about
 * what was done, and it is the only place block 1's four-set main lift survives.
 */
function block1(
  overrides: Partial<SessionFeedback>,
  dates: readonly string[] = BLOCK_1_DATES,
): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of dates) {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: [{
        exerciseId: 'ex-0',
        workoutExerciseId: 'wex-0',
        exerciseName: TRACKED,
        prescribedSets: BLOCK_1_MAIN_LIFT_SETS,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        weightKg: TRACKED_RECORDED_KG,
        completion: 'full' as const,
      }],
      ...overrides,
    } as SessionFeedback;
  }
  return feedback;
}

/** Completed, and it was brutal. The contract's "completed but very hard". */
const VERY_HARD = block1({ feeling: 'very_hard', soreness: 'high' });
/** The control: the same athlete, the same block, recovering well. */
const WELL_RECOVERED = block1({});

function build(sessionFeedback: Record<string, SessionFeedback>): TrainingProgram {
  return generateProgramLocally(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
  });
}

interface RowFacts { sets: number; repsMin: number; repsMax: number; kg: number | undefined }

/** Every strength row of a stored program, keyed `week:session:exercise`. */
function rowsOf(program: TrainingProgram): Map<string, RowFacts> {
  const out = new Map<string, RowFacts>();
  for (const [weekIndex, microcycle] of program.microcycles.entries()) {
    for (const workout of microcycle.workouts) {
      for (const exercise of workout.exercises ?? []) {
        out.set(`w${weekIndex + 1}:${workout.name}:${exercise.exercise?.name ?? '?'}`, {
          sets: exercise.prescribedSets,
          repsMin: exercise.prescribedRepsMin,
          repsMax: exercise.prescribedRepsMax,
          kg: exercise.prescribedWeightKg,
        });
      }
    }
  }
  return out;
}

function sessionCount(program: TrainingProgram): number {
  let count = 0;
  for (const microcycle of program.microcycles) {
    for (const workout of microcycle.workouts) {
      if (workout.workoutType !== 'Rest') count++;
    }
  }
  return count;
}

function visibleRowsOf(
  program: TrainingProgram,
  feedback: Record<string, SessionFeedback>,
  weekStartISO: string,
): Map<string, RowFacts> {
  const state = {
    currentProgram: program,
    currentMicrocycle: program.microcycles[0],
    seasonPhase: 'Pre-season',
    manualOverrides: {},
    markedDays: {},
    athleteContext: { ...DEFAULT_ATHLETE_CONTEXT, injuries: [], onboardingData: athlete() },
    sessionFeedback: feedback,
    weightOverrides: {},
    workoutHistory: [],
    blockState: null,
    availableDayNumbers: [1, 3, 5],
  } as unknown as ScheduleState;
  const out = new Map<string, RowFacts>();
  for (const day of resolveWeekWithConditioning(weekStartISO, state)) {
    for (const exercise of day.workout?.exercises ?? []) {
      out.set(exercise.exercise?.name ?? '?', {
        sets: exercise.prescribedSets,
        repsMin: exercise.prescribedRepsMin,
        repsMax: exercise.prescribedRepsMax,
        kg: exercise.prescribedWeightKg,
      });
    }
  }
  return out;
}

const hardProgram = build(VERY_HARD);
const goodProgram = build(WELL_RECOVERED);
const hardRows = rowsOf(hardProgram);
const goodRows = rowsOf(goodProgram);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[0] THE FIXTURE IS WHAT IT CLAIMS TO BE — non-vacuity');

const hardHistory = readBlockHistory({
  feedbackByDate: VERY_HARD,
  blockStartISO: '2026-07-06',
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
const goodHistory = readBlockHistory({
  feedbackByDate: WELL_RECOVERED,
  blockStartISO: '2026-07-06',
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'block 1 recorded the main lift at FOUR sets',
  hardHistory.lastRecordedPrescribedSetsByExercise[TRACKED] === BLOCK_1_MAIN_LIFT_SETS,
  `got ${JSON.stringify(hardHistory.lastRecordedPrescribedSetsByExercise[TRACKED])} — the 4→3 cell below has no coordinates without it`,
);
ok(
  'block 1 recorded the main lift at 100 kg',
  hardHistory.lastRecordedLoadByExercise[TRACKED] === TRACKED_RECORDED_KG,
);
ok(
  'the very-hard block reads as VERY HARD',
  hardHistory.recoveryVerdict === 'very_hard' && hardHistory.reduces,
  `verdict ${hardHistory.recoveryVerdict}, reduces ${hardHistory.reduces}`,
);
ok(
  'the control block reads as GOOD and does NOT reduce',
  goodHistory.recoveryVerdict === 'good' && !goodHistory.reduces && goodHistory.qualifies,
  `verdict ${goodHistory.recoveryVerdict}, reduces ${goodHistory.reduces}`,
);
ok(
  'SILENCE IS NOT "VERY HARD" — an unanswered block holds, it does not reduce',
  readBlockHistory({
    feedbackByDate: block1({ feeling: undefined, soreness: undefined }),
    blockStartISO: '2026-07-06',
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 12,
  }).recoveryVerdict === 'unknown',
);
ok(
  'ONE very-hard session in a good block is enough — the athlete told us',
  readBlockHistory({
    feedbackByDate: {
      ...WELL_RECOVERED,
      '2026-07-22': { ...WELL_RECOVERED['2026-07-22'], feeling: 'very_hard' } as SessionFeedback,
    },
    blockStartISO: '2026-07-06',
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 12,
  }).reduces,
  'a single very-hard answer was swallowed — the reduction would be unreachable for a real athlete',
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[1] A VERY-HARD BLOCK NEVER RECEIVES A LOAD INCREASE');

const hardTracked = [...hardRows.entries()].filter(([key]) => key.endsWith(`:${TRACKED}`));
ok(
  `${TRACKED} is programmed in block 2 at all`,
  hardTracked.length > 0,
  'the guards below are meaningless without the row',
);
ok(
  `${TRACKED} HOLDS the athlete's recorded ${TRACKED_RECORDED_KG} kg`,
  hardTracked.every(([, facts]) => facts.kg === TRACKED_RECORDED_KG),
  `got ${JSON.stringify(hardTracked.map(([k, v]) => [k, v.kg]))}`,
);
ok(
  `CONTROL: the same block, well recovered, DOES progress to ${PROGRESSED_KG} kg`,
  [...goodRows.entries()]
    .filter(([key]) => key.endsWith(`:${TRACKED}`))
    .every(([, facts]) => facts.kg === PROGRESSED_KG),
  'the control did not move — cell [1] would pass on a program that never progresses anything',
);
{
  let raised = 0;
  for (const [key, hard] of hardRows) {
    const good = goodRows.get(key);
    if (!good) continue;
    if (typeof hard.kg === 'number' && typeof good.kg === 'number' && hard.kg > good.kg) raised++;
  }
  ok(
    'NO strength row anywhere in the block carries more load than the well-recovered control',
    raised === 0,
    `${raised} row(s) were loaded higher on the HARDER block`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2] A FOUR-SET MAIN LIFT BECOMES THREE');

ok(
  `${TRACKED} runs at ${CONTRACT_MAIN_LIFT_SETS} sets in every build week`,
  hardTracked
    .filter(([key]) => !key.startsWith('w4:'))
    .every(([, facts]) => facts.sets === CONTRACT_MAIN_LIFT_SETS),
  `got ${JSON.stringify(hardTracked.map(([k, v]) => [k, v.sets]))}`,
);
ok(
  `${TRACKED} runs FEWER than the ${BLOCK_1_MAIN_LIFT_SETS} sets block 1 prescribed`,
  hardTracked.every(([, facts]) => facts.sets < BLOCK_1_MAIN_LIFT_SETS),
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[3] SECONDARY VOLUME FALLS BEFORE MEANINGFUL INTENSITY');

{
  // A secondary lift the composer authored at three sets in a build week.
  const secondaryKeys = [...goodRows.entries()]
    .filter(([key, facts]) => !key.startsWith('w4:') && facts.sets === 3 && key.includes('Single-Leg RDL'));
  ok(
    'a three-set secondary lift exists in the control to reduce',
    secondaryKeys.length > 0,
    'no coordinates — the cell below would pass vacuously',
  );
  let fell = 0;
  let loadMoved = 0;
  for (const [key, good] of secondaryKeys) {
    const hard = hardRows.get(key);
    if (!hard) continue;
    if (hard.sets < good.sets) fell++;
    if (hard.kg !== good.kg) loadMoved++;
  }
  ok(
    'the secondary lift loses a set',
    fell === secondaryKeys.length,
    `${fell} of ${secondaryKeys.length} fell`,
  );
  ok(
    'and its LOAD is untouched — volume falls before intensity',
    loadMoved === 0,
    `${loadMoved} secondary row(s) had their load moved by the reduction`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[4] NOTHING IS ADDED — NO REP, NO KILO, NO SESSION');

{
  let repsAdded = 0;
  let setsAdded = 0;
  for (const [key, hard] of hardRows) {
    const good = goodRows.get(key);
    if (!good) continue;
    if (hard.repsMax > good.repsMax || hard.repsMin > good.repsMin) repsAdded++;
    if (hard.sets > good.sets) setsAdded++;
  }
  ok('no row gains repetitions', repsAdded === 0, `${repsAdded} row(s) gained reps`);
  ok('no row gains sets', setsAdded === 0, `${setsAdded} row(s) gained sets`);
}
ok(
  'the block carries no extra session',
  sessionCount(hardProgram) <= sessionCount(goodProgram),
  `hard ${sessionCount(hardProgram)} vs control ${sessionCount(goodProgram)}`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[5] THE DELOAD WEEK STAYS DELOADED — R-034 IS NOT UNDONE');

{
  const deloadKeys = [...goodRows.keys()].filter((key) => key.startsWith('w4:'));
  ok('the block has a deload week to protect', deloadKeys.length > 0);
  let raised = 0;
  for (const key of deloadKeys) {
    const good = goodRows.get(key);
    const hard = hardRows.get(key);
    if (!good || !hard) continue;
    if (hard.sets > good.sets) raised++;
  }
  ok(
    'the reduction never RAISES a deload-week set count',
    raised === 0,
    `${raised} deload row(s) were raised — the reduction outranked the deload law`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[6] ACCESSORIES ARE NOT ON THE REDUCTION LIST');

{
  const accessory = 'Bicep Curl (Barbell)';
  const goodAccessory = [...goodRows.entries()].filter(([key]) => key.endsWith(`:${accessory}`));
  ok(`the control programmes ${accessory}`, goodAccessory.length > 0);
  ok(
    `${accessory} keeps its authored set count on a very-hard block`,
    goodAccessory.every(([key, good]) => (hardRows.get(key)?.sets ?? -1) === good.sets),
    'an accessory was reduced — the contract\'s order never reaches it',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[7] HARD CONDITIONING FALLS BEFORE EASY CONDITIONING');

/**
 * ⚠ CONSTRUCTED TREE, AND THE REASON IS MEASURED, NOT ASSUMED.
 *
 * 48 generated worlds were swept at `6117a9fd` (3 phases × {3,4} training days ×
 * {Poor,Good} conditioning × {Never,Regularly} sprint × club/no-club). **Every
 * world that built carried ONLY `aerobic_base` and `tempo`** — the deterministic
 * generator emits no sprint/vo2/glycolytic/COD session today, so no generated
 * fixture can put a hard conditioning session in front of this rule. Making it
 * emit one is a scheduler change and is outside this mission.
 *
 * The tree below is therefore hand-built, and the cell says so rather than
 * dressing a generated aerobic week up as a hard one.
 */
function conditioningWorkout(id: string, category: Workout['conditioningCategory']): Workout {
  return {
    id,
    microcycleId: 'mc-1',
    dayOfWeek: 1,
    name: id,
    description: '',
    durationMinutes: 40,
    intensity: 'High',
    workoutType: 'Conditioning',
    conditioningCategory: category,
    conditioningFlavour: 'high-intensity',
    exercises: [{
      id: `${id}-row`,
      workoutId: id,
      exerciseId: 'cond',
      exerciseOrder: 1,
      prescribedSets: 4,
      prescribedRepsMin: 1,
      prescribedRepsMax: 1,
      role: 'conditioning',
      exercise: { id: 'cond', name: '40 m Flying Sprints' },
    }],
  } as unknown as Workout;
}

{
  const tree = [
    conditioningWorkout('hard-vo2', 'vo2'),
    conditioningWorkout('hard-sprint', 'sprint'),
    conditioningWorkout('easy-base', 'aerobic_base'),
    conditioningWorkout('easy-tempo', 'tempo'),
  ];
  const decisions = decideBlockBoundaryConditioning({
    history: hardHistory,
    nextBlockWorkouts: tree,
    weekIndex: 0,
  });
  ok(
    'both HARD sessions are decided, and only they',
    decisions.length === 2
      && decisions.every((d) => d.workoutId === 'hard-vo2' || d.workoutId === 'hard-sprint'),
    `decided ${JSON.stringify(decisions.map((d) => d.workoutId))}`,
  );
  ok(
    'the EASY sessions are not touched — hard falls first',
    !decisions.some((d) => d.workoutId.startsWith('easy-')),
  );
  ok(
    'a WELL-RECOVERED block decides no conditioning change at all',
    decideBlockBoundaryConditioning({
      history: goodHistory, nextBlockWorkouts: tree, weekIndex: 0,
    }).length === 0,
  );

  const applied = applyBlockBoundaryConditioning({
    workouts: tree,
    decisions,
    seedISO: BLOCK_2_START,
    miniCycleNumber: 1,
  });
  ok(
    'the sessions REMAIN in the week — replaced, never removed',
    applied.length === tree.length,
    `${tree.length} in, ${applied.length} out — a removed session breaks the weekly conditioning minimum`,
  );
  const replaced = applied.filter((w) => w.id === 'hard-vo2' || w.id === 'hard-sprint');
  ok(
    'each replaced session is now approved easier aerobic work',
    replaced.every((w) => w.conditioningCategory === 'aerobic_base'
      && w.conditioningFlavour === 'aerobic'),
    `got ${JSON.stringify(replaced.map((w) => [w.id, w.conditioningCategory, w.conditioningFlavour]))}`,
  );
  ok(
    'the sprint row is GONE and an authored aerobic row stands in its place',
    replaced.every((w) => {
      const names = (w.exercises ?? []).map((e) => e.exercise?.name ?? '');
      return !names.includes('40 m Flying Sprints') && names.length > 0;
    }),
    `rows: ${JSON.stringify(replaced.map((w) => (w.exercises ?? []).map((e) => e.exercise?.name)))}`,
  );
  ok(
    'the untouched sessions are the SAME objects — nothing else was rewritten',
    applied.filter((w) => w.id.startsWith('easy-'))
      .every((w, i) => w === tree.filter((t) => t.id.startsWith('easy-'))[i]),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[8] THE STORED EXPLANATION MATCHES THE STORED CHANGES');

const reductionRow = (hardProgram.blockBoundaryExplanation ?? [])
  .find(isReductionExplanationRow);
ok(
  'the stored program carries a reduction row',
  reductionRow !== undefined,
  'nothing was stored — the athlete is shown a changed programme with no reason',
);
ok(
  'the reduction row LEADS the explanation',
  isReductionExplanationRow((hardProgram.blockBoundaryExplanation ?? [])[0]),
);
ok(
  'it names the real completed-session count',
  reductionRow?.sessionsCompleted === BLOCK_1_DATES.length,
  `row says ${reductionRow?.sessionsCompleted}, the fixture logged ${BLOCK_1_DATES.length}`,
);
ok(
  'it claims the loads were held, and no load row contradicts it',
  reductionRow?.loadsHeld === true
    && !(hardProgram.blockBoundaryExplanation ?? [])
      .filter(isLoadExplanationRow)
      .some((row) => row.kind === 'history_progressed'),
);
ok(
  `it names ${TRACKED}'s set change, and the numbers are the stored ones`,
  (() => {
    const named = reductionRow?.setsReduced.find((r) => r.exerciseName === TRACKED);
    if (!named) return false;
    return named.previousSets === BLOCK_1_MAIN_LIFT_SETS
      && named.nextSets === CONTRACT_MAIN_LIFT_SETS
      && hardTracked.every(([key, facts]) => key.startsWith('w4:') || facts.sets === named.nextSets);
  })(),
  `row says ${JSON.stringify(reductionRow?.setsReduced.find((r) => r.exerciseName === TRACKED))}`,
);
ok(
  'every exercise the row names is really in the stored block',
  (reductionRow?.setsReduced ?? []).every((named) =>
    [...hardRows.keys()].some((key) => key.endsWith(`:${named.exerciseName}`))),
);
ok(
  'a WELL-RECOVERED block stores NO reduction row',
  !(goodProgram.blockBoundaryExplanation ?? []).some(isReductionExplanationRow),
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log("\n[9] SAM'S SENTENCE, RENDERED FROM THE STORED ROW");

const hardSentences = blockBoundaryExplanationSentences(hardProgram).map(String);
ok(
  'the stored reduction renders an athlete-visible sentence',
  hardSentences.length > 0,
);
ok(
  'it is EXACTLY the approved wording',
  hardSentences[0] === APPROVED_REDUCED_SENTENCE,
  `got ${JSON.stringify(hardSentences[0])}`,
);
ok(
  'it claims nothing about reps or sets completed',
  !/\brep(s|etition)/i.test(hardSentences[0] ?? '')
    && !/\bevery set\b/i.test(hardSentences[0] ?? ''),
);
ok(
  'it survives reload unchanged',
  blockBoundaryExplanationSentences(
    JSON.parse(JSON.stringify(hardProgram)) as TrainingProgram,
  ).map(String)[0] === APPROVED_REDUCED_SENTENCE,
);
ok(
  'a well-recovered block is NOT told its work was reduced',
  !blockBoundaryExplanationSentences(goodProgram).map(String)
    .includes(APPROVED_REDUCED_SENTENCE),
);
{
  // The sentence says "we've kept your training weights". A row that says
  // otherwise must not be allowed to render it.
  const lying: BlockBoundaryReductionExplanationRow = {
    ...(reductionRow as BlockBoundaryReductionExplanationRow),
    loadsHeld: false,
  };
  ok(
    'a row whose loads were NOT held renders no sentence',
    !blockBoundaryExplanationSentences({ blockBoundaryExplanation: [lying] })
      .map(String).includes(APPROVED_REDUCED_SENTENCE),
    'the app would tell an athlete it kept their weights on a block where it raised one',
  );
  const nothingReduced: BlockBoundaryReductionExplanationRow = {
    ...(reductionRow as BlockBoundaryReductionExplanationRow),
    setsReduced: [],
    hardConditioningReplaced: [],
  };
  ok(
    'a row that reduced NOTHING renders no sentence',
    !blockBoundaryExplanationSentences({ blockBoundaryExplanation: [nothingReduced] })
      .map(String).includes(APPROVED_REDUCED_SENTENCE),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[10] STORED = VISIBLE = RELOADED');

{
  const stored = hardRows.get(`w1:full_body:${TRACKED}`) ?? hardRows.get(`w1:lower:${TRACKED}`);
  const visible = visibleRowsOf(hardProgram, VERY_HARD, BLOCK_2_START).get(TRACKED);
  const reloaded = rowsOf(JSON.parse(JSON.stringify(hardProgram)) as TrainingProgram);
  const reloadedStored = reloaded.get(`w1:full_body:${TRACKED}`) ?? reloaded.get(`w1:lower:${TRACKED}`);
  ok(
    `${TRACKED} is one prescription across stored, visible and reloaded`,
    stored !== undefined
      && visible !== undefined
      && stored.sets === visible.sets
      && stored.kg === visible.kg
      && stored.sets === reloadedStored?.sets
      && stored.kg === reloadedStored?.kg,
    `stored ${JSON.stringify(stored)} · visible ${JSON.stringify(visible)} · reloaded ${JSON.stringify(reloadedStored)}`,
  );
}

console.log(`\nBlock two difficult/missed: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
