import {
  coachCommandFromLLMIntent,
  shouldTryLLMCoachCommand,
} from '../utils/coachLLMCommandAdapter';
import type { CoachContextPacket, CoachIntent } from '../utils/coachIntent';
import type { CoachCommand } from '../utils/coachCommandRouter';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function packet(): CoachContextPacket {
  return {
    userMessage: 'Actually I want some hard hill running instead of Pilates today',
    recentMessages: [],
    activeInjury: null,
    activeConstraints: [],
    coachUpdate: null,
    currentWeek: [],
    nextWeek: [],
    todayISO: '2026-05-27',
    referenceResolution: {
      status: 'resolved',
      method: 'explicit_day',
      confidence: 0.95,
      target: {
        date: '2026-05-27',
        sessionName: 'Recovery Session',
        method: 'explicit_day',
      },
    },
  } as any;
}

function intent(payload: Record<string, unknown>, needsClarification = false): CoachIntent {
  return {
    intent: 'request_program_adjustment',
    confidence: 0.88,
    needsClarification,
    clarificationQuestion: needsClarification ? 'What should I add?' : undefined,
    payload,
    rationale: 'test',
  };
}

console.log('\ncoachLLMCommandAdapter');

const fallbackClarify: CoachCommand = {
  mode: 'clarify',
  question: 'What change would you like?',
  reason: 'mutation_like_no_payload',
};
ok('tries LLM when router only has a clarify question',
  shouldTryLLMCoachCommand(fallbackClarify, 'Actually I want a hard trail run instead of Pilates today'));
const lowConfidenceMutate: CoachCommand = {
  mode: 'mutate',
  operation: 'add_conditioning',
  target: { kind: 'unbound' },
  payload: { operation: 'add_conditioning', modality: null },
  scope: 'one_off',
  confidence: 0.5,
  needsClarification: true,
  reason: 'low_confidence_test',
};
ok('tries LLM when deterministic mutate still needs clarification',
  shouldTryLLMCoachCommand(lowConfidenceMutate, 'make them a little shorter'));
const localSprintDurationClarifier: CoachCommand = {
  mode: 'mutate',
  operation: 'add_conditioning',
  target: { kind: 'date', date: '2026-05-27', sessionName: 'Assault Bike Sprints' },
  payload: {
    operation: 'add_conditioning',
    modality: 'bike' as any,
    customActivity: 'Assault Bike Sprints',
    editMode: 'update_existing',
    editScope: 'edit_duration_only',
  },
  scope: 'one_off',
  confidence: 0.9,
  needsClarification: true,
  clarificationQuestion: 'Do you mean 30 minutes for the whole session, sprint efforts, or recovery?',
  missingFields: ['duration_scope'],
  reason: 'last_add_sprint_minute_duration_ambiguous',
};
ok('does not try LLM for local sprint duration-scope clarifier',
  !shouldTryLLMCoachCommand(localSprintDurationClarifier, 'Nah just make it 30 mins'));
ok('does not try LLM after ProgramEdit resolves the target item',
  !shouldTryLLMCoachCommand({
    ...localSprintDurationClarifier,
    reason: 'last_add_sprint_minute_duration_ambiguous:pending_target_item_resolved',
  }, 'Nah just make it 30 mins'));
const conversationFallback: CoachCommand = {
  mode: 'conversation',
  topic: 'general_program_question',
  target: { kind: 'unbound' },
  confidence: 0.4,
  reason: 'fallback_conversation',
};
ok('tries LLM when casual conditioning add fell to conversation',
  shouldTryLLMCoachCommand(conversationFallback, 'Can you chuck some HIIT rowing intervals on Tuesday'));

const replacement = coachCommandFromLLMIntent(intent({
  operation: 'replace_conditioning',
  activity: 'Hard Hill Running',
  replaceActivity: 'Pilates',
  targetDate: '2026-05-27',
  targetSessionName: 'Recovery Session',
  modality: 'run',
  intensity: 'hard',
  scope: 'one_off',
}), packet());
ok('LLM replacement intent becomes executable command',
  replacement.kind === 'command');
