/**
 * G-1 LANDING ASK-FLOW — athlete-placed content outranks derived filler.
 *
 * Sam's ruling (2026-07-28/29), design: docs/G1_MOVE_ASK_FLOW_DESIGN_2026-07-29.md
 *
 * Generation never plans hard strength or conditioning on G-1 — unchanged. This
 * suite pins what happens when the ATHLETE puts a session there: the derived
 * Gunshow never silently eats it, and the athlete chooses from the ruled
 * pre-game routes through the accepted-state transaction owner.
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


import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync } from 'fs';
import { join } from 'path';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { seedManualOverride } from './support/programOverrideHarness';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
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
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import type { AthleteContext } from '../utils/sessionBuilder';
import {
  G1_LANDING_BACK_ROW,
  G1_LANDING_ROUTES,
  G1_LANDING_WARNING,
  g1LandingRoute,
  g1LandingRoutesFor,
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
const PLAN_CHANGE_SHEET = readFileSync(
  join(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'),
  'utf8',
);

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
    gender: 'male', seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
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
    gender: 'male', seasonPhase: 'Pre-season',
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
    surfaces: storedWorldSurfaces(state),
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
    onboardingData: onboarding,
  };
}

/**
 * A REAL conditioning session — the practice-match week's Tuesday Hard
 * Intervals. Synthesising one by filtering a strength session's rows produced an
 * empty session and made these assertions vacuous, which is what test 9 caught.
 */
