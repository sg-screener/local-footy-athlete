/**
 * ATHLETE PLACEMENT OWNERSHIP — every athlete door, one ingress, one stamp.
 *
 * Sam's rulings (2026-07-30), closing the device-pass finding that a swap onto
 * the G-1 day reported "Done." and changed nothing:
 *
 *   (4) Ownership is a property of PUBLISHED content, stamped at the ONE ingress
 *       for every athlete door — move, swap, add — never re-derived. The
 *       resolver reads the stamp; applyGameProximity consults it, never
 *       re-decides.
 *   (5) The explicit-vs-virtual fixture branch DIES. Storage form never decides
 *       who owns the day before a game. G-1 behaves identically for a usual
 *       game day and an explicit practice match.
 *   (6) A stage that applied nothing reports the no-change outcome with its
 *       reason. Done-copy is a projection of the accepted RESULT, never the
 *       request.
 *
 * WHY THIS SUITE ASSERTS THROUGH THE LIVE RESOLVER.
 *
 * `g1MoveAskFlowTests` asserts through `rebaseAcceptedEffectiveWeek` — the
 * accepted-week projection. That projection does NOT run `applyGameProximity`
 * against live schedule state, so it cannot see the layer that ate the swap.
 * Every survival assertion here therefore reads `resolveWeekWithConditioning`,
 * which is what the athlete's screen renders.
 *
 * Run: npm run test:placement-ownership
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
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — placement ownership must be local');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { isAthletePlacedSession } from '../rules/athletePlacement';
import { isResolverOwnedDerivedSession } from '../rules/derivedSessionProvenance';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyPlanChange } from '../utils/planChangeProducer';
import type { PlanChange } from '../utils/planChangeTypes';

const CURRENT_WEEK = '2026-07-13';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  const debug = console.debug;
  console.warn = () => undefined;
  console.error = () => undefined;
  console.debug = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
    console.debug = debug;
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
    teamTrainingIntensity: 'Hard',
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

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seed(): string {
  const athlete = profile();
  const program: TrainingProgram = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: CURRENT_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  }));
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'placement-ownership-test:seed',
      injuryEpisodes: [],
      temporarySourceFacts: [],
      acceptedCompositionBase: null,
      acceptedProfileSnapshot: null,
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
  // The SECOND microcycle is a settled in-season week: Mon strength, Tue/Thu
  // team nights, Fri derived Gunshow (G-1), Sat game, Sun G+1 recovery.
  return program.microcycles[1]!.startDate.slice(0, 10);
}

/**
 * Sam's practice match: an EXPLICIT calendar fixture, as opposed to the virtual
 * game the profile's usual game day produces. Under ruling (5) the two must be
 * indistinguishable to everything downstream.
 */
function markExplicitFixture(weekStart: string): void {
  const saturday = addDaysISO(weekStart, 5);
  const state = useProgramStore.getState();
  const markedDays = {
    ...state.acceptedMaterialContext.markedDays,
    [saturday]: 'game' as const,
  };
  useProgramStore.setState({
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      markedDays,
      revision: state.acceptedMaterialContext.revision + 1,
    },
  } as never);
  useCalendarStore.setState({ markedDays } as never);
}

/** Replace the week's Friday with the canonical empty-rest stub, so the ADD
 *  door has a G-1 day to land on. A rest stub keeps the derived Gunshow off the
 *  day without a calendar mark, so proximity still runs once content arrives. */
function restStubOnFriday(weekStart: string): void {
  const state = useProgramStore.getState() as unknown as {
    currentProgram: TrainingProgram;
    currentMicrocycle: TrainingProgram['microcycles'][number] | null;
  };
  const stubFor = (microcycleId: string): Workout => ({
    id: `${microcycleId}:friday:rest-stub`,
    microcycleId,
    dayOfWeek: 5,
    name: 'Rest',
    description: '',
    durationMinutes: 0,
    intensity: 'Low',
    workoutType: 'Rest',
    sessionTier: 'recovery',
    exercises: [],
    createdAt: '',
    updatedAt: '',
  } as unknown as Workout);
  const patch = <T extends { id: string; startDate: string; workouts: Workout[] }>(
    microcycle: T | null,
  ): T | null =>
    microcycle && microcycle.startDate.slice(0, 10) === weekStart
      ? {
          ...microcycle,
          workouts: microcycle.workouts
            .filter((workout) => workout.dayOfWeek !== 5)
            .concat([stubFor(microcycle.id)]),
        }
      : microcycle;
  useProgramStore.setState({
    currentProgram: {
      ...state.currentProgram,
      microcycles: state.currentProgram.microcycles.map(
        (microcycle) => patch(microcycle as never) as never,
      ),
    },
    currentMicrocycle: patch(state.currentMicrocycle as never) as never,
  } as never);
}

/** Replace the week's Friday with an engine-planned PROTECTED CORE exposure —
 *  the case ruling (5) is about: nothing the athlete touched, so G-1 ownership
 *  must not depend on how the fixture happens to be stored. */
