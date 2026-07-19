import {
  explorerActionSemanticHash,
  type ExplorerActionSemanticHash,
} from './explorerScenarioContractValidation';
import type {
  ExplorerAction,
  ExplorerActionType,
  ExplorerJsonValue,
} from './explorerScenarioContracts';
import { stableSemanticJsonV2 } from '../../utils/semanticFingerprintV2';

export const EXPLORER_PRODUCTION_RECEIPT_VERSION = 1 as const;

export const EXPLORER_PRODUCTION_RECEIPT_STATUSES = [
  'applied',
  'rejected',
  'no-change',
  'conflict',
  'failure',
] as const;

export type ExplorerProductionReceiptStatus =
  (typeof EXPLORER_PRODUCTION_RECEIPT_STATUSES)[number];

export type ExplorerExecutableAction = Exclude<
  ExplorerAction,
  { readonly type: 'coach.message' }
>;

export type ExplorerExecutableActionType = ExplorerExecutableAction['type'];

export type ExplorerActionFor<TActionType extends ExplorerActionType> =
  Extract<ExplorerAction, { readonly type: TActionType }>;

/**
 * One adapter name per canonical production owner. Several action types may
 * intentionally share an owner, but Explorer never owns a mutation itself.
 */
export const EXPLORER_PRODUCTION_OWNER_BY_ACTION = Object.freeze({
  'fixture.add': 'executeFixtureMutationTransaction',
  'fixture.move': 'executeFixtureMutationTransaction',
  'fixture.remove': 'executeFixtureMutationTransaction',
  'session.move': 'commitAthleteSessionMoveTransaction',
  'session.delete': 'commitAthleteSessionDeletionTransaction',
  'component.delete': 'commitAthleteSessionDeletionTransaction',
  'injury.set': 'updateInjuryEpisode',
  'injury.resolve': 'resolveInjuryEpisode',
  'readiness.set': 'commitReadinessSignalTransaction',
  'readiness.clear': 'commitReadinessSignalTransaction',
  'equipment.set': 'transactTemporarySourceFact',
  'equipment.clear': 'transactTemporarySourceFact',
  'session-feedback.record': 'commitSessionOutcomeTransaction',
  'adjustment.restore': 'clearReversibleAdjustment',
  'week.repeat': 'repeatWeekIntoNextWeek',
} as const satisfies Readonly<Record<ExplorerExecutableActionType, string>>);

export type ExplorerProductionOwnerName =
  (typeof EXPLORER_PRODUCTION_OWNER_BY_ACTION)[ExplorerExecutableActionType];

export const EXPLORER_ACTION_BRIDGE_FAILURE = Object.freeze({
  CAPABILITY_DISABLED: 'capability_disabled',
  ADAPTER_MISSING: 'production_adapter_missing',
  ADAPTER_TYPE_MISMATCH: 'production_adapter_type_mismatch',
  OWNER_MISMATCH: 'production_owner_mismatch',
  ACTION_HASH_MISMATCH: 'manifest_production_action_hash_mismatch',
  TARGET_MISMATCH: 'manifest_production_target_mismatch',
  REVISION_MISMATCH: 'accepted_revision_mismatch',
  REVISION_TRANSITION_INVALID: 'accepted_revision_transition_invalid',
  TRACE_ROOT_MISSING: 'trace_v2_root_missing',
  RECEIPT_ID_MISSING: 'production_receipt_id_missing',
  REASON_CODE_MISSING: 'production_reason_code_missing',
  RECEIPT_INVALID: 'production_receipt_invalid',
} as const);

export type ExplorerActionBridgeFailureCode =
  (typeof EXPLORER_ACTION_BRIDGE_FAILURE)[keyof typeof EXPLORER_ACTION_BRIDGE_FAILURE];

export class ExplorerActionBridgeError extends Error {
  readonly reasonCode: ExplorerActionBridgeFailureCode;

  constructor(reasonCode: ExplorerActionBridgeFailureCode, detail?: string) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerActionBridgeError';
    this.reasonCode = reasonCode;
  }
}

