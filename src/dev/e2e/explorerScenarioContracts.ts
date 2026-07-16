import type {
  ExplorerInvariantId,
  ExplorerOracleAssertion,
} from './explorerOracleContracts';

export const EXPLORER_SCENARIO_SCHEMA_VERSION = 1 as const;

export const EXPLORER_ACTION_TYPES = [
  'fixture.add',
  'fixture.move',
  'fixture.remove',
  'session.move',
  'session.delete',
  'component.delete',
  'injury.set',
  'injury.resolve',
  'readiness.set',
  'readiness.clear',
  'equipment.set',
  'equipment.clear',
  'session-feedback.record',
  'adjustment.restore',
  'week.repeat',
  'coach.message',
] as const;

export type ExplorerActionType = (typeof EXPLORER_ACTION_TYPES)[number];

export const EXPLORER_CAPABILITY_IDS = [
  'week.repeat',
  'coach.message',
] as const;

export type ExplorerCapabilityId = (typeof EXPLORER_CAPABILITY_IDS)[number];

/** Default gates remain fail-closed until a scenario opts into a declared owner. */
export const EXPLORER_DEFAULT_CAPABILITY_STATUS: Readonly<
  Record<ExplorerCapabilityId, 'disabled'>
> = Object.freeze({
  'week.repeat': 'disabled',
  'coach.message': 'disabled',
});

export interface ExplorerCapabilityGate<TCapability extends ExplorerCapabilityId> {
  readonly capabilityId: TCapability;
  readonly status: 'disabled' | 'enabled';
}

export interface ExplorerCapabilityDeclaration {
  readonly capabilityId: ExplorerCapabilityId;
  readonly owner: string;
  readonly contractVersion: string;
}

/**
 * Canonical production ownership registry. Explorer consumers may verify this
 * receipt, but they must not invent capability ownership locally.
 */
export const EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS = Object.freeze([
  {
    capabilityId: 'week.repeat',
    owner: 'repeatWeekIntoNextWeek',
    contractVersion: 'repeat-week-transaction-v1',
  },
] as const satisfies readonly ExplorerCapabilityDeclaration[]);

export interface ExplorerContractValidationOptions {
  readonly declaredCapabilities?: readonly ExplorerCapabilityDeclaration[];
}

export type ExplorerJsonPrimitive = string | number | boolean | null;
export type ExplorerJsonValue =
  | ExplorerJsonPrimitive
  | readonly ExplorerJsonValue[]
  | { readonly [key: string]: ExplorerJsonValue };

export type ExplorerNonEmptyArray<T> = readonly [T, ...T[]];

export interface ExplorerFixtureTarget {
  readonly kind: 'fixture';
  readonly fixtureId: string;
}

export interface ExplorerSessionTarget {
  readonly kind: 'session';
  readonly sessionId: string;
}

export interface ExplorerComponentTarget {
  readonly kind: 'component';
  readonly sessionId: string;
  readonly componentId: string;
}

export interface ExplorerInjuryEpisodeTarget {
  readonly kind: 'injury-episode';
  readonly injuryEpisodeId: string;
}

export interface ExplorerReadinessTarget {
  readonly kind: 'readiness';
  readonly readinessId: string;
}

export interface ExplorerEquipmentFactTarget {
  readonly kind: 'equipment-fact';
  readonly equipmentFactId: string;
}

export interface ExplorerSessionFeedbackTarget {
  readonly kind: 'session-feedback';
  readonly sessionId: string;
  readonly feedbackId: string;
}

export interface ExplorerAdjustmentTarget {
  readonly kind: 'adjustment';
  readonly adjustmentId: string;
}

export interface ExplorerWeekTarget {
  readonly kind: 'week';
  readonly weekId: string;
}

export interface ExplorerCoachMessageTarget {
  readonly kind: 'coach-message';
  readonly conversationId: string;
  readonly messageId: string;
}

