(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import {
  buildActiveCoachNotes,
  selectActiveCoachNotes,
  clearActiveCoachNote,
} from '../utils/activeCoachNotes';
import { selectActiveProgramModifiers } from '../utils/activeProgramModifiers';
import {
  buildBusyWeekConstraintFromIntent,
  buildFatigueConstraintFromIntent,
  buildSorenessConstraintFromIntent,
} from '../utils/coachConstraintProducers';
import {
  buildActiveEquipmentConstraint,
  resolveEquipmentAvailability,
  upsertActiveEquipmentConstraint,
} from '../utils/equipmentAvailability';
import type { CoachIntent, CoachIntentKind } from '../utils/coachIntent';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import {
  useCoachUpdatesStore,
  type ActiveConstraint,
  type ActiveEquipmentConstraint,
  type ActivePreferenceConstraint,
} from '../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { useReadinessStore } from '../store/readinessStore';
import type { Workout } from '../types/domain';
import { todayISOLocal } from '../utils/appDate';
import {
  banExerciseGlobally,
  setPreferredAlternative,
} from '../utils/coachActions';
import {
  upsertTapLoadReductionModifier,
  upsertTapRecoveryModeModifier,
  withActiveProgramModifierContext,
} from '../utils/tapProgramModifiers';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';

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

function intent(kind: CoachIntentKind, payload: Record<string, any> = {}): CoachIntent {
  return {
    intent: kind,
    confidence: 1,
    needsClarification: false,
    payload,
  };
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
  useProgramStore.setState({
    dateOverrides: {},
    overrideContexts: {},
  } as any);
  useProfileStore.setState({
    onboardingData: { trainingLocation: 'Commercial gym' },
  } as any);
}

function injury(id: string, bodyPart: string, severity: number): ActiveConstraint {
  return {
    id,
    type: 'injury',
    bodyPart,
    bucket: bodyPart === 'groin' ? 'adductor' : 'shoulder',
    severity,
    status: 'active',
    startDate: '2026-07-06T00:00:00Z',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    rules: ['sprinting', 'change of direction'],
    safeFocus: [],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
  } as ActiveConstraint;
}

function fatigue(severity: number): ActiveConstraint {
  return {
    id: 'fatigue-active',
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: '2026-07-06T00:00:00Z',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    rules: ['max-effort lifts', 'hard conditioning + sprints'],
    safeFocus: ['Easy aerobic conditioning'],
    advice: [],
    modifierAffects: ['current_week'],
  };
}

function preference(): ActivePreferenceConstraint {
  return {
    id: 'preference-preferred_alternative-bench-press-db-bench-press',
    type: 'preference',
    preferenceKind: 'preferred_alternative',
    label: 'Replace Bench Press with DB Bench Press where appropriate.',
    exercise: 'Bench Press',
    alternative: 'DB Bench Press',
    severity: 0,
    status: 'active',
    startDate: '2026-07-06',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    rules: ['Replace Bench Press with DB Bench Press where appropriate.'],
    safeFocus: [],
    advice: [],
  };
}

function scheduleRestriction(): ActiveConstraint {
  return {
    id: 'schedule-busy-week',
    type: 'schedule',
    severity: 5,
    status: 'active',
    startDate: '2026-07-06T00:00:00Z',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    reasonLabel: 'Unavailable day adjustment active',
    source: 'coach',
    rules: ['Friday unavailable', 'reduced sprint exposure'],
    safeFocus: ['Short, targeted sessions'],
    advice: [],
    modifierAffects: ['current_week'],
  };
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

function visibleChangedWorkout(
  date: string,
  coachNotes: string[],
  exerciseName = 'Trap Bar Deadlift',
): ActiveProgramModifierVisibleDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    workout: {
      id: `workout-${date}`,
      microcycleId: 'test-microcycle',
      dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
      name: 'Lower Strength',
      description: 'Lower Strength',
      durationMinutes: 60,
      intensity: 'Moderate',
      workoutType: 'Strength',
      sessionTier: 'core',
      coachNotes,
      exercises: [{ exercise: { name: exerciseName } }] as any,
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
    } as any,
  };
}

console.log('activeCoachNotesTests');

console.log('\n[1] hidden when no active modifiers exist');
{
  resetStores();
  eq('empty active constraints produce no notes', buildActiveCoachNotes([]), []);
  eq(
    'resolved constraints are hidden',
    buildActiveCoachNotes([{ ...fatigue(5), status: 'resolved' } as ActiveConstraint]),
    [],
  );
}

