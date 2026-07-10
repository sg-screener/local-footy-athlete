/**
 * Workout-log → progression context wiring tests.
 *
 * Run: npx sucrase-node src/__tests__/workoutLogProgressionWiringTests.ts
 *
 * Verifies progression prefers REAL logged set/reps/load where available and
 * falls back to the feedback snapshot when detailed logs are missing — for both
 * strength and conditioning — while respecting the finisher / recovery_addon /
 * team-training / component distinctions.
 */

import type { LoggedSet, Workout, WorkoutExercise } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import { buildStrengthPerformanceLogs, collectLoggedStrengthSets } from '../utils/strengthLogging';
import {
  buildStrengthWorkoutHistoryFromFeedback,
  deriveMissedStrengthSessionsThisWeek,
} from '../utils/strengthProgressionIntegration';
import { deriveConditioningProgressionInputOverrides } from '../utils/sessionBuilder';
import { shouldRecommendRepeatWeek } from '../utils/repeatWeek';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ok ${name}`); }
  else { fail++; failures.push(name); console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`); }
}

function strengthWorkout(): Workout {
  const ex = (name: string, id: string, order: number): WorkoutExercise => ({
    id, workoutId: 'w', exerciseId: name.toLowerCase(), exerciseOrder: order,
    prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5, prescribedWeightKg: 100,
    restSeconds: 180, exercise: { id: name.toLowerCase(), name, description: '' } as never,
    createdAt: '', updatedAt: '',
  });
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 1, name: 'Lower', description: '',
    durationMinutes: 60, intensity: 'Moderate', workoutType: 'Strength', sessionTier: 'core',
    exercises: [ex('Back Squat', 'we-1', 1)],
    createdAt: '', updatedAt: '',
  };
}

function loggedSet(n: number, reps: number, weight: number): LoggedSet {
  return {
    id: `s-${n}`, loggedWorkoutId: 'lw', workoutExerciseId: 'we-1', setNumber: n,
    actualReps: reps, actualWeightKg: weight, createdAt: '', updatedAt: '',
  };
}

// ── 1. buildStrengthPerformanceLogs captures actuals from real logged sets ──
{
  const logs = buildStrengthPerformanceLogs(
    strengthWorkout(), {}, 'full',
    { 'we-1': [loggedSet(1, 5, 102.5), loggedSet(2, 4, 102.5), loggedSet(3, 3, 100)] },
  );
  const squat = logs[0];
  ok('captures completed set count from logs', squat.completedSets === 3, String(squat.completedSets));
  ok('captures conservative (min) actual reps', squat.actualReps === 3, String(squat.actualReps));
  ok('captures top logged load over prescribed', squat.weightKg === 102.5, String(squat.weightKg));
}

// ── 2. Without logged sets → no actuals captured (fallback to prescribed) ──
{
  const logs = buildStrengthPerformanceLogs(strengthWorkout(), {}, 'full');
  ok('no logged sets → completedSets omitted', logs[0].completedSets === undefined);
  ok('no logged sets → actualReps omitted', logs[0].actualReps === undefined);
  ok('no logged sets → prescribed weight kept', logs[0].weightKg === 100);
}

// ── 3. Strength history prefers real logged reps/sets when snapshot carries them ──
function feedbackWithStrength(date: string, lift: Partial<SessionFeedback['strength'] extends (infer U)[] ? U : never>): SessionFeedback {
  return {
    dateStr: date, completion: 'full',
    strength: [{
      exerciseId: 'back squat', workoutExerciseId: 'we-1', exerciseName: 'Back Squat',
      prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5, weightKg: 100, completion: 'full',
      ...lift,
    }],
  };
}
{
  const fb = feedbackWithStrength('2026-07-06', { completedSets: 2, actualReps: 3, weightKg: 105 });
  const history = buildStrengthWorkoutHistoryFromFeedback({ '2026-07-06': fb }, '2026-07-13');
  const sets = history[0].sets;
  ok('history uses real logged set count (2, not prescribed 4)', sets.length === 2, String(sets.length));
  ok('history uses real logged reps (3, not prescribed 5)', sets.every((s) => s.actualReps === 3));
  ok('history uses real logged load', sets.every((s) => s.actualWeightKg === 105));
}

