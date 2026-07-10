(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import { selectActiveProgramModifiers } from '../utils/activeProgramModifiers';
import {
  attachPrescriptionEffectEvidence,
  buildPrescriptionEffectEvidence,
} from '../utils/deterministicCoachNoteFactory';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../utils/coachingEngine';
import { attachRecoveryAddonsToWeek } from '../utils/recoveryAddonBuilder';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function exercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: 'row-squat',
    workoutId: 'workout-lower',
    exerciseId: 'ex-back-squat',
    exerciseOrder: 1,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 100,
    restSeconds: 120,
    exercise: { name: 'Back Squat' } as any,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
    ...overrides,
  };
}

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'workout-lower',
    microcycleId: 'week-test',
    dayOfWeek: 1,
    name: 'Lower Strength',
    description: 'Lower Strength',
    durationMinutes: 55,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [exercise()],
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
    ...overrides,
  };
}

function dateForDay(dayOfWeek: number): string {
  const dates = ['2026-07-12', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11'];
  return dates[dayOfWeek];
}

function visibleDays(workouts: readonly Workout[]) {
  return workouts.map((item) => ({ date: dateForDay(item.dayOfWeek), workout: item }));
}

function notesFor(workouts: readonly Workout[]) {
  return selectActiveCoachNotes({
    visibleWeekDays: visibleDays(workouts),
    todayISO: '2026-07-06',
  });
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  position: 'inside_mid',
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  experienceLevel: '2-5 years',
  squatStrength: 'Around bodyweight',
  benchStrength: 'Around bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Stay consistent',
};

console.log('deterministicCoachNoteFactoryTests');

console.log('\n[1] progression/adaptation proof requires a real prescription diff');
{
  const before = workout();
  const after = workout({ exercises: [exercise({ prescribedSets: 2 })] });
  const evidence = buildPrescriptionEffectEvidence({
    seed: {
      kind: 'progression_adaptation',
      reason: 'adaptation_reduced',
      ownerKey: 'feedback:2026-07-01:lower',
    },
    before: before.exercises,
    after: after.exercises,
  });
  ok('changed prescription creates typed adaptation evidence', !!evidence, evidence);
  const changedWorkout = attachPrescriptionEffectEvidence(after, evidence);
  const notes = notesFor([changedWorkout]);
  eq('changed prescription creates one visible adaptation note', notes.length, 1);
  ok('adaptation copy explains the actual reduction', /reduced.*last session felt hard/i.test(notes[0]?.body ?? ''), notes[0]);

  const noOpEvidence = buildPrescriptionEffectEvidence({
    seed: {
      kind: 'progression_adaptation',
      reason: 'adaptation_held',
      ownerKey: 'feedback:2026-07-01:lower',
    },
    before: before.exercises,
    after: before.exercises,
  });
  eq('no-op progression creates no evidence', noOpEvidence, null);
  eq('no-op progression creates no note', notesFor([before]), []);

  const staleWorkout = {
    ...changedWorkout,
    exercises: [exercise({ prescribedSets: 4 })],
  };
  eq('stale prescription proof is suppressed after visible content changes', notesFor([staleWorkout]), []);
}

console.log('\n[2] beginner policy notes only proven prescription changes');
{
  const beginnerProfile: OnboardingData = {
    ...BASE_PROFILE,
    seasonPhase: 'Pre-season',
    experienceLevel: 'Complete beginner',
    trainingDaysPerWeek: 1,
    preferredTrainingDays: ['Monday'],
  };
  const coachWorkout = [{
    dayOfWeek: 1,
    name: 'Lower Squat',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [{ name: 'Goblet Squat', sets: 4, repsMin: 3, repsMax: 5, weight: 30 }],
  }];
  const beginner = buildWorkoutsFromCoach(coachWorkout, 'beginner-note', undefined, beginnerProfile);
  const beginnerNotes = notesFor(beginner);
  ok('beginner note appears when dose/prescription changed', beginnerNotes.some((note) => note.title === 'Beginner dose active'), beginnerNotes);

  const established = buildWorkoutsFromCoach(coachWorkout, 'adult-note', undefined, {
    ...beginnerProfile,
    experienceLevel: '2-5 years',
  });
  ok('normal training age does not create a beginner note',
    !notesFor(established).some((note) => note.title === 'Beginner dose active'),
    notesFor(established));
}

console.log('\n[3] testing notes require an actual generated-plan difference');
{
  const poorAerobicProfile: OnboardingData = {
    ...BASE_PROFILE,
    position: undefined,
    trainingDaysPerWeek: 2,
    preferredTrainingDays: ['Monday', 'Tuesday'],
    conditioningLevel: 'Poor',
  };
  const biasedPlan = buildCoachingPlan(onboardingToCoachingInputs(poorAerobicProfile, {
    weekInBlock: 4,
  }));
  const biasedWorkouts = buildWorkoutsFromCoach(
    [],
    'testing-note',
    biasedPlan.weeklyPlan,
    poorAerobicProfile,
  );
  const biasedNotes = notesFor(biasedWorkouts);
  ok('testing note appears when aerobic bias changes the visible plan',
    biasedNotes.some((note) => note.title === 'Testing focus active' && /Aerobic or tempo/i.test(note.body)),
    biasedNotes);

  const neutralPlan = buildCoachingPlan(onboardingToCoachingInputs({
    ...poorAerobicProfile,
    conditioningLevel: 'Good',
  }, { weekInBlock: 4 }));
  const neutralWorkouts = buildWorkoutsFromCoach(
    [],
    'testing-note-neutral',
    neutralPlan.weeklyPlan,
    { ...poorAerobicProfile, conditioningLevel: 'Good' },
  );
  ok('neutral testing data creates no testing note',
    !notesFor(neutralWorkouts).some((note) => note.title === 'Testing focus active'),
    notesFor(neutralWorkouts));
}

console.log('\n[4] testing robustness note follows actual safe add-on ordering');
{
  const baseWeek = [
    workout({ id: 'lower', dayOfWeek: 1, name: 'Lower Strength' }),
    workout({ id: 'upper', dayOfWeek: 2, name: 'Upper Strength', exercises: [] }),
    workout({ id: 'recovery', dayOfWeek: 3, name: 'Recovery', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] }),
    workout({ id: 'full', dayOfWeek: 4, name: 'Full Body Strength', exercises: [] }),
    workout({ id: 'aerobic', dayOfWeek: 5, name: 'Easy Aerobic', workoutType: 'Conditioning', exercises: [] }),
  ];
  const adjusted = attachRecoveryAddonsToWeek({
    workouts: baseWeek,
    profile: { ...BASE_PROFILE, biggestLimitation: 'Injury history' },
    weekKind: 'build',
  });
  const notes = notesFor(adjusted);
  ok('testing/injury-history ordering creates a proven prehab note',
    notes.some((note) => note.title === 'Testing focus active' && /Prehab support/i.test(note.body)),
    notes);
  const beforeCounts = countWeeklyExposures(visibleDays(baseWeek));
  const afterCounts = countWeeklyExposures(visibleDays(adjusted));
  eq('recovery note evidence creates no extra hard day', afterCounts.hardExposures, beforeCounts.hardExposures);
}