console.log('\n[1b] truth gate suppresses profile facts and zero-diff notes');
{
  resetStores();
  const profileOnlyNotes = selectActiveCoachNotes({
    onboardingData: {
      firstName: 'Sam',
      position: 'Midfielder',
      seasonPhase: 'Pre-season',
      goals: ['speed'],
      teamTrainingDays: ['Tuesday', 'Thursday'],
      gameDay: 'Saturday',
      trainingLocation: 'Commercial gym',
    } as any,
    todayISO: '2026-07-06',
  });
  eq('normal onboarding/profile facts produce no notes', profileOnlyNotes, []);
  eq('normal season/team/game facts by themselves produce no notes', profileOnlyNotes, []);

  const withProof = fatigue(7) as ActiveConstraint & { modifierAffects?: unknown };
  const { modifierAffects: _effectProof, ...withoutProof } = withProof;
  eq(
    'zero-diff active constraint does not create a new note',
    buildActiveCoachNotes([withoutProof as ActiveConstraint]),
    [],
  );
  eq(
    'claimed change without effect proof is suppressed',
    buildActiveCoachNotes([{
      ...withoutProof,
      modifierTitle: 'Load reduced this week',
      modifierBody: 'Your week has been adjusted.',
    } as ActiveConstraint]),
    [],
  );

  const notes = buildActiveCoachNotes([fatigue(7)]);
  ok('legitimate note with visible-effect proof is preserved', notes.some((note) => note.title === 'Recovery mode active'));
}

console.log('\n[2] note read model preserves active constraint types');
{
  resetStores();
  const notes = buildActiveCoachNotes([
    injury('injury-groin', 'groin', 6),
    fatigue(7),
    preference(),
    scheduleRestriction(),
  ]);
  eq('four active constraints produce four notes', notes.length, 4);
  eq('injury title names selected body part', notes[0].title, 'Groin issue active');
  ok('injury body includes severity', /6\/10/.test(notes[0].body), notes[0].body);
  ok('injury body includes trigger/rule detail', /sprinting/.test(notes[0].body), notes[0].body);
  eq('injury clear action label', notes[0].actions[0].label, "I'm all good now");
  eq('fatigue action label', notes[1].actions[0].label, "I'm good now");
  eq('preference note type', notes[2].type, 'exercise_adjustment');
  ok('preference body names affected exercise', /Bench Press/.test(notes[2].body), notes[2].body);
  eq('schedule restriction note type', notes[3].type, 'coach_restriction');
  eq('schedule restriction clear action label', notes[3].actions[0].label, 'Clear adjustment');
}

console.log('\n[2b] chat-created active constraints with visible effects create Coach Notes');
{
  resetStores();
  const todayISO = '2026-07-06';
  const nowISO = '2026-07-06T09:00:00.000Z';

  const tired = buildFatigueConstraintFromIntent(
    intent('fatigue', { severity: 5 }),
    nowISO,
    { userMessage: "I'm tired today", selectedDateISO: todayISO },
  );
  const tiredNotes = selectActiveCoachNotes({
    activeConstraints: [tired],
    todayISO,
    visibleWeekDays: [
      visibleChangedWorkout(todayISO, ['Caution: reduced accessories today.']),
    ],
  });
  ok('chat tired constraint creates visible note when it changes program',
    tiredNotes.some((note) => note.title === 'Recovery mode active'));
  eq('tired today expiry is end of day', tired.expiresAt, todayISO);

  const sore = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'quads', severity: 4 }),
    nowISO,
    { userMessage: 'quads are sore today', selectedDateISO: todayISO },
  );
  ok('soreness producer resolved quads', !!sore);
  const soreNotes = selectActiveCoachNotes({
    activeConstraints: sore ? [sore] : [],
    todayISO,
    visibleWeekDays: [
      visibleChangedWorkout(todayISO, ['Caution: reduced hard conditioning for quads soreness.']),
    ],
  });
  ok('chat soreness constraint creates visible note when it changes program',
    soreNotes.some((note) => note.title === 'Quads soreness active'));
  eq('mild soreness expiry is end of day', sore?.expiresAt, todayISO);

  const cooked = buildFatigueConstraintFromIntent(
    intent('fatigue', { severity: 8 }),
    nowISO,
    { userMessage: "I'm cooked this week", selectedDateISO: todayISO },
  );
  const cookedNotes = selectActiveCoachNotes({
    activeConstraints: [cooked],
    todayISO,
    visibleWeekDays: [
      visibleChangedWorkout(todayISO, ['Caution: reduced hard conditioning and optional volume.']),
    ],
  });
  ok('cooked/load-reduced constraint creates visible note',
    cookedNotes.some((note) => note.title === 'Load reduced this week'));

  const busy = buildBusyWeekConstraintFromIntent(
    intent('busy_week', { severity: 7 }),
    nowISO,
    { userMessage: 'busy week at work', selectedDateISO: todayISO },
  );
  const busyNotes = selectActiveCoachNotes({
    activeConstraints: [busy],
    todayISO,
    visibleWeekDays: [
      visibleChangedWorkout(todayISO, ['Caution: limited week, optional accessories reduced.']),
    ],
  });
  ok('busy week constraint creates visible note',
    busyNotes.some((note) => note.title === 'Busy week adjustment active'));

  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hamstring',
    bucket: 'hamstring',
    severity: 6,
    initialSeverity: 6,
    status: 'active',
    rules: ['sprinting'],
    startDate: nowISO,
    lastUpdatedAt: nowISO,
    createdAt: nowISO,
    history: [],
  });
  const injuryConstraint = useCoachUpdatesStore.getState().activeConstraints.find(
    (constraint) => constraint.type === 'injury',
  ) as ActiveConstraint | undefined;
  eq('chat injury mirror has visible-affect metadata',
    (injuryConstraint as any)?.modifierAffects, ['current_week', 'future_generation']);
  eq('chat injury does not auto-expire like tiredness',
    (injuryConstraint as any)?.expiresAt, undefined);
  const injuryNotes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
    visibleWeekDays: [
      visibleChangedWorkout(todayISO, ['Removed: sprinting reduced for hamstring issue.']),
    ],
  });
  ok('chat injury creates visible note when it affects program',
    injuryNotes.some((note) => note.title === 'Hamstring issue active'));
}

