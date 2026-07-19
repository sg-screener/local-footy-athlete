import type { EquipmentTag } from '../../data/exercisePools';
import type { PlanChange, PlanChangeBinScopeId } from '../../utils/planChangeTypes';
import type { ResolvedDay } from '../../utils/sessionResolver';
import {
  buildScheduleStateImperative,
} from '../../utils/coachWeekDiff';
import {
  buildProgramTabProjectedWeek,
} from '../../utils/visibleProgramReadModel';
import {
  getMondayForDate,
} from '../../utils/sessionResolver';
import {
  resolveAthleteMutation,
  type AthleteMutationResolution,
} from '../../utils/planChangeProducer';
import {
  canonicalFixtureKind,
} from '../../rules/fixtureConditionedAvailability';
import {
  createTemporaryEquipmentFact,
} from '../../rules/temporarySourceFact';
import {
  executeFixtureMutationTransaction,
  type FixtureMutationTransactionResult,
} from '../../store/fixtureMutationTransaction';
import {
  commitAthleteSessionDeletionTransaction,
  commitAthleteSessionMoveTransaction,
  commitReadinessSignalTransaction,
} from '../../store/acceptedStateTransaction';
import {
  updateInjuryEpisode,
  resolveInjuryEpisode,
} from '../../store/injuryEpisodeTransaction';
import {
  transactTemporarySourceFact,
} from '../../store/temporarySourceFactTransaction';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../../store/sessionOutcomeTransaction';
import { clearReversibleAdjustment } from '../../store/reversibleAdjustmentTransaction';
import { repeatWeekIntoNextWeek } from '../../utils/repeatWeek';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import {
  captureAcceptedAthleteSemanticSnapshotV2,
} from '../../store/coachMutationTransaction';
import {
  readDurableProgramStoreEnvelope,
} from '../../store/programStore';
import {
  athleteActionTraceCoordinator,
  beginAthleteActionTrace,
  emitAthleteActionEvent,
  getAthleteActionTraceV2,
  recordAthleteActionAfterV2,
  recordAthleteActionBeforeV2,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
  type AthleteActionType,
} from '../../utils/athleteActionDiagnostics';
import { capturedTraceField } from './AthleteActionTraceCoordinator';
import { semanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  captureDevE2EMemoryFingerprints,
  waitForDevE2EPersistence,
} from './devE2EPersistence';
import { todayISOLocal } from '../../utils/appDate';
import {
  buildDevE2ESeed,
  type DevE2ESeed,
} from './devE2ESeedRegistry';
import {
  resolveExplorerSmokeScenarioManifest,
} from './explorerSmokeScenarioManifests';
import {
  EXPLORER_PRODUCTION_OWNER_BY_ACTION,
  createExplorerActionBridge,
  mapExplorerCanonicalOutcome,
  type ExplorerActionBridge,
  type ExplorerActionFor,
  type ExplorerExecutableAction,
  type ExplorerExecutableActionType,
  type ExplorerProductionActionAdapters,
  type ExplorerProductionAdapterContext,
  type ExplorerProductionOwnerResult,
  type ExplorerProductionReceiptStatus,
} from './explorerActionBridge';
import {
  explorerActionSemanticHash,
} from './explorerScenarioContractValidation';
import type {
  ExplorerJsonValue,
  ExplorerScenarioContract,
} from './explorerScenarioContracts';
import {
  bindExplorerRenderExpectationToManifestStep,
  buildExplorerRenderExpectation,
  registerExplorerRenderExpectation,
  type ExplorerRenderExpectation,
} from './explorerRenderReceiptBindings';
import { deriveFutureProgressionRenderTarget } from '../../utils/sessionFeedbackRenderWitness';
import { explorerCanonicalTargetIds } from './explorerActionIngress';

export const EXPLORER_BOUND_ACTION_TYPES = [
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
] as const satisfies readonly ExplorerExecutableActionType[];

const EQUIPMENT_TAGS = new Set<EquipmentTag>([
  'bodyweight',
  'dumbbells',
  'barbell',
  'cables',
  'bands',
  'bench',
  'foam_roller',
  'bike_or_treadmill',
  'pullup_bar',
  'kettlebell',
  'machine',
]);

export interface ExplorerResolvedProductionTarget {
  readonly canonicalSemanticIdentity: string;
  readonly seed: DevE2ESeed;
  readonly visibleWeek?: readonly ResolvedDay[];
  readonly athleteMutation?: Exclude<AthleteMutationResolution, { ok: false }>;
  readonly exactAdjustmentId?: string;
  readonly adjustmentKind?: string;
}

export interface ExplorerCanonicalOwnerExecution {
  readonly status: ExplorerProductionReceiptStatus;
  readonly reasonCode: string | null;
  readonly canonicalReceipt: ExplorerJsonValue;
  readonly producedAdjustmentId?: string | null;
  readonly exactAdjustmentId?: string | null;
  readonly adjustmentKind?: string | null;
  readonly feedbackTransactionId?: string | null;
  readonly progressionTargetSessionId?: string | null;
}

export interface ExplorerProductionBindingDependencies {
  readonly readAcceptedRevision: () => number;
  readonly readDurableEnvelope: () => Promise<string | null>;
  readonly waitForPersistence: () => Promise<void>;
  readonly resolveTarget: (
    action: ExplorerExecutableAction,
    context: ExplorerProductionAdapterContext,
    adjustments: ExplorerAdjustmentReceiptRegistry,
  ) => ExplorerResolvedProductionTarget;
  readonly invokeCanonicalOwner: (
    action: ExplorerExecutableAction,
    target: ExplorerResolvedProductionTarget,
    acceptedRevision: number,
    trace: AthleteActionTraceContext,
  ) => Promise<ExplorerCanonicalOwnerExecution>;
}

