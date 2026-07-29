/**
 * G-1 LANDING ASK-FLOW — athlete-placed content outranks derived filler.
 *
 * Sam's ruling (2026-07-28/29), design: docs/G1_MOVE_ASK_FLOW_DESIGN_2026-07-29.md
 *
 * Generation never plans hard strength or conditioning on G-1 — unchanged. This
 * suite pins what happens when the ATHLETE puts a session there: the derived
 * Gunshow never silently eats it, and the athlete is offered exactly three
 * routes through the accepted-state transaction owner.
 *
 * ONE FUNNEL, EVERY DOOR (Sam, 2026-07-30). The ask began as a property of the
 * Move door, and a swap onto the same day therefore reported "Done." and
 * changed nothing. It is a property of the DESTINATION and of the content
 * landing on it, so Move, Swap and Add all pass through `resolveG1LandingAsk`
 * once, in `resolveAthleteMutation`. Stage 4 is that boundary.
 *
 * Run: npm run test:g1-landing-ask-flow
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

import { readFileSync } from 'fs';
import { join } from 'path';
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
import { effectiveGameDatesAround, resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  applyPlanChange,
  previewPlanChangeRisk,
  resolveTemplatePlanChange,
} from '../utils/planChangeProducer';
import { buildCoachRevisionTemplateWorkout } from '../utils/coachRevisionTemplates';
import type { PlanChange, G1LandingRouteId } from '../utils/planChangeTypes';
import { fixtureAwareMarkedDaysForWeek } from '../rules/section18AcceptedWeekGateway';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import type { AthleteContext } from '../utils/sessionBuilder';
import {
  G1_LANDING_ROUTES,
  G1_LANDING_WARNING,
  g1LandingRoute,
  type G1LandingAskContext,
  placeSessionForRoute,
  resolveG1LandingAsk,
} from '../rules/g1LandingAsk';
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
  } as unknown as OnboardingData;
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
  } as unknown as OnboardingData;
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
      persistenceProvenance: 'preserved_persisted_state',
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

function visibleWeek(weekStart: string) {
  return resolveWeekWithConditioning(weekStart, buildScheduleStateImperative());
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

console.log('\n-- G-1 landing ask-flow --');

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
  const strengthAsk = resolveG1LandingAsk({
    sourceDate: weekStart, targetDate: g1, landingWorkout: strength, existingWorkout: null,
    gameDates: gameDatesFor(weekStart, g1),
  });
  assert(strengthAsk, 'no ask raised for a strength session moved onto G-1');

  // A session with no accessory rows at all — the case that used to have
  // nothing to offer for route (b).
  const conditioning = seedConditioningSession();
  const conditioningG1 = addDaysISO(conditioning.weekStart, 4);
  const conditioningAsk = resolveG1LandingAsk({
    sourceDate: conditioning.weekStart, targetDate: conditioningG1,
    landingWorkout: conditioning.session, existingWorkout: null, gameDates: gameDatesFor(conditioning.weekStart, conditioningG1),
  });
  assert(conditioningAsk, 'no ask raised for a conditioning session moved onto G-1');

  assert(G1_LANDING_ROUTES.length === 3,
    `the menu offers ${G1_LANDING_ROUTES.length} routes, not three`);
  assert(G1_LANDING_ROUTES.map((route) => route.id).join(',') ===
    'keep_the_day,accessories_only,deloaded', 'route order changed');
  // Uniformity is the ruling: the SAME three ids for both session types.
  assert(!!strengthAsk && !!conditioningAsk,
    'the menu shape depended on session type');
});

run('7 only route (a) commits nothing, only route (c) needs the second warning', () => {
  assert(g1LandingRoute('keep_the_day').commits === false,
    'route (a) commits a transaction — the ruling is that the move is abandoned');
  assert(g1LandingRoute('accessories_only').commits &&
    g1LandingRoute('deloaded').commits, 'a committing route stopped committing');
  const needSecond = G1_LANDING_ROUTES.filter((route) => route.requiresSecondWarning);
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
    route: 'accessories_only', landingWorkout: source,
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
    route: 'accessories_only', landingWorkout: conditioningOnly,
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
  const context = resolveG1LandingAsk({
    sourceDate: weekStart, targetDate: addDaysISO(weekStart, 4),
    landingWorkout: conditioningOnly, existingWorkout: null, gameDates: gameDatesFor(weekStart, addDaysISO(weekStart, 4)),
  });
  assert(context?.accessoriesComeFromPumpSession,
    'the ask did not notice there were no accessories to keep');
  assert(/dropped, not moved/.test(g1LandingRoute('accessories_only').detail(context!)),
    'the honest-labelling sub-line is missing');
});

run('10 route (c) is DELOAD_LAW and nothing else', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1);
  assert(source, 'source missing');

  const placed = placeSessionForRoute({
    route: 'deloaded', landingWorkout: source,
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
  assert(resolveG1LandingAsk({
    sourceDate: weekStart, targetDate: g1, landingWorkout: recovery, existingWorkout: null,
    gameDates: gameDatesFor(weekStart, g1),
  }) === null, 'a recovery session was made to answer the G-1 ask');
  // And a move that is not onto G-1 at all raises nothing.
  assert(resolveG1LandingAsk({
    sourceDate: weekStart, targetDate: addDaysISO(weekStart, 2), landingWorkout: source, existingWorkout: null,
    gameDates: gameDatesFor(weekStart, g1),
  }) === null, 'the ask fired on a day that is not the day before a game');
});

// ── Stage 3: the production door ──────────────────────────────────────────

function previewMove(weekStart: string, from: number, to: number, route?: G1LandingRouteId) {
  const week = visibleWeek(weekStart);
  const change: PlanChange = {
    kind: 'move_session',
    fromDate: addDaysISO(weekStart, from === 0 ? 6 : from - 1),
    toDate: addDaysISO(weekStart, to === 0 ? 6 : to - 1),
    ...(route ? { g1Route: route } : {}),
  };
  return {
    week,
    change,
    preview: quiet(() => previewPlanChangeRisk({
      change,
      visibleWeek: week,
      todayISO: CURRENT_WEEK,
      profile: useProfileStore.getState().onboardingData ?? undefined,
      activeConstraints: [],
    })),
  };
}

function storeFingerprint(): string {
  const state = useProgramStore.getState();
  return JSON.stringify({
    program: state.currentProgram,
    overlays: state.weekScopedOverlays,
    constraints: state.userRemovalConstraints,
    context: state.acceptedMaterialContext,
  });
}

run('12 a routeless move onto G-1 answers with the ask and applies nothing', () => {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  const before = storeFingerprint();

  const { preview } = previewMove(weekStart, 1, 5);

  assert(preview.g1Ask, 'the production door did not raise the ask for a G-1 move');
  assert(preview.appliedDates.length === 0,
    `the ask applied ${preview.appliedDates.join(', ')}`);
  assert(storeFingerprint() === before, 'raising the ask mutated accepted state');
  assert(preview.g1Ask.gameDayName === 'Saturday',
    `the warning names ${preview.g1Ask.gameDayName} as the game day`);
  assert(preview.g1Ask.g1DayName === 'Friday' &&
    preview.g1Ask.sourceDayName === 'Monday', 'the ask named the wrong days');
  assert(preview.message === G1_LANDING_WARNING.ask.headline,
    'the door did not lead with Sam\'s authored headline');
});

run('13 a move that is not onto G-1 is untouched by the ask', () => {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  // Monday → Sunday: an ordinary empty day, nowhere near the fixture.
  const { preview } = previewMove(weekStart, 1, 0);
  assert(!preview.g1Ask, 'the ask fired on an ordinary move');
});

run('14 route (b) through the real door lands accessories on G-1', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1)!;
  const sourceIdentity = identity(source);
  const mainLiftIds = source.exercises.filter(isMainStrengthRow)
    .map((row) => row.exerciseId);
  assert(mainLiftIds.length > 0, 'seed has no main lifts — test is vacuous');

  const { change, week, preview } = previewMove(weekStart, 1, 5, 'accessories_only');
  assert(!preview.g1Ask, 'a routed move still raised the ask');
  assert(preview.ok, `routed preview refused: ${preview.message}`);
  const commit = quiet(() => applyPlanChange({
    change, visibleWeek: week, todayISO: CURRENT_WEEK, trace: preview.trace,
    setManualOverride: () => {
      throw new Error('athlete move must not use the single-date writer');
    },
  }));
  assert(commit.ok, `route (b) commit failed: ${JSON.stringify(commit.rejected)}`);

  const friday = workoutOn(weekStart, 5);
  assert(friday && identity(friday) === sourceIdentity,
    `G-1 is owned by ${friday ? identity(friday) : 'REST'}, not the athlete's session`);
  assert(friday.exercises.every((row) => !mainLiftIds.includes(row.exerciseId)),
    'a main lift landed on the day before the game');
  assert(workoutOn(weekStart, 1) === null, 'the source day was not vacated');
});

run('15 route (c) through the real door lands the DELOAD_LAW dose on G-1', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1)!;
  const sourceIdentity = identity(source);
  const setsBefore = new Map(source.exercises.map((row) =>
    [row.exerciseId, row.prescribedSets]));

  const { change, week, preview } = previewMove(weekStart, 1, 5, 'deloaded');
  const commit = quiet(() => applyPlanChange({
    change, visibleWeek: week, todayISO: CURRENT_WEEK, trace: preview.trace,
    setManualOverride: () => { throw new Error('single-date writer'); },
  }));
  assert(commit.ok, `route (c) commit failed: ${JSON.stringify(commit.rejected)}`);

  const friday = workoutOn(weekStart, 5);
  assert(friday && identity(friday) === sourceIdentity, 'route (c) lost the session');
  const mainAfter = friday.exercises.filter(isMainStrengthRow);
  assert(mainAfter.length > 0, 'the deload removed every main lift');
  assert(mainAfter.some((row) => (setsBefore.get(row.exerciseId) ?? 0) > row.prescribedSets),
    'no main lift lost sets — the deload dose did not reach the placed session');
});

run('16 route (a) is reachable only by applying nothing at all', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const before = storeFingerprint();
  // The sheet answers "Keep the Gunshow" by closing, never by issuing a change.
  // There is deliberately NO g1Route value that commits an abandonment: a route
  // that committed "nothing" would still be a transaction in the ledger, and an
  // undo entry for a decision the athlete never made.
  assert(g1LandingRoute('keep_the_day').commits === false, 'route (a) commits');
  assert(storeFingerprint() === before, 'route (a) mutated accepted state');
});

run('17 committing a routeless G-1 move refuses rather than applying it', () => {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  const before = storeFingerprint();
  const { change, week, preview } = previewMove(weekStart, 1, 5);
  assert(preview.g1Ask, 'the ask was not raised');

  // Defence in depth. The sheet is supposed to hold the change back until the
  // athlete answers, but a caller that ignores the ask and commits anyway must
  // not get a silent full-session placement on the day before a game.
  const commit = quiet(() => applyPlanChange({
    change, visibleWeek: week, todayISO: CURRENT_WEEK, trace: preview.trace,
    setManualOverride: () => { throw new Error('single-date writer'); },
  }));
  assert(!commit.ok, 'a routeless G-1 move committed without the athlete answering');
  assert(commit.appliedDates.length === 0,
    `the refused commit still applied ${commit.appliedDates.join(', ')}`);
  assert(storeFingerprint() === before,
    'the refused routeless commit mutated accepted state');
});

// ── Stage 4: one funnel, every door ───────────────────────────────────────

/**
 * The device finding this stage exists for: a SWAP onto G-1 reported "Done."
 * and changed nothing, because only Move ever asked. The ask is a property of
 * the DESTINATION and the content landing on it, not of the door the athlete
 * happened to use, so it now funnels through one call in `resolveAthleteMutation`.
 */
