import type { UserRemovalScope, Workout } from '../types/domain';
import type { ResolvedDay } from './sessionResolver';
import {
  snapshotProjectedDay,
  type CoachRevisionSectionKind,
  type CoachVisibleSectionSnapshot,
} from './coachRevisionProposal';
import { splitSessionName } from './sessionNaming';
import {
  getTeamTrainingWorkoutState,
  isTeamTrainingItem,
} from './teamTraining';
import { getExerciseTags } from '../data/exerciseTags';
import { resolveExerciseName } from './loadEstimation';

export type SessionComponentKind =
  | 'power'
  | 'strength'
  | 'support'
  | 'conditioning'
  | 'team_training'
  | 'speed'
  | 'finisher'
  | 'recovery_addon'
  | 'recovery'
  | 'session';

export type SessionComponentCompletionPolicy =
  | 'required'
  | 'optional_no_penalty';

export interface SessionComponent {
  id: SessionComponentKind;
  kind: SessionComponentKind;
  label: string;
  completionPolicy: SessionComponentCompletionPolicy;
}

export type AthleteSessionComponentReductionResult =
  | { ok: true; remainingWorkout: Workout | null }
  | { ok: false; code: 'nothing_to_remove' | 'scope_not_on_day' };

const REMOVAL_SECTION_KIND: Partial<Record<UserRemovalScope, CoachRevisionSectionKind>> = {
  strength_component: 'strength',
  conditioning_component: 'conditioning',
  recovery_component: 'recovery',
  team_component: 'session',
};

/**
 * Deterministic component-reduction owner for athlete session deletion.
 *
 * The accepted visible snapshot decides which concrete rows belong to the
 * requested component. This function only removes that typed component and
 * never canonicalises, repairs, authorises templates, or writes state. The
 * accepted-state transaction remains responsible for relocation, Section 18
 * repair, validation, provenance and atomic publication.
 */
export function reduceAcceptedSessionForAthleteRemoval(args: {
  day: ResolvedDay;
  scope: UserRemovalScope;
}): AthleteSessionComponentReductionResult {
  const source = args.day.workout;
  if (!source) return { ok: false, code: 'nothing_to_remove' };
  if (args.scope === 'whole_session') {
    return { ok: true, remainingWorkout: null };
  }

  const snapshot = snapshotProjectedDay(args.day);
  if (!snapshot.workout) return { ok: false, code: 'nothing_to_remove' };
  const removedKind = REMOVAL_SECTION_KIND[args.scope];
  if (!removedKind || !snapshot.workout.sections.some((section) =>
    section.kind === removedKind)) {
    return { ok: false, code: 'scope_not_on_day' };
  }
  const survivingSections = snapshot.workout.sections.filter((section) =>
    section.kind !== removedKind);
  if (survivingSections.length === 0) {
    return { ok: true, remainingWorkout: null };
  }

  const survivorTitle = survivingSections.some((section) => section.kind === 'strength')
    ? splitSessionName(snapshot.workout.title).title || snapshot.workout.title
    : survivingSections[0].title || snapshot.workout.title;
  const survivorWorkoutType =
    survivingSections.every((section) => section.kind === 'session')
      ? source.workoutType
      : survivingSections.some((section) => section.kind === 'strength')
      ? 'Strength'
      : survivingSections.some((section) => section.kind === 'conditioning')
      ? 'Conditioning'
      : 'Recovery';

  return {
    ok: true,
    remainingWorkout: materializeAcceptedVisibleSections({
      source,
      title: survivorTitle,
      workoutType: survivorWorkoutType,
      durationMinutes: snapshot.workout.durationMinutes,
      intensity: snapshot.workout.intensity,
      sections: survivingSections,
    }),
  };
}

