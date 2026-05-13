/**
 * coachBikeSubtypeIntentTests — deterministic parser for bike-subtype
 * correction messages.
 *
 * The live bug: "You changed to an assault bike I want a normal bike"
 * was setting bikeLabel='assault' because the legacy parser checked for
 * the assault token first regardless of negation/correction context.
 * "It's still saying assault bike?" had the same failure mode — the
 * coach replied "Done — I'll use a assault bike... not a regular bike",
 * with the labels reversed.
 *
 * The new parseBikeSubtypeIntent reads WHICH side of the sentence the
 * verb attaches to, never counts tokens. This file enumerates the 8
 * phrase tests Sam specified plus the integration guards:
 *
 *   - pending-clarifier resume preserves the structured payload
 *   - the router routes complaint forms to set_bike_subtype_preference
 *     even when no want/use verb is present
 *   - same-modality bike-label correction reaches the orchestrator with
 *     the disambiguated label (not the assault token's label)
 *
 * Run: sucrase-node src/__tests__/coachBikeSubtypeIntentTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  parseBikeSubtypeIntent,
  extractBikeLabel,
  parseModalitySwapRequest,
  type BikeLabel,
} from '../utils/coachModalitySwap';
import {
  routeCoachCommand,
  canFallbackToLegacy,
  type CoachCommand,
} from '../utils/coachCommandRouter';
import {
  captureFromExecutorClarify,
  resumeFromPending,
} from '../utils/coachClarifierResume';
import {
  resolveCoachReference,
  type CoachReferenceResolution,
} from '../utils/coachReferenceResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

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

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXED_TODAY = '2026-04-29'; // Wednesday
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NOW = 1714316400000;

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
function ex(name: string): any {
  return {
    id: `we-${name}`,
    workoutId: 'wk',
    exerciseId: `ex-${name}`,
    exerciseOrder: 0,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 0,
    exercise: {
      id: `ex-${name}`,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}
function wk(name: string, dow: number, exercises: any[] = []): any {
  return {
    id: `w-${dow}`,
    microcycleId: 'mc',
    dayOfWeek: dow,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    exercises,
    createdAt: '',
    updatedAt: '',
  };
}
function buildResolvedDay(date: string, workoutDef: any | null): ResolvedDay {
  const dow = isoToDow(date);
  return {
    date,
    dayOfWeek: dow,
    short: SHORT[dow],
    isToday: date === FIXED_TODAY,
    workout: workoutDef,
    source: workoutDef ? 'template' : 'rest',
    indicator: null,
  } as any;
}
function buildSampleCurrentWeek(): ResolvedDay[] {
  const monLower = wk('Lower Body Strength', 1, [ex('Trap Bar Deadlift')]);
  const wedRow = wk('Easy Aerobic Flush', 3, [ex('Rower')]);
  const friPull = wk('Upper Pull', 5, [ex('Pull-Up')]);
  const days: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let w: any = null;
    if (dow === 1) w = monLower;
    else if (dow === 3) w = wedRow;
    else if (dow === 5) w = friPull;
    days.push(buildResolvedDay(date, w));
  }
  return days;
}

console.log('\n=== coachBikeSubtypeIntentTests ===');

// ─── 1. The 8 phrase tests Sam specified ──────────────────────────
section('[1] phrase tests — desiredLabel resolution');

const PHRASES: Array<{ msg: string; expected: BikeLabel; sourceContains: string }> = [
  { msg: 'I want a normal bike',                       expected: 'standard', sourceContains: 'positive_regular' },
  { msg: 'regular bike, not assault bike',             expected: 'standard', sourceContains: 'negation_assault' },
  { msg: 'not assault bike',                           expected: 'standard', sourceContains: 'negation_assault' },
  { msg: "I don't want assault bike",                  expected: 'standard', sourceContains: 'negation_assault' },
  { msg: "it's still saying assault bike?",            expected: 'standard', sourceContains: 'complaint_assault' },
  { msg: 'it says assault bike',                       expected: 'standard', sourceContains: 'complaint_assault' },
  { msg: 'use assault bike',                           expected: 'assault',  sourceContains: 'positive_assault' },
  { msg: 'make it assault bike',                       expected: 'assault',  sourceContains: 'positive_assault' },
];

for (const { msg, expected, sourceContains } of PHRASES) {
  const intent = parseBikeSubtypeIntent(msg);
  ok(
    `1.${PHRASES.indexOf(PHRASES.find((p) => p.msg === msg)!) + 1} "${msg}" → desiredLabel=${expected}`,
    intent.desiredLabel === expected,
    `got desiredLabel=${intent.desiredLabel} source=${intent.source}`,
  );
  ok(
    `1.${PHRASES.indexOf(PHRASES.find((p) => p.msg === msg)!) + 1}.s "${msg}" → source=${sourceContains}`,
    intent.source === sourceContains,
    `got source=${intent.source}`,
  );
}

// ─── 2. Live-bug acceptance flow ──────────────────────────────────
section('[2] live-bug acceptance: "You changed to an assault bike I want a normal bike"');
{
  const live = 'You changed to an assault bike I want a normal bike';
  const intent = parseBikeSubtypeIntent(live);
  eq('2.1 desiredLabel = standard', intent.desiredLabel, 'standard' as BikeLabel);
  ok('2.2 source = positive_regular (verb attaches to "want a normal bike")',
    intent.source === 'positive_regular',
    `got source=${intent.source}`);
  // extractBikeLabel must match the new disambiguated parser
  eq('2.3 extractBikeLabel agrees', extractBikeLabel(live), 'standard' as BikeLabel);
  // parseModalitySwapRequest must produce a same-modality correction
  // with the correct bike label (was the live failure: emitted 'assault')
  const swap = parseModalitySwapRequest(live);
  ok('2.4 parseModalitySwapRequest returns same-modality correction',
    !!swap && swap.from === 'bike' && swap.to === 'bike',
    JSON.stringify(swap));
  ok('2.5 swap.bikeLabel = standard',
    swap?.bikeLabel === 'standard',
    `got swap.bikeLabel=${swap?.bikeLabel}`);
}

// ─── 3. Question-form-as-complaint guard ──────────────────────────
section('[3] question form: trailing "?" + assault mention with no positive verb');
{
  const messages = [
    "It's still saying assault bike?",
    'why is there still an assault bike?',
    'assault bike?',
  ];
  for (const m of messages) {
    const intent = parseBikeSubtypeIntent(m);
    ok(`3.x "${m}" → standard`,
      intent.desiredLabel === 'standard',
      `got desiredLabel=${intent.desiredLabel} source=${intent.source}`);
  }
  // POSITIVE assault wins over question form (defensive — "want assault bike?")
  const positiveQuestion = parseBikeSubtypeIntent('want assault bike?');
  eq('3.4 "want assault bike?" → assault (positive verb wins)',
    positiveQuestion.desiredLabel,
    'assault' as BikeLabel);
  eq('3.5 "want assault bike?" source = positive_assault',
    positiveQuestion.source,
    'positive_assault');
}

// ─── 4. Pending clarifier resume preserves structured payload ─────
section('[4] pending clarifier resume — bike-subtype correction stays structured');
{
  // Set up: router emitted set_bike_subtype_preference with target unbound
  // (simulating the user typing the correction without a session pinned).
  // captureFromExecutorClarify deliberately excludes set_bike_subtype_preference
  // from RESUMABLE_OPS — but the router itself routes the correction with
  // the correct label, so on retry the second message produces a fresh
  // mutate command, not a legacy fallthrough. The integration guarantee:
  // a pending bike-subtype correction does NOT fall to legacy.
  const cmd = routeCoachCommand({
    userMessage: 'I want a normal bike',
    todayISO: FIXED_TODAY,
    referenceResolution: {
      status: 'resolved',
      target: { date: FIXED_TODAY, sessionName: 'Easy Aerobic Flush', method: 'pronoun_last_discussed' },
      isMutationLike: true,
      confidence: 0.9,
    },
  });
  ok('4.1 routed to mutate', cmd.mode === 'mutate');
  ok('4.2 operation = set_bike_subtype_preference',
    cmd.mode === 'mutate' && cmd.operation === 'set_bike_subtype_preference');
  ok('4.3 payload bikeLabel = standard',
    cmd.mode === 'mutate' &&
      cmd.payload.operation === 'set_bike_subtype_preference' &&
      cmd.payload.bikeLabel === 'standard');
  ok('4.4 legacy fallback BLOCKED', !canFallbackToLegacy(cmd));

  // Resume: Phase G Fix A makes set_bike_subtype_preference resumable.
  // When the router emits the op with needsClarification=true and the
  // executor returns kind='clarify', we MUST stash it; otherwise the
  // next user message ("Wednesday" / "yes" / etc.) falls through to
  // legacy /coach-chat which has been observed to hallucinate
  // set_preferred_alternative actions.
  const partialCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'set_bike_subtype_preference',
    target: { kind: 'unbound' },
    payload: { operation: 'set_bike_subtype_preference', bikeLabel: 'standard' },
    scope: 'recurring',
    confidence: 0.6,
    needsClarification: true,
    clarificationQuestion: 'Which session should the bike change apply to?',
    missingFields: ['target_session'],
    reason: 'bike_subtype_correction',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: partialCommand,
    askedQuestion: 'Which session should the bike change apply to?',
    originalMessage: 'I want a normal bike',
  });
  ok('4.5 captureFromExecutorClarify stashes bike subtype pref (Phase G Fix A)',
    captured != null && captured.operation === 'set_bike_subtype_preference');
  ok('4.6 stashed payload preserves bikeLabel=standard',
    captured != null && (captured.partialPayload as any).bikeLabel === 'standard');
}

// ─── 5. Router gating — complaint forms still route to mutate ─────
section('[5] router gates — complaint shapes route to set_bike_subtype_preference');
{
  const ref: CoachReferenceResolution = {
    status: 'resolved',
    target: { date: FIXED_TODAY, sessionName: 'Easy Aerobic Flush', method: 'pronoun_last_discussed' },
    isMutationLike: true,
    confidence: 0.9,
  };
  const cases: Array<{ msg: string; expectedLabel: BikeLabel }> = [
    { msg: "It's still saying assault bike?", expectedLabel: 'standard' },
    { msg: 'it says assault bike',            expectedLabel: 'standard' },
    { msg: 'not assault bike',                expectedLabel: 'standard' },
    { msg: "I don't want assault bike",       expectedLabel: 'standard' },
  ];
  for (const { msg, expectedLabel } of cases) {
    const cmd = routeCoachCommand({
      userMessage: msg,
      todayISO: FIXED_TODAY,
      referenceResolution: ref,
    });
    ok(`5.x "${msg}" → mutate`, cmd.mode === 'mutate', `got ${cmd.mode}`);
    ok(`5.x "${msg}" → set_bike_subtype_preference`,
      cmd.mode === 'mutate' && cmd.operation === 'set_bike_subtype_preference',
      `got operation=${cmd.mode === 'mutate' ? cmd.operation : 'n/a'}`);
    ok(`5.x "${msg}" → bikeLabel=${expectedLabel}`,
      cmd.mode === 'mutate' &&
        cmd.payload.operation === 'set_bike_subtype_preference' &&
        cmd.payload.bikeLabel === expectedLabel);
    ok(`5.x "${msg}" → legacy fallback BLOCKED`, !canFallbackToLegacy(cmd));
  }
}

// ─── 6. Positive assault forms preserved ──────────────────────────
section('[6] positive assault — "use assault bike" stays assault');
{
  const ref: CoachReferenceResolution = {
    status: 'resolved',
    target: { date: FIXED_TODAY, sessionName: 'Easy Aerobic Flush', method: 'pronoun_last_discussed' },
    isMutationLike: true,
    confidence: 0.9,
  };
  for (const msg of ['use assault bike', 'make it assault bike', "I'd prefer an assault bike"]) {
    const cmd = routeCoachCommand({
      userMessage: msg,
      todayISO: FIXED_TODAY,
      referenceResolution: ref,
    });
    ok(`6.x "${msg}" → set_bike_subtype_preference assault`,
      cmd.mode === 'mutate' &&
        cmd.operation === 'set_bike_subtype_preference' &&
        cmd.payload.operation === 'set_bike_subtype_preference' &&
        cmd.payload.bikeLabel === 'assault');
  }
}

// ─── 7. Bare-token mentions don't trigger preference write ────────
section('[7] bare-token mentions only fire when a mutation cue is present');
{
  // No verb, no negation, no complaint. Should not route to mutate via
  // bike-subtype path. (Could still match the modality_swap pattern, but
  // with no `change/swap` verb either, it falls through to conversation.)
  const ref: CoachReferenceResolution = {
    status: 'resolved',
    target: { date: FIXED_TODAY, dow: 3, sessionName: 'Easy Aerobic Flush' },
    isMutationLike: false,
    confidence: 0.3,
    method: 'recent_context',
  } as CoachReferenceResolution;
  const cmd = routeCoachCommand({
    userMessage: 'what is a regular bike',
    todayISO: FIXED_TODAY,
    referenceResolution: ref,
    isMutationLike: false,
    referenceState: null,
  });
  ok('7.1 bare-token question → not bike-subtype mutate',
    !(cmd.mode === 'mutate' && cmd.operation === 'set_bike_subtype_preference'),
    `got mode=${cmd.mode} op=${cmd.mode === 'mutate' ? cmd.operation : 'n/a'}`);
  // parser returns desiredLabel=standard with token_only_regular source,
  // but the router gate refuses to commit on bare-token alone.
  const intent = parseBikeSubtypeIntent('what is a regular bike');
  eq('7.2 parser still returns desiredLabel=standard', intent.desiredLabel, 'standard' as BikeLabel);
  eq('7.3 parser source = token_only_regular', intent.source, 'token_only_regular');
}

// ─── 8. No false success — null when no callout ───────────────────
section('[8] no bike mention → null intent');
{
  const intent = parseBikeSubtypeIntent('move the row to Thursday');
  ok('8.1 no bike mention → desiredLabel=null', intent.desiredLabel === null);
  ok('8.2 no bike mention → source=null', intent.source === null);
  ok('8.3 no bike mention → confidence=0', intent.confidence === 0);
}

// ─── 9. Existing modality preference test phrases stay green ──────
section('[9] regression — existing modality preference test phrases preserved');
{
  const cases: Array<{ msg: string; expected: BikeLabel }> = [
    { msg: 'I just want a regular bike, not an assault bike.',           expected: 'standard' },
    { msg: 'Actually I want a regular bike, not an assault bike.',       expected: 'standard' },
    { msg: 'I want a regular bike, not assault.',                        expected: 'standard' },
    { msg: 'actually make that a stationary bike',                       expected: 'standard' },
    { msg: 'I want a regular bike, not an assault bike',                 expected: 'standard' },
    { msg: 'not assault bike, normal bike',                              expected: 'standard' },
  ];
  for (const { msg, expected } of cases) {
    const intent = parseBikeSubtypeIntent(msg);
    ok(`9.x "${msg.slice(0, 50)}…" → ${expected}`,
      intent.desiredLabel === expected,
      `got desiredLabel=${intent.desiredLabel} source=${intent.source}`);
  }
}

// ─── Summary ───────────────────────────────────────────────────────

console.log('\n=== Summary ===');
console.log(`  pass: ${pass}`);
console.log(`  fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
