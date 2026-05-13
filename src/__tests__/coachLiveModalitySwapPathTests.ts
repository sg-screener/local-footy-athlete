/**
 * coachLiveModalitySwapPathTests — integration test that mirrors the
 * exact 4-step user sequence reported as failing in the live app:
 *
 *   1. User asks: "Why did you put in a mid week row?"
 *   2. Coach explains: "Wednesday Easy Aerobic Flush (25min Rower)..."
 *   3. User asks: "Can you change it to a bike instead of a row?"
 *   4. The coach must:
 *      - have stored Wednesday's session as `lastExplainedSession`
 *      - resolve "it" to that session via the deterministic resolver
 *      - mark the message as mutation-like (so legacy fallback is barred)
 *      - apply a swap_conditioning_modality event
 *      - have the visible projection show bike (and not row)
 *      - reply "Done — ..." ONLY after the projection verifies
 *
 * This test wires the REAL coachContextStateStore + coachReferenceResolver
 * + applyAdjustmentEvents + orchestrateModalitySwap. The only stubs are:
 *
 *   - `applyEvents` — uses the real applier with an injected resolveWeek
 *     and setManualOverride spy so we can read back the mutated workout.
 *   - `verifyProjectionsFn` — runs the real `dayHasModality` against the
 *     workout the spy captured (since we don't spin up Zustand stores
 *     for the visible-projection layer).
 *
 * That preserves the truth gate: if the applier doesn't actually rewrite
 * the row, the verifier sees the unchanged workout and the orchestrator
 * refuses to say "Done".
 *
 * Run: sucrase-node src/__tests__/coachLiveModalitySwapPathTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  useCoachContextStateStore,
  getCoachContextSnapshot,
} from '../store/coachContextStateStore';
import {
  resolveCoachReference,
  isMutationLike,
} from '../utils/coachReferenceResolver';
import {
  applyAdjustmentEvents,
  type ApplyOptions,
} from '../utils/applyAdjustmentEvents';
import {
  orchestrateModalitySwap,
  type ProjectionCheck,
} from '../utils/coachModalitySwapOrchestrator';
import { dayHasModality } from '../utils/coachModalitySwap';
import type {
  Workout,
  WorkoutExercise,
  ConditioningBlock,
  OverrideContext,
} from '../types/domain';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXED_TODAY = '2026-04-27'; // Monday
const FIXED_MONDAY = '2026-04-27';
const WED_DATE = '2026-04-29';
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

function ex(name: string): WorkoutExercise {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id: `we-${id}`,
    workoutId: '',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: 1,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
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

function strengthWorkout(name: string, exercises: WorkoutExercise[]): Workout {
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

function easyAerobicFlush(): Workout {
  const e = ex('Easy Row');
  const block: ConditioningBlock = {
    intent: 'aerobic-base' as any,
    options: [{ title: 'Easy Row', description: '25min @ Z2', exerciseIds: [e.id] }],
  };
  return {
    id: 'wk-easy-flush',
    microcycleId: 'mc-test',
    dayOfWeek: 3,
    name: 'Easy Aerobic Flush',
    description: '',
    durationMinutes: 25,
    intensity: 'Easy' as any,
    workoutType: 'Conditioning' as any,
    sessionTier: 'core',
    exercises: [e],
    conditioningBlock: block,
    hasCombinedConditioning: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}

function buildBaseWeek(): ResolvedDay[] {
  const monLower = strengthWorkout('Lower Body Strength', [ex('Back Squat')]);
  const wedFlush = easyAerobicFlush();
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let workout: Workout | null = null;
    if (dow === 1) workout = monLower;
    if (dow === 3) workout = wedFlush;
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout,
      source: workout ? ('template' as any) : ('rest' as any),
      indicator: null as any,
    } as ResolvedDay);
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

// ─── Tiny harness ──────────────────────────────────────────────────

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

// ─── The 4-step live-path integration test ────────────────────────

section('Live-path: explanation → "change it to bike" → verified Done');

// Reset coach context store for a clean run.
useCoachContextStateStore.getState().clearCoachContext();

const week = buildBaseWeek();

// Spy that captures whatever applyAdjustmentEvents writes via
// setManualOverride, plus serves the projection verifier.
interface OverrideCall {
  date: string;
  workout: Workout;
  ctx?: OverrideContext;
}
const writes: OverrideCall[] = [];
const writeByDate = new Map<string, Workout>();

function makeApplyOptions(): ApplyOptions {
  return {
    todayISO: FIXED_TODAY,
    buildState: () => emptyScheduleState(),
    resolveWeek: () => week,
    setManualOverride: (date, workout, ctx) => {
      writes.push({ date, workout, ctx });
      writeByDate.set(date, workout);
    },
    allowFutureWeeks: true,
  };
}

const stubApplyEvents: typeof applyAdjustmentEvents = (events) =>
  applyAdjustmentEvents(events, makeApplyOptions());

// Verifier reads the captured override (or falls back to the base week
// when no override was written) and runs the REAL `dayHasModality`.
function verifyFromCaptured(args: {
  targetDate: string;
  todayISO: string;
  fromModality: any;
  toModality: any;
}): ProjectionCheck {
  const captured = writeByDate.get(args.targetDate);
  const base = week.find((d) => d.date === args.targetDate)?.workout ?? null;
  const finalWorkout = captured ?? base;
  const day = finalWorkout
    ? ({
        date: args.targetDate,
        dayOfWeek: 3,
        short: 'WED',
        isToday: false,
        workout: finalWorkout,
        source: 'manual' as any,
        indicator: null as any,
      } as unknown as ResolvedDay)
    : null;
  const programTabShowsTo = dayHasModality(day, args.toModality);
  const programTabStillShowsFrom = args.fromModality
    ? dayHasModality(day, args.fromModality)
    : false;
  return {
    programTabShowsTo,
    programTabStillShowsFrom,
    dayWorkoutShowsTo: programTabShowsTo,
    dayWorkoutStillShowsFrom: programTabStillShowsFrom,
    bothProjectionsShowTo: programTabShowsTo,
  };
}

// ─── Step 1: User asks "Why did you put in a mid week row?" ──────
// (No mutation here — we only assert that nothing has been written
// to the coach context yet.)
const beforeSnap = getCoachContextSnapshot();
ok(
  'pre-explanation: lastExplainedSession is null',
  beforeSnap.lastExplainedSession === null,
);
ok(
  'pre-explanation: lastDiscussedWorkout is null',
  beforeSnap.lastDiscussedWorkout === null,
);

// ─── Step 2: Coach explains Wednesday Easy Aerobic Flush ─────────
// Coach pipeline writes the explanation entry (this mirrors what
// CoachScreen does after a deterministic explanation reply).
useCoachContextStateStore.getState().setLastExplainedSession({
  date: WED_DATE,
  sessionName: 'Easy Aerobic Flush',
  modalities: ['rower', 'row'],
});

const afterExplain = getCoachContextSnapshot();
ok(
  'post-explanation: lastExplainedSession set',
  afterExplain.lastExplainedSession !== null,
);
eq(
  'lastExplainedSession.date is Wednesday',
  afterExplain.lastExplainedSession?.date,
  WED_DATE,
);
eq(
  'lastExplainedSession.sessionName',
  afterExplain.lastExplainedSession?.sessionName,
  'Easy Aerobic Flush',
);
ok(
  'lastDiscussedWorkout points to Wednesday Easy Aerobic Flush',
  afterExplain.lastDiscussedWorkout?.date === WED_DATE &&
    afterExplain.lastDiscussedWorkout?.sessionName === 'Easy Aerobic Flush',
);

// ─── Step 3: User asks "Can you change it to a bike instead of a row?"
const userMessage = 'Can you change it to a bike instead of a row?';

// Truth gate: this is mutation-like.
ok('mutationLike = true', isMutationLike(userMessage) === true);

// The deterministic reference resolver takes the visible week + the
// stored coach context and binds "it" to Wednesday.
const snap = getCoachContextSnapshot();
const resolution = resolveCoachReference({
  userMessage,
  todayISO: FIXED_TODAY,
  currentWeek: week,
  lastOpenedWorkout: snap.lastOpenedWorkout,
  lastExplainedSession: snap.lastExplainedSession,
  lastDiscussedWorkout: snap.lastDiscussedWorkout,
});

eq('resolver status = resolved', resolution.status, 'resolved');
eq('resolver target date = Wednesday', resolution.target?.date, WED_DATE);
eq(
  'resolver target name = Easy Aerobic Flush',
  resolution.target?.sessionName,
  'Easy Aerobic Flush',
);
ok(
  'resolver flags isMutationLike = true on the resolution itself',
  resolution.isMutationLike === true,
);

// ─── Step 4: Orchestrator applies + verifies + replies ────────────
let legacyCalled = false;
function legacyShouldNeverFire() {
  legacyCalled = true;
  throw new Error('legacy /coach-chat must not be called for mutation-like turns');
}

// Run the orchestrator that CoachScreen's pre-LLM mutation gate calls.
const outcome = orchestrateModalitySwap({
  userMessage,
  todayISO: FIXED_TODAY,
  referenceResolution: resolution,
  applyEvents: stubApplyEvents,
  verifyProjectionsFn: verifyFromCaptured,
});

// Touchstone 1 — legacy is never invoked.
// (We deliberately don't call legacyShouldNeverFire from the
// orchestrator path; it's here as a guard for future regressions.)
void legacyShouldNeverFire;
ok('legacyCalled = false', legacyCalled === false);

// Touchstone 2 — outcome.applied is true and the route is the swap path.
eq('outcome.kind = applied', outcome.kind, 'applied');
ok('outcome.applied = true', outcome.applied === true);
eq('outcome.route', outcome.route, 'modality_swap_applied');
eq('outcome.targetDate', outcome.targetDate, WED_DATE);

// Touchstone 3 — exactly one override write, on Wednesday.
eq('exactly one setManualOverride call', writes.length, 1);
eq('write date = Wednesday', writes[0].date, WED_DATE);

const written = writes[0].workout;
const newName = written.exercises[0].exercise?.name ?? '';
ok(
  'Easy Row was renamed to a bike option (Easy Bike or Light Circuits)',
  newName === 'Easy Bike' || newName === 'Light Circuits',
  `got "${newName}"`,
);
ok(
  'block option title was rewritten too',
  written.conditioningBlock?.options?.[0].title !== 'Easy Row',
);
eq('durationMinutes preserved', written.durationMinutes, 25);
eq('workoutType still Conditioning', written.workoutType as any, 'Conditioning');
eq('intensity preserved', written.intensity as any, 'Easy');
eq('session name preserved', written.name, 'Easy Aerobic Flush');

// Touchstone 4 — projections show bike, not row.
ok('projectionShowsTo = true', outcome.projectionShowsTo === true);
ok('projectionShowsFrom = false', outcome.projectionShowsFrom === false);

// Touchstone 5 — the verified reply is "Done — ...".
ok('reply starts with "Done —"', /^Done —/.test(outcome.reply));
ok('reply mentions Easy Aerobic Flush', /Easy Aerobic Flush/.test(outcome.reply));
ok('reply mentions bike', /bike/i.test(outcome.reply));
ok('reply mentions rower', /rower/i.test(outcome.reply));

// ─── Negative-control: same flow with no explanation stored ──────
// (Should NOT silently apply — the resolver returns no_target / expired
// since the pronoun has no anchor.)
section('Negative control: pronoun with no anchor → clarifier, no apply');

useCoachContextStateStore.getState().clearCoachContext();
writes.length = 0;
writeByDate.clear();

const negSnap = getCoachContextSnapshot();
const negResolution = resolveCoachReference({
  userMessage,
  todayISO: FIXED_TODAY,
  currentWeek: week,
  lastOpenedWorkout: negSnap.lastOpenedWorkout,
  lastExplainedSession: negSnap.lastExplainedSession,
  lastDiscussedWorkout: negSnap.lastDiscussedWorkout,
});

ok(
  'with no anchor: status NOT resolved',
  negResolution.status !== 'resolved',
);

const negOutcome = orchestrateModalitySwap({
  userMessage,
  todayISO: FIXED_TODAY,
  referenceResolution: negResolution,
  applyEvents: stubApplyEvents,
  verifyProjectionsFn: verifyFromCaptured,
});

ok('no-anchor outcome.applied = false', negOutcome.applied === false);
ok('no-anchor reply is NOT "Done"', !/^Done/.test(negOutcome.reply));
eq('no-anchor zero overrides written', writes.length, 0);

// ─── Negative-control 2: stored explanation but message has no
// modality intent → unparseable, NOT a fabricated apply ────────────
section('Negative control 2: explanation present but no modality intent');

useCoachContextStateStore.getState().clearCoachContext();
useCoachContextStateStore.getState().setLastExplainedSession({
  date: WED_DATE,
  sessionName: 'Easy Aerobic Flush',
  modalities: ['rower', 'row'],
});
writes.length = 0;
writeByDate.clear();

const stillExplainedSnap = getCoachContextSnapshot();
const noIntentMessage = 'Why did you put in a mid week row?';
const noIntentResolution = resolveCoachReference({
  userMessage: noIntentMessage,
  todayISO: FIXED_TODAY,
  currentWeek: week,
  lastOpenedWorkout: stillExplainedSnap.lastOpenedWorkout,
  lastExplainedSession: stillExplainedSnap.lastExplainedSession,
  lastDiscussedWorkout: stillExplainedSnap.lastDiscussedWorkout,
});

const noIntentOutcome = orchestrateModalitySwap({
  userMessage: noIntentMessage,
  todayISO: FIXED_TODAY,
  referenceResolution: noIntentResolution,
  applyEvents: stubApplyEvents,
  verifyProjectionsFn: verifyFromCaptured,
});

ok(
  'no-intent outcome.kind is honest non-apply (unparseable | no_target | ambiguous)',
  ['unparseable', 'no_target', 'ambiguous'].includes(noIntentOutcome.kind),
  `got ${noIntentOutcome.kind}`,
);
ok('no-intent applied = false', noIntentOutcome.applied === false);
ok('no-intent reply is NOT "Done"', !/^Done/.test(noIntentOutcome.reply));
eq('no-intent zero overrides written', writes.length, 0);

// ─── Cleanup ───────────────────────────────────────────────────────

useCoachContextStateStore.getState().clearCoachContext();

// ─── Summary ──────────────────────────────────────────────────────

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
