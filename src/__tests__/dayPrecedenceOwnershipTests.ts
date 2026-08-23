/**
 * ONE PRECEDENCE ORDERING, ONE OWNER — Sam's Option C addition to Stage B.
 *
 * > "The precedence divergence between live and accepted resolvers is Stage B's
 * >  to fix in the same motion — one ordering, one owner."
 *
 * WHAT THE MEASUREMENT FOUND, and it is not what the map predicted.
 *
 * The map (`docs/PRECEDENCE_OWNERSHIP_REASSESSMENT_2026-08-04.md`) described
 * two derivation stacks that "order the same two inputs oppositely". They do
 * not. **They run the SAME ordering code.** `rebaseAcceptedEffectiveWeek`
 * composes `override > overlay > base` into a flat workout list and then hands
 * that list to `resolveFinalVisibleSection18Week`, which builds a throwaway
 * microcycle from it and calls `resolveWeekWithConditioning` — the live
 * resolver — with `manualOverrides: {}` and `weekScopedOverlays: {}`
 * (`section18AcceptedWeekGateway.ts:248-250`).
 *
 * So the accepted week's "marks last" is not a second ordering. It is the LIVE
 * ordering run against a blanked override surface: Priority 1 finds nothing,
 * Priority 2 (the calendar mark) fires, and the day comes back empty. **The
 * flattening is what demotes the override, and Priority 1 is the only thing in
 * the app that ever lets an override outrank a mark.**
 *
 * That reframes the fix. There is no ordering to reconcile between two stacks;
 * there is ONE ordering with a surface that is present on one path and absent
 * on the other. The unification is therefore to STATE the ordering once and
 * make the live path run it on the same terms the accepted path already does:
 * an emptying decision — a calendar mark, a removal constraint — sits ABOVE
 * composed content, whoever composed it.
 *
 * WHY THAT DIRECTION AND NOT THE OTHER. Sam recorded the device consequence
 * himself (`programStore.ts:1187-1196`): the screen prescribed Lower Squat on a
 * day he had marked rest "while the accepted week correctly held nothing".
 * *Correctly.* The accepted answer is the one his own note calls right, and the
 * derived-repair ruling (2026-07-30) is the same shape — a deletion door does
 * not speak for the calendar, and the calendar does not lose to a deriver.
 * This suite therefore converges the LIVE path onto the ACCEPTED answer and
 * changes the accepted stack's semantics not at all.
 *
 * THE SECOND DIVERGENCE IS NOT AN ORDERING QUESTION AT ALL.
 * `userRemovalConstraints` — the athlete's strongest decision surface, the
 * thing that makes a bin survive §18 — **is not a field on `ScheduleState`**
 * and appears nowhere in `sessionResolver.ts`. The live path cannot see it, so
 * it cannot order it. A bin the accepted week honours is invisible to the
 * screen the moment anything else occupies the day.
 *
 * WHAT THIS SUITE IS. The measurement instrument, written BEFORE the design
 * (recipe lesson 16: write the cell first and treat a red precondition as a
 * measurement, not as a broken test). Cells 1 and 2 build the collisions that
 * `derivedRepairOwnershipTests` does not — that suite's combination cell
 * authors its override on `aDayWithASession()` and marks rest on a hardcoded
 * DIFFERENT date, so the two surfaces never land on one day and it has been
 * green throughout.
 *
 * THE CLASS THIS CATCHES, not the instance: any day where two decision
 * surfaces collide and the screen answers differently from the accepted week.
 * Cell 3 asserts it as a property over a composed world rather than as named
 * dates, so a new surface, a new door or a new mark fails it the same way.
 *
 * Run: npm run test:day-precedence-ownership
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
  throw new Error('NETWORK DISABLED — precedence ownership is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import type {
  TrainingProgram,
  Workout,
  UserRemovalConstraint,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { seedManualOverride } from './support/programOverrideHarness';
import {
  samExport8Profile,
  SAM_EXPORT_8_CURRENT_WEEK,
} from './support/samDeviceExport8Fixture';

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
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
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

const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

/** Fresh install, his answers, generate. Nothing decided yet. */
function freshInstallAndGenerate(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Pre-season', phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const week = program.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  assert(week, 'the generated program does not contain the week under test');
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: week,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'day-precedence-ownership:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
}

function visibleWeek(): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
}

function identity(workout: Workout | null | undefined): string | null {
  return workout ? workout.planEntryId ?? workout.id : null;
}

function acceptedVisibleWorkouts(): Workout[] {
  const state = useProgramStore.getState() as never;
  const profile = useProfileStore.getState().onboardingData;
  return quiet(() => rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: WEEK,
    profile,
    markedDays: (useProgramStore.getState().acceptedMaterialContext).markedDays,
  })).visibleWorkouts;
}

/** Days where the screen and the accepted week disagree about what is on them. */
function splitDays(): string[] {
  const accepted = acceptedVisibleWorkouts();
  const split: string[] = [];
  for (const day of visibleWeek()) {
    const dayOfWeek = new Date(`${day.date}T12:00:00`).getDay();
    const acceptedWorkout = accepted.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null;
    if (identity(acceptedWorkout) !== identity(day.workout)) {
      split.push(`${day.date} screen=${identity(day.workout) ?? '(empty)'} `
        + `accepted=${identity(acceptedWorkout) ?? '(empty)'}`);
    }
  }
  return split;
}

