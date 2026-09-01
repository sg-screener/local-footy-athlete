(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { Microcycle, OnboardingData, SeasonPhase, Workout, WorkoutExercise } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import {
  applyStrengthDeloadToExercises,
  isConditioningExerciseRow,
  resolveDeloadWeekPolicy,
  resolveWeekKind,
} from '../rules/deloadWeekRules';
import { buildBlockWeekStates } from '../utils/programBlockState';
import {
  composeTemporarySourceFactCompatibility,
  createTemporaryFatigueFact,
} from '../rules/temporarySourceFact';
import { readinessDeloadFactScope } from '../rules/durableFactHorizon';

let pass = 0;
let fail = 0;
const failures: string[] = [];

/**
 * DECLARED GAPS — the mechanism borrowed verbatim from `surfaceAgreementTests`,
 * with its three properties intact:
 *
 *   1. THE ASSERTION IS UNCHANGED. Not loosened, not skipped, not conditional.
 *      It runs, it fails, and the failure is matched against a declared entry.
 *   2. STALE DECLARATIONS FAIL. If a declared gap stops reddening, this suite
 *      fails until the entry is deleted. A gap cannot outlive its defect.
 *   3. IT IS NOT A PASS. Gaps print as `GAP` and are counted separately, so no
 *      run of this suite can be read as "every cell agrees".
 *
 * This suite is chained into `test:bible` by the unit that unchained it, and it
 * is chained WITH this list non-empty — because the defect below is real,
 * pre-existing, and not this unit's to rule.
 */
interface DeclaredGap {
  id: string;
  /** Cell-name prefixes this may explain. Scoped, never global. */
  cells: readonly string[];
  /** The exact failure this explains. Cut from the message, not guessed. */
  matches: RegExp;
  why: string;
  owner: string;
  expiresWhen: string;
}

const DECLARED_GAPS: readonly DeclaredGap[] = [];

const gapsHit = new Set<string>();
let gapped = 0;

function declaredGapFor(cell: string, detail: string): DeclaredGap | null {
  return DECLARED_GAPS.find((gap) =>
    gap.cells.some((scope) => cell.startsWith(scope))
    && (gap.matches.test(cell) || gap.matches.test(detail))) ?? null;
}

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
    return;
  }
  const gap = declaredGapFor(name, detail ?? '');
  if (gap) {
    gapped++;
    gapsHit.add(gap.id);
    console.log(`  GAP  ${name}\n      declared gap: ${gap.id}`
      + `\n      owner: ${gap.owner}\n      expires when: ${gap.expiresWhen}`
      + `${detail ? `\n      ${detail}` : ''}`);
    return;
  }
  fail++;
  failures.push(name);
  console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
}

/**
 * THE PROFILE HAS TO PASS THE DOOR. This fixture predated the equipment unit
 * (2026-07-31) and the honest-generation-failure unit, and had been CRASHING —
 * not failing, crashing — ever since: `generationEquipmentInputOrThrow` refuses
 * to build a program for a profile carrying no equipment answer rather than
 * silently defaulting one, which is the whole point of that unit. A fixture
 * that cannot get through the door proves nothing about what is behind it.
 */
function profileFor(seasonPhase: SeasonPhase): OnboardingData {
  return {
    // R-130 required fields; fixture predates the rule
    gender: 'male',
    twoKmTimeTrial: { seconds: 465, recordedOn: '2026-01-01', source: 'onboarding' },
    // This suite states the phase clock explicitly. A finish date is a stronger
    // athlete fact and would correctly replace that clock, making the fixture
    // test January-to-July phase time instead of the requested phase weeks.
    seasonFinishedOn: undefined,
    firstName: 'DeloadAudit',
    position: 'inside_mid',
    heightCm: 183,
    experienceLevel: '2-5 years',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    seasonPhase,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: seasonPhase === 'Off-season' ? 0 : 2,
    teamTrainingDays: seasonPhase === 'Off-season' ? [] : ['Tuesday', 'Thursday'],
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
    motivation: 'Get stronger and fitter',
    weightKg: 85,
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    usualGameDay: seasonPhase === 'In-season' ? 'Saturday' : undefined,
  } as OnboardingData;
}

