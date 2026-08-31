import assert from 'node:assert/strict';
import { generateProgramLocally } from '../services/api/generateProgram';
import { ARCHETYPES, athleteAnswers } from './compilerYear/catalog';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import {
  installAutomaticProgrammingSelectionTraceObserver,
  type AutomaticProgrammingSelectionTrace,
} from '../rules/programmingSelectionTrace';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const options = {
  todayISO: '2026-10-05',
  blockNumber: 2,
  microcycleLimit: 1 as const,
  selectionHistory: [],
  conditioningSelectionHistory: [],
};
const traces: AutomaticProgrammingSelectionTrace[] = [];
const profile = athleteAnswers(ARCHETYPES[2]);
const traced = generateProgramLocally(profile, { ...options, selectionTracesOut: traces });
const control = generateProgramLocally(profile, options);

check('observing compiler choices does not alter the finished program', () => {
  const normalize = (value: unknown) => JSON.parse(JSON.stringify(value, (key, field) =>
    ['createdAt', 'updatedAt'].includes(key) ? '<time>' : field));
  assert.deepEqual(normalize(traced), normalize(control));
});

check('the actual compiler emits strength, power, conditioning and mobility decisions', () => {
  assert.ok(traces.some((trace) => trace.kind === 'strength_exercise'));
  assert.ok(traces.some((trace) => trace.kind === 'power_exercise'));
  assert.ok(traces.some((trace) => trace.kind === 'conditioning_template'));
  assert.ok(traces.some((trace) => trace.kind === 'mobility_exercise'));
});

check('automatic mobility traces consider both Seated Good Morning identities', () => {
  const mobilityNames = new Set(traces.filter((trace) => trace.kind === 'mobility_exercise')
    .flatMap((trace) => trace.candidates.map((candidate) => candidate.name)));
  assert.ok(mobilityNames.has('Seated Good Morning'));
  assert.ok(mobilityNames.has('Seated Good Morning (Barbell)'));
});

check('every selected candidate is eligible, ranked first and explained', () => {
  for (const trace of traces) {
    assert.ok(trace.decisionId.length > 0);
    assert.ok(trace.need.dateISO.length > 0);
    assert.ok(trace.need.movementOrQuality.length > 0);
    assert.ok(trace.selected, trace.decisionId);
    const selected = trace.candidates.find((candidate) => candidate.name === trace.selected);
    assert.equal(selected?.eligible, true, trace.decisionId);
    assert.equal(selected?.rank, 1, trace.decisionId);
    assert.ok(trace.selectionReason.length > 0, trace.decisionId);
  }
});

check('conditioning traces carry the whole catalogue and explicit rejection reasons', () => {
  for (const trace of traces.filter((entry) => entry.kind === 'conditioning_template')) {
    assert.equal(trace.candidates.length, CONDITIONING_TEMPLATES.length);
    assert.ok(trace.candidates.some((candidate) => !candidate.eligible && candidate.rejectedBy.length > 0));
    assert.ok(trace.candidates.every((candidate) => candidate.modalities !== undefined));
  }
});

check('selected trace identities survive into final session rows', () => {
  const finalNames = new Set(traced.microcycles.flatMap((week) => week.workouts)
    .flatMap((workout) => workout.exercises)
    .map((row) => row.exercise?.name ?? ''));
  for (const trace of traces) {
    assert.ok(trace.selected && finalNames.has(trace.selected), `${trace.decisionId}:${trace.selected}`);
  }
});

check('ordinary strength seats cannot recruit a prehab identity by movement tag', () => {
  const commercialTraces: AutomaticProgrammingSelectionTrace[] = [];
  const commercialProfile = {
    ...profile,
    equipmentAnswer: presetEquipmentAnswer('commercial_gym', options.todayISO),
  };
  const program = generateProgramLocally(commercialProfile, {
    ...options,
    selectionTracesOut: commercialTraces,
  });
  const strengthCandidates = commercialTraces
    .filter((trace) => trace.kind === 'strength_exercise')
    .flatMap((trace) => trace.candidates.map((candidate) => candidate.name));
  assert.ok(!strengthCandidates.includes('Bottoms-Up KB Press'),
    'a shoulder-health identity entered the ordinary strength candidate universe');
  const squatMains = commercialTraces.filter((trace) =>
    trace.kind === 'strength_exercise'
    && trace.need.movementOrQuality === 'squat'
    && trace.need.role === 'main_strength');
  assert.ok(squatMains.length > 0, 'the commercial-gym week never asked for a squat main');
  assert.ok(squatMains.every((trace) => trace.selected !== 'Leg Press'),
    squatMains.map((trace) => trace.selected).join(', '));
  const finalNames = new Set(program.microcycles.flatMap((week) => week.workouts)
    .flatMap((workout) => workout.exercises)
    .map((row) => row.exercise?.name ?? ''));
  assert.ok(squatMains.every((trace) => !!trace.selected && finalNames.has(trace.selected)),
    'a selected squat main did not survive into the final session');
});

check('the scoped compiler observer serves store-driven audits and disposes cleanly', () => {
  const observed: AutomaticProgrammingSelectionTrace[] = [];
  const dispose = installAutomaticProgrammingSelectionTraceObserver((batch) => observed.push(...batch));
  generateProgramLocally(profile, options);
  dispose();
  const afterDispose = observed.length;
  generateProgramLocally(profile, options);
  assert.ok(afterDispose > 0);
  assert.equal(observed.length, afterDispose);
});

console.log(`programming selection trace: ${passed} passed`);
