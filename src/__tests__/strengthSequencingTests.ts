/**
 * Global strength-load sequencing tests.
 *
 * Run: npm run test:strength-sequencing
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildCoachingPlan,
  scoreStrengthSequence,
  type CoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import { inferMovementPatterns, type MovementPattern } from '../utils/sessionNaming';
import type { Workout } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function section(label: string) {
  console.log(`\n${label}`);
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

const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type StrengthKind =
  | 'squat'
  | 'hinge'
  | 'push'
  | 'pull'
  | 'lower_combined'
  | 'upper_combined'
  | 'full_body'
  | 'neutral';

type StrengthRegion = 'upper' | 'lower' | 'neutral';

function kindFromPatterns(patterns: MovementPattern[], fallback?: SessionAllocation['strengthPattern']): StrengthKind {
  const has = (pattern: MovementPattern) => patterns.includes(pattern);
  const hasSquat = has('squat');
  const hasHinge = has('hinge');
  const hasPush = has('push');
  const hasPull = has('pull');
  const hasLower = hasSquat || hasHinge;
  const hasUpper = hasPush || hasPull;

  if (hasLower && hasUpper) return 'full_body';
  if (hasSquat && hasHinge) return 'lower_combined';
  if (hasPush && hasPull) return 'upper_combined';
  if (hasHinge) return 'hinge';
  if (hasSquat) return 'squat';
  if (hasPull) return 'pull';
  if (hasPush) return 'push';

  switch (fallback) {
    case 'lower':
    case 'lower_combined':
      return 'lower_combined';
    case 'push':
      return 'push';
    case 'pull':
      return 'pull';
    case 'upper_combined':
      return 'upper_combined';
    case 'full_body':
      return 'full_body';
    default:
      return 'neutral';
  }
}

function stripConditioningSuffix(focus: string): string {
  return focus.replace(
    /\s\+\s.*(?:conditioning|finisher|interval|aerobic|tempo|sprint|zone 2).*/i,
    '',
  );
}

function strengthKind(session: SessionAllocation): StrengthKind {
  return kindFromPatterns(
    inferMovementPatterns(stripConditioningSuffix(session.focus || '')),
    session.strengthPattern,
  );
}

function workoutKind(workout: Workout): StrengthKind {
  const text = `${workout.name} ${workout.description || ''} ${
    workout.exercises.map(ex => ex.exercise?.name || '').join(' ')
  }`;
  return kindFromPatterns(inferMovementPatterns(text));
}

function strengthRegion(kind: StrengthKind): StrengthRegion {
  switch (kind) {
    case 'squat':
    case 'hinge':
    case 'lower_combined':
      return 'lower';
    case 'push':
    case 'pull':
    case 'upper_combined':
      return 'upper';
    default:
      return 'neutral';
  }
}

function isPullLike(kind: StrengthKind): boolean {
  return kind === 'pull' || kind === 'upper_combined' || kind === 'full_body';
}

function isHingeLike(kind: StrengthKind): boolean {
  return kind === 'hinge' || kind === 'lower_combined' || kind === 'full_body';
}

function hasPosteriorChainAdjacency(kinds: StrengthKind[]): boolean {
  for (let i = 1; i < kinds.length; i++) {
    const prev = kinds[i - 1];
    const curr = kinds[i];
    if ((isPullLike(prev) && isHingeLike(curr)) || (isHingeLike(prev) && isPullLike(curr))) {
      return true;
    }
  }
  return false;
}

function shape(plan: SessionAllocation[]): string {
  return plan
    .map(s => `${s.dayOfWeek}:${strengthKind(s)}:${s.conditioningCategory ?? '-'}`)
    .join(' | ');
}

function strengthKindsByDay(plan: SessionAllocation[]): StrengthKind[] {
  return [...plan]
    .sort((a, b) => DAY_NUM[a.dayOfWeek || ''] - DAY_NUM[b.dayOfWeek || ''])
    .map(strengthKind);
}

