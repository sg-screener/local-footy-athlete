import { stableSemanticJsonV2, semanticFingerprintV2 } from
  '../../utils/semanticFingerprintV2';
import {
  EXPLORER_PRODUCTION_OWNER_BY_ACTION,
  type ExplorerExecutableAction,
  type ExplorerProductionActionReceipt,
} from './explorerActionBridge';
import type { ExplorerActionSemanticHash } from
  './explorerScenarioContractValidation';
import {
  setDevE2EExplorerActionAwaiting,
  setDevE2EExplorerActionClaimed,
  setDevE2EExplorerActionError,
  setDevE2EExplorerActionReceipt,
} from './devE2EState';

declare const __DEV__: boolean | undefined;

export const EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION = 1 as const;
export const EXPLORER_ACTION_INGRESS_STORAGE_KEY =
  'dev-e2e-explorer-action-ingress-v1' as const;

export const EXPLORER_ACTION_INGRESS_FAILURE = Object.freeze({
  RELEASE_BUILD_REJECTED: 'release_build_rejected',
  CORRUPT_STATE: 'action_ingress_state_corrupt',
  REQUEST_CONFLICT: 'pending_action_ingress_conflict',
  REQUEST_MISSING: 'pending_action_ingress_missing',
  STALE_CLAIM: 'stale_claim',
  WRONG_CAMPAIGN: 'wrong_campaign',
  WRONG_SCENARIO_STEP: 'wrong_scenario_step',
  WRONG_ACTION: 'wrong_action',
  WRONG_CONTROL: 'wrong_control',
  WRONG_TARGET: 'wrong_target',
  ACCEPTED_REVISION_DRIFT: 'accepted_revision_drift',
  DUPLICATE_COMPETING_CLAIM: 'duplicate_competing_claim',
  TRACE_IDENTITY_MISMATCH: 'trace_identity_mismatch',
  UNCLAIMED_PRODUCTION_RECEIPT: 'unclaimed_production_receipt',
  WRONG_PRODUCTION_RECEIPT: 'wrong_production_receipt',
  PRODUCTION_OWNER_MISMATCH: 'production_owner_mismatch',
  NON_DURABLE_PRODUCTION_RECEIPT: 'non_durable_production_receipt',
} as const);

export type ExplorerActionIngressFailureCode =
  (typeof EXPLORER_ACTION_INGRESS_FAILURE)[keyof typeof EXPLORER_ACTION_INGRESS_FAILURE];

export class ExplorerActionIngressError extends Error {
  readonly reasonCode: ExplorerActionIngressFailureCode;

  constructor(reasonCode: ExplorerActionIngressFailureCode, detail?: string) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerActionIngressError';
    this.reasonCode = reasonCode;
  }
}

export interface ExplorerActionIngressRequest {
  readonly protocolVersion: typeof EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly campaignId: string;
  readonly scenarioId: string;
  readonly stepId: string;
  readonly actionSemanticHash: ExplorerActionSemanticHash;
  readonly expectedControlId: string;
  readonly expectedCanonicalTargetIds: readonly string[];
  readonly expectedAcceptedRevision: number;
  readonly priorActionTraceId: string | null;
  readonly deterministicClockFingerprint: string;
}

export interface ExplorerActionIngressClaimInput {
  readonly campaignId: string;
  readonly scenarioId: string;
  readonly stepId: string;
  readonly actionSemanticHash: ExplorerActionSemanticHash;
  readonly controlId: string;
  readonly canonicalTargetIds: readonly string[];
  readonly acceptedRevision: number;
}

export interface ExplorerActionIngressClaim extends ExplorerActionIngressClaimInput {
  readonly claimId: string;
  readonly requestId: string;
  readonly priorActionTraceId: string | null;
  readonly actionTraceId: string | null;
}

export interface ExplorerActionIngressReceipt {
  readonly request: ExplorerActionIngressRequest;
  readonly claim: ExplorerActionIngressClaim;
  readonly productionReceipt: ExplorerProductionActionReceipt;
}

export type ExplorerActionIngressState =
  | {
      readonly protocolVersion: typeof EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION;
      readonly status: 'pending';
      readonly request: ExplorerActionIngressRequest;
      readonly claim: null;
    }
  | {
      readonly protocolVersion: typeof EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION;
      readonly status: 'claimed';
      readonly request: ExplorerActionIngressRequest;
      readonly claim: ExplorerActionIngressClaim;
    };

