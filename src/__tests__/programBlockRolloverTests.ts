/**
 * Program block rollover — deterministic four-week lifecycle coverage.
 *
 * global.fetch is poisoned: rollover must stay on the local generation path.
 * Run: npm run test:block-rollover
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
  throw new Error('NETWORK DISABLED — program block rollover must be fully local');
};

import { readFileSync } from 'fs';
import path from 'path';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import {
  useCoachUpdatesStore,
  type ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import type {
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import { buildStrengthWorkoutHistoryFromFeedback } from '../utils/strengthProgressionIntegration';
import {
  getProgramBlockRolloverStatus,
} from '../utils/programBlockState';
import {
  rolloverProgramBlock,
  selectRelevantRolloverOverlays,
} from '../utils/programBlockRollover';
import {
  resolveWeekWithConditioning,
  type ScheduleState,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { evaluateEffectiveWeekExposureContract } from '../rules/weeklyExposureContract';
import { observeMicrocycleSection18 } from '../utils/section18ProgramObservation';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const IN_SEASON_PROFILE: OnboardingData = {
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  usualGameDay: 'Saturday',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingDuration: '60-90 minutes',
  teamTrainingIntensity: 'Hard',
  sessionDurationMinutes: '45-60 minutes',
  trainingLocation: 'Commercial gym',
  equipment: ['barbell', 'dumbbells', 'squat_rack', 'cable_machine', 'bands'],
  sprintExposure: '2+ times per week',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Get stronger',
};

const OFF_SEASON_PROFILE: OnboardingData = {
  ...IN_SEASON_PROFILE,
  seasonPhase: 'Off-season',
  gameDay: undefined,
  usualGameDay: undefined,
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingIntensity: 'Moderate',
};

const PRE_SEASON_NO_ANCHOR_PROFILE: OnboardingData = {
  ...IN_SEASON_PROFILE,
  seasonPhase: 'Pre-season',
  gameDay: undefined,
  usualGameDay: undefined,
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  equipment: ['Full Gym'],
  conditioningLevel: 'Elite',
};

function resetStores(): void {
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
  });
  useCoachUpdatesStore.setState({
    activeConstraints: [],
    activeInjury: null,
  } as any);
}

function makeOverride(source: Workout, date: string, name: string): Workout {
  const id = `rollover-override:${date}`;
  return {
    ...source,
    id,
    microcycleId: 'manual-rollover-test',
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    name,
    exercises: (source.exercises ?? []).map((exercise) => ({
      ...exercise,
      id: `${exercise.id}:${date}`,
      workoutId: id,
    })),
  };
}

function makeOverlay(weekStart: string, weekEnd: string): WeekScopedWorkoutOverlay {
  const now = '2026-07-10T12:00:00.000Z';
  return {
    id: `overlay:${weekStart}`,
    weekStart,
    weekEnd,
    anchorDate: null,
    reason: 'one_off_no_game',
    workoutsByDate: {},
    createdAt: now,
    updatedAt: now,
  };
}

function exerciseSignature(program: TrainingProgram): string {
  return program.microcycles[0].workouts
    .flatMap((workout) => workout.exercises.map((exercise) => exercise.exercise?.name ?? exercise.exerciseId))
    .join('|');
}

console.log('\n-- Block rollover detection --');

{
  const program = generateProgramLocally(OFF_SEASON_PROFILE, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  const finalSunday = getProgramBlockRolloverStatus({
    program,
    dateISO: '2026-08-02',
    blockState: { blockStartDate: '2026-07-06', blockNumber: 1 },
  });
  const nextMonday = getProgramBlockRolloverStatus({
    program,
    dateISO: '2026-08-03',
    blockState: { blockStartDate: '2026-07-06', blockNumber: 1 },
  });

  ok('week 4 final Sunday remains inside the current block', !finalSunday.needsRollover);
  ok('following Monday detects an expired block', nextMonday.needsRollover);
  ok('next block starts on the correct Monday', nextMonday.nextBlockStart === '2026-08-03');
  ok('next block spans exactly four Monday-Sunday weeks', nextMonday.nextBlockEnd === '2026-08-30');
  ok('next block number increments exactly once', nextMonday.nextBlockNumber === 2);
}

console.log('\n-- No rollover inside the active block --');

{
  resetStores();
  const program = generateProgramLocally(OFF_SEASON_PROFILE, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(program.microcycles[3]);
  const before = useProgramStore.getState();
  const result = rolloverProgramBlock({
    baseProfile: OFF_SEASON_PROFILE,
    targetDateISO: '2026-08-02',
  });
  const after = useProgramStore.getState();

  ok('rollover is a no-op while date remains in the block', !result.rolledOver);
  ok('in-block check does not replace the program', after.currentProgram === before.currentProgram);
  ok('in-block check does not reset the selected microcycle', after.currentMicrocycle === before.currentMicrocycle);
}

console.log('\n-- Deterministic next-block state and persistence --');

{
  resetStores();
  const program = generateProgramLocally(IN_SEASON_PROFILE, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  const sourceWorkout = program.microcycles[0].workouts[0];
  const sourceTuesdayWorkout = program.microcycles[0].workouts.find(
    (workout) => workout.dayOfWeek === 2,
  ) ?? sourceWorkout;
  const safeThursdayWorkout = program.microcycles[0].workouts.find(
    (workout) => workout.dayOfWeek === 4,
  ) ?? sourceWorkout;
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(program.microcycles[3]);

  const liveConstraint: ActiveScheduleConstraint = {
    id: 'rollover-live-schedule',
    type: 'schedule',
    severity: 3,
    status: 'active',
    startDate: '2026-07-31',
    lastUpdatedAt: '2026-07-31T12:00:00.000Z',
    reasonLabel: 'Limited availability',
    source: 'coach',
    weekStartISO: '2026-08-03',
    expiresAt: '2026-08-09',
    linkedOverrideDates: ['2026-08-04'],
    modifierAffects: ['current_week', 'future_generation'],
    rules: ['Tuesday unavailable'],
    safeFocus: ['Available training days'],
    advice: [],
  };
  useCoachUpdatesStore.getState().setActiveConstraints([liveConstraint]);

  useProgramStore.getState().setManualOverride(
    '2026-08-03',
    makeOverride(sourceWorkout, '2026-08-03', 'Athlete-edited Monday'),
    { intent: 'program_adjustment' },
  );
  useProgramStore.getState().setManualOverride(
    '2026-08-04',
    makeOverride(sourceTuesdayWorkout, '2026-08-04', 'Constraint-owned Tuesday'),
    { intent: 'program_adjustment', activeModifierId: liveConstraint.id },
  );
  useProgramStore.getState().setManualOverride(
    '2026-08-05',
    makeOverride(sourceWorkout, '2026-08-05', 'Cleared-constraint leftover'),
    { intent: 'program_adjustment', activeModifierId: 'cleared-constraint' },
  );
  useProgramStore.getState().setManualOverride(
    '2026-08-06',
    makeOverride(safeThursdayWorkout, '2026-08-06', 'Legacy system leftover'),
  );

  const oldOverlay = makeOverlay('2026-07-27', '2026-08-02');
  const futureOverlay = makeOverlay('2026-08-10', '2026-08-16');
  useProgramStore.getState().setWeekScopedOverlay(oldOverlay);
  useProgramStore.getState().setWeekScopedOverlay(futureOverlay);

  useProgramStore.getState().setSessionFeedback('2026-07-30', {
    dateStr: '2026-07-30',
    completion: 'full',
    feeling: 'easy',
    strength: [{
      exerciseId: 'back-squat',
      workoutExerciseId: 'logged-back-squat',
      exerciseName: 'Back Squat',
      prescribedSets: 4,
      prescribedRepsMin: 5,
      prescribedRepsMax: 5,
      weightKg: 100,
      completion: 'full',
    }],
  });
  useProgramStore.getState().setWeightOverride('2026-07-30', 'back-squat', 100);

  const relevant = selectRelevantRolloverOverlays(
    useProgramStore.getState().weekScopedOverlays,
    '2026-08-03',
  );
  ok('overlay selection excludes expired old-block overlays', !relevant[oldOverlay.weekStart]);
  ok('overlay selection retains future exact-week context', relevant[futureOverlay.weekStart] === futureOverlay);

  const result = rolloverProgramBlock({
    baseProfile: IN_SEASON_PROFILE,
    targetDateISO: '2026-08-03',
  });
  const after = useProgramStore.getState();
  const next = after.currentProgram!;

  ok('expired program rolls over locally', result.rolledOver);
  ok('new program has correct four-week bounds',
    next.startDate.split('T')[0] === '2026-08-03' &&
      next.endDate.split('T')[0] === '2026-08-30',
    `${next.startDate}..${next.endDate}`);
  ok('new program contains four generated microcycles', next.microcycles.length === 4);
  ok('new block metadata increments to block 2',
    next.microcycles.every((week) => week.miniCycleNumber === 2) &&
      after.blockState?.blockNumber === 2,
    JSON.stringify(after.blockState));
  ok('new block starts at build week 1 rather than replaying old deload state',
    next.microcycles[0].weekNumber === 5 &&
      next.microcycles[0].weekKind === 'build' &&
      after.currentMicrocycle?.id === next.microcycles[0].id,
    JSON.stringify({
      weekNumber: next.microcycles[0].weekNumber,
      weekKind: next.microcycles[0].weekKind,
      selectedId: after.currentMicrocycle?.id,
      firstId: next.microcycles[0].id,
      sameSelectedMicrocycle: after.currentMicrocycle?.id === next.microcycles[0].id,
    }));
  ok('in-season new block keeps kernel-correct build state in week 4',
    next.microcycles[3].weekNumber === 8 && next.microcycles[3].weekKind === 'build');
  const resolvedFirstWeek = resolveWeekWithConditioning('2026-08-03', {
    currentProgram: next,
    currentMicrocycle: after.currentMicrocycle,
    manualOverrides: after.dateOverrides,
    weekScopedOverlays: after.weekScopedOverlays,
    markedDays: {},
    athleteContext: {
      ...DEFAULT_ATHLETE_CONTEXT,
      onboardingData: IN_SEASON_PROFILE,
    },
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    readiness: 'high',
    availableDayNumbers: [1, 2, 3, 4, 5],
  } satisfies ScheduleState);
  ok('phase/team/game context remains present in generated block',
    next.microcycles[0].workouts.filter((workout) => workout.workoutType === 'Team Training').length === 2 &&
      resolvedFirstWeek.some((day) => day.workout?.workoutType === 'Game'),
    resolvedFirstWeek.map((day) => `${day.dayOfWeek}:${day.workout?.workoutType ?? 'Off'}`).join('|'));

  ok('live active constraint remains active across rollover',
    useCoachUpdatesStore.getState().activeConstraints.some((constraint) => constraint.id === liveConstraint.id));
  ok('cleared constraints are not recreated',
    !useCoachUpdatesStore.getState().activeConstraints.some((constraint) => constraint.id === 'cleared-constraint'));
  ok('athlete manual edit survives canonical rollover sweep', !!after.dateOverrides['2026-08-03']);
  ok('live constraint-owned edit survives canonical rollover sweep', !!after.dateOverrides['2026-08-04']);
  ok('cleared-constraint leftover is swept', !after.dateOverrides['2026-08-05']);
  ok('contextless system leftover is swept', !after.dateOverrides['2026-08-06']);
  ok('sweep result reports preserved and cleared edits',
    result.sweep?.preserve.includes('2026-08-03') === true &&
      result.sweep?.preserve.includes('2026-08-04') === true &&
      result.sweep?.clear.includes('2026-08-05') === true &&
      result.sweep?.clear.includes('2026-08-06') === true,
    JSON.stringify(result.sweep));

  ok('expired old overlay does not leak into the new block', !after.weekScopedOverlays[oldOverlay.weekStart]);
  const survivingFutureOverlay = after.weekScopedOverlays[futureOverlay.weekStart];
  ok('future exact-week overlay survives rollover with its target-week contract',
    survivingFutureOverlay?.id === futureOverlay.id &&
      survivingFutureOverlay.reason === futureOverlay.reason &&
      JSON.stringify(survivingFutureOverlay.workoutsByDate) ===
        JSON.stringify(futureOverlay.workoutsByDate) &&
      !!survivingFutureOverlay.exposureContractV2);
  ok('feedback history survives rollover', after.sessionFeedback['2026-07-30']?.feeling === 'easy');
  ok('performed weights survive rollover', after.weightOverrides['2026-07-30']?.['back-squat'] === 100);
  const history = buildStrengthWorkoutHistoryFromFeedback(after.sessionFeedback, next.startDate);
  ok('prior-block feedback remains available to progression inputs',
    history.some((workout) => workout.loggedDate === '2026-07-30' && workout.sets.length === 4),
    JSON.stringify(history));
}

console.log('\n-- Block-to-block exercise variation and automatic trigger --');

{
  resetStores();
  const first = generateProgramLocally(OFF_SEASON_PROFILE, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  useProgramStore.getState().setCurrentProgram(first);
  const result = rolloverProgramBlock({
    baseProfile: OFF_SEASON_PROFILE,
    targetDateISO: '2026-08-17',
  });
  ok('block number changes exercise rotation without random generation',
    !!result.program && exerciseSignature(result.program) !== exerciseSignature(first),
    JSON.stringify({ first: exerciseSignature(first), next: result.program && exerciseSignature(result.program) }));
  ok('off-season rollover schedules its own fourth-week deload',
    result.program?.microcycles[3].weekNumber === 8 &&
      result.program.microcycles[3].weekKind === 'deload');
  ok('late app open selects the microcycle containing the current date',
    useProgramStore.getState().currentMicrocycle?.weekNumber === 7);
}

{
  resetStores();
  const first = generateProgramLocally(PRE_SEASON_NO_ANCHOR_PROFILE, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  useProgramStore.getState().setCurrentProgram(first);
  const result = rolloverProgramBlock({
    baseProfile: PRE_SEASON_NO_ANCHOR_PROFILE,
    targetDateISO: '2026-08-03',
  });
  const corrected = result.program?.microcycles.every((week) => {
    const contract = week.exposureContract;
    if (!contract) return false;
    const validation = evaluateEffectiveWeekExposureContract(
      contract,
      week.workouts,
      week.startDate.slice(0, 10),
    );
    const healthyBuild = week.weekKind !== 'deload';
    return contract.strength.targetCount === 4 &&
      (!healthyBuild || contract.conditioning.targetCount === 4) &&
      contract.sprintCod.targetCount === 1 &&
      validation.accepted &&
      validation.ledger.achieved.main_strength === 4 &&
      (!healthyBuild || validation.ledger.achieved.conditioning === 4) &&
      validation.ledger.achieved.sprint_cod >= 1;
  }) === true;
  ok('pre-season rollover carries and validates corrected 4/4/1 exposure policy',
    corrected,
    JSON.stringify(result.program?.microcycles.map((week) => week.exposureContract)));
  ok('rollover emits an observable Section 18 contract for every new week',
    result.program?.microcycles.every((week) => {
      const observation = observeMicrocycleSection18(week);
      return week.exposureContractV2?.protocolVersion === 2 && observation !== null &&
        observation.contract.mainStrength.exposure.unresolvedPlannerSelectedShortfall === 0 &&
        observation.contract.conditioning.core.unresolvedPlannerSelectedShortfall === 0 &&
        observation.contract.sprintHighSpeed.exposure.unresolvedPlannerSelectedShortfall === 0;
    }) === true);
}

{
  const homeHook = readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'),
    'utf8',
  );
  ok('Home lifecycle checks the shared rollover status', /getProgramBlockRolloverStatus\(\{/.test(homeHook));
  ok('Home automatically calls the deterministic rollover coordinator', /rolloverProgramBlock\(\{/.test(homeHook));
  ok('Home rollover does not call local generation directly',
    !/generateProgramLocally\(/.test(homeHook) &&
      !/import\s*\{[^}]*generateProgramLocally/.test(homeHook));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
