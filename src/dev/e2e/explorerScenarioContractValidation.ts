import { sha256Hex } from '../../utils/semanticFingerprintV2';
import {
  EXPLORER_ACTION_TYPES,
  EXPLORER_CAPABILITY_IDS,
  EXPLORER_ELIGIBILITY_PREDICATE_TYPES,
  EXPLORER_INGRESS_SURFACES,
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  EXPLORER_SCENARIO_TIERS,
  explorerActionCapability,
  explorerActionRequiresRenderedProof,
  type ExplorerAction,
  type ExplorerActionType,
  type ExplorerCapabilityId,
  type ExplorerContractValidationOptions,
  type ExplorerEligibilityPredicate,
  type ExplorerExpectedOutcome,
  type ExplorerJsonValue,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  EXPLORER_ORACLE_TYPES,
  EXPLORER_REQUIRED_INVARIANT_IDS,
  explorerOracleRequiresAcceptedCheckpoint,
  type ExplorerOracleAssertion,
} from './explorerOracleContracts';

export const EXPLORER_SCENARIO_HASH_CONTRACT =
  'explorer-scenario-contract-sha256-v1' as const;

export const EXPLORER_ACTION_HASH_CONTRACT =
  'explorer-action-contract-sha256-v1' as const;

export type ExplorerScenarioSemanticHash =
  `${typeof EXPLORER_SCENARIO_HASH_CONTRACT}:${string}`;

export type ExplorerActionSemanticHash =
  `${typeof EXPLORER_ACTION_HASH_CONTRACT}:${string}`;

export type ExplorerScenarioValidationIssueCode =
  | 'unknown-field'
  | 'missing-field'
  | 'invalid-value'
  | 'unknown-variant'
  | 'duplicate-id'
  | 'invalid-combination'
  | 'capability-not-declared'
  | 'unstable-normalization';

