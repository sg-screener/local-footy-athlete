/**
 * BLOCK TWO — THE PROGRESSION LADDER AND THE RECOVERY RESPONSE.
 *
 * Subject: `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`,
 * "Progression order" and "High readiness and low soreness".
 *
 *   1. LOAD is the first rung and a set is the second — never both on one lift
 *      in one rollover;
 *   2. the set lands only where the load did NOT move;
 *   3. it respects the WC-030 16 main/secondary working-set session ceiling,
 *      and accessories and core are outside that count;
 *   4. it never adds a repetition;
 *   5. a beaten-up, a silent or a strength-hard block gets NOTHING added;
 *   6. a deload week is not raised;
 *   7. the app can tell strength difficulty from conditioning difficulty using
 *      only fields it genuinely records.
 *
 * ⚠ **THE PROGRESSION CELLS RUN AGAINST REAL `generateProgramLocally` WORLDS
 * AND REAL RECORDED HISTORIES.** The history for block N+1 is harvested from the
 * block N the generator actually produced — its rows, its prescribed sets, its
 * loads — so no cell is asserting against a hand-built result row. The two cells
 * that cannot be reached that way say so IN THE CELL and say why.
 *
 * Run: npm run test:block-two-ladder
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
  throw new Error('NETWORK DISABLED — the ladder must be fully local');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resolveWeekWithConditioning, type ScheduleState } from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  countMainSecondarySets,
  decideBlockBoundarySetAdditions,
  applyBlockBoundarySetAdditions,
  readBlockHistory,
  HARD_EFFORT_RATING,
  LADDER_SESSION_SET_CEILING,
  LADDER_SET_ADDITION,
  type BlockBoundaryLiftDecision,
} from '../rules/blockBoundaryProgression';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import type { SessionFeedback } from '../store/programStore';
import type { OnboardingData, TrainingProgram, Workout, WorkoutExercise } from '../types/domain';

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

/** THE CONTRACT'S OWN NUMBERS, PINNED AS LITERALS. */
const CONTRACT_SET_ADDITION = 1;
const CONTRACT_SESSION_SET_CEILING = 16;
/**
 * The effort rating that means *"very hard"* on Sam's signed 1-10 scale
 * (`rules/effortScale.ts`, 2026-08-12: `7 — hard`, `8 — very hard`).
 *
 * ⚠ PINNED, NOT IMPORTED-AND-COMPARED-TO-ITSELF. `docs/STATUS_BLOCKTWO.md`
 * finding 2: a cell that computes its expectation from the value under test
 * cannot fail.
 */
const CONTRACT_HARD_RPE = 8;

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

const BLOCK_1_START = '2026-07-06';
const BLOCK_2_START = '2026-08-03';
/** Three sessions a week for four weeks — the block the athlete was asked for. */
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

function build(
  sessionFeedback: Record<string, SessionFeedback>,
  todayISO = BLOCK_2_START,
  blockNumber = 2,
): TrainingProgram {
  return generateProgramLocally(athlete(), {
    recordSelections: true,
    todayISO,
    blockNumber,
    progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
  });
}

/**
 * ⚠ **THE HISTORY IS HARVESTED FROM A REAL GENERATED BLOCK, NOT AUTHORED.**
 *
 * The mission's rule — *"use real generated programs and recorded histories, not
 * hand-built result rows"*. The rows, the prescribed sets and the loads are the
 * ones the generator actually put in front of the athlete; only the athlete's
 * ANSWERS (`completion`, `feeling`, `soreness`, the conditioning RPE) are chosen
 * per scenario, because those are the athlete's to give.
 */
function logRealBlock(
  program: TrainingProgram,
  dates: readonly string[],
  answers: Partial<SessionFeedback>,
): Record<string, SessionFeedback> {
  const sessions: SessionFeedback['strength'][] = [];
  for (const microcycle of program.microcycles) {
    for (const workout of microcycle.workouts) {
      const rows = (workout.exercises ?? [])
        .filter((row) => row.role !== 'conditioning' && (row.exercise?.name ?? '') !== '')
        .map((row) => ({
          exerciseId: row.exerciseId,
          workoutExerciseId: row.id,
          exerciseName: row.exercise?.name ?? '',
          prescribedSets: row.prescribedSets,
          prescribedRepsMin: row.prescribedRepsMin,
          prescribedRepsMax: row.prescribedRepsMax,
          weightKg: row.prescribedWeightKg ?? null,
          completion: 'full' as const,
        }));
      if (rows.length > 0) sessions.push(rows);
    }
  }
  const feedback: Record<string, SessionFeedback> = {};
  dates.forEach((dateStr, index) => {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: sessions[index % Math.max(1, sessions.length)] ?? [],
      ...answers,
    } as SessionFeedback;
  });
  return feedback;
}

interface RowFacts {
  sets: number;
  repsMin: number;
  repsMax: number;
  kg: number | undefined;
  counts: boolean;
}

