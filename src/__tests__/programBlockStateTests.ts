(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import { readFileSync } from 'fs';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { getAthletePrefs } from '../store/athletePreferencesStore';
import { useProgramStore, getCurrentBlockNumberForGeneration } from '../store/programStore';
import { rebuildLocalWeek } from '../utils/weekRebuild';
import {
  addDays,
  resolveWeekWithConditioning,
  type ScheduleState,
  type ResolvedDay,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import {
  deriveStoredBlockStateFromProgram,
  getBlockNumberForDate,
  getMondayISOForDate,
  getProgramBlockStateForDate,
  getWeekInBlock,
  getWeeksSinceDeload,
} from '../utils/programBlockState';
import { buildCoachingPlan, onboardingToCoachingInputs } from '../utils/coachingEngine';
import { buildProgressionContext } from '../utils/strengthProgressionIntegration';
import type { OnboardingData } from '../types/domain';

const PROFILE: Partial<OnboardingData> = {
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  teamTrainingIntensity: 'Moderate',
  sprintExposure: 'Occasionally',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Pretty consistent',
  injuries: [],
  motivation: 'Get stronger',
};

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

function resetProgramStore(): void {
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
}

function liveScheduleState(profile: Partial<OnboardingData>): ScheduleState {
  const ps = useProgramStore.getState();
  return {
    currentProgram: ps.currentProgram,
    currentMicrocycle: ps.currentMicrocycle,
    manualOverrides: ps.dateOverrides,
    weekScopedOverlays: ps.weekScopedOverlays,
    markedDays: {},
    athleteContext: { ...DEFAULT_ATHLETE_CONTEXT, onboardingData: profile as OnboardingData },
    seasonPhase: profile.seasonPhase as ScheduleState['seasonPhase'],
    readiness: 'high',
    availableDayNumbers: [1, 2, 3, 4, 5],
  };
}

function resolveLiveWeek(mondayISO: string, profile: Partial<OnboardingData>): ResolvedDay[] {
  return resolveWeekWithConditioning(mondayISO, liveScheduleState(profile));
}

console.log('\n-- Program block state --');

{
  const blockStart = '2026-07-06';
  ok('Monday anchors to itself', getMondayISOForDate(blockStart) === '2026-07-06');
  ok('Sunday stays in week 1', getWeekInBlock(blockStart, '2026-07-12') === 1);
  ok('following Monday is week 2', getWeekInBlock(blockStart, '2026-07-13') === 2);
  ok('fourth Sunday is still week 4', getWeekInBlock(blockStart, '2026-08-02') === 4);
  ok('next Monday starts week 1 of next block', getWeekInBlock(blockStart, '2026-08-03') === 1);
  ok('weeksSinceDeload is weekInBlock minus one', getWeeksSinceDeload(blockStart, '2026-07-27') === 3);
}

{
  const dstBlockStart = '2026-09-28';
  ok('DST Sunday remains in its Monday-anchored week', getWeekInBlock(dstBlockStart, '2026-10-04') === 1);
  ok('DST following Monday advances the week', getWeekInBlock(dstBlockStart, '2026-10-05') === 2);
}

{
  const blockStart = '2026-07-06';
  ok('block number holds through week 4', getBlockNumberForDate(blockStart, 2, '2026-08-02') === 2);
  ok('block number changes at block boundary only', getBlockNumberForDate(blockStart, 2, '2026-08-03') === 3);

  const week4 = getProgramBlockStateForDate({
    dateISO: '2026-07-27',
    programStartISO: blockStart,
    blockNumber: 2,
    seasonPhase: 'Off-season',
  });
  ok('program block state carries week 4 within block 2',
    week4.blockNumber === 2 && week4.miniCycleNumber === 2 && week4.weekInBlock === 4,
    JSON.stringify(week4));
}

console.log('\n-- Store persistence and migration defaults --');

{
  resetProgramStore();
  const program = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: '2026-07-06',
    blockNumber: 3,
  });
  useProgramStore.getState().setCurrentProgram(program);
  ok('setCurrentProgram persists block state',
    useProgramStore.getState().blockState?.blockStartDate === '2026-07-06' &&
    useProgramStore.getState().blockState?.blockNumber === 3,
    JSON.stringify(useProgramStore.getState().blockState));
  ok('generation helper reads persisted block state',
    getCurrentBlockNumberForGeneration('2026-07-27') === 3);
  ok('generation helper advances only after block boundary',
    getCurrentBlockNumberForGeneration('2026-08-03') === 4);
}

