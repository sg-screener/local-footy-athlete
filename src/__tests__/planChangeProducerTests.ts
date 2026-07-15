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
  previewPlanChangeRisk,
  type PlanChange,
} from '../utils/planChangeProducer';
import { createStrengthIntent } from '../rules/strengthPatternContributions';
import type { AthleteSessionDeletionTransactionInput } from '../store/acceptedStateTransaction';

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
  const isPush = /upper push/i.test(name);
  const isPull = /upper pull/i.test(name);
  const patterns = isPush ? ['push'] as const : isPull ? ['pull'] as const : ['squat', 'hinge'] as const;
  const rows = isPush
    ? [ex('Bench Press', `${id}-push`, 3), ex('Tricep Pushdown', `${id}-tricep`, 2)]
    : isPull
      ? [ex('Pull Up', `${id}-pull`, 3), ex('Chest Supported Row', `${id}-row`, 3)]
      : [ex('Back Squat', `${id}-squat`, 4), ex('Romanian Deadlift', `${id}-hinge`, 2)];
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
    strengthIntent: createStrengthIntent({
      archetype: isPush || isPull ? 'upper' : 'lower',
      primaryPattern: patterns[0],
      plannedPatterns: patterns,
    }),
    exercises: rows,
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

function conditioningWorkout(id: string, name: string, dayOfWeek: number): Workout {
  const row = {
    ...ex(name, `${id}-cond`, 1),
    exercise: {
      ...ex(name, `${id}-cond`, 1).exercise,
      exerciseType: 'Conditioning',
    },
  };
  return {
    id,
    microcycleId: 'mc',
    dayOfWeek,
    name,
    description: '',
    durationMinutes: 25,
    intensity: 'Light',
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    hasCombinedConditioning: false,
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: name, description: '', exerciseIds: [`${id}-cond`] }],
    },
    exercises: [row],
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

function gameWorkout(dayOfWeek: number): Workout {
  return {
    ...strengthWorkout('workout-game', 'Game Day', dayOfWeek),
    workoutType: 'Game',
    strengthIntent: undefined,
    exercises: [],
  } as Workout;
}

function practiceMatchWorkout(dayOfWeek: number): Workout {
  return {
    ...strengthWorkout('workout-practice-match', 'Practice Match', dayOfWeek),
    workoutType: 'Practice Match' as any,
    strengthIntent: undefined,
    exercises: [],
  } as Workout;
}

