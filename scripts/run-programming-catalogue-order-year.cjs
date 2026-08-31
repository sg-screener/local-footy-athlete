'use strict';
/** Execute the preserved lived-year driver, optionally reversing every automatic catalogue in memory. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const reverse = process.argv.includes('--reverse-catalogues');
const fullKit = process.argv.includes('--kit=full');
const scopeArg = process.argv.find((arg) => arg.startsWith('--reverse-scope='));
const reverseScope = scopeArg?.slice('--reverse-scope='.length) ?? 'all';
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
if (!outputArg) throw Error('--output=<relative directory> is required');
const output = path.resolve(repo, outputArg.slice(9));
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
replace('const events = [];', `const catalogueOrderSelections = [];
app('src/rules/programmingSelectionTrace').installAutomaticProgrammingSelectionTraceObserver((traces) => {
  catalogueOrderSelections.push(...traces.map((trace) => ({ decisionId: trace.decisionId, selected: trace.selected, reason: trace.selectionReason })));
});
const events = [];`);
replace("save('year-programs.json',data);", `save('year-programs.json',data);
  save('selected-programming-decisions.json', catalogueOrderSelections);`);
if (reverse) {
  const reverseConditioning = reverseScope === 'all' || reverseScope === 'original';
  const reverseStrength = reverseScope === 'all' || reverseScope === 'strength';
  const reversePower = reverseScope === 'all' || reverseScope === 'power';
  const mutations = [
    reverseConditioning ? 'CONDITIONING_TEMPLATES.reverse();' : '',
    reversePower ? 'POWER_EXERCISE_POOL.reverse();' : '',
    reverseStrength ? `for (const pool of Object.values(STRENGTH_POOLS)) {
  pool.anchor.entries.reverse();
  pool.accessory.entries.reverse();
}` : '',
    reverseConditioning ? `const reversedExerciseTags = Object.entries(EXERCISE_TAGS).reverse();
for (const key of Object.keys(EXERCISE_TAGS)) delete EXERCISE_TAGS[key];
Object.assign(EXERCISE_TAGS, Object.fromEntries(reversedExerciseTags));` : '',
  ].filter(Boolean).join('\n');
  replace("const {project} = app('src/rules/projectVisibleWeek');", `const {project} = app('src/rules/projectVisibleWeek');
const {CONDITIONING_TEMPLATES} = app('src/data/conditioningTemplates');
const {EXERCISE_TAGS} = app('src/data/exerciseTags');
const {POWER_EXERCISE_POOL} = app('src/rules/powerExercisePool');
const {STRENGTH_POOLS} = app('src/data/exercisePoolsStrength');
${mutations}`);
}
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  sourceDriver: original,
  sourceDriverSha256: originalHash,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  kit: fullKit ? 'onboarding commercial preset' : 'preserved partial audit input',
  catalogueOrder: reverse ? `reversed:${reverseScope}` : 'authored',
  catalogues: ['CONDITIONING_TEMPLATES', 'EXERCISE_TAGS', 'POWER_EXERCISE_POOL', 'every STRENGTH_POOLS anchor/accessory array'],
  notCovered: ['Physical iPhone', 'Native onboarding taps'],
}, null, 2));
const driver = new Module(path.join(output, 'generate-year.cjs'), module);
driver.filename = path.join(output, 'generate-year.cjs');
driver.paths = module.paths;
driver._compile(code, driver.filename);