function materializeAcceptedVisibleSections(args: {
  source: Workout;
  title: string;
  workoutType: string;
  durationMinutes?: number;
  intensity?: string;
  sections: CoachVisibleSectionSnapshot[];
}): Workout {
  const strength = args.sections.find((section) => section.kind === 'strength');
  const conditioning = args.sections.find((section) => section.kind === 'conditioning');
  const recovery = args.sections.find((section) => section.kind === 'recovery');
  const session = args.sections.find((section) => section.kind === 'session');
  const hasStrength = !!strength;
  const hasConditioning = !!conditioning;
  const hasRecovery = !!recovery;
  const hasSession = !!session;
  const wantedExerciseIds = new Set(args.sections.flatMap((section) =>
    section.items.flatMap((item) => item.exerciseIds)));
  const conditioningExerciseIds = sourceConditioningExerciseIds(args.source);

  let exercises = (args.source.exercises ?? []).filter((row: any) => {
    const ids = workoutRowIds(row);
    const isConditioning = ids.some((id) => conditioningExerciseIds.has(id));
    if (isConditioning && !hasConditioning && !hasRecovery) return false;
    if (!isConditioning && !hasStrength) return false;
    if (wantedExerciseIds.size === 0) return true;
    return ids.some((id) => wantedExerciseIds.has(id));
  });

  const nextConditioningBlock = hasConditioning || hasRecovery
    ? filterAcceptedConditioningBlock(args.source, conditioning ?? recovery, exercises)
    : undefined;
  if (nextConditioningBlock) {
    const linkedIds = new Set(nextConditioningBlock.options.flatMap((option) =>
      (option.exerciseIds ?? []).map((id: unknown) => String(id))));
    exercises = exercises.filter((row: any) => {
      const ids = workoutRowIds(row);
      const isConditioning = ids.some((id) => conditioningExerciseIds.has(id));
      return !isConditioning || ids.some((id) => linkedIds.has(id));
    });
  }

  const onlyConditioning = !hasStrength && (hasConditioning || hasRecovery);
  const onlyStrength = hasStrength && !hasConditioning && !hasRecovery && !hasSession;
  const onlySession = hasSession && !hasStrength && !hasConditioning && !hasRecovery;
  const title = onlySession
    ? session?.items[0]?.title || args.title || args.source.name
    : args.title || args.source.name;
  const workoutType = onlySession
    ? 'Team Training'
    : onlyConditioning
    ? 'Conditioning'
    : onlyStrength
    ? 'Strength'
    : hasRecovery
    ? 'Recovery'
    : args.workoutType || args.source.workoutType;

  return cloneWorkout(args.source, {
    name: title,
    workoutType: workoutType as Workout['workoutType'],
    durationMinutes: args.durationMinutes ?? args.source.durationMinutes,
    intensity: (args.intensity ?? args.source.intensity) as Workout['intensity'],
    description: onlyConditioning
      ? conditioning?.items[0]?.description ?? args.source.description
      : args.source.description,
    hasCombinedConditioning: hasStrength && !!nextConditioningBlock,
    attachedConditioningKind: nextConditioningBlock
      ? args.source.attachedConditioningKind
      : undefined,
    conditioningFlavour: nextConditioningBlock
      ? args.source.conditioningFlavour ?? 'aerobic'
      : undefined,
    conditioningCategory: nextConditioningBlock
      ? args.source.conditioningCategory ?? 'aerobic_base'
      : undefined,
    conditioningBlock: nextConditioningBlock,
    section18Evidence: nextConditioningBlock
      ? args.source.section18Evidence
      : {
          protocolVersion: 1,
          conditioningRole: 'none',
          conditioningStress: 'unknown',
          provenance: 'explicit_mutation',
        },
    section18ConditioningRole: nextConditioningBlock
      ? args.source.section18ConditioningRole
      : 'none',
    strengthIntent: hasStrength ? args.source.strengthIntent : undefined,
    strengthIntentDiagnostics: hasStrength
      ? args.source.strengthIntentDiagnostics
      : undefined,
    strengthPatternContributions: hasStrength
      ? args.source.strengthPatternContributions
      : undefined,
    powerBlock: hasStrength ? args.source.powerBlock : undefined,
    recoveryAddons: hasRecovery ? args.source.recoveryAddons : undefined,
    coachAddedConditioningLabel: onlyConditioning
      ? title
      : nextConditioningBlock
      ? args.source.coachAddedConditioningLabel
      : undefined,
    exercises,
  });
}

