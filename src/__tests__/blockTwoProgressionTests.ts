/**
 * BLOCK TWO PROGRESSION — the load-authority guards.
 *
 * Subject: Sam's FINAL LOAD-AUTHORITY CLARIFICATION, 2026-08-16.
 *
 *   1. exact exercise has a valid recorded load from a completed exposure →
 *      seed from ITS OWN most recent valid load, then the progression rules;
 *   2. exact exercise never logged → the authored squat/bench-anchor estimate;
 *   3. neither → unset, the athlete chooses;
 *   4. NEVER seed a rotated exercise from the outgoing exercise's weight merely
 *      because they share a slot or movement pattern.
 *
 * These run against the REAL generation path — `generateProgramLocally` — not
 * against the decision function alone, because the decision function returning
 * the right answer proves nothing about what reaches storage. Two cells do call
 * the decision layer directly, and they say so.
 *
 * Run: npm run test:block-two-progression
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
  throw new Error('NETWORK DISABLED — block two progression must be fully local');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resolveWeekWithConditioning, type ScheduleState } from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
/**
 * ⚠ THE EXPECTED NUMBERS ARE LITERALS, NOT `SMALLEST_AUTHORISED_INCREMENT_KG`.
 *
 * They were derived from the production constant until a mutation run caught it:
 * changing 2.5 to 5.0 moved the expectation with it and every cell stayed GREEN.
 * A test that computes its expectation from the value under test cannot fail.
 * 100 and 102.5 are Sam's approved numbers and are written out as such.
 */
const EXPECTED_PROGRESSED_KG = 102.5;
import { startingWeightForAthlete } from '../utils/loadEstimation';
import {
  blockBoundaryExplanationSentences,
  blockBoundaryLoadMovedSentence,
} from '../rules/projectionCopy';
import { smallestPracticalIncrementKg } from '../rules/blockBoundaryProgression';
import type { SessionFeedback } from '../store/programStore';
import type { OnboardingData, TrainingProgram } from '../types/domain';

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
const BLOCK_3_START = '2026-08-31';

/** The lift the guards track: barbell-required, and retained across blocks. */
const TRACKED = 'Deadlift';
const TRACKED_RECORDED_KG = 100;

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

const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

/**
 * Athlete A's recorded history.
 *
 * ⚠ **NO `completedSets` AND NO `actualReps`, DELIBERATELY.** The app writes
 * them only when the athlete logged per-set detail, and the approved contract
 * forbids claiming to know reps merely because a session was marked complete.
 * A fixture that supplied them would let a rule that DOES infer them pass.
 */
function historyFor(
  loads: Record<string, number>,
  dates: readonly string[] = BLOCK_1_DATES,
  overrides: Partial<SessionFeedback> = {},
): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of dates) {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: Object.keys(loads).map((exerciseName, i) => ({
        exerciseId: `ex-${i}`,
        workoutExerciseId: `wex-${i}`,
        exerciseName,
        prescribedSets: 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        weightKg: loads[exerciseName],
        completion: 'full' as const,
      })),
      ...overrides,
    } as SessionFeedback;
  }
  return feedback;
}

function build(
  blockNumber: number,
  todayISO: string,
  sessionFeedback: Record<string, SessionFeedback>,
): TrainingProgram {
  return generateProgramLocally(athlete(), {
    todayISO,
    blockNumber,
    progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
  });
}

function storedLoadOf(program: TrainingProgram, name: string): number | undefined | 'ABSENT_ROW' {
  let found: 'ABSENT_ROW' | number | undefined = 'ABSENT_ROW';
  for (const mc of program.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if ((ex.exercise?.name ?? '') === name) found = ex.prescribedWeightKg;
      }
    }
  }
  return found;
}

