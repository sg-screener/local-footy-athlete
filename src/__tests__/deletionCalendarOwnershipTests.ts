/**
 * A DELETION DOOR NEVER WRITES A CALENDAR MARK — Sam's ruling, 2026-07-30.
 *
 * "There is no session here today" and "this is a rest day" are different
 * claims. The first is what the athlete said when they binned a session. The
 * second is a standing instruction to the planner, of the same class as a game
 * mark, read at the TOP of `_resolveDateRaw` before templates and before
 * proximity — and nothing on the athlete's path removes it.
 *
 * THE DEVICE REPORT (`docs/LOCKED_DAY_DIAGNOSIS_2026-07-30.md`, confirmed again
 * in the re-test): Sam binned the session on his G-1 Friday, and from then on
 * every add and every swap on that day refused. His export carried
 * `markedDays: { "2026-07-31": "rest" }` — a calendar fact he never wrote, put
 * there by a deletion, locking the day against himself.
 *
 * WHAT THIS SUITE COVERS TODAY: that a binned day stays empty, stays editable,
 * and leaves the athlete's own marks alone. Sam's step 4 — the day that refused
 * every later add — is the third test, and its cause turned out NOT to be the
 * mark at all (see the addendum in docs/LOCKED_DAY_DIAGNOSIS_2026-07-30.md).
 *
 * WHAT IT DOES NOT COVER YET: the ruled removal of the mark itself. Attempted
 * and reverted in the same session — the mark is load-bearing for the planner's
 * rest input and for tap/coach convergence, and taking it out is its own unit
 * with its own evidence. The ruling stands; the spec is in that document.
 *
 * Run: npm run test:deletion-calendar-ownership
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
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, TrainingProgram } from '../types/domain';
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
import { applyPlanChange } from '../utils/planChangeProducer';
import type { PlanChange } from '../utils/planChangeTypes';

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
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
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

function seed(): string {
  const athlete = profile();
  const program: TrainingProgram = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: athlete.seasonPhase!,
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
    currentProgram: program, currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'deletion-calendar-test:seed',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  return program.microcycles[1]!.startDate.slice(0, 10);
}

function visibleWeek(weekStart: string) {
  return quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
}

function commit(weekStart: string, change: PlanChange) {
  return quiet(() => applyPlanChange({
    change, visibleWeek: visibleWeek(weekStart), todayISO: weekStart,
    setManualOverride: (date, workout, context) =>
      useProgramStore.getState().setManualOverride(date, workout, context),
  }));
}

function marks(): Record<string, string> {
  return useProgramStore.getState().acceptedMaterialContext.markedDays as Record<string, string>;
}

function dayOn(weekStart: string, date: string) {
  return visibleWeek(weekStart).find((day) => day.date === date);
}

console.log('\n-- Deletion calendar ownership --');

run('the day is still empty afterwards — the bin still bins', () => {
  // Non-vacuity: the fix removes a calendar claim, not the deletion itself.
  const weekStart = seed();
  const friday = addDaysISO(weekStart, 4);
  commit(weekStart, { kind: 'remove_session', date: friday });

  assert(!dayOn(weekStart, friday)?.workout,
    `the day still holds ${dayOn(weekStart, friday)?.workout?.name} after the bin`);
  assert(useProgramStore.getState().userRemovalConstraints.length === 1,
    'the bin no longer owns the emptiness through a constraint');
});

run('THE DEVICE CASE: a binned day still takes an add afterwards', () => {
  // Sam's step 4, exactly. Bin the session on G-1, then add to that day. The
  // rest mark is read before anything else in the resolver, so with it there
  // every subsequent door refused and the day was dead for good.
  const weekStart = seed();
  const friday = addDaysISO(weekStart, 4);
  commit(weekStart, { kind: 'remove_session', date: friday });

  const add = commit(weekStart, {
    kind: 'add_category', date: friday, category: 'conditioning_hard',
    g1Route: 'deloaded',
  });
  assert(add.ok,
    `the day is locked against the athlete who emptied it: "${add.message}" `
    + `${JSON.stringify(add.rejected)}`);
  assert(dayOn(weekStart, friday)?.workout,
    'the add reported success over a day that stayed empty');
});

run('a mark the ATHLETE set is untouched by a bin', () => {
  // The other direction: a deletion does not write calendar facts, and it does
  // not clear them either. A rest day the athlete marked is theirs.
  const weekStart = seed();
  const thursday = addDaysISO(weekStart, 3);
  const state = useProgramStore.getState();
  useProgramStore.setState({
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      markedDays: { ...state.acceptedMaterialContext.markedDays, [thursday]: 'rest' },
    },
  } as never);

  const monday = addDaysISO(weekStart, 0);
  commit(weekStart, { kind: 'remove_session', date: monday });

  assert(marks()[thursday] === 'rest',
    `the bin cleared the athlete's own rest mark: ${JSON.stringify(marks())}`);
});

console.log(`\nDeletion calendar ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
