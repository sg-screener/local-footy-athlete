/** Rebind the missing historical game-feedback guard to current accepted doors.
 * Actual onboarding → scheduled/practice fixture → save/re-save → restart.
 * No new results owner and no hand-installed program.
 */
import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, setJourneyClock } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import { commitSessionOutcomeTransaction, createRecordSessionOutcomeIntentFromFeedback } from '../../store/sessionOutcomeTransaction';
import { executeFixtureMutationInMemory } from '../../store/fixtureMutationTransaction';

export async function gameOutcomeJourney(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  const monday = '2026-09-28', gameDate = '2026-10-03';
  for (const phase of ['Pre-season', 'In-season'] as const) {
    const profile = athleteAnswers({ ...ARCHETYPES[2], initialPhase: phase });
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: monday }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    if (phase === 'Pre-season') {
      const fixture = quiet(() => executeFixtureMutationInMemory({ action: 'add', fixtureKind: 'practice_match',
        targetDate: gameDate, todayISO: monday,
        expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
        source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'game-guard-practice' } }));
      if (fixture.outcome !== 'accepted') throw Error(JSON.stringify(fixture));
    }
    setJourneyClock(gameDate);
    const view = () => quiet(() => deriveVisibleWeekLive(monday, gameDate));
    const target = () => view().find(day => day.date === gameDate)!.workout!;
    ok(`game/${phase}: current generated fixture is reached`, !!target()
      && (phase !== 'Pre-season' || target().fixtureVariant === 'practice_match'));
    const unchanged = () => JSON.stringify({ program: useProgramStore.getState().currentProgram,
      profile: useProfileStore.getState().onboardingData, ledger: useDecisionLedgerStore.getState().entries });
    const before = unchanged();
    const save = (bodyRpe: number, playedWholeGame = true, date = gameDate) => quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({ date, workout: view().find(day => day.date === date)!.workout!,
        feedback: { dateStr: date, completion: 'full', game: { playedWholeGame,
          timeOnGroundMinutes: playedWholeGame ? 80 : 63, bodyRpe, feel: 4 } },
        source: { entryPoint: 'tap', surface: 'game_feedback_panel' } }), gameDate));
    for (let effort = 1; effort <= 10; effort++) {
      const result = await save(effort, effort % 2 === 0);
      const actual = useProgramStore.getState().sessionFeedback[gameDate]?.game;
      ok(`game/${phase}/${effort}: complete shared-scale result saves and re-saves`, result.ok
        && actual?.bodyRpe === effort && actual.feel === 4
        && actual.playedWholeGame === (effort % 2 === 0)
        && actual.timeOnGroundMinutes === (effort % 2 === 0 ? 80 : 63), JSON.stringify(result));
    }
    const resultBeforeRefusal = JSON.stringify(useProgramStore.getState().sessionFeedback);
    const invalid = await save(11);
    const nonGame = view().find(day => day.date < gameDate && day.workout?.strengthIntent);
    if (!nonGame) throw Error('Missing real non-game rejection witness');
    const wrongTarget = await save(7, true, nonGame.date);
    ok(`game/${phase}: invalid scale and non-game payload refuse without replacing results`, !invalid.ok
      && !wrongTarget.ok && resultBeforeRefusal === JSON.stringify(useProgramStore.getState().sessionFeedback));
    ok(`game/${phase}: recording results does not change program, profile or modifiers`, before === unchanged());
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: gameDate }));
    ok(`game/${phase}: the complete dated result survives restart`, boot.ok
      && resultBeforeRefusal === JSON.stringify(useProgramStore.getState().sessionFeedback));
  }
}
