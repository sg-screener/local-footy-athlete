(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildGameChangeCoachNoteConstraint,
  upsertGameChangeCoachNoteFromDiff,
  type GameChangeVisibleDay,
} from '../utils/gameChangeCoachNotes';
import { dismissActiveCoachNote, selectActiveCoachNotes } from '../utils/activeCoachNotes';
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
    dismissedCoachNoteIds: [],
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

const WEEK_START = '2026-07-13';
const MON = '2026-07-13';
const TUE = '2026-07-14';
const WED = '2026-07-15';
const THU = '2026-07-16';
const FRI = '2026-07-17';
const SAT = '2026-07-18';
const SUN = '2026-07-19';

function baseWeek(): GameChangeVisibleDay[] {
  return [
    row(MON, 'Lower body strength'),
    row(TUE, 'Team training + Upper body pull', 'Strength', 'core'),
    row(WED, 'Easy Aerobic Flush', 'Conditioning', 'optional'),
    row(THU, 'Team training + Upper body push', 'Strength', 'core'),
    row(FRI, 'Lower body strength + conditioning', 'Strength', 'core'),
    row(SAT, 'Lower body strength + conditioning', 'Strength', 'core'),
    row(SUN, null),
  ];
}

console.log('gameChangeCoachNotesTests');

console.log('\n[1] adding Saturday practice match creates a diff-proved note');
{
  resetStores();
  const before = baseWeek();
  const after = [
    ...baseWeek().slice(0, 4),
    row(FRI, 'Gunshow', 'Strength', 'optional'),
    row(SAT, 'Game Day', 'Game', 'game'),
    row(SUN, 'Recovery Session', 'Recovery', 'recovery'),
  ];
  const constraint = buildGameChangeCoachNoteConstraint({
    action: 'added',
    fixtureKind: 'practice_match',
    targetDate: SAT,
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: MON,
  });
  ok('practice-match note is created', constraint);
  eq('note title', constraint?.modifierTitle, 'Practice match added');
  ok('note body names added practice match', /Added Saturday practice match/.test(constraint?.modifierBody ?? ''), constraint);
  ok('note body names G-1 protection', /Friday was kept light/.test(constraint?.modifierBody ?? ''), constraint);
  eq('note has CN-1 affects metadata', constraint?.modifierAffects, ['current_week']);
  eq('note scoped to affected week end', constraint?.expiresAt, SUN);

  const id = upsertGameChangeCoachNoteFromDiff({
    action: 'added',
    fixtureKind: 'practice_match',
    targetDate: SAT,
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: MON,
  });
  eq('upsert returns week-scoped id', id, `game-change-${WEEK_START}`);
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO: MON,
  });
  ok('note passes active Coach Notes truth gate', notes.some((note) => note.title === 'Practice match added'));
  eq('legacy after-state-only fixture note is Dismiss-only',
    notes[0]?.actions.map((action) => action.kind), ['dismiss_note']);
}

console.log('\n[2] zero-diff game/practice-match edit creates no note');
{
  resetStores();
  const before = [
    ...baseWeek().slice(0, 5),
    row(SAT, 'Game Day', 'Game', 'game'),
    row(SUN, 'Recovery Session', 'Recovery', 'recovery'),
  ];
  const id = upsertGameChangeCoachNoteFromDiff({
    action: 'added',
    fixtureKind: 'practice_match',
    targetDate: SAT,
    weekStartISO: WEEK_START,
    before,
    after: before,
    todayISO: MON,
  });
  eq('zero-diff upsert returns null', id, null);
  eq('zero-diff active notes remain empty', selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    todayISO: MON,
  }), []);
}

