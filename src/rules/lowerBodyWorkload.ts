/** Actual lower-body working dose for Speed placement. No stored fatigue label. */
import type { Workout, OnboardingData } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { selectMobilityPrehabFlow } from '../utils/mobilityPrehabFlow';
import { equipmentTagsOnDate } from './canonicalWeeklyAvailabilityState';
import { strengthWorkAreas, recoveryAddonSets } from './trainingWorkload';
import { injuryAllowsContextExercise } from './datedAthleteContext';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { getExerciseTags } from '../data/exerciseTags';
import { isoDateForWeekday } from '../utils/appDate';
import type { LowerBodyWorkload } from './weeklyScheduler';

export interface StrengthTrainingRecord {
  readonly dateStr: string;
  readonly completion: string;
  readonly strength?: readonly StrengthExercisePerformanceLog[];
  readonly components?: readonly { readonly kind: string; readonly completion: string }[];
}

export function lowerBodyWorkloadForWeek(input: {
  readonly profile?: OnboardingData;
  readonly activeConstraints?: readonly ActiveConstraint[];
  readonly workouts: readonly Workout[];
  readonly weekStartISO: string;
  readonly completedBeforeISO?: string;
  readonly feedback?: Readonly<Record<string, StrengthTrainingRecord>>;
}): Readonly<Record<number, LowerBodyWorkload>> {
  return Object.fromEntries([0,1,2,3,4,5,6].map(day => {
    const date = isoDateForWeekday(input.weekStartISO, day);
    const work = input.workouts.filter(workout => workout.dayOfWeek === day);
    const rows = work.flatMap(workout => {
      const parts = getSessionComponentRows(workout);
      return [...parts.strengthRows, ...parts.supportRows, ...parts.mobilityRows, ...parts.recoveryRows];
    });
    const past = input.completedBeforeISO !== undefined && date < input.completedBeforeISO;
    const record = past ? Object.values(input.feedback ?? {}).find(entry => entry.dateStr === date) : undefined;
    const strengthSkipped = record?.components?.find(part => part.kind === 'strength')?.completion === 'skipped';
    const strengthIds = new Set(work.flatMap(workout => getSessionComponentRows(workout).strengthRows.map(row => row.id)));
    if (record?.completion === 'skipped') return [day, {workingSets:0, powerSets:0, unknown:false}];
    let workingSets = 0; let unknown = false;
    const accounted = new Set<string>();
    for (const row of rows) {
      if (row.unavailableForInjury || (strengthSkipped && strengthIds.has(row.id))) continue;
      const tag = getExerciseTags(row.exercise.name);
      if (tag && (tag.region !== 'lower' || strengthWorkAreas(row.exercise.name).length===0)) continue;
      if (!tag) { unknown = true; continue; }
      const log = record?.strength?.find(entry => entry.workoutExerciseId === row.id)
        ?? record?.strength?.find(entry => entry.exerciseName === row.exercise.name);
      if (log) accounted.add(log.workoutExerciseId);
      if (log?.completion === 'skipped') continue;
      const sets = log?.completedSets ?? (log?.completion === 'full' ? log.prescribedSets : row.prescribedSets);
      if (past && (!log || (log.completion === 'partial' && log.completedSets === undefined))) unknown = true;
      if (Number.isFinite(sets) && sets >= 0) workingSets += sets;
      else unknown = true;
    }
    // Completed manual additions may no longer be present in the generated draft.
    for (const log of strengthSkipped ? [] : record?.strength ?? []) {
      if (accounted.has(log.workoutExerciseId) || log.completion === 'skipped') continue;
      const tag = getExerciseTags(log.exerciseName);
      if (!tag) { unknown = true; continue; }
      if (tag.region !== 'lower' || strengthWorkAreas(log.exerciseName).length===0) continue;
      const sets = log.completedSets ?? log.prescribedSets;
      if (log.completion === 'partial' && log.completedSets === undefined) unknown = true;
      if (Number.isFinite(sets) && sets >= 0) workingSets += sets;
      else unknown = true;
    }
    let powerSets=0;
    for(const workout of work) {
      const parts=getSessionComponentRows(workout);
      const power = parts.powerRows.filter(row=>getExerciseTags(row.exercise.name)?.region==='lower' && !row.unavailableForInjury);
      const powerCompletion = record?.components?.find(part=>part.kind==='power')?.completion;
      if (powerCompletion !== 'skipped') {
        powerSets += power.reduce((sum,row)=>sum+Math.max(0,row.prescribedSets),0);
        if (past && power.length && powerCompletion !== 'full') unknown=true;
      }
      const addonCompletion=record?.components?.find(part=>part.kind==='recovery_addon')?.completion;
      if(addonCompletion!=='skipped')for(const row of workout.recoveryAddons?.flatMap(addon=>addon.exercises)??[]) {
        if(!strengthWorkAreas(row.name).length||getExerciseTags(row.name)?.region!=='lower')continue;
        if(input.profile && !injuryAllowsContextExercise(row.name,{onboardingData:input.profile,
          injuries:input.profile.injuries??[],equipmentTags:[],activeConstraints:input.activeConstraints},date))continue;
        const sets=recoveryAddonSets(row.prescription);
        if(sets===null)unknown=true;else workingSets+=sets;
        if(past && addonCompletion!=='full')unknown=true;
      }
      if(input.profile && !past) {
        const flow=selectMobilityPrehabFlow({workout,seasonPhase:input.profile.seasonPhase,isGameWeek:false,
          date,performedMovementIds:[],athlete:{onboardingData:input.profile,injuries:input.profile.injuries??[],
            activeConstraints:input.activeConstraints,equipmentTags:equipmentTagsOnDate(input.profile,date,[])}});
        workingSets+=(flow?.movements??[]).filter(m=>getExerciseTags(m.exercise.name)?.region==='lower'
          && strengthWorkAreas(m.exercise.name).length>0).reduce((sum,m)=>sum+m.exercise.sets,0);
      }
    }
    // Per-side prescriptions already express sets experienced by each leg.
    return [day, {workingSets, powerSets, unknown}];
  }));
}
