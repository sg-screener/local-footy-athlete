/**
 * smokeCoachBikeFlowTests — pipeline smoke test for the exact live-app
 * regression Sam reported and Phase H fixed.
 *
 * This is the "closest-to-simulator" check we can run from a CI Linux
 * environment. The real on-simulator screen check lives in
 * `.maestro/coach-bike-flow.yaml` (run on macOS with `maestro test`).
 *
 * Scope: drive the FULL live pipeline — `routeCoachCommand`
 * (real router) → `orchestrateModalitySwap` (real orchestrator) →
 * `applyAdjustmentEvents` (real event applier) — through the three
 * turns the user reported, then snapshot the captured Wednesday
 * workout and assert the athlete-visible text contract.
 *
 * 3-turn flow:
 *   1. "Why is there a mid week row"
 *      → conversation/explain, no mutation
 *   2. "Can you change to a bike?"
 *      → modality swap row → bike (standard label by Phase H default)
 *   3. "You changed to an assault bike I wanted a normal bike"
 *      → bike-subtype correction, recurring preference path
 *
 * Final assertion:
 *   The captured Wednesday workout has Bike (regular) everywhere AND
 *   none of the forbidden tokens leak into ANY visible-text field:
 *     - "Rower" / "Row" / "rowing"
 *     - "Assault" / "Assault Bike Intervals"
 *     - "[Swapped to bike]"  (legacy in-name tag)
 *     - any contradictory modality
 *
 * Run: sucrase-node src/__tests__/smokeCoachBikeFlowTests.ts
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
  routeCoachCommand,
  isMutateCommand,
  type RouteCoachCommandInput,
} from '../utils/coachCommandRouter';
import {
  applyAdjustmentEvents,
  type ApplyOptions,
} from '../utils/applyAdjustmentEvents';
import {
  orchestrateModalitySwap,
  type ProjectionCheck,
} from '../utils/coachModalitySwapOrchestrator';
import {
  applyConditioningModalityToWorkout,
  applyModalityPreferenceToWorkout,
  verifyModalityRewrite,
  parseBikeSubtypeIntent,
  dayHasModality,
} from '../utils/coachModalitySwap';
import type {
  Workout,
  WorkoutExercise,
  OverrideContext,
} from '../types/domain';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';
import {
  buildSmokeWednesdayWorkout,
  SMOKE_WEDNESDAY_WORKOUT_NAME,
  SMOKE_WEDNESDAY_DESCRIPTION,
  SMOKE_WEDNESDAY_OPTION_TITLE,
} from '../data/smokeCoachBikeFlowProgram';

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

// ─── Fixtures ──────────────────────────────────────────────────────

// Monday — so Wednesday in the current week is FUTURE (matches the
// "mid week row" framing the user reports about an upcoming session).
const FIXED_TODAY = '2026-05-04';
const FIXED_MONDAY = '2026-05-04';
const WED_DATE = '2026-05-06'; // The Wednesday Easy Aerobic Flush (future)
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function ex(name: string): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return {
    id: `we-${slug}`,
    workoutId: '',
    exerciseId: `ex-${slug}`,
    exerciseOrder: 0,
    prescribedSets: 1,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
    prescribedWeightKg: 0,
    restSeconds: 0,
    exercise: {
      id: `ex-${slug}`,
      name,
      description: name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
    // Live shape: notes is a string the user can read on DayWorkout.
    notes: `Cruise on the Rower. 20min easy. 3-4/10.`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as WorkoutExercise;
}

/**
 * Wednesday Easy Aerobic Flush — delegates to the shared fixture in
 * src/data/smokeCoachBikeFlowProgram.ts so this pipeline test and the
 * live smoke bootstrap (via programForSmokeFlow('coach-bike-flow') →
 * buildSmokeCoachBikeFlowProgram) operate on byte-for-byte the same
 * Wednesday workout shape.
 *
 * Without the shared fixture, this test would silently pass against a
 * hand-rolled Workout while the live app was running DEFAULT_PROGRAM
 * (whose Wednesday is "Upper Strength"). That divergence is what the
 * "I can't see the row session in the visible week" failure mode in
 * the live coach reply pointed at.
 */
