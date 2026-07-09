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
import {
  buildCoachRevisionTemplateWorkout,
  templateIdFromRevisedWorkout,
  templateIdFromSection,
} from './coachRevisionTemplates';
import { logWeekValidation } from '../rules/weekStructureValidator';

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
  const built: CoachRevisionOverrideWrite[] = [];
  const rejected: CoachRevisionOverrideRejection[] = [];

  // Phase 1 — build and verify EVERY day purely, no writes. Multi-day
  // proposals (moves) must be atomic: a partial move that empties the source
  // without populating the destination silently loses training content.
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

    // A day gaining a DIFFERENT workout can only happen via a conserved
    // move or swap — the content's donor is the visible day that currently
    // holds it. Covers both the rest-day destination (move) and an
    // occupied destination exchanging content (swap, sheet v2).
    const donorWorkout =
      revised.workout && beforeDay.workout?.id !== revised.workout.id
        ? findDonorWorkout(input.visibleWeek, revised.workout.id)
        : null;

    const builtDay = buildWorkoutOverrideFromRevision({
      beforeDay,
      revisedDay: revised,
      todayISO: input.todayISO,
      donorWorkout,
    });
    if (builtDay.ok === false) {
      rejected.push({
        date: revised.date,
        code: builtDay.code,
        reason: builtDay.reason,
      });
      continue;
    }

    built.push({
      date: revised.date,
      workout: builtDay.workout,
      context: {
        intent: 'program_adjustment',
        label: `coach_revision:${input.proposal.userIntent.intent}:${input.proposal.userIntent.targetDomain}`,
      },
      projectedDay: builtDay.projectedDay,
    });
  }

  // Phase 2 — all-or-nothing. Any rejection means NOTHING is written.
  if (rejected.length > 0) {
    return { applied: [], rejected };
  }
  for (const write of built) {
    input.setManualOverride?.(write.date, write.workout, write.context);
  }

  // Phase 2 rules kernel — LOG-ONLY weekly-structure validation of the
  // post-apply visible week (both coach-chat and tap-sheet doors funnel
  // through this writer). logWeekValidation is throw-proof and has no
  // side effects; it cannot change or block this result.
  if (built.length > 0) {
    const overrideByDate = new Map(built.map((w) => [w.date, w.workout]));
    logWeekValidation(
      {
        days: input.visibleWeek.map((day) => ({
          date: day.date,
          workouts: [overrideByDate.get(day.date) ?? day.workout],
        })),
      },
      'coach_revision_apply',
    );
  }

  return { applied: built, rejected: [] };
}

function isoDateToDayOfWeek(date: string): number | null {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // App convention: 1 = Monday … 7 = Sunday.
  return ((parsed.getUTCDay() + 6) % 7) + 1;
}

function findDonorWorkout(days: ResolvedDay[], workoutId: string): Workout | null {
  for (const day of days) {
    const candidate = day.workout;
    if (candidate && String((candidate as any).id ?? '').trim() === workoutId) {
      return candidate;
    }
  }
  return null;
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
  /** Move support: when a rest day gains a workout, the content's current
   *  holder elsewhere in the visible week supplies the rows. */
  donorWorkout?: Workout | null;
}): BuildWorkoutOverrideFromRevisionResult {
  const source = args.beforeDay.workout ?? null;
  if (!source && !args.revisedDay.workout) {
    return {
      ok: false,
      code: 'no_visible_change',
      reason: 'Both source and revised day are rest days.',
    };
  }

  // Template replacements: the revised day is a pure registry session, so the
  // registry (not the source rows) materializes the workout — round-trip is
  // guaranteed because the advertised snapshot was derived from this exact
  // builder.
  const templateId = templateIdFromRevisedWorkout(args.revisedDay.workout ?? null);

  if (!source && args.revisedDay.workout && !args.donorWorkout && !templateId) {
    return {
      ok: false,
      code: 'add_workout_not_supported',
      reason: 'New content can only arrive via a conserved move or an approved template.',
    };
  }

  // Mixed template stack (sheet v2 add-on-top): the revised day keeps its
  // OWN sections and gains registry-owned section(s). Materialize the own
  // half from source rows and the template half from the registry, then
  // merge. Only reached when the day isn't a pure template replacement.
  const mixedStack =
    !templateId && source && args.revisedDay.workout
      ? partitionRevisedSections(args.revisedDay.workout)
      : null;

  // Donor takes precedence over the day's own source rows: when a swap
  // hands this day the OTHER day's workout, the rows must come from the
  // donor — building from the local source would materialize the wrong
  // session under the new title.
  let workout = templateId
    ? buildCoachRevisionTemplateWorkout(templateId, args.revisedDay.date)
    : mixedStack && mixedStack.templateIds.length > 0 && mixedStack.ownSections.length > 0
    ? buildStackedTemplateOverride(source!, args.revisedDay, mixedStack)
    : args.donorWorkout && args.revisedDay.workout
    ? buildContentOverride(args.donorWorkout, args.revisedDay)
    : source
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

  // The override belongs to the destination date regardless of where the
  // rows came from.
  workout = { ...workout, dayOfWeek: isoDateToDayOfWeek(args.revisedDay.date) ?? workout.dayOfWeek };

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
  const match = visibleDayMatchesAcceptedRevision(projectedDay, args.revisedDay);
  if (match.ok === false) {
    return {
      ok: false,
      code: 'projected_override_mismatch',
      reason: `The built override does not project back to the accepted visible revision. ${match.detail}`,
    };
  }

  return { ok: true, workout, projectedDay };
}

/** Split a revised workout's sections into registry-owned template
 *  sections (with their template ids) and the day's own sections. */
