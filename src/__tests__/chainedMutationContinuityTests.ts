/**
 * Accepted effective-week chained mutation and required-core relocation.
 * Run: npm run test:chained-mutation-continuity
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};

import type { DayOfWeek, OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { rebuildLocalWeek, type WeekRebuildResult } from '../utils/weekRebuild';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  buildFixtureProjection,
  commitDateUnavailableTransaction,
  commitProgramSetupRebuildTransaction,
} from '../store/acceptedStateTransaction';
import { rebaseAcceptedEffectiveWeek, type AcceptedEffectiveWeekSnapshot } from '../rules/acceptedEffectiveWeek';
import {
  compareFixtureReplanEditCost,
  RequiredCoreRelocationError,
} from '../utils/fixtureMinimalReplan';
import {
  resolvedDaysToGameChangeRows,
} from '../utils/gameChangeCoachNotes';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { executeHomeGameMutation } from '../screens/home/homeGameMutationController';

const WEEK = '2026-03-23';
const NEXT_WEEK = '2026-03-30';
const SATURDAY = '2026-03-28';
const SUNDAY = '2026-03-29';
const DAY_NAMES: DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

function athlete(args: {
  tt?: 0 | 1 | 2 | 3;
  phase?: 'In-season' | 'Pre-season';
  constraints?: OnboardingData['availabilityConstraints'];
} = {}): OnboardingData {
  const tt = args.tt ?? 2;
  const teamDays: Record<number, DayOfWeek[]> = {
    0: [],
    1: ['Tuesday'],
    2: ['Tuesday', 'Thursday'],
    3: ['Tuesday', 'Wednesday', 'Thursday'],
  };
  return {
    seasonPhase: args.phase ?? 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    availabilityConstraints: args.constraints,
    teamTrainingDaysPerWeek: tt,
    teamTrainingDays: teamDays[tt],
    teamTrainingIntensity: 'Hard',
    sprintExposure: '2+ times per week',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    experienceLevel: 'Advanced',
    injuries: [],
    motivation: 'Get stronger',
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  };
}

function reset(value: OnboardingData = athlete()): TrainingProgram {
  const marks: Record<string, CalendarDayType> = { [SATURDAY]: 'game' };
  const program = generateProgramLocally(value, { todayISO: WEEK, previousProgram: null });
  useProfileStore.setState({ onboardingData: value, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: marks, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null });
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    blockState: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    exposureContractsByWeek: {},
    acceptedMaterialContext: {
      markedDays: marks,
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'chained-test:seed',
    },
  });
  return program;
}

function accepted(weekStart = WEEK): AcceptedEffectiveWeekSnapshot {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
}

function byDay(snapshot = accepted()): Map<number, Workout> {
  return new Map(snapshot.visibleWorkouts.map((workout) => [workout.dayOfWeek, workout]));
}

function removeGame(value = useProfileStore.getState().onboardingData): WeekRebuildResult {
  return rebuildLocalWeek({
    baseProfile: value,
    newGameDay: null,
    scope: 'weekOverlay',
    targetDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK,
  });
}

function addSaturday(value = useProfileStore.getState().onboardingData): WeekRebuildResult {
  return rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Saturday',
    scope: 'weekOverlay',
    targetDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK,
  });
}

function addSunday(value = useProfileStore.getState().onboardingData): WeekRebuildResult {
  return rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Sunday',
    scope: 'weekOverlay',
    targetDate: SUNDAY,
    manageCalendarFixture: true,
    todayISO: WEEK,
  });
}

function moveToSunday(value = useProfileStore.getState().onboardingData): WeekRebuildResult {
  return rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Sunday',
    scope: 'weekOverlay',
    targetDate: SUNDAY,
    clearOverlayDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK,
  });
}

function visibleRows() {
  return resolvedDaysToGameChangeRows(resolveWeekWithConditioning(
    WEEK,
    buildScheduleStateImperative(),
  ));
}

function strengthDose(workout: Workout | undefined): string {
  return JSON.stringify((workout?.exercises ?? [])
    .filter((row) => row.section18Evidence?.role === 'main_strength' ||
      row.section18Evidence?.role === 'legacy_unknown')
    .map((row) => ({
      id: row.id,
      name: row.exercise?.name,
      sets: row.prescribedSets,
      min: row.prescribedRepsMin,
      max: row.prescribedRepsMax,
      rest: row.restSeconds,
    })));
}

function materialSignature(): string {
  const state = useProgramStore.getState();
  return JSON.stringify({
    program: state.currentProgram,
    microcycle: state.currentMicrocycle,
    today: state.todayWorkout,
    overrides: state.dateOverrides,
    contexts: state.overrideContexts,
    overlays: state.weekScopedOverlays,
    contracts: state.exposureContractsByWeek,
    accepted: state.acceptedMaterialContext,
    marks: useCalendarStore.getState().markedDays,
  });
}

function semantic(snapshot: AcceptedEffectiveWeekSnapshot): string {
  return JSON.stringify({
    workouts: snapshot.visibleWorkouts.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      id: workout.planEntryId,
      dose: strengthDose(workout),
    })),
    s: snapshot.evaluation.ledger.mainStrength.achievedCount,
    c: snapshot.evaluation.ledger.conditioning.coreCount,
    patterns: snapshot.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount,
  });
}

async function main(): Promise<void> {
  await run('1 exact chained Saturday-to-Sunday move preserves the accepted S3 week', () => {
    const value = athlete();
    reset(value);
    let before = visibleRows();
    const removed = executeHomeGameMutation({
      baseProfile: value,
      currentPhase: 'In-season',
      newGameDay: null,
      targetDate: SATURDAY,
      beforeRows: before,
      todayISO: WEEK,
    });
    assert(removed.outcome !== 'impossible', removed.outcome === 'impossible' ? removed.reason : '');
    const removedSaturday = byDay(accepted()).get(6);
    assert(/Hard Conditioning/i.test(removedSaturday?.name ?? ''),
      `Saturday replacement missing after removal: ${removedSaturday?.name}`);
    assert(removedSaturday?.derivedSessionProvenance?.some((record) =>
      record.origin === 'fixture_replacement') === true,
    'Saturday replacement did not persist fixture-replacement provenance');
    before = visibleRows();
    const added = executeHomeGameMutation({
      baseProfile: value,
      currentPhase: 'In-season',
      newGameDay: 'Sunday',
      targetDate: SUNDAY,
      beforeRows: before,
      todayISO: WEEK,
    });
    assert(added.outcome !== 'impossible', added.outcome === 'impossible' ? added.reason : '');
    const gameNote = useCoachUpdatesStore.getState().activeConstraints.find((row) =>
      row.id === `game-change-${WEEK}`);
    assert(gameNote?.reasonLabel === 'Game added',
      `stale removal note survived add-back: ${gameNote?.reasonLabel}`);
    const week = accepted();
    const map = byDay(week);
    assert(week.evaluation.ledger.mainStrength.achievedCount === 3, 'Sunday move lost S3');
    assert(map.get(1)?.name === 'Lower Body Strength', `Monday=${map.get(1)?.name}`);
    assert(/Upper Pull/.test(map.get(2)?.name ?? ''), `Tuesday=${map.get(2)?.name}`);
    assert(/Upper Push/.test(map.get(4)?.name ?? ''), `Thursday=${map.get(4)?.name}`);
    assert(!/Hard Conditioning/i.test(map.get(6)?.name ?? ''),
      `obsolete Saturday replacement survived: ${map.get(6)?.name}`);
    assert(map.get(0)?.workoutType === 'Game', `Sunday=${map.get(0)?.name}`);
  });

  await run('2 Sunday game publishes following-Monday G+1 recovery atomically', () => {
    reset();
    moveToSunday();
    const next = accepted(NEXT_WEEK);
    assert(byDay(next).get(1)?.sessionTier === 'recovery', `Monday=${byDay(next).get(1)?.name}`);
    assert(next.evaluation.blockingViolations.length === 0, JSON.stringify(next.evaluation.blockingViolations));
    assert(!!useProgramStore.getState().weekScopedOverlays[NEXT_WEEK], 'next-week protection overlay missing');
  });

  await run('3 live remove-session relocates accepted Saturday hard conditioning', () => {
    reset();
    removeGame();
    assert(byDay().get(6)?.name === 'Hard Conditioning', 'Saturday hard conditioning precondition missing');
    const result = executeCoachCommand({
      command: {
        mode: 'mutate',
        operation: 'remove_session',
        target: { kind: 'date', date: SATURDAY, sessionName: 'Hard Conditioning' },
        payload: { operation: 'remove_session', reason: 'Saturday unavailable' },
        scope: 'one_off',
        confidence: 1,
        needsClarification: false,
        reason: 'required_core_date_removal',
      },
      todayISO: WEEK,
      referenceResolution: null,
      userMessage: 'Remove Saturday hard conditioning',
    });
    const week = accepted();
    assert(result.kind === 'mutated' && result.applied, JSON.stringify(result));
    assert(!byDay(week).has(6), 'Saturday still has a workout');
    assert(week.evaluation.ledger.conditioning.coreCount === 3, 'conditioning fell below C3');
    assert(week.evaluation.ledger.conditioning.credits.some((credit) =>
      credit.source === 'app' && credit.dayOfWeek !== 6), 'app conditioning was not relocated');
  });

  await run('4 permanent Saturday unavailability rebases the current accepted bye', () => {
    const original = athlete();
    reset(original);
    removeGame(original);
    const nextProfile = athlete({
      constraints: [{
        id: 'sat-unavailable',
        kind: 'unavailable_day',
        scope: 'permanent',
        dayOfWeek: 'Saturday',
        active: true,
      }],
    });
    const program = generateProgramLocally(nextProfile, {
      todayISO: WEEK,
      previousProgram: useProgramStore.getState().currentProgram,
    });
    commitProgramSetupRebuildTransaction({ program, profile: nextProfile, todayISO: WEEK });
    useProfileStore.setState({ onboardingData: nextProfile });
    const week = accepted();
    assert(!byDay(week).has(6), 'blocked Saturday still has training');
    assert(week.evaluation.ledger.conditioning.coreCount === 3, 'availability edit reduced C3');
    assert(week.evaluation.ledger.mainStrength.achievedCount === 3, 'availability edit changed S3');
  });

  await run('5 removing compulsory weekly conditioning is typed-rejected without reduction authority', () => {
    reset();
    removeGame();
    const state = useProgramStore.getState();
    let error: unknown = null;
    try {
      buildFixtureProjection({
        program: state.currentProgram!,
        profile: useProfileStore.getState().onboardingData,
        weekStart: WEEK,
        markedDays: state.acceptedMaterialContext.markedDays,
        sourceSurfaces: state,
        sourceMarkedDays: state.acceptedMaterialContext.markedDays,
        mutationIntent: 'remove_weekly_exposure',
      });
    } catch (caught) {
      error = caught;
    }
    assert(error instanceof RequiredCoreRelocationError &&
      error.reason === 'authorised_reduction_required', String(error));
  });

  await run('6 typed weekly-exposure rejection preserves every accepted surface', () => {
    reset();
    removeGame();
    const before = materialSignature();
    const state = useProgramStore.getState();
    try {
      buildFixtureProjection({
        program: state.currentProgram!,
        profile: useProfileStore.getState().onboardingData,
        weekStart: WEEK,
        markedDays: state.acceptedMaterialContext.markedDays,
        sourceSurfaces: state,
        sourceMarkedDays: state.acceptedMaterialContext.markedDays,
        mutationIntent: 'remove_weekly_exposure',
      });
    } catch {
      // expected
    }
    assert(materialSignature() === before, 'rejected mutation partially committed');
  });

  await run('7 consecutive mutations source the latest accepted fixture-replan week', () => {
    reset();
    removeGame();
    const state = useProgramStore.getState();
    const marks = { ...state.acceptedMaterialContext.markedDays, [SATURDAY]: 'rest' as const };
    const projection = buildFixtureProjection({
      program: state.currentProgram!,
      profile: useProfileStore.getState().onboardingData,
      weekStart: WEEK,
      markedDays: marks,
      sourceSurfaces: state,
      sourceMarkedDays: state.acceptedMaterialContext.markedDays,
      mutationIntent: 'remove_from_date',
    });
    assert(projection.replan.sourcePlanEntryIds.includes(`fixture-replan:${WEEK}:saturday:hard-conditioning`),
      JSON.stringify(projection.replan.sourcePlanEntryIds));
  });

  await run('8 existing fixture overlay is composed before the next mutation', () => {
    reset();
    removeGame();
    const week = accepted();
    assert(week.dates.find((row) => row.date === SATURDAY)?.owner === 'week_overlay',
      'Saturday was not sourced from accepted overlay');
    assert(week.visibleWorkouts.some((workout) => workout.planEntryId?.startsWith('fixture-replan:')),
      'composed visible week lost fixture-owned entry');
  });

  await run('9 fixture-replan core content remains relocatable and preservable', () => {
    reset();
    removeGame();
    const saturday = byDay().get(6)!;
    const rowIds = new Set(saturday.exercises.map((row) => row.id));
    commitDateUnavailableTransaction({ date: SATURDAY, reason: 'test:block-saturday' });
    const relocatedRows = accepted().visibleWorkouts.flatMap((workout) => workout.exercises)
      .filter((row) => rowIds.has(row.id));
    assert(relocatedRows.length === rowIds.size, 'fixture-replan prescription rows were discarded');
  });

  await run('10 Monday Tuesday Thursday strength survives every chained transition', () => {
    reset();
    const original = byDay();
    for (const mutate of [removeGame, addSaturday, moveToSunday]) {
      mutate();
      const current = byDay();
      for (const day of [1, 2, 4]) {
        assert(current.get(day)?.planEntryId === original.get(day)?.planEntryId,
          `${DAY_NAMES[day]} identity changed`);
        assert(strengthDose(current.get(day)) === strengthDose(original.get(day)),
          `${DAY_NAMES[day]} prescription changed`);
      }
    }
  });

  await run('11 chained relocation never adds duplicate lower strength', () => {
    reset();
    removeGame();
    commitDateUnavailableTransaction({ date: SATURDAY, reason: 'test:block-saturday' });
    const patterns = accepted().evaluation.ledger.strengthPatterns.meaningfulMainLiftCount;
    assert(patterns.squat === 1 && patterns.hinge === 1 && patterns.push === 1 && patterns.pull === 1,
      JSON.stringify(patterns));
  });

  await run('12 valid Tuesday-pull and Thursday-push sessions are not merged', () => {
    reset();
    moveToSunday();
    const map = byDay();
    assert(/Upper Pull/.test(map.get(2)?.name ?? ''), `Tuesday=${map.get(2)?.name}`);
    assert(/Upper Push/.test(map.get(4)?.name ?? ''), `Thursday=${map.get(4)?.name}`);
    assert(map.get(2)?.planEntryId !== map.get(4)?.planEntryId, 'upper sessions merged identity');
  });

  await run('13 candidate scoring sacrifices optional work before core strength', () => {
    const base = {
      section18Blockers: 0,
      unavailableDayUses: 0,
      changedCoreSessions: 0,
      changedDays: 2,
      changedPlanEntryIdsOrPrescriptions: 0,
      releasedFixtureDayPenalty: 0,
      patternImbalance: 0,
      restDeficit: 0,
      duplicateStrengthPatternPenalty: 0,
      excessiveActiveStreak: 0,
      optionalBeforeCoreViolation: 0,
    };
    assert(compareFixtureReplanEditCost(base, {
      ...base,
      changedCoreSessions: 1,
      optionalBeforeCoreViolation: 1,
    }) < 0, 'core rewrite beat optional sacrifice');
  });

  await run('14 stable unaffected planEntryIds and prescriptions survive relocation', () => {
    reset();
    removeGame();
    const before = byDay();
    commitDateUnavailableTransaction({ date: SATURDAY, reason: 'test:block-saturday' });
    const after = byDay();
    for (const day of [1, 2, 4]) {
      assert(after.get(day)?.planEntryId === before.get(day)?.planEntryId, `${DAY_NAMES[day]} id`);
      assert(strengthDose(after.get(day)) === strengthDose(before.get(day)), `${DAY_NAMES[day]} dose`);
    }
  });

  await run('15 required relocation is valid for 0 1 2 and 3 team-training variants', () => {
    for (const tt of [0, 1, 2, 3] as const) {
      const value = athlete({ tt });
      reset(value);
      removeGame(value);
      const beforeStrength = accepted().evaluation.ledger.mainStrength.achievedCount;
      commitDateUnavailableTransaction({ date: SATURDAY, reason: `test:block-saturday:${tt}tt` });
      const week = accepted();
      assert(!byDay(week).has(6), `${tt}TT kept Saturday work`);
      assert(week.evaluation.blockingViolations.length === 0,
        `${tt}TT blockers=${JSON.stringify(week.evaluation.blockingViolations)}`);
      assert(week.evaluation.ledger.mainStrength.achievedCount === beforeStrength,
        `${tt}TT strength changed ${beforeStrength}->${week.evaluation.ledger.mainStrength.achievedCount}`);
    }
  });

  await run('16 practice-match remove add and Sunday-move chain stays minimal', () => {
    const value = athlete({ phase: 'Pre-season' });
    reset(value);
    const removed = removeGame(value);
    const added = addSaturday(value);
    const moved = moveToSunday(value);
    assert(removed.fixtureReplan?.usedFullRegeneration === false, 'practice removal regenerated');
    assert(added.fixtureReplan?.usedFullRegeneration === false, 'practice add regenerated');
    assert(moved.fixtureReplan?.usedFullRegeneration === false, 'practice move regenerated');
    assert(byDay().get(0)?.workoutType === 'Game', 'Sunday practice-match projection missing');
  });

  await run('17 rebuild Repeat Week rollover and rehydration use accepted rebasing ownership', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const sources = {
      transaction: fs.readFileSync(`${__dirname}/../store/acceptedStateTransaction.ts`, 'utf8'),
      rebuild: fs.readFileSync(`${__dirname}/../utils/weekRebuild.ts`, 'utf8'),
      repeat: fs.readFileSync(`${__dirname}/../utils/repeatWeek.ts`, 'utf8'),
      rollover: fs.readFileSync(`${__dirname}/../utils/programBlockRollover.ts`, 'utf8'),
      hydration: fs.readFileSync(`${__dirname}/../store/programStore.ts`, 'utf8'),
    };
    assert(/rebaseAcceptedEffectiveWeek/.test(sources.transaction), 'transaction rebase missing');
    assert(/buildFixtureProjection/.test(sources.rebuild), 'rebuild rebase door missing');
    assert(/rebaseAcceptedEffectiveWeek/.test(sources.repeat), 'Repeat Week rebase missing');
    assert(/rebuildLocalWeek/.test(sources.rollover), 'rollover bypasses rebuild');
    assert(/rebaseAcceptedEffectiveWeek/.test(sources.hydration), 'rehydration rebase missing');
  });

  await run('18 full regeneration remains after minimal search and date-removal rejects instead', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const source = fs.readFileSync(`${__dirname}/../utils/fixtureMinimalReplan.ts`, 'utf8');
    const winner = source.indexOf('const winner = accepted[0]');
    const relocationReject = source.indexOf("args.mutationIntent === 'remove_from_date'", winner);
    const fallback = source.indexOf('const fallbackGateway = requireSection18AcceptedWeek', winner);
    assert(winner >= 0 && relocationReject > winner && fallback > relocationReject,
      'fallback precedes minimal relocation/rejection');
    reset();
    const result = removeGame();
    assert(result.fixtureReplan?.usedFullRegeneration === false, 'valid reproduction regenerated');
  });

  await run('properties chained final state equals one atomic final-calendar transition', () => {
    reset();
    removeGame();
    addSunday();
    const chained = semantic(accepted());
    reset();
    moveToSunday();
    assert(semantic(accepted()) === chained, 'chained and direct final state differ');
  });

  await run('properties date removal retains the accepted contract and required ledger', () => {
    reset();
    removeGame();
    const before = accepted();
    commitDateUnavailableTransaction({ date: SATURDAY, reason: 'property:block' });
    const after = accepted();
    assert(after.contract.identity.mode === before.contract.identity.mode, 'contract mode changed');
    assert(after.evaluation.ledger.conditioning.coreCount ===
      before.evaluation.ledger.conditioning.coreCount, 'required conditioning was deleted');
  });

  await run('properties latest accepted overlay owns every second mutation input', () => {
    reset();
    removeGame();
    const snapshot = accepted();
    const state = useProgramStore.getState();
    const projection = buildFixtureProjection({
      program: state.currentProgram!,
      profile: useProfileStore.getState().onboardingData,
      weekStart: WEEK,
      markedDays: { ...state.acceptedMaterialContext.markedDays, [SATURDAY]: 'rest' },
      sourceSurfaces: state,
      sourceMarkedDays: state.acceptedMaterialContext.markedDays,
      mutationIntent: 'remove_from_date',
    });
    assert(JSON.stringify(projection.replan.sourcePlanEntryIds.sort()) ===
      JSON.stringify(snapshot.stablePlanEntryIds.sort()), 'planner source differs from accepted snapshot');
  });

  await run('properties failed relocation mutations preserve accepted surfaces', () => {
    reset();
    removeGame();
    const before = materialSignature();
    const state = useProgramStore.getState();
    try {
      buildFixtureProjection({
        program: state.currentProgram!,
        profile: useProfileStore.getState().onboardingData,
        weekStart: WEEK,
        markedDays: state.acceptedMaterialContext.markedDays,
        sourceSurfaces: state,
        sourceMarkedDays: state.acceptedMaterialContext.markedDays,
        mutationIntent: 'remove_weekly_exposure',
      });
    } catch {
      // expected
    }
    assert(materialSignature() === before, 'failed property mutation changed state');
  });

  await run('properties unaffected core identities remain stable across all chain prefixes', () => {
    reset();
    const original = byDay();
    for (const mutate of [removeGame, addSaturday, moveToSunday]) {
      mutate();
      const current = byDay();
      for (const day of [1, 2, 4]) {
        assert(current.get(day)?.planEntryId === original.get(day)?.planEntryId,
          `${DAY_NAMES[day]} changed after ${mutate.name}`);
      }
    }
  });

  await run('mutations rebasing deletion regeneration identity and partial-commit defects are killed', () => {
    reset();
    removeGame();
    const before = accepted();
    const saturday = byDay(before).get(6)!;
    const beforeMaterial = materialSignature();
    let rejected = false;
    try {
      const state = useProgramStore.getState();
      buildFixtureProjection({
        program: state.currentProgram!,
        profile: useProfileStore.getState().onboardingData,
        weekStart: WEEK,
        markedDays: state.acceptedMaterialContext.markedDays,
        sourceSurfaces: state,
        sourceMarkedDays: state.acceptedMaterialContext.markedDays,
        mutationIntent: 'remove_weekly_exposure',
      });
    } catch {
      rejected = true;
    }
    commitDateUnavailableTransaction({ date: SATURDAY, reason: 'mutation:witness' });
    const after = accepted();
    const map = byDay(after);
    const checks = [
      before.dates.find((row) => row.date === SATURDAY)?.owner === 'week_overlay',
      before.stablePlanEntryIds.includes(saturday.planEntryId!),
      after.evaluation.ledger.conditioning.coreCount === 3,
      after.evaluation.ledger.mainStrength.achievedCount === 3,
      !map.has(6),
      rejected,
      beforeMaterial !== materialSignature(),
      Object.values(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount)
        .every((count) => count === 1),
    ];
    assert(checks.every(Boolean), `surviving mutation witnesses=${checks.map((ok, index) => ok ? null : index + 1).filter(Boolean)}`);
  });

  console.log(`\nChained-mutation continuity totals: passed=${passed}/24 failures=${failures.length}`);
  if (failures.length > 0) console.log(`Failures: ${failures.join(' | ')}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
