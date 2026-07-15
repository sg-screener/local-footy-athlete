/**
 * Fixture-conditioned availability and minimal fixture replan regressions.
 * Run: npm run test:fixture-conditioned-replan
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

import type {
  DayOfWeek,
  OnboardingData,
  TrainingProgram,
  Workout,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { rebuildLocalWeek, type WeekRebuildResult } from '../utils/weekRebuild';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import {
  resolveFixtureConditionedAvailability,
  targetWeekFixtures,
  type FixtureConditionedAvailability,
} from '../rules/fixtureConditionedAvailability';
import { compareFixtureReplanEditCost } from '../utils/fixtureMinimalReplan';
import { resolveFinalVisibleSection18Week } from '../rules/section18AcceptedWeekGateway';

const WEEK_START = '2026-03-23';
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

function profile(args: {
  tt?: 0 | 1 | 2 | 3;
  phase?: 'In-season' | 'Pre-season';
  preferred?: DayOfWeek[];
  constraints?: OnboardingData['availabilityConstraints'];
  lowReadiness?: boolean;
  withFixture?: boolean;
} = {}): OnboardingData {
  const tt = args.tt ?? 2;
  const teamDays: Record<number, DayOfWeek[]> = {
    0: [],
    1: ['Tuesday'],
    2: ['Tuesday', 'Thursday'],
    3: ['Tuesday', 'Wednesday', 'Thursday'],
  };
  const withFixture = args.withFixture ?? true;
  return {
    seasonPhase: args.phase ?? 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: args.preferred ?? [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    ],
    availabilityConstraints: args.constraints,
    teamTrainingDaysPerWeek: tt,
    teamTrainingDays: teamDays[tt],
    teamTrainingIntensity: 'Hard',
    sprintExposure: '2+ times per week',
    conditioningLevel: args.lowReadiness ? 'Poor' : 'Good',
    recentTrainingLoad: args.lowReadiness ? 'Returning after 2+ months' : 'Very consistent',
    experienceLevel: 'Advanced',
    injuries: [],
    motivation: 'Get stronger',
    usualGameDay: withFixture ? 'Saturday' : undefined,
    gameDay: withFixture ? 'Saturday' : undefined,
  };
}

function seedAcceptedWeek(args: {
  athlete: OnboardingData;
  markedDays?: Record<string, CalendarDayType>;
  activeConstraints?: ActiveConstraint[];
}): TrainingProgram {
  const markedDays = args.markedDays ?? { [SATURDAY]: 'game' };
  const activeConstraints = args.activeConstraints ?? [];
  const program = generateProgramLocally(args.athlete, {
    todayISO: WEEK_START,
    previousProgram: null,
    activeConstraints,
    readinessSignal: null,
  });
  useProfileStore.setState({ onboardingData: args.athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
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
      markedDays,
      readinessSignalsByDate: {},
      activeConstraints,
      activeInjury: null,
      revision: 1,
      lastTransaction: 'fixture-test:seed',
    },
  });
  return program;
}

function removeSaturdayGame(athlete: OnboardingData): {
  before: TrainingProgram;
  result: WeekRebuildResult;
} {
  const before = seedAcceptedWeek({ athlete });
  const result = rebuildLocalWeek({
    baseProfile: athlete,
    newGameDay: null,
    scope: 'weekOverlay',
    targetDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK_START,
  });
  assert(result.fixtureReplan, 'fixture replan diagnostics missing');
  return { before, result };
}

function overlayByDay(result: WeekRebuildResult): Map<number, Workout> {
  assert(result.overlay, 'week overlay missing');
  const map = new Map<number, Workout>();
  for (const workout of Object.values(result.overlay.workoutsByDate)) {
    if (workout) map.set(workout.dayOfWeek, workout);
  }
  return map;
}

function exerciseSignature(workout: Workout | undefined): string {
  return JSON.stringify((workout?.exercises ?? []).map((row) => ({
    name: row.exercise?.name,
    sets: row.prescribedSets,
    min: row.prescribedRepsMin,
    max: row.prescribedRepsMax,
    rest: row.restSeconds,
  })));
}

function storedWorkout(program: TrainingProgram, day: number): Workout | undefined {
  return program.microcycles[0]?.workouts.find((workout) => workout.dayOfWeek === day);
}

function visibleStoredWeek(program: TrainingProgram, athlete: OnboardingData): Map<number, Workout> {
  const microcycle = program.microcycles[0]!;
  const contract = microcycle.exposureContractV2!;
  return new Map(resolveFinalVisibleSection18Week({
    contract,
    workouts: microcycle.workouts,
    weekStart: WEEK_START,
    profile: athlete,
    scheduleState: { markedDays: { [SATURDAY]: 'game' } },
  }).map((workout) => [workout.dayOfWeek, workout]));
}

function resolveAvailability(args: {
  athlete: OnboardingData;
  prior?: Record<string, CalendarDayType>;
  proposed?: Record<string, CalendarDayType>;
  bye?: boolean;
}): FixtureConditionedAvailability {
  const priorFixtures = targetWeekFixtures({
    profile: args.athlete,
    weekStart: WEEK_START,
    markedDays: args.prior,
  });
  const proposedFixtures = targetWeekFixtures({
    profile: args.athlete,
    weekStart: WEEK_START,
    markedDays: args.proposed,
  });
  return resolveFixtureConditionedAvailability({
    profile: args.athlete,
    weekStart: WEEK_START,
    priorFixtures,
    proposedFixtures,
    proposedMarkedDays: args.proposed,
    byeUsualGameDay: args.bye,
  });
}

async function main(): Promise<void> {
  let exact: ReturnType<typeof removeSaturdayGame> | null = null;

  await run('1 exact 2TT Saturday-game removal preserves core and adds Saturday hard conditioning', () => {
    exact = removeSaturdayGame(profile());
    const after = overlayByDay(exact.result);
    assert(after.get(1)?.name === 'Lower Body Strength', `Monday=${after.get(1)?.name}`);
    assert(/Upper Pull/i.test(after.get(2)?.name ?? ''), `Tuesday=${after.get(2)?.name}`);
    assert(/Upper Push/i.test(after.get(4)?.name ?? ''), `Thursday=${after.get(4)?.name}`);
    assert(after.get(5)?.sessionTier === 'optional', `Friday=${after.get(5)?.name}; before=${JSON.stringify(exact.before.microcycles[0]?.workouts.map((workout) => [DAY_NAMES[workout.dayOfWeek], workout.name, workout.sessionTier]))}; after=${JSON.stringify(Array.from(after.entries()).map(([day, workout]) => [DAY_NAMES[day], workout.name, workout.sessionTier]))}; repairs=${JSON.stringify(exact.result.fixtureReplan?.gateway.repairs)}`);
    assert(after.get(6)?.name === 'Hard Conditioning', `Saturday=${after.get(6)?.name}; week=${JSON.stringify(Array.from(after.entries()).map(([day, workout]) => [DAY_NAMES[day], workout.name, workout.sessionTier]))}; repairs=${JSON.stringify(exact.result.fixtureReplan?.gateway.repairs)}`);
    assert((!after.has(3) || after.get(3)?.workoutType === 'Rest') && !after.has(0),
      'Wednesday/Sunday should remain full rest');
    assert(!Array.from(after.values()).some((workout) => /Lower Squat/i.test(workout.name)),
      'duplicate Lower Squat was added');
    assert(exact.result.fixtureReplan?.path === 'minimal_repair', 'full regeneration was used');
  });

  await run('2 0TT game removal uses released Saturday for the third app conditioning exposure', () => {
    const { result } = removeSaturdayGame(profile({ tt: 0 }));
    const after = overlayByDay(result);
    assert(result.fixtureReplan?.gateway.evaluation.ledger.conditioning.credits.some((credit) =>
      credit.source === 'app' && credit.dayOfWeek === 6 && credit.stress === 'hard'),
    `Saturday hard missing; week=${JSON.stringify(Array.from(after.entries()).map(([day, workout]) => [DAY_NAMES[day], workout.name, workout.sessionTier]))}; rejected=${JSON.stringify(result.fixtureReplan?.rejectedCandidateSignatures)}`);
    assert(result.fixtureReplan?.gateway.evaluation.ledger.conditioning.coreCount === 3,
      '0TT bye did not reach C3');
  });

  await run('3 1TT game removal uses released Saturday and reaches C3', () => {
    const { result } = removeSaturdayGame(profile({ tt: 1 }));
    assert(result.fixtureReplan?.gateway.evaluation.ledger.conditioning.credits.some((credit) =>
      credit.source === 'app' && credit.dayOfWeek === 6 && credit.stress === 'hard'),
    `Saturday hard missing; week=${JSON.stringify(Array.from(overlayByDay(result).entries()).map(([day, workout]) => [DAY_NAMES[day], workout.name, workout.sessionTier]))}; repairs=${JSON.stringify(result.fixtureReplan?.gateway.repairs)}; rejected=${JSON.stringify(result.fixtureReplan?.rejectedCandidateSignatures)}`);
    assert(result.fixtureReplan?.gateway.evaluation.ledger.conditioning.coreCount === 3,
      '1TT bye did not reach C3');
  });

  await run('4 2TT game removal preserves S3 and adds exactly one app conditioning exposure', () => {
    const { result } = removeSaturdayGame(profile({ tt: 2 }));
    const ledger = result.fixtureReplan!.gateway.evaluation.ledger;
    assert(ledger.mainStrength.achievedCount === 3, `S=${ledger.mainStrength.achievedCount}`);
    assert(ledger.conditioning.appCoreCount === 1, `appC=${ledger.conditioning.appCoreCount}`);
  });

  await run('5 3TT game removal does not invent a fourth conditioning exposure', () => {
    const { result } = removeSaturdayGame(profile({ tt: 3 }));
    const ledger = result.fixtureReplan!.gateway.evaluation.ledger;
    assert(ledger.conditioning.coreCount === 3, `C=${ledger.conditioning.coreCount}`);
    assert(ledger.conditioning.appCoreCount === 0, `appC=${ledger.conditioning.appCoreCount}`);
  });

  await run('6 explicit Saturday unavailability blocks the released day', () => {
    const athlete = profile({
      constraints: [{
        id: 'sat-unavailable',
        kind: 'unavailable_day',
        scope: 'permanent',
        dayOfWeek: 'Saturday',
        active: true,
      }],
    });
    const { result } = removeSaturdayGame(athlete);
    assert(!result.fixtureReplan!.availability.effectiveAvailableDayNumbers.includes(6),
      'Saturday remained effectively available');
    assert(overlayByDay(result).get(6)?.name !== 'Hard Conditioning',
      'blocked Saturday received hard conditioning');
  });

  await run('7 explicit Saturday availability remains available after fixture release', () => {
    const athlete = profile({ preferred: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ] });
    const { result } = removeSaturdayGame(athlete);
    assert(result.fixtureReplan!.availability.effectiveAvailableDayNumbers.includes(6),
      'Saturday was not available');
    assert(overlayByDay(result).get(6)?.name === 'Hard Conditioning', 'Saturday hard missing');
  });

  await run('8 fixture-only five-day capacity expands to six without mutating preferences', () => {
    const athlete = profile();
    const before = resolveAvailability({ athlete, prior: { [SATURDAY]: 'game' }, proposed: { [SATURDAY]: 'game' } });
    const after = resolveAvailability({
      athlete,
      prior: { [SATURDAY]: 'game' },
      proposed: { [SATURDAY]: 'noGame' },
      bye: true,
    });
    assert(before.effectiveWeeklyTrainingCapacity === 5, `before=${before.effectiveWeeklyTrainingCapacity}`);
    assert(after.effectiveWeeklyTrainingCapacity === 6, `after=${after.effectiveWeeklyTrainingCapacity}`);
    assert(JSON.stringify(athlete.preferredTrainingDays) === JSON.stringify([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    ]), 'stored preferences mutated');
    assert(athlete.trainingDaysPerWeek === 5, 'stored trainingDaysPerWeek mutated');
  });

  await run('9 explicit Saturday rest/commitment outranks bye release', () => {
    const athlete = profile();
    const resolution = resolveFixtureConditionedAvailability({
      profile: athlete,
      weekStart: WEEK_START,
      priorFixtures: [{ date: SATURDAY, kind: 'game' }],
      proposedFixtures: [],
      proposedMarkedDays: { [SATURDAY]: 'rest' },
      byeUsualGameDay: true,
    });
    const saturday = resolution.days.find((day) => day.dayNumber === 6)!;
    assert(!saturday.available, 'Saturday rest became available');
    assert(saturday.blockedBy.includes('calendar_rest_commitment'), 'rest provenance missing');
  });

  await run('10 adding a game to a bye removes conflicting Saturday work minimally', () => {
    const athlete = profile();
    removeSaturdayGame(athlete);
    const result = rebuildLocalWeek({
      baseProfile: athlete,
      newGameDay: 'Saturday',
      scope: 'weekOverlay',
      targetDate: SATURDAY,
      manageCalendarFixture: true,
      todayISO: WEEK_START,
    });
    assert(result.fixtureReplan?.path === 'minimal_repair', 'add-game regenerated full week');
    assert(!overlayByDay(result).has(6), 'app work remained on occupied Saturday');
    assert(useCalendarStore.getState().markedDays[SATURDAY] === 'game', 'Saturday game mark missing');
  });

  await run('11 moving Saturday game to Sunday releases Saturday and occupies Sunday atomically', () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const result = rebuildLocalWeek({
      baseProfile: athlete,
      newGameDay: 'Sunday',
      scope: 'weekOverlay',
      targetDate: SUNDAY,
      clearOverlayDate: SATURDAY,
      manageCalendarFixture: true,
      todayISO: WEEK_START,
    });
    const marks = useCalendarStore.getState().markedDays;
    assert(marks[SATURDAY] === undefined && marks[SUNDAY] === 'game', JSON.stringify(marks));
    assert(result.fixtureReplan?.availability.releasedFixtures.some((fixture) => fixture.date === SATURDAY),
      'old fixture day not released');
    assert(result.fixtureReplan?.availability.proposedFixtures.some((fixture) => fixture.date === SUNDAY),
      'new fixture day not occupied');
  });

  await run('12 removing a practice match uses released-practice-match provenance', () => {
    const athlete = profile({ phase: 'Pre-season' });
    const { result } = removeSaturdayGame(athlete);
    assert(result.fixtureReplan?.availability.releasedFixtures.some((fixture) =>
      fixture.provenance === 'released_practice_match_day'), 'practice release provenance missing');
    assert(result.fixtureReplan?.path === 'minimal_repair', 'practice removal regenerated full week');
  });

  await run('13 adding a practice match occupies Saturday and removes surplus app conditioning first', () => {
    const athlete = profile({ phase: 'Pre-season' });
    removeSaturdayGame(athlete);
    const result = rebuildLocalWeek({
      baseProfile: athlete,
      newGameDay: 'Saturday',
      scope: 'weekOverlay',
      targetDate: SATURDAY,
      manageCalendarFixture: true,
      todayISO: WEEK_START,
    });
    assert(result.fixtureReplan?.path === 'minimal_repair', 'practice add regenerated full week');
    assert(!overlayByDay(result).has(6), 'app work remained on practice-match day');
    assert(result.fixtureReplan?.gateway.evaluation.ledger.conditioning.coreCount === 3,
      'practice-match contract did not resolve to C3');
  });

  await run('14 healthy bye build chooses the released fixture day for hard replacement load', () => {
    const { result } = removeSaturdayGame(profile());
    const saturday = result.fixtureReplan!.availability.days.find((day) => day.dayNumber === 6)!;
    assert(saturday.provenance.some((value) => value === 'released_game_day' || value === 'bye_usual_game_day'),
      'Saturday release provenance missing');
    assert(overlayByDay(result).get(6)?.intensity === 'High', 'Saturday replacement is not hard');
  });

  await run('15 bye recovery never automatically receives hard Saturday conditioning', () => {
    const athlete = profile({ lowReadiness: true });
    const { result } = removeSaturdayGame(athlete);
    assert(result.fixtureReplan!.gateway.contract.identity.mode === 'in_season_bye_recovery',
      `mode=${result.fixtureReplan!.gateway.contract.identity.mode}`);
    assert(overlayByDay(result).get(6)?.name !== 'Hard Conditioning',
      'bye recovery received hard Saturday conditioning');
  });

  await run('16 existing valid S3 and pattern balance remain intact', () => {
    const { result } = removeSaturdayGame(profile());
    const ledger = result.fixtureReplan!.gateway.evaluation.ledger;
    assert(ledger.mainStrength.achievedCount === 3, `S=${ledger.mainStrength.achievedCount}`);
    assert(JSON.stringify(ledger.strengthPatterns.meaningfulMainLiftCount) === JSON.stringify({
      squat: 1, hinge: 1, push: 1, pull: 1,
    }), JSON.stringify(ledger.strengthPatterns.meaningfulMainLiftCount));
  });

  await run('17 optional Gunshow survives before any valid core strength is rewritten', () => {
    const { result } = removeSaturdayGame(profile());
    const after = overlayByDay(result);
    assert(after.get(5)?.name === 'Gunshow' && after.get(5)?.sessionTier === 'optional',
      `Friday=${after.get(5)?.name}`);
    assert(result.fixtureReplan!.editCost.changedCoreSessions === 0,
      `${JSON.stringify(result.fixtureReplan!.editCost)}; changed=${JSON.stringify(result.fixtureReplan!.changedDays)}; repairs=${JSON.stringify(result.fixtureReplan!.gateway.repairs)}`);
  });

  await run('18 unaffected planEntryIds and prescriptions remain stable', () => {
    const athlete = profile();
    const { before, result } = removeSaturdayGame(athlete);
    const visibleBefore = visibleStoredWeek(before, athlete);
    const after = overlayByDay(result);
    for (const day of [1, 2, 4]) {
      const source = visibleBefore.get(day)!;
      assert(after.get(day)?.planEntryId === source.planEntryId,
        `${DAY_NAMES[day]} planEntryId changed`);
      assert(exerciseSignature(after.get(day)) === exerciseSignature(source),
        `${DAY_NAMES[day]} prescription changed before=${exerciseSignature(source)} after=${exerciseSignature(after.get(day))}; safety=${JSON.stringify(result.fixtureReplan?.gateway.contract.safety)}`);
    }
  });

  await run('19 deterministic edit-cost prefers the released-day candidate', () => {
    const base = {
      section18Blockers: 0,
      unavailableDayUses: 0,
      changedCoreSessions: 0,
      changedDays: 2,
      changedPlanEntryIdsOrPrescriptions: 1,
      patternImbalance: 0,
      restDeficit: 0,
      duplicateStrengthPatternPenalty: 0,
      excessiveActiveStreak: 0,
      optionalBeforeCoreViolation: 0,
    };
    assert(compareFixtureReplanEditCost(
      { ...base, releasedFixtureDayPenalty: 0 },
      { ...base, releasedFixtureDayPenalty: 1 },
    ) < 0, 'released-day candidate did not win');
  });

  await run('20 full regeneration remains a fallback and is not used for the valid reproduction', () => {
    const { result } = removeSaturdayGame(profile());
    assert(result.fixtureReplan?.usedFullRegeneration === false, 'valid week fully regenerated');
    assert(result.fixtureReplan?.gateway.evaluation.blockingViolations.length === 0,
      'minimal candidate was not gateway-valid');
  });

  await run('21 generation, calendar, rebuild, Repeat Week, rollover and hydration share the resolver', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const sources = {
      generation: fs.readFileSync(`${__dirname}/../utils/coachingEngine.ts`, 'utf8'),
      calendar: fs.readFileSync(`${__dirname}/../store/acceptedStateTransaction.ts`, 'utf8'),
      rebuild: fs.readFileSync(`${__dirname}/../utils/weekRebuild.ts`, 'utf8'),
      repeat: fs.readFileSync(`${__dirname}/../utils/repeatWeek.ts`, 'utf8'),
      rollover: fs.readFileSync(`${__dirname}/../utils/programBlockRollover.ts`, 'utf8'),
      hydration: fs.readFileSync(`${__dirname}/../rules/section18AcceptedWeekGateway.ts`, 'utf8'),
    };
    assert(/resolveProfileTargetWeekAvailability/.test(sources.generation), 'generation owner missing');
    assert(/resolveFixtureConditionedAvailability/.test(sources.calendar), 'calendar owner missing');
    assert(/resolveProfileTargetWeekAvailability/.test(sources.rebuild), 'rebuild owner missing');
    assert(/resolveProfileTargetWeekAvailability/.test(sources.repeat), 'Repeat Week owner missing');
    assert(/rebuildLocalWeek/.test(sources.rollover), 'rollover does not reuse rebuild owner');
    assert(/resolveProfileTargetWeekAvailability/.test(sources.hydration), 'gateway/hydration owner missing');
  });

  await run('properties fixture availability is monotonic and stored preferences are immutable', () => {
    for (const tt of [0, 1, 2, 3] as const) {
      const athlete = profile({ tt });
      const snapshot = JSON.stringify({
        preferred: athlete.preferredTrainingDays,
        capacity: athlete.trainingDaysPerWeek,
      });
      const before = resolveAvailability({
        athlete,
        prior: { [SATURDAY]: 'game' },
        proposed: { [SATURDAY]: 'game' },
      });
      const after = resolveAvailability({
        athlete,
        prior: { [SATURDAY]: 'game' },
        proposed: { [SATURDAY]: 'noGame' },
        bye: true,
      });
      assert(after.effectiveWeeklyTrainingCapacity >= before.effectiveWeeklyTrainingCapacity,
        `removal decreased availability for ${tt}TT`);
      assert(JSON.stringify({
        preferred: athlete.preferredTrainingDays,
        capacity: athlete.trainingDaysPerWeek,
      }) === snapshot, `stored preferences mutated for ${tt}TT`);
      const readded = resolveFixtureConditionedAvailability({
        profile: athlete,
        weekStart: WEEK_START,
        priorFixtures: [],
        proposedFixtures: [{ date: SATURDAY, kind: 'game' }],
      });
      assert(readded.effectiveWeeklyTrainingCapacity <= after.effectiveWeeklyTrainingCapacity,
        `adding fixture increased availability for ${tt}TT`);
    }
  });

  await run('properties unaffected core survives and optional work is cheaper than core work', () => {
    const { before, result } = removeSaturdayGame(profile());
    const after = overlayByDay(result);
    for (const day of [1, 2, 4]) {
      assert(after.get(day)?.planEntryId === storedWorkout(before, day)?.planEntryId,
        `core identity changed on ${DAY_NAMES[day]}`);
    }
    const base = result.fixtureReplan!.editCost;
    assert(compareFixtureReplanEditCost(
      { ...base, changedCoreSessions: 0, optionalBeforeCoreViolation: 0 },
      { ...base, changedCoreSessions: 1, optionalBeforeCoreViolation: 1 },
    ) < 0, 'optional-before-core cost ordering failed');
  });

  await run('properties fixture movement releases one date and occupies one date atomically', () => {
    const athlete = profile();
    const resolution = resolveFixtureConditionedAvailability({
      profile: athlete,
      weekStart: WEEK_START,
      priorFixtures: [{ date: SATURDAY, kind: 'game' }],
      proposedFixtures: [{ date: SUNDAY, kind: 'game' }],
    });
    assert(resolution.releasedFixtures.length === 1 &&
      resolution.releasedFixtures[0].date === SATURDAY, 'old date not released once');
    assert(resolution.proposedFixtures.length === 1 &&
      resolution.proposedFixtures[0].date === SUNDAY, 'new date not occupied once');
  });

  await run('properties a released fixture day is available unless an explicit blocker applies', () => {
    const athlete = profile();
    const open = resolveFixtureConditionedAvailability({
      profile: athlete,
      weekStart: WEEK_START,
      priorFixtures: [{ date: SATURDAY, kind: 'game' }],
      proposedFixtures: [],
    });
    const blocked = resolveFixtureConditionedAvailability({
      profile: athlete,
      weekStart: WEEK_START,
      priorFixtures: [{ date: SATURDAY, kind: 'game' }],
      proposedFixtures: [],
      proposedMarkedDays: { [SATURDAY]: 'rest' },
    });
    assert(open.days.find((day) => day.dayNumber === 6)?.available === true,
      'unblocked released Saturday was unavailable');
    assert(blocked.days.find((day) => day.dayNumber === 6)?.available === false,
      'explicitly blocked released Saturday was available');
  });

  await run('mutations required fixture/replan defects are killed', () => {
    assert(exact, 'exact witness unavailable');
    const after = overlayByDay(exact.result);
    const availability = exact.result.fixtureReplan!.availability;
    const byeRecovery = removeSaturdayGame(profile({ lowReadiness: true }));
    const mutantChecks = [
      !availability.effectiveAvailableDayNumbers.includes(6),
      availability.effectiveWeeklyTrainingCapacity === 5,
      exact.result.fixtureReplan!.usedFullRegeneration,
      !exact.result.fixtureReplan!.preservedCorePlanEntryIds.includes('w1:tuesday:none:team'),
      /Upper Body Strength/.test(after.get(2)?.name ?? ''),
      Array.from(after.values()).some((workout) => /Lower Squat/i.test(workout.name)),
      after.get(6)?.name !== 'Hard Conditioning',
      exact.result.fixtureReplan!.editCost.changedCoreSessions > 0 && after.get(5)?.name === 'Gunshow',
      overlayByDay(byeRecovery.result).get(6)?.name === 'Hard Conditioning',
    ];
    assert(mutantChecks.every((mutantSurvives) => mutantSurvives === false),
      `surviving mutants=${mutantChecks.map((value, index) => value ? index + 1 : null).filter(Boolean)}`);
  });

  console.log(`\nFixture-conditioned replan totals: passed=${passed}/26 failures=${failures.length}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
