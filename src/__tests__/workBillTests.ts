import { calendarActionsForTest } from './support/calendarActionsForTest';
/**
 * THE WORK BILL EQUALS THE DECISION — evening-4, GENERALISED (R1.4b).
 *
 * Plan §2 (docs/SHELL_REBUILD_PLAN_2026-08-05.md), the second structural law:
 * "Every door's persisted write set is exactly the input stores its decision
 * touched — evening-4's cell, generalised across the whole door vocabulary.
 * A delete writes one ledger entry: hundreds of bytes, one store, one write."
 *
 * WHAT THIS SUITE IS UNTIL R5. The strict law does not hold yet: every
 * durable door still writes six MIRROR stores it decided nothing about,
 * because the accepted-state machinery persists its compatibility mirrors on
 * every transaction (`persistAcceptedMirrorEnvelopesDurably`). That machinery
 * is R5's deletion. So this suite is the law in its RATCHET form:
 *
 *   1. CLOSED SETS. Each door's write set must be a subset of its decision
 *      stores plus the DECLARED mirror bill. A single write to any store not
 *      named here is a red — the law's teeth arrive now, not in R5.
 *   2. SHRINK-ONLY. A declared mirror store that NO door writes any more is
 *      stale debt: the suite fails until its entry is deleted (the same
 *      direction every ratchet in this repo moves).
 *   3. BOUNDED BYTES. The total bill per door is capped. The caps are pinned
 *      from measurement on 2026-08-05 (Node prices the worst door at ~134 KB;
 *      his phone priced the OLD ~1.1 MB pipeline at ~31.5 s per transaction).
 *
 * When R5 deletes the mirrors, rule 2 forces DECLARED_MIRROR_BILL to empty
 * and the strict law is what remains. evening-4's declared red in the evening
 * suite keeps the original device coordinate; this suite owns the vocabulary.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
const storageStats = {
  armed: false,
  setCount: 0,
  setBytes: 0,
  setsByKey: new Map<string, number>(),
  bytesByKey: new Map<string, number>(),
};
function resetStorageStats(): void {
  storageStats.setCount = 0;
  storageStats.setBytes = 0;
  storageStats.setsByKey.clear();
  storageStats.bytesByKey.clear();
}
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (storageStats.armed) {
        storageStats.setCount += 1;
        storageStats.setBytes += value.length;
        storageStats.setsByKey.set(key, (storageStats.setsByKey.get(key) ?? 0) + 1);
        storageStats.bytesByKey.set(key, (storageStats.bytesByKey.get(key) ?? 0) + value.length);
      }
      localStorageData.set(key, value);
    },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — work bill measured entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
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
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../utils/programControlActions';
import { applyPlanChange } from '../utils/planChangeProducer';
import { seedManualOverride } from './support/programOverrideHarness';
import { canonicalFixtureKind } from '../rules/fixtureConditionedAvailability';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
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

/**
 * The stores a door's DECISION may write, per the inputs schema (plan §2):
 * the program envelope (inputs), the decision ledger (the decision itself),
 * the always-on action log, and — for fixture doors only — the calendar,
 * because the fixture mark IS calendar input.
 */
const DECISION_KEYS = new Set([
  'program-store',
  'decision-ledger-store',
  'lfa.athlete-action-log.v1',
]);
const FIXTURE_DECISION_KEYS = new Set([...DECISION_KEYS, 'calendar-storage']);

/**
 * THE DECLARED MIRROR BILL — R5's deletion target, ratcheted shrink-only.
 * Every entry is a store the accepted-mutation machinery persists on every
 * durable transaction although the decision touched nothing in it. Measured
 * 2026-08-05. Deleting the mirror machinery deletes entries here; adding a
 * store here is the move this suite exists to refuse.
 */
const DECLARED_MIRROR_BILL = new Set([
  'calendar-storage',
  'readiness-store',
  'coach-updates',
  'coach-mutation-history-store',
  'coach-preferences-store',
  'profile-store',
]);

/**
 * Byte ceilings, split the way the quiescent-boot cell law splits them: the
 * action LOG is the tape, not the decision's data — it serialises its whole
 * 200-entry ring per flush, so it dominates any byte total and would bury a
 * real decision-data regression. Non-log writes carry the decision; measured
 * 2026-08-05 at ~1 KB per door against the old pipeline's ~1.1 MB. The log
 * ceiling exists to catch per-entry bloat, not to price the ring.
 */