function buildWedEasyAerobicFlush(): Workout {
  return buildSmokeWednesdayWorkout('mc-test');
}

function buildBaseWeek(): ResolvedDay[] {
  const monLower: Workout = {
    id: 'wk-lower',
    microcycleId: 'mc-test',
    dayOfWeek: 1,
    name: 'Lower Body Strength',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: 'Strength' as any,
    sessionTier: 'core',
    exercises: [ex('Back Squat')],
    createdAt: '',
    updatedAt: '',
  } as Workout;
  const wedFlush = buildWedEasyAerobicFlush();
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let w: Workout | null = null;
    if (dow === 1) w = monLower;
    if (dow === 3) w = wedFlush;
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: w,
      source: w ? ('template' as any) : ('rest' as any),
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

// ─── Forbidden token contract ──────────────────────────────────────
//
// These are the EXACT tokens the user said must NOT appear in the
// athlete-visible workout text after the 3-turn flow ends with a
// "normal bike" correction.
const FORBIDDEN_TOKENS: Array<{ name: string; re: RegExp }> = [
  { name: 'Rower (any case)', re: /\brower\b/i },
  { name: 'Row (standalone word)', re: /(?<![a-z])row(?![a-z])/i },
  { name: 'Rowing', re: /\browing\b/i },
  { name: 'Assault', re: /\bassault\b/i },
  { name: 'Assault Bike Intervals', re: /assault\s*bike\s*intervals/i },
  { name: 'Legacy [Swapped to bike] tag', re: /\[\s*Swapped\s+to\b[^\]]*\]/i },
  { name: 'Legacy [Swapped from …] tag', re: /\[\s*Swapped\s+from\b[^\]]*\]/i },
];

interface VisibleField {
  field: string;
  text: string;
}

/**
 * Enumerate every athlete-visible text field on a workout the way the
 * React screens (HomeScreen, DayWorkout, ProgramTab) render them.
 *
 * IMPORTANT: this includes coachNotes — the DayWorkout banner renders
 * them. The truth gate exempts the canonical "Swapped from X to Y"
 * line; here we exempt the same set.
 */
function enumerateVisibleFields(w: Workout | null | undefined): VisibleField[] {
  if (!w) return [];
  const out: VisibleField[] = [];
  if (w.name) out.push({ field: 'workout.name', text: w.name });
  if (w.description) out.push({ field: 'workout.description', text: w.description });
  (w.exercises ?? []).forEach((wx: any, i: number) => {
    if (wx?.exercise?.name) {
      out.push({ field: `exercises[${i}].exercise.name`, text: wx.exercise.name });
    }
    if (wx?.exercise?.description) {
      out.push({
        field: `exercises[${i}].exercise.description`,
        text: wx.exercise.description,
      });
    }
    if (typeof wx?.notes === 'string' && wx.notes) {
      out.push({ field: `exercises[${i}].notes`, text: wx.notes });
    }
  });
  (w.conditioningBlock?.options ?? []).forEach((opt: any, i: number) => {
    if (opt?.title) {
      out.push({ field: `conditioningBlock.options[${i}].title`, text: opt.title });
    }
    if (opt?.description) {
      out.push({
        field: `conditioningBlock.options[${i}].description`,
        text: opt.description,
      });
    }
  });
  (w.coachNotes ?? []).forEach((n: string, i: number) => {
    // Canonical coachNote framings legitimately reference both modalities
    // (e.g. "Swapped from rower to regular bike", "Coach preference: using
    // regular bike instead of rower"). The truth-gate excludes these; we
    // do the same so the scan reflects the same contract.
    if (/^(?:Swapped|Coach preference:|Swap\b)/i.test(n)) return;
    out.push({ field: `coachNotes[${i}]`, text: n });
  });
  return out;
}

