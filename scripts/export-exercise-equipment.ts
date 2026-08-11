/**
 * Export one current, source-aware equipment row per distinct exercise name.
 *
 * Run:
 *   npm exec -- sucrase-node scripts/export-exercise-equipment.ts
 *
 * The source-occurrence count and distinct-exercise count are both reported:
 * one name can legitimately appear in several authored catalogs, and flattening
 * those occurrences before comparing their assignments would hide drift.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { POOL_REGISTRY, type EquipmentTag } from '../src/data/exercisePools';
import { STRENGTH_POOLS } from '../src/data/exercisePoolsStrength';
import { POWER_EXERCISE_POOL } from '../src/rules/powerExercisePool';
import { DEFAULT_EXERCISES } from '../src/data/defaultProgram';
import { CONDITIONING_META } from '../src/data/exerciseTags';
import { CONDITIONING_TEMPLATES } from '../src/data/conditioningTemplates';
import { selectableExerciseNames } from '../src/data/selectableExerciseVocabulary';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
  templateModalitiesFromNotes,
} from '../src/rules/equipmentVocabulary';
import { equipmentTagsForRequirement } from '../src/utils/equipmentAvailability';
import { equipmentClassFor } from '../src/utils/loadEstimation';
import type { ConditioningEquipmentModality } from '../src/types/domain';

type SourceName =
  | 'pool_registry'
  | 'strength_pools'
  | 'power_pool'
  | 'default_exercises'
  | 'conditioning_meta'
  | 'conditioning_template';

interface Assignment {
  source: SourceName;
  context: string;
  exercise: string;
  keys: string[];
  rawRequirements: string[];
}

const CLASS_TO_TAG: Readonly<Record<string, EquipmentTag>> = {
  barbell: 'barbell',
  dumbbell: 'dumbbells',
  cable: 'cables',
  machine: 'machine',
  kettlebell: 'kettlebell',
  bodyweight: 'bodyweight',
};

const META_TO_EQUIPMENT: Readonly<Record<string, ConditioningEquipmentModality | null>> = {
  bike: 'bike_erg',
  air_bike: 'air_bike',
  row: 'row',
  ski: 'ski',
  run: null,
  swim: null,
  mixed: null,
};

const LABELS: Readonly<Record<string, string>> = {
  bodyweight: 'Bodyweight / no equipment',
  bike_or_treadmill: 'Cardio equipment (coarse tag)',
  ...EQUIPMENT_TAG_LABELS,
  ...Object.fromEntries(
    Object.entries(CONDITIONING_MODALITY_LABELS)
      .map(([key, label]) => [`modality:${key}`, label]),
  ),
};

const assignments: Assignment[] = [];

function mappedRequirements(requirements: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const requirement of requirements) {
    for (const tag of equipmentTagsForRequirement(requirement) ?? []) keys.add(tag);
  }
  return [...keys].sort();
}

function add(assignment: Assignment): void {
  assignments.push({
    ...assignment,
    keys: [...new Set(assignment.keys)].sort(),
    rawRequirements: [...new Set(assignment.rawRequirements)].sort(),
  });
}

for (const [category, pool] of Object.entries(POOL_REGISTRY)) {
  for (const exercise of pool) {
    add({
      source: 'pool_registry',
      context: category,
      exercise: exercise.name,
      keys: [...exercise.equipment],
      rawRequirements: [...exercise.equipment],
    });
  }
}

for (const [slot, pool] of Object.entries(STRENGTH_POOLS)) {
  for (const definition of [pool.anchor, pool.accessory]) {
    for (const entry of definition.entries) {
      const equipmentClass = equipmentClassFor(entry.name);
      const tag = equipmentClass ? CLASS_TO_TAG[equipmentClass] : undefined;
      add({
        source: 'strength_pools',
        context: `${slot}/${definition.role}`,
        exercise: entry.name,
        keys: tag ? [tag] : [],
        rawRequirements: equipmentClass ? [`load-authority:${equipmentClass}`] : [],
      });
    }
  }
}

for (const exercise of POWER_EXERCISE_POOL) {
  add({
    source: 'power_pool',
    context: exercise.family,
    exercise: exercise.name,
    // The pool's typed contract says an empty equipmentRequired list is
    // bodyweight; record that explicit meaning rather than calling it unknown.
    keys: exercise.equipmentRequired.length > 0
      ? mappedRequirements(exercise.equipmentRequired)
      : ['bodyweight'],
    rawRequirements: exercise.equipmentRequired.length > 0
      ? [...exercise.equipmentRequired]
      : ['empty = bodyweight (power-pool contract)'],
  });
}

for (const exercise of DEFAULT_EXERCISES) {
  const rawRequirements = exercise.equipmentRequired ?? [];
  const rawTags = mappedRequirements(rawRequirements);
  const equipmentClass = equipmentClassFor(exercise.name);
  const inferredTag = equipmentClass ? CLASS_TO_TAG[equipmentClass] : undefined;
  add({
    source: 'default_exercises',
    context: exercise.exerciseType,
    exercise: exercise.name,
    // This mirrors the opened-session checklist: authored raw requirements
    // plus the load-authority classification when that owner knows the name.
    keys: [...rawTags, ...(inferredTag ? [inferredTag] : [])],
    rawRequirements: [
      ...rawRequirements,
      ...(inferredTag && !rawTags.includes(inferredTag)
        ? [`load-authority:${equipmentClass}`]
        : []),
    ],
  });
}

for (const [name, meta] of Object.entries(CONDITIONING_META)) {
  const equipment = META_TO_EQUIPMENT[meta.modality];
  add({
    source: 'conditioning_meta',
    context: `${meta.tier}/${meta.modality}`,
    exercise: name,
    keys: equipment ? [`modality:${equipment}`] : [],
    rawRequirements: [`semantic-modality:${meta.modality}`],
  });
}

for (const template of CONDITIONING_TEMPLATES) {
  const modalities = templateModalitiesFromNotes(template.modalityNotes);
  add({
    source: 'conditioning_template',
    context: template.quality,
    exercise: template.name,
    keys: modalities.map((modality) => `modality:${modality}`),
    rawRequirements: [`modalityNotes:${template.modalityNotes}`],
  });
}

const byExercise = new Map<string, Assignment[]>();
for (const assignment of assignments) {
  const current = byExercise.get(assignment.exercise) ?? [];
  current.push(assignment);
  byExercise.set(assignment.exercise, current);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const header = [
  'exercise_name',
  'selectable_by_generator',
  'current_equipment_keys',
  'athlete_equipment_labels',
  'source_assignment_variants',
  'sources',
  'source_occurrence_count',
  'raw_requirements',
  'review_flag',
];

const selectableNames = new Set(selectableExerciseNames());
const selectableMissingFromExport = [...selectableNames]
  .filter((name) => !byExercise.has(name))
  .sort();
if (selectableMissingFromExport.length > 0) {
  throw new Error(
    `Selectable exercises missing from equipment export: ${selectableMissingFromExport.join(', ')}`,
  );
}

let unassignedDistinct = 0;
let multipleAssignmentDistinct = 0;
const rows = [...byExercise.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([exercise, exerciseAssignments]) => {
    const keys = [...new Set(exerciseAssignments.flatMap((entry) => entry.keys))].sort();
    const variants = [...new Set(exerciseAssignments.map((entry) =>
      entry.keys.length > 0 ? entry.keys.join('+') : 'none'))].sort();
    const sources = [...new Set(exerciseAssignments.map((entry) => entry.source))].sort();
    const rawRequirements = [...new Set(
      exerciseAssignments.flatMap((entry) => entry.rawRequirements),
    )].sort();
    const sourceAssignments = [...new Set(exerciseAssignments.map((entry) =>
      `${entry.source}/${entry.context}=${entry.keys.length > 0 ? entry.keys.join('+') : 'none'}`,
    ))].sort();

    const semanticallyClassifiedWithoutEquipment = rawRequirements.some((requirement) =>
      /^semantic-modality:(?:run|swim|mixed)$/.test(requirement));
    let reviewFlag = 'OK';
    if (keys.length === 0 && !semanticallyClassifiedWithoutEquipment) {
      reviewFlag = 'NO_CURRENT_EQUIPMENT_ASSIGNMENT';
      unassignedDistinct += 1;
    } else if (variants.length > 1) {
      reviewFlag = 'MULTIPLE_SOURCE_ASSIGNMENTS';
      multipleAssignmentDistinct += 1;
    }

    return [
      exercise,
      selectableNames.has(exercise) ? 'yes' : 'no',
      keys.length > 0 ? keys.join(' | ') : 'none',
      keys.length > 0 ? keys.map((key) => LABELS[key] ?? key).join(' | ') : 'None shown',
      sourceAssignments.join(' ; '),
      sources.join(' | '),
      exerciseAssignments.length,
      rawRequirements.length > 0 ? rawRequirements.join(' | ') : 'none',
      reviewFlag,
    ].map(csvCell).join(',');
  });

const outputPath = path.resolve(
  process.argv[2] ?? 'docs/EXERCISE_EQUIPMENT_CURRENT_2026-08-11.csv',
);
fs.writeFileSync(outputPath, `${header.map(csvCell).join(',')}\n${rows.join('\n')}\n`, 'utf8');

const sourceCounts = new Map<SourceName, number>();
for (const assignment of assignments) {
  sourceCounts.set(assignment.source, (sourceCounts.get(assignment.source) ?? 0) + 1);
}

console.log(JSON.stringify({
  outputPath,
  sourceOccurrences: assignments.length,
  distinctExercises: byExercise.size,
  selectableDistinctExercises: selectableNames.size,
  nonSelectableButAuthoredDistinctExercises:
    [...byExercise.keys()].filter((name) => !selectableNames.has(name)).length,
  unassignedDistinct,
  multipleAssignmentDistinct,
  sourceOccurrenceCounts: Object.fromEntries([...sourceCounts.entries()].sort()),
}, null, 2));
