/**
 * Athlete-requested session deletion — persisted ownership and repair.
 * Run: npm run test:athlete-session-deletion
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
  throw new Error('NETWORK DISABLED — athlete deletion repair must be local');
};
process.env.TZ = 'Australia/Melbourne';


import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type {
  OnboardingData,
  TrainingProgram,
  UserRemovalConstraint,
  UserRemovalScope,
  Workout,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore, canonicaliseAcceptedStateCandidate } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { buildReadinessSignalPatch } from '../utils/readiness';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  commitAthleteSessionDeletionTransaction,
  commitProgramSetupRebuildTransaction,
} from '../store/acceptedStateTransaction';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  applyUserRemovalConstraintsToWeek,
  userRemovalConstraintId,
} from '../rules/userRemovalConstraints';
import { isAthletePlacedSession } from '../rules/athletePlacement';
import { reduceAcceptedSessionForAthleteRemoval } from '../utils/sessionComponents';
import { rebuildLocalWeek } from '../utils/weekRebuild';
import { addDaysISO } from '../utils/programBlockState';
import { executeProgramControlAction } from '../utils/programControlActions';
import { seedManualOverride } from './support/programOverrideHarness';
import { applyPlanChange, previewPlanChangeRisk } from '../utils/planChangeProducer';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import {
  createEmptyReversibleAdjustmentLedger,
  normalizeReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';
import { commitClearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';

const WEEK = '2026-07-13';
const FRIDAY = '2026-07-17';
const SATURDAY = '2026-07-18';
const SUNDAY = '2026-07-19';
const NEXT_WEEK = '2026-07-20';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]')) return;
  originalWarn(...args);
};

let regressions = 0;
let properties = 0;
let mutations = 0;
const failures: string[] = [];

/**
 * DECLARED-RED — a measured defect that is CHARACTERISED but not yet ruled, and
 * which owes the deletion of its own entry in the commit that pays it. An
 * UNDECLARED red still fails outright, and a declared red that stops redding
 * fails the suite until its entry is removed.
 *
 * Regressions 15 and 17 were declared here on 2026-08-06 and PAID the same day:
 * an accepted-week repair destroyed the week's offer and nothing could restore
 * it, because there was exactly one placer and it ran only at generation. Sam's
 * ruling (`docs/1B_OFFER_SURVIVAL_RULINGS_2026-08-06.md`) made the offer a
 * property of the week at all times, and the shared owner
 * (`rules/section18OfferPlacement`) now presents it at the one point every path
 * converges. Both cells green on their ORIGINAL signed sentences — the "I also
 * rebalanced Monday" clause is gone because nothing needs rebalancing.
 *
 * The list is empty and the mechanism stays armed: it is what makes the next
 * declared red pay for itself too.
 */
