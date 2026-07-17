import { semanticFingerprintV2, type SemanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  EXPLORER_ENABLED_CAPABILITY_DECLARATIONS,
  explorerActionCapabilityProfile,
} from './explorerCapabilityMatrix';
import type {
  ExplorerInvariantId,
  ExplorerOracleAssertion,
} from './explorerOracleContracts';
import {
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  type ExplorerAction,
  type ExplorerActionType,
  type ExplorerEligibilityPredicate,
  type ExplorerIngressSurface,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  explorerActionSemanticHash,
  explorerScenarioSemanticHash,
  validateExplorerScenarioContract,
  type ExplorerActionSemanticHash,
  type ExplorerScenarioSemanticHash,
} from './explorerScenarioContractValidation';

export const EXPLORER_SEEDED_CHAIN_GENERATOR_VERSION = 1 as const;
export const EXPLORER_SEEDED_CHAIN_COUNT = 32 as const;
export const EXPLORER_SEEDED_CHAIN_ACTION_COUNT = 12 as const;
export const EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS = [4, 8, 12] as const;

const PCG_MASK_64 = (1n << 64n) - 1n;
const PCG_MULTIPLIER = 6364136223846793005n;

/** Minimal PCG-XSH-RR 64/32 with a deterministic numeric seed and stream. */
export class ExplorerPcg32 {
  private state = 0n;
  private readonly increment: bigint;

  constructor(seed: number, stream = 1) {
    if (!Number.isSafeInteger(seed) || seed < 0) {
      throw new Error('PCG32 seed must be a non-negative safe integer.');
    }
    if (!Number.isSafeInteger(stream) || stream < 0) {
      throw new Error('PCG32 stream must be a non-negative safe integer.');
    }
    this.increment = ((BigInt(stream) << 1n) | 1n) & PCG_MASK_64;
    this.nextUint32();
    this.state = (this.state + BigInt(seed)) & PCG_MASK_64;
    this.nextUint32();
  }

  nextUint32(): number {
    const previous = this.state;
    this.state = (previous * PCG_MULTIPLIER + this.increment) & PCG_MASK_64;
    const xorshifted = Number((((previous >> 18n) ^ previous) >> 27n) & 0xffffffffn);
    const rotation = Number((previous >> 59n) & 31n);
    return ((xorshifted >>> rotation) | (xorshifted << ((32 - rotation) & 31))) >>> 0;
  }

  nextInt(exclusiveMaximum: number): number {
    if (!Number.isSafeInteger(exclusiveMaximum) || exclusiveMaximum <= 0) {
      throw new Error('PCG32 exclusive maximum must be a positive safe integer.');
    }
    const threshold = (0x100000000 - exclusiveMaximum) % exclusiveMaximum;
    let value = this.nextUint32();
    while (value < threshold) value = this.nextUint32();
    return value % exclusiveMaximum;
  }
}

export interface ExplorerReloadCheckpoint {
  readonly afterAction: 4 | 8 | 12;
  readonly stepId: string;
  readonly policy: 'required';
}

export interface ExplorerSeededChainManifest {
  readonly chainId: string;
  readonly campaignSeed: number;
  readonly chainOrdinal: number;
  readonly scenario: ExplorerScenarioContract;
  readonly scenarioSemanticHash: ExplorerScenarioSemanticHash;
  readonly actionSemanticHashes: readonly ExplorerActionSemanticHash[];
  readonly reloadCheckpoints: readonly ExplorerReloadCheckpoint[];
  readonly manifestSemanticHash: SemanticFingerprintV2;
}

export interface ExplorerSeededChainGeneration {
  readonly generatorVersion: typeof EXPLORER_SEEDED_CHAIN_GENERATOR_VERSION;
  readonly campaignSeed: number;
  readonly chains: readonly ExplorerSeededChainManifest[];
  readonly semanticHash: SemanticFingerprintV2;
}

interface OperationNode {
  readonly actionKind: ExplorerActionType;
  readonly dependencies: readonly ExplorerActionType[];
}

