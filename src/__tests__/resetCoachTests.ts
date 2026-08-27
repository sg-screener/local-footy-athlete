/**
 * Full reset against a real onboarded, edited athlete. Individual adjustment
 * Clear is covered by compilerYear/sourceFacts and clearFacts, not a second
 * snapshot/surgical reset API. NOT COVERED: native confirmation UI/device.
 */
Object.assign(globalThis, { __DEV__: true });
const memory = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
  clear: () => { memory.clear(); },
} } });
const { armTotalsOrRed, totalsPrinted } = require('./support/totalsOrRed') as typeof import('./support/totalsOrRed');
armTotalsOrRed();
const { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } =
  require('./support/athleteJourney') as typeof import('./support/athleteJourney');
const { athleteAnswers, ARCHETYPES, YEAR_START } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { sourceFactLifecycle } = require('./compilerYear/sourceFacts') as typeof import('./compilerYear/sourceFacts');
const reset = require('../utils/resetCoach') as typeof import('../utils/resetCoach');
const { useProgramStore, readDurableProgramStoreEnvelope } = require('../store/programStore') as typeof import('../store/programStore');
const { flushPendingStorageWrites } = require('../store/asyncStorageCompat') as typeof import('../store/asyncStorageCompat');
const { useProfileStore } = require('../store/profileStore') as typeof import('../store/profileStore');
const { decisionLedgerEntries } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');
const { blockSelectionHistory } = require('../store/blockSelectionHistoryStore') as typeof import('../store/blockSelectionHistoryStore');
const { useWorkoutLogStore } = require('../store/workoutLogStore') as typeof import('../store/workoutLogStore');
const { useJournalNoteStore } = require('../store/journalNoteStore') as typeof import('../store/journalNoteStore');
const { createOrUpdateInjuryEpisode } = require('../store/injuryEpisodeTransaction') as typeof import('../store/injuryEpisodeTransaction');
const { buildGuidedInjuryConstraint } = require('../utils/guidedInjuryControl') as typeof import('../utils/guidedInjuryControl');
const { useCalendarStore } = require('../store/calendarStore') as typeof import('../store/calendarStore');
const { executeFixtureMutationTransaction } = require('../store/fixtureMutationTransaction') as typeof import('../store/fixtureMutationTransaction');