export interface ExplorerScenarioValidationIssue {
  readonly code: ExplorerScenarioValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class ExplorerScenarioContractValidationError extends Error {
  readonly issues: readonly ExplorerScenarioValidationIssue[];

  constructor(issues: readonly ExplorerScenarioValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'ExplorerScenarioContractValidationError';
    this.issues = issues;
  }
}

type UnknownRecord = Record<string, unknown>;

const PROTOCOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANONICAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TEST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_FACT_TYPES = [
  'fixture',
  'injury',
  'readiness',
  'equipment',
  'session-feedback',
] as const;
const ORACLE_SUBJECTS = [
  'accepted-state',
  'persisted-state',
  'visible-card',
  'visible-detail',
  'source-facts',
] as const;

function issue(
  issues: ExplorerScenarioValidationIssue[],
  code: ExplorerScenarioValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordAt(
  value: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): UnknownRecord | null {
  if (!isRecord(value)) {
    issue(issues, 'invalid-value', path, 'must be an object');
    return null;
  }
  return value;
}

function exactKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): void {
  const allowedSet = new Set(allowed);
  Object.keys(value).forEach((key) => {
    if (!allowedSet.has(key)) {
      issue(issues, 'unknown-field', `${path}.${key}`, 'is not part of this contract');
    }
  });
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function stringAt(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  kind: 'non-empty' | 'protocol-id' | 'canonical-id' | 'test-id' = 'non-empty',
): string | null {
  const fieldPath = `${path}.${key}`;
  if (!hasOwn(value, key)) {
    issue(issues, 'missing-field', fieldPath, 'is required');
    return null;
  }
  const field = value[key];
  if (typeof field !== 'string' || field.trim().length === 0) {
    issue(issues, 'invalid-value', fieldPath, 'must be a non-empty string');
    return null;
  }
  const pattern = kind === 'protocol-id'
    ? PROTOCOL_ID_PATTERN
    : kind === 'canonical-id'
      ? CANONICAL_ID_PATTERN
      : kind === 'test-id'
        ? TEST_ID_PATTERN
        : null;
  if (pattern && !pattern.test(field)) {
    issue(issues, 'invalid-value', fieldPath, `must be a valid ${kind}`);
    return null;
  }
  return field;
}

function enumAt<T extends string>(
  value: UnknownRecord,
  key: string,
  allowed: readonly T[],
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): T | null {
  const fieldPath = `${path}.${key}`;
  if (!hasOwn(value, key)) {
    issue(issues, 'missing-field', fieldPath, 'is required');
    return null;
  }
  const field = value[key];
  if (typeof field !== 'string' || !allowed.includes(field as T)) {
    issue(
      issues,
      'invalid-value',
      fieldPath,
      `must be one of: ${allowed.join(', ')}`,
    );
    return null;
  }
  return field as T;
}

function numberAt(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  options: { integer?: boolean; minimum?: number; maximum?: number } = {},
): number | null {
  const fieldPath = `${path}.${key}`;
  if (!hasOwn(value, key)) {
    issue(issues, 'missing-field', fieldPath, 'is required');
    return null;
  }
  const field = value[key];
  if (
    typeof field !== 'number' ||
    !Number.isFinite(field) ||
    (options.integer === true && !Number.isInteger(field)) ||
    (options.minimum !== undefined && field < options.minimum) ||
    (options.maximum !== undefined && field > options.maximum)
  ) {
    issue(issues, 'invalid-value', fieldPath, 'has an invalid numeric value');
    return null;
  }
  return field;
}

export function isExplorerISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function dateAt(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  nullable = false,
): string | null {
  const fieldPath = `${path}.${key}`;
  if (!hasOwn(value, key)) {
    issue(issues, 'missing-field', fieldPath, 'is required');
    return null;
  }
  if (nullable && value[key] === null) return null;
  if (!isExplorerISODate(value[key])) {
    issue(issues, 'invalid-value', fieldPath, 'must be a real ISO calendar date (YYYY-MM-DD)');
    return null;
  }
  return value[key] as string;
}

function stringArrayAt(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  options: {
    optional?: boolean;
    nonEmpty?: boolean;
    kind?: 'protocol-id' | 'canonical-id' | 'test-id';
  } = {},
): readonly string[] | null {
  const fieldPath = `${path}.${key}`;
  if (!hasOwn(value, key)) {
    if (!options.optional) issue(issues, 'missing-field', fieldPath, 'is required');
    return null;
  }
  const field = value[key];
  if (!Array.isArray(field) || (options.nonEmpty === true && field.length === 0)) {
    issue(issues, 'invalid-value', fieldPath, 'must be an array with the required cardinality');
    return null;
  }
  const pattern = options.kind === 'protocol-id'
    ? PROTOCOL_ID_PATTERN
    : options.kind === 'canonical-id'
      ? CANONICAL_ID_PATTERN
      : options.kind === 'test-id'
        ? TEST_ID_PATTERN
        : null;
  field.forEach((entry, index) => {
    if (
      typeof entry !== 'string' ||
      entry.trim().length === 0 ||
      (pattern !== null && !pattern.test(entry))
    ) {
      issue(issues, 'invalid-value', `${fieldPath}[${index}]`, 'is malformed');
    }
  });
  if (new Set(field).size !== field.length) {
    issue(issues, 'duplicate-id', fieldPath, 'must not contain duplicates');
  }
  return field as string[];
}

function selectorAt(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): string | null {
  const selector = stringAt(value, key, path, issues);
  if (selector === null) return null;
  const segments = selector.startsWith('/') ? selector.slice(1).split('/') : [];
  if (
    !selector.startsWith('/') ||
    segments.length === 0 ||
    segments.some((segment) => segment.length === 0 || /~(?:[^01]|$)/.test(segment))
  ) {
    issue(
      issues,
      'invalid-value',
      `${path}.${key}`,
      'must be a non-empty JSON-pointer selector with valid escaping',
    );
    return null;
  }
  return selector;
}

function validateTarget(
  value: unknown,
  expectedKind: string,
  identityFields: readonly string[],
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): void {
  const target = recordAt(value, path, issues);
  if (!target) return;
  exactKeys(target, ['kind', ...identityFields], path, issues);
  const kind = stringAt(target, 'kind', path, issues);
  if (kind !== null && kind !== expectedKind) {
    issue(issues, 'invalid-value', `${path}.kind`, `must be ${expectedKind}`);
  }
  identityFields.forEach((field) =>
    stringAt(target, field, path, issues, 'canonical-id'));
}

function actionArgs(
  value: unknown,
  keys: readonly string[],
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): UnknownRecord | null {
  const args = recordAt(value, path, issues);
  if (args) exactKeys(args, keys, path, issues);
  return args;
}

function validateCapabilityGate(
  value: unknown,
  capabilityId: ExplorerCapabilityId,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  options: ExplorerContractValidationOptions,
): void {
  const gate = recordAt(value, path, issues);
  if (!gate) return;
  exactKeys(gate, ['capabilityId', 'status'], path, issues);
  const actualId = enumAt(gate, 'capabilityId', EXPLORER_CAPABILITY_IDS, path, issues);
  if (actualId !== null && actualId !== capabilityId) {
    issue(issues, 'invalid-value', `${path}.capabilityId`, `must be ${capabilityId}`);
  }
  const status = enumAt(gate, 'status', ['disabled', 'enabled'] as const, path, issues);
  if (status !== 'enabled') return;
  const declaration = options.declaredCapabilities?.find(
    (candidate) => candidate.capabilityId === capabilityId,
  );
  if (
    !declaration ||
    declaration.owner.trim().length === 0 ||
    declaration.contractVersion.trim().length === 0
  ) {
    issue(
      issues,
      'capability-not-declared',
      path,
      `${capabilityId} cannot be enabled without a production owner declaration`,
    );
  }
}

function collectAction(
  input: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  options: ExplorerContractValidationOptions,
): ExplorerAction | null {
  const action = recordAt(input, path, issues);
  if (!action) return null;
  const type = hasOwn(action, 'type') ? action.type : undefined;
  if (typeof type !== 'string') {
    issue(issues, 'missing-field', `${path}.type`, 'is required');
    return null;
  }
  switch (type) {
    case 'fixture.add': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(action.target, 'fixture', ['fixtureId'], `${path}.target`, issues);
      const args = actionArgs(
        action.args,
        ['date', 'fixtureKind', 'opponentId'],
        `${path}.args`,
        issues,
      );
      if (args) {
        dateAt(args, 'date', `${path}.args`, issues);
        enumAt(args, 'fixtureKind', ['game', 'practice-match'] as const, `${path}.args`, issues);
        stringAt(args, 'opponentId', `${path}.args`, issues, 'canonical-id');
      }
      break;
    }
    case 'fixture.move':
    case 'session.move': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        type === 'fixture.move' ? 'fixture' : 'session',
        [type === 'fixture.move' ? 'fixtureId' : 'sessionId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(action.args, ['fromDate', 'toDate'], `${path}.args`, issues);
      if (args) {
        const fromDate = dateAt(args, 'fromDate', `${path}.args`, issues);
        const toDate = dateAt(args, 'toDate', `${path}.args`, issues);
        if (fromDate !== null && fromDate === toDate) {
          issue(issues, 'invalid-value', `${path}.args.toDate`, 'must differ from fromDate');
        }
      }
      break;
    }
    case 'fixture.remove':
    case 'session.delete':
    case 'component.delete': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      if (type === 'fixture.remove') {
        validateTarget(action.target, 'fixture', ['fixtureId'], `${path}.target`, issues);
      } else if (type === 'session.delete') {
        validateTarget(action.target, 'session', ['sessionId'], `${path}.target`, issues);
      } else {
        validateTarget(
          action.target,
          'component',
          ['sessionId', 'componentId'],
          `${path}.target`,
          issues,
        );
      }
      const args = actionArgs(action.args, ['date'], `${path}.args`, issues);
      if (args) dateAt(args, 'date', `${path}.args`, issues);
      break;
    }
    case 'injury.set': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        'injury-episode',
        ['injuryEpisodeId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(
        action.args,
        ['effectiveDate', 'bodyRegionId', 'severity', 'laterality'],
        `${path}.args`,
        issues,
      );
      if (args) {
        dateAt(args, 'effectiveDate', `${path}.args`, issues);
        stringAt(args, 'bodyRegionId', `${path}.args`, issues, 'canonical-id');
        enumAt(args, 'severity', ['minor', 'moderate', 'severe'] as const, `${path}.args`, issues);
        enumAt(
          args,
          'laterality',
          ['left', 'right', 'bilateral', 'not-applicable'] as const,
          `${path}.args`,
          issues,
        );
      }
      break;
    }
    case 'injury.resolve': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        'injury-episode',
        ['injuryEpisodeId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(action.args, ['resolvedDate'], `${path}.args`, issues);
      if (args) dateAt(args, 'resolvedDate', `${path}.args`, issues);
      break;
    }
    case 'readiness.set': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(action.target, 'readiness', ['readinessId'], `${path}.target`, issues);
      const args = actionArgs(
        action.args,
        ['date', 'fatigue', 'soreness', 'sleepQuality'],
        `${path}.args`,
        issues,
      );
      if (args) {
        dateAt(args, 'date', `${path}.args`, issues);
        numberAt(args, 'fatigue', `${path}.args`, issues, { integer: true, minimum: 1, maximum: 5 });
        numberAt(args, 'soreness', `${path}.args`, issues, { integer: true, minimum: 1, maximum: 5 });
        numberAt(args, 'sleepQuality', `${path}.args`, issues, { integer: true, minimum: 1, maximum: 5 });
      }
      break;
    }
    case 'readiness.clear': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(action.target, 'readiness', ['readinessId'], `${path}.target`, issues);
      const args = actionArgs(action.args, ['date'], `${path}.args`, issues);
      if (args) dateAt(args, 'date', `${path}.args`, issues);
      break;
    }
    case 'equipment.set': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        'equipment-fact',
        ['equipmentFactId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(
        action.args,
        ['fromDate', 'toDate', 'availableEquipmentIds', 'unavailableEquipmentIds'],
        `${path}.args`,
        issues,
      );
      if (args) {
        const fromDate = dateAt(args, 'fromDate', `${path}.args`, issues);
        const toDate = dateAt(args, 'toDate', `${path}.args`, issues, true);
        const available = stringArrayAt(
          args,
          'availableEquipmentIds',
          `${path}.args`,
          issues,
          { kind: 'canonical-id' },
        );
        const unavailable = stringArrayAt(
          args,
          'unavailableEquipmentIds',
          `${path}.args`,
          issues,
          { kind: 'canonical-id' },
        );
        if (
          fromDate !== null &&
          toDate !== null &&
          toDate < fromDate
        ) {
          issue(issues, 'invalid-value', `${path}.args.toDate`, 'must not precede fromDate');
        }
        if (available && unavailable) {
          if (available.length + unavailable.length === 0) {
            issue(
              issues,
              'invalid-value',
              `${path}.args`,
              'must declare at least one available or unavailable equipment identity',
            );
          }
          const unavailableSet = new Set(unavailable);
          available.forEach((equipmentId) => {
            if (unavailableSet.has(equipmentId)) {
              issue(
                issues,
                'invalid-value',
                `${path}.args`,
                `${equipmentId} cannot be both available and unavailable`,
              );
            }
          });
        }
      }
      break;
    }
    case 'equipment.clear': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        'equipment-fact',
        ['equipmentFactId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(action.args, ['clearedOn'], `${path}.args`, issues);
      if (args) dateAt(args, 'clearedOn', `${path}.args`, issues);
      break;
    }
    case 'session-feedback.record': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        'session-feedback',
        ['sessionId', 'feedbackId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(
        action.args,
        ['date', 'completion', 'feeling', 'soreness', 'difficulty'],
        `${path}.args`,
        issues,
      );
      if (args) {
        dateAt(args, 'date', `${path}.args`, issues);
        enumAt(
          args,
          'completion',
          ['full', 'partial', 'not-completed'] as const,
          `${path}.args`,
          issues,
        );
        enumAt(
          args,
          'feeling',
          ['very-easy', 'manageable', 'hard', 'too-hard'] as const,
          `${path}.args`,
          issues,
        );
        enumAt(
          args,
          'soreness',
          ['none', 'mild', 'moderate', 'severe'] as const,
          `${path}.args`,
          issues,
        );
        numberAt(args, 'difficulty', `${path}.args`, issues, {
          integer: true,
          minimum: 1,
          maximum: 10,
        });
      }
      break;
    }
    case 'adjustment.restore': {
      exactKeys(action, ['type', 'target', 'args'], path, issues);
      validateTarget(
        action.target,
        'adjustment',
        ['adjustmentId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(action.args, ['restoredOn'], `${path}.args`, issues);
      if (args) dateAt(args, 'restoredOn', `${path}.args`, issues);
      break;
    }
    case 'week.repeat': {
      exactKeys(action, ['type', 'target', 'args', 'capability'], path, issues);
      validateTarget(action.target, 'week', ['weekId'], `${path}.target`, issues);
      const args = actionArgs(
        action.args,
        ['sourceWeekStart', 'targetWeekStart'],
        `${path}.args`,
        issues,
      );
      if (args) {
        const source = dateAt(args, 'sourceWeekStart', `${path}.args`, issues);
        const target = dateAt(args, 'targetWeekStart', `${path}.args`, issues);
        if (source !== null && source === target) {
          issue(
            issues,
            'invalid-value',
            `${path}.args.targetWeekStart`,
            'must differ from sourceWeekStart',
          );
        }
      }
      validateCapabilityGate(
        action.capability,
        'week.repeat',
        `${path}.capability`,
        issues,
        options,
      );
      break;
    }
    case 'coach.message': {
      exactKeys(action, ['type', 'target', 'args', 'capability'], path, issues);
      validateTarget(
        action.target,
        'coach-message',
        ['conversationId', 'messageId'],
        `${path}.target`,
        issues,
      );
      const args = actionArgs(action.args, ['message', 'visibleWeekId'], `${path}.args`, issues);
      if (args) {
        stringAt(args, 'message', `${path}.args`, issues);
        stringAt(args, 'visibleWeekId', `${path}.args`, issues, 'canonical-id');
      }
      validateCapabilityGate(
        action.capability,
        'coach.message',
        `${path}.capability`,
        issues,
        options,
      );
      break;
    }
    default:
      exactKeys(action, ['type', 'target', 'args', 'capability'], path, issues);
      issue(
        issues,
        'unknown-variant',
        `${path}.type`,
        `unknown ExplorerAction variant: ${type}`,
      );
      return null;
  }
  return action as ExplorerAction;
}