function phaseClockAt(
  seasonPhase: SeasonPhase,
  targetWeekStartISO: string,
  phaseWeekNumber: number,
) {
  const entry = new Date(`${targetWeekStartISO}T12:00:00`);
  entry.setDate(entry.getDate() - ((phaseWeekNumber - 1) * 7));
  return {
    protocolVersion: 1,
    selectedPhase: seasonPhase,
    phaseEntryWeekStartISO: entry.toISOString().slice(0, 10),
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  } as const;
}

function generatedBlock(seasonPhase: SeasonPhase, phaseWeekNumber = 1): Microcycle[] {
  return generateProgramLocally(profileFor(seasonPhase), {
    todayISO: '2026-07-06',
    previousProgram: null,
    seasonPhaseClock: phaseClockAt(seasonPhase, '2026-07-06', phaseWeekNumber),
  }).microcycles;
}

function days(microcycle: Microcycle): number[] {
  return microcycle.workouts.map((workout) => workout.dayOfWeek).sort((a, b) => a - b);
}

function hardConditioning(workout: Workout): boolean {
  return workout.conditioningCategory === 'vo2' ||
    workout.conditioningCategory === 'glycolytic' ||
    workout.conditioningFlavour === 'high-intensity';
}

function hasConditioningTouch(workout: Workout): boolean {
  return !!workout.conditioningCategory || !!workout.hasCombinedConditioning;
}

function easyOrTempoConditioningTouch(workout: Workout): boolean {
  return workout.conditioningCategory === 'aerobic_base' ||
    workout.conditioningCategory === 'tempo' ||
    (workout.hasCombinedConditioning &&
      (workout.conditioningFlavour === 'aerobic' || workout.conditioningFlavour === 'tempo'));
}

function strengthRows(workout: Workout): WorkoutExercise[] {
  return workout.exercises.filter((exercise) => !isConditioningExerciseRow(exercise));
}

function mainRows(workout: Workout): WorkoutExercise[] {
  return strengthRows(workout).filter((exercise) =>
    classifyPoolSlot(exercise.exercise?.name ?? '')?.role === 'anchor');
}

function strengthLike(workout: Workout): boolean {
  return workout.workoutType === 'Strength' ||
    workout.workoutType === 'Mixed' ||
    workout.workoutType === 'Team Training';
}

function totalStrengthSets(microcycle: Microcycle): number {
  return microcycle.workouts
    .filter(strengthLike)
    .flatMap(strengthRows)
    .reduce((sum, exercise) => sum + exercise.prescribedSets, 0);
}

function deloadNotes(microcycle: Microcycle): string[] {
  return microcycle.workouts
    .flatMap(strengthRows)
    .map((exercise) => exercise.notes ?? '')
    // Sam's deload law (2026-07-27) renamed the note and moved the target from
    // RPE 6-7 to 5-6 — "every set easy ... nowhere near failure".
    .filter((note) => /Deload:/i.test(note));
}

function comparableStrengthPairs(buildWeek: Microcycle, deloadWeek: Microcycle): Array<[Workout, Workout]> {
  return buildWeek.workouts
    .filter(strengthLike)
    .map((buildWorkout) => {
      const deloadWorkout = deloadWeek.workouts.find((candidate) => candidate.dayOfWeek === buildWorkout.dayOfWeek);
      return deloadWorkout ? [buildWorkout, deloadWorkout] as [Workout, Workout] : null;
    })
    .filter((pair): pair is [Workout, Workout] => !!pair);
}

function weeklyStrengthPatterns(microcycle: Microcycle): string[] {
  return Array.from(new Set(
    microcycle.workouts.flatMap((workout) =>
      workout.strengthIntent?.effectivePatterns ?? workout.strengthIntent?.plannedPatterns ?? [],
    ),
  )).sort();
}

