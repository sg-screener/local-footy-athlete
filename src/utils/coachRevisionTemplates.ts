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
  /** 'flush' = rejuvenation, addable any week in-season.
   *  'work_capacity' = harder off-legs conditioning, BYE WEEKS ONLY
   *  (a week whose visible days include no Game Day). Coaching policy from
   *  the product owner, 2026-07-03. */
  category: 'flush' | 'work_capacity';
  byeOnly: boolean;
  durationMinutes: number;
}

const TEMPLATE_DEFINITIONS: CoachRevisionTemplateDefinition[] = [
  // ── Flush family: goal is rejuvenation, never extra fitness ──
  {
    templateId: 'easy_zone2_bike',
    label: 'Easy Zone 2 Bike',
    description: '25min zone 2 bike, conversational pace',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 25,
  },
  {
    templateId: 'easy_zone2_row',
    label: 'Easy Zone 2 Row',
    description: '25min zone 2 row, smooth and steady',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 25,
  },
  {
    templateId: 'easy_zone2_ski',
    label: 'Easy Zone 2 Ski Erg',
    description: '25min zone 2 ski erg, relaxed rhythm',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 25,
  },
  {
    templateId: 'flushout_3030',
    label: 'Flush Out — 30:30 Intervals',
    description:
      '24min: 30s easy effort / 30s off, rotating bike, row or ski. Rejuvenation only — nothing hard.',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 24,
  },
  {
    templateId: 'flushout_1on_1off',
    label: 'Flush Out — 1min On / 1min Off',
    description:
      '24min: 1min easy effort / 1min off on any erg. Keep every rep genuinely easy — this is a flush, not fitness.',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 24,
  },
  {
    templateId: 'flushout_2on_1off',
    label: 'Flush Out — 2min On / 1min Off',
    description:
      '24min: 2min easy effort / 1min off on any erg. Steady and restorative, RPE 4-5 max.',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 24,
  },
  // ── Work capacity: harder off-legs conditioning, bye weeks only ──
  {
    templateId: 'erg_emom',
    label: 'Erg EMOM — 10-15 cal',
    description:
      '24min EMOM: every minute on the minute, 10-15 cal effort, rest the remainder of the minute. Rotate bike, ski, row and assault bike each round.',
    category: 'work_capacity',
    byeOnly: true,
    durationMinutes: 24,
  },
  {
    templateId: 'metcon_offlegs',
    label: 'MetCon — Off-Legs',
    description:
      '28min: 4 stations x 7 rounds — hard erg efforts (bike/row/ski/assault), carries and burpees. Vary work:rest from 1:2 up to 3:1. Mostly off legs.',
    category: 'work_capacity',
    byeOnly: true,
    durationMinutes: 28,
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
    durationMinutes: def.durationMinutes,
    intensity: def.category === 'work_capacity' ? 'Moderate' : 'Light',
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
      prescribedRepsMin: def.durationMinutes,
      prescribedRepsMax: def.durationMinutes,
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

/** True when a visible day looks like a game day. Bye detection: a week
 *  whose visible days contain NO game day is a bye week, which unlocks the
 *  work-capacity templates. Detection is name/type based for now — the
 *  snapshot does not carry sessionTier (future improvement). */
export function visibleDayLooksLikeGame(day: {
  workout: { title?: string; workoutType?: string; name?: string } | null;
}): boolean {
  if (!day.workout) return false;
  const haystack = [
    day.workout.title ?? '',
    (day.workout as any).name ?? '',
    day.workout.workoutType ?? '',
  ].join(' ').toLowerCase();
  return haystack.includes('game');
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
