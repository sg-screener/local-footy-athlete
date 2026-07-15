import type {
  DayOfWeek,
  Microcycle,
  OnboardingData,
  OverrideContext,
  TrainingProgram,
  UserRemovalConstraint,
  UserRemovalScope,
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
import { isStructuralGenerationConstraint } from '../utils/generationConstraints';
import { generateProgramLocally } from '../services/api/generateProgram';
import { addDaysISO } from '../utils/programBlockState';
import { todayISOLocal } from '../utils/appDate';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import {
  rebaseAcceptedEffectiveWeek,
  type AcceptedEffectiveWeekSurfaces,
} from '../rules/acceptedEffectiveWeek';
import {
  normalizeAcceptedArray,
  normalizeAcceptedKeyedMap,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
} from './acceptedStateColdStart';
import {
  resolveFixtureConditionedAvailability,
  targetWeekFixtures,
  type TargetWeekFixture,
} from '../rules/fixtureConditionedAvailability';
import {
  buildFixtureMinimalReplan,
  type FixtureMutationIntent,
  type FixtureReplanEditCost,
  type FixtureMinimalReplanResult,
} from '../utils/fixtureMinimalReplan';
import {
  effectiveFixtureDatesForWeeks,
  materialiseVisibleSystemWork,
  rollingHorizonDependencyClosure,
  rollingHorizonWeekStartsForMutation,
  searchRollingHorizonCandidateCombinations,
} from '../rules/rollingHorizonRepair';
import { userRemovalConstraintId } from '../rules/userRemovalConstraints';
import { Section18WeekAcceptanceError } from '../rules/section18AcceptedWeekGateway';
import {
  athleteActionDiagnosticHash,
  athleteActionDiagnosticsEnabled,
  athleteActionTerminalReasonChain,
  classifyAthleteActionFailure,
  currentAthleteActionTrace,
  emitAthleteActionDebugSnapshot,
  emitAthleteActionEvent,
  queueAthleteActionPersistence,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

export type AcceptedProgramSurfaces = Pick<
  ProgramState,
  | 'currentProgram'
  | 'currentMicrocycle'
  | 'todayWorkout'
  | 'blockState'
  | 'dateOverrides'
  | 'overrideContexts'
  | 'weekScopedOverlays'
  | 'userRemovalConstraints'
  | 'exposureContractsByWeek'
>;

export interface AcceptedStateTransactionProposal {
  reason: string;
  /** Development-only correlation context; never persisted. */
  trace?: AthleteActionTraceContext;
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
  'userRemovalConstraints',
  'exposureContractsByWeek',
];

function programSurfaces(state: ProgramState): AcceptedProgramSurfaces {
  return normalizeAcceptedProgramSurfaces(state);
}

function materialContext(state: ProgramState): AcceptedMaterialContext {
  const accepted = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  if (accepted.revision > 0) return accepted;
  return normalizeAcceptedMaterialContext({
    markedDays: normalizeAcceptedKeyedMap(useCalendarStore.getState().markedDays),
    readinessSignalsByDate: normalizeAcceptedKeyedMap(
      useReadinessStore.getState().signalsByDate,
    ),
    activeConstraints: normalizeAcceptedArray(useCoachUpdatesStore.getState().activeConstraints),
    activeInjury: useCoachUpdatesStore.getState().activeInjury ?? null,
    revision: 0,
    lastTransaction: null,
  });
}

function validationConstraints(
  activeConstraints: readonly ActiveConstraint[],
  signals: Readonly<Record<string, ReadinessSignal>>,
): ActiveConstraint[] {
  const byId = new Map(activeConstraints
    .filter(isStructuralGenerationConstraint)
    .map((constraint) => [constraint.id, constraint]));
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
  return normalizeAcceptedProgramSurfaces({ ...base, ...(patch ?? {}) });
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
    const recurringDay = (args.profile.usualGameDay || args.profile.gameDay) as DayOfWeek | undefined;
    const recurringDate = recurringDay
      ? weekDates.find((date) => dayNameForDate(date) === recurringDay)
      : undefined;
    const recurringFixtureRest = !!recurringDate &&
      args.context.markedDays[recurringDate] === 'rest';
    if (!explicitGameDate && !explicitNoGame && !recurringFixtureRest) continue;
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
    overlays[weekStart] = buildFixtureProjection({
      program: args.candidate.currentProgram,
      profile: args.profile,
      weekStart,
      markedDays: args.context.markedDays,
      sourceSurfaces: args.candidate,
      sourceMarkedDays: args.context.markedDays,
      activeConstraints: args.context.activeConstraints,
      userRemovalConstraints: args.candidate.userRemovalConstraints,
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
  trace?: AthleteActionTraceContext;
}): void {
  const surfaces = normalizeAcceptedProgramSurfaces(args.surfaces);
  const context = normalizeAcceptedMaterialContext(args.context);
  const profile = args.profile ?? useProfileStore.getState().onboardingData;
  for (const weekStart of Array.from(new Set(args.weekStarts.map((week) => week.slice(0, 10))))) {
    const overlay = surfaces.weekScopedOverlays[weekStart];
    const microcycle = surfaces.currentProgram?.microcycles.find((candidate) =>
      weekStart >= candidate.startDate.slice(0, 10) &&
      weekStart <= candidate.endDate.slice(0, 10)) ?? (
      surfaces.currentMicrocycle &&
      weekStart >= surfaces.currentMicrocycle.startDate.slice(0, 10) &&
      weekStart <= surfaces.currentMicrocycle.endDate.slice(0, 10)
        ? surfaces.currentMicrocycle
        : null
    );
    const contract = overlay?.exposureContractV2 ?? microcycle?.exposureContractV2;
    if (!contract) continue;
    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces,
      weekStart,
      profile,
      markedDays: context.markedDays,
    });
    const evaluation = rebased.evaluation;
    if (evaluation.blockingViolations.length > 0) {
      emitAthleteActionEvent(args.trace, 'visible_projection_result', {
        acceptedStateVersion: context.revision,
        weekId: weekStart,
        visibleStateHash: athleteActionDiagnosticHash(rebased.visibleWorkouts.map((workout) => ({
          dayOfWeek: workout.dayOfWeek,
          identity: workout.planEntryId ?? workout.id,
        }))),
        visibleEqualsAcceptedState: false,
        rejectionCodes: evaluation.blockingViolations.map((finding) => finding.code),
        rejectingBoundary: 'assertAcceptedVisibleLedgerEquivalence',
        failureCategory: 'projection_mismatch',
      });
      throw new AcceptedStateLedgerMismatchError(
        weekStart,
        `re-evaluation produced blockers ${evaluation.blockingViolations
          .map((finding: { code: string }) => finding.code).join(',')}`,
      );
    }
    if (acceptedLedgerSignature(contract) !== acceptedLedgerSignature(evaluation.contract)) {
      emitAthleteActionEvent(args.trace, 'visible_projection_result', {
        acceptedStateVersion: context.revision,
        weekId: weekStart,
        visibleStateHash: athleteActionDiagnosticHash(rebased.visibleWorkouts.map((workout) => ({
          dayOfWeek: workout.dayOfWeek,
          identity: workout.planEntryId ?? workout.id,
        }))),
        visibleEqualsAcceptedState: false,
        rejectionCodes: ['accepted_state_ledger_mismatch'],
        rejectingBoundary: 'assertAcceptedVisibleLedgerEquivalence',
        failureCategory: 'projection_mismatch',
      });
      throw new AcceptedStateLedgerMismatchError(weekStart, 'persisted and visible ledgers differ');
    }
    emitAthleteActionEvent(args.trace, 'visible_projection_result', {
      acceptedStateVersion: context.revision,
      weekId: weekStart,
      visibleStateHash: athleteActionDiagnosticHash(rebased.visibleWorkouts.map((workout) => ({
        dayOfWeek: workout.dayOfWeek,
        identity: workout.planEntryId ?? workout.id,
      }))),
      visibleEqualsAcceptedState: true,
      outcome: 'accepted',
    });
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
  const context = normalizeAcceptedMaterialContext({
    markedDays: proposal.markedDays === undefined
      ? priorContext.markedDays
      : proposal.markedDays,
    readinessSignalsByDate: proposal.readinessSignalsByDate === undefined
      ? priorContext.readinessSignalsByDate
      : proposal.readinessSignalsByDate,
    activeConstraints: proposal.activeConstraints === undefined
      ? priorContext.activeConstraints
      : proposal.activeConstraints,
    activeInjury: proposal.activeInjury === undefined
      ? priorContext.activeInjury
      : proposal.activeInjury,
    revision: priorContext.revision + 1,
    lastTransaction: proposal.reason,
  });
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
  const trace = proposal.trace ?? currentAthleteActionTrace();
  const diagnosticsEnabled = Boolean(trace) && athleteActionDiagnosticsEnabled();
  const current = diagnosticsEnabled ? useProgramStore.getState() : null;
  const beforeContext = current ? materialContext(current) : null;
  const beforeStateHash = current && beforeContext
    ? athleteActionDiagnosticHash({
        program: programSurfaces(current),
        context: beforeContext,
      })
    : undefined;
  emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
    selectedRoute: 'accepted_state_transaction',
    transactionReason: proposal.reason,
    acceptedStateVersion: beforeContext?.revision,
    beforeStateHash,
  });
  let staged: AcceptedStateTransactionResult;
  try {
    staged = stageAcceptedStateTransaction(proposal);
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'transaction_staging_failed';
    emitAthleteActionEvent(trace, 'transaction_verification_result', {
      verified: false,
      originalRejectionCode: code,
      rejectionCodes: [code],
      rejectingBoundary: 'stageAcceptedStateTransaction',
      failureCategory: classifyAthleteActionFailure(code, 'stageAcceptedStateTransaction'),
      previousStateRestored: true,
      beforeStateHash,
    });
    emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
      published: false,
      atomicRollback: true,
      previousStateRestored: true,
      beforeStateHash,
      afterStateHash: beforeStateHash,
      internalResultCode: code,
    });
    throw error;
  }
  const equivalenceWeeks = new Set(proposal.validateWeekStarts ?? []);
  if (proposal.activeConstraints !== undefined || proposal.activeInjury !== undefined) {
    for (const microcycle of staged.program.currentProgram?.microcycles ?? []) {
      equivalenceWeeks.add(microcycle.startDate.slice(0, 10));
    }
    for (const weekStart of Object.keys(staged.program.weekScopedOverlays)) {
      equivalenceWeeks.add(weekStart);
    }
  }
  try {
    assertAcceptedVisibleLedgerEquivalence({
      surfaces: staged.program,
      context: staged.context,
      weekStarts: Array.from(equivalenceWeeks),
      profile: proposal.profile,
      trace,
    });
    emitAthleteActionEvent(trace, 'visible_projection_result', {
      acceptedStateVersion: staged.context.revision,
      dependencyWeeksSelected: Array.from(equivalenceWeeks).sort(),
      visibleStateHash: athleteActionDiagnosticHash({
        programId: staged.program.currentProgram?.id ?? null,
        microcycleId: staged.program.currentMicrocycle?.id ?? null,
        overrideIdentities: Object.entries(staged.program.dateOverrides).map(([date, workout]) => ({
          date,
          identity: workout.planEntryId ?? workout.id,
        })),
        overlayWeeks: Object.keys(staged.program.weekScopedOverlays).sort(),
      }),
      visibleEqualsAcceptedState: true,
      projectionSummary: true,
      outcome: 'accepted',
    });
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'transaction_verification_failed';
    emitAthleteActionEvent(trace, 'transaction_verification_result', {
      verified: false,
      originalRejectionCode: code,
      rejectionCodes: [code],
      rejectingBoundary: 'assertAcceptedVisibleLedgerEquivalence',
      failureCategory: classifyAthleteActionFailure(code, 'visible_projection'),
      previousStateRestored: true,
      beforeStateHash,
    });
    emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
      published: false,
      atomicRollback: true,
      previousStateRestored: true,
      beforeStateHash,
      afterStateHash: beforeStateHash,
      terminalReasonChain: trace ? athleteActionTerminalReasonChain(trace.traceId) : [],
      internalResultCode: code,
    });
    throw error;
  }
  emitAthleteActionEvent(trace, 'transaction_verification_result', {
    verified: true,
    acceptedStateVersion: staged.context.revision,
    dependencyWeeksSelected: Array.from(equivalenceWeeks).sort(),
    beforeStateHash,
  });
  queueAthleteActionPersistence(trace);
  useProgramStore.setState({
    ...staged.program,
    acceptedMaterialContext: staged.context,
  });
  useCalendarStore.setState({ markedDays: staged.context.markedDays });
  useReadinessStore.setState({ signalsByDate: staged.context.readinessSignalsByDate });
  const afterStateHash = athleteActionDiagnosticHash({
    program: staged.program,
    context: staged.context,
  });
  emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
    published: true,
    atomicRollback: false,
    previousStateRestored: false,
    acceptedStateVersion: staged.context.revision,
    beforeStateHash,
    afterStateHash,
    outcome: 'accepted',
  });
  if (trace && diagnosticsEnabled && beforeContext) {
    const activeNotes = (require('../utils/activeCoachNotes') as typeof import('../utils/activeCoachNotes'))
      .buildActiveCoachNotes(staged.context.activeConstraints, staged.context.activeInjury);
    const beforeNotes = (require('../utils/activeCoachNotes') as typeof import('../utils/activeCoachNotes'))
      .buildActiveCoachNotes(beforeContext.activeConstraints, beforeContext.activeInjury);
    const beforeIds = new Set(beforeNotes.map((note) => note.id));
    const afterIds = new Set(activeNotes.map((note) => note.id));
    const afterConstraintIds = new Set(staged.context.activeConstraints.map((constraint) => constraint.id));
    const beforeConstraintIds = new Set(beforeContext.activeConstraints.map((constraint) => constraint.id));
    const clearedConstraints = beforeContext.activeConstraints.filter((constraint) =>
      !afterConstraintIds.has(constraint.id));
    const clearedLinkedOverrideDates = Array.from(new Set(clearedConstraints.flatMap((constraint) =>
      'linkedOverrideDates' in constraint ? constraint.linkedOverrideDates ?? [] : []))).sort();
    const derivedConstraintIds = new Set(activeNotes.map((note) => note.constraintId));
    emitAthleteActionEvent(trace, 'coach_notes_result', {
      activeAdjustmentCountBefore: beforeContext.activeConstraints.length,
      activeAdjustmentCountAfter: staged.context.activeConstraints.length,
      activeCoachNoteCountBefore: beforeNotes.length,
      activeCoachNoteCountAfter: activeNotes.length,
      noteIdentitiesDerived: activeNotes.map((note) => note.id),
      noteIdentitiesAdded: activeNotes.filter((note) => !beforeIds.has(note.id)).map((note) => note.id),
      noteIdentitiesRemoved: beforeNotes.filter((note) => !afterIds.has(note.id)).map((note) => note.id),
      noteIdentitiesPreserved: activeNotes.filter((note) => beforeIds.has(note.id)).map((note) => note.id),
      noteIdentitiesSuppressed: staged.context.activeConstraints
        .filter((constraint) => !derivedConstraintIds.has(constraint.id))
        .map((constraint) => constraint.id),
      deduplicationKeys: activeNotes.map((note) => note.modifierId),
      adjustmentCleared: clearedConstraints.length > 0,
      clearedAdjustmentIds: clearedConstraints.map((constraint) => constraint.id),
      clearedLinkedOverrideDates,
      displacedSessionRestorationResult: clearedLinkedOverrideDates.length === 0
        ? 'not_applicable'
        : clearedLinkedOverrideDates.every((date) =>
            !Object.prototype.hasOwnProperty.call(staged.program.dateOverrides, date))
          ? 'owned_override_removed_for_visible_reprojection'
          : 'owned_override_still_present',
      noteStateMatchesAcceptedProvenance: activeNotes.every((note) =>
        afterConstraintIds.has(note.constraintId) || (
          staged.context.activeInjury &&
          note.constraintId === 'legacy_active_injury'
        )),
      acceptedConstraintIdsPreserved: staged.context.activeConstraints
        .filter((constraint) => beforeConstraintIds.has(constraint.id))
        .map((constraint) => constraint.id),
    });
    emitAthleteActionDebugSnapshot(trace, 'accepted_state_after_publication', {
      program: staged.program,
      context: staged.context,
    });
  }
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