function manifestForClaim(
  context: ExplorerProductionAdapterContext,
): ExplorerScenarioContract {
  const manifest = resolveExplorerSmokeScenarioManifest(context.claim.scenarioId);
  if (!manifest) throw new Error(`explorer_manifest_not_found:${context.claim.scenarioId}`);
  if (!manifest.steps.some((step) => step.stepId === context.claim.stepId)) {
    throw new Error(`explorer_manifest_step_not_found:${context.claim.stepId}`);
  }
  return manifest;
}

/**
 * Binds a manifest-owned logical restore target to one exact ID returned by
 * the producing transaction. It never searches notes, dates or "latest".
 */
export class ExplorerAdjustmentReceiptRegistry {
  private readonly exactByLogicalTarget = new Map<string, string>();

  private restoreTargetForSourceStep(
    manifest: ExplorerScenarioContract,
    sourceStepId: string,
  ): string | null {
    const matchingRestores = manifest.steps.filter((step) =>
      step.action.type === 'adjustment.restore' &&
      step.oracleAssertions.some((oracle) =>
        oracle.type === 'restoration-equality' &&
        oracle.baselineStepId === sourceStepId));
    if (matchingRestores.length > 1) {
      throw new Error(`explorer_adjustment_receipt_target_ambiguous:${sourceStepId}`);
    }
    const action = matchingRestores[0]?.action;
    return action?.type === 'adjustment.restore'
      ? action.target.adjustmentId
      : null;
  }

  recordProducedAdjustment(args: {
    readonly manifest: ExplorerScenarioContract;
    readonly sourceStepId: string;
    readonly exactAdjustmentId: string;
  }): void {
    const logicalTarget = this.restoreTargetForSourceStep(
      args.manifest,
      args.sourceStepId,
    );
    if (!logicalTarget) return;
    const key = `${args.manifest.scenarioId}:${logicalTarget}`;
    const existing = this.exactByLogicalTarget.get(key);
    if (existing && existing !== args.exactAdjustmentId) {
      throw new Error(`explorer_adjustment_receipt_rebound:${logicalTarget}`);
    }
    this.exactByLogicalTarget.set(key, args.exactAdjustmentId);
  }

  /**
   * Rehydrates one logical binding from the exact receipt stored on the
   * manifest-declared baseline step's TraceV2 chain. This survives a process
   * reload without searching the adjustment ledger by wording, date or order.
   */
  hydrateFromPriorTraceChain(args: {
    readonly manifest: ExplorerScenarioContract;
    readonly logicalAdjustmentId: string;
    readonly priorActionTraceId: string | null;
  }): string | null {
    const restoreStep = args.manifest.steps.find((step) =>
      step.action.type === 'adjustment.restore' &&
      step.action.target.adjustmentId === args.logicalAdjustmentId);
    const baselineOracle = restoreStep?.oracleAssertions.find((oracle) =>
      oracle.type === 'restoration-equality');
    if (!baselineOracle || baselineOracle.type !== 'restoration-equality') return null;

    let traceId = args.priorActionTraceId;
    const visited = new Set<string>();
    while (traceId && !visited.has(traceId)) {
      visited.add(traceId);
      const trace = getAthleteActionTraceV2(traceId);
      if (!trace) return null;
      const scenarioId = trace.root.scenarioRunId.status === 'captured'
        ? trace.root.scenarioRunId.value
        : null;
      const stepId = trace.root.scenarioStepId.status === 'captured'
        ? trace.root.scenarioStepId.value
        : null;
      if (scenarioId === args.manifest.scenarioId &&
        stepId === baselineOracle.baselineStepId) {
        const observation = trace.evidence.uiObservation.status === 'captured'
          ? trace.evidence.uiObservation.value
          : null;
        const domainReturn = observation?.domainReturn.status === 'captured'
          ? observation.domainReturn.value
          : null;
        const target = domainReturn && typeof domainReturn === 'object' &&
          !Array.isArray(domainReturn)
          ? (domainReturn as Record<string, unknown>).resolvedCanonicalTarget
          : null;
        const exactAdjustmentId = target && typeof target === 'object' &&
          !Array.isArray(target)
          ? (target as Record<string, unknown>).producedAdjustmentId
          : null;
        if (typeof exactAdjustmentId !== 'string' || exactAdjustmentId.length === 0) {
          return null;
        }
        this.recordProducedAdjustment({
          manifest: args.manifest,
          sourceStepId: baselineOracle.baselineStepId,
          exactAdjustmentId,
        });
        return exactAdjustmentId;
      }
      traceId = trace.root.priorActionTraceId.status === 'captured'
        ? trace.root.priorActionTraceId.value
        : null;
    }
    return null;
  }

  resolveExactAdjustmentId(
    scenarioId: string,
    logicalAdjustmentId: string,
  ): string | null {
    return this.exactByLogicalTarget.get(
      `${scenarioId}:${logicalAdjustmentId}`,
    ) ?? null;
  }

  clear(): void {
    this.exactByLogicalTarget.clear();
  }
}

function visibleWeeksForDates(dates: readonly string[]): ResolvedDay[] {
  const state = useProgramStore.getState();
  const weekStarts = Array.from(new Set(dates.map(getMondayForDate))).sort();
  return weekStarts.flatMap((mondayISO) => buildProgramTabProjectedWeek({
    mondayISO,
    todayISO: todayISOLocal(),
    state: buildScheduleStateImperative(),
    overrideContexts: state.overrideContexts,
  }));
}

