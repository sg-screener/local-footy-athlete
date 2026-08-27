/** One-time ingress for fixture rows written before exact accepted effects. */
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { FixtureMutationKind } from '../types/fixtureMutation';
import {
  canonicalAcceptedFixtureEditEffectFromIntent,
  type CanonicalAcceptedFixtureEditEffect,
} from '../rules/canonicalWeeklyFixtureEditState';
import { storedGameAnchor } from '../rules/gameAnchor';
import { useProfileStore } from './profileStore';
import { useProgramStore } from './programStore';

export function replayLegacyFixtureEntryToEffect(
  entry: DecisionLedgerEntry,
): CanonicalAcceptedFixtureEditEffect {
  const decision = entry.decision;
  if (decision.kind !== 'fixture_add' && decision.kind !== 'fixture_move' &&
    decision.kind !== 'fixture_remove') {
    throw new Error(`Legacy fixture migration received ${decision.kind}`);
  }
  const fixtureKind = decision.fixtureKind as FixtureMutationKind;
  if (fixtureKind !== 'game' && fixtureKind !== 'practice_match') {
    throw new Error(`Legacy fixture kind is unreadable: ${String(decision.fixtureKind)}`);
  }
  const profile = useProfileStore.getState().onboardingData;
  if (!profile) throw new Error('Legacy fixture migration requires an accepted profile');
  const action = decision.kind === 'fixture_add'
    ? 'add'
    : decision.kind === 'fixture_remove' ? 'remove' : 'move';
  const sourceDate = decision.kind === 'fixture_move'
    ? decision.fromDate
    : decision.kind === 'fixture_remove' ? decision.date : undefined;
  const targetDate = decision.kind === 'fixture_move'
    ? decision.toDate
    : decision.date;
  const requestedBy = entry.provenance === 'coach'
    ? 'coach'
    : entry.provenance === 'system_fixture' ? 'system' : 'athlete';
  return canonicalAcceptedFixtureEditEffectFromIntent({
    action,
    fixtureKind,
    sourceDate,
    targetDate,
    acceptedAt: entry.occurredAt,
    source: {
      requestedBy,
      producer: requestedBy === 'coach' ? 'coach' : requestedBy === 'system' ? 'system' : 'tap',
      surface: requestedBy === 'coach'
        ? 'coach_chat'
        : requestedBy === 'system' ? 'hydration_migration' : 'program_tab',
      commandId: `legacy-fixture:${entry.id}`,
    },
    beforeMarkedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
    recurringGameDay: storedGameAnchor(profile),
  });
}
