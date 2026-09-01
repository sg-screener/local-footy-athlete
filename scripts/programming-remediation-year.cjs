'use strict';
// Reuse the preserved real-onboarding/52-week driver. Never overwrite its output.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const {
  ACCEPTED_AWAY_SPAN,
  ACCEPTED_CHRISTMAS_BREAK,
} = require('./programming-final-year-audit-rules.cjs');
const repo = path.resolve(__dirname, '..');
const fullKit = process.argv.includes('--kit=full');
const output = path.resolve(repo, process.argv.find(a => a.startsWith('--output='))?.slice(9)
  ?? `outputs/programming-remedy-2026-08-28/${fullKit ? 'corrected-commercial' : 'original-partial'}`);
const original = path.join(repo, 'outputs/release-candidate-0bcc3353-rcsteps/current-shoulder-review/generate-year.cjs');
let code = fs.readFileSync(original, 'utf8');
const originalHash = createHash('sha256').update(code).digest('hex');
const replace = (from, to) => {
  if (code.split(from).length !== 2) throw Error(`Driver anchor missing or repeated: ${from}`);
  code = code.replace(from, to);
};
replace("const repo = '/Users/samgeurts/Documents/local-footy-athlete';", `const repo = ${JSON.stringify(repo)};`);
replace("function phaseFor(i) {return i<12?'Off-season':i<28?'Pre-season':'In-season';}\nfunction phaseWeek(i) {return i<12?i+1:i<28?i-11:i-27;}",
  `const {annualFootballPhaseForIndex,annualFootballPhaseWeek}=app('src/rules/annualFootballPhaseCalendar');
function phaseFor(i) {return annualFootballPhaseForIndex(i);}
function phaseWeek(i) {return annualFootballPhaseWeek(i);}`);
replace('if(i===12||i===28) {', 'if(i===7||i===26) {');
replace("teamTrainingDays:['Tuesday','Thursday']", "teamTrainingDays:phase==='Pre-season'?['Monday','Wednesday']:['Tuesday','Thursday']");
replace("assumptions:{offSeasonWeeks:12,preSeasonWeeks:16,inSeasonWeeks:24,clubDays:['Tuesday','Thursday']",
  "assumptions:{offSeasonWeeks:7,preSeasonWeeks:19,inSeasonWeeks:26,preSeasonClubDays:['Monday','Wednesday'],inSeasonClubDays:['Tuesday','Thursday']");
if (fullKit) replace('const profile=athleteAnswers(archetype);',
  `const profile=athleteAnswers(archetype);
  profile.equipmentAnswer=app('src/__tests__/support/equipmentAnswerFixture').presetEquipmentAnswer('commercial_gym',start);
  const fullCapabilities=app('src/utils/equipmentAvailability').resolveEquipmentCapabilities(profile);
  const requiredTags=['rack','barbell','trap_bar','medicine_ball','back_extension_bench'];
  const requiredModalities=['bike_erg','air_bike','row','ski','treadmill'];
  const missingFullKit=[...requiredTags.filter(tag=>!fullCapabilities.tags.includes(tag)),...requiredModalities.filter(mode=>!fullCapabilities.conditioningModalities.includes(mode))];
  if(missingFullKit.length)throw Error('Full onboarding equipment answer unresolved: '+missingFullKit.join(', '));`);
replace("const {project} = app('src/rules/projectVisibleWeek');", `const {project} = app('src/rules/projectVisibleWeek');
const {ownedEquipmentKit} = app('src/store/profileStore');
const {normalizeTemporarySourceFacts} = app('src/rules/temporarySourceFact');
const activeTemporaryFacts = () => normalizeTemporarySourceFacts({
  value: normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext).temporarySourceFacts,
});`);
replace('const events = [];', `const programmingSelectionTraceBatches = [];
let programmingSelectionTraceAthlete = 'not_started';
app('src/rules/programmingSelectionTrace').installAutomaticProgrammingSelectionTraceObserver((traces) => {
  programmingSelectionTraceBatches.push({ athlete: programmingSelectionTraceAthlete, traces });
});
const events = [];`);
replace("for (const [week,offset] of [[5,2],[18,0],[33,3],[45,0]]) event(week,offset,'tired');",
  `for (const [week,offset] of [[5,2],[18,0],[33,3],[45,0]]) event(week,offset,'tired');
event(35,0,'cooked');
event(11,3,'christmas_break');`);
replace("        if(e.kind==='tired'||e.kind==='sick') {\n          const r=await act(readinessActionForKind(e.kind==='tired'?'tired_today':'illness_moderate',{anchorDateISO:date,todayISO:date}),date,e.kind);\n          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];\n          label=e.kind==='tired'?'Tired today':'Sick';",
  `        if(e.kind==='tired'||e.kind==='cooked'||e.kind==='sick') {
          const readinessKind=e.kind==='tired'?'tired_today':e.kind==='cooked'?'cooked_week':'illness_moderate';
          const r=await act(readinessActionForKind(readinessKind,{anchorDateISO:date,todayISO:date}),date,e.kind);
          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];
          label=e.kind==='tired'?'Tired today':e.kind==='cooked'?'Very tired - remaining week deload':'Sick';
        } else if(e.kind==='christmas_break') {
          const span=${JSON.stringify(ACCEPTED_CHRISTMAS_BREAK)};
          await act({type:'set_schedule_modifier',source:{screen:'program_tab',surface:'christmas_break',initiatedBy:'tap'},scope:'current_week',payload:{date:span.from,todayISO:date,noTeamTrainingSpan:span},requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},date,'Christmas team-training break');
          label='Christmas team-training break accepted';`);
