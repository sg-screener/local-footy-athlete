import type {
  HarnessCanonicalWeekLedger,
  HarnessCanonicalWorkoutLedger,
  InvariantCheckResult,
  InvariantFailure,
  Slice4InvariantId,
  Slice4PathObservation,
  Slice4RuleId,
  Slice4ScenarioId,
  Slice4ScenarioTrace,
  Slice4TraceStage,
} from '../types';

const STAGES: Slice4TraceStage[] = [
  'path_input', 'path_output', 'stored_before_rehydrate', 'rehydrated',
  'rehydrated_twice', 'post_rehydrate_edit', 'post_rehydrate_rebuild',
];

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalized).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, normalized(child)]));
  }
  return value;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

function workoutSemantic(workout: HarnessCanonicalWorkoutLedger, includePlanId = true) {
  return {
    ...(includePlanId ? { planEntryId: workout.planEntryId } : {}),
    archetype: workout.archetype,
    primaryPattern: workout.primaryPattern,
    plannedPatterns: workout.plannedPatterns,
    effectivePatterns: workout.effectivePatterns,
    components: workout.components,
    conditioning: workout.conditioning,
    power: workout.power,
    supportRows: workout.supportRows,
    recoveryAddons: workout.recoveryAddons,
    sessionTier: workout.sessionTier,
    conditioningHeadline: workout.conditioningHeadline,
  };
}

function weekSemantic(ledger: HarnessCanonicalWeekLedger, includePlanId = true) {
  return {
    workouts: ledger.workouts.map((workout) => workoutSemantic(workout, includePlanId)),
    exposure: ledger.exposure,
    visibleWeekComponents: ledger.visibleWeekComponents,
    visibleDetailComponents: ledger.visibleDetailComponents,
  };
}

function observation(trace: Slice4ScenarioTrace, stage: Slice4TraceStage, index = 0): Slice4PathObservation {
  const values = trace.observations.filter((entry) => entry.stage === stage);
  if (!values[index]) throw new Error(`${trace.scenario.id} has no ${stage}[${index}] observation`);
  return values[index];
}

function applies(trace: Slice4ScenarioTrace, ...ids: Slice4ScenarioId[]): boolean {
  return ids.includes(trace.scenario.id);
}

function difference(expected: readonly string[], actual: readonly string[]): { missing: string[]; extra: string[] } {
  return {
    missing: expected.filter((value) => !actual.includes(value)),
    extra: actual.filter((value) => !expected.includes(value)),
  };
}

function failure(args: {
  trace: Slice4ScenarioTrace;
  invariantId: Slice4InvariantId;
  ruleId: Slice4RuleId;
  observed: Slice4PathObservation;
  expected: unknown;
  actual: unknown;
  missing?: string[];
  extra?: string[];
  detail?: string;
}): InvariantFailure {
  const workout = args.observed.ledger.workouts[0];
  return {
    invariantId: args.invariantId, ruleId: args.ruleId,
    scenarioId: args.trace.scenario.id, stage: args.observed.stage,
    expected: args.expected, actual: args.actual,
    missing: args.missing ?? [], extra: args.extra ?? [],
    path: args.observed.pathId, conformancePath: args.observed.pathId,
    planEntryId: workout?.planEntryId, day: workout ? String(workout.dayOfWeek) : undefined,
    before: args.expected, after: args.actual,
    persistence: args.observed.persistence
      ? `${args.observed.persistence.key}@v${args.observed.persistence.version}; mergeRuns=${args.observed.persistence.mergeRuns}; legacy=${args.observed.persistence.legacy}`
      : undefined,
    detail: args.detail,
  };
}

function check(
  invariantId: Slice4InvariantId,
  trace: Slice4ScenarioTrace,
  applied: boolean,
  valid: boolean,
  build: () => InvariantFailure,
): InvariantCheckResult {
  return { invariantId, scenarioId: trace.scenario.id, applied, failures: applied && !valid ? [build()] : [] };
}

