(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { CONDITIONING_TEMPLATES, type ConditioningModality } from '../data/conditioningTemplates';
import {
  assertConditioningTemplateModalityCompatibility,
  isTemplateIdentityModalityContractValid,
} from '../rules/conditioningModalityCompatibility';
import { conditioningWarmupCopyForModality } from '../rules/conditioningDisplay';
import { composeConditioningRows, offFeetAlternative } from '../rules/conditioningSelection';
import type { ConditioningOption, Workout } from '../types/domain';
import { buildSessionTemplate } from '../utils/sessionTemplate';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const optionMode = (mode: ConditioningModality): Pick<ConditioningOption, 'modality' | 'modalitySequence'> =>
  mode === 'run' ? { modality: 'running', modalitySequence: ['run'] }
    : mode === 'air_bike' ? { modality: 'bike', modalitySequence: ['air_bike'] }
      : { modality: mode, modalitySequence: [mode] };

check('all 55 templates explicitly declare a valid identity/modality contract', () => {
  assert.equal(CONDITIONING_TEMPLATES.length, 55);
  for (const template of CONDITIONING_TEMPLATES) {
    assert.equal(isTemplateIdentityModalityContractValid(template), true, template.name);
  }
});

check('every supported machine modality gets machine warm-up copy without running language', () => {
  for (const mode of ['bike', 'row', 'ski', 'mixed'] as const) {
    const copy = conditioningWarmupCopyForModality(mode);
    assert.doesNotMatch(copy, /\b(?:jog|run-throughs?)\b/i, `${mode}: ${copy}`);
  }
  assert.match(conditioningWarmupCopyForModality('running'), /jog.*run-throughs/i);
});

check('all 55 templates validate on every declared modality and reject an incompatible pair', () => {
  for (const template of CONDITIONING_TEMPLATES.filter((candidate) => candidate.automaticSelection !== 'retired')) {
    for (const mode of template.permittedModalities) {
      const typed = optionMode(mode);
      assert.doesNotThrow(() => assertConditioningTemplateModalityCompatibility({
        conditioningBlock: {
          intent: 'aerobic',
          options: [{ title: template.name, description: '', exerciseIds: ['row'], ...typed }],
        },
      }));
    }
  }
  assert.throws(() => assertConditioningTemplateModalityCompatibility({
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: '400 m Repeats', description: '', exerciseIds: ['row'], modality: 'bike', modalitySequence: ['bike'] }],
    },
  }), /conditioning_template_modality_incompatible:400 m Repeats:bike/);
});

check('running-only identities fall back to a same-quality compatible machine template', () => {
  for (const name of ['Extensive Tempo (100 m repeats)', '400 m Repeats', 'MAS 15:15 Blocks']) {
    const source = CONDITIONING_TEMPLATES.find((template) => template.name === name)!;
    const replacement = offFeetAlternative(name, '2027-03-01', ['bike']);
    assert.ok(replacement, name);
    assert.equal(replacement!.quality, source.quality, name);
    assert.ok(replacement!.permittedModalities.includes('bike') || replacement!.permittedModalities.includes('air_bike'), replacement!.name);
  }
});

check('Air Bike Accelerations reaches the final card as Air Bike with machine warm-up copy', () => {
  const template = CONDITIONING_TEMPLATES.find((candidate) => candidate.name === 'Air Bike Accelerations')!;
  const rows = composeConditioningRows(template, '2027-01-01');
  const workout = {
    id: 'air-bike-speed', microcycleId: 'week', dayOfWeek: 1, name: template.name,
    description: 'Machine conditioning witness.',
    workoutType: 'Sprint-Intervals', intensity: 'High', sessionTier: 'core',
    durationMinutes: 10, exercises: rows,
    conditioningBlock: {
      intent: 'high-intensity' as const,
      options: [{
        title: template.name, description: '', exerciseIds: rows.map((row) => row.id),
        modality: 'bike' as const, modalitySequence: ['air_bike' as const],
      }],
    },
    createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
  } satisfies Workout;
  assertConditioningTemplateModalityCompatibility(workout);
  const cards = buildSessionTemplate(workout).items.filter((item) => item.kind === 'exercise');
  assert.ok(cards.length > 0);
  assert.ok(cards.every((item) => item.kind !== 'exercise' || item.modalityLabel === 'Air Bike'));
  assert.ok(cards.every((item) => item.kind !== 'exercise' || !/\b(?:jog|run-throughs?)\b/i.test(String(item.row.notes ?? ''))));
});

console.log(`PASS ${passed} conditioning template/modality compatibility gates`);
console.log('NOT COVERED: physical iPhone, athlete-authored conditioning outside the signed 55, final PDFs');
