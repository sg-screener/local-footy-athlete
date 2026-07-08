import type { Workout } from '../types/domain';
import { TEAM_ONLY_NAME } from './sessionNaming';

type WorkoutLike = Partial<Workout> & {
  isTeamDay?: boolean;
  type?: string | null;
  title?: string | null;
  exercises?: any[] | null;
};

export interface TeamTrainingWorkoutState {
  hasTeamTraining: boolean;
  isTeamTrainingOnly: boolean;
  isTeamTrainingSessionOnly: boolean;
  teamTrainingItems: any[];
  renderableExercises: any[];
  displayName: string | null;
  displayWorkoutType: string | null;
}

export interface TeamTrainingExerciseSplit {
  teamTrainingItems: any[];
  renderableExercises: any[];
}

const TEAM_TRAINING_TEXT = 'team training';
const TEAM_TRAINING_ITEM_NAMES = new Set([
  TEAM_TRAINING_TEXT,
  'team training field session',
  'club training',
  'club team field session',
  'club/team field session',
  'field session',
]);

function compactText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function nameHasTeamTrainingPart(name: string): boolean {
  const normalised = compactText(name);
  if (!normalised) return false;
  return normalised
    .split(/\s+\+\s+/)
    .map((part) => part.trim())
    .some((part) => part === TEAM_TRAINING_TEXT);
}

function isTeamTrainingCompositeName(name: string): boolean {
  const normalised = compactText(name);
  if (!normalised.includes(' + ')) return false;
  const parts = normalised.split(/\s+\+\s+/).map((part) => part.trim());
  return parts.length > 1 && parts.includes(TEAM_TRAINING_TEXT);
}

function isTeamTrainingOnlyName(name: string): boolean {
  const normalised = compactText(name);
  if (!normalised) return false;
  if (normalised === TEAM_TRAINING_TEXT) return true;
  if (isTeamTrainingCompositeName(normalised)) return false;
  return (
    normalised === 'team training field session' ||
    normalised === 'club team field session' ||
    normalised === 'club/team field session' ||
    normalised === 'club training' ||
    normalised === 'field session'
  );
}

export function isTeamTrainingSession(workout: WorkoutLike | null | undefined): boolean {
  if (!workout) return false;
  const workoutType = compactText(workout.workoutType ?? workout.type);
  const name = compactText(workout.name ?? workout.title);
  return (
    workout.isTeamDay === true ||
    workoutType === TEAM_TRAINING_TEXT ||
    nameHasTeamTrainingPart(name) ||
    isTeamTrainingOnlyName(name)
  );
}

export function isTeamTrainingWorkout(workout: WorkoutLike | null | undefined): boolean {
  return isTeamTrainingSession(workout);
}

export function isTeamTrainingBlock(workout: WorkoutLike | null | undefined): boolean {
  return isTeamTrainingSession(workout);
}

export function isTeamTrainingSessionOnly(workout: WorkoutLike | null | undefined): boolean {
  if (!workout) return false;
  const name = compactText(workout.name ?? workout.title);
  const workoutType = compactText(workout.workoutType ?? workout.type);
  if (isTeamTrainingCompositeName(name)) return false;
  if (isTeamTrainingOnlyName(name)) return true;
  return workout.isTeamDay === true || workoutType === TEAM_TRAINING_TEXT;
}

export function isTeamTrainingItem(item: any): boolean {
  if (!item) return false;
  const workoutType = compactText(item.workoutType ?? item.type);
  if (workoutType === TEAM_TRAINING_TEXT) return true;

  const name = compactText(
    item.exercise?.name ??
      item.name ??
      item.title ??
      item.exerciseName,
  );
  if (!name) return false;
  if (TEAM_TRAINING_ITEM_NAMES.has(name)) return true;
  if (nameHasTeamTrainingPart(name)) return true;
  if (/^team training\b/.test(name)) return true;
  if (/^team field session\b/.test(name)) return true;
  return false;
}

export function isTeamTrainingExercise(item: any): boolean {
  return isTeamTrainingItem(item);
}

export function splitTeamTrainingFromExercises(
  exercises: any[] | null | undefined,
  options: { treatAllAsTeamTraining?: boolean } = {},
): TeamTrainingExerciseSplit {
  const rows = Array.isArray(exercises) ? exercises : [];
  if (options.treatAllAsTeamTraining) {
    return {
      teamTrainingItems: rows,
      renderableExercises: [],
    };
  }

  const teamTrainingItems: any[] = [];
  const renderableExercises: any[] = [];
  for (const row of rows) {
    if (isTeamTrainingItem(row)) {
      teamTrainingItems.push(row);
    } else {
      renderableExercises.push(row);
    }
  }
  return { teamTrainingItems, renderableExercises };
}

export function getTeamTrainingWorkoutState(
  workout: WorkoutLike | null | undefined,
): TeamTrainingWorkoutState {
  if (!workout) {
    return {
      hasTeamTraining: false,
      isTeamTrainingOnly: false,
      isTeamTrainingSessionOnly: false,
      teamTrainingItems: [],
      renderableExercises: [],
      displayName: null,
      displayWorkoutType: null,
    };
  }

  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const isSessionOnly = isTeamTrainingSessionOnly(workout);
  const { teamTrainingItems, renderableExercises } = splitTeamTrainingFromExercises(
    exercises,
    { treatAllAsTeamTraining: isSessionOnly },
  );
  const hasTeamTraining =
    isTeamTrainingSession(workout) || teamTrainingItems.length > 0;
  const hasConditioningBlock =
    ((workout as any).conditioningBlock?.options ?? []).length > 0;
  const isTeamTrainingOnly =
    hasTeamTraining && renderableExercises.length === 0 && !hasConditioningBlock;

  return {
    hasTeamTraining,
    isTeamTrainingOnly,
    isTeamTrainingSessionOnly: isSessionOnly,
    teamTrainingItems,
    renderableExercises,
    displayName: isTeamTrainingOnly ? TEAM_ONLY_NAME : workout.name ?? null,
    displayWorkoutType: isTeamTrainingOnly
      ? TEAM_ONLY_NAME
      : String(workout.workoutType ?? workout.type ?? '') || null,
  };
}

export function extractTeamTrainingFromWorkout(
  workout: WorkoutLike | null | undefined,
): TeamTrainingWorkoutState {
  return getTeamTrainingWorkoutState(workout);
}

export function normalizeTeamTrainingWorkoutForDisplay<T extends WorkoutLike | null | undefined>(
  workout: T,
): T {
  if (!workout) return workout;
  const state = getTeamTrainingWorkoutState(workout);
  if (!state.hasTeamTraining) return workout;

  const normalized = {
    ...workout,
    name: state.displayName ?? workout.name,
    workoutType: state.displayWorkoutType ?? workout.workoutType,
    exercises: state.renderableExercises,
  } as WorkoutLike;

  if (state.isTeamTrainingOnly) {
    normalized.hasCombinedConditioning = false;
    normalized.conditioningFlavour = undefined;
    normalized.conditioningCategory = undefined;
    normalized.conditioningBlock = undefined;
    normalized.coachAddedConditioningLabel = undefined;
  }

  return normalized as T;
}

export function normalizeTeamTrainingBlocks<T extends WorkoutLike | null | undefined>(
  workout: T,
): T {
  return normalizeTeamTrainingWorkoutForDisplay(workout);
}

export function isTeamTrainingOnlyWorkout(
  workout: WorkoutLike | null | undefined,
): boolean {
  return getTeamTrainingWorkoutState(workout).isTeamTrainingOnly;
}
