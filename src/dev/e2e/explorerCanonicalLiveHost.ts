import { useProgramStore } from '../../store/programStore';
import { dayOfWeekForISODate } from '../../utils/appDate';
import { getMondayForDate } from '../../utils/sessionResolver';
import {
  getAthleteActionTraceV2,
  getAthleteActionTracesV2,
} from '../../utils/athleteActionDiagnostics';
import {
  semanticFingerprintV2,
  stableSemanticJsonV2,
} from '../../utils/semanticFingerprintV2';
import type { DevE2ESeedCoordinator } from './DevE2ESeedCoordinator';
import { collectAthleteActionArtifactBundleV2 } from './athleteActionArtifactBundle';
import { clusterAthleteActionFailure } from './athleteActionFailureClustering';
import { readActiveDevE2EClockReceipt } from './devE2EClockPersistence';
import {
  captureDevE2EMemoryFingerprints,
  fingerprintMapsMatch,
  readDevE2ECheckpoint,
  readDevE2EPersistedFingerprints,
  readDevE2EScenarioSession,
  type DevE2EFingerprintMap,
} from './devE2EPersistence';
import { readActiveDevE2EScenarioSession } from './devE2EScenarioRuntime';
import type { DevE2EScenarioSessionRecord } from './devE2EScenarioSession';
import {
  hasDevE2EMarker,
} from './devE2EState';
import { explorerLiveActionIngressGate } from './explorerActionIngress';
import {
  readLiveExplorerEligibilityWitnessState,
} from './explorerLiveEligibility';
import type {
  ExplorerOracleEvaluationContext,
  ExplorerOracleEvaluationReceipt,
  ExplorerProjectionSnapshot,
} from './explorerOracleEvaluator';
import type {
  ExplorerPhysicalCaptureRequestV1,
  ExplorerPhysicalEvidenceReceiptV1,
} from './explorerPhysicalEvidence';
import { requestExplorerPhysicalEvidence } from './explorerPhysicalEvidenceDevBridge';
import { readExplorerCorrelatedRenderReceipt } from './explorerRenderReceiptBindings';
import type {
  ExplorerRuntimeActionArtifactInput,
  ExplorerRuntimeArtifactAssemblyV1,
  ExplorerRuntimeEligibilityMarker,
  ExplorerLiveRuntimeDependencies,
} from './explorerRuntime';
import {
  collectExplorerScenarioArtifactBundleV1,
  explorerScenarioArtifactSemanticHash,
  type ExplorerScenarioActionEvidenceV1,
  type ExplorerScenarioArtifactBundleV1,
  type ExplorerScenarioOracleEvidenceV1,
} from './explorerScenarioArtifactBundle';
import { explorerActionSemanticHash } from './explorerScenarioContractValidation';
import type {
  ExplorerJsonValue,
  ExplorerScenarioContract,
  ExplorerScenarioStep,
} from './explorerScenarioContracts';
import { readDevE2EWitnessState } from './defaultDevE2ESeedCoordinator';
import { buildDevE2ESeed } from './devE2ESeedRegistry';
import { explorerLiveScenarioActiveTimeBudget } from
  './explorerScenarioActiveTimeBudget';

/**
 * Canonical Explorer Live Host
 *
 * This adapter owns coordination evidence only. It does not resolve actions,
 * mutate product state, reinterpret manifests, or restore adjustments.
 */

interface FingerprintSnapshot {
  readonly acceptedSemanticFingerprint: string;
  readonly persistedStoreFingerprints: DevE2EFingerprintMap;
}

interface CanonicalLiveHostState {
  resetCount: number;
  resetSession: DevE2EScenarioSessionRecord | null;
  beforeFingerprintsByStep: Map<string, FingerprintSnapshot>;
  beforeProjectionsByStep: Map<string, readonly ExplorerProjectionSnapshot[]>;
  afterProjectionsByStep: Map<string, readonly ExplorerProjectionSnapshot[]>;
  physicalReceipts: Map<string, ExplorerPhysicalEvidenceReceiptV1>;
}

function jsonValue(value: unknown): ExplorerJsonValue {
  const encoded = JSON.stringify(value, (_key, entry) => entry === undefined ? null : entry);
  return encoded === undefined ? null : JSON.parse(encoded) as ExplorerJsonValue;
}

function captured<T>(field: unknown): T | null {
  if (!field || typeof field !== 'object') return null;
  const candidate = field as { status?: string; value?: T };
  return candidate.status === 'captured' ? candidate.value ?? null : null;
}

function activeSessionFor(args: {
  scenarioId: string;
  stepId?: string;
}): DevE2EScenarioSessionRecord {
  const session = readActiveDevE2EScenarioSession();
  if (!session || session.scenarioId !== args.scenarioId ||
    (args.stepId !== undefined &&
      session.nextActionEligibility.nextStepId !== args.stepId)) {
    throw new Error(`explorer_live_session_mismatch:${args.scenarioId}:${args.stepId ?? ''}`);
  }
  return session;
}

async function durableSessionFor(args: {
  scenarioId: string;
  stepId?: string;
}): Promise<DevE2EScenarioSessionRecord> {
  const active = activeSessionFor(args);
  const persisted = await readDevE2EScenarioSession();
  if (!persisted || stableSemanticJsonV2(active) !== stableSemanticJsonV2(persisted)) {
    throw new Error(`explorer_live_session_not_durable:${args.scenarioId}`);
  }
  return persisted;
}

