import { COMPONENT_BIBLE_RULES } from '../expectations/componentRules';
import type {
  BibleComponentRule,
  ComponentInvariantId,
  ComponentScenarioTrace,
  HarnessSessionComponent,
  InvariantCheckResult,
  InvariantFailure,
  ObservedStrengthSession,
  StrengthPattern,
  StrengthTraceStage,
} from '../types';

const STAGES: StrengthTraceStage[] = [
  'allocation',
  'generated_fallback',
  'visible_week',
  'visible_detail',
];

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

function target(
  trace: ComponentScenarioTrace,
  stage: StrengthTraceStage,
): ObservedStrengthSession | null {
  return trace.sessions[stage].find((row) =>
    row.weekInBlock === trace.scenario.target.weekInBlock &&
    row.day === trace.scenario.target.day) ?? null;
}

function rule(trace: ComponentScenarioTrace, id: BibleComponentRule['id']): BibleComponentRule | null {
  return COMPONENT_BIBLE_RULES.find((candidate) =>
    candidate.id === id && candidate.applicableScenarios.includes(trace.scenario.id)) ?? null;
}

function firstRule(trace: ComponentScenarioTrace): BibleComponentRule['id'] {
  return trace.scenario.ruleIds[0];
}

function failure(args: {
  trace: ComponentScenarioTrace;
  invariantId: ComponentInvariantId;
  ruleId: BibleComponentRule['id'];
  stage: StrengthTraceStage;
  expected: unknown;
  actual: unknown;
  missing?: string[];
  extra?: string[];
  row?: ObservedStrengthSession | null;
  detail?: string;
  weekComponents?: HarnessSessionComponent[];
  detailComponents?: HarnessSessionComponent[];
}): InvariantFailure {
  return {
    invariantId: args.invariantId,
    ruleId: args.ruleId,
    scenarioId: args.trace.scenario.id,
    stage: args.stage,
    expected: args.expected,
    actual: args.actual,
    missing: args.missing ?? [],
    extra: args.extra ?? [],
    path: args.stage === 'allocation'
      ? 'deterministic allocation'
      : args.stage === 'generated_fallback'
        ? 'deterministic fallback'
        : 'visible program projection',
    planEntryId: args.row?.planEntryId,
    day: args.row?.day ?? args.trace.scenario.target.day,
    detail: args.detail,
    weekComponents: args.weekComponents,
    detailComponents: args.detailComponents,
    row: args.row?.conditioningRowNames.find((name) => args.row?.strengthRowNames.includes(name)),
  };
}

function result(
  invariantId: ComponentInvariantId,
  trace: ComponentScenarioTrace,
  applied: boolean,
  failures: InvariantFailure[],
): InvariantCheckResult {
  return { invariantId, scenarioId: trace.scenario.id, applied, failures };
}

function requiredComponents(componentRule: BibleComponentRule | null): HarnessSessionComponent[] {
  return componentRule?.expectation.kind === 'required_components'
    ? componentRule.expectation.components
    : [];
}

