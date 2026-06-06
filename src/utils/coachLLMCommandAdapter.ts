import type { CoachContextPacket, CoachIntent } from './coachIntent';
import type {
  AddConditioningIntensity,
  CoachCommand,
  CoachCommandScope,
  CoachCommandTarget,
  CoachMutatePayload,
  ConditioningIntentModality,
} from './coachCommandRouter';
import {
  buildConditioningPayloadFromRequest,
  type CoachPlanChangeKind,
  type CoachTrainingIntent,
} from './coachPlan';

type AdapterResult =
  | { kind: 'command'; command: CoachCommand }
  | { kind: 'clarify'; command: Extract<CoachCommand, { mode: 'clarify' }> }
  | { kind: 'ignored'; reason: string };

const VALID_MODALITIES = new Set([
  'bike',
  'row',
  'rower',
  'run',
  'ski',
  'swim',
  'walk',
  'cardio',
  'aerobic',
  'sprint',
  'mixed',
]);

const LOCAL_CLARIFIER_REASONS = new Set([
  'last_add_sprint_minute_duration_ambiguous',
]);

function isLocalClarifierReason(reason: string): boolean {
  return [...LOCAL_CLARIFIER_REASONS].some((localReason) =>
    reason === localReason || reason.startsWith(`${localReason}:`),
  );
}

export function shouldTryLLMCoachCommand(
  routedCommand: CoachCommand,
  userMessage: string,
): boolean {
  if (routedCommand.mode === 'mutate') {
    if (
      routedCommand.needsClarification &&
      isLocalClarifierReason(routedCommand.reason)
    ) {
      return false;
    }
    return routedCommand.needsClarification || routedCommand.confidence < 0.65;
  }
  if (routedCommand.mode === 'clarify') {
    if (/^program_setup_/.test(routedCommand.reason)) return false;
    return true;
  }
  if (routedCommand.mode === 'conversation') {
    return looksLikeProgramEditForLLM(userMessage);
  }
  return false;
}

function looksLikeProgramEditForLLM(userMessage: string): boolean {
  const explicitEdit =
    /\b(?:add|change|swap|replace|move|remove|drop|make|set|adjust|include|put|throw\s+in|chuck|slot\s+in|work\s+in|schedule|program|instead\s+of|rather\s+than|longer|shorter|harder|easier|lighter)\b/i.test(userMessage);
  if (explicitEdit) return true;

  const trainingObject =
    /\b(?:hiit|intervals?|sprints?|conditioning|cardio|row(?:ing|er)?|bike|run(?:ning)?|ski(?:erg)?|swim(?:ming)?|walk(?:ing)?|pilates|mobility|yoga)\b/i.test(userMessage);
  const targetCue =
    /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|session|workout)\b/i.test(userMessage);
  return trainingObject && targetCue;
}

