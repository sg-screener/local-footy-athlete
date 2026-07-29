/**
 * THE EXECUTOR THE SHEET ACTUALLY AWAITS.
 *
 * `PlanChangeSheet` and `useHomeScreen` commit through
 * `executeProgramControlActionDurably` — the ASYNC twin. Every suite in this
 * repo tests `executeProgramControlAction`, the synchronous core it wraps. That
 * is the same mistake, one layer up, as the one the wrapper reassessment was
 * written about: on 2026-07-29 the matrix, the walker and the device replay were
 * all green while three of Sam's five taps failed, because all three entered
 * BELOW the layer that broke.
 *
 * The durable twin is not a thin pass-through. For a move or a bin it runs the
 * sync core inside `runCoachMutationTransaction` with
 * `didApply: (result) => result.ok && result.changedProgram`, and turns anything
 * the transaction does not accept into `athleteSafeRefusal(...)`. A G-1 landing
 * ask is `ok: false` by construction — it is a QUESTION, and the producer's
 * sentinel says so — so this is exactly the shape of boundary where the ask died
 * the first time. It is asserted here rather than reasoned about.
 *
 * IT ALSO OWNS THE COACH. `initiatedBy` distinguishes a tap from a system/coach
 * action and nothing else about the request changes, so the same change must get
 * the same answer whoever asked. A wrapper that answers differently by asker has
 * grown a second opinion about intent.
 *
 * Run: npm run test:program-control-durable
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
  throw new Error('NETWORK DISABLED — the durable executor runs entirely on-device');
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
import { applyPlanChange } from '../utils/planChangeProducer';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
  type ProgramControlAction,
  type ProgramControlActionResult,
} from '../utils/programControlActions';
import { getSessionComponents } from '../utils/sessionComponents';
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

async function run(name: string, body: () => Promise<void>): Promise<void> {
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

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return await body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

function mondayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function visibleWeek(week: string = WEEK): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

function weekOf(date: string): ResolvedDay[] {
  return visibleWeek(mondayFor(date));
}

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
      revision: 1, lastTransaction: 'durable-ownership:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  for (const [date, mark] of Object.entries(SAM_EXPORT_8_MARKED_DAYS)) {
    if (mark === 'game') quiet(() => useCalendarStore.getState().setGameDay(date, TODAY));
    else quiet(() => useCalendarStore.getState().setRestDay(date));
  }
}

function tapAdd(date: string, category: string): void {
  const result = quiet(() => applyPlanChange({
    change: { kind: 'add_category', date, category } as PlanChange,
    visibleWeek: weekOf(date), todayISO: TODAY,
    setManualOverride: (target, workout, context) =>
      useProgramStore.getState().setManualOverride(target, workout, context),
  }));
  assert(result.outcome === 'applied',
    `could not reach the state by acting — add ${category} on ${date} was `
    + `${result.outcome}: "${result.message}"`);
}

/** The sheet's own dispatch, then the executor the sheet awaits. */
function screenActionFor(change: PlanChange): ProgramControlAction {
  const action = programControlActionForPlanChange(change);
  assert(action, `the wrapper does not own ${change.kind} — nothing to assert here`);
  return action;
}

/**
 * The same request, asked by the coach rather than by a tap.
 *
 * `initiatedBy: 'system'` is the branch the executor actually reads — it selects
 * the trace source and the injury/equipment `sourceActor`, and nothing else
 * about the request. `screen: 'system'` because `ProgramControlScreen` has no
 * `coach` member: no production coach path constructs a `ProgramControlAction`
 * today, which is precisely why the asker-independence has never been pinned.
 * When one does, it inherits this law rather than discovering it on a phone.
 */
function asCoach(action: ProgramControlAction): ProgramControlAction {
  return {
    ...action,
    source: { ...action.source, screen: 'system', surface: 'coach_chat', initiatedBy: 'system' },
  } as ProgramControlAction;
}

