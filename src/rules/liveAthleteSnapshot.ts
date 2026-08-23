/**
 * ONE LIVE PICTURE OF THE ATHLETE FOR EVERY COACH SURFACE.
 *
 * The dashboard and conversation receive this value. It is derived from the
 * visible week and the existing Journal/readiness/modifier owners, never saved
 * and never allowed to invent a second account of any of them.
 */

import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import {
  getReadinessQuickOption,
  type ReadinessQuickOption,
  type ReadinessSignal,
} from '../utils/readiness';
import type { VisibleWeek } from './visibleProjection';
import type { JournalWeek } from './journalWeek';
import {
  signedValue,
  type JournalLoadCoverage,
  type JournalLoadHeadline,
  type JournalLoadModel,
} from './journalLoad';
import type { StrengthLiftTrend } from './journalStrengthTrend';

export type CoachSnapshotReadinessState =
  | ReadinessQuickOption
  | 'recorded'
  | 'not_recorded';

export interface CoachSnapshotReadiness {
  readonly state: CoachSnapshotReadinessState;
  readonly signal: ReadinessSignal | null;
}

export interface CoachSnapshotLoad {
  readonly headline: JournalLoadHeadline | null;
  readonly sweetSpotBand: { readonly low: number; readonly high: number } | null;
  readonly coverage: JournalLoadCoverage | null;
}

export interface CoachSnapshot {
  /** The date whose readiness answer this picture carries. */
  readonly asOfDateISO: string;
  /** The one projection every Coach reader uses. */
  readonly visibleWeek: VisibleWeek;
  /** Existing Journal week facts, derived over that exact projection. */
  readonly thisWeek: JournalWeek;
  readonly readiness: CoachSnapshotReadiness;
  readonly load: CoachSnapshotLoad;
  readonly progress: readonly StrengthLiftTrend[];
  readonly restrictions: readonly ActiveCoachNote[];
}

export interface BuildCoachSnapshotInput {
  readonly asOfDateISO: string;
  readonly visibleWeek: VisibleWeek;
  readonly journalWeek: JournalWeek;
  readonly loadModel: JournalLoadModel;
  readonly strengthLifts: readonly StrengthLiftTrend[];
  readonly readinessSignal: ReadinessSignal | null;
  readonly activeModifiers: readonly ActiveCoachNote[];
}

function readinessState(
  signal: ReadinessSignal | null,
): CoachSnapshotReadinessState {
  if (!signal) return 'not_recorded';
  return getReadinessQuickOption(signal) ?? 'recorded';
}

/**
 * Build the ephemeral picture. Week mismatches refuse instead of presenting
 * three individually-correct derivations as though they described one week.
 */
export function buildCoachSnapshot(input: BuildCoachSnapshotInput): CoachSnapshot {
  const weekStart = input.visibleWeek.weekStart;
  if (input.journalWeek.weekStart !== weekStart || input.loadModel.weekStart !== weekStart) {
    throw new Error('Coach Snapshot inputs must describe the same visible week.');
  }
  if (input.readinessSignal && input.readinessSignal.date !== input.asOfDateISO) {
    throw new Error('Coach Snapshot readiness must describe its as-of date.');
  }

  return {
    asOfDateISO: input.asOfDateISO,
    visibleWeek: input.visibleWeek,
    thisWeek: input.journalWeek,
    readiness: {
      state: readinessState(input.readinessSignal),
      signal: input.readinessSignal,
    },
    load: {
      headline: signedValue(input.loadModel.headline),
      sweetSpotBand: signedValue(input.loadModel.sweetSpotBand),
      coverage: signedValue(input.loadModel.coverage),
    },
    progress: [...input.strengthLifts],
    restrictions: [...input.activeModifiers],
  };
}
