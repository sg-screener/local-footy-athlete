import { sha256Hex, semanticFingerprintV2, type SemanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  EXPLORER_CAPABILITY_MATRIX,
  EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH,
  EXPLORER_ENABLED_CAPABILITY_DECLARATIONS,
  explorerActionCapabilityProfile,
  explorerCapabilityPairId,
  explorerCapabilityPairsForRow,
  explorerCapabilityRowExclusionReasons,
  explorerCapabilityRowSignature,
  type ExplorerCapabilityDimension,
  type ExplorerCapabilityRow,
} from './explorerCapabilityMatrix';
import type { ExplorerOracleAssertion } from './explorerOracleContracts';
import {
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  type ExplorerAction,
  type ExplorerEligibilityPredicate,
  type ExplorerExpectedOutcome,
  type ExplorerIngressSurface,
  type ExplorerNonEmptyArray,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  explorerScenarioSemanticHash,
  validateExplorerScenarioContract,
  type ExplorerScenarioSemanticHash,
} from './explorerScenarioContractValidation';

export const EXPLORER_PAIRWISE_GENERATOR_VERSION = 1 as const;
export const EXPLORER_PAIRWISE_TARGET_MIN_ROWS = 40 as const;
export const EXPLORER_PAIRWISE_TARGET_MAX_ROWS = 80 as const;

export interface ExplorerExcludedPairReceipt {
  readonly pairId: string;
  readonly left: {
    readonly dimension: ExplorerCapabilityDimension;
    readonly value: string;
  };
  readonly right: {
    readonly dimension: ExplorerCapabilityDimension;
    readonly value: string;
  };
  readonly constraintIds: readonly string[];
  readonly reason: 'no-feasible-complete-row';
}

export interface ExplorerPairwiseRowManifest {
  readonly rowId: string;
  readonly campaignSeed: number;
  readonly dimensions: ExplorerCapabilityRow;
  readonly coveredPairIds: readonly string[];
  readonly scenario: ExplorerScenarioContract;
  readonly scenarioSemanticHash: ExplorerScenarioSemanticHash;
  readonly manifestSemanticHash: SemanticFingerprintV2;
}

export interface ExplorerPairwiseGeneration {
  readonly generatorVersion: typeof EXPLORER_PAIRWISE_GENERATOR_VERSION;
  readonly campaignSeed: number;
  readonly capabilityMatrixSemanticHash: SemanticFingerprintV2;
  readonly rows: readonly ExplorerPairwiseRowManifest[];
  readonly feasiblePairIds: readonly string[];
  readonly excludedPairReceipts: readonly ExplorerExcludedPairReceipt[];
  readonly coverage: {
    readonly coveredFeasiblePairs: number;
    readonly totalFeasiblePairs: number;
    readonly percentage: 100;
  };
  readonly semanticHash: SemanticFingerprintV2;
}

interface PairDescriptor {
  readonly pairId: string;
  readonly leftDimension: ExplorerCapabilityDimension;
  readonly leftValue: string;
  readonly rightDimension: ExplorerCapabilityDimension;
  readonly rightValue: string;
}

function assertCampaignSeed(campaignSeed: number): void {
  if (!Number.isSafeInteger(campaignSeed) || campaignSeed < 0) {
    throw new Error('Explorer campaign seed must be a non-negative safe integer.');
  }
}

function enumerateFeasibleRows(): readonly ExplorerCapabilityRow[] {
  const rows: ExplorerCapabilityRow[] = [];
  const dimensions = EXPLORER_CAPABILITY_MATRIX.dimensions;
  const visit = (
    index: number,
    partial: Partial<Record<ExplorerCapabilityDimension, string>>,
  ): void => {
    if (index === dimensions.length) {
      rows.push({ ...partial } as unknown as ExplorerCapabilityRow);
      return;
    }
    const definition = dimensions[index];
    definition.values.forEach((value) => {
      const next = { ...partial, [definition.dimension]: value };
      if (explorerCapabilityRowExclusionReasons(
        next as Partial<ExplorerCapabilityRow>,
      ).length === 0) {
        visit(index + 1, next);
      }
    });
  };
  visit(0, {});
  return rows;
}