console.log('\n[2c] expired and cleared chat constraints stop affecting the program');
{
  resetStores();
  const todayISO = '2026-07-06';
  const nextDayISO = '2026-07-07';
  const nowISO = '2026-07-06T09:00:00.000Z';
  const tired = buildFatigueConstraintFromIntent(
    intent('fatigue', { severity: 5 }),
    nowISO,
    { userMessage: "I'm tired today", selectedDateISO: todayISO },
  );
  eq('expired tired note hidden next day', selectActiveCoachNotes({
    activeConstraints: [tired],
    todayISO: nextDayISO,
    visibleWeekDays: [
      visibleChangedWorkout(todayISO, ['Caution: reduced accessories today.']),
    ],
  }), []);
  eq('expired tired constraint excluded from generation context',
    buildGenerationConstraintContext({ activeConstraints: [tired], todayISO: nextDayISO }),
    undefined);

  const cooked = buildFatigueConstraintFromIntent(
    intent('fatigue', { severity: 8 }),
    nowISO,
    { userMessage: "I'm cooked this week", selectedDateISO: todayISO },
  );
  useCoachUpdatesStore.getState().setActiveConstraints([cooked]);
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  ok('load-reduced note exists before clear', notes.some((note) => note.title === 'Load reduced this week'));
  const note = notes.find((candidate) => candidate.title === 'Load reduced this week');
  const result = clearActiveCoachNote(note?.id ?? '');
  eq('cleared chat status source', result.cleared?.sourceId, cooked.id);
  eq('clearing note removes active constraint', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('clearing note removes generation effect',
    buildGenerationConstraintContext({
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
      todayISO,
    }),
    undefined);
}

console.log('\n[2d] equipment constraints create truthful Coach Notes and clear with rebuild');
{
  resetStores();
  const todayISO = '2026-07-06';
  const profile = { trainingLocation: 'Commercial gym', equipment: ['Full Gym'] } as any;
  const bodyweightOnly = buildActiveEquipmentConstraint({
    id: 'equipment-bodyweight-only',
    mode: 'only',
    tags: ['bodyweight'],
    source: 'chat',
    nowISO: '2026-07-06T09:00:00.000Z',
    scope: 'this_week',
    modifierAffects: ['current_week'],
  });
  const upsertResult = upsertActiveEquipmentConstraint(bodyweightOnly);
  const modifiers = selectActiveProgramModifiers({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  const note = notes.find((candidate) => candidate.constraintId === bodyweightOnly.id);

  eq('creating equipment constraint reports rebuild metadata', upsertResult.rebuildRequired, true);
  ok('active equipment constraint creates visible Coach Note', Boolean(note));
  eq('equipment note has valid modifierAffects',
    modifiers.find((modifier) => modifier.sourceId === bodyweightOnly.id)?.affects,
    ['current_week']);
  ok('bodyweight-only copy is truthful',
    /Bodyweight-only training active until Sunday/.test(note?.body ?? ''),
    note?.body);

  const clearResult = clearActiveCoachNote(note?.id ?? '');
  eq('clearing equipment note reports rebuild metadata', clearResult.rebuildRequired, true);
  eq('clearing equipment note clears backing constraint', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('no orphan equipment note after clear',
    selectActiveCoachNotes({ activeConstraints: useCoachUpdatesStore.getState().activeConstraints, todayISO }),
    []);
  ok('cleared equipment constraint no longer affects resolved availability',
    resolveEquipmentAvailability(profile, useCoachUpdatesStore.getState().activeConstraints, todayISO).includes('barbell'));

  const noBarbell = buildActiveEquipmentConstraint({
    id: 'equipment-no-barbell',
    mode: 'without',
    tags: ['barbell'],
    source: 'tap',
    nowISO: '2026-07-06T09:00:00.000Z',
    scope: 'open_ended',
    modifierAffects: ['current_week', 'future_generation'],
  });
  useCoachUpdatesStore.getState().setActiveConstraints([noBarbell]);
  const noBarbellNote = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  })[0];
  eq('without-barbell note title is truthful', noBarbellNote.title, 'No barbell available');
  ok('without-barbell note copy is truthful future-tense',
    /Barbell lifts will be swapped where needed/.test(noBarbellNote.body),
    noBarbellNote.body);

  const futureOnly = buildActiveEquipmentConstraint({
    id: 'equipment-future-db-only',
    mode: 'only',
    tags: ['dumbbells'],
    source: 'system',
    nowISO: '2026-07-06T09:00:00.000Z',
    scope: 'open_ended',
    modifierAffects: ['future_generation'],
  });
  useCoachUpdatesStore.getState().setActiveConstraints([futureOnly]);
  const futureNote = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  })[0];
  ok('no current visible proof uses future-tense copy',
    /Future sessions will use bodyweight\/dumbbell options until you clear this/.test(futureNote.body),
    futureNote.body);
  ok('future-only copy does not falsely claim a completed swap',
    !/\b(swapped|replaced|removed)\b/i.test(futureNote.body),
    futureNote.body);

  const expired = {
    ...bodyweightOnly,
    id: 'equipment-expired',
    expiresAt: '2026-07-05',
  } as ActiveEquipmentConstraint;
  eq('expired equipment constraint does not show note',
    selectActiveCoachNotes({ activeConstraints: [expired], todayISO }),
    []);

  eq('normal baseline equipment setup does not create persistent note',
    selectActiveCoachNotes({ onboardingData: profile, todayISO }),
    []);
}

