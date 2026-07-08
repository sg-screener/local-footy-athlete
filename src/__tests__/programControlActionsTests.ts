(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  executeProgramControlAction,
  routeProgramControlAction,
  type ProgramControlAction,
} from '../utils/programControlActions';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useReadinessStore } from '../store/readinessStore';
import type { Workout, WorkoutExercise } from '../types/domain';
import { todayISOLocal } from '../utils/appDate';
import {
  upsertTapRecoveryModeModifier,
  withActiveProgramModifierContext,
} from '../utils/tapProgramModifiers';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { scheduleModifierIdForDate } from '../utils/programControlActions';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown) {
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

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function resetStores() {
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeInjury: null,
    activeConstraints: [],
  } as any);
  useAthletePreferencesStore.setState({
    prefs: { excluded: [], pinned: [], activeInjuries: [] },
  } as any);
  useCoachPreferencesStore.setState({ modalityPreferences: {} } as any);
  useReadinessStore.setState({ signalsByDate: {} } as any);
  useProfileStore.setState({
    onboardingData: { trainingLocation: 'Commercial gym' },
  } as any);
  useProgramStore.setState({
    dateOverrides: {},
    overrideContexts: {},
  } as any);
}

function baseAction<T extends ProgramControlAction['type']>(
  type: T,
  payload: Extract<ProgramControlAction, { type: T }>['payload'],
  overrides: Partial<ProgramControlAction> = {},
): Extract<ProgramControlAction, { type: T }> {
  return {
    type,
    source: { screen: 'test', surface: 'program_control', initiatedBy: 'test' },
    scope: 'current_and_future',
    payload,
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: false,
    ...overrides,
  } as Extract<ProgramControlAction, { type: T }>;
}

function restWorkout(date: string): Workout {
  return {
    id: `rest-${date}`,
    microcycleId: 'test-microcycle',
    dayOfWeek: 1,
    name: 'Rest',
    description: 'Rest',
    durationMinutes: 0,
    intensity: 'Light',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: [],
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  };
}

function exerciseRow(name: string, order: number): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    id: `we-${slug}`,
    workoutId: 'workout-strength',
    exerciseId: `ex-${slug}`,
    exerciseOrder: order,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 40,
    restSeconds: 90,
    exercise: {
      id: `ex-${slug}`,
      name,
      description: name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
    },
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  };
}

function strengthWorkout(exercises: WorkoutExercise[] = [
  exerciseRow('Bench Press', 0),
  exerciseRow('Back Squat', 1),
]): Workout {
  return {
    id: 'workout-strength',
    microcycleId: 'test-microcycle',
    dayOfWeek: 1,
    name: 'Upper Push',
    description: 'Test strength session',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises,
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  };
}

function seedStrengthWorkout(date = '2026-07-06') {
  void date;
  useProgramStore.setState({
    currentProgram: {
      id: 'program',
      userId: 'test-user',
      name: 'Test Program',
      description: 'Fixture',
      programPhase: 'Pre-Season-Skills',
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      microcycles: [],
      primaryFocus: 'Strength',
      isActive: true,
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
    },
    currentMicrocycle: {
      id: 'test-microcycle',
      programId: 'program',
      weekNumber: 1,
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      miniCycleNumber: 1,
      intensityMultiplier: 1,
      workouts: [strengthWorkout()],
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
    },
    dateOverrides: {},
    overrideContexts: {},
  } as any);
}

function overrideExerciseNames(date = '2026-07-06'): string[] {
  return (useProgramStore.getState().dateOverrides[date]?.exercises ?? [])
    .map((exercise: any) => exercise.exercise?.name ?? exercise.exerciseId);
}

function overrideExerciseRows(date = '2026-07-06'): any[] {
  return useProgramStore.getState().dateOverrides[date]?.exercises ?? [];
}

console.log('programControlActionsTests');

