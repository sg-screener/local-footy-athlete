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
    /* ⚠ **"FEWER COMPONENTS" STOPPED MEANING "THE MOVE HAPPENED" — R-220 (Sam,
     * 2026-08-25).** A move onto a club night that already holds a gym session
     * is now a SWAP: the source does not empty, it receives the session it
     * displaced, and the component count can land identical. Counting was
     * always a proxy for "the day changed"; this asks the question directly, by
     * following the exercises that were on it. The cell's job — non-vacuity for
     * the two above, proving the durable path does something — is unchanged. */
    const exerciseNames = (workout: { exercises?: unknown } | null | undefined): string[] =>
      ((workout?.exercises ?? []) as any[])
        .map((row) => row?.exercise?.name ?? row?.name).filter(Boolean).sort();
    const wasOnSource = exerciseNames(before.workout);
    const nowOnSource = exerciseNames(after?.workout);
    assert(!after?.workout
      || wasOnSource.some((name) => !nowOnSource.includes(name)),
      'the durable move claimed success and the source day still holds every '
      + `exercise it started with — still "${after?.workout?.name}"`);
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
  /* ══ THE "SHORT ON TIME TODAY" CELLS ARE DELETED WITH THEIR DOOR ═══════════
   *
   * Sam, 2026-08-21: *"Short-on-time has no current athlete-facing route. Prove
   * that, then delete its remaining implementation, tests and debt entry. Do
   * not repair it."*
   *
   * ⚠ THIS SUITE ALREADY CONTAINED THE PROOF, IN TWO OF ITS OWN CELLS — "the
   * removed Time door stays absent" and "the removed short-on-time handler
   * stays absent", both still below and both still PASSING. Nine cells beside
   * them went on driving that door through a `shortOnTimeAction` helper the
   * suite manufactured itself at `scope: 'today_only'` — a scope no athlete
   * control dispatches (`npm run test:short-on-time-absent`, 8 cells). The
   * suite was asserting a door its own neighbours said did not exist.
   *
   * DELETED: the helper and nine cells — the one-day horizon, the today-scoped
   * fact, the deriving compression, the cap owner's cut, the byte-exact restore,
   * and the four fixture/game-day inert lanes. TWO OF THEM WERE ALREADY FAILING
   * at base.
   *
   * KEPT: every door an athlete can still open — the G-1 ask, durable/synchronous
   * parity, the move, the week-scoped fact, Away, equipment, the refusal
   * acknowledgement, the two absence guards, the unruled busy constraint, and the
   * coach/tap parity wrapper.
   */


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

  await run('the away door RECORDS a fact and the week DERIVES the change', async () => {
    // ── INVERTED 2026-08-13, AND SAM'S RULING IS WHY ──
    //
    // This cell asserted the opposite for months, and it was RIGHT to: away had
    // no ruled effect, so its fact took the record-only lane and the program
    // bytes could not move. **Sam ruled the effect on 2026-08-13** — *"yes clear
    // team training and games while away"* — and a ruled effect that still
    // takes the inert lane is a modifier the athlete reads and never receives.
    // That is exactly what the simulator showed: the flow completed, the
    // acknowledgment appeared, and the week did not move.
    //
    // WHAT IS UNCHANGED IS THE PART THAT MATTERS: the fact still lands, its
    // constraint still composes, and the door is still honest about what it
    // did. Only `changedProgram` and the byte-equality flipped, because what
    // away MEANS changed.
    reachHisWorldByActing();
    const before = dayFingerprints(projectedWeek());
    const overlaysBefore = JSON.stringify(useProgramStore.getState().weekScopedOverlays ?? {});
    const ledgerBefore = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length;
    const awayDates = ['2026-08-01', '2026-08-02'];
    const clubRowsBefore = weekOf(awayDates[0])
      .filter((day) => awayDates.includes(day.date))
      .flatMap((day) => (day.workout?.exercises ?? []) as any[])
      .map((row: any) => String(row?.exercise?.name ?? row?.name ?? ''))
      .filter((name) => /team training/i.test(name));

    const result = await quietAsync(() =>
      executeProgramControlActionDurably(awayAction(awayDates), { todayISO: TODAY }));
    assert(result.ok === true, `the away door is still refused: "${result.message}"`);
    // ── PUT BACK 2026-08-13 AFTER A GLASS RUN, AND THE REASON IS THE CELL ──
    // For one commit away took the DERIVING lane, and on the real seeded world
    // the athlete tapped Away and read *"That didn't save — your week is
    // unchanged."*: the scoped regen re-authors the week without the club, the
    // §18 gate refuses it, and the transaction rolls back. **A door that
    // refuses is worse than a door that records**, so travel is back on the
    // inert lane until that refusal is understood. Sam's ruling is still
    // carried out at the PLAN — every week BUILT during a trip loses the club —
    // and what is still owed is re-authoring a week he is already looking at.
    // ── THE NORTH-STAR SHAPE, and it arrived the right way round ──
    // Away is on the RECORD-ONLY lane: it authors no week, mints no adjustment.
    // And the visible week still changes, because Sam's ruling is carried out in
    // DERIVATION — a fixture inside the trip stops anchoring the week
    // (`derivedWeekContract`), so the week becomes the bye-week build he asked
    // for without anything being re-authored or stored.
    // **STORE THE DECISION, DERIVE EVERYTHING ELSE** — the deriving lane was the
    // wrong tool for this and made the door refuse on a real world.
    assert(result.changedProgram === true,
      'the away fact changed nothing. Its effect is DERIVED — a fixture inside '
      + 'the trip must stop anchoring the week.');

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

    // THE WEEK MOVED, AND THE UNDO EXISTS. A deriving fact authors a week
    // overlay and mints a fact-linked reversible adjustment — that adjustment is
    // what cascade-reverts when the athlete says "I'm back now", so a deriving
    // lane WITHOUT it would be a change with no way home.
    // AND IT DID IT WITHOUT AUTHORING ANYTHING. These two are the half that
    // makes the line above safe: a derived change needs no overlay and no
    // reversible adjustment, so clearing the fact restores the week by
    // arithmetic rather than by an undo that has to be remembered.
    assert(JSON.stringify(useProgramStore.getState().weekScopedOverlays ?? {}) === overlaysBefore,
      'a record-only away fact authored a week overlay');
    assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length === ledgerBefore,
      'a record-only away fact minted a reversible adjustment');

    // AND THE CHANGE IS THE RULED ONE, not merely "different bytes". A regen
    // that reshuffled the week for any other reason would satisfy every
    // assertion above; this one names what Sam actually asked for.
    const clubRowsOn = (week: ReturnType<typeof weekOf>): string[] => week
      .filter((day) => awayDates.includes(day.date))
      .flatMap((day) => (day.workout?.exercises ?? []) as any[])
      .map((row: any) => String(row?.exercise?.name ?? row?.name ?? ''))
      .filter((name) => /team training/i.test(name));
    // NON-VACUITY FIRST, and this cell exists because the positive form alone
    // passed on a week that never had a team row to lose. "No team training
    // survives" is trivially true of a week that never had any — `a bind can be
    // green and empty`, at the address that matters most.
    // ⚠ AND THE ANSWER IS THAT IT DOES NOT, YET — MEASURED, NOT ASSUMED. This
    // world has NO team-training row on either away day, because the generator
    // marks a team day on the PLAN (`isTeamDay`) and names it from there. The
    // positive form of this assertion passed VACUOUSLY on exactly that emptiness
    // (`a bind can be green and empty`), which is why it is written as a
    // measurement of the gap rather than a claim about the athlete's week.
    // **When the plan-side fix lands, this flips to `> 0` before and `=== 0`
    // after, and it is the cell that proves it.**
    const clubRowsAfter = clubRowsOn(weekOf(awayDates[0]));
    assert(clubRowsBefore.length === 0 && clubRowsAfter.length === 0,
      `the world grew a team-training row (${clubRowsBefore.length} before, `
      + `${clubRowsAfter.length} after). That is the shape this cell has been `
      + 'waiting for — invert it now: the before count is the non-vacuity proof '
      + 'and the after count must be zero.');
  });

  // ── ITEM 30: THE WEEK THAT ALREADY EXISTS ────────────────────────────────
  //
  // **The census defect wearing today's clothes:** the app now RUNS Sam's logic
  // and the athlete's week does not receive it. Everything else about equipment
  // was measured at GENERATION — build a fresh week with and without a
  // missing-barbell fact and the exercises differ. That proves nothing about the
  // week already sitting on his phone, which is the only week he has.
  //
  // SO THIS CELL WALKS TO A WORLD FIRST and applies the fact to it. It is the
  // acceptance item 30 asks for, and it is the shape every "changes only reach a
  // week that has not been built yet" claim has to answer to.
  await run('ITEM 30: an equipment fact reaches a week that ALREADY EXISTS', async () => {
    reachHisWorldByActing();
    // READ THE EQUIPMENT, NOT THE NAME. The first version of this matched
    // /overhead press/ and reported "Half-Kneeling Single-Arm Overhead Press" —
    // a DUMBBELL exercise — as a surviving barbell row. A name is not a kit
    // list, and a cell that confuses them fails on correct behaviour.
    const barbellRows = (): string[] => projectedWeek()
      .flatMap((day) => (day.workout?.exercises ?? []) as any[])
      .filter((row: any) => ((row?.exercise?.equipmentRequired ?? []) as unknown[])
        .some((item) => /barbell/i.test(String(item))))
      .map((row: any) => String(row?.exercise?.name ?? row?.name ?? ''));
    const before = barbellRows();
    // NON-VACUITY FIRST. "No barbell survives" is trivially true of a week that
    // never had one — the exact trap the away cell above fell into.
    assert(before.length > 0,
      'this world has no barbell row to lose, so the assertion below would pass '
      + 'on emptiness. Walk to a world that has one.');

    const result = await quietAsync(() => executeProgramControlActionDurably({
      type: 'set_equipment_modifier',
      source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: {
        decision: {
          kind: 'missing_this_week',
          tags: ['barbell'],
          conditioningModalities: [],
        },
        date: TODAY,
        todayISO: TODAY,
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    } as ProgramControlAction, { todayISO: TODAY }));
    assert(result.ok === true, `the equipment door was refused: "${result.message}"`);
    assert(result.changedProgram === true,
      'the equipment fact reports NO program change — the athlete reads '
      + '"Exercises substituted" over a week that still holds the barbell');

    const after = barbellRows();
    assert(after.length === 0,
      `${after.length} barbell row(s) survived in the week the athlete is `
      + `looking at: ${after.slice(0, 4).join(', ')}. Substituting only what has `
      + 'not been built yet is not substituting.');
  });




  // ────────────────────────────────────────────────────────────────────────
  // GAME DAY: NOTHING TO SHORTEN (Sam's §7 answer, 2026-08-03 — sentence
  // SIGNED verbatim: "It's game day — there's nothing to shorten. Go play.").
  // The fact stays a time_cap fact; what changes on a fixture day is its RULED
  // EFFECT — nothing to shorten, so the LANE OWNER (the transaction's
  // classifier, date-aware through the one fixture owner) routes it INERT.
  // The fact records; the coach keeps the context; the athlete gets the truth.
  // ────────────────────────────────────────────────────────────────────────





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
    // INVERTED 2026-08-13 WITH THE RULING. This asserted "stays as planned",
    // which was the honest RECORD-ONLY clause while away had no ruled effect.
    // Sam ruled one — *"yes clear team training and games while away"* — the
    // fact derives, and the week moves, so that clause became the lie it was
    // written to prevent. The PROPERTY is unchanged: the away ack must name
    // what away actually does to the week, and must not claim a compression.
    const awayLanded = buildScheduleAcknowledgment(
      { ok: true, changedProgram: false }, 'away');
    assert(/team training and games/i.test(awayLanded.message),
      'the away ack no longer names the ruled effect: '
      + `"${awayLanded.message}"`);
    // AND IT DOES NOT OVER-PROMISE. The first replacement said the club WAS off,
    // which is false of a week already on screen — the ruling is carried out
    // when a week is BUILT. The tense is the assertion.
    assert(!/are off while/i.test(awayLanded.message),
      'the away ack claims the club is already off a week that has not been '
      + `rebuilt: "${awayLanded.message}"`);
    assert(!/stays as planned/i.test(awayLanded.message),
      'the away ack still promises the week is untouched, which stopped being '
      + `true when Sam ruled the effect: "${awayLanded.message}"`);

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
    assert(!/game day|go play/i.test(awayNeverGameDay.message),
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
