/**
 * resetStoresToFreshInstall — ONE owner for "put every store back to a state a
 * fresh install could actually be in".
 *
 * Extracted from `athleteActionWalkerTests.freshInstall` on 2026-08-04, when a
 * second suite (the session-list combination matrix) needed the same reset and
 * a weaker second copy immediately failed: leftover accepted state made the
 * second `commitRebuiltProgram` of a run throw
 * `AcceptedStateLedgerMismatchError`. That is the walker's own warning coming
 * true from the outside —
 *
 *   "A FRESH INSTALL IS TOTAL OR IT IS NOT A FRESH INSTALL. […] A reset that
 *    leaves a door open makes every reproduction in this file a coin toss, and
 *    the shrinker's minimal history a lie."
 *
 * — so the list lives in one place and grows in one place. Stores that own a
 * named reset act are reset THROUGH it, never with a bare default write: the
 * armour refuses a default over answered state, and a harness must not bypass
 * the owners it is testing.
 *
 * The caller still clears its own `localStorage` stub (each suite installs its
 * own Map) and its own harness-local flags.
 */
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../../store/coachMutationHistoryStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useCoachStore } from '../../store/coachStore';
import { useCoachMemoryStore } from '../../store/coachMemoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../../rules/reversibleAdjustmentLedger';
import type { OnboardingData } from '../../types/domain';

export function resetStoresToFreshInstall(reason: string): void {
  useProfileStore.setState({
    onboardingData: {} as OnboardingData,
    isOnboardingComplete: false,
  });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachMutationHistoryStore.getState().clearAll();
  // Through the stores' own reset doors — the armour refuses a raw default
  // write over answered prefs, and a fresh install must not bypass the owners.
  useAthletePreferencesStore.getState().clear();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  useCoachStore.getState().clear();
  useCoachMemoryStore.getState().clearNotes();
  // The LR-23 in-memory stores: reset through their own actions. (The
  // `getCoachRevisionTemplateContext` module singleton is a third confirmed
  // carrier with no reset API — DECLARED in the day-shift log, not reset here.)
  require('../../store/pendingCoachClarifierStore')
    .usePendingCoachClarifierStore.getState().reset();
  require('../../store/coachContextStateStore')
    .useCoachContextStateStore.getState().clearCoachContext();
  // The decision ledger (R1.1) — a fresh install has recorded no decisions.
  // FOUND 2026-08-05 by the L16 relaunch cell the day the quiescent boot began
  // REPLAYING the ledger: every prior cell's landed decisions replayed into the
  // L16 world at boot, recomposing a week whose own history was one delete.
  // Through the store's own reset door, like every armoured store above.
  require('../../store/decisionLedgerStore')
    .useDecisionLedgerStore.getState().clear();
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 0, lastTransaction: reason,
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
    // ─── EVERY PERSISTED INPUT, AND THE CHECK BELOW IS WHY THESE THREE ARE
    //     HERE RATHER THAN JUST `acceptedBlocks` ─────────────────────────────
    //
    // FOUND 2026-08-20 by the settings-persistence matrix, and it is this file's
    // own founding warning coming true a second time: *"A FRESH INSTALL IS TOTAL
    // OR IT IS NOT A FRESH INSTALL."*
    //
    // `acceptedBlocks` joined `programStore` on 2026-08-17 as a persisted INPUT
    // and never joined this list. So a fresh install after any athlete who had
    // crossed a block boundary kept their accepted record — and `quiescentBoot`
    // reads `currentAcceptedBlock(acceptedBlocks)` to answer *"which block am I
    // in"*. **MEASURED: a brand-new athlete, cold-started immediately after a
    // worn one, was booted as BLOCK 2** — `blockState.blockNumber 1 -> 2`,
    // `miniCycleNumber [1,1,1,1] -> [2,2,2,2]`, and their power row rotated
    // `Vertical Jump -> Lateral Jump` across the relaunch. Nothing failed; the
    // next suite simply measured a different athlete than the one it built.
    //
    // `generationAnchorISO` and `hydratedSeasonPhaseClock` are the same class,
    // caught by the same check rather than by noticing them.
    acceptedBlocks: {},
    generationAnchorISO: null,
    hydratedSeasonPhaseClock: null,
  } as never);

  // ─── RESET THE SOURCE BEFORE THE MIRROR, OR THE MIRROR PUTS IT BACK ───────
  //
  // FOUND 2026-08-04 by the lighter-day walker cell, and it is the reason this
  // reset moved down here from between the calendar and the mutation history.
  //
  // `coachUpdatesStore.activeConstraints` is a PROJECTION of the accepted
  // material context — `publishAcceptedCoachUpdatesCompatibilityMirror`
  // (`coachUpdatesStore.ts:1140`) re-derives it, and it is subscribed to the
  // store's own writes. So clearing it while `acceptedMaterialContext` still
  // held a fact re-published that fact IMMEDIATELY, inside the very setState
  // meant to clear it: `activeConstraints` went 0 -> 1 before the next line ran.
  //
  // The reset LOOKED total and was not. Nothing failed for it either, until a
  // SECOND async cell ran after `walkTheScheduleDoors` and inherited its active
  // travel fact — generation then produced a week with no strength coverage and
  // threw `Section 18 final-week rejection`, three doors away from the cause.
  // A synchronous suite never saw it because every synchronous cell runs before
  // the async tail, so the first async cell always got a genuinely clean world
  // and the second one never existed until now.
  //
  // This is the PROFILE-MIRROR defect one store over (docs: the onboarding
  // reliability unit, whose root cause was "the profile MIRROR, not the
  // relaunch race"). A mirror is not state you can clear; it is state you clear
  // the SOURCE of. Hence the order, and hence the check below — a reset that
  // does not hold must say so rather than hand the next walk a different
  // athlete.
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  const leaked = useCoachUpdatesStore.getState().activeConstraints;
  if (leaked.length > 0 || useCoachUpdatesStore.getState().activeInjury) {
    throw new Error(
      `A FRESH INSTALL IS TOTAL OR IT IS NOT A FRESH INSTALL (${reason}): the `
      + `coach-updates reset did not hold — ${leaked.length} constraint(s) `
      + `survived it. Something re-published the mirror after its source was `
      + `cleared; find the new source and reset that, do not clear twice.`);
  }
  assertNoPersistedProgramInputSurvived(reason);
}