function componentScopeFromSeed(
  seed: DevE2ESeed,
  action: ExplorerActionFor<'component.delete'>,
): PlanChangeBinScopeId {
  const witness = seed.witnesses.find((candidate) =>
    candidate.kind === 'component_identity' &&
    candidate.date === action.args.date &&
    candidate.workoutId === action.target.sessionId &&
    candidate.identity === action.target.componentId);
  if (!witness || witness.kind !== 'component_identity') {
    throw new Error(`explorer_component_seed_identity_missing:${action.target.componentId}`);
  }
  if (witness.componentId === 'strength' || witness.componentId === 'strength:pull') {
    return 'strength';
  }
  if (witness.componentId === 'conditioning' || witness.componentId === 'finisher') {
    return 'conditioning';
  }
  if (witness.componentId === 'recovery' || witness.componentId === 'recovery_addon') {
    return 'recovery';
  }
  if (witness.componentId === 'team_training' || witness.componentId === 'session') {
    return 'team';
  }
  throw new Error(`explorer_component_scope_unsupported:${witness.componentId}`);
}

function resolveAthleteTarget(
  action: ExplorerActionFor<'session.move' | 'session.delete' | 'component.delete'>,
  seed: DevE2ESeed,
): ExplorerResolvedProductionTarget {
  const dates = action.type === 'session.move'
    ? [action.args.fromDate, action.args.toDate]
    : [action.args.date];
  const visibleWeek = visibleWeeksForDates(dates);
  let change: PlanChange;
  if (action.type === 'session.move') {
    change = {
      kind: 'move_session',
      fromDate: action.args.fromDate,
      toDate: action.args.toDate,
    };
  } else if (action.type === 'session.delete') {
    change = { kind: 'remove_session', date: action.args.date, scope: 'whole_day' };
  } else {
    change = {
      kind: 'remove_session',
      date: action.args.date,
      scope: componentScopeFromSeed(seed, action),
    };
  }
  const athleteMutation = resolveAthleteMutation({
    change,
    visibleWeek,
    source: 'tap',
  });
  if (!athleteMutation.ok) {
    throw new Error(`explorer_athlete_target_resolution_failed:${athleteMutation.error}`);
  }
  const sessionId = action.target.sessionId;
  const original = athleteMutation.input.originalWorkout ??
    ('originalSourceWorkout' in athleteMutation.input
      ? athleteMutation.input.originalSourceWorkout
      : null);
  if (!original || original.id !== sessionId) {
    throw new Error(`explorer_session_seed_identity_mismatch:${sessionId}`);
  }
  return {
    canonicalSemanticIdentity: action.type === 'component.delete'
      ? action.target.componentId
      : sessionId,
    seed,
    visibleWeek,
    athleteMutation,
  };
}

function defaultResolveTarget(
  action: ExplorerExecutableAction,
  context: ExplorerProductionAdapterContext,
  adjustments: ExplorerAdjustmentReceiptRegistry,
): ExplorerResolvedProductionTarget {
  const manifest = manifestForClaim(context);
  const seed = buildDevE2ESeed(manifest.seedId as Parameters<typeof buildDevE2ESeed>[0]);
  switch (action.type) {
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove': {
      const sourceDate = action.type === 'fixture.move'
        ? action.args.fromDate
        : action.type === 'fixture.remove' ? action.args.date : action.args.date;
      const fixtureWitness = seed.witnesses.find((witness) =>
        witness.kind === 'fixture_identity' && witness.date === sourceDate);
      if (action.type !== 'fixture.add' &&
        (!fixtureWitness || fixtureWitness.kind !== 'fixture_identity' ||
          fixtureWitness.workoutId !== action.target.fixtureId)) {
        throw new Error(`explorer_fixture_seed_identity_mismatch:${action.target.fixtureId}`);
      }
      return {
        canonicalSemanticIdentity: fixtureWitness?.kind === 'fixture_identity'
          ? fixtureWitness.workoutId
          : action.target.fixtureId,
        seed,
      };
    }
    case 'session.move':
    case 'session.delete':
    case 'component.delete':
      return resolveAthleteTarget(action, seed);
    case 'injury.set':
    case 'injury.resolve': {
      const expected = seed.witnesses.find((witness) =>
        witness.kind === 'active_injury' &&
        witness.episodeId === action.target.injuryEpisodeId);
      const actual = useProgramStore.getState().acceptedMaterialContext.injuryEpisodes
        .find((episode) => episode.episodeId === action.target.injuryEpisodeId);
      if (!expected || !actual) {
        throw new Error(`explorer_injury_seed_identity_missing:${action.target.injuryEpisodeId}`);
      }
      return {
        canonicalSemanticIdentity: actual.episodeId,
        seed,
      };
    }
    case 'adjustment.restore': {
      const exactAdjustmentId = adjustments.resolveExactAdjustmentId(
        context.claim.scenarioId,
        action.target.adjustmentId,
      ) ?? adjustments.hydrateFromPriorTraceChain({
        manifest,
        logicalAdjustmentId: action.target.adjustmentId,
        priorActionTraceId: context.claim.priorActionTraceId,
      });
      if (!exactAdjustmentId) {
        throw new Error(`explorer_exact_adjustment_receipt_missing:${action.target.adjustmentId}`);
      }
      const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
        .find((entry) => entry.id === exactAdjustmentId);
      if (!adjustment) {
        throw new Error(`explorer_exact_adjustment_not_active:${exactAdjustmentId}`);
      }
      return {
        canonicalSemanticIdentity: exactAdjustmentId,
        seed,
        exactAdjustmentId,
        adjustmentKind: adjustment.kind,
      };
    }
    case 'week.repeat':
      if (action.target.weekId !== action.args.sourceWeekStart) {
        throw new Error(`explorer_week_seed_identity_mismatch:${action.target.weekId}`);
      }
      return { canonicalSemanticIdentity: action.target.weekId, seed };
    case 'readiness.set':
    case 'readiness.clear':
      if (action.target.readinessId !== `readiness-${action.args.date}`) {
        throw new Error(`explorer_readiness_identity_mismatch:${action.target.readinessId}`);
      }
      return { canonicalSemanticIdentity: action.target.readinessId, seed };
    case 'equipment.set':
    case 'equipment.clear': {
      const fact = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
        .find((candidate) => 'factId' in candidate &&
          candidate.factId === action.target.equipmentFactId);
      if (!fact || !('factId' in fact)) {
        throw new Error(
          `explorer_equipment_seed_identity_missing:${action.target.equipmentFactId}`,
        );
      }
      return { canonicalSemanticIdentity: fact.factId, seed };
    }
    case 'session-feedback.record': {
      const target = resolveSessionOutcomeTarget(action.args.date, action.args.date);
      if (target.workout.id !== action.target.sessionId) {
        throw new Error(`explorer_feedback_session_identity_mismatch:${action.target.sessionId}`);
      }
      return { canonicalSemanticIdentity: action.target.feedbackId, seed };
    }
  }
}