function visibleLoadOf(
  program: TrainingProgram,
  name: string,
  feedback: Record<string, SessionFeedback>,
  weekStartISO: string,
): number | undefined | 'ABSENT_ROW' {
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
  let found: 'ABSENT_ROW' | number | undefined = 'ABSENT_ROW';
  for (const day of resolveWeekWithConditioning(weekStartISO, state)) {
    for (const ex of day.workout?.exercises ?? []) {
      if ((ex.exercise?.name ?? '') === name) found = ex.prescribedWeightKg;
    }
  }
  return found;
}

console.log('\n[1] A RETAINED EXERCISE USES ITS OWN HISTORY');

const aHistory = historyFor({ [TRACKED]: TRACKED_RECORDED_KG });
const aBlock2 = build(2, BLOCK_2_START, aHistory);
const aTracked = storedLoadOf(aBlock2, TRACKED);
ok(
  `${TRACKED} is programmed in block 2 at all`,
  aTracked !== 'ABSENT_ROW',
  `got ${JSON.stringify(aTracked)} — the guard below is meaningless without the row`,
);
ok(
  `${TRACKED} seeds from its OWN recorded ${TRACKED_RECORDED_KG}kg and takes the smallest authorised increment (${EXPECTED_PROGRESSED_KG}kg)`,
  aTracked === EXPECTED_PROGRESSED_KG,
  `expected ${EXPECTED_PROGRESSED_KG}, got ${JSON.stringify(aTracked)}`,
);

console.log('\n[2] ATHLETE B — NO QUALIFYING HISTORY, NO HISTORY-DRIVEN PROGRESSION');

const bBlock2 = build(2, BLOCK_2_START, {});
const bTracked = storedLoadOf(bBlock2, TRACKED);
ok(
  `${TRACKED} for athlete B is NOT the progressed number`,
  bTracked !== EXPECTED_PROGRESSED_KG,
  `athlete B received ${JSON.stringify(bTracked)} — A's history leaked`,
);
ok(
  `${TRACKED} for athlete B is the authored anchor estimate or unset, never a recorded load`,
  bTracked === undefined || (typeof bTracked === 'number' && bTracked !== TRACKED_RECORDED_KG),
  `got ${JSON.stringify(bTracked)}`,
);

console.log('\n[3] NO SET/REP COMPLETION IS INFERRED FROM A COMPLETED MARKER');

// Identical history, except every per-set field the app may legitimately hold
// is ABSENT. A rule that inferred reps/sets from `completion: 'full'` would
// produce a different answer here than it does with them present.
const withPerSetDetail = historyFor({ [TRACKED]: TRACKED_RECORDED_KG });
for (const entry of Object.values(withPerSetDetail)) {
  entry.strength = (entry.strength ?? []).map((log) => ({
    ...log,
    completedSets: 3,
    actualReps: 5,
  }));
}
const withDetail = storedLoadOf(build(2, BLOCK_2_START, withPerSetDetail), TRACKED);
ok(
  'the decision is identical whether or not per-set detail was logged',
  withDetail === aTracked,
  `with detail ${JSON.stringify(withDetail)} vs without ${JSON.stringify(aTracked)} — reps/sets are being read`,
);

// And a PARTIAL completion must not count toward the completion gate: the app
// does not know WHICH work was done.
const partialHistory = historyFor({ [TRACKED]: TRACKED_RECORDED_KG }, BLOCK_1_DATES, {
  completion: 'partial',
});
const partialTracked = storedLoadOf(build(2, BLOCK_2_START, partialHistory), TRACKED);
ok(
  'a block of PARTIAL sessions seeds the load but does not buy the increment',
  partialTracked === TRACKED_RECORDED_KG,
  `expected ${TRACKED_RECORDED_KG} (seeded, not raised), got ${JSON.stringify(partialTracked)}`,
);

console.log('\n[4] AN EXERCISE ROTATED OUT AND RETURNING RESUMES FROM ITS OWN HISTORY');