console.log('\n[5] subphase notes require typed visible dose evidence');
{
  const plan = buildCoachingPlan(onboardingToCoachingInputs(BASE_PROFILE, { weekInBlock: 1 }));
  const workouts = buildWorkoutsFromCoach([], 'subphase-note', plan.weeklyPlan, BASE_PROFILE);
  const notes = notesFor(workouts);
  ok('early off-season note appears when off-feet/lighter policy shapes a session',
    notes.some((note) => note.title === 'Early off-season focus'),
    notes);
  eq('normal phase profile fact without effect evidence remains silent', selectActiveCoachNotes({
    onboardingData: BASE_PROFILE,
    visibleWeekDays: visibleDays([workout()]),
    todayISO: '2026-07-06',
  }), []);
}

console.log('\n[6] bye notes are derived only from the dedicated bye shape');
{
  const byeProfile: OnboardingData = {
    ...BASE_PROFILE,
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
  };
  const byePlan = buildCoachingPlan(onboardingToCoachingInputs(byeProfile));
  const byeWorkouts = buildWorkoutsFromCoach([], 'bye-note', byePlan.weeklyPlan, byeProfile);
  const byeNotes = notesFor(byeWorkouts);
  ok('bye context that changes week shape creates one bye note',
    byeNotes.filter((note) => /Bye-week/i.test(note.title)).length === 1,
    byeNotes);

  const gameProfile: OnboardingData = { ...byeProfile, usualGameDay: 'Saturday' };
  const gamePlan = buildCoachingPlan(onboardingToCoachingInputs(gameProfile));
  const gameWorkouts = buildWorkoutsFromCoach([], 'game-note', gamePlan.weeklyPlan, gameProfile);
  ok('normal game week creates no bye note',
    !notesFor(gameWorkouts).some((note) => /Bye-week/i.test(note.title)),
    notesFor(gameWorkouts));
}

console.log('\n[7] generated notes dedupe and remain non-clearable system state');
{
  const changed = workout({ exercises: [exercise({ prescribedSets: 2 })] });
  const evidence = buildPrescriptionEffectEvidence({
    seed: {
      kind: 'progression_adaptation',
      reason: 'adaptation_reduced',
      ownerKey: 'feedback:duplicate',
    },
    before: workout().exercises,
    after: changed.exercises,
  });
  const first = attachPrescriptionEffectEvidence(changed, evidence);
  const duplicate = { ...first, id: 'duplicate-workout', dayOfWeek: 3 };
  const notes = notesFor([first, duplicate]);
  eq('same generated owner/week/source renders one note', notes.length, 1);
  eq('generated note has no misleading clear action', notes[0]?.actions, []);

  const modifiers = selectActiveProgramModifiers({
    visibleWeekDays: visibleDays([first, duplicate]),
    todayISO: '2026-07-06',
  });
  eq('generated note carries current-week truth-gate evidence', modifiers[0]?.affects, ['current_week']);
  eq('generated note source is deterministic program effect', modifiers[0]?.source, 'program_effect');
}

console.log(`\ndeterministicCoachNoteFactoryTests: ${pass} passed, ${fail} failed`);
if (failures.length) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail > 0 ? 1 : 0);
