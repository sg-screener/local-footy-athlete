/**
 * THE EQUIPMENT CHECKLIST FOR AN OPENED SESSION — A READER, AND ONLY A READER.
 *
 * It answers *"what kit does this session use, and which rows use it"* so the
 * sheet can draw the list, and it turns the athlete's ticks back into tags for
 * the `set_equipment_modifier` decision. **It chooses no exercise and writes
 * nothing.**
 *
 * ⚠ **IT USED TO CHOOSE.** `buildSessionEquipmentReplacementPlan` walked Sam's
 * fallback ladder here and handed the screen a list of `swap_exercise` actions
 * to commit — a second selection authority living outside the composer. Deleted
 * 2026-08-19 after it was measured INERT: across **2,038 real (athlete, session
 * date, implement subset) door walks** it produced replacements in **0**. The
 * dated equipment fact is written first, the composer recomposes the day against
 * the reduced kit, and by the time the screen asked there was never anything
 * illegal left. Confirmed on the simulator: the `"N exercises were replaced"`
 * receipt it existed to produce is unreachable.
 *
 * **The properties it used to be asked about are not lost** — they are held
 * against the real door by `npm run test:session-equipment-owner`: no visible
 * row is illegal on today's kit, an OR-group row survives, a replacement wears
 * its own load, and a world with no legal option shows a typed gap.
 *
 * The live Swap and Remove transactions were NOT touched. They are a different
 * door (`applySwapToday` in `DayWorkoutScreenV2`) and they still own
 * `swap_exercise` / `remove_exercise`.
 */
import type { EquipmentTag } from '../data/exercisePools';
import type { ConditioningEquipmentModality } from '../types/domain';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
} from '../rules/equipmentVocabulary';
import { equipmentTagsForRequirement } from './equipmentAvailability';
import { equipmentClassFor } from './loadEstimation';
import { inferModalityFromName } from './coachModalitySwap';
import {
  CONDITIONING_META,
  type ConditioningModality,
} from '../data/exerciseTags';

export type SessionEquipmentRequirementKey =
  | `tag:${EquipmentTag}`
  | `modality:${ConditioningEquipmentModality}`;

export interface SessionEquipmentRequirement {
  key: SessionEquipmentRequirementKey;
  kind: 'tag' | 'modality';
  value: EquipmentTag | ConditioningEquipmentModality;
  label: string;
  exerciseKeys: readonly string[];
  exerciseNames: readonly string[];
}

type SessionExercise = {
  key: string;
  name: string;
  targetId?: string;
  raw?: any;
};

const CLASS_TO_TAG: Readonly<Record<string, EquipmentTag>> = {
  barbell: 'barbell',
  dumbbell: 'dumbbells',
  cable: 'cables',
  machine: 'machine',
  kettlebell: 'kettlebell',
};

function conditioningEquipmentForModality(
  modality: ConditioningModality | null,
  name: string,
): ConditioningEquipmentModality | null {
  if (modality === 'row') return 'row';
  if (modality === 'ski') return 'ski';
  if (modality === 'bike') {
    return /\b(?:air|assault|echo|airdyne)\s*(?:bike)?\b/i.test(name)
      ? 'air_bike'
      : 'bike_erg';
  }
  if (/\btreadmill\b/i.test(name)) return 'treadmill';
  return null;
}

function conditioningEquipmentForName(
  name: string,
): ConditioningEquipmentModality | null {
  return conditioningEquipmentForModality(inferModalityFromName(name), name);
}

function conditioningEquipmentForRequirement(
  requirement: string,
): ConditioningEquipmentModality | null {
  const normalized = requirement.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (/\b(?:rower|row erg|rowing erg|rowing machine|concept ?2 rower)\b/.test(normalized)) return 'row';
  if (/\b(?:ski erg|skierg|ski machine)\b/.test(normalized)) return 'ski';
  if (/\b(?:assault bike|air bike|echo bike|airdyne)\b/.test(normalized)) return 'air_bike';
  if (/\b(?:bike erg|stationary bike|exercise bike|spin bike)\b/.test(normalized)) return 'bike_erg';
  if (/\btreadmill\b/.test(normalized)) return 'treadmill';
  return null;
}

