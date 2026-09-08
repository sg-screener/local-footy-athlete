/** Actual lower-body working dose for Speed placement. No stored fatigue label. */
import type { Workout } from '../types/domain';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { getExerciseTags } from '../data/exerciseTags';
import { isoDateForWeekday } from '../utils/appDate';
import type { LowerBodyWorkload } from './weeklyScheduler';

export interface StrengthTrainingRecord {
  readonly dateStr: string;
  readonly completion: string;
  readonly strength?: readonly StrengthExercisePerformanceLog[];
  readonly components?: readonly { readonly kind: string; readonly completion: string }[];
}

export function lowerBodyWorkloadForWeek(input: {
  readonly workouts: readonly Workout[];
  readonly weekStartISO: string;
  readonly completedBeforeISO?: string;
  readonly feedback?: Readonly<Record<string, StrengthTrainingRecord>>;
}): Readonly<Record<number, LowerBodyWorkload>> {
  return Object.fromEntries([0,1,2,3,4,5,6].map(day => {
    const date = isoDateForWeekday(input.weekStartISO, day);
    const work = input.workouts.filter(workout => workout.dayOfWeek === day);
    const rows = work.flatMap(workout => {
      const parts = getSessionComponentRows(workout);
      return [...parts.strengthRows, ...parts.supportRows];
    });
    const past = input.completedBeforeISO !== undefined && date < input.completedBeforeISO;
    const record = past ? Object.values(input.feedback ?? {}).find(entry => entry.dateStr === date) : undefined;
    const skipped = record?.components?.find(part => part.kind === 'strength')?.completion === 'skipped'
      || record?.completion === 'skipped';
    if (skipped) return [day, {workingSets:0, unknown:false}];
    let workingSets = 0; let unknown = false;
    const accounted = new Set<string>();
    for (const row of rows) {
      const tag = getExerciseTags(row.exercise.name);
      if (tag && tag.region !== 'lower') continue;
      if (!tag) { unknown = true; continue; }
      const log = record?.strength?.find(entry => entry.workoutExerciseId === row.id)
        ?? record?.strength?.find(entry => entry.exerciseName === row.exercise.name);
      if (log) accounted.add(log.workoutExerciseId);
      if (log?.completion === 'skipped') continue;
      const sets = log?.completedSets ?? (log?.completion === 'full' ? log.prescribedSets : row.prescribedSets);
      if (past && (!log || (log.completion === 'partial' && log.completedSets === undefined))) unknown = true;
      if (Number.isFinite(sets) && sets >= 0) workingSets += sets;
      else unknown = true;
    }
    // Completed manual additions may no longer be present in the generated draft.
    for (const log of record?.strength ?? []) {
      if (accounted.has(log.workoutExerciseId) || log.completion === 'skipped') continue;
      const tag = getExerciseTags(log.exerciseName);
      if (!tag) { unknown = true; continue; }
      if (tag.region !== 'lower') continue;
      const sets = log.completedSets ?? log.prescribedSets;
      if (log.completion === 'partial' && log.completedSets === undefined) unknown = true;
      if (Number.isFinite(sets) && sets >= 0) workingSets += sets;
      else unknown = true;
    }
    // Per-side prescriptions already express sets experienced by each leg.
    return [day, {workingSets, unknown}];
  }));
}