function fixtureFromContract(
  contract: WeeklyExposureContractV2 | undefined,
  weekStart: string,
  profile: OnboardingData,
): TargetWeekFixture[] {
  const anchor = contract?.anchors.find((candidate) =>
    candidate.kind === 'game' || candidate.kind === 'practice_match');
  if (!anchor) return [];
  return [{
    date: datesInWeek(weekStart).find((date) =>
      new Date(`${date}T12:00:00`).getDay() === anchor.dayOfWeek)!,
    kind: anchor.kind === 'practice_match' || profile.seasonPhase === 'Pre-season'
      ? 'practice_match'
      : 'game',
  }];
}

export function buildFixtureProjection(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  weekStart: string;
  markedDays: Record<string, CalendarDayType>;
  sourceSurfaces?: AcceptedEffectiveWeekSurfaces;
  sourceMarkedDays?: Readonly<Record<string, CalendarDayType>>;
  activeConstraints?: readonly ActiveConstraint[];
  mutationIntent?: FixtureMutationIntent;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
}): {
  overlay: WeekScopedWorkoutOverlay;
  profile: OnboardingData;
  replan: FixtureMinimalReplanResult;
  alternatives: Array<{
    overlay: WeekScopedWorkoutOverlay;
    replan: FixtureMinimalReplanResult;
  }>;
} {
  const weekDates = new Set(datesInWeek(args.weekStart));
  const explicitGameDate = Object.entries(args.markedDays)
    .filter(([date, mark]) => weekDates.has(date) && mark === 'game')
    .map(([date]) => date)
    .sort()[0] ?? null;
  const explicitNoGame = Object.entries(args.markedDays).some(
    ([date, mark]) => weekDates.has(date) && mark === 'noGame',
  );
  const liveState = useProgramStore.getState();
  const sourceSurfaces = args.sourceSurfaces ?? {
    currentProgram: args.program,
    currentMicrocycle: liveState.currentMicrocycle,
    dateOverrides: liveState.dateOverrides,
    weekScopedOverlays: liveState.weekScopedOverlays,
    userRemovalConstraints: liveState.userRemovalConstraints,
  };
  const acceptedSource = rebaseAcceptedEffectiveWeek({
    surfaces: sourceSurfaces,
    weekStart: args.weekStart,
    profile: args.profile,
    markedDays: args.sourceMarkedDays ?? materialContext(liveState).markedDays,
  });
  const sourceContract = acceptedSource.contract;
  // Mutation structure comes from the accepted precedence-composed snapshot.
  // Only identity-matched accepted prescriptions and dependency-owned work
  // are materialised later; unrelated visible-only fill never becomes input.
  const sourceCanonicalWorkouts = acceptedSource.composedWorkouts;
  const contractFixtures = fixtureFromContract(sourceContract, args.weekStart, args.profile);
  const visibleFixtureWorkouts = sourceCanonicalWorkouts.filter((workout) =>
    workout.workoutType === 'Game');
  const priorFixtures = contractFixtures.length > 0
    ? contractFixtures
    : visibleFixtureWorkouts.length > 0
      ? visibleFixtureWorkouts.map((workout) => ({
          date: datesInWeek(args.weekStart).find((date) =>
            new Date(`${date}T12:00:00`).getDay() === workout.dayOfWeek)!,
          kind: args.profile.seasonPhase === 'Pre-season'
            ? 'practice_match' as const
            : 'game' as const,
        }))
      : [];
  const proposedFixtures = targetWeekFixtures({
    profile: args.profile,
    weekStart: args.weekStart,
    markedDays: args.markedDays,
  });
  const targetGameDay = proposedFixtures[0]
    ? dayNameForDate(proposedFixtures[0].date)
    : null;
  const activeFixtureDates = effectiveFixtureDatesForWeeks({
    profile: args.profile,
    markedDays: args.markedDays,
    weekStarts: [
      addDaysISO(args.weekStart, -7),
      args.weekStart,
      addDaysISO(args.weekStart, 7),
    ],
  });
  const availability = resolveFixtureConditionedAvailability({
    profile: args.profile,
    weekStart: args.weekStart,
    priorFixtures,
    proposedFixtures,
    proposedMarkedDays: args.markedDays,
    byeUsualGameDay: explicitNoGame || proposedFixtures.length === 0,
    activeConstraints: args.activeConstraints,
  });
  let target: TrainingProgram | undefined;
  let targetMicrocycle: Microcycle | undefined;
  try {
    target = generateProgramLocally(args.profile, {
      todayISO: args.weekStart,
      previousProgram: args.program,
      seasonPhaseClock: args.program.seasonPhaseClock,
      targetWeekAvailability: availability,
      targetFixtureDay: targetGameDay,
      activeConstraints: args.activeConstraints,
      microcycleLimit: 1,
    });
    targetMicrocycle = target.microcycles[0];
  } catch (error) {
    if (!(error instanceof Section18WeekAcceptanceError)) throw error;
    // The rolling repair owner, not target generation, decides whether the
    // accepted source can be repaired. Preserve the rejected generator's
    // phase-owned contract/candidate and let the shared search consume it
    // instead of treating one invalid fallback representation as terminal.
    const base = acceptedSource.baseMicrocycle;
    const now = new Date().toISOString();
    targetMicrocycle = {
      id: `repair-target:${args.weekStart}`,
      programId: args.program.id,
      weekNumber: base?.weekNumber ?? 1,
      startDate: args.weekStart,
      endDate: addDaysISO(args.weekStart, 6),
      miniCycleNumber: base?.miniCycleNumber ?? 1,
      intensityMultiplier: base?.intensityMultiplier ?? 1,
      weekKind: error.result.contract.identity.weekKind,
      exposureContractV2: error.result.contract,
      workouts: error.result.canonicalWorkouts,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };
  }
  if (!targetMicrocycle) throw new Error('Fixture target generation produced no microcycle');
  if (!target) {
    target = {
      ...args.program,
      id: `repair-target-program:${args.weekStart}`,
      startDate: args.weekStart,
      endDate: addDaysISO(args.weekStart, 6),
      microcycles: [targetMicrocycle],
      updatedAt: new Date().toISOString(),
    };
  }
  const replan = buildFixtureMinimalReplan({
    profile: args.profile,
    weekStart: args.weekStart,
    sourceWorkouts: sourceCanonicalWorkouts,
    targetMicrocycle,
    availability,
    proposedMarkedDays: args.markedDays,
    priorFixtures,
    proposedFixtures,
    activeFixtureDates,
    userRemovalConstraints: args.userRemovalConstraints,
    mutationIntent: args.mutationIntent ?? 'fixture_transition',
  });
  // Dynamic loading avoids an initialisation cycle: weekRebuild itself uses
  // this transaction owner for its final publication.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildWeekScopedWorkoutOverlay } = require('../utils/weekRebuild');
  const alternatives = replan.alternatives.map((alternative) => {
    const alternativeReplan: FixtureMinimalReplanResult = {
      ...replan,
      workouts: alternative.workouts,
      gateway: alternative.gateway,
      editCost: alternative.editCost,
      changedDays: alternative.changedDays,
      addedDays: alternative.addedDays,
      removedDays: alternative.removedDays,
      preservedCorePlanEntryIds: alternative.preservedCorePlanEntryIds,
    };
    const minimallyReplannedTarget: TrainingProgram = {
      ...target,
      microcycles: target.microcycles.map((microcycle, index) => index === 0 ? {
        ...microcycle,
        workouts: materialiseVisibleSystemWork({
          canonical: alternative.workouts,
          visible: alternative.gateway.visibleWorkouts,
        }),
        exposureContractV2: alternative.gateway.contract,
      } : microcycle),
    };
    return {
      replan: alternativeReplan,
      overlay: buildWeekScopedWorkoutOverlay({
        program: minimallyReplannedTarget,
        weekStart: args.weekStart,
        anchorDate: explicitGameDate,
        reason: explicitGameDate ? 'one_off_game' : 'one_off_no_game',
      }),
    };
  });
  const selected = alternatives[0];
  if (!selected) throw new Error('Fixture replan returned no accepted alternative');
  return {
    profile: args.profile,
    overlay: selected.overlay,
    replan: selected.replan,
    alternatives,
  };
}

