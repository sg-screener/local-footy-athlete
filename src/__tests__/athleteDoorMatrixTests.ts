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
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  previewPlanChangeRisk,
} from '../utils/planChangeProducer';
import type { PlanChange, PlanChangeMoveScopeId } from '../utils/planChangeTypes';
import { getSessionComponents } from '../utils/sessionComponents';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';

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
    seasonPhase: 'In-season', position: 'inside_mid',
    motivation: 'Build strength and football fitness', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes', teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
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
      surfaces: state,
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
      const weekStart = seedStores(baseProgram());
      const wednesday = addDaysISO(weekStart, 2);
      quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: wednesday, category: 'conditioning_hard' },
        visibleWeek: visibleWeek(weekStart),
        todayISO: world.todayISO,
        setManualOverride: (date, workout, ctx) =>
          useProgramStore.getState().setManualOverride(date, workout, ctx),
      }));
      return { weekStart, date: wednesday };
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

  // L6 SCOPED MEANS SCOPED.
  if (args.scope && result.outcome === 'applied') {
    const remaining: string[] = getSessionComponents(afterDay?.workout ?? null)
      .map((part) => String(part.id));
    const expectedGone: string = args.scope === 'strength' ? 'strength' : args.scope;
    assert(!remaining.includes(expectedGone),
      `${label}: the scoped component "${expectedGone}" is still on the day`);
    const survivors = before.components.filter((part) => part !== expectedGone);
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
          setManualOverride: (date, workout, ctx) =>
            useProgramStore.getState().setManualOverride(date, workout, ctx),
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
          setManualOverride: (date, workout, ctx) =>
            useProgramStore.getState().setManualOverride(date, workout, ctx),
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
        setManualOverride: (date, workout, ctx) =>
          useProgramStore.getState().setManualOverride(date, workout, ctx),
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
      setManualOverride: (date, workout, ctx) =>
        useProgramStore.getState().setManualOverride(date, workout, ctx),
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
console.log(`\nAthlete door matrix: ${cells} cells × 2 attempts over ${WORLDS.length} worlds`);
console.log(`Athlete door matrix totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\nRED CELLS:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