if (replacement.kind === 'command' && replacement.command.mode === 'mutate') {
  eq('replacement op maps to add_conditioning executor path',
    replacement.command.operation,
    'add_conditioning' as any);
  eq('replacement target date',
    replacement.command.target,
    { kind: 'date', date: '2026-05-27', sessionName: 'Recovery Session' } as any);
  eq('replacement preserves activity',
    (replacement.command.payload as any).customActivity,
    'Hard Hill Running');
  eq('replacement preserves old activity',
    (replacement.command.payload as any).replaceActivity,
    'Pilates');
}

const assault = coachCommandFromLLMIntent(intent({
  operation: 'add_conditioning',
  activity: 'Assault Bike Sprints',
  targetDate: '2026-05-29',
  modality: 'bike',
  bikeLabel: 'assault',
  effortKind: 'sprint',
  intensity: 'hard',
}), packet());
ok('LLM assault sprint intent becomes executable command',
  assault.kind === 'command');
if (assault.kind === 'command' && assault.command.mode === 'mutate') {
  eq('assault bike label preserved',
    (assault.command.payload as any).bikeLabel,
    'assault');
  eq('sprint effort preserved',
    (assault.command.payload as any).effortKind,
    'sprint');
  eq('activity does not collapse to Bike Intervals',
    (assault.command.payload as any).customActivity,
    'Assault Bike Sprints');
}

const hiitRow = coachCommandFromLLMIntent(intent({
  operation: 'add_conditioning',
  activity: 'HIIT rowing intervals',
  targetDate: '2026-06-02',
  targetSessionName: 'Lower Squat',
  modality: 'row',
  effortKind: 'interval',
  intensity: 'hard',
}), packet());
ok('LLM HIIT row intent becomes executable command',
  hiitRow.kind === 'command');
if (hiitRow.kind === 'command' && hiitRow.command.mode === 'mutate') {
  eq('HIIT row activity preserved',
    (hiitRow.command.payload as any).customActivity,
    'HIIT rowing intervals');
  eq('HIIT row effort preserved',
    (hiitRow.command.payload as any).effortKind,
    'interval');
  eq('HIIT row gets a full planned interval set count',
    (hiitRow.command.payload as any).sets,
    8);
  eq('HIIT row gets a full planned work duration',
    {
      repsMin: (hiitRow.command.payload as any).repsMin,
      repsMax: (hiitRow.command.payload as any).repsMax,
      restSeconds: (hiitRow.command.payload as any).restSeconds,
      prescriptionType: (hiitRow.command.payload as any).prescriptionType,
    },
    {
      repsMin: 45,
      repsMax: 45,
      restSeconds: 90,
      prescriptionType: 'duration',
    });
  eq('HIIT row target preserved',
    hiitRow.command.target,
    { kind: 'date', date: '2026-06-02', sessionName: 'Lower Squat' } as any);
}

const malformedHiitRow = coachCommandFromLLMIntent(intent({
  operation: 'add_conditioning',
  activity: 'HIIT Rower Intervals',
  targetDate: '2026-06-02',
  targetSessionName: 'Lower Squat',
  modality: 'row',
  effortKind: 'interval',
  intensity: 'hard',
  sets: 1,
  durationSeconds: 45,
}), packet());
ok('LLM partial HIIT plan still becomes executable command',
  malformedHiitRow.kind === 'command');
if (malformedHiitRow.kind === 'command' && malformedHiitRow.command.mode === 'mutate') {
  eq('LLM partial HIIT plan is normalised to full interval prescription',
    {
      sets: (malformedHiitRow.command.payload as any).sets,
      repsMin: (malformedHiitRow.command.payload as any).repsMin,
      repsMax: (malformedHiitRow.command.payload as any).repsMax,
      restSeconds: (malformedHiitRow.command.payload as any).restSeconds,
    },
    {
      sets: 8,
      repsMin: 45,
      repsMax: 45,
      restSeconds: 90,
    });
}

const lastMutationPacket = {
  ...packet(),
  referenceResolution: undefined,
  lastMutation: {
    operation: 'add_conditioning',
    mutationKind: 'add_conditioning',
    affectedDates: ['2026-06-02'],
    scope: 'one_off',
    timestamp: Date.now(),
    touchedActivities: [
      {
        kind: 'conditioning',
        date: '2026-06-02',
        sessionName: 'Upper Body Strength',
        title: 'Assault Bike Sprints',
        modality: 'bike',
        bikeLabel: 'assault',
        effortKind: 'sprint',
        sets: 6,
        repsMin: 20,
        repsMax: 30,
        prescriptionType: 'duration',
      },
    ],
  },
} as CoachContextPacket;
const pronounSeconds = coachCommandFromLLMIntent(intent({
  operation: 'change_duration',
  activity: 'Assault Bike Sprints',
  durationSeconds: 15,
  modality: 'bike',
  bikeLabel: 'assault',
  effortKind: 'sprint',
}), lastMutationPacket);
ok('LLM pronoun duration can target last mutation',
  pronounSeconds.kind === 'command');
