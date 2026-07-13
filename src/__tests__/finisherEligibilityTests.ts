/**
 * finisherEligibilityTests — Phase 4A shared finisher law.
 *
 * Every conditioning finisher / repair attachment (in-loop S+C, H5a, H5b,
 * Sprint Rescue) now passes ONE eligibility check. These tests drive
 * buildCoachingPlan with real personas and assert on the produced
 * allocations — the same surface the athlete's week is built from.
 *
 * v1 laws under test (Sam, 2026-07-08):
 *   • no automatic sprint/COD finishers, anywhere;
 *   • lower/hinge days carry easy OFF-FEET aerobic only;
 *   • upper + hard non-sprint requires readiness + hard-day headroom;
 *   • team-day / team-adjacent / game-window protection applies to
 *     finishers exactly as to primary sessions;
 *   • Sprint Rescue only retargets standalone slots, and drops sprint
 *     honestly in off-season (no late-block model) or when TT/games
 *     already provide sprint exposure;
 *   • labels/flavour/category/stress agree — "tempo" never wraps VO2.
 *
 * 4B additions (Sam, 2026-07-09): TRUE tempo category —
 *   • denied-hard finisher requests ladder down hard → tempo → aerobic;
 *   • tempo is MEDIUM stress, only on clean upper/standalone days;
 *   • game window / TT day / TT-adjacent finishers / lower days /
 *     low readiness all still end at aerobic (or deny);
 *   • standalone tempo is off-feet-first; running only in clean
 *     pre-season weeks (typed conditioningOffFeet field);
 *   • label honesty both ways: vo2 never says tempo, tempo says 6-7/10.
 *
 * Run: npm run test:finisher-eligibility
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type OnboardingToCoachingInputsOptions,
  type SessionAllocation,
} from '../utils/coachingEngine';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import type { OnboardingData } from '../types/domain';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function planFor(
  profile: Partial<OnboardingData>,
  options: Partial<OnboardingToCoachingInputsOptions> = {},
): SessionAllocation[] {
  return buildCoachingPlan(onboardingToCoachingInputs(profile as OnboardingData, options)).weeklyPlan;
}

const isLowerish = (s: SessionAllocation) =>
  s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined' ||
  s.strengthPattern === 'full_body';
const hasFinisher = (s: SessionAllocation) => !!s.hasCombinedConditioning;
const isAttachedFinisher = (s: SessionAllocation) =>
  !!s.hasCombinedConditioning && (s.attachedConditioningKind ?? 'finisher') === 'finisher';
const isAttachedComponent = (s: SessionAllocation) =>
  !!s.hasCombinedConditioning && s.attachedConditioningKind === 'component';
// "Above easy" — anything that is not easy aerobic (tempo counts: a
// lower day / low-readiness week must not even carry tempo).
const finisherAboveEasy = (s: SessionAllocation) =>
  !!s.conditioningCategory && s.conditioningCategory !== 'aerobic_base';
// Truly HARD (4B: tempo is medium, not hard).
const finisherHard = (s: SessionAllocation) =>
  !!s.conditioningCategory && s.conditioningCategory !== 'aerobic_base' &&
  s.conditioningCategory !== 'tempo';
const steadyAerobicFinishers = (plan: SessionAllocation[]) =>
  plan.filter((s) => isAttachedFinisher(s) && s.conditioningCategory === 'aerobic_base');

const DAY_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const OFF_SEASON_BASE: Partial<OnboardingData> = {
  seasonPhase: 'Off-season', trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
  conditioningLevel: 'Good', recentTrainingLoad: 'Pretty consistent',
  injuries: [], motivation: 'Get stronger',
};

const LATE_OFFSEASON: Partial<OnboardingToCoachingInputsOptions> = {
  offseasonSubphase: 'late_offseason',
  weekNumber: 4,
  weekInBlock: 4,
  weekKind: 'build',
};

const LATE_OFFSEASON_HARD_ELIGIBLE: Partial<OnboardingData> = {
  ...OFF_SEASON_BASE,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
};

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. No sprint/COD finishers anywhere; no hidden sprint exposure ──');
{
  const personas: Array<[string, Partial<OnboardingData>]> = [
    ['off-season S6', OFF_SEASON_BASE],
    ['off-season S7', {
      ...OFF_SEASON_BASE, trainingDaysPerWeek: 6,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      teamTrainingDaysPerWeek: 3, teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
      teamTrainingIntensity: 'Moderate', recentTrainingLoad: 'Very consistent',
    }],
    ['pre-season S11 (game)', {
      seasonPhase: 'Pre-season', gameDay: 'Saturday', trainingDaysPerWeek: 5,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
      teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
      conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
      motivation: 'Get stronger',
    }],
    ['pre-season S12 (no game)', {
      seasonPhase: 'Pre-season', trainingDaysPerWeek: 5,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
      teamTrainingIntensity: 'Moderate', sprintExposure: 'Occasionally',
      conditioningLevel: 'Average', recentTrainingLoad: 'Pretty consistent', injuries: [],
      motivation: 'Get stronger',
    }],
  ];
  for (const [name, p] of personas) {
    const plan = planFor(p);
    const sprintFinishers = plan.filter((s) => hasFinisher(s) && s.conditioningCategory === 'sprint');
    ok(`${name}: no sprint finishers attached to strength days`,
      sprintFinishers.length === 0,
      sprintFinishers.map((s) => s.focus).join(' | '));
    // Sprint Rescue: no sprint at all in off-season (no late-block model)
    // or when TT/games provide it.
    const anySprint = plan.filter((s) => s.conditioningCategory === 'sprint');
    if (name !== 'pre-season S12 (no game)') {
      ok(`${name}: Sprint Rescue dropped sprint honestly (TT/game/off-season)`,
        anySprint.length === 0, anySprint.map((s) => s.focus).join(' | '));
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Lower/hinge days: easy off-feet aerobic only ──');
{
  const plans = [planFor(OFF_SEASON_BASE), planFor({
    ...OFF_SEASON_BASE, trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 3, teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingIntensity: 'Moderate', recentTrainingLoad: 'Very consistent',
  })];
  for (const plan of plans) {
    const badLower = plan.filter((s) => isLowerish(s) && hasFinisher(s) && finisherAboveEasy(s));
    ok('no lower/hinge/full day carries anything above easy aerobic (not even tempo)',
      badLower.length === 0, badLower.map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
    const lowerFinishers = plan.filter((s) => isLowerish(s) && hasFinisher(s));
    ok('lower-day finishers are labelled off-feet easy aerobic',
      lowerFinishers.every((s) => /off-feet aerobic/i.test(s.focus)),
      lowerFinishers.map((s) => s.focus).join(' | '));
    ok('lower/hinge/full attached conditioning is typed as finisher, not component',
      lowerFinishers.every((s) => (s.attachedConditioningKind ?? 'finisher') === 'finisher'),
      lowerFinishers.map((s) => `${s.dayOfWeek}: ${s.attachedConditioningKind ?? 'missing'}`).join(' | '));
    const lowerComponents = plan.filter((s) => isLowerish(s) && isAttachedComponent(s));
    ok('lower/hinge/full never receives an attached conditioning component',
      lowerComponents.length === 0,
      lowerComponents.map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2b. Early off-season 4-day respects the progressive conditioning cap ──');
{
  const plan = planFor(OFF_SEASON_BASE);
  const conditioning = plan.filter((s) => !!s.conditioningCategory);
  ok('S6 keeps the single early-block conditioning exposure without filler',
    conditioning.length === 1,
    plan.map((s) => `${s.dayOfWeek}:${s.conditioningCategory ?? '-'}`).join(' | '));
  ok('S6 does not attach more than 2 steady aerobic finishers',
    steadyAerobicFinishers(plan).length <= 2,
    steadyAerobicFinishers(plan).map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
  const upperFinishers = plan.filter((s) => !isLowerish(s) && hasFinisher(s));
  ok('S6 early-block upper days do not bypass the progressive aerobic policy',
    upperFinishers.every((s) => s.conditioningCategory === 'aerobic_base'),
    upperFinishers.map((s) => `${s.dayOfWeek}: ${s.conditioningCategory}: ${s.focus}`).join(' | '));
  ok('S6 no longer uses the old generic bike/row/ski 15-20min steady label',
    plan.every((s) => !/bike\/row\/ski,\s*15-20min/i.test(s.focus)),
    plan.map((s) => s.focus).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Readiness gate: low readiness → no hard finishers ──');
{
  const plan = planFor({
    ...OFF_SEASON_BASE,
    recentTrainingLoad: 'Hardly at all',
    conditioningLevel: 'Poor',
    sprintExposure: 'No sprint training',
  });
  const hard = plan.filter((s) => finisherAboveEasy(s));
  ok('low-readiness athlete gets nothing above easy aerobic (no tempo, no hard)',
    hard.length === 0, hard.map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Game window + team adjacency apply to finishers ──');
{
  const plan = planFor({
    seasonPhase: 'Pre-season', gameDay: 'Saturday', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
    conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
    motivation: 'Get stronger',
  });
  const g1g2 = plan.filter((s) =>
    (s.dayOfWeek === 'Friday' || s.dayOfWeek === 'Thursday') && hasFinisher(s) && finisherAboveEasy(s));
  ok('nothing above easy aerobic on G-1/G-2 in the game week (tempo included)',
    g1g2.length === 0, g1g2.map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
  const ttHard = plan.filter((s) => s.isTeamDay && hasFinisher(s));
  ok('pre-season team days carry NO finishers at all',
    ttHard.length === 0, ttHard.map((s) => s.focus).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Label / flavour / category / stress consistency ──');
{
  const personas = [OFF_SEASON_BASE, {
    ...OFF_SEASON_BASE, trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 3, teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingIntensity: 'Moderate', recentTrainingLoad: 'Very consistent',
  }];
  for (const p of personas) {
    const plan = planFor(p);
    for (const s of plan) {
      if (!s.conditioningCategory) continue;
      if (s.conditioningCategory === 'vo2' || s.conditioningCategory === 'glycolytic') {
        ok(`hard category never wears the 'tempo' flavour (${s.dayOfWeek})`,
          s.conditioningFlavour === 'high-intensity', `${s.conditioningFlavour}: ${s.focus}`);
        ok(`hard category never labelled 'tempo' (${s.dayOfWeek})`,
          !/tempo/i.test(s.focus), s.focus);
        if (s.conditioningCategory === 'vo2') {
          ok(`VO2 label speaks VO2 / hard-repeat language (${s.dayOfWeek})`,
            /VO2|hard repeat/i.test(s.focus), s.focus);
        }
        if (s.conditioningCategory === 'glycolytic') {
          ok(`glycolytic label speaks high-intensity / repeat-effort language (${s.dayOfWeek})`,
            /high-intensity|repeat effort/i.test(s.focus), s.focus);
        }
      }
      if (s.conditioningCategory === 'aerobic_base') {
        ok(`aerobic category carries aerobic flavour (${s.dayOfWeek})`,
          s.conditioningFlavour === 'aerobic', `${s.conditioningFlavour}: ${s.focus}`);
      }
      if (s.conditioningCategory === 'tempo') {
        ok(`tempo category carries tempo flavour (${s.dayOfWeek})`,
          s.conditioningFlavour === 'tempo', `${s.conditioningFlavour}: ${s.focus}`);
        ok(`tempo label speaks 6-7/10 controlled language (${s.dayOfWeek})`,
          /tempo/i.test(s.focus) && /6-7\/10/.test(s.focus), s.focus);
        // Upper + tempo S+C days and standalone tempo days are both
        // MEDIUM stress; standalone tempo is additionally not a hard
        // exposure (S+C days stay hard via the strength half).
        ok(`tempo day is MEDIUM stress (${s.dayOfWeek})`,
          s.stressLevel === 'medium',
          `stress=${s.stressLevel} focus=${s.focus}`);
        if (!s.hasCombinedConditioning) {
          ok(`standalone tempo is not a hard exposure (${s.dayOfWeek})`,
            !s.isHardExposure, s.focus);
        }
      }
    }
    // 4B: 'tempo' in a label is legal ONLY for the true tempo category.
    ok('no allocation is labelled tempo while categorised HARD (vo2/glyco/sprint)',
      plan.every((s) => !(/tempo/i.test(s.focus) && finisherHard(s))));
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Upper + hard non-sprint allowed only when gates pass ──');
{
  // Healthy, no TT, late off-season and enough headroom: upper days can now
  // carry vo2/glycolytic directly. The old flavour round-trip used to lose
  // this by resolving high-intensity back to sprint/tempo.
  const plan = planFor(LATE_OFFSEASON_HARD_ELIGIBLE, LATE_OFFSEASON);
  const hardFinishers = plan.filter((s) => hasFinisher(s) && finisherHard(s));
  const hardComponents = hardFinishers.filter(isAttachedComponent);
  ok('eligible clean off-season upper path produces at least one VO2/glyco component',
    hardFinishers.some((s) => s.conditioningCategory === 'vo2' || s.conditioningCategory === 'glycolytic'),
    plan.map((s) => `${s.dayOfWeek}:${s.strengthPattern ?? '-'}:${s.conditioningCategory ?? '-'}`).join(' | '));
  ok('hard attached conditioning is typed as component',
    hardComponents.length >= 1 && hardFinishers.every(isAttachedComponent),
    hardFinishers.map((s) => `${s.dayOfWeek}: ${s.attachedConditioningKind ?? 'missing'}: ${s.focus}`).join(' | '));
  ok('off-season v1 has max one hard attached conditioning component',
    hardComponents.length <= 1,
    hardComponents.map((s) => `${s.dayOfWeek}: ${s.conditioningCategory}`).join(' | '));
  ok('any hard component sits on an upper day only',
    hardFinishers.every((s) => !isLowerish(s)),
    hardFinishers.map((s) => `${s.dayOfWeek}: ${s.strengthPattern}: ${s.focus}`).join(' | '));
  const tempoFinishers = plan.filter((s) => hasFinisher(s) && s.conditioningCategory === 'tempo');
  ok('any tempo attached component sits on an upper day only',
    tempoFinishers.every((s) => !isLowerish(s)),
    tempoFinishers.map((s) => `${s.dayOfWeek}: ${s.strengthPattern}: ${s.focus}`).join(' | '));

  const hardComponent = hardComponents[0];
  if (hardComponent?.dayOfWeek) {
    const workouts = buildWorkoutsFromCoach([], 'mc-attached-kind', plan);
    const workout = workouts.find((w) => w.dayOfWeek === DAY_NUM[hardComponent.dayOfWeek!]);
    ok('built workout carries attachedConditioningKind=component',
      workout?.attachedConditioningKind === 'component',
      `${workout?.name}: ${workout?.attachedConditioningKind ?? 'missing'}`);
    ok('conditioningBlock carries attachedKind=component',
      workout?.conditioningBlock?.attachedKind === 'component',
      JSON.stringify(workout?.conditioningBlock));
    const counts = countWeeklyExposures([{ date: '2026-07-06', workout: workout ?? null }]);
    ok('hard component counts as a hard exposure',
      counts.hardExposures >= 1 && counts.byCategory.hard_conditioning === 1,
      JSON.stringify({ hardExposures: counts.hardExposures, byCategory: counts.byCategory }));
    ok('component counts as a full conditioning exposure',
      counts.conditioningExposures === 1 && counts.extraConditioningSessions === 1,
      JSON.stringify({ conditioning: counts.conditioningExposures, extra: counts.extraConditioningSessions }));
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Category-native hard work survives; TT weeks stay conservative ──');
{
  // S6 (no TT, no game): hard category picks must reach eligibility as
  // vo2/glycolytic and survive when allowed — not round-trip through
  // high-intensity flavour and collapse to sprint/tempo/aerobic.
  const s6 = planFor(LATE_OFFSEASON_HARD_ELIGIBLE, LATE_OFFSEASON);
  const s6Hard = s6.filter((s) =>
    s.conditioningCategory === 'vo2' || s.conditioningCategory === 'glycolytic');
  ok('S6: VO2/glyco is reachable in a clean off-season week',
    s6Hard.length >= 1, s6.map((s) => `${s.dayOfWeek}:${s.conditioningCategory ?? '-'}`).join(' | '));
  ok('S6: every attached VO2/glyco exposure sits on an upper day',
    s6Hard.filter(hasFinisher).every((s) => !isLowerish(s)),
    s6Hard.map((s) => `${s.dayOfWeek}: ${s.strengthPattern}: ${s.focus}`).join(' | '));
  ok('S6: sprint is not auto-requested in off-season attached paths',
    s6.every((s) => s.conditioningCategory !== 'sprint'),
    s6.map((s) => `${s.dayOfWeek}:${s.conditioningCategory ?? '-'}`).join(' | '));

  // S7 (3 TT days): every non-TT slot is TT-adjacent — tempo FINISHERS
  // must all have backed off to aerobic (v1: TT-adjacent tempo → aerobic).
  const s7 = planFor({
    ...OFF_SEASON_BASE, trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 3, teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingIntensity: 'Moderate', recentTrainingLoad: 'Very consistent',
  });
  const s7TempoFinishers = s7.filter((s) => hasFinisher(s) && s.conditioningCategory === 'tempo');
  ok('S7: no tempo finishers in a 3-TT week (all slots TT-adjacent)',
    s7TempoFinishers.length === 0,
    s7TempoFinishers.map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
  const s7TeamTempo = s7.filter((s) => s.isTeamDay && s.conditioningCategory === 'tempo');
  ok('S7: no tempo on team training days',
    s7TeamTempo.length === 0, s7TeamTempo.map((s) => s.focus).join(' | '));
  const s7HardFinishers = s7.filter((s) => hasFinisher(s) && finisherHard(s));
  ok('S7: no hard finishers in a 3-TT week (TT-adjacent protection)',
    s7HardFinishers.length === 0,
    s7HardFinishers.map((s) => `${s.dayOfWeek}: ${s.focus}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. 4B standalone tempo modality law (typed conditioningOffFeet) ──');
{
  // Clean pre-season week (2 moderate TT, Elite base, high readiness,
  // no game, no injuries). Under the pre-season subphase + conditioning-
  // component model this week rides its conditioning as combined S+C
  // (aerobic_base / tempo) rather than a dedicated standalone slot — there
  // are no free standalone conditioning slots once the 3 core strength days
  // and 2 team days are placed. So we assert the week is not left without
  // any conditioning; the standalone-tempo MODALITY law below (run in clean
  // pre-season, off-feet with injury / off-season) still holds for any
  // standalone tempo that IS placed.
  const prePlan = planFor({
    seasonPhase: 'Pre-season', trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Moderate', conditioningLevel: 'Elite',
    recentTrainingLoad: 'Very consistent', sprintExposure: '2+ times per week',
    injuries: [], motivation: 'Get stronger',
  });
  const preStandaloneTempo = prePlan.filter((s) =>
    s.conditioningCategory === 'tempo' && !s.hasCombinedConditioning);
  ok('clean pre-season week produces conditioning',
    prePlan.some((s) => !!s.conditioningCategory),
    prePlan.map((s) => `${s.dayOfWeek}:${s.conditioningCategory ?? '-'}${s.hasCombinedConditioning ? '(c)' : ''}`).join(' | '));
  ok('clean pre-season standalone tempo is allowed to RUN (offFeet=false)',
    preStandaloneTempo.every((s) => s.conditioningOffFeet === false),
    preStandaloneTempo.map((s) => `${s.dayOfWeek}: offFeet=${s.conditioningOffFeet}`).join(' | '));

  // Same week but with a lower-limb injury: standalone tempo (if placed)
  // must go off-feet.
  const injPlan = planFor({
    seasonPhase: 'Pre-season', trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Moderate', conditioningLevel: 'Elite',
    recentTrainingLoad: 'Very consistent', sprintExposure: '2+ times per week',
    injuries: [{ bodyArea: 'Hamstring', description: 'mild hamstring tightness', severity: 'Mild' }] as OnboardingData['injuries'],
    motivation: 'Get stronger',
  });
  const injStandaloneTempo = injPlan.filter((s) =>
    s.conditioningCategory === 'tempo' && !s.hasCombinedConditioning);
  ok('lower-limb injury forces standalone tempo off-feet',
    injStandaloneTempo.every((s) => s.conditioningOffFeet === true),
    injStandaloneTempo.map((s) => `${s.dayOfWeek}: offFeet=${s.conditioningOffFeet}`).join(' | '));

  // Off-season standalone tempo is off-feet-first in v1 — sweep ALL
  // off-season personas used in this suite.
  const offPlans = [planFor(OFF_SEASON_BASE), planFor({
    ...OFF_SEASON_BASE, trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    conditioningLevel: 'Elite', recentTrainingLoad: 'Very consistent',
  })];
  for (const plan of offPlans) {
    const standaloneTempo = plan.filter((s) =>
      s.conditioningCategory === 'tempo' && !s.hasCombinedConditioning);
    ok('off-season standalone tempo (if any) is off-feet',
      standaloneTempo.every((s) => s.conditioningOffFeet === true),
      standaloneTempo.map((s) => `${s.dayOfWeek}: offFeet=${s.conditioningOffFeet}`).join(' | '));
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. 4B content layer: mappings + true tempo templates ──');
{
  const fs = require('fs') as typeof import('fs');
  const engineSrc = fs.readFileSync('src/utils/coachingEngine.ts', 'utf8');
  ok('engine no longer converts selected category through flavour and back',
    !engineSrc.includes('flavourToSelectedCategory'), 'flavourToSelectedCategory still exists');

  // Late requires keep the top-of-file import surface unchanged.
  const sb = require('../utils/sessionBuilder') as typeof import('../utils/sessionBuilder');

  ok("flavourToCategory('tempo') is TRUE tempo — never vo2",
    sb.flavourToCategory('tempo') === 'tempo', String(sb.flavourToCategory('tempo')));
  ok("categoryToFlavour('vo2') is high-intensity — never tempo",
    sb.categoryToFlavour('vo2') === 'high-intensity', String(sb.categoryToFlavour('vo2')));
  ok("categoryToFlavour('tempo') round-trips to tempo",
    sb.categoryToFlavour('tempo') === 'tempo');
  ok('CATEGORY_INTENSITY.tempo speaks 6-7/10',
    /6-7\/10/.test(sb.CATEGORY_INTENSITY.tempo), sb.CATEGORY_INTENSITY.tempo);

  const TEMPO_TEMPLATES = [
    '30:30 Tempo Blocks',
    'Tempo Intervals (1min on / 1min easy)',
    'Bike/Row/Ski Tempo Intervals',
    'Cruise Intervals',
  ];
  for (const t of TEMPO_TEMPLATES) {
    ok(`TEMPLATE_CATEGORY['${t}'] === tempo`,
      sb.TEMPLATE_CATEGORY[t] === 'tempo', String(sb.TEMPLATE_CATEGORY[t]));
  }
  // Hard templates must NEVER be classified (or served) as tempo.
  for (const hard of ['1km Repeat Intervals', '4x4 VO2', '200m/400m Repeat Runs', 'MAS 15:15 Blocks']) {
    ok(`hard template '${hard}' is not classified tempo`,
      sb.TEMPLATE_CATEGORY[hard] !== 'tempo', String(sb.TEMPLATE_CATEGORY[hard]));
  }
  // Category → template rotation only serves true tempo templates.
  for (const mc of [1, 2, 3, 4, 5]) {
    const name = sb.conditioningCategoryToExerciseName('tempo', '2026-07-06', mc);
    ok(`tempo rotation mc=${mc} serves a true tempo template (${name})`,
      TEMPO_TEMPLATES.includes(name), name);
  }
  // Flavour path (legacy callers) also only serves true tempo templates.
  for (const d of ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']) {
    const name = sb.conditioningFlavourToExerciseName('tempo', d);
    ok(`tempo flavour path serves a true tempo template (${name})`,
      TEMPO_TEMPLATES.includes(name), name);
  }

  const textOfRows = (rows: ReturnType<typeof sb.buildConditioningTemplate>) =>
    rows.map((e) => `${e.exercise?.name} ${e.notes}`).join(' ');

  // Combined tempo finisher: small (≤2 rows), 6-7/10 language, erg-based.
  const finisher = sb.buildCombinedConditioningTemplate('tempo', '2026-07-06', 'upper', undefined, 'row');
  ok('combined tempo finisher builds rows', finisher.length >= 1 && finisher.length <= 2,
    `rows=${finisher.length}`);
  const finText = finisher.map((e) => `${e.exercise?.name} ${e.notes}`).join(' ');
  ok('combined tempo finisher speaks 6-7/10 controlled language',
    /6-7\/10/.test(finText), finText.slice(0, 160));
  ok('combined tempo finisher is not VO2/hard-labelled',
    !/vo2|8-9\/10|9\/10/i.test(finText), finText.slice(0, 160));

  const templateFinisher = sb.buildConditioningTemplate('Bike/Row/Ski Tempo Intervals', '2026-07-06', {
    combined: true,
    attachedConditioningKind: 'finisher',
    strengthRegion: 'upper',
    feel: 'grindy',
    ergModality: 'row',
  });
  const templateFinisherText = textOfRows(templateFinisher);
  ok('attachedConditioningKind=finisher builds compact finisher-scale rows',
    /(?:5|6|7) x \(1min on \/ 1min easy\)/.test(templateFinisherText) &&
      /1min on \/ 1min easy/.test(templateFinisherText) &&
      !/conditioning component|20-24min|20-30min/i.test(templateFinisherText),
    templateFinisherText.slice(0, 220));

  const templateComponent = sb.buildConditioningTemplate('Bike/Row/Ski Tempo Intervals', '2026-07-06', {
    combined: true,
    attachedConditioningKind: 'component',
    strengthRegion: 'upper',
    feel: 'grindy',
    ergModality: 'row',
  });
  const templateComponentText = textOfRows(templateComponent);
  ok('attachedConditioningKind=component builds component-scale rows',
    templateComponent.length >= 2 &&
      /conditioning component/i.test(templateComponentText) &&
      /20-24min|20-30min/i.test(templateComponentText),
    templateComponentText.slice(0, 220));

  const tempoComponent = sb.buildAttachedConditioningComponentTemplate('tempo', '2026-07-06', 'upper', 'grindy', 'row');
  const tempoComponentText = textOfRows(tempoComponent);
  ok('attached tempo component is larger than the compact finisher',
    tempoComponent.length >= 2 && /20-24min|20-30min|component/i.test(tempoComponentText),
    tempoComponentText.slice(0, 220));
  ok('attached tempo component uses component wording',
    /conditioning component/i.test(tempoComponentText),
    tempoComponentText.slice(0, 220));

  const vo2Component = sb.buildAttachedConditioningComponentTemplate('vo2', '2026-07-06', 'upper', 'grindy', 'bike');
  const vo2ComponentText = textOfRows(vo2Component);
  ok('attached VO2 component has honest component label',
    /VO2 conditioning component/i.test(vo2ComponentText) && /8-9\/10/.test(vo2ComponentText),
    vo2ComponentText.slice(0, 220));
  ok('attached VO2 component is bigger than a finisher dose',
    /20-30min component|4 x 3min|5 x 2min/i.test(vo2ComponentText),
    vo2ComponentText.slice(0, 220));

  // Standalone templates all build; off-feet erg template honours modality.
  for (const t of TEMPO_TEMPLATES) {
    const rows = sb.buildConditioningTemplate(t, '2026-07-06');
    ok(`standalone template '${t}' builds exercises`, rows.length >= 1, String(rows.length));
    const text = rows.map((e) => `${e.exercise?.name} ${e.notes}`).join(' ');
    ok(`standalone template '${t}' speaks 6-7/10`, /6-7\/10/.test(text), text.slice(0, 160));
  }
  // Run-based tempo templates convert off-feet with stimulus preserved.
  for (const t of ['30:30 Tempo Blocks', 'Tempo Intervals (1min on / 1min easy)', 'Cruise Intervals']) {
    ok(`'${t}' is running-based (run-load machinery sees it)`,
      sb.isRunningBasedConditioning(t));
    const conv = sb.switchToOffFeetModality(t, '2026-07-06');
    const convText = (conv ?? []).map((e) => `${e.exercise?.name} ${e.notes}`).join(' ');
    ok(`'${t}' converts off-feet keeping 6-7/10 tempo character`,
      !!conv && conv.length >= 1 && /6-7\/10/.test(convText), convText.slice(0, 160));
  }
  ok("'Bike/Row/Ski Tempo Intervals' is NOT running-based",
    !sb.isRunningBasedConditioning('Bike/Row/Ski Tempo Intervals'));

  const combinedBike = sb.buildCombinedConditioningTemplate('aerobic_base', '2026-07-06', 'lower', undefined, 'bike');
  const combinedRow = sb.buildCombinedConditioningTemplate('aerobic_base', '2026-07-06', 'lower', undefined, 'row');
  const combinedSki = sb.buildCombinedConditioningTemplate('aerobic_base', '2026-07-06', 'lower', undefined, 'ski');
  const longBike = sb.buildConditioningTemplate('Long Nasal Run', '2026-07-06', { ergModality: 'bike' });
  const longRow = sb.buildConditioningTemplate('Long Nasal Run', '2026-07-06', { ergModality: 'row' });
  const longSki = sb.buildConditioningTemplate('Long Nasal Run', '2026-07-06', { ergModality: 'ski' });
  const bikeText = textOfRows([...combinedBike, ...longBike]);
  ok('bike can still be prescribed as 20+ minutes steady',
    /\b(?:2[0-9]|3[0-9]|4[0-9])min zone 2 on Assault Bike\b/i.test(bikeText) &&
    !/\d+\s*x\s*\d+min zone 2 on Assault Bike/i.test(bikeText),
    bikeText.slice(0, 220));
  ok('combined row aerobic over 10min is intervalised',
    /\d+\s*x\s*(?:8|10)min zone 2 on Rower/i.test(textOfRows(combinedRow)) &&
    !/\b(?:1[1-9]|[2-9]\d)min zone 2 on Rower\b/i.test(textOfRows(combinedRow)),
    textOfRows(combinedRow));
  ok('combined ski aerobic over 10min is intervalised',
    /\d+\s*x\s*(?:8|10)min zone 2 on SkiErg/i.test(textOfRows(combinedSki)) &&
    !/\b(?:1[1-9]|[2-9]\d)min zone 2 on SkiErg\b/i.test(textOfRows(combinedSki)),
    textOfRows(combinedSki));
  ok('standalone long row aerobic is intervalised',
    /\d+\s*x\s*(?:8|10)min zone 2 on Rower/i.test(textOfRows(longRow)) &&
    !/\b(?:1[1-9]|[2-9]\d)min zone 2 on Rower\b/i.test(textOfRows(longRow)),
    textOfRows(longRow));
  ok('standalone long ski aerobic is intervalised',
    /\d+\s*x\s*(?:8|10)min zone 2 on SkiErg/i.test(textOfRows(longSki)) &&
    !/\b(?:1[1-9]|[2-9]\d)min zone 2 on SkiErg\b/i.test(textOfRows(longSki)),
    textOfRows(longSki));

  // Kernel classification: tempo category → tempo_conditioning, medium.
  const taxonomy = require('../rules/sessionTaxonomy') as typeof import('../rules/sessionTaxonomy');
  const stressMod = require('../rules/stressClassification') as typeof import('../rules/stressClassification');
  const tempoWorkout = {
    id: 'w-tempo-test', name: 'Conditioning', workoutType: 'Conditioning',
    conditioningCategory: 'tempo', exercises: [],
  } as unknown as import('../types/domain').Workout;
  const units = taxonomy.classifyDaySessions(tempoWorkout);
  ok('kernel classifies tempo category as tempo_conditioning',
    units.some((u) => u.category === 'tempo_conditioning'),
    JSON.stringify(units.map((u) => u.category)));
  const tempoUnit = units.find((u) => u.category === 'tempo_conditioning');
  const stress = tempoUnit
    ? stressMod.classifySessionStress(tempoUnit, tempoWorkout, {})
    : 'MISSING';
  ok('kernel stress for tempo_conditioning is medium',
    stress === 'medium', String(stress));
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`finisherEligibilityTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
