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
   *  the product owner, 2026-07-03.
   *  'recovery' = restorative flow (tissue quality / mobility / breathing),
   *  addable any week. Sheet v2 category, 2026-07-03 evening. */
  category: 'flush' | 'work_capacity' | 'recovery';
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
  // ── Recovery: restore, never load ──
  {
    templateId: 'recovery_flow',
    label: 'Recovery Flow',
    description:
      '30min restorative: foam rolling, hip & ankle mobility, easy spin, breathing reset. Restore — never load.',
    category: 'recovery',
    byeOnly: false,
    durationMinutes: 30,
  },
];

/** Fixed rows for the recovery_flow template. Deterministic content — the
 *  same flow every time, matching the registry principle that advertised
 *  and materialized workouts agree byte-exactly. Row keys become
 *  `template:recovery_flow:<key>` ids so templateIdFromRevisedWorkout
 *  recognises the workout as registry-owned. */
const RECOVERY_FLOW_ROWS: Array<{
  key: string;
  name: string;
  minutes: number;
  notes: string;
}> = [
  {
    key: 'roll',
    name: 'Foam Roll — Full Body',
    minutes: 8,
    notes: 'Quads, glutes, calves, upper back. Slow passes, keep breathing.',
  },
  {
    key: 'mobility',
    name: 'Mobility Flow — Hips & Ankles',
    minutes: 10,
    notes: 'Deep lunge holds, 90/90s, ankle rocks. Easy ranges only.',
  },
  {
    key: 'spin',
    name: 'Easy Spin or Walk',
    minutes: 10,
    notes: 'Zone 1, fully conversational. Any erg or a walk outside.',
  },
  {
    key: 'breathe',
    name: 'Breathing Reset',
    minutes: 5,
    notes: 'Box breathing 4-4-4-4, lying down. Switch off.',
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
  if (def.category === 'recovery') {
    return buildRecoveryTemplateWorkout(def, date);
  }
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

/** Recovery templates carry real multi-row content (the flow's steps) so
 *  the session screen renders them with the recovery treatment
 *  (workoutType 'Recovery' + sessionTier 'recovery'). Same registry
 *  guarantees: fixed content, template-owned row ids, byte-exact
 *  round-trip through the shared projection. */
function buildRecoveryTemplateWorkout(
  def: CoachRevisionTemplateDefinition,
  date: string,
): Workout {
  const workoutId = `template-${def.templateId}`;
  return {
    id: workoutId,
    microcycleId: 'coach-template',
    dayOfWeek: isoDateToDayOfWeek(date),
    name: def.label,
    description: def.description,
    durationMinutes: def.durationMinutes,
    intensity: 'Light',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    hasCombinedConditioning: false,
    exercises: RECOVERY_FLOW_ROWS.map((row, index) => {
      const rowId = `template:${def.templateId}:${row.key}`;
      return {
        id: rowId,
        workoutId,
        exerciseId: rowId,
        exerciseOrder: index,
        prescribedSets: 1,
        prescribedRepsMin: row.minutes,
        prescribedRepsMax: row.minutes,
        restSeconds: 0,
        notes: row.notes,
        exercise: {
          id: rowId,
          name: row.name,
          description: row.notes,
          exerciseType: 'Flexibility',
          muscleGroups: [],
          equipmentRequired: [],
          difficultyLevel: 'Beginner',
          createdAt: '',
          updatedAt: '',
        },
        createdAt: '',
        updatedAt: '',
      } as any;
    }),
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

/** Extract the template id when a SINGLE section is registry-owned (all
 *  item ids `template:<id>:…`). Used by the writer's mixed-day path:
 *  stacking a template section onto a day that keeps its own content. */
export function templateIdFromSection(
  section: { items: Array<{ id: string }> } | null | undefined,
): string | null {
  if (!section || section.items.length === 0) return null;
  const match = /^template:([a-z0-9_]+):/.exec(section.items[0].id);
  if (!match) return null;
  const templateId = match[1];
  if (!definitionById(templateId)) return null;
  const allOwned = section.items.every((item) =>
    item.id.startsWith(`template:${templateId}:`));
  return allOwned ? templateId : null;
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
