import type { FeedbackCompletion } from '../types/sessionOutcome';
import type { Workout } from '../types/domain';
import type { MobilityPrehabFlow } from './mobilityPrehabFlow';
import {
  getSessionComponents,
  type SessionComponent,
} from './sessionComponents';
import {
  COMPOSED_OPTIONAL_ICON_KIND,
  SESSION_SECTION_ICON_KIND,
  type RowIconKind,
} from '../rules/sectionIconKinds';
import type { SessionTemplate, SessionTemplateItem } from './sessionTemplate';

/**
 * ⚠ **THERE IS NO `power` SECTION — SAM, 2026-08-20 (R-110).**
 *
 * *"Power belongs inside the Strength section, generally as its first row."*
 * Power used to open its own collapsible POWER / PRIMER disclosure above
 * Strength, so a session of one power row and four strength rows read
 * `Power / Primer 0/1` + `Strength 0/4` — two counts for one block of work the
 * athlete does in one go. It is now `Strength 0/5`.
 *
 * **Power's ROLE and its programming are untouched.** `role: 'power'` still
 * rides every row, `getSessionComponents` still emits the typed `power`
 * component with its own `completionPolicy`, and every §18 counter, budget and
 * policy still reads `powerRows()`. What changed is which disclosure the row is
 * projected into and where it sits inside it — nothing else.
 */
export type SessionExecutionSectionId =
  | 'mobility'
  | 'speed'
  | 'strength'
  | 'primer'
  | 'accessories'
  | 'conditioning'
  | 'team_training'
  | 'recovery'
  | 'optional'
  | 'other';

export interface SessionExecutionItem {
  id: string;
  sectionId: SessionExecutionSectionId;
  componentId: string | null;
  label: string;
  templateIndex: number | null;
  source: 'template' | 'mobility' | 'recovery' | 'component';
}

export interface SessionExecutionSection {
  id: SessionExecutionSectionId;
  label: string;
  items: SessionExecutionItem[];
  /**
   * The glyph this section draws, decided here because only here is the
   * section's typed row identity readable.
   */
  iconKind: RowIconKind;
  /** Context of this section's rows, not the combined day's container. */
  sessionKind?: Workout['composedOptionalKind'];
}

export interface SessionExecutionPlan {
  components: SessionComponent[];
  sections: SessionExecutionSection[];
  items: SessionExecutionItem[];
}

export interface SessionExecutionItemResult {
  itemId: string;
  sectionId: SessionExecutionSectionId;
  componentId: string | null;
  completed: boolean;
}

export interface SessionExecutionSummary {
  components: SessionComponent[];
  componentCompletions: Record<string, FeedbackCompletion | null>;
  sections: Array<{
    sectionId: SessionExecutionSectionId;
    label: string;
    completion: FeedbackCompletion;
    /** How many of this section's items were ticked, and how many there were.
     *  Sam, 2026-08-22: the review says "Partially 3/4", not just "Partially". */
    completedCount: number;
    totalCount: number;
  }>;
  items: SessionExecutionItemResult[];
}

/**
 * ⚠ **ONE OWNER FOR THE WARM-UP ROW'S IDENTITY.**
 *
 * The checklist writes it, `derivedExerciseDecisions` matches a quick swap
 * against it, and `mobilityPrehabFlow` reads it back to keep work the athlete
 * has already done. Three modules re-typing `mobility:${id}` is three chances
 * for one of them to drift, and the row identity is what every saved tick is
 * keyed to.
 */
export function mobilityFlowItemId(movementExerciseId: string): string {
  return `mobility:${movementExerciseId}`;
}

/** The movement id inside a warm-up row identity, or null if it is not one. */
export function mobilityFlowMovementIdOf(itemId: string): string | null {
  return itemId.startsWith('mobility:') ? itemId.slice('mobility:'.length) : null;
}