function liveDay(date: string): ResolvedDay | undefined {
  return visibleWeek().find((day) => day.date === date);
}

function aDayWithASession(): string {
  const day = visibleWeek().find((entry) => !!entry.workout);
  assert(day, 'the generated week has no session at all to collide with');
  return day.date;
}

/**
 * Author an override the way the surface's own writer does, and mirror the
 * calendar mark into the accepted material context.
 *
 * The mirror matters: marks reach the live path through
 * `buildScheduleStateImperative` and the accepted path through
 * `acceptedMaterialContext.markedDays`. Without the mirror the cell would be
 * comparing a stack that was told about the mark against one that was not,
 * which measures plumbing rather than precedence.
 */
function authorAnOverride(date: string): Workout {
  const source = liveDay(date)?.workout;
  assert(source, `${date} has no session to re-author`);
  const authored: Workout = {
    ...JSON.parse(JSON.stringify(source)) as Workout,
    id: `athlete-authored-${date}`,
    planEntryId: `athlete-authored-${date}`,
  };
  quiet(() => seedManualOverride(date, authored));
  return authored;
}

function markRestOnBothStacks(date: string): void {
  quiet(() => useCalendarStore.getState().setRestDay(date));
  const context = useProgramStore.getState().acceptedMaterialContext as never as {
    markedDays: Record<string, string>;
  };
  useProgramStore.setState({
    acceptedMaterialContext: {
      ...(context as object),
      markedDays: { ...context.markedDays, [date]: 'rest' },
    },
  } as never);
}

function binWholeDay(date: string): void {
  const original = liveDay(date)?.workout;
  assert(original, `${date} has no session to bin`);
  const constraint = {
    id: `precedence-removal-${date}`,
    targetDate: date,
    scope: 'whole_session',
    status: 'active',
    createdAt: '2026-07-27T00:00:00.000Z',
    originalWorkout: JSON.parse(JSON.stringify(original)) as Workout,
    wholeDayRestOwned: true,
  } as unknown as UserRemovalConstraint;
  useProgramStore.setState({ userRemovalConstraints: [constraint] } as never);
}

console.log('\n-- Day precedence ownership --');

run('a calendar rest mark empties the day on the screen too, override or not', () => {
  // THE COLLISION `derivedRepairOwnershipTests` never builds: ONE day carrying
  // BOTH an authored override and a rest mark. That suite's combination cell
  // puts them on different dates, which is why it has been green while this
  // divergence stood.
  freshInstallAndGenerate();
  const target = aDayWithASession();
  authorAnOverride(target);
  markRestOnBothStacks(target);

  const shown = liveDay(target);
  assert(!shown?.workout,
    `the athlete marked ${target} as rest and the screen still prescribes `
    + `"${shown?.workout?.name}" (source: ${shown?.source}). The accepted week `
    + 'holds nothing there — Sam\'s own note at programStore.ts:1187-1196 calls '
    + 'that the CORRECT answer. Priority 1 is the only thing in the app that '
    + 'lets an override outrank a mark, and the accepted stack never reaches it '
    + 'because the gateway blanks the override surface before re-entering.');
  assert(splitDays().length === 0,
    `screen and accepted week disagree: ${JSON.stringify(splitDays())}`);
});

run('an active whole-session removal constraint is visible to the screen', () => {
  // NOT an ordering question. `userRemovalConstraints` is not a field on
  // `ScheduleState` and appears nowhere in `sessionResolver.ts`, so the live
  // path cannot order what it cannot see. The accepted week honours the bin;
  // the screen shows the override sitting on top of it.
  freshInstallAndGenerate();
  const target = aDayWithASession();
  authorAnOverride(target);
  binWholeDay(target);

  const shown = liveDay(target);
  assert(!shown?.workout || shown.workout.workoutType === 'Rest',
    `the athlete binned ${target} and the screen still prescribes `
    + `"${shown?.workout?.name}" (source: ${shown?.source}). The bin is the `
    + 'athlete\'s strongest decision surface — it is what makes a deletion '
    + 'survive §18 — and the live resolver has never been able to see it.');
  assert(splitDays().length === 0,
    `screen and accepted week disagree: ${JSON.stringify(splitDays())}`);
});

run('the athlete\'s own override still outranks the derived plan', () => {
  // THE COUNTER-CELL. A "fix" that simply stopped honouring overrides would
  // pass the two cells above and break every athlete and coach edit in the app.
  // An override with NO competing decision on its day must still win.
  freshInstallAndGenerate();
  const target = aDayWithASession();
  const authored = authorAnOverride(target);

  const shown = liveDay(target);
  assert(identity(shown?.workout) === identity(authored),
    `an uncontested override is not what the screen shows — authored `
    + `"${identity(authored)}", screen "${identity(shown?.workout)}"`);
  assert(splitDays().length === 0,
    `an uncontested override split the surfaces: ${JSON.stringify(splitDays())}`);
});

