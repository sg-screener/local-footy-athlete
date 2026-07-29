/**
 * SAM'S DEVICE FINDINGS, REPLAYED THROUGH REAL DOORS.
 *
 * The five taps he performed on 2026-07-29, of which three failed. Reached by
 * ACTING — fresh install, his onboarding answers, generate, his calendar, his
 * taps in the action tape's order — never by seeding a state nobody arrived at
 * (AGENTS.md: hand-built state fixtures are deprecated for athlete-facing
 * suites).
 *
 * SEPARATE FROM THE WALKER ON PURPOSE. This is a regression suite with named
 * expectations; the walker is a fuzzer with laws. They also have very different
 * memory profiles — the walker's bounded budget generates a program per walk,
 * and running a fixed scenario on top of that heap is what made the pair fall
 * over once the typed stack-add path started doing real transaction work.
 *
 * Run: npm run test:device-findings
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
  throw new Error('NETWORK DISABLED — device findings replay entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import type { TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import {
  samExport8Profile,
  SAM_EXPORT_8_MARKED_DAYS,
  SAM_EXPORT_8_TODAY_ISO,
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

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

/** Fresh install, his answers, generate, his calendar. Every step a real door. */
function reachHisWorldByActing(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Pre-season', phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const his = program.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  assert(his, 'his week is not in the generated program');
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'device-findings:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  // His calendar, through the calendar door — two rest marks and two games.
  for (const [date, mark] of Object.entries(SAM_EXPORT_8_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, TODAY);
    else useCalendarStore.getState().setRestDay(date);
  }
}

function visibleWeek(): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
}

function projectedWeek(): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: WEEK, todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

function tap(change: PlanChange) {
  return quiet(() => applyPlanChange({
    change, visibleWeek: visibleWeek(), todayISO: TODAY,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));
}

console.log('\n-- Sam device findings, replayed --');

run('his three failing taps all land, and the screen agrees', () => {
  // HIS FIVE TAPS, of which three failed on 2026-07-29. Reached by ACTING —
  // fresh install, his onboarding answers, generate, his calendar — never by
  // seeding a state nobody arrived at. The dates are his; the tap order is the
  // action tape's.
  reachHisWorldByActing();

  // (1) Add strength to the G+1 Sunday. His copy said added and his screen
  //     showed Recovery + Recovery; here the whole tap must land AND the screen
  //     must agree with the domain about what the day holds.
  const one = tap({ kind: 'add_category', date: '2026-08-02', category: 'strength_full' } as PlanChange);
  assert(one.outcome === 'applied',
    `(1) add strength on the G+1 Sunday was ${one.outcome}: "${one.message}"`);
  const sunday = projectedWeek().find((day) => day.date === '2026-08-02');
  const sundayResolved = visibleWeek().find((day) => day.date === '2026-08-02');
  assert(sunday?.workout?.name === sundayResolved?.workout?.name,
    `(1) the screen and the domain disagree about the G+1 Sunday — screen `
    + `"${sunday?.workout?.name}", domain "${sundayResolved?.workout?.name}"`);
  const sections = (sunday?.workout as { sections?: { kind: string; title: string }[] } | undefined)
    ?.sections ?? [];
  const titles = sections.map((section) => `${section.kind}:${section.title}`);
  assert(new Set(titles).size === titles.length,
    `(1) the screen renders the same session twice — ${JSON.stringify(titles)} `
    + '(his device showed "Recovery + Recovery")');

  // (2)/(3) Move his Wednesday gym session onto Thursday. One tap, two laws:
  //     the refusal was generic, AND moving onto a team night is LEGAL under
  //     the doubling law. The OFFER has to exist before the tap can be honest.
  const wednesday = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: visibleWeek(), date: '2026-07-29', todayISO: TODAY,
  }));
  assert(!wednesday.move.refusal,
    `(2/3) his Wednesday offers no move at all: "${wednesday.move.refusal?.message}"`);
  const scoped = wednesday.move.scopes.filter((scope) => scope.id !== 'whole_day');
  assert(scoped.length > 0,
    '(2/3) his Wednesday offers no per-session scope — the gym session beside a '
    + 'team commitment is the one thing that CAN move');
  // THE DOUBLING LAW, asserted as itself. "At least one destination" is too
  // weak — it passed with the old free-days-only filter still in place, because
  // one day in his week happened to read as free. What Sam ruled is that moving
  // onto an OCCUPIED day is legal and lands combined, so the offer has to carry
  // one.
  assert(scoped.some((scope) => scope.destinations.some((destination) => destination.occupiedBy)),
    '(2/3) no scoped destination is an occupied day — the doubling law says a '
    + 'team night IS a destination, and his week has no free days to fall back on');

  // (5) Add conditioning to an occupied day. Light worked on his device; HARD
  //     was refused, and the confirmation narrated a move.
  const five = tap({ kind: 'add_category', date: '2026-07-30', category: 'conditioning_hard' } as PlanChange);
  assert(five.outcome === 'applied',
    `(5) adding hard conditioning to an occupied day was ${five.outcome}: "${five.message}"`);
  assert(!/\bmoved\b/i.test(five.message ?? ''),
    `(5) the confirmation narrates a MOVE for an ADD: "${five.message}"`);
});


console.log(`\nDevice findings totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