function protectedCoreOnFriday(weekStart: string): Workout {
  const state = useProgramStore.getState() as unknown as {
    currentProgram: TrainingProgram;
    currentMicrocycle: TrainingProgram['microcycles'][number] | null;
  };
  const monday = state.currentProgram.microcycles
    .find((microcycle) => microcycle.startDate.slice(0, 10) === weekStart)
    ?.workouts.find((workout) => workout.dayOfWeek === 1);
  assert(monday, 'seed no longer has a Monday core session to clone');
  const planted: Workout = {
    ...JSON.parse(JSON.stringify(monday)) as Workout,
    id: `${monday.id}:planted-friday`,
    planEntryId: undefined,
    dayOfWeek: 5,
  };
  const patch = <T extends { startDate: string; workouts: Workout[] }>(
    microcycle: T | null,
  ): T | null =>
    microcycle && microcycle.startDate.slice(0, 10) === weekStart
      ? {
          ...microcycle,
          workouts: microcycle.workouts
            .filter((workout) => workout.dayOfWeek !== 5)
            .concat([planted]),
        }
      : microcycle;
  useProgramStore.setState({
    currentProgram: {
      ...state.currentProgram,
      microcycles: state.currentProgram.microcycles.map(
        (microcycle) => patch(microcycle as never) as never,
      ),
    },
    currentMicrocycle: patch(state.currentMicrocycle as never) as never,
  } as never);
  return planted;
}

function visibleWeek(weekStart: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
}

function visibleFriday(weekStart: string): ResolvedDay | undefined {
  const friday = addDaysISO(weekStart, 4);
  return visibleWeek(weekStart).find((day) => day.date === friday);
}

