/**
 * THE ATHLETE-DOOR MATRIX — Sam's ruling, 2026-07-30.
 *
 * Every door × every day-state × every route, twice, driven through the REAL
 * transactions and the REAL resolver, asserting the LAWS rather than specific
 * outputs.
 *
 * WHY IT EXISTS. Seven device round trips in one week, each one finding a defect
 * that a harness could have found first: a swap that reported "Done." over an
 * unchanged day, a route that landed the full session, a day that refused every
 * later add, an option that crashed the app, a scoped move that moved both
 * halves. Every one of them was a cell in this grid that nobody had ever run.
 * Sam's phone was the first instrument; from here it is the last.
 *
 * THE LAWS, asserted for every cell. Not "this day should hold Upper Push" —
 * that is a golden and it rots. These are the properties the athlete actually
 * relies on:
 *
 *   L1 NO CRASH. A door that throws is a dead app, not a refusal.
 *   L2 HONEST OUTCOME. applied | refused | no_change, always with a sentence,
 *      never a raw code, never silence. "Done." must name what the day holds.
 *   L3 CONSERVATION. A refusal changes nothing. An applied action never
 *      silently destroys an athlete-owned session.
 *   L4 VISIBLE = ACCEPTED. What the resolver renders is what the transaction
 *      accepted, for every day the action claims.
 *   L5 THE DAY STAYS USABLE. After any outcome, the day still offers a door or
 *      says honestly why not. No dead days.
 *   L6 SCOPED MEANS SCOPED. A component-scoped action moves or removes THAT
 *      component and leaves the rest of the day where it was.
 *   L7 REPEAT IS HONEST. The same tap twice never reports two successes, and
 *      the second answer is still one of the three honest outcomes.
 *   L-P4 THE MENU IS THE PROJECTION. Every capability the menu offers equals the
 *      one `projectParts` computed for that day. The menu renders capability; it
 *      never derives it a second time.
 *
 * WHAT A RED CELL MEANS. The cell name is the reproduction: door, day-state,
 * route, attempt. Nothing here needs a device to reproduce.
 *
 * Run: npm run test:athlete-door-matrix
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
  throw new Error('NETWORK DISABLED — the matrix runs entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';


import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { seedManualOverride } from './support/programOverrideHarness';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import {
  OFFSEASON_MOBILITY_TARGET,
  computeOptionalTopUps,
} from '../rules/optionalTopUp';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import {
  CALVES_POOL,
  GROIN_ADDUCTORS_POOL,
  HAMSTRING_LIGHT_POOL,
  LOWER_PREHAB_POOL,
  MOBILITY_POOL,
  SHOULDER_HEALTH_POOL,
  TRUNK_ANTI_ROTATION_POOL,
} from '../data/exercisePools';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { isAthletePlacedSession } from '../rules/athletePlacement';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  planChangeCategoryAddsSessionKind,
  previewPlanChangeRisk,
} from '../utils/planChangeProducer';
import type {
  PlanChange,
  PlanChangeBinScopeId,
  PlanChangeMoveScopeId,
} from '../utils/planChangeTypes';
import { getSessionComponents } from '../utils/sessionComponents';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { projectParts } from '../rules/projectVisibleWeek';

/**
 * TWO WORLDS, AND WHY THE SECOND ONE EXISTS.
 *
 * This grid was green while Sam's device re-test went 1 of 5. Under L11 that
 * makes the MATRIX the first defect, not any of the four doors — a harness
 * whose athlete is not the athlete proves things about nobody.
 *
 * `synthetic` is the constructed in-season athlete this file was written
 * against. `sam_export_8` is Sam, transcribed from his device
 * (`support/samDeviceExport8Fixture.ts`, which records exactly which of his
 * bytes are verbatim and which are rebuilt). Every day-state, every door and
 * every law below runs over BOTH. Keeping the synthetic world is deliberate:
 * a grid that only knows one real athlete is one device export away from being
 * wrong again, and the two worlds disagreeing is itself a finding.
 */
interface MatrixWorld {
  id: string;
  profile: () => OnboardingData;
  markedDays: Readonly<Record<string, string>>;
  /** The week the doors are aimed at, and the "today" the producer is given. */
  weekStart: string;
  todayISO: string;
  seasonPhase: string;
}

const SYNTHETIC_WEEK = '2026-07-13';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function cell(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}\n      ${message}`);
    console.error(`  FAIL ${name}\n      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