interface DeclaredRed {
  readonly id: string;
  readonly matches: RegExp;
  readonly paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [];

const declaredRedHits = new Set<string>();

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(kind: 'regression' | 'property' | 'mutation', name: string, body: () => void): void {
  try {
    body();
    if (kind === 'regression') regressions += 1;
    else if (kind === 'property') properties += 1;
    else mutations += 1;
    console.log(`  PASS [${kind}] ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const declared = DECLARED_RED.find(
      (entry) => entry.id === name && entry.matches.test(message),
    );
    if (declared) {
      declaredRedHits.add(declared.id);
      if (kind === 'regression') regressions += 1;
      else if (kind === 'property') properties += 1;
      else mutations += 1;
      console.log(`  RED (declared, paid by ${declared.paidBy}) [${kind}] ${name}`);
      console.log(`      ${message.split('\n')[0]}`);
      return;
    }
    failures.push(`${kind}: ${name}`);
    console.error(`  FAIL [${kind}] ${name}`, error);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
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
    ...overrides,
  };
}

function emptyContext(markedDays: Record<string, CalendarDayType>) {
  return {
    markedDays,
    readinessSignalsByDate: {},
    activeConstraints: [],
    activeInjury: null,
    revision: 1,
    lastTransaction: 'athlete-removal-test:seed',
  };
}

function seed(args: {
  athlete?: OnboardingData;
  weekStart?: string;
  phaseEntryWeekStartISO?: string;
  targetMicrocycleIndex?: number;
  markedDays?: Record<string, CalendarDayType>;
} = {}): TrainingProgram {
  const athlete = args.athlete ?? profile();
  const weekStart = args.weekStart ?? WEEK;
  const phaseEntryWeekStartISO = args.phaseEntryWeekStartISO ?? weekStart;
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: weekStart,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  const target = program.microcycles[args.targetMicrocycleIndex ?? 0] ?? program.microcycles[0];
  const marks = args.markedDays ?? {};
  useCalendarStore.setState({ markedDays: marks, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  const coachState = useCoachUpdatesStore.getState();
  useCoachUpdatesStore.setState({
    activeConstraints: coachState.activeConstraints.length === 0
      ? coachState.activeConstraints
      : [],
    activeInjury: null,
  } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: target ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: emptyContext(marks),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  return program;
}

function accepted(weekStart = WEEK) {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(state),
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
}

function byDay(weekStart = WEEK): Map<number, Workout> {
  return new Map(accepted(weekStart).visibleWorkouts.map((workout) =>
    [workout.dayOfWeek, workout]));
}

function dateForDay(weekStart: string, day: number): string {
  return addDaysISO(weekStart, day === 0 ? 6 : day - 1);
}

function visibleWeek(weekStart = WEEK) {
  return resolveWeekWithConditioning(weekStart, buildScheduleStateImperative());
}

function deleteWorkout(args: {
  date: string;
  workout: Workout;
  scope?: UserRemovalScope;
  remainingWorkout?: Workout | null;
  source?: 'tap' | 'coach';
}): void {
  commitAthleteSessionDeletionTransaction({
    date: args.date,
    reason: `test:athlete-delete:${args.date}`,
    source: args.source ?? 'tap',
    scope: args.scope ?? 'whole_session',
    originalWorkout: args.workout,
    remainingWorkout: args.remainingWorkout ?? null,
    equivalentExposureMayRelocate: true,
  });
}

function deleteThroughRealSheetDoor(
  date: string,
  scope?: 'strength' | 'conditioning',
  weekStart = WEEK,
): ReturnType<typeof applyPlanChange> {
  const change = { kind: 'remove_session' as const, date, ...(scope ? { scope } : {}) };
  const before = JSON.stringify({
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    context: useProgramStore.getState().acceptedMaterialContext,
  });
  const week = visibleWeek(weekStart);
  const preview = previewPlanChangeRisk({
    change,
    visibleWeek: week,
    todayISO: WEEK,
    profile: useProfileStore.getState().onboardingData ?? undefined,
  });
  assert(preview.ok, `preview rejected deletion: ${JSON.stringify(preview.rejected)}`);
  assert(JSON.stringify({
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    context: useProgramStore.getState().acceptedMaterialContext,
  }) === before, 'deletion preview mutated accepted state');
  const result = applyPlanChange({
    change,
    visibleWeek: week,
    todayISO: WEEK,
    trace: preview.trace,
    applyOverride: () => {
      throw new Error('athlete deletion must not use the single-date writer');
    },
  });
  assert(result.ok, `commit rejected deletion: ${JSON.stringify(result.rejected)}`);
  return result;
}

/**
 * MONDAY–FRIDAY'S WORK, AS THE ATHLETE SEES IT — the comparable half of "a
 * Sunday deletion changes nothing else".
 *
 * `row.workoutId` used to be pinned here and was REMOVED on 2026-08-06 after
 * being measured, not after being argued with. R5.3 leg (i) made the fixture
 * door publish its DECLARATION and never its content, so the week that exists
 * immediately after a fixture decision is DERIVED from the microcycle and its
 * rows carry the plain parent id (`w-coach-1`), while the week an accepted
 * deletion PUBLISHES is materialised through the week overlay and carries
 * `w-coach-1:week-overlay:2026-07-13`. The snapshot therefore straddled a
 * derive->publish boundary and pinned the one field that boundary renames.
 *
 * Measured before changing: on `feat/stage-b-stage2` this cell is green, and
 * the state AFTER the deletion is BYTE-IDENTICAL on both branches — same
 * overlay, same reason, same ids. Only the pre-deletion snapshot moved, and it
 * moved because leg (i) intended it to. Friday proves the suffix is namespacing
 * and not content: `exact-accessories:2026-07-17` already carried it on BOTH
 * sides of the comparison, on both branches, before anything was deleted.
 *
 * The claim the field was standing in for is kept and made explicit instead —
 * `assertRowParentJoins` pins that every row's parent key resolves to its own
 * workout, which is what could actually break, and which a literal string
 * comparison could never have told apart from a rename.
 */
function preservedDaySnapshot(): string {
  return JSON.stringify([1, 2, 3, 4, 5].map((day) => {
    const workout = byDay().get(day);
    return {
      day,
      planEntryId: workout?.planEntryId ?? null,
      name: workout?.name ?? null,
      exercises: workout?.exercises.map((row) => ({
        id: row.id,
        exerciseId: row.exerciseId,
        sets: row.prescribedSets,
        repsMin: row.prescribedRepsMin,
        repsMax: row.prescribedRepsMax,
        weight: row.prescribedWeightKg,
        rest: row.restSeconds,
      })) ?? [],
    };
  }));
}

/** Every visible row's parent key resolves to the workout it is rendered under. */
function assertRowParentJoins(label: string): void {
  for (const [day, workout] of byDay()) {
    for (const row of workout.exercises ?? []) {
      assert(row.workoutId === workout.id,
        `${label}: day ${day} row ${row.id} parents to ${row.workoutId}, not ${workout.id}`);
    }
  }
}

function seedExactSundayRegression(): {
  athlete: OnboardingData;
  sunday: Workout;
  preservedDays: string;
} {
  const athlete = profile();
  seed({ athlete, markedDays: { [SATURDAY]: 'game' } });
  const rebuilt = rebuildLocalWeek({
    baseProfile: athlete,
    newGameDay: null,
    scope: 'weekOverlay',
    targetDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK,
  });
  const state = useProgramStore.getState();
  // THE DOOR'S RETURN VALUE, not the store — R5.3 leg (i) (2026-08-06) stopped
  // the fixture door publishing an overlay for the week it decides, and this
  // seed was reading that published output back to get a materialised week to
  // plant into. The replan is still computed and still returned; only the
  // publication went. Nothing about what this seed BUILDS has changed.
  const overlay = clone(state.weekScopedOverlays[WEEK] ?? rebuilt.overlay);
  assert(overlay, 'the fixture rebuild produced no week for this seed to plant into');
  // THE CONDITIONING TEMPLATE COMES FROM THE DERIVED WEEK, not from a
  // published payload (seat answer 2, 2026-08-07 — fixture-fidelity class).
  //
  // `hard` is a TEMPLATE, cloned into the Sunday `Hard Intervals` this seed
  // needs and (absent an optional source) into the Saturday `Gunshow`. Both
  // days are then overwritten below, so nothing this seed BUILDS depends on
  // where the template was read from.
  //
  // The order below is the point. This used to read `overlay.workoutsByDate`
  // FIRST — the fixture door's published replan — and fall back to the derived
  // week. That made 18 deletion cells depend on a STORED OUTPUT: when leg (v)
  // stopped publishing the payload, 16 of them red at this line, and the totals
  // read as "leg (v) costs 8 deletion cells" when not one of those cells is
  // about publication (docs/R53_FREED_DAY_PRODUCER_NAMED_2026-08-07.md).
  //
  // Reading the DERIVED week first is the north star applied to a fixture:
  // store only decisions, derive everything else. The published payload stays
  // as the fallback so the seeded world is unchanged where both agree — and
  // these cells are about DELETION, so their coordinate must not drift.
  const hard = accepted().visibleWorkouts.find((workout) =>
    /Hard Conditioning/i.test(workout.name))
    ?? Object.values(overlay.workoutsByDate).find((workout) =>
      !!workout && /Hard Conditioning/i.test(workout.name));
  assert(hard, 'bye-build hard conditioning template missing from both the derived week '
    + `and the rebuilt week; derived reads ${JSON.stringify(
      accepted().visibleWorkouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`))}`
    + `, rebuilt reads ${JSON.stringify(
      Object.entries(overlay.workoutsByDate).map(([date, workout]) =>
        `${date}:${workout?.name ?? 'REST'}`))}`);
  const optionalSource = accepted().visibleWorkouts.find((workout) =>
    workout.sessionTier === 'optional' && workout.dayOfWeek !== 6);
  const gunshow: Workout = optionalSource
    ? {
        ...clone(optionalSource),
        id: `exact-gunshow:${SATURDAY}`,
        planEntryId: `exact-gunshow:${SATURDAY}`,
        dayOfWeek: 6,
        name: 'Gunshow',
        exercises: optionalSource.exercises.map((row, index) => ({
          ...clone(row),
          id: `exact-gunshow:${SATURDAY}:row:${index + 1}`,
          workoutId: `exact-gunshow:${SATURDAY}`,
        })),
      }
    : {
        id: `exact-gunshow:${SATURDAY}`,
        microcycleId: hard.microcycleId,
        dayOfWeek: 6,
        name: 'Gunshow',
        description: 'Optional arms and shoulders.',
        durationMinutes: 30,
        intensity: 'Light',
        workoutType: 'Strength',
        sessionTier: 'optional',
        planEntryId: `exact-gunshow:${SATURDAY}`,
        exercises: [],
        createdAt: hard.createdAt,
        updatedAt: hard.updatedAt,
      };
  const accessoriesId = `exact-accessories:${FRIDAY}:week-overlay:${FRIDAY}`;
  const accessories: Workout = {
    ...clone(gunshow),
    id: accessoriesId,
    planEntryId: `exact-accessories:${FRIDAY}`,
    dayOfWeek: 5,
    name: 'Accessories',
    exercises: gunshow.exercises.map((row, index) => ({
      ...clone(row),
      id: `exact-accessories:${FRIDAY}:row:${index + 1}`,
      workoutId: accessoriesId,
    })),
  };
  const sunday = { ...clone(hard), dayOfWeek: 0, name: 'Hard Intervals' };
  if (optionalSource) {
    overlay.workoutsByDate[dateForDay(WEEK, optionalSource.dayOfWeek)] = null;
  }
  overlay.workoutsByDate[FRIDAY] = accessories;
  overlay.workoutsByDate[SATURDAY] = gunshow;
  overlay.workoutsByDate[SUNDAY] = sunday;
  useProgramStore.setState({
    weekScopedOverlays: { ...state.weekScopedOverlays, [WEEK]: overlay },
  });
  const preservedDays = preservedDaySnapshot();
  assert(byDay().get(0)?.name === 'Hard Intervals', 'Sunday hard-interval seed failed');
  assert(byDay().get(5)?.name === 'Accessories', 'Friday Accessories seed failed');
  assert(byDay().get(6)?.name === 'Gunshow', 'Saturday Gunshow seed failed');
  return { athlete, sunday, preservedDays };
}

function visibleSemantic(weekStart = WEEK): string {
  const week = accepted(weekStart);
  return JSON.stringify({
    days: week.visibleWorkouts.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      planEntryId: workout.planEntryId ?? null,
      rows: workout.exercises.map((row) => row.id),
    })).sort((left, right) => left.day - right.day),
    strength: week.evaluation.ledger.mainStrength.achievedCount,
    conditioning: week.evaluation.ledger.conditioning.coreCount,
    sprint: week.evaluation.ledger.sprintHighSpeed.achievedCount,
    reductions: week.contract.authorisedReductions.map((entry) => ({
      metric: entry.metric,
      reason: entry.reason,
      target: entry.reducedTarget,
    })).sort((left, right) => left.metric.localeCompare(right.metric)),
  });
}

function prescriptionSignature(workout: Workout | null | undefined): string {
  return JSON.stringify({
    planEntryId: workout?.planEntryId ?? null,
    rows: workout?.exercises.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      weight: row.prescribedWeightKg,
      rest: row.restSeconds,
    })) ?? [],
  });
}

function mainStrengthPrescriptionSignature(workout: Workout | null | undefined): string {
  return JSON.stringify({
    planEntryId: workout?.planEntryId ?? null,
    rows: workout?.exercises.filter((row) =>
      row.section18Evidence?.role === 'main_strength').map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      weight: row.prescribedWeightKg,
      rest: row.restSeconds,
    })) ?? [],
  });
}

function seedExactInSeasonStrengthWeek(): OnboardingData {
  const athlete = profile();
  seed({ athlete, markedDays: { [SATURDAY]: 'game' } });
  assert(byDay().get(1)?.name === 'Lower Body Strength', 'Monday lower precondition missing');
  assert(byDay().get(2)?.name === 'Team Training + Upper Pull',
    'Tuesday pull + Team Training precondition missing');
  assert(byDay().get(4)?.name === 'Team Training + Upper Push',
    'Thursday push + Team Training precondition missing');
  return athlete;
}