const LOG_KEY = 'lfa.athlete-action-log.v1';
const DOOR_BILL_NONLOG_CEILING = 32 * 1024;
const DOOR_BILL_LOG_CEILING = 1024 * 1024;

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
    const message = error instanceof Error ? error.message : String(error);
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

async function settleWrites(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  await flushPendingStorageWrites().catch(() => undefined);
}

/** His world, reached by acting (the evening suite's builder). */
function reachWorldByActing(): void {
  localStorageData.clear();
  const profile = samDevicePass20260805Profile();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
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
  useProfileStore.setState({ onboardingData: {}, isOnboardingComplete: false } as never);
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') calendarActionsForTest().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
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
    reason: 'work-bill:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

function visibleWeek(): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
}

interface DoorBill {
  door: string;
  allowed: ReadonlySet<string>;
  act: () => Promise<{ landed: boolean; detail: string }>;
}

/** Arm, act, flush, disarm — then judge the bill. */
async function measureDoor(bill: DoorBill): Promise<void> {
  reachWorldByActing();
  await settleWrites();
  resetStorageStats();
  storageStats.armed = true;
  let landed: { landed: boolean; detail: string };
  try {
    landed = await bill.act();
    await settleWrites();
  } finally {
    storageStats.armed = false;
  }
  assert(landed.landed, `${bill.door}: the act did not land (${landed.detail}) — a bill `
    + 'for a refused tap measures nothing');
  const touched = [...storageStats.setsByKey.entries()];
  console.log(`      ${bill.door} bill: ${touched.map(([key, count]) =>
    `${key} x${count}=${((storageStats.bytesByKey.get(key) ?? 0) / 1024).toFixed(0)}KB`).join('; ')}`);
  const outsideLaw = touched.filter(([key]) =>
    !bill.allowed.has(key) && !DECLARED_MIRROR_BILL.has(key));
  assert(outsideLaw.length === 0,
    `${bill.door}: the bill reached store(s) neither the decision nor the declared `
    + `mirror debt owns: ${outsideLaw.map(([key, count]) => `${key} x${count}`).join(', ')} `
    + `(full bill: ${touched.map(([key, count]) => `${key} x${count}`).join(', ')})`);
  const logBytes = storageStats.bytesByKey.get(LOG_KEY) ?? 0;
  const nonLogBytes = storageStats.setBytes - logBytes;
  assert(nonLogBytes <= DOOR_BILL_NONLOG_CEILING,
    `${bill.door}: ${(nonLogBytes / 1024).toFixed(0)} KB of NON-LOG writes — over the `
    + `${(DOOR_BILL_NONLOG_CEILING / 1024).toFixed(0)} KB ceiling; the decision's data `
    + 'is growing relative to the decision again');
  assert(logBytes <= DOOR_BILL_LOG_CEILING,
    `${bill.door}: ${(logBytes / 1024).toFixed(0)} KB of action-log writes — over the `
    + `${(DOOR_BILL_LOG_CEILING / 1024).toFixed(0)} KB ring ceiling; log entries are `
    + 'bloating per tap');
  const mirrorsTouched = touched.filter(([key]) => DECLARED_MIRROR_BILL.has(key)
    && !bill.allowed.has(key));
  console.log(`      ${bill.door}: ${storageStats.setCount} writes / `
    + `${(storageStats.setBytes / 1024).toFixed(0)} KB total, `
    + `${(nonLogBytes / 1024).toFixed(0)} KB non-log `
    + `(mirror debt: ${mirrorsTouched.map(([key]) => key).join(', ') || 'none'})`);
  for (const [key] of mirrorsTouched) mirrorStoresSeen.add(key);
}

const mirrorStoresSeen = new Set<string>();

