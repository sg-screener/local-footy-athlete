/**
 * coachModalitySwapTests — Phase 3 deterministic conditioning-modality
 * swap pathway. Validates four layers:
 *
 *   1. Parser            — extract `to`, optional `from` from free text.
 *   2. Tier-preserving   — `pickEquivalentByTier` lands on a same-tier
 *                          name on the destination modality, falls back
 *                          to nearest tier when sparse.
 *   3. Applier            — `applyAdjustmentEvents` honours the explicit
 *                          `{ before:{modality}, after:{modality} }`
 *                          payload AND preserves the legacy injury
 *                          shape.
 *   4. Orchestrator      — `orchestrateModalitySwap` produces verified
 *                          replies for every outcome kind, never
 *                          fabricates "Done", and routes ambiguous /
 *                          unparseable / engine-rejected cases honestly.
 *
 * Run: sucrase-node src/__tests__/coachModalitySwapTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  parseModalitySwapRequest,
  pickEquivalentByTier,
  buildSwapConditioningModalityEvent,
  dayHasModality,
  tokenToModality,
} from '../utils/coachModalitySwap';
import {
  applyAdjustmentEvents,
  APPLY_REJECT_KIND,
  type ApplyOptions,
} from '../utils/applyAdjustmentEvents';
import type {
  AdjustmentEvent,
} from '../utils/programAdjustmentEngine';
import type {
  Workout,
  WorkoutExercise,
  ConditioningBlock,
  OverrideContext,
} from '../types/domain';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';
import {
  orchestrateModalitySwap,
  type ProjectionCheck,
} from '../utils/coachModalitySwapOrchestrator';
import type { CoachReferenceResolution } from '../utils/coachReferenceResolver';

// ─── Test fixtures (same shape as applyAdjustmentEventsTests) ───────

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

function conditioningWorkout(
  name: string,
  exercises: WorkoutExercise[],
  options: { title: string; description: string; exerciseIds: string[] }[],
): Workout {
  const block: ConditioningBlock = {
    intent: 'aerobic-base' as any,
    options,
  };
  return {
    id: `wk-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 3,
    name,
    description: '',
    durationMinutes: 25,
    intensity: 'Easy' as any,
    workoutType: 'Conditioning' as any,
    sessionTier: 'core',
    exercises,
    conditioningBlock: block,
    hasCombinedConditioning: false,
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

interface OverrideCall {
  date: string;
  workout: Workout;
  ctx?: OverrideContext;
}

function makeSpy() {
  const calls: OverrideCall[] = [];
  return {
    calls,
    setManualOverride: (date: string, workout: Workout, ctx?: OverrideContext) => {
      calls.push({ date, workout, ctx });
    },
  };
}

function makeOpts(week: ResolvedDay[], spy: ReturnType<typeof makeSpy>): ApplyOptions {
  return {
    todayISO: FIXED_TODAY,
    buildState: () => emptyScheduleState(),
    resolveWeek: () => week,
    setManualOverride: spy.setManualOverride,
    allowFutureWeeks: true,
  };
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

// ─── 1. Parser ─────────────────────────────────────────────────────

section('[1] parser — single-token "change it to bike"');
{
  const r = parseModalitySwapRequest('Can you change it to a bike instead of a row?');
  ok('parsed result is non-null', !!r);
  eq('to = bike', r?.to, 'bike');
  eq('from = row (resolved by "instead of")', r?.from, 'row');
  ok('fromInferred = false', r?.fromInferred === false);
  eq('toToken preserved', r?.toToken, 'bike');
}

section('[2] parser — "swap rower for bike"');
{
  const r = parseModalitySwapRequest('Please swap the rower for a bike');
  ok('parsed', !!r);
  eq('to = bike', r?.to, 'bike');
  eq('from = row (rower → row)', r?.from, 'row');
  ok('fromInferred = false', r?.fromInferred === false);
}

section('[3] parser — "make it a bike day" → from inferred');
{
  const r = parseModalitySwapRequest('Make it a bike day');
  ok('parsed', !!r);
  eq('to = bike', r?.to, 'bike');
  // No "instead of …" present — the parser leaves `from` for the
  // engine to infer from the target.
  eq('from = null', r?.from, null);
  ok('fromInferred = true', r?.fromInferred === true);
}

section('[4] parser — "switch from row to bike"');
{
  const r = parseModalitySwapRequest('Switch it from row to bike');
  ok('parsed', !!r);
  eq('to = bike', r?.to, 'bike');
  eq('from = row', r?.from, 'row');
}

section('[5] parser — non-modality message → null');
{
  ok('"hi coach" → null', parseModalitySwapRequest('hi coach') === null);
  ok('"why is monday lower?" → null', parseModalitySwapRequest('why is monday lower?') === null);
  ok('empty → null', parseModalitySwapRequest('') === null);
}

section('[6] tokenToModality — synonyms collapse');
{
  eq('rower → row', tokenToModality('rower'), 'row');
  eq('rowing → row', tokenToModality('rowing'), 'row');
  eq('cycling → bike', tokenToModality('cycling'), 'bike');
  eq('skierg → ski', tokenToModality('skierg'), 'ski');
  eq('jog → run', tokenToModality('jog'), 'run');
  ok('garbage → null', tokenToModality('blueberry') === null);
}

// ─── 7. Tier-preserving picker ─────────────────────────────────────

section('[7] pickEquivalentByTier — Easy Row → Easy Bike (Tier C)');
{
  // Easy Row is Tier C / row. Same-tier on bike is "Easy Bike" or
  // "Light Circuits". We accept either as the chosen pick — both are
  // tier-preserving. The picker iterates entries in registry order.
  const pick = pickEquivalentByTier('Easy Row', 'bike');
  ok(
    'picked a Tier C bike option',
    pick === 'Easy Bike' || pick === 'Light Circuits',
    `got ${pick}`,
  );
}

section('[8] pickEquivalentByTier — Hard Row Intervals → Hard Assault Bike Intervals (B-high)');
{
  const pick = pickEquivalentByTier('Hard Row Intervals', 'bike');
  eq('B-high row → B-high bike', pick, 'Hard Assault Bike Intervals');
}

section('[9] pickEquivalentByTier — Sprint Intervals → bike (A is run-only, falls to nearest)');
{
  // Sprint Intervals is Tier A run. On bike, Tier A only has Max Effort
  // Sprint Accumulation. The picker should land there, not on a B-tier
  // bike.
  const pick = pickEquivalentByTier('Sprint Intervals', 'bike');
  eq('A run → A bike (Max Effort Sprint Accumulation)', pick, 'Max Effort Sprint Accumulation');
}

section('[10] pickEquivalentByTier — same-modality returns null');
{
  ok('row → row should be null', pickEquivalentByTier('Easy Row', 'row') === null);
}

section('[11] pickEquivalentByTier — non-conditioning name returns null');
{
  ok('Back Squat → bike → null', pickEquivalentByTier('Back Squat', 'bike') === null);
}

// ─── 12. Applier — explicit row→bike swap ────────────────────────

section('[12] applier — explicit row→bike swap rewrites Easy Row');
{
  const easyRow = ex('Easy Row');
  const wed = conditioningWorkout(
    'Easy Aerobic Flush',
    [easyRow],
    [{ title: 'Easy Row', description: '25min', exerciseIds: [easyRow.id] }],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    {
      id: 'mod-swap-1',
      kind: 'swap_conditioning_modality',
      date: WED_DATE,
      reason: 'modality swap row → bike',
      before: { modality: 'row' },
      after: { modality: 'bike' },
    },
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  eq('one override write', spy.calls.length, 1);
  eq('hits Wed', spy.calls[0].date, WED_DATE);

  const written = spy.calls[0].workout;
  const newName = written.exercises[0].exercise?.name ?? '';
  ok(
    'exercise name moved to a bike option',
    newName === 'Easy Bike' || newName === 'Light Circuits',
    `got ${newName}`,
  );
  ok(
    'block option title moved too',
    written.conditioningBlock?.options?.[0].title !== 'Easy Row',
  );
  // Phase H — the canonical helper rewrites text in-place (clean
  // description) instead of appending a [Swapped to bike] tag.
  // Description starts empty so it stays empty; coachNote describes
  // the modality swap, not the exercise rename.
  ok(
    'no stale [Swapped to bike] tag in description (Phase H clean rewrite)',
    !/\[Swapped to bike\]/.test(written.description ?? ''),
  );
  ok(
    'coachNotes records the modality swap',
    (written.coachNotes ?? []).some((n) => /Swapped (?:from|to)\b/i.test(n) && /bike/i.test(n)),
  );
}

section('[13] applier — explicit row→bike preserves tier (Hard Row → Hard Assault Bike)');
{
  const hardRow = ex('Hard Row Intervals');
  const wed = conditioningWorkout(
    'Hard Conditioning',
    [hardRow],
    [{ title: 'Hard Row Intervals', description: '5x500m', exerciseIds: [hardRow.id] }],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    {
      id: 'mod-swap-2',
      kind: 'swap_conditioning_modality',
      date: WED_DATE,
      reason: 'modality swap row → bike',
      before: { modality: 'row' },
      after: { modality: 'bike' },
    },
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));
  eq('one applied', result.applied.length, 1);
  const written = spy.calls[0].workout;
  eq(
    'B-high row → B-high bike (Hard Assault Bike Intervals)',
    written.exercises[0].exercise?.name,
    'Hard Assault Bike Intervals',
  );
}

section('[14] applier — explicit `from` filter spares non-matching modalities');
{
  // Workout has BOTH a row option and a run option. `from: row` should
  // touch only the row, leaving the run untouched.
  const easyRow = ex('Easy Row');
  const tempo = ex('Tempo Run');
  const wed = conditioningWorkout(
    'Mixed Conditioning',
    [easyRow, tempo],
    [
      { title: 'Easy Row', description: 'opt A', exerciseIds: [easyRow.id] },
      { title: 'Tempo Run', description: 'opt B', exerciseIds: [tempo.id] },
    ],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    {
      id: 'mod-swap-3',
      kind: 'swap_conditioning_modality',
      date: WED_DATE,
      reason: 'row → bike only',
      before: { modality: 'row' },
      after: { modality: 'bike' },
    },
  ];

  applyAdjustmentEvents(events, makeOpts(week, spy));
  const written = spy.calls[0].workout;
  ok(
    'Easy Row got rewritten',
    written.exercises[0].exercise?.name !== 'Easy Row',
  );
  eq(
    'Tempo Run untouched',
    written.exercises[1].exercise?.name,
    'Tempo Run',
  );
}

section('[15] applier — non-conditioning workout rejects swap');
{
  const thuStr = strengthWorkout('Lower Strength', [ex('Back Squat')]);
  const week = buildBaseWeek({ 4: thuStr });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    {
      id: 'mod-swap-4',
      kind: 'swap_conditioning_modality',
      date: '2026-04-30',
      reason: 'no conditioning here',
      before: { modality: 'row' },
      after: { modality: 'bike' },
    },
  ];
  const result = applyAdjustmentEvents(events, makeOpts(week, spy));
  eq('zero applied', result.applied.length, 0);
  eq(
    'rejection kind = no_conditioning_to_swap',
    result.rejected[0].kind,
    APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
  );
}

section('[16] applier — legacy injury shape (no payload) still works');
{
  // Preserves the UAE injury contract: bare `swap_conditioning_modality`
  // with no `before`/`after` fields runs the RUN_TO_OFFFEET map.
  const sprint = ex('Sprint Intervals');
  const wed = conditioningWorkout(
    'Sprint Day',
    [sprint],
    [{ title: 'Sprint Intervals', description: '6×60m', exerciseIds: [sprint.id] }],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    {
      id: 'legacy-injury-swap',
      kind: 'swap_conditioning_modality',
      date: WED_DATE,
      reason: 'hammy 6/10',
    },
  ];
  const result = applyAdjustmentEvents(events, makeOpts(week, spy));
  eq('one applied (legacy path)', result.applied.length, 1);
  const written = spy.calls[0].workout;
  eq(
    'Sprint Intervals → Max Effort Sprint Accumulation',
    written.exercises[0].exercise?.name,
    'Max Effort Sprint Accumulation',
  );
  ok('description tagged Off-feet', /Off-feet/i.test(written.description));
}

// ─── 17. Event factory ─────────────────────────────────────────────

section('[17] buildSwapConditioningModalityEvent — payload shape');
{
  const event = buildSwapConditioningModalityEvent({
    date: WED_DATE,
    from: 'row',
    to: 'bike',
    reason: 'athlete asked',
  });
  eq('kind', event.kind, 'swap_conditioning_modality');
  eq('date', event.date, WED_DATE);
  eq('before payload modality', (event.before as any)?.modality, 'row');
  eq('after payload modality', (event.after as any)?.modality, 'bike');
  ok('id starts with swap-modality-', /^swap-modality-/.test(event.id));
  eq('reason preserved', event.reason, 'athlete asked');
}

section('[18] buildSwapConditioningModalityEvent — null `from` → before:null');
{
  const event = buildSwapConditioningModalityEvent({
    date: WED_DATE,
    from: null,
    to: 'bike',
  });
  ok('before is null when from missing', event.before === null);
  eq('after still has modality', (event.after as any)?.modality, 'bike');
}

// ─── 19. dayHasModality projection helper ──────────────────────────

section('[19] dayHasModality — true for tagged exercise');
{
  const wed = conditioningWorkout('X', [ex('Easy Row')], []);
  const day = {
    date: WED_DATE,
    dayOfWeek: 3,
    short: 'WED',
    isToday: false,
    workout: wed,
    source: 'template' as any,
    indicator: null as any,
  } as unknown as ResolvedDay;
  ok('row is detected', dayHasModality(day, 'row') === true);
  ok('bike is not detected', dayHasModality(day, 'bike') === false);
}

section('[20] dayHasModality — block-options fallback');
{
  // Exercise name is unknown to the registry, but the conditioning
  // block carries a known title.
  const wed = conditioningWorkout(
    'X',
    [ex('Custom Variant')],
    [{ title: 'Easy Bike', description: '', exerciseIds: [] }],
  );
  const day = {
    date: WED_DATE,
    dayOfWeek: 3,
    short: 'WED',
    isToday: false,
    workout: wed,
    source: 'template' as any,
    indicator: null as any,
  } as unknown as ResolvedDay;
  ok('bike via block option', dayHasModality(day, 'bike') === true);
}

// ─── Orchestrator ─────────────────────────────────────────────────

function makeResolution(opts: {
  status: CoachReferenceResolution['status'];
  date?: string;
  sessionName?: string;
  clarifier?: string;
}): CoachReferenceResolution {
  return {
    status: opts.status,
    target: opts.date
      ? {
          date: opts.date,
          sessionName: opts.sessionName ?? 'Easy Aerobic Flush',
          method: 'pronoun_last_explained',
        }
      : null,
    confidence: opts.status === 'resolved' ? 1 : 0,
    clarifierQuestion: opts.clarifier,
  } as unknown as CoachReferenceResolution;
}

section('[21] orchestrator — happy path: row → bike, projections verify');
{
  // applyEvents stub with a captured spy (so we never touch live store).
  const easyRow = ex('Easy Row');
  const wed = conditioningWorkout(
    'Easy Aerobic Flush',
    [easyRow],
    [{ title: 'Easy Row', description: '25min', exerciseIds: [easyRow.id] }],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(week, spy));

  const verify: (args: any) => ProjectionCheck = () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: false,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: false,
    bothProjectionsShowTo: true,
  });

  const out = orchestrateModalitySwap({
    userMessage: 'Can you change it to a bike instead of a row?',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'resolved',
      date: WED_DATE,
      sessionName: 'Easy Aerobic Flush',
    }),
    applyEvents: stubApply,
    verifyProjectionsFn: verify,
  });

  eq('outcome kind = applied', out.kind, 'applied');
  ok('applied true', out.applied === true);
  eq('route', out.route, 'modality_swap_applied');
  ok('reply contains "Done —"', /^Done —/.test(out.reply));
  ok('reply mentions bike', /bike/i.test(out.reply));
  ok('reply mentions rower', /rower/i.test(out.reply));
  ok('reply mentions Easy Aerobic Flush', /Easy Aerobic Flush/.test(out.reply));
  eq('one override written', spy.calls.length, 1);
  ok('projectionShowsTo true', out.projectionShowsTo === true);
  ok('projectionShowsFrom false', out.projectionShowsFrom === false);
}

section('[22] orchestrator — ambiguous reference → clarifier reply, no apply');
{
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(buildBaseWeek({}), spy));

  const out = orchestrateModalitySwap({
    userMessage: 'Can you change it to a bike?',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'ambiguous',
      clarifier: 'Do you mean Wednesday\'s Easy Aerobic Flush?',
    }),
    applyEvents: stubApply,
  });

  eq('outcome kind = ambiguous', out.kind, 'ambiguous');
  ok('not applied', out.applied === false);
  eq('clarifier reply preserved', out.reply, "Do you mean Wednesday's Easy Aerobic Flush?");
  eq('zero applies', spy.calls.length, 0);
}

section('[23] orchestrator — expired reference → clarifier');
{
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(buildBaseWeek({}), spy));

  const out = orchestrateModalitySwap({
    userMessage: 'Can you change it to a bike?',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'expired',
      clarifier: 'Which session did you mean?',
    }),
    applyEvents: stubApply,
  });

  ok('kind is no_target (expired collapses into no_target family)', out.kind === 'no_target');
  ok('not applied', out.applied === false);
  eq('zero applies', spy.calls.length, 0);
}

section('[24] orchestrator — unparseable modality but valid target');
{
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(buildBaseWeek({}), spy));

  const out = orchestrateModalitySwap({
    userMessage: 'Why did you put in a mid-week row?',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'resolved',
      date: WED_DATE,
      sessionName: 'Easy Aerobic Flush',
    }),
    applyEvents: stubApply,
  });

  eq('outcome kind = unparseable', out.kind, 'unparseable');
  ok('not applied', out.applied === false);
  ok(
    'reply admits inability honestly',
    /can see you mean/i.test(out.reply) && /can'?t apply that change automatically yet/i.test(out.reply),
  );
  eq('zero applies', spy.calls.length, 0);
}

section('[25] orchestrator — engine rejected (no conditioning on target day)');
{
  const thuStr = strengthWorkout('Lower Strength', [ex('Back Squat')]);
  const week = buildBaseWeek({ 4: thuStr });
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(week, spy));

  const out = orchestrateModalitySwap({
    userMessage: 'Change Thursday to a bike instead of a row',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'resolved',
      date: '2026-04-30',
      sessionName: 'Lower Strength',
    }),
    applyEvents: stubApply,
  });

  eq('outcome kind = engine_rejected', out.kind, 'engine_rejected');
  ok('not applied', out.applied === false);
  ok(
    'reply admits inability without lying',
    /could'?n'?t safely change/i.test(out.reply) || /couldn't safely change/i.test(out.reply),
  );
  // applyEvents itself should have produced a rejection but no override.
  eq('zero overrides', spy.calls.length, 0);
}

section('[26] orchestrator — verification failed → honest reply, NOT "Done"');
{
  const easyRow = ex('Easy Row');
  const wed = conditioningWorkout(
    'Easy Aerobic Flush',
    [easyRow],
    [{ title: 'Easy Row', description: '25min', exerciseIds: [easyRow.id] }],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(week, spy));

  // Verification stub returns ALL false — pretending the projection
  // didn't pick up the change. Orchestrator MUST NOT say "Done".
  const verify: (args: any) => ProjectionCheck = () => ({
    programTabShowsTo: false,
    programTabStillShowsFrom: true,
    dayWorkoutShowsTo: false,
    dayWorkoutStillShowsFrom: true,
    bothProjectionsShowTo: false,
  });

  const out = orchestrateModalitySwap({
    userMessage: 'Change it to a bike instead of a row',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'resolved',
      date: WED_DATE,
      sessionName: 'Easy Aerobic Flush',
    }),
    applyEvents: stubApply,
    verifyProjectionsFn: verify,
  });

  eq('outcome kind = verification_failed', out.kind, 'verification_failed');
  ok('not applied', out.applied === false);
  ok('reply does NOT start with "Done"', !/^Done/.test(out.reply));
  ok(
    'reply explicitly says it didn\'t actually land',
    /didn'?t actually land/i.test(out.reply),
  );
}

section('[27] orchestrator — no_target / no resolver → clarifier');
{
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(buildBaseWeek({}), spy));

  const out = orchestrateModalitySwap({
    userMessage: 'Change it to a bike',
    todayISO: FIXED_TODAY,
    referenceResolution: null,
    applyEvents: stubApply,
  });

  eq('kind = no_target', out.kind, 'no_target');
  ok('not applied', out.applied === false);
  eq('zero applies', spy.calls.length, 0);
  ok(
    'reply asks a clarifier',
    /which session/i.test(out.reply),
  );
}

section('[28] orchestrator — duration / intensity preserved through swap');
{
  // The applier mutates names + description tag; durationMinutes /
  // intensity should pass through untouched.
  const easyRow = ex('Easy Row');
  const wed = conditioningWorkout(
    'Easy Aerobic Flush',
    [easyRow],
    [{ title: 'Easy Row', description: '25min', exerciseIds: [easyRow.id] }],
  );
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const stubApply: typeof applyAdjustmentEvents = (events) =>
    applyAdjustmentEvents(events, makeOpts(week, spy));

  const verify: (args: any) => ProjectionCheck = () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: false,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: false,
    bothProjectionsShowTo: true,
  });

  orchestrateModalitySwap({
    userMessage: 'Change it to a bike instead of a row',
    todayISO: FIXED_TODAY,
    referenceResolution: makeResolution({
      status: 'resolved',
      date: WED_DATE,
      sessionName: 'Easy Aerobic Flush',
    }),
    applyEvents: stubApply,
    verifyProjectionsFn: verify,
  });

  const written = spy.calls[0].workout;
  eq('durationMinutes preserved', written.durationMinutes, 25);
  eq('intensity preserved', written.intensity as any, 'Easy');
  eq('workoutType still Conditioning', written.workoutType as any, 'Conditioning');
  eq('name unchanged', written.name, 'Easy Aerobic Flush');
}

// ─── Phase H — Canonical workout rewrite (scenarios A–D) ────────────
//
// These scenarios exercise applyConditioningModalityToWorkout directly
// AND end-to-end through the swap_conditioning_modality event applier.
// They lock in the contract Sam specified after the production bug:
//   "[Swapped to bike] + Assault Bike Intervals + 20min easy Rower"
// can no longer co-exist on the same workout.

import {
  applyConditioningModalityToWorkout,
  verifyModalityRewrite,
} from '../utils/coachModalitySwap';

function conditioningWorkoutFull(args: {
  name: string;
  description: string;
  exercises: WorkoutExercise[];
  options: { title: string; description: string; exerciseIds: string[] }[];
  coachNotes?: string[];
}): Workout {
  const block: ConditioningBlock = {
    intent: 'aerobic-base' as any,
    options: args.options,
  };
  return {
    id: `wk-${args.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 3,
    name: args.name,
    description: args.description,
    durationMinutes: 25,
    intensity: 'Easy' as any,
    workoutType: 'Conditioning' as any,
    sessionTier: 'core',
    exercises: args.exercises,
    conditioningBlock: block,
    hasCombinedConditioning: false,
    coachNotes: args.coachNotes,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}

function exWithNotes(name: string, notes: string): WorkoutExercise {
  const base = ex(name);
  return { ...base, notes };
}

// ─── Scenario A — rower → bike (no subtype) ─────────────────────────
section('[A1] canonical: rower→bike (bikeLabel="standard") rewrites every visible field');
{
  const exercise = exWithNotes(
    'Easy Aerobic Flush (20min Rower)',
    '20min easy Rower at conversational pace',
  );
  const workout = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Rower)',
    description: '20min easy Rower',
    exercises: [exercise],
    options: [
      {
        title: 'Easy Aerobic Flush (20min Rower)',
        description: '20min easy Rower',
        exerciseIds: [exercise.id],
      },
    ],
    coachNotes: ['Stale leftover: [Swapped to bike]'],
  });

  const rewritten = applyConditioningModalityToWorkout(workout, {
    fromModality: 'row',
    toModality: 'bike',
    bikeLabel: 'standard',
  });

  ok('A1: workout reference changed (touched)', rewritten !== workout);
  eq('A1: workout.name rewritten', rewritten.name, 'Easy Aerobic Flush (20min Bike)');
  eq('A1: workout.description rewritten', rewritten.description, '20min easy Bike');
  eq(
    'A1: exercise.name rewritten',
    rewritten.exercises?.[0]?.exercise?.name,
    'Easy Aerobic Flush (20min Bike)',
  );
  eq(
    'A1: exercise.description rewritten',
    rewritten.exercises?.[0]?.exercise?.description,
    'Easy Aerobic Flush (20min Bike)',
  );
  eq(
    'A1: exercise.notes rewritten',
    rewritten.exercises?.[0]?.notes,
    '20min easy Bike at conversational pace',
  );
  eq(
    'A1: option.title rewritten',
    rewritten.conditioningBlock?.options?.[0]?.title,
    'Easy Aerobic Flush (20min Bike)',
  );
  eq(
    'A1: option.description rewritten',
    rewritten.conditioningBlock?.options?.[0]?.description,
    '20min easy Bike',
  );

  // Scan only the visible (athlete-facing) text fields — internal IDs
  // / slugs are excluded by design. coachNotes are EXCLUDED because the
  // canonical swap line ("Swapped from rower to regular bike")
  // legitimately names both modalities.
  const visibleText = [
    rewritten.name,
    rewritten.description,
    rewritten.exercises?.[0]?.exercise?.name,
    rewritten.exercises?.[0]?.exercise?.description,
    rewritten.exercises?.[0]?.notes,
    rewritten.conditioningBlock?.options?.[0]?.title,
    rewritten.conditioningBlock?.options?.[0]?.description,
  ].join(' || ');
  ok(
    'A1: no "Rower" in visible text',
    !/\bRower\b/i.test(visibleText) && !/\browing\b/i.test(visibleText),
    visibleText,
  );
  ok('A1: no "Assault" in visible text', !/\bAssault\b/i.test(visibleText));
  ok(
    'A1: coachNotes purged stale "[Swapped to bike]" tag',
    !(rewritten.coachNotes ?? []).some((n) => /\[Swapped to bike\]/.test(n)),
  );
  ok(
    'A1: canonical coachNote appended',
    (rewritten.coachNotes ?? []).some((n) => /Swapped from rower to regular bike/i.test(n)),
  );

  const check = verifyModalityRewrite(rewritten, 'bike', 'standard');
  ok('A1: truth gate passes (no leaks)', check.ok, JSON.stringify(check.leaks));
}

section('[A2] canonical: rower→bike via swap_conditioning_modality event (live bug repro)');
{
  // This is the EXACT shape Sam observed in production: workout.name +
  // workout.description + option carry "Rower" tokens, coachNote has
  // a stale "[Swapped to bike]" tag from an earlier failed attempt.
  // The applier must rewrite all fields atomically.
  const exercise = exWithNotes(
    'Easy Aerobic Flush (20min Rower)',
    '20min easy Rower at conversational pace',
  );
  const wed = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Rower)',
    description: '20min easy Rower',
    exercises: [exercise],
    options: [
      {
        title: 'Easy Aerobic Flush (20min Rower)',
        description: '20min easy Rower',
        exerciseIds: [exercise.id],
      },
    ],
  });
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  const event = buildSwapConditioningModalityEvent({
    date: WED_DATE,
    from: 'row',
    to: 'bike',
    bikeLabel: 'standard',
    reason: 'Phase H bug repro',
  });
  const result = applyAdjustmentEvents([event], makeOpts(week, spy));

  eq('A2: one applied', result.applied.length, 1);
  eq('A2: one override write', spy.calls.length, 1);
  const written = spy.calls[0].workout;
  eq('A2: workout.name clean', written.name, 'Easy Aerobic Flush (20min Bike)');
  eq('A2: workout.description clean', written.description, '20min easy Bike');
  eq(
    'A2: exercise.name clean',
    written.exercises[0].exercise?.name,
    'Easy Aerobic Flush (20min Bike)',
  );
  // coachNotes excluded — canonical swap line names both modalities.
  const a2VisibleText = [
    written.name,
    written.description,
    ...written.exercises.flatMap((e: any) => [
      e?.exercise?.name,
      e?.exercise?.description,
      e?.notes,
    ]),
    ...(written.conditioningBlock?.options?.flatMap((o: any) => [o?.title, o?.description]) ?? []),
  ].join(' || ');
  ok(
    'A2: no Rower in any visible field',
    !/Rower/i.test(a2VisibleText),
    a2VisibleText,
  );
  ok(
    'A2: no "Assault Bike Intervals" fabricated',
    !/Assault Bike Intervals/i.test(a2VisibleText),
  );
  const check = verifyModalityRewrite(written, 'bike', 'standard');
  ok('A2: truth gate passes', check.ok, JSON.stringify(check.leaks));
}

// ─── Scenario B — subtype correction repairs existing override ──────
section('[B1] canonical: bike→bike subtype correction strips "Assault" everywhere');
{
  // Simulates the production override state: a prior swap painted
  // "Assault Bike Intervals" + left "Rower" remnants. The user now
  // says "I want a normal bike". The canonical helper repairs every
  // visible field in place.
  const exercise = exWithNotes(
    'Assault Bike Intervals',
    'Hard Assault Bike work — 5x500m',
  );
  const workout = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Assault Bike)',
    description: '20min easy Assault Bike',
    exercises: [exercise],
    options: [
      {
        title: 'Assault Bike Intervals',
        description: '5x500m on Assault Bike',
        exerciseIds: [exercise.id],
      },
    ],
    coachNotes: ['Swapped from rower to assault bike'],
  });

  const rewritten = applyConditioningModalityToWorkout(workout, {
    fromModality: 'bike',
    toModality: 'bike',
    bikeLabel: 'standard',
  });

  ok('B1: workout reference changed', rewritten !== workout);
  ok(
    'B1: workout.name no longer contains "Assault"',
    !/Assault/i.test(rewritten.name ?? ''),
  );
  ok(
    'B1: workout.description no longer contains "Assault"',
    !/Assault/i.test(rewritten.description ?? ''),
  );
  ok(
    'B1: exercise.name no longer "Assault Bike Intervals"',
    !/Assault/i.test(rewritten.exercises?.[0]?.exercise?.name ?? ''),
  );
  ok(
    'B1: exercise.notes purged of "Assault"',
    !/Assault/i.test(rewritten.exercises?.[0]?.notes ?? ''),
  );
  ok(
    'B1: option.title purged',
    !/Assault/i.test(rewritten.conditioningBlock?.options?.[0]?.title ?? ''),
  );
  ok(
    'B1: option.description purged',
    !/Assault/i.test(rewritten.conditioningBlock?.options?.[0]?.description ?? ''),
  );
  ok(
    'B1: coachNotes has the canonical "regular bike" preference line',
    (rewritten.coachNotes ?? []).some((n) => /regular bike/i.test(n)),
  );
  ok(
    'B1: stale "Swapped from rower to assault bike" note purged',
    !(rewritten.coachNotes ?? []).some((n) => /assault bike/i.test(n)),
  );

  const check = verifyModalityRewrite(rewritten, 'bike', 'standard');
  ok('B1: truth gate passes (no leaks)', check.ok, JSON.stringify(check.leaks));
}

section('[B2] canonical: subtype correction reaches an override with Rower remnants');
{
  // The override path is messy IRL — Phase H repair must clean both
  // the assault-bike label AND any leftover row labels.
  const ex1 = exWithNotes('Assault Bike Intervals', '5x500m');
  const ex2 = ex('Easy Aerobic Flush (20min Rower)');
  const workout = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Assault Bike)',
    description: '20min easy Rower',
    exercises: [ex1, ex2],
    options: [
      { title: 'Assault Bike Intervals', description: '5x500m', exerciseIds: [ex1.id] },
      {
        title: 'Easy Aerobic Flush (20min Rower)',
        description: '20min easy Rower',
        exerciseIds: [ex2.id],
      },
    ],
  });

  // First pass: fix the bike label.
  const afterSubtype = applyConditioningModalityToWorkout(workout, {
    fromModality: 'bike',
    toModality: 'bike',
    bikeLabel: 'standard',
  });
  // Second pass: convert the Rower remnant to bike.
  const final = applyConditioningModalityToWorkout(afterSubtype, {
    fromModality: 'row',
    toModality: 'bike',
    bikeLabel: 'standard',
  });

  // coachNotes excluded — canonical swap line names both modalities.
  const b2Visible = [
    final.name,
    final.description,
    ...(final.exercises ?? []).flatMap((e: any) => [
      e?.exercise?.name,
      e?.exercise?.description,
      e?.notes,
    ]),
    ...(final.conditioningBlock?.options?.flatMap((o: any) => [o?.title, o?.description]) ?? []),
  ].join(' || ');
  ok('B2: "Assault" gone from visible text', !/Assault/i.test(b2Visible), b2Visible);
  ok('B2: "Rower" gone from visible text', !/Rower/i.test(b2Visible), b2Visible);
  const check = verifyModalityRewrite(final, 'bike', 'standard');
  ok('B2: truth gate passes', check.ok, JSON.stringify(check.leaks));
}

// ─── Scenario C — explicit "assault bike" preserved, Rower stripped ─
section('[C1] canonical: explicit assault bike keeps "Assault Bike", strips Rower');
{
  const exercise = exWithNotes(
    'Easy Aerobic Flush (20min Rower)',
    '20min easy Rower',
  );
  const workout = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Rower)',
    description: '20min easy Rower',
    exercises: [exercise],
    options: [
      {
        title: 'Easy Aerobic Flush (20min Rower)',
        description: '20min easy Rower',
        exerciseIds: [exercise.id],
      },
    ],
  });

  const rewritten = applyConditioningModalityToWorkout(workout, {
    fromModality: 'row',
    toModality: 'bike',
    bikeLabel: 'assault',
  });

  ok('C1: rewrite happened', rewritten !== workout);
  eq(
    'C1: workout.name contains "Assault Bike"',
    rewritten.name,
    'Easy Aerobic Flush (20min Assault Bike)',
  );
  eq(
    'C1: workout.description rewritten',
    rewritten.description,
    '20min easy Assault Bike',
  );
  // coachNotes excluded — canonical line names both modalities.
  const c1Visible = [
    rewritten.name,
    rewritten.description,
    ...(rewritten.exercises ?? []).flatMap((e: any) => [
      e?.exercise?.name,
      e?.exercise?.description,
      e?.notes,
    ]),
    ...(rewritten.conditioningBlock?.options?.flatMap((o: any) => [o?.title, o?.description]) ?? []),
  ].join(' || ');
  ok(
    'C1: no Rower remains in visible text',
    !/Rower/i.test(c1Visible),
    c1Visible,
  );
  ok(
    'C1: coachNote uses "assault bike" wording',
    (rewritten.coachNotes ?? []).some((n) => /Swapped from rower to assault bike/i.test(n)),
  );

  const check = verifyModalityRewrite(rewritten, 'bike', 'assault');
  ok('C1: truth gate passes for assault destination', check.ok, JSON.stringify(check.leaks));
}

// ─── Scenario D — bare "bike" defaults to standard, NOT assault ─────
section('[D1] resolveModalityLabel — bare "bike" defaults to "Bike" (Phase H flip)');
{
  // Import path test — Phase H flipped the default from 'assault' to
  // 'standard'. Bare requests must NEVER render as "Assault Bike".
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveModalityLabel } = require('../utils/coachModalitySwap');
  eq('D1: bike (no opts) → "Bike"', resolveModalityLabel('bike'), 'Bike');
  eq(
    'D1: bike + bikeLabel:null → "Bike"',
    resolveModalityLabel('bike', { bikeLabel: null }),
    'Bike',
  );
  eq(
    'D1: bike + bikeLabel:standard → "Bike"',
    resolveModalityLabel('bike', { bikeLabel: 'standard' }),
    'Bike',
  );
  eq(
    'D1: bike + bikeLabel:assault → "Assault Bike"',
    resolveModalityLabel('bike', { bikeLabel: 'assault' }),
    'Assault Bike',
  );
}

section('[D2] event applier: missing bikeLabel defaults to standard (no fabricated Assault)');
{
  const exercise = ex('Easy Aerobic Flush (20min Rower)');
  const wed = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Rower)',
    description: '20min easy Rower',
    exercises: [exercise],
    options: [
      {
        title: 'Easy Aerobic Flush (20min Rower)',
        description: '20min easy Rower',
        exerciseIds: [exercise.id],
      },
    ],
  });
  const week = buildBaseWeek({ 3: wed });
  const spy = makeSpy();
  // Build event without an explicit bikeLabel via the public factory —
  // bare bike requests must still render as "Bike", never "Assault Bike".
  const event = buildSwapConditioningModalityEvent({
    date: WED_DATE,
    from: 'row',
    to: 'bike',
    // bikeLabel omitted — Phase H requires the factory to default it
    // to 'standard'.
  });
  applyAdjustmentEvents([event], makeOpts(week, spy));

  const written = spy.calls[0].workout;
  // coachNotes excluded — canonical swap line names both modalities.
  const d2Visible = [
    written.name,
    written.description,
    ...written.exercises.flatMap((e: any) => [e?.exercise?.name, e?.exercise?.description, e?.notes]),
    ...(written.conditioningBlock?.options?.flatMap((o: any) => [o?.title, o?.description]) ?? []),
  ].join(' || ');
  ok('D2: no "Assault" in visible text', !/Assault/i.test(d2Visible), d2Visible);
  ok('D2: "Bike" appears in visible text', /\bBike\b/i.test(d2Visible));
  ok('D2: no "Rower" remains in visible text', !/Rower/i.test(d2Visible), d2Visible);
  eq('D2: workout.name', written.name, 'Easy Aerobic Flush (20min Bike)');
  eq('D2: workout.description', written.description, '20min easy Bike');
}

section('[D3] event factory: to=bike always carries bikeLabel in after payload');
{
  const e = buildSwapConditioningModalityEvent({ date: WED_DATE, from: null, to: 'bike' });
  eq('D3: bike event has bikeLabel="standard" by default', (e.after as any)?.bikeLabel, 'standard');
  const eAssault = buildSwapConditioningModalityEvent({
    date: WED_DATE,
    from: 'row',
    to: 'bike',
    bikeLabel: 'assault',
  });
  eq(
    'D3: explicit assault label preserved',
    (eAssault.after as any)?.bikeLabel,
    'assault',
  );
  const eRow = buildSwapConditioningModalityEvent({ date: WED_DATE, from: 'bike', to: 'row' });
  ok('D3: non-bike event has no bikeLabel', (eRow.after as any)?.bikeLabel === undefined);
}

// ─── Truth-gate negative cases ──────────────────────────────────────
section('[E1] verifyModalityRewrite flags leaked "Rower" on bike destination');
{
  const exercise = ex('Easy Bike');
  const leakyWorkout = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Bike)',
    description: '20min easy Rower', // bug: description still on rower
    exercises: [exercise],
    options: [{ title: 'Easy Bike', description: '20min', exerciseIds: [exercise.id] }],
  });
  const check = verifyModalityRewrite(leakyWorkout, 'bike', 'standard');
  ok('E1: leak detected', !check.ok);
  ok(
    'E1: leak names workout.description field',
    check.leaks.some((l) => l.field === 'workout.description' && /Rower/i.test(l.matched)),
  );
}

section('[E2] verifyModalityRewrite flags leaked "Assault" on standard-bike destination');
{
  const exercise = ex('Easy Bike');
  const leakyWorkout = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Assault Bike)', // bug: assault prefix lingered
    description: '20min easy Bike',
    exercises: [exercise],
    options: [{ title: 'Easy Bike', description: '20min', exerciseIds: [exercise.id] }],
  });
  const check = verifyModalityRewrite(leakyWorkout, 'bike', 'standard');
  ok('E2: leak detected', !check.ok);
  ok(
    'E2: workout.name flagged',
    check.leaks.some((l) => l.field === 'workout.name' && /Assault/i.test(l.matched)),
  );
}

section('[E3] verifyModalityRewrite passes a fully-clean workout');
{
  const exercise = ex('Easy Bike');
  const clean = conditioningWorkoutFull({
    name: 'Easy Aerobic Flush (20min Bike)',
    description: '20min easy Bike',
    exercises: [exercise],
    options: [
      { title: 'Easy Aerobic Flush (20min Bike)', description: '20min easy Bike', exerciseIds: [exercise.id] },
    ],
    coachNotes: ['Swapped from rower to regular bike'],
  });
  const check = verifyModalityRewrite(clean, 'bike', 'standard');
  ok('E3: no leaks on clean workout', check.ok, JSON.stringify(check.leaks));
}

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
