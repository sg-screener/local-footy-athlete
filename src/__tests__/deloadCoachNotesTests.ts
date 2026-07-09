(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import {
  selectActiveProgramModifiers,
  type ActiveProgramModifierVisibleDay,
} from '../utils/activeProgramModifiers';
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

function day(args: {
  date: string;
  name: string;
  workoutType?: Workout['workoutType'];
  coachNotes?: string[];
  exercises?: Array<{ name: string; notes?: string; sets?: number }>;
  conditioningCategory?: Workout['conditioningCategory'];
  conditioningFlavour?: Workout['conditioningFlavour'];
}): ActiveProgramModifierVisibleDay {
  return {
    date: args.date,
    dayOfWeek: new Date(`${args.date}T12:00:00`).getDay(),
    workout: {
      name: args.name,
      description: args.name,
      workoutType: args.workoutType ?? 'Strength',
      sessionTier: args.workoutType === 'Recovery' ? 'recovery' : 'core',
      coachNotes: args.coachNotes ?? [],
      conditioningCategory: args.conditioningCategory,
      conditioningFlavour: args.conditioningFlavour,
      exercises: (args.exercises ?? []).map((exercise, index) => ({
        id: `${args.date}-${index}`,
        workoutId: `${args.date}-workout`,
        exerciseId: exercise.name.toLowerCase().replace(/\s+/g, '-'),
        exerciseOrder: index + 1,
        prescribedSets: exercise.sets ?? 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 8,
        restSeconds: 90,
        notes: exercise.notes,
        exercise: { name: exercise.name },
      })) as any,
      createdAt: `${args.date}T00:00:00Z`,
      updatedAt: `${args.date}T00:00:00Z`,
    } as any,
  };
}

const MONDAY = '2026-07-27';

console.log('deloadCoachNotesTests');

console.log('\n[1] deload notes require visible reduction proof');
{
  const visibleWeek = [
    day({
      date: MONDAY,
      name: 'Lower Strength',
      coachNotes: ['Deload week: volume reduced and intensity pulled back.'],
      exercises: [
        { name: 'Back Squat', notes: 'Deload week: keep RPE 6-7; leave reps in reserve.', sets: 2 },
        { name: 'Romanian Deadlift', notes: 'Deload week: keep RPE 6-7; leave reps in reserve.', sets: 2 },
      ],
    }),
    day({
      date: '2026-07-29',
      name: 'Easy Aerobic Flush',
      workoutType: 'Conditioning',
      conditioningCategory: 'aerobic_base',
      conditioningFlavour: 'aerobic',
      coachNotes: ['Easy recovery work stays in for the deload week.'],
      exercises: [{ name: 'Bike Flush', notes: 'Easy zone 2.' }],
    }),
  ];
  const notes = selectActiveCoachNotes({
    weekKind: 'deload',
    visibleWeekDays: visibleWeek,
    todayISO: MONDAY,
  });

  eq('deload week with proof creates one note', notes.length, 1);
  eq('deload note title', notes[0]?.title, 'Deload week active');
  ok('deload note mentions main strength preserved', /Main strength patterns stay in/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('deload note mentions volume reduction', /Sets or volume are reduced/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('deload note mentions intensity reduction', /Load or intensity is pulled back/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('deload note mentions easy recovery only when visible', /Easy recovery work stays in/i.test(notes[0]?.body ?? ''), notes[0]);
  eq('deload note is not clearable user state', notes[0]?.actions, []);
}

console.log('\n[2] copy only claims hard conditioning/accessories when proven');
{
  const notes = selectActiveCoachNotes({
    weekKind: 'deload',
    visibleWeekDays: [
      day({
        date: MONDAY,
        name: 'Upper Strength',
        coachNotes: [
          'Deload week: intensity pulled back.',
          'Removed: VO2 intervals.',
          'Accessories trimmed for lower fatigue.',
        ],
        exercises: [
          { name: 'Bench Press', notes: 'Deload week: keep RPE 6-7; leave reps in reserve.', sets: 2 },
        ],
      }),
    ],
    todayISO: MONDAY,
  });

  eq('specific deload note creates one note', notes.length, 1);
  ok('deload note mentions sprint/VO2/glycolytic removal when proven', /Sprint, VO2 or glycolytic work is out/i.test(notes[0]?.body ?? ''), notes[0]);
  ok('deload note mentions accessories trimmed when proven', /Accessories or finishers are trimmed/i.test(notes[0]?.body ?? ''), notes[0]);

  const lightOnlyNotes = selectActiveCoachNotes({
    weekKind: 'deload',
    visibleWeekDays: [
      day({
        date: MONDAY,
        name: 'Mobility Reset',
        workoutType: 'Recovery',
        coachNotes: ['Deload week: intensity pulled back.'],
        exercises: [{ name: 'Mobility Flow', notes: 'Deload week: keep RPE 6-7; leave reps in reserve.' }],
      }),
    ],
    todayISO: MONDAY,
  });
  ok('light-only deload does not claim main strength preserved', !/Main strength patterns stay in/i.test(lightOnlyNotes[0]?.body ?? ''), lightOnlyNotes[0]);
  ok('light-only deload does not claim hard conditioning removed', !/conditioning is out|Sprint, VO2/i.test(lightOnlyNotes[0]?.body ?? ''), lightOnlyNotes[0]);
  ok('light-only deload does not claim accessories trimmed', !/Accessories or finishers/i.test(lightOnlyNotes[0]?.body ?? ''), lightOnlyNotes[0]);
}

console.log('\n[3] zero-diff/build weeks stay silent');
{
  const noProofWeek = [
    day({
      date: MONDAY,
      name: 'Lower Strength',
      exercises: [{ name: 'Back Squat' }],
    }),
  ];
  eq('zero-diff deload creates no note', selectActiveCoachNotes({
    weekKind: 'deload',
    visibleWeekDays: noProofWeek,
    todayISO: MONDAY,
  }), []);

  const deloadMarkedBuildWeek = [
    day({
      date: MONDAY,
      name: 'Lower Strength',
      coachNotes: ['Deload week: volume reduced.'],
      exercises: [{ name: 'Back Squat', notes: 'Deload week: keep RPE 6-7; leave reps in reserve.' }],
    }),
  ];
  eq('build week creates no deload note', selectActiveCoachNotes({
    weekKind: 'build',
    visibleWeekDays: deloadMarkedBuildWeek,
    todayISO: MONDAY,
  }), []);

  eq('healthy normal generation has no fake notes', selectActiveCoachNotes({
    weekKind: 'build',
    visibleWeekDays: noProofWeek,
    todayISO: MONDAY,
  }), []);
}

console.log('\n[4] CN-1 affects metadata');
{
  const modifiers = selectActiveProgramModifiers({
    weekKind: 'deload',
    visibleWeekDays: [
      day({
        date: MONDAY,
        name: 'Lower Strength',
        coachNotes: ['Deload week: intensity pulled back.'],
        exercises: [{ name: 'Trap Bar Deadlift', notes: 'Deload week: keep RPE 6-7; leave reps in reserve.' }],
      }),
    ],
    todayISO: MONDAY,
  });
  eq('deload note has valid CN-1 affects metadata', modifiers[0]?.affects, ['current_week']);
  eq('deload note source is week kind', modifiers[0]?.source, 'week_kind');
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