function assertCalendarDeload(
  seasonPhase: 'Off-season' | 'Pre-season',
  expectedMultiplier: number,
  microcycles: Microcycle[] = generatedBlock(seasonPhase),
): void {
  const week1 = microcycles[0];
  const week2 = microcycles[1];
  const week3 = microcycles[2];
  const week4 = microcycles[3];

  ok(`${seasonPhase} weeks 1-3 are build weeks`,
    [week1, week2, week3].every((week) => week.weekKind === 'build' && week.intensityMultiplier === 1.0),
    JSON.stringify([week1, week2, week3].map((week) => ({ weekKind: week.weekKind, intensityMultiplier: week.intensityMultiplier }))));
  ok(`${seasonPhase} week 4 is deload`, week4.weekKind === 'deload');
  ok(`${seasonPhase} week 4 multiplier applied`, week4.intensityMultiplier === expectedMultiplier,
    String(week4.intensityMultiplier));
  ok(`${seasonPhase} week 4 keeps same session days`,
    JSON.stringify(days(week4)) === JSON.stringify(days(week3)),
    JSON.stringify({ week3: days(week3), week4: days(week4) }));
  ok(`${seasonPhase} week 4 does not collapse days to rest`,
    week4.workouts.length === week3.workouts.length,
    JSON.stringify({ week3: week3.workouts.length, week4: week4.workouts.length }));
  ok(`${seasonPhase} week 4 is lighter than week 3`,
    totalStrengthSets(week4) < totalStrengthSets(week3),
    JSON.stringify({ week3: totalStrengthSets(week3), week4: totalStrengthSets(week4) }));
  ok(`${seasonPhase} week 4 has deload RPE notes`, deloadNotes(week4).length > 0);
  ok(`${seasonPhase} week 4 has no hard conditioning`,
    week4.workouts.every((workout) => !hardConditioning(workout)),
    JSON.stringify(week4.workouts.map((workout) => ({
      day: workout.dayOfWeek,
      category: workout.conditioningCategory,
      flavour: workout.conditioningFlavour,
    }))));
  ok(`${seasonPhase} week 4 keeps at most one small typed Speed exposure`,
    week4.workouts.filter((workout) => workout.speedBlock?.kind === 'true_speed').length <= 1);
  ok(`${seasonPhase} week 4 keeps an easy/tempo conditioning touch`,
    week4.workouts.some(easyOrTempoConditioningTouch),
    JSON.stringify(week4.workouts.map((workout) => ({
      day: workout.dayOfWeek,
      category: workout.conditioningCategory,
      combined: workout.hasCombinedConditioning,
    }))));
  ok(`${seasonPhase} week 4 keeps useful conditioning somewhere`,
    week4.workouts.some(hasConditioningTouch));
  if (seasonPhase === 'Pre-season') {
    ok('Pre-season deload preserves weekly strength-pattern coverage',
      JSON.stringify(weeklyStrengthPatterns(week4)) === JSON.stringify(weeklyStrengthPatterns(week3)) &&
      weeklyStrengthPatterns(week4).length === 4,
      JSON.stringify({
        build: weeklyStrengthPatterns(week3),
        deload: weeklyStrengthPatterns(week4),
      }));
  }

  for (const [buildWorkout, deloadWorkout] of comparableStrengthPairs(week3, week4)) {
    const buildMain = mainRows(buildWorkout)[0];
    const deloadMain = mainRows(deloadWorkout)[0];
    if (!buildMain) continue;
    if (seasonPhase === 'Off-season') {
      ok(`${seasonPhase} day ${buildWorkout.dayOfWeek} keeps main lift`,
        !!deloadMain && buildMain.exercise?.name === deloadMain.exercise?.name,
        JSON.stringify({
          build: buildMain?.exercise?.name,
          deload: deloadMain?.exercise?.name,
        }));
    }
    if (deloadMain) {
      ok(`${seasonPhase} day ${buildWorkout.dayOfWeek} main sets reduced safely`,
        deloadMain.prescribedSets >= 2 && deloadMain.prescribedSets <= buildMain.prescribedSets,
        JSON.stringify({ build: buildMain.prescribedSets, deload: deloadMain.prescribedSets }));
      // Adjacent generated weeks may sit on different progression rungs, so
      // cross-week kilograms are not an instrument for the deload transform.
      // `test:deload-law` holds the transform itself: load is retained unless
      // the typed policy says the athlete is beat up. This final-week suite
      // measures the reduction it can attribute here: sets and visible notes.
    }
  }

  // Sam's law halves the sets with a floor of ONE — halving must never remove a
  // lift, but the old floor of 2 blocked the halving it now mandates.
  ok(`${seasonPhase} deload strength sets never fall below 1`,
    week4.workouts
      .filter(strengthLike)
      .flatMap(strengthRows)
      .every((exercise) => exercise.prescribedSets >= 1),
    JSON.stringify(week4.workouts.flatMap(strengthRows).map((exercise) => ({
      name: exercise.exercise?.name,
      sets: exercise.prescribedSets,
    }))));
}