export function coachCommandFromLLMIntent(
  intent: CoachIntent,
  packet: CoachContextPacket,
): AdapterResult {
  if (
    intent.intent !== 'request_program_adjustment' &&
    intent.intent !== 'exercise_swap'
  ) {
    return { kind: 'ignored', reason: `intent_${intent.intent}` };
  }
  if (intent.confidence < 0.6) {
    return { kind: 'ignored', reason: 'low_confidence' };
  }

  const payload = (intent.payload ?? {}) as Record<string, unknown>;
  if (intent.needsClarification) {
    const partialCommand = commandFromClarifyingLLMIntent(intent, payload, packet);
    if (partialCommand) {
      return { kind: 'command', command: partialCommand };
    }
    return {
      kind: 'clarify',
      command: buildClarifyCommand(
        stringField(payload, ['clarificationQuestion']) ??
          intent.clarificationQuestion ??
          'What exactly should I change?',
        ['llm_missing_field'],
        'llm_command_needs_clarification',
      ),
    };
  }

  const operation = normaliseOperation(
    stringField(payload, ['operation', 'action', 'editAction', 'adjustmentAction']) ??
      intent.intent,
  );
  if (!operation) return { kind: 'ignored', reason: 'unsupported_operation' };

  const target = targetFromPayload(payload, packet);
  if (!target) {
    return {
      kind: 'clarify',
      command: buildClarifyCommand(
        'Which day or session should I change?',
        ['target_session'],
        'llm_command_missing_target',
      ),
    };
  }

  const scope = normaliseScope(stringField(payload, ['scope'])) ?? 'one_off';

  if (operation === 'remove_conditioning') {
    return {
      kind: 'command',
      command: {
        mode: 'mutate',
        operation,
        target,
        payload: {
          operation,
          modality: normaliseModality(stringField(payload, ['modality'])),
        },
        scope,
        confidence: intent.confidence,
        needsClarification: false,
        reason: 'llm_command_adapter:remove_conditioning',
      },
    };
  }

  if (operation === 'remove_session') {
    return {
      kind: 'command',
      command: {
        mode: 'mutate',
        operation,
        target,
        payload: {
          operation,
          targetSessionId: stringField(payload, ['targetSessionId', 'sessionId']) ?? null,
          reason: stringField(payload, ['reason']),
        },
        scope,
        confidence: intent.confidence,
        needsClarification: false,
        reason: 'llm_command_adapter:remove_session',
      },
    };
  }

  if (operation === 'replace_exercise') {
    const fromExercise = stringField(payload, [
      'fromExercise',
      'sourceExercise',
      'oldExercise',
      'replaceActivity',
      'replacingActivity',
      'fromActivity',
    ]);
    const toExercise = stringField(payload, [
      'toExercise',
      'targetExercise',
      'newExercise',
      'activity',
      'customActivity',
      'toActivity',
    ]);
    if (!fromExercise) {
      return {
        kind: 'clarify',
        command: buildClarifyCommand(
          'Which exercise should I replace?',
          ['from_exercise'],
          'llm_command_missing_from_exercise',
        ),
      };
    }
    return {
      kind: 'command',
      command: {
        mode: 'mutate',
        operation,
        target: target.kind === 'date'
          ? { kind: 'exercise', date: target.date, exerciseName: fromExercise }
          : target,
        payload: {
          operation,
          fromExercise,
          toExercise: toExercise ?? null,
        },
        scope,
        confidence: intent.confidence,
        needsClarification: false,
        reason: 'llm_command_adapter:replace_exercise',
      },
    };
  }

  if (operation === 'move_session') {
    const toDate = stringField(payload, ['toDate', 'targetDate', 'destinationDate']);
    const toDow = numberField(payload, ['toDow', 'destinationDow']);
    if (!toDate && toDow == null) {
      return {
        kind: 'clarify',
        command: buildClarifyCommand(
          'Where should I move it?',
          ['destination_day'],
          'llm_command_missing_destination',
        ),
      };
    }
    return {
      kind: 'command',
      command: {
        mode: 'mutate',
        operation,
        target,
        payload: { operation, toDate, toDow },
        scope: 'this_week',
        confidence: intent.confidence,
        needsClarification: false,
        reason: 'llm_command_adapter:move_session',
      },
    };
  }

  const activity = stringField(payload, [
    'activity',
    'customActivity',
    'newActivity',
    'toActivity',
    'conditioningActivity',
  ]);
  const replaceActivity = stringField(payload, [
    'replaceActivity',
    'replacingActivity',
    'oldActivity',
    'fromActivity',
    'sourceActivity',
  ]);
  if (!activity && operation === 'add_conditioning') {
    return {
      kind: 'clarify',
      command: buildClarifyCommand(
        `What should I add to ${formatTarget(target)}?`,
        ['activity'],
        'add_conditioning_missing_activity',
      ),
    };
  }

  const plannedPayload = buildConditioningPayloadFromRequest({
    userMessage: packet.userMessage,
    seed: {
      modality: normaliseModality(stringField(payload, ['modality'])),
      customActivity: activity,
      intensity: normaliseIntensity(stringField(payload, ['intensity'])),
      durationMinutes: numberField(payload, ['durationMinutes', 'minutes']),
      sets: numberField(payload, ['sets']),
      repsMin: numberField(payload, ['repsMin']) ?? numberField(payload, ['durationSeconds', 'seconds']),
      repsMax: numberField(payload, ['repsMax']) ?? numberField(payload, ['durationSeconds', 'seconds']),
      restSeconds: numberField(payload, ['restSeconds', 'recoverySeconds']),
      bikeLabel: normaliseBikeLabel(stringField(payload, ['bikeLabel', 'bikeType'])),
      effortKind: normaliseEffortKind(stringField(payload, ['effortKind', 'effortType'])),
      trainingIntent: normaliseTrainingIntent(stringField(payload, ['trainingIntent', 'intentToPreserve'])),
      changeKind: normaliseChangeKind(stringField(payload, ['changeKind', 'editKind'])),
      replaceActivity,
    },
  });

  return {
    kind: 'command',
    command: {
      mode: 'mutate',
      operation: 'add_conditioning',
      target,
      payload: plannedPayload,
      scope,
      confidence: intent.confidence,
      needsClarification: false,
      reason: replaceActivity
        ? 'llm_command_adapter:replace_conditioning'
        : 'llm_command_adapter:add_conditioning',
    },
  };
}

