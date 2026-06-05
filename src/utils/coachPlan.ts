import type {
  AddConditioningIntensity,
  CoachCommandTarget,
  ConditioningIntentModality,
} from './coachCommandRouter';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import type { MutationTouchedActivity } from '../store/coachMutationHistoryStore';

export type CoachTrainingIntent =
  | 'hiit'
  | 'sprint'
  | 'tempo'
  | 'aerobic'
  | 'low_load';

export type CoachPlanChangeKind =
  | 'modality'
  | 'training_intent'
  | 'modality_and_training_intent';

export type CoachConditioningEditMode =
  | 'append'
  | 'update_existing';

export type CoachConditioningEditScope =
  | 'edit_modality_only'
  | 'edit_duration_only'
  | 'edit_intensity_only'
  | 'replace_conditioning_prescription'
  | 'add_conditioning_item'
  | 'remove_conditioning_item';

export interface ConditioningPlanPayload {
  operation: 'add_conditioning';
  modality: ConditioningIntentModality | null;
  customActivity: string;
  intensity?: AddConditioningIntensity;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  bikeLabel?: 'standard' | 'assault' | 'generic' | null;
  effortKind?: 'sprint' | 'interval';
  replaceActivity?: string;
  trainingIntent?: CoachTrainingIntent;
  changeKind?: CoachPlanChangeKind;
  editMode?: CoachConditioningEditMode;
  editScope?: CoachConditioningEditScope;
}

export interface CoachConditioningPrescription {
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
}

export interface CoachPlan {
  kind: 'conditioning_edit';
  target: CoachCommandTarget;
  sourceActivity: MutationTouchedActivity;
  payload: ConditioningPlanPayload;
  reason: string;
}

export interface CoachPlanInput {
  userMessage: string;
  referenceResolution: CoachReferenceResolution | null;
  lastChange?: {
    target: CoachCommandTarget;
    touchedActivities?: MutationTouchedActivity[];
  } | null;
}

export interface ConditioningRequestSeed {
  modality: ConditioningIntentModality | null;
  customActivity?: string;
  intensity?: AddConditioningIntensity;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  bikeLabel?: 'standard' | 'assault' | 'generic' | null;
  effortKind?: 'sprint' | 'interval';
  replaceActivity?: string;
  trainingIntent?: CoachTrainingIntent;
  changeKind?: CoachPlanChangeKind;
  editMode?: CoachConditioningEditMode;
  editScope?: CoachConditioningEditScope;
}

export function buildConditioningPayloadFromRequest(input: {
  userMessage: string;
  seed: ConditioningRequestSeed;
}): ConditioningPlanPayload {
  const { userMessage, seed } = input;
  const modality =
    seed.modality ??
    detectRequestedModality(userMessage) ??
    normaliseModality(null, seed.customActivity ?? '');
  const trainingIntent =
    seed.trainingIntent ??
    detectRequestedTrainingIntent(userMessage) ??
    inferTrainingIntent({
      title: seed.customActivity ?? '',
      intensity: seed.intensity,
      effortKind: seed.effortKind,
      prescriptionType: seed.prescriptionType,
      durationMinutes: seed.durationMinutes,
      trainingIntent: seed.trainingIntent,
    });
  const customActivity =
    seed.customActivity ??
    composeConditioningTitle({
      modality,
      trainingIntent,
      sourceTitle: modality ?? 'conditioning',
    });
  const editMode = seed.editMode ?? inferConditioningEditMode(userMessage, seed);
  const editScope =
    seed.editScope ??
    inferConditioningEditScope({
      userMessage,
      seed,
      editMode,
      trainingIntent,
    });
  const prescription = buildConditioningPrescription({
    userMessage,
    trainingIntent,
    modality,
    title: customActivity,
    intensity: seed.intensity,
    durationMinutes: seed.durationMinutes,
    sets: seed.sets,
    repsMin: seed.repsMin,
    repsMax: seed.repsMax,
    restSeconds: seed.restSeconds,
    prescriptionType: seed.prescriptionType,
  });

  return {
    operation: 'add_conditioning',
    modality,
    customActivity,
    intensity: intensityForIntent(trainingIntent, seed.intensity),
    ...prescription,
    bikeLabel: modality === 'bike'
      ? seed.bikeLabel ?? detectBikeLabel(userMessage)
      : seed.bikeLabel ?? null,
    effortKind: effortKindForIntent(trainingIntent, seed.effortKind),
    replaceActivity: seed.replaceActivity,
    trainingIntent,
    changeKind: seed.changeKind,
    editMode,
    editScope,
  };
}