function equivalentCanonical(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_EQUIVALENT_CANONICAL_LEDGER' as const;
  const applied = applies(trace, 'generation-ai-fallback-equivalence');
  const expected = trace.observations[0]; const actual = trace.observations[1];
  const left = weekSemantic(expected.ledger); const right = weekSemantic(actual.ledger);
  return check(id, trace, applied, same(left, right), () => failure({
    trace, invariantId: id, ruleId: 'ALL-PATH-EQUIV-01', observed: actual,
    expected: left, actual: right,
    missing: difference(expected.ledger.workouts[0]?.components ?? [], actual.ledger.workouts[0]?.components ?? []).missing,
    extra: difference(expected.ledger.workouts[0]?.components ?? [], actual.ledger.workouts[0]?.components ?? []).extra,
  }));
}

function equivalentVisible(trace: Slice4ScenarioTrace, detail: boolean): InvariantCheckResult {
  const id = detail ? 'INV_EQUIVALENT_VISIBLE_DETAIL' as const : 'INV_EQUIVALENT_VISIBLE_WEEK' as const;
  const applied = applies(trace, 'generation-ai-fallback-equivalence');
  const first = trace.observations[0]; const second = trace.observations[1];
  const expected = detail ? first.ledger.visibleDetailComponents : first.ledger.visibleWeekComponents;
  const actual = detail ? second.ledger.visibleDetailComponents : second.ledger.visibleWeekComponents;
  const diff = difference(expected, actual);
  return check(id, trace, applied, same(expected, actual), () => failure({
    trace, invariantId: id, ruleId: 'ALL-PATH-EQUIV-01', observed: second,
    expected, actual, ...diff,
  }));
}

function equivalentExposure(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_EQUIVALENT_EXPOSURE_CREDIT' as const;
  const applied = applies(trace, 'generation-ai-fallback-equivalence', 'noop-inseason-week-rebuild');
  const first = trace.observations[0]; const second = trace.observations[1];
  return check(id, trace, applied, same(first.ledger.exposure, second.ledger.exposure), () => failure({
    trace, invariantId: id, ruleId: trace.scenario.id === 'noop-inseason-week-rebuild' ? 'ALL-REBUILD-IDEMPOTENT-01' : 'ALL-PATH-EQUIV-01',
    observed: second, expected: first.ledger.exposure, actual: second.ledger.exposure,
    missing: ['equivalent_exposure_credit'],
  }));
}

function planJoin(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_PLAN_ENTRY_JOIN_STABLE_ACROSS_PATHS' as const;
  const applied = applies(trace, 'generation-ai-fallback-equivalence', 'noop-inseason-week-rebuild', 'repeat-rich-week');
  const first = trace.observations[0]; const second = trace.observations[1];
  const expected = first.ledger.workouts.map((workout) => workout.planEntryId).sort();
  const actual = second.ledger.workouts.map((workout) => workout.planEntryId).sort();
  const diff = difference(expected, actual);
  return check(id, trace, applied, same(expected, actual), () => failure({
    trace, invariantId: id,
    ruleId: trace.scenario.id === 'repeat-rich-week' ? 'ALL-REPEAT-CONSERVE-01' : trace.scenario.id === 'noop-inseason-week-rebuild' ? 'ALL-REBUILD-IDEMPOTENT-01' : 'ALL-PATH-EQUIV-01',
    observed: second, expected, actual, ...diff,
  }));
}

function noOpRebuild(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_NOOP_REBUILD_IDEMPOTENT' as const;
  const applied = applies(trace, 'noop-inseason-week-rebuild');
  const first = observation(trace, 'path_input'); const second = observation(trace, 'path_output');
  return check(id, trace, applied, same(weekSemantic(first.ledger), weekSemantic(second.ledger)), () => failure({
    trace, invariantId: id, ruleId: 'ALL-REBUILD-IDEMPOTENT-01', observed: second,
    expected: weekSemantic(first.ledger), actual: weekSemantic(second.ledger), missing: ['canonical_rebuild_equivalence'],
  }));
}

