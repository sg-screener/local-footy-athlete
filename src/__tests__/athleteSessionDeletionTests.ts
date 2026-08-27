/**
 * Current athlete removal contract: exact component/day reduction, no automatic
 * relocation, immutable fixture anchors, and exact latest-action Undo after boot.
 * Replaces retired snapshot Restore, legacy migration and hard-coded old layouts.
 * NOT COVERED: native bin/confirmation controls; those use the same accepted door.
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
const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
const { applyPlanChange } = require('../utils/planChangeProducer') as typeof import('../utils/planChangeProducer');
const { getSessionComponents } = require('../utils/sessionComponents') as typeof import('../utils/sessionComponents');
const { visibleSignature } = require('./compilerYear/invariants') as typeof import('./compilerYear/invariants');
const { decisionLedgerEntries } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');
const { pendingUndoTarget, undoLastDecision } = require('../store/undoLastDecision') as typeof import('../store/undoLastDecision');
type Scope = 'whole_day' | 'strength' | 'conditioning';
let passed = 0;
const failed: string[] = [];
const reached = new Map<Scope, number>();
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) { passed++; console.log('PASS', name); }
  else { failed.push(name); console.error('FAIL', name, detail ?? ''); }
}
const days = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
const signature = () => visibleSignature(days());
const fixtures = () => visibleSignature(days().filter(day => day.source === 'game'));
const kinds = (day: ReturnType<typeof days>[number]) => day.workout
  ? getSessionComponents(day.workout).map(component => component.kind) : [];
async function main() {
  for (const archetype of ARCHETYPES) {
    const installed = await quietAsync(() => coldStartThroughOnboarding({
      profile: athleteAnswers(archetype), installDayISO: YEAR_START,
    }));
    if (installed.onboardingRefusal) throw new Error(archetype.id + ': ' + installed.onboardingRefusal);
    const saved: { before: string; entryId: string; scope: Scope }[] = [];
    for (const scope of ['strength', 'conditioning', 'whole_day'] as const) {
      const target = days().find(day => day.source !== 'game' && day.workout?.exercises.length &&
        (scope === 'whole_day' ? !kinds(day).includes('team_training') : kinds(day).includes(scope)) &&
        (scope === 'whole_day' || kinds(day).filter(kind => ['strength', 'conditioning', 'team_training'].includes(kind)).length > 1));
      if (!target) continue; // Coverage is required across the actual generated matrix below.
      reached.set(scope, (reached.get(scope) ?? 0) + 1);
      const before = signature();
      const anchors = fixtures();
      const otherComponents = kinds(target).filter(kind => kind !== scope &&
        ['strength', 'conditioning', 'team_training'].includes(kind));
      const outcome = quiet(() => applyPlanChange({
        change: { kind: 'remove_session', date: target.date, scope },
        visibleWeek: days(), todayISO: YEAR_START, applyOverride: () => undefined,
      }));
      check(archetype.id + ' ' + scope + ' accepted', outcome.ok, outcome.message);
      if (!outcome.ok) continue;
      const changed = days().find(day => day.date === target.date)!;
      check(archetype.id + ' ' + scope + ' removed only requested content',
        scope === 'whole_day' ? !changed.workout?.exercises.length :
          !kinds(changed).includes(scope) && otherComponents.every(kind => kinds(changed).includes(kind)),
        { before: kinds(target), after: kinds(changed), date: target.date });
      check(archetype.id + ' fixture anchors unchanged', fixtures() === anchors);
      const entry = pendingUndoTarget();
      check(archetype.id + ' removal has exact accepted decision', !!entry && entry.decision.kind === 'plan_change');
      if (!entry) continue;
      saved.push({ before, entryId: entry.id, scope });
      const after = signature(); const ledger = JSON.stringify(decisionLedgerEntries());
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check(archetype.id + ' ' + scope + ' survives restart', boot.ok && signature() === after, boot.error);
      check(archetype.id + ' restart preserves ledger order', JSON.stringify(decisionLedgerEntries()) === ledger);
    }
    for (const edit of saved.reverse()) {
      const undo = await quietAsync(() => undoLastDecision());
      check(archetype.id + ' Undo reverses only latest ' + edit.scope,
        undo.outcome === 'undone' && undo.reversedEntryId === edit.entryId && signature() === edit.before, undo);
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
      check(archetype.id + ' Undo survives restart ' + edit.scope,
        boot.ok && signature() === edit.before, boot.error);
    }
  }
  for (const scope of ['strength', 'conditioning', 'whole_day'] as const)
    check('real generated matrix reaches ' + scope, (reached.get(scope) ?? 0) > 0, reached.get(scope) ?? 0);
  console.log('Removal coordinates by scope:', JSON.stringify(Object.fromEntries(reached)));
}
main().catch(error => { failed.push(String(error)); console.error(error); }).finally(() => {
  console.log('Removal: ' + passed + ' passed, ' + failed.length + ' failed');
  totalsPrinted(failed.length);
  if (failed.length) process.exitCode = 1;
});
