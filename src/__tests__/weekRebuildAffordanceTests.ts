/**
 * NO ATHLETE-FACING WEEK REBUILD — Sam's ruling, 2026-07-29 device pass.
 *
 * The week screen carried a circular-arrows icon button in its top bar, beside
 * the next-week chevron. It opened "Rebuild this week?" and regenerated the
 * whole week's exercise content from the stored profile, discarding every custom
 * swap. It was dev tooling from early testing that was never taken back out, and
 * it sat one tap away from the most-used control on the screen.
 *
 * Sam: athletes must never have it.
 *
 * WHAT THIS GATE PROTECTS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * The rebuild MACHINERY is not the affordance and does not go. Clearing a coach
 * note, shifting season phase, and a fixture change all rebuild the week, and
 * they open the same sheet to show progress and to report a failure. Those are
 * consequences of something the athlete asked for by name; the deleted button
 * was the athlete asking for a rebuild as such, which is what was ruled out.
 *
 * So this gate asserts the DOOR is gone from both home renders and that the
 * handler that opened it is gone from the hook — not that the word "rebuild" has
 * left the codebase, which would fail on the machinery that is meant to stay.
 *
 * Run: npm run test:no-rebuild-affordance
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';

import { stripComments } from './support/sourceText';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const read = (relative: string): string =>
  stripComments(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

/** The circular-arrows glyph, by its first path segment. */
const CIRCULAR_ARROWS_PATH = 'M23 4v6h-6';

const HOME_RENDERS = [
  'src/screens/home/HomeScreenV2.tsx',
  'src/screens/home/HomeScreen.tsx',
];

console.log('\n[1] The button is gone from every home render');
{
  for (const relative of HOME_RENDERS) {
    const source = read(relative);
    const name = relative.split('/').pop();

    ok(`${name} has no rebuild icon button`,
      !source.includes(CIRCULAR_ARROWS_PATH),
      'the circular-arrows glyph is the affordance Sam ruled out');

    ok(`${name} has no "Rebuild this week" control`,
      !/accessibilityLabel="Rebuild this week"/.test(source));

    ok(`${name} carries no rebuild testID`,
      !/program-week-rebuild/.test(source),
      'a testID left behind keeps the control reachable from automation');

    ok(`${name} does not call the opener`,
      !/handleOpenRebuild/.test(source));
  }
}

console.log('\n[2] The handler is gone from the hook, not merely unreferenced');
{
  const hook = read('src/screens/home/useHomeScreen.ts');
  ok('useHomeScreen no longer defines handleOpenRebuild',
    !/handleOpenRebuild/.test(hook),
    'an exported opener is a door anything can wire back up');
}

console.log('\n[3] Nothing else in the app opens a rebuild');
{
  // A repo-wide sweep, because the point of the ruling is that the athlete has
  // no way to ask for a whole-week rebuild — not that one screen stopped asking.
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = stripComments(fs.readFileSync(full, 'utf8'));
      if (/handleOpenRebuild/.test(source) || source.includes(CIRCULAR_ARROWS_PATH)) {
        offenders.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(path.join(repoRoot, 'src'));
  ok('no source file offers a whole-week rebuild door',
    offenders.length === 0, offenders.join(', '));
}

console.log('\n[4] The rebuild machinery the athlete DID ask for still exists');
{
  // The counterweight. Without this, deleting the sheet outright would pass
  // every assertion above while removing the only progress and failure surface
  // the coach-note and phase-shift rebuilds have.
  const hook = read('src/screens/home/useHomeScreen.ts');
  ok('a rebuild can still run', /const runRebuild\s*=/.test(hook));
  ok('a rebuild failure is still classified for the athlete',
    /classifyRebuildFailure/.test(hook));
  ok('the progress sheet still has state to render',
    /rebuildModalVisible/.test(hook));

  const v2 = read('src/screens/home/HomeScreenV2.tsx');
  ok('the progress sheet is still mounted', /<RebuildSheet/.test(v2));
}

const total = passed + failures.length;
console.log(`\nWeek rebuild affordance: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
