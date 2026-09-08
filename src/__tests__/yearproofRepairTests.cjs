require('sucrase/register'); global.__DEV__=true;
const assert=require('assert/strict'),fs=require('fs');
if(process.env.YEARPROOF_MUTATION){
 const path=require('path'),Module=require('module'),sucrase=require('sucrase');
 const changes={
  week_scope:['utils/injurySessionAdjustment.ts','existingExerciseNames: args.keptRowNames,','existingExerciseNames: args.weekExerciseNames,'],
  repeat_first:['utils/injurySessionAdjustment.ts','[unused, repeats]','[repeats, unused]'],
  list_chooser:['rules/blockExerciseSelection.ts','): ExerciseSelectionDecision {','): ExerciseSelectionDecision { return { identity: inputs.legalCandidates[0], decisionKind: "first_selection", reason: "no_previous_selection", previousIdentity: null, consideredCandidates: inputs.legalCandidates };'],
  generic_dose:['utils/injurySessionAdjustment.ts','): InjurySessionAddition {','): InjurySessionAddition { return candidate;'],
  add_authored:['utils/addExerciseCandidates.ts',"if (authored && authored.prescriptionType !== 'distance')",'if (false)'],
  lost_units:['rules/composedDose.ts','return perSide === undefined ? dose : { ...dose, perSide };','return { ...dose, perSide, prescriptionType: undefined };'],
  optional_denominator:['rules/blockBoundaryProgression.ts','if (!requiresStrengthComponent(workout)) continue;','if (!carriesStrengthComponent(workout)) continue;'],
  optional_credit:['rules/blockBoundaryProgression.ts',"if (strengthCompletion === 'full' && required)","if (strengthCompletion === 'full')"],
  missed_recovery:['rules/canonicalWeeklyAvailabilityState.ts','if(args.conditioningRecoveryWindows?.some(window => window.startISO <= end && window.endISO >= start)','if(false'],
 };
 const [file,from,to]=changes[process.env.YEARPROOF_MUTATION];const filename=path.resolve(__dirname,'..',file);
 const source=fs.readFileSync(filename,'utf8');assert.equal(source.split(from).length,2,'mutation must hit exactly once');
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));require.cache[filename]=m;
 m._compile(sucrase.transform(source.replace(from,to),{transforms:['typescript','imports'],filePath:filename}).code,filename);
}
const fixture=require('./fixtures/yearproofReportedInputs.json');
let passed=0,failed=0;
function test(name,fn){try{fn();console.log('PASS '+name);passed++;}catch(e){console.log('FAIL '+name+': '+e.message);failed++;}}
const normal=require('../rules/blockExerciseSelection');
const originalNormal=normal.decideExerciseForBlock;const decisions=[];
normal.decideExerciseForBlock=input=>{const output=originalNormal(input);decisions.push({input,output});return output;};
const injury=require('../utils/injurySessionAdjustment');
const doseContext={seasonPhase:'Pre-season',offseasonSubphase:null,deloadPolicy:{weekKind:'deload',door:'scheduled',seasonPhase:'Pre-season',intensityMultiplier:.9}};
const args={...fixture.injury,programmingContext:doseContext};
let added;
test('YP5 unused horizontal push precedes repeat',()=>{added=injury.deriveInjurySessionAdjustment(args).added;const main=added.find(x=>x.mainStrengthPattern);assert(main);assert(!args.weekExerciseNames.includes(main.name),main.name+' already in week');assert.equal(require('../rules/injuryFallbackLadder').finerPatternIdentityOf(main.name),'horizontal_push');});
test('YP1 added main follows phase and deload',()=>{const main=added.find(x=>x.mainStrengthPattern);assert(main.sets<=2,JSON.stringify(main));assert.equal(main.repsMin,4);assert.equal(main.repsMax,6);});
test('YP2 every authored timed addition keeps seconds',()=>{const {legalAddCandidates}=require('../utils/addExerciseCandidates');const cs=legalAddCandidates({leaf:'midline_carries',environment:args.environment,profile:args.profile});const holds=['Hollow Hold','Side Plank','Plank'];for(const name of holds){const c=cs.find(c=>c.name===name);assert(c,name+' missing');assert.equal(c.prescriptionType,'duration',name);assert(c.repsMin>=20,name);}});
const history=require('../rules/blockBoundaryProgression');
test('YP3 four required first-block sessions exclude four optional sessions',()=>{assert.equal(history.deriveAcceptedBlockStrengthRequirement({program:fixture.program,blockStartISO:'2026-09-28',blockEndISO:'2026-10-25'}),4);});
test('YP3 optional completion cannot hide missed required work; own load remains',()=>{const h=history.readBlockHistory({feedbackByDate:{'2026-10-01':{dateStr:'2026-10-01',completion:'full',strengthRequired:false,difficulty:4,strength:[{exerciseName:'Bench Press',completion:'full',weightKg:80}]}},blockStartISO:'2026-09-28',blockEndISO:'2026-10-25',requiredStrengthSessions:1});assert.equal(h.completedStrengthSessions,0);assert.equal(h.completedOptionalStrengthSessions,1);assert.equal(h.qualifies,false);assert.equal(h.lastRecordedLoadByExercise['Bench Press'],80);});
test('YP4 recovery window reaches Christmas availability',()=>{const {canonicalWeeklyAvailabilityStateFrom}=require('../rules/canonicalWeeklyAvailabilityState');const a=canonicalWeeklyAvailabilityStateFrom({profile:{...fixture.profile,seasonPhase:'Pre-season',teamTrainingStopsOverChristmas:true,christmasLastTeamTrainingDate:'2026-12-17',christmasTeamTrainingReturnDate:'2027-01-31'},weekStartISO:'2027-01-18',conditioningRecoveryWindows:[{startISO:'2027-01-11',endISO:'2027-01-17'}]});assert(a.christmasRestrictedWeeks.includes(4),JSON.stringify(a.christmasRestrictedWeeks));});

