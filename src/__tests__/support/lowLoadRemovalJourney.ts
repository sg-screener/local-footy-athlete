import { athleteAnswers } from '../compilerYear/catalog';
import { visibleSignature } from '../compilerYear/invariants';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { applyPlanChange } from '../../utils/planChangeProducer';
import { executeProgramControlActionDurably, programControlActionForPlanChange } from '../../utils/programControlActions';
import { undoLastDecision } from '../../store/undoLastDecision';

// Native founding case: rest -> Mobility -> Mobility -> Undo -> re-add ->
// restart -> Remove. The addition and removal share a target, not an effect.
export async function lowLoadRemovalJourney(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  const today = '2026-08-28', week = '2026-08-24';
  for (const gender of ['male', 'female'] as const) for (const first of ['mobility', 'recovery'] as const) {
    for (const second of ['mobility', 'recovery'] as const) {
      const profile = athleteAnswers({ id: `remove-lowload-${gender}`, gender,
        days: ['Monday', 'Tuesday', 'Thursday', 'Friday'], experience: '5+ years',
        equipment: 'commercial', initialPhase: 'Pre-season', clubDays: [], gameDay: null, extraGame: false });
      const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: today }));
      if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
      const view = () => quiet(() => deriveVisibleWeekLive(week, today));
      const target = view().find(day => day.date >= today && !day.workout)?.date;
      if (!target) throw Error(`${gender}: real onboarding supplies no future rest day for low-load removal`);
      const rows = () => view().find(day => day.date === target)?.workout?.exercises ?? [];
      const label = `lowload-remove/${gender}/${first}+${second}`;
      ok(`${label}: real onboarding supplies an empty target`, rows().length === 0, target);
      const add = (category: typeof first) => quiet(() => applyPlanChange({
        change: { kind: 'add_category', date: target, category }, visibleWeek: view(), todayISO: today, applyOverride: () => undefined,
      }));
      const a = add(first), firstSignature = visibleSignature(view()), b = add(second);
      ok(`${label}: both additions succeed with real content`, a.ok && b.ok && rows().length >= 6, JSON.stringify({a,b}));
      const undoAdd = await quietAsync(() => undoLastDecision());
      ok(`${label}: Undo second addition restores first exactly`, undoAdd.outcome === 'undone' && visibleSignature(view()) === firstSignature);
      const readd = add(second), beforeRemoval = visibleSignature(view());
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
      ok(`${label}: re-added accumulated day survives restart`, readd.ok && boot.ok && visibleSignature(view()) === beforeRemoval);
      const action = programControlActionForPlanChange({ kind: 'remove_session', date: target, scope: 'whole_day' });
      if (!action) throw Error('Native removal action is unreachable');
      const removed = await quietAsync(() => executeProgramControlActionDurably(action, { visibleWeek: view(), todayISO: today }));
      ok(`${label}: removing added work is not mistaken for an already-applied addition`, removed.ok && rows().length === 0, JSON.stringify(removed));
      if (!removed.ok || rows().length) continue;
      const removedSignature = visibleSignature(view());
      const removedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
      ok(`${label}: removal survives restart`, removedBoot.ok && visibleSignature(view()) === removedSignature);
      const undoRemove = await quietAsync(() => undoLastDecision());
      ok(`${label}: Undo removal restores both exact sessions`, undoRemove.outcome === 'undone' && visibleSignature(view()) === beforeRemoval);
      const undoBoot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
      ok(`${label}: restored sessions survive restart`, undoBoot.ok && visibleSignature(view()) === beforeRemoval);
    }
  }
}