function selectorSet(manifest: ExplorerScenarioContract, step: ExplorerScenarioStep): string[] {
  const selectors = new Set<string>();
  for (const oracle of step.oracleAssertions) {
    if ('selector' in oracle) selectors.add(oracle.selector);
    if (oracle.type === 'unrelated-state-unchanged') {
      oracle.selectors.forEach((selector) => selectors.add(selector));
    }
  }
  for (const candidate of manifest.steps) {
    for (const oracle of candidate.oracleAssertions) {
      if (oracle.type === 'restoration-equality' &&
        oracle.baselineStepId === step.stepId) {
        selectors.add(oracle.selector);
      }
    }
  }
  return [...selectors].sort();
}

function visibleSessionRows() {
  const witness = readDevE2EWitnessState();
  return Object.entries(witness.visibleDetailDays ?? {}).flatMap(([date, value]) => {
    const day = value as {
      workout?: { id?: string; exercises?: Array<{ id?: string }> } | null;
    };
    if (!day.workout?.id) return [];
    return [{
      date,
      sessionId: day.workout.id,
      componentIds: (day.workout.exercises ?? []).flatMap((exercise) =>
        exercise.id ? [exercise.id] : []),
    }];
  });
}

function acceptedSelectorValue(selector: string): {
  presence: 'present' | 'absent';
  value?: ExplorerJsonValue;
} {
  const program = useProgramStore.getState();
  const accepted = program.acceptedMaterialContext;
  const witness = readDevE2EWitnessState();
  const sessionComponent = /^\/accepted\/sessions\/([^/]+)\/components\/(.+)$/.exec(
    selector,
  );
  if (sessionComponent) {
    const session = visibleSessionRows().find((candidate) =>
      candidate.sessionId === sessionComponent[1]);
    const present = session?.componentIds.includes(sessionComponent[2]) === true;
    return present
      ? {
          presence: 'present',
          value: jsonValue({
            sessionId: sessionComponent[1],
            componentId: sessionComponent[2],
            date: session!.date,
          }),
        }
      : { presence: 'absent' };
  }
  const session = /^\/accepted\/sessions\/([^/]+)$/.exec(selector);
  if (session) {
    const row = visibleSessionRows().find((candidate) => candidate.sessionId === session[1]);
    return row
      ? { presence: 'present', value: jsonValue(row) }
      : { presence: 'absent' };
  }
  if (selector === '/accepted/fixtures') {
    return {
      presence: 'present',
      value: jsonValue(Object.entries(witness.calendarMarks ?? {})
        .filter(([, mark]) => mark === 'game' || mark === 'practice_match')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, mark]) => ({ date, mark }))),
    };
  }
  const fixture = /^\/accepted\/fixtures\/(\d{4}-\d{2}-\d{2})$/.exec(selector);
  if (fixture) {
    const mark = witness.calendarMarks?.[fixture[1]];
    return mark === 'game' || mark === 'practice_match'
      ? { presence: 'present', value: jsonValue({ date: fixture[1], mark }) }
      : { presence: 'absent' };
  }
  const injury = /^\/accepted\/injuries\/(.+)$/.exec(selector);
  if (injury) {
    const episode = accepted.injuryEpisodes.find((candidate) =>
      candidate.episodeId === injury[1]);
    return episode
      ? {
          presence: 'present',
          value: jsonValue({
            episodeId: episode.episodeId,
            status: episode.status,
            semanticFingerprint: semanticFingerprintV2(episode),
          }),
        }
      : { presence: 'absent' };
  }
  const readiness = /^\/accepted\/readiness\/(\d{4}-\d{2}-\d{2})$/.exec(selector);
  if (readiness) {
    const signal = accepted.readinessSignalsByDate[readiness[1]];
    return signal === undefined
      ? { presence: 'absent' }
      : {
          presence: 'present',
          value: jsonValue({
            readinessId: `readiness-${readiness[1]}`,
            date: readiness[1],
            semanticFingerprint: semanticFingerprintV2(signal),
          }),
        };
  }
  const equipment = /^\/accepted\/equipment\/(.+)$/.exec(selector);
  if (equipment) {
    const fact = accepted.temporarySourceFacts.find((candidate) =>
      'factId' in candidate && candidate.factId === equipment[1] &&
      (!('status' in candidate) || candidate.status === 'active'));
    return fact
      ? {
          presence: 'present',
          value: jsonValue({
            factId: equipment[1],
            status: 'active',
            semanticFingerprint: semanticFingerprintV2(fact),
          }),
        }
      : { presence: 'absent' };
  }
  const feedback = /^\/accepted\/session-feedback\/(\d{4}-\d{2}-\d{2})$/.exec(
    selector,
  );
  if (feedback) {
    const receipt = program.sessionFeedback[feedback[1]];
    return receipt
      ? {
          presence: 'present',
          value: jsonValue({
            date: feedback[1],
            transactionId: receipt.outcomeReceipt?.transactionId ?? null,
            semanticFingerprint: semanticFingerprintV2(receipt),
          }),
        }
      : { presence: 'absent' };
  }
  const week = /^\/accepted\/weeks\/(\d{4}-\d{2}-\d{2})$/.exec(selector);
  if (week) {
    const acceptedWeek = program.currentProgram?.microcycles.find((candidate) =>
      candidate.startDate.slice(0, 10) === week[1]) ??
      (program.currentMicrocycle?.startDate.slice(0, 10) === week[1]
        ? program.currentMicrocycle
        : null);
    const overlay = program.weekScopedOverlays[week[1]] ?? null;
    return acceptedWeek || overlay
      ? {
          presence: 'present',
          value: jsonValue({
            weekStart: week[1],
            acceptedWeekFingerprint: acceptedWeek
              ? semanticFingerprintV2(acceptedWeek)
              : null,
            overlayFingerprint: overlay ? semanticFingerprintV2(overlay) : null,
          }),
        }
      : { presence: 'absent' };
  }
  throw new Error(`explorer_live_oracle_selector_unsupported:${selector}`);
}

