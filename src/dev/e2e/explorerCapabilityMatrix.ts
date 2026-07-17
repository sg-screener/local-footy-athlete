import { semanticFingerprintV2, type SemanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  EXPLORER_ACTION_TYPES,
  EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
  type ExplorerActionType,
  type ExplorerCapabilityDeclaration,
  type ExplorerCapabilityId,
} from './explorerScenarioContracts';

export const EXPLORER_CAPABILITY_MATRIX_SCHEMA_VERSION = 1 as const;

export const EXPLORER_SEASON_PHASES = [
  'in-season',
  'preseason',
  'offseason',
] as const;

export const EXPLORER_FIXTURE_STATES = [
  'absent',
  'scheduled-game',
  'scheduled-practice-match',
] as const;

export const EXPLORER_SOURCE_FACT_COMBINATIONS = [
  'none',
  'injury-readiness',
  'equipment',
  'feedback',
] as const;

export const EXPLORER_AVAILABILITY_STATES = [
  'clear',
  'injured',
  'low-readiness',
  'limited-equipment',
] as const;

export const EXPLORER_SESSION_TOPOLOGIES = [
  'empty',
  'single-session',
  'componentized-session',
  'multi-session',
] as const;

export const EXPLORER_REVERSIBLE_LEDGER_STATES = [
  'empty',
  'active',
  'restored',
] as const;

export const EXPLORER_RELOAD_POLICIES = [
  'required',
  'not-required',
] as const;

export const EXPLORER_EXPECTED_DISPOSITIONS = [
  'accepted',
  'rejected',
  'capability-disabled',
] as const;

export type ExplorerSeasonPhase = (typeof EXPLORER_SEASON_PHASES)[number];
export type ExplorerFixtureState = (typeof EXPLORER_FIXTURE_STATES)[number];
export type ExplorerSourceFactCombination =
  (typeof EXPLORER_SOURCE_FACT_COMBINATIONS)[number];
export type ExplorerAvailabilityState =
  (typeof EXPLORER_AVAILABILITY_STATES)[number];
export type ExplorerSessionTopology =
  (typeof EXPLORER_SESSION_TOPOLOGIES)[number];
export type ExplorerReversibleLedgerState =
  (typeof EXPLORER_REVERSIBLE_LEDGER_STATES)[number];
export type ExplorerReloadPolicy = (typeof EXPLORER_RELOAD_POLICIES)[number];
export type ExplorerExpectedDisposition =
  (typeof EXPLORER_EXPECTED_DISPOSITIONS)[number];

export interface ExplorerCapabilityRow {
  readonly seasonPhase: ExplorerSeasonPhase;
  readonly fixtureState: ExplorerFixtureState;
  readonly sourceFacts: ExplorerSourceFactCombination;
  readonly availabilityState: ExplorerAvailabilityState;
  readonly sessionTopology: ExplorerSessionTopology;
  readonly actionKind: ExplorerActionType;
  readonly reversibleLedgerState: ExplorerReversibleLedgerState;
  readonly reloadPolicy: ExplorerReloadPolicy;
  readonly expectedDisposition: ExplorerExpectedDisposition;
}

export type ExplorerCapabilityDimension = keyof ExplorerCapabilityRow;

export type ExplorerCapabilityDimensionValue =
  ExplorerCapabilityRow[ExplorerCapabilityDimension];

export interface ExplorerCapabilityDimensionDefinition<
  TDimension extends ExplorerCapabilityDimension = ExplorerCapabilityDimension,
> {
  readonly dimension: TDimension;
  readonly values: readonly ExplorerCapabilityRow[TDimension][];
}

export interface ExplorerActionCapabilityProfile {
  readonly actionKind: ExplorerActionType;
  readonly capabilityId: ExplorerCapabilityId | null;
  readonly status: 'enabled' | 'disabled';
  readonly declaration: ExplorerCapabilityDeclaration | null;
}

export interface ExplorerBinaryCapabilityConstraint {
  readonly constraintId: string;
  readonly leftDimension: ExplorerCapabilityDimension;
  readonly rightDimension: ExplorerCapabilityDimension;
  readonly allowedPairs: readonly (readonly [string, string])[];
}

export interface ExplorerCapabilityMatrix {
  readonly schemaVersion: typeof EXPLORER_CAPABILITY_MATRIX_SCHEMA_VERSION;
  readonly dimensions: readonly ExplorerCapabilityDimensionDefinition[];
  readonly actionCapabilities: readonly ExplorerActionCapabilityProfile[];
  readonly constraints: readonly ExplorerBinaryCapabilityConstraint[];
}

const actionPairs = (
  selections: Readonly<Partial<Record<ExplorerActionType, readonly string[]>>>,
  defaultValues: readonly string[],
): readonly (readonly [string, string])[] =>
  EXPLORER_ACTION_TYPES.flatMap((actionKind) =>
    (selections[actionKind] ?? defaultValues).map((value) => [actionKind, value] as const));

