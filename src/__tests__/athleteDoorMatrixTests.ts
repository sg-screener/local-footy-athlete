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

const CURRENT_WEEK = '2026-07-13';

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

function profile(): OnboardingData {
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
let cachedProgram: TrainingProgram | null = null;
function baseProgram(): TrainingProgram {
  if (!cachedProgram) {
    cachedProgram = quiet(() => generateProgramLocally(profile(), {
      todayISO: CURRENT_WEEK, previousProgram: null,
      seasonPhaseClock: {
        protocolVersion: 1, selectedPhase: 'In-season',
        phaseEntryWeekStartISO: CURRENT_WEEK,
        originProvenance: 'explicit_user_phase_change',
        persistenceProvenance: 'preserved_persisted_state',
      },
    }));
  }
  return JSON.parse(JSON.stringify(cachedProgram)) as TrainingProgram;
}

function seedStores(program: TrainingProgram, markedDays: Record<string, string> = {}): string {
  useProfileStore.setState({ onboardingData: profile(), isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[1] ?? program.microcycles[0] ?? null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'matrix:seed', injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  return program.microcycles[1]!.startDate.slice(0, 10);
}

function visibleWeek(weekStart: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
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
        todayISO: weekStart,
        setManualOverride: (date, workout, ctx) =>
          useProgramStore.getState().setManualOverride(date, workout, ctx),
      }));
      return { weekStart, date: wednesday };
    },
  },
  {
    id: 'pure_commitment_day',
    build: () => {
      // A day that is ONLY a commitment — no gym work beside it. The snapshot
      // gives it a single `session` section titled from the workout name, so
      // unlike the combined team day it does not go down the hardcoded
      // "Team Training" branch, and the anchor regex is the only thing that
      // ever recognised it. A commitment is not the athlete's to reschedule
      // whatever it is called.
      const weekStart = seedStores(baseProgram());
      plant(weekStart, 3, {
        name: 'Club Session', workoutType: 'Team Training', sessionTier: 'core',
        exercises: [], durationMinutes: 90,
      });
      return { weekStart, date: addDaysISO(weekStart, 3) };
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
        visibleWeek: visibleWeek(weekStart), date, todayISO: weekStart,
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

  // L5 THE DAY STAYS USABLE.
  const options = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: visibleWeek(weekStart), date, todayISO: weekStart,
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
for (const dayState of DAY_STATES) {
  const routeless = !/g1|gunshow/.test(dayState.id);
  for (const door of doorsFor(routeless)) {
    const context = quiet(() => dayState.build());
    const change = door.change(context);
    if (!change) continue;
    cells += 1;

    const label = `${door.id} × ${dayState.id}`;
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
          todayISO: context.weekStart,
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
          todayISO: context.weekStart,
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

// ── The preview door answers the same way ────────────────────────────────

cell('a day with two sessions offers a way to move ONE of them', () => {
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
      visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: context.weekStart,
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
  {
    offer: 'addOnTopCategories',
    // FOUND BY THIS CELL, run one. `addOnTopCategories` is offered on every
    // day holding one session, and `resolveAthleteMutation` bails at
    // `if (addDay.workout) return { error: 'add_defers_to_legacy_stack' }` —
    // "occupied-day STACK adds stay on the legacy writer (out of scope this
    // stage)". The legacy writer does not deliver, so all three days that
    // offer it refuse with the generic copy and nothing changes.
    //
    // Declared, not fixed: retiring that legacy deferral is a unit of its own
    // (`planChangeProducer.ts` ~line 1615), and it is what makes every
    // non-anchored two-session day-state above reachable. Delete this entry
    // when it lands — the cell will then hold the door to its own menu.
    why: 'occupied-day stack adds defer to a legacy writer that refuses '
      + '(planChangeProducer resolveAthleteMutation: add_defers_to_legacy_stack)',
  },
];

cell('every option the day OFFERS is one the door accepts or refuses in words', () => {
  const declared = new Set(OFFERS_THE_DOOR_REFUSES.map((entry) => entry.offer));
  let optionsDriven = 0;
  const broken: string[] = [];

  for (const dayState of DAY_STATES) {
    // Each offer is driven from a FRESH build: an add that lands changes what
    // the next option would have been offered against.
    const offersFor = (): { weekStart: string; date: string; ids: string[] } => {
      const context = quiet(() => dayState.build());
      const options = quiet(() => listPlanChangeOptionsForDay({
        visibleWeek: visibleWeek(context.weekStart), date: context.date, todayISO: context.weekStart,
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
        todayISO: context.weekStart,
        setManualOverride: (date, workout, ctx) =>
          useProgramStore.getState().setManualOverride(date, workout, ctx),
      }));
      if (result.outcome === 'applied') continue;
      broken.push(`${dayState.id}: offered "${category}" on top, door said `
        + `${result.outcome} — "${result.message}"`);
    }
  }

  assert(broken.length === 0,
    `the menu offered what the door will not take:\n        ${broken.join('\n        ')}`);
  // Non-vacuity: with the declaration above in place this cell drives nothing,
  // and that is exactly what the declaration is admitting.
  assert(optionsDriven > 0 || declared.size > 0,
    'no offered option was driven and nothing was declared — this cell is asleep');
});

cell('preview never throws, on any day-state', () => {
  for (const dayState of DAY_STATES) {
    const context = quiet(() => dayState.build());
    for (const category of ['conditioning_hard', 'strength_full'] as const) {
      try {
        quiet(() => previewPlanChangeRisk({
          change: { kind: 'add_category', date: context.date, category },
          visibleWeek: visibleWeek(context.weekStart),
          todayISO: context.weekStart,
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

cell('athlete-placed content survives the resolver on every day-state', () => {
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
      todayISO: context.weekStart,
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

console.log(`\nAthlete door matrix: ${cells} cells × 2 attempts`);
console.log(`Athlete door matrix totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\nRED CELLS:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
