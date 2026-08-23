/**
 * BATCH 38 — COACH SNAPSHOT DASHBOARD. SIGNED 2026-08-24.
 *
 * Sam named the five sections: this week, readiness, load, progress and
 * restrictions. Sam reviewed the first dashboard and signed all wording:
 * "the wording is fine". The first layout was rejected and is being redesigned.
 */

import type { CoachSnapshotReadinessState } from './liveAthleteSnapshot';
import type { BandVerdict, JournalLoadCoverage } from './journalLoad';
import type { JournalWork } from './journalWeek';
import type { StrengthLiftTrend, StrengthTrendDirection } from './journalStrengthTrend';

export const COACH_DASHBOARD_COPY = {
  title: 'Coach snapshot',
  thisWeek: 'This week',
  readiness: 'Readiness',
  load: 'Load',
  progress: 'Progress',
  restrictions: 'Restrictions',
  noSessions: 'No sessions planned this week.',
  noCheckIn: 'No check-in today',
  readinessGood: 'Feeling good',
  readinessFlat: 'Feeling flat',
  readinessSore: 'Feeling sore',
  readinessRecorded: 'Check-in recorded',
  loadUnavailable: 'Not enough recorded load yet',
  loadBelow: 'Below your usual range',
  loadIn: 'In your usual range',
  loadAbove: 'Above your usual range',
  noProgress: 'No lifts recorded this week',
  progressUp: 'Up from last week',
  progressFlat: 'Same as last week',
  progressDown: 'Down from last week',
  progressNew: 'No last-week comparison',
  noRestrictions: 'None active',
} as const;

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

export function coachLoadSummary(band: BandVerdict | null): string {
  switch (band) {
    case 'below': return COACH_DASHBOARD_COPY.loadBelow;
    case 'in': return COACH_DASHBOARD_COPY.loadIn;
    case 'above': return COACH_DASHBOARD_COPY.loadAbove;
    default: return COACH_DASHBOARD_COPY.loadUnavailable;
  }
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
