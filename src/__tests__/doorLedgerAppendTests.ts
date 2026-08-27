import { calendarActionsForTest } from './support/calendarActionsForTest';
/**
 * DOOR → LEDGER APPEND — R1.4a of the shell rebuild.
 *
 * Every day door that APPLIES an athlete decision appends it to the decision
 * ledger, verbatim and typed, in the same act. Additive: nothing else about
 * the doors changes here — this lands BEFORE the R1.3 boot flip so that when
 * output persistence stops, every decision already has a durable home and
 * boot can replay the ledger instead of reading stored outputs.
 *
 * The law the cells hold: THE LEDGER RECORDS DECISIONS THAT LANDED. An
 * applied door call appends exactly one entry carrying the typed payload
 * verbatim; a refused, conflicted or rejected call appends nothing.
 *
 * Run: npm run test:door-ledger-append
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
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
import {
  decisionLedgerEntries,
  useDecisionLedgerStore,
  beginDecisionLedgerResetAction,
  endDecisionLedgerResetAction,
  applyDecisionLedgerWrite,
} from '../store/decisionLedgerStore';
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

let passed = 0;
let failed = 0;
const failures: string[] = [];
function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

/** Cells share one acted world at a time — strictly sequential. */
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

function resetLedger(): void {
  const id = beginDecisionLedgerResetAction('door_append_test_reset');
  try {
    applyDecisionLedgerWrite({ next: [], writer: 'reset', resetActionId: id });
  } finally {
    endDecisionLedgerResetAction(id);
  }
}

function reachWorldByActing(): void {
  durable.clear();
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
    reason: 'door-ledger-append:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
  resetLedger();
}

function currentRevision(): number {
  return (useProgramStore.getState() as unknown as {
    acceptedMaterialContext: { revision: number };
  }).acceptedMaterialContext.revision;
}

function visibleWeek() {
  return quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
}

console.log('\n-- Door → ledger append (R1.4a) --');

const main = async () => {
  await run('an applied whole-day delete appends its decision, verbatim', async () => {
    reachWorldByActing();
    const week = visibleWeek();
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
    assert(result.ok, 'the delete itself failed — cannot test the append');
    const entries = decisionLedgerEntries();
    assert(entries.length === 1,
      `the applied delete left ${entries.length} ledger entries, not 1`);
    const decision = entries[0]!.decision;
    assert(decision.kind === 'plan_change'
      && decision.change.kind === 'remove_session'
      && decision.change.date === target.date
      && decision.change.scope === 'whole_day',
      `the decision did not travel verbatim: ${JSON.stringify(decision)}`);
    assert(entries[0]!.provenance === 'athlete_tap',
      `provenance: ${entries[0]!.provenance}`);
  });

  await run('an applied game add appends its fixture decision', async () => {
    reachWorldByActing();
    const tap = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
      targetDate: '2026-08-08',
      expectedAcceptedRevision: currentRevision(),
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: 'door-append:add:none:2026-08-08:revision-current',
      },
      todayISO: TODAY,
    } as never)) as { outcome?: string };
    assert(tap.outcome === 'accepted' || tap.outcome === 'repaired'
      || tap.outcome === 'regenerated' || tap.outcome === 'fallback',
      `the add did not apply (${tap.outcome}) — cannot test the append`);
    const entries = decisionLedgerEntries();
    assert(entries.length === 1,
      `the applied add left ${entries.length} ledger entries, not 1`);
    const decision = entries[0]!.decision;
    assert(decision.kind === 'fixture_add' && decision.date === '2026-08-08',
      `the fixture decision did not land typed: ${JSON.stringify(decision)}`);
  });

  await run('a stale render revision still lands and appends (R1.4b)', async () => {
    // The retirement's live pin in the chain: the revision handshake is gone
    // (R1.4b), so a tap whose render went stale is still the athlete's
    // decision about a date — it lands against current accepted state and
    // its decision reaches the ledger. Re-adding the check reds here.
    reachWorldByActing();
    const tap = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'add',
      fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
      targetDate: '2026-08-08',
      expectedAcceptedRevision: currentRevision() + 999,
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: 'door-append:add:none:2026-08-08:revision-stale',
      },
      todayISO: TODAY,
    } as never)) as { outcome?: string };
    assert(tap.outcome === 'accepted' || tap.outcome === 'repaired'
      || tap.outcome === 'regenerated' || tap.outcome === 'fallback',
      `the stale-revision add did not land (${tap.outcome}) — the retired `
      + 'revision handshake is refusing athlete decisions again');
    const entries = decisionLedgerEntries();
    assert(entries.length === 1 && entries[0]!.decision.kind === 'fixture_add',
      `the landed stale-revision add left ${entries.length} ledger entries`);
  });

  await run('a refused fixture tap appends nothing', async () => {
    // The refusal factory here used to be a stale expectedAcceptedRevision;
    // R1.4b retired that handshake (a stale render no longer refuses the
    // athlete's decision), so the cell manufactures its refusal with a
    // genuinely impossible request instead: removing a fixture from a date
    // that holds none. The LAW is unchanged — a tap that did not land never
    // reaches the ledger.
    reachWorldByActing();
    const tap = await quietAsync(() => executeFixtureMutationTransaction({
      action: 'remove',
      fixtureKind: canonicalFixtureKind({ phase: 'Pre-season' } as never),
      sourceDate: '2026-08-06',
      expectedAcceptedRevision: currentRevision(),
      source: {
        requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: 'door-append:remove:2026-08-06:none:no-fixture-there',
      },
      todayISO: TODAY,
    } as never)) as { outcome?: string };
    assert(tap.outcome === 'no_change' || tap.outcome === 'impossible',
      `precondition: removing a fixture that does not exist must refuse (got ${tap.outcome})`);
    assert(decisionLedgerEntries().length === 0,
      'a REFUSED tap reached the ledger — the ledger records decisions that landed');
  });

  await run('a rejected plan change appends nothing', async () => {
    reachWorldByActing();
    const week = visibleWeek();
    const empty = week.find((day) => !day.workout && day.date > TODAY);
    assert(empty, 'no empty future day to aim the rejected delete at');
    const change = { kind: 'remove_session', date: empty.date, scope: 'whole_day' } as never as PlanChange;
    const action = programControlActionForPlanChange(change);
    assert(action, 'no program control action for remove_session');
    const result = await quietAsync(() => executeProgramControlActionDurably(action, {
      visibleWeek: week, todayISO: TODAY,
      applyOverride: (date, workout, ctx) => seedManualOverride(date, workout, ctx),
    })) as { ok?: boolean };
    assert(!result.ok, 'precondition: deleting an empty day must not apply');
    assert(decisionLedgerEntries().length === 0,
      'a rejected change reached the ledger — the ledger records decisions that landed');
  });

  console.log(`\nDoor → ledger append totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
};

void main();
