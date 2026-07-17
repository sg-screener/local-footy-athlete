import { temporarySourceFactId } from '../../rules/temporarySourceFact';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { semanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  failClosedDevE2EScenarioEligibility,
  type DevE2EScenarioEligibilityContext,
  type DevE2EScenarioEligibilityDecision,
} from './devE2EScenarioProtocol';
import { evaluateExplorerStepEligibility } from './explorerEligibility';
import { ExplorerAdjustmentReceiptRegistry } from './explorerProductionBindings';
import { resolveExplorerSmokeScenarioManifest } from './explorerSmokeScenarioManifests';
import { readDevE2EWitnessState } from './defaultDevE2ESeedCoordinator';

function sessionDateMap(state: ReturnType<typeof readDevE2EWitnessState>) {
  return Object.entries(state.visibleCardDays ?? {}).flatMap(([date, value]) => {
    const day = value as { workout?: { id?: string } | null };
    return day.workout?.id ? [{ id: day.workout.id, date }] : [];
  });
}

function componentMap(state: ReturnType<typeof readDevE2EWitnessState>) {
  return Object.entries(state.visibleDetailDays ?? {}).flatMap(([date, value]) => {
    const day = value as { workout?: { id?: string; exercises?: Array<{ id?: string }> } | null };
    const sessionId = day.workout?.id;
    if (!sessionId) return [];
    return (day.workout?.exercises ?? []).flatMap((exercise) =>
      exercise.id ? [{ sessionId, componentId: exercise.id, date }] : []);
  });
}

/**
 * Production scenario-session V2 evaluator. Explorer predicates are evaluated
 * from the canonical accepted/visible snapshot; legacy one-step seed sessions
 * remain fail-closed because they have no typed predicate vocabulary.
 */
export function evaluateLiveDevE2EScenarioEligibility(
  context: DevE2EScenarioEligibilityContext,
): DevE2EScenarioEligibilityDecision {
  const manifest = resolveExplorerSmokeScenarioManifest(context.manifest.scenarioId);
  const step = manifest?.steps.find((candidate) =>
    candidate.stepId === context.nextStep.stepId);
  if (!manifest || !step) return failClosedDevE2EScenarioEligibility(context);

  const witness = readDevE2EWitnessState();
  const accepted = useProgramStore.getState().acceptedMaterialContext;
  const profile = useProfileStore.getState().onboardingData;
  const sessions = sessionDateMap(witness);
  const adjustments = useProgramStore.getState().reversibleAdjustmentLedger.adjustments;
  const adjustmentWitnesses = adjustments.map((adjustment) => ({
    adjustmentId: adjustment.id,
    status: adjustment.status === 'active' ? 'active' as const : 'restored' as const,
  }));

  if (step.action.type === 'adjustment.restore') {
    const exact = new ExplorerAdjustmentReceiptRegistry().hydrateFromPriorTraceChain({
      manifest,
      logicalAdjustmentId: step.action.target.adjustmentId,
      priorActionTraceId: context.session.priorActionTraceId,
    });
    const actual = exact && adjustments.find((candidate) => candidate.id === exact);
    if (actual) {
      adjustmentWitnesses.push({
        adjustmentId: step.action.target.adjustmentId,
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
  const receipt = evaluateExplorerStepEligibility({
    step,
    state: {
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
        equal: semanticFingerprintV2(witness.visibleCardDays?.[session.date]) ===
          semanticFingerprintV2(witness.visibleDetailDays?.[session.date]),
      })),
      interpretationReceiptIds: [],
      availableCapabilities: ['week.repeat'],
      availableRenderTestIds: [step.controlTestId, ...(step.targetTestIds ?? [])],
    },
  });
  return {
    status: receipt.status,
    reasonCode: receipt.reasonCode,
    witnessIds: [...receipt.witnessIds],
  };
}
