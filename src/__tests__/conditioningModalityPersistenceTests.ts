(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => { durable.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import assert from 'node:assert/strict';
import { ARCHETYPES, athleteAnswers, YEAR_START } from './compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { resolveTemplateByName, renderableModalities } from '../rules/conditioningSelection';

type Mode = 'bike' | 'row' | 'ski' | 'running' | 'mixed';
interface ModeReceipt {
  date: string;
  title: string;
  mode: Mode;
  sequence: string[];
  rendered: string[];
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

function receipts(): ModeReceipt[] {
  return quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START)).flatMap((day) => {
    const workout = day.workout;
    if (!workout) return [];
    const rendered = buildSessionTemplate(workout).items
      .filter((item) => item.kind === 'exercise' && item.presentation === 'conditioning_phase')
      .map((item) => item.kind === 'exercise' ? item.modalityLabel ?? '' : '');
    return (workout.conditioningBlock?.options ?? []).map((option) => ({
      date: day.date,
      title: option.title,
      mode: option.modality as Mode,
      sequence: [...(option.modalitySequence ?? [])],
      rendered,
    }));
  });
}

async function main(): Promise<void> {
  const profile = athleteAnswers({ ...ARCHETYPES[6], extraGame: false });
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile,
    installDayISO: YEAR_START,
  }));
  if (installed.onboardingRefusal) throw new Error(JSON.stringify(installed.onboardingRefusal));

  const before = receipts();
  check('every finished conditioning option carries an explicit typed modality', () => {
    assert.ok(before.length > 0, 'the real generated week reached no conditioning option');
    assert.ok(before.every((receipt) =>
      ['bike', 'row', 'ski', 'running', 'mixed'].includes(receipt.mode)),
    JSON.stringify(before));
    assert.ok(before.every((receipt) => receipt.rendered.some(Boolean)),
      JSON.stringify(before));
  });

  check('the selected modality is permitted by the selected authored template', () => {
    for (const receipt of before) {
      const template = resolveTemplateByName(receipt.title);
      assert.ok(template, receipt.title);
      const permitted = new Set(renderableModalities(template!));
      if (receipt.mode === 'running') assert.ok(permitted.has('run'), receipt.title);
      if (receipt.mode === 'row' || receipt.mode === 'ski') assert.ok(permitted.has(receipt.mode), receipt.title);
      if (receipt.mode === 'bike') assert.ok(permitted.has('bike') || permitted.has('air_bike'), receipt.title);
      if (receipt.mode === 'mixed') {
        assert.ok(receipt.sequence.length > 1, receipt.title);
        assert.ok(receipt.sequence.every((mode) => permitted.has(mode as never)), receipt.title);
      }
    }
  });

  const boot = await quietAsync(() => relaunchApp({ storage: durable, todayISO: YEAR_START }));
  check('conditioning modality and round sequence survive save and restart exactly', () => {
    assert.ok(boot.ok, JSON.stringify(boot));
    assert.deepEqual(receipts(), before);
  });

  console.log(`conditioning modality persistence: ${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