replace(
  "    for(let d=0;d<7;d++) {",
  `    if (weekStart===${JSON.stringify(ACCEPTED_AWAY_SPAN.from)}) {
      const beforeTravel=visibleSignature(view(weekStart,weekStart));
      const preTravelRestart=await quietAsync(()=>journey.relaunchApp({storage,todayISO:weekStart}));
      check(preTravelRestart.ok&&visibleSignature(view(weekStart,weekStart))===beforeTravel,'pre-travel accumulated restart',preTravelRestart);
      const owned=ownedEquipmentKit();
      const allowed=new Set(['dumbbells','bands','bench']);
      const unavailable=owned.tags.filter(tag=>!allowed.has(String(tag).toLowerCase()));
      const away=await quietAsync(()=>executeProgramControlActionDurably({type:'set_schedule_modifier',source:{screen:'program_tab',surface:'away_this_week',initiatedBy:'tap'},scope:'current_week',payload:{date:weekStart,todayISO:weekStart,awaySpan:${JSON.stringify({ from: ACCEPTED_AWAY_SPAN.from, until: ACCEPTED_AWAY_SPAN.until })},awayEquipment:{tags:unavailable,conditioningModalities:owned.conditioningModalities}},requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},{visibleWeek:view(weekStart,weekStart),todayISO:weekStart}));
      check(away.ok===true,'accumulated travel and equipment',away);
      w.events.push({date:weekStart,label:'Going Away Monday-Friday - dumbbells, bands and bench only'});
    }
    const acceptedFixtureInputs=gatherDeriveInputs(weekStart);
    w.acceptedFixtures=app('src/rules/fixtureConditionedAvailability').targetWeekFixtures({profile:acceptedFixtureInputs.onboardingData,weekStart,markedDays:acceptedFixtureInputs.markedDays,ownedPhase:app('src/rules/seasonPhaseOwner').ownSeasonPhase({profile:acceptedFixtureInputs.onboardingData,program:acceptedFixtureInputs.currentProgram})});
    for(let d=0;d<7;d++) {`,
);
replace(
  "      const date=plusDays(weekStart,d);setJourneyClock(date);",
  `      const date=plusDays(weekStart,d);setJourneyClock(date);
      if(date===${JSON.stringify(ACCEPTED_AWAY_SPAN.restoredOn)}){
        const travel=activeTemporaryFacts().find(fact=>fact.factKind==='schedule'&&fact.scheduleKind==='travel'&&fact.status==='active');
        check(!!travel,'active travel before Clear',activeTemporaryFacts());
        const cleared=await act({type:'clear_fatigue_status',source:{screen:'program_tab',surface:'my_status',initiatedBy:'tap'},scope:'current_and_future',payload:{modifierId:travel.factId,date},requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},date,'Back home - clear travel');
        check(cleared.ok===true&&!activeTemporaryFacts().some(fact=>fact.status==='active'&&(fact.factKind==='equipment'||(fact.factKind==='schedule'&&fact.scheduleKind==='travel'))),'travel and equipment clear atomically',activeTemporaryFacts());
        const afterClear=visibleSignature(view(weekStart,date));
        const clearRestart=await quietAsync(()=>journey.relaunchApp({storage,todayISO:date}));
        check(clearRestart.ok&&visibleSignature(view(weekStart,date))===afterClear,'travel Clear restart',clearRestart);
        w.events.push({date,label:'Back home - normal equipment and availability'});
  }`,
);
replace(
  "    const w={number:i+1,start:weekStart,phase,phaseWeek:pw,days:[],events:[]};",
  `    const acceptedProfileForWeek=useProfileStore.getState().onboardingData;
    const w={number:i+1,start:weekStart,phase,phaseWeek:pw,
      acceptedProgrammingInputs:{
        preferredTrainingDays:[...(acceptedProfileForWeek.preferredTrainingDays??[])],
        teamTrainingDays:[...(acceptedProfileForWeek.teamTrainingDays??[])],
        usualGameDay:acceptedProfileForWeek.usualGameDay??acceptedProfileForWeek.gameDay??null,
      },days:[],events:[]};`,
);
replace('async function run(gender) {', `async function run(gender) {
  programmingSelectionTraceAthlete = gender;`);
replace("if(item.kind==='team_training') return {name:'Team training',dose:'Club session',role:'team_training'};",
  "if(item.kind==='team_training') return {name:'Team training',catalogueIdentity:null,mainMuscles:[],dose:'Club session',role:'team_training'};");
