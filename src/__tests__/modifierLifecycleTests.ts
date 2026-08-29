/** Real onboarding and production apply/Status-clear/restart doors, not stored output fixtures. */
(global as { __DEV__?: boolean }).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
process.env.TZ = 'Australia/Melbourne';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } from './compilerYear/catalog';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import { isShownOnProgram } from '../rules/programModifierVisibility';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { readinessActionForKind, type WeekReadinessApplyKind } from '../utils/weekReadinessActions';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { createCoachNoteActions } from '../screens/coach/useCoachNoteActions';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { createTemporaryTimeCapFact, createTemporaryEquipmentFact, createTemporaryScheduleFact, createTemporaryFatigueFact,
  temporaryFactScope } from '../rules/temporarySourceFact';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { signatureDifferences, visibleSignature } from './compilerYear/invariants';
import { applyLighterDayForToday } from '../utils/lighterDayTransaction';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import { dismissActiveCoachNote } from '../utils/activeCoachNotes';
import { executeFixtureMutationTransaction } from '../store/fixtureMutationTransaction';
import { undoLastDecision } from '../store/undoLastDecision';
import { applyPlanChange } from '../utils/planChangeProducer';
import { applyExerciseExclusionDecision } from '../utils/exerciseExclusionOwner';
import { settleDerivedWorldAfterDecision } from '../store/quiescentBoot';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import type { PlanChange } from '../utils/planChangeTypes';

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: unknown, detail = '') {
  if (condition) passed++; else failures.push(`${label}: ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}`);
}
const days = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
const signature = () => visibleSignature(days());
function snapshot() {
  const context = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
  return {
    activeConstraints: context.activeConstraints,
    temporarySourceFacts: context.temporarySourceFacts,
    sessionConstraints: useProgramStore.getState().userRemovalConstraints,
    decisionEntries: decisionLedgerEntries(),
    reversibleAdjustments: useProgramStore.getState().reversibleAdjustmentLedger.adjustments,
    athletePrefs: useAthletePreferencesStore.getState().prefs,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    onboardingData: useProfileStore.getState().onboardingData,
    todayISO: YEAR_START,
  };
}
const statusNotes = () => quiet(() => selectActiveCoachNotes(snapshot()));
const programNotes = () => quiet(() => selectActiveCoachNotes({ ...snapshot(), visibleWeekDays: days() })).filter(isShownOnProgram);
const ids = (notes: ReturnType<typeof statusNotes>) => notes.map(note => note.id).sort().join('|');
const noteForFact = (id: string) => statusNotes().find(note => note.temporarySourceFactIds?.includes(id) || note.injuryEpisodeId === id);
const factDisplayedOnEverySurface = (id: string) => !!noteForFact(id) && programNotes().some(note =>
  note.temporarySourceFactIds?.includes(id) || note.injuryEpisodeId === id);
