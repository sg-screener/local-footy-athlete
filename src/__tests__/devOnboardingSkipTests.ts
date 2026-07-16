import fs from 'fs';
import path from 'path';
import {
  DEV_TEST_ONBOARDING_DATA,
  isDevOnboardingSkipEnabled,
} from '../utils/devOnboardingSkip';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}`);
  }
}

ok('enabled in dev', isDevOnboardingSkipEnabled(true));
ok('disabled in release', !isDevOnboardingSkipEnabled(false));
ok('uses the standard Sam profile',
  DEV_TEST_ONBOARDING_DATA.firstName === 'Sam' &&
  DEV_TEST_ONBOARDING_DATA.seasonPhase === 'In-season');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'utils', 'devOnboardingSkip.ts'),
  'utf8',
);
ok('delegates to the standard named seed',
  /coordinator\.reset\('standard-in-season-week'\)/.test(source));
ok('does not import the network generator',
  !/generateProgramFromProfile|services\/api\/generateProgram/.test(source));
ok('development coordinator is dynamically loaded after the dev guard',
  source.indexOf("if (!isDevOnboardingSkipEnabled())") <
    source.indexOf("require('../dev/e2e/defaultDevE2ESeedCoordinator')"));
ok('legacy generator argument is never invoked', !/await\s+_args\.generateProgram|_args\.generateProgram\(/.test(source));

console.log(`\nDev onboarding skip: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
