import type {
  FeedbackCompletion,
  FeedbackFeeling,
  FeedbackPartialReason,
  FeedbackSkipReason,
  FeedbackSoreness,
  SessionFeedback,
  SessionFeedbackComponent,
} from '../store/programStore';
import type { ConditioningPerformanceLog } from './conditioningLogging';
import type { SessionComponent } from './sessionComponents';
import type { StrengthExercisePerformanceLog } from './strengthLogging';

export type FeedbackFormSectionId =
  | 'completion'
  | 'feeling'
  | 'soreness'
  | 'partialReason'
  | 'skipReason'
  | 'conditioning'
  | 'notes';

export interface FeedbackFormSection {
  id: FeedbackFormSectionId;
  label: string;
  required: boolean;
}

export const FEEDBACK_FORM_SECTION_LABELS = {
  completion: 'Did you complete it?',
  feeling: 'How did the session feel?',
  partialFeeling: 'How did the completed part feel?',
  soreness: 'How sore are you?',
  partialReason: 'Why did you only complete part of it?',
  skipReason: 'Why did you skip it?',
  conditioning: 'Conditioning performance',
  notes: 'Add a note',
} as const;

export const PARTIAL_REASON_OPTIONS: {
  key: FeedbackPartialReason;
  label: string;
}[] = [
  { key: 'ran_out_of_time', label: 'Ran out of time' },
  { key: 'felt_sore_tight', label: 'Felt sore/tight' },
  { key: 'too_hard_today', label: 'Too hard today' },
  { key: 'equipment_unavailable', label: 'Equipment unavailable' },
  { key: 'other', label: 'Other' },
];

export const SKIP_REASON_OPTIONS: {
  key: FeedbackSkipReason;
  label: string;
}[] = [
  { key: 'busy_no_time', label: 'Busy / no time' },
  { key: 'sore_tight', label: 'Sore or tight' },
  { key: 'injured_niggle', label: 'Injured / niggle' },
  { key: 'sick_low_energy', label: 'Sick / low energy' },
  { key: 'didnt_feel_like_it', label: "Didn't feel like it" },
  { key: 'equipment_unavailable', label: 'Equipment unavailable' },
  { key: 'other', label: 'Other' },
];

export interface FeedbackFormDraft {
  completion: FeedbackCompletion | null;
  componentCompletions?: Record<string, FeedbackCompletion | null>;
  componentReasons?: Record<string, ComponentFeedbackReasonState>;
  feeling: FeedbackFeeling | null;
  soreness: FeedbackSoreness | null;
  partialReason: FeedbackPartialReason | null;
  skipReason: FeedbackSkipReason | null;
}

export interface ComponentFeedbackReasonState {
  partialReason: FeedbackPartialReason | null;
  skipReason: FeedbackSkipReason | null;
}

export interface BuildSessionFeedbackPayloadInput extends FeedbackFormDraft {
  dateStr: string;
  notes?: string;
  difficulty?: number;
  conditioning?: ConditioningPerformanceLog;
  strength?: StrengthExercisePerformanceLog[];
  components?: SessionComponent[];
}

export function getVisibleFeedbackSections(
  completion: FeedbackCompletion | null,
  includeConditioningPerformance = false,
): FeedbackFormSection[] {
  const sections: FeedbackFormSection[] = [
    {
      id: 'completion',
      label: FEEDBACK_FORM_SECTION_LABELS.completion,
      required: true,
    },
  ];

  if (completion === 'full') {
    sections.push(
      {
        id: 'feeling',
        label: FEEDBACK_FORM_SECTION_LABELS.feeling,
        required: true,
      },
      {
        id: 'soreness',
        label: FEEDBACK_FORM_SECTION_LABELS.soreness,
        required: true,
      },
    );
    if (includeConditioningPerformance) {
      sections.push({
        id: 'conditioning',
        label: FEEDBACK_FORM_SECTION_LABELS.conditioning,
        required: false,
      });
    }
    sections.push({
      id: 'notes',
      label: FEEDBACK_FORM_SECTION_LABELS.notes,
      required: false,
    });
  }

  if (completion === 'partial') {
    sections.push(
      {
        id: 'partialReason',
        label: FEEDBACK_FORM_SECTION_LABELS.partialReason,
        required: true,
      },
      {
        id: 'feeling',
        label: FEEDBACK_FORM_SECTION_LABELS.partialFeeling,
        required: true,
      },
      {
        id: 'soreness',
        label: FEEDBACK_FORM_SECTION_LABELS.soreness,
        required: true,
      },
    );
    if (includeConditioningPerformance) {
      sections.push({
        id: 'conditioning',
        label: FEEDBACK_FORM_SECTION_LABELS.conditioning,
        required: false,
      });
    }
    sections.push({
      id: 'notes',
      label: FEEDBACK_FORM_SECTION_LABELS.notes,
      required: false,
    });
  }

  if (completion === 'skipped') {
    sections.push(
      {
        id: 'skipReason',
        label: FEEDBACK_FORM_SECTION_LABELS.skipReason,
        required: true,
      },
      {
        id: 'notes',
        label: FEEDBACK_FORM_SECTION_LABELS.notes,
        required: false,
      },
    );
  }

  return sections;
}