function seedConditioningSession(): { weekStart: string; session: Workout } {
  // THE SUBJECT IS "a session carrying conditioning with NO accessories", and it is
  // ASKED FOR, never pinned to a coordinate.
  //
  // This used to seed `practiceMatchAthlete()` and take `dayOfWeek === 2`, which
  // was that week's standalone Hard Intervals. It broke on 2026-08-06 when
  // attach-first landing (`docs/FINDING_3_STEP2_BOUNDARY_REPORT_2026-08-06.md`)
  // put strength onto that day: the guard below refused to run vacuously and named
  // itself — `Lower Squat has accessory rows`. Attaching work to conditioning days
  // is the RULED repair order (Bible `:81`), measured with zero findings in every
  // world, so the DAY was the wrong coordinate, not the behaviour.
  //
  // WHY THIS ATHLETE. `practiceMatchAthlete()` drops team training, and with it the
  // week's composition no longer produces an accessory-free conditioning day in ANY
  // of its four microcycles. Keeping the team days back does — measured across
  // off-season, pre-season and in-season seeds at five phase-entry offsets, the
  // practice-match week with anchors carries one. The fixture keeps the
  // practice-match/G-1 context these cells need and simply stops removing the
  // anchors that shape it.
  //
  // Every week of the program is searched, and a miss still fails loudly with the
  // whole week printed: if no mode anywhere produced such a session, that would be
  // attach-first swallowing an authored session shape — a defect to stop on, not a
  // fixture to loosen.
  const program = seed(
    { ...profile(), seasonPhase: 'Pre-season' } as unknown as OnboardingData,
    { phaseEntryOffsetWeeks: 2 },
  );
  const qualifies = (workout: Workout): boolean =>
    workout.exercises.some(isConditioningExerciseRow) &&
    !workout.exercises.some((row) =>
      !isConditioningExerciseRow(row) && isAccessoryStrengthRow(row));
  let weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  let session: Workout | null = null;
  for (const cycle of program.microcycles) {
    const candidateWeek = cycle.startDate.slice(0, 10);
    const hit = accepted(candidateWeek).visibleWorkouts.find(qualifies);
    if (hit) {
      weekStart = candidateWeek;
      session = hit;
      break;
    }
  }
  assert(session,
    'no session in ANY week of the practice-match program carries conditioning WITHOUT '
    + 'accessory rows, so route (b) has no subject. That is attach-first swallowing an '
    + 'authored session shape, not a fixture to loosen. Weeks: '
    + program.microcycles.map((cycle) => {
      const ws = cycle.startDate.slice(0, 10);
      return `${ws}[` + accepted(ws).visibleWorkouts
        .map((workout) => `${workout.dayOfWeek}:${workout.name}(c=${
          workout.exercises.filter(isConditioningExerciseRow).length},a=${
          workout.exercises.filter((row) => !isConditioningExerciseRow(row) &&
            isAccessoryStrengthRow(row)).length})`).join(' ') + ']';
    }).join(' '));
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

run('6 the warning and boxed choices match the ruled male/female menus', () => {
  const context: G1LandingAskContext = {
    sourceDayName: 'Monday',
    g1DayName: 'Friday',
    gameDayName: 'Saturday',
    keptSessionName: null,
    accessoriesComeFromPumpSession: false,
  };
  const male = g1LandingRoutesFor({ ...context, athleteGender: 'male' });
  const female = g1LandingRoutesFor({ ...context, athleteGender: 'female' });

  assert(G1_LANDING_WARNING.ask.headline === 'Are you sure?',
    `warning title is "${G1_LANDING_WARNING.ask.headline}"`);
  assert(G1_LANDING_WARNING.ask.body(context) ===
    "Train hard Friday and you'll feel it Saturday",
  `warning subtitle is "${G1_LANDING_WARNING.ask.body(context)}"`);
  assert(male.map((route) => route.id).join(',') ===
    'deloaded,take_the_gunshow,take_the_primer,accessories_only',
  `male routes are ${male.map((route) => route.id).join(',')}`);
  assert(female.map((route) => route.id).join(',') ===
    'deloaded,take_the_primer,accessories_only',
  `female routes are ${female.map((route) => route.id).join(',')}`);
  assert(male.map((route) => route.label(context)).join('|') ===
    'Same session but easier|Gunshow|Primer|Accessories only',
  `male labels are ${male.map((route) => route.label(context)).join('|')}`);
  assert(female.map((route) => route.label(context)).join('|') ===
    'Same session but easier|Primer|Accessories only',
  `female labels are ${female.map((route) => route.label(context)).join('|')}`);
  assert(!male.some((route) => !route.commits) && !female.some((route) => !route.commits),
    'Leave Friday free is still rendered as a no-op option instead of Go back');

  const askStart = PLAN_CHANGE_SHEET.indexOf("step.kind === 'g1_ask'");
  const askEnd = PLAN_CHANGE_SHEET.indexOf("step.kind === 'team_night_content_ask'", askStart);
  assert(askStart >= 0 && askEnd > askStart, 'could not locate the G-1 sheet region');
  const askRegion = PLAN_CHANGE_SHEET.slice(askStart, askEnd);
  assert(/<MenuOption[\s\S]*?boxed[\s\S]*?testID=\{`g1-route-/.test(askRegion),
    'G-1 choices are not rendered as obvious boxed buttons');
  assert(!/sub=\{route\.detail/.test(askRegion),
    'G-1 choices still render per-option subtitles');
  assert(!/requiresSecondWarning|g1_deload_confirm/.test(askRegion),
    'Same session but easier still raises a second warning after this warning');
  assert(/commitPlanChange\([\s\S]*?g1Route: route\.id/.test(askRegion)
    && !/\bapply\([\s\S]*?g1Route: route\.id/.test(askRegion),
  'a G-1 answer is sent back through the warning preview instead of committing from the warning already shown');
});

run('7 legacy keep commits nothing; every visible choice commits directly', () => {
  assert(g1LandingRoute('keep_the_day').commits === false,
    'the legacy no-op route started committing');
  assert(G1_LANDING_ROUTES.every((route) => route.commits),
    `a visible route does not commit: ${G1_LANDING_ROUTES.filter((route) => !route.commits).map((route) => route.id)}`);
});

run('7a Gunshow and Primer ids materialise the sessions their labels promise', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[0]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1);
  assert(source, 'strength source missing');
  const targetDate = addDaysISO(weekStart, 4);
  const male = profile();
  const gunshow = placeSessionForRoute({
    route: 'take_the_gunshow', landingWorkout: source, targetDate,
    athlete: athleteContext(), profile: male,
  });
  const primer = placeSessionForRoute({
    route: 'take_the_primer', landingWorkout: source, targetDate,
    athlete: athleteContext(), profile: male,
  });
  assert(gunshow?.name === 'Gunshow',
    `Gunshow route materialised ${gunshow?.name ?? 'nothing'}`);
  assert(primer?.name === 'Primer',
    `Primer route materialised ${primer?.name ?? 'nothing'}`);
  assert(gunshow.exercises.length > 0 && primer.exercises.length > 0,
    'a named pre-game option materialised an empty session');
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

run('9 route (b) on a session with no accessories is the pump session', () => {
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
  const context = resolveG1LandingAsk({
    sourceDate: weekStart, targetDate: addDaysISO(weekStart, 4),
    landingWorkout: conditioningOnly, existingWorkout: null, gameDates: gameDatesFor(weekStart, addDaysISO(weekStart, 4)),
  });
  assert(context?.accessoriesComeFromPumpSession,
    'the ask did not notice there were no accessories to keep');
});

run('10 Same session but easier preserves the session, lowers its dose and is G-1-safe', () => {
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
    preserveExerciseSelection: true,
  })!;
  const expected = applyConditioningDeloadToExercises(
    applyStrengthDeloadToExercises(source.exercises, policy),
    policy,
  );
  assert(JSON.stringify(placed.exercises) === JSON.stringify(expected),
    'route (c) does not equal the DELOAD_LAW appliers — a second reduction exists');
  assert(identity(placed) === identity(source),
    'route (c) changed the session identity');
  assert(placed.exercises.length === source.exercises.length,
    `Same session but easier kept ${placed.exercises.length} of ${source.exercises.length} exercises`);
  assert(classifyVisibleSession(placed).stressLevel === 'low',
    `Same session but easier still classifies ${classifyVisibleSession(placed).stressLevel} on G-1`);
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
    applyOverride: () => {
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
    applyOverride: () => { throw new Error('single-date writer'); },
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
    applyOverride: () => { throw new Error('single-date writer'); },
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
    applyOverride: (date, workout, context) =>
      seedManualOverride(date, workout, context),
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
  // RE-POINTED 2026-08-01 (deleted-type retirement): the planted workout is
  // deliberately LEGACY-shaped ('Recovery Session'), and the resolver now
  // rebuilds a displaceable recovery-shaped template as the mobility flow its
  // contents are — so the session the athlete SEES, and the ask must name, is
  // "Mobility". The cell's law is unchanged: the ask names what the day keeps.
  assert(preview.g1Ask.keptSessionName === 'Mobility',
    `route (a) would keep "${preview.g1Ask.keptSessionName}" — the visible session on `
    + 'the day is the rebuilt "Mobility" flow (deleted-type retirement, 2026-08-01)');
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

run('23 route (b) refuses honestly rather than landing the session unchanged', () => {
  // SAM'S RULING 4 (2026-07-30). Over a registry strength template, route (b)
  // strips nothing: every row classifies as an accessory because
  // `isMainStrengthRow` asks the pool registry for an anchor role and template
  // rows are not pool slots. The athlete asked for the light version and was
  // handed the whole session — his finding, twice, in two different shapes.
  //
  // Until 5D.4's classifier can tell the rows apart, the route refuses. It is
  // NOT allowed to no-op, and this test dies with the containment.
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);
  const before = visibleWeek(weekStart).find((day) => day.date === friday)?.workout?.name;

  const template = resolveTemplatePlanChange({
    change: { kind: 'swap_category', date: friday, category: 'strength_full' },
    visibleWeek: visibleWeek(weekStart),
  })!;
  const built = buildCoachRevisionTemplateWorkout(template.templateId, friday)!;
  assert(built.exercises.every((row) => !isMainStrengthRow(row)),
    'the registry template now has a main lift — 5D.4 may have landed, in which '
    + 'case this containment and this test should both be deleted');

  const result = commitChange(weekStart, {
    kind: 'swap_category', date: friday, category: 'strength_full',
    g1Route: 'accessories_only',
  });
  assert(!result.ok, 'route (b) landed the session unchanged and called it accessories');
  assert(!/_/.test(result.message),
    `the refusal reached the athlete as a raw code: "${result.message}"`);
  assert(visibleWeek(weekStart).find((day) => day.date === friday)?.workout?.name === before,
    'the refused route changed the day anyway');
});

run('23b route (b) still strips a real session that HAS main lifts', () => {
  // Non-vacuity for the refusal above: the route is contained, not broken. A
  // generated session's rows are pool slots, so the classifier can tell them
  // apart and route (b) does exactly what it says.
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const source = workoutOn(weekStart, 1)!;
  assert(source.exercises.some(isMainStrengthRow),
    'the seeded Monday session has no main lifts — this test would be vacuous');

  const placed = placeSessionForRoute({
    route: 'accessories_only', landingWorkout: source,
    targetDate: addDaysISO(weekStart, 4),
    athlete: athleteContext(), profile: useProfileStore.getState().onboardingData,
  });
  assert(placed, 'route (b) refused a session it can genuinely strip');
  assert(placed.exercises.every((row) => !isMainStrengthRow(row)),
    'a main lift survived the accessories-only strip');
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
    preserveExerciseSelection: true,
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
  assert(landed.g1Adjustment === 'same_session_easier',
    'the accepted visible session lost the typed Same session but easier adjustment');
  assert(classifyVisibleSession(landed).stressLevel === 'low',
    `the accepted visible easier session reclassified ${classifyVisibleSession(landed).stressLevel}`);
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

run('26 Same session but easier never collapses a one-row session into a refusal', () => {
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);
  const before = visibleWeek(weekStart).find((day) => day.date === friday)?.workout?.name;
  const fingerprint = storeFingerprint();

  // Found on glass 2026-08-26: this exact one-row category was reduced to no
  // rows, sent through another warning, then refused. “Same session” means its
  // selected row survives; “easier” changes the dose and stress, not identity.
  const light = resolveTemplatePlanChange({
    change: { kind: 'swap_category', date: friday, category: 'conditioning_light' },
    visibleWeek: visibleWeek(weekStart),
  });
  assert(light, 'no template resolves for a light conditioning swap');
  const built = buildCoachRevisionTemplateWorkout(light.templateId, friday)!;
  const policy = resolveDoorDeloadPolicy({
    door: 'readiness',
    seasonPhase: useProfileStore.getState().onboardingData?.seasonPhase,
    preserveExerciseSelection: true,
  })!;
  const deloadedRows = applyConditioningDeloadToExercises(
    applyStrengthDeloadToExercises(built.exercises, policy), policy);
  assert(deloadedRows.length === built.exercises.length && deloadedRows.length > 0,
    `"${built.name}" kept ${deloadedRows.length} of ${built.exercises.length} rows`);

  const result = commitChange(weekStart, {
    kind: 'swap_category', date: friday, category: 'conditioning_light',
    g1Route: 'deloaded',
  });
  assert(result.ok, `the one-row easier session was refused: "${result.message}"`);
  assert(storeFingerprint() !== fingerprint, 'the accepted easier route changed no stored state');
  const after = visibleWeek(weekStart).find((day) => day.date === friday)?.workout;
  assert(after?.name !== before && (after?.exercises.length ?? 0) > 0,
    'the accepted easier session did not replace the prior G-1 content');
  assert(after?.g1Adjustment === 'same_session_easier',
    'the accepted one-row easier session lost its typed G-1 adjustment');
  assert(after && classifyVisibleSession(after).stressLevel === 'low',
    `the accepted one-row easier session reclassified ${after ? classifyVisibleSession(after).stressLevel : 'missing'}`);
});

run('26b every addable work category can take the one-warning easier route onto G-1', () => {
  const categories = [
    'conditioning_light',
    'conditioning_hard',
    'strength_upper',
    'strength_lower',
    'strength_full',
  ] as const;

  for (const category of categories) {
    const program = seed(profile());
    const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
    const friday = addDaysISO(weekStart, 4);
    plantOnFriday(weekStart, {
      name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery',
    });
    const template = resolveTemplatePlanChange({
      change: { kind: 'add_category', date: friday, category },
      visibleWeek: visibleWeek(weekStart),
    });
    assert(template, `${category} no longer resolves an add template`);
    const built = buildCoachRevisionTemplateWorkout(template.templateId, friday);
    assert(built && built.exercises.length > 0,
      `${category} built an empty session before the G-1 route`);
    const expected = placeSessionForRoute({
      route: 'deloaded',
      landingWorkout: built,
      targetDate: friday,
      athlete: athleteContext(),
      profile: useProfileStore.getState().onboardingData,
    });
    assert(expected && expected.exercises.length === built.exercises.length,
      `${category} easier route kept ${expected?.exercises.length ?? 0} of ${built.exercises.length} exercises before save`);

    const result = commitChange(weekStart, {
      kind: 'add_category', date: friday, category, g1Route: 'deloaded',
    });
    assert(result.ok, `${category} easier add was refused: ${result.message}`);
    const landed = visibleWeek(weekStart)
      .find((day) => day.date === friday)?.workout ?? null;
    assert(landed, `${category} easier add left G-1 empty`);
    const landedSignatures = landed.exercises.map((row) =>
      `${row.exercise?.name ?? row.exerciseId}:${row.prescribedSets}:${row.prescribedRepsMin}:${row.prescribedRepsMax}`);
    for (const row of expected.exercises) {
      const signature = `${row.exercise?.name ?? row.exerciseId}:${row.prescribedSets}:${row.prescribedRepsMin}:${row.prescribedRepsMax}`;
      const index = landedSignatures.indexOf(signature);
      assert(index >= 0, `${category} easier add lost or changed ${signature}`);
      landedSignatures.splice(index, 1);
    }
    assert(landed.g1Adjustment === 'same_session_easier',
      `${category} easier add lost its typed G-1 adjustment`);
    assert(classifyVisibleSession(landed).stressLevel === 'low',
      `${category} easier add reclassified ${classifyVisibleSession(landed).stressLevel}`);
  }
});

run('27 the card names BOTH what the day held and what the athlete added', () => {
  // Sam's device confirm (2026-07-30): the title on the day he added an
  // optional session to his G-1 recovery read "Full Body Strength" — the
  // recovery had not gone anywhere, it had just stopped being named. By the
  // time this renders the ask has already gated the change, so the honest
  // title is the one that names what the athlete chose ALONGSIDE what was
  // there. Same join the team-combo days have always used.
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const held = plantOnFriday(weekStart, {
    name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery',
  });
  const friday = addDaysISO(weekStart, 4);

  const result = commitChange(weekStart, {
    kind: 'add_category', date: friday, category: 'strength_full',
    g1Route: 'deloaded',
  });
  assert(result.ok, `routed add refused: ${result.message}`);

  const title = visibleWeek(weekStart)
    .find((day) => day.date === friday)?.workout?.name ?? '';
  // RE-POINTED 2026-08-01 (deleted-type retirement): the planted 'Recovery
  // Session' is legacy-shaped on purpose, and the visible session it resolves
  // to is now the rebuilt "Mobility" flow — so the word the title must keep is
  // the one the athlete actually sees. The cell's law is unchanged: the card
  // names BOTH what the day held and what was added.
  const heldVisibleName = 'Mobility';
  assert(title.includes(heldVisibleName),
    `the title "${title}" no longer names the ${heldVisibleName} session (rebuilt from `
    + `the planted legacy ${held.name}) that is still on the day`);
  assert(title.replace(heldVisibleName, '').trim().length > 0,
    `the title "${title}" names only what was already there, not what was added`);
  assert(title.startsWith(`${heldVisibleName} + `),
    `the title "${title}" does not use the team-combo join`);
});

run('28 a routed landing on an EMPTY G-1 lands, instead of being refused', () => {
  // SAM'S RE-TEST, STEP 4. He binned the session on his G-1 Friday and the day
  // was dead from then on: every add came back "I couldn't safely make that
  // change". The tape gave the code — `unknown_section_id`.
  //
  // It is a hole in this unit's own fix. Added content is authorised by
  // byte-exact signature match, and `d0437ce` taught the policy to authorise
  // ROUTED templates too — inside a loop over days that begins
  // `if (!day.workout) continue;`. An empty day therefore authorised the plain
  // template and nothing else, so the athlete answered the ask and the answer
  // came back unrecognised. A day with nothing on it is exactly the day an
  // add is FOR.
  const program = seed(profile());
  const weekStart = program.microcycles[1]!.startDate.slice(0, 10);
  const friday = addDaysISO(weekStart, 4);

  const binned = commitChange(weekStart, { kind: 'remove_session', date: friday });
  assert(binned.ok, `the bin failed: ${binned.message}`);
  assert(!visibleWeek(weekStart).find((day) => day.date === friday)?.workout,
    'the bin did not leave G-1 empty — this test no longer covers the empty case');

  const added = commitChange(weekStart, {
    kind: 'add_category', date: friday, category: 'strength_full',
    g1Route: 'deloaded',
  });
  assert(added.ok,
    `the day the athlete emptied is locked against them: "${added.message}" `
    + `${JSON.stringify(added.rejected)}`);
  assert(visibleWeek(weekStart).find((day) => day.date === friday)?.workout,
    'the add reported success over a day that stayed empty');
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
  { ...SIGNED_EXAMPLE, athleteGender: 'male' },
  { ...SIGNED_EXAMPLE, athleteGender: 'female' },
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
    ...COPY_CONTEXTS.flatMap((context) => [
      G1_LANDING_WARNING.ask.body(context),
      G1_LANDING_BACK_ROW.label(),
      ...g1LandingRoutesFor(context).map((route) => route.label(context)),
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
totalsPrinted(failed);
if (failures.length > 0) {
  console.error('Failing:', failures.join(', '));
  process.exit(1);
}
