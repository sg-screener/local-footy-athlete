/**
 * planChangeProducerTests — the tap-first plan-change door.
 *
 * CORE INVARIANT under test: every option listPlanChangeOptionsForDay offers
 * builds a proposal that VALIDATES under the shared policy and APPLIES
 * through the same writer as the chat door. The menu may never show
 * something the pipeline would reject, and may never hide something legal.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/planChangeProducerTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { OverrideContext, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  buildCoachRevisionWeekSnapshotFromProjectedDays,
  validateCoachRevisionDiff,
  type CoachRevisionProposal,
} from '../utils/coachRevisionProposal';
import { coachRevisionValidationPolicyForWeek } from '../utils/coachRevisionPolicy';
import {
  applyPlanChange,
  buildPlanChangeProposal,
  isWithinEditHorizon,
  listPlanChangeOptionsForDay,
  pickTemplateForCategory,
  planChangeWarningForCategory,
  type PlanChange,
} from '../utils/planChangeProducer';

const TODAY = '2026-07-01'; // Wednesday
const MON = '2026-06-29';
const THU = '2026-07-02';
const SAT = '2026-07-04';
const NEXT_SAT = '2026-07-11';
const WEEK_4_MON = '2026-07-20'; // outside this week + next 2

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail) console.log(`       ${JSON.stringify(detail)}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function ex(name: string, id: string, sets = 3): any {
  return {
    id,
    workoutId: 'workout',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 90,
    exercise: {
      id,
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

function strengthWorkout(id: string, name: string, dayOfWeek: number): Workout {
  return {
    id,
    microcycleId: 'mc',
    dayOfWeek,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [ex('Back Squat', `${id}-squat`, 4), ex('Pull Up', `${id}-pull`, 3)],
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

function gameWorkout(dayOfWeek: number): Workout {
  return {
    ...strengthWorkout('workout-game', 'Game Day', dayOfWeek),
    workoutType: 'Game',
    exercises: [],
  } as Workout;
}

function visibleDay(date: string, workout: Workout | null): ResolvedDay {
  const dow = new Date(`${date}T12:00:00`).getDay();
  return {
    date,
    dayOfWeek: dow,
    short: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dow],
    isToday: date === TODAY,
    workout,
    source: workout ? 'template' : 'rest',
    indicator: null,
  } as any;
}

/** Bye week: Mon strength, Thu strength, Sat/Sun empty — no game. */
function byeWeek(): ResolvedDay[] {
  return [
    visibleDay(MON, strengthWorkout('workout-mon', 'Lower Body Strength', 1)),
    visibleDay('2026-06-30', null),
    visibleDay(TODAY, null),
    visibleDay(THU, strengthWorkout('workout-thu', 'Upper Push', 4)),
    visibleDay('2026-07-03', null),
    visibleDay(SAT, null),
    visibleDay('2026-07-05', null),
  ];
}

/** Game week (next week): strength Tue, game Sat. */
function gameWeek(): ResolvedDay[] {
  return [
    visibleDay('2026-07-06', null),
    visibleDay('2026-07-07', strengthWorkout('workout-tue2', 'Upper Pull', 2)),
    visibleDay('2026-07-08', null),
    visibleDay('2026-07-09', null),
    visibleDay('2026-07-10', null),
    visibleDay(NEXT_SAT, gameWorkout(6)),
    visibleDay('2026-07-12', null),
  ];
}

function bothWeeks(): ResolvedDay[] {
  return [...byeWeek(), ...gameWeek()];
}

function validateProposal(
  proposal: CoachRevisionProposal,
  visibleWeek: ResolvedDay[],
) {
  if (proposal.kind !== 'revision') throw new Error('expected revision');
  const before = buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek);
  return validateCoachRevisionDiff({
    before,
    proposal,
    policy: {
      ...coachRevisionValidationPolicyForWeek(visibleWeek, TODAY),
      requireConfirmationForAdds: false,
    },
  });
}

function build(change: PlanChange, week: ResolvedDay[]): CoachRevisionProposal {
  const proposal = buildPlanChangeProposal(change, { visibleWeek: week });
  if ('error' in proposal) throw new Error(`build failed: ${proposal.error}`);
  return proposal;
}

