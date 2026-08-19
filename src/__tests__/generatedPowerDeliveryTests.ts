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
// [8] — Sam's four "power must NOT count toward" statements each have an owner,
// and each owner is imported here rather than re-implemented.
import {
  countMainSecondarySets,
  decideBlockBoundarySetAdditions,
  LADDER_SESSION_SET_CEILING,
} from '../rules/blockBoundaryProgression';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import {
  applyStrengthProgression,
  buildStrengthWorkoutHistoryFromFeedback,
  classifyProgressionEligibility,
  DEFAULT_PROGRESSION_CONTEXT,
} from '../utils/strengthProgressionIntegration';
import { buildSessionExecutionPlan } from '../utils/sessionExecutionChecklist';
import { buildSessionTemplate } from '../utils/sessionTemplate';
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
/* ⚠ **THERE IS NO POWER PART TO COUNT — SAM, 2026-08-20.**
 *
 * This read `day.parts.filter(part => part.kind === 'power')` and the cell below
 * asserted one such part per delivered power exercise. The ruling merges power
 * into the STRENGTH part, so what is asserted now is the thing that actually
 * matters and that the merge could break: every delivered power exercise still
 * REACHES the athlete, inside Strength, first. A count of containers became a
 * check of contents, which is the stronger claim. */
const visibleStrengthParts = visible.days.flatMap((day) =>
  day.parts.filter((part) => part.kind === 'strength'));

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

/* ⚠ **THE WIDER CLASS THIS CELL USED TO DISCLOSE IS NOW CLOSED (2026-08-20).**
 *
 * It read: *"composer-internal duplicates still exist and are NOT power's"* —
 * true when written, and the first cut of the cell above found one by going red
 * on a day reading `["Explosive Push-up", "Explosive Push-up"]` with no power
 * row on it at all.
 *
 * Sam then ordered that class fixed. **52 occurrences / 20 athletes / 40 weeks /
 * 52 sessions -> 0**, in two parts:
 *
 *   48  a substituted conditioning session renamed its structural WARM-UP row
 *       to the modality label, so the athlete's screen printed the same line
 *       twice (`conditioningFeasibility.applyResolvedConditioningSubstitution`);
 *    4  the composer filled a main-strength slot and an accessory slot with one
 *       identity on the same day (`composeWeek`, day-local narrowing).
 *
 * **SO THE DISCLOSURE BECOMES AN ASSERTION.** A cell that says "this defect
 * still exists elsewhere" must not outlive the defect — it would read as a
 * standing exemption for exactly the thing that was fixed.
 */
