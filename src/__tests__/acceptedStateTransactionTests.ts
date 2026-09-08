import { calendarActionsForTest } from './support/calendarActionsForTest';
import { rebuildLocalWeek } from './support/rebuildWeekForTest';
/**
 * Accepted-state transaction ownership — Section 18 systemic regressions.
 *
 * This suite deliberately drives the production stores/coordinators. It keeps
 * the requested fixed regressions separate from broader properties and
 * source-boundary mutation witnesses so the completion total cannot drift.
 *
 * THE COUNT IS 17 / 7 / 8, and every step down is recorded rather than absorbed:
 * originally 25 regressions; 18-19 (Repeat Week's own publish/rollback
 * behaviour) retired with the feature under HOME_SCREEN_REDESIGN ruling 1,
 * leaving 23; then 10-15 deleted on 2026-08-14 with the legacy hydration
 * migration that was their only subject, along with 3 properties and 2 mutation
 * witnesses. The deleted cells are named where they stood.
 *
 * Run: npm run test:accepted-state-transactions
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
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — accepted-state transactions must be local');
};
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync } from 'fs';
import path from 'path';
import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  useProgramStore,
} from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { buildReadinessSignalPatch, type ReadinessSignal } from '../utils/readiness';
import { buildReadinessActiveConstraints, buildPoorSleepReadinessConstraint } from '../utils/readinessConstraints';
import {
  assertAcceptedVisibleLedgerEquivalence,
  commitAcceptedStateTransaction,
  commitReadinessSignalTransaction,
  getAcceptedMaterialContext,
  takeAcceptedWeekShortfallDisclosure,
} from '../store/acceptedStateTransaction';
import {
  createTemporaryFatigueFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import {
  resolveFinalVisibleSection18Week,
} from '../rules/section18AcceptedWeekGateway';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import {
  buildWeekScopedWorkoutOverlay,
} from '../utils/weekRebuild';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import { addDaysISO } from '../utils/programBlockState';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildDayWorkoutProjectedDay } from '../utils/visibleProgramReadModel';
import { emptyEvaluationSurfaces } from './evaluationSurfacesTestSupport';

const WEEK_START = '2026-07-13';
const WEDNESDAY = '2026-07-15';
const SATURDAY = '2026-07-18';
const SUNDAY = '2026-07-19';
const NEXT_WEEK = '2026-07-20';
const NOW = '2026-07-13T00:00:00.000Z';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]')) return;
  originalWarn(...args);
};

let regressionPass = 0;
let propertyPass = 0;
let mutationPass = 0;
const failures: string[] = [];
const tests: Array<{
  kind: 'regression' | 'property' | 'mutation';
  name: string;
  body: () => void | Promise<void>;
}> = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(
  kind: 'regression' | 'property' | 'mutation',
  name: string,
  body: () => void | Promise<void>,
): void {
  tests.push({ kind, name, body });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function profile(
  phase: NonNullable<OnboardingData['seasonPhase']>,
  overrides: Partial<OnboardingData> = {},
): OnboardingData {
  return {
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: phase,
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    ...overrides,
  };
}

function generate(value: OnboardingData, start = WEEK_START): TrainingProgram {
  return quiet(() => generateProgramLocally(value, {
    todayISO: start,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: value.seasonPhase!,
      phaseEntryWeekStartISO: start,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  }));
}

function emptyAcceptedContext() {
  return {
    injuryEpisodes: [], temporarySourceFacts: [], acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    markedDays: {},
    readinessSignalsByDate: {},
    activeConstraints: [],
    revision: 0,
    lastTransaction: null,
  };
}

function resetStores(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: emptyAcceptedContext(),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({ acceptedMaterialContext: emptyAcceptedContext() });
}

function seed(value: OnboardingData, start = WEEK_START): TrainingProgram {
  resetStores();
  useProfileStore.setState({ onboardingData: value });
  const program = generate(value, start);
  useProgramStore.getState().setCurrentProgram(program);
  return useProgramStore.getState().currentProgram!;
}

function mondayFor(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function dateForDay(weekStart: string, dayOfWeek: number): string {
  return addDaysISO(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
}

function acceptedWeek(weekStart: string) {
  const state = useProgramStore.getState();
  const overlay = state.weekScopedOverlays[weekStart];
  const microcycle = state.currentProgram?.microcycles.find((candidate) =>
    weekStart >= candidate.startDate.slice(0, 10) &&
    weekStart <= candidate.endDate.slice(0, 10)) ?? null;
  const contract = overlay?.exposureContractV2 ?? microcycle?.exposureContractV2;
  assert(contract, `missing Contract v2 for ${weekStart}`);
  const workouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(weekStart, offset);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const manual = state.dateOverrides[date];
    const hasOverlay = !!overlay && Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date);
    const workout = manual ?? (
      hasOverlay
        ? overlay!.workoutsByDate[date]
        : microcycle?.workouts.find((candidate) => candidate.dayOfWeek === dayOfWeek) ?? null
    );
    if (workout) workouts.push(workout);
  }
  const visible = resolveFinalVisibleSection18Week({
    surfaces: emptyEvaluationSurfaces(),
    contract,
    workouts,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    scheduleState: { markedDays: getAcceptedMaterialContext().markedDays },
  });
  return {
    contract,
    visible,
    evaluation: evaluateSection18EffectiveWeek({ contract, workouts: visible, weekStart }),
  };
}

function projectedDay(date: string) {
  return buildDayWorkoutProjectedDay({
    date,
    todayISO: WEEK_START,
    state: buildScheduleStateImperative(),
    overrideContext: useProgramStore.getState().overrideContexts[date],
  });
}

async function createCanonicalReadinessFact(
  kind: 'fatigue',
  date: string,
  expectAccepted = true,
): Promise<Awaited<ReturnType<typeof transactTemporarySourceFact>>> {
  const scope = temporaryFactScope({ kind: 'date', date });
  const fact = createTemporaryFatigueFact({
    observedDate: date, scope, athleteReportedLevel: 'cooked',
    sourceSurface: 'test', now: NOW,
  });
  const result = await transactTemporarySourceFact({
    operation: 'create',
    fact,
    todayISO: date,
    now: NOW,
  });
  if (expectAccepted) {
    assert(result.outcome === 'created_and_recomposed' ||
      result.outcome === 'created_no_program_change', `source fact was not accepted: ${result.outcome}`);
  }
  return result;
}

function materialSignature(): string {
  const state = useProgramStore.getState();
  return JSON.stringify({
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    blockState: state.blockState,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
    exposureContractsByWeek: state.exposureContractsByWeek,
    acceptedMaterialContext: state.acceptedMaterialContext,
    calendar: useCalendarStore.getState().markedDays,
    readiness: useReadinessStore.getState().signalsByDate,
    constraints: useCoachUpdatesStore.getState().activeConstraints,
  });
}

function ledgerSignature(contract: ReturnType<typeof acceptedWeek>['contract']): string {
  return JSON.stringify({
    strength: contract.mainStrength.exposure.achievedCount,
    patterns: contract.strengthPatterns.achievedMeaningfulMainLifts,
    conditioning: contract.conditioning.core.achievedCount,
    optionalFlush: contract.conditioning.optionalFlush.achievedCount,
    optionalRecovery: contract.conditioning.optionalRecoveryAerobic.achievedCount,
    stress: contract.conditioning.achievedByStress,
    anchorCredit: contract.conditioning.anchorCredit,
    appCredit: contract.conditioning.appAuthoredCoreCredit,
    sprint: contract.sprintHighSpeed.exposure.achievedCount,
    sprintSources: contract.sprintHighSpeed.achievedSources,
    power: contract.power.achievedPrimerCount,
    rest: contract.restStress.achievedTrueFullRestCount,
    recovery: contract.restStress.achievedActiveRecoveryCount,
    moderate: contract.restStress.achievedModerateDayCount,
    hard: contract.restStress.achievedHardDayCount,
  });
}

function withGatewayFailure(body: () => void): boolean {
  // BOTH gateway entry points, since Sam's ownership collapse (2026-07-29).
  // `requireSection18AcceptedWeek` is no longer "the final gateway every
  // accepted path reaches" — the transaction owner now calls the non-throwing
  // `runSection18AcceptedWeekGateway` so a rejected week is a typed RESULT it
  // can accept-and-reduce rather than an exception thrown past it. An injection
  // that only stubs the throwing wrapper stops reaching the owner's path, and
  // this regression then reports that the failure "did not reach" a gateway it
  // simply no longer goes through. The injection follows the owner.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gateway = require('../rules/section18AcceptedWeekGateway') as Record<string, unknown>;
  const restore = injectGatewayFailure(gateway);
  try {
    body();
    return false;
  } catch (error) {
    return String(error).includes('INJECTED_ACCEPTANCE_FAILURE');
  } finally {
    restore();
  }
}

/**
 * Stub EVERY gateway entry point, because the owner keeps moving and the
 * injection must follow it. Twice now this helper has reported "the failure did
 * not reach the gateway" when the failure reached fine and the GATEWAY had
 * changed underneath it:
 *
 *   • Sam's ownership collapse (2026-07-29) moved the transaction owner off the
 *     throwing wrapper onto `runSection18AcceptedWeekGateway`, so a rejected
 *     week became a typed result it could accept-and-reduce.
 *   • The §18 ownership reassessment (2026-08-05, D3) moved GENERATION onto
 *     `acceptSection18Week`, which routes by operation: a restoration throws, a
 *     forward athlete decision publishes the best achievable week. A gate must
 *     never veto a fact.
 *
 * Stubbing all three keeps these regressions about what they claim to be about
 * — ATOMICITY, that a failure anywhere in acceptance commits no surface — and
 * not about which function currently holds the decision. The injected error is
 * a plain `Error`, so it is fatal under every operation and the atomicity claim
 * stays sharp regardless of who is asking.
 */
