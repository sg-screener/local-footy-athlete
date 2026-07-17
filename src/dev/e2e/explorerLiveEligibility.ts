import { temporarySourceFactId } from '../../rules/temporarySourceFact';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { getSessionComponents } from '../../utils/sessionComponents';
import { semanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  failClosedDevE2EScenarioEligibility,
  type DevE2EScenarioEligibilityContext,
  type DevE2EScenarioEligibilityDecision,
} from './devE2EScenarioProtocol';
import {
  devE2EAcceptedSemanticFingerprint,
  type DevE2EScenarioSessionRecord,
} from './devE2EScenarioSession';
import {
  captureDevE2EMemoryFingerprints,
  fingerprintMapsMatch,
  readDevE2EPersistedFingerprints,
} from './devE2EPersistence';
import {
  evaluateExplorerStepEligibility,
  type ExplorerEligibilityWitnessState,
} from './explorerEligibility';
import { ExplorerAdjustmentReceiptRegistry } from './explorerProductionBindings';
import {
  explorerScenarioSemanticHash,
} from './explorerScenarioContractValidation';
import type {
  ExplorerScenarioContract,
  ExplorerScenarioStep,
} from './explorerScenarioContracts';
import { resolveExplorerSmokeScenarioManifest } from './explorerSmokeScenarioManifests';
import { readDevE2EWitnessState } from './defaultDevE2ESeedCoordinator';
import {
  buildDevE2ESeed,
  validateDevE2EWitnesses,
} from './devE2ESeedRegistry';

function sessionDateMap(state: ReturnType<typeof readDevE2EWitnessState>) {
  return Object.entries(state.visibleCardDays ?? {}).flatMap(([date, value]) => {
    const day = value as { workout?: { id?: string } | null };
    return day.workout?.id ? [{ id: day.workout.id, date }] : [];
  });
}

function componentMap(state: ReturnType<typeof readDevE2EWitnessState>) {
  return Object.entries(state.visibleDetailDays ?? {}).flatMap(([date, value]) => {
    const day = value as {
      workout?: {
        id?: string;
        exercises?: Array<{ id?: string }>;
        strengthIntent?: { plannedPatterns?: readonly string[] };
        strengthPatternContributions?: readonly string[];
      } | null;
    };
    const workout = day.workout;
    const sessionId = workout?.id;
    if (!workout || !sessionId) return [];
    const semanticComponents = getSessionComponents(workout as Parameters<
      typeof getSessionComponents
    >[0]).map((component) => `${sessionId}:component:${component.id}`);
    const strengthPatterns = workout.strengthIntent?.plannedPatterns ??
      workout.strengthPatternContributions ?? [];
    if (strengthPatterns.includes('pull')) {
      semanticComponents.push(`${sessionId}:component:strength:pull`);
    }
    return Array.from(new Set([
      ...(workout.exercises ?? []).flatMap((exercise) => exercise.id ? [exercise.id] : []),
      ...semanticComponents,
    ])).map((componentId) => ({ sessionId, componentId, date }));
  });
}

function visibleEqualityProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(visibleEqualityProjection);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== 'createdAt' && key !== 'updatedAt')
    .map(([key, entry]) => [key, visibleEqualityProjection(entry)]));
}

function assertRegisteredExplorerContext(args: {
  manifest: ExplorerScenarioContract;
  step: ExplorerScenarioStep;
  session: DevE2EScenarioSessionRecord;
}): void {
  const registered = resolveExplorerSmokeScenarioManifest(args.manifest.scenarioId);
  const registeredStep = registered?.steps.find((candidate) =>
    candidate.stepId === args.step.stepId);
  if (!registered || !registeredStep ||
    explorerScenarioSemanticHash(registered) !== explorerScenarioSemanticHash(args.manifest) ||
    args.session.scenarioId !== registered.scenarioId ||
    args.session.seedId !== registered.seedId ||
    args.session.nextActionEligibility.nextStepId !== registeredStep.stepId) {
    throw new Error(`explorer_live_eligibility_context_mismatch:${args.step.stepId}`);
  }
}

