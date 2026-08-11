/**
 * QUIESCENT BOOT — R1.3 of the shell rebuild.
 *
 * Boot reads inputs and derives. It runs no transactions, mints no revision,
 * rewrites no envelope. The permanent laws held here:
 *
 *  1. BOOT APPENDS NOTHING (evening-0's successor): a relaunch with no new
 *     athlete decision leaves every persisted key BYTE-IDENTICAL, and the
 *     whole boot's write volume stays under a small fixed budget — the
 *     485 KB output envelope is gone because outputs are not stored.
 *  2. THE WORLD IS ITS INPUTS: the visible week after a relaunch equals the
 *     visible week before it — rebuilt by generation + ledger replay, not
 *     read back from stored outputs.
 *  3. REPLAY NEVER APPENDS: rebuilding the derived world twice leaves the
 *     ledger byte-identical.
 *  4. THE OLD ENVELOPE IS PARKED, NOT EATEN: a pre-rebuild (old-shape)
 *     program envelope is copied byte-identical to the parking key before
 *     any new-shape write can touch it — R2's migration reads the parked
 *     copy (non-destructive law, standing condition 5).
 *
 * Run: npm run test:quiescent-boot
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
const bootStats = { armed: false, setCount: 0, setBytes: 0, logBytes: 0 };
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (bootStats.armed) {
        // The action ring flushes whole (~55 KB × cap-bounded) — the tape's
        // pre-existing cost, not an output envelope. The budget watches
        // athlete-state keys.
        if (key === 'lfa.athlete-action-log.v1') {
          bootStats.logBytes += value.length;
        } else {
          bootStats.setCount += 1;
          bootStats.setBytes += value.length;
        }
      }
      durable.set(key, value);
    },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { TrainingProgram } from '../types/domain';
import type { PlanChange } from '../utils/planChangeTypes';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore, PROGRAM_STORE_PERSISTENCE_KEY } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useDecisionLedgerStore, DECISION_LEDGER_PERSISTENCE_KEY, decisionLedgerEntries } from '../store/decisionLedgerStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { seedManualOverride } from './support/programOverrideHarness';
import {
  rebuildDerivedWorld,
  runQuiescentBoot,
  PRE_REBUILD_ENVELOPE_PARKING_KEY,
} from '../store/quiescentBoot';
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
/** Boot may rewrite small input envelopes; it may never carry outputs. */
const BOOT_WRITE_BUDGET_BYTES = 32 * 1024;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
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

/**
 * Canonical form of a persisted envelope: parsed and re-serialised with
 * sorted keys. zustand's rehydrate write-back reorders JSON keys with
 * identical content; the boot law is CONTENT identity (key order is not
 * state), and the write budget bounds what a reorder may cost.
 */
function canonicalEnvelope(value: string): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, entryValue]) => [key, sortKeys(entryValue)]));
    }
    return input;
  };
  try {
    return JSON.stringify(sortKeys(JSON.parse(value)));
  } catch {
    return value;
  }
}

function canonicalWeek(week: unknown): string {
  return JSON.stringify(week, (key, value) =>
    (key === 'createdAt' || key === 'updatedAt' || key === 'generatedAt' ? undefined : value));
}

async function settleWrites(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  // The action log's persist is debounced on a real timer; give it one
  // window so a snapshot never races a scheduled flush.
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  await flushPendingStorageWrites().catch(() => undefined);
}

