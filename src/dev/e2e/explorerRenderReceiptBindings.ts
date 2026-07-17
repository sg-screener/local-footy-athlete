import type { ExplorerProductionActionReceipt } from './explorerActionBridge';
import type {
  ExplorerActionFor,
  ExplorerExecutableActionType,
} from './explorerActionBridge';
import type { ExplorerJsonValue } from './explorerScenarioContracts';
import type { ExplorerScenarioStep } from './explorerScenarioContracts';
import type { ExplorerRuntimeRenderReceipt } from './explorerRuntime';
import {
  getAthleteActionTraceV2,
} from '../../utils/athleteActionDiagnostics';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from './athleteActionUIObservation';
import { explorerTestId, stableTestIdToken } from '../../utils/stableTestId';
import { getMondayForDate } from '../../utils/sessionResolver';

export const EXPLORER_RENDER_RECEIPT_VERSION = 1 as const;

export type ExplorerRenderStateWitness =
  | {
      readonly kind: 'fixture';
      readonly fixtureKind: 'game' | 'practice-match';
      readonly sourceDate: string | null;
      readonly targetDate: string | null;
      readonly expectedStatus: 'active' | 'absent';
    }
  | {
      readonly kind: 'session-mutation';
      readonly mutation: 'move' | 'delete' | 'component-delete';
      readonly sessionId: string;
      readonly componentId: string | null;
      readonly sourceDate: string;
      readonly targetDate: string | null;
      readonly adjustmentId: string;
    }
  | {
      readonly kind: 'injury';
      readonly episodeId: string;
      readonly expectedStatus: 'active' | 'resolved';
    }
  | {
      readonly kind: 'readiness';
      readonly readinessId: string;
      readonly date: string;
      readonly expectedStatus: 'active' | 'cleared';
    }
  | {
      readonly kind: 'equipment';
      readonly factId: string;
      readonly expectedStatus: 'active' | 'resolved';
    }
  | {
      readonly kind: 'session-feedback';
      readonly date: string;
      readonly transactionId: string;
      readonly progressionTargetSessionId: string | null;
    }
  | {
      readonly kind: 'adjustment';
      readonly adjustmentId: string;
      readonly adjustmentKind: string;
      readonly targetWeekStart: string | null;
      readonly expectedStatus: 'cleared';
    }
  | {
      readonly kind: 'repeat-week';
      readonly adjustmentId: string;
      readonly targetWeekStart: string;
      readonly expectedStatus: 'active';
    };

export interface ExplorerRenderExpectation {
  readonly protocolVersion: typeof EXPLORER_RENDER_RECEIPT_VERSION;
  readonly traceV2RootId: string;
  readonly observationId: string;
  readonly primaryControlId: string;
  readonly requiredControlIds: readonly string[];
  readonly canonicalSemanticIdentity: string;
  readonly stateWitness: ExplorerRenderStateWitness;
}

export interface ExplorerCorrelatedRenderReceipt
  extends ExplorerRuntimeRenderReceipt {
  readonly protocolVersion: typeof EXPLORER_RENDER_RECEIPT_VERSION;
  readonly observationId: string;
  readonly controlId: string;
  readonly canonicalSemanticIdentity: string;
  readonly externalArtifacts: {
    readonly screenshot: 'captured' | 'missing';
    readonly accessibilityHierarchy: 'captured' | 'missing';
    readonly complete: boolean;
  };
}

export interface ExplorerRenderExpectationInput<
  TActionType extends ExplorerExecutableActionType = ExplorerExecutableActionType,
> {
  readonly action: ExplorerActionFor<TActionType>;
  readonly traceV2RootId: string;
  readonly canonicalSemanticIdentity: string;
  readonly producedAdjustmentId?: string | null;
  readonly exactAdjustmentId?: string | null;
  readonly adjustmentKind?: string | null;
  readonly feedbackTransactionId?: string | null;
  readonly progressionTargetSessionId?: string | null;
}

const pending = new Map<string, ExplorerRenderExpectation>();
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of Array.from(subscribers)) subscriber();
}

function expectationBase(args: ExplorerRenderExpectationInput): Pick<
  ExplorerRenderExpectation,
  'protocolVersion' | 'traceV2RootId' | 'observationId' |
  'canonicalSemanticIdentity'
