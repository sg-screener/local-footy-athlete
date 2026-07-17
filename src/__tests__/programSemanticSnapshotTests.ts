/**
 * Canonical domain-local semantic projection invariants.
 * Run: npm run test:program-semantic-snapshot
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  diffSemanticDays,
  projectSemanticComponentsForDomain,
  semanticFingerprint,
  type SemanticComponentSnapshot,
  type SemanticDaySnapshot,
  type SemanticExerciseSnapshot,
  type SemanticWorkoutSnapshot,
} from '../utils/programSemanticSnapshot';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  fail += 1;
  failures.push(`${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  console.error(`  FAIL ${name}`, detail ?? '');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function exercise(
  identity: string,
  order: number,
  overrides: Partial<SemanticExerciseSnapshot> = {},
): SemanticExerciseSnapshot {
  return {
    identity,
    exerciseId: identity,
    name: identity,
    order,
    sets: 3,
    repsMin: 6,
    repsMax: 8,
    weightKg: 40,
    restSeconds: 90,
    prescriptionType: 'reps',
    strengthIntensity: 'Moderate',
    itemDurationMinutes: null,
    equipment: ['Dumbbell'],
    ...overrides,
  };
}

function component(
  kind: SemanticComponentSnapshot['kind'],
  order: number,
  overrides: Partial<SemanticComponentSnapshot> = {},
): SemanticComponentSnapshot {
  const rows = kind === 'strength'
    ? [exercise('back-squat', 0)]
    : kind === 'conditioning'
      ? [exercise('assault-bike', 4, {
          sets: 6,
          repsMin: 30,
          repsMax: 30,
          weightKg: null,
          restSeconds: 60,
          prescriptionType: 'duration',
          strengthIntensity: 'Hard',
          itemDurationMinutes: 0.5,
          equipment: ['Assault Bike'],
        })]
      : [];
  return {
    identity: `${kind}-component`,
    kind,
    order,
    intensity: kind === 'conditioning' ? 'Hard' : 'Moderate',
    durationMinutes: kind === 'conditioning' ? 18 : null,
    exerciseIds: rows.map((row) => row.exerciseId),
    exercises: rows,
    metadata: { modality: kind === 'conditioning' ? 'assault_bike' : kind },
    ...overrides,
  };
}

function workout(components: SemanticComponentSnapshot[]): SemanticWorkoutSnapshot {
  return {
    identity: 'mixed-workout',
    workoutType: 'Strength',
    durationMinutes: 70,
    strengthIntensity: 'Moderate',
    conditioningIntensity: 'Hard',
    components,
    exercises: components.flatMap((entry) => entry.exercises),
    presentation: {
      title: 'Mixed session',
      description: 'Strength plus conditioning, power and recovery',
      sessionTier: 'core',
      coachNotes: [],
      conditioningLabels: ['Assault Bike Sprints'],
    },
  };
}

function day(value: SemanticWorkoutSnapshot): SemanticDaySnapshot {
  return { date: '2026-07-20', workout: value };
}

console.log('\n[1] domain-local top-level order is canonical');
const beforeComponents = [
  component('strength', 0),
  component('conditioning', 1),
  component('power', 2, { metadata: { kind: 'primer', sets: 2 } }),
  component('recovery', 3, { metadata: { focus: 'adductors', durationMinutes: 8 } }),
];
const afterComponents = beforeComponents.slice(1).map((entry, order) => ({
  ...clone(entry),
  order,
}));
const beforeWorkout = workout(beforeComponents);
const afterWorkout = workout(afterComponents);

for (const domain of ['conditioning', 'power', 'recovery'] as const) {
  const before = projectSemanticComponentsForDomain(beforeWorkout, domain);
  const after = projectSemanticComponentsForDomain(afterWorkout, domain);
  check(`${domain} projection starts at domain-local order zero`,
    before[0]?.order === 0 && after[0]?.order === 0,
    { before, after });
  check(`${domain} survives unrelated global renumbering`,
    semanticFingerprint(before) === semanticFingerprint(after),
    { before, after });
}

const projectedConditioning = projectSemanticComponentsForDomain(beforeWorkout, 'conditioning')[0];
check('component identity, dose, intensity and metadata are preserved',
  projectedConditioning.identity === beforeComponents[1].identity &&
    projectedConditioning.durationMinutes === beforeComponents[1].durationMinutes &&
    projectedConditioning.intensity === beforeComponents[1].intensity &&
    semanticFingerprint(projectedConditioning.metadata) ===
      semanticFingerprint(beforeComponents[1].metadata));
check('exercise identity, ordering, modality and prescription are preserved',
  semanticFingerprint(projectedConditioning.exercises) ===
    semanticFingerprint(beforeComponents[1].exercises) &&
    projectedConditioning.exercises[0].order === 4 &&
    projectedConditioning.exercises[0].equipment[0] === 'Assault Bike' &&
    projectedConditioning.exercises[0].prescriptionType === 'duration');
check('projection does not mutate the globally ordered source',
  beforeWorkout.components.map((entry) => entry.order).join(',') === '0,1,2,3');

console.log('\n[2] global semantic owners retain global order');
const beforeGlobal = semanticFingerprint(beforeWorkout.components);
const afterGlobal = semanticFingerprint(afterWorkout.components);
check('all-component fingerprints retain global top-level order', beforeGlobal !== afterGlobal);
check('whole-session fingerprints retain global top-level order',
  semanticFingerprint(beforeWorkout) !== semanticFingerprint(afterWorkout));
const globalDiff = diffSemanticDays(day(beforeWorkout), day(afterWorkout));
check('full semantic diff still observes the removed strength component',
  globalDiff.hasProgrammingChange &&
    globalDiff.changes.some((change) =>
      change.path.includes('strength-component')),
  globalDiff.changes);

console.log('\n[3] genuine protected-domain changes remain semantic');
const conditioning = projectSemanticComponentsForDomain(beforeWorkout, 'conditioning');
const negativeControls: Array<[string, (candidate: SemanticComponentSnapshot) => void]> = [
  ['component identity', (candidate) => { candidate.identity = 'different-conditioning'; }],
  ['duration', (candidate) => { candidate.durationMinutes = 19; }],
  ['intensity', (candidate) => { candidate.intensity = 'Moderate'; }],
  ['metadata', (candidate) => { candidate.metadata = { modality: 'rower' }; }],
  ['exercise identity', (candidate) => { candidate.exercises[0].identity = 'rower'; }],
  ['exercise modality', (candidate) => { candidate.exercises[0].equipment = ['Rower']; }],
  ['exercise prescription', (candidate) => { candidate.exercises[0].restSeconds = 45; }],
  ['exercise order', (candidate) => { candidate.exercises[0].order = 5; }],
];
for (const [name, mutate] of negativeControls) {
  const changed = clone(conditioning);
  mutate(changed[0]);
  check(`${name} change is not normalized away`,
    semanticFingerprint(changed) !== semanticFingerprint(conditioning));
}

console.log(`\nprogramSemanticSnapshotTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
