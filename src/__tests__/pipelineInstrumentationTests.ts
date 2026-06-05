/**
 * pipelineInstrumentationTests — proves the deterministic mutation
 * pipeline is fully instrumented and that invalid event targets are
 * categorically rejected.
 *
 * Covers (per the user's spec):
 *   1. Engine outputs event → must result in override write
 *   2. Invalid date → rejected with INVALID_TARGET_DATE
 *   3. Valid date → session changes
 *   4. No-op event → detected and reported
 *   5. End-to-end: message → intent → events → override → resolver → UI diff
 *
 * Run: npm run test:pipeline-instrumentation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = 'true';

// Capture pipeline logs so we can assert on them.
const realLog = console.log;
const realWarn = console.warn;
let captured: string[] = [];
function captureLogs() {
  captured = [];
  console.log = (...args: any[]) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  console.warn = (...args: any[]) => {
    captured.push('[WARN] ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
}
function restoreLogs() {
  console.log = realLog;
  console.warn = realWarn;
}
function loggedAny(needle: string): boolean {
  return captured.some((line) => line.includes(needle));
}

// ─── Resolver stub ───
import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0); dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

let baseWeekDef: Record<number, any> = {};
(sessionResolver as any).resolveWeekWithConditioning = (monday: string, state: any): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(monday, i);
    const dow = isoToDow(date);
    const override = state.manualOverrides?.[date];
    const wkDef = baseWeekDef[dow] ?? null;
    const wk = override ?? wkDef;
    out.push({
      date, dayOfWeek: dow, short: SHORT[dow], isToday: date === FIXED_TODAY,
      workout: wk, source: override ? 'manual' : wk ? 'template' : 'rest', indicator: null,
    } as any);
  }
  return out;
};
(sessionResolver as any).getMondayStr = () => FIXED_MONDAY;

import { useProgramStore } from '../store/programStore';
import {
  applyAdjustmentEvents,
  APPLY_REJECT_KIND,
} from '../utils/applyAdjustmentEvents';
import {
  applyProgramAdjustment,
  buildEvent,
  type AdjustmentEvent,
} from '../utils/programAdjustmentEngine';
import {
  snapshotVisibleWorkout,
  computeVisibleDiff,
} from '../utils/visibleWorkoutDiff';

function ex(name: string, sets = 3): any {
  return { id:`we-${name}`, workoutId:'wk', exerciseId:`ex-${name}`, exerciseOrder:0, prescribedSets:sets, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
    exercise:{ id:`ex-${name}`, name, description:name, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' },
    createdAt:'', updatedAt:'' };
}
function wk(name: string, dow: number, opts: any = {}): any {
  return { id:`w-${dow}`, microcycleId:'mc', dayOfWeek:dow, name, description:'', durationMinutes:60, intensity:'Moderate', workoutType: opts.workoutType || 'Strength', sessionTier: opts.sessionTier || 'core', exercises: opts.exercises || [], createdAt:'', updatedAt:'' };
}
function buildState() {
  return { currentProgram: null, currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {}, athleteContext: {}, seasonPhase: null, readiness: 'medium' } as any;
}
function resetStore() {
  useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
}

// ─── Harness ───
let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; realLog(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); realLog(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { realLog(`\n${label}`); }

// ─────────────────────────────────────────────────────────────────────
// 1. Engine outputs event → override is written; full instrumentation log
// ─────────────────────────────────────────────────────────────────────
section('[1] Engine event → override written + instrumentation logs');
{
  resetStore();
  baseWeekDef = {
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  captureLogs();
  const result = applyProgramAdjustment(
    { intent:'injury', todayISO: FIXED_TODAY, payload: { bodyPart: 'hamstring', severity: 6 }, source: 'client_guard' } as any,
    buildState() as any,
  );
  ok('engine produced events', result.events.length >= 1);
  ok('logs [adjustment-engine] events_emitted', loggedAny('[adjustment-engine] events_emitted'));

  const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
  restoreLogs();

  ok('apply: ≥1 applied', apply.applied.length >= 1);
  ok('logs [apply-events] received', loggedAny('[apply-events] received'));
  ok('logs [apply-events] target_validated', loggedAny('[apply-events] target_validated'));
  ok('logs [apply-events] applied', loggedAny('[apply-events] applied'));
  ok('logs [apply-events] result', loggedAny('[apply-events] result'));
  ok('logs [apply-events] date_pre_mutation', loggedAny('[apply-events] date_pre_mutation'));
  ok('logs [apply-events] date_post_mutation', loggedAny('[apply-events] date_post_mutation'));

  // Override is in the store.
  const friOverride = useProgramStore.getState().dateOverrides['2026-05-01'];
  ok('override written for Fri', !!friOverride);
}

// ─────────────────────────────────────────────────────────────────────
// 2. Invalid date (out of week) → INVALID_TARGET_DATE
// ─────────────────────────────────────────────────────────────────────
section('[2] Out-of-week event → INVALID_TARGET_DATE');
{
  resetStore();
  baseWeekDef = {
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs', 4)] }),
  };
  // Hand-crafted event whose date is two weeks out — outside the
  // resolved Mon-Sun window.
  const ev: AdjustmentEvent = buildEvent('remove_exercise', '2026-05-20', 'invalid date', 'RDLs', null);
  captureLogs();
  const apply = applyAdjustmentEvents([ev], { todayISO: FIXED_TODAY, buildState });
  restoreLogs();

  eq('zero applied', apply.applied.length, 0);
  eq('one rejection', apply.rejected.length, 1);
  eq(
    'rejection kind = INVALID_TARGET_DATE',
    apply.rejected[0].kind,
    APPLY_REJECT_KIND.INVALID_TARGET_DATE,
  );
  ok(
    'rejection reason mentions resolved week',
    /resolved week/i.test(apply.rejected[0].reason ?? ''),
  );
  ok('logs [apply-events] rejected', loggedAny('[apply-events] rejected'));
  ok(
    'logs INVALID_TARGET_DATE kind',
    loggedAny('invalid_target_date'),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. Past date → PAST_DATE (kept distinct from invalid_target_date)
// ─────────────────────────────────────────────────────────────────────
section('[3] Past-date event → PAST_DATE rejection');
{
  resetStore();
  baseWeekDef = {
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs', 4)] }),
  };
  const ev: AdjustmentEvent = buildEvent('remove_exercise', '2026-04-20', 'past', 'RDLs', null);
  captureLogs();
  const apply = applyAdjustmentEvents([ev], { todayISO: FIXED_TODAY, buildState });
  restoreLogs();

  eq('zero applied', apply.applied.length, 0);
  eq('rejection kind = PAST_DATE', apply.rejected[0].kind, APPLY_REJECT_KIND.PAST_DATE);
}

// ─────────────────────────────────────────────────────────────────────
// 4. Valid date → session ACTUALLY changes (visible-diff confirms)
// ─────────────────────────────────────────────────────────────────────
section('[4] Valid event → session visibly changes');
{
  resetStore();
  baseWeekDef = {
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  const beforeWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, buildState());
  const beforeByDate: any = {};
  for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

  const result = applyProgramAdjustment(
    { intent:'injury', todayISO: FIXED_TODAY, payload: { bodyPart: 'hamstring', severity: 6 }, source: 'client_guard' } as any,
    buildState() as any,
  );
  applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });

  const afterWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, buildState());
  const afterByDate: any = {};
  for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);

  const dates = result.events.map((e) => e.date);
  const diff = computeVisibleDiff(dates, beforeByDate, afterByDate);
  ok('visible diff has ≥1 changed date', diff.length >= 1);
  // RDLs gone OR replaced.
  ok(
    'Fri exercise list changed (name set differs)',
    diff.some((d) => d.changedFields.includes('exerciseNames')),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. No-op event (target exercise not present) → rejected, no override
// ─────────────────────────────────────────────────────────────────────
section('[5] No-op event (exercise not present) → EXERCISE_NOT_PRESENT');
{
  resetStore();
  baseWeekDef = {
    5: wk('Lower Strength', 5, { exercises: [ex('Goblet Squat', 3)] }),
  };
  // Engine asks to remove RDLs, but the workout doesn't have RDLs.
  const ev: AdjustmentEvent = buildEvent('remove_exercise', '2026-05-01', 'no-op', 'RDLs', null);
  captureLogs();
  const apply = applyAdjustmentEvents([ev], { todayISO: FIXED_TODAY, buildState });
  restoreLogs();

  eq('zero applied', apply.applied.length, 0);
  eq(
    'rejection kind = EXERCISE_NOT_PRESENT',
    apply.rejected[0].kind,
    APPLY_REJECT_KIND.EXERCISE_NOT_PRESENT,
  );
  ok(
    'no override written',
    Object.keys(useProgramStore.getState().dateOverrides).length === 0,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. End-to-end: message → engine → events → apply → resolver → diff
// ─────────────────────────────────────────────────────────────────────
section('[6] End-to-end pipeline produces visible diff');
{
  resetStore();
  baseWeekDef = {
    4: wk('Team Training', 4, { workoutType: 'Team Training' }),
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };

  // Pre-snapshot.
  const beforeWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, buildState());
  const beforeByDate: any = {};
  for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

  // Engine.
  const result = applyProgramAdjustment(
    { intent:'injury', todayISO: FIXED_TODAY, payload: { bodyPart: 'hammy', severity: 6 }, source: 'client_guard' } as any,
    buildState() as any,
  );
  ok('engine produced events', result.events.length >= 2);

  // Apply.
  const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
  ok('apply: ≥1 applied', apply.applied.length >= 1);
  ok('apply: zero rejected', apply.rejected.length === 0);

  // Resolver re-read.
  const afterWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, buildState());
  const afterByDate: any = {};
  for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);

  const dates = Array.from(new Set([
    ...apply.applied.map((a) => a.date),
    ...result.events.map((e) => e.date),
  ]));
  const diff = computeVisibleDiff(dates, beforeByDate, afterByDate);
  ok('end-to-end: ≥1 visible change', diff.length >= 1);

  // Specifically: Thu Team Training picked up coachNotes; Fri RDLs gone.
  const thu = afterWeek.find((d: any) => d.date === '2026-04-30');
  ok(
    'Thu Team Training has coachNotes',
    (thu?.workout?.coachNotes ?? []).length > 0,
  );
  const fri = afterWeek.find((d: any) => d.date === '2026-05-01');
  ok(
    'Fri Lower Strength: RDLs gone',
    !fri?.workout?.exercises.some((e: any) => e.exercise?.name === 'RDLs'),
  );
}

// ─── Summary ────
console.log = realLog;
console.warn = realWarn;
realLog(`\n— Summary —`);
realLog(`  Pass: ${pass}`);
realLog(`  Fail: ${fail}`);
if (fail > 0) {
  realLog(`\n— Failures —`);
  for (const f of failures) realLog(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