> {
  return {
    protocolVersion: EXPLORER_RENDER_RECEIPT_VERSION,
    traceV2RootId: args.traceV2RootId,
    observationId: [
      'explorer-render',
      stableTestIdToken(args.traceV2RootId),
      stableTestIdToken(args.canonicalSemanticIdentity),
    ].join(':'),
    canonicalSemanticIdentity: args.canonicalSemanticIdentity,
  };
}

function withControls(
  base: ReturnType<typeof expectationBase>,
  requiredControlIds: readonly string[],
  stateWitness: ExplorerRenderStateWitness,
): ExplorerRenderExpectation {
  if (requiredControlIds.length === 0 || new Set(requiredControlIds).size !==
    requiredControlIds.length) {
    throw new Error('explorer_render_control_identity_invalid');
  }
  return {
    ...base,
    primaryControlId: requiredControlIds[0]!,
    requiredControlIds: [...requiredControlIds],
    stateWitness,
  };
}

/**
 * The render contract is derived only from the validated action plus exact
 * canonical IDs returned by its production owner. Display copy never enters
 * this mapping.
 */
export function buildExplorerRenderExpectation(
  args: ExplorerRenderExpectationInput,
): ExplorerRenderExpectation {
  const base = expectationBase(args);
  const action = args.action;
  switch (action.type) {
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove': {
      const expectedStatus = action.type === 'fixture.remove' ? 'absent' : 'active';
      const sourceDate = action.type === 'fixture.add'
        ? null
        : action.type === 'fixture.move' ? action.args.fromDate : action.args.date;
      const targetDate = action.type === 'fixture.remove'
        ? null
        : action.type === 'fixture.move' ? action.args.toDate : action.args.date;
      return withControls(base, [
        explorerTestId.fixtureState(action.target.fixtureId, expectedStatus),
      ], {
        kind: 'fixture',
        fixtureKind: action.type === 'fixture.add'
          ? action.args.fixtureKind
          : 'game',
        sourceDate,
        targetDate,
        expectedStatus,
      });
    }
    case 'session.move': {
      const adjustmentId = args.producedAdjustmentId;
      if (!adjustmentId) throw new Error('explorer_session_move_adjustment_missing');
      return withControls(base, [explorerTestId.sessionMutationResult(
        'move',
        `${action.target.sessionId}:${action.args.toDate}`,
      )], {
        kind: 'session-mutation',
        mutation: 'move',
        sessionId: action.target.sessionId,
        componentId: null,
        sourceDate: action.args.fromDate,
        targetDate: action.args.toDate,
        adjustmentId,
      });
    }
    case 'session.delete': {
      const adjustmentId = args.producedAdjustmentId;
      if (!adjustmentId) throw new Error('explorer_session_delete_adjustment_missing');
      return withControls(base, [explorerTestId.sessionMutationResult(
        'delete',
        `${action.target.sessionId}:whole_day`,
      )], {
        kind: 'session-mutation',
        mutation: 'delete',
        sessionId: action.target.sessionId,
        componentId: null,
        sourceDate: action.args.date,
        targetDate: null,
        adjustmentId,
      });
    }
    case 'component.delete': {
      const adjustmentId = args.producedAdjustmentId;
      if (!adjustmentId) throw new Error('explorer_component_delete_adjustment_missing');
      return withControls(base, [
        explorerTestId.componentDeleteResult(
          action.target.sessionId,
          action.target.componentId,
        ),
      ], {
        kind: 'session-mutation',
        mutation: 'component-delete',
        sessionId: action.target.sessionId,
        componentId: action.target.componentId,
        sourceDate: action.args.date,
        targetDate: null,
        adjustmentId,
      });
    }
    case 'injury.set':
    case 'injury.resolve': {
      const expectedStatus = action.type === 'injury.set' ? 'active' : 'resolved';
      return withControls(base, [
        expectedStatus === 'active'
          ? explorerTestId.injuryActive(action.target.injuryEpisodeId)
          : explorerTestId.injuryResolved(action.target.injuryEpisodeId),
      ], {
        kind: 'injury',
        episodeId: action.target.injuryEpisodeId,
        expectedStatus,
      });
    }
    case 'readiness.set':
      return withControls(base, [
        explorerTestId.readinessActive(action.target.readinessId),
        explorerTestId.readinessProgrammingEffect(action.target.readinessId),
      ], {
        kind: 'readiness',
        readinessId: action.target.readinessId,
        date: action.args.date,
        expectedStatus: 'active',
      });
    case 'readiness.clear':
      return withControls(base, [
        explorerTestId.readinessClearState(getMondayForDate(action.args.date)),
      ], {
        kind: 'readiness',
        readinessId: action.target.readinessId,
        date: action.args.date,
        expectedStatus: 'cleared',
      });
    case 'equipment.set':
    case 'equipment.clear': {
      const expectedStatus = action.type === 'equipment.set' ? 'active' : 'resolved';
      return withControls(base, [
        expectedStatus === 'active'
          ? explorerTestId.equipmentActive(action.target.equipmentFactId)
          : explorerTestId.equipmentCleared(action.target.equipmentFactId),
      ], {
        kind: 'equipment',
        factId: action.target.equipmentFactId,
        expectedStatus,
      });
    }
    case 'session-feedback.record': {
      const transactionId = args.feedbackTransactionId;
      if (!transactionId) throw new Error('explorer_feedback_transaction_id_missing');
      const controls = [explorerTestId.feedbackReceipt(transactionId)];
      if (args.progressionTargetSessionId) {
        controls.push(explorerTestId.feedbackProgressionTarget(
          transactionId,
          args.progressionTargetSessionId,
        ));
      }
      return withControls(base, controls, {
        kind: 'session-feedback',
        date: action.args.date,
        transactionId,
        progressionTargetSessionId: args.progressionTargetSessionId ?? null,
      });
    }
    case 'adjustment.restore': {
      const adjustmentId = args.exactAdjustmentId;
      if (!adjustmentId) throw new Error('explorer_restore_exact_adjustment_id_missing');
      const controls = [explorerTestId.adjustmentRestored(adjustmentId)];
      if (args.adjustmentKind === 'repeat_week') {
        controls.push(explorerTestId.repeatRestored(adjustmentId));
      }
      return withControls(base, controls, {
        kind: 'adjustment',
        adjustmentId,
        adjustmentKind: args.adjustmentKind ?? 'unknown',
        targetWeekStart: args.adjustmentKind === 'repeat_week'
          ? action.args.restoredOn
          : null,
        expectedStatus: 'cleared',
      });
    }
    case 'week.repeat': {
      const adjustmentId = args.producedAdjustmentId;
      if (!adjustmentId) throw new Error('explorer_repeat_adjustment_id_missing');
      return withControls(base, [explorerTestId.repeatActive(adjustmentId)], {
        kind: 'repeat-week',
        adjustmentId,
        targetWeekStart: action.args.targetWeekStart,
        expectedStatus: 'active',
      });
    }
    default: {
      const exhaustive: never = action;
      throw new Error(`explorer_render_action_unsupported:${String(exhaustive)}`);
    }
  }
}