console.log('\n[3] clearing one injury leaves other active injuries alone');
{
  resetStores();
  useCoachUpdatesStore.getState().setActiveConstraints([
    injury('injury-groin', 'groin', 6),
    injury('injury-shoulder', 'shoulder', 5),
  ]);
  const note = buildActiveCoachNotes(
    useCoachUpdatesStore.getState().activeConstraints,
  ).find((candidate) => candidate.title === 'Groin issue active');
  const result = clearActiveCoachNote(note?.id ?? '');
  eq('clear reports selected source id', result.cleared?.sourceId, 'injury-groin');
  eq(
    'only shoulder remains',
    useCoachUpdatesStore.getState().activeConstraints.map((c) => c.id),
    ['injury-shoulder'],
  );
}

console.log('\n[4] legacy activeInjury alias still renders and clears');
{
  resetStores();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'groin',
    bucket: 'adductor',
    severity: 6,
    initialSeverity: 6,
    status: 'active',
    rules: ['sprinting'],
    startDate: '2026-07-06T00:00:00Z',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    createdAt: '2026-07-06T00:00:00Z',
    history: [],
  });
  useCoachUpdatesStore.setState({ activeConstraints: [] } as any);
  const notes = buildActiveCoachNotes(
    useCoachUpdatesStore.getState().activeConstraints,
    useCoachUpdatesStore.getState().activeInjury,
  );
  eq('legacy activeInjury produces an injury note', notes[0]?.title, 'Groin issue active');
  const result = clearActiveCoachNote(notes[0].id);
  eq('legacy activeInjury clear reports injury', result.cleared?.type, 'injury');
  eq('legacy activeInjury is nulled', useCoachUpdatesStore.getState().activeInjury, null);
}

