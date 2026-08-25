/**
 * lighterDayTransaction — apply the readiness "make today lighter" trim through
 * the accepted-state transaction owner, as a reversible, disclosed, day-scoped
 * adjustment.
 *
 * Ownership (docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md, part c):
 * the lighter-day offer is a program mutation and belongs to the SAME owner
 * Move/Bin/Swap use — it reuses the `explicit_load_edit` reversible-ledger idiom
 * (`captureAcceptedLoadEditLedgerBaseline` → write → record), so it is
 * transaction-committed, undoable via `clearReversibleAdjustment`, and never
 * touches `weightOverrides`, keeping the progression baseline untouched (see
 * the R5 progression guard).
 *
 * ─── THE CHANNEL CHANGED, THE EXPERIENCE DID NOT (Sam, Option C item 4) ──────
 *
 * > "Lighter-day converts to a derived effect of its recorded readiness fact
 * >  through the ruled deriving lane (the decision is already in the ledger;
 * >  the stored trim becomes a derivation)."
 *
 * The trim used to land in `dateOverrides` under the writer id `lighter_day`.
 * That surface is the ATHLETE'S DECISION LEDGER — `rebaseAcceptedEffectiveWeek`
 * says so in its own comment and the whole precedence stack is built on it
 * meaning that. A volume trim derived from a readiness fact is not a decision;
 * it is what the app DID ABOUT one. The decision was already recorded, in the
 * fact itself and in the reversible-adjustment entry keyed on its `sourceFactId`.
 * Storing the derived output beside the input is the north star's named defect:
 * a stored output that can go stale beside the fact it came from.
 *
 * It now writes a SPARSE WEEK OVERLAY (`reason: 'readiness_reduction'`) —
 * the surface `programStore.ts:1179-1190` already declares to be "derived
 * content authored by a fact, not by the athlete", the same surface the derived
 * §18 repair was moved to for the same reason (Sam, 2026-07-30).
 *
 * NOTHING THE ATHLETE SEES CHANGES: same `applyLighterDayTrim`, same refusal on
 * an empty change set, same disclosure copy, same reversible-adjustment record,
 * same generic cascade-undo on `sourceFactId`. This unit changes the CHANNEL.
 *
 * `'lighter_day'` is retired from `ProgramOverrideWriterId`, so a future
 * lighter-day override write is a COMPILE ERROR rather than a review comment.
 * With it gone and the athlete re-add routes retired (Task A), NO
 * athlete-reachable door writes `dateOverrides` any more — the surface is
 * coach-pipeline-only, and the coach share is frozen under LR-6.
 */

import type { WeekScopedWorkoutOverlay } from '../types/domain';
import { useProgramStore } from '../store/programStore';
import { mondayForDate } from '../rules/dayPrecedence';
import {
  captureAcceptedLoadEditLedgerBaseline,
  commitExplicitLoadEditLedgerFromBaseline,
} from '../store/acceptedStateTransaction';
import { resolveDateWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyLighterDayTrim, lighterDayTrimAvailable } from '../utils/lighterDayTrim';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { selectReadinessFactForDate } from '../rules/temporarySourceFact';

export interface ApplyLighterDayResult {
  ok: boolean;
  message: string;
  changes: string[];
  adjustmentId?: string;
}

/** The Sunday of the week `weekStart` opens. Monday arithmetic is `dayPrecedence`'s. */
function endOfWeek(weekStart: string): string {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function discloseChanges(changes: string[]): string {
  if (changes.length === 0) return "Today's already light — nothing to trim.";
  const list = changes.join(', ');
  // Point the undo promise at the mechanism that reverts it.
  return `Kept today's session but made it lighter: ${list}. You can undo this anytime by clearing "Not 100% today".`;
}

/**
 * The fact this trim links to, so clearing it cascade-reverts the trim.
 *
 * THE ATHLETE'S TAP IS THE DECISION (Sam's D-3 ruling, 2026-08-05). The
 * readiness door returns the id of the fact it just authored and the offer
 * carries it here, so the normal path STORES a decision rather than deriving
 * one. This used to re-guess the fact from the date by taking the first match
 * in an alphabetically-sorted array — an ordering nobody authored, deciding an
 * athlete-visible undo link.
 *
 * The fallback is not that guess: it is `selectReadinessFactForDate`, the one
 * owner the readiness card also asks, so the trim's link and the card's Clear
 * button can never disagree about which fact is today's.
 */
function resolveSourceFactId(args: {
  suppliedFactId?: string;
  date: string;
  todayISO: string;
}): string | undefined {
  if (args.suppliedFactId) return args.suppliedFactId;
  const facts = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext).temporarySourceFacts;
  return selectReadinessFactForDate({
    facts, dateISO: args.date, todayISO: args.todayISO,
  })?.factId;
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
  /**
   * The fact the athlete just authored, carried from the door that created it.
   * Passing it is the whole of Sam's D-3 ruling: a stored decision, not a
   * re-derivation. Omitted only by callers that have no tap in hand.
   */
  sourceFactId?: string;
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

  // SPARSE, and MERGED rather than replaced. A week can already carry an
  // overlay — a scoped regen, a team-night relocation — and `setWeekScopedOverlay`
  // replaces the whole week entry, so authoring a fresh one here would silently
  // discard whatever else the week's fact-derived content was. Only this date's
  // entry is added; every other day the overlay already spoke for is conserved
  // byte-for-byte by construction.
  const weekStart = mondayForDate(args.date);
  const now = new Date().toISOString();
  const existing = (useProgramStore.getState().weekScopedOverlays ?? {})[weekStart] ?? null;
  const overlay: WeekScopedWorkoutOverlay = {
    ...(existing ?? {
      id: `readiness-lighter-day:${weekStart}`,
      weekStart,
      weekEnd: endOfWeek(weekStart),
      anchorDate: null,
      reason: 'readiness_reduction' as const,
      workoutsByDate: {},
      createdAt: now,
      updatedAt: now,
    }),
    workoutsByDate: {
      ...(existing?.workoutsByDate ?? {}),
      [args.date]: trimmed,
    },
    updatedAt: now,
  };
  useProgramStore.getState().setWeekScopedOverlay(overlay);

  const record = commitExplicitLoadEditLedgerFromBaseline({
    baseline,
    sourceActionOrIntentId: `readiness_lighter_day:${args.date}`,
    affectedDates: [args.date],
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
    // Link the trim to the readiness fact that offered it, so clearing that fact
    // cascade-reverts this adjustment generically.
    sourceFactId: resolveSourceFactId({
      suppliedFactId: args.sourceFactId,
      date: args.date,
      todayISO: args.todayISO,
    }),
  });

  return {
    ok: true,
    message: discloseChanges(changes),
    changes,
    adjustmentId: record?.id,
  };
}

/**
 * Is there anything the lighter-day trim could do for `date`? Same resolver
 * lens as `applyLighterDayForToday`, same pure predicate as the trim — so the
 * OFFER and the APPLY cannot disagree. Offered-then-refused ("There is no
 * session to lighten today") was launch-audit finding #8's dead-end.
 */
export function lighterDayAvailableForDate(date: string): boolean {
  const resolved = resolveDateWithConditioning(date, buildScheduleStateImperative());
  return lighterDayTrimAvailable(resolved?.workout);
}