/**
 * Adds the manifest-owned ingress and oracle selectors to the semantic
 * production witness. The manifest control remains the primary correlation
 * ID; dynamic semantic IDs prove the exact canonical entity that rendered.
 */
export function bindExplorerRenderExpectationToManifestStep(
  expectation: ExplorerRenderExpectation,
  step: ExplorerScenarioStep,
): ExplorerRenderExpectation {
  const requiredControlIds = Array.from(new Set([
    step.controlTestId,
    ...(step.targetTestIds ?? []),
    ...expectation.requiredControlIds,
  ]));
  return {
    ...expectation,
    primaryControlId: step.controlTestId,
    requiredControlIds,
  };
}

export function registerExplorerRenderExpectation(
  expectation: ExplorerRenderExpectation,
  domainReturn: ExplorerJsonValue,
): void {
  pending.set(expectation.traceV2RootId, expectation);
  registerAthleteActionUIOutcome({
    traceId: expectation.traceV2RootId,
    observationId: expectation.observationId,
    domainReturn,
    controlId: expectation.primaryControlId,
  });
  notify();
}

export function subscribeExplorerRenderExpectations(
  subscriber: () => void,
): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function getExplorerRenderExpectations(): readonly ExplorerRenderExpectation[] {
  return Array.from(pending.values());
}

