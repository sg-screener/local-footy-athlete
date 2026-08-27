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
import type { ProgramControlAction } from './programControlAction';
import type { DayOfWeek, Workout } from './domain';
import type { CanonicalAcceptedSessionEditEffect } from '../rules/canonicalWeeklySessionEditState';

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
  | {
      kind: 'plan_change';
      change: PlanChange;
      /** The exact accepted constraint delta; boot compiles it without acting again. */
      acceptedEffect: CanonicalAcceptedSessionEditEffect;
    }
  /** Append-only read-ingress metadata for a pre-effect plan-change row. */
  | {
      kind: 'legacy_plan_change_effect_upgrade';
      sourceEntryId: string;
      acceptedEffect: CanonicalAcceptedSessionEditEffect;
    }
  | { kind: 'fixture_add'; date: string; fixtureKind: string }
  | { kind: 'fixture_remove'; date: string; fixtureKind: string }
  | { kind: 'fixture_move'; fromDate: string; toDate: string; fixtureKind: string }
  /** Undo is a decision too: a reversal APPENDS, it never rewrites (LR-29). */
  | { kind: 'reversal'; reversedEntryId: string }
  /**
   * THE DOOR'S OWN VOCABULARY, RECORDED VERBATIM
   * (`docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md` §5).
   *
   * `ProgramControlAction` is the athlete tap door's typed action — the same
   * value the surface builds and `executeProgramControlAction` executes. This
   * kind stores it unchanged, which is the law at the top of this union
   * ("never paraphrases") applied to a door that previously had no kind at all.
   *
   * WHY ONE KIND FOR A 26-MEMBER UNION. A kind per capability would need a
   * second stored representation per capability, and that is where fields are
   * lost by omission. The decision IS the accepted action; its effect is
   * translated once into canonical weekly semantic state at read time.
   *
   * WHICH action types actually appear here is NOT open — it is the allow-list
   * in `rules/programControlDecisions.ts`, and
   * `canonicalWeeklyCompilerSliceTests` pins that every recorded type has a
   * semantic compiler arm and vice versa. Recording a
   * type the boot cannot reproduce would be worse than recording nothing: the
   * edit would look durable and vanish anyway.
   *
   * Session-level actions are NOT recorded here — they already append a
   * `plan_change` inside `applyPlanChange`, and two decisions for one act would
   * take two undos to undo.
   */
  | { kind: 'program_control'; action: ProgramControlAction }
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
  | { kind: 'migrated_day_placement'; date: string; workout: Workout }
  /**
   * THE ATHLETE'S ANSWER TO THE MISSED-SESSION QUESTION.
   *
   * The approved contract: *"When the athlete completes less than roughly 75
   * percent of required sessions across the block, ask whether the weekly
   * commitment is unrealistic. ... Rebuild only after the athlete confirms."*
   *
   * ⚠ **THE QUESTION IS NOT HERE, AND THAT IS THE DESIGN.** The ask is DERIVED
   * from the logged sessions and the commitment the block was built on
   * (`rules/weeklyCommitmentQuestion.ts`) — storing it would be storing a
   * derivation, which the north star forbids and which could go stale against
   * the facts underneath it. Only the ANSWER is a decision, and only decisions
   * live in this ledger.
   *
   * ⚠ **`declined` IS RECORDED, NOT INFERRED FROM ABSENCE.** Absence means "not
   * asked yet"; a decline means "asked, and they said no". Collapsing them is
   * how an app re-asks the same question every time the screen redraws, which
   * the contract's *"do not shame them"* rules out as plainly as anything else
   * in it.
   *
   * `forBlockNumber` scopes the answer: a new block asks a new question, because
   * the athlete's life may have changed. It is not a permanent silence.
   */
  | {
    kind: 'weekly_commitment_answer';
    forBlockNumber: number;
    answer:
      | { kind: 'confirmed'; sessionsPerWeek: number; trainingDays: DayOfWeek[] }
      | { kind: 'declined' };
  }
  /**
   * THE ATHLETE HAS READ WHAT CHANGED AT THIS BLOCK BOUNDARY.
   *
   * The notice explaining a reduced block *"survives reload until
   * acknowledged"*, so the acknowledgement has to be durable — and it is a
   * durable ANSWER FROM THE ATHLETE, which is what this ledger holds.
   *
   * ⚠ **IT CHANGES NOTHING ABOUT THE PROGRAM AND HAS NO REPLAY ARM.** Dismissing
   * the notice is not an edit; it stops a card being drawn. `quiescentBoot`
   * returns immediately for this kind, and the card's own derivation reads the
   * ledger. That is the whole mechanism — there is no dismissed-notices list on
   * any store, because a list would be a second place the same fact lives.
   */
  | { kind: 'block_boundary_notice_acknowledged'; forBlockNumber: number };

export interface DecisionLedgerEntry {
  /** Ledger-scoped unique id, assigned by the appender. */
  readonly id: string;
  /** Device-clock instant the decision was made, ISO 8601. */
  readonly occurredAt: string;
  readonly provenance: DecisionProvenance;
  readonly decision: AthleteDecision;
}
