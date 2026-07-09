import type {
  SeasonPhase,
  WeekKind,
  WorkoutExercise,
} from '../types/domain';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';

export type DeloadConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic';

export interface DeloadWeekPolicy {
  weekKind: 'deload';
  seasonPhase: 'Off-season' | 'Pre-season';
  intensityMultiplier: number;
  rpeCap: number;
  setDrop: number;
  minSets: number;
  maxAccessoriesToRemove: number;
}

export function resolveWeekKind(
  seasonPhase: SeasonPhase | null | undefined,
  weekInBlock: number,
): WeekKind {
  if ((seasonPhase === 'Off-season' || seasonPhase === 'Pre-season') && weekInBlock === 4) {
    return 'deload';
  }
  return 'build';
}

export function resolveWeekIntensityMultiplier(
  seasonPhase: SeasonPhase | null | undefined,
  weekKind: WeekKind,
): number {
  if (weekKind !== 'deload') return 1.0;
  if (seasonPhase === 'Off-season') return 0.85;
  if (seasonPhase === 'Pre-season') return 0.9;
  return 1.0;
}

export function resolveDeloadWeekPolicy(
  seasonPhase: SeasonPhase | null | undefined,
  weekKind: WeekKind | null | undefined,
): DeloadWeekPolicy | null {
  if (weekKind !== 'deload') return null;
  if (seasonPhase !== 'Off-season' && seasonPhase !== 'Pre-season') return null;
  return {
    weekKind: 'deload',
    seasonPhase,
    intensityMultiplier: resolveWeekIntensityMultiplier(seasonPhase, weekKind),
    rpeCap: 7,
    setDrop: 1,
    minSets: 2,
    maxAccessoriesToRemove: 2,
  };
}

export function isHardDeloadConditioningCategory(
  category: DeloadConditioningCategory | null | undefined,
): boolean {
  return category === 'sprint' || category === 'vo2' || category === 'glycolytic';
}

export function deloadConditioningCategory(
  category: DeloadConditioningCategory | null | undefined,
): DeloadConditioningCategory | null {
  if (category === 'vo2') return 'tempo';
  if (category === 'sprint' || category === 'glycolytic') return 'aerobic_base';
  return category ?? null;
}

export function deloadConditioningFlavour(
  category: DeloadConditioningCategory | null | undefined,
): 'aerobic' | 'tempo' | 'high-intensity' | undefined {
  const deloaded = deloadConditioningCategory(category);
  if (deloaded === 'aerobic_base') return 'aerobic';
  if (deloaded === 'tempo') return 'tempo';
  return undefined;
}

export function isConditioningExerciseRow(exercise: WorkoutExercise): boolean {
  const name = exercise.exercise?.name ?? '';
  const tags = EXERCISE_TAGS[name];
  if (tags?.movement === 'conditioning') return true;
  return /\b(conditioning|sprint|tempo|aerobic|interval|run|bike|row|ski|swim|vo2|mas|cool-?down|warm-?up)\b/i
    .test(`${name} ${exercise.notes ?? ''}`);
}

function isMainStrengthRow(exercise: WorkoutExercise): boolean {
  if (isConditioningExerciseRow(exercise)) return false;
  return classifyPoolSlot(exercise.exercise?.name ?? '')?.role === 'anchor';
}

function isAccessoryStrengthRow(exercise: WorkoutExercise): boolean {
  if (isConditioningExerciseRow(exercise)) return false;
  return !isMainStrengthRow(exercise);
}

function roundLoad(weightKg: number): number {
  return Math.round(weightKg * 2) / 2;
}

function appendDeloadNote(notes: string | undefined, rpeCap: number): string {
  const note = `Deload week: keep RPE 6-${rpeCap}; leave reps in reserve.`;
  if (!notes) return note;
  if (/Deload week:/i.test(notes)) return notes;
  return `${notes} ${note}`;
}

export function applyStrengthDeloadToExercises(
  exercises: WorkoutExercise[],
  policy: DeloadWeekPolicy,
): WorkoutExercise[] {
  const strengthIndexes = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => !isConditioningExerciseRow(exercise))
    .map(({ index }) => index);

  const accessoryIndexes = strengthIndexes.filter((index) => isAccessoryStrengthRow(exercises[index]));
  const removableAccessoryIndexes = accessoryIndexes.slice(1);
  const removeCount = Math.min(
    policy.maxAccessoriesToRemove,
    Math.max(0, strengthIndexes.length - 3),
    removableAccessoryIndexes.length,
  );
  const removeIndexes = new Set(removableAccessoryIndexes.slice(-removeCount));

  return exercises
    .filter((_, index) => !removeIndexes.has(index))
    .map((exercise, index) => {
      if (isConditioningExerciseRow(exercise)) {
        return { ...exercise, exerciseOrder: index + 1 };
      }

      const nextSets = exercise.prescribedSets > policy.minSets
        ? Math.max(policy.minSets, exercise.prescribedSets - policy.setDrop)
        : exercise.prescribedSets;
      const nextWeight = exercise.prescribedWeightKg && exercise.prescribedWeightKg > 0
        ? roundLoad(exercise.prescribedWeightKg * policy.intensityMultiplier)
        : exercise.prescribedWeightKg;

      return {
        ...exercise,
        exerciseOrder: index + 1,
        prescribedSets: nextSets,
        prescribedWeightKg: nextWeight,
        notes: appendDeloadNote(exercise.notes, policy.rpeCap),
      };
    });
}
