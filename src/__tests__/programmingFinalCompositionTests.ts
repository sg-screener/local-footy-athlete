import assert from 'node:assert/strict';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { chooseInjurySessionAdditions } from '../utils/injurySessionAdjustment';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { classifyExerciseRiskForBucket } from '../rules/injuryExerciseRisk';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { resolveComposedDose } from '../rules/composedDose';
import { decideBlockBoundaryLoads, type BlockHistorySignal } from '../rules/blockBoundaryProgression';
import { applyStrengthProgression, DEFAULT_PROGRESSION_CONTEXT } from '../utils/strengthProgressionIntegration';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const dateISO = '2026-07-15';
const profile = athleteAnswers(ARCHETYPES.find((entry) =>
  entry.id === 'male-3-experienced-gym')!);

function shoulderAdditions(): string[] {
  const environment = resolveTapSwapEnvironment({
    date: dateISO,
    profile,
    activeConstraints: [],
    readinessSignal: null,
    primaryInjury: { bucket: 'shoulder', severity: 6 },
  });
  return chooseInjurySessionAdditions({
    environment,
    profile,
    keptRowNames: [],
    pausedRowNames: ['Bench Press', 'DB Shoulder Press', 'Tricep Pushdown'],
    weekExerciseNames: ['Bench Press', 'DB Shoulder Press', 'Tricep Pushdown'],
    otherMainStrengthPatterns: ['push', 'pull'],
    excludedByAthlete: [],
    pausedCount: 3,
    originalRowCount: 6,
    injuredHalf: 'upper',
    keptSets: 0,
    dateISO,
  }).map((candidate) => candidate.name);
}

check('a limiting shoulder injury produces a nonempty lower-body and midline block', () => {
  const names = shoulderAdditions();
  assert.ok(names.length > 0, 'the final injury block was empty');
  assert.ok(names.every((name) =>
    classifyExerciseRiskForBucket(name, 'shoulder', 6) === 'good'),
  JSON.stringify(names));
  assert.ok(names.every((name) => !/tricep/i.test(name)), JSON.stringify(names));
});

check('injury composition is independent of strength catalogue order', () => {
  const before = shoulderAdditions();
  const arrays = Object.values(STRENGTH_POOLS).flatMap((pool) =>
    [pool.anchor.entries, pool.accessory.entries]);
  for (const entries of arrays) entries.reverse();
  try {
    assert.deepEqual(shoulderAdditions(), before);
  } finally {
    for (const entries of arrays) entries.reverse();
  }
});

check('shoulder-prehab keeps its authored dose instead of inheriting an ordinary accessory band', () => {
  const dose = resolveComposedDose({
    identity: 'Bottoms-Up KB Press',
    isMainLift: false,
    poolSlot: null,
    selectionSlot: 'shoulder_prehab',
    seasonPhase: 'In-season',
    offseasonSubphase: null,
    authoredFallback: [2, 15, 15],
  });
  assert.deepEqual([dose.sets, dose.repsMin, dose.repsMax], [2, 6, 8]);
  assert.equal(dose.category, 'authored_exercise');
});

check('shoulder-prehab load history is held rather than promoted as an ordinary strength lift', () => {
  const history = {
    qualifies: true,
    lastRecordedLoadByExercise: { 'Bottoms-Up KB Press': 8 },
  } as unknown as BlockHistorySignal;
  const decisions = decideBlockBoundaryLoads({
    history,
    nextBlockWorkouts: [{
      workoutType: 'Strength',
      exercises: [{
        id: 'row-bottoms-up', exerciseId: 'bottoms-up-press',
        exercise: { name: 'Bottoms-Up KB Press', category: 'strength' },
        prescribedSets: 2, prescribedRepsMin: 6, prescribedRepsMax: 8,
        prescribedWeightKg: 8,
        section18Evidence: {
          protocolVersion: 1, role: 'strength_accessory', strengthPattern: null,
          mainStrengthPattern: null, slot: 'shoulder_prehab',
          provenance: 'composer_declaration',
        },
      }],
    } as never],
  });
  assert.deepEqual(decisions.find((decision) => decision.exerciseName === 'Bottoms-Up KB Press'), {
    exerciseId: 'bottoms-up-press', exerciseName: 'Bottoms-Up KB Press',
    kind: 'history_held', previousLoadKg: 8, nextLoadKg: 8,
  });
});

check('weekly strength progression cannot overload a typed shoulder-prehab row', () => {
  const workout = {
    id: 'prehab-session', workoutType: 'Strength', exercises: [{
      id: 'row-bottoms-up', exerciseId: 'bottoms-up-press',
      exercise: { name: 'Bottoms-Up KB Press', category: 'strength' },
      prescribedSets: 2, prescribedRepsMin: 6, prescribedRepsMax: 8,
      prescribedWeightKg: 8, restSeconds: 45,
      section18Evidence: {
        protocolVersion: 1, role: 'strength_accessory', strengthPattern: null,
        mainStrengthPattern: null, slot: 'shoulder_prehab',
        provenance: 'composer_declaration',
      },
    }],
  } as never;
  const progressed = applyStrengthProgression(workout, DEFAULT_PROGRESSION_CONTEXT);
  const row = progressed.exercises[0];
  assert.deepEqual(
    [row.prescribedSets, row.prescribedRepsMin, row.prescribedRepsMax, row.prescribedWeightKg],
    [2, 6, 8, 8],
  );
  assert.equal(progressed._progressionResults?.['Bottoms-Up KB Press'], undefined);
});

console.log(`programming final composition: ${passed} passed`);
