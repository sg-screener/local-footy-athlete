/**
 * lighterDayTransaction — apply the readiness "make today lighter" trim through
 * the accepted-state transaction owner, as a reversible, disclosed, day-scoped
 * adjustment.
 *
 * Ownership (docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md, part c):
 * the lighter-day offer is a program mutation and belongs to the SAME owner
 * Move/Bin/Swap use — it reuses the `explicit_load_edit` reversible-ledger idiom
 * (`captureAcceptedLoadEditLedgerBaseline` → `setManualOverride` → record), so it
 * is transaction-committed, undoable via `clearReversibleAdjustment`, and its
 * trim lands in `dateOverrides` (NOT `weightOverrides`), keeping the progression
 * baseline untouched (see the R5 progression guard).
 */

import type { OverrideContext } from '../types/domain';
import { useProgramStore } from '../store/programStore';
import {
  captureAcceptedLoadEditLedgerBaseline,
  commitExplicitLoadEditLedgerFromBaseline,
} from '../store/acceptedStateTransaction';
import { resolveDateWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyLighterDayTrim } from '../utils/lighterDayTrim';

export interface ApplyLighterDayResult {
  ok: boolean;
  message: string;
  changes: string[];
  adjustmentId?: string;
}

function discloseChanges(changes: string[]): string {
  if (changes.length === 0) return "Today's already light — nothing to trim.";
  const list = changes.join(', ');
  return `Kept today's session but made it lighter: ${list}. You can undo this anytime.`;
}

/**
 * Trim TODAY's session lighter (Bible §9 slight tier) and commit it as a
 * reversible adjustment through the accepted-state transaction. Returns the
 * disclosure + the reversible adjustment id (for undo). Opt-in: only called when
 * the athlete accepts the offer.
 */
export async function applyLighterDayForToday(args: {
  date: string;
  todayISO: string;
}): Promise<ApplyLighterDayResult> {
  const resolved = resolveDateWithConditioning(args.date, buildScheduleStateImperative());
  const workout = resolved?.workout;
  if (!workout || (workout.exercises ?? []).length === 0) {
    return { ok: false, message: 'There is no session to lighten today.', changes: [] };
  }

  const { workout: trimmed, changes } = applyLighterDayTrim(workout);
  if (changes.length === 0) {
    return { ok: false, message: "Today's already light — nothing to trim.", changes: [] };
  }

  const baseline = captureAcceptedLoadEditLedgerBaseline();
  const overrideContext: OverrideContext = { intent: 'program_adjustment' } as OverrideContext;
  useProgramStore.getState().setManualOverride(args.date, trimmed, overrideContext);

  const record = commitExplicitLoadEditLedgerFromBaseline({
    baseline,
    sourceActionOrIntentId: `readiness_lighter_day:${args.date}`,
    affectedDates: [args.date],
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
  });

  return {
    ok: true,
    message: discloseChanges(changes),
    changes,
    adjustmentId: record?.id,
  };
}