function injectGatewayFailure(
  gateway: Record<string, unknown>,
  onCall?: () => void,
): () => void {
  const names = [
    'requireSection18AcceptedWeek',
    'runSection18AcceptedWeekGateway',
    'acceptSection18Week',
  ] as const;
  const originals = names.map((name) => [name, gateway[name]] as const);
  const inject = () => {
    onCall?.();
    throw new Error('INJECTED_ACCEPTANCE_FAILURE');
  };
  for (const name of names) gateway[name] = inject;
  return () => { for (const [name, original] of originals) gateway[name] = original; };
}

async function withGatewayFailureAsync(body: () => Promise<void>): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gateway = require('../rules/section18AcceptedWeekGateway') as Record<string, unknown>;
  let called = false;
  const restore = injectGatewayFailure(gateway, () => { called = true; });
  try {
    await body();
    return called;
  } finally {
    restore();
  }
}

/**
 * `stripContracts` AND `migrated` STOOD HERE AND ARE DELETED (2026-08-14).
 *
 * They existed only to feed the legacy contract-derivation path: strip a
 * generated program's Contract v2 down to nothing, hand it to
 * `canonicaliseHydratedProgram`, and watch `deriveContractlessLegacyContract`
 * mint a `source: 'legacy_migration'` contract back. That whole pipeline is
 * gone, and it is gone because no launch could reach it —
 * `programStore.partialize` persists INPUTS only, so a stored program is never
 * read back and a contractless stored week cannot exist to be repaired. The
 * seven cells that used these helpers went with them; the accept path's own
 * refusal of a contractless week (`AcceptedProgramContractMissingError`) is a
 * different, live subject with its own owner.
 */

function placeholderOverlay(weekStart: string): WeekScopedWorkoutOverlay {
  return {
    id: `future-placeholder:${weekStart}`,
    weekStart,
    weekEnd: addDaysISO(weekStart, 6),
    anchorDate: null,
    reason: 'one_off_no_game',
    workoutsByDate: {},
    createdAt: NOW,
    updatedAt: NOW,
  };
}

