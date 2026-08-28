'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { preflight } = require('./dev-e2e/maestro-device-preflight.cjs');
const target = 'B8B2C7B0-0558-448A-896D-EAB9C2C6C326';
const other = 'AF29FDED-33EE-4DF6-A8AE-5956A73B8254';
const driver = id => `7491 /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild test-without-building -xctestrun /tmp/${id}/maestro-driver-ios-config.xctestrun -destination id=${id}`;
const runner = id => `9032 /Users/test/Library/Developer/CoreSimulator/Devices/${id}/data/Containers/Bundle/Application/uuid/maestro-driver-iosUITests-Runner.app/maestro-driver-iosUITests-Runner`;
assert.equal(preflight(['--device', target], ''), target);
assert.equal(preflight([`--device=${target}`], driver(target) + '\n' + runner(target)), target);
assert.throws(() => preflight([], ''), /explicit --device/);
assert.throws(() => preflight(['--device', target], driver(other)), /target mismatch/);
assert.throws(() => preflight(['--device', target], runner(other)), /target mismatch/);
assert.equal(preflight(['--device', target], '22 /bin/zsh -c ' + driver(other)), target);
const wrapper = fs.readFileSync(path.join(__dirname, 'dev-e2e/run-maestro-ios.sh'), 'utf8');
const guard = wrapper.indexOf('maestro-device-preflight.cjs');
const launch = wrapper.indexOf('exec maestro test');
assert(guard >= 0 && launch > guard, 'device guard must actually execute before Maestro');
// Liveness: mutate the actual preflight module in memory; never edit the shared
// checkout or stop a real driver. Both known conflict shapes must kill its test.
const Module = require('node:module');
const subject = path.join(__dirname, 'dev-e2e/maestro-device-preflight.cjs');
const original = fs.readFileSync(subject, 'utf8');
const anchor = 'function conflictingDrivers(target, processes) {';
assert.equal(original.split(anchor).length, 2);
const mutant = new Module(subject, module);
mutant.paths = module.paths;
mutant._compile(original.replace(anchor, anchor + ' return [];'), subject);
for (const processText of [driver(other), runner(other)]) {
  let caught = false;
  try { assert.throws(() => mutant.exports.preflight(['--device', target], processText), /target mismatch/); }
  catch { caught = true; }
  assert(caught && /maestro-driver-ios/.test(processText));
}
console.log('Maestro device preflight: 9 checks passed; host and orphan-runner conflicts rejected, no state writes.');
