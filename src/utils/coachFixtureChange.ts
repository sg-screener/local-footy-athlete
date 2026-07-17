import {
  canonicalFixtureKind,
  targetWeekFixtures,
  type TargetWeekFixture,
} from '../rules/fixtureConditionedAvailability';
import {
  executeFixtureMutationTransaction,
  type FixtureMutationTransactionResult,
} from '../store/fixtureMutationTransaction';
import { useProgramStore } from '../store/programStore';
import type { OnboardingData } from '../types/domain';
import type { FixtureChangeCommand } from '../types/fixtureMutation';
import {
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from './athleteActionDiagnostics';
import type {
  CoachContextPacket,
  FixtureChangeIntent,
  FixtureChangePayload,
  IncompleteFixtureClarificationPayload,
} from './coachIntent';
import type { DispatchOutcome, DispatchReplyMode } from './coachIntentDispatcher';
import { getMondayForDate } from './sessionResolver';

export interface AcceptedCoachFixtureSnapshot {
  expectedAcceptedRevision: number;
  profile: OnboardingData;
  fixtures: TargetWeekFixture[];
  fixtureKind: ReturnType<typeof canonicalFixtureKind>;
}

export interface CoachFixtureChangeDependencies {
  readAcceptedSnapshot: (
    intent: FixtureChangeIntent,
    packet: CoachContextPacket,
  ) => AcceptedCoachFixtureSnapshot | null;
  executeTransaction: (
    command: FixtureChangeCommand & { trace: AthleteActionTraceContext },
  ) => Promise<FixtureMutationTransactionResult>;
}

const APPLIED_OUTCOMES = new Set([
  'accepted',
  'repaired',
  'regenerated',
  'fallback',
]);

function uniqueWeekStarts(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values
    .filter((value): value is string => !!value)
    .map((date) => getMondayForDate(date))));
}

function snapshotWeekStarts(
  intent: FixtureChangeIntent,
  packet: CoachContextPacket,
): string[] {
  const payload = intent.payload;
  if (intent.needsClarification) {
    return uniqueWeekStarts([
      packet.todayISO,
      ...packet.currentWeek.map((day) => day.date),
      ...packet.nextWeek.map((day) => day.date),
      payload.sourceDate,
      payload.targetDate,
    ]);
  }
  if (payload.action === 'add') return uniqueWeekStarts([payload.targetDate]);
  if (payload.action === 'move') {
    return uniqueWeekStarts([payload.targetDate, payload.sourceDate]);
  }
  if (payload.sourceDate) return uniqueWeekStarts([payload.sourceDate]);
  return uniqueWeekStarts([
    packet.todayISO,
    ...packet.currentWeek.map((day) => day.date),
    ...packet.nextWeek.map((day) => day.date),
  ]);
}

/** One read of the accepted material context supplies revision, phase and facts. */
export function readAcceptedCoachFixtureSnapshot(
  intent: FixtureChangeIntent,
  packet: CoachContextPacket,
): AcceptedCoachFixtureSnapshot | null {
  const state = useProgramStore.getState();
  const accepted = state.acceptedMaterialContext;
  const profile = accepted.acceptedProfileSnapshot?.onboardingData;
  if (!state.currentProgram || !profile || accepted.revision < 1) return null;
  const weekStarts = snapshotWeekStarts(intent, packet);
  const fixtures = weekStarts.flatMap((weekStart) =>
    targetWeekFixtures({
      profile,
      weekStart,
      markedDays: accepted.markedDays,
    }));
  const uniqueFixtures = Array.from(new Map(fixtures.map((fixture) =>
    [`${fixture.kind}:${fixture.date}`, fixture])).values())
    .sort((left, right) => left.date.localeCompare(right.date));
  return {
    expectedAcceptedRevision: accepted.revision,
    profile,
    fixtures: uniqueFixtures,
    fixtureKind: canonicalFixtureKind(profile),
  };
}

const liveDependencies: CoachFixtureChangeDependencies = {
  readAcceptedSnapshot: readAcceptedCoachFixtureSnapshot,
  executeTransaction: (command) => executeFixtureMutationTransaction(command),
};

