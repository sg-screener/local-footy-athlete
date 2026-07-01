import {
  interpretCoachMessageToProgramEdit,
  executeProgramEdit,
  programEditFromSemanticProgramEditDraft,
  verifyProgramEditVisibleMutation,
  normalizeCoachEditMessage,
  resolvePendingProgramEditAnswer,
  type ProgramEdit,
} from '../utils/coachProgramEdit';
import type { CoachReferenceResolution } from '../utils/coachReferenceResolver';
import type { CoachCommand } from '../utils/coachCommandRouter';
import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';
import {
  getPendingClarifierSnapshot,
  usePendingCoachClarifierStore,
} from '../store/pendingCoachClarifierStore';
import { orchestrateModalitySwap } from '../utils/coachModalitySwapOrchestrator';
import {
  extractVisibleProgramItemsFromWorkout,
  getResolvedVisibleProgramForDate,
} from '../utils/visibleProgramReadModel';
import { applyAdjustmentEvents } from '../utils/applyAdjustmentEvents';

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

function resolved(date: string, sessionName: string): CoachReferenceResolution {
  return {
    status: 'resolved',
    target: { date, sessionName, method: 'explicit_day' } as any,
    method: 'explicit_day',
    confidence: 0.9,
    isMutationLike: true,
  } as any;
}

function conditioningWorkout(title: string, optionTitles: string[]): any {
  const exercises = optionTitles.map((optionTitle, index) => ({
    id: `conditioning-row-${index + 1}`,
    exerciseId: `ex-${index + 1}`,
    exercise: {
      id: `ex-${index + 1}`,
      name: optionTitle,
      description: optionTitle,
    },
    prescribedSets: 1,
    prescribedRepsMin: 25,
    prescribedRepsMax: 25,
    prescriptionType: 'duration_minutes',
    notes: `${optionTitle}.`,
  }));
  return {
    id: `workout-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: title,
    workoutType: 'Conditioning',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    exercises,
    conditioningBlock: {
      intent: 'aerobic',
      options: optionTitles.map((optionTitle, index) => ({
        title: optionTitle,
        description: optionTitle,
        exerciseIds: [exercises[index].id],
      })),
    },
  };
}

function strengthWithConditioningWorkout(
  title: string,
  strengthTitles: string[],
  optionTitles: string[],
): any {
  const strengthExercises = strengthTitles.map((exerciseTitle, index) => ({
    id: `strength-row-${index + 1}`,
    exerciseId: `strength-ex-${index + 1}`,
    exercise: {
      id: `strength-ex-${index + 1}`,
      name: exerciseTitle,
      description: exerciseTitle,
    },
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    prescriptionType: 'reps',
    notes: exerciseTitle,
  }));
  const conditioningExercises = optionTitles.map((optionTitle, index) => ({
    id: `conditioning-row-${index + 1}`,
    exerciseId: `conditioning-ex-${index + 1}`,
    exercise: {
      id: `conditioning-ex-${index + 1}`,
      name: optionTitle,
      description: optionTitle,
    },
    prescribedSets: 1,
    prescribedRepsMin: 25,
    prescribedRepsMax: 25,
    prescriptionType: 'duration_minutes',
    notes: `${optionTitle}.`,
  }));
  return {
    id: `workout-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: title,
    workoutType: 'Strength',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    exercises: [...strengthExercises, ...conditioningExercises],
    conditioningBlock: {
      intent: 'aerobic',
      options: optionTitles.map((optionTitle, index) => ({
        title: optionTitle,
        description: optionTitle,
        exerciseIds: [conditioningExercises[index].id],
      })),
    },
  };
}

function visibleDay(date: string, workout: any): any {
  return { date, sessionName: workout.name, workout };
}

function visibleProgramForWorkout(workout: any, date = TARGET): any {
  const items = extractVisibleProgramItemsFromWorkout(workout);
  return {
    day: {
      date,
      dayOfWeek: 3,
      short: 'WED',
      source: 'manual',
      indicator: 'none',
      workout,
    },
    items,
    conditioningItems: items.filter((item: any) =>
      item.domain === 'conditioning' || item.domain === 'recovery',
    ),
    strengthItems: items.filter((item: any) => item.domain === 'strength'),
  };
}