console.log('\n[1] recovery modifier creation through ProgramControlAction');
{
  resetStores();
  const todayISO = todayISOLocal();
  const result = executeProgramControlAction(baseAction(
    'set_recovery_mode',
    {
      date: todayISO,
      todayISO,
      recoveryScope: 'week',
    },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });

  eq('create succeeds', result.ok, true);
  eq('no Coach fallback', result.fallbackToCoach, false);
  ok('created modifier reported', (result.createdModifierIds ?? []).length === 1);
  ok('Coach Notes includes recovery mode', notes.some((note) => note.title === 'Recovery mode active'));
}

console.log('\n[2] no duplicate recovery status modifiers');
{
  resetStores();
  const todayISO = todayISOLocal();
  const action = baseAction(
    'set_recovery_mode',
    {
      date: todayISO,
      todayISO,
      recoveryScope: 'week',
    },
    { scope: 'current_week', createsActiveModifier: true },
  );
  executeProgramControlAction(action, { todayISO });
  executeProgramControlAction(action, { todayISO });

  eq('one active recovery constraint', useCoachUpdatesStore.getState().activeConstraints.length, 1);
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  eq('one Coach Note', notes.length, 1);
}

console.log('\n[3] multiple modifiers stack');
{
  resetStores();
  const todayISO = todayISOLocal();
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
    bikeLabel: 'Assault Bike',
  });
  executeProgramControlAction(baseAction(
    'set_recovery_mode',
    {
      date: todayISO,
      todayISO,
      recoveryScope: 'week',
    },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    todayISO,
  });

  ok('rower note appears', notes.some((note) => /Easy Aerobic Flush/.test(note.title)));
  ok('recovery note appears', notes.some((note) => note.title === 'Recovery mode active'));
}

console.log('\n[4] clear active equipment adjustment through ProgramControlAction');
{
  resetStores();
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
    bikeLabel: 'Assault Bike',
  });
  const note = selectActiveCoachNotes({
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
  })[0];
  const result = executeProgramControlAction(baseAction('clear_active_modifier', {
    noteId: note.id,
  }));

  eq('clear succeeds', result.ok, true);
  eq('does not request Coach fallback', result.fallbackToCoach, false);
  eq('routes as guided tap flow', result.route, 'guided_tap_flow');
  eq('modality preference cleared', useCoachPreferencesStore.getState().modalityPreferences, {});
  ok('reports cleared modifier id', (result.clearedModifierIds ?? []).length === 1);
}

console.log('\n[5] clear recovery modifier removes linked program override');
{
  resetStores();
  const todayISO = todayISOLocal();
  const modifierId = upsertTapRecoveryModeModifier({
    date: todayISO,
    todayISO,
    appliedDates: [todayISO],
    scope: 'day',
  });
  useProgramStore.getState().setManualOverride(
    todayISO,
    restWorkout(todayISO),
    withActiveProgramModifierContext(
      { intent: 'program_adjustment', label: 'test recovery swap' },
      modifierId,
    ),
  );
  const note = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  })[0];
  const result = executeProgramControlAction(baseAction('clear_active_modifier', {
    noteId: note.id,
  }));

  eq('recovery clear succeeds', result.ok, true);
  eq('linked date override removed', useProgramStore.getState().dateOverrides, {});
  eq('active constraints empty', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('no Coach fallback', result.fallbackToCoach, false);
}

console.log('\n[6] routine setup action is guided, not Coach fallback');
{
  resetStores();
  const action = baseAction(
    'update_game_day',
    { gameDay: 'Saturday' },
    { requiresRebuild: true },
  );
  const route = routeProgramControlAction(action);
  const result = executeProgramControlAction(action);

  eq('route is guided tap flow', route.route, 'guided_tap_flow');
  eq('not wired yet', result.ok, false);
  eq('does not fallback to Coach', result.fallbackToCoach, false);
  eq('reports rebuild metadata', result.requiresRebuild, true);
}

console.log('\n[7] missing exercise replacement asks for guided follow-up');
{
  resetStores();
  const action = baseAction('swap_exercise', {
    date: todayISOLocal(),
    fromExercise: 'Back Squat',
  });
  const result = executeProgramControlAction(action);

  eq('needs guided follow-up', result.needsGuidedFollowUp, true);
  eq('does not fallback to Coach', result.fallbackToCoach, false);
  eq('route is follow-up sheet', result.route, 'guided_follow_up_sheet');
}