/**
 * ⚠ **THE LIST GROWS BY ITSELF, OR IT DRIFTS AGAIN.**
 *
 * `acceptedBlocks` is the second key to be added to `programStore`'s persisted
 * inputs and forgotten here, and the first one cost every seeded Maestro flow in
 * the repo (`projectProgramPersistedInputs`'s own docstring records that day).
 * The lesson taken there was to make the field list ONE FUNCTION rather than
 * three copies. This is the same lesson applied to the RESET: instead of adding
 * a line per key and hoping the next author adds theirs, the check ASKS THE
 * PROJECTION what the store persists and requires every one of those values to
 * be empty.
 *
 * So a future input key that does not join the `setState` above turns this red
 * on the next run of any suite that resets — which is the behaviour a comment
 * saying *"remember to add your key"* has never once produced.
 *
 * **What "empty" means, stated rather than guessed:** `null`/`undefined`, an
 * empty object, or an empty array. Anything else is state a fresh install could
 * not be carrying. A scalar with a real value is therefore a red too, which is
 * correct — `generationAnchorISO` surviving an install is the same defect wearing
 * a different type.
 */
function assertNoPersistedProgramInputSurvived(reason: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { projectProgramPersistedInputs } = require('../../store/programStore');
  const inputs = projectProgramPersistedInputs(
    useProgramStore.getState() as unknown as Record<string, unknown>,
  ) as Record<string, unknown>;
  const survivors = Object.entries(inputs).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    return true;
  });
  if (survivors.length === 0) return;
  throw new Error(
    `A FRESH INSTALL IS TOTAL OR IT IS NOT A FRESH INSTALL (${reason}): `
    + `${survivors.length} persisted program input(s) survived the reset — `
    + `${survivors.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ')}. `
    + 'Add the key to the `useProgramStore.setState` above. Every key '
    + '`projectProgramPersistedInputs` reports is a value the app writes to disk '
    + 'and reads at boot, so one left behind hands the next athlete somebody '
    + "else's history.",
  );
}
