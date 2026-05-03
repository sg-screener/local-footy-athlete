/**
 * programAdjustmentEngineTests — Validates the Universal Adjustment Engine
 * skeleton (src/utils/programAdjustmentEngine.ts).
 *
 * The skeleton is intentionally a routing + safety pass: it resolves the
 * current week through the existing resolver, filters to future-only,
 * rejects past-date payloads, and returns a stable AdjustmentResult shape
 * with applied=false for every (currently unhandled) intent.
 *
 * STRATEGY
 *   - Stub `resolveWeekWithConditioning` so the engine sees a fixture week
 *     we control.  The Monday is computed from a fixed `todayISO` so the
 *     test is deterministic regardless of clock.
 *   - Pass an empty ScheduleState through; the resolver mock ignores it.
 *   - Confirm the engine never tries to mutate state (it can't — it has
 *     no store imports).  We sanity-check this by verifying that the same
 *     `state` object is passed to the resolver unchanged.
 *
 * Run: sucrase-node src/__tests__/programAdjustmentEngineTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';

// ─── Resolver stub ─────────────────────────────────────────────────────

const FIXED_TODAY = '2026-04-29'; // Wednesday
const FIXED_MONDAY = '2026-04-27';

let resolverCalls: Array<{ monday: string; state: ScheduleState }> = [];
let baseWeek: ResolvedDay[] = [];

function resetResolver() {
  resolverCalls = [];
  baseWeek = buildWeekFixture();
}

(sessionResolver as any).resolveWeekWithConditioning = (
  monday: string,
  state: ScheduleState,
): ResolvedDay[] => {
  resolverCalls.push({ monday, state });
  return baseWeek;
};

// Import AFTER the stub is installed so the engine binds the patched ref.
import {
  applyProgramAdjustment,
  mondayOfISO,
  filterFutureResolvedDays,
  isValidISODate,
  buildEvent,
  REJECT_KIND,
  type AdjustmentRequest,
  type AdjustmentResult,
} from '../utils/programAdjustmentEngine';

// ─── Fixtures ──────────────────────────────────────────────────────────

const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Mon→Sun fixture rooted on FIXED_MONDAY. */
function buildWeekFixture(): ResolvedDay[] {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: null,
      source: 'none',
      indicator: null,
    });
  }
  return out;
}

function emptyScheduleState(): ScheduleState {
  return {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: {},
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium',
  } as ScheduleState;
}

// ─── Tiny test harness ─────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function section(label: string) {
  console.log(`\n${label}`);
}

function makeRequest(overrides: Partial<AdjustmentRequest> = {}): AdjustmentRequest {
  return {
    intent: 'general_question',
    todayISO: FIXED_TODAY,
    source: 'manual_ui',
    ...overrides,
  };
}

function isStableShape(r: AdjustmentResult): boolean {
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.applied === 'boolean' &&
    Array.isArray(r.events) &&
    Array.isArray(r.rejected) &&
    typeof r.reply === 'string'
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────

console.log('\n=== Universal Adjustment Engine — skeleton ===');

// ── 1. Helpers ────────────────────────────────────────────────────────
section('1. Helpers');

eq('mondayOfISO(Wed 2026-04-29) → 2026-04-27', mondayOfISO('2026-04-29'), '2026-04-27');
eq('mondayOfISO(Mon 2026-04-27) → 2026-04-27', mondayOfISO('2026-04-27'), '2026-04-27');
eq('mondayOfISO(Sun 2026-05-03) → 2026-04-27', mondayOfISO('2026-05-03'), '2026-04-27');
eq('mondayOfISO(Sat 2026-05-02) → 2026-04-27', mondayOfISO('2026-05-02'), '2026-04-27');

ok('mondayOfISO rejects malformed', (() => {
  try { mondayOfISO('29-04-2026'); return false; } catch { return true; }
})());

eq('isValidISODate(\'2026-04-29\')', isValidISODate('2026-04-29'), true);
eq('isValidISODate(\'29-04-2026\')', isValidISODate('29-04-2026'), false);
eq('isValidISODate(undefined)', isValidISODate(undefined), false);
eq('isValidISODate(123)', isValidISODate(123 as unknown), false);

// filterFutureResolvedDays
{
  resetResolver();
  const future = filterFutureResolvedDays(baseWeek, FIXED_TODAY);
  eq(
    'filterFutureResolvedDays drops days before today',
    future.map((d) => d.date),
    ['2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03'],
  );
}

// ── 2. Engine resolves the current week ───────────────────────────────
section('2. Engine resolves current week');

{
  resetResolver();
  const state = emptyScheduleState();
  applyProgramAdjustment(makeRequest(), state);

  ok('resolver was called exactly once', resolverCalls.length === 1);
  eq('resolver got Monday of todayISO', resolverCalls[0]?.monday, FIXED_MONDAY);
  ok('resolver got the same state object',
    resolverCalls[0]?.state === state,
    `state identity differs`);
}

// ── 3. Past-date payload rejected ─────────────────────────────────────
section('3. Past-date payload rejected');

{
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'exercise_swap',
      payload: { date: '2026-04-25' }, // Saturday before FIXED_TODAY
    }),
    emptyScheduleState(),
  );

  eq('past-date: applied=false', result.applied, false);
  eq('past-date: events empty', result.events.length, 0);
  eq('past-date: one rejection', result.rejected.length, 1);
  eq('past-date: rejection.kind', result.rejected[0]?.kind, REJECT_KIND.PAST_DATE);
  eq('past-date: rejection.date echoes payload', result.rejected[0]?.date, '2026-04-25');
  ok('past-date: reply mentions past', /past/i.test(result.reply));
  ok('past-date: shape stable', isStableShape(result));
}

{
  // payload.fromDate alias should also be guarded
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'schedule_change',
      payload: { fromDate: '2026-04-28' }, // Tue, day before today
    }),
    emptyScheduleState(),
  );
  eq('past-date (fromDate alias): applied=false', result.applied, false);
  eq('past-date (fromDate alias): rejection.date', result.rejected[0]?.date, '2026-04-28');
}

// ── 4. Future / today dates allowed (no past-date rejection) ──────────
section('4. Future + today dates allowed');

{
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'exercise_swap',
      payload: { date: FIXED_TODAY },
    }),
    emptyScheduleState(),
  );
  ok(
    "today's date is NOT a past-date rejection",
    !result.rejected.some((r) => r.kind === REJECT_KIND.PAST_DATE),
  );
}

{
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'exercise_swap',
      payload: { date: '2026-05-01' }, // Friday, future
    }),
    emptyScheduleState(),
  );
  ok(
    "future date is NOT a past-date rejection",
    !result.rejected.some((r) => r.kind === REJECT_KIND.PAST_DATE),
  );
}

{
  // No payload at all → no past-date rejection; falls through to unsupported
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({ intent: 'fatigue' }),
    emptyScheduleState(),
  );
  ok(
    'no payload date: no past-date rejection',
    !result.rejected.some((r) => r.kind === REJECT_KIND.PAST_DATE),
  );
}

// ── 5. Unsupported intents return applied=false (stable shape) ────────
section('5. Unsupported intents');

// `injury` is intentionally absent here — it's handled by handleInjuryIntent
// and validated end-to-end in the injury-handler section below.
const UNSUPPORTED_INTENTS = [
  'fatigue',
  'missed_session',
  'busy_week',
  'schedule_change',
  'exercise_swap',
  'preference_change',
  'general_question',
] as const;

