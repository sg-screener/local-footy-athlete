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
   *  'work_capacity' = harder off-legs conditioning (advisory game-week
   *  warning since 2026-07-04's athlete-override principle).
   *  'recovery' = restorative flow (tissue quality / mobility / breathing).
   *  'strength' / 'accessories' = ENGINE-GENERATED via buildTagAwareSession
   *  / buildDerivedSession — the same principles as weekly programming
   *  (tag scoring, game proximity, injury filters). Sheet v2 phase 4. */
  category: 'flush' | 'work_capacity' | 'recovery' | 'strength' | 'accessories';
  byeOnly: boolean;
  durationMinutes: number;
  /** True when the built content varies by DATE (engine-generated) — the
   *  validation policy must compute per-date signatures for these. */
  dynamic?: boolean;
  /** Engine name handed to buildTagAwareSession's intent builder
   *  (strength category only). */
  engineName?: string;
  /** Derived-session type for buildDerivedSession (accessories only). */
  derivedType?: 'arms_pump' | 'prehab_accessories';
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
    description: '3 x 8min zone 2 row, 2min easy between blocks',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 28,
  },
  {
    templateId: 'easy_zone2_ski',
    label: 'Easy Zone 2 Ski Erg',
    description: '3 x 8min zone 2 SkiErg, 2min easy between blocks',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 28,
  },
  {
    templateId: 'flushout_3030',
    label: 'Flush Out - 30:30 Intervals',
    description:
      '24min: 30s easy effort / 30s off, rotating bike, row or ski. Rejuvenation only - nothing hard.',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 24,
  },
  {
    templateId: 'flushout_1on_1off',
    label: 'Flush Out - 1min On / 1min Off',
    description:
      '24min: 1min easy effort / 1min off on any erg. Keep every rep genuinely easy - this is a flush, not fitness.',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 24,
  },
  {
    templateId: 'flushout_2on_1off',
    label: 'Flush Out - 2min On / 1min Off',
    description:
      '24min: 2min easy effort / 1min off on any erg. Steady and restorative, RPE 4-5 max.',
    category: 'flush',
    byeOnly: false,
    durationMinutes: 24,
  },
  // ── Work capacity: harder off-legs conditioning, bye weeks only ──
  {
    templateId: 'erg_emom',
    label: 'Erg EMOM - 10-15 cal',
    description:
      '24min EMOM: every minute on the minute, 10-15 cal effort, rest the remainder of the minute. Rotate bike, ski, row and assault bike each round.',
    category: 'work_capacity',
    byeOnly: true,
    durationMinutes: 24,
  },
  {
    templateId: 'metcon_offlegs',
    label: 'MetCon - Off-Legs',
    description:
      '28min: 4 stations x 7 rounds - hard erg efforts (bike/row/ski/assault), carries and burpees. Vary work:rest from 1:2 up to 3:1. Mostly off legs.',
    category: 'work_capacity',
    byeOnly: true,
    durationMinutes: 28,
  },
  // ── Recovery: restore, never load ──
  {
    templateId: 'recovery_flow',
    label: 'Recovery Flow',
    description:
      '30min restorative: foam rolling, hip & ankle mobility, easy spin, breathing reset. Restore - never load.',
    category: 'recovery',
    byeOnly: false,
    durationMinutes: 30,
  },
  // ── Strength: engine-generated with the weekly-programming principles ──
  {
    templateId: 'strength_upper_push',
    label: 'Upper Push',
    description: 'Pressing strength - chest, shoulders and triceps.',
    category: 'strength',
    byeOnly: false,
    durationMinutes: 60,
    dynamic: true,
    engineName: 'Upper Push',
  },
  {
    templateId: 'strength_upper_pull',
    label: 'Upper Pull',
    description: 'Pulling strength - back and biceps.',
    category: 'strength',
    byeOnly: false,
    durationMinutes: 60,
    dynamic: true,
    engineName: 'Upper Pull',
  },
  {
    templateId: 'strength_lower',
    label: 'Lower Body Strength',
    description: 'Squat and hinge strength - legs and glutes.',
    category: 'strength',
    byeOnly: false,
    durationMinutes: 60,
    dynamic: true,
    engineName: 'Lower Body Strength',
  },
  {
    templateId: 'strength_full_body',
    label: 'Full Body Strength',
    description: 'Compound push, pull, squat and carry.',
    category: 'strength',
    byeOnly: false,
    durationMinutes: 60,
    dynamic: true,
    engineName: 'Full Body',
  },
  // ── Accessories: pump + prehab derived sessions ──
  {
    templateId: 'accessories_pump',
    label: 'Gunshow',
    description: 'Light upper-body pump work.',
    category: 'accessories',
    byeOnly: false,
    durationMinutes: 35,
    dynamic: true,
    derivedType: 'arms_pump',
  },
  {
    templateId: 'accessories_prehab',
    label: 'Prehab & Accessories',
    description: 'Small-muscle armour: groin, rotator cuff, trunk.',
    category: 'accessories',
    byeOnly: false,
    durationMinutes: 35,
    dynamic: true,
    derivedType: 'prehab_accessories',
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
    name: 'Foam Roll - Full Body',
    minutes: 8,
    notes: 'Quads, glutes, calves, upper back. Slow passes, keep breathing.',
  },
  {
    key: 'mobility',
    name: 'Mobility Flow - Hips & Ankles',
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

interface ConditioningTemplateRow {
  key: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes: string;
}

function conditioningRowsForTemplate(def: CoachRevisionTemplateDefinition): ConditioningTemplateRow[] {
  if (def.templateId === 'easy_zone2_row') {
    return [{
      key: 'main',
      name: '3 x 8min zone 2 Rower',
      sets: 3,
      repsMin: 8,
      repsMax: 8,
      restSeconds: 120,
      notes: '3 x 8min zone 2 on Rower. 2min easy between blocks. Smooth, conversational rhythm.',
    }];
  }
  if (def.templateId === 'easy_zone2_ski') {
    return [{
      key: 'main',
      name: '3 x 8min zone 2 SkiErg',
      sets: 3,
      repsMin: 8,
      repsMax: 8,
      restSeconds: 120,
      notes: '3 x 8min zone 2 on SkiErg. 2min easy between blocks. Relaxed rhythm, no grind.',
    }];
  }
  return [{
    key: 'main',
    name: def.label,
    sets: 1,
    repsMin: def.durationMinutes,
    repsMax: def.durationMinutes,
    restSeconds: 0,
    notes: def.description,
  }];
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
  if (def.category === 'strength' || def.category === 'accessories') {
    return buildEngineTemplateWorkout(def, date);
  }
  const rows = conditioningRowsForTemplate(def);
  const rowIds = rows.map((row) => `template:${def.templateId}:${row.key}`);
  return {
    id: `template-${def.templateId}`,
    microcycleId: 'coach-template',
    dayOfWeek: isoDateToDayOfWeek(date),
    name: def.label,
    description: def.description,
    durationMinutes: def.durationMinutes,
    intensity: def.category === 'work_capacity' ? 'High' : 'Light',
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    hasCombinedConditioning: false,
    conditioningFlavour: def.category === 'work_capacity' ? 'high-intensity' : 'aerobic',
    conditioningCategory: def.category === 'work_capacity' ? 'glycolytic' : 'aerobic_base',
    conditioningBlock: {
      intent: def.category === 'work_capacity' ? 'high-intensity' : 'aerobic',
      options: [{
        title: def.label,
        description: def.description,
        exerciseIds: rowIds,
      }],
    },
    exercises: rows.map((row, index) => {
      const rowId = rowIds[index];
      return {
        id: rowId,
        workoutId: `template-${def.templateId}`,
        exerciseId: rowId,
        exerciseOrder: index,
        prescribedSets: row.sets,
        prescribedRepsMin: row.repsMin,
        prescribedRepsMax: row.repsMax,
        restSeconds: row.restSeconds,
        notes: row.notes,
        exercise: {
          id: rowId,
          name: row.name,
          description: row.notes,
          exerciseType: 'Conditioning',
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

/**
 * Engine-generated templates (strength splits, accessory sessions): the
 * SAME machinery as weekly programming — buildTagAwareSession for splits
 * (tag scoring, game proximity, injury filters), buildDerivedSession for
 * accessory/pump days (pool slots, weekly caps, load estimates). Athlete
 * context + game dates arrive via coachRevisionTemplateContext (one seam,
 * injectable in tests). Deterministic per (templateId, date, context), so
 * the advertised snapshot, validation signature, and written workout all
 * agree by construction. Row ids are remapped to `template:<id>:<n>` so
 * the writer recognises registry ownership; exerciseId keeps the engine's
 * exercise identity (weight overrides, videos, history all keep working).
 */
function buildEngineTemplateWorkout(
  def: CoachRevisionTemplateDefinition,
  date: string,
): Workout | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    getCoachRevisionTemplateContext,
  } = require('./coachRevisionTemplateContext');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    buildTagAwareSession,
    buildDerivedSession,
  } = require('./sessionBuilder');
  const ctx = getCoachRevisionTemplateContext();

  let generated: Workout | null = null;
  if (def.category === 'strength' && def.engineName) {
    const synthetic: Workout = {
      id: `template-${def.templateId}`,
      microcycleId: 'coach-template',
      dayOfWeek: isoDateToDayOfWeek(date),
      name: def.engineName,
      description: def.description,
      durationMinutes: def.durationMinutes,
      intensity: 'Moderate',
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [],
      createdAt: '',
      updatedAt: '',
    } as Workout;
    generated = buildTagAwareSession(
      synthetic,
      date,
      ctx.gameDates,
      ctx.athlete,
      ctx.inSeason,
    );
  } else if (def.category === 'accessories' && def.derivedType) {
    generated = buildDerivedSession(
      def.derivedType,
      date,
      'coach-template',
      'Athlete-added session',
      ctx.athlete,
    );
  }
  if (!generated) return null;

  // Registry ownership: remap ROW ids to template:<id>:<n>. Exercise
  // identity (exerciseId / exercise.id) is untouched.
  const workoutId = `template-${def.templateId}`;
  const exercises = (generated.exercises ?? []).map((row: any, index: number) => ({
    ...row,
    id: `template:${def.templateId}:${index}`,
    workoutId,
  }));

  return {
    ...generated,
    id: workoutId,
    microcycleId: 'coach-template',
    dayOfWeek: isoDateToDayOfWeek(date),
    name: def.label,
    durationMinutes: def.durationMinutes,
    sessionTier: def.category === 'strength' ? 'core' : 'optional',
    hasCombinedConditioning: false,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    conditioningBlock: undefined,
    exercises,
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

/** True when a visible day looks like a game or practice-match day. Bye
 *  detection: a week whose visible days contain NO game day is a bye week,
 *  which unlocks the work-capacity templates. Detection is name/type based
 *  for now — the snapshot does not carry sessionTier (future improvement). */
export function visibleDayLooksLikeGame(day: {
  workout: { title?: string; workoutType?: string; name?: string } | null;
}): boolean {
  if (!day.workout) return false;
  const haystack = [
    day.workout.title ?? '',
    (day.workout as any).name ?? '',
    day.workout.workoutType ?? '',
  ].join(' ').toLowerCase();
  return /\bgame\b/.test(haystack) || /\bpractice[-\s]+match\b/.test(haystack);
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