/**
 * ⚠ **THE WARM-UP SLOTS THIS DATE'S SAVED RECORD PROVES WERE PERFORMED —
 * SAM, 2026-08-25 (R-213).**
 *
 * *"If a warm up is already ticked off then it should stay."* The warm-up is
 * derived from the workout, so changing a main lift re-derives it; feeding this
 * back into `selectMobilityPrehabFlow` is what stops that re-derivation taking
 * the athlete's ticks with it.
 *
 * Only ticked rows, and only ones saved durably: an untouched row is not
 * evidence of anything, and a row the athlete cleared is evidence against.
 */
export function performedMobilityMovementIds(
  feedback: RecordedExecutionFeedback | null | undefined,
): readonly string[] {
  const ids: string[] = [];
  for (const item of feedback?.executionItems ?? []) {
    if (!item.completed || item.sectionId !== 'mobility') continue;
    const movementId = mobilityFlowMovementIdOf(item.itemId);
    if (movementId) ids.push(movementId);
  }
  return ids;
}

/**
 * Whole-session completion from the sections the athlete was prescribed.
 * The separately authored Optional Work cluster remains no-penalty; Mobility /
 * Warm-up is an ordinary prescribed section and therefore participates exactly
 * like Strength, Conditioning and the other session sections.
 */
export function deriveSessionExecutionCompletion(
  summary: Pick<SessionExecutionSummary, 'items'>,
): FeedbackCompletion | null {
  return deriveSessionExecutionItemCompletion(summary.items);
}

/** The accepted save transaction uses this same item evidence. */
export function deriveSessionExecutionItemCompletion(
  items: readonly Pick<SessionExecutionItemResult, 'sectionId' | 'completed'>[],
): FeedbackCompletion | null {
  const prescribed = items.filter((item) => item.sectionId !== 'optional');
  if (prescribed.length === 0) return null;
  if (prescribed.every((item) => item.completed)) return 'full';
  if (prescribed.every((item) => !item.completed)) return 'skipped';
  return 'partial';
}

interface RecordedExecutionFeedback {
  readonly completion: FeedbackCompletion;
  readonly executionItems?: readonly SessionExecutionItemResult[];
  /** A match or club result can share the date record without proving gym work. */
  readonly game?: unknown;
  readonly teamTraining?: unknown;
}

export interface RecordedSessionExecutionReconciliation {
  readonly completedItemIds: ReadonlySet<string>;
  readonly orphanedItems: readonly SessionExecutionItemResult[];
  readonly sectionCompletions: Readonly<Partial<Record<SessionExecutionSectionId, FeedbackCompletion>>>;
  /**
   * The current visible component's answer, including an explicit `null` when
   * that component belongs to a section whose rows changed after it was saved.
   * Explicit null prevents a caller falling back to stale kind-level evidence.
   */
  readonly componentCompletions: Readonly<Record<string, FeedbackCompletion | null>>;
  readonly source: 'exact_items' | 'legacy_programmed_full' | 'none';
}

function componentCompletionsFromSections(
  plan: Pick<SessionExecutionPlan, 'items'>,
  sectionCompletions: Readonly<Partial<Record<SessionExecutionSectionId, FeedbackCompletion>>>,
): Readonly<Record<string, FeedbackCompletion | null>> {
  const sectionsByComponent = new Map<string, Set<SessionExecutionSectionId>>();
  for (const item of plan.items) {
    if (!item.componentId) continue;
    const sections = sectionsByComponent.get(item.componentId) ?? new Set<SessionExecutionSectionId>();
    sections.add(item.sectionId);
    sectionsByComponent.set(item.componentId, sections);
  }
  return Object.fromEntries([...sectionsByComponent.entries()].map(([componentId, sectionIds]) => {
    const values = [...sectionIds].map((sectionId) => sectionCompletions[sectionId] ?? null);
    if (values.some((value) => value === null)) return [componentId, null];
    if (values.every((value) => value === 'full')) return [componentId, 'full'];
    if (values.every((value) => value === 'skipped')) return [componentId, 'skipped'];
    return [componentId, 'partial'];
  }));
}