function syntheticProfile(): OnboardingData {
  return {
    // R-130: refused at the generation door with no default; male ≙ pre-R-130.
    gender: 'male',
    seasonPhase: 'In-season', position: 'inside_mid',
    motivation: 'Build strength and football fitness', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes', trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete', experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent', injuries: [],
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

const WORLDS: readonly MatrixWorld[] = [
  {
    id: 'synthetic',
    profile: syntheticProfile,
    markedDays: {},
    // The SECOND microcycle is a settled week; the first is the part-week the
    // generator starts from.
    weekStart: addDaysISO(SYNTHETIC_WEEK, 7),
    todayISO: addDaysISO(SYNTHETIC_WEEK, 7),
    seasonPhase: 'In-season',
  },
];

/** The world the current cell is running in. Set by the grid loop. */
let world: MatrixWorld = WORLDS[0];
function profile(): OnboardingData { return world.profile(); }

function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

/**
 * Generation is the expensive part, so it runs ONCE and every cell restores
 * from the clone. A cell that mutated the shared program would leak into the
 * next one, which is exactly the kind of order-dependence that makes a matrix
 * lie about which cell failed.
 */
const cachedProgramByWorld = new Map<string, TrainingProgram>();
function baseProgram(): TrainingProgram {
  let cached = cachedProgramByWorld.get(world.id);
  if (!cached) {
    const generationToday = world.id === 'synthetic' ? SYNTHETIC_WEEK : world.weekStart;
    cached = quiet(() => generateProgramLocally(profile(), {
      todayISO: generationToday, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1, selectedPhase: world.seasonPhase as never,
        phaseEntryWeekStartISO: generationToday,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    }));
    cachedProgramByWorld.set(world.id, cached);
  }
  return JSON.parse(JSON.stringify(cached)) as TrainingProgram;
}

function seedStores(program: TrainingProgram, extraMarkedDays: Record<string, string> = {}): string {
  const markedDays = { ...world.markedDays, ...extraMarkedDays };
  useProfileStore.setState({ onboardingData: profile(), isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles.find(
      (microcycle) => microcycle.startDate.slice(0, 10) === world.weekStart)
      ?? program.microcycles[1] ?? program.microcycles[0] ?? null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1,
      lastTransaction: 'matrix:seed', injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  return world.weekStart;
}

function visibleWeek(weekStart: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
}

/**
 * WHAT SAM ACTUALLY SEES.
 *
 * `resolveWeekWithConditioning` is the DOMAIN's week. His screen renders
 * `buildProgramTabProjectedWeek`, which calls that resolver and then runs every
 * day through `projectVisibleDay` — and the plan-change sheet's own comment
 * says its offer is "bit-identical to what it offers on the Program tab",
 * because both go through this one entry point.
 *
 * The matrix stopped at the resolver, which is a boundary the athlete never
 * sees. That made it the THIRD verifier to stop there, and it is why a grid
 * asserting `visible = accepted` could stay green while Sam's screen showed a
 * day the transaction never accepted.
 *
 * The projections are NOT collapsed here (LR-13) — see the report. One named
 * entry point is enough to make the assertion honest, and running both
 * boundaries side by side is what will produce the evidence LR-13 currently
 * lacks: a case where they disagree.
 */
function projectedWeek(weekStart: string): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: weekStart,
    todayISO: world.todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

function projectedDayOn(weekStart: string, date: string): ResolvedDay | undefined {
  return projectedWeek(weekStart).find((day) => day.date === date);
}

function dayOn(weekStart: string, date: string): ResolvedDay | undefined {
  return visibleWeek(weekStart).find((day) => day.date === date);
}

function acceptedNameOn(weekStart: string, date: string): string | null {
  const state = useProgramStore.getState();
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  try {
    const accepted = quiet(() => rebaseAcceptedEffectiveWeek({
      surfaces: storedWorldSurfaces(state),
      weekStart,
      profile: useProfileStore.getState().onboardingData,
      markedDays: state.acceptedMaterialContext.markedDays,
    }));
    return accepted.visibleWorkouts.find((workout) => workout.dayOfWeek === dayOfWeek)?.name ?? null;
  } catch {
    return null;
  }
}

/** A stable description of a day, for conservation comparisons. */
function fingerprint(day: ResolvedDay | undefined): string {
  if (!day?.workout) return 'REST';
  return `${day.workout.name}|${day.workout.exercises.length}`;
}

function weekFingerprint(weekStart: string): string {
  return visibleWeek(weekStart).map((day) => `${day.date}=${fingerprint(day)}`).join(';');
}

// ── Day states ────────────────────────────────────────────────────────────

interface DayState {
  id: string;
  /** Seeds the stores and returns the date the doors are aimed at. */
  build: () => { weekStart: string; date: string };
}

function plant(weekStart: string, dayOfWeek: number, patch: Partial<Workout> | null): void {
  const state = useProgramStore.getState() as unknown as {
    currentProgram: TrainingProgram;
    currentMicrocycle: TrainingProgram['microcycles'][number] | null;
  };
  const source = state.currentProgram.microcycles
    .find((microcycle) => microcycle.startDate.slice(0, 10) === weekStart)
    ?.workouts.find((workout) => workout.dayOfWeek === 1);
  const planted = patch && source
    ? {
        ...JSON.parse(JSON.stringify(source)) as Workout,
        id: `matrix-planted-${dayOfWeek}`,
        planEntryId: undefined,
        dayOfWeek,
        ...patch,
      } as Workout
    : null;
  const apply = <T extends { startDate: string; workouts: Workout[] }>(
    microcycle: T | null,
  ): T | null =>
    microcycle && microcycle.startDate.slice(0, 10) === weekStart
      ? {
          ...microcycle,
          workouts: microcycle.workouts
            .filter((workout) => workout.dayOfWeek !== dayOfWeek)
            .concat(planted ? [planted] : []),
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
}

const DAY_STATES: DayState[] = [
  {
    id: 'template_strength',
    build: () => {
      const weekStart = seedStores(baseProgram());
      return { weekStart, date: addDaysISO(weekStart, 0) };
    },
  },
  {
    id: 'combined_team_day',
    build: () => {
      const weekStart = seedStores(baseProgram());
      return { weekStart, date: addDaysISO(weekStart, 3) };
    },
  },
  {
    id: 'derived_gunshow_g1',
    build: () => {
      const weekStart = seedStores(baseProgram());
      return { weekStart, date: addDaysISO(weekStart, 4) };
    },
  },
  {
    id: 'derived_recovery_g_plus_1',
    build: () => {
      const weekStart = seedStores(baseProgram());
      return { weekStart, date: addDaysISO(weekStart, 6) };
    },
  },
  {
    id: 'game_day',
    build: () => {
      const weekStart = seedStores(baseProgram());
      return { weekStart, date: addDaysISO(weekStart, 5) };
    },
  },
  {
    id: 'empty_midweek',
    build: () => {
      const weekStart = seedStores(baseProgram());
      plant(weekStart, 3, null);
      return { weekStart, date: addDaysISO(weekStart, 2) };
    },
  },
  {
    id: 'empty_g1',
    build: () => {
      const weekStart = seedStores(baseProgram());
      plant(weekStart, 5, {
        name: 'Rest', workoutType: 'Rest', sessionTier: 'recovery',
        exercises: [], durationMinutes: 0,
      });
      return { weekStart, date: addDaysISO(weekStart, 4) };
    },
  },
  {
    id: 'marked_rest_day',
    build: () => {
      const weekStart = seedStores(baseProgram());
      const wednesday = addDaysISO(weekStart, 2);
      const state = useProgramStore.getState();
      useProgramStore.setState({
        acceptedMaterialContext: {
          ...state.acceptedMaterialContext,
          markedDays: { ...state.acceptedMaterialContext.markedDays, [wednesday]: 'rest' },
        },
      } as never);
      useCalendarStore.setState({ markedDays: { [wednesday]: 'rest' } } as never);
      return { weekStart, date: wednesday };
    },
  },
  {
    id: 'stacked_two_session_day',
    build: () => {
      // A DAY WITH TWO VISIBLE PARTS, REACHED BY ACTING.
      //
      // It used to add conditioning to WEDNESDAY and rely on the generator having
      // already put a day-based accessory session there (placement row R2). Sam's
      // ruling of 2026-07-30 deleted that placement, so the same add produced a
      // ONE-part day and this state silently stopped being the state it is named
      // after — the cells kept passing while testing something else. That is the
      // hand-built-fixture hazard in its quietest form: the fixture did not break,
      // it just stopped meaning what it said.
      //
      // Monday carries the week's lower strength session, so stacking conditioning
      // on top is two parts for the reason an athlete would have them: they chose to
      // double up. It depends on no placement, so it cannot die with one.
      const weekStart = seedStores(baseProgram());
      quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: weekStart, category: 'conditioning_hard' },
        visibleWeek: visibleWeek(weekStart),
        todayISO: world.todayISO,
        applyOverride: (date, workout, ctx) =>
          seedManualOverride(date, workout, ctx),
      }));
      return { weekStart, date: weekStart };
    },
  },
  {
    id: 'pure_commitment_day',
    build: () => {
      // A day that is ONLY a commitment — no gym work beside it, and NOT
      // declared as team training. A workout with no items at all yields a
      // single `session`-domain item titled from the workout name
      // (`visibleProgramReadModel`), so the section reads "Club Session" and
      // the anchor's `/\bteam training\b/` never matches. That is the whole
      // point of this state: it is a commitment the title heuristic cannot
      // see, and a commitment is not the athlete's to reschedule whatever it
      // happens to be called.
      // Wednesday, which the seeded week leaves free — so this is a
      // commitment standing on its own, not a rewrite of the team night.
      const weekStart = seedStores(baseProgram());
      plant(weekStart, 3, {
        name: 'Club Session', workoutType: 'Technical', sessionTier: 'core',
        exercises: [], durationMinutes: 90, conditioningBlock: undefined,
        speedBlock: undefined, hasCombinedConditioning: false,
      });
      return { weekStart, date: addDaysISO(weekStart, 2) };
    },
  },
  {
    id: 'team_only_night',
    build: () => {
      // A NIGHT THAT IS ONLY THE TEAM SESSION. The grid had the COMBINED team
      // day (team + gym work) and no team-only one, and the two answer
      // differently at exactly the place this task changed: a combined day
      // offers two bin scopes, a team-only night offers ONE — `team`, Sam's
      // "can't make it tonight, this date only" (2026-07-03). That single-scope
      // shape is the one the sheet was silently converting to a whole-day
      // removal the writer refuses.
      const weekStart = seedStores(baseProgram());
      plant(weekStart, 3, {
        name: 'Team Training', workoutType: 'Team Training', sessionTier: 'core',
        exercises: [], durationMinutes: 90, conditioningBlock: undefined,
        speedBlock: undefined, hasCombinedConditioning: false,
        recoveryAddons: undefined,
      });
      return { weekStart, date: addDaysISO(weekStart, 2) };
    },
  },
  {
    id: 'planted_recovery_g1',
    build: () => {
      const weekStart = seedStores(baseProgram());
      plant(weekStart, 5, {
        name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery',
      });
      return { weekStart, date: addDaysISO(weekStart, 4) };
    },
  },
];

// ── Doors ─────────────────────────────────────────────────────────────────
//
// WHAT THIS GRID'S DOOR AXIS IS, AND WHAT IT IS NOT (recorded 2026-07-31).
//
// Every door here is a `PlanChange` driven through `applyPlanChange`. That is
// the axis, and it is why the two schedule doors Sam's ruling 2 added — "Short
// on time today" and "Away this week?" — are NOT cells in this grid and were not
// bolted on as one. They are not plan changes: they write a
// `TemporaryScheduleFact` through `executeProgramControlActionDurably`, they
// change no day's composition, and they answer with a fact-transaction outcome
// rather than one of the three plan-change outcomes L2 is written about. Giving
// them a row would mean a second `change` shape, a second executor and a second
// meaning for every law in `assertLaws` — a grid that asserts two different
// things under one name proves neither.
//
// They are covered instead where their own boundaries live: the scope decision
// and both declared reds in `programControlDurableOwnershipTests`, and the
// walkability + law-holding in `athleteActionWalkerTests`. Recorded as
// NOT-COVERED-HERE on purpose, so nobody reads this grid as a claim about them.

interface Door {
  id: string;
  /** Null when the door does not apply to this day-state at all. */
  change: (context: { weekStart: string; date: string }) => PlanChange | null;
  /** Component the action is scoped to, for L6. */
  scope?: PlanChangeMoveScopeId;
}

const ROUTES = [
  undefined,
  'keep_the_day',
  'take_the_gunshow',
  'accessories_only',
  'deloaded',
] as const;

function doorsFor(routeless: boolean): Door[] {
  const routes = routeless ? [undefined] : ROUTES;
  const doors: Door[] = [];
  for (const route of routes) {
    const suffix = route ? `:${route}` : '';
    doors.push({
      id: `add_conditioning${suffix}`,
      change: ({ date }) => ({
        kind: 'add_category', date, category: 'conditioning_hard',
        ...(route ? { g1Route: route } : {}),
      }),
    });
    doors.push({
      id: `add_strength${suffix}`,
      change: ({ date }) => ({
        kind: 'add_category', date, category: 'strength_full',
        ...(route ? { g1Route: route } : {}),
      }),
    });
    // NEWLY REACHABLE, 2026-07-31. `mobility` has been a `PLAN_CHANGE_CATEGORY_ID`
    // with ten authored templates since the charter unit, and `PlanChangeSheet`
    // rendered no row for it — so no athlete could open this door and the grid
    // had no reason to drive it. Ruling 9 gives it a row, which makes it a state
    // an athlete can reach; a state an athlete can reach and the harness cannot
    // is a defect in the harness (AGENTS.md), so it is a door here now.
    doors.push({
      id: `add_mobility${suffix}`,
      change: ({ date }) => ({
        kind: 'add_category', date, category: 'mobility',
        ...(route ? { g1Route: route } : {}),
      }),
    });
    doors.push({
      id: `swap_conditioning${suffix}`,
      change: ({ date }) => ({
        kind: 'swap_category', date, category: 'conditioning_hard',
        ...(route ? { g1Route: route } : {}),
      }),
    });
    doors.push({
      id: `move_onto${suffix}`,
      change: ({ weekStart, date }) => date === addDaysISO(weekStart, 0)
        ? null
        : ({
          kind: 'move_session', fromDate: addDaysISO(weekStart, 0), toDate: date,
          ...(route ? { g1Route: route } : {}),
        }),
    });
  }
  doors.push({
    id: 'bin_whole_day',
    change: ({ date }) => ({ kind: 'remove_session', date, scope: 'whole_day' }),
  });
  doors.push({
    id: 'bin_strength_component',
    change: ({ date }) => ({ kind: 'remove_session', date, scope: 'strength' }),
  });
  doors.push({
    id: 'move_off_scoped_strength',
    scope: 'strength',
    // Only where the picker OFFERS that scope. Driving a scope the door never
    // shows would test a path the athlete cannot reach, and on a single-session
    // day "move the strength" IS the whole-day move — the producer says so.
    change: ({ weekStart, date }) => {
      const move = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(weekStart), date, todayISO: world.todayISO,
      })).move;
      if (move.refusal || !move.scopes.some((scope) => scope.id === 'strength')) return null;
      return {
        kind: 'move_session', fromDate: date, toDate: addDaysISO(weekStart, 2), scope: 'strength',
      };
    },
  });
  return doors;
}

