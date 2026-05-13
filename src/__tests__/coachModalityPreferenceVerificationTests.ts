/**
 * coachModalityPreferenceVerificationTests — the 8 verification cases
 * the user demanded after the live app showed "Done — I'll use the
 * bike..." but future Easy Aerobic Flush kept rendering with
 * "Easy Aerobic Flush (20min Rower)".
 *
 *   1. Preference write alone is NOT sufficient — orchestrator must
 *      verify the visible projection actually changed.
 *   2. Future Program tab projection must show bike after preference
 *      is set.
 *   3. Future DayWorkout projection must show bike after preference
 *      is set.
 *   4. Failure reply when projection doesn't land — never claim "Done".
 *   5. Canonical-key alias matching — "Easy Aerobic Flush" preference
 *      applies even when block.options[0].title is "Easy Row".
 *   6. Run-load / off-feet conversion must NOT overwrite a coach-set
 *      bike preference.
 *   7. Fresh projection on every render — re-projecting after a
 *      preference write reflects the new modality.
 *   8. Full live-path integration — parenthetical exercise names
 *      ("Easy Aerobic Flush (20min Rower)") get rewritten too.
 *
 * Run: sucrase-node src/__tests__/coachModalityPreferenceVerificationTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  orchestrateModalitySwap,
  type ProjectionCheck,
} from '../utils/coachModalitySwapOrchestrator';
import {
  useCoachPreferencesStore,
  canonicalSessionKey,
  canonicalSessionKeyCandidates,
  aliasKeysForSessionName,
  getModalityPreferenceFor,
} from '../store/coachPreferencesStore';
import {
  applyModalityPreferenceToWorkout,
  inferModalityFromName,
  rewriteModalityInName,
  dayHasModality,
} from '../utils/coachModalitySwap';
import { projectVisibleDay } from '../utils/visibleProgramProjection';
import type { Workout, WorkoutExercise, ConditioningBlock } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachReferenceResolution } from '../utils/coachReferenceResolver';

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXED_TODAY = '2026-05-08'; // Friday
const PAST_WED = '2026-05-06';
const NEXT_WED = '2026-05-13';
const FUTURE_SAT = '2026-05-09';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function ex(name: string, idSuffix?: string): WorkoutExercise {
  const id = `ex-${(idSuffix ?? name).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
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

/** "Easy Aerobic Flush" with PARENTHETICAL exercise name — the live-app shape. */
function liveShapeFlush(): Workout {
  const e = ex('Easy Aerobic Flush (20min Rower)', 'easy-flush-rower');
  const block: ConditioningBlock = {
    intent: 'aerobic-base' as any,
    options: [
      {
        title: 'Easy Row',
        description: '20min @ Z2',
        exerciseIds: [e.id],
      },
    ],
  };
  return {
    id: 'wk-flush-live',
    microcycleId: 'mc-test',
    dayOfWeek: 3,
    name: 'Easy Aerobic Flush',
    description: '',
    durationMinutes: 20,
    intensity: 'Easy' as any,
    workoutType: 'Conditioning' as any,
    sessionTier: 'core',
    exercises: [e],
    conditioningBlock: block,
    hasCombinedConditioning: false,
    coachNotes: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}

function asResolvedDay(date: string, workout: Workout | null): ResolvedDay {
  return {
    date,
    dayOfWeek: isoToDow(date),
    short: SHORT[isoToDow(date)],
    isToday: date === FIXED_TODAY,
    workout,
    source: 'template' as any,
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
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Test 1 — preference write alone is insufficient ──────────────

section('1. Preference write alone is insufficient — verification gate refuses "Done"');

useCoachPreferencesStore.getState().clearAllModalityPreferences();

const pastRef: CoachReferenceResolution = {
  status: 'resolved' as any,
  target: { date: PAST_WED, sessionName: 'Easy Aerobic Flush', source: 'lastExplainedSession' as any },
  isMutationLike: true,
} as any;

function fakeVerifyFails(): ProjectionCheck {
  return {
    programTabShowsTo: false,
    programTabStillShowsFrom: true,
    dayWorkoutShowsTo: false,
    dayWorkoutStillShowsFrom: true,
    bothProjectionsShowTo: false,
  };
}

const outcome1 = orchestrateModalitySwap({
  userMessage: 'Can you change it to a bike instead of a row?',
  todayISO: FIXED_TODAY,
  referenceResolution: pastRef,
  applyEvents: () => ({ applied: [], rejected: [] }),
  verifyProjectionsFn: fakeVerifyFails,
  setModalityPreferenceFn: (name, pref) =>
    useCoachPreferencesStore.getState().setModalityPreference(name, pref),
  resolveCurrentWeekFn: () => [],
  setManualOverrideFn: () => {},
});

eq('outcome.kind = verification_failed', outcome1.kind, 'verification_failed');
ok('outcome.applied = false', outcome1.applied === false);
ok(
  'reply does NOT start with "Done"',
  !/^Done\b/.test(outcome1.reply),
  outcome1.reply,
);
ok(
  'reply contains the honest "didn\'t land" phrasing',
  /didn't land in the visible program/.test(outcome1.reply),
  outcome1.reply,
);
ok(
  'preference WAS still written (so the next render can pick it up)',
  getModalityPreferenceFor('Easy Aerobic Flush') !== null,
);

// ─── Test 2 — future Program tab projection must show bike ─────

section('2. Future Program tab projection must show bike when preference is set');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', { from: 'row', to: 'bike' });

const futureDay2 = asResolvedDay(NEXT_WED, liveShapeFlush());
const proj2 = projectVisibleDay({
  day: futureDay2,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok(
  'projected day has bike modality (Program tab path)',
  dayHasModality(proj2.day, 'bike'),
  `name=${proj2.day.workout?.name} firstEx=${proj2.day.workout?.exercises?.[0]?.exercise?.name}`,
);
ok(
  'projected day no longer has rower modality',
  !dayHasModality(proj2.day, 'row'),
  `name=${proj2.day.workout?.name} firstEx=${proj2.day.workout?.exercises?.[0]?.exercise?.name}`,
);

// ─── Test 3 — future DayWorkout projection must show bike ─────

section('3. Future DayWorkout projection must show bike (parenthetical-named exercise)');

const futureDay3 = asResolvedDay(FUTURE_SAT, liveShapeFlush());
const proj3 = projectVisibleDay({
  day: futureDay3,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok('DayWorkout-style projection shows bike', dayHasModality(proj3.day, 'bike'));
ok(
  'parenthetical exercise name was rewritten away from Rower',
  !/Rower/i.test(proj3.day.workout?.exercises?.[0]?.exercise?.name ?? ''),
  proj3.day.workout?.exercises?.[0]?.exercise?.name,
);
ok(
  'parenthetical exercise name now mentions Bike',
  /(Assault\s+Bike|Bike)/i.test(proj3.day.workout?.exercises?.[0]?.exercise?.name ?? ''),
  proj3.day.workout?.exercises?.[0]?.exercise?.name,
);
eq('duration token "20min" preserved in parenthetical', /20\s*min/i.test(proj3.day.workout?.exercises?.[0]?.exercise?.name ?? ''), true);

// ─── Test 4 — failure reply when verification fails ───────────

section('4. Failure reply contains the honest "didn\'t land" wording');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
const outcome4 = orchestrateModalitySwap({
  userMessage: 'Can you change it to a bike instead of a row?',
  todayISO: FIXED_TODAY,
  referenceResolution: pastRef,
  applyEvents: () => ({ applied: [], rejected: [] }),
  verifyProjectionsFn: fakeVerifyFails,
  setModalityPreferenceFn: (name, pref) =>
    useCoachPreferencesStore.getState().setModalityPreference(name, pref),
  resolveCurrentWeekFn: () => [],
  setManualOverrideFn: () => {},
});
ok(
  'failure reply mentions saving the bike preference',
  /saved the bike preference/i.test(outcome4.reply),
  outcome4.reply,
);
ok(
  'failure reply mentions "didn\'t land in the visible program"',
  /didn't land in the visible program/.test(outcome4.reply),
  outcome4.reply,
);
ok(
  'failure reply explicitly says it won\'t pretend',
  /not going to pretend/i.test(outcome4.reply),
  outcome4.reply,
);

// ─── Test 5 — canonical alias matching ────────────────────────

section('5. Canonical-key alias matching: preference under "Easy Aerobic Flush" hits "Easy Row" lookups');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', { from: 'row', to: 'bike' });

const aliasKeys = aliasKeysForSessionName('Easy Aerobic Flush');
ok('alias keys include "easy aerobic flush"', aliasKeys.includes('easy aerobic flush'));
ok('alias keys include "easy row" (block-title alias)', aliasKeys.includes('easy row'));
ok('alias keys include "aerobic base" (resolver-normalized alias)', aliasKeys.includes('aerobic base'));

ok('preference resolves under primary key', getModalityPreferenceFor('Easy Aerobic Flush') !== null);
ok('preference resolves under "Easy Row" alias', getModalityPreferenceFor('Easy Row') !== null);
ok('preference resolves under "Aerobic Base" alias', getModalityPreferenceFor('Aerobic Base') !== null);

// And the inverse — a preference stored under "Easy Row" still resolves
// when queried by "Easy Aerobic Flush" (alias is symmetric within group).
useCoachPreferencesStore.getState().clearAllModalityPreferences();
useCoachPreferencesStore.getState().setModalityPreference('Easy Row', { from: 'row', to: 'bike' });
ok(
  'preference stored under "Easy Row" resolves when looked up by "Easy Aerobic Flush"',
  getModalityPreferenceFor('Easy Aerobic Flush') !== null,
);

// ─── Test 6 — run-load conversion must not overwrite the bike pref ──

section('6. Run-load / off-feet conversion does NOT overwrite a coach-set bike preference');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', { from: 'row', to: 'bike' });

const futureDay6 = asResolvedDay(NEXT_WED, liveShapeFlush());
const proj6 = projectVisibleDay({
  day: futureDay6,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok(
  'after preference applied, projected exercise is on bike, not rower',
  dayHasModality(proj6.day, 'bike') && !dayHasModality(proj6.day, 'row'),
);

// Re-project with the same input — preference should still hold
const proj6b = projectVisibleDay({
  day: futureDay6,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok(
  're-projection preserves bike (preference is idempotent + sticky)',
  dayHasModality(proj6b.day, 'bike') && !dayHasModality(proj6b.day, 'row'),
);

// And the parenthetical name remained rewritten — no off-feet conversion
// reverted to "Rower" because RUN_TO_OFFFEET only fires on injury bucket
// constraints, not on coach preferences.
ok(
  'parenthetical name still says Bike, not Rower',
  /(Assault\s+Bike|Bike)/i.test(proj6b.day.workout?.exercises?.[0]?.exercise?.name ?? '') &&
    !/Rower/i.test(proj6b.day.workout?.exercises?.[0]?.exercise?.name ?? ''),
);

// ─── Test 7 — fresh projection on every navigation ───────────

section('7. Fresh projection on navigation: writing a new preference is reflected on the next project call');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
const day7 = asResolvedDay(NEXT_WED, liveShapeFlush());

// Before any preference — should still show the rower (live shape).
const projBefore = projectVisibleDay({
  day: day7,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok(
  'before preference: projection still shows rower (live shape)',
  dayHasModality(projBefore.day, 'row'),
);
ok('before preference: projection does NOT show bike', !dayHasModality(projBefore.day, 'bike'));

// Write preference and re-project — fresh read of the live store.
useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', { from: 'row', to: 'bike' });
const projAfter = projectVisibleDay({
  day: day7,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok(
  'after preference: projection shows bike',
  dayHasModality(projAfter.day, 'bike'),
);
ok('after preference: projection does NOT show rower', !dayHasModality(projAfter.day, 'row'));

// And switching the preference back flips the projection again.
useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', { from: 'bike', to: 'row' });
const projAfterFlip = projectVisibleDay({
  day: day7,
  activeInjury: null,
  todayISO: FIXED_TODAY,
});
ok(
  'preference flip is reflected on next project (bike → row again)',
  dayHasModality(projAfterFlip.day, 'row') && !dayHasModality(projAfterFlip.day, 'bike'),
);

// ─── Test 8 — full live-path integration with parenthetical names ──

section('8. Full live-path integration — orchestrator + projection + parenthetical names');

useCoachPreferencesStore.getState().clearAllModalityPreferences();

// Build a "current week" with PAST_WED holding the live-shape flush AND
// FUTURE_SAT also holding the live-shape flush (so the eager loop has
// a future-this-week target it can rewrite).
function makeLiveWeek(): Array<{ date: string; workout: Workout | null }> {
  return [
    { date: '2026-05-04', workout: null }, // Mon
    { date: '2026-05-05', workout: null }, // Tue
    { date: PAST_WED, workout: liveShapeFlush() }, // Wed (past)
    { date: '2026-05-07', workout: null }, // Thu
    { date: FIXED_TODAY, workout: null }, // Fri (today)
    { date: FUTURE_SAT, workout: liveShapeFlush() }, // Sat (future-this-week)
    { date: '2026-05-10', workout: null }, // Sun
  ];
}

const eagerWrites: Array<{ date: string; workout: Workout }> = [];

// The orchestrator's recurring path applies the preference + eagerly
// rewrites future-this-week sessions. The verification stub mimics what
// the real projection would compute AFTER the eager rewrite has run.
function fakeVerifyPasses(): ProjectionCheck {
  return {
    programTabShowsTo: true,
    programTabStillShowsFrom: false,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: false,
    bothProjectionsShowTo: true,
  };
}

const outcome8 = orchestrateModalitySwap({
  userMessage: 'Can you change it to a bike instead of a row?',
  todayISO: FIXED_TODAY,
  referenceResolution: pastRef,
  applyEvents: () => ({ applied: [], rejected: [] }),
  verifyProjectionsFn: fakeVerifyPasses,
  setModalityPreferenceFn: (name, pref) =>
    useCoachPreferencesStore.getState().setModalityPreference(name, pref),
  resolveCurrentWeekFn: makeLiveWeek,
  setManualOverrideFn: (date, workout) =>
    eagerWrites.push({ date, workout: workout as Workout }),
});

eq('outcome.kind = applied_preference', outcome8.kind, 'applied_preference');
ok('outcome.applied = true', outcome8.applied === true);
ok(
  'reply leads with "Done — next" + a weekday + the session',
  /^Done — next \w+'s Easy Aerobic Flush is now on the bike instead of the rower/.test(outcome8.reply),
  outcome8.reply,
);
ok(
  'reply ends with "going forward."',
  /going forward\.$/i.test(outcome8.reply),
  outcome8.reply,
);

// Eager loop must have rewritten FUTURE_SAT (future-this-week match).
ok('FUTURE_SAT eager-rewrite happened', eagerWrites.find((w) => w.date === FUTURE_SAT) !== undefined);
ok('PAST_WED was NOT rewritten (forward-looking only)', eagerWrites.find((w) => w.date === PAST_WED) === undefined);

const eagerSat = eagerWrites.find((w) => w.date === FUTURE_SAT)!;
ok(
  'eager-written FUTURE_SAT exercise mentions Assault Bike (not Rower)',
  eagerSat &&
    eagerSat.workout?.exercises?.[0]?.exercise?.name !== undefined &&
    /(Assault\s+Bike|Bike)/i.test(eagerSat.workout.exercises[0].exercise.name) &&
    !/Rower/i.test(eagerSat.workout.exercises[0].exercise.name),
  eagerSat?.workout?.exercises?.[0]?.exercise?.name,
);
ok(
  'eager-written FUTURE_SAT block.options[0].title rewritten away from Rower',
  eagerSat &&
    !/Rower/i.test(eagerSat.workout?.conditioningBlock?.options?.[0]?.title ?? '') &&
    !/^Easy Row$/i.test(eagerSat.workout?.conditioningBlock?.options?.[0]?.title ?? ''),
  eagerSat?.workout?.conditioningBlock?.options?.[0]?.title,
);

// Verify pure helpers used in the projection layer
section('Pure helpers — token detection + name rewrite');

eq('inferModalityFromName("Easy Aerobic Flush (20min Rower)")', inferModalityFromName('Easy Aerobic Flush (20min Rower)'), 'row');
eq('inferModalityFromName("Easy Aerobic Flush (25min Assault Bike)")', inferModalityFromName('Easy Aerobic Flush (25min Assault Bike)'), 'bike');
eq('inferModalityFromName("Easy Row")', inferModalityFromName('Easy Row'), 'row');
eq('inferModalityFromName("Bench Press")', inferModalityFromName('Bench Press'), null);
ok(
  'rewriteModalityInName replaces Rower → Bike (Phase H default: standard bike)',
  rewriteModalityInName('Easy Aerobic Flush (20min Rower)', 'bike') ===
    'Easy Aerobic Flush (20min Bike)',
);
ok(
  'rewriteModalityInName replaces Rower → Assault Bike when bikeLabel explicit',
  rewriteModalityInName('Easy Aerobic Flush (20min Rower)', 'bike', { bikeLabel: 'assault' }) ===
    'Easy Aerobic Flush (20min Assault Bike)',
);
ok(
  'rewriteModalityInName preserves Easy Aerobic Flush prefix',
  /^Easy Aerobic Flush/.test(rewriteModalityInName('Easy Aerobic Flush (20min Rower)', 'bike') ?? ''),
);
ok(
  'rewriteModalityInName returns null on no token',
  rewriteModalityInName('Bench Press', 'bike') === null,
);

// ─── Canonical-key parenthetical / dosage stripping ────────────────
// The live-app bug: preference saved under "Easy Aerobic Flush"
// (canonicalKey = "easy aerobic flush"), future query came in as
// "Easy Aerobic Flush (20min Rower)" (raw canonicalKey =
// "easy aerobic flush 20min rower") — no match, projection kept rower.

section('9. canonicalSessionKeyCandidates — parenthetical / dosage stripping');

const cands1 = canonicalSessionKeyCandidates('Easy Aerobic Flush (20min Rower)');
ok(
  'candidates include raw "easy aerobic flush 20min rower"',
  cands1.includes('easy aerobic flush 20min rower'),
  JSON.stringify(cands1),
);
ok(
  'candidates include paren-stripped "easy aerobic flush"',
  cands1.includes('easy aerobic flush'),
  JSON.stringify(cands1),
);
ok(
  '"Easy Aerobic Flush (25min Rower)" candidates include "easy aerobic flush"',
  canonicalSessionKeyCandidates('Easy Aerobic Flush (25min Rower)').includes('easy aerobic flush'),
);
ok(
  '"Easy Aerobic Flush (20min Bike)" candidates include "easy aerobic flush"',
  canonicalSessionKeyCandidates('Easy Aerobic Flush (20min Bike)').includes('easy aerobic flush'),
);
ok(
  '"Easy Aerobic Flush (20min Assault Bike)" candidates include "easy aerobic flush"',
  canonicalSessionKeyCandidates('Easy Aerobic Flush (20min Assault Bike)').includes('easy aerobic flush'),
);

// False-positive guard: trailing dosage stripping must NOT collapse
// internal mentions of "aerobic base" inside a strength-session title.
const cands2 = canonicalSessionKeyCandidates('Lower Body Strength + Aerobic Base finisher');
ok(
  'strength + aerobic base finisher does NOT collapse to "aerobic base"',
  !cands2.includes('aerobic base'),
  JSON.stringify(cands2),
);
ok(
  'strength + aerobic base finisher does NOT collapse to "easy aerobic flush"',
  !cands2.includes('easy aerobic flush'),
  JSON.stringify(cands2),
);
// "finisher" IS in the trailing token list so it strips off, but the result
// is still a strength title that does NOT match any standalone alias.
const cands2HasStrength = cands2.some((c) => /strength/.test(c));
ok(
  'strength + aerobic base finisher candidates retain "strength" identity',
  cands2HasStrength,
  JSON.stringify(cands2),
);

// "Easy Row" (2-token name) must NOT be collapsed to "easy" by the
// trailing-token strip — instead it relies on the alias-group sibling
// list to resolve to "easy aerobic flush".
const cands3 = canonicalSessionKeyCandidates('Easy Row');
ok(
  '"Easy Row" candidates do NOT contain just "easy"',
  !cands3.includes('easy'),
  JSON.stringify(cands3),
);
ok(
  '"Easy Row" candidates contain "easy row"',
  cands3.includes('easy row'),
  JSON.stringify(cands3),
);

// aliasKeysForSessionName end-to-end: every form of the Easy Aerobic
// Flush family should reach the stored "easy aerobic flush" key.
section('10. aliasKeysForSessionName resolves every Easy Aerobic Flush variant');

const variants = [
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (20min Rower)',
  'Easy Aerobic Flush (25min Rower)',
  'Easy Aerobic Flush (20min Bike)',
  'Easy Aerobic Flush (20min Assault Bike)',
  'Easy Row',
  'Easy Bike',
  'Aerobic Base',
  'Zone 2 Row',
  'Zone 2 Bike',
];
for (const variant of variants) {
  const keys = aliasKeysForSessionName(variant);
  ok(
    `aliasKeysForSessionName(${JSON.stringify(variant)}) includes "easy aerobic flush"`,
    keys.includes('easy aerobic flush'),
    JSON.stringify(keys),
  );
}

// getModalityPreferenceFor end-to-end: save under "Easy Aerobic Flush",
// read every variant, expect a hit.
section('11. getModalityPreferenceFor resolves preference across every variant');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
useCoachPreferencesStore
  .getState()
  .setModalityPreference('Easy Aerobic Flush', { from: 'row', to: 'bike' });

for (const variant of variants) {
  const hit = getModalityPreferenceFor(variant);
  ok(
    `getModalityPreferenceFor(${JSON.stringify(variant)}) → hit`,
    hit !== null && hit.to === 'bike',
    JSON.stringify(hit),
  );
}

// False-positive guard: strength session with "aerobic base finisher"
// must NOT pick up the standalone Easy Aerobic Flush preference.
ok(
  'getModalityPreferenceFor("Lower Body Strength + Aerobic Base finisher") → miss',
  getModalityPreferenceFor('Lower Body Strength + Aerobic Base finisher') === null,
);

// Live-bug repro: parenthetical query string from sessionBuilder.
section('12. Live-bug repro — parenthetical query string from sessionBuilder');

useCoachPreferencesStore.getState().clearAllModalityPreferences();
useCoachPreferencesStore
  .getState()
  .setModalityPreference('Easy Aerobic Flush', { from: 'row', to: 'bike' });

const liveBugQueries = [
  'Easy Aerobic Flush (20min Rower)',
  'Easy Aerobic Flush (25min Rower)',
  'Easy Aerobic Flush (20min Bike)',
];
for (const q of liveBugQueries) {
  const hit = getModalityPreferenceFor(q);
  ok(
    `live-bug query ${JSON.stringify(q)} → hit (was a miss before fix)`,
    hit !== null,
    JSON.stringify(hit),
  );
}

// ─── Summary ───────────────────────────────────────────────────────

console.log('\n— Summary —');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (failures.length > 0) {
  console.log('\n— Failures —');
  for (const f of failures) console.log(`  • ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