function reachWorldByActing(): void {
  durable.clear();
  const profile = samDevicePass20260805Profile();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  // Through the ledger's own reset door — the store is born under the
  // ownership law with no fixture-seeding exemption, tests included.
  useDecisionLedgerStore.getState().clear();
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
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
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
    reason: 'quiescent-boot:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/** One landed athlete decision, so replay has something real to rebuild. */
async function actOneDelete(): Promise<string> {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const candidates = week.filter((day) => day.workout && day.date > TODAY
    && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
  assert(candidates.length > 0, 'no future non-team session to delete');
  const target = candidates[candidates.length - 1]!;
  const change = { kind: 'remove_session', date: target.date, scope: 'whole_day' } as never as PlanChange;
  const action = programControlActionForPlanChange(change);
  assert(action, 'no program control action for remove_session');
  const result = await quietAsync(() => executeProgramControlActionDurably(action, {
    visibleWeek: week, todayISO: TODAY,
    applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
  })) as { ok?: boolean };
  assert(result.ok, 'the acted delete failed — the world is not reached');
  return target.date;
}

/** The relaunch: in-memory world cleared, stores rehydrated, boot rebuilt. */
async function relaunch(): Promise<void> {
  await settleWrites();
  const disk = new Map(durable);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  // Through the reset door (ownership law, no exemption); the persisted
  // empty this writes is overwritten by the disk photograph below, which is
  // what "the heap dies, the disk survives" means here.
  useDecisionLedgerStore.getState().clear();
  await settleWrites();
  durable.clear();
  for (const [key, value] of disk) durable.set(key, value);
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
    await useDecisionLedgerStore.persist.rehydrate();
  });
  // The gate memoizes one boot per process; the suite runs the same boot
  // body it calls, once per simulated relaunch. Outside quiet so a boot
  // failure is never swallowed.
  await runQuiescentBoot();
  await settleWrites();
}