function reloadAcceptedState(athlete: OnboardingData): void {
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseAcceptedStateCandidate(persisted, {
    profile: athlete,
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
}

console.log('\n-- Athlete session deletion regressions --');

run('regression', '1 exact Sunday CORE conditioning deletion relocates to Saturday', () => {
  const seeded = seedExactSundayRegression();
  deleteThroughRealSheetDoor(SUNDAY);
  const week = accepted();
  const map = byDay();
  assert(!map.has(0), `Sunday resurrected as ${map.get(0)?.name}`);
  assert(/Hard (Conditioning|Intervals)/i.test(map.get(6)?.name ?? ''),
    `Saturday=${map.get(6)?.name}`);
  assert(map.get(6)?.sessionTier === 'core', 'Saturday did not become CORE conditioning');
  assert(!week.visibleWorkouts.some((workout) => workout.name === 'Gunshow'),
    'lower-priority Saturday Gunshow survived required relocation');
  assert(week.evaluation.ledger.conditioning.coreCount === 3,
    `conditioning=${week.evaluation.ledger.conditioning.coreCount}`);
  const preservedDaysAfter = preservedDaySnapshot();
  assert(preservedDaysAfter === seeded.preservedDays,
    `Monday–Friday changed\nbefore=${seeded.preservedDays}\nafter=${preservedDaysAfter}`);
  assertRowParentJoins('after Sunday deletion');
  const hardCredits = week.evaluation.ledger.conditioning.credits.filter((credit) =>
    credit.source === 'app' && credit.stress === 'hard');
  assert(hardCredits.length === 1 && hardCredits[0].dayOfWeek === 6,
    `hard credits=${JSON.stringify(hardCredits)}`);
});

run('regression', '2 CORE strength deletion repairs on another valid day', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Off-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  });
  seed({ athlete, phaseEntryWeekStartISO: addDaysISO(WEEK, -28) });
  const before = accepted();
  const target = before.visibleWorkouts.find((workout) =>
    workout.sessionTier === 'core' && before.evaluation.ledger.mainStrength.sessionDays
      .includes(workout.dayOfWeek));
  assert(target, 'CORE strength target missing');
  const date = dateForDay(WEEK, target.dayOfWeek);
  deleteThroughRealSheetDoor(date);
  const after = accepted();
  assert(!byDay().has(target.dayOfWeek), 'deleted strength date is not Rest');
  assert(after.evaluation.blockingViolations.length === 0,
    JSON.stringify(after.evaluation.blockingViolations));
  assert(after.evaluation.ledger.mainStrength.achievedCount ===
    before.evaluation.ledger.mainStrength.achievedCount,
  `strength ${before.evaluation.ledger.mainStrength.achievedCount}->${after.evaluation.ledger.mainStrength.achievedCount}`);
  assert(after.visibleWorkouts.some((workout) =>
    workout.dayOfWeek !== target.dayOfWeek && workout.planEntryId === target.planEntryId),
  'accepted strength identity was not relocated');
});

run('regression', '3 optional session deletes without replacement', () => {
  const { sunday: _sunday } = seedExactSundayRegression();
  const gunshow = byDay().get(6);
  assert(gunshow?.sessionTier === 'optional', 'optional precondition missing');
  const before = accepted();
  deleteThroughRealSheetDoor(SATURDAY);
  const after = accepted();
  assert(!byDay().has(6), 'optional Saturday was replaced');
  assert(after.evaluation.ledger.mainStrength.achievedCount === before.evaluation.ledger.mainStrength.achievedCount,
    'optional deletion changed core strength');
  assert(after.evaluation.ledger.conditioning.coreCount === before.evaluation.ledger.conditioning.coreCount,
    'optional deletion changed core conditioning');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'optional deletion created a reduction');
});

run('regression', '4 component deletion preserves the rest of a stacked day', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  });
  seed({ athlete });
  const stacked = accepted().visibleWorkouts.find((workout) => workout.hasCombinedConditioning);
  assert(stacked, 'stacked strength+conditioning precondition missing');
  const date = dateForDay(WEEK, stacked.dayOfWeek);
  const templateCatalog = require('../utils/coachRevisionTemplates') as {
    listCoachRevisionTemplates: () => unknown[];
  };
  const liveWriteValidation = require('../utils/postGenerationConstraintValidation') as {
    validateLiveWorkoutWrite: (...args: unknown[]) => unknown;
  };
  const originalListTemplates = templateCatalog.listCoachRevisionTemplates;
  const originalValidateLiveWrite = liveWriteValidation.validateLiveWorkoutWrite;
  let templateCatalogCalls = 0;
  let liveWriteValidationCalls = 0;
  let result: ReturnType<typeof applyPlanChange> | null = null;
  try {
    templateCatalog.listCoachRevisionTemplates = () => {
      templateCatalogCalls += 1;
      throw new Error('component deletion reached the revision template catalog');
    };
    liveWriteValidation.validateLiveWorkoutWrite = () => {
      liveWriteValidationCalls += 1;
      throw new Error('component deletion reached canonical template validation');
    };
    result = deleteThroughRealSheetDoor(date, 'conditioning');
  } finally {
    templateCatalog.listCoachRevisionTemplates = originalListTemplates;
    liveWriteValidation.validateLiveWorkoutWrite = originalValidateLiveWrite;
  }
  assert(templateCatalogCalls === 0, 'component deletion called listCoachRevisionTemplates');
  assert(liveWriteValidationCalls === 0,
    'component deletion called canonicalTemplateSectionSignature/validateLiveWorkoutWrite');
  assert(result, 'component deletion did not return from the typed production door');
  const remaining = byDay().get(stacked.dayOfWeek);
  assert(result.ok, `${result.message ?? 'component deletion failed'} ${JSON.stringify(result.rejected)}`);
  assert(remaining, 'component deletion became whole-day unavailability');
  assert(remaining.hasCombinedConditioning !== true && !remaining.conditioningBlock,
    'conditioning component survived');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[date] !== 'rest',
    'component deletion created a whole-day Rest mark');
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === date && constraint.scope === 'conditioning_component'),
  'typed component removal missing');
});

run('regression', '5 whole-session deletion on a stacked day leaves Rest', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  });
  seed({ athlete });
  const stacked = accepted().visibleWorkouts.find((workout) => workout.hasCombinedConditioning);
  assert(stacked, 'stacked precondition missing');
  const date = dateForDay(WEEK, stacked.dayOfWeek);
  deleteWorkout({ date, workout: stacked });
  assert(!byDay().has(stacked.dayOfWeek), 'whole stacked day survived');
  // RE-POINTED, not deleted (Sam, 2026-07-30): a deletion door never writes a
  // calendar mark. The day is still owned as Rest — by the constraint and the
  // placement stamp, which is what the resolver reads — and the athlete's
  // calendar stays theirs. Asserting the mark was asserting the mechanism.
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[date] === undefined,
    'the deletion wrote a calendar mark');
  const owned = useProgramStore.getState().userRemovalConstraints
    .find((constraint) => constraint.targetDate === date && constraint.status === 'active');
  assert(owned?.wholeDayRestOwned === true,
    'whole deletion did not own Rest through its constraint');
});