function repeatConserves(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_REPEAT_WEEK_CONSERVES_CONTRACT' as const;
  const applied = applies(trace, 'repeat-rich-week');
  const first = observation(trace, 'path_input'); const second = observation(trace, 'path_output');
  return check(id, trace, applied, same(weekSemantic(first.ledger), weekSemantic(second.ledger)), () => {
    const expectedComponents = first.ledger.workouts.flatMap((workout) => workout.components);
    const actualComponents = second.ledger.workouts.flatMap((workout) => workout.components);
    return failure({ trace, invariantId: id, ruleId: 'ALL-REPEAT-CONSERVE-01', observed: second,
      expected: weekSemantic(first.ledger), actual: weekSemantic(second.ledger), ...difference(expectedComponents, actualComponents) });
  });
}

function rollover(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_ROLLOVER_ONLY_AUTHORISED_CHANGE' as const;
  const applied = applies(trace, 'block-rollover-contract');
  const output = observation(trace, 'path_output');
  const patterns = Array.from(new Set(output.ledger.workouts.flatMap((workout) => workout.plannedPatterns))).sort();
  const expected = ['hinge', 'pull', 'push', 'squat'];
  return check(id, trace, applied, same(patterns, expected) && output.authorisedChanges.includes('block_number'), () => failure({
    trace, invariantId: id, ruleId: 'ALL-ROLLOVER-CONSERVE-01', observed: output,
    expected: { patterns: expected, authorised: ['block_number', 'block_start', 'dose', 'variation', 'plan_entry_ids'] },
    actual: { patterns, authorised: output.authorisedChanges }, ...difference(expected, patterns),
  }));
}

function editCanonical(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_EDIT_USES_CANONICAL_FINALISER' as const;
  const applied = applies(trace, 'coach-add-bike-zone2', 'coach-remove-contrast-lift', 'direct-add-pallof');
  const output = observation(trace, 'path_output'); const workout = output.ledger.workouts[0];
  const valid = trace.scenario.id === 'coach-add-bike-zone2'
    ? workout.components.includes('conditioning') && workout.conditioning.some((entry) => entry.modality === 'bike') && !workout.strengthRows.some((row) => /bike/i.test(row))
    : trace.scenario.id === 'coach-remove-contrast-lift'
      ? workout.power.kind !== 'contrast'
      : workout.supportRows.includes('Pallof Press') && !workout.components.includes('conditioning') && same(workout.effectivePatterns, ['push']);
  const missing = trace.scenario.id === 'coach-add-bike-zone2' && !workout.components.includes('conditioning') ? ['conditioning']
    : trace.scenario.id === 'direct-add-pallof' && !workout.supportRows.includes('Pallof Press') ? ['Pallof Press'] : [];
  const extra = workout.power.kind === 'contrast' ? ['stale_contrast']
    : workout.strengthRows.filter((row) => /bike/i.test(row));
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-EDIT-CANONICAL-01', observed: output,
    expected: trace.scenario.expected, actual: workoutSemantic(workout), missing, extra,
  }));
}

function moveIdentity(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_MOVE_PRESERVES_PLAN_IDENTITY' as const;
  const applied = applies(trace, 'move-combined-lower');
  const input = observation(trace, 'path_input').ledger.workouts[0];
  const output = observation(trace, 'path_output'); const moved = output.ledger.workouts[0];
  const valid = input.planEntryId === moved.planEntryId && same(workoutSemantic(input), workoutSemantic(moved));
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-MOVE-IDENTITY-01', observed: output,
    expected: workoutSemantic(input), actual: workoutSemantic(moved),
    missing: input.planEntryId !== moved.planEntryId ? [input.planEntryId] : [],
    extra: input.planEntryId !== moved.planEntryId ? [moved.planEntryId] : [],
  }));
}

function swapIdentity(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_SWAP_PRESERVES_BOTH_IDENTITIES' as const;
  const applied = applies(trace, 'swap-upper-and-lower');
  const input = observation(trace, 'path_input').ledger.workouts;
  const outputObs = observation(trace, 'path_output'); const output = outputObs.ledger.workouts;
  const before = new Map(input.map((workout) => [workout.planEntryId, workout]));
  const valid = output.length === 2 && output.every((workout) => {
    const source = before.get(workout.planEntryId);
    return !!source && source.dayOfWeek !== workout.dayOfWeek && same(workoutSemantic(source), workoutSemantic(workout));
  });
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-SWAP-IDENTITY-01', observed: outputObs,
    expected: input.map(workoutSemantic), actual: output.map(workoutSemantic),
    missing: ['both_workout_owned_identities_at_opposite_days'],
  }));
}

