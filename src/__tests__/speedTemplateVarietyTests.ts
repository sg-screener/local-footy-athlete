/** R-341 — Speed variety: the Pre-season shelves rotate; the first club block asks for one authored acceleration too. */
import assert from 'node:assert/strict';
import { requiredRunningSpeedQualities } from '../rules/sprintExposureGate';
import { runningSpeedTemplatePreference } from '../rules/speedTemplates';
import { speedTemplateByName } from '../rules/conditioningSelection';

let passed = 0; const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}
const club = [1, 3];

run('a club athlete\'s first Pre-season block asks for top-end AND an authored acceleration; later blocks top-end only', () => {
  for (const week of [1, 2, 3, 4]) {
    assert.deepEqual(requiredRunningSpeedQualities({ phase: 'Pre-season', teamTrainingDays: club, phaseWeekNumber: week }),
      ['top_end_speed', 'acceleration'], `week ${week}`);
  }
  for (const week of [5, 9, 19]) {
    assert.deepEqual(requiredRunningSpeedQualities({ phase: 'Pre-season', teamTrainingDays: club, phaseWeekNumber: week }),
      ['top_end_speed'], `week ${week}`);
  }
  assert.deepEqual(requiredRunningSpeedQualities({ phase: 'In-season', teamTrainingDays: club, phaseWeekNumber: 2 }), ['top_end_speed']);
  assert.deepEqual(requiredRunningSpeedQualities({ phase: 'Pre-season', teamTrainingDays: [], phaseWeekNumber: 2 }), ['acceleration', 'top_end_speed']);
});

run('Pre-season top-end rotates the whole shelf and never repeats in consecutive weeks', () => {
  const names = [1, 2, 3, 4, 5, 6].map((week) => runningSpeedTemplatePreference({
    phase: 'Pre-season', phaseWeekNumber: week, requestedQualities: ['top_end_speed'] }));
  assert.equal(new Set(names).size, 3, names.join(' | '));
  for (let index = 1; index < names.length; index += 1) assert.notEqual(names[index], names[index - 1], names.join(' | '));
  assert.ok(names.includes('Progressive Sprint Exposure'), names.join(' | '));
});

run('a club athlete\'s first Pre-season block alternates top-end with hill and 30 m accelerations', () => {
  const names = [1, 2, 3, 4].map((week) => runningSpeedTemplatePreference({
    phase: 'Pre-season', phaseWeekNumber: week, requestedQualities: ['top_end_speed', 'acceleration'] }));
  assert.equal(speedTemplateByName(names[0]).quality, 'top_end_speed', names.join(' | '));
  assert.equal(speedTemplateByName(names[1]).quality, 'acceleration', names.join(' | '));
  assert.equal(speedTemplateByName(names[2]).quality, 'top_end_speed', names.join(' | '));
  assert.equal(speedTemplateByName(names[3]).quality, 'acceleration', names.join(' | '));
  assert.equal(new Set(names).size, 4, names.join(' | '));
  assert.ok(names.includes('Hill Acceleration') && names.includes('30 m Acceleration Reps'), names.join(' | '));
});

run('every preferred name is a real run-only Speed template', () => {
  for (const phase of ['Pre-season', 'In-season'] as const) for (const week of [1, 2, 3, 4, 5, 6, 7]) {
    for (const qualities of [['top_end_speed'], ['acceleration'], ['top_end_speed', 'acceleration']] as const) {
      const template = speedTemplateByName(runningSpeedTemplatePreference({ phase, phaseWeekNumber: week, requestedQualities: [...qualities] }));
      assert.ok(template.permittedModalities.includes('run'), template.name);
      assert.ok(template.quality === 'acceleration' || template.quality === 'top_end_speed', template.name);
    }
  }
});

run('R-311 Off-season progression and the In-season alternation are unchanged', () => {
  const off = (week: number) => runningSpeedTemplatePreference({ phase: 'Off-season', phaseWeekNumber: week, requestedQualities: ['acceleration', 'top_end_speed'] });
  assert.deepEqual([1, 3, 5, 6, 9, 10].map(off), ['10 m Acceleration Reps', '20 m Acceleration Reps', '20 m Acceleration Reps', 'Progressive Sprint Exposure', 'Fly 20 (20+20)', 'Fly 30 (30+30)']);
  const ins = (week: number) => runningSpeedTemplatePreference({ phase: 'In-season', phaseWeekNumber: week, requestedQualities: ['top_end_speed'] });
  assert.deepEqual([1, 2, 3].map(ins), ['Fly 20 (20+20)', 'Fly 30 (30+30)', 'Fly 20 (20+20)']);
});

console.log(`\nSpeed template variety: ${passed} passed / ${failures.length} failed`);
if (failures.length) process.exit(1);
