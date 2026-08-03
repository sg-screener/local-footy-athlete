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
    reachHisWorldByActing();
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
    reachHisWorldByActing();
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
    const fact = accepted.temporarySourceFacts.find((candidate) =>
      !isInjurySourceFact(candidate) && candidate.factKind === 'schedule' &&
      candidate.scheduleKind === 'travel');
    assert(fact && !isInjurySourceFact(fact) &&
      JSON.stringify(fact.unavailableDates) === JSON.stringify(awayDates),
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
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());
    assert(before[TODAY] !== undefined && before[TODAY] !== 'REST',
      `today (${TODAY}) holds nothing — this cell would be vacuous`);
    const mainLiftBefore = (projectedWeek().find((day) => day.date === TODAY)?.workout
      ?.exercises ?? [])[0]?.exercise?.name ?? null;

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only'), { todayISO: TODAY }));
    assert(result.ok === true, `the short-on-time door refused: "${result.message}"`);
    assert(result.changedProgram === true,
      'the ruled door reported no program change over an occupied today — the '
      + 'compressed session never landed');

    const todayAfter = projectedWeek().find((day) => day.date === TODAY);
    assert(todayAfter?.workout, 'the compressed day lost its session entirely');
    assert((todayAfter.workout.durationMinutes ?? 0) <= SHORT_ON_TIME_MINUTES,
      `today still runs ${todayAfter.workout.durationMinutes} minutes against the `
      + `${SHORT_ON_TIME_MINUTES}-minute cap`);
    const after = dayFingerprints(projectedWeek());
    assert(after[TODAY] !== before[TODAY],
      'today reads byte-identical — the cap changed a number and cut nothing');
    for (const date of Object.keys(before)) {
      if (date === TODAY) continue;
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

  await run('clearing the short-on-time fact restores today byte-exact', async () => {
    // The illness precedent's other half: fact-linked undo. Clearing the fact
    // cascade-reverts the overlay through the stored prior state, never a
    // re-derivation.
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());
    const result = await quietAsync(() =>
      executeProgramControlActionDurably(shortOnTimeAction('today_only'), { todayISO: TODAY }));
    assert(result.ok === true && result.createdModifierIds?.[0],
      `precondition: the deriving commit landed (ok=${result.ok})`);
    const factId = result.createdModifierIds[0];
    assert(JSON.stringify(dayFingerprints(projectedWeek())) !== JSON.stringify(before),
      'precondition: the commit changed the week');

    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'short_on_time_today', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { modifierId: factId, date: TODAY },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as ProgramControlAction, { todayISO: TODAY }));
    assert(cleared.ok === true, `the clear was refused: "${cleared.message}"`);
    const after = dayFingerprints(projectedWeek());
    assert(JSON.stringify(before) === JSON.stringify(after),
      'clearing the fact did not restore the week byte-exact');
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
  });

  await run('the screen wires both schedule doors to that acknowledgment', async () => {
    // SOURCE-PINNED, because there is no render harness in this repo and the
    // defect this pays was pure wiring: a discarded result and an unconditional
    // close. Both are single lines, and both are single lines a refactor can put
    // back without failing anything else.
    const screen = fs.readFileSync(
      `${__dirname}/../screens/home/HomeScreenV2.tsx`, 'utf8') as string;
    // RE-PINNED 2026-08-01 (device-pass ack bug): the tap now binds the ack it
    // is about to render AND records the presentation into the athlete action
    // log (`recordScheduleAckPresented` — the Release-alive witness for the
    // render layer no harness here can mount). The pin covers the whole chain:
    // result → ack built from it → state set → presentation recorded.
    assert(/const result = await handleApplyShortOnTimeToday\(\);\s*\n\s*const ack = buildScheduleAcknowledgment\(result, 'short_on_time'\);\s*\n\s*setScheduleAck\(ack\);/
      .test(screen),
      'the short-on-time tap does not acknowledge its result — it is discarded, '
      + 'which is the silence this unit exists to remove');
    assert(/const result = await handleApplyAwayDays\(dates\);[\s\S]{0,300}?setScheduleAck\(ack\);/
      .test(screen),
      'the away commit does not acknowledge its result');
    for (const surface of ['short_on_time_today', 'away_this_week'] as const) {
      assert(new RegExp(
        `recordScheduleAckPresented\\(\\{\\s*\\n?\\s*traceId: result\\?\\.traceId, surface: '${surface}', tone: ack\\.tone,`,
      ).test(screen),
        `${surface}: the ack presentation is not recorded on the tape — Sam's `
        + '2026-08-01 silence would be undiagnosable again');
    }
    assert(/if \(result\?\.ok\) setAwayDaysVisible\(false\);/.test(screen),
      'the away sheet closes without checking `ok` — closing IS the confirmation, '
      + 'so an unconditional close reports a success that did not happen');
    assert(!/onPress=\{\(\) => \{ void handleApplyShortOnTimeToday\(\); \}\}/.test(screen),
      'the fire-and-forget tap handler is back');
  });

  await run('the short-on-time handler asks for the scope its words promise', async () => {
    // RULING 2'S BEHAVIOURAL CORE, pinned where it is decided. The scope cells
    // above build their own action literals, so reverting the handler to
    // `current_week` would leave every one of them green while a rushed Tuesday
    // reduced Saturday again. The handler is the only production caller.
    const hook = fs.readFileSync(
      `${__dirname}/../screens/home/useHomeScreen.ts`, 'utf8') as string;
    const start = hook.indexOf('const handleApplyShortOnTimeToday');
    assert(start > 0, 'the short-on-time handler is gone from useHomeScreen');
    const body = hook.slice(start, hook.indexOf('}, [handleProgramControlResult]);', start));
    assert(/surface: 'short_on_time_today'/.test(body),
      'the short-on-time handler no longer names its own surface');
    assert(/scope: 'today_only'/.test(body),
      "the short-on-time handler stopped asking for 'today_only' — the button says "
      + '"Short on time today" and the fact would span the week again');
    assert(!/'current_week'/.test(body),
      'the short-on-time handler asks for a week scope somewhere in its body');

    // AND THE AWAY HANDLER STILL ASKS FOR THE WEEK — the two doors differ by
    // scope, so a pin on one that would also pass for the other proves nothing.
    const awayStart = hook.indexOf('const handleApplyAwayDays');
    const awayBody = hook.slice(awayStart, hook.indexOf('}, [weekDays, handleProgramControlResult]);', awayStart));
    assert(/scope: 'current_week'/.test(awayBody) && /surface: 'away_this_week'/.test(awayBody),
      'the away handler no longer asks for the week scope it names');
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
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