function teamStrengthWorkout(id: string, name: string, dayOfWeek: number): Workout {
  return {
    ...strengthWorkout(id, name, dayOfWeek),
    workoutType: 'Team Training',
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

function fourHardGameWeek(): ResolvedDay[] {
  return [
    visibleDay('2026-07-06', strengthWorkout('workout-mon-risk', 'Lower Body Strength', 1)),
    visibleDay('2026-07-07', teamStrengthWorkout('workout-tt-risk-1', 'Team Training', 2)),
    visibleDay('2026-07-08', null),
    visibleDay('2026-07-09', teamStrengthWorkout('workout-tt-risk-2', 'Team Training', 4)),
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
  ok('[7] written workout preserves the authoritative registry template identity',
    !!writes[0]?.workout?.exercises.some((row) =>
      row.id.startsWith('template:metcon_offlegs:')),
    writes[0]?.workout?.exercises.map((row) => row.id));
  ok('[7] done message names the date', /2026-07-04/.test(result.message), result.message);

  const move = applyPlanChangeMove(week);
  ok('[7] move applies atomically (one transaction)', move.transactions.length === 1, move.transactions);
  ok('[7] move ok', move.result.ok, move.result);
}

function applyPlanChangeMove(week: ResolvedDay[]) {
  const transactions: unknown[] = [];
  const result = applyPlanChange({
    change: { kind: 'move_session', fromDate: THU, toDate: SAT },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => {
      throw new Error('move must not use the single-date override writer');
    },
    commitAthleteMove: (input) => transactions.push(input),
  });
  return { transactions, result };
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
  console.log('\n[9] day-level and exercise-level change doors stay separated (source contract)');
  // Systemic guard: the weekly board owns day/session changes through
  // PlanChangeSheet. The open workout owns exercise edits through its
  // local ExerciseEditSheet so session-detail taps never show move/bin
  // whole-session actions.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  const homeSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
    'utf8',
  );
  const dayWorkoutSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'),
    'utf8',
  );

  ok('[9] HomeScreenV2 keeps the weekly day-level PlanChangeSheet',
    /<PlanChangeSheet\b/.test(homeSrc)
      && homeSrc.includes('"make-change-link"')
      && homeSrc.includes('Want to change something?'));
  ok('[9] DayWorkoutScreenV2 removes the weekly PlanChangeSheet',
    !/<PlanChangeSheet\b/.test(dayWorkoutSrc)
      && !/Want to change something\?/.test(dayWorkoutSrc));
  ok('[9] DayWorkoutScreenV2 renders an exercise-level change door',
    dayWorkoutSrc.includes('"day-workout-make-change-link"')
      && dayWorkoutSrc.includes('Edit exercises')
      && /<ExerciseEditSheet\b/.test(dayWorkoutSrc));
  ok('[9] DayWorkoutScreenV2 exercise sheet has exercise-level actions only',
    dayWorkoutSrc.includes('Swap an exercise')
      && dayWorkoutSrc.includes('Add an exercise')
      && dayWorkoutSrc.includes('Remove an exercise')
      && dayWorkoutSrc.includes('Something hurts / no equipment')
      && !/Swap this session|Add to this day|Move this session|Bin this session/.test(dayWorkoutSrc));
  ok('[9] DayWorkoutScreenV2 offers per-exercise Change actions',
    /function ExerciseChangeAction/.test(dayWorkoutSrc)
      && /exerciseChangeText/.test(dayWorkoutSrc));
  ok('[9] session exercise edits use deterministic current-session executors',
    /executeProgramControlAction/.test(dayWorkoutSrc)
      && /type:\s*'swap_exercise'/.test(dayWorkoutSrc)
      && /type:\s*'remove_exercise'/.test(dayWorkoutSrc)
      && /type:\s*'add_exercise'/.test(dayWorkoutSrc)
      && /onApplySwapToday/.test(dayWorkoutSrc)
      && /onApplyAddToday/.test(dayWorkoutSrc));
  ok('[9] future-week exercise edits save active preferences instead of opening Coach',
    /saveFutureExerciseAdjustment/.test(dayWorkoutSrc)
      && /type:\s*'add_exercise_preference'/.test(dayWorkoutSrc)
      && /preferenceKind:\s*'avoid_exercise'/.test(dayWorkoutSrc)
      && /preferenceKind:\s*'preferred_alternative'/.test(dayWorkoutSrc)
      && /preferenceKind:\s*'add_focus'/.test(dayWorkoutSrc)
      && !/onFutureRemove/.test(dayWorkoutSrc)
      && !/askCoachForFutureRemove/.test(dayWorkoutSrc));
  ok('[9] Team Training entries are excluded from exercise-level edits',
    /filter\(\(exercise: any\) => !isTeamTrainingItem\(exercise\)\)/.test(dayWorkoutSrc)
      && /isTeamTrainingItem\(exercise\) \? undefined : \(\) => onChangeExercise\(exercise\)/.test(dayWorkoutSrc));
  ok('[9] Team Training-only detail does not expose a Coach-prefill edit menu',
    /date && !isTeamOnly && editableExercises\.length > 0/.test(dayWorkoutSrc)
      && !/team_menu|I can.t make team training|Tell coach about team training/.test(dayWorkoutSrc));
  ok('[9] Coach fallback is explicit from inside the exercise sheet',
    /kind: 'coach_fallback'/.test(dayWorkoutSrc)
      && /I need a bit more detail before changing this safely\./.test(dayWorkoutSrc)
      && /label="Message the coach"/.test(dayWorkoutSrc));
  ok('[9] tap exercise swaps use the Bible hierarchy adapter, not local regex tables',
    /getTapSwapChoices/.test(dayWorkoutSrc)
      && /resolveTapSwapEnvironment/.test(dayWorkoutSrc)
      && !/function suggestExerciseReplacement|function suggestExerciseForInjury|function nameMatches/.test(dayWorkoutSrc));
  ok('[9] injury/pain exercise edits open the guided injury flow',
    /<GuidedInjuryFlowSheet\b/.test(dayWorkoutSrc)
      && /reason === 'Injury \/ pain'[\s\S]*openExerciseInjuryFlow\(exercise\)/.test(dayWorkoutSrc)
      && /label="Something hurts"[\s\S]*onInjuryStart\(step\.exercise\)/.test(dayWorkoutSrc)
      && /type:\s*'set_injury_modifier'/.test(dayWorkoutSrc));

  const sheet = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'),
    'utf8',
  );
  const menuIdx = sheet.indexOf("step.kind === 'menu'");
  const editIdx = sheet.indexOf("step.kind === 'edit_session'");
  const categoryIdx = sheet.indexOf("step.kind === 'pick_category'");
  const destinationIdx = sheet.indexOf("step.kind === 'pick_destination'");
  const binScopeIdx = sheet.indexOf("step.kind === 'pick_bin_scope'");
  const wellbeingIdx = sheet.indexOf("step.kind === 'pick_wellbeing'");
  const askCoachIdx = sheet.indexOf('const askCoach = () =>');
  const confirmWarningIdx = sheet.indexOf("step.kind === 'confirm_warning'");
  const blockWarningIdx = sheet.indexOf("step.kind === 'block_warning'");
  const menuBlock = sheet.slice(menuIdx, editIdx);
  const editBlock = sheet.slice(editIdx, categoryIdx);
  const confirmWarningBlock = sheet.slice(confirmWarningIdx, blockWarningIdx);
  const blockWarningBlock = sheet.slice(blockWarningIdx, destinationIdx);

  ok('[9] PlanChangeSheet has an explicit edit_session step',
    /\| \{ kind: 'edit_session' \}/.test(sheet));
  ok('[9] occupied top menu enters Edit this session',
    /hasEditableSession \? \([\s\S]{0,220}label="Edit this session"[\s\S]{0,120}sub="Swap, add, move or remove this session"[\s\S]{0,140}setStep\(\{ kind: 'edit_session' \}\)/.test(menuBlock));
  ok('[9] occupied top menu no longer directly lists edit actions',
    !/label="Swap this session"|label="Add to this day"|label="Move this session"|label="Bin this session"/.test(menuBlock));
  ok('[9] rest/recovery top menu offers optional add instead of edit',
    /label="Add optional session"[\s\S]{0,120}sub="Add extra strength or conditioning work to this day"[\s\S]{0,180}startAdd\('menu'\)/.test(menuBlock)
      && /selectedWorkout\?\.workoutType === 'Recovery'/.test(sheet)
      && /selectedWorkout\?\.sessionTier === 'recovery'/.test(sheet));
  ok('[9] edit_session menu owns swap/add/move/bin options',
    /label="Swap this session"[\s\S]{0,80}Change to strength, conditioning or recovery/.test(editBlock)
      && /label="Add to this day"[\s\S]{0,100}Add extra strength or conditioning work to this day/.test(editBlock)
      && /label="Move this session"[\s\S]{0,80}Move it to another day or trade places/.test(editBlock)
      && /label="Bin this session"[\s\S]{0,80}Remove it - the day becomes rest/.test(editBlock));
  ok('[9] swap category no longer offers Rest day because bin owns rest',
    !/label="Rest day"|Clear the day - same as binning the session/.test(sheet)
      && /label="Bin this session"[\s\S]{0,80}Remove it - the day becomes rest/.test(editBlock));
  ok('[9] edit_session reuses existing swap/add/move/bin routes',
    /kind: 'pick_category', mode: 'swap', returnTo: 'edit_session'/.test(editBlock)
      && /startAdd\('edit_session'\)/.test(editBlock)
      && /kind: 'pick_destination'/.test(editBlock)
      && /onPress=\{startBin\}/.test(editBlock)
      && /apply\(\{ kind: 'move_session'/.test(sheet.slice(destinationIdx, binScopeIdx))
      && /apply\([\s\S]{0,80}\{ kind: 'remove_session'/.test(sheet));
  ok('[9] Add to this day opens an ADD menu with strength and conditioning',
    /\| \{ kind: 'pick_add_kind'; returnTo: StepBackTarget \}/.test(sheet)
      && /step\.kind === 'pick_add_kind'[\s\S]{0,120}<Text style=\{styles\.sectionLabel\}>ADD:<\/Text>/.test(sheet)
      && /label="Strength"[\s\S]{0,100}Upper, lower, full body or accessories/.test(sheet)
      && /label="Conditioning"[\s\S]{0,100}Light or hard - bike, row, ski or intervals/.test(sheet));
  ok('[9] ADD menu routes pickers with add intent and backs naturally',
    /chooseAddKind\('strength', step\.returnTo\)/.test(sheet)
      && /chooseAddKind\('conditioning', step\.returnTo\)/.test(sheet)
      && /mode: 'add'/.test(sheet.slice(sheet.indexOf('const chooseAddKind')))
      && /pickerBackStep\(step\.mode, step\.returnTo\)/.test(sheet));
  ok('[9] add blockers explain max sessions and duplicate session types',
    /Please remove a session first/.test(sheet)
      && /This day already has 2 sessions\. Remove one before adding another\./.test(sheet)
      && /Already has strength work/.test(sheet)
      && /This day already includes a strength session\. Swap the current session or remove one before adding another\./.test(sheet)
      && /Already has conditioning work/.test(sheet)
      && /This day already includes conditioning\. Swap the current session or remove one before adding another\./.test(sheet));
  ok('[9] duplicate blockers route to existing swap/bin flows and back to ADD',
    /label="Swap this session"[\s\S]{0,160}kind: 'pick_category'[\s\S]{0,80}mode: 'swap'/.test(sheet.slice(sheet.indexOf("step.kind === 'add_blocked_duplicate'")))
      && /label="Remove a session"[\s\S]{0,80}onPress=\{startBin\}/.test(sheet.slice(sheet.indexOf("step.kind === 'add_blocked_duplicate'")))
      && /kind: 'pick_add_kind', returnTo: step\.returnTo/.test(sheet.slice(sheet.indexOf("step.kind === 'add_blocked_duplicate'"))));
  ok('[9] nested edit backs return to edit_session while wellbeing stays on menu path',
    /BackRow onPress=\{\(\) => setStep\(\{ kind: step\.returnTo \}\)\}/.test(sheet)
      && /BackRow onPress=\{\(\) => setStep\(\{ kind: 'edit_session' \}\)\}/.test(sheet.slice(destinationIdx))
      && /BackRow onPress=\{\(\) => setStep\(\{ kind: 'menu' \}\)\}/.test(sheet.slice(wellbeingIdx)));
  ok('[9] ask coach and wellbeing routes remain unchanged',
    /onAskCoach\(`About \$\{weekdayLabel\(date\)\}: `\)/.test(sheet.slice(askCoachIdx, wellbeingIdx))
      && /label="I'm not 100%"[\s\S]{0,140}setStep\(\{ kind: 'pick_wellbeing' \}\)/.test(menuBlock)
      && /label="Something else - ask the coach"[\s\S]{0,120}onPress=\{askCoach\}/.test(menuBlock));
  ok('[9] PlanChangeSheet previews risk before committing tap edits',
    /previewPlanChangeRisk\(\{[\s\S]*change,[\s\S]*visibleWeek: weekDays[\s\S]*activeConstraints/.test(sheet)
      && sheet.indexOf('previewPlanChangeRisk') < sheet.indexOf('commitPlanChange(change'));
  ok('[9] PlanChangeSheet no longer imports legacy category-only warnings',
    !/planChangeWarningForCategory/.test(sheet));
  ok('[9] confirm warnings continue through the commit helper',
    /step\.kind === 'confirm_warning'[\s\S]*label="Continue"[\s\S]*commitPlanChange\([\s\S]{0,80}step\.change/.test(sheet));
  ok('[9] tap warning copy is readable and coach-like',
    /This gives you \$\{observed\} hard days this week\. That's the upper edge\./.test(sheet)
      && /This puts hard work one day before your game/.test(sheet)
      && !/program invalid/i.test(confirmWarningBlock));
  ok('[9] one risky tap edit renders one Continue and one Cancel action',
    (confirmWarningBlock.match(/label="Continue"/g) ?? []).length === 1
      && (confirmWarningBlock.match(/label="Cancel"/g) ?? []).length === 1);
  ok('[9] block warnings offer no override path',
    /label="OK"[\s\S]*setStep\(step\.backStep\)/.test(blockWarningBlock)
      && !/label="Continue"|commitPlanChange/.test(blockWarningBlock));
  ok('[9] tap hard-stop copy offers a safer next action',
    /Choose a lighter session or another day/.test(sheet)
      && /Use the team\/game controls to change that anchor/.test(sheet));
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
    visibleDay(MON, strengthWorkout('h1', 'MetCon - Off-Legs', 1)),
    visibleDay('2026-06-30', strengthWorkout('h2', 'Erg EMOM - 10-15 cal', 2)),
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
    'Flush Out - 30:30 Intervals', 'Flush Out - 1min On / 1min Off',
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
    'Flush Out - 2min On / 1min Off');

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
  const transactions: Array<import('../store/acceptedStateTransaction').AthleteSessionMoveTransactionInput> = [];
  const result = applyPlanChange({
    change: { kind: 'move_session', fromDate: THU, toDate: MON },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => {
      throw new Error('move must not use the single-date override writer');
    },
    commitAthleteMove: (input) => transactions.push(input),
  });
  ok('[11] swap applies', result.ok, result);
  eq('[11] exactly one accepted-state transaction', transactions.length, 1);
  ok('[11] transaction moves Upper Push to MON',
    /Upper Push/i.test(transactions[0]?.originalSourceWorkout.name ?? ''),
    transactions[0]?.originalSourceWorkout.name);
  ok('[11] transaction stages Lower Body Strength back onto THU',
    /Lower Body/i.test(transactions[0]?.existingTargetWorkout?.name ?? ''),
    transactions[0]?.existingTargetWorkout?.name);
  ok('[11] done message says swapped', /swapped/i.test(result.message), result.message);

  // Plain move to a rest day still works and still reads as a move.
  const moveTransactions: Array<import('../store/acceptedStateTransaction').AthleteSessionMoveTransactionInput> = [];
  const moveResult = applyPlanChange({
    change: { kind: 'move_session', fromDate: THU, toDate: SAT },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => {
      throw new Error('move must not use the single-date override writer');
    },
    commitAthleteMove: (input) => moveTransactions.push(input),
  });
  ok('[11] plain move applies', moveResult.ok, moveResult);
  ok('[11] plain move message unchanged', /moved to/i.test(moveResult.message), moveResult.message);
  ok('[11] plain move transaction owns an empty source destination swap',
    moveTransactions.length === 1 && moveTransactions[0].existingTargetWorkout === null,
    moveTransactions);

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
  const teamStrength = teamStrengthWorkout('workout-team-tue', 'Team Training + Upper Push', 2);

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
  eq('[12] team+strength day offers gym / team only',
    team.binScopes.map((s) => s.id).sort(), ['strength', 'team']);

  const sc = listPlanChangeOptionsForDay({ visibleWeek: week, date: TODAY, todayISO: TODAY });
  eq('[12] S+C day offers strength / conditioning / whole',
    sc.binScopes.map((s) => s.id).sort(), ['conditioning', 'strength', 'whole_day']);

  // Bin JUST team training: gym session survives under its own name.
  const teamWrites: AthleteSessionDeletionTransactionInput[] = [];
  const teamResult = applyPlanChange({
    change: { kind: 'remove_session', date: '2026-06-30', scope: 'team' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('removal must use the accepted-state owner'); },
    commitAthleteRemoval: (input) => teamWrites.push(input),
  });
  ok('[12] bin team-only applies', teamResult.ok, teamResult);
  eq('[12] one write', teamWrites.length, 1);
  ok('[12] survivor is the gym session',
    teamWrites[0]?.remainingWorkout?.name === 'Upper Push' &&
      !/team/i.test(teamWrites[0]?.remainingWorkout?.name ?? ''),
    teamWrites[0]?.remainingWorkout?.name);
  eq('[12] survivor type is Strength', teamWrites[0]?.remainingWorkout?.workoutType, 'Strength');
  eq('[12] strength rows preserved', teamWrites[0]?.remainingWorkout?.exercises?.length, 2);

  // Bin JUST the gym session: team training survives alone.
  const gymWrites: AthleteSessionDeletionTransactionInput[] = [];
  const gymResult = applyPlanChange({
    change: { kind: 'remove_session', date: '2026-06-30', scope: 'strength' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('removal must use the accepted-state owner'); },
    commitAthleteRemoval: (input) => gymWrites.push(input),
  });
  ok('[12] bin gym-only applies', gymResult.ok, gymResult);
  eq('[12] survivor is Team Training', gymWrites[0]?.remainingWorkout?.name, 'Team Training');
  eq('[12] no strength rows remain', gymWrites[0]?.remainingWorkout?.exercises?.length, 0);

  // Bin JUST the conditioning on an S+C day.
  const condWrites: AthleteSessionDeletionTransactionInput[] = [];
  const condResult = applyPlanChange({
    change: { kind: 'remove_session', date: TODAY, scope: 'conditioning' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('removal must use the accepted-state owner'); },
    commitAthleteRemoval: (input) => condWrites.push(input),
  });
  ok('[12] bin conditioning-only applies', condResult.ok, condResult);
  ok('[12] conditioning block gone',
    !condWrites[0]?.remainingWorkout?.conditioningBlock, condWrites[0]?.remainingWorkout);
  eq('[12] strength rows preserved on S+C day',
    condWrites[0]?.remainingWorkout?.exercises?.length, 2);

  // Bin JUST the strength on an S+C day: conditioning becomes the day.
  const strWrites: AthleteSessionDeletionTransactionInput[] = [];
  const strResult = applyPlanChange({
    change: { kind: 'remove_session', date: TODAY, scope: 'strength' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('removal must use the accepted-state owner'); },
    commitAthleteRemoval: (input) => strWrites.push(input),
  });
  ok('[12] bin strength-only applies', strResult.ok, strResult);
  eq('[12] conditioning survives as the day',
    strWrites[0]?.remainingWorkout?.workoutType, 'Conditioning');
  eq('[12] only the conditioning row remains',
    strWrites[0]?.remainingWorkout?.exercises?.length, 1);

  // Scope that isn't on the day refuses cleanly.
  const badResult = applyPlanChange({
    change: { kind: 'remove_session', date: MON, scope: 'team' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[12] scope not on day refuses without writing', !badResult.ok, badResult);

  // Whole-day default unchanged (back-compat: scope omitted).
  const wholeWrites: AthleteSessionDeletionTransactionInput[] = [];
  const wholeResult = applyPlanChange({
    change: { kind: 'remove_session', date: MON },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('removal must use the accepted-state owner'); },
    commitAthleteRemoval: (input) => wholeWrites.push(input),
  });
  ok('[12] whole-day bin still works', wholeResult.ok, wholeResult);
  eq('[12] whole-day commit owns a null remaining workout',
    wholeWrites[0]?.remainingWorkout, null);
  eq('[12] whole-day commit owns whole-session scope',
    wholeWrites[0]?.scope, 'whole_session');
}

{
  console.log('\n[13] add-on-top: strength and conditioning stack onto occupied days');
  const week = bothWeeks();

  // Strength day offers add-on-top conditioning, but not duplicate strength.
  const mon = listPlanChangeOptionsForDay({ visibleWeek: week, date: MON, todayISO: TODAY });
  ok('[13] strength day offers add-on-top conditioning',
    mon.addOnTopCategories.length > 0 &&
      mon.addOnTopCategories.every((c) => c.id.startsWith('conditioning_')),
    mon.addOnTopCategories);
  eq('[13] strength day reports one visible session',
    mon.visibleSessionKinds, ['strength']);
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

  // A conditioning-only day offers add-on-top strength, but not duplicate conditioning.
  const conditioningOnlyWeek = [...week];
  conditioningOnlyWeek[1] = visibleDay(
    '2026-06-30',
    conditioningWorkout('workout-cond-only', 'Easy Zone 2 Bike', 2),
  );
  const conditioningOptions = listPlanChangeOptionsForDay({
    visibleWeek: conditioningOnlyWeek,
    date: '2026-06-30',
    todayISO: TODAY,
  });
  ok('[13] conditioning day offers add-on-top strength',
    conditioningOptions.addOnTopCategories.length > 0 &&
      conditioningOptions.addOnTopCategories.every((c) =>
        c.id.startsWith('strength_') || c.id === 'accessories'),
    conditioningOptions.addOnTopCategories);
  eq('[13] conditioning day reports one visible session',
    conditioningOptions.visibleSessionKinds, ['conditioning']);
  const strengthWrites: Array<{ date: string; workout: Workout | null }> = [];
  const strengthAdd = applyPlanChange({
    change: { kind: 'add_category', date: '2026-06-30', category: 'strength_upper' },
    visibleWeek: conditioningOnlyWeek,
    todayISO: TODAY,
    setManualOverride: (date, workout) => strengthWrites.push({ date, workout }),
  });
  ok('[13] strength can stack onto conditioning when under the limit',
    strengthAdd.ok, strengthAdd);
  ok('[13] stacked strength rows materialize',
    (strengthWrites[0]?.workout?.exercises ?? []).some((row: any) =>
      String(row.id).startsWith('template:strength_')),
    strengthWrites[0]?.workout?.exercises?.map((row: any) => row.id));

  // Duplicate conditioning gets a specific refusal on a single conditioning day.
  const duplicateConditioning = applyPlanChange({
    change: { kind: 'add_category', date: '2026-06-30', category: 'conditioning_light' },
    visibleWeek: conditioningOnlyWeek,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[13] duplicate conditioning refused with specific reason',
    !duplicateConditioning.ok &&
      duplicateConditioning.message.includes('day_already_has_conditioning'),
    duplicateConditioning);

  // A day that already has two visible sessions refuses a third before duplicate details.
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
  const scOptions = listPlanChangeOptionsForDay({
    visibleWeek: scWeek,
    date: '2026-06-30',
    todayISO: TODAY,
  });
  eq('[13] two-session day reports two visible sessions',
    scOptions.visibleSessionKinds.sort(), ['conditioning', 'strength']);
  eq('[13] two-session day offers no add-on-top categories',
    scOptions.addOnTopCategories.length, 0);
  const already = applyPlanChange({
    change: { kind: 'add_category', date: '2026-06-30', category: 'conditioning_light' },
    visibleWeek: scWeek,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[13] direct call cannot create a third visible session',
    !already.ok && already.message.includes('max_sessions_exceeded'),
    already);

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

  // Duplicate strength never stacks onto an occupied strength day.
  const stack = applyPlanChange({
    change: { kind: 'add_category', date: MON, category: 'strength_upper' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[14] duplicate strength stack refused with specific reason',
    !stack.ok && stack.message.includes('day_already_has_strength'),
    stack);
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

{
  console.log('\n[16] clear_days (away): clears the chosen days only, games untouched');
  const week = bothWeeks();

  // Clear exactly THU (a real future session). Only that day is written,
  // and it becomes rest.
  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const result = applyPlanChange({
    change: { kind: 'clear_days', dates: [THU] },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[16] clear applies', result.ok, result);
  eq('[16] only the chosen day cleared', writes.map((w) => w.date), [THU]);
  eq('[16] cleared day becomes rest', writes[0]?.workout?.workoutType, 'Rest');

  // A game date in the chosen list is silently skipped (games are owned by
  // their own flow).
  const gameWrites: Array<{ date: string; workout: Workout | null }> = [];
  const gameResult = applyPlanChange({
    change: { kind: 'clear_days', dates: ['2026-07-07', NEXT_SAT] },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => gameWrites.push({ date, workout }),
  });
  ok('[16] mixed list applies', gameResult.ok, gameResult);
  ok('[16] game day never cleared', gameWrites.every((w) => w.date !== NEXT_SAT), gameWrites);

  // Nothing matching → clean refusal, no writes.
  const nothing = applyPlanChange({
    change: { kind: 'clear_days', dates: ['1999-01-01'] },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: () => { throw new Error('must not write'); },
  });
  ok('[16] no matching days refuses', !nothing.ok, nothing);
}

{
  console.log('\n[17] protected anchors in edit paths');
  const teamDate = '2026-06-30';
  const gameDate = '2026-07-04';
  const sourceDate = THU;
  const week: ResolvedDay[] = [
    visibleDay(MON, strengthWorkout('anchor-lower', 'Lower Body Strength', 1)),
    visibleDay(teamDate, teamStrengthWorkout('anchor-team', 'Team Training + Upper Push', 2)),
    visibleDay(TODAY, null),
    visibleDay(sourceDate, strengthWorkout('anchor-upper', 'Upper Push', 4)),
    visibleDay('2026-07-03', null),
    visibleDay(gameDate, practiceMatchWorkout(6)),
    visibleDay('2026-07-05', null),
  ];

  const teamOptions = listPlanChangeOptionsForDay({ visibleWeek: week, date: teamDate, todayISO: TODAY });
  eq('[17] team day is editable but offers no move destinations',
    teamOptions.moveDestinations.length, 0);
  eq('[17] team-only protected bin scopes omit whole-day',
    teamOptions.binScopes.map((s) => s.id).sort(), ['strength', 'team']);

  const practiceOptions = listPlanChangeOptionsForDay({ visibleWeek: week, date: gameDate, todayISO: TODAY });
  eq('[17] practice match day is game-locked', practiceOptions.locked, 'game_day');

  const teamSwap = buildPlanChangeProposal({
    kind: 'swap_template',
    date: teamDate,
    templateId: 'easy_zone2_bike',
  }, { visibleWeek: week });
  ok('[17] team-day swap builds a revision',
    !('error' in teamSwap) && teamSwap.kind === 'revision',
    teamSwap);
  if (!('error' in teamSwap) && teamSwap.kind === 'revision') {
    ok('[17] team-day swap protects the team section',
      teamSwap.userIntent.protectedRefs.length > 0,
      teamSwap.userIntent.protectedRefs);
    ok('[17] team-day swap preserves a visible team section',
      teamSwap.revisedDays[0].workout?.sections.some((section) =>
        section.kind === 'session' && /team training/i.test(section.title)),
      teamSwap.revisedDays[0].workout?.sections);
    eq('[17] team-day swap validates',
      validateProposal(teamSwap, week).status, 'valid');
  }

  const writes: Array<{ date: string; workout: Workout | null }> = [];
  const swapResult = applyPlanChange({
    change: { kind: 'swap_template', date: teamDate, templateId: 'easy_zone2_bike' },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => writes.push({ date, workout }),
  });
  ok('[17] team-day swap applies', swapResult.ok, swapResult);
  const projected = buildCoachRevisionWeekSnapshotFromProjectedDays([
    visibleDay(teamDate, writes[0]?.workout ?? null),
  ]).days[0];
  eq('[17] no duplicate team anchor after swap',
    (projected.workout?.sections ?? []).filter((section) =>
      section.kind === 'session' && /team training/i.test(section.title)).length,
    1);
  ok('[17] replacement content still appears next to team training',
    (projected.workout?.sections ?? []).some((section) => section.kind === 'conditioning'),
    projected.workout?.sections);

  const practiceSwap = buildPlanChangeProposal({
    kind: 'swap_template',
    date: gameDate,
    templateId: 'easy_zone2_bike',
  }, { visibleWeek: week });
  ok('[17] practice-match swap is refused',
    'error' in practiceSwap && practiceSwap.error === 'protected_anchor_day',
    practiceSwap);

  const gameWeek = [
    visibleDay(MON, strengthWorkout('game-source', 'Lower Body Strength', 1)),
    visibleDay(gameDate, gameWorkout(6)),
  ];
  const gameSwap = buildPlanChangeProposal({
    kind: 'swap_template',
    date: gameDate,
    templateId: 'easy_zone2_bike',
  }, { visibleWeek: gameWeek });
  ok('[17] game-day swap is refused',
    'error' in gameSwap && gameSwap.error === 'protected_anchor_day',
    gameSwap);

  const moveTeam = buildPlanChangeProposal({
    kind: 'move_session',
    fromDate: sourceDate,
    toDate: teamDate,
  }, { visibleWeek: week });
  ok('[17] move onto team training day is refused',
    'error' in moveTeam && moveTeam.error === 'protected_anchor_day',
    moveTeam);

  const movePractice = buildPlanChangeProposal({
    kind: 'move_session',
    fromDate: sourceDate,
    toDate: gameDate,
  }, { visibleWeek: week });
  ok('[17] move onto practice-match day is refused',
    'error' in movePractice && movePractice.error === 'protected_anchor_day',
    movePractice);

  const clearWrites: Array<{ date: string; workout: Workout | null }> = [];
  const clearResult = applyPlanChange({
    change: { kind: 'clear_days', dates: [teamDate, sourceDate, gameDate] },
    visibleWeek: week,
    todayISO: TODAY,
    setManualOverride: (date, workout) => clearWrites.push({ date, workout }),
  });
  ok('[17] clear_days skips anchors and clears normal sessions',
    clearResult.ok && clearWrites.map((write) => write.date).join(',') === sourceDate,
    { clearResult, clearWrites });
}

{
  console.log('\n[18] pre-commit risk preview for tap edits');

  const safeWeek = byeWeek();
  const safePreview = previewPlanChangeRisk({
    change: { kind: 'swap_category', date: THU, category: 'conditioning_light' },
    visibleWeek: safeWeek,
    todayISO: TODAY,
  });
  ok('[18] safe tap edit previews as allow',
    safePreview.ok && safePreview.assessment.decision === 'allow',
    safePreview.assessment);
  const safeWrites: Array<{ date: string; workout: Workout | null }> = [];
  const safeApply = applyPlanChange({
    change: { kind: 'swap_category', date: THU, category: 'conditioning_light' },
    visibleWeek: safeWeek,
    todayISO: TODAY,
    setManualOverride: (date, workout) => safeWrites.push({ date, workout }),
  });
  ok('[18] safe tap edit commits normally',
    safeApply.ok && safeWrites.length === 1 && safeWrites[0].date === THU,
    { safeApply, safeWrites });

  const gPlusOneWeek = gameWeek();
  const confirmPreview = previewPlanChangeRisk({
    change: { kind: 'add_category', date: '2026-07-12', category: 'conditioning_hard' },
    visibleWeek: gPlusOneWeek,
    todayISO: TODAY,
    profile: { seasonPhase: 'In-season' },
  });
  const confirmWrites: Array<{ date: string; workout: Workout | null }> = [];
  ok('[18] strong risk tap edit previews as confirm',
    confirmPreview.ok &&
      confirmPreview.assessment.decision === 'confirm' &&
      confirmPreview.assessment.findings.some((finding) => finding.ruleId === 'g_plus1_hard_work'),
    confirmPreview.assessment);
  ok('[18] preview does not call setManualOverride before confirmation',
    confirmWrites.length === 0,
    confirmWrites);
  const confirmedApply = applyPlanChange({
    change: { kind: 'add_category', date: '2026-07-12', category: 'conditioning_hard' },
    visibleWeek: gPlusOneWeek,
    todayISO: TODAY,
    setManualOverride: (date, workout) => confirmWrites.push({ date, workout }),
  });
  ok('[18] confirming applies the risky edit',
    confirmedApply.ok && confirmWrites.length === 1 && confirmWrites[0].date === '2026-07-12',
    { confirmedApply, confirmWrites });

  const cancelledWrites: Array<{ date: string; workout: Workout | null }> = [];
  previewPlanChangeRisk({
    change: { kind: 'add_category', date: '2026-07-12', category: 'conditioning_hard' },
    visibleWeek: gPlusOneWeek,
    todayISO: TODAY,
  });
  ok('[18] cancelling after preview leaves the plan untouched',
    cancelledWrites.length === 0,
    cancelledWrites);

  const gMinusOnePreview = previewPlanChangeRisk({
    change: { kind: 'add_category', date: '2026-07-10', category: 'strength_lower' },
    visibleWeek: gPlusOneWeek,
    todayISO: TODAY,
    profile: { seasonPhase: 'In-season' },
  });
  ok('[18] hard lower on G-1 blocks',
    gMinusOnePreview.ok &&
      gMinusOnePreview.assessment.decision === 'block' &&
      gMinusOnePreview.assessment.findings.some((finding) => finding.ruleId === 'g1_hard_work'),
    gMinusOnePreview.assessment);

  const fifthHardPreview = previewPlanChangeRisk({
    change: { kind: 'add_category', date: '2026-07-08', category: 'conditioning_hard' },
    visibleWeek: fourHardGameWeek(),
    todayISO: TODAY,
    profile: { seasonPhase: 'In-season' },
  });
  ok('[18] adding 5th hard day confirms, not blocks',
    fifthHardPreview.ok &&
      fifthHardPreview.assessment.decision === 'confirm' &&
      fifthHardPreview.assessment.findings.some((finding) => finding.ruleId === 'cap_maxHardDays_over') &&
      fifthHardPreview.assessment.highestLevel !== 'hard_stop',
    fifthHardPreview.assessment);

  const protectedPreview = previewPlanChangeRisk({
    change: { kind: 'remove_session', date: NEXT_SAT },
    visibleWeek: gPlusOneWeek,
    todayISO: TODAY,
  });
  ok('[18] deleting protected game anchor blocks',
    protectedPreview.ok &&
      protectedPreview.assessment.decision === 'block' &&
      protectedPreview.assessment.findings.some((finding) => finding.ruleId === 'protected_anchor_edit_blocked'),
    protectedPreview.assessment);
}

console.log(`\nplanChangeProducerTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
