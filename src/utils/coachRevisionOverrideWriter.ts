import type { OverrideContext, Workout } from '../types/domain';
import {
  snapshotProjectedDay,
  validateCoachRevisionDiff,
  type CoachRevisionProposal,
  type CoachRevisionValidationPolicy,
  type CoachVisibleDaySnapshot,
  type CoachVisibleItemSnapshot,
  type CoachVisibleSectionSnapshot,
} from './coachRevisionProposal';
import { projectVisibleDay } from './visibleProgramProjection';
import type { ResolvedDay } from './sessionResolver';

export interface CoachRevisionOverrideWrite {
  date: string;
  workout: Workout;
  context: OverrideContext;
  projectedDay: CoachVisibleDaySnapshot;
}

export interface CoachRevisionOverrideRejection {
  date?: string;
  code: string;
  reason: string;
}

export interface ApplyCoachRevisionOverridesResult {
  applied: CoachRevisionOverrideWrite[];
  rejected: CoachRevisionOverrideRejection[];
}

export interface ApplyCoachRevisionOverridesInput {
  proposal: CoachRevisionProposal;
  visibleWeek: ResolvedDay[];
  todayISO: string;
  validationPolicy?: CoachRevisionValidationPolicy;
  setManualOverride?: (
    date: string,
    workout: Workout,
    context?: OverrideContext,
  ) => void;
}

export function applyCoachRevisionDateOverrides(
  input: ApplyCoachRevisionOverridesInput,
): ApplyCoachRevisionOverridesResult {
  if (input.proposal.kind !== 'revision') {
    return {
      applied: [],
      rejected: [{
        code: 'proposal_not_revision',
        reason: 'Only validated revision proposals can write date overrides.',
      }],
    };
  }

  const beforeSnapshot = {
    schemaVersion: input.proposal.schemaVersion,
    days: input.visibleWeek.map(snapshotProjectedDay),
  };
  const validation = validateCoachRevisionDiff({
    before: beforeSnapshot,
    proposal: input.proposal,
    policy: input.validationPolicy,
  });
  if (validation.status !== 'valid') {
    return {
      applied: [],
      rejected: validation.issues.map((issue) => ({
        date: issue.date,
        code: issue.code,
        reason: issue.message,
      })),
    };
  }

  const daysByDate = new Map(input.visibleWeek.map((day) => [day.date, day]));
  const applied: CoachRevisionOverrideWrite[] = [];
  const rejected: CoachRevisionOverrideRejection[] = [];

  for (const revised of input.proposal.revisedDays) {
    if (!validation.diff.changedDates.includes(revised.date)) continue;
    const beforeDay = daysByDate.get(revised.date);
    if (!beforeDay) {
      rejected.push({
        date: revised.date,
        code: 'source_day_missing',
        reason: `No visible source day found for ${revised.date}.`,
      });
      continue;
    }

    const built = buildWorkoutOverrideFromRevision({
      beforeDay,
      revisedDay: revised,
      todayISO: input.todayISO,
    });
    if (!built.ok) {
      rejected.push({
        date: revised.date,
        code: built.code,
        reason: built.reason,
      });
      continue;
    }

    const context: OverrideContext = {
      intent: 'program_adjustment',
      label: `coach_revision:${input.proposal.userIntent.intent}:${input.proposal.userIntent.targetDomain}`,
    };
    input.setManualOverride?.(revised.date, built.workout, context);
    applied.push({
      date: revised.date,
      workout: built.workout,
      context,
      projectedDay: built.projectedDay,
    });
  }

  return { applied, rejected };
}

export type BuildWorkoutOverrideFromRevisionResult =
  | {
      ok: true;
      workout: Workout;
      projectedDay: CoachVisibleDaySnapshot;
    }
  | {
      ok: false;
      code: string;
      reason: string;
    };

