(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  clearActiveCoachNote,
  selectActiveCoachNotes,
} from '../utils/activeCoachNotes';
import {
  buildGameChangeCoachNoteConstraint,
  upsertGameChangeCoachNoteFromDiff,
  type GameChangeVisibleDay,
} from '../utils/gameChangeCoachNotes';
import {
  useCoachUpdatesStore,
  type ActiveConstraint,
  type ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import type { ActiveProgramModifierVisibleDay } from '../utils/activeProgramModifiers';
import type { Workout } from '../types/domain';

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
}

function row(
  date: string,
  workoutName: string | null,
  workoutType: string | null = workoutName ? 'Strength' : null,
  sessionTier: string | null = workoutName ? 'core' : null,
): GameChangeVisibleDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    workoutName,
    workoutType,
    sessionTier,
  };
}

function visibleFromRows(rows: readonly GameChangeVisibleDay[]): ActiveProgramModifierVisibleDay[] {
  return rows.map((candidate) => ({
    date: candidate.date,
    dayOfWeek: candidate.dayOfWeek,
    workout: candidate.workoutName
      ? {
          name: candidate.workoutName,
          description: candidate.workoutName,
          workoutType: candidate.workoutType as Workout['workoutType'],
          sessionTier: candidate.sessionTier as Workout['sessionTier'],
          coachNotes: [],
          exercises: [],
        } as any
      : null,
  }));
}

function deloadDay(date: string, weekKind: 'build' | 'deload'): ActiveProgramModifierVisibleDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    workout: {
      name: 'Lower Strength',
      description: 'Lower Strength',
      workoutType: 'Strength',
      sessionTier: 'core',
      coachNotes: ['Deload week: volume reduced and intensity pulled back.'],
      exercises: [{
        exercise: { name: 'Back Squat' },
        notes: weekKind === 'deload'
          ? 'Deload week: keep RPE 6-7; leave reps in reserve.'
          : undefined,
      }] as any,
    } as any,
  };
}

function injury(id: string, bodyPart: string, bucket: ActiveInjuryConstraint['bucket']): ActiveInjuryConstraint {
  return {
    id,
    type: 'injury',
    bodyPart,
    bucket,
    severity: 6,
    status: 'active',
    startDate: '2026-07-13T00:00:00Z',
    lastUpdatedAt: '2026-07-13T00:00:00Z',
    rules: [],
    safeFocus: [],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
  };
}

function fatigue(): ActiveConstraint {
  return {
    id: 'fatigue-cooked',
    type: 'fatigue',
    severity: 8,
    status: 'active',
    startDate: '2026-07-13T00:00:00Z',
    lastUpdatedAt: '2026-07-13T00:00:00Z',
    modifierTitle: 'Load reduced this week',
    rules: ['hard conditioning'],
    safeFocus: ['easy aerobic'],
    advice: [],
    modifierAffects: ['current_week'],
  } as ActiveConstraint;
}

function changedWeek() {
  const before = [
    row('2026-07-13', 'Lower body strength'),
    row('2026-07-14', 'Team training'),
    row('2026-07-15', 'Easy Aerobic Flush', 'Conditioning', 'optional'),
    row('2026-07-16', 'Upper Strength'),
    row('2026-07-17', 'Lower body strength + conditioning'),
    row('2026-07-18', 'Game Day', 'Game', 'game'),
    row('2026-07-19', 'Recovery Session', 'Recovery', 'recovery'),
  ];
  const after = [
    row('2026-07-13', 'Lower body strength'),
    row('2026-07-14', 'Team training'),
    row('2026-07-15', 'Easy Aerobic Flush', 'Conditioning', 'optional'),
    row('2026-07-16', 'Upper Strength'),
    row('2026-07-17', 'Gunshow', 'Strength', 'optional'),
    row('2026-07-18', 'Game Day', 'Game', 'game'),
    row('2026-07-19', 'Recovery Session', 'Recovery', 'recovery'),
  ];
  return { before, after };
}

const WEEK_START = '2026-07-13';
const NEXT_WEEK = '2026-07-20';

console.log('coachNoteLifecycleTests');

console.log('\n[1] game/practice notes expire and stay week-scoped');
{
  resetStores();
  const { before, after } = changedWeek();
  const constraint = buildGameChangeCoachNoteConstraint({
    action: 'added',
    fixtureKind: 'game',
    targetDate: '2026-07-18',
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: WEEK_START,
  })!;

  const currentWeekNotes = selectActiveCoachNotes({
    activeConstraints: [constraint],
    visibleWeekDays: visibleFromRows(after),
    todayISO: WEEK_START,
  });
  eq('game note appears in affected week', currentWeekNotes.length, 1);

  eq('game note expires after affected week', selectActiveCoachNotes({
    activeConstraints: [constraint],
    visibleWeekDays: visibleFromRows(after),
    todayISO: NEXT_WEEK,
  }), []);

  const unrelatedFutureWeek = visibleFromRows(after.map((candidate) => ({
    ...candidate,
    date: candidate.date.replace('2026-07-1', '2026-07-2'),
  })));
  eq('game note does not show on unrelated future week', selectActiveCoachNotes({
    activeConstraints: [constraint],
    visibleWeekDays: unrelatedFutureWeek,
    todayISO: WEEK_START,
  }), []);
}