run('regression', '6 phase matrix keeps deletion authoritative and Bible-valid', () => {
  const scenarios: Array<{
    name: string;
    athlete: OnboardingData;
    phaseEntryOffsetWeeks: number;
    targetIndex?: number;
    marks?: Record<string, CalendarDayType>;
    componentScope?: 'strength' | 'conditioning';
    selectTarget?: (workouts: Workout[]) => Workout | undefined;
  }> = [
    { name: 'in-season game week (current)', athlete: profile(), phaseEntryOffsetWeeks: 0 },
    { name: 'in-season bye (current)', athlete: profile({ usualGameDay: undefined, gameDay: undefined }), phaseEntryOffsetWeeks: 0 },
    { name: 'early off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0 },
    { name: 'mid off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 2 },
    { name: 'late off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 6 },
    { name: 'early pre-season', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0 },
    { name: 'late pre-season', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 6 },
    { name: 'pre-season deload', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0, targetIndex: 3 },
    {
      name: 'practice match',
      athlete: profile({
        seasonPhase: 'Pre-season',
        teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
      }),
      phaseEntryOffsetWeeks: 2,
    },
    {
      name: 'stacked Team Training component',
      athlete: profile(),
      phaseEntryOffsetWeeks: 0,
      componentScope: 'strength',
      selectTarget: (workouts) => workouts.find((workout) =>
        /Team Training\s*\+/i.test(workout.name)),
    },
    {
      name: 'Sunday-fixture adjacent horizon',
      athlete: profile({ usualGameDay: 'Sunday', gameDay: 'Sunday' }),
      phaseEntryOffsetWeeks: 0,
    },
    {
      name: 'future in-season game week',
      athlete: profile(),
      phaseEntryOffsetWeeks: 0,
      targetIndex: 1,
    },
  ];
  for (const scenario of scenarios) {
    seed({
      athlete: scenario.athlete,
      phaseEntryWeekStartISO: addDaysISO(WEEK, -scenario.phaseEntryOffsetWeeks * 7),
      targetMicrocycleIndex: scenario.targetIndex,
      markedDays: scenario.marks,
    });
    const weekStart = useProgramStore.getState().currentMicrocycle!.startDate.slice(0, 10);
    const before = accepted(weekStart);
    const target = scenario.selectTarget?.(before.visibleWorkouts) ??
      before.visibleWorkouts.find((workout) =>
        workout.workoutType !== 'Game' && workout.workoutType !== 'Team Training' &&
        workout.workoutType !== 'Rest');
    assert(target, `${scenario.name}: production-door target missing`);
    const date = dateForDay(weekStart, target.dayOfWeek);
    deleteThroughRealSheetDoor(date, scenario.componentScope, weekStart);
    const after = accepted(weekStart);
    if (scenario.componentScope) {
      const remaining = byDay(weekStart).get(target.dayOfWeek);
      assert(remaining && /Team Training/i.test(remaining.name),
        `${scenario.name}: protected Team Training component was not preserved`);
    } else {
      assert(!byDay(weekStart).has(target.dayOfWeek), `${scenario.name}: target resurrected`);
    }
    assert(after.evaluation.blockingViolations.length === 0,
      `${scenario.name}: ${JSON.stringify(after.evaluation.blockingViolations)}`);
    assert(after.contract.identity.mode === before.contract.identity.mode,
      `${scenario.name}: phase mode changed`);
  }
});

run('regression', '7 fixture, practice-match, readiness, injury and equipment rules survive', () => {
  const scenarios: Array<{
    name: string;
    athlete: OnboardingData;
    marks: Record<string, CalendarDayType>;
    setup?: () => void;
  }> = [
    { name: 'game fixture', athlete: profile(), marks: { [SATURDAY]: 'game' } },
    {
      name: 'practice match',
      athlete: profile({
        gender: 'male', // R-130 required; fixture predates the rule
        seasonPhase: 'Pre-season',
        usualGameDay: undefined,
        gameDay: undefined,
        teamTrainingDaysPerWeek: 0,
        teamTrainingDays: [],
        trainingDaysPerWeek: 6,
        preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      }),
      marks: { [SATURDAY]: 'game' },
    },
    {
      name: 'readiness',
      athlete: profile(),
      marks: { [SATURDAY]: 'game' },
      setup: () => useReadinessStore.getState().setReadinessSignal(
        WEEK,
        buildReadinessSignalPatch('flat'),
      ),
    },
    { name: 'injury', athlete: profile({ injuries: [{ bodyArea: 'Hamstring', description: 'Sore running', severity: 'Moderate', whenItHurts: 'Running' }] }), marks: { [SATURDAY]: 'game' } },
    { name: 'equipment', athlete: profile({ trainingLocation: 'Home / garage', equipment: ['Bodyweight only'], equipmentSelectionCompleteness: 'complete' }), marks: { [SATURDAY]: 'game' } },
  ];
  for (const scenario of scenarios) {
    try {
      seed({ athlete: scenario.athlete, markedDays: scenario.marks });
      scenario.setup?.();
      const before = accepted();
      const fixture = before.contract.anchors.find((anchor) =>
        anchor.kind === 'game' || anchor.kind === 'practice_match');
      const target = before.visibleWorkouts.find((workout) =>
        workout.dayOfWeek !== fixture?.dayOfWeek && workout.workoutType !== 'Team Training' &&
        workout.workoutType !== 'Rest');
      assert(target, `${scenario.name}: deletable app session missing`);
      deleteWorkout({ date: dateForDay(WEEK, target.dayOfWeek), workout: target });
      const after = accepted();
      assert(after.evaluation.blockingViolations.length === 0,
        `${scenario.name}: ${JSON.stringify(after.evaluation.blockingViolations)}`);
      if (fixture) assert(after.contract.anchors.some((anchor) => anchor.id === fixture.id),
        `${scenario.name}: fixture anchor changed`);
    } catch (error) {
      throw new Error(`${scenario.name}: ${(error as Error).message}`, { cause: error });
    }
  }
});

run('regression', '8 Sunday deletion closes persisted following-week dependencies', () => {
  const seeded = seedExactSundayRegression();
  const nextMonday = accepted(NEXT_WEEK).visibleWorkouts.find((workout) => workout.dayOfWeek === 1);
  if (nextMonday) {
    const overlay = useProgramStore.getState().weekScopedOverlays[NEXT_WEEK];
    if (overlay) {
      overlay.workoutsByDate[NEXT_WEEK] = {
        ...nextMonday,
        derivedSessionProvenance: [{
          protocolVersion: 2,
          authorship: 'system',
          origin: 'rest_distribution_repair',
          scope: 'session',
          triggerSignature: 'user-removal-cross-week-test',
          targetMetric: 'full_rest',
          credit: { metric: 'full_rest', amount: 1 },
          originatingFixtureDate: null,
          originatingDate: NEXT_WEEK,
          validWhile: [],
          invalidWhen: [],
          history: [],
          sourcePlanEntryId: nextMonday.planEntryId ?? null,
          dependency: {
            kind: 'fixture_to_session',
            source: { date: SUNDAY, weekStart: WEEK },
            target: { date: NEXT_WEEK, weekStart: NEXT_WEEK },
            crossesWeekBoundary: true,
            displacedSession: { targetDate: NEXT_WEEK, sourcePlanEntryId: nextMonday.planEntryId ?? null, workout: clone(nextMonday) },
            restoration: { targetDate: NEXT_WEEK, sourcePlanEntryId: nextMonday.planEntryId ?? null, workout: clone(nextMonday) },
          },
        }],
      };
      useProgramStore.setState({ weekScopedOverlays: { ...useProgramStore.getState().weekScopedOverlays, [NEXT_WEEK]: overlay } });
    }
  }
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === SUNDAY && constraint.status === 'active'),
  'Sunday ownership missing');
  assert(accepted().evaluation.blockingViolations.length === 0, 'Sunday week not accepted');
});

run('regression', '10 reload, rebuild and rollover do not resurrect target', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseAcceptedStateCandidate(persisted, {
    profile: seeded.athlete,
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  assert(!byDay().has(0), 'reload resurrected target');
  const rebuilt = quiet(() => generateProgramLocally(seeded.athlete, {
    todayISO: WEEK,
    previousProgram: useProgramStore.getState().currentProgram,
    seasonPhaseClock: useProgramStore.getState().currentProgram?.seasonPhaseClock,
  }));
  commitProgramSetupRebuildTransaction({ program: rebuilt, profile: seeded.athlete, todayISO: WEEK });
  assert(!byDay().has(0), 'rebuild resurrected target');
  rolloverProgramBlock({ baseProfile: seeded.athlete, targetDateISO: '2026-08-10' });
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === SUNDAY && constraint.status === 'active'),
  'rollover discarded persisted removal ownership');
});

run('regression', '11 impossible relocation records typed reduction and keeps deletion', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  });
  seed({ athlete });
  const before = accepted();
  const target = before.visibleWorkouts.find((workout) =>
    before.evaluation.ledger.mainStrength.sessionDays.includes(workout.dayOfWeek));
  assert(target, 'constrained strength target missing');
  const date = dateForDay(WEEK, target.dayOfWeek);
  const result = deleteThroughRealSheetDoor(date);
  const after = accepted();
  assert(!byDay().has(target.dayOfWeek), 'typed-reduction target resurrected');
  assert(after.evaluation.blockingViolations.length === 0,
    JSON.stringify(after.evaluation.blockingViolations));
  const constraint = useProgramStore.getState().userRemovalConstraints.find((entry) =>
    entry.targetDate === date && entry.status === 'active');
  assert(constraint, 'typed reduction deletion identity missing');
  const reductions = after.contract.authorisedReductions.filter((entry) =>
    entry.reason === 'explicit_user_override' && entry.detail.includes(date));
  assert(reductions.length > 0 && reductions.every((entry) =>
    entry.affectedWeek === WEEK && entry.deletionIdentity === constraint.id),
  `reductions=${JSON.stringify(after.contract.authorisedReductions)}`);
  // SCOPE RULED, THEN MEASURED (review seat,
  // `docs/CORE_PLACER_NAMING_AND_SCOPE_RULING_2026-08-06.md` §2): a repair that
  // ADDS work fires only on a commit whose outcome is ACCEPTED, never inside a
  // refusal. This world was measured onto the accepted side — `previewPlanChangeRisk`
  // and `applyPlanChange` both returned ok, the deletion stands, and
  // `blockingViolations` is empty. The "impossible" in this cell's name is the
  // RELOCATION of the displaced strength work, not the commit. So the core placer
  // is in scope here and the confirmation owes the honest disclosure of every day
  // it touched (invariant #4) — Tuesday is named because Tuesday changed.
  assert(result.message ===
    'Session removed. This week’s strength target has been reduced at your request.'
    + ' I also rebalanced Tuesday to keep your week balanced.',
  `message=${result.message}`);
  // WHAT THE PLACER CONSUMED, PINNED SO IT CAN NEVER SILENTLY INVERT. Measured
  // against the same world with the candidate generator disabled: the pre-placer
  // path answered this deletion by REDUCING the conditioning minimum 3 -> 2 under
  // `explicit_user_override` ("relocation and substitution were exhausted"). A
  // placement is now available, so that precondition is false and the concession
  // is correctly withdrawn — the athlete's strength reduction is authorised and
  // disclosed, and their conditioning minimum is DELIVERED instead of quietly cut.
  const conditioningCore = after.contract.conditioning.core;
  assert(conditioningCore.unresolvedMinimumShortfall === 0 &&
    conditioningCore.achievedCount >= conditioningCore.requiredMinimum,
  `conditioning core unmet: ${JSON.stringify(conditioningCore)}`);
  assert(!after.contract.conditioning.reductions.some((entry) =>
    entry.reason === 'explicit_user_override'),
  `deletion cut the conditioning minimum instead of delivering it: ${
    JSON.stringify(after.contract.conditioning.reductions)}`);
  const rebalanced = after.visibleWorkouts.find((workout) => workout.dayOfWeek === 2);
  assert(rebalanced && rebalanced.sessionTier === 'core',
    `disclosed Tuesday carries no core session: ${rebalanced?.name ?? 'nothing'}`);
  reloadAcceptedState(athlete);
  assert(accepted().contract.authorisedReductions.some((entry) =>
    entry.deletionIdentity === constraint.id && entry.affectedWeek === WEEK),
  'hydration discarded typed deletion reduction');
  const rebuilt = quiet(() => generateProgramLocally(athlete, {
    todayISO: WEEK,
    previousProgram: useProgramStore.getState().currentProgram,
    seasonPhaseClock: useProgramStore.getState().currentProgram?.seasonPhaseClock,
  }));
  commitProgramSetupRebuildTransaction({ program: rebuilt, profile: athlete, todayISO: WEEK });
  assert(accepted().contract.authorisedReductions.some((entry) =>
    entry.deletionIdentity === constraint.id), 'rebuild discarded typed deletion reduction');
  rolloverProgramBlock({ baseProfile: athlete, targetDateISO: '2026-08-10' });
  assert(useProgramStore.getState().userRemovalConstraints.some((entry) =>
    entry.id === constraint.id && entry.status === 'active'),
  'rollover discarded reduction authorisation identity');
});

