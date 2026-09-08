// R-386: real onboarding, optional feedback and input-only reload. No native UI.
process.env.TZ='Australia/Melbourne';global.__DEV__=true;
const storage=new Map();global.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),clear:()=>storage.clear()}};
global.fetch=()=>{throw Error('Network disabled')};require('sucrase/register');
const assert=require('assert/strict');const {coldStartThroughOnboarding,quietAsync,recordDay,relaunchApp}=require('./support/athleteJourney');
const {useProgramStore,recordAcceptedBlock}=require('../store/programStore');
const {readBlockHistory}=require('../rules/blockBoundaryProgression');
const profile=require('./fixtures/yearproofReportedInputs.json').profile;
const daySets={2:['Monday','Thursday'],3:['Monday','Wednesday','Thursday'],4:['Monday','Tuesday','Wednesday','Thursday'],5:['Monday','Tuesday','Wednesday','Thursday','Friday']};
const shape=program=>program.microcycles.map(w=>({date:w.startDate,workouts:w.workouts.map(d=>({day:d.dayOfWeek,tier:d.sessionTier,rows:d.exercises.map(r=>({name:r.exercise.name,sets:r.prescribedSets,min:r.prescribedRepsMin,max:r.prescribedRepsMax,type:r.prescriptionType,kg:r.prescribedWeightKg,side:r.perSide}))}))}));
(async()=>{let passed=0;for(const n of [2,3,4,5]){
 storage.clear();const install=await quietAsync(()=>coldStartThroughOnboarding({profile:{...profile,trainingDaysPerWeek:n,preferredTrainingDays:daySets[n]},installDayISO:'2026-09-28'}));
 assert.equal(install.onboardingRefusal,null);const state=useProgramStore.getState();const start=install.blockOneStart;
 const record=state.acceptedBlocks[start];assert.equal(record.requiredStrengthSessions,2*Math.min(n,4));assert.equal(record.requiredStrengthDates.length,record.requiredStrengthSessions);passed+=2;
 // Deliberately supply the previously written input shape to prove correction
 // from this actual accepted program, without inventing a historical programme.
 const feedbackBefore=JSON.stringify(state.sessionFeedback);
 useProgramStore.setState({acceptedBlocks:{...state.acceptedBlocks,[start]:{blockNumber:record.blockNumber,requiredStrengthSessions:record.requiredStrengthSessions*2}}});
 recordAcceptedBlock({program:state.currentProgram,blockState:state.blockState});
 assert.deepEqual(useProgramStore.getState().acceptedBlocks[start],record);assert.equal(JSON.stringify(useProgramStore.getState().sessionFeedback),feedbackBefore);passed+=2;
 const result=await quietAsync(()=>recordDay('2026-09-28',{record:true,completion:'full',feeling:'good',soreness:'none',difficulty:4,logWeights:true}));assert.equal(result.result,'recorded',JSON.stringify(result));
 const feedback=useProgramStore.getState().sessionFeedback;assert.equal(feedback['2026-09-28'].strengthRequired,false);
 const h=readBlockHistory({feedbackByDate:feedback,blockStartISO:start,blockEndISO:'2026-10-25',requiredStrengthSessions:record.requiredStrengthSessions,requiredStrengthDates:record.requiredStrengthDates});
 assert.equal(h.completedStrengthSessions,0);assert.equal(h.completedOptionalStrengthSessions,1);assert.equal(h.qualifies,false);passed+=5;
 const before=shape(useProgramStore.getState().currentProgram);const reload=await quietAsync(()=>relaunchApp({storage,todayISO:'2026-09-28'}));assert(reload.ok,reload.error);
 assert.deepEqual(shape(useProgramStore.getState().currentProgram),before);assert.equal(useProgramStore.getState().sessionFeedback['2026-09-28'].strengthRequired,false);passed+=3;
 console.log(`PASS ${n}-day athlete: required dates, legacy-count correction, optional credit and exact prescription reload`);
 }console.log(`Yearproof real journeys: ${passed} assertions passed across four onboarding frequencies.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
