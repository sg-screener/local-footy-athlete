(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  recommendRecoveryAddonCoverage,
  type RecoveryAddonCoveragePlan,
  type RecoveryAddonCoverageRecommendation,
  type RecoveryAddonFocusArea,
} from '../rules/recoveryAddonCoverage';
import { POOL_REGISTRY } from '../data/exercisePools';
import { MOBILITY_FLOW_TEMPLATES } from '../data/mobilityFlowTemplates';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n    ${detail}` : ''));
    console.log(`  FAIL ${name}${detail ? `\n    ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(label: string): void {
  console.log(`\n${label}`);
}

function byFocus(
  plan: RecoveryAddonCoveragePlan,
  focusArea: RecoveryAddonFocusArea,
): RecoveryAddonCoverageRecommendation {
  const recommendation = plan.recommendations.find((item) => item.focusArea === focusArea);
  if (!recommendation) {
    throw new Error(`Missing recommendation: ${focusArea}`);
  }
  return recommendation;
}

function containsText(values: readonly string[], pattern: RegExp): boolean {
  return values.some((value) => pattern.test(value));
}

const templateIds = new Set(MOBILITY_FLOW_TEMPLATES.map((template) => template.id));
const poolCategories = new Set(Object.keys(POOL_REGISTRY));

section('[1] off-season returns broader support coverage');
{
  const plan = recommendRecoveryAddonCoverage({ phase: 'Off-season' });
  eq('off-season mode', plan.mode, 'broad_support');
  eq('off-season target min', plan.totalTarget.min, 2);
  eq('off-season target max', plan.totalTarget.max, 4);
  ok('off-season includes every support focus', plan.recommendations.length === 7);
  ok('off-season trunk minimum present', byFocus(plan, 'trunk_core').target.min >= 1);
  ok('off-season adductor minimum present', byFocus(plan, 'adductors_groin').target.min >= 1);
  ok('off-season calf/tib minimum present', byFocus(plan, 'calves_tib_ankles').target.min >= 1);
  ok('off-season mobility has room', byFocus(plan, 'mobility_reset').target.max >= 2);
  ok('off-season carries suitable when healthy', byFocus(plan, 'carries').target.max === 1);
}

section('[2] pre-season returns moderate coverage');
{
  const plan = recommendRecoveryAddonCoverage({ phase: 'Pre-season' });
  eq('pre-season mode', plan.mode, 'moderate_support');
  eq('pre-season target min', plan.totalTarget.min, 2);
  eq('pre-season target max', plan.totalTarget.max, 3);
  ok('pre-season trunk maintained', byFocus(plan, 'trunk_core').target.min === 1);
  ok('pre-season adductors maintained', byFocus(plan, 'adductors_groin').target.min === 1);
  ok('pre-season calves maintained', byFocus(plan, 'calves_tib_ankles').target.min === 1);
  ok('pre-season carries optional', byFocus(plan, 'carries').priority === 'optional');
}

section('[3] in-season returns minimum effective coverage');
{
  const plan = recommendRecoveryAddonCoverage({ phase: 'In-season' });
  eq('in-season mode', plan.mode, 'minimum_effective');
  eq('in-season target min', plan.totalTarget.min, 1);
  eq('in-season target max', plan.totalTarget.max, 3);
  ok('in-season trunk minimum present', byFocus(plan, 'trunk_core').target.min === 1);
  ok('in-season adductor maintenance present', byFocus(plan, 'adductors_groin').target.min === 1);
  ok('in-season calf maintenance present', byFocus(plan, 'calves_tib_ankles').target.min === 1);
  ok('in-season carries stay optional', byFocus(plan, 'carries').priority === 'optional');
  ok('in-season notes protect freshness', containsText(plan.notes, /freshness|familiar/i));
}

section('[4] game-week G-1 only allows very light options');
{
  const plan = recommendRecoveryAddonCoverage({
    phase: 'In-season',
    gameDay: 'Saturday',
    daysUntilGame: 1,
  });
  ok('G-1 policy is active', plan.gMinusOnePolicy.active);
  ok('G-1 policy excludes carries', plan.gMinusOnePolicy.disallowedFocusAreas.includes('carries'));
  ok('G-1 allowed recommendations are very light',
    plan.recommendations
      .filter((recommendation) => recommendation.placement.gMinusOneAllowed)
      .every((recommendation) =>
        recommendation.placement.gMinusOneIntensity === 'very_light' &&
        recommendation.target.max <= 1,
      ));
  eq('G-1 carries are not allowed', byFocus(plan, 'carries').placement.gMinusOneAllowed, false);
  eq('G-1 carries max target', byFocus(plan, 'carries').target.max, 0);
}

section('[5] deload biases toward mobility/reset/light trunk');
{
  const plan = recommendRecoveryAddonCoverage({ phase: 'Pre-season', weekKind: 'deload' });
  eq('deload mode', plan.mode, 'deload_recovery');
  eq('deload target max', plan.totalTarget.max, 2);
  ok('deload mobility is primary', byFocus(plan, 'mobility_reset').priority === 'primary');
  ok('deload mobility has minimum dose', byFocus(plan, 'mobility_reset').target.min === 1);
  ok('deload trunk is primary light support', byFocus(plan, 'trunk_core').priority === 'primary');
  eq('deload carries avoided', byFocus(plan, 'carries').status, 'avoid');
  eq('deload carries target zero', byFocus(plan, 'carries').target.max, 0);
}

section('[6] low availability returns minimum viable coverage');
{
  const plan = recommendRecoveryAddonCoverage({
    phase: 'Off-season',
    availabilityDaysPerWeek: 2,
  });
  eq('low availability mode', plan.mode, 'minimum_viable');
  eq('low availability target max', plan.totalTarget.max, 2);
  ok('low availability recommendation list is compact', plan.recommendations.length <= 3);
  ok('low availability keeps trunk or mobility',
    !!plan.recommendations.find((item) => item.focusArea === 'trunk_core') &&
    !!plan.recommendations.find((item) => item.focusArea === 'mobility_reset'));
  ok('low availability defers lower-priority areas', plan.deferredFocusAreas.includes('carries'));
}

section('[7] injury cautions downgrade affected focus areas');
{
  const groin = recommendRecoveryAddonCoverage({
    phase: 'Pre-season',
    activeInjuries: [{ bodyPart: 'groin', severity: 5, injuryKeys: ['adductor'] }],
  });
  const adductors = byFocus(groin, 'adductors_groin');
  eq('groin issue reduces adductor status', adductors.status, 'reduced');
  ok('groin issue keeps adductor max small', adductors.target.max <= 1);
  ok('groin issue advises against Copenhagen/adductor loading',
    containsText([
      ...adductors.restrictions,
      ...adductors.cautions.map((caution) => caution.action),
    ], /Copenhagen|adductor/i));

  const hamstring = recommendRecoveryAddonCoverage({
    phase: 'Pre-season',
    activeInjuries: [{ bodyPart: 'hamstring', severity: 6, injuryKeys: ['hamstring'] }],
  });
  const hamstringLight = byFocus(hamstring, 'hamstring_light_prehab');
  eq('6/10 hamstring avoids light-hamstring loading focus', hamstringLight.status, 'avoid');
  eq('6/10 hamstring target zero', hamstringLight.target.max, 0);
  ok('hamstring issue flags Nordics',
    containsText([
      ...hamstringLight.restrictions,
      ...hamstringLight.cautions.map((caution) => caution.action),
    ], /Nordic/i));

  const back = recommendRecoveryAddonCoverage({
    phase: 'Off-season',
    activeInjuries: [{ bodyPart: 'lower back', severity: 5, injuryKeys: ['lowerBack'] }],
  });
  const carries = byFocus(back, 'carries');
  eq('lower-back issue reduces carries', carries.status, 'reduced');
  ok('lower-back issue downgrades heavy carries',
    containsText([
      ...carries.restrictions,
      ...carries.cautions.map((caution) => caution.action),
    ], /heavy carry|heavy carries|loaded carries/i));
}

section('[8] coverage recommendations keep zero-credit fences');
for (const plan of [
  recommendRecoveryAddonCoverage({ phase: 'Off-season' }),
  recommendRecoveryAddonCoverage({ phase: 'Pre-season' }),
  recommendRecoveryAddonCoverage({ phase: 'In-season', gameDay: 'Saturday', daysUntilGame: 1 }),
  recommendRecoveryAddonCoverage({ phase: 'In-season', weekKind: 'deload' }),
  recommendRecoveryAddonCoverage({ phase: 'Off-season', availabilityDaysPerWeek: 2 }),
]) {
  ok(`${plan.mode} plan has zero hard exposure`, plan.counting.hardExposure === false);
  ok(`${plan.mode} plan has zero main strength`, plan.counting.mainStrength === false);
  ok(`${plan.mode} plan has zero conditioning credit`, plan.counting.conditioningCredit === 'none');
  ok(`${plan.mode} plan creates no hard day`, plan.counting.createsHardDay === false);

  for (const recommendation of plan.recommendations) {
    ok(`${plan.mode}/${recommendation.focusArea} target range is valid`,
      recommendation.target.unit === 'exposures_per_week' &&
      recommendation.target.min >= 0 &&
      recommendation.target.max >= recommendation.target.min);
    ok(`${plan.mode}/${recommendation.focusArea} has placement notes`,
      recommendation.placement.notes.length > 0);
    ok(`${plan.mode}/${recommendation.focusArea} has exercise tags`,
      recommendation.suitableExerciseTags.length > 0);
    ok(`${plan.mode}/${recommendation.focusArea} categories resolve`,
      recommendation.suitableExerciseCategories.every((category) => poolCategories.has(category)));
    ok(`${plan.mode}/${recommendation.focusArea} templates resolve`,
      recommendation.templateIds.every((id) => templateIds.has(id)));
    ok(`${plan.mode}/${recommendation.focusArea} has zero hard exposure`,
      recommendation.counting.hardExposure === false);
    ok(`${plan.mode}/${recommendation.focusArea} has zero main strength`,
      recommendation.counting.mainStrength === false);
    ok(`${plan.mode}/${recommendation.focusArea} has zero conditioning credit`,
      recommendation.counting.conditioningCredit === 'none');
    ok(`${plan.mode}/${recommendation.focusArea} creates no hard day`,
      recommendation.counting.createsHardDay === false);
  }
}

if (fail > 0) {
  console.error(`\nrecoveryAddonCoverageTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nrecoveryAddonCoverageTests passed: ${pass}`);
