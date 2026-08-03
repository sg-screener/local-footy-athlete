/**
 * ON-DEVICE ACTION LOG — MASTER_PLAN 5D.3, jumped the queue by Sam's ruling
 * (2026-07-30) so the next G-1 diagnosis reads his actual taps instead of my
 * fourth reconstruction of them.
 *
 * The vocabulary already existed. All four gaps were about REACH:
 *
 *   1. disabled on the build the defects live on,
 *   2. in-memory only, so a relaunch erased the evidence,
 *   3. unbounded, so it could not be left on,
 *   4. absent from Export stored state, so it could not leave the device.
 *
 * This suite is written against those four, plus the two properties that make
 * it safe to leave running: it never carries athlete content, and it never
 * turns the dev-only trace machinery on.
 *
 * Run: npm run test:action-log
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the action log never leaves the device');
};
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData, TrainingProgram } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { seedManualOverride } from './support/programOverrideHarness';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { asyncStorageDurable } from '../store/asyncStorageCompat';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import {
  ATHLETE_ACTION_LOG_MAX_ENTRIES,
  ATHLETE_ACTION_LOG_STORAGE_KEY,
  athleteActionLogEntries,
  clearAthleteActionLog,
  hydrateAthleteActionLog,
  type AthleteActionLogEntry,
} from '../utils/athleteActionLog';
import {
  beginAthleteActionTrace,
  configureAthleteActionDiagnosticsForTests,
  emitAthleteActionEvent,
  getAthleteActionDiagnosticEvents,
} from '../utils/athleteActionDiagnostics';
import { captureStoredStateExport } from '../dev/devStoredStateExport';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { applyPlanChange } from '../utils/planChangeProducer';
import { commitOnboardingStep } from '../utils/onboardingStepCommit';
import { publishAcceptedProfileCompatibilityMirror } from '../store/profileStore';
import { clearProfileMirrorRefusals } from '../rules/profileMirrorNarrowing';

const CURRENT_WEEK = '2026-07-13';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  const debug = console.debug;
  const info = console.info;
  console.warn = () => undefined;
  console.error = () => undefined;
  console.debug = () => undefined;
  console.info = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
    console.debug = debug;
    console.info = info;
  }
}

/**
 * SAM'S DEVICE, as far as this process can model it: a Release build with the
 * dev diagnostics switch off. Every assertion below runs in this state, because
 * a log that only works with the switch on is the gap, not the fix.
 */
function releaseBuild(): void {
  configureAthleteActionDiagnosticsForTests({ production: true, enabled: false });
}

function trace(actionType: 'move_session' | 'add_session' = 'move_session') {
  return beginAthleteActionTrace({
    source: 'tap',
    actionType,
    route: 'action-log-test',
  }, undefined, { forceRoot: true });
}

console.log('\n-- On-device action log --');

void (async () => {

// ── Gap 1: alive on the build the defects live on ─────────────────────────

await run('records on a release build, where the dev trace channel stays off', async () => {
  releaseBuild();
  await clearAthleteActionLog();
  const context = trace();
  emitAthleteActionEvent(context, 'athlete_mutation_received', {
    door: 'applyPlanChange', mutationType: 'move_session',
  });

  // Scoped by trace id, not by total length: the log also records SYSTEM work
  // (store hydration, persistence results), and an unrelated async event
  // landing mid-test is the log working, not the test failing.
  const mine = athleteActionLogEntries()
    .filter((entry) => entry.traceId === context.traceId);
  assert(mine.length === 2,
    `release build recorded ${mine.length} entries for this action, not the `
    + `requested + received pair: ${JSON.stringify(
      athleteActionLogEntries().map((entry) => `${entry.actionType}:${entry.event}`))}`);
  assert(mine.some((entry) => entry.event === 'athlete_mutation_received'),
    'the emitted event never reached the log on a release build');
  assert(mine.every((entry) => entry.actionType === 'move_session'),
    'log entries lost the action identity that correlates them');
  // Non-vacuity, and the boundary that keeps this cheap: the dev-only V1 event
  // buffer and the V2 coordinator are still gated. The log is not "diagnostics
  // switched on in production" — it is its own, smaller thing.
  assert(getAthleteActionDiagnosticEvents().length === 0,
    'enabling the log also enabled the dev diagnostic channel');
});

await run('an athlete-facing tap is recorded end to end, on a release build', async () => {
  releaseBuild();
  await clearAthleteActionLog();
  const weekStart = seed();
  const friday = addDaysISO(weekStart, 4);
  const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));

  // The exact shape of Sam's report: a routeless landing on G-1.
  const result = quiet(() => applyPlanChange({
    change: { kind: 'add_category', date: friday, category: 'conditioning_hard' },
    visibleWeek: week,
    todayISO: weekStart,
    applyOverride: (date, workout, ctx) =>
      seedManualOverride(date, workout, ctx),
  }));
  assert(!result.ok, 'this seed no longer refuses a routeless G-1 add');

  const entries = athleteActionLogEntries();
  assert(entries.length > 0, 'a real tap left no trace in the log');
  assert(entries.some((entry) => entry.actionType === 'add_session'),
    `the log did not record the action type: ${JSON.stringify(entries.map((e) => e.actionType))}`);
  assert(entries.some((entry) => entry.targetDate === friday),
    'the log did not record which day was touched');
  // The field that would have answered the question in one read.
  assert(entries.some((entry) => entry.internalResultCode === 'g1_route_required'),
    `no entry carries the refusal code: ${JSON.stringify(
      entries.map((entry) => entry.internalResultCode ?? entry.event))}`);
});