function fixtureLabel(kind: AcceptedCoachFixtureSnapshot['fixtureKind']): string {
  return kind === 'practice_match' ? 'practice match' : 'game';
}

function handled(args: {
  reply: string;
  route: string;
  mutated?: boolean;
  mutationAttempted?: boolean;
  replyMode?: DispatchReplyMode;
}): DispatchOutcome {
  const replyMode = args.replyMode ?? 'fixture_change';
  return {
    handled: true,
    reply: args.reply,
    mutated: args.mutated ?? false,
    replyMode,
    transaction: {
      route: args.route,
      pendingProposalBefore: null,
      mutationAttempted: args.mutationAttempted ?? false,
      eventsEmitted: args.mutated ? 1 : 0,
      eventsApplied: args.mutated ? 1 : 0,
      visibleDiff: [],
      replyMode,
    },
  };
}

function unchanged(reply: string, route: string, mutationAttempted = false): DispatchOutcome {
  return handled({
    reply: `${reply} The accepted plan was not changed or saved.`,
    route,
    mutationAttempted,
  });
}

function incompleteReply(payload: IncompleteFixtureClarificationPayload): string {
  if (payload.missingFields.includes('action')) {
    return 'Do you want to add, move, or remove the fixture?';
  }
  return payload.action === 'move'
    ? 'What date do you want to move the fixture to?'
    : 'What date do you want to add the fixture on?';
}

function sourceFactsForMove(
  payload: Extract<FixtureChangePayload, { action: 'move' }>,
  snapshot: AcceptedCoachFixtureSnapshot,
): TargetWeekFixture[] {
  if (payload.sourceDate) {
    return snapshot.fixtures.filter((fixture) => fixture.date === payload.sourceDate);
  }
  const targetWeek = getMondayForDate(payload.targetDate);
  return snapshot.fixtures.filter((fixture) => getMondayForDate(fixture.date) === targetWeek);
}

function sourceFactsForRemove(
  payload: Extract<FixtureChangePayload, { action: 'remove' }>,
  snapshot: AcceptedCoachFixtureSnapshot,
): TargetWeekFixture[] {
  return payload.sourceDate
    ? snapshot.fixtures.filter((fixture) => fixture.date === payload.sourceDate)
    : snapshot.fixtures;
}

function emitResolutionEvidence(args: {
  trace: AthleteActionTraceContext;
  action?: FixtureChangeCommand['action'];
  sourceDate?: string;
  targetDate?: string;
  fixtureKind: AcceptedCoachFixtureSnapshot['fixtureKind'] | null;
  resolutionStatus: 'resolved' | 'clarification_required' | 'accepted_snapshot_unavailable';
}): void {
  emitAthleteActionEvent(args.trace, 'athlete_action_parsed', {
    resolvedAction: args.action ?? null,
    resolvedSourceDate: args.sourceDate ?? null,
    resolvedTargetDate: args.targetDate ?? null,
    resolvedFixtureKind: args.fixtureKind,
    fixtureResolutionStatus: args.resolutionStatus,
  });
}

function emitTransactionEvidence(
  trace: AthleteActionTraceContext,
  outcome: string,
  fallbackDecision: 'forbidden:deterministic_owner' | 'forbidden:deterministic_failure',
): void {
  emitAthleteActionEvent(trace, 'transaction_verification_result', {
    transactionOutcome: outcome,
    deterministicFallbackDecision: fallbackDecision,
  });
}

function finishResolvedFixtureOutcome(args: {
  trace: AthleteActionTraceContext;
  action: FixtureChangeCommand['action'];
  sourceDate?: string;
  targetDate?: string;
  fixtureKind: AcceptedCoachFixtureSnapshot['fixtureKind'];
  transactionOutcome: string;
  fallbackDecision?: 'forbidden:deterministic_owner' | 'forbidden:deterministic_failure';
  dispatchOutcome: DispatchOutcome;
}): DispatchOutcome {
  emitResolutionEvidence({
    trace: args.trace,
    action: args.action,
    sourceDate: args.sourceDate,
    targetDate: args.targetDate,
    fixtureKind: args.fixtureKind,
    resolutionStatus: args.transactionOutcome.includes('clarification')
      ? 'clarification_required'
      : 'resolved',
  });
  emitTransactionEvidence(
    args.trace,
    args.transactionOutcome,
    args.fallbackDecision ?? 'forbidden:deterministic_owner',
  );
  return args.dispatchOutcome;
}

