import { SLICE3_BIBLE_RULES } from '../expectations/slice3Rules';
import type {
  HarnessConditioningEntry,
  InvariantCheckResult,
  InvariantFailure,
  Slice3InvariantId,
  Slice3RuleId,
  Slice3ScenarioId,
  Slice3ScenarioTrace,
  Slice3StageObservation,
  Slice3TraceStage,
} from '../types';

const STAGE_ORDER: Slice3TraceStage[] = [
  'allocation', 'generated_fallback', 'resolved_effective',
  'visible_week', 'visible_detail', 'weekly_accounting',
];

function canonical(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function equalSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function missing(expected: readonly string[], actual: readonly string[]): string[] {
  const set = new Set(actual);
  return canonical(expected).filter((value) => !set.has(value));
}

function applies(trace: Slice3ScenarioTrace, ...ids: Slice3ScenarioId[]): boolean {
  return ids.includes(trace.scenario.id);
}

function stage(trace: Slice3ScenarioTrace, name: Slice3TraceStage): Slice3StageObservation {
  const value = trace.stages[name];
  if (!value) throw new Error(`${trace.scenario.id} has no ${name} observation`);
  return value;
}

function rule(id: Slice3RuleId) {
  const value = SLICE3_BIBLE_RULES.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Missing Slice 3 rule ${id}`);
  return value;
}

function failure(args: {
  trace: Slice3ScenarioTrace;
  invariantId: Slice3InvariantId;
  ruleId: Slice3RuleId;
  stage: Slice3TraceStage;
  expected: unknown;
  actual: unknown;
  missing?: string[];
  extra?: string[];
  detail?: string;
}): InvariantFailure {
  const observed = stage(args.trace, args.stage);
  return {
    invariantId: args.invariantId,
    ruleId: args.ruleId,
    scenarioId: args.trace.scenario.id,
    stage: args.stage,
    expected: args.expected,
    actual: args.actual,
    missing: args.missing ?? [],
    extra: args.extra ?? [],
    path: args.stage === 'weekly_accounting'
      ? 'production weekly accounting'
      : args.stage === 'resolved_effective'
        ? 'post-generation resolution'
        : args.stage.includes('visible')
          ? 'visible program projection'
          : 'deterministic fallback',
    planEntryId: observed.planEntryId,
    day: observed.day,
    detail: args.detail,
    evidence: observed.evidence.map((item) =>
      `${item.domain}:${item.action}:${item.code}`),
  };
}

function result(
  invariantId: Slice3InvariantId,
  trace: Slice3ScenarioTrace,
  applied: boolean,
  failures: InvariantFailure[],
): InvariantCheckResult {
  return { invariantId, scenarioId: trace.scenario.id, applied, failures };
}

function one(
  invariantId: Slice3InvariantId,
  trace: Slice3ScenarioTrace,
  applied: boolean,
  valid: boolean,
  build: () => InvariantFailure,
): InvariantCheckResult {
  return result(invariantId, trace, applied, applied && !valid ? [build()] : []);
}

function conditioningShape(entries: HarnessConditioningEntry[]): string[] {
  return entries.map((entry) => `${entry.modality}:${entry.intent}:${entry.intensity}:${entry.offFeet}`);
}

function conditioningConserved(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_CONDITIONING_LEDGER_CONSERVED' as const;
  const applied = applies(trace,
    'early-offseason-healthy', 'inseason-mixed-team-accounting',
    'hamstring-restriction-mixed', 'low-readiness-downgrade');
  const generated = stage(trace, 'generated_fallback');
  const effective = stage(trace, 'resolved_effective');
  const week = stage(trace, 'visible_week');
  const detail = stage(trace, 'visible_detail');
  const expected = conditioningShape(generated.conditioning);
  const valid = equalSet(expected, conditioningShape(effective.conditioning)) &&
    equalSet(conditioningShape(effective.conditioning), conditioningShape(week.conditioning)) &&
    equalSet(conditioningShape(effective.conditioning), conditioningShape(detail.conditioning));
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-COND-EXPOSURE-01', stage: 'resolved_effective',
    expected, actual: conditioningShape(effective.conditioning),
    missing: missing(expected, conditioningShape(effective.conditioning)),
    extra: missing(conditioningShape(effective.conditioning), expected),
  }));
}

function modalityHonest(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_MODALITY_IDENTITY_HONEST' as const;
  const applied = applies(trace, 'early-offseason-healthy', 'multi-modality-conditioning');
  const generated = stage(trace, 'generated_fallback');
  const actual = generated.conditioning.map((entry) => entry.modality);
  const expected = trace.scenario.id === 'multi-modality-conditioning' ? ['bike', 'row'] : ['bike'];
  const title = `${stage(trace, 'visible_week').visibleTitle} ${stage(trace, 'visible_detail').visibleTitle}`;
  const valid = equalSet(expected, actual) &&
    (actual.includes('running') ? /run/i.test(title) : !/\brun(?:ning)?\b/i.test(title));
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-COND-MODALITY-01', stage: 'generated_fallback',
    expected: { modalities: expected, runningTitleRequiresRunning: true },
    actual: { modalities: actual, visibleTitle: title },
    missing: missing(expected, actual), extra: missing(actual, expected),
  }));
}

function earlyConditioningSafe(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_EARLY_OFFSEASON_CONDITIONING_SAFE' as const;
  const applied = applies(trace, 'early-offseason-healthy');
  const effective = stage(trace, 'resolved_effective');
  const accounting = stage(trace, 'weekly_accounting').accounting!;
  const valid = effective.conditioning.length > 0 && effective.conditioning.every((entry) =>
    entry.offFeet && entry.intensity === 'easy' && ['aerobic_base', 'flush'].includes(entry.intent)) &&
    accounting.running === 0 && accounting.hardConditioning === 0;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'OS-EARLY-COND-01', stage: 'resolved_effective',
    expected: 'easy off-feet aerobic_base/flush; running 0; hard conditioning 0',
    actual: { conditioning: effective.conditioning, running: accounting.running, hardConditioning: accounting.hardConditioning },
  }));
}

function multiModality(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_MULTI_MODALITY_NO_COLLAPSE' as const;
  const applied = applies(trace, 'multi-modality-conditioning');
  const expected = ['bike', 'row'];
  const observedStages = ['generated_fallback', 'resolved_effective', 'visible_week', 'visible_detail'] as const;
  const invalid = observedStages.find((name) => !equalSet(expected, stage(trace, name).conditioning.map((entry) => entry.modality)));
  return one(id, trace, applied, !invalid, () => {
    const name = invalid ?? 'resolved_effective';
    const actual = stage(trace, name).conditioning.map((entry) => entry.modality);
    return failure({ trace, invariantId: id, ruleId: 'ALL-COND-MULTI-01', stage: name, expected, actual, missing: missing(expected, actual), extra: missing(actual, expected) });
  });
}

function powerPhase(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_POWER_PHASE_GATED' as const;
  const applied = applies(trace, 'early-offseason-healthy', 'mid-offseason-primer', 'late-offseason-valid-contrast');
  const expected = trace.scenario.id === 'early-offseason-healthy' ? 'none'
    : trace.scenario.id === 'mid-offseason-primer' ? 'primer' : 'contrast';
  const actual = stage(trace, 'generated_fallback').power.kind;
  return one(id, trace, applied, actual === expected, () => failure({
    trace, invariantId: id, ruleId: 'OS-PWR-PHASE-01', stage: 'generated_fallback', expected: `power ${expected}`, actual: `power ${actual}`, extra: actual !== 'none' ? [actual] : [],
  }));
}

function contrastValid(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_CONTRAST_STRUCTURALLY_VALID' as const;
  const applied = applies(trace, 'late-offseason-valid-contrast', 'late-offseason-invalid-contrast');
  const power = stage(trace, 'resolved_effective').power;
  const valid = trace.scenario.id === 'late-offseason-valid-contrast'
    ? power.kind === 'contrast' && power.heavyLiftPresent && power.explosiveFamily === power.heavyLiftFamily
    : power.kind !== 'contrast';
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-PWR-CONTRAST-01', stage: 'resolved_effective',
    expected: trace.scenario.id === 'late-offseason-valid-contrast' ? 'same-family contrast with heavy lift present' : 'primer or none', actual: power,
    extra: power.kind === 'contrast' && !power.heavyLiftPresent ? ['contrast_without_heavy_lift'] : [],
  }));
}

function powerIdentity(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_POWER_CONTENT_IDENTITY_HONEST' as const;
  const applied = applies(trace, 'mid-offseason-primer', 'late-offseason-valid-contrast', 'late-offseason-invalid-contrast');
  const effective = stage(trace, 'resolved_effective');
  const week = stage(trace, 'visible_week');
  const detail = stage(trace, 'visible_detail');
  const visibleCopy = `${week.visibleTitle} ${week.visibleSubtitle} ${detail.visibleTitle} ${detail.visibleSubtitle}`;
  const valid = effective.power.kind === week.power.kind && effective.power.kind === detail.power.kind &&
    (effective.power.kind === 'none' ? !effective.components.includes('power') : effective.components.includes('power')) &&
    (effective.power.kind === 'contrast' || !/contrast/i.test(visibleCopy));
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-PWR-CONTENT-01', stage: 'visible_detail',
    expected: effective.power, actual: { week: week.power, detail: detail.power, components: effective.components },
  }));
}

function gamePowerSafe(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_GAME_PROXIMITY_POWER_SAFE' as const;
  const applied = applies(trace, 'inseason-game-sat-g2-lower');
  const power = stage(trace, 'resolved_effective').power;
  const proximity = stage(trace, 'resolved_effective').proximityPower;
  const valid = (power.kind === 'none' || power.kind === 'primer') &&
    proximity?.gMinus1 === 'none' && proximity.gameDay === 'none' &&
    proximity.gPlus1 === 'none' && proximity.gMinus2 === 'primer';
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'IS-PWR-PROXIMITY-01', stage: 'resolved_effective',
    expected: { gMinus1: 'none', gameDay: 'none', gPlus1: 'none', gMinus2: 'primer' },
    actual: { effective: power, proximity },
  }));
}

function g2Protected(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_G2_HEAVY_LOWER_PROTECTED' as const;
  const applied = applies(trace, 'inseason-game-sat-g2-lower');
  const effective = stage(trace, 'resolved_effective');
  const evidence = effective.evidence.some((item) => item.domain === 'spacing' && item.code === 'g2_lower_moderated');
  const hasLower = effective.effectivePatterns.some((pattern) => pattern === 'squat' || pattern === 'hinge');
  const valid = hasLower && effective.intensity !== 'High' && evidence;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-SPACE-G2-LOWER-01', stage: 'resolved_effective',
    expected: 'no High-intensity effective squat/hinge at G-2 with spacing evidence',
    actual: { intensity: effective.intensity, patterns: effective.effectivePatterns, evidence: effective.evidence },
    extra: effective.intensity === 'High' ? ['heavy_lower_at_g_minus_2'] : [],
    detail: evidence ? undefined : 'No authorised G-2 transformation evidence.',
  }));
}

function hardSpacing(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_HARD_LOAD_SPACING_VALID' as const;
  const applied = applies(trace, 'inseason-game-sat-g2-lower', 'inseason-mixed-team-accounting');
  const accounting = stage(trace, 'weekly_accounting').accounting!;
  const effective = stage(trace, 'resolved_effective');
  const valid = accounting.hardDays <= 4 && (trace.scenario.id !== 'inseason-game-sat-g2-lower' || effective.intensity !== 'High');
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-SPACE-HARD-01', stage: 'weekly_accounting',
    expected: { maxHardDays: 4, g2HeavyLower: false }, actual: { hardDays: accounting.hardDays, g2Intensity: effective.intensity },
  }));
}

function anchorCredit(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_TEAM_GAME_ANCHOR_CREDIT_VALID' as const;
  const applied = applies(trace, 'inseason-mixed-team-accounting');
  const a = stage(trace, 'weekly_accounting').accounting!;
  const valid = a.teamTrainingAnchors === 1 && a.gameAnchors === 1 &&
    a.squatStrength === 1 && a.hingeStrength === 1 && a.upperPullStrength === 1;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-ANCHOR-LOAD-01', stage: 'weekly_accounting',
    expected: { team: 1, game: 1, squat: 1, hinge: 1, pull: 1 },
    actual: { team: a.teamTrainingAnchors, game: a.gameAnchors, squat: a.squatStrength, hinge: a.hingeStrength, pull: a.upperPullStrength },
    extra: a.squatStrength > 1 ? ['team_or_game_false_squat_credit'] : [],
  }));
}

function constraintLoss(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_CONSTRAINT_LOSS_AUTHORISED' as const;
  const applied = applies(trace, 'hamstring-restriction-mixed');
  const generated = stage(trace, 'generated_fallback');
  const effective = stage(trace, 'resolved_effective');
  const lost = missing(generated.effectivePatterns, effective.effectivePatterns);
  const evidencePatterns = effective.evidence.flatMap((item) => item.patterns ?? []);
  const valid = equalSet(lost, ['hinge']) && missing(lost, evidencePatterns).length === 0;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-CONSTRAINT-AFFECTED-ONLY-01', stage: 'resolved_effective',
    expected: { authorisedPatternLoss: ['hinge'], evidence: true }, actual: { lost, evidence: effective.evidence }, missing: missing(['hinge'], lost), extra: missing(lost, ['hinge']),
  }));
}

function unaffectedPreserved(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_UNAFFECTED_CONTENT_PRESERVED' as const;
  const applied = applies(trace, 'hamstring-restriction-mixed');
  const effective = stage(trace, 'resolved_effective');
  const expectedItems = ['Bench Press', 'Bike Aerobic Base'];
  const valid = missing(expectedItems, effective.exerciseNames).length === 0 && effective.components.includes('conditioning');
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-CONSTRAINT-AFFECTED-ONLY-01', stage: 'resolved_effective',
    expected: { items: expectedItems, components: ['strength', 'conditioning'] },
    actual: { items: effective.exerciseNames, components: effective.components },
    missing: [...missing(expectedItems, effective.exerciseNames), ...(!effective.components.includes('conditioning') ? ['conditioning'] : [])],
  }));
}

function equipmentCompatible(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_EQUIPMENT_COMPATIBLE' as const;
  const applied = applies(trace, 'equipment-no-barbell-lower');
  const effective = stage(trace, 'resolved_effective');
  const valid = !effective.exerciseNames.includes('Back Squat') && effective.exerciseNames.includes('Bulgarian Split Squat') &&
    effective.effectivePatterns.includes('squat') && effective.evidence.some((item) => item.code === 'equipment_unavailable');
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-EQUIPMENT-COMPATIBLE-01', stage: 'resolved_effective',
    expected: { absent: ['Back Squat'], present: ['Bulgarian Split Squat'], patterns: ['squat'] },
    actual: { exercises: effective.exerciseNames, patterns: effective.effectivePatterns, evidence: effective.evidence },
    missing: missing(['Bulgarian Split Squat'], effective.exerciseNames),
    extra: effective.exerciseNames.includes('Back Squat') ? ['Back Squat'] : [],
  }));
}

function readinessValid(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_READINESS_TRANSFORMATION_VALID' as const;
  const applied = applies(trace, 'low-readiness-downgrade');
  const effective = stage(trace, 'resolved_effective');
  const valid = effective.power.kind === 'none' && effective.conditioning.every((entry) => entry.intensity !== 'hard') &&
    effective.effectivePatterns.includes('squat') && effective.evidence.some((item) => item.code === 'low_readiness_power_blocked');
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-READINESS-DOWNGRADE-01', stage: 'resolved_effective',
    expected: { power: 'none', hardConditioning: 0, preserveStrength: true, evidence: true },
    actual: { power: effective.power, conditioning: effective.conditioning, patterns: effective.effectivePatterns, evidence: effective.evidence },
  }));
}

function strengthFatigue(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_STRENGTH_FATIGUE_CREDIT_CONSERVED' as const;
  const applied = applies(trace, 'inseason-mixed-team-accounting');
  const a = stage(trace, 'weekly_accounting').accounting!;
  const valid = a.mainStrength === 2 && a.lowerStrengthFatigue === 1 && a.upperStrengthFatigue === 1;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-EXPOSURE-STRENGTH-01', stage: 'weekly_accounting',
    expected: { mainStrength: 2, lowerFatigue: 1, upperFatigue: 1 },
    actual: { mainStrength: a.mainStrength, lowerFatigue: a.lowerStrengthFatigue, upperFatigue: a.upperStrengthFatigue },
    missing: [
      ...(a.mainStrength < 2 ? ['mixed_main_strength_credit'] : []),
      ...(a.lowerStrengthFatigue < 1 ? ['mixed_lower_strength_fatigue'] : []),
      ...(a.upperStrengthFatigue < 1 ? ['team_upper_strength_fatigue'] : []),
    ],
  }));
}

function conditioningExposure(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_CONDITIONING_EXPOSURE_CREDIT_CONSERVED' as const;
  const applied = applies(trace, 'inseason-mixed-team-accounting', 'hamstring-restriction-mixed', 'low-readiness-downgrade');
  const a = stage(trace, 'weekly_accounting').accounting!;
  const expected = trace.scenario.id === 'inseason-mixed-team-accounting' ? 3 : 1;
  const valid = a.conditioning === expected && a.hardConditioning === 0;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-EXPOSURE-COND-01', stage: 'weekly_accounting',
    expected: { conditioning: expected, hardConditioning: 0 }, actual: { conditioning: a.conditioning, hardConditioning: a.hardConditioning },
    missing: a.conditioning < expected ? ['conditioning_exposure'] : [],
    extra: [
      ...(a.conditioning > expected ? ['false_conditioning_exposure'] : []),
      ...(a.hardConditioning > 0 ? ['false_hard_conditioning_exposure'] : []),
    ],
  }));
}

function effectiveRegion(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_EFFECTIVE_REGION_CREDIT_VALID' as const;
  const applied = applies(trace, 'inseason-mixed-team-accounting', 'hamstring-restriction-mixed');
  const a = stage(trace, 'weekly_accounting').accounting!;
  const expected = trace.scenario.id === 'inseason-mixed-team-accounting'
    ? { lower: 1, upper: 1 }
    : { lower: 0, upper: 1 };
  const valid = a.lowerStrengthFatigue === expected.lower && a.upperStrengthFatigue === expected.upper;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-EXPOSURE-REGION-01', stage: 'weekly_accounting', expected,
    actual: { lower: a.lowerStrengthFatigue, upper: a.upperStrengthFatigue },
  }));
}

function caps(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_WEEKLY_CAPS_RESPECTED' as const;
  const applied = applies(trace, 'inseason-mixed-team-accounting');
  const a = stage(trace, 'weekly_accounting').accounting!;
  const valid = a.mainStrength <= 4 && a.running <= 4 && a.sprintCod <= 3 && a.hardDays <= 4;
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId: 'ALL-EXPOSURE-CAPS-01', stage: 'weekly_accounting',
    expected: { maxMainStrength: 4, maxRunning: 4, maxSprintCod: 3, maxHardDays: 4 },
    actual: { mainStrength: a.mainStrength, running: a.running, sprintCod: a.sprintCod, hardDays: a.hardDays },
  }));
}

function weekDetailAgreement(trace: Slice3ScenarioTrace): InvariantCheckResult {
  const id = 'INV_WEEK_DETAIL_CONDITIONING_POWER_AGREEMENT' as const;
  const week = stage(trace, 'visible_week');
  const detail = stage(trace, 'visible_detail');
  const applied = true;
  const valid = equalSet(conditioningShape(week.conditioning), conditioningShape(detail.conditioning)) &&
    JSON.stringify(week.power) === JSON.stringify(detail.power) && equalSet(week.components, detail.components);
  const ruleId: Slice3RuleId = trace.scenario.ruleIds.find((candidate) =>
    rule(candidate).category === 'power') ?? trace.scenario.ruleIds[0];
  return one(id, trace, applied, valid, () => failure({
    trace, invariantId: id, ruleId, stage: 'visible_detail',
    expected: { conditioning: week.conditioning, power: week.power, components: week.components },
    actual: { conditioning: detail.conditioning, power: detail.power, components: detail.components },
  }));
}

export const SLICE3_INVARIANT_IDS: readonly Slice3InvariantId[] = [
  'INV_CONDITIONING_LEDGER_CONSERVED', 'INV_MODALITY_IDENTITY_HONEST',
  'INV_EARLY_OFFSEASON_CONDITIONING_SAFE', 'INV_MULTI_MODALITY_NO_COLLAPSE',
  'INV_POWER_PHASE_GATED', 'INV_CONTRAST_STRUCTURALLY_VALID',
  'INV_POWER_CONTENT_IDENTITY_HONEST', 'INV_GAME_PROXIMITY_POWER_SAFE',
  'INV_G2_HEAVY_LOWER_PROTECTED', 'INV_HARD_LOAD_SPACING_VALID',
  'INV_TEAM_GAME_ANCHOR_CREDIT_VALID', 'INV_CONSTRAINT_LOSS_AUTHORISED',
  'INV_UNAFFECTED_CONTENT_PRESERVED', 'INV_EQUIPMENT_COMPATIBLE',
  'INV_READINESS_TRANSFORMATION_VALID', 'INV_STRENGTH_FATIGUE_CREDIT_CONSERVED',
  'INV_CONDITIONING_EXPOSURE_CREDIT_CONSERVED', 'INV_EFFECTIVE_REGION_CREDIT_VALID',
  'INV_WEEKLY_CAPS_RESPECTED', 'INV_WEEK_DETAIL_CONDITIONING_POWER_AGREEMENT',
];

export function evaluateSlice3Trace(trace: Slice3ScenarioTrace): InvariantCheckResult[] {
  // Specific structural checks precede generic conservation checks so mutation
  // probes report the domain owner rather than a downstream symptom.
  return [
    multiModality(trace), powerPhase(trace), contrastValid(trace), modalityHonest(trace),
    g2Protected(trace), unaffectedPreserved(trace), equipmentCompatible(trace),
    strengthFatigue(trace), anchorCredit(trace), conditioningExposure(trace),
    conditioningConserved(trace), earlyConditioningSafe(trace), powerIdentity(trace),
    gamePowerSafe(trace), hardSpacing(trace), constraintLoss(trace), readinessValid(trace),
    effectiveRegion(trace), caps(trace), weekDetailAgreement(trace),
  ];
}

export function firstSlice3Failure(results: readonly InvariantCheckResult[]): InvariantFailure | null {
  return results.flatMap((entry) => entry.failures)
    .sort((left, right) => STAGE_ORDER.indexOf(left.stage) - STAGE_ORDER.indexOf(right.stage))[0] ?? null;
}
