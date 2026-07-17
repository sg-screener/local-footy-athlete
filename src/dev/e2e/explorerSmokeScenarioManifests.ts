import {
  EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
  EXPLORER_SCENARIO_SCHEMA_VERSION,
  type ExplorerAction,
  type ExplorerEligibilityPredicate,
  type ExplorerNonEmptyArray,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import type {
  ExplorerInvariantId,
  ExplorerOracleAssertion,
} from './explorerOracleContracts';
import { validateExplorerScenarioContracts } from './explorerScenarioContractValidation';

const DATE = '2026-07-13';
const TUESDAY = '2026-07-14';
const FIXTURE_DATE = '2026-07-18';
const FIXTURE_TARGET_DATE = '2026-07-19';
const NEXT_MONDAY = '2026-07-20';

const INJURY_EPISODE_ID =
  'injury-episode:v1:dev-e2e-injury-right-hamstring:20260713120000000';
const EQUIPMENT_FACT_ID = 'temporary-equipment-bodyweight-only-2026-07-13';
const FIXTURE_CHAIN_ADJUSTMENT_ID =
  'explorer-multi-reload-fixture-move-adjustment';
const REPEAT_WEEK_ADJUSTMENT_ID =
  'explorer-repeat-week-2026-07-13-2026-07-20-adjustment';

function acceptedOracles(args: {
  stepId: string;
  renderTestId: string;
  selector: string;
  priorStepId?: string;
  extra?: readonly ExplorerOracleAssertion[];
}): ExplorerOracleAssertion[] {
  return [
    {
      oracleId: `${args.stepId}-accepted-changed`,
      type: 'semantic-fingerprint',
      subject: 'accepted-state',
      relation: 'changed-from-before',
    },
    {
      oracleId: `${args.stepId}-rendered`,
      type: 'rendered-witness',
      testId: args.renderTestId,
      selector: args.selector,
      relation: 'equals-accepted',
    },
    {
      oracleId: `${args.stepId}-trace`,
      type: 'trace-v2-production-receipt',
      schemaVersion: 2,
      terminalStatus: 'finalized_success',
    },
    {
      oracleId: `${args.stepId}-persisted`,
      type: 'persisted-accepted-equality',
      selector: args.selector,
    },
    ...(args.priorStepId ? [{
      oracleId: `${args.stepId}-prior-trace`,
      type: 'prior-trace-linkage' as const,
      priorStepId: args.priorStepId,
    }] : []),
    ...(args.extra ?? []),
  ];
}

const CORE_INVARIANTS: ExplorerNonEmptyArray<ExplorerInvariantId> = [
  'no-false-success',
  'durable-readback-equals-accepted-state',
  'render-equals-accepted-state',
  'trace-chain-contiguous',
];

function acceptedStep(args: {
  stepId: string;
  action: ExplorerAction;
  preconditions: ExplorerNonEmptyArray<ExplorerEligibilityPredicate>;
  ingress: ExplorerScenarioStep['ingress'];
  controlTestId: string;
  renderTestId: string;
  selector: string;
  acceptedRevisionDelta?: number;
  priorStepId?: string;
  extraOracles?: readonly ExplorerOracleAssertion[];
  extraInvariants?: readonly ExplorerInvariantId[];
}): ExplorerScenarioStep {
  return {
    stepId: args.stepId,
    action: args.action,
    preconditions: args.preconditions,
    ingress: args.ingress,
    controlTestId: args.controlTestId,
    targetTestIds: [args.renderTestId],
    checkpointPolicy: {
      kind: 'durable',
      reload: 'required',
      renderedProof: 'required',
    },
    expectedOutcome: {
      kind: 'accepted',
      stateChange: 'required',
      acceptedRevisionDelta: args.acceptedRevisionDelta ?? 1,
    },
    oracleAssertions: acceptedOracles({
      stepId: args.stepId,
      renderTestId: args.renderTestId,
      selector: args.selector,
      priorStepId: args.priorStepId,
      extra: args.extraOracles,
    }),
    requiredInvariants: [
      ...CORE_INVARIANTS,
      ...(args.extraInvariants ?? []),
    ],
  };
}

function scenario(args: {
  scenarioId: string;
  seedId: string;
  steps: ExplorerNonEmptyArray<ExplorerScenarioStep>;
}): ExplorerScenarioContract {
  return {
    schemaVersion: EXPLORER_SCENARIO_SCHEMA_VERSION,
    scenarioId: args.scenarioId,
    tier: 'smoke',
    seedId: args.seedId,
    tags: ['explorer', 'smoke', 'non-coach'],
    budgetMs: 30_000 * args.steps.length,
    steps: args.steps,
  };
}

const wholeSessionId = 'dev-e2e-lower-body-deletion-2026-07-13-dow-1';
const stackedSessionId = 'dev-e2e-stacked-team-upper-pull';
const upperPullComponentId =
  'dev-e2e-stacked-team-upper-pull:component:strength:pull';
const oneSetSessionId = 'dev-e2e-one-set-strength-2026-07-13-dow-1';
const followingMondaySessionId =
  'dev-e2e-multi-reload-fixture-chain-2026-07-20-dow-1';

const WHOLE_SESSION_DELETION = scenario({
  scenarioId: 'smoke-whole-session-deletion',
  seedId: 'lower-body-deletion',
  steps: [acceptedStep({
    stepId: 'delete-whole-session',
    action: {
      type: 'session.delete',
      target: { kind: 'session', sessionId: wholeSessionId },
      args: { date: DATE },
    },
    preconditions: [{
      predicateId: 'whole-session-exists',
      type: 'session-exists',
      sessionId: wholeSessionId,
      date: DATE,
    }],
    ingress: 'program-card',
    controlTestId: 'plan-change-delete-confirm',
    renderTestId: 'plan-change-result-message',
    selector: `/accepted/sessions/${wholeSessionId}`,
    extraOracles: [{
      oracleId: 'delete-whole-session-absent',
      type: 'absence',
      subject: 'accepted-state',
      selector: `/accepted/sessions/${wholeSessionId}`,
    }],
  })],
});

const STACKED_UPPER_PULL_DELETION = scenario({
  scenarioId: 'smoke-stacked-upper-pull-component-deletion',
  seedId: 'stacked-team-training-upper-pull',
  steps: [acceptedStep({
    stepId: 'delete-upper-pull-component',
    action: {
      type: 'component.delete',
      target: {
        kind: 'component',
        sessionId: stackedSessionId,
        componentId: upperPullComponentId,
      },
      args: { date: TUESDAY },
    },
    preconditions: [{
      predicateId: 'upper-pull-component-exists',
      type: 'component-exists',
      sessionId: stackedSessionId,
      componentId: upperPullComponentId,
      date: TUESDAY,
    }],
    ingress: 'program-detail',
    controlTestId: 'exercise-edit-sheet',
    renderTestId: 'day-workout-visible-exercises',
    selector: `/accepted/sessions/${stackedSessionId}/components/${upperPullComponentId}`,
    extraOracles: [{
      oracleId: 'delete-upper-pull-component-absent',
      type: 'absence',
      subject: 'accepted-state',
      selector: `/accepted/sessions/${stackedSessionId}/components/${upperPullComponentId}`,
    }],
  })],
});

function fixtureMoveStep(
  stepId: string,
  priorStepId?: string,
): ExplorerScenarioStep {
  return acceptedStep({
    stepId,
    action: {
      type: 'fixture.move',
      target: { kind: 'fixture', fixtureId: `calendar-game-${FIXTURE_DATE}` },
      args: { fromDate: FIXTURE_DATE, toDate: FIXTURE_TARGET_DATE },
    },
    preconditions: [
      {
        predicateId: `${stepId}-fixture-exists`,
        type: 'fixture-exists',
        fixtureId: `calendar-game-${FIXTURE_DATE}`,
        date: FIXTURE_DATE,
      },
      {
        predicateId: `${stepId}-target-eligible`,
        type: 'eligible-target-date',
        date: FIXTURE_TARGET_DATE,
        forActionType: 'fixture.move',
      },
    ],
    ingress: 'fixture-editor',
    controlTestId: 'fixture-move-action',
    renderTestId: 'home-fixture-visible-state',
    selector: `/accepted/fixtures/${FIXTURE_TARGET_DATE}`,
    priorStepId,
    extraOracles: [{
      oracleId: `${stepId}-source-absent`,
      type: 'absence',
      subject: 'accepted-state',
      selector: `/accepted/fixtures/${FIXTURE_DATE}`,
    }],
    extraInvariants: ['fixture-anchor-valid', 'card-detail-equality'],
  });
}

const FIXTURE_MOVE = scenario({
  scenarioId: 'smoke-fixture-move',
  seedId: 'fixture-move',
  steps: [fixtureMoveStep('move-fixture')],
});

const chainMove = fixtureMoveStep('move-fixture');
const chainDelete = acceptedStep({
  stepId: 'delete-following-monday-session',
  action: {
    type: 'session.delete',
    target: { kind: 'session', sessionId: followingMondaySessionId },
    args: { date: NEXT_MONDAY },
  },
  preconditions: [{
    predicateId: 'following-monday-session-exists',
    type: 'session-exists',
    sessionId: followingMondaySessionId,
    date: NEXT_MONDAY,
  }],
  ingress: 'program-card',
  controlTestId: 'plan-change-delete-confirm',
  renderTestId: 'plan-change-result-message',
  selector: `/accepted/sessions/${followingMondaySessionId}`,
  priorStepId: chainMove.stepId,
});
const chainRestore = acceptedStep({
  stepId: 'restore-fixture-adjustment',
  action: {
    type: 'adjustment.restore',
    target: { kind: 'adjustment', adjustmentId: FIXTURE_CHAIN_ADJUSTMENT_ID },
    args: { restoredOn: NEXT_MONDAY },
  },
  preconditions: [{
    predicateId: 'fixture-adjustment-active',
    type: 'reversible-adjustment-status',
    adjustmentId: FIXTURE_CHAIN_ADJUSTMENT_ID,
    status: 'active',
  }],
  ingress: 'adjustment-history',
  controlTestId: 'coach-note-confirm-clear',
  renderTestId: 'home-visible-week-after-restoration',
  selector: '/accepted/fixtures',
  priorStepId: chainDelete.stepId,
  extraOracles: [{
    oracleId: 'restore-fixture-adjustment-baseline',
    type: 'restoration-equality',
    baselineStepId: chainMove.stepId,
    selector: '/accepted/fixtures',
  }],
  extraInvariants: ['restoration-equals-pre-mutation-state', 'fixture-anchor-valid'],
});

const MULTI_RELOAD_FIXTURE_CHAIN = scenario({
  scenarioId: 'smoke-multi-reload-fixture-session-restoration-chain',
  seedId: 'multi-reload-fixture-chain',
  steps: [chainMove, chainDelete, chainRestore],
});

const injuryUpdate = acceptedStep({
  stepId: 'update-injury',
  action: {
    type: 'injury.set',
    target: { kind: 'injury-episode', injuryEpisodeId: INJURY_EPISODE_ID },
    args: {
      effectiveDate: DATE,
      bodyRegionId: 'hamstring',
      severity: 'minor',
      laterality: 'right',
    },
  },
  preconditions: [{
    predicateId: 'injury-source-fact-exists',
    type: 'source-fact-exists',
    sourceFactId: INJURY_EPISODE_ID,
    sourceFactType: 'injury',
  }],
  ingress: 'injury-editor',
  controlTestId: 'injury-apply-adjustment',
  renderTestId: 'home-visible-week-after-injury',
  selector: `/accepted/injuries/${INJURY_EPISODE_ID}`,
  extraInvariants: ['source-fact-has-programming-effect'],
});
const injuryResolve = acceptedStep({
  stepId: 'resolve-injury',
  action: {
    type: 'injury.resolve',
    target: { kind: 'injury-episode', injuryEpisodeId: INJURY_EPISODE_ID },
    args: { resolvedDate: NEXT_MONDAY },
  },
  preconditions: [{
    predicateId: 'updated-injury-source-fact-exists',
    type: 'source-fact-exists',
    sourceFactId: INJURY_EPISODE_ID,
    sourceFactType: 'injury',
  }],
  ingress: 'injury-editor',
  controlTestId: 'injury-resolve-action',
  renderTestId: 'home-visible-week-after-injury-resolution',
  selector: `/accepted/injuries/${INJURY_EPISODE_ID}`,
  priorStepId: injuryUpdate.stepId,
  extraInvariants: ['source-fact-has-programming-effect'],
});

const INJURY_UPDATE_AND_RESOLUTION = scenario({
  scenarioId: 'smoke-injury-update-and-resolution',
  seedId: 'injury-case',
  steps: [injuryUpdate, injuryResolve],
});

const readinessId = `readiness-${DATE}`;
const readinessSet = acceptedStep({
  stepId: 'set-readiness',
  action: {
    type: 'readiness.set',
    target: { kind: 'readiness', readinessId },
    args: { date: DATE, fatigue: 3, soreness: 2, sleepQuality: 3 },
  },
  preconditions: [{
    predicateId: 'readiness-source-fact-absent',
    type: 'source-fact-absent',
    sourceFactId: readinessId,
    sourceFactType: 'readiness',
  }],
  ingress: 'readiness-editor',
  controlTestId: 'home-week-readiness-entry',
  renderTestId: 'home-visible-week-after-readiness',
  selector: `/accepted/readiness/${DATE}`,
  extraInvariants: ['source-fact-has-programming-effect'],
});
const readinessClear = acceptedStep({
  stepId: 'clear-readiness',
  action: {
    type: 'readiness.clear',
    target: { kind: 'readiness', readinessId },
    args: { date: DATE },
  },
  preconditions: [{
    predicateId: 'readiness-source-fact-exists',
    type: 'source-fact-exists',
    sourceFactId: readinessId,
    sourceFactType: 'readiness',
  }],
  ingress: 'readiness-editor',
  controlTestId: 'readiness-clear-action',
  renderTestId: 'home-visible-week-after-readiness-clear',
  selector: `/accepted/readiness/${DATE}`,
  priorStepId: readinessSet.stepId,
  extraInvariants: ['source-fact-has-programming-effect'],
});

const READINESS_SET_AND_CLEAR = scenario({
  scenarioId: 'smoke-readiness-set-and-clear',
  seedId: 'standard-in-season-week',
  steps: [readinessSet, readinessClear],
});

const equipmentClear = acceptedStep({
  stepId: 'clear-equipment-restriction',
  action: {
    type: 'equipment.clear',
    target: { kind: 'equipment-fact', equipmentFactId: EQUIPMENT_FACT_ID },
    args: { clearedOn: DATE },
  },
  preconditions: [{
    predicateId: 'equipment-source-fact-exists',
    type: 'source-fact-exists',
    sourceFactId: EQUIPMENT_FACT_ID,
    sourceFactType: 'equipment',
  }],
  ingress: 'equipment-editor',
  controlTestId: 'equipment-clear-action',
  renderTestId: 'home-visible-week-after-equipment-clear',
  selector: `/accepted/equipment/${EQUIPMENT_FACT_ID}`,
  extraInvariants: ['source-fact-has-programming-effect'],
});
const equipmentReapply = acceptedStep({
  stepId: 'reapply-equipment-restriction',
  action: {
    type: 'equipment.set',
    target: { kind: 'equipment-fact', equipmentFactId: EQUIPMENT_FACT_ID },
    args: {
      fromDate: DATE,
      toDate: '2026-07-19',
      availableEquipmentIds: ['bodyweight'],
      unavailableEquipmentIds: ['barbell', 'dumbbell', 'machine'],
    },
  },
  preconditions: [{
    predicateId: 'equipment-source-fact-absent',
    type: 'source-fact-absent',
    sourceFactId: EQUIPMENT_FACT_ID,
    sourceFactType: 'equipment',
  }],
  ingress: 'equipment-editor',
  // The live control currently contains an underscore and therefore is not a
  // contract-safe stable test ID. This declared ID intentionally remains
  // unavailable until the production observer exposes a canonical selector.
  controlTestId: 'equipment-preset-bodyweight-only',
  renderTestId: 'home-visible-week-after-equipment-set',
  selector: `/accepted/equipment/${EQUIPMENT_FACT_ID}`,
  priorStepId: equipmentClear.stepId,
  extraInvariants: ['source-fact-has-programming-effect'],
});

const EQUIPMENT_CLEAR_AND_REAPPLY = scenario({
  scenarioId: 'smoke-equipment-clear-and-reapply',
  seedId: 'equipment-restriction-case',
  steps: [equipmentClear, equipmentReapply],
});

const SESSION_FEEDBACK_RECEIPT = scenario({
  scenarioId: 'smoke-session-feedback-receipt',
  seedId: 'one-set-strength',
  steps: [acceptedStep({
    stepId: 'record-session-feedback',
    action: {
      type: 'session-feedback.record',
      target: {
        kind: 'session-feedback',
        sessionId: oneSetSessionId,
        feedbackId: `feedback-${DATE}-${oneSetSessionId}`,
      },
      args: {
        date: DATE,
        completion: 'full',
        feeling: 'manageable',
        soreness: 'none',
        difficulty: 4,
      },
    },
    preconditions: [{
      predicateId: 'feedback-session-exists',
      type: 'session-exists',
      sessionId: oneSetSessionId,
      date: DATE,
    }],
    ingress: 'session-feedback',
    controlTestId: 'feedback-save-action',
    renderTestId: 'session-feedback-panel',
    selector: `/accepted/session-feedback/${DATE}`,
    acceptedRevisionDelta: 0,
  })],
});

const repeatWeek = acceptedStep({
  stepId: 'repeat-week',
  action: {
    type: 'week.repeat',
    target: { kind: 'week', weekId: DATE },
    args: { sourceWeekStart: DATE, targetWeekStart: NEXT_MONDAY },
    capability: { capabilityId: 'week.repeat', status: 'enabled' },
  },
  preconditions: [
    {
      predicateId: 'repeat-accepted-weeks',
      type: 'accepted-week-count',
      operator: 'at-least',
      count: 2,
    },
    {
      predicateId: 'repeat-source-phase',
      type: 'phase-signature',
      signature: 'in-season-standard',
    },
  ],
  ingress: 'week-controls',
  controlTestId: 'program-week-repeat',
  renderTestId: 'home-visible-week-after-repeat',
  selector: `/accepted/weeks/${NEXT_MONDAY}`,
});
const restoreRepeatedWeek = acceptedStep({
  stepId: 'restore-repeated-week',
  action: {
    type: 'adjustment.restore',
    target: { kind: 'adjustment', adjustmentId: REPEAT_WEEK_ADJUSTMENT_ID },
    args: { restoredOn: NEXT_MONDAY },
  },
  preconditions: [{
    predicateId: 'repeat-week-adjustment-active',
    type: 'reversible-adjustment-status',
    adjustmentId: REPEAT_WEEK_ADJUSTMENT_ID,
    status: 'active',
  }],
  ingress: 'adjustment-history',
  controlTestId: 'repeat-week-restore',
  renderTestId: 'home-visible-week-after-repeat-restoration',
  selector: `/accepted/weeks/${NEXT_MONDAY}`,
  priorStepId: repeatWeek.stepId,
  extraOracles: [{
    oracleId: 'restore-repeated-week-baseline',
    type: 'restoration-equality',
    baselineStepId: repeatWeek.stepId,
    selector: `/accepted/weeks/${NEXT_MONDAY}`,
  }],
  extraInvariants: ['restoration-equals-pre-mutation-state'],
});

const REPEAT_WEEK_PHASE_TRANSITION_AND_RESTORE = scenario({
  scenarioId: 'smoke-repeat-week-phase-transition-and-restore',
  seedId: 'repeat-week-phase-transition',
  steps: [repeatWeek, restoreRepeatedWeek],
});

/** Exactly nine non-Coach smoke manifests. */
export const EXPLORER_NON_COACH_SMOKE_MANIFESTS = validateExplorerScenarioContracts([
  WHOLE_SESSION_DELETION,
  STACKED_UPPER_PULL_DELETION,
  FIXTURE_MOVE,
  MULTI_RELOAD_FIXTURE_CHAIN,
  INJURY_UPDATE_AND_RESOLUTION,
  READINESS_SET_AND_CLEAR,
  EQUIPMENT_CLEAR_AND_REAPPLY,
  SESSION_FEEDBACK_RECEIPT,
  REPEAT_WEEK_PHASE_TRANSITION_AND_RESTORE,
], {
  declaredCapabilities: EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
});

export function resolveExplorerSmokeScenarioManifest(
  scenarioId: string,
): ExplorerScenarioContract | null {
  return EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((manifest) =>
    manifest.scenarioId === scenarioId) ?? null;
}