// ── Gap 3: bounded, so it can be left on ──────────────────────────────────

await run(`keeps the most recent ${ATHLETE_ACTION_LOG_MAX_ENTRIES} and drops the oldest`, async () => {
  releaseBuild();
  await clearAthleteActionLog();
  const context = trace();
  const total = ATHLETE_ACTION_LOG_MAX_ENTRIES + 50;
  for (let index = 0; index < total; index += 1) {
    emitAthleteActionEvent(context, 'athlete_action_route_selected', { sequence: index });
  }

  const entries = athleteActionLogEntries();
  assert(entries.length === ATHLETE_ACTION_LOG_MAX_ENTRIES,
    `the log holds ${entries.length} entries, not ${ATHLETE_ACTION_LOG_MAX_ENTRIES}`);
  assert(entries[entries.length - 1]!.sequence === total - 1,
    'the newest event is not at the end — the log dropped the wrong end');
  assert(!entries.some((entry) => entry.sequence === 0),
    'the oldest event survived the trim');
});

await run('one action\'s engine chatter cannot evict the athlete\'s own steps', async () => {
  // Export 6: a six-step re-test came back with 200 entries, 182 of them ONE
  // move's repair search. The first five steps — including both findings Sam
  // most wanted read — had been evicted by a single transaction's internals.
  releaseBuild();
  await clearAthleteActionLog();
  const context = trace();
  emitAthleteActionEvent(context, 'athlete_mutation_received', { step: 'first-tap' });
  for (let index = 0; index < ATHLETE_ACTION_LOG_MAX_ENTRIES * 2; index += 1) {
    emitAthleteActionEvent(context, 'repair_candidate_selected', { sequence: index });
  }
  emitAthleteActionEvent(context, 'athlete_action_completed', { step: 'last-tap' });

  const entries = athleteActionLogEntries();
  assert(entries.length <= ATHLETE_ACTION_LOG_MAX_ENTRIES,
    `the ring grew past its cap: ${entries.length}`);
  assert(entries.some((entry) => entry.step === 'first-tap'),
    'the repair search evicted the tap that started the session — the exact '
    + 'failure that cost two findings on export 6');
  assert(entries.some((entry) => entry.step === 'last-tap'),
    'the newest decision is missing');
  // The chatter is kept, just second in line.
  assert(entries.some((entry) => entry.event === 'repair_candidate_selected'),
    'engine entries were dropped entirely — they are useful, just not first');
});

// ── Gap 2: survives a relaunch ────────────────────────────────────────────

await run('what was recorded is on disk, not only in memory', async () => {
  releaseBuild();
  await clearAthleteActionLog();
  emitAthleteActionEvent(trace(), 'athlete_action_completed', { outcome: 'applied' });
  await flushPendingStorageWrites();

  const raw = await asyncStorageDurable.getItem(ATHLETE_ACTION_LOG_STORAGE_KEY);
  assert(raw, 'nothing was written to storage — a relaunch would erase the evidence');
  const persisted = JSON.parse(raw) as { entries: AthleteActionLogEntry[] };
  assert(persisted.entries.some((entry) => entry.event === 'athlete_action_completed'),
    `the persisted payload does not carry the event: ${raw.slice(0, 200)}`);
});

