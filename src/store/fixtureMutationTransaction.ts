import type { DayOfWeek, OnboardingData } from '../types/domain';
import type {
  FixtureMutationAction,
  FixtureMutationKind,
  FixtureMutationSourceMetadata,
} from '../types/fixtureMutation';
import type { WholeWeekRepairOutcome } from '../rules/wholeWeekRepairEngine';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  canonicalFixtureKind,
  targetWeekFixtures,
} from '../rules/fixtureConditionedAvailability';
import {
  gameChangeActionFromRebuild,
  upsertGameChangeCoachNoteFromDiff,
  type GameChangeVisibleDay,
} from '../utils/gameChangeCoachNotes';
import { todayISOLocal } from '../utils/appDate';
import { getMondayForDate } from '../utils/sessionResolver';
import { rebuildLocalWeek, type WeekRebuildResult } from '../utils/weekRebuild';
import {
  athleteActionDiagnosticHash,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';
import { useProfileStore } from './profileStore';
import { useProgramStore } from './programStore';
import { runCoachMutationTransaction } from './coachMutationTransaction';

type AppliedFixtureMutationOutcome = Exclude<WholeWeekRepairOutcome, 'impossible'>;

export interface FixtureMutationTransactionInput {
  action: FixtureMutationAction;
  fixtureKind: FixtureMutationKind;
  sourceDate?: string;
  targetDate?: string;
  expectedAcceptedRevision: number;
  source: FixtureMutationSourceMetadata;
  todayISO?: string;
  /** Reuse an existing TraceV2 root when a producer already owns one. */
  trace?: AthleteActionTraceContext;
}

export type FixtureMutationTransactionResult =
  | {
      outcome: AppliedFixtureMutationOutcome;
      result: WeekRebuildResult;
      noteId: string | null;
      acceptedRevision: number;
      traceId: string;
    }
  | {
      outcome: 'no_change' | 'conflicted' | 'impossible';
      reason: string;
      error: unknown;
      noteId: null;
      acceptedRevision: number;
      traceId: string;
    };

interface ResolvedFixtureMutation {
  action: FixtureMutationAction;
  fixtureKind: FixtureMutationKind;
  sourceDate?: string;
  targetDate: string;
  newGameDay: DayOfWeek | null;
  source: FixtureMutationSourceMetadata;
  todayISO: string;
}

type CandidateResult =
  | {
      kind: 'applied';
      outcome: AppliedFixtureMutationOutcome;
      result: WeekRebuildResult;
    }
  | {
      kind: 'conflicted' | 'no_change' | 'impossible';
      reason: string;
      error: unknown;
    };

type NonAppliedCandidate = Exclude<CandidateResult, { kind: 'applied' }>;

class FixtureMutationValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FixtureMutationValidationError';
    this.code = code;
  }
}

const DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function normalizeDate(date: string | undefined, field: string): string | undefined {
  if (date === undefined) return undefined;
  const normalized = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new FixtureMutationValidationError(
      'invalid_fixture_date',
      `Invalid ${field}: ${date}`,
    );
  }
  return normalized;
}

function dayNameForDate(date: string): DayOfWeek {
  return DAY_NAMES[new Date(`${date}T12:00:00`).getDay()]!;
}

function traceTargetDate(input: FixtureMutationTransactionInput): string {
  const candidate = (input.action === 'remove' ? input.sourceDate : input.targetDate)
    ?.slice(0, 10);
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
    ? candidate
    : todayISOLocal();
}

function fixtureFactsForWeeks(args: {
  profile: OnboardingData;
  weekStarts: readonly string[];
}): Array<{ date: string; kind: FixtureMutationKind }> {
  const markedDays = useProgramStore.getState().acceptedMaterialContext.markedDays;
  return args.weekStarts.flatMap((weekStart) =>
    targetWeekFixtures({
      profile: args.profile,
      weekStart,
      markedDays,
    }));
}