function commit(weekStart: string, change: PlanChange) {
  return quiet(() => applyPlanChange({
    change,
    visibleWeek: visibleWeek(weekStart),
    todayISO: weekStart,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));
}

function describe(day: ResolvedDay | undefined): string {
  const workout = day?.workout;
  if (!workout) return `REST (source=${day?.source ?? 'none'})`;
  return `"${workout.name}" (source=${day?.source}, placed=${isAthletePlacedSession(workout)})`;
}

const FIXTURE_KINDS: Array<{ name: string; explicit: boolean }> = [
  { name: 'virtual game day', explicit: false },
  { name: 'explicit practice match', explicit: true },
];

console.log('\n-- Athlete placement ownership --');

// ── Ruling (4): every athlete door stamps at the one ingress ──────────────

for (const fixture of FIXTURE_KINDS) {
  run(`SWAP onto G-1 survives the resolver (${fixture.name})`, () => {
    const weekStart = seed();
    if (fixture.explicit) markExplicitFixture(weekStart);
    const friday = addDaysISO(weekStart, 4);
    const before = visibleFriday(weekStart);
    assert(before?.workout && isResolverOwnedDerivedSession(before.workout),
      `this seed no longer puts a derived filler on G-1: ${describe(before)}`);

    // Conditioning, deliberately: it is NOT a protected core exposure, so only
    // the placement stamp can keep it. A strength swap would also be saved by
    // the protected-core guard and the assertion could pass for the wrong reason.
    const result = commit(weekStart, {
      kind: 'swap_category', date: friday, category: 'conditioning_light',
    });
    assert(result.ok, `swap refused: ${result.message}`);

    const after = visibleFriday(weekStart);
    assert(after?.workout, `G-1 is empty after the swap: ${describe(after)}`);
    assert(!isResolverOwnedDerivedSession(after.workout),
      `the derived filler regenerated over the athlete's swap: ${describe(after)}`);
    assert(isAthletePlacedSession(after.workout),
      `the swapped session reached the visible week unstamped: ${describe(after)}`);
    assert(/flush|aerobic|bike|row|ski|conditioning/i.test(after.workout.name),
      `G-1 holds ${describe(after)}, not the conditioning the athlete picked`);
  });

  run(`ADD onto an empty G-1 survives the resolver (${fixture.name})`, () => {
    const weekStart = seed();
    restStubOnFriday(weekStart);
    if (fixture.explicit) markExplicitFixture(weekStart);
    const friday = addDaysISO(weekStart, 4);
    assert(!visibleFriday(weekStart)?.workout,
      `the rest stub did not leave G-1 empty: ${describe(visibleFriday(weekStart))}`);

    const result = commit(weekStart, {
      kind: 'add_category', date: friday, category: 'conditioning_light',
    });
    assert(result.ok, `add refused: ${result.message}`);

    const after = visibleFriday(weekStart);
    assert(after?.workout, `G-1 is empty after the add: ${describe(after)}`);
    assert(!isResolverOwnedDerivedSession(after.workout),
      `the derived filler regenerated over the athlete's add: ${describe(after)}`);
    assert(isAthletePlacedSession(after.workout),
      `the added session reached the visible week unstamped: ${describe(after)}`);
  });

  run(`MOVE onto G-1 survives the resolver (${fixture.name})`, () => {
    const weekStart = seed();
    if (fixture.explicit) markExplicitFixture(weekStart);
    const monday = addDaysISO(weekStart, 0);
    const friday = addDaysISO(weekStart, 4);
    const source = visibleWeek(weekStart).find((day) => day.date === monday)?.workout;
    assert(source, 'seeded Monday session missing');
    const sourceName = source.name;

    const result = commit(weekStart, {
      kind: 'move_session', fromDate: monday, toDate: friday, g1Route: 'deloaded',
    });
    assert(result.ok, `move refused: ${result.message}`);

    const after = visibleFriday(weekStart);
    assert(after?.workout, `G-1 is empty after the move: ${describe(after)}`);
    assert(isAthletePlacedSession(after.workout),
      `the moved session reached the visible week unstamped: ${describe(after)}`);
    assert(after.workout.name.includes(sourceName.split(' ')[0]!),
      `G-1 holds ${describe(after)}, not the athlete's ${sourceName}`);
  });
}

// ── Ruling (5): storage form never decides who owns G-1 ───────────────────

run('an untouched engine-planned core exposure on G-1 is treated identically by both fixture kinds', () => {
  const outcomes = FIXTURE_KINDS.map((fixture) => {
    const weekStart = seed();
    const planted = protectedCoreOnFriday(weekStart);
    if (fixture.explicit) markExplicitFixture(weekStart);
    const after = visibleFriday(weekStart);
    return {
      fixture: fixture.name,
      planted: planted.name,
      name: after?.workout?.name ?? null,
      derived: after?.workout ? isResolverOwnedDerivedSession(after.workout) : null,
    };
  });
  assert(outcomes[0]!.name === outcomes[1]!.name && outcomes[0]!.derived === outcomes[1]!.derived,
    `G-1 ownership still depends on how the fixture is stored: ${JSON.stringify(outcomes)}`);
  // Non-vacuous, and the direction matters: the ask-flow is the ONLY door onto
  // G-1, so work the ATHLETE did not place there does not hold the day —
  // whatever its name or tier. The displaced exposure is §18's to relocate.
  assert(outcomes.every((outcome) => outcome.derived === true),
    `an engine-planned session held G-1 without the athlete placing it: ${JSON.stringify(outcomes)}`);
  assert(outcomes[0]!.name !== outcomes[0]!.planted,
    `the planted core exposure was not displaced: ${JSON.stringify(outcomes)}`);
});

// ── Non-vacuity: the stamp means "the athlete put this here" ──────────────

run('an untouched G-1 still belongs to the derived filler, unstamped', () => {
  const weekStart = seed();
  markExplicitFixture(weekStart);
  const friday = visibleFriday(weekStart);
  assert(friday?.workout && isResolverOwnedDerivedSession(friday.workout),
    `G-1 is owned by ${describe(friday)}, not the derived game-proximity filler`);
  assert(!isAthletePlacedSession(friday.workout),
    'an untouched derived filler was reported as athlete-placed');
});

run('days the athlete never touched are never stamped', () => {
  const weekStart = seed();
  const friday = addDaysISO(weekStart, 4);
  commit(weekStart, { kind: 'swap_category', date: friday, category: 'conditioning_light' });
  const tuesday = visibleWeek(weekStart).find((day) => day.date === addDaysISO(weekStart, 1));
  assert(tuesday?.workout && !isAthletePlacedSession(tuesday.workout),
    `an untouched session was stamped as athlete-placed: ${describe(tuesday)}`);
});

// ── Ruling (6): a stage that applied nothing never reports "Done" ─────────

run('a repeated identical swap reports no-change, not success', () => {
  const weekStart = seed();
  markExplicitFixture(weekStart);
  const friday = addDaysISO(weekStart, 4);
  const first = commit(weekStart, {
    kind: 'swap_category', date: friday, category: 'conditioning_light',
  });
  assert(first.ok, `first swap refused: ${first.message}`);
  const landed = visibleFriday(weekStart)?.workout?.name ?? null;

  const second = commit(weekStart, {
    kind: 'swap_category', date: friday, category: 'conditioning_light',
  });
  assert(!/^Done\./.test(second.message),
    `a swap that applied nothing still reported success: "${second.message}"`);
  assert(visibleFriday(weekStart)?.workout?.name === landed,
    'the repeated swap changed the day it claimed not to change');
});

run('a DIFFERENT swap on an already-swapped day never claims a session it did not place', () => {
  const weekStart = seed();
  markExplicitFixture(weekStart);
  const friday = addDaysISO(weekStart, 4);
  commit(weekStart, { kind: 'swap_category', date: friday, category: 'conditioning_light' });

  const second = commit(weekStart, {
    kind: 'swap_category', date: friday, category: 'strength_lower',
  });
  const rendered = visibleFriday(weekStart)?.workout?.name ?? 'REST';
  // Either the second swap really applied — in which case the day shows it —
  // or it did not, in which case the copy must not name it. What is forbidden
  // is the device symptom: "Done. Lower Body Strength is now on <date>" over a
  // day that holds something else entirely.
  if (/^Done\./.test(second.message)) {
    assert(second.message.includes(rendered),
      `copy claims a session the day does not hold: "${second.message}" over "${rendered}"`);
  }
});

console.log(`\nAthlete placement ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