function plantOnFriday(weekStart: string, patch: Partial<Workout>): Workout {
  const state = useProgramStore.getState() as unknown as {
    currentProgram: TrainingProgram;
    currentMicrocycle: TrainingProgram['microcycles'][number] | null;
  };
  const monday = state.currentProgram.microcycles
    .find((microcycle) => microcycle.startDate.slice(0, 10) === weekStart)
    ?.workouts.find((workout) => workout.dayOfWeek === 1);
  assert(monday, 'seed no longer has a Monday session to clone');
  const planted = {
    ...JSON.parse(JSON.stringify(monday)) as Workout,
    id: `${monday.id}:planted-friday`,
    planEntryId: undefined,
    dayOfWeek: 5,
    ...patch,
  } as Workout;
  const apply = <T extends { startDate: string; workouts: Workout[] }>(
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
        (microcycle) => apply(microcycle as never) as never),
    },
    currentMicrocycle: apply(state.currentMicrocycle as never) as never,
  } as never);
  return planted;
}

function previewChange(weekStart: string, change: PlanChange) {
  const week = visibleWeek(weekStart);
  return {
    week,
    change,
    preview: quiet(() => previewPlanChangeRisk({
      change,
      visibleWeek: week,
      todayISO: CURRENT_WEEK,
      profile: useProfileStore.getState().onboardingData ?? undefined,
      activeConstraints: [],
    })),
  };
}

