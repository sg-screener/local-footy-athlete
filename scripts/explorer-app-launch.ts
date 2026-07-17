import {
  EXPLORER_APP_LAUNCH_PURPOSES,
  explorerMetroDiagnosticMarker,
  explorerMetroDiagnosticRoute,
  withExplorerMetroUrl,
  type ExplorerAppLaunchPurpose,
} from '../src/dev/e2e/explorerAppLaunchContract';

export {
  EXPLORER_APP_LAUNCH_PURPOSES,
  explorerMetroDiagnosticMarker,
  explorerMetroDiagnosticRoute,
  withExplorerMetroUrl,
  type ExplorerAppLaunchPurpose,
};

export const EXPLORER_APP_LAUNCH_FLOW =
  '.maestro/common/launch-explorer-app.yaml';
export const EXPLORER_APP_CLEAR_STATE_FLOW =
  '.maestro/common/clear-explorer-app-state.yaml';

export interface ExplorerLaunchCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export type ExplorerAppStatePolicy = 'clear' | 'preserve';

export interface ExplorerAppLaunchPlan {
  readonly purpose: ExplorerAppLaunchPurpose;
  readonly statePolicy: ExplorerAppStatePolicy;
  readonly commands: readonly ExplorerLaunchCommand[];
}

const EXPLORER_APP_STATE_POLICY_BY_PURPOSE: Readonly<Record<
  ExplorerAppLaunchPurpose,
  ExplorerAppStatePolicy
>> = {
  'initial-cold-launch': 'clear',
  'scenario-reset': 'preserve',
  'action-reload': 'preserve',
  'final-step-reload': 'preserve',
  'infrastructure-retry': 'preserve',
  'diagnostic-relaunch': 'preserve',
};

function requireMetroUrl(metroUrl: string): string {
  if (!metroUrl) throw new Error('E2E_METRO_URL is required');
  return metroUrl;
}

function statePolicyForPurpose(
  purpose: ExplorerAppLaunchPurpose,
): ExplorerAppStatePolicy {
  return EXPLORER_APP_STATE_POLICY_BY_PURPOSE[purpose];
}

function buildMaestroFlowCommand(args: {
  simulatorId: string;
  flow: string;
  maestroBinary?: string;
  environment?: readonly string[];
}): ExplorerLaunchCommand {
  return {
    command: args.maestroBinary ?? 'maestro',
    args: [
      '--no-ansi',
      `--device=${args.simulatorId}`,
      'test',
      args.flow,
      ...(args.environment ?? []),
    ],
  };
}

/**
 * Sole Explorer process-launch plan builder. State clearing is a separate,
 * literal Maestro command and the launch flow remains the only Explorer-owned
 * Maestro file allowed to contain launchApp or construct the diagnostic link.
 */
export function buildExplorerAppLaunchPlan(args: {
  simulatorId: string;
  metroUrl: string;
  purpose: ExplorerAppLaunchPurpose;
  maestroBinary?: string;
}): ExplorerAppLaunchPlan {
  const metroUrl = requireMetroUrl(args.metroUrl);
  const deepLink = withExplorerMetroUrl(
    explorerMetroDiagnosticRoute(args.purpose),
    metroUrl,
  );
  if (new URL(deepLink).searchParams.get('e2eMetroUrl') !== metroUrl) {
    throw new Error('Explorer launch refused: generated deep link lacks e2eMetroUrl');
  }
  const launchCommand = buildMaestroFlowCommand({
    simulatorId: args.simulatorId,
    flow: EXPLORER_APP_LAUNCH_FLOW,
    maestroBinary: args.maestroBinary,
    environment: [
      '-e',
      `E2E_METRO_URL=${metroUrl}`,
      '-e',
      `EXPLORER_LAUNCH_PURPOSE=${args.purpose}`,
      '-e',
      `EXPLORER_LAUNCH_DEEP_LINK=${deepLink}`,
    ],
  });
  const statePolicy = statePolicyForPurpose(args.purpose);
  return {
    purpose: args.purpose,
    statePolicy,
    commands: statePolicy === 'clear'
      ? [buildMaestroFlowCommand({
          simulatorId: args.simulatorId,
          flow: EXPLORER_APP_CLEAR_STATE_FLOW,
          maestroBinary: args.maestroBinary,
        }), launchCommand]
      : [launchCommand],
  };
}

/** Sole command builder for Explorer deep links delivered to a running app. */
export function buildExplorerDeepLinkCommand(args: {
  simulatorId: string;
  metroUrl: string;
  deepLink: string;
}): ExplorerLaunchCommand {
  const url = withExplorerMetroUrl(args.deepLink, args.metroUrl);
  if (new URL(url).searchParams.get('e2eMetroUrl') !== args.metroUrl) {
    throw new Error('Explorer deep link omitted e2eMetroUrl');
  }
  return {
    command: 'xcrun',
    args: ['simctl', 'openurl', args.simulatorId, url],
  };
}