function scanForbidden(
  fields: VisibleField[],
): Array<{ field: string; token: string; match: string; context: string }> {
  const leaks: Array<{ field: string; token: string; match: string; context: string }> = [];
  for (const f of fields) {
    for (const { name, re } of FORBIDDEN_TOKENS) {
      const m = re.exec(f.text);
      if (m) {
        leaks.push({
          field: f.field,
          token: name,
          match: m[0],
          context: f.text,
        });
      }
    }
  }
  return leaks;
}

// ─── Live-path applier capture (mirrors CoachScreen wiring) ────────

interface OverrideCall {
  date: string;
  workout: Workout;
  ctx?: OverrideContext;
}

function makeApplyHarness(week: ResolvedDay[]) {
  const writes: OverrideCall[] = [];
  const writeByDate = new Map<string, Workout>();

  function applyOpts(): ApplyOptions {
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
  const applyEvents: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, applyOpts());

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
          dayOfWeek: isoToDow(args.targetDate),
          short: SHORT[isoToDow(args.targetDate)],
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
  return { writes, writeByDate, applyEvents, verifyFromCaptured };
}

// ─── The smoke flow ────────────────────────────────────────────────

console.log('============================================================');
console.log('SMOKE: coach bike flow — full pipeline (real router, real');
console.log('orchestrator, real applier, real projection layer)');
console.log('============================================================');

// Sanity: shared fixture exports the canonical strings this smoke
// depends on. Drift here = silent divergence between pipeline test and
// live bootstrap, which is what made the "I can't see the row session"
// regression invisible at the pipeline gate.
section('[Setup] shared fixture sanity');
ok(
  'shared fixture exports SMOKE_WEDNESDAY_WORKOUT_NAME = "Easy Aerobic Flush"',
  SMOKE_WEDNESDAY_WORKOUT_NAME === 'Easy Aerobic Flush',
);
ok(
  'shared fixture exports SMOKE_WEDNESDAY_OPTION_TITLE with Rower modality',
  /\brower\b/i.test(SMOKE_WEDNESDAY_OPTION_TITLE) &&
    SMOKE_WEDNESDAY_OPTION_TITLE === 'Easy Aerobic Flush (20min Rower)',
);
ok(
  'shared fixture exports SMOKE_WEDNESDAY_DESCRIPTION with rower modality',
  /\brower\b/i.test(SMOKE_WEDNESDAY_DESCRIPTION) &&
    SMOKE_WEDNESDAY_DESCRIPTION === '20min easy Rower. Cruise pace. 3-4/10.',
);
ok(
  'buildWedEasyAerobicFlush() returns a Wednesday Easy Aerobic Flush workout',
  (() => {
    const w = buildWedEasyAerobicFlush();
    return (
      w.dayOfWeek === 3 &&
      w.name === SMOKE_WEDNESDAY_WORKOUT_NAME &&
      !!w.conditioningBlock &&
      (w.conditioningBlock as any).options?.[0]?.title ===
        SMOKE_WEDNESDAY_OPTION_TITLE
    );
  })(),
);

// Pristine coach context so the flow starts the way a fresh app session
// would: nothing remembered, nothing pinned.
useCoachContextStateStore.getState().clearCoachContext();

const week = buildBaseWeek();
const { writes, writeByDate, applyEvents, verifyFromCaptured } = makeApplyHarness(week);

// ============================================================
// Turn 1 — "Why is there a mid week row"
// Expected: conversation/explain, NO mutation, NO write.
// ============================================================
section('[Turn 1] "Why is there a mid week row" → conversation, no mutation');

const turn1 = 'Why is there a mid week row';

const t1Resolution = resolveCoachReference({
  userMessage: turn1,
  todayISO: FIXED_TODAY,
  currentWeek: week,
  lastOpenedWorkout: null,
  lastExplainedSession: null,
  lastDiscussedWorkout: null,
});
ok(
  'T1 mutationLike = false (information-seeking, not action-taking)',
  isMutationLike(turn1) === false,
);
const t1Cmd = routeCoachCommand({
  userMessage: turn1,
  todayISO: FIXED_TODAY,
  referenceResolution: t1Resolution,
} as RouteCoachCommandInput);
ok(
  'T1 router emits conversation/explain (NOT mutate)',
  t1Cmd.mode === 'conversation' || t1Cmd.mode === 'explain',
  `got mode=${t1Cmd.mode}`,
);
ok('T1 isMutateCommand = false', !isMutateCommand(t1Cmd));
eq('T1 zero override writes', writes.length, 0);