function jsonValue(value: unknown): ExplorerJsonValue {
  const normalized = JSON.stringify(value, (_key, entry) => {
    if (entry instanceof Error) {
      return { name: entry.name, message: entry.message };
    }
    return entry === undefined ? null : entry;
  });
  return normalized === undefined
    ? null
    : JSON.parse(normalized) as ExplorerJsonValue;
}

function statusForFixture(result: FixtureMutationTransactionResult): ExplorerProductionReceiptStatus {
  return mapExplorerCanonicalOutcome({
    outcome: result.outcome,
    applied: ['accepted', 'minimal_repair', 'relocated', 'reduced'],
    noChange: ['no_change'],
    conflicts: ['conflicted'],
  });
}

function producedAdjustmentFromDiff(beforeIds: ReadonlySet<string>): string | null {
  const created = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .filter((adjustment) => !beforeIds.has(adjustment.id));
  if (created.length > 1) {
    throw new Error(`explorer_production_created_multiple_adjustments:${created.length}`);
  }
  return created[0]?.id ?? null;
}

function readinessPatch(action: ExplorerActionFor<'readiness.set'>) {
  const energy = action.args.fatigue >= 3
    ? 'low' as const
    : action.args.fatigue === 2 ? 'okay' as const : 'good' as const;
  const soreness = action.args.soreness >= 3
    ? 'high' as const
    : action.args.soreness === 2 ? 'moderate' as const : 'none' as const;
  return {
    energy,
    soreness,
    flatToday: energy === 'low',
    painFlag: soreness === 'high',
    ...(action.args.sleepQuality <= 1
      ? { poorSleepPattern: 'single_night' as const }
      : {}),
    source: 'quick_check' as const,
  };
}

function equipmentTags(ids: readonly string[]): EquipmentTag[] {
  return Array.from(new Set(ids.map((id) =>
    id === 'dumbbell' ? 'dumbbells' : id)))
    .filter((id): id is EquipmentTag => EQUIPMENT_TAGS.has(id as EquipmentTag));
}

function feedbackValues(action: ExplorerActionFor<'session-feedback.record'>) {
  const completion = action.args.completion === 'not-completed'
    ? 'skipped' as const
    : action.args.completion;
  const feeling = action.args.feeling === 'very-easy'
    ? 'very_easy' as const
    : action.args.feeling === 'manageable'
      ? 'good' as const
      : action.args.feeling === 'too-hard' ? 'very_hard' as const : 'hard' as const;
  const soreness = action.args.soreness === 'severe'
    ? 'high' as const
    : action.args.soreness;
  return { completion, feeling, soreness };
}

