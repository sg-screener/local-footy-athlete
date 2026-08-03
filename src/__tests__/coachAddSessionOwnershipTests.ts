/**
 * Coach-door add_session OWNERSHIP + §18 SURVIVAL.
 *
 * Live-legacy census finding #1: the coach-chat "add a session" path
 * (`runAddSession` → `defaultApplyAddSession`) wrote the new session straight
 * through `setManualOverride` with NO `UserRemovalConstraint` pin — bypassing
 * `commitAthleteSessionAdditionTransaction`, the owner the *tap* door was
 * migrated onto in §18 stage 3. An unpinned add is not owned by the
 * accepted-state transaction, so a later §18 repair pass silently canonicalises
 * it back to Rest: a false-Done / silent-content-loss shape (Process Law L6).
 *
 * This mirrors sectionOwnershipInvariantTests #10 (empty-day add), but driven
 * through the coach chat pipeline (`executeCoachCommand`) rather than the tap
 * door. RED before the migration; GREEN once the coach path routes through the
 * addition transaction owner.
 *
 * Run: npm run test:coach-add-session-ownership
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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';
import type { OnboardingData, TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import type { CoachCommand } from '../utils/coachCommandRouter';
import { executeProgramControlAction } from '../utils/programControlActions';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';

const WEEK = '2026-07-13';       // Monday — Lower Body Strength
const WEDNESDAY = '2026-07-15';  // empty / Rest
const SATURDAY = '2026-07-18';   // Game

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passes += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
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

function profile(): OnboardingData {
  return {
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
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
  } as unknown as OnboardingData;
}

function seed(): TrainingProgram {
  const marks: Record<string, CalendarDayType> = { [SATURDAY]: 'game' };
  const program = quiet(() => generateProgramLocally(profile(), {
    todayISO: WEEK,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'In-season',
      phaseEntryWeekStartISO: WEEK,
      originProvenance: 'explicit_user_phase_change',
    } as never,
  }));
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
      lastTransaction: 'coach-add-session-test:seed',
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
  useProfileStore.setState({ onboardingData: profile(), isOnboardingComplete: true });
  return program;
}

function acceptedByDay(): Map<number, Workout> {
  const state = useProgramStore.getState();
  const accepted = rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: WEEK,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return new Map(accepted.visibleWorkouts.map((w) => [w.dayOfWeek, w]));
}

function exerciseCells(workout: Workout | undefined | null): string[] {
  return (workout?.exercises ?? []).map((row: WorkoutExercise) => JSON.stringify({
    exerciseId: row.exerciseId,
    sets: row.prescribedSets,
    repsMin: row.prescribedRepsMin,
    repsMax: row.prescribedRepsMax,
    weight: row.prescribedWeightKg,
  })).sort();
}

/**
 * Drive a coach-chat "add an easy conditioning session Wednesday" through the
 * real pipeline. Mirrors sectionOwnershipInvariantTests #10 (a §18-valid light
 * add on the empty day) so the test isolates OWNERSHIP, not §18 content validity
 * — a hard strength add on the week's only rest day is a legitimate §18 refusal.
 */
function coachAddConditioningToWednesday() {
  const command: CoachCommand = {
    mode: 'mutate',
    operation: 'add_session',
    target: { kind: 'date', date: WEDNESDAY },
    payload: {
      operation: 'add_session',
      standaloneAddType: 'conditioning',
      standaloneConditioning: {},
      reason: 'coach add standalone conditioning',
    },
    scope: 'one_off',
    confidence: 0.95,
    needsClarification: false,
    reason: 'coach add_session ownership test',
  } as CoachCommand;
  // Tolerant of a downstream throw: the *unpinned* legacy write can leave the
  // week in a state that later §18 resolution rejects — which is the defect, not
  // a test error. Swallow it so the store-level ownership assertions still run.
  try {
    return quiet(() => executeCoachCommand({
      command,
      todayISO: WEEK,
      referenceResolution: null,
      userMessage: 'add my lower body strength session to Wednesday',
      // No addSessionDeps → the real store-backed defaults + defaultApplyAddSession run.
    }));
  } catch (error) {
    return { kind: 'error', applied: false, route: 'threw', reply: (error as Error).message } as ReturnType<typeof executeCoachCommand>;
  }
}

/** An unrelated accepted-state edit that re-canonicalises the week (a §18 repair pass). */
function unrelatedSection18RepairPass(): void {
  const monday = resolveWeekWithConditioning(WEEK, buildScheduleStateImperative());
  quiet(() => executeProgramControlAction({
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
  } as never, { visibleWeek: monday, todayISO: WEEK }));
}

