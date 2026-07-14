import type {
  DayOfWeek,
  OnboardingData,
  OverrideContext,
  TrainingProgram,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import type { CalendarDayType } from './calendarStore';
import type { ReadinessSignal } from '../utils/readiness';
import type { ActiveConstraint } from './coachUpdatesStore';
import type { InjuryState } from '../utils/injuryProgression';
import {
  canonicaliseHydratedState,
  type AcceptedMaterialContext,
  type ProgramState,
  useProgramStore,
} from './programStore';
import { useCalendarStore } from './calendarStore';
import { useReadinessStore } from './readinessStore';
import { useCoachUpdatesStore } from './coachUpdatesStore';
import { useProfileStore } from './profileStore';
import { buildReadinessActiveConstraints } from '../utils/readinessConstraints';
import { applyGameDayChange } from '../utils/profileMutations';
import { generateProgramLocally } from '../services/api/generateProgram';
import { addDaysISO } from '../utils/programBlockState';
import { todayISOLocal } from '../utils/appDate';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';

export type AcceptedProgramSurfaces = Pick<
  ProgramState,
  | 'currentProgram'
  | 'currentMicrocycle'
  | 'todayWorkout'
  | 'blockState'
  | 'dateOverrides'
  | 'overrideContexts'
  | 'weekScopedOverlays'
  | 'exposureContractsByWeek'
>;

export interface AcceptedStateTransactionProposal {
  reason: string;
  program?: Partial<AcceptedProgramSurfaces>;
  markedDays?: Record<string, CalendarDayType>;
  readinessSignalsByDate?: Record<string, ReadinessSignal>;
  activeConstraints?: ActiveConstraint[];
  activeInjury?: InjuryState | null;
  validateWeekStarts?: readonly string[];
  profile?: OnboardingData | null;
  programAlreadyAccepted?: boolean;
}

export interface AcceptedStateTransactionResult {
  program: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
}

export class AcceptedStateLedgerMismatchError extends Error {
  readonly code = 'accepted_state_ledger_mismatch';

  constructor(weekStart: string, detail: string) {
    super(`Accepted-state ledger mismatch for ${weekStart}: ${detail}`);
    this.name = 'AcceptedStateLedgerMismatchError';
  }
}

const PROGRAM_SURFACE_KEYS: Array<keyof AcceptedProgramSurfaces> = [
  'currentProgram',
  'currentMicrocycle',
  'todayWorkout',
  'blockState',
  'dateOverrides',
  'overrideContexts',
  'weekScopedOverlays',
  'exposureContractsByWeek',
];

function programSurfaces(state: ProgramState): AcceptedProgramSurfaces {
  return {
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    blockState: state.blockState,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
    exposureContractsByWeek: state.exposureContractsByWeek,
  };
}

function materialContext(state: ProgramState): AcceptedMaterialContext {
  if (state.acceptedMaterialContext.revision > 0) return state.acceptedMaterialContext;
  return {
    markedDays: { ...useCalendarStore.getState().markedDays },
    readinessSignalsByDate: { ...useReadinessStore.getState().signalsByDate },
    activeConstraints: [...(useCoachUpdatesStore.getState().activeConstraints ?? [])],
    activeInjury: useCoachUpdatesStore.getState().activeInjury ?? null,
    revision: 0,
    lastTransaction: null,
  };
}

function validationConstraints(
  activeConstraints: readonly ActiveConstraint[],
  signals: Readonly<Record<string, ReadinessSignal>>,
): ActiveConstraint[] {
  const byId = new Map(activeConstraints.map((constraint) => [constraint.id, constraint]));
  for (const signal of Object.values(signals)) {
    for (const constraint of buildReadinessActiveConstraints(signal)) {
      byId.set(constraint.id, constraint);
    }
  }
  return Array.from(byId.values());
}

function materialisedProgramPatch(
  base: AcceptedProgramSurfaces,
  patch: Partial<AcceptedProgramSurfaces> | undefined,
): AcceptedProgramSurfaces {
  return { ...base, ...(patch ?? {}) };
}

function materialiseFixtureMarksForCandidate(args: {
  candidate: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  profile: OnboardingData | null;
}): AcceptedProgramSurfaces {
  if (!args.candidate.currentProgram || !args.profile) return args.candidate;
  const overlays = { ...args.candidate.weekScopedOverlays };
  let changed = false;
  for (const microcycle of args.candidate.currentProgram.microcycles) {
    const weekStart = microcycle.startDate.slice(0, 10);
    const weekDates = datesInWeek(weekStart);
    const explicitGameDate = weekDates.find((date) => args.context.markedDays[date] === 'game');
    const explicitNoGame = weekDates.some((date) => args.context.markedDays[date] === 'noGame');
    if (!explicitGameDate && !explicitNoGame) continue;
    const existing = overlays[weekStart];
    const contract = existing?.exposureContractV2 ?? microcycle.exposureContractV2;
    const desiredAnchor = explicitGameDate
      ? args.profile.seasonPhase === 'Pre-season' ? 'practice_match' : 'game'
      : 'bye';
    const fixtureAnchor = contract?.anchors.find((anchor) =>
      anchor.kind === 'game' || anchor.kind === 'practice_match');
    const alreadyMaterialised = contract?.identity.anchorState === desiredAnchor && (
      !explicitGameDate || fixtureAnchor?.dayOfWeek ===
        new Date(`${explicitGameDate}T12:00:00`).getDay()
    );
    if (alreadyMaterialised) continue;
    overlays[weekStart] = fixtureProjection({
      program: args.candidate.currentProgram,
      profile: args.profile,
      weekStart,
      markedDays: args.context.markedDays,
    }).overlay;
    changed = true;
  }
  return changed ? { ...args.candidate, weekScopedOverlays: overlays } : args.candidate;
}

function acceptedLedgerSignature(contract: WeeklyExposureContractV2): string {
  return JSON.stringify({
    strength: contract.mainStrength.exposure.achievedCount,
    patterns: contract.strengthPatterns.achievedMeaningfulMainLifts,
    conditioningCore: contract.conditioning.core.achievedCount,
    conditioningOptionalFlush: contract.conditioning.optionalFlush.achievedCount,
    conditioningOptionalRecovery: contract.conditioning.optionalRecoveryAerobic.achievedCount,
    conditioningOptionalOther: contract.conditioning.optionalNonCoreAchievedCount,
    conditioningLegacyUnknown: contract.conditioning.legacyUnknownAchievedCount,
    conditioningStress: contract.conditioning.achievedByStress,
    conditioningAnchors: contract.conditioning.anchorCredit,
    conditioningApp: contract.conditioning.appAuthoredCoreCredit,
    sprint: contract.sprintHighSpeed.exposure.achievedCount,
    sprintSources: contract.sprintHighSpeed.achievedSources,
    power: contract.power.achievedPrimerCount,
    rest: contract.restStress.achievedTrueFullRestCount,
    activeRecovery: contract.restStress.achievedActiveRecoveryCount,
    moderateDays: contract.restStress.achievedModerateDayCount,
    hardDays: contract.restStress.achievedHardDayCount,
  });
}

/**
 * Re-resolve a staged persisted week and prove that its observable ledger is
 * exactly the ledger stamped by the accepted gateway. This forbids a later
 * visible precedence layer from changing exposure, power, rest or stress.
 */
export function assertAcceptedVisibleLedgerEquivalence(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  weekStarts: readonly string[];
  profile?: OnboardingData | null;
}): void {
  const profile = args.profile ?? useProfileStore.getState().onboardingData;
  for (const weekStart of Array.from(new Set(args.weekStarts.map((week) => week.slice(0, 10))))) {
    const overlay = args.surfaces.weekScopedOverlays[weekStart];
    const microcycle = args.surfaces.currentProgram?.microcycles.find((candidate) =>
      weekStart >= candidate.startDate.slice(0, 10) &&
      weekStart <= candidate.endDate.slice(0, 10)) ?? (
      args.surfaces.currentMicrocycle &&
      weekStart >= args.surfaces.currentMicrocycle.startDate.slice(0, 10) &&
      weekStart <= args.surfaces.currentMicrocycle.endDate.slice(0, 10)
        ? args.surfaces.currentMicrocycle
        : null
    );
    const contract = overlay?.exposureContractV2 ?? microcycle?.exposureContractV2;
    if (!contract) continue;
    const workouts: Workout[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = addDaysISO(weekStart, offset);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const manual = args.surfaces.dateOverrides[date];
      const hasOverlay = !!overlay && Object.prototype.hasOwnProperty.call(
        overlay.workoutsByDate,
        date,
      );
      const workout = manual ?? (
        hasOverlay
          ? overlay!.workoutsByDate[date]
          : microcycle?.workouts.find((candidate) => candidate.dayOfWeek === dayOfWeek) ?? null
      );
      if (workout) workouts.push(workout);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const visible = require('../rules/section18AcceptedWeekGateway')
      .resolveFinalVisibleSection18Week({
        contract,
        workouts,
        weekStart,
        profile,
        scheduleState: { markedDays: args.context.markedDays },
      });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const evaluation = require('../rules/section18EffectiveWeekEvaluator')
      .evaluateSection18EffectiveWeek({ contract, workouts: visible, weekStart });
    if (evaluation.blockingViolations.length > 0) {
      throw new AcceptedStateLedgerMismatchError(
        weekStart,
        `re-evaluation produced blockers ${evaluation.blockingViolations
          .map((finding: { code: string }) => finding.code).join(',')}`,
      );
    }
    if (acceptedLedgerSignature(contract) !== acceptedLedgerSignature(evaluation.contract)) {
      throw new AcceptedStateLedgerMismatchError(weekStart, 'persisted and visible ledgers differ');
    }
  }
}

/**
 * Pure staging boundary. No Zustand store is changed until every affected
 * effective week has passed Contract v2 safety and the accepted-week gateway.
 */
export function stageAcceptedStateTransaction(
  proposal: AcceptedStateTransactionProposal,
): AcceptedStateTransactionResult {
  const current = useProgramStore.getState();
  const priorContext = materialContext(current);
  const context: AcceptedMaterialContext = {
    markedDays: { ...(proposal.markedDays ?? priorContext.markedDays) },
    readinessSignalsByDate: {
      ...(proposal.readinessSignalsByDate ?? priorContext.readinessSignalsByDate),
    },
    activeConstraints: [...(proposal.activeConstraints ?? priorContext.activeConstraints)],
    activeInjury: proposal.activeInjury === undefined
      ? priorContext.activeInjury
      : proposal.activeInjury,
    revision: priorContext.revision + 1,
    lastTransaction: proposal.reason,
  };
  const profile = proposal.profile ?? useProfileStore.getState().onboardingData;
  const candidate = materialiseFixtureMarksForCandidate({
    candidate: materialisedProgramPatch(programSurfaces(current), proposal.program),
    context,
    profile,
  });
  const constraints = validationConstraints(
    context.activeConstraints,
    context.readinessSignalsByDate,
  );
  const accepted = canonicaliseHydratedState(candidate, {
    programAlreadyAccepted: proposal.programAlreadyAccepted ?? true,
    // An empty set means "retain the already-accepted reduced program". Do
    // not turn a context-only clear into a whole-program regeneration or a
    // second structural pass. Explicit affected weeks are still re-gated via
    // validateWeekStarts below.
    activeConstraints: constraints.length > 0 ? constraints : undefined,
    profile,
    markedDays: context.markedDays,
    validateWeekStarts: proposal.validateWeekStarts,
  });
  return {
    program: materialisedProgramPatch(candidate, accepted as Partial<AcceptedProgramSurfaces>),
    context,
  };
}

/**
 * The sole material publication. Program and every context input used by the
 * athlete-visible resolver enter ProgramStore in one state replacement.
 * Legacy stores are mirrored afterward and are not programming authorities.
 */
export function commitAcceptedStateTransaction(
  proposal: AcceptedStateTransactionProposal,
): AcceptedStateTransactionResult {
  const staged = stageAcceptedStateTransaction(proposal);
  const equivalenceWeeks = new Set(proposal.validateWeekStarts ?? []);
  if (proposal.activeConstraints !== undefined || proposal.activeInjury !== undefined) {
    for (const microcycle of staged.program.currentProgram?.microcycles ?? []) {
      equivalenceWeeks.add(microcycle.startDate.slice(0, 10));
    }
    for (const weekStart of Object.keys(staged.program.weekScopedOverlays)) {
      equivalenceWeeks.add(weekStart);
    }
  }
  assertAcceptedVisibleLedgerEquivalence({
    surfaces: staged.program,
    context: staged.context,
    weekStarts: Array.from(equivalenceWeeks),
    profile: proposal.profile,
  });
  useProgramStore.setState({
    ...staged.program,
    acceptedMaterialContext: staged.context,
  });
  useCalendarStore.setState({ markedDays: staged.context.markedDays });
  useReadinessStore.setState({ signalsByDate: staged.context.readinessSignalsByDate });
  return staged;
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dayNameForDate(date: string): DayOfWeek {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${date}T12:00:00`).getDay()
  ] as DayOfWeek;
}

function datesInWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => addDaysISO(weekStart, offset));
}

function fixtureProjection(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  weekStart: string;
  markedDays: Record<string, CalendarDayType>;
}): { overlay: WeekScopedWorkoutOverlay; profile: OnboardingData } {
  const weekDates = new Set(datesInWeek(args.weekStart));
  const explicitGameDate = Object.entries(args.markedDays)
    .filter(([date, mark]) => weekDates.has(date) && mark === 'game')
    .map(([date]) => date)
    .sort()[0] ?? null;
  const explicitNoGame = Object.entries(args.markedDays).some(
    ([date, mark]) => weekDates.has(date) && mark === 'noGame',
  );
  const targetGameDay = explicitGameDate
    ? dayNameForDate(explicitGameDate)
    : explicitNoGame
      ? null
      : undefined;
  const profile = targetGameDay === undefined
    ? args.profile
    : applyGameDayChange(args.profile, targetGameDay);
  const target = generateProgramLocally(profile, {
    todayISO: args.weekStart,
    previousProgram: args.program,
    seasonPhaseClock: args.program.seasonPhaseClock,
  });
  // Dynamic loading avoids an initialisation cycle: weekRebuild itself uses
  // this transaction owner for its final publication.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildWeekScopedWorkoutOverlay } = require('../utils/weekRebuild');
  return {
    profile,
    overlay: buildWeekScopedWorkoutOverlay({
      program: target,
      weekStart: args.weekStart,
      anchorDate: explicitGameDate,
      reason: explicitGameDate ? 'one_off_game' : 'one_off_no_game',
    }),
  };
}

export function commitCalendarMarkTransaction(args: {
  date: string;
  mark: CalendarDayType | null;
  expectedCurrentMark?: CalendarDayType;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const markedDays = { ...prior.markedDays };
  const current = markedDays[args.date];
  if (args.expectedCurrentMark && current !== args.expectedCurrentMark) {
    return { program: programSurfaces(state), context: prior };
  }
  const weekStart = mondayForDate(args.date);
  if (args.mark === null) delete markedDays[args.date];
  else markedDays[args.date] = args.mark;
  if (args.mark === 'game') {
    for (const date of datesInWeek(weekStart)) {
      if (
        date !== args.date &&
        (markedDays[date] === 'game' || markedDays[date] === 'noGame')
      ) delete markedDays[date];
    }
  } else if (args.mark === 'noGame') {
    for (const date of datesInWeek(weekStart)) {
      if (markedDays[date] === 'game') delete markedDays[date];
    }
  } else if (args.mark === null && current === 'game') {
    const profile = useProfileStore.getState().onboardingData;
    const recurringDay = (profile.usualGameDay || profile.gameDay) as DayOfWeek | undefined;
    if (profile.seasonPhase === 'In-season' && recurringDay) {
      const recurringDate = datesInWeek(weekStart)
        .find((date) => dayNameForDate(date) === recurringDay);
      if (recurringDate) markedDays[recurringDate] = 'noGame';
    }
  }
  return commitCalendarStateTransaction({
    reason: `calendar:${args.mark ?? 'clear'}:${args.date}`,
    markedDays,
    affectedDates: [args.date],
    fixtureChangedDates: current === 'game' || current === 'noGame' ||
      args.mark === 'game' || args.mark === 'noGame' ? [args.date] : [],
  });
}

/**
 * Pure fixture-mark proposal used by the rebuild owner. A week rebuild must
 * not call calendar actions during its commit; the proposed marks travel in
 * the same accepted snapshot as the rebuilt program and overlay.
 */
export function proposeFixtureMarkedDays(args: {
  profile: OnboardingData;
  targetDate: string;
  newGameDay: DayOfWeek | null;
  previousFixtureDate?: string;
}): Record<string, CalendarDayType> {
  const prior = materialContext(useProgramStore.getState());
  const markedDays = { ...prior.markedDays };
  const targetWeekStart = mondayForDate(args.targetDate);

  if (args.previousFixtureDate) delete markedDays[args.previousFixtureDate];
  if (args.newGameDay) {
    for (const date of datesInWeek(targetWeekStart)) {
      if (markedDays[date] === 'game' || markedDays[date] === 'noGame') {
        delete markedDays[date];
      }
    }
    markedDays[args.targetDate] = 'game';
    return markedDays;
  }

  if (markedDays[args.targetDate] === 'game') delete markedDays[args.targetDate];
  if (args.profile.seasonPhase === 'In-season') {
    const recurringDay = (args.profile.usualGameDay || args.profile.gameDay) as DayOfWeek | undefined;
    if (recurringDay) {
      const recurringDate = datesInWeek(targetWeekStart)
        .find((date) => dayNameForDate(date) === recurringDay);
      if (recurringDate) markedDays[recurringDate] = 'noGame';
    }
  }
  return markedDays;
}

export function commitCalendarStateTransaction(args: {
  reason: string;
  markedDays: Record<string, CalendarDayType>;
  affectedDates: readonly string[];
  fixtureChangedDates?: readonly string[];
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const baseProfile = useProfileStore.getState().onboardingData;
  const affectedWeeks = Array.from(new Set(args.affectedDates.map(mondayForDate)));
  const fixtureWeeks = new Set((args.fixtureChangedDates ?? []).map(mondayForDate));
  const overlays = { ...state.weekScopedOverlays };
  if (state.currentProgram && baseProfile) {
    for (const weekStart of affectedWeeks) {
      const materialised = state.currentProgram.microcycles.some((microcycle) =>
        weekStart >= microcycle.startDate.slice(0, 10) &&
        weekStart <= microcycle.endDate.slice(0, 10));
      if (!materialised || !fixtureWeeks.has(weekStart)) continue;
      overlays[weekStart] = fixtureProjection({
        program: state.currentProgram,
        profile: baseProfile,
        weekStart,
        markedDays: args.markedDays,
      }).overlay;
    }
  }
  return commitAcceptedStateTransaction({
    reason: args.reason,
    program: { weekScopedOverlays: overlays },
    markedDays: args.markedDays,
    validateWeekStarts: affectedWeeks,
    profile: baseProfile,
  });
}

function readinessSignal(args: {
  date: string;
  patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'>;
  previous?: ReadinessSignal;
}): ReadinessSignal {
  return {
    ...args.previous,
    ...args.patch,
    date: args.date,
    source: args.patch.source ?? args.previous?.source ?? 'quick_check',
    updatedAt: new Date().toISOString(),
  };
}

export function commitReadinessSignalTransaction(args: {
  date: string;
  patch: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'> | null;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const readinessSignalsByDate = { ...prior.readinessSignalsByDate };
  if (args.patch) {
    readinessSignalsByDate[args.date] = readinessSignal({
      date: args.date,
      patch: args.patch,
      previous: readinessSignalsByDate[args.date],
    });
  } else {
    delete readinessSignalsByDate[args.date];
  }
  return commitReadinessStateTransaction({
    reason: `readiness:${args.patch ? 'set' : 'clear'}:${args.date}`,
    readinessSignalsByDate,
    affectedDates: [args.date],
  });
}

export function commitReadinessStateTransaction(args: {
  reason: string;
  readinessSignalsByDate: Record<string, ReadinessSignal>;
  affectedDates: readonly string[];
}): AcceptedStateTransactionResult {
  return commitAcceptedStateTransaction({
    reason: args.reason,
    readinessSignalsByDate: args.readinessSignalsByDate,
    validateWeekStarts: Array.from(new Set(args.affectedDates.map(mondayForDate))),
  });
}

export function getAcceptedMaterialContext(): AcceptedMaterialContext {
  return materialContext(useProgramStore.getState());
}

export function acceptedProgramSurfaceKeys(): ReadonlyArray<keyof AcceptedProgramSurfaces> {
  return PROGRAM_SURFACE_KEYS;
}

export function currentAcceptedWeekStart(): string {
  return mondayForDate(todayISOLocal());
}