function filterAcceptedConditioningBlock(
  source: Workout,
  section: CoachVisibleSectionSnapshot | undefined,
  exercises: Workout['exercises'],
): Workout['conditioningBlock'] {
  if (!section || !source.conditioningBlock?.options?.length) return undefined;
  const sectionExerciseIds = new Set(section.items.flatMap((item) => item.exerciseIds));
  const exerciseIds = new Set(exercises.flatMap((row: any) => workoutRowIds(row)));
  const options = source.conditioningBlock.options.filter((option: any) =>
    (option.exerciseIds ?? []).some((id: unknown) =>
      sectionExerciseIds.has(String(id)) && exerciseIds.has(String(id))))
    .map((option) => {
      const optionIds = new Set((option.exerciseIds ?? []).map(String));
      const acceptedItem = section.items.find((item) =>
        item.exerciseIds.some((id) => optionIds.has(String(id))));
      return {
        ...option,
        durationMinutes:
          acceptedItem?.prescription?.itemDurationMinutes ??
          acceptedItem?.durationMinutes ??
          option.durationMinutes,
        intensity: (acceptedItem?.prescription?.intensity ?? option.intensity) as any,
      };
    });
  return options.length > 0 ? { ...source.conditioningBlock, options } : undefined;
}

function sourceConditioningExerciseIds(workout: Workout): Set<string> {
  const ids = new Set<string>();
  for (const option of workout.conditioningBlock?.options ?? []) {
    for (const id of option.exerciseIds ?? []) ids.add(String(id));
  }
  return ids;
}

function workoutRowIds(row: any): string[] {
  return [row?.id, row?.exerciseId, row?.exercise?.id]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function cloneWorkout(workout: Workout, overrides: Partial<Workout>): Workout {
  return {
    ...workout,
    ...overrides,
    exercises: (overrides.exercises ?? workout.exercises ?? []).map((row: any) => ({
      ...row,
      exercise: row.exercise ? { ...row.exercise } : row.exercise,
    })),
    coachNotes: overrides.coachNotes ?? (
      workout.coachNotes ? [...workout.coachNotes] : undefined
    ),
  };
}

const CONDITIONING_TYPES = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
  'Nordic-4x4',
  'MetCon',
]);

const LEGACY_CONDITIONING_KEYWORDS =
  /finisher|zone\s*2|aerobic|tempo|interval|conditioning|repeat\s*effort|threshold|MAS|sprint/i;

function compactText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function workoutNameHasTeamTraining(workout: Partial<Workout> | null | undefined): boolean {
  const name = compactText(workout?.name);
  if (!name) return false;
  return name.split(/\s+\+\s+/).some((part) => part.trim() === 'team training');
}

function workoutTypeHasConditioning(workout: Partial<Workout>): boolean {
  return CONDITIONING_TYPES.has(String(workout.workoutType ?? ''));
}

function isRecoveryWorkout(workout: Partial<Workout>): boolean {
  return workout.workoutType === 'Recovery' || (workout as any).sessionTier === 'recovery';
}

function isStandaloneConditioningWorkout(workout: Partial<Workout>): boolean {
  return workoutTypeHasConditioning(workout) && !isRecoveryWorkout(workout);
}

function hasSpeedBlock(workout: Partial<Workout>): boolean {
  return !!workout.speedBlock;
}

function hasPowerBlock(workout: Partial<Workout>): boolean {
  return !!workout.powerBlock;
}

function hasRecoveryAddon(workout: Partial<Workout>): boolean {
  return (workout.recoveryAddons ?? []).some((addon) => addon.exercises.length > 0);
}

/**
 * Typed trunk/support ownership. Core rows remain visible training content,
 * but they are not conditioning phases and do not earn conditioning credit.
 */
