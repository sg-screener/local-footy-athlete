import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachContextEntry } from '../store/coachContextStateStore';
import type { PendingScheduleTransaction } from '../store/pendingCoachClarifierStore';
import {
  referenceResolutionFromTargetFrame,
  resolveCoachTargetFrame,
  type CoachTargetFrame,
} from '../utils/coachTargetFrame';
import { routeCoachCommand } from '../utils/coachCommandRouter';
import { interpretCoachMessageToProgramEdit } from '../utils/coachProgramEdit';
import { buildCoachContextPacket } from '../utils/coachContextPacket';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    const extra = detail == null ? '' : `\n      ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
    failures.push(`${label}${extra}`);
    console.log(`  ✗ ${label}${extra}`);
  }
}

function eq<T>(label: string, actual: T, expected: T) {
  ok(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

const NOW = new Date('2026-06-22T10:00:00').getTime();
const MON = '2026-06-22';
const TUE = '2026-06-23';
const WED = '2026-06-24';
const THU = '2026-06-25';
const SAT = '2026-06-27';
const SUN = '2026-06-28';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isoDow(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

function ex(id: string, name: string): any {
  return {
    id,
    workoutId: 'wk',
    exerciseId: `ex-${id}`,
    exerciseOrder: 0,
    prescribedSets: 1,
    prescribedRepsMin: 25,
    prescribedRepsMax: 25,
    prescriptionType: 'duration_minutes',
    notes: name,
    exercise: {
      id: `ex-${id}`,
      name,
      description: name,
      exerciseType: 'Conditioning',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Beginner',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function conditioningWorkout(name: string, itemTitle = name): any {
  const row = ex(`${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-row`, itemTitle);
  return {
    id: `w-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    microcycleId: 'mc',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 25,
    intensity: 'Low',
    workoutType: 'Conditioning',
    sessionTier: 'recovery',
    exercises: [row],
    conditioningBlock: {
      intent: 'aerobic',
      options: [{
        title: itemTitle,
        description: itemTitle,
        exerciseIds: [row.id],
      }],
    },
    createdAt: '',
    updatedAt: '',
  };
}

function strengthWithConditioning(name: string, itemTitle: string): any {
  const strength = ex(`${name}-strength`, 'Bench Press');
  const cond = ex(`${name}-conditioning`, itemTitle);
  return {
    id: `w-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    microcycleId: 'mc',
    dayOfWeek: 3,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [strength, cond],
    conditioningBlock: {
      intent: 'aerobic',
      options: [{
        title: itemTitle,
        description: itemTitle,
        exerciseIds: [cond.id],
      }],
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workout(name: string, type = 'Strength'): any {
  return {
    id: `w-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    microcycleId: 'mc',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 45,
    intensity: 'Moderate',
    workoutType: type,
    sessionTier: type === 'Recovery' ? 'recovery' : 'core',
    exercises: [],
    createdAt: '',
    updatedAt: '',
  };
}

function day(date: string, wk: any | null): ResolvedDay {
  const dow = isoDow(date);
  return {
    date,
    dayOfWeek: dow,
    short: SHORT[dow],
    isToday: date === MON,
    workout: wk,
    source: 'generated',
  } as ResolvedDay;
}

function mutationTarget(date = MON, sessionName = 'Easy Aerobic Flush'): CoachContextEntry {
  return {
    date,
    sessionName,
    source: 'coach_mutation',
    updatedAt: NOW,
    modalities: ['conditioning'],
    newlyAdded: true,
    lastMutationType: 'add_session',
  };
}

function baseWeek(): ResolvedDay[] {
  return [
    day(MON, conditioningWorkout('Easy Aerobic Flush')),
    day(TUE, workout('Upper Pull')),
    day(WED, strengthWithConditioning('Upper Push', 'Rower Flush')),
    day(THU, workout('Lower Squat')),
    day(SAT, workout('Speed Session')),
    day(SUN, workout('Recovery Session', 'Recovery')),
  ];
}

function asFrame(message: string, overrides: Partial<Parameters<typeof resolveCoachTargetFrame>[0]> = {}) {
  return resolveCoachTargetFrame({
    userMessage: message,
    visibleWeek: baseWeek(),
    todayISO: MON,
    now: NOW,
    ...overrides,
  });
}

section('[1] Pending transaction target beats every other context');
{
  const pending: PendingScheduleTransaction = {
    kind: 'move_session_transaction',
    originalUserMessage: 'move Wednesday to Sunday',
    sourceDate: WED,
    sourceDay: 'Wednesday',
    sourceSessionSnapshot: { date: WED, day: 'Wednesday', sessionName: 'Upper Push' },
    targetDate: SUN,
    targetDay: 'Sunday',
    scope: 'one_off',
    missingFields: ['confirmation'],
    createdFromVisibleWeek: true,
    currentStep: 'confirm',
  };
  const frame = asFrame('yes do it', {
    pendingTransaction: pending,
    lastMutationTarget: mutationTarget(MON),
    openedSession: { ...mutationTarget(THU, 'Lower Squat'), source: 'day_workout' },
  });
  eq('pending target source wins', frame.targetSource, 'pending_transaction');
  eq('pending source date is retained', frame.resolvedTarget?.date, WED);
}