function commandFromClarifyingLLMIntent(
  intent: CoachIntent,
  payload: Record<string, unknown>,
  packet: CoachContextPacket,
): CoachCommand | null {
  const operationRaw =
    stringField(payload, ['operation', 'action', 'editAction', 'adjustmentAction']) ??
    intent.intent;
  const operation = normaliseOperation(operationRaw);
  if (!operation) return null;

  const target = targetFromPayload(payload, packet);
  if (!target) return null;

  const question =
    stringField(payload, ['clarificationQuestion']) ??
    intent.clarificationQuestion ??
    'What exactly should I change?';
  const scope = normaliseScope(stringField(payload, ['scope'])) ?? 'one_off';

  if (operation === 'add_conditioning' && isDurationClarifier(operationRaw, question, payload)) {
    const inferred = inferPrimaryConditioningActivity(packet, target);
    const replaceActivity = stringField(payload, [
      'replaceActivity',
      'replacingActivity',
      'oldActivity',
      'fromActivity',
      'sourceActivity',
    ]) ?? inferred?.title;
    const activity = stringField(payload, [
      'activity',
      'customActivity',
      'newActivity',
      'toActivity',
      'conditioningActivity',
    ]) ?? inferred?.title;
    const plannedPayload = buildConditioningPayloadFromRequest({
      userMessage: packet.userMessage,
      seed: {
        modality: normaliseModality(stringField(payload, ['modality'])) ?? inferred?.modality ?? null,
        customActivity: activity,
        intensity: normaliseIntensity(stringField(payload, ['intensity'])) ?? inferred?.intensity,
        sets: numberField(payload, ['sets']) ?? inferred?.sets,
        repsMin:
          numberField(payload, ['repsMin']) ??
          numberField(payload, ['durationSeconds', 'seconds']) ??
          inferred?.repsMin,
        repsMax:
          numberField(payload, ['repsMax']) ??
          numberField(payload, ['durationSeconds', 'seconds']) ??
          inferred?.repsMax,
        restSeconds: numberField(payload, ['restSeconds', 'recoverySeconds']) ?? inferred?.restSeconds,
        prescriptionType: inferred?.prescriptionType,
        bikeLabel: normaliseBikeLabel(stringField(payload, ['bikeLabel', 'bikeType'])) ?? inferred?.bikeLabel ?? null,
        effortKind: normaliseEffortKind(stringField(payload, ['effortKind', 'effortType'])) ?? inferred?.effortKind,
        trainingIntent: normaliseTrainingIntent(stringField(payload, ['trainingIntent', 'intentToPreserve'])) ?? inferred?.trainingIntent,
        changeKind: normaliseChangeKind(stringField(payload, ['changeKind', 'editKind'])),
        replaceActivity,
        editMode: 'update_existing',
      },
    }) as CoachMutatePayload;

    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target,
      payload: plannedPayload,
      scope,
      confidence: intent.confidence,
      needsClarification: true,
      clarificationQuestion: question,
      missingFields: ['durationMinutes'],
      reason: 'llm_command_adapter:duration_missing',
    };
  }

  return null;
}