export function validateExplorerAction(
  input: unknown,
  options: ExplorerContractValidationOptions = {},
): ExplorerAction {
  const issues: ExplorerScenarioValidationIssue[] = [];
  const action = collectAction(input, '$', issues, options);
  if (issues.length > 0 || action === null) {
    throw new ExplorerScenarioContractValidationError(issues);
  }
  return action;
}

function collectEligibilityPredicate(
  input: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): ExplorerEligibilityPredicate | null {
  const predicate = recordAt(input, path, issues);
  if (!predicate) return null;
  stringAt(predicate, 'predicateId', path, issues, 'protocol-id');
  const type = hasOwn(predicate, 'type') ? predicate.type : undefined;
  if (typeof type !== 'string') {
    issue(issues, 'missing-field', `${path}.type`, 'is required');
    return null;
  }
  switch (type) {
    case 'accepted-week-count':
      exactKeys(predicate, ['predicateId', 'type', 'operator', 'count'], path, issues);
      enumAt(predicate, 'operator', ['equals', 'at-least', 'at-most'] as const, path, issues);
      numberAt(predicate, 'count', path, issues, { integer: true, minimum: 0 });
      break;
    case 'phase-signature':
      exactKeys(predicate, ['predicateId', 'type', 'signature'], path, issues);
      stringAt(predicate, 'signature', path, issues, 'canonical-id');
      break;
    case 'fixture-exists':
    case 'fixture-absent':
      exactKeys(predicate, ['predicateId', 'type', 'fixtureId', 'date'], path, issues);
      stringAt(predicate, 'fixtureId', path, issues, 'canonical-id');
      dateAt(predicate, 'date', path, issues);
      break;
    case 'session-exists':
      exactKeys(predicate, ['predicateId', 'type', 'sessionId', 'date'], path, issues);
      stringAt(predicate, 'sessionId', path, issues, 'canonical-id');
      dateAt(predicate, 'date', path, issues);
      break;
    case 'component-exists':
      exactKeys(
        predicate,
        ['predicateId', 'type', 'sessionId', 'componentId', 'date'],
        path,
        issues,
      );
      stringAt(predicate, 'sessionId', path, issues, 'canonical-id');
      stringAt(predicate, 'componentId', path, issues, 'canonical-id');
      dateAt(predicate, 'date', path, issues);
      break;
    case 'eligible-target-date':
      exactKeys(predicate, ['predicateId', 'type', 'date', 'forActionType'], path, issues);
      dateAt(predicate, 'date', path, issues);
      enumAt(predicate, 'forActionType', EXPLORER_ACTION_TYPES, path, issues);
      break;
    case 'source-fact-exists':
    case 'source-fact-absent':
      exactKeys(
        predicate,
        ['predicateId', 'type', 'sourceFactId', 'sourceFactType'],
        path,
        issues,
      );
      stringAt(predicate, 'sourceFactId', path, issues, 'canonical-id');
      enumAt(predicate, 'sourceFactType', SOURCE_FACT_TYPES, path, issues);
      break;
    case 'reversible-adjustment-status':
      exactKeys(predicate, ['predicateId', 'type', 'adjustmentId', 'status'], path, issues);
      stringAt(predicate, 'adjustmentId', path, issues, 'canonical-id');
      enumAt(predicate, 'status', ['active', 'restored'] as const, path, issues);
      break;
    case 'accepted-revision':
      exactKeys(predicate, ['predicateId', 'type', 'revision'], path, issues);
      numberAt(predicate, 'revision', path, issues, { integer: true, minimum: 0 });
      break;
    case 'card-detail-equality':
      exactKeys(predicate, ['predicateId', 'type', 'sessionId', 'date'], path, issues);
      stringAt(predicate, 'sessionId', path, issues, 'canonical-id');
      dateAt(predicate, 'date', path, issues);
      break;
    case 'coach-interpretation-receipt-available':
      exactKeys(
        predicate,
        ['predicateId', 'type', 'conversationId', 'messageId'],
        path,
        issues,
      );
      stringAt(predicate, 'conversationId', path, issues, 'canonical-id');
      stringAt(predicate, 'messageId', path, issues, 'canonical-id');
      break;
    default:
      exactKeys(predicate, ['predicateId', 'type'], path, issues);
      issue(
        issues,
        'unknown-variant',
        `${path}.type`,
        `unknown eligibility predicate variant: ${type}`,
      );
      return null;
  }
  return predicate as ExplorerEligibilityPredicate;
}