if (pronounSeconds.kind === 'command' && pronounSeconds.command.mode === 'mutate') {
  eq('pronoun duration target date from last mutation',
    pronounSeconds.command.target,
    { kind: 'date', date: '2026-06-02', sessionName: 'Upper Body Strength' } as any);
  eq('pronoun duration seconds maps to repsMin',
    (pronounSeconds.command.payload as any).repsMin,
    15);
  eq('pronoun duration seconds maps to repsMax',
    (pronounSeconds.command.payload as any).repsMax,
    15);
}

const durationClarifierPacket = {
  ...packet(),
  userMessage: 'Can you make it a longer session?',
  currentWeek: [
    {
      date: '2026-05-27',
      workout: {
        name: 'Easy Aerobic Flush (25min Assault Bike)',
        description: 'Shifted to non-running modality.',
        conditioningBlock: {
          options: [
            {
              title: 'Easy Aerobic Flush (25min Assault Bike)',
              description: '25min easy Assault Bike.',
              exerciseIds: ['flush-bike'],
            },
          ],
        },
      },
    },
  ] as any,
  lastMutation: {
    operation: 'swap_conditioning_modality_once',
    mutationKind: 'swap_conditioning_modality_once',
    affectedDates: ['2026-05-27'],
    scope: 'one_off',
    timestamp: Date.now(),
    touchedActivities: [
      {
        kind: 'conditioning',
        date: '2026-05-27',
        sessionName: 'Easy Aerobic Flush',
        title: 'Easy Aerobic Flush',
        modality: 'bike',
        bikeLabel: 'assault',
        intensity: 'light',
        durationMinutes: 25,
        prescriptionType: 'duration_minutes',
      },
    ],
  },
} as CoachContextPacket;
const missingDuration = coachCommandFromLLMIntent({
  ...intent({
    operation: 'change_duration',
    targetDate: '2026-05-27',
    targetSessionName: 'Easy Aerobic Flush',
  }, true),
  clarificationQuestion: 'How much longer would you like the Wednesday Easy Aerobic Flush to be?',
}, durationClarifierPacket);
ok('LLM duration clarifier keeps a typed partial command',
  missingDuration.kind === 'command');
if (missingDuration.kind === 'command' && missingDuration.command.mode === 'mutate') {
  eq('duration clarifier op stays deterministic',
    missingDuration.command.operation,
    'add_conditioning' as any);
  eq('duration clarifier target preserved',
    missingDuration.command.target,
    { kind: 'date', date: '2026-05-27', sessionName: 'Easy Aerobic Flush' } as any);
  eq('duration clarifier asks only for duration',
    missingDuration.command.missingFields,
    ['durationMinutes']);
  eq('duration clarifier preserves visible activity',
    (missingDuration.command.payload as any).customActivity,
    'Easy Aerobic Flush (25min Assault Bike)');
  eq('duration clarifier marks visible activity as replacement source',
    (missingDuration.command.payload as any).replaceActivity,
    'Easy Aerobic Flush (25min Assault Bike)');
  eq('duration clarifier preserves modality',
    (missingDuration.command.payload as any).modality,
    'bike');
  eq('duration clarifier preserves assault bike label',
    (missingDuration.command.payload as any).bikeLabel,
    'assault');
  ok('duration clarifier still needs clarification before mutation',
    missingDuration.command.needsClarification === true);
}

const missingActivity = coachCommandFromLLMIntent(intent({
  operation: 'add_conditioning',
  targetDate: '2026-05-27',
  targetSessionName: 'Recovery Session',
}), packet());
ok('LLM missing activity produces clarifier',
  missingActivity.kind === 'clarify');
if (missingActivity.kind === 'clarify') {
  ok('clarifier asks only for activity',
    /what should i add/i.test(missingActivity.command.question),
    missingActivity.command.question);
}

console.log(`\n— Summary —\n  Pass: ${pass}\n  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
