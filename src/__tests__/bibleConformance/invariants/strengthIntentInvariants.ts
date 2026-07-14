import { STRENGTH_BIBLE_RULES } from '../expectations/strengthRules';
import type {
  BibleRuleId,
  InvariantCheckResult,
  InvariantFailure,
  ObservedStrengthSession,
  StrengthInvariantId,
  StrengthPattern,
  StrengthScenarioTrace,
  StrengthTraceStage,
} from '../types';

const STAGES: StrengthTraceStage[] = [
  'allocation',
  'generated_fallback',
  'visible_week',
  'visible_detail',
];
const PATTERNS: StrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function canonical(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function equalSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return canonical(left).filter((value) => !rightSet.has(value));
}

function firstRule(trace: StrengthScenarioTrace): BibleRuleId {
  return trace.scenario.ruleIds[0];
}

function failure(args: Omit<InvariantFailure, 'scenarioId' | 'path'> & {
  trace: StrengthScenarioTrace;
  path?: string;
}): InvariantFailure {
  return {
    invariantId: args.invariantId,
    ruleId: args.ruleId,
    scenarioId: args.trace.scenario.id,
    stage: args.stage,
    expected: args.expected,
    actual: args.actual,
    missing: args.missing,
    extra: args.extra,
    path: args.path ?? 'deterministic allocation/fallback projection',
    planEntryId: args.planEntryId,
    day: args.day,
    detail: args.detail,
  };
}

function result(
  invariantId: StrengthInvariantId,
  trace: StrengthScenarioTrace,
  applied: boolean,
  failures: InvariantFailure[],
): InvariantCheckResult {
  return { invariantId, scenarioId: trace.scenario.id, applied, failures };
}

function byId(rows: readonly ObservedStrengthSession[], id: string): ObservedStrengthSession[] {
  return rows.filter((row) => row.planEntryId === id);
}

function contract(row: ObservedStrengthSession) {
  return {
    archetype: row.archetype,
    primaryPattern: row.primaryPattern,
    plannedPatterns: canonical(row.plannedPatterns),
  };
}

function checkPlannedContractConserved(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_PLANNED_CONTRACT_CONSERVED' as const;
  const failures: InvariantFailure[] = [];
  const allocations = trace.sessions.allocation.filter((row) => row.plannedPatterns.length > 0);

  for (const allocation of allocations) {
    for (const stage of STAGES.slice(1)) {
      const matches = byId(trace.sessions[stage], allocation.planEntryId);
      if (matches.length !== 1) continue; // Dedicated join invariant owns absence/duplication.
      const actual = matches[0];
      if (
        allocation.archetype !== actual.archetype ||
        allocation.primaryPattern !== actual.primaryPattern ||
        !equalSet(allocation.plannedPatterns, actual.plannedPatterns)
      ) {
        failures.push(failure({
          trace,
          invariantId,
          ruleId: firstRule(trace),
          stage,
          expected: contract(allocation),
          actual: contract(actual),
          missing: difference(allocation.plannedPatterns, actual.plannedPatterns),
          extra: difference(actual.plannedPatterns, allocation.plannedPatterns),
          planEntryId: allocation.planEntryId,
          day: allocation.day,
          detail: 'Allocation owns archetype, primaryPattern and plannedPatterns.',
        }));
      }
    }
  }

  if (trace.scenario.expectedAccessoryDays?.length) {
    for (const stage of STAGES) {
      for (const week of [1, 2, 3, 4]) {
        for (const day of trace.scenario.expectedAccessoryDays) {
          const row = trace.sessions[stage].find(
            (candidate) => candidate.weekInBlock === week && candidate.day === day,
          );
          if (!row) continue;
          const credited = canonical([...row.plannedPatterns, ...row.effectivePatterns]);
          if (credited.length > 0) {
            failures.push(failure({
              trace,
              invariantId,
              ruleId: 'ALL-ACCESSORY-01',
              stage,
              expected: [],
              actual: credited,
              missing: [],
              extra: credited,
              planEntryId: row.planEntryId,
              day,
              detail: 'Scenario-declared accessory day received main-pattern credit.',
            }));
          }
        }
      }
    }
  }

  return result(invariantId, trace, true, failures);
}