const WEEK_REPEAT_DECLARATION = EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS.find(
  (declaration) => declaration.capabilityId === 'week.repeat',
) ?? null;

const ACTION_CAPABILITIES: readonly ExplorerActionCapabilityProfile[] =
  EXPLORER_ACTION_TYPES.map((actionKind): ExplorerActionCapabilityProfile => {
    if (actionKind === 'week.repeat') {
      return {
        actionKind,
        capabilityId: 'week.repeat',
        status: 'enabled',
        declaration: WEEK_REPEAT_DECLARATION,
      };
    }
    if (actionKind === 'coach.message') {
      return {
        actionKind,
        capabilityId: 'coach.message',
        status: 'disabled',
        declaration: null,
      };
    }
    return {
      actionKind,
      capabilityId: null,
      status: 'enabled',
      declaration: null,
    };
  });

const CONSTRAINTS: readonly ExplorerBinaryCapabilityConstraint[] = [
  {
    constraintId: 'season-fixture-compatibility',
    leftDimension: 'seasonPhase',
    rightDimension: 'fixtureState',
    allowedPairs: [
      ['in-season', 'absent'],
      ['in-season', 'scheduled-game'],
      ['preseason', 'absent'],
      ['preseason', 'scheduled-practice-match'],
      ['offseason', 'absent'],
    ],
  },
  {
    constraintId: 'action-fixture-eligibility',
    leftDimension: 'actionKind',
    rightDimension: 'fixtureState',
    allowedPairs: actionPairs({
      'fixture.add': ['absent'],
      'fixture.move': ['scheduled-game', 'scheduled-practice-match'],
      'fixture.remove': ['scheduled-game', 'scheduled-practice-match'],
    }, EXPLORER_FIXTURE_STATES),
  },
  {
    constraintId: 'action-source-fact-eligibility',
    leftDimension: 'actionKind',
    rightDimension: 'sourceFacts',
    allowedPairs: actionPairs({
      'injury.set': ['none', 'equipment', 'feedback'],
      'injury.resolve': ['injury-readiness'],
      'readiness.set': ['none', 'equipment', 'feedback'],
      'readiness.clear': ['injury-readiness'],
      'equipment.set': ['none', 'injury-readiness', 'feedback'],
      'equipment.clear': ['equipment'],
    }, EXPLORER_SOURCE_FACT_COMBINATIONS),
  },
  {
    constraintId: 'action-availability-eligibility',
    leftDimension: 'actionKind',
    rightDimension: 'availabilityState',
    allowedPairs: actionPairs({
      'injury.set': ['clear', 'low-readiness', 'limited-equipment'],
      'injury.resolve': ['injured'],
      'readiness.set': ['clear', 'injured', 'limited-equipment'],
      'readiness.clear': ['low-readiness'],
      'equipment.set': ['clear', 'injured', 'low-readiness'],
      'equipment.clear': ['limited-equipment'],
    }, EXPLORER_AVAILABILITY_STATES),
  },
  {
    constraintId: 'action-session-topology-eligibility',
    leftDimension: 'actionKind',
    rightDimension: 'sessionTopology',
    allowedPairs: actionPairs({
      'session.move': ['single-session', 'componentized-session', 'multi-session'],
      'session.delete': ['single-session', 'componentized-session', 'multi-session'],
      'component.delete': ['componentized-session'],
      'session-feedback.record': [
        'single-session',
        'componentized-session',
        'multi-session',
      ],
    }, EXPLORER_SESSION_TOPOLOGIES),
  },
  {
    constraintId: 'action-ledger-eligibility',
    leftDimension: 'actionKind',
    rightDimension: 'reversibleLedgerState',
    allowedPairs: actionPairs({
      'adjustment.restore': ['active'],
    }, EXPLORER_REVERSIBLE_LEDGER_STATES),
  },
  {
    constraintId: 'action-capability-disposition',
    leftDimension: 'actionKind',
    rightDimension: 'expectedDisposition',
    allowedPairs: actionPairs({
      'coach.message': ['capability-disabled'],
    }, ['accepted', 'rejected']),
  },
  {
    constraintId: 'disposition-reload-policy',
    leftDimension: 'expectedDisposition',
    rightDimension: 'reloadPolicy',
    allowedPairs: [
      ['accepted', 'required'],
      ['accepted', 'not-required'],
      ['rejected', 'not-required'],
      ['capability-disabled', 'not-required'],
    ],
  },
];

