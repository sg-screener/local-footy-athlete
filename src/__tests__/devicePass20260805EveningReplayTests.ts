/**
 * SAM'S 2026-08-05 EVENING DEVICE PASS, REPLAYED THROUGH REAL DOORS.
 *
 * The evening pass FAILED on four doors AFTER the day's batch closed the
 * morning findings: season change, game add, the game-day sheet's actions, and
 * a delete that took ~30 seconds. Per Sam's redirect, NO FIXES ride with this
 * suite — these cells are the SPECIFICATION that either path (door-by-door
 * shell repair, or shell rebuild on the proven engine) must satisfy, so they
 * are valid work under both.
 *
 * WHAT THE EVENING EXPORT PROVES (device-export-2026-08-05-evening.txt, the
 * tape this suite is pinned to):
 *
 * - One relaunch, ZERO new athlete decisions, and the accepted revision moved
 *   25 -> 29. The boot ran THREE full durable accepted-state transactions.
 * - Each transaction cost ~31.5 s wall-clock on his phone (requested
 *   04:03:07.049 -> completed 04:03:38.712; requested 04:03:38.766 ->
 *   completed 04:04:10.379). The boot alone held the accepted-mutation lock
 *   for ~63 seconds. The dominant gap is persistence-write -> acknowledged
 *   readback (04:03:17.179 -> 04:03:38.711 = 21.5 s) over a ~485 KB envelope.
 * - The athleteActionLog holds ONLY that boot (~115 entries, all system) —
 *   his failing taps left no surviving trace, again. Boot door-writes are
 *   themselves DECISION events, so each launch floods the 200-entry ring.
 *
 * Node prices the same pipeline at 58-125 ms, which is why every functional
 * cell in the morning suite passes while his phone fails: the defect class is
 * WORK, not logic. One athlete tap moves ~1.1-1.2 MB through AsyncStorage
 * across up to 19 writes touching 8 stores, and the boot mints revisions that
 * refuse any tap rendered against the world the athlete could actually see.
 *
 * THE DECLARED-RED MECHANISM (same as the day suite): a declared red that
 * stops redding fails the suite — the commit that turns it green owes the
 * deletion of its entry. An UNDECLARED red fails the suite outright.
 *
 * Run: npm run test:device-pass-2026-08-05-evening
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
const storageStats = {
  armed: false,
  getCount: 0,
  setCount: 0,
  getBytes: 0,
  setBytes: 0,
  setsByKey: new Map<string, number>(),
};
function resetStorageStats(): void {
  storageStats.getCount = 0;
  storageStats.setCount = 0;
  storageStats.getBytes = 0;
  storageStats.setBytes = 0;
  storageStats.setsByKey.clear();
}
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => {
      const value = localStorageData.get(key) ?? null;
      if (storageStats.armed) {
        storageStats.getCount += 1;
        storageStats.getBytes += value?.length ?? 0;
      }
      return value;
    },
    setItem: (key: string, value: string) => {
      if (storageStats.armed) {
        storageStats.setCount += 1;
        storageStats.setBytes += value.length;
        storageStats.setsByKey.set(key, (storageStats.setsByKey.get(key) ?? 0) + 1);
      }
      localStorageData.set(key, value);
    },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — evening replay entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';

import type { TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { seedManualOverride } from './support/programOverrideHarness';
import { canonicalFixtureKind } from '../rules/fixtureConditionedAvailability';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift } from '../utils/profileMutations';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;

// ── The reproduction ledger ──────────────────────────────────────────────
interface DeclaredRed {
  id: string;
  finding: string;
  matches: RegExp;
  why: string;
  paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  // ── PAID BY R1.3, DELETED 2026-08-05 (the ratchet's own rule) ────────────
  //
  // `evening-0-boot-quiescence`, `evening-1-season-change-trace`,
  // `evening-2-game-add`, `evening-3-game-day-sheet` lived here. The quiescent
  // boot (store/quiescentBoot.ts) paid all four in one mechanism — exactly the
  // plan's R1 "Pays:" clause (docs/SHELL_REBUILD_PLAN_2026-08-05.md §3):
  // boot PARKS the old envelope and DERIVES the world from inputs under the
  // replay latch, so it mints no durable revisions (evening-0), emits no
  // decision-event flood into the ring (evening-1), and the first-rendered
  // world IS the world a tap's expectedAcceptedRevision meets — nothing for
  // the fixture doors to conflict with (evening-2/-3, green ahead of R1.4b's
  // retirement of the check itself). The cells stand, reworked onto the boot
  // law in this same commit; a regression now FAILS plainly instead of
  // wearing a declaration.
  {
    id: 'evening-4-slow-delete',
    finding: 'Deleting a session takes ~30 seconds on device',
    matches: /work bill beyond its decision/,
    why: 'One whole-day delete — a decision about ONE day of ONE store — writes '
      + 'EVERY persisted store (8 stores, up to 19 setItem calls, ~1.1 MB written, '
      + '~0.65 MB read, the ~0.4-0.5 MB program envelope serialized twice). Node '
      + 'prices that at 58-125 ms; his phone prices the identical pipeline at '
      + '~31.5 s per transaction (the tape\'s two boot transactions). The tap is '
      + 'slow because the WORK is unbounded relative to the decision, not because '
      + 'the decision is complex.',
    paidBy: 'a persistence boundary whose write set is the stores that own changed '
      + 'facts — under repair, scoped envelopes/incremental persistence; under '
      + 'rebuild, the new shell\'s store layout.',
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];
const declaredRedHits = new Set<string>();

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const declared = DECLARED_RED.find(
      (entry) => name.startsWith(entry.id) && entry.matches.test(message),
    );
    if (declared) {
      declaredRedHits.add(declared.id);
      passed += 1;
      console.log(`  RED (declared: ${declared.id}) ${name}`);
      console.log(`      ${message.split('\n')[0]}`);
      return;
    }
    failed += 1;
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

/** His world, reached by acting (identical to the day suite's builder). */
function reachHisWorldByActing(): void {
  localStorageData.clear();
  const profile = samDevicePass20260805Profile();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: null,
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProfileStore.setState({ onboardingData: {}, isOnboardingComplete: false } as never);
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: SAM_PASS_20260805_GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: SAM_PASS_20260805_ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: SAM_PASS_20260805_GENERATION_DAY,
    reason: 'evening-replay:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/**
 * His hydration ingress, exactly as the day suite reaches it: the legacy
 * schedule constraint an old build persisted (his export's active busy_week
 * source), then a relaunch. Returns the revision the persisted envelope
 * carried BEFORE boot ran — the accepted world the athlete's first render
 * shows, and therefore the expectedAcceptedRevision a first tap carries.
 */
const LEGACY_SCHEDULE_CONSTRAINT = {
  id: 'legacy-busy-week-2026-07-27',
  type: 'schedule',
  status: 'active',
  weekStartISO: '2026-07-27',
  startDate: '2026-07-27',
  createdAt: '2026-07-27T09:00:00.000Z',
  lastUpdatedAt: '2026-07-27T09:00:00.000Z',
  description: 'Busy week',
};

/**
 * R1.3 REWORK (shell rebuild, docs/SHELL_REBUILD_RULING_2026-08-05.md): the
 * hydration-migration ingress these cells drove CEASED TO EXIST — boot parks
 * an old-shape envelope byte-identical for R2 and derives the world from
 * inputs. The first relaunch here plants the old build's bytes (his legacy
 * constraint riding a fat envelope) and asserts the park; later relaunches
 * boot over the already-reduced disk. The first-rendered world the athlete
 * taps against is now the DERIVED world, so the render revision the taps
 * carry is the post-boot revision — there is no persisted one to diverge
 * from it.
 */
async function relaunchThroughHydration(): Promise<{ renderRevision: number }> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  const alreadyParked = localStorageData.has('program-store.pre-rebuild-envelope');
  let oldShapeEnvelope: string | null = null;
  if (!alreadyParked) {
    // The old build's disk, constructed the way his phone holds it: a fat
    // output envelope (no `inputs`) carrying the legacy constraint no
    // current writer can produce.
    const state = useProgramStore.getState();
    oldShapeEnvelope = JSON.stringify({
      state: {
        currentProgram: state.currentProgram,
        acceptedMaterialContext: {
          ...state.acceptedMaterialContext,
          activeConstraints: [
            ...(state.acceptedMaterialContext.activeConstraints ?? []),
            LEGACY_SCHEDULE_CONSTRAINT,
          ],
        },
      },
      version: 0,
    });
    localStorageData.set('program-store', oldShapeEnvelope);
  }
  const disk = new Map(localStorageData);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  await flushPendingStorageWrites().catch(() => undefined);
  localStorageData.clear();
  for (const [key, value] of disk) localStorageData.set(key, value);
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runQuiescentBoot } = require('../store/quiescentBoot');
    await runQuiescentBoot();
  });
  if (oldShapeEnvelope !== null) {
    const parked = localStorageData.get('program-store.pre-rebuild-envelope');
    assert(parked === oldShapeEnvelope,
      'relaunch: the old build\'s envelope was not parked byte-identical — '
      + 'R2\'s migration input is being corrupted or dropped');
    assert(parked!.includes(LEGACY_SCHEDULE_CONSTRAINT.id),
      'relaunch: the parked envelope lost his legacy constraint');
  }
  const context = (useProgramStore.getState() as unknown as {
    acceptedMaterialContext: { activeConstraints?: { id?: string }[] };
  }).acceptedMaterialContext;
  assert(!(context.activeConstraints ?? []).some(
    (constraint) => constraint.id === LEGACY_SCHEDULE_CONSTRAINT.id),
    'R1.3 boot law broken: the legacy schedule constraint entered the DERIVED '
    + 'world — a hydration lift is running below the quiescent boot');
  return { renderRevision: currentRevision() };
}