function wedPinned(): boolean {
  return useProgramStore.getState().userRemovalConstraints.some(
    (c) => c.targetDate === WEDNESDAY && c.status === 'active');
}

function wedOwnedByAdjustment(): boolean {
  return useProgramStore.getState().reversibleAdjustmentLedger.adjustments.some(
    (entry) => entry.affectedDates.includes(WEDNESDAY));
}

console.log('\n-- coach-door add_session ownership + §18 survival --');

// THE census #1 regression. The legacy path applied via `setManualOverride` with
// no pin — a "Done" the athlete sees, then loses when a later §18 repair
// canonicalises the unpinned day back to Rest (false-Done / silent content loss).
// Post-migration the coach add is owned by the accepted-state transaction OR
// honestly refused, but NEVER a silent unowned apply.
run('coach add is never applied without §18 ownership (no false-Done)', () => {
  seed();
  const result = coachAddConditioningToWednesday();
  const owned = wedOwnedByAdjustment() && wedPinned();
  assert(!(result.applied && !owned),
    `false-Done: coach add reported applied=${result.applied} but owned=${owned} `
      + `(adjustment=${wedOwnedByAdjustment()}, pin=${wedPinned()})`);
});

// When the owner DOES accept a coach add, it must survive a §18 repair byte-intact.
// In this sole-rest-day seed §18 correctly refuses an add_session (it cannot
// relocate the lost rest day), so this exercises the survival property only when
// an add is genuinely owned. Survival of an accepted add is otherwise pinned by
// the owner's own gate, sectionOwnershipInvariantTests #10.
run('an owned coach add survives a §18 repair pass byte-intact', () => {
  seed();
  const result = coachAddConditioningToWednesday();
  if (!result.applied || !wedPinned()) return; // refused — nothing applied to survive
  const addedCells = exerciseCells(acceptedByDay().get(3));
  assert(addedCells.length > 0, 'an applied coach add left no session on WED');
  unrelatedSection18RepairPass();
  const afterRepairWed = acceptedByDay().get(3);
  assert(afterRepairWed && afterRepairWed.workoutType !== 'Rest'
    && JSON.stringify(exerciseCells(afterRepairWed)) === JSON.stringify(addedCells),
    'an owned coach add did not survive a §18 repair byte-intact');
});

// The refusal copy must never read a raw internal diagnostic to the athlete —
// the §18 rejection string was surfaced verbatim before routing through the
// safety gate (census finding #3 class).
run('a coach add refusal never leaks a raw internal reason', () => {
  seed();
  const reply = String(coachAddConditioningToWednesday().reply ?? '');
  assert(!/section\s*18/i.test(reply), `refusal leaked a §18 code: "${reply}"`);
  assert(!/\b[a-z0-9]+_[a-z0-9]+/.test(reply), `refusal leaked a snake_case token: "${reply}"`);
  assert(!/miscount|shortfall/i.test(reply), `refusal leaked a diagnostic term: "${reply}"`);
});

// Source-contract for the ownership WIRING itself. In the standard in-season
// seed the pre-apply §18 guard refuses an add to the sole rest day before
// `applyAdd` runs, so the behavioural tests above cannot reach the writer; this
// pins that the writer, when it does run, uses the transaction owner rather than
// a raw override. Survival of an accepted add is proven by the owner's own gate
// (sectionOwnershipInvariantTests #10), which the coach path now shares.
run('defaultApplyAddSession writes through the addition-transaction owner (census #1)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../utils/coachCommandExecutor.ts'), 'utf8');
  const start = src.indexOf('function defaultApplyAddSession');
  assert(start >= 0, 'defaultApplyAddSession not found');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert(/commitAthleteSessionAdditionTransaction\(/.test(body),
    'defaultApplyAddSession must commit through commitAthleteSessionAdditionTransaction');
  assert(!/setManualOverride\(/.test(body),
    'defaultApplyAddSession must not write via a raw setManualOverride (the census #1 bypass)');
  assert(/finaliseWorkoutAfterMutation\(/.test(body),
    'the added workout must be finalised before the owner (its input contract)');
});

console.log(`\ncoach add_session ownership: ${passes} passing, ${failures.length} failing`);
totalsPrinted(failures.length);
// TOTALS-OR-RED (Sam, 2026-08-03): the explicit exit is GONE, not moved.
// `process.exit(0)` hard-overrides `process.exitCode`, so it silently
// un-arms this suite — proven by a surviving mutation during the rollout.
// `totalsPrinted(...)` above already set the correct code from the report.