async function defaultInvokeCanonicalOwner(
  action: ExplorerExecutableAction,
  target: ExplorerResolvedProductionTarget,
  acceptedRevision: number,
  trace: AthleteActionTraceContext,
): Promise<ExplorerCanonicalOwnerExecution> {
  const beforeAdjustmentIds = new Set(useProgramStore.getState()
    .reversibleAdjustmentLedger.adjustments.map((adjustment) => adjustment.id));
  switch (action.type) {
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove': {
      const profile = useProfileStore.getState().onboardingData;
      if (!profile) throw new Error('explorer_fixture_profile_missing');
      const fixtureKind = action.type === 'fixture.add'
        ? action.args.fixtureKind === 'practice-match' ? 'practice_match' : 'game'
        : canonicalFixtureKind(profile);
      const result = await executeFixtureMutationTransaction({
        action: action.type.split('.')[1] as 'add' | 'move' | 'remove',
        fixtureKind,
        ...(action.type === 'fixture.move'
          ? { sourceDate: action.args.fromDate, targetDate: action.args.toDate }
          : action.type === 'fixture.add'
            ? { targetDate: action.args.date }
            : { sourceDate: action.args.date }),
        expectedAcceptedRevision: acceptedRevision,
        todayISO: todayISOLocal(),
        source: {
          requestedBy: 'athlete',
          producer: 'tap',
          surface: 'program_tab',
          commandId: `explorer:${trace.scenarioRunId}:${trace.scenarioStepId}`,
        },
        trace,
      });
      const producedAdjustmentId = 'result' in result
        ? result.result.reversibleAdjustmentId ?? null
        : null;
      return {
        status: statusForFixture(result),
        reasonCode: 'reason' in result ? result.reason : null,
        canonicalReceipt: jsonValue({
          outcome: result.outcome,
          acceptedRevision: result.acceptedRevision,
          traceId: result.traceId,
          noteId: result.noteId,
          reversibleAdjustmentId: producedAdjustmentId,
        }),
        producedAdjustmentId,
      };
    }
    case 'session.move': {
      if (!target.athleteMutation || target.athleteMutation.kind !== 'move_session') {
        throw new Error('explorer_session_move_target_invalid');
      }
      const result = commitAthleteSessionMoveTransaction(target.athleteMutation.input);
      const producedAdjustmentId = producedAdjustmentFromDiff(beforeAdjustmentIds);
      return {
        status: result.context.revision > acceptedRevision ? 'applied' : 'no-change',
        reasonCode: result.context.revision > acceptedRevision ? null : 'session_move_no_change',
        canonicalReceipt: jsonValue({
          acceptedRevision: result.context.revision,
          reversibleAdjustmentId: producedAdjustmentId,
        }),
        producedAdjustmentId,
      };
    }
    case 'session.delete':
    case 'component.delete': {
      if (!target.athleteMutation || target.athleteMutation.kind !== 'remove_session') {
        throw new Error('explorer_session_delete_target_invalid');
      }
      const result = commitAthleteSessionDeletionTransaction(target.athleteMutation.input);
      const producedAdjustmentId = producedAdjustmentFromDiff(beforeAdjustmentIds);
      return {
        status: result.context.revision > acceptedRevision ? 'applied' : 'no-change',
        reasonCode: result.context.revision > acceptedRevision ? null : 'session_delete_no_change',
        canonicalReceipt: jsonValue({
          acceptedRevision: result.context.revision,
          deletionOutcome: result.deletionOutcome,
          reversibleAdjustmentId: producedAdjustmentId,
        }),
        producedAdjustmentId,
      };
    }
    case 'injury.set': {
      const existing = useProgramStore.getState().acceptedMaterialContext.injuryEpisodes
        .find((episode) => episode.episodeId === action.target.injuryEpisodeId);
      if (!existing) throw new Error('explorer_injury_episode_missing');
      const expectedPart = `${action.args.laterality} ${action.args.bodyRegionId}`
        .replace('not-applicable ', '')
        .toLowerCase();
      if (!existing.bodyPart.toLowerCase().includes(action.args.bodyRegionId.toLowerCase()) ||
        (action.args.laterality !== 'not-applicable' &&
          !existing.bodyPart.toLowerCase().includes(action.args.laterality))) {
        throw new Error(`explorer_injury_target_mismatch:${expectedPart}`);
      }
      const severity = action.args.severity === 'minor'
        ? 2
        : action.args.severity === 'moderate' ? 7 : 9;
      const result = await updateInjuryEpisode({
        episodeId: action.target.injuryEpisodeId,
        severity,
        status: 'active',
        sourceActor: 'athlete',
        sourceSurface: 'explorer_runtime',
        todayISO: action.args.effectiveDate,
        expectedAcceptedRevision: acceptedRevision,
        trace,
      });
      return {
        status: mapExplorerCanonicalOutcome({
          outcome: result.outcome,
          applied: [
            'created_and_recomposed', 'created_no_program_change',
            'updated_and_recomposed', 'updated_no_program_change',
          ],
          conflicts: ['conflicted'],
          rejected: ['safely_rejected'],
        }),
        reasonCode: result.reason ?? null,
        canonicalReceipt: jsonValue(result),
      };
    }
    case 'injury.resolve': {
      const result = await resolveInjuryEpisode(action.target.injuryEpisodeId, {
        sourceActor: 'athlete',
        sourceSurface: 'explorer_runtime',
        todayISO: action.args.resolvedDate,
        expectedAcceptedRevision: acceptedRevision,
        trace,
      });
      return {
        status: mapExplorerCanonicalOutcome({
          outcome: result.outcome,
          applied: ['resolved_and_recomposed', 'resolved_no_program_change'],
          noChange: ['already_resolved'],
          conflicts: ['conflicted'],
          rejected: ['safely_rejected'],
        }),
        reasonCode: result.reason ?? (
          result.outcome === 'already_resolved' ? 'injury_already_resolved' : null
        ),
        canonicalReceipt: jsonValue(result),
      };
    }
    case 'readiness.set':
    case 'readiness.clear': {
      const result = commitReadinessSignalTransaction({
        date: action.args.date,
        patch: action.type === 'readiness.set' ? readinessPatch(action) : null,
      });
      return {
        status: result.context.revision > acceptedRevision ? 'applied' : 'no-change',
        reasonCode: result.context.revision > acceptedRevision ? null : 'readiness_no_change',
        canonicalReceipt: jsonValue({
          date: action.args.date,
          acceptedRevision: result.context.revision,
          lastTransaction: result.context.lastTransaction,
        }),
      };
    }
    case 'equipment.set': {
      const tags = equipmentTags(action.args.availableEquipmentIds);
      if (tags.length === 0) {
        return {
          status: 'rejected',
          reasonCode: 'equipment_tags_missing',
          canonicalReceipt: { factId: action.target.equipmentFactId },
        };
      }
      const fact = createTemporaryEquipmentFact({
        observedDate: action.args.fromDate,
        scope: {
          from: action.args.fromDate,
          until: action.args.toDate ?? action.args.fromDate,
        },
        mode: 'only',
        equipmentTags: tags,
        sourceActor: 'athlete',
        sourceSurface: 'explorer_runtime',
        factId: action.target.equipmentFactId,
      });
      const result = await transactTemporarySourceFact({
        operation: useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
          .some((candidate) => 'factId' in candidate &&
            candidate.factId === action.target.equipmentFactId)
          ? 'update'
          : 'create',
        fact,
        factId: action.target.equipmentFactId,
        todayISO: action.args.fromDate,
        sourceActor: 'athlete',
        sourceSurface: 'explorer_runtime',
        expectedAcceptedRevision: acceptedRevision,
      });
      return {
        status: mapExplorerCanonicalOutcome({
          outcome: result.outcome,
          applied: [
            'created_and_recomposed', 'created_no_program_change',
            'updated_and_recomposed', 'updated_no_program_change',
          ],
          noChange: ['no_op'],
          conflicts: ['conflicted'],
          rejected: ['safely_rejected'],
        }),
        reasonCode: result.reason ?? (result.outcome === 'no_op' ? 'equipment_no_op' : null),
        canonicalReceipt: jsonValue(result),
      };
    }
    case 'equipment.clear': {
      const result = await transactTemporarySourceFact({
        operation: 'resolve',
        factId: action.target.equipmentFactId,
        todayISO: action.args.clearedOn,
        sourceActor: 'athlete',
        sourceSurface: 'explorer_runtime',
        expectedAcceptedRevision: acceptedRevision,
      });
      return {
        status: mapExplorerCanonicalOutcome({
          outcome: result.outcome,
          applied: ['resolved_and_recomposed', 'resolved_no_program_change'],
          noChange: ['no_op'],
          conflicts: ['conflicted'],
          rejected: ['safely_rejected'],
        }),
        reasonCode: result.reason ?? (result.outcome === 'no_op' ? 'equipment_no_op' : null),
        canonicalReceipt: jsonValue(result),
      };
    }
    case 'session-feedback.record': {
      const values = feedbackValues(action);
      const targetSession = resolveSessionOutcomeTarget(action.args.date, action.args.date);
      const intent = createRecordSessionOutcomeIntentFromFeedback({
        date: action.args.date,
        workout: targetSession.workout,
        feedback: {
          dateStr: action.args.date,
          completion: values.completion,
          feeling: values.completion === 'skipped' ? null : values.feeling,
          soreness: values.completion === 'skipped' ? null : values.soreness,
          ...(values.completion === 'partial' ? { partialReason: 'other' as const } : {}),
          ...(values.completion === 'skipped' ? { skipReason: 'other' as const } : {}),
          difficulty: action.args.difficulty,
        },
        source: {
          entryPoint: 'tap',
          surface: 'explorer_runtime',
          interpretedIntent: 'record_session_outcome',
          traceId: trace.traceId,
        },
        todayISO: action.args.date,
      });
      const result = await commitSessionOutcomeTransaction(intent);
      if (!result.ok) {
        return {
          status: 'rejected',
          reasonCode: result.code,
          canonicalReceipt: jsonValue(result),
        };
      }
      const progression = deriveFutureProgressionRenderTarget({
        program: useProgramStore.getState().currentProgram,
        receipt: result.receipt,
      });
      return {
        status: result.status === 'committed' ? 'applied' : 'no-change',
        reasonCode: result.status === 'committed' ? null : 'session_feedback_idempotent',
        canonicalReceipt: jsonValue({
          status: result.status,
          receipt: result.receipt,
          persistedEnvelopeFingerprint: semanticFingerprintV2(result.persistedEnvelope),
        }),
        feedbackTransactionId: result.receipt.transactionId,
        progressionTargetSessionId: progression?.targetSessionId ?? null,
      };
    }
    case 'adjustment.restore': {
      if (!target.exactAdjustmentId) {
        throw new Error('explorer_restore_exact_adjustment_id_missing');
      }
      const result = await clearReversibleAdjustment(
        target.exactAdjustmentId,
        acceptedRevision,
        trace,
      );
      return {
        status: mapExplorerCanonicalOutcome({
          outcome: result.outcome,
          applied: ['restored', 'recomposed'],
          noChange: ['already-cleared'],
          conflicts: ['conflicted'],
          rejected: ['superseded', 'safely-rejected'],
        }),
        reasonCode: result.reason ?? (
          result.outcome === 'already-cleared' ? 'adjustment_already_cleared' : null
        ),
        canonicalReceipt: jsonValue(result),
        exactAdjustmentId: target.exactAdjustmentId,
        adjustmentKind: target.adjustmentKind ?? null,
      };
    }
    case 'week.repeat': {
      const profile = useProfileStore.getState().onboardingData;
      if (!profile) throw new Error('explorer_repeat_profile_missing');
      const result = await repeatWeekIntoNextWeek({
        baseProfile: profile,
        sourceWeekDate: action.args.sourceWeekStart,
        todayISO: action.args.sourceWeekStart,
        expectedAcceptedRevision: acceptedRevision,
        trace,
      });
      if (result.targetWeekStart !== action.args.targetWeekStart) {
        throw new Error('explorer_repeat_target_week_mismatch');
      }
      return {
        status: 'applied',
        reasonCode: null,
        canonicalReceipt: jsonValue({
          sourceWeekStart: result.sourceWeekStart,
          targetWeekStart: result.targetWeekStart,
          adjustmentId: result.adjustmentId,
          acceptedRevision: result.acceptedRevision,
          observationId: result.observationId ?? null,
        }),
        producedAdjustmentId: result.adjustmentId,
      };
    }
  }
}