const familyOf=require('../rules/injuryFallbackLadder').finerPatternIdentityOf;
const base={...args,programmingContext:{...doseContext,deloadPolicy:null,blockNumber:5,blockStartISO:'2027-02-08'}};
const mainOf=input=>injury.deriveInjurySessionAdjustment(input)?.added.find(x=>x.mainStrengthPattern);
test('YP5 normal chooser executes and respects a legal unused preference',()=>{
  const first=mainOf(base);assert(decisions.length>0,'normal chooser never called');
  const call=decisions.at(-1);assert.equal(call.output.identity,first.name);
  const alternative=call.input.legalCandidates.find(n=>n!==first.name);assert(alternative,'no alternative for preference control');
  const pinned=mainOf({...base,programmingContext:{...base.programmingContext,pinnedIdentities:[alternative]}});
  assert.equal(pinned.name,alternative,'legal unused preference ignored');
});
test('YP5 meaningful own history changes the choice within the same family',()=>{
  const first=mainOf(base);const history=[{blockNumber:4,blockStartISO:'2027-01-11',slot:'horizontal_push',seatIndex:0,group:null,role:'main_bilateral',identity:first.name}];
  const retained=mainOf({...base,programmingContext:{...base.programmingContext,selectionHistory:history,progressedIdentities:[first.name]}});
  assert.equal(retained.name,first.name,'earned continuity lost');
  const rotated=mainOf({...base,programmingContext:{...base.programmingContext,selectionHistory:history}});
  assert.notEqual(rotated.name,first.name,'history ignored');assert.equal(familyOf(rotated.name),'horizontal_push');
});
test('YP5 rejecting the first choice searches the remaining unused family',()=>{
 const first=mainOf(base);const next=mainOf({...base,excludedByAthlete:[...base.excludedByAthlete,first.name]});
 assert(next);assert.notEqual(next.name,first.name);assert(!base.weekExerciseNames.includes(next.name));assert.equal(familyOf(next.name),familyOf(first.name));
});
test('YP5 catalogue reversal leaves the normal choice unchanged',()=>{
 const add=require('../utils/addExerciseCandidates');const original=add.legalAddCandidates;const first=mainOf(base);
 try {add.legalAddCandidates=input=>original(input).reverse();assert.equal(mainOf(base).name,first.name);}finally{add.legalAddCandidates=original;}
});
test('YP5 Bench on another day allows variants; Bench today prevents them',()=>{
 mainOf(base);assert(decisions.at(-1).input.legalCandidates.includes('Incline Bench'),'unused variant lost before ranking');
 const add=require('../utils/addExerciseCandidates').legalAddCandidates;const input={leaf:'upper_push',environment:base.environment,profile:base.profile};
 assert(add({...input,existingExerciseNames:[]}).some(c=>c.name==='Incline Bench'));
 assert(!add({...input,existingExerciseNames:['Bench Press']}).some(c=>c.name==='Incline Bench'));
 const day={...base.workout,exercises:[...base.workout.exercises,{...base.workout.exercises[0],exercise:{name:'Bench Press'}}]};
 const actual=injury.deriveInjurySessionAdjustment({...base,workout:day});
 const conflicts=require('../rules/exerciseVariationFamily').exerciseVariationConflictsWithSession;
 for(const row of actual?.added??[])assert(!conflicts({candidate:row.name,existingExerciseNames:['Bench Press']}),row.name);
});
for(const phase of ['Off-season','Pre-season','In-season'])for(const recovery of ['build','scheduled','readiness','illness']){
 if(phase==='In-season'&&recovery==='scheduled')continue;
 test('YP1 contextual dose '+phase+'/'+recovery,()=>{
  const context={seasonPhase:phase,offseasonSubphase:phase==='Off-season'?'mid_offseason':null,
    deloadPolicy:recovery==='build'?null:{weekKind:'deload',door:recovery,seasonPhase:phase,intensityMultiplier:1}};
  const actual=injury.deriveInjurySessionAdjustment({...base,programmingContext:context}).added;
  const main=actual.find(x=>x.mainStrengthPattern);assert(main);assert.equal(main.sets,recovery==='build'?3:2);
  const bands={'Off-season':[8,12],'Pre-season':[4,6],'In-season':[3,5]};
  assert.deepEqual([main.repsMin,main.repsMax],bands[phase]);
  for(const hold of actual.filter(r=>['Hollow Hold','Plank','Side Plank'].includes(r.name)))assert.equal(hold.prescriptionType,'duration');
 });
}
for(const name of ['Hollow Hold','Side Plank','Plank','Spanish Squat Hold','Copenhagen Plank (Half)','Groin Squeeze'])test('YP2 authored hold '+name,()=>{
 const pool=Object.values(require('../data/exercisePools').POOL_REGISTRY).flat().find(c=>c.name===name);assert(pool,name);
 const candidate={name,sets:2,repsMin:8,repsMax:12,weightKg:null};
 const row=injury.contextualInjuryAddition(candidate,doseContext,base.profile);
 assert.equal(row.prescriptionType,pool.prescriptionType);assert.equal(row.repsMin,pool.repsMin);assert.equal(row.repsMax,pool.repsMax);
 const printed=injury.injuryAdjustmentRows({workout:base.workout,added:[row],startOrder:0})[0];
 assert.equal(printed.prescriptionType,'duration');
});
for(const experience of ['Complete beginner','1-2 years','2-5 years','5+ years'])for(const kit of ['full','bodyweight'])test('YP5 safety/exhaustion '+experience+'/'+kit,()=>{
 const input={...base,profile:{...base.profile,experienceLevel:experience},environment:{...base.environment,experienceLevel:experience,
 ...(kit==='bodyweight'?{availableEquipment:['bodyweight'],availableEquipmentTags:['bodyweight'],hasEquipmentConstraint:true}:{})}};
 const result=injury.deriveInjurySessionAdjustment(input);assert(result);const names=result.added.map(c=>c.name);assert.equal(names.length,new Set(names).size);
 for(const row of result.added)assert(require('../utils/tapSwapHierarchy').assessTapSwapCandidateSafety(row.name,input.environment).safe,row.name);
 assert(result.added.length<=3);assert(result.added.reduce((n,r)=>n+r.sets,0)<=16);
});
test('YP5 repeat becomes available only after unused horizontal options are exhausted',()=>{
 const first=mainOf(base);assert(first);const allowed=require('../utils/addExerciseCandidates').legalAddCandidates({leaf:'upper_push',environment:base.environment,profile:base.profile,existingExerciseNames:[]}).filter(c=>familyOf(c.name)==='horizontal_push').map(c=>c.name);
 const exhausted={...base,excludedByAthlete:[...base.excludedByAthlete,...allowed.filter(n=>!base.weekExerciseNames.includes(n))]};
 const repeated=mainOf(exhausted);assert(repeated);assert(base.weekExerciseNames.includes(repeated.name),repeated.name);assert.equal(familyOf(repeated.name),'horizontal_push');
});
test('YP3 legacy feedback uses accepted required dates while extras retain logs',()=>{
 const f={dateStr:'2026-10-01',completion:'full',difficulty:4,strength:[{exerciseName:'Bench Press',completion:'full',weightKg:80}]};
 const h=history.readBlockHistory({feedbackByDate:{[f.dateStr]:f},blockStartISO:'2026-09-28',blockEndISO:'2026-10-25',requiredStrengthSessions:1,requiredStrengthDates:['2026-10-12']});assert.equal(h.completedStrengthSessions,0);assert.equal(h.lastRecordedLoadByExercise['Bench Press'],80);
});
if(process.env.YEARPROOF_RECEIPT)fs.writeFileSync(process.env.YEARPROOF_RECEIPT,JSON.stringify({passed,failed,decisions},null,2));
console.log(JSON.stringify({passed,failed}));if(failed)process.exitCode=1;
