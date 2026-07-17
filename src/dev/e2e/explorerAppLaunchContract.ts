export const EXPLORER_APP_LAUNCH_PURPOSES = [
  'initial-cold-launch',
  'scenario-reset',
  'action-reload',
  'final-step-reload',
  'infrastructure-retry',
  'diagnostic-relaunch',
] as const;

export type ExplorerAppLaunchPurpose =
  typeof EXPLORER_APP_LAUNCH_PURPOSES[number];

export function isExplorerAppLaunchPurpose(
  value: string,
): value is ExplorerAppLaunchPurpose {
  return (EXPLORER_APP_LAUNCH_PURPOSES as readonly string[]).includes(value);
}

function requireMetroUrl(metroUrl: string): string {
  if (!metroUrl) throw new Error('E2E_METRO_URL is required');
  return metroUrl;
}

export function explorerMetroDiagnosticRoute(
  purpose: ExplorerAppLaunchPurpose,
): string {
  return `localfootyathlete://e2e/explorer/diagnostics/${purpose}`;
}

export function withExplorerMetroUrl(
  deepLink: string,
  metroUrl: string,
): string {
  const selectedMetroUrl = requireMetroUrl(metroUrl);
  let parsed: URL;
  try {
    parsed = new URL(deepLink);
  } catch {
    throw new Error('Explorer deep link is invalid');
  }
  if (parsed.protocol !== 'localfootyathlete:' || parsed.hostname !== 'e2e') {
    throw new Error('Explorer deep link must use the development E2E origin');
  }
  parsed.searchParams.set('e2eMetroUrl', selectedMetroUrl);
  if (parsed.searchParams.get('e2eMetroUrl') !== selectedMetroUrl) {
    throw new Error('Explorer deep link omitted e2eMetroUrl');
  }
  return parsed.toString();
}

export function explorerMetroDiagnosticMarker(metroUrl: string): string {
  return `e2e-explorer-metro-url-${encodeURIComponent(requireMetroUrl(metroUrl))}`;
}

function assertLocalMetroUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('explorer_metro_diagnostic_url_invalid');
  }
  if (parsed.protocol !== 'http:' ||
    (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') ||
    !parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('explorer_metro_diagnostic_url_invalid');
  }
}

/** Fails before an Explorer route can reset a seed or execute a scenario. */
export function verifyExplorerMetroDiagnostic(args: {
  deepLinkMetroUrl: string | null;
  nativeMetroUrl: string | null;
}): string {
  if (!args.deepLinkMetroUrl) {
    throw new Error('explorer_metro_diagnostic_query_missing');
  }
  if (!args.nativeMetroUrl) {
    throw new Error('explorer_metro_diagnostic_native_missing');
  }
  assertLocalMetroUrl(args.deepLinkMetroUrl);
  assertLocalMetroUrl(args.nativeMetroUrl);
  if (args.deepLinkMetroUrl !== args.nativeMetroUrl) {
    throw new Error('explorer_metro_diagnostic_mismatch');
  }
  return args.nativeMetroUrl;
}

/** Launch proof is native-owned and does not depend on any deep-link route. */
export function verifyExplorerNativeLaunchDiagnostic(args: {
  nativeMetroUrl: string | null;
  resolvedMetroUrl: string | null;
  launchPurpose: string | null;
}): { metroUrl: string; launchPurpose: ExplorerAppLaunchPurpose } {
  if (!args.nativeMetroUrl) {
    throw new Error('explorer_metro_diagnostic_native_missing');
  }
  if (!args.resolvedMetroUrl) {
    throw new Error('explorer_metro_diagnostic_resolved_bundle_missing');
  }
  if (!args.launchPurpose || !isExplorerAppLaunchPurpose(args.launchPurpose)) {
    throw new Error('explorer_launch_purpose_invalid');
  }
  assertLocalMetroUrl(args.nativeMetroUrl);
  assertLocalMetroUrl(args.resolvedMetroUrl);
  if (args.nativeMetroUrl !== args.resolvedMetroUrl) {
    throw new Error('explorer_metro_diagnostic_resolved_bundle_mismatch');
  }
  return {
    metroUrl: args.nativeMetroUrl,
    launchPurpose: args.launchPurpose,
  };
}