function checkNoSingleWinner(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_NO_SINGLE_WINNER' as const;
  const failures: InvariantFailure[] = [];
  const composite = trace.sessions.allocation.filter((row) => row.plannedPatterns.length > 1);

  for (const allocation of composite) {
    for (const stage of STAGES.slice(1)) {
      const actual = byId(trace.sessions[stage], allocation.planEntryId)[0];
      if (!actual || equalSet(allocation.plannedPatterns, actual.effectivePatterns)) continue;
      failures.push(failure({
        trace,
        invariantId,
        ruleId: firstRule(trace),
        stage,
        expected: allocation.plannedPatterns,
        actual: actual.effectivePatterns,
        missing: difference(allocation.plannedPatterns, actual.effectivePatterns),
        extra: difference(actual.effectivePatterns, allocation.plannedPatterns),
        planEntryId: allocation.planEntryId,
        day: allocation.day,
        detail: 'Healthy unconstrained Slice 1 scenarios authorise no planned-pattern loss.',
      }));
    }
  }

  return result(invariantId, trace, composite.length > 0, failures);
}

function stageLedger(rows: readonly ObservedStrengthSession[], source: 'planned' | 'effective') {
  const ledger = new Set<StrengthPattern>();
  for (const row of rows) {
    for (const pattern of row[source === 'planned' ? 'plannedPatterns' : 'effectivePatterns']) {
      ledger.add(pattern);
    }
  }
  return PATTERNS.filter((pattern) => ledger.has(pattern));
}

function checkHealthyBlockPatternBalance(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_HEALTHY_BLOCK_PATTERN_BALANCE' as const;
  const blockRule = STRENGTH_BIBLE_RULES.find((rule) =>
    rule.id === 'ALL-STR-BLOCK-01' && rule.applicableScenarios.includes(trace.scenario.id));
  const minimumRule = STRENGTH_BIBLE_RULES.find((rule) =>
    rule.id === 'IS-STR-MIN-01' && rule.applicableScenarios.includes(trace.scenario.id));
  const applied = !!blockRule || !!minimumRule;
  const failures: InvariantFailure[] = [];

  if (blockRule?.expectation.kind === 'block_patterns') {
    for (const stage of STAGES) {
      const source = stage === 'allocation' ? 'planned' : 'effective';
      const actual = stageLedger(trace.sessions[stage], source);
      const expected = blockRule.expectation.requiredPatterns;
      if (!expected.every((pattern) => actual.includes(pattern))) {
        failures.push(failure({
          trace,
          invariantId,
          ruleId: blockRule.id,
          stage,
          expected,
          actual,
          missing: difference(expected, actual),
          extra: difference(actual, expected),
          path: stage === 'allocation' ? 'deterministic allocation' : 'deterministic fallback/projection',
          detail: 'Generic Lower/Upper/Strength labels do not earn exact pattern credit.',
        }));
      }
    }
  }

  if (minimumRule?.expectation.kind === 'minimum_strength') {
    for (const stage of STAGES) {
      for (const week of [1, 2, 3, 4]) {
        const count = trace.sessions[stage].filter((row) =>
          row.weekInBlock === week &&
          (stage === 'allocation' ? row.plannedPatterns : row.effectivePatterns).length > 0,
        ).length;
        if (count < minimumRule.expectation.minimumPerWeek) {
          failures.push(failure({
            trace,
            invariantId,
            ruleId: minimumRule.id,
            stage,
            expected: { minimumPerWeek: minimumRule.expectation.minimumPerWeek },
            actual: { weekInBlock: week, mainStrengthSessions: count },
            missing: [`${minimumRule.expectation.minimumPerWeek - count} strength session(s)`],
            extra: [],
            detail: 'Accessory and recovery sessions cannot satisfy the minimum.',
          }));
        }
      }
    }
  }

  return result(invariantId, trace, applied, failures);
}