const REQUIRED_OPERATION_NODES: readonly OperationNode[] = [
  { actionKind: 'fixture.move', dependencies: [] },
  { actionKind: 'session.move', dependencies: [] },
  { actionKind: 'component.delete', dependencies: ['session.move'] },
  { actionKind: 'injury.set', dependencies: [] },
  { actionKind: 'readiness.set', dependencies: [] },
  { actionKind: 'equipment.set', dependencies: [] },
  { actionKind: 'session-feedback.record', dependencies: [] },
  { actionKind: 'adjustment.restore', dependencies: ['session.move'] },
  { actionKind: 'week.repeat', dependencies: [] },
];

const SECONDARY_OPERATION_NODES: readonly OperationNode[] = [
  { actionKind: 'fixture.remove', dependencies: ['fixture.move'] },
  { actionKind: 'injury.resolve', dependencies: ['injury.set'] },
  { actionKind: 'readiness.clear', dependencies: ['readiness.set'] },
  { actionKind: 'equipment.clear', dependencies: ['equipment.set'] },
];

const CANONICAL = {
  fixtureId: 'fixture-primary',
  sessionId: 'session-primary',
  componentId: 'component-primary',
  injuryEpisodeId: 'injury-primary',
  readinessId: 'readiness-primary',
  equipmentFactId: 'equipment-primary',
  feedbackId: 'feedback-primary',
  adjustmentId: 'adjustment-primary',
  weekId: 'week-primary',
} as const;

const DATE = {
  weekStart: '2026-07-13',
  nextWeekStart: '2026-07-20',
  sessionInitial: '2026-07-14',
  sessionMoved: '2026-07-15',
  fixtureInitial: '2026-07-18',
  fixtureMoved: '2026-07-19',
  factEnd: '2026-07-21',
} as const;

interface MutableChainState {
  fixtureDate: string | null;
  sessionDate: string | null;
  componentExists: boolean;
  injuryActive: boolean;
  readinessActive: boolean;
  equipmentActive: boolean;
  adjustmentActive: boolean;
}

function initialChainState(): MutableChainState {
  return {
    fixtureDate: DATE.fixtureInitial,
    sessionDate: DATE.sessionInitial,
    componentExists: true,
    injuryActive: false,
    readinessActive: false,
    equipmentActive: false,
    adjustmentActive: true,
  };
}

function selectOperationOrder(random: ExplorerPcg32): readonly OperationNode[] {
  const secondary = [...SECONDARY_OPERATION_NODES];
  const omitted = random.nextInt(secondary.length);
  secondary.splice(omitted, 1);
  const pending = [...REQUIRED_OPERATION_NODES, ...secondary];
  const selected: OperationNode[] = [];
  const completed = new Set<ExplorerActionType>();
  while (pending.length > 0) {
    const eligibleIndexes = pending
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node.dependencies.every((dependency) => completed.has(dependency)))
      .map(({ index }) => index);
    if (eligibleIndexes.length === 0) {
      throw new Error('Explorer seeded operation graph contains a dependency cycle.');
    }
    const pendingIndex = eligibleIndexes[random.nextInt(eligibleIndexes.length)];
    const [node] = pending.splice(pendingIndex, 1);
    const capability = explorerActionCapabilityProfile(node.actionKind);
    if (capability.status !== 'enabled') {
      throw new Error(`Explorer chain cannot emit disabled capability ${node.actionKind}.`);
    }
    selected.push(node);
    completed.add(node.actionKind);
  }
  return selected;
}

