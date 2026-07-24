/**
 * STAGE 1 — DURABLE FACT HORIZON OWNERSHIP (T1–T5).
 *
 * These are the Q7 "duration ownership" invariants from
 * `docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`
 * (Option B1, approved; see Addendum A for the A3b corrections, which do not
 * touch this stage). They describe the CORRECT post-fix behaviour and are
 * expected to FAIL on the current architecture — that failure is what proves
 * each one pins the bug it targets.
 *
 * The question they pin: **when an athlete says something durable about their
 * body, which layer owns how long it is true?** Today four representations
 * answer that (the action's `scope` string, the fact's `effectiveFrom/Until`
 * pair, the week-mode overlap test, and the authored overlay key set), and the
 * first silently truncates the rest. After Stage 1 there is exactly one: the
 * fact's own horizon.
 *
 * Ground truth — seed `spent-week-friday`, device-exact:
 *   today FRIDAY 2026-07-24, week starting MON 2026-07-20
 *   MON Strength/core   TUE Team Training/core   WED Rest
 *   THU Team Training/core   FRI Strength/optional   SAT Game   SUN Recovery
 *   MON/TUE/THU already recorded Done through the real session-outcome
 *   transaction (T4's whole point: Done-ness must be protected).
 *
 * Each scenario runs in its OWN PROCESS. Re-seeding `spent-week-friday` twice
 * in one process leaves the second install unable to record a session outcome
 * (`incomplete_component_outcomes`) — the known re-seed artifact. A harness that
 * ignored it would report failures that have nothing to do with the invariant,
 * which is M6 ("tests that prove the wrong thing") in miniature. So invoking
 * this file with no `HORIZON_ONLY` forks itself once per scenario and
 * aggregates; `HORIZON_ONLY=<id>` runs exactly one in-process.
 *
 * Run: npm run test:fact-horizon
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import {
  commitAcceptedStateTransaction,
  getAcceptedMaterialContext,
} from '../store/acceptedStateTransaction';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../store/sessionOutcomeTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { readinessActionForKind, type WeekReadinessApplyKind } from '../utils/weekReadinessActions';
import { buildDevE2ESeed, devE2EWeekStartForSeed } from '../dev/e2e/devE2ESeedRegistry';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { deriveIllnessRecoveryWeekMode } from '../rules/illnessRecoveryWeekMode';
import { addDaysISO } from '../utils/programBlockState';
import type { TemporarySourceFact } from '../rules/temporarySourceFact';
import { isInjurySourceFact, temporarySourceFactId } from '../rules/temporarySourceFact';

const WEEK_1 = '2026-07-20';
const WEEK_2 = '2026-07-27';
const WEEK_3 = '2026-08-03';
const TODAY = '2026-07-24';
/** MON, TUE, THU of week 1 — already Done on this seed. */
const SPENT_DATES = ['2026-07-20', '2026-07-21', '2026-07-23'];

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined; console.log = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; console.log = log; }
}