// Coach pipeline would persist the explanation context — mirror that
// here so turn 2's resolver has the same anchor the live app would.
useCoachContextStateStore.getState().setLastExplainedSession({
  date: WED_DATE,
  sessionName: 'Easy Aerobic Flush (20min Rower)',
  modalities: ['rower', 'row'],
});

// ============================================================
// Turn 2 — "Can you change to a bike?"
// Expected: mutation, modality swap row → bike (Phase H default = standard).
// After this turn the WED workout must be bike, not row.
// ============================================================
section('[Turn 2] "Can you change to a bike?" → modality swap row → bike (standard)');

const turn2 = 'Can you change to a bike?';
ok('T2 mutationLike = true', isMutationLike(turn2) === true);

const t2Snap = getCoachContextSnapshot();
const t2Resolution = resolveCoachReference({
  userMessage: turn2,
  todayISO: FIXED_TODAY,
  currentWeek: week,
  lastOpenedWorkout: t2Snap.lastOpenedWorkout,
  lastExplainedSession: t2Snap.lastExplainedSession,
  lastDiscussedWorkout: t2Snap.lastDiscussedWorkout,
});
ok(
  'T2 resolver bound a target (no clarifier required)',
  t2Resolution.status === 'resolved',
  `got status=${t2Resolution.status}`,
);
eq('T2 resolved target date = Wednesday', t2Resolution.target?.date, WED_DATE);

const t2Cmd = routeCoachCommand({
  userMessage: turn2,
  todayISO: FIXED_TODAY,
  referenceResolution: t2Resolution,
} as RouteCoachCommandInput);
ok(
  'T2 router emits mutate (NEVER conversation, NEVER legacy)',
  t2Cmd.mode === 'mutate',
  `got mode=${t2Cmd.mode}`,
);

// Run the orchestrator the same way CoachScreen does on a mutation turn.
const t2Outcome = orchestrateModalitySwap({
  userMessage: turn2,
  todayISO: FIXED_TODAY,
  referenceResolution: t2Resolution,
  applyEvents,
  verifyProjectionsFn: verifyFromCaptured,
});

ok(
  'T2 outcome.kind = applied or applied_preference (mutation landed)',
  t2Outcome.kind === 'applied' || t2Outcome.kind === 'applied_preference',
  `got kind=${t2Outcome.kind} route=${t2Outcome.route}`,
);
ok('T2 outcome.applied = true', t2Outcome.applied === true);
ok('T2 projectionShowsTo (bike) = true', t2Outcome.projectionShowsTo === true);
ok('T2 projectionShowsFrom (row) = false', t2Outcome.projectionShowsFrom === false);
ok(
  'T2 at least one setManualOverride write on Wednesday',
  writes.some((w) => w.date === WED_DATE),
  `writes=${JSON.stringify(writes.map((w) => w.date))}`,
);

const afterT2 = writeByDate.get(WED_DATE) ?? buildWedEasyAerobicFlush();
ok('T2 captured workout exists', !!writeByDate.get(WED_DATE));

// Spot-check: Phase H default — bare "bike" must NOT render as "Assault Bike".
const t2VisibleAfter = enumerateVisibleFields(afterT2);
const t2LeaksOfAssault = t2VisibleAfter.filter((f) => /assault/i.test(f.text));
ok(
  'T2 NO "Assault" in any visible field (Phase H default = standard bike)',
  t2LeaksOfAssault.length === 0,
  t2LeaksOfAssault.length > 0
    ? `leaks: ${JSON.stringify(t2LeaksOfAssault.slice(0, 3))}`
    : undefined,
);
// And no Rower leftover either.
const t2LeaksOfRower = t2VisibleAfter.filter((f) => /\brower\b/i.test(f.text));
ok(
  'T2 NO "Rower" in any visible field after row → bike swap',
  t2LeaksOfRower.length === 0,
  t2LeaksOfRower.length > 0
    ? `leaks: ${JSON.stringify(t2LeaksOfRower.slice(0, 3))}`
    : undefined,
);

