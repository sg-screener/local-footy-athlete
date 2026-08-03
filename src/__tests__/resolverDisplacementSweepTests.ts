/**
 * RESOLVER DISPLACEMENT SWEEP — every deriver answers the placement stamp.
 *
 * Sam's law (2026-07-28, extended 2026-07-30): athlete-placed content outranks
 * derived filler. That law was enforced at ONE site — `applyGameProximity`'s
 * G-1 branch — because that is where the device found it. The resolver has six
 * places that build a derived session, and the other five were never asked the
 * question at all.
 *
 * THIS TABLE IS THE TEST. Each row is one deriver, and each row proves BOTH
 * directions against the live resolver:
 *
 *   - unstamped content on that day IS displaced (the deriver really fires
 *     there, so the surviving arm cannot pass vacuously), and
 *   - the SAME content, stamped, survives.
 *
 * A row may answer `unreachable` instead of `consults` when placed content can
 * never arrive at the deriver's input. That answer still carries both arms: the
 * deriver must be shown firing, and the athlete's content must be shown
 * surviving. What no row may do is go unanswered.
 *
 * THE SIXTH DERIVER. `derivedSiteCount` counts `buildDerivedSession(` call
 * sites in the resolver and requires one row each. Adding a seventh deriver
 * fails this suite until its row exists, which is the whole point: the next
 * person to build derived content on top of an athlete's day has to say what
 * happens to the athlete's day.
 *
 * Run: npm run test:displacement-sweep
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
  throw new Error('NETWORK DISABLED — the displacement sweep must be local');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync } from 'fs';
import { join } from 'path';
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
import { athletePlacementFor, isAthletePlacedSession } from '../rules/athletePlacement';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';

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

/** The settled in-season week: Mon strength, Tue/Thu team, Fri G-1, Sat game. */
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
      lastTransaction: 'displacement-sweep:seed',
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
  return program.microcycles[1]!.startDate.slice(0, 10);
}

/**
 * Put a workout on a day of the composed week, exactly as
 * `applyUserRemovalConstraintsToWeek` does: the day's own content is removed
 * and the new session takes its place, stamped or not.
 *
 * The stamp's ingress is pinned elsewhere (`g1LandingAskFlowTests` 2,
 * `athletePlacementOwnershipTests`). What THIS suite is about is what every
 * deriver does with a stamp once it is there, so the plant is direct.
 */