interface Scenario { id: string; name: string; body: () => Promise<void> }
const scenarios: Scenario[] = [];
function scenario(id: string, name: string, body: () => Promise<void>): void {
  scenarios.push({ id, name, body });
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  memory.clear();
  try { await body(); passes += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

/** Device-exact `spent-week-friday` install — the fixture mark is published
 *  through the accepted-state boundary exactly as `defaultDevE2ESeedCoordinator`
 *  does, never the live calendar-mutation path (which would rebuild the
 *  accepted week into one_off_game overlays before anything runs). */
function seedSpentWeekFriday(): void {
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    weekScopedOverlays: {},
    dateOverrides: {},
    overrideContexts: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
    acceptedMaterialContext: normalizeAcceptedMaterialContext({ revision: 0 }),
  } as never);
  const seed = buildDevE2ESeed('spent-week-friday');
  const weekStarts = seed.program.microcycles.map((m) => m.startDate.slice(0, 10));
  quiet(() => seedOnboardingProgram({
    onboardingData: seed.profile,
    program: seed.program,
    todayISO: seed.anchorDate,
    programStore: {
      setCurrentProgram: (program) => {
        commitAcceptedStateTransaction({
          reason: 'fact-horizon-test:install',
          program: {
            currentProgram: program,
            currentMicrocycle: null,
            todayWorkout: null,
            blockState: deriveStoredBlockStateFromProgram(program),
          },
          profile: seed.profile,
          preserveExactAcceptedWorkouts: true,
          validateWeekStarts: weekStarts,
        } as never);
      },
      setCurrentMicrocycle: (microcycle) => commitAcceptedStateTransaction({
        reason: 'fact-horizon-test:mc',
        program: { currentMicrocycle: microcycle },
        profile: seed.profile,
        preserveExactAcceptedWorkouts: true,
        validateWeekStarts: microcycle ? [microcycle.startDate.slice(0, 10)] : [],
      } as never),
      setTodayWorkout: (workout) => commitAcceptedStateTransaction({
        reason: 'fact-horizon-test:today',
        program: { todayWorkout: workout },
        profile: seed.profile,
        preserveExactAcceptedWorkouts: true,
        validateWeekStarts: [devE2EWeekStartForSeed('spent-week-friday')],
      } as never),
    },
    calendarStore: {
      setGameDay: (date: string) => {
        const accepted = getAcceptedMaterialContext();
        const program = useProgramStore.getState().currentProgram!;
        commitAcceptedStateTransaction({
          reason: `fact-horizon-test:calendar_game:${date}`,
          markedDays: { ...accepted.markedDays, [date]: 'game' },
          profile: seed.profile,
          preserveExactAcceptedWorkouts: true,
          validateWeekStarts: program.microcycles.map((m) => m.startDate.slice(0, 10)),
        } as never);
      },
    },
  } as never));
  useProfileStore.setState({ onboardingData: seed.profile, isOnboardingComplete: true });
}

/** MON/TUE/THU recorded Done through the REAL session-outcome transaction —
 *  not a store poke. T4 is meaningless unless the Done-ness is genuine. */
async function markSpentDaysDone(): Promise<void> {
  for (const date of SPENT_DATES) {
    const target = resolveSessionOutcomeTarget(date, date);
    const intent = createRecordSessionOutcomeIntentFromFeedback({
      date,
      workout: target.workout,
      feedback: {
        dateStr: date,
        completion: 'full',
        feeling: 'very_easy',
        soreness: 'none',
        difficulty: 3,
      },
      source: {
        entryPoint: 'tap',
        surface: 'fact_horizon_test',
        interpretedIntent: 'record_session_outcome',
        traceId: `fact-horizon-test:done:${date}`,
      },
      todayISO: date,
    });
    const result = await quietAsync(() => commitSessionOutcomeTransaction(intent));
    assert(result.ok, `could not record ${date} Done: ${JSON.stringify(result)}`);
  }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  if (process.env.HORIZON_LOUD) return body();
  const warn = console.warn; const error = console.error; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined; console.log = () => undefined;
  try { return await body(); } finally { console.warn = warn; console.error = error; console.log = log; }
}