// ── The laws ──────────────────────────────────────────────────────────────

/**
 * A raw internal identifier — `section18_week_rejected`, `day_already_has_strength`.
 * Snake_case is the vocabulary of the rules layer, never of a sentence written
 * for an athlete.
 */
const RAW_CODE = /[a-z]{2,}_[a-z_]{2,}/;

function assertLaws(args: {
  label: string;
  weekStart: string;
  date: string;
  before: { week: string; day: string; components: string[] };
  result: ReturnType<typeof applyPlanChange>;
  scope?: PlanChangeMoveScopeId;
}): void {
  const { label, weekStart, date, before, result } = args;

  // L2 HONEST OUTCOME.
  assert(['applied', 'refused', 'no_change'].includes(result.outcome),
    `${label}: outcome "${result.outcome}" is not one of the three honest answers`);
  assert(typeof result.message === 'string' && result.message.trim().length > 0,
    `${label}: silent outcome — no sentence for the athlete`);
  assert(!RAW_CODE.test(result.message.trim()),
    `${label}: raw internal code reached the athlete: "${result.message}"`);
  assert(result.ok === (result.outcome === 'applied'),
    `${label}: ok=${result.ok} disagrees with outcome=${result.outcome}`);

  const afterDay = dayOn(weekStart, date);
  const afterWeek = weekFingerprint(weekStart);

  // L3 CONSERVATION — a refusal changes nothing at all.
  if (result.outcome !== 'applied') {
    assert(afterWeek === before.week,
      `${label}: a ${result.outcome} outcome changed the week\n`
      + `        before: ${before.week}\n        after:  ${afterWeek}`);
  }

  // L2b A "Done." that CLAIMS A SESSION ON THIS DAY must name what the day
  // holds. Move copy describes a relocation ("Session moved to …") and is about
  // the other end, so it is not this law's business.
  if (/^Done\..*\b(is now on|added on)\b/.test(result.message)) {
    const held = afterDay?.workout?.name ?? 'REST';
    const namesSomething = result.message.includes(held) ||
      held.split(' + ').some((part) => result.message.includes(part));
    assert(namesSomething,
      `${label}: "Done." names a session the day does not hold — copy says `
      + `"${result.message}", day holds "${held}"`);
  }

  // L4 VISIBLE = ACCEPTED for the claimed day.
  if (result.outcome === 'applied') {
    const accepted = acceptedNameOn(weekStart, date);
    const visible = afterDay?.workout?.name ?? null;
    if (accepted !== null && visible !== null) {
      assert(accepted === visible || visible.includes(accepted) || accepted.includes(visible),
        `${label}: the week the athlete SEES disagrees with what was accepted — `
        + `visible "${visible}", accepted "${accepted}"`);
    }
  }

  // L4b THE SCREEN AGREES WITH THE DOMAIN.
  //
  // Sam's tap 1: the domain accepted a strength session onto the day after his
  // game, and his screen rendered "Recovery + Recovery". Everything above this
  // line reads the resolver, which is not a surface anybody looks at. This
  // reads what `useResolvedWeekForDate` hands the day card and the sheet.
  const projected = projectedDayOn(weekStart, date);
  const projectedName = projected?.workout?.name ?? 'REST';
  const resolvedName = afterDay?.workout?.name ?? 'REST';
  assert(projectedName === resolvedName,
    `${label}: the SCREEN and the domain disagree about this day — `
    + `the resolver says "${resolvedName}", the projection the athlete actually `
    + `sees says "${projectedName}"`);
  // The same day rendered as the same session twice is the shape he reported,
  // and it survives a name comparison because both halves carry one name.
  const projectedSections = (projected?.workout as { sections?: { kind: string; title: string }[] } | undefined)
    ?.sections ?? [];
  const sectionTitles = projectedSections.map((section) => `${section.kind}:${section.title}`);
  assert(new Set(sectionTitles).size === sectionTitles.length,
    `${label}: the screen renders the same section twice — ${JSON.stringify(sectionTitles)}`);

  // L5 THE DAY STAYS USABLE.
  const options = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: visibleWeek(weekStart), date, todayISO: world.todayISO,
  }));
  const usable = options.categories.length > 0 || options.addOnTopCategories.length > 0 ||
    options.canRemove || !options.move.refusal || !!options.locked;
  assert(usable,
    `${label}: the day is DEAD afterwards — no door offered and nothing said why`);

  // L-P4 THE MENU IS THE PROJECTION'S CAPABILITIES, NOT A SECOND DERIVATION.
  //
  // Sam's rulings 7-9: the four-action menu comes from the projection. So the
  // menu may not ANSWER a capability question — it renders the answer
  // `projectParts` already gave. The walker states this law over the worlds it
  // can act its way to; this states it over the grid's own day-states, which is
  // where the shapes a walk does not build (a pure commitment day, a marked rest
  // day, a planted recovery G+1) actually live.
  //
  // Both directions, and no day is skipped for having a reason to refuse: a menu
  // that offers less than the projection carries and a menu that offers more are
  // the same split seen from two ends. `not_visible` / `outside_horizon` ARE
  // skipped — the edit WINDOW is the producer's own fact and the projection holds
  // no opinion about it. `game_day` is not skipped: that is a claim about the
  // day's nature, and the projection has its own.
  const canonicalDay = quiet(() => projectParts({
    week: projectedWeek(weekStart), weekStart,
  })).days.find((candidate) => candidate.date === date);
  const windowLocked = options.locked === 'not_visible' || options.locked === 'outside_horizon';
  if (canonicalDay && !windowLocked) {
    const shape = `the projection calls this a "${canonicalDay.kind}" day carrying `
      + `${JSON.stringify(canonicalDay.parts.map((part) => String(part.kind)))}`;
    const menuRemovable = options.hasSession && options.canRemove;
    assert(menuRemovable === canonicalDay.capabilities.canRemoveWholeDay,
      `${label}: ${shape} and says its work `
      + `${canonicalDay.capabilities.canRemoveWholeDay ? 'CAN' : 'CANNOT'} be removed; the menu `
      + `(locked=${options.locked ?? 'null'}, hasSession=${options.hasSession}, `
      + `canRemove=${options.canRemove}) says it ${menuRemovable ? 'CAN' : 'CANNOT'}. `
      + 'One day, two capability stories.');
    const menuMovable = !options.move.refusal;
    assert(menuMovable === canonicalDay.capabilities.canMoveWholeDay,
      `${label}: ${shape} and says its work `
      + `${canonicalDay.capabilities.canMoveWholeDay ? 'CAN' : 'CANNOT'} be moved; the move door `
      + `${menuMovable ? 'offers a move' : `refuses "${options.move.refusal?.reason}"`} `
      + `(locked=${options.locked ?? 'null'}). One day, two move stories.`);
    // The SWAP half, which no other suite states. The four-action menu offers
    // Swap from `canSwap`, and an anchor is not swappable — a day whose only
    // content is a fixed appointment must not offer to trade it for a gym
    // session.
    assert(options.canSwap === canonicalDay.parts.some((part) => part.capabilities.canSwap),
      `${label}: ${shape}; the menu says the day ${options.canSwap ? 'CAN' : 'CANNOT'} be `
      + 'swapped and the projection disagrees. One day, two swap stories.');
  }

  // L6 SCOPED MEANS SCOPED.
  if (args.scope && result.outcome === 'applied') {
    const remaining: string[] = getSessionComponents(afterDay?.workout ?? null)
      .map((part) => String(part.id));
    const expectedGone: string = args.scope === 'strength' ? 'strength' : args.scope;
    assert(!remaining.includes(expectedGone),
      `${label}: the scoped component "${expectedGone}" is still on the day`);
    // SUPPORT ROWS BELONG TO THE SESSION THEY SIT IN, and this is the one place
    // the law needed saying rather than assuming. `support` is not a session the
    // athlete can hold on its own — it is the accessory rows after the main lifts
    // (Bible `:224`, "midline and prehab sit after the accessories"). Moving the
    // strength session moves its own accessories with it; that is the session
    // travelling intact, not a scoped action overreaching.
    //
    // Asserted as a DECLARED belonging rather than by loosening the survivor set,
    // so a scoped strength move that took the day's CONDITIONING with it still
    // fails. Found when this state stopped inheriting its second part from a
    // deleted placement and started stacking onto a real strength day.
    const BELONGS_TO: Readonly<Record<string, readonly string[]>> = {
      strength: ['support'],
    };
    const travelsWith = new Set<string>([expectedGone, ...(BELONGS_TO[expectedGone] ?? [])]);
    const survivors = before.components.filter((part) => !travelsWith.has(part));
    for (const survivor of survivors) {
      assert(remaining.includes(survivor),
        `${label}: a SCOPED action took "${survivor}" with it — scoped means scoped`);
    }
  }
}

