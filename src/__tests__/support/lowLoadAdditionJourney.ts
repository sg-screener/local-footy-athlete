import { athleteAnswers } from '../compilerYear/catalog';
import { visibleSignature } from '../compilerYear/invariants';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../../utils/planChangeProducer';
import { undoLastDecision } from '../../store/undoLastDecision';
import { canonicalExerciseName } from '../../utils/exerciseCanonicalisation';
import { project } from '../../rules/projectVisibleWeek';
import { selectMobilityPrehabFlow } from '../../utils/mobilityPrehabFlow';
import { liveAthleteContext } from '../../utils/liveAthleteContext';
import { buildSessionTemplate } from '../../utils/sessionTemplate';
import { buildSessionExecutionPlan, deriveChecklistComponentCompletions } from '../../utils/sessionExecutionChecklist';

export async function lowLoadAdditionJourney(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  const date = '2026-09-28';
  for (const gender of ['male', 'female'] as const) for (const [base, addition] of [
    ['mobility', 'mobility'], ['mobility', 'recovery'], ['recovery', 'mobility'],
    ['recovery', 'recovery'], ['manual_mobility', 'mobility'],
    ['strength', 'mobility'], ['strength', 'recovery'],
  ] as const) {
    const profile = athleteAnswers({ id: `no-duplicates-${gender}`, gender,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      experience: '5+ years', equipment: 'commercial', initialPhase: 'Off-season',
      clubDays: [], gameDay: null, extraGame: false });
    profile.seasonFinishedOn = '2026-09-27';
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view = () => quiet(() => deriveVisibleWeekLive(date, date));
    let target = view().find(day => base === 'strength' ? !!day.workout?.strengthIntent : day.workout?.composedOptionalKind === 'mobility');
    if (!target) throw Error(`Missing actual generated ${base} witness`);
    if (base === 'recovery' || base === 'manual_mobility') {
      const result = quiet(() => applyPlanChange({ change: { kind: 'swap_category', date: target!.date, category: base === 'recovery' ? 'recovery' : 'mobility' },
        visibleWeek: view(), todayISO: date, applyOverride: () => undefined }));
      if (!result.ok) throw Error(JSON.stringify(result));
      target = view().find(day => day.date === target!.date)!;
    }
    const before = visibleSignature(view());
    const original = target.workout!.exercises;
    const ids = new Set(original.map(row => row.id));
    const names = new Set(original.map(row => canonicalExerciseName(row.exercise.name)));
    const warmup = selectMobilityPrehabFlow({ workout: target.workout, seasonPhase: 'Off-season',
      isGameWeek: false, athlete: liveAthleteContext(), date: target.date, performedMovementIds: [] });
    const warmupNames = new Set(warmup?.movements.map(m => canonicalExerciseName(m.exercise.name)));
    const result = quiet(() => applyPlanChange({ change: { kind: 'add_category', date: target!.date, category: addition },
      visibleWeek: view(), todayISO: date, applyOverride: () => undefined }));
    const rows = view().find(day => day.date === target!.date)!.workout!.exercises;
    const added = rows.filter(row => !ids.has(row.id));
    const label = `no-duplicate/${gender}/${base}+${addition}`;
    ok(`${label}: actual Add preserves existing exercises and creates distinct rows`, result.ok && added.length > 0
      && original.every(row => rows.some(next => next.id === row.id && next.exercise.name === row.exercise.name)), JSON.stringify({result, added: added.map(row => row.exercise.name)}));
    ok(`${label}: added session checks every existing drill, including strength warm-ups`, added.length > 0
      && added.every(row => !names.has(canonicalExerciseName(row.exercise.name)))
      && new Set(added.map(row => canonicalExerciseName(row.exercise.name))).size === added.length, JSON.stringify({original:[...names],added:added.map(row=>row.exercise.name)}));
    ok(`${label}: no row identity is reused`, new Set(rows.map(row => row.id)).size === rows.length);
    if (base === 'strength') ok(`${label}: the separately derived visible warm-up is excluded too`,
      warmupNames.size > 0 && added.every(row => !warmupNames.has(canonicalExerciseName(row.exercise.name))),
      JSON.stringify({warmup:[...warmupNames],added:added.map(row=>row.exercise.name)}));
    if ((base === 'mobility' || base === 'manual_mobility') && addition === 'mobility') {
      const parts = project({week:view(),weekStart:date}).days.find(day=>day.date===target!.date)!.parts;
      ok(`${label}: a second session stays separately visible, not merged into the first`,parts.filter(part=>part.headline==='Mobility').length===2,
        JSON.stringify({parts:parts.map(part=>({id:part.id,headline:part.headline})),groups:[...new Set(rows.map(row=>row.workoutId))]}));
      const workout = view().find(day=>day.date===target!.date)!.workout!;
      const execution = buildSessionExecutionPlan({workout, template:buildSessionTemplate(workout),mobilityFlow:null});
      const second = execution.components.find(component=>component.id==='mobility-session-2');
      const firstItems = execution.items.filter(item=>item.componentId==='mobility');
      const secondItems = execution.items.filter(item=>item.componentId===second?.id);
      ok(`${label}: each actual exercise appears once in the session checklist`,new Set(execution.items.map(item=>item.id)).size===execution.items.length
        && execution.items.filter(item=>item.source==='template').length===rows.length);
      const completions = deriveChecklistComponentCompletions(execution,new Set(secondItems.map(item=>item.id)));
      ok(`${label}: completing the second session does not complete the first`,firstItems.length>0 && secondItems.length===added.length
        && completions.mobility==='skipped' && completions['mobility-session-2']==='full',JSON.stringify({completions,secondItems}));
      const options = listPlanChangeOptionsForDay({date:target!.date,visibleWeek:view(),todayISO:date});
      ok(`${label}: two separate sessions still reach the existing daily Add limit`,options.visibleSessionCount===2
        && options.addOnTopCategories.length===0,JSON.stringify(options));
    }
    const after = visibleSignature(view());
    const boot = await quietAsync(() => relaunchApp({storage, todayISO: date}));
    ok(`${label}: added content survives restart`, boot.ok && visibleSignature(view()) === after);
    const undo = await quietAsync(() => undoLastDecision());
    ok(`${label}: Undo restores the exact earlier day`, undo.outcome === 'undone' && visibleSignature(view()) === before);
    const undoBoot = await quietAsync(() => relaunchApp({storage, todayISO: date}));
    ok(`${label}: Undo survives restart`, undoBoot.ok && visibleSignature(view()) === before);
  }
}
