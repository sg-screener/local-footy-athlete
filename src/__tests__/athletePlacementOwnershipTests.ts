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
 * `g1LandingAskFlowTests` asserts through `rebaseAcceptedEffectiveWeek` — the
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
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { G1_LANDING_WARNING } from '../rules/g1LandingAsk';
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

/**
 * INVERTED, 2026-07-30. These six read "content the athlete put on G-1 survives
 * the resolver", and they still do — but only AFTER the athlete has answered.
 *
 * The first version let a routeless swap and a routeless add land a full
 * session on the day before a game and then checked that it survived. It did
 * survive: the stamp worked. What it also did was put hard work on G-1 without
 * a word, which is the thing Sam's ask exists to stop, and the suite was
 * pinning it as correct behaviour. Each door now proves both halves:
 *
 *   ROUTELESS  → refused, in the ask's own words, with nothing applied.
 *   ROUTED     → the athlete's content survives the live resolver.
 *
 * The routed half is the original assertion, unchanged in what it proves.
 */
for (const fixture of FIXTURE_KINDS) {
  run(`SWAP onto G-1 is refused until the athlete answers (${fixture.name})`, () => {
    const weekStart = seed();
    if (fixture.explicit) markExplicitFixture(weekStart);
    const friday = addDaysISO(weekStart, 4);
    const before = visibleFriday(weekStart);
    assert(before?.workout && isResolverOwnedDerivedSession(before.workout),
      `this seed no longer puts a derived filler on G-1: ${describe(before)}`);

    const result = commit(weekStart, {
      kind: 'swap_category', date: friday, category: 'conditioning_hard',
    });
    assert(!result.ok, `a routeless swap onto G-1 applied: "${result.message}"`);
    assert(result.appliedDates.length === 0,
      `the refused swap applied ${result.appliedDates.join(', ')}`);
    assert(result.message.startsWith(G1_LANDING_WARNING.ask.headline),
      `the refusal did not lead with the ask: "${result.message}"`);
    assert(visibleFriday(weekStart)?.workout?.name === before.workout.name,
      `G-1 changed despite the refusal: ${describe(visibleFriday(weekStart))}`);
  });

  run(`SWAP onto G-1 survives the resolver once routed (${fixture.name})`, () => {
    const weekStart = seed();
    if (fixture.explicit) markExplicitFixture(weekStart);
    const friday = addDaysISO(weekStart, 4);

    // Conditioning, deliberately: it is NOT a protected core exposure, so only
    // the placement stamp can keep it. A strength swap would also be saved by
    // the protected-core guard and the assertion could pass for the wrong reason.
    const result = commit(weekStart, {
      kind: 'swap_category', date: friday, category: 'conditioning_hard',
      g1Route: 'deloaded',
    });
    assert(result.ok, `swap refused: ${result.message}`);

    const after = visibleFriday(weekStart);
    assert(after?.workout, `G-1 is empty after the swap: ${describe(after)} / ${result.message}`);
    assert(!isResolverOwnedDerivedSession(after.workout),
      `the derived filler regenerated over the athlete's swap: ${describe(after)}`);
    assert(isAthletePlacedSession(after.workout),
      `the swapped session reached the visible week unstamped: ${describe(after)}`);
    assert(/flush|aerobic|bike|row|ski|conditioning|interval|sprint/i.test(after.workout.name),
      `G-1 holds ${describe(after)}, not the conditioning the athlete picked`);
  });

  run(`ADD onto an empty G-1 is refused until the athlete answers (${fixture.name})`, () => {
    const weekStart = seed();
    restStubOnFriday(weekStart);
    if (fixture.explicit) markExplicitFixture(weekStart);
    const friday = addDaysISO(weekStart, 4);
    assert(!visibleFriday(weekStart)?.workout,
      `the rest stub did not leave G-1 empty: ${describe(visibleFriday(weekStart))}`);

    const result = commit(weekStart, {
      kind: 'add_category', date: friday, category: 'conditioning_hard',
    });
    assert(!result.ok, `a routeless add onto G-1 applied: "${result.message}"`);
    assert(result.message.startsWith(G1_LANDING_WARNING.ask.headline),
      `the refusal did not lead with the ask: "${result.message}"`);
    assert(!visibleFriday(weekStart)?.workout,
      `G-1 gained ${describe(visibleFriday(weekStart))} despite the refusal`);
  });

  run(`ADD onto an empty G-1 survives the resolver once routed (${fixture.name})`, () => {
    const weekStart = seed();
    restStubOnFriday(weekStart);
    if (fixture.explicit) markExplicitFixture(weekStart);
    const friday = addDaysISO(weekStart, 4);

    const result = commit(weekStart, {
      kind: 'add_category', date: friday, category: 'conditioning_hard',
      g1Route: 'deloaded',
    });
    assert(result.ok, `add refused: ${result.message} ${JSON.stringify(result.rejected)}`);

    const after = visibleFriday(weekStart);
    assert(after?.workout, `G-1 is empty after the add: ${describe(after)}`);
    assert(!isResolverOwnedDerivedSession(after.workout),
      `the derived filler regenerated over the athlete's add: ${describe(after)}`);
    assert(isAthletePlacedSession(after.workout),
      `the added session reached the visible week unstamped: ${describe(after)}`);
  });

  run(`MOVE onto G-1 is refused until the athlete answers (${fixture.name})`, () => {
    const weekStart = seed();
    if (fixture.explicit) markExplicitFixture(weekStart);
    const monday = addDaysISO(weekStart, 0);
    const friday = addDaysISO(weekStart, 4);
    const mondayBefore = visibleWeek(weekStart)
      .find((day) => day.date === monday)?.workout?.name;
    assert(mondayBefore, 'seeded Monday session missing');

    const result = commit(weekStart, {
      kind: 'move_session', fromDate: monday, toDate: friday,
    });
    assert(!result.ok, `a routeless move onto G-1 applied: "${result.message}"`);
    assert(result.message.startsWith(G1_LANDING_WARNING.ask.headline),
      `the refusal did not lead with the ask: "${result.message}"`);
    assert(visibleWeek(weekStart).find((day) => day.date === monday)?.workout?.name
      === mondayBefore, 'the source day moved despite the refusal');
  });

  run(`MOVE onto G-1 survives the resolver once routed (${fixture.name})`, () => {
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

/**
 * The reachable `already_applied` path is a DOUBLE TAP.
 *
 * The sheet holds `weekDays` from its last render, so a second tap before the
 * store round-trips re-issues the change against the same snapshot — the same
 * `originalWorkout`, therefore the same constraint id, therefore the transaction
 * short-circuit. (Re-reading the week between attempts does NOT reproduce it:
 * the day now holds the swapped-in session, so the second request has a
 * different identity and genuinely applies. That is why this test freezes the
 * snapshot rather than calling `commit` twice.)
 */
run('a double-tapped swap reports no-change, not a second success', () => {
  const weekStart = seed();
  markExplicitFixture(weekStart);
  const friday = addDaysISO(weekStart, 4);
  const snapshot = visibleWeek(weekStart);
  // Routed, because the day is G-1: the ask is answered once and the SECOND
  // tap is what this test is about. A routeless first tap is now refused, which
  // is a different (and separately pinned) behaviour.
  const change: PlanChange = {
    kind: 'swap_category', date: friday, category: 'conditioning_hard',
    g1Route: 'deloaded',
  };
  const tap = () => quiet(() => applyPlanChange({
    change,
    visibleWeek: snapshot,
    todayISO: weekStart,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));

  const first = tap();
  assert(first.ok && first.outcome === 'applied',
    `first tap did not apply: ${first.outcome} / ${first.message}`);
  const landed = visibleFriday(weekStart)?.workout?.name ?? null;

  const second = tap();
  assert(second.outcome === 'no_change',
    `a second tap that published nothing reported "${second.outcome}": "${second.message}"`);
  assert(!/^Done\./.test(second.message),
    `a swap that applied nothing still reported success: "${second.message}"`);
  assert(second.message.length > 0 && !/_/.test(second.message),
    `no-change reached the athlete as a raw code: "${second.message}"`);
  assert(visibleFriday(weekStart)?.workout?.name === landed,
    'the double tap changed the day it reported no change to');
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

// ── Ruling (7): the tap door verifies against the week the athlete SEES ───

run('a commit that does not reach the visible week is refused and rolled back', () => {
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const before = visibleWeek(weekStart);
  const mondayBefore = before.find((day) => day.date === monday)?.workout?.name ?? null;
  assert(mondayBefore, 'seeded Monday session missing');

  // The device failure, reproduced against the REAL transaction: the swap
  // commits into accepted state, and the week the athlete SEES does not move
  // because a later layer re-derived over it. `readVisibleWeekAfterCommit`
  // stands in for that layer by handing back the pre-commit week.
  //
  // Deliberately not a stubbed commit: a caller-supplied commit seam means the
  // host owns publication and its post-condition, so stubbing the commit would
  // switch the very check under test off.
  const result = quiet(() => applyPlanChange({
    change: { kind: 'swap_category', date: monday, category: 'conditioning_light' },
    visibleWeek: before,
    todayISO: weekStart,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
    readVisibleWeekAfterCommit: () => before,
  }));

  assert(result.ok === false && result.outcome === 'refused',
    `an unverified commit reported ${result.outcome}: "${result.message}"`);
  assert(!/^Done\./.test(result.message),
    `an unverified commit still reported success: "${result.message}"`);
  assert(result.rejected.some((entry) => entry.code === 'visible_change_unverified'),
    `refusal carried no verification code: ${JSON.stringify(result.rejected)}`);
  assert(useProgramStore.getState().userRemovalConstraints.length === 0,
    'the unverified commit was not rolled back — its constraint survived');
  assert(visibleWeek(weekStart).find((day) => day.date === monday)?.workout?.name === mondayBefore,
    'the target day changed despite the refusal');
});

run('a real commit still passes visible verification', () => {
  // Non-vacuity for the guard above: the same door, unmocked, must not start
  // refusing changes that genuinely land.
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const result = commit(weekStart, {
    kind: 'swap_category', date: monday, category: 'conditioning_light',
  });
  assert(result.ok && result.outcome === 'applied',
    `a genuine swap was refused by visible verification: "${result.message}"`);
});

// ── The date override is an athlete-owned surface, at BOTH boundaries ─────
//
// MATRIX CATCH #3 (`add_strength × derived_recovery_g_plus_1`). The athlete
// added a gym session to the day after a game. The week they SEE holds "Lower
// Squat"; the week that was ACCEPTED holds "Recovery Session". Same tap, two
// answers, and the accepted one is what every later transaction rebases on.
//
// The cause is one dropped fact, not a missing guard. There are TWO athlete-
// owned surfaces — removal constraints and date overrides — and the placement
// stamp was derived from only the first. `rebaseAcceptedEffectiveWeek` knows
// perfectly well which days the athlete owns (it computes `owner` per date),
// then flattens the dates to a bare workout list and throws that owner away.
// Downstream, `resolveFinalVisibleSection18Week` resolves with
// `manualOverrides: {}` — correct, the content is already composed — so an
// athlete-owned day is indistinguishable from a template day and the G+1
// recovery deriver regenerates over it. The visible resolver kept the session
// only because it answers ownership a DIFFERENT way: the `source === 'manual'`
// short-circuit.
//
// These assert the law, not the Sunday: EVERY day the athlete can land content
// on, at both boundaries.

function acceptedWorkoutOn(weekStart: string, date: string): Workout | null {
  const state = useProgramStore.getState();
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const accepted = quiet(() => rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  }));
  return accepted.visibleWorkouts.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null;
}

run('an added session reads the same in the accepted week as on the screen, every day', () => {
  // The day after a game is where this first showed, because that is where a
  // deriver has something to say. Sweeping all seven proves the fix is the
  // ownership boundary and not a Sunday special case.
  const landed: string[] = [];
  let gPlusOneLanded = false;
  for (let offset = 0; offset < 7; offset++) {
    for (const category of ['strength_full', 'conditioning_hard'] as const) {
      const weekStart = seed();
      const date = addDaysISO(weekStart, offset);
      const result = commit(weekStart, {
        kind: 'add_category', date, category, g1Route: 'deloaded',
      });
      // A day that already holds this kind refuses, and that refusal is its own
      // law elsewhere. Only landed content can diverge between the two weeks.
      if (result.outcome !== 'applied') continue;
      landed.push(`${date}/${category}`);
      if (offset === 6) gPlusOneLanded = true;

      const visible = visibleWeek(weekStart).find((day) => day.date === date)?.workout?.name ?? null;
      const accepted = acceptedWorkoutOn(weekStart, date)?.name ?? null;
      assert(visible !== null,
        `${date}/${category}: an applied add left the visible day empty`);
      assert(accepted !== null,
        `${date}/${category}: an applied add is absent from the accepted week entirely`);
      assert(accepted === visible || visible.includes(accepted) || accepted.includes(visible),
        `${date}/${category}: the week the athlete SEES disagrees with what was `
        + `accepted — visible "${visible}", accepted "${accepted}"`);
    }
  }
  // Non-vacuity: an assertion that never ran is not a passing assertion, and
  // the day after a game is the one with a deriver waiting for it.
  // A settled in-season week is nearly full — Mon strength, Tue/Thu team
  // nights, Fri Gunshow, Sat game — so only Wednesday (free, both categories)
  // and the G+1 Sunday accept new work. Three is the whole reachable space
  // here, and the matrix sweeps the wide grid; what this bar prevents is the
  // sweep silently landing NOTHING and reporting green.
  assert(landed.length >= 3,
    `only ${landed.length} of 14 adds landed (${landed.join(', ')}) — `
    + 'the sweep is not exercising the boundary');
  assert(gPlusOneLanded,
    'nothing landed on the day after the game — the cell this test exists for did not run');
});

run('a day the athlete owns carries the stamp into the accepted week', () => {
  // The mechanism behind the law above, asserted directly so a future change
  // that keeps the names agreeing by some other means still has to say what
  // owns the day. `resolverMayDisplace` is the ONE predicate; a composed week
  // that cannot answer it has lost the fact, whatever it happens to render.
  //
  // RE-POINTED, and the reason is a convergence rather than a regression. This
  // used to require a DATE OVERRIDE, because an add onto an occupied day
  // deferred to the legacy writer and that writer's surface was the override.
  // Retiring the deferral put the add back through the constraint ingress every
  // other athlete door uses, so the same tap now writes a removal constraint
  // instead. Both are athlete-owned surfaces and both derive the same stamp —
  // which is the point of the stamp — so the assertion names the LAW (the
  // athlete owns this day, and the accepted week knows it) and checks that one
  // of the two surfaces actually carries it, rather than pinning the one that
  // happened to be in use.
  const weekStart = seed();
  const sunday = addDaysISO(weekStart, 6);
  const result = commit(weekStart, { kind: 'add_category', date: sunday, category: 'strength_full' });
  assert(result.outcome === 'applied', `the G+1 add was refused: "${result.message}"`);
  const state = useProgramStore.getState();
  const ownedByOverride = Object.prototype.hasOwnProperty.call(state.dateOverrides, sunday);
  const ownedByConstraint = state.userRemovalConstraints.some((constraint) =>
    constraint.status === 'active' && constraint.targetDate === sunday);
  assert(ownedByOverride || ownedByConstraint,
    'the add landed on neither athlete-owned surface — this test is aimed at nothing');

  const accepted = acceptedWorkoutOn(weekStart, sunday);
  assert(accepted, 'the athlete-owned day vanished from the accepted week');
  assert(isAthletePlacedSession(accepted),
    `the athlete's own content reached the accepted week unstamped — a deriver `
    + `will overwrite it (accepted holds "${accepted.name}")`);
});

run('a template day the athlete never touched is NOT stamped', () => {
  // The other direction, and the one that keeps the stamp meaningful: if
  // composing the accepted week stamped everything, `resolverMayDisplace`
  // would answer "no" for the whole week and the derivers would go quiet.
  const weekStart = seed();
  const monday = addDaysISO(weekStart, 0);
  const accepted = acceptedWorkoutOn(weekStart, monday);
  assert(accepted, 'the seeded Monday session is missing from the accepted week');
  assert(!isAthletePlacedSession(accepted),
    `derived/template content was stamped as athlete-placed: "${accepted.name}"`);
});

console.log(`\nAthlete placement ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