/** The ACCEPTED effective week as the athlete would see it. */
function acceptedWeek(weekStart: string): {
  mode: string;
  days: Record<string, string>;
  signature: string;
} {
  const state = useProgramStore.getState();
  const rebased = rebaseAcceptedEffectiveWeek({
    surfaces: state as never,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  const days: Record<string, string> = {};
  for (const workout of rebased.visibleWorkouts) {
    const offset = workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1;
    days[addDaysISO(weekStart, offset)] =
      `${workout.workoutType}/${workout.sessionTier ?? '-'}/${workout.intensity ?? '-'}/${workout.exercises.length}ex`;
  }
  return {
    mode: rebased.contract.identity.mode,
    days,
    signature: Object.entries(days).sort().map(([d, v]) => `${d}=${v}`).join('  '),
  };
}

function activeFacts(): TemporarySourceFact[] {
  return normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext)
    .temporarySourceFacts
    .filter((fact) => isInjurySourceFact(fact) ? fact.status === 'active' : fact.status === 'active');
}

function activeAdjustments() {
  return useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .filter((adjustment) => adjustment.status === 'active');
}

async function commitReadiness(kind: WeekReadinessApplyKind, anchorDateISO = WEEK_1) {
  const action = readinessActionForKind(kind, { anchorDateISO, todayISO: TODAY });
  // HORIZON_VERBOSE=1 keeps the transaction logs (blocker codes) visible when
  // diagnosing a single scenario via HORIZON_ONLY.
  if (process.env.HORIZON_VERBOSE) {
    return executeProgramControlActionDurably(action as never, { todayISO: TODAY });
  }
  return quietAsync(() => executeProgramControlActionDurably(action as never, { todayISO: TODAY }));
}

function registerScenarios(): void {
  // ── T1 — a severe illness reported on FRIDAY shapes NEXT week, and every
  // week after it, until it is cleared. The fact says "I am sick", not "I am
  // sick until Sunday"; nothing in the athlete's statement stops at midnight on
  // the 26th. Currently RED: `temporaryFactScope({kind:'week'})` truncates
  // `effectiveUntil` to the report week's Sunday, so the overlap test in
  // `deriveIllnessRecoveryWeekMode` returns false for every later week.
  scenario('t1', 'T1 a severe illness reported Friday reaches next week and the week after', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await commitReadiness('sick_week');
    assert((result as { ok?: boolean }).ok === true,
      `severe illness was rejected: ${(result as { message?: string }).message}`);

    const facts = activeFacts();
    assert(deriveIllnessRecoveryWeekMode({ temporarySourceFacts: facts, weekStartISO: WEEK_1 }),
      'the reported week does not derive illness_recovery (this week regressed)');
    assert(deriveIllnessRecoveryWeekMode({ temporarySourceFacts: facts, weekStartISO: WEEK_2 }),
      'NEXT week does not derive illness_recovery — the fact horizon was truncated to the report week');
    assert(deriveIllnessRecoveryWeekMode({ temporarySourceFacts: facts, weekStartISO: WEEK_3 }),
      'week +2 does not derive illness_recovery — the horizon is open until cleared, not two weeks long');

    // Derivation alone is not the deliverable: bake-at-authoring is settled law,
    // so every reached week must be AUTHORED under the mode, not re-derived at
    // read time. This is the half that a fix inside the overlap test would miss.
    assert(acceptedWeek(WEEK_2).mode === 'illness_recovery',
      `next week's ACCEPTED mode is "${acceptedWeek(WEEK_2).mode}" — the fact reached the derivation but was never materialised`);
  });

  // ── T2 — the sibling invariant. A3a is week-scope-wide, not illness-specific:
  // `cooked_week` and `poor_sleep_week` mint their windows from the same
  // `temporaryFactScope({kind:'week'})` call. Pinning them here is what forces
  // the fix to live at the FACT level — a fix that only touches
  // `deriveIllnessRecoveryWeekMode` leaves both of these red.
  for (const kind of ['cooked_week', 'poor_sleep_week'] as const) {
    scenario(`t2-${kind}`, `T2 ${kind} reaches next week too (the horizon is a fact property, not an illness one)`, async () => {
      seedSpentWeekFriday();
      await markSpentDaysDone();
      const result = await commitReadiness(kind);
      assert((result as { ok?: boolean }).ok === true,
        `${kind} was rejected: ${(result as { message?: string }).message}`);

      const fact = activeFacts().find((candidate) => !isInjurySourceFact(candidate) &&
        (candidate.factKind === 'fatigue' || candidate.factKind === 'poor_sleep'));
      assert(fact && !isInjurySourceFact(fact), `${kind} recorded no durable fact`);

      // The single duration owner must report that this fact is still in effect
      // during week 2. Expressed against the fact itself so the assertion cannot
      // be satisfied by a consumer-side special case.
      assert(factHorizonCoversWeek(fact, WEEK_2),
        `${kind}'s effect window stops inside the report week (from=${fact.effectiveFrom} until=${fact.effectiveUntil})`);

      // And it must have been materialised there, per bake-at-authoring.
      assert(activeAdjustments().some((adjustment) => adjustment.affectedWeeks.includes(WEEK_2)),
        `${kind} authored no effect for next week — the cascade did not extend past the report week`);
    });
  }

  // ── T3 — clearing the fact restores EVERY week it reached, byte-exact,
  // through the existing `sourceFactId` cascade. Extending the horizon is only
  // safe if reversal extends with it; an un-restored week 2 would be a worse
  // bug than the one being fixed. Undo is stored prior state, never
  // re-derivation (R12).
  scenario('t3', 'T3 clearing a severe illness restores every week it reached, byte-exact', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const before = [WEEK_1, WEEK_2, WEEK_3].map((week) => acceptedWeek(week).signature);

    const applied = await commitReadiness('sick_week');
    assert((applied as { ok?: boolean }).ok === true, 'severe illness was rejected');
    const factId = activeFacts().find((fact) => !isInjurySourceFact(fact) &&
      fact.factKind === 'illness')?.factId ?? null;
    assert(factId, 'no illness fact to clear');

    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { modifierId: factId, date: WEEK_1, todayISO: TODAY },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: false,
    } as never, { todayISO: TODAY }));
    assert((cleared as { ok?: boolean }).ok === true,
      `clearing the illness failed: ${(cleared as { message?: string }).message}`);

    const after = [WEEK_1, WEEK_2, WEEK_3].map((week) => acceptedWeek(week).signature);
    for (let index = 0; index < before.length; index += 1) {
      assert(before[index] === after[index],
        `week ${[WEEK_1, WEEK_2, WEEK_3][index]} was not restored byte-exact:\n  before ${before[index]}\n  after  ${after[index]}`);
    }
    assert(activeAdjustments().length === 0,
      `${activeAdjustments().length} reversible adjustment(s) survived the clear — residue`);
  });

  // ── T4 — NO RETROACTIVE REWRITE. A fact reported on Friday must not touch
  // Monday, Tuesday or Thursday, whether or not they are Done. Currently RED:
  // `temporaryFactScope({kind:'week'})` back-dates `effectiveFrom` to the
  // report week's Monday, and the scoped regen re-authors the whole week, so
  // three already-completed sessions get rewritten to "optional". Marking a
  // session the athlete already did "optional" is meaningless at best and
  // erodes their record at worst (L6: honest actions).
  for (const kind of ['sick_week', 'cooked_week', 'poor_sleep_week'] as const) {
    scenario(`t4-${kind}`, `T4 ${kind} reported Friday leaves the already-Done MON/TUE/THU untouched`, async () => {
      seedSpentWeekFriday();
      await markSpentDaysDone();
      const before = acceptedWeek(WEEK_1).days;

      const result = await commitReadiness(kind);
      assert((result as { ok?: boolean }).ok === true,
        `${kind} was rejected: ${(result as { message?: string }).message}`);

      const after = acceptedWeek(WEEK_1).days;
      const rewritten = SPENT_DATES.filter((date) => before[date] !== after[date]);
      assert(rewritten.length === 0,
        `${kind} rewrote ${rewritten.length} completed day(s): ` +
        rewritten.map((date) => `${date} "${before[date]}" → "${after[date]}"`).join('; '));

      // Every day strictly before today is past, Done or not. Wednesday is a
      // rest day on this seed and must be equally protected.
      const pastRewritten = Object.keys(before)
        .filter((date) => date < TODAY && before[date] !== after[date]);
      assert(pastRewritten.length === 0,
        `${kind} rewrote ${pastRewritten.length} past day(s) before today: ` +
        pastRewritten.map((date) => `${date} "${before[date]}" → "${after[date]}"`).join('; '));
    });
  }

  // ── A3a MATERIALISATION — the device-proven gap: the commit message claimed
  // next-week coverage while the program SCREEN showed an unchanged week. The
  // accepted mode reaching WEEK_2 (T1) is necessary but not sufficient — this
  // drives the REAL program-tab projection (buildProgramTabProjectedWeek over
  // buildScheduleStateImperative, the same pipeline HomeScreen renders) and
  // asserts the athlete SEES next week's sessions as optional.
  scenario('a3a-visible', 'A3a a severe illness reported Friday makes NEXT week visibly optional on the program screen', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await commitReadiness('sick_week');
    assert((result as { ok?: boolean }).ok === true,
      `severe illness was rejected: ${(result as { message?: string }).message}`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildScheduleStateImperative } = require('../utils/coachWeekDiff');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildProgramTabProjectedWeek } = require('../utils/visibleProgramReadModel');
    const state = buildScheduleStateImperative();
    const week2 = buildProgramTabProjectedWeek({
      mondayISO: WEEK_2,
      todayISO: TODAY,
      state,
    }) as Array<{ date: string; workout: { workoutType?: string; sessionTier?: string; name?: string } | null }>;

    const active = week2.filter((day) => day.workout &&
      day.workout.workoutType !== 'Rest' &&
      day.workout.workoutType !== 'Game' &&
      (state.markedDays ?? {})[day.date] !== 'game');
    assert(active.length > 0,
      'next week projected as entirely blank — nothing for the athlete to see at all');
    const offending = active.filter((day) =>
      day.workout!.sessionTier !== 'optional' && day.workout!.sessionTier !== 'recovery');
    assert(offending.length === 0,
      `next week still shows required sessions on the program screen: ` +
      offending.map((day) => `${day.date} ${day.workout!.name}/${day.workout!.sessionTier}`).join('; '));
  });

  // ── A1 — GAMES UNTOUCHED (Sam's standing ruling). The device finding: a
  // "Properly sick" commit on a game week failed at the §18 gate. The correct
  // outcome is that the commit SUCCEEDS, the live game anchor and its day
  // survive byte-identical, and everything else goes optional. This drives
  // the same seed's real game Saturday through the sick commit.
  scenario('a1-game-week', 'A1 a severe illness on a game week keeps the game anchor; everything else goes optional', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const accepted = getAcceptedMaterialContext();
    const gameDates = Object.entries(accepted.markedDays ?? {})
      .filter(([, kind]) => kind === 'game')
      .map(([date]) => date)
      .sort();
    assert(gameDates.length > 0, 'seed carries no marked game day — A1 needs a live game anchor');
    const landingGames = gameDates.filter((date) => date >= WEEK_1 && date < WEEK_2);
    assert(landingGames.length > 0, 'no game inside the landing week on this seed');
    const before = acceptedWeek(WEEK_1).days;

    const result = await commitReadiness('sick_week');
    assert((result as { ok?: boolean }).ok === true,
      `severe illness on a game week was rejected: ${(result as { message?: string }).message}`);

    const after = acceptedWeek(WEEK_1).days;
    for (const date of landingGames) {
      assert(before[date] === after[date],
        `the live game day ${date} was rewritten by the sick commit: "${before[date]}" → "${after[date]}"`);
    }
    // The game marking itself survives in accepted state.
    const markedAfter = getAcceptedMaterialContext().markedDays ?? {};
    for (const date of landingGames) {
      assert(markedAfter[date] === 'game', `game marking for ${date} was lost by the sick commit`);
    }
    // And the week still landed as an illness_recovery week.
    assert(acceptedWeek(WEEK_1).mode === 'illness_recovery',
      `landing week mode is "${acceptedWeek(WEEK_1).mode}", not illness_recovery`);
  });

  // ── RIDER 2 — the open horizon at season/block boundaries. DECIDED: an open
  // fact survives a block rollover and a season-phase change — only the athlete
  // ends it. Weeks minted at those boundaries come from GENERATION AT CREATION
  // (rider-1 table, last column), which reads the accepted facts, so the new
  // block's weeks are born reduced rather than patched afterwards. Clearing
  // the fact returns generation to normal — no residue in later blocks.
  scenario('r2-boundaries', 'R2 an open illness shapes the next block and a phase change, and only clearing ends it', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await commitReadiness('sick_week');
    assert((result as { ok?: boolean }).ok === true,
      `severe illness was rejected: ${(result as { message?: string }).message}`);
    const factId = activeFacts().map((fact) => temporarySourceFactId(fact))[0];
    assert(!!factId, 'no active fact recorded');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateProgramLocally } = require('../services/api/generateProgram');
    const profile = useProfileStore.getState().onboardingData!;
    const program = useProgramStore.getState().currentProgram!;
    const NEXT_BLOCK_START = '2026-08-17';

    // Block rollover: the next block generates under the open fact.
    const nextBlock = quiet(() => generateProgramLocally(profile, {
      todayISO: NEXT_BLOCK_START,
      blockNumber: 2,
      previousProgram: program,
      seasonPhaseClock: program.seasonPhaseClock,
      microcycleLimit: 1,
    }));
    assert(nextBlock.microcycles[0]?.exposureContractV2?.identity.mode === 'illness_recovery',
      `next block's first week generated as "${nextBlock.microcycles[0]?.exposureContractV2?.identity.mode}" — the open horizon did not cross the block rollover`);

    // Season-phase change: the fact survives the phase boundary too.
    const phaseChanged = quiet(() => generateProgramLocally(profile, {
      todayISO: NEXT_BLOCK_START,
      blockNumber: 2,
      previousProgram: program,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: profile.seasonPhase,
        phaseEntryWeekStartISO: NEXT_BLOCK_START,
        originProvenance: 'explicit_user_phase_change',
      } as never,
      microcycleLimit: 1,
    }));
    assert(phaseChanged.microcycles[0]?.exposureContractV2?.identity.mode === 'illness_recovery',
      `phase-change week generated as "${phaseChanged.microcycles[0]?.exposureContractV2?.identity.mode}" — the open horizon did not cross the phase change`);

    // Only the athlete ends it: clear, then the same generation is normal.
    const cleared = await quietAsync(() => executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { modifierId: factId, date: WEEK_1, todayISO: TODAY },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: false,
    } as never, { todayISO: TODAY }));
    assert((cleared as { ok?: boolean }).ok === true,
      `clearing the illness failed: ${(cleared as { message?: string }).message}`);
    const afterClear = quiet(() => generateProgramLocally(profile, {
      todayISO: NEXT_BLOCK_START,
      blockNumber: 2,
      previousProgram: useProgramStore.getState().currentProgram,
      seasonPhaseClock: program.seasonPhaseClock,
      microcycleLimit: 1,
    }));
    assert(afterClear.microcycles[0]?.exposureContractV2?.identity.mode !== 'illness_recovery',
      'the cleared fact still shapes the next block — residue across the boundary');
  });

  // ── T5 — exactly ONE duration representation. A static invariant: no
  // consumer may compute an effect window from anything but the fact's horizon
  // owner. Without this, the other four tests can be made green by teaching
  // each consumer the same new rule — which is adding a fifth representation,
  // not removing three (the "one more resolver" move the stop-patching trigger
  // names).
  scenario('t5', 'T5 exactly one duration representation: no consumer computes its own effect window', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const root = path.resolve(`${__dirname}/..`);

    /** The single owner. Every effect-window decision routes through it. */
    const OWNER = 'rules/durableFactHorizon.ts';
    assert(fs.existsSync(path.join(root, OWNER)),
      `the duration owner ${OWNER} does not exist — duration is still owned by whatever stamped the scope`);

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(full);
        }
      }
    };
    walk(root);

    // Reading the raw window bounds to DECIDE coverage is the fragmentation.
    // Only the owner (and the fact module that stores them) may do it.
    const ALLOWED = new Set([
      OWNER,
      'rules/temporarySourceFact.ts',
    ]);
    // `scope.from`/`scope.until` are the SAME two bounds under another name.
    // Omitting them is how a fifth consumer (`visibleReadinessState`, which
    // compared `scope.until` and so silently dropped every open fact, blanking
    // the readiness card) slipped past the first cut of this invariant.
    const comparison =
      /(effectiveFrom|effectiveUntil|scope\.from|scope\.until)\s*(<=|>=|<|>)|(<=|>=|<|>)\s*\w+\.(effectiveFrom|effectiveUntil|scope\.from|scope\.until)/;
    const offenders = files
      .map((file) => ({ rel: path.relative(root, file), src: fs.readFileSync(file, 'utf8') as string }))
      .filter(({ rel, src }) => !ALLOWED.has(rel) && comparison.test(src))
      .map(({ rel }) => rel);
    assert(offenders.length === 0,
      `${offenders.length} module(s) compare a fact's raw window instead of asking the horizon owner: ${offenders.join(', ')}`);

    // A durable STATE fact's duration must never be minted from a UI scope
    // string. `temporaryFactScope({kind:'week'})` may survive for genuinely
    // week-shaped things (equipment, schedule), but not for health facts.
    const controlSrc = fs.readFileSync(path.join(root, 'utils/programControlActions.ts'), 'utf8') as string;
    const healthScopeStamp =
      /createTemporary(Illness|Fatigue|PoorSleep|Soreness)Fact\(\{[\s\S]{0,400}?temporaryFactScope\(\{\s*kind:\s*[^)]*'week'/;
    assert(!healthScopeStamp.test(controlSrc),
      'a durable health fact still mints its duration from temporaryFactScope({kind:"week"}) — the UI scope string still owns duration');
  });

}

