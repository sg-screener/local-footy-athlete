/**
 * Role + goal programming bias tests.
 *
 * Run: npx sucrase-node src/__tests__/programmingBiasTests.ts
 *
 * Covers the pure helper (mapping, phase scaling, override safety, small
 * magnitude) AND the engine integration (conditioning category re-order can
 * only re-order gate-permitted categories, never add a blocked one; default
 * athlete does not regress).
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — programming bias must be deterministic');
};

import type { OnboardingData, SeasonPhase } from '../types/domain';
import {
  computeProgrammingBias,
  applyConditioningCategoryBias,
  type BiasConditioningCategory,
} from '../rules/programmingBias';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : `\n      ${String(detail)}`}`);
  }
}

const MAX_BIAS = 0.15;

function allBiasWithinBounds(b: ReturnType<typeof computeProgrammingBias>): boolean {
  return [
    b.strengthBias,
    b.speedBias,
    ...Object.values(b.conditioningCategoryPreference),
    ...Object.values(b.recoveryAddonFocusPreference),
  ]
    .every((v) => v >= -MAX_BIAS - 1e-9 && v <= MAX_BIAS + 1e-9);
}

// ── 1. Helper maps common roles/goals correctly ──

{
  const mid = computeProgrammingBias({ role: 'midfielder', goals: [], phase: 'Off-season' });
  ok('inside-mid role leans aerobic/tempo inside the safe category list',
    (mid.conditioningCategoryPreference.aerobic_base ?? 0) > 0,
    JSON.stringify(mid.conditioningCategoryPreference));

  const ruck = computeProgrammingBias({ role: 'ruck', goals: [], phase: 'Off-season' });
  ok('key-position/ruck role leans strength', ruck.strengthBias > 0, ruck.strengthBias);
  ok('ruck role leans strength-support add-ons',
    (ruck.recoveryAddonFocusPreference.carries ?? 0) > 0,
    JSON.stringify(ruck.recoveryAddonFocusPreference));

  const wing = computeProgrammingBias({ role: 'winger', goals: [], phase: 'Off-season' });
  ok('outside-runner role leans speed', wing.speedBias > 0, wing.speedBias);

  const size = computeProgrammingBias({ role: undefined, goals: ['Build muscle'], phase: 'Off-season' });
  ok('size goal leans strength-support add-ons',
    (size.recoveryAddonFocusPreference.shoulder_scap ?? 0) > 0,
    JSON.stringify(size.recoveryAddonFocusPreference));

  const durable = computeProgrammingBias({ role: undefined, goals: ['Stay injury-free'], phase: 'Off-season' });
  ok('durability goal leans robustness/prehab add-ons',
    (durable.recoveryAddonFocusPreference.hamstring_light_prehab ?? 0) > 0,
    JSON.stringify(durable.recoveryAddonFocusPreference));
  ok('top-level output contains only consumed fields plus explicit debug data',
    Object.keys(durable).sort().join(',') === [
      'conditioningCategoryPreference',
      'debug',
      'recoveryAddonFocusPreference',
      'speedBias',
      'strengthBias',
    ].sort().join(','),
    Object.keys(durable));
}

// ── 2. All bias values are SMALL (≤ 15%) in every phase ──

{
  const phases: SeasonPhase[] = ['Off-season', 'Pre-season', 'In-season'];
  let bounded = true;
  for (const phase of phases) {
    const b = computeProgrammingBias({
      role: 'ruck',
      goals: ['Get stronger & fitter', 'Build muscle', 'Feel fresh on game day'],
      phase,
    });
    if (!allBiasWithinBounds(b)) bounded = false;
  }
  ok('all bias magnitudes stay within ±15%', bounded);
}

// ── 3. Midfielder + aerobic goal favours aerobic/tempo where phase allows ──

{
  const b = computeProgrammingBias({ role: 'midfielder', goals: ['Build my aerobic engine'], phase: 'Off-season' });
  const pref = b.conditioningCategoryPreference;
  ok('aerobic goal sets aerobic_base preference', (pref.aerobic_base ?? 0) > 0, JSON.stringify(pref));
  ok('aerobic goal ranks aerobic_base above tempo', (pref.aerobic_base ?? 0) > (pref.tempo ?? 0), JSON.stringify(pref));

  const ordered: BiasConditioningCategory[] = ['tempo', 'aerobic_base', 'vo2'];
  const reordered = applyConditioningCategoryBias(ordered, pref);
  ok('aerobic goal moves aerobic_base to front', reordered[0] === 'aerobic_base', reordered.join(','));
}

// ── 4. Speed goal leans speed & sets sprint/vo2 preference (but re-order only) ──

{
  const b = computeProgrammingBias({ role: undefined, goals: ['Get faster / more speed'], phase: 'Off-season' });
  ok('speed goal leans speed', b.speedBias > 0, b.speedBias);
  ok('speed goal sets sprint preference', (b.conditioningCategoryPreference.sprint ?? 0) > 0);

  // Sprint gate already removed sprint from the list => re-order must NOT add it.
  const gateFiltered: BiasConditioningCategory[] = ['aerobic_base', 'tempo', 'vo2'];
  const reordered = applyConditioningCategoryBias(gateFiltered, b.conditioningCategoryPreference);
  ok('speed pref does not add sprint when gate removed it', !reordered.includes('sprint'), reordered.join(','));
  ok('re-order preserves category set (never adds/removes)',
    reordered.length === gateFiltered.length && gateFiltered.every((c) => reordered.includes(c)),
    reordered.join(','));
}

// ── 5. Strength/size goal favours strength/accessory MORE off-season than in-season ──

{
  const off = computeProgrammingBias({ role: 'ruck', goals: ['Build muscle'], phase: 'Off-season' });
  const inSeason = computeProgrammingBias({ role: 'ruck', goals: ['Build muscle'], phase: 'In-season' });
  ok('strength bias larger off-season than in-season', off.strengthBias > inSeason.strengthBias, `${off.strengthBias} vs ${inSeason.strengthBias}`);
  ok('strength-support preference larger off-season than in-season',
    (off.recoveryAddonFocusPreference.carries ?? 0) >
      (inSeason.recoveryAddonFocusPreference.carries ?? 0),
    JSON.stringify({ off: off.recoveryAddonFocusPreference, inSeason: inSeason.recoveryAddonFocusPreference }));
  ok('phase weight off-season > pre-season > in-season',
    computeProgrammingBias({ phase: 'Off-season' }).debug.phaseAdjustedWeight >
      computeProgrammingBias({ phase: 'Pre-season' }).debug.phaseAdjustedWeight &&
    computeProgrammingBias({ phase: 'Pre-season' }).debug.phaseAdjustedWeight >
      computeProgrammingBias({ phase: 'In-season' }).debug.phaseAdjustedWeight);
}

// ── 6. Durability goal → recovery lean, no aggressive/hard direction ──

{
  const b = computeProgrammingBias({ role: undefined, goals: ['Stay injury-free / durable'], phase: 'Off-season' });
  ok('durability goal has an active recovery add-on preference',
    Object.keys(b.recoveryAddonFocusPreference).length > 0);
  ok('durability goal adds no speed bias', b.speedBias === 0, b.speedBias);
  ok('durability goal sets no conditioning category preference',
    Object.keys(b.conditioningCategoryPreference).length === 0, JSON.stringify(b.conditioningCategoryPreference));
}

// ── 7. In-season bias stays small and never re-orders (planner not used in-season) ──

{
  const b = computeProgrammingBias({ role: 'midfielder', goals: ['Aerobic engine'], phase: 'In-season' });
  ok('in-season conditioning preference is small (≤ 8%)',
    Object.values(b.conditioningCategoryPreference).every((weight) => Math.abs(weight) <= 0.08),
    JSON.stringify(b.conditioningCategoryPreference));
  ok('in-season phase weight is smallest',
    b.debug.phaseAdjustedWeight <= 0.3 + 1e-9,
    b.debug.phaseAdjustedWeight);
}

// ── 8. Beginner policy overrides aggressive goal bias ──

{
  const b = computeProgrammingBias({ role: 'winger', goals: ['Get faster / more speed'], phase: 'Off-season', isBeginner: true });
  ok('beginner zeroes speed bias', b.speedBias === 0, b.speedBias);
  ok('beginner drops sprint category preference',
    (b.conditioningCategoryPreference.sprint ?? 0) === 0, JSON.stringify(b.conditioningCategoryPreference));
}

// ── 9. Healthy default athlete does not regress (neutral bias, identity re-order) ──

{
  const none = computeProgrammingBias({ role: undefined, goals: [], phase: 'Off-season' });
  ok('default: strengthBias 0', none.strengthBias === 0);
  ok('default: speedBias 0', none.speedBias === 0);
  ok('default: empty category preference', Object.keys(none.conditioningCategoryPreference).length === 0);
  ok('default: empty recovery add-on preference', Object.keys(none.recoveryAddonFocusPreference).length === 0);
  ok('default reason is explicitly debug-only',
    none.debug.reasons.some((reason) => /balanced default/i.test(reason)),
    none.debug.reasons.join(' | '));

  const list: BiasConditioningCategory[] = ['vo2', 'glycolytic', 'aerobic_base', 'sprint'];
  const identity = applyConditioningCategoryBias(list, none.conditioningCategoryPreference);
  ok('default: re-order is identity', identity.join(',') === list.join(','), identity.join(','));

  // Consistency/general goals are also neutral for the category re-order.
  const general = computeProgrammingBias({ role: undefined, goals: ['Stay consistent'], phase: 'Off-season' });
  ok('general goal: empty category preference', Object.keys(general.conditioningCategoryPreference).length === 0);
}

// ── 10. Re-order is a stable sort (ties keep original order) ──

{
  const list: BiasConditioningCategory[] = ['vo2', 'glycolytic', 'tempo', 'aerobic_base'];
  const pref = { aerobic_base: 0.15 } as Partial<Record<BiasConditioningCategory, number>>;
  const out = applyConditioningCategoryBias(list, pref);
  ok('stable re-order: preferred first', out[0] === 'aerobic_base', out.join(','));
  ok('stable re-order: rest keep original order', out.slice(1).join(',') === 'vo2,glycolytic,tempo', out.join(','));
}

// ── 11. Integration: injury/readiness override — speed goal cannot inject sprint ──

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Pre-season',
  position: 'outside_runner',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard',
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Barbell', 'Dumbbells', 'Bench', 'Cable machine'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Get faster / more speed',
};

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return { ...BASE_PROFILE, ...overrides };
}

function planFor(
  data: OnboardingData,
  options: { weekInBlock?: number } = {},
): SessionAllocation[] {
  return buildCoachingPlan(
    onboardingToCoachingInputs(data, {
      availabilityDateISO: '2026-07-06',
      weekInBlock: options.weekInBlock,
    }),
  ).weeklyPlan;
}

{
  const injured = profile({
    injuries: [
      {
        bodyArea: 'Hamstring',
        description: 'Hamstring strain',
        severity: 'Severe',
        movementTriggers: ['sprint', 'running'],
      },
    ],
  });
  const plan = planFor(injured);
  const hasSprint = plan.some((s) => s.conditioningCategory === 'sprint');
  ok('speed goal + severe hamstring: NO sprint conditioning (gate wins)', !hasSprint,
    plan.map((s) => s.conditioningCategory).filter(Boolean).join(','));
}

// ── 12. Integration: role bias changes only safe ordering, not weekly dose ──

{
  const inside = planFor(profile({
    position: 'inside_mid',
    motivation: 'Stay consistent',
    injuries: [],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
  }), { weekInBlock: 2 });
  const outside = planFor(profile({
    position: 'outside_runner',
    motivation: 'Stay consistent',
    injuries: [],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
  }), { weekInBlock: 2 });
  const categories = (plan: SessionAllocation[]) =>
    plan.map((session) => session.conditioningCategory).filter(Boolean).join(',');
  ok('inside midfielder and outside runner produce a small safe ordering difference',
    categories(inside) !== categories(outside),
    `inside=${categories(inside)} outside=${categories(outside)}`);
  ok('role ordering difference does not add sessions or hard days',
    inside.length === outside.length &&
      inside.filter((session) => session.isHardExposure).length ===
        outside.filter((session) => session.isHardExposure).length,
    `inside=${inside.length} outside=${outside.length}`);

  const anchoredInside = planFor(profile({
    position: 'inside_mid',
    motivation: 'Stay consistent',
    injuries: [],
  }), { weekInBlock: 2 });
  const anchoredOutside = planFor(profile({
    position: 'outside_runner',
    motivation: 'Stay consistent',
    injuries: [],
  }), { weekInBlock: 2 });
  ok('team-training anchors suppress role-based conditioning reshuffles',
    categories(anchoredInside) === categories(anchoredOutside),
    `inside=${categories(anchoredInside)} outside=${categories(anchoredOutside)}`);

  const neutralPower = planFor(profile({
    position: undefined,
    motivation: 'Stay consistent',
    injuries: [],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }), { weekInBlock: 2 });
  const sizePower = planFor(profile({
    position: undefined,
    motivation: 'Build muscle and size',
    injuries: [],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }), { weekInBlock: 2 });
  ok('strength/size nudge only upgrades an already-allowed power primer',
    neutralPower.some((session) => session.powerPrimer?.kind === 'primer') &&
      sizePower.some((session) => session.powerPrimer?.kind === 'contrast'),
    `neutral=${neutralPower.map((session) => session.powerPrimer?.kind).filter(Boolean)} size=${sizePower.map((session) => session.powerPrimer?.kind).filter(Boolean)}`);
  ok('strength/size power nudge does not add sessions or hard days',
    neutralPower.length === sizePower.length &&
      neutralPower.filter((session) => session.isHardExposure).length ===
        sizePower.filter((session) => session.isHardExposure).length);
}

// ── 13. Integration: healthy default athlete plan unchanged with generic goal ──

{
  const neutral = profile({ position: undefined, motivation: 'Stay consistent' });
  const plan = planFor(neutral);
  ok('default athlete still produces a full weekly plan', plan.length > 0, plan.length);
  // Equipment untouched by bias: no session references an unavailable modality
  // purely because of a goal (smoke — plan builds cleanly under bias).
  ok('default athlete plan has at least one strength session', plan.some((s) => !!s.strengthPattern));
}

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
