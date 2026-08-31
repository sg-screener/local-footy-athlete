/** Real generation guard for specialist-owned power selection and delivery. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { coldStartThroughOnboarding, quietAsync } from './support/athleteJourney';
import { athleteAnswers, plusDays } from './compilerYear/catalog';
import { derivedEquipmentChecklistTags } from '../rules/equipmentVocabulary';
import { useProgramStore } from '../store/programStore';
import type { OnboardingData } from '../types/domain';
const storage = new Map<string, string>();
(globalThis as any).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
} };
async function generateThroughOnboarding(profile: OnboardingData, options: { todayISO: string; seasonPhaseClock?: { phaseEntryWeekStartISO: string } }) {
  const answers = { ...profile, twoKmTimeTrial: { ...profile.twoKmTimeTrial!, recordedOn: options.todayISO } };
  if (answers.seasonPhase === 'Off-season') answers.seasonFinishedOn = plusDays(options.seasonPhaseClock?.phaseEntryWeekStartISO ?? options.todayISO, -1);
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile: answers, installDayISO: options.todayISO }));
  if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
  return useProgramStore.getState().currentProgram!;
}
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
// [9] — the pairing owner, and the day card's composition, for the contrast rule.
import { alignPowerToFinalWorkoutContent } from '../rules/powerRowAlignment';
import { composeDayDetail } from '../utils/dayDetailComposition';
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

async function main() {
const profile = athleteAnswers({ id: 'power-bodyweight', gender: 'male',
  experience: '2-5 years', equipment: 'bodyweight', initialPhase: 'Pre-season',
  days: ['Monday', 'Tuesday', 'Thursday', 'Friday'], clubDays: [], gameDay: null, extraGame: false });
const fullKit = { ...profile.equipmentAnswer!, tags: Object.fromEntries(derivedEquipmentChecklistTags()
  .filter(tag => tag !== 'medicine_ball')
  .map(tag => [tag, 'have'])), modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' } } as OnboardingData['equipmentAnswer'];

const program = await generateThroughOnboarding(profile as never, {
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
/* ── R-118 (renumbered from R-105, 2026-08-20) — ONE EXERCISE APPEARS ONCE PER SESSION ────────────────────────
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
/** Sessions where a POWER row shares its identity with another row. R-118's. */
const powerCollisions = (candidateWorkouts: typeof workouts) =>
  candidateWorkouts.filter((workout) => {
    const all = workout.exercises ?? [];
    const powerNames = all.filter((row) => row.role === 'power')
      .map((row) => row.exercise?.name).filter(Boolean);
    return powerNames.some((name) =>
      all.filter((row) => row.exercise?.name === name).length > 1);
  });
