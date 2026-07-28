/**
 * G-1 MOVE ASK-FLOW — athlete-placed content outranks derived filler.
 *
 * Sam's ruling (2026-07-28/29), design: docs/G1_MOVE_ASK_FLOW_DESIGN_2026-07-29.md
 *
 * Generation never plans hard strength or conditioning on G-1 — unchanged. This
 * suite pins what happens when the ATHLETE puts a session there: the derived
 * Gunshow never silently eats it, and the athlete is offered exactly three
 * routes through the accepted-state transaction owner.
 *
 * Run: npm run test:g1-move-ask-flow
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
  throw new Error('NETWORK DISABLED — G-1 ask-flow must be local');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitAthleteSessionMoveTransaction } from '../store/acceptedStateTransaction';
import { isAthletePlacedSession } from '../rules/athletePlacement';
import { isResolverOwnedDerivedSession } from '../rules/derivedSessionProvenance';
import { effectiveGameDatesAround } from '../utils/sessionResolver';
import { fixtureAwareMarkedDaysForWeek } from '../rules/section18AcceptedWeekGateway';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import type { AthleteContext } from '../utils/sessionBuilder';
import {
  G1_MOVE_ROUTES,
  g1MoveRoute,
  placeSessionForRoute,
  resolveG1MoveAsk,
} from '../rules/g1MoveAsk';
import {
  applyConditioningDeloadToExercises,
  applyStrengthDeloadToExercises,
  isAccessoryStrengthRow,
  isConditioningExerciseRow,
  isMainStrengthRow,
  resolveDoorDeloadPolicy,
} from '../rules/deloadWeekRules';

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
    console.error(`  FAIL ${name}`, error);
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
  } as OnboardingData;
}

/**
 * The practice-match week: Sam's ruling made the fixture an EXPLICIT calendar
 * mark, which is precisely the case where the G-1 branch used to disable its
 * protection guard. Friday is empty (a canonical Rest stub keeps the derived
 * Gunshow off it), so a move lands on a visibly free day and the loss only
 * appears after the resolver runs.
 */
function practiceMatchAthlete(): OnboardingData {
  return {
    ...profile(),
    seasonPhase: 'Pre-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  } as OnboardingData;
}

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seed(
  athlete: OnboardingData,
  options: { phaseEntryOffsetWeeks?: number } = {},
): TrainingProgram {
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: addDaysISO(
        CURRENT_WEEK,
        -(options.phaseEntryOffsetWeeks ?? 0) * 7,
      ),
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] });
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
      lastTransaction: 'g1-ask-flow-test:seed',
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  return program;
}

function accepted(weekStart: string) {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
}

function workoutOn(weekStart: string, dayOfWeek: number): Workout | null {
  return accepted(weekStart).visibleWorkouts.find((workout) =>
    workout.dayOfWeek === dayOfWeek) ?? null;
}

function identity(workout: Workout): string {
  return workout.planEntryId ?? workout.id;
}

function moveOnto(
  weekStart: string,
  sourceDay: number,
  targetDay: number,
): void {
  const source = workoutOn(weekStart, sourceDay);
  assert(source, `source day ${sourceDay} missing`);
  commitAthleteSessionMoveTransaction({
    sourceDate: addDaysISO(weekStart, sourceDay === 0 ? 6 : sourceDay - 1),
    targetDate: addDaysISO(weekStart, targetDay === 0 ? 6 : targetDay - 1),
    reason: 'test:g1_move',
    source: 'tap',
    acceptedSourcePlanEntryId: source.planEntryId ?? null,
    sourceWorkoutId: source.id,
    originalSourceWorkout: source,
    existingTargetWorkout: workoutOn(weekStart, targetDay),
    scope: 'whole_session',
  });
}

console.log('\n-- G-1 move ask-flow --');

// ── Stage 1: the ownership condition ──────────────────────────────────────

run('1 an athlete-placed session survives G-1 against an EXPLICIT fixture', () => {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  const monday = workoutOn(weekStart, 1);
  assert(monday, 'seeded Monday session missing');
  const sourceIdentity = identity(monday);

  moveOnto(weekStart, 1, 5);

  const friday = workoutOn(weekStart, 5);
  assert(friday, 'G-1 Friday is empty — the athlete-placed session was destroyed');
  assert(identity(friday) === sourceIdentity,
    `G-1 Friday is owned by ${identity(friday)}, not the athlete's ${sourceIdentity}`);
  assert(workoutOn(weekStart, 1) === null,
    'the source day was not vacated by the move');
});

