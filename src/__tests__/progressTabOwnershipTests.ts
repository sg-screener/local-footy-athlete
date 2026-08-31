/** Progress owns visible tracking; Coach keeps the same facts privately. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildProgressChartPoints,
  progressChartDateRangeLabel,
} from '../rules/progressChartTimeline';
import {
  bestOneRepMaxBasis,
  estimateExternalOneRepMaxKg,
  estimateOneRepMaxKg,
} from '../rules/estimatedOneRepMax';
import { buildProgressMainLiftHistories } from '../rules/progressMainLiftStrength';
import {
  comparePerformanceTestResults,
  deriveMasFromPerformanceTesting,
  formatPerformanceTestResult,
  parsePerformanceTestResult,
  recordPerformanceTestResult,
  validatePerformanceTestResult,
} from '../data/performanceTests';

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
    && /testID="progress-performance-tests"/.test(progress)
    && /testID="progress-measurements"/.test(progress)
    && !/CoachDashboard|SnapshotDashboard|coach-dashboard/.test(coach);
}

function mainLiftCardsUseOneTapToChangeSelector(progress: string): boolean {
  const cardStart = progress.indexOf('function StrengthChart');
  const cardEnd = progress.indexOf('function categoryLabel', cardStart);
  const card = cardStart >= 0 && cardEnd > cardStart
    ? progress.slice(cardStart, cardEnd)
    : '';
  const sheetTestId = progress.indexOf('testID="progress-lift-choice-sheet"');
  const sheetStart = sheetTestId >= 0 ? progress.lastIndexOf('<Sheet', sheetTestId) : -1;
  const sheetEnd = sheetStart >= 0 ? progress.indexOf('</Sheet>', sheetTestId) : -1;
  const sheet = sheetStart >= 0 && sheetEnd > sheetStart
    ? progress.slice(sheetStart, sheetEnd)
    : '';
  return card.length > 0
    && /onChangeRequested:\s*\(\) => void/.test(card)
    && /accessibilityLabel=\{`Change tracked lift from \$\{progressLiftLabel\(history\.id\)\}`\}/.test(card)
    && /onPress=\{onChangeRequested\}/.test(card)
    && !/TRACKED_LIFT_PAIRS|liftChoices|progress-choose-/.test(card)
    && sheetStart >= 0
    && /visible=\{activeLiftSlot !== null\}/.test(sheet)
    && /TRACKED_LIFT_PAIRS\[activeLiftSlot\]\.map/.test(sheet)
    && /setTrackedLiftChoice\(activeLiftSlot, lift\)/.test(sheet);
}

function performanceComparisonUsesPlainCopy(progress: string, copy: string): boolean {
  const rowStart = progress.indexOf('function PerformanceTestRow');
  const rowEnd = progress.indexOf('export default function ProgressTabScreen', rowStart);
  const row = rowStart >= 0 && rowEnd > rowStart
    ? progress.slice(rowStart, rowEnd)
    : '';
  return row.length > 0
    && /better:\s*'better'/.test(copy)
    && /worse:\s*'worse'/.test(copy)
    && /PROGRESS_TAB_COPY\.better\s*:\s*PROGRESS_TAB_COPY\.worse/.test(row)
    && !/<Svg\b/.test(row);
}

console.log('\n[PROGRESS] ONE LIVE SNAPSHOT, TWO HONEST SURFACES');
{
  const navigator = read('src/navigation/AppNavigator.tsx');
  const coach = read('src/screens/coach/CoachTabScreen.tsx');
  const myStatus = read('src/screens/home/MyStatusScreen.tsx');
  const progress = read('src/screens/progress/ProgressTabScreen.tsx');
  const snapshot = read('src/rules/liveAthleteSnapshot.ts');
  const snapshotAdapter = read('src/screens/coach/useLiveAthleteSnapshot.ts');
  const loadCopy = read('src/rules/snapshotDashboardCopy.ts');
  const progressCopy = read('src/rules/progressTabCopy.ts');

  const tabNames = [...navigator.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g)]
    .map((match) => match[1]);
  ok('the fourth tab is Progress without retiring Program, Coach or Profile',
    JSON.stringify(tabNames) === JSON.stringify([
      'ProgramTab', 'CoachTab', 'ProgressTab', 'ProfileTab',
    ]));
  ok('Progress is mounted through its own screen and stable tab identity',
    /name="ProgressTab"[\s\S]{0,180}?component=\{ProgressTabScreen\}/.test(navigator)
      && /tabBarButtonTestID:\s*'tab-progress'/.test(navigator));
  ok('Progress owns load, main lifts, compact performance tests and measurements',
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
  ok('decorative lime title marks are absent from every Progress heading',
    !/headingMark/.test(progress));
  ok('Progress renders the fixed predicted-1RM histories even when every graph is empty',
    /snapshot\.mainLiftEstimates\.map/.test(progress)
      && !/snapshot\.strengthHistory\.length\s*>\s*0/.test(progress));
  ok('Load names the sweet spot and potential over/under-training states exactly',
    /loadIn:\s*'In the sweet spot'/.test(loadCopy)
      && /loadBelow:\s*'Potentially undertraining'/.test(loadCopy)
      && /loadAbove:\s*'Potentially overtraining'/.test(loadCopy)
      && /loadDeload:\s*'Deload week'/.test(loadCopy));
  ok('a low-load deload is explained as intentional rather than undertraining',
    /coachLoadSummary\([\s\S]*?isDeloadWeek[\s\S]*?case 'below':[\s\S]*?loadDeload/.test(loadCopy)
      && /Lower load is expected during a deload week/.test(loadCopy)
      && /coachLoadGuidance\(load\.headline\?\.band \?\? null, load\.isDeloadWeek\)/.test(progress));
  ok('the Load hero explains why the range matters in plain language',
    /helps you build fitness without training too hard or undertraining/.test(loadCopy)
      && /coachLoadGuidance/.test(progress));
  ok('the existing completed-load owner reaches a multi-week AU chart',
    /weeklyCompletedLoadAU/.test(snapshot)
      && /model\.history/.test(snapshot)
      && /function LoadHistoryChart/.test(progress)
      && /Weekly load \(AU\)/.test(progress)
      && /load\.weeklyCompletedLoadAU/.test(progress));
  ok('the AU chart refuses a lone point and says it builds as the athlete trains',
    /points\.length < 2/.test(progress)
      && /loadHistoryBuilding:\s*'Your load graph builds as you train\.'/ .test(loadCopy));
  ok('the snapshot adapter reads the stored week dose and passes one deload answer',
    /currentProgram/.test(snapshotAdapter)
      && /weekKind === 'deload'/.test(snapshotAdapter)
      && /deloadDoor !== undefined/.test(snapshotAdapter)
      && /isDeloadWeek/.test(snapshotAdapter));
  ok('Main lifts owns the estimated-1RM context once instead of repeating it inside every card',
    /mainLifts:\s*'Main lifts \(Estimated 1RM\)'/.test(progressCopy)
      && !/predictedOneRepMax:/.test(progressCopy)
      && !/estimateLabel/.test(progress));
  ok('each lift card shows one current lift and opens one shared two-option selector',
    mainLiftCardsUseOneTapToChangeSelector(progress));
  ok('the Pull-Up option says explicitly that its estimate is added weight',
    /pull_up:\s*'Pull-Up \(added weight\)'/.test(progressCopy)
      && /progressLiftLabel\(history\.id\)/.test(progress));
  ok('empty main-lift cards rely on No data yet and never show a lime dash',
    !/estimate === undefined[\s\S]{0,60}['"]—['"]/.test(progress)
      && /estimate !== undefined[\s\S]{0,120}<Text[^>]+styles\.chartValue/.test(progress));
  ok('the old oversized 2km chart is retired rather than kept beside the new tests',
    !/function TwoKmChart|testID="progress-two-km"|snapshot\.twoKmTimeTrial/.test(progress));
  ok('the three compact test categories sit below Main Lifts and above Measurements',
    progress.indexOf('testID="progress-main-lifts"') >= 0
      && progress.indexOf('testID="progress-main-lifts"') < progress.indexOf('testID="progress-performance-tests"')
      && progress.indexOf('testID="progress-performance-tests"') < progress.indexOf('testID="progress-measurements"'));
  const performanceCopy = progressCopy + read('src/data/performanceTests.ts');
  ok('the six ruled test choices include the exact electronically timed sprint label',
    ['2km TT', '3km TT', '400m run', '1 min max cal air bike', '100m sprint', '20m sprint (electronically timed)']
      .every((label) => performanceCopy.includes(`'${label}'`)));
  ok('performance results and measurements save through the accepted profile transaction',
    /commitProfileProgramTransaction/.test(progress)
      && /performanceTesting/.test(progress)
      && /heightCm/.test(progress)
      && /weightKg/.test(progress));
  ok('m:ss tests expose punctuation input and a truthful per-test example',
    /numbers-and-punctuation/.test(progress)
      && /inputPlaceholder: '12:00'/.test(performanceCopy)
      && /inputPlaceholder: '1:15'/.test(performanceCopy));
  ok('VoiceOver hears the current test result, trend and both measurement values',
    /accessibilityLabel=\{`\$\{categoryLabel\(category\)\} test,[\s\S]*?\$\{resultText\}/.test(progress)
      && /Height in centimetres, \$\{heightInput/.test(progress)
      && /Weight in kilograms, \$\{weightInput/.test(progress));
  ok('performance change uses only green better or red worse copy with no direction icon',
    performanceComparisonUsesPlainCopy(progress, progressCopy));
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

console.log('\n[PREDICTED 1RM] ONE LOW-REP ESTIMATE ACROSS EVERY PRESCRIPTION');
{
  ok('a true one-rep set stays the exact load lifted',
    estimateOneRepMaxKg(120, 1) === 120);
  ok('equivalent 3, 5 and 8-rep loads resolve to the same predicted maximum',
    [3, 5, 8].every((reps) => {
      const workingLoad = 120 * (37 - reps) / 36;
      return Math.abs((estimateOneRepMaxKg(workingLoad, reps) ?? 0) - 120) < 0.0001;
    }));
  ok('sets above ten reps are excluded instead of wearing false precision',
    estimateOneRepMaxKg(80, 11) === null);

  const best = bestOneRepMaxBasis([
    { externalLoadKg: 110, reps: 3 },
    { externalLoadKg: 100, reps: 8 },
  ]);
  ok('the best set is selected by predicted strength rather than raw bar weight',
    best?.externalLoadKg === 100 && best.reps === 8);

  ok('pull-up strength uses bodyweight plus added load, then reports added-load 1RM',
    Math.abs((estimateExternalOneRepMaxKg({
      externalLoadKg: 10,
      reps: 5,
      bodyWeightKg: 80,
    }) ?? 0) - 21.25) < 0.0001);

  const histories = buildProgressMainLiftHistories({
    weekStart: '2026-08-24',
    bodyWeightKg: 80,
    sessions: [{
      date: '2026-08-18',
      strength: [{
        exerciseId: 'bench', workoutExerciseId: 'bench-row', exerciseName: 'Bench Press',
        prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 5,
        weightKg: 96, completion: 'full',
      }, {
        exerciseId: 'pull', workoutExerciseId: 'pull-row', exerciseName: 'Pull-Ups',
        prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 5,
        weightKg: 10, completion: 'full',
      }],
    }],
  });
  ok('all four ruled lift graphs exist in order even when two have no data',
    histories.map((history) => history.exerciseName).join(',') ===
      'Pull-Up,Bench Press,RDL,Back Squat'
      && histories.length === 4
      && histories[2].points.length === 0
      && histories[3].points.length === 0);
  ok('legacy prescribed estimates remain identifiable in their separate legacy series',
    histories[1]?.points[0]?.predictedOneRepMaxKg === 108 && histories[1].series[0].method === 'legacy_brzycki');
  ok('the Pull-Up graph is added load and never backfills missing historical bodyweight',
    histories[0]?.valuePrefix === '+'
      && histories[0]?.points.length === 0);
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

console.log('\n[PERFORMANCE TESTS] ONE HISTORY, HONEST DIRECTION');
{
  const faster = comparePerformanceTestResults('two_km_tt', 420, 400);
  ok('a faster timed result is a green downward improvement',
    faster?.direction === 'down' && faster.status === 'improved'
      && Math.abs(faster.percent - (20 / 420 * 100)) < 0.0001);
  const slower = comparePerformanceTestResults('one_hundred_m_sprint', 12.2, 12.8);
  ok('a slower timed result is a red upward regression',
    slower?.direction === 'up' && slower.status === 'worse');
  const moreCalories = comparePerformanceTestResults('one_min_air_bike', 24, 27);
  const fewerCalories = comparePerformanceTestResults('one_min_air_bike', 24, 21);
  ok('air-bike calories reverse both the success rule and trend direction',
    moreCalories?.direction === 'up' && moreCalories.status === 'improved'
      && fewerCalories?.direction === 'down' && fewerCalories.status === 'worse');
  ok('clock, sprint and calorie inputs parse without pretending they share a unit',
    parsePerformanceTestResult('two_km_tt', '7:15') === 435
      && parsePerformanceTestResult('twenty_m_electronic_sprint', '3.42') === 3.42
      && parsePerformanceTestResult('one_min_air_bike', '28') === 28
      && formatPerformanceTestResult('one_min_air_bike', 28) === '28 cal');
  ok('the new 2km producer keeps the existing authored 5:00–15:00 refusal',
    validatePerformanceTestResult('two_km_tt', 240) !== null
      && validatePerformanceTestResult('two_km_tt', 435) === null);
  const history = recordPerformanceTestResult(undefined, {
    testId: 'three_km_tt', value: 720, recordedAt: '2026-08-31T01:00:00.000Z',
  });
  ok('the first result becomes a persisted category selection and an honest baseline',
    history.selections.aerobic === 'three_km_tt'
      && history.results.length === 1
      && comparePerformanceTestResults('three_km_tt', undefined, 720) === null);
  const threeKmMas = deriveMasFromPerformanceTesting(history, {
    seconds: 600, recordedOn: '2026-08-01', source: 'profile_edit',
  }, 'Complete beginner');
  ok('a selected 3km result becomes the measured pace authority over the legacy 2km answer',
    threeKmMas.source === 'measured' && threeKmMas.seconds === 720
      && Math.abs(threeKmMas.masKmh - 15) < 0.0001);
  const legacyMas = deriveMasFromPerformanceTesting(undefined, {
    seconds: 480, recordedOn: '2026-08-01', source: 'profile_edit',
  }, 'Complete beginner');
  ok('an existing athlete keeps their legacy 2km pace until they record a new aerobic test',
    legacyMas.source === 'measured' && legacyMas.seconds === 480
      && Math.abs(legacyMas.masKmh - 15) < 0.0001);
}

console.log(`\nProgress tab totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this source/ownership gate does not mount pixels or prove a production persistence round trip.');
if (failures.length) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail === 0 ? 0 : 1);