run('regression', '12 failed atomic publication preserves previous complete horizon', () => {
  const seeded = seedExactSundayRegression();
  const before = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    marks: useProgramStore.getState().acceptedMaterialContext.markedDays,
  });
  let rejected = false;
  try {
    deleteWorkout({
      date: SUNDAY,
      workout: { ...seeded.sunday, id: '' },
    });
  } catch {
    rejected = true;
  }
  const after = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    marks: useProgramStore.getState().acceptedMaterialContext.markedDays,
  });
  assert(rejected, 'technical publication failure was not surfaced');
  assert(after === before, 'failed publication partially committed');
});

run('regression', '13 direct and chained mutations converge on accepted state', () => {
  let seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const direct = visibleSemantic();
  seeded = seedExactSundayRegression();
  const state = useProgramStore.getState();
  useProgramStore.setState({ acceptedMaterialContext: { ...state.acceptedMaterialContext, lastTransaction: 'harmless-chain-prefix' } });
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const chained = visibleSemantic();
  assert(chained === direct, 'direct and chained final states differ');
});

run('regression', '14 exact in-season Lower Body deletion relocates and explains publication', () => {
  const athlete = seedExactInSeasonStrengthWeek();
  const before = accepted();
  const lower = byDay().get(1)!;
  const result = deleteThroughRealSheetDoor(WEEK);
  const after = accepted();
  const relocated = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== 1 && workout.planEntryId === lower.planEntryId);
  assert(!byDay().has(1), 'Monday lower deletion was not preserved');
  assert(relocated?.dayOfWeek === 3, `lower destination=${relocated?.dayOfWeek}`);
  assert(after.evaluation.ledger.mainStrength.achievedCount ===
    before.evaluation.ledger.mainStrength.achievedCount, 'lower deletion reduced strength');
  assert(Object.values(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount)
    .every((count) => count > 0), 'lower deletion left a stale/missing pattern');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'lower repair created a reduction');
  assert(result.message ===
    'Session removed. Lower-body strength was moved to Wednesday to keep your week balanced.',
  `message=${result.message}`);
  assert(visibleWeek().find((day) => day.date === '2026-07-15')?.workout?.planEntryId ===
    lower.planEntryId, 'weekly card projection missed relocated lower session');
  reloadAcceptedState(athlete);
  assert(!byDay().has(1) && byDay().get(3)?.planEntryId === lower.planEntryId,
    'reload changed Lower Body repair');
});

run('regression', '15 exact Upper Pull component deletion preserves Team Training and relocates pull', () => {
  const athlete = seedExactInSeasonStrengthWeek();
  const before = accepted();
  const pushBefore = clone(byDay().get(4)!);
  assert(byDay().get(5)?.sessionTier === 'optional', 'optional displacement precondition missing');
  const result = deleteThroughRealSheetDoor('2026-07-14', 'strength');
  const after = accepted();
  const tuesday = byDay().get(2);
  const relocated = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== 2 &&
    workout.strengthIntent?.effectivePatterns.includes('pull'));
  assert(tuesday?.name === 'Team Training' && tuesday.workoutType === 'Team Training',
    `Tuesday=${tuesday?.name}/${tuesday?.workoutType}`);
  assert(!tuesday.strengthIntent && !tuesday.exercises.some((row) =>
    row.section18Evidence?.role === 'main_strength'), 'deleted pull retained stale Tuesday credit');
  assert(relocated?.dayOfWeek === 3 && relocated.name === 'Upper Pull',
    `relocated=${relocated?.dayOfWeek}:${relocated?.name}`);
  assert(relocated.planEntryId === 'w1:tuesday:none:team:strength-component',
    `component identity=${relocated.planEntryId}`);
  assert(prescriptionSignature(byDay().get(4)) === prescriptionSignature(pushBefore),
    `Thursday Upper Push identity/prescription changed ` +
    `${prescriptionSignature(pushBefore)} -> ${prescriptionSignature(byDay().get(4))}`);
  // REWRITTEN, AND THE CHANGE IS THE POINT (Sam's Rest law, 2026-07-30).
  //
  // This asserted that Friday was EMPTIED — that the repair deleted the
  // athlete's optional Gunshow to manufacture a rest day. Under the Rest law it
  // never has to: a day carrying only optional work already counts as rest, so
  // the athlete keeps what they chose and the week still meets its minimum.
  // The old assertion was pinning the app taking something from the athlete.
  const friday = byDay().get(5);
  assert(friday && (friday as { sessionTier?: string }).sessionTier === 'optional',
    `the athlete's optional Friday work was deleted to manufacture rest: ${friday?.name ?? 'gone'}`);
  assert(after.evaluation.ledger.restStress.trueFullRestDays.includes(5),
    'Friday carries only optional work and is not counted as rest');
  assert(after.evaluation.ledger.restStress.trueFullRestDays.length >=
    after.contract.restStress.requiredFullRestMinimum,
    'the week no longer meets its full-rest minimum');
  assert(after.evaluation.ledger.mainStrength.achievedCount ===
    before.evaluation.ledger.mainStrength.achievedCount, 'pull relocation reduced strength');
  assert(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.pull === 1,
    'pull relocation was not visibly credited exactly once');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'pull relocation created a reduction');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays['2026-07-14'] !== 'rest',
    'component deletion widened to whole-day Rest');
  // DISCLOSED-REPAIR (invariant #4) still holds, and now discloses less because
  // less is done: the confirmation names every day the repair TOUCHED, and Friday
  // is no longer one of them. A sentence that still said "I also rebalanced
  // Friday" would be a signed sentence that lies — the thing Sam's copy ruling
  // forbids by name.
  assert(result.message === 'Upper Pull was removed. Pulling work was added to Wednesday.',
    `message=${result.message}`);
  assert(visibleWeek().find((day) => day.date === '2026-07-15')?.workout?.planEntryId ===
    relocated.planEntryId, 'weekly card and accepted pull differ');
  reloadAcceptedState(athlete);
  assert(byDay().get(2)?.name === 'Team Training' &&
    byDay().get(3)?.planEntryId === relocated.planEntryId,
  'reload changed Upper Pull repair');
});

run('regression', '16 Upper Push component deletion preserves Team Training and relocates push', () => {
  const athlete = seedExactInSeasonStrengthWeek();
  const pullBefore = clone(byDay().get(2)!);
  const result = deleteThroughRealSheetDoor('2026-07-16', 'strength');
  const after = accepted();
  const thursday = byDay().get(4);
  const relocated = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== 4 &&
    workout.strengthIntent?.effectivePatterns.includes('push'));
  assert(thursday?.name === 'Team Training' && !thursday.strengthIntent,
    `Thursday=${thursday?.name}`);
  assert(relocated && relocated.dayOfWeek !== 4, 'Upper Push was not relocated');
  assert(prescriptionSignature(byDay().get(2)) === prescriptionSignature(pullBefore),
    `Tuesday Upper Pull changed during push repair ` +
    `${prescriptionSignature(pullBefore)} -> ${prescriptionSignature(byDay().get(2))}`);
  assert(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.push === 1,
    'push relocation was not credited exactly once');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'push relocation created a reduction');
  assert(result.message.includes('Upper Push was removed. Pushing work was added to '),
    `message=${result.message}`);
  reloadAcceptedState(athlete);
  assert(byDay().get(4)?.name === 'Team Training' &&
    accepted().evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.push === 1,
  'reload changed Upper Push repair');
});