export interface ExplorerActionIngressStorage {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

function available(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function defaultStorage(): ExplorerActionIngressStorage {
  // Loaded only through the guarded development entry.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

function fail(code: ExplorerActionIngressFailureCode, detail?: string): never {
  setDevE2EExplorerActionError(code);
  throw new ExplorerActionIngressError(code, detail);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function canonicalIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return stableSemanticJsonV2(canonicalIds(left)) ===
    stableSemanticJsonV2(canonicalIds(right));
}

export function explorerCanonicalTargetIds(
  action: ExplorerExecutableAction,
): readonly string[] {
  return explorerCanonicalTargetIdsFromTarget(action.target);
}

function explorerCanonicalTargetIdsFromTarget(
  target: ExplorerExecutableAction['target'],
): readonly string[] {
  switch (target.kind) {
    case 'fixture': return [target.fixtureId];
    case 'session': return [target.sessionId];
    case 'component': return [target.sessionId, target.componentId];
    case 'injury-episode': return [target.injuryEpisodeId];
    case 'readiness': return [target.readinessId];
    case 'equipment-fact': return [target.equipmentFactId];
    case 'session-feedback': return [target.sessionId, target.feedbackId];
    case 'adjustment': return [target.adjustmentId];
    case 'week': return [target.weekId];
  }
}

export function createExplorerActionIngressRequest(args: Omit<
  ExplorerActionIngressRequest,
  'protocolVersion' | 'requestId' | 'expectedCanonicalTargetIds'
> & {
  readonly expectedCanonicalTargetIds: readonly string[];
}): ExplorerActionIngressRequest {
  if (!nonEmpty(args.campaignId) || !nonEmpty(args.scenarioId) ||
    !nonEmpty(args.stepId) || !nonEmpty(args.actionSemanticHash) ||
    !nonEmpty(args.expectedControlId) ||
    args.expectedCanonicalTargetIds.length === 0 ||
    args.expectedCanonicalTargetIds.some((id) => !nonEmpty(id)) ||
    !validRevision(args.expectedAcceptedRevision) ||
    !nonEmpty(args.deterministicClockFingerprint)) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'request');
  }
  const canonicalTargetIds = canonicalIds(args.expectedCanonicalTargetIds);
  const identity = {
    campaignId: args.campaignId,
    scenarioId: args.scenarioId,
    stepId: args.stepId,
    actionSemanticHash: args.actionSemanticHash,
    expectedControlId: args.expectedControlId,
    expectedCanonicalTargetIds: canonicalTargetIds,
    expectedAcceptedRevision: args.expectedAcceptedRevision,
    priorActionTraceId: args.priorActionTraceId,
    deterministicClockFingerprint: args.deterministicClockFingerprint,
  };
  return {
    protocolVersion: EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION,
    requestId: `explorer-action-ingress:${semanticFingerprintV2(identity).slice(-24)}`,
    ...identity,
  };
}

function parseRequest(value: unknown): ExplorerActionIngressRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'request');
  }
  const request = value as ExplorerActionIngressRequest;
  const rebuilt = createExplorerActionIngressRequest({
    campaignId: request.campaignId,
    scenarioId: request.scenarioId,
    stepId: request.stepId,
    actionSemanticHash: request.actionSemanticHash,
    expectedControlId: request.expectedControlId,
    expectedCanonicalTargetIds: request.expectedCanonicalTargetIds,
    expectedAcceptedRevision: request.expectedAcceptedRevision,
    priorActionTraceId: request.priorActionTraceId,
    deterministicClockFingerprint: request.deterministicClockFingerprint,
  });
  if (request.protocolVersion !== EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION ||
    stableSemanticJsonV2(request) !== stableSemanticJsonV2(rebuilt)) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'request_identity');
  }
  return rebuilt;
}