function enumerateRawPairs(): readonly PairDescriptor[] {
  const output: PairDescriptor[] = [];
  const dimensions = EXPLORER_CAPABILITY_MATRIX.dimensions;
  for (let left = 0; left < dimensions.length; left += 1) {
    for (let right = left + 1; right < dimensions.length; right += 1) {
      const leftDefinition = dimensions[left];
      const rightDefinition = dimensions[right];
      leftDefinition.values.forEach((leftValue) => {
        rightDefinition.values.forEach((rightValue) => {
          output.push({
            pairId: explorerCapabilityPairId(
              leftDefinition.dimension,
              leftValue,
              rightDefinition.dimension,
              rightValue,
            ),
            leftDimension: leftDefinition.dimension,
            leftValue,
            rightDimension: rightDefinition.dimension,
            rightValue,
          });
        });
      });
    }
  }
  return output.sort((left, right) => left.pairId.localeCompare(right.pairId));
}

function seededIndex(seed: number, key: string, cardinality: number, offset: number): number {
  const prefix = sha256Hex(`${seed}|${key}|${offset}`).slice(0, 8);
  return Number.parseInt(prefix, 16) % cardinality;
}

function candidateRows(
  campaignSeed: number,
  feasibleRows: readonly ExplorerCapabilityRow[],
  rowIndexesByPair: ReadonlyMap<string, readonly number[]>,
): readonly ExplorerCapabilityRow[] {
  const bySignature = new Map<string, ExplorerCapabilityRow>();
  [...rowIndexesByPair.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([pairId, indexes]) => {
      const witnessCount = Math.min(4, indexes.length);
      for (let offset = 0; offset < witnessCount; offset += 1) {
        const index = indexes[seededIndex(campaignSeed, pairId, indexes.length, offset)];
        const row = feasibleRows[index];
        bySignature.set(explorerCapabilityRowSignature(row), row);
      }
    });
  return [...bySignature.values()];
}

function selectCoveringRows(
  campaignSeed: number,
  feasiblePairIds: readonly string[],
  candidatesInput: readonly ExplorerCapabilityRow[],
): readonly ExplorerCapabilityRow[] {
  const feasible = new Set(feasiblePairIds);
  const uncovered = new Set(feasiblePairIds);
  const candidates = candidatesInput.map((row) => ({
    row,
    signature: explorerCapabilityRowSignature(row),
    pairs: explorerCapabilityPairsForRow(row).filter((pairId) => feasible.has(pairId)),
  }));
  const selected: ExplorerCapabilityRow[] = [];

  while (uncovered.size > 0) {
    let winnerIndex = -1;
    let winnerScore = -1;
    let winnerRank = '';
    candidates.forEach((candidate, index) => {
      const score = candidate.pairs.reduce(
        (total, pairId) => total + (uncovered.has(pairId) ? 1 : 0),
        0,
      );
      const rank = sha256Hex(`${campaignSeed}|${candidate.signature}`);
      if (
        score > winnerScore ||
        (score === winnerScore && (winnerIndex < 0 || rank < winnerRank))
      ) {
        winnerIndex = index;
        winnerScore = score;
        winnerRank = rank;
      }
    });
    if (winnerIndex < 0 || winnerScore <= 0) {
      throw new Error(`Pairwise generation left ${uncovered.size} feasible pairs uncovered.`);
    }
    const [winner] = candidates.splice(winnerIndex, 1);
    selected.push(winner.row);
    winner.pairs.forEach((pairId) => uncovered.delete(pairId));
  }

  if (selected.length < EXPLORER_PAIRWISE_TARGET_MIN_ROWS) {
    candidates
      .sort((left, right) => {
        const leftRank = sha256Hex(`${campaignSeed}|padding|${left.signature}`);
        const rightRank = sha256Hex(`${campaignSeed}|padding|${right.signature}`);
        return leftRank.localeCompare(rightRank);
      })
      .slice(0, EXPLORER_PAIRWISE_TARGET_MIN_ROWS - selected.length)
      .forEach((candidate) => selected.push(candidate.row));
  }
  if (selected.length > EXPLORER_PAIRWISE_TARGET_MAX_ROWS) {
    throw new Error(
      `Initial Explorer pairwise matrix requires ${selected.length} rows; target maximum is ${EXPLORER_PAIRWISE_TARGET_MAX_ROWS}.`,
    );
  }
  return selected;
}