function storeRoundtrip(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_STORE_ROUNDTRIP_CONSERVED' as const;
  const applied = applies(trace, 'canonical-program-rehydrate');
  const stored = observation(trace, 'stored_before_rehydrate'); const hydrated = observation(trace, 'rehydrated');
  return check(id, trace, applied, same(weekSemantic(stored.ledger), weekSemantic(hydrated.ledger)), () => failure({
    trace, invariantId: id, ruleId: 'ALL-STORE-ROUNDTRIP-01', observed: hydrated,
    expected: weekSemantic(stored.ledger), actual: weekSemantic(hydrated.ledger), missing: ['persisted_canonical_contract'],
  }));
}

function hydrateIdempotent(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_STORE_REHYDRATE_IDEMPOTENT' as const;
  const applied = applies(trace, 'canonical-program-rehydrate', 'legacy-program-rehydrate');
  const once = observation(trace, 'rehydrated'); const twice = observation(trace, 'rehydrated_twice');
  return check(id, trace, applied, same(weekSemantic(once.ledger), weekSemantic(twice.ledger)), () => failure({
    trace, invariantId: id, ruleId: 'ALL-STORE-IDEMPOTENT-01', observed: twice,
    expected: weekSemantic(once.ledger), actual: weekSemantic(twice.ledger), missing: ['idempotent_second_hydration'],
  }));
}

function legacyMigration(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_LEGACY_MIGRATION_CANONICAL' as const;
  const applied = applies(trace, 'legacy-program-rehydrate');
  const hydrated = observation(trace, 'rehydrated'); const workout = hydrated.ledger.workouts[0];
  const valid = workout.archetype === 'lower' && same(workout.plannedPatterns, ['squat', 'hinge']) &&
    same(workout.effectivePatterns, ['squat', 'hinge']) && workout.components.includes('strength') && workout.components.includes('conditioning');
  const diff = difference(['squat', 'hinge'], workout.plannedPatterns);
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-LEGACY-HYDRATE-01', observed: hydrated,
    expected: { archetype: 'lower', patterns: ['squat', 'hinge'], components: ['strength', 'conditioning'] },
    actual: workoutSemantic(workout), ...diff,
  }));
}

function modernWins(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_MODERN_TYPED_INTENT_WINS' as const;
  const applied = applies(trace, 'canonical-program-rehydrate', 'legacy-program-rehydrate');
  const hydrated = observation(trace, 'rehydrated'); const workout = hydrated.ledger.workouts[0];
  const valid = workout.archetype === 'lower' && !workout.plannedPatterns.includes('push') && !workout.effectivePatterns.includes('push');
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-STORE-SCALAR-NONAUTH-01', observed: hydrated,
    expected: { archetype: 'lower', forbiddenPatterns: ['push'] }, actual: workoutSemantic(workout),
    extra: workout.plannedPatterns.includes('push') || workout.effectivePatterns.includes('push') ? ['push_from_stale_scalar_or_name'] : [],
  }));
}

function scalarNonAuthority(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_SCALAR_FIELDS_NON_AUTHORITATIVE_AFTER_HYDRATE' as const;
  const applied = applies(trace, 'canonical-program-rehydrate', 'legacy-program-rehydrate');
  const hydrated = observation(trace, 'rehydrated'); const workout = hydrated.ledger.workouts[0];
  const valid = workout.components.includes('strength') && workout.components.includes('conditioning') && workout.workoutType === 'Mixed';
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-STORE-SCALAR-NONAUTH-01', observed: hydrated,
    expected: { components: ['strength', 'conditioning'], workoutType: 'Mixed' },
    actual: { components: workout.components, workoutType: workout.workoutType },
    ...difference(['strength', 'conditioning'], workout.components),
  }));
}

