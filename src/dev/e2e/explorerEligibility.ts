import type {
  ExplorerActionType,
  ExplorerCapabilityId,
  ExplorerEligibilityPredicate,
  ExplorerScenarioStep,
  ExplorerSourceFactType,
} from './explorerScenarioContracts';
import { explorerActionCapability } from './explorerScenarioContracts';

export const EXPLORER_ELIGIBILITY_REASON = Object.freeze({
  ELIGIBLE: 'eligible',
  MISSING_WITNESS: 'missing_eligibility_witness',
  STALE_WITNESS: 'stale_eligibility_witness',
  PREDICATE_FAILED: 'eligibility_predicate_failed',
  CAPABILITY_DISABLED: 'capability_disabled',
  MISSING_RENDER_WITNESS: 'missing_render_witness',
} as const);

export type ExplorerEligibilityReasonCode =
  (typeof EXPLORER_ELIGIBILITY_REASON)[keyof typeof EXPLORER_ELIGIBILITY_REASON];

export interface ExplorerEligibilityIdentityWitness {
  readonly id: string;
  readonly date: string;
}

export interface ExplorerComponentEligibilityWitness {
  readonly sessionId: string;
  readonly componentId: string;
  readonly date: string;
}

export interface ExplorerSourceFactEligibilityWitness {
  readonly sourceFactId: string;
  readonly sourceFactType: ExplorerSourceFactType;
}

export interface ExplorerAdjustmentEligibilityWitness {
  readonly adjustmentId: string;
  readonly status: 'active' | 'restored';
}

export interface ExplorerCardDetailEligibilityWitness {
  readonly sessionId: string;
  readonly date: string;
  readonly equal: boolean;
}

/**
 * A deterministic snapshot of accepted witness state. Optional collections are
 * deliberate: absence means the witness was not captured, not an empty fact
 * set. This distinction makes eligibility fail closed.
 */
export interface ExplorerEligibilityWitnessState {
  readonly acceptedRevision: number;
  readonly witnessRevision: number;
  readonly acceptedWeekCount?: number;
  readonly phaseSignatures?: readonly string[];
  readonly fixtures?: readonly ExplorerEligibilityIdentityWitness[];
  readonly sessions?: readonly ExplorerEligibilityIdentityWitness[];
  readonly components?: readonly ExplorerComponentEligibilityWitness[];
  readonly eligibleTargetDates?: ReadonlyArray<{
    readonly date: string;
    readonly actionTypes: readonly ExplorerActionType[];
  }>;
  readonly sourceFacts?: readonly ExplorerSourceFactEligibilityWitness[];
  readonly reversibleAdjustments?: readonly ExplorerAdjustmentEligibilityWitness[];
  readonly cardDetailEqualities?: readonly ExplorerCardDetailEligibilityWitness[];
  readonly interpretationReceiptIds?: readonly string[];
  readonly availableCapabilities?: readonly ExplorerCapabilityId[];
  readonly availableRenderTestIds?: readonly string[];
}

export interface ExplorerEligibilityPredicateReceipt {
  readonly predicateId: string;
  readonly predicateType: ExplorerEligibilityPredicate['type'];
  readonly passed: boolean;
  readonly witnessId: string | null;
  readonly reasonCode: ExplorerEligibilityReasonCode;
}

export interface ExplorerStepEligibilityReceipt {
  readonly stepId: string;
  readonly status: 'eligible' | 'blocked';
  readonly reasonCode: ExplorerEligibilityReasonCode;
  readonly failedPredicateId: string | null;
  readonly witnessIds: readonly string[];
  readonly predicateReceipts: readonly ExplorerEligibilityPredicateReceipt[];
}

function witnessId(predicate: ExplorerEligibilityPredicate): string {
  return `eligibility:${predicate.type}:${predicate.predicateId}`;
}

function missing(
  predicate: ExplorerEligibilityPredicate,
): ExplorerEligibilityPredicateReceipt {
  return {
    predicateId: predicate.predicateId,
    predicateType: predicate.type,
    passed: false,
    witnessId: null,
    reasonCode: EXPLORER_ELIGIBILITY_REASON.MISSING_WITNESS,
  };
}
function evaluated(
  predicate: ExplorerEligibilityPredicate,
  passed: boolean,
): ExplorerEligibilityPredicateReceipt {
  return {
    predicateId: predicate.predicateId,
    predicateType: predicate.type,
    passed,
    witnessId: witnessId(predicate),
    reasonCode: passed
      ? EXPLORER_ELIGIBILITY_REASON.ELIGIBLE
      : EXPLORER_ELIGIBILITY_REASON.PREDICATE_FAILED,
  };
}

function evaluateCount(
  actual: number,
  predicate: Extract<ExplorerEligibilityPredicate, { type: 'accepted-week-count' }>,
): boolean {
  if (predicate.operator === 'equals') return actual === predicate.count;
  if (predicate.operator === 'at-least') return actual >= predicate.count;
  return actual <= predicate.count;
}

