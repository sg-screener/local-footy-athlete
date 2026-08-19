/** Real generation guard for specialist-owned power selection and delivery. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { generateProgramLocally } from '../services/api/generateProgram';
import { project } from '../rules/projectVisibleWeek';
import {
  budgetedPowerSession,
  exerciseBudgetRows,
  powerRows,
} from '../rules/sessionRowCounting';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}: ${JSON.stringify(detail)}`);
}

const profile = {
  ageRange: '26-30', experienceLevel: 'Intermediate',
  trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
  equipment: ['Bodyweight Only'], recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average', seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0, teamTrainingDays: [], gameDay: 'Saturday',
};

const program = generateProgramLocally(profile as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const microcycle = program.microcycles[0];
const workouts = microcycle.workouts;
const contract = microcycle.exposureContractV2;
const budget = contract?.power?.plannerSelectedWeeklyBudget ?? 0;
const delivered = workouts.filter(budgetedPowerSession);
const rows = workouts.flatMap((workout) => powerRows(workout));
const datesByDay = new Map([
  [1, '2026-07-13'], [2, '2026-07-14'], [3, '2026-07-15'], [4, '2026-07-16'],
  [5, '2026-07-17'], [6, '2026-07-18'], [0, '2026-07-19'],
]);
function visibleWeekFor(candidateWorkouts: typeof workouts) {
  return project({
    weekStart: '2026-07-13',
    week: [...datesByDay].map(([dayOfWeek, date]) => ({
      date,
      dayOfWeek,
      short: date,
      isToday: false,
      workout: candidateWorkouts.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null,
      source: 'template',
      indicator: 'core',
    })) as never,
  });
}
const visible = visibleWeekFor(workouts);
const visiblePowerParts = visible.days.flatMap((day) =>
  day.parts.filter((part) => part.kind === 'power'));

console.log('\nGenerated composer power delivery\n');
ok('the eligible power specialist stamps a positive phase-capped allowance',
  contract?.power?.eligible === true && budget === 2,
  { eligible: contract?.power?.eligible, budget,
    preferred: contract?.power?.preferredWeeklyRange });
ok('the composer delivers the complete selected allowance',
  delivered.length === budget && rows.length === budget,
  { budget, sessions: delivered.length, rows: rows.length });
ok('power rides real strength content and never creates a standalone day',
  delivered.every((workout) => exerciseBudgetRows(workout).length > 0),
  delivered.map((workout) => ({ day: workout.dayOfWeek,
    rows: workout.exercises.map((row) => ({
      name: row.exercise?.name,
      role: row.role,
      pattern: row.pattern,
      category: row.category,
    })) })));
ok('the selected primers remain outside Game, G-1 and G+1',
  delivered.every((workout) => ![0, 5, 6].includes(workout.dayOfWeek)),
  delivered.map((workout) => workout.dayOfWeek));
ok('the athlete-visible projection prints every delivered power exercise',
  visiblePowerParts.length === rows.length &&
    visiblePowerParts.every((part) => part.rows.length === 1),
  visiblePowerParts.map((part) => ({ headline: part.headline,
    rows: part.rows.map((row) => row.name) })));

const teamProgram = generateProgramLocally({
  ...profile,
  teamTrainingDaysPerWeek: 1,
  teamTrainingDays: ['Tuesday'],
} as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const teamWorkouts = teamProgram.microcycles[0].workouts;
const teamTuesday = visibleWeekFor(teamWorkouts).days.find((day) => day.date === '2026-07-14');
ok('a real club night cannot hide its composer-authored power and strength rows',
  teamTuesday?.parts.some((part) => part.kind === 'team_training') === true &&
    teamTuesday.parts.some((part) => part.kind === 'power' && part.rows.length === 1) &&
    teamTuesday.parts.some((part) => part.kind === 'strength' && part.rows.length > 0),
  teamTuesday?.parts.map((part) => ({ kind: part.kind,
    rows: part.rows.map((row) => row.name) })));

console.log(`\nGenerated power delivery: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted();
if (failures.length > 0) process.exitCode = 1;