function commitChange(weekStart: string, change: PlanChange) {
  const week = visibleWeek(weekStart);
  return quiet(() => applyPlanChange({
    change,
    visibleWeek: week,
    todayISO: CURRENT_WEEK,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));
}

run('19 a routeless SWAP onto G-1 answers with the ask and applies nothing', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);
  const before = storeFingerprint();

  const { preview } = previewChange(weekStart, {
    kind: 'swap_category', date: friday, category: 'conditioning_hard',
  });

  assert(preview.g1Ask, 'a swap onto G-1 did not raise the ask');
  assert(preview.appliedDates.length === 0,
    `the ask applied ${preview.appliedDates.join(', ')}`);
  assert(storeFingerprint() === before, 'raising the ask mutated accepted state');
  // A swap has no source day, and the copy must not invent one.
  assert(preview.g1Ask.sourceDayName === null,
    `the swap ask named "${preview.g1Ask.sourceDayName}" as a source day`);
  assert(preview.g1Ask.keptSessionName === 'Gunshow',
    `route (a) would keep "${preview.g1Ask.keptSessionName}", not the day's Gunshow`);
});

run('20 a routeless ADD onto G-1 answers with the ask and applies nothing', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  // Sam's device case: G-1 holds a recovery session and the athlete adds an
  // optional strength session on top of it.
  const recovery = plantOnFriday(weekStart, {
    name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery',
  });
  const friday = addDaysISO(weekStart, 4);
  const before = storeFingerprint();

  const { preview } = previewChange(weekStart, {
    kind: 'add_category', date: friday, category: 'strength_full',
  });

  assert(preview.g1Ask, 'an add onto G-1 did not raise the ask');
  assert(preview.appliedDates.length === 0,
    `the ask applied ${preview.appliedDates.join(', ')}`);
  assert(storeFingerprint() === before, 'raising the ask mutated accepted state');
  assert(preview.g1Ask.keptSessionName === recovery.name,
    `route (a) would keep "${preview.g1Ask.keptSessionName}", not the day's ${recovery.name}`);
});