const main = async () => {
  console.log('\n-- Quiescent boot (R1.3) --');

  await run('boot appends nothing: every key byte-identical, write volume within budget', async () => {
    reachWorldByActing();
    await actOneDelete();
    await settleWrites();
    const before = new Map(durable);
    bootStats.armed = true;
    bootStats.setCount = 0;
    bootStats.setBytes = 0;
    await relaunch();
    bootStats.armed = false;
    // The athlete-action ring is the TAPE, not athlete state: rehydration
    // legitimately records a handful of boot events. Its law is BOUNDED
    // growth (the 115-event flood that evicted Sam's taps — evening-1 — was
    // ~55 KB); every ATHLETE-STATE key is byte-identical, no exceptions.
    const LOG_KEY = 'lfa.athlete-action-log.v1';
    const beforeKeys = [...before.keys()].sort();
    const afterKeys = [...durable.keys()].sort();
    assert(JSON.stringify(beforeKeys) === JSON.stringify(afterKeys),
      `boot changed the key set: before=${beforeKeys.join(',')} after=${afterKeys.join(',')}`);
    const changed = beforeKeys.filter((key) => key !== LOG_KEY
      && canonicalEnvelope(before.get(key) ?? '') !== canonicalEnvelope(durable.get(key) ?? ''));
    assert(changed.length === 0,
      `boot rewrote persisted state with zero new decisions: ${changed.map((key) => {
        const beforeValue = before.get(key) ?? '';
        const afterValue = durable.get(key) ?? '';
        const detail = beforeValue.length <= 300 && afterValue.length <= 300
          ? ` BEFORE=${beforeValue} AFTER=${afterValue}`
          : '';
        return `${key} (${beforeValue.length} -> ${afterValue.length} bytes)${detail}`;
      }).join(', ')}`);
    const logGrowth = (durable.get(LOG_KEY) ?? '').length - (before.get(LOG_KEY) ?? '').length;
    assert(logGrowth <= 8 * 1024,
      `the boot flooded the action ring: the log grew ${logGrowth} bytes — the `
      + 'evening-1 eviction mechanism is back');
    assert(bootStats.setBytes <= BOOT_WRITE_BUDGET_BYTES,
      `boot wrote ${bootStats.setBytes} bytes (${bootStats.setCount} writes) — over the `
      + `${BOOT_WRITE_BUDGET_BYTES}-byte budget; an output envelope is back on disk`);
  });

  await run('the world is its inputs: the visible week survives a relaunch by derivation', async () => {
    reachWorldByActing();
    const deletedDate = await actOneDelete();
    const before = canonicalWeek(quiet(() =>
      resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())));
    await relaunch();
    const after = canonicalWeek(quiet(() =>
      resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())));
    assert(before === after,
      'the relaunched world does not derive the week the athlete last saw');
    const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
    const deletedDay = week.find((day) => day.date === deletedDate);
    assert(deletedDay && !deletedDay.workout,
      `the acted delete did not survive the relaunch — ${deletedDate} holds `
      + `${deletedDay?.workout?.name ?? 'nothing?'}`);
  });

  await run('replay never appends: a second world rebuild leaves the ledger byte-identical', async () => {
    reachWorldByActing();
    await actOneDelete();
    await settleWrites();
    const entriesBefore = JSON.stringify(decisionLedgerEntries());
    const ledgerEnvelopeBefore = durable.get(DECISION_LEDGER_PERSISTENCE_KEY);
    await quietAsync(() => rebuildDerivedWorld());
    await quietAsync(() => rebuildDerivedWorld());
    await settleWrites();
    assert(JSON.stringify(decisionLedgerEntries()) === entriesBefore,
      'rebuilding the derived world changed the ledger — replay is appending');
    assert(durable.get(DECISION_LEDGER_PERSISTENCE_KEY) === ledgerEnvelopeBefore,
      'the ledger envelope on disk moved under replay');
  });

  await run('boot acceptance keeps the profile that generated the world', async () => {
    reachWorldByActing();
    const profile = samDevicePass20260805Profile();
    const program = quiet(() => generateProgramLocally(profile, {
      todayISO: SAM_PASS_20260805_GENERATION_DAY,
      previousProgram: null,
    })) as TrainingProgram;

    // The simulator's first reload found this exact disagreement: the
    // generator had the complete profile while the downstream compatibility
    // mirror was temporarily empty at publication. Publication must own the
    // input it used, not re-read that mirror and mint a different athlete.
    useProfileStore.setState({ onboardingData: {}, isOnboardingComplete: true } as never);
    quiet(() => commitRebuiltProgram(
      program,
      { preserve: [], clear: [], conflictsRemoved: [] },
      {
        profile,
        markedDays: useCalendarStore.getState().markedDays ?? {},
        selectedDate: SAM_PASS_20260805_GENERATION_DAY,
        reason: 'quiescent-boot:captured-profile',
      },
    ));

    const accepted = useProgramStore.getState().acceptedMaterialContext
      .acceptedProfileSnapshot?.onboardingData;
    assert(JSON.stringify(accepted) === JSON.stringify(profile),
      'accepted boot snapshot re-read the empty compatibility mirror instead of the profile that generated the world');
    assert(JSON.stringify(useProfileStore.getState().onboardingData) === JSON.stringify(profile),
      'the compatibility mirror was not restored from the accepted boot input');
  });

  await run('an old-shape envelope is parked byte-identical before any new-shape write', async () => {
    reachWorldByActing();
    await settleWrites();
    // Build an OLD-shape envelope the way an old build would have left it.
    const oldEnvelope = JSON.stringify({
      state: {
        currentProgram: { id: 'prog-old', microcycles: [] },
        acceptedMaterialContext: { revision: 7, markedDays: {}, activeConstraints: [] },
        dateOverrides: { '2026-08-01': { name: 'Old Stored Day' } },
        sessionFeedback: {}, weightOverrides: {},
      },
      version: 0,
    });
    durable.set(PROGRAM_STORE_PERSISTENCE_KEY, oldEnvelope);
    durable.delete(PRE_REBUILD_ENVELOPE_PARKING_KEY);
    await relaunch();
    assert(durable.get(PRE_REBUILD_ENVELOPE_PARKING_KEY) === oldEnvelope,
      'the old envelope was not parked byte-identical — R2 has nothing to migrate from');
  });

  console.log(`\nQuiescent boot totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
