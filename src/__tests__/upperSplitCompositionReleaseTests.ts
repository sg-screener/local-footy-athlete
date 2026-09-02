/**
 * R-299 release boundary: one pulldown identity and one shared upper-split owner.
 *
 * Run: npm run test:upper-split-composition
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { COMPOSER_ROTATION_DEFAULTS } from './support/composerRotationDefaults';
import { findOrCreateExercise } from '../data/defaultProgram';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { EXERCISE_EQUIPMENT_REQUIREMENT } from '../data/exerciseEquipmentRequirement';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import { STRENGTH_POOLS, findPoolEntry } from '../data/exercisePoolsStrength';
import { EXERCISE_TAGS, upperAccessoryAffinity } from '../data/exerciseTags';
import { readBlockHistory, loadForReplacementExercise } from '../rules/blockBoundaryProgression';
import { composeWeek, type ComposerInputs, type ComposerPlannedDay } from '../rules/composeWeek';
import {
  applyStrengthDeloadToExercises,
  resolveDeloadWeekPolicy,
  resolveDoorDeloadPolicy,
} from '../rules/deloadWeekRules';
import {
  exerciseVariationFamily,
  sessionHasExerciseVariationCollision,
} from '../rules/exerciseVariationFamily';
import {
  FEMALE_UPPER_SPLIT_PULL_SLOTS,
  FEMALE_UPPER_SPLIT_PUSH_SLOTS,
  UPPER_SPLIT_PULL_SLOTS,
  UPPER_SPLIT_PUSH_SLOTS,
} from '../rules/sessionSlotCoverage';
import { MINIMUM_USEFUL_STRENGTH_EXERCISES } from '../rules/minimumUsefulStrengthSession';
import {
  FOOTBALL_ROBUSTNESS_CATEGORIES,
  footballRobustnessCategoriesForExercise,
  missingFootballRobustnessCategories,
} from '../rules/footballRobustnessFoundation';
import type { WorkoutExercise } from '../types/domain';
import { legalAddCandidates } from '../utils/addExerciseCandidates';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { resolveExerciseName } from '../utils/loadEstimation';
import { rankedQuickSwapChoices } from '../utils/quickExerciseActions';

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: unknown, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const LEGACY = 'Single-Arm Pulldown';
const CANONICAL = 'Single-Arm Lat Pulldown';

console.log('\n[identity] legacy ingress, canonical current state');
check('legacy saved names reopen under the canonical athlete-facing name',
  canonicalExerciseName(LEGACY) === CANONICAL && resolveExerciseName(LEGACY) === CANONICAL);
check('current writing canonicalises the retired spelling',
  findOrCreateExercise(LEGACY).name === CANONICAL);
check('the retired spelling is absent from current registries',
  !Object.prototype.hasOwnProperty.call(EXERCISE_CUES, LEGACY)
  && !Object.prototype.hasOwnProperty.call(EXERCISE_TAGS, LEGACY)
  && !Object.prototype.hasOwnProperty.call(EXERCISE_EQUIPMENT_REQUIREMENT, LEGACY)
  && !EXERCISE_MUSCLE_METADATA.some((entry) => entry.exercise === LEGACY)
  && !Object.values(STRENGTH_POOLS).some((pool) =>
    [...pool.anchor.entries, ...pool.accessory.entries].some((entry) => entry.name === LEGACY)));
const history = readBlockHistory({
  feedbackByDate: {
    '2026-08-10': {
      dateStr: '2026-08-10', completion: 'full', feeling: 'good', soreness: 'none',
      strength: [{
        exerciseId: 'legacy-pulldown', exerciseName: LEGACY, completion: 'full',
        prescribedSets: 3, prescribedRepsMin: 8, prescribedRepsMax: 10, weightKg: 32.5,
      }],
    } as never,
  },
  blockStartISO: '2026-08-10', blockEndISO: '2026-08-10', requiredStrengthSessions: 1,
});
check('legacy history progresses the canonical exercise without a duplicate key',
  history.lastRecordedLoadByExercise[CANONICAL] === 32.5
  && history.lastRecordedLoadByExercise[LEGACY] === undefined
  && loadForReplacementExercise({
    exerciseName: CANONICAL, recordedLoadByExercise: history.lastRecordedLoadByExercise,
  }) === 32.5);

console.log('\n[composition] split upper work stays useful and direction-owned');
const expectedPush = [
  'horizontal_push', 'vertical_push',
  'push_accessory_1', 'push_accessory_2', 'core', 'football_robustness',
];
const expectedPull = [
  'horizontal_pull', 'vertical_pull',
  'pull_accessory_1', 'pull_accessory_2', 'core', 'football_robustness',
];
check('the male push table keeps both planes and two typed Push support seats',
  JSON.stringify(UPPER_SPLIT_PUSH_SLOTS) === JSON.stringify(expectedPush));
check('the male pull table keeps both planes and two typed Pull support seats',
  JSON.stringify(UPPER_SPLIT_PULL_SLOTS) === JSON.stringify(expectedPull));
check('female required split sessions use the same directional ownership',
  JSON.stringify(FEMALE_UPPER_SPLIT_PUSH_SLOTS) === JSON.stringify(expectedPush)
  && JSON.stringify(FEMALE_UPPER_SPLIT_PULL_SLOTS) === JSON.stringify(expectedPull));

const fullGym = resolveEquipmentCapabilities({
  equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete',
} as never).tags as string[];
const planned = (direction: 'push' | 'pull', dayOfWeek: number): ComposerPlannedDay => ({
  dayOfWeek,
  isTeamDay: false,
  planEntryId: `release:${dayOfWeek}:upper-${direction}`,
  strengthIntent: {
    archetype: 'upper', primaryPattern: direction,
    plannedPatterns: [direction], effectivePatterns: [direction],
  },
  name: `Upper ${direction === 'push' ? 'Push' : 'Pull'}`,
  workoutType: 'Strength',
  sessionTier: 'core',
});
const baseInputs: ComposerInputs = {
  profile: { seasonPhase: 'In-season', experienceLevel: 'Intermediate' } as never,
  phaseClock: { weekNumber: 1 },
  seasonPhase: 'In-season' as never,
  offseasonSubphase: null,
  plannedDays: [planned('push', 2), planned('pull', 4)],
  kit: fullGym,
  injuries: { prohibitedPatterns: [], excludedIdentities: [] },
  todayISO: '2026-09-01',
  ...COMPOSER_ROTATION_DEFAULTS,
};
const normal = composeWeek(baseInputs);
check('normal male composition keeps the useful floor without filling seven seats',
  normal.days.every((day) => day.rows.filter((row) => !['core', 'midline'].includes(row.slot)).length
    >= MINIMUM_USEFUL_STRENGTH_EXERCISES && day.rows.length <= 6)
  && normal.days[0]?.rows[0]?.slot === 'horizontal_push'
  && normal.days[0]?.rows[1]?.slot === 'vertical_push'
  && normal.days[1]?.rows[0]?.slot === 'horizontal_pull'
  && normal.days[1]?.rows[1]?.slot === 'vertical_pull',
  JSON.stringify(normal.days.map((day) => day.rows.map((row) => `${row.slot}:${row.identity}`))));
check('the final male split week retains legal robustness support without using it as filler',
  normal.days.every((day) => day.rows.some((row) => row.slot === 'football_robustness')),
  JSON.stringify(normal.days.map((day) => day.rows.map((row) => row.identity))));
check('normal male composition has no variation-family collision',
  normal.days.every((day) => !sessionHasExerciseVariationCollision(
    day.rows.map((row) => row.identity))));
const normalPull = normal.days.find((day) => day.kind === 'upper_split_pull')!;
const majorPullSlots = normalPull.rows.flatMap((row) => {
  const membership = findPoolEntry(row.identity);
  return membership && (membership.slot === 'horizontal_pull' || membership.slot === 'vertical_pull')
    ? [membership.slot] : [];
});
check('male Upper Pull has exactly one horizontal and one vertical major pull',
  majorPullSlots.length === 2
  && majorPullSlots.filter((slot) => slot === 'horizontal_pull').length === 1
  && majorPullSlots.filter((slot) => slot === 'vertical_pull').length === 1,
  JSON.stringify(normalPull.rows.map((row) => `${row.slot}:${row.identity}`)));
check('required male upper sessions contain only direction-owned automatic accessories',
  normal.days.every((day) => day.rows.every((row) => {
    if (row.slot.startsWith('push_accessory')) {
      return ['push', 'both'].includes(upperAccessoryAffinity(row.identity) ?? '');
    }
    if (row.slot.startsWith('pull_accessory')) {
      return ['pull', 'both'].includes(upperAccessoryAffinity(row.identity) ?? '');
    }
    return !['biceps', 'triceps', 'shoulders', 'traps', 'arm_or_shoulder'].includes(row.slot);
  })),
  JSON.stringify(normal.days.map((day) => day.rows.map((row) => `${row.slot}:${row.identity}`))));
const injuryAdjusted = composeWeek({
  ...baseInputs,
  injuries: {
    prohibitedPatterns: [],
    excludedIdentities: normal.days.flatMap((day) => day.rows.slice(0, 1).map((row) => row.identity)),
  },
});
check('injury-adjusted composition obeys the same ceiling and family rule',
  injuryAdjusted.days.every((day) => day.rows.length <= 6
    && !sessionHasExerciseVariationCollision(day.rows.map((row) => row.identity))));

console.log('\n[annual selection] typed block history rotates legal non-anchor work');
{
  const history: import('../rules/blockExerciseSelection').BlockExerciseSelection[] = [];
  const robustnessAccessories: string[] = [];
  const pullMajorCounts: number[] = [];
  const usefulCounts: number[] = [];
  for (let block = 1; block <= 13; block += 1) {
    const blockStart = new Date('2026-09-07T12:00:00Z');
    blockStart.setUTCDate(blockStart.getUTCDate() + (block - 1) * 28);
    const blockStartISO = blockStart.toISOString().slice(0, 10);
    const composed = composeWeek({
      ...baseInputs,
      todayISO: blockStartISO,
      blockNumber: block,
      blockStartISO,
      selectionHistory: history,
    });
    history.push(...composed.selections);
    const push = composed.days.find((day) => day.kind === 'upper_split_push')!;
    const pull = composed.days.find((day) => day.kind === 'upper_split_pull')!;
    robustnessAccessories.push(...composed.days.flatMap((day) => day.rows
      .filter((row) => row.slot === 'football_robustness').map((row) => row.identity)));
    usefulCounts.push(...composed.days.map((day) => day.rows
      .filter((row) => !['core', 'midline'].includes(row.slot)).length));
    pullMajorCounts.push(pull.rows.filter((row) => {
      const membership = findPoolEntry(row.identity);
      return membership?.slot === 'horizontal_pull' || membership?.slot === 'vertical_pull';
    }).length);
  }
  const counts = new Map<string, number>();
  robustnessAccessories.forEach((identity) => counts.set(identity, (counts.get(identity) ?? 0) + 1));
  check('every annual block retains the useful split-session floor',
    usefulCounts.every((count) => count >= MINIMUM_USEFUL_STRENGTH_EXERCISES),
    JSON.stringify(usefulCounts));
  check('typed block history rotates the legal robustness bench',
    counts.size >= FOOTBALL_ROBUSTNESS_CATEGORIES.length, JSON.stringify([...counts]));
  check('every annual Upper Pull has two major pulls, never three',
    pullMajorCounts.every((count) => count === 2), JSON.stringify(pullMajorCounts));
}

const female = composeWeek({
  ...baseInputs,
  profile: { ...baseInputs.profile, gender: 'female' } as never,
});
check('female required sessions retain the same useful floor and directional ceiling',
  female.days.every((day) => day.rows.length <= 6
    && day.rows.filter((row) => !['core', 'midline'].includes(row.slot)).length
      >= MINIMUM_USEFUL_STRENGTH_EXERCISES),
  JSON.stringify(female.days.map((day) => day.rows.map((row) => row.identity))));

const finalWeekSignature = (week: ReturnType<typeof composeWeek>): string => JSON.stringify(
  week.days.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    kind: day.kind,
    requiredSlots: day.requiredSlots,
    declaredSlots: day.declaredSlots,
    rows: day.rows.map((row) => ({
      identity: row.identity,
      slot: row.slot,
      role: row.role,
      sets: row.sets,
      repsMin: row.repsMin,
      repsMax: row.repsMax,
      load: row.load,
      prescriptionType: row.prescriptionType ?? null,
    })),
  })),
);
const restartedMale = composeWeek({ ...baseInputs, selectionHistory: normal.selections });
const restartedFemale = composeWeek({
  ...baseInputs,
  profile: { ...baseInputs.profile, gender: 'female' } as never,
  selectionHistory: female.selections,
});
check('saved in-season male selections restart to the exact same final sessions',
  finalWeekSignature(restartedMale) === finalWeekSignature(normal),
  `${finalWeekSignature(normal)} -> ${finalWeekSignature(restartedMale)}`);
check('saved in-season female selections restart to the exact same final sessions',
  finalWeekSignature(restartedFemale) === finalWeekSignature(female),
  `${finalWeekSignature(female)} -> ${finalWeekSignature(restartedFemale)}`);

const robustnessCategoryOccurrences = normal.days.flatMap((day) => day.rows
  .filter((row) => row.slot === 'football_robustness')
  .flatMap((row) => footballRobustnessCategoriesForExercise(row.identity)));
check('no robustness category is added twice merely to fill both upper sessions',
  robustnessCategoryOccurrences.every((category, index, all) => all.indexOf(category) === index),
  JSON.stringify(robustnessCategoryOccurrences));

const limitedKit = resolveEquipmentCapabilities({
  equipment: ['Dumbbells', 'Resistance Bands'], equipmentSelectionCompleteness: 'complete',
} as never).tags as string[];
const limited = composeWeek({
  ...baseInputs,
  kit: limitedKit,
  injuries: { prohibitedPatterns: [], excludedIdentities: ['Dips', 'Seated Cable Row'] },
});
check('limited kit and exclusions still produce valid bounded split sessions',
  limited.days.length === 2
  && limited.days.every((day) => day.rows.length > 0 && day.rows.length <= 6
    && !sessionHasExerciseVariationCollision(day.rows.map((row) => row.identity))),
  JSON.stringify(limited.days.map((day) => day.rows.map((row) => row.identity))));

console.log('\n[family doors] Add and Swap read the same explicit families');
check('the three pulldown identities share one typed family',
  new Set(['Lat Pulldown', 'Neutral-Grip Pulldown', CANONICAL]
    .map(exerciseVariationFamily)).size === 1
  && exerciseVariationFamily(CANONICAL) !== null);
check('bench variants collide while Bench + Overhead Press + Dips do not',
  sessionHasExerciseVariationCollision(['Bench Press', 'Incline DB Bench', 'DB Bench Press'])
  && !sessionHasExerciseVariationCollision(['Bench Press', 'Overhead Press', 'Dips']));
const environment = {
  injurySeverities: {}, primaryInjury: null,
  availableEquipment: ['bodyweight', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell'],
  availableEquipmentTags: [
    'bodyweight', 'barbell', 'dumbbells', 'cables', 'machine', 'kettlebell',
    'bike_or_treadmill',
  ],
  capacity: 'high',
  hasEquipmentConstraint: false, medicalStop: false,
} as never;
const addPull = legalAddCandidates({
  leaf: 'upper_pull', environment, existingExerciseNames: ['Lat Pulldown'],
});
check('athlete Add cannot offer a second pulldown-family row or the retired spelling',
  addPull.every((candidate) =>
    candidate.name !== LEGACY
    && exerciseVariationFamily(candidate.name) !== exerciseVariationFamily('Lat Pulldown')));
const swapPush = rankedQuickSwapChoices({
  originalExercise: 'Bench Press', reason: 'preference', environment,
  existingExerciseNames: ['Bench Press', 'Overhead Press', 'Dips'],
});
check('athlete Swap cannot collide with another occupied family',
  swapPush.every((candidate) =>
    exerciseVariationFamily(candidate.name) !== exerciseVariationFamily('Overhead Press')));

console.log('\n[easier] important planes survive before accessory scatter');
let sequence = 0;
function upperRow(
  name: string,
  sets: number,
  slot: string,
  role: 'main_strength' | 'strength_accessory',
): WorkoutExercise {
  sequence += 1;
  return {
    id: `row-${sequence}`, workoutId: 'upper-release', exerciseId: `exercise-${sequence}`,
    exerciseOrder: sequence, prescribedSets: sets, prescribedRepsMin: 6,
    prescribedRepsMax: 8, restSeconds: 90,
    exercise: { id: `exercise-${sequence}`, name, description: '', muscleGroups: [] },
    section18Evidence: {
      protocolVersion: 1, role,
      strengthPattern: role === 'main_strength' ? 'push' : null,
      mainStrengthPattern: role === 'main_strength' ? 'push' : null,
      slot, provenance: 'composer_declaration',
    },
  } as WorkoutExercise;
}
const upperPushRows = [
  upperRow('Bench Press', 3, 'horizontal_push', 'main_strength'),
  upperRow('Overhead Press', 3, 'vertical_push', 'strength_accessory'),
  upperRow('Dips', 2, 'push_accessory_1', 'strength_accessory'),
  upperRow('Skull Crushers', 2, 'triceps', 'strength_accessory'),
  upperRow('Lateral Raise', 2, 'shoulders', 'strength_accessory'),
  upperRow('Ab Wheel', 2, 'core', 'strength_accessory'),
];
const easierPolicies = [
  resolveDoorDeloadPolicy({
    door: 'readiness', seasonPhase: 'In-season', preserveExerciseSelection: true,
  })!,
  resolveDeloadWeekPolicy('Off-season', 'deload')!,
];
for (const [index, policy] of easierPolicies.entries()) {
  const easier = applyStrengthDeloadToExercises(upperPushRows, policy);
  const names = easier.map((row) => row.exercise?.name);
  check(`${index === 0 ? 'G-1 easier' : 'scheduled deload'} keeps both important planes`,
    names.includes('Bench Press') && names.includes('Overhead Press'));
  check(`${index === 0 ? 'G-1 easier' : 'scheduled deload'} avoids many one-set rows`,
    easier.filter((row) => row.prescribedSets === 1).length <= 2
    && (index !== 0 || easier.length < upperPushRows.length));
}

console.log(`\nUpper split release: ${passed} passed / ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