const DEFAULT_DEPENDENCIES: ExplorerProductionBindingDependencies = {
  readAcceptedRevision: () =>
    useProgramStore.getState().acceptedMaterialContext.revision,
  readDurableEnvelope: readDurableProgramStoreEnvelope,
  waitForPersistence: async () => {
    const expected = captureDevE2EMemoryFingerprints();
    await waitForDevE2EPersistence(expected);
  },
  resolveTarget: defaultResolveTarget,
  invokeCanonicalOwner: defaultInvokeCanonicalOwner,
};

function diagnosticActionType(action: ExplorerExecutableAction): AthleteActionType {
  switch (action.type) {
    case 'fixture.add':
    case 'fixture.move':
    case 'fixture.remove':
      return action.type === 'fixture.add' && action.args.fixtureKind === 'practice-match'
        ? 'practice_match_change'
        : 'game_day_change';
    case 'session.move': return 'move_session';
    case 'session.delete': return 'delete_session';
    case 'component.delete': return 'delete_component';
    case 'injury.set':
    case 'injury.resolve': return 'injury_change';
    case 'readiness.set':
    case 'readiness.clear': return 'readiness_change';
    case 'equipment.set':
    case 'equipment.clear': return 'equipment_change';
    case 'session-feedback.record': return 'session_feedback';
    case 'adjustment.restore': return 'clear_adjustment';
    case 'week.repeat': return 'repeat_week';
  }
}