console.log('\n[4b] clearing the last injury flushes current/future injury effects only');
{
  resetStores();
  const todayISO = todayISOLocal();
  const futureInjuryDate = '9999-12-31';
  const futureBusyDate = '9999-12-30';
  const pastInjuryDate = '2000-01-01';
  const equipment = buildActiveEquipmentConstraint({
    id: 'equipment-stays-active',
    mode: 'without',
    tags: ['barbell'],
    source: 'tap',
    nowISO: `${todayISO}T09:00:00.000Z`,
    scope: 'open_ended',
    modifierAffects: ['current_week', 'future_generation'],
  });
  useCoachUpdatesStore.getState().setActiveConstraints([
    injury('injury-clear-future', 'groin', 6),
    fatigue(7),
    scheduleRestriction(),
    equipment,
  ]);
  useProgramStore.getState().setManualOverride(todayISO, restWorkout(todayISO), {
    intent: 'injury',
    label: 'current injury override',
  });
  useProgramStore.getState().setManualOverride(futureInjuryDate, restWorkout(futureInjuryDate), {
    intent: 'injury',
    label: 'future injury override',
  });
  useProgramStore.getState().setManualOverride(pastInjuryDate, restWorkout(pastInjuryDate), {
    intent: 'injury',
    label: 'past injury history',
  });
  useProgramStore.getState().setManualOverride(
    futureBusyDate,
    restWorkout(futureBusyDate),
    withActiveProgramModifierContext(
      { intent: 'program_adjustment', label: 'busy override' },
      'schedule-busy-week',
    ),
  );

  const injuryNote = buildActiveCoachNotes(
    useCoachUpdatesStore.getState().activeConstraints,
  ).find((note) => note.constraintId === 'injury-clear-future');
  clearActiveCoachNote(injuryNote?.id ?? '');

  const program = useProgramStore.getState();
  ok('current injury override is cleared', !program.dateOverrides[todayISO]);
  ok('future injury override is cleared', !program.dateOverrides[futureInjuryDate]);
  ok('past injury history is preserved', !!program.dateOverrides[pastInjuryDate]);
  ok('unrelated busy override is preserved', !!program.dateOverrides[futureBusyDate]);
  eq('unrelated modifiers remain active',
    useCoachUpdatesStore.getState().activeConstraints.map((constraint) => constraint.id).sort(),
    ['equipment-stays-active', 'fatigue-active', 'schedule-busy-week']);
}

console.log('\n[5] clearing future exercise preference updates Profile-backed state');
{
  resetStores();
  const pref = preference();
  useAthletePreferencesStore.getState().addExclusion('Bench Press');
  useAthletePreferencesStore.getState().addPinned('DB Bench Press');
  useCoachUpdatesStore.getState().setActiveConstraints([pref]);
  const note = buildActiveCoachNotes(
    useCoachUpdatesStore.getState().activeConstraints,
  )[0];
  const result = clearActiveCoachNote(note.id);
  eq('preference cleared from coach constraints', result.cleared?.sourceId, pref.id);
  eq('active constraints now empty', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('exercise exclusion removed', useAthletePreferencesStore.getState().prefs.excluded, []);
  eq('pinned alternative removed', useAthletePreferencesStore.getState().prefs.pinned, []);
}

console.log('\n[6] hidden program-consumed sources become Coach Notes');
{
  resetStores();
  useAthletePreferencesStore.getState().addExclusion('Nordic Curl');
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
    bikeLabel: 'Assault Bike',
  });
  useProfileStore.setState({
    onboardingData: {
      trainingLocation: 'Commercial gym',
      availabilityConstraints: [{
        id: 'avail-thu',
        kind: 'unavailable_day',
        scope: 'temporary',
        dayOfWeek: 'Thursday',
        startDate: '2026-07-06',
        endDate: '2026-07-20',
        active: true,
      }],
    },
  } as any);
  const todayISO = todayISOLocal();
  useReadinessStore.getState().setReadinessSignal(todayISO, {
    energy: 'low',
    flatToday: true,
  });

  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    activeInjury: useCoachUpdatesStore.getState().activeInjury,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    onboardingData: useProfileStore.getState().onboardingData,
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    todayISO,
  });
  ok('athlete excluded exercise appears', notes.some((note) => /Nordic Curl/.test(note.title)));
  ok('modality preference appears', notes.some((note) => /Easy Aerobic Flush/.test(note.title)));
  ok('availability constraint appears', notes.some((note) => /Thursday unavailable/.test(note.title)));
  ok('readiness training adjustment appears', notes.some((note) => /Training adjusted/.test(note.title)));
}

