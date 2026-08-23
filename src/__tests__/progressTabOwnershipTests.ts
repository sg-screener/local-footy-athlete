/** Progress owns visible tracking; Coach keeps the same facts privately. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
const ROOT = path.resolve(__dirname, '../..');
let pass = 0;
let fail = 0;
const failures: string[] = [];

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function ok(name: string, condition: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`);
  }
}

function progressOwnsVisibleTracking(progress: string, coach: string): boolean {
  return /testID="progress-load-continuum"/.test(progress)
    && /testID="progress-main-lifts"/.test(progress)
    && /testID="progress-two-km"/.test(progress)
    && !/CoachDashboard|SnapshotDashboard|coach-dashboard/.test(coach);
}

console.log('\n[PROGRESS] ONE LIVE SNAPSHOT, TWO HONEST SURFACES');
{
  const navigator = read('src/navigation/AppNavigator.tsx');
  const coach = read('src/screens/coach/CoachTabScreen.tsx');
  const progress = read('src/screens/progress/ProgressTabScreen.tsx');
  const snapshot = read('src/rules/liveAthleteSnapshot.ts');

  const tabNames = [...navigator.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g)]
    .map((match) => match[1]);
  ok('the fourth tab is Progress without retiring Program, Coach or Profile',
    JSON.stringify(tabNames) === JSON.stringify([
      'ProgramTab', 'CoachTab', 'ProgressTab', 'ProfileTab',
    ]));
  ok('Progress is mounted through its own screen and stable tab identity',
    /name="ProgressTab"[\s\S]{0,180}?component=\{ProgressTabScreen\}/.test(navigator)
      && /tabBarButtonTestID:\s*'tab-progress'/.test(navigator));
  ok('Progress owns the visible load continuum, main lifts and 2km sections',
    progressOwnsVisibleTracking(progress, coach));
  ok('Coach visibly keeps My Status and chat while its live Snapshot remains private',
    /<ModifiersStrip/.test(coach)
      && /testID="coach-tab-conversation"/.test(coach)
      && /const snapshot = useLiveAthleteSnapshot/.test(coach)
      && /await askCoachReadOnly\(\{[\s\S]*?\n\s*snapshot,\s*\n/.test(coach));
  ok('Progress and Coach both read the same live Snapshot adapter',
    (progress.match(/useLiveAthleteSnapshot\s*\(/g) ?? []).length === 1
      && (coach.match(/useLiveAthleteSnapshot\s*\(/g) ?? []).length === 1);
  ok('the Snapshot derives multi-week main-lift history from the existing owner',
    /buildJournalStrengthSeries/.test(snapshot)
      && /strengthHistory/.test(snapshot));
  ok('the 2km card receives the athlete\'s recorded answer, never an invented series',
    /twoKmTimeTrial/.test(snapshot)
      && /snapshot\.twoKmTimeTrial/.test(progress)
      && !/twoKmTimeTrialHistory|fake|sampleData|mockData/.test(progress));

  const brokenCoach = coach.replace(
    'const snapshot = useLiveAthleteSnapshot',
    'const hiddenSnapshot = useLiveAthleteSnapshot',
  );
  ok('removing Coach\'s shared Snapshot ownership kills the guard',
    /const snapshot = useLiveAthleteSnapshot/.test(coach)
      && !/const snapshot = useLiveAthleteSnapshot/.test(brokenCoach));
  const brokenProgress = progress.replace('testID="progress-load-continuum"', '');
  ok('removing the Progress load owner kills the surface guard',
    progressOwnsVisibleTracking(progress, coach)
      && !progressOwnsVisibleTracking(brokenProgress, coach));
}

console.log(`\nProgress tab totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this source/ownership gate does not mount pixels or create 2km history that storage does not hold.');
if (failures.length) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail === 0 ? 0 : 1);