run('regression', '1 adding a game mark regenerates and gates the target game week', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  calendarActionsForTest().setGameDay(WEDNESDAY);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().markedDays[WEDNESDAY] === 'game', 'accepted mark missing');
  assert(week.contract.identity.mode === 'in_season_game_week', 'game table was not selected');
  assert(week.contract.anchors.some((anchor) => anchor.kind === 'game' && anchor.dayOfWeek === 3),
    'Wednesday game anchor missing');
  assert(week.evaluation.blockingViolations.length === 0, 'game week has blockers');
});

run('regression', '2 removing a game mark removes credit and resolves bye policy', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  calendarActionsForTest().setGameDay(WEDNESDAY);
  calendarActionsForTest().removeGameDay(WEDNESDAY);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().markedDays[SATURDAY] === 'noGame', 'recurring game was not suppressed');
  assert(week.contract.identity.mode.startsWith('in_season_bye'), 'bye table was not selected');
  assert(!week.contract.anchors.some((anchor) => anchor.kind === 'game'), 'stale game credit survived');
  assert(week.evaluation.ledger.conditioning.anchorCoreCount === 0, 'removed game still has conditioning credit');
});

run('regression', '3 adding a rest mark cannot silently remove required core work', () => {
  seed(profile('Pre-season'));
  const before = acceptedWeek(WEEK_START);
  const core = before.visible.find((workout) => {
    const role = workout.section18Evidence?.conditioningRole ?? workout.section18ConditioningRole;
    return role === 'core' || role === 'required_core' || role === 'planner_selected_core';
  });
  assert(core, 'no core session available for rest mutation');
  const date = dateForDay(WEEK_START, core.dayOfWeek);
  const prior = materialSignature();
  let rejected = false;
  try {
    calendarActionsForTest().setRestDay(date);
  } catch {
    rejected = true;
  }
  if (rejected) {
    assert(materialSignature() === prior, 'rejected rest mark partially committed');
    assert(getAcceptedMaterialContext().markedDays[date] === undefined, 'rejected rest mark became visible');
  } else {
    const after = acceptedWeek(WEEK_START);
    assert(getAcceptedMaterialContext().markedDays[date] === 'rest', 'rest mark did not commit');
    // RE-POINTED at the new owner, not weakened — Sam's accept-and-reduce
    // ruling (2026-07-29). The word this regression has always turned on is
    // SILENTLY. It used to enforce silence by forbidding the loss outright,
    // which under the ruling is the second-worst answer: a rest mark is the
    // athlete stating a fact about their life, and the app does not refuse
    // facts. So the mark commits, and what must hold is that the athlete is
    // TOLD.
    //
    // Either the week still meets its contract, or it does not and the
    // shortfall is disclosed in Sam's signed words. What is still forbidden,
    // and is the whole point of the regression, is losing the work with
    // nothing said.
    const disclosure = takeAcceptedWeekShortfallDisclosure(WEEK_START);
    const wholeWeek =
      after.evaluation.ledger.conditioning.coreCount >= after.contract.conditioning.core.requiredMinimum &&
      after.evaluation.blockingViolations.length === 0;
    assert(wholeWeek || disclosure,
      'required core work was SILENTLY lost — the week is short and nothing was disclosed');
    if (disclosure) {
      assert(/means you'll miss/.test(disclosure),
        `the shortfall disclosure is not Sam's signed sentence: "${disclosure}"`);
      assert(!/exposure/i.test(disclosure),
        `"exposure" reached the athlete: "${disclosure}"`);
    }
  }
});

run('regression', '4 removing a rest mark cannot create a hard-day or rest breach', () => {
  seed(profile('Off-season'));
  const date = '2026-07-16';
  calendarActionsForTest().setRestDay(date);
  calendarActionsForTest().removeRestDay(date);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().markedDays[date] === undefined, 'rest mark survived removal');
  assert(week.evaluation.blockingViolations.length === 0, 'rest removal created a blocker');
  assert((week.contract.restStress.hardDayMaximumBreach ?? 0) === 0, 'hard-day maximum breached');
});

run('regression', '5 practice-match calendar changes use the approved PM table', () => {
  seed(profile('Pre-season'));
  calendarActionsForTest().setGameDay(SATURDAY);
  const withPracticeMatch = acceptedWeek(WEEK_START);
  assert(withPracticeMatch.contract.identity.mode === 'practice_match_week', 'practice-match table not selected');
  assert(withPracticeMatch.contract.identity.anchorState === 'practice_match', 'practice-match identity missing');
  assert(withPracticeMatch.contract.anchors.some((anchor) => anchor.kind === 'practice_match'), 'PM anchor missing');
  calendarActionsForTest().removeGameDay(SATURDAY);
  const withoutPracticeMatch = acceptedWeek(WEEK_START);
  assert(withoutPracticeMatch.contract.identity.mode !== 'practice_match_week',
    'removed practice match retained the PM table');
  assert(!withoutPracticeMatch.contract.anchors.some((anchor) => anchor.kind === 'practice_match'),
    'removed practice match retained anchor credit');
});

run('regression', '6 a future calendar mark is gated when it becomes material', () => {
  const value = profile('Pre-season');
  seed(value);
  const futureGame = '2026-08-15';
  calendarActionsForTest().setGameDay(futureGame);
  assert(!useProgramStore.getState().weekScopedOverlays[mondayFor(futureGame)],
    'unmaterialised future mark published an overlay early');
  rolloverProgramBlock({ baseProfile: value, targetDateISO: '2026-08-10' });
  const week = acceptedWeek('2026-08-10');
  assert(week.contract.identity.mode === 'practice_match_week', 'future mark was not activated as PM');
  assert(week.evaluation.blockingViolations.length === 0, 'activated future mark has blockers');
});