function materializeAction(
  actionKind: ExplorerActionType,
  state: MutableChainState,
  random: ExplorerPcg32,
): ExplorerAction {
  switch (actionKind) {
    case 'fixture.move': {
      if (state.fixtureDate === null) throw new Error('fixture.move requires a fixture.');
      const action: ExplorerAction = {
        type: 'fixture.move',
        target: { kind: 'fixture', fixtureId: CANONICAL.fixtureId },
        args: { fromDate: state.fixtureDate, toDate: DATE.fixtureMoved },
      };
      state.fixtureDate = DATE.fixtureMoved;
      return action;
    }
    case 'fixture.remove': {
      if (state.fixtureDate === null) throw new Error('fixture.remove requires a fixture.');
      const action: ExplorerAction = {
        type: 'fixture.remove',
        target: { kind: 'fixture', fixtureId: CANONICAL.fixtureId },
        args: { date: state.fixtureDate },
      };
      state.fixtureDate = null;
      return action;
    }
    case 'session.move': {
      if (state.sessionDate === null) throw new Error('session.move requires a session.');
      const action: ExplorerAction = {
        type: 'session.move',
        target: { kind: 'session', sessionId: CANONICAL.sessionId },
        args: { fromDate: state.sessionDate, toDate: DATE.sessionMoved },
      };
      state.sessionDate = DATE.sessionMoved;
      return action;
    }
    case 'component.delete': {
      if (!state.componentExists || state.sessionDate === null) {
        throw new Error('component.delete requires a visible component.');
      }
      const action: ExplorerAction = {
        type: 'component.delete',
        target: {
          kind: 'component',
          sessionId: CANONICAL.sessionId,
          componentId: CANONICAL.componentId,
        },
        args: { date: state.sessionDate },
      };
      state.componentExists = false;
      return action;
    }
    case 'injury.set': {
      if (state.injuryActive) throw new Error('injury.set requires an absent episode.');
      const action: ExplorerAction = {
        type: 'injury.set',
        target: { kind: 'injury-episode', injuryEpisodeId: CANONICAL.injuryEpisodeId },
        args: {
          effectiveDate: DATE.weekStart,
          bodyRegionId: 'hamstring',
          severity: random.nextInt(2) === 0 ? 'moderate' : 'severe',
          laterality: random.nextInt(2) === 0 ? 'left' : 'right',
        },
      };
      state.injuryActive = true;
      return action;
    }
    case 'injury.resolve': {
      if (!state.injuryActive) throw new Error('injury.resolve requires an active episode.');
      const action: ExplorerAction = {
        type: 'injury.resolve',
        target: { kind: 'injury-episode', injuryEpisodeId: CANONICAL.injuryEpisodeId },
        args: { resolvedDate: DATE.factEnd },
      };
      state.injuryActive = false;
      return action;
    }
    case 'readiness.set': {
      if (state.readinessActive) throw new Error('readiness.set requires an absent fact.');
      const action: ExplorerAction = {
        type: 'readiness.set',
        target: { kind: 'readiness', readinessId: CANONICAL.readinessId },
        args: {
          date: DATE.sessionInitial,
          fatigue: 3 + random.nextInt(3),
          soreness: 2 + random.nextInt(3),
          sleepQuality: 1 + random.nextInt(3),
        },
      };
      state.readinessActive = true;
      return action;
    }
    case 'readiness.clear': {
      if (!state.readinessActive) throw new Error('readiness.clear requires an active fact.');
      const action: ExplorerAction = {
        type: 'readiness.clear',
        target: { kind: 'readiness', readinessId: CANONICAL.readinessId },
        args: { date: DATE.sessionInitial },
      };
      state.readinessActive = false;
      return action;
    }
    case 'equipment.set': {
      if (state.equipmentActive) throw new Error('equipment.set requires an absent fact.');
      const action: ExplorerAction = {
        type: 'equipment.set',
        target: { kind: 'equipment-fact', equipmentFactId: CANONICAL.equipmentFactId },
        args: {
          fromDate: DATE.weekStart,
          toDate: DATE.factEnd,
          availableEquipmentIds: random.nextInt(2) === 0
            ? ['bodyweight', 'dumbbell']
            : ['bodyweight', 'resistance-band'],
          unavailableEquipmentIds: ['barbell', 'cable-machine'],
        },
      };
      state.equipmentActive = true;
      return action;
    }
    case 'equipment.clear': {
      if (!state.equipmentActive) throw new Error('equipment.clear requires an active fact.');
      const action: ExplorerAction = {
        type: 'equipment.clear',
        target: { kind: 'equipment-fact', equipmentFactId: CANONICAL.equipmentFactId },
        args: { clearedOn: DATE.factEnd },
      };
      state.equipmentActive = false;
      return action;
    }
    case 'session-feedback.record': {
      if (state.sessionDate === null) {
        throw new Error('session-feedback.record requires a session.');
      }
      return {
        type: 'session-feedback.record',
        target: {
          kind: 'session-feedback',
          sessionId: CANONICAL.sessionId,
          feedbackId: CANONICAL.feedbackId,
        },
        args: {
          date: state.sessionDate,
          completion: random.nextInt(2) === 0 ? 'partial' : 'full',
          feeling: random.nextInt(2) === 0 ? 'hard' : 'too-hard',
          soreness: random.nextInt(2) === 0 ? 'moderate' : 'severe',
          difficulty: 7 + random.nextInt(3),
        },
      };
    }
    case 'adjustment.restore': {
      if (!state.adjustmentActive) {
        throw new Error('adjustment.restore requires an active ledger entry.');
      }
      const action: ExplorerAction = {
        type: 'adjustment.restore',
        target: { kind: 'adjustment', adjustmentId: CANONICAL.adjustmentId },
        args: { restoredOn: DATE.sessionMoved },
      };
      state.adjustmentActive = false;
      return action;
    }
    case 'week.repeat':
      return {
        type: 'week.repeat',
        target: { kind: 'week', weekId: CANONICAL.weekId },
        args: { sourceWeekStart: DATE.weekStart, targetWeekStart: DATE.nextWeekStart },
        capability: { capabilityId: 'week.repeat', status: 'enabled' },
      };
    case 'fixture.add':
    case 'session.delete':
    case 'coach.message':
      throw new Error(`Unexpected operation in seeded chain graph: ${actionKind}.`);
    default: {
      const exhaustive: never = actionKind;
      return exhaustive;
    }
  }
}

