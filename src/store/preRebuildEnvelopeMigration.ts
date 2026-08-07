/**
 * R2 — THE ONE-TIME ENVELOPE → INPUTS EXTRACTION (the extraction half).
 *
 * `docs/SHELL_REBUILD_PLAN_2026-08-05.md` §3 R2. R1.3's quiescent boot PARKS
 * the pre-rebuild program envelope byte-identical under
 * `program-store.pre-rebuild-envelope` before anything writes the new shape.
 * This module reads that parked copy ONCE and turns the DECISIONS it encodes
 * into decision-ledger entries, so an athlete who installs over the top keeps
 * the edits they made in the old world.
 *
 * WHAT MIGRATES, AND WHAT DELIBERATELY DOES NOT (Sam's ruling, 2026-08-05):
 *
 * - `userRemovalConstraints` → real `plan_change` entries. A deletion is a
 *   `remove_session` and a move is a `move_session`, both already in the door
 *   vocabulary, so these travel with no paraphrase at all.
 * - `dateOverrides` → `migrated_day_placement`, carrying the workout verbatim
 *   (see the kind's own note: content, because the old world recorded no
 *   intent to carry, and this is the athlete-owned surface).
 * - `weekScopedOverlays` DOES NOT MIGRATE. It is DERIVED content by the very
 *   law the fixture identity unit just enforced — "`week_overlay` is not an
 *   athlete-owned surface; a scoped-regen overlay is authored by a source
 *   fact" — so it is re-derived from the facts. Migrating it would import
 *   precisely the contamination `fixtureIdentityTests` cell 3 measures.
 * - Facts and results are NOT this module's job: `reduceProgramEnvelopeToInputs`
 *   (programStore) already lifts the anchor, phase clock, session feedback,
 *   weight overrides, temporary source facts and injury episodes.
 *
 * THE FOUR PROPERTIES, each gated in `preRebuildEnvelopeMigrationTests`:
 *
 * 1. IDEMPOTENT — running twice is running once. The ledger IS the receipt:
 *    a run that finds migration-provenance entries already present does
 *    nothing. No new persisted state exists to record that a migration ran,
 *    which would be a stored output by any other name.
 * 2. NON-DESTRUCTIVE — the parked envelope is never written, moved or
 *    deleted here. It is deleted in the first post-beta release, never in the
 *    release that reads it.
 * 3. APPEND-ONLY, THROUGH THE DOOR — every entry goes through
 *    `appendDecisionEntry` as `writer: 'migration'`. This module holds no
 *    write privileges the doors do not.
 * 4. ORDERED AND DATED — entries carry the old world's own timestamps where
 *    it recorded them (`createdAt`), so a replay applies them in the order
 *    the athlete made them.
 *
 * NOT-COVERED, stated rather than implied: the CONFORMANCE half of R2 (the
 * old shell's visible week ≡ derive() over migrated inputs) is not here and
 * is not gated. Cell 3 measures that the old shell's week is not derive()
 * over the same inputs, so a conformance gate written today would enshrine
 * that as its target. It waits for R5's switchover.
 */

import type { Workout, UserRemovalConstraint } from '../types/domain';
import type { PlanChange } from '../utils/planChangeTypes';
import { asyncStorageCompat } from './asyncStorageCompat';
import { PRE_REBUILD_ENVELOPE_PARKING_KEY } from './programStore';
import { appendDecisionEntry, decisionLedgerEntries } from './decisionLedgerStore';
import { logger } from '../utils/logger';

export type PreRebuildMigrationOutcome =
  | 'migrated'
  | 'already_migrated'
  | 'no_parked_envelope'
  | 'unreadable_envelope';

export interface PreRebuildMigrationResult {
  outcome: PreRebuildMigrationOutcome;
  /** Entries appended by THIS run. Zero on every run but the first. */
  entriesAppended: number;
  dayPlacements: number;
  removals: number;
  moves: number;
  /** Decisions the envelope held that this run could not express, if any. */
  skipped: string[];
}

const EMPTY_RESULT: Omit<PreRebuildMigrationResult, 'outcome'> = {
  entriesAppended: 0,
  dayPlacements: 0,
  removals: 0,
  moves: 0,
  skipped: [],
};

interface ParkedProgramState {
  dateOverrides?: Record<string, Workout>;
  userRemovalConstraints?: UserRemovalConstraint[];
}

/**
 * Has the extraction already run? The LEDGER answers, not a flag beside it —
 * a persisted "migration done" marker would be stored output by another name.
 *
 * TWO WITNESSES, because one is not enough and the gap is not hypothetical.
 * Day placements are appended `provenance: 'coach'` (Sam's ruling — his
 * coach-made state stays attributed), so a device whose old world held ONLY
 * `dateOverrides` leaves no migration-provenance entry at all. Checking
 * provenance alone would let a second run DOUBLE the athlete's edits. The
 * `migrated_day_placement` KIND is migration-only by law, so it witnesses
 * that case; removals are appended `provenance: 'migration'` regardless of
 * their old source, which witnesses the other. Between them every non-empty
 * envelope leaves a mark, and an empty one has nothing to double.
 */
export function preRebuildDecisionsAlreadyMigrated(): boolean {
  return decisionLedgerEntries().some((entry) =>
    entry.provenance === 'migration'
    || entry.decision.kind === 'migrated_day_placement');
}

/**
 * The old world's removal scopes and the door's Bin scopes are the same
 * vocabulary; this states the mapping explicitly so an unrecognised scope is
 * SKIPPED AND REPORTED rather than coerced into a plausible neighbour.
 */
