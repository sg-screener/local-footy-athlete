import type { FindingSeverity, WeekFinding } from '../../rules/weekStructureValidator';

export type AllowedFindingStatus = 'info-only' | 'expected' | 'temporarily-tolerated';

export interface AllowedFindingPolicy {
  scenarioId: string;
  ruleId: string;
  severity?: FindingSeverity;
  status: AllowedFindingStatus;
  reason: string;
  messageIncludes?: string;
}

export interface AllowedFindingMatch {
  finding: WeekFinding;
  policy: AllowedFindingPolicy;
  policyKey: string;
}

export interface FindingClassification {
  allowed: AllowedFindingMatch[];
  unallowed: WeekFinding[];
}

export const WEEK_PLAN_QA_ALLOWED_FINDINGS: readonly AllowedFindingPolicy[] = [
  {
    scenarioId: 'S3',
    ruleId: 'cap_conditioningExposures_under',
    severity: 'info',
    status: 'info-only',
    reason: 'Friday game week compresses conditioning room; the week still protects game freshness and keeps team/game anchors.',
  },
  {
    scenarioId: 'S6',
    ruleId: 'cap_sprintCodExposures_under',
    severity: 'info',
    status: 'expected',
    reason: 'Early off-season low-availability scenario intentionally has no sprint/COD anchor or app-added speed.',
  },
  {
    scenarioId: 'S6',
    ruleId: 'cap_conditioningExposures_under',
    severity: 'info',
    status: 'expected',
    reason: 'Early off-season keeps one optional off-feet aerobic-base session instead of compressing extra conditioning into four available days.',
  },
  {
    scenarioId: 'S10',
    ruleId: 'cap_maxHardDays_over',
    severity: 'soft',
    status: 'temporarily-tolerated',
    reason: 'This scenario intentionally models three consecutive club trainings plus a Saturday game to expose schedule pressure.',
  },
  {
    scenarioId: 'S10',
    ruleId: 'cap_sprintCodExposures_over',
    severity: 'soft',
    status: 'temporarily-tolerated',
    reason: 'The extra sprint/COD exposure comes from team/game anchors in an overloaded club week, not app-added speed work.',
  },
];

export function allowedFindingPolicyKey(policy: AllowedFindingPolicy): string {
  return [
    policy.scenarioId,
    policy.ruleId,
    policy.severity ?? '*',
    policy.messageIncludes ?? '*',
  ].join('|');
}

export function findingSummary(finding: WeekFinding): string {
  return `[${finding.severity}] ${finding.ruleId}: ${finding.message}`;
}

export function validateAllowedFindingPolicy(
  policies: readonly AllowedFindingPolicy[] = WEEK_PLAN_QA_ALLOWED_FINDINGS,
  scenarioIds?: readonly string[],
): string[] {
  const errors: string[] = [];
  const knownScenarioIds = scenarioIds ? new Set(scenarioIds) : null;
  const seen = new Set<string>();
  const validStatuses: ReadonlySet<AllowedFindingStatus> = new Set([
    'info-only',
    'expected',
    'temporarily-tolerated',
  ]);

  for (const policy of policies) {
    const label = `${policy.scenarioId || '<missing scenario>'}:${policy.ruleId || '<missing rule>'}`;
    if (!policy.scenarioId || policy.scenarioId === '*') {
      errors.push(`${label} must be scoped to one scenario ID.`);
    } else if (knownScenarioIds && !knownScenarioIds.has(policy.scenarioId)) {
      errors.push(`${label} references an unknown scenario ID.`);
    }
    if (!policy.ruleId.trim()) {
      errors.push(`${label} must include a finding ruleId.`);
    }
    if (!policy.reason.trim()) {
      errors.push(`${label} must include a reason.`);
    }
    if (!validStatuses.has(policy.status)) {
      errors.push(`${label} has invalid status "${policy.status}".`);
    }
    if (policy.severity === 'hard_stop') {
      errors.push(`${label} may not allow hard_stop findings.`);
    }
    if (policy.severity === 'strong' && policy.status !== 'temporarily-tolerated') {
      errors.push(`${label} strong findings must be temporarily-tolerated with an explicit scenario reason.`);
    }

    const key = allowedFindingPolicyKey(policy);
    if (seen.has(key)) {
      errors.push(`${label} duplicates an allowed-finding policy key.`);
    }
    seen.add(key);
  }

  return errors;
}

function matchesPolicy(scenarioId: string, finding: WeekFinding, policy: AllowedFindingPolicy): boolean {
  return policy.scenarioId === scenarioId &&
    policy.ruleId === finding.ruleId &&
    (!policy.severity || policy.severity === finding.severity) &&
    (!policy.messageIncludes || finding.message.includes(policy.messageIncludes));
}

export function classifyValidatorFindings(
  scenarioId: string,
  findings: readonly WeekFinding[],
  policies: readonly AllowedFindingPolicy[] = WEEK_PLAN_QA_ALLOWED_FINDINGS,
): FindingClassification {
  const allowed: AllowedFindingMatch[] = [];
  const unallowed: WeekFinding[] = [];

  for (const finding of findings) {
    const policy = policies.find((candidate) => matchesPolicy(scenarioId, finding, candidate));
    if (policy) {
      allowed.push({ finding, policy, policyKey: allowedFindingPolicyKey(policy) });
    } else {
      unallowed.push(finding);
    }
  }

  return { allowed, unallowed };
}

export function findUnusedAllowedFindingPolicies(
  usedPolicyKeys: ReadonlySet<string>,
  policies: readonly AllowedFindingPolicy[] = WEEK_PLAN_QA_ALLOWED_FINDINGS,
): AllowedFindingPolicy[] {
  return policies.filter((policy) => !usedPolicyKeys.has(allowedFindingPolicyKey(policy)));
}

export function renderAllowedFinding(match: AllowedFindingMatch, scenarioLabel: string): string[] {
  return [
    `     Allowed finding: ${scenarioLabel}`,
    `       Finding: ${findingSummary(match.finding)}`,
    `       Status: ${match.policy.status}`,
    `       Reason: ${match.policy.reason}`,
  ];
}
