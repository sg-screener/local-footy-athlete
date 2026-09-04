/**
 * B-Stance RDL — Sam's signed intake, held field by field.
 *
 * Intake: `docs/EXERCISE_INTAKE_B_STANCE_RDL_2026-09-04.md` (R-368).
 * Run: `npm run test:b-stance-rdl`, chained from `npm run test:exercise-intake`.
 *
 * ## WHY THIS SUITE IS SHAPED AROUND "SAME AS SINGLE-LEG RDL"
 *
 * Sam's sheet says *"Same as SL RDL"* for use, season, prescription and
 * loading. **A suite that pinned those as literal numbers would be asserting a
 * COPY, and would stay green on the day Single-Leg RDL's own numbers changed
 * and the two lifts silently diverged.** So every "same as" claim is held as an
 * EQUALITY between the two identities, read through the owner that answers for
 * both — the dose category, the load profile, the slot deriver. The literals
 * are pinned only where Sam authored a number for THIS lift and no other row
 * owns it.
 *
 * The differences are pinned as literals, because those are his authorship and
 * nothing else would catch a row that quietly inherited Single-Leg RDL's
 * gentler hamstring rating.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import { EXERCISE_CUES } from '../data/exerciseCues';
import {
  equipmentRequiredFor,
  exerciseIsAvailableWith,
  BODYWEIGHT_CAPABLE,
} from '../data/exerciseEquipmentRequirement';
import { STRENGTH_POOLS, findPoolEntry } from '../data/exercisePoolsStrength';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import { movementPlaneMetadataFor } from '../data/exerciseMovementPlaneMetadata';
import { exerciseVariationFamily, sameExerciseVariationFamily } from '../rules/exerciseVariationFamily';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import { EXERCISE_DEMO_VIDEOS } from '../services/exerciseVideoService';
import { EXERCISE_LOAD_MAP, resolveExerciseName } from '../utils/loadEstimation';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

const NAME = 'B-Stance RDL';
const SIBLING = 'Single-Leg RDL';

console.log('\nB-STANCE RDL — Sam\'s signed intake, 2026-09-04\n');

/* ── The lift exists, in the group Sam asked it to widen ─────────────────── */

run('it sits in the hinge accessory pool, in the single_leg_hip group', () => {
  const entry = STRENGTH_POOLS.hinge.accessory.entries.find((row) => row.name === NAME);
  assert(entry, `${NAME} is not in the hinge accessory pool`);
  assert.equal(entry.group, 'single_leg_hip');
  assert.equal(entry.doseCategory, 'loaded_lower_secondary_compound');
});

run('THE GROUP SAM ASKED TO WIDEN IS ACTUALLY WIDER — two LOADED options, not one', () => {
  const loaded = STRENGTH_POOLS.hinge.accessory.entries
    .filter((row) => row.group === 'single_leg_hip' && row.loadRatio > 0)
    .map((row) => row.name);
  assert(loaded.includes(NAME) && loaded.includes(SIBLING),
    `loaded single-leg hip group is [${loaded.join(', ')}]`);
  assert(loaded.length >= 2,
    'the group is back to one loaded option — the reason this lift was added is gone');
});

run('the slot deriver seats it in single_leg_hip and NOT in the bilateral hinge', () => {
  const slots = slotsForExerciseName(NAME);
  assert(slots.includes('single_leg_hip'), `slots were [${slots.join(', ')}]`);
  assert(!slots.includes('hinge'),
    'a unilateral hinge may not claim the bilateral hinge seat');
  // Derived, not listed: it follows from movement + unilateral, exactly as the
  // sibling's does. Equal answers from one owner.
  assert.deepEqual([...slots].sort(), [...slotsForExerciseName(SIBLING)].sort());
});

/* ── "Same as Single-Leg RDL", held as EQUALITY and never as a copy ──────── */

run('SAME PRESCRIPTION: the identical authored dose category, so one reader answers both', () => {
  const mine = findPoolEntry(NAME);
  const sibling = findPoolEntry(SIBLING);
  assert(mine && sibling);
  assert.equal(mine.entry.doseCategory, sibling.entry.doseCategory);
  assert.equal(mine.slot, sibling.slot);
  assert.equal(mine.role, sibling.role);
});

run('SAME LOADING AND PROGRESSION: the identical load profile row', () => {
  const mine = EXERCISE_LOAD_MAP[NAME];
  const sibling = EXERCISE_LOAD_MAP[SIBLING];
  assert(mine, `${NAME} has no load profile — it cannot be seeded a weight`);
  assert.deepEqual(mine, sibling,
    `${JSON.stringify(mine)} vs sibling ${JSON.stringify(sibling)}`);
  // Not a tautology: the profile is a real one, not two undefineds matching.
  assert.equal(mine.anchor, 'squat');
  assert.equal(mine.equipment, 'dumbbell');
  assert(mine.ratio > 0);
});

run('SAME SEASON / GAME RESTRICTION: the identical late-week rating', () => {
  assert.equal(EXERCISE_TAGS[NAME].lateWeek, EXERCISE_TAGS[SIBLING].lateWeek);
  assert.equal(EXERCISE_TAGS[NAME].lateWeek, 'caution');
});