/** One scenario, in this process. */
async function runOne(id: string): Promise<void> {
  registerScenarios();
  const target = scenarios.find((entry) => entry.id === id);
  if (!target) {
    console.error(`unknown scenario id: ${id}`);
    process.exit(2);
  }
  await run(target.name, target.body);
  if (failures.length > 0) process.exit(1);
}

/**
 * Fork one child per scenario. Each child gets a virgin module registry and a
 * virgin store, which is the only way `spent-week-friday` can be installed
 * more than once in a run.
 */
function runAllForked(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { spawnSync } = require('child_process');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // Re-enter through sucrase-node explicitly: `process.argv` has already been
  // rewritten to point at this .ts file, so re-spawning it under bare node
  // would lose the compile hook.
  const runner = path.resolve(`${__dirname}/../../node_modules/sucrase/bin/sucrase-node`);
  registerScenarios();
  console.log('\n── Stage 1: durable fact horizon ownership (T1–T5) ──');
  let failed = 0;
  for (const entry of scenarios) {
    const child = spawnSync(process.argv[0], [runner, __filename], {
      env: { ...process.env, HORIZON_ONLY: entry.id, TZ: 'Australia/Melbourne' },
      encoding: 'utf8',
    });
    const output = `${child.stdout ?? ''}${child.stderr ?? ''}`
      .split('\n')
      .filter((line) => /^\s+(PASS|FAIL) \[invariant\]/.test(line))
      .join('\n');
    console.log(output || `  FAIL [invariant] ${entry.name}: scenario produced no verdict\n${child.stderr ?? ''}`);
    if (child.status !== 0) failed += 1;
  }
  console.log(`\n${scenarios.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

async function main(): Promise<void> {
  const only = process.env.HORIZON_ONLY;
  if (only) { await runOne(only); return; }
  runAllForked();
}

/**
 * Test-local reader for "is this fact in effect during that week?".
 *
 * It deliberately delegates to the Stage 1 owner when the owner exists, and
 * falls back to the raw bounds otherwise, so this file states the invariant
 * without itself becoming a sixth representation of it.
 */
function factHorizonCoversWeek(fact: TemporarySourceFact, weekStartISO: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const owner = require('../rules/durableFactHorizon');
    if (typeof owner.factHorizonCoversWeek === 'function') {
      return owner.factHorizonCoversWeek(fact, weekStartISO) as boolean;
    }
  } catch {
    // Owner not built yet — fall through to the raw bounds, which is exactly
    // what makes T2 red today.
  }
  if (isInjurySourceFact(fact)) return fact.affectedWeeks.includes(weekStartISO);
  const weekEnd = addDaysISO(weekStartISO, 6);
  return fact.effectiveFrom <= weekEnd && fact.effectiveUntil >= weekStartISO;
}

main().catch((error) => { console.error(error); process.exit(1); });
