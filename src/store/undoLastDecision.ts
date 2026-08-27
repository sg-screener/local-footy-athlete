/**
 * THE UNDO DOOR — the reversal producer LR-29 named as its heir.
 *
 * Sam ruled the shape on 2026-08-09: **UNDO LAST CHANGE, one step.**
 * (`docs/UNDO_SHAPE_RULING_2026-08-09.md`)
 *
 * THE WHOLE MECHANISM IS TWO LINES, AND THAT IS THE POINT:
 *
 *   1. append `{ kind: 'reversal', reversedEntryId }`   — a decision, not a write
 *   2. re-derive                                        — the door that already exists
 *
 * There is no inverse-operation to compute, no snapshot to restore, and NO NEW
 * STORED STATE. The week after an undo is not "the week put back"; it is the
 * week the REMAINING decisions imply, derived by the same body that derives it
 * at boot. That is why the undo survives a relaunch without anything being
 * persisted about the undo itself beyond the one appended entry.
 *
 * WHY NOT RESTORE THE STORED SNAPSHOT — measured, not preferred.
 * `docs/LR29_UNDO_ROUTE_TAPE_2026-08-09.md`: the snapshot route
 * (`clearReversibleAdjustment`) was refused by
 * `acceptedStateTransaction.ts:509` while the IDENTICAL unwinding expressed as
 * a forward decision landed and reproduced the week exactly. Accept-and-reduce
 * is FORWARD ONLY; a restoration throws where a forward derivation is accepted
 * and its shortfall disclosed. **A re-derivation is a forward derivation**, so
 * this route never meets that arm.
 *
 * A DECISION IS NOT ALWAYS THE ONLY THING A DECISION WRITES — and that was
 * measured here, on this door, before it was fixed. `move_session` also wrote a
 * calendar `rest` mark, which is not a ledger decision, so annul + re-derive
 * left it behind and the undone week was not the pre-change week.
 *
 * IT WAS NOT PATCHED HERE, and that is the point worth keeping. Reaching into
 * the calendar store from this door would have given the mark a second owner
 * and put a per-decision-kind special case in the one door that must stay
 * kind-agnostic. **The write was removed at its source instead**
 * (`acceptedStateTransaction`, 2026-08-09) — under a ruling Sam had already
 * made for the sibling deletion door on 2026-07-30, and because the move's own
 * constraint already owned the emptiness through the canonical rest stub. One
 * of two representations went; nothing was added to this door.
 *
 * THE CLASS IS OPEN EVEN THOUGH THIS INSTANCE IS CLOSED. Undo is complete for
 * `move_session` and is UNPROVEN for every other kind: a second non-ledger
 * side-writer would produce the identical symptom somewhere else. The seat's
 * LOOP CHECK `side-writer-outside-the-ledger` is at sighting 1, and its
 * compression rule is a census of decision side-writers rather than another
 * per-kind fix.
 *
 * WHAT THIS DOOR DOES NOT COVER, by the kickoff addendum's own boundary:
 * recorded FACTS. A logged session outcome or a journal note is not a program
 * decision, it is not on this ledger, and it is untouched by every path here.
 * **A logged session never silently vanishes**, and it cannot: nothing in this
 * file can reach the stores that hold them.
 */

import { appendDecisionEntry, decisionLedgerEntries } from './decisionLedgerStore';
import { restoreExcludedExercise } from '../utils/exerciseExclusionOwner';
import { replayableEntries } from '../rules/decisionLedgerReplay';
import { lastUndoableEntry, undoableEntries } from '../rules/decisionLedgerReplay';
import { rebuildDerivedWorldNow } from './quiescentBoot';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { todayISOLocal } from '../utils/appDate';
import type { DecisionLedgerEntry } from '../types/decisionLedger';

export type UndoOutcome =
  /** The reversal landed and the world was re-derived from what remains. */
  | { outcome: 'undone'; reversedEntryId: string; reversalEntryId: string }
  /** Nothing to undo — an honest state, never an error. */
  | { outcome: 'nothing_to_undo' }
  /** The ledger owner refused the append. The world is untouched. */
  | { outcome: 'refused'; reason: string };

/**
 * WHAT THE SURFACE ASKS BEFORE IT DRAWS ANYTHING.
 *
 * Returns the decision an undo would annul, or null. The TOAST — undo's only
 * screen-level affordance after the 2026-08-09 surface ruling killed the
 * standing bar — renders from this and from nothing else, so nothing appears
 * unless it has something to say.
 *
 * READ-ONLY BY CONSTRUCTION: this is the same set the replay uses, so the
 * surface can never offer to undo something the world has already stopped
 * replaying.
 */
