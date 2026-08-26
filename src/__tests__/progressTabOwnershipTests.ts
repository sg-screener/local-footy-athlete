/** Progress owns visible tracking; Coach keeps the same facts privately. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildProgressChartPoints,
  progressChartDateRangeLabel,
} from '../rules/progressChartTimeline';

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
  const myStatus = read('src/screens/home/MyStatusScreen.tsx');
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
  ok('Coach visibly keeps chat only while its live Snapshot remains private',
    !/<ModifiersStrip/.test(coach)
      && !/<CoachStatusScreen/.test(coach)
      && /testID="coach-tab-conversation"/.test(coach)
      && /const snapshot = useLiveAthleteSnapshot/.test(coach)
      && /await askCoachReadOnly\(\{[\s\S]*?\n\s*snapshot,\s*\n/.test(coach));
  ok('My Status is a Program-owned page rather than part of Coach',
    /name="MyStatus"\s+component=\{MyStatusScreen\}/.test(navigator)
      && /<CoachStatusScreen/.test(myStatus));
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
  ok('lift charts keep each recorded week and position it through the time-axis owner',
    /buildProgressChartPoints/.test(progress)
      && /dateISO:\s*point\.weekStart/.test(progress)
      && !/function LineChart\(\{ values/.test(progress));

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

console.log('\n[TIMELINE] REAL DATES OWN HORIZONTAL SPACE');
{
  const points = buildProgressChartPoints([
    { dateISO: '2026-05-04', value: 90 },
    { dateISO: '2026-05-11', value: 95 },
    { dateISO: '2026-08-24', value: 105 },
  ], { width: 300, height: 88, padding: 10 });
  ok('a one-week step followed by a fifteen-week gap is spaced by those dates',
    points.length === 3
      && points[1].x - points[0].x < (points[2].x - points[1].x) / 10);
  ok('the date range makes even a two-point long gap visible in words',
    progressChartDateRangeLabel([
      { dateISO: '2026-05-04' },
      { dateISO: '2026-08-24' },
    ]) === '4 May – 24 Aug');
  const unordered = buildProgressChartPoints([
    { dateISO: '2026-08-24', value: 105 },
    { dateISO: '2026-05-04', value: 90 },
  ], { width: 300, height: 88, padding: 10 });
  ok('stored input order cannot reverse time on the chart',
    unordered.map((point) => point.dateISO).join(',') === '2026-05-04,2026-08-24');
}

console.log(`\nProgress tab totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this source/ownership gate does not mount pixels or create 2km history that storage does not hold.');
if (failures.length) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail === 0 ? 0 : 1);
