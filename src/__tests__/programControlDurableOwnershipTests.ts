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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { seedManualOverride } from './support/programOverrideHarness';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
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
import { filterConstraintsForDate } from '../utils/readinessConstraints';
import { buildScheduleAcknowledgment } from '../utils/readinessAcknowledgment';
import { applyPlanChange } from '../utils/planChangeProducer';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import {
  composeTemporarySourceFactCompatibility,
  createTemporaryScheduleFact,
  isInjurySourceFact,
  type TemporaryScheduleFact,
} from '../rules/temporarySourceFact';
import { SHORT_ON_TIME_MINUTES } from '../rules/timeAvailabilityPolicy';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
  scheduleFactScopeForAction,
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

/**
 * The sentence `temporarySourceFactTransaction` answers a refused fact commit
 * with. Quoted here to prove the real branch ran, and — in the ack cell below —
 * to prove it never reaches the athlete.
 */
const ENGINE_REFUSAL_SENTENCE =
  'The report was not applied because the visible program could not be verified.';

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

/** The seven dates of his visible week, Monday first. */
function weekDates(): string[] {
  return Array.from({ length: 7 }, (_unused, offset) => {
    const parsed = new Date(`${WEEK}T12:00:00`);
    parsed.setDate(parsed.getDate() + offset);
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
      + `-${String(parsed.getDate()).padStart(2, '0')}`;
  });
}

/**
 * The week the SCREEN builds, not the one the resolver returns.
 *
 * A schedule fact is projection-delivered: it never rewrites the accepted week,
 * it gates what the athlete is shown through `buildProgramTabProjectedWeek`.
 * Fingerprinting the resolver's output would therefore report "nothing changed"
 * for every scope, and the scope cell below would pass on a door that does
 * nothing — the exact vacuity this file exists to refuse.
 */
function projectedWeek(week: string = WEEK, todayISO: string = TODAY): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: week, todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

/** Per-day content fingerprint: what the day holds, row by row. */
function dayFingerprints(days: readonly ResolvedDay[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const day of days) {
    const workout = day.workout;
    out[day.date] = workout
      ? `${workout.name}|${(workout.exercises ?? []).map((exercise) =>
          `${exercise.exercise?.name ?? exercise.exerciseId}`
          + `@${exercise.prescribedSets}x${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`)
          .join(',')}|${(workout.coachNotes ?? []).join('~')}`
      : 'REST';
  }
  return out;
}

/**
 * Put a real schedule fact into the accepted context the way the transaction
 * does, WITHOUT the transaction.
 *
 * This is not a shortcut and it is not the harness entering below the door: the
 * door itself is a declared red (see the cell that names it), so there is no way
 * to reach this state through it. What is composed here is composed by the real
 * composer — `composeTemporarySourceFactCompatibility` is the same call
 * `transactTemporarySourceFact` makes, over the same fact the executor builds —
 * so the projection cells below read exactly the constraints a working
 * transaction would have published, and nothing invented for the test.
 */
function publishScheduleFactDirectly(fact: TemporaryScheduleFact): void {
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  const facts = [...accepted.temporarySourceFacts, fact];
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts,
    activeConstraints: accepted.activeConstraints,
    readinessSignalsByDate: accepted.readinessSignalsByDate,
  });
  useProgramStore.setState({
    acceptedMaterialContext: {
      ...accepted,
      temporarySourceFacts: facts,
      activeConstraints: compatibility.activeConstraints,
      revision: accepted.revision + 1,
      lastTransaction: 'durable-ownership:schedule-fact-projection',
    },
  } as never);
}

/** Fresh install, his answers, generate, his calendar. Every step a real door.
 *
 * `withMarks: false` reaches the same athlete BEFORE any calendar mark — a
 * real, reachable world. The deriving cells below use it because the MARKED
 * world cannot pass §18 re-acceptance for ANY deriving fact: probed against
 * the established illness lane (severe illness), the same world answers the
 * same `Section 18 final-week rejection` — the second blocker declared red 1
 * recorded ("this world's generated week also fails its own §18
 * re-evaluation"). That is the fixture world's pre-existing state, not the
 * lanes'; the lane's behaviour in a §18-broken world is the honest refusal
 * the ack cells cover. */
function reachHisWorldByActing(options?: {
  withMarks?: boolean;
  /** His answers with a stated variation (e.g. an In-season usualGameDay for
   *  the virtual-fixture cell) — still every step through a real door. */
  profile?: ReturnType<typeof samExport8Profile>;
  selectedPhase?: 'Pre-season' | 'In-season';
}): void {
  localStorageData.clear();
  const profile = options?.profile ?? samExport8Profile();
  // A fresh install holds no accepted state, so drop the PREVIOUS cell's
  // accepted profile snapshot BEFORE the profile write. The post-acceptance
  // mirror fence (profileStore subscription) otherwise replays that stale
  // snapshot over this cell's live answers the moment the profile changes —
  // found when the virtual-fixture cell's committed snapshot (usualGameDay)
  // leaked into the busy cell's world and gave it a virtual Saturday game.
  useProgramStore.setState({
    acceptedMaterialContext: {
      ...useProgramStore.getState().acceptedMaterialContext,
      acceptedProfileSnapshot: null,
    },
  } as never);
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: options?.selectedPhase ?? 'Pre-season',
      phaseEntryWeekStartISO: '2026-07-13',
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
  if (options?.withMarks === false) return;
  for (const [date, mark] of Object.entries(SAM_EXPORT_8_MARKED_DAYS)) {
    if (mark === 'game') quiet(() => useCalendarStore.getState().setGameDay(date, TODAY));
    else quiet(() => useCalendarStore.getState().setRestDay(date));
  }
}

