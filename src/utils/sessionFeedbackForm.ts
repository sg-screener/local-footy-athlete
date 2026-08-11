import type {
  FeedbackCompletion,
  FeedbackFeeling,
  FeedbackPartialReason,
  FeedbackSkipReason,
  FeedbackSoreness,
  SessionFeedback,
  SessionFeedbackComponent,
} from '../store/programStore';
import {
  expectationAsksWhy,
  parseFeedbackGameFeel,
  type FeedbackExpectation,
  type FeedbackExpectationReason,
  type FeedbackGameFeel,
} from '../types/sessionOutcome';
import type { ConditioningPerformanceLog } from './conditioningLogging';
import type { SessionComponent } from './sessionComponents';
import type { SessionExecutionItemResult } from './sessionExecutionChecklist';
import type { TeamNightSize } from '../rules/teamNightSize';
import type { StrengthExercisePerformanceLog } from './strengthLogging';

export type FeedbackFormSectionId =
  | 'completion'
  | 'teamNightSize'
  | 'gameFeel'
  | 'expectation'
  | 'expectationReason'
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
  // Sam's signed wording, 2026-07-30. Also registered in the signed-copy sheet
  // (`team_night_size_question`) — this constant is where the panel reads it, the sheet
  // is where its provenance lives.
  teamNightSize: 'How was training?',
  // SIGNED, batch 18, Sam 2026-08-09.
  //
  // `expectation` IS THE ONE HE REWORDED (decision C2). It read "How did it
  // compare with what was planned?" — a question that asks the athlete to hold
  // the plan in their head before they can answer. "How did that go?" asks for
  // the same three answers with none of that work. THE ANSWERS ARE UNCHANGED,
  // which is what makes this a wording change rather than a new question: no
  // stored value moves, and every session already recorded still means what it
  // meant.
  gameFeel: 'How were your legs and energy?',
  expectation: 'How did that go?',
  expectationReason: 'What made the difference?',
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

/**
 * The five body-feel taps, PROPOSED (batch 18).
 *
 * WORDS, NOT BARE NUMBERS, on the surface. The stored value is 1-5 because a
 * scale is what the design ruled and what a trend needs; what the athlete READS
 * is a sentence, because "3" is not an answer to "how were your legs".
 */
export const GAME_FEEL_OPTIONS: {
  key: FeedbackGameFeel;
  label: string;
}[] = [
  { key: 1, label: 'Empty' },
  { key: 2, label: 'Heavy' },
  { key: 3, label: 'Okay' },
  { key: 4, label: 'Good' },
  { key: 5, label: 'Flying' },
];

/** The one-tap exception's four answers, PROPOSED (batch 18). */
export const EXPECTATION_OPTIONS: {
  key: FeedbackExpectation;
  label: string;
}[] = [
  { key: 'as_expected', label: 'As expected' },
  { key: 'harder_than_expected', label: 'Harder' },
  { key: 'easier_than_expected', label: 'Easier' },
  { key: 'stopped_early', label: 'Stopped early' },
];

/** Why it differed, PROPOSED (batch 18). Asked only for the last three above. */
export const EXPECTATION_REASON_OPTIONS: {
  key: FeedbackExpectationReason;
  label: string;
}[] = [
  { key: 'soreness', label: 'Soreness' },
  { key: 'energy', label: 'Energy' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'time', label: 'Time' },
  { key: 'pain', label: 'Pain' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'motivation', label: 'Motivation' },
];

export interface FeedbackFormDraft {
  completion: FeedbackCompletion | null;
  /** Only ever set on a team-training day — see `getVisibleFeedbackSections`. */
  teamNightSize?: TeamNightSize | null;
  /** Only ever set on a GAME day — same law as the team night answer above. */
  gameFeel?: FeedbackGameFeel | null;
  /** The one-tap exception. Optional: an unanswered tap is not a wrong answer. */
  expectation?: FeedbackExpectation | null;
  /** Required only when the expectation asks why (`expectationAsksWhy`). */
  expectationReason?: FeedbackExpectationReason | null;
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
  executionItems?: SessionExecutionItemResult[];
}