export interface RollingHorizonFixtureRepairProjection {
  weekStart: string;
  overlay: WeekScopedWorkoutOverlay;
  replan: FixtureMinimalReplanResult;
}

export interface RollingHorizonFixtureCandidateScore {
  blockingWeeks: number;
  unavailableDayUses: number;
  boundaryHardTransitions: number;
  staleDependencies: number;
  changedCoreSessions: number;
  changedPlanEntryIdsOrPrescriptions: number;
  totalChangedDays: number;
  restDeficit: number;
  releasedFixtureDayPenalty: number;
  optionalBeforeCoreViolation: number;
  patternImbalance: number;
  duplicateStrengthPatternPenalty: number;
  excessiveActiveStreak: number;
}

export interface RollingHorizonFixtureRepairResult {
  outcome: 'accepted' | 'repaired' | 'regenerated' | 'fallback';
  weekStarts: string[];
  projections: RollingHorizonFixtureRepairProjection[];
  totalChangedDays: number;
  horizonScore: RollingHorizonFixtureCandidateScore;
  searchedCandidates: number;
  searchTruncated: boolean;
}

const HORIZON_SCORE_ORDER: readonly (keyof RollingHorizonFixtureCandidateScore)[] = [
  'blockingWeeks',
  'unavailableDayUses',
  'boundaryHardTransitions',
  'staleDependencies',
  'changedCoreSessions',
  'changedPlanEntryIdsOrPrescriptions',
  'totalChangedDays',
  'restDeficit',
  'releasedFixtureDayPenalty',
  'optionalBeforeCoreViolation',
  'patternImbalance',
  'duplicateStrengthPatternPenalty',
  'excessiveActiveStreak',
];