export function recordExplorerRenderedExpectation(args: {
  readonly expectation: ExplorerRenderExpectation;
  readonly renderedControlIds: readonly string[];
  readonly canonicalSemanticIdentity: string;
  readonly accessibilityNode: ExplorerJsonValue;
  readonly screenshotReference?: string;
  readonly hierarchyReference?: string;
}): void {
  const expected = args.expectation;
  if (args.canonicalSemanticIdentity !== expected.canonicalSemanticIdentity ||
    expected.requiredControlIds.some((controlId) =>
      !args.renderedControlIds.includes(controlId))) {
    throw new Error('explorer_render_semantic_identity_mismatch');
  }
  observeRenderedAthleteActionOutcome({
    traceId: expected.traceV2RootId,
    observationId: expected.observationId,
    renderedText: {
      canonicalSemanticIdentity: args.canonicalSemanticIdentity,
      renderedControlIds: [...args.renderedControlIds],
    },
    controlId: expected.primaryControlId,
    accessibilityNode: args.accessibilityNode,
    ...(args.screenshotReference
      ? { screenshotReference: args.screenshotReference }
      : {}),
    ...(args.hierarchyReference
      ? { hierarchyReference: args.hierarchyReference }
      : {}),
  });
  pending.delete(expected.traceV2RootId);
  notify();
}

export interface ExplorerRenderAcceptedSnapshot {
  readonly markedDays: Readonly<Record<string, string>>;
  readonly injuryEpisodes: readonly Array<{ episodeId: string; status: string }>;
  readonly readinessSignalsByDate: Readonly<Record<string, unknown>>;
  readonly temporarySourceFacts: readonly Array<{
    factId?: string;
    status?: string;
  }>;
  readonly reversibleAdjustments: readonly Array<{
    id: string;
    kind: string;
    status: string;
  }>;
  readonly sessionFeedback: Readonly<Record<string, {
    outcomeReceipt?: { transactionId?: string };
  }>>;
  readonly weekScopedOverlayIds: Readonly<Record<string, string | null>>;
  readonly visibleSessions: readonly Array<{
    readonly date: string;
    readonly sessionId: string;
    readonly componentIds: readonly string[];
  }>;
}

/** Pure semantic gate used by the post-render development observer. */
export function explorerRenderExpectationIsSatisfied(
  expectation: ExplorerRenderExpectation,
  snapshot: ExplorerRenderAcceptedSnapshot,
): boolean {
  const witness = expectation.stateWitness;
  switch (witness.kind) {
    case 'fixture': {
      const targetActive = witness.targetDate
        ? snapshot.markedDays[witness.targetDate] === 'game'
        : false;
      const sourceAbsent = witness.sourceDate
        ? snapshot.markedDays[witness.sourceDate] !== 'game'
        : true;
      return witness.expectedStatus === 'active'
        ? targetActive && sourceAbsent
        : sourceAbsent;
    }
    case 'session-mutation':
      return snapshot.reversibleAdjustments.some((adjustment) =>
        adjustment.id === witness.adjustmentId && adjustment.status === 'active') &&
        (witness.mutation === 'move'
          ? snapshot.visibleSessions.some((session) =>
              session.date === witness.targetDate &&
              session.sessionId === witness.sessionId) &&
            !snapshot.visibleSessions.some((session) =>
              session.date === witness.sourceDate &&
              session.sessionId === witness.sessionId)
          : witness.mutation === 'delete'
            ? !snapshot.visibleSessions.some((session) =>
                session.date === witness.sourceDate &&
                session.sessionId === witness.sessionId)
            : snapshot.visibleSessions.some((session) =>
                session.date === witness.sourceDate &&
                session.sessionId === witness.sessionId &&
                witness.componentId !== null &&
                !session.componentIds.includes(witness.componentId)));
    case 'injury':
      return snapshot.injuryEpisodes.some((episode) =>
        episode.episodeId === witness.episodeId && (
          witness.expectedStatus === 'active'
            ? episode.status === 'active' || episode.status === 'improving'
            : episode.status === 'resolved' || episode.status === 'superseded'
        ));
    case 'readiness':
      return witness.expectedStatus === 'active'
        ? Object.prototype.hasOwnProperty.call(
            snapshot.readinessSignalsByDate,
            witness.date,
          )
        : !Object.prototype.hasOwnProperty.call(
            snapshot.readinessSignalsByDate,
            witness.date,
          );
    case 'equipment':
      return snapshot.temporarySourceFacts.some((fact) =>
        fact.factId === witness.factId && fact.status === witness.expectedStatus);
    case 'session-feedback':
      return snapshot.sessionFeedback[witness.date]?.outcomeReceipt?.transactionId ===
        witness.transactionId && (
          witness.progressionTargetSessionId === null ||
          snapshot.visibleSessions.some((session) =>
            session.sessionId === witness.progressionTargetSessionId)
        );
    case 'adjustment':
      return snapshot.reversibleAdjustments.some((adjustment) =>
        adjustment.id === witness.adjustmentId && adjustment.status === 'cleared') &&
        (witness.targetWeekStart === null ||
          !snapshot.weekScopedOverlayIds[witness.targetWeekStart]);
    case 'repeat-week':
      return snapshot.reversibleAdjustments.some((adjustment) =>
        adjustment.id === witness.adjustmentId &&
        adjustment.kind === 'repeat_week' && adjustment.status === 'active') &&
        !!snapshot.weekScopedOverlayIds[witness.targetWeekStart];
  }
}