function plant(weekStart: string, dayOfWeek: number, workout: Workout, stamped: boolean): void {
  const state = useProgramStore.getState() as unknown as {
    currentProgram: TrainingProgram;
    currentMicrocycle: TrainingProgram['microcycles'][number] | null;
  };
  const date = addDaysISO(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const planted: Workout = {
    ...workout,
    dayOfWeek,
    ...(stamped
      ? { athletePlacement: athletePlacementFor({ constraintId: 'sweep', placedDate: date }) }
      : { athletePlacement: undefined }),
  };
  const patch = <T extends { startDate: string; workouts: Workout[] }>(
    microcycle: T | null,
  ): T | null =>
    microcycle && microcycle.startDate.slice(0, 10) === weekStart
      ? {
          ...microcycle,
          workouts: microcycle.workouts
            .filter((existing) => existing.dayOfWeek !== dayOfWeek)
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
}

function clone(workout: Workout): Workout {
  return JSON.parse(JSON.stringify(workout)) as Workout;
}

function mondaySession(weekStart: string): Workout {
  const monday = (useProgramStore.getState() as unknown as { currentProgram: TrainingProgram })
    .currentProgram.microcycles
    .find((microcycle) => microcycle.startDate.slice(0, 10) === weekStart)
    ?.workouts.find((workout) => workout.dayOfWeek === 1);
  assert(monday, 'seed no longer has a Monday session to clone');
  return clone(monday);
}

function visibleDay(weekStart: string, dayOfWeek: number): ResolvedDay | undefined {
  const date = addDaysISO(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()))
    .find((day) => day.date === date);
}

function describe(day: ResolvedDay | undefined): string {
  const workout = day?.workout;
  if (!workout) return `REST (source=${day?.source ?? 'none'})`;
  return `"${workout.name}" (source=${day.source}, placed=${isAthletePlacedSession(workout)})`;
}

/**
 * One deriver. `build` returns the content to put on `dayOfWeek`; the row runs
 * it twice, unstamped and stamped, and the two arms must disagree.
 */
interface DisplacementSite {
  /** Stable id, and the row's name in the failure output. */
  id: string;
  /**
   * A literal from the deriver's own call in `utils/sessionResolver.ts`. The
   * completeness pin below reads the source, so a row that no longer matches a
   * real site is a failure rather than a comment that quietly went stale.
   */
  anchor: string;
  /**
   * `consults` — the deriver asks the placement predicate.
   * `unreachable` — placed content cannot reach this deriver's input, and the
   *   surviving arm proves it rather than asserting it.
   */
  answer: 'consults' | 'unreachable';
  dayOfWeek: number;
  build: (weekStart: string) => Workout;
}

const SITES: DisplacementSite[] = [
  {
    // Was `g_plus_1_recovery` / anchor 'Post-game recovery' until 2026-08-01:
    // the deleted-type retirement (device-pass fail 3) re-materialised the G+1
    // protection as a MOBILITY session. Same site, same stamp question, new
    // word — the row follows the literal so the completeness pin stays honest.
    id: 'g_plus_1_mobility',
    anchor: "'Post-game'",
    answer: 'consults',
    // Sunday, the day after Saturday's game.
    dayOfWeek: 0,
    // Deliberately NOT a protected core exposure name: `isProtectedCoreExposure`
    // would keep it for the wrong reason and the stamp would prove nothing.
    build: (weekStart) => ({
      ...mondaySession(weekStart),
      id: 'sweep-g-plus-1',
      planEntryId: undefined,
      name: 'Assault Bike Intervals',
    }),
  },
  {
    id: 'g_minus_1_gunshow',
    anchor: 'Pre-game day',
    answer: 'consults',
    dayOfWeek: 5,
    build: (weekStart) => ({
      ...mondaySession(weekStart),
      id: 'sweep-g-minus-1',
      planEntryId: undefined,
      name: 'Assault Bike Intervals',
    }),
  },
  {
    id: 'g_minus_2_downgrade',
    anchor: 'Pre-game window - avoiding upper-body stacking with G-1',
    answer: 'consults',
    // Thursday: G-2 to Saturday's game, with Friday's derived Gunshow above it.
    dayOfWeek: 4,
    // Named 'Gunshow' so the fatigue-stacking guard sees a derived-looking
    // upper duplicate and downgrades it — the arm that must stop for a stamp.
    build: (weekStart) => ({
      ...mondaySession(weekStart),
      id: 'sweep-g-minus-2',
      planEntryId: undefined,
      name: 'Gunshow',
    }),
  },
  {
    id: 'recovery_template_rebuild',
    // Anchor follows the 2026-08-01 deleted-type retirement: the rebuild now
    // materialises a MOBILITY session (the contents recovery always was).
    anchor: 'Scheduled mobility',
    answer: 'consults',
    // Wednesday: an ordinary mid-week day, no fixture proximity.
    dayOfWeek: 3,
    // The athlete's own recovery session. The rebuild replaces ANY recovery
    // template with the deterministic pool session, which silently discards
    // whatever the athlete put there.
    build: (weekStart) => ({
      ...mondaySession(weekStart),
      id: 'sweep-recovery',
      planEntryId: undefined,
      name: 'My Own Flush',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
    }),
  },
  {
    id: 'freed_game_slot',
    anchor: 'Freed game slot',
    answer: 'unreachable',
    // Wednesday again, this time carrying a template Game with no calendar
    // mark — a game that moved, leaving the slot behind.
    dayOfWeek: 3,
    build: (weekStart) => ({
      ...mondaySession(weekStart),
      id: 'sweep-freed-game',
      planEntryId: undefined,
      name: 'Assault Bike Intervals',
    }),
  },
  // THE PASS-3 ROW IS GONE WITH ITS DERIVER (2026-07-30).
  //
  // `resolveWeekWithConditioning`'s recovery fill pass put a derived recovery
  // session on every remaining empty day, and this row answered `unreachable`
  // because the fill only ran on days that resolved to nothing — which, while the
  // generator filled every spare day, never happened. Landing Sam's placement
  // rulings (R2-R5) made empty days real and the pass claimed one immediately, on a
  // G+1, where the athlete could not delete it. It fails condition 1 of the Optional
  // Placement Law (Bible 20.1) and is deleted, so its row goes with it rather than
  // sitting here answering for a deriver that no longer exists.
  //
  // `derivedSiteCount` below is what keeps this honest in the other direction: the
  // table must have exactly one row per `buildDerivedSession(` site, so a deletion
  // that forgot its row fails just as loudly as a new deriver that never wrote one.
];

/** The freed-game and fill rows need the day set up before the plant lands. */
function prepare(site: DisplacementSite, weekStart: string): void {
  if (site.id === 'freed_game_slot') {
    // A template Game with no calendar mark is the freed slot's precondition.
    plant(weekStart, site.dayOfWeek, {
      ...mondaySession(weekStart),
      id: 'sweep-freed-game-stub',
      planEntryId: undefined,
      name: 'Game Day',
      workoutType: 'Game',
    } as Workout, false);
  }
  if (site.id === 'pass_3_recovery_fill') {
    // The fill pass claims days that resolve to nothing at all.
    const state = useProgramStore.getState() as unknown as {
      currentProgram: TrainingProgram;
      currentMicrocycle: TrainingProgram['microcycles'][number] | null;
    };
    const strip = <T extends { startDate: string; workouts: Workout[] }>(
      microcycle: T | null,
    ): T | null =>
      microcycle && microcycle.startDate.slice(0, 10) === weekStart
        ? {
            ...microcycle,
            workouts: microcycle.workouts.filter(
              (workout) => workout.dayOfWeek !== site.dayOfWeek),
          }
        : microcycle;
    useProgramStore.setState({
      currentProgram: {
        ...state.currentProgram,
        microcycles: state.currentProgram.microcycles.map(
          (microcycle) => strip(microcycle as never) as never),
      },
      currentMicrocycle: strip(state.currentMicrocycle as never) as never,
    } as never);
  }
}

console.log('\n-- Resolver displacement sweep --');

for (const site of SITES) {
  run(`${site.id}: displaces content the athlete did not place`, () => {
    const weekStart = seed();
    prepare(site, weekStart);
    const content = site.build(weekStart);
    if (site.answer === 'consults') plant(weekStart, site.dayOfWeek, content, false);
    const day = visibleDay(weekStart, site.dayOfWeek);
    assert(day?.workout?.name !== content.name,
      `${site.id} never fires — the surviving arm would pass vacuously. Day holds ${describe(day)}`);
  });

  run(`${site.id}: leaves content the athlete DID place alone`, () => {
    const weekStart = seed();
    prepare(site, weekStart);
    const content = site.build(weekStart);
    plant(weekStart, site.dayOfWeek, content, true);
    const day = visibleDay(weekStart, site.dayOfWeek);
    assert(day?.workout, `${site.id} emptied the athlete's day: ${describe(day)}`);
    assert(day.workout.name === content.name,
      `${site.id} displaced athlete-placed content — day holds ${describe(day)}, not "${content.name}"`);
    assert(isAthletePlacedSession(day.workout),
      `${site.id} kept the day but dropped the stamp: ${describe(day)}`);
  });
}

// ── The sixth deriver has nowhere to hide ─────────────────────────────────

run('every derived-session site in the resolver has a row in this table', () => {
  const source = readFileSync(
    join(__dirname, '..', 'utils', 'sessionResolver.ts'), 'utf8');
  const derivedSiteCount = source.split('buildDerivedSession(').length - 1;
  assert(derivedSiteCount === SITES.length,
    `the resolver builds derived sessions at ${derivedSiteCount} sites but this table `
    + `has ${SITES.length} rows. A new deriver must say what it does with an `
    + `athlete-placed day before it ships.`);
  for (const site of SITES) {
    assert(source.includes(site.anchor),
      `row "${site.id}" is anchored on "${site.anchor}", which is no longer in the resolver`);
  }
  const ids = new Set(SITES.map((site) => site.id));
  assert(ids.size === SITES.length, 'two rows share an id');
});

run('the displacement question has exactly one owner', () => {
  const source = readFileSync(
    join(__dirname, '..', 'utils', 'sessionResolver.ts'), 'utf8');
  // Ruling #4: the resolver CONSULTS the stamp, it never re-decides ownership.
  // One import, one predicate, and no site rolling its own answer.
  assert(source.includes('resolverMayDisplace'),
    'the resolver no longer consults the shared displacement predicate');
  const inlineChecks = source.split('isAthletePlacedSession(').length - 1;
  assert(inlineChecks === 0,
    `${inlineChecks} site(s) ask the placement question directly instead of through `
    + 'resolverMayDisplace — that is a second owner of the same decision');
});

console.log(`\nResolver displacement sweep totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