await run('a relaunch reads back what the last run recorded, oldest first', async () => {
  releaseBuild();
  await clearAthleteActionLog();
  // Stand in for the previous run: bytes on disk, nothing in memory.
  await asyncStorageDurable.setItem(ATHLETE_ACTION_LOG_STORAGE_KEY, JSON.stringify({
    protocolVersion: 1,
    entries: [{
      at: '2026-07-29T22:00:00.000Z',
      event: 'athlete_action_completed',
      traceId: 'previous-run',
      source: 'tap',
      actionType: 'move_session',
    }],
  }));

  await hydrateAthleteActionLog();
  emitAthleteActionEvent(trace(), 'athlete_action_completed', { outcome: 'applied' });

  const entries = athleteActionLogEntries();
  assert(entries.some((entry) => entry.traceId === 'previous-run'),
    'the previous run\'s entries did not survive the relaunch');
  assert(entries[0]!.traceId === 'previous-run',
    'the relaunch put this run\'s events before the last run\'s — the log is out of order');
});

// ── Gap 4: it can leave the device ────────────────────────────────────────

await run('Export stored state carries the log', async () => {
  releaseBuild();
  await clearAthleteActionLog();
  emitAthleteActionEvent(trace('add_session'), 'athlete_action_failed', {
    internalResultCode: 'g1_route_required',
  });

  const exported = captureStoredStateExport();
  assert(Array.isArray(exported.athleteActionLog),
    'the export has no action log — the athlete cannot send it');
  assert(exported.athleteActionLog.some((entry) =>
    (entry as AthleteActionLogEntry).internalResultCode === 'g1_route_required'),
  'the exported log does not carry the entry that was just recorded');
});

// ── Safe to leave running ─────────────────────────────────────────────────

await run('athlete content never reaches the log', async () => {
  releaseBuild();
  await clearAthleteActionLog();
  emitAthleteActionEvent(trace(), 'athlete_action_completed', {
    // Every one of these is a field name the redaction list forbids. A log that
    // is always on and leaves the device by design has to be provably free of
    // them, not conventionally free of them.
    exercises: ['Back Squat 100kg'],
    prescription: '3x5 @ 100kg',
    injuryDetail: 'left hamstring, grade 2',
    coachNotes: 'felt terrible today',
    weight: 100,
    outcome: 'applied',
  });

  const serialised = JSON.stringify(athleteActionLogEntries());
  for (const forbidden of ['Back Squat', '100kg', 'hamstring', 'felt terrible']) {
    assert(!serialised.includes(forbidden),
      `athlete content reached the log: "${forbidden}" in ${serialised.slice(0, 300)}`);
  }
  assert(serialised.includes('applied'),
    'the redaction also removed the outcome — the log would be useless');
});

await run('every onboarding answer is on the tape', async () => {
  // THE INSTRUMENTATION RULE, APPLIED TO THE INSTRUMENT'S OWN GAP (Sam,
  // export 4). His log held five entries, all of them this launch's hydration,
  // and NOTHING from the onboarding that lost 21 answers — because the
  // onboarding write door never emitted. The log covered the stores where the
  // last defect lived, not the store where this one does.
  releaseBuild();
  await clearAthleteActionLog();
  useProfileStore.setState({ onboardingData: {} as OnboardingData, isOnboardingComplete: false });

  await commitOnboardingStep({ seasonPhase: 'In-season' } as never);
  await commitOnboardingStep({ position: 'inside_mid' } as never);

  const commits = athleteActionLogEntries()
    .filter((entry) => entry.event === 'onboarding_step_committed');
  assert(commits.length === 2,
    `the log recorded ${commits.length} onboarding commits, not 2`);
  // The two numbers that would have shown the wipe the moment it happened:
  // which answer was written, and how many the profile held afterwards.
  assert(commits.some((entry) => Array.isArray(entry.fields) &&
    (entry.fields as string[]).includes('seasonPhase')),
  `the commit did not record WHICH answer: ${JSON.stringify(commits[0])}`);
  assert(commits[1]!.answerCountAfter === 2,
    `the commit did not record the profile size after it: ${
      JSON.stringify(commits[1]!.answerCountAfter)}`);
  // Never the answer itself: the log leaves the device.
  const serialised = JSON.stringify(commits);
  assert(!serialised.includes('inside_mid') && !serialised.includes('In-season'),
    `an onboarding ANSWER reached the log: ${serialised}`);
});