// The load was recorded in block 1 only. Block 3 is authored two blocks later,
// with nothing recorded in between — the "absent for one or more blocks" case.
const staleHistory = historyFor({ [TRACKED]: TRACKED_RECORDED_KG });
const block3 = build(3, BLOCK_3_START, staleHistory);
const returningTracked = storedLoadOf(block3, TRACKED);
ok(
  `${TRACKED} returning after an absent block still resumes from its own ${TRACKED_RECORDED_KG}kg`,
  returningTracked === TRACKED_RECORDED_KG || returningTracked === EXPECTED_PROGRESSED_KG,
  `expected ${TRACKED_RECORDED_KG} or ${EXPECTED_PROGRESSED_KG}, got ${JSON.stringify(returningTracked)} — history was windowed to the previous block`,
);

console.log('\n[5] THE OUTGOING EXERCISE NEVER CONTAMINATES ITS REPLACEMENT');

/**
 * The load is recorded against an exercise that is NOT in block 2, at a number
 * nothing else in the app would produce. Any block-2 row carrying it can only
 * have got it by inheriting across a slot or movement pattern.
 */
const CONTAMINANT_KG = 137.5;
const outgoingOnly = historyFor({ 'Back Squat': CONTAMINANT_KG });
const contaminationBlock2 = build(2, BLOCK_2_START, outgoingOnly);
const carriers: string[] = [];
for (const mc of contaminationBlock2.microcycles) {
  for (const w of mc.workouts) {
    for (const ex of w.exercises ?? []) {
      const name = ex.exercise?.name ?? '';
      if (name !== 'Back Squat' && ex.prescribedWeightKg === CONTAMINANT_KG) carriers.push(name);
    }
  }
}
ok(
  `no block-2 row inherits the outgoing exercise's ${CONTAMINANT_KG}kg`,
  carriers.length === 0,
  `inherited by: ${carriers.join(', ')}`,
);

console.log('\n[6] A GENUINELY UNSEEN EXERCISE USES THE AUTHORED ANCHOR ESTIMATE');

// Pick a block-2 row the athlete has never logged, and which the authored map
// DOES cover, then require the stored load to be exactly what the authored
// estimator produces for this athlete.
let anchorChecked = false;
for (const mc of contaminationBlock2.microcycles) {
  for (const w of mc.workouts) {
    for (const ex of w.exercises ?? []) {
      const name = ex.exercise?.name ?? '';
      if (anchorChecked || name === 'Back Squat') continue;
      const authored = startingWeightForAthlete(name, athlete());
      if (typeof authored !== 'number' || authored <= 0) continue;
      anchorChecked = true;
      ok(
        `unseen "${name}" takes the authored anchor estimate (${authored}kg)`,
        ex.prescribedWeightKg === authored,
        `expected ${authored}, got ${JSON.stringify(ex.prescribedWeightKg)}`,
      );
    }
  }
}
ok(
  'the authored-anchor cell found a covered exercise to assert on (liveness)',
  anchorChecked,
  'no block-2 row had an authored estimate — the cell above asserted nothing',
);

console.log('\n[7] AN UNSEEN, UNMAPPED EXERCISE STAYS BLANK');

let blankChecked = false;
for (const mc of contaminationBlock2.microcycles) {
  for (const w of mc.workouts) {
    for (const ex of w.exercises ?? []) {
      const name = ex.exercise?.name ?? '';
      if (blankChecked || name === 'Back Squat') continue;
      if (startingWeightForAthlete(name, athlete()) !== null) continue;
      // Only progression-eligible rows are this module's business; accessories
      // and trunk work keep their own owners' values.
      if (ex.prescribedWeightKg !== undefined && ex.prescribedWeightKg !== 0) continue;
      blankChecked = true;
      ok(
        `unmapped, unseen "${name}" carries no invented load`,
        ex.prescribedWeightKg === undefined || ex.prescribedWeightKg === 0,
        `got ${JSON.stringify(ex.prescribedWeightKg)}`,
      );
    }
  }
}
ok(
  'the blank cell found an unmapped exercise to assert on (liveness)',
  blankChecked,
  'no unmapped row present — the cell above asserted nothing',
);

