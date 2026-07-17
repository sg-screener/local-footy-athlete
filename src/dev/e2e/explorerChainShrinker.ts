import { semanticFingerprintV2, type SemanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  sameExplorerFailureClusterSignature,
  type ExplorerFailureClusterSignature,
} from './explorerFailureClusterSignature';
import {
  deriveExplorerChainEligibilityBaseline,
  isExplorerChainEligible,
  type ExplorerChainEligibilityBaseline,
} from './explorerSeededChainGenerator';
import type {
  ExplorerAction,
  ExplorerScenarioContract,
  ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  explorerScenarioSemanticHash,
  type ExplorerScenarioSemanticHash,
} from './explorerScenarioContractValidation';

export const EXPLORER_SHRINKER_VERSION = 1 as const;
export const EXPLORER_SHRINK_MAX_ATTEMPTS = 100 as const;
export const EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS = 30 * 60 * 1_000;

export type ExplorerShrinkStrategy =
  | 'suffix-removal'
  | 'interior-removal'
  | 'payload-simplification';

export type ExplorerShrinkStopReason =
  | 'attempt-budget-exhausted'
  | 'external-duration-budget-exhausted'
  | 'no-further-candidates';

export interface ExplorerShrinkBudgetReceipt {
  readonly receiptId: string;
  readonly source: 'external-budget';
  readonly representedElapsedMs: number;
  readonly limitMs: typeof EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS;
  readonly semanticHash: SemanticFingerprintV2;
}

export interface ExplorerShrinkReplayReceipt {
  readonly replayId: string;
  readonly reproductionOrdinal: 1 | 2;
  readonly candidateSemanticHash: ExplorerScenarioSemanticHash;
  readonly eligible: boolean;
  readonly reproduced: boolean;
  readonly failureSignature: ExplorerFailureClusterSignature | null;
}

export interface ExplorerShrinkCandidate {
  readonly attempt: number;
  readonly strategy: ExplorerShrinkStrategy;
  readonly scenario: ExplorerScenarioContract;
  readonly scenarioSemanticHash: ExplorerScenarioSemanticHash;
}

export interface ExplorerShrinkLineageReceipt {
  readonly attempt: number;
  readonly strategy: ExplorerShrinkStrategy;
  readonly parentScenarioSemanticHash: ExplorerScenarioSemanticHash;
  readonly candidateScenarioSemanticHash: ExplorerScenarioSemanticHash;
  readonly result: 'retained' | 'rejected';
  readonly replayReceiptHashes: readonly [SemanticFingerprintV2, SemanticFingerprintV2];
}

export interface ExplorerShrinkSession {
  readonly version: typeof EXPLORER_SHRINKER_VERSION;
  readonly originalCampaignSeed: number;
  readonly originalSeedId: string;
  readonly originalScenario: ExplorerScenarioContract;
  readonly currentScenario: ExplorerScenarioContract;
  readonly targetFailureSignature: ExplorerFailureClusterSignature;
  readonly eligibilityBaseline: ExplorerChainEligibilityBaseline;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly attemptedCandidateHashes: readonly ExplorerScenarioSemanticHash[];
  readonly skippedIneligibleCandidateHashes: readonly ExplorerScenarioSemanticHash[];
  readonly pendingCandidate: ExplorerShrinkCandidate | null;
  readonly lineage: readonly ExplorerShrinkLineageReceipt[];
  readonly lastBudgetReceipt: ExplorerShrinkBudgetReceipt | null;
  readonly status: 'active' | 'stopped';
  readonly stopReason: ExplorerShrinkStopReason | null;
}

export interface ExplorerShrinkProposal {
  readonly session: ExplorerShrinkSession;
  readonly candidate: ExplorerShrinkCandidate | null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`${field} must be non-empty.`);
}

export function createExplorerShrinkBudgetReceipt(
  receiptId: string,
  representedElapsedMs: number,
): ExplorerShrinkBudgetReceipt {
  nonEmpty(receiptId, 'Explorer shrink budget receiptId');
  if (!Number.isSafeInteger(representedElapsedMs) || representedElapsedMs < 0) {
    throw new Error('Explorer represented shrink duration must be a non-negative integer.');
  }
  const projection = {
    receiptId,
    source: 'external-budget' as const,
    representedElapsedMs,
    limitMs: EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS,
  };
  return {
    ...projection,
    semanticHash: semanticFingerprintV2({
      contract: 'explorer-shrink-external-budget-receipt-v1',
      receipt: projection,
    }),
  };
}

