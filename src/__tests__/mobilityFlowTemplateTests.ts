(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  MOBILITY_FLOW_TEMPLATES,
  type MobilityFlowInjuryCautionKey,
  type MobilityFlowMovement,
  type MobilityFlowPhaseSuitability,
  type MobilityFlowTemplate,
} from '../data/mobilityFlowTemplates';
import { POOL_REGISTRY } from '../data/exercisePools';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import type { Workout } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n    ${detail}` : ''));
    console.log(`  FAIL ${name}${detail ? `\n    ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(label: string) {
  console.log(`\n${label}`);
}

const EXPECTED_TEMPLATE_IDS = [
  'lower-body-reset',
  'hips-adductors-groin-reset',
  'ankles-calves-reset',
  'hamstring-hip-hinge-reset',
  't-spine-shoulder-reset',
  'low-back-friendly-trunk-reset',
  'pre-training-movement-prep',
  'post-training-downshift',
  'game-week-light-mobility',
  'recovery-day-full-body-flow',
];

const VALID_PHASES = new Set<MobilityFlowPhaseSuitability>([
  'Off-season',
  'Pre-season',
  'In-season',
  'Deload',
  'Game week',
]);

const knownMovements = new Set<string>([
  ...Object.keys(EXERCISE_TAGS),
  ...Object.values(POOL_REGISTRY).flatMap((pool) => pool.map((exercise) => exercise.name)),
]);

function hasValidLocalMeta(movement: MobilityFlowMovement): boolean {
  const meta = movement.localMeta;
  return !!meta &&
    meta.fatigue === 'low' &&
    Array.isArray(meta.equipment) &&
    Array.isArray(meta.contraindications) &&
    typeof meta.notes === 'string' &&
    meta.notes.trim().length > 0;
}

function movementIsKnownOrLocal(movement: MobilityFlowMovement): boolean {
  return knownMovements.has(movement.name) || hasValidLocalMeta(movement);
}

function hasSimplePrescription(movement: MobilityFlowMovement): boolean {
  const sets = movement.sets ?? 1;
  if (sets < 1 || sets > 3) return false;

  if (movement.prescriptionType === 'duration') {
    const min = movement.durationSecondsMin ?? 0;
    const max = movement.durationSecondsMax ?? 0;
    return min >= 30 && max <= 60 && min <= max;
  }

  const min = movement.repsMin ?? 0;
  const max = movement.repsMax ?? 0;
  return min >= 6 && max <= 10 && min <= max;
}

function workoutExercise(name: string, movement: MobilityFlowMovement, order: number): any {
  const isDuration = movement.prescriptionType === 'duration';
  return {
    id: `mobility-flow-ex-${order}`,
    workoutId: 'mobility-flow-fixture',
    exerciseId: `mobility-flow-${order}`,
    exerciseOrder: order,
    prescribedSets: movement.sets ?? 1,
    prescribedRepsMin: isDuration ? movement.durationSecondsMin : movement.repsMin,
    prescribedRepsMax: isDuration ? movement.durationSecondsMax : movement.repsMax,
    prescribedWeightKg: 0,
    restSeconds: 0,
    prescriptionType: isDuration ? 'duration' : 'reps',
    perSide: movement.perSide,
    notes: movement.notes,
    exercise: {
      id: `mobility-flow-${order}`,
      name,
      description: movement.notes ?? name,
      exerciseType: 'Mobility',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Beginner',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workoutFromTemplate(template: MobilityFlowTemplate): Workout {
  return {
    id: `workout-${template.id}`,
    microcycleId: 'mc-ra2',
    dayOfWeek: 1,
    name: `Mobility Flow - ${template.name}`,
    description: template.name,
    durationMinutes: template.durationMinutes,
    intensity: 'Light' as any,
    workoutType: 'Recovery' as any,
    sessionTier: 'recovery' as any,
    exercises: template.movements.map((movement, index) => workoutExercise(movement.name, movement, index + 1)),
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

section('[1] mobility flow template registry shape');
eq('template count', MOBILITY_FLOW_TEMPLATES.length, EXPECTED_TEMPLATE_IDS.length);

const ids = new Set<string>();
const names = new Set<string>();
for (const template of MOBILITY_FLOW_TEMPLATES) {
  ok(`${template.id} id is stable kebab-case`, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template.id));
  ok(`${template.id} id is unique`, !ids.has(template.id));
  ids.add(template.id);

  ok(`${template.id} has a name`, template.name.trim().length > 0);
  ok(`${template.id} name is unique`, !names.has(template.name));
  names.add(template.name);

  ok(`${template.id} duration is 8-20 minutes`, template.durationMinutes >= 8 && template.durationMinutes <= 20);
  ok(`${template.id} rounds are 1-3`, template.roundsMin >= 1 && template.roundsMax <= 3 && template.roundsMin <= template.roundsMax);
  ok(`${template.id} is low fatigue`, template.fatigue === 'low');
  ok(`${template.id} has focus tags`, template.focusTags.length > 0);
  ok(`${template.id} has phase suitability`, template.phaseSuitability.length > 0);
  ok(`${template.id} phase values are valid`, template.phaseSuitability.every((phase) => VALID_PHASES.has(phase)));
  ok(`${template.id} has movements`, template.movements.length >= 4);
}

for (const id of EXPECTED_TEMPLATE_IDS) {
  ok(`${id} exists`, ids.has(id));
}

section('[2] movement prescriptions and resolution');
for (const template of MOBILITY_FLOW_TEMPLATES) {
  for (const movement of template.movements) {
    ok(`${template.id} / ${movement.name} resolves`, movementIsKnownOrLocal(movement));
    ok(`${template.id} / ${movement.name} uses simple prescription`, hasSimplePrescription(movement));
  }
}

section('[3] focus tags and phase suitability');
ok('has hips flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('hips')));
ok('has groin/adductors flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('groin_adductors')));
ok('has calves/ankles flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('calves_ankles')));
ok('has hamstrings flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('hamstrings')));
ok('has shoulders/T-spine flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('shoulders_t_spine')));
ok('has lower-back/trunk flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('lower_back_trunk')));
ok('has full-body flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.focusTags.includes('full_body')));
ok('has off-season suitable flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.phaseSuitability.includes('Off-season')));
ok('has pre-season suitable flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.phaseSuitability.includes('Pre-season')));
ok('has in-season suitable flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.phaseSuitability.includes('In-season')));
ok('has deload suitable flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.phaseSuitability.includes('Deload')));
ok('has game-week suitable flow', MOBILITY_FLOW_TEMPLATES.some((template) => template.phaseSuitability.includes('Game week')));

section('[4] injury cautions exist for relevant flows');
function cautions(template: MobilityFlowTemplate): Set<MobilityFlowInjuryCautionKey> {
  return new Set(template.injuryCautions.map((caution) => caution.injury));
}

for (const template of MOBILITY_FLOW_TEMPLATES) {
  const flowCautions = cautions(template);
  if (template.focusTags.includes('groin_adductors')) {
    ok(`${template.id} has groin/adductor caution`, flowCautions.has('groin_adductor'));
  }
  if (template.focusTags.includes('hamstrings')) {
    ok(`${template.id} has hamstring caution`, flowCautions.has('hamstring'));
  }
  if (template.focusTags.includes('calves_ankles')) {
    ok(`${template.id} has calf/Achilles caution`, flowCautions.has('calf_achilles'));
  }
  if (template.focusTags.includes('lower_back_trunk')) {
    ok(`${template.id} has lower-back caution`, flowCautions.has('lower_back'));
  }
  if (template.focusTags.includes('shoulders_t_spine')) {
    ok(`${template.id} has shoulder caution`, flowCautions.has('shoulder'));
  }
  for (const caution of template.injuryCautions) {
    ok(`${template.id} ${caution.injury} caution text`, caution.caution.trim().length > 0 && caution.avoidWhen.trim().length > 0);
  }
}

section('[5] mobility flows stay recovery-tier in weekly counting');
for (const template of MOBILITY_FLOW_TEMPLATES) {
  const workout = workoutFromTemplate(template);
  const units = classifyDaySessions(workout);
  eq(`${template.id} classifies as one recovery unit`, units.length, 1);
  eq(`${template.id} category`, units[0]?.category, 'recovery');

  const counts = countWeeklyExposures([{ date: '2026-07-09', workout }]);
  eq(`${template.id} hard exposure count`, counts.hardExposures, 0);
  eq(`${template.id} main strength count`, counts.mainStrengthExposures, 0);
  eq(`${template.id} conditioning count`, counts.conditioningExposures, 0);
  eq(`${template.id} sprint/COD count`, counts.sprintCodExposures, 0);
  ok(`${template.id} has no conditioning credit`, template.conditioningCredit === 'none');
  ok(`${template.id} hard-exposure metadata is false`, template.hardExposure === false && template.mainStrength === false && template.sprintCodExposure === false);
}

if (fail > 0) {
  console.error(`\nmobilityFlowTemplateTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nmobilityFlowTemplateTests passed: ${pass}`);