run('regression', '7 low readiness commits a canonical fact and reduced visible program together', async () => {
  seed(profile('Pre-season'));
  const before = acceptedWeek(WEEK_START);
  const powerDay = before.visible.find((workout) => !!workout.powerBlock)?.dayOfWeek ?? 1;
  const date = dateForDay(WEEK_START, powerDay);
  await createCanonicalReadinessFact('fatigue', date);
  const after = acceptedWeek(WEEK_START);
  const visibleDay = projectedDay(date).workout;
  assert(!!getAcceptedMaterialContext().readinessSignalsByDate[date], 'accepted readiness missing');
  assert(!!useReadinessStore.getState().signalsByDate[date], 'readiness mirror missing');
  // RE-POINTED (Sam, 2026-07-27). This asserted `!visibleDay?.powerBlock` —
  // that low readiness DELETED the day's power block. The deload law retired
  // that outright: "Power/speed: keep a small sharp dose ... a deload is not a
  // reason to lose sharpness." Safety scenario 4 and property P2b now assert the
  // opposite, so this was the last site still pinning the superseded rule.
  //
  // It passed only because the day had been emptied by a different defect: an
  // optional week zeroed its structural counts, so every session was replaced
  // by recovery work and the power block disappeared along with the session
  // carrying it. With the sessions restored, the contradiction surfaced.
  //
  // What the regression is FOR is unchanged — a canonical fact and a REDUCED
  // visible program commit together — so that is what it now asserts: the day
  // is still offered, and its dose shrank.
  const beforeDay = before.visible.find((workout) => workout.dayOfWeek === powerDay);
  const sets = (workout: typeof beforeDay): number =>
    (workout?.exercises ?? []).reduce((total, row) => total + (row.prescribedSets ?? 0), 0);
  assert(!!visibleDay, 'low readiness deleted the affected day instead of deloading it');
  assert(sets(visibleDay as typeof beforeDay) < sets(beforeDay),
    `the affected day was not deloaded: ${sets(visibleDay as typeof beforeDay)} sets vs ${sets(beforeDay)} before`);
  assert(after.evaluation.blockingViolations.length === 0, 'readiness-reduced week has blockers');
});

run('regression', '8 a failed readiness source-fact projection commits neither surface', async () => {
  seed(profile('Pre-season'));
  const before = materialSignature();
  let result: Awaited<ReturnType<typeof transactTemporarySourceFact>> | null = null;
  const failed = await withGatewayFailureAsync(async () => {
    result = await createCanonicalReadinessFact('fatigue', WEDNESDAY, false);
  });
  assert(failed, 'failure injection did not reach readiness gateway');
  assert(result?.outcome === 'safely_rejected', 'failed readiness fact was not safely rejected');
  assert(materialSignature() === before, 'failed readiness changed accepted or mirror state');
});

run('regression', '9 canonical readiness projection retains persisted accepted-ledger equivalence', async () => {
  seed(profile('Pre-season'));
  await createCanonicalReadinessFact('fatigue', WEDNESDAY);
  const week = acceptedWeek(WEEK_START);
  assert(getAcceptedMaterialContext().temporarySourceFacts.length === 1,
    'canonical readiness fact missing');
  assert(ledgerSignature(week.contract) === ledgerSignature(week.evaluation.contract),
    'visible readiness ledger differs from persisted accepted ledger');
  resetStores();
});

/**
 * REGRESSIONS 10-15 STOOD HERE AND ARE DELETED (2026-08-14), NOT WEAKENED.
 *
 *   10 contractless legacy in-season derives a conservative v2 contract
 *   11 contractless legacy off-season week is gated
 *   12 contractless legacy pre-season week is gated
 *   13 legacy unknown anchors remain uncredited
 *   14 an unrepairable legacy week returns a typed migration failure
 *   15 repeated hydration is deterministic and idempotent
 *
 * ALL SIX HAD THE SAME SUBJECT: the legacy structural migration that ran when a
 * STORED program was read back — `canonicaliseHydratedState` /
 * `canonicaliseHydratedProgram`, `deriveContractlessLegacyContract`, and the
 * typed `Section18LegacyMigrationError` it threw. That pipeline was deleted
 * because it was provably unreachable: `programStore.partialize` persists INPUTS
 * only, `currentProgram` and `currentMicrocycle` are never written to disk, and
 * every boot regenerates the week through `quiescentBoot`. There is no stored
 * program to migrate, so there is nothing these four could observe.
 *
 * WHY NOT REWIRE THEM. Each one asserted a PROPERTY OF THE MIGRATION — that it
 * minted a contract, that the contract it minted carried `unknown`
 * participation, that it failed typed rather than silently, that running it
 * twice changed nothing. Re-pointing those at the live accept boundary would not
 * have been the same claim: that boundary REFUSES a contractless week by name
 * (`AcceptedProgramContractMissingError`) rather than repairing it, which is a
 * different ruling with its own cells. Writing new claims under old names is how
 * a suite comes to describe a build nobody has.
 *
 * The regression count drops 23 -> 17 in the totals line, stated there too.
 */

run('regression', '16 rebuild publishes calendar, program and overlays once', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  let programPublishes = 0;
  let calendarPublishes = 0;
  const stopProgram = useProgramStore.subscribe(() => { programPublishes += 1; });
  const stopCalendar = useCalendarStore.subscribe(() => { calendarPublishes += 1; });
  rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Wednesday',
    scope: 'weekOverlay',
    targetDate: WEDNESDAY,
    manageCalendarFixture: true,
  });
  stopProgram();
  stopCalendar();
  assert(programPublishes === 1, `rebuild published ProgramStore ${programPublishes} times`);
  assert(calendarPublishes === 1, `rebuild published calendar mirror ${calendarPublishes} times`);
  assert(!!useProgramStore.getState().weekScopedOverlays[WEEK_START], 'rebuild overlay missing');
});