export function evaluateExplorerEligibilityPredicate(
  predicate: ExplorerEligibilityPredicate,
  state: ExplorerEligibilityWitnessState,
): ExplorerEligibilityPredicateReceipt {
  switch (predicate.type) {
    case 'accepted-week-count':
      return state.acceptedWeekCount === undefined
        ? missing(predicate)
        : evaluated(predicate, evaluateCount(state.acceptedWeekCount, predicate));
    case 'phase-signature':
      return state.phaseSignatures === undefined
        ? missing(predicate)
        : evaluated(predicate, state.phaseSignatures.includes(predicate.signature));
    case 'fixture-exists':
    case 'fixture-absent': {
      if (state.fixtures === undefined) return missing(predicate);
      const exists = state.fixtures.some((fixture) =>
        fixture.id === predicate.fixtureId && fixture.date === predicate.date);
      return evaluated(predicate, predicate.type === 'fixture-exists' ? exists : !exists);
    }
    case 'session-exists':
      return state.sessions === undefined
        ? missing(predicate)
        : evaluated(predicate, state.sessions.some((session) =>
            session.id === predicate.sessionId && session.date === predicate.date));
    case 'component-exists':
      return state.components === undefined
        ? missing(predicate)
        : evaluated(predicate, state.components.some((component) =>
            component.sessionId === predicate.sessionId &&
            component.componentId === predicate.componentId &&
            component.date === predicate.date));
    case 'eligible-target-date':
      return state.eligibleTargetDates === undefined
        ? missing(predicate)
        : evaluated(predicate, state.eligibleTargetDates.some((target) =>
            target.date === predicate.date &&
            target.actionTypes.includes(predicate.forActionType)));
    case 'source-fact-exists':
    case 'source-fact-absent': {
      if (state.sourceFacts === undefined) return missing(predicate);
      const exists = state.sourceFacts.some((fact) =>
        fact.sourceFactId === predicate.sourceFactId &&
        fact.sourceFactType === predicate.sourceFactType);
      return evaluated(predicate, predicate.type === 'source-fact-exists' ? exists : !exists);
    }
    case 'reversible-adjustment-status':
      return state.reversibleAdjustments === undefined
        ? missing(predicate)
        : evaluated(predicate, state.reversibleAdjustments.some((adjustment) =>
            adjustment.adjustmentId === predicate.adjustmentId &&
            adjustment.status === predicate.status));
    case 'accepted-revision':
      return evaluated(predicate, state.acceptedRevision === predicate.revision);
    case 'card-detail-equality':
      return state.cardDetailEqualities === undefined
        ? missing(predicate)
        : evaluated(predicate, state.cardDetailEqualities.some((witness) =>
            witness.sessionId === predicate.sessionId &&
            witness.date === predicate.date && witness.equal));
    case 'coach-interpretation-receipt-available': {
      if (state.interpretationReceiptIds === undefined) return missing(predicate);
      const id = `${predicate.conversationId}:${predicate.messageId}`;
      return evaluated(predicate, state.interpretationReceiptIds.includes(id));
    }
    default: {
      const exhaustive: never = predicate;
      return exhaustive;
    }
  }
}

export function evaluateExplorerStepEligibility(args: {
  readonly step: ExplorerScenarioStep;
  readonly state: ExplorerEligibilityWitnessState;
}): ExplorerStepEligibilityReceipt {
  const { step, state } = args;
  if (state.witnessRevision !== state.acceptedRevision) {
    return {
      stepId: step.stepId,
      status: 'blocked',
      reasonCode: EXPLORER_ELIGIBILITY_REASON.STALE_WITNESS,
      failedPredicateId: null,
      witnessIds: [],
      predicateReceipts: [],
    };
  }
  const capability = explorerActionCapability(step.action);
  if (capability && (
    capability.status !== 'enabled' ||
    state.availableCapabilities === undefined ||
    !state.availableCapabilities.includes(capability.capabilityId)
  )) {
    return {
      stepId: step.stepId,
      status: 'blocked',
      reasonCode: EXPLORER_ELIGIBILITY_REASON.CAPABILITY_DISABLED,
      failedPredicateId: null,
      witnessIds: [],
      predicateReceipts: [],
    };
  }
  const requiredRenderTestIds = [step.controlTestId, ...(step.targetTestIds ?? [])];
  if (step.checkpointPolicy.kind !== 'none' &&
    step.checkpointPolicy.renderedProof === 'required' && (
      state.availableRenderTestIds === undefined ||
      requiredRenderTestIds.some((testId) =>
        !state.availableRenderTestIds!.includes(testId))
    )) {
    return {
      stepId: step.stepId,
      status: 'blocked',
      reasonCode: EXPLORER_ELIGIBILITY_REASON.MISSING_RENDER_WITNESS,
      failedPredicateId: null,
      witnessIds: [],
      predicateReceipts: [],
    };
  }
  const receipts = step.preconditions.map((predicate) =>
    evaluateExplorerEligibilityPredicate(predicate, state));
  const failure = receipts.find((receipt) => !receipt.passed) ?? null;
  return {
    stepId: step.stepId,
    status: failure ? 'blocked' : 'eligible',
    reasonCode: failure?.reasonCode ?? EXPLORER_ELIGIBILITY_REASON.ELIGIBLE,
    failedPredicateId: failure?.predicateId ?? null,
    witnessIds: receipts
      .map((receipt) => receipt.witnessId)
      .filter((id): id is string => id !== null),
    predicateReceipts: receipts,
  };
}