export function validateExplorerEligibilityPredicate(
  input: unknown,
): ExplorerEligibilityPredicate {
  const issues: ExplorerScenarioValidationIssue[] = [];
  const predicate = collectEligibilityPredicate(input, '$', issues);
  if (issues.length > 0 || predicate === null) {
    throw new ExplorerScenarioContractValidationError(issues);
  }
  return predicate;
}

function isStableJsonValue(
  value: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  seen: WeakSet<object>,
): value is ExplorerJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return true;
    issue(issues, 'unstable-normalization', path, 'non-finite numbers are not stable JSON');
    return false;
  }
  if (typeof value !== 'object' || value === undefined) {
    issue(issues, 'unstable-normalization', path, 'must contain stable JSON values only');
    return false;
  }
  if (seen.has(value)) {
    issue(issues, 'unstable-normalization', path, 'circular values are not supported');
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      isStableJsonValue(entry, `${path}[${index}]`, issues, seen));
    seen.delete(value);
    return true;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    issue(
      issues,
      'unstable-normalization',
      path,
      'Date, binary, Map, Set, and class instances are not stable contract inputs',
    );
    seen.delete(value);
    return false;
  }
  Object.entries(value as UnknownRecord).forEach(([key, child]) =>
    isStableJsonValue(child, `${path}.${key}`, issues, seen));
  seen.delete(value);
  return true;
}