run('21 an EMPTY G-1 raises the ask with nothing to keep', () => {
  const program = seed(practiceMatchAthlete(), { phaseEntryOffsetWeeks: 2 });
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);
  assert(!visibleWeek(weekStart).find((day) => day.date === friday)?.workout,
    'this seed no longer leaves G-1 empty');

  const { preview } = previewChange(weekStart, {
    kind: 'add_category', date: friday, category: 'conditioning_hard',
  });
  assert(preview.g1Ask, 'an add onto an empty G-1 did not raise the ask');
  assert(preview.g1Ask.keptSessionName === null,
    `the ask claims G-1 holds "${preview.g1Ask.keptSessionName}" on an empty day`);
});

run('22 recovery and rest still land on G-1 without a word, whatever the door', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);

  const swap = previewChange(weekStart, {
    kind: 'swap_category', date: friday, category: 'recovery',
  });
  assert(!swap.preview.g1Ask,
    'swapping in a recovery session made the athlete answer the ask');
  assert(swap.preview.ok, `the wordless recovery swap was refused: ${swap.preview.message}`);
});

run('23 route (b) through the SWAP door keeps main lifts off the day before the game', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);

  const result = commitChange(weekStart, {
    kind: 'swap_category', date: friday, category: 'strength_full',
    g1Route: 'accessories_only',
  });
  assert(result.ok, `routed swap refused: ${result.message}`);

  const landed = visibleWeek(weekStart)
    .find((day) => day.date === friday)?.workout ?? null;
  assert(landed, 'G-1 is empty after the routed swap');
  assert(landed.exercises.length > 0, 'the routed swap landed an empty session');
  assert(landed.exercises.every((row) => !isMainStrengthRow(row)),
    `a main lift landed on the day before the game: ${landed.exercises
      .filter(isMainStrengthRow).map((row) => row.exerciseId).join(', ')}`);
});

