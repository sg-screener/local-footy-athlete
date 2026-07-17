import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import yaml from 'js-yaml';
import {
  EXPLORER_APP_CLEAR_STATE_FLOW,
  EXPLORER_APP_LAUNCH_FLOW,
  buildExplorerAppLaunchPlan,
  explorerMetroDiagnosticRoute,
  withExplorerMetroUrl,
  type ExplorerAppLaunchPlan,
  type ExplorerAppLaunchPurpose,
} from '../../scripts/explorer-app-launch';

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

function expect(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

const root = resolve(__dirname, '..', '..');
const clearFlowPath = resolve(root, EXPLORER_APP_CLEAR_STATE_FLOW);
const launchFlowPath = resolve(root, EXPLORER_APP_LAUNCH_FLOW);
const explorerLaunchFlowPaths = [
  clearFlowPath,
  launchFlowPath,
  resolve(root, '.maestro/common/reset-scenario.yaml'),
  resolve(root, '.maestro/common/run-explorer-scenario.yaml'),
  resolve(root, '.maestro/common/scenario-checkpoint-and-reload.yaml'),
  resolve(root, '.maestro/common/scenario-final-checkpoint-and-reload.yaml'),
  resolve(root, '.maestro/common/relaunch-explorer-diagnostics.yaml'),
] as const;

function parseCommands(source: string): readonly unknown[] {
  const documents: unknown[] = [];
  yaml.loadAll(source, (document) => documents.push(document));
  if (documents.length !== 2 || !Array.isArray(documents[1])) {
    throw new Error('expected a Maestro header and command document');
  }
  return documents[1];
}

function launchAppClearStateValues(source: string): readonly unknown[] {
  const values: unknown[] = [];
  for (const command of parseCommands(source)) {
    if (!command || typeof command !== 'object' || Array.isArray(command)) continue;
    const launchApp = (command as Record<string, unknown>).launchApp;
    if (!launchApp || typeof launchApp !== 'object' || Array.isArray(launchApp)) continue;
    if (Object.prototype.hasOwnProperty.call(launchApp, 'clearState')) {
      values.push((launchApp as Record<string, unknown>).clearState);
    }
  }
  return values;
}

function isMaestro251CompatibleLaunchFlow(source: string): boolean {
  try {
    return launchAppClearStateValues(source).length === 0;
  } catch {
    return false;
  }
}

function flowPathForCommand(
  plan: ExplorerAppLaunchPlan,
  commandIndex: number,
): string | null {
  const command = plan.commands[commandIndex];
  if (!command) return null;
  const testIndex = command.args.indexOf('test');
  return testIndex < 0 ? null : command.args[testIndex + 1] ?? null;
}

function expandedClearStateCount(plan: ExplorerAppLaunchPlan): number {
  return plan.commands.reduce((count, _command, index) => {
    const flowPath = flowPathForCommand(plan, index);
    if (!flowPath) return count;
    const commands = parseCommands(readFileSync(resolve(root, flowPath), 'utf8'));
    return count + commands.filter((command) => command === 'clearState').length;
  }, 0);
}

function repositoryFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' ||
      entry.name === 'artifacts') return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? repositoryFiles(path) : [path];
  });
}

const expectedStatePolicy: Readonly<Record<
  ExplorerAppLaunchPurpose,
  'clear' | 'preserve'
>> = {
  'initial-cold-launch': 'clear',
  'scenario-reset': 'preserve',
  'action-reload': 'preserve',
  'final-step-reload': 'preserve',
  'infrastructure-retry': 'preserve',
  'diagnostic-relaunch': 'preserve',
};