run('regression', '17 existing alternative pull exposure avoids duplicate repair', () => {
  seedExactInSeasonStrengthWeek();
  const tuesday = clone(byDay().get(2)!);
  const alternativeId = 'accepted-alternative-upper-pull';
  const alternativeDate = '2026-07-15';
  const alternative: Workout = {
    ...tuesday,
    id: alternativeId,
    planEntryId: alternativeId,
    dayOfWeek: 3,
    name: 'Upper Pull',
    workoutType: 'Strength',
    section18ConditioningRole: 'none',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    derivedSessionProvenance: undefined,
    exercises: tuesday.exercises.map((row, index) => ({
      ...row,
      id: `${alternativeId}:row:${index + 1}`,
      workoutId: alternativeId,
    })),
    ...({ isTeamDay: false } as Record<string, unknown>),
  };
  const state = useProgramStore.getState();
  useProgramStore.setState({
    dateOverrides: { ...state.dateOverrides, [alternativeDate]: alternative },
    overrideContexts: {
      ...state.overrideContexts,
      [alternativeDate]: { intent: 'program_adjustment', label: 'accepted alternative exposure' },
    },
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      markedDays: { ...state.acceptedMaterialContext.markedDays, [FRIDAY]: 'rest' },
    },
  });
  useCalendarStore.setState({
    markedDays: { ...useCalendarStore.getState().markedDays, [FRIDAY]: 'rest' },
  });
  assert(byDay().get(3)?.planEntryId === alternativeId,
    'accepted alternative did not enter the visible source week');
  assert(accepted().evaluation.blockingViolations.length === 0,
    `alternative exposure seed was not Bible-valid: ` +
    `${JSON.stringify(accepted().evaluation.blockingViolations)}`);
  const result = deleteThroughRealSheetDoor('2026-07-14', 'strength');
  const after = accepted();
  assert(byDay().get(2)?.name === 'Team Training', 'Team Training did not survive');
  assert(byDay().get(3)?.planEntryId === alternativeId,
    `existing pull exposure changed: ${JSON.stringify(after.visibleWorkouts.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      id: workout.planEntryId,
      patterns: workout.strengthIntent?.effectivePatterns ?? [],
    })))} overrides=${JSON.stringify(Object.entries(useProgramStore.getState().dateOverrides)
      .map(([date, workout]) => ({ date, id: workout.planEntryId, name: workout.name })))}`);
  assert(after.evaluation.ledger.mainStrength.achievedCount === 3 &&
    after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.pull === 1,
  'existing exposure did not satisfy the accepted contract');
  assert(after.visibleWorkouts.filter((workout) =>
    workout.strengthIntent?.effectivePatterns.includes('pull')).length === 1,
  'unnecessary duplicate pull was created');
  // R-228c (Sam, 2026-08-26): the bin result no longer claims the week is
  // still covered — the removal states itself and stops.
  assert(result.message === 'Upper Pull was removed.',
    `message=${result.message}`);
});

run('regression', '18 CORE conditioning stacks onto compatible strength before reduction', () => {
  const seeded = seedExactSundayRegression();
  const state = useProgramStore.getState();
  const overlay = clone(state.weekScopedOverlays[WEEK]);
  overlay.workoutsByDate[FRIDAY] = null;
  overlay.workoutsByDate[SATURDAY] = null;
  const markedDays = {
    ...state.acceptedMaterialContext.markedDays,
    [FRIDAY]: 'rest' as const,
    [SATURDAY]: 'rest' as const,
  };
  useCalendarStore.setState({
    markedDays,
    selectedDate: useCalendarStore.getState().selectedDate,
  });
  useProgramStore.setState({
    weekScopedOverlays: { ...state.weekScopedOverlays, [WEEK]: overlay },
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      markedDays,
    },
  });
  const before = accepted();
  const mondayBefore = clone(byDay().get(1)!);
  assert(mondayBefore && before.evaluation.blockingViolations.length === 0,
    `stacking seed invalid: ${JSON.stringify(before.evaluation.blockingViolations)}`);
  const result = deleteThroughRealSheetDoor(SUNDAY);
  const after = accepted();
  const mondayAfter = byDay().get(1);
  assert(!byDay().has(0), 'deleted conditioning target resurrected');
  assert(mondayAfter?.planEntryId === mondayBefore.planEntryId &&
    mondayAfter.hasCombinedConditioning === true && !!mondayAfter.conditioningBlock,
  `Monday did not receive stacked conditioning: ${mondayAfter?.name}`);
  assert(mainStrengthPrescriptionSignature(mondayAfter) ===
    mainStrengthPrescriptionSignature(mondayBefore),
  'conditioning stacking rewrote the accepted strength prescription');
  assert(after.evaluation.ledger.conditioning.coreCount ===
    before.evaluation.ledger.conditioning.coreCount,
  `conditioning ${before.evaluation.ledger.conditioning.coreCount}->` +
    `${after.evaluation.ledger.conditioning.coreCount}`);
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'stackable repair created a reduction');
  assert(result.message ===
    'Session removed. Conditioning work was added to Monday.',
  `message=${result.message}`);
  reloadAcceptedState(seeded.athlete);
  assert(byDay().get(1)?.hasCombinedConditioning === true && !byDay().has(0),
    'reload changed conditioning stacking outcome');
});

console.log('\n-- Athlete session deletion properties --');

run('property', 'CORE label never grants deletion permission', () => {
  const seeded = seedExactSundayRegression();
  const renamed = { ...seeded.sunday, name: 'Anything', sessionTier: 'core' as const };
  deleteWorkout({ date: SUNDAY, workout: renamed });
  assert(!byDay().has(0), 'CORE-labelled target survived');
});

run('property', 'active removal application is idempotent', () => {
  const seeded = seedExactSundayRegression();
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id: userRemovalConstraintId({ date: SUNDAY, scope: 'whole_session', workout: seeded.sunday }),
    authorship: 'user', source: 'tap', status: 'active', targetDate: SUNDAY,
    scope: 'whole_session', targetPlanEntryId: seeded.sunday.planEntryId ?? null,
    targetWorkoutId: seeded.sunday.id, originalWorkout: clone(seeded.sunday),
    remainingWorkout: null, equivalentExposureMayRelocate: true,
    wholeDayRestOwned: true, createdAt: '2026-07-15T00:00:00.000Z',
    restoredAt: null, restorationReason: null,
  };
  const once = applyUserRemovalConstraintsToWeek({ workouts: accepted().composedWorkouts, weekStart: WEEK, constraints: [constraint] });
  const twice = applyUserRemovalConstraintsToWeek({ workouts: once, weekStart: WEEK, constraints: [constraint] });
  assert(JSON.stringify(once) === JSON.stringify(twice), 'removal application is not idempotent');
});

run('property', 'workout names and stale workoutType are not removal identity', () => {
  const seeded = seedExactSundayRegression();
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id: userRemovalConstraintId({ date: SUNDAY, scope: 'whole_session', workout: seeded.sunday }),
    authorship: 'user', source: 'tap', status: 'active', targetDate: SUNDAY,
    scope: 'whole_session', targetPlanEntryId: seeded.sunday.planEntryId ?? null,
    targetWorkoutId: seeded.sunday.id, originalWorkout: clone(seeded.sunday),
    remainingWorkout: null, equivalentExposureMayRelocate: true,
    wholeDayRestOwned: true, createdAt: '2026-07-15T00:00:00.000Z',
    restoredAt: null, restorationReason: null,
  };
  const mutated = accepted().composedWorkouts.map((workout) => workout.dayOfWeek === 0
    ? { ...workout, name: 'Renamed by rebuild', workoutType: 'Strength' as const }
    : workout);
  const visible = applyUserRemovalConstraintsToWeek({ workouts: mutated, weekStart: WEEK, constraints: [constraint] });
  // The day may now carry the athlete-owned REST stub that replaced the
  // calendar mark. What must not survive is the SESSION.
  const survivingSession = visible.find((workout) =>
    workout.dayOfWeek === 0 && workout.workoutType !== 'Rest');
  assert(!survivingSession,
    `copy fields defeated target ownership: "${survivingSession?.name ?? ''}"`);
});

run('property', 'equivalent work may relocate but never to prohibited target', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const week = accepted();
  assert(!week.visibleWorkouts.some((workout) => workout.dayOfWeek === 0), 'target reused');
  assert(week.evaluation.ledger.conditioning.coreCount === 3, 'equivalent exposure did not relocate');
});

run('property', 'explicit re-add restores typed ownership', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  seedManualOverride(
    SUNDAY,
    seeded.sunday,
    { intent: 'program_adjustment', label: 'explicit restore' },
  );
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === SUNDAY && constraint.status === 'restored' &&
    constraint.restorationReason === 'explicit_re_add'), 'restoration state missing');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[SUNDAY] !== 'rest',
    'restoration retained deletion-owned Rest mark');
});

