/**
 * DERIVED WEEK OWNERSHIP — R1.2 of the shell rebuild.
 *
 * `visibleWeek = derive(Bible, profile, facts, decisions, results, today)`
 * gets ONE owner (`deriveVisibleWeek`): explicit inputs, one schedule-state
 * assembly, one precedence rule. `buildScheduleStateImperative` (the
 * KEEP-IN-SYNC twin of `useScheduleState`) becomes a delegation to the owner,
 * so the assembly can no longer drift between adapters.
 *
 * The reactive hook twin (`hooks/useSchedule.ts` `useScheduleState`) remains
 * a DECLARED rival until R5 deletes it at switchover (LR-13): a mounted-render
 * test is not reachable in this repo, so its equality is held by delegation +
 * the sweep cell here, not by execution.
 *
 * Run: npm run test:derived-week-ownership
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
import fs from 'fs';
import path from 'path';
import type { TrainingProgram } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  deriveVisibleWeek,
  gatherDeriveInputs,
} from '../utils/deriveVisibleWeek';
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
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

/**
 * Serialize a week with VOLATILE-ONLY fields stripped: stub/derived-session
 * timestamps are minted with `new Date()` inside the resolver (sessionResolver
 * :425/:451/:886), so two derivations milliseconds apart differ in exactly
 * those fields and nothing else. Stripping them is declared here, not hidden.
 */
function canonicalWeek(week: unknown): string {
  return JSON.stringify(week, (key, value) =>
    (key === 'createdAt' || key === 'updatedAt' || key === 'generatedAt' ? undefined : value));
}

/** An acted world: Sam's device-pass profile, marks, generated program. */
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
    reason: 'derived-week-ownership:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

console.log('\n-- Derived week ownership (R1.2) --');

reachWorldByActing();

run('deriving twice from one gathered input set yields one week', () => {
  const inputs = gatherDeriveInputs(TODAY);
  const first = canonicalWeek(quiet(() => deriveVisibleWeek(WEEK, inputs)));
  const second = canonicalWeek(quiet(() => deriveVisibleWeek(WEEK, inputs)));
  assert(first === second,
    'two derivations from the same inputs disagree — derive() is reading something it was not given');
  assert(first.includes('"workout"'), 'the derived week is empty — the world was not reached');
});

run('derive() answers to its inputs, not to the stores', () => {
  const inputs = gatherDeriveInputs(TODAY);
  const before = canonicalWeek(quiet(() => deriveVisibleWeek(WEEK, inputs)));
  // Move the ambient world out from under the gathered inputs.
  useCalendarStore.getState().setGameDay('2026-08-14', TODAY);
  useCoachUpdatesStore.setState({
    activeConstraints: [{
      id: 'ambient-drift-probe', type: 'schedule', status: 'active',
      weekStartISO: WEEK, startDate: WEEK,
      createdAt: '2026-08-05T09:00:00.000Z', lastUpdatedAt: '2026-08-05T09:00:00.000Z',
      description: 'Ambient drift probe',
    }],
  } as never);
  const after = canonicalWeek(quiet(() => deriveVisibleWeek(WEEK, inputs)));
  assert(before === after,
    'derive() output moved when the STORES moved — an ambient read survives inside the owner');
  // And a fresh gather sees the new world (the inputs are real, not frozen).
  const refreshed = gatherDeriveInputs(TODAY);
  const refreshedWeek = canonicalWeek(quiet(() => deriveVisibleWeek('2026-08-10', refreshed)));
  const staleWeek = canonicalWeek(quiet(() => deriveVisibleWeek('2026-08-10', inputs)));
  assert(refreshedWeek !== staleWeek,
    'a fresh gather did not see the moved world — gatherDeriveInputs is not reading the stores');
  // Restore for the cells below.
  reachWorldByActing();
});

run('the imperative adapter is a delegation, not a second assembly', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const adapterSource = fs.readFileSync(path.join(srcRoot, 'utils', 'coachWeekDiff.ts'), 'utf8');
  assert(adapterSource.includes('assembleScheduleState(gatherDeriveInputs('),
    'buildScheduleStateImperative no longer delegates to the derive owner');
  assert(!adapterSource.includes('acceptedOwnsMaterialState'),
    'the accepted-precedence switch is back in the adapter — the assembly has two homes again');
});

run('the precedence switch has one owner and one declared rival', () => {
  // The rule "accepted context owns material state when revision > 0" may
  // exist in exactly two places until R5: the derive owner, and the reactive
  // hook twin useScheduleState (declared rival, deleted at switchover/LR-13).
  // A THIRD copy is the drift this cell exists to fail.
  const srcRoot = path.resolve(__dirname, '..');
  const declared = new Set([
    path.join('utils', 'deriveVisibleWeek.ts'),
    path.join('hooks', 'useSchedule.ts'),
  ]);
  const holders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (fs.readFileSync(full, 'utf8').includes('acceptedOwnsMaterialState')) {
        holders.push(path.relative(srcRoot, full));
      }
    }
  };
  walk(srcRoot);
  const undeclared = holders.filter((holder) => !declared.has(holder));
  assert(undeclared.length === 0,
    `the precedence switch grew a new home: ${undeclared.join(', ')}`);
  assert(holders.includes(path.join('utils', 'deriveVisibleWeek.ts')),
    'the derive owner no longer states the precedence switch — who decides now?');
});

run('deriveVisibleWeek is the resolver over the one assembly', () => {
  const inputs = gatherDeriveInputs(TODAY);
  const derived = canonicalWeek(quiet(() => deriveVisibleWeek(WEEK, inputs)));
  const legacyPath = canonicalWeek(
    quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative())));
  assert(derived === legacyPath,
    'the derive owner and the adapter pipeline disagree on the same world');
});

console.log(`\nDerived week ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