function parseClaim(
  value: unknown,
  request: ExplorerActionIngressRequest,
): ExplorerActionIngressClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'claim');
  }
  const claim = value as ExplorerActionIngressClaim;
  if (!nonEmpty(claim.claimId) || claim.requestId !== request.requestId ||
    !nonEmpty(claim.campaignId) || !nonEmpty(claim.scenarioId) ||
    !nonEmpty(claim.stepId) || !nonEmpty(claim.actionSemanticHash) ||
    !nonEmpty(claim.controlId) || !Array.isArray(claim.canonicalTargetIds) ||
    claim.canonicalTargetIds.length === 0 || !validRevision(claim.acceptedRevision) ||
    (claim.actionTraceId !== null && !nonEmpty(claim.actionTraceId))) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'claim_shape');
  }
  const normalized = {
    ...claim,
    canonicalTargetIds: canonicalIds(claim.canonicalTargetIds),
  };
  const claimIdentity = {
    requestId: request.requestId,
    campaignId: normalized.campaignId,
    scenarioId: normalized.scenarioId,
    stepId: normalized.stepId,
    actionSemanticHash: normalized.actionSemanticHash,
    controlId: normalized.controlId,
    canonicalTargetIds: normalized.canonicalTargetIds,
    acceptedRevision: normalized.acceptedRevision,
    priorActionTraceId: normalized.priorActionTraceId,
  };
  const expectedClaimId =
    `explorer-action-claim:${semanticFingerprintV2(claimIdentity).slice(-24)}`;
  if (normalized.claimId !== expectedClaimId ||
    normalized.campaignId !== request.campaignId ||
    normalized.scenarioId !== request.scenarioId ||
    normalized.stepId !== request.stepId ||
    normalized.actionSemanticHash !== request.actionSemanticHash ||
    normalized.controlId !== request.expectedControlId ||
    !sameIds(normalized.canonicalTargetIds, request.expectedCanonicalTargetIds) ||
    normalized.acceptedRevision !== request.expectedAcceptedRevision ||
    normalized.priorActionTraceId !== request.priorActionTraceId) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'claim_identity');
  }
  return normalized;
}

function parseState(raw: string): ExplorerActionIngressState {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'json');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'envelope');
  }
  const envelope = value as Partial<ExplorerActionIngressState>;
  if (envelope.protocolVersion !== EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION ||
    (envelope.status !== 'pending' && envelope.status !== 'claimed')) {
    fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'envelope_shape');
  }
  const request = parseRequest(envelope.request);
  if (envelope.status === 'pending') {
    if (envelope.claim !== null) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.CORRUPT_STATE, 'pending_claim');
    }
    return {
      protocolVersion: EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION,
      status: 'pending',
      request,
      claim: null,
    };
  }
  return {
    protocolVersion: EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION,
    status: 'claimed',
    request,
    claim: parseClaim(envelope.claim, request),
  };
}

function identicalClaim(
  claim: ExplorerActionIngressClaim,
  input: ExplorerActionIngressClaimInput,
): boolean {
  return claim.campaignId === input.campaignId &&
    claim.scenarioId === input.scenarioId && claim.stepId === input.stepId &&
    claim.actionSemanticHash === input.actionSemanticHash &&
    claim.controlId === input.controlId &&
    sameIds(claim.canonicalTargetIds, input.canonicalTargetIds) &&
    claim.acceptedRevision === input.acceptedRevision;
}

export class ExplorerActionIngressGate {
  private state: ExplorerActionIngressState | null = null;
  private restored = false;
  private waiters = new Map<string, {
    resolve: (receipt: ExplorerActionIngressReceipt) => void;
    reject: (error: unknown) => void;
  }>();
  private completedReceipts = new Map<string, ExplorerActionIngressReceipt>();
  private persistenceChain: Promise<void> = Promise.resolve();
  private storage: ExplorerActionIngressStorage | null;

  constructor(storage?: ExplorerActionIngressStorage) {
    this.storage = storage ?? null;
  }

  private activeStorage(): ExplorerActionIngressStorage {
    if (!this.storage) this.storage = defaultStorage();
    return this.storage;
  }

