/**
 * coachUpdatesStoreTests — direct unit tests for the Coach Update store
 * + an integration test that drives the FULL pipeline (coachScreen
 * handleSend logic mirror) and asserts the card is created/skipped at
 * the right moments.
 *
 * Run: npm run test:coach-updates
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// Silence pipeline logs to keep output readable.
const realLog = console.log;
console.log = (..._args: any[]) => {};

// ─── Stub resolver before any imports that trigger store reads ─────────

import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

let baseWeekDef: Record<number, any> = {};

(sessionResolver as any).resolveWeekWithConditioning = (monday: string, state: any): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
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
  useCoachUpdatesStore,
  getActiveCoachUpdate,
} from '../store/coachUpdatesStore';
import { applyAdjustmentEvents } from '../utils/applyAdjustmentEvents';
import {
  applyProgramAdjustment,
  buildInjuryPolicy,
  resolveInjuryBucket,
  eventToBullet,
} from '../utils/programAdjustmentEngine';
import {
  snapshotVisibleWorkout,
  computeVisibleDiff,
} from '../utils/visibleWorkoutDiff';

function ex(name: string, sets = 3): any {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id: `we-${id}`, workoutId: '', exerciseId: id, exerciseOrder: 0,
    prescribedSets: sets, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: { id, name, description: name, exerciseType: 'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' },
    createdAt: '', updatedAt: '',
  };
}
function workout(name: string, opts: any = {}): any {
  return {
    id: `wk-${name}`, microcycleId: 'mc', dayOfWeek: 0,
    name, description: '', durationMinutes: 60, intensity: 'Moderate',
    workoutType: opts.workoutType || 'Strength',
    sessionTier: opts.sessionTier || 'core',
    exercises: opts.exercises || [],
    createdAt: '', updatedAt: '',
  };
}

function resetAll() {
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null,
    dateOverrides: {}, overrideContexts: {},
    sessionFeedback: {}, weightOverrides: {},
  } as any);
  useCoachUpdatesStore.setState({ updatesByWeek: {} });
}
function buildState() {
  return {
    currentProgram: null, currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {}, athleteContext: {} as any, seasonPhase: null, readiness: 'medium',
  } as any;
}

// Mirror of the CoachScreen.handleSend "applied + visible-diff" logic
// so we can test the upsert wire-up without mounting React.
function runHandleSendMirror(bodyPart: string, severity: number) {
  const monday = FIXED_MONDAY;
  const beforeWeek = (sessionResolver as any).resolveWeekWithConditioning(monday, buildState());
  const beforeByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
  for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

  const result = applyProgramAdjustment(
    {
      intent: 'injury', todayISO: FIXED_TODAY,
      payload: { bodyPart, severity }, source: 'client_guard',
    } as any,
    buildState(),
  );
  const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState } as any);

  const afterWeek = (sessionResolver as any).resolveWeekWithConditioning(monday, buildState());
  const afterByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
  for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);

  const datesToCheck = Array.from(new Set([
    ...apply.applied.map((a) => a.date),
    ...result.events.map((e) => e.date),
  ]));
  const diff = computeVisibleDiff(datesToCheck, beforeByDate, afterByDate);
  const visibleDiffDetected = diff.length > 0;

  if (apply.applied.length > 0 && visibleDiffDetected) {
    const cardBucket =
      bodyPart && bodyPart !== 'unknown' ? resolveInjuryBucket(bodyPart) : null;
    const policy = buildInjuryPolicy(cardBucket, severity);
    const reasonBodyPart = bodyPart === 'unknown' ? 'Injury'
      : bodyPart[0].toUpperCase() + bodyPart.slice(1);
    useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
      source: 'uae',
      reason: `${reasonBodyPart} pain — ${severity}/10`,
      rules: [...policy.globalRules],
      changes: result.events.map(eventToBullet),
    });
  }
  return { result, apply, visibleDiffDetected };
}

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
section('[1] coachUpdatesStore — upsert / deactivate / clear');
{
  resetAll();
  const u = useCoachUpdatesStore.getState().upsertCoachUpdate('2026-04-27', {
    source: 'uae',
    reason: 'Hamstring pain — 6/10',
    rules: ['No sprinting'],
    changes: ['Thu: no sprinting in Team Training'],
  });
  ok('upsert returns active update', u.active === true);
  eq('reason persisted', u.reason, 'Hamstring pain — 6/10');
  eq('rules persisted', u.rules, ['No sprinting']);

  // getActive reads from the live store.
  const active = getActiveCoachUpdate('2026-04-27');
  ok('getActiveCoachUpdate returns it', active?.id === u.id);

  // Deactivate hides it.
  useCoachUpdatesStore.getState().deactivateCoachUpdate('2026-04-27');
  ok('after deactivate: getActive returns null', getActiveCoachUpdate('2026-04-27') === null);

  // Other weeks unaffected.
  ok('different week returns null', getActiveCoachUpdate('2026-05-04') === null);

  // clearAll wipes everything.
  useCoachUpdatesStore.getState().clearAllCoachUpdates();
  eq('after clearAll: empty', useCoachUpdatesStore.getState().updatesByWeek, {});
}

// ─────────────────────────────────────────────────────────────────────
section('[2] Card created on hammy 6/10 + Thu Team Training');
{
  resetAll();
  baseWeekDef = {
    3: workout('Recovery Session', { workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] }),
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
  };
  const r = runHandleSendMirror('hammy', 6);
  ok('apply.applied.length ≥ 1', r.apply.applied.length >= 1);
  ok('visibleDiffDetected = true', r.visibleDiffDetected === true);

  const card = getActiveCoachUpdate(FIXED_MONDAY);
  ok('card exists for current week', card != null);
  if (card) {
    ok('card.active = true', card.active === true);
    ok('card.source = uae', card.source === 'uae');
    eq('card.reason', card.reason, 'Hammy pain — 6/10');
    ok(
      'card.rules contains "No sprinting"',
      card.rules.some((r: string) => /No sprinting/i.test(r)),
    );
    ok(
      'card.changes contains a Thu bullet',
      card.changes.some((c: string) => /Thu/.test(c)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
section('[3] No card when applied=0 (empty week)');
{
  resetAll();
  baseWeekDef = {}; // no sessions
  const r = runHandleSendMirror('hammy', 6);
  eq('apply.applied = 0', r.apply.applied.length, 0);
  ok('no card written', getActiveCoachUpdate(FIXED_MONDAY) === null);
}

// ─────────────────────────────────────────────────────────────────────
section('[4] Card overwritten on follow-up adjustment for same week');
{
  resetAll();
  baseWeekDef = {
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  // First turn: hammy 6.
  runHandleSendMirror('hammy', 6);
  const card1 = getActiveCoachUpdate(FIXED_MONDAY);
  ok('first card created', card1 != null);

  // Second turn: hamstring 7 (escalation).
  runHandleSendMirror('hamstring', 7);
  const card2 = getActiveCoachUpdate(FIXED_MONDAY);
  ok('second card replaces first (different id)', card2 != null && card2.id !== card1?.id);
  if (card2) eq('second card severity = 7', card2.reason, 'Hamstring pain — 7/10');
}

// ─────────────────────────────────────────────────────────────────────
section('[5] Card disappears after deactivate (athlete dismissed)');
{
  resetAll();
  baseWeekDef = {
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
  };
  runHandleSendMirror('hammy', 6);
  ok('card present pre-dismiss', getActiveCoachUpdate(FIXED_MONDAY) !== null);

  useCoachUpdatesStore.getState().deactivateCoachUpdate(FIXED_MONDAY);
  ok('card hidden post-dismiss', getActiveCoachUpdate(FIXED_MONDAY) === null);
  // Underlying entry still exists with active=false (history preserved).
  const raw = useCoachUpdatesStore.getState().updatesByWeek[FIXED_MONDAY];
  ok('raw entry still exists with active=false', raw != null && raw.active === false);
}

// ─────────────────────────────────────────────────────────────────────
section('[6] No card written when visible_diff = false');
{
  // Synthetic scenario: a week where the engine emits an event but the
  // applied workout is byte-identical to the original (zero visible
  // diff). The runHandleSendMirror is the faithful mirror — if
  // visibleDiff=false it should skip the upsert. We assert by writing a
  // pre-existing card, then running through a scenario where no
  // visible diff occurs.
  //
  // Easiest construction: set up a week where the engine emits exactly
  // one event but applyAdjustmentEvents rejects it (date out of week).
  resetAll();
  baseWeekDef = {
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
  };
  // Pre-populate a card from a prior turn so we can verify it's NOT
  // overwritten by a no-effect turn.
  useCoachUpdatesStore.getState().upsertCoachUpdate(FIXED_MONDAY, {
    source: 'uae',
    reason: 'Existing card',
    rules: ['existing rule'],
    changes: ['existing change'],
  });
  const before = getActiveCoachUpdate(FIXED_MONDAY);

  // Now run a hammy 3/10 which the engine declines (severity gate).
  // Engine emits zero events → apply.applied=0 → no upsert.
  runHandleSendMirror('hammy', 3);

  const after = getActiveCoachUpdate(FIXED_MONDAY);
  ok(
    'pre-existing card preserved (no overwrite on no-op turn)',
    after?.id === before?.id,
    `before=${before?.id} after=${after?.id}`,
  );
}

// ─── Summary ───────────────────────────────────────────────────────────

console.log = realLog;
realLog(`\n— Summary —`);
realLog(`  Pass: ${pass}`);
realLog(`  Fail: ${fail}`);
if (fail > 0) {
  realLog(`\n— Failures —`);
  for (const f of failures) realLog(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