run('regression', '19 whole CORE deletion restores the exact session and removes owned relocation', () => {
  seedExactInSeasonStrengthWeek();
  const original = clone(byDay().get(1)!);
  const before = visibleSemantic();
  deleteThroughRealSheetDoor(WEEK);
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.kind === 'session_delete', 'whole deletion adjustment missing');
  const outcome = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(outcome.outcome === 'restored', JSON.stringify(outcome));
  assert(visibleSemantic() === before, 'restored CORE week differs from its exact accepted before-state');
  assert(prescriptionSignature(byDay().get(1)) === prescriptionSignature(original),
    'restored CORE prescription differs');
  assert(useProgramStore.getState().userRemovalConstraints.filter((constraint) =>
    constraint.targetDate === WEEK && constraint.status === 'restored').length === 1,
  'only the exact owned removal was not marked restored');
});

run('regression', '20 Upper Pull restoration preserves Team Training and removes only owned relocation', () => {
  seedExactInSeasonStrengthWeek();
  const before = visibleSemantic();
  const tuesdayBefore = clone(byDay().get(2)!);
  deleteThroughRealSheetDoor('2026-07-14', 'strength');
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.kind === 'session_component_delete', 'component adjustment missing');
  const outcome = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(outcome.outcome === 'restored', JSON.stringify(outcome));
  const tuesdayAfter = byDay().get(2);
  assert(tuesdayAfter?.name === 'Team Training + Upper Pull', 'Upper Pull was not restacked');
  assert(prescriptionSignature(tuesdayAfter) === prescriptionSignature(tuesdayBefore),
    'Upper Pull prescription changed during restore');
  assert(visibleSemantic() === before, 'Upper Pull restoration changed unrelated sessions');
});

run('regression', '21 conditioning component restoration preserves the stacked strength component', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  });
  seed({ athlete });
  const stacked = accepted().visibleWorkouts.find((workout) => workout.hasCombinedConditioning);
  assert(stacked, 'stacked conditioning precondition missing');
  const before = visibleSemantic();
  const date = dateForDay(WEEK, stacked.dayOfWeek);
  const result = applyPlanChange({
    change: { kind: 'remove_session', date, scope: 'conditioning' },
    visibleWeek: visibleWeek(),
    todayISO: WEEK,
    applyOverride: () => { throw new Error('component deletion used legacy override writer'); },
  });
  assert(result.ok, JSON.stringify(result.rejected));
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.restorationTarget.componentScope === 'conditioning_component',
    'conditioning ownership missing');
  const outcome = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(outcome.outcome === 'restored', JSON.stringify(outcome));
  assert(visibleSemantic() === before, 'conditioning restoration changed the stacked week');
});

run('regression', '22 Restore removes only its typed reduction and preserves an unrelated reduction', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  });
  seed({ athlete });
  const before = accepted();
  const target = before.visibleWorkouts.find((workout) =>
    before.evaluation.ledger.mainStrength.sessionDays.includes(workout.dayOfWeek));
  assert(target, 'typed reduction restoration target missing');
  const date = dateForDay(WEEK, target.dayOfWeek);
  deleteThroughRealSheetDoor(date);
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.linkedTypedReductions.length, 'owned typed reduction was not linked');
  const state = useProgramStore.getState();
  const overlay = clone(state.weekScopedOverlays[WEEK]);
  const owned = overlay.exposureContractV2.authorisedReductions.find((entry) =>
    entry.deletionIdentity === adjustment.linkedUserRemovalConstraintIds[0]);
  assert(owned, 'owned reduction missing from accepted contract');
  const migrated = normalizeReversibleAdjustmentLedger({
    value: null,
    userRemovalConstraints: state.userRemovalConstraints,
    acceptedRevision: state.acceptedMaterialContext.revision,
    exposureContractsByWeek: { [WEEK]: overlay.exposureContractV2 },
  });
  assert(migrated.adjustments.some((candidate) =>
    candidate.linkedTypedReductions.some((entry) =>
      entry.deletionIdentity === owned.deletionIdentity)),
  'lossless migration did not link the existing typed reduction by deletion identity');

  // ── LR-26's READ-INGRESS LIFT, on a record in the SUPERSEDED shape ────────
  //
  // A ledger already on the athlete's phone carries full afterWorkout /
  // afterDateOverride / afterOverrideContext objects and none of the three
  // fields that replaced them. L15 says the old shape survives only as a lift
  // at the boundary, so this builds a record in that exact shape and hydrates
  // it. Without this cell the lift is code nothing runs — the very failure the
  // instrumentation rule names.
  //
  // BOTH DIRECTIONS: the lift must RECOVER what the readers consume (identity
  // and the two fingerprints) and must DROP the legacy keys, or an existing
  // install keeps paying the payload this unit deleted.
  {
    const legacyDay = {
      date, weekStart: WEEK,
      beforeWorkout: null,
      afterWorkout: { id: 'legacy-after', planEntryId: 'legacy:plan:entry', exercises: [] },
      beforeDateOverride: null,
      afterDateOverride: { id: 'legacy-override', exercises: [] },
      beforeOverrideContext: null,
      afterOverrideContext: { intent: 'program_adjustment' },
      beforeFingerprint: 'before', afterFingerprint: 'after',
    };
    const legacyRecord = {
      ...clone(adjustment),
      displacedOriginalState: {
        ...clone(adjustment.displacedOriginalState),
        ownedDays: [legacyDay],
      },
    };
    const lifted = normalizeReversibleAdjustmentLedger({
      value: { adjustments: [legacyRecord] } as never,
      acceptedRevision: state.acceptedMaterialContext.revision,
    });
    const liftedDay = lifted.adjustments[0]?.displacedOriginalState.ownedDays[0] as
      unknown as (Record<string, unknown> & {
        afterStableIdentity?: string | null;
        afterDateOverrideFingerprint?: string;
        afterOverrideContextFingerprint?: string;
      }) | undefined;
    assert(!!liftedDay, 'the lift dropped the owned day entirely');
    assert(liftedDay.afterStableIdentity === 'legacy:plan:entry',
      'the lift did not recover the after identity the readers consume — a legacy '
      + `record would lose its stable identity (got ${String(liftedDay.afterStableIdentity)})`);
    assert(liftedDay.afterDateOverrideFingerprint ===
      semanticFingerprint(legacyDay.afterDateOverride),
    'the lift did not recover the afterDateOverride fingerprint, so undo verification '
    + 'would refuse on an unchanged world');
    assert(liftedDay.afterOverrideContextFingerprint ===
      semanticFingerprint(legacyDay.afterOverrideContext),
    'the lift did not recover the afterOverrideContext fingerprint');
    for (const dead of
      ['afterWorkout', 'afterSurfaceWorkout', 'afterDateOverride', 'afterOverrideContext']) {
      assert(!(dead in liftedDay),
        `the lift kept the superseded key "${dead}" — an existing install would go on `
        + 'storing the copies this unit deleted');
    }
  }
  const program = clone(state.currentProgram);
  assert(program, 'accepted program missing');
  const unrelatedMicrocycle = program.microcycles.find((microcycle) =>
    microcycle.startDate !== WEEK && !!microcycle.exposureContractV2);
  assert(unrelatedMicrocycle?.exposureContractV2, 'unrelated contract week missing');
  const unrelated = {
    ...clone(owned),
    affectedWeek: unrelatedMicrocycle.startDate,
    detail: `${owned.detail}:unrelated`,
    deletionIdentity: 'unrelated-adjustment:reduction',
  };
  unrelatedMicrocycle.exposureContractV2.authorisedReductions = [
    ...unrelatedMicrocycle.exposureContractV2.authorisedReductions,
    unrelated,
  ];
  useProgramStore.setState({ currentProgram: program });
  const restored = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(restored.outcome === 'restored', JSON.stringify(restored));
  const reductions = accepted().contract.authorisedReductions;
  assert(!reductions.some((entry) =>
    entry.deletionIdentity === adjustment.linkedUserRemovalConstraintIds[0]),
  'owned typed reduction survived Restore');
  const persistedUnrelated = useProgramStore.getState().currentProgram?.microcycles
    .find((microcycle) => microcycle.startDate === unrelatedMicrocycle.startDate)
    ?.exposureContractV2?.authorisedReductions;
  assert(persistedUnrelated?.some((entry) =>
    entry.deletionIdentity === unrelated.deletionIdentity),
    'unrelated typed reduction was removed');
  assert(byDay().get(target.dayOfWeek)?.planEntryId === target.planEntryId,
    'typed reduction target session was not restored');
});

