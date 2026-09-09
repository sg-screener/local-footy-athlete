'use strict';
require('sucrase/register');
if(process.env.LEG_PROGRAMMING_MUTATION)require('../../scripts/test-leg-programming-mutations.cjs').installMutation(process.env.LEG_PROGRAMMING_MUTATION);
const assert = require('node:assert/strict');
const {footballRobustnessCategoriesForExercise: categories} = require('../rules/footballRobustnessFoundation');
let passed=0; const failures=[];
function test(name, run) { try { run(); passed++; } catch(e) { failures.push(name); console.error('FAIL',name,e.message); } }
test('RDL cannot replace the ordinary weekly Nordic/curl requirement',()=>assert.ok(!categories('RDLs').includes('hamstring_eccentric_or_isometric')));
test('Nordics keep hamstring credit',()=>assert.ok(categories('Nordic Lower').includes('hamstring_eccentric_or_isometric')));
test('Hamstring curls keep hamstring credit',()=>assert.ok(categories('Hamstring Curl').includes('hamstring_eccentric_or_isometric')));
test('Calf strength earns credit; stretching does not',()=>{assert.ok(categories('Calf Raises').includes('calf_or_soleus'));assert.ok(!categories('Calf Stretch').includes('calf_or_soleus'));});
test('Shin raises do not stand in for calf strength',()=>{for(const name of ['Tib Raises','T-Bar Tib Raises'])assert.ok(!categories(name).includes('calf_or_soleus'));});
const {strengthWorkAreas,isDemandingPrehab}=require('../rules/trainingWorkload');
test('Light mobility does not receive strength credit',()=>{for(const n of ['Calf Stretch','Couch Stretch','90/90 Breathing'])assert.deepEqual(strengthWorkAreas(n),[]);});
test('Demanding prehab has real muscle workload',()=>{assert.ok(isDemandingPrehab('Reverse Nordic Curl'));assert.ok(strengthWorkAreas('Reverse Nordic Curl').includes('Quads'));});
const {runningReturnStage,applyRunningReturn}=require('../rules/runningReturn');
test('Running weeks five and six have simple staged return; week seven is normal',()=>{
  assert.deepEqual([4,5,6,7].map(phaseWeekNumber=>runningReturnStage({seasonPhase:'Off-season',phaseWeekNumber,dateISO:'2026-10-26'})),[null,1,2,null]);
});
test('Return is specific to the layoff, not an every-phase slow start',()=>assert.equal(runningReturnStage({seasonPhase:'Pre-season',phaseWeekNumber:1,dateISO:'2026-10-26'}),null));
test('Accepted strength dose cannot overwrite returning jump and running prescriptions',()=>{
 const {carryOwnAcceptedLoads}=require('../rules/acceptedLoadCarry');
 const template=require('../rules/conditioningSelection').speedTemplateByName('20 m Acceleration Reps');
 const runs=require('../rules/conditioningSelection').composeConditioningRows(template,'2027-07-19',{omitWarmup:true});
 const lift={id:'lift',exercise:{name:'Bench Press'},prescribedSets:4,prescribedRepsMin:4,prescribedRepsMax:6,prescribedWeightKg:83.75};
 const jump={id:'jump',role:'power',power:{family:'lower',kind:'primer'},exercise:{name:'Single-Leg Hop and Stick'},prescribedSets:2,prescribedRepsMin:5,prescribedRepsMax:5};
 const prehab={id:'prehab',exercise:{name:'Cossack Squat'},prescribedSets:2,prescribedRepsMin:8,prescribedRepsMax:10};
 const accepted={id:'accepted',dayOfWeek:1,exercises:[lift,jump,...runs,prehab],speedBlock:{...require('../rules/speedTemplates').speedBlockForTemplate(template,'standalone'),exerciseIds:runs.map(r=>r.id)}};
 for(const stage of [1,2]) {
  const rebuilt=applyRunningReturn({...accepted,exercises:[{...lift,prescribedSets:3,prescribedWeightKg:60},jump,...runs,{...prehab,prescribedSets:1}]},'2027-07-19',stage);
  const result=carryOwnAcceptedLoads({accepted:[accepted],rebuilt:[rebuilt],carry:'loads_and_dose'})[0];
  assert.deepEqual(result.exercises[0],lift,'the accepted lifting dose and athlete weight still travel');
  assert.deepEqual(result.exercises.slice(1),rebuilt.exercises.slice(1),'the compiler retains jump, running and demanding-prehab doses');
  assert.deepEqual(applyRunningReturn(result,'2027-07-19',stage),result,'reopening cannot change that dose');
 }
});
const {composeConditioningRows,speedTemplateByName}=require('../rules/conditioningSelection');
const {speedBlockForTemplate}=require('../rules/speedTemplates');
test('Returning field doses agree in the weekly projection and session on both stages',()=>{
 const {project}=require('../rules/projectVisibleWeek');
 const {buildSessionTemplate}=require('../utils/sessionTemplate');
 const date='2026-10-26',template=speedTemplateByName('20 m Acceleration Reps');
 for(const kind of ['speed','conditioning'])for(const stage of [1,2]) {
  const rows=composeConditioningRows(template,date,{omitWarmup:true});
  const original={id:`return-display-${kind}`,dayOfWeek:1,workoutType:kind==='speed'?'Speed':'Conditioning',exercises:rows,
   ...(kind==='speed'?{speedBlock:{...speedBlockForTemplate(template,'standalone'),exerciseIds:rows.map(r=>r.id)}}
    :{conditioningBlock:{intent:'high-intensity',options:[{title:template.name,modality:'running',exerciseIds:rows.map(r=>r.id)}]}})};
  const returning=applyRunningReturn(original,date,stage);
  const shown=buildSessionTemplate(returning).items.flatMap(i=>i.kind==='exercise'?[i.row]:[]);
  const projected=project({weekStart:date,week:[{date,dayOfWeek:1,source:'generated',workout:returning}]}).days.flatMap(d=>d.parts.flatMap(p=>p.rows));
  assert.ok(projected.length && shown.length,'both actual display paths were reached');
  for(const row of returning.exercises) {
   const display=shown.find(r=>r.id===row.id),visible=projected.find(r=>r.id===row.id);
   assert.ok(display && visible,'both views retain the actual returning row');
   assert.ok(visible.dose.every(require('../rules/signedCopy').isSignedCopyText),'every return dose line retains registered copy provenance');
   for(const [source,label] of [['Work','Work'],['Recovery','Rest'],['Reps','Sets']]) {
    const value=display.notes.split('\n').find(l=>l.startsWith(source+':')).slice(source.length+1).trim();
    assert.ok(visible.dose.includes(label+': '+value),`${kind}/stage ${stage}: ${source} agrees: ${JSON.stringify(visible.dose)}`);
   }
   assert.ok(!display.notes.includes('10/10'),'controlled return is not relabelled maximal');
  }
 }
});
test('A run-only return cannot be relabelled as machine conditioning',()=>{
 const {applyConditioningModalityToWorkout}=require('../utils/coachModalitySwap');
 const date='2026-10-26',template=speedTemplateByName('20 m Acceleration Reps');
 const rows=composeConditioningRows(template,date,{omitWarmup:true});
 const original={id:'return-mode',workoutType:'Conditioning',exercises:rows,conditioningBlock:{intent:'high-intensity',options:[{title:template.name,modality:'running',exerciseIds:rows.map(r=>r.id)}]}};
 for(const stage of [1,2]) {
  const returning=applyRunningReturn(original,date,stage);
  assert.equal(returning.conditioningBlock.options[0].title,template.name,'the option retains the authored equipment identity');
  for(const mode of ['bike','row','ski'])assert.strictEqual(applyConditioningModalityToWorkout(returning,{fromModality:null,toModality:mode}),returning,'changing mode must respect the authored run-only contract');
 }
});
test('A machine-specific change preserves a separate run-only component',()=>{
 const {applyConditioningModalityToWorkout}=require('../utils/coachModalitySwap');
 const run=composeConditioningRows(speedTemplateByName('20 m Acceleration Reps'),'2026-10-26',{omitWarmup:true});
 const bike=composeConditioningRows(speedTemplateByName('Classic 4×4'),'2026-10-27',{omitWarmup:true});
 const runOption={title:'20 m Acceleration Reps',modality:'running',exerciseIds:run.map(r=>r.id)};
 const bikeOption={title:'Classic 4×4',modality:'bike',exerciseIds:bike.map(r=>r.id)};
 const w={id:'separate-options',exercises:[...run,...bike],conditioningBlock:{options:[runOption,bikeOption]}};
 const changed=applyConditioningModalityToWorkout(w,{fromModality:'bike',toModality:'row'});
 assert.notStrictEqual(changed,w,'the requested machine change is actually reached');
 assert.equal(changed.conditioningBlock.options[1].modality,'row');
 assert.deepEqual(changed.conditioningBlock.options[0],runOption,'the unrelated run option is preserved');
 assert.deepEqual(changed.exercises.filter(r=>runOption.exerciseIds.includes(r.id)),run,'unrelated run rows are preserved');
});
test('Return replaces running dose, preserves lifts and is idempotent',()=>{
  const template=speedTemplateByName('20 m Acceleration Reps');
  const rows=composeConditioningRows(template,'2026-10-26',{omitWarmup:true});
  const lift={id:'lift',exercise:{name:'Bench Press'},prescribedSets:3,prescribedRepsMin:5,prescribedRepsMax:5,prescribedWeightKg:72.5};
  const w={id:'return-unit',exercises:[lift,...rows],speedBlock:{...speedBlockForTemplate(template,'standalone'),exerciseIds:rows.map(r=>r.id)}};
  const first=applyRunningReturn(w,'2026-10-26',1),second=applyRunningReturn(w,'2026-10-26',2);
  assert.strictEqual(first.exercises[0],lift);assert.strictEqual(second.exercises[0],lift);
  assert.ok(first.exercises[1].prescribedSets<second.exercises[1].prescribedSets);
  assert.ok(second.exercises[1].prescribedSets<rows[0].prescribedSets);
  assert.match(first.exercises[1].notes,/controlled run-through/);assert.match(second.exercises[1].notes,/controlled change of direction/);
  assert.deepEqual(applyRunningReturn(first,'2026-10-26',1),first);
  assert.strictEqual(applyRunningReturn(w,'2026-10-26',null),w);
});
const {prehabSets,reduceDemandingPrehab}=require('../rules/trainingWorkload');
test('Demanding prehab is reduced on deload and cannot duplicate a full leg dose',()=>{
 const loaded=[{exercise:{name:'Back Squat'},prescribedSets:3}];
 assert.equal(prehabSets('Reverse Nordic Curl',3,loaded,false),1);
 assert.ok(prehabSets('Reverse Nordic Curl',3,[],true)<3);
 assert.equal(prehabSets('Couch Stretch',3,loaded,true),3);
 const row={id:'prehab',exercise:{name:'Reverse Nordic Curl'},prescribedSets:3};
 const w={exercises:[...loaded,row]};assert.equal(reduceDemandingPrehab(w,false).exercises[1].prescribedSets,1);
 assert.equal(reduceDemandingPrehab({exercises:[...loaded,{...row,athleteAdditionId:'mine'}]},true).exercises[1].prescribedSets,3);
});
const {longestDemandingLegRun,wholeWeekPlacementCost}=require('../rules/weeklyScheduler');
test('Whole-day demand counts fixtures, hard conditioning, jumps and demanding support',()=>{
 const days=[0,1,2,3,4,5,6].map(dayOfWeek=>({dayOfWeek,conditioning:null,conditioningCategory:null,purpose:null}));
 const inputs={lowerBodyWorkloadByDay:{1:{workingSets:10},3:{workingSets:0,powerSets:2}},clubNights:[2],gymAccessDays:[],phase:'Pre-season'};
 days[2].clubTraining=true;days[4].conditioning='bike';days[4].conditioningCategory='glycolytic';
 assert.equal(longestDemandingLegRun({days},inputs),4);
 for(const category of ['vo2','glycolytic','repeat_sprint','sprint','cod_decel']) {days[4].conditioningCategory=category;assert.equal(longestDemandingLegRun({days},inputs),4,category+' counts as hard leg work');}
 inputs.lowerBodyWorkloadByDay[1].workingSets=6;assert.equal(longestDemandingLegRun({days},inputs),3);
 days[4].conditioningCategory='aerobic_base';assert.equal(longestDemandingLegRun({days},inputs),2);
 days[2].clubTraining=false;days[2].game=true;assert.equal(longestDemandingLegRun({days},inputs),2);
});
test('Whole-week ranking breaks an avoidable four-day leg run without removing training',()=>{
 const days=[0,1,2,3,4,5,6].map(dayOfWeek=>({dayOfWeek,owner:[1,3,5].includes(dayOfWeek)?'strength':'rest_or_recovery',clubTraining:[2,4].includes(dayOfWeek),conditioning:null,conditioningCategory:null,purpose:null}));
 const week={days,demand:{mainStrength:3}};
 const common={clubNights:[2,4],gymAccessDays:[1,3,5],phase:'Pre-season'};
 const piled=wholeWeekPlacementCost(week,{...common,lowerBodyWorkloadByDay:{1:{workingSets:10},3:{workingSets:10},5:{workingSets:0}}});
 const spaced=wholeWeekPlacementCost(week,{...common,lowerBodyWorkloadByDay:{1:{workingSets:10},3:{workingSets:0},5:{workingSets:10}}});
 // Same five active days and three strength sessions: only leg demand moves.
 const difference=spaced.findIndex((value,index)=>value!==piled[index]);
 assert.ok(difference>=0 && spaced[difference]<piled[difference]);
});
test('Returning jump repetitions reduce once and leave athlete additions alone',()=>{
 const row={id:'jump',role:'power',power:{family:'lower',kind:'primer'},exercise:{name:'Vertical Jump'},prescribedSets:2,prescribedRepsMin:3,prescribedRepsMax:5};
 const w={id:'jump-test',exercises:[row]};const result=applyRunningReturn(w,'2026-10-26',1);
 assert.ok(result.exercises[0].prescribedRepsMax<row.prescribedRepsMax);assert.deepEqual(applyRunningReturn(result,'2026-10-26',1),result);
 assert.deepEqual(applyRunningReturn({...w,exercises:[{...row,athleteAdditionId:'mine'}]},'2026-10-26',1).exercises[0].prescribedRepsMax,5);
});
const {injuryAllowsContextExercise}=require('../rules/datedAthleteContext');
test('The same dated injury guard covers derived saved replacements',()=>{
 const profile={...require('./compilerYear/catalog').athleteAnswers(require('./compilerYear/catalog').ARCHETYPES[0]),injuries:[{bodyArea:'Calf / Achilles',description:'Calf issue',severityScore:6,severity:'moderate',movementTriggers:['running']}],experienceLevel:'2-5 years'};
 assert.equal(injuryAllowsContextExercise('Calf Raises',{onboardingData:profile,injuries:profile.injuries,equipmentTags:[]},'2026-10-26'),false);
 assert.equal(injuryAllowsContextExercise('Bench Press',{onboardingData:profile,injuries:profile.injuries,equipmentTags:[]},'2026-10-26'),true);
 assert.equal(injuryAllowsContextExercise('Calf Raises',{onboardingData:{...profile,injuries:[]},injuries:[],equipmentTags:[]},'2026-10-26'),true);
});
const {completeWeeklyLegCoverage}=require('../rules/weeklyLegCoverage');
const coverageProfile={...require('./compilerYear/catalog').athleteAnswers(require('./compilerYear/catalog').ARCHETYPES[2]),equipmentAnswer:require('./support/equipmentAnswerFixture').presetEquipmentAnswer('commercial_gym')};
const simpleRow=(name,id)=>({id,exerciseId:id,exercise:{id,name},prescribedSets:2,prescribedRepsMin:8,prescribedRepsMax:10,exerciseOrder:1});
const strengthDay=rows=>({id:'coverage-unit',dayOfWeek:1,workoutType:'Strength',exercises:rows});
test('Coverage credits existing work, never caps frequency and respects injury exceptions',()=>{
 const complete=strengthDay([simpleRow('Hamstring Curl','h1'),simpleRow('Nordic Lower','h2'),simpleRow('Calf Raises','c')]);
 const input={weekStartISO:'2026-10-26',profile:coverageProfile,workoutsByDate:{'2026-10-26':complete}};
 assert.strictEqual(completeWeeklyLegCoverage(input).workoutsByDate,input.workoutsByDate);
 const base=strengthDay([simpleRow('Bench Press','b')]);
 const repaired=completeWeeklyLegCoverage({...input,workoutsByDate:{'2026-10-26':base}});
 assert.equal(repaired.receipts.filter(r=>r.status==='added').length,2);
 const profile={...coverageProfile,injuries:[{bodyArea:'Calf / Achilles',description:'Sore calf',severityScore:6,severity:'moderate'}]};
 const restricted=completeWeeklyLegCoverage({...input,profile,workoutsByDate:{'2026-10-26':base}});
 assert.ok(!restricted.receipts.some(r=>r.category==='calf_or_soleus'&&r.status==='added'));
});
test('Coverage repairs consume the dated compiler dose without re-dosing accepted lifting',()=>{
 const date='2026-10-26';
 const bench={...simpleRow('Bench Press','b'),prescribedWeightKg:83.75};
 const input={weekStartISO:date,profile:coverageProfile,workoutsByDate:{[date]:strengthDay([bench])}};
 const normal=completeWeeklyLegCoverage(input).workoutsByDate[date].exercises;
 assert.equal(normal.length,3,'the unit reaches both missing categories');
 const policy=require('../rules/canonicalWeeklyScheduledDeloadState').canonicalWeeklyScheduledDeloadStateFrom({
  weekStartISO:date,seasonPhase:'Pre-season',weekKind:'deload'}).policy;
 const seen=[];
 const reduced=completeWeeklyLegCoverage({...input,dosePolicyForDate:d=>{seen.push(d);return d===date?policy:null;}}).workoutsByDate[date].exercises;
 assert.deepStrictEqual(reduced.slice(1).map(r=>r.prescribedSets),normal.slice(1).map(r=>Math.max(1,Math.round(r.prescribedSets*0.5))),
  'late calf/hamstring rows must receive the already resolved daily dose');
 assert.ok(seen.length>0&&seen.every(d=>d===date),'the policy is requested for the actual receiving date');
 assert.strictEqual(reduced[0],bench,'accepted lifting must not receive another deload');
 const stale={...input,workoutsByDate:{[date]:{...input.workoutsByDate[date],usefulStrengthSessionContract:{reductionReasons:['scheduled_deload']}}}};
 const untargeted=completeWeeklyLegCoverage({...stale,dosePolicyForDate:d=>d==='2026-11-02'?policy:null}).workoutsByDate[date].exercises;
 assert.deepStrictEqual(untargeted.slice(1).map(r=>r.prescribedSets),normal.slice(1).map(r=>r.prescribedSets),
  'an old workout label cannot apply another week\'s policy');
 const injury=require('../rules/canonicalWeeklyInjuryCompiler').compileCanonicalInjuryWeek({
  workoutsByDate:input.workoutsByDate,profile:coverageProfile,constraints:[],exclusions:[],recordedLoads:{},
  programmingContextByDate:{[date]:{seasonPhase:'Pre-season',deloadPolicy:policy}}});
 const repairedLegRows=injury.workoutsByDate[date].exercises.filter(r=>r.id.includes('weekly-leg-'));
 assert.equal(repairedLegRows.length,2,'injury completion reaches both repair rows');
 assert.deepStrictEqual(repairedLegRows.map(r=>r.prescribedSets),normal.slice(1).map(r=>Math.max(1,Math.round(r.prescribedSets*0.5))),
  'injury completion must forward its existing dated programming context');
});
test('The final support owner executes weekly calf and Nordic/curl completion',()=>{
 const result=require('../rules/weeklyLegCoverage').completeWeeklySupport({weekStartISO:'2026-10-26',profile:coverageProfile,
  workoutsByDate:{'2026-10-26':strengthDay([simpleRow('Bench Press','b')])}});
 const names=result.workoutsByDate['2026-10-26'].exercises.map(r=>r.exercise.name);
 for(const category of ['calf_or_soleus','hamstring_eccentric_or_isometric'])assert.ok(names.some(name=>require('../rules/footballRobustnessFoundation').footballRobustnessCategoriesForExercise(name).includes(category)),category);
});
test('Later fact completion preserves earlier prescriptions while governing future work',()=>{
 const {compileCanonicalInjuryWeek}=require('../rules/canonicalWeeklyInjuryCompiler');
 const earlier=strengthDay([simpleRow('Back Squat','s'),{...simpleRow('Cossack Squat','p'),prescribedSets:2}]);
 const later={...earlier,id:'later',dayOfWeek:4};
 const result=compileCanonicalInjuryWeek({workoutsByDate:{'2027-08-02':earlier,'2027-08-05':later},
  profile:coverageProfile,constraints:[],exclusions:[],recordedLoads:{},historyBeforeISO:'2027-08-03'});
 assert.deepEqual(result.workoutsByDate['2027-08-02'],earlier,'later reports cannot change earlier dose or append missed work');
 assert.equal(result.workoutsByDate['2027-08-05'].exercises.find(r=>r.id==='p').prescribedSets,1,'future demanding prehab still credits existing strength');
});
test('Equipment-only loss of all Nordic/curl choices retains an available hamstring alternative',()=>{
 // The current catalogue declares Nordic Lower equipment-free. Exercise the
 // equipment boundary explicitly, without changing Sam's catalogue declaration.
 const kit=require('../data/exerciseEquipmentRequirement');const original=kit.exerciseIsAvailableWith;
 const blocked=['Nordic Lower','Hamstring Curl','Swiss Ball Hamstring Curl'];
 kit.exerciseIsAvailableWith=(name,tags)=>!blocked.includes(name)&&original(name,tags);
 try {
  const result=completeWeeklyLegCoverage({weekStartISO:'2026-10-26',profile:coverageProfile,
    workoutsByDate:{'2026-10-26':strengthDay([simpleRow('Bench Press','b')])}});
  const receipt=result.receipts.find(r=>r.category==='hamstring_eccentric_or_isometric');
  assert.equal(receipt.status,'added');assert.ok(!blocked.includes(receipt.exercise));
  assert.ok(require('../rules/footballRobustnessFoundation').suppliesAlternativeHamstringWork(receipt.exercise));
 } finally {kit.exerciseIsAvailableWith=original;}
});
test('Demanding recovery add-ons count and shrink; light mobility remains light',()=>{
 const w={id:'addon-unit',dayOfWeek:1,exercises:[],recoveryAddons:[{exercises:[{id:'rn',name:'Reverse Nordic Curl',prescription:'3 × 8'},{id:'cs',name:'Calf Stretch',prescription:'3 × 30s'}]}]};
 const reduced=reduceDemandingPrehab(w,true);
 assert.equal(reduced.recoveryAddons[0].exercises[0].prescription,'1 × 8');
 assert.equal(reduced.recoveryAddons[0].exercises[1].prescription,'3 × 30s');
 const {lowerBodyWorkloadForWeek}=require('../rules/lowerBodyWorkload');
 assert.equal(lowerBodyWorkloadForWeek({workouts:[w],weekStartISO:'2026-10-26'})[1].workingSets,3);
});
test('The yearly plane checker credits controlled turns in running week two',()=>{
 const {athleticPlaneExposuresForAuditDay}=require('../rules/programmingYearAuditProjection');
 assert.deepEqual(athleticPlaneExposuresForAuditDay({date:'2026-10-26',runningReturnStage:1,rows:[]}),[]);
 assert.deepEqual(athleticPlaneExposuresForAuditDay({date:'2026-11-02',runningReturnStage:2,rows:[]}),['cod_decel']);
});
test('Both optional section projectors restrict injured rows and reopen unaffected choices',()=>{
 const {applyMobilityFlowExerciseDecisions,applyRecoveryAddonExerciseDecisions}=require('../utils/derivedExerciseDecisions');
 const profile={...coverageProfile,injuries:[{bodyArea:'Calf / Achilles',description:'Calf issue',severityScore:6,severity:'moderate',movementTriggers:['running']}]};
 const athlete={onboardingData:profile,injuries:profile.injuries,equipmentTags:[]};
 const common={athlete,date:'2026-10-26',entries:[]};
 const flow={movements:[{exercise:{id:'c',name:'Calf Raises'}},{exercise:{id:'b',name:'Bench Press'}}]};
 assert.deepEqual(applyMobilityFlowExerciseDecisions({...common,flow}).movements.map(m=>m.exercise.name),['Bench Press']);
 const workout={id:'recovery',exercises:[],recoveryAddons:[{exercises:[{id:'c',name:'Calf Raises',prescription:'3 × 8'},{id:'b',name:'Bench Press',prescription:'3 × 8'}]}]};
 assert.deepEqual(applyRecoveryAddonExerciseDecisions({...common,workout}).recoveryAddons[0].exercises.map(r=>r.name),['Bench Press']);
 const recovered={...athlete,onboardingData:{...profile,injuries:[]},injuries:[]};
 assert.equal(applyMobilityFlowExerciseDecisions({...common,athlete:recovered,flow}).movements.length,2);
 assert.equal(applyRecoveryAddonExerciseDecisions({...common,athlete:recovered,workout}).recoveryAddons[0].exercises.length,2);
});
test('A returning week also reduces field work attached after its earlier power reduction',()=>{
 const {composeConditioningRows,speedTemplateByName}=require('../rules/conditioningSelection');
 const rows=composeConditioningRows(speedTemplateByName('20 m Acceleration Reps'),'2026-10-26',{omitWarmup:true});
 const w={id:'new-field-on-return',exercises:rows,runningReturnStage:1,speedBlock:{exerciseIds:rows.map(r=>r.id),modality:'run'}};
 const result=applyRunningReturn(w,'2026-10-26',1);
 assert.ok(result.exercises.every(r=>r.notes.includes('controlled run-through')));
 assert.strictEqual(applyRunningReturn(result,'2026-10-26',1),result);
 const freshJump={id:'later-jump',role:'power',power:{family:'lower',kind:'primer'},exercise:{name:'Vertical Jump'},prescribedSets:2,prescribedRepsMin:5,prescribedRepsMax:5};
 const withJump=applyRunningReturn({...result,exercises:[...result.exercises,freshJump]},'2026-10-26',1);
 assert.equal(withJump.exercises.find(r=>r.id==='later-jump').prescribedRepsMax,2);
 assert.strictEqual(applyRunningReturn(withJump,'2026-10-26',1),withJump);
});
test('Skipping strength never erases performed power, and withheld rows carry no dose',()=>{
 const {lowerBodyWorkloadForWeek}=require('../rules/lowerBodyWorkload');
 const jump={...simpleRow('Vertical Jump','jump'),prescribedSets:3,role:'power',power:{family:'lower',kind:'primer'}};
 const w={...strengthDay([{...simpleRow('Calf Raises','calf'),unavailableForInjury:true},jump])};
 const planned=lowerBodyWorkloadForWeek({workouts:[w],weekStartISO:'2026-10-26'})[1];
 assert.equal(planned.workingSets,0);assert.equal(planned.powerSets,3);
 const actual=lowerBodyWorkloadForWeek({workouts:[w],weekStartISO:'2026-10-26',completedBeforeISO:'2026-10-27',
  feedback:{day:{dateStr:'2026-10-26',completion:'partial',components:[{kind:'strength',completion:'skipped'},{kind:'power',completion:'full'}]}}})[1];
 assert.equal(actual.workingSets,0);assert.equal(actual.powerSets,3);
});
test('Only the deliberately removed category is exempt in its accepted week',()=>{
 const base=strengthDay([simpleRow('Bench Press','b')]);
 const removal={protocolVersion:1,id:'delete',authorship:'user',source:'tap',status:'active',targetDate:'2026-10-26',scope:'whole_session',
  originalWorkout:strengthDay([simpleRow('Calf Raises','c')]),remainingWorkout:null,wholeDayRestOwned:true,createdAt:'2026-10-26'};
 const input={weekStartISO:'2026-10-26',profile:coverageProfile,workoutsByDate:{'2026-10-28':base},userRemovalConstraints:[removal]};
 const receipt=(value,category)=>completeWeeklyLegCoverage(value).receipts.find(r=>r.category===category).status;
 assert.equal(receipt(input,'calf_or_soleus'),'athlete_removed');
 assert.equal(receipt(input,'hamstring_eccentric_or_isometric'),'added');
 for(const change of [{status:'restored'},{targetDate:'2026-10-19'},{scope:'conditioning_component'},{mutationKind:'move'},
  {originalWorkout:base},{remainingWorkout:removal.originalWorkout}]) {
  assert.equal(receipt({...input,userRemovalConstraints:[{...removal,...change}]},'calf_or_soleus'),'added',JSON.stringify(change));
 }
 assert.equal(receipt({...input,userRemovalConstraints:[removal,{...removal,id:'later',createdAt:'2026-10-27',originalWorkout:base}]},'calf_or_soleus'),'added');
});
test('Home equipment fallback uses eligible choices, without replacing an available Nordic',()=>{
 const {ARCHETYPES,athleteAnswers}=require('./compilerYear/catalog');
 const profile=athleteAnswers(ARCHETYPES.find(a=>a.id==='female-5-home'));
 const input={weekStartISO:'2026-10-26',profile,workoutsByDate:{'2026-10-26':strengthDay([simpleRow('RDLs','rdl'),simpleRow('Calf Raises','calf')])}};
 assert.equal(completeWeeklyLegCoverage(input).receipts.find(r=>r.category==='hamstring_eccentric_or_isometric').status,'present');
 const experienced=completeWeeklyLegCoverage({...input,profile:{...profile,experienceLevel:'2-5 years'}});
 assert.equal(experienced.receipts.find(r=>r.category==='hamstring_eccentric_or_isometric').status,'added');
 assert.ok(experienced.workoutsByDate['2026-10-26'].exercises.some(r=>categories(r.exercise.name).includes('hamstring_eccentric_or_isometric')));
 const missing=completeWeeklyLegCoverage({...input,workoutsByDate:{'2026-10-26':strengthDay([simpleRow('Bench Press','bench'),simpleRow('Calf Raises','calf')])}});
 assert.equal(missing.receipts.find(r=>r.category==='hamstring_eccentric_or_isometric').status,'added');
});
test('Stored add-ons share prehab dose with each other and count actual leg strength',()=>{
 const addons=[{id:'old-a',exercises:[{id:'a',name:'Reverse Nordic Curl',prescription:'3 × 8'}]},
  {id:'old-b',exercises:[{id:'b',name:'Reverse Nordic Curl',prescription:'3 × 8'}]}];
 const w={...strengthDay([simpleRow('Bench Press','bench')]),recoveryAddons:addons};
 const reduced=reduceDemandingPrehab(w,false);
 assert.deepEqual(reduced.recoveryAddons.flatMap(a=>a.exercises.map(r=>r.prescription)),['3 × 8','1 × 8']);
 assert.deepEqual(reduceDemandingPrehab(reduced,false),reduced);
 assert.deepEqual(reduceDemandingPrehab(w,true).recoveryAddons.flatMap(a=>a.exercises.map(r=>r.prescription)),['1 × 8','1 × 8']);
 const {lowerBodyWorkloadForWeek}=require('../rules/lowerBodyWorkload');
 const calf={...w,recoveryAddons:[{exercises:[{name:'Calf Raises',prescription:'3 × 8'},{name:'Calf Stretch',prescription:'3 × 8'}]}]};
 assert.equal(lowerBodyWorkloadForWeek({workouts:[calf],weekStartISO:'2026-10-26'})[1].workingSets,3);
 const profile={...coverageProfile,injuries:[{bodyArea:'Calf / Achilles',description:'Calf issue',severityScore:6,severity:'moderate',movementTriggers:['running']}]};
 assert.equal(lowerBodyWorkloadForWeek({workouts:[calf],weekStartISO:'2026-10-26',profile})[1].workingSets,0);
});
test('A saved recovery dose reduces the same area in the actual optional flow',()=>{
 const {selectMobilityPrehabFlow}=require('../utils/mobilityPrehabFlow');
 const {isDemandingPrehab}=require('../rules/trainingWorkload');
 let reached=false;
 for(const name of ['Bench Press','RDLs','Back Squat'])for(let day=1;day<=28&&!reached;day++) {
  const context={workout:strengthDay([simpleRow(name,'main')]),seasonPhase:'Pre-season',isGameWeek:false,
   date:`2026-10-${String(day).padStart(2,'0')}`,performedMovementIds:[],athlete:{onboardingData:coverageProfile,injuries:[],equipmentTags:['bodyweight','barbell','dumbbells','bands','bench','cables']}};
  const flow=selectMobilityPrehabFlow(context);
  const target=flow?.movements.find(m=>isDemandingPrehab(m.exercise.name)&&m.exercise.sets>1);
  if(!target)continue;
  const saved={...context.workout,recoveryAddons:[{exercises:[{name:target.exercise.name,prescription:'3 × 8'}]}]};
  const updated=selectMobilityPrehabFlow({...context,workout:saved});
  assert.equal(updated.movements.find(m=>m.exercise.id===target.exercise.id).exercise.sets,1);
  assert.deepEqual(selectMobilityPrehabFlow({...context,workout:JSON.parse(JSON.stringify(saved))}),updated);
  reached=true;
 }
 assert.ok(reached,'reached an actual full-dose optional prehab movement');
});
const {withPlannedInjuryConditioning}=require('../rules/canonicalInjuryConditioning');
test('Injury energy replanning cannot add a lifting day or replace accepted lifting',()=>{
 const row=(id,name,role)=>({id,exercise:{name},prescribedSets:3,section18Evidence:{role}});
 const lift=row('lift','Pull-Ups','main_strength');
 const energy=row('energy','Bike Intervals','conditioning');
 const speed=row('speed','20 m Acceleration Reps','conditioning');
 const planned={id:'mixed',name:'upper_pull',workoutType:'Mixed',exercises:[lift,energy,speed],
  strengthIntent:{plannedPatterns:['pull']},hasCombinedConditioning:true,
  conditioningBlock:{options:[{exerciseIds:['energy']}]},speedBlock:{exerciseIds:['speed']}};
 for(const accepted of [{id:'old-energy',name:'Conditioning',workoutType:'Conditioning',exercises:[energy],conditioningBlock:planned.conditioningBlock},null]) {
  const result=withPlannedInjuryConditioning(accepted,planned);
  assert.deepEqual(result.exercises.map(r=>r.id),['energy','speed']);
  assert.equal(result.strengthIntent,undefined);assert.equal(result.workoutType,'Conditioning');
 }
 const kept=row('kept','Bench Press','main_strength');kept.prescribedWeightKg=83.75;
 const accepted={...planned,id:'accepted',exercises:[kept,{...speed,id:'old-speed'}],conditioningBlock:undefined,speedBlock:{exerciseIds:['old-speed']}};
 const result=withPlannedInjuryConditioning(accepted,planned);
 assert.strictEqual(result.exercises[0],kept);
 assert.deepEqual(result.exercises.map(r=>r.id),['kept','energy','speed']);
 assert.equal(withPlannedInjuryConditioning(null,{...planned,exercises:[lift],conditioningBlock:undefined,speedBlock:undefined}),null);
});
test('Final family audit credits only one evidenced injury replacement and keeps duplicate checks alive',()=>{
 const {auditFinalAutomaticWeek}=require('../rules/automaticWeeklyExerciseSelection');
 const row=(identity,addedForInjury=false)=>({identity,authorship:'automatic',route:'strength',requestedAsMain:true,addedForInjury});
 const base={dayKind:null,exercises:[row('Back Squat')]};
 const replaced={dayKind:null,exercises:[row('Box Squat',true)],injuryAdjustment:{paused:['Bench Press'],added:['Box Squat']}};
 assert.equal(auditFinalAutomaticWeek([base,replaced]).repeatedMainFamilies.length,0);
 for(const invalid of [{...replaced,injuryAdjustment:undefined}, {...replaced,injuryAdjustment:{paused:[],added:['Box Squat']}},
  {...replaced,exercises:[row('Box Squat')]}, {...replaced,injuryAdjustment:{paused:['Bench Press'],added:['Front Squat']}}])
  assert.equal(auditFinalAutomaticWeek([base,invalid]).repeatedMainFamilies.length,1);
 const tooMany={...replaced,exercises:[...replaced.exercises,row('Front Squat',true)],injuryAdjustment:{paused:['Bench Press'],added:['Box Squat','Front Squat']}};
 assert.equal(auditFinalAutomaticWeek([base,tooMany]).repeatedMainFamilies.length,1);
 assert.equal(auditFinalAutomaticWeek([base,{...base}]).repeatedExact.length,1);
 assert.equal(auditFinalAutomaticWeek([{...replaced,exercises:[row('Bench Press'),row('Incline Bench',true)],
  injuryAdjustment:{paused:['Back Squat'],added:['Incline Bench']}}]).repeatedMainFamilies.length,1,
  'an injury marker cannot permit a same-session variation conflict');
});
test('Three full-body days reserve a kit-achievable main seat each before exercise selection',()=>{
 const {createWeeklyStrengthBudget}=require('../rules/weeklyStrengthBudget');
 const days=['mon','wed','fri'].map(planEntryId=>({planEntryId,strengthIntent:{archetype:'full_body',plannedPatterns:['squat','hinge','push','pull']}}));
 const available=['squat','hinge','horizontal_push'];
 const budget=createWeeklyStrengthBudget(days,slot=>available.includes(slot));
 for(const day of days)assert.ok(available.some(slot=>budget.reservedOwnerBySlot[slot]===day.planEntryId));
 assert.equal(budget.reservedOwnerBySlot.horizontal_push,'fri');
 const unchanged=createWeeklyStrengthBudget(days,()=>true);
 assert.deepEqual(unchanged.reservedOwnerBySlot,createWeeklyStrengthBudget(days).reservedOwnerBySlot);
 const impossible=createWeeklyStrengthBudget(days,slot=>slot==='squat');
 assert.equal(impossible.reservedOwnerBySlot.squat,'mon','never take the only remaining main from another day');
 const split=[{planEntryId:'lower',strengthIntent:{archetype:'lower',plannedPatterns:['squat','hinge']}},
  {planEntryId:'upper',strengthIntent:{archetype:'upper',plannedPatterns:['push','pull']}},days[2]];
 const splitBudget=createWeeklyStrengthBudget(split,slot=>available.includes(slot));
 for(const day of split)assert.ok(available.some(slot=>splitBudget.reservedOwnerBySlot[slot]===day.planEntryId));
 assert.equal(splitBudget.reservedOwnerBySlot.hinge,'fri');
});
test('Annual evidence counts its declared athletes and rejects truncated, duplicated or failed journeys',()=>{
 const {annualJourneyCoverage}=require('../../scripts/annual-journey-coverage.cjs');
 // Infrastructure fixture: no claim about a generated athlete or training.
 const date=offset=>new Date(Date.UTC(2026,8,28+offset)).toISOString().slice(0,10);
 const athlete={gender:'female',weeks:Array.from({length:52},(_,week)=>({start:date(week*7),days:Array.from({length:7},(_,day)=>({date:date(week*7+day)}))})),
  restarts:Array.from({length:52},(_,week)=>({date:date(week*7+6),ok:true})),actions:[{result:{ok:true}},{result:{outcome:'accepted'}}]};
 const year={start:date(0),auditScope:{expectedGenders:['female'],expectedWeeks:52},athletes:[athlete]};
 assert.ok(annualJourneyCoverage(year).complete);
 for(const mutate of [y=>delete y.auditScope,y=>y.auditScope.expectedWeeks=51,y=>y.athletes=[],
  y=>y.athletes[0].weeks.pop(),y=>y.athletes[0].weeks[51]=y.athletes[0].weeks[0],
  y=>y.athletes[0].restarts[0].ok=false,y=>y.athletes[0].restarts[51]=y.athletes[0].restarts[0],
  y=>y.athletes[0].actions[0].result.ok=false,y=>y.athletes[0].actions[1].result.outcome='refused',
  y=>y.athletes[0].checkFailures=[{label:'missed action'}]]) {
  const broken=JSON.parse(JSON.stringify(year));mutate(broken);assert.equal(annualJourneyCoverage(broken).complete,false);
 }
});
// ── Sam's 2026-09-09 review of the three-day year ─────────────────────────
const {buildDerivedSession,DEFAULT_ATHLETE_CONTEXT}=require('../utils/sessionBuilder');
const {buildGuidedInjuryConstraint}=require('../utils/guidedInjuryControl');
const {compileInjuryConditioning}=require('../rules/canonicalInjuryConditioning');
const {resolveEquipmentCapabilities}=require('../utils/equipmentAvailability');
const reviewDate='2027-06-25';
const cats=require('../rules/footballRobustnessFoundation').footballRobustnessCategoriesForExercise;
const primerFor=()=>buildDerivedSession('primer',reviewDate,'review','review',{...DEFAULT_ATHLETE_CONTEXT,injuries:[],
 onboardingData:coverageProfile,equipmentTags:[...resolveEquipmentCapabilities(coverageProfile).tags]});