// ── The grid ──────────────────────────────────────────────────────────────

console.log('\n-- Athlete door matrix --');

let cells = 0;
for (const activeWorld of WORLDS) {
world = activeWorld;
for (const dayState of DAY_STATES) {
  const routeless = !/g1|gunshow/.test(dayState.id);
  for (const door of doorsFor(routeless)) {
    const context = quiet(() => dayState.build());
    const change = door.change(context);
    if (!change) continue;
    cells += 1;

    const label = `[${world.id}] ${door.id} × ${dayState.id}`;
    const beforeDay = dayOn(context.weekStart, context.date);
    const before = {
      week: weekFingerprint(context.weekStart),
      day: fingerprint(beforeDay),
      components: getSessionComponents(beforeDay?.workout ?? null).map((part) => part.id),
    };

    // ATTEMPT 1
    cell(`${label} [1]`, () => {
      let result: ReturnType<typeof applyPlanChange>;
      try {
        result = quiet(() => applyPlanChange({
          change,
          visibleWeek: visibleWeek(context.weekStart),
          todayISO: world.todayISO,
          applyOverride: (date, workout, ctx) =>
            seedManualOverride(date, workout, ctx),
        }));
      } catch (error) {
        // L1 NO CRASH.
        throw new Error(`L1 CRASH: the door threw instead of answering — ${
          error instanceof Error ? error.message : String(error)}`);
      }
      assertLaws({ label: `${label} [1]`, ...context, before, result, scope: door.scope });
    });

    // ATTEMPT 2 — L7 REPEAT IS HONEST.
    cell(`${label} [2]`, () => {
      const beforeRepeat = weekFingerprint(context.weekStart);
      let result: ReturnType<typeof applyPlanChange>;
      try {
        result = quiet(() => applyPlanChange({
          change,
          visibleWeek: visibleWeek(context.weekStart),
          todayISO: world.todayISO,
          applyOverride: (date, workout, ctx) =>
            seedManualOverride(date, workout, ctx),
        }));
      } catch (error) {
        throw new Error(`L1 CRASH on repeat — ${
          error instanceof Error ? error.message : String(error)}`);
      }
      assertLaws({
        label: `${label} [2]`, ...context,
        before: {
          week: beforeRepeat,
          day: fingerprint(dayOn(context.weekStart, context.date)),
          components: [],
        },
        result,
      });
    });
  }
}

}
// ── The preview door answers the same way ────────────────────────────────

