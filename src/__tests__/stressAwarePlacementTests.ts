/**
 * stressAwarePlacementTests — Option B stress-aware placement model.
 *
 * Proves (Sam's approved test list, 2026-07-08):
 *   1. S11 pre-season game week produces the target structure:
 *      lower early / upper pull+push on team days / G-1 light /
 *      3 proper strength exposures / 4 hard days / no game-proximity
 *      or sprint findings.
 *   2. Upper stacked onto team training does NOT create an extra hard day.
 *   3. Sandwiched day between two team days: lower/full-body and hard
 *      conditioning stay blocked; only medium/low work may sit there.
 *   4. Low-readiness athletes do NOT receive the higher-dose structure.
 *   5. Pre-season no-game (S12 shape) still produces a safe week.
 *
 * Run: npm run test:stress-placement
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import { validateProgramWeek, type ValidatorDayInput } from '../rules/weekStructureValidator';
import type { OnboardingData, Workout } from '../types/domain';

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

const NOW = new Date().toISOString();
const ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// 2026-06-01 is a Monday.
const DATE_OF: Record<string, string> = {
  Monday: '2026-06-01', Tuesday: '2026-06-02', Wednesday: '2026-06-03',
  Thursday: '2026-06-04', Friday: '2026-06-05', Saturday: '2026-06-06', Sunday: '2026-06-07',
};

function planFor(onboarding: Partial<OnboardingData>) {
  const plan = buildCoachingPlan(onboardingToCoachingInputs(onboarding as OnboardingData));
  const sorted = [...plan.weeklyPlan].sort(
    (a, b) => ORDER.indexOf(a.dayOfWeek || '') - ORDER.indexOf(b.dayOfWeek || ''),
  );
  return { plan, sorted };
}

function byDay(sorted: SessionAllocation[], day: string): SessionAllocation | undefined {
  return sorted.find((s) => s.dayOfWeek === day);
}

/** Map allocations (+ optional game day) to validator days. */
function validatorDays(sorted: SessionAllocation[], gameDay?: string): ValidatorDayInput[] {
  const byDate: Record<string, Array<Workout | null>> = {};
  for (const s of sorted) {
    if (!s.dayOfWeek) continue;
    const w = {
      id: `w-${s.dayOfWeek}`, microcycleId: 'mc', dayOfWeek: ORDER.indexOf(s.dayOfWeek),
      name: s.focus, description: s.focus, durationMinutes: 50,
      intensity: s.isHardExposure ? 'High' : 'Moderate',
      workoutType: s.tier === 'recovery' ? 'Recovery' : 'Strength',
      sessionTier: s.tier,
      hasCombinedConditioning: s.hasCombinedConditioning,
      conditioningFlavour: s.conditioningFlavour,
      conditioningCategory: s.conditioningCategory,
      exercises: [], createdAt: NOW, updatedAt: NOW,
    } as unknown as Workout;
    if (s.isTeamDay) (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
    (byDate[DATE_OF[s.dayOfWeek]] ||= []).push(w);
  }
  if (gameDay && DATE_OF[gameDay]) {
    (byDate[DATE_OF[gameDay]] ||= []).push({
      id: 'w-game', microcycleId: 'mc', dayOfWeek: ORDER.indexOf(gameDay),
      name: 'Game Day', description: '', durationMinutes: 0, intensity: 'Maximal',
      workoutType: 'Game', exercises: [], createdAt: NOW, updatedAt: NOW,
    } as unknown as Workout);
  }
  return Object.values(DATE_OF).sort().map((date) => ({ date, workouts: byDate[date] ?? [] }));
}

const S11_PROFILE: Partial<OnboardingData> = {
  seasonPhase: 'Pre-season', gameDay: 'Saturday', trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
  conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
  motivation: 'Get stronger',
};

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. S11 pre-season game week — target structure ──');
{
  const { sorted } = planFor(S11_PROFILE);
  const isUpperFocus = (s?: SessionAllocation) => !!s && /upper/i.test(s.focus);
  const isLowerAlloc = (s?: SessionAllocation) => !!s &&
    (s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined' || /lower/i.test(s.focus));

  const mon = byDay(sorted, 'Monday');
  const tue = byDay(sorted, 'Tuesday');
  const thu = byDay(sorted, 'Thursday');
  const fri = byDay(sorted, 'Friday');

  ok('lower strength sits early (Monday), away from the game',
    isLowerAlloc(mon) && mon?.tier === 'core', mon?.focus);
  ok('Tuesday team day carries upper strength', !!tue?.isTeamDay && isUpperFocus(tue), tue?.focus);
  ok('Thursday team day carries upper strength', !!thu?.isTeamDay && isUpperFocus(thu), thu?.focus);
  ok('team days carry one push and one pull emphasis',
    [tue, thu].filter((s) => /push emphasis/i.test(s?.focus ?? '')).length === 1 &&
    [tue, thu].filter((s) => /pull emphasis/i.test(s?.focus ?? '')).length === 1,
    `${tue?.focus} | ${thu?.focus}`);
  ok('G-1 (Friday) is light: optional/recovery tier, low stress',
    !!fri && fri.tier !== 'core' && fri.stressLevel !== 'high', `${fri?.tier}/${fri?.stressLevel}: ${fri?.focus}`);
  ok('no lower/full-body strength on G-1 or G-2 standalone',
    !isLowerAlloc(fri) && !/full body/i.test(fri?.focus ?? ''), fri?.focus);

  const gymStrength = sorted.filter((s) =>
    s.tier === 'core' && (isLowerAlloc(s) || isUpperFocus(s)));
  ok('3 proper strength exposures (1 lower + 2 upper)', gymStrength.length === 3,
    gymStrength.map((s) => s.focus.slice(0, 30)).join(' | '));

  // Validator view: counts + findings.
  const report = validateProgramWeek({
    days: validatorDays(sorted, 'Saturday'),
    profile: { seasonPhase: 'Pre-season', teamTrainingIntensity: 'Hard', conditioningLevel: 'Good' },
  });
  ok('4 hard days (Mon lower, 2×TT+upper, game) — upper on TT adds NO extra hard day',
    report.counts.hardDays === 4, `hardDays=${report.counts.hardDays}`);
  ok('validator counts 3 main strength exposures',
    report.counts.mainStrengthExposures === 3, `got ${report.counts.mainStrengthExposures}`);
  ok('no g1_not_light / g2 / sprint-proximity findings',
    report.findings.every((f) => !/^g1_|^g2_|^g_plus1/.test(f.ruleId)),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
  ok('sprint/COD exposures within cap (≤3: 2×TT + game, no app-added sprint)',
    report.counts.sprintCodExposures <= 3, `got ${report.counts.sprintCodExposures}`);
  ok('no strong/hard_stop findings on the S11 week',
    report.findings.every((f) => f.severity !== 'strong' && f.severity !== 'hard_stop'),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Sandwiched day between two team days ──');
{
  // Pre-season, no game, Mon-Fri available, TT Tue/Thu, high readiness →
  // 4-exposure regime. Wednesday sits between two hard team days.
  const { sorted } = planFor({
    seasonPhase: 'Pre-season', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard', sprintExposure: '2+ times per week',
    conditioningLevel: 'Good', recentTrainingLoad: 'Very consistent', injuries: [],
    motivation: 'Get stronger',
  });
  const wed = byDay(sorted, 'Wednesday');
  const isLowerish = (s?: SessionAllocation) => !!s &&
    (s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined' ||
     s.strengthPattern === 'full_body' || /lower|full body/i.test(s.focus));
  const isHardCond = (s?: SessionAllocation) => !!s && s.tier !== 'optional' && s.tier !== 'recovery' &&
    !!s.conditioningCategory && s.conditioningCategory !== 'aerobic_base' && !/upper|lower|full body/i.test(s.focus);

  ok('TT + Wed lower/full-body + TT remains blocked', !isLowerish(wed), wed?.focus);
  ok('TT + Wed hard conditioning/sprint + TT remains blocked', !isHardCond(wed),
    `${wed?.focus} (cat=${wed?.conditioningCategory})`);
  ok('Wednesday holds only medium/low-stress work (upper / easy / recovery legal)',
    !wed || wed.stressLevel !== 'high', `${wed?.stressLevel}: ${wed?.focus}`);
  // The week must still deliver its strength volume elsewhere.
  const strengthCount = sorted.filter((s) => s.tier === 'core' &&
    (s.strengthPattern || /upper|lower|full body/i.test(s.focus))).length;
  ok('no-game pre-season week still delivers ≥3 strength exposures',
    strengthCount >= 3, `got ${strengthCount}`);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2b. Controlled FB between team days when availability forces it ──');
{
  // Only realistic gym day is Wednesday, sandwiched between TT Tue/Thu.
  // Sam's hierarchy #4: controlled full body is acceptable here (core ≤ 2)
  // — the week must not collapse to zero strength.
  const { sorted } = planFor({
    seasonPhase: 'Pre-season', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Tuesday', 'Wednesday', 'Thursday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard', sprintExposure: 'Occasionally',
    conditioningLevel: 'Average', recentTrainingLoad: 'Pretty consistent', injuries: [],
    motivation: 'Get stronger',
  });
  const strengthAnywhere = sorted.filter((s) =>
    s.tier === 'core' && (s.strengthPattern || /upper|lower|full body/i.test(s.focus)));
  ok('availability-forced week still gets ≥1 strength exposure (FB or TT-upper)',
    strengthAnywhere.length >= 1,
    sorted.map((s) => `${s.dayOfWeek}:${s.focus.slice(0, 25)}`).join(' | '));
  const wed = byDay(sorted, 'Wednesday');
  ok('sandwiched slot never holds hinge-heavy lower or hard conditioning',
    !(wed && (wed.strengthPattern === 'lower' || wed.strengthPattern === 'lower_combined')) &&
    !(wed?.conditioningCategory && wed.conditioningCategory !== 'aerobic_base' && !/upper|full body/i.test(wed.focus)),
    `${wed?.focus} (${wed?.strengthPattern ?? '-'}/${wed?.conditioningCategory ?? '-'})`);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Low readiness does NOT get the higher-dose structure ──');
{
  const { sorted } = planFor({
    ...S11_PROFILE,
    recentTrainingLoad: 'Hardly at all',
    conditioningLevel: 'Poor',
    sprintExposure: 'No sprint training',
  });
  const gymStrength = sorted.filter((s) =>
    s.tier === 'core' && (s.strengthPattern || /upper|lower|full body/i.test(s.focus)) && !s.isTeamDay);
  const ttUppers = sorted.filter((s) => s.isTeamDay && /upper/i.test(s.focus));
  ok('low-readiness game week stays at reduced dose (≤2 gym strength incl. TT doubles)',
    gymStrength.length + ttUppers.length <= 2,
    `gym=${gymStrength.length}, ttUppers=${ttUppers.length}`);
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3b. Floor back-offs: severe injury + reduced availability ──');
{
  // Severe injury: the {3,3} game-week floor must NOT fire (readiness also
  // degrades). Dose must not exceed the pre-Option-B baseline of 3, and
  // content restriction is the downstream injury engine's job.
  const { plan, sorted } = planFor({
    ...S11_PROFILE,
    injuries: [{ bodyArea: 'hamstring', description: 'tear', severity: 'Severe' }],
  });
  const gymStrength = sorted.filter((s) => s.tier === 'core' &&
    (s.strengthPattern || /upper|lower|full body/i.test(s.focus))).length;
  ok('severe injury: readiness degraded below high', plan.readiness !== 'high', plan.readiness);
  ok('severe injury: dose does not exceed baseline (≤3 strength)', gymStrength <= 3, `got ${gymStrength}`);
}
{
  // Busy week entered as an availability constraint (Monday blocked):
  // availableDays drops below 5 → floor off; dose reduces.
  const { sorted } = planFor({
    ...S11_PROFILE,
    availabilityConstraints: [{
      id: 'busy-1', kind: 'unavailable_day', scope: 'permanent', dayOfWeek: 'Monday', active: true,
    }],
  });
  const gymStrength = sorted.filter((s) => s.tier === 'core' &&
    (s.strengthPattern || /upper|lower|full body/i.test(s.focus))).length;
  ok('blocked day (busy/away): floor backs off, dose reduces (≤2 strength)',
    gymStrength <= 2, `got ${gymStrength}: ${sorted.map((s) => `${s.dayOfWeek}:${s.focus.slice(0, 20)}`).join(' | ')}`);
  ok('blocked day: nothing scheduled on the unavailable Monday',
    !sorted.some((s) => s.dayOfWeek === 'Monday' && s.tier === 'core'),
    sorted.filter((s) => s.dayOfWeek === 'Monday').map((s) => s.focus).join(' | '));
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Pre-season no-game (S12 shape) stays safe ──');
{
  const { sorted } = planFor({
    seasonPhase: 'Pre-season', trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Moderate', sprintExposure: 'Occasionally',
    conditioningLevel: 'Average', recentTrainingLoad: 'Pretty consistent', injuries: [],
    motivation: 'Get stronger',
  });
  const report = validateProgramWeek({
    days: validatorDays(sorted),
    profile: { seasonPhase: 'Pre-season', teamTrainingIntensity: 'Moderate', conditioningLevel: 'Average' },
  });
  ok('no-game pre-season week has no strong/hard_stop findings',
    report.findings.every((f) => f.severity !== 'strong' && f.severity !== 'hard_stop'),
    report.findings.map((f) => `${f.severity}:${f.ruleId}`).join(' | '));
  ok('no-game pre-season week within hard-day bounds (≤5)',
    report.counts.hardDays <= 5, `hardDays=${report.counts.hardDays}`);
}

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`stressAwarePlacementTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n  - ' + failures.join('\n  - '));
process.exit(fail > 0 ? 1 : 0);
