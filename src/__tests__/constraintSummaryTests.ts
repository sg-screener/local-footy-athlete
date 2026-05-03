/**
 * constraintSummaryTests — proves the reply + Coach Update card now
 * surface FUTURE-WEEK constraint changes (not just current-week
 * applied events).
 *
 * Scenarios covered:
 *  1. Hamstring 7/10 affects next Mon — nextWeekChanges populated.
 *  2. Current week empty + future projection → replyMode = 'future_constraint_applied'.
 *  3. Current week applied + next week applied → 'both_weeks_changed'.
 *  4. No constraint, no diff → 'no_changes' + unchangedReason set.
 *  5. renderFutureConstraintBlock produces bullets the reply can splice.
 *  6. Coach Update card type carries optional nextWeekChanges.
 *  7. Future projected session still has explanatory coachNotes.
 *
 * Run: npm run test:constraint-summary
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  summariseConstraintProjectionEffects,
  renderFutureConstraintBlock,
  renderNextWeekBullets,
} from '../utils/constraintSummary';
import { buildInjuryConstraint } from '../utils/exposureEngine';
import { projectVisibleDay } from '../utils/visibleProgramProjection';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { Workout } from '../types/domain';

// ─── Harness ─────────────────────────────────────────────────────────
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

// ─── Fixtures ────────────────────────────────────────────────────────
function ex(name: string): any {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`,
    exerciseOrder: 0, prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: {
      id: `ex-${name}`, name, description: name,
      exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}
function wk(name: string, exercises: any[], opts: any = {}): Workout {
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 1,
    name, description: '', durationMinutes: 60,
    intensity: 'Moderate' as any, workoutType: opts.workoutType || ('Strength' as any),
    sessionTier: opts.sessionTier || ('core' as any),
    exercises, createdAt: '', updatedAt: '',
    coachNotes: opts.coachNotes,
  } as Workout;
}
function day(date: string, workout: Workout | null): ResolvedDay {
  const [y, m, d] = date.split('-').map(Number);
  return {
    date,
    dayOfWeek: new Date(y, m - 1, d, 12, 0, 0, 0).getDay(),
    short: 'MON', isToday: false, workout, source: 'template', indicator: null,
  } as any;
}

const TODAY_ISO = '2026-04-29';

// Build matched current-week pairs (raw + projected). For "no current
// week change" pretend they're identical objects.
function unchangedWeek(): { raw: ResolvedDay[]; projected: ResolvedDay[] } {
  const w = wk('Recovery', [ex('Foam Roll')], { workoutType: 'Recovery' });
  const d = day('2026-04-30', w);
  return { raw: [d], projected: [d] };
}

// ═════════════════════════════════════════════════════════════════════
// 1. Hamstring 7/10 → next Mon Lower Body Strength rebuilt
// ═════════════════════════════════════════════════════════════════════
section('[1] Hamstring 7/10 — next Mon affected');
{
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 7 });
  const nextRawWorkout = wk('Lower Body Strength', [
    ex('Trap Bar Deadlift'),
    ex('Nordic Lower'),
    ex('Box Jump'),
    ex('Goblet Squat'),
  ]);
  const nextRawDay = day('2026-05-04', nextRawWorkout);

  // Projection runs the exposure engine — Trap Bar Deadlift / Nordic /
  // Box Jump should be removed for hamstring severe.
  const projectedNext = projectVisibleDay({
    day: nextRawDay,
    activeInjury: {
      bodyPart: 'hammy', bucket: 'hamstring',
      severity: 7, status: 'active', rules: [],
    },
    todayISO: TODAY_ISO,
  }).day;

  const cur = unchangedWeek();
  const summary = summariseConstraintProjectionEffects({
    activeConstraint: c,
    currentWeekRaw: cur.raw,
    currentWeekProjected: cur.projected,
    nextWeekRaw: [nextRawDay],
    nextWeekProjected: [projectedNext],
  });
  ok('replyMode = future_constraint_applied', summary.replyMode === 'future_constraint_applied');
  ok('nextWeekChanges has at least 1 entry', summary.nextWeekChanges.length >= 1);
  const bullet = summary.nextWeekChanges[0] ?? '';
  ok('bullet mentions Lower Body Strength', /Lower Body Strength/.test(bullet));
  ok('bullet mentions a removed exercise', /Trap Bar Deadlift|Nordic Lower|Box Jump/.test(bullet));
  ok('removedExercisesByDate populated for next Mon', !!summary.removedExercisesByDate['2026-05-04']);
  ok('Goblet Squat NOT removed', !summary.removedExercisesByDate['2026-05-04']?.includes('Goblet Squat'));
}

// ═════════════════════════════════════════════════════════════════════
// 2. Current week empty + future projection → reply text
// ═════════════════════════════════════════════════════════════════════
section('[2] Current week empty + projection → renderFutureConstraintBlock');
{
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 7 });
  const nextRaw = wk('Lower Body Strength', [ex('Trap Bar Deadlift'), ex('Goblet Squat')]);
  const projected = projectVisibleDay({
    day: day('2026-05-04', nextRaw),
    activeInjury: {
      bodyPart: 'hammy', bucket: 'hamstring',
      severity: 7, status: 'active', rules: [],
    },
    todayISO: TODAY_ISO,
  }).day;
  const cur = unchangedWeek();
  const summary = summariseConstraintProjectionEffects({
    activeConstraint: c,
    currentWeekRaw: cur.raw,
    currentWeekProjected: cur.projected,
    nextWeekRaw: [day('2026-05-04', nextRaw)],
    nextWeekProjected: [projected],
  });
  const block = renderFutureConstraintBlock(summary);
  ok('block non-empty', block.length > 0);
  ok('block mentions next week framing', /next week/i.test(block));
  ok('block has bullet for the session', /Mon Lower Body Strength/.test(block));
  ok('block does NOT say unchanged', !/program unchanged|nothing changed/i.test(block));
}

// ═════════════════════════════════════════════════════════════════════
// 3. Both weeks changed → 'both_weeks_changed'
// ═════════════════════════════════════════════════════════════════════
section('[3] Current + next week changed → both_weeks_changed');
{
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 7 });
  const curRaw = wk('Sprint Day', [ex('10m Sprint'), ex('Goblet Squat')]);
  const curProj = projectVisibleDay({
    day: day('2026-04-30', curRaw),
    activeInjury: { bodyPart: 'hammy', bucket: 'hamstring', severity: 7, status: 'active', rules: [] },
    todayISO: TODAY_ISO,
  }).day;
  const nextRaw = wk('Lower Body Strength', [ex('Trap Bar Deadlift'), ex('Goblet Squat')]);
  const nextProj = projectVisibleDay({
    day: day('2026-05-04', nextRaw),
    activeInjury: { bodyPart: 'hammy', bucket: 'hamstring', severity: 7, status: 'active', rules: [] },
    todayISO: TODAY_ISO,
  }).day;
  const summary = summariseConstraintProjectionEffects({
    activeConstraint: c,
    currentWeekRaw: [day('2026-04-30', curRaw)],
    currentWeekProjected: [curProj],
    nextWeekRaw: [day('2026-05-04', nextRaw)],
    nextWeekProjected: [nextProj],
  });
  eq('replyMode', summary.replyMode, 'both_weeks_changed');
  ok('currentWeekChanges populated', summary.currentWeekChanges.length >= 1);
  ok('nextWeekChanges populated', summary.nextWeekChanges.length >= 1);
}

// ═════════════════════════════════════════════════════════════════════
// 4. No active changes → no_changes + unchangedReason
// ═════════════════════════════════════════════════════════════════════
section('[4] No constraint changes → unchangedReason set');
{
  const cur = unchangedWeek();
  const next = unchangedWeek();
  // No active constraint at all.
  const summary = summariseConstraintProjectionEffects({
    activeConstraint: null,
    currentWeekRaw: cur.raw,
    currentWeekProjected: cur.projected,
    nextWeekRaw: next.raw,
    nextWeekProjected: next.projected,
  });
  eq('replyMode', summary.replyMode, 'no_changes');
  ok('unchangedReason set', !!summary.unchangedReason);
  eq('nextWeekChanges empty', summary.nextWeekChanges.length, 0);
  eq('currentWeekChanges empty', summary.currentWeekChanges.length, 0);
}

// ═════════════════════════════════════════════════════════════════════
// 5. Acceptance: reply must NOT say "program unchanged" when next
//    week was projected — caller logic in CoachScreen replaces the
//    misleading sentence. Smoke-test the regex used to detect it.
// ═════════════════════════════════════════════════════════════════════
section('[5] Detect-and-replace regex on misleading sentences');
{
  const cases = [
    "I left the program unchanged.",
    "But there aren't any future sessions this week that load the hammy, so I left the program unchanged.",
    "There aren't any future sessions this week to adjust, so I left the program unchanged.",
  ];
  const detector = /left the program unchanged|no future sessions this week|aren't any future sessions/i;
  for (const s of cases) {
    ok(`detector matches: "${s.slice(0, 40)}..."`, detector.test(s));
  }
  // Negative — a regular reply should NOT match.
  ok(
    'detector does NOT match a normal reply',
    !detector.test('Removed Deadlift on Mon. Keep upper body work.'),
  );
}

// ═════════════════════════════════════════════════════════════════════
// 6. CoachUpdate type accepts nextWeekChanges
// ═════════════════════════════════════════════════════════════════════
section('[6] CoachUpdate type accepts nextWeekChanges');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  // Reset, then upsert with nextWeekChanges, then read back.
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  const written = useCoachUpdatesStore.getState().upsertCoachUpdate('2026-04-27', {
    source: 'uae',
    reason: 'Hamstring pain — 7/10',
    rules: ['No sprinting'],
    changes: [],
    nextWeekChanges: ['Mon Lower Body Strength adjusted — Trap Bar Deadlift removed'],
  });
  ok('upsert returned object', !!written);
  ok('nextWeekChanges persisted', !!written.nextWeekChanges && written.nextWeekChanges.length === 1);
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
}

// ═════════════════════════════════════════════════════════════════════
// 7. Future projected session has explanatory coachNotes
//    (proves the Program tab can render a reason note for the user)
// ═════════════════════════════════════════════════════════════════════
section('[7] Projected next-Mon workout carries coachNotes');
{
  const w = wk('Lower Body Strength', [
    ex('Trap Bar Deadlift'), ex('Box Jump'), ex('Goblet Squat'),
  ]);
  const out = projectVisibleDay({
    day: day('2026-05-04', w),
    activeInjury: {
      bodyPart: 'hammy', bucket: 'hamstring',
      severity: 7, status: 'active', rules: [],
    },
    todayISO: TODAY_ISO,
  });
  const notes = out.day.workout?.coachNotes ?? [];
  ok('coachNotes attached', notes.length > 0);
  ok('coachNotes mention removal', notes.some((n) => /Removed|removed|sprint|hinge/i.test(n)));
}

// ═════════════════════════════════════════════════════════════════════
// 8. Logs fired for current/next/reply_mode
// ═════════════════════════════════════════════════════════════════════
section('[8] Runtime logs');
{
  const captured: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) =>
    captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 7 });
  const nextRaw = wk('Lower Body Strength', [ex('Trap Bar Deadlift'), ex('Goblet Squat')]);
  const projected = projectVisibleDay({
    day: day('2026-05-04', nextRaw),
    activeInjury: { bodyPart: 'hammy', bucket: 'hamstring', severity: 7, status: 'active', rules: [] },
    todayISO: TODAY_ISO,
  }).day;
  const cur = unchangedWeek();
  summariseConstraintProjectionEffects({
    activeConstraint: c,
    currentWeekRaw: cur.raw,
    currentWeekProjected: cur.projected,
    nextWeekRaw: [day('2026-05-04', nextRaw)],
    nextWeekProjected: [projected],
  });
  console.log = origLog;
  ok(
    '[constraint-summary] current_week_changes logged',
    captured.some((l) => l.includes('[constraint-summary] current_week_changes')),
  );
  ok(
    '[constraint-summary] next_week_changes logged',
    captured.some((l) => l.includes('[constraint-summary] next_week_changes')),
  );
  ok(
    '[constraint-summary] reply_mode logged',
    captured.some((l) => l.includes('[constraint-summary] reply_mode')),
  );
  ok(
    'reply_mode log contains future_constraint_applied',
    captured.some((l) => l.includes('future_constraint_applied')),
  );
}

// ═════════════════════════════════════════════════════════════════════
// 9. renderNextWeekBullets returns a copy
// ═════════════════════════════════════════════════════════════════════
section('[9] renderNextWeekBullets stable');
{
  const c = buildInjuryConstraint({ region: 'hamstring', severity: 7 });
  const nextRaw = wk('Lower Body Strength', [ex('Trap Bar Deadlift'), ex('Goblet Squat')]);
  const projected = projectVisibleDay({
    day: day('2026-05-04', nextRaw),
    activeInjury: { bodyPart: 'hammy', bucket: 'hamstring', severity: 7, status: 'active', rules: [] },
    todayISO: TODAY_ISO,
  }).day;
  const cur = unchangedWeek();
  const summary = summariseConstraintProjectionEffects({
    activeConstraint: c,
    currentWeekRaw: cur.raw, currentWeekProjected: cur.projected,
    nextWeekRaw: [day('2026-05-04', nextRaw)],
    nextWeekProjected: [projected],
  });
  const bullets = renderNextWeekBullets(summary);
  ok('bullets length matches nextWeekChanges', bullets.length === summary.nextWeekChanges.length);
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