function resolveFixtureMutation(
  input: FixtureMutationTransactionInput,
  profile: OnboardingData,
): ResolvedFixtureMutation | NonAppliedCandidate {
  if (!input.source.commandId.trim()) {
    throw new FixtureMutationValidationError(
      'fixture_command_id_required',
      'Fixture mutation source metadata requires a commandId.',
    );
  }
  if (input.trace && input.trace.source !== input.source.producer) {
    throw new FixtureMutationValidationError(
      'fixture_trace_source_mismatch',
      'The supplied TraceV2 token does not match the fixture producer.',
    );
  }
  const currentRevision = useProgramStore.getState().acceptedMaterialContext.revision;
  if (input.expectedAcceptedRevision !== currentRevision) {
    return {
      kind: 'conflicted',
      reason: 'The accepted program changed before the fixture mutation could run.',
      error: new FixtureMutationValidationError(
        'accepted_revision_conflict',
        'The accepted program changed before the fixture mutation could run.',
      ),
    };
  }
  if (input.fixtureKind !== canonicalFixtureKind(profile)) {
    throw new FixtureMutationValidationError(
      'fixture_kind_phase_mismatch',
      `Accepted ${profile.seasonPhase} state does not own ${input.fixtureKind} fixtures.`,
    );
  }
  const sourceDate = normalizeDate(input.sourceDate, 'sourceDate');
  const explicitTargetDate = normalizeDate(input.targetDate, 'targetDate');
  const targetDate = input.action === 'remove' ? sourceDate : explicitTargetDate;
  if (!targetDate) {
    throw new FixtureMutationValidationError(
      'fixture_target_date_required',
      `${input.action} fixture mutation requires a target date.`,
    );
  }
  if (input.action === 'move' && !sourceDate) {
    throw new FixtureMutationValidationError(
      'fixture_source_date_required',
      'Moving a fixture requires a source date.',
    );
  }
  if (input.action === 'add' && sourceDate) {
    throw new FixtureMutationValidationError(
      'fixture_add_source_date_forbidden',
      'Adding a fixture does not accept a source date.',
    );
  }
  if (input.action === 'move' && sourceDate === targetDate) {
    return {
      kind: 'no_change',
      reason: 'The fixture is already on that date.',
      error: new FixtureMutationValidationError(
        'fixture_move_same_date',
        'The fixture is already on that date.',
      ),
    };
  }
  if (
    input.action === 'move' &&
    getMondayForDate(sourceDate!) !== getMondayForDate(targetDate)
  ) {
    throw new FixtureMutationValidationError(
      'cross_week_fixture_move_requires_clarification',
      'Move the fixture within one accepted week in this transaction slice.',
    );
  }
  const weekStarts = Array.from(new Set([
    getMondayForDate(targetDate),
    ...(sourceDate ? [getMondayForDate(sourceDate)] : []),
  ]));
  const facts = fixtureFactsForWeeks({ profile, weekStarts });
  const sourceFact = sourceDate
    ? facts.find((fixture) => fixture.date === sourceDate && fixture.kind === input.fixtureKind)
    : null;
  const targetFact = facts.find((fixture) =>
    fixture.date === targetDate && fixture.kind === input.fixtureKind);
  if ((input.action === 'move' || input.action === 'remove') && !sourceFact) {
    return {
      kind: 'no_change',
      reason: 'The requested source fixture is no longer present.',
      error: new FixtureMutationValidationError(
        'fixture_source_not_present',
        'The requested source fixture is no longer present.',
      ),
    };
  }
  if (input.action === 'add' && targetFact) {
    return {
      kind: 'no_change',
      reason: 'The requested fixture is already present.',
      error: new FixtureMutationValidationError(
        'fixture_already_present',
        'The requested fixture is already present.',
      ),
    };
  }
  if (
    input.action === 'add' &&
    facts.some((fixture) => fixture.kind === input.fixtureKind)
  ) {
    throw new FixtureMutationValidationError(
      'fixture_already_exists_in_target_week',
      'Use a move action when the accepted week already contains a fixture.',
    );
  }
  return {
    action: input.action,
    fixtureKind: input.fixtureKind,
    sourceDate,
    targetDate,
    newGameDay: input.action === 'remove' ? null : dayNameForDate(targetDate),
    source: { ...input.source },
    todayISO: (input.todayISO ?? todayISOLocal()).slice(0, 10),
  };
}

function materializedWeekStarts(): string[] {
  const state = useProgramStore.getState();
  return Array.from(new Set([
    ...(state.currentProgram?.microcycles ?? []).map((week) => week.startDate.slice(0, 10)),
    ...(state.currentMicrocycle ? [state.currentMicrocycle.startDate.slice(0, 10)] : []),
    ...Object.keys(state.weekScopedOverlays),
  ])).sort();
}