const CAPABILITY_DIMENSIONS = [
  { dimension: 'seasonPhase', values: EXPLORER_SEASON_PHASES },
  { dimension: 'fixtureState', values: EXPLORER_FIXTURE_STATES },
  { dimension: 'sourceFacts', values: EXPLORER_SOURCE_FACT_COMBINATIONS },
  { dimension: 'availabilityState', values: EXPLORER_AVAILABILITY_STATES },
  { dimension: 'sessionTopology', values: EXPLORER_SESSION_TOPOLOGIES },
  { dimension: 'actionKind', values: EXPLORER_ACTION_TYPES },
  { dimension: 'reversibleLedgerState', values: EXPLORER_REVERSIBLE_LEDGER_STATES },
  { dimension: 'reloadPolicy', values: EXPLORER_RELOAD_POLICIES },
  { dimension: 'expectedDisposition', values: EXPLORER_EXPECTED_DISPOSITIONS },
] as const satisfies readonly ExplorerCapabilityDimensionDefinition[];

export const EXPLORER_CAPABILITY_MATRIX: ExplorerCapabilityMatrix = Object.freeze({
  schemaVersion: EXPLORER_CAPABILITY_MATRIX_SCHEMA_VERSION,
  dimensions: Object.freeze(CAPABILITY_DIMENSIONS),
  actionCapabilities: Object.freeze(ACTION_CAPABILITIES),
  constraints: Object.freeze(CONSTRAINTS),
});

export const EXPLORER_CAPABILITY_MATRIX_SEMANTIC_HASH: SemanticFingerprintV2 =
  semanticFingerprintV2({
    contract: 'explorer-capability-matrix-v1',
    matrix: EXPLORER_CAPABILITY_MATRIX,
  });

export const EXPLORER_ENABLED_CAPABILITY_DECLARATIONS:
readonly ExplorerCapabilityDeclaration[] = Object.freeze(
  EXPLORER_CAPABILITY_MATRIX.actionCapabilities
    .filter((profile) => profile.status === 'enabled' && profile.declaration !== null)
    .map((profile) => profile.declaration as ExplorerCapabilityDeclaration),
);

export function explorerActionCapabilityProfile(
  actionKind: ExplorerActionType,
): ExplorerActionCapabilityProfile {
  const profile = EXPLORER_CAPABILITY_MATRIX.actionCapabilities.find(
    (candidate) => candidate.actionKind === actionKind,
  );
  if (!profile) throw new Error(`Explorer capability matrix is missing ${actionKind}.`);
  return profile;
}

function constraintAllows(
  constraint: ExplorerBinaryCapabilityConstraint,
  row: Partial<ExplorerCapabilityRow>,
): boolean {
  const left = row[constraint.leftDimension];
  const right = row[constraint.rightDimension];
  if (left === undefined || right === undefined) return true;
  return constraint.allowedPairs.some(
    ([allowedLeft, allowedRight]) => left === allowedLeft && right === allowedRight,
  );
}

export function explorerCapabilityRowExclusionReasons(
  row: Partial<ExplorerCapabilityRow>,
): readonly string[] {
  return EXPLORER_CAPABILITY_MATRIX.constraints
    .filter((constraint) => !constraintAllows(constraint, row))
    .map((constraint) => constraint.constraintId)
    .sort((left, right) => left.localeCompare(right));
}

export function isExplorerCapabilityRowFeasible(
  row: ExplorerCapabilityRow,
): boolean {
  return explorerCapabilityRowExclusionReasons(row).length === 0;
}

export function explorerCapabilityRowSignature(row: ExplorerCapabilityRow): string {
  return EXPLORER_CAPABILITY_MATRIX.dimensions
    .map(({ dimension }) => `${dimension}=${row[dimension]}`)
    .join('|');
}

export function explorerCapabilityPairId(
  leftDimension: ExplorerCapabilityDimension,
  leftValue: string,
  rightDimension: ExplorerCapabilityDimension,
  rightValue: string,
): string {
  const dimensions = EXPLORER_CAPABILITY_MATRIX.dimensions.map(({ dimension }) => dimension);
  if (dimensions.indexOf(leftDimension) > dimensions.indexOf(rightDimension)) {
    return explorerCapabilityPairId(
      rightDimension,
      rightValue,
      leftDimension,
      leftValue,
    );
  }
  return `${leftDimension}=${leftValue}|${rightDimension}=${rightValue}`;
}

export function explorerCapabilityPairsForRow(
  row: ExplorerCapabilityRow,
): readonly string[] {
  const pairs: string[] = [];
  const dimensions = EXPLORER_CAPABILITY_MATRIX.dimensions;
  for (let left = 0; left < dimensions.length; left += 1) {
    for (let right = left + 1; right < dimensions.length; right += 1) {
      const leftDimension = dimensions[left].dimension;
      const rightDimension = dimensions[right].dimension;
      pairs.push(explorerCapabilityPairId(
        leftDimension,
        row[leftDimension],
        rightDimension,
        row[rightDimension],
      ));
    }
  }
  return pairs;
}
