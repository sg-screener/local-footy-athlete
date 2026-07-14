/**
 * In-season mid-week row programming tests.
 *
 * Run: npm run test:in-season-midweek-row
 */

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { buildCoachingPlan, type CoachingInputs, type SessionAllocation } from '../utils/coachingEngine';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

const tueThuSatInputs: CoachingInputs = {
  seasonPhase: 'In-season',
  availableDays: 5,
  selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingIntensity: 'Moderate',
  sprintExposure: '2+ times per week',
  conditioningLevel: 'Elite',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  goals: ['Stay injury-free'],
  hasGame: true,
  gameDay: 'Saturday',
};

section('1. Tue/Thu team + Saturday game does not invent compulsory conditioning');
const plan = buildCoachingPlan(tueThuSatInputs);
const wedPlan = plan.weeklyPlan.find((s) => s.dayOfWeek === 'Wednesday');
const appCore = plan.weeklyPlan.filter((session) =>
  !session.isTeamDay &&
  (session.section18ConditioningRole === 'required_core' ||
    session.section18ConditioningRole === 'planner_selected_core'));

assert(!!wedPlan, 'Wednesday allocation exists');
assert(plan.weeklyExposureContract?.conditioning.targetCount === 3, 'core conditioning target remains three');
assert(plan.weeklyExposureContract?.conditioning.creditedTeamTrainingCount === 2, 'both genuine team sessions receive core credit');
assert(plan.weeklyExposureContract?.conditioning.creditedGameOrPracticeMatchCount === 1, 'game receives one core credit');
assert(plan.weeklyExposureContract?.conditioning.additionalRequiredCount === 0, 'the planner selects no compulsory app conditioning');
assert(appCore.length === 0, 'no app session is classified as core conditioning');
assert(!wedPlan?.conditioningCategory, 'Wednesday does not gain an unexplained conditioning prescription');
assert(!wedPlan?.section18ConditioningRole, 'Wednesday has no false core-or-optional conditioning ownership');
assert(wedPlan?.isHardExposure === false, 'Wednesday is not a hard exposure');
assert(wedPlan?.tier === 'optional' || wedPlan?.tier === 'recovery', 'Wednesday remains low-priority capacity');

section('2. Builder preserves an explicitly selected optional flush');
const optionalFlush: SessionAllocation = {
  tier: 'optional',
  focus: 'Easy Aerobic Flush - 20-30min easy row, 3-4/10.',
  dayOfWeek: 'Wednesday',
  isHardExposure: false,
  conditioningCategory: 'aerobic_base',
  conditioningFlavour: 'aerobic',
  conditioningVariant: 'reduced',
  conditioningOffFeet: true,
  ergModality: 'row',
  section18ConditioningRole: 'optional_flush',
};
const coachWorkouts = [
  {
    dayOfWeek: 2,
    name: 'Team Training',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [] as Array<{ name: string; sets: number; repsMin: number; repsMax: number; weight?: number }>,
  },
  {
    dayOfWeek: 3,
    name: 'Conditioning',
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    exercises: [] as Array<{ name: string; sets: number; repsMin: number; repsMax: number; weight?: number }>,
  },
  {
    dayOfWeek: 4,
    name: 'Team Training',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [] as Array<{ name: string; sets: number; repsMin: number; repsMax: number; weight?: number }>,
  },
];

const weeklyPlan: SessionAllocation[] = [
  {
    tier: 'core',
    focus: 'Team Training',
    dayOfWeek: 'Tuesday',
    isHardExposure: true,
    isTeamDay: true,
  },
  optionalFlush,
  {
    tier: 'core',
    focus: 'Team Training',
    dayOfWeek: 'Thursday',
    isHardExposure: true,
    isTeamDay: true,
  },
];

const workouts = buildWorkoutsFromCoach(coachWorkouts, 'mc-midweek-row', weeklyPlan);
const wedWorkout = workouts.find((w) => w.dayOfWeek === 3);
const headline = wedWorkout?.exercises.find((ex) => ex.exercise?.name)?.exercise?.name ?? '';
const notes = wedWorkout?.exercises.map((ex) => ex.notes).filter(Boolean).join('\n') ?? '';

assert(!!wedWorkout, 'Wednesday workout is built');
assert(/^Aerobic Flush$/i.test(wedWorkout?.name ?? ''), 'visible workout name is canonical Aerobic Flush');
assert(/Easy Aerobic Flush/i.test(headline), 'headline exercise is Easy Aerobic Flush');
assert(
  /3 x 8min easy Rower/i.test(headline) ||
    /\b(20|25|30)min\b/i.test(headline),
  'headline uses intervalised row or an allowed continuous bike dose',
);
assert(/Rower|Bike|Assault Bike/i.test(headline), 'headline uses an off-feet modality');
assert(
  !/\b(?:1[1-9]|[2-9]\d)min\b.*\bRower\b/i.test(headline),
  'headline does not prescribe long continuous row',
);
assert(/3-4\/10/i.test(notes), 'notes use 3-4/10 intensity');
assert(/Recovery pace/i.test(notes), 'notes keep one short recovery note');
assert(!/Optional|Skip if legs feel heavy|Thursday training quality/i.test(notes), 'notes avoid verbose skip guidance');
assert(!/40min|5-6\/10/i.test(`${headline}\n${notes}`), 'builder does not emit default 40min 5-6/10 row');

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('All inSeasonMidweekRow tests passed.');