console.log('\n-- Calendar deload week generation --');

{
  const states = buildBlockWeekStates({
    blockStartISO: '2026-07-06',
    blockNumber: 1,
    seasonPhase: 'Off-season',
  });
  ok('week kind table: week 3 builds', resolveWeekKind('Off-season', 3) === 'build');
  ok('week kind table: first Off-season phase week 4 builds', resolveWeekKind('Off-season', 4) === 'build');
  ok('week kind table: late Off-season phase week 8 deloads', resolveWeekKind('Off-season', 8) === 'deload');
  ok('week kind table: in-season week 4 still builds', resolveWeekKind('In-season', 4) === 'build');
  ok('first Off-season block exposes no automatic deload',
    states.map((state) => state.weekKind).join(',') === 'build,build,build,build',
    states.map((state) => state.weekKind).join(','));
}

{
  const firstOffseason = generatedBlock('Off-season', 1);
  ok('first Off-season phase block keeps all four weeks as build',
    firstOffseason.every((week) => week.weekKind === 'build'),
    JSON.stringify(firstOffseason.map((week) => ({
      start: week.startDate, kind: week.weekKind, weekNumber: week.weekNumber,
    }))));
  ok('first Off-season phase week 4 receives no deload prescription notes',
    deloadNotes(firstOffseason[3]).length === 0);
  assertCalendarDeload('Off-season', 0.85, generatedBlock('Off-season', 5));
}
assertCalendarDeload('Pre-season', 0.9, generatedBlock('Pre-season', 1));

{
  const inSeason = generatedBlock('In-season');
  ok('in-season weeks stay build in this slice',
    inSeason.every((week) => week.weekKind === 'build' && week.intensityMultiplier === 1.0),
    JSON.stringify(inSeason.map((week) => ({ week: week.weekNumber, kind: week.weekKind, intensity: week.intensityMultiplier }))));
  ok('in-season week 4 is not tagged with deload RPE notes',
    deloadNotes(inSeason[3]).length === 0);
}

