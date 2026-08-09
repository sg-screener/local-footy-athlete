/**
 * THE UNDO TOAST — undo's only screen-level affordance, as a pure model.
 *
 * Ruled 2026-08-09 (`docs/UNDO_SURFACE_RULING_2026-08-09.md`). Sam, on the
 * mock: *"the coach should be its own tab and the athlete just talks to it when
 * it wants to change something."* The standing bar and the confirm sheet died
 * there; the transient toast survived, because it is the one shape that does
 * not build a second change-interface beside the coach.
 *
 * WHY THIS IS DERIVED FROM THE LEDGER AND NOT RAISED BY THE DOORS.
 * `useHomeScreen` alone lands athlete changes through
 * `executeProgramControlActionDurably` at TEN call sites. A toast raised at
 * each one is ten places to forget, ten places to word differently, and ten
 * places a later door would not know to join. **Every landed decision already
 * appends exactly one ledger entry** — so the toast is a READING of the ledger,
 * and a door that lands a change gets its toast by existing rather than by
 * remembering. A coach-authored change would appear here for free, which is why
 * whether it SHOULD is parked to the coach kickoff rather than answered by a
 * missing wire.
 *
 * ZERO NEW STORED STATE. The only thing the surface holds is "which entry have
 * I already shown" — session-scoped presentation state, thrown away with the
 * screen, never persisted.
 *
 * THE WORDS ARE NOT THIS MODULE'S. `phraseFor` is imported from
 * `rules/journalChanges` — the owner that already turns a decision into the
 * athlete's words, and whose `default: return null` is the honest-outcome law:
 * an unmapped decision kind shows NO toast rather than its code name. A second
 * vocabulary here would be a rival for the same question, which is the defect
 * the week-job slice already refused once.
 */

import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { phraseFor } from './journalChanges';
import { lastUndoableEntry } from './decisionLedgerReplay';

export interface UndoToastModel {
  /** The entry an Undo tap would annul. */
  entryId: string;
  /** The athlete's sentence for what just happened. */
  sentence: string;
}

/**
 * The toast to show, or null.
 *
 * `lastSeenEntryId` is what the surface has already shown. A toast appears only
 * when the newest undoable decision CHANGES — which is what makes it transient
 * without consulting a clock.
 *
 * WHY NOT A TIMESTAMP WINDOW. The first version compared `occurredAt` against
 * now. That is a device clock: it moves backwards across a timezone change, and
 * it means a relaunch three seconds after a change raises a toast for something
 * the athlete did in a previous session. Identity comparison has neither
 * failure, and it is the same reason `lastUndoableEntry` picks by ledger order.
 */
export function undoToastFor(
  entries: readonly DecisionLedgerEntry[],
  lastSeenEntryId: string | null,
): UndoToastModel | null {
  const target = lastUndoableEntry(entries);
  if (!target) return null;
  if (target.id === lastSeenEntryId) return null;
  const sentence = phraseFor(target);
  // AN UNMAPPED KIND SHOWS NOTHING. It is still undoable through the coach; it
  // simply has no honest one-line name, and a code name on an athlete's screen
  // is the thing the honest-outcome law exists to prevent.
  if (!sentence) return null;
  return { entryId: target.id, sentence };
}

/**
 * What the surface should record as seen once a toast has been shown OR the
 * athlete has undone it — in both cases the newest undoable entry.
 *
 * After an undo the target is annulled, so this returns the entry BEFORE it (or
 * null). That is what stops an undo from immediately raising a toast for the
 * change it just revealed — the athlete asked for one step, and one step is
 * what they get.
 */
export function undoToastSeenMarker(
  entries: readonly DecisionLedgerEntry[],
): string | null {
  return lastUndoableEntry(entries)?.id ?? null;
}