export function buildWorkoutOverrideFromRevision(args: {
  beforeDay: ResolvedDay;
  revisedDay: CoachVisibleDaySnapshot;
  todayISO: string;
}): BuildWorkoutOverrideFromRevisionResult {
  const source = args.beforeDay.workout ?? null;
  if (!source && !args.revisedDay.workout) {
    return {
      ok: false,
      code: 'no_visible_change',
      reason: 'Both source and revised day are rest days.',
    };
  }

  if (!source && args.revisedDay.workout) {
    return {
      ok: false,
      code: 'add_workout_not_supported',
      reason: 'Stage 4A-3 does not create new workouts from visible proposals yet.',
    };
  }

  const workout = source
    ? args.revisedDay.workout
      ? buildContentOverride(source, args.revisedDay)
      : buildRestOverride(source)
    : null;

  if (!workout) {
    return {
      ok: false,
      code: 'override_build_failed',
      reason: 'Could not build a date override workout.',
    };
  }

  const projected = projectVisibleDay({
    day: {
      ...args.beforeDay,
      workout,
      source: 'manual' as any,
    },
    activeInjury: null,
    todayISO: args.todayISO,
  }).day;
  const projectedDay = snapshotProjectedDay(projected);
  if (!visibleDayMatchesAcceptedRevision(projectedDay, args.revisedDay)) {
    return {
      ok: false,
      code: 'projected_override_mismatch',
      reason: 'The built override does not project back to the accepted visible revision.',
    };
  }

  return { ok: true, workout, projectedDay };
}

function buildContentOverride(source: Workout, revisedDay: CoachVisibleDaySnapshot): Workout {
  const revisedWorkout = revisedDay.workout!;
  const strength = revisedWorkout.sections.find((section) => section.kind === 'strength');
  const conditioning = revisedWorkout.sections.find((section) => section.kind === 'conditioning');
  const recovery = revisedWorkout.sections.find((section) => section.kind === 'recovery');
  const session = revisedWorkout.sections.find((section) => section.kind === 'session');

  const hasStrength = !!strength;
  const hasConditioning = !!conditioning;
  const hasRecovery = !!recovery;
  const hasSession = !!session;
  const wantedExerciseIds = new Set(
    revisedWorkout.sections.flatMap((section) =>
      section.items.flatMap((item) => item.exerciseIds),
    ),
  );
  const strengthItemsByExerciseId = itemByExerciseId(strength?.items ?? []);
  const conditioningExerciseIds = sourceConditioningExerciseIds(source);

  let exercises = (source.exercises ?? [])
    .filter((row: any) => {
      const ids = rowIds(row);
      const isConditioning = ids.some((id) => conditioningExerciseIds.has(id));
      if (isConditioning && !hasConditioning && !hasRecovery) return false;
      if (!isConditioning && !hasStrength) return false;
      if (wantedExerciseIds.size === 0) return true;
      if (isConditioning) return ids.some((id) => wantedExerciseIds.has(id));
      return ids.some((id) => wantedExerciseIds.has(id));
    })
    .map((row: any) => applyRevisedPrescription(row, strengthItemsByExerciseId));

  const nextConditioningBlock = hasConditioning || hasRecovery
    ? filterConditioningBlock(source, conditioning ?? recovery, exercises)
    : undefined;
  if (nextConditioningBlock) {
    const linkedIds = new Set(
      nextConditioningBlock.options.flatMap((option) =>
        (option.exerciseIds ?? []).map((id: unknown) => String(id)),
      ),
    );
    exercises = exercises.filter((row: any) => {
      const ids = rowIds(row);
      const isConditioning = ids.some((id) => conditioningExerciseIds.has(id));
      if (!isConditioning) return true;
      return ids.some((id) => linkedIds.has(id));
    });
  }

  if (exercises.length === 0 && !nextConditioningBlock && !hasSession) {
    return buildRestOverride(source);
  }

  const onlyConditioning = !hasStrength && (hasConditioning || hasRecovery);
  const onlyStrength = hasStrength && !hasConditioning && !hasRecovery;
  const title = revisedWorkout.title || source.name;
  const workoutType = onlyConditioning
    ? 'Conditioning'
    : onlyStrength
    ? 'Strength'
    : hasRecovery
    ? 'Recovery'
    : revisedWorkout.workoutType || source.workoutType;

  return cloneWorkout(source, {
    name: title,
    workoutType: workoutType as any,
    description: onlyConditioning
      ? conditioning?.items[0]?.description ?? source.description
      : source.description,
    hasCombinedConditioning: hasStrength && !!nextConditioningBlock,
    conditioningFlavour: nextConditioningBlock
      ? source.conditioningFlavour ?? 'aerobic'
      : undefined,
    conditioningCategory: nextConditioningBlock
      ? source.conditioningCategory ?? 'aerobic_base'
      : undefined,
    conditioningBlock: nextConditioningBlock,
    coachAddedConditioningLabel: onlyConditioning
      ? title
      : nextConditioningBlock
      ? source.coachAddedConditioningLabel
      : undefined,
    exercises,
  });
}