function compareRollingHorizonFixtureScores(
  left: RollingHorizonFixtureCandidateScore,
  right: RollingHorizonFixtureCandidateScore,
): number {
  for (const key of HORIZON_SCORE_ORDER) {
    const delta = left[key] - right[key];
    if (delta !== 0) return delta;
  }
  return 0;
}

function emptyRollingHorizonFixtureScore(): RollingHorizonFixtureCandidateScore {
  return {
    blockingWeeks: 0,
    unavailableDayUses: 0,
    boundaryHardTransitions: 0,
    staleDependencies: 0,
    changedCoreSessions: 0,
    changedPlanEntryIdsOrPrescriptions: 0,
    totalChangedDays: 0,
    restDeficit: 0,
    releasedFixtureDayPenalty: 0,
    optionalBeforeCoreViolation: 0,
    patternImbalance: 0,
    duplicateStrengthPatternPenalty: 0,
    excessiveActiveStreak: 0,
  };
}

function sumFixtureEditCosts(
  projections: readonly RollingHorizonFixtureRepairProjection[],
): FixtureReplanEditCost {
  const seed: FixtureReplanEditCost = {
    section18Blockers: 0,
    unavailableDayUses: 0,
    changedCoreSessions: 0,
    changedDays: 0,
    changedPlanEntryIdsOrPrescriptions: 0,
    releasedFixtureDayPenalty: 0,
    patternImbalance: 0,
    restDeficit: 0,
    duplicateStrengthPatternPenalty: 0,
    excessiveActiveStreak: 0,
    optionalBeforeCoreViolation: 0,
  };
  return projections.reduce((total, projection) => {
    for (const key of Object.keys(seed) as Array<keyof FixtureReplanEditCost>) {
      total[key] += projection.replan.editCost[key];
    }
    return total;
  }, seed);
}