function adjacentSameRegionPairs(plan: SessionAllocation[]): string[] {
  const byDay = [...plan]
    .filter(s => s.dayOfWeek && DAY_NUM[s.dayOfWeek] !== undefined)
    .sort((a, b) => DAY_NUM[a.dayOfWeek!] - DAY_NUM[b.dayOfWeek!]);

  const pairs: string[] = [];
  for (let i = 1; i < byDay.length; i++) {
    const prev = byDay[i - 1];
    const curr = byDay[i];
    const prevDay = DAY_NUM[prev.dayOfWeek!];
    const currDay = DAY_NUM[curr.dayOfWeek!];
    if (currDay - prevDay !== 1) continue;
    const prevRegion = strengthRegion(strengthKind(prev));
    const currRegion = strengthRegion(strengthKind(curr));
    if (prevRegion !== 'neutral' && prevRegion === currRegion) {
      pairs.push(`${prev.dayOfWeek}/${curr.dayOfWeek}:${currRegion}`);
    }
  }
  return pairs;
}

function assertNoAdjacentStrengthRegionPairs(name: string, plan: SessionAllocation[]) {
  const pairs = adjacentSameRegionPairs(plan);
  ok(name, pairs.length === 0, `pairs=${pairs.join(', ')} shape=${shape(plan)}`);
}

function assertLowerStrengthSpacing(name: string, plan: SessionAllocation[]) {
  const lowerDays = plan
    .filter(s => strengthRegion(strengthKind(s)) === 'lower' && s.dayOfWeek)
    .map(s => DAY_NUM[s.dayOfWeek!])
    .sort((a, b) => a - b);

  const adjacent = lowerDays.some((day, idx) => idx > 0 && day - lowerDays[idx - 1] < 2);
  ok(name, !adjacent, `lowerDays=${lowerDays.join(', ')} shape=${shape(plan)}`);
}

function assertNoPullHingeAdjacency(name: string, plan: SessionAllocation[]) {
  const kinds = strengthKindsByDay(plan);
  ok(name, !hasPosteriorChainAdjacency(kinds), `kinds=${kinds.join(', ')} shape=${shape(plan)}`);
}