function postRehydrate(trace: Slice4ScenarioTrace, rebuild: boolean): InvariantCheckResult {
  const id = rebuild ? 'INV_POST_REHYDRATE_REBUILD_EQUIVALENT' as const : 'INV_POST_REHYDRATE_EDIT_EQUIVALENT' as const;
  const applied = applies(trace, 'post-rehydrate-edit-rebuild');
  const before = rebuild
    ? trace.observations.find((entry) => entry.stage === 'path_output' && entry.pathId === 'no_op_week_rebuild')!
    : trace.observations.find((entry) => entry.stage === 'path_input' && entry.pathId === 'conditioning_edit')!;
  const after = observation(trace, rebuild ? 'post_rehydrate_rebuild' : 'post_rehydrate_edit');
  return check(id, trace, applied, same(weekSemantic(before.ledger), weekSemantic(after.ledger)), () => failure({
    trace, invariantId: id, ruleId: 'ALL-POST-REHYDRATE-WRITE-01', observed: after,
    expected: weekSemantic(before.ledger), actual: weekSemantic(after.ledger), missing: [rebuild ? 'post_rehydrate_rebuild_component' : 'post_rehydrate_edit_component'],
  }));
}

function conditioningRowsStayConditioning(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_CONDITIONING_ROW_NO_STRENGTH_CREDIT' as const;
  const applied = applies(trace, 'standalone-conditioning-ownership');
  const observed = trace.observations.find((entry) => entry.stage === 'path_output')!;
  const workout = observed.ledger.workouts[0];
  const conditioningStrengthRows = workout.strengthRows.filter((row) =>
    /\b(?:rowerg|rower|skierg|ski\s*erg|aerobic|tempo\s+interval)\b/i.test(row));
  return check(id, trace, applied, conditioningStrengthRows.length === 0, () => failure({
    trace, invariantId: id, ruleId: 'ALL-LEGACY-INFERENCE-BOUNDARY-01', observed,
    expected: { conditioningStrengthRows: [] }, actual: { conditioningStrengthRows },
    extra: conditioningStrengthRows,
  }));
}

function standaloneConditioningOwnsNoStrength(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_STANDALONE_CONDITIONING_NO_STRENGTH_GAIN' as const;
  const applied = applies(trace, 'standalone-conditioning-ownership', 'canonical-program-rehydrate');
  const observed = trace.scenario.id === 'canonical-program-rehydrate'
    ? observation(trace, 'rehydrated')
    : trace.observations.find((entry) => entry.stage === 'path_output')!;
  const candidates = observed.ledger.workouts.filter((workout) =>
    workout.conditioning.length > 0 &&
    (workout.planEntryId.includes('standalone') ||
      workout.planEntryId === 'w3:monday:none:tempo' ||
      workout.plannedPatterns.length === 0));
  const valid = candidates.length > 0 && candidates.every((workout) =>
    !workout.components.includes('strength') &&
    workout.effectivePatterns.length === 0 &&
    workout.strengthRows.length === 0 &&
    workout.workoutType === 'Conditioning');
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-COND-STANDALONE-OWNERSHIP-01', observed,
    expected: { components: ['conditioning'], effectivePatterns: [], strengthRows: [], workoutType: 'Conditioning' },
    actual: candidates.map(workoutSemantic),
    missing: candidates.length === 0 ? ['standalone_conditioning'] : [],
    extra: candidates.flatMap((workout) => [
      ...(workout.components.includes('strength') ? ['strength'] : []),
      ...workout.effectivePatterns,
      ...workout.strengthRows,
      ...(workout.workoutType === 'Mixed' || workout.workoutType === 'Strength' ? [workout.workoutType] : []),
    ]),
  }));
}

function modernNoStrengthOwnershipWins(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_MODERN_TYPED_OWNERSHIP_WINS' as const;
  const applied = applies(trace, 'standalone-conditioning-ownership');
  const observed = trace.observations.find((entry) => entry.stage === 'path_output')!;
  const workout = observed.ledger.workouts[0];
  const valid = workout.plannedPatterns.length === 0 && workout.archetype === null &&
    !/Upper Pull/i.test(workout.visibleTitle ?? '');
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-LEGACY-INFERENCE-BOUNDARY-01', observed,
    expected: { plannedPatterns: [], archetype: null, forbiddenTitle: 'Upper Pull' },
    actual: workoutSemantic(workout),
    extra: [...workout.plannedPatterns, ...(/Upper Pull/i.test(workout.visibleTitle ?? '') ? ['Upper Pull'] : [])],
  }));
}