function collectOracleAssertion(
  input: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): ExplorerOracleAssertion | null {
  const oracle = recordAt(input, path, issues);
  if (!oracle) return null;
  stringAt(oracle, 'oracleId', path, issues, 'protocol-id');
  const type = hasOwn(oracle, 'type') ? oracle.type : undefined;
  if (typeof type !== 'string') {
    issue(issues, 'missing-field', `${path}.type`, 'is required');
    return null;
  }
  switch (type) {
    case 'accepted-state-projection':
      exactKeys(oracle, ['oracleId', 'type', 'selector', 'expectedValue'], path, issues);
      selectorAt(oracle, 'selector', path, issues);
      if (!hasOwn(oracle, 'expectedValue')) {
        issue(issues, 'missing-field', `${path}.expectedValue`, 'is required');
      } else {
        isStableJsonValue(
          oracle.expectedValue,
          `${path}.expectedValue`,
          issues,
          new WeakSet<object>(),
        );
      }
      break;
    case 'absence':
      exactKeys(oracle, ['oracleId', 'type', 'subject', 'selector'], path, issues);
      enumAt(oracle, 'subject', ORACLE_SUBJECTS, path, issues);
      selectorAt(oracle, 'selector', path, issues);
      break;
    case 'semantic-fingerprint':
      exactKeys(oracle, ['oracleId', 'type', 'subject', 'relation'], path, issues);
      enumAt(oracle, 'subject', ORACLE_SUBJECTS, path, issues);
      enumAt(
        oracle,
        'relation',
        ['changed-from-before', 'unchanged-from-before', 'equals-accepted'] as const,
        path,
        issues,
      );
      break;
    case 'rendered-witness':
      exactKeys(oracle, ['oracleId', 'type', 'testId', 'selector', 'relation'], path, issues);
      stringAt(oracle, 'testId', path, issues, 'test-id');
      selectorAt(oracle, 'selector', path, issues);
      enumAt(oracle, 'relation', ['present', 'absent', 'equals-accepted'] as const, path, issues);
      break;
    case 'trace-v2-production-receipt':
      exactKeys(
        oracle,
        ['oracleId', 'type', 'schemaVersion', 'terminalStatus'],
        path,
        issues,
      );
      numberAt(oracle, 'schemaVersion', path, issues, { integer: true, minimum: 2, maximum: 2 });
      enumAt(
        oracle,
        'terminalStatus',
        ['finalized_success', 'finalized_failure'] as const,
        path,
        issues,
      );
      break;
    case 'prior-trace-linkage':
      exactKeys(oracle, ['oracleId', 'type', 'priorStepId'], path, issues);
      stringAt(oracle, 'priorStepId', path, issues, 'protocol-id');
      break;
    case 'persisted-accepted-equality':
      exactKeys(oracle, ['oracleId', 'type', 'selector'], path, issues);
      selectorAt(oracle, 'selector', path, issues);
      break;
    case 'interpretation-receipt':
      exactKeys(
        oracle,
        ['oracleId', 'type', 'conversationId', 'messageId', 'expectedActionType'],
        path,
        issues,
      );
      stringAt(oracle, 'conversationId', path, issues, 'canonical-id');
      stringAt(oracle, 'messageId', path, issues, 'canonical-id');
      enumAt(oracle, 'expectedActionType', EXPLORER_ACTION_TYPES, path, issues);
      break;
    case 'metamorphic-equality':
      exactKeys(
        oracle,
        ['oracleId', 'type', 'leftStepId', 'rightStepId', 'selector'],
        path,
        issues,
      );
      stringAt(oracle, 'leftStepId', path, issues, 'protocol-id');
      stringAt(oracle, 'rightStepId', path, issues, 'protocol-id');
      selectorAt(oracle, 'selector', path, issues);
      break;
    case 'restoration-equality':
      exactKeys(oracle, ['oracleId', 'type', 'baselineStepId', 'selector'], path, issues);
      stringAt(oracle, 'baselineStepId', path, issues, 'protocol-id');
      selectorAt(oracle, 'selector', path, issues);
      break;
    case 'unrelated-state-unchanged': {
      exactKeys(oracle, ['oracleId', 'type', 'selectors'], path, issues);
      const selectors = stringArrayAt(oracle, 'selectors', path, issues, { nonEmpty: true });
      selectors?.forEach((selector, index) => {
        const wrapper = { selector };
        selectorAt(wrapper, 'selector', `${path}.selectors[${index}]`, issues);
      });
      break;
    }
    default:
      exactKeys(oracle, ['oracleId', 'type'], path, issues);
      issue(
        issues,
        'unknown-variant',
        `${path}.type`,
        `unknown oracle variant: ${type}`,
      );
      return null;
  }
  return oracle as ExplorerOracleAssertion;
}

export function validateExplorerOracleAssertion(input: unknown): ExplorerOracleAssertion {
  const issues: ExplorerScenarioValidationIssue[] = [];
  const oracle = collectOracleAssertion(input, '$', issues);
  if (issues.length > 0 || oracle === null) {
    throw new ExplorerScenarioContractValidationError(issues);
  }
  return oracle;
}

function collectCheckpointPolicy(
  input: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): ExplorerScenarioStep['checkpointPolicy'] | null {
  const checkpoint = recordAt(input, path, issues);
  if (!checkpoint) return null;
  const kind = hasOwn(checkpoint, 'kind') ? checkpoint.kind : undefined;
  if (typeof kind !== 'string') {
    issue(issues, 'missing-field', `${path}.kind`, 'is required');
    return null;
  }
  switch (kind) {
    case 'durable':
      exactKeys(checkpoint, ['kind', 'reload', 'renderedProof'], path, issues);
      enumAt(checkpoint, 'reload', ['required', 'not-required'] as const, path, issues);
      enumAt(checkpoint, 'renderedProof', ['required', 'not-required'] as const, path, issues);
      break;
    case 'rejected':
      exactKeys(checkpoint, ['kind', 'renderedProof'], path, issues);
      enumAt(checkpoint, 'renderedProof', ['required', 'not-required'] as const, path, issues);
      break;
    case 'none':
      exactKeys(checkpoint, ['kind', 'reason'], path, issues);
      enumAt(checkpoint, 'reason', ['capability-disabled'] as const, path, issues);
      break;
    default:
      exactKeys(checkpoint, ['kind'], path, issues);
      issue(issues, 'unknown-variant', `${path}.kind`, `unknown checkpoint policy: ${kind}`);
      return null;
  }
  return checkpoint as ExplorerScenarioStep['checkpointPolicy'];
}

function collectExpectedOutcome(
  input: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): ExplorerExpectedOutcome | null {
  const outcome = recordAt(input, path, issues);
  if (!outcome) return null;
  const kind = hasOwn(outcome, 'kind') ? outcome.kind : undefined;
  if (typeof kind !== 'string') {
    issue(issues, 'missing-field', `${path}.kind`, 'is required');
    return null;
  }
  switch (kind) {
    case 'accepted':
      exactKeys(outcome, ['kind', 'stateChange', 'acceptedRevisionDelta'], path, issues);
      enumAt(outcome, 'stateChange', ['required'] as const, path, issues);
      numberAt(outcome, 'acceptedRevisionDelta', path, issues, {
        integer: true,
        minimum: 1,
      });
      break;
    case 'rejected':
      exactKeys(outcome, ['kind', 'stateChange', 'reasonCode'], path, issues);
      enumAt(outcome, 'stateChange', ['forbidden'] as const, path, issues);
      stringAt(outcome, 'reasonCode', path, issues, 'canonical-id');
      break;
    case 'capability-disabled':
      exactKeys(outcome, ['kind', 'stateChange', 'capabilityId'], path, issues);
      enumAt(outcome, 'stateChange', ['forbidden'] as const, path, issues);
      enumAt(outcome, 'capabilityId', EXPLORER_CAPABILITY_IDS, path, issues);
      break;
    default:
      exactKeys(outcome, ['kind'], path, issues);
      issue(issues, 'unknown-variant', `${path}.kind`, `unknown expected outcome: ${kind}`);
      return null;
  }
  return outcome as ExplorerExpectedOutcome;
}