const ALL_INTENTS = ['injury', ...UNSUPPORTED_INTENTS] as const;

for (const intent of UNSUPPORTED_INTENTS) {
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({ intent }),
    emptyScheduleState(),
  );
  eq(`${intent}: applied=false`, result.applied, false);
  eq(`${intent}: events empty`, result.events.length, 0);
  ok(
    `${intent}: rejected has unsupported_intent`,
    result.rejected.some((r) => r.kind === REJECT_KIND.UNSUPPORTED_INTENT),
  );
  ok(`${intent}: shape stable`, isStableShape(result));
  ok(`${intent}: reply non-empty`, result.reply.length > 0);
}

// ── 6. Result shape is always stable ──────────────────────────────────
section('6. Result shape is stable across all paths');

{
  // Invalid todayISO path
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({ todayISO: 'not-a-date' as string }),
    emptyScheduleState(),
  );
  ok('invalid todayISO: shape stable', isStableShape(result));
  eq('invalid todayISO: applied=false', result.applied, false);
  ok(
    'invalid todayISO: rejection.kind=invalid_request',
    result.rejected.some((r) => r.kind === REJECT_KIND.INVALID_REQUEST),
  );
  ok('invalid todayISO: resolver NOT called', resolverCalls.length === 0);
}

// ── 7. No mutation: state identity preserved ─────────────────────────
section('7. No state mutation');

{
  resetResolver();
  const state = emptyScheduleState();
  const stateSnapshot = JSON.stringify(state);
  // Use fatigue (still unsupported) — injury now has a real handler whose
  // mutation-free behaviour is checked exhaustively in the injury section.
  applyProgramAdjustment(makeRequest({ intent: 'fatigue' }), state);
  eq('state object unchanged after run', JSON.stringify(state), stateSnapshot);
}

{
  // Multiple calls with the same state should not cumulatively mutate it
  resetResolver();
  const state = emptyScheduleState();
  const stateSnapshot = JSON.stringify(state);
  for (const intent of ALL_INTENTS) {
    applyProgramAdjustment(makeRequest({ intent }), state);
  }
  eq(
    'state unchanged across all intents',
    JSON.stringify(state),
    stateSnapshot,
  );
}

// ── 8. Engine never reaches for the LLM (no thrown imports) ──────────
section('8. No LLM dependency');

ok(
  'applyProgramAdjustment is synchronous',
  applyProgramAdjustment.length === 2 &&
    typeof applyProgramAdjustment === 'function',
);

// ── 9. buildEvent shape sanity ───────────────────────────────────────
section('9. buildEvent constructor');

{
  const e = buildEvent('lighten_session', '2026-04-30', 'fatigue 6/10', { a: 1 }, { a: 0 });
  ok('event.id non-empty', e.id.length > 0);
  eq('event.kind', e.kind, 'lighten_session');
  eq('event.date', e.date, '2026-04-30');
  eq('event.reason', e.reason, 'fatigue 6/10');
  eq('event.before', e.before, { a: 1 });
  eq('event.after', e.after, { a: 0 });
}

// ─────────────────────────────────────────────────────────────────────
// INJURY HANDLER TESTS
// ─────────────────────────────────────────────────────────────────────
//
// Today (FIXED_TODAY) is Wed 2026-04-29. Mon (04-27) and Tue (04-28) are
// past; Wed/Thu/Fri/Sat/Sun are future.
//
// Helper: install a fixture week with workouts on chosen days. The
// resolver stub returns whatever `baseWeek` currently holds, so writing
// here is enough to drive the engine.

type WorkoutShape = {
  name: string;
  workoutType?: string;
  sessionTier?: string;
  exercises: Array<{ name: string }>;
};

function placeWorkouts(byOffset: Record<number, WorkoutShape | null>) {
  baseWeek = buildWeekFixture().map((d, i) => {
    const w = byOffset[i];
    if (!w) return d;
    return {
      ...d,
      workout: {
        id: `wk-${i}`,
        microcycleId: 'mc-test',
        dayOfWeek: d.dayOfWeek,
        name: w.name,
        description: '',
        durationMinutes: 60,
        intensity: 'Moderate' as any,
        workoutType: (w.workoutType ?? 'Strength') as any,
        sessionTier: (w.sessionTier ?? 'core') as any,
        exercises: w.exercises.map((ex, idx) => ({
          id: `we-${i}-${idx}`,
          workoutId: `wk-${i}`,
          exerciseId: `ex-${idx}`,
          exerciseOrder: idx,
          prescribedSets: 3,
          prescribedRepsMin: 6,
          prescribedRepsMax: 8,
          prescribedWeightKg: 0,
          restSeconds: 0,
          exercise: {
            id: `ex-${idx}`,
            name: ex.name,
            description: ex.name,
            exerciseType: 'Compound' as any,
            muscleGroups: [],
            equipmentRequired: [],
            difficultyLevel: 'Intermediate' as any,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          } as any,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })),
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as any,
      source: 'template' as any,
      indicator: 'core' as any,
    };
  });
}

function injuryRequest(
  bodyPart: string,
  severity: number,
): AdjustmentRequest {
  return makeRequest({
    intent: 'injury',
    payload: { bodyPart, severity },
  });
}

// ── 10. Injury handler ───────────────────────────────────────────────
section('10. Injury handler — payload validation');

{
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({ intent: 'injury', payload: {} }),
    emptyScheduleState(),
  );
  eq('missing payload: applied=false', result.applied, false);
  eq('missing payload: events empty', result.events.length, 0);
  ok(
    'missing payload: rejection.kind=invalid_request',
    result.rejected.some((r) => r.kind === REJECT_KIND.INVALID_REQUEST),
  );
  ok(
    'missing payload: reply asks for body part + rating',
    /body part.*pain rating|pain rating.*body part/i.test(result.reply),
  );
}

{
  // Unknown body part on an empty week → still applied=false because there
  // are no adjustable future sessions (NOT because the body part is unknown).
  // Rejection is recorded for telemetry but the engine's contract is
  // "act when severity ≥ 5 AND there's something to act on".
  resetResolver();
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'injury',
      payload: { bodyPart: 'forelimb', severity: 6 }, // unmapped
    }),
    emptyScheduleState(),
  );
  eq('unknown body part + empty week: applied=false', result.applied, false);
  ok(
    'unknown body part: rejection has unknown_body_part',
    result.rejected.some((r) => r.kind === 'unknown_body_part'),
  );
}

// 10.0a — Unknown body part WITH adjustable sessions → applied=true.
// Engine must NEVER skip when severity is provided.
{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Goblet Squat' }] }, // today
    4: { name: 'Fri Mixed', exercises: [{ name: 'Walking Lunge' }] }, // future
  });
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'injury',
      payload: { bodyPart: 'forelimb', severity: 6 }, // unmapped body part
    }),
    emptyScheduleState(),
  );
  eq('unmapped body part + sessions: applied=true', result.applied, true);
  ok('unmapped: ≥1 event', result.events.length >= 1);
  ok(
    'unmapped + severity 6: fallback uses lighten_session',
    result.events.some((e) => e.kind === 'lighten_session'),
  );
  ok(
    'unmapped: rejection still recorded for telemetry',
    result.rejected.some((r) => r.kind === 'unknown_body_part'),
  );
  ok(
    'unmapped: reply does not name the bogus body part',
    !/forelimb/i.test(result.reply),
  );
}

