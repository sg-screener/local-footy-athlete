(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/**
 * THE COACH SNAPSHOT — one ephemeral picture for dashboard and conversation.
 *
 * VERIFICATION STRATEGY (L12):
 * - identity cells make a mismatched week/date refuse rather than drift;
 * - value cells prove every requested fact survives the pure boundary;
 * - ownership cells pin store reads to one adapter and both surfaces to one value;
 * - liveness cells mutate the two source shapes the ownership checks protect.
 *
 * Run: npm run test:coach-snapshot
 */

import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildCoachSnapshot,
  projectRecentChange,
  type BuildCoachSnapshotInput,
} from '../rules/liveAthleteSnapshot';
import { projectCoachSnapshotForModel } from '../rules/coachModelContext';
import { coachResponseGroundingFacts } from '../rules/coachResponseContract';
import { weekdayName } from '../utils/appDate';
import type { VisibleWeek } from '../rules/visibleProjection';
import type { JournalWeek } from '../rules/journalWeek';
import type { JournalLoadModel } from '../rules/journalLoad';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import {
  coachLoadGuidance,
  coachLoadMarkerFraction,
  coachLoadSummary,
} from '../rules/snapshotDashboardCopy';

armTotalsOrRed();

const ROOT = resolve(__dirname, '../..');
let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function source(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8');
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

const WEEK_START = '2026-08-24';
const visibleWeek = {
  weekStart: WEEK_START,
  days: [],
  explanations: [],
} as unknown as VisibleWeek;

const journalWeek = {
  weekStart: WEEK_START,
  days: [],
  work: {
    sessionsPlanned: 4,
    completedFull: 2,
    completedPartial: 1,
    skipped: 0,
    notAnswered: 1,
    missingReasons: 0,
  },
  load: { thisWeek: 3, comparison: null, comparisonAvailable: false },
  felt: {
    feelingsRecorded: 1,
    sorenessRecorded: 1,
    gameFeelsRecorded: 0,
    gameFeelLatest: null,
    differedFromPlan: 0,
    nothingRecorded: false,
  },
  kinds: {
    strength: 2,
    conditioning: 1,
    sprint: 0,
    teamTraining: 1,
    games: 0,
    recovery: 0,
  },
  dataState: 'early',
} as JournalWeek;

const loadModel = {
  weekStart: WEEK_START,
  thisWeek: { weekStart: WEEK_START, sessionsMeasured: 3, completedLoadAU: 720 },
  history: [
    { weekStart: '2026-08-17', sessionsMeasured: 4, completedLoadAU: 680 },
    { weekStart: '2026-08-10', sessionsMeasured: 4, completedLoadAU: 640 },
  ],
  headline: { value: { ratio: 1.05, band: 'in' }, provenance: 'signed' },
  sweetSpotBand: { value: { low: 0.8, high: 1.3 }, provenance: 'signed' },
  coverage: {
    value: { sessionsMeasured: 3, sessionsPlanned: 4, liftsUnmeasured: 1 },
    provenance: 'signed',
  },
} as unknown as JournalLoadModel;

const modifier = {
  id: 'modifier-1',
  title: 'An active restriction',
} as ActiveCoachNote;

const baseInput: BuildCoachSnapshotInput = {
  asOfDateISO: '2026-08-24',
  visibleWeek,
  journalWeek,
  loadModel,
  strengthLifts: [{
    exerciseName: 'Back Squat',
    thisWeek: { weightKg: 100, reps: 5 },
    lastWeek: { weightKg: 95, reps: 5 },
    direction: 'up',
  }],
  strengthHistory: [{
    exerciseName: 'Back Squat',
    points: [
      { weekStart: '2026-08-17', topSet: { weightKg: 95, reps: 5 } },
      { weekStart: '2026-08-24', topSet: { weightKg: 100, reps: 5 } },
    ],
  }],
  twoKmTimeTrial: {
    seconds: 420,
    recordedOn: '2026-08-24',
    source: 'profile_edit',
  },
  readinessSignal: {
    date: '2026-08-24',
    energy: 'good',
    soreness: 'none',
    source: 'quick_check',
    updatedAt: '2026-08-24T08:00:00.000Z',
  },
  activeModifiers: [modifier],
};

console.log('\n[1] ONE PURE PICTURE CARRIES THE FIVE REQUESTED FACTS');
{
  const snapshot = buildCoachSnapshot(baseInput);
  ok('the exact visible week is carried, not rebuilt', snapshot.visibleWeek === visibleWeek);
  ok('this-week work is carried from the Journal owner', snapshot.thisWeek === journalWeek);
  ok('today readiness uses the existing quick-check vocabulary', snapshot.readiness.state === 'good');
  ok('the signed load headline crosses the surface door', snapshot.load.headline?.band === 'in');
  ok('the signed sweet-spot edges cross the same surface door',
    snapshot.load.sweetSpotBand?.low === 0.8
      && snapshot.load.sweetSpotBand.high === 1.3);
  const band = snapshot.load.sweetSpotBand!;
  ok('the continuum keeps under, sweet spot and over in order',
    coachLoadMarkerFraction(0.3, band) === 0
      && coachLoadMarkerFraction(band.low, band) < coachLoadMarkerFraction(1.05, band)
      && coachLoadMarkerFraction(1.05, band) < coachLoadMarkerFraction(band.high, band)
      && coachLoadMarkerFraction(1.8, band) === 1);
  ok('load coverage remains its measured/planned pair',
    snapshot.load.coverage?.sessionsMeasured === 3
      && snapshot.load.coverage.sessionsPlanned === 4);
  ok('completed weekly AU reaches Progress in chronological order',
    snapshot.load.weeklyCompletedLoadAU.map((point) => `${point.weekStart}:${point.value}`).join(',')
      === '2026-08-10:640,2026-08-17:680,2026-08-24:720');
  const deloadSnapshot = buildCoachSnapshot({ ...baseInput, isDeloadWeek: true });
  ok('the stored deload answer crosses the same snapshot boundary',
    snapshot.load.isDeloadWeek === false && deloadSnapshot.load.isDeloadWeek === true);
  ok('load wording distinguishes the sweet spot, both potential misses and an intentional deload',
    coachLoadSummary('in') === 'In the sweet spot'
      && coachLoadSummary('above') === 'Potentially overtraining'
      && coachLoadSummary('below') === 'Potentially undertraining'
      && coachLoadSummary('below', true) === 'Deload week'
      && coachLoadGuidance('below', true) === 'Lower load is expected during a deload week.');
  ok('recorded progress survives without a second calculation',
    snapshot.progress[0]?.exerciseName === 'Back Squat'
      && snapshot.progress[0]?.direction === 'up');
  ok('multi-week lift history survives as chart-ready facts',
    snapshot.strengthHistory[0]?.points.length === 2
      && snapshot.strengthHistory[0]?.points[0]?.topSet.weightKg === 95);
  ok('the recorded 2km answer survives without invented history',
    snapshot.twoKmTimeTrial?.seconds === 420);
  ok('the active restriction survives as the exact authored note',
    snapshot.restrictions[0] === modifier);
}

console.log('\n[2] ABSENCE AND IDENTITY ARE HONEST');
{
  const empty = buildCoachSnapshot({
    ...baseInput,
    readinessSignal: null,
    activeModifiers: [],
    strengthLifts: [],
    strengthHistory: [],
    twoKmTimeTrial: null,
  });
  ok('no check-in stays not recorded', empty.readiness.state === 'not_recorded');
  ok('no progress stays empty', empty.progress.length === 0);
  ok('no lift history stays empty', empty.strengthHistory.length === 0);
  ok('no 2km answer stays absent', empty.twoKmTimeTrial === null);
  ok('no restriction stays empty', empty.restrictions.length === 0);

  let weekMismatch = false;
  try {
    buildCoachSnapshot({
      ...baseInput,
      journalWeek: { ...journalWeek, weekStart: '2026-08-17' },
    });
  } catch (error) {
    weekMismatch = /same visible week/.test(String(error));
  }
  ok('a mismatched week refuses before it can present drift', weekMismatch);

  let dateMismatch = false;
  try {
    buildCoachSnapshot({
      ...baseInput,
      readinessSignal: { ...baseInput.readinessSignal!, date: '2026-08-23' },
    });
  } catch (error) {
    dateMismatch = /as-of date/.test(String(error));
  }
  ok('a readiness answer from another date refuses', dateMismatch);

  const changed = buildCoachSnapshot({
    ...baseInput,
    journalWeek: {
      ...journalWeek,
      work: { ...journalWeek.work, completedFull: 3, completedPartial: 0 },
    },
  });
  ok('changed facts make a changed fresh picture',
    changed !== buildCoachSnapshot(baseInput)
      && changed.thisWeek.work.completedFull === 3);
}

function pureSnapshotOwner(body: string): boolean {
  return !/from ['"](?:react|react-native|\.\.\/store\/|\.\.\/hooks\/)/.test(body)
    && !/todayISO|new Date\(|\.(?:persist|setState)\b|AsyncStorage/.test(body);
}

function conversationUsesSnapshot(body: string): boolean {
  const call = /await askCoachReadOnly\(\{[\s\S]*?\n\s*\}\);/.exec(body)?.[0] ?? '';
  return call.length > 100
    && /\n\s*snapshot,\s*\n/.test(call)
    && !/snapshot\s*:|visibleWeek/.test(call);
}

function progressOwnsTheLoadHero(body: string): boolean {
  const screenStart = body.indexOf('export default function ProgressTabScreen');
  const screenEnd = body.indexOf('const styles = StyleSheet.create', screenStart);
  if (screenStart < 0 || screenEnd < 0) return false;
  const screen = body.slice(screenStart, screenEnd);
  const title = screen.indexOf('testID="progress-tab-title"');
  const load = screen.indexOf('<LoadContinuum load={periodHistory.load} range={range} comparison={loadComparison}');
  const lifts = screen.indexOf('testID="progress-main-lifts"');
  const tests = screen.indexOf('testID="progress-performance-tests"');
  const measurements = screen.indexOf('testID="progress-measurements"');
  if (title < 0 || load < 0 || lifts < 0 || tests < 0 || measurements < 0) return false;
  return title < load && load < lifts && lifts < tests && tests < measurements
    && body.includes('testID="progress-load-track"')
    && body.includes('testID="progress-load-sweet-spot"');
}

function progressUsesTwoColumnLiftGrid(body: string): boolean {
  const grid = /liftGrid:\s*\{([\s\S]*?)\n\s*\},/.exec(body)?.[1] ?? '';
  const card = /liftCard:\s*\{([\s\S]*?)\n\s*\},/.exec(body)?.[1] ?? '';
  return /flexDirection:\s*'row'/.test(grid)
    && /flexWrap:\s*'wrap'/.test(grid)
    && /flexBasis:\s*'47%'/.test(card)
    && /flexGrow:\s*1/.test(card);
}

console.log('\n[2b] THE MODEL PROJECTION SAYS WHAT IS ABSENT AND NAMES THE WEEK (F14, 2026-09-09)');
{
  // Sam's 2026-09-09 walkthrough: the Coach answered "readiness recorded as
  // flat" with nothing recorded, and "Game Day Saturday and Sunday" with one
  // Saturday game. The projection is the only thing the model reads, so it
  // must say absence out loud and hand over the weekday and fixture facts
  // instead of leaving the model to derive them from bare ISO dates.
  const projectedDay = (date: string, kind: 'training' | 'rest' | 'game') => ({
    date, kind, headline: `${kind} day`, parts: [], gaps: [],
  });
  const weekWithOneGame = {
    weekStart: WEEK_START,
    days: [
      projectedDay('2026-08-24', 'training'),
      projectedDay('2026-08-25', 'training'),
      projectedDay('2026-08-26', 'rest'),
      projectedDay('2026-08-27', 'training'),
      projectedDay('2026-08-28', 'rest'),
      projectedDay('2026-08-29', 'game'),
      projectedDay('2026-08-30', 'rest'),
    ],
    explanations: [],
  } as unknown as VisibleWeek;
  const quiet = projectCoachSnapshotForModel(
    buildCoachSnapshot({ ...baseInput, visibleWeek: weekWithOneGame, readinessSignal: null }),
  );
  const quietText = JSON.stringify(quiet.readiness);
  ok('a null readiness signal crosses as reported:false, state not_recorded',
    quiet.readiness.reported === false && quiet.readiness.state === 'not_recorded',
    quiet.readiness);
  ok('and carries no readiness tier word for the model to repeat',
    !/\b(flat|good|wrecked|cooked)\b/i.test(quietText), quietText);
  const reported = projectCoachSnapshotForModel(
    buildCoachSnapshot({ ...baseInput, visibleWeek: weekWithOneGame }),
  );
  ok('a recorded quick check crosses as reported:true', reported.readiness.reported === true);
  ok('every visible day carries its weekday name, so the model never derives one from a date',
    reported.visibleWeek.days.length === 7
      && reported.visibleWeek.days.every((day) => day.weekday === weekdayName(day.date))
      && reported.visibleWeek.days[0]?.weekday === 'Monday'
      && reported.visibleWeek.days[6]?.weekday === 'Sunday',
    reported.visibleWeek.days.map((day) => [day.date, day.weekday]));
  ok('the fixture list is exhaustive: exactly the game-kind days, each with its weekday',
    reported.visibleWeek.fixtureCount === 1
      && reported.visibleWeek.fixtures.length === 1
      && reported.visibleWeek.fixtures[0]?.date === '2026-08-29'
      && reported.visibleWeek.fixtures[0]?.weekday === 'Saturday',
    reported.visibleWeek.fixtures);
  const noGame = projectCoachSnapshotForModel(buildCoachSnapshot({
    ...baseInput,
    visibleWeek: {
      ...weekWithOneGame,
      days: weekWithOneGame.days.map((day) => (day.kind === 'game' ? { ...day, kind: 'rest' } : day)),
    } as unknown as VisibleWeek,
  }));
  ok('a week with no game says so with an empty list and a zero count',
    noGame.visibleWeek.fixtureCount === 0 && noGame.visibleWeek.fixtures.length === 0,
    noGame.visibleWeek.fixtures);
}

console.log('\n[3] STORE READS STOP AT ONE ADAPTER; BOTH SURFACES READ ITS VALUE');
{
  const owner = source('src', 'rules', 'liveAthleteSnapshot.ts');
  const adapter = source('src', 'screens', 'coach', 'useLiveAthleteSnapshot.ts');
  const screen = source('src', 'screens', 'coach', 'CoachTabScreen.tsx');
  const progress = source('src', 'screens', 'progress', 'ProgressTabScreen.tsx');
  const glassFlow = source('.maestro', 'golden', 'progress-dashboard.yaml');

  ok('the Snapshot builder is domain-pure and clock-free', pureSnapshotOwner(owner));
  ok('the pure owner reuses the Journal week/load/current and historical progress owners',
    /buildJournalWeek/.test(owner)
      && /buildJournalLoadModel/.test(owner)
      && /buildJournalStrengthTrend/.test(owner)
      && /buildJournalStrengthSeries/.test(owner));
  ok('the store adapter delegates the complete derivation to that owner',
    /deriveCoachSnapshot\(\{/.test(adapter)
      && !/buildJournalWeek|buildJournalLoadModel|buildJournalStrengthTrend/.test(adapter));
  ok('the adapter reads readiness and active restrictions without writing',
    /useReadinessStore/.test(adapter)
      && /activeModifiers:\s*input\.activeModifiers/.test(adapter)
      && !/\.setState|\.persist|AsyncStorage|setReadinessSignal|applyReadinessSignalsWrite/.test(adapter));
  ok('the Coach screen builds exactly one Snapshot',
    (screen.match(/useLiveAthleteSnapshot\s*\(/g) ?? []).length === 1);
  ok('Coach renders no tracking dashboard after Progress takes ownership',
    !/CoachDashboard|SnapshotDashboard|coach-dashboard/.test(screen));
  ok('the one production conversation door receives the exact Snapshot',
    conversationUsesSnapshot(screen));
  ok('Progress receives the same live Snapshot once',
    (progress.match(/useLiveAthleteSnapshot\s*\(/g) ?? []).length === 1);
  ok('training load owns the Progress hero and its sweet-spot continuum',
    progressOwnsTheLoadHero(progress)
      && glassFlow.includes('id: "progress-load-track"')
      && glassFlow.includes('id: "progress-load-sweet-spot"'));
  ok('Progress renders chart-ready main lifts before compact tests and measurements',
    /snapshot\.mainLiftEstimates/.test(progress)
      && !/snapshot\.twoKmTimeTrial|progress-two-km/.test(progress)
      && progressUsesTwoColumnLiftGrid(progress)
      && glassFlow.includes('id: "progress-main-lifts"')
      && glassFlow.includes('id: "progress-performance-tests"')
      && glassFlow.includes('id: "progress-measurements"'));
  ok('the glass flow opens Progress and captures its populated dashboard',
    /id: "tab-progress"/.test(glassFlow)
      && /artifacts\/ui-walk\/progress-dashboard/.test(glassFlow));
}

console.log('\n[5] WHERE THE ATHLETE IS IN THE YEAR CROSSES THE SAME BOUNDARY (R-397, S1)');
{
  const nextWeek: VisibleWeek = {
    weekStart: '2026-08-31',
    days: [
      { ...visibleWeek.days[0], date: '2026-08-31', parts: [], gaps: [] },
      { ...visibleWeek.days[5], date: '2026-09-05', kind: 'game', parts: [], gaps: [] },
    ],
    explanations: [],
  };
  const situated = buildCoachSnapshot({
    ...baseInput,
    isDeloadWeek: true,
    situation: {
      season: {
        phase: 'In-season',
        subphase: null,
        phaseWeekNumber: 6,
        weekKind: 'deload',
        blockNumber: 2,
        weekInBlock: 4,
        isDeloadWeek: true,
      },
      standing: {
        usualGameDay: 'Saturday',
        clubNights: ['Tuesday', 'Thursday'],
        gymDays: ['Monday', 'Wednesday'],
        sessionsPerWeek: 2,
        christmasBreak: null,
      },
      fixturesAhead: ['2026-09-05', '2026-09-12'],
      nextWeek,
    },
    history: {
      readiness: [{ date: '2026-08-22', energy: 'low', source: 'quick_check', updatedAt: '2026-08-22T08:00:00.000Z' }],
      sessionOutcomes: [{ date: '2026-08-22', completion: 'partial', reason: 'time', feeling: 'hard', components: [] }],
      recentChanges: [{ occurredAt: '2026-08-23T10:00:00.000Z', kind: 'lighter_day', provenance: 'athlete_tap', details: { date: '2026-08-23' } }],
    },
    injuries: [{ bodyPart: 'Knee', region: 'lower', severity: 4, status: 'active', since: '2026-08-20', triggers: ['deep squat'], seriousSymptoms: false }],
    mas: { masKmh: 17.1, source: 'measured', seconds: 420 },
  });
  const projected = projectCoachSnapshotForModel(situated);
  ok('the owned phase, block clock and deload flag cross as facts',
    projected.situation.season?.phase === 'In-season'
      && projected.situation.season?.blockNumber === 2
      && projected.situation.season?.weekInBlock === 4
      && projected.situation.season?.isDeloadWeek === true
      && projected.load.isDeloadWeek === true);
  ok('the standing pattern, fixtures ahead and next week cross with weekday names',
    projected.situation.standing?.usualGameDay === 'Saturday'
      && projected.situation.standing?.clubNights.length === 2
      && projected.situation.fixturesAhead[0]?.weekday === 'Saturday'
      && projected.situation.fixturesAhead[0]?.timing.relationToAsOf === 'future'
      && projected.situation.nextWeek?.weekStart === '2026-08-31'
      && projected.situation.nextWeek?.fixtures[0]?.weekday === 'Saturday'
      && projected.situation.nextWeek?.days[0]?.timing.relationToAsOf === 'future');
  ok('fourteen days of recorded history, injuries and MAS cross as recorded, never invented',
    projected.history.readiness[0]?.weekday === 'Saturday'
      && projected.history.sessionOutcomes[0]?.completion === 'partial'
      && projected.history.recentChanges[0]?.kind === 'lighter_day'
      && projected.history.recentChanges[0]?.provenance === 'athlete_tap'
      && projected.injuries[0]?.bodyPart === 'Knee'
      && projected.injuries[0]?.triggers[0] === 'deep squat'
      && projected.mas?.masKmh === 17.1
      && projected.mas?.source === 'measured');
  ok('the projection carries no key the server refuses (name, ids, email)',
    !/"(?:email|userId|athleteId|accountId|name)"\s*:/i.test(JSON.stringify(projected)));
  ok('the grounding facts read the owned phase from the projection',
    coachResponseGroundingFacts(projected).seasonPhase === 'In-season');

  const unknown = buildCoachSnapshot(baseInput);
  const unknownProjected = projectCoachSnapshotForModel(unknown);
  ok('an absent situation is told as unknown, not guessed',
    unknown.situation.season === null
      && unknown.situation.nextWeek === null
      && unknown.situation.fixturesAhead.length === 0
      && unknown.history.readiness.length === 0
      && unknown.injuries.length === 0
      && unknown.mas === null
      && unknownProjected.situation.season === null
      && coachResponseGroundingFacts(unknownProjected).seasonPhase === null);

  let wrongNextWeek = false;
  try {
    buildCoachSnapshot({
      ...baseInput,
      situation: { season: null, standing: null, fixturesAhead: [], nextWeek: { ...nextWeek, weekStart: '2026-09-07' } },
    });
  } catch (error) {
    wrongNextWeek = /week after the visible week/.test(String(error));
  }
  ok('a "next week" that is not the week after the visible week refuses', wrongNextWeek);

  let deloadDisagreement = false;
  try {
    buildCoachSnapshot({
      ...baseInput,
      isDeloadWeek: false,
      situation: {
        season: { phase: 'In-season', subphase: null, phaseWeekNumber: 1, weekKind: 'deload', blockNumber: 1, weekInBlock: 1, isDeloadWeek: true },
        standing: null,
        fixturesAhead: [],
        nextWeek: null,
      },
    });
  } catch (error) {
    deloadDisagreement = /agree about the deload week/.test(String(error));
  }
  ok('season and load cannot disagree about a deload week', deloadDisagreement);

  const decisionProjection = projectRecentChange({
    occurredAt: '2026-08-23T10:00:00.000Z',
    provenance: 'athlete_tap',
    decision: {
      kind: 'fixture_move',
      fromDate: '2026-08-29',
      toDate: '2026-08-30',
      fixtureKind: 'game',
      sourceEntryId: 'entry-1',
      name: 'never',
      answer: { kind: 'confirmed', sessionsPerWeek: 3, trainingDays: ['Monday', 'Thursday'] },
    },
  });
  ok('a ledger decision crosses with its primitive fields and without ids or a name key',
    decisionProjection.kind === 'fixture_move'
      && decisionProjection.details.fromDate === '2026-08-29'
      && decisionProjection.details['answer.sessionsPerWeek'] === 3
      && !('sourceEntryId' in decisionProjection.details)
      && !('name' in decisionProjection.details));
}

console.log('\n[4] THE SNAPSHOT HAS NO PERSISTED COPY');
{
  const stores = filesUnder(join(ROOT, 'src', 'store'))
    .filter((file) => /\.(?:ts|tsx)$/.test(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  ok('no store owns or persists a Coach Snapshot',
    !/CoachSnapshot|coach[-_ ]snapshot/i.test(stores));
}

console.log('\n[5] LIVENESS — MUTATIONS DIE FOR THE RIGHT REASON');
{
  const owner = source('src', 'rules', 'liveAthleteSnapshot.ts');
  const screen = source('src', 'screens', 'coach', 'CoachTabScreen.tsx');
  const progress = source('src', 'screens', 'progress', 'ProgressTabScreen.tsx');
  ok('a fabricated store dependency kills domain purity',
    pureSnapshotOwner(owner)
      && !pureSnapshotOwner(`${owner}\nimport { useProgramStore } from '../store/programStore';`));
  const bypass = screen.replace(
    /\n\s*snapshot,\s*\n/,
    '\n        snapshot: { ...snapshot, visibleWeek },\n',
  );
  ok('a fabricated conversation bypass kills shared ownership',
    conversationUsesSnapshot(screen) && !conversationUsesSnapshot(bypass));
  const movedLoad = progress
    .replace(/<LoadContinuum\b[\s\S]*?\/>/, '')
    .replace(
      '<ProgressHeading title={PROGRESS_TAB_COPY.mainLifts} testID="progress-main-lifts" inline />',
      '<ProgressHeading title={PROGRESS_TAB_COPY.mainLifts} testID="progress-main-lifts" inline />\n'
        + '<LoadContinuum load={periodHistory.load} range={range} comparison={loadComparison} />',
    );
  ok('moving Load below the main-lift heading kills the hierarchy guard',
    progressOwnsTheLoadHero(progress) && !progressOwnsTheLoadHero(movedLoad));
  const singleColumn = progress.replace(/(liftGrid: \{[\s\S]*?)flexWrap: 'wrap',/, "$1flexDirection: 'column',");
  ok('collapsing the main-lift grid to one column kills its layout guard',
    progressUsesTwoColumnLiftGrid(progress) && !progressUsesTwoColumnLiftGrid(singleColumn));
}

console.log(`\nCoach Snapshot totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this is a pure-data and source-ownership guard. It does not mount the React Native screen, judge layout on a phone, exercise AI, or execute a program change.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