function scoreRollingHorizonFixtureCandidate(args: {
  projections: readonly RollingHorizonFixtureRepairProjection[];
  activeFixtureDates: ReadonlySet<string>;
}): RollingHorizonFixtureCandidateScore {
  const projections = [...args.projections].sort((left, right) =>
    left.weekStart.localeCompare(right.weekStart));
  const costs = sumFixtureEditCosts(projections);
  let boundaryHardTransitions = 0;
  for (let index = 0; index < projections.length - 1; index++) {
    const current = projections[index];
    const following = projections[index + 1];
    if (addDaysISO(current.weekStart, 7) !== following.weekStart) continue;
    const currentHard = current.replan.gateway.evaluation.ledger.restStress.hardDays.includes(0);
    const followingHard = following.replan.gateway.evaluation.ledger.restStress.hardDays.includes(1);
    if (currentHard && followingHard) boundaryHardTransitions += 1;
  }
  const staleDependencies = projections.reduce((total, projection) => total +
    projection.replan.gateway.canonicalWorkouts.reduce((workoutTotal, workout) =>
      workoutTotal + (workout.derivedSessionProvenance ?? []).filter((record) =>
        record.dependency && !args.activeFixtureDates.has(record.dependency.source.date)).length,
    0), 0);
  return {
    blockingWeeks: projections.filter((projection) =>
      projection.replan.gateway.evaluation.blockingViolations.length > 0).length,
    unavailableDayUses: costs.unavailableDayUses,
    boundaryHardTransitions,
    staleDependencies,
    changedCoreSessions: costs.changedCoreSessions,
    changedPlanEntryIdsOrPrescriptions: costs.changedPlanEntryIdsOrPrescriptions,
    totalChangedDays: costs.changedDays,
    restDeficit: costs.restDeficit,
    releasedFixtureDayPenalty: costs.releasedFixtureDayPenalty,
    optionalBeforeCoreViolation: costs.optionalBeforeCoreViolation,
    patternImbalance: costs.patternImbalance,
    duplicateStrengthPatternPenalty: costs.duplicateStrengthPatternPenalty,
    excessiveActiveStreak: costs.excessiveActiveStreak,
  };
}