for (const activeWorld of WORLDS) { world = activeWorld;
cell(`[${activeWorld.id}] a day with two sessions offers a way to move ONE of them`, () => {
  // SAM'S FINDING 3, and the reason the first version of this matrix could not
  // see it. His scoped move took both halves — and the sheet was innocent: it
  // passes the scope it was given, and auto-skips the scope picker when the
  // producer offers exactly ONE scope. When that one scope is `whole_day`, the
  // athlete taps "move the gym session" and moves the whole day.
  //
  // So the law lives at the OFFER, not the commit: a day the athlete sees as
  // two sessions must offer a way to move one of them. Anything else is a
  // scoped move that silently is not scoped.
  let multiSessionDaysSeen = 0;
  for (const dayState of DAY_STATES) {
    const context = quiet(() => dayState.build());
    // The producer's OWN count of how many sessions the day shows — the same
    // number the add door uses to decide whether the day is full. If the app
    // says two, the athlete sees two.
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: world.todayISO,
    }));
    if (options.visibleSessionCount < 2) continue;
    if (options.move.refusal) continue;
    multiSessionDaysSeen += 1;
    const ids = options.move.scopes.map((scope) => scope.id);
    const scoped = ids.filter((id) => id !== 'whole_day');
    assert(scoped.length > 0,
      `${dayState.id}: the app itself counts ${options.visibleSessionCount} sessions on `
      + `this day (${options.visibleSessionKinds.join(', ')}) but the only move offered is `
      + `${JSON.stringify(ids)} — tapping it moves everything`);
  }
  // NON-VACUITY, and a coverage limit stated rather than implied. The only
  // multi-session day this grid can currently BUILD is the combined team day:
  // every other two-part shape needs an add to stack onto an occupied day, and
  // that door is declared broken below (`OFFERS_THE_DOOR_REFUSES`). So this law
  // is real but thin, and it gets its second and third shapes for free the day
  // that declaration is deleted.
  assert(multiSessionDaysSeen > 0,
    'no day-state in this grid renders two sessions — the law above asserted nothing');
});

cell(`[${activeWorld.id}] a day carrying a commitment never offers to move the WHOLE day`, () => {
  // The other half of Sam's finding 3, and the half the day-shape law above
  // cannot see — a pure commitment day counts as ONE session, so it never
  // reaches that cell, and a whole-day move there reschedules an appointment
  // the athlete does not control.
  //
  // This is the assertion that makes the fix load-bearing: mutation-testing
  // `carriesImmovableContent` away left the whole grid green, because the only
  // commitment day it could build was the combined team night, whose
  // `whole_day` was already removed by the anchor. The anchor ends in
  // `/\bteam training\b/` over a rendered title, so a commitment called
  // anything else — `pure_commitment_day` below is called "Club Session" —
  // fell straight through to offering the whole day.
  let commitmentDaysSeen = 0;
  for (const dayState of DAY_STATES) {
    const context = quiet(() => dayState.build());
    const options = quiet(() => listPlanChangeOptionsForDay({
      visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: world.todayISO,
    }));
    if (!options.visibleSessionKinds.includes('session')) continue;
    commitmentDaysSeen += 1;
    if (options.move.refusal) continue;
    const ids = options.move.scopes.map((scope) => scope.id);
    assert(!ids.includes('whole_day'),
      `${dayState.id}: the day carries a commitment `
      + `(${options.visibleSessionKinds.join(', ')}) and still offers `
      + `${JSON.stringify(ids)} — a whole-day move takes the commitment with it`);
  }
  assert(commitmentDaysSeen >= 2,
    `only ${commitmentDaysSeen} day-state carries a commitment — this law needs both `
    + 'the combined team night AND a commitment the anchor regex does not recognise');
});

/**
 * L8 THE MENU MEANS WHAT IT SAYS.
 *
 * Every option the producer puts in front of the athlete must be one the door
 * accepts, or one it refuses IN WORDS ABOUT THAT OPTION. An offer the commit
 * path throws away is the same defect as a "Done." over an unchanged day, one
 * layer earlier, and it is the shape behind Sam's finding 3: the sheet showed a
 * scope the move door could not honour.
 *
 * This drives the OFFER rather than a hand-written door list, so a new category
 * or scope is covered the moment the producer starts offering it.
 */