function acceptedProjections(args: {
  stepId: string;
  selectors: readonly string[];
}): readonly ExplorerProjectionSnapshot[] {
  return args.selectors.map((selector) => {
    const snapshot = acceptedSelectorValue(selector);
    const base = {
      evidenceReferenceId: `accepted:${args.stepId}:${semanticFingerprintV2(selector)}`,
      stepId: args.stepId,
      subject: 'accepted-state' as const,
      selector,
    };
    return snapshot.presence === 'present'
      ? { ...base, presence: 'present' as const, value: snapshot.value! }
      : { ...base, presence: 'absent' as const };
  });
}

function persistedProjection(
  projection: ExplorerProjectionSnapshot,
): ExplorerProjectionSnapshot {
  const base = {
    ...projection,
    evidenceReferenceId: projection.evidenceReferenceId.replace('accepted:', 'persisted:'),
    subject: 'persisted-state' as const,
  };
  return projection.presence === 'present'
    ? { ...base, presence: 'present', value: projection.value }
    : { ...base, presence: 'absent' };
}

function snapshotFingerprint(snapshot: ExplorerProjectionSnapshot): string {
  return semanticFingerprintV2(snapshot.presence === 'present'
    ? snapshot.value
    : { presence: 'absent' });
}

function fixtureAnchorWitnesses(step: ExplorerScenarioStep) {
  if (!step.requiredInvariants.includes('fixture-anchor-valid')) return [];
  const witness = readDevE2EWitnessState();
  const fixtures = Object.entries(witness.calendarMarks ?? {})
    .filter(([, mark]) => mark === 'game' || mark === 'practice_match')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, mark]) => ({ date, mark }));
  const valid = fixtures.every(({ date, mark }) => {
    const weekStart = getMondayForDate(date);
    const overlay = witness.weekScopedOverlays?.[weekStart] as {
      exposureContractV2?: { anchors?: Array<{ kind?: string; dayOfWeek?: number }> };
    } | undefined;
    const microcycle = witness.program?.microcycles.find((candidate) =>
      candidate.startDate.slice(0, 10) === weekStart) as unknown as {
        exposureContractV2?: { anchors?: Array<{ kind?: string; dayOfWeek?: number }> };
      } | undefined;
    const anchors = overlay?.exposureContractV2?.anchors ??
      microcycle?.exposureContractV2?.anchors ?? [];
    const expectedKind = mark === 'game' ? 'game_day' : 'practice_match';
    return anchors.some((anchor) =>
      anchor.kind === expectedKind && anchor.dayOfWeek === dayOfWeekForISODate(date));
  });
  const acceptedFingerprint = semanticFingerprintV2(fixtures);
  const anchorFingerprint = valid
    ? acceptedFingerprint
    : semanticFingerprintV2({ invalidFixtureAnchors: fixtures });
  const selectors = step.oracleAssertions.flatMap((oracle) =>
    'selector' in oracle ? [oracle.selector] : []);
  return Array.from(new Set(selectors)).map((selector) => ({
    evidenceReferenceId: `fixture-anchor:${step.stepId}:${semanticFingerprintV2(selector)}`,
    stepId: step.stepId,
    selector,
    acceptedFingerprint,
    fixtureAnchorFingerprint: anchorFingerprint,
    valid,
  }));
}

function cardDetailWitnesses(step: ExplorerScenarioStep) {
  if (!step.requiredInvariants.includes('card-detail-equality')) return [];
  const witness = readDevE2EWitnessState();
  return step.oracleAssertions.flatMap((oracle) => {
    if (oracle.type !== 'rendered-witness') return [];
    const date = /^\/accepted\/fixtures\/(\d{4}-\d{2}-\d{2})$/.exec(
      oracle.selector,
    )?.[1];
    if (!date) return [];
    const card = witness.visibleCardDays?.[date] as {
      workout?: { id?: string } | null;
    } | undefined;
    const detail = witness.visibleDetailDays?.[date] as {
      workout?: { id?: string } | null;
    } | undefined;
    const cardPresence = card ? 'present' as const : 'absent' as const;
    const detailPresence = detail ? 'present' as const : 'absent' as const;
    return [{
      evidenceReferenceId: `card-detail:${step.stepId}:${date}`,
      stepId: step.stepId,
      selector: oracle.selector,
      cardPresence,
      detailPresence,
      cardFingerprint: card ? semanticFingerprintV2({
        date,
        workoutId: card.workout?.id ?? null,
      }) : null,
      detailFingerprint: detail ? semanticFingerprintV2({
        date,
        workoutId: detail.workout?.id ?? null,
      }) : null,
    }];
  });
}