console.log('planChangeProducerTests');

{
  console.log('\n[1] horizon');
  ok('[1] today is editable', isWithinEditHorizon(TODAY, TODAY));
  ok('[1] Monday of current week editable', isWithinEditHorizon(MON, TODAY));
  ok('[1] next-2-weeks Sunday editable', isWithinEditHorizon('2026-07-19', TODAY));
  ok('[1] week 4 locked', !isWithinEditHorizon(WEEK_4_MON, TODAY));
}

{
  console.log('\n[2] options on a bye-week session day');
  const options = listPlanChangeOptionsForDay({
    visibleWeek: bothWeeks(),
    date: THU,
    todayISO: TODAY,
  });
  eq('[2] unlocked', options.locked, null);
  ok('[2] can remove', options.canRemove);
  eq('[2] all 15 templates offered (bye week)', options.templates.length, 15);
  ok('[2] bye-only templates included',
    options.templates.some((t) => t.templateId === 'metcon_offlegs') &&
      options.templates.some((t) => t.templateId === 'erg_emom'),
    options.templates.map((t) => t.templateId));
  ok('[2] move destinations include every non-game day',
    options.moveDestinations.length > 0 &&
      options.moveDestinations.every((destination) => {
        const day = bothWeeks().find((d) => d.date === destination.date);
        return day != null && day.workout?.workoutType !== 'Game';
      }),
    options.moveDestinations);
  {
    // Rest days first, then occupied (swap) destinations.
    const firstOccupiedIdx = options.moveDestinations.findIndex((d) => d.occupiedBy !== null);
    const lastRestIdx = options.moveDestinations
      .map((d, i) => (d.occupiedBy === null ? i : -1))
      .reduce((a, b) => Math.max(a, b), -1);
    ok('[2] rest days listed before occupied days',
      firstOccupiedIdx === -1 || lastRestIdx < firstOccupiedIdx,
      options.moveDestinations);
    ok('[2] occupied destinations carry the session name',
      options.moveDestinations.some((d) => d.occupiedBy === 'Lower Body Strength'),
      options.moveDestinations);
  }
}

{
  console.log('\n[3] athlete override: game-week days offer EVERYTHING too');
  const options = listPlanChangeOptionsForDay({
    visibleWeek: bothWeeks(),
    date: '2026-07-08',
    todayISO: TODAY,
  });
  eq('[3] unlocked', options.locked, null);
  eq('[3] all 15 templates offered on a game week', options.templates.length, 15);
  ok('[3] hard templates included (warned, not hidden)',
    options.templates.some((t) => t.byeOnly),
    options.templates.map((t) => t.templateId));
}

{
  console.log('\n[4] locked days');
  const game = listPlanChangeOptionsForDay({
    visibleWeek: bothWeeks(),
    date: NEXT_SAT,
    todayISO: TODAY,
  });
  eq('[4] game day is locked with reason', game.locked, 'game_day');
  const far = listPlanChangeOptionsForDay({
    visibleWeek: [...bothWeeks(), visibleDay(WEEK_4_MON, null)],
    date: WEEK_4_MON,
    todayISO: TODAY,
  });
  eq('[4] beyond horizon is locked with reason', far.locked, 'outside_horizon');
}

{
  console.log('\n[5] CORE INVARIANT: every offered option validates');
  const week = bothWeeks();
  for (const date of [THU, '2026-07-08']) {
    const options = listPlanChangeOptionsForDay({
      visibleWeek: week,
      date,
      todayISO: TODAY,
    });
    if (options.canRemove) {
      const validation = validateProposal(
        build({ kind: 'remove_session', date }, week), week);
      eq(`[5] remove on ${date} validates`, validation.status, 'valid');
      for (const template of options.templates) {
        const validation2 = validateProposal(
          build({ kind: 'swap_template', date, templateId: template.templateId }, week),
          week);
        eq(`[5] swap ${template.templateId} on ${date} validates`,
          validation2.status, 'valid');
      }
      for (const destination of options.moveDestinations) {
        const validation3 = validateProposal(
          build({ kind: 'move_session', fromDate: date, toDate: destination.date }, week),
          week);
        eq(`[5] move ${date}→${destination.date}${destination.occupiedBy ? ' (swap)' : ''} validates`,
          validation3.status, 'valid');
      }
    } else {
      for (const template of options.templates) {
        const validation4 = validateProposal(
          build({ kind: 'add_template', date, templateId: template.templateId }, week),
          week);
        eq(`[5] add ${template.templateId} on ${date} validates`,
          validation4.status, 'valid');
      }
    }
  }
}

