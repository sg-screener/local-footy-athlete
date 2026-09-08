import { decideExerciseForBlock, type ExerciseSelectionInputs } from '../../rules/blockExerciseSelection';
import { eligiblePowerExercises, selectPowerExercise } from '../../rules/powerExercisePool';

export function programmingSelectionDecisions(ok: (label: string, value: boolean, detail?: string) => void) {
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as const) {
    for (const [slot, fallback, preferred] of [['hinge', 'Deadlift', 'RDLs'], ['squat', 'Leg Press', 'Front Squat']] as const) {
      const input = {phase, blockNumber:3, slot, group:null, role:'main_bilateral',
        legalCandidates:[fallback, preferred], previousSelection:null, currentBlockSelection:null,
        recentSelections:[], progressedIdentities:[], pinnedIdentities:[]} as unknown as ExerciseSelectionInputs;
      ok(`selection/${phase}/${fallback}: automatic selection uses suitable alternatives`, decideExerciseForBlock(input).identity === preferred);
      ok(`selection/${phase}/${fallback}: fallback remains available when it is the only legal exercise`,
        decideExerciseForBlock({...input,legalCandidates:input.legalCandidates.slice(0,1)}).identity === fallback);
      ok(`selection/${phase}/${fallback}: explicit preference remains available`,
        decideExerciseForBlock({...input,pinnedIdentities:[input.legalCandidates[0]]}).identity === fallback);
      ok(`selection/${phase}/${fallback}: accepted checkpoint selection is not silently rewritten`,
        decideExerciseForBlock({...input,currentBlockSelection:{identity:fallback} as never}).identity === fallback);
    }
    // R-383: Broad Jumps and Jump Squats are ordinary alternatives from 1+
    // years, while complete beginners retain Vertical Jump and Box Jumps.
    for (const trainingAge of ['new', 'developing', 'consistent', 'advanced'] as const) {
      const context = {family:'lower',phase,trainingAge,reduced:false,availableEquipment:['plyo_box'],blockId:'block-1'} as const;
      const pool = eligiblePowerExercises(context).map(row=>row.name);
      const selected = Array.from({length:128},(_,i)=>selectPowerExercise({...context,blockId:`block-${i}`}));
      for (const name of ['Vertical Jump','Box Jumps','Broad Jumps','Jump Squats']) {
        const allowed = trainingAge !== 'new' || name === 'Vertical Jump' || name === 'Box Jumps';
        ok(`power/${phase}/${trainingAge}/${name}: authored experience eligibility`,pool.includes(name) === allowed);
        ok(`power/${phase}/${trainingAge}/${name}: actual block selector respects eligibility`,
          selected.some(row=>row?.name===name) === allowed);
      }
      ok(`power/${phase}/${trainingAge}: box still requires actual equipment`, !eligiblePowerExercises({...context,availableEquipment:[]}).some(row=>row.name==='Box Jumps'));
      ok(`power/${phase}/${trainingAge}: existing niggle takeover remains intact`,selectPowerExercise({...context,reduced:true})?.name==='Pogo Hops');
    }
  }
}