async function main(): Promise<void> {
  console.log('\n-- Explorer launch ownership and Maestro 2.5.1 compatibility --');

  await test('canonical launchApp has no clearState field', () => {
    const launchSource = readFileSync(launchFlowPath, 'utf8');
    expect(launchSource.includes('launchApp:') &&
      launchSource.includes('e2eMetroUrl: "${E2E_METRO_URL}"') &&
      launchAppClearStateValues(launchSource).length === 0,
    'canonical launch flow retained launchApp.clearState');
  });

  await test('one static prelude owns the literal clearState command', () => {
    const literalOwners = repositoryFiles(resolve(root, '.maestro'))
      .filter((path) => /\.ya?ml$/.test(path))
      .filter((path) =>
        parseCommands(readFileSync(path, 'utf8')).includes('clearState'));
    const preludeCommands = parseCommands(readFileSync(clearFlowPath, 'utf8'));
    expect(literalOwners.length === 1 && literalOwners[0] === clearFlowPath &&
      preludeCommands.length === 1 && preludeCommands[0] === 'clearState',
    'literal clearState ownership is not exclusive to the static prelude');
  });

  await test('Explorer launchApp ownership is exclusive to the canonical flow', () => {
    const launchOwners = explorerLaunchFlowPaths.filter((path) =>
      parseCommands(readFileSync(path, 'utf8')).some((command) =>
        Boolean(command && typeof command === 'object' && !Array.isArray(command) &&
          Object.prototype.hasOwnProperty.call(command, 'launchApp'))));
    expect(launchOwners.length === 1 && launchOwners[0] === launchFlowPath,
      'an Explorer Maestro flow constructs launchApp outside the canonical flow');
  });

  await test('the removed clear-state environment variable cannot return', () => {
    const removedName = ['EXPLORER', 'CLEAR', 'STATE'].join('_');
    const owners = repositoryFiles(root).filter((path) => {
      try {
        return readFileSync(path, 'utf8').includes(removedName);
      } catch {
        return false;
      }
    });
    expect(owners.length === 0,
      `removed interpolation remains in ${owners.map((path) =>
        relative(root, path)).join(', ')}`);
  });

  await test('all six typed purposes generate exactly one compatible launch', () => {
    const metroUrl = 'http://127.0.0.1:8082';
    for (const [purpose, statePolicy] of Object.entries(expectedStatePolicy) as
      Array<[ExplorerAppLaunchPurpose, 'clear' | 'preserve']>) {
      const plan = buildExplorerAppLaunchPlan({
        simulatorId: 'simulator-1',
        metroUrl,
        purpose,
      });
      const launchCommands = plan.commands.filter((command) =>
        command.args.includes(EXPLORER_APP_LAUNCH_FLOW));
      const clearCommands = plan.commands.filter((command) =>
        command.args.includes(EXPLORER_APP_CLEAR_STATE_FLOW));
      const expectedDeepLink = withExplorerMetroUrl(
        explorerMetroDiagnosticRoute(purpose),
        metroUrl,
      );
      expect(plan.purpose === purpose && plan.statePolicy === statePolicy,
        `${purpose} changed its typed state policy`);
      expect(launchCommands.length === 1,
        `${purpose} did not generate exactly one canonical launch`);
      expect(launchCommands[0]?.args.includes(`E2E_METRO_URL=${metroUrl}`) === true &&
        launchCommands[0]?.args.includes(`EXPLORER_LAUNCH_PURPOSE=${purpose}`) === true &&
        launchCommands[0]?.args.includes(
          `EXPLORER_LAUNCH_DEEP_LINK=${expectedDeepLink}`,
        ) === true,
      `${purpose} lost Metro URL, native argument source, query, or identity`);
      expect(new URL(expectedDeepLink).searchParams.get('e2eMetroUrl') === metroUrl,
        `${purpose} deep link does not match the selected Metro URL`);
      expect(clearCommands.length === (statePolicy === 'clear' ? 1 : 0) &&
        expandedClearStateCount(plan) === (statePolicy === 'clear' ? 1 : 0),
      `${purpose} generated the wrong clearState execution count`);
      expect(plan.commands.every((command) =>
        !command.args.some((argument) => /clear.?state=(?:true|false|1|0)/i.test(argument))),
      `${purpose} generated a textual clear-state substitution`);
    }
  });

  await test('reload preservation cannot execute the clear-state prelude', () => {
    for (const purpose of ['action-reload', 'final-step-reload'] as const) {
      const plan = buildExplorerAppLaunchPlan({
        simulatorId: 'simulator-1',
        metroUrl: 'http://127.0.0.1:8082',
        purpose,
      });
      expect(plan.commands.length === 1 &&
        flowPathForCommand(plan, 0) === EXPLORER_APP_LAUNCH_FLOW &&
        expandedClearStateCount(plan) === 0,
      `${purpose} clears state during preservation`);
    }
  });

  await test('Maestro 2.5.1 failure shapes are permanently rejected', () => {
    const interpolation = '${CLEAR_STATE}';
    const incompatible = [
      `appId: app\n---\n- launchApp:\n    clearState: "${interpolation}"\n`,
      `appId: app\n---\n- launchApp:\n    clearState: ${interpolation}\n`,
      'appId: app\n---\n- launchApp:\n    clearState: "true"\n',
      'appId: app\n---\n- launchApp:\n    clearState: "false"\n',
      'appId: app\n---\n- launchApp:\n    clearState: "1"\n',
      'appId: app\n---\n- launchApp:\n    clearState: "0"\n',
    ];
    expect(incompatible.every((source) =>
      !isMaestro251CompatibleLaunchFlow(source)),
    'a string/interpolated launchApp.clearState shape was accepted');
    expect(isMaestro251CompatibleLaunchFlow(readFileSync(launchFlowPath, 'utf8')),
      'canonical launch flow is not Maestro 2.5.1 compatible');
  });

  await test('only the TypeScript builder selects clear versus preserve', () => {
    const builder = readFileSync(
      resolve(root, 'scripts/explorer-app-launch.ts'),
      'utf8',
    );
    const runner = readFileSync(
      resolve(root, 'scripts/run-explorer-nine-live.ts'),
      'utf8',
    );
    const clearFlowProductionOwners = repositoryFiles(root).filter((path) =>
      /\.(?:ts|tsx|js|mjs|cjs)$/.test(path) &&
      !path.includes(`${join('src', '__tests__')}`) &&
      readFileSync(path, 'utf8').includes('clear-explorer-app-state.yaml'));
    expect(clearFlowProductionOwners.length === 1 &&
      clearFlowProductionOwners[0] === resolve(root, 'scripts/explorer-app-launch.ts') &&
      builder.includes("statePolicy === 'clear'") &&
      runner.includes('buildExplorerAppLaunchPlan({') &&
      !runner.includes('EXPLORER_APP_CLEAR_STATE_FLOW') &&
      !runner.includes('EXPLORER_APP_LAUNCH_FLOW'),
    'clear/preserve selection or direct launch construction escaped the builder');
  });

  console.log(`\nExplorer launch ownership: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