console.log('\n[8] routine fatigue and soreness status actions stay out of Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  let result = executeProgramControlAction(baseAction(
    'set_fatigue_status',
    { date: todayISO, todayISO, level: 'cooked' },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  eq('cooked succeeds', result.ok, true);
  eq('cooked no fallback', result.fallbackToCoach, false);

  resetStores();
  result = executeProgramControlAction(baseAction(
    'set_fatigue_status',
    { date: todayISO, todayISO, level: 'sore' },
    { scope: 'today_only', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    todayISO,
  });
  eq('sore succeeds', result.ok, true);
  eq('sore no fallback', result.fallbackToCoach, false);
  ok('sore creates training adjusted note', notes.some((note) => note.title === 'Training adjusted'));
}

console.log('\n[9] guided status category changes replace the old status note');
{
  resetStores();
  const todayISO = todayISOLocal();
  executeProgramControlAction(baseAction(
    'set_fatigue_status',
    { date: todayISO, todayISO, level: 'cooked' },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  let notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  const loadNote = notes.find((note) => note.title === 'Load reduced this week');
  ok('starts from load-reduction note', Boolean(loadNote));

  const clearResult = executeProgramControlAction(baseAction('clear_active_modifier', {
    noteId: loadNote?.id ?? '',
  }));
  const recoveryResult = executeProgramControlAction(baseAction(
    'set_recovery_mode',
    { date: todayISO, todayISO, recoveryScope: 'week' },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });

  eq('old status clear succeeds', clearResult.ok, true);
  eq('new recovery status succeeds', recoveryResult.ok, true);
  ok('old load note is gone', !notes.some((note) => note.title === 'Load reduced this week'));
  ok('new recovery note appears', notes.some((note) => note.title === 'Recovery mode active'));
  eq('only one status modifier remains', notes.length, 1);
}

console.log('\n[10] remove exercise today-only stays out of Coach and future modifiers');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  const result = executeProgramControlAction(baseAction(
    'remove_exercise',
    { date, exercise: 'Bench Press', exerciseId: 'we-bench-press' },
    { scope: 'today_only', oneOffOnly: true },
  ));
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
  });

  eq('remove today succeeds', result.ok, true);
  eq('remove today no fallback', result.fallbackToCoach, false);
  ok('bench removed from override', !overrideExerciseNames(date).includes('Bench Press'));
  eq('no future constraints created', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('no Coach Notes created', notes, []);
}

console.log('\n[11] remove exercise future-weeks creates active modifier');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  const result = executeProgramControlAction(baseAction(
    'remove_exercise',
    { date, exercise: 'Bench Press', exerciseId: 'we-bench-press', futureWeeksToo: true },
    { scope: 'current_and_future', createsActiveModifier: true, oneOffOnly: false },
  ));
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
  });

  eq('remove future succeeds', result.ok, true);
  eq('remove future no fallback', result.fallbackToCoach, false);
  ok('bench removed from today override', !overrideExerciseNames(date).includes('Bench Press'));
  ok('bench excluded for future', useAthletePreferencesStore.getState().prefs.excluded.includes('Bench Press'));
  ok('Coach Notes includes bench modifier', notes.some((note) => note.title === 'Bench Press adjustment active'));
}

console.log('\n[12] swap exercise with deterministic replacement stays out of Coach');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  const result = executeProgramControlAction(baseAction(
    'swap_exercise',
    {
      date,
      fromExercise: 'Bench Press',
      fromExerciseId: 'we-bench-press',
      toExercise: {
        name: 'DB Floor Press',
        sets: 3,
        repsMin: 8,
        repsMax: 10,
      },
    },
    { scope: 'today_only', oneOffOnly: true },
  ));

  eq('swap succeeds', result.ok, true);
  eq('swap no fallback', result.fallbackToCoach, false);
  ok('replacement appears', overrideExerciseNames(date).includes('DB Floor Press'));
  ok('original removed', !overrideExerciseNames(date).includes('Bench Press'));
}