run('regression', '17 rebuild failure preserves all prior surfaces', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  const before = materialSignature();
  const failed = withGatewayFailure(() => rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Wednesday',
    scope: 'weekOverlay',
    targetDate: WEDNESDAY,
    manageCalendarFixture: true,
  }));
  assert(failed, 'failure injection did not reach rebuild gateway');
  assert(materialSignature() === before, 'failed rebuild partially published state');
});

run('regression', '20 rollover restores all future overlays atomically', () => {
  const value = profile('Off-season');
  seed(value, '2026-06-08');
  const overlays = {
    '2026-07-06': placeholderOverlay('2026-07-06'),
    '2026-07-13': placeholderOverlay('2026-07-13'),
  };
  useProgramStore.setState({ weekScopedOverlays: overlays });
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  const result = rolloverProgramBlock({ baseProfile: value, targetDateISO: '2026-07-06' });
  stop();
  assert(result.rolledOver, 'rollover did not run');
  assert(publishes === 1, `rollover published ${publishes} times`);
  assert(Object.keys(useProgramStore.getState().weekScopedOverlays).length === 2,
    'rollover restored only some future overlays');
});

run('regression', '21 an invalid restored overlay is regenerated inside one rollover commit', () => {
  const value = profile('Pre-season');
  seed(value, '2026-06-08');
  const future = generate(value, '2026-07-06');
  const source = future.microcycles[1];
  const invalid: WeekScopedWorkoutOverlay = {
    ...buildWeekScopedWorkoutOverlay({
      program: { ...future, microcycles: [source] },
      weekStart: '2026-07-13',
      anchorDate: null,
      reason: 'one_off_no_game',
    }),
    workoutsByDate: Object.fromEntries(
      Array.from({ length: 7 }, (_, offset) => [addDaysISO('2026-07-13', offset), null]),
    ),
  };
  useProgramStore.setState({
    weekScopedOverlays: {
      '2026-07-06': placeholderOverlay('2026-07-06'),
      '2026-07-13': invalid,
    },
  });
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  const result = rolloverProgramBlock({ baseProfile: value, targetDateISO: '2026-07-06' });
  stop();
  const restored = useProgramStore.getState().weekScopedOverlays['2026-07-13'];
  assert(result.rolledOver, 'rollover did not run');
  assert(publishes === 1, `rollover published ${publishes} times`);
  assert(Object.values(restored?.workoutsByDate ?? {}).some(Boolean),
    'invalid overlay was not regenerated through the whole-week gateway');
});

run('regression', '22 constraint/program transaction has no observable intermediate state', () => {
  seed(profile('Pre-season'));
  // Surviving input; the assertion remains about atomic publication.
  const constraint = buildPoorSleepReadinessConstraint({date:WEDNESDAY,pattern:'repeated',nowISO:NOW});
  assert(!!constraint, 'the transaction witness must reach a real constraint');
  let badObservation = false;
  let programPublishes = 0;
  const stopProgram = useProgramStore.subscribe((state) => {
    programPublishes += 1;
    if (!state.acceptedMaterialContext.activeConstraints.some((candidate) => candidate.id === constraint.id)) {
      badObservation = true;
    }
  });
  const stopCoach = useCoachUpdatesStore.subscribe((state) => {
    if (state.activeConstraints.some((candidate) => candidate.id === constraint.id) &&
        !getAcceptedMaterialContext().activeConstraints.some((candidate) => candidate.id === constraint.id)) {
      badObservation = true;
    }
  });
  try {
    useCoachUpdatesStore.getState().setActiveConstraints([constraint]);
  } finally {
    stopProgram();
    stopCoach();
  }
  assert(programPublishes === 1, `constraint transaction published ProgramStore ${programPublishes} times`);
  assert(!badObservation, 'subscriber observed new constraint with old accepted program context');
});

