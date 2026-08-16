/**
 * PROBE — is the load the athlete SEES the load that was STORED?
 *
 * Sam, 2026-08-16: *"Remove the screen's authority to recalculate a different
 * prescription; projection displays the stored result. Stored, visible and
 * reloaded prescriptions must be identical."*
 *
 * Diagnostic, not a guard. It generates Block 2 for an athlete with history,
 * puts it through the store, projects the week the way the screen does, and
 * round-trips the store through JSON to stand in for a relaunch.
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
  throw new Error('NETWORK DISABLED');
};

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { fullKitEquipmentAnswer } from '../src/__tests__/support/equipmentAnswerFixture';
import { resolveWeekWithConditioning, type ScheduleState } from '../src/utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../src/utils/sessionBuilder';
import type { SessionFeedback } from '../src/store/programStore';
import type { OnboardingData, TrainingProgram } from '../src/types/domain';

const BLOCK_2_START = '2026-08-03';
const TRACKED = 'Deadlift';
const RECORDED_LOADS: Record<string, number> = { Deadlift: 100, 'Goblet Squat': 40 };

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
  } as unknown as OnboardingData;
}

function history(): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of [
    '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
    '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
  ]) {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: Object.keys(RECORDED_LOADS).map((exerciseName, i) => ({
        exerciseId: `ex-${i}`,
        workoutExerciseId: `wex-${i}`,
        exerciseName,
        prescribedSets: 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        weightKg: RECORDED_LOADS[exerciseName],
        completion: 'full' as const,
      })),
    } as SessionFeedback;
  }
  return feedback;
}

function storedLoad(program: TrainingProgram): unknown {
  for (const mc of program.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if ((ex.exercise?.name ?? '') === TRACKED) return ex.prescribedWeightKg;
      }
    }
  }
  return 'NOT FOUND';
}

function visibleLoad(program: TrainingProgram, feedback: Record<string, SessionFeedback>): unknown {
  const state = {
    currentProgram: program,
    currentMicrocycle: program.microcycles[0],
    seasonPhase: 'Pre-season',
    manualOverrides: {},
    markedDays: {},
    athleteContext: {
      ...DEFAULT_ATHLETE_CONTEXT,
      injuries: [],
      onboardingData: athlete(),
    },
    sessionFeedback: feedback,
    weightOverrides: {},
    workoutHistory: [],
    blockState: null,
    availableDayNumbers: [1, 3, 5],
  } as unknown as ScheduleState;
  const days = resolveWeekWithConditioning(BLOCK_2_START, state);
  for (const day of days) {
    for (const ex of day.workout?.exercises ?? []) {
      if ((ex.exercise?.name ?? '') === TRACKED) return ex.prescribedWeightKg;
    }
  }
  return 'NOT VISIBLE';
}

const feedback = history();
const program = generateProgramLocally(athlete(), {
  todayISO: BLOCK_2_START,
  blockNumber: 2,
  progressionHistory: { sessionFeedback: feedback, weightOverrides: {}, blockState: null },
});

const stored = storedLoad(program);
const visible = visibleLoad(program, feedback);
// Relaunch stand-in: the program as it comes back off disk.
const reloaded = JSON.parse(JSON.stringify(program)) as TrainingProgram;
const reloadedStored = storedLoad(reloaded);
const reloadedVisible = visibleLoad(reloaded, feedback);

console.log('\n===== STORED vs VISIBLE vs RELOADED =====');
console.log(`  tracked lift      : ${TRACKED} (last recorded ${RECORDED_LOADS[TRACKED]}kg)`);
console.log(`  STORED            : ${JSON.stringify(stored)}`);
console.log(`  VISIBLE           : ${JSON.stringify(visible)}`);
console.log(`  RELOADED stored   : ${JSON.stringify(reloadedStored)}`);
console.log(`  RELOADED visible  : ${JSON.stringify(reloadedVisible)}`);
const identical =
  JSON.stringify(stored) === JSON.stringify(visible) &&
  JSON.stringify(stored) === JSON.stringify(reloadedStored) &&
  JSON.stringify(stored) === JSON.stringify(reloadedVisible);
console.log(`  ALL FOUR IDENTICAL: ${identical}`);

/**
 * THE CONTROL — four identical numbers prove nothing on their own.
 *
 * If projection still had authority it would RE-DERIVE from whatever history it
 * was handed. So hand it a DIFFERENT history than generation saw. A projection
 * that merely displays the stored result cannot move; one that recomputes will.
 * Without this, "stored == visible" is equally produced by "projection obeys"
 * and by "both passes happened to agree".
 */
const contradictoryHistory: Record<string, SessionFeedback> = {};
for (const [dateStr, entry] of Object.entries(feedback)) {
  contradictoryHistory[dateStr] = {
    ...entry,
    feeling: 'very_hard',
    soreness: 'high',
    strength: (entry.strength ?? []).map((log) => ({ ...log, weightKg: 60 })),
  } as SessionFeedback;
}
const visibleUnderContradiction = visibleLoad(program, contradictoryHistory);
console.log('\n===== CONTROL: projection handed a CONTRADICTORY history =====');
console.log(`  history now says 60kg, very_hard, high soreness`);
console.log(`  VISIBLE            : ${JSON.stringify(visibleUnderContradiction)}`);
console.log(
  `  projection OBEYS storage: ${JSON.stringify(visibleUnderContradiction) === JSON.stringify(stored)}` +
    `  (false here would mean the screen still recalculates)`,
);