run('24 route (c) through the ADD door lands the DELOAD_LAW dose, not the full session', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  plantOnFriday(weekStart, {
    name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery',
  });
  const friday = addDaysISO(weekStart, 4);

  // The control is the registry template the add resolves to, put through
  // DELOAD_LAW's own appliers. That is what "the landing content at DELOAD_LAW
  // dose" MEANS, and comparing against it is what would catch a second, private
  // reduction growing on the add path.
  const change: PlanChange = {
    kind: 'add_category', date: friday, category: 'strength_full',
    g1Route: 'deloaded',
  };
  const template = resolveTemplatePlanChange({
    change, visibleWeek: visibleWeek(weekStart),
  });
  assert(template, 'no registry template resolves for a full-body strength add');
  const built = buildCoachRevisionTemplateWorkout(template.templateId, friday);
  assert(built, 'the resolved template no longer builds');
  const deloadPolicy = resolveDoorDeloadPolicy({
    door: 'readiness',
    seasonPhase: useProfileStore.getState().onboardingData?.seasonPhase,
  })!;
  const expected = applyConditioningDeloadToExercises(
    applyStrengthDeloadToExercises(built.exercises, deloadPolicy),
    deloadPolicy,
  );
  const rowName = (row: { exercise?: { name?: string }; exerciseId: string }) =>
    row.exercise?.name ?? row.exerciseId;
  assert(JSON.stringify(expected.map(rowName)) !== JSON.stringify(built.exercises.map(rowName)) ||
    expected.some((row, index) => row.prescribedSets !== built.exercises[index]!.prescribedSets),
  'DELOAD_LAW changes nothing about this template — the assertion would be vacuous');

  const result = commitChange(weekStart, change);
  assert(result.ok, `routed add refused: ${result.message} ${JSON.stringify(result.rejected)}`);

  // Read the week the ATHLETE SEES, not the accepted projection: the
  // occupied-day add is written by the legacy override path, and the accepted
  // projection does not carry it. The athlete's screen does.
  const landed = visibleWeek(weekStart)
    .find((day) => day.date === friday)?.workout ?? null;
  assert(landed, 'G-1 is empty after the routed add');
  const landedByName = new Map(landed.exercises.map((row) => [rowName(row), row]));
  for (const row of expected) {
    const on = landedByName.get(rowName(row));
    assert(on, `the deloaded dose lost "${rowName(row)}" on the way to the day`);
    assert(on.prescribedSets === row.prescribedSets,
      `"${rowName(row)}" landed at ${on.prescribedSets} sets, not DELOAD_LAW's ${row.prescribedSets}`);
  }
  // And what the deload took OFF the template did not land either.
  const dropped = built.exercises
    .map(rowName)
    .filter((name) => !expected.some((row) => rowName(row) === name));
  for (const name of dropped) {
    assert(!landedByName.has(name),
      `"${name}" was deloaded out of the session and landed on G-1 anyway`);
  }
});

