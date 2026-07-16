import type { Workout, WorkoutType } from '../types/domain';
import {
  snapshotProjectedDay,
  type CoachVisibleDaySnapshot,
} from './coachRevisionProposal';
import { buildCoachRevisionTemplateWorkout, visibleDayLooksLikeGame } from './coachRevisionTemplates';
import type { TemplatePlanChange } from './planChangeTypes';
import type { ResolvedDay } from './sessionResolver';
import { getTeamTrainingWorkoutState } from './teamTraining';
import { projectVisibleDay } from './visibleProgramProjection';

export interface CanonicalPlanChangeCandidateInput {
  change: TemplatePlanChange;
  currentDay: ResolvedDay;
  todayISO: string;
  /**
   * Safety and final workout canonicalisation is an explicit dependency so
   * candidate materialisation remains deterministic for a complete input.
   * Production passes validateLiveWorkoutWrite; phase tests can pass the
   * pure finaliseWorkoutAfterMutation boundary with an explicit context.
   */
  canonicalizeWorkout: (date: string, workout: Workout) => Workout;
}

export type CanonicalPlanChangeCandidateResult =
  | {
      ok: true;
      rawWorkout: Workout;
      workout: Workout;
      projectedDay: CoachVisibleDaySnapshot;
    }
  | {
      ok: false;
      code: string;
      reason: string;
    };

