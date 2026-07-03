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
  eq('[2] all 8 templates offered (bye week)', options.templates.length, 8);
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
  console.log('\n[3] options on a game-week day: hard templates hidden');
  const options = listPlanChangeOptionsForDay({
    visibleWeek: bothWeeks(),
    date: '2026-07-08',
    todayISO: TODAY,
  });
  eq('[3] unlocked', options.locked, null);
  eq('[3] only the 6 standard templates offered', options.templates.length, 6);
  ok('[3] no bye-only template leaks',
    options.templates.every((t) => !t.byeOnly),
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
  console.log('\n[6] policy still guards the door: illegal build is rejected');
  // Bypass the menu and try to force a bye-only template onto a game week.
  const week = bothWeeks();
  const forced = build(
    { kind: 'add_template', date: '2026-07-08', templateId: 'metcon_offlegs' },
    week);
  const validation = validateProposal(forced, week);
  eq('[6] validator rejects bye-only template on game week',
    validation.status, 'invalid');
  ok('[6] with the bye-week issue named',
    JSON.stringify(validation.issues ?? []).includes('template_bye_week_only'),
    validation.issues);
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

console.log(`\nplanChangeProducerTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