const OFFERS_THE_DOOR_REFUSES: ReadonlyArray<{ offer: string; why: string }> = [
  // EMPTY, and it earned that. The one entry it held was
  // `addOnTopCategories` — offered on every day already holding a session and
  // refused on all of them, because `resolveAthleteMutation` bailed with
  // `add_defers_to_legacy_stack` in front of a stacking materialiser that had
  // been able to do the job all along. Two of Sam's five device findings were
  // that deferral. It is retired, so this law now holds the door to its own
  // menu instead of recording that it does not.
];

cell(`[${activeWorld.id}] every option the day OFFERS is one the door accepts or refuses in words`, () => {
  const declared = new Set(OFFERS_THE_DOOR_REFUSES.map((entry) => entry.offer));
  let optionsDriven = 0;
  const broken: string[] = [];

  for (const dayState of DAY_STATES) {
    // Each offer is driven from a FRESH build: an add that lands changes what
    // the next option would have been offered against.
    const offersFor = (): { weekStart: string; date: string; ids: string[] } => {
      const context = quiet(() => dayState.build());
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: world.todayISO,
      }));
      return { ...context, ids: options.addOnTopCategories.map((category) => category.id) };
    };
    if (declared.has('addOnTopCategories')) continue;
    for (const category of offersFor().ids) {
      const context = quiet(() => dayState.build());
      optionsDriven += 1;
      const result = quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: context.date, category } as PlanChange,
        visibleWeek: visibleWeek(context.weekStart),
        todayISO: world.todayISO,
        applyOverride: (date, workout, ctx) =>
          seedManualOverride(date, workout, ctx),
      }));
      if (result.outcome === 'applied') continue;
      // The G-1 ask is not a refusal — it is the funnel working. The athlete is
      // asked before content lands the day before a game, and answering is a
      // separate tap. Driving the routed form is `add_*:<route>` in the door
      // table above; here the ask counts as the menu meaning what it says.
      if (result.rejected?.some((entry) => entry.code === 'g1_route_required')) continue;
      broken.push(`${dayState.id}: offered "${category}" on top, door said `
        + `${result.outcome} — "${result.message}" `
        + `codes=${JSON.stringify((result.rejected ?? []).map((entry) => entry.code))} `
        + `why=${JSON.stringify((result.rejected ?? []).map((entry) => entry.reason?.slice(0, 120)))}`);
    }
  }

  assert(broken.length === 0,
    `the menu offered what the door will not take:\n        ${broken.join('\n        ')}`);
  // Non-vacuity: with the declaration above in place this cell drives nothing,
  // and that is exactly what the declaration is admitting.
  assert(optionsDriven > 0 || declared.size > 0,
    'no offered option was driven and nothing was declared — this cell is asleep');
});

/**
 * L12, THE GAP THIS UNIT'S OWN REPORT NAMED: nothing asserted that a capability
 * the PROJECTION grants is one a TRANSACTION will honour.
 *
 * `partCapabilities` now says a team night's commitment is removable — Sam's
 * signed "can't make it tonight, this date only" — and the four-action menu
 * renders Remove live because of it. Between that promise and the writer sits
 * the sheet's scope choice, and it was hardcoding `whole_day` whenever the
 * producer offered one scope. On a team-only night the one offered scope is
 * `team`; `whole_day` is refused outright because the day carries an anchor. A
 * live row, an honest tap, and a refusal for an action nobody asked for.
 *
 * So the law is the ROUND TRIP: every scope the menu OFFERS must be one the
 * transaction ACCEPTS. Driven from the offer, so a new scope is covered the
 * moment the producer starts listing it, and stated over every day-state rather
 * than the one shape a report happened to name.
 */
cell(`[${activeWorld.id}] every bin scope the menu offers is one the transaction accepts`, () => {
  let scopesDriven = 0;
  let singleScopeShapesSeen = 0;
  const broken: string[] = [];
  for (const dayState of DAY_STATES) {
    // Fresh build per scope: a removal that lands changes what the next scope
    // would have been offered against.
    const offered = (): { weekStart: string; date: string; ids: PlanChangeBinScopeId[] } => {
      const context = quiet(() => dayState.build());
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: world.todayISO,
      }));
      return { ...context, ids: options.binScopes.map((scope) => scope.id) };
    };
    const ids = offered().ids;
    if (ids.length === 1 && ids[0] !== 'whole_day') singleScopeShapesSeen += 1;
    for (const scope of ids) {
      const context = quiet(() => dayState.build());
      scopesDriven += 1;
      const result = quiet(() => applyPlanChange({
        change: { kind: 'remove_session', date: context.date, scope },
        visibleWeek: visibleWeek(context.weekStart),
        todayISO: world.todayISO,
        applyOverride: (date, workout, ctx) =>
          seedManualOverride(date, workout, ctx),
      }));
      if (result.outcome === 'applied') continue;
      broken.push(`${dayState.id}: the menu offered bin scope "${scope}", the door said `
        + `${result.outcome} — "${result.message}"`);
    }
  }
  assert(broken.length === 0,
    `the menu offered a removal the door will not take:\n        ${broken.join('\n        ')}`);
  assert(scopesDriven > 0, 'no bin scope was driven — this cell is asleep');
  // NON-VACUITY FOR THE SHAPE THAT CAUSED IT. A grid with no single-non-whole-day
  // scope would pass this law while proving nothing about the team-only night.
  assert(singleScopeShapesSeen > 0,
    'no day-state offers exactly ONE non-whole-day bin scope — the shape the sheet '
    + 'was converting to a whole-day removal is unreachable, so this law is thin');
});

/**
 * OFFER IMPLIES A WORKING DOOR, for the five types Sam's ruling 9 puts on the
 * Add/Swap step.
 *
 * The `add_mobility` door in the grid above could not catch the mobility split,
 * and that is worth saying plainly: a REFUSAL is an honest L2/L5 outcome, so a
 * door that always refused would have held every law in this file. The sheet's
 * own rule is stronger — it never offers a door with nothing behind it — and
 * this is that rule as an assertion.
 *
 * The offer is reconstructed from the producer's own facts, not from a hand
 * list: the type step renders `categories` (minus `recovery`, which ruling 9
 * removes from the menu), and `chooseType` blocks a full day or a duplicate
 * KIND. `planChangeCategoryAddsSessionKind` is the producer's own owner for that
 * kind, imported rather than restated.
 */