run('SAME EXPERIENCE GATE: everyone, the same as the sibling', () => {
  const row = EXERCISE_MUSCLE_METADATA.find((entry) => entry.exercise === NAME);
  const sibling = EXERCISE_MUSCLE_METADATA.find((entry) => entry.exercise === SIBLING);
  assert(row && sibling);
  assert.equal(row.experienceGate, 'everyone');
  assert.equal(row.experienceGate, sibling.experienceGate);
  assert.equal(row.pool, sibling.pool);
});

/* ── Where Sam authored something DIFFERENT, pinned as literals ──────────── */

run('HAMSTRING IS AVOID, NOT THE SIBLING\'S CAUTION — the difference that protects an athlete', () => {
  assert.equal(EXERCISE_TAGS[NAME].injury.hamstring, 'avoid');
  assert.equal(EXERCISE_TAGS[SIBLING].injury.hamstring, 'caution',
    'the sibling changed; this cell is now comparing against a moved reference');
});

run('the remaining twelve injury ratings ship exactly as signed', () => {
  assert.deepEqual(EXERCISE_TAGS[NAME].injury, {
    groin: 'caution', hip: 'caution', quad: 'good', hamstring: 'avoid',
    knee: 'good', calf: 'caution', 'ankle/foot': 'caution', ribs: 'caution',
    lowerBack: 'caution', neck: 'good', shoulder: 'caution', elbow: 'caution',
    'wrist/hand': 'caution',
  });
});

run('the authored demand ratings ship exactly as signed', () => {
  const tag = EXERCISE_TAGS[NAME];
  assert.deepEqual({
    load: tag.load, fatigue: tag.fatigue, doms: tag.doms,
    stability: tag.stability, eccentric: tag.eccentric, unilateral: tag.unilateral,
    movement: tag.movement, region: tag.region,
    strengthClassification: tag.strengthClassification,
  }, {
    load: 'moderate', fatigue: 'moderate', doms: 'moderate',
    stability: 'moderate', eccentric: 'high', unilateral: true,
    movement: 'hinge', region: 'lower', strengthClassification: 'compound',
  });
});

run('a kickstand is steadier and harder to lower than a true single leg', () => {
  assert.equal(EXERCISE_TAGS[NAME].stability, 'moderate');
  assert.equal(EXERCISE_TAGS[SIBLING].stability, 'low');
  assert.equal(EXERCISE_TAGS[NAME].eccentric, 'high');
  assert.equal(EXERCISE_TAGS[SIBLING].eccentric, 'moderate');
});

/* ── Equipment: barbell OR dumbbell, and nothing widened past the sheet ──── */

run('BARBELL OR DUMBBELL, resolved first-available with dumbbells leading', () => {
  assert.deepEqual(equipmentRequiredFor(NAME), [['dumbbells', 'barbell']]);
  assert(exerciseIsAvailableWith(NAME, ['bodyweight', 'dumbbells']));
  assert(exerciseIsAvailableWith(NAME, ['bodyweight', 'barbell']));
});

run('NOT widened past the sheet: no kettlebell, and not bodyweight-capable', () => {
  assert(!exerciseIsAvailableWith(NAME, ['bodyweight', 'kettlebell']),
    'a kettlebell was admitted; Sam\'s sheet says barbell or dumbbell');
  assert(!exerciseIsAvailableWith(NAME, ['bodyweight']),
    'an unloaded B-stance is not a regression Sam authored');
  assert(!BODYWEIGHT_CAPABLE.has(NAME));
  // The sibling IS both — so this cell is a real difference, not a tautology.
  assert(BODYWEIGHT_CAPABLE.has(SIBLING),
    'the sibling changed; this contrast no longer proves anything');
});

/* ── Same-session identity ───────────────────────────────────────────────── */

run('it joins the RDL variation family, so R-233 covers it on arrival', () => {
  assert.equal(exerciseVariationFamily(NAME), 'romanian_deadlift');
  assert(sameExerciseVariationFamily(NAME, 'RDLs'));
  assert(sameExerciseVariationFamily(NAME, SIBLING));
});

/* ── The athlete-visible layer ───────────────────────────────────────────── */

run('both cues are Sam\'s words, verbatim', () => {
  assert.deepEqual(EXERCISE_CUES[NAME], {
    primaryCue: 'Load the front leg and push your hips straight back.',
    secondaryCue: 'Keep hips square; use the rear foot only for balance.',
  });
});

run('the intake video is pinned and reachable through its aliases', () => {
  assert.equal(EXERCISE_DEMO_VIDEOS[NAME],
    'https://youtube.com/shorts/5fUAdAXu3PI?si=7zXA5P6Mvng5UFjY');
  assert.equal(resolveExerciseName('kickstand rdl'), NAME);
  assert.equal(resolveExerciseName('b stance rdl'), NAME);
});

run('the movement planes are sagittal, with frontal and transverse behind', () => {
  const planes = movementPlaneMetadataFor(NAME);
  assert(planes, 'no plane metadata — the row is unanswered, not classified');
  assert.equal(planes.primaryPlane, 'sagittal');
  assert.deepEqual([...planes.secondaryPlanes].sort(), ['frontal', 'transverse']);
});

run('the muscles are Sam\'s: hamstrings and glutes, low back behind', () => {
  const row = EXERCISE_MUSCLE_METADATA.find((entry) => entry.exercise === NAME);
  assert(row);
  assert.deepEqual(row.primary, ['Hamstrings', 'Glutes']);
  assert.deepEqual(row.secondary, ['Low back']);
});

console.log(`\nB-Stance RDL totals: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(`\nFAILURES:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exitCode = 1;
