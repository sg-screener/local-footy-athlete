import type { Workout } from '../types/domain';
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