cell(`[${activeWorld.id}] every session type the Add step offers is one the door accepts`, () => {
  let offersDriven = 0;
  const broken: string[] = [];
  for (const dayState of DAY_STATES) {
    const reachable = (): { weekStart: string; date: string; ids: string[] } => {
      const context = quiet(() => dayState.build());
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: world.todayISO,
      }));
      if (options.locked) return { ...context, ids: [] };
      if (options.visibleSessionCount >= 2) return { ...context, ids: [] };
      const ids = options.categories
        .map((category) => category.id)
        .filter((id) => id !== 'recovery')
        .filter((id) => {
          const adds = planChangeCategoryAddsSessionKind(id);
          return adds === 'recovery' || !options.visibleSessionKinds.includes(adds);
        });
      return { ...context, ids };
    };
    for (const category of reachable().ids) {
      const context = quiet(() => dayState.build());
      offersDriven += 1;
      const result = quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: context.date, category } as PlanChange,
        visibleWeek: visibleWeek(context.weekStart),
        todayISO: world.todayISO,
        applyOverride: (date, workout, ctx) =>
          seedManualOverride(date, workout, ctx),
      }));
      if (result.outcome === 'applied') continue;
      // The G-1 ask is the funnel working, not a refusal — see the sibling law.
      if (result.rejected?.some((entry) => entry.code === 'g1_route_required')) continue;
      broken.push(`${dayState.id}: the Add step offered "${category}", the door said `
        + `${result.outcome} — "${result.message}" `
        + `codes=${JSON.stringify((result.rejected ?? []).map((entry) => entry.code))}`);
    }
  }
  assert(broken.length === 0,
    `the Add step offered a session type the door will not take:\n        ${broken.join('\n        ')}`);
  assert(offersDriven > 0, 'no Add offer was driven — this cell is asleep');
});