function expectationFromReceipt(
  receipt: ExplorerProductionActionReceipt,
): ExplorerRenderExpectation | null {
  const payload = receipt.productionReceipt;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const expectation = (payload as Record<string, unknown>).explorerRenderExpectation;
  if (!expectation || typeof expectation !== 'object' || Array.isArray(expectation)) {
    return null;
  }
  return expectation as unknown as ExplorerRenderExpectation;
}

function capturedValue<T>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const field = value as { status?: string; value?: T };
  return field.status === 'captured' ? field.value : undefined;
}

export function readExplorerCorrelatedRenderReceipt(
  receipt: ExplorerProductionActionReceipt,
): ExplorerCorrelatedRenderReceipt | null {
  const expectation = expectationFromReceipt(receipt);
  if (!expectation || expectation.traceV2RootId !== receipt.traceV2RootId) return null;
  const trace = getAthleteActionTraceV2(receipt.traceV2RootId);
  if (!trace) return null;
  const observation = capturedValue<{
    observationId: string;
    actualRenderedText: unknown;
    controlId: unknown;
    screenshotReference: unknown;
    hierarchyReference: unknown;
  }>(trace.evidence.uiObservation);
  if (!observation || observation.observationId !== expectation.observationId) return null;
  const controlId = capturedValue<string>(observation.controlId);
  const rendered = capturedValue<{
    canonicalSemanticIdentity?: string;
    renderedControlIds?: string[];
  }>(observation.actualRenderedText);
  if (controlId !== expectation.primaryControlId ||
    rendered?.canonicalSemanticIdentity !== expectation.canonicalSemanticIdentity ||
    !Array.isArray(rendered.renderedControlIds) ||
    expectation.requiredControlIds.some((required) =>
      !rendered.renderedControlIds!.includes(required))) return null;
  const screenshot = capturedValue<string>(observation.screenshotReference)
    ? 'captured' as const
    : 'missing' as const;
  const hierarchy = capturedValue<string>(observation.hierarchyReference)
    ? 'captured' as const
    : 'missing' as const;
  return {
    protocolVersion: EXPLORER_RENDER_RECEIPT_VERSION,
    traceV2RootId: receipt.traceV2RootId,
    observationId: expectation.observationId,
    controlId,
    canonicalSemanticIdentity: expectation.canonicalSemanticIdentity,
    observedTestIds: [...expectation.requiredControlIds],
    complete: true,
    externalArtifacts: {
      screenshot,
      accessibilityHierarchy: hierarchy,
      complete: screenshot === 'captured' && hierarchy === 'captured',
    },
  };
}

export async function waitForExplorerRenderReceipt(args: {
  readonly receipt: ExplorerProductionActionReceipt;
  readonly timeoutMs?: number;
  readonly pollMs?: number;
}): Promise<ExplorerCorrelatedRenderReceipt | null> {
  const timeoutMs = args.timeoutMs ?? 10_000;
  const pollMs = args.pollMs ?? 20;
  const deadline = Date.now() + timeoutMs;
  let observed = readExplorerCorrelatedRenderReceipt(args.receipt);
  while (!observed && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    observed = readExplorerCorrelatedRenderReceipt(args.receipt);
  }
  return observed;
}

export function __resetExplorerRenderReceiptBindingsForTest(): void {
  pending.clear();
  notify();
}
