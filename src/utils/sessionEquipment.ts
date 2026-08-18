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
// THE ONE STRENGTH-LEGALITY ORACLE, shared with generation and the composer.
// Imported so this sheet cannot hold a second opinion about whether a row is
// performable — see `buildSessionEquipmentReplacementPlan`.
import { exerciseAllowedByEquipment } from '../data/exercisePoolsStrength';
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
import {
  buildSwapSuggestionPayload,
  type SwapSuggestionPayload,
} from './swapSuggestionPayload';

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

/**
 * THE SAME PAYLOAD THE TAP-SWAP DOOR SENDS. It was declared separately and
 * identically, which is how the two doors came to disagree about the one rule
 * that fills it — see `replacementExercise` below. An alias, so a field cannot
 * be added to one door's replacement and not the other's.
 */
export type SessionEquipmentReplacementExercise = SwapSuggestionPayload;

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
/**
 * A conditioning row is blocked when the exact machine it names is one the
 * athlete has just said they cannot reach. Kept separate from
 * `exerciseAllowedByEquipment`, which answers for STRENGTH rows off Sam's sheet
 * and knows nothing about ergs — R-082: conditioning equipment is derived from
 * the modality, and there are only five.
 */
function conditioningRowIsBlocked(
  exercise: SessionExercise,
  missingModalities: ReadonlySet<ConditioningEquipmentModality>,
): boolean {
  const modality = conditioningEquipmentForExercise(exercise);
  return !!modality && missingModalities.has(modality);
}

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

/**
 * ⚠ **THIS FUNCTION WAS A FOURTH COPY OF THE SWAP PAYLOAD RULE, AND IT CARRIED
 * THE DEFECT THE OTHER THREE WERE FIXED FOR.** It read
 * `weight: prescription.weight ?? raw?.prescribedWeightKg` — the outgoing row's
 * load — which is the exact line `buildSwapSuggestionPayload` was extracted to
 * delete on 2026-08-18. Measured through the real equipment door the same week:
 * `RDLs (80 kg) -> Glute Bridge` arrived at **80 kg** while the load owner
 * answers UNSET for Glute Bridge, and `Landmine Press (35 kg) -> Half-Kneeling
 * Single-Arm Overhead Press` arrived at **35 kg** against its own estimate of 20.
 *
 * A rule with an owner does not get a second implementation because a second
 * door needed it. This now DELEGATES; the dose still carries over from the slot
 * and the load belongs to the exercise, exactly as the owner states it.
 */
function replacementExercise(
  name: string,
  raw: any,
  prescription: Partial<SessionEquipmentReplacementExercise> = {},
): SessionEquipmentReplacementExercise {
  return buildSwapSuggestionPayload(name, raw, prescription);
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
  // ── WHICH ROWS ARE ACTUALLY BLOCKED — ASKED OF THE ONE LEGALITY ORACLE ────
  //
  // **THIS USED TO CHARGE EVERY ROW THAT MENTIONED THE MISSING TAG, AND THAT IS
  // A DIFFERENT QUESTION FROM WHETHER THE ROW CAN STILL BE DONE.**
  // `deriveSessionEquipmentRequirements` answers *"what kit does this session
  // use"* by flat-mapping each row's display `equipmentRequired` labels onto
  // tags. Sam's authored sheet is not flat: `RDLs` is
  // `[['barbell', 'dumbbells']]` — **barbell OR dumbbells** — so an athlete who
  // unticks the barbell can still do it, and `exerciseAllowedByEquipment` says
  // so. The flat map turned that OR into an AND and charged `RDLs` as affected.
  //
  // Measured through the real door, 2026-08-18: unticking the barbell on a day
  // of `RDLs / Bulgarian Split Squats / Landmine Press / Barbell Row` swapped
  // out a perfectly legal `RDLs`, and re-opening the sheet still offered
  // `Barbell` — the app disagreeing with itself. **That disagreement was two
  // readers, not a restore authority putting the row back.** The previous
  // reading of this defect attributed it to
  // `finaliseWorkoutAfterMutation`'s restore pass; the restore was returning a
  // row that is LEGAL on the reduced kit, and the reader that called it illegal
  // was this one.
  //
  // `exerciseAllowedByEquipment` is the same oracle generation and the composer
  // use (it resolves Sam's sheet first and only falls back to the load
  // classifier for exercises he has not answered), so the sheet and the composer
  // can no longer come to different conclusions about one row.
  // ⚠ **THE TEST IS "NEWLY BLOCKED", NOT "BLOCKED", and the difference is a
  // whole extra swap the athlete never asked for.** Caught by
  // `test:session-execution-checklist` on the first cut of this change: an
  // athlete whose SAVED kit is barbell-without-rack unticked their ROWER, and a
  // plain legality test charged `Back Squat` too — because it was already
  // illegal, before this decision and independently of it. That is a real
  // (pre-existing) problem with their profile and it is not this door's to fix
  // silently while they are answering a question about a rowing machine.
  //
  // Sam's clause is *"no visible row may require REMOVED equipment"*. Removed
  // means removed by THIS answer, so the predicate is the pair: legal on the
  // kit before, illegal on the kit after.
  const legalBefore = (exercise: SessionExercise) =>
    exerciseAllowedByEquipment(exercise.name, args.capabilities.tags);
  const affected = args.exercises.filter((exercise) =>
    conditioningRowIsBlocked(exercise, missingModalities)
    || (legalBefore(exercise) && !exerciseAllowedByEquipment(exercise.name, remainingTags)));
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