/**
 * The adapter returns the canonical owner's result as data. This contract does
 * not contain callbacks that can publish accepted state, rebuild a week, write
 * persistence, roll back, or restore facts; those remain production-owned.
 */
export interface ExplorerProductionOwnerResult<
  TActionType extends ExplorerExecutableActionType = ExplorerExecutableActionType,
> {
  readonly actionType: TActionType;
  readonly actionSemanticHash: ExplorerActionSemanticHash;
  readonly target: ExplorerActionFor<TActionType>['target'];
  readonly status: ExplorerProductionReceiptStatus;
  readonly owner: ExplorerProductionOwnerName;
  readonly receiptId: string;
  readonly traceV2RootId: string;
  readonly acceptedRevisionBefore: number;
  readonly acceptedRevisionAfter: number;
  readonly reasonCode: string | null;
  readonly durable: boolean;
  readonly productionReceipt: ExplorerJsonValue;
}

export interface ExplorerProductionActionReceipt<
  TActionType extends ExplorerExecutableActionType = ExplorerExecutableActionType,
> extends ExplorerProductionOwnerResult<TActionType> {
  readonly protocolVersion: typeof EXPLORER_PRODUCTION_RECEIPT_VERSION;
}

export interface ExplorerActionClaimReceipt {
  readonly campaignId?: string;
  readonly scenarioId: string;
  readonly stepId: string;
  readonly intendedActionSemanticHash: ExplorerActionSemanticHash;
  readonly expectedAcceptedRevision: number;
  readonly priorActionTraceId: string | null;
}

export interface ExplorerProductionAdapterContext {
  readonly claim: ExplorerActionClaimReceipt;
}

export interface ExplorerProductionActionAdapter<
  TActionType extends ExplorerExecutableActionType,
> {
  readonly actionType: TActionType;
  readonly owner: (typeof EXPLORER_PRODUCTION_OWNER_BY_ACTION)[TActionType];
  readonly invokeProductionOwner: (
    action: ExplorerActionFor<TActionType>,
    context: ExplorerProductionAdapterContext,
  ) => Promise<ExplorerProductionOwnerResult<TActionType>>;
}

export type ExplorerProductionActionAdapters = {
  readonly [TActionType in ExplorerExecutableActionType]:
    ExplorerProductionActionAdapter<TActionType>;
};

function fail(code: ExplorerActionBridgeFailureCode, detail?: string): never {
  throw new ExplorerActionBridgeError(code, detail);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function sameStableValue(left: unknown, right: unknown): boolean {
  return stableSemanticJsonV2(left) === stableSemanticJsonV2(right);
}

function assertReceiptShape(
  result: ExplorerProductionOwnerResult,
): void {
  if (!EXPLORER_PRODUCTION_RECEIPT_STATUSES.includes(result.status) ||
    !nonEmpty(result.receiptId) ||
    !nonEmpty(result.traceV2RootId) ||
    !validRevision(result.acceptedRevisionBefore) ||
    !validRevision(result.acceptedRevisionAfter) ||
    result.durable !== true ||
    result.productionReceipt === undefined) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.RECEIPT_INVALID);
  }
  if (result.status === 'applied') {
    // Some accepted facts (notably session feedback) are durably versioned by
    // their own canonical receipt while the program material revision remains
    // unchanged. The manifest still declares the exact expected delta.
    if (result.acceptedRevisionAfter < result.acceptedRevisionBefore) {
      fail(EXPLORER_ACTION_BRIDGE_FAILURE.REVISION_TRANSITION_INVALID, result.status);
    }
    if (result.reasonCode !== null) {
      fail(EXPLORER_ACTION_BRIDGE_FAILURE.RECEIPT_INVALID, 'applied_reason_code');
    }
  } else {
    if (result.acceptedRevisionAfter !== result.acceptedRevisionBefore) {
      fail(EXPLORER_ACTION_BRIDGE_FAILURE.REVISION_TRANSITION_INVALID, result.status);
    }
    if (!nonEmpty(result.reasonCode)) {
      fail(EXPLORER_ACTION_BRIDGE_FAILURE.REASON_CODE_MISSING, result.status);
    }
  }
}

