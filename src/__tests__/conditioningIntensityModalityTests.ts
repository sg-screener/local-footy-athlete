/**
 * The selected typed modality owns the athlete's conditioning intensity unit.
 * This is a display census: it never selects, moves, re-doses or rewrites a
 * template, and it enumerates the authored catalogue itself so template 56
 * cannot arrive outside the guard.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — conditioning intensity is deterministic');
};

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONDITIONING_TEMPLATES,
  type ConditioningModality,
  type ConditioningTemplate,
} from '../data/conditioningTemplates';
import {
  conditioningCardPresentation,
  conditioningDisplayLines,
  conditioningDisplayText,
} from '../rules/conditioningDisplay';
import { composeConditioningRows, renderableModalities } from '../rules/conditioningSelection';
import { conditioningModeLabel, conditioningRowForDisplay } from '../utils/conditioningVisibleIdentity';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildCoachRevisionTemplateWorkout, listCoachRevisionTemplates } from '../utils/coachRevisionTemplates';
import { personalPaceLine } from '../rules/masPace';
import type { ConditioningOption, Workout } from '../types/domain';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { sourceMutation } from './support/sourceMutation';
armTotalsOrRed();

let passed = 0;
let failed = 0;
function check(label: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${label}`, error);
  }
}

type OptionMode = NonNullable<ConditioningOption['modality']>;

function optionMode(modality: ConditioningModality): {
  mode: OptionMode;
  sequence: NonNullable<ConditioningOption['modalitySequence']>;
} {
  if (modality === 'run') return { mode: 'running', sequence: ['run'] };
  if (modality === 'air_bike') return { mode: 'bike', sequence: ['air_bike'] };
  return { mode: modality, sequence: [modality] } as {
    mode: OptionMode;
    sequence: NonNullable<ConditioningOption['modalitySequence']>;
  };
}

function linesFor(template: ConditioningTemplate, mode: OptionMode) {
  return conditioningDisplayLines({ template, modality: mode } as never);
}

function intensityLine(template: ConditioningTemplate, mode: OptionMode): string {
  const line = linesFor(template, mode).find((candidate) =>
    candidate.label === 'Intensity' || candidate.label === 'Effort');
  assert.ok(line, `${template.name}/${mode} has no intensity line`);
  return `${line.label}: ${line.text}`;
}

function workoutFor(
  template: ConditioningTemplate,
  mode: OptionMode,
  sequence: NonNullable<ConditioningOption['modalitySequence']>,
): Workout {
  const exercises = composeConditioningRows(template, '2026-08-31', {
    idPrefix: `intensity-${template.name.replace(/\W+/g, '-').toLowerCase()}`,
    omitWarmup: true,
  });
  const ids = exercises.map((row) => row.id);
  return {
    id: `workout-${template.name}`,
    microcycleId: 'conditioning-intensity-census',
    dayOfWeek: 1,
    name: template.name,
    description: '',
    durationMinutes: 30,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    conditioningBlock: {
      intent: template.quality === 'flush' || template.quality === 'aerobic_capacity'
        ? 'aerobic'
        : 'high-intensity',
      options: [{
        title: template.name,
        description: '',
        exerciseIds: ids,
        modality: mode,
        modalitySequence: [...sequence],
      }],
    },
    conditioningCategory: template.quality === 'aerobic_capacity' ? 'aerobic_base' : 'vo2',
    exercises,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  } as Workout;
}

function renderedConditioningCopy(workout: Workout): string[] {
  return buildSessionTemplate(workout).items.flatMap((item) =>
    item.kind === 'exercise' && item.presentation === 'conditioning_phase'
      ? [String(item.row.notes ?? '')]
      : []);
}

console.log('\n[1] Complete authored catalogue x every permitted modality');
check('the census reaches exactly all 55 authored conditioning templates', () => {
  assert.equal(CONDITIONING_TEMPLATES.length, 55);
});

const nonRunningReceipts: Array<{ template: string; modality: string; line: string }> = [];
const runningReceipts: Array<{ template: string; line: string }> = [];
for (const template of CONDITIONING_TEMPLATES) {
  for (const modality of renderableModalities(template)) {
    const { mode } = optionMode(modality);
    const line = intensityLine(template, mode);
    if (mode === 'running') runningReceipts.push({ template: template.name, line });
    else nonRunningReceipts.push({ template: template.name, modality, line });
  }
}

check('the matrix reaches running and each machine family', () => {
  const reached = new Set(nonRunningReceipts.map((receipt) => receipt.modality));
  assert.ok(runningReceipts.length > 0);
  for (const modality of ['bike', 'air_bike', 'row', 'ski']) assert.ok(reached.has(modality), modality);
});
check('no non-running conditioning projection can display MAS', () => {
  assert.deepEqual(nonRunningReceipts.filter((receipt) => /\bMAS\b/i.test(receipt.line)), []);
});
check('every Bike, Air Bike, RowErg and SkiErg projection displays Effort: X/10', () => {
  const bad = nonRunningReceipts.filter((receipt) => !/^Effort: (?:[1-9]|10)\/10$/.test(receipt.line));
  assert.deepEqual(bad, []);
});
check('running retains each template intensity and keeps MAS where authored', () => {
  for (const receipt of runningReceipts) {
    const template = CONDITIONING_TEMPLATES.find((candidate) => candidate.name === receipt.template)!;
    const baseline = conditioningDisplayLines({ template })
      .find((line) => line.label === 'Intensity');
    assert.equal(receipt.line, `Intensity: ${baseline?.text ?? ''}`, receipt.template);
  }
  assert.ok(runningReceipts.some((receipt) => /\bMAS\b/.test(receipt.line)));
});
check('running MAS sessions still produce a personal running pace', () => {
  const withMas = runningReceipts.filter((receipt) => /\bMAS\b/.test(receipt.line));
  assert.ok(withMas.length > 0);
  assert.ok(withMas.every((receipt) => personalPaceLine({
    intensityText: receipt.line,
    answer: { seconds: 480 } as never,
    experienceLevel: '5+ years' as never,
  } as never)?.endsWith(' min/km')));
});

console.log('\n[2] Intended effort varies with the template');
const exact = (name: string, mode: OptionMode) => intensityLine(
  CONDITIONING_TEMPLATES.find((template) => template.name === name)!, mode);
check('the lived 30-Second Tempo Blocks Bike card uses its controlled effort', () => {
  assert.equal(exact('30:30 Controlled Tempo Blocks', 'bike'), 'Effort: 6/10');
});
check('flush, controlled tempo, hard aerobic and maximal work do not collapse to one rating', () => {
  assert.deepEqual([
    exact('Short Flush', 'bike'),
    exact('30:30 Controlled Tempo Blocks', 'row'),
    exact('Classic 4×4', 'ski'),
    exact('Air Bike Accelerations', 'bike'),
  ], ['Effort: 3/10', 'Effort: 6/10', 'Effort: 8/10', 'Effort: 10/10']);
});
check('mixed-ergo display also uses an effort rating and never MAS', () => {
  const template = CONDITIONING_TEMPLATES.find((candidate) =>
    renderableModalities(candidate).includes('row') && renderableModalities(candidate).includes('ski'))!;
  const line = intensityLine(template, 'mixed');
  assert.match(line, /^Effort: (?:[1-9]|10)\/10$/);
  assert.doesNotMatch(line, /\bMAS\b/);
});

check('every athlete-addable conditioning template declares typed modality and variable effort', () => {
  const definitions = listCoachRevisionTemplates().filter((definition) =>
    definition.category === 'flush' || definition.category === 'work_capacity');
  assert.equal(definitions.length, 8);
  const efforts = new Set<string>();
  for (const definition of definitions) {
    const workout = buildCoachRevisionTemplateWorkout(definition.templateId, '2026-08-31');
    const option = workout?.conditioningBlock?.options[0];
    assert.ok(option?.modality, definition.templateId);
    const copy = renderedConditioningCopy(workout!).join('\n');
    assert.match(copy, /Effort: (?:[1-9]|10)\/10/, definition.templateId);
    assert.doesNotMatch(copy, /\bMAS\b/, definition.templateId);
    efforts.add(copy.match(/Effort: ((?:[1-9]|10)\/10)/)?.[1] ?? '');
  }
  assert.ok(efforts.size >= 3, JSON.stringify([...efforts]));
});

console.log('\n[3] The production row/card path uses the same typed rule');
const tempo = CONDITIONING_TEMPLATES.find((template) =>
  template.name === '30:30 Controlled Tempo Blocks')!;
for (const [label, mode, sequence, expected] of [
  ['Bike', 'bike', ['bike'], 'Effort: 6/10'],
  ['RowErg', 'row', ['row'], 'Effort: 6/10'],
  ['SkiErg', 'ski', ['ski'], 'Effort: 6/10'],
  ['mixed ergs', 'mixed', ['row', 'ski'], 'Effort: 6/10'],
  ['Run', 'running', ['run'], '65–80% MAS'],
] as const) {
  check(`${label} typed workout reaches the shared session-card copy`, () => {
    const workout = workoutFor(tempo, mode, [...sequence]);
    const copy = renderedConditioningCopy(workout).join('\n');
    if (mode === 'running') assert.match(copy, /Intensity: 65–80% MAS/);
    else {
      assert.match(copy, new RegExp(expected.replace('/', '\\/')));
      assert.doesNotMatch(copy, /\bMAS\b/);
    }
    const row = workout.exercises[0];
    const shown = conditioningRowForDisplay(workout, row);
    const presentation = conditioningCardPresentation(
      conditioningDisplayLines({ template: tempo, modality: mode } as never),
      conditioningModeLabel(mode, [...sequence]),
    );
    assert.equal(String(shown.notes).includes(expected), true);
    assert.equal(presentation.intensity, expected);
  });
}

console.log('\n[4] Save/restart shape and catalogue order cannot affect wording');
check('JSON save and restart reconstruction preserve typed modality and exact intensity wording', () => {
  const before = workoutFor(tempo, 'row', ['row']);
  const after = JSON.parse(JSON.stringify(before)) as Workout;
  assert.deepEqual(renderedConditioningCopy(after), renderedConditioningCopy(before));
  assert.deepEqual(after.conditioningBlock?.options, before.conditioningBlock?.options);
});
function orderReceipt(catalogue: readonly ConditioningTemplate[]): Record<string, string[]> {
  return Object.fromEntries(catalogue.map((template) => [template.name,
    renderableModalities(template).map((modality) => {
      const { mode } = optionMode(modality);
      return `${modality}:${intensityLine(template, mode)}`;
    })]));
}
check('reversing all 55 catalogue rows leaves every modality/intensity result unchanged', () => {
  assert.deepEqual(orderReceipt([...CONDITIONING_TEMPLATES].reverse()), orderReceipt(CONDITIONING_TEMPLATES));
});

check('mutation bypassing the typed-modality branch recreates the Bike MAS defect', () => {
  const mutation = sourceMutation<typeof import('../rules/conditioningDisplay')>(
    require.resolve('../rules/conditioningDisplay'),
    "if (!modality || modality === 'running') return { label: 'Intensity', text: cleaned };",
    "if (true) return { label: 'Intensity', text: cleaned };",
  );
  assert.deepEqual(
    mutation.conditioningIntensityDisplayForModality('65–80% MAS', 'bike'),
    { label: 'Intensity', text: '65–80% MAS' },
  );
  assert.deepEqual(
    conditioningDisplayLines({ template: tempo, modality: 'bike' } as never)
      .find((line) => line.label === 'Effort'),
    { label: 'Effort', text: '6/10' },
  );
});

check('all visible conditioning routes still enter the one shared row/card projection', () => {
  const sessionTemplate = fs.readFileSync(path.join(__dirname, '..', 'utils', 'sessionTemplate.ts'), 'utf8');
  const rowOwner = fs.readFileSync(path.join(__dirname, '..', 'utils', 'conditioningVisibleIdentity.ts'), 'utf8');
  const displayOwner = fs.readFileSync(path.join(__dirname, '..', 'rules', 'conditioningDisplay.ts'), 'utf8');
  assert.match(sessionTemplate, /conditioningRowForDisplay\(workout, item\.row\)/);
  assert.match(sessionTemplate, /conditioningRowForDisplay\(workout, row\)/);
  assert.match(rowOwner, /conditioningWordingForModality\(row\.notes, option\.modality\)/);
  assert.match(displayOwner, /conditioningIntensityDisplayForModality\(intensity\.trim\(\), modality\)/);
});

console.log(`\nconditioning intensity modality: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log('NOT COVERED: native layout/glass, physical phones, and legacy conditioning rows with no typed modality.');
process.exitCode = failed > 0 ? 1 : 0;