/**
 * One readback of saved execution evidence against the plan currently shown.
 *
 * Exact rows are never transferred onto replacement rows. A historical `full`
 * may restore prescribed work only when it is genuinely an old programmed-
 * session result; a game or club result sharing the date is not gym evidence.
 */
export function reconcileRecordedSessionExecution(
  plan: Pick<SessionExecutionPlan, 'items' | 'sections'>,
  feedback: RecordedExecutionFeedback | null | undefined,
): RecordedSessionExecutionReconciliation {
  if (!feedback) {
    return {
      completedItemIds: new Set(),
      orphanedItems: [],
      sectionCompletions: {},
      componentCompletions: {},
      source: 'none',
    };
  }

  const visibleItemIds = new Set(plan.items.map((item) => item.id));
  if (feedback.executionItems !== undefined) {
    const currentItems = feedback.executionItems.filter((item) => visibleItemIds.has(item.itemId));
    const currentById = new Map(currentItems.map((item) => [item.itemId, item]));
    const sectionCompletions: Partial<Record<SessionExecutionSectionId, FeedbackCompletion>> = {};
    for (const section of plan.sections) {
      const recorded = section.items.flatMap((item) => {
        const result = currentById.get(item.id);
        return result ? [result] : [];
      });
      // A section changed after it was logged. Missing rows are unknown, not
      // skipped and not completed by association with the old section.
      if (recorded.length === section.items.length && recorded.length > 0) {
        const completion = deriveSessionExecutionItemCompletion(recorded);
        if (completion !== null) sectionCompletions[section.id] = completion;
      }
    }
    return {
      completedItemIds: new Set(currentItems
        .filter((item) => item.completed)
        .map((item) => item.itemId)),
      orphanedItems: feedback.executionItems.filter((item) => !visibleItemIds.has(item.itemId)),
      sectionCompletions,
      componentCompletions: componentCompletionsFromSections(plan, sectionCompletions),
      source: 'exact_items',
    };
  }

  const isLegacyProgrammedFull = feedback.completion === 'full'
    && feedback.game === undefined
    && feedback.teamTraining === undefined;
  if (isLegacyProgrammedFull) {
    const completedItemIds = new Set(plan.items
      .filter((item) => item.sectionId !== 'optional')
      .map((item) => item.id));
    const sectionCompletions = Object.fromEntries(plan.sections
      .filter((section) => section.id !== 'optional')
      .map((section) => [section.id, 'full' as const]));
    return {
      completedItemIds,
      orphanedItems: [],
      sectionCompletions,
      componentCompletions: componentCompletionsFromSections(plan, sectionCompletions),
      source: 'legacy_programmed_full',
    };
  }

  return {
    completedItemIds: new Set(),
    orphanedItems: [],
    sectionCompletions: {},
    componentCompletions: componentCompletionsFromSections(plan, {}),
    source: 'none',
  };
}

/** Read one reconciled checklist section for a day-card completion mark. */
export function recordedExecutionSectionCompletion(
  plan: Pick<SessionExecutionPlan, 'items' | 'sections'>,
  feedback: RecordedExecutionFeedback | null | undefined,
  sectionId: SessionExecutionSectionId,
): FeedbackCompletion | null {
  return reconcileRecordedSessionExecution(plan, feedback).sectionCompletions[sectionId] ?? null;
}

/**
 * Restore the screen checklist from the durable result for this session.
 *
 * Exact item evidence wins. Results for rows that no longer exist in the
 * current visible plan are ignored rather than resurrected. A legacy `full`
 * result predates item evidence, so it can restore prescribed work only;
 * optional work remains unknown and therefore unticked.
 */
export function recordedCompletedSessionExecutionItemIds(
  plan: Pick<SessionExecutionPlan, 'items' | 'sections'>,
  feedback: RecordedExecutionFeedback | null | undefined,
): ReadonlySet<string> {
  return reconcileRecordedSessionExecution(plan, feedback).completedItemIds;
}