function isoDateToDayOfWeek(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`);
  return ((parsed.getUTCDay() + 6) % 7) + 1;
}

function cloneRows(rows: Workout['exercises'] | undefined): Workout['exercises'] {
  return (rows ?? []).map((row: any) => ({
    ...row,
    exercise: row.exercise ? { ...row.exercise } : row.exercise,
  }));
}

function hasConditioning(workout: Workout): boolean {
  return !!workout.conditioningBlock?.options?.length ||
    workout.workoutType === 'Conditioning' ||
    workout.workoutType === 'Flush-Out' ||
    workout.workoutType === 'MetCon';
}

function hasStrength(workout: Workout): boolean {
  return !!workout.strengthIntent ||
    !!workout.strengthPatternContributions?.length ||
    workout.workoutType === 'Strength' ||
    workout.workoutType === 'Mixed';
}

/**
 * Preserve the real-world Team Training container while removing the gym
 * component that the athlete asked to replace. Team Training is an anchor,
 * not a template row, so the source workout id remains its stable identity.
 */
function teamTrainingAnchorContainer(source: Workout): Workout {
  return {
    ...source,
    name: 'Team Training',
    workoutType: 'Team Training',
    durationMinutes: 0,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    conditioningBlock: undefined,
    coachAddedConditioningLabel: undefined,
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    section18ConditioningRole: 'none',
    strengthIntent: undefined,
    strengthIntentDiagnostics: undefined,
    strengthPatternContributions: undefined,
    powerBlock: undefined,
    recoveryAddons: undefined,
    exercises: [],
  } as Workout;
}

function combinedWorkoutType(args: {
  base: Workout;
  template: Workout;
  preservesTeamTraining: boolean;
}): WorkoutType {
  if (args.preservesTeamTraining) return 'Team Training';
  const strength = hasStrength(args.base) || hasStrength(args.template);
  const conditioning = hasConditioning(args.base) || hasConditioning(args.template);
  if (strength && conditioning) return 'Mixed';
  if (strength) return 'Strength';
  if (conditioning) return 'Conditioning';
  if (args.template.workoutType === 'Recovery') return 'Recovery';
  return args.base.workoutType;
}

function stackTemplate(args: {
  base: Workout;
  template: Workout;
  preservesTeamTraining: boolean;
}): Workout {
  const baseHasConditioning = hasConditioning(args.base);
  const templateHasConditioning = hasConditioning(args.template);
  const baseHasStrength = hasStrength(args.base);
  const templateHasStrength = hasStrength(args.template);
  const conditioningOwner = templateHasConditioning
    ? args.template
    : baseHasConditioning
    ? args.base
    : null;
  const strengthOwner = templateHasStrength
    ? args.template
    : baseHasStrength
    ? args.base
    : null;
  const name = args.preservesTeamTraining
    ? `Team Training + ${args.template.name}`
    : templateHasStrength && !baseHasStrength
    ? args.template.name
    : args.base.name;

  return {
    ...args.base,
    // Add-ons and anchor-preserving replacements retain the accepted source
    // container. Template identity stays on its rows and component metadata.
    id: args.base.id,
    name,
    workoutType: combinedWorkoutType(args),
    durationMinutes:
      Number(args.base.durationMinutes ?? 0) +
      Number(args.template.durationMinutes ?? 0),
    intensity: args.base.intensity ?? args.template.intensity,
    exercises: [
      ...cloneRows(args.base.exercises),
      ...cloneRows(args.template.exercises),
    ],
    hasCombinedConditioning: !!conditioningOwner && !!strengthOwner,
    conditioningBlock: conditioningOwner?.conditioningBlock,
    conditioningFlavour: conditioningOwner?.conditioningFlavour,
    conditioningCategory: conditioningOwner?.conditioningCategory,
    attachedConditioningKind: conditioningOwner?.attachedConditioningKind,
    coachAddedConditioningLabel: conditioningOwner?.coachAddedConditioningLabel,
    section18Evidence: conditioningOwner?.section18Evidence ?? args.base.section18Evidence,
    section18ConditioningRole:
      conditioningOwner?.section18ConditioningRole ?? args.base.section18ConditioningRole,
    strengthIntent: strengthOwner?.strengthIntent,
    strengthIntentDiagnostics: strengthOwner?.strengthIntentDiagnostics,
    strengthPatternContributions: strengthOwner?.strengthPatternContributions,
    powerBlock: strengthOwner?.powerBlock,
    recoveryAddons: [
      ...(args.base.recoveryAddons ?? []),
      ...(args.template.recoveryAddons ?? []),
    ],
    derivedSessionProvenance: undefined,
  } as Workout;
}

function rawCandidate(
  change: TemplatePlanChange,
  source: Workout | null,
): CanonicalPlanChangeCandidateResult | Workout {
  const template = buildCoachRevisionTemplateWorkout(change.templateId, change.date);
  if (!template) {
    return {
      ok: false,
      code: 'unknown_template',
      reason: `Unknown plan-change template ${change.templateId}.`,
    };
  }
  if (source && visibleDayLooksLikeGame({ workout: source })) {
    return {
      ok: false,
      code: 'protected_anchor_day',
      reason: 'Game Day and Practice Match are immutable plan anchors.',
    };
  }
  if (change.kind === 'add_template') {
    if (!source) return template;
    return stackTemplate({
      base: source,
      template,
      preservesTeamTraining: getTeamTrainingWorkoutState(source).hasTeamTraining,
    });
  }
  if (!source) {
    return {
      ok: false,
      code: 'nothing_to_swap',
      reason: `No accepted workout exists on ${change.date}.`,
    };
  }
  if (!getTeamTrainingWorkoutState(source).hasTeamTraining) return template;
  return stackTemplate({
    base: teamTrainingAnchorContainer(source),
    template,
    preservesTeamTraining: true,
  });
}

/**
 * CanonicalPlanChangeCandidateMaterializer
 *
 * Typed intent -> raw publishable workout -> safety canonicalisation ->
 * normal visible projection. Proposal production and override writing both
 * call this function, so neither predicts duration, identity, or ordering.
 */
export function materializeCanonicalPlanChangeCandidate(
  input: CanonicalPlanChangeCandidateInput,
): CanonicalPlanChangeCandidateResult {
  const raw = rawCandidate(input.change, input.currentDay.workout ?? null);
  if ('ok' in raw && raw.ok === false) return raw;

  const rawWorkout: Workout = {
    ...(raw as Workout),
    dayOfWeek: isoDateToDayOfWeek(input.change.date),
  };
  let workout: Workout;
  try {
    workout = input.canonicalizeWorkout(input.change.date, rawWorkout);
  } catch (error) {
    const typed = error as { code?: string; userMessage?: string };
    if (typed?.code === 'section18_week_rejected') {
      return {
        ok: false,
        code: typed.code,
        reason: typed.userMessage ??
          'We could not safely materialize this plan change in the accepted week.',
      };
    }
    throw error;
  }

  const projected = projectVisibleDay({
    day: {
      ...input.currentDay,
      workout,
      source: 'manual' as any,
    },
    activeInjury: null,
    todayISO: input.todayISO,
  }).day;

  return {
    ok: true,
    rawWorkout,
    workout,
    projectedDay: snapshotProjectedDay(projected),
  };
}