run('regression', '23 calendar/program transaction has no observable intermediate state', () => {
  seed(profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' }));
  let badObservation = false;
  let programPublishes = 0;
  const stopProgram = useProgramStore.subscribe((state) => {
    programPublishes += 1;
    const mark = state.acceptedMaterialContext.markedDays[WEDNESDAY];
    const contract = state.weekScopedOverlays[WEEK_START]?.exposureContractV2;
    if (mark === 'game' && contract?.identity.mode !== 'in_season_game_week') badObservation = true;
  });
  const stopCalendar = useCalendarStore.subscribe((state) => {
    if (state.markedDays[WEDNESDAY] === 'game' &&
        getAcceptedMaterialContext().markedDays[WEDNESDAY] !== 'game') badObservation = true;
  });
  calendarActionsForTest().setGameDay(WEDNESDAY);
  stopProgram();
  stopCalendar();
  assert(programPublishes === 1, `calendar transaction published ProgramStore ${programPublishes} times`);
  assert(!badObservation, 'subscriber observed new mark with old contract');
});

run('regression', '24 readiness source-fact/program transaction has no observable intermediate state', async () => {
  seed(profile('Pre-season'));
  const fact = createTemporaryFatigueFact({
    observedDate: WEDNESDAY,
    scope: temporaryFactScope({ kind: 'date', date: WEDNESDAY }),
    athleteReportedLevel: 'slight',
    sourceSurface: 'test',
    now: NOW,
  });
  let badObservation = false;
  let programPublishes = 0;
  const stopProgram = useProgramStore.subscribe((state) => {
    const hasFact = state.acceptedMaterialContext.temporarySourceFacts.some((candidate) =>
      'factId' in candidate && candidate.factId === fact.factId);
    if (!hasFact) return;
    programPublishes += 1;
    if (!state.acceptedMaterialContext.readinessSignalsByDate[WEDNESDAY]) {
      badObservation = true;
    }
  });
  const stopReadiness = useReadinessStore.subscribe((state) => {
    if (state.signalsByDate[WEDNESDAY] &&
        !getAcceptedMaterialContext().readinessSignalsByDate[WEDNESDAY]) badObservation = true;
  });
  await transactTemporarySourceFact({
    operation: 'create',
    fact,
    todayISO: WEDNESDAY,
    now: NOW,
  });
  stopProgram();
  stopReadiness();
  assert(programPublishes === 1, `readiness transaction published ProgramStore ${programPublishes} times`);
  assert(!badObservation, 'subscriber observed new readiness with old accepted program context');
});

run('regression', '25 re-evaluated visible week matches the gateway ledger exactly', () => {
  const value = profile('Pre-season');
  seed(value);
  calendarActionsForTest().setGameDay(SATURDAY);
  const week = acceptedWeek(WEEK_START);
  assert(ledgerSignature(week.contract) === ledgerSignature(week.evaluation.contract),
    're-evaluated visible ledger is not exact');
  assertAcceptedVisibleLedgerEquivalence({
    operation: 'forward_decision',
    surfaces: useProgramStore.getState(),
    context: getAcceptedMaterialContext(),
    weekStarts: [WEEK_START],
    profile: value,
  });
});

run('property', 'no calendar mutation can bypass the gateway', () => {
  const value = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  seed(value);
  const actions = [
    () => calendarActionsForTest().setGameDay(WEDNESDAY),
    () => calendarActionsForTest().removeGameDay(WEDNESDAY),
    () => calendarActionsForTest().removeNoGame(SATURDAY),
    () => calendarActionsForTest().setRestDay('2026-07-16'),
    () => calendarActionsForTest().removeRestDay('2026-07-16'),
  ];
  for (const action of actions) {
    const before = materialSignature();
    try {
      action();
    } catch {
      assert(materialSignature() === before,
        'rejected calendar mutation changed an accepted-state surface');
      continue;
    }
    assertAcceptedVisibleLedgerEquivalence({
      operation: 'forward_decision',
      surfaces: useProgramStore.getState(), context: getAcceptedMaterialContext(),
      weekStarts: [WEEK_START], profile: value,
    });
  }
});

run('property', 'no structural readiness change can bypass the gateway', async () => {
  const value = profile('Pre-season');
  for (const option of ['flat', 'good'] as const) {
    seed(value);
    if (option === 'flat') {
      await createCanonicalReadinessFact('fatigue', WEDNESDAY);
    } else {
      commitReadinessSignalTransaction({
        date: WEDNESDAY,
        patch: option === 'good' ? null : buildReadinessSignalPatch(option),
      });
    }
    assertAcceptedVisibleLedgerEquivalence({
      operation: 'forward_decision',
      surfaces: useProgramStore.getState(), context: getAcceptedMaterialContext(),
      weekStarts: [WEEK_START], profile: value,
    });
  }
});

// PROPERTY DELETED (2026-08-14): 'no contractless material week persists
// without accepted Contract v2'. Its only mechanism was the legacy migration
// minting a contract for a stripped week at hydration. That pipeline is gone —
// nothing reads a stored program back — and the live boundary REFUSES a
// contractless week rather than minting one, which is a different claim.

run('property', 'multi-store operations publish complete old or complete new state', () => {
  seed(profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' }));
  const observed: string[] = [];
  const stop = useProgramStore.subscribe((state) => observed.push(JSON.stringify({
    mark: state.acceptedMaterialContext.markedDays[WEDNESDAY],
    mode: state.weekScopedOverlays[WEEK_START]?.exposureContractV2?.identity.mode,
  })));
  calendarActionsForTest().setGameDay(WEDNESDAY);
  stop();
  assert(observed.length === 1, 'multi-store operation published an intermediate ProgramStore state');
  assert(observed[0] === JSON.stringify({ mark: 'game', mode: 'in_season_game_week' }),
    `published snapshot was incomplete: ${observed[0]}`);
});

run('property', 'failed transactions preserve every prior state surface', () => {
  seed(profile('Pre-season'));
  const before = materialSignature();
  const failed = withGatewayFailure(() => commitAcceptedStateTransaction({
    // Harness seed: installs a world, never restores one.
    operation: 'forward_decision',
    reason: 'property:forced_failure',
    readinessSignalsByDate: {
      [WEDNESDAY]: {
        date: WEDNESDAY, source: 'quick_check', updatedAt: NOW,
        ...buildReadinessSignalPatch('flat'),
      },
    },
    markedDays: { [SATURDAY]: 'game' },
    validateWeekStarts: [WEEK_START],
  }));
  assert(failed, 'forced failure did not reach gateway');
  assert(materialSignature() === before, 'failed staged transaction changed a surface');
});

run('property', 'visible projection is ledger-equivalent to gateway acceptance', () => {
  for (const phase of ['In-season', 'Off-season', 'Pre-season'] as const) {
    const value = profile(phase);
    seed(value);
    assertAcceptedVisibleLedgerEquivalence({
      operation: 'forward_decision',
      surfaces: useProgramStore.getState(), context: getAcceptedMaterialContext(),
      weekStarts: [WEEK_START], profile: value,
    });
  }
});

// TWO MORE PROPERTIES DELETED (2026-08-14), for the same reason and no other:
//   'unknown legacy participation never gains anchor credit'
//   'hydration remains deterministic and idempotent'
// Both drove `migrated()` — strip a week's contract, let the legacy migration
// rebuild it — and both were assertions ABOUT that migration. It is deleted and
// unreachable, so they have no subject. The surviving half of the first claim,
// that an `unknown` anchor earns no core credit, is owned by the evaluator and
// is still held in `section18AcceptedWeekGatewayTests` (P14, M14).

/**
 * THE RULING MOVED, AND THIS CELL MOVED WITH IT — stated out loud rather than
 * quietly flipped (R5.3 V3 switchover, 2026-08-06; supersedes the publication
 * shape this property pinned since the rolling-horizon owner landed).
 *
 * It used to assert the fixture door publishes an overlay for the week it
 * decides. Leg (i) of the switchover deletes exactly that: a fixture decision's
 * durable effect is the life-fact plus the ledger entry, and the week that
 * expresses it is DERIVED. So the assertion INVERTS.
 *
 * The other two claims did NOT move, and keeping them is what makes this an
 * inversion rather than a deletion: the publication is still ONE atomic state,
 * and the DEPENDENT week is still repaired and still carries its cross-week
 * provenance. That pairing is deliberate and two-directional — an absent
 * overlay everywhere would satisfy the new claim while silently losing the
 * repair R5.3 condition 1(b) priced at fourteen athlete-deletion regressions.
 *
 * CORRECTED THE SAME DAY, ON MEASUREMENT (Sam,
 * `docs/FREED_DAY_RULING_CORRECTION_2026-08-06.md`). The inversion above went
 * one step too far: "no stored week at all" left the decided week judged
 * against the microcycle's STALE contract, and a cancelled game kept crediting
 * the week's conditioning. What is durable about a fixture decision is the
 * life-fact, the ledger entry AND the week's DECLARATION; only the sessions are
 * derived. So the decided week keeps an overlay carrying `exposureContractV2`
 * with an empty `workoutsByDate`, and the assertion below pins both halves.
 *
 * SCOPED TO THE WORLD IT DRIVES, and the name says so. This cell moves a
 * fixture (`clearOverlayDate` + a new day).
 *
 * It is NOT the general law, and regression 16 above is the counter-example
 * kept deliberately green: on the ADD path the decided week still carries an
 * overlay, byte-for-byte the same before and after leg (i), written from
 * inside the reversible-adjustment publication rather than by the door's
 * replan. What this unit proves is ONE COMPOSER — that any surviving stored
 * week EQUALS the derived one (`fixtureIdentityTests` cells 3, 5 and 6, all
 * three red before it and green after) — not that no stored week remains.
 * The survivor is named, measured and carried as R5 debt; see
 * docs/R5_DELETION_SEQUENCE_2026-08-06.md (q).
 */
run('property', 'a fixture MOVE publishes its dependent week once and leaves the week it '
  + 'decided a DECLARATION with no content', () => {
  const value = profile('In-season', {
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });
  seed(value);
  let publishes = 0;
  const stop = useProgramStore.subscribe(() => { publishes += 1; });
  rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Sunday',
    scope: 'weekOverlay',
    targetDate: SUNDAY,
    clearOverlayDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK_START,
  });
  stop();
  const followingMonday = useProgramStore.getState().weekScopedOverlays[NEXT_WEEK]
    ?.workoutsByDate[NEXT_WEEK];
  assert(publishes === 1, `rolling fixture repair published ${publishes} states`);
  // RE-INVERTED, WITH THE DATED RULING THAT MOVED IT — Sam,
  // `docs/FREED_DAY_RULING_CORRECTION_2026-08-06.md`, on the measurement at
  // 11ba8cb7. This is the cell's THIRD statement in one day and that is said
  // out loud rather than quietly flipped a second time.
  //
  // It first asserted the door publishes an overlay for the week it decides.
  // Leg (i) inverted it to "no stored week at all" — and THAT was measured
  // wrong: with nothing published, the decided week was judged against the
  // microcycle's stale contract, so a cancelled game went on crediting the
  // week's conditioning (`section18EffectiveWeekEvaluator:526`) and §18
  // reported zero shortfall on a week that was a session short.
  //
  // The standing claim is the one that survived both moves: the door publishes
  // a DECLARATION, never CONTENT. An overlay may exist for the decided week —
  // it carries the contract derived from the athlete's current facts — but it
  // holds no workouts, because the sessions are derived. Both halves are
  // asserted so neither an absent overlay nor a re-composed one can pass.
  const decided = useProgramStore.getState().weekScopedOverlays[WEEK_START];
  assert(!!decided?.exposureContractV2,
    'the fixture MOVE published no contract for the week it decided — the decision\'s '
    + 'declaration is durable (no stored contract outlives a fixture decision), and '
    + 'without it the week is judged against the contract for the fixture it no longer has');
  assert(Object.keys(decided.workoutsByDate ?? {}).length === 0,
    `the fixture MOVE published stored CONTENT for the week it decided `
    + `(${Object.keys(decided.workoutsByDate ?? {}).join(', ')}) — the sessions are DERIVED, `
    + 'and a second composer is a second truth even when neither is wrong');
  assert(followingMonday?.derivedSessionProvenance?.some((record) =>
    record.dependency?.source.date === SUNDAY) === true,
  'following-week dependency was not committed in the same snapshot');
});

