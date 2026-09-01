/** Banded 90/90 External Rotation — exact intake and existing-route coverage. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { equipmentRequiredFor, exerciseIsAvailableWith } from '../data/exerciseEquipmentRequirement';
import { SHOULDER_HEALTH_POOL } from '../data/exercisePools';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import { selectableVocabularyGroups } from '../data/selectableExerciseVocabulary';
import { movementPlaneMetadataFor } from '../data/exerciseMovementPlaneMetadata';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { flowSlotCandidates } from '../utils/mobilityPrehabFlow';
import { BAND_RESISTANCE_EXERCISES, resolveLoadControlMode } from '../utils/loadEstimation';
import { assessTapSwapCandidateSafety, type TapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { EXERCISE_DEMO_VIDEOS } from '../services/exerciseVideoService';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

const NAME = 'Banded 90/90 External Rotation';
const healthyBandEnvironment: TapSwapEnvironment = {
  experienceLevel: 'Complete beginner', gender: 'female', daysToGame: 1,
  injurySeverities: {}, primaryInjury: null,
  availableEquipment: ['bodyweight'], availableEquipmentTags: ['bands'],
  capacity: 'high', hasEquipmentConstraint: false, medicalStop: false,
};

run('the shoulder-health pool owns the inherited per-arm prescription', () => {
  const row = SHOULDER_HEALTH_POOL.find((entry) => entry.name === NAME);
  assert(row);
  assert.deepEqual({
    sets: row.sets, repsMin: row.repsMin, repsMax: row.repsMax,
    restSeconds: row.restSeconds, prescriptionType: row.prescriptionType,
    perSide: row.perSide,
  }, {
    sets: 2, repsMin: 15, repsMax: 20, restSeconds: 20,
    prescriptionType: 'reps', perSide: true,
  });
});

run('the catalogue carries the supplied muscles, cues, video and transverse plane', () => {
  assert.deepEqual(EXERCISE_MUSCLE_METADATA.find((row) => row.exercise === NAME), {
    exercise: NAME, pool: 'Shoulder health', primary: ['Shoulders'], secondary: [],
    experienceGate: 'everyone',
    note: 'Band resistance. 2 × 15–20 per arm with 20 seconds rest. Automatic in Shoulder health and upper-body warm-up slots; manual Add/Swap; not automatic in Primer. All phases and suitable at G-1 when pain-free.',
    flagged: false,
  });
  assert.deepEqual(EXERCISE_CUES[NAME], {
    primaryCue: 'Keep your elbow level with your shoulder and rotate your forearm upward.',
    secondaryCue: 'Keep ribs down; avoid shrugging or forcing the range.',
  });
  assert.equal(EXERCISE_DEMO_VIDEOS[NAME],
    'https://youtube.com/shorts/PTi9pfttH64?si=cfQmGyB75VWotbcg');
  assert.deepEqual(movementPlaneMetadataFor(NAME), {
    exercise: NAME, primaryPlane: 'transverse', secondaryPlanes: [],
  });
});

run('all supplied demand and injury ratings are exact', () => {
  const tags = EXERCISE_TAGS[NAME];
  assert(tags);
  assert.deepEqual({
    movement: tags.movement, region: tags.region, load: tags.load,
    fatigue: tags.fatigue, doms: tags.doms, stability: tags.stability,
    unilateral: tags.unilateral, eccentric: tags.eccentric, lateWeek: tags.lateWeek,
  }, {
    movement: 'isolation_upper', region: 'upper', load: 'low', fatigue: 'low',
    doms: 'low', stability: 'high', unilateral: true, eccentric: 'low', lateWeek: 'good',
  });
  assert.deepEqual(tags.injury, {
    groin: 'good', hip: 'good', quad: 'good', hamstring: 'good', knee: 'good',
    calf: 'good', 'ankle/foot': 'good', ribs: 'good', lowerBack: 'good',
    neck: 'caution', shoulder: 'caution', elbow: 'caution', 'wrist/hand': 'caution',
  });
});

run('existing band equipment and load controls are reused', () => {
  assert.deepEqual(equipmentRequiredFor(NAME), ['bands']);
  assert(exerciseIsAvailableWith(NAME, ['bodyweight', 'bands']));
  assert(!exerciseIsAvailableWith(NAME, ['bodyweight']));
  assert(BAND_RESISTANCE_EXERCISES.has(NAME));
  assert.equal(resolveLoadControlMode(NAME), 'band');
});

run('automatic shoulder-health and upper warm-up routes both reach it', () => {
  const athlete = {
    injuries: [], equipmentTags: ['bands'], daysToGame: 1,
    onboardingData: { experienceLevel: 'Complete beginner' },
  } as never;
  assert(flowSlotCandidates('shoulder_prehab', athlete)
    .some((entry) => entry.name === NAME));
  assert(exerciseProgrammingAllows(NAME, {
    route: 'automatic', experienceLevel: 'Complete beginner', daysToGame: 1,
  }));
  assert(exerciseProgrammingAllows(NAME, {
    route: 'warmup', experienceLevel: 'Complete beginner', daysToGame: 1,
  }));
  assert(!exerciseProgrammingAllows(NAME, {
    route: 'primer', experienceLevel: 'Complete beginner', daysToGame: 1,
  }));
});

run('manual Add and Swap use the same everyone-and-bands boundary', () => {
  assert(selectableVocabularyGroups().find((group) => group.id === 'shoulder_health')
    ?.names.includes(NAME));
  assert(assessTapSwapCandidateSafety(NAME, healthyBandEnvironment).safe);
  assert(!assessTapSwapCandidateSafety(NAME, {
    ...healthyBandEnvironment, availableEquipment: ['bodyweight'],
    availableEquipmentTags: ['bodyweight'],
    hasEquipmentConstraint: true,
  }).safe);
});

console.log(`\nBanded 90/90 External Rotation: passed=${passed}/6 failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