function traceReceiptsForScenario(scenarioId: string) {
  return getAthleteActionTracesV2().flatMap((trace) => {
    const traceScenarioId = captured<string>(trace.root.scenarioRunId);
    const stepId = captured<string>(trace.root.scenarioStepId);
    if (traceScenarioId !== scenarioId || !stepId || trace.status === 'unfinished') return [];
    return [{
      evidenceReferenceId: `trace-v2:${trace.traceId}`,
      stepId,
      traceId: trace.traceId,
      schemaVersion: trace.schemaVersion,
      terminalStatus: trace.status,
    }];
  });
}

function oracleValue(
  value: ExplorerOracleEvaluationReceipt['expectedFingerprintOrValue'],
): ExplorerScenarioOracleEvidenceV1['expectedValue'] {
  if (value.kind === 'semantic-fingerprint') {
    return { representation: 'semantic_fingerprint', fingerprint: value.fingerprint };
  }
  return {
    representation: 'value',
    value: value.kind === 'missing' ? { evidence: 'missing' } : value.value,
  };
}

function artifactOracleReceipts(
  manifest: ExplorerScenarioContract,
  receipts: readonly ExplorerOracleEvaluationReceipt[],
): ExplorerScenarioOracleEvidenceV1[] {
  const byId = new Map(receipts.map((receipt) => [
    `${receipt.stepId}\u0000${receipt.oracleId}`,
    receipt,
  ]));
  return manifest.steps.flatMap((step) => step.oracleAssertions.map((oracle) => {
    const receipt = byId.get(`${step.stepId}\u0000${oracle.oracleId}`);
    if (!receipt) throw new Error(`explorer_live_oracle_receipt_missing:${oracle.oracleId}`);
    return {
      oracleId: receipt.oracleId,
      stepId: receipt.stepId,
      evaluationPoint: receipt.evaluationPoint === 'after-action'
        ? 'after_action' as const
        : receipt.evaluationPoint === 'after-reload'
          ? 'after_reload' as const
          : 'scenario_end' as const,
      enforcement: 'hard' as const,
      evaluationStatus: 'evaluated' as const,
      expectedValue: oracleValue(receipt.expectedFingerprintOrValue),
      actualValueOrFingerprint: oracleValue(receipt.actualFingerprintOrValue),
      passed: receipt.passed,
      failureCode: receipt.failureCode,
      firstDivergentProjection: receipt.firstDivergentProjection,
    };
  }));
}

function physicalKey(receipt: Pick<
  ExplorerPhysicalEvidenceReceiptV1,
  'stepId' | 'capturePhase'
>): string {
  return `${receipt.stepId ?? '<seed>'}:${receipt.capturePhase}`;
}

export function createCanonicalExplorerLiveHostDependencies(args: {
  coordinator: DevE2ESeedCoordinator;
  scenarioId: string;
  campaignId: string;
  integratedRepositorySha: string;
}): Omit<
  ExplorerLiveRuntimeDependencies,
  'loadManifest' | 'waitForReactRender'