function rollingHorizonFixtureSignature(
  projections: readonly RollingHorizonFixtureRepairProjection[],
): string {
  return projections.map((projection) => [
    projection.weekStart,
    ...projection.replan.gateway.canonicalWorkouts
      .map((workout) => `${workout.dayOfWeek}:${workout.planEntryId ?? workout.id}:${workout.name}`)
      .sort(),
  ].join('|')).join('||');
}

/**
 * The sole fixture rolling-horizon staging owner. It closes the dependency
 * graph, repairs every materialised week from the same accepted snapshot and
 * returns no partial publication. Callers may commit only the complete result.
 */
export function stageRollingHorizonFixtureRepair(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  beforeMarkedDays: Readonly<Record<string, CalendarDayType>>;
  afterMarkedDays: Record<string, CalendarDayType>;
  sourceSurfaces: AcceptedEffectiveWeekSurfaces;
  activeConstraints?: readonly ActiveConstraint[];
  primaryWeekStarts: readonly string[];
  primaryMutationIntent?: FixtureMutationIntent;
  dependentMutationIntent?: FixtureMutationIntent;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
}): RollingHorizonFixtureRepairResult {
  const trace = currentAthleteActionTrace();
  const primary = new Set(args.primaryWeekStarts.map((weekStart) => mondayForDate(weekStart)));
  const weekStarts = Array.from(new Set([
    ...primary,
    ...rollingHorizonWeekStartsForMutation({
      before: args.beforeMarkedDays,
      after: args.afterMarkedDays,
      surfaces: args.sourceSurfaces,
    }),
  ]))
    .filter((weekStart) => args.program.microcycles.some((microcycle) =>
      weekStart >= microcycle.startDate.slice(0, 10) &&
      weekStart <= microcycle.endDate.slice(0, 10)))
    .sort();
  emitAthleteActionEvent(trace, 'repair_horizon_selected', {
    dependencyWeeksSelected: weekStarts,
    primaryWeeks: Array.from(primary).sort(),
    mutationIntent: args.primaryMutationIntent ?? 'fixture_transition',
    boundary: 'stageRollingHorizonFixtureRepair',
  });
  if (weekStarts.length === 0) {
    return {
      outcome: 'accepted',
      weekStarts: [],
      projections: [],
      totalChangedDays: 0,
      horizonScore: emptyRollingHorizonFixtureScore(),
      searchedCandidates: 0,
      searchTruncated: false,
    };
  }
  const projectionResults = weekStarts.map((weekStart) => ({
    weekStart,
    projection: buildFixtureProjection({
      program: args.program,
      profile: args.profile,
      weekStart,
      markedDays: args.afterMarkedDays,
      sourceSurfaces: args.sourceSurfaces,
      sourceMarkedDays: args.beforeMarkedDays,
      activeConstraints: args.activeConstraints,
      userRemovalConstraints: args.userRemovalConstraints,
      mutationIntent: primary.has(weekStart)
        ? args.primaryMutationIntent ?? 'fixture_transition'
        : args.dependentMutationIntent ?? 'remove_from_date',
    }),
  }));
  const activeFixtureDates = effectiveFixtureDatesForWeeks({
    profile: args.profile,
    markedDays: args.afterMarkedDays,
    weekStarts,
  });
  const search = searchRollingHorizonCandidateCombinations({
    candidateGroups: projectionResults.map(({ weekStart, projection }) =>
      projection.alternatives.map((alternative) => ({
        weekStart,
        overlay: alternative.overlay,
        replan: alternative.replan,
      }))),
    score: (candidate) => scoreRollingHorizonFixtureCandidate({
      projections: candidate,
      activeFixtureDates,
    }),
    compare: compareRollingHorizonFixtureScores,
    signature: rollingHorizonFixtureSignature,
    maxCandidates: 64,
  });
  if (!search) throw new Error('Rolling fixture repair produced no complete horizon candidate');
  const projections = search.candidate;
  const statuses = projections.map((projection) => projection.replan.gateway.status);
  const outcome = statuses.includes('fallback')
    ? 'fallback'
    : statuses.includes('regenerated')
      ? 'regenerated'
      : statuses.includes('repaired')
        ? 'repaired'
        : 'accepted';
  emitAthleteActionEvent(trace, 'repair_candidates_generated', {
    candidateCount: search.searchedCandidates,
    candidateGroupCounts: projectionResults.map(({ projection }) =>
      projection.alternatives.length),
    searchTruncated: search.truncated,
    boundary: 'searchRollingHorizonCandidateCombinations',
  });
  emitAthleteActionEvent(trace, 'repair_candidate_selected', {
    candidateId: athleteActionDiagnosticHash(rollingHorizonFixtureSignature(projections)),
    candidateScore: search.score,
    preservationCost: sumFixtureEditCosts(projections),
    candidateChanges: projections.map((projection) => ({
      weekId: projection.weekStart,
      changedDates: [
        ...projection.replan.changedDays,
        ...projection.replan.addedDays,
        ...projection.replan.removedDays,
      ],
    })),
    outcome,
    boundary: 'stageRollingHorizonFixtureRepair',
  });
  return {
    outcome,
    weekStarts,
    projections,
    totalChangedDays: projections.reduce((total, projection) =>
      total + projection.replan.changedDays.length, 0),
    horizonScore: search.score,
    searchedCandidates: search.searchedCandidates,
    searchTruncated: search.truncated,
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
    if (recurringDay) {
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
  const recurringDay = (args.profile.usualGameDay || args.profile.gameDay) as DayOfWeek | undefined;
  if (recurringDay) {
    const recurringDate = datesInWeek(targetWeekStart)
      .find((date) => dayNameForDate(date) === recurringDay);
    if (recurringDate) markedDays[recurringDate] = 'noGame';
  }
  return markedDays;
}

export function commitCalendarStateTransaction(args: {
  reason: string;
  markedDays: Record<string, CalendarDayType>;
  affectedDates: readonly string[];
  fixtureChangedDates?: readonly string[];
  program?: Partial<AcceptedProgramSurfaces>;
  mutationIntent?: FixtureMutationIntent;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const baseProfile = useProfileStore.getState().onboardingData;
  const prior = materialContext(state);
  const affectedWeeks = new Set(args.affectedDates.map(mondayForDate));
  const fixtureWeeks = new Set((args.fixtureChangedDates ?? []).map(mondayForDate));
  const overlays = {
    ...state.weekScopedOverlays,
    ...(args.program?.weekScopedOverlays ?? {}),
  };
  if (state.currentProgram && baseProfile) {
    const proposedUserRemovalConstraints = args.program?.userRemovalConstraints ??
      state.userRemovalConstraints;
    const repair = stageRollingHorizonFixtureRepair({
      program: state.currentProgram,
      profile: baseProfile,
      beforeMarkedDays: prior.markedDays,
      afterMarkedDays: args.markedDays,
      sourceSurfaces: state,
      activeConstraints: prior.activeConstraints,
      primaryWeekStarts: Array.from(
        args.mutationIntent === 'athlete_removal' ? affectedWeeks : fixtureWeeks,
      ),
      primaryMutationIntent: args.mutationIntent,
      dependentMutationIntent: 'remove_from_date',
      userRemovalConstraints: proposedUserRemovalConstraints,
    });
    for (const projection of repair.projections) {
      affectedWeeks.add(projection.weekStart);
      overlays[projection.weekStart] = projection.overlay;
    }
  }
  return commitAcceptedStateTransaction({
    reason: args.reason,
    program: { ...(args.program ?? {}), weekScopedOverlays: overlays },
    markedDays: args.markedDays,
    validateWeekStarts: Array.from(affectedWeeks),
    profile: baseProfile,
  });
}

/**
 * Atomic whole-session/date removal. The accepted target row remains in the
 * planner input, the proposed rest mark removes that date, and any compulsory
 * exposure is relocated before one program/calendar snapshot is published.
 */
export function commitDateUnavailableTransaction(args: {
  date: string;
  reason: string;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const markedDays = { ...prior.markedDays, [args.date]: 'rest' as const };
  const dateOverrides = { ...state.dateOverrides };
  const overrideContexts = { ...state.overrideContexts };
  delete dateOverrides[args.date];
  delete overrideContexts[args.date];
  return commitCalendarStateTransaction({
    reason: args.reason,
    markedDays,
    affectedDates: [args.date],
    fixtureChangedDates: prior.markedDays[args.date] === 'game' ||
      prior.markedDays[args.date] === 'noGame' ? [args.date] : [],
    program: { dateOverrides, overrideContexts },
    mutationIntent: 'remove_from_date',
  });
}

/**
 * Shared athlete-deletion owner for tap and Coach producers.
 *
 * The typed removal is staged with every repaired week and Contract v2
 * reduction. No producer writes a temporary Rest workout or independently
 * decides whether CORE content is deletable.
 */
export interface AthleteSessionDeletionTransactionInput {
  date: string;
  reason: string;
  source: 'tap' | 'coach';
  scope: UserRemovalScope;
  originalWorkout: Workout;
  remainingWorkout: Workout | null;
  equivalentExposureMayRelocate?: boolean;
}

export function commitAthleteSessionDeletionTransaction(
  args: AthleteSessionDeletionTransactionInput,
): AcceptedStateTransactionResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date.slice(0, 10)) ||
    !args.originalWorkout?.id) {
    throw new Error('Malformed athlete session-deletion identity');
  }
  const date = args.date.slice(0, 10);
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const now = new Date().toISOString();
  const id = userRemovalConstraintId({
    date,
    scope: args.scope,
    workout: args.originalWorkout,
  });
  const existing = state.userRemovalConstraints.find((constraint) =>
    constraint.id === id && constraint.status === 'active');
  if (existing) return { program: programSurfaces(state), context: prior };

  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id,
    authorship: 'user',
    source: args.source,
    status: 'active',
    targetDate: date,
    scope: args.scope,
    targetPlanEntryId: args.originalWorkout.planEntryId ?? null,
    targetWorkoutId: args.originalWorkout.id,
    originalWorkout: JSON.parse(JSON.stringify(args.originalWorkout)) as Workout,
    remainingWorkout: args.remainingWorkout && args.remainingWorkout.workoutType !== 'Rest'
      ? JSON.parse(JSON.stringify(args.remainingWorkout)) as Workout
      : null,
    equivalentExposureMayRelocate: args.equivalentExposureMayRelocate ?? true,
    wholeDayRestOwned: args.scope === 'whole_session',
    createdAt: now,
    restoredAt: null,
    restorationReason: null,
  };
  emitAthleteActionEvent(currentAthleteActionTrace(), 'mutation_constraint_created', {
    constraintType: 'user_removal',
    constraintId: constraint.id,
    constraintStatus: constraint.status,
    targetDate: constraint.targetDate,
    planEntryId: constraint.targetPlanEntryId,
    workoutId: constraint.targetWorkoutId,
    scope: constraint.scope,
    equivalentExposureMayRelocate: constraint.equivalentExposureMayRelocate,
    wholeDayRestOwned: constraint.wholeDayRestOwned,
    provenanceIdentity: `${constraint.authorship}:${constraint.source}:${constraint.id}`,
  });
  const userRemovalConstraints = [
    ...state.userRemovalConstraints.filter((candidate) =>
      !(candidate.targetDate === date && candidate.status === 'active' &&
        (args.scope === 'whole_session' || candidate.scope === args.scope))),
    constraint,
  ];
  const markedDays = { ...prior.markedDays };
  if (args.scope === 'whole_session') markedDays[date] = 'rest';
  const dateOverrides = { ...state.dateOverrides };
  const overrideContexts = { ...state.overrideContexts };
  delete dateOverrides[date];
  delete overrideContexts[date];
  return commitCalendarStateTransaction({
    reason: args.reason,
    markedDays,
    affectedDates: [date],
    fixtureChangedDates: prior.markedDays[date] === 'game' ||
      prior.markedDays[date] === 'noGame' ? [date] : [],
    program: {
      dateOverrides,
      overrideContexts,
      userRemovalConstraints,
      ...(date === todayISOLocal()
        ? { todayWorkout: constraint.remainingWorkout }
        : {}),
    },
    mutationIntent: 'athlete_removal',
  });
}