export function completionMapFromFeedback(
  feedback: SessionFeedback | null | undefined,
  components: SessionComponent[],
): Record<string, FeedbackCompletion | null> {
  const next: Record<string, FeedbackCompletion | null> = {};
  const validIds = new Set<string>(components.map((component) => component.id));

  for (const entry of feedback?.components ?? []) {
    if (validIds.has(entry.componentId)) {
      next[entry.componentId] = entry.completion;
    }
  }

  if ((feedback?.components ?? []).length === 0 && components.length === 1) {
    next[components[0].id] = feedback?.completion ?? null;
  }

  for (const component of components) {
    if (!(component.id in next)) next[component.id] = null;
  }

  return next;
}

export function componentReasonsFromFeedback(
  feedback: SessionFeedback | null | undefined,
  components: SessionComponent[],
): Record<string, ComponentFeedbackReasonState> {
  const next: Record<string, ComponentFeedbackReasonState> = {};
  const validIds = new Set<string>(components.map((component) => component.id));

  for (const entry of feedback?.components ?? []) {
    if (validIds.has(entry.componentId)) {
      next[entry.componentId] = {
        partialReason: entry.completion === 'partial' ? entry.partialReason ?? null : null,
        skipReason: entry.completion === 'skipped' ? entry.skipReason ?? null : null,
      };
    }
  }

  if ((feedback?.components ?? []).length === 0 && components.length === 1) {
    next[components[0].id] = {
      partialReason: feedback?.completion === 'partial' ? feedback?.partialReason ?? null : null,
      skipReason: feedback?.completion === 'skipped' ? feedback?.skipReason ?? null : null,
    };
  }

  return sanitizeComponentReasons(next, completionMapFromFeedback(feedback, components), components);
}

export function sanitizeComponentCompletions(
  current: Record<string, FeedbackCompletion | null> | undefined,
  components: SessionComponent[],
): Record<string, FeedbackCompletion | null> {
  const next: Record<string, FeedbackCompletion | null> = {};
  for (const component of components) {
    next[component.id] = current?.[component.id] ?? null;
  }
  return next;
}

export function sanitizeComponentReasons(
  current: Record<string, ComponentFeedbackReasonState> | undefined,
  completions: Record<string, FeedbackCompletion | null> | undefined,
  components: SessionComponent[],
): Record<string, ComponentFeedbackReasonState> {
  const next: Record<string, ComponentFeedbackReasonState> = {};
  for (const component of components) {
    const completion = completions?.[component.id] ?? null;
    const reason = current?.[component.id];
    next[component.id] = {
      partialReason: completion === 'partial' ? reason?.partialReason ?? null : null,
      skipReason: completion === 'skipped' ? reason?.skipReason ?? null : null,
    };
  }
  return next;
}

export function deriveAggregateCompletion(
  components: SessionComponent[] | undefined,
  componentCompletions: Record<string, FeedbackCompletion | null> | undefined,
  fallbackCompletion: FeedbackCompletion | null,
): FeedbackCompletion | null {
  if (!components || components.length === 0) return fallbackCompletion;

  const values = components.map((component) => componentCompletions?.[component.id] ?? null);
  if (values.some((value) => value === null)) return null;

  const completionBearingValues = components
    .filter((component) => component.completionPolicy === 'required')
    .map((component) => componentCompletions?.[component.id] ?? null);
  const aggregateValues = completionBearingValues.length > 0
    ? completionBearingValues
    : values;

  if (aggregateValues.every((value) => value === 'full')) return 'full';
  if (aggregateValues.every((value) => value === 'skipped')) return 'skipped';
  return 'partial';
}

export function sanitizeFeedbackDraftForComponents(
  draft: FeedbackFormDraft,
  components: SessionComponent[],
): FeedbackFormDraft {
  const componentCompletions = sanitizeComponentCompletions(
    draft.componentCompletions,
    components,
  );
  const componentReasons = sanitizeComponentReasons(
    draft.componentReasons,
    componentCompletions,
    components,
  );
  const completion = deriveAggregateCompletion(components, componentCompletions, draft.completion);

  return {
    ...sanitizeFeedbackDraftForCompletion({ ...draft, completion }, completion),
    componentCompletions,
    componentReasons,
  };
}