function duplicateIds(
  ids: readonly (string | null)[],
  path: string,
  issues: ExplorerScenarioValidationIssue[],
): void {
  const seen = new Set<string>();
  ids.forEach((id) => {
    if (id === null) return;
    if (seen.has(id)) {
      issue(issues, 'duplicate-id', path, `duplicate identity: ${id}`);
    }
    seen.add(id);
  });
}

function collectStep(
  input: unknown,
  index: number,
  allStepIds: readonly string[],
  priorStepId: string | null,
  oracleIds: Set<string>,
  issues: ExplorerScenarioValidationIssue[],
  options: ExplorerContractValidationOptions,
): ExplorerScenarioStep | null {
  const path = `$.steps[${index}]`;
  const step = recordAt(input, path, issues);
  if (!step) return null;
  exactKeys(
    step,
    [
      'stepId',
      'action',
      'preconditions',
      'ingress',
      'controlTestId',
      'targetTestIds',
      'checkpointPolicy',
      'expectedOutcome',
      'oracleAssertions',
      'requiredInvariants',
    ],
    path,
    issues,
  );
  stringAt(step, 'stepId', path, issues, 'protocol-id');
  const action = collectAction(step.action, `${path}.action`, issues, options);
  const preconditions = step.preconditions;
  if (!Array.isArray(preconditions) || preconditions.length === 0) {
    issue(
      issues,
      'invalid-value',
      `${path}.preconditions`,
      'must be non-empty; Explorer has no unconditional eligibility fallback',
    );
  } else {
    const predicateIds = preconditions.map((predicate, predicateIndex) => {
      const validated = collectEligibilityPredicate(
        predicate,
        `${path}.preconditions[${predicateIndex}]`,
        issues,
      );
      return validated?.predicateId ?? null;
    });
    duplicateIds(predicateIds, `${path}.preconditions`, issues);
  }
  enumAt(step, 'ingress', EXPLORER_INGRESS_SURFACES, path, issues);
  const controlTestId = stringAt(step, 'controlTestId', path, issues, 'test-id');
  const targetTestIds = stringArrayAt(step, 'targetTestIds', path, issues, {
    optional: true,
    nonEmpty: true,
    kind: 'test-id',
  }) ?? [];
  const checkpoint = collectCheckpointPolicy(
    step.checkpointPolicy,
    `${path}.checkpointPolicy`,
    issues,
  );
  const outcome = collectExpectedOutcome(
    step.expectedOutcome,
    `${path}.expectedOutcome`,
    issues,
  );
  const oracleAssertions = step.oracleAssertions;
  const validatedOracles: ExplorerOracleAssertion[] = [];
  if (!Array.isArray(oracleAssertions)) {
    issue(issues, 'invalid-value', `${path}.oracleAssertions`, 'must be an array');
  } else {
    oracleAssertions.forEach((oracle, oracleIndex) => {
      const validated = collectOracleAssertion(
        oracle,
        `${path}.oracleAssertions[${oracleIndex}]`,
        issues,
      );
      if (!validated) return;
      if (oracleIds.has(validated.oracleId)) {
        issue(
          issues,
          'duplicate-id',
          `${path}.oracleAssertions[${oracleIndex}].oracleId`,
          `duplicate oracle identity: ${validated.oracleId}`,
        );
      }
      oracleIds.add(validated.oracleId);
      validatedOracles.push(validated);
    });
  }
  const invariants = stringArrayAt(step, 'requiredInvariants', path, issues, {
    nonEmpty: true,
    kind: 'protocol-id',
  });
  invariants?.forEach((invariant, invariantIndex) => {
    if (!EXPLORER_REQUIRED_INVARIANT_IDS.includes(
      invariant as (typeof EXPLORER_REQUIRED_INVARIANT_IDS)[number],
    )) {
      issue(
        issues,
        'invalid-value',
        `${path}.requiredInvariants[${invariantIndex}]`,
        'is not a registered Explorer invariant',
      );
    }
  });

  if (!action || !checkpoint || !outcome) {
    return step as unknown as ExplorerScenarioStep;
  }
  const gate = explorerActionCapability(action);
  const disabledCapability = gate?.status === 'disabled' ? gate.capabilityId : null;
  if (disabledCapability) {
    if (
      outcome.kind !== 'capability-disabled' ||
      outcome.capabilityId !== disabledCapability ||
      checkpoint.kind !== 'none'
    ) {
      issue(
        issues,
        'invalid-combination',
        path,
        `${disabledCapability} is disabled and requires a capability-disabled outcome with no checkpoint`,
      );
    }
  } else {
    if (outcome.kind === 'capability-disabled' || checkpoint.kind === 'none') {
      issue(
        issues,
        'invalid-combination',
        path,
        'enabled actions cannot use capability-disabled outcomes or no-checkpoint policies',
      );
    }
    if (
      (outcome.kind === 'accepted' && checkpoint.kind !== 'durable') ||
      (outcome.kind === 'rejected' && checkpoint.kind !== 'rejected')
    ) {
      issue(
        issues,
        'invalid-combination',
        path,
        'checkpoint policy must agree with the expected outcome',
      );
    }
  }

  const renderedWitnesses = validatedOracles.filter(
    (oracle) => oracle.type === 'rendered-witness',
  );
  const traceReceipts = validatedOracles.filter(
    (oracle) => oracle.type === 'trace-v2-production-receipt',
  );
  const persistedEquality = validatedOracles.some(
    (oracle) => oracle.type === 'persisted-accepted-equality',
  );
  const renderedProofPolicy = checkpoint.kind === 'none'
    ? 'not-required'
    : checkpoint.renderedProof;
  if (
    explorerActionRequiresRenderedProof(action) &&
    (renderedProofPolicy !== 'required' || renderedWitnesses.length === 0)
  ) {
    issue(
      issues,
      'invalid-combination',
      path,
      'this action requires both a rendered-proof checkpoint and a rendered-witness oracle',
    );
  }
  if (renderedProofPolicy === 'required' && renderedWitnesses.length === 0) {
    issue(
      issues,
      'invalid-combination',
      `${path}.oracleAssertions`,
      'rendered-proof checkpoints require a rendered-witness oracle',
    );
  }
  if (renderedProofPolicy === 'not-required' && renderedWitnesses.length > 0) {
    issue(
      issues,
      'invalid-combination',
      `${path}.oracleAssertions`,
      'rendered-witness oracles require a rendered-proof checkpoint',
    );
  }
  const validWitnessTestIds = new Set(
    [controlTestId, ...targetTestIds].filter((value): value is string => value !== null),
  );
  renderedWitnesses.forEach((oracle) => {
    if (!validWitnessTestIds.has(oracle.testId)) {
      issue(
        issues,
        'invalid-combination',
        `${path}.oracleAssertions`,
        `rendered witness ${oracle.oracleId} must use the control or a declared target test ID`,
      );
    }
  });
  if (!disabledCapability && traceReceipts.length === 0) {
    issue(
      issues,
      'invalid-combination',
      `${path}.oracleAssertions`,
      'enabled actions require a TraceV2 production receipt',
    );
  }
  if (checkpoint.kind === 'durable' && !persistedEquality) {
    issue(
      issues,
      'invalid-combination',
      `${path}.oracleAssertions`,
      'durable checkpoints require persisted/accepted equality',
    );
  }

  validatedOracles.forEach((oracle) => {
    if (
      explorerOracleRequiresAcceptedCheckpoint(oracle) &&
      (outcome.kind !== 'accepted' || checkpoint.kind !== 'durable')
    ) {
      issue(
        issues,
        'invalid-combination',
        `${path}.oracleAssertions`,
        `${oracle.type} requires an accepted durable checkpoint`,
      );
    }
    switch (oracle.type) {
      case 'trace-v2-production-receipt':
        if (
          (outcome.kind === 'accepted' && oracle.terminalStatus !== 'finalized_success') ||
          (outcome.kind === 'rejected' && oracle.terminalStatus !== 'finalized_failure') ||
          outcome.kind === 'capability-disabled'
        ) {
          issue(
            issues,
            'invalid-combination',
            `${path}.oracleAssertions`,
            'TraceV2 terminal status must agree with the expected outcome',
          );
        }
        break;
      case 'prior-trace-linkage':
        if (priorStepId === null || oracle.priorStepId !== priorStepId) {
          issue(
            issues,
            'invalid-combination',
            `${path}.oracleAssertions`,
            'prior-trace linkage must reference the immediately preceding step',
          );
        }
        break;
      case 'interpretation-receipt':
        if (
          action.type !== 'coach.message' ||
          oracle.conversationId !== action.target.conversationId ||
          oracle.messageId !== action.target.messageId
        ) {
          issue(
            issues,
            'invalid-combination',
            `${path}.oracleAssertions`,
            'interpretation receipts belong only to the exact coach.message target',
          );
        }
        break;
      case 'restoration-equality': {
        const baselineIndex = allStepIds.indexOf(oracle.baselineStepId);
        if (action.type !== 'adjustment.restore' || baselineIndex < 0 || baselineIndex >= index) {
          issue(
            issues,
            'invalid-combination',
            `${path}.oracleAssertions`,
            'restoration equality requires an earlier baseline and adjustment.restore',
          );
        }
        break;
      }
      case 'metamorphic-equality':
        if (
          !allStepIds.includes(oracle.leftStepId) ||
          !allStepIds.includes(oracle.rightStepId)
        ) {
          issue(
            issues,
            'invalid-combination',
            `${path}.oracleAssertions`,
            'metamorphic equality must reference steps in the same scenario',
          );
        }
        break;
      case 'accepted-state-projection':
      case 'absence':
      case 'semantic-fingerprint':
      case 'rendered-witness':
      case 'persisted-accepted-equality':
      case 'unrelated-state-unchanged':
        break;
      default: {
        const exhaustive: never = oracle;
        return exhaustive;
      }
    }
  });
  return step as unknown as ExplorerScenarioStep;
}

