import { athleteAnswers, plusDays } from '../compilerYear/catalog';
import { visibleSignature } from '../compilerYear/invariants';
import { coldStartThroughOnboarding, followTheWeek, quiet, quietAsync, recordDay,
  relaunchApp, rolloverIfDue, setJourneyClock } from './athleteJourney';
import { useProgramStore } from '../../store/programStore';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { buildGuidedInjuryConstraint } from '../../utils/guidedInjuryControl';
import { readinessActionForKind } from '../../utils/weekReadinessActions';
import { applyConditioningModalityToWorkout } from '../../utils/coachModalitySwap';
import { project } from '../../rules/projectVisibleWeek';
import { getExerciseTags } from '../../data/exerciseTags';

// The reported world: actual onboarding, seven logged weeks, week-eight
// shoulder restriction during a scheduled deload, including mixed sessions.
// No stored workout fixture and no restart-only oracle.
export async function accumulatedInjuryConditioning(
  storage: Map<string, string>,
  ok: (label: string, condition: boolean, detail?: string) => void,
): Promise<void> {
  const start = '2026-09-28';
  const weekStart = plusDays(start, 49);
  const date = plusDays(weekStart, 1);
  const source = { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' } as const;
  for (const gender of ['male', 'female'] as const) {
    const profile = athleteAnswers({ id: `injury-deload-${gender}`, gender,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      experience: '5+ years', equipment: 'commercial', initialPhase: 'Off-season',
      clubDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday', extraGame: false });
    profile.seasonFinishedOn = plusDays(start, -1);
    profile.equipmentAnswer = { ...profile.equipmentAnswer!, answeredOn: start };
    profile.twoKmTimeTrial = { ...profile.twoKmTimeTrial!, recordedOn: start };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: start }));
    ok(`${gender}: accumulated injury onboarding accepted`, !installed.onboardingRefusal);
    let logged = 0;
    for (let w = 0; w < 7; w++) {
      const monday = plusDays(start, w * 7);
      setJourneyClock(monday);
      const rolled = quiet(() => rolloverIfDue(monday));
      if (rolled.refusal) throw new Error(JSON.stringify(rolled.refusal));
      quiet(() => followTheWeek(monday));
      for (let d = 0; d < 7; d++) {
        const today = plusDays(monday, d);
        setJourneyClock(today);
        if (w === 4 && d === 2) {
          const tired = await quietAsync(() => executeProgramControlActionDurably(
            readinessActionForKind('tired_today', { anchorDateISO: today, todayISO: today }), { todayISO: today }));
          if (!tired.ok) throw new Error(JSON.stringify(tired));
        }
        const result = await quietAsync(() => recordDay(today, { record: true, completion: 'full',
          feeling: 'good', soreness: 'none', difficulty: 7, logWeights: true, conditioningRpe: 6 }));
        if (['refused', 'threw'].includes(result.result)) throw new Error(JSON.stringify(result));
        if (result.result === 'recorded') logged++;
      }
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: plusDays(monday, 6) }));
      if (!boot.ok) throw new Error(JSON.stringify(boot));
    }
    setJourneyClock(weekStart);
    const rolled = quiet(() => rolloverIfDue(weekStart));
    if (rolled.refusal) throw new Error(JSON.stringify(rolled.refusal));
    quiet(() => followTheWeek(weekStart));
    setJourneyClock(date);
    const tired = await quietAsync(() => executeProgramControlActionDurably(
      readinessActionForKind('tired_today', { anchorDateISO: date, todayISO: date }), { todayISO: date }));
    ok(`${gender}: active readiness precedes shoulder during deload`, tired.ok);
    const view = () => quiet(() => deriveVisibleWeekLive(weekStart, date));
    const before = view();
    const baseline = visibleSignature(before);
    const presses = (days: ReturnType<typeof view>) => days.filter(d => d.date >= date).flatMap(d =>
      d.workout?.exercises.filter(r => ['horizontal_push', 'vertical_push'].includes(
        getExerciseTags(r.exercise.name)?.movement ?? '')).map(r => `${d.date}:${r.exercise.name}`) ?? []);
    ok(`${gender}: accumulated world contains affected pressing before restriction`, presses(before).length > 0);
    const sets = (day: ReturnType<typeof view>[number]) => day.workout?.exercises.reduce((sum, row) => sum + (row.prescribedSets ?? 0), 0) ?? 0;
    const week = useProgramStore.getState().currentProgram?.microcycles.find(w => w.startDate.slice(0, 10) === weekStart);
    ok(`${gender}: reached week 8 deload after seven logged weeks`, logged > 20 && week?.weekKind === 'deload',
      JSON.stringify({ loggedDays: logged, weekStart, weekKind: week?.weekKind }));
    const mixed = before.filter(d => d.workout?.conditioningBlock?.options.length &&
      d.workout.exercises.some(r => r.exercise.name.includes('Row') && r.section18Evidence?.role !== 'conditioning'));
    ok(`${gender}: mixed conditioning and strength Row coordinate exists`, mixed.length > 0);
    for (const day of mixed) {
      const workout = day.workout!;
      const ids = new Set(workout.conditioningBlock!.options.flatMap(o => o.exerciseIds));
      const untouched = workout.exercises.filter(r => !ids.has(r.id) && r.section18Evidence?.role !== 'conditioning');
      for (const toModality of ['bike', 'row', 'ski'] as const) {
        const rewritten = applyConditioningModalityToWorkout(workout, { fromModality: null, toModality });
        ok(`${gender}: ${day.date} ${toModality} preserves every non-conditioning row and prescription`,
          untouched.every(r => JSON.stringify(rewritten.exercises.find(n => n.id === r.id)) === JSON.stringify(r)));
      }
    }
    const constraint = buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder', severity: 4,
      severityBand: 'slight', adjustmentLevel: 'slight', triggers: ['pressing'], seriousSymptoms: false }, { todayISO: date });
    const action = await quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier',
      scope: 'current_and_future', payload: { constraint }, source, requiresRebuild: false,
      createsActiveModifier: true, oneOffOnly: false }, { todayISO: date }));
    ok(`${gender}: shoulder fact accepted and changes actual prescriptions`, action.ok && baseline !== visibleSignature(view()));
    const active = visibleSignature(view());
    const assertProjection = (phase: string) => {
      let count = 0;
      let error = '';
      try {
        const projected = quiet(() => project({ week: view(), weekStart, program: useProgramStore.getState().currentProgram! }));
        count = projected.days.length;
      } catch (e) { error = String(e); }
      ok(`${gender}: ${phase} projects all seven days with signed exercise identities`, count === 7 && !error, error);
      ok(`${gender}: ${phase} retains valid strength names`, view().every(d => d.workout?.exercises.every(r =>
        !['Barbell Bike', 'Chest-Supported DB Bike'].includes(r.exercise.name)) ?? true));
    };
    assertProjection('live');
    ok(`${gender}: live accumulated week removes the painful movement family`, presses(view()).length === 0, JSON.stringify(presses(view())));
    const doseGrowth = view().filter(day => day.date >= date && sets(day) > sets(before.find(d => d.date === day.date)!));
    ok(`${gender}: shoulder replacement does not increase reduced session sets`, doseGrowth.length === 0,
      JSON.stringify(doseGrowth.map(day => ({ date: day.date, before: sets(before.find(d => d.date === day.date)!), after: sets(day) }))));
    const reboot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`${gender}: injury and prescriptions survive restart`, reboot.ok && visibleSignature(view()) === active);
    assertProjection('restarted');
    ok(`${gender}: restarted accumulated week cannot restore painful pressing`, presses(view()).length === 0, JSON.stringify(presses(view())));
    const cleared = await quietAsync(() => executeProgramControlActionDurably({ type: 'clear_injury_modifier',
      scope: 'current_and_future', payload: { episodeId: action.createdModifierIds?.[0] }, source,
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false }, { todayISO: date }));
    ok(`${gender}: clearing restores the pre-injury week`, cleared.ok && visibleSignature(view()) === baseline);
    assertProjection('cleared');
    const clearBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`${gender}: cleared week survives another restart`, clearBoot.ok && visibleSignature(view()) === baseline);
    assertProjection('cleared/restarted');
  }
}
