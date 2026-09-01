/** R-330 persistence tape: real onboarding, restart, accumulated Add and Undo. */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw Error('NETWORK DISABLED — fresh Speed persistence is local');
};

import { athleteAnswers } from './compilerYear/catalog';
import { visibleSignature } from './compilerYear/invariants';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { applyPlanChange } from '../utils/planChangeProducer';
import { undoLastDecision } from '../store/undoLastDecision';
import { resolveTemplateByName } from '../rules/conditioningSelection';

let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name); console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

async function main(): Promise<void> {
  const today = '2026-08-24';
  const profile = { ...athleteAnswers({ id: 'fresh-speed-persistence', gender: 'female',
    days: ['Monday', 'Wednesday', 'Thursday', 'Saturday'], experience: '5+ years',
    equipment: 'commercial', initialPhase: 'Pre-season', clubDays: [], gameDay: null,
    extraGame: false }), sprintExposure: 'No sprint training' as const };
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: today }));
  if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
  const view = () => quiet(() => deriveVisibleWeekLive(today, today));
  const speedDate = () => view().find((day) => (day.workout?.exercises ?? []).some((row) => {
    const template = resolveTemplateByName(row.exercise.name);
    return template !== null && ['acceleration', 'top_end_speed', 'repeat_sprint'].includes(template.quality);
  }))?.date ?? null;
  const original = visibleSignature(view());
  const originalSpeedDate = speedDate();
  const reboot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
  ok('13 save/restart reconstructs the identical fresh-Speed week',
    reboot.ok && originalSpeedDate !== null && visibleSignature(view()) === original
      && speedDate() === originalSpeedDate, JSON.stringify({ originalSpeedDate, reboot }));

  const target = view().find((day) => day.date !== originalSpeedDate
    && (day.workout?.exercises ?? []).length === 0)?.date;
  if (!target) throw Error('No empty day for accumulated Add/Undo tape');
  const add = (category: 'mobility' | 'recovery') => quiet(() => applyPlanChange({
    change: { kind: 'add_category', date: target, category },
    visibleWeek: view(), todayISO: today, applyOverride: () => undefined,
  }));
  const first = add('mobility');
  const afterFirst = visibleSignature(view());
  const second = add('recovery');
  const afterSecond = visibleSignature(view());
  const accumulatedRestart = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
  const undoSecond = await quietAsync(() => undoLastDecision());
  const retainedFirst = visibleSignature(view()) === afterFirst;
  const undoFirst = await quietAsync(() => undoLastDecision());
  const finalRestart = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
  ok('14 accumulated athlete changes, latest-only Undo and full restoration remain correct',
    first.ok && second.ok && afterSecond !== afterFirst && accumulatedRestart.ok
      && undoSecond.outcome === 'undone' && retainedFirst
      && undoFirst.outcome === 'undone' && finalRestart.ok
      && visibleSignature(view()) === original && speedDate() === originalSpeedDate,
    JSON.stringify({ first, second, accumulatedRestart, undoSecond, retainedFirst,
      undoFirst, finalRestart, originalSpeedDate, finalSpeedDate: speedDate() }));

  console.log(`\nFresh Speed persistence: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
}
void main();
