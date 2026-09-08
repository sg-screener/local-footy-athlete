/** Progress owns visible tracking; Coach keeps the same facts privately. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildProgressChartPoints,
  progressLiftChartModel,
  progressChartDateRangeLabel,
} from '../rules/progressChartTimeline';
import {
  bestOneRepMaxBasis,
  estimateExternalOneRepMaxKg,
  estimateLastSetOneRepMaxKg,
  RIR_ESTIMATE_METHOD,
  estimateOneRepMaxKg,
} from '../rules/estimatedOneRepMax';
import { buildProgressLoadHistory, progressLoadWeekBaseline } from '../rules/progressLoadHistory';
import { buildJournalLoadModel } from '../rules/journalLoad';
import { buildProgressMainLiftHistories } from '../rules/progressMainLiftStrength';
import {
  comparePerformanceTestResults,
  deriveMasFromPerformanceTesting,
  formatPerformanceTestResult,
  parsePerformanceTestResult,
  recordPerformanceTestResult,
  validatePerformanceTestResult,
} from '../data/performanceTests';

import { progressDateRange, filterProgressPeriod, progressHistoryInRange, progressAvailableDateRange, progressLoadComparison } from '../rules/progressPeriod';

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
    /name="ProgressTab"[\s\S]{0,180}?component=\{ProgressNavigator\}/.test(navigator)
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
    /periodHistory\.mainLiftEstimates\.map/.test(progress)
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
    /helps you build fitness without overdoing it or undertraining/.test(loadCopy)
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
    /mainLifts:\s*'Main lifts \(Estimated 1 rep max\)'/.test(progressCopy)
      && !/predictedOneRepMax:/.test(progressCopy)
      && !/estimateLabel/.test(progress));
  const liftStart = progress.indexOf('function StrengthChart');
  const liftEnd = progress.indexOf('function categoryLabel', liftStart);
  const liftCard = liftStart >= 0 && liftEnd > liftStart ? progress.slice(liftStart, liftEnd) : '';
  ok('each recorded series shows its weight below the lift name without a repeated estimate caption',
    liftCard.length > 100
      && /history\.series\.map\(\(series\)/.test(liftCard)
      && /testID=\{`progress-lift-value-\$\{history\.id\}`\}/.test(liftCard)
      && /history\.valuePrefix/.test(liftCard) && /model\.latest} kg/.test(liftCard)
      && !/>\{series\.label\}|\{formatted\}/.test(liftCard));
  ok('each lift card shows one current lift and opens one shared two-option selector',
    mainLiftCardsUseOneTapToChangeSelector(progress));
  ok('the Pull-Up title uses the short approved name',
    /pull_up:\s*'Pull-Up'/.test(progressCopy)
      && /progressLiftLabel\(history\.id\)/.test(progress));
  ok('empty main-lift cards invite recording the selected lift and never show a lime dash',
    !/estimate === undefined[\s\S]{0,60}['"]—['"]/.test(progress)
      && /progress-lift-empty-/.test(progress) && /to track your progress/.test(progress));
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

{
  const four = progressDateRange('4w', '2026-08-16');
  const availableDates = ['invalid', '2026-07-13', '2026-07-20', '2026-08-10', '2026-08-17'];
  ok('top dates begin at available history instead of months before the first record',
    progressAvailableDateRange(progressDateRange('12w', '2026-08-16'), availableDates)?.startDateISO === '2026-07-13'
      && progressAvailableDateRange(progressDateRange('year', '2026-08-16'), availableDates)?.startDateISO === '2026-07-13'
      && progressAvailableDateRange(four, availableDates)?.startDateISO === '2026-07-20'
      && progressAvailableDateRange(four, availableDates)?.endDateISO === '2026-08-16');
  ok('absent history has no invented date span and a first-day record is retained',
    progressAvailableDateRange(four, ['invalid', '2026-08-17']) === null
      && progressAvailableDateRange(four, ['2026-08-16'])?.startDateISO === '2026-08-16');
  const twelve = progressDateRange('12w', '2026-08-16');
  const year = progressDateRange('year', '2026-08-16');
  ok('4 and 12 weeks include the current calendar week through the explicit end date',
    four.startDateISO === '2026-07-20' && twelve.startDateISO === '2026-05-25'
      && four.endDateISO === '2026-08-16' && twelve.endDateISO === four.endDateISO);
  ok('Year is a trailing calendar year and handles leap day',
    year.startDateISO === '2025-08-17'
      && progressDateRange('year', '2024-02-29').startDateISO === '2023-03-01');
  const dates = ['2025-08-16', '2025-09-01', '2026-06-01', '2026-07-13', '2026-07-20', '2026-08-10', '2026-08-17', 'invalid', '2026-07-32'];
  const original = JSON.stringify(dates);
  ok('4/12/Year admit different real calendar slices and refuse future or malformed dates',
    JSON.stringify(filterProgressPeriod(dates, four, date => date)) === JSON.stringify(['2026-07-20', '2026-08-10'])
      && filterProgressPeriod(dates, twelve, date => date).length === 4
      && filterProgressPeriod(dates, year, date => date).length === 5
      && JSON.stringify(dates) === original);
  ok('empty ranges stay empty without invented zero records',
    filterProgressPeriod(['2025-08-16'], four, date => date).length === 0);
  const weekly = ['2025-09-01', '2026-06-01', '2026-07-13', '2026-07-20', '2026-08-10']
    .map((weekStart, index) => ({ weekStart, value: 100 + index }));
  const load = { headline: { ratio: 1.1, band: 'in' as const }, sweetSpotBand: { low: 0.8, high: 1.3 },
    coverage: null, isDeloadWeek: false, weeklyCompletedLoadAU: weekly };
  const points = weekly.map(point => ({ weekStart: point.weekStart, predictedOneRepMaxKg: point.value }));
  const histories = [{ id: 'bench_press' as const, exerciseName: 'Bench Press', valuePrefix: '' as const,
    points, series: [{ key: 'current', label: 'Last-set estimate', method: 'nuzzo_last_set_rir_v1', points }] }];
  const before = JSON.stringify({load, histories});
  const views = [four, twelve, year].map(range => progressHistoryInRange(load, histories, range));
  ok('one period filters both load and each lift series including history older than twelve weeks',
    views.every((view, index) => view.load.weeklyCompletedLoadAU.length === [2, 4, 5][index]
      && view.mainLiftEstimates[0].points.length === [2, 4, 5][index]
      && view.mainLiftEstimates[0].series[0].points.length === [2, 4, 5][index]));
  ok('period switching leaves the sweet-spot status, deload and complete source histories intact',
    views.every(view => view.load.headline === load.headline && view.load.sweetSpotBand === load.sweetSpotBand
      && view.load.isDeloadWeek === load.isDeloadWeek)
      && JSON.stringify({load, histories}) === before);
  const empty = progressHistoryInRange(load, histories, progressDateRange('4w', '2027-08-16'));
  ok('a period without results keeps the lift identity but no old value or phantom series',
    empty.mainLiftEstimates.length === 1 && empty.mainLiftEstimates[0].id === 'bench_press'
      && empty.mainLiftEstimates[0].points.length === 0 && empty.mainLiftEstimates[0].series.length === 0
      && empty.load.weeklyCompletedLoadAU.length === 0);
  const geometry = { width: 300, height: 88, padding: 10 };
  const sparse = [{dateISO:'2026-07-20', value:10}, {dateISO:'2026-08-10', value:20}];
  const fourPoints = buildProgressChartPoints(sparse, geometry, true, four);
  const yearPoints = buildProgressChartPoints(sparse, geometry, true, year);
  ok('sparse records fill the chart width in every period without inventing data',
    fourPoints[0].x === 10 && fourPoints[1].x === 290
      && yearPoints[0].x === 10 && yearPoints[1].x === 290
      && yearPoints.length === sparse.length);
  const growing = buildProgressChartPoints([...sparse, {dateISO:'2026-08-16', value:22}], geometry, true, year);
  ok('as more records arrive the available chart width is shared by their elapsed dates',
    growing[0].x === 10 && growing[2].x === 290
      && Math.abs(growing[1].x - (10 + 21 / 27 * 280)) < 0.001);
  const screen = read('src/screens/progress/ProgressTabScreen.tsx');
  const styleStart = screen.indexOf('const styles = StyleSheet.create(');
  const periodStyleStart = screen.indexOf('  periodRow:', styleStart);
  const periodStyleEnd = screen.indexOf('  heading:', periodStyleStart);
  const periodStyles = styleStart >= 0 && periodStyleStart > styleStart && periodStyleEnd > periodStyleStart
    ? screen.slice(periodStyleStart, periodStyleEnd) : '';
  ok('period controls and dates share one fixed row without wrapping or changing allocation',
    periodStyles.length > 100
      && /periodRow: \{ flexDirection: 'row', alignItems: 'center'/.test(periodStyles)
      && /periodToggle: \{ flex: 1, minWidth: 0/.test(periodStyles)
      && /periodDates: \{ width: 112, fontSize: 13, lineHeight: 18/.test(periodStyles)
      && !/flexWrap/.test(periodStyles)
      && /numberOfLines=\{1\} style=\{styles.periodDates\}/.test(screen));
  ok('selected period uses the Program switch yellow fill and text with larger labels',
    /periodSelected: \{ backgroundColor: 'rgba\(216,216,0,0.14\)'/.test(periodStyles)
      && /periodActiveText: \{ color: colors.accent.lime/.test(periodStyles)
      && /periodOptionText: \{ color: '#8A8F98', fontSize: 13/.test(periodStyles)
      && /styles.periodOptionText, period === option.id && styles.periodActiveText/.test(screen));
  ok('the training load card stacks full-width status and weekly graph',
    /<View style=\{styles.loadSummary\}>/.test(screen)
      && /loadSections: \{ flexDirection: 'column', alignItems: 'stretch'/.test(screen)
      && /loadSummary: \{ width: '100%'/.test(screen)
      && /loadChart: \{\s*width: '100%',\s*borderTopColor:/.test(screen)
      && /<LfaWordmark \/>/.test(screen));
  ok('top dates use available history and weekly graph omits a competing date caption',
    /progressAvailableDateRange\(range,/.test(screen)
      && /periodHistory.load.weeklyCompletedLoadAU.map/.test(screen)
      && /periodHistory.mainLiftEstimates.flatMap/.test(screen)
      && /periodTesting\?\.results.map/.test(screen)
      && /compact showDates=\{false\}/.test(screen));
  ok('chart captions name the plotted history and occupy one stable line',
    /const rangeLabel = progressChartDateRangeLabel\(points\);/.test(screen)
      && /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0.75\} style=\{styles.chartRange\}/.test(screen));
  const loadStart = screen.indexOf('function LoadContinuum(');
  const loadEnd = screen.indexOf('function LoadHistoryChart(', loadStart);
  const loadView = loadStart >= 0 && loadEnd > loadStart ? screen.slice(loadStart, loadEnd) : '';
  const loadPage = read('src/screens/progress/LoadHistoryScreen.tsx');
  const loadNavigation = read('src/navigation/ProgressNavigator.tsx');
  ok('load history opens a routed page with period controls, week selection and recorded-session navigation',
    loadView.length > 100 && /onPress=\{onViewHistory\}/.test(loadView)
      && /navigation.navigate\('LoadHistory', \{ period \}\)/.test(screen)
      && /name="LoadHistory" component=\{LoadHistoryScreen\}/.test(loadNavigation)
      && /name="RecordedLoadSession" component=\{RecordedLoadSessionScreen\}/.test(loadNavigation)
      && /PROGRESS_PERIODS.map/.test(loadPage) && /onSelect=\{setSelectedDate\}/.test(loadPage)
      && /navigation.navigate\('RecordedLoadSession', \{ date: session.date \}\)/.test(loadPage)
      && !/historyVisible|progress-load-history-sheet/.test(loadView));
  ok('all period buttons set selection and expose their selected state',
    /PROGRESS_PERIODS\.map\(\(option\)/.test(screen)
      && /setPeriod\(option\.id\)/.test(screen)
      && /accessibilityState=\{\{ selected: period === option\.id \}\}/.test(screen)
      && /testID=\{`progress-period-\$\{option\.id\}`\}/.test(screen));
  ok('one period range reaches load, lifts, performance display and chart geometry',
    /progressHistoryInRange\(snapshot\.load, snapshot\.mainLiftEstimates, range\)/.test(screen)
      && /<LoadContinuum load=\{periodHistory\.load\} range=\{range\}/.test(screen)
      && /periodHistory\.mainLiftEstimates\.map/.test(screen)
      && /testing=\{periodTesting\}/.test(screen)
      && /higherIsBetter, range/.test(screen)
      && /recordPerformanceTestResult\(performanceTesting,/.test(screen)
      && !/recordPerformanceTestResult\(periodTesting,/.test(screen));
}

{
  const screen = read('src/screens/progress/ProgressTabScreen.tsx');
  const headingStart = screen.indexOf('<View style={styles.mainLiftHeadingRow}>');
  const gridStart = screen.indexOf('<View style={styles.liftGrid}>', headingStart);
  const heading = headingStart >= 0 && gridStart > headingStart ? screen.slice(headingStart, gridStart) : '';
  ok('Main lifts has an accessible calculation button beside its heading',
    heading.length > 100 && /testID="progress-main-lifts"/.test(heading)
      && /testID="progress-lift-calculation-info"/.test(heading)
      && /accessibilityRole="button"/.test(heading)
      && /onPress=\{\(\) => setLiftCalculationVisible\(true\)\}/.test(heading));
  ok('calculation explanation opens and closes through the shared popup',
    /visible=\{liftCalculationVisible\}/.test(screen)
      && /onClose=\{\(\) => setLiftCalculationVisible\(false\)\}/.test(screen)
      && /testID="progress-lift-calculation-sheet"/.test(screen)
      && /onPress=\{\(\) => setLiftCalculationVisible\(false\)\}/.test(screen)
      && /PROGRESS_LIFT_CALCULATION_COPY.example/.test(screen)
      && /PROGRESS_LIFT_CALCULATION_COPY.weekly/.test(screen));
  const example = { method: RIR_ESTIMATE_METHOD, liftId: 'bench_press' as const,
    exerciseId: 'bench', workoutExerciseId: 'bench-row', setId: 'last', setNumber: 3,
    source: 'logged_set' as const, actualWeightKg: 80, actualReps: 6, rir: 2 as const, skipped: false };
  ok('the popup example matches the actual estimator: six reps plus two left uses eight-rep capacity',
    Math.round(estimateLastSetOneRepMaxKg(example)!) === 98
      && estimateLastSetOneRepMaxKg(example) === estimateLastSetOneRepMaxKg({ ...example, actualReps: 8, rir: 0 }));
}

{
  const week = (weekStart: string, value: number) => ({ weekStart, value });
  const history = [week('2025-10-06', 1000), week('2026-06-01', 500),
    week('2026-07-13', 100), week('2026-07-20', 100), week('2026-07-27', 100), week('2026-08-03', 100),
    week('2026-08-10', 125), week('2026-08-17', 999)];
  const current = history[6];
  const four = progressLoadComparison(history, current, '4w');
  ok('load percentage compares the latest weekly value to the previous weeks average, excluding current/future',
    four?.percentChange === 25 && four.direction === 'up' && four.baselineWeeks === 4
      && four.label === 'vs. previous 4 weeks');
  const dense = Array.from({ length: 52 }, (_, index) => week(
    new Date(Date.parse('2026-08-10T00:00:00Z') - (index + 1) * 7 * 86400000).toISOString().slice(0, 10),
    index < 4 ? 100 : index < 12 ? 200 : 400,
  ));
  ok('12 weeks and Year use their full selected baseline and label',
    progressLoadComparison(dense, current, '12w')?.percentChange === -25
      && progressLoadComparison(dense, current, '12w')?.label === 'vs. previous 12 weeks'
      && progressLoadComparison(dense, current, 'year')?.percentChange === -64
      && progressLoadComparison(dense, current, 'year')?.label === 'vs. previous year');
  ok('short or gapped history never substitutes a four-week comparison for a longer selection',
    progressLoadComparison(history, current, '12w') === null
      && progressLoadComparison(history, current, 'year') === null
      && progressLoadComparison(dense.slice(1), current, 'year') === null
      && progressLoadComparison([...dense.slice(1), dense[1]], current, 'year') === null);
  ok('missing history and zero baselines never fabricate a percentage',
    progressLoadComparison([], undefined, '4w') === null
      && progressLoadComparison([current], current, '4w') === null
      && progressLoadComparison(dense.map(point => ({ ...point, value: 0 })), current, '4w') === null);
  ok('decreases and unchanged loads have honest direction, including a drop to zero',
    progressLoadComparison(dense, week('2026-08-10', 75), '4w')?.direction === 'down'
      && progressLoadComparison(dense, week('2026-08-10', 100), '4w')?.direction === 'flat'
      && progressLoadComparison(dense, week('2026-08-10', 0), '4w')?.percentChange === -100);
  const screen = read('src/screens/progress/ProgressTabScreen.tsx');
  ok('load hero drops the session-count line and mounts the computed comparison',
    !/coachLoadEvidence|styles.loadEvidence/.test(screen)
      && /comparison=\{loadComparison\}/.test(screen)
      && /progressLoadComparison\(snapshot.load.weeklyCompletedLoadAU,/.test(screen)
      && /testID="progress-load-comparison"/.test(screen));
}

{
  const range = { startDateISO: '2026-07-20', endDateISO: '2026-08-16' };
  const model = progressLiftChartModel([
    { dateISO: '2026-07-13', value: 5 }, { dateISO: '2026-07-20', value: 30 },
    { dateISO: '2026-08-10', value: 34 }, { dateISO: '2026-08-17', value: 100 },
  ], { width: 150, height: 78, padding: 6 }, range)!;
  ok('lift change and axis use only real points inside the selected period',
    model.points.length === 2 && model.change === 4 && model.latest === 34
      && model.dates[0] === '2026-07-20' && model.dates[1] === '2026-08-10');
  ok('weight grid and chart coordinates share the same scale',
    model.points.every(point => Math.abs(point.y - (6 + (model.ticks[0].value - point.value)
      / (model.ticks[0].value - model.ticks[2].value) * 66)) < 0.001));
  const single = progressLiftChartModel([{ dateISO: '2026-08-10', value: 34 }], { width: 150, height: 78, padding: 6 }, range)!;
  ok('one lift estimate has no invented improvement and empty histories have no model',
    single.change === null && single.points.every(point => Number.isFinite(point.y))
      && progressLiftChartModel([], { width: 150, height: 78, padding: 6 }, range) === null);
}
{
  const records = [
    ...['2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03'].map(date => ({ date, strength: [], conditioning: null, difficulty: 5, actualMinutes: 20 })),
    { date: '2026-08-10', strength: [], conditioning: { sessionName: 'Run', totalTimeMinutes: 30, rpe: 4 }, difficulty: 6, actualMinutes: 20,
      teamTraining: { durationMinutes: 60, effort: 5 }, game: { playedWholeGame: true, timeOnGroundMinutes: 80, bodyRpe: 7, feel: 5 as const } },
    { date: '2026-08-11', strength: [], conditioning: { sessionName: 'Unrated run', totalTimeMinutes: 15 } },
    { date: '2026-08-17', strength: [], conditioning: null, difficulty: 10, actualMinutes: 100 },
  ];
  const before = JSON.stringify(records);
  const weeks = buildProgressLoadHistory(records, '2026-08-16');
  const latest = weeks.at(-1)!;
  const canonical = buildJournalLoadModel({ weekStart: '2026-08-10', sessions: records, sessionsPlannedThisWeek: 2, plannedStrength: [] });
  ok('load history matches canonical weekly AU and counts every combined component once',
    latest.value === 1100 && latest.value === canonical.thisWeek.completedLoadAU
      && latest.sessions[0].parts.length === 4 && latest.sessions[0].parts.reduce((total, part) => total + (part.value ?? 0), 0) === 1100
      && JSON.stringify(records) === before);
  ok('load history excludes future and invalid dates and keeps missing ratings unknown',
    weeks.length === 5 && latest.sessions.length === 2 && !latest.sessions[1].measured
      && latest.sessions[1].parts[0].value === null
      && buildProgressLoadHistory([{ ...records[0], date: '2026-02-31' }], '2026-08-16').length === 0);
  ok('selected-week normal excludes that week and uses the same complete four-week comparison',
    progressLoadWeekBaseline(weeks, latest)?.average === 100
      && progressLoadWeekBaseline(weeks, latest)?.percentChange === 1000
      && progressLoadWeekBaseline(weeks, weeks[2]) === null);
  ok('empty load history does not invent sessions or a baseline',
    buildProgressLoadHistory([], '2026-08-16').length === 0 && progressLoadWeekBaseline([], undefined) === null);
}
console.log(`\nProgress tab totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this source/ownership gate does not mount pixels or prove a production persistence round trip.');
if (failures.length) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail === 0 ? 0 : 1);