{
  console.log('\n[6] athlete override at the policy layer + free-form still forbidden');
  const week = bothWeeks();
  // Hard template on a game week now VALIDATES — the athlete may override
  // anything; the caution lives in the warning step, not the validator.
  const forced = build(
    { kind: 'add_template', date: '2026-07-08', templateId: 'metcon_offlegs' },
    week);
  const validation = validateProposal(forced, week);
  eq('[6] hard template on a game week validates (athlete override)',
    validation.status, 'valid');

  // But content that is NOT byte-exact registry material stays forbidden —
  // override applies to the athlete's CHOICE, not to arbitrary content.
  const tampered = JSON.parse(JSON.stringify(forced));
  const item = tampered.revisedDays[0].workout.sections[0].items[0];
  item.label = `${item.label} (tampered)`;
  const tamperedValidation = validateProposal(tampered, week);
  eq('[6] tampered non-registry content is still rejected',
    tamperedValidation.status, 'invalid');
}

{
  console.log('\n[7] end-to-end apply through the shared writer');
  const week = bothWeeks();
  const writes: Array<{ date: string; workout: Workout | null; context?: OverrideContext }> = [];
  const result = applyPlanChange({
    change: { kind: 'add_template', date: SAT, templateId: 'metcon_offlegs' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout, context) => writes.push({ date, workout, context }),
  });
  ok('[7] applied ok', result.ok, result);
  eq('[7] one write on the target date', writes.map((w) => w.date), [SAT]);
  ok('[7] written workout is the template',
    !!writes[0]?.workout && /MetCon/i.test(writes[0].workout.name),
    writes[0]?.workout?.name);
  ok('[7] done message names the date', /2026-07-04/.test(result.message), result.message);

  const move = applyPlanChangeMove(week);
  ok('[7] move applies atomically (two writes)', move.writes.length === 2, move.writes);
  ok('[7] move ok', move.result.ok, move.result);
}

function applyPlanChangeMove(week: ResolvedDay[]) {
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const result = applyPlanChange({
    change: { kind: 'move_session', fromDate: THU, toDate: SAT },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  return { writes, result };
}

{
  console.log('\n[8] apply refuses cleanly when the change is impossible');
  const week = bothWeeks();
  const writes: string[] = [];
  const result = applyPlanChange({
    change: { kind: 'remove_session', date: SAT }, // SAT is empty
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date) => writes.push(date),
  });
  ok('[8] refused', !result.ok, result);
  eq('[8] nothing written', writes, []);
}

{
  console.log('\n[9] the change door exists on every session surface (source contract)');
  // Systemic guard: the tap-first door must be mounted on BOTH surfaces an
  // athlete reads their plan from — the board (HomeScreenV2) and the open
  // session (DayWorkoutScreenV2). If a redesign drops the sheet or the
  // link from either file, this fails before the Simulator ever would.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  const surfaces: Array<{ name: string; file: string; linkTestID: string }> = [
    {
      name: 'HomeScreenV2',
      file: path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
      linkTestID: 'make-change-link',
    },
    {
      name: 'DayWorkoutScreenV2',
      file: path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'),
      linkTestID: 'day-workout-make-change-link',
    },
  ];
  for (const surface of surfaces) {
    const src = fs.readFileSync(surface.file, 'utf8');
    ok(`[9] ${surface.name} mounts PlanChangeSheet`, /<PlanChangeSheet\b/.test(src));
    ok(`[9] ${surface.name} renders the change link (${surface.linkTestID})`,
      src.includes(`"${surface.linkTestID}"`));
    ok(`[9] ${surface.name} uses the shared change vocabulary`,
      src.includes('Want to change something?'));
  }
}