console.log('\n[13] injury/pain swap can apply a safer guided replacement');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  const result = executeProgramControlAction(baseAction(
    'swap_exercise',
    {
      date,
      fromExercise: 'Back Squat',
      fromExerciseId: 'we-back-squat',
      toExercise: {
        name: 'Goblet Squat',
        sets: 3,
        repsMin: 8,
        repsMax: 10,
      },
    },
    { scope: 'today_only', oneOffOnly: true },
  ));

  eq('injury-style swap succeeds', result.ok, true);
  eq('injury-style swap no fallback', result.fallbackToCoach, false);
  ok('safer replacement appears', overrideExerciseNames(date).includes('Goblet Squat'));
}

console.log('\n[14] partial guided swap payload keeps a renderable prescription');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  const result = executeProgramControlAction(baseAction(
    'swap_exercise',
    {
      date,
      fromExercise: 'Back Squat',
      fromExerciseId: 'we-back-squat',
      toExercise: { name: 'Hip Thrust' } as any,
    },
    { scope: 'today_only', oneOffOnly: true },
  ));
  const replacement = overrideExerciseRows(date).find((row: any) => row.exercise?.name === 'Hip Thrust');

  eq('partial swap succeeds', result.ok, true);
  eq('partial swap no fallback', result.fallbackToCoach, false);
  eq('replacement inherits sets', replacement?.prescribedSets, 3);
  eq('replacement inherits reps min', replacement?.prescribedRepsMin, 6);
  eq('replacement inherits reps max', replacement?.prescribedRepsMax, 8);
}

console.log('\n[15] add exercise adds one block and refuses duplicates');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  let result = executeProgramControlAction(baseAction(
    'add_exercise',
    {
      date,
      exercise: {
        name: 'Pallof Press',
        sets: 2,
        repsMin: 10,
        repsMax: 12,
        perSide: true,
      },
    },
    { scope: 'today_only', oneOffOnly: true },
  ));
  eq('add succeeds', result.ok, true);
  eq('add no fallback', result.fallbackToCoach, false);
  ok('added exercise appears', overrideExerciseNames(date).includes('Pallof Press'));

  result = executeProgramControlAction(baseAction(
    'add_exercise',
    {
      date,
      exercise: {
        name: 'Pallof Press',
        sets: 2,
        repsMin: 10,
        repsMax: 12,
      },
    },
    { scope: 'today_only', oneOffOnly: true },
  ));
  eq('duplicate add is refused', result.ok, false);
  eq('duplicate add no fallback', result.fallbackToCoach, false);
}

console.log('\n[16] partial guided add payload keeps a renderable prescription');
{
  resetStores();
  const date = '2026-07-06';
  seedStrengthWorkout(date);
  const result = executeProgramControlAction(baseAction(
    'add_exercise',
    {
      date,
      exercise: { name: 'Dead Bug' } as any,
    },
    { scope: 'today_only', oneOffOnly: true },
  ));
  const added = overrideExerciseRows(date).find((row: any) => row.exercise?.name === 'Dead Bug');

  eq('partial add succeeds', result.ok, true);
  eq('partial add no fallback', result.fallbackToCoach, false);
  eq('partial add default sets', added?.prescribedSets, 2);
  eq('partial add default reps min', added?.prescribedRepsMin, 8);
  eq('partial add default reps max', added?.prescribedRepsMax, 12);
}

console.log('\n[17] add exercise preference supports future add-focus modifiers');
{
  resetStores();
  const result = executeProgramControlAction(baseAction(
    'add_exercise_preference',
    {
      exercise: 'Pallof Press',
      alternative: 'Pallof Press',
      focus: 'core',
      preferenceKind: 'add_focus',
    },
    { scope: 'future_weeks', createsActiveModifier: true, oneOffOnly: false },
  ));
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
  });

  eq('future add-focus succeeds', result.ok, true);
  eq('future add-focus no fallback', result.fallbackToCoach, false);
  ok('pinned exercise stored', useAthletePreferencesStore.getState().prefs.pinned.includes('Band Pallof Press'));
  ok('future add-focus note appears', notes.some((note) => /Pallof Press|Extra Pallof Press/.test(note.title)));
}

