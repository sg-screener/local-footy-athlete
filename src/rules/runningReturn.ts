import type { Workout, WorkoutExercise, SeasonPhase } from '../types/domain';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { canonicalWeeklyInjuryStateFrom } from './canonicalWeeklyInjuryState';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import { composeConditioningRows, speedTemplateByName } from './conditioningSelection';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { getExerciseTags } from '../data/exerciseTags';
import { runningReturnPrescription } from './runningReturnDose';
export { runningReturnPrescription } from './runningReturnDose';

export type RunningReturnStage = 1 | 2 | null;
const calendarDay=(date:string)=>Date.parse(date.slice(0,10)+'T00:00:00Z')/86400000;

/** A simple two-week return, derived from existing phase and resolved injury dates. */
export function runningReturnStage(args:{dateISO:string;seasonPhase?:SeasonPhase|null;
  phaseWeekNumber?:number|null;constraints?:readonly ActiveConstraint[]}):RunningReturnStage {
  let stage:RunningReturnStage=args.seasonPhase==='Off-season'
    && (args.phaseWeekNumber===5 || args.phaseWeekNumber===6) ? args.phaseWeekNumber-4 as 1|2:null;
  for(const injury of args.constraints??[]) {
    if(injury.type!=='injury' || !injury.expiresAt)continue;
    const elapsed=calendarDay(args.dateISO)-calendarDay(injury.expiresAt)-1;
    const duration=calendarDay(injury.expiresAt)-calendarDay(injury.startDate)+1;
    if(duration<7 || elapsed<0 || elapsed>=14)continue;
    const restriction=canonicalWeeklyInjuryStateFrom({profile:{injuries:[]},
      generationConstraints:buildGenerationConstraintContext({activeConstraints:[{...injury,status:'active'}],todayISO:injury.startDate.slice(0,10)})});
    if(!restriction.blocksAppSprint)continue;
    const returning=elapsed<7?1:2;
    stage=stage===null?returning:Math.min(stage,returning) as 1|2;
  }
  return stage;
}

/** Replaces existing automatic field work; never adds a session or changes lifts. */
export function applyRunningReturn(workout:Workout,dateISO:string,stage:RunningReturnStage):Workout {
  if(!stage || workout.athletePlacement || workout.workoutType==='Game' || workout.isTeamDay
    && !workout.speedBlock && !workout.conditioningBlock)return workout;
  const parts=getSessionComponentRows(workout);
  const base=composeConditioningRows(speedTemplateByName('20 m Acceleration Reps'),dateISO,{omitWarmup:true})[0];
  const reps=Math.max(1,Math.floor(base.prescribedSets*(stage===1?0.5:0.75)));
  const prescription=runningReturnPrescription(stage,reps);
  const title=stage===1?'Controlled run-throughs':'Faster runs and controlled turns';
  let exercises=[...workout.exercises];
  let changed=false;
  const replace=(ids:readonly string[]):string[]=>{
    const targets=exercises.filter(row=>ids.includes(row.id));
    if(!targets.length || targets.some(row=>row.athleteAdditionId))return [...ids];
    const first=targets.find(row=>row.exercise.name!=='Warm-up')??targets[0];
    if (targets.length===1 && first.notes===prescription && first.prescribedSets===reps) return [...ids];
    const row:WorkoutExercise={...base,id:first.id,workoutId:workout.id,exerciseOrder:first.exerciseOrder,
      prescribedSets:reps,notes:prescription,automaticSelection:true,
      optionalNoPenalty:first.optionalNoPenalty,createdAt:first.createdAt,updatedAt:first.updatedAt};
    exercises=exercises.flatMap(existing=>existing.id===first.id?[row]:ids.includes(existing.id)?[]:[existing]);
    changed=true;return [row.id];
  };
  let speedBlock=workout.speedBlock;
  if (speedBlock && (!speedBlock.modality || speedBlock.modality==='run')
    && parts.speedRows.length && !parts.speedRows.some(row=>row.athleteAdditionId)) {
    speedBlock={...speedBlock,exerciseIds:replace(parts.speedRows.map(row=>row.id)),
      title,label:title,templateName:'20 m Acceleration Reps',prescription,notes:[prescription],durationMinutes:reps*2};
  }
  const conditioningBlock=workout.conditioningBlock?{...workout.conditioningBlock,
    options:workout.conditioningBlock.options.map(option=>{
      if(option.modality!=='running' || exercises.some(row=>option.exerciseIds.includes(row.id)&&row.athleteAdditionId))return option;
      const exerciseIds=replace(option.exerciseIds);
      // Options retain the authored identity used by equipment/selection rules.
      // The shared return sheet supplies the actual introductory prescription.
      if(option.title!==base.exercise.name)changed=true;
      return {...option,exerciseIds,title:base.exercise.name,description:prescription,
        durationMinutes:reps*2,intensity:'Light' as const};
    })}:undefined;
  // Returning jump exposure is reduced by repetitions, retaining proper strength.
  const powerIds=new Set(parts.powerRows.filter(row=>getExerciseTags(row.exercise.name)?.region==='lower').map(row=>row.id));
  exercises=exercises.map(row=>{
    if(!powerIds.has(row.id)||row.athleteAdditionId)return row;
    // A returning primer uses a small absolute rep ceiling. This is repeatable
    // on reopened rows and never increases an already smaller prescription.
    const ceiling=stage===1?2:3;
    const reduced=Math.max(1,Math.min(ceiling,row.prescribedRepsMin));
    if (reduced===row.prescribedRepsMin && reduced===row.prescribedRepsMax) return row;
    changed=true;
    return {...row,prescribedRepsMin:reduced,prescribedRepsMax:reduced};
  });
  return changed?{...workout,exercises,speedBlock,conditioningBlock,runningReturnStage:stage}:workout;
}

/** Introductory straight runs do not claim cutting exposure. */
export function runningReturnAthleticExposure(stage:RunningReturnStage):'cod_decel'|undefined {
  return stage===2?'cod_decel':undefined;
}