run('regression', '23 restoration gateway rejection publishes no partial accepted state', () => {
  const athlete = profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  });
  seed({ athlete });
  const week = accepted();
  const target = week.visibleWorkouts.find((workout) =>
    week.evaluation.ledger.mainStrength.sessionDays.includes(workout.dayOfWeek));
  assert(target, 'gateway failure restoration target missing');
  deleteThroughRealSheetDoor(dateForDay(WEEK, target.dayOfWeek));
  const state = useProgramStore.getState();
  const ledger = clone(state.reversibleAdjustmentLedger);
  const adjustment = ledger.adjustments.at(-1);
  const ownedContract = adjustment?.displacedOriginalState.ownedWeeks[0]
    ?.beforeExposureContract;
  assert(adjustment && ownedContract, 'gateway failure owned contract missing');
  ownedContract.mainStrength.exposure.requiredMinimum = 99;
  ownedContract.mainStrength.exposure.plannerSelectedTarget = 99;
  useProgramStore.setState({ reversibleAdjustmentLedger: ledger });
  const beforeVisible = visibleSemantic();
  const beforeState = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    overrides: useProgramStore.getState().dateOverrides,
    contexts: useProgramStore.getState().overrideContexts,
    removals: useProgramStore.getState().userRemovalConstraints,
    ledger: useProgramStore.getState().reversibleAdjustmentLedger,
    material: useProgramStore.getState().acceptedMaterialContext,
  });
  const restored = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(restored.outcome === 'safely-rejected', JSON.stringify(restored));
  assert(visibleSemantic() === beforeVisible, 'gateway rejection changed the visible program');
  const afterState = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    overrides: useProgramStore.getState().dateOverrides,
    contexts: useProgramStore.getState().overrideContexts,
    removals: useProgramStore.getState().userRemovalConstraints,
    ledger: useProgramStore.getState().reversibleAdjustmentLedger,
    material: useProgramStore.getState().acceptedMaterialContext,
  });
  assert(afterState === beforeState, 'gateway rejection published partial accepted state');
});

console.log('\n-- Athlete session deletion mutation witnesses --');

run('mutation', 'ignoring persisted removal resurrects target and is detected', () => {
  const seeded = seedExactSundayRegression();
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id: 'mutation:removal', authorship: 'user', source: 'tap', status: 'active',
    targetDate: SUNDAY, scope: 'whole_session',
    targetPlanEntryId: seeded.sunday.planEntryId ?? null,
    targetWorkoutId: seeded.sunday.id, originalWorkout: clone(seeded.sunday),
    remainingWorkout: null, equivalentExposureMayRelocate: true,
    wholeDayRestOwned: true, createdAt: '2026-07-15T00:00:00.000Z',
    restoredAt: null, restorationReason: null,
  };
  const hasSession = (workouts: readonly Workout[]): boolean =>
    workouts.some((workout) => workout.dayOfWeek === 0 && workout.workoutType !== 'Rest');
  const ignored = hasSession(accepted().composedWorkouts);
  const enforced = applyUserRemovalConstraintsToWeek({ workouts: accepted().composedWorkouts, weekStart: WEEK, constraints: [constraint] });
  assert(ignored && !hasSession(enforced),
    'mutation witness did not distinguish ignored ownership');
  // And the emptiness is OWNED rather than merely absent — that stamp is what
  // keeps the derived filler off the day now that no calendar mark does.
  const restStub = enforced.find((workout) => workout.dayOfWeek === 0);
  assert(restStub && isAthletePlacedSession(restStub),
    'the emptied day carries no athlete-placement stamp — a deriver will refill it');
});

run('mutation', 'component scope cannot mutate into whole-day Rest ownership', () => {
  const seeded = seedExactSundayRegression();
  const remaining = { ...seeded.sunday, hasCombinedConditioning: false, conditioningBlock: undefined };
  deleteWorkout({
    date: SUNDAY,
    workout: seeded.sunday,
    scope: 'conditioning_component',
    remainingWorkout: remaining,
  });
  const constraint = useProgramStore.getState().userRemovalConstraints.find((candidate) =>
    candidate.targetDate === SUNDAY && candidate.status === 'active');
  assert(constraint?.scope === 'conditioning_component' && !constraint.wholeDayRestOwned,
    'component scope was widened');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[SUNDAY] !== 'rest',
    'component scope wrote whole-day Rest');
});

run('mutation', 'publication cannot omit persisted constraint from accepted surfaces', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const state = useProgramStore.getState();
  assert(state.userRemovalConstraints.length === 1, 'constraint missing from ProgramStore');
  assert(!rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(state),
    weekStart: WEEK,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  }).visibleWorkouts.some((workout) => workout.dayOfWeek === 0),
  'accepted rebasing ignored persisted constraint');
});

run('regression', 'a partial Bin names the survivor from ITS OWN rows, never the whole day', () => {
  // REVIEW ROUND 2. `strengthComponentDisplayName` names a component from the
  // rows it is handed; both callers handed it `workout.exercises` — the
  // PRE-REMOVAL, WHOLE-DAY list. `inferMeaningfulExerciseMovementPatterns` runs
  // over whatever it is given, so ONE row from a DIFFERENT surviving section is
  // enough to widen the pattern set and FABRICATE a canonical label, which is
  // then written into `workout.name` — a frozen coach matching key.
  //
  // THE FIXTURE IS THE POINT, so it is spelled out. The sibling row must land in
  // another SECTION, not merely be another row: a squat day whose strength
  // section happens to contain a pull-up really is more than squats, and naming
  // it broadly is correct. Here the day is squat-only strength PLUS an attached
  // bodyweight finisher whose row is "Push-ups" — the conditioning block puts it
  // in the `conditioning` section (verified: strength -> [r-squat, r-front],
  // conditioning -> [r-row]). Binning the TEAM component leaves both, and the
  // strength component is still squat-only.
  //
  //   whole-day rows -> "Full Body Strength"   <- invented; nothing here is full-body
  //   component rows -> "Lower Squat"          <- what the survivor actually is
  //
  // Asserted through the REAL reducer, not through the naming helper. The helper
  // was already correct and the defect was entirely in what the call site passed,
  // so a unit test of `strengthComponentDisplayName` would have stayed green
  // through the whole bug — which is exactly how it shipped.
  const row = (id: string, name: string) => ({
    id,
    workoutId: 'w-legacy',
    exerciseId: id,
    exercise: { id, name },
    exerciseOrder: 1,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
  });
  // UNTYPED legacy day — no `strengthIntent`, so naming must fall through to the
  // rows. With typed intent the rows are never consulted, which is why the whole
  // reachable-world differential stays empty and this needs a hand-built day.
  const workout = {
    id: 'w-legacy',
    microcycleId: 'mc-legacy',
    dayOfWeek: 1,
    name: 'Team Training + Lower Squat',
    description: '',
    workoutType: 'Strength',
    sessionTier: 'core',
    isTeamDay: true,
    intensity: 'Moderate',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      attachedKind: 'finisher',
      options: [{
        title: 'Bodyweight Conditioning Circuit',
        description: '3 rounds',
        exerciseIds: ['r-finisher'],
        durationMinutes: 10,
      }],
    },
    exercises: [
      row('r-squat', 'Back Squat'),
      row('r-front', 'Front Squat'),
      row('r-finisher', 'Push-ups'),
    ],
  } as unknown as Workout;
  const day = { date: WEEK, source: 'template', workout } as unknown as Parameters<
    typeof reduceAcceptedSessionForAthleteRemoval
  >[0]['day'];

  const reduced = quiet(() => reduceAcceptedSessionForAthleteRemoval({
    day, scope: 'team_component',
  }));
  assert(reduced.ok === true && !!reduced.remainingWorkout,
    `the reducer refused the fixture (${JSON.stringify(reduced)}) — this cell `
    + 'cannot see the defect it exists for');
  const named = reduced.ok === true ? (reduced.remainingWorkout?.name ?? '') : '';
  assert(named !== 'Full Body Strength',
    `the survivor was named "${named}" — a canonical label FABRICATED from a row `
    + 'that is not in the strength component. Nothing on this day is full-body; '
    + 'the finisher\'s push-up widened the pattern set.');
  assert(named === 'Lower Squat',
    `the survivor was named "${named}", not "Lower Squat" — the surviving strength `
    + 'component is two squat rows and nothing else.');
});

console.warn = originalWarn;
console.log(`\nAthlete session deletion totals: regressions=${regressions}/24 properties=${properties}/5 mutations=${mutations}/3 failures=${failures.length}`);

// THE RATCHET: a declared red that stops redding owes the deletion of its entry.
const staleDeclared = DECLARED_RED.filter((entry) => !declaredRedHits.has(entry.id));
if (staleDeclared.length > 0) {
  console.error(`DECLARED RED NO LONGER REDS — delete the entry:\n  ${
    staleDeclared.map((entry) => `${entry.id} (paid by ${entry.paidBy})`).join('\n  ')}`);
  totalsPrinted(failures.length + staleDeclared.length);
  process.exitCode = 1;
} else {
  totalsPrinted(failures.length);
}
if (failures.length > 0) {
  console.error(`Failures: ${failures.join(' | ')}`);
  process.exitCode = 1;
}