function collectScenarioContract(
  input: unknown,
  path: string,
  issues: ExplorerScenarioValidationIssue[],
  options: ExplorerContractValidationOptions,
): ExplorerScenarioContract | null {
  const scenario = recordAt(input, path, issues);
  if (!scenario) return null;
  exactKeys(
    scenario,
    [
      'schemaVersion',
      'scenarioId',
      'tier',
      'seedId',
      'tags',
      'campaignSeed',
      'budgetMs',
      'steps',
    ],
    path,
    issues,
  );
  numberAt(scenario, 'schemaVersion', path, issues, {
    integer: true,
    minimum: EXPLORER_SCENARIO_SCHEMA_VERSION,
    maximum: EXPLORER_SCENARIO_SCHEMA_VERSION,
  });
  stringAt(scenario, 'scenarioId', path, issues, 'protocol-id');
  enumAt(scenario, 'tier', EXPLORER_SCENARIO_TIERS, path, issues);
  stringAt(scenario, 'seedId', path, issues, 'protocol-id');
  stringArrayAt(scenario, 'tags', path, issues, { kind: 'protocol-id' });
  if (hasOwn(scenario, 'campaignSeed')) {
    numberAt(scenario, 'campaignSeed', path, issues, { integer: true, minimum: 0 });
  }
  numberAt(scenario, 'budgetMs', path, issues, { integer: true, minimum: 1 });
  const steps = scenario.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    issue(issues, 'invalid-value', `${path}.steps`, 'scenario steps must be non-empty');
    return scenario as unknown as ExplorerScenarioContract;
  }
  const stepIds = steps.map((step, index) => {
    if (!isRecord(step)) return null;
    const stepId = step.stepId;
    if (typeof stepId !== 'string' || !PROTOCOL_ID_PATTERN.test(stepId)) return null;
    return stepId;
  });
  duplicateIds(stepIds, `${path}.steps`, issues);
  const stringStepIds = stepIds.filter((stepId): stepId is string => stepId !== null);
  const oracleIds = new Set<string>();
  steps.forEach((step, index) => {
    collectStep(
      step,
      index,
      stringStepIds,
      index > 0 ? stepIds[index - 1] : null,
      oracleIds,
      issues,
      options,
    );
  });
  return scenario as unknown as ExplorerScenarioContract;
}