export function isTrunkSupportRow(row: any): boolean {
  const name = String(row?.exercise?.name ?? row?.name ?? '').trim();
  if (!name) return false;
  const canonicalName = resolveExerciseName(name);
  return getExerciseTags(canonicalName)?.movement === 'core';
}

function conditioningIdsFromBlock(workout: Partial<Workout>, rows: any[]): Set<string> {
  const ids = new Set<string>();
  const rowIds = new Set(rows.map((row) => row?.id).filter(Boolean));
  const options = ((workout as any).conditioningBlock?.options ?? []) as Array<{
    exerciseIds?: string[];
  }>;

  for (const option of options) {
    for (const id of option.exerciseIds ?? []) {
      if (rowIds.has(id)) ids.add(id);
    }
  }

  return ids;
}

function legacyConditioningTailIds(workout: Partial<Workout>, rows: any[]): Set<string> {
  if (!(workout as any).hasCombinedConditioning || rows.length === 0) return new Set();

  let splitIdx = rows.length;
  for (let i = rows.length - 1; i >= 0; i--) {
    const name = rows[i]?.exercise?.name || '';
    const notes = rows[i]?.notes || '';
    if (LEGACY_CONDITIONING_KEYWORDS.test(name) || LEGACY_CONDITIONING_KEYWORDS.test(notes)) {
      splitIdx = i;
    } else {
      break;
    }
  }

  if (splitIdx >= rows.length) return new Set();
  return new Set(rows.slice(splitIdx).map((row) => row?.id).filter(Boolean));
}

export function getSessionComponentRows(workout: Partial<Workout> | null | undefined): {
  strengthRows: any[];
  supportRows: any[];
  conditioningRows: any[];
  teamTrainingRows: any[];
} {
  if (!workout) {
    return { strengthRows: [], supportRows: [], conditioningRows: [], teamTrainingRows: [] };
  }

  const teamState = getTeamTrainingWorkoutState(workout);
  const renderableRows = (teamState.renderableExercises ?? []).filter(
    (row) => !isTeamTrainingItem(row),
  );

  const blockConditioningIds = conditioningIdsFromBlock(workout, renderableRows);
  const legacyConditioningIds = blockConditioningIds.size > 0
    ? new Set<string>()
    : legacyConditioningTailIds(workout, renderableRows);
  const conditioningIds = new Set([...blockConditioningIds, ...legacyConditioningIds]);
  const supportRows = isRecoveryWorkout(workout)
    ? []
    : renderableRows.filter(isTrunkSupportRow);
  const supportIds = new Set(supportRows.map((row) => row?.id).filter(Boolean));

  const conditioningRows = isStandaloneConditioningWorkout(workout)
    ? renderableRows.filter((row) => !supportIds.has(row?.id))
    : renderableRows.filter((row) => conditioningIds.has(row?.id) && !supportIds.has(row?.id));
  const strengthRows = isStandaloneConditioningWorkout(workout) || isRecoveryWorkout(workout)
    ? []
    : renderableRows.filter((row) => !conditioningIds.has(row?.id) && !supportIds.has(row?.id));

  return {
    strengthRows,
    supportRows,
    conditioningRows,
    teamTrainingRows: teamState.teamTrainingItems ?? [],
  };
}