const DATE = {
  weekStart: '2026-07-13',
  nextWeekStart: '2026-07-20',
  session: '2026-07-14',
  sessionTarget: '2026-07-15',
  fixture: '2026-07-18',
  fixtureTarget: '2026-07-19',
  resolution: '2026-07-21',
} as const;

function actionForRow(row: ExplorerCapabilityRow): ExplorerAction {
  const fixtureKind = row.fixtureState === 'scheduled-practice-match'
    ? 'practice-match' as const
    : 'game' as const;
  switch (row.actionKind) {
    case 'fixture.add':
      return {
        type: 'fixture.add',
        target: { kind: 'fixture', fixtureId: 'fixture-primary' },
        args: { date: DATE.fixture, fixtureKind, opponentId: 'opponent-primary' },
      };
    case 'fixture.move':
      return {
        type: 'fixture.move',
        target: { kind: 'fixture', fixtureId: 'fixture-primary' },
        args: { fromDate: DATE.fixture, toDate: DATE.fixtureTarget },
      };
    case 'fixture.remove':
      return {
        type: 'fixture.remove',
        target: { kind: 'fixture', fixtureId: 'fixture-primary' },
        args: { date: DATE.fixture },
      };
    case 'session.move':
      return {
        type: 'session.move',
        target: { kind: 'session', sessionId: 'session-primary' },
        args: { fromDate: DATE.session, toDate: DATE.sessionTarget },
      };
    case 'session.delete':
      return {
        type: 'session.delete',
        target: { kind: 'session', sessionId: 'session-primary' },
        args: { date: DATE.session },
      };
    case 'component.delete':
      return {
        type: 'component.delete',
        target: {
          kind: 'component',
          sessionId: 'session-primary',
          componentId: 'component-primary',
        },
        args: { date: DATE.session },
      };
    case 'injury.set':
      return {
        type: 'injury.set',
        target: { kind: 'injury-episode', injuryEpisodeId: 'injury-primary' },
        args: {
          effectiveDate: DATE.weekStart,
          bodyRegionId: 'hamstring',
          severity: 'moderate',
          laterality: 'left',
        },
      };
    case 'injury.resolve':
      return {
        type: 'injury.resolve',
        target: { kind: 'injury-episode', injuryEpisodeId: 'injury-primary' },
        args: { resolvedDate: DATE.resolution },
      };
    case 'readiness.set':
      return {
        type: 'readiness.set',
        target: { kind: 'readiness', readinessId: 'readiness-primary' },
        args: { date: DATE.session, fatigue: 4, soreness: 3, sleepQuality: 2 },
      };
    case 'readiness.clear':
      return {
        type: 'readiness.clear',
        target: { kind: 'readiness', readinessId: 'readiness-primary' },
        args: { date: DATE.session },
      };
    case 'equipment.set':
      return {
        type: 'equipment.set',
        target: { kind: 'equipment-fact', equipmentFactId: 'equipment-primary' },
        args: {
          fromDate: DATE.weekStart,
          toDate: DATE.resolution,
          availableEquipmentIds: ['bodyweight', 'dumbbell'],
          unavailableEquipmentIds: ['barbell'],
        },
      };
    case 'equipment.clear':
      return {
        type: 'equipment.clear',
        target: { kind: 'equipment-fact', equipmentFactId: 'equipment-primary' },
        args: { clearedOn: DATE.resolution },
      };
    case 'session-feedback.record':
      return {
        type: 'session-feedback.record',
        target: {
          kind: 'session-feedback',
          sessionId: 'session-primary',
          feedbackId: 'feedback-primary',
        },
        args: {
          date: DATE.session,
          completion: 'partial',
          feeling: 'hard',
          soreness: 'moderate',
          difficulty: 8,
        },
      };
    case 'adjustment.restore':
      return {
        type: 'adjustment.restore',
        target: { kind: 'adjustment', adjustmentId: 'adjustment-primary' },
        args: { restoredOn: DATE.sessionTarget },
      };
    case 'week.repeat':
      return {
        type: 'week.repeat',
        target: { kind: 'week', weekId: 'week-primary' },
        args: { sourceWeekStart: DATE.weekStart, targetWeekStart: DATE.nextWeekStart },
        capability: { capabilityId: 'week.repeat', status: 'enabled' },
      };
    case 'coach.message':
      return {
        type: 'coach.message',
        target: {
          kind: 'coach-message',
          conversationId: 'conversation-primary',
          messageId: 'message-primary',
        },
        args: { message: 'Move the visible session.', visibleWeekId: 'week-primary' },
        capability: { capabilityId: 'coach.message', status: 'disabled' },
      };
    default: {
      const exhaustive: never = row.actionKind;
      return exhaustive;
    }
  }
}