function acceptedVisibleRows(
  profile: OnboardingData,
  weekStarts: readonly string[],
): GameChangeVisibleDay[] {
  const state = useProgramStore.getState();
  const markedDays = state.acceptedMaterialContext.markedDays;
  return weekStarts.flatMap((weekStart) => {
    const accepted = rebaseAcceptedEffectiveWeek({
      surfaces: state,
      weekStart,
      profile,
      markedDays,
    });
    const byDay = new Map(accepted.visibleWorkouts.map((workout) =>
      [workout.dayOfWeek, workout]));
    return Array.from({ length: 7 }, (_, offset): GameChangeVisibleDay => {
      const date = addDaysISO(weekStart, offset);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const workout = byDay.get(dayOfWeek);
      return {
        date,
        dayOfWeek,
        workoutName: workout?.name ?? null,
        workoutType: workout?.workoutType ?? null,
        sessionTier: workout?.sessionTier ?? null,
      };
    });
  });
}

function beginFixtureMutationTrace(
  input: FixtureMutationTransactionInput,
  resolvedTargetDate: string,
): AthleteActionTraceContext {
  const sourceDate = input.sourceDate?.slice(0, 10);
  const validSourceDate = sourceDate && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
    ? sourceDate
    : undefined;
  return beginAthleteActionTrace({
    source: input.source.producer,
    actionType: input.fixtureKind === 'practice_match'
      ? 'practice_match_change'
      : 'game_day_change',
    route: 'fixture_mutation_transaction',
    currentWeekId: getMondayForDate(resolvedTargetDate),
    sourceDate: validSourceDate,
    targetDate: resolvedTargetDate,
    sessionDate: resolvedTargetDate,
    scope: `${input.action}_fixture`,
    fixtureId: `${input.fixtureKind}:${validSourceDate ?? resolvedTargetDate}`,
    practiceMatchId: input.fixtureKind === 'practice_match'
      ? `practice_match:${validSourceDate ?? resolvedTargetDate}`
      : null,
    controlId: input.source.surface,
  }, input.trace);
}

function executeCandidate(args: {
  input: FixtureMutationTransactionInput;
  resolved: ResolvedFixtureMutation;
  profile: OnboardingData;
  trace: AthleteActionTraceContext;
}): CandidateResult {
  const currentRevision = useProgramStore.getState().acceptedMaterialContext.revision;
  if (args.input.expectedAcceptedRevision !== currentRevision) {
    return {
      kind: 'conflicted',
      reason: 'The accepted program changed before publication.',
      error: new FixtureMutationValidationError(
        'accepted_revision_conflict',
        'The accepted program changed before publication.',
      ),
    };
  }
  try {
    const result = rebuildLocalWeek({
      baseProfile: args.profile,
      newGameDay: args.resolved.newGameDay,
      scope: 'weekOverlay',
      targetDate: args.resolved.targetDate,
      clearOverlayDate: args.resolved.action === 'move'
        ? args.resolved.sourceDate
        : undefined,
      manageCalendarFixture: true,
      todayISO: args.resolved.todayISO,
      diagnosticSource: args.resolved.source.producer,
      diagnosticActionType: args.resolved.fixtureKind === 'practice_match'
        ? 'practice_match_change'
        : 'game_day_change',
      diagnosticRoute: 'fixture_mutation_rebuild',
      fixtureMutationSource: args.resolved.source,
      trace: args.trace,
    });
    if (!result.reversibleAdjustmentId) {
      return {
        kind: 'no_change',
        reason: 'The fixture request produced no accepted visible change.',
        error: new FixtureMutationValidationError(
          'fixture_no_material_change',
          'The fixture request produced no accepted visible change.',
        ),
      };
    }
    const status = result.fixtureReplan?.gateway.status;
    return {
      kind: 'applied',
      outcome: status === 'impossible' || !status ? 'accepted' : status,
      result,
    };
  } catch (error) {
    return {
      kind: 'impossible',
      reason: error instanceof Error
        ? error.message
        : 'The fixture horizon could not be repaired safely.',
      error,
    };
  }
}

function expectedFixtureStateMatches(
  resolved: ResolvedFixtureMutation,
  profile: OnboardingData,
): boolean {
  const weekStarts = Array.from(new Set([
    getMondayForDate(resolved.targetDate),
    ...(resolved.sourceDate ? [getMondayForDate(resolved.sourceDate)] : []),
  ]));
  const facts = fixtureFactsForWeeks({ profile, weekStarts });
  const hasTarget = facts.some((fixture) =>
    fixture.date === resolved.targetDate && fixture.kind === resolved.fixtureKind);
  const hasSource = resolved.sourceDate
    ? facts.some((fixture) =>
        fixture.date === resolved.sourceDate && fixture.kind === resolved.fixtureKind)
    : false;
  if (resolved.action === 'remove') return !hasSource;
  if (resolved.action === 'move') return hasTarget && !hasSource;
  return hasTarget;
}

