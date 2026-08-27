/**
 * Adapter for diagnostics written against the retired calendar action methods.
 * This is test-only: game changes enter the real typed fixture transaction;
 * legacy rest facts are inputs followed by the same canonical reconstruction.
 * No fixture placement or workout repair algorithm lives in this adapter.
 * Current release journeys use athleteJourney and the durable doors directly.
 */
import { executeFixtureMutationInMemory } from '../../store/fixtureMutationTransaction';
import { commitAcceptedStateTransaction } from '../../store/acceptedStateTransaction';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { rebuildDerivedWorldNow } from '../../store/quiescentBoot';
import { todayISOLocal } from '../../utils/appDate';

function fixture(action: 'add' | 'remove', date: string, todayISO = todayISOLocal()): void {
  const result = executeFixtureMutationInMemory({
    action,
    fixtureKind: useProfileStore.getState().onboardingData.seasonPhase === 'Pre-season'
      ? 'practice_match' : 'game',
    ...(action === 'add' ? { targetDate: date } : { sourceDate: date }),
    todayISO,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
      commandId: `diagnostic-calendar:${action}:${date}` },
  });
  if (result.outcome !== 'accepted' && result.outcome !== 'no_change') {
    throw new Error(`Diagnostic fixture action refused: ${result.reason}`);
  }
}

function rest(date: string, present: boolean): void {
  const markedDays = { ...useProgramStore.getState().acceptedMaterialContext.markedDays };
  if (present) markedDays[date] = 'rest';
  else if (markedDays[date] === 'rest') delete markedDays[date];
  else return;
  commitAcceptedStateTransaction({ operation: 'forward_decision',
    reason: 'diagnostic:legacy_rest_input', markedDays });
  rebuildDerivedWorldNow();
}

export function calendarActionsForTest() {
  return {
    setGameDay: (date: string, todayISO?: string) => fixture('add', date, todayISO),
    removeGameDay: (date: string) => fixture('remove', date),
    setNoGame: (date: string) => fixture('remove', date),
    removeNoGame: (date: string) => fixture('add', date),
    setRestDay: (date: string) => rest(date, true),
    removeRestDay: (date: string) => rest(date, false),
  };
}