export function pendingUndoTarget(): DecisionLedgerEntry | null {
  return lastUndoableEntry(decisionLedgerEntries());
}

/** How many decisions remain undoable. The surface needs none of this; the gates do. */
export function undoableDecisionCount(): number {
  return undoableEntries(decisionLedgerEntries()).length;
}

/**
 * UNDO THE LAST CHANGE.
 *
 * `await`s the re-derivation, so a caller that resolves has a world already
 * rebuilt — the same guarantee `executeProgramControlActionDurably` gives for
 * a forward decision. An undo that returned before its world settled would put
 * the athlete on a screen showing the change they just removed.
 */
/**
 * ANNUL AN OUTSTANDING REMOVAL FOR ONE EXERCISE — RESTORE'S OTHER HALF.
 *
 * THE MIRROR OF THE UNDO DEFECT, FOUND THE SAME WAY. A removal writes two facts:
 * the program-control action on the ledger and the canonical exclusion in
 * athlete preferences. `restoreExcludedExercise` clears the second. Measured on
 * device 2026-08-19, after tapping the labelled "Restore exercise" control:
 *
 *   EXCLUSIONS AFTER RESTORE: []                        <- cleared, correctly
 *   LEDGER: ['dl-1:program_control/remove_exercise']    <- STILL UN-ANNULLED
 *
 * so the day override kept replaying and Back Squat did not come back. Restore
 * reported success over a session that had not changed.
 *
 * IT IS THE SAME REVERSAL MECHANISM, NOT A SECOND ONE: the identical
 * `{ kind: 'reversal', reversedEntryId }` decision `undoLastDecision` appends,
 * aimed at a named entry instead of the newest. Nothing else can annul a ledger
 * entry, and nothing here writes to a store directly.
 *
 * A world with no outstanding removal for that exercise is the ordinary case —
 * an exclusion written by the coach has no ledger entry — and returns false
 * without appending anything.
 */
export function annulOutstandingRemovalFor(exercise: string): boolean {
  const identity = String(exercise ?? '').trim().toLowerCase();
  if (!identity) return false;
  // Newest first: only the outstanding one matters, and `replayableEntries`
  // has already dropped anything a previous reversal annulled.
  const target = [...replayableEntries(decisionLedgerEntries())].reverse().find((entry) => {
    const decision = entry.decision;
    if (decision.kind !== 'program_control') return false;
    if (decision.action.type !== 'remove_exercise') return false;
    const named = (decision.action.payload as { exercise?: unknown } | undefined)?.exercise;
    return typeof named === 'string' && named.trim().toLowerCase() === identity;
  });
  if (!target) return false;
  return appendDecisionEntry({
    decision: { kind: 'reversal', reversedEntryId: target.id },
    provenance: 'athlete_tap',
    writer: 'undo_door',
  }).ok;
}

export async function undoLastDecision(): Promise<UndoOutcome> {
  const target = pendingUndoTarget();
  if (!target) return { outcome: 'nothing_to_undo' };
  const transaction = await runCoachMutationTransaction({
    todayISO: todayISOLocal(),
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      // The queued door must still own the decision the athlete asked to undo.
      if (pendingUndoTarget()?.id !== target.id) throw new Error('undo_target_changed');
      const appended = appendDecisionEntry({
        decision: { kind: 'reversal', reversedEntryId: target.id },
        provenance: 'athlete_tap', writer: 'undo_door',
      });
      if (!appended.ok) return appended;
      const reversed = target.decision;
      if (reversed.kind === 'program_control' && reversed.action.type === 'remove_exercise') {
        const exercise = reversed.action.payload?.exercise;
        if (typeof exercise === 'string' && exercise.trim()) restoreExcludedExercise(exercise);
      }
      // Same synchronous compiler used by accepted fact changes and reopening.
      // The ledger, exclusion input and generated candidate commit together.
      rebuildDerivedWorldNow();
      return appended;
    },
    didApply: value => value.ok,
  });
  if (transaction.ok === false) return { outcome: 'refused', reason: transaction.reason };
  return { outcome: 'undone', reversedEntryId: target.id,
    reversalEntryId: transaction.value.entry?.id ?? '' };
}
