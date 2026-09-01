import assert from 'node:assert/strict';
import { generateProgramLocally } from '../services/api/generateProgram';
import { ARCHETYPES, athleteAnswers } from './compilerYear/catalog';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import {
  installAutomaticProgrammingSelectionTraceObserver,
  type AutomaticProgrammingSelectionTrace,
} from '../rules/programmingSelectionTrace';
import { programmingAuditCatalogueIdentity } from '../rules/programmingAuditIdentity';

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

check('automatic mobility traces consider one canonical Seated Good Morning identity', () => {
  const mobilityNames = new Set(traces.filter((trace) => trace.kind === 'mobility_exercise')
    .flatMap((trace) => trace.candidates.map((candidate) => candidate.name)));
  assert.ok(mobilityNames.has('Seated Good Morning'));
  assert.ok(!mobilityNames.has('Seated Good Morning (Barbell)'));
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

check('audit catalogue identity is independent from athlete-facing display copy', () => {
  const identities = [
    'SL 45° Back Extension Hold', 'SL 45° Back Extension',
    'Single-Leg Squat (to Box)', 'Banded TKE', 'Copenhagen Plank (Half)',
    'Swiss Ball Hamstring Curl', 'Lateral Bounds', 'Single-Arm DB Floor Press',
    'Single-Arm DB Bench Press', 'Half-Kneeling Single-Arm Overhead Press',
    'Single-Arm Lat Pulldown', 'Explosive Push-up', 'Woodchop (Half Kneeling)',
    'Stir the Pot', 'McGill Sit Up', 'Suitcase Carry', 'Banded External Rotation',
    'Bicep Curl (Barbell)', 'Bicep Curl (Dumbbell)', 'Banded Tricep Pushdown',
    '30 s Very Hard Repeats', 'Two-Minute Repeats', '1 km Repeats',
    '400 m Repeats', 'Controlled 10–20 min Blocks', 'Steady 5 min Blocks',
    'Extensive Tempo (100 m repeats)', '2 min On / 1 min Easy',
    '1 min On / 1 min Easy Tempo',
  ];
  for (const identity of identities) {
    assert.equal(programmingAuditCatalogueIdentity({
      name: `Athlete copy is allowed to differ: ${identity}`,
      catalogueIdentity: identity,
    }), identity);
  }
  assert.equal(programmingAuditCatalogueIdentity({
    name: 'Face Pull', catalogueIdentity: 'Face Pulls',
  }), 'Face Pull');
});

check('audit refuses a visible row whose raw catalogue identity was discarded', () => {
  assert.throws(() => programmingAuditCatalogueIdentity({ name: 'Single-Leg Box Squat' }),
    /missing catalogueIdentity/);
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