function partitionRevisedSections(
  revisedWorkout: NonNullable<CoachVisibleDaySnapshot['workout']>,
): {
  templateIds: string[];
  templateSections: CoachVisibleSectionSnapshot[];
  ownSections: CoachVisibleSectionSnapshot[];
} {
  const templateIds: string[] = [];
  const templateSections: CoachVisibleSectionSnapshot[] = [];
  const ownSections: CoachVisibleSectionSnapshot[] = [];
  for (const section of revisedWorkout.sections) {
    const sectionTemplateId = templateIdFromSection(section);
    if (sectionTemplateId) {
      templateIds.push(sectionTemplateId);
      templateSections.push(section);
    } else {
      ownSections.push(section);
    }
  }
  return { templateIds, templateSections, ownSections };
}

/**
 * Add-on-top materialization: base workout from the day's own surviving
 * sections (source rows), template rows appended from the registry. The
 * template's conditioning block rides along so the day renders as a real
 * combined S+C day — same structures generation produces.
 */
function buildStackedTemplateOverride(
  source: Workout,
  revisedDay: CoachVisibleDaySnapshot,
  stack: ReturnType<typeof partitionRevisedSections>,
): Workout | null {
  const base = buildContentOverride(source, {
    ...revisedDay,
    workout: {
      ...revisedDay.workout!,
      sections: stack.ownSections,
    },
  });
  if (!base) return null;

  let exercises = [...(base.exercises ?? [])];
  let conditioningBlock = base.conditioningBlock;
  let durationMinutes = base.durationMinutes ?? 0;
  for (const stackedTemplateId of stack.templateIds) {
    const templateWorkout = buildCoachRevisionTemplateWorkout(
      stackedTemplateId,
      revisedDay.date,
    );
    if (!templateWorkout) return null;
    exercises = [...exercises, ...(templateWorkout.exercises ?? [])];
    if (templateWorkout.conditioningBlock && !conditioningBlock) {
      conditioningBlock = templateWorkout.conditioningBlock;
    }
    durationMinutes += templateWorkout.durationMinutes ?? 0;
  }

  const templateTitle = stack.templateSections[0]?.title ?? null;
  const baseIsTeamTrainingOnly =
    String(base.workoutType ?? '').toLowerCase() === 'team training' &&
    /^team training$/i.test(String(base.name ?? '').trim());
  const nextName =
    baseIsTeamTrainingOnly && templateTitle
      ? `Team Training + ${templateTitle}`
      : base.name;

  return cloneWorkout(base, {
    name: nextName,
    exercises,
    durationMinutes,
    hasCombinedConditioning: !!conditioningBlock,
    conditioningFlavour: conditioningBlock
      ? base.conditioningFlavour ?? 'aerobic'
      : base.conditioningFlavour,
    conditioningCategory: conditioningBlock
      ? base.conditioningCategory ?? 'aerobic_base'
      : base.conditioningCategory,
    conditioningBlock,
  });
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
  const onlyStrength = hasStrength && !hasConditioning && !hasRecovery && !hasSession;
  // Session-only survivor (e.g. "drop the lifting, keep team training"): the
  // remaining commitment defines the day. Name from the kept session item so
  // the pure-day projection (session item title = workout name) round-trips
  // to the accepted revision's contract.
  const onlySession = hasSession && !hasStrength && !hasConditioning && !hasRecovery;
  const title = onlySession
    ? (session?.items[0]?.title || revisedWorkout.title || source.name)
    : (revisedWorkout.title || source.name);
  const workoutType = onlySession
    ? 'Team Training'
    : onlyConditioning
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

/**
 * Contract view of a visible day: the fields the athlete's approved change
 * actually concerns — which items exist (identity), where they live (section
 * kind / domain), and their prescriptions. App-DERIVED presentation fields
 * (descriptions, durations, titles, item ordering, section ids) are excluded
 * on purpose: the projection recomputes those after an edit, and byte-equality
 * against the LLM's echo would force the model to predict every derived
 * field — a structural false-rejection source. Safety is unaffected:
 * removals, reductions, and protected items are all identity+prescription
 * facts, and all remain in the contract.
 */
function revisionContractView(day: CoachVisibleDaySnapshot): unknown {
  if (!day.workout) return { date: day.date, workout: null };
  const sections = day.workout.sections
    .map((section) => ({
      kind: section.kind,
      items: [...section.items]
        .map((item) => ({
          id: item.id,
          title: item.title,
          domain: item.domain,
          sets: item.prescription?.sets ?? null,
          repsMin: item.prescription?.repsMin ?? null,
          repsMax: item.prescription?.repsMax ?? null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) =>
      a.kind === b.kind
        ? (a.items[0]?.id ?? '').localeCompare(b.items[0]?.id ?? '')
        : a.kind.localeCompare(b.kind),
    );
  return { date: day.date, workout: { sections } };
}

function visibleDayMatchesAcceptedRevision(
  projected: CoachVisibleDaySnapshot,
  accepted: CoachVisibleDaySnapshot,
): { ok: true } | { ok: false; detail: string } {
  const projectedJson = JSON.stringify(revisionContractView(projected));
  const acceptedJson = JSON.stringify(revisionContractView(accepted));
  if (projectedJson === acceptedJson) return { ok: true };
  let divergeAt = 0;
  const max = Math.min(projectedJson.length, acceptedJson.length);
  while (
    divergeAt < max &&
    projectedJson[divergeAt] === acceptedJson[divergeAt]
  ) divergeAt++;
  const from = Math.max(0, divergeAt - 60);
  return {
    ok: false,
    detail:
      `Contract divergence at ${divergeAt}: ` +
      `accepted "…${acceptedJson.slice(from, divergeAt + 120)}" ` +
      `vs projected "…${projectedJson.slice(from, divergeAt + 120)}".`,
  };
}