console.log('\n[10] SEEDING IS WIDER THAN AUTOMATIC PROGRESSION');

/**
 * Sam, product close: every strength exercise may RESTORE its own recorded load
 * or receive its authored estimate — accessories included — while automatic
 * INCREASES stay limited to main/secondary lifts.
 *
 * The accessory tracked here is a real block-2 row measured in this fixture.
 */
const ACCESSORY = 'Bicep Curl (Barbell)';
const ACCESSORY_RECORDED_KG = 17.5;

const accessoryHistory = historyFor({ [ACCESSORY]: ACCESSORY_RECORDED_KG });
const accessoryStored = storedLoadOf(build(2, BLOCK_2_START, accessoryHistory), ACCESSORY);
ok(
  `${ACCESSORY} is programmed in block 2 (liveness)`,
  accessoryStored !== 'ABSENT_ROW',
  'the accessory cells below would assert nothing',
);
ok(
  `a recorded ${ACCESSORY} load RETURNS (seeding covers accessories)`,
  accessoryStored === ACCESSORY_RECORDED_KG,
  `expected ${ACCESSORY_RECORDED_KG}, got ${JSON.stringify(accessoryStored)} — accessory seeding is missing`,
);
ok(
  `${ACCESSORY} does NOT automatically increase (not a main/secondary lift)`,
  accessoryStored === ACCESSORY_RECORDED_KG,
  `it rose to ${JSON.stringify(accessoryStored)} — accessories may not auto-increase`,
);

const accessoryUnseen = storedLoadOf(build(2, BLOCK_2_START, {}), ACCESSORY);
const accessoryAuthored = startingWeightForAthlete(ACCESSORY, athlete());
ok(
  `an unseen ${ACCESSORY} uses its AUTHORED estimate, not 0`,
  accessoryUnseen !== 0 && accessoryUnseen === accessoryAuthored,
  `authored says ${JSON.stringify(accessoryAuthored)}, stored ${JSON.stringify(accessoryUnseen)}`,
);

const bwAccessory = 'Copenhagen Plank (Half)';
const bwAccessoryAdded = 7.5;
const bwAccStored = storedLoadOf(
  build(2, BLOCK_2_START, historyFor({ [bwAccessory]: bwAccessoryAdded })),
  bwAccessory,
);
ok(
  `${bwAccessory} is programmed in block 2 (liveness)`,
  bwAccStored !== 'ABSENT_ROW',
  'the bodyweight-accessory cell would assert nothing',
);
ok(
  `${bwAccessory} restores the athlete's added +${bwAccessoryAdded}kg`,
  bwAccStored === bwAccessoryAdded,
  `expected ${bwAccessoryAdded}, got ${JSON.stringify(bwAccStored)} — added load on a bodyweight accessory was lost`,
);

console.log('\n[8b] THE INCREMENT COMES FROM THE AUTHORED LATTICE, AND HOLDS WHEN IT CANNOT SAY');

// Unit-level, and it says so: these assert the lattice READ, not the pipeline.
ok(
  'barbell work steps by the lattice 2.5kg',
  smallestPracticalIncrementKg('Deadlift', 100) === 2.5,
  `got ${JSON.stringify(smallestPracticalIncrementKg('Deadlift', 100))}`,
);
ok(
  'an exercise no authored source covers yields NO increment (hold, never guess)',
  smallestPracticalIncrementKg('Totally Unmapped Movement XYZ', 100) === null,
  `got ${JSON.stringify(smallestPracticalIncrementKg('Totally Unmapped Movement XYZ', 100))} — a guessed default`,
);
ok(
  'a bodyweight exercise yields NO automatic increment (the next step is the athlete\'s)',
  smallestPracticalIncrementKg('Pull-Ups', 12.5) === null,
  `got ${JSON.stringify(smallestPracticalIncrementKg('Pull-Ups', 12.5))}`,
);

console.log('\n[9] BODYWEIGHT DEFAULTS TO BW BUT ACCEPTS AND RESTORES ADDED LOAD');