function sourceFactPredicate(row: ExplorerCapabilityRow): ExplorerEligibilityPredicate {
  switch (row.sourceFacts) {
    case 'none':
      return {
        predicateId: 'source-combination',
        type: 'source-fact-absent',
        sourceFactId: 'source-combination-primary',
        sourceFactType: 'readiness',
      };
    case 'injury-readiness':
      return {
        predicateId: 'source-combination',
        type: 'source-fact-exists',
        sourceFactId: 'injury-primary',
        sourceFactType: 'injury',
      };
    case 'equipment':
      return {
        predicateId: 'source-combination',
        type: 'source-fact-exists',
        sourceFactId: 'equipment-primary',
        sourceFactType: 'equipment',
      };
    case 'feedback':
      return {
        predicateId: 'source-combination',
        type: 'source-fact-exists',
        sourceFactId: 'feedback-primary',
        sourceFactType: 'session-feedback',
      };
    default: {
      const exhaustive: never = row.sourceFacts;
      return exhaustive;
    }
  }
}

function targetPredicate(action: ExplorerAction): ExplorerEligibilityPredicate {
  switch (action.type) {
    case 'fixture.add':
      return {
        predicateId: 'action-target',
        type: 'fixture-absent',
        fixtureId: action.target.fixtureId,
        date: action.args.date,
      };
    case 'fixture.move':
    case 'fixture.remove':
      return {
        predicateId: 'action-target',
        type: 'fixture-exists',
        fixtureId: action.target.fixtureId,
        date: action.type === 'fixture.move' ? action.args.fromDate : action.args.date,
      };
    case 'session.move':
    case 'session.delete':
      return {
        predicateId: 'action-target',
        type: 'session-exists',
        sessionId: action.target.sessionId,
        date: action.type === 'session.move' ? action.args.fromDate : action.args.date,
      };
    case 'component.delete':
      return {
        predicateId: 'action-target',
        type: 'component-exists',
        sessionId: action.target.sessionId,
        componentId: action.target.componentId,
        date: action.args.date,
      };
    case 'injury.set':
    case 'readiness.set':
    case 'equipment.set':
      return {
        predicateId: 'action-target',
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
        predicateId: 'action-target',
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
        predicateId: 'action-target',
        type: 'session-exists',
        sessionId: action.target.sessionId,
        date: action.args.date,
      };
    case 'adjustment.restore':
      return {
        predicateId: 'action-target',
        type: 'reversible-adjustment-status',
        adjustmentId: action.target.adjustmentId,
        status: 'active',
      };
    case 'week.repeat':
      return {
        predicateId: 'action-target',
        type: 'accepted-week-count',
        operator: 'at-least',
        count: 1,
      };
    case 'coach.message':
      return {
        predicateId: 'action-target',
        type: 'accepted-week-count',
        operator: 'at-least',
        count: 1,
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function ingressForAction(action: ExplorerAction): ExplorerIngressSurface {
  if (action.type.startsWith('fixture.')) return 'fixture-editor';
  if (action.type.startsWith('session.') && action.type !== 'session-feedback.record') {
    return 'session-editor';
  }
  if (action.type === 'component.delete') return 'program-detail';
  if (action.type.startsWith('injury.')) return 'injury-editor';
  if (action.type.startsWith('readiness.')) return 'readiness-editor';
  if (action.type.startsWith('equipment.')) return 'equipment-editor';
  if (action.type === 'session-feedback.record') return 'session-feedback';
  if (action.type === 'adjustment.restore') return 'adjustment-history';
  if (action.type === 'week.repeat') return 'week-controls';
  return 'coach-chat';
}

function expectedOutcome(row: ExplorerCapabilityRow): ExplorerExpectedOutcome {
  if (row.expectedDisposition === 'accepted') {
    return { kind: 'accepted', stateChange: 'required', acceptedRevisionDelta: 1 };
  }
  if (row.expectedDisposition === 'rejected') {
    return {
      kind: 'rejected',
      stateChange: 'forbidden',
      reasonCode: 'explorer-expected-rejection',
    };
  }
  return {
    kind: 'capability-disabled',
    stateChange: 'forbidden',
    capabilityId: 'coach.message',
  };
}

function oraclesForRow(
  row: ExplorerCapabilityRow,
  stepId: string,
): readonly ExplorerOracleAssertion[] {
  if (row.expectedDisposition === 'capability-disabled') return [];
  const accepted = row.expectedDisposition === 'accepted';
  return [
    {
      oracleId: `${stepId}-render`,
      type: 'rendered-witness',
      testId: 'explorer-visible-target',
      selector: '/program',
      relation: accepted ? 'equals-accepted' : 'present',
    },
    {
      oracleId: `${stepId}-trace`,
      type: 'trace-v2-production-receipt',
      schemaVersion: 2,
      terminalStatus: accepted ? 'finalized_success' : 'finalized_failure',
    },
    {
      oracleId: `${stepId}-fingerprint`,
      type: 'semantic-fingerprint',
      subject: 'accepted-state',
      relation: accepted ? 'changed-from-before' : 'unchanged-from-before',
    },
    ...(accepted ? [{
      oracleId: `${stepId}-persisted`,
      type: 'persisted-accepted-equality' as const,
      selector: '/program',
    }] : []),
  ];
}

function scenarioForRow(
  campaignSeed: number,
  row: ExplorerCapabilityRow,
  ordinal: number,
): ExplorerScenarioContract {
  const rowId = `explorer-pairwise-${String(ordinal).padStart(3, '0')}`;
  const stepId = `${rowId}-step`;
  const action = actionForRow(row);
  const checkpointPolicy: ExplorerScenarioStep['checkpointPolicy'] =
    row.expectedDisposition === 'accepted'
      ? {
          kind: 'durable',
          reload: row.reloadPolicy,
          renderedProof: 'required',
        }
      : row.expectedDisposition === 'rejected'
        ? { kind: 'rejected', renderedProof: 'required' }
        : { kind: 'none', reason: 'capability-disabled' };
  const step: ExplorerScenarioStep = {
    stepId,
    action,
    preconditions: [
      {
        predicateId: 'phase',
        type: 'phase-signature',
        signature: row.seasonPhase,
      },
      sourceFactPredicate(row),
      targetPredicate(action),
    ],
    ingress: ingressForAction(action),
    controlTestId: 'explorer-action-control',
    targetTestIds: ['explorer-visible-target'],
    checkpointPolicy,
    expectedOutcome: expectedOutcome(row),
    oracleAssertions: oraclesForRow(row, stepId),
    requiredInvariants: [
      'no-false-success',
      ...(row.expectedDisposition === 'accepted'
        ? ['durable-readback-equals-accepted-state' as const]
        : []),
    ] as ExplorerNonEmptyArray<'no-false-success' | 'durable-readback-equals-accepted-state'>,
  };
  const scenario: ExplorerScenarioContract = {
    schemaVersion: EXPLORER_SCENARIO_SCHEMA_VERSION,
    scenarioId: rowId,
    tier: 'pairwise',
    seedId: 'standard-in-season-week',
    tags: ['explorer', 'pairwise', row.seasonPhase, row.actionKind.replace('.', '-')],
    campaignSeed,
    budgetMs: 60_000,
    steps: [step],
  };
  return validateExplorerScenarioContract(scenario, {
    declaredCapabilities: EXPLORER_ENABLED_CAPABILITY_DECLARATIONS,
  });
}

export function generateExplorerPairwiseManifests(
  campaignSeed: number,
): ExplorerPairwiseGeneration {
  assertCampaignSeed(campaignSeed);
  const feasibleRows = enumerateFeasibleRows();
  const rawPairs = enumerateRawPairs();
  const rowIndexesByPair = new Map<string, number[]>();
  feasibleRows.forEach((row, rowIndex) => {
    explorerCapabilityPairsForRow(row).forEach((pairId) => {
      const indexes = rowIndexesByPair.get(pairId) ?? [];
      indexes.push(rowIndex);
      rowIndexesByPair.set(pairId, indexes);
    });
  });
  const feasiblePairIds = [...rowIndexesByPair.keys()].sort((left, right) =>
    left.localeCompare(right));
  const excludedPairReceipts: ExplorerExcludedPairReceipt[] = rawPairs
    .filter((pair) => !rowIndexesByPair.has(pair.pairId))
    .map((pair) => {
      const partial = {
        [pair.leftDimension]: pair.leftValue,
        [pair.rightDimension]: pair.rightValue,
      } as Partial<ExplorerCapabilityRow>;
      const directReasons = explorerCapabilityRowExclusionReasons(partial);
      return {
        pairId: pair.pairId,
        left: { dimension: pair.leftDimension, value: pair.leftValue },
        right: { dimension: pair.rightDimension, value: pair.rightValue },
        constraintIds: directReasons.length > 0
          ? directReasons
          : ['no-feasible-extension'],
        reason: 'no-feasible-complete-row' as const,
      };
    });
  const candidates = candidateRows(campaignSeed, feasibleRows, rowIndexesByPair);
  const selectedRows = selectCoveringRows(campaignSeed, feasiblePairIds, candidates);
  const feasibleSet = new Set(feasiblePairIds);
  const rows = selectedRows.map((dimensions, index): ExplorerPairwiseRowManifest => {
    const rowId = `explorer-pairwise-${String(index + 1).padStart(3, '0')}`;
    const scenario = scenarioForRow(campaignSeed, dimensions, index + 1);
    const scenarioSemanticHash = explorerScenarioSemanticHash(scenario);
    const coveredPairIds = explorerCapabilityPairsForRow(dimensions)
      .filter((pairId) => feasibleSet.has(pairId))
      .sort((left, right) => left.localeCompare(right));
    return {
      rowId,
      campaignSeed,
      dimensions,
      coveredPairIds,
      scenario,
      scenarioSemanticHash,
      manifestSemanticHash: semanticFingerprintV2({
        contract: 'explorer-pairwise-row-manifest-v1',
        campaignSeed,
        capabilityMatrixSemanticHash: EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH,
        rowId,
        dimensions,
        coveredPairIds,
        scenarioSemanticHash,
      }),
    };
  });
  const covered = new Set(rows.flatMap((row) => row.coveredPairIds));
  const missing = feasiblePairIds.filter((pairId) => !covered.has(pairId));
  if (missing.length > 0) {
    throw new Error(`Explorer pairwise generation missed feasible pairs: ${missing.join(', ')}`);
  }
  const semanticProjection = {
    generatorVersion: EXPLORER_PAIRWISE_GENERATOR_VERSION,
    campaignSeed,
    capabilityMatrixSemanticHash: EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH,
    rowManifestHashes: rows.map((row) => row.manifestSemanticHash),
    feasiblePairIds,
    excludedPairReceipts,
    coverage: {
      coveredFeasiblePairs: covered.size,
      totalFeasiblePairs: feasiblePairIds.length,
      percentage: 100 as const,
    },
  };
  return {
    ...semanticProjection,
    rows,
    semanticHash: semanticFingerprintV2({
      contract: 'explorer-pairwise-generation-v1',
      generation: semanticProjection,
    }),
  };
}