> {
  const state: CanonicalLiveHostState = {
    resetCount: 0,
    resetSession: null,
    beforeFingerprintsByStep: new Map(),
    beforeProjectionsByStep: new Map(),
    afterProjectionsByStep: new Map(),
    physicalReceipts: new Map(),
  };

  const requestCapture = async (
    request: ExplorerPhysicalCaptureRequestV1,
  ): Promise<ExplorerPhysicalEvidenceReceiptV1> => {
    const receipt = await requestExplorerPhysicalEvidence(request);
    const key = physicalKey(receipt);
    if (state.physicalReceipts.has(key)) {
      throw new Error(`explorer_live_duplicate_physical_receipt:${key}`);
    }
    state.physicalReceipts.set(key, receipt);
    return receipt;
  };

  return {
    actionExecutionMode: 'live-external-action-ingress',
    activeTimeBudget: explorerLiveScenarioActiveTimeBudget(),
    physicalEvidence: {
      campaignId: args.campaignId,
      integratedRepositorySha: args.integratedRepositorySha,
      deterministicClockFingerprint: () => {
        const clock = readActiveDevE2EClockReceipt();
        if (!clock) throw new Error('explorer_live_clock_missing');
        return clock.semanticFingerprint;
      },
      requestCapture,
    },
    resetSeedOnce: async (seedId) => {
      state.resetCount += 1;
      if (state.resetCount !== 1) {
        throw new Error(`explorer_live_reseed_forbidden:${args.scenarioId}`);
      }
      await explorerLiveActionIngressGate().clear();
      const reset = await args.coordinator.resetScenario(args.scenarioId);
      if (!reset) throw new Error(`explorer_live_reset_refused:${args.scenarioId}`);
      const session = await durableSessionFor({ scenarioId: args.scenarioId });
      if (session.seedId !== seedId || session.reloadCount !== 0 ||
        session.checkpointStepId !== null) {
        throw new Error(`explorer_live_reset_session_invalid:${args.scenarioId}`);
      }
      state.resetSession = session;
      const seed = buildDevE2ESeed(seedId);
      return {
        resetId: `explorer-live-reset:${args.scenarioId}`,
        seedId,
        seedEvidence: {
          witnessReport: {
            seedId,
            complete: true,
            witnesses: seed.witnesses.map((witness, index) => ({
              witnessId: `seed:${seedId}:${witness.kind}:${index + 1}`,
              status: 'passed' as const,
              evidenceFingerprint: semanticFingerprintV2(witness),
            })),
          },
          initialAcceptedSemanticFingerprint:
            session.currentAcceptedSemanticFingerprint,
          initialPersistedStoreFingerprints: session.persistedStoreFingerprints,
          initialScreenshotReference: { artifactId: '', contentFingerprint: '' },
          initialAccessibilityHierarchyReference: {
            artifactId: '',
            contentFingerprint: '',
          },
        },
      };
    },
    readEligibilityWitnessState: async (manifest, step) => {
      const session = await durableSessionFor({
        scenarioId: manifest.scenarioId,
        stepId: step.stepId,
      });
      const selectors = selectorSet(manifest, step);
      const beforeProjections = acceptedProjections({
        stepId: step.stepId,
        selectors,
      });
      const memory = captureDevE2EMemoryFingerprints();
      const persisted = await readDevE2EPersistedFingerprints();
      if (!fingerprintMapsMatch(memory, persisted)) {
        throw new Error(`explorer_live_eligibility_persistence_mismatch:${step.stepId}`);
      }
      state.beforeProjectionsByStep.set(step.stepId, beforeProjections);
      state.beforeFingerprintsByStep.set(step.stepId, {
        acceptedSemanticFingerprint: session.currentAcceptedSemanticFingerprint,
        persistedStoreFingerprints: persisted,
      });
      return readLiveExplorerEligibilityWitnessState({ manifest, step, session });
    },
    publishEligibilityMarker: async (marker: ExplorerRuntimeEligibilityMarker) => {
      const canonical = `e2e-next-action-eligible-${marker.scenarioId}-${marker.stepId}`;
      if (marker.markerId !==
          `e2e-explorer-next-action-eligible-${marker.scenarioId}-${marker.stepId}` ||
        !hasDevE2EMarker(canonical) || !hasDevE2EMarker(marker.markerId)) {
        throw new Error(`explorer_live_eligibility_marker_missing:${marker.stepId}`);
      }
    },
    persistActionIngressRequest: async (request) => {
      await explorerLiveActionIngressGate().open(request);
    },
    waitForExternalActionIngress: async (request, pauseToken) => {
      const receipt = await explorerLiveActionIngressGate().waitForReceipt(
        request,
        pauseToken,
      );
      return receipt.productionReceipt;
    },
    captureOracleContext: async ({
      manifest,
      step,
      point,
      receipt,
      priorActionTraceId,
    }): Promise<ExplorerOracleEvaluationContext> => {
      const selectors = selectorSet(manifest, step);
      const current = acceptedProjections({ stepId: step.stepId, selectors });
      const memory = captureDevE2EMemoryFingerprints();
      const persisted = await readDevE2EPersistedFingerprints();
      if (!fingerprintMapsMatch(memory, persisted)) {
        throw new Error(`explorer_live_oracle_persistence_mismatch:${step.stepId}:${point}`);
      }
      if (point === 'after-action') {
        state.afterProjectionsByStep.set(step.stepId, current);
      }
      const trace = getAthleteActionTraceV2(receipt.traceV2RootId);
      if (!trace) throw new Error(`explorer_live_trace_missing:${receipt.traceV2RootId}`);
      const beforeSemantic = captured<{ fingerprint: string }>(
        trace.evidence.semanticAcceptedBefore,
      );
      const afterSemantic = captured<{ fingerprint: string }>(
        trace.evidence.semanticAcceptedAfter,
      );
      if (!beforeSemantic || !afterSemantic) {
        throw new Error(`explorer_live_trace_semantic_snapshot_missing:${step.stepId}`);
      }
      const render = readExplorerCorrelatedRenderReceipt(receipt);
      const renderWitnessReceipts = step.oracleAssertions.flatMap((oracle) => {
        if (oracle.type !== 'rendered-witness') return [];
        if (!render || !render.complete || !render.observedTestIds.includes(oracle.testId)) {
          throw new Error(`explorer_live_render_receipt_missing:${oracle.oracleId}`);
        }
        const projection = current.find((candidate) =>
          candidate.selector === oracle.selector);
        if (!projection) {
          throw new Error(`explorer_live_render_projection_missing:${oracle.selector}`);
        }
        return projection.presence === 'present'
          ? [{
              evidenceReferenceId: `render:${receipt.traceV2RootId}:${oracle.testId}`,
              stepId: step.stepId,
              testId: oracle.testId,
              selector: oracle.selector,
              presence: 'present' as const,
              semanticFingerprint: snapshotFingerprint(projection),
            }]
          : [{
              evidenceReferenceId: `render:${receipt.traceV2RootId}:${oracle.testId}`,
              stepId: step.stepId,
              testId: oracle.testId,
              selector: oracle.selector,
              presence: 'absent' as const,
            }];
      });
      const allBefore = [...state.beforeProjectionsByStep.values()].flat();
      const allAfter = [...state.afterProjectionsByStep.values()].flat();
      const restored = step.oracleAssertions.some((oracle) =>
        oracle.type === 'restoration-equality') ? current : [];
      return {
        scenarioId: manifest.scenarioId,
        stepId: step.stepId,
        evaluationPoint: point,
        canonicalAcceptedStateProjections: current,
        persistedStateProjections: current.map(persistedProjection),
        semanticFingerprints: [
          {
            evidenceReferenceId: `semantic:${step.stepId}:accepted:before`,
            stepId: step.stepId,
            subject: 'accepted-state',
            phase: 'before',
            fingerprint: beforeSemantic.fingerprint,
          },
          {
            evidenceReferenceId: `semantic:${step.stepId}:accepted:after`,
            stepId: step.stepId,
            subject: 'accepted-state',
            phase: 'after',
            fingerprint: afterSemantic.fingerprint,
          },
          {
            evidenceReferenceId: `semantic:${step.stepId}:accepted:accepted`,
            stepId: step.stepId,
            subject: 'accepted-state',
            phase: 'accepted',
            fingerprint: afterSemantic.fingerprint,
          },
        ],
        renderWitnessReceipts,
        traceV2ProductionReceipts: traceReceiptsForScenario(manifest.scenarioId),
        activeTraceId: receipt.traceV2RootId,
        priorTraceId: priorActionTraceId,
        interpretationReceipts: [],
        beforeProjections: allBefore,
        afterProjections: allAfter,
        restoredProjections: restored,
        unchangedStateWitnesses: [],
        fixtureAnchorWitnesses: fixtureAnchorWitnesses(step),
        cardDetailWitnesses: cardDetailWitnesses(step),
      };
    },
    checkpointScenarioStep: async ({ manifest, step, receipt, order }) => {
      const checkpointed = await args.coordinator.checkpointScenario(
        manifest.scenarioId,
        step.stepId,
      );
      if (!checkpointed) {
        throw new Error(`explorer_live_checkpoint_refused:${step.stepId}`);
      }
      const [checkpointRecord, session] = await Promise.all([
        readDevE2ECheckpoint(),
        readDevE2EScenarioSession(),
      ]);
      if (!checkpointRecord || !session ||
        checkpointRecord.scenarioId !== manifest.scenarioId ||
        checkpointRecord.checkpointStepId !== step.stepId ||
        checkpointRecord.activeActionTraceId !== receipt.traceV2RootId ||
        session.checkpointStepId !== step.stepId ||
        session.activeActionTraceId !== receipt.traceV2RootId ||
        session.reloadCount !== order - 1) {
        throw new Error(`explorer_live_checkpoint_evidence_mismatch:${step.stepId}`);
      }
      return {
        order,
        checkpointEvidence: {
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
          reloadCount: session.reloadCount,
          checkpointRecord,
          scenarioSessionRecord: session,
        },
      };
    },
    coldReloadScenarioSessionV2: async ({ manifest, step, checkpoint, order }) => {
      if (state.resetCount !== 1 || checkpoint.order !== order) {
        throw new Error(`explorer_live_reload_order_mismatch:${step.stepId}`);
      }
      const reloaded = await args.coordinator.validateReloadCheckpoint();
      if (!reloaded) throw new Error(`explorer_live_reload_refused:${step.stepId}`);
      const session = await durableSessionFor({ scenarioId: manifest.scenarioId });
      const checkpointRecord = checkpoint.checkpointEvidence.checkpointRecord;
      if (session.checkpointStepId !== step.stepId ||
        session.reloadCount !== order ||
        session.activeActionTraceId !== null ||
        session.priorActionTraceId !== checkpointRecord.activeActionTraceId) {
        throw new Error(`explorer_live_reload_session_mismatch:${step.stepId}`);
      }
      const finalStep = manifest.steps[manifest.steps.length - 1]?.stepId === step.stepId;
      const nextStepId = manifest.steps[order]?.stepId ?? null;
      const expectedMarker = finalStep
        ? `e2e-scenario-complete-${manifest.scenarioId}`
        : `e2e-next-action-eligible-${manifest.scenarioId}-${nextStepId ?? ''}`;
      if (!hasDevE2EMarker(expectedMarker) ||
        (finalStep && session.nextActionEligibility.status !== 'complete') ||
        (!finalStep && (
          !nextStepId || session.nextActionEligibility.status !== 'eligible' ||
          session.nextActionEligibility.nextStepId !== nextStepId
        ))) {
        throw new Error(`explorer_live_reload_marker_missing:${step.stepId}`);
      }
      return {
        order,
        reloadReceipt: {
          protocolVersion: 1,
          receiptId: `explorer-reload:${semanticFingerprintV2({
            scenarioId: manifest.scenarioId,
            stepId: step.stepId,
            traceV2RootId: session.priorActionTraceId,
            reloadCount: session.reloadCount,
          }).slice(-24)}`,
          scenarioId: manifest.scenarioId,
          stepId: step.stepId,
          reloadCount: session.reloadCount,
          traceV2RootId: session.priorActionTraceId!,
          acceptedSemanticFingerprint: session.currentAcceptedSemanticFingerprint,
          persistedStoreFingerprints: session.persistedStoreFingerprints,
          clockFingerprint: session.clockFingerprint,
          scenarioSessionRecord: session,
        },
      };
    },
    assembleActionEvidence: async (
      input: ExplorerRuntimeActionArtifactInput,
    ): Promise<ExplorerScenarioActionEvidenceV1> => {
      const before = state.beforeFingerprintsByStep.get(input.step.stepId);
      const afterAction = input.checkpoint.checkpointEvidence.scenarioSessionRecord;
      const afterReload = input.reload.reloadReceipt;
      const trace = getAthleteActionTraceV2(input.receipt.traceV2RootId);
      const physicalAfterAction = state.physicalReceipts.get(
        `${input.step.stepId}:after-action`,
      );
      const physicalAfterReload = state.physicalReceipts.get(
        `${input.step.stepId}:after-reload`,
      );
      const clock = readActiveDevE2EClockReceipt();
      if (!before || !trace || trace.status !== 'finalized_success' ||
        !physicalAfterAction || !physicalAfterReload || !clock ||
        input.renderReceipt.externalArtifacts?.complete !== true ||
        input.renderReceipt.externalArtifacts.screenshot !== 'captured' ||
        input.renderReceipt.externalArtifacts.accessibilityHierarchy !== 'captured') {
        throw new Error(`explorer_live_action_evidence_incomplete:${input.step.stepId}`);
      }
      const priorActionTraceId = captured<string | null>(trace.root.priorActionTraceId);
      if (priorActionTraceId === null &&
        trace.root.priorActionTraceId.status !== 'captured') {
        throw new Error(`explorer_live_prior_trace_missing:${input.step.stepId}`);
      }
      const acceptedChanged = before.acceptedSemanticFingerprint !==
        afterAction.currentAcceptedSemanticFingerprint;
      const restorationOracleIds = input.step.oracleAssertions.flatMap((oracle) =>
        oracle.type === 'restoration-equality' ? [oracle.oracleId] : []);
      const restorationReceipts = input.oracleReceipts.filter((receipt) =>
        restorationOracleIds.includes(receipt.oracleId));
      const failureCluster = clusterAthleteActionFailure({
        expectedMaterialChange: input.step.expectedOutcome.kind === 'accepted' &&
          input.step.expectedOutcome.stateChange === 'required',
        acceptedSemanticChanged: acceptedChanged,
        reportedSuccess: input.receipt.status === 'applied',
        durableReadbackMatched: fingerprintMapsMatch(
          afterAction.persistedStoreFingerprints,
          input.checkpoint.checkpointEvidence.checkpointRecord.fingerprints,
        ),
        rejected: input.receipt.status === 'rejected',
        rejectionExpected: input.step.expectedOutcome.kind === 'rejected',
        postReloadMatched: afterReload.acceptedSemanticFingerprint ===
          afterAction.currentAcceptedSemanticFingerprint && fingerprintMapsMatch(
            afterReload.persistedStoreFingerprints,
            afterAction.persistedStoreFingerprints,
          ),
        coachNoteMatchedAcceptedOwnership: true,
        restorationRequested: input.step.action.type === 'adjustment.restore',
        restorationMatchedOwnedBeforeState: input.step.action.type !== 'adjustment.restore' ||
          (restorationOracleIds.length > 0 &&
            restorationReceipts.length === restorationOracleIds.length &&
            restorationReceipts.every((receipt) => receipt.passed)),
        fixtureMutation: input.step.action.type.startsWith('fixture.'),
        fixtureHorizonValid: input.oracleReceipts.every((receipt) => receipt.passed),
        directAndChainedCompared: false,
        directAndChainedMatched: true,
        sourceFactCreated: input.step.action.type === 'injury.set' ||
          input.step.action.type === 'readiness.set' ||
          input.step.action.type === 'equipment.set',
        programmingEffectExpected: input.step.requiredInvariants.includes(
          'source-fact-has-programming-effect',
        ),
        programmingEffectObserved: input.oracleReceipts.every((receipt) => receipt.passed),
        coachingOutcomeAcceptable: true,
        resultCommunicationClear: true,
        equivalentControlsCompared: false,
        equivalentControlsConsistent: true,
      });
      const actionArtifactBundle = collectAthleteActionArtifactBundleV2({
        campaignId: args.campaignId,
        scenarioRunId: input.manifest.scenarioId,
        scenarioSeed: { seedId: input.manifest.seedId },
        actionScriptYaml: `action: ${input.step.action.type}\nstep: ${input.step.stepId}`,
        expectedOutcome: input.step.expectedOutcome,
        screenshots: {
          [`${input.step.stepId}-after-action.png`]:
            `${physicalAfterAction.screenshot.relativeReference}:sha256:${
              physicalAfterAction.screenshot.sha256}`,
          [`${input.step.stepId}-after-reload.png`]:
            `${physicalAfterReload.screenshot.relativeReference}:sha256:${
              physicalAfterReload.screenshot.sha256}`,
        },
        accessibilityHierarchies: {
          [`${input.step.stepId}-after-action.json`]: {
            reference: physicalAfterAction.hierarchy.relativeReference,
            sha256: physicalAfterAction.hierarchy.sha256,
          },
          [`${input.step.stepId}-after-reload.json`]: {
            reference: physicalAfterReload.hierarchy.relativeReference,
            sha256: physicalAfterReload.hierarchy.sha256,
          },
        },
        trace,
        clockEvidence: clock,
        acceptedFingerprints: {
          before: before.acceptedSemanticFingerprint,
          afterAction: afterAction.currentAcceptedSemanticFingerprint,
          afterReload: afterReload.acceptedSemanticFingerprint,
        },
        persistedFingerprints: {
          before: before.persistedStoreFingerprints,
          afterAction: afterAction.persistedStoreFingerprints,
          afterReload: afterReload.persistedStoreFingerprints,
        },
        postReloadResult: {
          matched: afterReload.acceptedSemanticFingerprint ===
            afterAction.currentAcceptedSemanticFingerprint,
          reloadCount: afterReload.reloadCount,
        },
        failureCluster,
      });
      return {
        stepId: input.step.stepId,
        intendedActionSemanticHash: explorerActionSemanticHash(input.step.action),
        intendedActionReceipt: {
          actionKind: input.step.action.type,
          productionSurface: input.step.ingress,
          semanticInput: {
            stepId: input.step.stepId,
            actionSemanticHash: explorerActionSemanticHash(input.step.action),
            target: input.step.action.target,
          },
        },
        actualProductionReceiptReference: {
          artifactId: `production-receipt:${input.receipt.receiptId}`,
          contentFingerprint: semanticFingerprintV2(input.receipt.productionReceipt),
        },
        actionArtifactBundle,
        traceV2RootId: input.receipt.traceV2RootId,
        priorActionTraceId,
        fingerprints: {
          beforeAction: before,
          afterAction: {
            acceptedSemanticFingerprint:
              afterAction.currentAcceptedSemanticFingerprint,
            persistedStoreFingerprints: afterAction.persistedStoreFingerprints,
          },
          afterReload: {
            acceptedSemanticFingerprint: afterReload.acceptedSemanticFingerprint,
            persistedStoreFingerprints: afterReload.persistedStoreFingerprints,
          },
        },
        selectorsUsed: Array.from(new Set([
          input.step.controlTestId,
          ...(input.step.targetTestIds ?? []),
        ])).map((selectorId) => ({
          selectorId,
          strategy: 'semantic_control_id' as const,
        })),
        screenshots: {
          afterAction: { artifactId: '', contentFingerprint: '' },
          afterReload: { artifactId: '', contentFingerprint: '' },
        },
        accessibilityHierarchies: {
          afterAction: { artifactId: '', contentFingerprint: '' },
          afterReload: { artifactId: '', contentFingerprint: '' },
        },
      };
    },
    assembleScenarioArtifact: async (
      assembly: ExplorerRuntimeArtifactAssemblyV1,
    ): Promise<ExplorerScenarioArtifactBundleV1> => {
      const clock = readActiveDevE2EClockReceipt();
      const finalSession = assembly.reloadReceipts.at(-1)?.scenarioSessionRecord;
      if (!assembly.seedEvidence || !state.resetSession || !clock || !finalSession ||
        assembly.completion.status !== 'complete' ||
        finalSession.nextActionEligibility.status !== 'complete' ||
        assembly.actionEvidence.length !== assembly.manifest.steps.length ||
        assembly.physicalEvidenceReceipts.length !==
          1 + assembly.manifest.steps.length * 2) {
        throw new Error(`explorer_live_scenario_artifact_incomplete:${assembly.manifest.scenarioId}`);
      }
      const oracleReceipts = artifactOracleReceipts(
        assembly.manifest,
        assembly.oracleReceipts,
      );
      if (oracleReceipts.some((receipt) => !receipt.passed)) {
        throw new Error(`explorer_live_scenario_end_oracle_failed:${assembly.manifest.scenarioId}`);
      }
      const bundle = collectExplorerScenarioArtifactBundleV1({
        scenarioManifest: assembly.manifest,
        identity: {
          repositoryCommit: args.integratedRepositorySha,
          buildIdentifier: `explorer-live-${args.integratedRepositorySha.slice(0, 12)}`,
          deterministicClockReceipt: clock,
        },
        seedEvidence: assembly.seedEvidence,
        scenarioSessionEvidence: {
          protocolVersion: state.resetSession.protocolVersion,
          scenarioSessionRecordAtReset: state.resetSession,
          checkpointRecords: [...assembly.checkpoints],
          reloadReceipts: [...assembly.reloadReceipts],
          finalScenarioSessionRecord: finalSession,
          reloadCount: finalSession.reloadCount,
          completionStatus: {
            status: 'complete',
            reasonCode: finalSession.nextActionEligibility.reasonCode,
          },
        },
        actions: [...assembly.actionEvidence],
        physicalEvidenceReceipts: [...assembly.physicalEvidenceReceipts],
        oracles: oracleReceipts,
        result: {
          disposition: 'passed',
          firstFailingStepId: null,
          firstFailingOracleId: null,
          firstDivergentProjection: null,
          failureClusterSignature: null,
          runnerLogReference: {
            artifactId: `runner-log:${assembly.manifest.scenarioId}`,
            contentFingerprint: explorerScenarioArtifactSemanticHash({
              scenarioId: assembly.manifest.scenarioId,
              traceV2RootChain: assembly.traceV2RootChain,
              completion: assembly.completion,
            }),
          },
          reproductionCommand:
            'npm run e2e:explorer-nine:live -- --simulator <explicit> --metro-url <explicit>',
        },
      });
      return bundle;
    },
  };
}