replace("save('year-programs.json',data);", `save('year-programs.json',data);
  save('programming-selection-traces.json', {
    schemaVersion: 1,
    revision: data.revision,
    sourceDriverSha256: ${JSON.stringify(originalHash)},
    traceBatches: programmingSelectionTraceBatches,
  });`);
replace('rest:row.restSeconds>=90?helpers.formatRest(row.restSeconds):undefined,',
  "rest:item.role!=='power'&&row.restSeconds>=90?helpers.formatRest(row.restSeconds):undefined, domainRestSeconds:row.restSeconds,");
replace('role:item.role,optional:item.optional||undefined,pair:item.superset?.groupId',
  'role:item.role,domainRole:row.role,power:row.power,section18Evidence:row.section18Evidence,modalityLabel:item.modalityLabel,withheld:row.unavailableForInjury,optional:item.optional||(conditioning&&app("src/utils/sessionComponents").getSessionComponents(workout).some(c=>c.kind==="finisher"&&c.completionPolicy==="optional_no_penalty"))||undefined,pair:item.superset?.groupId');
replace('name:o.title,description:o.description,rows:o.rows.map',
  'name:o.title,modalityLabel:o.modalityLabel,description:o.description,rows:o.rows.map');
replace('return {name:formatExerciseDisplayName(row.exercise?.name??row.name),',
  `const catalogueIdentity=row.exercise?.name??row.name;
  const muscleMetadata=app('src/data/muscleExperienceMetadata').muscleMetadataFor(catalogueIdentity);
  const conditioningMuscles=app('src/data/conditioningMuscleMetadata').conditioningSessionMuscles({exercise:catalogueIdentity,modality:workout.conditioningBlock?.modality});
  return {name:formatExerciseDisplayName(catalogueIdentity),catalogueIdentity,mainMuscles:[...(conditioningMuscles?.primary??muscleMetadata?.primary??[])],`);
replace('warmup:flow?.movements.map(m=>({name:formatExerciseDisplayName(m.exercise.name),dose:mobilityFlowMovementDose(m.exercise)}))',
  `warmup:flow?.movements.map(m=>({name:formatExerciseDisplayName(m.exercise.name),catalogueIdentity:m.exercise.name,mainMuscles:[...(app('src/data/muscleExperienceMetadata').muscleMetadataFor(m.exercise.name)?.primary??[])],dose:mobilityFlowMovementDose(m.exercise)}))`);
replace('rows:template.items.map(item=>rowView(item,day.workout)),modifiers:',
  "rows:template.items.map(item=>rowView(item,day.workout)),speedRows:app('src/utils/sessionComponents').getSessionComponentRows(day.workout).speedRows.map(row=>rowView({kind:'exercise',presentation:'conditioning_phase',role:'speed',row},day.workout)),energySystem:app('src/rules/energySystemExposureEvidence').energySystemExposureEvidenceForWorkout(day.workout),conditioningIdentity:app('src/utils/conditioningVisibleIdentity').projectConditioningVisibleIdentity(day.workout),resolvedEquipment:app('src/utils/equipmentAvailability').resolveEquipmentCapabilities(useProfileStore.getState().onboardingData,normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext).activeConstraints,date),modifiers:");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  sourceDriver: original, sourceDriverSha256: originalHash, kit: fullKit ? 'onboarding commercial preset' : 'original explicit partial answer',
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceDiff: execFileSync('git', ['diff', '--stat', '--', 'src', 'scripts', 'package.json'], { cwd: repo, encoding: 'utf8' }),
  corrections: ['Full onboarding equipment capabilities asserted before generation', 'The canonical annual phase calendar shifts the accepted profile to pre-season in mid-November and in-season in late March', 'Pre-season team training is Monday/Wednesday; in-season team training is Tuesday/Thursday', 'The accepted 19 December-11 January Christmas team-training break is committed through the production action', 'Accepted availability, club nights, fixture facts and usual game day captured per compiled week', 'Very-tired remaining-week deload event added through the production readiness action', 'Going Away 28 December-1 January and atomic 2 January return-home equipment restoration added through production actions', 'Power rest hidden from display, retained as domainRestSeconds', 'Individual Speed rows exported as evidence from the existing typed component owner', 'Canonical energy-system evidence projected from the shared session classifier', 'Raw catalogue identity retained beside athlete-facing row and warm-up copy', 'Main muscles projected from the signed metadata owners for PDF reporting only', 'Actual conditioning identity and resolved equipment captured', 'Optional conditioning flag projected from existing component completion policy', 'Actual compiler selection traces captured through the scoped observer'],
  notCovered: ['Physical iPhone acceptance', 'Native onboarding taps (separate simulator evidence)'],
}, null, 2));
const driver = new Module(path.join(output, 'generate-year.cjs'), module);
driver.filename = path.join(output, 'generate-year.cjs');
driver.paths = module.paths;
driver._compile(code, driver.filename);
