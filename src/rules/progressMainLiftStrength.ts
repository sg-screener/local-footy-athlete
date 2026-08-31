import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import { journalWeekStartOf } from './journalLoad';
import {
  estimateExternalOneRepMaxKg,
  type OneRepMaxBasis,
  TRACKED_LIFTS, selectedTrackedLifts, trackedLiftId, estimateLastSetOneRepMaxKg,
  type TrackedLiftId, type TrackedLiftChoices,
} from './estimatedOneRepMax';

export type ProgressMainLiftId = TrackedLiftId;

export interface ProgressMainLiftPoint {
  readonly weekStart: string;
  readonly predictedOneRepMaxKg: number;
}

export interface ProgressMainLiftHistory {
  readonly id: ProgressMainLiftId;
  readonly exerciseName: string;
  readonly points: readonly ProgressMainLiftPoint[];
  readonly series: readonly ProgressMainLiftSeries[];
  readonly valuePrefix: '' | '+';
}

export interface ProgressStrengthSession {
  readonly date: string;
  readonly strength: readonly StrengthExercisePerformanceLog[];
}

export interface ProgressMainLiftSeries {
  readonly key: string;
  readonly label: string;
  readonly method: string;
  readonly points: readonly ProgressMainLiftPoint[];
}

function legacyBasis(
  lift: StrengthExercisePerformanceLog,
): OneRepMaxBasis | null {
  const id = trackedLiftId(lift.exerciseName);
  if (id === null || lift.completion === 'skipped') return null;
  const reps = Number.isInteger(lift.actualReps) && Number(lift.actualReps) > 0
    ? Number(lift.actualReps)
    : lift.completion === 'full'
      ? Number(lift.prescribedRepsMax)
      : 0;
  if (reps < 1 || reps > 10) return null;
  if (id === 'pull_up') return null;
  if (typeof lift.weightKg !== 'number' || lift.weightKg <= 0) return null;
  return { externalLoadKg: lift.weightKg, reps };
}

function roundedKg(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildProgressMainLiftHistories(input: {
  readonly weekStart: string;
  readonly sessions: readonly ProgressStrengthSession[];
  /** Retained for old callers; never used to fill historical session measurements. */
  readonly bodyWeightKg?: number;
  readonly choices?: TrackedLiftChoices;
}): readonly ProgressMainLiftHistory[] {
  const seriesByLift = new Map<TrackedLiftId, Map<string, {
    label: string; method: string; weeks: Map<string, number>;
  }>>();
  for (const session of input.sessions) {
    const weekStart = journalWeekStartOf(session.date);
    if (weekStart === null || weekStart > input.weekStart) continue;
    for (const lift of session.strength) {
      const id = trackedLiftId(lift.exerciseName);
      if (id === null || lift.completion === 'skipped') continue;
      const raw = lift.lastSetEstimate;
      let estimate: number | null = null;
      let method = 'legacy_brzycki';
      if (raw) {
        if (raw.liftId !== id || raw.exerciseId !== lift.exerciseId
          || raw.workoutExerciseId !== lift.workoutExerciseId) continue;
        estimate = estimateLastSetOneRepMaxKg(raw);
        method = raw.method;
      } else if (lift.estimateCaptureVersion === undefined) {
        const basis = lift.oneRepMaxBasis ?? legacyBasis(lift);
        if (basis && (id !== 'pull_up' || (basis.bodyWeightKg ?? 0) > 0)) {
          estimate = estimateExternalOneRepMaxKg(basis);
        }
      }
      if (estimate === null) continue;
      // Exact approved aliases identify the lift. A manual Add and an automatic
      // row can have different storage IDs for that same exercise; those IDs
      // establish provenance above, not different physiological variations.
      const key = JSON.stringify([method, id]);
      const byContext = seriesByLift.get(id) ?? new Map();
      const series = byContext.get(key) ?? {
        method,
        label: [method === 'legacy_brzycki' ? 'Legacy estimate · no RIR' : 'Last-set estimate',
          id === 'bulgarian_split_squat' ? 'Non-dominant leg · total external load' : '']
          .filter(Boolean).join(' · '),
        weeks: new Map<string, number>(),
      };
      const current = series.weeks.get(weekStart);
      if (current === undefined || estimate > current) series.weeks.set(weekStart, estimate);
      byContext.set(key, series);
      seriesByLift.set(id, byContext);
    }
  }
  return selectedTrackedLifts(input.choices).map((id) => {
    const series: ProgressMainLiftSeries[] = [...(seriesByLift.get(id) ?? new Map()).entries()]
      .map(([key, entry]) => ({
        key, label: entry.label, method: entry.method,
        points: [...entry.weeks.entries()].map(([weekStart, estimate]) => ({
          weekStart, predictedOneRepMaxKg: entry.method === 'legacy_brzycki'
            ? roundedKg(estimate) : Math.round(estimate),
        })).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      }));
    series.sort((a, b) => (a.points.at(-1)?.weekStart ?? '').localeCompare(b.points.at(-1)?.weekStart ?? ''));
    return { id, exerciseName: TRACKED_LIFTS[id].label, valuePrefix: id === 'pull_up' ? '+' : '',
      series, points: series.at(-1)?.points ?? [] };
  });
}