export function getSessionComponents(
  workout: Partial<Workout> | null | undefined,
): SessionComponent[] {
  if (!workout) {
    return [{
      id: 'session',
      kind: 'session',
      label: 'session',
      completionPolicy: 'required',
    }];
  }

  const teamState = getTeamTrainingWorkoutState(workout);
  const { strengthRows, supportRows, conditioningRows } = getSessionComponentRows(workout);
  const components: SessionComponent[] = [];

  if (hasPowerBlock(workout)) {
    components.push({
      id: 'power',
      kind: 'power',
      label: 'power work',
      completionPolicy: 'required',
    });
  }

  if (hasSpeedBlock(workout)) {
    components.push({
      id: 'speed',
      kind: 'speed',
      label: 'speed work',
      completionPolicy: 'required',
    });
  }

  if (strengthRows.length > 0) {
    components.push({
      id: 'strength',
      kind: 'strength',
      label: 'strength work',
      completionPolicy: 'required',
    });
  }

  if (supportRows.length > 0) {
    components.push({
      id: 'support',
      kind: 'support',
      label: 'trunk/support work',
      completionPolicy: 'optional_no_penalty',
    });
  }

  if (
    conditioningRows.length > 0 ||
    (isStandaloneConditioningWorkout(workout) && !teamState.isTeamTrainingOnly)
  ) {
    const isFinisher = workout.attachedConditioningKind === 'finisher';
    components.push(isFinisher
      ? {
          id: 'finisher',
          kind: 'finisher',
          label: 'finisher',
          completionPolicy: 'optional_no_penalty',
        }
      : {
          id: 'conditioning',
          kind: 'conditioning',
          label: 'conditioning',
          completionPolicy: 'required',
        });
  }

  if (teamState.hasTeamTraining || workoutNameHasTeamTraining(workout)) {
    components.push({
      id: 'team_training',
      kind: 'team_training',
      label: 'team training',
      completionPolicy: 'required',
    });
  }

  if (components.length === 0 && isRecoveryWorkout(workout)) {
    components.push({
      id: 'recovery',
      kind: 'recovery',
      label: 'recovery work',
      completionPolicy: 'required',
    });
  }

  if (hasRecoveryAddon(workout)) {
    components.push({
      id: 'recovery_addon',
      kind: 'recovery_addon',
      label: 'recovery add-on',
      completionPolicy: 'optional_no_penalty',
    });
  }

  if (components.length === 0) {
    components.push({
      id: 'session',
      kind: 'session',
      label: 'session',
      completionPolicy: 'required',
    });
  }

  return components;
}

export function componentQuestionLabel(
  component: SessionComponent,
  componentCount: number,
): string {
  if (component.kind === 'strength') {
    return componentCount === 1
      ? 'Did you complete it?'
      : 'Did you complete the strength work?';
  }
  if (component.kind === 'power') return 'Did you complete the power work?';
  if (component.kind === 'support') return 'Did you complete the trunk/support work?';
  if (component.kind === 'conditioning') return 'Did you complete the conditioning?';
  if (component.kind === 'team_training') return 'Did you complete team training?';
  if (component.kind === 'speed') return 'Did you complete the speed work?';
  if (component.kind === 'finisher') return 'Did you complete the finisher?';
  if (component.kind === 'recovery_addon') return 'Did you complete the recovery add-on?';
  if (component.kind === 'recovery') return 'Did you complete the recovery work?';
  return 'Did you complete it?';
}

function componentReasonSubject(component: SessionComponent): string {
  if (component.kind === 'power') return 'the power work';
  if (component.kind === 'strength') return 'the strength work';
  if (component.kind === 'support') return 'the trunk/support work';
  if (component.kind === 'conditioning') return 'the conditioning';
  if (component.kind === 'team_training') return 'team training';
  if (component.kind === 'speed') return 'the speed work';
  if (component.kind === 'finisher') return 'the finisher';
  if (component.kind === 'recovery_addon') return 'the recovery add-on';
  if (component.kind === 'recovery') return 'the recovery work';
  return 'the session';
}

export function componentSkipReasonLabel(component: SessionComponent): string {
  return `Why did you skip ${componentReasonSubject(component)}?`;
}

export function componentPartialReasonLabel(component: SessionComponent): string {
  return `Why did you only complete part of ${componentReasonSubject(component)}?`;
}

export function feedbackComponentKindForWorkoutType(
  workoutType: string,
): SessionComponentKind | null {
  const type = compactText(workoutType);
  if (type.includes('conditioning') || type.includes('sprint') || type.includes('run')) {
    return 'conditioning';
  }
  if (type.includes('team training')) return 'team_training';
  if (type.includes('recovery')) return 'recovery';
  return 'strength';
}