function buildLiveExplorerEligibilityWitnessState(args: {
  manifest: ExplorerScenarioContract;
  step: ExplorerScenarioStep;
  session: DevE2EScenarioSessionRecord;
}): ExplorerEligibilityWitnessState {
  assertRegisteredExplorerContext(args);
  const witness = readDevE2EWitnessState();
  const accepted = useProgramStore.getState().acceptedMaterialContext;
  const profile = useProfileStore.getState().onboardingData;
  const memoryFingerprints = captureDevE2EMemoryFingerprints();
  if (devE2EAcceptedSemanticFingerprint(memoryFingerprints) !==
    args.session.currentAcceptedSemanticFingerprint) {
    throw new Error(`explorer_live_eligibility_stale_session:${args.step.stepId}`);
  }

  // The seed witness report is re-evaluated at the reset boundary. Later
  // steps intentionally mutate those witnesses and are instead guarded by the
  // accepted/persisted scenario-session fingerprints.
  if (args.session.checkpointStepId === null) {
    const seed = buildDevE2ESeed(args.manifest.seedId as Parameters<
      typeof buildDevE2ESeed
    >[0]);
    const failures = validateDevE2EWitnesses(seed.id, seed.witnesses, witness);
    if (failures.length > 0) {
      throw new Error(`explorer_live_seed_witness_failed:${failures.join(',')}`);
    }
  }

  const sessions = sessionDateMap(witness);
  const adjustments = useProgramStore.getState().reversibleAdjustmentLedger.adjustments;
  const adjustmentWitnesses = adjustments.map((adjustment) => ({
    adjustmentId: adjustment.id,
    status: adjustment.status === 'active' ? 'active' as const : 'restored' as const,
  }));

  if (args.step.action.type === 'adjustment.restore') {
    const exact = new ExplorerAdjustmentReceiptRegistry().hydrateFromPriorTraceChain({
      manifest: args.manifest,
      logicalAdjustmentId: args.step.action.target.adjustmentId,
      priorActionTraceId: args.session.priorActionTraceId,
    });
    const actual = exact && adjustments.find((candidate) => candidate.id === exact);
    if (actual) {
      adjustmentWitnesses.push({
        adjustmentId: args.step.action.target.adjustmentId,
        status: actual.status === 'active' ? 'active' : 'restored',
      });
    }
  }

  const fixtureDates = Object.entries(witness.calendarMarks ?? {})
    .filter(([, mark]) => mark === 'game' || mark === 'practice_match')
    .map(([date]) => ({ id: `calendar-game-${date}`, date }));
  const activeFacts = accepted.temporarySourceFacts
    .filter((fact) => !('status' in fact) || fact.status === 'active')
    .map((fact) => ({
      sourceFactId: temporarySourceFactId(fact),
      sourceFactType: 'episodeId' in fact ? 'injury' as const : 'equipment' as const,
    }));
  const sourceFacts = [
    ...activeFacts,
    ...Object.keys(accepted.readinessSignalsByDate).map((date) => ({
      sourceFactId: `readiness-${date}`,
      sourceFactType: 'readiness' as const,
    })),
  ];
  const seasonPhase = String(profile?.seasonPhase ?? '').toLowerCase();
  const phaseSignatures = seasonPhase.includes('in')
    ? ['in-season-standard']
    : seasonPhase ? [seasonPhase.replace(/[^a-z0-9]+/g, '-')] : [];
  return {
    acceptedRevision: accepted.revision,
    witnessRevision: accepted.revision,
    acceptedWeekCount: witness.program?.microcycles.length ?? 0,
    phaseSignatures,
    fixtures: fixtureDates,
    sessions,
    components: componentMap(witness),
    eligibleTargetDates: Object.keys(witness.visibleCardDays ?? {}).map((date) => ({
      date,
      actionTypes: ['fixture.move', 'session.move'] as const,
    })),
    sourceFacts,
    reversibleAdjustments: adjustmentWitnesses,
    cardDetailEqualities: sessions.map((session) => ({
      ...session,
      equal: semanticFingerprintV2(visibleEqualityProjection(
        witness.visibleCardDays?.[session.date],
      )) === semanticFingerprintV2(visibleEqualityProjection(
        witness.visibleDetailDays?.[session.date],
      )),
    })),
    interpretationReceiptIds: [],
    availableCapabilities: ['week.repeat'],
    availableRenderTestIds: [
      args.step.controlTestId,
      ...(args.step.targetTestIds ?? []),
    ],
  };
}

/**
 * Runtime eligibility boundary. The active scenario-session decision, current
 * accepted state, and durable fingerprint map must all describe one revision.
 */
export async function readLiveExplorerEligibilityWitnessState(args: {
  manifest: ExplorerScenarioContract;
  step: ExplorerScenarioStep;
  session: DevE2EScenarioSessionRecord;
}): Promise<ExplorerEligibilityWitnessState> {
  const state = buildLiveExplorerEligibilityWitnessState(args);
  const persisted = await readDevE2EPersistedFingerprints();
  if (!fingerprintMapsMatch(persisted, args.session.persistedStoreFingerprints) ||
    args.session.nextActionEligibility.status !== 'eligible') {
    throw new Error(`explorer_live_eligibility_stale_persistence:${args.step.stepId}`);
  }
  const receipt = evaluateExplorerStepEligibility({ step: args.step, state });
  const expectedWitnesses = [...args.session.nextActionEligibility.witnessIds].sort();
  const actualWitnesses = [...receipt.witnessIds].sort();
  if (receipt.status !== 'eligible' ||
    expectedWitnesses.length !== actualWitnesses.length ||
    expectedWitnesses.some((witnessId, index) => witnessId !== actualWitnesses[index])) {
    throw new Error(`explorer_live_eligibility_decision_mismatch:${args.step.stepId}`);
  }
  return state;
}

/** Scenario-session V2 reset/reload evaluator used by the coordinator. */
export function evaluateLiveDevE2EScenarioEligibility(
  context: DevE2EScenarioEligibilityContext,
): DevE2EScenarioEligibilityDecision {
  const manifest = resolveExplorerSmokeScenarioManifest(context.manifest.scenarioId);
  const step = manifest?.steps.find((candidate) =>
    candidate.stepId === context.nextStep.stepId);
  if (!manifest || !step) return failClosedDevE2EScenarioEligibility(context);
  try {
    const receipt = evaluateExplorerStepEligibility({
      step,
      state: buildLiveExplorerEligibilityWitnessState({
        manifest,
        step,
        session: context.session,
      }),
    });
    return {
      status: receipt.status,
      reasonCode: receipt.reasonCode,
      witnessIds: [...receipt.witnessIds],
    };
  } catch {
    return failClosedDevE2EScenarioEligibility(context);
  }
}