run('2 the placement stamp is written at the constraint ingress site', () => {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  moveOnto(weekStart, 1, 5);

  const friday = workoutOn(weekStart, 5);
  assert(friday, 'G-1 Friday is empty');
  assert(isAthletePlacedSession(friday),
    'the moved session reached the visible week without an athlete-placement stamp');
  // Everything the athlete did NOT place stays unstamped — the stamp means
  // "the athlete put this here", not "this survived a week that had a move in it".
  const tuesday = workoutOn(weekStart, 2);
  assert(tuesday && !isAthletePlacedSession(tuesday),
    'an untouched session was stamped as athlete-placed');
});

run('3 the derived Gunshow still owns G-1 when the athlete placed nothing', () => {
  // Non-vacuous by construction: this seed's G-1 genuinely HOLDS the derived
  // Gunshow, so the assertion has something to be wrong about. Honouring
  // athlete placement must not weaken the rule for days the athlete never
  // touched — a predicate that answered "athlete-placed" for everything would
  // leave G-1 carrying whatever the template put there.
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = workoutOn(weekStart, 5);
  assert(friday, 'in-season G-1 is empty — the seed no longer exercises this rule');
  assert(isResolverOwnedDerivedSession(friday),
    `G-1 is owned by ${identity(friday)}, not the derived game-proximity filler`);
  assert(!isAthletePlacedSession(friday),
    'an untouched derived filler was reported as athlete-placed');
});

run('4 a virtual-fixture G-1 keeps honouring athlete placement too', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]?.startDate.slice(0, 10)
    ?? program.microcycles[0]!.startDate.slice(0, 10);
  const monday = workoutOn(weekStart, 1);
  assert(monday, 'seeded Monday session missing');
  const sourceIdentity = identity(monday);
  const fridayBefore = workoutOn(weekStart, 5);
  assert(fridayBefore, 'in-season G-1 Gunshow missing from the seeded week');

  moveOnto(weekStart, 1, 5);

  const friday = workoutOn(weekStart, 5);
  assert(friday && identity(friday) === sourceIdentity,
    `virtual G-1 is owned by ${friday ? identity(friday) : 'REST'}, not the athlete's ${sourceIdentity}`);
});

run('5 the displaced G-1 filler is discarded, never materialised on the source day', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const fridayBefore = workoutOn(weekStart, 5);
  assert(fridayBefore && isResolverOwnedDerivedSession(fridayBefore),
    'this seed no longer puts a derived filler on G-1');
  const fillerIdentity = identity(fridayBefore);

  moveOnto(weekStart, 1, 5);

  // The Gunshow is regenerated from the fixture every render. Swapping it back
  // to Monday would hand the athlete a session the app invented as though they
  // owned it, and duplicate it the moment the resolver rebuilt Friday.
  const monday = workoutOn(weekStart, 1);
  assert(monday === null,
    `the displaced filler was materialised on the source day as ${monday ? identity(monday) : 'REST'}`);
  const weekIdentities = accepted(weekStart).visibleWorkouts.map(identity);
  assert(!weekIdentities.includes(fillerIdentity),
    `the discarded filler ${fillerIdentity} is still somewhere in the week`);
});

// ── Stage 2: the typed option list and its two transformations ────────────

function athleteContext(): AthleteContext {
  const onboarding = useProfileStore.getState().onboardingData!;
  return {
    injuries: onboarding.injuries ?? [],
    equipmentTags: resolveEquipmentCapabilities(onboarding).tags,
    trainingLocation: onboarding.trainingLocation ?? 'Commercial gym',
    onboardingData: onboarding,
  };
}

/**
 * A REAL conditioning session — the practice-match week's Tuesday Hard
 * Intervals. Synthesising one by filtering a strength session's rows produced an
 * empty session and made these assertions vacuous, which is what test 9 caught.
 */
