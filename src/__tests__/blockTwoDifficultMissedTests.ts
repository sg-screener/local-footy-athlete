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
/* ⚠ Blocks the athlete ACCEPTED go through the canonical door, which records
 * what they selected. Speculative calls stay on `generateProgramLocally` and
 * record nothing — the two are different names on purpose. */
import { acceptBlock, resetBlockSelectionHistory } from './support/acceptBlock';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resolveWeekWithConditioning, type ScheduleState } from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  applyBlockBoundaryConditioning,
  applyBlockBoundaryVolume,
  decideBlockBoundaryConditioning,
  decideBlockBoundaryVolume,
  isLoadExplanationRow,
  isReductionExplanationRow,
  readBlockHistory,
  type BlockBoundaryReductionExplanationRow,
} from '../rules/blockBoundaryProgression';
import { commitmentLegalityProbe } from '../rules/weeklyCommitmentLegality';
import {
  answerForBlock,
  commitmentPatchFor,
  decideWeeklyCommitmentQuestion,
  readBlockAttendance,
  type CommitmentLegalityProbe,
} from '../rules/weeklyCommitmentQuestion';
import {
  blockBoundaryExplanationSentences,
  missedSessionCommitmentOptionLabel,
  missedSessionCommitmentQuestionSentence,
} from '../rules/projectionCopy';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { DayOfWeek } from '../types/domain';
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
  + 'week. You can change it if needed.';

/** The lift the guards track: barbell-required, main, and retained across blocks. */
/**
 * ⚠ **THE TRACKED LIFT IS DERIVED FROM THE BLOCK, NOT NAMED.**
 *
 * Sam, 2026-08-17: *"Replace brittle exercise-name assumptions with derived
 * identities where the identity itself is not the test subject."*
 *
 * This suite is about LOAD behaviour — seeding, progression, restoration — and
 * which lift carries it is incidental. `Deadlift` was hardcoded and stopped
 * being block 2's hinge the moment phase preference put RDLs and Trap Bar
 * Deadlift ahead of it, so every cell below reported `ABSENT_ROW` about a
 * perfectly healthy program.
 */
const TRACKED: string = (() => {
  const probe = generateProgramLocally(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    recordSelections: false,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  for (const mc of probe.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if (ex.section18Evidence?.slot !== 'hinge') continue;
        const name = ex.exercise?.name ?? '';
        if (name) return name;
      }
    }
  }
  throw new Error(
    `src/__tests__/blockTwoDifficultMissedTests.ts could not derive a bilateral hinge from block 2 — a block with no `
    + 'hinge at all is a real change in what the app programs, not a test nit.',
  );
})();
const TRACKED_RECORDED_KG = 100;
/** What a WELL-RECOVERED block would have bought it — the control's number. */
const PROGRESSED_KG = 102.5;
/** Block 1 programmed the main lift at FOUR sets. The contract's own exhibit. */
const BLOCK_1_MAIN_LIFT_SETS = 4;
const CONTRACT_MAIN_LIFT_SETS = 3;

/**
 * SAM'S APPROVED MISSED-SESSION QUESTION, PINNED AS A LITERAL with the fixture's
 * own numbers substituted. Not read from the registry entry — see the note on
 * `APPROVED_REDUCED_SENTENCE`.
 */
const APPROVED_QUESTION_SENTENCE =
  'You have been completing about 2 of your 3 planned sessions. '
  + 'Would a smaller weekly program fit your life better?';

/** The canonical week, stated here so the commitment cells do not import a screen. */
const WEEK_ORDER: readonly DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