await run('a mirror refusal survives the relaunch that hides it', async () => {
  // His export showed an empty refusal log beside a wiped profile. Part of that
  // was the unguarded publication path; the rest is that the refusal record is
  // in memory only, and he relaunched before exporting. A diagnostic that dies
  // with the process cannot describe a bug that spans one.
  releaseBuild();
  await clearAthleteActionLog();
  clearProfileMirrorRefusals();
  useProfileStore.setState({
    onboardingData: { seasonPhase: 'In-season', position: 'inside_mid' } as OnboardingData,
    isOnboardingComplete: true,
  });

  publishAcceptedProfileCompatibilityMirror({ seasonPhase: 'In-season' } as OnboardingData);

  const refusals = athleteActionLogEntries()
    .filter((entry) => entry.event === 'profile_mirror_publication_refused');
  assert(refusals.length === 1,
    `the refusal is still memory-only: ${refusals.length} in the log`);
  assert(Array.isArray(refusals[0]!.droppedAnswers) &&
    (refusals[0]!.droppedAnswers as string[]).includes('position'),
  `the logged refusal does not name what it saved: ${JSON.stringify(refusals[0])}`);
});

await run('the export is reachable without completing onboarding', async () => {
  // Sam, locked out 2026-07-30: the completion guard refused, "Finish that
  // step" dropped him to the first onboarding screen, and the only export
  // affordance lived behind a Profile tab that requires finishing the very
  // onboarding that was refusing. The log is worthless if it cannot leave the
  // device, and it cannot leave the device from a screen the athlete is
  // locked out of.
  //
  // A source pin, deliberately: a mounted-render test is not reachable in this
  // repo, and the ONLY thing that would catch this affordance being tidied
  // away is a check that it is still there.
  const { readFileSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');
  const screens = [
    ['CompleteScreen.tsx', 'the completion refusal screen'],
    ['WelcomeScreen.tsx', 'the first onboarding screen'],
  ] as const;
  for (const [file, description] of screens) {
    const source = readFileSync(
      join(__dirname, '..', 'screens', 'onboarding', file), 'utf8');
    assert(source.includes('<StoredStateExportButton'),
      `${description} (${file}) no longer offers the stored-state export — an `
      + 'athlete stuck there cannot send the evidence');
    // Never behind a build flag: this is the screen the defect strands them on.
    const rendered = source.slice(source.indexOf('<StoredStateExportButton') - 200,
      source.indexOf('<StoredStateExportButton'));
    assert(!/__DEV__\s*&&\s*$/.test(rendered.trimEnd()),
      `${description} gates the export on __DEV__ — dark on the build that has the bug`);
  }
});

await run('clearing the log clears the disk too', async () => {
  releaseBuild();
  emitAthleteActionEvent(trace(), 'athlete_action_completed', {});
  await clearAthleteActionLog();
  await flushPendingStorageWrites();

  assert(athleteActionLogEntries().length === 0, 'clearing left entries in memory');
  const raw = await asyncStorageDurable.getItem(ATHLETE_ACTION_LOG_STORAGE_KEY);
  const persisted = raw ? (JSON.parse(raw) as { entries: unknown[] }).entries : [];
  assert(persisted.length === 0,
    `clearing left ${persisted.length} entries on disk for the next export to carry`);
});

console.log(`\nOn-device action log totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}

})();

// ── Seed ──────────────────────────────────────────────────────────────────

function profile(): OnboardingData {
  return {
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seed(): string {
  const athlete = profile();
  const program: TrainingProgram = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: CURRENT_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  }));
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'action-log-test:seed',
      injuryEpisodes: [],
      temporarySourceFacts: [],
      acceptedCompositionBase: null,
      acceptedProfileSnapshot: null,
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
  return program.microcycles[1]!.startDate.slice(0, 10);
}