cell(`[${activeWorld.id}] preview never throws, on any day-state`, () => {
  for (const dayState of DAY_STATES) {
    const context = quiet(() => dayState.build());
    for (const category of ['conditioning_hard', 'strength_full'] as const) {
      try {
        quiet(() => previewPlanChangeRisk({
          change: { kind: 'add_category', date: context.date, category },
          visibleWeek: visibleWeek(context.weekStart),
          todayISO: world.todayISO,
          profile: useProfileStore.getState().onboardingData ?? undefined,
          activeConstraints: [],
        }));
      } catch (error) {
        throw new Error(`preview threw on ${dayState.id}/${category}: ${
          error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
});

cell(`[${activeWorld.id}] athlete-placed content survives the resolver on every day-state`, () => {
  // The law the whole G-1 unit exists for, swept across the grid rather than
  // asserted on the one day a device report happened to name.
  for (const dayState of DAY_STATES) {
    if (dayState.id === 'game_day') continue;
    const context = quiet(() => dayState.build());
    const result = quiet(() => applyPlanChange({
      change: {
        kind: 'add_category', date: context.date, category: 'conditioning_hard',
        g1Route: 'deloaded',
      },
      visibleWeek: visibleWeek(context.weekStart),
      todayISO: world.todayISO,
      applyOverride: (date, workout, ctx) =>
        seedManualOverride(date, workout, ctx),
    }));
    if (result.outcome !== 'applied') continue;
    const day = dayOn(context.weekStart, context.date);
    assert(day?.workout, `${dayState.id}: an applied add left the day empty`);
    assert(isAthletePlacedSession(day.workout),
      `${dayState.id}: the athlete's own content reached the visible week unstamped — `
      + 'a deriver will overwrite it');
  }
});

}
// ── THE THIRD DIMENSION: PLACEMENT × DOMAIN ───────────────────────────────
//
// SAM'S RULING, 2026-07-30: "Build the (placement × domain) matrix cells from
// question 7 — every optional placement deleted × every contract domain still
// satisfiable — into the athlete-door matrix, red before the deletions, green
// after."
//
// WHY THIS DIMENSION EXISTS, and it is the whole of L12 for its class. Two defects
// were found by two different suites, months of work apart in feel and one commit
// apart in fact: deleting an unauthored placement STARVED a shortfall repair,
// because every repair reached its day by overwriting an existing allocation. The
// strength domain starved first (found on a device round trip); the conditioning
// domain starved second (found by a hydration suite). They differ only by which
// domain — a coordinate in a space nothing enumerated.
//
// So the space is enumerated here. The two halves are asserted together, because
// either alone is satisfiable by the wrong week:
//
//   D-DOMAIN     every contract domain is satisfied, in every scenario. This is
//                the half that reds if a repair starves — the week comes out
//                short and the gateway rejects it.
//   D-PLACEMENT  no optional session exists that no NEED justifies. This is the
//                half that reds if a day-based placement comes back. Without it,
//                D-DOMAIN could be satisfied by re-introducing the filler.
//
// Held to the ALLOCATOR's output rather than to a door, because that is where both
// defects lived. It shares the file with the door grid because it shares its
// purpose: a coordinate nobody enumerated is where the next device round trip
// comes from.

console.log('\n-- Placement × domain --');

const PLACEMENT_SCENARIOS: ReadonlyArray<{
  readonly id: string;
  readonly phase: 'In-season' | 'Off-season' | 'Pre-season';
  readonly weeksAfterPhaseEntry: number;
  readonly overrides: Record<string, unknown>;
}> = [
  { id: 'in-season/game/5d/2tt', phase: 'In-season', weeksAfterPhaseEntry: 0, overrides: {} },
  { id: 'in-season/game/4d/0tt', phase: 'In-season', weeksAfterPhaseEntry: 0, overrides: {
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'] } },
  { id: 'in-season/bye/5d/2tt', phase: 'In-season', weeksAfterPhaseEntry: 0, overrides: {
    usualGameDay: undefined, gameDay: undefined } },
  { id: 'in-season/bye/6d/0tt', phase: 'In-season', weeksAfterPhaseEntry: 0, overrides: {
    usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] } },
  { id: 'off-season/early/5d', phase: 'Off-season', weeksAfterPhaseEntry: 0, overrides: {
    usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [] } },
  { id: 'off-season/mid/5d', phase: 'Off-season', weeksAfterPhaseEntry: 2, overrides: {
    usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [] } },
  { id: 'off-season/late/6d', phase: 'Off-season', weeksAfterPhaseEntry: 6, overrides: {
    usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] } },
  { id: 'pre-season/mid/5d/1tt', phase: 'Pre-season', weeksAfterPhaseEntry: 2, overrides: {
    usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 1, teamTrainingDays: ['Tuesday'] } },
];

const DAY_NAME_TO_NUMBER: Readonly<Record<string, number>> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/** The contract domains a week can be short of. Every one is asserted per week. */
const CONTRACT_DOMAINS = ['main_strength', 'conditioning', 'sprint_high_speed'] as const;

const PREHAB_NAMES = new Set([
  ...GROIN_ADDUCTORS_POOL, ...CALVES_POOL, ...LOWER_PREHAB_POOL,
  ...TRUNK_ANTI_ROTATION_POOL, ...SHOULDER_HEALTH_POOL, ...HAMSTRING_LIGHT_POOL,
].map((entry) => canonicalExerciseName(entry.name)));
const MOBILITY_NAMES = new Set(MOBILITY_POOL.map((entry) => canonicalExerciseName(entry.name)));

const rowNamesOf = (workout: Workout): string[] =>
  (workout.exercises ?? []).map((row) =>
    canonicalExerciseName((row as { exercise?: { name?: string } }).exercise?.name ?? ''));
const isComposedOf = (workout: Workout, pool: Set<string>): boolean => {
  const names = rowNamesOf(workout);
  return names.length > 0 && names.every((name) => pool.has(name));
};

for (const scenario of PLACEMENT_SCENARIOS) {
  const scenarioProfile = {
    ...syntheticProfile(),
    seasonPhase: scenario.phase,
    ...scenario.overrides,
  } as unknown as OnboardingData;
  const generationToday = SYNTHETIC_WEEK;
  const phaseEntry = addDaysISO(generationToday, -7 * scenario.weeksAfterPhaseEntry);

  let program: TrainingProgram | null = null;
  cell(`[placement] ${scenario.id} generates at all`, () => {
    program = quiet(() => generateProgramLocally(scenarioProfile, {
      todayISO: generationToday, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1, selectedPhase: scenario.phase as never,
        phaseEntryWeekStartISO: phaseEntry,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    } as never));
    if (!program) throw new Error('generation returned nothing');
  });
  if (!program) continue;

  const microcycles = (program as TrainingProgram).microcycles ?? [];
  microcycles.forEach((week, index) => {
    const contract = (week as { exposureContractV2?: unknown }).exposureContractV2;
    const workouts = week.workouts ?? [];

    // ── D-DOMAIN: every contract domain satisfied, in every scenario ──
    //
    // The half that reds when a repair starves. It is asserted per DOMAIN rather
    // than as one "accepted" boolean, because that is the coordinate the two
    // defects differed by: a suite that only checks acceptance tells you the week
    // failed, not which domain the filler was propping up.
    for (const domain of CONTRACT_DOMAINS) {
      cell(`[placement] ${scenario.id} w${index + 1} × ${domain} is satisfied`, () => {
        if (!contract) throw new Error('the week carries no typed contract to satisfy');
        const evaluation = evaluateSection18EffectiveWeek({
          contract: contract as never,
          workouts,
          weekStart: week.startDate.slice(0, 10),
        });
        const breaches = evaluation.blockingViolations.filter(
          (violation) => violation.domain === domain);
        if (breaches.length > 0) {
          throw new Error(
            `${domain} is short: ${JSON.stringify(breaches)}. If this appeared when a `
            + 'day-based optional placement was deleted, the repair for this domain was '
            + 'reaching its day by overwriting that placement — see '
            + 'docs/REPAIR_CAPACITY_REASSESSMENT_2026-07-30.md.');
        }
      });
    }

    // ── D-PLACEMENT: the optional sessions are EXACTLY the ones a need chose ──
    //
    // STRONGER THAN THE FIRST DRAFT, and the draft's weakness is worth recording
    // because it is the mutation test that found it. The first form asked only
    // whether a need EXISTED for each optional session ("the week without it covers
    // fewer than three of the six regions"). Restoring the deleted R2 placement did
    // not red it: R2 puts accessories on G-3 whether or not the week is short, and
    // in these scenarios the week happens to BE short, so a day-based placement and
    // a need-based one were indistinguishable by that question.
    //
    // The question that distinguishes them is not "is something lacking" but "is
    // this the placement the need computation would make". So the cell RE-RUNS the
    // need computation over the week stripped of its optional sessions and requires
    // the observed set to equal the computed set, by type AND day.
    //
    // WHAT THE MUTATION TEST ACTUALLY SHOWED, recorded because it is weaker than the
    // sentence above wants to be. Restoring R2, and then R3, left this cell GREEN in
    // every scenario here: the deleted day-based rules place on the SAME day the need
    // chooses (G-3 of a Saturday game week is both the Bible's Wednesday and the only
    // spare day), and the need genuinely exists in those weeks. So the four deletions
    // are BEHAVIOUR-PRESERVING in the space this dimension covers — what they change
    // is that the placement now has a stated reason, and that the shortfall repairs no
    // longer depend on it.
    //
    // This half is therefore a RATCHET against future divergence, not evidence that
    // the deletions changed a week. The half that is genuinely red-before-green-after
    // is D-DOMAIN above: removing the repairs' free-day capacity reds
    // `in-season/bye/6d/0tt` with `main_strength:2` and `conditioning:2` — the
    // starvation, named by domain, which is exactly what the dimension is for.
    cell(`[placement] ${scenario.id} w${index + 1} × optional sessions are the NEEDED ones`, () => {
      const isAccessories = (workout: Workout): boolean =>
        workout.sessionTier === 'optional' && isComposedOf(workout, PREHAB_NAMES);
      const isMobility = (workout: Workout): boolean => isComposedOf(workout, MOBILITY_NAMES);
      const optional = workouts.filter((workout) => isAccessories(workout) || isMobility(workout));
      const core = workouts.filter((workout) => !optional.includes(workout));

      const declaredDays = ((scenarioProfile as { preferredTrainingDays?: string[] })
        .preferredTrainingDays ?? [])
        .map((name) => DAY_NAME_TO_NUMBER[name])
        .filter((day): day is number => typeof day === 'number');
      const gameDayOfWeek = workouts.find((workout) => workout.workoutType === 'Game')
        ?.dayOfWeek ?? null;

      const needed = computeOptionalTopUps({
        workouts: core,
        seasonPhase: scenario.phase,
        candidateDays: declaredDays.length > 0 ? declaredDays : [0, 1, 2, 3, 4, 5, 6],
        gameDayOfWeek,
      });

      const shape = (entries: ReadonlyArray<{ type: string; dayOfWeek: number }>): string =>
        entries.map((entry) => `${entry.type}@${entry.dayOfWeek}`).sort().join(',');
      const observed = shape(optional.map((workout) => ({
        type: isMobility(workout) ? 'mobility' : 'accessories',
        dayOfWeek: workout.dayOfWeek,
      })));
      const computed = shape(needed);
      if (observed !== computed) {
        throw new Error(
          `the week's optional sessions are [${observed || 'none'}] but the need computation `
          + `over the same week chooses [${computed || 'none'}]. A placement the need did not `
          + 'make is a day-based placement — see docs/OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md.');
      }

      // And the phase rule, asserted separately so a mobility session in the wrong
      // phase names the Bible line rather than reading as a set mismatch.
      const mobility = optional.filter(isMobility);
      if (scenario.phase !== 'Off-season' && mobility.length > 0) {
        throw new Error(
          `${mobility.length} mobility session(s) placed in ${scenario.phase}. The Bible at `
          + ':104 confines mobility gains to the off-season.');
      }
      if (mobility.length > OFFSEASON_MOBILITY_TARGET) {
        throw new Error(
          `${mobility.length} mobility sessions; the signed off-season aim is `
          + `${OFFSEASON_MOBILITY_TARGET}.`);
      }
    });
  });
}

console.log(`\nAthlete door matrix: ${cells} cells × 2 attempts over ${WORLDS.length} worlds`);
console.log(`  plus placement × domain: ${PLACEMENT_SCENARIOS.length} scenarios × ${CONTRACT_DOMAINS.length} domains`);
console.log(`Athlete door matrix totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`\nRED CELLS:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