function actionDates(action: ExplorerExecutableAction): {
  sourceDate?: string;
  targetDate?: string;
} {
  switch (action.type) {
    case 'fixture.move':
    case 'session.move':
      return { sourceDate: action.args.fromDate, targetDate: action.args.toDate };
    case 'fixture.add': return { targetDate: action.args.date };
    case 'fixture.remove': return { sourceDate: action.args.date };
    case 'session.delete':
    case 'component.delete':
    case 'readiness.set':
    case 'readiness.clear':
    case 'session-feedback.record': return { sourceDate: action.args.date };
    case 'injury.set': return { sourceDate: action.args.effectiveDate };
    case 'injury.resolve': return { sourceDate: action.args.resolvedDate };
    case 'equipment.set': return {
      sourceDate: action.args.fromDate,
      targetDate: action.args.toDate ?? undefined,
    };
    case 'equipment.clear': return { sourceDate: action.args.clearedOn };
    case 'adjustment.restore': return { sourceDate: action.args.restoredOn };
    case 'week.repeat': return {
      sourceDate: action.args.sourceWeekStart,
      targetDate: action.args.targetWeekStart,
    };
  }
}

function traceFor(
  action: ExplorerExecutableAction,
  context: ExplorerProductionAdapterContext,
  target: ExplorerResolvedProductionTarget,
): AthleteActionTraceContext {
  const manifest = manifestForClaim(context);
  const step = manifest.steps.find((candidate) => candidate.stepId === context.claim.stepId)!;
  const dates = actionDates(action);
  return beginAthleteActionTrace({
    source: 'tap',
    actionType: diagnosticActionType(action),
    route: `explorer_production_binding:${action.type}`,
    campaignId: context.claim.campaignId,
    scenarioRunId: manifest.scenarioId,
    scenarioStepId: step.stepId,
    seedId: manifest.seedId,
    priorActionTraceId: context.claim.priorActionTraceId,
    controlId: step.controlTestId,
    sourceDate: dates.sourceDate,
    targetDate: dates.targetDate,
    sessionDate: dates.sourceDate ?? dates.targetDate,
    scope: action.type,
    fixtureId: action.target.kind === 'fixture'
      ? target.canonicalSemanticIdentity
      : null,
    workoutId: action.target.kind === 'session' || action.target.kind === 'component'
      ? action.target.sessionId
      : null,
    componentId: action.target.kind === 'component'
      ? action.target.componentId
      : null,
    injuryEpisodeId: action.target.kind === 'injury-episode'
      ? action.target.injuryEpisodeId
      : null,
    adjustmentId: target.exactAdjustmentId ?? null,
    canonicalTargetIds: explorerCanonicalTargetIds(action),
  }, undefined, {
    forceRoot: true,
    rootActionType: action.type,
    rootSourceSurface: step.ingress,
  });
}

function receiptId(args: {
  action: ExplorerExecutableAction;
  acceptedRevisionBefore: number;
  acceptedRevisionAfter: number;
  status: ExplorerProductionReceiptStatus;
}): string {
  return `explorer-production:${semanticFingerprintV2({
    actionSemanticHash: explorerActionSemanticHash(args.action),
    acceptedRevisionBefore: args.acceptedRevisionBefore,
    acceptedRevisionAfter: args.acceptedRevisionAfter,
    status: args.status,
    owner: EXPLORER_PRODUCTION_OWNER_BY_ACTION[args.action.type],
  }).slice(-24)}`;
}

