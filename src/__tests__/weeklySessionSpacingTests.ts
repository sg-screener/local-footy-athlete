/**
 * Weekly session spacing regressions.
 *
 * Run: npm run test:weekly-spacing
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildCoachingPlan,
  classifyGenerationSession,
  type CoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function section(name: string): void {
  console.log(`\n${name}`);
}

const DAY_NUM: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const ALL_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

function baseInputs(
  selectedDays: string[] = ALL_DAYS,
  readiness: 'medium' | 'low' = 'medium',
): CoachingInputs {
  return {
    seasonPhase: 'Off-season',
    availableDays: selectedDays.length,
    selectedDays,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
    sprintExposure: 'Moderate',
    conditioningLevel: readiness === 'low' ? 'Average' : 'Good',
    recentTrainingLoad: readiness === 'low' ? 'A bit' : 'Pretty consistent',
    injuries: [],
    goals: ['General fitness'],
    hasGame: false,
    gameDay: undefined,
    weekInBlock: 1,
    weekNumber: 1,
  };
}

function chronological(plan: SessionAllocation[]): SessionAllocation[] {
  return [...plan].sort((a, b) =>
    (DAY_NUM[a.dayOfWeek ?? ''] || 7) - (DAY_NUM[b.dayOfWeek ?? ''] || 7),
  );
}

function dayNumbers(
  plan: SessionAllocation[],
  predicate: (session: SessionAllocation) => boolean,
): number[] {
  return chronological(plan)
    .filter(predicate)
    .map((session) => DAY_NUM[session.dayOfWeek ?? ''])
    .filter((day) => Number.isFinite(day));
}

function classification(session: SessionAllocation) {
  return classifyGenerationSession(session);
}

function isMainStrength(session: SessionAllocation): boolean {
  return classification(session).contributions.mainStrength > 0;
}

function isStandaloneAerobic(session: SessionAllocation): boolean {
  const result = classification(session);
  return (
    !session.strengthPattern &&
    result.categories.includes('aerobic_base') &&
    result.contributions.conditioning > 0
  );
}

function isUsefulTraining(session: SessionAllocation): boolean {
  const contributions = classification(session).contributions;
  return (
    contributions.mainStrength > 0 ||
    contributions.extraConditioning > 0 ||
    contributions.sprintCod > 0
  );
}

function minimumGap(days: number[]): number {
  if (days.length < 2) return 99;
  return Math.min(...days.slice(1).map((day, index) => day - days[index]));
}

section('[1] Seven-day early off-season distributes useful work');
{
  const plan = buildCoachingPlan(baseInputs()).weeklyPlan;
  const strengthDays = dayNumbers(plan, isMainStrength);
  const usefulDays = dayNumbers(plan, isUsefulTraining);

  eq('main strength uses Monday/Wednesday/Friday rhythm', strengthDays, [1, 3, 5]);
  ok('main strength is never back-to-back', minimumGap(strengthDays) >= 2, strengthDays.join(','));
  ok('useful training reaches the second half of the week', Math.max(...usefulDays) >= 5, usefulDays.join(','));
  ok(
    'useful training is not exhausted inside Monday-Wednesday',
    usefulDays.some((day) => day >= 5),
    usefulDays.join(','),
  );

  const tuesday = plan.find((session) => session.dayOfWeek === 'Tuesday');
  const thursday = plan.find((session) => session.dayOfWeek === 'Thursday');
  ok(
    'support/recovery separates Monday-Wednesday strength',
    !!tuesday && !isUsefulTraining(tuesday),
    tuesday?.focus,
  );
  ok(
    'support/recovery separates Wednesday-Friday strength',
    !!thursday && !isUsefulTraining(thursday),
    thursday?.focus,
  );
}

section('[2] Low-readiness early off-season stays light and spaced');
{
  const plan = buildCoachingPlan(baseInputs(ALL_DAYS, 'low')).weeklyPlan;
  const strengthDays = dayNumbers(plan, isMainStrength);
  const aerobicDays = dayNumbers(plan, isStandaloneAerobic);
  const usefulDays = dayNumbers(plan, isUsefulTraining);

  eq('low-readiness full-body sessions are spread Monday/Friday', strengthDays, [1, 5]);
  eq('repeated standalone aerobic sessions are spread Wednesday/Saturday', aerobicDays, [3, 6]);
  ok('repeated strength has a large recovery gap', minimumGap(strengthDays) >= 3, strengthDays.join(','));
  ok('repeated aerobic has a large recovery gap', minimumGap(aerobicDays) >= 3, aerobicDays.join(','));
  ok('low-readiness useful work still reaches Saturday', Math.max(...usefulDays) === 6, usefulDays.join(','));
  ok(
    'low-readiness week adds no high-stress app session',
    plan.every((session) => classification(session).stressLevel !== 'high'),
    plan.map((session) => `${session.dayOfWeek}:${classification(session).stressLevel}`).join(' | '),
  );
}

section('[3] Six-day and Monday-Friday availability use the full window');
{
  const sixDayPlan = buildCoachingPlan(baseInputs(ALL_DAYS.slice(0, 6))).weeklyPlan;
  const fiveDayPlan = buildCoachingPlan(baseInputs(ALL_DAYS.slice(0, 5))).weeklyPlan;

  eq(
    'Monday-Saturday availability spreads strength Monday/Wednesday/Friday',
    dayNumbers(sixDayPlan, isMainStrength),
    [1, 3, 5],
  );
  eq(
    'Monday-Friday availability spreads strength Monday/Wednesday/Friday',
    dayNumbers(fiveDayPlan, isMainStrength),
    [1, 3, 5],
  );
  ok(
    'six-day week does not place all useful work in its first three slots',
    dayNumbers(sixDayPlan, isUsefulTraining).some((day) => day >= 5),
  );
}

section('[4] Team/game anchors and pre-season team rhythm remain protected');
{
  const inSeason = buildCoachingPlan({
    ...baseInputs(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    seasonPhase: 'In-season',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard',
    hasGame: true,
    gameDay: 'Saturday',
  }).weeklyPlan;
  const inSeasonTeamDays = inSeason
    .filter((session) => session.isTeamDay)
    .map((session) => session.dayOfWeek)
    .sort();
  eq('in-season team anchors remain Tuesday/Thursday', inSeasonTeamDays, ['Thursday', 'Tuesday']);
  ok(
    'in-season G-1 Friday remains non-hard support',
    inSeason.some((session) =>
      session.dayOfWeek === 'Friday' &&
      classification(session).stressLevel !== 'high' &&
      !session.conditioningCategory &&
      !session.strengthPattern),
  );

  const preSeason = buildCoachingPlan({
    ...baseInputs(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    seasonPhase: 'Pre-season',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard',
    hasGame: false,
    gameDay: undefined,
    weekInBlock: 2,
    weekNumber: 2,
  }).weeklyPlan;
  const preSeasonTeamDays = preSeason
    .filter((session) => session.isTeamDay)
    .map((session) => session.dayOfWeek)
    .sort();
  eq('pre-season team anchors remain Tuesday/Thursday', preSeasonTeamDays, ['Thursday', 'Tuesday']);
  ok(
    'pre-season team anchors do not gain app conditioning',
    preSeason
      .filter((session) => session.isTeamDay)
      .every((session) => !session.conditioningCategory && !session.hasCombinedConditioning),
  );
}

section('[5] Beginner policy remains conservative and spaced');
{
  const beginner = buildCoachingPlan({
    ...baseInputs(),
    experienceLevel: 'Complete beginner',
    goals: ['Get stronger'],
  }).weeklyPlan;
  const strengthDays = dayNumbers(beginner, isMainStrength);
  ok('beginner main strength remains capped', strengthDays.length <= 2, strengthDays.join(','));
  ok('beginner strength is not back-to-back', minimumGap(strengthDays) >= 2, strengthDays.join(','));
}

console.log(`\nweeklySessionSpacingTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.map((failure) => `  - ${failure}`).join('\n'));
  process.exit(1);
}