function validateBudgetReceipt(
  receipt: ExplorerShrinkBudgetReceipt,
  previous: ExplorerShrinkBudgetReceipt | null,
): void {
  const expected = createExplorerShrinkBudgetReceipt(
    receipt.receiptId,
    receipt.representedElapsedMs,
  );
  if (receipt.source !== 'external-budget' ||
    receipt.limitMs !== EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS ||
    receipt.semanticHash !== expected.semanticHash) {
    throw new Error('Explorer shrink external budget receipt is invalid.');
  }
  if (previous && receipt.representedElapsedMs < previous.representedElapsedMs) {
    throw new Error('Explorer shrink external budget receipts must be monotonic.');
  }
}

export function beginExplorerChainShrink(
  original: ExplorerScenarioContract,
  targetFailureSignature: ExplorerFailureClusterSignature,
  options: { readonly maxAttempts?: number } = {},
): ExplorerShrinkSession {
  if (original.campaignSeed === undefined) {
    throw new Error('A failing Explorer chain must carry its original campaign seed.');
  }
  if (!original.steps.some(
    (step) => step.stepId === targetFailureSignature.components.firstFailingStepId,
  )) {
    throw new Error('The Explorer failure signature step is not present in the original chain.');
  }
  const maxAttempts = options.maxAttempts ?? EXPLORER_SHRINK_MAX_ATTEMPTS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 ||
    maxAttempts > EXPLORER_SHRINK_MAX_ATTEMPTS) {
    throw new Error('Explorer shrink maxAttempts must be between 1 and 100.');
  }
  const originalClone = cloneJson(original);
  const eligibilityBaseline = deriveExplorerChainEligibilityBaseline(originalClone);
  if (!isExplorerChainEligible(originalClone, eligibilityBaseline)) {
    throw new Error('The original Explorer chain is not eligible under its typed baseline.');
  }
  return {
    version: EXPLORER_SHRINKER_VERSION,
    originalCampaignSeed: original.campaignSeed,
    originalSeedId: original.seedId,
    originalScenario: originalClone,
    currentScenario: cloneJson(originalClone),
    targetFailureSignature: cloneJson(targetFailureSignature),
    eligibilityBaseline,
    attemptCount: 0,
    maxAttempts,
    attemptedCandidateHashes: [],
    skippedIneligibleCandidateHashes: [],
    pendingCandidate: null,
    lineage: [],
    lastBudgetReceipt: null,
    status: 'active',
    stopReason: null,
  };
}

function rebuildScenario(
  scenario: ExplorerScenarioContract,
  retainedSteps: readonly ExplorerScenarioStep[],
): ExplorerScenarioContract {
  const firstStepId = retainedSteps[0]?.stepId;
  if (!firstStepId) throw new Error('Explorer shrink candidates cannot have zero steps.');
  const steps = retainedSteps.map((sourceStep, index): ExplorerScenarioStep => {
    const priorStepId = index === 0 ? null : retainedSteps[index - 1].stepId;
    const preconditions = sourceStep.preconditions.map((predicate) =>
      predicate.type === 'accepted-revision'
        ? { ...predicate, revision: index }
        : cloneJson(predicate));
    const oracleAssertions = sourceStep.oracleAssertions
      .filter((oracle) => oracle.type !== 'prior-trace-linkage' || priorStepId !== null)
      .map((oracle) => {
        if (oracle.type === 'prior-trace-linkage') {
          return { ...oracle, priorStepId: priorStepId as string };
        }
        if (oracle.type === 'restoration-equality') {
          return { ...oracle, baselineStepId: firstStepId };
        }
        return cloneJson(oracle);
      });
    return {
      ...cloneJson(sourceStep),
      preconditions: preconditions as ExplorerScenarioStep['preconditions'],
      oracleAssertions,
    };
  });
  return {
    ...cloneJson(scenario),
    campaignSeed: scenario.campaignSeed,
    seedId: scenario.seedId,
    steps: steps as [ExplorerScenarioStep, ...ExplorerScenarioStep[]],
  };
}

interface RawCandidate {
  readonly strategy: ExplorerShrinkStrategy;
  readonly scenario: ExplorerScenarioContract;
}

function suffixCandidates(
  scenario: ExplorerScenarioContract,
  firstFailingStepId: string,
): readonly RawCandidate[] {
  const failingIndex = scenario.steps.findIndex((step) => step.stepId === firstFailingStepId);
  if (failingIndex < 0) return [];
  const output: RawCandidate[] = [];
  for (let retainedLength = failingIndex + 1;
    retainedLength < scenario.steps.length;
    retainedLength += 1) {
    output.push({
      strategy: 'suffix-removal',
      scenario: rebuildScenario(scenario, scenario.steps.slice(0, retainedLength)),
    });
  }
  return output;
}