/**
 * Conditioning machines come from conditioning metadata or an authored machine
 * requirement. Name inference remains only as a compatibility read for rows
 * that are explicitly Cardio/Conditioning (or carry no structured row at all),
 * so strength movement names such as Barbell Row cannot become a Row erg.
 */
function conditioningEquipmentForExercise(
  exercise: SessionExercise,
): ConditioningEquipmentModality | null {
  const authoredModality = CONDITIONING_META[exercise.name]?.modality ?? null;
  const authoredEquipment = conditioningEquipmentForModality(authoredModality, exercise.name);
  if (authoredEquipment) return authoredEquipment;

  const rawExercise = exercise.raw?.exercise;
  const requirements = rawExercise?.equipmentRequired ?? [];
  for (const requirement of requirements) {
    const equipment = conditioningEquipmentForRequirement(String(requirement));
    if (equipment) return equipment;
  }

  const exerciseType = String(rawExercise?.exerciseType ?? '');
  if (rawExercise && !/cardio|conditioning/i.test(exerciseType)) return null;
  return conditioningEquipmentForName(exercise.name);
}

function labelFor(
  kind: SessionEquipmentRequirement['kind'],
  value: EquipmentTag | ConditioningEquipmentModality,
): string {
  if (kind === 'modality') {
    return CONDITIONING_MODALITY_LABELS[value as ConditioningEquipmentModality];
  }
  return (EQUIPMENT_TAG_LABELS as Readonly<Record<string, string>>)[value] ?? value;
}

/**
 * The equipment checklist for an opened session. It reads only requirements
 * carried by that session's editable rows; it never expands back out to the
 * athlete's whole saved gym setup.
 */
export function deriveSessionEquipmentRequirements(
  exercises: readonly SessionExercise[],
): SessionEquipmentRequirement[] {
  const requirements = new Map<SessionEquipmentRequirementKey, {
    kind: SessionEquipmentRequirement['kind'];
    value: EquipmentTag | ConditioningEquipmentModality;
    exerciseKeys: Set<string>;
    exerciseNames: Set<string>;
  }>();

  const add = (
    kind: SessionEquipmentRequirement['kind'],
    value: EquipmentTag | ConditioningEquipmentModality,
    exercise: SessionExercise,
  ) => {
    if (value === 'bodyweight' || value === 'bike_or_treadmill') return;
    const key = `${kind}:${value}` as SessionEquipmentRequirementKey;
    const existing = requirements.get(key) ?? {
      kind,
      value,
      exerciseKeys: new Set<string>(),
      exerciseNames: new Set<string>(),
    };
    existing.exerciseKeys.add(exercise.key);
    existing.exerciseNames.add(exercise.name);
    requirements.set(key, existing);
  };

  for (const exercise of exercises) {
    const modality = conditioningEquipmentForExercise(exercise);
    if (modality) add('modality', modality, exercise);

    for (const rawRequirement of exercise.raw?.exercise?.equipmentRequired ?? []) {
      const tags = equipmentTagsForRequirement(String(rawRequirement));
      for (const tag of tags ?? []) {
        // A rower/bike/etc requirement is represented by the exact machine
        // modality above, not a second vague "cardio equipment" checkbox.
        if (tag === 'bike_or_treadmill' && modality) continue;
        add('tag', tag, exercise);
      }
    }

    const equipmentClass = equipmentClassFor(exercise.name);
    const inferredTag = equipmentClass ? CLASS_TO_TAG[equipmentClass] : null;
    if (inferredTag) add('tag', inferredTag, exercise);
  }

  return [...requirements.entries()]
    .map(([key, requirement]) => ({
      key,
      kind: requirement.kind,
      value: requirement.value,
      label: labelFor(requirement.kind, requirement.value),
      exerciseKeys: [...requirement.exerciseKeys],
      exerciseNames: [...requirement.exerciseNames],
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function missingSessionEquipmentValues(
  keys: ReadonlySet<SessionEquipmentRequirementKey>,
): {
  tags: EquipmentTag[];
  modalities: ConditioningEquipmentModality[];
} {
  const tags: EquipmentTag[] = [];
  const modalities: ConditioningEquipmentModality[] = [];
  for (const key of keys) {
    const [kind, value] = key.split(':') as ['tag' | 'modality', string];
    if (kind === 'tag') tags.push(value as EquipmentTag);
    else modalities.push(value as ConditioningEquipmentModality);
  }
  return { tags, modalities };
}
