import { useProgramStore } from '../../store/programStore';
import { transactTemporarySourceFact } from '../../store/temporarySourceFactTransaction';
import { createTemporaryFatigueFact, createTemporaryEquipmentFact, createTemporaryScheduleFact,
  temporaryFactScope, temporarySourceFactId } from '../../rules/temporarySourceFact';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { quiet, quietAsync, relaunchApp, setJourneyClock } from '../support/athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { semanticFingerprint } from '../../utils/programSemanticSnapshot';
import { visibleSignature } from './invariants';
import type { Check } from './results';
import { plusDays } from './catalog';

/** Status Clear must resolve inputs, never restore a saved output snapshot. */
export async function clearFactLifecycle(weekStart: string, storage: Map<string, string>): Promise<Check[]> {
  const checks: Check[] = [];
  const check = (id: string, ok: boolean, detail?: string) => {
    checks.push({ id: `clear_${id}`, ok, detail });
    if (!ok) throw new Error(`${id}: ${detail ?? 'invariant failed'}`);
  };
  const signature = () => visibleSignature(quiet(() => deriveVisibleWeekLive(weekStart, weekStart)));
  const factState = () => semanticFingerprint(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts);
  const clear = (id: string, generic: boolean) => quietAsync(() => executeProgramControlActionDurably({
    ...(generic ? { type: 'clear_active_modifier' as const, payload: { modifierId: id } }
      : { type: 'clear_fatigue_status' as const, payload: { modifierId: id, date: weekStart } }),
    source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    scope: 'current_week',
    requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
  }, { todayISO: weekStart }));
  try {
    setJourneyClock(weekStart);
    const baseline = signature();
    for (const suffix of ['first', 'second']) {
      const result = await quietAsync(() => transactTemporarySourceFact({ operation: 'create', todayISO: weekStart,
        fact: createTemporaryFatigueFact({ observedDate: weekStart, scope: temporaryFactScope({ kind: 'week', date: weekStart }),
          athleteReportedLevel: 'cooked', sourceSurface: 'status_card', factId: `clear-test:${suffix}` }) }));
      check(`report_${suffix}`, !['conflicted', 'safely_rejected'].includes(result.outcome), result.message);
    }
    const context = useProgramStore.getState().acceptedMaterialContext;
    const shared = context.activeConstraints.find(constraint => constraint.temporarySourceFactIds?.length === 2);
    check('shared_constraint_reached', !!shared);
    const before = signature(); const facts = factState();
    const ambiguous = await clear(`program-modifier:active_constraint:${shared!.id}`, true);
    check('ambiguous_clear_refused', !ambiguous.ok && signature() === before && factState() === facts);
    const rejected = await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve',
      factId: 'clear-test:first', todayISO: weekStart, testHooks: { verifyAfterPersistence: () => false } }));
    check('failed_clear_rolled_back', rejected.outcome === 'safely_rejected' && signature() === before && factState() === facts);
    const first = await clear('clear-test:first', false);
    check('exact_clear', first.ok, first.message);
    const remaining = useProgramStore.getState().acceptedMaterialContext.activeConstraints.find(constraint =>
      constraint.temporarySourceFactIds?.includes('clear-test:second'));
    check('other_report_retained', !!remaining && remaining.temporarySourceFactIds?.length === 1);
    const remainingSignature = signature();
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: weekStart }));
    check('remaining_restart', boot.ok && signature() === remainingSignature, boot.error);
    const second = await clear(`program-modifier:active_constraint:${remaining!.id}`, true);
    check('generic_clear_restores', second.ok && signature() === baseline, second.message);
    const clearedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: weekStart }));
    check('cleared_restart', clearedBoot.ok && signature() === baseline, clearedBoot.error);
    const scope = temporaryFactScope({ kind: 'window', from: plusDays(weekStart, 1), until: plusDays(weekStart, 3) });
    const trip = createTemporaryScheduleFact({ observedDate: weekStart, scope,
      scheduleKind: 'travel', sourceSurface: 'away_this_week', factId: 'clear-test:trip' });
    const pairedKit = createTemporaryEquipmentFact({ observedDate: weekStart, scope, mode: 'without',
      equipmentTags: ['kettlebell'], sourceSurface: 'away_this_week', factId: 'clear-test:trip-kit' });
    const unrelatedKit = createTemporaryEquipmentFact({ observedDate: weekStart, scope, mode: 'without',
      equipmentTags: ['kettlebell'], sourceSurface: 'status_card', factId: 'clear-test:unrelated-kit' });
    for (const fact of [trip, pairedKit, unrelatedKit]) {
      const reported = await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact, todayISO: weekStart }));
      check(`trip_report_${fact.factId}`, !['conflicted', 'safely_rejected'].includes(reported.outcome), reported.message);
    }
    const tripBefore = signature(); const tripFacts = factState();
    const rejectedTrip = await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve',
      factId: trip.factId, todayISO: weekStart, testHooks: { verifyAfterPersistence: () => false } }));
    check('trip_failed_clear_rolled_back', rejectedTrip.outcome === 'safely_rejected' &&
      signature() === tripBefore && factState() === tripFacts);
    const cancelled = await clear(trip.factId, false);
    const afterTrip = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
    check('trip_cleared_atomically', cancelled.ok &&
      [trip.factId, pairedKit.factId].every(id => afterTrip.find(fact => temporarySourceFactId(fact) === id)?.status === 'resolved') &&
      afterTrip.find(fact => temporarySourceFactId(fact) === unrelatedKit.factId)?.status === 'active', cancelled.message);
    const tripSignature = signature(); const cancelledFacts = factState();
    const tripBoot = await quietAsync(() => relaunchApp({ storage, todayISO: weekStart }));
    check('trip_clear_restart', tripBoot.ok && signature() === tripSignature && factState() === cancelledFacts, tripBoot.error);
    const clearedUnrelated = await clear(unrelatedKit.factId, false);
    check('trip_cleanup', clearedUnrelated.ok && signature() === baseline, clearedUnrelated.message);
  } catch (error) { checks.push({ id: 'clear_lifecycle_complete', ok: false, detail: String(error) }); }
  return checks;
}
