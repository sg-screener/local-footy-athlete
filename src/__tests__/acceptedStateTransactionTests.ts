/**
 * Accepted-state transaction ownership — Section 18 systemic regressions.
 *
 * This suite deliberately drives the production stores/coordinators. It keeps
 * the 25 requested fixed regressions separate from broader properties and
 * source-boundary mutation witnesses so the completion total cannot drift.
 *
 * Run: npm run test:accepted-state-transactions
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
  throw new Error('NETWORK DISABLED — accepted-state transactions must be local');
};
process.env.TZ = 'Australia/Melbourne';

import { readFileSync } from 'fs';
import path from 'path';
import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  canonicaliseHydratedProgram,
  canonicaliseHydratedState,
  Section18LegacyMigrationError,
  useProgramStore,
} from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { buildReadinessSignalPatch, type ReadinessSignal } from '../utils/readiness';
import { buildReadinessActiveConstraints } from '../utils/readinessConstraints';
import {
  assertAcceptedVisibleLedgerEquivalence,
  commitAcceptedStateTransaction,
  getAcceptedMaterialContext,
} from '../store/acceptedStateTransaction';
import {
  resolveFinalVisibleSection18Week,
} from '../rules/section18AcceptedWeekGateway';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import {
  buildWeekScopedWorkoutOverlay,
  rebuildLocalWeek,
} from '../utils/weekRebuild';
import { repeatWeekIntoNextWeek } from '../utils/repeatWeek';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import { addDaysISO } from '../utils/programBlockState';

const WEEK_START = '2026-07-13';
const WEDNESDAY = '2026-07-15';
const SATURDAY = '2026-07-18';
const SUNDAY = '2026-07-19';
const NEXT_WEEK = '2026-07-20';
const NOW = '2026-07-13T00:00:00.000Z';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]')) return;
  originalWarn(...args);
};

let regressionPass = 0;
let propertyPass = 0;
let mutationPass = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(kind: 'regression' | 'property' | 'mutation', name: string, body: () => void): void {
  try {
    body();
    if (kind === 'regression') regressionPass += 1;
    else if (kind === 'property') propertyPass += 1;
    else mutationPass += 1;
    console.log(`  PASS [${kind}] ${name}`);
  } catch (error) {
    failures.push(`${kind}: ${name}`);
    console.error(`  FAIL [${kind}] ${name}`, error);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function profile(
  phase: NonNullable<OnboardingData['seasonPhase']>,
  overrides: Partial<OnboardingData> = {},
): OnboardingData {
  return {
    seasonPhase: phase,
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: 'Hard',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    ...overrides,
  };
}

function generate(value: OnboardingData, start = WEEK_START): TrainingProgram {
  return quiet(() => generateProgramLocally(value, {
    todayISO: start,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: value.seasonPhase!,
      phaseEntryWeekStartISO: start,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
}

function emptyAcceptedContext() {
  return {
    markedDays: {},
    readinessSignalsByDate: {},
    activeConstraints: [],
    activeInjury: null,
    revision: 0,
    lastTransaction: null,
  };
}

function resetStores(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: emptyAcceptedContext(),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({ acceptedMaterialContext: emptyAcceptedContext() });
}

function seed(value: OnboardingData, start = WEEK_START): TrainingProgram {
  resetStores();
  useProfileStore.setState({ onboardingData: value });
  const program = generate(value, start);
  useProgramStore.getState().setCurrentProgram(program);
  return useProgramStore.getState().currentProgram!;
}

function mondayFor(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function dateForDay(weekStart: string, dayOfWeek: number): string {
  return addDaysISO(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
}

function acceptedWeek(weekStart: string) {
  const state = useProgramStore.getState();
  const overlay = state.weekScopedOverlays[weekStart];
  const microcycle = state.currentProgram?.microcycles.find((candidate) =>
    weekStart >= candidate.startDate.slice(0, 10) &&
    weekStart <= candidate.endDate.slice(0, 10)) ?? null;
  const contract = overlay?.exposureContractV2 ?? microcycle?.exposureContractV2;
  assert(contract, `missing Contract v2 for ${weekStart}`);
  const workouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(weekStart, offset);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const manual = state.dateOverrides[date];
    const hasOverlay = !!overlay && Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date);
    const workout = manual ?? (
      hasOverlay
        ? overlay!.workoutsByDate[date]
        : microcycle?.workouts.find((candidate) => candidate.dayOfWeek === dayOfWeek) ?? null
    );
    if (workout) workouts.push(workout);
  }
  const visible = resolveFinalVisibleSection18Week({
    contract,
    workouts,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    scheduleState: { markedDays: getAcceptedMaterialContext().markedDays },
  });
  return {
    contract,
    visible,
    evaluation: evaluateSection18EffectiveWeek({ contract, workouts: visible, weekStart }),
  };
}

function materialSignature(): string {
  const state = useProgramStore.getState();
  return JSON.stringify({
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    blockState: state.blockState,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
    exposureContractsByWeek: state.exposureContractsByWeek,
    acceptedMaterialContext: state.acceptedMaterialContext,
    calendar: useCalendarStore.getState().markedDays,
    readiness: useReadinessStore.getState().signalsByDate,
    constraints: useCoachUpdatesStore.getState().activeConstraints,
  });
}

function ledgerSignature(contract: ReturnType<typeof acceptedWeek>['contract']): string {
  return JSON.stringify({
    strength: contract.mainStrength.exposure.achievedCount,
    patterns: contract.strengthPatterns.achievedMeaningfulMainLifts,
    conditioning: contract.conditioning.core.achievedCount,
    optionalFlush: contract.conditioning.optionalFlush.achievedCount,
    optionalRecovery: contract.conditioning.optionalRecoveryAerobic.achievedCount,
    stress: contract.conditioning.achievedByStress,
    anchorCredit: contract.conditioning.anchorCredit,
    appCredit: contract.conditioning.appAuthoredCoreCredit,
    sprint: contract.sprintHighSpeed.exposure.achievedCount,
    sprintSources: contract.sprintHighSpeed.achievedSources,
    power: contract.power.achievedPrimerCount,
    rest: contract.restStress.achievedTrueFullRestCount,
    recovery: contract.restStress.achievedActiveRecoveryCount,
    moderate: contract.restStress.achievedModerateDayCount,
    hard: contract.restStress.achievedHardDayCount,
  });
}

function withGatewayFailure(body: () => void): boolean {
  // Every accepted path reaches this dynamically-loaded final gateway.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gateway = require('../rules/section18AcceptedWeekGateway') as Record<string, unknown>;
  const original = gateway.requireSection18AcceptedWeek;
  gateway.requireSection18AcceptedWeek = () => {
    throw new Error('INJECTED_ACCEPTANCE_FAILURE');
  };
  try {
    body();
    return false;
  } catch (error) {
    return String(error).includes('INJECTED_ACCEPTANCE_FAILURE');
  } finally {
    gateway.requireSection18AcceptedWeek = original;
  }
}

function stripContracts(program: TrainingProgram): TrainingProgram {
  return {
    ...clone(program),
    microcycles: program.microcycles.map((microcycle) => ({
      ...clone(microcycle),
      exposureContract: undefined,
      exposureContractV2: undefined,
    })),
  };
}

function migrated(value: OnboardingData): TrainingProgram {
  return canonicaliseHydratedProgram(stripContracts(generate(value)), value);
}

function placeholderOverlay(weekStart: string): WeekScopedWorkoutOverlay {
  return {
    id: `future-placeholder:${weekStart}`,
    weekStart,
    weekEnd: addDaysISO(weekStart, 6),
    anchorDate: null,
    reason: 'one_off_no_game',
    workoutsByDate: {},
    createdAt: NOW,
    updatedAt: NOW,
  };
}

console.log('\n-- Required fixed regressions (25) --');

run('regression', '1 adding a game mark regenerates and gates the target game week', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  useCalendarStore.getState().setGameDay(WEDNESDAY);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().markedDays[WEDNESDAY] === 'game', 'accepted mark missing');
  assert(week.contract.identity.mode === 'in_season_game_week', 'game table was not selected');
  assert(week.contract.anchors.some((anchor) => anchor.kind === 'game' && anchor.dayOfWeek === 3),
    'Wednesday game anchor missing');
  assert(week.evaluation.blockingViolations.length === 0, 'game week has blockers');
});

run('regression', '2 removing a game mark removes credit and resolves bye policy', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  useCalendarStore.getState().setGameDay(WEDNESDAY);
  useCalendarStore.getState().removeGameDay(WEDNESDAY);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().markedDays[SATURDAY] === 'noGame', 'recurring game was not suppressed');
  assert(week.contract.identity.mode.startsWith('in_season_bye'), 'bye table was not selected');
  assert(!week.contract.anchors.some((anchor) => anchor.kind === 'game'), 'stale game credit survived');
  assert(week.evaluation.ledger.conditioning.anchorCoreCount === 0, 'removed game still has conditioning credit');
});

run('regression', '3 adding a rest mark cannot silently remove required core work', () => {
  seed(profile('Pre-season'));
  const before = acceptedWeek(WEEK_START);
  const core = before.visible.find((workout) => {
    const role = workout.section18Evidence?.conditioningRole ?? workout.section18ConditioningRole;
    return role === 'core' || role === 'required_core' || role === 'planner_selected_core';
  });
  assert(core, 'no core session available for rest mutation');
  const date = dateForDay(WEEK_START, core.dayOfWeek);
  const prior = materialSignature();
  let rejected = false;
  try {
    useCalendarStore.getState().setRestDay(date);
  } catch {
    rejected = true;
  }
  if (rejected) {
    assert(materialSignature() === prior, 'rejected rest mark partially committed');
    assert(getAcceptedMaterialContext().markedDays[date] === undefined, 'rejected rest mark became visible');
  } else {
    const after = acceptedWeek(WEEK_START);
    assert(getAcceptedMaterialContext().markedDays[date] === 'rest', 'rest mark did not commit');
    assert(after.evaluation.ledger.conditioning.coreCount >= after.contract.conditioning.core.requiredMinimum,
      'required core work was silently lost');
    assert(after.evaluation.blockingViolations.length === 0, 'rest-marked week has blockers');
  }
});

run('regression', '4 removing a rest mark cannot create a hard-day or rest breach', () => {
  seed(profile('Off-season'));
  const date = '2026-07-16';
  useCalendarStore.getState().setRestDay(date);
  useCalendarStore.getState().removeRestDay(date);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().markedDays[date] === undefined, 'rest mark survived removal');
  assert(week.evaluation.blockingViolations.length === 0, 'rest removal created a blocker');
  assert((week.contract.restStress.hardDayMaximumBreach ?? 0) === 0, 'hard-day maximum breached');
});

run('regression', '5 practice-match calendar changes use the approved PM table', () => {
  seed(profile('Pre-season'));
  useCalendarStore.getState().setGameDay(SATURDAY);
  const withPracticeMatch = acceptedWeek(WEEK_START);
  assert(withPracticeMatch.contract.identity.mode === 'practice_match_week', 'practice-match table not selected');
  assert(withPracticeMatch.contract.identity.anchorState === 'practice_match', 'practice-match identity missing');
  assert(withPracticeMatch.contract.anchors.some((anchor) => anchor.kind === 'practice_match'), 'PM anchor missing');
  useCalendarStore.getState().removeGameDay(SATURDAY);
  const withoutPracticeMatch = acceptedWeek(WEEK_START);
  assert(withoutPracticeMatch.contract.identity.mode !== 'practice_match_week',
    'removed practice match retained the PM table');
  assert(!withoutPracticeMatch.contract.anchors.some((anchor) => anchor.kind === 'practice_match'),
    'removed practice match retained anchor credit');
});

run('regression', '6 a future calendar mark is gated when it becomes material', () => {
  const value = profile('Pre-season');
  seed(value);
  const futureGame = '2026-08-15';
  useCalendarStore.getState().setGameDay(futureGame);
  assert(!useProgramStore.getState().weekScopedOverlays[mondayFor(futureGame)],
    'unmaterialised future mark published an overlay early');
  rolloverProgramBlock({ baseProfile: value, targetDateISO: '2026-08-10' });
  const week = acceptedWeek('2026-08-10');
  assert(week.contract.identity.mode === 'practice_match_week', 'future mark was not activated as PM');
  assert(week.evaluation.blockingViolations.length === 0, 'activated future mark has blockers');
});

run('regression', '7 low readiness commits readiness and reduced program together', () => {
  seed(profile('Pre-season'));
  const before = acceptedWeek(WEEK_START);
  const powerDay = before.visible.find((workout) => !!workout.powerBlock)?.dayOfWeek ?? 1;
  const date = dateForDay(WEEK_START, powerDay);
  useReadinessStore.getState().setReadinessSignal(date, buildReadinessSignalPatch('flat'));
  const after = acceptedWeek(WEEK_START);
  const visibleDay = after.visible.find((workout) => workout.dayOfWeek === powerDay);
  assert(!!getAcceptedMaterialContext().readinessSignalsByDate[date], 'accepted readiness missing');
  assert(!!useReadinessStore.getState().signalsByDate[date], 'readiness mirror missing');
  assert(!visibleDay?.powerBlock, 'low readiness left power on affected day');
  assert(after.evaluation.blockingViolations.length === 0, 'readiness-reduced week has blockers');
});

run('regression', '8 a failed readiness projection commits neither surface', () => {
  seed(profile('Pre-season'));
  const before = materialSignature();
  const failed = withGatewayFailure(() =>
    useReadinessStore.getState().setReadinessSignal(WEDNESDAY, buildReadinessSignalPatch('flat')));
  assert(failed, 'failure injection did not reach readiness gateway');
  assert(materialSignature() === before, 'failed readiness changed accepted or mirror state');
});

run('regression', '9 athlete-visible readiness schedule equals the persisted accepted ledger', () => {
  seed(profile('Pre-season'));
  useReadinessStore.getState().setReadinessSignal(WEDNESDAY, buildReadinessSignalPatch('flat'));
  const week = acceptedWeek(WEEK_START);
  assert(ledgerSignature(week.contract) === ledgerSignature(week.evaluation.contract),
    'visible readiness ledger differs from persisted accepted ledger');
});

run('regression', '10 contractless legacy in-season derives a conservative v2 contract', () => {
  const result = migrated(profile('In-season', {
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    trainingDaysPerWeek: 5,
  }));
  const week = result.microcycles[0];
  assert(week.exposureContractV2?.source === 'legacy_migration', 'legacy v2 source missing');
  const evaluation = evaluateSection18EffectiveWeek({
    contract: week.exposureContractV2!, workouts: week.workouts, weekStart: WEEK_START,
  });
  assert(evaluation.blockingViolations.length === 0, 'migrated in-season week is not accepted');
});

run('regression', '11 contractless legacy off-season week is gated', () => {
  const week = migrated(profile('Off-season')).microcycles[0];
  const evaluation = evaluateSection18EffectiveWeek({
    contract: week.exposureContractV2!, workouts: week.workouts, weekStart: WEEK_START,
  });
  assert(week.exposureContractV2?.source === 'legacy_migration', 'off-season migration missing');
  assert(evaluation.blockingViolations.length === 0, 'off-season migration bypassed acceptance');
});

run('regression', '12 contractless legacy pre-season week is gated', () => {
  const week = migrated(profile('Pre-season')).microcycles[0];
  const evaluation = evaluateSection18EffectiveWeek({
    contract: week.exposureContractV2!, workouts: week.workouts, weekStart: WEEK_START,
  });
  assert(week.exposureContractV2?.source === 'legacy_migration', 'pre-season migration missing');
  assert(evaluation.blockingViolations.length === 0, 'pre-season migration bypassed acceptance');
});

run('regression', '13 legacy unknown anchors remain uncredited', () => {
  const value = profile('In-season', {
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
  });
  const week = migrated(value).microcycles[0];
  const contract = week.exposureContractV2!;
  const evaluation = evaluateSection18EffectiveWeek({ contract, workouts: week.workouts, weekStart: WEEK_START });
  assert(contract.anchors.length > 0, 'legacy anchor example did not contain anchors');
  assert(contract.anchors.every((anchor) => anchor.participation === 'unknown'),
    'migration invented unrestricted participation');
  assert(evaluation.ledger.conditioning.anchorCoreCount === 0, 'unknown anchor gained core credit');
});

run('regression', '14 an unrepairable legacy week returns a typed migration failure', () => {
  const source = stripContracts(generate(profile('Off-season'))).microcycles[0];
  let error: unknown;
  try {
    canonicaliseHydratedState({ currentMicrocycle: source });
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof Section18LegacyMigrationError, 'typed migration error was not returned');
  assert((error as Section18LegacyMigrationError).code === 'section18_legacy_migration_failed',
    'migration error code changed');
});

run('regression', '15 repeated hydration is deterministic and idempotent', () => {
  const value = profile('Off-season');
  const once = canonicaliseHydratedProgram(stripContracts(generate(value)), value);
  const twice = canonicaliseHydratedProgram(clone(once), value);
  assert(JSON.stringify(once) === JSON.stringify(twice), 'repeated hydration changed accepted state');
});

run('regression', '16 rebuild publishes calendar, program and overlays once', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  let programPublishes = 0;
  let calendarPublishes = 0;
  const stopProgram = useProgramStore.subscribe(() => { programPublishes += 1; });
  const stopCalendar = useCalendarStore.subscribe(() => { calendarPublishes += 1; });
  rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Wednesday',
    scope: 'weekOverlay',
    targetDate: WEDNESDAY,
    manageCalendarFixture: true,
  });
  stopProgram();
  stopCalendar();
  assert(programPublishes === 1, `rebuild published ProgramStore ${programPublishes} times`);
  assert(calendarPublishes === 1, `rebuild published calendar mirror ${calendarPublishes} times`);
  assert(!!useProgramStore.getState().weekScopedOverlays[WEEK_START], 'rebuild overlay missing');
});

run('regression', '17 rebuild failure preserves all prior surfaces', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  const before = materialSignature();
  const failed = withGatewayFailure(() => rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Wednesday',
    scope: 'weekOverlay',
    targetDate: WEDNESDAY,
    manageCalendarFixture: true,
  }));
  assert(failed, 'failure injection did not reach rebuild gateway');
  assert(materialSignature() === before, 'failed rebuild partially published state');
});

run('regression', '18 Repeat Week publishes overlay and accepted target once', () => {
  const value = profile('Off-season');
  seed(value);
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  const result = repeatWeekIntoNextWeek({ baseProfile: value, sourceWeekDate: WEEK_START, todayISO: WEEK_START });
  stop();
  assert(publishes === 1, `Repeat Week published ${publishes} times`);
  assert(useProgramStore.getState().weekScopedOverlays[result.targetWeekStart]?.reason === 'repeat_week',
    'accepted repeat overlay missing');
  assertAcceptedVisibleLedgerEquivalence({
    surfaces: useProgramStore.getState(),
    context: getAcceptedMaterialContext(),
    weekStarts: [result.targetWeekStart],
    profile: value,
  });
});

run('regression', '19 Repeat Week failure preserves prior state', () => {
  const value = profile('Off-season');
  seed(value);
  const before = materialSignature();
  const failed = withGatewayFailure(() =>
    repeatWeekIntoNextWeek({ baseProfile: value, sourceWeekDate: WEEK_START, todayISO: WEEK_START }));
  assert(failed, 'failure injection did not reach Repeat Week gateway');
  assert(materialSignature() === before, 'failed Repeat Week partially published state');
});

run('regression', '20 rollover restores all future overlays atomically', () => {
  const value = profile('Off-season');
  seed(value, '2026-06-08');
  const overlays = {
    '2026-07-06': placeholderOverlay('2026-07-06'),
    '2026-07-13': placeholderOverlay('2026-07-13'),
  };
  useProgramStore.setState({ weekScopedOverlays: overlays });
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  const result = rolloverProgramBlock({ baseProfile: value, targetDateISO: '2026-07-06' });
  stop();
  assert(result.rolledOver, 'rollover did not run');
  assert(publishes === 1, `rollover published ${publishes} times`);
  assert(Object.keys(useProgramStore.getState().weekScopedOverlays).length === 2,
    'rollover restored only some future overlays');
});

run('regression', '21 an invalid restored overlay is regenerated inside one rollover commit', () => {
  const value = profile('Pre-season');
  seed(value, '2026-06-08');
  const future = generate(value, '2026-07-06');
  const source = future.microcycles[1];
  const invalid: WeekScopedWorkoutOverlay = {
    ...buildWeekScopedWorkoutOverlay({
      program: { ...future, microcycles: [source] },
      weekStart: '2026-07-13',
      anchorDate: null,
      reason: 'one_off_no_game',
    }),
    workoutsByDate: Object.fromEntries(
      Array.from({ length: 7 }, (_, offset) => [addDaysISO('2026-07-13', offset), null]),
    ),
  };
  useProgramStore.setState({
    weekScopedOverlays: {
      '2026-07-06': placeholderOverlay('2026-07-06'),
      '2026-07-13': invalid,
    },
  });
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  const result = rolloverProgramBlock({ baseProfile: value, targetDateISO: '2026-07-06' });
  stop();
  const restored = useProgramStore.getState().weekScopedOverlays['2026-07-13'];
  assert(result.rolledOver, 'rollover did not run');
  assert(publishes === 1, `rollover published ${publishes} times`);
  assert(Object.values(restored?.workoutsByDate ?? {}).some(Boolean),
    'invalid overlay was not regenerated through the whole-week gateway');
});

run('regression', '22 constraint/program transaction has no observable intermediate state', () => {
  seed(profile('Pre-season'));
  const signal: ReadinessSignal = {
    date: WEDNESDAY,
    source: 'quick_check',
    updatedAt: NOW,
    ...buildReadinessSignalPatch('flat'),
  };
  const constraint = buildReadinessActiveConstraints(signal)[0];
  let badObservation = false;
  let programPublishes = 0;
  const stopProgram = useProgramStore.subscribe((state) => {
    programPublishes += 1;
    if (!state.acceptedMaterialContext.activeConstraints.some((candidate) => candidate.id === constraint.id)) {
      badObservation = true;
    }
  });
  const stopCoach = useCoachUpdatesStore.subscribe((state) => {
    if (state.activeConstraints.some((candidate) => candidate.id === constraint.id) &&
        !getAcceptedMaterialContext().activeConstraints.some((candidate) => candidate.id === constraint.id)) {
      badObservation = true;
    }
  });
  useCoachUpdatesStore.getState().setActiveConstraints([constraint]);
  stopProgram();
  stopCoach();
  assert(programPublishes === 1, `constraint transaction published ProgramStore ${programPublishes} times`);
  assert(!badObservation, 'subscriber observed new constraint with old accepted program context');
});

run('regression', '23 calendar/program transaction has no observable intermediate state', () => {
  seed(profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' }));
  let badObservation = false;
  let programPublishes = 0;
  const stopProgram = useProgramStore.subscribe((state) => {
    programPublishes += 1;
    const mark = state.acceptedMaterialContext.markedDays[WEDNESDAY];
    const contract = state.weekScopedOverlays[WEEK_START]?.exposureContractV2;
    if (mark === 'game' && contract?.identity.mode !== 'in_season_game_week') badObservation = true;
  });
  const stopCalendar = useCalendarStore.subscribe((state) => {
    if (state.markedDays[WEDNESDAY] === 'game' &&
        getAcceptedMaterialContext().markedDays[WEDNESDAY] !== 'game') badObservation = true;
  });
  useCalendarStore.getState().setGameDay(WEDNESDAY);
  stopProgram();
  stopCalendar();
  assert(programPublishes === 1, `calendar transaction published ProgramStore ${programPublishes} times`);
  assert(!badObservation, 'subscriber observed new mark with old contract');
});

run('regression', '24 readiness/program transaction has no observable intermediate state', () => {
  seed(profile('Pre-season'));
  let badObservation = false;
  let programPublishes = 0;
  const stopProgram = useProgramStore.subscribe((state) => {
    programPublishes += 1;
    if (!state.acceptedMaterialContext.readinessSignalsByDate[WEDNESDAY]) badObservation = true;
  });
  const stopReadiness = useReadinessStore.subscribe((state) => {
    if (state.signalsByDate[WEDNESDAY] &&
        !getAcceptedMaterialContext().readinessSignalsByDate[WEDNESDAY]) badObservation = true;
  });
  useReadinessStore.getState().setReadinessSignal(WEDNESDAY, buildReadinessSignalPatch('flat'));
  stopProgram();
  stopReadiness();
  assert(programPublishes === 1, `readiness transaction published ProgramStore ${programPublishes} times`);
  assert(!badObservation, 'subscriber observed new readiness with old accepted program context');
});

run('regression', '25 re-evaluated visible week matches the gateway ledger exactly', () => {
  const value = profile('Pre-season');
  seed(value);
  useCalendarStore.getState().setGameDay(SATURDAY);
  const week = acceptedWeek(WEEK_START);
  assert(ledgerSignature(week.contract) === ledgerSignature(week.evaluation.contract),
    're-evaluated visible ledger is not exact');
  assertAcceptedVisibleLedgerEquivalence({
    surfaces: useProgramStore.getState(),
    context: getAcceptedMaterialContext(),
    weekStarts: [WEEK_START],
    profile: value,
  });
});

console.log('\n-- Properties (10 distinct invariants) --');

run('property', 'no calendar mutation can bypass the gateway', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  const actions = [
    () => useCalendarStore.getState().setGameDay(WEDNESDAY),
    () => useCalendarStore.getState().removeGameDay(WEDNESDAY),
    () => useCalendarStore.getState().removeNoGame(SATURDAY),
    () => useCalendarStore.getState().setRestDay('2026-07-16'),
    () => useCalendarStore.getState().removeRestDay('2026-07-16'),
  ];
  for (const action of actions) {
    const before = materialSignature();
    try {
      action();
    } catch {
      assert(materialSignature() === before,
        'rejected calendar mutation changed an accepted-state surface');
      continue;
    }
    assertAcceptedVisibleLedgerEquivalence({
      surfaces: useProgramStore.getState(), context: getAcceptedMaterialContext(),
      weekStarts: [WEEK_START], profile: value,
    });
  }
});

run('property', 'no structural readiness change can bypass the gateway', () => {
  const value = profile('Pre-season');
  seed(value);
  for (const option of ['flat', 'sore', 'short_time', 'good'] as const) {
    useReadinessStore.getState().setReadinessSignal(WEDNESDAY, buildReadinessSignalPatch(option));
    assertAcceptedVisibleLedgerEquivalence({
      surfaces: useProgramStore.getState(), context: getAcceptedMaterialContext(),
      weekStarts: [WEEK_START], profile: value,
    });
  }
});

run('property', 'no contractless material week persists without accepted Contract v2', () => {
  for (const phase of ['In-season', 'Off-season', 'Pre-season'] as const) {
    const value = profile(phase);
    const result = canonicaliseHydratedProgram(stripContracts(generate(value)), value);
    assert(result.microcycles.every((week) => !!week.exposureContractV2), `${phase} retained contractless week`);
  }
});

run('property', 'multi-store operations publish complete old or complete new state', () => {
  seed(profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' }));
  const observed: string[] = [];
  const stop = useProgramStore.subscribe((state) => observed.push(JSON.stringify({
    mark: state.acceptedMaterialContext.markedDays[WEDNESDAY],
    mode: state.weekScopedOverlays[WEEK_START]?.exposureContractV2?.identity.mode,
  })));
  useCalendarStore.getState().setGameDay(WEDNESDAY);
  stop();
  assert(observed.length === 1, 'multi-store operation published an intermediate ProgramStore state');
  assert(observed[0] === JSON.stringify({ mark: 'game', mode: 'in_season_game_week' }),
    `published snapshot was incomplete: ${observed[0]}`);
});

run('property', 'failed transactions preserve every prior state surface', () => {
  seed(profile('Pre-season'));
  const before = materialSignature();
  const failed = withGatewayFailure(() => commitAcceptedStateTransaction({
    reason: 'property:forced_failure',
    readinessSignalsByDate: {
      [WEDNESDAY]: {
        date: WEDNESDAY, source: 'quick_check', updatedAt: NOW,
        ...buildReadinessSignalPatch('flat'),
      },
    },
    markedDays: { [SATURDAY]: 'game' },
    validateWeekStarts: [WEEK_START],
  }));
  assert(failed, 'forced failure did not reach gateway');
  assert(materialSignature() === before, 'failed staged transaction changed a surface');
});

run('property', 'visible projection is ledger-equivalent to gateway acceptance', () => {
  for (const phase of ['In-season', 'Off-season', 'Pre-season'] as const) {
    const value = profile(phase);
    seed(value);
    assertAcceptedVisibleLedgerEquivalence({
      surfaces: useProgramStore.getState(), context: getAcceptedMaterialContext(),
      weekStarts: [WEEK_START], profile: value,
    });
  }
});

run('property', 'unknown legacy participation never gains anchor credit', () => {
  const value = profile('In-season', {
    usualGameDay: 'Saturday', gameDay: 'Saturday',
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
  });
  for (const week of migrated(value).microcycles) {
    const contract = week.exposureContractV2!;
    assert(contract.anchors.every((anchor) => anchor.participation === 'unknown'),
      'unknown participation was promoted');
    const evaluation = evaluateSection18EffectiveWeek({
      contract, workouts: week.workouts, weekStart: week.startDate.slice(0, 10),
    });
    assert(evaluation.ledger.conditioning.anchorCoreCount === 0, 'unknown anchor gained credit');
  }
});

run('property', 'hydration remains deterministic and idempotent', () => {
  for (const phase of ['In-season', 'Off-season', 'Pre-season'] as const) {
    const value = profile(phase);
    const once = canonicaliseHydratedProgram(stripContracts(generate(value)), value);
    const twice = canonicaliseHydratedProgram(clone(once), value);
    assert(JSON.stringify(once) === JSON.stringify(twice), `${phase} hydration drifted`);
  }
});

run('property', 'rolling fixture repair publishes current and dependent weeks once', () => {
  const value = profile('In-season', {
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });
  seed(value);
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Sunday',
    scope: 'weekOverlay',
    targetDate: SUNDAY,
    clearOverlayDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK_START,
  });
  stop();
  const followingMonday = useProgramStore.getState().weekScopedOverlays[NEXT_WEEK]
    ?.workoutsByDate[NEXT_WEEK];
  assert(publishes === 1, `rolling fixture repair published ${publishes} states`);
  assert(!!useProgramStore.getState().weekScopedOverlays[WEEK_START], 'current overlay missing');
  assert(followingMonday?.derivedSessionProvenance?.some((record) =>
    record.dependency?.source.date === SUNDAY) === true,
  'following-week dependency was not committed in the same snapshot');
});

run('property', 'failed rolling fixture staging preserves the entire prior horizon', () => {
  const value = profile('In-season', {
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });
  seed(value);
  const before = materialSignature();
  const failed = withGatewayFailure(() => rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Sunday',
    scope: 'weekOverlay',
    targetDate: SUNDAY,
    clearOverlayDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK_START,
  }));
  assert(failed, 'failure injection did not reach rolling gateway');
  assert(materialSignature() === before, 'failed rolling staging partially published a week');
});

console.log('\n-- Mutation witnesses (10) --');

const root = path.resolve(__dirname, '..');
const source = (relative: string): string => readFileSync(path.join(root, relative), 'utf8');
const calendarSource = source('store/calendarStore.ts');
const readinessSource = source('store/readinessStore.ts');
const programSource = source('store/programStore.ts');
const coachSource = source('store/coachUpdatesStore.ts');
const transactionSource = source('store/acceptedStateTransaction.ts');
const rebuildSource = source('utils/weekRebuild.ts');
const rolloverSource = source('utils/programBlockRollover.ts');
const visibleSource = source('utils/visibleProgramReadModel.ts');

run('mutation', 'calendar cannot write markedDays before validation', () => {
  assert(calendarSource.includes("commitCalendarMarkTransaction"), 'calendar coordinator call removed');
  assert(!calendarSource.includes("set((state) => ({\n          markedDays"), 'direct calendar material write returned');
});

run('mutation', 'readiness cannot exist only in the visible read model', () => {
  assert(readinessSource.includes('commitReadinessSignalTransaction'), 'readiness coordinator call removed');
  assert(visibleSource.includes('hasAcceptedWeekContract'), 'accepted visible fence removed');
});

run('mutation', 'contract derivation cannot be skipped for contractless legacy weeks', () => {
  assert(programSource.includes('deriveContractlessLegacyContract'), 'contractless derivation removed');
  assert(programSource.includes("source: 'legacy_migration'"), 'migration provenance removed');
});

run('mutation', 'contractless workouts cannot be canonicalised without weekly validation', () => {
  const derive = programSource.indexOf('deriveContractlessLegacyContract');
  const gateway = programSource.indexOf('requireSection18AcceptedWeek', derive);
  assert(derive >= 0 && gateway > derive, 'weekly migration gateway removed or reordered');
});

run('mutation', 'program and constraints cannot publish sequential material state', () => {
  const coordinator = coachSource.indexOf("commitAcceptedStateTransaction({\n      reason: 'constraint:update'");
  const mirror = coachSource.indexOf('commitConstraintState();', coordinator);
  assert(coordinator >= 0 && mirror > coordinator, 'constraint coordinator no longer precedes mirror');
});

run('mutation', 'program and overlays cannot publish sequentially during rebuild', () => {
  assert(rebuildSource.includes("reason: 'week_rebuild:overlay'"), 'overlay transaction removed');
  assert(!rebuildSource.includes('setWeekScopedOverlay(overlay)'), 'sequential overlay setter returned');
});

run('mutation', 'future rollover overlays cannot be restored individually', () => {
  assert(rolloverSource.includes('weekScopedOverlays: relevantOverlays'), 'bulk overlay restoration removed');
  assert(!rolloverSource.includes('.setWeekScopedOverlay('), 'individual overlay restoration returned');
});

run('mutation', 'staged state cannot publish before every affected week passes', () => {
  const staged = transactionSource.indexOf('stageAcceptedStateTransaction(proposal)');
  const equivalent = transactionSource.indexOf('assertAcceptedVisibleLedgerEquivalence', staged);
  const publish = transactionSource.indexOf('useProgramStore.setState({', staged);
  assert(staged >= 0 && equivalent > staged && publish > equivalent, 'publish moved ahead of validation');
});

run('mutation', 'fixture paths cannot bypass the rolling-horizon staging owner', () => {
  assert(transactionSource.includes('stageRollingHorizonFixtureRepair({'),
    'calendar transaction bypasses rolling staging');
  assert(rebuildSource.includes('stageRollingHorizonFixtureRepair({'),
    'week rebuild bypasses rolling staging');
  assert(!rebuildSource.includes('rollingHorizonWeekStartsForMutation({'),
    'week rebuild retained an independent horizon owner');
});

run('mutation', 'only canonical injury facts may compose over an accepted base', () => {
  assert(visibleSource.includes(
    'if (hasAcceptedWeekContract(args.state, day.date) && !args.state.activeInjury) {'),
  'non-injury accepted week projection short circuit removed');
  assert(visibleSource.includes('activeInjury: args.state.activeInjury'),
    'canonical injury visible composition removed');
  assert(transactionSource.includes(".filter((constraint) => constraint.type !== 'injury')"),
    'injury constraint can destructively overwrite the accepted base');
});

console.log(`\nAccepted-state transaction totals: regressions=${regressionPass}/25 properties=${propertyPass}/10 mutations=${mutationPass}/10 failures=${failures.length}`);
if (regressionPass !== 25 || propertyPass !== 10 || mutationPass !== 10 || failures.length > 0) {
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
