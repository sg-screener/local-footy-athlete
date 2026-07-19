import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDevE2EEntryRoute } from '../dev/e2e/devE2EEntryRoute';
import {
  DEV_E2E_SCENARIO_MANIFESTS,
  EXPLORER_DEV_E2E_SCENARIO_MANIFESTS,
  resolveDevE2EScenarioManifest,
} from '../dev/e2e/devE2EScenarioManifestRegistry';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EExplorerArtifactAccepted,
  setDevE2EScenarioReady,
} from '../dev/e2e/devE2EState';
import {
  EXPLORER_NON_COACH_SMOKE_MANIFESTS,
} from '../dev/e2e/explorerSmokeScenarioManifests';
import {
  EXPLORER_PRODUCTION_OWNER_BY_ACTION,
} from '../dev/e2e/explorerActionBridge';
import {
  createExplorerProductionBindings,
} from '../dev/e2e/explorerProductionBindings';
import {
  EXPLORER_CAMPAIGN_HARD_STOP_MS,
  runAllExplorerSmokeScenarios,
} from '../dev/e2e/explorerScenarioRunner';
import type { ExplorerRuntimeResult } from '../dev/e2e/explorerRuntime';

let passed = 0;
let failed = 0;
async function test(name: string, run: () => void | Promise<void>) {
  try {
    await run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`, error);
  }
}
function expect(value: boolean, message: string) {
  if (!value) throw new Error(message);
}

const EXACT_IDS = [
  'smoke-whole-session-deletion',
  'smoke-stacked-upper-pull-component-deletion',
  'smoke-fixture-move',
  'smoke-multi-reload-fixture-session-restoration-chain',
  'smoke-injury-update-and-resolution',
  'smoke-readiness-set-and-clear',
  'smoke-equipment-clear-and-reapply',
  'smoke-session-feedback-receipt',
  'smoke-repeat-week-phase-transition-and-restore',
] as const;

const completeResult = (): ExplorerRuntimeResult => ({
  status: 'complete',
  reasonCode: 'scenario_complete',
  manifestSemanticHash: 'sha256:test' as ExplorerRuntimeResult['manifestSemanticHash'],
  failedStepId: null,
  firstDivergentProjection: null,
  actionRecords: [],
  artifactAssembly: {} as NonNullable<ExplorerRuntimeResult['artifactAssembly']>,
  artifactBundle: {} as NonNullable<ExplorerRuntimeResult['artifactBundle']>,
});
const blockedResult = (reasonCode: string): ExplorerRuntimeResult => ({
  ...completeResult(), status: 'blocked', reasonCode, artifactBundle: null,
});

async function main() {
  console.log('\n-- Explorer live launch wiring --');

  await test('no launch-critical live-host seam remains unavailable', () => {
    const entry = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerLiveScenarioRuntime.ts'), 'utf8');
    const host = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerCanonicalLiveHost.ts'), 'utf8');
    expect(!/function\s+unavailable|=>\s*unavailable\(/.test(`${entry}\n${host}`),
      'a live-host launch seam is still bound to unavailable()');
    for (const seam of [
      'readEligibilityWitnessState', 'captureOracleContext',
      'checkpointScenarioStep', 'coldReloadScenarioSessionV2',
      'assembleActionEvidence', 'assembleScenarioArtifact',
      'persistActionIngressRequest', 'waitForExternalActionIngress',
    ]) {
      expect(host.includes(`${seam}:`), `${seam} is not installed by the canonical host`);
    }
  });

  await test('scenario-session V2 resolves exactly all nine smoke IDs', () => {
    expect(EXPLORER_DEV_E2E_SCENARIO_MANIFESTS.length === 9, 'live registry count changed');
    expect(EXACT_IDS.every((id, index) =>
      EXPLORER_DEV_E2E_SCENARIO_MANIFESTS[index]?.scenarioId === id &&
      resolveDevE2EScenarioManifest(id)?.protocolVersion === 2),
    'an exact smoke ID is missing or registry order drifted');
    expect(DEV_E2E_SCENARIO_MANIFESTS.length >= 9, 'combined registry lost Explorer entries');
  });

  await test('deterministic dev routes reach the real scenario and campaign callers', () => {
    expect(parseDevE2EEntryRoute(
      `localfootyathlete://e2e/explorer/run/${EXACT_IDS[0]}`)?.kind === 'explorer_run',
    'single live route did not parse');
    expect(parseDevE2EEntryRoute(
      'localfootyathlete://e2e/explorer/run-all-nine')?.kind === 'explorer_campaign',
    'campaign route did not parse');
    const source = readFileSync(resolve(process.cwd(), 'src/dev/e2e/devE2EEntry.tsx'), 'utf8');
    expect(source.includes('await runLiveExplorerScenario({') &&
      source.includes('await runLiveExplorerCampaign(coordinator)'),
    'entry route no longer calls the live runtime owners');
  });

  await test('live production registry owns every action adapter', () => {
    const bindings = createExplorerProductionBindings();
    for (const [actionType, owner] of Object.entries(EXPLORER_PRODUCTION_OWNER_BY_ACTION)) {
      const adapter = bindings.adapters[actionType as keyof typeof bindings.adapters];
      expect(adapter.owner === owner, `${actionType} is not bound to ${owner}`);
    }
  });

  await test('all fifteen live actions remain on canonical production bindings', () => {
    const actions = EXPLORER_NON_COACH_SMOKE_MANIFESTS.flatMap((manifest) =>
      manifest.steps.map((step) => step.action.type));
    expect(actions.length === 15, `expected 15 live actions, received ${actions.length}`);
    expect(actions.every((actionType) =>
      Object.prototype.hasOwnProperty.call(EXPLORER_PRODUCTION_OWNER_BY_ACTION, actionType)),
    'a live action bypasses explorerProductionBindings');
  });

  await test('live host cannot invoke production bindings directly', () => {
    const live = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerLiveScenarioRuntime.ts'), 'utf8');
    const host = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerCanonicalLiveHost.ts'), 'utf8');
    const runtime = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerRuntime.ts'), 'utf8');
    const uiIngress = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/ExplorerActionIngressControl.tsx'), 'utf8');
    expect(live.includes('createExplorerLiveScenarioRunner') &&
      !live.includes('createExplorerProductionScenarioRunner') &&
      !live.includes('createExplorerProductionBindings') &&
      !live.includes('executeProductionAction'),
    'live runtime retained a direct production capability');
    expect(host.includes('waitForExternalActionIngress:') &&
      !host.includes('executeProductionAction') &&
      !host.includes('actionBridge.execute'),
    'canonical live host can invoke a production binding');
    expect(runtime.includes("actionExecutionMode: 'synthetic-direct-adapter'") &&
      runtime.includes("actionExecutionMode: 'live-external-action-ingress'"),
    'live and synthetic action execution are not distinct types');
    expect(uiIngress.includes('onPress={onPress}') &&
      uiIngress.includes('createExplorerProductionBindings()') &&
      uiIngress.includes('gate.claimAndStart({'),
    'the tapped UI ingress does not own production action start');
  });

  await test('action receipt correlation never selects a newest receipt', () => {
    const ingress = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerActionIngress.ts'), 'utf8');
    expect(ingress.includes('productionReceipt.traceV2RootId !== claim.actionTraceId') &&
      !/newest|mostRecent|most_recent|\.at\(-1\)/.test(ingress),
    'action ingress correlates by recency instead of exact claim/trace identity');
  });

  await test('all manifest controls and render witnesses are semantic identity selectors', () => {
    const stale = new Set([
      'plan-change-delete-confirm', 'plan-change-result-message', 'exercise-edit-sheet',
      'day-workout-visible-exercises', 'fixture-move-action', 'home-fixture-visible-state',
      'coach-note-confirm-clear', 'home-week-readiness-entry', 'readiness-clear-action',
      'equipment-clear-action', 'equipment-preset-bodyweight-only', 'feedback-save-action',
      'session-feedback-panel', 'program-week-repeat', 'repeat-week-restore',
    ]);
    const selectors = EXPLORER_NON_COACH_SMOKE_MANIFESTS.flatMap((manifest) =>
      manifest.steps.flatMap((step) => [step.controlTestId, ...(step.targetTestIds ?? [])]));
    expect(selectors.every((selector) => !stale.has(selector)), 'a stale generic selector remains');
    expect(selectors.every((selector) => /-[a-z0-9]/.test(selector)),
      'a selector lacks a semantic identity suffix');
  });

  await test('eligible Explorer sessions publish both live marker names', () => {
    __resetDevE2EStateForTest();
    setDevE2EScenarioReady({
      scenarioId: EXACT_IDS[0], seedId: 'lower-body-deletion',
      nextStepId: 'delete-whole-session', eligibilityStatus: 'eligible',
      eligibilityReasonCode: 'eligible',
    });
    const markers = devE2EMarkers(getDevE2EStateSnapshot());
    expect(markers.includes(`e2e-next-action-eligible-${EXACT_IDS[0]}-delete-whole-session`),
      'legacy eligibility marker missing');
    expect(markers.includes(`e2e-explorer-next-action-eligible-${EXACT_IDS[0]}-delete-whole-session`),
      'Explorer eligibility marker missing');
  });

  await test('campaign retries one whole scenario only for infrastructure failure', async () => {
    const attempts = new Map<string, number>();
    const result = await runAllExplorerSmokeScenarios({ runner: { run: async (scenarioId) => {
      const count = (attempts.get(scenarioId) ?? 0) + 1;
      attempts.set(scenarioId, count);
      return scenarioId === EXACT_IDS[0] && count === 1
        ? blockedResult('checkpoint_failed') : completeResult();
    } } });
    expect(result.status === 'complete', 'proved infrastructure retry did not recover');
    expect(attempts.get(EXACT_IDS[0]) === 2, 'whole scenario was not retried exactly once');
    expect([...attempts.values()].slice(1).every((count) => count === 1),
      'a successful scenario was retried');
  });

  await test('campaign hard stop prevents any later scenario action', async () => {
    let now = 0;
    let calls = 0;
    const result = await runAllExplorerSmokeScenarios({
      nowMs: () => now,
      runner: { run: async () => {
        calls += 1;
        now = EXPLORER_CAMPAIGN_HARD_STOP_MS;
        return completeResult();
      } },
    });
    expect(result.reasonCode === 'campaign_hard_stop_expired', 'hard stop was not enforced');
    expect(calls === 1, 'campaign ran another scenario beyond the hard stop');
  });

  await test('Maestro common flows use the final scenario-complete marker', () => {
    const finalFlow = readFileSync(resolve(
      process.cwd(), '.maestro/common/scenario-final-checkpoint-and-reload.yaml'), 'utf8');
    const campaign = readFileSync(resolve(
      process.cwd(), '.maestro/golden/explorer-all-nine.yaml'), 'utf8');
    expect(finalFlow.includes('e2e-scenario-complete-${SCENARIO_ID}') &&
      !finalFlow.includes('e2e-next-action-eligible-${SCENARIO_ID}-${NEXT_STEP_ID}'),
    'final reload waits for a next-action marker');
    expect(EXACT_IDS.every((id) => campaign.includes(id)), 'all-nine Maestro flow is incomplete');
  });

  await test('scenario completion is gated by hard-oracle summary and artifact validation', () => {
    const runtime = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerRuntime.ts'), 'utf8');
    const entry = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerLiveScenarioRuntime.ts'), 'utf8');
    const runner = readFileSync(resolve(
      process.cwd(), 'scripts/run-explorer-nine-live.ts'), 'utf8');
    expect(runtime.includes('const scenarioEndSummary = summarizeExplorerOracleEvaluations('),
      'scenario-end hard-oracle gate is missing');
    expect(entry.includes('result.status === \'complete\' && result.artifactBundle') &&
      entry.includes('setDevE2EExplorerArtifactAccepted(args.scenarioId)'),
    'live entry publishes success without a validated artifact bundle');
    expect(runner.includes('e2e-explorer-artifact-accepted-${args.plan.scenarioId}') &&
      runner.includes('const observedArtifactAcceptances = new Set<string>();') &&
      runner.includes('completed.every(({ plan }) =>') &&
      runner.includes('observedArtifactAcceptances.has(plan.scenarioId)'),
    'runner does not validate each artifact and the all-nine artifact set');
  });

  await test('validated artifact publication has an exact campaign-visible marker', () => {
    __resetDevE2EStateForTest();
    setDevE2EExplorerArtifactAccepted(EXACT_IDS[0]);
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
      `e2e-explorer-artifact-accepted-${EXACT_IDS[0]}`,
    ), 'validated scenario artifact marker is missing');
  });

  await test('release boundary rejects direct live execution and capture requests', () => {
    const live = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerLiveScenarioRuntime.ts'), 'utf8');
    const physical = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerPhysicalEvidenceDevBridge.ts'), 'utf8');
    const ingress = readFileSync(resolve(
      process.cwd(), 'src/dev/e2e/explorerActionIngress.ts'), 'utf8');
    expect(live.includes('explorer_live_host_release_build_rejected') &&
      live.includes('assertLiveHostAvailable();'),
    'direct Explorer live execution lacks a release refusal');
    expect(/requestExplorerPhysicalEvidence[\s\S]*if \(!available\(\)\)/.test(physical),
      'capture requests lack a release refusal');
    expect(ingress.includes('RELEASE_BUILD_REJECTED') &&
      ingress.includes('if (!available())'),
    'action ingress is exposed in release builds');
  });

  console.log(`\nExplorer live wiring: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
void main();