// ============================================================
// Turn 3 — "You changed to an assault bike I wanted a normal bike"
// Expected: bike-subtype correction (intent = positive_regular).
// Same modality (bike→bike), label corrected to standard.
// ============================================================
section('[Turn 3] "You changed to an assault bike I wanted a normal bike" → subtype correction');

const turn3 = 'You changed to an assault bike I wanted a normal bike';
ok('T3 mutationLike = true', isMutationLike(turn3) === true);

const t3Intent = parseBikeSubtypeIntent(turn3);
eq('T3 parseBikeSubtypeIntent.desiredLabel = standard', t3Intent.desiredLabel, 'standard');
// Either positive_regular ("I want a normal bike") or complaint_assault
// ("you changed to an assault bike") is a valid path — both produce the
// correct standard label. The smoke test only requires the desiredLabel
// match; source classification is an internal explanation field.
ok(
  'T3 parseBikeSubtypeIntent.source is a standard-deriving source',
  t3Intent.source === 'positive_regular' ||
    t3Intent.source === 'complaint_assault' ||
    t3Intent.source === 'negation_assault',
  `got source=${t3Intent.source}`,
);

// Simulate the live wiring: the live build with Phase H's standard-default
// would NOT have written "Assault" in turn 2. But Sam's CURRENT live
// captured-rewrite is the input that turn 3 must clean if any "Assault"
// happened to slip through (older builds, manual edits, etc.). To be a
// hard regression guard, we apply turn 3 to a workout that explicitly
// contains "Assault Bike" and assert the correction strips it.
//
// We do this in two passes:
//   3a — apply turn 3 to the actual turn-2 output (validates the live path)
//   3b — apply turn 3 to a "polluted" workout (regression guard for any
//        future code that lets Assault slip into the visible fields)

// 3a — apply recurring-preference rewrite to the live turn-2 output.
const correctedT3a = applyModalityPreferenceToWorkout(afterT2, {
  from: 'bike',
  to: 'bike',
  bikeLabel: 'standard',
});
const t3aFields = enumerateVisibleFields(correctedT3a);
ok(
  'T3a no Assault leak in any visible field (live turn-2 output corrected)',
  t3aFields.every((f) => !/\bassault\b/i.test(f.text)),
);
ok(
  'T3a no Rower leak in any visible field',
  t3aFields.every((f) => !/\brower\b/i.test(f.text)),
);

// 3b — REGRESSION GUARD: build a workout that mimics an older live build
// where "Assault" leaked in (the exact symptom Sam reported), then apply
// the same recurring-preference rewrite and assert all the forbidden
// tokens disappear.
const pollutedAssault: Workout = {
  ...afterT2,
  name: 'Easy Aerobic Flush',
  description: '25min easy Assault Bike. Cruise pace. 3-4/10.',
  exercises: [
    {
      ...afterT2.exercises[0],
      exercise: {
        ...(afterT2.exercises[0] as any).exercise,
        name: 'Easy Aerobic Flush (25min Assault Bike)',
        description: 'Easy Aerobic Flush (25min Assault Bike)',
      } as any,
      notes: 'Cruise on the Assault Bike. 25min easy. 3-4/10.',
    } as any,
  ],
  conditioningBlock: {
    ...(afterT2.conditioningBlock as any),
    options: [
      {
        title: 'Easy Aerobic Flush (25min Assault Bike)',
        description: '25min easy Assault Bike. Cruise pace. 3-4/10.',
        exerciseIds: (afterT2.conditioningBlock as any)?.options?.[0]?.exerciseIds ?? [],
      },
    ],
  } as any,
  // Mimic the legacy in-name "[Swapped to bike]" tag that pre-Phase H
  // builds wrote into descriptions — the live coachNote filter must
  // strip it on rewrite.
  coachNotes: ['Stale: [Swapped to bike] from rower'],
};

