'use strict';
require('sucrase/register');
if(process.env.LEG_PROGRAMMING_MUTATION)require('../../scripts/test-leg-programming-mutations.cjs').installMutation(process.env.LEG_PROGRAMMING_MUTATION);
global.__DEV__=true;process.env.TZ='Australia/Melbourne';
const disk=new Map();global.window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k),clear:()=>disk.clear()}};
global.fetch=()=>{throw Error('No network in isolated programming journey');};
const assert=require('node:assert/strict');
const j=require('./support/athleteJourney');
const {athleteAnswers,plusDays}=require('./compilerYear/catalog');
const {presetEquipmentAnswer}=require('./support/equipmentAnswerFixture');
const {deriveVisibleWeekLive}=require('../utils/deriveVisibleWeek');
const {visibleSignature}=require('./compilerYear/invariants');
const {footballRobustnessCategoriesForExercise:categories}=require('../rules/footballRobustnessFoundation');
const {getSessionComponentRows}=require('../utils/sessionComponents');
const {selectMobilityPrehabFlow}=require('../utils/mobilityPrehabFlow');
const {resolveEquipmentCapabilities}=require('../utils/equipmentAvailability');
const {buildGuidedInjuryConstraint}=require('../utils/guidedInjuryControl');
const {executeProgramControlActionDurably}=require('../utils/programControlActions');
const start='2026-09-28';const source={screen:'my_status',surface:'status_card',initiatedBy:'tap'};
let checks=0;function check(ok,message){checks++;assert.ok(ok,message);}
// Observe real compiler calls, including trials and final/injury completion.
// A missing optional context argument must fail before a week can be accepted.
const coverage=require('../rules/weeklyLegCoverage');
const doseCalls=new Map();
for(const name of ['completeWeeklyLegCoverage','completeWeeklySupport']) {
 const original=coverage[name];const dated=new Set();doseCalls.set(name,dated);
 coverage[name]=args=>{
  assert.equal(typeof args.dosePolicyForDate,'function',`${name}: compiler dose context is required at the production call`);
  for(const date of Object.keys(args.workoutsByDate))if(args.dosePolicyForDate(date))dated.add(date);
  return original(args);
 };
}
(async()=>{
 const profile={...athleteAnswers({id:'leg-programming',gender:'female',days:['Monday','Wednesday','Friday'],experience:'2-5 years',equipment:'commercial',initialPhase:'Off-season',clubDays:[],gameDay:null,extraGame:false}),seasonFinishedOn:plusDays(start,-1),equipmentAnswer:presetEquipmentAnswer('commercial_gym',start)};
 const installed=await j.quietAsync(()=>j.coldStartThroughOnboarding({profile,installDayISO:start}));check(!installed.onboardingRefusal,'real onboarding');
 for(let week=1;week<=8;week++) {
  const date=plusDays(start,(week-1)*7);j.setJourneyClock(date);
  const rolled=j.quiet(()=>j.rolloverIfDue(date));check(!rolled.refusal,`week ${week} rollover`);
  const view=()=>j.quiet(()=>deriveVisibleWeekLive(date,date));const days=view();
  const rows=days.flatMap(d=>d.workout?.exercises??[]).filter(r=>r.prescribedSets>0&&!r.unavailableForInjury);
  for(const category of ['calf_or_soleus','hamstring_eccentric_or_isometric'])check(rows.some(r=>categories(r.exercise.name).includes(category)),`week ${week} missing ${category}: ${rows.map(r=>r.exercise.name).join(', ')}`);
  const field=days.flatMap(d=>d.workout?getSessionComponentRows(d.workout).speedRows:[]);
  if(week<=4)check(field.length===0,`preparation week ${week} remains off feet`);
  if(week===5||week===6) {check(field.length>0,`week ${week} actually reaches running`);check(field.some(r=>r.notes?.includes(week===5?'controlled run-through':'controlled change of direction')),`week ${week} reaches staged prescription`);}
  if(week===7)check(!field.some(r=>r.notes?.includes('controlled run-through')), 'normal running resumes after staged return');
  const before=visibleSignature(days);check((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:date}))).ok,`week ${week} reopens`);assert.equal(visibleSignature(view()),before,`week ${week} exact reopened display`);checks++;
  console.log('REACHED',week,date,rows.filter(r=>categories(r.exercise.name).length).map(r=>`${r.exercise.name}:${r.prescribedSets}`).join('|'));
  for(let d=0;d<7;d++) {const on=plusDays(date,d);j.setJourneyClock(on);const result=await j.quietAsync(()=>j.recordDay(on,{record:true,completion:'full',difficulty:7,feeling:'hard',soreness:'none',logWeights:true,conditioningRpe:6}));check(!['refused','threw'].includes(result.result),`${on} records actual displayed work`);}
 }
 const date=plusDays(start,56);j.setJourneyClock(date);j.quiet(()=>j.rolloverIfDue(date));
 const constraint=buildGuidedInjuryConstraint({region:'lower_body',area:'Calf / Achilles',severity:6,severityBand:'moderate',adjustmentLevel:'moderate',triggers:['running'],seriousSymptoms:false},{todayISO:date});
 const injury=await j.quietAsync(()=>executeProgramControlActionDurably({type:'set_injury_modifier',scope:'current_and_future',payload:{constraint},source,requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},{todayISO:date}));
 check(injury.ok && !!injury.createdModifierIds?.length,'injury report accepted');
 const state=require('../store/programStore').useProgramStore.getState();
 const current=require('../store/profileStore').useProfileStore.getState().onboardingData;
 const constraints=state.acceptedMaterialContext.activeConstraints;
 const days=j.quiet(()=>deriveVisibleWeekLive(date,date));
 for(const day of days.filter(d=>d.workout)) {
  const flow=selectMobilityPrehabFlow({workout:day.workout,seasonPhase:current.seasonPhase,isGameWeek:false,date:day.date,performedMovementIds:[],athlete:{onboardingData:current,injuries:[],activeConstraints:constraints,equipmentTags:resolveEquipmentCapabilities(current).tags}});
  check(!(flow?.movements??[]).some(m=>categories(m.exercise.name).includes('calf_or_soleus')),'calf injury governs derived warm-up too');
 }
 const returnedDate=plusDays(date,14);j.setJourneyClock(returnedDate);j.quiet(()=>j.rolloverIfDue(returnedDate));
 const cleared=await j.quietAsync(()=>executeProgramControlActionDurably({type:'clear_injury_modifier',scope:'current_and_future',payload:{episodeId:injury.createdModifierIds[0]},source,requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},{todayISO:returnedDate}));
 check(cleared.ok,'actual recovery door accepts exact injury episode');
 const returned=j.quiet(()=>deriveVisibleWeekLive(returnedDate,returnedDate));
 const returnedRows=returned.flatMap(d=>d.workout?.exercises??[]).filter(r=>!r.unavailableForInjury);
 check(returnedRows.some(r=>categories(r.exercise.name).includes('calf_or_soleus')),'recovery reopens calf options');
 const runs=returned.flatMap(d=>d.workout?getSessionComponentRows(d.workout).speedRows:[]);
 check(runs.length>0,'recovery reaches a real returning field session');
 check(runs.some(r=>r.notes?.includes('controlled run-through')),'recovery reduces returning sprint reps after layoff');
 const beforeReturn=visibleSignature(returned);check((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:returnedDate}))).ok,'recovered program reopens');
 assert.equal(visibleSignature(j.quiet(()=>deriveVisibleWeekLive(returnedDate,returnedDate))),beforeReturn);checks++;
 const {changePermanentEquipment}=require('./support/settingsJourney');
 const allKit=presetEquipmentAnswer('commercial_gym',returnedDate);
 const noEquipment={tags:Object.fromEntries(Object.keys(allKit.tags).map(k=>[k,['dumbbells','bench'].includes(k)?'have':'never'])),modalities:Object.fromEntries(Object.keys(allKit.modalities).map(k=>[k,'never'])),answeredOn:returnedDate};
 const removedKit=await j.quietAsync(()=>changePermanentEquipment({answer:noEquipment,todayISO:returnedDate}));
 check(removedKit.ok,'real equipment change saves '+JSON.stringify(removedKit));
 const noKit=j.quiet(()=>deriveVisibleWeekLive(returnedDate,returnedDate));
 const noKitRows=noKit.flatMap(d=>d.workout?.exercises??[]).filter(r=>r.prescribedSets>0&&!r.unavailableForInjury);
 const {suppliesAlternativeHamstringWork}=require('../rules/footballRobustnessFoundation');
 check(noKitRows.some(r=>suppliesAlternativeHamstringWork(r.exercise.name)),'restricted-kit week retains suitable hamstring work');
 check(noKitRows.some(r=>categories(r.exercise.name).includes('calf_or_soleus')),'restricted-kit week retains calf strength');
 console.log('REACHED dumbbells and bench',noKitRows.map(r=>r.exercise.name).join('|'));
 const restoredKit=await j.quietAsync(()=>changePermanentEquipment({answer:presetEquipmentAnswer('commercial_gym',returnedDate),todayISO:returnedDate}));
 check(restoredKit.ok,'equipment restore saves');
 const fullKit=j.quiet(()=>deriveVisibleWeekLive(returnedDate,returnedDate));
 check(fullKit.flatMap(d=>d.workout?.exercises??[]).some(r=>!r.unavailableForInjury&&categories(r.exercise.name).includes('hamstring_eccentric_or_isometric')),'equipment restore reopens Nordic/curl requirement');
 // A separate real in-season journey reaches a bye during return to running.
 disk.clear();
 const inSeason={...athleteAnswers({id:'return-fixture',gender:'female',days:['Monday','Tuesday','Wednesday','Friday'],experience:'2-5 years',equipment:'commercial',initialPhase:'In-season',clubDays:['Tuesday','Thursday'],gameDay:'Saturday',extraGame:false}),trainingDaysPerWeek:3,sprintExposure:'2+ times per week'};
 const newInstall=await j.quietAsync(()=>j.coldStartThroughOnboarding({profile:inSeason,installDayISO:start}));check(!newInstall.onboardingRefusal,'fixture return journey starts through onboarding '+JSON.stringify(newInstall));
 const calf=buildGuidedInjuryConstraint({region:'lower_body',area:'Calf / Achilles',severity:6,severityBand:'moderate',adjustmentLevel:'moderate',triggers:['running'],seriousSymptoms:false},{todayISO:start});
 const report=await j.quietAsync(()=>executeProgramControlActionDurably({type:'set_injury_modifier',scope:'current_and_future',payload:{constraint:calf},source,requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},{todayISO:start}));
 check(report.ok,'fixture journey reaches active injury');
 const recoveredOn=plusDays(start,14);j.setJourneyClock(recoveredOn);j.quiet(()=>j.rolloverIfDue(recoveredOn));
 check((await j.quietAsync(()=>executeProgramControlActionDurably({type:'clear_injury_modifier',scope:'current_and_future',payload:{episodeId:report.createdModifierIds[0]},source,requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},{todayISO:recoveredOn}))).ok,'fixture journey reaches recovery');
 const store=require('../store/programStore').useProgramStore;
 const bye=await j.quietAsync(()=>require('../store/fixtureMutationTransaction').executeFixtureMutationTransaction({
  action:'remove',fixtureKind:'game',sourceDate:plusDays(recoveredOn,5),expectedAcceptedRevision:store.getState().acceptedMaterialContext.revision,
  source:{requestedBy:'athlete',producer:'tap',surface:'program_tab',commandId:'return-fixture-bye'},todayISO:recoveredOn}));
 check(bye.outcome==='accepted',`return-window bye accepted: ${JSON.stringify(bye)}`);
 const repaired=j.quiet(()=>deriveVisibleWeekLive(recoveredOn,recoveredOn));
 const field=repaired.flatMap(d=>d.workout?getSessionComponentRows(d.workout).speedRows:[]);
 check(field.length>0,'bye actually creates returning field work');
 check(field.every(r=>r.notes?.includes('controlled run-through')),'fixture repair retains returning field dose immediately');
 const before=visibleSignature(repaired);
 check((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:recoveredOn}))).ok,'fixture return week reopens');
 assert.equal(visibleSignature(j.quiet(()=>deriveVisibleWeekLive(recoveredOn,recoveredOn))),before,'fixture repair and reopening agree');checks++;
 const editedDay=repaired.find(d=>d.workout&&getSessionComponentRows(d.workout).speedRows.length);
 const editedRow=getSessionComponentRows(editedDay.workout).speedRows[0];
 const chosenSets=Math.max(1,editedRow.prescribedSets-1);
 const edit=await j.quietAsync(()=>executeProgramControlActionDurably({type:'swap_exercise',scope:'today_only',
  payload:{date:editedDay.date,fromExercise:editedRow.exercise.name,toExercise:{name:editedRow.exercise.name,sets:chosenSets,repsMin:editedRow.prescribedRepsMin,repsMax:editedRow.prescribedRepsMax}},
  source:{screen:'session_detail',surface:'leg_programming',initiatedBy:'tap'},requiresRebuild:false,createsActiveModifier:false,oneOffOnly:true},{todayISO:recoveredOn}));
 check(edit.ok&&edit.changedProgram,'athlete chooses fewer returning runs through the actual edit door '+JSON.stringify(edit));
 const chosen=()=>j.quiet(()=>deriveVisibleWeekLive(recoveredOn,recoveredOn)).find(d=>d.date===editedDay.date).workout.exercises.find(r=>r.id===editedRow.id);
 check(chosen()?.prescribedSets===chosenSets,'the returning prescription respects the deliberate edit');
 check((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:recoveredOn}))).ok,'edited return week reopens');
 check(chosen()?.prescribedSets===chosenSets,'reopening preserves the deliberate returning-run dose');
 for(const [name,dates] of doseCalls)check(dates.size>0,`${name}: actual scheduled deload dates reached the coverage owner`);
 console.log(`Leg programming journey: ${checks} reached assertions passed`);
})().catch(error=>{console.error('FAIL leg programming journey',error.stack);process.exitCode=1;});