function conditioningHeadlineUsesWork(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_CONDITIONING_HEADLINE_USES_WORK' as const;
  const applied = applies(trace, 'standalone-conditioning-ownership');
  const observed = trace.observations.find((entry) => entry.stage === 'path_output')!;
  const headline = observed.ledger.workouts[0].conditioningHeadline ?? '';
  const valid = !!headline && !/warm[- ]?up|cool[- ]?down/i.test(headline) &&
    /tempo|interval|conditioning/i.test(headline);
  return check(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-COND-HEADLINE-01', observed,
    expected: { headline: 'meaningful conditioning work' }, actual: { headline },
    extra: /warm[- ]?up|cool[- ]?down/i.test(headline) ? [headline] : [],
  }));
}

function legacyMigrationIdempotent(trace: Slice4ScenarioTrace): InvariantCheckResult {
  const id = 'INV_LEGACY_MIGRATION_IDEMPOTENT' as const;
  const applied = applies(trace, 'legacy-program-rehydrate');
  const once = observation(trace, 'rehydrated');
  const twice = observation(trace, 'rehydrated_twice');
  return check(id, trace, applied, same(weekSemantic(once.ledger), weekSemantic(twice.ledger)), () => failure({
    trace, invariantId: id, ruleId: 'ALL-LEGACY-INFERENCE-BOUNDARY-01', observed: twice,
    expected: weekSemantic(once.ledger), actual: weekSemantic(twice.ledger),
    missing: ['idempotent_legacy_strength_migration'],
  }));
}

export const SLICE4_INVARIANT_IDS: readonly Slice4InvariantId[] = [
  'INV_EQUIVALENT_CANONICAL_LEDGER', 'INV_EQUIVALENT_VISIBLE_WEEK',
  'INV_EQUIVALENT_VISIBLE_DETAIL', 'INV_EQUIVALENT_EXPOSURE_CREDIT',
  'INV_NOOP_REBUILD_IDEMPOTENT', 'INV_REPEAT_WEEK_CONSERVES_CONTRACT',
  'INV_ROLLOVER_ONLY_AUTHORISED_CHANGE', 'INV_EDIT_USES_CANONICAL_FINALISER',
  'INV_MOVE_PRESERVES_PLAN_IDENTITY', 'INV_SWAP_PRESERVES_BOTH_IDENTITIES',
  'INV_STORE_ROUNDTRIP_CONSERVED', 'INV_STORE_REHYDRATE_IDEMPOTENT',
  'INV_LEGACY_MIGRATION_CANONICAL', 'INV_MODERN_TYPED_INTENT_WINS',
  'INV_SCALAR_FIELDS_NON_AUTHORITATIVE_AFTER_HYDRATE',
  'INV_POST_REHYDRATE_EDIT_EQUIVALENT', 'INV_POST_REHYDRATE_REBUILD_EQUIVALENT',
  'INV_PLAN_ENTRY_JOIN_STABLE_ACROSS_PATHS',
  'INV_STANDALONE_CONDITIONING_NO_STRENGTH_GAIN',
  'INV_CONDITIONING_ROW_NO_STRENGTH_CREDIT',
  'INV_MODERN_TYPED_OWNERSHIP_WINS',
  'INV_CONDITIONING_HEADLINE_USES_WORK',
  'INV_LEGACY_MIGRATION_IDEMPOTENT',
];

