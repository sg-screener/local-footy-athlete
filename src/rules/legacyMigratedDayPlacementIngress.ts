/**
 * The only boundary allowed to understand the retired
 * `migrated_day_placement` payload. Current decisions cannot construct this
 * shape; persisted old rows enter here and leave as a typed accepted effect.
 */
import type { CanonicalAcceptedDayPlacementEffect } from './canonicalDayPlacementEffect';
import type {
  DecisionLedgerEntry,
  LegacyMigratedDayPlacementDecision,
} from '../types/decisionLedger';

export type LegacyMigratedDayPlacementEntry = DecisionLedgerEntry & {
  readonly decision: LegacyMigratedDayPlacementDecision;
};

export function isLegacyMigratedDayPlacementEntry(
  entry: DecisionLedgerEntry,
): entry is LegacyMigratedDayPlacementEntry {
  return entry.decision.kind === 'migrated_day_placement';
}

export function liftLegacyMigratedDayPlacementEntry(
  entry: LegacyMigratedDayPlacementEntry,
): CanonicalAcceptedDayPlacementEffect {
  return {
    kind: 'accepted_day_placement',
    source: 'legacy_migrated_day_placement',
    sourceEntryId: entry.id,
    acceptedAt: entry.occurredAt,
    dateISO: entry.decision.date.slice(0, 10),
    workout: JSON.parse(JSON.stringify(entry.decision.workout)),
  };
}