function checkFullBodyExactLedger(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_FULL_BODY_EXACT_LEDGER' as const;
  const rule = STRENGTH_BIBLE_RULES.find((candidate) =>
    candidate.id === 'ALL-FULLBODY-01' && candidate.applicableScenarios.includes(trace.scenario.id));
  if (!rule || rule.expectation.kind !== 'full_body') return result(invariantId, trace, false, []);
  const failures: InvariantFailure[] = [];

  for (const stage of STAGES) {
    for (const week of [1, 2, 3, 4]) {
      for (const day of trace.scenario.expectedFullBodyDays ?? []) {
        const row = trace.sessions[stage].find(
          (candidate) => candidate.weekInBlock === week && candidate.day === day,
        );
        const patterns = row
          ? (stage === 'allocation' ? row.plannedPatterns : row.effectivePatterns)
          : [];
        const lower = patterns.filter((pattern) => pattern === 'squat' || pattern === 'hinge');
        const expectedDescription = 'squat, hinge, push and pull';
        const valid = !!row && row.archetype === 'full_body' &&
          lower.length === rule.expectation.lowerPatternCount &&
          patterns.includes('push') && patterns.includes('pull') &&
          patterns.length === rule.expectation.lowerPatternCount + 2;
        if (!valid) {
          failures.push(failure({
            trace,
            invariantId,
            ruleId: rule.id,
            stage,
            expected: expectedDescription,
            actual: row ? { archetype: row.archetype, patterns } : null,
            missing: [
              ...(lower.length < rule.expectation.lowerPatternCount ? ['complete lower-pattern coverage'] : []),
              ...(['push', 'pull'] as StrengthPattern[]).filter((pattern) => !patterns.includes(pattern)),
            ],
            extra: lower.length > rule.expectation.lowerPatternCount
              ? lower.slice(rule.expectation.lowerPatternCount)
              : [],
            planEntryId: row?.planEntryId,
            day,
            detail: 'Scenario applicability is declared by the golden, not inferred from actual archetype.',
          }));
        }
      }
    }
  }

  return result(invariantId, trace, true, failures);
}

function checkDisplayTextNonAuthoritative(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_DISPLAY_TEXT_NON_AUTHORITATIVE' as const;
  const mutation = trace.scenario.displayMutation;
  if (!mutation) return result(invariantId, trace, false, []);
  const failures: InvariantFailure[] = [];

  for (const week of [1, 2, 3, 4]) {
    const rows = STAGES.map((stage) => trace.sessions[stage].find(
      (row) => row.weekInBlock === week && row.day === mutation.targetDay,
    )).filter((row): row is ObservedStrengthSession => !!row);
    const baseline = rows[0];
    const generated = rows.find((row) => row.stage === 'generated_fallback');
    if (!baseline) continue;
    for (const row of rows.slice(1)) {
      const valid = equalSet(baseline.plannedPatterns, row.plannedPatterns) &&
        equalSet(baseline.effectivePatterns, row.effectivePatterns) &&
        baseline.planEntryId === row.planEntryId &&
        (!generated || row.stage === 'generated_fallback' ||
          equalSet(generated.components, row.components));
      if (!valid) {
        failures.push(failure({
          trace,
          invariantId,
          ruleId: 'ALL-STR-BLOCK-01',
          stage: row.stage,
          expected: {
            planEntryId: baseline.planEntryId,
            plannedPatterns: baseline.plannedPatterns,
            effectivePatterns: baseline.effectivePatterns,
            components: generated?.components ?? [],
          },
          actual: {
            planEntryId: row.planEntryId,
            plannedPatterns: row.plannedPatterns,
            effectivePatterns: row.effectivePatterns,
            components: row.components,
          },
          missing: difference(baseline.effectivePatterns, row.effectivePatterns),
          extra: difference(row.effectivePatterns, baseline.effectivePatterns),
          planEntryId: row.planEntryId,
          day: row.day,
          detail: `Changed copy: focus="${mutation.focus}", name="${mutation.workoutName}".`,
        }));
      }
    }
  }

  return result(invariantId, trace, true, failures);
}