function currentRevision(): number {
  return (useProgramStore.getState() as unknown as {
    acceptedMaterialContext: { revision: number };
  }).acceptedMaterialContext.revision;
}

function visibleWeek(week: string = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

function fixtureSource(action: 'add' | 'remove', date: string, revision: number) {
  return {
    requestedBy: 'athlete' as const,
    producer: 'tap' as const,
    surface: 'program_tab' as const,
    commandId: `home-fixture:${action}:${action === 'remove' ? date : 'none'}:${date}:revision-${revision}`,
  };
}

const main = async () => {
  console.log('\n-- Sam device pass 2026-08-05 EVENING, replayed --');

  // ── The root: boot is not quiescent ──────────────────────────────────
  await run('evening-0-boot-quiescence: a relaunch with no new decision leaves the revision alone', async () => {
    // R1.3: revision is no longer persisted — boot DERIVES the world, so the
    // heir of "disk revision == settled revision" is boot IDEMPOTENCE: two
    // launches over the same inputs settle on the same revision. (Durable
    // quiescence — every persisted key byte-identical within the write
    // budget — is quiescentBootTests' own law.)
    reachHisWorldByActing();
    await relaunchThroughHydration();
    const first = currentRevision();
    await relaunchThroughHydration();
    const settled = currentRevision();
    assert(settled === first,
      `(evening-0) the boot minted ${settled - first} accepted-state revisions at boot `
      + `(first launch settled at revision ${first}, the second reads ${settled}) with `
      + `zero new athlete decisions — his tape shows the same shape at device cost: `
      + `25 -> 29 across one launch, ~31.5 s per transaction, the accepted-mutation `
      + `lock held ~63 s`);
  });

  // ── Finding: season change (evening) ─────────────────────────────────
  //
  // The transaction layer lands at every coordinate acting can build — the
  // day suite proved fresh + worn, and tonight's probes added binned-removal
  // worlds and the hydration-ingress world. What tonight ADDS as a red is the
  // reason his failure STILL has no located layer: the tap's own trace is
  // evicted from the always-on ring by boot's decision-event flood, so the
  // export that should have named the layer arrived carrying only the boot.
  await run('evening-1-season-change-trace: a phase-shift tap\'s trace survives a relaunch', async () => {
    reachHisWorldByActing();
    const ringBefore = athleteActionLogEntries().length;
    const stored = useProfileStore.getState().onboardingData;
    const nextProfile = applyPhaseShift(stored, {
      targetPhase: 'In-season',
      preferredTrainingDays: (stored.preferredTrainingDays ?? []) as never,
      teamTrainingDays: (stored.teamTrainingDays ?? []) as never,
      gameAnchor: { kind: 'usual_day', day: 'Saturday' },
    } as never);
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: {
        kind: 'profile_setup',
        patch: {
          seasonPhase: nextProfile.seasonPhase,
          preferredTrainingDays: nextProfile.preferredTrainingDays,
          trainingDaysPerWeek: nextProfile.trainingDaysPerWeek,
          teamTrainingDays: nextProfile.teamTrainingDays,
          teamTrainingDaysPerWeek: nextProfile.teamTrainingDaysPerWeek,
          usualGameDay: nextProfile.usualGameDay,
          gameDay: nextProfile.gameDay,
        },
      },
      todayISO: TODAY,
      sourceSurface: 'phase_shift',
    }));
    assert(result.ok,
      `(evening-1) the phase-shift transaction itself refused fresh: ${result.reason ?? result.message} `
      + '— that would be a NEW coordinate, not the trace-survival red this cell declares');
    const tapEntries = athleteActionLogEntries().slice(ringBefore);
    const tapTraceIds = new Set(tapEntries.map((entry) => entry.traceId));
    assert(tapTraceIds.size > 0,
      '(evening-1) the tap emitted no log entries at all — the always-on ring is dark '
      + 'at this door, which is its own instrumentation gap');
    // "…then it broke, then I closed the app in disgust." The ring's eviction
    // is measured in ENTRIES, not launches: HIS boot emits ~115 decision
    // events per launch (the tape), so two launches exceed the 200 cap. A
    // Node boot emits fewer, so relaunch until the post-tap flood reaches
    // what his two launches produce on device (230 entries), then ask
    // whether the athlete's own tap is still in the ring.
    let relaunches = 0;
    let survivors = athleteActionLogEntries().filter((entry) => tapTraceIds.has(entry.traceId));
    while (survivors.length > 0 && relaunches < 10) {
      await relaunchThroughHydration();
      relaunches += 1;
      survivors = athleteActionLogEntries().filter((entry) => tapTraceIds.has(entry.traceId));
    }
    assert(survivors.length > 0,
      `(evening-1) the tap trace (${tapTraceIds.size} traceIds, ${tapEntries.length} entries) was `
      + `evicted from the ring after ${relaunches} relaunches of boot decision-events — `
      + `a Node boot emits ~40 of the flood entries his device boot emits ~115 of, so `
      + `his TWO evening launches did to his taps what ${relaunches} do here; the export `
      + `that should name his failing layer arrives carrying only the boot, which is `
      + `exactly what device-export-2026-08-05-evening.txt shows`);
  });

  // ── Finding: game add (evening) ──────────────────────────────────────
  await run('evening-2-game-add: the add tap the first-rendered world offers is honoured', async () => {
    reachHisWorldByActing();
    const { renderRevision } = await relaunchThroughHydration();
    // The athlete's first render shows the derived world (R1.3: boot runs
    // before render); the tap carries that render's revision
    // (useHomeScreen.ts:1055).
    const tap = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
      targetDate: '2026-08-08',
      expectedAcceptedRevision: renderRevision,
      source: fixtureSource('add', '2026-08-08', renderRevision),
      todayISO: TODAY,
    } as never)) as { outcome?: string; kind?: string; reason?: string; error?: unknown };
    const outcome = tap.outcome ?? tap.kind ?? 'unknown';
    assert(outcome !== 'conflicted',
      `(evening-2) the athlete's add tap was refused as conflicted — `
      + `reason=${tap.reason ?? String((tap.error as Error)?.message ?? 'none')}; the screen `
      + `alerts "Couldn't update your week" for a decision nothing conflicted with; `
      + `the revision moved only because boot re-transacted the same facts`);
    assert(outcome !== 'no_change' && outcome !== 'impossible',
      `(evening-2) the fixture transaction was ${outcome}: reason=${tap.reason ?? 'none'}`);
    const marks = useCalendarStore.getState().markedDays ?? {};
    assert(marks['2026-08-08'] === 'game',
      `(evening-2) transaction ${outcome} but the calendar holds `
      + `${JSON.stringify(marks['2026-08-08'] ?? null)} for 2026-08-08`);
  });

  // ── Finding: the game-day sheet (evening) ────────────────────────────
  await run('evening-3-game-day-sheet: the sheet opens and its Remove action is honoured', async () => {
    reachHisWorldByActing();
    // The sheet's precondition: his marked game day resolves as a Game row
    // (useHomeScreen.ts:1216-1222 opens the sheet only for workoutType Game).
    const gameDay = visibleWeek('2026-07-27').find((day) => day.date === '2026-08-01');
    assert(gameDay?.workout?.workoutType === 'Game',
      `(evening-3) his marked game day 2026-08-01 resolves as `
      + `${gameDay?.workout?.workoutType ?? 'EMPTY'} — the sheet never opens`);
    const { renderRevision } = await relaunchThroughHydration();
    const tap = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'remove',
      fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
      sourceDate: '2026-08-01',
      expectedAcceptedRevision: renderRevision,
      source: fixtureSource('remove', '2026-08-01', renderRevision),
      todayISO: TODAY,
    } as never)) as { outcome?: string; kind?: string; reason?: string; error?: unknown };
    const outcome = tap.outcome ?? tap.kind ?? 'unknown';
    assert(outcome !== 'conflicted',
      `(evening-3) the sheet's Remove tap was refused as conflicted — `
      + `reason=${tap.reason ?? String((tap.error as Error)?.message ?? 'none')}; both sheet `
      + `actions route rebuildForGameChange with the render-time revision, so the `
      + `sheet that opened on the visible world cannot act on it`);
    assert(outcome !== 'impossible',
      `(evening-3) the remove transaction was ${outcome}: reason=${tap.reason ?? 'none'}`);
  });

  // ── Finding: the slow delete ─────────────────────────────────────────
  await run('evening-4-slow-delete: one whole-day delete persists only what its decision changed', async () => {
    reachHisWorldByActing();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await flushPendingStorageWrites().catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (pendingStorageWriteCount() === 0) break;
    }
    const week = visibleWeek();
    const candidates = week.filter((day) => day.workout && day.date > TODAY
      && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
    assert(candidates.length > 0, '(evening-4) no future non-team session to delete');
    const target = candidates[candidates.length - 1]!;
    const change = { kind: 'remove_session', date: target.date, scope: 'whole_day' } as never as PlanChange;
    const action = programControlActionForPlanChange(change);
    assert(action, '(evening-4) no program control action for remove_session');
    const envelopeBytes = localStorageData.get('program-store')?.length ?? 0;
    resetStorageStats();
    storageStats.armed = true;
    const result = await quietAsync(() => executeProgramControlActionDurably(action, {
      visibleWeek: week, todayISO: TODAY,
      applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
    })) as { ok?: boolean };
    await flushPendingStorageWrites().catch(() => undefined);
    storageStats.armed = false;
    assert(result.ok, '(evening-4) the delete itself failed — a different red than declared');
    // The DECISION: one day binned. R1.4a made the decision's own record a
    // LEDGER APPEND — that store is the decision's home, not overhead. The
    // program envelope (inputs) and the always-on log may also write.
    // Nothing else changed, so nothing else has a reason to write.
    const decisionKeys = new Set([
      'program-store', 'lfa.athlete-action-log.v1', 'decision-ledger-store',
    ]);
    const beyondDecision = [...storageStats.setsByKey.entries()]
      .filter(([key]) => !decisionKeys.has(key));
    const envelopeWrites = storageStats.setsByKey.get('program-store') ?? 0;
    assert(beyondDecision.length === 0 && envelopeWrites <= 1
      && storageStats.setBytes <= envelopeBytes * 2,
      `(evening-4) the delete tap ran a work bill beyond its decision: `
      + `${storageStats.setCount} writes / ${(storageStats.setBytes / 1024).toFixed(0)} KB written / `
      + `${(storageStats.getBytes / 1024).toFixed(0)} KB read against a ${(envelopeBytes / 1024).toFixed(0)} KB `
      + `envelope; stores touched beyond the decision: `
      + `${beyondDecision.map(([key, count]) => `${key} x${count}`).join(', ') || 'none'}; `
      + `program envelope serialized ${envelopeWrites}x. Node prices this at ~60-125 ms; `
      + `his tape prices the identical pipeline at ~31.5 s per transaction — the `
      + `30-second delete is this bill at device I/O and JS-engine rates`);
  });

  console.log(`\nDevice pass 2026-08-05 EVENING totals: ${passed} passed, ${failed} failed`);

  // THE RATCHET DIRECTION: a declared red that no longer reds is a cell that
  // went green, and the commit that turned it green owes the deletion.
  const stale = DECLARED_RED.filter((entry) => !declaredRedHits.has(entry.id));
  if (stale.length > 0) {
    console.error(`DECLARED RED NO LONGER REDS — delete the entry:\n  ${
      stale.map((entry) => `${entry.id} (paid by ${entry.paidBy})`).join('\n  ')}`);
    totalsPrinted(failed + stale.length);
    process.exit(1);
  }

  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