run('property', 'failed rolling fixture staging preserves the entire prior horizon', () => {
  const value = profile('In-season', {
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });
  seed(value);
  const before = materialSignature();
  const failed = withGatewayFailure(() => rebuildLocalWeek({
    baseProfile: value,
    newGameDay: 'Sunday',
    scope: 'weekOverlay',
    targetDate: SUNDAY,
    clearOverlayDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK_START,
  }));
  assert(failed, 'failure injection did not reach rolling gateway');
  assert(materialSignature() === before, 'failed rolling staging partially published a week');
});

const root = path.resolve(__dirname, '..');
const source = (relative: string): string => readFileSync(path.join(root, relative), 'utf8');
const calendarSource = source('store/calendarStore.ts');
const readinessSource = source('store/readinessStore.ts');
const programSource = source('store/programStore.ts');
const coachSource = source('store/coachUpdatesStore.ts');
const transactionSource = source('store/acceptedStateTransaction.ts');
const rebuildSource = source('utils/weekRebuild.ts');
const rolloverSource = source('utils/programBlockRollover.ts');
const visibleSource = source('utils/visibleProgramReadModel.ts');
const temporaryFactTransactionSource = source('store/temporarySourceFactTransaction.ts');

run('mutation', 'calendar cannot write markedDays before validation', () => {
  assert(calendarSource.includes("commitCalendarMarkTransaction"), 'calendar coordinator call removed');
  assert(!calendarSource.includes("set((state) => ({\n          markedDays"), 'direct calendar material write returned');
});

