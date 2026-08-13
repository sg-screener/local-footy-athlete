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
  // RETIRED 2026-08-13 (census C4). This row said the quiet part: *"Early
  // off-season low-availability scenario intentionally has no sprint/COD
  // anchor or app-added speed."* — which is Sam's own exemption, written into a
  // TEST POLICY because the code had no way to express it. The finding's own
  // shipped sentence has always read *"zero is valid only in early off-season
  // or with an authorised reduction"*, and `auditWeekAgainstCaps` now takes a
  // typed `sprintFloorExemption` for exactly that case, so the week no longer
  // produces the finding at all.
  //
  // **THIS FILE WAS THE FOURTH PLACE THE EXEMPTION LIVED WITHOUT BEING
  // EXECUTABLE** — after the athlete's sentence, the row comment, and the
  // untested intent. Removing the row is what makes the rule real; leaving it
  // would keep a stale allowance that could later excuse a finding the app is
  // no longer entitled to make. The S6 CONDITIONING row below stays: the
  // conditioning floor has no such exemption, and inventing one is not this
  // unit's business.
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
  {
    // ADDED 2026-08-13 with S7's re-phasing (item 31). S7 was an OFF-SEASON week
    // carrying three team trainings — a week Sam has ruled cannot exist — and
    // moving it to Pre-season, where three club sessions are legal, surfaced this
    // finding for the first time. It is NOT tolerated debt: five hard days is the
    // PERMITTED maximum (Bible :118, prefer 4 / permit 5) and the validator grades
    // it `info` for exactly that reason. Six would be a different finding and a
    // different sentence — see planChangeRefusalCopy, ruled the same day.
    scenarioId: 'S7',
    ruleId: 'cap_maxHardDays_over',
    severity: 'info',
    status: 'expected',
    reason: 'Six available days with three club trainings legally reaches five hard days; five is the permitted maximum, which is why the validator grades it info rather than soft.',
    messageIncludes: 'absolute max',
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