/**
 * ⚠ **EXPORTED, BECAUSE THE ADD MENU NAMES THE SAME THINGS.**
 *
 * The Add flow's top level IS three of these sections — `strength`,
 * `conditioning` and `mobility` — and an athlete who adds work under
 * "Conditioning" must land in the section this screen calls Conditioning. Importing the table is what makes that true by construction;
 * re-typing the three words here would be a second vocabulary for one question,
 * free to drift the day either is reworded.
 */
export const SECTION_LABELS: Record<SessionExecutionSectionId, string> = {
  mobility: 'Mobility / Warm-up',
  speed: 'Speed',
  strength: 'Strength',
  primer: 'Primer',
  accessories: 'Accessories / Prehab',
  conditioning: 'Conditioning',
  team_training: 'Team Training',
  recovery: 'Recovery',
  optional: 'Optional Work',
  other: 'Session',
};

/* A composed optional session's own section glyph now comes from the ONE table
   in `rules/sectionIconKinds`. This file used to keep a hand-written mirror of
   `rules/dayTimeline`'s copy — two tables answering one question, which is the
   defect R-116 was written about. */

const SECTION_ORDER: SessionExecutionSectionId[] = [
  'mobility', 'primer', 'strength', 'accessories', 'speed', 'conditioning',
  'team_training', 'recovery', 'optional', 'other',
];

/**
 * ⚠ **NOTHING HERE ORDERS THE STRENGTH SECTION, AND THAT IS DELIBERATE.**
 *
 * R-110 says power is generally Strength's FIRST row. A `orderSectionItems`
 * partition that hoisted power was written here and then DELETED: mutating it
 * to a no-op reddened not one cell, because `sessionTemplate`'s `d2Rank`
 * (`SESSION_ROLE_ORDER`: power → main → accessory → midline/prehab) has always
 * been the owner of that order, and the section filter below preserves whatever
 * order the composition owner emitted. A second sort agreeing with the first is
 * not a backstop, it is a rival authority nothing can tell apart when they
 * disagree — the shape this repo keeps paying for.
 *
 * The property is still HELD: `test:session-execution` `[7]` asserts, through
 * the real template, that Strength opens with the power row even when the
 * workout authors it last, and begins with the main lift when there is none.
 */

function rowIdentity(row: any, fallback: string): string {
  return String(row?.id ?? row?.exerciseId ?? row?.exercise?.id ?? fallback);
}

function rowLabel(row: any, fallback: string): string {
  return String(row?.exercise?.name ?? row?.name ?? fallback);
}

function componentForTemplateItem(
  item: SessionTemplateItem,
  components: SessionComponent[],
): string | null {
  if (item.kind === 'exercise') {
    const lowLoadOwner = components.find(component => component.exerciseIds?.includes(item.row.id));
    if (lowLoadOwner) return lowLoadOwner.id;
  }
  const ids = new Set(components.map((component) => component.id));
  if (item.kind === 'team_training') return ids.has('team_training') ? 'team_training' : 'session';
  if (item.kind === 'conditioning_choice' || item.role === 'conditioning') {
    return ids.has('conditioning') ? 'conditioning' : ids.has('finisher') ? 'finisher' : 'session';
  }
  if (item.kind === 'exercise' && item.presentation === 'mobility') {
    return ids.has('mobility') ? 'mobility' : 'session';
  }
  if (item.kind === 'exercise' && item.presentation === 'recovery') {
    return ids.has('recovery') ? 'recovery' : 'session';
  }
  if (item.role === 'power') return ids.has('power') ? 'power' : 'strength';
  if (item.kind === 'exercise' && item.optional && ids.has('recovery_addon')) return 'recovery_addon';
  if (item.role === 'midline' && ids.has('support')) return 'support';
  if (ids.has('strength')) return 'strength';
  if (ids.has('recovery')) return 'recovery';
  return ids.has('session') ? 'session' : null;
}

