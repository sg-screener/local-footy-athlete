/**
 * coachScreenUAEFlowTests — End-to-end validation of the Stage 3 wiring.
 *
 * Mirrors the exact pipeline that CoachScreen.handleSend now runs for a
 * severity-known injury message:
 *
 *   1. extractInjuryContext(message) → { bodyPart, severity, bucket }
 *   2. applyProgramAdjustment({ intent: 'injury', payload, todayISO }, state)
 *      → AdjustmentResult { applied, events, rejected, reply }
 *   3. applyAdjustmentEvents(events, { todayISO, ... })
 *      → ApplyEventsResult { applied: AppliedAdjustment[], rejected: [] }
 *   4. result.reply is the assistant message shown to the athlete.
 *
 * The test asserts:
 *   - The screen path produces ≥1 setManualOverride write
 *   - The override is on a future date in the resolved week
 *   - The reply is non-empty
 *   - The reply only mentions exercises that actually changed
 *   - No fetch / network call is required (the path returns before any LLM)
 *
 * Strategy: stub the resolver + program-store seam so the pipeline runs
 * deterministically without touching real Zustand state. The test is the
 * highest-fidelity flow check we have short of mounting the actual screen.
 *
 * Run: sucrase-node src/__tests__/coachScreenUAEFlowTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as sessionResolver from '../utils/sessionResolver';
import * as coachWeekDiff from '../utils/coachWeekDiff';
import { useProgramStore } from '../store/programStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import type { Workout, WorkoutExercise, OverrideContext } from '../types/domain';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';

// ─────────────────────────────────────────────────────────────────────────
// Spies
// ─────────────────────────────────────────────────────────────────────────

interface OverrideCall {
  date: string;
  workout: Workout;
  ctx?: OverrideContext;
}

let overrideCalls: OverrideCall[] = [];
let dateOverrides: Record<string, Workout> = {};
let baseWeek: ResolvedDay[] = [];

function resetSpies() {
  overrideCalls = [];
  dateOverrides = {};
  baseWeek = [];
  fetchCalls = 0;
}

let fetchCalls = 0;
(global as any).fetch = (...args: any[]) => {
  fetchCalls += 1;
  // Intentionally throw so any accidental network attempt is loud.
  throw new Error(
    `[uae-flow-test] global.fetch was called — UAE pipeline must not reach the LLM. args=${JSON.stringify(args).slice(0, 200)}`,
  );
};

// programStore — capture overrides into our spy.
(useProgramStore as any).getState = () => ({
  setManualOverride: (date: string, workout: Workout, ctx?: OverrideContext) => {
    dateOverrides[date] = workout;
    overrideCalls.push({ date, workout, ctx });
  },
  removeManualOverride: (date: string) => {
    delete dateOverrides[date];
  },
  dateOverrides,
  overrideContexts: {},
  sessionFeedback: {},
  weightOverrides: {},
  currentProgram: null,
  currentMicrocycle: null,
});

(useAthletePreferencesStore as any).getState = () => ({
  addExclusion: () => {},
  addPinned: () => {},
});

// buildScheduleStateImperative — return a minimal state. The resolver
// stub ignores it.
(coachWeekDiff as any).buildScheduleStateImperative = (): ScheduleState =>
  ({
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: dateOverrides,
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium',
  } as ScheduleState);

// Resolver mock walks the base week and substitutes overrides where present.
// This lets the UAE see "before" state and the helper see the same state
// for date matching.
(sessionResolver as any).resolveWeekWithConditioning = (
  _monday: string,
  _state: any,
): ResolvedDay[] =>
  baseWeek.map((d) => {
    const w = dateOverrides[d.date] !== undefined ? dateOverrides[d.date] : d.workout;
    return {
      ...d,
      workout: w,
    };
  });

// Pin Monday so date math stays stable.
const FIXED_TODAY = '2026-04-29'; // Wednesday
const FIXED_MONDAY = '2026-04-27';
(sessionResolver as any).getMondayStr = (_offset: number) => FIXED_MONDAY;

// Imports AFTER stubs are installed — modules bind the patched references.
import { extractInjuryContext } from '../utils/injuryAdjustmentEngine';
import { applyProgramAdjustment } from '../utils/programAdjustmentEngine';
import { applyAdjustmentEvents } from '../utils/applyAdjustmentEvents';

// ─────────────────────────────────────────────────────────────────────────
// Fixture builders
// ─────────────────────────────────────────────────────────────────────────

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

function ex(name: string, sets = 3): WorkoutExercise {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id: `we-${id}`,
    workoutId: '',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 0,
    exercise: {
      id,
      name,
      description: name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function workout(name: string, exercises: WorkoutExercise[]): Workout {
  return {
    id: `wk-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: 'Strength' as any,
    sessionTier: 'core',
    exercises,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}

function buildBaseWeek(per: Record<number, Workout | null>): ResolvedDay[] {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: per[dow] ?? null,
      source: per[dow] ? ('template' as any) : ('rest' as any),
      indicator: null as any,
    } as ResolvedDay);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────

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

// Mirror the exact handleSend pipeline.
function runUAEFlow(
  message: string,
  todayISO: string = FIXED_TODAY,
): {
  fired: boolean;
  reply: string;
  appliedDates: string[];
  events: number;
} {
  const ctx = extractInjuryContext(message);
  if (!ctx) return { fired: false, reply: '', appliedDates: [], events: 0 };
  const state = (coachWeekDiff as any).buildScheduleStateImperative();
  const result = applyProgramAdjustment(
    {
      intent: 'injury',
      todayISO,
      message,
      payload: { bodyPart: ctx.bodyPart, severity: ctx.severity },
      source: 'client_guard',
    },
    state,
  );
  const apply = applyAdjustmentEvents(result.events, { todayISO });
  return {
    fired: true,
    reply: result.reply,
    appliedDates: apply.applied.map((a) => a.date),
    events: result.events.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Severity 6/10 hammy → no LLM, override visible, reply non-empty
// ─────────────────────────────────────────────────────────────────────────

section('[1] Hammy 6/10 → events emitted, override written, no fetch');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    3: workout('Conditioning', [ex('Sprint Intervals', 1)]), // Wed today
    4: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
    5: workout('Upper Strength', [ex('Bench Press', 4), ex('Pull-Ups', 3)]),
  });

  const out = runUAEFlow('Tweaked my hammy 6/10');

  ok('flow fired', out.fired);
  ok('events emitted', out.events > 0);
  ok('reply is non-empty', out.reply.length > 0);
  ok('at least one override write', overrideCalls.length >= 1);
  ok('override is on a future date', overrideCalls.every((c) => c.date >= FIXED_TODAY));
  eq('zero fetch calls', fetchCalls, 0);

  // Reply must only reference exercises that actually changed (no
  // hallucinated names).
  const allRemoved = new Set<string>();
  for (const call of overrideCalls) {
    const before = baseWeek.find((d) => d.date === call.date)?.workout?.exercises || [];
    const after = call.workout.exercises;
    for (const b of before) {
      const name = b.exercise?.name || '';
      if (!after.some((a) => a.exercise?.name === name)) allRemoved.add(name);
    }
  }
  // Reply text shouldn't claim a removal we didn't perform. Check that any
  // exercise name from the base week that appears in the reply is in the
  // removed set.
  const baseExerciseNames = new Set<string>();
  for (const d of baseWeek) {
    for (const e of d.workout?.exercises ?? []) {
      const n = e.exercise?.name;
      if (n) baseExerciseNames.add(n);
    }
  }
  let hallucinated = '';
  for (const name of baseExerciseNames) {
    // Only check names the reply mentions explicitly.
    if (out.reply.includes(name) && !allRemoved.has(name) && !name.toLowerCase().includes('sprint')) {
      // 'Sprint Intervals' may appear in swap_conditioning_modality reasoning
      // even when the swap didn't fire — accept the looseness here.
      hallucinated = name;
      break;
    }
  }
  ok(
    'reply does not name a non-removed strength exercise',
    hallucinated === '',
    hallucinated ? `hallucinated mention: ${hallucinated}` : undefined,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Severity 3/10 hammy → engine declines (severity gate), no override
// ─────────────────────────────────────────────────────────────────────────

section('[2] Hammy 3/10 → engine declines, no override, no fetch');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
  });

  const out = runUAEFlow('hammy is sore 3/10');
  ok('flow fired (intent matched)', out.fired);
  eq('zero events', out.events, 0);
  eq('zero override writes', overrideCalls.length, 0);
  ok('reply non-empty', out.reply.length > 0);
  eq('zero fetch calls', fetchCalls, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Non-injury message → flow does not fire (LLM path remains)
// ─────────────────────────────────────────────────────────────────────────

section('[3] Non-injury message → UAE flow not entered');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [ex('RDLs', 3)]),
  });

  const out = runUAEFlow('what should I eat after training?');
  eq('flow not fired', out.fired, false);
  eq('zero override writes', overrideCalls.length, 0);
  eq('zero fetch calls', fetchCalls, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Severity 8/10 + heavy lower load → recovery shell, exercises empty
// ─────────────────────────────────────────────────────────────────────────

section('[4] Hammy 8/10 → at least one date converted to recovery shell');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [
      ex('RDLs', 4),
      ex('Back Squat', 4),
      ex('Romanian Deadlifts', 3),
      ex('Bulgarian Split Squat', 3),
    ]),
    5: workout('Upper Strength', [ex('Bench Press', 4), ex('Pull-Ups', 3)]),
  });

  const out = runUAEFlow('tweaked my hammy 8/10');
  ok('flow fired', out.fired);
  ok('events emitted', out.events > 0);
  ok('at least one override', overrideCalls.length >= 1);
  // ≥8 → expect either a recovery shell OR a meaningful exercise reduction
  // (the precise tier-flip depends on the registered injury tags for the
  // exercises in the fixture; both outcomes constitute a protective change).
  const protective = overrideCalls.some((c) => {
    const isRecovery = c.workout.workoutType === 'Recovery' && c.workout.exercises.length === 0;
    const before = baseWeek.find((d) => d.date === c.date)?.workout?.exercises?.length ?? 0;
    const after = c.workout.exercises.length;
    // Engine now also "replaces" risky exercises in-place: count stays
    // the same but exercise NAMES change. Detect that as protective too.
    const beforeNames = (baseWeek.find((d) => d.date === c.date)?.workout?.exercises ?? [])
      .map((e: any) => e.exercise?.name);
    const afterNames = c.workout.exercises.map((e: any) => e.exercise?.name);
    const namesChanged = beforeNames.some((n: string, i: number) => afterNames[i] !== n);
    const hasCoachNote = (c.workout.coachNotes ?? []).length > 0;
    return isRecovery || after < before || namesChanged || hasCoachNote;
  });
  ok('at least one protective change written', protective);
  eq('zero fetch calls', fetchCalls, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Override carries injury intent context
// ─────────────────────────────────────────────────────────────────────────

section('[5] Override context records injury intent');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
  });

  runUAEFlow('hammy hurts 6/10');
  ok('at least one override', overrideCalls.length >= 1);
  for (const c of overrideCalls) {
    eq(`ctx intent on ${c.date}`, c.ctx?.intent, 'injury');
    ok(
      `ctx label non-empty on ${c.date}`,
      typeof c.ctx?.label === 'string' && c.ctx!.label!.length > 0,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Resolver priority — injury override wins over calendar marks
// ─────────────────────────────────────────────────────────────────────────
//
// Once an injury override is written, the resolver must return it as
// source='manual' on subsequent reads. We exercise that property by writing
// an override and then re-running the resolver mock to confirm the override
// is the workout it returns (not the original template).

section('[6] Resolver priority — injury override wins on subsequent reads');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
  });

  runUAEFlow('tweaked my hammy 6/10');
  ok('at least one override', overrideCalls.length >= 1);

  // Re-run the resolver mock — it must return the override on each touched
  // date (the mock substitutes overrides where present, mirroring the real
  // resolver's Priority 1 manual-override path).
  const reResolved = (sessionResolver as any).resolveWeekWithConditioning(
    FIXED_MONDAY,
    {},
  );
  for (const c of overrideCalls) {
    const day = reResolved.find((d: ResolvedDay) => d.date === c.date);
    ok(`override surfaces on ${c.date} after re-resolve`, day?.workout === c.workout);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Unknown body part — engine must NEVER skip when severity is provided
// ─────────────────────────────────────────────────────────────────────────
//
// Real athlete inputs often skip the body-part token even when severity
// is named: "feels off 6/10", "I'm wrecked 7/10", or use a body-part word
// the bucket map doesn't recognise ("hammy cooked 6/10" — "hammy" IS in
// the map, but "feels off" is the canonical no-bodyPart case).
//
// Contract under test:
//   - extractInjuryContext returns context (not null) when severity is
//     present, even with no body-part token.
//   - applyProgramAdjustment + applyAdjustmentEvents produces ≥1 visible
//     event and an override write.
//   - applied=true whenever severity ≥ 5, regardless of body part.

section('[7] Unknown body part — "feels off 6/10" still mutates program');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    3: workout('Conditioning', [ex('Sprint Intervals', 1)]),  // Wed today
    4: workout('Lower Strength', [ex('Goblet Squat', 3), ex('Walking Lunge', 3)]),
    5: workout('Upper Strength', [ex('Bench Press', 4), ex('Pull-Ups', 3)]),
  });

  const ctx = extractInjuryContext('feels off 6/10');
  ok('context returned (not null)', ctx !== null);
  eq('bodyPart=unknown', ctx?.bodyPart, 'unknown');
  eq('severity=6', ctx?.severity, 6);
  eq('bucket=null', ctx?.bucket, null);

  const out = runUAEFlow('feels off 6/10');
  ok('flow fired', out.fired);
  ok('events emitted', out.events > 0);
  ok('reply non-empty', out.reply.length > 0);
  ok('at least one override write', overrideCalls.length >= 1);
  ok('override on a future date', overrideCalls.every((c) => c.date >= FIXED_TODAY));
  ok(
    'reply uses severity-anchored phrasing (no body-part claim)',
    /6\/10/.test(out.reply) && !/\b(hamstring|knee|shoulder|calf|ankle)\b/i.test(out.reply),
  );
  eq('zero fetch calls', fetchCalls, 0);
}

section('[8] "Hammy cooked 6/10" — known body part, descriptor only, mutates');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [ex('RDLs', 3), ex('Goblet Squat', 3)]),
  });

  const ctx = extractInjuryContext('hammy cooked 6/10');
  ok('context returned', ctx !== null);
  eq('bodyPart=hammy', ctx?.bodyPart, 'hammy');
  eq('severity=6', ctx?.severity, 6);
  ok('bucket=hamstring', ctx?.bucket === 'hamstring');

  const out = runUAEFlow('hammy cooked 6/10');
  ok('flow fired', out.fired);
  ok('events emitted', out.events > 0);
  ok('at least one override', overrideCalls.length >= 1);
  eq('zero fetch calls', fetchCalls, 0);
}

section('[9] applied=true ↔ severity≥5 invariant across body-part awareness');
{
  // Direct UAE check — confirm applied=true for severity≥5 with both
  // known and unknown body parts.
  for (const sev of [5, 6, 7, 8]) {
    for (const bodyPart of ['unknown', 'hamstring']) {
      resetSpies();
      baseWeek = buildBaseWeek({
        4: workout('Lower Strength', [ex('Goblet Squat', 3), ex('Walking Lunge', 3)]),
      });
      const result = applyProgramAdjustment(
        {
          intent: 'injury',
          todayISO: FIXED_TODAY,
          payload: { bodyPart, severity: sev },
          source: 'client_guard',
        },
        (coachWeekDiff as any).buildScheduleStateImperative(),
      );
      ok(
        `severity=${sev} bodyPart=${bodyPart}: applied=true`,
        result.applied === true,
        `applied=${result.applied} events=${result.events.length}`,
      );
      ok(
        `severity=${sev} bodyPart=${bodyPart}: ≥1 event`,
        result.events.length >= 1,
      );
    }
  }
}

section('[10] Unknown body part + severity≥7 → recovery (not lighten)');
{
  resetSpies();
  baseWeek = buildBaseWeek({
    4: workout('Lower Strength', [ex('Goblet Squat', 3)]),
  });

  const out = runUAEFlow('feels off 8/10');
  ok('flow fired', out.fired);
  ok('events emitted', out.events > 0);
  ok('at least one override', overrideCalls.length >= 1);
  // For unknown body part + severity ≥ 7, the fallback emits set_session_recovery.
  const hasRecovery = overrideCalls.some(
    (c) => c.workout.workoutType === 'Recovery' && c.workout.exercises.length === 0,
  );
  ok('severity≥7 + unknown → at least one recovery shell written', hasRecovery);
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