function tapAdd(date: string, category: string): void {
  const result = quiet(() => applyPlanChange({
    change: { kind: 'add_category', date, category } as PlanChange,
    visibleWeek: weekOf(date), todayISO: TODAY,
    applyOverride: (target, workout, context) =>
      seedManualOverride(target, workout, context),
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

  // ────────────────────────────────────────────────────────────────────────
  // THE LANES (Sam approved option 2 verbatim, 2026-08-02 —
  // docs/SCHEDULE_FACT_OWNERSHIP_REASSESSMENT_2026-08-01.md).
  //
  // The fact's RULED EFFECT owns its commit lane. An UNRULED fact (busy/away)
  // commits INERT and honest: recorded, program byte-unchanged, off the §18
  // mutation gate, no overlay, no adjustment. A RULED fact derives via scoped
  // regen, the illness precedent — and "Short on time today" is now RULED:
  // the door mints a time-cap fact at the existing 35-minute owner
  // (`SHORT_ON_TIME_MINUTES`) and today's session is COMPRESSED — main lift
  // kept, cut to essentials. The third, always-refusing lane is RETIRED.
  //
  // "SHORT ON TIME TODAY" IS TODAY-SCOPED, BECAUSE THE COPY SAYS SO (Sam's
  // ruling 2, 2026-07-31) — the scope cells below hold that half unchanged.
  // ────────────────────────────────────────────────────────────────────────

  /** The one door, with the scope the button declares. `onDate` is the day the
   *  athlete taps it (defaults to the tape's today). */
  const shortOnTimeAction = (
    scope: 'today_only' | 'current_week',
    onDate: string = TODAY,
  ): ProgramControlAction => ({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'short_on_time_today', initiatedBy: 'tap' },
    scope,
    payload: { date: onDate, todayISO: onDate },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as ProgramControlAction);

  /** The away door's action, field for field what `useHomeScreen` builds. */
  const awayAction = (dates: string[]): ProgramControlAction => ({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
    scope: 'current_week',
    payload: {
      date: [...dates].sort()[0] ?? TODAY,
      todayISO: TODAY,
      planChange: { kind: 'clear_days', dates },
    },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as ProgramControlAction);

  /** A week-scoped busy fact — the UNRULED shape (legacy migration / coach). */
  const weekBusyFact = (): TemporaryScheduleFact =>
    createTemporaryScheduleFact({
      observedDate: TODAY,
      scope: scheduleFactScopeForAction({
        type: 'set_schedule_modifier',
        source: { screen: 'program_tab', surface: 'busy_this_week', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { date: TODAY, todayISO: TODAY },
        requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
      } as Extract<ProgramControlAction, { type: 'set_schedule_modifier' }>),
      scheduleKind: 'busy_week',
      sourceActor: 'athlete',
      sourceSurface: 'busy_this_week',
    });

  await run('the door gives a "today" request a one-day horizon, at the ruled 35-minute cap', async () => {
    // THE DECISION THIS DOOR OWNS, asserted through the real executor: the fact
    // it commits IS the ruling — a time-cap fact, dates [today], capped by the
    // one 35-minute owner. Building the fact by hand here would let the door
    // drift from the cell that pins it.
    reachHisWorldByActing({ withMarks: false });
    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only'), { todayISO: TODAY }));
    assert(result.ok === true, `the short-on-time door refused: "${result.message}"`);
    const facts = normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext).temporarySourceFacts;
    const fact = facts.find((candidate) => !isInjurySourceFact(candidate) &&
      candidate.factKind === 'time_cap');
    assert(fact && !isInjurySourceFact(fact) && fact.factKind === 'time_cap',
      `the door committed no time-cap fact — facts: ${JSON.stringify(facts.map((f) =>
        isInjurySourceFact(f) ? 'injury' : f.factKind))}`);
    assert(fact.maxSessionMinutes === SHORT_ON_TIME_MINUTES,
      `the door invented its own minutes (${fact.maxSessionMinutes}) instead of the `
      + `ruled owner's ${SHORT_ON_TIME_MINUTES}`);
    assert(fact.scope.kind === 'date' && fact.effectiveFrom === TODAY && fact.effectiveUntil === TODAY,
      `a today_only request took a ${fact.scope.kind} horizon `
      + `${fact.effectiveFrom}..${fact.effectiveUntil} under copy that says "today"`);
    assert(fact.targetKind === 'dates' && fact.dates.length === 1 && fact.dates[0] === TODAY,
      `the cap targets ${JSON.stringify(fact.dates)} (${fact.targetKind}), not today alone`);
  });

  /**
   * The days the projection would let this constraint touch.
   *
   * `buildProgramTabProjectedWeek` gates every day through
   * `filterConstraintsForDate` before it builds a single exposure constraint, so
   * this list IS the constraint's reach — the same call, on the same seven
   * dates, over the state the screen reads.
   */
  const daysReachedBy = (constraintId: string): string[] =>
    weekDates().filter((date) => filterConstraintsForDate(
      buildScheduleStateImperative().activeConstraints ?? [], date,
    ).some((constraint: { id?: string }) => constraint.id === constraintId));

  await run('a today-scoped time-cap fact reaches today and no other day', async () => {
    reachHisWorldByActing({ withMarks: false });
    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only'), { todayISO: TODAY }));
    assert(result.ok === true, `the short-on-time door refused: "${result.message}"`);
    const factId = result.createdModifierIds?.[0];
    assert(factId, 'the door reported ok with no created fact id');
    const reached = daysReachedBy(`source-fact:time-cap:${factId}`);
    assert(reached.length === 1 && reached[0] === TODAY,
      `a fact that says "today" is offered to ${reached.length} day(s): ${reached.join(', ')}`);
  });

  await run('a week-scoped schedule fact reaches the whole week', async () => {
    // NON-VACUITY, and the proof that the HORIZON is what decides. If a
    // week-scoped fact reached one day too, the cell above would be passing on a
    // gate that ignores scope, and the ruling would be "implemented" by accident.
    reachHisWorldByActing();
    const fact = weekBusyFact();
    publishScheduleFactDirectly(fact);
    const reached = daysReachedBy(`source-fact:schedule:${fact.factId}`);
    assert(reached.length === 7,
      `a week-scoped fact is offered to ${reached.length} day(s): ${reached.join(', ')}`);
  });

  // ────────────────────────────────────────────────────────────────────────
  // DECLARED RED 1 IS PAID (2026-08-03). The dead third lane — re-canonicalise
  // then refuse, the writer and verifier disagreeing about one commit — is
  // RETIRED per the approved reassessment: an unruled fact commits INERT, a
  // ruled fact DERIVES, and there is no third path. The cells below assert
  // what each door DOES; the old reproduction cell is deleted as paid.
  // ────────────────────────────────────────────────────────────────────────

  await run('the away door commits inert: recorded, honest, program byte-unchanged', async () => {
    // DECLARED RED 1's payment, unruled half. Away has no ruled effect yet, so
    // the fact commits RECORD-ONLY: the fact and its constraint land, the
    // program bytes do not move, no overlay or adjustment is minted, and the
    // §18 mutation gate is not re-run (a contextual signal is not a program
    // mutation). The door is alive AND honest.
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());
    const overlaysBefore = JSON.stringify(useProgramStore.getState().weekScopedOverlays ?? {});
    const ledgerBefore = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length;
    const awayDates = ['2026-08-01', '2026-08-02'];

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(awayAction(awayDates), { todayISO: TODAY }));
    assert(result.ok === true, `the away door is still refused: "${result.message}"`);
    assert(result.changedProgram === false,
      'an unruled away fact claims a program change — record-only must be honest about it');

    const accepted = normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext);
    const fact = accepted.temporarySourceFacts.find(
      (candidate): candidate is TemporaryScheduleFact =>
        !isInjurySourceFact(candidate) && candidate.factKind === 'schedule' &&
        candidate.scheduleKind === 'travel');
    assert(fact && JSON.stringify(fact.unavailableDates) === JSON.stringify(awayDates),
      'the away fact did not land with the days the athlete ticked');
    assert(accepted.activeConstraints.some((constraint) =>
      constraint.type === 'schedule' && constraint.scheduleKind === 'travel'),
      'the away fact composed no constraint — nothing would reach future generation');

    const after = dayFingerprints(projectedWeek());
    assert(JSON.stringify(before) === JSON.stringify(after),
      'a record-only away fact changed the visible week');
    assert(JSON.stringify(useProgramStore.getState().weekScopedOverlays ?? {}) === overlaysBefore,
      'a record-only away fact authored a week overlay');
    assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length === ledgerBefore,
      'a record-only away fact minted a reversible adjustment');
  });

  await run('a deriving short-on-time commit compresses today and touches no other day', async () => {
    // DECLARED RED 2's payment, ruled half — "the real law: today lightens, the
    // other six days are untouched", exactly as the old cell said it must be
    // written when the red paid. The ruled effect (Sam 2026-08-02): the
    // COMPRESSED session — main lift kept, cut to essentials, under the
    // existing 35-minute owner — delivered by scoped regen, the illness
    // precedent, with a fact-linked adjustment for the undo half below.
    // The tap day is the Friday of his week — a PLAIN strength day (Lower
    // Hinge). His literal today is a TEAM NIGHT, which the compression law
    // deliberately never content-cuts (the club's session is not ours to
    // shorten), so a cell tapping there would assert nothing about the trim.
    const tapDay = '2026-07-31';
    reachHisWorldByActing({ withMarks: false });
    const before = dayFingerprints(projectedWeek(WEEK, tapDay));
    assert(before[tapDay] !== undefined && before[tapDay] !== 'REST',
      `the tap day (${tapDay}) holds nothing — this cell would be vacuous`);
    const mainLiftBefore = (projectedWeek(WEEK, tapDay).find((day) => day.date === tapDay)?.workout
      ?.exercises ?? [])[0]?.exercise?.name ?? null;

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only', tapDay), { todayISO: tapDay }));
    assert(result.ok === true, `the short-on-time door refused: "${result.message}"`);
    assert(result.changedProgram === true,
      'the ruled door reported no program change over an occupied today — the '
      + 'compressed session never landed');
    // §7's mixed-case honesty pin: a PLAIN day keeps deriving the compressed
    // session and never carries the fixture-day inert reason.
    assert(result.inertReason === undefined,
      `a plain-day tap carries inertReason "${String(result.inertReason)}" — `
      + 'the fixture-day rule is over-reaching');

    const todayAfter = projectedWeek(WEEK, tapDay).find((day) => day.date === tapDay);
    assert(todayAfter?.workout, 'the compressed day lost its session entirely');
    const statedMinutes = todayAfter.workout.durationMinutes ?? 0;
    assert(statedMinutes > 0 && statedMinutes <= SHORT_ON_TIME_MINUTES,
      `today states ${todayAfter.workout.durationMinutes} minutes against the `
      + `${SHORT_ON_TIME_MINUTES}-minute cap (zero = the cap never landed)`);
    const after = dayFingerprints(projectedWeek(WEEK, tapDay));
    assert(after[tapDay] !== before[tapDay],
      'today reads byte-identical — the cap changed a number and cut nothing');
    for (const date of Object.keys(before)) {
      if (date === tapDay) continue;
      assert(before[date] === after[date],
        `a today-scoped fact changed ${date}: "${before[date]}" -> "${after[date]}"`);
    }
    if (mainLiftBefore) {
      const namesAfter = (todayAfter.workout.exercises ?? [])
        .map((row) => row.exercise?.name ?? '');
      assert(namesAfter.includes(mainLiftBefore),
        `the main lift ("${mainLiftBefore}") did not survive the compression — `
        + `rows after: ${namesAfter.join(', ')}`);
    }

    // The deriving lane's ledger half: the adjustment is fact-linked, so the
    // clear cell below cascade-reverts through the generic sourceFactId path.
    const factId = result.createdModifierIds?.[0];
    assert(factId, 'the door reported ok with no created fact id');
    assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.some(
      (adjustment) => adjustment.kind === 'deriving_source_fact' &&
        adjustment.sourceFactId === factId && adjustment.status === 'active'),
      'the deriving commit minted no fact-linked adjustment — nothing owns the undo');
  });

  await run('the cap owner CUTS the session, not just the number (main lift kept, essentials only)', async () => {
    // THE COMPRESSION LAW AT ITS OWNER, over deterministic input — the
    // end-to-end cell above proves the lane delivers a changed day, but a
    // regenerated week can differ from the base for its own reasons, so only
    // this cell can catch the trim being deleted while the cap keeps stamping
    // durations (found by mutation testing: that exact mutation survived the
    // end-to-end cell). Shape per Sam's ruling via the Bible §9 authored trim:
    // main lift byte-identical, accessory sets halved, hard finisher dropped,
    // duration states the cap.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { validateWorkoutAgainstActiveConstraints } =
      require('../utils/postGenerationConstraintValidation') as
        typeof import('../utils/postGenerationConstraintValidation');
    const capConstraint = {
      id: 'source-fact:time-cap:cell', type: 'schedule' as const, severity: 5,
      status: 'active' as const, startDate: TODAY, lastUpdatedAt: TODAY,
      reasonLabel: 'Temporary 35-minute cap', source: 'tap' as const,
      temporarySourceFactIds: ['cell-fact'], scheduleKind: 'time_cap' as const,
      maxSessionMinutes: SHORT_ON_TIME_MINUTES, timeCapDates: [TODAY],
      rules: [], safeFocus: [], advice: [],
    };
    const workout = {
      id: 'cap-cell-workout', microcycleId: 'cap-cell-week', dayOfWeek: 3,
      name: 'Lower Squat', description: '', durationMinutes: 0,
      intensity: 'Moderate', workoutType: 'Strength', sessionTier: 'core',
      hasCombinedConditioning: true,
      conditioningBlock: { attachedKind: 'finisher', intent: 'high-intensity' },
      exercises: [
        { id: 'r1', workoutId: 'cap-cell-workout', exerciseId: 'back-squat', orderIndex: 0,
          prescribedSets: 4, prescribedReps: '5', prescribedWeightKg: 100,
          exercise: { id: 'back-squat', name: 'Back Squat' } },
        { id: 'r2', workoutId: 'cap-cell-workout', exerciseId: 'split-squat', orderIndex: 1,
          prescribedSets: 4, prescribedReps: '8',
          exercise: { id: 'split-squat', name: 'Split Squat' } },
        { id: 'r3', workoutId: 'cap-cell-workout', exerciseId: 'leg-curl', orderIndex: 2,
          prescribedSets: 3, prescribedReps: '10',
          exercise: { id: 'leg-curl', name: 'Leg Curl' } },
      ],
      createdAt: '', updatedAt: '',
    };
    const validated = quiet(() => validateWorkoutAgainstActiveConstraints({
      workout: workout as never,
      date: TODAY,
      todayISO: TODAY,
      activeConstraints: [capConstraint as never],
      profile: samExport8Profile(),
    })).workout;
    assert(validated, 'the cap collapsed the session to rest');
    assert(validated.durationMinutes === SHORT_ON_TIME_MINUTES,
      `the capped session states ${validated.durationMinutes} minutes, not the cap`);
    const rows = Object.fromEntries((validated.exercises ?? []).map((row) =>
      [row.exercise?.name ?? row.exerciseId, row.prescribedSets]));
    assert(rows['Back Squat'] === 4,
      `the main lift moved (${rows['Back Squat']} sets) — it must be kept byte-identical`);
    assert((rows['Split Squat'] ?? 0) < 4 || (rows['Leg Curl'] ?? 0) < 3,
      'no accessory was cut — the compression changed a number and nothing else '
      + `(rows: ${JSON.stringify(rows)})`);
    assert(!validated.conditioningBlock,
      'the hard finisher survived the compression');
  });

  await run('clearing the short-on-time fact restores today byte-exact', async () => {
    // The illness precedent's other half: fact-linked undo. Clearing the fact
    // cascade-reverts the overlay through the stored prior state, never a
    // re-derivation.
    const tapDay = '2026-07-31';
    reachHisWorldByActing({ withMarks: false });
    const before = dayFingerprints(projectedWeek(WEEK, tapDay));
    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only', tapDay), { todayISO: tapDay }));
    assert(result.ok === true && result.createdModifierIds?.[0],
      `precondition: the deriving commit landed (ok=${result.ok})`);
    const factId = result.createdModifierIds[0];
    assert(JSON.stringify(dayFingerprints(projectedWeek(WEEK, tapDay))) !== JSON.stringify(before),
      'precondition: the commit changed the week');

    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'short_on_time_today', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { modifierId: factId, date: tapDay },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as ProgramControlAction, { todayISO: tapDay }));
    assert(cleared.ok === true, `the clear was refused: "${cleared.message}"`);
    const after = dayFingerprints(projectedWeek(WEEK, tapDay));
    assert(JSON.stringify(before) === JSON.stringify(after),
      'clearing the fact did not restore the week byte-exact');
  });

  // ────────────────────────────────────────────────────────────────────────
  // GAME DAY: NOTHING TO SHORTEN (Sam's §7 answer, 2026-08-03 — sentence
  // SIGNED verbatim: "It's game day — there's nothing to shorten. Go play.").
  // The fact stays a time_cap fact; what changes on a fixture day is its RULED
  // EFFECT — nothing to shorten, so the LANE OWNER (the transaction's
  // classifier, date-aware through the one fixture owner) routes it INERT.
  // The fact records; the coach keeps the context; the athlete gets the truth.
  // ────────────────────────────────────────────────────────────────────────

  await run('short on time on a MARKED fixture commits inert: fact recorded, program byte-unchanged, the fixture truth', async () => {
    // Sam's 2026-08-01 tape tap was exactly this coordinate: "Short on time
    // today" ON the fixture day. Before the §7 answer, the deriving regen of
    // this marked world refused honestly; now the classifier reads the date
    // through the fixture owner and the commit is inert BY RULING.
    reachHisWorldByActing();
    const gameDay = '2026-08-01';
    assert(SAM_EXPORT_8_MARKED_DAYS[gameDay] === 'game',
      'precondition: 2026-08-01 is no longer his marked game — this cell targets the wrong day');
    const before = dayFingerprints(projectedWeek(WEEK, gameDay));
    const overlaysBefore = JSON.stringify(useProgramStore.getState().weekScopedOverlays ?? {});
    const ledgerBefore = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length;

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only', gameDay), { todayISO: gameDay }));
    assert(result.ok === true,
      `the fixture-day tap is still refused ("${result.message}") — the §7 inert lane never landed`);
    assert(result.changedProgram === false,
      'a fixture-day cap claims a program change — there is nothing to shorten');
    assert(result.inertReason === 'fixture_day',
      `the committed result does not say WHY nothing changed (inertReason: ${
        String(result.inertReason)}) — the ack owner would have to guess from the door`);

    // The fact + constraint land where inert schedule facts already surface —
    // the coach keeps the context (the existing inert lane's own property).
    const accepted = normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext);
    const fact = accepted.temporarySourceFacts.find((candidate) =>
      !isInjurySourceFact(candidate) && candidate.factKind === 'time_cap');
    assert(fact && !isInjurySourceFact(fact) && fact.factKind === 'time_cap' &&
      fact.dates.length === 1 && fact.dates[0] === gameDay,
      'the fixture-day time-cap fact did not land in the accepted context');
    assert(accepted.activeConstraints.some((constraint) =>
      constraint.type === 'schedule' &&
      (constraint as { scheduleKind?: string }).scheduleKind === 'time_cap'),
      'the inert fact composed no constraint — the coach lost the context');

    const after = dayFingerprints(projectedWeek(WEEK, gameDay));
    assert(JSON.stringify(before) === JSON.stringify(after),
      'a fixture-day inert cap changed the visible week');
    assert(after[gameDay] === before[gameDay],
      'the fixture day itself changed — the anchor law broke');
    assert(JSON.stringify(useProgramStore.getState().weekScopedOverlays ?? {}) === overlaysBefore,
      'a fixture-day inert cap authored a week overlay');
    assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length === ledgerBefore,
      'a fixture-day inert cap minted a reversible adjustment');

    const ack = buildScheduleAcknowledgment(result, 'short_on_time');
    assert(ack.tone === 'success' &&
      ack.message === "It's a practice match — nothing to shorten. Go play.",
      // §10 RE-POINT (Sam, 2026-08-03): this world is Sam's real export —
      // Pre-season — so its card reads "Practice Match" (6-IV-4) and the
      // signed sentence is the practice-match variant. The cell asserted the
      // game-day wording when only one sentence existed; the ruling changed
      // the premise, not the behaviour under test. In-season marked coverage
      // is the cell added directly below, so both variants stay pinned.
      `the athlete does not hear the signed sentence for THIS fixture's kind — got "${ack.message}"`);
  });

  await run('short on time on a VIRTUAL game day (in-season usualGameDay, no marks) takes the same inert lane', async () => {
    // The fixture owner resolves virtual fixtures too — an in-season athlete
    // with a usualGameDay and no calendar marks still has a game on Saturday.
    // The classifier must ask the owner, never re-derive virtual-game logic.
    reachHisWorldByActing({
      withMarks: false,
      profile: {
        ...samExport8Profile(),
        seasonPhase: 'In-season',
        usualGameDay: 'Saturday',
        gameDay: 'Saturday',
      } as ReturnType<typeof samExport8Profile>,
      selectedPhase: 'In-season',
    });
    const virtualGameDay = '2026-08-01'; // the Saturday of his week, unmarked
    assert(Object.keys(useCalendarStore.getState().markedDays ?? {}).length === 0,
      'precondition: this world must hold NO calendar marks — the fixture is virtual');
    const before = dayFingerprints(projectedWeek(WEEK, virtualGameDay));

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(
        shortOnTimeAction('today_only', virtualGameDay), { todayISO: virtualGameDay }));
    assert(result.ok === true,
      `the virtual-fixture tap was refused ("${result.message}")`);
    assert(result.changedProgram === false && result.inertReason === 'fixture_day',
      `the virtual game day did not take the inert lane (changedProgram=${
        result.changedProgram}, inertReason=${String(result.inertReason)}) — the `
      + 'classifier is not asking the fixture owner about virtual fixtures');
    const after = dayFingerprints(projectedWeek(WEEK, virtualGameDay));
    assert(JSON.stringify(before) === JSON.stringify(after),
      'a virtual-fixture inert cap changed the visible week');
    const ack = buildScheduleAcknowledgment(result, 'short_on_time');
    assert(ack.message === "It's game day — there's nothing to shorten. Go play.",
      `virtual game day: the athlete does not hear the signed sentence — got "${ack.message}"`);
  });

  await run('short on time on an IN-SEASON MARKED game says game day, not practice match', async () => {
    // The other half of §10's pair, and the reason the marked cell above could
    // be re-pointed honestly: a MARKED fixture in an IN-SEASON world is a game,
    // its card says so, and the sentence must match. Without this cell the
    // re-point would have traded coverage for agreement.
    reachHisWorldByActing({
      profile: {
        ...samExport8Profile(),
        seasonPhase: 'In-season',
        usualGameDay: 'Saturday',
        gameDay: 'Saturday',
      } as ReturnType<typeof samExport8Profile>,
      selectedPhase: 'In-season',
    });
    const gameDay = '2026-08-01';
    assert(SAM_EXPORT_8_MARKED_DAYS[gameDay] === 'game',
      'precondition: this cell targets his marked fixture day');
    const result = await quietAsync(() =>
      executeProgramControlActionDurably(
        shortOnTimeAction('today_only', gameDay), { todayISO: gameDay }));
    assert(result.ok === true, `the in-season marked tap was refused ("${result.message}")`);
    assert(result.inertReason === 'fixture_day' && result.inertFixtureVariant === 'game',
      `an in-season marked fixture is not a game to the owner (variant=${
        String(result.inertFixtureVariant)})`);
    const ack = buildScheduleAcknowledgment(result, 'short_on_time');
    assert(ack.message === "It's game day — there's nothing to shorten. Go play.",
      `in-season marked: the athlete hears the wrong signed sentence — got "${ack.message}"`);
  });

  await run('short on time on a PRE-SEASON fixture says practice match, not game day', async () => {
    // §10 (Sam, 2026-08-03): the sentence variant is selected by the SAME
    // `FixtureAvailabilityKind` that picks the day's card label (6-IV-4), so
    // the card and the sentence can never disagree about what the day is. The
    // same world as the virtual cell, one answer different: Pre-season.
    reachHisWorldByActing({
      withMarks: false,
      profile: {
        ...samExport8Profile(),
        seasonPhase: 'Pre-season',
        usualGameDay: 'Saturday',
        gameDay: 'Saturday',
      } as ReturnType<typeof samExport8Profile>,
      selectedPhase: 'Pre-season',
    });
    const fixtureDay = '2026-08-01'; // the Saturday of his week, unmarked
    const before = dayFingerprints(projectedWeek(WEEK, fixtureDay));

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(
        shortOnTimeAction('today_only', fixtureDay), { todayISO: fixtureDay }));
    assert(result.ok === true, `the pre-season fixture tap was refused ("${result.message}")`);
    assert(result.changedProgram === false && result.inertReason === 'fixture_day',
      `a pre-season fixture did not take the inert lane (inertReason=${
        String(result.inertReason)})`);
    assert(result.inertFixtureVariant === 'practice_match',
      `the fixture's own kind did not travel with the result — got ${
        String(result.inertFixtureVariant)}; the card label owner says practice_match`);
    const after = dayFingerprints(projectedWeek(WEEK, fixtureDay));
    assert(JSON.stringify(before) === JSON.stringify(after),
      'a practice-match inert cap changed the visible week');
    const ack = buildScheduleAcknowledgment(result, 'short_on_time');
    assert(ack.message === "It's a practice match — nothing to shorten. Go play.",
      `pre-season: the athlete hears the wrong signed sentence — got "${ack.message}"`);
  });

  await run('a refused schedule tap is acknowledged to the athlete, in the athlete\'s words', async () => {
    // THE LAW THE FIRST DRAFT OF THIS FILE ASSERTED ONE LAYER TOO LOW.
    //
    // "The door refused in silence" was checked on the RESULT OBJECT — which
    // always carried a sentence, while the SCREEN discarded it: the tap handler
    // dropped the result on the floor and the away sheet closed unconditionally
    // after its await, so a refusal read as a confirmation. Asserting on the
    // result was the harness entering below the door, in a cell written about a
    // door being dead.
    //
    // The ack layer is the athlete's answer, so the ack layer is what is
    // asserted, for both doors and both tones.
    for (const door of ['short_on_time', 'away'] as const) {
      const refused = buildScheduleAcknowledgment(
        { ok: false, message: ENGINE_REFUSAL_SENTENCE }, door,
      );
      assert(refused.tone === 'error',
        `${door}: a refused tap is acknowledged as a success`);
      assert(refused.message.trim().length > 0, `${door}: the ack is empty`);
      assert(!refused.message.includes(ENGINE_REFUSAL_SENTENCE),
        `${door}: the engine's verifier sentence reached the athlete verbatim: `
        + `"${refused.message}"`);
      assert(!/verif|program could not|transaction|fact/i.test(refused.message),
        `${door}: the ack talks about the machine, not the athlete's week: `
        + `"${refused.message}"`);

      const landed = buildScheduleAcknowledgment({ ok: true }, door);
      assert(landed.tone === 'success' && landed.message.trim().length > 0,
        `${door}: a landed tap is not acknowledged`);
      assert(landed.message !== refused.message,
        `${door}: success and failure say the same sentence`);
    }

    // THE EFFECT CLAUSE IS SELECTED BY THE COMMITTED RESULT, never by the door
    // alone (a signed sentence must not claim a state-dependent outcome). A
    // short-on-time commit that compressed today says so; one that changed
    // nothing (rest day, already short) keeps the plain logged sentence.
    const compressed = buildScheduleAcknowledgment(
      { ok: true, changedProgram: true }, 'short_on_time');
    assert(/compressed|main lift/i.test(compressed.message),
      'a deriving short-on-time commit is acknowledged without its effect clause: '
      + `"${compressed.message}"`);
    const recordedOnly = buildScheduleAcknowledgment(
      { ok: true, changedProgram: false }, 'short_on_time');
    assert(!/compressed|main lift/i.test(recordedOnly.message),
      'a no-change commit claims a compression that did not happen: '
      + `"${recordedOnly.message}"`);
    const awayLanded = buildScheduleAcknowledgment(
      { ok: true, changedProgram: false }, 'away');
    assert(/stays as planned/i.test(awayLanded.message),
      'the away ack no longer carries its honest record-only clause: '
      + `"${awayLanded.message}"`);

    // THE THIRD CLAUSE (Sam's §7 answer): selected by the committed result's
    // typed inertReason — verbatim, and never for the away door, whose facts
    // can never be fixture-inert.
    const gameDayAck = buildScheduleAcknowledgment(
      { ok: true, changedProgram: false, inertReason: 'fixture_day' }, 'short_on_time');
    assert(gameDayAck.tone === 'success' &&
      gameDayAck.message === "It's game day — there's nothing to shorten. Go play.",
      `the fixture-day clause is not Sam's signed sentence verbatim: "${gameDayAck.message}"`);
    const awayNeverGameDay = buildScheduleAcknowledgment(
      { ok: true, changedProgram: false, inertReason: 'fixture_day' }, 'away');
    assert(/stays as planned/i.test(awayNeverGameDay.message),
      `the away door borrowed the game-day sentence: "${awayNeverGameDay.message}"`);
  });

  await run('the removed Time door stays absent and Away still acknowledges', async () => {
    // SOURCE-PINNED, because there is no render harness in this repo and the
    // defect this pays was pure wiring: a discarded result and an unconditional
    // close. Both are single lines, and both are single lines a refactor can put
    // back without failing anything else.
    const screen = fs.readFileSync(
      `${__dirname}/../screens/home/HomeScreenV2.tsx`, 'utf8') as string;
    // SUPERSEDED 2026-08-11. Sam removed the inert Time control and gave its
    // slot to the direct Tired readiness door. The domain action remains
    // testable below, but no Program-screen handler or tap may expose it.
    assert(!/handleApplyShortOnTimeToday/.test(screen)
      && !/home-short-on-time-entry/.test(screen)
      && !/surface: 'short_on_time_today'/.test(screen),
      'the removed short-on-time Program door or its handler wiring has returned');
    // RE-AIMED 2026-08-13 BY SEAT_INBOX ITEM 28. The away door no longer writes a
    // schedule fact at all: Sam ruled away IS the dated equipment modifier
    // (*"the athlete just removes the equipment they don't have while on the
    // trip"*), so the commit these three lines guard is the equipment one. The
    // PROPERTY is unchanged and is the whole point — the result is
    // acknowledged, the ack reaches the tape, and the sheet may only close on
    // `ok`, because closing IS the confirmation.
    assert(/const result = await handleApplyAwayEquipment\(decision\);[\s\S]{0,300}?setScheduleAck\(ack\);/
      .test(screen),
      'the away commit does not acknowledge its result');
    assert(/recordScheduleAckPresented\(\{\s*\n?\s*traceId: result\?\.traceId, surface: 'away_this_week', tone: ack\.tone,/.test(screen),
      'away_this_week: the ack presentation is not recorded on the tape');
    assert(/if \(result\?\.ok\) setAwayEquipmentSpan\(null\);/.test(screen),
      'the away equipment sheet closes without checking `ok` — closing IS the '
      + 'confirmation, so an unconditional close reports a success that did not '
      + 'happen');
  });

  await run('the removed short-on-time handler stays absent while Away writes a dated equipment fact', async () => {
    const hook = fs.readFileSync(
      `${__dirname}/../screens/home/useHomeScreen.ts`, 'utf8') as string;
    assert(!/const handleApplyShortOnTimeToday/.test(hook)
      && !/^\s*handleApplyShortOnTimeToday,\s*$/m.test(hook),
      'useHomeScreen still authors or exports the removed UI handler');

    // ITEM 28: THE AWAY DOOR IS AN EQUIPMENT WRITER NOW, AND THAT IS THE CELL.
    // The `travel` schedule fact it used to write marked the away dates
    // UNAVAILABLE — it removed the sessions — which is the opposite of Sam's
    // ruling twice over (*"if yes, follow same program"*) and would also have
    // made this item vacuous: an equipment answer dated over days that hold no
    // session substitutes nothing.
    const awayStart = hook.indexOf('const handleApplyAwayEquipment');
    assert(awayStart > 0, 'useHomeScreen no longer owns an away handler at all');
    const awayBody = hook.slice(awayStart, hook.indexOf('}, [weekDays, handleProgramControlResult]);', awayStart));
    assert(/type: 'set_equipment_modifier'/.test(awayBody)
      && /surface: 'away_this_week'/.test(awayBody),
      'the away handler no longer writes an equipment decision through the door '
      + 'that names it');
    assert(!/set_schedule_modifier/.test(awayBody) && !/clear_days/.test(awayBody),
      'the away handler is writing a schedule fact again — that is the door that '
      + 'took the athlete\'s sessions away while they were travelling');
  });

  // ────────────────────────────────────────────────────────────────────────
  // DECLARED RED 2 IS PAID (2026-08-03), in two halves. The RULED half — what
  // "short on time" DOES — is the deriving cell above: the compressed session
  // under the 35-minute owner. The UNRULED half is no longer a red at all: a
  // busy_week constraint changing nothing visible is now the LAW (record-only
  // by ruling, Sam 2026-08-02), asserted below so a future "helpful" effect
  // cannot arrive without a ruling.
  // ────────────────────────────────────────────────────────────────────────

  await run('an unruled busy constraint reaches today and changes nothing, BY RULING', async () => {
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());
    assert(before[TODAY] !== undefined && before[TODAY] !== 'REST',
      `today (${TODAY}) holds nothing — this cell would be vacuous`);

    publishScheduleFactDirectly(weekBusyFact());
    const after = dayFingerprints(projectedWeek());
    assert(JSON.stringify(before) === JSON.stringify(after),
      'an UNRULED busy constraint changed the projected week — no ruling gave '
      + `busy an effect. If Sam has ruled one, rewrite this cell to assert it.\n`
      + `        before: ${before[TODAY]}\n        after:  ${after[TODAY]}`);
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
totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