function sectionForTemplateItem(item: SessionTemplateItem, workout: Workout): SessionExecutionSectionId {
  if (item.kind === 'team_training') return 'team_training';
  if (item.kind === 'exercise' && item.presentation === 'speed') return 'speed';
  if (item.kind === 'exercise' && item.row.sessionSection && item.row.sessionSection !== 'strength') return item.row.sessionSection;
  if (item.kind === 'conditioning_choice' || item.role === 'conditioning') return 'conditioning';
  if (item.kind === 'exercise' && item.optional) return 'optional';
  if (item.kind === 'exercise' && item.presentation === 'mobility') return 'mobility';
  if (item.kind === 'exercise' && item.presentation === 'recovery') return 'recovery';
  if (item.kind === 'exercise') {
    const kind = item.row.composedOptionalKind ?? workout.composedOptionalKind;
    if (kind === 'primer') return 'primer';
    if (kind === 'prehab') return 'accessories';
  }
  // R-110 — power is Strength's first row, not its own section. The ROLE is
  // still what routes it; only the destination changed.
  if (item.role === 'power') return 'strength';
  if (item.role === 'main_lift') return 'strength';
  if (item.role === 'accessory' || item.role === 'midline' || item.role === 'prehab') return 'strength';
  return 'other';
}

function itemFromTemplate(
  item: SessionTemplateItem,
  index: number,
  components: SessionComponent[],
  workout: Workout,
): SessionExecutionItem {
  if (item.kind === 'team_training') {
    return {
      id: 'team-training', sectionId: 'team_training',
      componentId: componentForTemplateItem(item, components),
      label: 'Team training', templateIndex: index, source: 'template',
    };
  }
  if (item.kind === 'conditioning_choice') {
    const optionIds = item.options.flatMap((option) => option.rows)
      .map((row, rowIndex) => rowIdentity(row, `row-${rowIndex}`));
    return {
      id: `conditioning-choice:${optionIds.join('+') || index}`,
      sectionId: 'conditioning',
      componentId: componentForTemplateItem(item, components),
      label: item.options.length > 1 ? 'Conditioning choice' : item.options[0]?.title ?? 'Conditioning',
      templateIndex: index,
      source: 'template',
    };
  }
  return {
    id: `exercise:${rowIdentity(item.row, String(index))}`,
    sectionId: sectionForTemplateItem(item, workout),
    componentId: componentForTemplateItem(item, components),
    label: rowLabel(item.row, `Exercise ${index + 1}`),
    templateIndex: index,
    source: 'template',
  };
}