function validateOwnerResult<TActionType extends ExplorerExecutableActionType>(
  action: ExplorerActionFor<TActionType>,
  adapter: ExplorerProductionActionAdapter<TActionType>,
  context: ExplorerProductionAdapterContext,
  result: ExplorerProductionOwnerResult<TActionType>,
): ExplorerProductionActionReceipt<TActionType> {
  assertReceiptShape(result);
  const expectedOwner = EXPLORER_PRODUCTION_OWNER_BY_ACTION[action.type];
  const expectedHash = explorerActionSemanticHash(action);
  if (adapter.actionType !== action.type || result.actionType !== action.type) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.ADAPTER_TYPE_MISMATCH, action.type);
  }
  if (adapter.owner !== expectedOwner || result.owner !== expectedOwner) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.OWNER_MISMATCH, action.type);
  }
  if (context.claim.intendedActionSemanticHash !== expectedHash ||
    result.actionSemanticHash !== expectedHash) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.ACTION_HASH_MISMATCH, action.type);
  }
  if (!sameStableValue(result.target, action.target)) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.TARGET_MISMATCH, action.type);
  }
  if (result.acceptedRevisionBefore !== context.claim.expectedAcceptedRevision) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.REVISION_MISMATCH, action.type);
  }
  return {
    protocolVersion: EXPLORER_PRODUCTION_RECEIPT_VERSION,
    ...result,
  };
}

export interface ExplorerActionBridge {
  execute<TActionType extends ExplorerExecutableActionType>(
    action: ExplorerActionFor<TActionType>,
    context: ExplorerProductionAdapterContext,
  ): Promise<ExplorerProductionActionReceipt<TActionType>>;
}

/**
 * Builds the one typed bridge. Merely registering adapters cannot mutate state;
 * only the named production owner invoked by the selected adapter may do so.
 */
export function createExplorerActionBridge(
  adapters: ExplorerProductionActionAdapters,
): ExplorerActionBridge {
  return {
    async execute<TActionType extends ExplorerExecutableActionType>(
      action: ExplorerActionFor<TActionType>,
      context: ExplorerProductionAdapterContext,
    ): Promise<ExplorerProductionActionReceipt<TActionType>> {
      const adapter = adapters[action.type] as ExplorerProductionActionAdapter<TActionType> |
        undefined;
      if (!adapter) {
        fail(EXPLORER_ACTION_BRIDGE_FAILURE.ADAPTER_MISSING, action.type);
      }
      const result = await adapter.invokeProductionOwner(action, context);
      return validateOwnerResult(action, adapter, context, result);
    },
  };
}

export function assertExplorerActionExecutable(
  action: ExplorerAction,
): asserts action is ExplorerExecutableAction {
  if (action.type === 'coach.message' ||
    (action.type === 'week.repeat' && action.capability.status !== 'enabled')) {
    fail(EXPLORER_ACTION_BRIDGE_FAILURE.CAPABILITY_DISABLED, action.type);
  }
}

/**
 * Maps canonical typed outcomes only. Reply text and changed UI copy are not
 * accepted inputs and therefore cannot manufacture success.
 */
export function mapExplorerCanonicalOutcome(args: {
  readonly outcome: string;
  readonly applied: readonly string[];
  readonly rejected?: readonly string[];
  readonly noChange?: readonly string[];
  readonly conflicts?: readonly string[];
}): ExplorerProductionReceiptStatus {
  if (args.applied.includes(args.outcome)) return 'applied';
  if (args.noChange?.includes(args.outcome)) return 'no-change';
  if (args.conflicts?.includes(args.outcome)) return 'conflict';
  if (args.rejected?.includes(args.outcome)) return 'rejected';
  return 'failure';
}