function pureConditioningWorkout(
  workoutName: string,
  phaseName: string,
  notes: string,
): any {
  return {
    id: `workout-${workoutName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    microcycleId: 'test',
    dayOfWeek: 3,
    name: workoutName,
    description: '',
    durationMinutes: 25,
    intensity: 'Low',
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    hasCombinedConditioning: false,
    exercises: [{
      id: 'rower-phase',
      exerciseId: 'rower-phase',
      exercise: {
        id: 'rower-phase',
        name: phaseName,
        description: notes,
      },
      prescribedSets: 1,
      prescribedRepsMin: 25,
      prescribedRepsMax: 25,
      prescriptionType: 'duration_minutes',
      restSeconds: 0,
      notes,
    }],
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  };
}

function runConditioningProgramEdit(edit: ProgramEdit, beforeWorkout: any) {
  let written: any = null;
  let eventPayload: any = null;
  const result = executeProgramEdit({
    programEdit: edit,
    todayISO: TODAY,
    referenceResolution: resolved(TARGET, beforeWorkout.name),
    userMessage: edit.normalizedMessage ?? '',
    conditioningDeps: {
      snapshotBefore: () => beforeWorkout,
      applyEvents: (events: any[], opts: any) => {
        eventPayload = events[0]?.after ?? events[0]?.before ?? null;
        return applyAdjustmentEvents(events as any, {
          ...opts,
          buildState: () => ({} as any),
          resolveWeek: () => [{
            date: TARGET,
            dayOfWeek: 3,
            short: 'WED',
            source: 'manual',
            indicator: 'none',
            workout: beforeWorkout,
          }] as any,
          setManualOverride: (_date: string, workout: any) => {
            written = workout;
          },
          allowFutureWeeks: true,
          allowPastDates: false,
        });
      },
      verifyRendered: (args: any) => ({
        requestedDay: args.requestedDay,
        todayISO: args.todayISO,
        targetDate: args.targetDate,
        targetWorkoutBeforeName: beforeWorkout.name,
        targetWorkoutAfterName: written?.name ?? null,
        beforeHasConditioning: true,
        afterHasConditioning: extractVisibleProgramItemsFromWorkout(written)
          .some((item: any) => item.domain === 'conditioning' || item.domain === 'recovery'),
        overrideKeyWritten: !!written,
        programTabProjectionHasConditioning: extractVisibleProgramItemsFromWorkout(written)
          .some((item: any) => item.domain === 'conditioning' || item.domain === 'recovery'),
        dayWorkoutProjectionHasConditioning: extractVisibleProgramItemsFromWorkout(written)
          .some((item: any) => item.domain === 'conditioning' || item.domain === 'recovery'),
        expectedActivityTitle: args.expectedActivityTitle,
        programTabProjectionHasExpectedActivity: args.expectedActivityTitle
          ? JSON.stringify(written ?? {}).toLowerCase().includes(String(args.expectedActivityTitle).toLowerCase())
          : true,
        dayWorkoutProjectionHasExpectedActivity: args.expectedActivityTitle
          ? JSON.stringify(written ?? {}).toLowerCase().includes(String(args.expectedActivityTitle).toLowerCase())
          : true,
      }),
      snapshotAfter: () => written,
      newEventId: () => 'test-conditioning-event',
    },
    undoDeps: {
      readDateOverride: () => ({ workout: beforeWorkout, context: null }),
      recordMutation: (entry: any) => ({
        id: 'mutation-test',
        timestamp: Date.now(),
        ...entry,
      }),
    },
  });
  return { result, written, eventPayload };
}

function runStrengthBlockProgramEdit(
  edit: ProgramEdit,
  beforeWorkout: any,
  options: {
    targetDate?: string;
    applyEvents?: (events: any[], opts: any) => any;
    afterWorkout?: any;
  } = {},
) {
  const targetDate = options.targetDate ?? TARGET;
  let written: any = null;
  let rolledBack = false;
  let eventKind: string | null = null;
  const result = executeProgramEdit({
    programEdit: edit,
    todayISO: TODAY,
    referenceResolution: resolved(targetDate, beforeWorkout.name),
    userMessage: edit.normalizedMessage ?? '',
    conditioningDeps: {
      snapshotBefore: () => beforeWorkout,
      snapshotAfter: () => written,
      applyEvents: (events: any[], opts: any) => {
        eventKind = events[0]?.kind ?? null;
        if (options.applyEvents) {
          const out = options.applyEvents(events, opts);
          if (Object.prototype.hasOwnProperty.call(options, 'afterWorkout')) {
            written = options.afterWorkout;
          }
          return out;
        }
        return applyAdjustmentEvents(events as any, {
          ...opts,
          buildState: () => ({} as any),
          resolveWeek: () => [{
            date: targetDate,
            dayOfWeek: 3,
            short: 'WED',
            source: 'manual',
            indicator: 'none',
            workout: beforeWorkout,
          }] as any,
          setManualOverride: (_date: string, workout: any) => {
            written = workout;
          },
          allowFutureWeeks: true,
          allowPastDates: false,
        });
      },
      rollback: () => {
        rolledBack = true;
        written = beforeWorkout;
        return { applied: [{ date: targetDate, eventIds: ['rollback'], workoutName: beforeWorkout.name }], rejected: [] } as any;
      },
    },
    undoDeps: {
      readDateOverride: () => ({ workout: beforeWorkout, context: null }),
    },
  });
  return { result, written, eventKind, rolledBack };
}

function runRemoveSessionProgramEdit(edit: ProgramEdit, beforeWeek: any[], targetDate = TARGET) {
  let removedDate: string | null = null;
  let recorded: any = null;
  let rolledBack = false;
  const weekForState = () => beforeWeek.map((day) => ({
    date: day.date,
    dayOfWeek: day.dayOfWeek ?? 3,
    short: day.short ?? day.date,
    source: day.source ?? 'program',
    indicator: day.indicator ?? 'none',
    workout: removedDate === day.date ? null : day.workout,
  }));
  const beforeWorkout = beforeWeek.find((day) => day.date === targetDate)?.workout ?? null;
  const result = executeProgramEdit({
    programEdit: edit,
    todayISO: TODAY,
    referenceResolution: resolved(targetDate, beforeWorkout?.name ?? 'Session'),
    userMessage: edit.normalizedMessage ?? '',
    removeSessionDeps: {
      snapshotBefore: (date) => beforeWeek.find((day) => day.date === date)?.workout ?? null,
      snapshotAfter: (date) => removedDate === date ? null : beforeWeek.find((day) => day.date === date)?.workout ?? null,
      visibleWeek: () => weekForState() as any,
      readCalendarMark: () => null,
      applyRemove: ({ targetDate: date }) => {
        removedDate = date;
        return { applied: true };
      },
      rollback: () => {
        rolledBack = true;
        removedDate = null;
      },
    },
    undoDeps: {
      readDateOverride: () => ({ workout: null, context: null }),
      recordMutation: (entry: any) => {
        recorded = entry;
        return { id: 'remove-session-mutation', timestamp: Date.now(), ...entry };
      },
    },
  });
  return { result, removedDate, recorded, rolledBack };
}

function runAddSessionProgramEdit(edit: ProgramEdit, beforeWeek: any[], targetDate = TARGET) {
  let addedDate: string | null = null;
  let addedWorkout: any = null;
  let recorded: any = null;
  let rolledBack = false;
  const weekForState = () => beforeWeek.map((day) => ({
    date: day.date,
    dayOfWeek: day.dayOfWeek ?? 3,
    short: day.short ?? day.date,
    source: day.source ?? 'program',
    indicator: day.indicator ?? 'none',
    workout: addedDate === day.date ? addedWorkout : day.workout,
  }));
  const result = executeProgramEdit({
    programEdit: edit,
    todayISO: TODAY,
    referenceResolution: resolved(targetDate, 'Rest'),
    userMessage: edit.normalizedMessage ?? '',
    addSessionDeps: {
      snapshotBefore: (date) => beforeWeek.find((day) => day.date === date)?.workout ?? null,
      snapshotAfter: (date) => addedDate === date ? addedWorkout : beforeWeek.find((day) => day.date === date)?.workout ?? null,
      visibleWeek: () => weekForState() as any,
      readCalendarMark: () => 'rest' as any,
      applyAdd: ({ targetDate: date, sourceWorkout }) => {
        addedDate = date;
        addedWorkout = { ...sourceWorkout, id: `${sourceWorkout.id}-copy`, coachNotes: ['coach add_session'] };
        return { applied: true };
      },
      rollback: () => {
        rolledBack = true;
        addedDate = null;
        addedWorkout = null;
      },
    },
    undoDeps: {
      readDateOverride: () => ({ workout: null, context: null }),
      recordMutation: (entry: any) => {
        recorded = entry;
        return { id: 'add-session-mutation', timestamp: Date.now(), ...entry };
      },
    },
  });
  return { result, addedDate, addedWorkout, recorded, rolledBack };
}

function pendingFromEdit(
  edit: ProgramEdit,
  originalMessage = 'Can you change Wednesday to a ski erg',
): PendingCoachClarifier {
  const command = edit.command as CoachCommand;
  if (!command || command.mode !== 'mutate') {
    throw new Error('pendingFromEdit requires a mutate ProgramEdit command');
  }
  return {
    operation: command.operation,
    partialPayload: command.payload as any,
    scope: command.scope,
    missingFields: edit.missingFields,
    originalMessage,
    askedQuestion: edit.question ?? 'Which item should I change?',
    createdAt: Date.now(),
    targetDate: edit.targetDate ?? undefined,
    targetSessionName: edit.targetSessionId ?? undefined,
    programEdit: edit,
  };
}

function completeTargetForAnswer(
  answer: string,
  workout: any,
  originalMessage = 'Can you change Wednesday to a ski erg',
) {
  const initialEdit = interpretCoachMessageToProgramEdit({
    userMessage: originalMessage,
    todayISO: TODAY,
    referenceResolution: resolved(TARGET, workout.name),
    currentWeek: [visibleDay(TARGET, workout)],
  });
  const pending = pendingFromEdit(initialEdit, originalMessage);
  return {
    initialEdit,
    result: resolvePendingProgramEditAnswer({
      pending,
      userMessage: answer,
      currentWeek: [visibleDay(TARGET, workout)],
    }),
  };
}

const TODAY = '2026-06-02';
const TARGET = '2026-06-03';

function semanticStrengthBlockEdit(args: {
  intent?: 'remove' | 'reduce';
  targetDate?: string;
  protectConditioning?: boolean;
  missingFields?: string[];
  resolveVisibleProgramForDate?: (date: string) => any;
} = {}): ProgramEdit {
  const intent = args.intent ?? 'remove';
  const targetDate = args.targetDate ?? TARGET;
  return programEditFromSemanticProgramEditDraft({
    todayISO: TODAY,
    userMessage: intent === 'remove'
      ? 'drop the lower work but keep the flush'
      : 'make the lower strength easier but keep the flush',
    draft: {
      intent,
      targetDomain: 'strength',
      actionScope: 'strength_block',
      targetDate,
      targetSessionId: 'session-lower',
      targetItemId: null,
      sourceTarget: {
        kind: 'session',
        date: targetDate,
        sessionName: 'Lower Body Strength',
        itemId: 'session-lower',
        domain: 'strength',
        stillVisible: true,
      } as any,
      explicitDateRole: 'referent',
      explicitUserWording: 'drop the lower work but keep the flush',
      missingFields: args.missingFields ?? [],
      confidence: 0.91,
      protectedTargets: args.protectConditioning === false ? [] : [{
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate,
        targetItemId: null,
        title: 'Easy Aerobic Flush',
        reason: 'explicit_keep_conditioning',
      }],
      constraints: args.protectConditioning === false ? [] : ['keep conditioning:conditioning_block'],
      proposedActions: [{
        intent: intent === 'reduce' ? 'edit' : 'remove',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate,
        targetSessionId: 'session-lower',
        targetItemId: null,
        sourceTarget: null,
        reason: `${intent}_strength_block`,
      }],
      verifierExpectations: [{
        kind: 'domain_changed',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate,
        reason: `${intent}_strength_block`,
      }],
      isCompound: false,
      reason: `semantic_${intent}_strength_block`,
    } as any,
    resolveVisibleProgramForDate: args.resolveVisibleProgramForDate,
  });
}

function semanticConditioningBlockEdit(args: {
  intent?: 'remove' | 'reduce' | 'edit';
  targetDate?: string;
  targetItemId?: string | null;
  missingFields?: string[];
  resolveVisibleProgramForDate?: (date: string) => any;
  protectStrength?: boolean;
} = {}): ProgramEdit {
  const intent = args.intent ?? 'remove';
  const targetDate = args.targetDate ?? TARGET;
  return programEditFromSemanticProgramEditDraft({
    todayISO: TODAY,
    userMessage: 'remove conditioning from the target day',
    draft: {
      intent,
      targetDomain: 'conditioning',
      actionScope: 'conditioning_block',
      targetDate,
      targetSessionId: 'session-conditioning',
      targetItemId: args.targetItemId ?? null,
      sourceTarget: {
        kind: 'conditioning_item',
        date: targetDate,
        sessionName: 'Lower Body Strength',
        itemId: args.targetItemId ?? undefined,
        itemTitle: 'Conditioning block',
        domain: 'conditioning',
        stillVisible: true,
      } as any,
      explicitDateRole: 'referent',
      explicitUserWording: 'remove conditioning from the target day',
      missingFields: args.missingFields ?? [],
      confidence: 0.91,
      protectedTargets: args.protectStrength === false ? [] : [{
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate,
        targetItemId: null,
        title: 'Strength',
        reason: 'conditioning_edit_preserves_strength_by_default',
      }],
      constraints: args.protectStrength === false ? [] : ['keep strength:strength_block'],
      proposedActions: [{
        intent: intent === 'reduce' ? 'edit' : intent,
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate,
        targetSessionId: 'session-conditioning',
        targetItemId: args.targetItemId ?? null,
        sourceTarget: null,
        reason: `${intent}_conditioning_block`,
      }],
      verifierExpectations: [{
        kind: 'domain_changed',
        targetDomain: 'conditioning',
        actionScope: 'conditioning_block',
        targetDate,
        reason: `${intent}_conditioning_block`,
      }],
      isCompound: false,
      reason: `semantic_${intent}_conditioning_block`,
    } as any,
    resolveVisibleProgramForDate: args.resolveVisibleProgramForDate,
  });
}

section('1. ProgramEdit schema is the mutation contract');

const bikeWorkout = conditioningWorkout('Easy Aerobic Flush', ['Bike Flush']);
const messyFollowUp = interpretCoachMessageToProgramEdit({
  userMessage: 'can u make dat lonfer',
  todayISO: TODAY,
  referenceResolution: null,
  currentWeek: [visibleDay(TARGET, bikeWorkout)],
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: TARGET, sessionName: 'Easy Aerobic Flush' },
    appliedAt: Date.now(),
    userMessage: 'add a bike flush tomorrow',
    appliedReply: 'Done. I added Bike Flush.',
    touchedActivities: [{
      kind: 'conditioning',
      date: TARGET,
      sessionName: 'Easy Aerobic Flush',
      title: 'Bike Flush',
      modality: 'bike',
      durationMinutes: 25,
      sets: 1,
      prescriptionType: 'duration_minutes',
    }],
  },
});

eq('messy typo follow-up normalises before routing',
  messyFollowUp.normalizedMessage,
  'can you make that longer');
eq('messy duration follow-up asks for duration amount',
  messyFollowUp.intent,
  'ask_question' as any);
eq('messy duration follow-up targets duration',
  messyFollowUp.requestedChange,
  'duration' as any);
eq('messy duration follow-up binds existing item id',
  messyFollowUp.targetItemId,
  'conditioning-row-1');
ok('messy duration follow-up carries duration as missing field',
  messyFollowUp.missingFields.includes('duration'),
  messyFollowUp);

const oneHourBike = interpretCoachMessageToProgramEdit({
  userMessage: 'make the bike 1 hr',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, bikeWorkout)],
});
eq('1 hr normalises to a duration edit',
  oneHourBike.intent,
  'edit' as any);
eq('1 hr targets the visible bike item',
  oneHourBike.targetItemId,
  'conditioning-row-1');
eq('1 hr becomes duration change',
  oneHourBike.requestedChange,
  'duration' as any);
eq('1 hr value becomes 60 minutes',
  (oneHourBike.newValue as any)?.durationMinutes,
  60);

section('2. Pending follow-ups continue the original edit');

const pendingDuration: PendingCoachClarifier = {
  operation: 'add_conditioning',
  partialPayload: {
    operation: 'add_conditioning',
    modality: 'bike' as any,
    customActivity: 'Bike Flush',
    replaceActivity: 'Bike Flush',
    editMode: 'update_existing',
  } as any,
  scope: 'one_off',
  missingFields: ['durationMinutes'],
  originalMessage: 'make the bike longer',
  askedQuestion: 'How much longer should it be?',
  createdAt: Date.now(),
  targetDate: TARGET,
  targetSessionName: 'Easy Aerobic Flush',
};

const pendingAnswer = interpretCoachMessageToProgramEdit({
  userMessage: 'nah make that 45',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, bikeWorkout)],
  pendingClarifier: pendingDuration,
});
eq('pending scalar answer stays attached to pending edit',
  pendingAnswer.source,
  'pending_clarifier' as any);
eq('pending scalar answer is still an edit',
  pendingAnswer.intent,
  'edit' as any);
eq('pending scalar answer binds target item',
  pendingAnswer.targetItemId,
  'conditioning-row-1');
eq('pending scalar answer normalizes value',
  (pendingAnswer.newValue as any)?.durationMinutes,
  45);

section('3. Missing source identity asks instead of guessing');

const multiWorkout = conditioningWorkout('Lower Squat', ['Bike Flush', 'Sprint Session']);
const editWithoutSourceCommand: CoachCommand = {
  mode: 'mutate',
  operation: 'add_conditioning',
  target: { kind: 'date', date: TARGET, sessionName: 'Lower Squat' },
  payload: {
    operation: 'add_conditioning',
    modality: 'bike' as any,
    durationMinutes: 60,
    editMode: 'update_existing',
  } as any,
  scope: 'one_off',
  confidence: 0.8,
  needsClarification: false,
  reason: 'test:update_existing_without_source',
};
const ambiguousEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'make it 1 hour',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, multiWorkout)],
  candidateCommand: editWithoutSourceCommand,
});
eq('ambiguous existing edit becomes ask_question ProgramEdit',
  ambiguousEdit.intent,
  'ask_question' as any);
ok('ambiguous edit requires targetItemId',
  ambiguousEdit.missingFields.includes('targetItemId'),
  ambiguousEdit);
ok('ambiguous edit offers actual visible items',
  (ambiguousEdit.options ?? []).includes('Bike Flush') &&
    (ambiguousEdit.options ?? []).includes('Sprint Session'),
  ambiguousEdit);

const ambiguousResult = executeProgramEdit({
  programEdit: ambiguousEdit,
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  userMessage: 'make it 1 hour',
});
eq('executor refuses incomplete ProgramEdit',
  ambiguousResult.kind,
  'clarify' as any);
ok('executor asks which item',
  /which one/i.test(ambiguousResult.reply),
  ambiguousResult.reply);

section('4. Add, replace, and remove stay distinct');

const addSki = interpretCoachMessageToProgramEdit({
  userMessage: 'add 10 min ski erg today',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, multiWorkout)],
});
eq('clear add remains add',
  addSki.intent,
  'add' as any);
eq('clear add does not require target item identity',
  addSki.targetItemId,
  null);
ok('clear add has no missing target item field',
  !addSki.missingFields.includes('targetItemId'),
  addSki);

const replaceModality = interpretCoachMessageToProgramEdit({
  userMessage: 'swap the rower to bike today',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, conditioningWorkout('Lower Squat', ['Rower Flush']))],
});
eq('modality swap is edit, not add',
  replaceModality.intent,
  'edit' as any);
eq('modality swap declares modality-only scope',
  replaceModality.editScope,
  'modality_only' as any);
eq('modality swap targets modality',
  replaceModality.requestedChange,
  'modality' as any);
eq('modality swap binds existing conditioning source',
  replaceModality.targetItemId,
  'conditioning-row-1');

const removeAmbiguousCommand: CoachCommand = {
  mode: 'mutate',
  operation: 'remove_conditioning',
  target: { kind: 'date', date: TARGET, sessionName: 'Lower Squat' },
  payload: { operation: 'remove_conditioning', modality: null },
  scope: 'one_off',
  confidence: 0.8,
  needsClarification: false,
  reason: 'test:remove_conditioning',
};
const removeAmbiguous = interpretCoachMessageToProgramEdit({
  userMessage: 'remove the conditioning',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, multiWorkout)],
  candidateCommand: removeAmbiguousCommand,
});
eq('remove with multiple sources asks',
  removeAmbiguous.intent,
  'ask_question' as any);
ok('remove requires source item identity',
  removeAmbiguous.missingFields.includes('targetItemId'),
  removeAmbiguous);

const ditchSingle = interpretCoachMessageToProgramEdit({
  userMessage: 'ditch the conditioning on wed',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, conditioningWorkout('Easy Aerobic Flush', ['Rower Flush']))],
});
eq('remove intent category does not fall to conversation',
  ditchSingle.intent,
  'remove' as any);
eq('ditch conditioning with one visible item targets that item',
  ditchSingle.targetItemId,
  'conditioning-row-1');
eq('ditch conditioning declares remove item scope',
  ditchSingle.editScope,
  'remove_conditioning_item' as any);
const ditchSingleApply = runConditioningProgramEdit(
  ditchSingle,
  conditioningWorkout('Easy Aerobic Flush', ['Rower Flush']),
);
eq('ditch conditioning with one visible item removes it',
  ditchSingleApply.written?.exercises?.length,
  0);
eq('ditch conditioning event carries target item id',
  ditchSingleApply.eventPayload?.targetItemId,
  'conditioning-row-1');

const mixedConditioningRemovalWorkout = strengthWithConditioningWorkout(
  'Lower Squat',
  ['Back Squat', 'Copenhagen Plank'],
  ['Rower Flush'],
);
const ditchConditioningFromMixed = interpretCoachMessageToProgramEdit({
  userMessage: 'remove conditioning today',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, mixedConditioningRemovalWorkout)],
});
eq('remove conditioning from mixed session stays conditioning domain',
  ditchConditioningFromMixed.targetDomain,
  'conditioning' as any);
eq('remove conditioning from mixed session uses conditioning-item scope',
  ditchConditioningFromMixed.editScope,
  'remove_conditioning_item' as any);
const ditchConditioningFromMixedApply = runConditioningProgramEdit(
  ditchConditioningFromMixed,
  mixedConditioningRemovalWorkout,
);
ok('remove conditioning from mixed session keeps strength exercises',
  ditchConditioningFromMixedApply.written?.exercises?.some((ex: any) =>
    ex.exercise?.name === 'Back Squat',
  ) &&
    ditchConditioningFromMixedApply.written?.exercises?.some((ex: any) =>
      ex.exercise?.name === 'Copenhagen Plank',
    ),
  ditchConditioningFromMixedApply.written);
ok('remove conditioning from mixed session removes the rower',
  !ditchConditioningFromMixedApply.written?.exercises?.some((ex: any) =>
    ex.exercise?.name === 'Rower Flush',
  ),
  ditchConditioningFromMixedApply.written);

const ditchMulti = interpretCoachMessageToProgramEdit({
  userMessage: 'ditch the conditioning on wed',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, multiWorkout)],
});
eq('ditch conditioning with multiple conditioning items asks which one',
  ditchMulti.intent,
  'ask_question' as any);
ok('ditch conditioning asks with concrete options',
  (ditchMulti.options ?? []).includes('Bike Flush') &&
    (ditchMulti.options ?? []).includes('Sprint Session'),
  ditchMulti);

const ditchRower = interpretCoachMessageToProgramEdit({
  userMessage: 'ditch the rower on wed pls',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, conditioningWorkout('Easy Aerobic Flush', ['Rower Flush']))],
});
eq('ditch rower with one visible rower removes',
  ditchRower.intent,
  'remove' as any);
eq('ditch rower binds the rower item',
  ditchRower.targetItemId,
  'conditioning-row-1');
const ditchRowerApply = runConditioningProgramEdit(
  ditchRower,
  conditioningWorkout('Easy Aerobic Flush', ['Rower Flush']),
);
eq('ditch rower executor removes the rower item',
  ditchRowerApply.written?.exercises?.length,
  0);

const multipleRowers = conditioningWorkout('Lower Squat', ['Rower Flush', 'Rower Sprints']);
const ditchRowerMulti = interpretCoachMessageToProgramEdit({
  userMessage: 'ditch the rower on wed pls',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, multipleRowers)],
});
eq('ditch rower with multiple rower items asks which one',
  ditchRowerMulti.intent,
  'ask_question' as any);
ok('ditch rower asks with concrete rower options',
  (ditchRowerMulti.options ?? []).includes('Rower Flush') &&
    (ditchRowerMulti.options ?? []).includes('Rower Sprints'),
  ditchRowerMulti);

const easierToday = interpretCoachMessageToProgramEdit({
  userMessage: 'can we do something easier today',
  todayISO: TODAY,
  referenceResolution: resolved(TODAY, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TODAY, conditioningWorkout('Easy Aerobic Flush', ['Rower Flush']))],
});
eq('easier today becomes structured clarification, not conversation',
  easierToday.intent,
  'ask_question' as any);
ok('easier today asks a useful load question',
  /strength|conditioning|whole session/i.test(easierToday.question ?? '') ||
    /strength|conditioning|whole session/i.test((easierToday.options ?? []).join(' ')),
  easierToday);

const mixedSession = strengthWithConditioningWorkout(
  'Lower Squat',
  ['Back Squat', 'Copenhagen Plank'],
  ['Rower Flush'],
);
const easierMixed = interpretCoachMessageToProgramEdit({
  userMessage: 'can we do something easier today',
  todayISO: TODAY,
  referenceResolution: resolved(TODAY, 'Lower Squat'),
  currentWeek: [visibleDay(TODAY, mixedSession)],
});
eq('easier today with multiple components asks instead of mutating',
  easierMixed.intent,
  'ask_question' as any);
ok('easier mixed session asks strength vs conditioning vs whole session',
  /strength/i.test((easierMixed.options ?? []).join(' ')) &&
    /conditioning/i.test((easierMixed.options ?? []).join(' ')) &&
    /whole session/i.test((easierMixed.options ?? []).join(' ')),
  easierMixed);

const cookedLegs = interpretCoachMessageToProgramEdit({
  userMessage: 'legs are cooked',
  todayISO: TODAY,
  referenceResolution: resolved(TODAY, 'Lower Squat'),
  currentWeek: [visibleDay(TODAY, mixedSession)],
});
eq('fatigue language becomes structured clarify path',
  cookedLegs.intent,
  'ask_question' as any);
ok('fatigue language never routes to generic conversation',
  cookedLegs.intent !== ('explain' as any),
  cookedLegs);

section('4c. Command priority — explicit mutation beats fatigue context');

const todayGunshow = strengthWithConditioningWorkout(
  'Gunshow',
  ['Chin-Up Negative', 'DB Bench'],
  [],
);
const wednesdayLower = strengthWithConditioningWorkout(
  'Lower Strength',
  ['Back Squat', 'RDL'],
  ['Rower Flush'],
);
const priorityWeek = [
  { date: TODAY, dayOfWeek: 2, short: 'TUE', source: 'program', indicator: 'none', workout: todayGunshow },
  { date: TARGET, dayOfWeek: 3, short: 'WED', source: 'program', indicator: 'none', workout: wednesdayLower },
];

const cookedRemoveWednesday = interpretCoachMessageToProgramEdit({
  userMessage: 'My legs are cooked, can you actually remove the Wednesday session fully?',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Strength'),
  currentWeek: [visibleDay(TODAY, todayGunshow), visibleDay(TARGET, wednesdayLower)],
});
eq('fatigue + explicit whole-session remove resolves to remove intent',
  cookedRemoveWednesday.intent,
  'remove' as any);
eq('fatigue + explicit whole-session remove targets session domain',
  cookedRemoveWednesday.targetDomain,
  'session' as any);
eq('fatigue + explicit whole-session remove uses whole-session scope',
  cookedRemoveWednesday.editScope,
  'remove_whole_session' as any);
eq('fatigue + explicit whole-session remove preserves Wednesday target',
  cookedRemoveWednesday.targetDate,
  TARGET);
ok('fatigue + explicit whole-session remove never routes to legacy conversation',
  cookedRemoveWednesday.command?.mode === 'mutate' &&
    (cookedRemoveWednesday.command as any).operation === 'remove_session',
  cookedRemoveWednesday.command);

const removeWednesdayExec = runRemoveSessionProgramEdit(
  cookedRemoveWednesday,
  priorityWeek,
);
eq('remove Wednesday executor mutates',
  removeWednesdayExec.result.kind,
  'mutated' as any);
eq('remove Wednesday executor removes only target date',
  removeWednesdayExec.removedDate,
  TARGET);
eq('remove Wednesday records typed mutation',
  removeWednesdayExec.recorded?.mutationKind,
  'remove_session');
eq('remove Wednesday does not rollback verified change',
  removeWednesdayExec.rolledBack,
  false);

const cookedDitchWednesday = interpretCoachMessageToProgramEdit({
  userMessage: 'legs cooked, ditch Wednesday',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Strength'),
  currentWeek: [visibleDay(TODAY, todayGunshow), visibleDay(TARGET, wednesdayLower)],
});
eq('fatigue + ditch day resolves to remove_session',
  (cookedDitchWednesday.command as any)?.operation,
  'remove_session');
eq('fatigue + ditch day has whole-session ProgramEdit scope',
  cookedDitchWednesday.editScope,
  'remove_whole_session' as any);

const soreRemoveRower = interpretCoachMessageToProgramEdit({
  userMessage: 'I’m sore, remove the rower on Wednesday',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Strength'),
  currentWeek: [visibleDay(TARGET, wednesdayLower)],
});
eq('fatigue + explicit item remove stays conditioning domain',
  soreRemoveRower.targetDomain,
  'conditioning' as any);
eq('fatigue + explicit item remove removes item only',
  soreRemoveRower.editScope,
  'remove_conditioning_item' as any);

const exactMakeTodayEasier = interpretCoachMessageToProgramEdit({
  userMessage: 'can we make today easier?',
  todayISO: TODAY,
  referenceResolution: resolved(TODAY, 'Gunshow'),
  currentWeek: [visibleDay(TODAY, todayGunshow)],
});
eq('make today easier asks structured reduce clarification',
  exactMakeTodayEasier.intent,
  'ask_question' as any);
ok('make today easier does not mutate without explicit lever',
  exactMakeTodayEasier.command?.mode === 'clarify',
  exactMakeTodayEasier.command);

section('4d. Add session to most recent removed/rest target');

const NEXT_WED = '2026-06-10';
const restWednesday = {
  date: NEXT_WED,
  dayOfWeek: 3,
  short: 'WED',
  source: 'rest',
  indicator: 'none',
  workout: null,
};
const addGunshowToThatWednesday = interpretCoachMessageToProgramEdit({
  userMessage: 'Can you add a gun show to that Wednesday?',
  todayISO: TODAY,
  referenceResolution: resolved(NEXT_WED, 'Rest'),
  currentWeek: [
    { date: TODAY, sessionName: 'Gunshow', workout: todayGunshow },
    { date: NEXT_WED, sessionName: 'Rest', workout: null },
  ],
});
eq('add Gunshow resolves to add intent',
  addGunshowToThatWednesday.intent,
  'add' as any);
eq('add Gunshow targets session domain',
  addGunshowToThatWednesday.targetDomain,
  'session' as any);
eq('add Gunshow uses whole-session add scope',
  addGunshowToThatWednesday.editScope,
  'add_whole_session' as any);
eq('add Gunshow preserves removed Wednesday target',
  addGunshowToThatWednesday.targetDate,
  NEXT_WED);
eq('add Gunshow routes to typed add_session',
  (addGunshowToThatWednesday.command as any)?.operation,
  'add_session');
eq('add Gunshow preserves source session name',
  (addGunshowToThatWednesday.newValue as any)?.sourceSessionName,
  'Gunshow');

const putGunshowThere = interpretCoachMessageToProgramEdit({
  userMessage: 'put Gunshow there',
  todayISO: TODAY,
  referenceResolution: resolved(NEXT_WED, 'Rest'),
  currentWeek: [
    { date: TODAY, sessionName: 'Gunshow', workout: todayGunshow },
    { date: NEXT_WED, sessionName: 'Rest', workout: null },
  ],
});
eq('put Gunshow there is add_session, not edit item',
  (putGunshowThere.command as any)?.operation,
  'add_session');
eq('put Gunshow there preserves target date',
  putGunshowThere.targetDate,
  NEXT_WED);

const addGunshowExec = runAddSessionProgramEdit(
  addGunshowToThatWednesday,
  [
    { date: TODAY, dayOfWeek: 2, short: 'TUE', source: 'program', indicator: 'none', workout: todayGunshow },
    restWednesday,
  ],
  NEXT_WED,
);
eq('add Gunshow executor mutates',
  addGunshowExec.result.kind,
  'mutated' as any);
eq('add Gunshow writes only removed Wednesday',
  addGunshowExec.addedDate,
  NEXT_WED);
eq('add Gunshow writes Gunshow workout',
  addGunshowExec.addedWorkout?.name,
  'Gunshow');
eq('add Gunshow records typed mutation',
  addGunshowExec.recorded?.mutationKind,
  'add_session');
eq('add Gunshow does not rollback verified change',
  addGunshowExec.rolledBack,
  false);

section('5. Verifier rejects accidental duplicate creation');

const beforeWorkout = conditioningWorkout('Easy Aerobic Flush', ['Bike Flush']);
const duplicateAfter = conditioningWorkout('Easy Aerobic Flush', ['Bike Flush', 'Bike Flush 60min']);
const editForVerifier: ProgramEdit = {
  intent: 'edit',
  editScope: 'duration_only',
  targetDate: TARGET,
  targetSessionId: beforeWorkout.id,
  targetItemId: 'conditioning-row-1',
  targetItemTitle: 'Bike Flush',
  targetDomain: 'conditioning',
  requestedChange: 'duration',
  newValue: { durationMinutes: 60 },
  newDuration: { durationMinutes: 60 },
  newDurationMinutes: 60,
  preserveModalityAndType: true,
  missingFields: [],
  confidence: 0.9,
  naturalLanguageReason: 'test',
  command: editWithoutSourceCommand,
};
const duplicateCheck = verifyProgramEditVisibleMutation({
  edit: editForVerifier,
  beforeWorkout,
  afterWorkout: duplicateAfter,
  targetDate: TARGET,
});
eq('duplicate conditioning creation fails verifier',
  duplicateCheck.ok,
  false);
eq('duplicate verifier reason is explicit',
  duplicateCheck.reason,
  'duplicate_conditioning_created');

const removeVerifierBefore = conditioningWorkout('Lower Squat', ['Rower Flush', 'Sprint Session']);
const removeVerifierEdit: ProgramEdit = {
  intent: 'remove',
  editScope: 'remove_conditioning_item',
  targetDate: TARGET,
  targetSessionId: removeVerifierBefore.id,
  targetItemId: 'conditioning-row-1',
  targetItemTitle: 'Rower Flush',
  targetDomain: 'conditioning',
  requestedChange: 'type',
  newValue: { modality: 'row', targetItemId: 'conditioning-row-1' },
  missingFields: [],
  confidence: 0.9,
  naturalLanguageReason: 'test targeted removal',
  command: removeAmbiguousCommand,
};
const removeWrongAfter = {
  ...removeVerifierBefore,
  exercises: removeVerifierBefore.exercises.filter((ex: any) => ex.id !== 'conditioning-row-2'),
  conditioningBlock: {
    ...removeVerifierBefore.conditioningBlock,
    options: removeVerifierBefore.conditioningBlock.options.filter((_: any, index: number) => index !== 1),
  },
};
const removeWrongCheck = verifyProgramEditVisibleMutation({
  edit: removeVerifierEdit,
  beforeWorkout: removeVerifierBefore,
  afterWorkout: removeWrongAfter,
  targetDate: TARGET,
});
eq('targeted removal verifier rejects wrong item removal',
  removeWrongCheck.ok,
  false);
eq('targeted removal verifier names target still visible',
  removeWrongCheck.reason,
  'remove_target_still_visible');
const removeCorrectAfter = {
  ...removeVerifierBefore,
  exercises: removeVerifierBefore.exercises.filter((ex: any) => ex.id !== 'conditioning-row-1'),
  conditioningBlock: {
    ...removeVerifierBefore.conditioningBlock,
    options: removeVerifierBefore.conditioningBlock.options.filter((_: any, index: number) => index !== 0),
  },
};
const removeCorrectCheck = verifyProgramEditVisibleMutation({
  edit: removeVerifierEdit,
  beforeWorkout: removeVerifierBefore,
  afterWorkout: removeCorrectAfter,
  targetDate: TARGET,
});
eq('targeted removal verifier accepts only target removed',
  removeCorrectCheck.ok,
  true);

section('6. Duration-only conditioning edits update existing items in place');

const durationAssaultBikeWorkout = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min Assault Bike)',
  '25min easy Assault Bike. Intensity: 3-4/10 — genuinely easy, conversational pace.',
);
const messyOneHourEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'can u make dat lonfer, like 1 hr?',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, durationAssaultBikeWorkout)],
});
eq('messy one-hour request is duration-only',
  messyOneHourEdit.editScope,
  'duration_only' as any);
eq('messy one-hour request binds the existing assault bike item',
  messyOneHourEdit.targetItemId,
  'rower-phase');
eq('messy one-hour request normalizes to 60 minutes',
  (messyOneHourEdit.newValue as any)?.durationMinutes,
  60);
const messyOneHourApply = runConditioningProgramEdit(
  messyOneHourEdit,
  durationAssaultBikeWorkout,
);
eq('duration-only executor keeps one conditioning item',
  messyOneHourApply.written?.exercises?.length,
  1);
eq('duration-only executor keeps the Easy Aerobic Flush identity',
  messyOneHourApply.written?.exercises?.[0]?.exercise?.name,
  'Easy Aerobic Flush (60min Assault Bike)');
eq('duration-only executor updates the visible prescription to 60min',
  messyOneHourApply.written?.exercises?.[0]?.prescribedRepsMin,
  60);
eq('duration-only event preserves the typed target item id',
  messyOneHourApply.eventPayload?.targetItemId,
  'rower-phase');
eq('duration-only event does not downgrade to append scope',
  messyOneHourApply.eventPayload?.editScope,
  'edit_duration_only');
const messyOneHourVisibleCheck = verifyProgramEditVisibleMutation({
  edit: messyOneHourEdit,
  beforeWorkout: durationAssaultBikeWorkout,
  afterWorkout: messyOneHourApply.written,
  targetDate: TARGET,
});
eq('duration-only verifier accepts the in-place 60min update',
  messyOneHourVisibleCheck.ok,
  true);

const durationRowerWorkout = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min Rower)',
  '25min easy Rower. Intensity: 3-4/10 — genuinely easy, conversational pace.',
);
const rower45Edit = interpretCoachMessageToProgramEdit({
  userMessage: 'make it 45 mins',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, durationRowerWorkout)],
});
eq('rower duration request is duration-only',
  rower45Edit.editScope,
  'duration_only' as any);
const rower45Apply = runConditioningProgramEdit(rower45Edit, durationRowerWorkout);
eq('rower duration edit keeps one item',
  rower45Apply.written?.exercises?.length,
  1);
eq('rower duration edit preserves modality in the title',
  rower45Apply.written?.exercises?.[0]?.exercise?.name,
  'Easy Aerobic Flush (45min Rower)');
eq('rower duration edit updates prescription to 45min',
  rower45Apply.written?.exercises?.[0]?.prescribedRepsMin,
  45);

let duplicateDurationCurrent = durationAssaultBikeWorkout;
let duplicateRollback: any = null;
const duplicateDurationResult = executeProgramEdit({
  programEdit: messyOneHourEdit,
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  userMessage: 'can u make dat lonfer, like 1 hr?',
  conditioningDeps: {
    snapshotBefore: () => duplicateDurationCurrent,
    snapshotAfter: () => duplicateDurationCurrent,
    applyEvents: (events: any[]) => {
      duplicateDurationCurrent = conditioningWorkout(
        'Easy Aerobic Flush',
        ['Easy Aerobic Flush (25min Assault Bike)', 'Light Bike'],
      );
      return {
        applied: events.map((event) => ({
          date: event.date,
          eventIds: [event.id],
          workoutName: 'Easy Aerobic Flush',
        })),
        rejected: [],
      };
    },
    verifyRendered: (args: any) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Easy Aerobic Flush',
      targetWorkoutAfterName: 'Easy Aerobic Flush',
      beforeHasConditioning: true,
      afterHasConditioning: true,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: true,
      dayWorkoutProjectionHasConditioning: true,
      expectedActivityTitle: args.expectedActivityTitle,
      programTabProjectionHasExpectedActivity: true,
      dayWorkoutProjectionHasExpectedActivity: true,
    }),
    rollback: (plan: any, opts: any) => {
      duplicateRollback = { plan, opts };
      duplicateDurationCurrent = plan.dateOverrides[0]?.workout;
      return {
        executed: true,
        verification: {
          perDate: [],
          preferenceMatches: true,
          fullyVerified: true,
        },
      };
    },
    newEventId: () => 'duplicate-duration-event',
  },
  undoDeps: {
    readDateOverride: () => ({ workout: durationAssaultBikeWorkout, context: null }),
  },
});
eq('duration-only duplicate result refuses the unsafe mutation',
  duplicateDurationResult.kind,
  'verified_no_op' as any);
ok('duration-only duplicate verifier triggers rollback',
  !!duplicateRollback,
  duplicateDurationResult);
eq('duration-only duplicate rollback restores target date',
  duplicateRollback?.plan?.dateOverrides?.[0]?.date,
  TARGET);

section('7. Executor rolls back failed verified mutations');

const rollbackCommand: CoachCommand = {
  mode: 'mutate',
  operation: 'add_conditioning',
  target: { kind: 'date', date: TARGET, sessionName: 'Lower Squat' },
  payload: {
    operation: 'add_conditioning',
    modality: 'ski' as any,
    customActivity: 'SkiErg',
    durationMinutes: 10,
  } as any,
  scope: 'one_off',
  confidence: 0.9,
  needsClarification: false,
  reason: 'test:verified_failure_rollback',
};
const rollbackEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'add 10 min ski erg today',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  currentWeek: [visibleDay(TARGET, multiWorkout)],
  candidateCommand: rollbackCommand,
});
let rollbackCall: any = null;
const rollbackResult = executeProgramEdit({
  programEdit: rollbackEdit,
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Lower Squat'),
  userMessage: 'add 10 min ski erg today',
  conditioningDeps: {
    applyEvents: (events: any[]) => ({
      applied: events.map((event) => ({
        date: event.date,
        eventIds: [event.id],
        workoutName: 'Lower Squat',
      })),
      rejected: [],
    }),
    verifyRendered: (args: any) => ({
      requestedDay: args.requestedDay,
      todayISO: args.todayISO,
      targetDate: args.targetDate,
      targetWorkoutBeforeName: 'Lower Squat',
      targetWorkoutAfterName: 'Lower Squat',
      beforeHasConditioning: true,
      afterHasConditioning: false,
      overrideKeyWritten: true,
      programTabProjectionHasConditioning: false,
      dayWorkoutProjectionHasConditioning: false,
      expectedActivityTitle: args.expectedActivityTitle,
      programTabProjectionHasExpectedActivity: false,
      dayWorkoutProjectionHasExpectedActivity: false,
    }),
    snapshotBefore: () => multiWorkout,
    rollback: (plan: any, opts: any) => {
      rollbackCall = { plan, opts };
      return {
        executed: true,
        verification: {
          perDate: [],
          preferenceMatches: true,
          fullyVerified: true,
        },
      };
    },
    newEventId: () => 'test-rollback-event',
  },
  undoDeps: {
    readDateOverride: () => ({ workout: null, context: null }),
  },
});
eq('failed verified mutation returns no-op',
  rollbackResult.kind,
  'verified_no_op' as any);
ok('failed verified mutation rolls back',
  !!rollbackCall,
  rollbackResult);
eq('rollback targets the edited date',
  rollbackCall?.plan?.dateOverrides?.[0]?.date,
  TARGET);

section('7. coach_uses_same_resolved_visible_items_as_program_screen');

const visibleRowerWorkout = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min Rower)',
  [
    '25min easy Rower.',
    'Intensity: 3-4/10 — genuinely easy, conversational pace.',
    'Optional. Use this for recovery and aerobic maintenance.',
  ].join('\n'),
);
const visibleState = {
  currentProgram: null,
  currentMicrocycle: null,
  manualOverrides: { [TARGET]: visibleRowerWorkout },
  markedDays: {},
  athleteContext: {},
  seasonPhase: null,
  readiness: 'medium',
  sessionFeedback: {},
  weightOverrides: {},
  activeInjury: null,
  activeConstraints: [],
} as any;
const programScreenVisible = getResolvedVisibleProgramForDate({
  date: TARGET,
  todayISO: TODAY,
  state: visibleState,
  overrideContexts: {},
  modalityPreferences: {},
});
const programScreenConditioningItems = programScreenVisible.conditioningItems;
eq('program screen resolver sees Wednesday Easy Aerobic Flush',
  programScreenVisible.day.workout?.name,
  'Easy Aerobic Flush');
eq('program screen resolver sees exactly one visible conditioning item',
  programScreenConditioningItems.length,
  1);
eq('program screen visible item is the rower card',
  programScreenConditioningItems[0]?.title,
  'Easy Aerobic Flush (25min Rower)');
eq('program screen visible item modality is row',
  programScreenConditioningItems[0]?.modality,
  'row' as any);
eq('program screen visible item duration is 25min',
  programScreenConditioningItems[0]?.durationMinutes,
  25);

const sameVisibleResolver = (date: string) =>
  date === TARGET ? programScreenVisible : null;
const skiFromVisibleState = interpretCoachMessageToProgramEdit({
  userMessage: 'Can you please change Wednesday to a ski?',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [],
  resolveVisibleProgramForDate: sameVisibleResolver,
});
eq('coach resolver uses same visible item as program screen',
  skiFromVisibleState.candidateItems?.[0]?.id,
  programScreenConditioningItems[0]?.id);
eq('coach does not ask clarification when one visible conditioning item exists',
  skiFromVisibleState.intent,
  'edit' as any);
eq('coach visible item edit declares modality-only scope',
  skiFromVisibleState.editScope,
  'modality_only' as any);
eq('ProgramEdit targetItemId points to the Rower item',
  skiFromVisibleState.targetItemId,
  'rower-phase');
eq('ProgramEdit newValue from modality is row',
  (skiFromVisibleState.newValue as any)?.from,
  'row' as any);
eq('ProgramEdit newValue modality is SkiErg',
  (skiFromVisibleState.newValue as any)?.to,
  'ski' as any);
ok('no clarification field remains',
  !skiFromVisibleState.missingFields.includes('targetItemId'),
  skiFromVisibleState);

const visibleSkiWorkout = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min SkiErg)',
  '25min easy SkiErg. Intensity: 3-4/10 — genuinely easy, conversational pace.',
);
const noDuplicateVisibleCheck = verifyProgramEditVisibleMutation({
  edit: skiFromVisibleState,
  beforeWorkout: visibleRowerWorkout,
  afterWorkout: visibleSkiWorkout,
  targetDate: TARGET,
});
eq('verifier accepts existing item update without duplicate',
  noDuplicateVisibleCheck.ok,
  true);

let capturedSwapEvents: any[] = [];
const skiOutcome = orchestrateModalitySwap({
  userMessage: 'Can you please change Wednesday to a ski?',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  parsedSwap: {
    from: (skiFromVisibleState.newValue as any)?.from,
    to: (skiFromVisibleState.newValue as any)?.to,
    toToken: 'ski erg',
    fromInferred: false,
    bikeLabel: null,
    targetedSession: true,
  },
  applyEvents: (events: any[]) => {
    capturedSwapEvents = events;
    return {
      applied: events.map((event) => ({
        date: event.date,
        eventIds: [event.id],
        workoutName: 'Easy Aerobic Flush',
      })),
      rejected: [],
    };
  },
  verifyProjectionsFn: () => ({
    programTabShowsTo: true,
    programTabStillShowsFrom: false,
    dayWorkoutShowsTo: true,
    dayWorkoutStillShowsFrom: false,
    bothProjectionsShowTo: true,
  }),
});
eq('executor path applies the modality swap',
  skiOutcome.kind,
  'applied' as any);
eq('executor updates existing rower modality',
  capturedSwapEvents[0]?.before?.modality,
  'row' as any);
eq('executor writes SkiErg modality',
  capturedSwapEvents[0]?.after?.modality,
  'ski' as any);
eq('executor targets Wednesday only',
  capturedSwapEvents[0]?.date,
  TARGET);

section('8. Pending ProgramEdit item clarifier completes from visible answers');

const rowerBikeWorkout = conditioningWorkout('Easy Aerobic Flush', ['Rower Flush', 'Bike Flush']);
const firstSkiEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'Can you change Wednesday to a ski erg',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, rowerBikeWorkout)],
});
eq('initial ski-erg edit asks for missing item',
  firstSkiEdit.intent,
  'ask_question' as any);
ok('initial ski-erg edit stores targetItemId as missing',
  firstSkiEdit.missingFields.includes('targetItemId'),
  firstSkiEdit);

const rowerPending = pendingFromEdit(firstSkiEdit);
const rowerCompletion = resolvePendingProgramEditAnswer({
  pending: rowerPending,
  userMessage: 'The rower obviously',
  currentWeek: [visibleDay(TARGET, rowerBikeWorkout)],
});
eq('annoyed rower answer completes pending edit',
  rowerCompletion.kind,
  'complete' as any);
if (rowerCompletion.kind === 'complete') {
  eq('rower answer fills targetItemId',
    rowerCompletion.programEdit.targetItemId,
    'conditioning-row-1');
  eq('rower answer restores modality edit intent',
    rowerCompletion.programEdit.intent,
    'edit' as any);
  eq('rower answer restores modality-only scope',
    rowerCompletion.programEdit.editScope,
    'modality_only' as any);
  eq('rower answer clears missing fields',
    rowerCompletion.programEdit.missingFields.includes('targetItemId'),
    false);
  eq('rower answer sets source modality on command',
    ((rowerCompletion.programEdit.command as any)?.payload)?.from,
    'row');
  eq('ski erg target stays ski',
    ((rowerCompletion.programEdit.command as any)?.payload)?.to,
    'ski');
  const noDuplicateCheck = verifyProgramEditVisibleMutation({
    edit: rowerCompletion.programEdit,
    beforeWorkout: rowerBikeWorkout,
    afterWorkout: conditioningWorkout('Easy Aerobic Flush', ['SkiErg Flush', 'Bike Flush']),
    targetDate: TARGET,
  });
  eq('rower replacement verifier accepts no duplicate item',
    noDuplicateCheck.ok,
    true);
  let swapEvents: any[] = [];
  const swapOutcome = orchestrateModalitySwap({
    userMessage: 'The rower obviously',
    todayISO: TODAY,
    referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
    parsedSwap: {
      from: ((rowerCompletion.programEdit.command as any)?.payload)?.from,
      to: ((rowerCompletion.programEdit.command as any)?.payload)?.to,
      toToken: 'ski erg',
      fromInferred: false,
      bikeLabel: null,
      targetedSession: true,
    },
    applyEvents: (events: any[]) => {
      swapEvents = events;
      return {
        applied: events.map((event) => ({
          date: event.date,
          eventIds: [event.id],
          workoutName: 'Easy Aerobic Flush',
        })),
        rejected: [],
      };
    },
    verifyProjectionsFn: () => ({
      programTabShowsTo: true,
      programTabStillShowsFrom: false,
      dayWorkoutShowsTo: true,
      dayWorkoutStillShowsFrom: false,
      bothProjectionsShowTo: true,
    }),
  });
  eq('structured pending answer executes as modality swap',
    swapOutcome.kind,
    'applied' as any);
  eq('structured swap event removes row',
    swapEvents[0]?.before?.modality,
    'row');
  eq('structured swap event applies ski',
    swapEvents[0]?.after?.modality,
    'ski');
}

usePendingCoachClarifierStore.getState().setPending(rowerPending);
if (rowerCompletion.kind === 'complete') {
  usePendingCoachClarifierStore.getState().clearPending();
}
eq('successful pending ProgramEdit completion clears pending state',
  getPendingClarifierSnapshot(),
  null);

const bikeCompletion = completeTargetForAnswer('the bike', rowerBikeWorkout);
eq('"the bike" completes pending edit',
  bikeCompletion.result.kind,
  'complete' as any);
if (bikeCompletion.result.kind === 'complete') {
  eq('"the bike" targets bike item',
    bikeCompletion.result.programEdit.targetItemId,
    'conditioning-row-2');
  eq('"the bike" source modality',
    ((bikeCompletion.result.programEdit.command as any)?.payload)?.from,
    'bike');
}

const runCompletion = completeTargetForAnswer(
  'the run',
  conditioningWorkout('Easy Aerobic Flush', ['Run Flush', 'Bike Flush']),
);
eq('"the run" completes pending edit',
  runCompletion.result.kind,
  'complete' as any);
if (runCompletion.result.kind === 'complete') {
  eq('"the run" targets run item',
    runCompletion.result.programEdit.targetItemId,
    'conditioning-row-1');
}

const singleCandidateWorkout = conditioningWorkout('Easy Aerobic Flush', ['Rower Flush']);
const singleCandidateItems = [{
  id: 'conditioning-row-1',
  title: 'Rower Flush',
  domain: 'conditioning' as const,
  modality: 'row' as any,
  durationMinutes: 25,
  source: 'conditioning_option' as const,
}];
const singleConditioningPending = pendingFromEdit({
  ...firstSkiEdit,
  intent: 'ask_question',
  targetItemId: null,
  targetItemTitle: null,
  missingFields: ['targetItemId'],
  candidateItems: singleCandidateItems,
  question: 'Which item should I change?',
}, 'Can you change Wednesday to a ski erg');
const singleConditioningCompletion = resolvePendingProgramEditAnswer({
  pending: {
    ...singleConditioningPending,
    candidateItems: singleCandidateItems,
    programEdit: {
      ...singleConditioningPending.programEdit!,
      candidateItems: singleCandidateItems,
    },
  },
  userMessage: 'conditioning',
  currentWeek: [visibleDay(TARGET, singleCandidateWorkout)],
});
eq('"conditioning" resolves when there is one visible item',
  singleConditioningCompletion.kind,
  'complete' as any);
if (singleConditioningCompletion.kind === 'complete') {
  eq('"conditioning" targets only item',
    singleConditioningCompletion.programEdit.targetItemId,
    'conditioning-row-1');
}

const flushCompletion = completeTargetForAnswer(
  'the flush',
  conditioningWorkout('Easy Aerobic Flush', ['Rower Flush', 'Bike Sprint']),
);
eq('"the flush" completes by title match',
  flushCompletion.result.kind,
  'complete' as any);
if (flushCompletion.result.kind === 'complete') {
  eq('"the flush" targets flush item',
    flushCompletion.result.programEdit.targetItemId,
    'conditioning-row-1');
}

const typoCompletion = completeTargetForAnswer('rowr', rowerBikeWorkout);
eq('typo "rowr" completes pending edit',
  typoCompletion.result.kind,
  'complete' as any);
if (typoCompletion.result.kind === 'complete') {
  eq('typo "rowr" targets rower item',
    typoCompletion.result.programEdit.targetItemId,
    'conditioning-row-1');
}

const multiRowerWorkout = conditioningWorkout('Easy Aerobic Flush', ['Rower Flush', 'Rower Sprint', 'Bike Flush']);
const multiRower = completeTargetForAnswer('the rower obviously', multiRowerWorkout);
eq('multiple rower items ask a better clarification',
  multiRower.result.kind,
  'clarify' as any);
if (multiRower.result.kind === 'clarify') {
  ok('better clarification offers rower item options',
    (multiRower.result.options ?? []).includes('Rower Flush') &&
      (multiRower.result.options ?? []).includes('Rower Sprint'),
    multiRower.result);
  ok('better clarification is not the same generic question',
    multiRower.result.reply !== multiRower.initialEdit.question &&
      /Rower Flush/i.test(multiRower.result.reply) &&
      /Rower Sprint/i.test(multiRower.result.reply),
    multiRower.result.reply);
}

section('9. Normalization is centralized');

eq('duration typo normalization is central',
  normalizeCoachEditMessage('can u make dat lonfer'),
  'can you make that longer');
eq('duration format normalization preserves meaning',
  normalizeCoachEditMessage('make it 60 mins'),
  'make it 60 minutes');
eq('hour shorthand normalization preserves meaning',
  normalizeCoachEditMessage('make it 1 hr'),
  'make it 1 hour');

section('10. Conditioning type replacement is atomic, not layered');

const rowerFlushForReplacement = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min Rower)',
  '25min easy Rower. Intensity: 3-4/10 — genuinely easy, conversational pace.',
);
const rowerVisibleForReplacement = getResolvedVisibleProgramForDate({
  date: TARGET,
  todayISO: TODAY,
  state: {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: { [TARGET]: rowerFlushForReplacement },
    markedDays: {},
    athleteContext: {},
    seasonPhase: null,
    readiness: 'medium',
    sessionFeedback: {},
    weightOverrides: {},
    activeInjury: null,
    activeConstraints: [],
  } as any,
  overrideContexts: {},
  modalityPreferences: {},
});
const assaultBikeSprintEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'make it assault bike sprints',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, rowerFlushForReplacement)],
  resolveVisibleProgramForDate: (date) => date === TARGET ? rowerVisibleForReplacement : null,
});
eq('assault bike sprints is a replacement, not modality-only',
  assaultBikeSprintEdit.editScope,
  'replace_conditioning_prescription' as any);
eq('assault bike sprints changes conditioning type',
  assaultBikeSprintEdit.requestedChange,
  'type' as any);
eq('assault bike sprints targets the existing rower item',
  assaultBikeSprintEdit.targetItemId,
  'rower-phase');
eq('assault bike sprints preserves assault bike wording',
  (assaultBikeSprintEdit.newValue as any)?.activity,
  'Assault Bike Sprints');
eq('assault bike sprints captures sprint intent',
  (assaultBikeSprintEdit.newValue as any)?.trainingIntent,
  'sprint');

const assaultBikeSprintApply = runConditioningProgramEdit(
  assaultBikeSprintEdit,
  rowerFlushForReplacement,
);
eq('replacement executor mutates successfully',
  assaultBikeSprintApply.result.kind,
  'mutated' as any);
eq('replacement event carries replacement scope',
  assaultBikeSprintApply.eventPayload?.editScope,
  'replace_conditioning_prescription');
eq('replacement rewrites standalone session title',
  assaultBikeSprintApply.written?.name,
  'Assault Bike Sprints');
eq('replacement leaves one conditioning exercise',
  assaultBikeSprintApply.written?.exercises?.length,
  1);
ok('replacement clears Easy Aerobic Flush copy from visible fields',
  !/Easy Aerobic Flush|25min easy|3-4\/10|aerobic maintenance/i.test([
    assaultBikeSprintApply.written?.name,
    assaultBikeSprintApply.written?.description,
    assaultBikeSprintApply.written?.conditioningBlock?.options?.[0]?.title,
    assaultBikeSprintApply.written?.conditioningBlock?.options?.[0]?.description,
    assaultBikeSprintApply.written?.exercises?.[0]?.exercise?.name,
    assaultBikeSprintApply.written?.exercises?.[0]?.notes,
  ].join(' ')),
  assaultBikeSprintApply.written);
ok('replacement writes sprint prescription',
  /6\s*x\s*20-30s|6 × 20-30s/i.test([
    assaultBikeSprintApply.written?.conditioningBlock?.options?.[0]?.description,
    assaultBikeSprintApply.written?.exercises?.[0]?.notes,
  ].join(' ')) &&
    Number(assaultBikeSprintApply.written?.exercises?.[0]?.restSeconds) === 120,
  assaultBikeSprintApply.written);

const sprintThirtyMinutesFollowUp = interpretCoachMessageToProgramEdit({
  userMessage: 'Actually make it an easy 30 min session',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Assault Bike Sprints'),
  currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: TARGET, sessionName: 'Assault Bike Sprints' },
    appliedAt: Date.now(),
    userMessage: 'Actually make it assault bike sprints',
    appliedReply: 'Done. I replaced Easy Aerobic Flush with assault bike sprints.',
    touchedActivities: [{
      kind: 'conditioning',
      date: TARGET,
      sessionName: 'Assault Bike Sprints',
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
eq('30 min follow-up after sprint replacement asks instead of mutating',
  sprintThirtyMinutesFollowUp.intent,
  'ask_question' as any);
ok('30 min follow-up asks for duration scope',
  sprintThirtyMinutesFollowUp.missingFields.includes('duration_scope'),
  sprintThirtyMinutesFollowUp);
ok('30 min follow-up binds sprint item before asking',
  sprintThirtyMinutesFollowUp.targetItemTitle === 'Assault Bike Sprints' &&
    sprintThirtyMinutesFollowUp.targetItemId != null,
  sprintThirtyMinutesFollowUp);
ok('30 min follow-up question names the ambiguity',
  /whole .*session/i.test(sprintThirtyMinutesFollowUp.question ?? '') &&
    /sprint efforts/i.test(sprintThirtyMinutesFollowUp.question ?? '') &&
    /recovery between reps/i.test(sprintThirtyMinutesFollowUp.question ?? ''),
  sprintThirtyMinutesFollowUp.question);
eq('30 min follow-up keeps proposed minutes in the pending draft',
  (sprintThirtyMinutesFollowUp.newValue as any)?.durationMinutes,
  30);
eq('30 min follow-up keeps easy intent in the pending draft',
  (sprintThirtyMinutesFollowUp.newValue as any)?.trainingIntent,
  'low_load');
const sprintThirtyMinutesResult = executeProgramEdit({
  programEdit: sprintThirtyMinutesFollowUp,
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Assault Bike Sprints'),
  userMessage: 'Actually make it an easy 30 min session',
});
eq('30 min follow-up executor returns clarify',
  sprintThirtyMinutesResult.kind,
  'clarify' as any);
ok('30 min follow-up executor does not apply',
  sprintThirtyMinutesResult.applied === false);

const sprintDurationScopePending = pendingFromEdit(
  sprintThirtyMinutesFollowUp,
  'Actually make it an easy 30 min session',
);
const expectedDurationScopeOptions = [
  '30-minute total session',
  'Sprint effort length',
  'Recovery between reps',
];
eq('duration-scope ProgramEdit preserves pending value',
  (sprintThirtyMinutesFollowUp.newValue as any)?.durationMinutes,
  30);
eq('duration-scope ProgramEdit preserves pending target item',
  sprintThirtyMinutesFollowUp.targetItemId,
  assaultBikeSprintEdit.targetItemId);
eq('duration-scope ProgramEdit preserves pending options',
  sprintThirtyMinutesFollowUp.options,
  expectedDurationScopeOptions);
eq('duration-scope pending entry preserves options',
  sprintDurationScopePending.programEdit?.options,
  expectedDurationScopeOptions);
const wholeSessionCompletion = resolvePendingProgramEditAnswer({
  pending: sprintDurationScopePending,
  userMessage: 'Whole session',
  currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
});
eq('whole-session answer completes the pending duration-scope edit',
  wholeSessionCompletion.kind,
  'complete' as any);
if (wholeSessionCompletion.kind === 'complete') {
  const wholeSessionEdit = wholeSessionCompletion.programEdit;
  eq('whole-session completion is an atomic conditioning replacement',
    wholeSessionEdit.editScope,
    'replace_conditioning_prescription' as any);
  eq('whole-session completion keeps the 30-minute draft value',
    (wholeSessionEdit.newValue as any)?.durationMinutes,
    30);
  ok('whole-session completion preserves Assault Bike without preserving sprint wording',
    /Assault Bike/i.test((wholeSessionEdit.newValue as any)?.activity ?? '') &&
      !/sprints?/i.test((wholeSessionEdit.newValue as any)?.activity ?? ''),
    wholeSessionEdit.newValue);
  eq('whole-session completion marks the replacement low-load',
    (wholeSessionEdit.newValue as any)?.trainingIntent,
    'low_load');

  const wholeSessionApply = runConditioningProgramEdit(
    wholeSessionEdit,
    assaultBikeSprintApply.written,
  );
  eq('whole-session completion mutates successfully',
    wholeSessionApply.result.kind,
    'mutated' as any);
  ok('whole-session completion rewrites the visible title',
    /Easy Assault Bike/i.test(wholeSessionApply.written?.name ?? '') &&
      !/sprints?/i.test(wholeSessionApply.written?.name ?? ''),
    wholeSessionApply.written?.name);
  eq('whole-session completion writes standalone duration',
    Number(wholeSessionApply.written?.durationMinutes),
    30);
  eq('whole-session completion writes duration-minute prescription',
    wholeSessionApply.written?.exercises?.[0]?.prescriptionType,
    'duration_minutes');
  eq('whole-session completion writes 30 minutes onto the exercise',
    [
      Number(wholeSessionApply.written?.exercises?.[0]?.prescribedRepsMin),
      Number(wholeSessionApply.written?.exercises?.[0]?.prescribedRepsMax),
    ],
    [30, 30]);
  eq('whole-session completion clears sprint rest',
    Number(wholeSessionApply.written?.exercises?.[0]?.restSeconds),
    0);
  ok('whole-session completion clears stale sprint copy',
    !/20-30s|sprints?|near-max|power drops/i.test([
      wholeSessionApply.written?.name,
      wholeSessionApply.written?.description,
      wholeSessionApply.written?.conditioningBlock?.options?.[0]?.title,
      wholeSessionApply.written?.conditioningBlock?.options?.[0]?.description,
      wholeSessionApply.written?.exercises?.[0]?.exercise?.name,
      wholeSessionApply.written?.exercises?.[0]?.notes,
    ].join(' ')),
    wholeSessionApply.written);
}
const sprintEffortScopeAnswer = resolvePendingProgramEditAnswer({
  pending: sprintDurationScopePending,
  userMessage: 'Sprint effort length',
  currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
});
eq('sprint-effort answer stays inside pending typed resolution',
  sprintEffortScopeAnswer.kind,
  'clarify' as any);
ok('sprint-effort answer asks for the missing effort duration',
  sprintEffortScopeAnswer.kind === 'clarify' &&
    sprintEffortScopeAnswer.programEdit.missingFields.includes('reps_duration') &&
    /how long/i.test(sprintEffortScopeAnswer.reply),
  sprintEffortScopeAnswer);
const recoveryScopeAnswer = resolvePendingProgramEditAnswer({
  pending: sprintDurationScopePending,
  userMessage: 'Recovery between reps',
  currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
});
eq('recovery answer stays inside pending typed resolution',
  recoveryScopeAnswer.kind,
  'clarify' as any);
ok('recovery answer asks for the missing recovery duration',
  recoveryScopeAnswer.kind === 'clarify' &&
    recoveryScopeAnswer.programEdit.missingFields.includes('rest_duration') &&
    /recovery/i.test(recoveryScopeAnswer.reply),
  recoveryScopeAnswer);

const assertDurationScopeStateCarried = (label: string, answer: any) => {
  ok(`${label} does not fall through to legacy`,
    answer.kind !== 'unresolved',
    answer);
  if (answer.kind === 'complete' || answer.kind === 'clarify') {
    eq(`${label} preserves pending target item`,
      answer.programEdit.targetItemId,
      sprintThirtyMinutesFollowUp.targetItemId);
    eq(`${label} preserves pending target title`,
      answer.programEdit.targetItemTitle,
      'Assault Bike Sprints');
    eq(`${label} preserves pending 30 min value`,
      (answer.programEdit.newValue as any)?.durationMinutes,
      30);
    eq(`${label} resolves from typed pending ProgramEdit`,
      answer.programEdit.source,
      'pending_clarifier' as any);
  }
};

for (const answerText of [
  'whole session',
  'the whole thing',
  '30 mins for the full session',
  'not the reps, the session',
]) {
  const answer = resolvePendingProgramEditAnswer({
    pending: sprintDurationScopePending,
    userMessage: answerText,
    currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
  });
  assertDurationScopeStateCarried(`duration-scope answer "${answerText}"`, answer);
  eq(`duration-scope answer "${answerText}" completes to typed replacement`,
    answer.kind,
    'complete' as any);
  if (answer.kind === 'complete') {
    eq(`duration-scope answer "${answerText}" keeps replacement scope`,
      answer.programEdit.editScope,
      'replace_conditioning_prescription' as any);
    const apply = runConditioningProgramEdit(
      answer.programEdit,
      assaultBikeSprintApply.written,
    );
    ok(`duration-scope answer "${answerText}" verifies before Done`,
      apply.result.kind === 'mutated' &&
        apply.result.applied === true &&
        /^Done\b/.test(apply.result.reply),
      apply.result);
  }
}

for (const variant of [
  { answerText: 'the sprints', missingField: 'reps_duration', replyPattern: /sprint effort/i },
  { answerText: 'the efforts', missingField: 'reps_duration', replyPattern: /sprint effort/i },
  { answerText: 'the recovery', missingField: 'rest_duration', replyPattern: /recovery/i },
  { answerText: 'between reps', missingField: 'rest_duration', replyPattern: /recovery/i },
]) {
  const answer = resolvePendingProgramEditAnswer({
    pending: sprintDurationScopePending,
    userMessage: variant.answerText,
    currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
  });
  assertDurationScopeStateCarried(`duration-scope answer "${variant.answerText}"`, answer);
  eq(`duration-scope answer "${variant.answerText}" stays typed clarify`,
    answer.kind,
    'clarify' as any);
  ok(`duration-scope answer "${variant.answerText}" asks for ${variant.missingField}`,
    answer.kind === 'clarify' &&
      answer.programEdit.missingFields.includes(variant.missingField) &&
      variant.replyPattern.test(answer.reply),
    answer);
}

const unclearDurationScopeAnswer = resolvePendingProgramEditAnswer({
  pending: sprintDurationScopePending,
  userMessage: 'yeah',
  currentWeek: [visibleDay(TARGET, assaultBikeSprintApply.written)],
});
assertDurationScopeStateCarried('unclear duration-scope answer "yeah"', unclearDurationScopeAnswer);
eq('unclear duration-scope answer asks again instead of legacy',
  unclearDurationScopeAnswer.kind,
  'clarify' as any);
ok('unclear duration-scope answer preserves scope field',
  unclearDurationScopeAnswer.kind === 'clarify' &&
    unclearDurationScopeAnswer.programEdit.missingFields.includes('duration_scope'),
  unclearDurationScopeAnswer);
eq('unclear duration-scope answer preserves options',
  unclearDurationScopeAnswer.kind === 'clarify'
    ? unclearDurationScopeAnswer.options
    : null,
  expectedDurationScopeOptions as any);

const skiFlushForReplacement = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min SkiErg)',
  '25min easy SkiErg. Intensity: 3-4/10 — genuinely easy, conversational pace.',
);
const skiVisibleForReplacement = getResolvedVisibleProgramForDate({
  date: TARGET,
  todayISO: TODAY,
  state: {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: { [TARGET]: skiFlushForReplacement },
    markedDays: {},
    athleteContext: {},
    seasonPhase: null,
    readiness: 'medium',
    sessionFeedback: {},
    weightOverrides: {},
    activeInjury: null,
    activeConstraints: [],
  } as any,
  overrideContexts: {},
  modalityPreferences: {},
});
const skiToSprintEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'actually make it an assault bike sprints',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, skiFlushForReplacement)],
  resolveVisibleProgramForDate: (date) => date === TARGET ? skiVisibleForReplacement : null,
});
eq('ski flush to assault bike sprints is whole prescription replacement',
  skiToSprintEdit.editScope,
  'replace_conditioning_prescription' as any);
eq('ski flush replacement does not stay modality-only',
  skiToSprintEdit.requestedChange,
  'type' as any);
const skiToSprintApply = runConditioningProgramEdit(skiToSprintEdit, skiFlushForReplacement);
eq('ski flush replacement rewrites one coherent session',
  skiToSprintApply.written?.name,
  'Assault Bike Sprints');
eq('ski flush replacement has one primary conditioning card',
  skiToSprintApply.written?.conditioningBlock?.options?.length,
  1);

const staleRowerHistorySkiSprintEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'Actually make it ski erg sprints',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, skiFlushForReplacement)],
  resolveVisibleProgramForDate: (date) => date === TARGET ? skiVisibleForReplacement : null,
  lastChange: {
    operation: 'add_conditioning',
    target: { kind: 'date', date: TARGET, sessionName: 'Easy Aerobic Flush' },
    appliedAt: Date.now(),
    userMessage: 'Can you change Wednesday to a ski erg?',
    appliedReply: 'Done — Wednesday is now on the ski erg instead of the rower.',
    touchedActivities: [{
      kind: 'conditioning',
      date: TARGET,
      sessionName: 'Easy Aerobic Flush',
      title: 'Easy Aerobic Flush (30min Rower)',
      modality: 'row',
      durationMinutes: 30,
    } as any],
  },
});
const staleRowerHistorySkiSprintApply = runConditioningProgramEdit(
  staleRowerHistorySkiSprintEdit,
  skiFlushForReplacement,
);
ok('SkiErg sprint reply does not mention stale rower source',
  !/\brower\b/i.test(staleRowerHistorySkiSprintApply.result.reply),
  staleRowerHistorySkiSprintApply.result.reply);
ok('SkiErg sprint reply uses current visible SkiErg source/final state',
  /\bSkiErg\b/i.test(staleRowerHistorySkiSprintApply.result.reply),
  staleRowerHistorySkiSprintApply.result.reply);
eq('SkiErg sprint replacement writes SkiErg title',
  staleRowerHistorySkiSprintApply.written?.name,
  'SkiErg Sprints');
ok('SkiErg sprint display copy has no bike wording',
  !/\bbike\b/i.test([
    staleRowerHistorySkiSprintApply.written?.name,
    staleRowerHistorySkiSprintApply.written?.description,
    staleRowerHistorySkiSprintApply.written?.conditioningBlock?.options?.[0]?.title,
    staleRowerHistorySkiSprintApply.written?.conditioningBlock?.options?.[0]?.description,
    staleRowerHistorySkiSprintApply.written?.exercises?.[0]?.exercise?.name,
    staleRowerHistorySkiSprintApply.written?.exercises?.[0]?.exercise?.description,
    staleRowerHistorySkiSprintApply.written?.exercises?.[0]?.notes,
  ].join(' ')),
  staleRowerHistorySkiSprintApply.written);
ok('SkiErg sprint display copy uses canonical SkiErg wording',
  /SkiErg/i.test([
    staleRowerHistorySkiSprintApply.written?.name,
    staleRowerHistorySkiSprintApply.written?.description,
    staleRowerHistorySkiSprintApply.written?.conditioningBlock?.options?.[0]?.title,
    staleRowerHistorySkiSprintApply.written?.conditioningBlock?.options?.[0]?.description,
    staleRowerHistorySkiSprintApply.written?.exercises?.[0]?.exercise?.name,
    staleRowerHistorySkiSprintApply.written?.exercises?.[0]?.exercise?.description,
    staleRowerHistorySkiSprintApply.written?.exercises?.[0]?.notes,
  ].join(' ')),
  staleRowerHistorySkiSprintApply.written);

const assaultBikeFlush = pureConditioningWorkout(
  'Easy Aerobic Flush',
  'Easy Aerobic Flush (25min Assault Bike)',
  '25min easy Assault Bike. Intensity: 3-4/10 — genuinely easy, conversational pace.',
);
const sprintThoughEdit = interpretCoachMessageToProgramEdit({
  userMessage: 'make it sprints though',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, assaultBikeFlush)],
  lastChange: {
    operation: 'swap_conditioning_modality_once',
    target: { kind: 'date', date: TARGET, sessionName: 'Easy Aerobic Flush' },
    appliedAt: Date.now(),
    userMessage: 'Actually make it an assault bike',
    appliedReply: 'Done — changed it to assault bike.',
  },
});
eq('sprints though upgrades previous modality edit to prescription replacement',
  sprintThoughEdit.editScope,
  'replace_conditioning_prescription' as any);
eq('sprints though keeps visible bike modality',
  (sprintThoughEdit.newValue as any)?.modality,
  'bike');
eq('sprints though keeps assault bike subtype',
  (sprintThoughEdit.newValue as any)?.bikeLabel,
  'assault');

const bikeDurationOnly = interpretCoachMessageToProgramEdit({
  userMessage: 'change the bike to 30 mins',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, assaultBikeFlush)],
});
eq('bike to 30 mins stays duration-only',
  bikeDurationOnly.editScope,
  'duration_only' as any);
eq('bike to 30 mins requestedChange is duration',
  bikeDurationOnly.requestedChange,
  'duration' as any);

const addAfterFlush = interpretCoachMessageToProgramEdit({
  userMessage: 'add some bike sprints after the flush',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, assaultBikeFlush)],
});
eq('add after flush remains add item',
  addAfterFlush.intent,
  'add' as any);
eq('add after flush carries add scope',
  addAfterFlush.editScope,
  'add_conditioning_item' as any);

const layeredBadAfter = conditioningWorkout(
  'Easy Aerobic Flush',
  ['Easy Aerobic Flush (25min Assault Bike)', 'sprints'],
);
const replacementVerifier = verifyProgramEditVisibleMutation({
  edit: assaultBikeSprintEdit,
  beforeWorkout: rowerFlushForReplacement,
  afterWorkout: layeredBadAfter,
  targetDate: TARGET,
});
eq('replacement verifier rejects duplicate layered conditioning',
  replacementVerifier.ok,
  false);
eq('replacement verifier names non-atomic replacement',
  replacementVerifier.reason,
  'replacement_conditioning_not_atomic');

section('11. Semantic roles protect context targets and prevent fake edits');

const constrainedConditioning = conditioningWorkout(
  'Wednesday Conditioning',
  ['Easy Aerobic Flush (25min Rower)', 'Sprint Session'],
);
const removeSprintKeepFlush = interpretCoachMessageToProgramEdit({
  userMessage: 'remove the sprint but keep the flush',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Wednesday Conditioning'),
  currentWeek: [visibleDay(TARGET, constrainedConditioning)],
});
eq('remove/keep intent becomes remove ProgramEdit',
  removeSprintKeepFlush.intent,
  'remove' as any);
eq('remove/keep intent removes sprint target',
  removeSprintKeepFlush.targetItemTitle,
  'Sprint Session');
ok('remove/keep intent protects flush target',
  (removeSprintKeepFlush.protectedTargets ?? []).some((item) =>
    /Easy Aerobic Flush/i.test(item.title),
  ),
  removeSprintKeepFlush);
const removeSprintKeepFlushApply = runConditioningProgramEdit(
  removeSprintKeepFlush,
  constrainedConditioning,
);
eq('remove/keep apply leaves one visible conditioning item',
  removeSprintKeepFlushApply.written?.conditioningBlock?.options?.length,
  1);
eq('remove/keep apply preserves flush',
  removeSprintKeepFlushApply.written?.conditioningBlock?.options?.[0]?.title,
  'Easy Aerobic Flush (25min Rower)');

const makeFlushEasierKeepSprints = interpretCoachMessageToProgramEdit({
  userMessage: 'make the flush easier but keep the sprints',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Wednesday Conditioning'),
  currentWeek: [visibleDay(TARGET, constrainedConditioning)],
});
eq('easier/keep does not become replacement',
  makeFlushEasierKeepSprints.intent,
  'ask_question' as any);
ok('easier/keep asks for the missing load lever',
  makeFlushEasierKeepSprints.missingFields.includes('intensity'),
  makeFlushEasierKeepSprints);
eq('easier/keep targets the flush',
  makeFlushEasierKeepSprints.targetItemTitle,
  'Easy Aerobic Flush (25min Rower)');
ok('easier/keep protects sprint',
  (makeFlushEasierKeepSprints.protectedTargets ?? []).some((item) =>
    /Sprint/i.test(item.title),
  ),
  makeFlushEasierKeepSprints);

const keepFirstEasier = interpretCoachMessageToProgramEdit({
  userMessage: 'keep the sprints, make the flush easier',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Wednesday Conditioning'),
  currentWeek: [visibleDay(TARGET, constrainedConditioning)],
});
eq('keep-first order still targets flush',
  keepFirstEasier.targetItemTitle,
  'Easy Aerobic Flush (25min Rower)');
ok('keep-first order still protects sprint',
  (keepFirstEasier.protectedTargets ?? []).some((item) =>
    /Sprint/i.test(item.title),
  ),
  keepFirstEasier);

const dontTouchSprint = interpretCoachMessageToProgramEdit({
  userMessage: "don't touch the sprints, just make the flush easier",
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Wednesday Conditioning'),
  currentWeek: [visibleDay(TARGET, constrainedConditioning)],
});
eq('do-not-touch clause still targets flush',
  dontTouchSprint.targetItemTitle,
  'Easy Aerobic Flush (25min Rower)');
ok('do-not-touch clause protects sprint',
  (dontTouchSprint.protectedTargets ?? []).some((item) =>
    /Sprint/i.test(item.title),
  ),
  dontTouchSprint);

const qualitativeLonger = interpretCoachMessageToProgramEdit({
  userMessage: 'make it a bit longer',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, rowerFlushForReplacement)],
});
eq('qualitative duration stays a clarification',
  qualitativeLonger.intent,
  'ask_question' as any);
ok('qualitative duration asks for amount',
  qualitativeLonger.missingFields.includes('duration'),
  qualitativeLonger);
ok('qualitative duration does not invent an activity title',
  !/bit longer/i.test(String((qualitativeLonger.newValue as any)?.activity ?? '')),
  qualitativeLonger);

const qualitativeTargetFirst = interpretCoachMessageToProgramEdit({
  userMessage: 'make wednesday conditioning a bit longer pls',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Wednesday Conditioning'),
  currentWeek: [visibleDay(TARGET, constrainedConditioning)],
});
eq('qualitative duration with multiple items asks for target first',
  qualitativeTargetFirst.intent,
  'ask_question' as any);
ok('qualitative duration target question carries duration scope',
  qualitativeTargetFirst.missingFields.includes('targetItemId') &&
    qualitativeTargetFirst.editScope === 'duration_only',
  qualitativeTargetFirst);
const qualitativePending = resolvePendingProgramEditAnswer({
  pending: pendingFromEdit(
    qualitativeTargetFirst,
    'make wednesday conditioning a bit longer pls',
  ),
  userMessage: 'the flush one',
  currentWeek: [visibleDay(TARGET, constrainedConditioning)],
});
eq('qualitative pending target answer resolves',
  qualitativePending.kind,
  'complete' as any);
if (qualitativePending.kind === 'complete') {
  eq('qualitative pending still asks for duration amount',
    qualitativePending.programEdit.intent,
    'ask_question' as any);
  ok('qualitative pending missing field is duration',
    qualitativePending.programEdit.missingFields.includes('duration'),
    qualitativePending.programEdit);
}

eq('assault typo normalization is central',
  normalizeCoachEditMessage('assualt bike'),
  'assault bike');
const typoAssaultBikeSprint = interpretCoachMessageToProgramEdit({
  userMessage: 'actually make it an assualt bike sprint sesh',
  todayISO: TODAY,
  referenceResolution: resolved(TARGET, 'Easy Aerobic Flush'),
  currentWeek: [visibleDay(TARGET, skiFlushForReplacement)],
  resolveVisibleProgramForDate: (date) => date === TARGET ? skiVisibleForReplacement : null,
});
eq('assault typo still becomes prescription replacement',
  typoAssaultBikeSprint.editScope,
  'replace_conditioning_prescription' as any);
eq('assault typo preserves assault bike activity',
  (typoAssaultBikeSprint.newValue as any)?.activity,
  'Assault Bike Sprints');
eq('assault typo captures assault bike subtype',
  (typoAssaultBikeSprint.newValue as any)?.bikeLabel,
  'assault');

const protectedBadAfter = {
  ...constrainedConditioning,
  exercises: constrainedConditioning.exercises.filter((exercise: any) =>
    exercise.id !== 'conditioning-row-1',
  ),
  conditioningBlock: {
    ...constrainedConditioning.conditioningBlock,
    options: constrainedConditioning.conditioningBlock.options.filter((option: any) =>
      !option.exerciseIds.includes('conditioning-row-1'),
    ),
  },
};
const protectedVerifier = verifyProgramEditVisibleMutation({
  edit: removeSprintKeepFlush,
  beforeWorkout: constrainedConditioning,
  afterWorkout: protectedBadAfter,
  targetDate: TARGET,
});
eq('protected target verifier rejects removed protected item',
  protectedVerifier.ok,
  false);
eq('protected target verifier names protected removal',
  protectedVerifier.reason,
  'protected_target_removed');

const durationNoOpVerifier = verifyProgramEditVisibleMutation({
  edit: rower45Edit,
  beforeWorkout: durationRowerWorkout,
  afterWorkout: durationRowerWorkout,
  targetDate: TARGET,
});
eq('duration verifier rejects no-op visible duration',
  durationNoOpVerifier.ok,
  false);
eq('duration verifier names unapplied duration',
  durationNoOpVerifier.reason,
  'duration_edit_not_applied');

section('12. Typed strength-block executor support');

const mixedStrengthFlush = strengthWithConditioningWorkout(
  'Lower Body Strength',
  ['Back Squat', 'Romanian Deadlift'],
  ['Easy Aerobic Flush'],
);
const sixExerciseStrengthFlush = strengthWithConditioningWorkout(
  'Lower Body Strength',
  [
    'Back Squat',
    'Romanian Deadlift',
    'Walking Lunge',
    'Split Squat',
    'Nordic Curl',
    'Copenhagen Plank',
  ],
  ['Easy Aerobic Flush'],
);
const removeStrengthEdit = semanticStrengthBlockEdit({ intent: 'remove' });
eq('semantic strength remove finalises to strength domain',
  removeStrengthEdit.targetDomain,
  'strength' as any);
eq('semantic strength remove finalises to remove_strength_block',
  (removeStrengthEdit as any).editScope,
  'remove_strength_block');
ok('semantic strength remove does not use legacy command',
  removeStrengthEdit.command === null,
  removeStrengthEdit.command);
const staleItemStrengthEdit = semanticStrengthBlockEdit({
  intent: 'remove',
  missingFields: ['targetItemId'],
  resolveVisibleProgramForDate: () => visibleProgramForWorkout(mixedStrengthFlush),
});
eq('block-level strength resolver ignores stale targetItemId missing field',
  staleItemStrengthEdit.intent,
  'remove' as any);
eq('block-level strength resolver keeps remove_strength_block scope',
  (staleItemStrengthEdit as any).editScope,
  'remove_strength_block');
ok('block-level strength resolver does not ask which visible item',
  !staleItemStrengthEdit.missingFields.includes('targetItemId') &&
    !/visible item/i.test(staleItemStrengthEdit.question ?? ''),
  staleItemStrengthEdit);
const multiExerciseStrengthEdit = semanticStrengthBlockEdit({
  intent: 'remove',
  missingFields: ['targetItemId', 'strengthBlockTarget'],
  resolveVisibleProgramForDate: () => visibleProgramForWorkout(sixExerciseStrengthFlush),
});
eq('one strength block with many exercises still resolves automatically',
  multiExerciseStrengthEdit.intent,
  'remove' as any);
ok('many child strength exercises do not ask which strength work',
  !/which strength|which visible item/i.test(multiExerciseStrengthEdit.question ?? '') &&
    !multiExerciseStrengthEdit.missingFields.includes('strengthBlockTarget'),
  multiExerciseStrengthEdit);
const multiBlockStrengthEdit = semanticStrengthBlockEdit({
  intent: 'remove',
  missingFields: ['targetItemId'],
  resolveVisibleProgramForDate: () => {
    const visible = visibleProgramForWorkout(mixedStrengthFlush);
    return {
      ...visible,
      items: [
        {
          id: 'gym-strength-block',
          title: 'Gym Strength',
          domain: 'strength',
          modality: null,
          durationMinutes: null,
          source: 'session',
        },
        {
          id: 'lower-strength-block',
          title: 'Lower Body Strength',
          domain: 'strength',
          modality: null,
          durationMinutes: null,
          source: 'session',
        },
      ],
      strengthItems: [
        {
          id: 'gym-strength-block',
          title: 'Gym Strength',
          domain: 'strength',
          modality: null,
          durationMinutes: null,
          source: 'session',
        },
        {
          id: 'lower-strength-block',
          title: 'Lower Body Strength',
          domain: 'strength',
          modality: null,
          durationMinutes: null,
          source: 'session',
        },
      ],
    };
  },
});
eq('multiple visible strength blocks ask typed clarification',
  multiBlockStrengthEdit.intent,
  'ask_question' as any);
ok('multiple visible strength blocks do not use generic item wording',
  /which strength block/i.test(multiBlockStrengthEdit.question ?? '') &&
    !/visible item/i.test(multiBlockStrengthEdit.question ?? ''),
  multiBlockStrengthEdit.question);
const removeStrengthRun = runStrengthBlockProgramEdit(removeStrengthEdit, mixedStrengthFlush);
eq('mixed strength+flush removal mutates',
  removeStrengthRun.result.kind,
  'mutated' as any);
eq('mixed strength+flush removal event is typed strength block',
  removeStrengthRun.eventKind,
  'remove_strength_block');
ok('mixed strength+flush removal removes strength exercises',
  !(removeStrengthRun.written?.exercises ?? []).some((row: any) =>
    /squat|deadlift/i.test(row.exercise?.name ?? ''),
  ),
  removeStrengthRun.written?.exercises);
ok('mixed strength+flush removal preserves conditioning row',
  (removeStrengthRun.written?.exercises ?? []).some((row: any) =>
    /easy aerobic flush/i.test(row.exercise?.name ?? ''),
  ) &&
    (removeStrengthRun.written?.conditioningBlock?.options ?? []).some((option: any) =>
      /easy aerobic flush/i.test(option.title ?? ''),
    ),
  removeStrengthRun.written);
ok('mixed strength+flush removal says Done only after verification',
  /^Done\b/i.test(removeStrengthRun.result.reply) &&
    /left conditioning alone/i.test(removeStrengthRun.result.reply),
  removeStrengthRun.result.reply);

const strengthOnly = strengthWithConditioningWorkout(
  'Lower Body Strength',
  ['Back Squat'],
  [],
);
const strengthOnlyRun = runStrengthBlockProgramEdit(
  semanticStrengthBlockEdit({ intent: 'remove', protectConditioning: false }),
  strengthOnly,
);
eq('strength-only removal mutates',
  strengthOnlyRun.result.kind,
  'mutated' as any);
eq('strength-only removal collapses session to Rest',
  strengthOnlyRun.written?.workoutType,
  'Rest');
eq('strength-only removal clears visible training rows',
  (strengthOnlyRun.written?.exercises ?? []).length,
  0);

const reduceStrengthEdit = semanticStrengthBlockEdit({ intent: 'reduce' });
const reduceStrengthRun = runStrengthBlockProgramEdit(reduceStrengthEdit, mixedStrengthFlush);
eq('reduce strength finalises to reduce_strength_block',
  (reduceStrengthEdit as any).editScope,
  'reduce_strength_block');
eq('reduce strength mutates',
  reduceStrengthRun.result.kind,
  'mutated' as any);
ok('reduce strength changes strength notes/sets',
  (reduceStrengthRun.written?.exercises ?? []).some((row: any) =>
    /reduced strength block/i.test(row.notes ?? '') &&
      /squat|deadlift/i.test(row.exercise?.name ?? ''),
  ),
  reduceStrengthRun.written?.exercises);
ok('reduce strength preserves conditioning row',
  (reduceStrengthRun.written?.exercises ?? []).some((row: any) =>
    /easy aerobic flush/i.test(row.exercise?.name ?? '') &&
      !/reduced strength block/i.test(row.notes ?? ''),
  ),
  reduceStrengthRun.written?.exercises);

section('12b. Generic block-level target resolver');

const semanticConditioningRemove = semanticConditioningBlockEdit({
  missingFields: ['targetItemId'],
  resolveVisibleProgramForDate: () => visibleProgramForWorkout(mixedStrengthFlush),
});
eq('conditioning block resolver finalises to conditioning domain',
  semanticConditioningRemove.targetDomain,
  'conditioning' as any);
eq('conditioning block resolver keeps remove_conditioning_item scope',
  (semanticConditioningRemove as any).editScope,
  'remove_conditioning_item');
eq('conditioning block resolver uses aggregate block target',
  semanticConditioningRemove.targetItemId,
  null);
ok('conditioning block resolver does not ask which visible item',
  !semanticConditioningRemove.missingFields.includes('targetItemId') &&
    !/visible item/i.test(semanticConditioningRemove.question ?? ''),
  semanticConditioningRemove);

const semanticConditioningRemoveRun = runConditioningProgramEdit(
  semanticConditioningRemove,
  mixedStrengthFlush,
);
ok('semantic conditioning block removal preserves strength exercises',
  semanticConditioningRemoveRun.written?.exercises?.some((row: any) =>
    /squat/i.test(row.exercise?.name ?? ''),
  ) &&
    semanticConditioningRemoveRun.written?.exercises?.some((row: any) =>
      /deadlift/i.test(row.exercise?.name ?? ''),
    ),
  semanticConditioningRemoveRun.written);
ok('semantic conditioning block removal removes only conditioning',
  !semanticConditioningRemoveRun.written?.exercises?.some((row: any) =>
    /easy aerobic flush/i.test(row.exercise?.name ?? ''),
  ),
  semanticConditioningRemoveRun.written);

const multiChildConditioningBlockEdit = semanticConditioningBlockEdit({
  missingFields: ['targetItemId'],
  resolveVisibleProgramForDate: () => visibleProgramForWorkout(
    strengthWithConditioningWorkout(
      'Mixed Conditioning',
      ['Back Squat'],
      ['Bike Conditioning', 'Sprint Conditioning'],
    ),
  ),
});
eq('one conditioning block with multiple child items resolves automatically',
  multiChildConditioningBlockEdit.intent,
  'remove' as any);
ok('multiple child conditioning items do not ask generic or block clarification',
  !/which conditioning block|which visible item/i.test(multiChildConditioningBlockEdit.question ?? '') &&
    !multiChildConditioningBlockEdit.missingFields.includes('conditioningBlockTarget'),
  multiChildConditioningBlockEdit);

const multiConditioningBlockEdit = semanticConditioningBlockEdit({
  missingFields: ['targetItemId'],
  resolveVisibleProgramForDate: () => {
    const visible = visibleProgramForWorkout(mixedStrengthFlush);
    return {
      ...visible,
      items: [
        ...visible.items.filter((item: any) => item.domain !== 'conditioning'),
        {
          id: 'bike-conditioning-block',
          title: 'Bike Conditioning',
          domain: 'conditioning',
          modality: 'bike',
          durationMinutes: 20,
          source: 'session',
        },
        {
          id: 'sprint-conditioning-block',
          title: 'Sprint Conditioning',
          domain: 'conditioning',
          modality: 'run',
          durationMinutes: 15,
          source: 'session',
        },
      ],
      conditioningItems: [
        {
          id: 'bike-conditioning-block',
          title: 'Bike Conditioning',
          domain: 'conditioning',
          modality: 'bike',
          durationMinutes: 20,
          source: 'session',
        },
        {
          id: 'sprint-conditioning-block',
          title: 'Sprint Conditioning',
          domain: 'conditioning',
          modality: 'run',
          durationMinutes: 15,
          source: 'session',
        },
      ],
    };
  },
});
eq('multiple visible conditioning blocks ask typed clarification',
  multiConditioningBlockEdit.intent,
  'ask_question' as any);
ok('multiple visible conditioning blocks do not use generic item wording',
  /which conditioning block/i.test(multiConditioningBlockEdit.question ?? '') &&
    !/visible item/i.test(multiConditioningBlockEdit.question ?? '') &&
    (multiConditioningBlockEdit.options ?? []).includes('Bike Conditioning') &&
    (multiConditioningBlockEdit.options ?? []).includes('Sprint Conditioning'),
  multiConditioningBlockEdit);

const noConditioningBlockEdit = semanticConditioningBlockEdit({
  missingFields: ['targetItemId'],
  resolveVisibleProgramForDate: () => visibleProgramForWorkout(
    strengthWithConditioningWorkout('Strength Only', ['Bench Press'], []),
  ),
});
eq('missing visible conditioning block becomes safe no-op clarify',
  noConditioningBlockEdit.intent,
  'ask_question' as any);
ok('missing visible conditioning block does not ask generic visible item',
  /couldn't find conditioning/i.test(noConditioningBlockEdit.question ?? '') &&
    !/visible item/i.test(noConditioningBlockEdit.question ?? ''),
  noConditioningBlockEdit.question);

const badAfter = strengthWithConditioningWorkout('Lower Body Strength', [], []);
const protectedViolationRun = runStrengthBlockProgramEdit(removeStrengthEdit, mixedStrengthFlush, {
  afterWorkout: badAfter,
  applyEvents: () => ({
    applied: [{ date: TARGET, eventIds: ['bad-strength-event'], workoutName: badAfter.name }],
    rejected: [],
  }),
});
eq('protected conditioning violation is blocked',
  protectedViolationRun.result.kind,
  'verified_no_op' as any);
ok('protected conditioning violation rolls back',
  protectedViolationRun.rolledBack === true &&
    !/^Done\b/i.test(protectedViolationRun.result.reply),
  protectedViolationRun.result);

const noStrengthRun = runStrengthBlockProgramEdit(
  semanticStrengthBlockEdit({ intent: 'remove' }),
  conditioningWorkout('Easy Aerobic Flush', ['Easy Aerobic Flush']),
);
eq('no visible strength block is a safe no-op',
  noStrengthRun.result.kind,
  'verified_no_op' as any);
ok('missing strength reply is safe and preserves conditioning',
  /couldn't find strength work/i.test(noStrengthRun.result.reply) &&
    /left conditioning unchanged/i.test(noStrengthRun.result.reply) &&
    !/^Done\b/i.test(noStrengthRun.result.reply),
  noStrengthRun.result.reply);

section('13. Schedule move explicit weekdays beat selected/current day');

const thursdayLowerSquat = conditioningWorkout('Lower Squat', []);
const explicitThursdayToSaturday = interpretCoachMessageToProgramEdit({
  userMessage: 'Can you move all of Thursday to Saturday?',
  todayISO: '2026-06-01',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: [
    { date: '2026-06-04', sessionName: 'Lower Squat', workout: thursdayLowerSquat },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
    { date: '2026-06-07', sessionName: 'Rest', workout: null },
  ],
});
ok('explicit Thursday→Saturday ProgramEdit targets Thursday, not Sunday',
  explicitThursdayToSaturday.command?.mode === 'mutate' &&
    explicitThursdayToSaturday.command.operation === 'move_session' &&
    explicitThursdayToSaturday.command.target.kind === 'date' &&
    explicitThursdayToSaturday.command.target.date === '2026-06-04' &&
    explicitThursdayToSaturday.command.target.date !== '2026-06-07',
  explicitThursdayToSaturday.command);
ok('explicit Thursday→Saturday ProgramEdit preserves from/to weekdays',
  explicitThursdayToSaturday.command?.mode === 'mutate' &&
    explicitThursdayToSaturday.command.operation === 'move_session' &&
    explicitThursdayToSaturday.command.payload.operation === 'move_session' &&
    explicitThursdayToSaturday.command.payload.fromDow === 4 &&
    explicitThursdayToSaturday.command.payload.toDow === 6 &&
    explicitThursdayToSaturday.command.payload.toDate === '2026-06-06',
  explicitThursdayToSaturday.command);
ok('explicit Thursday→Saturday ProgramEdit asks confirmation, not Sunday no-op',
  explicitThursdayToSaturday.missingFields.includes('confirmation') &&
    /Move Thursday's Lower Squat to Saturday this week\?/i.test(explicitThursdayToSaturday.question ?? ''),
  explicitThursdayToSaturday.question);

const futureUpperPullWithSki = strengthWithConditioningWorkout(
  'Upper Pull',
  ['Chest-Supported Row'],
  ['4 x 2min hard SkiErg'],
);
const pastVisibleMoveResolverCalls: string[] = [];
const pastVisibleThursdayToSaturday = interpretCoachMessageToProgramEdit({
  userMessage: 'Can you move all of Thursday to Saturday?',
  todayISO: '2026-06-07',
  referenceResolution: resolved('2026-06-07', 'Rest'),
  currentWeek: [
    {
      date: '2026-06-04',
      sessionName: 'Old Thursday',
      workout: strengthWithConditioningWorkout('Old Thursday', ['Old Row'], ['Old Conditioning']),
    },
    { date: '2026-06-06', sessionName: 'Rest', workout: null },
    { date: '2026-06-07', sessionName: 'Rest', workout: null },
  ],
  resolveVisibleProgramForDate: (date) => {
    pastVisibleMoveResolverCalls.push(date);
    return date === '2026-06-11'
      ? ({
          day: { date, workout: futureUpperPullWithSki },
          items: [],
          conditioningItems: [],
          strengthItems: [],
        } as any)
      : null;
  },
});
ok('past visible Thursday→Saturday ProgramEdit rolls to next Thursday',
  pastVisibleThursdayToSaturday.command?.mode === 'mutate' &&
    pastVisibleThursdayToSaturday.command.operation === 'move_session' &&
    pastVisibleThursdayToSaturday.command.target.kind === 'date' &&
    pastVisibleThursdayToSaturday.command.target.date === '2026-06-11' &&
    pastVisibleThursdayToSaturday.command.payload.operation === 'move_session' &&
    pastVisibleThursdayToSaturday.command.payload.toDate === '2026-06-13',
  pastVisibleThursdayToSaturday.command);
ok('past visible Thursday→Saturday asks one next-upcoming confirmation',
  pastVisibleThursdayToSaturday.missingFields.includes('confirmation') &&
    /Move next Thursday's Upper Pull \+ 4 x 2min hard SkiErg to Saturday\?/i.test(
      pastVisibleThursdayToSaturday.question ?? '',
    ) &&
    !/currently viewed week|Which Thursday/i.test(pastVisibleThursdayToSaturday.question ?? ''),
  pastVisibleThursdayToSaturday.question);
ok('past visible Thursday→Saturday consults the rolled-forward visible resolver',
  pastVisibleMoveResolverCalls.includes('2026-06-11'),
  pastVisibleMoveResolverCalls);

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
