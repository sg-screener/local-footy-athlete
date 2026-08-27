/**
 * Repairs are derived, never new athlete decisions.
 * Real onboarding -> accepted Add -> legacy rest-fact ingress -> restart.
 * The retired test seeded dateOverrides directly (no accepted ledger effect),
 * so its alleged athlete edit could not be reconstructed. Keep the ownership
 * claim, but exercise the actual author and prove the acceptance detector lives.
 */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START } from './compilerYear/catalog';
import { calendarActionsForTest } from './support/calendarActionsForTest';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { applyPlanChange } from '../utils/planChangeProducer';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import { useProgramStore } from '../store/programStore';
import { acceptancePreservesCompilerOutput, acceptanceBoundaryMutation } from './compilerYear/sourceFacts';

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) passed++; else failures.push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`);
}
async function main() {
  for (const edited of [false, true]) {
    await quietAsync(() => coldStartThroughOnboarding({
      profile: athleteAnswers(ARCHETYPES[2]), installDayISO: YEAR_START,
    }));
    const read = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const original = read();
    const restDate = original.find(day => day.workout?.strengthIntent)?.date;
    const editDate = original.find(day => !day.workout || day.workout.workoutType === 'Rest')?.date;
    check(`${edited}: witness reaches generated training and empty days`, !!restDate && !!editDate && restDate !== editDate);
    if (!restDate || !editDate) throw new Error('unreached day shapes');
    if (edited) {
      const add = quiet(() => applyPlanChange({ change: { kind: 'add_template', date: editDate,
        templateId: 'strength_upper_push' }, visibleWeek: read(), todayISO: YEAR_START,
        applyOverride: () => undefined }));
      check('actual athlete Add is accepted', add.ok, JSON.stringify(add));
    }
    const authored = read().find(day => day.date === editDate)?.workout;
    const authoredIds = authored?.exercises.map(row => row.exerciseId) ?? [];
    const ledger = JSON.stringify(decisionLedgerEntries());
    const authoredDates = Object.keys(useProgramStore.getState().dateOverrides);
    quiet(() => calendarActionsForTest().setRestDay(restDate));
    check(`${edited}: legacy rest input does not invent athlete decisions`,
      JSON.stringify(decisionLedgerEntries()) === ledger &&
      Object.keys(useProgramStore.getState().dateOverrides).every(date => authoredDates.includes(date)));
    check(`${edited}: rendered week honours the rest fact`, !read().find(day => day.date === restDate)?.workout);
    if (edited) check('later rest fact preserves actual accepted content',
      authoredIds.length > 0 && JSON.stringify(read().find(day => day.date === editDate)?.workout?.exercises.map(row => row.exerciseId))
        === JSON.stringify(authoredIds));
    check(`${edited}: acceptance validates without authoring material`, quiet(() => acceptancePreservesCompilerOutput(YEAR_START)));
    const beforeRestart = visibleSignature(read());
    const cold = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check(`${edited}: rest and accepted edit reconstruct exactly`, cold.ok && visibleSignature(read()) === beforeRestart, cold.error);
  }
  const mutation = await acceptanceBoundaryMutation();
  check('mutation: an injected acceptance author is detected on real rows', mutation.ok, mutation.detail);
  console.log(`Derived repair ownership: ${passed} passed; ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