function rowsOf(program: TrainingProgram): Map<string, RowFacts> {
  const out = new Map<string, RowFacts>();
  for (const [weekIndex, microcycle] of program.microcycles.entries()) {
    for (const workout of microcycle.workouts) {
      for (const row of workout.exercises ?? []) {
        out.set(`w${weekIndex + 1}:${workout.name}:${row.exercise?.name ?? '?'}`, {
          sets: row.prescribedSets,
          repsMin: row.prescribedRepsMin,
          repsMax: row.prescribedRepsMax,
          kg: row.prescribedWeightKg,
          counts: slotCountsTowardSetBudget(row.section18Evidence?.slot),
        });
      }
    }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[0] LIVENESS — the tested world really contains the work');

const block1 = build({}, BLOCK_1_START, 1);
/** The block the generator gave, completed in full and recovering well. */
const GOOD_HISTORY = logRealBlock(block1, BLOCK_1_DATES, {});
const goodProgram = build(GOOD_HISTORY);
const goodRows = rowsOf(goodProgram);

const countingRows = [...goodRows.values()].filter((row) => row.counts);
ok(
  'the generated block carries main/secondary rows the ceiling counts',
  countingRows.length >= 12,
  `${countingRows.length} counting rows — the ladder has nothing to land on below this`,
);
ok(
  'and it carries rows OUTSIDE that count (accessory/core)',
  [...goodRows.values()].some((row) => !row.counts),
  'without one, the accessory-exclusion cells are vacuous',
);

const goodHistory = readBlockHistory({
  feedbackByDate: GOOD_HISTORY,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'the harvested history QUALIFIES and does not reduce',
  goodHistory.qualifies && !goodHistory.reduces,
  `qualifies=${goodHistory.qualifies} reduces=${goodHistory.reduces}`,
);
ok(
  'and the harvested history really recorded prescriptions and loads',
  Object.keys(goodHistory.lastRecordedPrescribedSetsByExercise).length > 0
    && Object.keys(goodHistory.lastRecordedLoadByExercise).length > 0,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[1] THE ORDER — load is the first rung, a set is the second');

/** The control: the SAME recorded block with the recovery answers removed. */
const SILENT_HISTORY: Record<string, SessionFeedback> = {};
for (const [dateStr, feedback] of Object.entries(GOOD_HISTORY)) {
  SILENT_HISTORY[dateStr] = {
    ...feedback, feeling: undefined, soreness: undefined,
  } as SessionFeedback;
}
const silentProgram = build(SILENT_HISTORY);
const silentRows = rowsOf(silentProgram);

const loadRaised: string[] = [];
const setRaised: string[] = [];
const bothRaised: string[] = [];
for (const [key, row] of goodRows) {
  const control = silentRows.get(key);
  if (!control) continue;
  const kgUp = typeof row.kg === 'number' && typeof control.kg === 'number' && row.kg > control.kg;
  const setsUp = row.sets > control.sets;
  if (kgUp) loadRaised.push(key);
  if (setsUp) setRaised.push(key);
  if (kgUp && setsUp) bothRaised.push(key);
}

ok(
  'a well-completed, well-recovered block raises LOAD on lifts with their own history',
  loadRaised.length > 0,
  'no load moved at all — the first rung is not being climbed and rung two proves nothing',
);
ok(
  'and it adds a SET somewhere the load did not move',
  setRaised.length > 0,
  `no set was added; loadRaised=${loadRaised.length}`,
);
ok(
  'NO LIFT GETS BOTH IN THE SAME ROLLOVER',
  bothRaised.length === 0,
  `both on: ${bothRaised.join(', ')}`,
);

/**
 * The ban is per EXERCISE, not per row: a block runs one lift across several
 * sessions and the load decision is per exercise. Monday taking the load and
 * Friday taking the set is still both rungs on one lift.
 */
const nameOf = (key: string): string => key.split(':').slice(2).join(':');
const loadNames = new Set(loadRaised.map(nameOf));
ok(
  'and the ban holds by exercise NAME across the whole block, not just per row',
  setRaised.every((key) => !loadNames.has(nameOf(key))),
  `set added to a name whose load rose elsewhere: ${setRaised.filter((k) => loadNames.has(nameOf(k))).join(', ')}`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2] EXACTLY ONE SET, AND NOT ONE REPETITION');

ok(
  'every added set is exactly ONE',
  setRaised.every((key) => goodRows.get(key)!.sets - silentRows.get(key)!.sets
    === CONTRACT_SET_ADDITION),
  setRaised.map((k) => `${k} ${silentRows.get(k)!.sets}->${goodRows.get(k)!.sets}`).join(', '),
);
ok(
  'NO REP RANGE MOVES ANYWHERE IN THE BLOCK',
  [...goodRows.entries()].every(([key, row]) => {
    const control = silentRows.get(key);
    return !control || (control.repsMin === row.repsMin && control.repsMax === row.repsMax);
  }),
  'the contract forbids adding repetitions to manufacture progression',
);
ok(
  'the module states one set and only one set',
  LADDER_SET_ADDITION === CONTRACT_SET_ADDITION,
  `LADDER_SET_ADDITION=${LADDER_SET_ADDITION}`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[3] THE CEILING, AND WHAT COUNTS TOWARD IT');

ok(
  'the ladder spends the week contract\'s own 16, not a second one',
  LADDER_SESSION_SET_CEILING === CONTRACT_SESSION_SET_CEILING,
  `LADDER_SESSION_SET_CEILING=${LADDER_SESSION_SET_CEILING}`,
);

let overCeiling: string[] = [];
for (const microcycle of goodProgram.microcycles) {
  for (const workout of microcycle.workouts) {
    const total = countMainSecondarySets(workout);
    if (total > CONTRACT_SESSION_SET_CEILING) overCeiling.push(`${workout.name}=${total}`);
  }
}
ok(
  'no session in the produced block exceeds the ceiling',
  overCeiling.length === 0,
  overCeiling.join(', '),
);

/**
 * ⚠ **THE CEILING BINDS IN A REAL GENERATED WORLD, AND MY FIRST MEASUREMENT OF
 * THIS WAS WRONG.**
 *
 * An earlier cut of this suite recorded *"no production world can put a session
 * on 16"* — the largest total across 33 BLOCK-1 worlds is 12 — and marked the
 * ceiling cells `[CONSTRUCTED]`. That sweep measured the wrong blocks. A
 * **clubless off-season athlete on two gym days**, at BLOCK 2, is authored at
 * **exactly 16 main/secondary sets in every session** (four main lifts at four
 * sets each, the authoring-time freeze having already added the fourth). The
 * real-world cell is directly below; these two keep the boundary conditions
 * either side of the line, which generation does not produce.
 */
function countingRow(id: string, name: string, sets: number): WorkoutExercise {
  return {
    id,
    workoutId: 'w-ceiling',
    exerciseId: id,
    exerciseOrder: 1,
    prescribedSets: sets,
    prescribedRepsMin: 4,
    prescribedRepsMax: 6,
    restSeconds: 0,
    exercise: { id, name } as never,
    section18Evidence: {
      protocolVersion: 1,
      role: 'main_strength',
      strengthPattern: 'squat',
      mainStrengthPattern: 'squat',
      slot: 'squat',
      provenance: 'composer_declaration',
    },
  } as unknown as WorkoutExercise;
}

function ceilingWorkout(sets: number): Workout {
  return {
    id: 'w-ceiling',
    microcycleId: 'mc-ceiling',
    dayOfWeek: 1,
    name: 'ceiling',
    workoutType: 'Strength',
    exercises: [
      countingRow('row-a', 'Back Squat', sets),
      countingRow('row-b', 'Bench Press', 1),
    ],
  } as unknown as Workout;
}

const ceilingArgs = (sets: number) => ({
  history: goodHistory,
  nextBlockWorkouts: [ceilingWorkout(sets)],
  weekIndex: 0,
  weekKind: 'build' as const,
  loadDecisions: [] as BlockBoundaryLiftDecision[],
  authoredSetsByRowId: { 'row-a': sets, 'row-b': 1 },
});

ok(
  '[CONSTRUCTED] a session already at 16 counting sets gains nothing',
  decideBlockBoundarySetAdditions(ceilingArgs(15)).length === 0,
  `session total 16 — decisions ${JSON.stringify(decideBlockBoundarySetAdditions(ceilingArgs(15)))}`,
);
ok(
  '[CONSTRUCTED] a session at 15 may land EXACTLY on the ceiling',
  decideBlockBoundarySetAdditions(ceilingArgs(14))
    .some((decision) => decision.sessionCountingSetsAfter === CONTRACT_SESSION_SET_CEILING),
  'the ceiling must be reachable, not one short — a check on the wrong side of the line',
);

/** Accessories and core are outside the count AND outside the rung. */
function accessoryRow(id: string, name: string, sets: number): WorkoutExercise {
  const row = countingRow(id, name, sets) as unknown as {
    section18Evidence: { role: string; slot: string | null };
  };
  row.section18Evidence = {
    ...row.section18Evidence, role: 'strength_accessory', slot: 'accessory_or_core',
  };
  return row as unknown as WorkoutExercise;
}
const accessoryOnly = {
  id: 'w-acc',
  microcycleId: 'mc-acc',
  dayOfWeek: 1,
  name: 'accessory-only',
  workoutType: 'Strength',
  exercises: [accessoryRow('row-c', 'Back Squat', 3)],
} as unknown as Workout;

ok(
  '[CONSTRUCTED] an accessory/core row does not count toward the ceiling',
  countMainSecondarySets(accessoryOnly) === 0,
  `counted ${countMainSecondarySets(accessoryOnly)}`,
);
ok(
  '[CONSTRUCTED] and never receives the added set, even when it is the only row',
  decideBlockBoundarySetAdditions({
    history: goodHistory,
    nextBlockWorkouts: [accessoryOnly],
    weekIndex: 0,
    weekKind: 'build',
    loadDecisions: [],
    authoredSetsByRowId: { 'row-c': 3 },
  }).length === 0,
);

/**
 * ⚠ **THE CEILING, ON A WORLD GENERATION ACTUALLY BUILDS.**
 *
 * Off-season, two gym days, no club night. Every session is authored at the
 * WC-030 ceiling exactly, the athlete completes the block and reports it easy —
 * and the ladder must still add nothing, because there is no room.
 */
/**
 * ⚠ **THIS WORLD MOVED OFF-SEASON → PRE-SEASON WHEN THE ROTATION OWNER LANDED,
 * AND THE REASON IS THE LADDER WORKING FOR THE FIRST TIME.**
 *
 * The cells below need a REAL generated session sitting EXACTLY on 16 sets, or
 * every guard that consumes `atCeiling` goes vacuous. The off-season world used
 * to supply one. Measured, base `dda2747d` vs the rotation owner, same athlete:
 *
 *   base:  Leg Press:4  Single-Leg RDL:4  Incline DB Bench:4  Single-Arm Pulldown:4  = 16
 *   after: Goblet Squat:4 Single-Leg RDL:4 Bench Press:3      Chin-Ups:3             = 14
 *
 * **Nothing lost a set. Two lifts stopped being GIVEN one** — and that is rung 1
 * of this very suite: *"LOAD is the first rung and a set is the second — never
 * both on one lift in one rollover"*. Under the week-keyed selector a main lift
 * could not survive into block 2, so it never had its own history, so the load
 * rung could never fire and the set rung always did. With main lifts stable
 * across the block, Bench Press and Chin-Ups now progress by LOAD and correctly
 * decline the set.
 *
 * So the world is re-aimed rather than the assertion weakened. Swept all 24
 * phase × days × experience combinations under the new owner: off-season peaks
 * at 14 (2 days) and 15 (3 days); **every pre-season and in-season world reaches
 * 16.** The ceiling is still real, still reached, and still guarded.
 */
const ceilingAthlete = {
  ...athlete(),
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 2,
  preferredTrainingDays: ['Monday', 'Thursday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
} as unknown as OnboardingData;
const ceilingBlock1 = generateProgramLocally(ceilingAthlete, {
  todayISO: BLOCK_1_START, blockNumber: 1,
});
const CEILING_HISTORY = (() => {
  const sessions: SessionFeedback['strength'][] = [];
  for (const microcycle of ceilingBlock1.microcycles) {
    for (const workout of microcycle.workouts) {
      const rows = (workout.exercises ?? [])
        .filter((row) => row.role !== 'conditioning' && (row.exercise?.name ?? '') !== '')
        .map((row) => ({
          exerciseId: row.exerciseId,
          workoutExerciseId: row.id,
          exerciseName: row.exercise?.name ?? '',
          prescribedSets: row.prescribedSets,
          prescribedRepsMin: row.prescribedRepsMin,
          prescribedRepsMax: row.prescribedRepsMax,
          weightKg: row.prescribedWeightKg ?? null,
          completion: 'full' as const,
        }));
      if (rows.length > 0) sessions.push(rows);
    }
  }
  const feedback: Record<string, SessionFeedback> = {};
  BLOCK_1_DATES.forEach((dateStr, index) => {
    feedback[dateStr] = {
      dateStr, completion: 'full', feeling: 'easy', soreness: 'none',
      strength: sessions[index % Math.max(1, sessions.length)] ?? [],
    } as SessionFeedback;
  });
  return feedback;
})();
const ceilingProgram = generateProgramLocally(ceilingAthlete, {
  todayISO: BLOCK_2_START,
  blockNumber: 2,
  progressionHistory: {
    sessionFeedback: CEILING_HISTORY, weightOverrides: {}, blockState: null,
  },
});
const ceilingSessions = ceilingProgram.microcycles
  .flatMap((microcycle) => microcycle.workouts)
  .filter((workout) => (workout.exercises ?? []).length > 0);

const atCeiling = ceilingSessions.filter((workout) =>
  countMainSecondarySets(workout) === CONTRACT_SESSION_SET_CEILING);
ok(
  'a REAL generated session sits EXACTLY on the 16-set ceiling',
  atCeiling.length > 0,
  `session totals: ${ceilingSessions.map((workout) =>
    `${workout.name}=${countMainSecondarySets(workout)}`).join(' ')}`,
);
ok(
  'and no session in that block exceeds it',
  ceilingSessions.every((workout) =>
    countMainSecondarySets(workout) <= CONTRACT_SESSION_SET_CEILING),
  ceilingSessions.map((workout) =>
    `${workout.name}=${countMainSecondarySets(workout)}`).join(' '),
);
ok(
  'that block reads as completed and consistently easy — it WOULD progress',
  readBlockHistory({
    feedbackByDate: CEILING_HISTORY,
    blockStartISO: BLOCK_1_START,
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 8,
  }).qualifies,
  'the cell below would pass because the block does not qualify, not because of the ceiling',
);
/**
 * ⚠ **AND THE RULE IS ASKED DIRECTLY ABOUT THOSE REAL SESSIONS, NOT DIFFED
 * AGAINST A SILENT CONTROL.**
 *
 * A silent control does not isolate this rung here: a silent block does not
 * qualify, so the AUTHORING-TIME FREEZE behaves differently too, and the diff
 * would credit the ladder with sets the freeze added. Measured — 12 counting
 * rows move between those two arms, and they are not all this module's. The
 * at-ceiling workouts are handed to the decision function itself, with the sets
 * they were really authored at.
 */
const ceilingSnapshot: Record<string, number> = {};
for (const workout of atCeiling) {
  for (const row of workout.exercises ?? []) ceilingSnapshot[row.id] = row.prescribedSets;
}
const ceilingHistory = readBlockHistory({
  feedbackByDate: CEILING_HISTORY,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 8,
});
ok(
  'AND THE LADDER ADDS NOTHING TO A REAL SESSION ON THE CEILING',
  decideBlockBoundarySetAdditions({
    history: ceilingHistory,
    nextBlockWorkouts: atCeiling,
    weekIndex: 0,
    weekKind: 'build',
    loadDecisions: [],
    authoredSetsByRowId: ceilingSnapshot,
  }).length === 0,
  'a set was added to a session already at 16',
);
ok(
  'while a real session with ROOM in the same block still gains one',
  (() => {
    const withRoom = ceilingSessions.filter((workout) =>
      countMainSecondarySets(workout) < CONTRACT_SESSION_SET_CEILING
      && countMainSecondarySets(workout) > 0);
    if (withRoom.length === 0) return false;
    const snapshot: Record<string, number> = {};
    for (const workout of withRoom) {
      for (const row of workout.exercises ?? []) snapshot[row.id] = row.prescribedSets;
    }
    return decideBlockBoundarySetAdditions({
      history: ceilingHistory,
      nextBlockWorkouts: withRoom,
      weekIndex: 0,
      weekKind: 'build',
      loadDecisions: [],
      authoredSetsByRowId: snapshot,
    }).length > 0;
  })(),
  'nothing gained anywhere — the cell above would pass for the wrong reason',
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[4] THE STATE GATES — nothing is added to an athlete who is not ready');

const VERY_HARD_HISTORY = logRealBlock(block1, BLOCK_1_DATES,
  { feeling: 'very_hard', soreness: 'high' });
const hardProgram = build(VERY_HARD_HISTORY);
const hardRows = rowsOf(hardProgram);

let hardGained = 0;
for (const [key, row] of hardRows) {
  const control = silentRows.get(key);
  if (control && row.sets > control.sets) hardGained++;
}
ok(
  'a VERY HARD block gains no set anywhere',
  hardGained === 0,
  `${hardGained} rows gained a set on a block the athlete said was brutal`,
);

let silentGained = 0;
for (const [key, row] of silentRows) {
  const control = rowsOf(build({})).get(key);
  if (control && row.sets > control.sets) silentGained++;
}
ok(
  'a SILENT block gains no set — no answer is not a good answer',
  silentGained === 0,
  `${silentGained} rows gained a set from an athlete who said nothing`,
);

const MISSED_HISTORY: Record<string, SessionFeedback> = {};
for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
  MISSED_HISTORY[dateStr] = index < 5
    ? GOOD_HISTORY[dateStr]
    : { ...GOOD_HISTORY[dateStr], completion: 'skipped' } as SessionFeedback;
}
const missedProgram = build(MISSED_HISTORY);
const missedRows = rowsOf(missedProgram);
let missedGained = 0;
for (const [key, row] of missedRows) {
  const control = silentRows.get(key);
  if (control && row.sets > control.sets) missedGained++;
}
ok(
  'a block completed BELOW 75% gains no set — the ladder waits for attendance',
  missedGained === 0,
  `${missedGained} rows gained a set on 5 of 12 sessions`,
);

const deloadWeeks = goodProgram.microcycles
  .map((microcycle, index) => ({ microcycle, index }))
  .filter(({ microcycle }) => microcycle.weekKind === 'deload');
ok(
  'the block really contains a deload week — the deload cell has coordinates',
  deloadWeeks.length > 0,
);
let deloadGained = 0;
for (const { index } of deloadWeeks) {
  for (const workout of goodProgram.microcycles[index].workouts) {
    for (const row of workout.exercises ?? []) {
      const key = `w${index + 1}:${workout.name}:${row.exercise?.name ?? '?'}`;
      const control = silentRows.get(key);
      if (control && row.prescribedSets > control.sets) deloadGained++;
    }
  }
}
ok(
  'THE DELOAD WEEK IS NOT RAISED — R-034 owns its dose',
  deloadGained === 0,
  `${deloadGained} deload rows gained a set`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[5] STRENGTH DIFFICULTY vs CONDITIONING DIFFICULTY — the split read');

/** Conditioning was brutal; the strength days the athlete answered were fine. */
const CONDITIONING_HARD: Record<string, SessionFeedback> = {};
for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
  CONDITIONING_HARD[dateStr] = index % 3 === 0
    ? {
      ...GOOD_HISTORY[dateStr],
      conditioning: { sessionName: 'Steady Blocks', rpe: 9 },
    } as SessionFeedback
    : GOOD_HISTORY[dateStr];
}
const conditioningHardHistory = readBlockHistory({
  feedbackByDate: CONDITIONING_HARD,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'a hard CONDITIONING rpe reads as very hard for CONDITIONING',
  conditioningHardHistory.byQuality.conditioning === 'very_hard',
  `got ${conditioningHardHistory.byQuality.conditioning}`,
);
ok(
  'and it does NOT make the STRENGTH quality hard',
  conditioningHardHistory.byQuality.strength === 'good',
  `got ${conditioningHardHistory.byQuality.strength}`,
);
ok(
  'the conditioning read has real evidence days behind it',
  conditioningHardHistory.byQuality.conditioningAnswerDays > 0
    && conditioningHardHistory.byQuality.strengthAnswerDays > 0,
  JSON.stringify(conditioningHardHistory.byQuality),
);

const conditioningHardProgram = build(CONDITIONING_HARD);
const conditioningHardRows = rowsOf(conditioningHardProgram);
let conditioningHardSetGain = 0;
for (const [key, row] of conditioningHardRows) {
  const control = silentRows.get(key);
  if (control && row.sets > control.sets) conditioningHardSetGain++;
}
ok(
  'STRENGTH STILL PROGRESSES when only the conditioning was hard',
  conditioningHardSetGain > 0,
  'the contract: "strength easy, conditioning difficult: progress strength load or sets"',
);

/** The mirror: the strength days came back very hard. */
const STRENGTH_HARD: Record<string, SessionFeedback> = {};
for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
  STRENGTH_HARD[dateStr] = index % 3 === 0
    ? { ...GOOD_HISTORY[dateStr], feeling: 'very_hard' } as SessionFeedback
    : {
      ...GOOD_HISTORY[dateStr],
      conditioning: { sessionName: 'Steady Blocks', rpe: 4 },
    } as SessionFeedback;
}
const strengthHardHistory = readBlockHistory({
  feedbackByDate: STRENGTH_HARD,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'a very-hard STRENGTH day reads as very hard for STRENGTH',
  strengthHardHistory.byQuality.strength === 'very_hard',
  `got ${strengthHardHistory.byQuality.strength}`,
);
ok(
  'and an easy conditioning rpe reads as GOOD for conditioning at the same time',
  strengthHardHistory.byQuality.conditioning === 'good',
  `got ${strengthHardHistory.byQuality.conditioning}`,
);
const strengthHardRows = rowsOf(build(STRENGTH_HARD));
let strengthHardSetGain = 0;
for (const [key, row] of strengthHardRows) {
  const control = silentRows.get(key);
  if (control && row.sets > control.sets) strengthHardSetGain++;
}
ok(
  'NO STRENGTH SET IS ADDED when strength was the difficult quality',
  strengthHardSetGain === 0,
  `${strengthHardSetGain} rows gained a set while the athlete found lifting brutal`,
);

/**
 * ⚠ **THE COORDINATE THAT KILLS "STRENGTH IS PROGRESSED ON AN AMBIGUOUS
 * ANSWER". MUTATION M3 SURVIVED WITHOUT IT.**
 *
 * Every session in this block carried BOTH strength and conditioning, so the
 * athlete never once answered a question that could only be about lifting. The
 * block-level verdict still reads `good` and the block still QUALIFIES — the
 * ladder's own gate is the only thing standing between an ambiguous answer and
 * an added set. Deleting it turns 41 green cells into 41 green cells unless this
 * world exists.
 */
const ALL_COMBINED: Record<string, SessionFeedback> = {};
for (const dateStr of BLOCK_1_DATES) {
  ALL_COMBINED[dateStr] = {
    ...GOOD_HISTORY[dateStr],
    conditioning: { sessionName: 'Steady Blocks', rpe: 5 },
  } as SessionFeedback;
}
const allCombinedHistory = readBlockHistory({
  feedbackByDate: ALL_COMBINED,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'a block of only COMBINED sessions still qualifies at block level',
  allCombinedHistory.qualifies && !allCombinedHistory.reduces,
  `qualifies=${allCombinedHistory.qualifies} — without this the next cell is vacuous`,
);
ok(
  'but the STRENGTH quality reads UNKNOWN — no answer was only about lifting',
  allCombinedHistory.byQuality.strength === 'unknown'
    && allCombinedHistory.byQuality.strengthAnswerDays === 0,
  JSON.stringify(allCombinedHistory.byQuality),
);
const allCombinedRows = rowsOf(build(ALL_COMBINED));
let allCombinedGained = 0;
for (const [key, row] of allCombinedRows) {
  const control = silentRows.get(key);
  if (control && row.sets > control.sets) allCombinedGained++;
}
ok(
  'AND NO SET IS ADDED ON AN AMBIGUOUS ANSWER, even though the block qualifies',
  allCombinedGained === 0,
  `${allCombinedGained} rows gained a set with zero strength-attributable answers`,
);

/**
 * ⚠ **THE COORDINATE THAT KILLS "THE COMBINED DAY'S FEELING IS A STRENGTH
 * ANSWER". MUTATION M12 SURVIVED WITHOUT IT.**
 *
 * The contract's own case: the session that felt brutal was the one carrying the
 * conditioning, and the pure lifting days were fine. A read that counts the
 * combined day would call STRENGTH very hard on the strength of an answer that
 * was about running.
 */
const COMBINED_DAY_BRUTAL: Record<string, SessionFeedback> = {};
for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
  COMBINED_DAY_BRUTAL[dateStr] = index % 3 === 0
    ? {
      ...GOOD_HISTORY[dateStr],
      feeling: 'very_hard',
      conditioning: { sessionName: 'Steady Blocks', rpe: 9 },
    } as SessionFeedback
    : GOOD_HISTORY[dateStr];
}
const combinedBrutal = readBlockHistory({
  feedbackByDate: COMBINED_DAY_BRUTAL,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'a brutal COMBINED day does not make the STRENGTH quality hard',
  combinedBrutal.byQuality.strength === 'good',
  `got ${combinedBrutal.byQuality.strength} — the answer was about the conditioning`,
);
ok(
  'and the same day DOES make the conditioning quality hard',
  combinedBrutal.byQuality.conditioning === 'very_hard',
  `got ${combinedBrutal.byQuality.conditioning}`,
);
ok(
  'while the BLOCK-level verdict still hears it — R-098\'s reduction is untouched',
  combinedBrutal.recoveryVerdict === 'very_hard' && combinedBrutal.reduces,
  `verdict=${combinedBrutal.recoveryVerdict} reduces=${combinedBrutal.reduces}`,
);

ok(
  'the hard-effort band is the signed scale\'s own "very hard", 8',
  HARD_EFFORT_RATING === CONTRACT_HARD_RPE,
  `HARD_EFFORT_RATING=${HARD_EFFORT_RATING}`,
);
ok(
  'an rpe of 7 ("hard") is NOT the hard band — it is legal, well-recovered work',
  readBlockHistory({
    feedbackByDate: (() => {
      const at7: Record<string, SessionFeedback> = {};
      for (const dateStr of BLOCK_1_DATES) {
        at7[dateStr] = {
          ...GOOD_HISTORY[dateStr],
          conditioning: { sessionName: 'Steady Blocks', rpe: 7 },
        } as SessionFeedback;
      }
      return at7;
    })(),
    blockStartISO: BLOCK_1_START,
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 12,
  }).byQuality.conditioning === 'good',
);
ok(
  'SILENCE IS NOT GOOD for either quality',
  readBlockHistory({
    feedbackByDate: SILENT_HISTORY,
    blockStartISO: BLOCK_1_START,
    blockEndISO: '2026-08-02',
    requiredStrengthSessions: 12,
  }).byQuality.strength === 'unknown',
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[6] THE FREEZE HAS ALREADY MOVED THE ROW — the rung is not spent twice');

/**
 * `utils/progressionRules.buildBuildOutput` hands the authoring-time freeze
 * `setsDelta: 'add_one'`, so by the time the boundary runs the set may already
 * be on the row. Adding to the ROW rather than to the athlete's previous
 * prescription would hand out two sets in one rollover.
 */
const alreadyRaised = {
  id: 'w-raised',
  microcycleId: 'mc-raised',
  dayOfWeek: 1,
  name: 'already-raised',
  workoutType: 'Strength',
  // Authored 3, the freeze already put it on 4.
  exercises: [countingRow('row-d', 'Back Squat', 4)],
} as unknown as Workout;
ok(
  '[CONSTRUCTED] a row the freeze already raised gains nothing more',
  decideBlockBoundarySetAdditions({
    history: goodHistory,
    nextBlockWorkouts: [alreadyRaised],
    weekIndex: 0,
    weekKind: 'build',
    loadDecisions: [],
    authoredSetsByRowId: { 'row-d': 3 },
  }).length === 0,
  'the second rung must be spent once per rollover, not once per owner',
);
ok(
  '[CONSTRUCTED] and the module never REDUCES a row while "adding" to it',
  applyBlockBoundarySetAdditions({
    workouts: [alreadyRaised],
    decisions: decideBlockBoundarySetAdditions({
      history: goodHistory,
      nextBlockWorkouts: [alreadyRaised],
      weekIndex: 0,
      weekKind: 'build',
      loadDecisions: [],
      authoredSetsByRowId: { 'row-d': 3 },
    }),
  })[0].exercises![0].prescribedSets === 4,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[7] STORED = VISIBLE = RELOADED');

function visibleRowsOf(
  program: TrainingProgram,
  feedback: Record<string, SessionFeedback>,
): Map<string, number> {
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
  const out = new Map<string, number>();
  for (const day of resolveWeekWithConditioning(BLOCK_2_START, state)) {
    for (const row of day.workout?.exercises ?? []) {
      out.set(row.exercise?.name ?? '?', row.prescribedSets);
    }
  }
  return out;
}

const visible = visibleRowsOf(goodProgram, GOOD_HISTORY);
const storedWeek1 = new Map<string, number>();
for (const workout of goodProgram.microcycles[0].workouts) {
  for (const row of workout.exercises ?? []) {
    storedWeek1.set(row.exercise?.name ?? '?', row.prescribedSets);
  }
}
const setMismatches = [...storedWeek1.entries()]
  .filter(([name, sets]) => visible.has(name) && visible.get(name) !== sets)
  .map(([name, sets]) => `${name} stored=${sets} visible=${visible.get(name)}`);
ok(
  'every stored set count is the set count the screen shows',
  setMismatches.length === 0,
  setMismatches.join(', '),
);

/**
 * ⚠ **A MATCHING PAIR IS NOT EVIDENCE ON ITS OWN** — R-097's lesson. Projection
 * is handed a history that CONTRADICTS the one generation saw; a projection that
 * re-derived would move, and one that obeys the stored prescription cannot.
 */
const contradicted = visibleRowsOf(goodProgram, VERY_HARD_HISTORY);
const movedUnderContradiction = [...storedWeek1.entries()]
  .filter(([name, sets]) => contradicted.has(name) && contradicted.get(name) !== sets)
  .map(([name, sets]) => `${name} stored=${sets} redrawn=${contradicted.get(name)}`);
ok(
  'and a CONTRADICTORY history does not move it — projection displays, it does not decide',
  movedUnderContradiction.length === 0,
  movedUnderContradiction.join(', '),
);

/** A relaunch regenerates from the same explicit inputs; same inputs, same block. */
const relaunched = build(GOOD_HISTORY);
const relaunchedRows = rowsOf(relaunched);
const relaunchDrift = [...goodRows.entries()]
  .filter(([key, row]) => relaunchedRows.get(key)?.sets !== row.sets)
  .map(([key]) => key);
ok(
  'regenerating from the same recorded history reproduces the same set counts',
  relaunchDrift.length === 0,
  relaunchDrift.join(', '),
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[8] THE REAL CHAIN — four consecutive rollovers, no hand-built rows');

let chainHistory: Record<string, SessionFeedback> = {};
let chainBothRungs = 0;
let chainSetsAdded = 0;
let chainLoadsRaised = 0;
let chainOverCeiling = 0;
for (let block = 2; block <= 5; block++) {
  const blockStart = new Date(`${BLOCK_1_START}T12:00:00`);
  blockStart.setDate(blockStart.getDate() + (block - 1) * 28);
  const todayISO = blockStart.toISOString().slice(0, 10);
  const dates = BLOCK_1_DATES.map((dateStr) => {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + (block - 1) * 28);
    return d.toISOString().slice(0, 10);
  });

  const program = build(chainHistory, todayISO, block);
  const silentChain: Record<string, SessionFeedback> = {};
  for (const [dateStr, feedback] of Object.entries(chainHistory)) {
    silentChain[dateStr] = {
      ...feedback, feeling: undefined, soreness: undefined,
    } as SessionFeedback;
  }
  const control = build(silentChain, todayISO, block);
  const live = rowsOf(program);
  const base = rowsOf(control);
  for (const [key, row] of live) {
    const controlRow = base.get(key);
    if (!controlRow) continue;
    const kgUp = typeof row.kg === 'number' && typeof controlRow.kg === 'number'
      && row.kg > controlRow.kg;
    const setsUp = row.sets > controlRow.sets;
    if (kgUp) chainLoadsRaised++;
    if (setsUp) chainSetsAdded++;
    if (kgUp && setsUp) chainBothRungs++;
  }
  for (const microcycle of program.microcycles) {
    for (const workout of microcycle.workouts) {
      if (countMainSecondarySets(workout) > CONTRACT_SESSION_SET_CEILING) chainOverCeiling++;
    }
  }
  chainHistory = { ...chainHistory, ...logRealBlock(program, dates, {}) };
}

ok(
  'the chain really climbed — loads rose across four real rollovers',
  chainLoadsRaised > 0,
  `${chainLoadsRaised} load rises`,
);
ok(
  'and sets were added across them too',
  chainSetsAdded > 0,
  `${chainSetsAdded} sets added over four rollovers`,
);
ok(
  'NO LIFT EVER TOOK BOTH RUNGS IN ONE ROLLOVER, over the whole chain',
  chainBothRungs === 0,
  `${chainBothRungs} lifts took load and a set together`,
);
ok(
  'and no session ever passed the ceiling in the whole chain',
  chainOverCeiling === 0,
  `${chainOverCeiling} sessions over ${CONTRACT_SESSION_SET_CEILING}`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log(`\nBlock two ladder: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