function checkComponentSetConserved(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_COMPONENT_SET_CONSERVED' as const;
  const projectionRule = rule(trace, 'ALL-COMP-PROJECTION-01');
  if (!projectionRule) return result(invariantId, trace, false, []);
  const failures: InvariantFailure[] = [];
  const generated = target(trace, 'generated_fallback');
  if (!generated) {
    failures.push(failure({
      trace,
      invariantId,
      ruleId: projectionRule.id,
      stage: 'generated_fallback',
      expected: 'one canonical target workout',
      actual: null,
      missing: ['target workout'],
    }));
    return result(invariantId, trace, true, failures);
  }

  const allocation = target(trace, 'allocation');
  if (allocation) {
    const lostPlanned = difference(allocation.components, generated.components);
    const lostPatterns = difference(allocation.effectivePatterns, generated.effectivePatterns);
    if (lostPlanned.length > 0 || lostPatterns.length > 0) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: firstRule(trace),
        stage: 'generated_fallback',
        expected: allocation.components,
        actual: generated.components,
        missing: [...lostPlanned, ...lostPatterns],
        extra: difference(generated.components, allocation.components),
        row: generated,
        detail: 'Allocation-owned components cannot disappear during deterministic fallback.',
      }));
    }
  }

  for (const stage of ['visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    if (!observed || !equalSet(generated.components, observed.components)) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: projectionRule.id,
        stage,
        expected: generated.components,
        actual: observed?.components ?? [],
        missing: difference(generated.components, observed?.components ?? []),
        extra: difference(observed?.components ?? [], generated.components),
        row: observed,
        detail: 'Healthy Slice 2 scenarios authorise no generated-component removal.',
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkMixedPreservesBoth(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_MIXED_PRESERVES_BOTH' as const;
  const componentRule = rule(trace, 'ALL-COMP-MIXED-01');
  if (!componentRule) return result(invariantId, trace, false, []);
  const expected = requiredComponents(componentRule);
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const missing = difference(expected, observed?.components ?? []);
    const rowsPresent = !!observed && observed.strengthRowNames.length > 0 && observed.conditioningRowNames.length > 0;
    if (missing.length > 0 || !rowsPresent) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected: { components: expected, strengthRows: 'present', conditioningRows: 'present' },
        actual: observed ? {
          components: observed.components,
          strengthRows: observed.strengthRowNames,
          conditioningRows: observed.conditioningRowNames,
          workoutType: observed.workoutType,
        } : null,
        missing: [...missing, ...(!rowsPresent ? ['separate strength/conditioning rows'] : [])],
        row: observed,
        detail: 'Mixed/workoutType is compatibility display evidence only.',
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkTeamStrengthPreservesBoth(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_TEAM_STRENGTH_PRESERVES_BOTH' as const;
  const componentRule = rule(trace, 'ALL-COMP-TEAM-01');
  if (!componentRule) return result(invariantId, trace, false, []);
  const expected = requiredComponents(componentRule);
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const missing = difference(expected, observed?.components ?? []);
    const validStrength = !!observed && observed.effectivePatterns.length > 0 && observed.strengthRowNames.length > 0;
    if (missing.length > 0 || !validStrength) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected: { components: expected, effectivePatterns: ['pull'], strengthRows: 'present' },
        actual: observed ? {
          components: observed.components,
          effectivePatterns: observed.effectivePatterns,
          strengthRows: observed.strengthRowNames,
        } : null,
        missing: [...missing, ...(!validStrength ? ['exact upper-pull strength'] : [])],
        row: observed,
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkTrunkNotConditioning(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_TRUNK_NOT_CONDITIONING' as const;
  const componentRule = rule(trace, 'ALL-TRUNK-SUPPORT-01');
  if (!componentRule || componentRule.expectation.kind !== 'trunk_support') {
    return result(invariantId, trace, false, []);
  }
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const missingSupport = difference(componentRule.expectation.supportRows, observed?.supportRowNames ?? []);
    const falseConditioningRows = (observed?.conditioningRowNames ?? []).filter((name) =>
      componentRule.expectation.supportRows.includes(name));
    // A real typed conditioning component may independently share the same
    // constrained full-body day. The invariant is causal: trunk rows must not
    // be the rows manufacturing that component.
    const falseConditioning = observed?.components.includes('conditioning') === true &&
      (observed?.conditioningRowNames.length ?? 0) === 0;
    if (!observed?.components.includes('trunk_support') || missingSupport.length > 0 || falseConditioning || falseConditioningRows.length > 0) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected: {
          component: 'trunk_support',
          rows: componentRule.expectation.supportRows,
          conditioningRowsExclude: componentRule.expectation.supportRows,
        },
        actual: observed ? {
          components: observed.components,
          supportRows: observed.supportRowNames,
          conditioningRows: observed.conditioningRowNames,
        } : null,
        missing: missingSupport,
        extra: [...(falseConditioning ? ['conditioning'] : []), ...falseConditioningRows],
        row: observed,
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkTrunkNoMainCredit(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_TRUNK_NO_MAIN_STRENGTH_CREDIT' as const;
  const componentRule = rule(trace, 'ALL-TRUNK-SUPPORT-01');
  if (!componentRule || componentRule.expectation.kind !== 'trunk_support') {
    return result(invariantId, trace, false, []);
  }
  const expected = componentRule.expectation.strengthPatterns;
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    if (!observed || !equalSet(expected, observed.effectivePatterns)) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected,
        actual: observed?.effectivePatterns ?? [],
        missing: difference(expected, observed?.effectivePatterns ?? []),
        extra: difference(observed?.effectivePatterns ?? [], expected),
        row: observed,
        detail: 'Literal full-body main patterns stay independent of Pallof support.',
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkRecoveryAddonNonDestructive(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_RECOVERY_ADDON_NON_DESTRUCTIVE' as const;
  const componentRule = rule(trace, 'ALL-RECOVERY-ADDON-01');
  if (!componentRule) return result(invariantId, trace, false, []);
  const expected = requiredComponents(componentRule);
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const missing = difference(expected, observed?.components ?? []);
    const valid = !!observed && missing.length === 0 && observed.strengthRowNames.length > 0 &&
      observed.effectivePatterns.length > 0 && observed.recoveryAddonNames.length > 0;
    if (!valid) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected: { components: expected, strengthRows: 'present', recoveryAddonRows: 'present' },
        actual: observed ? {
          components: observed.components,
          strengthRows: observed.strengthRowNames,
          recoveryAddonRows: observed.recoveryAddonNames,
        } : null,
        missing: [...missing, ...(!observed?.recoveryAddonNames.length ? ['recovery add-on rows'] : [])],
        row: observed,
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkConditioningNotInStrengthRows(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_CONDITIONING_NOT_IN_STRENGTH_ROWS' as const;
  const componentRule = rule(trace, 'ALL-COND-SECTION-01');
  if (!componentRule || componentRule.expectation.kind !== 'conditioning_section') {
    return result(invariantId, trace, false, []);
  }
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const overlap = (observed?.conditioningRowNames ?? []).filter((name) =>
      observed?.strengthRowNames.includes(name));
    const missingRows = difference(
      componentRule.expectation.conditioningRows,
      observed?.conditioningRowNames ?? [],
    );
    if (!observed || missingRows.length > 0 || overlap.length > 0) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected: 'non-empty conditioning rows disjoint from strength rows',
        actual: observed ? {
          strengthRows: observed.strengthRowNames,
          conditioningRows: observed.conditioningRowNames,
        } : null,
        missing: missingRows,
        extra: overlap,
        row: observed,
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkAccessoryNotMainExposure(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_ACCESSORY_NOT_MAIN_EXPOSURE' as const;
  const componentRule = rule(trace, 'ALL-ACCESSORY-CREDIT-01');
  if (!componentRule) return result(invariantId, trace, false, []);
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const credited = canonical([...(observed?.plannedPatterns ?? []), ...(observed?.effectivePatterns ?? [])]);
    const visibleAccessory = !!observed && observed.exerciseNames.length > 0 && observed.components.length > 0;
    if (credited.length > 0 || !visibleAccessory) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule.id,
        stage,
        expected: { mainPatterns: [], accessoryContent: 'visible' },
        actual: observed ? { mainPatterns: credited, exerciseNames: observed.exerciseNames } : null,
        missing: !visibleAccessory ? ['visible accessory content'] : [],
        extra: credited,
        row: observed,
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

function checkWeekDetailAgreement(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_WEEK_DETAIL_COMPONENT_AGREEMENT' as const;
  const projectionRule = rule(trace, 'ALL-COMP-PROJECTION-01');
  if (!projectionRule) return result(invariantId, trace, false, []);
  const week = target(trace, 'visible_week');
  const detail = target(trace, 'visible_detail');
  const weeklyEvidenceMissing: HarnessSessionComponent[] = [];
  if (week?.components.includes('strength') && !week.visibleItemDomains.includes('strength')) {
    weeklyEvidenceMissing.push('strength');
  }
  if (week?.components.includes('conditioning') && !week.visibleItemDomains.includes('conditioning')) {
    weeklyEvidenceMissing.push('conditioning');
  }
  if (week?.components.includes('trunk_support') && week.supportRowNames.length === 0) {
    weeklyEvidenceMissing.push('trunk_support');
  }
  if (week?.components.includes('recovery') &&
    week.recoveryAddonNames.length === 0 && !week.visibleItemDomains.includes('recovery')) {
    weeklyEvidenceMissing.push('recovery');
  }
  const valid = !!week && !!detail && week.planEntryId === detail.planEntryId &&
    equalSet(week.components, detail.components) &&
    equalSet(week.effectivePatterns, detail.effectivePatterns) &&
    equalSet(week.strengthRowNames, detail.strengthRowNames) &&
    equalSet(week.conditioningRowNames, detail.conditioningRowNames) &&
    equalSet(week.supportRowNames, detail.supportRowNames) &&
    equalSet(week.recoveryAddonNames, detail.recoveryAddonNames) &&
    weeklyEvidenceMissing.length === 0;
  const failures = valid ? [] : [failure({
    trace,
    invariantId,
    ruleId: projectionRule.id,
    stage: 'visible_detail',
    expected: week ? {
      components: week.components,
      effectivePatterns: week.effectivePatterns,
      strengthRows: week.strengthRowNames,
      conditioningRows: week.conditioningRowNames,
      supportRows: week.supportRowNames,
    } : 'weekly target present',
    actual: detail ? {
      components: detail.components,
      effectivePatterns: detail.effectivePatterns,
      strengthRows: detail.strengthRowNames,
      conditioningRows: detail.conditioningRowNames,
      supportRows: detail.supportRowNames,
    } : null,
    missing: [
      ...difference(week?.components ?? [], detail?.components ?? []),
      ...weeklyEvidenceMissing.map((component) => `${component} weekly visible item`),
    ],
    extra: difference(detail?.components ?? [], week?.components ?? []),
    row: detail,
    weekComponents: week?.components,
    detailComponents: detail?.components,
    detail: 'Weekly visible-item projection and detail section extraction must converge.',
  })];
  return result(invariantId, trace, true, failures);
}

function checkScalarLabelNonAuthoritative(trace: ComponentScenarioTrace): InvariantCheckResult {
  const invariantId = 'INV_SCALAR_LABEL_NON_AUTHORITATIVE' as const;
  if (!trace.scenario.scalarMutation) return result(invariantId, trace, false, []);
  const componentRule = rule(trace, 'ALL-COMP-MIXED-01');
  const expected = requiredComponents(componentRule);
  const generated = target(trace, 'generated_fallback');
  const failures: InvariantFailure[] = [];
  for (const stage of ['generated_fallback', 'visible_week', 'visible_detail'] as const) {
    const observed = target(trace, stage);
    const valid = !!observed && difference(expected, observed.components).length === 0 &&
      !!generated && equalSet(generated.effectivePatterns, observed.effectivePatterns);
    if (!valid) {
      failures.push(failure({
        trace,
        invariantId,
        ruleId: componentRule?.id ?? firstRule(trace),
        stage,
        expected: { components: expected, effectivePatterns: generated?.effectivePatterns ?? [] },
        actual: observed ? {
          components: observed.components,
          effectivePatterns: observed.effectivePatterns,
          workoutType: observed.workoutType,
          title: observed.visibleTitle,
          subtitle: observed.visibleSubtitle,
        } : null,
        missing: difference(expected, observed?.components ?? []),
        row: observed,
        detail: 'Name, subtitle and workoutType are compatibility/display scalars only.',
      }));
    }
  }
  return result(invariantId, trace, true, failures);
}

export const COMPONENT_INVARIANT_IDS: readonly ComponentInvariantId[] = [
  'INV_COMPONENT_SET_CONSERVED',
  'INV_MIXED_PRESERVES_BOTH',
  'INV_TEAM_STRENGTH_PRESERVES_BOTH',
  'INV_TRUNK_NOT_CONDITIONING',
  'INV_TRUNK_NO_MAIN_STRENGTH_CREDIT',
  'INV_RECOVERY_ADDON_NON_DESTRUCTIVE',
  'INV_CONDITIONING_NOT_IN_STRENGTH_ROWS',
  'INV_ACCESSORY_NOT_MAIN_EXPOSURE',
  'INV_WEEK_DETAIL_COMPONENT_AGREEMENT',
  'INV_SCALAR_LABEL_NON_AUTHORITATIVE',
];

export function evaluateComponentTrace(trace: ComponentScenarioTrace): InvariantCheckResult[] {
  return [
    checkComponentSetConserved(trace),
    checkMixedPreservesBoth(trace),
    checkTeamStrengthPreservesBoth(trace),
    checkTrunkNotConditioning(trace),
    checkTrunkNoMainCredit(trace),
    checkRecoveryAddonNonDestructive(trace),
    checkConditioningNotInStrengthRows(trace),
    checkAccessoryNotMainExposure(trace),
    checkWeekDetailAgreement(trace),
    checkScalarLabelNonAuthoritative(trace),
  ];
}

export function firstComponentFailure(results: readonly InvariantCheckResult[]): InvariantFailure | null {
  return results.flatMap((entry) => entry.failures)
    .sort((left, right) => STAGES.indexOf(left.stage) - STAGES.indexOf(right.stage))[0] ?? null;
}