function isDurationClarifier(
  operationRaw: string,
  question: string,
  payload: Record<string, unknown>,
): boolean {
  const op = normaliseToken(operationRaw);
  if (/^(change_duration|set_duration|adjust_duration)$/.test(op)) return true;
  if (
    numberField(payload, ['durationMinutes', 'minutes', 'durationSeconds', 'seconds', 'repsMin', 'repsMax']) != null
  ) {
    return false;
  }
  return /\b(?:how\s+(?:much|long)|duration|time|longer|shorter|mins?|minutes?|hours?)\b/i.test(question);
}

type InferredConditioningActivity = {
  title?: string;
  modality: ConditioningIntentModality | null;
  intensity?: AddConditioningIntensity;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  bikeLabel?: 'standard' | 'assault' | null;
  effortKind?: 'sprint' | 'interval';
  trainingIntent?: CoachTrainingIntent;
};

function inferPrimaryConditioningActivity(
  packet: CoachContextPacket,
  target: CoachCommandTarget,
): InferredConditioningActivity | null {
  if (target.kind !== 'date' && target.kind !== 'exercise') return null;
  const targetDate = target.date;
  const visible = inferVisibleConditioningActivity(packet, targetDate);
  const touched = packet.lastMutation?.touchedActivities?.find((activity: any) =>
    activity?.kind === 'conditioning' && activity?.date === targetDate,
  ) as any;
  const touchedActivity = touched
    ? {
        title: stringValue(touched.title),
        modality: normaliseModality(stringValue(touched.modality)) ?? normaliseModality(stringValue(touched.title)),
        intensity: normaliseIntensity(stringValue(touched.intensity)),
        durationMinutes: numberValue(touched.durationMinutes),
        sets: numberValue(touched.sets),
        repsMin: numberValue(touched.repsMin),
        repsMax: numberValue(touched.repsMax),
        restSeconds: numberValue(touched.restSeconds),
        prescriptionType: prescriptionTypeValue(touched.prescriptionType),
        bikeLabel: normaliseBikeLabel(stringValue(touched.bikeLabel)) ?? normaliseBikeLabel(stringValue(touched.title)),
        effortKind: normaliseEffortKind(stringValue(touched.effortKind)),
        trainingIntent: normaliseTrainingIntent(stringValue(touched.trainingIntent)),
      }
    : null;
  if (visible && touchedActivity) {
    return {
      ...touchedActivity,
      ...visible,
      sets: touchedActivity.sets ?? visible.sets,
      repsMin: touchedActivity.repsMin ?? visible.repsMin,
      repsMax: touchedActivity.repsMax ?? visible.repsMax,
      restSeconds: touchedActivity.restSeconds ?? visible.restSeconds,
      prescriptionType: touchedActivity.prescriptionType ?? visible.prescriptionType,
      trainingIntent: touchedActivity.trainingIntent ?? visible.trainingIntent,
    };
  }
  if (visible) return visible;
  if (touched) {
    return touchedActivity;
  }

  return null;
}

