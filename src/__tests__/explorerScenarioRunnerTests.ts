import {
  EXPLORER_LIVE_ARTIFACT_REASON,
  createExplorerProductionScenarioRunner,
  explorerCoachFlowIsDisabled,
  preflightExplorerSmokeScenarios,
} from '../dev/e2e/explorerScenarioRunner';
import {
  EXPLORER_NON_COACH_SMOKE_MANIFESTS,
} from '../dev/e2e/explorerSmokeScenarioManifests';
import {
  EXPLORER_RUNTIME_REASON,
  type ExplorerRuntimeDependencies,
} from '../dev/e2e/explorerRuntime';

let passed = 0;
let failed = 0;

async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`, error);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  console.log('\n-- Explorer production scenario runner --');

  await test('all nine manifests are executable with explicit live-artifact incompleteness', () => {
    const receipts = preflightExplorerSmokeScenarios();
    expect(receipts.length === 9, `expected nine manifests, got ${receipts.length}`);
    expect(receipts.every((receipt) =>
      receipt.status === 'executable-incomplete-live-artifacts' &&
      receipt.reasonCode === EXPLORER_LIVE_ARTIFACT_REASON &&
      receipt.ownerBindingsComplete &&
      receipt.semanticRenderBindingsComplete &&
      !receipt.externalArtifacts.complete &&
      receipt.externalArtifacts.screenshot === 'required-live' &&
      receipt.externalArtifacts.accessibilityHierarchy === 'required-live'),
    'a manifest was falsely complete or lacked a production/render binding');
    expect(receipts.reduce((count, receipt) => count + receipt.actionTypes.length, 0) === 15,
      'the nine manifests did not cover 15 actions');
  });

  await test('preflight reruns are deterministic', () => {
    const first = JSON.stringify(preflightExplorerSmokeScenarios());
    const second = JSON.stringify(preflightExplorerSmokeScenarios());
    expect(first === second, 'preflight result changed for the same manifests');
  });

  await test('the three-reload chain preserves strict action and linkage order', () => {
    const chain = EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((manifest) =>
      manifest.scenarioId ===
        'smoke-multi-reload-fixture-session-restoration-chain')!;
    expect(chain.steps.map((step) => step.stepId).join('|') === [
      'move-fixture',
      'delete-following-monday-session',
      'restore-fixture-adjustment',
    ].join('|'), 'three-reload step order changed');
    expect(chain.steps.every((step) =>
      step.checkpointPolicy.kind === 'durable' &&
      step.checkpointPolicy.reload === 'required'),
    'a chain step no longer requires a durable reload');
    for (let index = 1; index < chain.steps.length; index += 1) {
      const priorStepId = chain.steps[index - 1].stepId;
      expect(chain.steps[index].oracleAssertions.some((oracle) =>
        oracle.type === 'prior-trace-linkage' &&
        oracle.priorStepId === priorStepId),
      `TraceV2 prior linkage missing at ${chain.steps[index].stepId}`);
    }
  });

  await test('every multi-step manifest requires TraceV2 prior-action linkage', () => {
    for (const manifest of EXPLORER_NON_COACH_SMOKE_MANIFESTS) {
      for (let index = 1; index < manifest.steps.length; index += 1) {
        expect(manifest.steps[index].oracleAssertions.some((oracle) =>
          oracle.type === 'prior-trace-linkage' &&
          oracle.priorStepId === manifest.steps[index - 1].stepId),
        `missing prior trace oracle: ${manifest.scenarioId}:${manifest.steps[index].stepId}`);
      }
    }
  });

  await test('Coach flow ten remains capability-disabled and absent', () => {
    expect(explorerCoachFlowIsDisabled(), 'Coach capability or manifest was enabled');
    expect(EXPLORER_NON_COACH_SMOKE_MANIFESTS.every((manifest) =>
      manifest.steps.every((step) => step.action.type !== 'coach.message')),
    'Coach action leaked into smoke manifests');
  });

  await test('unknown scenarios block before reset or owner execution', async () => {
    let resetCalls = 0;
    const hostDependencies = {
      resetSeedOnce: async () => {
        resetCalls += 1;
        throw new Error('must not reset unknown scenario');
      },
    } as unknown as Omit<
      ExplorerRuntimeDependencies,
      'loadManifest' | 'actionBridge' | 'waitForReactRender'
    >;
    const runner = createExplorerProductionScenarioRunner({ hostDependencies });
    const result = await runner.run('unknown-explorer-scenario');
    expect(result.status === 'blocked' &&
      result.reasonCode === EXPLORER_RUNTIME_REASON.MANIFEST_NOT_FOUND,
    'unknown scenario did not fail closed');
    expect(resetCalls === 0, 'unknown scenario reseeded state');
  });

  console.log(`\nExplorer production scenario runner: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