const correctedT3b = applyConditioningModalityToWorkout(pollutedAssault, {
  fromModality: 'bike',
  toModality: 'bike',
  bikeLabel: 'standard',
  isLabelOnlyFix: true,
  isRecurringPreference: true,
});
const t3bFields = enumerateVisibleFields(correctedT3b);
const t3bLeaks = scanForbidden(t3bFields);

ok(
  'T3b regression guard: NO forbidden tokens leak after polluted-Assault rewrite',
  t3bLeaks.length === 0,
  t3bLeaks.length > 0 ? `leaks: ${JSON.stringify(t3bLeaks.slice(0, 4))}` : undefined,
);

// Truth gate must concur — `verifyModalityRewrite` and the visible-text
// scan must agree.
const truthGate3b = verifyModalityRewrite(correctedT3b, 'bike', 'standard');
ok(
  'T3b verifyModalityRewrite agrees (ok=true)',
  truthGate3b.ok === true,
  truthGate3b.leaks.length > 0
    ? `truth gate leaks: ${JSON.stringify(truthGate3b.leaks.slice(0, 4))}`
    : undefined,
);

// ============================================================
// FINAL CONTRACT — the captured DayWorkout text must satisfy:
//   ✓ contains: "Easy Aerobic Flush", "Bike", "20min easy", easy intensity
//   ✗ contains: Rower / Row / Assault / Assault Bike Intervals /
//               [Swapped to bike]
// ============================================================
section('[FINAL] visible DayWorkout text contract');

// The screen renders the workout the projection produces. The final
// state = applyConditioningModalityToWorkout(afterT2) — the cumulative
// effect of turn 2 + turn 3.
const finalWorkout = correctedT3a;
const finalFields = enumerateVisibleFields(finalWorkout);
const finalLeaks = scanForbidden(finalFields);

// Positive contract — these MUST appear somewhere in the visible text.
const all = finalFields.map((f) => f.text).join(' || ');
ok('FINAL contains "Easy Aerobic Flush"', /easy aerobic flush/i.test(all));
ok(
  'FINAL contains "Bike" (Phase H default standard label)',
  /\bbike\b/i.test(all),
  `text: ${all.slice(0, 200)}…`,
);
ok(
  'FINAL contains "20min" (duration token preserved through rewrite)',
  /\b20\s*min\b/i.test(all),
);
ok(
  'FINAL contains intensity language ("easy" or "3-4/10")',
  /\beasy\b/i.test(all) || /3\s*[-–]\s*4\s*\/\s*10/i.test(all),
);

// Negative contract — none of these may appear in any visible field.
if (finalLeaks.length === 0) {
  ok('FINAL no forbidden token leaks in any visible field', true);
} else {
  ok(
    'FINAL no forbidden token leaks in any visible field',
    false,
    `\n  Leaks:\n${finalLeaks
      .map((l) => `    [${l.field}] "${l.match}" → ${l.context}`)
      .join('\n')}`,
  );
}

// Truth-gate must concur with the visible-text scan.
const truthGateFinal = verifyModalityRewrite(finalWorkout, 'bike', 'standard');
ok(
  'FINAL verifyModalityRewrite truth gate agrees (ok=true)',
  truthGateFinal.ok === true,
  truthGateFinal.leaks.length > 0
    ? `truth gate leaks: ${JSON.stringify(truthGateFinal.leaks)}`
    : undefined,
);

// ─── Summary ───────────────────────────────────────────────────────

console.log('\n— Summary —');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  for (const f of failures) console.log(`  \u2022 ${f}`);
  process.exit(1);
}
console.log('\nSMOKE PASS: visible DayWorkout text is internally consistent after the 3-turn bike flow.');
process.exit(0);
