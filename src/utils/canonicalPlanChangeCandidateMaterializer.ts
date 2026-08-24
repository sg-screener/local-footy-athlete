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
  /**
   * Transform the registry template BEFORE it is stacked or swapped in.
   *
   * The G-1 landing ask is the only caller: when the athlete has answered
   * "accessories only" or "deloaded", it is the content they are ADDING that
   * changes, never the session already on the day. Transforming the stacked
   * result instead would strip or deload rows the athlete never touched.
   */
  transformTemplate?: (template: Workout) => Workout;
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
    recoveryAddons: undefined,
    exercises: [],
  } as Workout;
}

/**
 * Stack a session onto a day that carries a team-training anchor, keeping the
 * anchor where it is.
 *
 * Sam's doubling law (2026-07-30): a session moved onto a team night lands as a
 * COMBINED day — the same shape generation produces, and the same shape a swap
 * already builds when it replaces the gym half of a team day. The move door had
 * no way to say that, so it replaced the day and took the anchor with it.
 */
export function stackSessionOntoTeamAnchor(args: {
  anchorDay: Workout;
  addition: Workout;
}): Workout {
  return stackTemplate({
    base: teamTrainingAnchorContainer(args.anchorDay),
    template: args.addition,
    preservesTeamTraining: true,
  });
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

/**
 * The day's own name and the added session's, joined once. A name that already
 * contains the other is left alone rather than repeating it — re-adding to an
 * already-combined day must not produce "A + B + B".
 */
function joinStackedNames(base: string, added: string): string {
  const trimmedBase = base.trim();
  const trimmedAdded = added.trim();
  if (!trimmedBase) return trimmedAdded;
  if (!trimmedAdded) return trimmedBase;
  if (trimmedBase === trimmedAdded) return trimmedBase;
  const parts = trimmedBase.split(' + ').map((part) => part.trim());
  if (parts.includes(trimmedAdded)) return trimmedBase;
  return `${trimmedBase} + ${trimmedAdded}`;
}

function stackTemplate(args: {
  base: Workout;
  template: Workout;
  preservesTeamTraining: boolean;
}): Workout {
  const baseIsTeamTrainingOnly = getTeamTrainingWorkoutState(args.base).isTeamTrainingOnly;
  const templateComposedKind = args.template.composedOptionalKind ??
    (args.template.workoutType === 'Recovery' ? 'recovery' : undefined);
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
  // THE TITLE NAMES BOTH (Sam, 2026-07-30). A stack is two things on one day,
  // and naming one of them is how an added optional session made the recovery
  // it sat on top of disappear from the card. The team anchor has always used
  // this join; nothing about it was specific to team training.
  const name = args.preservesTeamTraining
    ? `Team Training + ${args.template.name}`
    : joinStackedNames(args.base.name, args.template.name);

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
    // CONDITIONING IDENTITY TRAVELS WITH CONDITIONING CONTENT, OR NOT AT ALL.
    //
    // These two fell back to the BASE when no side of the stack carried
    // conditioning — so a day that ended up with no conditioning block still
    // announced a conditioning role and typed conditioning evidence. Harmless
    // while the §18 role was a stamp nobody derived from; not harmless now that
    // the one owner reads typed evidence as the statement that conditioning is
    // PRESENT (Sam's ruling 1, 2026-08-06). A stale statement would hand the
    // day a core slot for work it does not contain.
    //
    // The site still decides nothing: it carries the owner's declaration when
    // there is an owner, and says `none` when there is none.
    section18Evidence: conditioningOwner?.section18Evidence ?? {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    section18ConditioningRole: conditioningOwner?.section18ConditioningRole ?? 'none',
    strengthIntent: strengthOwner?.strengthIntent,
    strengthIntentDiagnostics: strengthOwner?.strengthIntentDiagnostics,
    strengthPatternContributions: strengthOwner?.strengthPatternContributions,
    recoveryAddons: [
      ...(args.base.recoveryAddons ?? []),
      ...(args.template.recoveryAddons ?? []),
    ],
    // A GENUINELY MIXED GYM DAY IS NOT A COMPOSED OPTIONAL SESSION
    // (2026-08-01). The
    // marker means "this workout IS one composed Gunshow/Accessories/Mobility
    // session"; spreading the base carried it onto combined days, where the
    // projection then named an added conditioning part with the optional
    // word's claim standing beside it (deep walker, L-P6, seeds 1 and 3 —
    // a typed mobility day + conditioning add rendered no "Mobility" at all).
    // The parts of a combined GYM day name themselves by content; the marker
    // dies with the purity it describes.
    //
    // TEAM TRAINING IS AN ANCHOR, NOT ANOTHER GYM SESSION. A composed session
    // placed on a team-training-only day is still wholly Recovery, Mobility,
    // Gunshow, Accessories or Primer work beside that anchor. Clearing its
    // typed identity made every one of those additions fall through to the
    // generic Strength bucket (and could hide Gunshow entirely). Preserve the
    // builder's identity only for that exact shape. Recovery carries its
    // identity in workoutType while standalone, so the stack promotes that
    // existing typed fact into the same marker rather than inferring from its
    // name or rows.
    composedOptionalKind:
      args.preservesTeamTraining && baseIsTeamTrainingOnly
        ? templateComposedKind
        : undefined,
    derivedSessionProvenance: undefined,
  } as Workout;
}

function rawCandidate(
  change: TemplatePlanChange,
  source: Workout | null,
  transformTemplate?: (template: Workout) => Workout,
): CanonicalPlanChangeCandidateResult | Workout {
  const built = buildCoachRevisionTemplateWorkout(change.templateId, change.date);
  if (!built) {
    return {
      ok: false,
      code: 'unknown_template',
      reason: `Unknown plan-change template ${change.templateId}.`,
    };
  }
  const template = transformTemplate ? transformTemplate(built) : built;
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
  const raw = rawCandidate(
    input.change,
    input.currentDay.workout ?? null,
    input.transformTemplate,
  );
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
    todayISO: input.todayISO,
  }).day;

  return {
    ok: true,
    rawWorkout,
    workout,
    projectedDay: snapshotProjectedDay(projected),
  };
}