export type ExplorerAction =
  | {
      readonly type: 'fixture.add';
      readonly target: ExplorerFixtureTarget;
      readonly args: {
        readonly date: string;
        readonly fixtureKind: 'game' | 'practice-match';
        readonly opponentId: string;
      };
    }
  | {
      readonly type: 'fixture.move';
      readonly target: ExplorerFixtureTarget;
      readonly args: { readonly fromDate: string; readonly toDate: string };
    }
  | {
      readonly type: 'fixture.remove';
      readonly target: ExplorerFixtureTarget;
      readonly args: { readonly date: string };
    }
  | {
      readonly type: 'session.move';
      readonly target: ExplorerSessionTarget;
      readonly args: { readonly fromDate: string; readonly toDate: string };
    }
  | {
      readonly type: 'session.delete';
      readonly target: ExplorerSessionTarget;
      readonly args: { readonly date: string };
    }
  | {
      readonly type: 'component.delete';
      readonly target: ExplorerComponentTarget;
      readonly args: { readonly date: string };
    }
  | {
      readonly type: 'injury.set';
      readonly target: ExplorerInjuryEpisodeTarget;
      readonly args: {
        readonly effectiveDate: string;
        readonly bodyRegionId: string;
        readonly severity: 'minor' | 'moderate' | 'severe';
        readonly laterality: 'left' | 'right' | 'bilateral' | 'not-applicable';
      };
    }
  | {
      readonly type: 'injury.resolve';
      readonly target: ExplorerInjuryEpisodeTarget;
      readonly args: { readonly resolvedDate: string };
    }
  | {
      readonly type: 'readiness.set';
      readonly target: ExplorerReadinessTarget;
      readonly args: {
        readonly date: string;
        readonly fatigue: number;
        readonly soreness: number;
        readonly sleepQuality: number;
      };
    }
  | {
      readonly type: 'readiness.clear';
      readonly target: ExplorerReadinessTarget;
      readonly args: { readonly date: string };
    }
  | {
      readonly type: 'equipment.set';
      readonly target: ExplorerEquipmentFactTarget;
      readonly args: {
        readonly fromDate: string;
        readonly toDate: string | null;
        readonly availableEquipmentIds: readonly string[];
        readonly unavailableEquipmentIds: readonly string[];
      };
    }
  | {
      readonly type: 'equipment.clear';
      readonly target: ExplorerEquipmentFactTarget;
      readonly args: { readonly clearedOn: string };
    }
  | {
      readonly type: 'session-feedback.record';
      readonly target: ExplorerSessionFeedbackTarget;
      readonly args: {
        readonly date: string;
        readonly completion: 'full' | 'partial' | 'not-completed';
        readonly feeling: 'very-easy' | 'manageable' | 'hard' | 'too-hard';
        readonly soreness: 'none' | 'mild' | 'moderate' | 'severe';
        readonly difficulty: number;
      };
    }
  | {
      readonly type: 'adjustment.restore';
      readonly target: ExplorerAdjustmentTarget;
      readonly args: { readonly restoredOn: string };
    }
  | {
      readonly type: 'week.repeat';
      readonly target: ExplorerWeekTarget;
      readonly args: {
        readonly sourceWeekStart: string;
        readonly targetWeekStart: string;
      };
      readonly capability: ExplorerCapabilityGate<'week.repeat'>;
    }
  | {
      readonly type: 'coach.message';
      readonly target: ExplorerCoachMessageTarget;
      readonly args: {
        readonly message: string;
        readonly visibleWeekId: string;
      };
      readonly capability: ExplorerCapabilityGate<'coach.message'>;
    };

export const EXPLORER_ELIGIBILITY_PREDICATE_TYPES = [
  'accepted-week-count',
  'phase-signature',
  'fixture-exists',
  'fixture-absent',
  'session-exists',
  'component-exists',
  'eligible-target-date',
  'source-fact-exists',
  'source-fact-absent',
  'reversible-adjustment-status',
  'accepted-revision',
  'card-detail-equality',
  'coach-interpretation-receipt-available',
] as const;

export type ExplorerEligibilityPredicateType =
  (typeof EXPLORER_ELIGIBILITY_PREDICATE_TYPES)[number];

export type ExplorerSourceFactType =
  | 'fixture'
  | 'injury'
  | 'readiness'
  | 'equipment'
  | 'session-feedback';