console.log('\n[18] busy-week schedule modifier stays out of Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  const result = executeProgramControlAction(baseAction(
    'set_schedule_modifier',
    {
      date: todayISO,
      todayISO,
      severity: 5,
      reasonLabel: 'Busy week',
    },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });

  eq('busy-week modifier succeeds', result.ok, true);
  eq('busy-week no fallback', result.fallbackToCoach, false);
  ok('busy-week modifier reported', (result.createdModifierIds ?? []).length === 1);
  ok('Coach Notes includes busy-week modifier', notes.some((note) => note.title === 'Busy week active'));
}

console.log('\n[19] guided mild injury creates an active modifier without Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  const constraint = buildGuidedInjuryConstraint({
    region: 'lower_body',
    area: 'Calf / Achilles',
    severity: 2,
    severityBand: 'mild',
    adjustmentLevel: 'minimal',
    triggers: ['Running'],
    seriousSymptoms: false,
  }, { todayISO });
  const result = executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });

  eq('mild injury succeeds', result.ok, true);
  eq('mild injury no Coach fallback', result.fallbackToCoach, false);
  eq('mild adjustment level saved', (useCoachUpdatesStore.getState().activeConstraints[0] as any)?.adjustmentLevel, 'minimal');
  ok('mild injury note appears', notes.some((note) => note.title === 'Calf / Achilles issue active'));
}

console.log('\n[20] guided moderate injury saves triggers without Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  const constraint = buildGuidedInjuryConstraint({
    region: 'lower_body',
    area: 'Hip / groin',
    severity: 7,
    severityBand: 'moderate',
    adjustmentLevel: 'moderate',
    triggers: ['Sprinting', 'Change of direction'],
    seriousSymptoms: false,
  }, { todayISO });
  const result = executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });
  const stored = useCoachUpdatesStore.getState().activeConstraints[0] as any;
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });

  eq('moderate injury succeeds', result.ok, true);
  eq('moderate injury no Coach fallback', result.fallbackToCoach, false);
  eq('moderate adjustment level saved', stored.adjustmentLevel, 'moderate');
  eq('triggers saved', stored.triggers, ['Sprinting', 'Change of direction']);
  ok('moderate note body includes triggers', /sprinting and change of direction/.test(notes[0]?.body ?? ''), notes[0]?.body);
}

console.log('\n[21] 8-10 guided injury pauses affected work without rehab or Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  const constraint = buildGuidedInjuryConstraint({
    region: 'upper_body',
    area: 'Shoulder',
    severity: 9,
    severityBand: 'avoid',
    adjustmentLevel: 'training_paused',
    triggers: [],
    seriousSymptoms: false,
  }, { todayISO });
  const result = executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });

  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });

  eq('8-10 pause succeeds', result.ok, true);
  eq('8-10 pause no Coach fallback', result.fallbackToCoach, false);
  eq('8-10 does not set diagnostic serious symptom flag', (useCoachUpdatesStore.getState().activeConstraints[0] as any)?.seriousSymptoms, false);
  eq('8-10 adjustment level saved', (useCoachUpdatesStore.getState().activeConstraints[0] as any)?.adjustmentLevel, 'training_paused');
  eq('8-10 note title', notes[0]?.title, 'Training paused for injury');
  eq(
    '8-10 note body',
    notes[0]?.body,
    "You rated this as 8-10 / 10, so affected training is paused until you're ready or cleared to train.",
  );
  ok('no rehab prescription is stored', !/rehab/i.test([...constraint.rules, ...constraint.safeFocus, ...constraint.advice].join(' ')));
}

