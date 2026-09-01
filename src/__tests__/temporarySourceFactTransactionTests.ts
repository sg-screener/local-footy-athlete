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
const { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { sourceFactLifecycle, injuryRenderingMutation } = require('./compilerYear/sourceFacts') as typeof import('./compilerYear/sourceFacts');
const { clearFactLifecycle } = require('./compilerYear/clearFacts') as typeof import('./compilerYear/clearFacts');
const { createTemporaryFatigueFact, createTemporaryPoorSleepFact, temporaryFactScope } = require('../rules/temporarySourceFact') as typeof import('../rules/temporarySourceFact');
const { transactTemporarySourceFact } = require('../store/temporarySourceFactTransaction') as typeof import('../store/temporarySourceFactTransaction');
const { applyLighterDayForToday } = require('../utils/lighterDayTransaction') as typeof import('../utils/lighterDayTransaction');
const { decisionLedgerEntries } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');
const { replayableEntries } = require('../rules/decisionLedgerReplay') as typeof import('../rules/decisionLedgerReplay');
const { deriveVisibleWeekLive } = require('../utils/deriveVisibleWeek') as typeof import('../utils/deriveVisibleWeek');
const { visibleSignature } = require('./compilerYear/invariants') as typeof import('./compilerYear/invariants');
const { resolveTemplateByName, templateDurationMinutes } = require('../rules/conditioningSelection') as typeof import('../rules/conditioningSelection');
const { parseConditioningDose } = require('../rules/conditioningDose') as typeof import('../rules/conditioningDose');
const { resolveConditioningAthleteCopy } = require('../rules/conditioningAthleteCopy') as typeof import('../rules/conditioningAthleteCopy');
const accepted = require('../store/acceptedStateTransaction') as typeof import('../store/acceptedStateTransaction');

let passed = 0;
const failures: string[] = [];
function check(name: string, value: unknown, detail?: unknown): void {
  if (value) { passed++; console.log('PASS', name); }
  else { failures.push(name); console.error('FAIL', name, detail ?? ''); }
}
async function install(archetypeId = 'male-3-experienced-gym'): Promise<void> {
  storage.clear();
  const result = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(ARCHETYPES.find(athlete => athlete.id === archetypeId)!),
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

  // ACCUMULATED DEPTH 2: two accepted dated reports. This is not a fabricated
  // low-readiness snapshot; the second real action is what derives the
  // remaining-week deload. Restart replays the accepted inputs, and resolving
  // that exact second input is the readiness surface's reversible/Undo door.
  await install('male-5-two-fixtures');
  const tuesday = plusDays(YEAR_START, 1);
  const friday = plusDays(YEAR_START, 4);
  const visibleWeek = (todayISO: string) => quiet(() => deriveVisibleWeekLive(YEAR_START, todayISO));
  const fridayWorkout = (todayISO: string) => visibleWeek(todayISO)
    .find(day => day.date === friday)?.workout ?? null;
  const futureConditioningSets = (todayISO: string): number => visibleWeek(todayISO)
    .filter(day => day.date >= tuesday)
    .flatMap(day => day.workout?.exercises ?? [])
    .filter(row => row.role === 'conditioning' || row.section18Evidence?.role === 'conditioning')
    .reduce((sum, row) => sum + (row.prescribedSets ?? 0), 0);
  const futureConditioningWork = (todayISO: string): number => visibleWeek(todayISO)
    .filter(day => day.date >= tuesday)
    .flatMap(day => day.workout?.exercises ?? [])
    .filter(row => row.role === 'conditioning' || row.section18Evidence?.role === 'conditioning')
    .reduce((sum, row) => {
      const template = resolveTemplateByName(row.exercise?.name ?? '');
      if (!template) return sum;
      const approved = resolveConditioningAthleteCopy(template.name);
      const authoredCount = parseConditioningDose(approved?.setsRounds ?? template.setsRounds);
      const countRatio = authoredCount.ok
        ? Math.min(1, (row.prescribedSets ?? 1) / Math.max(1, authoredCount.quantity.max))
        : 1;
      const visibleWork = /^Work:\s*(\d+(?:\.\d+)?)\s+min\b/im.exec(row.notes ?? '');
      const authoredWork = /^(\d+(?:\.\d+)?)\s+min\b/i.exec(approved?.work ?? template.workPeriod);
      const workRatio = visibleWork && authoredWork
        ? Math.min(1, Number(visibleWork[1]) / Math.max(1, Number(authoredWork[1])))
        : 1;
      return sum + templateDurationMinutes(template) * Math.min(countRatio, workRatio);
    }, 0);
  const baselineFatigueSignature = visibleSignature(visibleWeek(tuesday));
  const baselineFriday = fridayWorkout(tuesday);
  const baselineFridayRows = baselineFriday?.exercises.length ?? 0;
  const baselineConditioningSets = futureConditioningSets(tuesday);
  check('fatigue journey reaches the normal male Friday Gunshow before the trigger',
    baselineFriday?.name === 'Gunshow' && baselineFridayRows >= 6,
    { name: baselineFriday?.name, rows: baselineFridayRows });

  const firstFatigue = createTemporaryFatigueFact({
    observedDate: YEAR_START,
    scope: temporaryFactScope({ kind: 'date', date: YEAR_START }),
    athleteReportedLevel: 'slight',
    sourceSurface: 'status_card',
    factId: 'whole-week-fatigue:first',
    now: `${YEAR_START}T08:00:00.000Z`,
  });
  await quietAsync(() => transactTemporarySourceFact({
    operation: 'create', fact: firstFatigue, todayISO: YEAR_START,
  }));
  const secondFatigue = createTemporaryFatigueFact({
    observedDate: tuesday,
    scope: temporaryFactScope({ kind: 'date', date: tuesday }),
    athleteReportedLevel: 'moderate',
    sourceSurface: 'status_card',
    factId: 'whole-week-fatigue:second',
    now: `${tuesday}T08:00:00.000Z`,
  });
  await quietAsync(() => transactTemporarySourceFact({
    operation: 'create', fact: secondFatigue, todayISO: tuesday,
  }));
  const fatigueSignature = visibleSignature(visibleWeek(tuesday));
  const fatigueFriday = fridayWorkout(tuesday);
  const fatigueFridayRows = fatigueFriday?.exercises.length ?? 0;
  check('second accepted fatigue report changes the remaining visible week',
    fatigueSignature !== baselineFatigueSignature);
  check('a full six-row Gunshow does not survive the remaining-week fatigue deload unchanged',
    fatigueFriday?.name !== 'Gunshow' || fatigueFridayRows < baselineFridayRows,
    { before: [baselineFriday?.name, baselineFridayRows], after: [fatigueFriday?.name, fatigueFridayRows] });
  const fatigueLedger = JSON.stringify(decisionLedgerEntries());
  const fatigueRestart = await quietAsync(() => relaunchApp({ storage, todayISO: tuesday }));
  check('remaining-week fatigue deload reconstructs exactly at restart',
    fatigueRestart.ok && visibleSignature(visibleWeek(tuesday)) === fatigueSignature
      && JSON.stringify(decisionLedgerEntries()) === fatigueLedger,
    fatigueRestart);
  await quietAsync(() => transactTemporarySourceFact({
    operation: 'resolve', factId: secondFatigue.factId, todayISO: tuesday,
  }));
  check('Undo/Clear of the exact triggering report restores the pre-trigger final sessions',
    visibleSignature(visibleWeek(tuesday)) === baselineFatigueSignature);

  // The game-week world above is deliberately sparse in generated
  // conditioning, so it cannot prove the conditioning half of the law. Reach a
  // second real athlete whose normal pre-season week does carry app-authored
  // conditioning, then drive the same two accepted actions through it.
  await install('male-3-experienced-gym');
  const conditioningBaselineSignature = visibleSignature(visibleWeek(tuesday));
  const conditioningBaselineSets = futureConditioningSets(tuesday);
  const conditioningBaselineWork = futureConditioningWork(tuesday);
  check('fatigue conditioning witness reaches app-authored remaining-week work',
    conditioningBaselineSets > 0, conditioningBaselineSets);
  const conditioningFirst = createTemporaryFatigueFact({
    observedDate: YEAR_START,
    scope: temporaryFactScope({ kind: 'date', date: YEAR_START }),
    athleteReportedLevel: 'slight', sourceSurface: 'status_card',
    factId: 'whole-week-conditioning:first', now: `${YEAR_START}T08:00:00.000Z`,
  });
  await quietAsync(() => transactTemporarySourceFact({
    operation: 'create', fact: conditioningFirst, todayISO: YEAR_START,
  }));
  const conditioningSecond = createTemporaryFatigueFact({
    observedDate: tuesday,
    scope: temporaryFactScope({ kind: 'date', date: tuesday }),
    athleteReportedLevel: 'moderate', sourceSurface: 'status_card',
    factId: 'whole-week-conditioning:second', now: `${tuesday}T08:00:00.000Z`,
  });
  await quietAsync(() => transactTemporarySourceFact({
    operation: 'create', fact: conditioningSecond, todayISO: tuesday,
  }));
  check('remaining-week fatigue deload reduces visible conditioning work',
    futureConditioningWork(tuesday) < conditioningBaselineWork,
    { beforeSets: conditioningBaselineSets, afterSets: futureConditioningSets(tuesday),
      beforeEstimatedMinutes: conditioningBaselineWork,
      afterEstimatedMinutes: futureConditioningWork(tuesday),
      afterRows: visibleWeek(tuesday).filter(day => day.date >= tuesday)
        .flatMap(day => (day.workout?.exercises ?? []).filter(row =>
          row.role === 'conditioning' || row.section18Evidence?.role === 'conditioning')
          .map(row => ({ date: day.date, name: row.exercise?.name, sets: row.prescribedSets,
            notes: row.notes }))) });
  const conditioningFatigueSignature = visibleSignature(visibleWeek(tuesday));
  const conditioningRestart = await quietAsync(() => relaunchApp({ storage, todayISO: tuesday }));
  check('conditioning reduction reconstructs exactly at restart',
    conditioningRestart.ok
      && visibleSignature(visibleWeek(tuesday)) === conditioningFatigueSignature,
    conditioningRestart);
  await quietAsync(() => transactTemporarySourceFact({
    operation: 'resolve', factId: conditioningSecond.factId, todayISO: tuesday,
  }));
  check('conditioning Undo/Clear restores the same pre-trigger sessions',
    visibleSignature(visibleWeek(tuesday)) === conditioningBaselineSignature);

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
