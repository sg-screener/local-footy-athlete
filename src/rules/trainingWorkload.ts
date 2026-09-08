import { muscleMetadataFor } from '../data/muscleExperienceMetadata';
import { getExerciseTags } from '../data/exerciseTags';
import { POOL_REGISTRY } from '../data/exercisePools';
import type { Workout, WorkoutExercise } from '../types/domain';

export interface StrengthWorkRow {
  exercise?: { name: string };
  prescribedSets: number;
  unavailableForInjury?: WorkoutExercise['unavailableForInjury'];
}

/** Saved add-ons and ordinary rows share the same physiological dose ledger. */
export function prehabWorkRows(workout: Partial<Workout>): StrengthWorkRow[] {
  return [...(workout.exercises ?? []), ...(workout.recoveryAddons ?? []).flatMap(addon =>
    addon.exercises.flatMap(row => {
      const sets = recoveryAddonSets(row.prescription);
      return sets === null ? [] : [{exercise:{name:row.name},prescribedSets:sets}];
    }))];
}

const LIGHT_POOLS = new Set(['Mobility','Tissue quality','Breathing','Recovery','Stretching']);

/** Activity, not its section heading, determines whether it loads an area. */
export function strengthWorkAreas(name: string): readonly string[] {
  const metadata=muscleMetadataFor(name);
  const tags=getExerciseTags(name);
  if(!metadata || LIGHT_POOLS.has(metadata.pool) || /mobility|stretch|tissue|breathing/i.test(metadata.pool)
    || tags?.movement==='conditioning' || tags?.movement==='plyo') return [];
  return metadata.primary;
}

export function isDemandingPrehab(name: string): boolean {
  const metadata=muscleMetadataFor(name);
  const tags=getExerciseTags(name);
  return !!metadata && /prehab|shoulder health|groin|hamstring.light/i.test(metadata.pool)
    && (tags?.fatigue==='moderate' || tags?.fatigue==='high') && strengthWorkAreas(name).length>0;
}

export function areasAlreadyLoaded(name: string, rows: readonly StrengthWorkRow[]): boolean {
  const areas=strengthWorkAreas(name);
  return areas.length>0 && rows.some(row=>row.prescribedSets>0 && !row.unavailableForInjury
    && strengthWorkAreas(row.exercise?.name ?? '').some(area=>areas.includes(area)));
}

/** A light touch remains when strength has already loaded the same area. */
export function prehabSets(name: string, sets: number, loadedRows: readonly StrengthWorkRow[], reduced: boolean): number {
  if (!isDemandingPrehab(name)) return sets;
  if (areasAlreadyLoaded(name,loadedRows)) return Math.min(sets,1);
  if (!reduced) return sets;
  const authored=Object.values(POOL_REGISTRY).flat().find(entry=>entry.name===name)?.sets ?? sets;
  return Math.min(sets,Math.max(1,Math.floor(authored*0.5)));
}

export function reduceDemandingPrehab(workout:Workout, reduced:boolean):Workout {
  const main=workout.exercises.filter(row=>!isDemandingPrehab(row.exercise.name));
  const loaded=[...main];
  let changed=false;
  const exercises=workout.exercises.map(row=>{
    if (!isDemandingPrehab(row.exercise.name)) return row;
    const sets=row.athleteAdditionId ? row.prescribedSets : prehabSets(row.exercise.name,row.prescribedSets,loaded,reduced);
    loaded.push(row);
    if (sets===row.prescribedSets) return row;
    changed=true; return {...row,prescribedSets:sets};
  });
  const addonLoaded: StrengthWorkRow[] = [...exercises];
  const recoveryAddons=workout.recoveryAddons?.map(addon=>({...addon,exercises:addon.exercises.map(row=>{
    const authored=recoveryAddonSets(row.prescription);
    if (authored===null) return row;
    const sets=prehabSets(row.name,authored,addonLoaded,reduced);
    addonLoaded.push({exercise:{name:row.name},prescribedSets:sets});
    if (sets===authored) return row;
    changed=true;
    return {...row,prescription:row.prescription.replace(/^\s*\d+(?=\s*[x×])/,String(sets))};
  })}));
  return changed?{...workout,exercises,recoveryAddons}:workout;
}

/** Read the existing add-on dose notation; unknown text is never zero work. */
export function recoveryAddonSets(prescription:string):number|null {
  const match=/^\s*(\d+)\s*[x×]/.exec(prescription);
  return match ? Number(match[1]) : null;
}
