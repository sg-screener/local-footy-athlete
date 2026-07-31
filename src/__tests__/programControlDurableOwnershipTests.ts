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
import { filterConstraintsForDate } from '../utils/readinessConstraints';
import { applyPlanChange } from '../utils/planChangeProducer';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import {
  composeTemporarySourceFactCompatibility,
  createTemporaryScheduleFact,
  type TemporaryScheduleFact,
} from '../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
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

  // ────────────────────────────────────────────────────────────────────────
  // "SHORT ON TIME TODAY" IS TODAY-SCOPED, BECAUSE THE COPY SAYS SO.
  //
  // Sam's ruling 2 (2026-07-31) split "Busy or away this week?" and named the
  // busy half "Short on time today". The fact behind it was week-scoped: one
  // rushed Tuesday reduced the whole week, silently, under copy that promised
  // one day. `scope: 'today_only'` is now honoured by the executor, and these
  // three cells are what "honoured" has to mean.
  // ────────────────────────────────────────────────────────────────────────

  /** The one door, with the scope the button declares. */
  const shortOnTimeAction = (scope: 'today_only' | 'current_week'): ProgramControlAction => ({
    type: 'set_schedule_modifier',
    source: { screen: 'program_tab', surface: 'short_on_time_today', initiatedBy: 'tap' },
    scope,
    payload: { date: TODAY, todayISO: TODAY },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as ProgramControlAction);

  /** The fact the door builds, built by the door's own scope owner. */
  const shortOnTimeFact = (scope: 'today_only' | 'current_week'): TemporaryScheduleFact =>
    createTemporaryScheduleFact({
      observedDate: TODAY,
      scope: scheduleFactScopeForAction(
        shortOnTimeAction(scope) as Extract<ProgramControlAction, { type: 'set_schedule_modifier' }>,
      ),
      scheduleKind: 'busy_week',
      sourceActor: 'athlete',
      sourceSurface: 'short_on_time_today',
    });

  await run('the door gives a "today" request a one-day horizon and a week request a week', async () => {
    // THE DECISION THIS TASK OWNS, asserted on the function that makes it rather
    // than on a downstream shadow of it.
    const today = shortOnTimeFact('today_only');
    assert(today.scope.kind === 'date',
      `a today_only request took a "${today.scope.kind}" horizon under copy that says "today"`);
    assert(today.effectiveFrom === TODAY && today.effectiveUntil === TODAY,
      `the horizon spans ${today.effectiveFrom}..${today.effectiveUntil}, not ${TODAY}`);

    const week = shortOnTimeFact('current_week');
    assert(week.scope.kind === 'week',
      `a current_week request took a "${week.scope.kind}" horizon`);
    assert(week.effectiveFrom === WEEK && week.effectiveUntil !== TODAY,
      `the week horizon is ${week.effectiveFrom}..${week.effectiveUntil}`);
    assert(today.factId !== week.factId,
      'the two horizons mint the SAME fact id — one would silently supersede the other');
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

  await run('a today-scoped schedule fact reaches today and no other day', async () => {
    reachHisWorldByActing();
    const fact = shortOnTimeFact('today_only');
    publishScheduleFactDirectly(fact);
    const reached = daysReachedBy(`source-fact:schedule:${fact.factId}`);
    assert(reached.length === 1 && reached[0] === TODAY,
      `a fact that says "today" is offered to ${reached.length} day(s): ${reached.join(', ')}`);
  });

  await run('a week-scoped schedule fact reaches the whole week', async () => {
    // NON-VACUITY, and the proof that the HORIZON is what decides. If a
    // week-scoped fact reached one day too, the cell above would be passing on a
    // gate that ignores scope, and the ruling would be "implemented" by accident.
    reachHisWorldByActing();
    const fact = shortOnTimeFact('current_week');
    publishScheduleFactDirectly(fact);
    const reached = daysReachedBy(`source-fact:schedule:${fact.factId}`);
    assert(reached.length === 7,
      `a week-scoped fact is offered to ${reached.length} day(s): ${reached.join(', ')}`);
  });

  // ────────────────────────────────────────────────────────────────────────
  // DECLARED RED — THE DOOR ITSELF DOES NOT COMMIT, AND HAS NOT FOR SOME TIME.
  //
  // Found while building the three cells above: against a REAL
  // `acceptedCompositionBase` — which is what every device has, and what
  // `derivingSourceFactDeviceCommitTests` exists to seed — the schedule fact
  // transaction is REFUSED, whatever its scope. So "Short on time today" and
  // "Away this week?" both report a failure sentence and change nothing.
  //
  // WHY. `temporarySourceFactTransaction` sends a projection-delivered fact
  // (equipment / schedule / time_cap) down the RE-CANONICALISING path on
  // purpose — `preserveExactAcceptedWorkouts` is left undefined for anything
  // that is not inert or a scoped-regen restore, and its own comment says "the
  // re-canonicalising path stays for projection-delivered facts". Two lines
  // later `verifyCandidate` rejects ANY change to the accepted composition base
  // that is not a scoped regen, with
  // `accepted_composition_base_changed_by_temporary_fact`. The writer and the
  // verifier disagree about the same commit, so the commit cannot happen.
  //
  // WHY IT WAS NEVER SEEN. `equipmentScheduleFactTransactionTests` — the suite
  // that owns this fact — runs with `currentProgram: null`, so
  // re-canonicalisation is a no-op, the base never moves and the guard never
  // fires. `illnessClearGameWeekResolveTests` asserts
  // `!(ok === true && changedProgram === false)`, which a REFUSAL satisfies.
  // Green suites, dead door: the shape AGENTS.md calls the harness entering
  // below the door.
  //
  // NOT FIXED HERE, ON PURPOSE. Choosing between "the fact preserves the base"
  // and "the verifier permits a projection fact to re-canonicalise" is an
  // accepted-state ownership ruling, and CLAUDE.md's escalation rule says a
  // later layer blocking a correctly-typed intent stops implementation and
  // earns a reassessment rather than another guard. This cell holds the
  // reproduction until that ruling exists.
  //
  // WHEN IT IS FIXED THIS CELL FAILS, and whoever fixed it promotes the three
  // cells above to drive `executeProgramControlActionDurably` end to end.
  // ────────────────────────────────────────────────────────────────────────

  await run('DECLARED RED 1: the schedule door is refused, whatever its scope', async () => {
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());

    const raw = await quietAsync(() => transactTemporarySourceFact({
      operation: 'create',
      fact: shortOnTimeFact('today_only'),
      todayISO: TODAY,
      sourceActor: 'athlete',
      sourceSurface: 'short_on_time_today',
    })) as { outcome: string; reason?: string };
    assert(raw.outcome === 'safely_rejected',
      `the schedule fact transaction now answers "${raw.outcome}" — the declared red `
      + 'is paid. Delete this cell and promote the scope cells above to drive '
      + '`executeProgramControlActionDurably` end to end.');
    // TWO WORLDS, TWO BLOCKERS, ONE DEAD DOOR. This world's generated week also
    // fails its own §18 re-evaluation (`planner_selected_target_miss`,
    // `pattern_restore_failure`), so the ledger guard fires before the base
    // guard does. On the dev-E2E device-exact install the base guard fires
    // instead. Both are recorded because fixing either one alone leaves the door
    // shut, and a cell that pins only one would go green over a still-dead door.
    assert(/accepted_composition_base_changed_by_temporary_fact|Accepted-state ledger mismatch/
      .test(String(raw.reason)),
      `the refusal reason moved to "${raw.reason}" — the reproduction this cell holds `
      + 'is stale and the finding needs re-tracing before it is reported again');

    // L3 CONSERVATION: a refusal changes nothing. Whatever else is wrong here,
    // the athlete is not left with half a commit, and is told.
    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only'), { todayISO: TODAY }));
    assert(result.ok === false, 'the executor disagrees with the transaction it awaits');
    assert(typeof result.message === 'string' && result.message.trim().length > 0,
      'the door refused in silence');
    const after = dayFingerprints(projectedWeek());
    assert(JSON.stringify(before) === JSON.stringify(after),
      'a refused schedule tap changed the week anyway');
  });

  // ────────────────────────────────────────────────────────────────────────
  // DECLARED RED 2 — AND IF IT DID COMMIT, IT WOULD CHANGE NOTHING.
  //
  // Found immediately after the first: compose the constraint by hand (the cells
  // above prove it reaches exactly the right days) and project every week of the
  // generated program with it — and not one row, dose, or note moves anywhere.
  //
  // WHY. `buildScheduleConstraint` at severity 5 blocks `max_effort_strength`
  // and limits `hard_erg` / `high_volume_accessory` / `heavy_lower_strength`.
  // The sessions this generator actually emits carry none of those exposures, so
  // the exposure engine has nothing to act on. "Go lighter" is expressed as a
  // set of exposures the program does not use.
  //
  // NOT FIXED HERE, ON PURPOSE. What "short on time" should DO to a session is a
  // programming answer — Sam's own note on the time-cap path is that a session
  // "shrinks to fit" and what it KEEPS is authored content — and inventing one
  // in a buttons unit would be a fourth naming authority for session content.
  // Recorded so the door is not called finished.
  // ────────────────────────────────────────────────────────────────────────

  await run('DECLARED RED 2: the constraint reaches today and lightens nothing', async () => {
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());
    assert(before[TODAY] !== undefined && before[TODAY] !== 'REST',
      `today (${TODAY}) holds nothing — this cell would be vacuous`);

    publishScheduleFactDirectly(shortOnTimeFact('today_only'));
    const after = dayFingerprints(projectedWeek());
    assert(JSON.stringify(before) === JSON.stringify(after),
      'the short-on-time constraint now changes the projected week — the declared '
      + 'red is paid. Replace this cell with the real law: today lightens, the '
      + `other six days are untouched.\n        before: ${before[TODAY]}\n`
      + `        after:  ${after[TODAY]}`);
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