// ── 4. Fallback to feedback snapshot when logs are missing ──
{
  const fb = feedbackWithStrength('2026-07-06', {}); // no completedSets/actualReps
  const history = buildStrengthWorkoutHistoryFromFeedback({ '2026-07-06': fb }, '2026-07-13');
  const sets = history[0].sets;
  ok('fallback uses prescribed set count (4)', sets.length === 4, String(sets.length));
  ok('fallback uses prescribed reps (5)', sets.every((s) => s.actualReps === 5));
}

// ── 5. Partial completion reduces logged volume (holds, not over-progresses) ──
{
  const partial: SessionFeedback = { dateStr: '2026-07-06', completion: 'partial',
    strength: [{ exerciseId: 'back squat', workoutExerciseId: 'we-1', exerciseName: 'Back Squat',
      prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5, weightKg: 100, completion: 'partial' }] };
  const history = buildStrengthWorkoutHistoryFromFeedback({ '2026-07-06': partial }, '2026-07-13');
  ok('partial completion logs fewer sets than a full session', history[0].sets.length < 4 && history[0].sets.length >= 1, String(history[0].sets.length));
}

// ── 6. Skipped strength → no catch-up (0 sets, counted as a miss) ──
{
  const skipped: SessionFeedback = { dateStr: '2026-07-06', completion: 'skipped', strength: [] };
  const history = buildStrengthWorkoutHistoryFromFeedback({ '2026-07-06': skipped }, '2026-07-13');
  ok('skipped strength logs zero sets (no catch-up overload)', (history[0]?.sets.length ?? 0) === 0);
}

// ── 7. Repeated misses detectable ──
{
  const map: Record<string, SessionFeedback> = {
    '2026-07-06': { dateStr: '2026-07-06', completion: 'skipped', strength: [] },
    '2026-07-07': { dateStr: '2026-07-07', completion: 'skipped', strength: [] },
  };
  ok('repeated strength misses detectable from feedback/logs', deriveMissedStrengthSessionsThisWeek(map, '2026-07-09') === 2);
}

// ── 8. Team training completion does NOT imply gym strength completion ──
{
  // A team/conditioning-only session logged as skipped (has a conditioning
  // component, no strength component) must not count as a missed strength day.
  const teamSkip: SessionFeedback = {
    dateStr: '2026-07-06', completion: 'skipped',
    components: [{ componentId: 'c', kind: 'conditioning', label: 'Team run', completion: 'skipped' }],
  };
  const strengthSkip: SessionFeedback = { dateStr: '2026-07-07', completion: 'skipped', strength: [] };
  const map = { '2026-07-06': teamSkip, '2026-07-07': strengthSkip };
  ok('team/conditioning-only skip not counted as missed strength', deriveMissedStrengthSessionsThisWeek(map, '2026-07-09') === 1, 'only the real strength skip counts');
  const history = buildStrengthWorkoutHistoryFromFeedback(map, '2026-07-09');
  ok('team/conditioning-only session excluded from strength history', history.every((h) => h.loggedDate !== '2026-07-06'));
}

// ── 9. Conditioning progression prefers logged duration/interval/round data ──
function condRow(): WorkoutExercise[] {
  return [{
    id: 'ce-1', workoutId: 'w', exerciseId: 'intervals', exerciseOrder: 1,
    prescribedSets: 4, prescribedRepsMin: 6, prescribedRepsMax: 6, restSeconds: 90,
    exercise: { id: 'intervals', name: '1km Repeat Intervals', description: '' } as never,
    createdAt: '', updatedAt: '',
  }];
}
{
  const fb: SessionFeedback = {
    dateStr: '2026-07-06', completion: 'full',
    conditioning: { intervalsCompleted: 8, roundsCompleted: 8, totalTimeMinutes: 32, rpe: 7 },
  };
  const out = deriveConditioningProgressionInputOverrides({ feedback: fb, exercises: condRow(), baseDuration: 20 });
  ok('conditioning uses logged intervals', out.currentIntervals === 8, String(out.currentIntervals));
  ok('conditioning uses logged duration', out.currentDuration === 32, String(out.currentDuration));
  ok('conditioning uses logged rpe', out.recentRPE === 7, String(out.recentRPE));
}

// ── 10. Conditioning fallback still works when detailed logs missing ──
{
  const fb: SessionFeedback = { dateStr: '2026-07-06', completion: 'full', feeling: 'good' };
  const out = deriveConditioningProgressionInputOverrides({ feedback: fb, exercises: condRow(), baseDuration: 20 });
  ok('conditioning falls back to base duration when no log', out.currentDuration === 20, String(out.currentDuration));
  ok('conditioning falls back to prescribed intervals', out.currentIntervals === 4, String(out.currentIntervals));
}