export function inferConditioningEditScope(input: {
  userMessage: string;
  seed: ConditioningRequestSeed;
  editMode: CoachConditioningEditMode;
  trainingIntent?: CoachTrainingIntent;
}): CoachConditioningEditScope {
  const { seed, editMode, trainingIntent } = input;
  if (editMode === 'append') return 'add_conditioning_item';
  if (seed.changeKind === 'training_intent' || seed.changeKind === 'modality_and_training_intent') {
    return 'replace_conditioning_prescription';
  }
  if (trainingIntent) return 'replace_conditioning_prescription';
  if (seed.durationMinutes || seed.sets || seed.repsMin || seed.repsMax) {
    return 'edit_duration_only';
  }
  if (seed.modality || seed.bikeLabel) return 'edit_modality_only';
  if (seed.intensity) return 'edit_intensity_only';
  return 'edit_intensity_only';
}

export function inferConditioningEditMode(
  userMessage: string,
  seed: ConditioningRequestSeed,
): CoachConditioningEditMode {
  if (seed.editMode === 'append' || seed.editMode === 'update_existing') return seed.editMode;
  if (seed.replaceActivity || seed.changeKind) return 'update_existing';

  const message = String(userMessage ?? '');
  const modifiesExisting =
    /\b(?:make|change|swap|replace|instead\s+of|rather\s+than|set|adjust)\b/i.test(message) ||
    /\b(?:longer|shorter|harder|easier|lighter|more|less|increase|reduce|extend|lengthen|trim|duration|time)\b/i.test(message);

  if (!modifiesExisting) return 'append';

  const explicitNewAdd =
    /\b(?:add|chuck|throw|slot|work|put|include)\b/i.test(message) &&
    !/\b(?:bit|little|touch)\s+(?:more|less)\b/i.test(message) &&
    !/\b(?:longer|shorter|harder|easier|lighter|increase|reduce|extend|lengthen|trim|duration|time)\b/i.test(message);

  return explicitNewAdd ? 'append' : 'update_existing';
}

export function buildConditioningPrescription(input: {
  userMessage?: string;
  trainingIntent?: CoachTrainingIntent;
  modality?: ConditioningIntentModality | null;
  title?: string;
  intensity?: AddConditioningIntensity | string;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
}): CoachConditioningPrescription {
  const intent =
    input.trainingIntent ??
    inferTrainingIntent({
      title: input.title ?? '',
      intensity: input.intensity,
      durationMinutes: input.durationMinutes,
      prescriptionType: input.prescriptionType,
    });
  const explicitSingleSet = /\b(?:1|one|single)\s*(?:x|set|rep|effort|interval)\b/i.test(input.userMessage ?? '');
  const keepProvidedSets = (fallback: number): number => {
    if (input.sets && input.sets > 1) return input.sets;
    if (input.sets === 1 && explicitSingleSet) return 1;
    return fallback;
  };
  const keepProvidedSeconds = (
    fallbackMin: number,
    fallbackMax: number,
  ): { repsMin: number; repsMax: number } => ({
    repsMin: input.repsMin && input.repsMin > 0 ? input.repsMin : fallbackMin,
    repsMax: input.repsMax && input.repsMax > 0 ? input.repsMax : fallbackMax,
  });

  if (intent === 'hiit') {
    const reps = keepProvidedSeconds(45, 45);
    return {
      sets: keepProvidedSets(8),
      repsMin: reps.repsMin,
      repsMax: reps.repsMax,
      restSeconds: input.restSeconds ?? 90,
      prescriptionType: 'duration',
    };
  }
  if (intent === 'sprint') {
    const reps = keepProvidedSeconds(20, 30);
    return {
      sets: keepProvidedSets(6),
      repsMin: reps.repsMin,
      repsMax: reps.repsMax,
      restSeconds: input.restSeconds ?? 120,
      prescriptionType: 'duration',
    };
  }
  if (intent === 'tempo') {
    const reps = keepProvidedSeconds(90, 120);
    return {
      sets: keepProvidedSets(6),
      repsMin: reps.repsMin,
      repsMax: reps.repsMax,
      restSeconds: input.restSeconds ?? 60,
      prescriptionType: 'duration',
    };
  }
  if (intent === 'aerobic' || intent === 'low_load') {
    return {
      durationMinutes: input.durationMinutes ?? 20,
      sets: 1,
      restSeconds: input.restSeconds ?? 0,
      prescriptionType: 'duration_minutes',
    };
  }
  return {
    durationMinutes: input.durationMinutes,
    sets: input.sets,
    repsMin: input.repsMin,
    repsMax: input.repsMax,
    restSeconds: input.restSeconds,
    prescriptionType: input.prescriptionType,
  };
}

