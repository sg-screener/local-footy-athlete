/**
 * Current-format boot owns material reconstruction; saved outputs are not inputs.
 * Replaces obsolete scalar/snapshot hydration and compatibility-constraint migration.
 * NOT COVERED: native storage adapter/device launch; legacy unreadable-envelope UX.
 */
Object.assign(globalThis, { __DEV__: true });
const storage = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
} } });
const { armTotalsOrRed, totalsPrinted } = require('./support/totalsOrRed') as typeof import('./support/totalsOrRed');
armTotalsOrRed();
const { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } =
  require('./support/athleteJourney') as typeof import('./support/athleteJourney');
const { athleteAnswers, ARCHETYPES, YEAR_START } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { sourceFactLifecycle, acceptancePreservesCompilerOutput, acceptanceBoundaryMutation } =
  require('./compilerYear/sourceFacts') as typeof import('./compilerYear/sourceFacts');
const { clearFactLifecycle } = require('./compilerYear/clearFacts') as typeof import('./compilerYear/clearFacts');
const { useProgramStore, readDurableProgramStoreEnvelope } = require('../store/programStore') as typeof import('../store/programStore');
const { flushPendingStorageWrites } = require('../store/asyncStorageCompat') as typeof import('../store/asyncStorageCompat');
const { decisionLedgerEntries } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');
const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
const { visibleSignature } = require('./compilerYear/invariants') as typeof import('./compilerYear/invariants');
let passed = 0;
const failed: string[] = [];
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) { passed++; console.log('PASS', name); }
  else { failed.push(name); console.error('FAIL', name, detail ?? ''); }
}
async function main() {
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!),
    installDayISO: YEAR_START,
  }));
  check('real onboarding produced material', !installed.onboardingRefusal && !!useProgramStore.getState().currentProgram);
  for (const result of await sourceFactLifecycle({ weekStart: YEAR_START, storage })) {
    check(result.id, result.ok, result.detail);
  }
  for (const result of await clearFactLifecycle(YEAR_START, storage)) {
    check(result.id, result.ok, result.detail);
  }
  await quietAsync(() => flushPendingStorageWrites());
  const persisted = JSON.parse((await readDurableProgramStoreEnvelope()) ?? '{}');
  check('current envelope exists and contains inputs', persisted.state?.inputs?.generationAnchorISO);
  const forbidden = ['currentProgram', 'currentMicrocycle', 'todayWorkout', 'dateOverrides',
    'weekScopedOverlays', 'userRemovalConstraints', 'reversibleAdjustmentLedger'];
  check('no derived material is persisted at top level or in inputs', forbidden.every(key =>
    !(key in persisted.state) && !(key in persisted.state.inputs)));
  const snapshot = () => visibleSignature(quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START)));
  const before = snapshot();
  const ledger = JSON.stringify(decisionLedgerEntries());
  for (let index = 0; index < 2; index++) {
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check('current boot reconstructs identical material ' + index, boot.ok && snapshot() === before, boot.error);
    check('boot never rewrites athlete ledger ' + index, JSON.stringify(decisionLedgerEntries()) === ledger);
    check('acceptance never rewrites reconstructed material ' + index,
      quiet(() => acceptancePreservesCompilerOutput(YEAR_START)));
  }
  const mutation = await acceptanceBoundaryMutation();
  check(mutation.id, mutation.ok, mutation.detail);
  // A surviving calendar input must load without running a second week author.
  const { asyncStorageDurable } = require('../store/asyncStorageCompat') as typeof import('../store/asyncStorageCompat');
  const { useCalendarStore } = require('../store/calendarStore') as typeof import('../store/calendarStore');
  await flushPendingStorageWrites();
  await asyncStorageDurable.setItem('calendar-storage', JSON.stringify({
    state: { markedDays: { [YEAR_START]: 'rest' } }, version: 0,
  }));
  let publications = 0;
  const unsubscribe = useProgramStore.subscribe(() => { publications++; });
  try { await quietAsync(async () => { await useCalendarStore.persist.rehydrate(); }); }
  finally { unsubscribe(); }
  check('calendar hydration reads the persisted input', useCalendarStore.getState().markedDays[YEAR_START] === 'rest');
  check('calendar hydration cannot publish or repair program material', publications === 0, { publications });
}
main().catch(error => { failed.push(String(error)); console.error(error); }).finally(() => {
  console.log('Hydration: ' + passed + ' passed, ' + failed.length + ' failed');
  totalsPrinted(failed.length);
  if (failed.length) process.exitCode = 1;
});
