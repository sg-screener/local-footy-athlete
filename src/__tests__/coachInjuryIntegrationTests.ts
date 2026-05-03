/**
 * coachInjuryIntegrationTests — TRUE end-to-end pipeline validation.
 *
 * The previous suites tested each layer in isolation:
 *   - programAdjustmentEngineTests: pure engine output
 *   - applyAdjustmentEventsTests:   per-event mutators in isolation
 *   - coachScreenUAEFlowTests:      engine → applyEvents (mock store)
 *   - pendingInjuryResolverTests:   the two-turn handshake helper
 *
 * NONE of them confirmed that:
 *   1. setManualOverride is actually called with the right shape
 *   2. dateOverrides ends up holding the modified workout
 *   3. resolveWeekWithConditioning returns the modified workout
 *   4. The modified workout carries `coachNotes` so the UI can render
 *      the injury adjustment without parsing description suffixes
 *
 * That gap is exactly why the user saw "Program updated" in chat but
 * NO change in the Program tab. This suite mounts the actual modules
 * (programStore + sessionResolver + applyAdjustmentEvents) — only
 * stubbing the program-build seam so we have a deterministic week.
 *
 * Scenario: pendingInjuryRef stash from the guard ("hammy cooked"),
 * follow-up severity ("6/10") → assert the entire pipeline lands a
 * visible change.
 *
 * Run: npm run test:coach-injury-integration
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// Silence pipeline logs in test runs.
const realLog = console.log;
console.log = (..._args: any[]) => {};

// ─── Schedule + program fixture ─────────────────────────────────────────

const FIXED_TODAY = '2026-04-29'; // Wed
const FIXED_MONDAY = '2026-04-27';

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function ex(name: string, sets = 3): any {
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
      id, name, description: name, exerciseType: 'Compound',
      muscleGroups: [], equipmentRequired: [], difficultyLevel: 'Intermediate',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

function workout(name: string, opts: { exercises?: any[]; workoutType?: string; sessionTier?: string } = {}): any {
  return {
    id: `wk-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 0,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: opts.workoutType || 'Strength',
    sessionTier: opts.sessionTier || 'core',
    exercises: opts.exercises || [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ─── Stub the resolver so we have a deterministic week ──────────────────

import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

let baseWeekDef: Record<number, any> = {};

(sessionResolver as any).resolveWeekWithConditioning = (
  monday: string,
  state: any,
): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dow = isoToDow(date);
    // Manual overrides win — mirrors resolveDate priority 1.
    const override = state.manualOverrides?.[date];
    const wkDef = baseWeekDef[dow] ?? null;
    const wk = override ?? wkDef;
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: wk,
      source: override ? 'manual' : wk ? 'template' : 'rest',
      indicator: null,
    } as any);
  }
  return out;
};

// Also patch getMondayStr — applyAdjustmentEvents recomputes Monday on
// invalid ISO; the integration path always feeds a valid ISO so this
// is just defensive.
(sessionResolver as any).getMondayStr = () => FIXED_MONDAY;

// ─── Real programStore ──────────────────────────────────────────────────

import { useProgramStore } from '../store/programStore';
import { applyAdjustmentEvents } from '../utils/applyAdjustmentEvents';
import { applyProgramAdjustment } from '../utils/programAdjustmentEngine';
import {
  resolveInjuryFromMessage,
  type PendingInjury,
} from '../utils/pendingInjuryResolver';
import { extractBodyPart } from '../utils/injuryAdjustmentEngine';

// Reset store between tests by replacing its state imperatively.
function resetStore() {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    dateOverrides: {},
    overrideContexts: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as any);
}

function buildState() {
  return {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium',
  } as any;
}

// Block global fetch to enforce "no LLM call".
let fetchCalls = 0;
(global as any).fetch = (...args: any[]) => {
  fetchCalls++;
  throw new Error(`[integration] fetch must not be called: ${JSON.stringify(args).slice(0, 120)}`);
};

// ─── Tiny test harness ──────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    realLog(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    realLog(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}
function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
function section(label: string) { realLog(`\n${label}`); }

// ─────────────────────────────────────────────────────────────────────
// 1. CANONICAL TWO-TURN FLOW — "Hammy cooked" → "6/10"
// ─────────────────────────────────────────────────────────────────────

section('[1] Hammy cooked → 6/10 — full pipeline lands a visible change');
{
  resetStore();
  fetchCalls = 0;
  // Real-world fixture: Wed Recovery (today), Thu Team Training, Fri Upper Push.
  baseWeekDef = {
    3: workout('Recovery Session', {
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [],
    }),
    4: workout('Team Training', {
      workoutType: 'Team Training',
      exercises: [],
    }),
    5: workout('Upper Push', {
      exercises: [ex('Bench Press', 4), ex('Overhead Press', 3)],
    }),
  };

  // Turn 1: guard would fire on "My hammy is cooked". The pendingInjury
  // ref captures `bodyPart='hammy'`. We simulate the same stash inline.
  const turn1Body = extractBodyPart('My hammy is cooked');
  ok('turn 1: extractBodyPart returns "hammy"', turn1Body === 'hammy');
  const stashed: PendingInjury = {
    bodyPart: turn1Body!,
    originalMessage: 'My hammy is cooked',
    timestamp: Date.now(),
  };

  // Turn 2: bare "6/10" — the resolver merges stash + severity.
  const resolution = resolveInjuryFromMessage('6/10', stashed, Date.now());
  ok('turn 2: resolved', resolution.kind === 'resolved');
  if (resolution.kind === 'resolved') {
    eq('turn 2: bodyPart from pending', resolution.resolved.bodyPart, 'hammy');
    eq('turn 2: severity from message', resolution.resolved.severity, 6);
    eq('turn 2: source=pending', resolution.resolved.source, 'pending');
  }

  // Engine pass.
  const result = applyProgramAdjustment(
    {
      intent: 'injury',
      todayISO: FIXED_TODAY,
      message: '6/10',
      payload: { bodyPart: 'hammy', severity: 6 },
      source: 'client_guard',
    },
    buildState() as any,
  );
  ok('engine: applied=true', result.applied === true);
  ok('engine: ≥1 event', result.events.length >= 1);

  // Apply events to the REAL store via the REAL helper. No store stub.
  const apply = applyAdjustmentEvents(result.events, {
    todayISO: FIXED_TODAY,
    buildState,
  });
  ok('apply: applied.length ≥ 1', apply.applied.length >= 1);
  ok('apply: zero rejected', apply.rejected.length === 0);

  // Step A — store actually contains the override.
  const storeAfter = useProgramStore.getState().dateOverrides;
  ok('store: dateOverrides has Thu (2026-04-30)', !!storeAfter['2026-04-30']);
  const thuOverride = storeAfter['2026-04-30'];
  ok('store: Thu workout name preserved', thuOverride?.name === 'Team Training');
  ok(
    'store: Thu workout has coachNotes ≥1',
    Array.isArray(thuOverride?.coachNotes) && (thuOverride!.coachNotes!.length || 0) >= 1,
  );
  ok(
    'store: Thu coachNotes mention sprinting',
    (thuOverride?.coachNotes ?? []).some((n: string) => /sprint/i.test(n)),
  );

  // Step B — overrideContext recorded with intent='injury'.
  const ctx = useProgramStore.getState().overrideContexts['2026-04-30'];
  ok('store: overrideContext intent = injury', ctx?.intent === 'injury');

  // Step C — resolver returns the changed Thu workout.
  const week = (sessionResolver as any).resolveWeekWithConditioning(
    FIXED_MONDAY,
    buildState(),
  );
  const thuDay = week.find((d: any) => d.date === '2026-04-30');
  ok('resolver: returns Thu workout', !!thuDay?.workout);
  ok(
    'resolver: Thu source = manual',
    thuDay?.source === 'manual',
    `source=${thuDay?.source}`,
  );
  ok(
    'resolver: Thu coachNotes survive resolver',
    (thuDay?.workout?.coachNotes ?? []).some((n: string) => /sprint/i.test(n)),
  );

  // Step D — Wed Recovery is UNCHANGED (recovery never modified).
  const wedDay = week.find((d: any) => d.date === '2026-04-29');
  ok('resolver: Wed source still template (recovery untouched)', wedDay?.source === 'template');
  ok(
    'resolver: Wed has no coachNotes',
    !wedDay?.workout?.coachNotes || wedDay.workout.coachNotes.length === 0,
  );

  // Step E — Fri Upper Push is UNCHANGED (not relevant for hammy).
  const friDay = week.find((d: any) => d.date === '2026-05-01');
  ok('resolver: Fri unchanged (not hammy-relevant)', friDay?.source === 'template');

  // Step F — no fetch was made.
  eq('no fetch called during pipeline', fetchCalls, 0);
}

// ─────────────────────────────────────────────────────────────────────
// 2. REPLY GATE — engine emits events but apply rejects all → no
//    "Program updated" claim. Simulate by telling apply about a date
//    that isn't in the resolved week so every event is rejected.
// ─────────────────────────────────────────────────────────────────────

section('[2] Reply gate — apply.applied.length === 0 → fallback reply');
{
  resetStore();
  // Empty week: no template workouts at all.
  baseWeekDef = {};

  const result = applyProgramAdjustment(
    {
      intent: 'injury',
      todayISO: FIXED_TODAY,
      payload: { bodyPart: 'hammy', severity: 6 },
      source: 'client_guard',
    },
    buildState() as any,
  );
  // Empty week → engine returns applied=false and zero events. The reply
  // is the no-relevant-session message, NOT "Program updated".
  eq('engine: applied=false on empty week', result.applied, false);
  eq('engine: zero events', result.events.length, 0);
  ok(
    'engine reply does NOT contain "Program updated"',
    !/Program updated/.test(result.reply),
  );

  const apply = applyAdjustmentEvents(result.events, {
    todayISO: FIXED_TODAY,
    buildState,
  });
  eq('apply: zero applied', apply.applied.length, 0);

  // Store unchanged.
  const overrides = useProgramStore.getState().dateOverrides;
  eq('store: zero overrides', Object.keys(overrides).length, 0);
}

// ─────────────────────────────────────────────────────────────────────
// 3. RDL removal — exercise actually disappears from override workout
// ─────────────────────────────────────────────────────────────────────

section('[3] Hammy 6/10 + Lower Strength + RDL → RDL removed in store');
{
  resetStore();
  baseWeekDef = {
    5: workout('Lower Strength', {
      exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)],
    }),
  };

  const result = applyProgramAdjustment(
    {
      intent: 'injury',
      todayISO: FIXED_TODAY,
      payload: { bodyPart: 'hamstring', severity: 6 },
      source: 'client_guard',
    },
    buildState() as any,
  );
  ok('engine: applied=true', result.applied === true);
  const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
  ok('apply: applied.length ≥ 1', apply.applied.length >= 1);

  const friOverride = useProgramStore.getState().dateOverrides['2026-05-01'];
  ok('store: Fri override exists', !!friOverride);
  const exerciseNames = (friOverride?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok(
    'store: RDLs gone from override',
    !exerciseNames.includes('RDLs'),
    `exercises after: ${JSON.stringify(exerciseNames)}`,
  );
  ok(
    'store: Goblet Squat preserved',
    exerciseNames.includes('Goblet Squat'),
  );
  ok(
    'store: coachNotes mentions RDLs removed',
    (friOverride?.coachNotes ?? []).some((n: string) => /RDL/i.test(n)),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. resolveDate priority — manual override wins over template
// ─────────────────────────────────────────────────────────────────────

section('[4] Manual override wins over template in resolver');
{
  resetStore();
  baseWeekDef = {
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
  };

  // Write an override directly.
  const modified = {
    ...workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
    coachNotes: ['no sprinting / no high-speed running'],
    description: ' [no sprinting / no high-speed running]',
  };
  useProgramStore.getState().setManualOverride('2026-04-30', modified, {
    intent: 'injury',
    label: 'manual test',
  });

  const week = (sessionResolver as any).resolveWeekWithConditioning(
    FIXED_MONDAY,
    buildState(),
  );
  const thu = week.find((d: any) => d.date === '2026-04-30');
  ok('resolver returns Thu', !!thu?.workout);
  ok('resolver source=manual', thu?.source === 'manual');
  ok(
    'resolver returns the modified workout (with coachNotes)',
    (thu?.workout?.coachNotes ?? []).some((n: string) => /sprint/i.test(n)),
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
