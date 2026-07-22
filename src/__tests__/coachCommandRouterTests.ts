/**
 * coachCommandRouterTests — architectural assertions for the router.
 *
 * These tests guard the contract documented at the top of
 * coachCommandRouter.ts:
 *
 *  • Mutation-like turns NEVER drop into mode='explain'.
 *  • Each supported operation classifies a representative
 *    set of messy user wordings.
 *  • The legacy fallback gate (canFallbackToLegacy) returns false for
 *    every mutate / clarify outcome.
 *  • The executor never returns "Done" for an op without an engine.
 *
 * Run: sucrase-node src/__tests__/coachCommandRouterTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  routeCoachCommand,
  isMutateCommand,
  canFallbackToLegacy,
  type CoachCommand,
  type RouteCoachCommandInput,
} from '../utils/coachCommandRouter';
import {
  executeCoachCommand,
} from '../utils/coachCommandExecutor';
import { useProgramStore } from '../store/programStore';
import * as sessionResolver from '../utils/sessionResolver';
import type { Workout, WorkoutExercise } from '../types/domain';
import type { CoachReferenceResolution } from '../utils/coachReferenceResolver';
import {
  dayWorkoutShowsConditioningAfterStrength,
  workoutShowsExpectedActivity,
} from '../utils/visibleProgramReadModel';
import {
  applyConditioningModalityToWorkout,
  parseBikeSubtypeIntent,
} from '../utils/coachModalitySwap';
import {
  chooseBestConditioningAddition,
} from '../utils/coachPlan';
import {
  executeProgramEdit,
  interpretCoachMessageToProgramEdit,
} from '../utils/coachProgramEdit';

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

const TODAY = '2026-05-08';
const PAST_WED = '2026-05-06';
const FUTURE_SAT = '2026-05-09';

function resolved(date: string, sessionName: string): CoachReferenceResolution {
  return {
    status: 'resolved' as any,
    target: { date, sessionName, method: 'pronoun_last_explained' as any },
    confidence: 0.95,
    isMutationLike: true,
  } as any;
}

function unresolved(): CoachReferenceResolution {
  return {
    status: 'no_target' as any,
    target: null,
    confidence: 0.1,
    clarifierQuestion: 'Which session do you mean?',
    isMutationLike: true,
  } as any;
}

function ambiguous(): CoachReferenceResolution {
  return {
    status: 'ambiguous' as any,
    target: null,
    candidates: [
      { date: PAST_WED, sessionName: 'Easy Aerobic Flush', method: 'modality_match' as any },
    ],
    confidence: 0.4,
    clarifierQuestion: 'Which Easy Aerobic Flush?',
    isMutationLike: true,
  } as any;
}

function input(
  msg: string,
  ref: CoachReferenceResolution | null = resolved(PAST_WED, 'Easy Aerobic Flush'),
): RouteCoachCommandInput {
  return {
    userMessage: msg,
    todayISO: TODAY,
    referenceResolution: ref,
  };
}

function asMutate(c: CoachCommand): Extract<CoachCommand, { mode: 'mutate' }> | null {
  return c.mode === 'mutate' ? c : null;
}

// ─── 1. The 13 messy phrases ───────────────────────────────────────

section('1. 13 messy phrases — every mutation routes to mutate or clarify');

const PHRASES: Array<{ msg: string; expectedOp?: string; mode: 'mutate' | 'clarify' }> = [
  // Direct mutations
  { msg: 'change it to a bike instead of a row', expectedOp: 'set_conditioning_modality_preference', mode: 'mutate' },
  { msg: 'swap it to bike going forward', expectedOp: 'set_conditioning_modality_preference', mode: 'mutate' },
  { msg: 'just this session, change it to bike', expectedOp: 'swap_conditioning_modality_once', mode: 'mutate' },
  { msg: 'remove that session', expectedOp: 'remove_session', mode: 'mutate' },
  // Bike subtype callouts
  { msg: 'not assault bike, normal bike', expectedOp: 'set_bike_subtype_preference', mode: 'mutate' },
  { msg: 'actually make that a stationary bike', expectedOp: 'set_bike_subtype_preference', mode: 'mutate' },
  { msg: 'I want a regular bike, not an assault bike', expectedOp: 'set_bike_subtype_preference', mode: 'mutate' },
  // Undo / scope correction
  { msg: 'undo that', expectedOp: 'undo_last_change', mode: 'mutate' },
  { msg: 'never mind, change it back', expectedOp: 'undo_last_change', mode: 'mutate' },
  { msg: 'I meant next Wednesday', mode: 'clarify' },
  { msg: 'not this week, going forward', mode: 'clarify' },
  // Move + add
  { msg: 'move Wednesday to Thursday', expectedOp: 'move_session', mode: 'mutate' },
  { msg: 'add a bike session on Thursday', expectedOp: 'add_conditioning', mode: 'mutate' },
  { msg: "Can you add a light walk to Friday's session?", expectedOp: 'add_conditioning', mode: 'mutate' },
  { msg: "Can you add a light bike to Friday's session?", expectedOp: 'add_conditioning', mode: 'mutate' },
  { msg: "Can you add pilates to Friday's session?", expectedOp: 'add_conditioning', mode: 'mutate' },
];

for (const { msg, expectedOp, mode } of PHRASES) {
  const cmd = routeCoachCommand(input(msg));
  ok(
    `phrase "${msg.slice(0, 48)}…" → mode=${mode}`,
    cmd.mode === mode,
    `got ${cmd.mode} (route reason: ${('reason' in cmd ? cmd.reason : 'n/a')})`,
  );
  if (mode === 'mutate' && expectedOp) {
    const m = asMutate(cmd);
    ok(
      `phrase "${msg.slice(0, 48)}…" → operation=${expectedOp}`,
      m?.operation === expectedOp,
      `got ${m?.operation ?? 'n/a'}`,
    );
  }
  ok(
    `phrase "${msg.slice(0, 48)}…" → NEVER mode=explain`,
    cmd.mode !== 'explain',
    `got ${cmd.mode}`,
  );
  ok(
    `phrase "${msg.slice(0, 48)}…" → legacy fallback BLOCKED`,
    !canFallbackToLegacy(cmd),
    `mode=${cmd.mode}, reason=${'reason' in cmd ? cmd.reason : 'n/a'}`,
  );
}

// ─── 2. Bike subtype routing details ───────────────────────────────

section('2. Bike subtype routing — bikeLabel detected, scope=recurring');

const bikeCmd = routeCoachCommand(
  input('I want a regular bike, not an assault bike'),
);
ok('bike subtype is mutate', bikeCmd.mode === 'mutate');
const bikeMut = asMutate(bikeCmd)!;
eq('bike subtype operation', bikeMut.operation, 'set_bike_subtype_preference');
ok(
  'bike payload carries bikeLabel=standard',
  bikeMut.payload.operation === 'set_bike_subtype_preference' &&
    bikeMut.payload.bikeLabel === 'standard',
);
eq('bike subtype scope = recurring', bikeMut.scope, 'recurring');
ok('bike subtype confidence ≥ 0.6', bikeMut.confidence >= 0.6, `${bikeMut.confidence}`);
ok('bike subtype no clarifier needed (resolved)', bikeMut.needsClarification === false);

// Same wording without a target → must still emit mutate, but flag clarification
const bikeNoTarget = routeCoachCommand(input('I want a regular bike, not an assault bike', null));
const bikeNoTargetMut = asMutate(bikeNoTarget);
ok('bike subtype no-resolution still mutate', bikeNoTargetMut !== null);
ok('bike subtype no-resolution flags needsClarification', bikeNoTargetMut?.needsClarification === true);

const whyNotAssaultIntent = parseBikeSubtypeIntent("Why isn't it an assault bike?");
eq('"Why isn\'t it an assault bike?" → desired assault',
  whyNotAssaultIntent.desiredLabel,
  'assault' as any);
const whyNotAssaultCmd = routeCoachCommand(
  input("Why isn't it an assault bike?", resolved(TODAY, 'Lower Squat')),
);
ok('"Why isn\'t it an assault bike?" → mutate',
  whyNotAssaultCmd.mode === 'mutate');
eq('"Why isn\'t it an assault bike?" op',
  asMutate(whyNotAssaultCmd)?.operation,
  'set_bike_subtype_preference' as any);
eq('"Why isn\'t it an assault bike?" payload bikeLabel=assault',
  (asMutate(whyNotAssaultCmd)?.payload as any)?.bikeLabel,
  'assault');
const assaultLabelRewrite = applyConditioningModalityToWorkout({
  name: 'Lower Squat',
  description: 'core + Conditioning',
  exercises: [
    {
      id: 'bike-row',
      notes: '75-80% max HR. Keep it aerobic.',
      exercise: {
        name: 'Bike Intervals',
        description: '8 x 2 min on bike.',
      },
    },
  ],
  conditioningBlock: {
    options: [
      {
        title: 'Bike Intervals',
        description: '8 x 2 min on bike.',
        exerciseIds: ['bike-row'],
      },
    ],
  },
} as any, {
  fromModality: 'bike',
  toModality: 'bike',
  bikeLabel: 'assault',
  isLabelOnlyFix: true,
});
ok('assault label rewrite updates option title',
  /Assault Bike Intervals/i.test(assaultLabelRewrite.conditioningBlock.options[0].title));
ok('assault label rewrite updates exercise name',
  /Assault Bike Intervals/i.test(assaultLabelRewrite.exercises[0].exercise.name));

// ─── 3. Modality swap scope detection ──────────────────────────────

section('3. Modality swap scope detection');

const recurring = asMutate(routeCoachCommand(input('change it to bike going forward')))!;
eq('"going forward" → recurring scope', recurring.scope, 'recurring');
eq('"going forward" → preference op', recurring.operation, 'set_conditioning_modality_preference');

const oneOff = asMutate(routeCoachCommand(input('just this session, change it to bike', resolved(FUTURE_SAT, 'Easy Aerobic Flush'))))!;
eq('"just this session" + future → one_off scope', oneOff.scope, 'one_off');
eq('"just this session" → swap_once op', oneOff.operation, 'swap_conditioning_modality_once');

const pastDefault = asMutate(routeCoachCommand(input('change it to bike instead of a row')))!;
eq('past target without "just this" → recurring scope', pastDefault.scope, 'recurring');
eq('past target → preference op', pastDefault.operation, 'set_conditioning_modality_preference');

const dayModalityRewrite = asMutate(routeCoachCommand(input(
  'Can you please change Wednesday session to be a ski erg?',
  resolved('2026-06-03', 'Easy Aerobic Flush (25min Rower)'),
)))!;
eq('day + modality conversion → swap_once op',
  dayModalityRewrite.operation,
  'swap_conditioning_modality_once');
eq('day + modality conversion preserves target day',
  dayModalityRewrite.target,
  { kind: 'date', date: '2026-06-03', sessionName: 'Easy Aerobic Flush (25min Rower)' } as any);
eq('day + modality conversion payload targets ski',
  (dayModalityRewrite.payload as any).to,
  'ski');
ok('day + modality conversion does not route as add_conditioning',
  dayModalityRewrite.operation !== 'add_conditioning');
ok('day + modality conversion does not route as replace_exercise',
  dayModalityRewrite.operation !== 'replace_exercise');

const dayModalityBeatsLastAdd = asMutate(routeCoachCommand({
  ...input(
    "Can you make wednesdays session a ski erg?",
    resolved('2026-06-03', 'Easy Aerobic Flush (25min Rower)'),
  ),
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: '2026-06-03', sessionName: 'Easy Aerobic Flush (25min Rower)' },
    appliedAt: Date.now(),
    userMessage: 'Can you also add a 10 min ski erg onto that day',
    touchedActivities: [{
      kind: 'conditioning',
      date: '2026-06-03',
      sessionName: 'Easy Aerobic Flush (25min Rower)',
      title: 'SkiErg',
      modality: 'ski',
      durationMinutes: 10,
    } as any],
  },
}))!;
eq('explicit session modality beats last add-on history',
  dayModalityBeatsLastAdd.operation,
  'swap_conditioning_modality_once');
eq('explicit session modality still targets ski',
  (dayModalityBeatsLastAdd.payload as any).to,
  'ski');
ok('explicit session modality is not add_conditioning',
  dayModalityBeatsLastAdd.operation !== 'add_conditioning');

const skiErgWorkout = {
  name: 'Easy Aerobic Flush',
  exercises: [
    {
      id: 'ski-row',
      exercise: { name: 'Easy Aerobic Flush (25min SkiErg)' },
      notes: '25min easy SkiErg.',
    },
  ],
} as any;
const assaultAfterSki = asMutate(routeCoachCommand({
  ...input(
    'Actually make it assault bike please',
    resolved('2026-06-03', 'Easy Aerobic Flush'),
  ),
  currentWeek: [{
    date: '2026-06-03',
    sessionName: 'Easy Aerobic Flush',
    workout: skiErgWorkout,
  }],
}))!;
eq('positive assault bike after non-bike target → swap_once op',
  assaultAfterSki.operation,
  'swap_conditioning_modality_once');
eq('positive assault bike after non-bike target → bike modality',
  (assaultAfterSki.payload as any).to,
  'bike');
eq('positive assault bike after non-bike target → assault subtype',
  (assaultAfterSki.payload as any).bikeLabel,
  'assault');
ok('positive assault bike after non-bike target is not label-only preference',
  assaultAfterSki.operation !== 'set_bike_subtype_preference');

// ─── 4. Undo without lastChange → ask for clarification ────────────

section('4. Undo handling');

const undoNoHistory = routeCoachCommand(input('undo that'));
const undoMut = asMutate(undoNoHistory)!;
eq('undo verb → mutate', undoNoHistory.mode, 'mutate');
eq('undo operation', undoMut.operation, 'undo_last_change');
ok('undo flags needsClarification (no history)', undoMut.needsClarification === true);

const undoWithHistory = routeCoachCommand({
  ...input('undo that'),
  lastChange: {
    operation: 'set_conditioning_modality_preference',
    target: { kind: 'date', date: PAST_WED, sessionName: 'Easy Aerobic Flush' },
    appliedAt: Date.now(),
  },
});
const undoWithMut = asMutate(undoWithHistory)!;
ok('undo with lastChange → no clarifier needed', undoWithMut.needsClarification === false);
ok('undo confidence higher with history', undoWithMut.confidence >= 0.8);

// ─── 5. Move session needs both target + dow ───────────────────────

section('5. Move session');

// Phase C: the executor owns the clarifier with concrete day options
// drawn from the visible week, so the router emits needsClarification=false
// for every move_session command. The router still tags target/payload
// completeness via target.kind ('unbound') and missing toDow.
const moveNoTarget = asMutate(routeCoachCommand(input('move it to Thursday', null)))!;
eq('move op', moveNoTarget.operation, 'move_session');
ok('move with no target → executor owns clarify',
  moveNoTarget.needsClarification === false);
ok('move with no target → target.kind unbound',
  moveNoTarget.target.kind === 'unbound');

const moveTargetNoDow = asMutate(routeCoachCommand(input('move that session somewhere else')))!;
ok('move w/ target but no dow → executor owns clarify',
  moveTargetNoDow.needsClarification === false);
ok('move w/ target but no dow → payload toDow undefined',
  moveTargetNoDow.payload.operation === 'move_session' &&
    moveTargetNoDow.payload.toDow === undefined);

const moveTargetAndDow = asMutate(routeCoachCommand(input(
  'move Wednesday to Thursday this week',
  resolved('2026-05-13', 'Easy Aerobic Flush'),
)))!;
ok('move w/ both flagged → no clarification', moveTargetAndDow.needsClarification === false);
const movePayload = moveTargetAndDow.payload;
ok(
  'move payload carries toDow=4 (Thursday)',
  movePayload.operation === 'move_session' && movePayload.toDow === 4,
);
ok(
  'move payload carries toDate (computed from toDow)',
  movePayload.operation === 'move_session' && typeof movePayload.toDate === 'string',
);

// ─── 6. Replace exercise (non-modality) ────────────────────────────

section('6. Replace exercise');

const replace = routeCoachCommand(input('swap deadlift for trap bar deadlift'));
const replaceMut = asMutate(replace)!;
eq('replace operation', replaceMut.operation, 'replace_exercise');
const rPayload = replaceMut.payload;
ok(
  'replace payload carries from + to',
  rPayload.operation === 'replace_exercise' &&
    /deadlift/i.test(rPayload.fromExercise) &&
    /trap bar/i.test(rPayload.toExercise ?? ''),
);

// "swap row for bike" must NOT route as replace_exercise — it's a modality swap.
const swapModality = asMutate(routeCoachCommand(input('swap the row for a bike')))!;
ok(
  'swap row for bike → modality op (not replace_exercise)',
  swapModality.operation === 'set_conditioning_modality_preference' ||
    swapModality.operation === 'swap_conditioning_modality_once',
  `got ${swapModality.operation}`,
);

// ─── 7. Mutation-like fall-through never explains ──────────────────

section('7. Mutation-like fall-through never lands as explain');

const verbsNoPayload = ['change something on Wednesday', 'I want to swap', 'please make it different'];
for (const msg of verbsNoPayload) {
  const c = routeCoachCommand(input(msg));
  ok(`"${msg}" → not explain`, c.mode !== 'explain', `got ${c.mode}`);
  ok(`"${msg}" → legacy blocked`, !canFallbackToLegacy(c));
}

const ambiguousMsg = routeCoachCommand(input('change it', ambiguous()));
ok('ambiguous resolution → clarify', ambiguousMsg.mode === 'clarify');

const unresolvedMsg = routeCoachCommand(input('change something', unresolved()));
ok('unresolved → clarify', unresolvedMsg.mode === 'clarify');

// ─── 8. Pure questions delegate to legacy explanation ──────────────

section('8. Pure questions delegate to legacy explanation');

const why = routeCoachCommand(input('why is Wednesday a row session?'));
ok('"why" question → conversation', why.mode === 'conversation');
ok('"why" allows legacy fallback', canFallbackToLegacy(why));

const explain = routeCoachCommand(input('explain how the aerobic flush works'));
ok('"explain" → conversation', explain.mode === 'conversation');
ok('"explain" allows legacy fallback', canFallbackToLegacy(explain));

const inspect = routeCoachCommand(input("what's on Wednesday?"));
ok('"what\'s on" → inspect_state', inspect.mode === 'inspect_state');
ok('inspect_state allows legacy fallback', canFallbackToLegacy(inspect));

// ─── 9. isMutateCommand / canFallbackToLegacy gates ─────────────────

section('9. Hard gate: isMutateCommand + canFallbackToLegacy');

ok('mutate command → isMutateCommand=true', isMutateCommand({
  mode: 'mutate', operation: 'undo_last_change', target: { kind: 'last_change' },
  payload: { operation: 'undo_last_change' }, scope: 'one_off', confidence: 0.9,
  needsClarification: false, reason: 'test',
} as any));
ok('mutate command → canFallbackToLegacy=false', !canFallbackToLegacy({
  mode: 'mutate', operation: 'undo_last_change', target: { kind: 'last_change' },
  payload: { operation: 'undo_last_change' }, scope: 'one_off', confidence: 0.9,
  needsClarification: false, reason: 'test',
} as any));
ok('clarify command → isMutateCommand=true (still gates legacy)', isMutateCommand({
  mode: 'clarify', question: 'Which?', reason: 'test',
} as any));
ok('clarify command → canFallbackToLegacy=false', !canFallbackToLegacy({
  mode: 'clarify', question: 'Which?', reason: 'test',
} as any));

// ─── 10. Executor: unsupported ops return honest reply ─────────────

section('10. Executor — every op honest about what it can/can\'t do');

// All 8 operations are supported in Phase D. Empty-history undo lands
// at `verified_no_op` with the canonical "I don't have a recent change"
// reply — it must NEVER respond with "Done" when there's nothing to
// undo. Section 17 covers the full undo lifecycle with stub deps;
// here we just guard the empty-history baseline + the no-lastChange
// clarifier path.
const undoSupportedCmd = routeCoachCommand({
  ...input('undo that'),
  lastChange: {
    operation: 'set_conditioning_modality_preference',
    target: { kind: 'date', date: PAST_WED, sessionName: 'Easy Aerobic Flush' },
    appliedAt: Date.now(),
  },
});
const undoSupportedResult = executeCoachCommand({
  command: undoSupportedCmd,
  todayISO: TODAY,
  referenceResolution: input('undo that').referenceResolution,
  userMessage: 'undo that',
  // Stub the undo deps so the executor doesn't read the live history store.
  undoDeps: {
    getLastUndoableMutation: () => null,
  },
});
eq('undo executor kind = verified_no_op (empty history)', undoSupportedResult.kind, 'verified_no_op');
ok('undo executor reply does NOT start with "Done"', !/^Done\b/.test(undoSupportedResult.reply), undoSupportedResult.reply);
ok('undo executor reply mentions "no recent coach change"', /don'?t have a recent coach change/i.test(undoSupportedResult.reply), undoSupportedResult.reply);
ok('undo executor applied = false', undoSupportedResult.applied === false);

const undoResult = executeCoachCommand({
  command: routeCoachCommand(input('undo that')),
  todayISO: TODAY,
  referenceResolution: input('undo that').referenceResolution,
  userMessage: 'undo that',
});
eq('undo (no lastChange) executor kind = clarify', undoResult.kind, 'clarify');
ok('undo (no lastChange) reply asks for the change to undo', /undo/i.test(undoResult.reply));

// ─── 11. Executor — modality op delegates to orchestrator ──────────

section('11. Executor — modality ops use orchestrator (verified reply path)');

const stages: string[] = [];
const modalityCmd = routeCoachCommand(input('change it to bike going forward'));
const modalityResult = executeCoachCommand({
  command: modalityCmd,
  todayISO: TODAY,
  referenceResolution: input('change it to bike going forward').referenceResolution,
  userMessage: 'change it to bike going forward',
  onProgress: (s) => stages.push(s),
});
ok(
  'modality executor invoked progress: checking_program',
  stages[0] === 'checking_program',
  stages.join(','),
);
ok(
  'modality executor invoked progress: applying_change',
  stages[1] === 'applying_change',
  stages.join(','),
);
ok(
  'modality executor invoked progress: verifying_update',
  stages[2] === 'verifying_update',
  stages.join(','),
);
ok(
  'modality executor invoked progress: composing_reply',
  stages[3] === 'composing_reply',
  stages.join(','),
);
ok(
  'modality executor delegates to orchestrator (modalityOutcome present)',
  modalityResult.modalityOutcome !== undefined,
);
// The orchestrator runs against the live store with no scheduling;
// the route should at least be one of the orchestrator's labels.
ok(
  'modality result.route is orchestrator-shaped',
  /^modality_|^reference_|^no_reference|^unparseable_|^engine_|^apply_|^verification_/.test(modalityResult.route),
  modalityResult.route,
);

// ─── 12. Confidence: low-confidence mutate still routes through executor ─

section('12. Confidence + clarify gate before any engine call');

const lowConfMove = routeCoachCommand(input('move it', null));
// Phase C: the executor (not the router) owns the clarifier for missing
// move_session source so it can list the visible week's actual sessions.
ok('"move it" with no target → mutate w/ needsClarification=false (executor owns clarify)',
  asMutate(lowConfMove)?.needsClarification === false);
const exec = executeCoachCommand({
  command: lowConfMove,
  todayISO: TODAY,
  referenceResolution: null,
  userMessage: 'move it',
  // Stub visibleWeek so the executor produces options without a live store.
  moveSessionDeps: {
    visibleWeek: () => [],
    snapshotBefore: () => null,
    applyMove: () => { throw new Error('apply must NOT be called for unbound source'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for unbound source'); },
  },
});
eq('clarify executor kind', exec.kind, 'clarify');
ok('clarify executor never reaches engine (no progress beyond composing_reply)',
  exec.progress.length === 1 && exec.progress[0] === 'composing_reply',
);

// ─── 13. Mode-first coverage — conversation / clarify / mutate /
//        inspect / reject_with_reason ──────────────────────────────

section('13. Mode-first coverage — 5 canonical modes');

// Conversation: grounded program question
const conv1 = routeCoachCommand(input('why is there a row mid week?'));
ok('"why is there a row" → conversation', conv1.mode === 'conversation');
ok('conversation allows legacy fallback (with packet)', canFallbackToLegacy(conv1));

// Conversation: hypothetical
const conv2 = routeCoachCommand(input('would this affect Thursday?'));
ok('"would this affect Thursday?" → conversation', conv2.mode === 'conversation');
ok('hypothetical does not become a mutation', !isMutateCommand(conv2));

// Conversation: "is X too much?"
const conv3 = routeCoachCommand(input('is Wednesday too much?'));
ok('"is Wednesday too much?" → conversation', conv3.mode === 'conversation');

// Clarify: vague load — must offer options
const clr1 = routeCoachCommand(input('can you make this week easier?'));
ok('"make this week easier" → clarify', clr1.mode === 'clarify');
const clr1Options = (clr1 as any).options ?? [];
ok('clarify offers 2+ concrete options', clr1Options.length >= 2);
ok('clarify includes a "gym/conditioning/both" option',
  /(gym|conditioning|both)/i.test(clr1Options.join(' ')));
ok('clarify never lands as conversation', clr1.mode !== ('conversation' as any));

// Clarify: vague dislike — must offer facets
const clr2 = routeCoachCommand(input("I don't like Wednesday"));
ok('"I don\'t like Wednesday" → clarify', clr2.mode === 'clarify');
const clr2Options = (clr2 as any).options ?? [];
ok('dislike clarifier offers 3+ facets', clr2Options.length >= 3);

// Mutate: clear, target-bound
const mut1 = routeCoachCommand({
  ...input('change it to a bike going forward'),
  referenceResolution: resolved(FUTURE_SAT, 'Easy Aerobic Flush'),
});
ok('"change it to bike going forward" → mutate', mut1.mode === 'mutate');
ok('mutate blocks legacy fallback', !canFallbackToLegacy(mut1));

// Inspect: state query
const insp1 = routeCoachCommand(input("what's on Wednesday?"));
ok('"what\'s on Wednesday?" → inspect_state', insp1.mode === 'inspect_state');
ok('inspect_state allows legacy fallback (with packet)', canFallbackToLegacy(insp1));

// Reject with reason: heavy-lower move within game window
// today=Wednesday so "move to Friday" lands on Fri 2026-05-08 (one day
// before the Saturday game) without isoForDow's same-dow rollover.
const todayISO = '2026-05-06'; // Wednesday
const gameSat = '2026-05-09';  // Saturday game
const move1 = routeCoachCommand({
  userMessage: 'move lower body to Friday',
  todayISO,
  referenceResolution: resolved(todayISO, 'Lower Body Strength'),
  gameDates: [gameSat],
});
ok('heavy-lower move within 72h of game → reject_with_reason',
  move1.mode === 'reject_with_reason' || move1.mode === 'reject');
const safety = (move1 as any).safetyConcerns ?? [];
ok('reject lists safetyConcerns', safety.length >= 1);
ok('safetyConcerns names heavy_lower window',
  safety.includes('heavy_lower_within_72h_of_game') ||
  safety.includes('non_pump_session_on_G-1'));
const alts = (move1 as any).suggestedAlternatives ?? [];
ok('reject lists alternatives', alts.length >= 1);
ok('reject reply mentions an alternative',
  /move|earlier|arms|pump|recovery/i.test((move1 as any).reply ?? ''));

// Reject with reason: conditioning move into 48h window (non-recovery)
const move2 = routeCoachCommand({
  userMessage: 'move bike to Friday',
  todayISO,
  referenceResolution: resolved(todayISO, 'Bike Intervals'),
  gameDates: [gameSat],
});
ok('non-recovery conditioning within 48h → reject_with_reason',
  move2.mode === 'reject_with_reason' || move2.mode === 'reject');

// Reject with reason: team training collision
const move3 = routeCoachCommand({
  userMessage: 'move lower to Tuesday',
  todayISO,
  referenceResolution: resolved(todayISO, 'Lower Body Strength'),
  teamTrainingDows: [2], // Tuesday is team training
});
ok('move onto team training day → reject_with_reason',
  move3.mode === 'reject_with_reason' || move3.mode === 'reject');

// Safe move (no game, no team day) → mutate
const move4 = routeCoachCommand({
  userMessage: 'move lower to Wednesday',
  todayISO,
  referenceResolution: resolved(todayISO, 'Lower Body Strength'),
  gameDates: [],
  teamTrainingDows: [],
});
ok('safe move → mutate', move4.mode === 'mutate');

// Reject with reason → executor preserves structure
const rej = routeCoachCommand({
  userMessage: 'move lower body to Friday',
  todayISO,
  referenceResolution: resolved(todayISO, 'Lower Body Strength'),
  gameDates: [gameSat],
});
const rejExec = executeCoachCommand({
  command: rej,
  todayISO,
  referenceResolution: null,
  userMessage: 'move lower body to Friday',
});
ok('reject executor kind = rejected_with_alternatives',
  rejExec.kind === 'rejected_with_alternatives');
ok('reject executor preserves safetyConcerns',
  Array.isArray(rejExec.safetyConcerns) && rejExec.safetyConcerns.length >= 1);
ok('reject executor preserves suggestedAlternatives',
  Array.isArray(rejExec.suggestedAlternatives) && rejExec.suggestedAlternatives.length >= 1);
ok('reject executor reply is non-empty',
  typeof rejExec.reply === 'string' && rejExec.reply.length > 0);
ok('reject executor blocks legacy (isMutateCommand=true)',
  isMutateCommand(rej));

// Conversation executor → conversation_delegated, no progress ticks
const convExec = executeCoachCommand({
  command: conv1,
  todayISO,
  referenceResolution: null,
  userMessage: 'why is there a row mid week?',
});
ok('conversation executor kind = conversation_delegated',
  convExec.kind === 'conversation_delegated');
ok('conversation executor delegationHint = conversation',
  convExec.delegationHint === 'conversation');
ok('conversation executor empties reply (caller composes via packet)',
  convExec.reply === '');
ok('conversation executor emits no progress ticks',
  convExec.progress.length === 0);

// Clarify executor → options pass through
const clrExec = executeCoachCommand({
  command: clr1,
  todayISO,
  referenceResolution: null,
  userMessage: 'can you make this week easier?',
});
ok('clarify executor passes options through',
  Array.isArray(clrExec.options) && clrExec.options.length >= 2);

// ─── 14. Phase A — add/remove conditioning executor ───────────────
//        Wired through applyAdjustmentEvents + verifyRenderedProgramMutation.
//        Tests inject stubs via input.conditioningDeps so we never touch
//        the live Zustand store from this test harness.

section('14. Phase A — add/remove conditioning via applyAdjustmentEvents');

// Test fixture date: Monday 2026-05-11 — inside the resolved week from
// today=2026-05-08 (Friday) so router-emitted target dates pass.
const ADD_TODAY = '2026-05-08';
const ADD_MONDAY = '2026-05-11';
const ADD_TUESDAY = '2026-05-12';
const ADD_THURSDAY = '2026-05-14';
const ADD_SATURDAY = '2026-05-16';

function stubVerify(addedAfter: boolean): any {
  return () => ({
    requestedDay: ADD_MONDAY,
    todayISO: ADD_TODAY,
    targetDate: ADD_MONDAY,
    targetWorkoutBeforeName: 'Lower Body Strength',
    targetWorkoutAfterName: 'Lower Body Strength',
    beforeHasConditioning: !addedAfter,
    afterHasConditioning: addedAfter,
    overrideKeyWritten: true,
    programTabProjectionHasConditioning: addedAfter,
    dayWorkoutProjectionHasConditioning: addedAfter,
  });
}

function stubApplyOk(eventDate: string): any {
  return (events: any[]) => ({
    applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Lower Body Strength' })),
    rejected: [],
  });
}

function stubApplyReject(reason: string, kind: string): any {
  return (events: any[]) => ({
    applied: [],
    rejected: events.map((e) => ({ kind, date: e.date, reason })),
  });
}

function visibleDay(date: string, sessionName: string, workout: any): any {
  return { date, sessionName, workout };
}

function visibleWorkout(name: string, extras: Record<string, unknown> = {}): any {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      {
        id: `${name}-exercise`,
        exercise: { name, description: name },
      },
    ],
    ...extras,
  };
}

// 14.0 — Underspecified "add conditioning" chooses a real conditioning
// category from visible-week context before the executor writes an event.
const hardConditioningWeek = [
  visibleDay(ADD_MONDAY, 'Upper Push', visibleWorkout('Upper Push + Power Sprints', {
    conditioningCategory: 'sprint',
    conditioningFlavour: 'high-intensity',
    conditioningBlock: {
      options: [{ title: 'Power Sprints', description: '6 x 20s hard.' }],
    },
  })),
  visibleDay(ADD_TUESDAY, 'Lower Hinge', visibleWorkout('Lower Hinge', {
    exercises: [
      { id: 'rdl', exercise: { name: 'Romanian Deadlift', description: 'Lower hinge strength.' } },
    ],
  })),
  visibleDay(ADD_THURSDAY, 'Upper Pull + VO2', visibleWorkout('Upper Pull + VO2', {
    conditioningCategory: 'vo2',
    conditioningFlavour: 'high-intensity',
    conditioningBlock: {
      options: [{ title: '3 x 3min VO2 Intervals', description: '3 x 3min hard.' }],
    },
  })),
  visibleDay(ADD_SATURDAY, 'Glycolytic Intervals', visibleWorkout('Glycolytic Intervals', {
    conditioningCategory: 'glycolytic',
    conditioningFlavour: 'high-intensity',
    conditioningBlock: {
      options: [{ title: 'Glycolytic Intervals', description: '10 x 45s hard / 75s easy.' }],
    },
  })),
];
const hardWeekDecision = chooseBestConditioningAddition(ADD_TUESDAY, hardConditioningWeek, {
  seasonPhase: 'Pre-season',
});
eq('generic add + hard week selects aerobic base',
  hardWeekDecision.kind === 'selection' ? hardWeekDecision.category : hardWeekDecision.kind,
  'aerobic_base' as any);
eq('generic add + hard week title is specific',
  hardWeekDecision.kind === 'selection' ? hardWeekDecision.title : '',
  'Easy Aerobic Flush');

const safeUpperSprintWeek = [
  visibleDay(ADD_MONDAY, 'Zone 2', visibleWorkout('Zone 2', {
    conditioningCategory: 'aerobic_base',
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      options: [{ title: '20min Zone 2', description: '20min zone 2.' }],
    },
  })),
  visibleDay(ADD_TUESDAY, 'Upper Push', visibleWorkout('Upper Push')),
];
const sprintDecision = chooseBestConditioningAddition(ADD_TUESDAY, safeUpperSprintWeek, {
  seasonPhase: 'Off-season',
});
eq('safe upper day missing sprint can select power work',
  sprintDecision.kind === 'selection' ? sprintDecision.category : sprintDecision.kind,
  'sprint' as any);
ok('erg sprint prescription is at least 20 seconds',
  sprintDecision.kind === 'selection' && (sprintDecision.repsMin ?? 0) >= 20,
  JSON.stringify(sprintDecision));

const lowerDayDecision = chooseBestConditioningAddition(ADD_TUESDAY, [
  visibleDay(ADD_MONDAY, 'Zone 2', visibleWorkout('Zone 2', {
    conditioningCategory: 'aerobic_base',
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      options: [{ title: '20min Zone 2', description: '20min zone 2.' }],
    },
  })),
  visibleDay(ADD_TUESDAY, 'Lower Squat', visibleWorkout('Lower Squat')),
], { seasonPhase: 'Off-season' });
eq('lower-body strength day selects aerobic base',
  lowerDayDecision.kind === 'selection' ? lowerDayDecision.category : lowerDayDecision.kind,
  'aerobic_base' as any);
ok('lower-body add names machine-based load control',
  lowerDayDecision.kind === 'selection' &&
    /machine-based conditioning keeps running load down/i.test(lowerDayDecision.notes),
  lowerDayDecision.kind === 'selection' ? lowerDayDecision.notes : JSON.stringify(lowerDayDecision));

const inSeasonNearGameDecision = chooseBestConditioningAddition(ADD_TUESDAY, [
  visibleDay(ADD_TUESDAY, 'Upper Push', visibleWorkout('Upper Push')),
  visibleDay(ADD_THURSDAY, 'Game Day', visibleWorkout('Game Day', {
    workoutType: 'Game',
  })),
], { seasonPhase: 'In-season' });
eq('in-season within 48h of game avoids hard conditioning',
  inSeasonNearGameDecision.kind === 'selection' ? inSeasonNearGameDecision.category : inSeasonNearGameDecision.kind,
  'aerobic_base' as any);

const noContextDecision = chooseBestConditioningAddition(ADD_TUESDAY, [], {});
eq('missing visible context asks conditioning type',
  noContextDecision.kind,
  'clarify' as any);
ok('missing visible context offers easy aerobic / sprint / intervals',
  noContextDecision.kind === 'clarify' &&
    /easy aerobic/i.test(noContextDecision.options.join(' ')) &&
    /sprint/i.test(noContextDecision.options.join(' ')) &&
    /interval/i.test(noContextDecision.options.join(' ')),
  JSON.stringify(noContextDecision));

const fourDayRestDayDecision = chooseBestConditioningAddition('2026-06-07', [
  visibleDay('2026-06-07', 'Rest', null),
  ...hardConditioningWeek,
], { trainingDaysPerWeek: 4, seasonPhase: 'Off-season' });
eq('4-day setup + explicit rest-day add still selects conditioning',
  fourDayRestDayDecision.kind === 'selection' ? fourDayRestDayDecision.category : fourDayRestDayDecision.kind,
  'aerobic_base' as any);

let contextualAddEvents: any[] = [];
const contextualAddCmd = routeCoachCommand({
  userMessage: 'Can you add conditioning to Tuesday',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TUESDAY, 'Lower Hinge'),
  currentWeek: hardConditioningWeek,
});
ok('"add conditioning to Tuesday" → mutate',
  contextualAddCmd.mode === 'mutate');
eq('"add conditioning to Tuesday" classified as add_conditioning',
  asMutate(contextualAddCmd)?.operation,
  'add_conditioning' as any);
const contextualAddExec = executeCoachCommand({
  command: contextualAddCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Can you add conditioning to Tuesday',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      contextualAddEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Lower Hinge' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Lower Hinge',
      targetWorkoutAfterName: 'Lower Hinge',
      beforeHasConditioning: false,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => hardConditioningWeek[1].workout,
    snapshotWeek: () => hardConditioningWeek,
    newEventId: () => 'test-contextual-add-conditioning-evt',
  },
});
eq('"add conditioning to Tuesday" executor kind = mutated',
  contextualAddExec.kind,
  'mutated');
eq('"add conditioning to Tuesday" event title is specific',
  contextualAddEvents[0]?.after?.title,
  'Easy Aerobic Flush');
eq('"add conditioning to Tuesday" event category',
  contextualAddEvents[0]?.after?.conditioningCategory,
  'aerobic_base');
ok('"add conditioning to Tuesday" does not create generic title',
  contextualAddEvents[0]?.after?.title !== 'Conditioning',
  JSON.stringify(contextualAddEvents[0]?.after));
ok('"add conditioning to Tuesday" names machine options',
  /Bike, Rower, SkiErg, or Assault Bike/i.test(contextualAddEvents[0]?.after?.notes ?? ''),
  contextualAddEvents[0]?.after?.notes);

let standaloneConditioningWorkout: any = null;
const restDayWeek = [
  visibleDay('2026-06-07', 'Rest', null),
  ...hardConditioningWeek,
];
const addConditioningTodayNoRefCmd = routeCoachCommand({
  userMessage: 'Can you add some conditioning today?',
  todayISO: '2026-06-07',
  referenceResolution: null,
  currentWeek: restDayWeek,
});
ok('"add conditioning today" with no resolver target → mutate',
  addConditioningTodayNoRefCmd.mode === 'mutate');
eq('"add conditioning today" with no resolver target keeps add_conditioning',
  asMutate(addConditioningTodayNoRefCmd)?.operation,
  'add_conditioning' as any);
eq('"add conditioning today" binds targetDate from message',
  (asMutate(addConditioningTodayNoRefCmd)?.target as any)?.date,
  '2026-06-07');
ok('"add conditioning today" does not ask which day when today is explicit',
  asMutate(addConditioningTodayNoRefCmd)?.needsClarification === false,
  JSON.stringify(addConditioningTodayNoRefCmd));
const addConditioningTodayStaleRefCmd = routeCoachCommand({
  userMessage: 'Can you add some conditioning today?',
  todayISO: '2026-06-07',
  referenceResolution: resolved(ADD_TUESDAY, 'Lower Hinge'),
  currentWeek: restDayWeek,
});
eq('"add conditioning today" explicit today beats stale resolver target',
  (asMutate(addConditioningTodayStaleRefCmd)?.target as any)?.date,
  '2026-06-07');
const addConditioningTodayCmd = routeCoachCommand({
  userMessage: 'Can you add some conditioning today?',
  todayISO: '2026-06-07',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: restDayWeek,
});
ok('"add conditioning today" on rest day → mutate',
  addConditioningTodayCmd.mode === 'mutate');
eq('"add conditioning today" routes through add_conditioning',
  asMutate(addConditioningTodayCmd)?.operation,
  'add_conditioning' as any);
const addConditioningTodayExec = executeCoachCommand({
  command: addConditioningTodayCmd,
  todayISO: '2026-06-07',
  referenceResolution: null,
  userMessage: 'Can you add some conditioning today?',
  conditioningDeps: {
    snapshotBefore: () => null,
    snapshotWeek: () => restDayWeek,
  },
  addSessionDeps: {
    snapshotBefore: () => null,
    snapshotAfter: () => standaloneConditioningWorkout,
    visibleWeek: () => restDayWeek as any,
    readCalendarMark: () => 'rest' as any,
    applyAdd: ({ sourceWorkout }) => {
      standaloneConditioningWorkout = sourceWorkout;
      return { applied: true };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetAdded: !!args.afterWorkout && (args.afterWorkout as any).workoutType === 'Conditioning',
      otherDaysUnchanged: true,
      changedOtherDates: [],
      beforeWorkoutName: args.beforeWorkout?.name ?? null,
      afterWorkoutName: args.afterWorkout?.name ?? null,
    }),
  },
});
eq('"add conditioning today" executor creates standalone session',
  addConditioningTodayExec.kind,
  'mutated');
eq('"add conditioning today" standalone workout type',
  standaloneConditioningWorkout?.workoutType,
  'Conditioning');
eq('"add conditioning today" standalone title is specific',
  standaloneConditioningWorkout?.name,
  'Easy Aerobic Flush');
eq('"add conditioning today" standalone category',
  standaloneConditioningWorkout?.conditioningCategory,
  'aerobic_base');
ok('"add conditioning today" does not create generic Conditioning title',
  standaloneConditioningWorkout?.name !== 'Conditioning',
  JSON.stringify(standaloneConditioningWorkout));
ok('"add conditioning today" reply labels one-off extra',
  /one-off extra session/i.test(addConditioningTodayExec.reply),
  addConditioningTodayExec.reply);

let programEditStandaloneConditioningWorkout: any = null;
const addConditioningTodayProgramEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'Can you add some conditioning today?',
  todayISO: '2026-06-07',
  referenceResolution: null,
  currentWeek: restDayWeek,
});
ok('"add conditioning today" ProgramEdit is not a day clarifier',
  addConditioningTodayProgramEdit.intent !== 'ask_question' &&
    !addConditioningTodayProgramEdit.missingFields.includes('targetDate' as any),
  JSON.stringify(addConditioningTodayProgramEdit));
eq('"add conditioning today" ProgramEdit targetDate',
  (addConditioningTodayProgramEdit as any).targetDate,
  '2026-06-07');
const addConditioningTodayProgramEditExec = executeProgramEdit({
  programEdit: addConditioningTodayProgramEdit,
  todayISO: '2026-06-07',
  referenceResolution: null,
  userMessage: 'Can you add some conditioning today?',
  conditioningDeps: {
    snapshotBefore: () => null,
    snapshotAfter: () => programEditStandaloneConditioningWorkout,
    snapshotWeek: () => restDayWeek,
  },
  addSessionDeps: {
    snapshotBefore: () => null,
    snapshotAfter: () => programEditStandaloneConditioningWorkout,
    visibleWeek: () => restDayWeek as any,
    readCalendarMark: () => 'rest' as any,
    applyAdd: ({ sourceWorkout }) => {
      programEditStandaloneConditioningWorkout = sourceWorkout;
      return { applied: true };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetAdded: !!args.afterWorkout && (args.afterWorkout as any).workoutType === 'Conditioning',
      otherDaysUnchanged: true,
      changedOtherDates: [],
      beforeWorkoutName: args.beforeWorkout?.name ?? null,
      afterWorkoutName: args.afterWorkout?.name ?? null,
    }),
  },
});
eq('"add conditioning today" ProgramEdit executor creates visible session',
  addConditioningTodayProgramEditExec.kind,
  'mutated');
eq('"add conditioning today" ProgramEdit standalone workout type',
  programEditStandaloneConditioningWorkout?.workoutType,
  'Conditioning');
ok('"add conditioning today" ProgramEdit reply is verified Done',
  /^Done\b/.test(addConditioningTodayProgramEditExec.reply) &&
    /one-off extra session/i.test(addConditioningTodayProgramEditExec.reply),
  addConditioningTodayProgramEditExec.reply);

const wantConditioningTodayCmd = routeCoachCommand({
  userMessage: 'I want conditioning today',
  todayISO: '2026-06-07',
  referenceResolution: null,
  currentWeek: restDayWeek,
});
ok('"I want conditioning today" → mutate',
  wantConditioningTodayCmd.mode === 'mutate');
eq('"I want conditioning today" binds today',
  (asMutate(wantConditioningTodayCmd)?.target as any)?.date,
  '2026-06-07');

const addConditioningNoDateCmd = routeCoachCommand({
  userMessage: 'Can you add conditioning?',
  todayISO: '2026-06-07',
  referenceResolution: null,
  currentWeek: restDayWeek,
});
ok('"add conditioning" without date still asks which day',
  asMutate(addConditioningNoDateCmd)?.needsClarification === true,
  JSON.stringify(addConditioningNoDateCmd));

const existingTodayWeek = [
  visibleDay('2026-06-07', 'Upper Pull', visibleWorkout('Upper Pull')),
];
const addConditioningExistingTodayCmd = routeCoachCommand({
  userMessage: 'Can you add conditioning today?',
  todayISO: '2026-06-07',
  referenceResolution: null,
  currentWeek: existingTodayWeek,
});
eq('"add conditioning today" on existing session targets today',
  (asMutate(addConditioningExistingTodayCmd)?.target as any)?.date,
  '2026-06-07');
eq('"add conditioning today" on existing session preserves session name',
  (asMutate(addConditioningExistingTodayCmd)?.target as any)?.sessionName,
  'Upper Pull');

const recurringConditioningTodayCmd = routeCoachCommand({
  userMessage: 'Can you add conditioning today every week?',
  todayISO: '2026-06-07',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: restDayWeek,
});
eq('"add conditioning today every week" detects recurring scope',
  asMutate(recurringConditioningTodayCmd)?.scope,
  'recurring' as any);
const recurringConditioningTodayExec = executeCoachCommand({
  command: recurringConditioningTodayCmd,
  todayISO: '2026-06-07',
  referenceResolution: null,
  userMessage: 'Can you add conditioning today every week?',
  conditioningDeps: {
    snapshotBefore: () => null,
    snapshotWeek: () => restDayWeek,
  },
});
eq('"add conditioning today every week" asks setup scope before mutating',
  recurringConditioningTodayExec.kind,
  'clarify');
ok('"add conditioning today every week" does not one-off mutate',
  recurringConditioningTodayExec.applied === false &&
    /weekly setup|one-off extra/i.test(recurringConditioningTodayExec.reply),
  recurringConditioningTodayExec.reply);

// 14.1 — Router classifies "add conditioning to Monday" as mutate
const addCmd = routeCoachCommand({
  userMessage: 'add a bike session on Monday',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_MONDAY, 'Lower Body Strength'),
});
ok('"add a bike session on Monday" → mutate', addCmd.mode === 'mutate');
ok('add classified as add_conditioning', asMutate(addCmd)?.operation === 'add_conditioning');
ok('add blocks legacy fallback', !canFallbackToLegacy(addCmd));

// 14.1b — "light walk to Friday's session" is a concrete add request,
// not a vague mutation that should ask "What change would you like?"
const addWalkCmd = routeCoachCommand({
  userMessage: 'Can you add a light walk to fridays session?',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
});
ok('"add a light walk to fridays session" → mutate', addWalkCmd.mode === 'mutate');
ok('"light walk" classified as add_conditioning',
  asMutate(addWalkCmd)?.operation === 'add_conditioning');
eq('"fridays session" typo keeps one-off scope',
  asMutate(addWalkCmd)?.scope,
  'one_off' as any);
eq('"light walk" modality captured',
  (asMutate(addWalkCmd)?.payload as any)?.modality,
  'walk');
const addWalkExec = executeCoachCommand({
  command: addWalkCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Can you add a light walk to fridays session?',
  conditioningDeps: {
    applyEvents: stubApplyOk(ADD_TODAY),
    verifyRendered: () => ({
      requestedDay: ADD_TODAY,
      todayISO: ADD_TODAY,
      targetDate: ADD_TODAY,
      targetWorkoutBeforeName: 'Upper Body Strength',
      targetWorkoutAfterName: 'Upper Body Strength',
      beforeHasConditioning: false,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
    }),
    snapshotBefore: () => null,
    newEventId: () => 'test-add-walk-evt',
  },
});
eq('"light walk" executor kind = mutated', addWalkExec.kind, 'mutated');
ok('"light walk" reply says light walk', /light walk/i.test(addWalkExec.reply));

const addLightBikeCmd = routeCoachCommand({
  userMessage: 'Can you add a light bike to fridays session?',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
});
ok('"add a light bike to fridays session" → mutate', addLightBikeCmd.mode === 'mutate');
eq('"light bike" modality captured',
  (asMutate(addLightBikeCmd)?.payload as any)?.modality,
  'bike');
eq('"light bike" custom activity captured',
  (asMutate(addLightBikeCmd)?.payload as any)?.customActivity,
  'Light Bike');
eq('"light bike" intensity captured',
  (asMutate(addLightBikeCmd)?.payload as any)?.intensity,
  'light');

const addSkiErgOntoThatDayCmd = routeCoachCommand({
  userMessage: 'Can you also add a 10 min ski erg onto that day',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
});
ok('"add 10 min ski erg onto that day" → mutate',
  addSkiErgOntoThatDayCmd.mode === 'mutate');
eq('"add 10 min ski erg" classified as add_conditioning',
  asMutate(addSkiErgOntoThatDayCmd)?.operation,
  'add_conditioning' as any);
eq('"add 10 min ski erg" modality captured',
  (asMutate(addSkiErgOntoThatDayCmd)?.payload as any)?.modality,
  'ski');
eq('"add 10 min ski erg" activity captured',
  (asMutate(addSkiErgOntoThatDayCmd)?.payload as any)?.customActivity,
  'Ski Erg');
eq('"add 10 min ski erg" duration captured',
  (asMutate(addSkiErgOntoThatDayCmd)?.payload as any)?.durationMinutes,
  10);
eq('"add 10 min ski erg" target preserved from resolver',
  asMutate(addSkiErgOntoThatDayCmd)?.target,
  { kind: 'date', date: ADD_TODAY, sessionName: 'Upper Body Strength' } as any);

let assaultSprintEvents: any[] = [];
let recordedAssaultSprintMutation: any = null;
const addAssaultSprintCmd = routeCoachCommand({
  userMessage: 'Can you add assault bike sprints to fridays session?',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
});
ok('"add assault bike sprints" → mutate',
  addAssaultSprintCmd.mode === 'mutate');
eq('"assault bike sprints" modality stays bike',
  (asMutate(addAssaultSprintCmd)?.payload as any)?.modality,
  'bike');
eq('"assault bike sprints" captures assault bike label',
  (asMutate(addAssaultSprintCmd)?.payload as any)?.bikeLabel,
  'assault');
eq('"assault bike sprints" captures sprint effort',
  (asMutate(addAssaultSprintCmd)?.payload as any)?.effortKind,
  'sprint');
eq('"assault bike sprints" activity title',
  (asMutate(addAssaultSprintCmd)?.payload as any)?.customActivity,
  'Assault Bike Sprints');
const addAssaultSprintExec = executeCoachCommand({
  command: addAssaultSprintCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Can you add assault bike sprints to fridays session?',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      assaultSprintEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Upper Body Strength' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Upper Body Strength',
      targetWorkoutAfterName: 'Upper Body Strength',
      beforeHasConditioning: false,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => null,
    newEventId: () => 'test-add-assault-sprints-evt',
  },
  undoDeps: {
    recordMutation: (entry: any) => {
      recordedAssaultSprintMutation = entry;
      return {
        ...entry,
        id: 'recorded-assault-sprint',
        timestamp: Date.now(),
        revertedAt: null,
      };
    },
  },
});
eq('"assault bike sprints" executor kind = mutated',
  addAssaultSprintExec.kind,
  'mutated');
ok('"assault bike sprints" reply names assault bike sprints',
  /assault bike sprints/i.test(addAssaultSprintExec.reply),
  addAssaultSprintExec.reply);
eq('"assault bike sprints" event title',
  assaultSprintEvents[0]?.after?.title,
  'Assault Bike Sprints');
eq('"assault bike sprints" uses seconds prescription',
  assaultSprintEvents[0]?.after?.prescriptionType,
  'duration');
eq('"assault bike sprints" reps min seconds',
  assaultSprintEvents[0]?.after?.repsMin,
  20);
eq('"assault bike sprints" reps max seconds',
  assaultSprintEvents[0]?.after?.repsMax,
  30);
ok('"assault bike sprints" does not use 2 min efforts',
  !/(?:x\s*)?2\s*min\s*@/i.test(assaultSprintEvents[0]?.after?.description ?? ''),
  assaultSprintEvents[0]?.after?.description);
eq('"assault bike sprints" records structured touched activity',
  recordedAssaultSprintMutation?.touchedActivities?.[0]?.title,
  'Assault Bike Sprints');
eq('"assault bike sprints" touched activity remembers sprint effort',
  recordedAssaultSprintMutation?.touchedActivities?.[0]?.effortKind,
  'sprint');

const workoutWithAssaultSprints = {
  id: 'upper-with-sprints',
  name: 'Upper Body Strength',
  workoutType: 'Strength',
  sessionTier: 'core',
  hasCombinedConditioning: true,
  conditioningFlavour: 'high-intensity',
  conditioningBlock: {
    intent: 'high-intensity',
    options: [{
      title: 'Assault Bike Sprints',
      description: '6 x 20-30s on the assault bike, full recovery.',
      exerciseIds: ['assault-sprint-row'],
    }],
  },
  exercises: [
    {
      id: 'assault-sprint-row',
      prescribedSets: 6,
      prescribedRepsMin: 20,
      prescribedRepsMax: 30,
      prescriptionType: 'duration',
      restSeconds: 120,
      notes: '6 x 20-30s assault bike sprints. Full recovery.',
      exercise: {
        name: 'Assault Bike Sprints',
        description: '6 x 20-30s on the assault bike.',
      },
    },
  ],
} as any;
let shortenSprintEvents: any[] = [];
const shortenSprintCmd = routeCoachCommand({
  userMessage: 'Thanks - maybe just make them a little bit shorter please?',
  todayISO: ADD_TODAY,
  referenceResolution: null,
  currentWeek: [
    {
      date: ADD_TODAY,
      sessionName: 'Upper Body Strength',
      workout: workoutWithAssaultSprints,
    },
  ],
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: ADD_TODAY, sessionName: 'Upper Body Strength' },
    appliedAt: Date.now(),
    userMessage: 'Can you add some assault bike sprints to Tuesday',
    appliedReply: `Done. I added assault bike sprints to Tue ${ADD_TODAY}.`,
  },
});
ok('"make them shorter" after assault sprint add → mutate',
  shortenSprintCmd.mode === 'mutate');
ok('"make them shorter" routes as add/update conditioning',
  asMutate(shortenSprintCmd)?.operation === 'add_conditioning');
eq('"make them shorter" keeps assault bike sprint activity',
  (asMutate(shortenSprintCmd)?.payload as any)?.customActivity,
  'Assault Bike Sprints');
eq('"make them shorter" preserves assault bike label',
  (asMutate(shortenSprintCmd)?.payload as any)?.bikeLabel,
  'assault');
eq('"make them shorter" preserves sprint effort',
  (asMutate(shortenSprintCmd)?.payload as any)?.effortKind,
  'sprint');
eq('"make them shorter" lowers sprint min seconds',
  (asMutate(shortenSprintCmd)?.payload as any)?.repsMin,
  15);
eq('"make them shorter" lowers sprint max seconds',
  (asMutate(shortenSprintCmd)?.payload as any)?.repsMax,
  20);
const shortenSprintExec = executeCoachCommand({
  command: shortenSprintCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Thanks - maybe just make them a little bit shorter please?',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      shortenSprintEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Upper Body Strength' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Upper Body Strength',
      targetWorkoutAfterName: 'Upper Body Strength',
      beforeHasConditioning: true,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => workoutWithAssaultSprints,
    newEventId: () => 'test-shorten-assault-sprints-evt',
  },
});
eq('"make them shorter" executor kind=mutated',
  shortenSprintExec.kind,
  'mutated');
ok('"make them shorter" reply confirms seconds',
  /assault bike sprints/i.test(shortenSprintExec.reply) && /15-20\s*sec/i.test(shortenSprintExec.reply),
  shortenSprintExec.reply);
eq('"make them shorter" event reps min seconds',
  shortenSprintEvents[0]?.after?.repsMin,
  15);
eq('"make them shorter" event reps max seconds',
  shortenSprintEvents[0]?.after?.repsMax,
  20);

const ambiguousSprintMinuteCmd = routeCoachCommand({
  userMessage: 'Nah just make it 30 mins',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
  currentWeek: [
    {
      date: ADD_TODAY,
      sessionName: 'Upper Body Strength',
      workout: workoutWithAssaultSprints,
    },
  ],
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: ADD_TODAY, sessionName: 'Upper Body Strength' },
    appliedAt: Date.now(),
    userMessage: 'Actually make it assault bike sprints',
    appliedReply: `Done. I replaced the conditioning with assault bike sprints on Tue ${ADD_TODAY}.`,
    touchedActivities: [{
      kind: 'conditioning',
      date: ADD_TODAY,
      sessionName: 'Upper Body Strength',
      title: 'Assault Bike Sprints',
      modality: 'bike',
      intensity: 'hard',
      sets: 6,
      repsMin: 20,
      repsMax: 30,
      restSeconds: 120,
      prescriptionType: 'duration',
      bikeLabel: 'assault',
      effortKind: 'sprint',
      trainingIntent: 'sprint',
    } as any],
  },
});
ok('"30 mins" after assault sprint replacement asks before mutating',
  ambiguousSprintMinuteCmd.mode === 'mutate' &&
    asMutate(ambiguousSprintMinuteCmd)?.needsClarification === true);
eq('"30 mins" sprint ambiguity reason',
  asMutate(ambiguousSprintMinuteCmd)?.reason,
  'last_add_sprint_minute_duration_ambiguous' as any);
eq('"30 mins" sprint ambiguity carries the proposed whole-session minutes',
  (asMutate(ambiguousSprintMinuteCmd)?.payload as any)?.durationMinutes,
  30);
ok('"30 mins" sprint ambiguity does not rewrite sprint reps before clarification',
  (asMutate(ambiguousSprintMinuteCmd)?.payload as any)?.repsMin == null &&
    (asMutate(ambiguousSprintMinuteCmd)?.payload as any)?.repsMax == null,
  JSON.stringify(asMutate(ambiguousSprintMinuteCmd)?.payload));
ok('"30 mins" sprint ambiguity asks which duration slot',
  /whole .*session/i.test(asMutate(ambiguousSprintMinuteCmd)?.clarificationQuestion ?? '') &&
    /sprint efforts/i.test(asMutate(ambiguousSprintMinuteCmd)?.clarificationQuestion ?? '') &&
    /recovery between reps/i.test(asMutate(ambiguousSprintMinuteCmd)?.clarificationQuestion ?? ''),
  asMutate(ambiguousSprintMinuteCmd)?.clarificationQuestion);
ok('"30 mins" sprint ambiguity still blocks legacy fallback',
  !canFallbackToLegacy(ambiguousSprintMinuteCmd));

const addPilatesCmd = routeCoachCommand({
  userMessage: 'Can you add pilates to fridays session?',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
});
ok('"add pilates to fridays session" → mutate', addPilatesCmd.mode === 'mutate');
ok('"pilates" classified as add_conditioning',
  asMutate(addPilatesCmd)?.operation === 'add_conditioning');
eq('"pilates" custom activity captured',
  (asMutate(addPilatesCmd)?.payload as any)?.customActivity,
  'Pilates');
eq('"pilates" keeps one-off scope',
  asMutate(addPilatesCmd)?.scope,
  'one_off' as any);
const addPilatesExec = executeCoachCommand({
  command: addPilatesCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Can you add pilates to fridays session?',
  conditioningDeps: {
    applyEvents: stubApplyOk(ADD_TODAY),
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Recovery Session',
      targetWorkoutAfterName: 'Recovery Session',
      beforeHasConditioning: false,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: false,
      dayWorkoutProjectionHasConditioning: false,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: false,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => null,
    newEventId: () => 'test-add-pilates-evt',
  },
});
eq('"pilates" visible only in day view still mutates', addPilatesExec.kind, 'mutated');
ok('"pilates" day-view success reply says Pilates', /pilates/i.test(addPilatesExec.reply));
ok('"pilates" day-view success does not claim invisible failure',
  !/didn'?t show up|couldn'?t verify|apply layer/i.test(addPilatesExec.reply));

const recoveryWithPilates = {
  id: 'recovery-wed',
  name: 'Recovery Session',
  workoutType: 'Recovery',
  sessionTier: 'recovery',
  hasCombinedConditioning: true,
  conditioningFlavour: 'aerobic',
  conditioningBlock: {
    intent: 'aerobic',
    options: [{ title: 'Pilates', description: '20 min Pilates', exerciseIds: ['pilates-row'] }],
  },
  exercises: [
    {
      id: 'pilates-row',
      notes: '20 min Pilates. Controlled, low-load work only.',
      exercise: { name: 'Pilates', description: '20 min Pilates' },
    },
  ],
} as any;
ok('recovery-session add-on counts as visible in day workout',
  dayWorkoutShowsConditioningAfterStrength(recoveryWithPilates));
ok('expected activity matcher sees Pilates in recovery session',
  workoutShowsExpectedActivity(recoveryWithPilates, 'Pilates'));

let namedDurationEvents: any[] = [];
const namedDurationCmd = routeCoachCommand({
  userMessage: 'Can you make the Pilates longer?',
  todayISO: ADD_TODAY,
  referenceResolution: null,
  currentWeek: [
    {
      date: ADD_TODAY,
      sessionName: 'Recovery Session',
      workout: recoveryWithPilates,
    },
  ],
});
ok('"make the Pilates longer" fresh chat → mutate',
  namedDurationCmd.mode === 'mutate');
ok('"make the Pilates longer" routes as add/update conditioning',
  asMutate(namedDurationCmd)?.operation === 'add_conditioning');
eq('"make the Pilates longer" targets visible Pilates date',
  asMutate(namedDurationCmd)?.target,
  { kind: 'date', date: ADD_TODAY, sessionName: 'Recovery Session' } as any);
eq('"make the Pilates longer" infers +5 min',
  (asMutate(namedDurationCmd)?.payload as any)?.durationMinutes,
  25);
eq('"make the Pilates longer" keeps Pilates activity',
  (asMutate(namedDurationCmd)?.payload as any)?.customActivity,
  'Pilates');
const namedDurationExec = executeCoachCommand({
  command: namedDurationCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Can you make the Pilates longer?',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      namedDurationEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Recovery Session' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Recovery Session',
      targetWorkoutAfterName: 'Recovery Session',
      beforeHasConditioning: true,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: false,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: false,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => recoveryWithPilates,
    newEventId: () => 'test-named-duration-evt',
  },
});
eq('"make the Pilates longer" executor kind=mutated',
  namedDurationExec.kind,
  'mutated');
ok('"make the Pilates longer" reply confirms 25 min Pilates',
  /pilates/i.test(namedDurationExec.reply) && /25\s*min/i.test(namedDurationExec.reply),
  namedDurationExec.reply);
eq('"make the Pilates longer" event minutes=25',
  namedDurationEvents[0]?.after?.minutes,
  25);

let durationCorrectionEvents: any[] = [];
const durationCorrectionCmd = routeCoachCommand({
  userMessage: 'Sorry a bit more than 20 min',
  todayISO: ADD_TODAY,
  referenceResolution: null,
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: ADD_TODAY, sessionName: 'Recovery Session' },
    appliedAt: Date.now(),
    userMessage: 'Can you add some Pilates into today',
    appliedReply: `Done. I added Pilates to Fri ${ADD_TODAY}.`,
  },
});
ok('"bit more than 20 min" after Pilates add → mutate',
  durationCorrectionCmd.mode === 'mutate');
ok('"bit more than 20 min" routes as add/update conditioning',
  asMutate(durationCorrectionCmd)?.operation === 'add_conditioning');
eq('"bit more than 20 min" infers 25 min',
  (asMutate(durationCorrectionCmd)?.payload as any)?.durationMinutes,
  25);
eq('"bit more than 20 min" keeps Pilates activity',
  (asMutate(durationCorrectionCmd)?.payload as any)?.customActivity,
  'Pilates');
const exactDurationCorrectionCmd = routeCoachCommand({
  userMessage: 'Can you make it 30 mins?',
  todayISO: ADD_TODAY,
  referenceResolution: null,
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: ADD_TODAY, sessionName: 'Recovery Session' },
    appliedAt: Date.now(),
    userMessage: 'Can you add some Pilates into today',
    appliedReply: `Done. I added Pilates to Fri ${ADD_TODAY}.`,
  },
});
ok('"make it 30 mins" after Pilates add → mutate',
  exactDurationCorrectionCmd.mode === 'mutate');
ok('"make it 30 mins" routes as add/update conditioning',
  asMutate(exactDurationCorrectionCmd)?.operation === 'add_conditioning');
eq('"make it 30 mins" infers exact 30 min',
  (asMutate(exactDurationCorrectionCmd)?.payload as any)?.durationMinutes,
  30);
eq('"make it 30 mins" keeps Pilates activity',
  (asMutate(exactDurationCorrectionCmd)?.payload as any)?.customActivity,
  'Pilates');
const replacePilatesCmd = routeCoachCommand({
  userMessage: 'Actually I want some hard hill running instead of Pilates today',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Recovery Session'),
  currentWeek: [
    {
      date: ADD_TODAY,
      sessionName: 'Recovery Session',
      workout: recoveryWithPilates,
    },
  ],
});
ok('"hard hill running instead of Pilates" → mutate',
  replacePilatesCmd.mode === 'mutate');
ok('"hard hill running instead of Pilates" routes as add/update conditioning',
  asMutate(replacePilatesCmd)?.operation === 'add_conditioning');
eq('"hard hill running instead of Pilates" captures new activity',
  (asMutate(replacePilatesCmd)?.payload as any)?.customActivity,
  'Hard Hill Running');
eq('"hard hill running instead of Pilates" captures replaced activity',
  (asMutate(replacePilatesCmd)?.payload as any)?.replaceActivity,
  'Pilates');
eq('"hard hill running instead of Pilates" captures hard intensity',
  (asMutate(replacePilatesCmd)?.payload as any)?.intensity,
  'hard');
let replacePilatesEvents: any[] = [];
const replacePilatesExec = executeCoachCommand({
  command: replacePilatesCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Actually I want some hard hill running instead of Pilates today',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      replacePilatesEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Recovery Session' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Recovery Session',
      targetWorkoutAfterName: 'Recovery Session',
      beforeHasConditioning: true,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => recoveryWithPilates,
    newEventId: () => 'test-replace-pilates-evt',
  },
});
eq('"hard hill running instead of Pilates" executor kind=mutated',
  replacePilatesExec.kind,
  'mutated');
ok('"hard hill running instead of Pilates" reply confirms swap',
  /swapped pilates for hard hill running/i.test(replacePilatesExec.reply),
  replacePilatesExec.reply);
eq('"hard hill running instead of Pilates" event title',
  replacePilatesEvents[0]?.after?.title,
  'Hard Hill Running');
eq('"hard hill running instead of Pilates" event replacement marker',
  replacePilatesEvents[0]?.after?.replaceActivity,
  'Pilates');
ok('"hard hill running instead of Pilates" avoids 2 min efforts',
  !/2\s*min/i.test(String(replacePilatesEvents[0]?.after?.description ?? '')),
  String(replacePilatesEvents[0]?.after?.description ?? ''));
const replacePilatesTrailCmd = routeCoachCommand({
  userMessage: 'Actually I want a hard trail run instead of Pilates today',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Recovery Session'),
  currentWeek: [
    {
      date: ADD_TODAY,
      sessionName: 'Recovery Session',
      workout: recoveryWithPilates,
    },
  ],
});
ok('"hard trail run instead of Pilates" → mutate',
  replacePilatesTrailCmd.mode === 'mutate');
eq('"hard trail run instead of Pilates" preserves descriptive activity',
  (asMutate(replacePilatesTrailCmd)?.payload as any)?.customActivity,
  'Hard Trail Run');
let replacePilatesTrailEvents: any[] = [];
const replacePilatesTrailExec = executeCoachCommand({
  command: replacePilatesTrailCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Actually I want a hard trail run instead of Pilates today',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      replacePilatesTrailEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Recovery Session' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Recovery Session',
      targetWorkoutAfterName: 'Recovery Session',
      beforeHasConditioning: true,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => recoveryWithPilates,
    newEventId: () => 'test-replace-pilates-trail-evt',
  },
});
eq('"hard trail run instead of Pilates" executor kind=mutated',
  replacePilatesTrailExec.kind,
  'mutated');
eq('"hard trail run instead of Pilates" event title',
  replacePilatesTrailEvents[0]?.after?.title,
  'Hard Trail Run');
ok('"hard trail run instead of Pilates" avoids generic 2 min aerobic intervals',
  !/2\s*min|75-80%/i.test(String(replacePilatesTrailEvents[0]?.after?.description ?? '')),
  String(replacePilatesTrailEvents[0]?.after?.description ?? ''));
const durationCorrectionExec = executeCoachCommand({
  command: durationCorrectionCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'Sorry a bit more than 20 min',
  conditioningDeps: {
    applyEvents: (events: any[]) => {
      durationCorrectionEvents = events;
      return {
        applied: events.map((e) => ({ date: e.date, eventIds: [e.id], workoutName: 'Recovery Session' })),
        rejected: [],
      };
    },
    verifyRendered: (args) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Recovery Session',
      targetWorkoutAfterName: 'Recovery Session',
      beforeHasConditioning: true,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: false,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle ?? null,
      programTabProjectionHasExpectedActivity: false,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    snapshotBefore: () => recoveryWithPilates,
    newEventId: () => 'test-duration-correction-evt',
  },
});
eq('"bit more than 20 min" executor kind=mutated',
  durationCorrectionExec.kind,
  'mutated');
ok('"bit more than 20 min" reply confirms 25 min Pilates',
  /pilates/i.test(durationCorrectionExec.reply) && /25\s*min/i.test(durationCorrectionExec.reply),
  durationCorrectionExec.reply);
eq('"bit more than 20 min" event minutes=25',
  durationCorrectionEvents[0]?.after?.minutes,
  25);

const vagueAddCmd = routeCoachCommand({
  userMessage: 'Can you add something light to fridays session?',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_TODAY, 'Upper Body Strength'),
});
eq('"add something light" asks a targeted clarifier',
  vagueAddCmd.mode,
  'clarify' as any);
ok('"add something light" asks what to add',
  vagueAddCmd.mode === 'clarify' && /what should i add/i.test(vagueAddCmd.question));
ok('"add something light" offers concrete add-on options',
  vagueAddCmd.mode === 'clarify' &&
    (vagueAddCmd.options ?? []).some((o) => /light bike/i.test(o)) &&
    (vagueAddCmd.options ?? []).some((o) => /pilates/i.test(o)));

// 14.2 — Executor with stubs verifies dual surface + emits coach-style confirmation.
const addStages: string[] = [];
const addExec = executeCoachCommand({
  command: addCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'add a bike session on Monday',
  onProgress: (s) => addStages.push(s),
  conditioningDeps: {
    applyEvents: stubApplyOk(ADD_MONDAY),
    verifyRendered: stubVerify(true),
    snapshotBefore: () => visibleWorkout('Lower Body Strength'),
    newEventId: () => 'test-add-evt',
  },
});
eq('add executor kind = mutated', addExec.kind, 'mutated');
ok('add executor applied = true', addExec.applied === true);
ok('add executor reply starts with coach confirmation', /^Yeah, no worries\./.test(addExec.reply));
ok('add executor reply names the date', addExec.reply.includes(ADD_MONDAY));
ok('add executor route = add_conditioning:applied', addExec.route === 'add_conditioning:applied');
eq('add executor progress order',
  addStages,
  ['checking_program', 'applying_change', 'verifying_update', 'composing_reply']);

// 14.3 — Router classifies "remove conditioning from Monday" as mutate
const remCmd = routeCoachCommand({
  userMessage: 'remove conditioning from Monday',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_MONDAY, 'Lower Body Strength'),
});
ok('"remove conditioning from Monday" → mutate', remCmd.mode === 'mutate');
ok('remove classified as remove_conditioning',
  asMutate(remCmd)?.operation === 'remove_conditioning');
ok('remove blocks legacy fallback', !canFallbackToLegacy(remCmd));

// 14.4 — Remove with successful apply + verified absence → "Done."
const remStages: string[] = [];
const remExec = executeCoachCommand({
  command: remCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'remove conditioning from Monday',
  onProgress: (s) => remStages.push(s),
  conditioningDeps: {
    applyEvents: stubApplyOk(ADD_MONDAY),
    verifyRendered: stubVerify(false), // afterHasConditioning = false
    snapshotBefore: () => null,
    newEventId: () => 'test-rem-evt',
  },
});
eq('remove executor kind = mutated', remExec.kind, 'mutated');
ok('remove executor applied = true', remExec.applied === true);
ok('remove executor reply starts with "Done"', /^Done\b/.test(remExec.reply));
ok('remove executor reply mentions "removed"',
  /remove/i.test(remExec.reply));

// 14.5 — "actually remove that conditioning" with bound reference → mutate
const actuallyRem = routeCoachCommand({
  userMessage: 'actually remove that conditioning',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_MONDAY, 'Lower Body Strength'),
});
ok('"actually remove that conditioning" → mutate', actuallyRem.mode === 'mutate');
ok('"actually remove" is remove_conditioning',
  asMutate(actuallyRem)?.operation === 'remove_conditioning');
ok('"actually remove" blocks legacy', !canFallbackToLegacy(actuallyRem));

// 14.6 — Command priority: fatigue/readiness context must not steal
//        explicit remove/edit targets.
const cookedRemoveSession = routeCoachCommand({
  userMessage: 'My legs are cooked, can you actually remove the Wednesday session fully?',
  todayISO: TODAY,
  referenceResolution: resolved(PAST_WED, 'Lower Strength'),
});
ok('cooked + remove Wednesday session → mutate',
  cookedRemoveSession.mode === 'mutate');
ok('cooked + remove Wednesday session → remove_session',
  asMutate(cookedRemoveSession)?.operation === 'remove_session');
ok('cooked + remove Wednesday session blocks legacy',
  !canFallbackToLegacy(cookedRemoveSession));

const cookedDitchWednesday = routeCoachCommand({
  userMessage: 'legs cooked, ditch Wednesday',
  todayISO: TODAY,
  referenceResolution: resolved(PAST_WED, 'Lower Strength'),
});
ok('cooked + ditch Wednesday → remove_session',
  asMutate(cookedDitchWednesday)?.operation === 'remove_session');

const soreRemoveRower = routeCoachCommand({
  userMessage: 'I’m sore, remove the rower on Wednesday',
  todayISO: TODAY,
  referenceResolution: resolved(PAST_WED, 'Lower Strength'),
});
ok('sore + remove rower → remove_conditioning item path',
  asMutate(soreRemoveRower)?.operation === 'remove_conditioning');

const cookedOnlyRouter = routeCoachCommand({
  userMessage: 'legs cooked',
  todayISO: TODAY,
  referenceResolution: resolved(TODAY, 'Gunshow'),
});
eq('bare fatigue asks clarification',
  cookedOnlyRouter.mode,
  'clarify' as any);
ok('bare fatigue blocks legacy',
  !canFallbackToLegacy(cookedOnlyRouter));

const makeTodayEasierRouter = routeCoachCommand({
  userMessage: 'can we make today easier?',
  todayISO: TODAY,
  referenceResolution: resolved(TODAY, 'Gunshow'),
});
eq('make today easier asks reduce clarification',
  makeTodayEasierRouter.mode,
  'clarify' as any);

const cookedRecoveryOnly = routeCoachCommand({
  userMessage: 'Feeling cooked, make Thursday recovery only',
  todayISO: TODAY,
  referenceResolution: resolved('2026-05-14', 'Conditioning'),
  currentWeek: [{
    date: '2026-05-14',
    sessionName: 'Conditioning',
    workout: {
      name: 'Conditioning',
      conditioningBlock: { options: [{ title: 'Bike Flush', exerciseIds: ['bike'] }] },
      exercises: [{ id: 'bike', exercise: { name: 'Bike Flush' } }],
    },
  }],
});
ok('cooked + explicit recovery replacement does not become vague clarify',
  cookedRecoveryOnly.mode === 'mutate',
  `mode=${cookedRecoveryOnly.mode}, reason=${'reason' in cookedRecoveryOnly ? cookedRecoveryOnly.reason : 'n/a'}`);

// 14.6 — "add it to this session" with lastOpenedWorkout-bound reference
//         (resolver already bound to a date — we simulate that via
//         resolved(ADD_MONDAY, 'Lower Body Strength')).
const addItCmd = routeCoachCommand({
  userMessage: 'add a bike to it',
  todayISO: ADD_TODAY,
  referenceResolution: resolved(ADD_MONDAY, 'Lower Body Strength'),
  lastOpenedWorkout: { date: ADD_MONDAY, sessionName: 'Lower Body Strength' },
});
ok('"add a bike to it" with lastOpened → mutate', addItCmd.mode === 'mutate');
ok('"add a bike to it" → add_conditioning',
  asMutate(addItCmd)?.operation === 'add_conditioning');
const addItExec = executeCoachCommand({
  command: addItCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'add a bike to it',
  conditioningDeps: {
    applyEvents: stubApplyOk(ADD_MONDAY),
    verifyRendered: stubVerify(true),
    snapshotBefore: () => null,
    newEventId: () => 'test-addit-evt',
  },
});
eq('"add a bike to it" executor kind = mutated', addItExec.kind, 'mutated');
ok('"add a bike to it" reply names target date',
  addItExec.reply.includes(ADD_MONDAY));

// 14.7 — Ambiguous add (no target) → router emits clarify
const ambAdd = routeCoachCommand({
  userMessage: 'add a bike',
  todayISO: ADD_TODAY,
  referenceResolution: null,
});
ok('"add a bike" no target → mutate w/ needsClarification or clarify',
  (ambAdd.mode === 'mutate' && asMutate(ambAdd)?.needsClarification === true) ||
  ambAdd.mode === 'clarify');
const ambAddExec = executeCoachCommand({
  command: ambAdd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'add a bike',
  conditioningDeps: {
    applyEvents: () => { throw new Error('apply must NOT be called for ambiguous'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for ambiguous'); },
  },
});
eq('"add a bike" executor kind = clarify', ambAddExec.kind, 'clarify');
ok('"add a bike" reply asks which day',
  /which|day|session/i.test(ambAddExec.reply));

// 14.8 — Ambiguous remove → clarify, no engine call
const ambRem = routeCoachCommand({
  userMessage: 'remove conditioning',
  todayISO: ADD_TODAY,
  referenceResolution: null,
});
ok('"remove conditioning" no target → mutate w/ needsClarification or clarify',
  (ambRem.mode === 'mutate' && asMutate(ambRem)?.needsClarification === true) ||
  ambRem.mode === 'clarify');
const ambRemExec = executeCoachCommand({
  command: ambRem,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'remove conditioning',
  conditioningDeps: {
    applyEvents: () => { throw new Error('apply must NOT be called for ambiguous'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for ambiguous'); },
  },
});
eq('"remove conditioning" executor kind = clarify', ambRemExec.kind, 'clarify');

// 14.9 — Apply succeeds but verification shows no change → verified_no_op
const ghostAdd = executeCoachCommand({
  command: addCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'add a bike session on Monday',
  conditioningDeps: {
    applyEvents: stubApplyOk(ADD_MONDAY),
    verifyRendered: stubVerify(false), // we asked to ADD, but verify says NO conditioning
    snapshotBefore: () => visibleWorkout('Lower Body Strength'),
    newEventId: () => 'test-ghost-evt',
  },
});
eq('add applied but unverified → verified_no_op',
  ghostAdd.kind, 'verified_no_op');
ok('ghost-add applied = false', ghostAdd.applied === false);
ok('ghost-add reply does NOT start with "Done"',
  !/^Done\b/.test(ghostAdd.reply));
ok('ghost-add reply names the visible-surface failure',
  /didn'?t show up|visible|edit/i.test(ghostAdd.reply));

// 14.10 — applyEvents rejects (e.g. NO_CONDITIONING_TO_SWAP) → honest reply
const noBlockRem = executeCoachCommand({
  command: remCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'remove conditioning from Monday',
  conditioningDeps: {
    applyEvents: stubApplyReject('no conditioning block to remove on 2026-05-11', 'no_conditioning_to_swap'),
    verifyRendered: stubVerify(false),
    snapshotBefore: () => null,
    newEventId: () => 'test-noblock-evt',
  },
});
eq('engine rejection → verified_no_op', noBlockRem.kind, 'verified_no_op');
ok('rejection reply names the missing block',
  /no conditioning block|nothing to remove/i.test(noBlockRem.reply));
ok('rejection applied = false', noBlockRem.applied === false);

// 14.11 — Past-date rejection → honest reply
const pastDateRem = executeCoachCommand({
  command: remCmd,
  todayISO: ADD_TODAY,
  referenceResolution: null,
  userMessage: 'remove conditioning from Monday',
  conditioningDeps: {
    applyEvents: stubApplyReject('cannot apply event on past date', 'past_date_blocked'),
    verifyRendered: stubVerify(false),
    snapshotBefore: () => null,
    newEventId: () => 'test-past-evt',
  },
});
eq('past-date → verified_no_op', pastDateRem.kind, 'verified_no_op');
ok('past-date reply mentions "past"', /past/i.test(pastDateRem.reply));

// 14.12 — Add reply names modality when present
ok('add reply names "bike" modality',
  /bike/i.test(addExec.reply),
  addExec.reply);

// 14.13 — Architecture: legacy fallback never opens for any conditioning
//         mutate command. Belt-and-braces guard.
for (const c of [addCmd, remCmd, actuallyRem, addItCmd]) {
  ok(`canFallbackToLegacy(${c.mode}/${asMutate(c)?.operation ?? 'n/a'}) === false`,
    !canFallbackToLegacy(c));
}

// ─── 15. Phase B — deterministic replace_exercise via applyAdjustmentEvents ───
//        Wired through applyAdjustmentEvents + verifyRenderedExerciseSwap.
//        Tests inject stubs via input.replaceExerciseDeps so we never
//        touch the live Zustand store from this test harness.

section('15. Phase B — deterministic replace_exercise');

const REP_TODAY = '2026-05-08';
const REP_MONDAY = '2026-05-11';

// Build a fake workout shaped like the resolver's output. The verifier
// in real life walks workout.exercises[].exercise.name; the executor's
// snapshot helper reads the same shape.
function fakeWorkout(exerciseNames: string[]): any {
  return {
    id: 'wk-test',
    name: 'Lower Body Strength',
    exercises: exerciseNames.map((n, i) => ({
      id: `ex-${i}`,
      exercise: { id: `tag-${i}`, name: n },
    })),
  };
}

// ── Real-store seam for the replace_exercise WRITE tests. ─────────────
// The write is now owned by replaceExerciseAtDate (the tap-door owner), which
// reads the live store via resolveDateWithConditioning and writes through
// setManualOverride. These helpers seed a real fixture the owner resolves and
// capture the override it writes — the same module-stub pattern coachActionsTests
// uses. The seam is INERT unless a fixture is set, so the DI-based tests
// elsewhere in this file are untouched.
let swapOverrideCalls: Array<{ date: string; workout: Workout }> = [];
let swapFixtureByDate: Record<string, Workout> = {};
function swapSeamActive(): boolean {
  return Object.keys(swapFixtureByDate).length > 0;
}
const _origGetState = (useProgramStore as any).getState;
const _origResolveDate = (sessionResolver as any).resolveDateWithConditioning;
(useProgramStore as any).getState = () => {
  const real = _origGetState();
  if (!swapSeamActive()) return real;
  return {
    ...real,
    setManualOverride: (date: string, workout: Workout) => {
      swapOverrideCalls.push({ date, workout });
    },
  };
};
(sessionResolver as any).resolveDateWithConditioning = (date: string, ...rest: any[]) => {
  if (swapSeamActive() && swapFixtureByDate[date]) {
    return { date, workout: swapFixtureByDate[date] };
  }
  return _origResolveDate(date, ...rest);
};
function swapExercise(name: string): WorkoutExercise {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id, workoutId: '', exerciseId: id, exerciseOrder: 0,
    prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: { id, name } as WorkoutExercise['exercise'],
  } as WorkoutExercise;
}
function seedSwapFixture(date: string, exerciseNames: string[]): void {
  swapFixtureByDate = {
    [date]: {
      id: 'wk-swap', name: 'Lower Body Strength', workoutType: 'Strength',
      exercises: exerciseNames.map(swapExercise),
    } as unknown as Workout,
  };
  swapOverrideCalls = [];
}
function clearSwapFixture(): void {
  swapFixtureByDate = {};
  swapOverrideCalls = [];
}

// 15.1 — "swap bench press for dumbbell bench" → resolves to Bench Press → DB Bench Press
const swap1Cmd = routeCoachCommand({
  userMessage: 'swap bench press for dumbbell bench',
  todayISO: REP_TODAY,
  referenceResolution: resolved(REP_MONDAY, 'Upper Body Strength'),
});
ok('"swap bench press for dumbbell bench" → mutate', swap1Cmd.mode === 'mutate');
ok('classified as replace_exercise', asMutate(swap1Cmd)?.operation === 'replace_exercise');
ok('legacy blocked', !canFallbackToLegacy(swap1Cmd));

// Migrated to the real owner: seed the fixture the owner resolves, drop the
// retired AdjustmentEvent apply/verify stubs, and trust the owner's result (as
// the tap door does — no separate name-only verifier). The write is asserted
// via the captured setManualOverride.
const swap1Stages: string[] = [];
seedSwapFixture(REP_MONDAY, ['Bench Press', 'Pull-Ups']);
const swap1Exec = executeCoachCommand({
  command: swap1Cmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'swap bench press for dumbbell bench',
  onProgress: (s) => swap1Stages.push(s),
  replaceExerciseDeps: {
    snapshotBefore: () => fakeWorkout(['Bench Press', 'Pull-Ups']),
  },
});
eq('"swap bench press for dumbbell bench" → mutated', swap1Exec.kind, 'mutated');
ok('swap1 applied = true', swap1Exec.applied === true);
ok('swap1 reply starts with "Done"', /^Done\b/.test(swap1Exec.reply));
ok('swap1 reply mentions canonical source name (Bench Press)', /Bench Press/.test(swap1Exec.reply));
ok('swap1 reply mentions canonical target name (DB Bench Press)', /DB Bench Press/.test(swap1Exec.reply));
ok('swap1 reply mentions date', swap1Exec.reply.includes(REP_MONDAY));
// Progress order no longer includes the retired verify stage.
eq('swap1 progress order',
  swap1Stages,
  ['checking_program', 'applying_change', 'composing_reply']);
ok('swap1 route = replace_exercise:applied', swap1Exec.route === 'replace_exercise:applied');
ok('swap1 wrote exactly one override on the target date',
  swapOverrideCalls.length === 1 && swapOverrideCalls[0].date === REP_MONDAY,
  `overrides=${JSON.stringify(swapOverrideCalls.map((c) => c.date))}`);
clearSwapFixture();

// 15.2 — "replace back squat with trap bar deadlift"
const swap2Cmd = routeCoachCommand({
  userMessage: 'replace back squat with trap bar deadlift',
  todayISO: REP_TODAY,
  referenceResolution: resolved(REP_MONDAY, 'Lower Body Strength'),
});
ok('"replace back squat with trap bar deadlift" → mutate', swap2Cmd.mode === 'mutate');
ok('replace classified as replace_exercise', asMutate(swap2Cmd)?.operation === 'replace_exercise');

seedSwapFixture(REP_MONDAY, ['Back Squat', 'Walking Lunges']);
const swap2Exec = executeCoachCommand({
  command: swap2Cmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'replace back squat with trap bar deadlift',
  replaceExerciseDeps: {
    snapshotBefore: () => fakeWorkout(['Back Squat', 'Walking Lunges']),
  },
});
eq('"replace back squat with trap bar deadlift" → mutated', swap2Exec.kind, 'mutated');
ok('swap2 reply names Trap Bar Deadlift',
  /Trap Bar Deadlift/.test(swap2Exec.reply));
clearSwapFixture();

// 15.3 — "I don't have a cable machine, swap cable rows" → source-only → clarify w/ siblings
const swap3Cmd = routeCoachCommand({
  userMessage: "I don't have a cable machine, swap cable rows",
  todayISO: REP_TODAY,
  referenceResolution: resolved(REP_MONDAY, 'Upper Body Strength'),
});
ok('"swap cable rows" (source-only) → mutate', swap3Cmd.mode === 'mutate');
ok('source-only → replace_exercise',
  asMutate(swap3Cmd)?.operation === 'replace_exercise');
const swap3Payload = asMutate(swap3Cmd)?.payload;
ok('source-only → toExercise null',
  swap3Payload?.operation === 'replace_exercise' && swap3Payload.toExercise === null);

const swap3Exec = executeCoachCommand({
  command: swap3Cmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: "I don't have a cable machine, swap cable rows",
  replaceExerciseDeps: {
    snapshotBefore: () =>
      fakeWorkout(['Barbell Row', 'Pull-Ups']),
    applyEvents: () => { throw new Error('apply must NOT be called for clarify'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for clarify'); },
  },
});
eq('"swap cable rows" → clarify', swap3Exec.kind, 'clarify');
ok('clarify reply asks for replacement', /swap|replace|what/i.test(swap3Exec.reply));
ok('clarify offers 1+ options',
  Array.isArray(swap3Exec.options) && swap3Exec.options.length >= 1,
  `options=${JSON.stringify(swap3Exec.options ?? null)}`);

// 15.4 — "replace this exercise" with lastOpenedWorkout binding → clarify w/ exercise list
const pronCmd = routeCoachCommand({
  userMessage: 'replace this exercise',
  todayISO: REP_TODAY,
  referenceResolution: resolved(REP_MONDAY, 'Lower Body Strength'),
  lastOpenedWorkout: { date: REP_MONDAY, sessionName: 'Lower Body Strength' },
});
ok('"replace this exercise" → mutate', pronCmd.mode === 'mutate');
ok('pronoun → replace_exercise',
  asMutate(pronCmd)?.operation === 'replace_exercise');
const pronPayload = asMutate(pronCmd)?.payload;
ok('pronoun → fromExercise=__pronoun__',
  pronPayload?.operation === 'replace_exercise' &&
  pronPayload.fromExercise === '__pronoun__');

const pronExec = executeCoachCommand({
  command: pronCmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'replace this exercise',
  replaceExerciseDeps: {
    snapshotBefore: () =>
      fakeWorkout(['Back Squat', 'Walking Lunges', 'Hip Thrusts']),
    applyEvents: () => { throw new Error('apply must NOT be called for pronoun clarify'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for pronoun clarify'); },
  },
});
eq('"replace this exercise" → clarify', pronExec.kind, 'clarify');
ok('pronoun clarify lists workout exercises as options',
  Array.isArray(pronExec.options) &&
  pronExec.options!.includes('Back Squat') &&
  pronExec.options!.includes('Walking Lunges'));
ok('pronoun clarify reply asks WHICH exercise',
  /which exercise/i.test(pronExec.reply));

// 15.5 — Source name doesn't match any exercise in the workout → clarify
const ambSrcCmd = routeCoachCommand({
  userMessage: 'swap leg press for back squat',
  todayISO: REP_TODAY,
  referenceResolution: resolved(REP_MONDAY, 'Lower Body Strength'),
});
const ambSrcExec = executeCoachCommand({
  command: ambSrcCmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'swap leg press for back squat',
  replaceExerciseDeps: {
    snapshotBefore: () => fakeWorkout(['Back Squat', 'RDLs']),
    applyEvents: () => { throw new Error('apply must NOT be called for unknown source'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for unknown source'); },
  },
});
eq('unknown source → clarify', ambSrcExec.kind, 'clarify');
ok('unknown source clarify mentions the typed name',
  /leg press/i.test(ambSrcExec.reply));
ok('unknown source clarify offers actual exercises',
  Array.isArray(ambSrcExec.options) &&
  ambSrcExec.options!.includes('Back Squat'));

// 15.6 — Replacement is unrecognised → reject with reason
const unkRepCmd = routeCoachCommand({
  userMessage: 'swap back squat for unicorn climb',
  todayISO: REP_TODAY,
  referenceResolution: resolved(REP_MONDAY, 'Lower Body Strength'),
});
const unkRepExec = executeCoachCommand({
  command: unkRepCmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'swap back squat for unicorn climb',
  replaceExerciseDeps: {
    snapshotBefore: () => fakeWorkout(['Back Squat', 'RDLs']),
    applyEvents: () => { throw new Error('apply must NOT be called for unknown replacement'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for unknown replacement'); },
  },
});
eq('unknown replacement → rejected', unkRepExec.kind, 'rejected');
ok('rejection reply mentions "I don\'t recognise"',
  /don'?t recognise|don'?t recognize/i.test(unkRepExec.reply),
  unkRepExec.reply);
ok('rejection applied = false', unkRepExec.applied === false);

// 15.7 — RETIRED. The old "apply succeeded but the name-only verifier says the
// source still renders → verified_no_op" test asserted the very dual-surface
// name-only verifier that produced §18 invariant #5's false "Done" (it declared
// a swap done while the accepted row kept its old identity). The verifier is
// deleted, not migrated: the write is now owned by replaceExerciseAtDate and the
// door trusts the owner's result, so this split-brain state can no longer occur.

// 15.8 — Owner rejects a source that isn't on the day → honest, non-Done reply.
// The owner now finds no such row; the executor surfaces its reason.
seedSwapFixture(REP_MONDAY, ['Squat', 'Pull-Ups']); // no Bench Press on the day
const notPresentExec = executeCoachCommand({
  command: swap1Cmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'swap bench press for dumbbell bench',
  replaceExerciseDeps: {
    // Front-half still sees the requested source (matches production, where the
    // snapshot and the owner read the same store); the owner is the source of
    // truth and rejects because the row isn't there.
    snapshotBefore: () => fakeWorkout(['Bench Press', 'Pull-Ups']),
  },
});
eq('owner not-found → verified_no_op', notPresentExec.kind, 'verified_no_op');
ok('not-present reply names the missing source',
  /bench press/i.test(notPresentExec.reply) && !/^Done\b/.test(notPresentExec.reply),
  notPresentExec.reply);
clearSwapFixture();

// 15.9 — Past-date rejection, now owned by replaceExerciseAtDate (both doors).
// The command targets REP_MONDAY but "today" is after it, so the day is in the
// past and the owner refuses the edit.
seedSwapFixture(REP_MONDAY, ['Bench Press', 'Pull-Ups']);
const pastSwapExec = executeCoachCommand({
  command: swap1Cmd,
  todayISO: '2026-05-20', // after REP_MONDAY (2026-05-11) → target is in the past
  referenceResolution: null,
  userMessage: 'swap bench press for dumbbell bench',
  replaceExerciseDeps: {
    snapshotBefore: () => fakeWorkout(['Bench Press', 'Pull-Ups']),
  },
});
eq('past-date swap → verified_no_op', pastSwapExec.kind, 'verified_no_op');
ok('past-date swap reply mentions "past"',
  /past/i.test(pastSwapExec.reply));
ok('past-date swap wrote nothing', swapOverrideCalls.length === 0);
clearSwapFixture();

// 15.10 — No target binding → clarify (executor short-circuits)
const noTargetCmd = routeCoachCommand({
  userMessage: 'swap bench press for dumbbell bench',
  todayISO: REP_TODAY,
  referenceResolution: null,
});
const noTargetExec = executeCoachCommand({
  command: noTargetCmd,
  todayISO: REP_TODAY,
  referenceResolution: null,
  userMessage: 'swap bench press for dumbbell bench',
  replaceExerciseDeps: {
    snapshotBefore: () => { throw new Error('snapshot must NOT be called when target is missing'); },
    applyEvents: () => { throw new Error('apply must NOT be called'); },
    verifyRendered: () => { throw new Error('verify must NOT be called'); },
  },
});
eq('no target → clarify', noTargetExec.kind, 'clarify');
ok('no-target reply asks which session', /which session/i.test(noTargetExec.reply));

// 15.11 — Architecture: legacy fallback NEVER opens for replace_exercise.
for (const c of [swap1Cmd, swap2Cmd, swap3Cmd, pronCmd, ambSrcCmd, unkRepCmd]) {
  ok(
    `canFallbackToLegacy(replace_exercise via "${('payload' in c ? (c as any).payload?.fromExercise ?? '?' : '?')}") === false`,
    !canFallbackToLegacy(c),
  );
}

// 15.12 — Architecture: every replace_exercise router emit has
//          needsClarification=false. The executor owns clarification.
for (const c of [swap1Cmd, swap2Cmd, swap3Cmd, pronCmd, ambSrcCmd, unkRepCmd]) {
  const m = asMutate(c);
  ok(`replace_exercise needsClarification=false (executor owns clarify)`,
    m !== null && m.operation === 'replace_exercise' && m.needsClarification === false);
}

// ─── 16. Phase C — deterministic move_session via applyMoveSession ───
//        Wired through applyMoveSession + verifyRenderedSessionMove.
//        Tests inject stubs via input.moveSessionDeps so the harness
//        never touches the live Zustand store.
//
//        MOV_TODAY is a Sunday so isoForDow always lands on the
//        immediately upcoming week (delta 1..6 days); using a non-Sunday
//        today would make "swap Monday and Tuesday" round Monday into
//        next week and break the swap fixture.

section('16. Phase C — deterministic move_session');

const MOV_TODAY = '2026-05-10'; // Sunday
const MOV_MON = '2026-05-11';
const MOV_TUE = '2026-05-12';
const MOV_WED = '2026-05-13';
const MOV_THU = '2026-05-14';
const MOV_FRI = '2026-05-15';
const MOV_SAT = '2026-05-16';

function moveWorkout(opts: {
  name?: string;
  isTeamDay?: boolean;
  workoutType?: string;
  sessionTier?: string;
  conditioningTitle?: string;
} = {}): any {
  return {
    id: 'wk-move-test',
    name: opts.name ?? 'Lower Body Strength',
    isTeamDay: opts.isTeamDay === true,
    workoutType: opts.workoutType,
    sessionTier: opts.sessionTier,
    conditioningBlock: opts.conditioningTitle
      ? { options: [{ title: opts.conditioningTitle, exerciseIds: [] }] }
      : undefined,
    exercises: [],
  };
}

function moveDay(date: string, workout: any): any {
  return { date, workout, isToday: false };
}

function stubMoveOk(sourceDate: string, destDate: string, name: string): any {
  return (_input: any) => ({
    applied: [
      { date: sourceDate, eventIds: [`mv-src-${sourceDate}`], workoutName: 'Rest' },
      { date: destDate, eventIds: [`mv-dst-${destDate}`], workoutName: name },
    ],
    rejected: [],
    sourceWorkoutBefore: null,
    destWorkoutBefore: null,
  });
}

function stubMoveReject(reason: string, kind: string, date?: string): any {
  return (_input: any) => ({
    applied: [],
    rejected: [{ kind, date, reason }],
    sourceWorkoutBefore: null,
    destWorkoutBefore: null,
  });
}

function stubMoveVerify(args: {
  sourcePresent: { tab: boolean; day: boolean };
  destPresent: { tab: boolean; day: boolean };
}): any {
  return (a: any) => ({
    requestedDay: a.requestedDay,
    todayISO: a.todayISO,
    sourceDate: a.sourceDate,
    destDate: a.destDate,
    movedSessionName: a.movedSessionName,
    sourceWorkoutAfterName: args.sourcePresent.day ? a.movedSessionName : 'Rest',
    destWorkoutAfterName: args.destPresent.day ? a.movedSessionName : null,
    programTabSourceHasMoved: args.sourcePresent.tab,
    programTabDestHasMoved: args.destPresent.tab,
    dayWorkoutSourceHasMoved: args.sourcePresent.day,
    dayWorkoutDestHasMoved: args.destPresent.day,
    sourceOverrideKeyWritten: true,
    destOverrideKeyWritten: true,
  });
}

// 16.1 — Safe explicit one-off move Wed → Fri applies and verifies
const move16_1Cmd = routeCoachCommand({
  userMessage: 'move Wednesday to Friday this week',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_WED, 'Lower Body Strength'),
  gameDates: [],
  teamTrainingDows: [],
});
ok('"move Wed to Fri this week" → mutate', move16_1Cmd.mode === 'mutate');
ok('move 16.1 → operation=move_session',
  asMutate(move16_1Cmd)?.operation === 'move_session');
ok('move 16.1 explicit one-off does not need scope clarification',
  asMutate(move16_1Cmd)?.needsClarification === false);
ok('move 16.1 legacy blocked', !canFallbackToLegacy(move16_1Cmd));

const move16_1Stages: string[] = [];
const move16_1Exec = executeCoachCommand({
  command: move16_1Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move Wednesday to Friday this week',
  onProgress: (s) => move16_1Stages.push(s),
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: stubMoveOk(MOV_WED, MOV_FRI, 'Lower Body Strength'),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: false, day: false }, // source no longer shows it
      destPresent: { tab: true, day: true },     // dest does
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.1 executor kind = mutated', move16_1Exec.kind, 'mutated');
ok('move 16.1 applied = true', move16_1Exec.applied === true);
eq('move 16.1 reply uses simplified weekday copy',
  move16_1Exec.reply,
  "Done — I moved Wednesday's session to Friday.");
ok('move 16.1 route = move_session:applied',
  move16_1Exec.route === 'move_session:applied');
eq('move 16.1 progress order',
  move16_1Stages,
  ['checking_program', 'applying_change', 'verifying_update', 'composing_reply']);

// 16.1b — Whole-day weekday move resolves against the visible week first
const move16_1bCmd = routeCoachCommand({
  userMessage: 'move all of Saturday to Thursday',
  todayISO: '2026-06-01',
  referenceResolution: resolved('2026-06-04', 'Lower Squat'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Rest', workout: null },
    { date: '2026-06-06', sessionName: 'Recovery Session', workout: moveWorkout({ name: 'Recovery Session' }) },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b visible-week whole-day move → mutate clarifier',
  move16_1bCmd.mode === 'mutate' &&
    asMutate(move16_1bCmd)?.operation === 'move_session' &&
    asMutate(move16_1bCmd)?.needsClarification === true);
ok('move 16.1b asks simple confirmation from visible Saturday to Thursday',
  /Move Saturday's Recovery Session to Thursday this week\?/i.test(asMutate(move16_1bCmd)?.clarificationQuestion ?? ''),
  asMutate(move16_1bCmd)?.clarificationQuestion);
eq('move 16.1b missing field = confirmation',
  asMutate(move16_1bCmd)?.missingFields ?? [],
  ['confirmation']);
ok('move 16.1b carries visible-week source and target dates',
  asMutate(move16_1bCmd)?.payload.operation === 'move_session' &&
    asMutate(move16_1bCmd)?.target.kind === 'date' &&
    asMutate(move16_1bCmd)?.target.date === '2026-06-06' &&
    asMutate(move16_1bCmd)?.payload.fromDow === 6 &&
    asMutate(move16_1bCmd)?.payload.toDate === '2026-06-04' &&
    asMutate(move16_1bCmd)?.payload.toDow === 4 &&
    asMutate(move16_1bCmd)?.payload.moveScope === 'one_off');
ok('move 16.1b does not use target_session for schedule date resolution',
  !(asMutate(move16_1bCmd)?.missingFields ?? []).includes('target_session'),
  JSON.stringify(asMutate(move16_1bCmd)?.missingFields ?? []));
const move16_1bExec = executeCoachCommand({
  command: move16_1bCmd,
  todayISO: '2026-06-01',
  referenceResolution: null,
  userMessage: 'move all of Saturday to Thursday',
  moveSessionDeps: {
    snapshotBefore: () => { throw new Error('confirmation clarifier must not read source workout'); },
    applyMove: () => { throw new Error('confirmation clarifier must not apply move'); },
    verifyRendered: () => { throw new Error('confirmation clarifier must not verify move'); },
  },
});
eq('move 16.1b executor asks clarify', move16_1bExec.kind, 'clarify');
ok('move 16.1b options include yes/no confirmation',
  (move16_1bExec.options ?? []).includes('Yes') &&
    (move16_1bExec.options ?? []).includes('No'),
  JSON.stringify(move16_1bExec.options));

const move16_1bThursdayToSaturday = routeCoachCommand({
  userMessage: 'Can you move all of Thursday to Saturday?',
  todayISO: '2026-06-01',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Lower Squat', workout: moveWorkout({ name: 'Lower Squat' }) },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
    { date: '2026-06-07', sessionName: 'Rest', workout: null },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b Thursday→Saturday source is Thursday, not selected Sunday',
  move16_1bThursdayToSaturday.mode === 'mutate' &&
    asMutate(move16_1bThursdayToSaturday)?.operation === 'move_session' &&
    asMutate(move16_1bThursdayToSaturday)?.target.kind === 'date' &&
    asMutate(move16_1bThursdayToSaturday)?.target.date === '2026-06-04' &&
    asMutate(move16_1bThursdayToSaturday)?.target.date !== '2026-06-07' &&
    asMutate(move16_1bThursdayToSaturday)?.payload.operation === 'move_session' &&
    asMutate(move16_1bThursdayToSaturday)?.payload.fromDow === 4 &&
    asMutate(move16_1bThursdayToSaturday)?.payload.toDow === 6 &&
    asMutate(move16_1bThursdayToSaturday)?.payload.toDate === '2026-06-06',
  JSON.stringify(asMutate(move16_1bThursdayToSaturday)));
ok('move 16.1b Thursday→Saturday asks confirmation from explicit weekdays',
  /Move Thursday's Lower Squat to Saturday this week\?/i.test(asMutate(move16_1bThursdayToSaturday)?.clarificationQuestion ?? ''),
  asMutate(move16_1bThursdayToSaturday)?.clarificationQuestion);

const move16_1bConflict = routeCoachCommand({
  userMessage: 'move all of Saturday to Thursday',
  todayISO: '2026-06-01',
  referenceResolution: resolved('2026-06-04', 'Lower Squat'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Lower Squat', workout: moveWorkout({ name: 'Lower Squat' }) },
    { date: '2026-06-06', sessionName: 'Recovery Session', workout: moveWorkout({ name: 'Recovery Session' }) },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b target session asks replace/swap/cancel',
  move16_1bConflict.mode === 'mutate' &&
    asMutate(move16_1bConflict)?.operation === 'move_session' &&
    asMutate(move16_1bConflict)?.missingFields?.includes('conflict_resolution') &&
    /Thursday already has Lower Squat/i.test(asMutate(move16_1bConflict)?.clarificationQuestion ?? '') &&
    /replace it, swap the two days, or cancel/i.test(asMutate(move16_1bConflict)?.clarificationQuestion ?? ''),
  asMutate(move16_1bConflict)?.clarificationQuestion);

const move16_1bThursdayNoWorkout = routeCoachCommand({
  userMessage: 'move all of Thursday to Saturday',
  todayISO: '2026-06-01',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Rest', workout: null },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
    { date: '2026-06-07', sessionName: 'Rest', workout: null },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b empty Thursday still binds source to Thursday, not Sunday',
  move16_1bThursdayNoWorkout.mode === 'mutate' &&
    asMutate(move16_1bThursdayNoWorkout)?.operation === 'move_session' &&
    asMutate(move16_1bThursdayNoWorkout)?.target.kind === 'date' &&
    asMutate(move16_1bThursdayNoWorkout)?.target.date === '2026-06-04' &&
    asMutate(move16_1bThursdayNoWorkout)?.target.date !== '2026-06-07' &&
    asMutate(move16_1bThursdayNoWorkout)?.needsClarification === false,
  JSON.stringify(asMutate(move16_1bThursdayNoWorkout)));

const move16_1bPastSource = routeCoachCommand({
  userMessage: 'Can you move all of Saturday to Thursday?',
  todayISO: '2026-06-06',
  referenceResolution: resolved('2026-05-30', 'Upper Pull + 40min Zone 2 Row'),
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b past source date asks date clarification',
  move16_1bPastSource.mode === 'mutate' &&
    asMutate(move16_1bPastSource)?.operation === 'move_session' &&
    asMutate(move16_1bPastSource)?.needsClarification === true &&
    asMutate(move16_1bPastSource)?.missingFields?.includes('source_date'));
ok('move 16.1b past source date preserves move transaction metadata',
  asMutate(move16_1bPastSource)?.payload.operation === 'move_session' &&
    asMutate(move16_1bPastSource)?.payload.fromDow === 6 &&
    asMutate(move16_1bPastSource)?.payload.toDow === 4 &&
    /next Saturday|future Saturdays/i.test(asMutate(move16_1bPastSource)?.clarificationQuestion ?? ''),
  asMutate(move16_1bPastSource)?.clarificationQuestion);

for (const phrase of [
  'move Thursday to Saturday',
  'can we do Thursday on Saturday instead',
  'put my Thursday session on Saturday',
  'Saturday works better than Thursday',
]) {
  const cmd = routeCoachCommand({
    userMessage: phrase,
    todayISO: MOV_TODAY,
    referenceResolution: resolved(MOV_THU, 'Lower Squat'),
    currentWeek: [
      { date: MOV_THU, sessionName: 'Lower Squat', workout: moveWorkout({ name: 'Lower Squat' }) },
      { date: MOV_SAT, sessionName: 'Rest', workout: null },
    ],
    gameDates: [],
    teamTrainingDows: [],
  });
  ok(`${phrase} asks visible-week move confirmation`,
    cmd.mode === 'mutate' &&
      asMutate(cmd)?.operation === 'move_session' &&
      asMutate(cmd)?.needsClarification === true &&
      asMutate(cmd)?.missingFields?.includes('confirmation'));
}

const move16_1bViewedPastRollsForward = routeCoachCommand({
  userMessage: 'move all of Thursday to Saturday',
  todayISO: '2026-06-07',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: [
    {
      date: '2026-06-04',
      sessionName: 'Upper Pull',
      workout: moveWorkout({ name: 'Upper Pull', conditioningTitle: '4 x 2min hard SkiErg' }),
    },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
    { date: '2026-06-07', sessionName: 'Rest', workout: null },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b past visible weekdays roll forward by default',
  move16_1bViewedPastRollsForward.mode === 'mutate' &&
    asMutate(move16_1bViewedPastRollsForward)?.operation === 'move_session' &&
    asMutate(move16_1bViewedPastRollsForward)?.target.kind === 'date' &&
    asMutate(move16_1bViewedPastRollsForward)?.target.date === '2026-06-11' &&
    asMutate(move16_1bViewedPastRollsForward)?.payload.operation === 'move_session' &&
    asMutate(move16_1bViewedPastRollsForward)?.payload.fromDow === 4 &&
    asMutate(move16_1bViewedPastRollsForward)?.payload.toDow === 6 &&
    asMutate(move16_1bViewedPastRollsForward)?.payload.toDate === '2026-06-13',
  JSON.stringify(asMutate(move16_1bViewedPastRollsForward)));
ok('move 16.1b past visible weekdays do not ask viewed-vs-upcoming clarification',
  asMutate(move16_1bViewedPastRollsForward)?.missingFields?.includes('confirmation') &&
    !asMutate(move16_1bViewedPastRollsForward)?.missingFields?.includes('week_context') &&
    /Move next Thursday's Upper Pull \+ 4 x 2min hard SkiErg to Saturday\?/i.test(
      asMutate(move16_1bViewedPastRollsForward)?.clarificationQuestion ?? '',
    ) &&
    !/currently viewed week|Which Thursday/i.test(
      asMutate(move16_1bViewedPastRollsForward)?.clarificationQuestion ?? '',
    ),
  asMutate(move16_1bViewedPastRollsForward)?.clarificationQuestion);

const move16_1bViewedPastExplicitViewedWeek = routeCoachCommand({
  userMessage: 'move all of Thursday to Saturday this viewed week',
  todayISO: '2026-06-07',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Upper Pull', workout: moveWorkout({ name: 'Upper Pull' }) },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
    { date: '2026-06-07', sessionName: 'Rest', workout: null },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b explicit viewed-week wording keeps the selected week',
  move16_1bViewedPastExplicitViewedWeek.mode === 'mutate' &&
    asMutate(move16_1bViewedPastExplicitViewedWeek)?.operation === 'move_session' &&
    asMutate(move16_1bViewedPastExplicitViewedWeek)?.target.kind === 'date' &&
    asMutate(move16_1bViewedPastExplicitViewedWeek)?.target.date === '2026-06-04' &&
    asMutate(move16_1bViewedPastExplicitViewedWeek)?.payload.operation === 'move_session' &&
    asMutate(move16_1bViewedPastExplicitViewedWeek)?.payload.toDate === '2026-06-06' &&
    /Move Thursday's Upper Pull to Saturday this week\?/i.test(
      asMutate(move16_1bViewedPastExplicitViewedWeek)?.clarificationQuestion ?? '',
    ),
  asMutate(move16_1bViewedPastExplicitViewedWeek)?.clarificationQuestion);

const move16_1bPastVisibleNextWeek = routeCoachCommand({
  userMessage: 'move all of Thursday to Saturday next week',
  todayISO: '2026-06-07',
  referenceResolution: resolved('2026-06-04', 'Upper Pull'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Upper Pull', workout: moveWorkout({ name: 'Upper Pull' }) },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
  ],
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1b past visible week plus next week uses upcoming dates',
  move16_1bPastVisibleNextWeek.mode === 'mutate' &&
    asMutate(move16_1bPastVisibleNextWeek)?.operation === 'move_session' &&
    asMutate(move16_1bPastVisibleNextWeek)?.target.kind === 'date' &&
    asMutate(move16_1bPastVisibleNextWeek)?.target.date === '2026-06-11' &&
    asMutate(move16_1bPastVisibleNextWeek)?.payload.operation === 'move_session' &&
    asMutate(move16_1bPastVisibleNextWeek)?.payload.toDate === '2026-06-13',
  JSON.stringify(asMutate(move16_1bPastVisibleNextWeek)));

const move16_1cCmd = routeCoachCommand({
  userMessage: 'move all of Thursday to Saturday going forward',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_THU, 'Lower Squat'),
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1c explicit recurring routes to setup update',
  move16_1cCmd.mode === 'mutate' &&
    asMutate(move16_1cCmd)?.operation === 'update_program_setup');
ok('move 16.1c removes Thursday and adds Saturday',
  asMutate(move16_1cCmd)?.payload.operation === 'update_program_setup' &&
    asMutate(move16_1cCmd)?.payload.removeTrainingDays?.includes('Thursday') &&
    asMutate(move16_1cCmd)?.payload.addTrainingDays?.includes('Saturday'));

const move16_1dCmd = routeCoachCommand({
  userMessage: 'move all of Thursday to Saturday this week',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_THU, 'Lower Squat'),
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.1d explicit this week routes one-off move',
  move16_1dCmd.mode === 'mutate' &&
    asMutate(move16_1dCmd)?.operation === 'move_session' &&
    asMutate(move16_1dCmd)?.needsClarification === false &&
    asMutate(move16_1dCmd)?.payload.operation === 'move_session' &&
    asMutate(move16_1dCmd)?.payload.moveScope === 'one_off');

const move16_1eExec = executeCoachCommand({
  command: move16_1dCmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move all of Thursday to Saturday this week',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({
      name: 'Lower Squat',
      conditioningTitle: 'HI Intervals',
    }),
    applyMove: stubMoveOk(MOV_THU, MOV_SAT, 'Lower Squat + HI Intervals session'),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: false, day: false },
      destPresent: { tab: true, day: true },
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.1e combined-session reply stays simple',
  move16_1eExec.reply,
  "Done — I moved Thursday's session to Saturday.");

// 16.2 — Heavy lower → Friday before Saturday game → router-level reject_with_reason
const move16_2 = routeCoachCommand({
  userMessage: 'move lower body to Friday',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_MON, 'Lower Body Strength'),
  gameDates: [MOV_SAT],
});
ok('move 16.2 heavy-lower → G-1 → reject_with_reason',
  move16_2.mode === 'reject_with_reason' || move16_2.mode === 'reject');
const move16_2Concerns = (move16_2 as any).safetyConcerns ?? [];
ok('move 16.2 names heavy_lower_within_72h_of_game OR non_pump_session_on_G-1',
  move16_2Concerns.includes('heavy_lower_within_72h_of_game') ||
  move16_2Concerns.includes('non_pump_session_on_G-1'),
  `concerns=${JSON.stringify(move16_2Concerns)}`);
const move16_2Exec = executeCoachCommand({
  command: move16_2,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move lower body to Friday',
  moveSessionDeps: {
    applyMove: () => { throw new Error('apply must NOT be called for rejected move'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for rejected move'); },
  },
});
eq('move 16.2 executor kind = rejected_with_alternatives',
  move16_2Exec.kind, 'rejected_with_alternatives');
ok('move 16.2 reply does NOT start with "Done"',
  !/^Done\b/.test(move16_2Exec.reply));

// 16.3 — Move onto team training day → router-level reject
const move16_3 = routeCoachCommand({
  userMessage: 'move lower to Wednesday',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_MON, 'Lower Body Strength'),
  teamTrainingDows: [3], // Wednesday
});
ok('move 16.3 onto team training → reject_with_reason',
  move16_3.mode === 'reject_with_reason' || move16_3.mode === 'reject');
const move16_3Concerns = (move16_3 as any).safetyConcerns ?? [];
ok('move 16.3 names move_lands_on_team_training_day',
  move16_3Concerns.includes('move_lands_on_team_training_day'),
  `concerns=${JSON.stringify(move16_3Concerns)}`);

// 16.4 — Swap Monday and Tuesday → mutate w/ swap=true, both dates land
const move16_4Cmd = routeCoachCommand({
  userMessage: 'swap Monday and Tuesday',
  todayISO: MOV_TODAY,
  referenceResolution: null,
  gameDates: [],
  teamTrainingDows: [],
});
ok('move 16.4 swap days → mutate', move16_4Cmd.mode === 'mutate');
ok('move 16.4 → move_session',
  asMutate(move16_4Cmd)?.operation === 'move_session');
const move16_4Payload = asMutate(move16_4Cmd)?.payload;
ok('move 16.4 payload swap=true',
  move16_4Payload?.operation === 'move_session' && move16_4Payload.swap === true);
ok('move 16.4 payload toDate=Tuesday',
  move16_4Payload?.operation === 'move_session' && move16_4Payload.toDate === MOV_TUE);
ok('move 16.4 target.date = Monday',
  asMutate(move16_4Cmd)?.target.kind === 'date' &&
  (asMutate(move16_4Cmd)?.target as any).date === MOV_MON);

const move16_4Exec = executeCoachCommand({
  command: move16_4Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'swap Monday and Tuesday',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: stubMoveOk(MOV_MON, MOV_TUE, 'Lower Body Strength'),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: false, day: false },
      destPresent: { tab: true, day: true },
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.4 executor kind = mutated', move16_4Exec.kind, 'mutated');
ok('move 16.4 applied = true', move16_4Exec.applied === true);
ok('move 16.4 reply starts with "Done"', /^Done\b/.test(move16_4Exec.reply));
ok('move 16.4 reply mentions "swapped"', /swapped/i.test(move16_4Exec.reply));
ok('move 16.4 reply names both Mon + Tue',
  move16_4Exec.reply.includes(MOV_MON) && move16_4Exec.reply.includes(MOV_TUE));

// 16.5 — "move this session to tomorrow" → toDate = today+1
const move16_5Cmd = routeCoachCommand({
  userMessage: 'move this session to tomorrow',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_WED, 'Lower Body Strength'),
});
ok('move 16.5 "to tomorrow" → mutate', move16_5Cmd.mode === 'mutate');
const move16_5Payload = asMutate(move16_5Cmd)?.payload;
ok('move 16.5 payload toDate = today+1',
  move16_5Payload?.operation === 'move_session' && move16_5Payload.toDate === MOV_MON,
  `got toDate=${(move16_5Payload as any)?.toDate}`);
ok('move 16.5 pronoun source stays on resolver target',
  asMutate(move16_5Cmd)?.target.kind === 'date' &&
    asMutate(move16_5Cmd)?.target.date === MOV_WED &&
    asMutate(move16_5Cmd)?.target.sessionName === 'Lower Body Strength',
  JSON.stringify(asMutate(move16_5Cmd)?.target));

const moveAddedSessionToTomorrowCmd = routeCoachCommand({
  userMessage: 'Actually move it to tomorrow',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_TODAY, 'Easy Aerobic Flush'),
});
ok('move added session → mutate',
  moveAddedSessionToTomorrowCmd.mode === 'mutate');
ok('move added session keeps newly added source date',
  asMutate(moveAddedSessionToTomorrowCmd)?.target.kind === 'date' &&
    asMutate(moveAddedSessionToTomorrowCmd)?.target.date === MOV_TODAY &&
    asMutate(moveAddedSessionToTomorrowCmd)?.target.sessionName === 'Easy Aerobic Flush',
  JSON.stringify(asMutate(moveAddedSessionToTomorrowCmd)?.target));
ok('move added session resolves tomorrow only as target date',
  asMutate(moveAddedSessionToTomorrowCmd)?.payload.operation === 'move_session' &&
    asMutate(moveAddedSessionToTomorrowCmd)?.payload.toDate === MOV_MON,
  JSON.stringify(asMutate(moveAddedSessionToTomorrowCmd)?.payload));

const moveAddedSessionPushCmd = routeCoachCommand({
  userMessage: 'Actually push it to Sunday',
  todayISO: '2026-06-08',
  referenceResolution: resolved('2026-06-13', 'Easy Aerobic Flush'),
});
ok('push added session → mutate',
  moveAddedSessionPushCmd.mode === 'mutate');
ok('push added session keeps Saturday as source',
  asMutate(moveAddedSessionPushCmd)?.target.kind === 'date' &&
    asMutate(moveAddedSessionPushCmd)?.target.date === '2026-06-13' &&
    asMutate(moveAddedSessionPushCmd)?.target.sessionName === 'Easy Aerobic Flush',
  JSON.stringify(asMutate(moveAddedSessionPushCmd)?.target));
ok('push added session uses Sunday only as destination',
  asMutate(moveAddedSessionPushCmd)?.payload.operation === 'move_session' &&
    asMutate(moveAddedSessionPushCmd)?.payload.toDate === '2026-06-14',
  JSON.stringify(asMutate(moveAddedSessionPushCmd)?.payload));
const moveAddedSessionPushExec = executeCoachCommand({
  command: moveAddedSessionPushCmd,
  todayISO: '2026-06-08',
  referenceResolution: null,
  userMessage: 'Actually push it to Sunday',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Easy Aerobic Flush' }),
    applyMove: stubMoveOk('2026-06-13', '2026-06-14', 'Easy Aerobic Flush'),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: false, day: false },
      destPresent: { tab: true, day: true },
    }),
    visibleWeek: () => [],
  },
});
eq('push added session executor mutates',
  moveAddedSessionPushExec.kind,
  'mutated');
ok('push added session never says Sunday to Sunday',
  !/moved\s+Sunday'?s\s+session\s+to\s+Sunday/i.test(moveAddedSessionPushExec.reply),
  moveAddedSessionPushExec.reply);
eq('push added session reply moves Saturday to Sunday',
  moveAddedSessionPushExec.reply,
  "Done — I moved Saturday's session to Sunday.");

const move16_5Exec = executeCoachCommand({
  command: move16_5Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move this session to tomorrow',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: stubMoveOk(MOV_WED, MOV_MON, 'Lower Body Strength'),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: false, day: false },
      destPresent: { tab: true, day: true },
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.5 executor kind = mutated', move16_5Exec.kind, 'mutated');
eq('move 16.5 reply uses simplified weekday copy',
  move16_5Exec.reply,
  "Done — I moved Wednesday's session to Monday.");

// 16.6 — Same-date "Wednesday off" → executor clarifier with OTHER days
const move16_6Cmd = routeCoachCommand({
  userMessage: 'I want Wednesday off, move that session somewhere else',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_WED, 'Lower Body Strength'),
});
ok('move 16.6 "Wed off" → mutate (router emits source=dest)',
  move16_6Cmd.mode === 'mutate');
const move16_6Payload = asMutate(move16_6Cmd)?.payload;
ok('move 16.6 payload toDate=Wed (parsed from "Wednesday")',
  move16_6Payload?.operation === 'move_session' && move16_6Payload.toDate === MOV_WED);

const move16_6Exec = executeCoachCommand({
  command: move16_6Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'I want Wednesday off, move that session somewhere else',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: () => { throw new Error('apply must NOT be called for same-date'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for same-date'); },
    visibleWeek: () => [
      moveDay(MOV_MON, moveWorkout({ name: 'Upper Body Strength' })),
      moveDay(MOV_TUE, moveWorkout({ name: 'Bike Intervals' })),
      moveDay(MOV_WED, moveWorkout({ name: 'Lower Body Strength' })),
      moveDay(MOV_THU, moveWorkout({ name: 'Aerobic Run' })),
      moveDay(MOV_FRI, moveWorkout({ name: 'Pull Strength' })),
    ],
  },
});
eq('move 16.6 executor kind = clarify (same-date)', move16_6Exec.kind, 'clarify');
ok('move 16.6 reply asks "where" instead of confirming',
  /where|instead/i.test(move16_6Exec.reply));
ok('move 16.6 options exclude Wednesday (the source)',
  Array.isArray(move16_6Exec.options) &&
  !move16_6Exec.options!.some((o) => o.includes(MOV_WED)));
ok('move 16.6 options include OTHER days',
  Array.isArray(move16_6Exec.options) &&
  move16_6Exec.options!.length >= 3);

// 16.7 — Ambiguous source ("move it to Thursday", no ref) → executor clarifier
const move16_7Cmd = routeCoachCommand({
  userMessage: 'move it to Thursday',
  todayISO: MOV_TODAY,
  referenceResolution: null,
});
ok('move 16.7 "move it" no ref → mutate w/ unbound target',
  move16_7Cmd.mode === 'mutate' &&
  asMutate(move16_7Cmd)?.target.kind === 'unbound');
ok('move 16.7 needsClarification=false (executor owns clarify)',
  asMutate(move16_7Cmd)?.needsClarification === false);

const move16_7Exec = executeCoachCommand({
  command: move16_7Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move it to Thursday',
  moveSessionDeps: {
    snapshotBefore: () => { throw new Error('snapshot must NOT be called when target unbound'); },
    applyMove: () => { throw new Error('apply must NOT be called'); },
    verifyRendered: () => { throw new Error('verify must NOT be called'); },
    visibleWeek: () => [
      moveDay(MOV_MON, moveWorkout({ name: 'Upper Body Strength' })),
      moveDay(MOV_TUE, moveWorkout({ name: 'Bike Intervals' })),
      moveDay(MOV_WED, moveWorkout({ name: 'Lower Body Strength' })),
    ],
  },
});
eq('move 16.7 executor kind = clarify', move16_7Exec.kind, 'clarify');
ok('move 16.7 reply asks WHICH session',
  /which session/i.test(move16_7Exec.reply));
ok('move 16.7 options list visible-week sessions',
  Array.isArray(move16_7Exec.options) &&
  move16_7Exec.options!.length >= 3);
ok('move 16.7 options reference Lower Body Strength',
  Array.isArray(move16_7Exec.options) &&
  move16_7Exec.options!.some((o) => /Lower Body Strength/.test(o)));
ok('move 16.7 progress = single composing_reply tick',
  move16_7Exec.progress.length === 1 &&
  move16_7Exec.progress[0] === 'composing_reply');

// 16.8 — Ambiguous destination ("move that session somewhere else") → clarifier
const move16_8Cmd = routeCoachCommand({
  userMessage: 'move that session somewhere else',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_WED, 'Lower Body Strength'),
});
ok('move 16.8 "somewhere else" → mutate', move16_8Cmd.mode === 'mutate');
const move16_8Payload = asMutate(move16_8Cmd)?.payload;
ok('move 16.8 payload toDate undefined (no day named)',
  move16_8Payload?.operation === 'move_session' && move16_8Payload.toDate === undefined);

const move16_8Exec = executeCoachCommand({
  command: move16_8Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move that session somewhere else',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: () => { throw new Error('apply must NOT be called for missing dest'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for missing dest'); },
    visibleWeek: () => [
      moveDay(MOV_MON, moveWorkout({ name: 'Upper Body Strength' })),
      moveDay(MOV_TUE, moveWorkout({ name: 'Bike Intervals' })),
      moveDay(MOV_WED, moveWorkout({ name: 'Lower Body Strength' })),
      moveDay(MOV_THU, moveWorkout({ name: 'Aerobic Run' })),
      moveDay(MOV_FRI, moveWorkout({ name: 'Pull Strength' })),
    ],
  },
});
eq('move 16.8 executor kind = clarify (missing dest)', move16_8Exec.kind, 'clarify');
ok('move 16.8 reply asks WHICH day',
  /which day/i.test(move16_8Exec.reply));
ok('move 16.8 reply quotes the source session name',
  /Lower Body Strength/.test(move16_8Exec.reply));
ok('move 16.8 options exclude the source date',
  Array.isArray(move16_8Exec.options) &&
  !move16_8Exec.options!.some((o) => o.includes(MOV_WED)));
ok('move 16.8 options include 4 other days',
  Array.isArray(move16_8Exec.options) &&
  move16_8Exec.options!.length >= 4);

// 16.9 — Apply succeeds but verifier shows source still has the moved
//        name → verified_no_op (no "Done")
const move16_9Exec = executeCoachCommand({
  command: move16_1Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move Wednesday to Friday this week',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: stubMoveOk(MOV_WED, MOV_FRI, 'Lower Body Strength'),
    verifyRendered: stubMoveVerify({
      // Source still shows the moved name on day-view → not fully verified
      sourcePresent: { tab: false, day: true },
      destPresent: { tab: true, day: true },
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.9 executor kind = verified_no_op', move16_9Exec.kind, 'verified_no_op');
ok('move 16.9 applied = false', move16_9Exec.applied === false);
ok('move 16.9 reply does NOT start with "Done"',
  !/^Done\b/.test(move16_9Exec.reply));
ok('move 16.9 reply names visible-surface failure',
  /didn'?t fully land|visible/i.test(move16_9Exec.reply));

// 16.10 — Architecture: legacy fallback NEVER opens for any move command,
//          including reject_with_reason ones.
for (const c of [move16_1Cmd, move16_2, move16_3, move16_4Cmd, move16_5Cmd, move16_6Cmd, move16_7Cmd, move16_8Cmd]) {
  ok(`canFallbackToLegacy(move command, mode=${c.mode}) === false`,
    !canFallbackToLegacy(c));
}

// 16.11 — Architecture: every move_session router emit (mutate mode) has
//          needsClarification=false. The executor owns clarification.
for (const c of [move16_1Cmd, move16_4Cmd, move16_5Cmd, move16_6Cmd, move16_7Cmd, move16_8Cmd]) {
  const m = asMutate(c);
  ok(`move_session needsClarification=false (executor owns clarify)`,
    m !== null && m.operation === 'move_session' && m.needsClarification === false);
}

// 16.12 — Team-training source → executor anchor refusal
//          When the source workout's snapshot reports isTeamDay=true, the
//          executor MUST refuse the move even if the router didn't catch
//          it (the router's pre-pass only sees the destination dow).
const move16_12Cmd = routeCoachCommand({
  userMessage: 'move Tuesday to Friday this week',
  todayISO: MOV_TODAY,
  referenceResolution: resolved(MOV_TUE, 'Team Training'),
  gameDates: [],
  teamTrainingDows: [], // router pre-pass passes
});
ok('move 16.12 router emits mutate (no dest violation)',
  move16_12Cmd.mode === 'mutate');

const move16_12Exec = executeCoachCommand({
  command: move16_12Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move Tuesday to Friday this week',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({
      name: 'Team Training',
      isTeamDay: true,
      workoutType: 'Team Training',
    }),
    applyMove: () => { throw new Error('apply must NOT be called for team-training source'); },
    verifyRendered: () => { throw new Error('verify must NOT be called for team-training source'); },
    visibleWeek: () => [],
  },
});
eq('move 16.12 executor kind = rejected (anchor refusal)',
  move16_12Exec.kind, 'rejected');
ok('move 16.12 route = cannot_move_team_training:move_session',
  move16_12Exec.route === 'cannot_move_team_training:move_session');
ok('move 16.12 reply names "team training"',
  /team training/i.test(move16_12Exec.reply));
ok('move 16.12 reply does NOT start with "Done"',
  !/^Done\b/.test(move16_12Exec.reply));

// 16.13 — Apply layer rejects (e.g. team_training collision missed by
//          earlier layers) → executor surfaces honest reply
const move16_13Exec = executeCoachCommand({
  command: move16_1Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move Wednesday to Friday this week',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: stubMoveReject('cannot move onto team training day', 'cannot_move_team_training', MOV_FRI),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: true, day: true },
      destPresent: { tab: false, day: false },
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.13 apply rejected → rejected (kind translation)',
  move16_13Exec.kind, 'rejected');
ok('move 16.13 reply mentions "team training"',
  /team training/i.test(move16_13Exec.reply));
ok('move 16.13 applied = false', move16_13Exec.applied === false);

// 16.14 — Past-date apply rejection → verified_no_op
const move16_14Exec = executeCoachCommand({
  command: move16_1Cmd,
  todayISO: MOV_TODAY,
  referenceResolution: null,
  userMessage: 'move Wednesday to Friday this week',
  moveSessionDeps: {
    snapshotBefore: () => moveWorkout({ name: 'Lower Body Strength' }),
    applyMove: stubMoveReject('cannot move from past date', 'past_date_blocked', MOV_WED),
    verifyRendered: stubMoveVerify({
      sourcePresent: { tab: true, day: true },
      destPresent: { tab: false, day: false },
    }),
    visibleWeek: () => [],
  },
});
eq('move 16.14 past-date → verified_no_op', move16_14Exec.kind, 'verified_no_op');
ok('move 16.14 reply mentions "past"', /past/i.test(move16_14Exec.reply));

// ─── 17. Phase D — undo_last_change with mutation history ─────────
//
// Tests cover the full lifecycle: every supported mutate operation
// records a verified MutationHistoryEntry on success, "undo that"
// resolves to that entry and applies its RevertPlan via the undo
// engine, and the executor only reports "Done" when the undo engine
// reports fullyVerified=true. Record-on-failure / undo-on-empty /
// legacy-fallback-blocked are covered too. All tests inject stubs via
// `undoDeps` (and the existing per-branch deps) so the harness never
// touches the live Zustand stores.

section('17. Phase D — undo_last_change lifecycle');

import type {
  MutationHistoryEntry,
  RevertPlan,
} from '../store/coachMutationHistoryStore';

interface UndoTestRig {
  recorded: MutationHistoryEntry[];
  reverted: Array<{ id: string; revertedAt?: number }>;
  undoCalls: Array<{ plan: RevertPlan; todayISO: string }>;
  setHistory: (e: MutationHistoryEntry | null) => void;
  current: { last: MutationHistoryEntry | null };
}

function makeUndoRig(opts?: { undoVerified?: boolean }): {
  rig: UndoTestRig;
  deps: import('../utils/coachCommandExecutor').UndoDeps;
} {
  const rig: UndoTestRig = {
    recorded: [],
    reverted: [],
    undoCalls: [],
    current: { last: null },
    setHistory: (e) => { rig.current.last = e; },
  };
  const verified = opts?.undoVerified !== false;
  const deps: import('../utils/coachCommandExecutor').UndoDeps = {
    recordMutation: (entry) => {
      const full: MutationHistoryEntry = {
        id: entry.id ?? `mh-test-${rig.recorded.length}`,
        timestamp: entry.timestamp ?? Date.now(),
        operation: entry.operation,
        mutationKind: entry.mutationKind,
        userMessage: entry.userMessage,
        appliedReply: entry.appliedReply,
        affectedDates: entry.affectedDates,
        scope: entry.scope,
        revertPlan: entry.revertPlan,
        revertedAt: null,
      };
      rig.recorded.push(full);
      rig.current.last = full;
      return full;
    },
    getLastUndoableMutation: () => rig.current.last,
    markReverted: (id, revertedAt) => {
      rig.reverted.push({ id, revertedAt });
      if (rig.current.last && rig.current.last.id === id) {
        rig.current.last = { ...rig.current.last, revertedAt: revertedAt ?? Date.now() };
      }
    },
    applyUndo: (plan, opts) => {
      rig.undoCalls.push({ plan, todayISO: opts.todayISO });
      return {
        executed: true,
        verification: {
          perDate: plan.dateOverrides.map((s) => ({
            date: s.date,
            expectedName: s.workout?.name ?? null,
            programTabName: s.workout?.name ?? null,
            dayWorkoutName: s.workout?.name ?? null,
            matches: verified,
          })),
          preferenceMatches: verified,
          fullyVerified: verified,
        },
      };
    },
    // The diff-based modality recorder consults these — return an empty
    // baseline so any change at all is observed as a "diff".
    readDateOverrideMap: () => new Map(),
    readPreferenceMap: () => ({}),
    readDateOverride: (_d) => ({ workout: null, context: null }),
  };
  return { rig, deps };
}

const UNDO_TODAY = '2026-05-10';
const UNDO_WED = '2026-05-13';
const UNDO_THU = '2026-05-14';
const UNDO_FRI = '2026-05-15';

function undoCmd(): CoachCommand {
  return routeCoachCommand({
    userMessage: 'undo that',
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    lastChange: {
      operation: 'set_conditioning_modality_preference',
      target: { kind: 'date', date: UNDO_WED, sessionName: 'Easy Aerobic Flush' },
      appliedAt: Date.now(),
    },
  });
}

// 17.1 — undo modality preference rower → bike
{
  const { rig, deps } = makeUndoRig();
  // Simulate a recorded preference change. The executor's modality branch
  // diffs the live store; in test, we bypass that by manually pushing a
  // history entry shaped like the orchestrator's recorded output.
  rig.setHistory({
    id: 'mh-pref-1',
    timestamp: Date.now(),
    operation: 'set_conditioning_modality_preference',
    mutationKind: 'modality_preference',
    userMessage: 'use bike for easy aerobic flush going forward',
    appliedReply: 'Saved bike preference for Easy Aerobic Flush',
    affectedDates: [UNDO_WED],
    scope: 'recurring',
    revertPlan: {
      kind: 'restore_snapshot',
      dateOverrides: [{ date: UNDO_WED, workout: null, context: null }],
      modalityPreference: {
        canonicalKey: 'easy aerobic flush',
        sessionName: 'Easy Aerobic Flush',
        entry: null, // none existed before
      },
    },
    revertedAt: null,
  });

  const result = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.1 undo modality preference → mutated', result.kind, 'mutated');
  ok('17.1 reply = "Done — I undid the last change."',
    result.reply === 'Done — I undid the last change.', result.reply);
  ok('17.1 applyUndo was called once', rig.undoCalls.length === 1);
  ok('17.1 plan included preference snapshot',
    rig.undoCalls[0]?.plan.modalityPreference?.canonicalKey === 'easy aerobic flush');
  eq('17.1 markReverted called for entry id', rig.reverted.map((r) => r.id), ['mh-pref-1']);
}

// 17.2 — undo bike subtype/label preference
{
  const { rig, deps } = makeUndoRig();
  rig.setHistory({
    id: 'mh-bike-1',
    timestamp: Date.now(),
    operation: 'set_bike_subtype_preference',
    mutationKind: 'bike_subtype_preference',
    userMessage: 'I want a regular bike, not assault',
    appliedReply: 'Saved regular bike preference',
    affectedDates: [],
    scope: 'recurring',
    revertPlan: {
      kind: 'restore_snapshot',
      dateOverrides: [],
      modalityPreference: {
        canonicalKey: 'easy aerobic flush',
        sessionName: 'Easy Aerobic Flush',
        entry: { from: null, to: 'bike', bikeLabel: 'assault', createdAt: Date.now() - 1000 },
      },
    },
    revertedAt: null,
  });
  const result = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.2 undo bike subtype → mutated', result.kind, 'mutated');
  ok('17.2 plan preference entry has bikeLabel=assault (the previous value)',
    rig.undoCalls[0]?.plan.modalityPreference?.entry?.bikeLabel === 'assault');
  ok('17.2 reply Done', /^Done — I undid/.test(result.reply));
}

// 17.3 — undo single-date modality swap
{
  const { rig, deps } = makeUndoRig();
  rig.setHistory({
    id: 'mh-swap-1',
    timestamp: Date.now(),
    operation: 'swap_conditioning_modality_once',
    mutationKind: 'modality_swap_once',
    userMessage: 'swap it to bike just for Wed',
    appliedReply: 'Swapped to bike for Wed',
    affectedDates: [UNDO_WED],
    scope: 'one_off',
    revertPlan: {
      kind: 'restore_snapshot',
      dateOverrides: [{ date: UNDO_WED, workout: null, context: null }],
    },
    revertedAt: null,
  });
  const result = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.3 undo one-off swap → mutated', result.kind, 'mutated');
  ok('17.3 plan dateOverrides = single Wed snapshot',
    rig.undoCalls[0]?.plan.dateOverrides.length === 1 &&
    rig.undoCalls[0]?.plan.dateOverrides[0].date === UNDO_WED);
}

// 17.4 — undo add conditioning (full record + undo round-trip)
{
  const { rig, deps } = makeUndoRig();
  // Run the add-conditioning mutation through the executor with stubs so
  // it lands as `mutated`. Recording happens inside the executor.
  const addResult = executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'add a bike conditioning to Wednesday',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    userMessage: 'add a bike conditioning to Wednesday',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'wk', name: 'Lower Body Strength', exercises: [] } as any),
      applyEvents: () => ({
        applied: [{ date: UNDO_WED, eventIds: ['e1'], workoutName: 'Lower Body Strength' }],
        rejected: [],
      }),
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: true,
        dayWorkoutProjectionHasConditioning: true,
        programTabWorkoutAfterName: 'Lower Body Strength',
        dayWorkoutWorkoutAfterName: 'Lower Body Strength',
        overrideKeyWritten: true,
      } as any),
    },
    undoDeps: deps,
  });
  eq('17.4 add_conditioning kind=mutated', addResult.kind, 'mutated');
  ok('17.4 add_conditioning recorded once', rig.recorded.length === 1);
  ok('17.4 record kind=add_conditioning',
    rig.recorded[0]?.mutationKind === 'add_conditioning');
  ok('17.4 record affectedDates=[Wed]',
    JSON.stringify(rig.recorded[0]?.affectedDates) === JSON.stringify([UNDO_WED]));
  ok('17.4 record revertPlan dateOverrides[0].date=Wed',
    rig.recorded[0]?.revertPlan.dateOverrides[0]?.date === UNDO_WED);

  const undoResult = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.4 undo add_conditioning → mutated', undoResult.kind, 'mutated');
  ok('17.4 undo applyUndo called once', rig.undoCalls.length === 1);
  ok('17.4 markReverted called for the recorded entry',
    rig.reverted.length === 1 && rig.reverted[0].id === rig.recorded[0].id);
}

// 17.5 — undo remove conditioning
{
  const { rig, deps } = makeUndoRig();
  const removeResult = executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'remove conditioning from Wed',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    userMessage: 'remove conditioning from Wed',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'wk', name: 'Lower Body Strength', exercises: [], conditioningBlock: { exercises: [{ exercise: { name: 'Bike Intervals' }}] } } as any),
      applyEvents: () => ({
        applied: [{ date: UNDO_WED, eventIds: ['e1'], workoutName: 'Lower Body Strength' }],
        rejected: [],
      }),
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: false,
        dayWorkoutProjectionHasConditioning: false,
        programTabWorkoutAfterName: 'Lower Body Strength',
        dayWorkoutWorkoutAfterName: 'Lower Body Strength',
        overrideKeyWritten: true,
      } as any),
    },
    undoDeps: deps,
  });
  eq('17.5 remove_conditioning kind=mutated', removeResult.kind, 'mutated');
  ok('17.5 record mutationKind=remove_conditioning',
    rig.recorded[0]?.mutationKind === 'remove_conditioning');
  const undoResult = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.5 undo → mutated', undoResult.kind, 'mutated');
  ok('17.5 undo reply = canonical Done line',
    undoResult.reply === 'Done — I undid the last change.');
}

// 17.6 — undo replace exercise (write owned by replaceExerciseAtDate)
{
  const { rig, deps } = makeUndoRig();
  seedSwapFixture(UNDO_WED, ['Back Squat', 'Walking Lunge']);
  const swapResult = executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'swap back squat for trap bar deadlift on Wednesday',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    userMessage: 'swap back squat for trap bar deadlift on Wednesday',
    replaceExerciseDeps: {
      snapshotBefore: () => ({
        id: 'wk',
        name: 'Lower Body Strength',
        exercises: [
          { exercise: { name: 'Back Squat' } },
          { exercise: { name: 'Walking Lunge' } },
        ],
      } as any),
    },
    undoDeps: deps,
  });
  eq('17.6 replace_exercise kind=mutated', swapResult.kind, 'mutated');
  ok('17.6 record mutationKind=replace_exercise',
    rig.recorded[0]?.mutationKind === 'replace_exercise');
  const undoResult = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.6 undo → mutated', undoResult.kind, 'mutated');
  clearSwapFixture();
}

// 17.7 — undo move session (records both source + dest dates)
{
  const { rig, deps } = makeUndoRig();
  const moveResult = executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'move Wednesday to Friday this week',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
      gameDates: [],
      teamTrainingDows: [],
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'move Wednesday to Friday this week',
    moveSessionDeps: {
      snapshotBefore: (d: string) => ({
        id: `wk-${d}`,
        name: d === UNDO_WED ? 'Lower Body Strength' : 'Aerobic Run',
        exercises: [],
      } as any),
      applyMove: () => ({
        applied: [
          { date: UNDO_WED, eventIds: ['mv-src'], workoutName: 'Rest' },
          { date: UNDO_FRI, eventIds: ['mv-dst'], workoutName: 'Lower Body Strength' },
        ],
        rejected: [],
        sourceWorkoutBefore: { id: 'wk', name: 'Lower Body Strength', exercises: [] } as any,
        destWorkoutBefore: { id: 'wk2', name: 'Aerobic Run', exercises: [] } as any,
      }),
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        sourceDate: a.sourceDate,
        destDate: a.destDate,
        movedSessionName: a.movedSessionName,
        programTabSourceHasMoved: false,
        programTabDestHasMoved: true,
        dayWorkoutSourceHasMoved: false,
        dayWorkoutDestHasMoved: true,
        sourceOverrideKeyWritten: true,
        destOverrideKeyWritten: true,
        sourceWorkoutAfterName: 'Rest',
        destWorkoutAfterName: 'Lower Body Strength',
      } as any),
      visibleWeek: () => [],
    },
    undoDeps: deps,
  });
  eq('17.7 move_session kind=mutated', moveResult.kind, 'mutated');
  ok('17.7 record mutationKind=move_session',
    rig.recorded[0]?.mutationKind === 'move_session');
  ok('17.7 record affectedDates includes both source + dest',
    rig.recorded[0]?.affectedDates.includes(UNDO_WED) &&
    rig.recorded[0]?.affectedDates.includes(UNDO_FRI));
  ok('17.7 revertPlan dateOverrides has both dates',
    rig.recorded[0]?.revertPlan.dateOverrides.length === 2);
  const undoResult = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.7 undo move → mutated', undoResult.kind, 'mutated');
}

// 17.8 — no history → honest no-op (verified_no_op + canonical reply)
{
  const { deps } = makeUndoRig();
  const result = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.8 no history → verified_no_op', result.kind, 'verified_no_op');
  ok('17.8 reply = canonical no-history line',
    /don'?t have a recent coach change/i.test(result.reply), result.reply);
  ok('17.8 reply does NOT start with "Done"', !/^Done\b/.test(result.reply));
  ok('17.8 applied = false', result.applied === false);
}

// 17.9 — failed undo verification → no Done
{
  const { rig, deps } = makeUndoRig({ undoVerified: false });
  rig.setHistory({
    id: 'mh-fail-1',
    timestamp: Date.now(),
    operation: 'add_conditioning',
    mutationKind: 'add_conditioning',
    userMessage: 'add bike',
    appliedReply: 'Done…',
    affectedDates: [UNDO_WED],
    scope: 'one_off',
    revertPlan: {
      kind: 'restore_snapshot',
      dateOverrides: [{ date: UNDO_WED, workout: null, context: null }],
    },
    revertedAt: null,
  });
  const result = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.9 verification failed → verified_no_op', result.kind, 'verified_no_op');
  ok('17.9 reply does NOT start with "Done"', !/^Done\b/.test(result.reply), result.reply);
  ok('17.9 reply mentions "didn\'t land"', /didn'?t land/i.test(result.reply));
  ok('17.9 markReverted NOT called on failure', rig.reverted.length === 0);
}

// 17.10 — legacy fallback blocked for undo
{
  const cmd = undoCmd();
  ok('17.10 undo is a mutate command', isMutateCommand(cmd));
  ok('17.10 canFallbackToLegacy(undo) = false', !canFallbackToLegacy(cmd));
}

// 17.11 — mutation history only records SUCCESSFUL verified changes.
{
  const { rig, deps } = makeUndoRig();
  // Engine rejects the apply → composeConditioningResult returns
  // verified_no_op; recordVerifiedMutation must be a no-op.
  const failedAdd = executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'add a bike conditioning to Wednesday',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    userMessage: 'add a bike conditioning to Wednesday',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'wk', name: 'Lower Body Strength', exercises: [] } as any),
      applyEvents: () => ({
        applied: [],
        rejected: [{ kind: 'no_workout_on_date', date: UNDO_WED, reason: 'no workout' }],
      }),
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: false,
        dayWorkoutProjectionHasConditioning: false,
        programTabWorkoutAfterName: null,
        dayWorkoutWorkoutAfterName: null,
        overrideKeyWritten: false,
      } as any),
    },
    undoDeps: deps,
  });
  ok('17.11 failed add → kind=verified_no_op',
    failedAdd.kind === 'verified_no_op');
  ok('17.11 recorded array is empty (no record on failure)',
    rig.recorded.length === 0);
}

// 17.12 — undo does NOT target failed/no-op attempts.
//   When a verification-failed mutation is followed by a successful one,
//   "undo" must resolve to the SUCCESSFUL one — the failed one was never
//   recorded.
{
  const { rig, deps } = makeUndoRig();
  // Failed attempt (not recorded).
  executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'add a bike conditioning to Wednesday',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: resolved(UNDO_WED, 'Lower Body Strength'),
    userMessage: 'add a bike conditioning to Wednesday',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'wk', name: 'Lower Body Strength', exercises: [] } as any),
      applyEvents: () => ({ applied: [], rejected: [{ kind: 'no_workout_on_date', date: UNDO_WED, reason: 'x' }] }),
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: false,
        dayWorkoutProjectionHasConditioning: false,
        programTabWorkoutAfterName: null,
        dayWorkoutWorkoutAfterName: null,
        overrideKeyWritten: false,
      } as any),
    },
    undoDeps: deps,
  });
  ok('17.12 failed attempt did not record', rig.recorded.length === 0);

  // Successful attempt (recorded).
  executeCoachCommand({
    command: routeCoachCommand({
      userMessage: 'add a bike conditioning to Thursday',
      todayISO: UNDO_TODAY,
      referenceResolution: resolved(UNDO_THU, 'Aerobic Run'),
    }),
    todayISO: UNDO_TODAY,
    referenceResolution: resolved(UNDO_THU, 'Aerobic Run'),
    userMessage: 'add a bike conditioning to Thursday',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'wk', name: 'Aerobic Run', exercises: [] } as any),
      applyEvents: () => ({
        applied: [{ date: UNDO_THU, eventIds: ['ok'], workoutName: 'Aerobic Run' }],
        rejected: [],
      }),
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: true,
        dayWorkoutProjectionHasConditioning: true,
        programTabWorkoutAfterName: 'Aerobic Run',
        dayWorkoutWorkoutAfterName: 'Aerobic Run',
        overrideKeyWritten: true,
      } as any),
    },
    undoDeps: deps,
  });
  ok('17.12 successful attempt recorded', rig.recorded.length === 1);
  ok('17.12 recorded entry targets Thursday (the SUCCESSFUL date)',
    rig.recorded[0]?.affectedDates.includes(UNDO_THU));

  // Undo lands on the successful one.
  const result = executeCoachCommand({
    command: undoCmd(),
    todayISO: UNDO_TODAY,
    referenceResolution: null,
    userMessage: 'undo that',
    undoDeps: deps,
  });
  eq('17.12 undo → mutated', result.kind, 'mutated');
  ok('17.12 applyUndo plan dateOverrides target Thursday (not Wed)',
    rig.undoCalls[0]?.plan.dateOverrides.some((s) => s.date === UNDO_THU) &&
    !rig.undoCalls[0]?.plan.dateOverrides.some((s) => s.date === UNDO_WED));
}

// ─── 18. Free-form conditioning add abstraction ────────────────────

section('18. free-form conditioning add — casual verb + modality + intensity');

const hiitRowCmd = routeCoachCommand({
  userMessage: 'Can you chuck some HIIT rowing intervals on Tuesday',
  todayISO: '2026-05-30',
  referenceResolution: resolved('2026-06-02', 'Lower Squat'),
});
const hiitRowMutate = asMutate(hiitRowCmd);
ok('18.1 casual add routes to add_conditioning',
  hiitRowMutate?.operation === 'add_conditioning',
  JSON.stringify(hiitRowCmd));
if (hiitRowMutate?.operation === 'add_conditioning' && hiitRowMutate.payload.operation === 'add_conditioning') {
  eq('18.2 preserves exact activity label',
    hiitRowMutate.payload.customActivity,
    'HIIT Rowing Intervals' as any);
  eq('18.3 row modality detected',
    hiitRowMutate.payload.modality,
    'row' as any);
  eq('18.4 HIIT becomes hard intensity',
    hiitRowMutate.payload.intensity,
    'hard' as any);
  eq('18.5 intervals become interval effort',
    hiitRowMutate.payload.effortKind,
    'interval' as any);

  let capturedEvent: any = null;
  const result = executeCoachCommand({
    command: hiitRowMutate,
    todayISO: '2026-05-30',
    referenceResolution: resolved('2026-06-02', 'Lower Squat'),
    userMessage: 'Can you chuck some HIIT rowing intervals on Tuesday',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'lower-squat', name: 'Lower Squat', exercises: [] } as any),
      applyEvents: (events) => {
        capturedEvent = events[0];
        return {
          applied: [{ date: '2026-06-02', eventIds: [events[0].id], workoutName: 'Lower Squat' }],
          rejected: [],
        };
      },
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: true,
        dayWorkoutProjectionHasConditioning: true,
        programTabProjectionHasExpectedActivity: true,
        dayWorkoutProjectionHasExpectedActivity: true,
        expectedActivityTitle: a.expectedActivityTitle,
        afterHasConditioning: true,
        targetWorkoutAfterName: 'Lower Squat',
        targetWorkoutBeforeName: 'Lower Squat',
        overrideKeyWritten: true,
      } as any),
      newEventId: () => 'hiit-row-event',
    },
  });
  eq('18.6 executor verifies mutation',
    result.kind,
    'mutated' as any);
  eq('18.7 uses standard HIIT seconds, not generic 2 min aerobic reps',
    {
      title: capturedEvent?.after?.title,
      prescriptionType: capturedEvent?.after?.prescriptionType,
      sets: capturedEvent?.after?.sets,
      repsMin: capturedEvent?.after?.repsMin,
      repsMax: capturedEvent?.after?.repsMax,
      restSeconds: capturedEvent?.after?.restSeconds,
      flavour: capturedEvent?.after?.conditioningFlavour,
      category: capturedEvent?.after?.conditioningCategory,
    },
    {
      title: 'HIIT Rowing Intervals',
      prescriptionType: 'duration',
      sets: 8,
      repsMin: 45,
      repsMax: 45,
      restSeconds: 90,
      flavour: 'high-intensity',
      category: 'vo2',
    });
  ok('18.7b HIIT description is a full session, not a single effort',
    /8\s*x\s*45s/i.test(capturedEvent?.after?.description ?? '') &&
      !/1\s*x\s*45s/i.test(capturedEvent?.after?.description ?? ''),
    capturedEvent?.after?.description);
  ok('18.8 reply sounds like a coach and offers tweaks',
    /^Yeah, no worries\./.test(result.reply) &&
      /HIIT rowing intervals/.test(result.reply) &&
      /work\/rest changed/.test(result.reply),
    result.reply);
}

const hiitRowAliasCmd = routeCoachCommand({
  userMessage: 'Could you slot in HIIT row intervals on Tuesday?',
  todayISO: '2026-05-30',
  referenceResolution: resolved('2026-06-02', 'Lower Squat'),
});
const hiitRowAliasMutate = asMutate(hiitRowAliasCmd);
ok('18.9 row/rower wording is preserved as a conditioning activity',
  hiitRowAliasMutate?.operation === 'add_conditioning' &&
    (hiitRowAliasMutate.payload as any).customActivity === 'HIIT Row Intervals',
  JSON.stringify(hiitRowAliasCmd));
ok('18.10 row/rower wording does not collapse to generic Row Intervals',
  (hiitRowAliasMutate?.payload as any)?.customActivity !== 'Row Intervals');

// ─── 19. CoachPlan follow-ups preserve training meaning ─────────────

section('19. CoachPlan follow-ups — change equipment without losing intent');

const hiitRowTouchedActivity = {
  kind: 'conditioning' as const,
  date: '2026-06-02',
  sessionName: 'Lower Squat',
  title: 'HIIT Rowing Intervals',
  modality: 'row',
  intensity: 'hard',
  effortKind: 'interval',
  trainingIntent: 'hiit',
  sets: 8,
  repsMin: 45,
  repsMax: 45,
  prescriptionType: 'duration',
};

const skiErgFollowUpCmd = routeCoachCommand({
  userMessage: 'Actually can you make them ski erg?',
  todayISO: '2026-05-30',
  referenceResolution: null,
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: '2026-06-02', sessionName: 'Lower Squat' },
    appliedAt: Date.now(),
    userMessage: 'Can you chuck some HIIT rowing intervals on Tuesday',
    appliedReply: 'Yeah, no worries. I added HIIT rowing intervals to Tue 2026-06-02.',
    touchedActivities: [hiitRowTouchedActivity],
  },
});
const skiErgFollowUpMutate = asMutate(skiErgFollowUpCmd);
ok('19.1 modality follow-up routes through add/update conditioning',
  skiErgFollowUpMutate?.operation === 'add_conditioning',
  JSON.stringify(skiErgFollowUpCmd));
if (skiErgFollowUpMutate?.operation === 'add_conditioning' && skiErgFollowUpMutate.payload.operation === 'add_conditioning') {
  eq('19.2 modality follow-up preserves HIIT interval payload',
    {
      customActivity: skiErgFollowUpMutate.payload.customActivity,
      replaceActivity: skiErgFollowUpMutate.payload.replaceActivity,
      modality: skiErgFollowUpMutate.payload.modality,
      intensity: skiErgFollowUpMutate.payload.intensity,
      effortKind: skiErgFollowUpMutate.payload.effortKind,
      trainingIntent: skiErgFollowUpMutate.payload.trainingIntent,
      changeKind: skiErgFollowUpMutate.payload.changeKind,
      sets: skiErgFollowUpMutate.payload.sets,
      repsMin: skiErgFollowUpMutate.payload.repsMin,
      repsMax: skiErgFollowUpMutate.payload.repsMax,
    },
    {
      customActivity: 'HIIT SkiErg Intervals',
      replaceActivity: 'HIIT Rowing Intervals',
      modality: 'ski',
      intensity: 'hard',
      effortKind: 'interval',
      trainingIntent: 'hiit',
      changeKind: 'modality',
      sets: 8,
      repsMin: 45,
      repsMax: 45,
    } as any);

  let planEvent: any = null;
  const skiErgFollowUpExec = executeCoachCommand({
    command: skiErgFollowUpMutate,
    todayISO: '2026-05-30',
    referenceResolution: null,
    userMessage: 'Actually can you make them ski erg?',
    conditioningDeps: {
      snapshotBefore: () => ({ id: 'lower-squat', name: 'Lower Squat', exercises: [] } as any),
      applyEvents: (events) => {
        planEvent = events[0];
        return {
          applied: [{ date: '2026-06-02', eventIds: [events[0].id], workoutName: 'Lower Squat' }],
          rejected: [],
        };
      },
      verifyRendered: (a) => ({
        requestedDay: a.requestedDay,
        todayISO: a.todayISO,
        targetDate: a.targetDate,
        programTabProjectionHasConditioning: true,
        dayWorkoutProjectionHasConditioning: true,
        programTabProjectionHasExpectedActivity: true,
        dayWorkoutProjectionHasExpectedActivity: true,
        expectedActivityTitle: a.expectedActivityTitle,
        afterHasConditioning: true,
        targetWorkoutAfterName: 'Lower Squat',
        targetWorkoutBeforeName: 'Lower Squat',
        overrideKeyWritten: true,
      } as any),
      newEventId: () => 'coach-plan-ski-erg',
    },
  });
  eq('19.3 coach plan executor verifies mutation',
    skiErgFollowUpExec.kind,
    'mutated' as any);
  eq('19.4 event is HIIT SkiErg, not low-load SkiErg',
    {
      title: planEvent?.after?.title,
      replaceActivity: planEvent?.after?.replaceActivity,
      repsMin: planEvent?.after?.repsMin,
      repsMax: planEvent?.after?.repsMax,
      flavour: planEvent?.after?.conditioningFlavour,
      category: planEvent?.after?.conditioningCategory,
      trainingIntent: planEvent?.after?.trainingIntent,
    },
    {
      title: 'HIIT SkiErg Intervals',
      replaceActivity: 'HIIT Rowing Intervals',
      repsMin: 45,
      repsMax: 45,
      flavour: 'high-intensity',
      category: 'vo2',
      trainingIntent: 'hiit',
    });
  ok('19.5 reply explains preserved interval intent',
    /switched the HIIT rower to SkiErg/i.test(skiErgFollowUpExec.reply) &&
      /kept the same interval intent/i.test(skiErgFollowUpExec.reply),
    skiErgFollowUpExec.reply);
}

const lowLoadSkiTouchedActivity = {
  kind: 'conditioning' as const,
  date: '2026-06-02',
  sessionName: 'Lower Squat',
  title: 'ski erg',
  modality: 'ski',
  intensity: 'light',
  trainingIntent: 'low_load',
  durationMinutes: 20,
  sets: 1,
  repsMin: 45,
  repsMax: 45,
  prescriptionType: 'duration_minutes',
};
const makeSkiHiitCmd = routeCoachCommand({
  userMessage: 'Yeah can you make it HIIT though?',
  todayISO: '2026-05-30',
  referenceResolution: null,
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: '2026-06-02', sessionName: 'Lower Squat' },
    appliedAt: Date.now(),
    userMessage: 'Actually can you make them ski erg?',
    appliedReply: 'Yeah, no worries. I swapped HIIT rowing intervals for a ski erg on Tue 2026-06-02.',
    touchedActivities: [lowLoadSkiTouchedActivity],
  },
});
const makeSkiHiitMutate = asMutate(makeSkiHiitCmd);
ok('19.6 training-quality follow-up routes through coach plan',
  makeSkiHiitMutate?.operation === 'add_conditioning',
  JSON.stringify(makeSkiHiitCmd));
if (makeSkiHiitMutate?.operation === 'add_conditioning' && makeSkiHiitMutate.payload.operation === 'add_conditioning') {
  eq('19.7 training-quality follow-up turns low-load SkiErg into HIIT SkiErg',
    {
      customActivity: makeSkiHiitMutate.payload.customActivity,
      replaceActivity: makeSkiHiitMutate.payload.replaceActivity,
      modality: makeSkiHiitMutate.payload.modality,
      intensity: makeSkiHiitMutate.payload.intensity,
      effortKind: makeSkiHiitMutate.payload.effortKind,
      trainingIntent: makeSkiHiitMutate.payload.trainingIntent,
      changeKind: makeSkiHiitMutate.payload.changeKind,
      sets: makeSkiHiitMutate.payload.sets,
      repsMin: makeSkiHiitMutate.payload.repsMin,
      repsMax: makeSkiHiitMutate.payload.repsMax,
      durationMinutes: makeSkiHiitMutate.payload.durationMinutes,
    },
    {
      customActivity: 'HIIT SkiErg Intervals',
      replaceActivity: 'ski erg',
      modality: 'ski',
      intensity: 'hard',
      effortKind: 'interval',
      trainingIntent: 'hiit',
      changeKind: 'training_intent',
      sets: 8,
      repsMin: 45,
      repsMax: 45,
      durationMinutes: undefined,
    } as any);
}

// ─── 20. Conditioning edit contract ────────────────────────────────

section('20. Conditioning edit contract — update source or ask');

const implicitSourceUpdateCmd: any = {
  mode: 'mutate',
  operation: 'add_conditioning',
  target: { kind: 'date', date: '2026-06-03', sessionName: 'Easy Aerobic Flush' },
  payload: {
    operation: 'add_conditioning',
    modality: 'bike',
    bikeLabel: 'assault',
    durationMinutes: 60,
    editMode: 'update_existing',
  },
  scope: 'one_off',
  confidence: 0.88,
  needsClarification: false,
  reason: 'test_contract_update_existing',
};

let contractEvent: any = null;
const implicitSourceUpdateExec = executeCoachCommand({
  command: implicitSourceUpdateCmd,
  todayISO: '2026-05-30',
  referenceResolution: null,
  userMessage: 'make it one hour',
  conditioningDeps: {
    snapshotBefore: () => ({
      id: 'easy-flush',
      name: 'Easy Aerobic Flush (25min Assault Bike)',
      exercises: [],
      conditioningBlock: {
        options: [{
          title: 'Easy Aerobic Flush (25min Assault Bike)',
          description: '25min easy Assault Bike.',
          exerciseIds: ['flush-row'],
        }],
      },
    } as any),
    applyEvents: (events) => {
      contractEvent = events[0];
      return {
        applied: [{ date: '2026-06-03', eventIds: [events[0].id], workoutName: 'Easy Aerobic Flush' }],
        rejected: [],
      };
    },
    verifyRendered: (a) => ({
      requestedDay: a.requestedDay,
      todayISO: a.todayISO,
      targetDate: a.targetDate,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
      expectedActivityTitle: a.expectedActivityTitle,
      afterHasConditioning: true,
      targetWorkoutAfterName: 'Easy Aerobic Flush',
      targetWorkoutBeforeName: 'Easy Aerobic Flush',
      overrideKeyWritten: true,
    } as any),
    newEventId: () => 'contract-source-update',
  },
});

eq('20.1 implicit update verifies',
  implicitSourceUpdateExec.kind,
  'mutated' as any);
eq('20.2 implicit update binds visible source instead of appending',
  {
    title: contractEvent?.after?.title,
    replaceActivity: contractEvent?.after?.replaceActivity,
    minutes: contractEvent?.after?.minutes,
  },
  {
    title: 'Easy Aerobic Flush (60min Assault Bike)',
    replaceActivity: 'Easy Aerobic Flush (25min Assault Bike)',
    minutes: 60,
  });

const ambiguousSourceUpdateExec = executeCoachCommand({
  command: implicitSourceUpdateCmd,
  todayISO: '2026-05-30',
  referenceResolution: null,
  userMessage: 'make it one hour',
  conditioningDeps: {
    snapshotBefore: () => ({
      id: 'multi-conditioning',
      name: 'Lower Squat',
      exercises: [],
      conditioningBlock: {
        options: [
          { title: 'Easy Aerobic Flush', description: '', exerciseIds: ['a'] },
          { title: 'SkiErg Add-on', description: '', exerciseIds: ['b'] },
        ],
      },
    } as any),
    applyEvents: () => { throw new Error('ambiguous source must not apply'); },
    verifyRendered: () => { throw new Error('ambiguous source must not verify'); },
  },
});

eq('20.3 ambiguous update asks instead of guessing',
  ambiguousSourceUpdateExec.kind,
  'clarify' as any);
ok('20.4 ambiguous update offers visible conditioning options',
  (ambiguousSourceUpdateExec.options ?? []).includes('Easy Aerobic Flush') &&
    (ambiguousSourceUpdateExec.options ?? []).includes('SkiErg Add-on'),
  JSON.stringify(ambiguousSourceUpdateExec));

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
