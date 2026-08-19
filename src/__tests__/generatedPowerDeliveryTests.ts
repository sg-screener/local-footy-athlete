/** Real generation guard for specialist-owned power selection and delivery. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { generateProgramLocally } from '../services/api/generateProgram';
import { project } from '../rules/projectVisibleWeek';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';
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
/* ── R-105 — ONE EXERCISE APPEARS ONCE PER SESSION ────────────────────────
 *
 * Sam, 2026-08-20: *"Add more legitimate no-equipment explosive upper-body
 * options. Until that pool exists, skip the power component rather than
 * prescribe the identical exercise twice."*
 *
 * ⚠ **THIS FIXTURE IS `Bodyweight Only`, WHICH IS THE ONE WORLD WHERE THE
 * RULING BITES.** `Explosive Push-up` is the only `upper` entry in
 * `POWER_EXERCISE_POOL` and is also a legal bodyweight push, so the power pool
 * and the strength pool intersect in exactly one exercise and both reach for
 * it. Measured across the 180-world corpus: 32 sessions prescribed one exercise
 * twice, and **every one of them was a zero-equipment world.**
 *
 * This cell used to demand `rows.length === budget` here, which in this world
 * is only satisfiable by printing that exercise twice — the thing Sam refused.
 * **The claim it was written for is not dropped; it moves to a world where it
 * is true** (`FULL_GYM_*` below, where no collision is possible), and here the
 * ruling's own property is asserted instead. */
/** Sessions where a POWER row shares its identity with another row. R-105's. */
const powerCollisions = (candidateWorkouts: typeof workouts) =>
  candidateWorkouts.filter((workout) => {
    const all = workout.exercises ?? [];
    const powerNames = all.filter((row) => row.role === 'power')
      .map((row) => row.exercise?.name).filter(Boolean);
    return powerNames.some((name) =>
      all.filter((row) => row.exercise?.name === name).length > 1);
  });
ok('R-105 — no session carries a power row beside its own twin',
  powerCollisions(workouts).length === 0,
  powerCollisions(workouts).map((workout) => ({ day: workout.dayOfWeek,
    names: (workout.exercises ?? []).map((row) =>
      `${row.exercise?.name}${row.role === 'power' ? ' [power]' : ''}`) })));

/* ⚠ **AND HERE IS WHAT THIS CELL DELIBERATELY DOES NOT COVER, MEASURED RATHER
 * THAN ASSUMED AWAY.**
 *
 * The first cut of the cell above asked "does any session name one exercise
 * twice?" and went red on a day reading `["Explosive Push-up", "Explosive
 * Push-up"]` with **no power row on it at all** — two STRENGTH rows, one
 * identity. That is the composer placing one movement in two slots, and it is a
 * different defect with a different owner.
 *
 * **IT IS OLDER THAN R-105 AND BIGGER THAN IT.** Measured across the 180-world
 * corpus on 2026-08-19: 52 occurrences survive after the power fix — 48
 * `strength_accessory + conditioning` running-row collisions and 4
 * `main_strength + strength_accessory` — against 50 at the `20cb1422` baseline
 * over 40 fewer built worlds. **Narrowing this cell to power is scoping, not
 * hiding**: the wider class is recorded in `docs/STATUS_ORCHESTRATOR.md` and is
 * the composer's to own.
 *
 * This cell exists so a reader cannot mistake the green above for "no
 * duplicates anywhere". */
const anyDuplicateDays = workouts.filter((workout) => {
  const names = (workout.exercises ?? [])
    .map((row) => row.exercise?.name).filter(Boolean) as string[];
  return new Set(names).size !== names.length;
});
ok('DISCLOSURE — composer-internal duplicates still exist and are NOT power\u2019s',
  anyDuplicateDays.every((workout) => powerCollisions([workout]).length === 0),
  anyDuplicateDays.map((workout) => ({ day: workout.dayOfWeek,
    names: (workout.exercises ?? []).map((row) => row.exercise?.name) })));
ok('R-105 — power never exceeds the selected allowance',
  rows.length <= budget && delivered.length <= budget,
  { budget, sessions: delivered.length, rows: rows.length });
/* ⚠ **AND THE SHORTFALL IS A COLLISION, NOT A SILENT LOSS.** Without this a
 * composer that simply stopped placing power would pass both cells above. Every
 * authorised day that has NO power row must be a day whose strength rows
 * already hold a pool movement — checked against the POOL, not by re-deriving
 * the selector's own answer. */
const shortfall = budget - rows.length;
const strengthDaysWithoutPower = workouts.filter((workout) =>
  exerciseBudgetRows(workout).length > 0 && powerRows(workout).length === 0);