export function buildConditioningCoachPlan(
  input: CoachPlanInput,
): CoachPlan | null {
  const message = input.userMessage ?? '';
  const requestedModality = detectRequestedModality(message);
  const requestedIntent = detectRequestedTrainingIntent(message);
  if (!requestedModality && !requestedIntent) return null;

  const source = input.lastChange?.touchedActivities?.find(
    (activity) => activity.kind === 'conditioning',
  );
  if (!source?.title) return null;

  const target = targetForPlan(input, source);
  if (!target) return null;

  const sourceIntent = inferTrainingIntent(source);
  const finalIntent = requestedIntent ?? sourceIntent;
  const finalModality = requestedModality ?? normaliseModality(source.modality, source.title);
  if (!finalModality && !finalIntent) return null;

  const changeKind = requestedModality && requestedIntent
    ? 'modality_and_training_intent'
    : requestedModality
    ? 'modality'
    : 'training_intent';
  const editScope: CoachConditioningEditScope =
    changeKind === 'modality'
      ? 'edit_modality_only'
      : 'replace_conditioning_prescription';
  const finalTitle = composeConditioningTitle({
    modality: finalModality,
    trainingIntent: finalIntent,
    sourceTitle: source.title,
  });
  const prescription = buildConditioningPrescription({
    userMessage: message,
    trainingIntent: finalIntent,
    modality: finalModality,
    title: finalTitle,
    intensity: intensityForIntent(finalIntent, source.intensity),
    durationMinutes: durationForIntent(finalIntent, source.durationMinutes),
    sets: setsForIntent(finalIntent, source),
    repsMin: repsForIntent(finalIntent, source).repsMin,
    repsMax: repsForIntent(finalIntent, source).repsMax,
  });

  return {
    kind: 'conditioning_edit',
    target,
    sourceActivity: source,
    payload: {
      operation: 'add_conditioning',
      modality: finalModality,
      customActivity: finalTitle,
      replaceActivity: source.title,
      intensity: intensityForIntent(finalIntent, source.intensity),
      ...prescription,
      bikeLabel: finalModality === 'bike'
        ? detectBikeLabel(message) ?? normaliseBikeLabel(source.bikeLabel)
        : null,
      effortKind: effortKindForIntent(finalIntent, source.effortKind),
      trainingIntent: finalIntent,
      changeKind,
      editMode: 'update_existing',
      editScope,
    },
    reason: `coach_plan:${changeKind}`,
  };
}

export function inferTrainingIntent(
  activity: Pick<
    MutationTouchedActivity,
    'title' | 'intensity' | 'effortKind' | 'prescriptionType' | 'durationMinutes' | 'trainingIntent'
  >,
): CoachTrainingIntent | undefined {
  const title = activity.title ?? '';
  if (
    activity.trainingIntent === 'hiit' ||
    activity.trainingIntent === 'sprint' ||
    activity.trainingIntent === 'tempo' ||
    activity.trainingIntent === 'aerobic' ||
    activity.trainingIntent === 'low_load'
  ) {
    return activity.trainingIntent;
  }
  if (/\b(?:hiit|high[-\s]*intensity)\b/i.test(title)) return 'hiit';
  if (activity.effortKind === 'sprint' || /\bsprints?\b/i.test(title)) return 'sprint';
  if (/\btempo\b/i.test(title) || activity.intensity === 'moderate') return 'tempo';
  if (
    activity.intensity === 'light' ||
    /\b(?:pilates|mobility|yoga|light|easy|low[-\s]*load|recovery|flush)\b/i.test(title)
  ) {
    return 'low_load';
  }
  if (
    activity.effortKind === 'interval' &&
    (activity.intensity === 'hard' || activity.prescriptionType === 'duration')
  ) {
    return 'hiit';
  }
  if (activity.durationMinutes && activity.durationMinutes >= 15) return 'aerobic';
  return activity.intensity === 'hard' ? 'hiit' : undefined;
}