/**
 * Pull-Ups are authored as unloaded. Two worlds, one exercise:
 *   (a) never logged  → BW default, this module writes nothing;
 *   (b) logged with added external load → that recorded load is history and
 *       WINS on return, exactly like any other exercise.
 *
 * (b) is the case an earlier revision of this module got wrong: it
 * short-circuited every authored-bodyweight row BEFORE reading history and
 * would have thrown the athlete's recorded weighted Pull-Up away.
 */
const BW_EXERCISE = 'Pull-Ups';
const BW_ADDED_KG = 12.5;

const bwNeverLogged = storedLoadOf(build(2, BLOCK_2_START, {}), BW_EXERCISE);
ok(
  `${BW_EXERCISE} with no history carries no invented external load`,
  bwNeverLogged === undefined || bwNeverLogged === 0 || bwNeverLogged === 'ABSENT_ROW',
  `got ${JSON.stringify(bwNeverLogged)}`,
);

const bwHistory = historyFor({ [BW_EXERCISE]: BW_ADDED_KG });
const bwWithHistory = storedLoadOf(build(2, BLOCK_2_START, bwHistory), BW_EXERCISE);
// LIVENESS. Without this the two cells below pass whenever the row is simply
// absent from the block — a vacuous green that would hide the exact defect they
// exist to catch.
ok(
  `${BW_EXERCISE} is actually programmed in block 2 (liveness for the cells below)`,
  bwWithHistory !== 'ABSENT_ROW',
  'the bodyweight cells would be asserting nothing',
);
ok(
  `${BW_EXERCISE} with a recorded +${BW_ADDED_KG}kg RESUMES from the athlete's own number`,
  typeof bwWithHistory === 'number' && bwWithHistory >= BW_ADDED_KG,
  `expected >= ${BW_ADDED_KG} (recorded added load is history and must win), got ${JSON.stringify(bwWithHistory)}`,
);
ok(
  `${BW_EXERCISE}'s recorded number is never rounded away`,
  bwWithHistory !== 0 && bwWithHistory !== undefined,
  `the athlete's ${BW_ADDED_KG}kg was discarded — got ${JSON.stringify(bwWithHistory)}`,
);

console.log('\n[11] THE ATHLETE-FACING EXPLANATION IS STORED AND SURVIVES RELOAD');

const explained = build(2, BLOCK_2_START, aHistory);
const explanation = explained.blockBoundaryExplanation ?? [];
ok(
  'the stored program carries a block-boundary explanation',
  explanation.length > 0,
  'no explanation was stored — the typed result has no reader',
);
const deadliftRow = explanation.find((row) => row.exerciseName === TRACKED);
ok(
  `the explanation names ${TRACKED}'s ACTUAL change (${TRACKED_RECORDED_KG} → ${EXPECTED_PROGRESSED_KG})`,
  deadliftRow?.kind === 'history_progressed' &&
    deadliftRow.previousLoadKg === TRACKED_RECORDED_KG &&
    deadliftRow.nextLoadKg === EXPECTED_PROGRESSED_KG,
  `got ${JSON.stringify(deadliftRow)}`,
);
const reloadedExplained = JSON.parse(JSON.stringify(explained)) as TrainingProgram;
ok(
  'the explanation survives a reload byte-for-byte',
  JSON.stringify(reloadedExplained.blockBoundaryExplanation) === JSON.stringify(explanation),
  'the explanation did not round-trip',
);
ok(
  'the explanation agrees with the stored prescription it explains',
  deadliftRow?.nextLoadKg === storedLoadOf(explained, TRACKED),
  `explanation says ${JSON.stringify(deadliftRow?.nextLoadKg)}, prescription says ${JSON.stringify(storedLoadOf(explained, TRACKED))}`,
);

console.log('\n[12] THE ATHLETE-VISIBLE SENTENCE MATCHES THE STORED PRESCRIPTION');