run('agreement holds across a world carrying every surface at once', () => {
  // THE PROPERTY, not the instance. Base + overlay + override + mark +
  // constraint, deliberately including two colliding days, asserted as zero
  // divergence over the whole week rather than as named dates — so a new
  // surface or a new door fails it the same way.
  freshInstallAndGenerate();
  const days = visibleWeek().filter((day) => !!day.workout).map((day) => day.date);
  assert(days.length >= 3,
    `the generated week has ${days.length} sessions; this cell needs at least 3`);

  const [collideWithMark, collideWithBin, uncontested] = days;

  // A system-authored overlay on the uncontested day — derived content, which
  // an athlete override must still beat.
  const overlaySource = liveDay(uncontested)?.workout as Workout;
  const overlay: WeekScopedWorkoutOverlay = {
    id: `precedence-overlay:${WEEK}`,
    weekStartDate: WEEK,
    reason: 'readiness_reduction',
    createdAt: '2026-07-27T00:00:00.000Z',
    workoutsByDate: {
      [uncontested]: {
        ...JSON.parse(JSON.stringify(overlaySource)) as Workout,
        id: `overlay-authored-${uncontested}`,
        planEntryId: `overlay-authored-${uncontested}`,
      },
    },
  } as unknown as WeekScopedWorkoutOverlay;
  useProgramStore.setState({ weekScopedOverlays: { [WEEK]: overlay } } as never);

  authorAnOverride(collideWithMark);
  authorAnOverride(uncontested);
  markRestOnBothStacks(collideWithMark);
  binWholeDay(collideWithBin);

  assert(splitDays().length === 0,
    'one week, two answers: ' + JSON.stringify(splitDays()));
});

run('the ordering is stated in ONE place and the copies delegate to it', () => {
  // THE DE-DUPLICATION LESSON (AGENTS.md): a gate that reads code is coupled to
  // the code's shape, so this cell asserts the SHAPE IS GONE, not merely that
  // the owner exists. Six sites composed `override > overlay > base` by hand;
  // each one that keeps its own loop is a place the next ordering change misses.
  const root = path.resolve(__dirname, '..');
  const ownerPath = path.join(root, 'rules', 'dayPrecedence.ts');
  assert(fs.existsSync(ownerPath),
    'src/rules/dayPrecedence.ts does not exist — the ordering has no owner');

  const consumers = [
    'rules/acceptedEffectiveWeek.ts',
    'utils/sessionResolver.ts',
    'utils/postGenerationConstraintValidation.ts',
    'dev/e2e/devE2ESeedRegistry.ts',
  ];
  const missing = consumers.filter((relative) =>
    !fs.readFileSync(path.join(root, relative), 'utf8').includes('dayPrecedence'));
  assert(missing.length === 0,
    `these compose surfaces by hand and do not delegate to the owner: ${JSON.stringify(missing)}`);

  // The owner must not import the stacks that import it — the cycle is real
  // (the §18 gateway already imports sessionResolver).
  const ownerSource = fs.readFileSync(ownerPath, 'utf8');
  for (const forbidden of ['sessionResolver', 'acceptedEffectiveWeek', 'section18AcceptedWeekGateway']) {
    assert(!ownerSource.includes(`from '../utils/${forbidden}'`)
      && !ownerSource.includes(`from './${forbidden}'`),
      `the precedence owner imports ${forbidden} — that is the cycle the module exists to avoid`);
  }
});

run('an explicit null override means the SAME thing at every site', () => {
  // MEASURED DIVERGENCE (map §2): product sites test the override surface for
  // TRUTHINESS, so an explicit `null` falls through to overlay/base; the
  // dev-E2E seed registry tests `hasOwnProperty`, so the same entry means "this
  // day is empty". One surface, two meanings, and a witness built on the second
  // can assert a state no product reader would ever produce.
  freshInstallAndGenerate();
  const target = aDayWithASession();
  const before = identity(liveDay(target)?.workout);
  useProgramStore.setState({
    dateOverrides: {
      ...(useProgramStore.getState() as never as { dateOverrides: object }).dateOverrides,
      [target]: null,
    },
  } as never);

  const after = identity(liveDay(target)?.workout);
  const acceptedAfter = identity(acceptedVisibleWorkouts().find((workout) =>
    workout.dayOfWeek === new Date(`${target}T12:00:00`).getDay()) ?? null);
  assert(after === acceptedAfter,
    `an explicit null override splits the surfaces on ${target}: `
    + `screen "${after}", accepted "${acceptedAfter}" (was "${before}")`);

  // And the dev-E2E copy must read it the same way the product does.
  const registry = fs.readFileSync(
    path.resolve(__dirname, '..', 'dev', 'e2e', 'devE2ESeedRegistry.ts'), 'utf8');
  assert(registry.includes('dayPrecedence'),
    'devE2ESeedRegistry composes its own day surfaces, so a seeded witness can '
    + 'assert a state no product reader produces — the fixture-fidelity law '
    + '(AGENTS.md) at the precedence layer');
});

console.log(`\nDay precedence ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
