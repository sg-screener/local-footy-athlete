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
  eq('[2] all 9 templates offered (bye week)', options.templates.length, 9);
  ok('[2] bye-only templates included',
    options.templates.some((t) => t.templateId === 'metcon_offlegs') &&
      options.templates.some((t) => t.templateId === 'erg_emom'),
    options.templates.map((t) => t.templateId));
  ok('[2] move destinations are rest days only',
    options.moveDestinations.length > 0 &&
      options.moveDestinations.every((date) => {
        const day = bothWeeks().find((d) => d.date === date);
        return day?.workout == null;
      }),
    options.moveDestinations);
}

{
  console.log('\n[3] athlete override: game-week days offer EVERYTHING too');
  const options = listPlanChangeOptionsForDay({
    visibleWeek: bothWeeks(),
    date: '2026-07-08',
    todayISO: TODAY,
  });
  eq('[3] unlocked', options.locked, null);
  eq('[3] all 9 templates offered on a game week', options.templates.length, 9);
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
      for (const toDate of options.moveDestinations) {
        const validation3 = validateProposal(
          build({ kind: 'move_session', fromDate: date, toDate }, week), week);
        eq(`[5] move ${date}→${toDate} validates`, validation3.status, 'valid');
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

  const bye = listPlanChangeOptionsForDay({ visibleWeek: week, date: THU, todayISO: TODAY });
  eq('[10] bye-week day offers all three categories',
    bye.categories.map((c) => c.id).sort(),
    ['conditioning_hard', 'conditioning_light', 'recovery']);

  const gameWeekDay = listPlanChangeOptionsForDay({
    visibleWeek: week, date: '2026-07-08', todayISO: TODAY,
  });
  eq('[10] game-week day offers all three categories too (athlete override)',
    gameWeekDay.categories.map((c) => c.id).sort(),
    ['conditioning_hard', 'conditioning_light', 'recovery']);

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

console.log(`\nplanChangeProducerTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