async function main(): Promise<void> {
  console.log('\n-- Program-control durable ownership --');

  await run('the durable executor routes the G-1 ask, it does not refuse it', async () => {
    // His 2026-08-06 -> 08-07 move. 08-08 is a game, so 08-07 is G-1 and the
    // producer answers with the `g1_route_required` SENTINEL — "ask the
    // athlete". The Thursday is reached by ACTING, exactly as his tape's
    // `override:set:2026-08-06` records that he did.
    reachHisWorldByActing();
    tapAdd('2026-08-06', 'strength_full');

    const action = screenActionFor({
      kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-07',
    } as PlanChange);
    const context = { visibleWeek: weekOf('2026-08-06'), todayISO: TODAY };
    const durable = await quietAsync(() =>
      executeProgramControlActionDurably(action, context));

    // The durable twin runs the sync core inside a mutation transaction gated on
    // `result.ok && result.changedProgram`. An ask satisfies neither, so a
    // transaction that treats "did not apply" as "failed" converts the question
    // into `athleteSafeRefusal(...)` — the wrapper defect resurrected one layer
    // above where it was fixed, on the only path the sheet actually uses.
    assert(durable.needsGuidedFollowUp === true,
      'the DURABLE executor lost the landing ask — the sheet awaits this one. '
      + `ok=${durable.ok} needsGuidedFollowUp=${durable.needsGuidedFollowUp} `
      + `route=${durable.route} message="${durable.message}"`);
    assert(!/couldn't|could not|didn't go through|try again/i.test(durable.message ?? ''),
      `the athlete was given failure copy for a question: "${durable.message}"`);
  });

  await run('the durable executor and its synchronous core answer alike', async () => {
    // THE CLASS, not the instance. Any divergence between the twin the tests use
    // and the twin the screen uses is a place a defect can hide from every suite
    // in this repo — which is how three taps failed against a green gate. The
    // two are run over the same reached state and compared on the fields the
    // surface actually branches on.
    for (const change of [
      { kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-07' },
      { kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-05' },
      { kind: 'remove_session', date: '2026-08-06', scope: 'whole_day' },
    ] as PlanChange[]) {
      reachHisWorldByActing();
      tapAdd('2026-08-06', 'strength_full');
      const action = screenActionFor(change);
      const sync = quiet(() => executeProgramControlAction(action, {
        visibleWeek: weekOf('2026-08-06'), todayISO: TODAY,
      }));

      reachHisWorldByActing();
      tapAdd('2026-08-06', 'strength_full');
      const durable = await quietAsync(() => executeProgramControlActionDurably(action, {
        visibleWeek: weekOf('2026-08-06'), todayISO: TODAY,
      }));

      const shape = (result: ProgramControlActionResult) => ({
        ok: result.ok,
        outcome: result.outcome ?? null,
        needsGuidedFollowUp: result.needsGuidedFollowUp ?? false,
        route: result.route,
      });
      assert(JSON.stringify(shape(sync)) === JSON.stringify(shape(durable)),
        `${JSON.stringify(change)} is answered differently by the two executors — `
        + `sync ${JSON.stringify(shape(sync))} ("${sync.message}") vs `
        + `durable ${JSON.stringify(shape(durable))} ("${durable.message}")`);
    }
  });

  await run('a move committed durably reaches the visible week', async () => {
    // Non-vacuity for the two tests above: if the durable path refused
    // everything, "routes the ask" and "answers alike" would both pass while the
    // app did nothing at all.
    reachHisWorldByActing();
    tapAdd('2026-08-06', 'strength_full');
    const before = weekOf('2026-08-06').find((day) => day.date === '2026-08-06');
    assert(before?.workout, 'the reached Thursday is empty — nothing to move');

    const action = screenActionFor({
      kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-05',
    } as PlanChange);
    const durable = await quietAsync(() => executeProgramControlActionDurably(action, {
      visibleWeek: weekOf('2026-08-06'), todayISO: TODAY,
    }));
    assert(durable.ok,
      `the durable move was refused: "${durable.message}" (route=${durable.route})`);
    assert(durable.changedProgram,
      'the durable move reported ok but changed no program');
    const after = weekOf('2026-08-06').find((day) => day.date === '2026-08-06');
    assert(!after?.workout || getSessionComponents(after.workout).length
      < getSessionComponents(before.workout).length,
      'the durable move claimed success and the source day is unchanged — '
      + `still "${after?.workout?.name}"`);
  });

  await run('the wrapper answers the coach exactly as it answers a tap', async () => {
    // `initiatedBy` selects the trace source and nothing else about the request.
    // A wrapper that answers differently by asker has grown a second opinion
    // about intent — the class CLAUDE.md's escalation rule exists to stop.
    for (const change of [
      { kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-07' },
      { kind: 'move_session', fromDate: '2026-08-06', toDate: '2026-08-05' },
      { kind: 'remove_session', date: '2026-08-06', scope: 'whole_day' },
    ] as PlanChange[]) {
      reachHisWorldByActing();
      tapAdd('2026-08-06', 'strength_full');
      const action = screenActionFor(change);
      const tap = await quietAsync(() => executeProgramControlActionDurably(action, {
        visibleWeek: weekOf('2026-08-06'), todayISO: TODAY,
      }));

      reachHisWorldByActing();
      tapAdd('2026-08-06', 'strength_full');
      const coach = await quietAsync(() => executeProgramControlActionDurably(asCoach(action), {
        visibleWeek: weekOf('2026-08-06'), todayISO: TODAY,
      }));

      const shape = (result: ProgramControlActionResult) => ({
        ok: result.ok,
        outcome: result.outcome ?? null,
        needsGuidedFollowUp: result.needsGuidedFollowUp ?? false,
        route: result.route,
        message: result.message ?? null,
      });
      assert(JSON.stringify(shape(tap)) === JSON.stringify(shape(coach)),
        `${JSON.stringify(change)} is answered differently for the coach — `
        + `tap ${JSON.stringify(shape(tap))} vs coach ${JSON.stringify(shape(coach))}`);
    }
  });

  console.log(`\nProgram-control durable totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
