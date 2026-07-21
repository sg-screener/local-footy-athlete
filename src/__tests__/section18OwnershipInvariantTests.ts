/**
 * §18 / program-mutation OWNERSHIP INVARIANTS.
 *
 * These encode the seven Q7 invariants from
 * docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md. They describe the
 * CORRECT post-redesign behaviour, so they are expected to FAIL on the current
 * (pre-migration) architecture — that failure is what proves each test pins the
 * bug it targets. The staged source-of-truth migration turns them green.
 *
 * Ground truth (seed `standard-in-season-week`, anchor Mon 2026-07-13):
 *   MON  Lower Body Strength — ex-squat, ex-custom-deadlift, ex-custom-pallof-press
 *   TUE  Team Training + Upper Pull        WED  Rest
 *   THU  Team Training + Upper Push         FRI  Gunshow (optional)   SAT Game
 *
 * Run: npm run test:section18-ownership
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
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore, canonicaliseAcceptedStateCandidate } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { executeProgramControlAction } from '../utils/programControlActions';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import { applyPlanChange, previewPlanChangeRisk } from '../utils/planChangeProducer';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { addDaysISO } from '../utils/programBlockState';

const WEEK = '2026-07-13';
const TUESDAY = '2026-07-14';
const SATURDAY = '2026-07-18';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]') ||
      first.includes('[Coach')) return;
  originalWarn(...args);
};

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passes += 1;
    console.log(`  PASS [invariant] ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    teamTrainingIntensity: 'Hard',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    ...overrides,
  } as OnboardingData;
}

/** Seed the deterministic `standard-in-season-week` into the live stores. */
function seed(): TrainingProgram {
  const athlete = profile();
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: WEEK,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'In-season',
      phaseEntryWeekStartISO: WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  const marks: Record<string, CalendarDayType> = { [SATURDAY]: 'game' };
  useCalendarStore.setState({ markedDays: marks, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: marks,
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'section18-ownership-test:seed',
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  return program;
}

/** Authored / accepted read model — reflects what the store owns. */
function acceptedByDay(weekStart = WEEK): Map<number, Workout> {
  const state = useProgramStore.getState();
  const week = rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return new Map(week.visibleWorkouts.map((workout) => [workout.dayOfWeek, workout]));
}

/** Visible / projected read model — what the athlete taps on. */
function visibleWeek(weekStart = WEEK) {
  return resolveWeekWithConditioning(weekStart, buildScheduleStateImperative());
}

function dateForDay(weekStart: string, day: number): string {
  return addDaysISO(weekStart, day === 0 ? 6 : day - 1);
}

/** Stable exercise prescription cell, keyed by exerciseId (row `.name` is null). */
function exerciseCell(row: WorkoutExercise): string {
  return JSON.stringify({
    exerciseId: row.exerciseId,
    sets: row.prescribedSets,
    repsMin: row.prescribedRepsMin,
    repsMax: row.prescribedRepsMax,
    weight: row.prescribedWeightKg,
  });
}

function exerciseCells(workout: Workout | undefined | null): string[] {
  return (workout?.exercises ?? []).map(exerciseCell);
}

function exerciseIds(workout: Workout | undefined | null): string[] {
  return (workout?.exercises ?? []).map((row) => row.exerciseId ?? '?');
}

/** Whole-week authored signature: dayOfWeek → sorted exercise cells. */
function weekSignature(byDay: Map<number, Workout>): Map<number, string> {
  const signature = new Map<number, string>();
  for (let day = 0; day <= 6; day += 1) {
    signature.set(day, JSON.stringify([...exerciseCells(byDay.get(day))].sort()));
  }
  return signature;
}

/** Days whose authored exercise signature differs between two weeks. */
function changedDays(before: Map<number, Workout>, after: Map<number, Workout>): number[] {
  const sigBefore = weekSignature(before);
  const sigAfter = weekSignature(after);
  const days: number[] = [];
  for (let day = 0; day <= 6; day += 1) {
    if (sigBefore.get(day) !== sigAfter.get(day)) days.push(day);
  }
  return days;
}

function findRow(workout: Workout | undefined | null, needle: RegExp): WorkoutExercise | undefined {
  return (workout?.exercises ?? []).find((row) => needle.test(row.exerciseId ?? ''));
}

/** Apply the exact Back Squat → Step Ups exercise swap through the tap door. */
function tapSwapSquatToStepUps(): void {
  executeProgramControlAction({
    type: 'swap_exercise',
    source: { screen: 'test', surface: 'workout', initiatedBy: 'test' },
    scope: 'today_only',
    payload: {
      date: WEEK,
      fromExercise: 'Back Squat',
      toExercise: { name: 'Step Ups', sets: 3, repsMin: 3, repsMax: 4 },
    },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  } as never, { visibleWeek: visibleWeek(), todayISO: WEEK });
}

console.log('\n-- §18 ownership invariants (expected RED pre-migration) --');

// Invariant 1 — bounded diff: a single-target exercise swap changes only that row.
run('1 bounded-diff: exercise swap touches only the swapped row', () => {
  seed();
  const before = acceptedByDay();
  const deadliftBefore = findRow(before.get(1), /deadlift/i);
  assert(deadliftBefore, 'precondition: MON has a deadlift row');
  tapSwapSquatToStepUps();
  const after = acceptedByDay();
  const changed = changedDays(before, after);
  assert(changed.length === 1 && changed[0] === 1,
    `swap changed days ${JSON.stringify(changed.map((d) => DAY_NAMES[d]))}; expected only Monday`);
  // Within Monday, only the squat row may differ — deadlift & pallof untouched.
  const untouchedBefore = exerciseCells(before.get(1)).filter((cell) => !/ex-squat/.test(cell)).sort();
  const untouchedAfter = exerciseCells(after.get(1))
    .filter((cell) => !/step-ups|stepups|ex-coach-step/i.test(cell)).sort();
  assert(JSON.stringify(untouchedBefore) === JSON.stringify(untouchedAfter),
    `non-swapped Monday rows changed:\n  before=${JSON.stringify(untouchedBefore)}\n  after =${JSON.stringify(untouchedAfter)}`);
});

// Invariant 2 — untouched load: a swapped-away exercise leaves other loads byte-identical.
run('2 untouched-load: Deadlift load is byte-identical after an unrelated swap', () => {
  seed();
  const deadliftBefore = findRow(acceptedByDay().get(1), /deadlift/i);
  assert(deadliftBefore, 'precondition: MON has a deadlift row');
  const weightBefore = deadliftBefore.prescribedWeightKg;
  tapSwapSquatToStepUps();
  const deadliftAfter = findRow(acceptedByDay().get(1), /deadlift/i);
  assert(deadliftAfter, 'deadlift vanished after the swap');
  assert(deadliftAfter.prescribedWeightKg === weightBefore,
    `Deadlift load drifted ${weightBefore} -> ${deadliftAfter.prescribedWeightKg} during a Back Squat swap`);
});

// Invariant 3 — local legality: a menu-legal Swap is not rejected for an off-target condition.
run('3 local-legality: MON swap→Conditioning is not §18-rejected for the rest of the week', () => {
  seed();
  const change = { kind: 'swap_category' as const, date: WEEK, category: 'conditioning_light' as const };
  const week = visibleWeek();
  const preview = previewPlanChangeRisk({
    change, visibleWeek: week, todayISO: WEEK,
    profile: useProfileStore.getState().onboardingData ?? undefined,
  });
  const result = applyPlanChange({
    change, visibleWeek: week, todayISO: WEEK, trace: preview.trace,
    setManualOverride: (date, workout, ctx) => useProgramStore.getState().setManualOverride(date, workout, ctx),
  });
  assert(result.ok, `legal Swap→Conditioning refused: "${result.message}"`);
  // If ever rejected, the rejection may only cite the requested day.
  for (const entry of result.rejected) {
    assert(entry.date === WEEK,
      `rejection cited an off-target day ${entry.date} (${entry.code})`);
  }
});

// Invariant 4 — disclosed repair: every day a Bin changes is named in the confirmation.
run('4 disclosed-repair: binning TUE strength names every day it changes', () => {
  seed();
  const before = acceptedByDay();
  const change = { kind: 'remove_session' as const, date: TUESDAY, scope: 'strength' as const };
  const week = visibleWeek();
  const preview = previewPlanChangeRisk({
    change, visibleWeek: week, todayISO: WEEK,
    profile: useProfileStore.getState().onboardingData ?? undefined,
  });
  const result = applyPlanChange({
    change, visibleWeek: week, todayISO: WEEK, trace: preview.trace,
    setManualOverride: (date, workout, ctx) => useProgramStore.getState().setManualOverride(date, workout, ctx),
  });
  assert(result.ok, `bin refused: "${result.message}"`);
  const after = acceptedByDay();
  const changed = changedDays(before, after).filter((day) => day !== 2); // exclude the target (Tue)
  const undisclosed = changed.filter((day) => !result.message.includes(DAY_NAMES[day]));
  assert(undisclosed.length === 0,
    `days changed but not disclosed in "${result.message}": ` +
    `${JSON.stringify(undisclosed.map((d) => DAY_NAMES[d]))}`);
});

// Invariant 5 — cross-door equivalence + no false "Done".
run('5 cross-door: tap and coach produce the same swap, with no false "Done"', () => {
  seed();
  tapSwapSquatToStepUps();
  const tapMon = exerciseIds(acceptedByDay().get(1)).sort();

  seed();
  const coach = executeCoachCommand({
    command: {
      mode: 'mutate',
      operation: 'replace_exercise',
      target: { kind: 'date', date: WEEK },
      payload: { operation: 'replace_exercise', fromExercise: 'Back Squat', toExercise: 'Step Ups' },
      scope: 'one_off',
      confidence: 1,
      needsClarification: false,
      reason: 'athlete_requested_exercise_swap',
    } as never,
    todayISO: WEEK,
    referenceResolution: null,
    userMessage: 'swap back squat for step ups',
  });
  const coachApplied = (coach as { kind?: string }).kind === 'mutated' &&
    (coach as { applied?: boolean }).applied === true;
  const coachMon = exerciseIds(acceptedByDay().get(1)).sort();
  const squatSurvived = coachMon.some((id) => /ex-squat/.test(id));
  // No false "Done": if the coach claimed it applied, the squat must be gone.
  assert(!(coachApplied && squatSurvived),
    `coach claimed applied="${coachApplied}" but Back Squat survived (${JSON.stringify(coachMon)})`);
  // Same logical change, same visible result across doors.
  assert(JSON.stringify(tapMon) === JSON.stringify(coachMon),
    `tap and coach diverged:\n  tap  =${JSON.stringify(tapMon)}\n  coach=${JSON.stringify(coachMon)}`);
});

// Invariant 6 — pure projection: reading the week must not recompute loads.
run('6 pure-projection: visible loads equal authored loads with no mutation', () => {
  seed();
  const authored = acceptedByDay().get(1);
  const visibleMon = visibleWeek().find((day) => day.date === WEEK)?.workout;
  assert(authored && visibleMon, 'precondition: Monday resolves in both read models');
  const authoredCells = JSON.stringify(exerciseCells(authored).sort());
  const visibleCells = JSON.stringify(exerciseCells(visibleMon).sort());
  assert(authoredCells === visibleCells,
    `resolution recomputed Monday loads:\n  authored=${authoredCells}\n  visible =${visibleCells}`);
});

// Invariant 7 — bounded result survives a reload (relaunch-equivalent hydration).
run('7 persistence: the bounded swap result survives reload without drift', () => {
  seed();
  const athlete = useProfileStore.getState().onboardingData!;
  const deadliftWeight = findRow(acceptedByDay().get(1), /deadlift/i)?.prescribedWeightKg;
  assert(deadliftWeight !== undefined, 'precondition: MON deadlift has a load');
  tapSwapSquatToStepUps();
  const persisted = JSON.parse(JSON.stringify(useProgramStore.getState()));
  const hydrated = canonicaliseAcceptedStateCandidate(persisted, {
    profile: athlete,
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  const deadliftAfterReload = findRow(acceptedByDay().get(1), /deadlift/i)?.prescribedWeightKg;
  assert(deadliftAfterReload === deadliftWeight,
    `untouched Deadlift load ${deadliftWeight} -> ${deadliftAfterReload} across a swap + reload`);
});

console.log(`\n§18 ownership invariants: ${passes} passing, ${failures.length} failing`);
if (failures.length > 0) {
  console.log('Currently RED (expected pre-migration):');
  for (const name of failures) console.log(`  - ${name}`);
}
process.exit(failures.length > 0 ? 1 : 0);