export function evaluateSlice4Trace(trace: Slice4ScenarioTrace): InvariantCheckResult[] {
  const inactive = (invariantId: Slice4InvariantId): InvariantCheckResult => ({
    invariantId, scenarioId: trace.scenario.id, applied: false, failures: [],
  });
  return [
    applies(trace, 'standalone-conditioning-ownership') ? conditioningRowsStayConditioning(trace) : inactive('INV_CONDITIONING_ROW_NO_STRENGTH_CREDIT'),
    applies(trace, 'standalone-conditioning-ownership', 'canonical-program-rehydrate') ? standaloneConditioningOwnsNoStrength(trace) : inactive('INV_STANDALONE_CONDITIONING_NO_STRENGTH_GAIN'),
    applies(trace, 'standalone-conditioning-ownership') ? modernNoStrengthOwnershipWins(trace) : inactive('INV_MODERN_TYPED_OWNERSHIP_WINS'),
    applies(trace, 'standalone-conditioning-ownership') ? conditioningHeadlineUsesWork(trace) : inactive('INV_CONDITIONING_HEADLINE_USES_WORK'),
    applies(trace, 'legacy-program-rehydrate') ? legacyMigrationIdempotent(trace) : inactive('INV_LEGACY_MIGRATION_IDEMPOTENT'),
    applies(trace, 'generation-ai-fallback-equivalence', 'noop-inseason-week-rebuild', 'repeat-rich-week')
      ? planJoin(trace) : inactive('INV_PLAN_ENTRY_JOIN_STABLE_ACROSS_PATHS'),
    applies(trace, 'generation-ai-fallback-equivalence') ? equivalentCanonical(trace) : inactive('INV_EQUIVALENT_CANONICAL_LEDGER'),
    applies(trace, 'generation-ai-fallback-equivalence') ? equivalentVisible(trace, false) : inactive('INV_EQUIVALENT_VISIBLE_WEEK'),
    applies(trace, 'generation-ai-fallback-equivalence') ? equivalentVisible(trace, true) : inactive('INV_EQUIVALENT_VISIBLE_DETAIL'),
    applies(trace, 'generation-ai-fallback-equivalence', 'noop-inseason-week-rebuild') ? equivalentExposure(trace) : inactive('INV_EQUIVALENT_EXPOSURE_CREDIT'),
    applies(trace, 'noop-inseason-week-rebuild') ? noOpRebuild(trace) : inactive('INV_NOOP_REBUILD_IDEMPOTENT'),
    applies(trace, 'repeat-rich-week') ? repeatConserves(trace) : inactive('INV_REPEAT_WEEK_CONSERVES_CONTRACT'),
    applies(trace, 'block-rollover-contract') ? rollover(trace) : inactive('INV_ROLLOVER_ONLY_AUTHORISED_CHANGE'),
    applies(trace, 'coach-add-bike-zone2', 'coach-remove-contrast-lift', 'direct-add-pallof') ? editCanonical(trace) : inactive('INV_EDIT_USES_CANONICAL_FINALISER'),
    applies(trace, 'move-combined-lower') ? moveIdentity(trace) : inactive('INV_MOVE_PRESERVES_PLAN_IDENTITY'),
    applies(trace, 'swap-upper-and-lower') ? swapIdentity(trace) : inactive('INV_SWAP_PRESERVES_BOTH_IDENTITIES'),
    applies(trace, 'canonical-program-rehydrate', 'legacy-program-rehydrate') ? scalarNonAuthority(trace) : inactive('INV_SCALAR_FIELDS_NON_AUTHORITATIVE_AFTER_HYDRATE'),
    applies(trace, 'canonical-program-rehydrate', 'legacy-program-rehydrate') ? modernWins(trace) : inactive('INV_MODERN_TYPED_INTENT_WINS'),
    applies(trace, 'canonical-program-rehydrate') ? storeRoundtrip(trace) : inactive('INV_STORE_ROUNDTRIP_CONSERVED'),
    applies(trace, 'canonical-program-rehydrate', 'legacy-program-rehydrate') ? hydrateIdempotent(trace) : inactive('INV_STORE_REHYDRATE_IDEMPOTENT'),
    applies(trace, 'legacy-program-rehydrate') ? legacyMigration(trace) : inactive('INV_LEGACY_MIGRATION_CANONICAL'),
    applies(trace, 'post-rehydrate-edit-rebuild') ? postRehydrate(trace, false) : inactive('INV_POST_REHYDRATE_EDIT_EQUIVALENT'),
    applies(trace, 'post-rehydrate-edit-rebuild') ? postRehydrate(trace, true) : inactive('INV_POST_REHYDRATE_REBUILD_EQUIVALENT'),
  ];
}

export function firstSlice4Failure(results: readonly InvariantCheckResult[]): InvariantFailure | null {
  return results.flatMap((entry) => entry.failures)
    .sort((a, b) => STAGES.indexOf(a.stage as Slice4TraceStage) - STAGES.indexOf(b.stage as Slice4TraceStage))[0] ?? null;
}
