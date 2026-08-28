'use strict';
const { execFileSync } = require('node:child_process');

// Maestro's iOS driver uses a shared host port. A stale runner on another
// simulator can supply its hierarchy even when launchApp targets the right one.
// Refuse that ambiguous instrument; never terminate another task's driver.
function conflictingDrivers(target, processes) {
  return processes.split('\n').flatMap(line => {
    const entry = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!entry) return [];
    const [, pid, command] = entry;
    const host = /^\S*\/xcodebuild\s+test-without-building\b/.test(command)
      && command.includes('maestro-driver-ios')
      ? command.match(/-destination\s+id=([A-Fa-f0-9-]{36})\b/)?.[1] : null;
    const runner = /^\S*\/Devices\/[A-Fa-f0-9-]{36}\//.test(command)
      && /\/maestro-driver-iosUITests-Runner(?:\s|$)/.test(command)
      ? command.match(/\/Devices\/([A-Fa-f0-9-]{36})\//)?.[1] : null;
    const device = host ?? runner;
    return device && device.toUpperCase() !== target.toUpperCase() ? [{ pid: Number(pid), device }] : [];
  });
}

function preflight(args, processes) {
  const index = args.indexOf('--device');
  const target = index >= 0 ? args[index + 1] : args.find(arg => arg.startsWith('--device='))?.slice(9);
  if (!target || !/^[A-Fa-f0-9-]{36}$/.test(target)) throw Error('Pass an explicit --device simulator UUID before native verification.');
  const conflicts = conflictingDrivers(target, processes);
  if (conflicts.length) throw Error(`Maestro driver target mismatch: requested ${target}; active other-device drivers ${JSON.stringify(conflicts)}. Finish/stop the owning test driver before retrying. No app or simulator state was changed.`);
  return target;
}

module.exports = { conflictingDrivers, preflight };
if (require.main === module) {
  try {
    const target = preflight(process.argv.slice(2), execFileSync('ps', ['-axo', 'pid=,args='], { encoding: 'utf8' }));
    console.log(`[DevE2E device] isolated target: ${target}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 65;
  }
}