// 10.0b — bodyPart='unknown' (sentinel) WITH adjustable sessions → applied=true.
{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Goblet Squat' }] }, // today
  });
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'injury',
      payload: { bodyPart: 'unknown', severity: 6 },
    }),
    emptyScheduleState(),
  );
  eq('unknown sentinel + sessions: applied=true', result.applied, true);
  ok('unknown sentinel: ≥1 event', result.events.length >= 1);
  ok(
    'unknown sentinel: fallback uses lighten_session at severity 6',
    result.events.some((e) => e.kind === 'lighten_session'),
  );
  ok(
    'unknown sentinel: NO unknown_body_part rejection (sentinel is expected)',
    !result.rejected.some((r) => r.kind === 'unknown_body_part'),
  );
  ok(
    'unknown sentinel: reply uses severity-anchored phrasing',
    /6\/10/.test(result.reply),
  );
}

// 10.0c — bodyPart='unknown' + severity≥7 → recovery (not lighten).
{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Goblet Squat' }] },
  });
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'injury',
      payload: { bodyPart: 'unknown', severity: 8 },
    }),
    emptyScheduleState(),
  );
  eq('unknown + sev 8: applied=true', result.applied, true);
  ok(
    'unknown + sev 8: fallback uses set_session_recovery',
    result.events.some((e) => e.kind === 'set_session_recovery'),
  );
}

// 10.0d — Empty bodyPart in payload → treated as 'unknown', still applies.
{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Goblet Squat' }] },
  });
  const result = applyProgramAdjustment(
    makeRequest({
      intent: 'injury',
      payload: { severity: 6 }, // bodyPart entirely missing
    }),
    emptyScheduleState(),
  );
  eq('missing bodyPart + sessions: applied=true', result.applied, true);
  ok('missing bodyPart: ≥1 event', result.events.length >= 1);
}

section('10.1 Severity gate');

{
  resetResolver();
  placeWorkouts({
    1: { name: 'Tue Lower', exercises: [{ name: 'RDLs' }] }, // past
    2: { name: 'Wed Lower', exercises: [{ name: 'RDLs' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 3),
    emptyScheduleState(),
  );
  eq('severity 3/10: applied=false', result.applied, false);
  eq('severity 3/10: zero events', result.events.length, 0);
  ok('severity 3/10: reply notes no change', /no program change|manageable/i.test(result.reply));
  ok('severity 3/10: shape stable', isStableShape(result));
}

section('10.2 Hamstring 6/10 — RDLs flagged avoid');

{
  resetResolver();
  placeWorkouts({
    0: { name: 'Mon Lower', exercises: [{ name: 'RDLs' }] }, // PAST — must NOT be touched
    2: { name: 'Wed Lower', exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }] }, // today
    4: { name: 'Fri Lower', exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }] }, // future
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  eq('hamstring 6: applied=true', result.applied, true);
  ok('hamstring 6: events.length > 0', result.events.length > 0);
  // The engine now prefers replace_exercise (curated safe alternative)
  // over a bare remove_exercise. Either is acceptable as long as the
  // RDL is no longer in the resulting workout.
  const rdlEvents = result.events.filter(
    (e) => (e.kind === 'replace_exercise' || e.kind === 'remove_exercise') && e.before === 'RDLs',
  );
  ok(
    'hamstring 6: emits ≥2 events targeting RDLs (Wed + Fri)',
    rdlEvents.length >= 2,
    `got ${rdlEvents.length}`,
  );
  ok(
    'hamstring 6: NO past-date events (Mon)',
    !result.events.some((e) => e.date === '2026-04-27'),
  );
  ok(
    'hamstring 6: events on Wed AND Fri',
    result.events.some((e) => e.date === '2026-04-29') &&
      result.events.some((e) => e.date === '2026-05-01'),
  );
  ok('hamstring 6: reply mentions hamstring', /hamstring/i.test(result.reply));
  ok('hamstring 6: reply lists RDLs', /RDLs/.test(result.reply));
}

section('10.3 Knee 6/10 — Depth Jumps flagged avoid');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Plyo', exercises: [{ name: 'Depth Jumps' }, { name: 'Goblet Squat' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('knee', 6),
    emptyScheduleState(),
  );
  eq('knee 6: applied=true', result.applied, true);
  // Engine prefers replace_exercise (Depth Jumps → Wall Sit) but
  // accepts a bare remove_exercise as a fallback.
  const exerciseMods = result.events.filter(
    (e) => e.kind === 'remove_exercise' || e.kind === 'replace_exercise',
  );
  ok('knee 6: emits ≥1 exercise modification', exerciseMods.length >= 1);
  ok(
    'knee 6: targets Depth Jumps',
    exerciseMods.some((e) => e.before === 'Depth Jumps'),
  );
  ok('knee 6: reply mentions knee', /knee/i.test(result.reply));
}

section('10.4 Shoulder 6/10 — caution-rated pressing removed (exposure path)');

{
  // EXERCISE_TAGS has NO 'avoid' shoulder ratings — only 'caution'.
  // At severity 6 the engine now removes 'caution' too (the spec calls
  // for "what specific stress is being removed" — at 6/10 we target the
  // actual exposure rather than a generic lighten).
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Push', exercises: [{ name: 'Bench Press' }, { name: 'Overhead Press' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('shoulder', 6),
    emptyScheduleState(),
  );
  eq('shoulder 6: applied=true', result.applied, true);
  ok('shoulder 6: at least one event', result.events.length >= 1);
  // Engine prefers replace_exercise (Bench → DB Bench, OHP → Landmine
  // Press) but accepts remove_exercise as fallback.
  const mods = result.events.filter(
    (e) => e.kind === 'remove_exercise' || e.kind === 'replace_exercise',
  );
  ok(
    'shoulder 6: ≥2 exercise mods (Bench + OHP)',
    mods.length >= 2,
    `got ${mods.length}`,
  );
  ok(
    'shoulder 6: targets Bench Press',
    mods.some((e) => e.before === 'Bench Press'),
  );
  ok(
    'shoulder 6: targets Overhead Press',
    mods.some((e) => e.before === 'Overhead Press'),
  );
  ok(
    'shoulder 6: no generic lighten on the same day',
    !result.events.some(
      (e) => e.kind === 'lighten_session' && e.date === '2026-04-29',
    ),
  );
}

section('10.5 Shoulder 7/10 — caution-rated work removed');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Push', exercises: [{ name: 'Bench Press' }, { name: 'Overhead Press' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('shoulder', 7),
    emptyScheduleState(),
  );
  eq('shoulder 7: applied=true', result.applied, true);
  const mods = result.events.filter(
    (e) => e.kind === 'remove_exercise' || e.kind === 'replace_exercise',
  );
  ok('shoulder 7: emits ≥2 exercise mods', mods.length >= 2);
  ok(
    'shoulder 7: targets Bench Press',
    mods.some((e) => e.before === 'Bench Press'),
  );
  ok(
    'shoulder 7: targets Overhead Press',
    mods.some((e) => e.before === 'Overhead Press'),
  );
}

section('10.6 Lower back 6/10 — heavy hinge / squat flagged');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Back Squat' }, { name: 'Deadlift' }, { name: 'Goblet Squat' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('lower back', 6),
    emptyScheduleState(),
  );
  eq('lower back 6: applied=true', result.applied, true);
  const mods = result.events.filter(
    (e) => e.kind === 'remove_exercise' || e.kind === 'replace_exercise',
  );
  ok(
    'lower back 6: targets Back Squat',
    mods.some((e) => e.before === 'Back Squat'),
  );
  ok(
    'lower back 6: targets Deadlift',
    mods.some((e) => e.before === 'Deadlift'),
  );
  ok(
    'lower back 6: leaves Goblet Squat alone',
    !mods.some((e) => e.before === 'Goblet Squat'),
  );
}

