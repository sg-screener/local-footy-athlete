/**
 * visibleWorkoutDiffTests — pure unit tests for the visible-diff helper
 * that backs the "Program updated" reply gate.
 *
 * Run: npm run test:visible-diff
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  snapshotVisibleWorkout,
  visibleSnapshotsEqual,
  computeVisibleDiff,
} from '../utils/visibleWorkoutDiff';
import type { Workout } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

function w(name: string, exNames: string[] = [], coachNotes?: string[]): Workout {
  return {
    id: 'wk', microcycleId: 'mc', dayOfWeek: 0,
    name, description: '', durationMinutes: 60,
    intensity: 'Moderate' as any, workoutType: 'Strength' as any,
    sessionTier: 'core' as any,
    coachNotes,
    exercises: exNames.map((n, i) => ({
      id: `we-${i}`, workoutId: 'wk', exerciseId: `ex-${i}`,
      exerciseOrder: i, prescribedSets: 3, prescribedRepsMin: 6,
      prescribedRepsMax: 8, prescribedWeightKg: 0, restSeconds: 0,
      exercise: { id:`ex-${i}`, name: n, description: n, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' } as any,
      createdAt: '', updatedAt: '',
    })),
    createdAt: '', updatedAt: '',
  } as Workout;
}

// ─────────────────────────────────────────────────────────────────────
section('1. snapshotVisibleWorkout — null/missing safe defaults');
{
  const s = snapshotVisibleWorkout(null);
  eq('null → name=null', s.name, null);
  eq('null → empty exerciseNames', s.exerciseNames, []);
  eq('null → empty conditioning', s.conditioning, []);
  eq('null → empty coachNotes', s.coachNotes, []);
}

section('2. snapshotVisibleWorkout — captures the right fields');
{
  const s = snapshotVisibleWorkout(
    w('Lower Strength', ['Back Squat', 'RDLs'], ['no sprinting', 'lightened']),
  );
  eq('name', s.name, 'Lower Strength');
  // Order-stabilised + lower-cased.
  eq('exerciseNames sorted lowercase', s.exerciseNames, ['back squat', 'rdls']);
  eq('coachNotes sorted', s.coachNotes, ['lightened', 'no sprinting']);
}

section('3. visibleSnapshotsEqual — equality semantics');
{
  const a = snapshotVisibleWorkout(w('A', ['x', 'y']));
  const b = snapshotVisibleWorkout(w('A', ['y', 'x'])); // exercise order shouldn't matter
  eq('order-independent equality', visibleSnapshotsEqual(a, b), true);

  const c = snapshotVisibleWorkout(w('A', ['x', 'y'], ['n1']));
  const d = snapshotVisibleWorkout(w('A', ['x', 'y']));
  eq('coachNote presence breaks equality', visibleSnapshotsEqual(c, d), false);

  const e = snapshotVisibleWorkout(w('A', ['x']));
  const f = snapshotVisibleWorkout(w('A', ['x', 'y']));
  eq('different exercise list breaks equality', visibleSnapshotsEqual(e, f), false);

  const g = snapshotVisibleWorkout(w('A'));
  const h = snapshotVisibleWorkout(w('B'));
  eq('different name breaks equality', visibleSnapshotsEqual(g, h), false);
}

section('4. computeVisibleDiff — only changed dates surface');
{
  const before = {
    '2026-04-30': snapshotVisibleWorkout(w('Team Training')),
    '2026-05-01': snapshotVisibleWorkout(w('Lower Strength', ['Back Squat', 'RDLs'])),
  };
  const after = {
    '2026-04-30': snapshotVisibleWorkout(w('Team Training', [], ['no sprinting'])),
    '2026-05-01': snapshotVisibleWorkout(w('Lower Strength', ['Back Squat'], ['Removed: RDLs'])),
  };
  const diff = computeVisibleDiff(['2026-04-30', '2026-05-01'], before, after);
  eq('diff has 2 entries', diff.length, 2);
  ok(
    'Thu changedFields includes coachNotes',
    diff.find((d) => d.date === '2026-04-30')?.changedFields.includes('coachNotes') === true,
  );
  ok(
    'Fri changedFields includes exerciseNames + coachNotes',
    !!diff.find((d) => d.date === '2026-05-01')?.changedFields.includes('exerciseNames') &&
    !!diff.find((d) => d.date === '2026-05-01')?.changedFields.includes('coachNotes'),
  );
}

section('5. computeVisibleDiff — unchanged date returns nothing');
{
  // The mutator only changed `description` — which the visible snapshot
  // intentionally ignores. The diff should report NO visible change.
  const a = snapshotVisibleWorkout(w('A', ['x']));
  const b = snapshotVisibleWorkout(w('A', ['x']));
  const diff = computeVisibleDiff(['2026-04-30'], { '2026-04-30': a }, { '2026-04-30': b });
  eq('zero diff entries when nothing visible changed', diff.length, 0);
}

section('6. computeVisibleDiff — handles missing date entries');
{
  const before = { '2026-04-30': snapshotVisibleWorkout(w('A')) };
  const after = {}; // workout vanished
  const diff = computeVisibleDiff(['2026-04-30'], before, after);
  eq('vanished workout = visible change', diff.length, 1);
  eq('changedFields includes name', diff[0].changedFields, ['name']);
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