function buildRestOverride(source: Workout): Workout {
  return cloneWorkout(source, {
    name: 'Rest',
    description: 'Coach revision removed the visible training content.',
    durationMinutes: 0,
    intensity: 'Light' as any,
    workoutType: 'Rest' as any,
    sessionTier: 'recovery',
    hasCombinedConditioning: false,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    conditioningBlock: undefined,
    coachAddedConditioningLabel: undefined,
    exercises: [],
  });
}

function filterConditioningBlock(
  source: Workout,
  section: CoachVisibleSectionSnapshot | undefined,
  exercises: Workout['exercises'],
): Workout['conditioningBlock'] {
  if (!section || !source.conditioningBlock?.options?.length) return undefined;
  const sectionExerciseIds = new Set(
    section.items.flatMap((item) => item.exerciseIds),
  );
  const exerciseIds = new Set(
    exercises.flatMap((row: any) => rowIds(row)),
  );
  const options = source.conditioningBlock.options.filter((option: any) =>
    (option.exerciseIds ?? []).some((id: unknown) =>
      sectionExerciseIds.has(String(id)) &&
      exerciseIds.has(String(id)),
    ),
  );
  if (options.length === 0) return undefined;
  return { ...source.conditioningBlock, options };
}

function applyRevisedPrescription(
  row: any,
  byExerciseId: Map<string, CoachVisibleItemSnapshot>,
): any {
  const match = rowIds(row).map((id) => byExerciseId.get(id)).find(Boolean);
  if (!match?.prescription) return row;
  const rx = match.prescription;
  return {
    ...row,
    prescribedSets: rx.sets ?? row.prescribedSets,
    prescribedRepsMin: rx.repsMin ?? row.prescribedRepsMin,
    prescribedRepsMax: rx.repsMax ?? row.prescribedRepsMax,
  };
}

function itemByExerciseId(
  items: CoachVisibleItemSnapshot[],
): Map<string, CoachVisibleItemSnapshot> {
  const out = new Map<string, CoachVisibleItemSnapshot>();
  for (const item of items) {
    for (const id of item.exerciseIds) out.set(id, item);
  }
  return out;
}

function sourceConditioningExerciseIds(workout: Workout): Set<string> {
  const ids = new Set<string>();
  for (const option of workout.conditioningBlock?.options ?? []) {
    for (const id of option.exerciseIds ?? []) ids.add(String(id));
  }
  return ids;
}

function rowIds(row: any): string[] {
  return [
    row?.id,
    row?.exerciseId,
    row?.exercise?.id,
  ].map((value) => String(value ?? '').trim()).filter(Boolean);
}

function cloneWorkout(workout: Workout, overrides: Partial<Workout>): Workout {
  return {
    ...workout,
    exercises: (overrides.exercises ?? workout.exercises ?? []).map((row: any) => ({
      ...row,
      exercise: row.exercise ? { ...row.exercise } : row.exercise,
    })),
    coachNotes: overrides.coachNotes ?? (
      workout.coachNotes ? [...workout.coachNotes] : undefined
    ),
    ...overrides,
    updatedAt: new Date().toISOString(),
  };
}

function visibleDayMatchesAcceptedRevision(
  projected: CoachVisibleDaySnapshot,
  accepted: CoachVisibleDaySnapshot,
): boolean {
  return JSON.stringify(projected) === JSON.stringify(accepted);
}
