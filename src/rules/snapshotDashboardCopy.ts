/**
 * BATCH 38 — COACH SNAPSHOT DASHBOARD. SIGNED 2026-08-24; Progress Load
 * wording revised by Sam in R-281 on 2026-08-31.
 *
 * Sam named the five sections, signed the first wording with "the wording is
 * fine", then moved Load into the hero and supplied `Consistency` as the exact
 * replacement label for weekly completion in the four-tile grid. He renamed
 * the active-modifier summary `My Status` after confirming it is the same list.
 */

import type { CoachSnapshotReadinessState } from './liveAthleteSnapshot';
import type { BandVerdict, JournalLoadCoverage } from './journalLoad';
import type { JournalWork } from './journalWeek';
import type { StrengthLiftTrend, StrengthTrendDirection } from './journalStrengthTrend';

export const COACH_DASHBOARD_COPY = {
  title: 'Coach snapshot',
  consistency: 'Consistency',
  readiness: 'Readiness',
  load: 'Load',
  progress: 'Progress',
  myStatus: 'My Status',
  noSessions: 'No sessions planned this week.',
  noCheckIn: 'No check-in today',
  readinessGood: 'Feeling good',
  readinessFlat: 'Feeling flat',
  readinessSore: 'Feeling sore',
  readinessRecorded: 'Check-in recorded',
  loadUnavailable: 'Building your load history',
  loadBelow: 'Potentially undertraining',
  loadIn: 'In the sweet spot',
  loadAbove: 'Potentially overtraining',
  loadDeload: 'Deload week',
  loadSweetSpotGuidance: 'The sweet spot helps you build fitness without training too hard or undertraining.',
  loadDeloadGuidance: 'Lower load is expected during a deload week.',
  loadHistoryGuidance: 'Complete and rate your sessions to build your 4-week load baseline.',
  loadHistoryBuilding: 'Your load graph builds as you train.',
  noProgress: 'No lifts recorded this week',
  progressUp: 'Up from last week',
  progressFlat: 'Same as last week',
  progressDown: 'Down from last week',
  progressNew: 'No last-week comparison',
  noRestrictions: 'None active',
} as const;

/**
 * Position a load ratio on the signed continuum used by the old Journal hero.
 * The track gives one band-width of context on either side of the sweet spot;
 * clamping changes only the finite drawing, never the athlete's load number.
 */
export function coachLoadMarkerFraction(
  ratio: number,
  band: { readonly low: number; readonly high: number },
): number {
  const span = band.high - band.low;
  if (!Number.isFinite(ratio) || span <= 0) return 0.5;
  const trackLow = band.low - span;
  const trackHigh = band.high + span;
  return Math.min(1, Math.max(0, (ratio - trackLow) / (trackHigh - trackLow)));
}

export function coachWeekSummary(work: JournalWork): string {
  if (work.sessionsPlanned === 0) return COACH_DASHBOARD_COPY.noSessions;
  const completed = work.completedFull + work.completedPartial;
  return `${completed} of ${work.sessionsPlanned} sessions done`;
}

export function coachReadinessSummary(state: CoachSnapshotReadinessState): string {
  switch (state) {
    case 'good': return COACH_DASHBOARD_COPY.readinessGood;
    case 'flat': return COACH_DASHBOARD_COPY.readinessFlat;
    case 'sore': return COACH_DASHBOARD_COPY.readinessSore;
    case 'recorded': return COACH_DASHBOARD_COPY.readinessRecorded;
    case 'not_recorded':
    default: return COACH_DASHBOARD_COPY.noCheckIn;
  }
}

export function coachLoadSummary(
  band: BandVerdict | null,
  isDeloadWeek = false,
): string {
  switch (band) {
    case 'below': return isDeloadWeek
      ? COACH_DASHBOARD_COPY.loadDeload
      : COACH_DASHBOARD_COPY.loadBelow;
    case 'in': return COACH_DASHBOARD_COPY.loadIn;
    case 'above': return COACH_DASHBOARD_COPY.loadAbove;
    default: return COACH_DASHBOARD_COPY.loadUnavailable;
  }
}

export function coachLoadGuidance(
  band: BandVerdict | null,
  isDeloadWeek = false,
): string {
  if (band === null) return COACH_DASHBOARD_COPY.loadHistoryGuidance;
  if (band === 'below' && isDeloadWeek) return COACH_DASHBOARD_COPY.loadDeloadGuidance;
  return COACH_DASHBOARD_COPY.loadSweetSpotGuidance;
}

export function coachLoadEvidence(coverage: JournalLoadCoverage | null): string | null {
  if (!coverage) return null;
  return `${coverage.sessionsMeasured} of ${coverage.sessionsPlanned} sessions measured`;
}

export function coachProgressValue(lift: StrengthLiftTrend | null): string {
  if (!lift) return COACH_DASHBOARD_COPY.noProgress;
  const weight = Number.isInteger(lift.thisWeek.weightKg)
    ? String(lift.thisWeek.weightKg)
    : lift.thisWeek.weightKg.toFixed(1);
  return `${lift.exerciseName} · ${weight} kg`;
}

export function coachProgressDirection(direction: StrengthTrendDirection | null): string | null {
  switch (direction) {
    case 'up': return COACH_DASHBOARD_COPY.progressUp;
    case 'flat': return COACH_DASHBOARD_COPY.progressFlat;
    case 'down': return COACH_DASHBOARD_COPY.progressDown;
    case 'new': return COACH_DASHBOARD_COPY.progressNew;
    default: return null;
  }
}

export function coachRestrictionCount(count: number): string {
  if (count === 0) return COACH_DASHBOARD_COPY.noRestrictions;
  return count === 1 ? '1 active' : `${count} active`;
}