// ── 11. Skipped finisher does NOT mark the full conditioning component missed ──
{
  const fb: SessionFeedback = {
    dateStr: '2026-07-06', completion: 'partial',
    components: [
      { componentId: 'cond', kind: 'conditioning', label: 'Intervals', completion: 'full' },
      { componentId: 'fin', kind: 'finisher', label: 'Flush', completion: 'skipped' },
    ],
  };
  const out = deriveConditioningProgressionInputOverrides({ feedback: fb, exercises: condRow(), baseDuration: 20 });
  ok('conditioning component completion wins over a skipped finisher', out.completionQuality === 'full', String(out.completionQuality));
}

// ── 12. Skipped recovery_addon carries no progression penalty ──
{
  const fb: SessionFeedback = {
    dateStr: '2026-07-06', completion: 'skipped',
    components: [{ componentId: 'ra', kind: 'recovery_addon', label: 'Mobility', completion: 'skipped' }],
  };
  const out = deriveConditioningProgressionInputOverrides({ feedback: fb, exercises: condRow(), baseDuration: 20 });
  ok('skipped recovery_addon is not treated as failed conditioning', out.completionQuality !== 'failed', String(out.completionQuality));
  ok('skipped recovery_addon not counted as missed strength',
    deriveMissedStrengthSessionsThisWeek({ '2026-07-06': fb }, '2026-07-09') === 0);
}

// ── 13. Repeat-week recommender still passes ──
{
  ok('repeat recommender fires on repeated misses', shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 1 }));
  ok('repeat recommender quiet on a good week', !shouldRecommendRepeatWeek({ plannedSessions: 5, completedSessions: 5 }));
}

// ── 14. collectLoggedStrengthSets bridges the store → builder ──
{
  const workout = strengthWorkout(); // has exercise id 'we-1'
  const map = new Map<string, LoggedSet[]>([
    ['we-1', [loggedSet(1, 5, 100), loggedSet(2, 4, 100)]],
    ['stale-id', [loggedSet(1, 9, 999)]], // not part of this workout → ignored
  ]);

  const record = collectLoggedStrengthSets(workout, map, 'w');
  ok('collects logged sets for this workout keyed by exercise id', !!record && !!record['we-1'] && record['we-1'].length === 2);
  ok('ignores sets for exercises not in this workout', !!record && record['stale-id'] === undefined);

  // Fed straight into the builder → real actuals captured.
  const logs = buildStrengthPerformanceLogs(workout, {}, 'full', record);
  ok('end-to-end: builder captures collected actual sets', logs[0].completedSets === 2 && logs[0].actualReps === 4);
}

// ── 15. Stale / missing logged sets → collector returns undefined (fallback) ──
{
  const workout = strengthWorkout();
  const map = new Map<string, LoggedSet[]>([['we-1', [loggedSet(1, 5, 100)]]]);
  ok('stale active workout id → undefined (fallback)', collectLoggedStrengthSets(workout, map, 'a-different-workout') === undefined);
  ok('no logged sets → undefined (fallback)', collectLoggedStrengthSets(workout, new Map(), 'w') === undefined);
  ok('null logged sets → undefined (fallback)', collectLoggedStrengthSets(workout, null, 'w') === undefined);

  // Builder with undefined logged sets keeps prescribed fallback.
  const logs = buildStrengthPerformanceLogs(workout, {}, 'full', undefined);
  ok('builder with no collected sets falls back to prescribed', logs[0].completedSets === undefined && logs[0].actualReps === undefined);
}

// ── 16. Production wire: SessionFeedbackPanel passes logged sets from the store ──
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  const src = fs.readFileSync('src/components/SessionFeedbackPanel.tsx', 'utf8');
  ok('panel imports collectLoggedStrengthSets', /collectLoggedStrengthSets/.test(src));
  ok('panel reads the workout-log store', /useWorkoutLogStore\.getState\(\)/.test(src));
  ok('panel passes collected logged sets into buildStrengthPerformanceLogs',
    /buildStrengthPerformanceLogs\(\s*workout,\s*weightOverrides,\s*strengthCompletion,\s*loggedStrengthSets\s*\)/s.test(src));
}

console.log(`\nWorkout-log progression wiring tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((n) => console.log(`  - ${n}`));
  process.exit(1);
}
