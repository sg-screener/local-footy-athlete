/** Preserve the athlete's accepted row coordinates before a profile rebuild. */
import { decisionLedgerEntries, appendDecisionEntry } from './decisionLedgerStore';
import { replayableEntries } from '../rules/decisionLedgerReplay';
import { captureAcceptedExerciseTarget, type AcceptedExerciseTarget } from '../rules/acceptedExerciseTarget';
import { resolveDateWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveTapSwapEnvironment, assessTapSwapCandidateSafety } from '../utils/tapSwapHierarchy';
import { useProfileStore } from './profileStore';
import { useCoachUpdatesStore } from './coachUpdatesStore';
import { useReadinessStore } from './readinessStore';
import type { WorkoutExercise } from '../types/domain';
export interface AcceptedExerciseChoice {
  entryId: string; date: string; name: string; row: WorkoutExercise;
  upgrade?: AcceptedExerciseTarget;
}
function workoutOn(date: string) {
  return resolveDateWithConditioning(date,buildScheduleStateImperative())?.workout;
}
export function captureAcceptedExerciseChoices(today: string): AcceptedExerciseChoice[] {
  const entries = decisionLedgerEntries();
  const upgraded = new Set(entries.flatMap(e=>e.decision.kind==='legacy_exercise_target_upgrade'?[e.decision.sourceEntryId]:[]));
  return replayableEntries(entries).flatMap(entry=>{
    if(entry.decision.kind!=='program_control')return [];
    const action=entry.decision.action;
    if(action.type!=='swap_exercise'||action.payload.derivedSource||!action.payload.toExercise||action.payload.date<today)return [];
    const workout=workoutOn(action.payload.date);
    if(!workout)return [];
    const rows=workout.exercises.filter(row=>row.exercise.name===action.payload.toExercise!.name);
    // A subsequent swap/removal or an already displaced row is not an active
    // visible choice. Ambiguous duplicate names are never used to invent a seat.
    if(rows.length!==1)return [];
    const row=rows[0]!;
    return [{entryId:entry.id,date:action.payload.date,name:row.exercise.name,row,
      ...(!action.payload.acceptedTarget&&!upgraded.has(entry.id)
        ? {upgrade:captureAcceptedExerciseTarget(workout,row)} : {})}];
  });
}
export function upgradeAcceptedExerciseChoices(choices: readonly AcceptedExerciseChoice[]): void {
  for(const c of choices)if(c.upgrade){
    const result=appendDecisionEntry({writer:'migration',provenance:'migration',decision:{
      kind:'legacy_exercise_target_upgrade',sourceEntryId:c.entryId,acceptedTarget:c.upgrade}});
    if(!result.ok)throw Error('exercise_target_upgrade_refused');
  }
}
export function acceptedExerciseChoicesSurvive(choices: readonly AcceptedExerciseChoice[]): boolean {
  return choices.every(c=>{
    const environment=resolveTapSwapEnvironment({date:c.date,scheduleState:buildScheduleStateImperative(),
      profile:useProfileStore.getState().onboardingData,
      activeConstraints:useCoachUpdatesStore.getState().activeConstraints,
      readinessSignal:useReadinessStore.getState().signalsByDate[c.date]});
    // Newly unsafe work is still handled by the existing injury/equipment
    // owner. This assertion does not bypass those restrictions.
    if(!assessTapSwapCandidateSafety(c.name,environment).safe)return true;
    return !!workoutOn(c.date)?.exercises.some(row=>row.exercise.name===c.name
      && ['prescribedWeightKg','prescribedSets','prescribedRepsMin','prescribedRepsMax','prescriptionType','perSide'].every(key=>row[key as keyof WorkoutExercise]===c.row[key as keyof WorkoutExercise]));
  });
}
