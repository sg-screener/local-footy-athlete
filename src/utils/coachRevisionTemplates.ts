/**
 * Coach revision template registry — the ONLY source of addable content for
 * one-off replacements (product policy: template-derived, never free-form).
 *
 * Every template is defined by a real Workout builder, and its advertised
 * snapshot is computed by projecting that workout through the SAME
 * projection/snapshot pipeline used everywhere else. That makes round-trip
 * agreement (accepted revision ⇄ written override ⇄ projected day) true by
 * construction: the model must echo the advertised section byte-exactly, and
 * the writer materializes the identical workout.
 */

import type { Workout } from '../types/domain';
import type { ResolvedDay } from './sessionResolver';
import {
  snapshotProjectedDay,
  type CoachVisibleSectionSnapshot,
} from './coachRevisionProposal';
import { projectVisibleDay } from './visibleProgramProjection';

export interface CoachRevisionTemplateDefinition {
  templateId: string;
  label: string;
  description: string;
}

const TEMPLATE_DEFINITIONS: CoachRevisionTemplateDefinition[] = [
  {
    templateId: 'easy_zone2_bike',
    label: 'Easy Zone 2 Bike',
    description: '25min zone 2 bike, conversational pace',
  },
  {
    templateId: 'easy_zone2_row',
    label: 'Easy Zone 2 Row',
    description: '25min zone 2 row, smooth and steady',
  },
  {
    templateId: 'easy_zone2_ski',
    label: 'Easy Zone 2 Ski Erg',
    description: '25min zone 2 ski erg, relaxed rhythm',
  },
];

export function listCoachRevisionTemplates(): CoachRevisionTemplateDefinition[] {
  return TEMPLATE_DEFINITIONS;
}

function definitionById(templateId: string): CoachRevisionTemplateDefinition | null {
  return TEMPLATE_DEFINITIONS.find((entry) => entry.templateId === templateId) ?? null;
}

function isoDateToDayOfWeek(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 1;
  return ((parsed.getUTCDay() + 6) % 7) + 1;
}

/** Real Workout for a template on a given date — what the writer persists. */
export function buildCoachRevisionTemplateWorkout(
  templateId: string,
  date: string,
): Workout | null {
  const def = definitionById(templateId);
  if (!def) return null;
  const rowId = `template:${def.templateId}:main`;
  return {
    id: `template-${def.templateId}`,
    microcycleId: 'coach-template',
    dayOfWeek: isoDateToDayOfWeek(date),
    name: def.label,
    description: def.description,
    durationMinutes: 25,
    intensity: 'Light',
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    hasCombinedConditioning: false,
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{
        title: def.label,
        description: def.description,
        exerciseIds: [rowId],
      }],
    },
    exercises: [{
      id: rowId,
      workoutId: `template-${def.templateId}`,
      exerciseId: rowId,
      exerciseOrder: 0,
      prescribedSets: 1,
      prescribedRepsMin: 25,
      prescribedRepsMax: 25,
      restSeconds: 0,
      notes: def.description,
      exercise: {
        id: rowId,
        name: def.label,
        description: def.description,
        exerciseType: 'Conditioning',
        muscleGroups: [],
        equipmentRequired: [],
        difficultyLevel: 'Beginner',
        createdAt: '',
        updatedAt: '',
      },
      createdAt: '',
      updatedAt: '',
    } as any],
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

/** The advertised, byte-exact section snapshot for a template on a date —
 *  DERIVED via the real projection so it round-trips by construction. */
export function buildCoachRevisionTemplateSection(
  templateId: string,
  date: string,
): CoachVisibleSectionSnapshot | null {
  const workout = buildCoachRevisionTemplateWorkout(templateId, date);
  if (!workout) return null;
  const day: ResolvedDay = {
    date,
    dayOfWeek: isoDateToDayOfWeek(date),
    short: 'DAY',
    isToday: false,
    source: 'manual',
    indicator: null,
    workout,
  } as any;
  const projected = projectVisibleDay({ day, activeInjury: null, todayISO: date }).day;
  const snapshot = snapshotProjectedDay(projected);
  return snapshot.workout?.sections[0] ?? null;
}

/** Extract the template id when a revised day is a pure template session
 *  (v1 replacement shape: exactly one section, all item ids template-owned). */
export function templateIdFromRevisedWorkout(
  workout: { sections: Array<{ items: Array<{ id: string }> }> } | null,
): string | null {
  if (!workout || workout.sections.length !== 1) return null;
  const items = workout.sections[0].items;
  if (items.length === 0) return null;
  const match = /^template:([a-z0-9_]+):/.exec(items[0].id);
  if (!match) return null;
  const templateId = match[1];
  if (!definitionById(templateId)) return null;
  const allOwned = items.every((item) => item.id.startsWith(`template:${templateId}:`));
  return allOwned ? templateId : null;
}
