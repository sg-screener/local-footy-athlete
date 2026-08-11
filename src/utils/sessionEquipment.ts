import type { EquipmentTag } from '../data/exercisePools';
import type { ConditioningEquipmentModality } from '../types/domain';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
} from '../rules/equipmentVocabulary';
import {
  equipmentTagsForRequirement,
  equipmentTagsToSubstituteEquipmentClasses,
  type ResolvedEquipmentCapabilities,
} from './equipmentAvailability';
import { equipmentClassFor } from './loadEstimation';
import {
  inferModalityFromName,
  pickEquivalentByTier,
  rewriteModalityInName,
} from './coachModalitySwap';
import {
  CONDITIONING_META,
  type ConditioningModality,
} from '../data/exerciseTags';
import {
  getTapSwapChoices,
  type TapSwapEnvironment,
} from './tapSwapHierarchy';

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

export interface SessionEquipmentReplacementExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weight?: number;
  notes?: string;
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
  perSide?: boolean;
  restSeconds?: number;
}

export type SessionEquipmentReplacementPlan =
  | {
      ok: true;
      replacements: Array<{
        exerciseKey: string;
        targetId?: string;
        fromExercise: string;
        toExercise: SessionEquipmentReplacementExercise;
      }>;
    }
  | { ok: false; exerciseName: string };

const CLASS_TO_TAG: Readonly<Record<string, EquipmentTag>> = {
  barbell: 'barbell',
  dumbbell: 'dumbbells',
  cable: 'cables',
  machine: 'machine',
  kettlebell: 'kettlebell',
};

const MACHINE_MODALITY_ORDER: readonly ConditioningEquipmentModality[] = [
  'bike_erg',
  'air_bike',
  'row',
  'ski',
  'treadmill',
];

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

function trainingModality(
  equipment: ConditioningEquipmentModality,
): ConditioningModality {
  if (equipment === 'row') return 'row';
  if (equipment === 'ski') return 'ski';
  if (equipment === 'treadmill') return 'run';
  return 'bike';
}

/**
 * Pick the first still-available machine and preserve the conditioning tier.
 * The athlete's saved kit controls the candidates; unticking a rower can yield
 * a bike only when a bike is actually in that kit.
 */
export function sessionConditioningReplacementName(args: {
  exerciseName: string;
  availableModalities: readonly ConditioningEquipmentModality[];
  missingModalities: ReadonlySet<ConditioningEquipmentModality>;
}): string | null {
  const original = conditioningEquipmentForName(args.exerciseName);
  if (!original || !args.missingModalities.has(original)) return null;
  const target = MACHINE_MODALITY_ORDER.find((candidate) =>
    candidate !== original &&
    args.availableModalities.includes(candidate) &&
    !args.missingModalities.has(candidate));
  if (!target) return null;
  const modality = trainingModality(target);
  return pickEquivalentByTier(args.exerciseName, modality) ??
    rewriteModalityInName(args.exerciseName, modality, {
      bikeLabel: target === 'air_bike' ? 'assault' : 'standard',
    });
}

function replacementExercise(
  name: string,
  raw: any,
  prescription: Partial<SessionEquipmentReplacementExercise> = {},
): SessionEquipmentReplacementExercise {
  const sets = Number(raw?.prescribedSets) || 3;
  const repsMin = Number(raw?.prescribedRepsMin) || 8;
  const repsMax = Number(raw?.prescribedRepsMax) || Math.max(repsMin, 10);
  return {
    name,
    sets,
    repsMin,
    repsMax,
    weight: prescription.weight ?? raw?.prescribedWeightKg,
    notes: prescription.notes,
    prescriptionType: prescription.prescriptionType ?? raw?.prescriptionType,
    perSide: prescription.perSide ?? raw?.perSide,
    restSeconds: prescription.restSeconds ?? raw?.restSeconds,
    ...prescription,
  };
}

/**
 * Pure owner for the whole-session replacement decision. Screens provide the
 * live profile/safety environment and commit the returned actions; they do not
 * decide which equipment remains or which exercise replaces which row.
 */
export function buildSessionEquipmentReplacementPlan(args: {
  exercises: readonly SessionExercise[];
  requirements: readonly SessionEquipmentRequirement[];
  missingKeys: ReadonlySet<SessionEquipmentRequirementKey>;
  capabilities: ResolvedEquipmentCapabilities;
  environment: TapSwapEnvironment;
}): SessionEquipmentReplacementPlan {
  const missing = missingSessionEquipmentValues(args.missingKeys);
  const missingTags = new Set(missing.tags);
  const missingModalities = new Set(missing.modalities);
  const remainingModalities = args.capabilities.conditioningModalities.filter(
    (modality) => !missingModalities.has(modality),
  );
  const remainingTags = args.capabilities.tags.filter((tag) =>
    !missingTags.has(tag)
      && (tag !== 'bike_or_treadmill' || remainingModalities.length > 0),
  );
  const environment: TapSwapEnvironment = {
    ...args.environment,
    availableEquipmentTags: remainingTags,
    availableEquipment: equipmentTagsToSubstituteEquipmentClasses(remainingTags),
    hasEquipmentConstraint: true,
  };
  const affectedKeys = new Set(
    args.requirements
      .filter((requirement) => args.missingKeys.has(requirement.key))
      .flatMap((requirement) => requirement.exerciseKeys),
  );
  const affected = args.exercises.filter((exercise) => affectedKeys.has(exercise.key));
  const occupiedNames = new Set(args.exercises.map((exercise) => exercise.name.toLowerCase()));
  const replacements: Extract<SessionEquipmentReplacementPlan, { ok: true }>['replacements'] = [];

  for (const exercise of affected) {
    let replacementName = sessionConditioningReplacementName({
      exerciseName: exercise.name,
      availableModalities: remainingModalities,
      missingModalities,
    });
    let toExercise = replacementName
      ? replacementExercise(replacementName, exercise.raw)
      : null;

    if (!toExercise) {
      const choice = getTapSwapChoices({
        originalExercise: exercise.name,
        reason: 'no_equipment',
        environment,
        existingExerciseNames: [...occupiedNames],
        recoveryAllowed: false,
      }).find((candidate) => candidate.kind !== 'rest' && !!candidate.name);
      if (choice?.name) {
        replacementName = choice.name;
        toExercise = replacementExercise(choice.name, exercise.raw, choice.prescription ?? {});
      }
    }

    if (!toExercise || !replacementName || occupiedNames.has(replacementName.toLowerCase())) {
      return { ok: false, exerciseName: exercise.name };
    }
    occupiedNames.add(replacementName.toLowerCase());
    replacements.push({
      exerciseKey: exercise.key,
      targetId: exercise.targetId,
      fromExercise: exercise.name,
      toExercise,
    });
  }

  return { ok: true, replacements };
}