function targetPrecondition(action: ExplorerAction): ExplorerEligibilityPredicate {
  switch (action.type) {
    case 'fixture.add':
      return {
        predicateId: 'target',
        type: 'fixture-absent',
        fixtureId: action.target.fixtureId,
        date: action.args.date,
      };
    case 'fixture.move':
    case 'fixture.remove':
      return {
        predicateId: 'target',
        type: 'fixture-exists',
        fixtureId: action.target.fixtureId,
        date: action.type === 'fixture.move' ? action.args.fromDate : action.args.date,
      };
    case 'session.move':
    case 'session.delete':
      return {
        predicateId: 'target',
        type: 'session-exists',
        sessionId: action.target.sessionId,
        date: action.type === 'session.move' ? action.args.fromDate : action.args.date,
      };
    case 'component.delete':
      return {
        predicateId: 'target',
        type: 'component-exists',
        sessionId: action.target.sessionId,
        componentId: action.target.componentId,
        date: action.args.date,
      };
    case 'injury.set':
    case 'readiness.set':
    case 'equipment.set':
      return {
        predicateId: 'target',
        type: 'source-fact-absent',
        sourceFactId: action.type === 'injury.set'
          ? action.target.injuryEpisodeId
          : action.type === 'readiness.set'
            ? action.target.readinessId
            : action.target.equipmentFactId,
        sourceFactType: action.type === 'injury.set'
          ? 'injury'
          : action.type === 'readiness.set'
            ? 'readiness'
            : 'equipment',
      };
    case 'injury.resolve':
    case 'readiness.clear':
    case 'equipment.clear':
      return {
        predicateId: 'target',
        type: 'source-fact-exists',
        sourceFactId: action.type === 'injury.resolve'
          ? action.target.injuryEpisodeId
          : action.type === 'readiness.clear'
            ? action.target.readinessId
            : action.target.equipmentFactId,
        sourceFactType: action.type === 'injury.resolve'
          ? 'injury'
          : action.type === 'readiness.clear'
            ? 'readiness'
            : 'equipment',
      };
    case 'session-feedback.record':
      return {
        predicateId: 'target',
        type: 'session-exists',
        sessionId: action.target.sessionId,
        date: action.args.date,
      };
    case 'adjustment.restore':
      return {
        predicateId: 'target',
        type: 'reversible-adjustment-status',
        adjustmentId: action.target.adjustmentId,
        status: 'active',
      };
    case 'week.repeat':
      return {
        predicateId: 'target',
        type: 'accepted-week-count',
        operator: 'at-least',
        count: 1,
      };
    case 'coach.message':
      return {
        predicateId: 'target',
        type: 'coach-interpretation-receipt-available',
        conversationId: action.target.conversationId,
        messageId: action.target.messageId,
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function ingressForAction(action: ExplorerAction): ExplorerIngressSurface {
  switch (action.type) {
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove':
      return 'fixture-editor';
    case 'session.move':
    case 'session.delete':
      return 'session-editor';
    case 'component.delete':
      return 'program-detail';
    case 'injury.set':
    case 'injury.resolve':
      return 'injury-editor';
    case 'readiness.set':
    case 'readiness.clear':
      return 'readiness-editor';
    case 'equipment.set':
    case 'equipment.clear':
      return 'equipment-editor';
    case 'session-feedback.record':
      return 'session-feedback';
    case 'adjustment.restore':
      return 'adjustment-history';
    case 'week.repeat':
      return 'week-controls';
    case 'coach.message':
      return 'coach-chat';
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function oraclesForAction(
  action: ExplorerAction,
  stepId: string,
  priorStepId: string | null,
  baselineStepId: string,
): readonly ExplorerOracleAssertion[] {
  return [
    {
      oracleId: `${stepId}-render`,
      type: 'rendered-witness',
      testId: 'explorer-visible-target',
      selector: '/program',
      relation: 'equals-accepted',
    },
    {
      oracleId: `${stepId}-trace`,
      type: 'trace-v2-production-receipt',
      schemaVersion: 2,
      terminalStatus: 'finalized_success',
    },
    {
      oracleId: `${stepId}-persisted`,
      type: 'persisted-accepted-equality',
      selector: '/program',
    },
    {
      oracleId: `${stepId}-fingerprint`,
      type: 'semantic-fingerprint',
      subject: 'accepted-state',
      relation: 'changed-from-before',
    },
    {
      oracleId: `${stepId}-unrelated`,
      type: 'unrelated-state-unchanged',
      selectors: ['/profile'],
    },
    ...(priorStepId === null ? [] : [{
      oracleId: `${stepId}-prior-trace`,
      type: 'prior-trace-linkage' as const,
      priorStepId,
    }]),
    ...(action.type === 'adjustment.restore' ? [{
      oracleId: `${stepId}-restoration`,
      type: 'restoration-equality' as const,
      baselineStepId,
      selector: '/program',
    }] : []),
  ];
}

function invariantsForAction(
  action: ExplorerAction,
  hasPriorStep: boolean,
): readonly [ExplorerInvariantId, ...ExplorerInvariantId[]] {
  const invariants: ExplorerInvariantId[] = [
    'no-false-success',
    'durable-readback-equals-accepted-state',
    'render-equals-accepted-state',
    'unrelated-state-unchanged',
  ];
  if (hasPriorStep) invariants.push('trace-chain-contiguous');
  if (action.type.startsWith('fixture.')) invariants.push('fixture-anchor-valid');
  if (
    action.type.startsWith('injury.') ||
    action.type.startsWith('readiness.') ||
    action.type.startsWith('equipment.') ||
    action.type === 'session-feedback.record'
  ) {
    invariants.push('source-fact-has-programming-effect');
  }
  if (action.type === 'adjustment.restore') {
    invariants.push('restoration-equals-pre-mutation-state');
  }
  return invariants as [ExplorerInvariantId, ...ExplorerInvariantId[]];
}

function chainScenario(
  campaignSeed: number,
  chainOrdinal: number,
): ExplorerScenarioContract {
  const chainId = `explorer-seeded-chain-${String(chainOrdinal).padStart(2, '0')}`;
  const random = new ExplorerPcg32(campaignSeed, chainOrdinal);
  const operations = selectOperationOrder(random);
  const state = initialChainState();
  const actions = operations.map((node) => materializeAction(node.actionKind, state, random));
  const stepIds = actions.map((_, index) =>
    `${chainId}-step-${String(index + 1).padStart(2, '0')}`);
  const steps = actions.map((action, index): ExplorerScenarioStep => {
    const stepId = stepIds[index];
    const priorStepId = index === 0 ? null : stepIds[index - 1];
    const actionNumber = index + 1;
    const reload = EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS.includes(
      actionNumber as (typeof EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS)[number],
    ) ? 'required' as const : 'not-required' as const;
    return {
      stepId,
      action,
      preconditions: [
        {
          predicateId: 'revision',
          type: 'accepted-revision',
          revision: index,
        },
        {
          predicateId: 'phase',
          type: 'phase-signature',
          signature: 'in-season-standard',
        },
        targetPrecondition(action),
      ],
      ingress: ingressForAction(action),
      controlTestId: 'explorer-action-control',
      targetTestIds: ['explorer-visible-target'],
      checkpointPolicy: {
        kind: 'durable',
        reload,
        renderedProof: 'required',
      },
      expectedOutcome: {
        kind: 'accepted',
        stateChange: 'required',
        acceptedRevisionDelta: 1,
      },
      oracleAssertions: oraclesForAction(action, stepId, priorStepId, stepIds[0]),
      requiredInvariants: invariantsForAction(action, priorStepId !== null),
    };
  });
  if (steps.length !== EXPLORER_SEEDED_CHAIN_ACTION_COUNT) {
    throw new Error(`Explorer chain ${chainId} did not produce exactly 12 actions.`);
  }
  return validateExplorerScenarioContract({
    schemaVersion: EXPLORER_SCENARIO_SCHEMA_VERSION,
    scenarioId: chainId,
    tier: 'seeded-chain',
    seedId: 'multi-reload-fixture-chain',
    tags: ['explorer', 'seeded-chain', 'pure-generation'],
    campaignSeed,
    budgetMs: 300_000,
    steps: steps as [ExplorerScenarioStep, ...ExplorerScenarioStep[]],
  }, {
    declaredCapabilities: EXPLORER_ENABLED_CAPABILITY_DECLARATIONS,
  });
}

export function generateExplorerSeededChainManifests(
  campaignSeed: number,
): ExplorerSeededChainGeneration {
  if (!Number.isSafeInteger(campaignSeed) || campaignSeed < 0) {
    throw new Error('Explorer campaign seed must be a non-negative safe integer.');
  }
  const chains = Array.from(
    { length: EXPLORER_SEEDED_CHAIN_COUNT },
    (_, index): ExplorerSeededChainManifest => {
      const chainOrdinal = index + 1;
      const chainId = `explorer-seeded-chain-${String(chainOrdinal).padStart(2, '0')}`;
      const scenario = chainScenario(campaignSeed, chainOrdinal);
      const scenarioSemanticHash = explorerScenarioSemanticHash(scenario);
      const actionSemanticHashes = scenario.steps.map((step) =>
        explorerActionSemanticHash(step.action));
      const reloadCheckpoints = EXPLORER_SEEDED_CHAIN_RELOAD_ACTIONS.map(
        (afterAction): ExplorerReloadCheckpoint => ({
          afterAction,
          stepId: scenario.steps[afterAction - 1].stepId,
          policy: 'required',
        }),
      );
      return {
        chainId,
        campaignSeed,
        chainOrdinal,
        scenario,
        scenarioSemanticHash,
        actionSemanticHashes,
        reloadCheckpoints,
        manifestSemanticHash: semanticFingerprintV2({
          contract: 'explorer-seeded-chain-manifest-v1',
          chainId,
          campaignSeed,
          chainOrdinal,
          scenarioSemanticHash,
          actionSemanticHashes,
          reloadCheckpoints,
        }),
      };
    },
  );
  const projection = {
    generatorVersion: EXPLORER_SEEDED_CHAIN_GENERATOR_VERSION,
    campaignSeed,
    chainManifestHashes: chains.map((chain) => chain.manifestSemanticHash),
  };
  return {
    generatorVersion: EXPLORER_SEEDED_CHAIN_GENERATOR_VERSION,
    campaignSeed,
    chains,
    semanticHash: semanticFingerprintV2({
      contract: 'explorer-seeded-chain-generation-v1',
      generation: projection,
    }),
  };
}

export interface ExplorerChainEligibilityBaseline {
  readonly fixture: Readonly<Record<string, { readonly exists: boolean; readonly date: string | null }>>;
  readonly session: Readonly<Record<string, { readonly exists: boolean; readonly date: string | null }>>;
  readonly component: Readonly<Record<string, boolean>>;
  readonly injury: Readonly<Record<string, boolean>>;
  readonly readiness: Readonly<Record<string, boolean>>;
  readonly equipment: Readonly<Record<string, boolean>>;
  readonly adjustment: Readonly<Record<string, boolean>>;
}

interface MutableExplorerChainEligibilityState {
  fixture: Record<string, { exists: boolean; date: string | null }>;
  session: Record<string, { exists: boolean; date: string | null }>;
  component: Record<string, boolean>;
  injury: Record<string, boolean>;
  readiness: Record<string, boolean>;
  equipment: Record<string, boolean>;
  adjustment: Record<string, boolean>;
}

function componentKey(sessionId: string, componentId: string): string {
  return `${sessionId}::${componentId}`;
}

export function deriveExplorerChainEligibilityBaseline(
  original: ExplorerScenarioContract,
): ExplorerChainEligibilityBaseline {
  const fixture: Record<string, { exists: boolean; date: string | null }> = {};
  const session: Record<string, { exists: boolean; date: string | null }> = {};
  const component: Record<string, boolean> = {};
  const injury: Record<string, boolean> = {};
  const readiness: Record<string, boolean> = {};
  const equipment: Record<string, boolean> = {};
  const adjustment: Record<string, boolean> = {};
  original.steps.forEach(({ action }) => {
    switch (action.type) {
      case 'fixture.add':
        fixture[action.target.fixtureId] ??= { exists: false, date: null };
        break;
      case 'fixture.move':
        fixture[action.target.fixtureId] ??= { exists: true, date: action.args.fromDate };
        break;
      case 'fixture.remove':
        fixture[action.target.fixtureId] ??= { exists: true, date: action.args.date };
        break;
      case 'session.move':
        session[action.target.sessionId] ??= { exists: true, date: action.args.fromDate };
        break;
      case 'session.delete':
        session[action.target.sessionId] ??= { exists: true, date: action.args.date };
        break;
      case 'component.delete':
        session[action.target.sessionId] ??= { exists: true, date: action.args.date };
        component[componentKey(action.target.sessionId, action.target.componentId)] ??= true;
        break;
      case 'injury.set':
        injury[action.target.injuryEpisodeId] ??= false;
        break;
      case 'injury.resolve':
        injury[action.target.injuryEpisodeId] ??= true;
        break;
      case 'readiness.set':
        readiness[action.target.readinessId] ??= false;
        break;
      case 'readiness.clear':
        readiness[action.target.readinessId] ??= true;
        break;
      case 'equipment.set':
        equipment[action.target.equipmentFactId] ??= false;
        break;
      case 'equipment.clear':
        equipment[action.target.equipmentFactId] ??= true;
        break;
      case 'session-feedback.record':
        session[action.target.sessionId] ??= { exists: true, date: action.args.date };
        break;
      case 'adjustment.restore':
        adjustment[action.target.adjustmentId] ??= true;
        break;
      case 'week.repeat':
      case 'coach.message':
        break;
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  });
  return { fixture, session, component, injury, readiness, equipment, adjustment };
}

function cloneBaseline(baseline: ExplorerChainEligibilityBaseline): {
  fixture: MutableExplorerChainEligibilityState['fixture'];
  session: MutableExplorerChainEligibilityState['session'];
  component: MutableExplorerChainEligibilityState['component'];
  injury: MutableExplorerChainEligibilityState['injury'];
  readiness: MutableExplorerChainEligibilityState['readiness'];
  equipment: MutableExplorerChainEligibilityState['equipment'];
  adjustment: MutableExplorerChainEligibilityState['adjustment'];
} {
  return JSON.parse(JSON.stringify(baseline)) as MutableExplorerChainEligibilityState;
}

export function explorerChainEligibilityIssues(
  candidate: ExplorerScenarioContract,
  baseline: ExplorerChainEligibilityBaseline = deriveExplorerChainEligibilityBaseline(candidate),
): readonly string[] {
  const issues: string[] = [];
  try {
    validateExplorerScenarioContract(candidate, {
      declaredCapabilities: EXPLORER_ENABLED_CAPABILITY_DECLARATIONS,
    });
  } catch (error) {
    issues.push(`scenario-contract:${String(error)}`);
    return issues;
  }
  const state = cloneBaseline(baseline);
  candidate.steps.forEach(({ stepId, action }) => {
    const capability = explorerActionCapabilityProfile(action.type);
    if (capability.status !== 'enabled') {
      issues.push(`${stepId}:capability-disabled:${action.type}`);
      return;
    }
    switch (action.type) {
      case 'fixture.add': {
        const current = state.fixture[action.target.fixtureId];
        if (!current || current.exists) issues.push(`${stepId}:fixture-add-ineligible`);
        else state.fixture[action.target.fixtureId] = { exists: true, date: action.args.date };
        break;
      }
      case 'fixture.move': {
        const current = state.fixture[action.target.fixtureId];
        if (!current?.exists || current.date !== action.args.fromDate) {
          issues.push(`${stepId}:fixture-move-ineligible`);
        } else current.date = action.args.toDate;
        break;
      }
      case 'fixture.remove': {
        const current = state.fixture[action.target.fixtureId];
        if (!current?.exists || current.date !== action.args.date) {
          issues.push(`${stepId}:fixture-remove-ineligible`);
        } else {
          current.exists = false;
          current.date = null;
        }
        break;
      }
      case 'session.move': {
        const current = state.session[action.target.sessionId];
        if (!current?.exists || current.date !== action.args.fromDate) {
          issues.push(`${stepId}:session-move-ineligible`);
        } else current.date = action.args.toDate;
        break;
      }
      case 'session.delete': {
        const current = state.session[action.target.sessionId];
        if (!current?.exists || current.date !== action.args.date) {
          issues.push(`${stepId}:session-delete-ineligible`);
        } else {
          current.exists = false;
          current.date = null;
        }
        break;
      }
      case 'component.delete': {
        const current = state.session[action.target.sessionId];
        const key = componentKey(action.target.sessionId, action.target.componentId);
        if (!current?.exists || current.date !== action.args.date || !state.component[key]) {
          issues.push(`${stepId}:component-delete-ineligible`);
        } else state.component[key] = false;
        break;
      }
      case 'injury.set':
        if (state.injury[action.target.injuryEpisodeId] !== false) {
          issues.push(`${stepId}:injury-set-ineligible`);
        } else state.injury[action.target.injuryEpisodeId] = true;
        break;
      case 'injury.resolve':
        if (state.injury[action.target.injuryEpisodeId] !== true) {
          issues.push(`${stepId}:injury-resolve-ineligible`);
        } else state.injury[action.target.injuryEpisodeId] = false;
        break;
      case 'readiness.set':
        if (state.readiness[action.target.readinessId] !== false) {
          issues.push(`${stepId}:readiness-set-ineligible`);
        } else state.readiness[action.target.readinessId] = true;
        break;
      case 'readiness.clear':
        if (state.readiness[action.target.readinessId] !== true) {
          issues.push(`${stepId}:readiness-clear-ineligible`);
        } else state.readiness[action.target.readinessId] = false;
        break;
      case 'equipment.set':
        if (state.equipment[action.target.equipmentFactId] !== false) {
          issues.push(`${stepId}:equipment-set-ineligible`);
        } else state.equipment[action.target.equipmentFactId] = true;
        break;
      case 'equipment.clear':
        if (state.equipment[action.target.equipmentFactId] !== true) {
          issues.push(`${stepId}:equipment-clear-ineligible`);
        } else state.equipment[action.target.equipmentFactId] = false;
        break;
      case 'session-feedback.record': {
        const current = state.session[action.target.sessionId];
        if (!current?.exists || current.date !== action.args.date) {
          issues.push(`${stepId}:feedback-ineligible`);
        }
        break;
      }
      case 'adjustment.restore':
        if (state.adjustment[action.target.adjustmentId] !== true) {
          issues.push(`${stepId}:restoration-ineligible`);
        } else state.adjustment[action.target.adjustmentId] = false;
        break;
      case 'week.repeat':
        break;
      case 'coach.message':
        issues.push(`${stepId}:coach-message-disabled`);
        break;
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  });
  return issues;
}

export function isExplorerChainEligible(
  candidate: ExplorerScenarioContract,
  baseline?: ExplorerChainEligibilityBaseline,
): boolean {
  return explorerChainEligibilityIssues(candidate, baseline).length === 0;
}
