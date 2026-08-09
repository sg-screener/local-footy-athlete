/**
 * WHAT CHANGED THIS WEEK — addendum Group 1 item 2, and the last unbuilt item in
 * the Journal unit.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock.
 *
 * ZERO NEW STORED STATE. The decision ledger is already an INPUT — the athlete's
 * own decisions, appended and never rewritten. This reads them.
 *
 * ── THE HALF THIS CAN ANSWER, AND THE HALF IT CANNOT ──
 *
 * `AthleteDecision` is a closed union of things the ATHLETE did: plan changes,
 * fixture adds/removes/moves, and reversals. **Nothing in it expresses "the app
 * changed your week because you were ill, or injured, or your readiness dropped,
 * or the phase shifted."** The LR-29 dependency list measured that gap before
 * this unit began, and it is unchanged.
 *
 * So a list built from this ledger is COMPLETE about the athlete's decisions and
 * SILENT about the app's — and the silence is the dangerous part, because a list
 * that looks complete implies the app changed nothing.
 *
 * **`appChangesUnavailable` is therefore not a flag, it is the point.** The
 * surface must say so out loud. This is rider 1 one level up: the same law that
 * makes the Journal say "no reason recorded" rather than inventing a why.
 *
 * ── AND IT DOES NOT ANSWER "WHAT WAS PROTECTED" AT ALL ──
 *
 * The app's answer to that is `section18ShortfallDisclosure` — Sam's signed
 * sentence, shown at the DOOR at the moment of a decision. **The ledger does not
 * store what was protected**, and re-deriving it for a past week would re-run the
 * decision against a week that has since changed: a reconstruction, not a
 * record. Recording it is an engine-side change to the decision doors, not a
 * Journal change.
 */

import type { DecisionLedgerEntry } from '../types/decisionLedger';

/** One thing the athlete did, in their own words. */
export interface JournalChange {
  readonly entryId: string;
  readonly occurredAt: string;
  /** The athlete-facing phrase. Never a `kind` string. */
  readonly what: string;
}

export interface JournalChanges {
  readonly changes: readonly JournalChange[];
  /**
   * ALWAYS TRUE TODAY, and it is a statement rather than a flag: the ledger has
   * no vocabulary for illness / injury / readiness / phase, so changes the APP
   * made for those reasons are not in this list and cannot be. The surface says
   * so; it does not let the list imply completeness.
   */
  readonly appChangesUnavailable: true;
}

/**
 * The athlete's word for one decision.
 *
 * A `kind` STRING IS NEVER RENDERED. `remove_session` is internal vocabulary and
 * the honest-outcome law forbids it reaching an athlete — an unmapped kind
 * returns null and the entry is DROPPED rather than shown as its code name.
 *
 * `migrated_day_placement` is deliberately absent: it is one-time envelope
 * migration bookkeeping that no writer creates, and it describes a decision
 * nobody made this week.
 */
function phraseFor(entry: DecisionLedgerEntry): string | null {
  const decision = entry.decision;
  switch (decision.kind) {
    case 'fixture_add': return 'added a fixture';
    case 'fixture_remove': return 'removed a fixture';
    case 'fixture_move': return 'moved a fixture';
    case 'reversal': return 'undid a change';
    case 'plan_change': {
      switch (decision.change.kind) {
        case 'remove_session': return 'removed a session';
        case 'add_template':
        case 'add_category': return 'added a session';
        case 'swap_template':
        case 'swap_category': return 'swapped a session';
        case 'move_session': return 'moved a session';
        case 'move_team_night': return 'moved team training';
        case 'shutdown_week': return 'shut the week down';
        case 'clear_days': return 'cleared days';
        default: return null;
      }
    }
    default: return null;
  }
}

/**
 * This week's decisions, oldest first.
 *
 * THE WEEK IS DECIDED BY THE CALLER, not re-derived here from a date string.
 * `journalLoad.journalWeekStartOf` is the one owner of "which week does this
 * belong to", and a second answer in this file would be the shape this unit has
 * refused five times already.
 */
export function buildJournalChanges(input: {
  readonly entries: readonly DecisionLedgerEntry[];
  /** Entries whose `occurredAt` date falls in this set are this week's. */
  readonly weekDates: ReadonlySet<string>;
}): JournalChanges {
  const changes: JournalChange[] = [];
  for (const entry of input.entries) {
    // `occurredAt` is a full ISO instant; the date half is what a week contains.
    const date = entry.occurredAt.slice(0, 10);
    if (!input.weekDates.has(date)) continue;
    const what = phraseFor(entry);
    if (what === null) continue;
    changes.push({ entryId: entry.id, occurredAt: entry.occurredAt, what });
  }

  changes.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)
    || a.entryId.localeCompare(b.entryId));

  return { changes, appChangesUnavailable: true };
}
