/**
 * R-351 — a full-body day beside dedicated days still owns one big lift.
 *
 * MEASURED 2026-09-02 (seat `hingecod`): a 3-day, no-club, Off-season athlete
 * (lower + upper + full body) was REFUSED at the end of onboarding —
 * `required_minimum_shortfall:main_strength:2`. The lower day reserved squat and
 * hinge, the upper day reserved both push planes and both pull planes, and the
 * full-body day (R-087 coverage: only what the other days missed) was left with
 * three unilateral helpers and no main lift. Week 3 (mid Off-season) requires
 * three main-strength days; the checker counted two. Accepted at the 2026-08-27
 * census checkpoint, refused from the weekly-budget commit onward.
 *
 * Run: npm run test:three-day-main-seat
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { createWeeklyStrengthBudget } from '../rules/weeklyStrengthBudget';
import { coverageSlotsForFullBodyDay } from '../rules/composeWeek';
import { createStrengthIntent } from '../rules/strengthPatternContributions';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import type { SessionSlot } from '../rules/sessionSlotCoverage';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { coldStartThroughOnboarding, quietAsync } from './support/athleteJourney';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const INSTALL_DAY = '2026-07-13';

function threeDayAthlete(): OnboardingData {
  return {
    firstName: 'Sim', ageRange: '22-26', gender: 'male', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    seasonFinishedOn: '2026-07-12',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine', 'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight', benchStrength: '1.5x bodyweight+',
    conditioningLevel: 'Good', sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: { barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have', plyo_box: 'have' },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

// ── 1. THE BUDGET: a full-body day beside a lower and an upper owns the vertical planes ──
const lower = { planEntryId: 'lower', strengthIntent: createStrengthIntent({ archetype: 'lower', plannedPatterns: ['squat', 'hinge'] }) };
const upper = { planEntryId: 'upper', strengthIntent: createStrengthIntent({ archetype: 'upper', plannedPatterns: ['push', 'pull'] }) };
const fullBody = { planEntryId: 'full', strengthIntent: createStrengthIntent({ archetype: 'full_body', plannedPatterns: ['squat', 'hinge', 'push', 'pull'] }) };
const fullBodyB = { planEntryId: 'full-b', strengthIntent: createStrengthIntent({ archetype: 'full_body', plannedPatterns: ['squat', 'hinge', 'push', 'pull'] }) };

{
  const budget = createWeeklyStrengthBudget([lower, upper, fullBody]);
  const owners = budget.reservedOwnerBySlot;
  check('lower + upper + full body: the full-body day owns the vertical push seat',
    owners.vertical_push === 'full', JSON.stringify(owners));
  check('lower + upper + full body: the full-body day owns the vertical pull seat',
    owners.vertical_pull === 'full', JSON.stringify(owners));
  check('lower + upper + full body: the upper day keeps both horizontal seats',
    owners.horizontal_push === 'upper' && owners.horizontal_pull === 'upper', JSON.stringify(owners));
  check('lower + upper + full body: the lower day keeps squat and hinge',
    owners.squat === 'lower' && owners.hinge === 'lower', JSON.stringify(owners));
  check('the full-body day can spend its vertical seats and the upper day cannot',
    budget.canSpend('vertical_push', 'full') && !budget.canSpend('vertical_push', 'upper'));
  check('the handed-over seat is spent once: the upper day is refused after the full-body day spends it',
    budget.spend('vertical_pull', 'full') && !budget.spend('vertical_pull', 'upper'));
}
{
  // CONTROL — order does not matter: the full-body day may come first in the week.
  const budget = createWeeklyStrengthBudget([fullBody, lower, upper]);
  check('CONTROL: a full-body day placed first still owns the vertical seats',
    budget.reservedOwnerBySlot.vertical_push === 'full' && budget.reservedOwnerBySlot.vertical_pull === 'full');
}
{
  // CONTROL — lower + two full-body days: the upper seats were never reserved, so
  // nothing is handed over and the full-body days spend what their shapes reach.
  const budget = createWeeklyStrengthBudget([lower, fullBody, fullBodyB]);
  const owners = budget.reservedOwnerBySlot;
  check('CONTROL: lower + two full-body days leaves the upper seats unreserved',
    owners.vertical_push === undefined && owners.horizontal_push === undefined
    && owners.vertical_pull === undefined && owners.horizontal_pull === undefined, JSON.stringify(owners));
}
{
  // CONTROL — an upper-only reservation beside a full-body day: the lower seats
  // are free, so the full-body day already has main seats to spend; no hand-over.
  const budget = createWeeklyStrengthBudget([upper, fullBody]);
  const owners = budget.reservedOwnerBySlot;
  check('CONTROL: upper + full body keeps all four upper seats with the upper day',
    owners.vertical_push === 'upper' && owners.vertical_pull === 'upper'
    && owners.squat === undefined && owners.hinge === undefined, JSON.stringify(owners));
}

// ── 2. THE COVERAGE DAY: a seat the budget reserved for THIS day is a gap it must fill ──
{
  const supplied = new Set<SessionSlot>(['squat', 'hinge', 'single_leg_knee',
    'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'football_robustness', 'core']);
  const before = coverageSlotsForFullBodyDay({
    suppliedByOtherDays: supplied, takenByEarlierCoverageDays: new Set(), pairCounts: {},
  });
  check('CONTROL: with no reserved seat the coverage day sees only the single-leg hip gap',
    before.length === 1 && before[0] === 'single_leg_hip', JSON.stringify(before));
  const after = coverageSlotsForFullBodyDay({
    suppliedByOtherDays: supplied, takenByEarlierCoverageDays: new Set(), pairCounts: {},
    reservedForThisDay: ['vertical_push', 'vertical_pull'],
  });
  check('a reserved seat leads the coverage day even though another day could supply the plane',
    after[0] === 'vertical_push' && after[1] === 'vertical_pull' && after.includes('single_leg_hip'),
    JSON.stringify(after));
  check('a reserved seat is never listed twice',
    after.filter((slot) => slot === 'vertical_push').length === 1, JSON.stringify(after));
}

// ── 3. THE ATHLETE: the refused 3-day athlete onboards and week 3 has three big-lift days ──
function mainLiftDays(workouts: readonly Workout[]): string[] {
  return workouts.filter((workout) => {
    const strengthRows = (workout.exercises ?? []).filter((row) => row.role !== 'power');
    return strengthRows.some((row, index) => classifyGeneratedWorkoutRow({
      name: row.exercise?.name ?? '', sets: row.prescribedSets, repsMax: row.prescribedRepsMax, index,
    }).kind === 'strength_main');
  }).map((workout) => `${workout.dayOfWeek}:${workout.name}`);
}

(async () => {
  let refusal: string | null = null;
  let program: TrainingProgram | null = null;
  try {
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile: threeDayAthlete(), installDayISO: INSTALL_DAY }));
    refusal = installed.onboardingRefusal;
    program = installed.program;
  } catch (error) {
    refusal = (error as Error).message;
  }
  check('the 3-day Off-season athlete is ACCEPTED at the end of onboarding', refusal === null, String(refusal));
  const weeks = program?.microcycles ?? [];
  for (const [index, week] of weeks.slice(0, 4).entries()) {
    const days = mainLiftDays(week.workouts);
    check(`week ${index + 1}: every strength day carries a main lift (three of three)`,
      days.length === 3, days.join(', '));
  }
  const fullBodyDay = weeks[2]?.workouts.find((w: Workout) => /full/i.test(w.name));
  const fullBodyRows = fullBodyDay?.exercises ?? [];
  check('week 3 full-body day exists and carries a vertical push or vertical pull main lift',
    !!fullBodyDay && fullBodyRows.length > 0 && mainLiftDays([fullBodyDay]).length === 1,
    fullBodyRows.map((r) => r.exercise?.name).join(', '));
  // ── 4. BOTH owned seats, EVERY week: the full-body day is not on alternate shapes ──
  for (const [index, week] of weeks.slice(0, 4).entries()) {
    const day = week.workouts.find((w: Workout) => /full/i.test(w.name));
    const names = (day?.exercises ?? []).map((r) => r.exercise?.name ?? '');
    const verticalPush = names.some((n) => /Overhead Press|Shoulder Press|Landmine Press|Z-Press|Seated DB Press/.test(n));
    const verticalPull = names.some((n) => /Pull-Ups|Chin-Ups|Pulldown/.test(n));
    check(`week ${index + 1}: the full-body day carries BOTH the vertical push and the vertical pull it owns`,
      verticalPush && verticalPull, names.join(', '));
  }
  console.log(`\nThree-day main seat: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})();
