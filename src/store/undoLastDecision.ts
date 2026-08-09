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
 * ⚠ UNDO IS NOT COMPLETE FOR A `move_session`, AND THAT IS MEASURED RATHER
 * THAN SUSPECTED. `npm run tape:lr29-undo-durability`, 2026-08-09: a move also
 * writes a calendar `rest` mark on the source day. **A calendar mark is not a
 * ledger decision**, so annulling the decision and re-deriving leaves the mark
 * behind — the source day stays empty and the session stays where it was moved
 * to. The reversal IS honoured (the annulled decision is never replayed, before
 * or after a relaunch); the world simply has a second author for the same act.
 *
 * This is the dependency list's §3 fork arriving in the athlete's most visible
 * feature: *"the replay's input set is the ledger PLUS the fact stores."*
 * **It is NOT patched here.** Making this door reach into the calendar store
 * would give the mark a second owner and put the special case exactly where
 * this repo's rules say it must not go. It needs an ownership ruling —
 * `docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md` §4 states the options.
 *
 * WHAT THIS DOOR DOES NOT COVER, by the kickoff addendum's own boundary:
 * recorded FACTS. A logged session outcome or a journal note is not a program
 * decision, it is not on this ledger, and it is untouched by every path here.
 * **A logged session never silently vanishes**, and it cannot: nothing in this
 * file can reach the stores that hold them.
 */

import { appendDecisionEntry, decisionLedgerEntries } from './decisionLedgerStore';
import { lastUndoableEntry, undoableEntries } from '../rules/decisionLedgerReplay';
import { settleDerivedWorldAfterDecision } from './quiescentBoot';
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
 * Returns the decision an undo would annul, or null. The bar in the mock
 * renders from this and from nothing else — *"nothing appears unless it has
 * something to say"*, the journal front page's law, applied to an affordance
 * rather than a block.
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
export async function undoLastDecision(): Promise<UndoOutcome> {
  const target = pendingUndoTarget();
  if (!target) return { outcome: 'nothing_to_undo' };

  const appended = appendDecisionEntry({
    decision: { kind: 'reversal', reversedEntryId: target.id },
    provenance: 'athlete_tap',
    writer: 'undo_door',
  });
  // THE APPEND IS THE COMMIT. If the ledger owner refused, nothing has changed
  // and nothing needs unwinding — which is the property that makes this door
  // safe without a transaction of its own. There is no half-applied undo.
  if (!appended.ok) {
    return { outcome: 'refused', reason: appended.reason ?? 'ledger_refused_append' };
  }
  // A REPLAY MUST NOT RE-ENTER ITSELF. The settle door already refuses while a
  // ledger replay is in flight, which is also why undo is not reachable from
  // inside a replay: a reversal appended during one would be a decision made by
  // a boot, and the plan's §2 says a boot decides nothing.
  await settleDerivedWorldAfterDecision();
  return {
    outcome: 'undone',
    reversedEntryId: target.id,
    reversalEntryId: appended.entry?.id ?? '',
  };
}
