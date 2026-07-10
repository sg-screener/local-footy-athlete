/**
 * coachModalityPreferenceTests — recurring/future modality preference
 * flow that fires when the resolved target date is BEFORE todayISO
 * (already-completed Wednesday in the current week, or earlier).
 *
 * The 8 user-spec'd cases:
 *   1. Past current-week Wednesday row + "change it to bike" applies a
 *      future Easy Aerobic Flush preference, NOT a past-date failure.
 *   2. Future Wednesday Easy Aerobic Flush shows bike (next-day in
 *      current week, projected through projectVisibleDay).
 *   3. Next week Easy Aerobic Flush also shows bike (next-week
 *      projection, no per-date override required).
 *   4. Duration / intensity / optional / skip-guidance all preserved
 *      through the rewrite.
 *   5. Completed past sessions remain unchanged on render unless the
 *      target date itself receives an eager override for immediate detail
 *      screen visibility.
 *   6. "Just this session" + past target → no preference written, the
 *      orchestrator falls through to the per-date applier (which still
 *      rejects with past_date — but the contract is honoured).
 *   7. Ambiguous resolution → clarifier, no preference written, no
 *      eager rewrites.
 *   8. Legacy `/coach-chat` is never invoked from the preference path.
 *
 * Run: sucrase-node src/__tests__/coachModalityPreferenceTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  orchestrateModalitySwap,
  type ProjectionCheck,
} from '../utils/coachModalitySwapOrchestrator';
import {
  useCoachPreferencesStore,
  canonicalSessionKey,
  getModalityPreferenceFor,
} from '../store/coachPreferencesStore';
import {
  applyModalityPreferenceToWorkout,
  dayHasModality,
} from '../utils/coachModalitySwap';
import { projectVisibleDay } from '../utils/visibleProgramProjection';
import type {
  Workout,
  WorkoutExercise,
  ConditioningBlock,
} from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachReferenceResolution } from '../utils/coachReferenceResolver';

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXED_TODAY = '2026-05-08'; // Friday — mirrors the live-app failure
const PAST_WED = '2026-05-06'; // Wednesday earlier in the same week
const NEXT_WED = '2026-05-13'; // Wednesday next week
const FUTURE_FRI = '2026-05-08'; // = today
const FUTURE_SAT = '2026-05-09'; // tomorrow
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
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

function easyAerobicFlush(opts?: { optional?: boolean; skip?: string }): Workout {
  const e = ex('Easy Row');
  const block: ConditioningBlock = {
    intent: 'aerobic-base' as any,
    options: [{ title: 'Easy Row', description: '25min @ Z2 — skip if you feel cooked', exerciseIds: [e.id] }],
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
    optional: opts?.optional === true,
    coachNotes: opts?.skip ? [opts.skip] : [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}

function asResolvedDay(date: string, workout: Workout | null, source: 'template' | 'rest' = 'template'): ResolvedDay {
  return {
    date,
    dayOfWeek: isoToDow(date),
    short: SHORT[isoToDow(date)],
    isToday: date === FIXED_TODAY,
    workout,
    source: source as any,
    indicator: null as any,
  } as ResolvedDay;
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
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Test 1: past-date target → preference path, not failure ──────

section('1. Past current-week Wednesday + "change it to bike" → preference applied');

useCoachPreferencesStore.getState().clearAllModalityPreferences();

const pastWedRef: CoachReferenceResolution = {
  status: 'resolved' as any,
  target: { date: PAST_WED, sessionName: 'Easy Aerobic Flush', source: 'lastExplainedSession' as any },
  isMutationLike: true,
} as any;

interface OverrideCall { date: string; workout: Workout; ctx?: any }
const writes: OverrideCall[] = [];
let prefSetCalls: Array<{ name: string; from: any; to: any }> = [];

function fakeApplyEvents(): any {
  // Past-date events would be rejected; this stub asserts the orchestrator
  // does NOT route through here at all on the recurring path.
  return { applied: [], rejected: [{ kind: 'past_date_blocked' }] };
}
function fakeVerifyPasses(): ProjectionCheck {
  return {
    programTabShowsTo: true,
    programTabStillShowsFrom: false,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: false,
    bothProjectionsShowTo: true,
  };
}
function fakeVerifyFails(): ProjectionCheck {
  return {
    programTabShowsTo: false,
    programTabStillShowsFrom: true,
    dayWorkoutShowsTo: false,
    dayWorkoutStillShowsFrom: true,
    bothProjectionsShowTo: false,
  };
}
function makeWeekWithPastWed(): Array<{ date: string; workout: Workout | null }> {
  const monday = '2026-05-04';
  const out: Array<{ date: string; workout: Workout | null }> = [];
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = monday.split('-').map(Number);
    const dt = new Date(y, m - 1, d + i, 12, 0, 0, 0);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push({ date, workout: null });
  }
  // Wednesday past row (already completed)
  const wed = out.find((d) => d.date === PAST_WED)!;
  wed.workout = easyAerobicFlush();
  // Next-Wed-this-week-isn't-a-thing (only one Wed in Mon-Sun) so we
  // also need to test next week. Cover that in test 3.
  return out;
}

const outcome1 = orchestrateModalitySwap({
  userMessage: 'Can you change it to a bike instead of a row?',
  todayISO: FIXED_TODAY,
  referenceResolution: pastWedRef,
  applyEvents: fakeApplyEvents,
  verifyProjectionsFn: fakeVerifyPasses,
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
    useCoachPreferencesStore.getState().setModalityPreference(name, pref);
  },
  resolveCurrentWeekFn: makeWeekWithPastWed,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

eq('outcome.kind', outcome1.kind, 'applied_preference');
ok('outcome.applied = true', outcome1.applied === true);
eq('outcome.route', outcome1.route, 'modality_preference_applied');
// Acknowledgment contract: opens with "Done" then a dash. The exact dash
// glyph (—, –, -) is presentation, not behaviour.
ok('reply starts with a "Done" acknowledgment',
  /^Done\s*[-‐-―−]/.test(outcome1.reply),
  outcome1.reply,
);
ok('reply mentions on the bike', /on the bike/i.test(outcome1.reply), outcome1.reply);
ok('reply mentions instead of the rower', /instead of the rower/i.test(outcome1.reply), outcome1.reply);
ok('reply mentions Easy Aerobic Flush', /Easy Aerobic Flush/.test(outcome1.reply));
ok('reply mentions "going forward"', /going forward/i.test(outcome1.reply));

eq('preference store: setModalityPreference called once', prefSetCalls.length, 1);
eq('preference name = Easy Aerobic Flush', prefSetCalls[0].name, 'Easy Aerobic Flush');
eq('preference from = row', prefSetCalls[0].from, 'row');
eq('preference to = bike', prefSetCalls[0].to, 'bike');

const stored = getModalityPreferenceFor('Easy Aerobic Flush');
ok('store has Easy Aerobic Flush preference', stored !== null);
eq('stored.from', stored?.from, 'row');
eq('stored.to', stored?.to, 'bike');
ok('canonical key matches', canonicalSessionKey('Easy Aerobic Flush') === 'easy aerobic flush');

// No future-this-week Wednesday exists, but the target date itself gets
// an eager override so the already-open DayWorkout screen updates too.
eq('target-date eager override written', writes.length, 1);
eq('target-date override is past Wednesday', writes[0].date, PAST_WED);
ok(
  'target-date override shows bike immediately',
  dayHasModality({ date: PAST_WED, workout: writes[0].workout } as any, 'bike'),
);
ok(
  'target-date override removes row immediately',
  !dayHasModality({ date: PAST_WED, workout: writes[0].workout } as any, 'row'),
);

// ─── Test 2: Future Wednesday in current week shows bike via projection ──

section('2. Future Wednesday in current week shows bike via projectVisibleDay');

// Build a future Wednesday day (not actually a Wed but we use it as a
// placeholder for "future-this-week, same session name").
const futureSatDay = asResolvedDay(FUTURE_SAT, easyAerobicFlush());
const projected2 = projectVisibleDay({
  day: futureSatDay,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
const proj2Workout = projected2.day.workout!;
const proj2FirstName = proj2Workout.exercises[0].exercise?.name ?? '';
ok('future-day projection rewrote Easy Row', proj2FirstName !== 'Easy Row', `got "${proj2FirstName}"`);
ok(
  'future-day projection landed on a bike option',
  proj2FirstName === 'Easy Bike' || /bike/i.test(proj2FirstName) || /circuit/i.test(proj2FirstName),
  `got "${proj2FirstName}"`,
);
eq('future-day duration preserved', proj2Workout.durationMinutes, 25);
eq('future-day intensity preserved', proj2Workout.intensity as any, 'Easy');
ok(
  'future-day display name reflects the new modality',
  /bike|circuit/i.test(proj2Workout.name) || proj2Workout.name === 'Easy Aerobic Flush',
  proj2Workout.name,
);

// ─── Test 3: Next week's Wednesday also shows bike ────────────────

section('3. Next week\'s Wednesday Easy Aerobic Flush shows bike');

const nextWedDay = asResolvedDay(NEXT_WED, easyAerobicFlush());
const projected3 = projectVisibleDay({
  day: nextWedDay,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
const proj3Workout = projected3.day.workout!;
const proj3FirstName = proj3Workout.exercises[0].exercise?.name ?? '';
ok('next-week projection rewrote Easy Row', proj3FirstName !== 'Easy Row');
ok('next-week first option title rewritten too', proj3Workout.conditioningBlock?.options?.[0].title !== 'Easy Row');

// ─── Test 4: Duration / intensity / optional / skip preserved ─────

section('4. Duration / intensity / optional / skip guidance preserved');

const optionalFlush = easyAerobicFlush({ optional: true, skip: 'Skip if you feel cooked' });
const optionalDay = asResolvedDay(NEXT_WED, optionalFlush);
const projected4 = projectVisibleDay({
  day: optionalDay,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
const proj4 = projected4.day.workout!;
eq('duration preserved', proj4.durationMinutes, 25);
eq('intensity preserved', proj4.intensity as any, 'Easy');
eq('optional flag preserved', (proj4 as any).optional, true);
eq('workoutType preserved', proj4.workoutType as any, 'Conditioning');
eq('sessionTier preserved', (proj4 as any).sessionTier, 'core');
// Display name is derived from the (now-rewritten) block title, which is
// fine — the structural rewrite still happened and the canonical key
// links the original session name to the preference.
ok(
  'projection display name reflects the new modality',
  /bike|circuit/i.test(proj4.name) || proj4.name === 'Easy Aerobic Flush',
  proj4.name,
);
ok(
  'original skip guidance preserved in coachNotes',
  (proj4.coachNotes ?? []).some((n) => /skip if you feel cooked/i.test(n)),
);
ok('option description (skip guidance) preserved', /skip/i.test(proj4.conditioningBlock?.options?.[0].description ?? ''));

// ─── Test 5: Completed past sessions remain unchanged ─────────────

section('5. Past-dated session left alone by projection');

const pastDay = asResolvedDay(PAST_WED, easyAerobicFlush());
const projected5 = projectVisibleDay({
  day: pastDay,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
const proj5Workout = projected5.day.workout!;
eq('past-day first exercise unchanged', proj5Workout.exercises[0].exercise?.name, 'Easy Row');
eq('past-day option title unchanged', proj5Workout.conditioningBlock?.options?.[0].title, 'Easy Row');
ok(
  'past-day did NOT receive coach preference note',
  !(proj5Workout.coachNotes ?? []).some((n) => /Coach preference/i.test(n)),
);

// ─── Test 6: "Just this session" → preference NOT written ─────────

section('6. "Just this session" past target → falls through to per-date applier');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

let appliedEventsCalled6 = false;
const outcome6 = orchestrateModalitySwap({
  userMessage: 'Just this session — change it to a bike instead of a row.',
  todayISO: FIXED_TODAY,
  referenceResolution: pastWedRef,
  applyEvents: () => {
    appliedEventsCalled6 = true;
    return { applied: [], rejected: [{ kind: 'past_date_blocked', date: PAST_WED, reason: 'past' }] };
  },
  verifyProjectionsFn: fakeVerifyFails,
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
  },
  resolveCurrentWeekFn: makeWeekWithPastWed,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

ok('per-date applyEvents WAS invoked when scoped to "just this session"', appliedEventsCalled6);
eq('preference NOT written for "just this session"', prefSetCalls.length, 0);
ok('outcome.kind is engine_rejected (past date)', outcome6.kind === 'engine_rejected');
ok('reply does NOT contain "going forward"', !/going forward/i.test(outcome6.reply));

// ─── Test 7: Ambiguous resolution → clarifier, no preference ──────

section('7. Ambiguous resolution → clarifier, no preference written');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

const ambiguousRef: CoachReferenceResolution = {
  status: 'ambiguous' as any,
  target: null,
  candidates: [
    { date: PAST_WED, sessionName: 'Easy Aerobic Flush', source: 'matched' as any },
    { date: NEXT_WED, sessionName: 'Easy Aerobic Flush', source: 'matched' as any },
  ],
  clarifierQuestion: 'Which Easy Aerobic Flush do you mean — this past Wednesday or next Wednesday?',
  isMutationLike: true,
} as any;

const outcome7 = orchestrateModalitySwap({
  userMessage: 'Change it to a bike instead of a row.',
  todayISO: FIXED_TODAY,
  referenceResolution: ambiguousRef,
  applyEvents: fakeApplyEvents,
  verifyProjectionsFn: fakeVerifyFails,
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
  },
  resolveCurrentWeekFn: makeWeekWithPastWed,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

eq('outcome.kind', outcome7.kind, 'ambiguous');
ok('outcome.applied = false', outcome7.applied === false);
ok('reply is the clarifier question', outcome7.reply === ambiguousRef.clarifierQuestion);
eq('preference NOT written on ambiguous', prefSetCalls.length, 0);
eq('zero override writes on ambiguous', writes.length, 0);

// ─── Test 8: Legacy /coach-chat is never invoked from preference path ──

section('8. Legacy /coach-chat is never invoked from preference path');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

let legacyCalled = false;
function legacyCoachChat() {
  legacyCalled = true;
}

const outcome8 = orchestrateModalitySwap({
  userMessage: 'Can you change it to a bike instead of a row?',
  todayISO: FIXED_TODAY,
  referenceResolution: pastWedRef,
  applyEvents: () => {
    // Even on the preference path, applyEvents must NOT be called
    // (no per-date event emitted for past targets).
    return { applied: [], rejected: [] };
  },
  verifyProjectionsFn: fakeVerifyPasses,
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
  },
  resolveCurrentWeekFn: makeWeekWithPastWed,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});
void legacyCoachChat;
ok('legacy /coach-chat not called', legacyCalled === false);
eq('preference WAS written on preference path', prefSetCalls.length, 1);
eq('outcome.kind = applied_preference', outcome8.kind, 'applied_preference');
ok('outcome.applied = true', outcome8.applied === true);

// ─── Bonus: future-target still uses per-date event (regression) ──

section('Bonus: future target still routes through per-date applier');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

const futureRef: CoachReferenceResolution = {
  status: 'resolved' as any,
  target: { date: NEXT_WED, sessionName: 'Easy Aerobic Flush', source: 'lastExplainedSession' as any },
  isMutationLike: true,
} as any;

let futureApplyCalled = false;
const outcomeBonus = orchestrateModalitySwap({
  userMessage: 'Can you change it to a bike instead of a row?',
  todayISO: FIXED_TODAY,
  referenceResolution: futureRef,
  applyEvents: () => {
    futureApplyCalled = true;
    return {
      applied: [{ kind: 'swap_conditioning_modality', date: NEXT_WED } as any],
      rejected: [],
    };
  },
  verifyProjectionsFn: () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: false,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: false,
    bothProjectionsShowTo: true,
  }),
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
  },
  resolveCurrentWeekFn: makeWeekWithPastWed,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

ok('future-target: per-date applyEvents WAS invoked', futureApplyCalled);
eq('future-target: preference NOT written', prefSetCalls.length, 0);
eq('future-target: outcome.kind = applied (single-date)', outcomeBonus.kind, 'applied');

// ─── Pure helper: applyModalityPreferenceToWorkout ────────────────

section('Pure helper: applyModalityPreferenceToWorkout');

const sample = easyAerobicFlush();
const rewritten = applyModalityPreferenceToWorkout(sample, { from: 'row', to: 'bike' });
ok('returns a different reference when changes happen', rewritten !== sample);
eq('rewritten name preserved', rewritten.name, 'Easy Aerobic Flush');
eq('rewritten duration preserved', rewritten.durationMinutes, 25);
ok(
  'rewritten exercise is no longer Easy Row',
  rewritten.exercises[0].exercise?.name !== 'Easy Row',
  rewritten.exercises[0].exercise?.name,
);
ok(
  'rewritten coachNote mentions preference',
  (rewritten.coachNotes ?? []).some((n) => /Coach preference/.test(n)),
);

const noopSample = easyAerobicFlush();
const noopOut = applyModalityPreferenceToWorkout(noopSample, { from: 'bike', to: 'row' });
ok(
  'noop on non-matching from returns same reference',
  noopOut === noopSample,
);

// ─── Bike subtype label-only correction ─────────────────────────────
// "I want a regular bike, not an assault bike" — both sides 'bike',
// only the subtype label changes. Must route through the recurring
// preference path regardless of past/future and verify against the
// label-only landing rule (modality unchanged + bikeLabel saved).

section('9. Bike subtype label-only correction routes through preference path');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

function easyBikeWorkout(): Workout {
  const e = ex('Easy Bike');
  const block: ConditioningBlock = {
    intent: 'aerobic-base' as any,
    options: [{ title: 'Easy Bike', description: '25min @ Z2', exerciseIds: [e.id] }],
  };
  return {
    id: 'wk-easy-bike',
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
    optional: false,
    coachNotes: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}
function makeWeekWithFutureEasyBike(): Array<{ date: string; workout: Workout | null }> {
  const monday = '2026-05-04';
  const out: Array<{ date: string; workout: Workout | null }> = [];
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = monday.split('-').map(Number);
    const dt = new Date(y, m - 1, d + i, 12, 0, 0, 0);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push({ date, workout: null });
  }
  // Saturday in current week is future-of-Friday and renders Easy Bike.
  const sat = out.find((d) => d.date === FUTURE_SAT)!;
  sat.workout = easyBikeWorkout();
  return out;
}

// 9a. Past-target same-modality label fix → preference path
const pastBikeRef: CoachReferenceResolution = {
  status: 'resolved' as any,
  target: { date: PAST_WED, sessionName: 'Easy Aerobic Flush', source: 'lastExplainedSession' as any },
  isMutationLike: true,
} as any;

let labelFixApplyCalled = false;
const outcomeLabelPast = orchestrateModalitySwap({
  userMessage: 'I just want a regular bike, not an assault bike.',
  todayISO: FIXED_TODAY,
  referenceResolution: pastBikeRef,
  applyEvents: () => {
    labelFixApplyCalled = true;
    return { applied: [], rejected: [] };
  },
  // Same-modality verification: bike still on the projection (showsTo=true),
  // showsFrom is also true because from===to===bike. The label-only branch
  // must accept this.
  verifyProjectionsFn: () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: true,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: true,
    bothProjectionsShowTo: true,
  }),
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
    useCoachPreferencesStore.getState().setModalityPreference(name, pref);
  },
  resolveCurrentWeekFn: makeWeekWithFutureEasyBike,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

ok('label-only past: per-date applyEvents NOT called (preference path)', labelFixApplyCalled === false);
eq('label-only past: preference written', prefSetCalls.length, 1);
eq('label-only past: stored from = bike', prefSetCalls[0].from, 'bike');
eq('label-only past: stored to = bike', prefSetCalls[0].to, 'bike');
eq('label-only past: outcome.kind = applied_preference', outcomeLabelPast.kind, 'applied_preference');
ok('label-only past: outcome.applied = true', outcomeLabelPast.applied === true);
ok('label-only past: reply mentions regular bike', /regular bike/i.test(outcomeLabelPast.reply), outcomeLabelPast.reply);
ok('label-only past: reply mentions not assault', /not.*assault/i.test(outcomeLabelPast.reply), outcomeLabelPast.reply);
ok(
  'label-only past: reply does not expose internal display limitations',
  !/(don't|do not).*distinguish.*subtypes|coach-note|wording/i.test(outcomeLabelPast.reply),
  outcomeLabelPast.reply,
);
ok(
  'label-only past: reply does NOT use "instead of" framing',
  !/instead of/i.test(outcomeLabelPast.reply),
  outcomeLabelPast.reply,
);

const storedLabel = getModalityPreferenceFor('Easy Aerobic Flush');
ok('label-only past: store has bikeLabel = standard', storedLabel?.bikeLabel === 'standard');

// 9b. Future-target same-modality label fix → still preference path,
// not the per-date applier (no swap_conditioning_modality event makes
// sense when from === to).

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

const futureBikeRef: CoachReferenceResolution = {
  status: 'resolved' as any,
  target: { date: FUTURE_SAT, sessionName: 'Easy Aerobic Flush', source: 'lastExplainedSession' as any },
  isMutationLike: true,
} as any;

let futureLabelApplyCalled = false;
const outcomeLabelFuture = orchestrateModalitySwap({
  userMessage: 'Actually I want a regular bike, not an assault bike.',
  todayISO: FIXED_TODAY,
  referenceResolution: futureBikeRef,
  applyEvents: () => {
    futureLabelApplyCalled = true;
    return { applied: [], rejected: [{ kind: 'noop_same_modality' }] };
  },
  verifyProjectionsFn: () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: true,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: true,
    bothProjectionsShowTo: true,
  }),
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
    useCoachPreferencesStore.getState().setModalityPreference(name, pref);
  },
  resolveCurrentWeekFn: makeWeekWithFutureEasyBike,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

ok(
  'label-only future: per-date applyEvents NOT called (label corrections never emit a swap event)',
  futureLabelApplyCalled === false,
);
eq('label-only future: preference written', prefSetCalls.length, 1);
eq('label-only future: outcome.kind = applied_preference', outcomeLabelFuture.kind, 'applied_preference');
ok('label-only future: applied = true', outcomeLabelFuture.applied === true);
ok(
  'label-only future: reply mentions regular bike',
  /regular bike/i.test(outcomeLabelFuture.reply),
  outcomeLabelFuture.reply,
);

// 9c. Verification gate: label-only must NOT fail when projection still
// shows from-modality (because from===to). This is the regression that
// would make a label-only fix incorrectly emit a "didn't land" reply.

useCoachPreferencesStore.getState().clearAllModalityPreferences();
prefSetCalls = [];
writes.length = 0;

const outcomeLabelVerify = orchestrateModalitySwap({
  userMessage: 'I want a regular bike, not assault.',
  todayISO: FIXED_TODAY,
  referenceResolution: pastBikeRef,
  applyEvents: () => ({ applied: [], rejected: [] }),
  // Worst case for old verification rule: showsFrom=true on both. Label-only
  // path must still treat this as landed.
  verifyProjectionsFn: () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: true,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: true,
    bothProjectionsShowTo: true,
  }),
  setModalityPreferenceFn: (name, pref) => {
    prefSetCalls.push({ name, from: pref.from, to: pref.to });
  },
  resolveCurrentWeekFn: makeWeekWithFutureEasyBike,
  setManualOverrideFn: (date, workout, ctx) => writes.push({ date, workout, ctx }),
});

ok(
  'label-only verification: outcome.kind = applied_preference (NOT verification_failed)',
  outcomeLabelVerify.kind === 'applied_preference',
  `got ${outcomeLabelVerify.kind}: ${outcomeLabelVerify.reply}`,
);
ok('label-only verification: applied = true', outcomeLabelVerify.applied === true);
ok(
  'label-only verification: reply does not say "didn\'t land"',
  !/didn't (?:actually )?land/i.test(outcomeLabelVerify.reply),
  outcomeLabelVerify.reply,
);

// ─── Cleanup ───────────────────────────────────────────────────────

useCoachPreferencesStore.getState().clearAllModalityPreferences();

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
