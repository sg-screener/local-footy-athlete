/**
 * Current fact ownership: real onboarding, accumulated facts/edits, exact Clear,
 * persistence failure and restart. The retired snapshot-delta load helpers and
 * fabricated accepted programs are not product contracts.
 * NOT COVERED: native status UI; the full eight-archetype year is a separate gate.
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
const { ARCHETYPES, athleteAnswers, YEAR_START } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { sourceFactLifecycle, injuryRenderingMutation } = require('./compilerYear/sourceFacts') as typeof import('./compilerYear/sourceFacts');
const { clearFactLifecycle } = require('./compilerYear/clearFacts') as typeof import('./compilerYear/clearFacts');
const { createTemporaryFatigueFact, createTemporaryPoorSleepFact, temporaryFactScope } = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const { transactTemporarySourceFact } = require('../store/temporarySourceFactTransaction') as typeof import('../store/temporarySourceFactTransaction');
const { applyLighterDayForToday } = require('../utils/lighterDayTransaction') as typeof import('../utils/lighterDayTransaction');
const { decisionLedgerEntries } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');
const { replayableEntries } = require('../rules/decisionLedgerReplay') as typeof import('../rules/decisionLedgerReplay');
const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
const { visibleSignature } = require('./compilerYear/invariants') as typeof import('./compilerYear/invariants');
const accepted = require('../store/acceptedStateTransaction') as typeof import('../store/acceptedStateTransaction');

let passed = 0;
const failures: string[] = [];
function check(name: string, value: unknown, detail?: unknown): void {
  if (value) { passed++; console.log('PASS', name); }
  else { failures.push(name); console.error('FAIL', name, detail ?? ''); }
}
async function install(): Promise<void> {
  storage.clear();
  const result = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!),
    installDayISO: YEAR_START,
  }));
  if (result.onboardingRefusal) throw new Error(result.onboardingRefusal);
}
const signature = () => visibleSignature(quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START)));
async function main(): Promise<void> {
  await install();
  const injury = await sourceFactLifecycle({ weekStart: YEAR_START, storage });
  check('injury/accepted-edit/failure/restart journey reached actual checks', injury.length > 0);
  for (const result of injury) check(result.id, result.ok, result.detail);
  await install();
  const clear = await clearFactLifecycle(YEAR_START, storage);
  check('exact source-fact Clear journey reached actual checks', clear.length > 0);
  for (const result of clear) check(result.id, result.ok, result.detail);

  await install();
  const baseline = signature();
  const primary = createTemporaryPoorSleepFact({
    observedDate: YEAR_START, scope: temporaryFactScope({ kind: 'date', date: YEAR_START }),
    pattern: 'single_night', sourceSurface: 'status_card',
    factId: 'current-facts:readiness-primary', now: `${YEAR_START}T08:00:00.000Z`,
  });
  await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact: primary, todayISO: YEAR_START }));
  const lighter = await quietAsync(() => applyLighterDayForToday({
    date: YEAR_START, todayISO: YEAR_START, sourceFactId: primary.factId,
  }));
  check('athlete actually accepts a lighter day from the primary fact', lighter.ok, lighter);
  const lighterSignature = signature();
  check('lighter-day witness changes real programmed dose', baseline !== lighterSignature);
  const independent = createTemporaryFatigueFact({
    observedDate: YEAR_START, scope: temporaryFactScope({ kind: 'date', date: YEAR_START }),
    athleteReportedLevel: 'slight', sourceSurface: 'status_card',
    factId: 'current-facts:independent', now: `${YEAR_START}T09:00:00.000Z`,
  });
  await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact: independent, todayISO: YEAR_START }));
  await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve', factId: independent.factId, todayISO: YEAR_START }));
  check('clearing an independent report preserves the accepted lighter-day dose', signature() === lighterSignature);
  check('lighter-day accepted input still refers to the primary report', replayableEntries(decisionLedgerEntries())
    .some(entry => entry.decision.kind === 'lighter_day' && entry.decision.acceptedEffect.sourceFactId === primary.factId));
  const ledger = JSON.stringify(decisionLedgerEntries());
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('independent Clear plus lighter-day decision survives a genuine restart', boot.ok &&
    signature() === lighterSignature && JSON.stringify(decisionLedgerEntries()) === ledger, boot);
  await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve', factId: primary.factId, todayISO: YEAR_START }));
  check('clearing the linked readiness report deactivates only its reduction', signature() === baseline);
  check('unused snapshot-delta load authors cannot return', [
    'captureAcceptedLoadEditLedgerBaseline', 'commitExplicitLoadEditLedgerFromBaseline', 'commitExplicitLoadEditTransaction',
  ].every(name => !(name in accepted)));
  const mutation = await injuryRenderingMutation();
  check(mutation.id, mutation.ok, mutation.detail);
}
main().catch(error => { failures.push(String(error)); console.error(error); }).finally(() => {
  console.log(`Temporary facts: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  if (failures.length) process.exitCode = 1;
});