function inferVisibleConditioningActivity(
  packet: CoachContextPacket,
  targetDate: string,
): InferredConditioningActivity | null {
  const day = packet.currentWeek.find((d: any) => d?.date === targetDate) as any;
  const workout = day?.workout;
  if (!workout) return null;
  const options = Array.isArray(workout.conditioningBlock?.options)
    ? workout.conditioningBlock.options
    : [];
  if (options.length === 1) {
    const option = options[0] as any;
    const title = stringValue(option.title) ?? stringValue(workout.name);
    const text = [title, option.description, workout.name, workout.description]
      .filter(Boolean)
      .join(' ');
    return {
      title,
      modality: normaliseModality(text),
      intensity: normaliseIntensity(text),
      durationMinutes: durationMinutesFromText(text),
      bikeLabel: normaliseBikeLabel(text),
      effortKind: normaliseEffortKind(text),
      trainingIntent: normaliseTrainingIntent(text),
    };
  }

  const workoutText = [workout.name, workout.description].filter(Boolean).join(' ');
  const modality = normaliseModality(workoutText);
  if (!modality) return null;
  return {
    title: stringValue(workout.name),
    modality,
    intensity: normaliseIntensity(workoutText),
    durationMinutes: durationMinutesFromText(workoutText),
    bikeLabel: normaliseBikeLabel(workoutText),
    effortKind: normaliseEffortKind(workoutText),
    trainingIntent: normaliseTrainingIntent(workoutText),
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function prescriptionTypeValue(value: unknown): 'duration' | 'duration_minutes' | undefined {
  if (value === 'duration' || value === 'duration_minutes') return value;
  return undefined;
}

function durationMinutesFromText(text: string): number | undefined {
  const match = /\b(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i.exec(text);
  if (!match) return undefined;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
}

function buildClarifyCommand(
  question: string,
  missingFields: string[],
  reason: string,
): Extract<CoachCommand, { mode: 'clarify' }> {
  return {
    mode: 'clarify',
    question,
    missingFields,
    reason,
  };
}

function normaliseOperation(raw: string | null): 'add_conditioning' | 'remove_conditioning' | 'remove_session' | 'move_session' | 'replace_exercise' | null {
  const value = normaliseToken(raw);
  if (!value) return null;
  if (/^(request_program_adjustment|add|add_conditioning|add_activity|add_conditioning_block|change_duration|set_duration|adjust_duration|replace_conditioning|swap_conditioning|replace_activity|change_modality|change_training_intent|change_intensity)$/.test(value)) {
    return 'add_conditioning';
  }
  if (/^(remove|remove_conditioning|remove_conditioning_block|drop|delete|skip)$/.test(value)) {
    return 'remove_conditioning';
  }
  if (/^(remove_session|remove_workout|delete_session|delete_workout|skip_session|cancel_session)$/.test(value)) {
    return 'remove_session';
  }
  if (/^(move|move_session|reschedule|shift)$/.test(value)) {
    return 'move_session';
  }
  if (/^(exercise_swap|replace_exercise|swap_exercise)$/.test(value)) {
    return 'replace_exercise';
  }
  return null;
}

function targetFromPayload(
  payload: Record<string, unknown>,
  packet: CoachContextPacket,
): CoachCommandTarget | null {
  const canUseLastMutation = shouldUseLastMutationTarget(packet.userMessage, payload);
  const date =
    stringField(payload, ['targetDate', 'date', 'requestedDate']) ??
    packet.referenceResolution?.target?.date ??
    (canUseLastMutation
      ? packet.lastMutation?.touchedActivities?.[0]?.date ??
        packet.lastMutation?.affectedDates?.[0]
      : null) ??
    null;
  if (!date) return null;
  return {
    kind: 'date',
    date,
    sessionName:
      stringField(payload, ['targetSessionName', 'sessionName', 'requestedSession']) ??
      packet.referenceResolution?.target?.sessionName ??
      (canUseLastMutation
        ? packet.lastMutation?.touchedActivities?.[0]?.sessionName
        : undefined),
  };
}

function shouldUseLastMutationTarget(
  userMessage: string,
  payload: Record<string, unknown>,
): boolean {
  if (!payload) return false;
  const operation = normaliseToken(stringField(payload, ['operation', 'action']) ?? '');
  const hasSpecificEditPayload =
    numberField(payload, ['durationMinutes', 'minutes', 'durationSeconds', 'seconds', 'repsMin', 'repsMax']) != null ||
    !!stringField(payload, ['replaceActivity', 'replacingActivity', 'oldActivity', 'fromActivity', 'sourceActivity']);
  const pronounOrEditCue =
    /\b(?:it|them|that|those|same|shorter|longer|harder|easier|lighter|duration|seconds?|secs?|mins?|minutes?|instead\s+of|rather\s+than|replace|swap|change|set|make)\b/i.test(userMessage);
  if (operation && operation !== 'add_conditioning' && operation !== 'add') return true;
  return hasSpecificEditPayload || pronounOrEditCue;
}

function normaliseModality(raw: string | null): ConditioningIntentModality | null {
  const value = normaliseToken(raw);
  if (!value) return null;
  if (value === 'cycling' || value === 'spin' || value === 'assault_bike' || value === 'air_bike') return 'bike';
  if (value === 'running' || value === 'jog' || value === 'jogging') return 'run';
  if (value === 'rowing') return 'row';
  if (value === 'skierg') return 'ski';
  return VALID_MODALITIES.has(value) ? value as ConditioningIntentModality : null;
}

function normaliseIntensity(raw: string | null): AddConditioningIntensity | undefined {
  const value = normaliseToken(raw);
  if (!value) return undefined;
  if (/^(light|easy|gentle|recovery|low_load|low_impact)$/.test(value)) return 'light';
  if (/^(moderate|steady|tempo)$/.test(value)) return 'moderate';
  if (/^(hard|heavy|intense|max|near_max|sprint)$/.test(value)) return 'hard';
  return undefined;
}

function normaliseBikeLabel(raw: string | null): 'standard' | 'assault' | null {
  const lowerRaw = String(raw ?? '').toLowerCase();
  if (/\b(?:assault|air)\s+bike\b/.test(lowerRaw)) return 'assault';
  if (/\b(?:regular|normal|standard|stationary)\s+bike\b/.test(lowerRaw)) return 'standard';
  const value = normaliseToken(raw);
  if (!value) return null;
  if (/^(assault|air|air_bike)$/.test(value)) return 'assault';
  if (/^(standard|normal|regular|stationary|bike)$/.test(value)) return 'standard';
  return null;
}

function normaliseEffortKind(raw: string | null): 'sprint' | 'interval' | undefined {
  const value = normaliseToken(raw);
  if (!value) return undefined;
  if (/^(sprint|sprints|sprint_effort|max_effort)$/.test(value)) return 'sprint';
  if (/^(interval|intervals|repeats|efforts)$/.test(value)) return 'interval';
  return undefined;
}

function normaliseTrainingIntent(raw: string | null): CoachTrainingIntent | undefined {
  const value = normaliseToken(raw);
  if (!value) return undefined;
  if (/^(hiit|high_intensity|high_intensity_intervals)$/.test(value)) return 'hiit';
  if (/^(sprint|sprints|repeat_sprint)$/.test(value)) return 'sprint';
  if (/^(tempo|threshold)$/.test(value)) return 'tempo';
  if (/^(aerobic|zone_2|z2|steady)$/.test(value)) return 'aerobic';
  if (/^(low_load|recovery|flush|easy|light)$/.test(value)) return 'low_load';
  return undefined;
}

function normaliseChangeKind(raw: string | null): CoachPlanChangeKind | undefined {
  const value = normaliseToken(raw);
  if (value === 'modality') return 'modality';
  if (value === 'training_intent' || value === 'intensity') return 'training_intent';
  if (value === 'modality_and_training_intent') return 'modality_and_training_intent';
  return undefined;
}

function normaliseScope(raw: string | null): CoachCommandScope | null {
  const value = normaliseToken(raw);
  if (!value) return null;
  if (value === 'one_off' || value === 'this_week' || value === 'recurring' || value === 'permanent') {
    return value;
  }
  if (/^(today|single|once|this_session)$/.test(value)) return 'one_off';
  if (/^(weekly|every_week|going_forward|future)$/.test(value)) return 'recurring';
  return null;
}

function stringField(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function numberField(payload: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    const number = typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value.replace(/[^\d.]/g, ''))
      : NaN;
    if (Number.isFinite(number) && number > 0 && number <= 240) return number;
  }
  return undefined;
}

function normaliseToken(raw: string | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatTarget(target: CoachCommandTarget): string {
  if (target.kind === 'date') return target.sessionName ?? target.date;
  if (target.kind === 'exercise') return target.exerciseName;
  return 'that session';
}
