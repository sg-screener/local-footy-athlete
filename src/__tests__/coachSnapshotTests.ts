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
  type BuildCoachSnapshotInput,
} from '../rules/liveAthleteSnapshot';
import type { VisibleWeek } from '../rules/visibleProjection';
import type { JournalWeek } from '../rules/journalWeek';
import type { JournalLoadModel } from '../rules/journalLoad';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import { coachLoadMarkerFraction } from '../rules/snapshotDashboardCopy';

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
  ok('recorded progress survives without a second calculation',
    snapshot.progress[0]?.exerciseName === 'Back Squat'
      && snapshot.progress[0]?.direction === 'up');
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
  });
  ok('no check-in stays not recorded', empty.readiness.state === 'not_recorded');
  ok('no progress stays empty', empty.progress.length === 0);
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
  return /readCoachMessage\([\s\S]{0,160}?week:\s*snapshot\.visibleWeek/.test(body)
    && /coachAnswer\([\s\S]{0,180}?week:\s*snapshot\.visibleWeek/.test(body)
    && /coachProposal\([\s\S]{0,180}?week:\s*snapshot\.visibleWeek/.test(body)
    && !/(?:readCoachMessage|coachAnswer|coachProposal)\([\s\S]{0,180}?week:\s*visibleWeek/.test(body);
}

function loadOwnsTheHero(body: string): boolean {
  const load = body.indexOf('testID="coach-dashboard-load"');
  const firstTileRow = body.indexOf('<View style={styles.row}>');
  const consistency = body.indexOf('testID="coach-dashboard-week"');
  if (load < 0 || firstTileRow < 0 || consistency < 0) return false;
  const hero = body.slice(load, firstTileRow);
  return load < firstTileRow
    && consistency > firstTileRow
    && hero.includes('testID="coach-dashboard-load-track"')
    && hero.includes('testID="coach-dashboard-load-sweet-spot"');
}

console.log('\n[3] STORE READS STOP AT ONE ADAPTER; BOTH SURFACES READ ITS VALUE');
{
  const owner = source('src', 'rules', 'liveAthleteSnapshot.ts');
  const adapter = source('src', 'screens', 'coach', 'useLiveAthleteSnapshot.ts');
  const screen = source('src', 'screens', 'coach', 'CoachTabScreen.tsx');
  const dashboard = source('src', 'screens', 'coach', 'SnapshotDashboard.tsx');
  const glassFlow = source('.maestro', 'golden', 'coach-snapshot-dashboard.yaml');
  const liveRefreshFlow = source(
    '.maestro', 'golden', 'coach-snapshot-dashboard-live-refresh.yaml',
  );
  const glassReceipt = source('docs', 'GOLDEN_FLOW_RUN_RECEIPT.md');

  ok('the Snapshot builder is domain-pure and clock-free', pureSnapshotOwner(owner));
  ok('the pure owner reuses the Journal week/load/progress owners',
    /buildJournalWeek/.test(owner)
      && /buildJournalLoadModel/.test(owner)
      && /buildJournalStrengthTrend/.test(owner));
  ok('the store adapter delegates the complete derivation to that owner',
    /deriveCoachSnapshot\(\{/.test(adapter)
      && !/buildJournalWeek|buildJournalLoadModel|buildJournalStrengthTrend/.test(adapter));
  ok('the adapter reads readiness and active restrictions without writing',
    /useReadinessStore/.test(adapter)
      && /activeModifiers:\s*input\.activeModifiers/.test(adapter)
      && !/\.setState|\.persist|AsyncStorage|setReadinessSignal|applyReadinessSignalsWrite/.test(adapter));
  ok('the Coach screen builds exactly one Snapshot',
    (screen.match(/useLiveAthleteSnapshot\s*\(/g) ?? []).length === 1);
  ok('the dashboard receives that exact Snapshot',
    /<CoachDashboard\s+snapshot=\{snapshot\}\s*\/>/.test(screen));
  ok('all three conversation readers use the Snapshot visible week',
    conversationUsesSnapshot(screen));
  for (const section of ['week', 'readiness', 'load', 'progress', 'restrictions']) {
    ok(`the dashboard renders the ${section} section`,
      dashboard.includes(`testID="coach-dashboard-${section}"`));
    ok(`the glass flow requires the ${section} section`,
      glassFlow.includes(`id: "coach-dashboard-${section}"`));
  }
  ok('the glass flow opens Coach and captures the dashboard',
    /id: "tab-coach"/.test(glassFlow)
      && /artifacts\/ui-walk\/coach-snapshot-dashboard/.test(glassFlow));
  ok('populated glass requires the earned load marker and signed My Status label',
    glassFlow.includes('id: "coach-dashboard-load-marker"')
      && glassFlow.includes('"My Status"')
      && glassFlow.includes('e2e-seed-ready-coach-snapshot-populated-journey'));
  ok('live glass changes readiness without reopening Coach',
    liveRefreshFlow.includes('e2e-seed-ready-coach-snapshot-cooked-check-in')
      && liveRefreshFlow.includes('assertNotVisible: "No check-in today"')
      && !/id: "tab-coach"/.test(liveRefreshFlow));
  ok('the populated and live simulator executions have a dated receipt',
    /coach-snapshot-dashboard\.yaml[^\n]+PASS[^\n]+populated/i.test(glassReceipt)
      && /coach-snapshot-dashboard-live-refresh\.yaml[^\n]+PASS[^\n]+without leaving Coach/i
        .test(glassReceipt));
  ok('training load owns the hero and its signed sweet-spot continuum',
    loadOwnsTheHero(dashboard)
      && glassFlow.includes('id: "coach-dashboard-load-track"')
      && glassFlow.includes('id: "coach-dashboard-load-sweet-spot"'));
  ok('Consistency and the other three signals form the two-by-two tile grid',
    (dashboard.match(/<View style=\{styles\.row\}>/g) ?? []).length === 2
      && /consistency/.test(dashboard)
      && /borderWidth:\s*1/.test(dashboard)
      && /borderRadius:\s*borderRadius\.lg/.test(dashboard));
  ok('athlete-visible dashboard words come from the one copy owner',
    /COACH_DASHBOARD_COPY/.test(dashboard)
      && !/>\s*(?:This week|Readiness|Load|Progress|My Status|Restrictions|None active)\s*</.test(dashboard));
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
  const dashboard = source('src', 'screens', 'coach', 'SnapshotDashboard.tsx');
  ok('a fabricated store dependency kills domain purity',
    pureSnapshotOwner(owner)
      && !pureSnapshotOwner(`${owner}\nimport { useProgramStore } from '../store/programStore';`));
  const bypass = screen.replace(/week:\s*snapshot\.visibleWeek/g, 'week: visibleWeek');
  ok('a fabricated conversation bypass kills shared ownership',
    conversationUsesSnapshot(screen) && !conversationUsesSnapshot(bypass));
  const swappedHierarchy = dashboard
    .replace('testID="coach-dashboard-load"', 'testID="coach-dashboard-swap"')
    .replace('testID="coach-dashboard-week"', 'testID="coach-dashboard-load"')
    .replace('testID="coach-dashboard-swap"', 'testID="coach-dashboard-week"');
  ok('swapping load and Consistency kills the hierarchy guard',
    loadOwnsTheHero(dashboard) && !loadOwnsTheHero(swappedHierarchy));
}

console.log(`\nCoach Snapshot totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this is a pure-data and source-ownership guard. It does not mount the React Native screen, judge layout on a phone, exercise AI, or execute a program change.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
