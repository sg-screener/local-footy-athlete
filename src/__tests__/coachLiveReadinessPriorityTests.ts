/**
 * coachLiveReadinessPriorityTests — mirrors the CoachScreen send-order
 * contract for fatigue/readiness turns:
 *
 *   ProgramEdit / command priority first,
 *   readiness signal write only if ProgramEdit leaves the turn alone.
 *
 * Run: npm run test:coach-live-readiness-priority
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as any).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};

import {
  interpretCoachMessageToProgramEdit,
  type ProgramEdit,
} from '../utils/coachProgramEdit';
import { routeCoachReadinessMessage } from '../utils/coachReadinessAdapter';
import {
  extractVisibleProgramItemsFromWorkout,
} from '../utils/visibleProgramReadModel';
import {
  captureFromExecutorClarify,
  resolvePendingGameDayReadinessAnswer,
} from '../utils/coachClarifierResume';
import { checkInjuryClarificationGuard } from '../utils/injuryClarificationGuard';
import { extractBodyPart } from '../utils/injuryAdjustmentEngine';
import { buildReadinessSignalPatch } from '../utils/readiness';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useProgramStore } from '../store/programStore';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? `\n      ${JSON.stringify(detail)}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    { expected, actual },
  );
}

function section(label: string) {
  console.log(`\n${label}`);
}

const TODAY = '2026-06-02';
const WEDNESDAY = '2026-06-03';

function workout(name: string, exercises: string[], workoutType = 'Strength') {
  return {
    id: `workout-${name}`,
    name,
    workoutType,
    sessionTier: workoutType === 'Strength' ? 'core' : 'accessory',
    exercises: exercises.map((name, index) => ({
      id: `exercise-${index}-${name}`,
      exerciseId: `exercise-${index}-${name}`,
      exerciseOrder: index,
      prescribedSets: 3,
      prescribedRepsMin: 6,
      prescribedRepsMax: 8,
      restSeconds: 90,
      exercise: {
        id: `exercise-${index}-${name}`,
        name,
        description: name,
        exerciseType: workoutType,
        muscleGroups: [],
        equipmentRequired: [],
        difficultyLevel: 'Intermediate',
        createdAt: '',
        updatedAt: '',
      },
      createdAt: '',
      updatedAt: '',
    })),
    coachNotes: [],
    createdAt: '',
    updatedAt: '',
  } as any;
}

const todayGunshow = workout('Gunshow', [
  'Bench Press',
  'Chin-Up Negative (Slow)',
]);
const todayLower = workout('Lower Strength', [
  'Back Squat',
  'Romanian Deadlift',
]);
const todayConditioning = workout('Conditioning', [
  'Tempo Runs',
], 'Conditioning');
const tomorrowGame = workout('Game Day', [], 'Game');
const todayRecovery = workout('Recovery Session', [
  'Mobility Flow',
], 'Recovery');
const tomorrowRecovery = workout('Recovery Session', [
  'Mobility Flow',
], 'Recovery');
const wednesdayRower = workout('Easy Aerobic Flush', [
  'Rower Flush',
], 'Conditioning');

const visibleWeek = [
  {
    date: TODAY,
    sessionName: todayGunshow.name,
    workout: todayGunshow,
  },
  {
    date: WEDNESDAY,
    sessionName: wednesdayRower.name,
    workout: wednesdayRower,
  },
];

type TestVisibleWeek = typeof visibleWeek;

function weekWithTodayAndTomorrow(
  todayWorkout: any | null,
  tomorrowWorkout: any | null,
): TestVisibleWeek {
  return [
    {
      date: TODAY,
      sessionName: todayWorkout?.name ?? 'Rest',
      workout: todayWorkout,
    },
    {
      date: WEDNESDAY,
      sessionName: tomorrowWorkout?.name ?? 'Rest',
      workout: tomorrowWorkout,
    },
  ];
}

function reference(date: string, sessionName: string) {
  return {
    status: 'resolved',
    target: {
      kind: 'date',
      date,
      sessionName,
    },
    method: 'explicit_day',
    confidence: 0.9,
    mutationLike: true,
  } as any;
}

function referenceForMessage(message: string, week: TestVisibleWeek = visibleWeek) {
  if (/\b(?:w(?:ed|ednesday)|tomorrow)\b/i.test(message)) {
    const wednesday = week.find((day) => day.date === WEDNESDAY);
    return reference(WEDNESDAY, wednesday?.sessionName ?? wednesdayRower.name);
  }
  const today = week.find((day) => day.date === TODAY);
  return reference(TODAY, today?.sessionName ?? todayGunshow.name);
}

function resetStores() {
  useReadinessStore.getState().clear();
  useCoachMutationHistoryStore.getState().clearAll();
  useProgramStore.setState({
    dateOverrides: {},
    overrideContexts: {},
  } as any);
}

function isGenericReadinessWithoutInjuryTarget(message: string): boolean {
  if (extractBodyPart(message)) return false;
  if (/\b\d{1,2}\s*(?:\/\s*10|out\s+of\s+10)\b/i.test(message)) return false;
  if (/\b(?:pain|painful|hurt|hurts|hurting|injur(?:y|ed)|tweak(?:ed)?|strain(?:ed)?|pulled|pinged|pop|popped|snap|snapped|tear|tore)\b/i.test(message)) {
    return false;
  }
  return /\b(?:sore|soreness|tight|tightness|stiff|aching|ache|cooked|flat|exhausted|fatigued|drained|knackered|low\s+energy|no\s+energy)\b/i.test(message);
}

function livePriorityRoute(message: string, options: {
  visibleWeek?: TestVisibleWeek;
} = {}): {
  branch: 'injury_guard' | 'program_edit' | 'readiness' | 'pass';
  edit: ProgramEdit;
  reply: string;
} {
  resetStores();
  const routeWeek = options.visibleWeek ?? visibleWeek;
  const guard = checkInjuryClarificationGuard([{
    role: 'user',
    content: message,
  }]);
  if (guard.fired && !isGenericReadinessWithoutInjuryTarget(message)) {
    return {
      branch: 'injury_guard',
      edit: {} as ProgramEdit,
      reply: guard.reply ?? '',
    };
  }

  const edit = interpretCoachMessageToProgramEdit({
    userMessage: message,
    todayISO: TODAY,
    referenceResolution: referenceForMessage(message, routeWeek),
    currentWeek: routeWeek,
    resolveVisibleProgramForDate: (date) => {
      const found = routeWeek.find((day) => day.date === date);
      const items = extractVisibleProgramItemsFromWorkout(found?.workout ?? null);
      return {
        day: {
          date,
          dayOfWeek: date === WEDNESDAY ? 3 : 2,
          short: date === WEDNESDAY ? 'WED' : 'TUE',
          workout: found?.workout ?? null,
          source: found?.workout ? 'program' : 'rest',
          indicator: null,
        },
        items,
        conditioningItems: items.filter((item) =>
          item.domain === 'conditioning' || item.domain === 'recovery',
        ),
        strengthItems: items.filter((item) => item.domain === 'strength'),
      } as any;
    },
  });
  const command = edit.command as any;
  if (command?.mode === 'mutate' || command?.mode === 'clarify') {
    return {
      branch: 'program_edit',
      edit,
      reply: edit.question ?? command.question ?? command.clarificationQuestion ?? '',
    };
  }

  const readiness = routeCoachReadinessMessage({
    message,
    now: 1000,
  });
  if (readiness.kind === 'apply_signal') {
    useReadinessStore.getState().setReadinessSignal(TODAY, {
      ...readiness.signal,
      source: 'coach_message',
    });
    return {
      branch: 'readiness',
      edit,
      reply: readiness.reply,
    };
  }
  return {
    branch: 'pass',
    edit,
    reply: readiness.kind === 'clarify' ? readiness.reply : '',
  };
}

function assertNoReadinessOrMutation(label: string) {
  eq(
    `${label}: no readiness store write`,
    Object.keys(useReadinessStore.getState().signalsByDate).length,
    0,
  );
  eq(
    `${label}: no mutation history record`,
    useCoachMutationHistoryStore.getState().entries.length,
    0,
  );
  eq(
    `${label}: no program override write`,
    Object.keys(useProgramStore.getState().dateOverrides ?? {}).length,
    0,
  );
}

function assertNoProgramMutation(label: string) {
  eq(
    `${label}: no mutation history record`,
    useCoachMutationHistoryStore.getState().entries.length,
    0,
  );
  eq(
    `${label}: no program override write`,
    Object.keys(useProgramStore.getState().dateOverrides ?? {}).length,
    0,
  );
}

function answerGameDayPending(answer: string) {
  const routeWeek = weekWithTodayAndTomorrow(tomorrowGame, tomorrowRecovery);
  const initial = livePriorityRoute('My legs are cooked', {
    visibleWeek: routeWeek,
  });
  const captured = captureFromExecutorClarify({
    routedCommand: initial.edit.command as any,
    askedQuestion: initial.reply,
    originalMessage: 'My legs are cooked',
    todayISO: TODAY,
    referenceResolution: referenceForMessage('My legs are cooked', routeWeek),
    programEdit: initial.edit,
    candidateItems: initial.edit.candidateItems,
  });
  ok(`${answer}: game-day pending captured`, !!captured, captured);
  if (!captured) return null;
  const resolved = resolvePendingGameDayReadinessAnswer(captured as any, answer);
  if (resolved?.kind === 'mark_limited') {
    useReadinessStore.getState().setReadinessSignal(TODAY, {
      ...buildReadinessSignalPatch('flat'),
      source: 'coach_message',
    });
  }
  return resolved;
}

section('[1] bare fatigue/readiness goes to ProgramEdit clarify, not readiness mutation');
for (const phrase of ['My legs are cooked', 'legs cooked', "I'm sore", 'I feel flat']) {
  const out = livePriorityRoute(phrase);
  eq(`${phrase}: ProgramEdit wins`, out.branch, 'program_edit' as const);
  eq(`${phrase}: ask_question`, out.edit.intent, 'ask_question' as any);
  ok(
    `${phrase}: asks scope`,
    /strength|conditioning|whole session/i.test(out.reply) ||
      /strength|conditioning|whole session/i.test((out.edit.options ?? []).join(' ')),
    out,
  );
  ok(`${phrase}: reply is not Done`, !/\bdone\b/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation(phrase);
}

section('[2] bare lower fatigue clarification is situationally aware');
{
  const out = livePriorityRoute("I'm feeling cooked", {
    visibleWeek: weekWithTodayAndTomorrow(tomorrowGame, tomorrowRecovery),
  });
  const combined = `${out.reply} ${(out.edit.options ?? []).join(' ')}`;
  eq('Game Day + general cooked: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('Game Day + general cooked: ask_question', out.edit.intent, 'ask_question' as any);
  ok('Game Day + general cooked: names game day', /game day today/i.test(out.reply), out.reply);
  ok('Game Day + general cooked: asks game-day readiness', /generally flat|mark today as limited|adjust recovery/i.test(out.reply), out.reply);
  ok('Game Day + general cooked: no training edit options', !/\b(?:strength|conditioning|whole session)\b/i.test(combined), combined);
  assertNoReadinessOrMutation('Game Day + general cooked');
}

{
  const out = livePriorityRoute('My legs are cooked', {
    visibleWeek: weekWithTodayAndTomorrow(tomorrowGame, tomorrowRecovery),
  });
  const combined = `${out.reply} ${(out.edit.options ?? []).join(' ')}`;
  eq('Game Day + legs cooked: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('Game Day + legs cooked: ask_question', out.edit.intent, 'ask_question' as any);
  ok('Game Day + legs cooked: asks playing-readiness question', /okay to play|manage minutes\/intensity/i.test(out.reply), out.reply);
  ok('Game Day + legs cooked: offers game-day options', /leave the game as-is/i.test(combined) && /mark today as limited/i.test(combined) && /adjust tomorrow's recovery/i.test(combined), combined);
  ok('Game Day + legs cooked: no lower-body/conditioning edit options', !/\b(?:lower-body|conditioning|strength|whole session)\b/i.test(combined), combined);
  assertNoReadinessOrMutation('Game Day + legs cooked');
}

{
  const out = livePriorityRoute("legs cooked, adjust tomorrow's recovery", {
    visibleWeek: weekWithTodayAndTomorrow(tomorrowGame, tomorrowRecovery),
  });
  eq('Game Day explicit recovery adjust: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('Game Day explicit recovery adjust: asks for missing adjustment payload', out.edit.intent, 'ask_question' as any);
  eq('Game Day explicit recovery adjust: targets tomorrow', out.edit.targetDate, WEDNESDAY);
  ok('Game Day explicit recovery adjust: bypasses bare game-day copy', !/main question is whether you're okay to play/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation('Game Day explicit recovery adjust');
}

{
  const out = livePriorityRoute('legs cooked', {
    visibleWeek: weekWithTodayAndTomorrow(todayRecovery, wednesdayRower),
  });
  const combined = `${out.reply} ${(out.edit.options ?? []).join(' ')}`;
  eq('Recovery day + legs cooked: ProgramEdit wins', out.branch, 'program_edit' as const);
  ok('Recovery day + legs cooked: names recovery day', /already on a recovery day/i.test(out.reply), out.reply);
  ok('Recovery day + legs cooked: offers recovery-day choices', /keep recovery only/i.test(combined) && /mobility/i.test(combined) && /leave as-is/i.test(combined), combined);
  ok('Recovery day + legs cooked: no normal training edit options', !/\b(?:strength|conditioning|whole session)\b/i.test(combined), combined);
  assertNoReadinessOrMutation('Recovery day + legs cooked');
}

{
  const out = livePriorityRoute('My legs are cooked', {
    visibleWeek: weekWithTodayAndTomorrow(todayGunshow, tomorrowGame),
  });
  eq('Gunshow + game tomorrow: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('Gunshow + game tomorrow: ask_question', out.edit.intent, 'ask_question' as any);
  ok('Gunshow + game tomorrow: mentions game tomorrow', /game tomorrow/i.test(out.reply), out.reply);
  ok('Gunshow + game tomorrow: mentions Gunshow', /gunshow/i.test(out.reply), out.reply);
  ok('Gunshow + game tomorrow: offers upper pump only', /upper pump only/i.test(out.reply), out.reply);
  ok('Gunshow + game tomorrow: offers recovery or removal', /recovery\/mobility/i.test(out.reply) && /remove/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation('Gunshow + game tomorrow');
}

{
  const out = livePriorityRoute('My legs are cooked', {
    visibleWeek: weekWithTodayAndTomorrow(todayLower, tomorrowGame),
  });
  eq('Lower + game tomorrow: ProgramEdit wins', out.branch, 'program_edit' as const);
  ok('Lower + game tomorrow: avoids lower loading', /avoid lower-body loading/i.test(out.reply), out.reply);
  ok('Lower + game tomorrow: offers recovery, upper pump, removal', /recovery/i.test(out.reply) && /upper pump/i.test(out.reply) && /remove/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation('Lower + game tomorrow');
}

{
  const out = livePriorityRoute('My legs are cooked', {
    visibleWeek: weekWithTodayAndTomorrow(todayConditioning, tomorrowGame),
  });
  eq('Conditioning + game tomorrow: ProgramEdit wins', out.branch, 'program_edit' as const);
  ok('Conditioning + game tomorrow: avoids running/conditioning', /avoid extra running\/conditioning/i.test(out.reply), out.reply);
  ok('Conditioning + game tomorrow: offers remove or recovery', /remove conditioning/i.test(out.reply) && /recovery/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation('Conditioning + game tomorrow');
}

{
  const out = livePriorityRoute('My legs are cooked', {
    visibleWeek: weekWithTodayAndTomorrow(null, tomorrowGame),
  });
  eq('Rest + game tomorrow: ProgramEdit wins', out.branch, 'program_edit' as const);
  ok('Rest + game tomorrow: notes already resting', /already resting today/i.test(out.reply), out.reply);
  ok('Rest + game tomorrow: offers mobility or leave as-is', /recovery\/mobility/i.test(out.reply) && /leave the plan as-is/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation('Rest + game tomorrow');
}

{
  const out = livePriorityRoute('My legs are cooked', {
    visibleWeek: weekWithTodayAndTomorrow(todayLower, wednesdayRower),
  });
  eq('No game soon: ProgramEdit wins', out.branch, 'program_edit' as const);
  ok('No game soon: asks lower-body/conditioning/whole-session scope', /reduce lower-body work/i.test(out.reply) && /conditioning/i.test(out.reply) && /whole session/i.test(out.reply), out.reply);
  assertNoReadinessOrMutation('No game soon');
}

section('[3] game-day readiness pending answers resolve safely');
for (const phrase of [
  'Leave today as is, I will just see how I go',
  'keep it as is',
  "don't change anything",
  'no changes',
]) {
  const answer = answerGameDayPending(phrase);
  eq(`${phrase}: resolves to no-op acknowledgement`, answer?.kind, 'acknowledge_no_op' as any);
  ok(`${phrase}: short no-op reply`, /leave today as game day/i.test(answer?.reply ?? ''), answer);
  ok(`${phrase}: reply does not claim program changes`, !/program changes/i.test(answer?.reply ?? ''), answer);
  assertNoReadinessOrMutation(phrase);
}

{
  const answer = answerGameDayPending("adjust tomorrow's recovery");
  eq('adjust tomorrow recovery: asks recovery adjustment', answer?.kind, 'adjust_recovery' as any);
  ok('adjust tomorrow recovery: reply asks how', /how should i adjust tomorrow'?s recovery/i.test(answer?.reply ?? ''), answer);
  assertNoReadinessOrMutation('adjust tomorrow recovery');
}

{
  const answer = answerGameDayPending('mark today as limited');
  eq('mark limited: readiness path', answer?.kind, 'mark_limited' as any);
  ok('mark limited: no program changes copy', !/program changes/i.test(answer?.reply ?? ''), answer);
  eq(
    'mark limited: readiness store write',
    Object.keys(useReadinessStore.getState().signalsByDate).length,
    1,
  );
  assertNoProgramMutation('mark limited');
}

section('[4] fatigue context does not intercept explicit commands');
{
  const out = livePriorityRoute('legs cooked, remove Wednesday fully');
  eq('remove Wednesday: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('remove Wednesday: remove intent', out.edit.intent, 'remove' as any);
  eq('remove Wednesday: session domain', out.edit.targetDomain, 'session' as any);
  eq('remove Wednesday: whole-session scope', (out.edit as any).editScope, 'remove_whole_session');
  eq('remove Wednesday: target date', out.edit.targetDate, WEDNESDAY);
  assertNoReadinessOrMutation('remove Wednesday');
}

{
  const out = livePriorityRoute('legs cooked, ditch the rower on Wednesday');
  eq('ditch rower: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('ditch rower: remove intent', out.edit.intent, 'remove' as any);
  eq('ditch rower: conditioning domain', out.edit.targetDomain, 'conditioning' as any);
  eq('ditch rower: item scope', (out.edit as any).editScope, 'remove_conditioning_item');
  eq('ditch rower: target date', out.edit.targetDate, WEDNESDAY);
  assertNoReadinessOrMutation('ditch rower');
}

{
  const out = livePriorityRoute('legs cooked, make today easier');
  eq('make today easier: ProgramEdit wins', out.branch, 'program_edit' as const);
  eq('make today easier: ask_question', out.edit.intent, 'ask_question' as any);
  ok(
    'make today easier: asks scope',
    /strength|conditioning|whole session/i.test(out.reply) ||
      /strength|conditioning|whole session/i.test((out.edit.options ?? []).join(' ')),
    out,
  );
  assertNoReadinessOrMutation('make today easier');
}

console.log(`\n— Summary —\n  Pass: ${pass}\n  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