run('25 committing a routeless landing refuses with the ask, whatever the door', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);

  for (const change of [
    { kind: 'swap_category', date: friday, category: 'conditioning_hard' },
    { kind: 'add_category', date: friday, category: 'conditioning_hard' },
  ] as PlanChange[]) {
    const fresh = seed(profile());
    const week = fresh.microcycles[1]!.startDate.slice(0, 10);
    const before = storeFingerprint();
    const result = commitChange(week, change);
    assert(!result.ok, `a routeless ${change.kind} onto G-1 committed without an answer`);
    assert(result.appliedDates.length === 0,
      `the refused ${change.kind} still applied ${result.appliedDates.join(', ')}`);
    assert(storeFingerprint() === before,
      `the refused ${change.kind} mutated accepted state`);
    assert(result.message.startsWith(G1_LANDING_WARNING.ask.headline),
      `the refusal did not lead with the ask: "${result.message}"`);
    assert(!/_/.test(result.message),
      `the refusal reached the athlete as a raw code: "${result.message}"`);
  }
});

run('26 a route that would leave the day empty is refused, not published', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);
  const before = visibleWeek(weekStart).find((day) => day.date === friday)?.workout?.name;
  const fingerprint = storeFingerprint();

  // The reachable case, and it is a real one: DELOAD_LAW's row classifier is a
  // NAME regex, so the registry's single-row conditioning templates ("Flush Out
  // - 2min On / 1min Off") are taken for strength accessories and the accessory
  // trim deletes the only row. Until that classifier reads the structure the
  // workout already carries, the route has to refuse rather than land a day
  // that renders as rest under a "Done."
  const light = resolveTemplatePlanChange({
    change: { kind: 'swap_category', date: friday, category: 'conditioning_light' },
    visibleWeek: visibleWeek(weekStart),
  });
  assert(light, 'no template resolves for a light conditioning swap');
  const built = buildCoachRevisionTemplateWorkout(light.templateId, friday)!;
  const policy = resolveDoorDeloadPolicy({
    door: 'readiness',
    seasonPhase: useProfileStore.getState().onboardingData?.seasonPhase,
  })!;
  const deloadedRows = applyConditioningDeloadToExercises(
    applyStrengthDeloadToExercises(built.exercises, policy), policy);
  assert(deloadedRows.length === 0,
    `"${built.name}" survives its deload with ${deloadedRows.length} row(s) — this test `
    + 'no longer covers the empty-route case, and the classifier may have been fixed');

  const result = commitChange(weekStart, {
    kind: 'swap_category', date: friday, category: 'conditioning_light',
    g1Route: 'deloaded',
  });
  assert(!result.ok, `an empty route was published: "${result.message}"`);
  assert(!/^Done\./.test(result.message),
    `an empty route reported success: "${result.message}"`);
  assert(!/_/.test(result.message),
    `the refusal reached the athlete as a raw code: "${result.message}"`);
  assert(storeFingerprint() === fingerprint, 'the refused route mutated accepted state');
  assert(visibleWeek(weekStart).find((day) => day.date === friday)?.workout?.name === before,
    'the day changed despite the refusal');
});

// ── Copy provenance: code ↔ Sam's signed design document ──────────────────

/**
 * The four shapes the ask can take, and every one of them renders copy the
 * athlete reads. Sam signed the PATTERN on 2026-07-30 rather than four fixed
 * strings: route (a) names what the day would keep, and the source-day clause
 * renders only when there is a source day — a swap and an add have none.
 *
 * `A` is the original signed example (a Move onto the derived Gunshow) and its
 * rendering is unchanged, which is the point of pinning all four together.
 */
const SIGNED_EXAMPLE: G1LandingAskContext = {
  sourceDayName: 'Monday',
  g1DayName: 'Friday',
  gameDayName: 'Saturday',
  keptSessionName: 'Gunshow',
  accessoriesComeFromPumpSession: false,
};

const COPY_CONTEXTS: G1LandingAskContext[] = [
  SIGNED_EXAMPLE,
  // A swap onto the ordinary in-season G-1: the Gunshow is still what the day
  // would keep, but there is no source day to name.
  { ...SIGNED_EXAMPLE, sourceDayName: null },
  // A G-1 that holds a recovery session, reached by each kind of door.
  { ...SIGNED_EXAMPLE, keptSessionName: 'Recovery Session' },
  { ...SIGNED_EXAMPLE, sourceDayName: null, keptSessionName: 'Recovery Session' },
  // Move onto an empty G-1: nothing to keep, but the source day still stays put.
  { ...SIGNED_EXAMPLE, keptSessionName: null },
  // Add onto an empty G-1: nothing to keep and no source day.
  { ...SIGNED_EXAMPLE, sourceDayName: null, keptSessionName: null },
  // The no-accessories variant of each, which changes route (b)'s sub-line.
  { ...SIGNED_EXAMPLE, accessoriesComeFromPumpSession: true },
  { ...SIGNED_EXAMPLE, sourceDayName: null, accessoriesComeFromPumpSession: true },
];

