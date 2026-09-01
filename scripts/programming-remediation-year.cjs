'use strict';
// Reuse the preserved real-onboarding/52-week driver. Never overwrite its output.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
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
event(35,0,'cooked');`);
replace("        if(e.kind==='tired'||e.kind==='sick') {\n          const r=await act(readinessActionForKind(e.kind==='tired'?'tired_today':'illness_moderate',{anchorDateISO:date,todayISO:date}),date,e.kind);\n          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];\n          label=e.kind==='tired'?'Tired today':'Sick';",
  `        if(e.kind==='tired'||e.kind==='cooked'||e.kind==='sick') {
          const readinessKind=e.kind==='tired'?'tired_today':e.kind==='cooked'?'cooked_week':'illness_moderate';
          const r=await act(readinessActionForKind(readinessKind,{anchorDateISO:date,todayISO:date}),date,e.kind);
          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];
          label=e.kind==='tired'?'Tired today':e.kind==='cooked'?'Very tired - remaining week deload':'Sick';`);
replace(
  "    for(let d=0;d<7;d++) {",
  `    if (phase==='Pre-season' && pw===7) {
      const beforeTravel=visibleSignature(view(weekStart,weekStart));
      const preTravelRestart=await quietAsync(()=>journey.relaunchApp({storage,todayISO:weekStart}));
      check(preTravelRestart.ok&&visibleSignature(view(weekStart,weekStart))===beforeTravel,'pre-travel accumulated restart',preTravelRestart);
      const owned=ownedEquipmentKit();
      const allowed=new Set(['dumbbells','bands','bench']);
      const unavailable=owned.tags.filter(tag=>!allowed.has(String(tag).toLowerCase()));
      const away=await quietAsync(()=>executeProgramControlActionDurably({type:'set_schedule_modifier',source:{screen:'program_tab',surface:'away_this_week',initiatedBy:'tap'},scope:'current_week',payload:{date:weekStart,todayISO:weekStart,awaySpan:{from:weekStart,until:plusDays(weekStart,4)},awayEquipment:{tags:unavailable,conditioningModalities:owned.conditioningModalities}},requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},{visibleWeek:view(weekStart,weekStart),todayISO:weekStart}));
      check(away.ok===true,'accumulated travel and equipment',away);
      w.events.push({date:weekStart,label:'Going Away Monday-Friday - dumbbells, bands and bench only'});
    }
    for(let d=0;d<7;d++) {`,
);
replace(
  "      const date=plusDays(weekStart,d);setJourneyClock(date);",
  `      const date=plusDays(weekStart,d);setJourneyClock(date);
      if(phase==='Pre-season'&&pw===7&&d===5){
        const travel=activeTemporaryFacts().find(fact=>fact.factKind==='schedule'&&fact.status==='active');
        check(!!travel,'active travel before Clear',activeTemporaryFacts());
        const cleared=await act({type:'clear_fatigue_status',source:{screen:'program_tab',surface:'my_status',initiatedBy:'tap'},scope:'current_and_future',payload:{modifierId:travel.factId,date},requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},date,'Back home - clear travel');
        check(cleared.ok===true&&!activeTemporaryFacts().some(fact=>fact.status==='active'&&(fact.factKind==='schedule'||fact.factKind==='equipment')),'travel and equipment clear atomically',activeTemporaryFacts());
        const afterClear=visibleSignature(view(weekStart,date));
        const clearRestart=await quietAsync(()=>journey.relaunchApp({storage,todayISO:date}));
        check(clearRestart.ok&&visibleSignature(view(weekStart,date))===afterClear,'travel Clear restart',clearRestart);
        w.events.push({date,label:'Back home - normal equipment and availability'});
      }`,
);
replace('async function run(gender) {', `async function run(gender) {
  programmingSelectionTraceAthlete = gender;`);
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
  'const catalogueIdentity=row.exercise?.name??row.name; return {name:formatExerciseDisplayName(catalogueIdentity),catalogueIdentity,');
replace('warmup:flow?.movements.map(m=>({name:formatExerciseDisplayName(m.exercise.name),dose:mobilityFlowMovementDose(m.exercise)}))',
  'warmup:flow?.movements.map(m=>({name:formatExerciseDisplayName(m.exercise.name),catalogueIdentity:m.exercise.name,dose:mobilityFlowMovementDose(m.exercise)}))');
replace('rows:template.items.map(item=>rowView(item,day.workout)),modifiers:',
  "rows:template.items.map(item=>rowView(item,day.workout)),speedRows:app('src/utils/sessionComponents').getSessionComponentRows(day.workout).speedRows.map(row=>rowView({kind:'exercise',presentation:'conditioning_phase',role:'speed',row},day.workout)),energySystem:app('src/rules/energySystemExposureEvidence').energySystemExposureEvidenceForWorkout(day.workout),conditioningIdentity:app('src/utils/conditioningVisibleIdentity').projectConditioningVisibleIdentity(day.workout),resolvedEquipment:app('src/utils/equipmentAvailability').resolveEquipmentCapabilities(useProfileStore.getState().onboardingData,normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext).activeConstraints,date),modifiers:");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  sourceDriver: original, sourceDriverSha256: originalHash, kit: fullKit ? 'onboarding commercial preset' : 'original explicit partial answer',
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceDiff: execFileSync('git', ['diff', '--stat', '--', 'src', 'scripts', 'package.json'], { cwd: repo, encoding: 'utf8' }),
  corrections: ['Full onboarding equipment capabilities asserted before generation', 'Very-tired remaining-week deload event added through the production readiness action', 'Going Away and atomic return-home equipment restoration added through production actions', 'Power rest hidden from display, retained as domainRestSeconds', 'Individual Speed rows exported as evidence from the existing typed component owner', 'Canonical energy-system evidence projected from the shared session classifier', 'Raw catalogue identity retained beside athlete-facing row and warm-up copy', 'Actual conditioning identity and resolved equipment captured', 'Optional conditioning flag projected from existing component completion policy', 'Actual compiler selection traces captured through the scoped observer'],
  notCovered: ['Physical iPhone acceptance', 'Native onboarding taps (separate simulator evidence)'],
}, null, 2));
const driver = new Module(path.join(output, 'generate-year.cjs'), module);
driver.filename = path.join(output, 'generate-year.cjs');
driver.paths = module.paths;
driver._compile(code, driver.filename);