{
  const policy = resolveDeloadWeekPolicy('Off-season', 'deload');
  const exercise = {
    id: 'e1',
    workoutId: 'w1',
    exerciseId: 'ex1',
    exerciseOrder: 1,
    prescribedSets: 2,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 100,
    restSeconds: 0,
    exercise: {
      id: 'ex1',
      name: 'Back Squat',
      description: '',
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  } as WorkoutExercise;
  const deloaded = applyStrengthDeloadToExercises([exercise], policy!)[0];
  // 2 sets halve to 1, and 1 is the floor — the lift survives the deload.
  ok('halving clamps at the 1-set floor, never to zero',
    deloaded.prescribedSets === 1,
    JSON.stringify({ sets: deloaded.prescribedSets }));
}

// ── R-035: THE DELOAD LANDS ON THE WINDOW'S DAYS, NOT ON THE CALENDAR WEEK ──
//
// Sam, R-035: "the next 7 days are deloaded — a ROLLING 7-day window from the
// declaration day, NOT THE REST OF THE CALENDAR WEEK."
//
// The window is built by readinessIllnessLaw, carried onto the fact by
// readinessDeloadFactScope, and honoured by the compatibility projection's own
// `onDate` filter — then generation asks that projection ONCE for the week and
// applies the answer to every day. A Thursday declaration therefore deloads the
// Monday, Tuesday and Wednesday that were already trained or already planned.
//
// THE TIER IS "WRECKED" ON PURPOSE. "Absolutely cooked" also lifts the minimums
// (R-038), flipping the week to optional_week and changing which sessions exist
// — a per-day dose comparison could not then attribute its own result. Wrecked
// deloads WITHOUT touching the week's mode, so only the dose moves.
{
  const MON = '2026-07-06';
  const THU = '2026-07-09';   // declaration day; window runs THU..2026-07-15

  const wrecked = createTemporaryFatigueFact({
    observedDate: THU,
    scope: readinessDeloadFactScope({ declaredOnISO: THU, todayISO: THU }),
    athleteReportedLevel: 'high',        // levelScore 7 -> tier `wrecked`
    reportKind: 'fatigue',
    sourceSurface: 'program_tab',
  });
  const compat = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [wrecked],
    onDate: THU,
  });

  const control = generateProgramLocally(profileFor('Pre-season'), {
    todayISO: THU, previousProgram: null,
  }).microcycles[0];
  const declared = generateProgramLocally(profileFor('Pre-season'), {
    todayISO: THU,
    previousProgram: null,
    temporarySourceFacts: [wrecked],
    activeConstraints: compat.activeConstraints,
  }).microcycles[0];

  const setsOn = (micro: Microcycle, dow: number): number =>
    (micro?.workouts ?? [])
      .filter((w) => w.dayOfWeek === dow)
      .flatMap((w) => strengthRows(w))
      .reduce((sum, row) => sum + (row.prescribedSets ?? 0), 0);
  const BEFORE = [1, 2, 3];          // Mon 6, Tue 7, Wed 8 — outside the window
  const INSIDE = [4, 5, 6, 0];       // Thu 9 .. Sun 12 — inside it

  // NON-VACUITY FIRST: without this, "Mon-Wed untouched" is trivially true of a
  // world where the declaration was never read — which is exactly what the first
  // attempt at this cell measured, and it passed.
  ok('[R-035] non-vacuity: the wrecked declaration reaches generation at all',
    [...BEFORE, ...INSIDE].some((d) => setsOn(declared, d) !== setsOn(control, d)),
    `control=${[...BEFORE, ...INSIDE].map((d) => setsOn(control, d)).join(',')} `
      + `declared=${[...BEFORE, ...INSIDE].map((d) => setsOn(declared, d)).join(',')} `
      + `constraints=${compat.activeConstraints.length}`);

  // THE PAIR IS THE PROOF, AND BOTH HALVES ARE NEEDED.
  //
  // Measured either side of the fix, same seed, same week:
  //            Mon      Tue     Wed      Thu     Fri
  //   before   14->6    8->4    13->13   5->2    11->4      Mon/Tue HALVED
  //   after    14->13   8->7    13->13   5->2    11->4      Mon/Tue intact
  //
  // Before the fix the deload halved days that were already trained. After it,
  // the halving lands only inside the window. Asserting a RATIO rather than
  // equality is deliberate: a small week-level readiness effect (~1 set/day,
  // NOT the deload) still touches days outside the window, and it is a
  // different mechanism — named in the report rather than hidden by loosening
  // this cell to "unchanged".
  const ratio = (d: number): number =>
    setsOn(control, d) === 0 ? 1 : setsOn(declared, d) / setsOn(control, d);

  const halvedOutside = BEFORE.filter((d) => ratio(d) <= 0.6);
  ok('[R-035] days BEFORE the declaration are not deloaded',
    halvedOutside.length === 0,
    `deloaded outside the window: ${halvedOutside
      .map((d) => `dow ${d} (${setsOn(control, d)} -> ${setsOn(declared, d)})`).join('; ')}`);

  // NON-VACUITY, THE SECOND HALF: the deload must still LAND inside the window,
  // or "not deloaded outside" is true of a world where nothing deloaded at all.
  const deloadedInside = INSIDE.filter((d) => setsOn(control, d) > 0 && ratio(d) <= 0.6);
  ok('[R-035] and the days INSIDE the window still ARE deloaded',
    deloadedInside.length > 0,
    `inside-window days: ${INSIDE
      .map((d) => `dow ${d} (${setsOn(control, d)} -> ${setsOn(declared, d)})`).join('; ')}`);
}

// Property 2 of the mechanism: a declaration cannot outlive its defect.
const staleGaps = DECLARED_GAPS.filter((gap) => !gapsHit.has(gap.id));
for (const gap of staleGaps) {
  fail++;
  failures.push(`declared gap no longer reds: ${gap.id}`);
  console.log(`  fail declared gap "${gap.id}" no longer reds — delete the entry, `
    + 'do not leave it carrying debt that is already paid.');
}

console.log(`\ndeloadWeekGenerationTests: ${pass} passed, ${gapped} declared gap(s), `
  + `${fail} failed`);
totalsPrinted(fail);

if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
