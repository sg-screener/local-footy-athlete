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

section('1. Tue/Thu team + Saturday game makes Wednesday recovery-biased');
const plan = buildCoachingPlan(tueThuSatInputs);
const wedPlan = plan.weeklyPlan.find((s) => s.dayOfWeek === 'Wednesday');

assert(!!wedPlan, 'Wednesday allocation exists');
assert(wedPlan?.tier === 'optional', 'Wednesday remains optional');
assert(wedPlan?.conditioningCategory === 'aerobic_base', 'Wednesday keeps aerobic_base intent');
assert(wedPlan?.conditioningVariant === 'reduced', 'Wednesday uses reduced aerobic dose');
assert(wedPlan?.ergModality === 'row', 'Wednesday is explicitly off-feet row by default');
assert(wedPlan?.isHardExposure === false, 'Wednesday is not a hard exposure');
assert(/Easy Aerobic Flush/i.test(wedPlan?.focus ?? ''), 'focus names recovery-biased flush');
assert(/20[–-]30min/i.test(wedPlan?.focus ?? ''), 'focus caps dose at 20-30min');
assert(/3[–-]4\/10/i.test(wedPlan?.focus ?? ''), 'focus uses 3-4/10 intensity');
assert(/Skip if legs feel heavy|Thursday quality/i.test(wedPlan?.focus ?? ''), 'focus includes skip guidance');
assert(!/40min|5[–-]6\/10/i.test(wedPlan?.focus ?? ''), 'focus does not prescribe 40min at 5-6/10');

section('2. Builder renders the reduced aerobic flush as the visible workout');
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
  wedPlan!,
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
assert(/Easy Aerobic Flush/i.test(wedWorkout?.name ?? ''), 'visible workout name is Easy Aerobic Flush');
assert(/Easy Aerobic Flush/i.test(headline), 'headline exercise is Easy Aerobic Flush');
assert(/\b(20|25|30)min\b/i.test(headline), 'headline duration is 20, 25, or 30min');
assert(/Rower|Bike|Assault Bike/i.test(headline), 'headline uses an off-feet modality');
assert(/3-4\/10/i.test(notes), 'notes use 3-4/10 intensity');
assert(/Optional/i.test(notes), 'notes say optional');
assert(/Skip if legs feel heavy/i.test(notes), 'notes include post-team skip guidance');
assert(/Thursday training quality/i.test(notes), 'notes protect Thursday quality');
assert(!/40min|5-6\/10/i.test(`${headline}\n${notes}`), 'builder does not emit default 40min 5-6/10 row');

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('All inSeasonMidweekRow tests passed.');