export type ExplorerEligibilityPredicate =
  | {
      readonly predicateId: string;
      readonly type: 'accepted-week-count';
      readonly operator: 'equals' | 'at-least' | 'at-most';
      readonly count: number;
    }
  | {
      readonly predicateId: string;
      readonly type: 'phase-signature';
      readonly signature: string;
    }
  | {
      readonly predicateId: string;
      readonly type: 'fixture-exists';
      readonly fixtureId: string;
      readonly date: string;
    }
  | {
      readonly predicateId: string;
      readonly type: 'fixture-absent';
      readonly fixtureId: string;
      readonly date: string;
    }
  | {
      readonly predicateId: string;
      readonly type: 'session-exists';
      readonly sessionId: string;
      readonly date: string;
    }
  | {
      readonly predicateId: string;
      readonly type: 'component-exists';
      readonly sessionId: string;
      readonly componentId: string;
      readonly date: string;
    }
  | {
      readonly predicateId: string;
      readonly type: 'eligible-target-date';
      readonly date: string;
      readonly forActionType: ExplorerActionType;
    }
  | {
      readonly predicateId: string;
      readonly type: 'source-fact-exists';
      readonly sourceFactId: string;
      readonly sourceFactType: ExplorerSourceFactType;
    }
  | {
      readonly predicateId: string;
      readonly type: 'source-fact-absent';
      readonly sourceFactId: string;
      readonly sourceFactType: ExplorerSourceFactType;
    }
  | {
      readonly predicateId: string;
      readonly type: 'reversible-adjustment-status';
      readonly adjustmentId: string;
      readonly status: 'active' | 'restored';
    }
  | {
      readonly predicateId: string;
      readonly type: 'accepted-revision';
      readonly revision: number;
    }
  | {
      readonly predicateId: string;
      readonly type: 'card-detail-equality';
      readonly sessionId: string;
      readonly date: string;
    }
  | {
      readonly predicateId: string;
      readonly type: 'coach-interpretation-receipt-available';
      readonly conversationId: string;
      readonly messageId: string;
    };

export const EXPLORER_SCENARIO_TIERS = [
  'smoke',
  'golden',
  'pairwise',
  'seeded-chain',
] as const;

export type ExplorerScenarioTier = (typeof EXPLORER_SCENARIO_TIERS)[number];

export const EXPLORER_INGRESS_SURFACES = [
  'program-card',
  'program-detail',
  'fixture-editor',
  'session-editor',
  'injury-editor',
  'readiness-editor',
  'equipment-editor',
  'session-feedback',
  'adjustment-history',
  'week-controls',
  'coach-chat',
] as const;

export type ExplorerIngressSurface = (typeof EXPLORER_INGRESS_SURFACES)[number];

export type ExplorerCheckpointPolicy =
  | {
      readonly kind: 'durable';
      readonly reload: 'required' | 'not-required';
      readonly renderedProof: 'required' | 'not-required';
    }
  | {
      readonly kind: 'rejected';
      readonly renderedProof: 'required' | 'not-required';
    }
  | {
      readonly kind: 'none';
      readonly reason: 'capability-disabled';
    };

export type ExplorerExpectedOutcome =
  | {
      readonly kind: 'accepted';
      readonly stateChange: 'required';
      readonly acceptedRevisionDelta: number;
    }
  | {
      readonly kind: 'rejected';
      readonly stateChange: 'forbidden';
      readonly reasonCode: string;
    }
  | {
      readonly kind: 'capability-disabled';
      readonly stateChange: 'forbidden';
      readonly capabilityId: ExplorerCapabilityId;
    };

export interface ExplorerScenarioStep {
  readonly stepId: string;
  readonly action: ExplorerAction;
  readonly preconditions: ExplorerNonEmptyArray<ExplorerEligibilityPredicate>;
  readonly ingress: ExplorerIngressSurface;
  readonly controlTestId: string;
  readonly targetTestIds?: readonly string[];
  readonly checkpointPolicy: ExplorerCheckpointPolicy;
  readonly expectedOutcome: ExplorerExpectedOutcome;
  readonly oracleAssertions: readonly ExplorerOracleAssertion[];
  readonly requiredInvariants: ExplorerNonEmptyArray<ExplorerInvariantId>;
}

export interface ExplorerScenarioContract {
  readonly schemaVersion: typeof EXPLORER_SCENARIO_SCHEMA_VERSION;
  readonly scenarioId: string;
  readonly tier: ExplorerScenarioTier;
  readonly seedId: string;
  readonly tags: readonly string[];
  readonly campaignSeed?: number;
  readonly budgetMs: number;
  readonly steps: ExplorerNonEmptyArray<ExplorerScenarioStep>;
}

export function explorerActionCapability(
  action: ExplorerAction,
): ExplorerCapabilityGate<ExplorerCapabilityId> | null {
  switch (action.type) {
    case 'week.repeat':
    case 'coach.message':
      return action.capability;
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
      return null;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function explorerActionRequiresRenderedProof(action: ExplorerAction): boolean {
  switch (action.type) {
    case 'week.repeat':
    case 'coach.message':
      return action.capability.status === 'enabled';
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
      return true;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