console.log('\n[3] moving game day creates concrete visible-effect copy');
{
  resetStores();
  const before = [
    ...baseWeek().slice(0, 5),
    row(SAT, 'Game Day', 'Game', 'game'),
    row(SUN, 'Recovery Session', 'Recovery', 'recovery'),
  ];
  const after = [
    ...baseWeek().slice(0, 5),
    row(SAT, 'Gunshow', 'Strength', 'optional'),
    row(SUN, 'Game Day', 'Game', 'game'),
  ];
  const constraint = buildGameChangeCoachNoteConstraint({
    action: 'moved',
    fixtureKind: 'game',
    previousDate: SAT,
    targetDate: SUN,
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: MON,
  });
  ok('moved-game note is created', constraint);
  ok('body names old and new game days', /Game moved from Saturday to Sunday/.test(constraint?.modifierBody ?? ''), constraint);
  ok('body names concrete Saturday protection', /Saturday was kept light/.test(constraint?.modifierBody ?? ''), constraint);
  ok('body does not claim future weeks changed', !/future|next week|future weeks/i.test(constraint?.modifierBody ?? ''), constraint);
}

console.log('\n[4] removing game creates a note only when the visible week changes');
{
  resetStores();
  const before = [
    ...baseWeek().slice(0, 5),
    row(SAT, 'Game Day', 'Game', 'game'),
    row(SUN, 'Recovery Session', 'Recovery', 'recovery'),
  ];
  const after = baseWeek();
  const constraint = buildGameChangeCoachNoteConstraint({
    action: 'removed',
    fixtureKind: 'game',
    targetDate: SAT,
    weekStartISO: WEEK_START,
    before,
    after,
    todayISO: MON,
  });
  ok('removed-game note is created when week changed', constraint);
  ok('body names Saturday changed away from game day', /Saturday changed from Game Day/.test(constraint?.modifierBody ?? ''), constraint);
  eq('zero-diff removal is suppressed', buildGameChangeCoachNoteConstraint({
    action: 'removed',
    fixtureKind: 'game',
    targetDate: SAT,
    weekStartISO: WEEK_START,
    before,
    after: before,
    todayISO: MON,
  }), null);
}

console.log('\n[5] ledger-backed fixture notes separate Restore from presentation-only Dismiss');
{
  resetStores();
  const before = [
    ...baseWeek().slice(0, 5),
    row(SAT, 'Game Day', 'Game', 'game'),
    row(SUN, 'Recovery Session', 'Recovery', 'recovery'),
  ];
  const after = [
    ...baseWeek().slice(0, 5),
    row(SAT, 'Gunshow', 'Strength', 'optional'),
    row(SUN, 'Game Day', 'Game', 'game'),
  ];
  const adjustmentId = 'reversible-adjustment:test:fixture-move:1';
  const id = upsertGameChangeCoachNoteFromDiff({
    action: 'moved', fixtureKind: 'game', previousDate: SAT, targetDate: SUN,
    weekStartISO: WEEK_START, before, after, todayISO: MON, adjustmentId,
  });
  eq('runtime fixture note uses exact adjustment identity', id, `game-change:${adjustmentId}`);
  const notes = selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    dismissedCoachNoteIds: useCoachUpdatesStore.getState().dismissedCoachNoteIds,
    todayISO: MON,
  });
  eq('runtime fixture note exposes Restore and Dismiss separately',
    notes[0]?.actions.map((action) => action.kind),
    ['restore_adjustment', 'dismiss_note']);
  const constraintsBefore = JSON.stringify(useCoachUpdatesStore.getState().activeConstraints);
  ok('presentation-only Dismiss succeeds', dismissActiveCoachNote(notes[0]?.id ?? ''));
  eq('Dismiss preserves the backing accepted projection',
    JSON.stringify(useCoachUpdatesStore.getState().activeConstraints), constraintsBefore);
  eq('Dismiss hides only the note', selectActiveCoachNotes({
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    dismissedCoachNoteIds: useCoachUpdatesStore.getState().dismissedCoachNoteIds,
    todayISO: MON,
  }), []);

  const secondId = 'reversible-adjustment:test:fixture-move:2';
  const second = buildGameChangeCoachNoteConstraint({
    action: 'moved', fixtureKind: 'game', previousDate: SAT, targetDate: SUN,
    weekStartISO: WEEK_START, before, after, todayISO: MON, adjustmentId: secondId,
  });
  ok('repeated same-week fixture changes keep separate identities',
    second?.id !== id && second?.id === `game-change:${secondId}`);
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