async function fresh() {
  const result = await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(ARCHETYPES[2]), installDayISO: YEAR_START }));
  if (result.onboardingRefusal) throw new Error(result.onboardingRefusal);
  setJourneyClock(YEAR_START);
}
async function clear(id: string) {
  const note = noteForFact(id);
  if (!note) throw new Error(`No My Status row for ${id}`);
  const refusals: string[] = [];
  const actions = createCoachNoteActions({ screen: 'my_status', notes: statusNotes(),
    onResult: async result => { if (!result.ok) refusals.push(result.message ?? 'refused'); },
    notifyRefusal: (_title, message) => { refusals.push(message ?? 'refused'); } });
  await quietAsync(() => actions.clearCoachNote(note.id));
  if (refusals.length) throw new Error(refusals.join('; '));
}
async function clearNote(note: ReturnType<typeof statusNotes>[number]) {
  const results: string[] = [];
  await quietAsync(() => createCoachNoteActions({ screen: 'my_status', notes: statusNotes(),
    onResult: async result => { if (!result.ok || result.requiresRebuild) results.push(JSON.stringify(result)); },
    notifyRefusal: (_title, message) => { results.push(message ?? 'refused'); },
  }).clearCoachNote(note.id));
  if (results.length) throw new Error(results.join(';'));
}
type Case = { name: string; apply: () => Promise<string> };
function readiness(kind: WeekReadinessApplyKind): Case {
  return { name: kind, apply: async () => {
    const result = await executeProgramControlActionDurably(readinessActionForKind(kind,
      { anchorDateISO: YEAR_START, todayISO: YEAR_START }), { todayISO: YEAR_START });
    if (!result.ok || !result.createdModifierIds?.[0]) throw new Error(result.message ?? 'No fact recorded');
    return result.createdModifierIds[0];
  } };
}
const scope = temporaryFactScope({ kind: 'week', date: YEAR_START });
const factCase = (name: string, fact: Parameters<typeof transactTemporarySourceFact>[0] & { operation: 'create' }): Case => ({
  name, apply: async () => {
    const result = await transactTemporarySourceFact(fact);
    if (result.outcome === 'conflicted' || result.outcome === 'safely_rejected') throw new Error(result.message);
    return 'factId' in fact.fact ? fact.fact.factId : fact.fact.episodeId;
  },
});
const cases: Case[] = [
  ...(['flat_today', 'cooked_week', 'poor_sleep_week', 'sore_today', 'illness_moderate', 'illness_severe'] as const).map(readiness),
  factCase('time cap', { operation: 'create', todayISO: YEAR_START,
    fact: createTemporaryTimeCapFact({ observedDate: YEAR_START, scope, maxSessionMinutes: 35,
      targetKind: 'all_sessions', sourceSurface: 'status_card' }) }),
  factCase('equipment', { operation: 'create', todayISO: YEAR_START,
    fact: createTemporaryEquipmentFact({ observedDate: YEAR_START, scope, mode: 'without',
      equipmentTags: ['barbell'], sourceSurface: 'status_card' }) }),
  ...(['travel', 'no_team_training', 'unavailable_dates', 'unavailable_weekdays', 'busy_week', 'max_sessions', 'team_night_move'] as const).map(scheduleKind => factCase(scheduleKind,
    { operation: 'create', todayISO: YEAR_START, fact: createTemporaryScheduleFact({ observedDate: YEAR_START,
      scope, scheduleKind, unavailableDates: scheduleKind === 'unavailable_dates' ? [YEAR_START] : [],
      unavailableWeekdays: scheduleKind === 'unavailable_weekdays' ? ['Monday'] : [],
      maxSessions: scheduleKind === 'busy_week' || scheduleKind === 'max_sessions' ? 2 : undefined,
      teamNightFromDate: scheduleKind === 'team_night_move' ? plusDays(YEAR_START, 1) : undefined,
      teamNightToDate: scheduleKind === 'team_night_move' ? plusDays(YEAR_START, 2) : undefined,
      sourceSurface: 'status_card' }) })),
  { name: 'injury', apply: async () => {
    const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
      severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false }, { todayISO: YEAR_START });
    const result = await executeProgramControlActionDurably({ type: 'set_injury_modifier',
      source: { screen: 'my_status', surface: 'guided_injury_flow', initiatedBy: 'tap' }, scope: 'current_and_future',
      payload: { constraint }, requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false }, { todayISO: YEAR_START });
    if (!result.ok || !result.createdModifierIds?.[0]) throw new Error(result.message ?? 'No injury recorded');
    return result.createdModifierIds[0];
  } },
];
async function main() {
  for (const c of cases) {
    try {
      await fresh(); const baseline = signature();
      const id = await quietAsync(c.apply);
      check(`${c.name}/changes actual training`, signature() !== baseline);
      check(`${c.name}/My Status lists the accepted fact`, !!noteForFact(id), JSON.stringify(statusNotes()));
      check(`${c.name}/Day and Week list the accepted fact`, factDisplayedOnEverySurface(id), JSON.stringify(programNotes()));
      check(`${c.name}/all surfaces agree on rows and count`, ids(programNotes()) === ids(statusNotes()));
      const dismissed = quiet(() => selectActiveCoachNotes({ ...snapshot(), dismissedCoachNoteIds: statusNotes().map(note => note.id) }));
      check(`${c.name}/old dismissals cannot conceal active effects`, ids(dismissed) === ids(statusNotes()));
      check(`${c.name}/active restrictions cannot be dismissed`, !dismissActiveCoachNote(noteForFact(id)!.id) &&
        !noteForFact(id)!.actions.some(action => action.kind === 'dismiss_note'));
      const withoutCopy = days().map(day => ({ ...day, workout: day.workout ? { ...day.workout, coachNotes: [] } : undefined }));
      const copyIndependent = quiet(() => selectActiveCoachNotes({ ...snapshot(), visibleWeekDays: withoutCopy })).filter(isShownOnProgram);
      check(`${c.name}/removing descriptive copy cannot hide a modifier`, ids(copyIndependent) === ids(programNotes()));
      const active = signature(); const activeIds = ids(statusNotes());
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check(`${c.name}/reopen preserves training and modifier identities`, boot.ok && active === signature() && activeIds === ids(statusNotes()), boot.error);
      await clear(id);
      check(`${c.name}/My Status clear removes only its fact`, !noteForFact(id));
      check(`${c.name}/clear restores baseline training`, signature() === baseline);
      const clearedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check(`${c.name}/cleared state survives reopening`, clearedBoot.ok && !noteForFact(id) && signature() === baseline, clearedBoot.error);
    } catch (error) { check(`${c.name}/complete lifecycle`, false, String(error)); }
  }
  try {
    await fresh();
    const first = await quietAsync(readiness('cooked_week').apply);
    const second = await quietAsync(readiness('poor_sleep_week').apply);
    check('overlap/two distinct reports have independently removable rows',
      !!noteForFact(first) && !!noteForFact(second) && noteForFact(first)!.id !== noteForFact(second)!.id);
    await clear(first);
    check('overlap/clearing cooked keeps poor sleep visible and active', !noteForFact(first) && !!noteForFact(second));
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('overlap/remaining report survives reopening', boot.ok && !noteForFact(first) && !!noteForFact(second), boot.error);
    await clear(second);
  } catch (error) { check('overlap/complete lifecycle', false, String(error)); }
  try {
    await fresh(); const baseline = signature();
    const id = await quietAsync(readiness('tired_today').apply);
    const tiredSignature = signature();
    check('tired_today/is noted without changing the program',
      tiredSignature === baseline && noteForFact(id)?.effect === 'readiness_noted',
      JSON.stringify({ differences: signatureDifferences(baseline, tiredSignature), note: noteForFact(id) ?? null }));
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('tired_today/noted fact and unchanged program survive restart',
      boot.ok && signature() === baseline && noteForFact(id)?.effect === 'readiness_noted');
    await clear(id);
    check('tired_today/Status clear removes the note without changing training',
      !noteForFact(id) && baseline === signature());
  } catch (error) { check('tired_today/noted lifecycle', false, String(error)); }
  for (const kind of ['poor_sleep_today', 'illness_mild'] as const) {
    try {
      await fresh(); const baseline = signature();
      const id = await quietAsync(readiness(kind).apply);
      check(`${kind}/record-only is not claimed as a program change`, signature() === baseline && !noteForFact(id));
      const lighter = await quietAsync(() => applyLighterDayForToday({ date: YEAR_START, todayISO: YEAR_START, sourceFactId: id }));
      check(`${kind}/opt-in actually changes training`, lighter.ok && signature() !== baseline, JSON.stringify(lighter));
      check(`${kind}/opt-in has a removable My Status row`, !!noteForFact(id), JSON.stringify(statusNotes()));
      const before = signature();
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check(`${kind}/opt-in and row survive restart`, boot.ok && before === signature() && !!noteForFact(id));
      await clear(id);
      check(`${kind}/Status clear undoes the opt-in`, !noteForFact(id) && baseline === signature());
    } catch (error) { check(`${kind}/opt-in lifecycle`, false, String(error)); }
  }
  try {
    await fresh();
    const report = (factId: string) => factCase(factId, { operation: 'create', todayISO: YEAR_START,
      fact: createTemporaryFatigueFact({ observedDate: YEAR_START, scope, athleteReportedLevel: 'cooked',
        sourceSurface: 'status_card', factId }) }).apply;
    const first = await quietAsync(report('modifier-test:first'));
    const second = await quietAsync(report('modifier-test:second'));
    check('same-kind/each accepted report has its own row', first !== second && !!noteForFact(first) && !!noteForFact(second) &&
      noteForFact(first)!.id !== noteForFact(second)!.id);
    const active = signature(); const activeIds = ids(statusNotes());
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('same-kind/grouped training and separate rows survive restart', boot.ok && signature() === active && ids(statusNotes()) === activeIds);
    await clear(first);
    check('same-kind/clear targets only the selected report', !noteForFact(first) && !!noteForFact(second));
    await clear(second);
  } catch (error) { check('same-kind/complete lifecycle', false, String(error)); }
  try {
    await fresh();
    const week = useProgramStore.getState().currentProgram?.microcycles.find(week => week.deloadDoor === 'scheduled');
    check('scheduled/reaches a real compiled deload', !!week);
    if (week) {
      const visibleWeekDays = quiet(() => deriveVisibleWeekLive(week.startDate.slice(0, 10), YEAR_START));
      const notes = selectActiveCoachNotes({ ...snapshot(), compiledWeek: week, visibleWeekDays });
      check('scheduled/canonical dose metadata produces a read-only row', notes.some(note => note.effect === 'planned_lighter' && !note.actions.length));
      check('scheduled/removing canonical policy removes the row', !selectActiveCoachNotes({ ...snapshot(),
        compiledWeek: { ...week, deloadDoor: undefined, dosePolicyByDay: {} }, visibleWeekDays })
        .some(note => note.effect === 'planned_lighter'));
    }
  } catch (error) { check('scheduled/complete lifecycle', false, String(error)); }
  try {
    await fresh();
    const editDay = days().find(day => day.workout?.exercises.length && day.date > YEAR_START)!;
    const edit = quiet(() => applyPlanChange({ change: { kind: 'remove_session', date: editDay.date, scope: 'whole_day' },
      visibleWeek: days(), todayISO: YEAR_START, applyOverride: () => undefined }));
    check('accumulated/real prior session edit reached', edit.ok, edit.message);
    const sessionEdit = statusNotes().find(note => note.title === 'Session removed');
    check('session edit/accepted removal is absent from modifiers on both surfaces', !sessionEdit && ids(statusNotes()) === ids(programNotes()));
    const edited = signature();
    const id = await quietAsync(readiness('cooked_week').apply);
    await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    await clear(id);
    check('accumulated/clearing readiness preserves the prior session edit', signature() === edited);
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('accumulated/edit still preserved after restart', boot.ok && signature() === edited);
    check('session edit/restart and clearing another modifier do not expose session history', !statusNotes().some(note => note.title === 'Session removed'));
    const row = days().flatMap(day => day.workout?.exercises ?? [])[0];
    const removed = quiet(() => applyExerciseExclusionDecision({ exercise: row.exercise.name,
      scope: 'until_changed', decidedOnISO: YEAR_START }));
    await quietAsync(() => settleDerivedWorldAfterDecision());
    const excluded = statusNotes().find(note => note.excludedExercise);
    check('exclusion/accepted preference has a row on every surface', removed.ok && !!excluded && ids(statusNotes()) === ids(programNotes()));
    if (excluded) {
      await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check('exclusion/restart preserves exact row', statusNotes().some(note => note.id === excluded.id));
      await clearNote(excluded);
      check('exclusion/Status restore removes exclusion without losing session edit',
        !statusNotes().some(note => note.excludedExercise) && signature() === edited);
    }
  } catch (error) { check('accumulated/complete lifecycle', false, String(error)); }
  try {
    await fresh(); const baseline = signature();
    const date = days().find(day => day.workout?.exercises.length && day.date > YEAR_START)!.date;
    const edit = quiet(() => applyPlanChange({ change: { kind: 'remove_session', date, scope: 'whole_day' },
      visibleWeek: days(), todayISO: YEAR_START, applyOverride: () => undefined }));
    const row = statusNotes().find(note => note.title === 'Session removed');
    check('session edit/real removal is not an athlete-state modifier', edit.ok && !row);
    await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('session edit/restart does not expose session history', !statusNotes().some(note => note.title === 'Session removed'));
    const undone = await quietAsync(() => undoLastDecision());
    check('session edit/existing Undo restores baseline', undone.outcome === 'undone' && signature() === baseline);
  } catch (error) { check('session edit/complete Undo lifecycle', false, String(error)); }
  for (const kind of ['add_category', 'swap_category', 'move_session', 'add_template', 'swap_template'] as const) {
    try {
      await fresh(); const baseline = signature();
      const visibleWeek = days();
      const source = visibleWeek.find(day => !!day.workout?.exercises.length)!;
      const target = visibleWeek.find(day => (!day.workout || day.workout.workoutType === 'Rest') && day.date > YEAR_START)!;
      const date = kind.startsWith('add_') ? target.date : source.date;
      const change: PlanChange = kind === 'move_session' ? { kind, fromDate: source.date, toDate: target.date }
        : kind === 'add_template' || kind === 'swap_template' ? { kind, date, templateId: 'strength_upper_push' }
          : { kind, date, category: 'recovery' };
      const result = quiet(() => applyPlanChange({ change, visibleWeek, todayISO: YEAR_START, applyOverride: () => undefined }));
      const title = kind === 'move_session' ? 'Session moved' : kind.startsWith('add_') ? 'Session added' : 'Session swapped';
      const row = statusNotes().find(note => note.title === title);
      check(`${kind}/real edit changes training without becoming an athlete-state modifier`, result.ok && signature() !== baseline && !row,
        JSON.stringify({ result, source: source.date, target: target.date, notes: statusNotes() }));
      check(`${kind}/Program and Status agree`, ids(statusNotes()) === ids(programNotes()));
      const changed = signature();
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check(`${kind}/reopen retains exact program without a modifier`, boot.ok && signature() === changed && !statusNotes().some(note => note.title === title));
      const undone = await quietAsync(() => undoLastDecision());
      check(`${kind}/existing Undo restores baseline`, undone.outcome === 'undone' && signature() === baseline);
    } catch (error) { check(`${kind}/complete modifier lifecycle`, false, String(error)); }
  }
  try {
    await fresh();
    quiet(() => useCoachPreferencesStore.getState().setModalityPreference('4×4 VO₂ Max', { from: 'run', to: 'bike' }));
    const row = statusNotes().find(note => note.effect === 'conditioning_swapped');
    check('modality/preference has a row on both surfaces', !!row && ids(statusNotes()) === ids(programNotes()));
    if (row) {
      await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check('modality/restart retains preference row', statusNotes().some(note => note.id === row.id));
      await clearNote(row);
      check('modality/Status clear removes the saved preference', !Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length && !statusNotes().some(note => note.id === row.id));
    }
  } catch (error) { check('modality/complete preference lifecycle', false, String(error)); }
  try {
    await fresh(); const baseline = signature();
    const result = await quietAsync(() => executeFixtureMutationTransaction({ action: 'add', fixtureKind: 'practice_match',
      targetDate: plusDays(YEAR_START, 5), todayISO: YEAR_START,
      expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab', commandId: 'modifier-fixture-add' } }));
    const fixture = statusNotes().find(note => note.effect === 'week_rebuilt');
    check('fixture/accepted game change is absent from athlete-state modifiers', result.outcome === 'accepted' && !fixture,
      JSON.stringify({ result, notes: statusNotes() }));
    check('fixture/count and rows agree', ids(statusNotes()) === ids(programNotes()));
    const active = signature();
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('fixture/program survives restart without a modifier', boot.ok && signature() === active && !statusNotes().some(note => note.effect === 'week_rebuilt'));
    const undone = await quietAsync(() => undoLastDecision());
    check('fixture/existing undo restores baseline', undone.outcome === 'undone' && signature() === baseline);
  } catch (error) { check('fixture/complete lifecycle', false, String(error)); }
  try {
    await fresh();
    const future = createTemporaryTimeCapFact({ observedDate: YEAR_START,
      scope: temporaryFactScope({ kind: 'window', from: plusDays(YEAR_START, 7), until: plusDays(YEAR_START, 9) }),
      maxSessionMinutes: 35, targetKind: 'all_sessions', sourceSurface: 'status_card' });
    await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact: future, todayISO: YEAR_START }));
    check('future/accepted upcoming restriction is visible before it starts', !!noteForFact(future.factId));
    const expired = selectActiveCoachNotes({ ...snapshot(), todayISO: plusDays(YEAR_START, 10) });
    check('expiry/ended restriction is not counted as active', !expired.some(note => note.temporarySourceFactIds?.includes(future.factId)));
    await clear(future.factId);
  } catch (error) { check('future/complete lifecycle', false, String(error)); }
  try {
    await fresh(); const id = await quietAsync(cases.find(c => c.name === 'time cap')!.apply);
    const selectors = require('../utils/activeProgramModifiers') as typeof import('../utils/activeProgramModifiers');
    const original = selectors.selectActiveProgramModifiers;
    const clean = factDisplayedOnEverySurface(id); let reached = false; let rejected = false;
    selectors.selectActiveProgramModifiers = snapshot => {
      const rows = original(snapshot);
      reached ||= rows.some(row => row.effect === 'session_time_limited');
      return rows.filter(row => row.effect !== 'session_time_limited');
    };
    try { rejected = !factDisplayedOnEverySurface(id); }
    finally { selectors.selectActiveProgramModifiers = original; }
    check('mutation/hiding a real time cap kills the same visibility assertion', clean && reached && rejected && factDisplayedOnEverySurface(id));
  } catch (error) { check('mutation/complete control', false, String(error)); }
  try {
    await flushPendingStorageWrites();
    const Module = require('module'); const originalLoad = Module._load;
    Module._load = function(name: string, ...args: unknown[]) {
      if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
        getItem: async (key: string) => storage.get(key) ?? null,
      } };
      return originalLoad.call(this, name, ...args);
    };
    let persistence: typeof import('../dev/e2e/devE2EPersistence');
    try { persistence = require('../dev/e2e/devE2EPersistence'); }
    finally { Module._load = originalLoad; }
    const memory = persistence.captureDevE2EMemoryFingerprints();
    const disk = await persistence.readDevE2EPersistedFingerprints();
    check('simulator-checkpoint/compares canonical inputs not transient mirrors', persistence.fingerprintMapsMatch(memory, disk),
      Object.keys(memory).filter(key => memory[key] !== disk[key]).join(', '));
    const saved = storage.get('program-store');
    storage.delete('program-store');
    try {
      const missing = await persistence.readDevE2EPersistedFingerprints();
      check('simulator-checkpoint/mutation still catches lost canonical input', !persistence.fingerprintMapsMatch(memory, missing));
    } finally { if (saved) storage.set('program-store', saved); }
  } catch (error) { check('simulator-checkpoint/complete control', false, String(error)); }
  console.log(`\nModifier lifecycle: ${passed} passed, ${failures.length} failed across ${cases.length} restriction journeys, 3 opt-in journeys, and overlap/deload/edit/exclusion/fixture/expiry checks.`);
  failures.forEach(failure => console.log(`FAILURE ${failure}`));
  process.exit(failures.length ? 1 : 0);
}
main().catch(error => { console.error(error); process.exit(1); });
