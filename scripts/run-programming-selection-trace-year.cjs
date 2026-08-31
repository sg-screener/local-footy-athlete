'use strict';
/**
 * Runs the preserved lived-year driver through the CURRENT app compiler and
 * captures the compiler's typed selection evidence. The driver remains the
 * owner of onboarding, phase changes, injuries, sickness, fixtures, logging
 * and 52 restart checks; this wrapper only installs the diagnostic tap.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const output = path.resolve(repo, outputArg?.slice(9) ?? 'output/programming-selection-trace-year');
const original = path.join(
  repo,
  'outputs/release-candidate-0bcc3353-rcsteps/current-shoulder-review/generate-year.cjs',
);
let code = fs.readFileSync(original, 'utf8');
const originalHash = createHash('sha256').update(code).digest('hex');
const replace = (from, to) => {
  if (code.split(from).length !== 2) throw Error(`Driver anchor missing or repeated: ${from}`);
  code = code.replace(from, to);
};

replace("const repo = '/Users/samgeurts/Documents/local-footy-athlete';", `const repo = ${JSON.stringify(repo)};`);
replace("const events = [];", `const selectionTraceBatches = [];
let activeTraceAthlete = 'not_started';
app('src/rules/programmingSelectionTrace').installAutomaticProgrammingSelectionTraceObserver((traces) => {
  selectionTraceBatches.push({ athlete: activeTraceAthlete, traces });
});
const events = [];`);
replace('async function run(gender) {', `async function run(gender) {
  activeTraceAthlete = gender;`);
replace("save('year-programs.json',data);", `save('year-programs.json',data);
  save('programming-selection-traces.json', {
    schemaVersion: 1,
    revision: data.revision,
    sourceDriverSha256: ${JSON.stringify(originalHash)},
    traceBatches: selectionTraceBatches,
  });`);

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  sourceDriver: original,
  sourceDriverSha256: originalHash,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  observer: 'programmingSelectionTrace.installAutomaticProgrammingSelectionTraceObserver',
  notCovered: ['Physical iPhone', 'Native onboarding taps'],
}, null, 2));

const driver = new Module(path.join(output, 'generate-year.cjs'), module);
driver.filename = path.join(output, 'generate-year.cjs');
driver.paths = module.paths;
driver._compile(code, driver.filename);