function acknowledgedAdjustmentMatches(
  candidate: CandidateResult,
  resolved: ResolvedFixtureMutation,
): boolean {
  if (candidate.kind !== 'applied' || !candidate.result.reversibleAdjustmentId) return false;
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .find((entry) => entry.id === candidate.result.reversibleAdjustmentId);
  return !!adjustment &&
    adjustment.sourceActor === resolved.source.requestedBy &&
    adjustment.sourceSurface === resolved.source.surface &&
    adjustment.sourceActionOrIntentId === resolved.source.commandId &&
    adjustment.sourceProducer === resolved.source.producer &&
    adjustment.sourceTurnId === resolved.source.turnId;
}

function acknowledgedSourceMetadata(
  result: WeekRebuildResult,
): FixtureMutationSourceMetadata {
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .find((entry) => entry.id === result.reversibleAdjustmentId);
  if (!adjustment?.sourceProducer) {
    throw new FixtureMutationValidationError(
      'fixture_acknowledged_source_missing',
      'The acknowledged fixture adjustment is missing typed source metadata.',
    );
  }
  return {
    requestedBy: adjustment.sourceActor,
    producer: adjustment.sourceProducer,
    surface: adjustment.sourceSurface,
    commandId: adjustment.sourceActionOrIntentId,
    ...(adjustment.sourceTurnId ? { turnId: adjustment.sourceTurnId } : {}),
  };
}

function deriveAcknowledgedCoachNote(args: {
  resolved: ResolvedFixtureMutation;
  result: WeekRebuildResult;
  profile: OnboardingData;
  beforeRowsByWeek: ReadonlyMap<string, GameChangeVisibleDay[]>;
  trace: AthleteActionTraceContext;
}): {
  noteId: string | null;
  source: FixtureMutationSourceMetadata;
} {
  const source = acknowledgedSourceMetadata(args.result);
  // Coach Notes are a target-week projection. The reversible ledger retains
  // the complete rolling dependency horizon for restoration.
  const weekStarts = [getMondayForDate(args.resolved.targetDate)];
  const before = weekStarts.flatMap((weekStart) =>
    args.beforeRowsByWeek.get(weekStart) ?? []);
  const after = acceptedVisibleRows(args.profile, weekStarts);
  const noteId = upsertGameChangeCoachNoteFromDiff({
    action: gameChangeActionFromRebuild({
      newGameDay: args.resolved.newGameDay,
      clearOverlayDate: args.resolved.action === 'move'
        ? args.resolved.sourceDate
        : undefined,
    }),
    fixtureKind: args.resolved.fixtureKind,
    targetDate: args.resolved.targetDate,
    previousDate: args.resolved.sourceDate,
    weekStartISO: getMondayForDate(args.resolved.targetDate),
    before,
    after,
    todayISO: args.resolved.todayISO,
    adjustmentId: args.result.reversibleAdjustmentId,
    source,
    traceId: args.trace.traceId,
  });
  return { noteId, source };
}

function emitRequestEvents(
  trace: AthleteActionTraceContext,
  input: FixtureMutationTransactionInput,
  resolved: ResolvedFixtureMutation,
): void {
  emitAthleteActionEvent(trace, 'athlete_action_parsed', {
    parsedMutationType: `${resolved.action}_fixture`,
    fixtureKind: resolved.fixtureKind,
    expectedAcceptedRevision: input.expectedAcceptedRevision,
    requestedBy: resolved.source.requestedBy,
    producer: resolved.source.producer,
    sourceSurface: resolved.source.surface,
    commandId: resolved.source.commandId,
    turnId: resolved.source.turnId ?? null,
    fixtureFactsHash: athleteActionDiagnosticHash(fixtureFactsForWeeks({
      profile: useProfileStore.getState().onboardingData,
      weekStarts: Array.from(new Set([
        getMondayForDate(resolved.targetDate),
        ...(resolved.sourceDate ? [getMondayForDate(resolved.sourceDate)] : []),
      ])),
    })),
  });
  emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
    selectedRoute: 'fixture_mutation_transaction',
    producer: resolved.source.producer,
  });
}