function interiorCandidates(
  scenario: ExplorerScenarioContract,
  firstFailingStepId: string,
): readonly RawCandidate[] {
  const output: RawCandidate[] = [];
  for (let index = 1; index < scenario.steps.length - 1; index += 1) {
    if (scenario.steps[index].stepId === firstFailingStepId) continue;
    output.push({
      strategy: 'interior-removal',
      scenario: rebuildScenario(
        scenario,
        scenario.steps.filter((_, candidateIndex) => candidateIndex !== index),
      ),
    });
  }
  return output;
}

function simplifiedActions(action: ExplorerAction): readonly ExplorerAction[] {
  switch (action.type) {
    case 'injury.set':
      if (action.args.severity === 'minor') return [];
      return [{
        ...action,
        args: { ...action.args, severity: 'minor' },
      }];
    case 'readiness.set': {
      const simplified: ExplorerAction = {
        ...action,
        args: { ...action.args, fatigue: 1, soreness: 1, sleepQuality: 5 },
      };
      return JSON.stringify(simplified) === JSON.stringify(action) ? [] : [simplified];
    }
    case 'equipment.set': {
      const availableEquipmentIds = action.args.availableEquipmentIds.slice(0, 1);
      const unavailableEquipmentIds = availableEquipmentIds.length > 0
        ? []
        : action.args.unavailableEquipmentIds.slice(0, 1);
      const simplified: ExplorerAction = {
        ...action,
        args: {
          ...action.args,
          toDate: null,
          availableEquipmentIds,
          unavailableEquipmentIds,
        },
      };
      return JSON.stringify(simplified) === JSON.stringify(action) ? [] : [simplified];
    }
    case 'session-feedback.record': {
      const simplified: ExplorerAction = {
        ...action,
        args: {
          ...action.args,
          completion: 'full',
          feeling: 'manageable',
          soreness: 'none',
          difficulty: 1,
        },
      };
      return JSON.stringify(simplified) === JSON.stringify(action) ? [] : [simplified];
    }
    case 'coach.message': {
      if (action.args.message === 'change') return [];
      return [{ ...action, args: { ...action.args, message: 'change' } }];
    }
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove':
    case 'session.move':
    case 'session.delete':
    case 'component.delete':
    case 'injury.resolve':
    case 'readiness.clear':
    case 'equipment.clear':
    case 'adjustment.restore':
    case 'week.repeat':
      return [];
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function payloadCandidates(scenario: ExplorerScenarioContract): readonly RawCandidate[] {
  return scenario.steps.flatMap((step, stepIndex) =>
    simplifiedActions(step.action).map((action): RawCandidate => {
      const steps = scenario.steps.map((candidate, candidateIndex) =>
        candidateIndex === stepIndex ? { ...cloneJson(candidate), action } : candidate);
      return {
        strategy: 'payload-simplification',
        scenario: rebuildScenario(scenario, steps),
      };
    }));
}

function nextEligibleCandidate(
  session: ExplorerShrinkSession,
): {
  readonly raw: RawCandidate | null;
  readonly skipped: readonly ExplorerScenarioSemanticHash[];
} {
  const attempted = new Set(session.attemptedCandidateHashes);
  const skippedPreviously = new Set(session.skippedIneligibleCandidateHashes);
  const firstFailingStepId = session.targetFailureSignature.components.firstFailingStepId;
  const candidates = [
    ...suffixCandidates(session.currentScenario, firstFailingStepId),
    ...interiorCandidates(session.currentScenario, firstFailingStepId),
    ...payloadCandidates(session.currentScenario),
  ];
  const skipped: ExplorerScenarioSemanticHash[] = [];
  for (const candidate of candidates) {
    if (candidate.scenario.campaignSeed !== session.originalCampaignSeed ||
      candidate.scenario.seedId !== session.originalSeedId ||
      !candidate.scenario.steps.some((step) => step.stepId === firstFailingStepId)) {
      continue;
    }
    const hash = explorerScenarioSemanticHash(candidate.scenario);
    if (attempted.has(hash) || skippedPreviously.has(hash)) continue;
    if (!isExplorerChainEligible(candidate.scenario, session.eligibilityBaseline)) {
      skipped.push(hash);
      skippedPreviously.add(hash);
      continue;
    }
    return { raw: candidate, skipped };
  }
  return { raw: null, skipped };
}

function stopped(
  session: ExplorerShrinkSession,
  receipt: ExplorerShrinkBudgetReceipt,
  reason: ExplorerShrinkStopReason,
  skipped: readonly ExplorerScenarioSemanticHash[] = [],
): ExplorerShrinkSession {
  return {
    ...session,
    skippedIneligibleCandidateHashes: [
      ...session.skippedIneligibleCandidateHashes,
      ...skipped,
    ],
    lastBudgetReceipt: receipt,
    pendingCandidate: null,
    status: 'stopped',
    stopReason: reason,
  };
}

export function proposeExplorerShrinkCandidate(
  session: ExplorerShrinkSession,
  externalBudgetReceipt: ExplorerShrinkBudgetReceipt,
): ExplorerShrinkProposal {
  validateBudgetReceipt(externalBudgetReceipt, session.lastBudgetReceipt);
  if (session.status === 'stopped') return { session, candidate: null };
  if (session.pendingCandidate !== null) {
    throw new Error('Consume the pending Explorer shrink candidate before proposing another.');
  }
  if (session.attemptCount >= session.maxAttempts) {
    return {
      session: stopped(session, externalBudgetReceipt, 'attempt-budget-exhausted'),
      candidate: null,
    };
  }
  if (
    externalBudgetReceipt.representedElapsedMs >=
    EXPLORER_SHRINK_MAX_REPRESENTED_DURATION_MS
  ) {
    return {
      session: stopped(
        session,
        externalBudgetReceipt,
        'external-duration-budget-exhausted',
      ),
      candidate: null,
    };
  }
  const { raw, skipped } = nextEligibleCandidate(session);
  if (raw === null) {
    return {
      session: stopped(
        session,
        externalBudgetReceipt,
        'no-further-candidates',
        skipped,
      ),
      candidate: null,
    };
  }
  const candidate: ExplorerShrinkCandidate = {
    attempt: session.attemptCount + 1,
    strategy: raw.strategy,
    scenario: raw.scenario,
    scenarioSemanticHash: explorerScenarioSemanticHash(raw.scenario),
  };
  const nextSession: ExplorerShrinkSession = {
    ...session,
    attemptCount: candidate.attempt,
    skippedIneligibleCandidateHashes: [
      ...session.skippedIneligibleCandidateHashes,
      ...skipped,
    ],
    pendingCandidate: candidate,
    lastBudgetReceipt: externalBudgetReceipt,
  };
  return { session: nextSession, candidate };
}

function replayReceiptHash(receipt: ExplorerShrinkReplayReceipt): SemanticFingerprintV2 {
  return semanticFingerprintV2({
    contract: 'explorer-shrink-replay-receipt-v1',
    receipt,
  });
}

function reproducesTarget(
  receipt: ExplorerShrinkReplayReceipt,
  candidate: ExplorerShrinkCandidate,
  target: ExplorerFailureClusterSignature,
): boolean {
  return receipt.candidateSemanticHash === candidate.scenarioSemanticHash &&
    receipt.eligible &&
    receipt.reproduced &&
    receipt.failureSignature !== null &&
    sameExplorerFailureClusterSignature(receipt.failureSignature, target);
}

export function consumeExplorerShrinkReplayReceipts(
  session: ExplorerShrinkSession,
  replayReceipts: readonly [ExplorerShrinkReplayReceipt, ExplorerShrinkReplayReceipt],
): ExplorerShrinkSession {
  const candidate = session.pendingCandidate;
  if (!candidate) throw new Error('Explorer shrink session has no pending candidate.');
  const receipts = [...replayReceipts].sort(
    (left, right) => left.reproductionOrdinal - right.reproductionOrdinal,
  ) as [ExplorerShrinkReplayReceipt, ExplorerShrinkReplayReceipt];
  if (receipts[0].reproductionOrdinal !== 1 || receipts[1].reproductionOrdinal !== 2 ||
    receipts[0].replayId === receipts[1].replayId) {
    throw new Error('Explorer shrink requires two distinct deterministic reproduction receipts.');
  }
  const retained = reproducesTarget(
    receipts[0],
    candidate,
    session.targetFailureSignature,
  ) && reproducesTarget(
    receipts[1],
    candidate,
    session.targetFailureSignature,
  ) && receipts[0].failureSignature?.semanticHash ===
    receipts[1].failureSignature?.semanticHash;
  const parentScenarioSemanticHash = explorerScenarioSemanticHash(session.currentScenario);
  const lineage: ExplorerShrinkLineageReceipt = {
    attempt: candidate.attempt,
    strategy: candidate.strategy,
    parentScenarioSemanticHash,
    candidateScenarioSemanticHash: candidate.scenarioSemanticHash,
    result: retained ? 'retained' : 'rejected',
    replayReceiptHashes: [
      replayReceiptHash(receipts[0]),
      replayReceiptHash(receipts[1]),
    ],
  };
  return {
    ...session,
    currentScenario: retained ? cloneJson(candidate.scenario) : session.currentScenario,
    attemptedCandidateHashes: [
      ...session.attemptedCandidateHashes,
      candidate.scenarioSemanticHash,
    ],
    pendingCandidate: null,
    lineage: [...session.lineage, lineage],
  };
}
