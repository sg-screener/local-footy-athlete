/**
 * Temporary kit/travel changes do not become permanent selection history.
 * Uses the current public fact transaction and restart, replacing the removed
 * trace script and its historical post-generation repair expectations.
 * NOT COVERED: native equipment/away sheets; single-session equipment swap UI.
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
const { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
const { visibleSignature } = require('./compilerYear/invariants') as typeof import('./compilerYear/invariants');
const { blockSelectionHistory } = require('../store/blockSelectionHistoryStore') as typeof import('../store/blockSelectionHistoryStore');
const { useProgramStore } = require('../store/programStore') as typeof import('../store/programStore');
const { useProfileStore } = require('../store/profileStore') as typeof import('../store/profileStore');
const { transactTemporarySourceFact } = require('../store/temporarySourceFactTransaction') as typeof import('../store/temporarySourceFactTransaction');
const { createTemporaryEquipmentFact, createTemporaryScheduleFact, temporaryFactScope } =
  require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const { getSessionComponents } = require('../utils/sessionComponents') as typeof import('../utils/sessionComponents');
const { resolveEquipmentAvailability } =
  require('../utils/equipmentAvailability') as typeof import('../utils/equipmentAvailability');
const { exerciseIsAvailableWith } = require('../data/exerciseEquipmentRequirement') as typeof import('../data/exerciseEquipmentRequirement');
const { resolveSelectedImplement } = require('../rules/selectedImplement') as typeof import('../rules/selectedImplement');
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) { passed++; console.log('PASS', name); }
  else { failures.push(name); console.error('FAIL', name, detail ?? ''); }
}
const visible = (week = YEAR_START) => quiet(() => deriveVisibleWeekLive(week, YEAR_START));
const signature = (week = YEAR_START) => visibleSignature(visible(week));
async function main() {
  const profile = athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!);
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
  if (installed.onboardingRefusal) throw new Error(installed.onboardingRefusal);
  const baseline = signature();
  const following = signature(plusDays(YEAR_START, 7));
  const selections = JSON.stringify(blockSelectionHistory());
  const answers = JSON.stringify(useProfileStore.getState().onboardingData);
  const withoutBarbell = resolveEquipmentAvailability(profile).filter(tag => tag !== 'barbell');
  const needsBarbell = visible().flatMap(day => day.workout?.exercises ?? []).find(row =>
    !exerciseIsAvailableWith(row.exercise?.name ?? '', withoutBarbell));
  check('recorded selections exist', blockSelectionHistory().length > 0);
  check('baseline reaches actual barbell work', visible().some(day => day.workout?.exercises.some(row =>
    (row.exercise?.equipmentRequired ?? []).some(requirement => /barbell/i.test(requirement)))));
  check('baseline reaches club training', visible().some(day => day.workout &&
    getSessionComponents(day.workout).some(component => component.kind === 'team_training')));
  const scope = temporaryFactScope({ kind: 'week', date: YEAR_START });
  const kit = createTemporaryEquipmentFact({ observedDate: YEAR_START, scope, mode: 'without',
    equipmentTags: ['barbell'], sourceSurface: 'status_card', factId: 'equipment-scope:kit' });
  const travel = createTemporaryScheduleFact({ observedDate: YEAR_START, scope, scheduleKind: 'travel',
    sourceSurface: 'away_this_week', factId: 'equipment-scope:trip' });
  for (const fact of [kit, travel]) {
    const result = await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact, todayISO: YEAR_START }));
    check('accepted ' + fact.factId, !['conflicted', 'safely_rejected'].includes(result.outcome), result.message);
  }
  const constraints = useProgramStore.getState().acceptedMaterialContext.activeConstraints;
  check('temporary inputs change the real visible week', signature() !== baseline);
  const unavailable = visible().flatMap(day => (day.workout?.exercises ?? []).flatMap(row => {
    const available = resolveEquipmentAvailability(profile, constraints, day.date);
    return exerciseIsAvailableWith(row.exercise?.name ?? '', available) ? [] : [{
      date: day.date, name: row.exercise?.name, requires: row.exercise?.equipmentRequired, available,
    }];
  }));
  check('every visible row respects dated kit', unavailable.length === 0, unavailable);
  check('mutation: a real barbell-only row is rejected with current kit', !!needsBarbell &&
    !exerciseIsAvailableWith(needsBarbell.exercise?.name ?? '',
      resolveEquipmentAvailability(profile, constraints, YEAR_START)));
  const rdl = visible().flatMap(day => day.workout?.exercises ?? []).find(row => row.exercise?.name === 'RDLs');
  check('the authored RDL choice reaches the dumbbell implement', !!rdl && resolveSelectedImplement({
    exerciseName: rdl.exercise!.name, availableTags: resolveEquipmentAvailability(profile, constraints, YEAR_START),
    prescribedWeightKg: rdl.prescribedWeightKg,
  }).implement === 'dumbbells');
  check('travel removes club and fixture anchors', visible().every(day =>
    day.source !== 'game' && (!day.workout || !getSessionComponents(day.workout).some(component => component.kind === 'team_training'))));
  check('travel retains athlete training', visible().some(day => day.workout?.exercises.length));
  check('temporary facts preserve permanent answers', JSON.stringify(useProfileStore.getState().onboardingData) === answers);
  check('temporary facts preserve recorded block selections', JSON.stringify(blockSelectionHistory()) === selections);
  check('unaffected following week unchanged', signature(plusDays(YEAR_START, 7)) === following);
  const away = signature();
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('temporary world survives restart', boot.ok && signature() === away, boot.error);
  check('restart does not record a temporary selection', JSON.stringify(blockSelectionHistory()) === selections);
  const resolvedTrip = await quietAsync(() => transactTemporarySourceFact({
    operation: 'resolve', factId: travel.factId, todayISO: YEAR_START }));
  check('trip resolves independently', !['conflicted', 'safely_rejected'].includes(resolvedTrip.outcome) &&
    useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts.some(fact =>
      'factId' in fact && fact.factId === kit.factId && fact.status === 'active'));
  const resolvedKit = await quietAsync(() => transactTemporarySourceFact({
    operation: 'resolve', factId: kit.factId, todayISO: YEAR_START }));
  check('clearing kit restores original accepted week', !['conflicted', 'safely_rejected'].includes(resolvedKit.outcome) && signature() === baseline);
  const restored = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('restored week survives restart', restored.ok && signature() === baseline, restored.error);
  check('all temporary changes leave permanent selection history intact', JSON.stringify(blockSelectionHistory()) === selections);
}
main().catch(error => { failures.push(String(error)); console.error(error); }).finally(() => {
  console.log('Equipment: ' + passed + ' passed, ' + failures.length + ' failed');
  totalsPrinted(failures.length);
  if (failures.length) process.exitCode = 1;
});