{
  const migrated = deriveStoredBlockStateFromProgram(null, '2026-07-09');
  ok('migration default uses current week Monday',
    migrated.blockStartDate === '2026-07-06' && migrated.blockNumber === 1,
    JSON.stringify(migrated));
}

console.log('\n-- Rebuilds and plan edits preserve block state --');

{
  resetProgramStore();
  const program = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: '2026-07-06',
    blockNumber: 3,
  });
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(program.microcycles[0]);
  const before = JSON.stringify(useProgramStore.getState().blockState);

  rebuildLocalWeek({
    baseProfile: PROFILE as OnboardingData,
    newGameDay: 'Saturday',
    scope: 'weekOverlay',
    targetDate: '2026-07-18',
  });

  ok('week-scoped game/practice overlay does not reset block state',
    JSON.stringify(useProgramStore.getState().blockState) === before,
    JSON.stringify(useProgramStore.getState().blockState));
}

{
  const visibleWeek = resolveLiveWeek('2026-07-06', PROFILE);
  const before = JSON.stringify(useProgramStore.getState().blockState);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyPlanChange } = require('../utils/planChangeProducer') as typeof import('../utils/planChangeProducer');
  const result = applyPlanChange({
    change: { kind: 'remove_session', date: '2026-07-06' },
    visibleWeek,
    todayISO: '2026-07-06',
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout!, context),
  });
  ok('plan edit applies in test harness', result.ok === true, JSON.stringify(result));
  ok('plan edit does not reset block state',
    JSON.stringify(useProgramStore.getState().blockState) === before,
    JSON.stringify(useProgramStore.getState().blockState));
}

console.log('\n-- Generation and resolution --');

{
  const program = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  const state = liveScheduleState(PROFILE);
  state.currentProgram = program;
  state.currentMicrocycle = program.microcycles[0];
  const week4 = resolveWeekWithConditioning(addDays(program.startDate.split('T')[0], 21), state);
  ok('future week resolves its generated microcycle',
    week4.some((day) => day.source === 'template' && day.workout?.microcycleId === 'mc-ai-4'),
    week4.map((day) => `${day.date}:${day.source}:${day.workout?.microcycleId ?? '-'}`).join(' | '));
}

{
  const program = generateProgramLocally(PROFILE as OnboardingData, {
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  const inputs = onboardingToCoachingInputs(PROFILE as OnboardingData, { availabilityDateISO: '2026-07-06' });
  const plan = buildCoachingPlan(inputs);
  const expectedWeek1 = buildWorkoutsFromCoach(
    [],
    'expected-week-1',
    plan.weeklyPlan,
    PROFILE as OnboardingData,
    { miniCycleNumber: 1, weekInBlock: 1, weekStartISO: '2026-07-06' },
    getAthletePrefs(),
  );
  ok('brand-new week 1 generated workout names are unchanged',
    program.microcycles[0].workouts.map((w) => w.name).join('|') === expectedWeek1.map((w) => w.name).join('|'),
    JSON.stringify({
      actual: program.microcycles[0].workouts.map((w) => w.name),
      expected: expectedWeek1.map((w) => w.name),
    }));
  ok('brand-new week 1 remains block 1 week 1 at intensity 1.0',
    program.microcycles[0].weekNumber === 1 &&
    program.microcycles[0].miniCycleNumber === 1 &&
    program.microcycles[0].intensityMultiplier === 1.0);
}

{
  const ctx = buildProgressionContext(
    'Off-season',
    'high',
    [],
    '2026-07-27',
    [],
    {},
    [],
    null,
    [],
    null,
    {
      blockState: {
        weekInBlock: 4,
        weeksSinceDeload: 3,
        consecutiveBuildWeeks: 3,
      },
    },
  );
  ok('progression context uses block-state weeksSinceDeload',
    ctx.weeksSinceDeload === 3 && ctx.consecutiveBuildWeeks === 3,
    JSON.stringify({ weeksSinceDeload: ctx.weeksSinceDeload, consecutiveBuildWeeks: ctx.consecutiveBuildWeeks }));
}

{
  const generationSource = readFileSync('src/services/api/generateProgram.ts', 'utf8');
  ok('generation source no longer hardcodes miniCycleNumber 1',
    !/miniCycleNumber:\s*1\b/.test(generationSource));
  ok('generation source no longer hardcodes weekInBlock 1',
    !/weekInBlock:\s*1\b/.test(generationSource));
  ok('generation source no longer hardcodes weekNumber 1',
    !/weekNumber:\s*1\b/.test(generationSource));
}

console.log(`\nprogramBlockStateTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
