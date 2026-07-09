(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  selectActiveCoachNotes,
} from '../utils/activeCoachNotes';
import {
  selectActiveProgramModifiers,
  type ActiveProgramModifierVisibleDay,
} from '../utils/activeProgramModifiers';
import type { ActiveConstraint, ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';

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

function day(
  date: string,
  name: string,
  coachNotes: string[] = [],
  exerciseNames: string[] = [],
): ActiveProgramModifierVisibleDay {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
    workout: {
      name,
      workoutType: /recovery/i.test(name) ? 'Recovery' : 'Strength',
      sessionTier: /recovery/i.test(name) ? 'recovery' : 'core',
      coachNotes,
      exercises: exerciseNames.map((exerciseName) => ({
        exercise: { name: exerciseName },
      })) as any,
    } as any,
  };
}

function injury(
  bodyPart: string,
  bucket: ActiveInjuryConstraint['bucket'],
  severity: number,
  overrides: Partial<ActiveInjuryConstraint> = {},
): ActiveInjuryConstraint {
  return {
    id: `injury-${bodyPart.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'injury',
    bodyPart,
    bucket,
    severity,
    status: 'active',
    startDate: '2026-07-06T00:00:00Z',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    rules: [],
    safeFocus: [],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
    ...overrides,
  };
}

function fatigue(severity: number, title = 'Load reduced this week'): ActiveConstraint {
  return {
    id: `fatigue-${severity}`,
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: '2026-07-06T00:00:00Z',
    lastUpdatedAt: '2026-07-06T00:00:00Z',
    reasonLabel: title,
    source: 'readiness',
    rules: ['hard conditioning + sprints', 'extra optional work'],
    safeFocus: ['Easy aerobic conditioning'],
    advice: [],
    modifierTitle: title,
    modifierAffects: ['current_week'],
  } as ActiveConstraint;
}

const TODAY = '2026-07-06';

console.log('injuryReadinessCoachNotesTests');

console.log('\n[1] hamstring notes require sprint/hinge/Nordic visible changes');
{
  resetStores();
  const hammy = injury('Hamstring', 'hamstring', 6);
  const changedWeek = [
    day(TODAY, 'Lower Strength', [
      'Removed: Flying 30m Sprints',
      'Removed: Nordic Curl',
      'Focus: Easy aerobic conditioning',
    ], ['Bench Press', 'Easy Bike']),
  ];
  const notes = selectActiveCoachNotes({
    activeConstraints: [hammy],
    visibleWeekDays: changedWeek,
    todayISO: TODAY,
  });
  eq('hamstring change creates one note', notes.length, 1);
  ok('hamstring note mentions sprint reduction', /sprinting was reduced/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('hamstring note mentions hinge or Nordics', /hinging or Nordics/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('hamstring note preserves safe work copy from visible week', /Upper-body, bike or core work stayed in/i.test(notes[0]?.body ?? ''), notes[0]);

  eq('zero-diff hamstring injury creates no note', selectActiveCoachNotes({
    activeConstraints: [hammy],
    visibleWeekDays: [day(TODAY, 'Upper Strength', [], ['Bench Press'])],
    todayISO: TODAY,
  }), []);
}

console.log('\n[2] shoulder notes only claim pressing/overhead changes');
{
  resetStores();
  const shoulder = injury('Shoulder', 'shoulder', 6);
  const notes = selectActiveCoachNotes({
    activeConstraints: [shoulder],
    visibleWeekDays: [
      day(TODAY, 'Upper Strength', [
        'Replaced Bench Press with DB Floor Press',
        'Removed: Overhead Press',
      ], ['Goblet Squat', 'Easy Bike', 'Side Plank']),
    ],
    todayISO: TODAY,
  });
  eq('shoulder change creates one note', notes.length, 1);
  ok('shoulder note mentions pressing/overhead', /pressing or overhead work was reduced or swapped/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('shoulder note mentions safe lower-bike-core work', /Lower-body, bike or core work stayed in/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('shoulder note does not invent sprint changes', !/sprint|hinge|Nordic/i.test(notes[0]?.body ?? ''), notes[0]);
}

console.log('\n[3] knee notes only claim knee/COD/jumping changes');
{
  resetStores();
  const knee = injury('Knee', 'knee', 5);
  const notes = selectActiveCoachNotes({
    activeConstraints: [knee],
    visibleWeekDays: [
      day(TODAY, 'Lower Strength', [
        'Removed: Box Jumps',
        'Caution: Back Squat',
      ], ['Bench Press', 'Assault Bike']),
    ],
    todayISO: TODAY,
  });
  eq('knee change creates one note', notes.length, 1);
  ok('knee note mentions knee/jump/COD reduction', /knee-dominant, jumping or COD work was reduced/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('knee note does not invent pressing changes', !/pressing|overhead/i.test(notes[0]?.body ?? ''), notes[0]);
}

console.log('\n[3b] severe injury notes mention affected pause only when true');
{
  resetStores();
  const severe = injury('Lower back', 'lowerBack', 9, {
    adjustmentLevel: 'training_paused',
  });
  const notes = selectActiveCoachNotes({
    activeConstraints: [severe],
    visibleWeekDays: [
      day(TODAY, 'Recovery Session', [
        'Switched to recovery (injury)',
        'Removed: Deadlift',
      ]),
    ],
    todayISO: TODAY,
  });
  eq('severe injury creates one note', notes.length, 1);
  ok('severe injury mentions affected training pause', /affected training was paused or reduced/i.test(notes[0]?.body ?? ''), notes[0]);
}

console.log('\n[4] cooked readiness notes require hard work reduction');
{
  resetStores();
  const cooked = fatigue(8, 'Load reduced this week');
  const notes = selectActiveCoachNotes({
    activeConstraints: [cooked],
    visibleWeekDays: [
      day(TODAY, 'Conditioning', [
        'Removed: Assault Bike Intervals',
        'Caution: Trap Bar Deadlift',
      ]),
    ],
    todayISO: TODAY,
  });
  eq('cooked readiness creates one note', notes.length, 1);
  ok('cooked note says cooked', /cooked/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('cooked note mentions hard conditioning reduced', /hard conditioning or sprint work was reduced/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('cooked note does not claim injury changes', !/hamstring|shoulder|knee issue/i.test(notes[0]?.body ?? ''), notes[0]);
}

console.log('\n[5] tired/flat notes require extras or intensity trimmed');
{
  resetStores();
  const todaySignal = {
    date: TODAY,
    energy: 'low' as const,
    flatToday: true,
    updatedAt: '2026-07-06T08:00:00Z',
  };
  const notes = selectActiveCoachNotes({
    readinessSignalsByDate: { [TODAY]: todaySignal },
    visibleWeekDays: [
      day(TODAY, 'Strength', [
        'Removed: Finisher',
        'Caution: Lateral Raise',
      ]),
    ],
    todayISO: TODAY,
  });
  eq('flat readiness creates one note', notes.length, 1);
  ok('flat note says flat today', /flat today/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('flat note mentions extras/intensity trimmed', /extras, accessories or intensity were trimmed/i.test(notes[0]?.body ?? ''), notes[0]);

  eq('zero-diff flat readiness creates no note', selectActiveCoachNotes({
    readinessSignalsByDate: { [TODAY]: todaySignal },
    visibleWeekDays: [day(TODAY, 'Strength', [], ['Bench Press'])],
    todayISO: TODAY,
  }), []);
}

console.log('\n[6] CN-1 metadata and healthy weeks');
{
  resetStores();
  const shoulder = injury('Shoulder', 'shoulder', 6);
  const modifiers = selectActiveProgramModifiers({
    activeConstraints: [shoulder],
    visibleWeekDays: [
      day(TODAY, 'Upper Strength', ['Removed: Overhead Press']),
    ],
    todayISO: TODAY,
  });
  eq('injury note has valid CN-1 affects metadata', modifiers[0]?.affects, ['current_week', 'future_generation']);
  eq('healthy normal generation has no fake notes', selectActiveCoachNotes({
    activeConstraints: [],
    activeInjury: null,
    visibleWeekDays: [day(TODAY, 'Lower Strength', [], ['Back Squat'])],
    todayISO: TODAY,
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