async function invokeBinding<TActionType extends ExplorerExecutableActionType>(
  action: ExplorerActionFor<TActionType>,
  context: ExplorerProductionAdapterContext,
  deps: ExplorerProductionBindingDependencies,
  adjustments: ExplorerAdjustmentReceiptRegistry,
): Promise<ExplorerProductionOwnerResult<TActionType>> {
  const executable = action as ExplorerExecutableAction;
  const capturedRevision = deps.readAcceptedRevision();
  if (capturedRevision !== context.claim.expectedAcceptedRevision) {
    throw new Error(
      `accepted_revision_mismatch:${context.claim.expectedAcceptedRevision}:${capturedRevision}`,
    );
  }
  const target = deps.resolveTarget(executable, context, adjustments);
  const trace = traceFor(executable, context, target);
  const beforeEnvelope = await deps.readDurableEnvelope();
  recordAthleteActionBeforeV2({
    trace,
    semantic: captureAcceptedAthleteSemanticSnapshotV2(),
    visibleCard: { canonicalSemanticIdentity: target.canonicalSemanticIdentity },
    visibleDetail: { canonicalSemanticIdentity: target.canonicalSemanticIdentity },
    persistedEnvelope: beforeEnvelope,
  });
  athleteActionTraceCoordinator.recordPersistence(trace, {
    operation: 'read_before',
    store: 'program-store',
    attempted: true,
    acknowledged: true,
    expectedFingerprint: capturedTraceField(semanticFingerprintV2(beforeEnvelope)),
    actualFingerprint: capturedTraceField(semanticFingerprintV2(beforeEnvelope)),
  });

  let execution: ExplorerCanonicalOwnerExecution;
  try {
    execution = await runWithAthleteActionTrace(trace, () =>
      deps.invokeCanonicalOwner(executable, target, capturedRevision, trace));
  } catch (error) {
    const reasonCode = (error as { code?: string })?.code ??
      (error instanceof Error ? error.message : 'production_owner_failed');
    emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
      published: false,
      previousStateRestored: true,
      acceptedStateVersion: deps.readAcceptedRevision(),
      internalResultCode: reasonCode,
    });
    emitAthleteActionEvent(trace, 'athlete_action_failed', {
      outcome: 'failed',
      internalResultCode: reasonCode,
      originalRejectionCode: reasonCode,
      previousStateRestored: true,
    });
    execution = {
      status: 'failure',
      reasonCode,
      canonicalReceipt: { error: reasonCode },
    };
  }

  await deps.waitForPersistence();
  const afterEnvelope = await deps.readDurableEnvelope();
  const acceptedRevisionAfter = deps.readAcceptedRevision();
  recordAthleteActionAfterV2({
    trace,
    semantic: captureAcceptedAthleteSemanticSnapshotV2(),
    visibleCard: { canonicalSemanticIdentity: target.canonicalSemanticIdentity },
    visibleDetail: { canonicalSemanticIdentity: target.canonicalSemanticIdentity },
  });
  athleteActionTraceCoordinator.recordPersistence(trace, {
    operation: 'readback',
    store: 'program-store',
    attempted: true,
    acknowledged: true,
    expectedFingerprint: capturedTraceField(semanticFingerprintV2(afterEnvelope)),
    actualFingerprint: capturedTraceField(semanticFingerprintV2(afterEnvelope)),
  });
  emitAthleteActionEvent(
    trace,
    execution.status === 'applied' || execution.status === 'no-change'
      ? 'athlete_action_completed'
      : 'athlete_action_failed',
    execution.status === 'applied' || execution.status === 'no-change'
      ? {
          outcome: execution.status,
          acceptedStateVersion: acceptedRevisionAfter,
        }
      : {
          outcome: execution.status,
          internalResultCode: execution.reasonCode ?? `production_${execution.status}`,
          previousStateRestored: acceptedRevisionAfter === capturedRevision,
        },
  );

  if (execution.producedAdjustmentId && execution.status === 'applied') {
    adjustments.recordProducedAdjustment({
      manifest: manifestForClaim(context),
      sourceStepId: context.claim.stepId,
      exactAdjustmentId: execution.producedAdjustmentId,
    });
  }

  let renderExpectation: ExplorerRenderExpectation | null = null;
  if (execution.status === 'applied') {
    const step = manifestForClaim(context).steps.find((candidate) =>
      candidate.stepId === context.claim.stepId)!;
    renderExpectation = bindExplorerRenderExpectationToManifestStep(
      buildExplorerRenderExpectation({
        action: executable,
        traceV2RootId: trace.traceId,
        canonicalSemanticIdentity: target.canonicalSemanticIdentity,
        producedAdjustmentId: execution.producedAdjustmentId,
        exactAdjustmentId: execution.exactAdjustmentId ?? target.exactAdjustmentId,
        adjustmentKind: execution.adjustmentKind ?? target.adjustmentKind,
        feedbackTransactionId: execution.feedbackTransactionId,
        progressionTargetSessionId: execution.progressionTargetSessionId,
      }),
      step,
    );
  }
  const productionReceipt = jsonValue({
    canonicalOwnerReceipt: execution.canonicalReceipt,
    resolvedCanonicalTarget: {
      logicalTarget: executable.target,
      canonicalSemanticIdentity: target.canonicalSemanticIdentity,
      exactAdjustmentId: execution.exactAdjustmentId ?? target.exactAdjustmentId ?? null,
      producedAdjustmentId: execution.producedAdjustmentId ?? null,
    },
    acceptedFingerprint: semanticFingerprintV2(captureDevE2EMemoryFingerprints()),
    persistedEnvelopeFingerprint: semanticFingerprintV2(afterEnvelope),
    explorerRenderExpectation: renderExpectation,
  });
  if (renderExpectation) {
    registerExplorerRenderExpectation(renderExpectation, productionReceipt);
  }
  return {
    actionType: action.type,
    actionSemanticHash: explorerActionSemanticHash(action),
    target: action.target,
    status: execution.status,
    owner: EXPLORER_PRODUCTION_OWNER_BY_ACTION[action.type],
    receiptId: receiptId({
      action: executable,
      acceptedRevisionBefore: capturedRevision,
      acceptedRevisionAfter,
      status: execution.status,
    }),
    traceV2RootId: trace.traceId,
    acceptedRevisionBefore: capturedRevision,
    acceptedRevisionAfter,
    reasonCode: execution.status === 'applied'
      ? null
      : execution.reasonCode ?? `production_${execution.status}`,
    durable: true,
    productionReceipt,
  } as ExplorerProductionOwnerResult<TActionType>;
}

export interface ExplorerProductionBindings {
  readonly actionBridge: ExplorerActionBridge;
  readonly adapters: ExplorerProductionActionAdapters;
  readonly adjustmentReceipts: ExplorerAdjustmentReceiptRegistry;
}

export function createExplorerProductionBindings(args: {
  readonly dependencies?: Partial<ExplorerProductionBindingDependencies>;
  readonly adjustmentReceipts?: ExplorerAdjustmentReceiptRegistry;
} = {}): ExplorerProductionBindings {
  const deps: ExplorerProductionBindingDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...(args.dependencies ?? {}),
  };
  const adjustmentReceipts = args.adjustmentReceipts ??
    new ExplorerAdjustmentReceiptRegistry();
  const adapters = Object.fromEntries(EXPLORER_BOUND_ACTION_TYPES.map((actionType) => [
    actionType,
    {
      actionType,
      owner: EXPLORER_PRODUCTION_OWNER_BY_ACTION[actionType],
      invokeProductionOwner: (
        action: ExplorerActionFor<typeof actionType>,
        context: ExplorerProductionAdapterContext,
      ) => invokeBinding(action, context, deps, adjustmentReceipts),
    },
  ])) as unknown as ExplorerProductionActionAdapters;
  return {
    adapters,
    actionBridge: createExplorerActionBridge(adapters),
    adjustmentReceipts,
  };
}