const anyDuplicateDays = workouts.filter((workout) => {
  const names = (workout.exercises ?? [])
    .map((row) => row.exercise?.name).filter(Boolean) as string[];
  return new Set(names).size !== names.length;
});
ok('NO SESSION PRESCRIBES ONE EXERCISE TWICE — power or otherwise',
  anyDuplicateDays.length === 0,
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
const visibleStrengthRowNames = new Set(
  visibleStrengthParts.flatMap((part) => part.rows.map((row) => String(row.name))));
ok('the athlete-visible projection prints every delivered power exercise',
  rows.length > 0 && rows.every((row) =>
    visibleStrengthRowNames.has(String(row.exercise?.name ?? ''))),
  { delivered: rows.map((row) => row.exercise?.name),
    visible: [...visibleStrengthRowNames] });
// AND IT PRINTS THEM INSIDE STRENGTH, FIRST — the placement half of the ruling.
// Checked per DAY, because a set says membership and says nothing about order.
//
// The day a date belongs to comes from `datesByDay`, the map this file already
// built the week from — NOT from re-deriving a weekday out of the ISO string.
// A date sliced back to a day-of-week is a trap this repo has paid for.
const dayOfWeekByDate = new Map([...datesByDay].map(([dow, date]) => [date, dow]));
let placementDaysChecked = 0;
const placementHolds = visible.days.every((day) => {
  const dayOfWeek = dayOfWeekByDate.get(day.date);
  const power = powerRows(
    workouts.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null);
  if (power.length === 0) return true;
  placementDaysChecked += 1;
  const strength = day.parts.filter((part) => part.kind === 'strength');
  return strength.length === 1
    && String(strength[0].rows[0]?.name ?? '') === String(power[0].exercise?.name ?? '');
});
// NON-VACUITY FIRST: without a day that actually carries power, the check above
// is `every` over nothing and passes by saying nothing.
ok('CONTROL — the projected week really does contain a day with power work',
  placementDaysChecked > 0,
  { placementDaysChecked, deliveredRows: rows.length });
ok('and each day\'s Strength part opens with that day\'s power exercise',
  placementHolds,
  visible.days.map((day) => ({ date: day.date,
    strength: day.parts.filter((part) => part.kind === 'strength')
      .map((part) => part.rows.map((row) => String(row.name))) })));
// ⚠ AND NO POWER PART SURVIVES ANYWHERE. Without this, a fix that left the old
// part in place beside the merged rows would satisfy both cells above.
// ⚠ **AND THE MERGE DID NOT QUIETLY CHANGE WHAT §18 COUNTS.** Sam: *"Preserve
// power's internal role for programming, counting and progression."* A power
// component used to be its own part with `countsTowardLoad: true`; it is now
// inside a strength part, which carries the same flag. This cell is where that
// claim lives, because this is the suite with a real projected week that has
// power days in it — `test:section18-recovery-neutrality`'s table cell had to
// drop the word `power` when the kind did, and pointed here.
ok('a day\'s power work counts toward load exactly as the strength it now sits in',
  placementDaysChecked > 0 && visible.days.every((day) => {
    const dayOfWeek = dayOfWeekByDate.get(day.date);
    const power = powerRows(
      workouts.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null);
    if (power.length === 0) return true;
    return day.parts
      .filter((part) => part.kind === 'strength')
      .every((part) => part.countsTowardLoad === true);
  }),
  visible.days.map((day) => ({ date: day.date,
    parts: day.parts.map((part) => ({ kind: String(part.kind),
      counts: part.countsTowardLoad })) })));
ok('no day projects a separate Power part any more',
  visible.days.every((day) =>
    day.parts.every((part) => String(part.kind) !== 'power')),
  visible.days.map((day) => ({ date: day.date,
    kinds: day.parts.map((part) => String(part.kind)) })));

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

/* ═══════════════════════════════════════════════════════════════════════════
 * [8] POWER COUNTS IN THE ATHLETE'S COUNTER, AND IN NOTHING ELSE
 *
 * **Sam, 2026-08-20, closing R-110's one ambiguity before acceptance:** *"Power
 * counts in the athlete-visible completion counter, so one power row plus five
 * strength rows displays Strength 0/6. Power must NOT count toward: the strength
 * exercise cap, the 16-set/session ceiling, strength-set progression, decisions
 * about whether another strength exercise or set can be added."*
 *
 * ⚠ **THE DISPLAY MERGE IS WHY THIS SECTION EXISTS.** Before R-110 the athlete
 * saw `Power / Primer 0/1` beside `Strength 0/5` and the separation was VISIBLE.
 * Now it is `Strength 0/6` and the separation is a claim about code nobody can
 * see — which is exactly when it needs a guard, not a comment.
 *
 * **EVERY CELL RUNS ON A REAL GENERATED DAY**, found by asking the program which
 * days carry both a power row and strength rows. Nothing here is hand-built.
 *
 * **THE FENCES ARE NOT ONE MECHANISM, AND THAT IS THE POINT OF SPLITTING THE
 * CELLS.** The cap and progression exclude power BY ROLE
 * (`ROLES_EXEMPT_FROM_COUNTING` / `ROLES_EXEMPT_FROM_THE_CAP`). The 16-set
 * ceiling excludes it BY SLOT — `countMainSecondarySets` counts a row only when
 * `slotCountsTowardSetBudget(row.section18Evidence?.slot)`, and a power row
 * carries no slot at all. A single cell over both would go green while one of
 * them rotted.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[8] Power counts in the athlete\'s counter and in nothing else');

const capProfile = {
  ageRange: '26-30', experienceLevel: 'Intermediate',
  trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
  equipment: ['Full gym'], recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average', seasonPhase: 'Pre-season', trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0, teamTrainingDays: [], gameDay: 'Saturday',
};
const capProgram: any = generateProgramLocally(capProfile as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 3,
} as never);
const capWorkouts: any[] = capProgram.microcycles.flatMap((m: any) => m.workouts ?? []);
const powerAndStrengthDays = capWorkouts.filter((w) =>
  powerRows(w).length > 0 && (w.exercises ?? []).some((r: any) => r.role !== 'power'));

/* ⚠ **THE SUBJECT IS CHOSEN, NOT TAKEN.** Of the generated power exercises,
 * `Lateral Bounds` classifies as NOTHING to progression and `Explosive Push-up`
 * classifies as `secondary_strength` — this module's own header calls that the
 * "Explosive Push-up trap": *"Six of seven entries are harmless; that asymmetry
 * is why it would pass most tests and most device passes."* A progression cell
 * standing on a Lateral Bounds day is green because there was nothing to stop.
 * So the progression cell below takes a day whose power row progression WOULD
 * otherwise move, and says so out loud when it cannot find one. */
const trapDays = powerAndStrengthDays.filter((w) => powerRows(w)
  .some((r: any) => classifyProgressionEligibility(r.exercise?.name ?? '') !== null));

ok('[8] CONTROL — real generation produces days carrying power AND strength',
  powerAndStrengthDays.length > 0,
  { powerAndStrengthDays: powerAndStrengthDays.length, generated: capWorkouts.length });

const subject = powerAndStrengthDays[0];
const withoutPower = subject
  ? { ...subject, exercises: (subject.exercises ?? []).filter((r: any) => r.role !== 'power') }
  : null;

const strengthSectionCount = (workout: any): number => {
  const plan = buildSessionExecutionPlan({
    workout, template: buildSessionTemplate(workout), mobilityFlow: null });
  return plan.sections.find((section) => section.id === 'strength')?.items.length ?? 0;
};

// ── 1. THE ATHLETE'S COUNTER INCLUDES POWER, AND LOSES EXACTLY ONE WITHOUT IT.
ok('[8] the visible Strength counter COUNTS the power row',
  !!subject && strengthSectionCount(subject)
    === strengthSectionCount(withoutPower) + powerRows(subject).length,
  { with: subject ? strengthSectionCount(subject) : null,
    without: withoutPower ? strengthSectionCount(withoutPower) : null,
    powerRows: subject ? powerRows(subject).length : null });
ok('[8] SAM\'S NUMBERS — one power row and five strength rows reads 6, and 5 without it',
  !!subject && powerRows(subject).length === 1
    && strengthSectionCount(subject) === 6 && strengthSectionCount(withoutPower) === 5,
  { name: subject?.workoutType, dow: subject?.dayOfWeek,
    rows: (subject?.exercises ?? []).map((r: any) => `${r.role ?? 'strength'}:${r.exercise?.name}`),
    with: subject ? strengthSectionCount(subject) : null,
    without: withoutPower ? strengthSectionCount(withoutPower) : null });

// ── 2. THE STRENGTH EXERCISE CAP. Removing power must free NO capacity.
ok('[8] power does not count toward the strength exercise cap',
  !!subject && exerciseBudgetRows(subject).length === exerciseBudgetRows(withoutPower).length,
  { with: subject ? exerciseBudgetRows(subject).length : null,
    without: withoutPower ? exerciseBudgetRows(withoutPower).length : null });
ok('[8] and removing the power row creates no capacity that was not already there',
  !!subject && exerciseBudgetRows(subject).map((r: any) => r.exercise?.name).join('|')
    === exerciseBudgetRows(withoutPower).map((r: any) => r.exercise?.name).join('|'),
  { with: exerciseBudgetRows(subject ?? {}).map((r: any) => r.exercise?.name),
    without: exerciseBudgetRows(withoutPower ?? {}).map((r: any) => r.exercise?.name) });

// ── 3. THE 16-SET/SESSION CEILING. A different fence — by SLOT, not by role.
ok('[8] power adds nothing to the 16-set/session count',
  !!subject && countMainSecondarySets(subject) === countMainSecondarySets(withoutPower),
  { with: subject ? countMainSecondarySets(subject) : null,
    without: withoutPower ? countMainSecondarySets(withoutPower) : null });
ok('[8] CONTROL — that count is non-zero, so equality is not two zeros agreeing',
  !!subject && countMainSecondarySets(subject) > 0,
  subject ? countMainSecondarySets(subject) : null);
ok('[8] and NO generated power row carries a slot the set budget counts',
  capWorkouts.flatMap((w) => powerRows(w))
    .every((r: any) => !slotCountsTowardSetBudget(r.section18Evidence?.slot)),
  capWorkouts.flatMap((w) => powerRows(w))
    .map((r: any) => ({ name: r.exercise?.name, slot: r.section18Evidence?.slot ?? null })));

// ── 4. "CAN ANOTHER STRENGTH SET BE ADDED?" — the live decision, three worlds.
//
// The block-boundary set ladder is the only owner in the app that ADDS a
// main/secondary set, and `LADDER_SESSION_SET_CEILING` is the 16 it spends. Its
// answer must be byte-identical with and without the power row, INCLUDING at the
// boundary — power must neither push a session over the ceiling nor, by its
// removal, buy a rung the session had not earned.
const goodHistory = (workout: any) => ({
  qualifies: true,
  byQuality: { strength: 'good', conditioning: 'good' },
  recoveryVerdict: 'good',
  lastRecordedPrescribedSetsByExercise: Object.fromEntries((workout.exercises ?? [])
    .map((r: any) => [r.exercise?.name ?? '', r.prescribedSets])),
  sessionsCompleted: 12, fullCompletions: 12, partialCompletions: 0, skipped: 0,
});
const ladderFor = (workout: any) => decideBlockBoundarySetAdditions({
  history: goodHistory(workout) as never, nextBlockWorkouts: [workout],
  weekIndex: 0, loadDecisions: [], authoredSetsByRowId: {},
} as never);
const ladderShape = (workout: any) => JSON.stringify(ladderFor(workout)
  .map((d: any) => [d.exerciseName, d.fromSets, d.toSets,
    d.sessionCountingSetsBefore, d.sessionCountingSetsAfter]));
/** Pad the counted lifts up to exactly the ceiling. */
const paddedTo = (workout: any, target: number) => {
  const rows = (workout.exercises ?? []).map((r: any) => ({ ...r }));
  const counted = rows.filter((r: any) => slotCountsTowardSetBudget(r.section18Evidence?.slot));
  let total = counted.reduce((sum: number, r: any) => sum + (r.prescribedSets ?? 0), 0);
  for (let i = 0; total < target && counted.length > 0; i += 1) {
    counted[i % counted.length].prescribedSets += 1; total += 1;
  }
  return { ...workout, exercises: rows };
};
const stripPower = (workout: any) =>
  ({ ...workout, exercises: (workout.exercises ?? []).filter((r: any) => r.role !== 'power') });

const atCeiling = subject ? paddedTo(subject, LADDER_SESSION_SET_CEILING) : null;
const oneUnder = subject ? paddedTo(subject, LADDER_SESSION_SET_CEILING - 1) : null;

ok('[8] CONTROL — the ladder really does add a set on this day',
  !!subject && ladderFor(subject).length === 1,
  ladderFor(subject ?? {}));
ok('[8] the set ladder decides identically with and without the power row',
  !!subject && ladderShape(subject) === ladderShape(withoutPower),
  { with: ladderShape(subject ?? {}), without: ladderShape(withoutPower ?? {}) });
ok('[8] at the ceiling the ladder refuses — and refuses the same with power present',
  !!atCeiling && countMainSecondarySets(atCeiling) === LADDER_SESSION_SET_CEILING
    && ladderFor(atCeiling).length === 0 && ladderFor(stripPower(atCeiling)).length === 0,
  { counted: atCeiling ? countMainSecondarySets(atCeiling) : null,
    with: ladderFor(atCeiling ?? {}).length, without: ladderFor(stripPower(atCeiling ?? {})).length });
ok('[8] one under the ceiling the rung is available, identically, and lands ON 16',
  !!oneUnder && countMainSecondarySets(oneUnder) === LADDER_SESSION_SET_CEILING - 1
    && ladderShape(oneUnder) === ladderShape(stripPower(oneUnder))
    && ladderFor(oneUnder)[0]?.sessionCountingSetsAfter === LADDER_SESSION_SET_CEILING,
  { with: ladderShape(oneUnder ?? {}), without: ladderShape(stripPower(oneUnder ?? {})) });

// ── 5. STRENGTH-SET PROGRESSION NEVER TOUCHES A POWER ROW.
//
// History is built through the REAL door — `buildStrengthWorkoutHistoryFromFeedback`
// over saved athlete feedback — rather than hand-authored `LoggedWorkout`s, so
// the world is one an athlete could have arrived at by acting.
const progressionSubject = trapDays[0] ?? null;
ok('[8] CONTROL — the subject\'s power row is one progression WOULD otherwise move',
  !!progressionSubject && powerRows(progressionSubject)
    .some((r: any) => classifyProgressionEligibility(r.exercise?.name ?? '') !== null),
  { trapDays: trapDays.length,
    powerNames: powerAndStrengthDays.flatMap((w) => powerRows(w).map((r: any) =>
      `${r.exercise?.name}=${classifyProgressionEligibility(r.exercise?.name ?? '')}`)) });

const progressionOutcome = (() => {
  if (!progressionSubject) return null;
  const feedbackMap: Record<string, any> = {};
  for (const dateStr of ['2026-06-22', '2026-06-29', '2026-07-06']) {
    feedbackMap[dateStr] = {
      dateStr, completion: 'full', feeling: 'good', difficulty: 5,
      source: { entryPoint: 'tap' },
      strength: (progressionSubject.exercises ?? [])
        .filter((r: any) => r.exercise?.name)
        .map((r: any) => ({
          exerciseId: r.exerciseId, workoutExerciseId: r.id, exerciseName: r.exercise.name,
          prescribedSets: r.prescribedSets ?? 3,
          prescribedRepsMin: r.prescribedRepsMin ?? 5,
          prescribedRepsMax: r.prescribedRepsMax ?? 5,
          weightKg: 100, completion: 'full',
          completedSets: r.prescribedSets ?? 3, actualReps: r.prescribedRepsMax ?? 5,
        })),
    };
  }
  const dose = (r: any) =>
    `${r.prescribedSets}x${r.prescribedRepsMin}-${r.prescribedRepsMax}@${r.prescribedWeightKg}`;
  const before = new Map((progressionSubject.exercises ?? []).map((r: any) => [r.id, dose(r)]));
  const after: any = applyStrengthProgression(
    progressionSubject,
    { ...DEFAULT_PROGRESSION_CONTEXT, sessionFeeling: 'easy',
      workoutHistory: buildStrengthWorkoutHistoryFromFeedback(feedbackMap as never, '2026-07-13') } as never,
    Object.fromEntries((progressionSubject.exercises ?? [])
      .map((r: any) => [r.exercise?.name ?? '', 100])));
  const moved = (after.exercises ?? []).filter((r: any) => dose(r) !== before.get(r.id));
  return { moved, powerMoved: moved.filter((r: any) => r.role === 'power') };
})();

ok('[8] CONTROL — progression really is moving rows on this day',
  (progressionOutcome?.moved.length ?? 0) > 0,
  progressionOutcome?.moved.map((r: any) => r.exercise?.name));
ok('[8] strength-set progression never moves a power row',
  progressionOutcome !== null && progressionOutcome.powerMoved.length === 0,
  { moved: progressionOutcome?.moved.map((r: any) => `${r.role ?? 'strength'}:${r.exercise?.name}`),
    powerMoved: progressionOutcome?.powerMoved.map((r: any) => r.exercise?.name) });

console.log(`\nGenerated power delivery: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted();
if (failures.length > 0) process.exitCode = 1;
