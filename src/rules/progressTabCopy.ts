import { TRACKED_LIFTS, type TrackedLiftId } from './estimatedOneRepMax';

/** Athlete-facing Progress words ruled by Sam in R-139, R-279 and R-280. */
export const PROGRESS_TAB_COPY = {
  title: 'Progress',
  subtitle: 'Your training at a glance.',
  load: 'Training load',
  mainLifts: 'Main lifts (Estimated 1 rep max)',
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
  noHistoryInPeriod: 'No data in this period',
  noResultInPeriod: 'No result in this period',
  onlyResultInPeriod: 'Only result in this period',
} as const;

const PROGRESS_LIFT_LABELS: Partial<Record<TrackedLiftId, string>> = {
  pull_up: 'Pull-Up',
};

export function progressLiftLabel(lift: TrackedLiftId): string {
  return PROGRESS_LIFT_LABELS[lift] ?? TRACKED_LIFTS[lift].label;
}

/** Explains the existing last-set estimator and weekly history owner, R-392. */
export const PROGRESS_LIFT_CALCULATION_COPY = {
  title: 'How it’s calculated',
  introduction: 'This estimates the heaviest weight you could lift for 1 rep.',
  inputs: 'We use the weight you lifted, the reps you did, and how many more reps you felt you could do.',
  example: 'For example, 6 reps with 2 left counts as roughly 8 possible reps. We use a reps-to-weight table to estimate your one-rep max.',
  weekly: 'The graph updates each time you perform that exercise, and is based on your feedback from the session.',
  pullUp: 'Pull-ups show added weight only.',
  splitSquat: 'For Bulgarian split squats, we use your non-dominant leg and the total weight you hold.',
  legacy: 'Older records may use weight and reps only. Those estimates appear as a separate line.',
  guide: 'Use this as a guide to your progress.',
} as const;