console.log('\n[7] clearing hidden program-consumed modifiers stops their source');
{
  resetStores();
  useAthletePreferencesStore.getState().addExclusion('Nordic Curl');
  let note = selectActiveCoachNotes({
    athletePrefs: useAthletePreferencesStore.getState().prefs,
  }).find((candidate) => /Nordic Curl/.test(candidate.title));
  let result = clearActiveCoachNote(note?.id ?? '');
  eq('athlete pref clear requires rebuild', result.rebuildRequired, true);
  eq('athlete pref source cleared', useAthletePreferencesStore.getState().prefs.excluded, []);

  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
    bikeLabel: 'Assault Bike',
  });
  note = selectActiveCoachNotes({
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
  })[0];
  result = clearActiveCoachNote(note.id);
  eq('modality preference source cleared', useCoachPreferencesStore.getState().modalityPreferences, {});

  useProfileStore.setState({
    onboardingData: {
      trainingLocation: 'Commercial gym',
      availabilityConstraints: [{
        id: 'avail-thu',
        kind: 'unavailable_day',
        scope: 'temporary',
        dayOfWeek: 'Thursday',
        active: true,
      }],
    },
  } as any);
  note = selectActiveCoachNotes({
    onboardingData: useProfileStore.getState().onboardingData,
  })[0];
  result = clearActiveCoachNote(note.id);
  eq('availability clear requires rebuild', result.rebuildRequired, true);
  eq(
    'availability source cleared',
    useProfileStore.getState().onboardingData.availabilityConstraints ?? [],
    [],
  );

  const todayISO = todayISOLocal();
  useReadinessStore.getState().setReadinessSignal(todayISO, {
    energy: 'low',
    flatToday: true,
  });
  note = selectActiveCoachNotes({
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    todayISO,
  })[0];
  result = clearActiveCoachNote(note.id);
  eq('readiness source cleared', useReadinessStore.getState().signalsByDate, {});
}

console.log('\n[8] permanent coach preference actions register active modifiers');
{
  resetStores();
  let result = banExerciseGlobally({ exercise: 'RDL' });
  ok('ban exercise action succeeds', result.success);
  let notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
  });
  ok('ban exercise action creates visible modifier', notes.some((note) => /RDLs/.test(note.title)));

  resetStores();
  result = setPreferredAlternative({ exercise: 'Bench Press', alternative: 'DB Bench Press' });
  ok('preferred alternative action succeeds', result.success);
  notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
  });
  ok('preferred alternative action creates visible modifier', notes.some((note) => /Bench Press/.test(note.title)));
}

console.log('\n[8b] guided injury Coach Notes use minor and paused-training copy');
{
  resetStores();
  const todayISO = todayISOLocal();
  const minor = buildGuidedInjuryConstraint({
    region: 'lower_body',
    area: 'Hip / groin',
    severity: 7,
    severityBand: 'moderate',
    adjustmentLevel: 'moderate',
    triggers: ['Sprinting', 'Change of direction'],
    seriousSymptoms: false,
  }, { todayISO });
  const paused = buildGuidedInjuryConstraint({
    region: 'back_midline',
    area: 'Neck',
    severity: 9,
    severityBand: 'avoid',
    adjustmentLevel: 'training_paused',
    triggers: [],
    seriousSymptoms: false,
  }, { todayISO, existingId: 'injury-paused-neck' });
  const notes = selectActiveCoachNotes({
    activeConstraints: [minor, paused],
    todayISO,
  });
  const minorNote = notes.find((note) => note.constraintId === minor.id);
  const pausedNote = notes.find((note) => note.constraintId === paused.id);

  eq('two guided injury notes stack', notes.length, 2);
  eq('minor action clear label', minorNote?.actions[0]?.label, "I'm all good now");
  eq('minor action update label', minorNote?.actions[1]?.label, 'Update injury');
  ok('minor body includes severity/triggers', /moderate hip \/ groin issue triggered by sprinting and change of direction/.test(minorNote?.body ?? ''), minorNote?.body);
  eq('paused note title', pausedNote?.title, 'Training paused for injury');
  eq(
    'paused note body',
    pausedNote?.body,
    "You rated this as 8-10 / 10, so affected training is paused until you're ready or cleared to train.",
  );
  eq('paused clear label', pausedNote?.actions[0]?.label, "I've been cleared");
  eq('paused update label', pausedNote?.actions[1]?.label, 'Update issue');
}