function failureRoute(result: Extract<FixtureMutationTransactionResult, {
  outcome: 'no_change' | 'conflicted' | 'impossible';
}>): string {
  if (result.outcome !== 'impossible') return `fixture_change_${result.outcome}`;
  const code = result.error && typeof result.error === 'object' &&
    typeof (result.error as { code?: unknown }).code === 'string'
    ? (result.error as { code: string }).code
    : '';
  return /persist|storage|durable/i.test(`${code} ${result.reason}`)
    ? 'fixture_change_persistence_failure'
    : 'fixture_change_impossible';
}

function appliedReply(command: FixtureChangeCommand): string {
  const label = fixtureLabel(command.fixtureKind);
  if (command.action === 'add') {
    return `The ${label} was added on ${command.targetDate} and the accepted plan was saved.`;
  }
  if (command.action === 'move') {
    return `The ${label} was moved from ${command.sourceDate} to ${command.targetDate} and the accepted plan was saved.`;
  }
  return `The ${label} on ${command.sourceDate} was removed and the accepted plan was saved.`;
}

function buildCommand(args: {
  action: FixtureChangeCommand['action'];
  sourceDate?: string;
  targetDate?: string;
  packet: CoachContextPacket;
  snapshot: AcceptedCoachFixtureSnapshot;
}): FixtureChangeCommand | null {
  const turnId = args.packet.turnId?.trim();
  if (!turnId) return null;
  const base = {
    fixtureKind: args.snapshot.fixtureKind,
    expectedAcceptedRevision: args.snapshot.expectedAcceptedRevision,
    todayISO: args.packet.todayISO,
    source: {
      requestedBy: 'athlete' as const,
      producer: 'coach' as const,
      surface: 'coach_chat' as const,
      commandId: `coach-fixture:${turnId}`,
      turnId,
    },
  };
  if (args.action === 'add' && args.targetDate) {
    return { ...base, action: 'add', targetDate: args.targetDate };
  }
  if (args.action === 'move' && args.sourceDate && args.targetDate) {
    return {
      ...base,
      action: 'move',
      sourceDate: args.sourceDate,
      targetDate: args.targetDate,
    };
  }
  if (args.action === 'remove' && args.sourceDate) {
    return { ...base, action: 'remove', sourceDate: args.sourceDate };
  }
  return null;
}

/**
 * Resolve a strict fixture intent into one command for the existing durable
 * transaction. This adapter owns no repair, persistence, rollback or note policy.
 */