const sentences = blockBoundaryExplanationSentences(explained);
ok(
  'the stored explanation renders at least one athlete-visible sentence',
  sentences.length > 0,
  'the signed sentence has no stored row to render from',
);

// The sentence is compared to Sam's approved wording as a LITERAL. Deriving the
// expected string from the same registry entry the renderer reads would make
// this cell incapable of catching a change to the words.
const EXPECTED_SENTENCE =
  'You completed enough of the last block and reported good recovery, so '
  + `${TRACKED} has moved from ${TRACKED_RECORDED_KG} kg to ${EXPECTED_PROGRESSED_KG} kg. `
  + 'You can change it if needed.';
const deadliftSentence = sentences.find((line) => line.includes(TRACKED));
ok(
  'the sentence is exactly Sam approved wording, with the real exercise and weights',
  deadliftSentence === EXPECTED_SENTENCE,
  `got ${JSON.stringify(deadliftSentence)}`,
);
ok(
  'the weights in the sentence are the STORED prescription, not a re-derivation',
  typeof deadliftSentence === 'string' &&
    deadliftSentence.includes(`to ${storedLoadOf(explained, TRACKED)} kg`),
  `stored prescription is ${JSON.stringify(storedLoadOf(explained, TRACKED))}`,
);
ok(
  'the sentence survives reload unchanged',
  blockBoundaryExplanationSentences(reloadedExplained)[0] === sentences[0],
  'the sentence changed across a reload',
);

// Only a real INCREASE earns the sentence. A held load is not "moved from X to
// Y", and stretching the signed words over it would be authoring meaning.
ok(
  'a held load renders NO moved-sentence',
  blockBoundaryLoadMovedSentence({
    exerciseName: TRACKED, kind: 'history_held',
    previousLoadKg: TRACKED_RECORDED_KG, nextLoadKg: TRACKED_RECORDED_KG,
  }) === null,
  'the signed sentence was stretched over a non-increase',
);
ok(
  'athlete B, with no qualifying history, is told nothing',
  blockBoundaryExplanationSentences(bBlock2).length === 0,
  'a sentence was shown to an athlete whose load did not move',
);

console.log('\n[8] STORED = VISIBLE = RELOADED');

const storedA = storedLoadOf(aBlock2, TRACKED);
const visibleA = visibleLoadOf(aBlock2, TRACKED, aHistory, BLOCK_2_START);
const reloadedA = JSON.parse(JSON.stringify(aBlock2)) as TrainingProgram;
const reloadedStoredA = storedLoadOf(reloadedA, TRACKED);
const reloadedVisibleA = visibleLoadOf(reloadedA, TRACKED, aHistory, BLOCK_2_START);

ok(
  'stored, visible, reloaded-stored and reloaded-visible are one number',
  storedA === visibleA && storedA === reloadedStoredA && storedA === reloadedVisibleA,
  `stored ${JSON.stringify(storedA)} / visible ${JSON.stringify(visibleA)} / reloaded ${JSON.stringify(reloadedStoredA)} / reloaded-visible ${JSON.stringify(reloadedVisibleA)}`,
);

/**
 * THE CONTROL. Four matching numbers are equally produced by "projection obeys
 * storage" and by "both passes happened to agree". Hand projection a history
 * that CONTRADICTS the one generation saw: a projection with authority
 * re-derives and moves; one that displays the stored result cannot.
 */
const contradictory: Record<string, SessionFeedback> = {};
for (const [dateStr, entry] of Object.entries(aHistory)) {
  contradictory[dateStr] = {
    ...entry,
    feeling: 'very_hard',
    soreness: 'high',
    strength: (entry.strength ?? []).map((log) => ({ ...log, weightKg: 60 })),
  } as SessionFeedback;
}
ok(
  'projection does not move when handed a contradictory history (control)',
  visibleLoadOf(aBlock2, TRACKED, contradictory, BLOCK_2_START) === storedA,
  'the screen still recalculates — projection has authority it should not have',
);

console.log(`\nBlock two progression: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