console.log('\n[2] game note update/dedupe and stale visible proof suppression');
{
  resetStores();
  const { before, after } = changedWeek();
  upsertGameChangeCoachNoteFromDiff({
    action: 'added',
    fixtureKind: 'game',
    targetDate: '2026-07-18',
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: WEEK_START,
  });
  const movedAgainAfter = [
    ...after.slice(0, 5),
    row('2026-07-18', 'Gunshow', 'Strength', 'optional'),
    row('2026-07-19', 'Game Day', 'Game', 'game'),
  ];
  upsertGameChangeCoachNoteFromDiff({
    action: 'moved',
    fixtureKind: 'game',
    previousDate: '2026-07-18',
    targetDate: '2026-07-19',
    weekStartISO: WEEK_START,
    before: after,
    after: movedAgainAfter,
    todayISO: WEEK_START,
  });
  eq('moving game twice keeps one active game-change owner',
    useCoachUpdatesStore.getState().activeConstraints.map((c) => c.id),
    [`game-change-${WEEK_START}`]);
  const updatedNotes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    visibleWeekDays: visibleFromRows(movedAgainAfter),
    todayISO: WEEK_START,
  });
  eq('updated game note renders once', updatedNotes.length, 1);
  ok('updated game note uses latest copy', /moved from Saturday to Sunday/i.test(updatedNotes[0]?.body ?? ''), updatedNotes[0]);

  const staleVisibleWeek = visibleFromRows(after);
  eq('stale game note with mismatched visible proof is suppressed', selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    visibleWeekDays: staleVisibleWeek,
    todayISO: WEEK_START,
  }), []);

  const duplicateA = buildGameChangeCoachNoteConstraint({
    action: 'added',
    fixtureKind: 'game',
    targetDate: '2026-07-18',
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: WEEK_START,
  })!;
  const duplicateB = {
    ...duplicateA,
    id: 'game-change-duplicate',
    modifierBody: 'Latest duplicate copy. Friday was kept light to protect game day.',
  };
  const deduped = selectActiveCoachNotes({
    activeConstraints: [duplicateA, duplicateB],
    visibleWeekDays: visibleFromRows(after),
    todayISO: WEEK_START,
  });
  eq('duplicate notes with same owner/week/source are deduped', deduped.length, 1);
  ok('dedupe keeps the latest duplicate copy', /Latest duplicate copy/.test(deduped[0]?.body ?? ''), deduped[0]);
}

console.log('\n[3] deload lifecycle stays generated and non-clearable');
{
  const deloadNotes = selectActiveCoachNotes({
    weekKind: 'deload',
    visibleWeekDays: [deloadDay('2026-07-27', 'deload')],
    todayISO: '2026-07-27',
  });
  eq('deload note appears with proof', deloadNotes.length, 1);
  eq('deload note has no misleading clear action', deloadNotes[0]?.actions, []);
  eq('deload note disappears on build week', selectActiveCoachNotes({
    weekKind: 'build',
    visibleWeekDays: [deloadDay('2026-07-27', 'build')],
    todayISO: '2026-07-27',
  }), []);
}

console.log('\n[4] clearing user-owned notes removes only their source');
{
  resetStores();
  const shoulder = injury('injury-shoulder', 'Shoulder', 'shoulder');
  const knee = injury('injury-knee', 'Knee', 'knee');
  useCoachUpdatesStore.getState().setActiveConstraints([shoulder, knee]);
  const shoulderNotes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    visibleWeekDays: [{
      date: WEEK_START,
      workout: {
        name: 'Upper Strength',
        workoutType: 'Strength',
        sessionTier: 'core',
        coachNotes: ['Removed: Overhead Press'],
        exercises: [{ exercise: { name: 'Goblet Squat' } }] as any,
      } as any,
    }],
    todayISO: WEEK_START,
  });
  const shoulderNote = shoulderNotes.find((note) => note.title === 'Shoulder issue active');
  ok('shoulder note has visible effect', shoulderNote, shoulderNotes);
  const clearShoulder = clearActiveCoachNote(shoulderNote?.id ?? '');
  eq('clearing injury note reports shoulder source', clearShoulder.cleared?.sourceId, 'injury-shoulder');
  eq('clearing injury note leaves unrelated modifier',
    useCoachUpdatesStore.getState().activeConstraints.map((c) => c.id),
    ['injury-knee']);

  useCoachUpdatesStore.getState().setActiveConstraints([knee, fatigue()]);
  const fatigueNotes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    visibleWeekDays: [{
      date: WEEK_START,
      workout: {
        name: 'Conditioning',
        workoutType: 'Conditioning',
        sessionTier: 'optional',
        coachNotes: ['Removed: Assault Bike Intervals'],
        exercises: [],
      } as any,
    }],
    todayISO: WEEK_START,
  });
  const fatigueNote = fatigueNotes.find((note) => /cooked|flat|Readiness|Load reduced/i.test(`${note.title} ${note.body}`));
  ok('readiness note appears with visible effect', fatigueNote, fatigueNotes);
  const clearFatigue = clearActiveCoachNote(fatigueNote?.id ?? '');
  eq('clearing readiness note reports fatigue source', clearFatigue.cleared?.sourceId, 'fatigue-cooked');
  eq('clearing readiness note leaves unrelated modifier',
    useCoachUpdatesStore.getState().activeConstraints.map((c) => c.id),
    ['injury-knee']);
}

console.log('\n[5] healthy normal generation has no fake notes');
{
  resetStores();
  eq('empty healthy snapshot stays silent', selectActiveCoachNotes({
    activeConstraints: [],
    activeInjury: null,
    weekKind: 'build',
    visibleWeekDays: [visibleFromRows([row(WEEK_START, 'Lower body strength')])[0]],
    todayISO: WEEK_START,
  }), []);
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
