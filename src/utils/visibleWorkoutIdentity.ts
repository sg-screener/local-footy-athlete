import type { Workout, WorkoutType } from '../types/domain';
import { classifyExerciseExposures, type Exposure } from './exposureEngine';

export interface VisibleWorkoutIdentity {
  title: string;
  subtitle: WorkoutType | string;
  isConditioningOnly: boolean;
}

const CONDITIONING_WORKOUT_TYPES = new Set<string>([
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
]);

const STRENGTH_EXPOSURES = new Set<Exposure>([
  'heavy_lower_strength',
  'heavy_squat',
  'heavy_hinge',
  'knee_dominant',
  'hip_dominant',
  'posterior_chain',
  'hamstring_dominant',
  'loaded_carry',
  'lunge',
  'squat',
  'hinge',
  'horizontal_press',
  'vertical_press',
  'overhead_loading',
  'explosive_push',
  'shoulder_isolation',
  'horizontal_pull',
  'vertical_pull',
  'heavy_pull',
  'grip_heavy',
  'low_load_accessory',
  'max_effort_strength',
  'high_volume_accessory',
]);

const CONDITIONING_EXPOSURES = new Set<Exposure>([
  'easy_erg',
  'hard_erg',
  'running',
  'sprint',
  'high_speed_running',
  'acceleration',
  'change_of_direction',
]);

function exerciseNames(workout: Workout): string[] {
  return (workout.exercises ?? [])
    .map((ex: any) => ex.exercise?.name)
    .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0);
}

export function isConditioningOnlyWorkout(workout: Workout): boolean {
  if (workout.hasCombinedConditioning) return false;
  if (workout.workoutType === 'Recovery' || workout.workoutType === 'Game') return false;

  const names = exerciseNames(workout);
  const hasConditioningType =
    CONDITIONING_WORKOUT_TYPES.has(workout.workoutType) ||
    (!!workout.conditioningFlavour && !workout.hasCombinedConditioning);
  const nameHintsConditioning = names.some((name) =>
    /\b(zone\s*2|aerobic|conditioning|tempo|interval|run|rower|rowing\s*erg|\brow\b|bike|ski[-\s]?erg|assault\s*bike)\b/i.test(name),
  );

  if (!hasConditioningType && !nameHintsConditioning) return false;
  if (names.length === 0) return hasConditioningType;

  let hasConditioningExposure = false;
  for (const name of names) {
    const exposures = classifyExerciseExposures(name);
    if (exposures.some((e) => STRENGTH_EXPOSURES.has(e))) return false;
    if (exposures.some((e) => CONDITIONING_EXPOSURES.has(e))) {
      hasConditioningExposure = true;
    }
  }
  return hasConditioningExposure || hasConditioningType;
}

function titleFromConditioningWorkout(workout: Workout): string {
  const blockTitle = workout.conditioningBlock?.options?.[0]?.title?.trim();
  if (blockTitle) return blockTitle;

  const primary = exerciseNames(workout).find((name) =>
    !/warm[-\s]?up|cool[-\s]?down|cooldown/i.test(name),
  ) ?? exerciseNames(workout)[0] ?? '';
  const text = `${primary} ${workout.name}`.trim();

  if (/\bzone\s*2\b/i.test(text) && /\b(row|rower|rowing\s*erg)\b/i.test(text)) {
    return 'Zone 2 Row';
  }
  if (/\bzone\s*2\b/i.test(text) && /\b(bike|cycling|assault\s*bike|echo\s*bike|airbike)\b/i.test(text)) {
    return 'Zone 2 Bike';
  }
  if (/\beasy\s+aerobic\s+flush\b/i.test(text)) return 'Easy Aerobic Flush';
  if (/\bzone\s*2\b/i.test(text)) return 'Zone 2 Conditioning';
  if (/\baerobic\b/i.test(text)) return 'Aerobic Base';
  if (/\btempo\b/i.test(text)) return 'Tempo Running';
  if (/\binterval/i.test(text)) return 'Conditioning Intervals';
  if (/\b(row|rower|rowing\s*erg)\b/i.test(text)) return 'Row Conditioning';
  if (/\b(bike|cycling|assault\s*bike|echo\s*bike|airbike)\b/i.test(text)) return 'Bike Conditioning';
  return 'Conditioning';
}

export function deriveVisibleWorkoutIdentity(workout: Workout): VisibleWorkoutIdentity {
  const isConditioningOnly = isConditioningOnlyWorkout(workout);
  if (!isConditioningOnly) {
    return {
      title: workout.name || workout.workoutType || 'Session',
      subtitle: workout.workoutType || 'Workout',
      isConditioningOnly: false,
    };
  }
  return {
    title: titleFromConditioningWorkout(workout),
    subtitle: 'Conditioning',
    isConditioningOnly: true,
  };
}

export function normalizeVisibleWorkoutIdentity(workout: Workout): Workout {
  const identity = deriveVisibleWorkoutIdentity(workout);
  if (!identity.isConditioningOnly) return workout;
  if (workout.name === identity.title && workout.workoutType === 'Conditioning') return workout;
  return {
    ...workout,
    name: identity.title,
    workoutType: 'Conditioning' as WorkoutType,
  };
}
