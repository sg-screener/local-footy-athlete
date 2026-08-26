import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import { journalWeekStartOf } from './journalLoad';
import {
  estimateExternalOneRepMaxKg,
  isPullUpExerciseName,
  type OneRepMaxBasis,
} from './estimatedOneRepMax';

export type ProgressMainLiftId = 'pull_up' | 'bench_press' | 'rdl' | 'back_squat';

export interface ProgressMainLiftPoint {
  readonly weekStart: string;
  readonly predictedOneRepMaxKg: number;
}

export interface ProgressMainLiftHistory {
  readonly id: ProgressMainLiftId;
  readonly exerciseName: string;
  readonly points: readonly ProgressMainLiftPoint[];
  readonly valuePrefix: '' | '+';
}

export interface ProgressStrengthSession {
  readonly date: string;
  readonly strength: readonly StrengthExercisePerformanceLog[];
}

const MAIN_LIFTS: readonly Omit<ProgressMainLiftHistory, 'points'>[] = [
  { id: 'pull_up', exerciseName: 'Pull-Up', valuePrefix: '+' },
  { id: 'bench_press', exerciseName: 'Bench Press', valuePrefix: '' },
  { id: 'rdl', exerciseName: 'RDL', valuePrefix: '' },
  { id: 'back_squat', exerciseName: 'Back Squat', valuePrefix: '' },
];

function normalizedName(exerciseName: string): string {
  return exerciseName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function mainLiftId(exerciseName: string): ProgressMainLiftId | null {
  if (isPullUpExerciseName(exerciseName)) return 'pull_up';
  const normalized = normalizedName(exerciseName);
  if (normalized === 'bench press') return 'bench_press';
  if (normalized === 'rdl' || normalized === 'rdls'
    || normalized === 'romanian deadlift' || normalized === 'romanian deadlifts') return 'rdl';
  if (normalized === 'back squat' || normalized === 'back squats') return 'back_squat';
  return null;
}

function legacyBasis(
  lift: StrengthExercisePerformanceLog,
  bodyWeightKg: number | undefined,
): OneRepMaxBasis | null {
  const id = mainLiftId(lift.exerciseName);
  if (id === null || lift.completion === 'skipped') return null;
  const reps = Number.isInteger(lift.actualReps) && Number(lift.actualReps) > 0
    ? Number(lift.actualReps)
    : lift.completion === 'full'
      ? Number(lift.prescribedRepsMax)
      : 0;
  if (reps < 1 || reps > 10) return null;
  if (id === 'pull_up') {
    if (typeof bodyWeightKg !== 'number' || bodyWeightKg <= 0) return null;
    return {
      externalLoadKg: typeof lift.weightKg === 'number' && lift.weightKg > 0 ? lift.weightKg : 0,
      reps,
      bodyWeightKg,
    };
  }
  if (typeof lift.weightKg !== 'number' || lift.weightKg <= 0) return null;
  return { externalLoadKg: lift.weightKg, reps };
}

function roundedKg(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildProgressMainLiftHistories(input: {
  readonly weekStart: string;
  readonly sessions: readonly ProgressStrengthSession[];
  readonly bodyWeightKg?: number;
}): readonly ProgressMainLiftHistory[] {
  const bestByLiftAndWeek = new Map<string, number>();
  for (const session of input.sessions) {
    const weekStart = journalWeekStartOf(session.date);
    if (weekStart === null || weekStart > input.weekStart) continue;
    for (const lift of session.strength) {
      const id = mainLiftId(lift.exerciseName);
      if (id === null || lift.completion === 'skipped') continue;
      const storedBasis = lift.oneRepMaxBasis;
      const basis = storedBasis
        ? id === 'pull_up' && storedBasis.bodyWeightKg === undefined
          ? { ...storedBasis, bodyWeightKg: input.bodyWeightKg }
          : storedBasis
        : legacyBasis(lift, input.bodyWeightKg);
      if (!basis) continue;
      const estimate = estimateExternalOneRepMaxKg(basis);
      if (estimate === null) continue;
      const key = `${id}:${weekStart}`;
      const current = bestByLiftAndWeek.get(key);
      if (current === undefined || estimate > current) bestByLiftAndWeek.set(key, estimate);
    }
  }

  return MAIN_LIFTS.map((lift) => ({
    ...lift,
    points: Array.from(bestByLiftAndWeek.entries())
      .flatMap(([key, estimate]) => {
        const [id, weekStart] = key.split(':');
        return id === lift.id ? [{ weekStart, predictedOneRepMaxKg: roundedKg(estimate) }] : [];
      })
      .sort((left, right) => left.weekStart.localeCompare(right.weekStart)),
  }));
}