section('10.7 No future sessions — applied=false, no events');

{
  resetResolver(); // baseWeek is rebuilt with all workouts = null
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 8),
    emptyScheduleState(),
  );
  eq('no future sessions: applied=false', result.applied, false);
  eq('no future sessions: zero events', result.events.length, 0);
  ok(
    'no future sessions: honest reply',
    /aren't any future sessions|no future sessions|couldn't find/i.test(result.reply),
  );
}

section('10.8 No past sessions touched');

{
  resetResolver();
  placeWorkouts({
    0: { name: 'Mon Lower', exercises: [{ name: 'RDLs' }] }, // past
    1: { name: 'Tue Lower', exercises: [{ name: 'RDLs' }] }, // past
    3: { name: 'Thu Lower', exercises: [{ name: 'RDLs' }] }, // future — only event
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('past-only: applied=true', result.applied);
  ok(
    'past-only: zero events on past dates',
    result.events.every((e) => e.date >= FIXED_TODAY),
  );
  // HIGH-risk session now also emits an "Rebuilt for X" add_session_note,
  // so 1 mutation event + 1 note ≤ 2 events on Thu.
  ok('past-only: events all land on Thu', result.events.length >= 1 && result.events.length <= 2);
  eq('past-only: only event date', result.events[0]?.date, '2026-04-30');
}

section('10.9 Fallback creates visible event when nothing risky tagged');

{
  // All future sessions hold only "good" exercises for the chosen bucket.
  // Goblet Squat is SAFE across the injury map → no per-exercise removal
  // can fire. The fallback must emit a visible event so the athlete sees
  // a real protective change.
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Goblet Squat' }] }, // today
    3: { name: 'Thu Lower', exercises: [{ name: 'Goblet Squat' }] }, // future
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  eq('fallback: applied=true', result.applied, true);
  ok('fallback: ≥1 event emitted', result.events.length >= 1);
  ok(
    'fallback: kind is lighten_session at severity 6',
    result.events[0]?.kind === 'lighten_session',
  );
  ok(
    'fallback: targets first future trainable session',
    result.events[0]?.date === '2026-04-29',
  );
}

{
  // Same fixture but severity 8 → fallback uses set_session_recovery.
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'Goblet Squat' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 8),
    emptyScheduleState(),
  );
  ok('fallback (8): applied=true', result.applied);
  ok(
    'fallback (8): kind is set_session_recovery',
    result.events.some((e) => e.kind === 'set_session_recovery'),
  );
}

section('10.10 Severity tiers: 8 + ≥50% risky session → set_session_recovery');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'RDLs' }, { name: 'Deadlift' }, { name: 'Goblet Squat' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 8),
    emptyScheduleState(),
  );
  eq('hamstring 8 + heavy session: applied=true', result.applied, true);
  // Severity 8: caution also removable; with RDLs (avoid) + Deadlift (caution
  // for hamstring) we should hit ≥50% risky and emit a recovery shell.
  ok(
    'hamstring 8: emits set_session_recovery for the heavy day',
    result.events.some(
      (e) => e.kind === 'set_session_recovery' && e.date === '2026-04-29',
    ),
  );
  ok(
    'hamstring 8: NO per-exercise removal on the recovered day',
    !result.events.some(
      (e) => e.kind === 'remove_exercise' && e.date === '2026-04-29',
    ),
  );
}

section('10.11 Lower-limb + running conditioning → swap_conditioning_modality');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Wed Sprints',
      workoutType: 'Conditioning',
      exercises: [{ name: 'Sprint Intervals' }],
    }, // today
    3: { name: 'Thu Lower', exercises: [{ name: 'RDLs' }] }, // future
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('lower-limb + running: applied=true', result.applied);
  ok(
    'lower-limb + running: emits swap_conditioning_modality',
    result.events.some(
      (e) => e.kind === 'swap_conditioning_modality' && e.date === '2026-04-29',
    ),
  );
}

section('10.12 Reply is built from events only (no template avoid bullets)');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'RDLs' }] }, // today
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  // The legacy injury engine adds an "Avoid this week:" template block
  // even when no event backs it. The new handler must NOT.
  ok(
    'reply: no "Avoid this week" template block',
    !/Avoid this week:/i.test(result.reply),
  );
  ok('reply: has Program changes header', /Program changes:/.test(result.reply));
  ok('reply: lists RDLs (event-backed)', /RDLs/.test(result.reply));
}

section('10.13 applied=true ↔ events.length > 0 invariant');

{
  // Sweep across a small grid of severities to confirm the invariant.
  const cases: Array<{ sev: number; expectApplied: boolean }> = [
    { sev: 1, expectApplied: false },
    { sev: 4, expectApplied: false },
    { sev: 5, expectApplied: true },
    { sev: 6, expectApplied: true },
    { sev: 7, expectApplied: true },
    { sev: 8, expectApplied: true },
  ];
  for (const { sev, expectApplied } of cases) {
    resetResolver();
    placeWorkouts({
      2: { name: 'Wed Lower', exercises: [{ name: 'RDLs' }] }, // today
    });
    const result = applyProgramAdjustment(
      injuryRequest('hamstring', sev),
      emptyScheduleState(),
    );
    eq(`severity ${sev}: applied`, result.applied, expectApplied);
    if (expectApplied) {
      ok(
        `severity ${sev}: applied=true ⇒ events.length > 0`,
        result.events.length > 0,
      );
    } else {
      eq(`severity ${sev}: applied=false ⇒ zero events`, result.events.length, 0);
    }
  }
}