export function buildSessionExecutionPlan(args: {
  workout: Workout;
  template: SessionTemplate;
  mobilityFlow: MobilityPrehabFlow | null;
}): SessionExecutionPlan {
  /**
   * ⚠ **CLUB TRAINING IS NOT PART OF THE SESSION THE ATHLETE IS EXECUTING**
   * (Sam, 2026-08-22: *"inside the session view - we no longer need reference
   * to team training so remove the box with the chevron drop down saying team
   * training ... and remove the team training area of the session feedback
   * form"*).
   *
   * Removing the template row was not enough on its own: the loop below gives
   * every COMPONENT without a row its own checkable unit — that is what a
   * rowless speed block or team commitment relies on — so club training came
   * straight back as a `TEAM TRAINING 0/1` section and as a line in the
   * feedback form's completed list.
   *
   * It has its own card and its own form on the day view. This plan is the gym
   * session's checklist, and the two must not both claim it.
   */
  const components = getSessionComponents(args.workout)
    .filter((component) => component.kind !== 'team_training');
  const items: SessionExecutionItem[] = [];

  for (const movement of args.mobilityFlow?.movements ?? []) {
    items.push({
      id: mobilityFlowItemId(movement.exercise.id),
      sectionId: 'mobility',
      componentId: null,
      label: movement.exercise.name,
      templateIndex: null,
      source: 'mobility',
    });
  }

  args.template.items.forEach((item, index) => items.push(itemFromTemplate(item, index, components, args.workout)));

  // A typed component can exist without an ordinary row (speed blocks and a
  // team commitment are examples). It still gets one visible, checkable unit.
  for (const component of components) {
    if (items.some((item) => item.componentId === component.id)) continue;
    items.push({
      id: `component:${component.id}`,
      sectionId: component.kind === 'recovery' ? 'recovery'
        : component.kind === 'mobility' ? 'mobility'
        : component.kind === 'speed' ? 'speed'
        : component.kind === 'conditioning' || component.kind === 'finisher' ? 'conditioning'
        : component.kind === 'team_training' ? 'team_training'
        // R-110 — a rowless power component opens Strength, same as a row does.
        : component.kind === 'power' ? 'strength'
        : component.kind === 'strength' ? 'strength'
        : 'other',
      componentId: component.id,
      label: component.label,
      templateIndex: null,
      source: 'component',
    });
  }

  // The existing row-level composed identity survives combined days. It owns
  // both the visible section and the Add context; the day's purity marker does
  // not. No name parsing or new programming classification is involved.
  const sections = SECTION_ORDER.map((id) => {
    const ownItems = items.filter((item) => item.sectionId === id);
    const kinds = new Set(ownItems.flatMap(item => {
      const templateItem = item.templateIndex === null ? null : args.template.items[item.templateIndex];
      if (templateItem?.kind !== 'exercise') return [];
      const kind = templateItem.row.composedOptionalKind ?? args.workout.composedOptionalKind;
      return kind ? [kind] : [];
    }));
    const sessionKind = kinds.size === 1 ? [...kinds][0] : undefined;
    return {
      id,
      label: SECTION_LABELS[id],
      iconKind: id === 'accessories' && sessionKind === 'prehab'
        ? COMPOSED_OPTIONAL_ICON_KIND.prehab : SESSION_SECTION_ICON_KIND[id],
      items: ownItems,
      ...(sessionKind ? { sessionKind } : {}),
    };
  }).filter((section) => section.items.length > 0);
  return { components, sections, items };
}

export function deriveChecklistComponentCompletions(
  plan: SessionExecutionPlan,
  completedItemIds: ReadonlySet<string>,
): Record<string, FeedbackCompletion | null> {
  return Object.fromEntries(plan.components.map((component) => {
    const items = plan.items.filter((item) => item.componentId === component.id);
    const completed = items.filter((item) => completedItemIds.has(item.id)).length;
    const value: FeedbackCompletion = completed === 0
      ? 'skipped'
      : completed === items.length ? 'full' : 'partial';
    return [component.id, value];
  }));
}

export function buildSessionExecutionSummary(
  plan: SessionExecutionPlan,
  completedItemIds: ReadonlySet<string>,
): SessionExecutionSummary {
  const completionForItems = (items: SessionExecutionItem[]): FeedbackCompletion => {
    const completed = items.filter((item) => completedItemIds.has(item.id)).length;
    if (completed === 0) return 'skipped';
    return completed === items.length ? 'full' : 'partial';
  };
  return {
    components: plan.components,
    componentCompletions: deriveChecklistComponentCompletions(plan, completedItemIds),
    sections: plan.sections.map((section) => ({
      sectionId: section.id,
      label: section.label,
      completion: completionForItems(section.items),
      /* THE SAME TWO NUMBERS `completionForItems` ALREADY COUNTS to decide the
         word. Derived here rather than recounted at the surface, so the word
         and the numbers beside it can never disagree — "Fully 6/7" is exactly
         the kind of sentence a second count produces. */
      completedCount: section.items.filter((item) => completedItemIds.has(item.id)).length,
      totalCount: section.items.length,
    })),
    items: plan.items.map((item) => ({
      itemId: item.id,
      sectionId: item.sectionId,
      componentId: item.componentId,
      completed: completedItemIds.has(item.id),
    })),
  };
}