function maxConsecutiveCoreDays(plan: SessionAllocation[]): number {
  const byDay = [...plan]
    .filter(s => s.dayOfWeek && DAY_NUM[s.dayOfWeek] !== undefined)
    .sort((a, b) => DAY_NUM[a.dayOfWeek!] - DAY_NUM[b.dayOfWeek!]);

  let max = 0;
  let current = 0;
  let prevDay = -99;
  for (const session of byDay) {
    const day = DAY_NUM[session.dayOfWeek!];
    const isConsecutive = day === prevDay + 1;
    if (session.tier === 'core') {
      current = isConsecutive ? current + 1 : 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
    prevDay = day;
  }
  return max;
}

function assertConditioningPairing(name: string, plan: SessionAllocation[]) {
  const lowerHighIntensityCombined = plan.filter(s =>
    strengthRegion(strengthKind(s)) === 'lower'
    && s.hasCombinedConditioning
    && (s.conditioningCategory === 'sprint' || s.conditioningCategory === 'glycolytic')
  );

  ok(
    `${name} includes combined conditioning where planned`,
    plan.some(s => s.hasCombinedConditioning),
    shape(plan),
  );
  ok(
    `${name} lower sprint/glycolytic S+C uses machine language`,
    lowerHighIntensityCombined.every(s => /bike|rower|ski/i.test(s.focus)),
    lowerHighIntensityCombined.map(s => `${s.dayOfWeek}:${s.focus}`).join(' | '),
  );
}

function baseInputs(phase: CoachingInputs['seasonPhase']): CoachingInputs {
  return {
    seasonPhase: phase,
    availableDays: 5,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
    sprintExposure: 'Moderate',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
    goals: ['Get stronger'],
    hasGame: false,
    gameDay: undefined,
  };
}

function fakeSession(dayOfWeek: string, focus: string, pattern: SessionAllocation['strengthPattern']): SessionAllocation {
  return {
    tier: 'core',
    focus,
    dayOfWeek,
    isHardExposure: true,
    strengthPattern: pattern,
  };
}

section('[1] Early off-season Mon-Fri uses hinge+pull/push/squat body-armour ledger');
{
  const plan = buildCoachingPlan(baseInputs('Off-season')).weeklyPlan;
  eq(
    'early off-season default sequence',
    strengthKindsByDay(plan),
    ['full_body', 'neutral', 'push', 'neutral', 'squat'],
  );
  ok(
    'early off-season sessions are all optional',
    plan.every((session) => session.tier === 'optional'),
    shape(plan),
  );
  assertNoAdjacentStrengthRegionPairs('off-season has no adjacent same-region strength pair', plan);
  assertLowerStrengthSpacing('off-season lower strength days are separated', plan);
  assertNoPullHingeAdjacency('off-season has no pull/hinge adjacency', plan);
  assertConditioningPairing('off-season', plan);
}

section('[2] Pre-season no-game uses the same posterior-chain guard');
{
  const plan = buildCoachingPlan(baseInputs('Pre-season')).weeklyPlan;
  assertNoAdjacentStrengthRegionPairs('pre-season no-game has no adjacent same-region strength pair', plan);
  assertLowerStrengthSpacing('pre-season no-game lower strength days are separated', plan);
  assertNoPullHingeAdjacency('pre-season no-game has no pull/hinge adjacency', plan);
  assertConditioningPairing('pre-season no-game', plan);
}

section('[3] In-season keeps game-day constraints ahead of sequencing preference');
{
  const plan = buildCoachingPlan({
    ...baseInputs('In-season'),
    hasGame: true,
    gameDay: 'Saturday',
  }).weeklyPlan;
  const byDay = [...plan].sort((a, b) => DAY_NUM[a.dayOfWeek || ''] - DAY_NUM[b.dayOfWeek || '']);

  ok('in-season game week keeps G-2 as upper push or optional, not lower', !/lower|hinge|squat/i.test(byDay.find(s => s.dayOfWeek === 'Thursday')?.focus || ''), shape(plan));
  ok('in-season game week keeps G-1 optional/non-lower', !/lower|hinge|squat/i.test(byDay.find(s => s.dayOfWeek === 'Friday')?.focus || ''), shape(plan));
  ok('in-season chooses least-bad instead of breaking game buckets', scoreStrengthSequence(plan) > 0, shape(plan));
}

section('[4] Pre-season team weeks prefer 3-on / 1-off / 2-on rhythm');
{
  const plan = buildCoachingPlan({
    ...baseInputs('Pre-season'),
    availableDays: 6,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Monday', 'Wednesday'],
    teamTrainingIntensity: 'Moderate',
  }).weeklyPlan;

  const thursday = plan.find(s => s.dayOfWeek === 'Thursday');
  ok('pre-season team week has no 4-core-day run', maxConsecutiveCoreDays(plan) <= 3, shape(plan));
  ok('pre-season team week places the in-week recovery break after 3 days', thursday?.tier !== 'core', shape(plan));
  ok('pre-season team week keeps Monday team training', !!plan.find(s => s.dayOfWeek === 'Monday' && s.isTeamDay), shape(plan));
  ok('pre-season team week keeps Wednesday team training', !!plan.find(s => s.dayOfWeek === 'Wednesday' && s.isTeamDay), shape(plan));
  assertNoAdjacentStrengthRegionPairs('pre-season team week avoids same-body back-to-back where possible', plan);
  assertNoPullHingeAdjacency('pre-season team week avoids pull/hinge adjacency where possible', plan);

  const fullWeek = buildCoachingPlan({
    ...baseInputs('Pre-season'),
    availableDays: 7,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Monday', 'Wednesday'],
    teamTrainingIntensity: 'Moderate',
  }).weeklyPlan;
  const fullWeekThursday = fullWeek.find(s => s.dayOfWeek === 'Thursday');
  const fullWeekSunday = fullWeek.find(s => s.dayOfWeek === 'Sunday');
  ok('fully available pre-season week keeps Thursday as the 3-on/1-off break', fullWeekThursday?.tier !== 'core', shape(fullWeek));
  ok('fully available pre-season week keeps Sunday as the final off day', fullWeekSunday?.tier !== 'core', shape(fullWeek));
  ok('fully available pre-season week has no 4-core-day run', maxConsecutiveCoreDays(fullWeek) <= 3, shape(fullWeek));
}

section('[5] Six-day no-game weeks use Saturday to spread the load');
{
  const preSeason = buildCoachingPlan({
    ...baseInputs('Pre-season'),
    availableDays: 6,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  }).weeklyPlan;
  const preWednesday = preSeason.find(s => s.dayOfWeek === 'Wednesday');
  const preThursday = preSeason.find(s => s.dayOfWeek === 'Thursday');
  const preSaturday = preSeason.find(s => s.dayOfWeek === 'Saturday');
  ok('six-day pre-season week trains through Wednesday before the break', preWednesday?.tier === 'core' || preWednesday?.tier === 'optional', shape(preSeason));
  ok('six-day pre-season week keeps Thursday as the in-week recovery/support break', preThursday?.tier !== 'core', shape(preSeason));
  ok('six-day pre-season week includes Saturday', !!preSaturday, shape(preSeason));
  ok('six-day pre-season week does not cram all work Monday-Friday', preSaturday?.tier === 'core' || preSaturday?.tier === 'optional', shape(preSeason));

  const offSeason = buildCoachingPlan({
    ...baseInputs('Off-season'),
    availableDays: 6,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  }).weeklyPlan;
  const offWednesday = offSeason.find(s => s.dayOfWeek === 'Wednesday');
  const offThursday = offSeason.find(s => s.dayOfWeek === 'Thursday');
  const offSaturday = offSeason.find(s => s.dayOfWeek === 'Saturday');
  ok('six-day off-season week trains through Wednesday before the break', offWednesday?.tier === 'core' || offWednesday?.tier === 'optional', shape(offSeason));
  ok('six-day off-season week keeps Thursday as the in-week recovery/support break', offThursday?.tier !== 'core', shape(offSeason));
  ok('six-day off-season week includes Saturday', !!offSaturday, shape(offSeason));
  ok('six-day off-season week uses Saturday when Saturday is available', offSaturday?.tier === 'core' || offSaturday?.tier === 'optional', shape(offSeason));
}

section('[6] Score-level posterior-chain priorities');
{
  const pullHinge = [
    fakeSession('Monday', 'Upper body - pull emphasis', 'pull'),
    fakeSession('Tuesday', 'Hip-dominant lower (RDL, hip thrust)', 'lower'),
  ];
  const pullSquat = [
    fakeSession('Monday', 'Upper body - pull emphasis', 'pull'),
    fakeSession('Tuesday', 'Lower body - squat emphasis', 'lower'),
  ];
  const hingePull = [
    fakeSession('Monday', 'Hip-dominant lower (RDL, hip thrust)', 'lower'),
    fakeSession('Tuesday', 'Upper body - pull emphasis', 'pull'),
  ];
  const squatPull = [
    fakeSession('Monday', 'Lower body - squat emphasis', 'lower'),
    fakeSession('Tuesday', 'Upper body - pull emphasis', 'pull'),
  ];
  const upperUpper = [
    fakeSession('Monday', 'Upper body - push emphasis', 'push'),
    fakeSession('Tuesday', 'Upper body - pull emphasis', 'pull'),
  ];
  const upperLower = [
    fakeSession('Monday', 'Upper body - push emphasis', 'push'),
    fakeSession('Tuesday', 'Hip-dominant lower (RDL, hip thrust)', 'lower'),
  ];

  ok('Upper Pull -> Lower Hinge scores worse than Upper Pull -> Lower Squat',
    scoreStrengthSequence(pullHinge) > scoreStrengthSequence(pullSquat));
  ok('Lower Hinge -> Upper Pull scores worse than Lower Squat -> Upper Pull',
    scoreStrengthSequence(hingePull) > scoreStrengthSequence(squatPull));
  ok('Upper -> Upper scores worse than Upper -> Lower',
    scoreStrengthSequence(upperUpper) > scoreStrengthSequence(upperLower));
}

section('[7] DEFAULT_PROGRAM fallback does not encode hinge/pull adjacency');
{
  const workouts = DEFAULT_PROGRAM.microcycles[0].workouts
    .filter(w => w.workoutType === 'Strength')
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const kinds = workouts.map(workoutKind);
  const labelled = workouts.map((w, idx) => `${DAY_NAME[w.dayOfWeek]}:${w.name}:${kinds[idx]}`).join(' | ');
  const badPairs = workouts
    .map((w, idx) => ({ workout: w, kind: kinds[idx] }))
    .filter(({ workout }, idx, arr) => {
      if (idx === 0) return false;
      const prev = arr[idx - 1];
      if (workout.dayOfWeek - prev.workout.dayOfWeek !== 1) return false;
      return (isPullLike(prev.kind) && isHingeLike(kinds[idx]))
        || (isHingeLike(prev.kind) && isPullLike(kinds[idx]));
    });

  ok('default fallback has no consecutive-day hinge/pull adjacency', badPairs.length === 0, labelled);
  ok('default fallback does not place upper pull after lower hinge', !/Friday:Lower Hinge:hinge \| Saturday:Upper Pull:pull/.test(labelled), labelled);
}

console.log(`\n-- Summary --`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);

if (fail > 0) {
  console.log(`\n-- Failures --`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

process.exit(0);
