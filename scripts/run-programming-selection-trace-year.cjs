'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
// This tracked entry owns the existing lived-year journey and its evidence.
const repo = path.resolve(__dirname, '..');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const output = path.resolve(repo, outputArg?.slice(9) ?? 'output/programming-selection-trace-year');
const sourceDriverSha256 = require('node:crypto').createHash('sha256')
  .update(fs.readFileSync(__filename)).digest('hex');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  sourceDriver: __filename, sourceDriverSha256,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  observer: 'programmingSelectionTrace.installAutomaticProgrammingSelectionTraceObserver',
  notCovered: ['Physical iPhone', 'Native onboarding taps'],
}, null, 2));
process.env.TZ = 'Australia/Melbourne';
global.__DEV__ = true;
const storage = new Map();
global.window = {localStorage: {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),clear:()=>storage.clear()}};
global.fetch = () => {throw new Error('Offline illustration: network disabled');};
require(path.join(repo,'node_modules/sucrase/register'));
const app = p => require(path.join(repo,p));
const journey = app('src/__tests__/support/athleteJourney');
const {athleteAnswers,plusDays} = app('src/__tests__/compilerYear/catalog');
const {useProgramStore} = app('src/store/programStore');
const {useProfileStore} = app('src/store/profileStore');
const {deriveVisibleWeekLive,gatherDeriveInputs,assembleScheduleState} = app('src/utils/deriveVisibleWeek');
const {selectMobilityPrehabFlow,mobilityFlowMovementDose} = app('src/utils/mobilityPrehabFlow');
const {buildSessionTemplate} = app('src/utils/sessionTemplate');
const {formatExerciseDisplayName} = app('src/utils/exerciseDisplay');
const helpers = app('src/screens/home/dayWorkoutHelpers');
const {resolveLoadControlMode,formatLoadControlLabel} = app('src/utils/loadEstimation');
const {sessionAsksForLoad} = app('src/rules/sessionLoadEntry');
const {weeklyPlanTitle,combinedConditioningCategoryLabel} = app('src/utils/weeklyPlanDisplay');
const {applyPhaseShift} = app('src/utils/profileMutations');
const {commitProfileProgramTransaction} = app('src/store/profileProgramTransaction');
const {executeFixtureMutationTransaction} = app('src/store/fixtureMutationTransaction');
const {executeProgramControlActionDurably} = app('src/utils/programControlActions');
const {readinessActionForKind} = app('src/utils/weekReadinessActions');
const {buildGuidedInjuryConstraint} = app('src/utils/guidedInjuryControl');
const {selectActiveProgramModifiers} = app('src/utils/activeProgramModifiers');
const {normalizeAcceptedMaterialContext} = app('src/store/acceptedStateColdStart');
const {decisionLedgerEntries} = app('src/store/decisionLedgerStore');
const {visibleSignature,signatureDifferences} = app('src/__tests__/compilerYear/invariants');
const {project} = app('src/rules/projectVisibleWeek');
const start = '2026-09-28';
const sixDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const source = {screen:'my_status',surface:'status_card',initiatedBy:'tap'};
const {quiet,quietAsync,setJourneyClock} = journey;
const weekLimit = Number(process.argv.find(a=>a.startsWith('--weeks='))?.split('=')[1]??52);
const probe = process.argv.includes('--probe');
const genderOnly = process.argv.find(a=>a.startsWith('--gender='))?.split('=')[1];
const selectionTraceBatches = [];
let activeTraceAthlete = 'not_started';
app('src/rules/programmingSelectionTrace').installAutomaticProgrammingSelectionTraceObserver(traces => {
  selectionTraceBatches.push({ athlete: activeTraceAthlete, traces });
});
const events = [];
function event(week,offset,kind,extra={}) {events.push({date:plusDays(start,(week-1)*7+offset),kind,...extra});}
for (const [week,offset] of [[5,2],[18,0],[33,3],[45,0]]) event(week,offset,'tired');
for (const [week,offset,duration] of [[11,0,3],[26,1,4],[42,2,3]]) {
  event(week,offset,'sick'); event(week,offset+duration,'well');
}
for (const [week,area,severity,duration] of [[8,'Shoulder',4,10],[22,'Calf / Achilles',6,10],[39,'Knee',4,14]]) {
  event(week,1,'injury',{area,severity}); event(week,1+duration,'recovered',{area});
}
function phaseFor(i) {return i<12?'Off-season':i<28?'Pre-season':'In-season';}
function phaseWeek(i) {return i<12?i+1:i<28?i-11:i-27;}
function save(name,data) {require(path.join(repo,'scripts/write-json-evidence.cjs')).writeJsonEvidence(path.join(output,name),data);}
function view(week,date) {return quiet(()=>deriveVisibleWeekLive(week,date));}
function rowView(item,workout) {
  if(item.kind==='team_training') return {name:'Team training',dose:'Club session',role:'team_training'};
  if(item.kind==='conditioning_choice') return {name:'Choose one',role:'conditioning',choices:item.options.map(o=>({name:o.title,description:o.description,rows:o.rows.map(row=>rowView({kind:'exercise',presentation:'conditioning_phase',role:'conditioning',row},workout))}))};
  const row=item.row;
  const conditioning=item.role==='conditioning'||item.presentation==='conditioning_phase';
  return {name:formatExerciseDisplayName(row.exercise?.name??row.name),
    dose:conditioning?helpers.formatConditioningRowPrescription(row):(['mobility','recovery','addon'].includes(item.presentation)?helpers.formatLowLoadSetsReps(row):helpers.formatStrengthSetsReps(row)),
    notes:conditioning?row.notes:undefined,
    kg:row.prescribedWeightKg,addedForInjury:row.addedForInjury,
    load:!conditioning&&sessionAsksForLoad(workout)?formatLoadControlLabel(resolveLoadControlMode(row.exercise?.name??row.name),row.prescribedWeightKg??null):'',
    role:item.role,optional:item.optional||undefined,pair:item.superset?.groupId};
}
function modifiers(week,date,days) {
  const p=useProgramStore.getState();
  const accepted=normalizeAcceptedMaterialContext(p.acceptedMaterialContext);
  const compiledWeek=p.currentProgram?.microcycles.find(w=>w.startDate.slice(0,10)===week);
  return quiet(()=>selectActiveProgramModifiers({activeConstraints:accepted.activeConstraints,
    temporarySourceFacts:accepted.temporarySourceFacts,decisionEntries:decisionLedgerEntries(),
    reversibleAdjustments:p.reversibleAdjustmentLedger.adjustments,sessionConstraints:p.userRemovalConstraints,
    onboardingData:useProfileStore.getState().onboardingData,todayISO:date,weekKind:compiledWeek?.weekKind,
    compiledWeek,visibleWeekDays:days})).map(m=>({title:m.title,body:m.body,effect:m.effect,source:m.source}));
}
async function run(gender) {
  activeTraceAthlete = gender;
  const archetype={id:`year-${gender}`,gender,days:sixDays,experience:'5+ years',equipment:'commercial',initialPhase:'Off-season',clubDays:['Tuesday','Thursday'],gameDay:'Saturday',extraGame:false};
  const profile=athleteAnswers(archetype);
  profile.firstName=gender==='male'?'Male example':'Female example';
  profile.seasonFinishedOn=plusDays(start,-1); profile.equipmentAnswer.answeredOn=start; profile.twoKmTimeTrial.recordedOn=start;
  const result={gender,profile,weeks:[],actions:[],restarts:[],loggedDays:0};
  const check=(ok,label,detail)=>{if(!ok)throw new Error(label+': '+JSON.stringify(detail));};
  const act=async(action,date,label)=>{
    const r=await quietAsync(()=>executeProgramControlActionDurably(action,{todayISO:date}));
    result.actions.push({date,label,result:r}); check(r.ok,label,r); return r;
  };
  let injuryId,illnessId;
  const install=await quietAsync(()=>journey.coldStartThroughOnboarding({profile,installDayISO:start}));
  check(!install.onboardingRefusal,'onboarding',install.onboardingRefusal);
  for(let i=0;i<weekLimit;i++) {
    const weekStart=plusDays(start,i*7),phase=phaseFor(i),pw=phaseWeek(i);
    setJourneyClock(weekStart);
    if(i===12||i===28) {
      const next=applyPhaseShift(useProfileStore.getState().onboardingData,{targetPhase:phase,preferredTrainingDays:phase==='In-season'?sixDays.slice(0,5):sixDays,teamTrainingDays:['Tuesday','Thursday'],gameAnchor:phase==='In-season'?{kind:'usual_day',day:'Saturday'}:undefined});
      const patch=Object.fromEntries(['seasonPhase','seasonFinishedOn','preferredTrainingDays','trainingDaysPerWeek','teamTrainingDays','teamTrainingDaysPerWeek','usualGameDay','gameDay'].map(k=>[k,next[k]]));
      const shifted=await quietAsync(()=>commitProfileProgramTransaction({change:{kind:'profile_setup',patch},todayISO:weekStart,sourceSurface:'phase_shift'}));
      result.actions.push({date:weekStart,label:phase,result:shifted});check(shifted.ok,'phase shift',shifted);
    }
    const rolled=quiet(()=>journey.rolloverIfDue(weekStart)); check(!rolled.refusal,'rollover',rolled);
    quiet(()=>journey.followTheWeek(weekStart));
    const w={number:i+1,start:weekStart,phase,phaseWeek:pw,days:[],events:[]};
    if(phase==='In-season'&&([5,11,17].includes(pw)||[3,9,15,21].includes(pw))) {
      const bye=[5,11,17].includes(pw);
      const r=await quietAsync(()=>executeFixtureMutationTransaction({action:bye?'remove':'move',fixtureKind:'game',sourceDate:plusDays(weekStart,5),targetDate:bye?undefined:plusDays(weekStart,6),expectedAcceptedRevision:useProgramStore.getState().acceptedMaterialContext.revision,source:{requestedBy:'athlete',producer:'tap',surface:'program_tab',commandId:`illustration:${gender}:${weekStart}`},todayISO:weekStart}));
      result.actions.push({date:weekStart,label:bye?'Bye':'Sunday game',result:r});check(r.outcome==='accepted','fixture',r);
      w.events.push({date:weekStart,label:bye?'Bye week':'Sunday game'});
    }
    for(let d=0;d<7;d++) {
      const date=plusDays(weekStart,d);setJourneyClock(date);
      for(const e of events.filter(e=>e.date===date)) {
        let label;
        if(e.kind==='tired'||e.kind==='sick') {
          const r=await act(readinessActionForKind(e.kind==='tired'?'tired_today':'illness_moderate',{anchorDateISO:date,todayISO:date}),date,e.kind);
          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];
          label=e.kind==='tired'?'Tired today':'Sick';
        } else if(e.kind==='well') {
          check(!!illnessId,'illness id',illnessId);
          await act({type:'clear_fatigue_status',payload:{modifierId:illnessId,date},source,scope:'current_week',requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},date,'Recovered from illness');
          illnessId=undefined;label='Well again';
        } else if(e.kind==='injury') {
          const constraint=buildGuidedInjuryConstraint({region:e.area==='Shoulder'?'upper_body':'lower_body',area:e.area,severity:e.severity,severityBand:e.severity<6?'slight':'moderate',adjustmentLevel:e.severity<6?'slight':'moderate',triggers:e.area==='Shoulder'?['pressing']:['running'],seriousSymptoms:false},{todayISO:date});
          const r=await act({type:'set_injury_modifier',scope:'current_and_future',payload:{constraint},source,requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},date,e.area+' injury');
          injuryId=r.createdModifierIds?.[0];check(!!injuryId,'injury id',r);
          label=e.area+' injury · '+e.severity+'/10';
        } else {
          await act({type:'clear_injury_modifier',scope:'current_and_future',payload:{episodeId:injuryId},source,requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},date,e.area+' recovered');
          injuryId=undefined;label=e.area+' recovered';
        }
        w.events.push({date,label});
      }
      const days=view(weekStart,date),day=days.find(x=>x.date===date);
      check(!!day,'missing visible date',date);
      const template=quiet(()=>buildSessionTemplate(day.workout));
      let projected,projectionError;
      try {projected=quiet(()=>project({week:days,weekStart,program:useProgramStore.getState().currentProgram})).days.find(x=>x.date===date);}
      catch(error) {projectionError=error.message;}
      const flow=quiet(()=>selectMobilityPrehabFlow({workout:day.workout,seasonPhase:phase,isGameWeek:days.some(x=>x.indicator==='game'),athlete:assembleScheduleState(gatherDeriveInputs(date)).athleteContext,date,performedMovementIds:[]}));
      const shown={date,source:day.source,name:day.workout?weeklyPlanTitle(day.workout):null,conditioning:day.workout?combinedConditioningCategoryLabel(day.workout):null,type:day.workout?.workoutType,runningReturnStage:day.workout?.runningReturnStage,
        injuryAdjustment:day.workout?.injuryAdjustment,
        kind:projected?.kind,parts:projected?.parts.map(p=>({kind:p.kind,name:String(p.headline)})),projectionError,tier:day.workout?.sessionTier,warmup:flow?.movements.map(m=>({name:formatExerciseDisplayName(m.exercise.name),dose:mobilityFlowMovementDose(m.exercise)})),rows:template.items.map(item=>rowView(item,day.workout)),modifiers:modifiers(weekStart,date,days)};
      if(probe&&i===0&&d===0) save('probe.json',{day,template,shown,program:useProgramStore.getState().currentProgram});
      w.days.push(shown);
      const logged=await quietAsync(()=>journey.recordDay(date,{record:!illnessId,completion:'full',feeling:'good',soreness:'none',difficulty:7,logWeights:true,conditioningRpe:6,absenceReason:illnessId?'Sick':undefined}));
      check(!['refused','threw'].includes(logged.result)&&!(logged.result==='no_session'&&logged.detail),'log session',logged);
      if(logged.result==='recorded')result.loggedDays++;
    }
    const date=plusDays(weekStart,6),before=visibleSignature(view(weekStart,date));
    const boot=await quietAsync(()=>journey.relaunchApp({storage,todayISO:date}));
    const same=boot.ok&&before===visibleSignature(view(weekStart,date));
    const differences=same?[]:signatureDifferences(before,visibleSignature(view(weekStart,date)));
    result.restarts.push({date,ok:same,error:boot.error}); check(same,'restart',boot);
    Object.assign(result.restarts.at(-1),{differences});
    result.weeks.push(w);save(`${gender}-year.json`,result);
    process.stdout.write(`${gender}: week ${i+1}/${weekLimit} ${phase} captured\n`);
  }
  return result;
}
(async()=>{
  const auditScope={expectedGenders:['male','female'].filter(x=>!genderOnly||genderOnly===x),expectedWeeks:weekLimit};
  const data={revision:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),start,end:plusDays(start,363),assumptions:{offSeasonWeeks:12,preSeasonWeeks:16,inSeasonWeeks:24,clubDays:['Tuesday','Thursday'],logging:'All offered sessions logged at prescribed loads and moderate effort; no sessions logged while sick.'},athletes:[]};
  for(const gender of ['male','female'].filter(x=>!genderOnly||genderOnly===x))data.athletes.push(await run(gender));
  Object.assign(data,{auditScope});
  save('year-programs.json',data);
  save('programming-selection-traces.json', { schemaVersion: 1, revision: data.revision, sourceDriverSha256, traceBatches: selectionTraceBatches });
  process.stdout.write('Generated '+data.athletes.length+' athletes\n');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