function failureResult(args: {
  candidate: NonAppliedCandidate;
  trace: AthleteActionTraceContext;
}): FixtureMutationTransactionResult {
  const outcome = args.candidate.kind === 'impossible'
    ? 'impossible'
    : args.candidate.kind;
  const failureCode = athleteActionErrorCode(
    args.candidate.error,
    `fixture_mutation_${outcome}`,
  );
  if (outcome !== 'no_change') {
    emitAthleteActionEvent(args.trace, 'athlete_action_failed', {
      outcome,
      internalResultCode: failureCode,
      originalRejectionCode: failureCode,
      rejectionCodes: [failureCode],
      firstFailingBoundary: 'FixtureMutationTransaction',
      failureCategory: classifyAthleteActionFailure(
        failureCode,
        'fixture_mutation_transaction',
      ),
      previousStateRestored: true,
      terminalReasonChain: athleteActionTerminalReasonChain(args.trace.traceId),
    });
  } else {
    emitAthleteActionEvent(args.trace, 'athlete_action_completed', {
      outcome,
      internalResultCode: 'fixture_mutation_no_change',
    });
  }
  return {
    outcome,
    reason: args.candidate.reason,
    error: args.candidate.error,
    noteId: null,
    acceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    traceId: args.trace.traceId,
  };
}

function resolveForExecution(
  input: FixtureMutationTransactionInput,
): {
  profile: OnboardingData;
  resolved: ResolvedFixtureMutation | NonAppliedCandidate;
  resolvedTargetDate: string;
} {
  const profile = useProfileStore.getState().onboardingData;
  if (!profile || !useProgramStore.getState().currentProgram) {
    throw new FixtureMutationValidationError(
      'accepted_fixture_state_required',
      'Fixture mutation requires an accepted profile and program.',
    );
  }
  const resolvedTargetDate = normalizeDate(
    input.action === 'remove' ? input.sourceDate : input.targetDate,
    input.action === 'remove' ? 'sourceDate' : 'targetDate',
  ) ?? todayISOLocal();
  return {
    profile,
    resolved: resolveFixtureMutation(input, profile),
    resolvedTargetDate,
  };
}

/**
 * Screen-neutral in-memory compatibility seam. Production fixture UI uses the
 * durable transaction below; regression tests and temporary adapters may use
 * this to prove parity without owning any fixture policy themselves.
 */
export function executeFixtureMutationInMemory(
  input: FixtureMutationTransactionInput,
): FixtureMutationTransactionResult {
  let prepared: ReturnType<typeof resolveForExecution>;
  try {
    prepared = resolveForExecution(input);
  } catch (error) {
    const trace = beginFixtureMutationTrace(
      input,
      traceTargetDate(input),
    );
    return runWithAthleteActionTrace(trace, () => failureResult({
      candidate: {
        kind: 'impossible',
        reason: error instanceof Error ? error.message : String(error),
        error,
      },
      trace,
    }));
  }
  const trace = beginFixtureMutationTrace(input, prepared.resolvedTargetDate);
  return runWithAthleteActionTrace(trace, () => {
    if ('kind' in prepared.resolved) {
      return failureResult({
        candidate: prepared.resolved,
        trace,
      });
    }
    const resolved = prepared.resolved;
    emitRequestEvents(trace, input, resolved);
    const beforeRowsByWeek = new Map(materializedWeekStarts().map((weekStart) =>
      [weekStart, acceptedVisibleRows(prepared.profile, [weekStart])]));
    const candidate = executeCandidate({
      input,
      resolved,
      profile: prepared.profile,
      trace,
    });
    if (candidate.kind !== 'applied') {
      return failureResult({ candidate, trace });
    }
    const note = deriveAcknowledgedCoachNote({
      resolved,
      result: candidate.result,
      profile: prepared.profile,
      beforeRowsByWeek,
      trace,
    });
    emitAthleteActionEvent(trace, 'coach_notes_result', {
      noteIdentitiesDerived: note.noteId ? [note.noteId] : [],
      sourceCommandId: note.source.commandId,
      sourceProducer: note.source.producer,
      sourceSurface: note.source.surface,
      acknowledgedVisibleState: true,
    });
    emitAthleteActionEvent(trace, 'athlete_action_completed', {
      outcome: candidate.outcome,
      internalResultCode: `fixture_mutation_${candidate.outcome}`,
      reversibleAdjustmentId: candidate.result.reversibleAdjustmentId ?? null,
    });
    return {
      outcome: candidate.outcome,
      result: candidate.result,
      noteId: note.noteId,
      acceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      traceId: trace.traceId,
    };
  });
}

