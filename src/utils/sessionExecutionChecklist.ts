import type { FeedbackCompletion } from '../types/sessionOutcome';
import type { Workout } from '../types/domain';
import type { MobilityPrehabFlow } from './mobilityPrehabFlow';
import { getSessionComponents, type SessionComponent } from './sessionComponents';
import type { SessionTemplate, SessionTemplateItem } from './sessionTemplate';

export type SessionExecutionSectionId =
  | 'mobility'
  | 'power'
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

const SECTION_LABELS: Record<SessionExecutionSectionId, string> = {
  mobility: 'Mobility / Warm-up',
  power: 'Power / Primer',
  strength: 'Strength',
  accessories: 'Accessories / Prehab',
  conditioning: 'Conditioning',
  team_training: 'Team Training',
  recovery: 'Recovery',
  optional: 'Optional Work',
  other: 'Session',
};

const SECTION_ORDER: SessionExecutionSectionId[] = [
  'mobility', 'power', 'strength', 'accessories', 'conditioning',
  'team_training', 'recovery', 'optional', 'other',
];

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
  if (item.role === 'power') return 'power';
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

  if (args.template.mode === 'recovery') {
    for (const [index, row] of (args.workout.exercises ?? []).entries()) {
      items.push({
        id: `exercise:${rowIdentity(row, String(index))}`,
        sectionId: 'recovery', componentId: 'recovery',
        label: rowLabel(row, `Exercise ${index + 1}`), templateIndex: null, source: 'recovery',
      });
    }
    for (const addon of args.workout.recoveryAddons ?? []) {
      for (const exercise of addon.exercises ?? []) {
        items.push({
          id: `exercise:${rowIdentity(exercise, addon.id)}`,
          sectionId: 'optional', componentId: 'recovery_addon',
          label: rowLabel(exercise, addon.label), templateIndex: null, source: 'recovery',
        });
      }
    }
  } else {
    args.template.items.forEach((item, index) => items.push(itemFromTemplate(item, index, components)));
  }

  // A typed component can exist without an ordinary row (speed blocks and a
  // team commitment are examples). It still gets one visible, checkable unit.
  for (const component of components) {
    if (items.some((item) => item.componentId === component.id)) continue;
    items.push({
      id: `component:${component.id}`,
      sectionId: component.kind === 'recovery' ? 'recovery'
        : component.kind === 'conditioning' || component.kind === 'finisher' ? 'conditioning'
        : component.kind === 'team_training' ? 'team_training'
        : component.kind === 'power' ? 'power'
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
