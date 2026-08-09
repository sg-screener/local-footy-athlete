/**
 * WHICH DECISIONS A REPLAY REPLAYS — the reversal's honouring, in one pure place.
 *
 * LR-29's undo. `types/decisionLedger.ts` has declared the kind since R1.1 —
 * *"Undo is a decision too: a reversal APPENDS, it never rewrites"* — and
 * `quiescentBoot` has returned early on it ever since, because no producer
 * existed. This module is what that early return was waiting for.
 *
 * WHY IT IS A RULE AND NOT A BRANCH IN THE BOOT. Undo has to mean the same
 * thing in two places that must never disagree: the moment the athlete taps
 * (re-derive now) and every relaunch afterwards (re-derive again). Those are
 * already ONE body — `settleDerivedWorldAfterDecision` and the boot both call
 * `rebuildDerivedWorld` — and this keeps them one by deciding the replay SET in
 * a function neither owns. A second copy of "which entries still count" is the
 * defect class this repo names most.
 *
 * WHY IT IS A FILTER AND NOT AN INVERSE. An undo does not compute the opposite
 * of a decision and apply it. It removes the decision from the input set and
 * lets the world be derived again from what is left. That is the north star's
 * own move — the ledger holds decisions, the week is derived — and the undo
 * route tape (`docs/LR29_UNDO_ROUTE_TAPE_2026-08-09.md`) measured why it is
 * also the only one that can complete: `acceptedStateTransaction.ts:509` holds
 * a RESTORATION to a stricter standard than the act it reverses, and a
 * re-derivation is a forward derivation, so it never meets that arm.
 */

import type { DecisionLedgerEntry } from '../types/decisionLedger';

/**
 * The ids this ledger has annulled.
 *
 * FIVE CONDITIONS, EACH DECIDED RATHER THAN LEFT TO FALL OUT OF THE CODE:
 *
 * 1. A `reversal` names exactly one entry, and that entry is annulled.
 * 2. A reversal naming an id **not in the ledger** is INERT, not an error. The
 *    ledger is append-only, but a partially-restored or quarantine-repaired
 *    payload must not be able to brick a boot — and a boot that throws here
 *    takes the athlete's whole world with it.
 * 3. **There is no redo, and it needs no guard — which is worth stating,
 *    because the first version of this function carried one.** A guard that
 *    skipped reversal-targeting-reversal was written, gated, and then found by
 *    mutation to be incapable of changing any output: reversals are dropped
 *    from the replay set by KIND anyway, so annulling one is a no-op. It was a
 *    representation that could not be observed, which is the north star's own
 *    objection, so it is gone. No-redo now falls out of two facts instead of
 *    being asserted by a third: a reversal is never replayed, and annulment is
 *    a set membership that nothing removes.
 * 4. Annulling the same entry twice is annulling it once.
 * 5. Order does not matter — a reversal is honoured whether it was appended
 *    before or after anything else. It names its target by id, never by
 *    position, so a replay cannot depend on the ledger's ordering to be
 *    correct about what still counts.
 */
export function annulledEntryIds(
  entries: readonly DecisionLedgerEntry[],
): ReadonlySet<string> {
  const annulled = new Set<string>();
  const present = new Set(entries.map((entry) => entry.id));
  for (const entry of entries) {
    if (entry.decision.kind !== 'reversal') continue;
    const target = entry.decision.reversedEntryId;
    if (!present.has(target)) continue;      // (2) inert, never fatal
    annulled.add(target);                    // (4) a Set makes this idempotent
  }
  return annulled;
}

/**
 * The entries a replay actually replays, in ledger order.
 *
 * A reversal is never replayed — it is not an action, it is a statement ABOUT
 * one, and its whole effect is the absence it creates here.
 */
export function replayableEntries(
  entries: readonly DecisionLedgerEntry[],
): DecisionLedgerEntry[] {
  const annulled = annulledEntryIds(entries);
  return entries.filter((entry) =>
    entry.decision.kind !== 'reversal' && !annulled.has(entry.id));
}

/**
 * The entries an athlete could still undo — the same set, which is the point.
 *
 * "What can be undone" and "what still counts" are one question. If they were
 * computed separately the app could offer to undo something the world had
 * already stopped replaying, which is a button that appears to do nothing.
 */
export function undoableEntries(
  entries: readonly DecisionLedgerEntry[],
): DecisionLedgerEntry[] {
  return replayableEntries(entries);
}

/**
 * THE LAST CHANGE — the one thing Sam's ruling names.
 *
 * *"it should be last change i think?"* (2026-08-09). Newest by ledger ORDER,
 * not by `occurredAt`: the ledger is append-only and its order is the order
 * things happened, while `occurredAt` is a device clock that can move
 * backwards across a timezone change or a manual clock set. A undo that picks
 * its target by wall-clock would undo the wrong change on the one day a year
 * the clock goes back.
 */
export function lastUndoableEntry(
  entries: readonly DecisionLedgerEntry[],
): DecisionLedgerEntry | null {
  const undoable = undoableEntries(entries);
  return undoable.length > 0 ? undoable[undoable.length - 1]! : null;
}