/**
 * FixtureMutationTransaction — the canonical durable add/move/remove owner.
 *
 * It derives profile, phase, fixture facts, visible before rows and the rolling
 * repair horizon from accepted state. Producers supply only typed intent,
 * optimistic revision and source metadata.
 */
export async function executeFixtureMutationTransaction(
  input: FixtureMutationTransactionInput,
): Promise<FixtureMutationTransactionResult> {
  let prepared: ReturnType<typeof resolveForExecution>;
  try {
    prepared = resolveForExecution(input);
  } catch (error) {
    const trace = beginFixtureMutationTrace(
      input,
      traceTargetDate(input),
    );
    return runWithAthleteActionTrace(trace, () => failureResult({
      candidate: {
        kind: 'impossible',
        reason: error instanceof Error ? error.message : String(error),
        error,
      },
      trace,
    }));
  }
  const trace = beginFixtureMutationTrace(input, prepared.resolvedTargetDate);
  return runWithAthleteActionTrace(trace, async () => {
    if ('kind' in prepared.resolved) {
      return failureResult({
        candidate: prepared.resolved,
        trace,
      });
    }
    const resolved = prepared.resolved;
    emitRequestEvents(trace, input, resolved);
    const beforeRowsByWeek = new Map(materializedWeekStarts().map((weekStart) =>
      [weekStart, acceptedVisibleRows(prepared.profile, [weekStart])]));
    const transaction = await runCoachMutationTransaction({
      todayISO: resolved.todayISO,
      extraDates: [
        resolved.sourceDate,
        resolved.targetDate,
      ].filter((date): date is string => !!date),
      mutate: () => executeCandidate({
        input,
        resolved,
        profile: prepared.profile,
        trace,
      }),
      didApply: (candidate) =>
        candidate.kind === 'applied' && !!candidate.result.reversibleAdjustmentId,
      verifyCandidate: ({ value }) => ({
        ok: value.kind === 'applied' &&
          expectedFixtureStateMatches(resolved, prepared.profile),
        reason: 'fixture_candidate_visible_state_mismatch',
      }),
      verifyAfterPersistence: ({ value }) => ({
        ok: value.kind === 'applied' &&
          expectedFixtureStateMatches(resolved, prepared.profile) &&
          acknowledgedAdjustmentMatches(value, resolved),
        reason: 'fixture_acknowledged_state_or_source_mismatch',
      }),
    });
    if (!transaction.ok) {
      const candidate = transaction.value;
      if (candidate && candidate.kind !== 'applied') {
        return failureResult({ candidate, trace });
      }
      return failureResult({
        candidate: {
          kind: 'impossible',
          reason: transaction.reason,
          error: new FixtureMutationValidationError(
            transaction.route,
            transaction.reason,
          ),
        },
        trace,
      });
    }
    const candidate = transaction.value;
    if (candidate.kind !== 'applied') {
      return failureResult({ candidate, trace });
    }
    const note = deriveAcknowledgedCoachNote({
      resolved,
      result: candidate.result,
      profile: prepared.profile,
      beforeRowsByWeek,
      trace,
    });
    emitAthleteActionEvent(trace, 'coach_notes_result', {
      noteIdentitiesDerived: note.noteId ? [note.noteId] : [],
      sourceCommandId: note.source.commandId,
      sourceProducer: note.source.producer,
      sourceSurface: note.source.surface,
      acknowledgedVisibleState: true,
    });
    emitAthleteActionEvent(trace, 'athlete_action_completed', {
      outcome: candidate.outcome,
      internalResultCode: `fixture_mutation_${candidate.outcome}`,
      reversibleAdjustmentId: candidate.result.reversibleAdjustmentId ?? null,
    });
    return {
      outcome: candidate.outcome,
      result: candidate.result,
      noteId: note.noteId,
      acceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      traceId: trace.traceId,
    };
  });
}

function addDaysISO(date: string, offset: number): string {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  parsed.setDate(parsed.getDate() + offset);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

/** Exposed only for permanent ownership/static tests. */
export const FIXTURE_MUTATION_TRANSACTION_NAME = 'FixtureMutationTransaction';
