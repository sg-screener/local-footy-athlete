/**
 * Typed ProgramEdit ownership of committed reply category.
 * Run: npm run test:coach-committed-program-edit-reply
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { ResolvedDay } from '../utils/sessionResolver';
import type { ProgramEdit } from '../utils/coachProgramEdit';
import {
  composeCommittedProgramEditReply,
  verifyProgramEditSemanticIntent,
} from '../utils/coachTurnController';
import {
  buildSemanticProgramSnapshot,
  diffSemanticPrograms,
  type SemanticProgramDiff,
} from '../utils/programSemanticSnapshot';

const SOURCE_DATE = '2026-07-20';
const DESTINATION_DATE = '2026-07-21';
let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  fail += 1;
  failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  console.error(`  FAIL ${name}`, detail ?? '');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function exercise(args: {
  id: string;
  name: string;
  order: number;
  conditioning?: boolean;
}): any {
  return {
    id: args.id,
    workoutId: 'typed-reply-workout',
    exerciseId: args.id,
    exerciseOrder: args.order,
    prescribedSets: args.conditioning ? 6 : 3,
    prescribedRepsMin: args.conditioning ? 18 : 5,
    prescribedRepsMax: args.conditioning ? 18 : 8,
    prescribedWeightKg: args.conditioning ? null : 80,
    restSeconds: args.conditioning ? 60 : 120,
    prescriptionType: args.conditioning ? 'duration_minutes' : 'reps',
    intensity: args.conditioning ? 'Hard' : 'Moderate',
    exercise: {
      id: args.id,
      name: args.name,
      description: args.name,
      equipmentRequired: [args.conditioning ? 'Assault Bike' : 'Barbell'],
    },
    createdAt: '',
    updatedAt: '',
  };
}

function mixedWorkout(): any {
  return {
    id: 'typed-reply-workout',
    planEntryId: 'typed-reply-plan-entry',
    microcycleId: 'typed-reply-week',
    dayOfWeek: 1,
    name: 'Lower Body Strength',
    description: 'Strength with assault bike conditioning',
    durationMinutes: 60,
    intensity: 'Moderate',
    strengthIntensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    strengthIntent: 'lower_body',
    strengthPatternContributions: ['squat'],
    conditioningBlock: {
      intent: 'high-intensity',
      attachedKind: 'post_strength',
      options: [{
        title: 'Assault Bike Sprints',
        description: '6 x 30 sec hard',
        exerciseIds: ['assault-bike'],
        durationMinutes: 18,
        intensity: 'Hard',
      }],
    },
    exercises: [
      exercise({ id: 'back-squat', name: 'Back Squat', order: 0 }),
      exercise({ id: 'assault-bike', name: 'Assault Bike Sprints', order: 4, conditioning: true }),
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function strengthOnly(): any {
  const value = mixedWorkout();
  value.conditioningBlock = undefined;
  value.exercises = value.exercises.filter((row: any) => row.id === 'back-squat');
  return value;
}

function conditioningOnly(): any {
  const value = mixedWorkout();
  value.name = 'Assault Bike Sprints';
  value.workoutType = 'Conditioning';
  value.strengthIntensity = undefined;
  value.strengthIntent = undefined;
  value.strengthPatternContributions = undefined;
  value.exercises = value.exercises.filter((row: any) => row.id === 'assault-bike');
  return value;
}

function resolvedDay(date: string, workout: any | null): ResolvedDay {
  return {
    date,
    dayOfWeek: date === SOURCE_DATE ? 1 : 2,
    short: date === SOURCE_DATE ? 'MON' : 'TUE',
    isToday: false,
    workout,
    source: workout ? 'manual' : 'rest',
    indicator: null,
  } as any;
}

function diff(
  before: Array<[string, any | null]>,
  after: Array<[string, any | null]>,
): SemanticProgramDiff {
  return diffSemanticPrograms(
    buildSemanticProgramSnapshot(before.map(([date, workout]) => resolvedDay(date, workout))),
    buildSemanticProgramSnapshot(after.map(([date, workout]) => resolvedDay(date, workout))),
  );
}

function edit(args: {
  intent: 'remove' | 'add' | 'replace' | 'move' | 'edit';
  targetDomain: 'strength' | 'conditioning' | 'session' | 'schedule';
  requestedChange?: 'duration' | 'intensity' | 'exercise' | 'day' | 'volume' | 'type';
  editScope?: string;
  protectedDomain?: 'strength' | 'conditioning';
  targetItemId?: string;
  move?: boolean;
}): ProgramEdit {
  return {
    intent: args.intent,
    targetDomain: args.targetDomain,
    targetDate: SOURCE_DATE,
    targetSessionId: 'typed-reply-plan-entry',
    targetItemId: args.targetItemId ?? null,
    requestedChange: args.requestedChange ?? 'unknown',
    newValue: null,
    missingFields: [],
    confidence: 1,
    naturalLanguageReason: 'typed reply ownership test',
    editScope: args.editScope,
    protectedTargets: args.protectedDomain
      ? [{
          targetDomain: args.protectedDomain,
          targetDate: SOURCE_DATE,
          reason: `protect_${args.protectedDomain}`,
        }]
      : [],
    command: args.move
      ? {
          mode: 'mutate',
          operation: 'move_session',
          target: { kind: 'date', date: SOURCE_DATE },
          payload: { operation: 'move_session', toDate: DESTINATION_DATE },
          scope: 'one_off',
          confidence: 1,
          needsClarification: false,
          reason: 'move test',
        }
      : null,
  } as any;
}

function accepted(name: string, value: ProgramEdit, semanticDiff: SemanticProgramDiff): void {
  const verification = verifyProgramEditSemanticIntent(value, null, semanticDiff);
  check(`${name} durable diff confirms typed intent`, verification.ok, verification);
}

console.log('\n[1] structural replies outrank collateral null dose fields');
{
  const semanticDiff = diff(
    [[SOURCE_DATE, mixedWorkout()]],
    [[SOURCE_DATE, conditioningOnly()]],
  );
  const value = edit({
    intent: 'remove',
    targetDomain: 'strength',
    requestedChange: 'volume',
    editScope: 'remove_strength_block',
    protectedDomain: 'conditioning',
  });
  accepted('strength removal', value, semanticDiff);
  check('strength removal owns reply despite null intensity/sets/reps/load',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I removed the strength work on 2026-07-20 and left the conditioning alone.');
  const existingExecutorReply =
    'Done. I removed the strength work on Mon 2026-07-20 and left conditioning alone.';
  check('verified structural reply preserves the existing executor wording exactly',
    composeCommittedProgramEditReply(value, semanticDiff, existingExecutorReply) ===
      existingExecutorReply);
}
{
  const semanticDiff = diff(
    [[SOURCE_DATE, mixedWorkout()]],
    [[SOURCE_DATE, strengthOnly()]],
  );
  const value = edit({
    intent: 'remove',
    targetDomain: 'conditioning',
    requestedChange: 'type',
    editScope: 'remove_conditioning_item',
    protectedDomain: 'strength',
  });
  accepted('conditioning removal', value, semanticDiff);
  check('conditioning removal owns reply despite null duration/intensity/prescription',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I removed the conditioning on 2026-07-20 and left the strength work alone.');
}
{
  const semanticDiff = diff(
    [[SOURCE_DATE, mixedWorkout()]],
    [[SOURCE_DATE, null]],
  );
  const value = edit({
    intent: 'remove',
    targetDomain: 'session',
    requestedChange: 'day',
    editScope: 'remove_whole_session',
  });
  accepted('whole-session removal', value, semanticDiff);
  check('whole-session removal owns reply',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I removed the session on 2026-07-20.');
}

console.log('\n[2] replace, move and add remain structurally owned');
{
  const before = mixedWorkout();
  const after = clone(before);
  after.exercises[0].id = 'front-squat';
  after.exercises[0].exerciseId = 'front-squat';
  after.exercises[0].exercise.id = 'front-squat';
  after.exercises[0].exercise.name = 'Front Squat';
  const semanticDiff = diff([[SOURCE_DATE, before]], [[SOURCE_DATE, after]]);
  const value = edit({ intent: 'replace', targetDomain: 'strength', requestedChange: 'exercise' });
  accepted('exercise replacement', value, semanticDiff);
  check('exercise replacement owns reply',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I replaced the strength work on 2026-07-20.');
}
{
  const before = strengthOnly();
  before.exercises.push(exercise({ id: 'romanian-deadlift', name: 'Romanian Deadlift', order: 1 }));
  const after = clone(before);
  after.exercises = after.exercises.filter((row: any) => row.id !== 'romanian-deadlift');
  const semanticDiff = diff([[SOURCE_DATE, before]], [[SOURCE_DATE, after]]);
  const value = edit({
    intent: 'remove',
    targetDomain: 'strength',
    requestedChange: 'exercise',
    targetItemId: 'romanian-deadlift',
  });
  accepted('exercise removal inside a retained component', value, semanticDiff);
  check('exercise removal remains structurally owned',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I removed the strength work on 2026-07-20.');
}
{
  const semanticDiff = diff(
    [[SOURCE_DATE, mixedWorkout()], [DESTINATION_DATE, null]],
    [[SOURCE_DATE, null], [DESTINATION_DATE, mixedWorkout()]],
  );
  const value = edit({
    intent: 'move',
    targetDomain: 'schedule',
    requestedChange: 'day',
    move: true,
  });
  accepted('session/component move', value, semanticDiff);
  check('move owns reply',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I moved the accepted session across 2026-07-20 and 2026-07-21.');
}
{
  const semanticDiff = diff(
    [[SOURCE_DATE, strengthOnly()]],
    [[SOURCE_DATE, mixedWorkout()]],
  );
  const value = edit({
    intent: 'add',
    targetDomain: 'conditioning',
    requestedChange: 'type',
    editScope: 'add_conditioning_item',
  });
  accepted('structural add', value, semanticDiff);
  check('structural add owns reply',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I added the conditioning on 2026-07-20.');
}

console.log('\n[3] genuine dose-only edits retain existing dose replies');
{
  const before = mixedWorkout();
  const after = clone(before);
  after.durationMinutes = 55;
  after.conditioningBlock.options[0].durationMinutes = 13;
  after.exercises[1].prescribedRepsMin = 13;
  after.exercises[1].prescribedRepsMax = 13;
  const semanticDiff = diff([[SOURCE_DATE, before]], [[SOURCE_DATE, after]]);
  const value = edit({
    intent: 'edit',
    targetDomain: 'conditioning',
    requestedChange: 'duration',
    editScope: 'duration_only',
  });
  accepted('duration-only edit', value, semanticDiff);
  check('duration-only edit uses existing dose reply',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I updated duration from 18 to 13 on 2026-07-20.',
    composeCommittedProgramEditReply(value, semanticDiff));
}
{
  const before = mixedWorkout();
  const after = clone(before);
  after.intensity = 'Light';
  after.conditioningBlock.options[0].intensity = 'Light';
  after.exercises[1].intensity = 'Light';
  const semanticDiff = diff([[SOURCE_DATE, before]], [[SOURCE_DATE, after]]);
  const value = edit({
    intent: 'edit',
    targetDomain: 'conditioning',
    requestedChange: 'intensity',
    editScope: 'intensity_only',
  });
  accepted('intensity-only edit', value, semanticDiff);
  check('intensity-only edit uses existing dose reply',
    composeCommittedProgramEditReply(value, semanticDiff) ===
      'Done. I updated intensity from Hard to Light on 2026-07-20.',
    composeCommittedProgramEditReply(value, semanticDiff));
}

console.log('\n[4] structural contradiction fails before success composition');
{
  const before = mixedWorkout();
  const after = clone(before);
  after.conditioningBlock.options[0].durationMinutes = 12;
  after.exercises[1].prescribedRepsMin = 12;
  after.exercises[1].prescribedRepsMax = 12;
  const semanticDiff = diff([[SOURCE_DATE, before]], [[SOURCE_DATE, after]]);
  const value = edit({
    intent: 'remove',
    targetDomain: 'strength',
    requestedChange: 'volume',
    editScope: 'remove_strength_block',
  });
  const verification = verifyProgramEditSemanticIntent(value, null, semanticDiff);
  check('contradicted structural intent fails closed',
    !verification.ok &&
      verification.reason === 'structural_remove_contradicted_by_durable_diff',
    verification);
  const publishedReply = verification.ok
    ? composeCommittedProgramEditReply(value, semanticDiff)
    : "I couldn't safely apply that change, so I left the plan unchanged.";
  check('contradicted structural intent cannot publish Done', !/^Done\b/.test(publishedReply));
}

console.log(`\ncoachCommittedProgramEditReplyTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