section('[2] Last verified mutation wins for referential follow-ups');
{
  const followUps = [
    'move it to tomorrow',
    'Actually can you move that conditioning to Sunday?',
    'push that to Sunday',
    'put the one you just added on Sunday',
  ];

  for (const message of followUps) {
    const frame = asFrame(message, {
      lastMutationTarget: mutationTarget(),
    });
    eq(`${message} → last mutation target source`, frame.targetSource, 'last_mutation');
    eq(`${message} → source date stays on added Monday session`, frame.resolvedTarget?.date, MON);
    eq(`${message} → explicit day is destination role`, frame.explicitDateRole, 'destination');
  }
}

section('[3] Explained conditioning item supports duration follow-ups');
{
  const frame = asFrame('make it longer', {
    explainedSession: {
      date: WED,
      sessionName: 'Upper Push',
      source: 'coach_explanation',
      updatedAt: NOW,
      modalities: ['rower', 'conditioning'],
    },
  });
  eq('explained source wins', frame.targetSource, 'explained_session');
  eq('single conditioning item selected', frame.resolvedTarget?.kind, 'conditioning_item');
  eq('conditioning item title retained', frame.resolvedTarget?.itemTitle, 'Rower Flush');
}

section('[4] Explicit weekdays can be source referents');
{
  const frame = asFrame('move Thursday to Saturday');
  eq('explicit weekday source', frame.targetSource, 'explicit_message');
  eq('Thursday is source', frame.resolvedTarget?.date, THU);
  eq('explicit date role is referent', frame.explicitDateRole, 'referent');
}

section('[5] Visible-week ambiguity returns options');
{
  const frame = asFrame('change the rower', {
    visibleWeek: [
      day(MON, conditioningWorkout('Easy Aerobic Flush', 'Rower Flush')),
      day(WED, conditioningWorkout('Tempo Flush', 'Rower Flush')),
    ],
  });
  eq('ambiguous source', frame.targetSource, 'ambiguous');
  ok('ambiguous has concrete options', frame.candidateOptions.length === 2, frame);
}

section('[6] Stale or invisible last mutation target does not guess');
{
  const frame = asFrame('move it to Sunday', {
    visibleWeek: [
      day(MON, workout('Rest', 'Recovery')),
      day(SUN, workout('Recovery Session', 'Recovery')),
    ],
    lastMutationTarget: mutationTarget(MON, 'Easy Aerobic Flush'),
  });
  eq('missing mutation source becomes ambiguous', frame.targetSource, 'ambiguous');
  ok('missing target field is set', frame.missingFields.includes('target'), frame);
}

section('[7] Router consumes target-frame projection');
{
  const frame = asFrame('move it to Sunday', {
    lastMutationTarget: mutationTarget(),
  });
  const referenceResolution = referenceResolutionFromTargetFrame(frame, 'move it to Sunday');
  const command = routeCoachCommand({
    userMessage: 'move it to Sunday',
    todayISO: MON,
    referenceResolution,
    currentWeek: baseWeek(),
  });
  ok('router emits move_session', command.mode === 'mutate' && command.operation === 'move_session', command);
  if (command.mode === 'mutate' && command.operation === 'move_session') {
    eq('router source comes from target frame', command.target.kind === 'date' ? command.target.date : null, MON);
    eq('router destination is Sunday', command.payload.operation === 'move_session' ? command.payload.toDate : null, SUN);
  }
}

section('[8] ProgramEdit refuses ambiguous target frame');
{
  const ambiguous: CoachTargetFrame = {
    resolvedTarget: null,
    confidence: 0,
    targetSource: 'ambiguous',
    missingFields: ['target'],
    candidateOptions: [
      { label: `${MON}: Easy Aerobic Flush`, date: MON, sessionName: 'Easy Aerobic Flush' },
      { label: `${WED}: Rower Flush`, date: WED, itemTitle: 'Rower Flush' },
    ],
    reason: 'visible_week_multiple_matches',
    explicitDateRole: 'none',
  };
  const edit = interpretCoachMessageToProgramEdit({
    userMessage: 'make it longer',
    todayISO: MON,
    referenceResolution: referenceResolutionFromTargetFrame(ambiguous, 'make it longer'),
    targetFrame: ambiguous,
    currentWeek: baseWeek(),
  });
  eq('ambiguous frame returns ask_question', edit.intent, 'ask_question');
  ok('ambiguous options preserved', (edit.options ?? []).length === 2, edit);
}

section('[9] Packet carries a target frame');
{
  const packet = buildCoachContextPacket({
    userMessage: 'what is today?',
    recentMessages: [],
    todayISO: MON,
  });
  ok('packet targetFrame exists', !!packet.targetFrame, packet.targetFrame);
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('Failures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