const main = async () => {
  console.log('\n-- The work bill equals the decision (plan §2, ratchet form) --');

  await run('delete: a whole-day bin bills only its decision + declared mirrors', () =>
    measureDoor({
      door: 'delete',
      allowed: DECISION_KEYS,
      act: async () => {
        const week = visibleWeek();
        const target = week.filter((day) => day.workout && day.date > TODAY
          && !(day.workout as { isTeamDay?: boolean }).isTeamDay).at(-1);
        if (!target) return { landed: false, detail: 'no future non-team session' };
        const action = programControlActionForPlanChange(
          { kind: 'remove_session', date: target.date, scope: 'whole_day' } as never as PlanChange);
        if (!action) return { landed: false, detail: 'no wrapper action' };
        const result = await quietAsync(() => executeProgramControlActionDurably(action, {
          visibleWeek: week, todayISO: TODAY,
          applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
        })) as { ok?: boolean };
        return { landed: !!result.ok, detail: JSON.stringify(result) };
      },
    }));

  await run('move: a session move bills only its decision + declared mirrors', () =>
    measureDoor({
      door: 'move',
      allowed: DECISION_KEYS,
      act: async () => {
        const week = visibleWeek();
        const source = week.find((day) => day.workout && day.date > TODAY
          && !(day.workout as { isTeamDay?: boolean }).isTeamDay);
        const empty = week.find((day) => !day.workout && day.date > TODAY);
        if (!source || !empty) return { landed: false, detail: 'no movable pair' };
        const action = programControlActionForPlanChange({
          kind: 'move_session', fromDate: source.date, toDate: empty.date,
        } as never as PlanChange);
        if (!action) return { landed: false, detail: 'no wrapper action' };
        const result = await quietAsync(() => executeProgramControlActionDurably(action, {
          visibleWeek: week, todayISO: TODAY,
          applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
        })) as { ok?: boolean; outcome?: string };
        return {
          landed: !!result.ok || result.outcome === 'applied',
          detail: JSON.stringify({ ok: result.ok, outcome: result.outcome }),
        };
      },
    }));

  await run('add: a category add bills only its decision + declared mirrors', () =>
    measureDoor({
      door: 'add',
      allowed: DECISION_KEYS,
      act: async () => {
        const week = visibleWeek();
        const empty = week.find((day) => !day.workout && day.date > TODAY);
        if (!empty) return { landed: false, detail: 'no empty future day' };
        const change = {
          kind: 'add_category', category: 'conditioning_light', date: empty.date,
        } as never as PlanChange;
        const action = programControlActionForPlanChange(change);
        const result = action
          ? quiet(() => executeProgramControlAction(action, {
              visibleWeek: week, todayISO: TODAY,
              applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
            })) as { ok?: boolean; outcome?: string }
          : quiet(() => applyPlanChange({
              change, visibleWeek: week, todayISO: TODAY,
              applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
            })) as { ok?: boolean; outcome?: string };
        return {
          landed: !!result.ok || result.outcome === 'applied',
          detail: JSON.stringify({ ok: result.ok, outcome: result.outcome }),
        };
      },
    }));

  await run('fixture add: a game mark bills its decision (calendar included) + declared mirrors', () =>
    measureDoor({
      door: 'fixture-add',
      allowed: FIXTURE_DECISION_KEYS,
      act: async () => {
        const revision = useProgramStore.getState().acceptedMaterialContext.revision;
        const tap = await quietAsync(() => executeFixtureMutationTransaction({
          action: 'add',
          fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
          targetDate: '2026-08-08',
          expectedAcceptedRevision: revision,
          source: {
            requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
            commandId: `work-bill:add:none:2026-08-08:revision-${revision}`,
          },
          todayISO: TODAY,
        } as never)) as { outcome?: string };
        const landedOutcomes = ['accepted', 'repaired', 'regenerated', 'fallback'];
        return {
          landed: landedOutcomes.includes(tap.outcome ?? ''),
          detail: String(tap.outcome),
        };
      },
    }));

  await run('fixture remove: unmarking bills its decision (calendar included) + declared mirrors', () =>
    measureDoor({
      door: 'fixture-remove',
      allowed: FIXTURE_DECISION_KEYS,
      act: async () => {
        const revision = useProgramStore.getState().acceptedMaterialContext.revision;
        const tap = await quietAsync(() => executeFixtureMutationTransaction({
          action: 'remove',
          fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
          sourceDate: '2026-08-01',
          expectedAcceptedRevision: revision,
          source: {
            requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
            commandId: `work-bill:remove:2026-08-01:none:revision-${revision}`,
          },
          todayISO: TODAY,
        } as never)) as { outcome?: string };
        const landedOutcomes = ['accepted', 'repaired', 'regenerated', 'fallback'];
        return {
          landed: landedOutcomes.includes(tap.outcome ?? ''),
          detail: String(tap.outcome),
        };
      },
    }));

  await run('the declared mirror bill is shrink-only — an untouched entry is stale debt', () => {
    // Rule 2. When R5 deletes the mirror machinery, the doors stop touching
    // these stores and THIS cell forces the entries out one by one, until the
    // strict law ("the write set IS the decision's stores") is all that
    // remains. An entry nothing touches has been paid; delete it.
    const stale = [...DECLARED_MIRROR_BILL].filter((key) => !mirrorStoresSeen.has(key));
    assert(stale.length === 0,
      `declared mirror store(s) no door writes any more — delete the entries: ${
        stale.join(', ')}`);
  });

  console.log(`\nWork bill totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