export function sanitizeFeedbackDraftForCompletion(
  draft: FeedbackFormDraft,
  nextCompletion: FeedbackCompletion | null,
): FeedbackFormDraft {
  if (nextCompletion === 'full') {
    return {
      completion: 'full',
      feeling: draft.feeling ?? null,
      soreness: draft.soreness ?? null,
      partialReason: null,
      skipReason: null,
    };
  }

  if (nextCompletion === 'partial') {
    return {
      completion: 'partial',
      feeling: draft.feeling ?? null,
      soreness: draft.soreness ?? null,
      partialReason: draft.partialReason ?? null,
      skipReason: null,
    };
  }

  if (nextCompletion === 'skipped') {
    return {
      completion: 'skipped',
      feeling: null,
      soreness: null,
      partialReason: null,
      skipReason: draft.skipReason ?? null,
    };
  }

  return {
    completion: null,
    feeling: null,
    soreness: null,
    partialReason: null,
    skipReason: null,
  };
}

export function canSaveFeedbackDraft(draft: FeedbackFormDraft): boolean {
  const componentEntries = Object.entries(draft.componentCompletions ?? {});
  if (componentEntries.length > 0) {
    if (componentEntries.some(([, value]) => value === null)) return false;
    for (const [componentId, value] of componentEntries) {
      const reason = draft.componentReasons?.[componentId];
      if (value === 'partial' && !reason?.partialReason) return false;
      if (value === 'skipped' && !reason?.skipReason) return false;
    }
  }

  const completion = deriveAggregateCompletion(
    undefined,
    undefined,
    draft.completion,
  );

  if (completion === 'full' || completion === 'partial') {
    if (completion === 'partial' && componentEntries.length === 0 && !draft.partialReason) {
      return false;
    }
    return !!(draft.feeling && draft.soreness);
  }

  if (completion === 'skipped') {
    if (componentEntries.length > 0) return true;
    return !!draft.skipReason;
  }

  return false;
}

export function buildSessionFeedbackPayload(
  input: BuildSessionFeedbackPayloadInput,
): SessionFeedback | null {
  const completion = deriveAggregateCompletion(
    input.components,
    input.componentCompletions,
    input.completion,
  );
  const draft = { ...input, completion };
  if (!canSaveFeedbackDraft(draft)) return null;
  if (!completion) return null;

  const componentEntries = buildFeedbackComponentEntries(
    input.components,
    input.componentCompletions,
    input.componentReasons,
  );

  const notes = input.notes?.trim();
  const shared = {
    dateStr: input.dateStr,
    completion,
    ...(componentEntries.length > 0 ? { components: componentEntries } : {}),
    ...(notes ? { notes } : {}),
  };

  if (completion === 'skipped') {
    if (componentEntries.length > 0) {
      return {
        ...shared,
        completion: 'skipped',
      };
    }
    return {
      ...shared,
      completion: 'skipped',
      skipReason: input.skipReason!,
    };
  }

  const includeConditioning = shouldSubmitComponentPayload(
    input.components,
    input.componentCompletions,
    'conditioning',
  );
  const includeStrength = shouldSubmitComponentPayload(
    input.components,
    input.componentCompletions,
    'strength',
  );
  const performedSessionExtras = {
    ...(includeConditioning && Number.isFinite(input.difficulty)
      ? { difficulty: input.difficulty }
      : {}),
    ...(includeConditioning && input.conditioning ? { conditioning: input.conditioning } : {}),
    ...(includeStrength && input.strength && input.strength.length > 0
      ? { strength: input.strength }
      : {}),
  };

  if (completion === 'partial') {
    return {
      ...shared,
      completion: 'partial',
      feeling: input.feeling!,
      soreness: input.soreness!,
      ...(componentEntries.length === 0 && input.partialReason
        ? { partialReason: input.partialReason }
        : {}),
      ...performedSessionExtras,
    };
  }

  return {
    ...shared,
    completion: 'full',
    feeling: input.feeling!,
    soreness: input.soreness!,
    ...performedSessionExtras,
  };
}

function buildFeedbackComponentEntries(
  components: SessionComponent[] | undefined,
  completions: Record<string, FeedbackCompletion | null> | undefined,
  reasons: Record<string, ComponentFeedbackReasonState> | undefined,
): SessionFeedbackComponent[] {
  if (!components || components.length === 0) return [];

  const entries: SessionFeedbackComponent[] = [];
  for (const component of components) {
    const completion = completions?.[component.id];
    if (!completion) continue;
    entries.push({
      componentId: component.id,
      kind: component.kind,
      label: component.label,
      completion,
      ...(completion === 'partial' && reasons?.[component.id]?.partialReason
        ? { partialReason: reasons[component.id].partialReason! }
        : {}),
      ...(completion === 'skipped' && reasons?.[component.id]?.skipReason
        ? { skipReason: reasons[component.id].skipReason! }
        : {}),
    });
  }
  return entries;
}

function shouldSubmitComponentPayload(
  components: SessionComponent[] | undefined,
  completions: Record<string, FeedbackCompletion | null> | undefined,
  kind: SessionComponent['kind'],
): boolean {
  if (!components || components.length === 0) return true;
  const component = components.find((entry) => entry.kind === kind);
  if (!component) return false;
  const completion = completions?.[component.id];
  return completion === 'full' || completion === 'partial';
}