export function detectRequestedTrainingIntent(
  message: string,
): CoachTrainingIntent | undefined {
  if (/\b(?:hiit|high[-\s]*intensity)\b/i.test(message)) return 'hiit';
  if (/\b(?:sprints?|all[-\s]*out|near[-\s]*max|max\s+efforts?)\b/i.test(message)) return 'sprint';
  if (/\btempo\b/i.test(message)) return 'tempo';
  if (/\b(?:light|easy|low[-\s]*load|recovery|flush)\b/i.test(message)) return 'low_load';
  if (/\b(?:zone\s*2|z2|aerobic|steady)\b/i.test(message)) return 'aerobic';
  return undefined;
}

export function detectRequestedModality(
  message: string,
): ConditioningIntentModality | null {
  if (/\b(?:ski\s*erg|skierg|ski)\b/i.test(message)) return 'ski';
  if (/\b(?:row(?:er|ing)?|erg)\b/i.test(message)) return 'row';
  if (/\b(?:assault\s+bike|air\s+bike|bike|cycling|spin)\b/i.test(message)) return 'bike';
  if (/\b(?:run(?:ning)?|hill\s+run|trail\s+run|jog)\b/i.test(message)) return 'run';
  if (/\b(?:swim(?:ming)?)\b/i.test(message)) return 'swim';
  if (/\b(?:walk(?:ing)?)\b/i.test(message)) return 'walk';
  return null;
}

function targetForPlan(
  input: CoachPlanInput,
  source: MutationTouchedActivity,
): CoachCommandTarget | null {
  if (
    input.lastChange?.target &&
    (input.lastChange.target.kind === 'date' || input.lastChange.target.kind === 'exercise')
  ) {
    if (input.lastChange.target.kind === 'date') {
      return {
        kind: 'date',
        date: input.lastChange.target.date,
        sessionName: input.lastChange.target.sessionName ?? source.sessionName,
      };
    }
    return input.lastChange.target;
  }
  if (source.date) {
    return { kind: 'date', date: source.date, sessionName: source.sessionName };
  }
  const refTarget = input.referenceResolution?.target;
  if (refTarget?.date) {
    return { kind: 'date', date: refTarget.date, sessionName: refTarget.sessionName };
  }
  return null;
}

function normaliseModality(
  raw: string | null | undefined,
  title: string,
): ConditioningIntentModality | null {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'ski' || /\b(?:ski\s*erg|skierg|ski)\b/i.test(title)) return 'ski';
  if (value === 'row' || value === 'rower' || /\brow(?:er|ing)?\b/i.test(title)) return 'row';
  if (value === 'bike' || /\bbike\b/i.test(title)) return 'bike';
  if (value === 'run' || /\brun(?:ning)?\b/i.test(title)) return 'run';
  if (value === 'swim' || /\bswim(?:ming)?\b/i.test(title)) return 'swim';
  if (value === 'walk' || /\bwalk(?:ing)?\b/i.test(title)) return 'walk';
  if (value === 'aerobic') return 'aerobic';
  if (value === 'cardio') return 'cardio';
  if (value === 'sprint') return 'sprint';
  return null;
}

function composeConditioningTitle(args: {
  modality: ConditioningIntentModality | null;
  trainingIntent: CoachTrainingIntent | undefined;
  sourceTitle: string;
}): string {
  const mode = modalityLabel(args.modality);
  if (args.trainingIntent === 'hiit') return mode ? `HIIT ${mode} Intervals` : 'HIIT Intervals';
  if (args.trainingIntent === 'sprint') return mode ? `${mode} Sprints` : 'Sprint Intervals';
  if (args.trainingIntent === 'tempo') return mode ? `Tempo ${mode}` : 'Tempo Conditioning';
  if (args.trainingIntent === 'aerobic') return mode ? `Aerobic ${mode}` : 'Aerobic Conditioning';
  if (args.trainingIntent === 'low_load') {
    if (mode === 'SkiErg') return 'Light SkiErg';
    if (mode === 'Rower') return 'Light Row';
    if (mode === 'Bike') return 'Light Bike';
    if (mode === 'Run') return 'Easy Run';
    if (mode === 'Walk') return 'Light Walk';
  }
  return mode ?? titleCase(args.sourceTitle);
}