function athlete(): OnboardingData {
  return {
    gender: 'male', seasonPhase: 'Pre-season',
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
  return acceptBlock(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: {
      sessionFeedback,
      weightOverrides: {},
      blockState: null,
      // ⚠ **WHAT THE BLOCK THAT ENDED REQUIRED — THIS SUITE'S WORLD SAYS SO.**
      //
      // Sam, 2026-08-17: the completion denominator is *"the required strength
      // sessions in the accepted block the athlete actually received"*, recorded
      // at block acceptance. This suite states its world rather than accepting a
      // whole block 1 to produce it, so it states this fact too — the athlete
      // recorded `BLOCK_1_DATES.length` sessions, which is what the block asked
      // of them. Without it the denominator is 0 (there is NO fallback, by
      // ruling), nothing qualifies, and every progression cell below reds while
      // reporting the truth about a world no athlete could be in.
      acceptedBlocks: {
        [BLOCK_1_DATES[0]]: {
          blockNumber: 1, requiredStrengthSessions: BLOCK_1_DATES.length,
        },
      },
    },
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

/** Sessions carrying at least one main/secondary strength row — the commitment. */
function strengthSessionCount(program: TrainingProgram): number {
  let count = 0;
  for (const microcycle of program.microcycles) {
    for (const workout of microcycle.workouts) {
      if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') continue;
      if ((workout.exercises ?? []).some((row) => (row.exercise?.name ?? '') !== ''
        && row.role !== 'conditioning')) count++;
    }
  }
  return count;
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
    gender: 'male', seasonPhase: 'Pre-season',
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
    .filter(([key, facts]) => key.startsWith('w1:') && facts.sets === 3 && key.endsWith(':Lateral Lunge'));
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
  /* ⚠ **DERIVED FROM THE CONTROL BLOCK, NOT NAMED.** The subject is *"accessories
   * are not on the reduction list"* — WHICH accessory is incidental, and naming
   * `Bicep Curl (Barbell)` is why this cell went red when accessories moved to a
   * per-block cadence and that row left block 2. It now asks the control program
   * which accessory it actually built. */
  const accessory = (() => {
    for (const mc of goodProgram.microcycles) {
      for (const w of mc.workouts) {
        for (const ex of w.exercises ?? []) {
          const name = ex.exercise?.name ?? '';
          if (!name || ex.role === 'conditioning') continue;
          if (!slotCountsTowardSetBudget(ex.section18Evidence?.slot)) return name;
        }
      }
    }
    throw new Error(
      'blockTwoDifficultMissedTests could not derive an accessory row from the '
      + 'control block — a block with no accessory at all is a real change, not a test nit.',
    );
  })();
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
  'EVERY row it names is a REAL reduction — no `3 → 3` under a sentence claiming less work',
  (reductionRow?.setsReduced ?? []).length > 0
    && (reductionRow?.setsReduced ?? []).every((named) => named.nextSets < named.previousSets),
  `got ${JSON.stringify(reductionRow?.setsReduced)}`,
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

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[11] THE DECISION LAYER, WHERE THE PIPELINE CANNOT REACH');

/**
 * ⚠ EVERY CELL IN THIS SECTION EXISTS BECAUSE A MUTATION SURVIVED THE ONES
 * ABOVE. They are decision-layer cells and they say so — the pipeline cells are
 * still the primary proof, and these close the coordinates the pipeline does
 * not currently produce.
 */
function strengthRow(id: string, name: string, sets: number): Record<string, unknown> {
  return {
    id,
    workoutId: 'w-1',
    exerciseId: id,
    exerciseOrder: 1,
    prescribedSets: sets,
    prescribedRepsMin: 4,
    prescribedRepsMax: 6,
    prescribedWeightKg: 100,
    restSeconds: 120,
    exercise: { id, name },
  };
}
function strengthWorkout(rows: Record<string, unknown>[]): Workout {
  return {
    id: 'w-1',
    microcycleId: 'mc-1',
    dayOfWeek: 1,
    name: 'lower',
    description: '',
    durationMinutes: 60,
    intensity: 'High',
    workoutType: 'Strength',
    exercises: rows,
  } as unknown as Workout;
}

{
  // M1 SURVIVED HERE. `HARD_BLOCK_MAIN_LIFT_SETS` never bound in the pipeline:
  // `resolveComposedDose` clamps every main lift to three, so the authored
  // ceiling was doing all the work and raising the cap to 4 changed nothing.
  // A FOUR-SET AUTHORED MAIN LIFT IS THE ONLY COORDINATE WHERE THE CONTRACT'S
  // OWN NUMBER IS THE BINDING ONE, and generation does not produce it today.
  const fourSetMain = strengthWorkout([strengthRow('r-main', TRACKED, 4)]);
  const decisions = decideBlockBoundaryVolume({
    history: hardHistory,
    nextBlockWorkouts: [fourSetMain],
    authoredSetsByRowId: { 'r-main': 4 },
  });
  ok(
    'an AUTHORED four-set main lift is reduced to exactly three',
    decisions.length === 1
      && decisions[0].nextSets === CONTRACT_MAIN_LIFT_SETS
      && decisions[0].kind === 'main_lift_sets_reduced',
    `got ${JSON.stringify(decisions)}`,
  );
  ok(
    'a well-recovered block leaves the same four-set lift alone',
    decideBlockBoundaryVolume({
      history: goodHistory,
      nextBlockWorkouts: [fourSetMain],
      authoredSetsByRowId: { 'r-main': 4 },
    }).length === 0,
  );

  // M7 SURVIVED HERE. The deload clamp only bites for an exercise that has
  // RECORDED history AND appears in the deload week, and the generated fixture
  // happens to place `Deadlift` in no deload session.
  const deloadRow = strengthWorkout([strengthRow('r-deload', TRACKED, 2)]);
  const deloadDecisions = decideBlockBoundaryVolume({
    history: hardHistory,
    nextBlockWorkouts: [deloadRow],
    authoredSetsByRowId: { 'r-deload': 2 },
  });
  ok(
    'a lift recorded at FOUR sets is NOT raised to three in a deload week authored at two',
    deloadDecisions.every((decision) => decision.nextSets <= 2),
    `got ${JSON.stringify(deloadDecisions)} — the reduction outranked R-034`,
  );

  // M9 SURVIVED HERE. An accessory sits at the two-set floor already, so
  // reducing it and refusing to reduce it produce the same number. The
  // difference is whether a DECISION exists at all.
  const accessoryOnly = strengthWorkout([strengthRow('r-acc', 'Bicep Curl (Barbell)', 3)]);
  ok(
    'an accessory produces NO volume decision, not a decision that happens to be a no-op',
    decideBlockBoundaryVolume({
      history: hardHistory,
      nextBlockWorkouts: [accessoryOnly],
      authoredSetsByRowId: { 'r-acc': 3 },
    }).length === 0,
  );

  // M11 SURVIVED HERE. Comparing the reduced block against the well-recovered
  // control cannot see reps ADDED BACK to the freeze's already-lowered range —
  // the row lands exactly on the control's number and the comparison is silent.
  // The honest assertion is that the volume owner moves ONE field.
  const before = strengthWorkout([strengthRow('r-only', TRACKED, 4)]);
  const after = applyBlockBoundaryVolume({
    workouts: [before],
    decisions: decideBlockBoundaryVolume({
      history: hardHistory,
      nextBlockWorkouts: [before],
      authoredSetsByRowId: { 'r-only': 4 },
    }),
  });
  const beforeRow = (before.exercises ?? [])[0] as unknown as Record<string, unknown>;
  const afterRow = (after[0].exercises ?? [])[0] as unknown as Record<string, unknown>;
  const movedFields = Object.keys({ ...beforeRow, ...afterRow })
    .filter((key) => beforeRow[key] !== afterRow[key]);
  ok(
    'applying a volume decision moves `prescribedSets` AND NOTHING ELSE',
    movedFields.length === 1 && movedFields[0] === 'prescribedSets',
    `moved ${JSON.stringify(movedFields)}`,
  );
}

{
  // M5 SURVIVED HERE. The fixture answers `very_hard` AND `high` together, so
  // deleting either reader leaves the other one carrying the verdict.
  const sorenessOnly = readBlockHistory({
    feedbackByDate: block1({ feeling: 'good', soreness: 'high' }),
    blockStartISO: '2026-07-06',
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 12,
  });
  ok(
    'historical soreness alone cannot cause a new reduction',
    sorenessOnly.recoveryVerdict === 'good' && !sorenessOnly.reduces,
    `verdict ${sorenessOnly.recoveryVerdict}`,
  );
  const effortOnly = readBlockHistory({
    feedbackByDate: block1({ feeling: 'very_hard', soreness: 'mild' }),
    blockStartISO: '2026-07-06',
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 12,
  });
  ok(
    'VERY-HARD EFFORT ALONE reduces — soreness is not the only door',
    effortOnly.recoveryVerdict === 'very_hard' && effortOnly.reduces,
    `verdict ${effortOnly.recoveryVerdict}`,
  );
  ok(
    'a `hard` (not very hard) block with mild soreness does NOT reduce',
    !readBlockHistory({
      feedbackByDate: block1({ feeling: 'hard', soreness: 'mild' }),
      blockStartISO: '2026-07-06',
      blockEndISO: '2026-08-02',
      requiredStrengthSessions: 12,
    }).reduces,
    'the reduction fires on an ordinary hard block — every athlete would be reduced forever',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[12] THE MISSED-SESSION QUESTION — WHEN IT IS PUT, AND WHEN IT IS NOT');

/** Athlete B's block 1: three sessions a week for four weeks were asked for. */
const SESSIONS_PER_WEEK = 3;
const BLOCK_WEEKS = 4;
const BLOCK_1_WINDOW = { blockStartISO: '2026-07-06', blockEndISO: '2026-08-02' };

/** A block where only the named dates were completed; the rest were skipped. */
function attendanceBlock(completedDates: readonly string[]): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    feedback[dateStr] = {
      dateStr,
      completion: completedDates.includes(dateStr) ? 'full' : 'skipped',
    } as SessionFeedback;
  }
  return feedback;
}

function attendanceOf(completedDates: readonly string[]) {
  return readBlockAttendance({
    feedbackByDate: attendanceBlock(completedDates),
    ...BLOCK_1_WINDOW,
    sessionsPerWeek: SESSIONS_PER_WEEK,
    weeks: BLOCK_WEEKS,
  });
}

/** Everything legal — the probe is stubbed so the gate under test is attendance. */
const allLegal: CommitmentLegalityProbe = () => true;

function ask(
  completedDates: readonly string[],
  ledgerEntries: readonly DecisionLedgerEntry[] = [],
  isCommitmentLegal = allLegal,
) {
  return decideWeeklyCommitmentQuestion({
    attendance: attendanceOf(completedDates),
    forBlockNumber: 1,
    ledgerEntries,
    isCommitmentLegal,
  });
}

{
  // ONE DISRUPTED WEEK. Week 3 (20th, 22nd, 24th) is entirely missed; the other
  // three weeks are perfect. 9 of 12 = exactly 75%, which is NOT below it.
  const oneWeekLost = BLOCK_1_DATES.filter((d) => !['2026-07-20', '2026-07-22', '2026-07-24'].includes(d));
  const oneWeekAttendance = attendanceOf(oneWeekLost);
  ok(
    'one lost week is 9 of 12 — the fixture is the contract\'s own case',
    oneWeekAttendance.completedSessions === 9 && oneWeekAttendance.requiredSessions === 12,
    `got ${oneWeekAttendance.completedSessions}/${oneWeekAttendance.requiredSessions}`,
  );
  ok(
    'ONE DISRUPTED WEEK DOES NOT ASK',
    ask(oneWeekLost).ask === false,
    'the app would redesign a programme over one bad week',
  );
  ok(
    'and the refusal names attendance, not some other gate',
    (ask(oneWeekLost) as { refusal?: string }).refusal === 'attendance_met',
  );
}

{
  // TWO LOST WEEKS. 6 of 12 = 50%.
  const twoWeeksLost = BLOCK_1_DATES.slice(0, 6);
  const outcome = ask(twoWeeksLost);
  ok(
    'BLOCK ATTENDANCE BELOW 75% DOES ASK',
    outcome.ask === true,
    `got ${JSON.stringify(outcome)}`,
  );
  ok(
    'the denominator is the whole block\'s REQUIRED sessions',
    attendanceOf(twoWeeksLost).requiredSessions === SESSIONS_PER_WEEK * BLOCK_WEEKS,
  );
  if (outcome.ask) {
    ok(
      'the numbers it shows are WEEKLY, and they are the real ones',
      outcome.question.completedPerWeek === 2 && outcome.question.plannedPerWeek === 3,
      `got about ${outcome.question.completedPerWeek} of ${outcome.question.plannedPerWeek}`,
    );
    ok(
      'it offers only SMALLER commitments, largest first',
      outcome.question.options.length > 0
        && outcome.question.options.every((n) => n < SESSIONS_PER_WEEK && n >= 1)
        && outcome.question.options.every((n, i, all) => i === 0 || all[i - 1] > n),
      `offered ${JSON.stringify(outcome.question.options)}`,
    );
  }

  // THE LEGALITY GATE IS REAL — an athlete for whom nothing smaller builds is
  // not offered a question whose every answer the app would refuse.
  ok(
    'no legal smaller commitment means NO question at all',
    ask(twoWeeksLost, [], () => false).ask === false,
  );
  ok(
    'and it says so, rather than blaming attendance',
    (ask(twoWeeksLost, [], () => false) as { refusal?: string }).refusal
      === 'no_legal_smaller_commitment',
  );
  ok(
    'the legality probe DECIDES the offer — 2 is dropped when only 1 builds',
    (() => {
      const only1 = ask(twoWeeksLost, [], (n) => n === 1);
      return only1.ask === true && JSON.stringify(only1.question.options) === '[1]';
    })(),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[13] ASKED AND ANSWERED IS ASKED AND ANSWERED');

function ledgerEntry(answer: { kind: 'confirmed'; sessionsPerWeek: number; trainingDays: never[] } | { kind: 'declined' }, forBlockNumber = 1): DecisionLedgerEntry {
  return {
    id: `dl-${forBlockNumber}-${answer.kind}`,
    occurredAt: '2026-08-03T09:00:00.000Z',
    provenance: 'athlete_tap',
    decision: { kind: 'weekly_commitment_answer', forBlockNumber, answer },
  } as DecisionLedgerEntry;
}

{
  const twoWeeksLost = BLOCK_1_DATES.slice(0, 6);
  ok(
    'a CONFIRMED answer stops the question being re-asked',
    ask(twoWeeksLost, [ledgerEntry({ kind: 'confirmed', sessionsPerWeek: 2, trainingDays: [] })]).ask === false,
  );
  ok(
    'a DECLINED answer stops it too — a decline is an answer, not a silence',
    ask(twoWeeksLost, [ledgerEntry({ kind: 'declined' })]).ask === false,
    'the app would ask the same question every time the screen redrew',
  );
  ok(
    'an answer to a DIFFERENT block does not silence this one',
    ask(twoWeeksLost, [ledgerEntry({ kind: 'declined' }, 99)]).ask === true,
    'one decline would silence the question for the rest of the athlete\'s life',
  );
  ok(
    'the recorded answer is readable back, verbatim',
    (() => {
      const read = answerForBlock([ledgerEntry({ kind: 'confirmed', sessionsPerWeek: 2, trainingDays: [] })], 1);
      return read?.kind === 'confirmed' && read.sessionsPerWeek === 2;
    })(),
  );
  // B5 SURVIVED HERE. The attendance fixtures used only `full` and `skipped`,
  // so a rule that counted `partial` as attendance had no coordinate to fail on
  // — and `partial` is the commonest real answer for an athlete whose life is
  // getting in the way, which is precisely this question's athlete.
  ok(
    'a block of PARTIAL sessions does NOT read as attendance',
    (() => {
      const partialBlock: Record<string, SessionFeedback> = {};
      for (const dateStr of BLOCK_1_DATES) {
        partialBlock[dateStr] = { dateStr, completion: 'partial' } as SessionFeedback;
      }
      return readBlockAttendance({
        feedbackByDate: partialBlock,
        ...BLOCK_1_WINDOW,
        sessionsPerWeek: SESSIONS_PER_WEEK,
        weeks: BLOCK_WEEKS,
      }).completedSessions === 0;
    })(),
    'the app does not know WHICH work a partial session did — counting it as attendance is an inference the contract forbids',
  );
  ok(
    'and a fully PARTIAL block therefore ASKS',
    decideWeeklyCommitmentQuestion({
      attendance: readBlockAttendance({
        feedbackByDate: Object.fromEntries(BLOCK_1_DATES.map((dateStr) =>
          [dateStr, { dateStr, completion: 'partial' } as SessionFeedback])),
        ...BLOCK_1_WINDOW,
        sessionsPerWeek: SESSIONS_PER_WEEK,
        weeks: BLOCK_WEEKS,
      }),
      forBlockNumber: 1,
      ledgerEntries: [],
      isCommitmentLegal: allLegal,
    }).ask === true,
  );
  ok(
    'THE ANSWER SURVIVES THE LEDGER BEING WRITTEN AND READ BACK',
    (() => {
      const entries = [ledgerEntry({ kind: 'confirmed', sessionsPerWeek: 2, trainingDays: [] })];
      // The ledger persists as JSON. A decision kind that does not round-trip is
      // a decision the app forgets at the next launch.
      const reloaded = JSON.parse(JSON.stringify(entries)) as DecisionLedgerEntry[];
      const read = answerForBlock(reloaded, 1);
      return read?.kind === 'confirmed'
        && read.sessionsPerWeek === 2
        && ask(BLOCK_1_DATES.slice(0, 6), reloaded).ask === false;
    })(),
    'the recorded answer did not survive a reload — the question would be re-asked forever',
  );
  ok(
    'a LATER answer wins over an earlier one — the ledger is append-only',
    (() => {
      const read = answerForBlock([
        ledgerEntry({ kind: 'declined' }),
        ledgerEntry({ kind: 'confirmed', sessionsPerWeek: 1, trainingDays: [] }),
      ], 1);
      return read?.kind === 'confirmed' && read.sessionsPerWeek === 1;
    })(),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[14] THE QUESTION CHANGES NOTHING — NO SILENT REDUCTION, NO CRAMMING');

{
  const twoWeeksLost = BLOCK_1_DATES.slice(0, 6);
  const missedProgram = build(attendanceBlock(twoWeeksLost));
  const missedRows = rowsOf(missedProgram);

  ok(
    'the block still carries the athlete\'s COMMITTED number of sessions',
    sessionCount(missedProgram) === sessionCount(goodProgram),
    `missed-block ${sessionCount(missedProgram)} vs control ${sessionCount(goodProgram)} — the plan was silently reduced`,
  );
  ok(
    'the week SHAPE is untouched — same sessions on the same days',
    JSON.stringify([...missedRows.keys()].sort()) === JSON.stringify([...goodRows.keys()].sort()),
    'the missed block was rebuilt differently before the athlete answered anything',
  );
  ok(
    'NO row carries more sets than the control — nothing was crammed in',
    [...missedRows.entries()].every(([key, row]) => row.sets <= (goodRows.get(key)?.sets ?? row.sets)),
  );
  ok(
    'and the block stores no reduction row — attendance is not the recovery question',
    !(missedProgram.blockBoundaryExplanation ?? []).some(isReductionExplanationRow),
    'a missed block was treated as a very-hard block',
  );
  ok(
    'an unattended block does NOT buy a load increase either',
    [...missedRows.entries()]
      .filter(([key]) => key.endsWith(`:${TRACKED}`))
      .every(([, row]) => row.kg !== PROGRESSED_KG),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[15] CONFIRMING WRITES ONE CANONICAL COMMITMENT FACT');

{
  const patch = commitmentPatchFor({
    profile: { preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'] },
    sessionsPerWeek: 2,
    weekOrder: WEEK_ORDER,
  });
  ok(
    'the count and the day set are ONE fact, and they agree',
    patch.trainingDaysPerWeek === patch.preferredTrainingDays.length
      && patch.trainingDaysPerWeek === 2,
    `got ${JSON.stringify(patch)}`,
  );
  ok(
    "the days are a SUBSET of the athlete's own, BEST SEPARATED",
    JSON.stringify(patch.preferredTrainingDays) === JSON.stringify(['Monday', 'Friday']),
    `got ${JSON.stringify(patch.preferredTrainingDays)} — the app answered a question about WHICH days that it never asked`,
  );
  ok(
    'it never returns BACK-TO-BACK days when a separated pair exists',
    (() => {
      const adjacentFirst = commitmentPatchFor({
        profile: { preferredTrainingDays: ['Monday', 'Tuesday', 'Friday'] },
        sessionsPerWeek: 2,
        weekOrder: WEEK_ORDER,
      }).preferredTrainingDays;
      const gap = WEEK_ORDER.indexOf(adjacentFirst[1]) - WEEK_ORDER.indexOf(adjacentFirst[0]);
      return gap > 1;
    })(),
    'WC-110 forbids back-to-back gym days for a two-session week; "the first n days" of Mon/Tue/Fri is Mon+Tue',
  );
  ok(
    'an out-of-order stored day set is still answered in week order',
    JSON.stringify(commitmentPatchFor({
      profile: { preferredTrainingDays: ['Friday', 'Monday', 'Wednesday'] },
      sessionsPerWeek: 2,
      weekOrder: WEEK_ORDER,
    }).preferredTrainingDays) === JSON.stringify(['Monday', 'Friday']),
  );
}

/**
 * ⚠ THE PROBE IS NOT DECORATION, AND THIS IS THE MEASUREMENT THAT PROVES IT.
 *
 * Re-run after the two-session correction. The PRODUCTION probe (which asks
 * generation, not a table) over nine worlds, with each athlete's real day set:
 *
 *     Pre-season  d=3 -> [2]   d=4 -> [3,2]   d=5 -> [4,3,2]
 *     In-season   d=3 -> [2]   d=4 -> [3,2]   d=5 -> [4,3,2]
 *     Off-season  d=3 -> [2]   d=4 -> [2]     d=5 -> [2]
 *
 * The earlier reading of this table said pre-season and in-season `d=3 -> []`.
 * **Both halves of that were wrong and for two different reasons**: §18's phase
 * table demanded three main-strength sessions against the approved layout
 * clause WC-110's two, and the fixture handed the probe MONDAY AND TUESDAY,
 * which WC-110 refuses as back-to-back. Both are fixed; the cells below are the
 * corrected reading.
 */
{
  const preseasonThree = athlete();
  const probeThree = commitmentLegalityProbe({
    profile: preseasonThree,
    blockStartISO: BLOCK_2_START,
    blockNumber: 2,
  });
  ok(
    'A PRE-SEASON ATHLETE AT THREE CAN CHOOSE TWO — Full Body x2, clause WC-110',
    probeThree(2),
    'the approved two-gym-day pre-season week still does not build',
  );

  const fiveDay = { ...athlete(), trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] } as unknown as OnboardingData;
  const probeFive = commitmentLegalityProbe({
    profile: fiveDay,
    blockStartISO: BLOCK_2_START,
    blockNumber: 2,
  });
  ok(
    'A HIGHER COMMITMENT OFFERS EVERY SMALLER LEGAL COUNT, not merely the next one',
    (() => {
      const outcome = decideWeeklyCommitmentQuestion({
        attendance: readBlockAttendance({
          feedbackByDate: attendanceBlock(BLOCK_1_DATES.slice(0, 6)),
          ...BLOCK_1_WINDOW,
          sessionsPerWeek: 5,
          weeks: BLOCK_WEEKS,
        }),
        forBlockNumber: 1,
        ledgerEntries: [],
        isCommitmentLegal: probeFive,
      });
      return outcome.ask && JSON.stringify(outcome.question.options) === '[4,3,2]';
    })(),
    'a five-day athlete was not offered every smaller legal commitment',
  );

  const threePatch = commitmentPatchFor({
    profile: preseasonThree, sessionsPerWeek: 2, weekOrder: WEEK_ORDER,
  });
  const before = generateProgramLocally(preseasonThree, {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  const after = generateProgramLocally(
    { ...preseasonThree, ...threePatch } as unknown as OnboardingData,
    {
      todayISO: BLOCK_2_START,
      blockNumber: 2,
      progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
    },
  );
  const afterDecline = generateProgramLocally(preseasonThree, {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  ok(
    'CONFIRMING REBUILDS SMALLER through the current scheduler',
    strengthSessionCount(after) < strengthSessionCount(before),
    `before ${strengthSessionCount(before)} strength sessions, after ${strengthSessionCount(after)} — the confirmation did not reach the scheduler`,
  );
  ok(
    'DECLINING leaves the programme SEMANTICALLY unchanged',
    // EVERY PRESCRIPTION AND EVERY SESSION, not every byte. A raw JSON compare
    // is NOT the test and was tried first: generation stamps `updatedAt` per
    // row, so two identical programmes differ by bytes and by nothing an
    // athlete could see.
    JSON.stringify([...rowsOf(afterDecline).entries()].sort())
      === JSON.stringify([...rowsOf(before).entries()].sort())
      && sessionCount(afterDecline) === sessionCount(before),
    'the unanswered programme is not reproducible — something moved without a decision',
  );
}

console.log("\n[16] THE QUESTION'S OWN WORDS");

{
  const twoWeeksLost = BLOCK_1_DATES.slice(0, 6);
  const outcome = ask(twoWeeksLost);
  if (outcome.ask) {
    ok(
      'the question renders EXACTLY the approved wording, with the real numbers',
      String(missedSessionCommitmentQuestionSentence(outcome.question))
        === APPROVED_QUESTION_SENTENCE,
      `got ${JSON.stringify(String(missedSessionCommitmentQuestionSentence(outcome.question)))}`,
    );
    ok(
      'it does not shame — no "only", no "just", no second sentence about consistency',
      !/\bonly\b|\bjust\b|\bshould have\b/i.test(
        String(missedSessionCommitmentQuestionSentence(outcome.question)),
      ),
    );
  }
  ok(
    'an option label is signed, and the singular is its own entry',
    String(missedSessionCommitmentOptionLabel(2)) === '2 sessions a week'
      && String(missedSessionCommitmentOptionLabel(1)) === '1 session a week',
    `got ${String(missedSessionCommitmentOptionLabel(2))} / ${String(missedSessionCommitmentOptionLabel(1))}`,
  );
  ok(
    'THE SAME QUESTION IS RE-DERIVED FROM THE SAME FACTS AFTER A RELOAD',
    (() => {
      const persisted = JSON.parse(JSON.stringify(attendanceBlock(twoWeeksLost))) as Record<string, SessionFeedback>;
      const again = decideWeeklyCommitmentQuestion({
        attendance: readBlockAttendance({
          feedbackByDate: persisted,
          ...BLOCK_1_WINDOW,
          sessionsPerWeek: SESSIONS_PER_WEEK,
          weeks: BLOCK_WEEKS,
        }),
        forBlockNumber: 1,
        ledgerEntries: [],
        isCommitmentLegal: allLegal,
      });
      return JSON.stringify(again) === JSON.stringify(outcome);
    })(),
    'the question is not reproducible from the persisted facts',
  );
}

console.log(`\nBlock two difficult/missed: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
