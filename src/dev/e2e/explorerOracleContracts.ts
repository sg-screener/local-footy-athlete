import type {
  ExplorerActionType,
  ExplorerJsonValue,
  ExplorerNonEmptyArray,
} from './explorerScenarioContracts';

export const EXPLORER_ORACLE_TYPES = [
  'accepted-state-projection',
  'absence',
  'semantic-fingerprint',
  'rendered-witness',
  'trace-v2-production-receipt',
  'prior-trace-linkage',
  'persisted-accepted-equality',
  'interpretation-receipt',
  'metamorphic-equality',
  'restoration-equality',
  'unrelated-state-unchanged',
] as const;

export type ExplorerOracleType = (typeof EXPLORER_ORACLE_TYPES)[number];

export const EXPLORER_REQUIRED_INVARIANT_IDS = [
  'no-false-success',
  'durable-readback-equals-accepted-state',
  'render-equals-accepted-state',
  'card-detail-equality',
  'trace-chain-contiguous',
  'source-fact-has-programming-effect',
  'fixture-anchor-valid',
  'restoration-equals-pre-mutation-state',
  'unrelated-state-unchanged',
  'coach-response-agrees-with-visible-plan',
  'same-seed-same-replay',
] as const;

export type ExplorerInvariantId =
  (typeof EXPLORER_REQUIRED_INVARIANT_IDS)[number];

export type ExplorerOracleSubject =
  | 'accepted-state'
  | 'persisted-state'
  | 'visible-card'
  | 'visible-detail'
  | 'source-facts';

export type ExplorerOracleAssertion =
  | {
      readonly oracleId: string;
      readonly type: 'accepted-state-projection';
      readonly selector: string;
      readonly expectedValue: ExplorerJsonValue;
    }
  | {
      readonly oracleId: string;
      readonly type: 'absence';
      readonly subject: ExplorerOracleSubject;
      readonly selector: string;
    }
  | {
      readonly oracleId: string;
      readonly type: 'semantic-fingerprint';
      readonly subject: ExplorerOracleSubject;
      readonly relation: 'changed-from-before' | 'unchanged-from-before' | 'equals-accepted';
    }
  | {
      readonly oracleId: string;
      readonly type: 'rendered-witness';
      readonly testId: string;
      readonly selector: string;
      readonly relation: 'present' | 'absent' | 'equals-accepted';
    }
  | {
      readonly oracleId: string;
      readonly type: 'trace-v2-production-receipt';
      readonly schemaVersion: 2;
      readonly terminalStatus: 'finalized_success' | 'finalized_failure';
    }
  | {
      readonly oracleId: string;
      readonly type: 'prior-trace-linkage';
      readonly priorStepId: string;
    }
  | {
      readonly oracleId: string;
      readonly type: 'persisted-accepted-equality';
      readonly selector: string;
    }
  | {
      readonly oracleId: string;
      readonly type: 'interpretation-receipt';
      readonly conversationId: string;
      readonly messageId: string;
      readonly expectedActionType: ExplorerActionType;
    }
  | {
      readonly oracleId: string;
      readonly type: 'metamorphic-equality';
      readonly leftStepId: string;
      readonly rightStepId: string;
      readonly selector: string;
    }
  | {
      readonly oracleId: string;
      readonly type: 'restoration-equality';
      readonly baselineStepId: string;
      readonly selector: string;
    }
  | {
      readonly oracleId: string;
      readonly type: 'unrelated-state-unchanged';
      readonly selectors: ExplorerNonEmptyArray<string>;
    };

export function explorerOracleRequiresAcceptedCheckpoint(
  oracle: ExplorerOracleAssertion,
): boolean {
  switch (oracle.type) {
    case 'accepted-state-projection':
    case 'persisted-accepted-equality':
    case 'metamorphic-equality':
    case 'restoration-equality':
      return true;
    case 'absence':
    case 'semantic-fingerprint':
    case 'rendered-witness':
    case 'trace-v2-production-receipt':
    case 'prior-trace-linkage':
    case 'interpretation-receipt':
    case 'unrelated-state-unchanged':
      return false;
    default: {
      const exhaustive: never = oracle;
      return exhaustive;
    }
  }
}