/** The live checklist's one-row effort scale. Legacy conditioning RPE remains 1–10. */
export function isSessionEffortRating(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

/**
 * THE ONE QUESTION, ON A SURFACE THAT ALREADY EXISTS (Sam, 2026-07-30).
 *
 * It appears only on a team-training day, and only when the athlete actually did the
 * session — a skipped team night has no size, and asking would collect an answer about a
 * night that did not happen. That is why it rides `completion` rather than sitting at the
 * top of the form.
 */
/**
 * WHICH QUESTIONS THE FORM PUTS, given what the athlete has answered so far.
 *
 * THE FLAGS BECAME AN OPTIONS OBJECT WHEN THE THIRD ONE ARRIVED, and that is a
 * fix rather than a tidy-up: `(completion, true, false, true)` is a call nobody
 * can read and every caller can get wrong by transposition, and these flags
 * decide whether a question is ASKED — which decides whether its answer may be
 * stored at all. The old positional form is gone rather than kept beside it;
 * one door, per L15's spirit.
 */
export interface VisibleFeedbackSectionOptions {
  /** The conditioning performance block is only offered for trackable work. */
  readonly includeConditioningPerformance?: boolean;
  readonly isTeamTrainingDay?: boolean;
  /** A GAME asks the body-feel rating, and only a game may store one. */
  readonly isGameDay?: boolean;
  /** What the athlete has tapped so far — the reason question follows it. */
  readonly expectation?: FeedbackExpectation | null;
}

export function getVisibleFeedbackSections(
  completion: FeedbackCompletion | null,
  options: VisibleFeedbackSectionOptions = {},
): FeedbackFormSection[] {
  const {
    includeConditioningPerformance = false,
    isTeamTrainingDay = false,
    isGameDay = false,
    expectation = null,
  } = options;
  const sections: FeedbackFormSection[] = [
    {
      id: 'completion',
      label: FEEDBACK_FORM_SECTION_LABELS.completion,
      required: true,
    },
  ];

  // THE PERFORMED-SESSION QUESTIONS. All of them ride `completion` rather than
  // sitting at the top of the form, for the reason the team-night comment above
  // gives: a session that did not happen has no size, no body-feel and nothing
  // to compare against a prescription, and asking would collect an answer about
  // a session that did not exist.
  if (completion === 'full' || completion === 'partial') {
    if (isTeamTrainingDay) {
      sections.push({
        id: 'teamNightSize',
        label: FEEDBACK_FORM_SECTION_LABELS.teamNightSize,
        required: false,
      });
    }
    if (isGameDay) {
      sections.push({
        id: 'gameFeel',
        label: FEEDBACK_FORM_SECTION_LABELS.gameFeel,
        required: false,
      });
    }
    // OPTIONAL, DELIBERATELY. The tap is a new question on a flow athletes
    // already use; making it required would change what an existing save costs
    // them. An unanswered tap is not a wrong answer — it is a question they
    // chose not to answer, and the app stores nothing for it.
    sections.push({
      id: 'expectation',
      label: FEEDBACK_FORM_SECTION_LABELS.expectation,
      required: false,
    });
    // ...but once they HAVE said it differed, the why is required. The addendum:
    // "Only the last three ask why."
    if (expectationAsksWhy(expectation)) {
      sections.push({
        id: 'expectationReason',
        label: FEEDBACK_FORM_SECTION_LABELS.expectationReason,
        required: true,
      });
    }
  }

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

/**
 * WHAT A SAVED OUTCOME SAYS ABOUT EACH COMPONENT — one rule, two shapes of caller.
 *
 * The feedback panel asks it holding `SessionComponent[]`; the day-first timeline
 * asks it holding part ids off the projection. Both need the SAME answer,
 * including the legacy lift below, so the rule is stated once over bare ids and
 * `completionMapFromFeedback` is the panel's spelling of it. A second copy of
 * this would be a second answer to "was this component done", and the two would
 * disagree the first time the lift changed.
 *
 * THE LEGACY LIFT (unchanged, and load-bearing): a saved outcome from before
 * component-level completions carries no `components[]` at all. On a
 * single-component session its session-level `completion` IS that component's
 * completion — without this, a session the card already badges "Done" shows an
 * unticked timeline, which is one screen telling two stories. L15's read-ingress
 * shape: old formats are lifted at the boundary, never written again.
 */
export function completionByComponentId(
  feedback: SessionFeedback | null | undefined,
  componentIds: readonly string[],
): Record<string, FeedbackCompletion | null> {
  const next: Record<string, FeedbackCompletion | null> = {};
  const validIds = new Set<string>(componentIds);

  for (const entry of feedback?.components ?? []) {
    if (validIds.has(entry.componentId)) {
      next[entry.componentId] = entry.completion;
    }
  }

  if ((feedback?.components ?? []).length === 0 && componentIds.length === 1) {
    next[componentIds[0]] = feedback?.completion ?? null;
  }

  for (const componentId of componentIds) {
    if (!(componentId in next)) next[componentId] = null;
  }

  return next;
}

export function completionMapFromFeedback(
  feedback: SessionFeedback | null | undefined,
  components: SessionComponent[],
): Record<string, FeedbackCompletion | null> {
  return completionByComponentId(
    feedback,
    components.map((component) => component.id),
  );
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
  // This function REBUILDS the draft rather than patching it, so every field must be
  // carried forward explicitly — a field omitted here is silently lost the moment the
  // athlete changes their completion answer. `teamNightSize` survives a full/partial
  // switch (they did the session either way) and is cleared for skipped and unanswered
  // (there is no size for a night that did not happen).
  if (nextCompletion === 'full') {
    return {
      completion: 'full',
      teamNightSize: draft.teamNightSize ?? null,
      feeling: draft.feeling ?? null,
      soreness: draft.soreness ?? null,
      partialReason: null,
      skipReason: null,
    };
  }

  if (nextCompletion === 'partial') {
    return {
      completion: 'partial',
      teamNightSize: draft.teamNightSize ?? null,
      feeling: draft.feeling ?? null,
      soreness: draft.soreness ?? null,
      partialReason: draft.partialReason ?? null,
      skipReason: null,
    };
  }

  if (nextCompletion === 'skipped') {
    return {
      completion: 'skipped',
      teamNightSize: null,
      feeling: null,
      soreness: null,
      partialReason: null,
      skipReason: draft.skipReason ?? null,
    };
  }

  return {
    completion: null,
    teamNightSize: null,
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
    // A HALF-ANSWERED TAP IS REFUSED AT THE DRAFT, not silently dropped at the
    // payload. "It was harder than expected" with no why is a question the
    // athlete opened and left open; saving it would store an expectation whose
    // reason nothing can ever supply, because the form will not ask again.
    if (expectationAsksWhy(draft.expectation) && !draft.expectationReason) {
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
  const checklistMode = Array.isArray(input.executionItems);
  if (!checklistMode && !canSaveFeedbackDraft(draft)) return null;
  if (!completion) return null;
  if (checklistMode && completion !== 'skipped' && !isSessionEffortRating(input.difficulty)) {
    return null;
  }

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
    ...(checklistMode ? { executionItems: input.executionItems } : {}),
  };

  if (checklistMode) {
    return {
      ...shared,
      completion,
      ...(completion !== 'skipped' && isSessionEffortRating(input.difficulty)
        ? { difficulty: input.difficulty }
        : {}),
    };
  }

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
    // The team-night answer travels with the performed session and nowhere else. A
    // skipped night returns above without it, which is deliberate: there is no size for a
    // night that did not happen, and a stored `normal` would be a measurement of nothing.
    ...(input.teamNightSize ? { teamNightSize: input.teamNightSize } : {}),
    // THE GAME RATING TRAVELS THE SAME WAY, and its guard is the same one: the
    // caller passes null unless the form ASKED, so the app cannot hold an answer
    // to a question it never put. `parse` rather than a cast, because a draft is
    // athlete-shaped data arriving from a surface.
    ...(parseFeedbackGameFeel(input.gameFeel) !== null
      ? { gameFeel: parseFeedbackGameFeel(input.gameFeel)! }
      : {}),
    // THE TAP, AND ITS WHY, TRAVEL TOGETHER OR NOT AT ALL. The draft gate above
    // already refuses a half-answered pair, so this is the second half of one
    // rule rather than a second rule: a reason without its expectation would be
    // an answer to a question with no subject.
    ...(input.expectation
      ? {
        expectation: input.expectation,
        ...(expectationAsksWhy(input.expectation) && input.expectationReason
          ? { expectationReason: input.expectationReason }
          : {}),
      }
      : {}),
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
