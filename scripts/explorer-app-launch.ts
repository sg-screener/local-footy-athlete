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

export interface ExplorerLaunchCommand {
  readonly command: string;
  readonly args: readonly string[];
}

function requireMetroUrl(metroUrl: string): string {
  if (!metroUrl) throw new Error('E2E_METRO_URL is required');
  return metroUrl;
}

function clearStateForPurpose(purpose: ExplorerAppLaunchPurpose): boolean {
  return purpose === 'initial-cold-launch';
}

/**
 * Sole Explorer process-launch command builder. The invoked flow is the only
 * Explorer-owned Maestro file allowed to contain launchApp or construct the
 * launch-time diagnostic deep link.
 */
export function buildExplorerAppLaunchCommand(args: {
  simulatorId: string;
  metroUrl: string;
  purpose: ExplorerAppLaunchPurpose;
  maestroBinary?: string;
}): ExplorerLaunchCommand {
  const metroUrl = requireMetroUrl(args.metroUrl);
  const deepLink = withExplorerMetroUrl(
    explorerMetroDiagnosticRoute(args.purpose),
    metroUrl,
  );
  if (new URL(deepLink).searchParams.get('e2eMetroUrl') !== metroUrl) {
    throw new Error('Explorer launch refused: generated deep link lacks e2eMetroUrl');
  }
  return {
    command: args.maestroBinary ?? 'maestro',
    args: [
      '--no-ansi',
      `--device=${args.simulatorId}`,
      'test',
      EXPLORER_APP_LAUNCH_FLOW,
      '-e',
      `E2E_METRO_URL=${metroUrl}`,
      '-e',
      `EXPLORER_LAUNCH_PURPOSE=${args.purpose}`,
      '-e',
      `EXPLORER_CLEAR_STATE=${String(clearStateForPurpose(args.purpose))}`,
      '-e',
      `EXPLORER_LAUNCH_DEEP_LINK=${deepLink}`,
    ],
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
