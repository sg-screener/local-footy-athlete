import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, rolloverIfDue, setJourneyClock } from './athleteJourney';
import { presetEquipmentAnswer } from './equipmentAnswerFixture';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature } from '../compilerYear/invariants';
import { normalizeConditioningSelectionHistory, resolveTemplateByName, templateDurationMinutes } from '../../rules/conditioningSelection';
import { useBlockSelectionHistoryStore } from '../../store/blockSelectionHistoryStore';

/** Accepted block history is produced by real rollover, never inserted into
 * storage. Every legacy flush identity must be reached and survive a boot on
 * each single-machine answer, for both genders. */
export async function flushRestartJourney(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  const dates = ['2026-07-13', '2026-08-10', '2026-09-07', '2026-10-05', '2026-11-02', '2026-11-30', '2026-12-28'];
  for (const gender of ['male', 'female'] as const) for (const machine of ['bike_erg', 'air_bike', 'row', 'ski'] as const) {
    const profile = { ...athleteAnswers({ ...ARCHETYPES[2], gender, days: ['Monday', 'Wednesday'], initialPhase: 'In-season' }),
      equipmentAnswer: { ...presetEquipmentAnswer('commercial_gym', dates[0]), modalities: { [machine]: 'have' as const } } };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: dates[0] }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const seen = new Set<string>();
    for (const date of dates) {
      setJourneyClock(date);
      const rollover = quiet(() => rolloverIfDue(date));
      ok(`flush-restart/${gender}/${machine}/${date}: actual rollover is accepted`, !rollover.refusal, JSON.stringify(rollover));
      const view = () => quiet(() => deriveVisibleWeekLive(date, date));
      const offered = view().flatMap(d => d.workout?.conditioningBlock?.options ?? [])
        .filter(o => resolveTemplateByName(o.title)?.quality === 'flush');
      ok(`flush-restart/${gender}/${machine}/${date}: delivered G+2 dose has one actual owned machine and total under 15`,
        offered.length === 1 && offered.every(o => {
          seen.add(o.title);
          return o.modalitySequence?.join(',') === (machine === 'bike_erg' ? 'bike' : machine)
            && o.durationMinutes === templateDurationMinutes(resolveTemplateByName(o.title)!) && o.durationMinutes < 15;
        }), JSON.stringify(offered));
      const before = visibleSignature(view());
      const recorded = useBlockSelectionHistoryStore.getState().conditioningSelections;
      const flushHistory = recorded.filter(entry => resolveTemplateByName(entry.templateName)?.quality === 'flush');
      ok(`flush-restart/${gender}/${machine}/${date}: new saved history records recovery demand, not fitness demand`,
        flushHistory.length > 0 && flushHistory.every(entry => entry.category === 'recovery_flush'));
      // Mutate a copy of real accepted history to the former ingress format;
      // never insert fabricated program state into storage.
      const legacy = recorded.map(entry => entry.category === 'recovery_flush' ? { ...entry, category: 'aerobic_base' as const } : entry);
      const legacyBytes = JSON.stringify(legacy);
      const lifted = normalizeConditioningSelectionHistory(legacy);
      ok(`flush-restart/${gender}/${machine}/${date}: legacy history lifts without deleting identities or mutating saved input`,
        JSON.stringify(legacy) === legacyBytes && lifted.length === legacy.length
        && lifted.every((entry, i) => entry.templateName === legacy[i].templateName && entry.blockStartISO === legacy[i].blockStartISO)
        && lifted.filter(entry => resolveTemplateByName(entry.templateName)?.quality === 'flush').every(entry => entry.category === 'recovery_flush'));
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`flush-restart/${gender}/${machine}/${date}: accepted dose and order survive restart`, boot.ok && before === visibleSignature(view()));
    }
    ok(`flush-restart/${gender}/${machine}: all seven distinct flush templates were actually delivered and restarted`, seen.size === 7, JSON.stringify([...seen]));
  }
}