const guided=(area,region,trigger)=>buildGuidedInjuryConstraint({region,area,severity:4,severityBand:'moderate',
 adjustmentLevel:'moderate',triggers:[trigger],seriousSymptoms:false},{todayISO:'2027-06-22'});
test('The Primer\'s authored Pogo Hops is typed power and the knee restriction removes it like any other jump',()=>{
 const primer=primerFor();
 const pogo=primer.exercises.find(r=>r.exercise.name==='Pogo Hops');
 assert.ok(pogo,'the Primer still authors Pogo Hops (R-129)');
 assert.equal(pogo.role,'power');assert.deepEqual(pogo.power,{family:'lower',kind:'primer'});
 assert.equal(pogo.section18Evidence.role,'power');
 assert.equal(pogo.prescribedSets,2);assert.equal(pogo.prescribedRepsMin,10);
 const knee=compileInjuryConditioning({workout:primer,profile:coverageProfile,dateISO:reviewDate,constraints:[guided('knee','lower_body','running')]});
 assert.ok(!knee.exercises.some(r=>r.exercise.name==='Pogo Hops'),'knee 4/10 with reduced running removes the Primer jump');
 assert.ok(knee.exercises.some(r=>r.section18Evidence?.role==='recovery_support'),'the mobility rows of the Primer survive');
 const none=compileInjuryConditioning({workout:primer,profile:coverageProfile,dateISO:reviewDate,constraints:[]});
 assert.ok(none.exercises.some(r=>r.exercise.name==='Pogo Hops'),'no restriction keeps the jump');
});
const {selectMobilityPrehabFlow}=require('../utils/mobilityPrehabFlow');
test('One adductor isometric per session: the warm-up flow yields to a prescribed adductor row',()=>{
 const rows=[simpleRow('Bulgarian Split Squats','a'),simpleRow('Single-Leg RDL','b'),simpleRow('Overhead Press','c'),simpleRow('Neutral-Grip Pulldown','d')];
 const athlete={onboardingData:coverageProfile,injuries:[],activeConstraints:[],equipmentTags:[...resolveEquipmentCapabilities(coverageProfile).tags]};
 const flowNames=(exercises,date)=>(selectMobilityPrehabFlow({workout:{...strengthDay(exercises),workoutType:'Mixed',dayOfWeek:5},seasonPhase:'Pre-season',isGameWeek:false,date,performedMovementIds:[],athlete})?.movements??[]).map(m=>m.exercise.name);
 const dates=Array.from({length:60},(_,i)=>new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10));
 const withGroin=dates.filter(date=>flowNames(rows,date).some(name=>cats(name).includes('adductor_or_groin')));
 assert.ok(withGroin.length>0,'the plain session draws a warm-up adductor on some dates (control)');
 for(const date of withGroin) {
  const paired=flowNames([...rows,simpleRow('Copenhagen Plank (Half)','cop')],date);
  assert.ok(!paired.some(name=>cats(name).includes('adductor_or_groin')),`${date}: the flow prescribed a second adductor isometric: ${paired.join(', ')}`);
  assert.ok(paired.length>0,'the flow still prepares the session');
 }
});
test('The frontal-plane completion consumes the dated deload dose and the reducer sees the same policy',()=>{
 const {completeWeeklyLowerBodyFrontal}=require('../rules/canonicalWeeklyPlaneCompletion');
 const {compileCanonicalInjuryWeek}=require('../rules/canonicalWeeklyInjuryCompiler');
 const date='2027-03-05';
 const mixed={...strengthDay([simpleRow('Bulgarian Split Squats','a'),simpleRow('Single-Leg RDL','b'),simpleRow('Overhead Press','c'),simpleRow('Neutral-Grip Pulldown','d')]),
  id:'deload-friday',dayOfWeek:5,workoutType:'Mixed',usefulStrengthSessionContract:null};
 const policy=require('../rules/canonicalWeeklyScheduledDeloadState').canonicalWeeklyScheduledDeloadStateFrom({weekStartISO:'2027-03-01',seasonPhase:'Pre-season',weekKind:'deload'}).policy;
 assert.ok(policy,'a Pre-season deload week resolves a dated policy');
 const full=completeWeeklyLowerBodyFrontal({weekStartISO:'2027-03-01',workoutsByDate:{[date]:mixed},profile:coverageProfile});
 assert.equal(full.status,'added','the week lacks a frontal row and receives one');
 const authored=full.workoutsByDate[date].exercises.at(-1).prescribedSets;
 const halved=completeWeeklyLowerBodyFrontal({weekStartISO:'2027-03-01',workoutsByDate:{[date]:mixed},profile:coverageProfile,dosePolicyForDate:d=>d===date?policy:null});
 assert.equal(halved.workoutsByDate[date].exercises.at(-1).prescribedSets,Math.max(1,Math.round(authored*0.5)),'the completed frontal row takes the dated deload dose');
 const week=compileCanonicalInjuryWeek({workoutsByDate:{[date]:mixed},profile:coverageProfile,constraints:[],exclusions:[],recordedLoads:{},
  programmingContextByDate:{[date]:{seasonPhase:'Pre-season',deloadPolicy:policy}}});
 const frontal=week.workoutsByDate[date].exercises.find(r=>cats(r.exercise.name).includes('adductor_or_groin'));
 assert.ok(frontal,'the injury week compile still completes the frontal plane');
 assert.equal(frontal.prescribedSets,1,'a deload Friday without a useful-strength contract still halves demanding prehab to one set');
 const adductors=week.workoutsByDate[date].exercises.filter(r=>cats(r.exercise.name).includes('adductor_or_groin'));
 assert.equal(adductors.length,1,'one adductor isometric per session');
});
test('In-season a curl does not replace the Nordic: coverage adds one, credits an existing one and stays quiet pre-season',()=>{
 const {isNordicExercise,weeklyLegCoverageCategories}=require('../rules/weeklyLegCoverage');
 assert.ok(isNordicExercise('Nordic Lower'));assert.ok(!isNordicExercise('Hamstring Curl'));assert.ok(!isNordicExercise('Reverse Nordic Curl'));
 assert.deepEqual(weeklyLegCoverageCategories('In-season')[0],'nordic');assert.ok(!weeklyLegCoverageCategories('Pre-season').includes('nordic'));
 const inSeason={...coverageProfile,seasonPhase:'In-season',usualGameDay:'Saturday',gameDay:'Saturday'};
 const curlWeek={'2027-03-29':strengthDay([simpleRow('Back Squat','s'),simpleRow('Hamstring Curl','h'),simpleRow('Calf Raises','c')])};
 const repaired=completeWeeklyLegCoverage({weekStartISO:'2027-03-29',profile:inSeason,workoutsByDate:curlWeek,gameDates:['2027-04-03']});
 const nordic=repaired.receipts.find(r=>r.category==='nordic');
 assert.equal(nordic?.status,'added');assert.ok(isNordicExercise(nordic.exercise),nordic.exercise);
 const added=repaired.workoutsByDate['2027-03-29'].exercises.find(r=>isNordicExercise(r.exercise.name));
 assert.ok(added.prescribedSets>=2,'a couple of sets: '+added.prescribedSets);
 assert.ok(repaired.receipts.find(r=>r.category==='hamstring_eccentric_or_isometric').status==='present','the curl still counts for the ordinary pair');
 const nordicWeek={'2027-03-29':strengthDay([simpleRow('Back Squat','s'),simpleRow('Nordic Lower','n'),simpleRow('Calf Raises','c')])};
 const credited=completeWeeklyLegCoverage({weekStartISO:'2027-03-29',profile:inSeason,workoutsByDate:nordicWeek,gameDates:['2027-04-03']});
 assert.strictEqual(credited.workoutsByDate,nordicWeek,'an existing Nordic is credited, nothing added');
 assert.ok(credited.receipts.every(r=>r.status==='present'));
 const preSeason=completeWeeklyLegCoverage({weekStartISO:'2027-03-29',profile:coverageProfile,workoutsByDate:curlWeek});
 assert.ok(!preSeason.receipts.some(r=>r.category==='nordic'),'pre-season keeps R-393\'s Nordic-or-curl pair');
 // R-312: automatic Nordics stay out of G-2 through game day; the only strength day is G-1.
 const gMinusOne={'2027-04-02':{...strengthDay([simpleRow('Back Squat','s'),simpleRow('Hamstring Curl','h'),simpleRow('Calf Raises','c')]),dayOfWeek:5}};
 const proximity=completeWeeklyLegCoverage({weekStartISO:'2027-03-29',profile:inSeason,workoutsByDate:gMinusOne,gameDates:['2027-04-03']});
 assert.ok(!proximity.workoutsByDate['2027-04-02'].exercises.some(r=>isNordicExercise(r.exercise.name)),'no Nordic the day before a game');
 assert.equal(proximity.receipts.find(r=>r.category==='nordic')?.status,'unavailable');
});
const {scheduleWeek,scheduleRefused}=require('../rules/weeklyScheduler');
test('In-season game week: the off-club gym day outside the fixture window carries one off-feet session harder than a flush',()=>{
 const base={weekStartISO:'2027-03-29',phase:'In-season',offseasonBlock:null,gymAccessDays:[1,3,5],offLegAvailableDays:[1,3,5],clubNights:[2,4],gameDay:6,
  fixtureRecurrence:'recurring',age:24,readiness:{lowReadiness:false,highReadiness:false,lowFatigue:false,consistentlyCompletesThree:false},unavailableDays:[],athleteGender:'female'};
 const week=over=>{const r=scheduleWeek({...base,...over});assert.ok(!scheduleRefused(r),JSON.stringify(r));return r.days;};
 const harder=days=>days.filter(d=>d.clauseId==='R-395');
 const saturday=week({});
 assert.deepEqual(harder(saturday).map(d=>[d.dayOfWeek,d.conditioning,d.conditioningCategory,d.conditioningRole,d.owner]),[[3,'off_leg','tempo','finisher','strength']]);
 assert.equal(saturday.find(d=>d.dayOfWeek===1).conditioningCategory,'recovery_flush','G+2 keeps its R-265 flush');
 assert.deepEqual(harder(week({gameDay:0})).map(d=>d.dayOfWeek),[3],'a Sunday fixture still lands it on Wednesday (G-4)');
 assert.equal(harder(week({weekKind:'deload'})).length,0,'a reduced week authors nothing harder');
 assert.equal(harder(week({readiness:{...base.readiness,lowReadiness:true}})).length,0);
 assert.equal(harder(week({offLegAvailableDays:[]})).length,0,'no machine on the day: in-season combined conditioning is off-feet');
 assert.equal(harder(week({clubNights:[]})).length,0,'the no-club game week already authors its own fast session (WC-143)');
 assert.equal(harder(week({gymAccessDays:[1,5],offLegAvailableDays:[1,5]})).length,0,'Monday is G+2 and Friday G-1: no eligible day');
 assert.equal(harder(week({phase:'Pre-season',clubNights:[1,3],gymAccessDays:[1,3,5],gameDay:null})).length,0,'in-season only');
});
console.log(`Leg programming: ${passed}/${passed+failures.length} named cases passed`);
if(failures.length)process.exitCode=1;