run('mutation', 'readiness cannot exist only in the visible read model', () => {
  assert(readinessSource.includes('Downstream compatibility only') &&
    readinessSource.includes('canonicalFactReadinessProjection'),
  'readiness store is no longer a downstream canonical-fact mirror');
  assert(temporaryFactTransactionSource.includes('commitAcceptedStateTransaction({') &&
    temporaryFactTransactionSource.includes('temporarySourceFacts: normalizedFacts'),
  'source-fact transaction no longer owns accepted publication');
  assert(visibleSource.includes('hasTemporaryFactProjection'),
    'accepted visible source-fact fence removed');
});

// TWO MUTATION WITNESSES DELETED (2026-08-14):
//   'contract derivation cannot be skipped for contractless legacy weeks'
//   'contractless workouts cannot be canonicalised without weekly validation'
// Both were SOURCE GREPS demanding `deriveContractlessLegacyContract` still be
// present in `store/programStore.ts`, one of them also demanding it precede the
// gateway call. That function is deleted along with the pipeline that called it,
// so these two now assert the presence of code that must not come back. A
// witness that reds the moment its subject is correctly removed is not a
// witness — it is the ratchet pointing the wrong way.

run('mutation', 'program and constraints cannot publish sequential material state', () => {
  const coordinator = coachSource.indexOf("reason: 'constraint:update'");
  const mirror = coachSource.indexOf('commitConstraintState();', coordinator);
  assert(coordinator >= 0 && mirror > coordinator, 'constraint coordinator no longer precedes mirror');
});

run('mutation', 'program and overlays cannot publish sequentially during rebuild', () => {
  assert(rebuildSource.includes("reason: 'week_rebuild:overlay'"), 'overlay transaction removed');
  assert(!rebuildSource.includes('setWeekScopedOverlay(overlay)'), 'sequential overlay setter returned');
});

run('mutation', 'future rollover overlays cannot be restored individually', () => {
  assert(rolloverSource.includes('weekScopedOverlays: relevantOverlays'), 'bulk overlay restoration removed');
  assert(!rolloverSource.includes('.setWeekScopedOverlay('), 'individual overlay restoration returned');
});

run('mutation', 'staged state cannot publish before every affected week passes', () => {
  const staged = transactionSource.indexOf('stageAcceptedStateTransaction(proposal)');
  const equivalent = transactionSource.indexOf('assertAcceptedVisibleLedgerEquivalence', staged);
  const publish = transactionSource.indexOf('useProgramStore.setState({', staged);
  assert(staged >= 0 && equivalent > staged && publish > equivalent, 'publish moved ahead of validation');
});

run('mutation', 'fixture paths cannot bypass the rolling-horizon staging owner', () => {
  assert(transactionSource.includes('stageRollingHorizonFixtureRepair({'),
    'calendar transaction bypasses rolling staging');
  assert(rebuildSource.includes('stageRollingHorizonFixtureRepair({'),
    'week rebuild bypasses rolling staging');
  assert(!rebuildSource.includes('rollingHorizonWeekStartsForMutation({'),
    'week rebuild retained an independent horizon owner');
});

run('mutation', 'only canonical source facts may compose over an accepted base', () => {
  assert(visibleSource.includes(
    '!args.state.activeInjury && !hasTemporaryFactProjection'),
  'accepted week source-fact projection fence removed');
  assert(visibleSource.includes('dayActiveConstraints.filter(isTemporaryFactProjectionConstraint)'),
    'accepted week can apply non-fact constraints twice');
  assert(visibleSource.includes("if (c.type === 'injury')") &&
    visibleSource.includes('buildInjuryConstraint({') &&
    visibleSource.includes("else if (c.type === 'fatigue')") &&
    !visibleSource.includes("else if (c.type === 'soreness'"),
  'canonical health fact constraints are not composed visibly');
  assert(visibleSource.includes(
    "args.state.injuryProjectionOwner === 'accepted_episode'") &&
    visibleSource.includes('activeInjury: !canonicalInjuryProjection && args.state.activeInjury'),
  'canonical injury composition still depends on the single-slot alias');
  assert(transactionSource.includes(
    '.filter((constraint) => !isTemporarySourceFactConstraint(constraint) && constraint.type !=='),
  'temporary fact constraint can destructively overwrite the accepted base');
});

async function main(): Promise<void> {
  let previousKind: 'regression' | 'property' | 'mutation' | null = null;
  for (const test of tests) {
    if (test.kind !== previousKind) {
      // 17 / 7 / 8, DOWN FROM 23 / 10 / 10 ON 2026-08-14. Eleven cells were
      // deleted in one commit, all nine with the same subject: the legacy
      // structural migration a stored program used to be read back through.
      // Nothing was rewired to a different claim to keep the numbers up.
      const heading = test.kind === 'regression'
        ? 'Required fixed regressions (17)'
        : test.kind === 'property'
          ? 'Properties (7 distinct invariants)'
          : 'Mutation witnesses (8)';
      console.log(`\n-- ${heading} --`);
      previousKind = test.kind;
    }
    try {
      await test.body();
      if (test.kind === 'regression') regressionPass += 1;
      else if (test.kind === 'property') propertyPass += 1;
      else mutationPass += 1;
      console.log(`  PASS [${test.kind}] ${test.name}`);
    } catch (error) {
      failures.push(`${test.kind}: ${test.name}`);
      console.error(`  FAIL [${test.kind}] ${test.name}`, error);
    }
  }

  console.log(`\nAccepted-state transaction totals: regressions=${regressionPass}/17 properties=${propertyPass}/7 mutations=${mutationPass}/8 failures=${failures.length}`);
totalsPrinted(failures.length);
  if (regressionPass !== 17 || propertyPass !== 7 || mutationPass !== 8 || failures.length > 0) {
    console.error(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
