/**
 * THE INPUTS SCHEMA — the decision ledger's entry types.
 *
 * R1.1 of the shell rebuild (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`).
 * Persisted state is inputs only: profile answers, life-facts, THIS LEDGER,
 * and training results. Every athlete edit is one appended entry here; the
 * visible week is derived, never stored.
 *
 * Targeting law (§2 of the plan): decisions name DATE + SLOT coordinates,
 * never derived session ids — a derived id can drift across engine versions,
 * a date cannot. `PlanChange` already obeys this and travels verbatim.
 *
 * Extension: R3 adds fact decisions (phase shift, injury, illness, readiness)
 * as new union members; R2's migration appends entries with
 * `provenance: 'migration'` (and `'coach'`-attributed payloads it extracts).
 */

import type { PlanChange } from '../utils/planChangeTypes';
import type { Workout } from './domain';

/** Who put this decision on the ledger. */
export type DecisionProvenance =
  | 'athlete_tap'
  | 'coach'
  | 'migration'
  | 'system_fixture';

/**
 * The typed decision itself — the door vocabulary, verbatim. A ledger entry
 * never paraphrases the decision it records.
 */
export type AthleteDecision =
  | { kind: 'plan_change'; change: PlanChange }
  | { kind: 'fixture_add'; date: string; fixtureKind: string }
  | { kind: 'fixture_remove'; date: string; fixtureKind: string }
  | { kind: 'fixture_move'; fromDate: string; toDate: string; fixtureKind: string }
  /** Undo is a decision too: a reversal APPENDS, it never rewrites (LR-29). */
  | { kind: 'reversal'; reversedEntryId: string }
  /**
   * R2 MIGRATION ONLY — the one kind that carries CONTENT instead of intent,
   * and the only place in this union where that is allowed.
   *
   * The pre-rebuild envelope stored `dateOverrides` as a materialised workout
   * per date: the RESULT of a past decision whose intent it never recorded.
   * There is no honest `plan_change` to build from it — inventing one would
   * paraphrase a decision nobody made, which this ledger's own law forbids —
   * and `date_override` is the athlete-OWNED surface (`rebaseAcceptedEffective
   * Week`'s precedence statement), so the content is the athlete's material
   * and losing it would lose their edits. It migrates verbatim.
   *
   * NO WRITER EVER CREATES THIS but the one-time envelope extraction.
   * `preRebuildEnvelopeMigrationTests` pins that; when the last pre-rebuild
   * install is gone, the kind retires with the migration that made it.
   */
  | { kind: 'migrated_day_placement'; date: string; workout: Workout };

export interface DecisionLedgerEntry {
  /** Ledger-scoped unique id, assigned by the appender. */
  readonly id: string;
  /** Device-clock instant the decision was made, ISO 8601. */
  readonly occurredAt: string;
  readonly provenance: DecisionProvenance;
  readonly decision: AthleteDecision;
}