/**
 * Program-setup rebuild publication. Future weeks come from the newly built
 * program, while the currently accepted effective week is minimally rebased
 * through the same planner so a new availability block relocates compulsory
 * work instead of replacing the athlete's accepted strength structure.
 */
export function commitProgramSetupRebuildTransaction(args: {
  program: TrainingProgram;
  profile: OnboardingData;
  todayISO: string;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const prior = materialContext(state);
  const weekStart = mondayForDate(args.todayISO);
  const selected = args.program.microcycles.find((microcycle) =>
    weekStart >= microcycle.startDate.slice(0, 10) &&
    weekStart <= microcycle.endDate.slice(0, 10)) ?? args.program.microcycles[0] ?? null;
  let overlays: Record<string, WeekScopedWorkoutOverlay> = {};
  const sourceHasWeek = state.currentProgram?.microcycles.some((microcycle) =>
    weekStart >= microcycle.startDate.slice(0, 10) &&
    weekStart <= microcycle.endDate.slice(0, 10));
  const targetHasWeek = args.program.microcycles.some((microcycle) =>
    weekStart >= microcycle.startDate.slice(0, 10) &&
    weekStart <= microcycle.endDate.slice(0, 10));
  if (state.currentProgram && sourceHasWeek && targetHasWeek) {
    overlays = {
      [weekStart]: buildFixtureProjection({
        program: args.program,
        profile: args.profile,
        weekStart,
        markedDays: prior.markedDays,
        sourceSurfaces: state,
        sourceMarkedDays: prior.markedDays,
        activeConstraints: prior.activeConstraints,
        userRemovalConstraints: state.userRemovalConstraints,
        mutationIntent: state.userRemovalConstraints.some((constraint) =>
          constraint.status === 'active' && mondayForDate(constraint.targetDate) === weekStart)
          ? 'athlete_removal'
          : 'remove_from_date',
      }).overlay,
    };
  }
  const todayDow = new Date(`${args.todayISO}T12:00:00`).getDay();
  const todayOverlay = overlays[weekStart]?.workoutsByDate[args.todayISO] ?? null;
  return commitAcceptedStateTransaction({
    reason: 'program_setup:accepted_rebuild',
    program: {
      currentProgram: args.program,
      currentMicrocycle: selected,
      todayWorkout: todayOverlay ??
        selected?.workouts.find((workout) => workout.dayOfWeek === todayDow) ?? null,
      weekScopedOverlays: overlays,
      exposureContractsByWeek: {},
    },
    profile: args.profile,
    programAlreadyAccepted: true,
    validateWeekStarts: Array.from(new Set([
      ...args.program.microcycles.map((microcycle) => microcycle.startDate.slice(0, 10)),
      ...Object.keys(overlays),
    ])),
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
  const state = useProgramStore.getState();
  const weekStarts = rollingHorizonDependencyClosure({
    seedWeekStarts: args.affectedDates.map(mondayForDate),
    changedTriggerDates: args.affectedDates,
    surfaces: state,
  });
  return commitAcceptedStateTransaction({
    reason: args.reason,
    readinessSignalsByDate: args.readinessSignalsByDate,
    validateWeekStarts: weekStarts,
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