console.log('\n[22] training-paused injury note clears without Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  const constraint = buildGuidedInjuryConstraint({
    region: 'lower_body',
    area: 'Knee',
    severity: 10,
    severityBand: 'avoid',
    adjustmentLevel: 'training_paused',
    triggers: [],
    seriousSymptoms: false,
  }, { todayISO });
  executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  const result = executeProgramControlAction(baseAction('clear_active_modifier', {
    noteId: notes[0]?.id ?? '',
  }));

  eq('training-paused note title', notes[0]?.title, 'Training paused for injury');
  eq('training-paused note clear action', notes[0]?.actions[0]?.label, "I've been cleared");
  eq('clear training-paused note succeeds', result.ok, true);
  eq('clear training-paused note no Coach fallback', result.fallbackToCoach, false);
  eq('training-paused constraint removed', useCoachUpdatesStore.getState().activeConstraints, []);
}

console.log('\n[23] update injury replaces the existing modifier instead of duplicating');
{
  resetStores();
  const todayISO = todayISOLocal();
  const first = buildGuidedInjuryConstraint({
    region: 'lower_body',
    area: 'Hamstring',
    severity: 5,
    severityBand: 'slight',
    adjustmentLevel: 'slight',
    triggers: ['Running'],
    seriousSymptoms: false,
  }, { todayISO });
  executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint: first },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });
  const updated = buildGuidedInjuryConstraint({
    region: 'lower_body',
    area: 'Hamstring',
    severity: 7,
    severityBand: 'moderate',
    adjustmentLevel: 'moderate',
    triggers: ['Sprinting', 'Kicking'],
    seriousSymptoms: false,
  }, { todayISO, existingId: first.id });
  const result = executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint: updated },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });
  const active = useCoachUpdatesStore.getState().activeConstraints as any[];

  eq('update succeeds', result.ok, true);
  eq('update no Coach fallback', result.fallbackToCoach, false);
  eq('still one active injury', active.length, 1);
  eq('existing id retained', active[0]?.id, first.id);
  eq('severity updated', active[0]?.severityBand, 'moderate');
  eq('triggers updated', active[0]?.triggers, ['Sprinting', 'Kicking']);
}

console.log('\n[24] clear guided injury removes the note without Coach');
{
  resetStores();
  const todayISO = todayISOLocal();
  const constraint = buildGuidedInjuryConstraint({
    region: 'back_midline',
    area: 'Lower back',
    severity: 5,
    severityBand: 'slight',
    adjustmentLevel: 'slight',
    triggers: ['Hinging / bending'],
    seriousSymptoms: false,
  }, { todayISO });
  executeProgramControlAction(baseAction(
    'set_injury_modifier',
    { constraint },
    { scope: 'current_and_future', createsActiveModifier: true },
  ), { todayISO });
  const note = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  })[0];
  const result = executeProgramControlAction(baseAction('clear_active_modifier', {
    noteId: note.id,
  }));

  eq('clear injury succeeds', result.ok, true);
  eq('clear injury no Coach fallback', result.fallbackToCoach, false);
  eq('active constraints empty after clear', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('notes empty after clear', selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  }), []);
}

console.log('\n[25] busy-week schedule modifier creates a Coach Note (no chat)');
{
  resetStores();
  const todayISO = todayISOLocal();
  const result = executeProgramControlAction(baseAction(
    'set_schedule_modifier',
    { date: todayISO, todayISO, severity: 5, reasonLabel: 'Busy week' },
    { scope: 'current_week', createsActiveModifier: true },
  ), { todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  eq('busy create succeeds', result.ok, true);
  eq('no Coach fallback', result.fallbackToCoach, false);
  ok('busy-week Coach Note appears', notes.some((note) => note.title === 'Busy week active'));
  ok('busy id keyed to the week', (result.createdModifierIds ?? [])[0] === scheduleModifierIdForDate(todayISO, 'busy'));
}

console.log('\n[26] busy and away schedule ids are distinct');
{
  const todayISO = todayISOLocal();
  ok('ids differ', scheduleModifierIdForDate(todayISO, 'busy') !== scheduleModifierIdForDate(todayISO, 'away'));
  ok('away id namespaced', /tap-schedule-away:/.test(scheduleModifierIdForDate(todayISO, 'away')));
}

console.log('\nSummary');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