function modalityLabel(modality: ConditioningIntentModality | null): string | null {
  switch (modality) {
    case 'ski': return 'SkiErg';
    case 'row': return 'Rower';
    case 'bike': return 'Bike';
    case 'run': return 'Run';
    case 'swim': return 'Swim';
    case 'walk': return 'Walk';
    case 'sprint': return 'Sprint';
    default: return null;
  }
}

function intensityForIntent(
  intent: CoachTrainingIntent | undefined,
  sourceIntensity: string | undefined,
): AddConditioningIntensity | undefined {
  if (intent === 'hiit' || intent === 'sprint') return 'hard';
  if (intent === 'tempo') return 'moderate';
  if (intent === 'aerobic' || intent === 'low_load') return 'light';
  if (sourceIntensity === 'light' || sourceIntensity === 'moderate' || sourceIntensity === 'hard') {
    return sourceIntensity;
  }
  return undefined;
}

function effortKindForIntent(
  intent: CoachTrainingIntent | undefined,
  sourceEffort: string | undefined,
): 'sprint' | 'interval' | undefined {
  if (intent === 'sprint') return 'sprint';
  if (intent === 'hiit' || intent === 'tempo') return 'interval';
  if (sourceEffort === 'sprint' || sourceEffort === 'interval') return sourceEffort;
  return undefined;
}

function setsForIntent(
  intent: CoachTrainingIntent | undefined,
  source: MutationTouchedActivity,
): number | undefined {
  const sourceAlreadyMatches =
    (intent === 'hiit' && (source.trainingIntent === 'hiit' || source.effortKind === 'interval' || /\bhiit\b/i.test(source.title))) ||
    (intent === 'sprint' && (source.trainingIntent === 'sprint' || source.effortKind === 'sprint' || /\bsprints?\b/i.test(source.title))) ||
    (intent === 'tempo' && (source.trainingIntent === 'tempo' || /\btempo\b/i.test(source.title)));
  if (sourceAlreadyMatches && source.sets && source.sets > 0) {
    return source.sets;
  }
  if (intent === 'hiit') return 8;
  if (intent === 'sprint') return 6;
  if (intent === 'tempo') return 6;
  if (intent === 'low_load' || intent === 'aerobic') return 1;
  return source.sets;
}

function repsForIntent(
  intent: CoachTrainingIntent | undefined,
  source: MutationTouchedActivity,
): { repsMin?: number; repsMax?: number } {
  const sourceAlreadyMatches =
    (intent === 'hiit' && (source.trainingIntent === 'hiit' || source.effortKind === 'interval' || /\bhiit\b/i.test(source.title))) ||
    (intent === 'sprint' && (source.trainingIntent === 'sprint' || source.effortKind === 'sprint' || /\bsprints?\b/i.test(source.title))) ||
    (intent === 'tempo' && (source.trainingIntent === 'tempo' || /\btempo\b/i.test(source.title)));
  if (sourceAlreadyMatches && source.repsMin && source.repsMax) {
    return { repsMin: source.repsMin, repsMax: source.repsMax };
  }
  if (intent === 'hiit') return { repsMin: 45, repsMax: 45 };
  if (intent === 'sprint') return { repsMin: 20, repsMax: 30 };
  if (intent === 'tempo') return { repsMin: 90, repsMax: 120 };
  return {};
}

function durationForIntent(
  intent: CoachTrainingIntent | undefined,
  sourceDuration: number | undefined,
): number | undefined {
  if (intent === 'low_load' || intent === 'aerobic') return sourceDuration ?? 20;
  return undefined;
}

function detectBikeLabel(message: string): 'standard' | 'assault' | null {
  if (/\b(?:assault|air|airdyne|echo)\s*bike\b/i.test(message)) return 'assault';
  if (/\b(?:stationary|standard|regular|normal)\s*bike\b/i.test(message)) return 'standard';
  return null;
}

function normaliseBikeLabel(raw: string | null | undefined): 'standard' | 'assault' | 'generic' | null {
  if (raw === 'standard' || raw === 'assault' || raw === 'generic') return raw;
  return null;
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) =>
      /^(hiit|mas)$/i.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ');
}