run('18 every athlete-facing string is filed in Sam\'s design document', () => {
  const whole = readFileSync(
    join(__dirname, '..', '..', 'docs', 'G1_MOVE_ASK_FLOW_DESIGN_2026-07-29.md'),
    'utf8',
  );
  // SCOPED to the copy section. The first version read every blockquote in the
  // file, so the moment the document quoted anything else — Sam's fixture-week
  // ruling, in section 8 — his words were compared against athlete-facing copy
  // and the gate went red for no product reason. The copy section is the
  // contract; the rest of the document is prose about it.
  const COPY_HEADING = '## 4. Warning copy';
  const start = whole.indexOf(COPY_HEADING);
  assert(start >= 0, `the copy section "${COPY_HEADING}" is gone from the design document`);
  const after = whole.indexOf('\n## ', start + COPY_HEADING.length);
  const doc = whole.slice(start, after < 0 ? undefined : after);
  // Blockquoted copy, unwrapped. Markdown hard-wraps, so a line break in the
  // document must not read as a difference in the copy: blank quote lines end a
  // paragraph, a leading "- " starts a new item, and everything else continues
  // the current one. Bold markers come off BEFORE bullet markers — stripping
  // "- " first eats one asterisk of a leading "**bold**" and silently mangles
  // every headline, which is what the first run of this test did.
  const quoted: string[] = [];
  let current = '';
  const flush = () => {
    const line = current.replace(/\s+/g, ' ').trim();
    if (line) quoted.push(line);
    current = '';
  };
  for (const raw of doc.split('\n')) {
    if (!raw.startsWith('>')) { flush(); continue; }
    const source = raw.replace(/^>\s?/, '');
    // A wholly-bold line is a HEADLINE and stands alone. In the document it sits
    // directly above its body with no blank line between them; in the code they
    // are two separate strings, and joining them would compare a sentence the
    // athlete never sees as one block.
    if (/^\*\*.+\*\*$/.test(source.trim())) {
      flush();
      current = source.replace(/\*\*/g, '');
      flush();
      continue;
    }
    const line = source.replace(/\*\*/g, '');
    if (!line.trim()) { flush(); continue; }
    if (/^[-*]\s/.test(line)) {
      flush();
      current = line.replace(/^[-*]\s*/, '');
      continue;
    }
    current = current ? `${current} ${line.trim()}` : line;
  }
  flush();

  // Every rendering the athlete can meet, from every context shape. A pattern
  // signed once still has to produce filed strings for each shape it covers —
  // otherwise "Sam signed the pattern" becomes a licence for unread copy.
  const inCode = Array.from(new Set([
    G1_LANDING_WARNING.ask.headline,
    G1_LANDING_WARNING.deloadConfirm.body,
    ...COPY_CONTEXTS.flatMap((context) => [
      G1_LANDING_WARNING.ask.body(context),
      G1_LANDING_WARNING.deloadConfirm.headline(context),
      ...G1_LANDING_ROUTES.map((route) =>
        `${route.label(context)} — ${route.detail(context)}`),
    ]),
  ].map((line) => line.replace(/\s+/g, ' ').trim())));

  // Direction 1: nothing reaches a card that is not in the document.
  for (const line of inCode) {
    assert(quoted.includes(line),
      `UNFILED athlete-facing copy — not in the design document:\n  "${line}"`);
  }
  // Direction 2: nothing sits in the document that the code no longer says.
  for (const line of quoted) {
    assert(inCode.includes(line),
      `STALE copy in the design document — the code no longer says:\n  "${line}"`);
  }
});

console.log(`\nG-1 landing ask-flow totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('Failing:', failures.join(', '));
  process.exit(1);
}