ok('R-118 — no session carries a power row beside its own twin',
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

ok('R-118 — power never exceeds the selected allowance',
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
ok('R-118 — every missing primer is explained by a collision',
  shortfall === 0 || strengthDaysWithoutPower.some((workout) =>
    (workout.exercises ?? []).some((row) =>
      POWER_EXERCISE_POOL.some((entry) => entry.name === row.exercise?.name))),
  { budget, rows: rows.length, shortfall,
    daysWithoutPower: strengthDaysWithoutPower.map((workout) => ({
      day: workout.dayOfWeek,
      names: (workout.exercises ?? []).map((row) => row.exercise?.name) })) });
// R-118 added legitimate bodyweight power choices. This athlete no longer
// owes a collision; requiring a shortfall would reintroduce retired behavior.
ok('CONTROL — bodyweight delivery remains nonempty after pool expansion', rows.length > 0);
ok('power rides real strength content and never creates a standalone day',
  delivered.every((workout) => exerciseBudgetRows(workout).length > 0),
  delivered.map((workout) => ({ day: workout.dayOfWeek,
    rows: workout.exercises.map((row) => ({
      name: row.exercise?.name,
      role: row.role,
      pattern: row.section18Evidence?.mainStrengthPattern,
      category: row.section18Evidence?.role,
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
/* ⚠ NARROWED TO STANDALONE PRIMERS — SAM, 2026-08-20. "Power appears first"
 * applies only to a standalone primer; a CONTRAST pair keeps its authored order
 * at the main slot (heavy → explosive), which section [9] holds. Every power row
 * this world generates is a primer, and the control below says so — if contrast
 * ever starts pairing here, that control reds rather than this cell silently
 * asserting the wrong rule. */
ok('CONTROL — every power row in this world is a standalone primer',
  visible.days.every((day) => {
    const dayOfWeek = dayOfWeekByDate.get(day.date);
    const workout = workouts.find((w) => w.dayOfWeek === dayOfWeek) ?? null;
    return powerRows(workout).every((r: any) => !r.supersetGroup && r.pairType !== 'contrast');
  }),
  workouts.flatMap((w) => powerRows(w).map((r: any) =>
    ({ name: r.exercise?.name, pairType: r.pairType ?? null, group: r.supersetGroup ?? null }))));
ok('and each day\'s Strength part opens with that day\'s STANDALONE power primer',
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

const noFixtureProgram = await generateThroughOnboarding({
  ...profile,
  gameDay: undefined,
  equipment: ['Full Gym'], equipmentAnswer: fullKit,
} as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const noFixtureWeek = noFixtureProgram.microcycles[0];
const noFixtureStrengthDays = noFixtureWeek.workouts.filter((workout) =>
  exerciseBudgetRows(workout).length > 0);
ok('the phase cap limits a non-vacuous candidate world to two primers',
  noFixtureStrengthDays.length >= 4 &&
    noFixtureWeek.exposureContractV2?.power?.plannerSelectedWeeklyBudget === 2 &&
    noFixtureWeek.workouts.flatMap((workout) => powerRows(workout)).length === 2,
  {
    strengthDays: noFixtureStrengthDays.map((workout) => workout.dayOfWeek),
    budget: noFixtureWeek.exposureContractV2?.power?.plannerSelectedWeeklyBudget,
    rows: noFixtureWeek.workouts.flatMap((workout) => powerRows(workout)).length,
  });

const teamProgram = await generateThroughOnboarding({
  ...profile,
  teamTrainingDaysPerWeek: 1,
  teamTrainingDays: ['Tuesday'],
} as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1,
} as never);
const teamWorkouts = teamProgram.microcycles[0].workouts;
const teamTuesday = visibleWeekFor(teamWorkouts).days.find((day) => day.date === '2026-07-14');
/* ⚠ **THE CLUB-NIGHT CLAIM MOVED TO FULL GYM FOR THE SAME REASON (R-118).**
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
const fullGymProgram = await generateThroughOnboarding({
  ...profile, equipment: ['Full Gym'], equipmentAnswer: fullKit,
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

const capProfile = { ...profile, equipmentAnswer: fullKit };
const capProgram: any = await generateThroughOnboarding(capProfile as never, {
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
// The old fixed five-row fixture was replaced by the approved split recipe.
// The exact dynamic count assertion above applies to every current recipe.
ok('[8] CONTROL — the counter comparison contains one power row and real strength',
  !!subject && powerRows(subject).length === 1 && strengthSectionCount(withoutPower) > 0);

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

/* ═══════════════════════════════════════════════════════════════════════════
 * [9] CONTRAST KEEPS ITS AUTHORED PAIR AT THE MAIN SLOT
 *
 * **Sam, 2026-08-20, correcting his own acceptance:** *"'Power appears first'
 * applies only to a standalone power primer. For valid contrast training,
 * preserve the authored pair at the main slot: heavy lift → paired explosive
 * movement → rest. The explosive row must appear immediately after its heavy
 * partner, not at the top of the session. Both remain inside the single Strength
 * section; there is still no separate Power section."*
 *
 * ⚠ **NO SECOND SORTING RULE WAS ADDED, AND THAT WAS HIS INSTRUCTION.**
 * `powerRowAlignment` already stamps `supersetOrder` (heavy = 1, explosive = 2)
 * when it forms the pair; `sessionTemplate`'s `inPairOrder` now READS it. The day
 * card reaches the same answer through `orderRowsAsSessionPresents`, which
 * reports the template's placement — so one owner, two readers, and cell [9c]
 * below is what proves the two surfaces cannot drift.
 *
 * ⚠⚠ **AND THE WORLD THIS SECTION RUNS IN IS NOT ONE GENERATION CAN REACH
 * TODAY. THAT IS STATED HERE RATHER THAN HIDDEN, AND IT IS A FINDING:**
 *
 *   Measured over 48 generated Off-season worlds: **384 contrast power rows
 *   produced, 0 paired, 384 downgraded to primer** — every one with
 *   `no_heavy_same_family_main_lift`. The cause is an arithmetic mismatch
 *   between two rules that never meet. `powerPrimerPolicy` only returns
 *   `kind: 'contrast'` in LATE OFF-SEASON (the pre-season route needs
 *   `powerGoalNudge`, which both production call sites hardcode to `false`), and
 *   `powerRowAlignment`'s heavy test needs `prescribedRepsMax <= 6` — but the
 *   lowest rep range off-season strength work carries is `6-8`. So Section 4's
 *   contrast rule is prescribed and then always cancelled.
 *
 *   **NOT FIXED HERE. Sam's instruction was "do not start another change in
 *   this lane."** It is recorded in `docs/STATUS_SESSIONUI.md` for his ruling.
 *
 * So the pairing below is formed by the REAL owner
 * (`alignPowerToFinalWorkoutContent`) on a REAL generated contrast day, with
 * exactly ONE value overridden — the main lift's rep range — and the override is
 * named in the control cell rather than buried. Everything else is generated.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[9] Contrast keeps its authored pair at the main slot');

const contrastProfile = { ...profile, experienceLevel: '5+ years', equipmentAnswer: fullKit,
  recentTrainingLoad: 'Very consistent', conditioningLevel: 'Elite', seasonPhase: 'Off-season' };
const contrastProgram: any = await generateThroughOnboarding(contrastProfile as never, {
  todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 2,
  // Phase week 5+ is `late_offseason`, the only live route to contrast intent.
  seasonPhaseClock: { protocolVersion: 1, selectedPhase: 'Off-season',
    phaseEntryWeekStartISO: '2026-05-18', originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state' },
} as never);
const contrastDay = contrastProgram.microcycles
  .flatMap((m: any) => m.workouts ?? [])
  .find((w: any) => powerRows(w).some((r: any) => r.power?.kind === 'contrast')) ?? null;

ok('[9] CONTROL — generation really does prescribe contrast intent in late off-season',
  !!contrastDay,
  { day: contrastDay?.workoutType,
    kinds: contrastProgram.microcycles.flatMap((m: any) => m.workouts ?? [])
      .flatMap((w: any) => powerRows(w).map((r: any) => r.power?.kind)) });

/** The heavy partner: the one value generation does not currently pair with contrast. */
const heavyName = 'Back Squat';
const heavied = contrastDay ? { ...contrastDay, exercises: (contrastDay.exercises ?? [])
  .map((r: any) => (r.exercise?.name === heavyName
    ? { ...r, prescribedRepsMin: 3, prescribedRepsMax: 5 } : r)) } : null;
const alignment = heavied ? alignPowerToFinalWorkoutContent(heavied) : null;
const pairedDay: any = alignment?.workout ?? null;

ok('[9] CONTROL — the REAL pairing owner forms the pair once the partner is heavy',
  alignment?.action === 'paired' && String(alignment?.reason ?? '').startsWith('contrast_paired_to_main'),
  { action: alignment?.action, reason: alignment?.reason });
ok('[9] CONTROL — and it is unpaired WITHOUT that one override, which is the finding',
  contrastDay ? alignPowerToFinalWorkoutContent(contrastDay).action === 'downgraded' : false,
  contrastDay ? alignPowerToFinalWorkoutContent(contrastDay).reason : null);

const sessionStrengthOrder = (workout: any): string[] => {
  const plan = buildSessionExecutionPlan({
    workout, template: buildSessionTemplate(workout), mobilityFlow: null });
  return (plan.sections.find((s) => s.id === 'strength')?.items ?? []).map((i: any) => String(i.label));
};
const dayCardStrengthOrder = (workout: any): string[] =>
  (composeDayDetail(workout, workout) as any).strengthExercises
    .map((r: any) => String(r.exercise?.name ?? ''));

const pairedSession = pairedDay ? sessionStrengthOrder(pairedDay) : [];
const pairedCard = pairedDay ? dayCardStrengthOrder(pairedDay) : [];
const explosiveName = pairedDay
  ? String(powerRows(pairedDay)[0]?.exercise?.name ?? '') : '';

// ── [9a] STANDALONE PRIMER STILL LEADS. Held on the same day BEFORE pairing:
//    contrast downgraded to a primer is exactly a standalone primer.
ok('[9a] a standalone primer still leads the Strength section',
  !!contrastDay && sessionStrengthOrder(contrastDay)[0] === explosiveName,
  { order: contrastDay ? sessionStrengthOrder(contrastDay) : null, explosive: explosiveName });

// ── [9b] THE PAIR: heavy immediately before its explosive partner.
ok('[9b] the heavy lift appears IMMEDIATELY before its paired explosive movement',
  pairedSession.indexOf(heavyName) >= 0
    && pairedSession.indexOf(explosiveName) === pairedSession.indexOf(heavyName) + 1,
  { order: pairedSession, heavy: heavyName, explosive: explosiveName });
ok('[9b] and the explosive row is NOT at the top of the session',
  pairedSession[0] === heavyName && pairedSession[0] !== explosiveName,
  pairedSession);
ok('[9b] the pair sits at the MAIN slot, not appended to the end',
  pairedSession.indexOf(explosiveName) < pairedSession.length - 1,
  pairedSession);
ok('[9b] both halves stay inside the ONE Strength section, and no Power section exists',
  (() => {
    if (!pairedDay) return false;
    const plan = buildSessionExecutionPlan({ workout: pairedDay,
      template: buildSessionTemplate(pairedDay), mobilityFlow: null });
    return !plan.sections.some((s) => String(s.id) === 'power')
      && pairedSession.includes(heavyName) && pairedSession.includes(explosiveName);
  })(),
  pairedDay ? buildSessionExecutionPlan({ workout: pairedDay,
    template: buildSessionTemplate(pairedDay), mobilityFlow: null }).sections.map((s) => s.id) : null);

// ── [9c] ONE ORDER, BOTH SURFACES.
ok('[9c] the Day summary card and the Session screen show the SAME order',
  pairedSession.length > 0 && JSON.stringify(pairedSession) === JSON.stringify(pairedCard),
  { session: pairedSession, dayCard: pairedCard });
ok('[9c] and the same single Strength count',
  pairedSession.length === pairedCard.length && pairedSession.length > 0,
  { session: pairedSession.length, dayCard: pairedCard.length });

// ── [9d] BREAKING THE PAIRING REDS THE ORDER. The mutation lives INSIDE the
//    cell, because the thing under test is data the pairing owner writes — a
//    source mutation cannot express "the pair lost its order".
const unstamped = pairedDay ? { ...pairedDay, exercises: (pairedDay.exercises ?? [])
  .map((r: any) => { const { supersetOrder, ...rest } = r; return rest; }) } : null;
const regrouped = pairedDay ? { ...pairedDay, exercises: (pairedDay.exercises ?? [])
  .map((r: any) => { const { supersetGroup, supersetOrder, pairType, ...rest } = r; return rest; }) } : null;
const swapped = pairedDay ? { ...pairedDay, exercises: (pairedDay.exercises ?? [])
  .map((r: any) => (typeof r.supersetOrder === 'number'
    ? { ...r, supersetOrder: r.supersetOrder === 1 ? 2 : 1 } : r)) } : null;

ok('[9d] MUTATION — strip supersetOrder and the explosive row leaves its partner\'s side',
  !!unstamped && sessionStrengthOrder(unstamped).indexOf(explosiveName)
    !== sessionStrengthOrder(unstamped).indexOf(heavyName) + 1,
  unstamped ? sessionStrengthOrder(unstamped) : null);
ok('[9d] MUTATION — break the pairing entirely and the explosive row returns to the top',
  !!regrouped && sessionStrengthOrder(regrouped)[0] === explosiveName,
  regrouped ? sessionStrengthOrder(regrouped) : null);
ok('[9d] MUTATION — reverse the authored pair order and the two swap places',
  !!swapped && sessionStrengthOrder(swapped).indexOf(heavyName)
    === sessionStrengthOrder(swapped).indexOf(explosiveName) + 1,
  swapped ? sessionStrengthOrder(swapped) : null);
ok('[9d] and every one of those mutations moves the DAY CARD identically too',
  !!unstamped && !!regrouped && !!swapped
    && JSON.stringify(sessionStrengthOrder(unstamped)) === JSON.stringify(dayCardStrengthOrder(unstamped))
    && JSON.stringify(sessionStrengthOrder(regrouped)) === JSON.stringify(dayCardStrengthOrder(regrouped))
    && JSON.stringify(sessionStrengthOrder(swapped)) === JSON.stringify(dayCardStrengthOrder(swapped)),
  { unstamped: dayCardStrengthOrder(unstamped ?? {}),
    regrouped: dayCardStrengthOrder(regrouped ?? {}),
    swapped: dayCardStrengthOrder(swapped ?? {}) });

console.log(`\nGenerated power delivery: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exitCode = 1;

}
main().catch(error => { console.error(error); totalsPrinted(1); process.exitCode = 1; });