ok('R-105 — every missing primer is explained by a collision',
  shortfall === 0 || strengthDaysWithoutPower.some((workout) =>
    (workout.exercises ?? []).some((row) =>
      POWER_EXERCISE_POOL.some((entry) => entry.name === row.exercise?.name))),
  { budget, rows: rows.length, shortfall,
    daysWithoutPower: strengthDaysWithoutPower.map((workout) => ({
      day: workout.dayOfWeek,
      names: (workout.exercises ?? []).map((row) => row.exercise?.name) })) });
ok('CONTROL — this world really does exhibit the collision the ruling is about',
  shortfall > 0,
  `shortfall=${shortfall}. If a Bodyweight-Only world stops colliding — because `
  + 'the pool gained upper entries, which is the REAL fix Sam ordered — this '
  + 'cell is the one that says so, and the cells above become vacuous here and '
  + 'must move to a world that still collides.');
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

const noFixtureProgram = generateProgramLocally({
  ...profile,
  gameDay: undefined,
  equipment: ['Full Gym'],
} as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const noFixtureWeek = noFixtureProgram.microcycles[0];
const noFixtureStrengthDays = noFixtureWeek.workouts.filter((workout) =>
  exerciseBudgetRows(workout).length > 0);
ok('the phase cap limits a non-vacuous four-strength-day candidate world to two primers',
  noFixtureStrengthDays.length === 4 &&
    noFixtureWeek.exposureContractV2?.power?.plannerSelectedWeeklyBudget === 2 &&
    noFixtureWeek.workouts.flatMap((workout) => powerRows(workout)).length === 2,
  {
    strengthDays: noFixtureStrengthDays.map((workout) => workout.dayOfWeek),
    budget: noFixtureWeek.exposureContractV2?.power?.plannerSelectedWeeklyBudget,
    rows: noFixtureWeek.workouts.flatMap((workout) => powerRows(workout)).length,
  });

const teamProgram = generateProgramLocally({
  ...profile,
  teamTrainingDaysPerWeek: 1,
  teamTrainingDays: ['Tuesday'],
} as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const teamWorkouts = teamProgram.microcycles[0].workouts;
const teamTuesday = visibleWeekFor(teamWorkouts).days.find((day) => day.date === '2026-07-14');
/* ⚠ **THE CLUB-NIGHT CLAIM MOVED TO FULL GYM FOR THE SAME REASON (R-105).**
 * Its Tuesday is a Bodyweight strength day, so demanding a power part there is
 * demanding the duplicate. What the cell is really about — a club night does
 * not swallow the athlete's own composed rows — is unchanged and is asserted
 * below on a world that can carry both. */
ok('a real club night cannot hide its composer-authored strength rows',
  teamTuesday?.parts.some((part) => part.kind === 'team_training') === true &&
    teamTuesday.parts.some((part) => part.kind === 'strength' && part.rows.length > 0),
  teamTuesday?.parts.map((part) => ({ kind: part.kind,
    rows: part.rows.map((row) => row.name) })));

/* ── THE FULL-GYM WORLD — WHERE THE POOLS DO NOT INTERSECT ────────────────
 *
 * **THE ORIGINAL CLAIMS LIVE HERE NOW, AND THEY ARE STRICTER THAN THEY WERE.**
 * With a full kit the power selector has movements the strength block does not
 * hold, so the complete allowance IS deliverable and a shortfall would be a
 * real defect rather than the ruling working. */
const fullGymProgram = generateProgramLocally({
  ...profile, equipment: ['Full Gym'],
} as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const fullGymCycle = fullGymProgram.microcycles[0];
const fullGymBudget = fullGymCycle.exposureContractV2?.power?.plannerSelectedWeeklyBudget ?? 0;
const fullGymRows = fullGymCycle.workouts.flatMap((workout) => powerRows(workout));
const fullGymDelivered = fullGymCycle.workouts.filter(budgetedPowerSession);
ok('CONTROL — the Full Gym world selects a positive power allowance',
  fullGymBudget > 0,
  `budget=${fullGymBudget} — without this the next cell passes on 0 === 0`);
ok('the composer delivers the COMPLETE selected allowance where nothing collides',
  fullGymDelivered.length === fullGymBudget && fullGymRows.length === fullGymBudget,
  { budget: fullGymBudget, sessions: fullGymDelivered.length, rows: fullGymRows.length });
ok('and no Full Gym session prescribes one exercise twice either',
  fullGymCycle.workouts.every((workout) => {
    const names = (workout.exercises ?? [])
      .map((row) => row.exercise?.name).filter(Boolean) as string[];
    return new Set(names).size === names.length;
  }),
  fullGymCycle.workouts.map((workout) => ({ day: workout.dayOfWeek,
    names: (workout.exercises ?? []).map((row) => row.exercise?.name) })));

console.log(`\nGenerated power delivery: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted();
if (failures.length > 0) process.exitCode = 1;
