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
import { compileInjuryConditioning } from '../rules/canonicalInjuryConditioning';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';

type Mode = 'bike' | 'row' | 'ski' | 'running' | 'mixed';
interface ModeReceipt {
  date: string;
  title: string;
  mode?: Mode;
  sequence: string[];
  rendered: Array<{ modality: string; copy: string }>;
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
      .map((item) => item.kind === 'exercise'
        ? { modality: item.modalityLabel ?? '', copy: String(item.row.notes ?? '') }
        : { modality: '', copy: '' });
    return (workout.conditioningBlock?.options ?? []).map((option) => ({
      date: day.date,
      title: option.title,
      mode: option.modality as Mode | undefined,
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
    assert.ok(before.every((receipt) => receipt.rendered.some((row) => !!row.modality)),
      JSON.stringify(before));
  });

  check('generated non-running cards show Effort out of 10 and never MAS', () => {
    const nonRunning = before.filter((receipt) => receipt.mode !== 'running');
    assert.ok(nonRunning.length > 0, JSON.stringify(before));
    assert.ok(nonRunning.every((receipt) => receipt.rendered.every((row) =>
      /Effort: (?:[1-9]|10)\/10/.test(row.copy) && !/\bMAS\b/.test(row.copy))),
    JSON.stringify(nonRunning));
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

  check('injury-adjusted conditioning uses the same typed intensity wording', () => {
    const source = quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START))
      .find((day) => day.workout?.conditioningBlock?.options.length)?.workout;
    assert.ok(source, 'the real generated week reached no conditioning workout');
    const constraint = buildGuidedInjuryConstraint({
      region: 'lower_body', area: 'Calf / Achilles', severity: 6,
      severityBand: 'moderate', adjustmentLevel: 'moderate',
      seriousSymptoms: false, triggers: ['running'],
    }, { todayISO: YEAR_START });
    const adjusted = compileInjuryConditioning({
      workout: source!, profile, dateISO: YEAR_START, constraints: [constraint],
    });
    const cards = buildSessionTemplate(adjusted).items.flatMap((item) =>
      item.kind === 'exercise' && item.presentation === 'conditioning_phase'
        ? [{ modality: item.modalityLabel ?? '', copy: String(item.row.notes ?? '') }]
        : []);
    assert.ok(cards.length > 0, JSON.stringify(adjusted.conditioningFeasibility));
    assert.ok(cards.every((card) => card.modality === 'Run'
      ? /Intensity:/.test(card.copy) && !/Effort:/.test(card.copy)
      : !!card.modality && /Effort: (?:[1-9]|10)\/10/.test(card.copy)
        && !/\bMAS\b/.test(card.copy)), JSON.stringify(cards));
  });

  const boot = await quietAsync(() => relaunchApp({ storage: durable, todayISO: YEAR_START }));
  check('conditioning modality and round sequence survive save and restart exactly', () => {
    assert.ok(boot.ok, JSON.stringify(boot));
    assert.deepEqual(receipts(), before);
  });

  const runningBase = athleteAnswers({ ...ARCHETYPES[6], extraGame: false });
  const runningProfile = {
    ...runningBase,
    equipmentAnswer: {
      ...runningBase.equipmentAnswer!,
      modalities: {},
    },
  };
  const runningInstalled = await quietAsync(() => coldStartThroughOnboarding({
    profile: runningProfile,
    installDayISO: YEAR_START,
  }));
  if (runningInstalled.onboardingRefusal) throw new Error(JSON.stringify(runningInstalled.onboardingRefusal));
  const runningBefore = receipts().filter((receipt) =>
    receipt.rendered.some((row) => row.modality === 'Run'));
  check('generated running cards retain MAS or running-native intensity wording', () => {
    assert.ok(runningBefore.length > 0, JSON.stringify(receipts()));
    assert.ok(runningBefore.every((receipt) => receipt.rendered.every((row) =>
      /Intensity:/.test(row.copy) && !/Effort:/.test(row.copy))), JSON.stringify(runningBefore));
  });
  const runningBoot = await quietAsync(() => relaunchApp({ storage: durable, todayISO: YEAR_START }));
  check('running modality and intensity wording also survive save and restart exactly', () => {
    assert.ok(runningBoot.ok, JSON.stringify(runningBoot));
    assert.deepEqual(receipts().filter((receipt) =>
      receipt.rendered.some((row) => row.modality === 'Run')), runningBefore);
  });

  console.log(`conditioning modality persistence: ${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
