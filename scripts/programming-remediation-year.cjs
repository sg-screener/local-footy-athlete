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
  "const profile=athleteAnswers(archetype); profile.equipmentAnswer=app('src/__tests__/support/equipmentAnswerFixture').presetEquipmentAnswer('commercial_gym',start); if(!app('src/utils/equipmentAvailability').resolveEquipmentCapabilities(profile).tags.includes('rack'))throw Error('Corrected commercial input has no rack');");
replace('const events = [];', `const programmingSelectionTraceBatches = [];
let programmingSelectionTraceAthlete = 'not_started';
app('src/rules/programmingSelectionTrace').installAutomaticProgrammingSelectionTraceObserver((traces) => {
  programmingSelectionTraceBatches.push({ athlete: programmingSelectionTraceAthlete, traces });
});
const events = [];`);
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
  "rows:template.items.map(item=>rowView(item,day.workout)),speedRows:app('src/utils/sessionComponents').getSessionComponentRows(day.workout).speedRows.map(row=>rowView({kind:'exercise',presentation:'conditioning_phase',role:'speed',row},day.workout)),conditioningIdentity:app('src/utils/conditioningVisibleIdentity').projectConditioningVisibleIdentity(day.workout),resolvedEquipment:app('src/utils/equipmentAvailability').resolveEquipmentCapabilities(useProfileStore.getState().onboardingData,normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext).activeConstraints,date),modifiers:");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  sourceDriver: original, sourceDriverSha256: originalHash, kit: fullKit ? 'onboarding commercial preset' : 'original explicit partial answer',
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceDiff: execFileSync('git', ['diff', '--stat', '--', 'src', 'scripts', 'package.json'], { cwd: repo, encoding: 'utf8' }),
  corrections: ['Power rest hidden from display, retained as domainRestSeconds', 'Individual Speed rows exported from existing typed component owner', 'Raw catalogue identity retained beside athlete-facing row and warm-up copy', 'Actual conditioning identity and resolved equipment captured', 'Optional conditioning flag projected from existing component completion policy', 'Actual compiler selection traces captured through the scoped observer'],
  notCovered: ['Physical iPhone acceptance', 'Native onboarding taps (separate simulator evidence)'],
}, null, 2));
const driver = new Module(path.join(output, 'generate-year.cjs'), module);
driver.filename = path.join(output, 'generate-year.cjs');
driver.paths = module.paths;
driver._compile(code, driver.filename);
