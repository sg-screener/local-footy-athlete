/** R-362 — five rear-shoulder movements may rotate through Movement Prep. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DELTS_POOL } from '../data/exercisePools';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import { FLOW_CATEGORY_MUSCLE_MAPPING } from '../data/sessionFlowMenus';
import {
  exerciseVariationFamily,
  sameExerciseVariationFamily,
} from '../rules/exerciseVariationFamily';
import {
  flowSlotCandidates,
  selectMobilityPrehabFlow,
} from '../utils/mobilityPrehabFlow';
import { DEFAULT_ATHLETE_CONTEXT, type AthleteContext } from '../utils/sessionBuilder';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

const WARMUP_CHOICES = [
  'Incline Y Raise',
  'Face Pull',
  'Cable Face Pull',
  'Rear Delt Fly',
  'Band Pull-Apart',
] as const;
const FACE_PULLS = ['Face Pull', 'Cable Face Pull'] as const;

let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

const shoulderMapping = FLOW_CATEGORY_MUSCLE_MAPPING.shoulder_prehab as {
  alsoEligibleExercises?: readonly string[];
};
const mutation = process.env.LFA_WARMUP_REAR_MUTATION;
if (mutation === 'remove-extra-candidates') {
  shoulderMapping.alsoEligibleExercises = [];
}

let rowSequence = 0;
function row(name: string): any {
  rowSequence += 1;
  return {
    id: `row-${rowSequence}`,
    exerciseId: `exercise-${rowSequence}`,
    exerciseOrder: rowSequence,
    prescribedSets: 3,
    prescribedRepsMin: 8,
    prescribedRepsMax: 12,
    restSeconds: 60,
    exercise: { id: `library-${rowSequence}`, name },
  };
}

function upperWorkout(extraNames: readonly string[] = []): any {
  return {
    id: 'upper-workout',
    microcycleId: 'week-1',
    dayOfWeek: 1,
    name: 'Upper Body',
    description: '',
    durationMinutes: 60,
    intensity: 'moderate',
    workoutType: 'Strength',
    exercises: ['Bench Press', 'Barbell Row', ...extraNames].map(row),
  };
}

function flowFor(
  date: string,
  extraNames: readonly string[] = [],
  performedMovementIds: readonly string[] = [],
) {
  return selectMobilityPrehabFlow({
    workout: upperWorkout(extraNames),
    seasonPhase: 'In-season',
    isGameWeek: false,
    athlete: DEFAULT_ATHLETE_CONTEXT,
    date,
    performedMovementIds,
  });
}

function flowNames(date: string, extraNames: readonly string[] = []): string[] {
  const flow = flowFor(date, extraNames);
  return (flow?.movements ?? []).map((movement) => movement.exercise.name);
}

function dates(count: number): string[] {
  return Array.from({ length: count }, (_, offset) =>
    new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10));
}

console.log('\n-- R-362 rear-shoulder warm-up choices --');

run('the shoulder warm-up eligibility list names exactly Sam\'s five choices', () => {
  assert.deepEqual(shoulderMapping.alsoEligibleExercises, WARMUP_CHOICES);
});

run('all five pass the real shoulder-prehab candidate door with full equipment', () => {
  const candidates = new Set(
    flowSlotCandidates('shoulder_prehab', DEFAULT_ATHLETE_CONTEXT)
      .map((candidate) => candidate.name),
  );
  assert.deepEqual(WARMUP_CHOICES.filter((name) => !candidates.has(name)), []);
});

run('all five are actually selected across dated upper-body warm-ups', () => {
  const seen = new Set<string>();
  for (const date of dates(730)) {
    for (const name of flowNames(date)) {
      if ((WARMUP_CHOICES as readonly string[]).includes(name)) seen.add(name);
    }
  }
  assert.deepEqual([...seen].sort(), [...WARMUP_CHOICES].sort());
});

run('the two Face Pull names are one non-null variation family and never pair', () => {
  assert(exerciseVariationFamily(FACE_PULLS[0]));
  assert(sameExerciseVariationFamily(FACE_PULLS[0], FACE_PULLS[1]));
  for (const date of dates(730)) {
    const selected = flowNames(date);
    assert(!(selected.includes(FACE_PULLS[0]) && selected.includes(FACE_PULLS[1])),
      `${date} selected both Face Pull variants: ${selected.join(', ')}`);
  }
});

run('a Face Pull in the main workout blocks its other version from the warm-up', () => {
  for (const [main, blocked] of [
    ['Face Pull', 'Cable Face Pull'],
    ['Cable Face Pull', 'Face Pull'],
  ] as const) {
    let flowsReached = 0;
    let blockedWouldOtherwiseAppear = 0;
    for (const date of dates(180)) {
      if (flowNames(date).includes(blocked)) blockedWouldOtherwiseAppear += 1;
      const selected = flowNames(date, [main]);
      if (selected.length > 0) flowsReached += 1;
      assert(!selected.includes(blocked), `${date}: main ${main}, warm-up ${blocked}`);
    }
    assert.equal(flowsReached, 180);
    assert(blockedWouldOtherwiseAppear > 0,
      `${blocked} never appeared in the control warm-ups, so its exclusion was not exercised`);
  }
});

run('a performed Face Pull stays while its freshly drawn sibling is removed', () => {
  const facePull = flowSlotCandidates('shoulder_prehab', DEFAULT_ATHLETE_CONTEXT)
    .find((candidate) => candidate.name === 'Face Pull');
  assert(facePull);
  const cableDate = dates(730).find((date) => flowNames(date).includes('Cable Face Pull'));
  assert(cableDate);
  const retained = flowFor(cableDate, [], [facePull.id]);
  const selected = (retained?.movements ?? []).map((movement) => movement.exercise.name);
  assert(selected.includes('Face Pull'));
  assert(!selected.includes('Cable Face Pull'));
});

run('the five stay in their existing Arms and shoulders ownership', () => {
  const deltNames = new Set(DELTS_POOL.map((exercise) => exercise.name));
  assert.deepEqual(WARMUP_CHOICES.filter((name) => !deltNames.has(name)), []);
  const expectedPools: Record<(typeof WARMUP_CHOICES)[number], string> = {
    'Incline Y Raise': 'Accessories upper',
    'Face Pull': 'Upper pull horizontal',
    'Cable Face Pull': 'Shoulders',
    'Rear Delt Fly': 'Upper pull horizontal',
    'Band Pull-Apart': 'Upper pull horizontal',
  };
  for (const name of WARMUP_CHOICES) {
    assert.equal(EXERCISE_MUSCLE_METADATA.find((entry) => entry.exercise === name)?.pool,
      expectedPools[name]);
  }
});

run('the existing equipment filter still controls which of the five can appear', () => {
  const bandsOnly: AthleteContext = { injuries: [], equipmentTags: ['bodyweight', 'bands'] };
  const noKit: AthleteContext = { injuries: [], equipmentTags: ['bodyweight'] };
  const targetCandidates = (athlete: AthleteContext) =>
    flowSlotCandidates('shoulder_prehab', athlete)
      .map((candidate) => candidate.name)
      .filter((name) => (WARMUP_CHOICES as readonly string[]).includes(name));
  assert.deepEqual(targetCandidates(bandsOnly), ['Band Pull-Apart']);
  assert.deepEqual(targetCandidates(noKit), []);
});

if (!mutation) run('mutation: removing the extra warm-up eligibility makes the guard fail', () => {
  const child = spawnSync(resolve(process.cwd(), 'node_modules/.bin/sucrase-node'), [__filename], {
    encoding: 'utf8',
    env: { ...process.env, LFA_WARMUP_REAR_MUTATION: 'remove-extra-candidates' },
    timeout: 120000,
  });
  assert.equal(child.status, 1);
  assert.match(`${child.stdout}\n${child.stderr}`,
    /eligibility list names exactly|pass the real shoulder-prehab candidate door|actually selected/);
});

console.log(`\nRear-shoulder warm-up: passed=${passed}/${mutation ? 8 : 9} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