  private assertAvailable(): void {
    if (!available()) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.RELEASE_BUILD_REJECTED);
    }
  }

  private persist(): Promise<void> {
    const snapshot = this.state;
    this.persistenceChain = this.persistenceChain.then(async () => {
      if (!snapshot) {
        await this.activeStorage().removeItem(EXPLORER_ACTION_INGRESS_STORAGE_KEY);
        return;
      }
      await this.activeStorage().setItem(
        EXPLORER_ACTION_INGRESS_STORAGE_KEY,
        JSON.stringify(snapshot),
      );
    });
    return this.persistenceChain;
  }

  async restore(): Promise<ExplorerActionIngressState | null> {
    this.assertAvailable();
    if (this.restored) return this.state;
    const raw = await this.activeStorage().getItem(
      EXPLORER_ACTION_INGRESS_STORAGE_KEY,
    );
    this.state = raw ? parseState(raw) : null;
    this.restored = true;
    if (this.state) {
      setDevE2EExplorerActionAwaiting(
        this.state.request.scenarioId,
        this.state.request.stepId,
      );
      if (this.state.status === 'claimed') {
        setDevE2EExplorerActionClaimed(
          this.state.request.scenarioId,
          this.state.request.stepId,
        );
      }
    }
    return this.state;
  }

  async open(request: ExplorerActionIngressRequest): Promise<void> {
    this.assertAvailable();
    await this.restore();
    if (this.state && this.state.request.requestId !== request.requestId) {
      fail(
        EXPLORER_ACTION_INGRESS_FAILURE.REQUEST_CONFLICT,
        this.state.request.requestId,
      );
    }
    if (!this.state) {
      this.state = {
        protocolVersion: EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION,
        status: 'pending',
        request,
        claim: null,
      };
      await this.persist();
    }
    // Publication is deliberately after durable pending-state persistence.
    setDevE2EExplorerActionAwaiting(request.scenarioId, request.stepId);
  }

  claim(input: ExplorerActionIngressClaimInput): ExplorerActionIngressClaim {
    this.assertAvailable();
    const state = this.state;
    if (!state) fail(EXPLORER_ACTION_INGRESS_FAILURE.REQUEST_MISSING);
    const request = state.request;
    if (state.status === 'claimed') {
      if (identicalClaim(state.claim, input)) return state.claim;
      fail(EXPLORER_ACTION_INGRESS_FAILURE.DUPLICATE_COMPETING_CLAIM);
    }
    if (input.campaignId !== request.campaignId) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_CAMPAIGN);
    }
    if (input.scenarioId !== request.scenarioId || input.stepId !== request.stepId) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_SCENARIO_STEP);
    }
    if (input.actionSemanticHash !== request.actionSemanticHash) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_ACTION);
    }
    if (input.controlId !== request.expectedControlId) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_CONTROL);
    }
    if (!sameIds(input.canonicalTargetIds, request.expectedCanonicalTargetIds)) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_TARGET);
    }
    if (input.acceptedRevision !== request.expectedAcceptedRevision) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.ACCEPTED_REVISION_DRIFT);
    }
    const claimIdentity = {
      requestId: request.requestId,
      ...input,
      canonicalTargetIds: canonicalIds(input.canonicalTargetIds),
      priorActionTraceId: request.priorActionTraceId,
    };
    const claim: ExplorerActionIngressClaim = {
      claimId: `explorer-action-claim:${semanticFingerprintV2(claimIdentity).slice(-24)}`,
      ...claimIdentity,
      actionTraceId: null,
    };
    this.state = {
      protocolVersion: EXPLORER_ACTION_INGRESS_PROTOCOL_VERSION,
      status: 'claimed',
      request,
      claim,
    };
    void this.persist().catch((error) => {
      this.waiters.get(request.requestId)?.reject(error);
    });
    setDevE2EExplorerActionClaimed(request.scenarioId, request.stepId);
    return claim;
  }

  claimAndStart(
    input: ExplorerActionIngressClaimInput,
    start: (claim: ExplorerActionIngressClaim) => void,
  ): ExplorerActionIngressClaim {
    const alreadyClaimed = this.state?.status === 'claimed';
    const claim = this.claim(input);
    if (!alreadyClaimed) start(claim);
    return claim;
  }

  registerTrace(claimId: string, traceId: string): ExplorerActionIngressClaim {
    this.assertAvailable();
    if (!this.state || this.state.status !== 'claimed') {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.STALE_CLAIM);
    }
    if (this.state.claim.claimId !== claimId || !nonEmpty(traceId)) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.TRACE_IDENTITY_MISMATCH);
    }
    if (this.state.claim.actionTraceId !== null) {
      if (this.state.claim.actionTraceId === traceId) return this.state.claim;
      fail(EXPLORER_ACTION_INGRESS_FAILURE.TRACE_IDENTITY_MISMATCH);
    }
    const claim = { ...this.state.claim, actionTraceId: traceId };
    this.state = { ...this.state, claim };
    const requestId = this.state.request.requestId;
    void this.persist().catch((error) => {
      this.waiters.get(requestId)?.reject(error);
    });
    return claim;
  }

  async waitForReceipt(
    request: ExplorerActionIngressRequest,
  ): Promise<ExplorerActionIngressReceipt> {
    const completed = this.completedReceipts.get(request.requestId);
    if (completed) {
      this.completedReceipts.delete(request.requestId);
      return completed;
    }
    await this.open(request);
    const completedAfterOpen = this.completedReceipts.get(request.requestId);
    if (completedAfterOpen) {
      this.completedReceipts.delete(request.requestId);
      return completedAfterOpen;
    }
    return new Promise<ExplorerActionIngressReceipt>((resolve, reject) => {
      if (this.waiters.has(request.requestId)) {
        reject(new ExplorerActionIngressError(
          EXPLORER_ACTION_INGRESS_FAILURE.REQUEST_CONFLICT,
          'duplicate_waiter',
        ));
        return;
      }
      this.waiters.set(request.requestId, { resolve, reject });
    });
  }

  async registerProductionReceipt(
    productionReceipt: ExplorerProductionActionReceipt,
  ): Promise<ExplorerActionIngressReceipt> {
    this.assertAvailable();
    if (!this.state || this.state.status !== 'claimed' ||
      this.state.claim.actionTraceId === null) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.UNCLAIMED_PRODUCTION_RECEIPT);
    }
    const { request, claim } = this.state;
    if (productionReceipt.traceV2RootId !== claim.actionTraceId ||
      productionReceipt.actionSemanticHash !== request.actionSemanticHash ||
      !sameIds(
        explorerCanonicalTargetIdsFromTarget(productionReceipt.target),
        request.expectedCanonicalTargetIds,
      ) || productionReceipt.acceptedRevisionBefore !==
        request.expectedAcceptedRevision) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.WRONG_PRODUCTION_RECEIPT);
    }
    const expectedOwner = EXPLORER_PRODUCTION_OWNER_BY_ACTION[
      productionReceipt.actionType
    ];
    if (productionReceipt.owner !== expectedOwner) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.PRODUCTION_OWNER_MISMATCH);
    }
    if (productionReceipt.durable !== true) {
      fail(EXPLORER_ACTION_INGRESS_FAILURE.NON_DURABLE_PRODUCTION_RECEIPT);
    }
    const receipt = { request, claim, productionReceipt };
    const waiter = this.waiters.get(request.requestId);
    this.waiters.delete(request.requestId);
    this.state = null;
    if (!waiter) this.completedReceipts.set(request.requestId, receipt);
    await this.persist();
    setDevE2EExplorerActionReceipt(request.scenarioId, request.stepId);
    waiter?.resolve(receipt);
    return receipt;
  }

  async clear(): Promise<void> {
    this.assertAvailable();
    for (const waiter of this.waiters.values()) {
      waiter.reject(new ExplorerActionIngressError(
        EXPLORER_ACTION_INGRESS_FAILURE.STALE_CLAIM,
      ));
    }
    this.waiters.clear();
    this.completedReceipts.clear();
    this.state = null;
    this.restored = true;
    await this.persist();
  }

  readStateForTest(): ExplorerActionIngressState | null {
    return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
  }

  readActiveRequest(): ExplorerActionIngressRequest | null {
    return this.state?.request ?? null;
  }
}

let liveGate: ExplorerActionIngressGate | null = null;

export function explorerLiveActionIngressGate(): ExplorerActionIngressGate {
  if (!liveGate) liveGate = new ExplorerActionIngressGate();
  return liveGate;
}

export async function restoreExplorerActionIngress(): Promise<void> {
  await explorerLiveActionIngressGate().restore();
}

export async function clearExplorerActionIngress(): Promise<void> {
  await explorerLiveActionIngressGate().clear();
}

/** Called only by the real development UI action handler at its tap ingress. */
export function claimExplorerActionIngressFromUI(
  input: ExplorerActionIngressClaimInput,
  start: (claim: ExplorerActionIngressClaim) => void,
): ExplorerActionIngressClaim {
  return explorerLiveActionIngressGate().claimAndStart(input, start);
}

export function __resetExplorerActionIngressForTest(): void {
  liveGate = null;
}