export function validateExplorerScenarioContract(
  input: unknown,
  options: ExplorerContractValidationOptions = {},
): ExplorerScenarioContract {
  const issues: ExplorerScenarioValidationIssue[] = [];
  const scenario = collectScenarioContract(input, '$', issues, options);
  if (issues.length > 0 || scenario === null) {
    throw new ExplorerScenarioContractValidationError(issues);
  }
  return scenario;
}

export function validateExplorerScenarioContracts(
  input: unknown,
  options: ExplorerContractValidationOptions = {},
): readonly ExplorerScenarioContract[] {
  const issues: ExplorerScenarioValidationIssue[] = [];
  if (!Array.isArray(input)) {
    throw new ExplorerScenarioContractValidationError([
      { code: 'invalid-value', path: '$', message: 'must be an array of scenarios' },
    ]);
  }
  const scenarios = input.map((scenario, index) =>
    collectScenarioContract(scenario, `$[${index}]`, issues, options));
  duplicateIds(
    scenarios.map((scenario) => scenario?.scenarioId ?? null),
    '$',
    issues,
  );
  if (issues.length > 0 || scenarios.some((scenario) => scenario === null)) {
    throw new ExplorerScenarioContractValidationError(issues);
  }
  return scenarios as ExplorerScenarioContract[];
}

const EXCLUDED_NORMALIZATION_KEY = /^(?:runtimeTimestamp|timestamp|startedAt|endedAt|capturedAt|observedAt|createdAt|updatedAt|screenshotBytes|hierarchyBytes|screenshotPath|hierarchyPath|artifactPath|environmentPath|absolutePath|filePath|workspaceRoot|cwd)$/i;
const OMIT = Symbol('omit-explorer-normalization-value');

function normalizeStableValue(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  key: string | null,
): ExplorerJsonValue | typeof OMIT {
  if (key !== null && EXCLUDED_NORMALIZATION_KEY.test(key)) return OMIT;
  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    throw new ExplorerScenarioContractValidationError([
      {
        code: 'unstable-normalization',
        path,
        message: 'undefined, functions, symbols, and bigint are not stable inputs',
      },
    ]);
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value as ExplorerJsonValue;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    throw new ExplorerScenarioContractValidationError([
      {
        code: 'unstable-normalization',
        path,
        message: 'non-finite numbers are not stable inputs',
      },
    ]);
  }
  if (typeof value !== 'object') {
    throw new ExplorerScenarioContractValidationError([
      { code: 'unstable-normalization', path, message: 'unsupported input value' },
    ]);
  }
  if (seen.has(value)) {
    throw new ExplorerScenarioContractValidationError([
      { code: 'unstable-normalization', path, message: 'circular input is not stable' },
    ]);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((entry, index) => {
      const normalized = normalizeStableValue(entry, `${path}[${index}]`, seen, null);
      if (normalized === OMIT) {
        throw new ExplorerScenarioContractValidationError([
          {
            code: 'unstable-normalization',
            path: `${path}[${index}]`,
            message: 'array entries cannot be omitted',
          },
        ]);
      }
      return normalized;
    });
    seen.delete(value);
    return result;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    seen.delete(value);
    throw new ExplorerScenarioContractValidationError([
      {
        code: 'unstable-normalization',
        path,
        message: 'Date, binary, Map, Set, and class instances are not stable inputs',
      },
    ]);
  }
  const result: Record<string, ExplorerJsonValue> = {};
  Object.keys(value as UnknownRecord).sort().forEach((childKey) => {
    const normalized = normalizeStableValue(
      (value as UnknownRecord)[childKey],
      `${path}.${childKey}`,
      seen,
      childKey,
    );
    if (normalized !== OMIT) result[childKey] = normalized;
  });
  seen.delete(value);
  return result;
}

export function normalizeExplorerScenarioContract(
  scenario: ExplorerScenarioContract,
): ExplorerJsonValue {
  const normalized = normalizeStableValue(scenario, '$', new WeakSet<object>(), null);
  if (normalized === OMIT) {
    throw new ExplorerScenarioContractValidationError([
      { code: 'unstable-normalization', path: '$', message: 'scenario cannot be omitted' },
    ]);
  }
  return normalized;
}

export function stableExplorerScenarioContractJson(
  scenario: ExplorerScenarioContract,
): string {
  return JSON.stringify(normalizeExplorerScenarioContract(scenario));
}

export function explorerScenarioSemanticHash(
  scenario: ExplorerScenarioContract,
): ExplorerScenarioSemanticHash {
  const normalized = stableExplorerScenarioContractJson(scenario);
  const digest = sha256Hex(JSON.stringify({
    contract: EXPLORER_SCENARIO_HASH_CONTRACT,
    scenario: JSON.parse(normalized) as ExplorerJsonValue,
  }));
  return `${EXPLORER_SCENARIO_HASH_CONTRACT}:${digest}`;
}

/** Canonical action hash used by manifests, runners, and artifact receipts. */
export function explorerActionSemanticHash(
  action: ExplorerAction,
): ExplorerActionSemanticHash {
  const normalized = normalizeStableValue(action, '$', new WeakSet<object>(), null);
  if (normalized === OMIT) {
    throw new ExplorerScenarioContractValidationError([
      { code: 'unstable-normalization', path: '$', message: 'action cannot be omitted' },
    ]);
  }
  const digest = sha256Hex(JSON.stringify({
    contract: EXPLORER_ACTION_HASH_CONTRACT,
    action: normalized,
  }));
  return `${EXPLORER_ACTION_HASH_CONTRACT}:${digest}`;
}

/** Compile-time sentinel: adding an action must force an explicit validator decision. */
export function exhaustiveExplorerActionType(actionType: ExplorerActionType): ExplorerActionType {
  switch (actionType) {
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove':
    case 'session.move':
    case 'session.delete':
    case 'component.delete':
    case 'injury.set':
    case 'injury.resolve':
    case 'readiness.set':
    case 'readiness.clear':
    case 'equipment.set':
    case 'equipment.clear':
    case 'session-feedback.record':
    case 'adjustment.restore':
    case 'week.repeat':
    case 'coach.message':
      return actionType;
    default: {
      const exhaustive: never = actionType;
      return exhaustive;
    }
  }
}

void EXPLORER_ELIGIBILITY_PREDICATE_TYPES;
void EXPLORER_ORACLE_TYPES;