let passed = 0;
const failed: string[] = [];
function check(name: string, value: unknown, detail?: unknown) {
  if (value) { passed++; console.log('PASS', name); }
  else { failed.push(name); console.error('FAIL', name, detail ?? ''); }
}
async function install() {
  memory.clear();
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!),
    installDayISO: YEAR_START,
  }));
  if (installed.onboardingRefusal) throw new Error(installed.onboardingRefusal);
}
function emptyMaterial() {
  const state = useProgramStore.getState();
  return !state.currentProgram && !state.currentMicrocycle && !state.todayWorkout &&
    !state.generationAnchorISO && !state.hydratedSeasonPhaseClock &&
    !Object.keys(state.dateOverrides).length && !Object.keys(state.weekScopedOverlays).length &&
    !state.acceptedMaterialContext.temporarySourceFacts.length;
}
async function main() {
  await install();
  const journey = await sourceFactLifecycle({ weekStart: YEAR_START, storage: memory });
  check('real accumulated edit/injury/restart journey reached', journey.length > 0 && journey.every(result => result.ok));
  const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
    severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false,
  }, { todayISO: YEAR_START });
  const injury = await quietAsync(() => createOrUpdateInjuryEpisode({ constraint,
    sourceActor: 'athlete', sourceSurface: 'status_card', todayISO: YEAR_START }));
  check('active injury exists before reset', !!injury.episodeId);
  check('decisions and selections exist before reset', decisionLedgerEntries().length > 0 && blockSelectionHistory().length > 0);
  const workout = useProgramStore.getState().currentProgram?.microcycles.flatMap(week => week.workouts)
    .find(workout => workout.exercises.length);
  if (!workout) throw new Error('No real workout for reset/log witness');
  useWorkoutLogStore.getState().startWorkout(workout);
  check('real workout is active before reset', !!useWorkoutLogStore.getState().activeWorkout);
  quiet(() => reset.resetProgramAndOnboarding());
  check('all compiled material and generation anchors cleared', emptyMaterial());
  check('decision and selection histories cleared', !decisionLedgerEntries().length && !blockSelectionHistory().length);
  check('logs and notes cleared', !useWorkoutLogStore.getState().activeWorkout && !useJournalNoteStore.getState().notes.length);
  check('profile returns to onboarding', !useProfileStore.getState().onboardingData.firstName);
  await quietAsync(() => flushPendingStorageWrites());
  const persisted = JSON.parse((await readDurableProgramStoreEnvelope()) ?? '{}');
  const inputs = persisted.state?.inputs;
  check('durable reset contains no stale anchor, clock or fact', inputs && !inputs.generationAnchorISO &&
    !inputs.seasonPhaseClock && !inputs.temporarySourceFacts.length, inputs);
  const boot = await quietAsync(() => relaunchApp({ storage: memory, todayISO: YEAR_START }));
  check('restart cannot resurrect reset material', boot.ok && emptyMaterial() && !decisionLedgerEntries().length, boot);
  quiet(() => reset.resetProgramAndOnboarding());
  check('repeated full reset is idempotent', emptyMaterial());
  check('retired surgical reset and raw override clearing APIs stay absent',
    !('clearCoachAdjustments' in reset) && !('removeManualOverride' in useProgramStore.getState()) &&
    !('clearManualOverrides' in useProgramStore.getState()));

  await install();
  const fixture = await quietAsync(() => executeFixtureMutationTransaction({
    action: 'add', fixtureKind: 'practice_match', targetDate: YEAR_START,
    todayISO: YEAR_START,
    expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
    source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'reset-calendar-witness' },
  }));
  check('calendar reset witness reaches an accepted fixture', fixture.outcome === 'accepted' &&
    Object.keys(useCalendarStore.getState().markedDays).length > 0, fixture.outcome);
  const beforeCalendarReset = useProgramStore.getState().currentProgram;
  let programPublications = 0;
  const stopWatching = useProgramStore.subscribe(() => { programPublications++; });
  quiet(() => useCalendarStore.getState().clear());
  check('calendar reset clears only its inputs, never rebuilds a partial world',
    !Object.keys(useCalendarStore.getState().markedDays).length && programPublications === 0 &&
    useProgramStore.getState().currentProgram === beforeCalendarReset, { programPublications });
  // A competing reset author must be observed even when it publishes the same
  // program reference. The signal measures the write, not just final equality.
  useProgramStore.setState({ currentProgram: beforeCalendarReset });
  check('mutation: even an identity program publication trips the reset observer', programPublications > 0);
  stopWatching();
  quiet(() => reset.resetProgramAndOnboarding());

  await install();
  check('reset mutation starts with real generated content', !!useProgramStore.getState().currentProgram);
  const state = useProgramStore.getState();
  quiet(() => reset.resetProgramAndOnboarding({ deps: { programStore: {
    getDateOverrides: () => state.dateOverrides, getOverrideContexts: () => state.overrideContexts,
    clear: () => undefined,
  } } }));
  check('mutation: skipping program reset is detected', !emptyMaterial());
  quiet(() => reset.resetProgramAndOnboarding());

  const profile = reset.buildDevPostOnboardingResetProfile({ firstName: 'Riley', trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Saturday'] });
  check('dev profile retains athlete answers and fills missing defaults', profile.firstName === 'Riley' &&
    profile.trainingDaysPerWeek === 6 && profile.position === 'inside_mid' &&
    profile.preferredTrainingDays?.join(',') === 'Monday,Saturday');
  let refused = false;
  try { await reset.resetToDevPostOnboardingState({ deps: { isDev: () => false } }); }
  catch { refused = true; }
  check('dev reset is unavailable in release builds', refused);
}
main().catch(error => { failed.push(String(error)); console.error(error); }).finally(() => {
  console.log(`Reset: ${passed} passed, ${failed.length} failed`);
  totalsPrinted(failed.length);
  if (failed.length) process.exitCode = 1;
});