const BIN_SCOPES = new Set(['whole_day', 'strength', 'conditioning', 'recovery', 'team']);

function planChangeForRemoval(
  constraint: UserRemovalConstraint,
): { change: PlanChange; kind: 'removal' | 'move' } | { skipped: string } {
  const scope = String(constraint.scope);
  if (!BIN_SCOPES.has(scope)) {
    return { skipped: `removal ${constraint.id}: unrecognised scope "${scope}"` };
  }
  if (constraint.mutationKind === 'move') {
    if (!constraint.moveTargetDate) {
      return { skipped: `move ${constraint.id}: no destination date recorded` };
    }
    return {
      kind: 'move',
      change: {
        kind: 'move_session',
        fromDate: constraint.targetDate,
        toDate: constraint.moveTargetDate,
        scope,
      } as unknown as PlanChange,
    };
  }
  return {
    kind: 'removal',
    change: {
      kind: 'remove_session',
      date: constraint.targetDate,
      scope,
    } as unknown as PlanChange,
  };
}

/**
 * Read the parked envelope and append the decisions it encodes. Safe to call
 * on every boot: it answers `already_migrated` after the first success and
 * `no_parked_envelope` on a device that never held an old world.
 */
export async function extractParkedEnvelopeDecisions(): Promise<PreRebuildMigrationResult> {
  if (preRebuildDecisionsAlreadyMigrated()) {
    return { outcome: 'already_migrated', ...EMPTY_RESULT };
  }

  let raw: string | null;
  try {
    // READ ONLY. Nothing in this module writes, moves or deletes this key.
    raw = await asyncStorageCompat.getItem(PRE_REBUILD_ENVELOPE_PARKING_KEY);
  } catch (error) {
    logger.error('[preRebuildEnvelopeMigration] could not read the parked envelope', { error });
    return { outcome: 'unreadable_envelope', ...EMPTY_RESULT };
  }
  if (raw === null) return { outcome: 'no_parked_envelope', ...EMPTY_RESULT };

  let state: ParkedProgramState;
  try {
    state = ((JSON.parse(raw) as { state?: ParkedProgramState }).state ?? {});
  } catch (error) {
    // An unreadable envelope proves nothing and must not look like an empty
    // one — a device whose old world cannot be parsed keeps its parked bytes
    // for a later attempt rather than being recorded as migrated.
    logger.error('[preRebuildEnvelopeMigration] the parked envelope did not parse', { error });
    return { outcome: 'unreadable_envelope', ...EMPTY_RESULT };
  }

  const skipped: string[] = [];
  let dayPlacements = 0;
  let removals = 0;
  let moves = 0;

  // ORDERED BY WHEN THE ATHLETE DECIDED, so a replay walks their history in
  // the order they lived it. Removals carry `createdAt`; day placements do
  // not, so they lead — a placement the old world had is the earlier state
  // any removal was then applied to.
  for (const [date, workout] of Object.entries(state.dateOverrides ?? {})) {
    if (!workout) continue;
    const appended = appendDecisionEntry({
      decision: { kind: 'migrated_day_placement', date: date.slice(0, 10), workout },
      // Sam's ruling and the plan §6: coach-made state on his device migrates
      // attributed to the coach, so nothing he accepted is lost or relabelled.
      provenance: 'coach',
      writer: 'migration',
    });
    if (appended.ok) dayPlacements += 1;
    else skipped.push(`placement ${date}: ledger refused (${appended.reason})`);
  }

  const constraints = [...(state.userRemovalConstraints ?? [])]
    // A RESTORED removal is a decision the athlete already took back; the end
    // state holds no such removal, so replaying it would resurrect a deletion
    // they undid. Only what is still in force migrates.
    .filter((constraint) => constraint?.status === 'active')
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));

  for (const constraint of constraints) {
    const mapped = planChangeForRemoval(constraint);
    if ('skipped' in mapped) {
      skipped.push(mapped.skipped);
      continue;
    }
    const appended = appendDecisionEntry({
      decision: { kind: 'plan_change', change: mapped.change },
      // ALWAYS `migration`, whatever the old world's `source` said — this is
      // the idempotency witness for an envelope that holds removals and no
      // day placements, and it is also the literal truth about who put the
      // entry on the ledger. Sam's ruling attributes `dateOverrides` to the
      // coach; it says nothing about removals, and a label that doubles as a
      // receipt must not be ambiguous.
      provenance: 'migration',
      writer: 'migration',
      ...(constraint.createdAt ? { occurredAt: constraint.createdAt } : {}),
    });
    if (!appended.ok) {
      skipped.push(`${mapped.kind} ${constraint.id}: ledger refused (${appended.reason})`);
      continue;
    }
    if (mapped.kind === 'move') moves += 1;
    else removals += 1;
  }

  const entriesAppended = dayPlacements + removals + moves;
  if (entriesAppended === 0 && skipped.length === 0) {
    // Nothing to carry. Reported distinctly from a device with no old world
    // so a silent empty extraction can never be mistaken for a successful one.
    return { outcome: 'migrated', ...EMPTY_RESULT };
  }
  logger.info('[preRebuildEnvelopeMigration] extracted the parked world\'s decisions', {
    entriesAppended, dayPlacements, removals, moves, skippedCount: skipped.length,
  });
  return { outcome: 'migrated', entriesAppended, dayPlacements, removals, moves, skipped };
}
