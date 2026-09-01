/** R-333 — standalone flushes use the canonical conditioning card. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { conditioningCardPresentationFromText } from '../rules/conditioningDisplay';
import { composeConditioningRows, resolveTemplateByName } from '../rules/conditioningSelection';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

function standaloneFlush(templateName: string): any {
  const template = resolveTemplateByName(templateName);
  assert(template && template.quality === 'flush', templateName);
  const rows = composeConditioningRows(template, '2026-12-28');
  return {
    id: `flush-${templateName}`, microcycleId: 'flush-mc', dayOfWeek: 1,
    name: template.name, description: '', durationMinutes: 0, intensity: 'Light',
    workoutType: 'Recovery', sessionTier: 'recovery',
    conditioningCategory: 'aerobic_base', section18ConditioningRole: 'optional_flush',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: template.name, description: '',
        exerciseIds: rows.map((row) => row.id), modality: 'bike', modalitySequence: ['bike'] }],
    },
    exercises: rows, createdAt: '', updatedAt: '',
  };
}

function visibleCard(workout: any): unknown {
  const option = workout.conditioningBlock.options[0];
  const item = buildSessionTemplate(workout).items.find((entry) =>
    entry.kind === 'exercise' && option.exerciseIds.includes(String(entry.row.id)));
  assert(item?.kind === 'exercise');
  return {
    templateIdentity: option.title,
    presentation: item.presentation,
    modality: item.modalityLabel,
    card: conditioningCardPresentationFromText(item.row.notes ?? '', item.modalityLabel),
  };
}

const exactBikeFlush = {
  templateIdentity: 'Flush Intervals 2:1 (2 min / 1 min)',
  presentation: 'conditioning_phase',
  modality: 'Bike',
  card: {
    modality: 'Bike', structure: '4 rounds',
    workRecovery: '2 min easy / 1 min rest', recoveryDetail: null,
    intensity: 'Effort: 3/10', cue: 'Keep moving without accumulating fatigue.',
    total: '12 min total', supportsPersonalTarget: false,
  },
};

run('standalone Bike 2:1 flush retains identity, modality and complete instructions', () => {
  assert.deepEqual(visibleCard(standaloneFlush(exactBikeFlush.templateIdentity)), exactBikeFlush);
});

run('the exact standalone Bike flush presentation survives save and restart', () => {
  const stored = JSON.stringify(standaloneFlush(exactBikeFlush.templateIdentity));
  assert.deepEqual(visibleCard(JSON.parse(stored)), exactBikeFlush);
});

run('every standalone authored flush uses the same conditioning presentation route', () => {
  const flushes = CONDITIONING_TEMPLATES.filter((template) => template.quality === 'flush');
  assert(flushes.length > 1);
  for (const template of flushes) {
    const card = visibleCard(standaloneFlush(template.name)) as { presentation: string; card: {
      workRecovery: string | null; intensity: string; cue: string; total: string | null;
    } };
    assert.equal(card.presentation, 'conditioning_phase', template.name);
    assert(card.card.workRecovery, template.name);
    assert.match(card.card.intensity, /^Effort: \d+\/10$/, template.name);
    assert(card.card.cue, template.name);
    assert(card.card.total, template.name);
  }
});

run('an ordinary Recovery exercise remains on the low-load exercise route', () => {
  const workout = {
    id: 'ordinary-recovery', workoutType: 'Recovery', sessionTier: 'recovery',
    exercises: [{ id: 'breathing', exerciseOrder: 1, prescribedSets: 1,
      prescribedRepsMin: 60, prescribedRepsMax: 60,
      exercise: { id: 'breathing', name: 'Box Breathing' } }],
  };
  const item = buildSessionTemplate(workout as never).items[0];
  assert(item?.kind === 'exercise');
  assert.equal(item.presentation, 'recovery');
});

console.log(`\nStandalone flush presentation: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length) process.exit(1);
