/** T-Bar Tib Raises — exact intake, equipment and progression coverage. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { equipmentRequiredFor, exerciseIsAvailableWith } from '../data/exerciseEquipmentRequirement';
import { LOWER_PREHAB_POOL } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import { movementPlaneMetadataFor } from '../data/exerciseMovementPlaneMetadata';
import { selectableVocabularyGroups } from '../data/selectableExerciseVocabulary';
import { EQUIPMENT_TAG_LABELS, derivedEquipmentChecklistTags } from '../rules/equipmentVocabulary';
import {
  EQUIPMENT_EXERCISE_PROGRESSIONS,
  exerciseVariationFamily,
} from '../rules/exerciseVariationFamily';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import {
  ATHLETE_CHOSEN_LOAD_EXERCISES,
  resolveLoadAuthority,
  resolveLoadControlMode,
} from '../utils/loadEstimation';
import { filterPoolEntriesForAthlete } from '../utils/sessionBuilder';
import { resolveSelectedImplement, selectedImplementLabel } from '../rules/selectedImplement';
import { assessTapSwapCandidateSafety, getTapSwapChoices, type TapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { EXERCISE_DEMO_VIDEOS } from '../services/exerciseVideoService';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

const NAME = 'T-Bar Tib Raises';
const BASE = 'Tib Raises';
const mutation = process.env.LFA_TIB_BAR_MUTATION;
if (mutation === 'progression') {
  (EQUIPMENT_EXERCISE_PROGRESSIONS[0] as { source: string }).source = 'Calf Raises';
}
const healthyEnvironment: TapSwapEnvironment = {
  experienceLevel: 'Complete beginner', gender: 'female', daysToGame: 1,
  injurySeverities: {}, primaryInjury: null,
  availableEquipment: [], availableEquipmentTags: ['bodyweight', 'tib_bar'],
  capacity: 'high', hasEquipmentConstraint: false, medicalStop: false,
};

run('the lower-prehab and strength pools carry the inherited bodyweight dose', () => {
  const row = LOWER_PREHAB_POOL.find((entry) => entry.name === NAME);
  assert(row);
  assert.deepEqual({
    sets: row.sets, repsMin: row.repsMin, repsMax: row.repsMax,
    restSeconds: row.restSeconds, prescriptionType: row.prescriptionType,
    perSide: !!row.perSide,
  }, {
    sets: 2, repsMin: 15, repsMax: 20, restSeconds: 30,
    prescriptionType: 'reps', perSide: false,
  });
  assert(STRENGTH_POOLS.isolation_lower.accessory.entries.some((entry) =>
    entry.name === NAME && entry.loadRatio === 0 && entry.group === 'calf'));
});

run('the catalogue carries the supplied muscles, cues, video and sagittal plane', () => {
  assert.deepEqual(EXERCISE_MUSCLE_METADATA.find((row) => row.exercise === NAME), {
    exercise: NAME, pool: 'Accessories lower', primary: ['Calves'], secondary: [],
    experienceGate: 'everyone',
    note: 'Tibialis anterior (shin). Requires a tib bar and compatible plates. Uses the Tib Raises dose: 2 × 15–20 reps with 30 seconds rest. Begin empty or light, record total external load, and retain full ankle range. Automatic progression from Tib Raises when available; manual Add/Swap. All phases; familiar light loading is suitable at G-1.',
    flagged: false,
  });
  assert.deepEqual(EXERCISE_CUES[NAME], {
    primaryCue: 'Pull your toes toward your shins through the full range.',
    secondaryCue: 'Keep knees still, pause at the top, and lower under control.',
  });
  assert.equal(EXERCISE_DEMO_VIDEOS[NAME],
    'https://youtube.com/shorts/wRLoLlsgXLk?si=1_FC_ZIrgFjosAMU');
  assert.deepEqual(movementPlaneMetadataFor(NAME), {
    exercise: NAME, primaryPlane: 'sagittal', secondaryPlanes: [],
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
    movement: 'isolation_lower', region: 'lower', load: 'low', fatigue: 'low',
    doms: 'moderate', stability: 'high', unilateral: false,
    eccentric: 'moderate', lateWeek: 'caution',
  });
  // Sam, 2026-09-03: one ruling model rates both tib raises. The intake's
  // hand-authored row (knee/hip/quad/hamstring/groin/lower back "good") was
  // superseded by the ruled matrix's row for the same movement pattern and
  // primary muscle; the two rows are held equal, region for region.
  assert.deepEqual(tags.injury, EXERCISE_TAGS['Tib Raises']!.injury);
  assert.deepEqual(tags.injury, {
    groin: 'caution', hip: 'caution', quad: 'caution', hamstring: 'caution', knee: 'caution',
    calf: 'caution', 'ankle/foot': 'caution', ribs: 'good', lowerBack: 'caution',
    neck: 'good', shoulder: 'good', elbow: 'good', 'wrist/hand': 'good',
  });
});

run('Tib bar is one askable full-gym equipment answer with the supplied T glyph', () => {
  assert.equal(EQUIPMENT_TAG_LABELS.tib_bar, 'Tib bar');
  assert(derivedEquipmentChecklistTags().includes('tib_bar'));
  assert(FULL_GYM_EQUIPMENT.includes('tib_bar'));
  const iconSource = readFileSync(resolve(__dirname, '../screens/home/EquipmentLimitationSheet.tsx'), 'utf8');
  assert(iconSource.includes("export const TIB_BAR_ICON_PATH = 'M6 5h12M12 5v14'"));
  assert(iconSource.includes('tib_bar: (color) => glyph(color, <Path d={TIB_BAR_ICON_PATH} />)'));
});

run('the row requires a tib bar and records athlete-chosen total kilograms', () => {
  assert.deepEqual(equipmentRequiredFor(NAME), ['tib_bar']);
  assert(exerciseIsAvailableWith(NAME, ['bodyweight', 'tib_bar']));
  assert(!exerciseIsAvailableWith(NAME, ['bodyweight']));
  assert(ATHLETE_CHOSEN_LOAD_EXERCISES.has(NAME));
  assert.equal(resolveLoadAuthority(NAME).kind, 'athlete_chosen');
  assert.equal(resolveLoadControlMode(NAME), 'kilograms');
  const weightControlSource = readFileSync(resolve(__dirname,
    '../screens/home/useDayWorkout.ts'), 'utf8');
  assert(weightControlSource.includes('const next = (current ?? 0) + 2.5;'));
  assert(weightControlSource.includes('const next = current - 2.5;'));
  const selected = resolveSelectedImplement({
    exerciseName: NAME, availableTags: ['bodyweight', 'tib_bar'], prescribedWeightKg: 2.5,
  });
  assert.equal(selected.implement, 'tib_bar');
  assert.equal(selectedImplementLabel(selected), 'Tib bar');
});

run('automatic pool filtering prefers the T-bar progression only when available', () => {
  const pair = LOWER_PREHAB_POOL.filter((entry) => entry.name === BASE || entry.name === NAME);
  const withBar = filterPoolEntriesForAthlete(pair, {
    injuries: [], equipmentTags: ['bodyweight', 'tib_bar'], daysToGame: null,
    onboardingData: { experienceLevel: 'Complete beginner' },
  } as never).map((entry) => entry.name);
  const withoutBar = filterPoolEntriesForAthlete(pair, {
    injuries: [], equipmentTags: ['bodyweight'], daysToGame: null,
    onboardingData: { experienceLevel: 'Complete beginner' },
  } as never).map((entry) => entry.name);
  assert.deepEqual(withBar, [NAME]);
  assert.deepEqual(withoutBar, [BASE]);
});

run('the existing Swap ladder offers the direct progression and keeps one variation family', () => {
  const choices = getTapSwapChoices({
    originalExercise: BASE, reason: 'preference', environment: healthyEnvironment,
    existingExerciseNames: [],
  });
  assert(choices.some((choice) => choice.name === NAME
    && choice.hierarchyTier === 'same_movement_pattern'));
  assert.equal(exerciseVariationFamily(NAME), exerciseVariationFamily(BASE));
  assert(!getTapSwapChoices({
    originalExercise: BASE, reason: 'preference',
    environment: { ...healthyEnvironment, availableEquipmentTags: ['bodyweight'] },
    existingExerciseNames: [],
  }).some((choice) => choice.name === NAME));
});

run('everyone can use Add/Swap and a familiar light dose remains legal at G-1', () => {
  assert(selectableVocabularyGroups().some((group) => group.names.includes(NAME)));
  assert(assessTapSwapCandidateSafety(NAME, healthyEnvironment).safe);
  assert(exerciseProgrammingAllows(NAME, {
    route: 'manual', experienceLevel: 'Complete beginner', daysToGame: 1,
  }));
  assert(exerciseProgrammingAllows(NAME, {
    route: 'warmup', experienceLevel: 'Complete beginner', daysToGame: 1,
  }));
  assert(!exerciseProgrammingAllows(NAME, {
    route: 'primer', experienceLevel: 'Complete beginner', daysToGame: 1,
  }));
});

run('the signed intake retains the supplied restrictions and all thirteen ratings', () => {
  const intake = readFileSync(resolve(__dirname,
    '../../docs/EXERCISE_INTAKE_T_BAR_TIB_RAISES_2026-09-02.md'), 'utf8');
  assert(intake.includes('Active ankle dorsiflexion, front-of-shin pain, ankle impingement or pressure across the top of the foot.'));
  assert(intake.includes('Focal or severe shin pain needs review.'));
  assert.equal([...intake.matchAll(/^\| ([^|]+) \| (Good|Caution|Avoid) \|$/gm)].length, 13);
});

if (!mutation) run('mutation: restoring no Tib-Raises progression makes the guard fail', () => {
  const child = spawnSync(resolve(__dirname, '../../node_modules/.bin/sucrase-node'), [__filename], {
    encoding: 'utf8',
    env: { ...process.env, LFA_TIB_BAR_MUTATION: 'progression' },
    timeout: 120000,
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr,
    /automatic pool filtering prefers the T-bar progression|existing Swap ladder offers the direct progression/);
});

console.log(`\nT-Bar Tib Raises: passed=${passed}/${mutation ? 9 : 10} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
