import type { AthleteActionTraceRecordV2 } from './AthleteActionTraceCoordinator';
import type { AthleteActionFailureClusterV2 } from './athleteActionFailureClustering';
import { semanticFingerprintV2 } from '../../utils/semanticFingerprintV2';

export interface AthleteActionArtifactBundleInputV2 {
  campaignId: string;
  scenarioRunId: string;
  scenarioSeed: unknown;
  actionScriptYaml: string;
  expectedOutcome: unknown;
  screenshots: Record<string, string>;
  accessibilityHierarchies: Record<string, unknown>;
  trace: AthleteActionTraceRecordV2;
  acceptedFingerprints: unknown;
  persistedFingerprints: unknown;
  postReloadResult: unknown;
  failureCluster: AthleteActionFailureClusterV2;
}

export interface AthleteActionArtifactBundleV2 {
  root: string;
  files: Record<string, string>;
}

const SENSITIVE_ARTIFACT_KEY = /(?:raw.*(?:coach|health)|coach.*text|health.*detail|medical|symptom|bodypart|injury.*detail|prescription|message|note$|description)/i;

function redactArtifactValue(value: unknown, key = ''): unknown {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    if (SENSITIVE_ARTIFACT_KEY.test(key)) {
      return {
        redacted: true,
        fingerprint: semanticFingerprintV2(value),
        length: value.length,
      };
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => redactArtifactValue(entry, key));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([childKey, child]) => [childKey, redactArtifactValue(child, childKey)]));
  }
  return String(value);
}

function json(value: unknown): string {
  return `${JSON.stringify(redactArtifactValue(value), null, 2)}\n`;
}

function safeSegment(value: string, field: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) {
    throw new Error(`invalid_artifact_${field}:${value}`);
  }
  return value;
}

function redactActionScriptYaml(value: string): string {
  return value.split('\n').map((line) => {
    const match = line.match(/^(\s*(?:message|text|coachText|healthDetails|injuryDetails)\s*:\s*)(.*)$/i);
    if (!match || !match[2].trim()) return line;
    return `${match[1]}"[redacted:${semanticFingerprintV2(match[2].trim())}]"`;
  }).join('\n');
}

/** Pure collector; a runner may write this map with its platform filesystem. */
export function collectAthleteActionArtifactBundleV2(
  input: AthleteActionArtifactBundleInputV2,
): AthleteActionArtifactBundleV2 {
  const campaign = safeSegment(input.campaignId, 'campaign');
  const scenarioRunId = safeSegment(input.scenarioRunId, 'scenario_run_id');
  const root = `artifacts/${campaign}/${scenarioRunId}`;
  const files: Record<string, string> = {
    [`${root}/scenario-seed.json`]: json(input.scenarioSeed),
    [`${root}/action-script.yaml`]: `${redactActionScriptYaml(input.actionScriptYaml).trim()}\n`,
    [`${root}/expected-outcome.json`]: json(input.expectedOutcome),
    [`${root}/athlete-action-trace-v2.json`]: json(input.trace),
    [`${root}/accepted-fingerprints.json`]: json(input.acceptedFingerprints),
    [`${root}/persisted-fingerprints.json`]: json(input.persistedFingerprints),
    [`${root}/post-reload-result.json`]: json(input.postReloadResult),
    [`${root}/failure-cluster.json`]: json(input.failureCluster),
  };
  for (const [name, content] of Object.entries(input.screenshots)) {
    const filename = safeSegment(name, 'screenshot_name');
    files[`${root}/screenshots/${filename}`] = content;
  }
  for (const [name, hierarchy] of Object.entries(input.accessibilityHierarchies)) {
    const filename = safeSegment(name, 'hierarchy_name');
    files[`${root}/accessibility-hierarchy/${filename}`] = json(hierarchy);
  }

  const manifestPath = `${root}/manifest.json`;
  files[manifestPath] = json({
    schemaVersion: 2,
    campaignId: campaign,
    scenarioRunId,
    traceId: input.trace.traceId,
    fingerprintContract: input.trace.fingerprintContract,
    files: Object.keys(files).sort().map((path) => ({
      path: path.slice(root.length + 1),
      fingerprint: semanticFingerprintV2(files[path]),
    })),
  });
  const bundle = { root, files };
  assertAthleteActionArtifactBundleV2(bundle);
  return bundle;
}

export function assertAthleteActionArtifactBundleV2(
  bundle: AthleteActionArtifactBundleV2,
): void {
  const exact = [
    'manifest.json',
    'scenario-seed.json',
    'action-script.yaml',
    'expected-outcome.json',
    'athlete-action-trace-v2.json',
    'accepted-fingerprints.json',
    'persisted-fingerprints.json',
    'post-reload-result.json',
    'failure-cluster.json',
  ];
  const missing = exact.filter((name) => !bundle.files[`${bundle.root}/${name}`]?.trim());
  const paths = Object.keys(bundle.files);
  if (!paths.some((path) => path.startsWith(`${bundle.root}/screenshots/`) && bundle.files[path])) {
    missing.push('screenshots/<required>');
  }
  if (!paths.some((path) =>
    path.startsWith(`${bundle.root}/accessibility-hierarchy/`) && bundle.files[path])) {
    missing.push('accessibility-hierarchy/<required>');
  }
  if (missing.length > 0) {
    throw new Error(`athlete_action_artifact_contract_missing:${missing.join(',')}`);
  }
}