console.log('\n[9] Program tab renders Coach Notes below week list without chat routing');
{
  const homePath = path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx');
  const hookPath = path.resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts');
  const sheetPath = path.resolve(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx');
  const homeSrc = fs.readFileSync(homePath, 'utf8');
  const hookSrc = fs.readFileSync(hookPath, 'utf8');
  const sheetSrc = fs.readFileSync(sheetPath, 'utf8');
  ok('HomeScreenV2 mounts CoachNotesSection', /<CoachNotesSection[\s\S]*notes=\{coachNotes\}/.test(homeSrc));
  ok(
    'CoachNotesSection is placed before No game CTA',
    /<CoachNotesSection[\s\S]*\/>\s*\n\s*\{\/\* ── No game CTA/.test(homeSrc),
  );
  ok('Program note section has testID', /testID="program-active-coach-notes"/.test(homeSrc));
  ok('clear confirmation copy present', /Clear and update program/.test(homeSrc));
  const sheetBlock = homeSrc.slice(
    homeSrc.indexOf('function CoachNoteSheet'),
    homeSrc.indexOf('interface GameDaySheetProps'),
  );
  ok('CoachNoteSheet does not navigate to CoachTab', !/CoachTab|handleQuickAction|onAskCoach/.test(sheetBlock));
  ok('useHomeScreen exposes active note selector', /selectActiveCoachNotes\(\{[\s\S]*activeConstraints[\s\S]*modalityPreferences[\s\S]*readinessSignalsByDate/.test(hookSrc));
  ok('useHomeScreen clear action uses ProgramControlAction', /executeProgramControlAction\(\{[\s\S]*type:\s*'clear_active_modifier'/.test(hookSrc));
  ok('PlanChangeSheet routes recovery status through ProgramControlAction', /executeProgramControlAction\(\{[\s\S]*type:\s*'set_recovery_mode'/.test(sheetSrc));
  ok('PlanChangeSheet routes fatigue status through ProgramControlAction', /executeProgramControlAction\(\{[\s\S]*type:\s*'set_fatigue_status'/.test(sheetSrc));
  ok('CoachNoteSheet offers guided status update options', /How are you feeling now\?[\s\S]*Still sick[\s\S]*Still cooked[\s\S]*Worse/.test(homeSrc));
  ok(
    'guided status category changes clear the previous status note first',
    /currentStatusKind[\s\S]*nextStatusKind[\s\S]*clearCoachNoteAction\(noteId\)/.test(hookSrc),
  );
  ok(
    'Coach Notes update injury opens guided injury flow',
    /action\.kind === 'update_injury'[\s\S]*setInjuryFlowNote\(note\)/.test(homeSrc) &&
      /<GuidedInjuryFlowSheet[\s\S]*initial=\{injuryFlowInitial\}/.test(homeSrc),
  );
  ok(
    'training-paused clear confirmation copy is present',
    /Resume normal training\?[\s\S]*Only clear this if you've been checked/.test(homeSrc),
  );
}

console.log('\n[9b] Program/Home quick actions use guided no-chat fallbacks');
{
  const classicPath = path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreen.tsx');
  const quickSheetPath = path.resolve(__dirname, '..', 'screens', 'home', 'HomeQuickActionSheet.tsx');
  const constantsPath = path.resolve(__dirname, '..', 'screens', 'home', 'homeScreenConstants.ts');
  const equipmentSheetPath = path.resolve(__dirname, '..', 'screens', 'home', 'EquipmentLimitationSheet.tsx');
  const stalePath = path.resolve(__dirname, '..', 'components', 'StaleOverrideBanner.tsx');
  const hookPath = path.resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts');
  const sheetPath = path.resolve(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx');
  const injuryFlowPath = path.resolve(__dirname, '..', 'screens', 'home', 'GuidedInjuryFlowSheet.tsx');
  const classicSrc = fs.readFileSync(classicPath, 'utf8');
  const quickSheetSrc = fs.readFileSync(quickSheetPath, 'utf8');
  const constantsSrc = fs.readFileSync(constantsPath, 'utf8');
  const equipmentSheetSrc = fs.readFileSync(equipmentSheetPath, 'utf8');
  const staleSrc = fs.readFileSync(stalePath, 'utf8');
  const hookSrc = fs.readFileSync(hookPath, 'utf8');
  const sheetSrc = fs.readFileSync(sheetPath, 'utf8');
  const injuryFlowSrc = fs.readFileSync(injuryFlowPath, 'utf8');

  ok('quick actions carry typed ids', /export type HomeQuickActionId[\s\S]*'missed_session'[\s\S]*'busy_week'/.test(constantsSrc));
  ok('quick action chips open local sheet, not Coach prefill', /onPress=\{\(\) => setQuickActionSheet\(action\)\}/.test(classicSrc));
  ok('classic quick action chips do not pass action.prefill to Coach', !/handleMessageCoach\(action\.prefill\)|handleQuickAction\(action\.prefill\)/.test(classicSrc));
  ok('missed-session quick action has guided sheet', /testID="home-missed-session-sheet"[\s\S]*Move it to another day[\s\S]*Skip it[\s\S]*Replace it with recovery[\s\S]*Message the coach/.test(quickSheetSrc));
  ok('busy-week quick action has guided sheet', /testID="home-busy-week-sheet"[\s\S]*Reduce this week[\s\S]*Pick unavailable days[\s\S]*Keep program as-is[\s\S]*Message the coach/.test(quickSheetSrc));
  ok('missing-equipment quick action opens local equipment sheet',
    /action\.id === 'missing_equipment'[\s\S]*<EquipmentLimitationSheet/.test(quickSheetSrc));
  ok('temporary equipment sheet has preset options',
    /testID="home-equipment-limitation-sheet"[\s\S]*TEMPORARY_EQUIPMENT_PRESETS/.test(equipmentSheetSrc));
  ok('temporary equipment presets route through ProgramControlAction',
    /type:\s*'set_equipment_modifier'/.test(hookSrc));
  ok('busy-week reduction routes through ProgramControlAction', /type:\s*'set_schedule_modifier'/.test(hookSrc));
  ok('quick action detail fallback requires explicit Message coach tap', /I need a bit more detail[\s\S]*Message the coach[\s\S]*Cancel/.test(quickSheetSrc));
  ok('stale override Review opens a guided review sheet', /testID="stale-override-review-sheet"[\s\S]*Keep this change[\s\S]*Clear this change[\s\S]*Update this change[\s\S]*Message the coach/.test(staleSrc));
  ok('stale override only calls onReview from explicit Message handler', /const handleMessageCoach[\s\S]*onReview\?\.\(coachPrefill\)/.test(staleSrc));
  ok(
    'PlanChangeSheet injury path opens guided injury flow',
    /label="I'm injured"[\s\S]*setInjuryFlowVisible\(true\)/.test(sheetSrc),
  );
  ok(
    'PlanChangeSheet injury path no longer pre-fills Coach',
    !/label="I'm injured"[\s\S]*askCoachWith\("I'm injured/.test(sheetSrc),
  );
  ok(
    'Home quick action injury opens guided injury flow',
    /action\.id === 'injury'[\s\S]*<GuidedInjuryFlowSheet/.test(quickSheetSrc),
  );
  ok(
    'guided injury flow goes from area straight to severity',
    /setArea\(option\);[\s\S]*setStep\('severity'\)/.test(injuryFlowSrc) &&
      !/Any serious symptoms/.test(injuryFlowSrc),
  );
  ok(
    'guided injury flow sends 1-7 severity to triggers',
    /option\.adjustmentLevel === 'training_paused'[\s\S]*setStep\('stop_training'\)[\s\S]*setStep\('triggers'\)/.test(injuryFlowSrc),
  );
  ok(
    'guided injury flow sends 8-10 severity to stop-training path',
    /label: '8-10 \/ 10'[\s\S]*adjustmentLevel: 'training_paused'/.test(fs.readFileSync(
      path.resolve(__dirname, '..', 'utils', 'guidedInjuryControl.ts'),
      'utf8',
    )) && /Stop affected training[\s\S]*Pause affected training/.test(injuryFlowSrc),
  );
}

console.log('\n[10] tap-created recovery notes stack and clear their real program effect');
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
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
    bikeLabel: 'Assault Bike',
  });

  let notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    todayISO,
  });
  ok('recovery note appears', notes.some((note) => note.title === 'Recovery mode active'));
  ok('rower note still appears alongside recovery', notes.some((note) => /Easy Aerobic Flush/.test(note.title)));

  const recoveryNote = notes.find((note) => note.title === 'Recovery mode active');
  const result = clearActiveCoachNote(recoveryNote?.id ?? '');
  eq('cleared the recovery source', result.cleared?.sourceId, modifierId);
  eq('recovery active constraint removed', useCoachUpdatesStore.getState().activeConstraints, []);
  eq('linked rest override removed', useProgramStore.getState().dateOverrides, {});
  ok(
    'rower modifier source remains',
    Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length === 1,
  );

  notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    todayISO,
  });
  ok('recovery note gone after clear', !notes.some((note) => note.title === 'Recovery mode active'));
  ok('rower note remains after recovery clear', notes.some((note) => /Easy Aerobic Flush/.test(note.title)));
}

console.log('\n[11] cooked tap creates and clears a weekly load-reduction modifier');
{
  resetStores();
  const todayISO = todayISOLocal();
  const modifierId = upsertTapLoadReductionModifier({ date: todayISO, todayISO });
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO,
  });
  eq('load reduction title', notes[0]?.title, 'Load reduced this week');
  eq(
    'load reduction body',
    notes[0]?.body,
    'Your week has been adjusted because you said you were cooked.',
  );
  const result = clearActiveCoachNote(notes[0]?.id ?? '');
  eq('cleared the load source', result.cleared?.sourceId, modifierId);
  eq('load constraint removed', useCoachUpdatesStore.getState().activeConstraints, []);
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