function checkWeekDetailAgreement(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_WEEK_DETAIL_COMPONENT_AGREEMENT' as const;
  const failures: InvariantFailure[] = [];

  for (const weekly of trace.sessions.visible_week) {
    if (!weekly.planEntryId) continue;
    const detail = byId(trace.sessions.visible_detail, weekly.planEntryId)[0];
    if (!detail) continue; // Join invariant owns missing entries.
    const weeklyHasStrength = weekly.components.includes('strength') ||
      weekly.visibleItemDomains.includes('strength');
    const detailHasStrength = detail.components.includes('strength') && detail.strengthRowNames.length > 0;
    const valid = equalSet(weekly.plannedPatterns, detail.plannedPatterns) &&
      equalSet(weekly.effectivePatterns, detail.effectivePatterns) &&
      equalSet(weekly.components, detail.components) &&
      equalSet(weekly.strengthRowNames, detail.strengthRowNames) &&
      weeklyHasStrength === detailHasStrength &&
      weekly.visibleTitle === detail.visibleTitle &&
      weekly.visibleSubtitle === detail.visibleSubtitle;
    if (!valid) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: trace.scenario.ruleIds.includes('IS-STR-MIN-01')
          ? 'IS-STR-MIN-01'
          : firstRule(trace),
        stage: 'visible_detail',
        expected: {
          effectivePatterns: weekly.effectivePatterns,
          components: weekly.components,
          strengthRows: weekly.strengthRowNames,
          title: weekly.visibleTitle,
          subtitle: weekly.visibleSubtitle,
        },
        actual: {
          effectivePatterns: detail.effectivePatterns,
          components: detail.components,
          strengthRows: detail.strengthRowNames,
          title: detail.visibleTitle,
          subtitle: detail.visibleSubtitle,
        },
        missing: difference(weekly.components, detail.components),
        extra: difference(detail.components, weekly.components),
        planEntryId: weekly.planEntryId,
        day: weekly.day,
        detail: 'Weekly-card extraction and shared workout-detail extraction disagree.',
      }));
    }
  }

  return result(invariantId, trace, true, failures);
}

function duplicateIds(rows: readonly ObservedStrengthSession[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.planEntryId) continue;
    counts.set(row.planEntryId, (counts.get(row.planEntryId) ?? 0) + 1);
  }
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([id]) => id);
}

function checkPlanEntryJoin(trace: StrengthScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_PLAN_ENTRY_JOIN_UNAMBIGUOUS' as const;
  const failures: InvariantFailure[] = [];

  for (const stage of STAGES) {
    const duplicates = duplicateIds(trace.sessions[stage]);
    if (duplicates.length > 0) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: firstRule(trace),
        stage,
        expected: 'unique non-empty planEntryId values',
        actual: duplicates,
        missing: [],
        extra: duplicates,
        detail: 'Weekday/name/index joins are forbidden.',
      }));
    }
  }

  const tracked = trace.sessions.allocation.filter((row) => row.plannedPatterns.length > 0);
  for (const allocation of tracked) {
    if (!allocation.planEntryId) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: firstRule(trace),
        stage: 'allocation',
        expected: 'one stable planEntryId',
        actual: '',
        missing: ['planEntryId'],
        extra: [],
        day: allocation.day,
      }));
      continue;
    }
    for (const stage of STAGES.slice(1)) {
      const matches = byId(trace.sessions[stage], allocation.planEntryId);
      if (matches.length === 1) continue;
      failures.push(failure({
        trace,
        invariantId,
        ruleId: firstRule(trace),
        stage,
        expected: { planEntryId: allocation.planEntryId, matches: 1 },
        actual: { planEntryId: allocation.planEntryId, matches: matches.length },
        missing: matches.length === 0 ? [allocation.planEntryId] : [],
        extra: matches.length > 1 ? [allocation.planEntryId] : [],
        planEntryId: allocation.planEntryId,
        day: allocation.day,
        detail: 'Trace stages join only through stable planEntryId.',
      }));
    }
  }

  return result(invariantId, trace, true, failures);
}

export const STRENGTH_INVARIANT_IDS: readonly StrengthInvariantId[] = [
  'INV_PLANNED_CONTRACT_CONSERVED',
  'INV_NO_SINGLE_WINNER',
  'INV_HEALTHY_BLOCK_PATTERN_BALANCE',
  'INV_FULL_BODY_EXACT_LEDGER',
  'INV_DISPLAY_TEXT_NON_AUTHORITATIVE',
  'INV_WEEK_DETAIL_COMPONENT_AGREEMENT',
  'INV_PLAN_ENTRY_JOIN_UNAMBIGUOUS',
];

export function evaluateStrengthTrace(trace: StrengthScenarioTrace): InvariantCheckResult[] {
  return [
    checkPlannedContractConserved(trace),
    checkNoSingleWinner(trace),
    checkHealthyBlockPatternBalance(trace),
    checkFullBodyExactLedger(trace),
    checkDisplayTextNonAuthoritative(trace),
    checkWeekDetailAgreement(trace),
    checkPlanEntryJoin(trace),
  ];
}

export function firstInvariantFailure(results: readonly InvariantCheckResult[]): InvariantFailure | null {
  const failures = results.flatMap((result) => result.failures);
  return failures.sort((left, right) => STAGES.indexOf(left.stage) - STAGES.indexOf(right.stage))[0] ?? null;
}