export async function executeCoachFixtureChange(
  intent: FixtureChangeIntent,
  packet: CoachContextPacket,
  trace: AthleteActionTraceContext,
  dependencies: CoachFixtureChangeDependencies = liveDependencies,
): Promise<DispatchOutcome> {
  emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
    selectedRoute: 'coach_fixture_change_adapter',
    deterministicFallbackDecision: 'forbidden:deterministic_owner',
  });
  if (intent.needsClarification) {
    emitResolutionEvidence({
      trace,
      action: intent.payload.action,
      sourceDate: intent.payload.sourceDate,
      targetDate: intent.payload.targetDate,
      fixtureKind: intent.payload.explicitFixtureKind ?? null,
      resolutionStatus: 'clarification_required',
    });
    emitTransactionEvidence(trace, 'clarification', 'forbidden:deterministic_owner');
    return handled({
      reply: intent.clarificationQuestion || incompleteReply(intent.payload),
      route: 'fixture_change_clarification',
    });
  }

  let snapshot: AcceptedCoachFixtureSnapshot | null;
  try {
    snapshot = dependencies.readAcceptedSnapshot(intent, packet);
  } catch {
    emitResolutionEvidence({
      trace,
      action: intent.payload.action,
      sourceDate: intent.payload.sourceDate,
      targetDate: intent.payload.targetDate,
      fixtureKind: null,
      resolutionStatus: 'accepted_snapshot_unavailable',
    });
    emitTransactionEvidence(trace, 'dependency_failure', 'forbidden:deterministic_failure');
    return unchanged(
      'I could not read the accepted fixture state.',
      'fixture_change_dependency_failure',
    );
  }
  if (!snapshot) {
    emitResolutionEvidence({
      trace,
      action: intent.payload.action,
      sourceDate: intent.payload.sourceDate,
      targetDate: intent.payload.targetDate,
      fixtureKind: null,
      resolutionStatus: 'accepted_snapshot_unavailable',
    });
    emitTransactionEvidence(trace, 'dependency_failure', 'forbidden:deterministic_failure');
    return unchanged(
      'I could not read the accepted fixture state.',
      'fixture_change_dependency_failure',
    );
  }

  const payload = intent.payload;
  const explicitKind = payload.explicitFixtureKind;
  if (explicitKind && explicitKind !== snapshot.fixtureKind) {
    const acceptedLabel = fixtureLabel(snapshot.fixtureKind);
    const requestedLabel = fixtureLabel(explicitKind);
    return finishResolvedFixtureOutcome({
      trace,
      action: payload.action,
      sourceDate: payload.sourceDate,
      targetDate: payload.targetDate,
      fixtureKind: snapshot.fixtureKind,
      transactionOutcome: 'kind_conflict_clarification',
      dispatchOutcome: handled({
        reply: `Your accepted phase treats fixtures as a ${acceptedLabel}, but you said ${requestedLabel}. Which did you mean?`,
        route: 'fixture_change_kind_conflict_clarification',
      }),
    });
  }

  let sourceDate: string | undefined;
  let targetDate: string | undefined;
  if (payload.action === 'add') {
    targetDate = payload.targetDate;
    const targetWeek = getMondayForDate(targetDate);
    const targetWeekFacts = snapshot.fixtures.filter((fixture) =>
      getMondayForDate(fixture.date) === targetWeek);
    if (targetWeekFacts.some((fixture) => fixture.date === targetDate)) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'no_change',
        dispatchOutcome: unchanged(
          `The ${fixtureLabel(snapshot.fixtureKind)} is already on ${targetDate}.`,
          'fixture_change_no_change',
        ),
      });
    }
    if (targetWeekFacts.length > 0) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'rejected_add_requires_explicit_move',
        dispatchOutcome: unchanged(
          `There is already a ${fixtureLabel(snapshot.fixtureKind)} on ${targetWeekFacts[0]!.date}. Ask me to move it explicitly if you want it on ${targetDate}.`,
          'fixture_change_rejected_add_requires_explicit_move',
        ),
      });
    }
  } else if (payload.action === 'move') {
    targetDate = payload.targetDate;
    const candidates = sourceFactsForMove(payload, snapshot);
    if (payload.sourceDate && candidates.length === 0) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        sourceDate: payload.sourceDate,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'no_change_source_missing',
        dispatchOutcome: unchanged(
          `There is no accepted ${fixtureLabel(snapshot.fixtureKind)} on ${payload.sourceDate}.`,
          'fixture_change_no_change_source_missing',
        ),
      });
    }
    if (!payload.sourceDate && candidates.length === 0) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'no_change_source_missing',
        dispatchOutcome: unchanged(
          `There is no accepted ${fixtureLabel(snapshot.fixtureKind)} to move in that week.`,
          'fixture_change_no_change_source_missing',
        ),
      });
    }
    if (!payload.sourceDate && candidates.length > 1) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'source_clarification',
        dispatchOutcome: handled({
          reply: `Which fixture date do you want to move: ${candidates.map((fixture) => fixture.date).join(' or ')}?`,
          route: 'fixture_change_source_clarification',
        }),
      });
    }
    sourceDate = payload.sourceDate ?? candidates[0]!.date;
    if (sourceDate === targetDate) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        sourceDate,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'no_change_same_date',
        dispatchOutcome: unchanged(
          `The ${fixtureLabel(snapshot.fixtureKind)} is already on ${targetDate}.`,
          'fixture_change_no_change_same_date',
        ),
      });
    }
    if (getMondayForDate(sourceDate) !== getMondayForDate(targetDate)) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        sourceDate,
        targetDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'cross_week_clarification',
        dispatchOutcome: handled({
          reply: 'That move crosses accepted weeks. Which date in the same week should I move the fixture to?',
          route: 'fixture_change_cross_week_clarification',
        }),
      });
    }
  } else {
    const candidates = sourceFactsForRemove(payload, snapshot);
    if (payload.sourceDate && candidates.length === 0) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        sourceDate: payload.sourceDate,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'no_change_source_missing',
        dispatchOutcome: unchanged(
          `There is no accepted ${fixtureLabel(snapshot.fixtureKind)} on ${payload.sourceDate}.`,
          'fixture_change_no_change_source_missing',
        ),
      });
    }
    if (!payload.sourceDate && candidates.length === 0) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'no_change_source_missing',
        dispatchOutcome: unchanged(
          `There is no accepted ${fixtureLabel(snapshot.fixtureKind)} in the current or next Coach horizon.`,
          'fixture_change_no_change_source_missing',
        ),
      });
    }
    if (!payload.sourceDate && candidates.length > 1) {
      return finishResolvedFixtureOutcome({
        trace,
        action: payload.action,
        fixtureKind: snapshot.fixtureKind,
        transactionOutcome: 'source_clarification',
        dispatchOutcome: handled({
          reply: `Which fixture date do you want to remove: ${candidates.map((fixture) => fixture.date).join(' or ')}?`,
          route: 'fixture_change_source_clarification',
        }),
      });
    }
    sourceDate = payload.sourceDate ?? candidates[0]!.date;
  }

  const command = buildCommand({
    action: payload.action,
    sourceDate,
    targetDate,
    packet,
    snapshot,
  });
  if (!command) {
    emitResolutionEvidence({
      trace,
      action: payload.action,
      sourceDate,
      targetDate,
      fixtureKind: snapshot.fixtureKind,
      resolutionStatus: 'resolved',
    });
    emitTransactionEvidence(trace, 'dependency_failure', 'forbidden:deterministic_failure');
    return unchanged(
      'I could not create a stable command for that fixture request.',
      'fixture_change_dependency_failure',
    );
  }
  emitResolutionEvidence({
    trace,
    action: command.action,
    sourceDate: command.sourceDate,
    targetDate: command.targetDate,
    fixtureKind: command.fixtureKind,
    resolutionStatus: 'resolved',
  });

  let result: FixtureMutationTransactionResult;
  try {
    result = await dependencies.executeTransaction({ ...command, trace });
  } catch {
    emitTransactionEvidence(trace, 'exception', 'forbidden:deterministic_failure');
    return unchanged(
      'The fixture transaction failed unexpectedly.',
      'fixture_change_exception',
      true,
    );
  }

  if (APPLIED_OUTCOMES.has(result.outcome) && 'result' in result) {
    emitTransactionEvidence(trace, result.outcome, 'forbidden:deterministic_owner');
    return handled({
      reply: appliedReply(command),
      route: `fixture_change_applied_${result.outcome}`,
      mutated: true,
      mutationAttempted: true,
    });
  }

  const failed = result as Extract<FixtureMutationTransactionResult, {
    outcome: 'no_change' | 'conflicted' | 'impossible';
  }>;
  const route = failureRoute(failed);
  const fallbackDecision = route === 'fixture_change_no_change'
    ? 'forbidden:deterministic_owner'
    : 'forbidden:deterministic_failure';
  emitTransactionEvidence(trace, failed.outcome, fallbackDecision);
  return unchanged(
    failed.outcome === 'conflicted'
      ? 'The accepted plan changed before this fixture request could be saved.'
      : failed.outcome === 'no_change'
        ? failed.reason
        : route === 'fixture_change_persistence_failure'
          ? 'The fixture change could not be saved durably.'
          : 'The fixture change could not be applied safely.',
    route,
    true,
  );
}
