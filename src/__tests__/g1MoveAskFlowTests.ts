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

console.log(`\nG-1 move ask-flow totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('Failing:', failures.join(', '));
  process.exit(1);
}
