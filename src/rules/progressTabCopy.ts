import { TRACKED_LIFTS, type TrackedLiftId } from './estimatedOneRepMax';

/** Athlete-facing Progress words ruled by Sam in R-139, R-279 and R-280. */
export const PROGRESS_TAB_COPY = {
  title: 'Progress',
  load: 'Load',
  mainLifts: 'Main lifts (Estimated 1RM)',
  performanceTests: 'Performance tests',
  measurements: 'Measurements',
  noPerformanceResult: 'No result yet',
  baseline: 'Baseline',
  noChange: 'No change',
  better: 'better',
  worse: 'worse',
  saveResult: 'Save result',
  saveMeasurements: 'Save measurements',
  noLiftHistory: 'No data yet',
} as const;

const PROGRESS_LIFT_LABELS: Partial<Record<TrackedLiftId, string>> = {
  pull_up: 'Pull-Up (added weight)',
};

export function progressLiftLabel(lift: TrackedLiftId): string {
  return PROGRESS_LIFT_LABELS[lift] ?? TRACKED_LIFTS[lift].label;
}