function seedConditioningSession(): { weekStart: string; session: Workout } {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  const session = workoutOn(weekStart, 2);
  assert(session, 'practice-match Tuesday conditioning session missing');
  assert(session.exercises.some(isConditioningExerciseRow),
    `${session.name} carries no conditioning rows — the seed changed`);
  assert(!session.exercises.some((row) =>
    !isConditioningExerciseRow(row) && isAccessoryStrengthRow(row)),
  `${session.name} has accessory rows — it no longer exercises the no-accessories case`);
  return { weekStart, session };
}

function gameDatesFor(weekStart: string, centerDate: string): Set<string> {
  const onboarding = useProfileStore.getState().onboardingData!;
  return effectiveGameDatesAround({
    markedDays: fixtureAwareMarkedDaysForWeek({
      contract: accepted(weekStart).contract,
      weekStart,
      profile: onboarding,
      markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
    }),
    usualGameDay: onboarding.usualGameDay,
    gameDay: onboarding.gameDay,
    seasonPhase: onboarding.seasonPhase,
    centerDate,
  });
}

run('6 the menu is uniform — three routes, whatever the athlete moved', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const g1 = addDaysISO(weekStart, 4);

  const strength = workoutOn(weekStart, 1);
  assert(strength, 'strength source missing');
  const strengthAsk = resolveG1MoveAsk({
    sourceDate: weekStart, targetDate: g1, sourceWorkout: strength,
    gameDates: gameDatesFor(weekStart, g1),
  });
  assert(strengthAsk, 'no ask raised for a strength session moved onto G-1');

  // A session with no accessory rows at all — the case that used to have
  // nothing to offer for route (b).
  const conditioning = seedConditioningSession();
  const conditioningG1 = addDaysISO(conditioning.weekStart, 4);
  const conditioningAsk = resolveG1MoveAsk({
    sourceDate: conditioning.weekStart, targetDate: conditioningG1,
    sourceWorkout: conditioning.session, gameDates: gameDatesFor(conditioning.weekStart, conditioningG1),
  });
  assert(conditioningAsk, 'no ask raised for a conditioning session moved onto G-1');

  assert(G1_MOVE_ROUTES.length === 3,
    `the menu offers ${G1_MOVE_ROUTES.length} routes, not three`);
  assert(G1_MOVE_ROUTES.map((route) => route.id).join(',') ===
    'keep_gunshow,accessories_only,deloaded', 'route order changed');
  // Uniformity is the ruling: the SAME three ids for both session types.
  assert(!!strengthAsk && !!conditioningAsk,
    'the menu shape depended on session type');
});

run('7 only route (a) commits nothing, only route (c) needs the second warning', () => {
  assert(g1MoveRoute('keep_gunshow').commits === false,
    'route (a) commits a transaction — the ruling is that the move is abandoned');
  assert(g1MoveRoute('accessories_only').commits &&
    g1MoveRoute('deloaded').commits, 'a committing route stopped committing');
  const needSecond = G1_MOVE_ROUTES.filter((route) => route.requiresSecondWarning);
  assert(needSecond.length === 1 && needSecond[0].id === 'deloaded',
    `second warning is gated on ${needSecond.map((r) => r.id).join(',')}, not deloaded alone`);
});

run('8 route (b) strips main lifts and conditioning, keeps accessories', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1);
  assert(source, 'source missing');
  const mainLifts = source.exercises.filter(isMainStrengthRow);
  const accessories = source.exercises.filter((row) =>
    !isConditioningExerciseRow(row) && isAccessoryStrengthRow(row));
  assert(mainLifts.length > 0 && accessories.length > 0,
    'seed no longer has both main lifts and accessories — test is vacuous');

  const placed = placeSessionForRoute({
    route: 'accessories_only', sourceWorkout: source,
    targetDate: addDaysISO(weekStart, 4),
    athlete: athleteContext(), profile: useProfileStore.getState().onboardingData,
  });
  assert(placed, 'route (b) placed nothing');
  assert(placed.exercises.every((row) => !isMainStrengthRow(row)),
    'a main lift survived the accessories-only strip');
  assert(placed.exercises.every((row) => !isConditioningExerciseRow(row)),
    'conditioning survived the accessories-only strip');
  assert(placed.exercises.length === accessories.length,
    `kept ${placed.exercises.length} rows, expected the ${accessories.length} accessories`);
  assert(identity(placed) === identity(source),
    'route (b) changed the session identity — the move would read as content loss');
});

