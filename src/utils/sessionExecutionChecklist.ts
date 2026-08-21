import type { FeedbackCompletion } from '../types/sessionOutcome';
import type { Workout } from '../types/domain';
import type { MobilityPrehabFlow } from './mobilityPrehabFlow';
import { getSessionComponents, type SessionComponent } from './sessionComponents';
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
  | 'strength'
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
  }>;
  items: SessionExecutionItemResult[];
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
  strength: 'Strength',
  accessories: 'Accessories / Prehab',
  conditioning: 'Conditioning',
  team_training: 'Team Training',
  recovery: 'Recovery',
  optional: 'Optional Work',
  other: 'Session',
};

const SECTION_ORDER: SessionExecutionSectionId[] = [
  'mobility', 'strength', 'accessories', 'conditioning',
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

function sectionForTemplateItem(item: SessionTemplateItem): SessionExecutionSectionId {
  if (item.kind === 'team_training') return 'team_training';
  if (item.kind === 'conditioning_choice' || item.role === 'conditioning') return 'conditioning';
  if (item.kind === 'exercise' && item.optional) return 'optional';
  if (item.kind === 'exercise' && item.presentation === 'mobility') return 'mobility';
  if (item.kind === 'exercise' && item.presentation === 'recovery') return 'recovery';
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
    sectionId: sectionForTemplateItem(item),
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
  const components = getSessionComponents(args.workout);
  const items: SessionExecutionItem[] = [];

  for (const movement of args.mobilityFlow?.movements ?? []) {
    items.push({
      id: `mobility:${movement.exercise.id}`,
      sectionId: 'mobility',
      componentId: null,
      label: movement.exercise.name,
      templateIndex: null,
      source: 'mobility',
    });
  }

  args.template.items.forEach((item, index) => items.push(itemFromTemplate(item, index, components)));

  // A typed component can exist without an ordinary row (speed blocks and a
  // team commitment are examples). It still gets one visible, checkable unit.
  for (const component of components) {
    if (items.some((item) => item.componentId === component.id)) continue;
    items.push({
      id: `component:${component.id}`,
      sectionId: component.kind === 'recovery' ? 'recovery'
        : component.kind === 'mobility' ? 'mobility'
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

  const sections = SECTION_ORDER.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    items: items.filter((item) => item.sectionId === id),
  })).filter((section) => section.items.length > 0);
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
    })),
    items: plan.items.map((item) => ({
      itemId: item.id,
      sectionId: item.sectionId,
      componentId: item.componentId,
      completed: completedItemIds.has(item.id),
    })),
  };
}