{
  console.log('\n[10] sheet v2 categories: availability is policy, picks are deterministic');
  const week = bothWeeks();

  const ALL_CATEGORIES = [
    'accessories', 'conditioning_hard', 'conditioning_light', 'recovery',
    'strength_full', 'strength_lower', 'strength_upper',
  ];
  const bye = listPlanChangeOptionsForDay({ visibleWeek: week, date: THU, todayISO: TODAY });
  eq('[10] bye-week day offers every category',
    bye.categories.map((c) => c.id).sort(), ALL_CATEGORIES);

  const gameWeekDay = listPlanChangeOptionsForDay({
    visibleWeek: week, date: '2026-07-08', todayISO: TODAY,
  });
  eq('[10] game-week day offers every category too (athlete override)',
    gameWeekDay.categories.map((c) => c.id).sort(), ALL_CATEGORIES);

  // Deterministic pick: same inputs → same template. Hard picks work on
  // ANY week now — the game-week caution is a warning, not a filter.
  const pick1 = pickTemplateForCategory({ category: 'conditioning_light', date: THU, visibleWeek: week });
  const pick2 = pickTemplateForCategory({ category: 'conditioning_light', date: THU, visibleWeek: week });
  ok('[10] light pick exists', !!pick1);
  eq('[10] pick is deterministic', pick1?.templateId, pick2?.templateId);
  eq('[10] light pick comes from the flush family', pick1?.category, 'flush');
  ok('[10] hard pick works on a game week (warned, not blocked)',
    pickTemplateForCategory({ category: 'conditioning_hard', date: '2026-07-08', visibleWeek: week })?.category === 'work_capacity');
  ok('[10] hard pick works on a bye week',
    pickTemplateForCategory({ category: 'conditioning_hard', date: THU, visibleWeek: week })?.category === 'work_capacity');

  // Advisory warnings: single producer owner.
  const gameWarning = planChangeWarningForCategory({
    category: 'conditioning_hard', date: '2026-07-08', visibleWeek: week,
  });
  eq('[10] hard on a game week warns about freshness',
    gameWarning?.code, 'game_week_fresh');
  eq('[10] hard on a quiet bye week has no warning',
    planChangeWarningForCategory({ category: 'conditioning_hard', date: THU, visibleWeek: week }),
    null);
  eq('[10] light never warns',
    planChangeWarningForCategory({ category: 'conditioning_light', date: '2026-07-08', visibleWeek: week }),
    null);

  // Burnout: a bye week already carrying two hard sessions warns on a third.
  const heavyByeWeek: ResolvedDay[] = [
    visibleDay(MON, strengthWorkout('h1', 'MetCon — Off-Legs', 1)),
    visibleDay('2026-06-30', strengthWorkout('h2', 'Erg EMOM — 10-15 cal', 2)),
    visibleDay(TODAY, null),
    visibleDay(THU, null),
    visibleDay('2026-07-03', null),
    visibleDay(SAT, null),
    visibleDay('2026-07-05', null),
  ];
  eq('[10] third hard session in a week warns about burnout',
    planChangeWarningForCategory({ category: 'conditioning_hard', date: THU, visibleWeek: heavyByeWeek })?.code,
    'burnout_volume');

  // Variety: when every flush template but one already sits on the week,
  // the pick MUST be the remaining one regardless of the date seed.
  const flushLabels = [
    'Easy Zone 2 Bike', 'Easy Zone 2 Row', 'Easy Zone 2 Ski Erg',
    'Flush Out — 30:30 Intervals', 'Flush Out — 1min On / 1min Off',
  ];
  const crowdedWeek: ResolvedDay[] = [
    visibleDay(MON, strengthWorkout('w1', flushLabels[0], 1)),
    visibleDay('2026-06-30', strengthWorkout('w2', flushLabels[1], 2)),
    visibleDay(TODAY, strengthWorkout('w3', flushLabels[2], 3)),
    visibleDay(THU, strengthWorkout('w4', flushLabels[3], 4)),
    visibleDay('2026-07-03', strengthWorkout('w5', flushLabels[4], 5)),
    visibleDay(SAT, null),
    visibleDay('2026-07-05', null),
  ];
  eq('[10] variety pick avoids sessions already on the week',
    pickTemplateForCategory({ category: 'conditioning_light', date: SAT, visibleWeek: crowdedWeek })?.label,
    'Flush Out — 2min On / 1min Off');

  // Category kinds flow end-to-end through the same writer.
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const swapResult = applyPlanChange({
    change: { kind: 'swap_category', date: THU, category: 'conditioning_light' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[10] swap_category applies', swapResult.ok, swapResult);
  eq('[10] one write on the swapped date', writes.map((w) => w.date), [THU]);
  ok('[10] done message names the picked session',
    !!pick1 && swapResult.message.includes(pick1.label),
    swapResult.message);

  const recoveryWrites: Array<{ date: string; workout: Workout | null }> = [];
  const addResult = applyPlanChange({
    change: { kind: 'add_category', date: SAT, category: 'recovery' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => recoveryWrites.push({ date, workout }),
  });
  ok('[10] add_category recovery applies', addResult.ok, addResult);
  eq('[10] recovery workout materializes as Recovery Flow',
    recoveryWrites[0]?.workout?.name, 'Recovery Flow');
  eq('[10] recovery workout carries the Recovery type',
    recoveryWrites[0]?.workout?.workoutType, 'Recovery');
  eq('[10] recovery workout carries the recovery tier',
    (recoveryWrites[0]?.workout as any)?.sessionTier, 'recovery');
}

{
  console.log('\n[11] move-as-swap: occupied destinations exchange atomically');
  const week = bothWeeks();

  // MON holds Lower Body Strength, THU holds Upper Push — swap them.
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const result = applyPlanChange({
    change: { kind: 'move_session', fromDate: THU, toDate: MON },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[11] swap applies', result.ok, result);
  eq('[11] exactly two writes', writes.length, 2);
  const monWrite = writes.find((w) => w.date === MON);
  const thuWrite = writes.find((w) => w.date === THU);
  ok('[11] MON now holds Upper Push',
    /Upper Push/i.test(monWrite?.workout?.name ?? ''), monWrite?.workout?.name);
  ok('[11] THU now holds Lower Body Strength',
    /Lower Body/i.test(thuWrite?.workout?.name ?? ''), thuWrite?.workout?.name);
  ok('[11] done message says swapped', /swapped/i.test(result.message), result.message);

  // Plain move to a rest day still works and still reads as a move.
  const moveWrites: Array<{ date: string; workout: Workout | null }> = [];
  const moveResult = applyPlanChange({
    change: { kind: 'move_session', fromDate: THU, toDate: SAT },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => moveWrites.push({ date, workout }),
  });
  ok('[11] plain move applies', moveResult.ok, moveResult);
  ok('[11] plain move message unchanged', /moved to/i.test(moveResult.message), moveResult.message);
  ok('[11] source becomes rest on plain move',
    moveWrites.find((w) => w.date === THU)?.workout?.workoutType === 'Rest',
    moveWrites.find((w) => w.date === THU)?.workout?.workoutType);

  // Game days are never destinations.
  const thuOptions = listPlanChangeOptionsForDay({
    visibleWeek: week, date: '2026-07-07', todayISO: TODAY,
  });
  ok('[11] game day never offered as destination',
    thuOptions.moveDestinations.every((d) => d.date !== NEXT_SAT),
    thuOptions.moveDestinations);
}

{
  console.log('\n[12] bin scopes: multi-session days bin by part, team training included');

  // Team + strength combined day (Tue of a bye-style week).
  const teamStrength: Workout = {
    ...strengthWorkout('workout-team-tue', 'Team Training + Upper Push', 2),
    workoutType: 'Team Training',
  } as Workout;

  // Combined S+C day: two strength rows + one conditioning row linked via
  // conditioningBlock.
  const condRow = {
    ...ex('Bike Intervals', 'sc-cond-row', 1),
    exercise: {
      ...ex('Bike Intervals', 'sc-cond-row', 1).exercise,
      exerciseType: 'Cardio',
    },
  };
  const scCombined: Workout = {
    ...strengthWorkout('workout-sc-wed', 'Upper Pull', 3),
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{
        title: 'Aerobic Base',
        description: 'Easy spin',
        exerciseIds: ['sc-cond-row'],
      }],
    },
    exercises: [
      ex('Back Squat', 'sc-squat', 4),
      ex('Pull Up', 'sc-pull', 3),
      condRow,
    ],
  } as Workout;

  const week: ResolvedDay[] = [
    visibleDay(MON, strengthWorkout('workout-mon', 'Lower Body Strength', 1)),
    visibleDay('2026-06-30', teamStrength),
    visibleDay(TODAY, scCombined),
    visibleDay(THU, null),
    visibleDay('2026-07-03', null),
    visibleDay(SAT, null),
    visibleDay('2026-07-05', null),
  ];

  // Scope listings follow the day's structure.
  const plain = listPlanChangeOptionsForDay({ visibleWeek: week, date: MON, todayISO: TODAY });
  eq('[12] plain strength day offers only whole_day',
    plain.binScopes.map((s) => s.id), ['whole_day']);

  const team = listPlanChangeOptionsForDay({ visibleWeek: week, date: '2026-06-30', todayISO: TODAY });
  eq('[12] team+strength day offers gym / team / whole',
    team.binScopes.map((s) => s.id).sort(), ['strength', 'team', 'whole_day']);

  const sc = listPlanChangeOptionsForDay({ visibleWeek: week, date: TODAY, todayISO: TODAY });
  eq('[12] S+C day offers strength / conditioning / whole',
    sc.binScopes.map((s) => s.id).sort(), ['conditioning', 'strength', 'whole_day']);

  // Bin JUST team training: gym session survives under its own name.
  const teamWrites: Array<{ date: string; workout: Workout | null }> = [];
  const teamResult = applyPlanChange({
    change: { kind: 'remove_session', date: '2026-06-30', scope: 'team' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => teamWrites.push({ date, workout }),
  });
  ok('[12] bin team-only applies', teamResult.ok, teamResult);
  eq('[12] one write', teamWrites.length, 1);
  ok('[12] survivor is the gym session',
    teamWrites[0]?.workout?.name === 'Upper Push' &&
      !/team/i.test(teamWrites[0]?.workout?.name ?? ''),
    teamWrites[0]?.workout?.name);
  eq('[12] survivor type is Strength', teamWrites[0]?.workout?.workoutType, 'Strength');
  eq('[12] strength rows preserved', teamWrites[0]?.workout?.exercises?.length, 2);

  // Bin JUST the gym session: team training survives alone.
  const gymWrites: Array<{ date: string; workout: Workout | null }> = [];
  const gymResult = applyPlanChange({
    change: { kind: 'remove_session', date: '2026-06-30', scope: 'strength' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => gymWrites.push({ date, workout }),
  });
  ok('[12] bin gym-only applies', gymResult.ok, gymResult);
  eq('[12] survivor is Team Training', gymWrites[0]?.workout?.name, 'Team Training');
  eq('[12] no strength rows remain', gymWrites[0]?.workout?.exercises?.length, 0);

  // Bin JUST the conditioning on an S+C day.
  const condWrites: Array<{ date: string; workout: Workout | null }> = [];
  const condResult = applyPlanChange({
    change: { kind: 'remove_session', date: TODAY, scope: 'conditioning' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => condWrites.push({ date, workout }),
  });
  ok('[12] bin conditioning-only applies', condResult.ok, condResult);
  ok('[12] conditioning block gone',
    !condWrites[0]?.workout?.conditioningBlock, condWrites[0]?.workout);
  eq('[12] strength rows preserved on S+C day',
    condWrites[0]?.workout?.exercises?.length, 2);

  // Bin JUST the strength on an S+C day: conditioning becomes the day.
  const strWrites: Array<{ date: string; workout: Workout | null }> = [];
  const strResult = applyPlanChange({
    change: { kind: 'remove_session', date: TODAY, scope: 'strength' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => strWrites.push({ date, workout }),
  });
  ok('[12] bin strength-only applies', strResult.ok, strResult);
  eq('[12] conditioning survives as the day',
    strWrites[0]?.workout?.workoutType, 'Conditioning');
  eq('[12] only the conditioning row remains',
    strWrites[0]?.workout?.exercises?.length, 1);

  // Scope that isn't on the day refuses cleanly.
  const badResult = applyPlanChange({
    change: { kind: 'remove_session', date: MON, scope: 'team' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[12] scope not on day refuses without writing', !badResult.ok, badResult);

  // Whole-day default unchanged (back-compat: scope omitted).
  const wholeWrites: Array<{ date: string; workout: Workout | null }> = [];
  const wholeResult = applyPlanChange({
    change: { kind: 'remove_session', date: MON },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => wholeWrites.push({ date, workout }),
  });
  ok('[12] whole-day bin still works', wholeResult.ok, wholeResult);
  eq('[12] whole-day write is a rest override',
    wholeWrites[0]?.workout?.workoutType, 'Rest');
}

{
  console.log('\n[13] add-on-top: conditioning stacks onto occupied days');
  const week = bothWeeks();

  // Strength day offers add-on-top (conditioning categories only).
  const mon = listPlanChangeOptionsForDay({ visibleWeek: week, date: MON, todayISO: TODAY });
  ok('[13] strength day offers add-on-top conditioning',
    mon.addOnTopCategories.length > 0 &&
      mon.addOnTopCategories.every((c) => c.id.startsWith('conditioning_')),
    mon.addOnTopCategories);
  const rest = listPlanChangeOptionsForDay({ visibleWeek: week, date: SAT, todayISO: TODAY });
  eq('[13] rest day has no add-on-top (normal add flow instead)',
    rest.addOnTopCategories.length, 0);

  // Stack a light conditioning session onto Monday's Lower Body Strength.
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const result = applyPlanChange({
    change: { kind: 'add_category', date: MON, category: 'conditioning_light' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[13] stack applies', result.ok, result);
  eq('[13] one write', writes.length, 1);
  const stacked = writes[0]?.workout;
  eq('[13] strength rows preserved', stacked?.exercises?.filter(
    (row: any) => !String(row.id).startsWith('template:')).length, 2);
  ok('[13] template row appended',
    (stacked?.exercises ?? []).some((row: any) => String(row.id).startsWith('template:')),
    stacked?.exercises?.map((row: any) => row.id));
  ok('[13] combined-day structures attached',
    !!stacked?.conditioningBlock && stacked?.hasCombinedConditioning === true,
    { block: !!stacked?.conditioningBlock, combined: stacked?.hasCombinedConditioning });
  ok('[13] day keeps its strength identity', stacked?.name === 'Lower Body Strength',
    stacked?.name);
  ok('[13] done message names the pick', /Done\./.test(result.message), result.message);

  // A day that already has conditioning refuses a second block.
  const scDay: Workout = {
    ...strengthWorkout('workout-sc', 'Upper Pull', 2),
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: 'Aerobic Base', description: '', exerciseIds: ['sc2-cond'] }],
    },
    exercises: [ex('Back Squat', 'sc2-squat', 4), ex('Bike Easy', 'sc2-cond', 1)],
  } as Workout;
  const scWeek = [...week];
  scWeek[1] = visibleDay('2026-06-30', scDay);
  const already = applyPlanChange({
    change: { kind: 'add_category', date: '2026-06-30', category: 'conditioning_light' },
    visibleWeek: scWeek,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[13] second conditioning block refused', !already.ok, already);

  // Recovery never stacks onto an occupied day.
  const recoveryStack = applyPlanChange({
    change: { kind: 'add_category', date: MON, category: 'recovery' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[13] recovery stack refused', !recoveryStack.ok, recoveryStack);
}

{
  console.log('\n[14] strength swaps via the engine: buckets, variety, round-trip');
  const week = bothWeeks();

  // All strength buckets + accessories are offered.
  const options = listPlanChangeOptionsForDay({ visibleWeek: week, date: THU, todayISO: TODAY });
  ok('[14] strength buckets offered',
    ['strength_upper', 'strength_lower', 'strength_full', 'accessories'].every((id) =>
      options.categories.some((c) => c.id === id)),
    options.categories.map((c) => c.id));

  // "Upper body" picks what the week needs: THU already holds Upper Push,
  // so the pick MUST be Upper Pull... but MON holds Lower Body Strength
  // too — variety avoids both.
  const upperPick = pickTemplateForCategory({
    category: 'strength_upper', date: SAT, visibleWeek: week,
  });
  eq('[14] upper pick avoids the split already on the week',
    upperPick?.templateId, 'strength_upper_pull');

  // Deterministic engine build: same date + context → same session.
  const pickA = pickTemplateForCategory({ category: 'accessories', date: SAT, visibleWeek: week });
  const pickB = pickTemplateForCategory({ category: 'accessories', date: SAT, visibleWeek: week });
  eq('[14] accessory pick deterministic', pickA?.templateId, pickB?.templateId);

  // Swap THU's Upper Push for a lower-body engine session, end to end.
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const result = applyPlanChange({
    change: { kind: 'swap_category', date: THU, category: 'strength_lower' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[14] engine strength swap applies', result.ok, result);
  const written = writes[0]?.workout;
  eq('[14] written session is the engine build', written?.name, 'Lower Body Strength');
  eq('[14] written type is Strength', written?.workoutType, 'Strength');
  ok('[14] engine produced real exercises',
    (written?.exercises?.length ?? 0) >= 4, written?.exercises?.length);
  ok('[14] rows are registry-owned',
    (written?.exercises ?? []).every((row: any) =>
      String(row.id).startsWith('template:strength_lower:')),
    written?.exercises?.map((row: any) => row.id));
  ok('[14] exercise identity preserved for overrides/videos',
    (written?.exercises ?? []).every((row: any) =>
      row.exerciseId && !String(row.exerciseId).startsWith('template:')),
    written?.exercises?.map((row: any) => row.exerciseId));

  // Accessories end to end on a rest day (add).
  const accWrites: Array<{ date: string; workout: Workout | null }> = [];
  const accResult = applyPlanChange({
    change: { kind: 'add_category', date: SAT, category: 'accessories' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => accWrites.push({ date, workout }),
  });
  ok('[14] accessory add applies', accResult.ok, accResult);
  ok('[14] accessory session has content',
    (accWrites[0]?.workout?.exercises?.length ?? 0) >= 2,
    accWrites[0]?.workout?.exercises?.length);

  // Strength never stacks onto an occupied day (yet).
  const stack = applyPlanChange({
    change: { kind: 'add_category', date: MON, category: 'strength_upper' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[14] strength stack refused', !stack.ok, stack);
}

{
  console.log('\n[15] shutdown_week (bed-ridden): clears today onward, games untouched');
  const week = bothWeeks();

  // Current week (TODAY = Wed): MON is history, THU is the only future
  // session → exactly one write, and it becomes rest.
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const result = applyPlanChange({
    change: { kind: 'shutdown_week', date: TODAY },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[15] shutdown applies', result.ok, result);
  eq('[15] only the future session cleared', writes.map((w) => w.date), [THU]);
  eq('[15] cleared day becomes rest', writes[0]?.workout?.workoutType, 'Rest');
  ok('[15] message says rest up', /rest up/i.test(result.message), result.message);

  // Next week (game week): Upper Pull cleared, the GAME survives.
  const gameWeekWrites: Array<{ date: string; workout: Workout | null }> = [];
  const gameWeekResult = applyPlanChange({
    change: { kind: 'shutdown_week', date: '2026-07-06' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => gameWeekWrites.push({ date, workout }),
  });
  ok('[15] next-week shutdown applies', gameWeekResult.ok, gameWeekResult);
  eq('[15] only the training session cleared', gameWeekWrites.map((w) => w.date), ['2026-07-07']);
  ok('[15] game day untouched',
    gameWeekWrites.every((w) => w.date !== NEXT_SAT), gameWeekWrites);

  // Nothing to clear refuses cleanly.
  const emptyWeek: ResolvedDay[] = [
    visibleDay(TODAY, null),
    visibleDay(THU, null),
    visibleDay(SAT, null),
  ];
  const nothing = applyPlanChange({
    change: { kind: 'shutdown_week', date: TODAY },
    visibleWeek: emptyWeek,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[15] nothing to clear refuses', !nothing.ok, nothing);
}

console.log(`\nplanChangeProducerTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