run('9 route (b) on a session with no accessories is the pump session, named honestly', () => {
  const { weekStart, session: conditioningOnly } = seedConditioningSession();

  const placed = placeSessionForRoute({
    route: 'accessories_only', sourceWorkout: conditioningOnly,
    targetDate: addDaysISO(weekStart, 4),
    athlete: athleteContext(), profile: useProfileStore.getState().onboardingData,
  });
  assert(placed, 'route (b) placed nothing for a conditioning session');
  assert(placed.exercises.length > 0, 'route (b) placed an empty session');
  // Sam's banned class: an easy version wearing the athlete's session name.
  assert(placed.name !== conditioningOnly.name,
    `the pump session is wearing the athlete's session name "${placed.name}"`);
  assert(placed.exercises.every((row) => !isConditioningExerciseRow(row)),
    'the "pump session" still carries conditioning rows');
  // And the sub-line must say the original session is dropped, not moved.
  const context = resolveG1MoveAsk({
    sourceDate: weekStart, targetDate: addDaysISO(weekStart, 4),
    sourceWorkout: conditioningOnly, gameDates: gameDatesFor(weekStart, addDaysISO(weekStart, 4)),
  });
  assert(context?.accessoriesComeFromPumpSession,
    'the ask did not notice there were no accessories to keep');
  assert(/dropped, not moved/.test(g1MoveRoute('accessories_only').detail(context!)),
    'the honest-labelling sub-line is missing');
});

run('10 route (c) is DELOAD_LAW and nothing else', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1);
  assert(source, 'source missing');

  const placed = placeSessionForRoute({
    route: 'deloaded', sourceWorkout: source,
    targetDate: addDaysISO(weekStart, 4),
    athlete: athleteContext(), profile: useProfileStore.getState().onboardingData,
  });
  assert(placed, 'route (c) placed nothing');

  // The one mechanism, applied through its own owner — same result as calling
  // DELOAD_LAW's appliers directly. Any private re-implementation drifts here.
  const policy = resolveDoorDeloadPolicy({
    door: 'readiness',
    seasonPhase: useProfileStore.getState().onboardingData?.seasonPhase,
  })!;
  const expected = applyConditioningDeloadToExercises(
    applyStrengthDeloadToExercises(source.exercises, policy),
    policy,
  );
  assert(JSON.stringify(placed.exercises) === JSON.stringify(expected),
    'route (c) does not equal the DELOAD_LAW appliers — a second reduction exists');
  assert(identity(placed) === identity(source),
    'route (c) changed the session identity');
  // Sam's dose, spot-checked against the law rather than a copied constant.
  const mainBefore = source.exercises.filter(isMainStrengthRow);
  const mainAfter = placed.exercises.filter(isMainStrengthRow);
  assert(mainAfter.length > 0, 'the deload halved the main lifts out of existence');
  for (const after of mainAfter) {
    const before = mainBefore.find((row) => row.exerciseId === after.exerciseId);
    assert(before && after.prescribedSets <= before.prescribedSets,
      'a main lift gained sets under the deload');
    assert(before && after.prescribedWeightKg === before.prescribedWeightKg,
      'the deload moved the weight — Sam\'s law holds it unless the athlete is beat up');
  }
});

run('11 a session the day is already built for lands without an ask', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const g1 = addDaysISO(weekStart, 4);
  const source = workoutOn(weekStart, 1);
  assert(source, 'source missing');
  const recovery: Workout = { ...source, sessionTier: 'recovery', workoutType: 'Recovery' };
  assert(resolveG1MoveAsk({
    sourceDate: weekStart, targetDate: g1, sourceWorkout: recovery,
    gameDates: gameDatesFor(weekStart, g1),
  }) === null, 'a recovery session was made to answer the G-1 ask');
  // And a move that is not onto G-1 at all raises nothing.
  assert(resolveG1MoveAsk({
    sourceDate: weekStart, targetDate: addDaysISO(weekStart, 2), sourceWorkout: source,
    gameDates: gameDatesFor(weekStart, g1),
  }) === null, 'the ask fired on a day that is not the day before a game');
});

console.log(`\nG-1 move ask-flow totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('Failing:', failures.join(', '));
  process.exit(1);
}