section('10.14 No state mutation across injury runs');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Wed Lower', exercises: [{ name: 'RDLs' }] }, // today
  });
  const state = emptyScheduleState();
  const stateSnapshot = JSON.stringify(state);
  applyProgramAdjustment(injuryRequest('hamstring', 6), state);
  applyProgramAdjustment(injuryRequest('knee', 8), state);
  applyProgramAdjustment(injuryRequest('shoulder', 7), state);
  eq(
    'state unchanged after multiple injury runs',
    JSON.stringify(state),
    stateSnapshot,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10.15 RELEVANCE FILTER — never modify recovery; pick relevant fallback
// ─────────────────────────────────────────────────────────────────────
//
// Recovery sessions are already the lightest session of the week. The
// engine must never "lighten" a recovery session just to satisfy the
// fallback rule — that produces a misleading bullet on the Program tab
// and a reply claiming we made a useful change when we didn't.

section('10.15a Hammy 6/10 — Wed Recovery + Thu Team Training + Fri non-hammy upper');

{
  resetResolver();
  // FIXED_TODAY = Wed 2026-04-29.
  // Wed (today)  → Recovery Session  → must NOT be touched
  // Thu          → Team Training     → relevant for hammy (sprinting)
  // Fri          → Upper Push        → not relevant for hammy
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    3: {
      name: 'Team Training',
      workoutType: 'Team Training',
      exercises: [],
    },
    4: {
      name: 'Upper Push',
      exercises: [{ name: 'Bench Press' }, { name: 'Overhead Press' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  // The engine should target Thu Team Training (lower-limb relevance via
  // sprint/run exposure), not Wed Recovery.
  ok('hammy + recovery + team: applied', result.applied === true);
  ok(
    'hammy + recovery + team: NO event lands on Wed Recovery (2026-04-29)',
    !result.events.some((e) => e.date === '2026-04-29'),
    `events on 04-29: ${JSON.stringify(result.events.filter((e) => e.date === '2026-04-29'))}`,
  );
  ok(
    'hammy + recovery + team: targets Thu (Team Training) at 2026-04-30',
    result.events.some((e) => e.date === '2026-04-30'),
  );
  ok(
    'hammy + recovery + team: NO event lands on Fri Upper Push (2026-05-01)',
    !result.events.some((e) => e.date === '2026-05-01'),
  );
  ok(
    'hammy + recovery + team: reply does not claim hammy exercises were REMOVED',
    // The new policy reply names "RDLs, deadlifts, nordics" in the
    // "This week:" rules, but it must NOT claim we removed them — there
    // were no hamstring exercises to remove on this week's sessions.
    !/(removed|swapped)\s+(RDL|deadlift|nordic|hamstring curl)/i.test(result.reply),
  );
}

section('10.15b Hammy 6/10 — Fri Lower with RDLs → targets RDLs (not recovery)');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    4: {
      name: 'Lower Strength',
      exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('hammy + RDLs: applied', result.applied === true);
  ok(
    'hammy + RDLs: targets RDLs (replace or remove)',
    result.events.some(
      (e) =>
        (e.kind === 'remove_exercise' || e.kind === 'replace_exercise') &&
        e.before === 'RDLs',
    ),
  );
  ok(
    'hammy + RDLs: NO event on Wed Recovery',
    !result.events.some((e) => e.date === '2026-04-29'),
  );
}

section('10.15c Hammy 6/10 — only Recovery sessions left → applied=false honest');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    3: {
      name: 'Recovery Walk',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    4: {
      name: 'Recovery Mobility',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  eq('hammy + only recovery: applied=false', result.applied, false);
  eq('hammy + only recovery: zero events', result.events.length, 0);
  ok(
    'hammy + only recovery: reply explains no relevant sessions',
    /no future sessions|aren't any future sessions/i.test(result.reply) &&
      /unchanged/i.test(result.reply),
  );
  ok(
    'hammy + only recovery: reply mentions hamstring',
    /hamstring/i.test(result.reply),
  );
  ok(
    'hammy + only recovery: reply suggests avoiding sprinting',
    /sprint|high-speed/i.test(result.reply),
  );
}

section('10.15d Shoulder 6/10 — Lower-only week → no relevant session');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    4: {
      name: 'Lower Strength',
      exercises: [{ name: 'Goblet Squat' }, { name: 'Walking Lunge' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('shoulder', 6),
    emptyScheduleState(),
  );
  // Shoulder injury, no upper sessions, no shoulder-tagged exercises in
  // the Lower Strength session → no relevant target. Recovery must NOT
  // be picked. Engine returns applied=false with honest reply.
  eq('shoulder + lower-only: applied=false', result.applied, false);
  ok(
    'shoulder + lower-only: NO event on recovery (Wed)',
    !result.events.some((e) => e.date === '2026-04-29'),
  );
  ok(
    'shoulder + lower-only: NO event on lower-only Fri',
    !result.events.some((e) => e.date === '2026-05-01'),
  );
  ok(
    'shoulder + lower-only: reply mentions shoulder',
    /shoulder/i.test(result.reply),
  );
  ok(
    'shoulder + lower-only: reply suggests pressing/overhead caution',
    /press|overhead/i.test(result.reply),
  );
}

section('10.15e Shoulder 6/10 — Upper Push present → targets it');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    4: {
      name: 'Upper Push',
      exercises: [{ name: 'Overhead Press' }, { name: 'Bench Press' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('shoulder', 6),
    emptyScheduleState(),
  );
  ok('shoulder + Upper Push: applied', result.applied === true);
  ok(
    'shoulder + Upper Push: targets Fri',
    result.events.some((e) => e.date === '2026-05-01'),
  );
  ok(
    'shoulder + Upper Push: no event on Wed Recovery',
    !result.events.some((e) => e.date === '2026-04-29'),
  );
}

section('10.15f Back 6/10 — Heavy hinge present → targets axial loading');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    4: {
      name: 'Lower Strength',
      exercises: [{ name: 'Conventional Deadlift' }, { name: 'Back Squat' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('lower back', 6),
    emptyScheduleState(),
  );
  ok('back + heavy hinge: applied', result.applied === true);
  ok(
    'back + heavy hinge: at least one remove/replace/recover event',
    result.events.some(
      (e) =>
        e.kind === 'remove_exercise' ||
        e.kind === 'replace_exercise' ||
        e.kind === 'set_session_recovery',
    ),
  );
  ok(
    'back + heavy hinge: no event on Wed Recovery',
    !result.events.some((e) => e.date === '2026-04-29'),
  );
}

section('10.15g GLOBAL invariant — no injury event ever lands on a recovery session');

{
  // Run a matrix of bucket × severity × week-shape combinations and assert
  // that NO emitted event ever targets a recovery date.
  const buckets = ['hamstring', 'knee', 'shoulder', 'lower back', 'calf'];
  const severities = [5, 6, 7, 8];
  let recoveryEventCount = 0;
  let totalRuns = 0;

  for (const bp of buckets) {
    for (const sev of severities) {
      // Shape A: Wed recovery + Thu team + Fri upper push
      resetResolver();
      placeWorkouts({
        2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
        3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
        4: { name: 'Upper Push', exercises: [{ name: 'Overhead Press' }, { name: 'Bench Press' }] },
      });
      let result = applyProgramAdjustment(injuryRequest(bp, sev), emptyScheduleState());
      totalRuns++;
      if (result.events.some((e) => e.date === '2026-04-29')) recoveryEventCount++;

      // Shape B: Wed recovery + Fri lower
      resetResolver();
      placeWorkouts({
        2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
        4: { name: 'Lower Strength', exercises: [{ name: 'Back Squat' }, { name: 'RDLs' }] },
      });
      result = applyProgramAdjustment(injuryRequest(bp, sev), emptyScheduleState());
      totalRuns++;
      if (result.events.some((e) => e.date === '2026-04-29')) recoveryEventCount++;

      // Shape C: Wed recovery + Thu recovery + Fri recovery (no relevant)
      resetResolver();
      placeWorkouts({
        2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
        3: { name: 'Recovery Walk', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
        4: { name: 'Recovery Mobility', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
      });
      result = applyProgramAdjustment(injuryRequest(bp, sev), emptyScheduleState());
      totalRuns++;
      if (result.events.length > 0) recoveryEventCount++;
    }
  }

  eq(
    `recovery-targeting events across ${totalRuns} runs`,
    recoveryEventCount,
    0,
  );
}

section('10.15h Recovery is also protected from per-exercise removes (severity 8)');

{
  // Severity 8 + tagged "avoid" exercise on a recovery-flagged day must
  // still NOT be touched. We don't expect this in practice (recovery is
  // empty by construction) but the invariant should hold defensively.
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [{ name: 'RDLs' }], // synthetic — recovery with exercise
    },
    4: { name: 'Lower Strength', exercises: [{ name: 'RDLs' }] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 8),
    emptyScheduleState(),
  );
  ok('hammy 8 + synthetic recovery: applied', result.applied === true);
  ok(
    'hammy 8 + synthetic recovery: NO event lands on Wed (recovery)',
    !result.events.some((e) => e.date === '2026-04-29'),
  );
}

section('10.15i Hammy 6/10 — running conditioning on Thu → swap modality');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    3: {
      name: 'Sprint Intervals',
      workoutType: 'Conditioning',
      exercises: [{ name: '10m Sprint' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('hammy 6 + running cond: applied', result.applied === true);
  ok(
    'hammy 6 + running cond: NO event on Wed Recovery',
    !result.events.some((e) => e.date === '2026-04-29'),
  );
  ok(
    'hammy 6 + running cond: targets Thu',
    result.events.some((e) => e.date === '2026-04-30'),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10.16 EXPOSURE-LEVEL ACTION CHOOSER — what specific stress is removed
// ─────────────────────────────────────────────────────────────────────
//
// The engine no longer emits generic "lighten_session" on team training
// or running conditioning. It emits the specific event that addresses
// the actual exposure (sprinting, pressing, hinges, etc.).

section('10.16a Hammy 6/10 + RDL → RDL is removed (not generic lighten)');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    4: {
      name: 'Lower Strength',
      exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('hammy 6 + RDL: applied', result.applied === true);
  const mods = result.events.filter(
    (e) => e.kind === 'remove_exercise' || e.kind === 'replace_exercise',
  );
  ok(
    'hammy 6 + RDL: emits exercise modification',
    mods.length >= 1,
  );
  ok(
    'hammy 6 + RDL: targets RDLs by name',
    mods.some((e) => e.before === 'RDLs'),
  );
  ok(
    'hammy 6 + RDL: NO generic lighten on the strength day',
    !result.events.some(
      (e) => e.kind === 'lighten_session' && e.date === '2026-05-01',
    ),
  );
  ok(
    'hammy 6 + RDL: reply lists RDLs',
    /RDLs/.test(result.reply),
  );
}

section('10.16b Hammy 6/10 + Team Training → add_session_note (not lighten)');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    3: {
      name: 'Team Training',
      workoutType: 'Team Training',
      exercises: [],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('hammy 6 + team: applied', result.applied === true);
  ok(
    'hammy 6 + team: emits add_session_note (not lighten_session)',
    result.events.some((e) => e.kind === 'add_session_note'),
    `events: ${JSON.stringify(result.events.map((e) => e.kind))}`,
  );
  ok(
    'hammy 6 + team: NO lighten_session emitted',
    !result.events.some((e) => e.kind === 'lighten_session'),
  );
  const note = result.events.find((e) => e.kind === 'add_session_note');
  ok(
    'hammy 6 + team: note text mentions sprinting / high-speed',
    typeof note?.after === 'string' && /sprint|high-speed/i.test(String(note?.after)),
    `note.after: ${JSON.stringify(note?.after)}`,
  );
  ok(
    'hammy 6 + team: bullet says "no sprinting" in/at Team Training',
    /sprint/i.test(result.reply) && /Team Training/i.test(result.reply),
  );
  ok(
    'hammy 6 + team: reply does NOT say "lightened Team Training"',
    !/lightened\s+team training/i.test(result.reply),
  );
}

section('10.16c Hammy 6/10 + only Recovery → applied=false honest');

{
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Recovery Session',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
    3: {
      name: 'Recovery Walk',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  eq('hammy + only recovery: applied=false', result.applied, false);
  eq('hammy + only recovery: zero events', result.events.length, 0);
}

section('10.16d Shoulder 6/10 + Upper Push → pressing removed');

{
  resetResolver();
  placeWorkouts({
    4: {
      name: 'Upper Push',
      exercises: [{ name: 'Bench Press' }, { name: 'Overhead Press' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('shoulder', 6),
    emptyScheduleState(),
  );
  ok('shoulder 6 + push: applied', result.applied === true);
  const mods = result.events.filter(
    (e) => e.kind === 'remove_exercise' || e.kind === 'replace_exercise',
  );
  ok(
    'shoulder 6 + push: targets Bench Press',
    mods.some((e) => e.before === 'Bench Press'),
  );
  ok(
    'shoulder 6 + push: targets Overhead Press',
    mods.some((e) => e.before === 'Overhead Press'),
  );
}

section('10.16e GLOBAL exposure invariant — no recovery ever modified');

{
  // Same shape as 10.15g but explicitly checks the new event kind too:
  // the exposure path must never emit add_session_note on a recovery day.
  const buckets = ['hamstring', 'knee', 'shoulder', 'lower back'];
  const severities = [5, 6, 7, 8];
  let recoveryEventCount = 0;
  let totalRuns = 0;
  let lightenedRecoveryCount = 0;

  for (const bp of buckets) {
    for (const sev of severities) {
      resetResolver();
      placeWorkouts({
        2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
        3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
        4: { name: 'Lower Strength', exercises: [{ name: 'Back Squat' }, { name: 'RDLs' }] },
      });
      const result = applyProgramAdjustment(injuryRequest(bp, sev), emptyScheduleState());
      totalRuns++;
      if (result.events.some((e) => e.date === '2026-04-29')) recoveryEventCount++;
      // The "meaningless lighten recovery" guarantee — no lighten_session
      // OR add_session_note must ever land on the Wed recovery day.
      if (
        result.events.some(
          (e) =>
            e.date === '2026-04-29' &&
            (e.kind === 'lighten_session' ||
              e.kind === 'add_session_note' ||
              e.kind === 'set_session_recovery'),
        )
      ) {
        lightenedRecoveryCount++;
      }
    }
  }

  eq(
    `recovery-targeting events across ${totalRuns} runs`,
    recoveryEventCount,
    0,
  );
  eq(
    `meaningless lighten/note/recovery on recovery day`,
    lightenedRecoveryCount,
    0,
  );
}

section('10.16f Hammy 6/10 — RDL session AND Team Training → BOTH addressed');

{
  // Validates that the per-day chooser doesn't stop at the first match
  // — it walks every adjustable day and emits the most specific action.
  resetResolver();
  placeWorkouts({
    2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
    3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
    4: { name: 'Lower Strength', exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('hammy 6 + RDL + team: applied', result.applied === true);
  ok(
    'hammy 6: targets RDLs on Fri',
    result.events.some(
      (e) =>
        (e.kind === 'remove_exercise' || e.kind === 'replace_exercise') &&
        e.before === 'RDLs' &&
        e.date === '2026-05-01',
    ),
  );
  ok(
    'hammy 6: notes Team Training on Thu',
    result.events.some(
      (e) => e.kind === 'add_session_note' && e.date === '2026-04-30',
    ),
  );
}

section('10.16g add_session_note bullet format');

{
  resetResolver();
  placeWorkouts({
    3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  // The reply bullet must include the actual exposure note, not "lightened".
  ok(
    'reply bullet contains "no sprinting"',
    /no sprinting/i.test(result.reply),
  );
  ok(
    'reply bullet contains "Team Training"',
    /Team Training/.test(result.reply),
  );
  ok(
    'reply does NOT say "lightened Team Training"',
    !/lightened\s+team training/i.test(result.reply),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10.17 GLOBAL INJURY POLICY — week-wide rules in reply + consistency
// ─────────────────────────────────────────────────────────────────────

import { buildInjuryPolicy } from '../utils/programAdjustmentEngine';

section('10.17a buildInjuryPolicy(hamstring, 6) → forbid sprinting + heavy hinge');

{
  const p = buildInjuryPolicy('hamstring' as any, 6);
  eq('hamstring 6: bucket', p.bucket, 'hamstring');
  eq('hamstring 6: severity', p.severity, 6);
  eq('hamstring 6: forbid.sprinting', p.forbid.sprinting, true);
  eq('hamstring 6: forbid.highSpeedRunning', p.forbid.highSpeedRunning, true);
  eq('hamstring 6: forbid.heavyHinge', p.forbid.heavyHinge, true);
  eq('hamstring 6: forbid.heavyPressing', p.forbid.heavyPressing, false);
  ok(
    'hamstring 6: globalRules contains "No sprinting"',
    p.globalRules.some((r: string) => /No sprinting/i.test(r)),
  );
  ok(
    'hamstring 6: globalRules contains "No heavy hinge"',
    p.globalRules.some((r: string) => /heavy hinge/i.test(r)),
  );
  ok(
    'hamstring 6: preserveText contains "Upper body"',
    p.preserveText.some((t: string) => /Upper body/i.test(t)),
  );
  ok(
    'hamstring 6: closingAdvice mentions physio',
    p.closingAdvice != null && /physio/i.test(p.closingAdvice as string),
  );
}

section('10.17b buildInjuryPolicy(shoulder, 6) → forbid pressing + overhead');

{
  const p = buildInjuryPolicy('shoulder' as any, 6);
  eq('shoulder 6: forbid.heavyPressing', p.forbid.heavyPressing, true);
  eq('shoulder 6: forbid.overheadLoading', p.forbid.overheadLoading, true);
  eq('shoulder 6: forbid.sprinting', p.forbid.sprinting, false);
  ok(
    'shoulder 6: globalRules contains "No heavy pressing"',
    p.globalRules.some((r: string) => /heavy pressing/i.test(r)),
  );
  ok(
    'shoulder 6: preserveText contains "Lower body"',
    p.preserveText.some((t: string) => /Lower body/i.test(t)),
  );
}

section('10.17c buildInjuryPolicy(lowerBack, 6) → forbid axial + heavy hinge');

{
  const p = buildInjuryPolicy('lowerBack' as any, 6);
  eq('lowerBack 6: forbid.axialLoading', p.forbid.axialLoading, true);
  eq('lowerBack 6: forbid.heavyHinge', p.forbid.heavyHinge, true);
  ok(
    'lowerBack 6: globalRules contains "axial loading"',
    p.globalRules.some((r: string) => /axial loading/i.test(r)),
  );
}

section('10.17d Reply structure — hammy 6/10 with team training');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
    3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
    4: { name: 'Lower Strength', exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('reply: applied', result.applied === true);
  ok(
    'reply: contains "This week:" header',
    /This week:/.test(result.reply),
  );
  ok(
    'reply: contains "Program changes:" header',
    /Program changes:/.test(result.reply),
  );
  ok(
    'reply: contains "Keep:" header',
    /Keep:/.test(result.reply),
  );
  ok(
    'reply: lists "No sprinting" in This week section',
    /No sprinting/i.test(result.reply),
  );
  ok(
    'reply: lists "No heavy hinge" in This week section',
    /heavy hinge/i.test(result.reply),
  );
  ok(
    'reply: closing advice mentions physio',
    /physio/i.test(result.reply),
  );
  ok(
    'reply: ends with "Program updated"',
    /Program updated — check your week\.\s*$/.test(result.reply),
  );
  ok(
    'reply: section order — This week before Program changes',
    result.reply.indexOf('This week:') < result.reply.indexOf('Program changes:'),
  );
  ok(
    'reply: section order — Program changes before Keep',
    result.reply.indexOf('Program changes:') < result.reply.indexOf('Keep:'),
  );
}

section('10.17e Hammy 6/10 — "no sprinting" globally consistent across all running days');

{
  // Multiple days with running exposure: team training Thu + sprint
  // intervals Fri. Both must receive an event so the global rule "no
  // sprinting" doesn't contradict the program changes.
  resetResolver();
  placeWorkouts({
    2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
    3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
    4: {
      name: 'Sprint Intervals',
      workoutType: 'Conditioning',
      exercises: [{ name: '10m Sprint' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('hammy + multi-running: applied', result.applied === true);
  ok(
    'hammy + multi-running: Thu has an event',
    result.events.some((e) => e.date === '2026-04-30'),
  );
  ok(
    'hammy + multi-running: Fri has an event',
    result.events.some((e) => e.date === '2026-05-01'),
  );
  // Verify NO running-exposure day was left untouched (consistency).
  const runningExposureDates = ['2026-04-30', '2026-05-01'];
  for (const d of runningExposureDates) {
    ok(
      `hammy + multi-running: running day ${d} addressed`,
      result.events.some((e) => e.date === d),
    );
  }
}

section('10.17f Shoulder 6/10 — "no pressing" appears in reply');

{
  resetResolver();
  placeWorkouts({
    4: {
      name: 'Upper Push',
      exercises: [{ name: 'Bench Press' }, { name: 'Overhead Press' }],
    },
  });
  const result = applyProgramAdjustment(
    injuryRequest('shoulder', 6),
    emptyScheduleState(),
  );
  ok('shoulder + push: applied', result.applied === true);
  ok(
    'shoulder + push: reply contains "No heavy pressing"',
    /No heavy pressing/i.test(result.reply),
  );
  ok(
    'shoulder + push: reply contains "No overhead"',
    /No overhead/i.test(result.reply),
  );
  ok(
    'shoulder + push: reply contains "Keep:" with Lower body',
    /Keep:[\s\S]*Lower body/i.test(result.reply),
  );
  ok(
    'shoulder + push: reply does not mention sprinting',
    !/sprinting/i.test(result.reply),
  );
}

section('10.17g No-relevant-session reply still lists policy + Keep');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
    3: { name: 'Recovery Mobility', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  eq('no-relevant: applied=false', result.applied, false);
  ok(
    'no-relevant: reply still lists "No sprinting"',
    /No sprinting/i.test(result.reply),
  );
  ok(
    'no-relevant: reply still has Keep section',
    /Keep:/.test(result.reply),
  );
  ok(
    'no-relevant: reply explains program unchanged',
    /unchanged/i.test(result.reply),
  );
  ok(
    'no-relevant: reply does NOT have Program changes section',
    !/Program changes:/.test(result.reply),
  );
}

section('10.17h Consistency: tagged + team + running cond all addressed');

{
  // The strongest week-wide consistency check: 4 different running
  // exposures + tagged hinge work on different days, all must be
  // addressed when policy.forbid.sprinting is true.
  resetResolver();
  placeWorkouts({
    2: {
      name: 'Sprint Intervals',
      workoutType: 'Conditioning',
      exercises: [{ name: '10m Sprint' }],
    }, // Wed (today)
    3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] }, // Thu
    4: { name: 'Lower Strength', exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }] }, // Fri
    5: { name: 'Team Training', workoutType: 'Team Training', exercises: [] }, // Sat
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('consistency: applied', result.applied === true);
  // Each running-exposure day must have at least one event.
  const days = ['2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02'];
  for (const d of days) {
    ok(
      `consistency: ${d} has at least one event`,
      result.events.some((e) => e.date === d),
      `events on ${d}: ${JSON.stringify(result.events.filter((e) => e.date === d).map((e) => e.kind))}`,
    );
  }
  // The hinge work is removed (matches "no heavy hinge" rule).
  ok(
    'consistency: RDLs targeted on Fri (replace or remove)',
    result.events.some(
      (e) =>
        (e.kind === 'remove_exercise' || e.kind === 'replace_exercise') &&
        e.before === 'RDLs' &&
        e.date === '2026-05-01',
    ),
  );
  // No reply contradiction: if "No sprinting" appears in This week,
  // every running-exposure day above MUST have its own event.
  ok(
    'consistency: reply contains "No sprinting" rule',
    /No sprinting/i.test(result.reply),
  );
}

section('10.17i Severity 7+ closing advice escalates to "Get a physio"');

{
  const p7 = buildInjuryPolicy('hamstring' as any, 7);
  ok(
    'hamstring 7: closing advice = "Get a physio"',
    p7.closingAdvice != null && /^Get a physio/i.test(p7.closingAdvice as string),
  );
  const p6 = buildInjuryPolicy('hamstring' as any, 6);
  ok(
    "hamstring 6: closing advice = soft physio suggestion",
    p6.closingAdvice != null && /worth getting a physio/i.test(p6.closingAdvice as string),
  );
}

section('10.17j Unknown bucket policy — generic rules only, no specific exposure');

{
  const p = buildInjuryPolicy(null, 6);
  eq('unknown 6: bucket', p.bucket, null);
  eq('unknown 6: forbid.sprinting (nothing specific)', p.forbid.sprinting, false);
  ok(
    'unknown 6: globalRules has at least one entry',
    p.globalRules.length >= 1,
  );
  ok(
    'unknown 6: preserveText contains "Recovery work"',
    p.preserveText.some((t: string) => /Recovery work/i.test(t)),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10.18 REPLACEMENT SUGGESTIONS — "Instead:" block in reply
// ─────────────────────────────────────────────────────────────────────
//
// The reply must never list ONLY restrictions. Whenever the policy has
// global rules, it must offer at least one concrete alternative so the
// athlete knows what TO do, not just what to avoid.

section('10.18a buildInjuryPolicy(hamstring, 6).replacements present');

{
  const p = buildInjuryPolicy('hamstring' as any, 6);
  ok('hamstring 6: replacements has ≥1 entry', p.replacements.length >= 1);
  ok(
    'hamstring 6: includes a bike/rower alternative for sprint work',
    p.replacements.some((r: string) => /bike|rower|ski erg/i.test(r) && /sprint|running/i.test(r)),
  );
  ok(
    'hamstring 6: includes a hinge alternative',
    p.replacements.some(
      (r: string) => /single-leg|isometric/i.test(r) && /hinge/i.test(r),
    ),
  );
}

section('10.18b buildInjuryPolicy(shoulder, 6).replacements present');

{
  const p = buildInjuryPolicy('shoulder' as any, 6);
  ok('shoulder 6: replacements has ≥1 entry', p.replacements.length >= 1);
  ok(
    'shoulder 6: includes a landmine / DB / isometric alternative',
    p.replacements.some(
      (r: string) => /landmine|DB|isometric/i.test(r),
    ),
  );
}

section('10.18c buildInjuryPolicy(lowerBack, 6).replacements present');

{
  const p = buildInjuryPolicy('lowerBack' as any, 6);
  ok('lowerBack 6: replacements has ≥1 entry', p.replacements.length >= 1);
  ok(
    'lowerBack 6: includes machine / supported alternative',
    p.replacements.some((r: string) => /machine|supported/i.test(r)),
  );
}

section('10.18d Reply includes "Instead:" block — hamstring 6 + team');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
    3: { name: 'Team Training', workoutType: 'Team Training', exercises: [] },
    4: { name: 'Lower Strength', exercises: [{ name: 'RDLs' }, { name: 'Goblet Squat' }] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  ok('reply: applied', result.applied === true);
  ok(
    'reply: contains "Instead:" header',
    /Instead:/.test(result.reply),
  );
  ok(
    'reply: Instead block mentions bike/rower',
    /Instead:[\s\S]*?(bike|rower|ski erg)/i.test(result.reply),
  );
  // Section order: This week → Instead → Program changes → Keep → footer.
  const idxThisWeek = result.reply.indexOf('This week:');
  const idxInstead = result.reply.indexOf('Instead:');
  const idxChanges = result.reply.indexOf('Program changes:');
  const idxKeep = result.reply.indexOf('Keep:');
  ok(
    'reply: This week comes before Instead',
    idxThisWeek >= 0 && idxInstead > idxThisWeek,
    `thisWeek=${idxThisWeek} instead=${idxInstead}`,
  );
  ok(
    'reply: Instead comes before Program changes',
    idxInstead > 0 && idxChanges > idxInstead,
    `instead=${idxInstead} changes=${idxChanges}`,
  );
  ok(
    'reply: Program changes comes before Keep',
    idxChanges > 0 && idxKeep > idxChanges,
  );
}

section('10.18e No-relevant-session reply also includes Instead block');

{
  resetResolver();
  placeWorkouts({
    2: { name: 'Recovery Session', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
    3: { name: 'Recovery Walk', workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] },
  });
  const result = applyProgramAdjustment(
    injuryRequest('hamstring', 6),
    emptyScheduleState(),
  );
  eq('no-relevant: applied=false', result.applied, false);
  ok(
    'no-relevant: reply contains "Instead:" header',
    /Instead:/.test(result.reply),
  );
  ok(
    'no-relevant: reply mentions a bike/rower alternative',
    /bike|rower|ski erg/i.test(result.reply),
  );
}

section('10.18f INVARIANT — every policy with rules has ≥1 replacement');

{
  // Walk all known buckets × severities. Anywhere globalRules has at
  // least one entry, replacements MUST also have at least one entry —
  // we never reply with restrictions only.
  const buckets: any[] = [
    'hamstring', 'knee', 'calf', 'ankle', 'adductor', 'pubalgia',
    'shoulder', 'elbow', 'wrist', 'lowerBack',
  ];
  const severities = [5, 6, 7, 8];
  let violations = 0;
  for (const b of buckets) {
    for (const sev of severities) {
      const p = buildInjuryPolicy(b, sev);
      if (p.globalRules.length > 0 && p.replacements.length === 0) violations++;
    }
  }
  // Also check unknown bucket — when it has rules it must have a
  // replacement too (otherwise the athlete only hears "stop").
  for (const sev of severities) {
    const p = buildInjuryPolicy(null, sev);
    if (p.globalRules.length > 0 && p.replacements.length === 0) violations++;
  }
  eq('rules ⇒ replacements invariant violations', violations, 0);
}

section('10.18g Reply NEVER contains restrictions without alternatives');

{
  // End-to-end check: any reply that prints "This week:" must also
  // print "Instead:".
  const cases: Array<[string, number]> = [
    ['hamstring', 6], ['shoulder', 6], ['lower back', 6],
    ['knee', 7], ['hamstring', 8],
  ];
  let restrictionsOnly = 0;
  for (const [bp, sev] of cases) {
    resetResolver();
    placeWorkouts({
      4: { name: 'Lower Strength', exercises: [{ name: 'Back Squat' }] },
    });
    const result = applyProgramAdjustment(injuryRequest(bp, sev), emptyScheduleState());
    if (/This week:/.test(result.reply) && !/Instead:/.test(result.reply)) {
      restrictionsOnly++;
    }
  }
  eq('replies with rules-only (no alternatives)', restrictionsOnly, 0);
}

// ─── Summary ───────────────────────────────────────────────────────────

console.log(`\n──────────────────────────────────────────────`);
console.log(`Pass: ${pass}   Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
console.log('──────────────────────────────────────────────\n');

process.exit(fail > 0 ? 1 : 0);
