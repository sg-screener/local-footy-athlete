import {
  CONDITIONING_META,
  getExerciseTags,
  type ConditioningModality,
} from '../data/exerciseTags';
import { resolveExerciseName } from '../utils/loadEstimation';
import {
  mainPatternForExerciseMovement,
  type MainStrengthPattern,
} from './strengthPatternContributions';

export type GeneratedWorkoutRowKind =
  | 'strength_main'
  | 'strength_accessory'
  | 'power'
  | 'conditioning'
  | 'trunk_support'
  | 'recovery_addon';

export interface GeneratedWorkoutRowClassification {
  kind: GeneratedWorkoutRowKind;
  canonicalName: string;
  mainPattern: MainStrengthPattern | null;
  conditioningModality: ConditioningModality | null;
  hardConditioning: boolean;
  reason: string;
}

const CONDITIONING_FALLBACK_RX = /\b(?:zone\s*2|aerobic|tempo|interval|conditioning|repeat\s*effort|threshold|mas|sprint|run|jog|bike|rower|row\s*erg|rowerg|rowing\s*erg|ski(?:erg)?|erg)\b/i;
const POWER_FALLBACK_RX = /\b(?:broad|box|vertical|countermovement|depth|pogo|lateral)\s+jump|\bjump\s+squat|\bexplosive\s+(?:push|press)|\bclap\s+push|\bspeed\s+bench|\bplyo/i;
const SUPPORT_FALLBACK_RX = /\b(?:pallof|side\s+plank|dead\s+bug|bird\s+dog|woodchop|ab\s+wheel|trunk|core)\b/i;
const RECOVERY_FALLBACK_RX = /\b(?:mobility|foam\s+roll|tissue\s+quality|breathing|stretch|recovery\s+flow)\b/i;

function modalityFromText(text: string): ConditioningModality | null {
  if (/\bbike|cycling|airbike|assault\s*bike|echo\s*bike/i.test(text)) return 'bike';
  if (/\brow(?:er|erg|ing)?\b/i.test(text)) return 'row';
  if (/\bski(?:erg)?\b/i.test(text)) return 'ski';
  if (/\brun|jog|sprint|tempo\s+run/i.test(text)) return 'run';
  if (/\bswim/i.test(text)) return 'swim';
  if (/\bmixed|circuit/i.test(text)) return 'mixed';
  return null;
}

/** Registry first; conservative semantics only for edge-authored unknown names. */
export function classifyGeneratedWorkoutRow(args: {
  name: string;
  sets?: number;
  repsMax?: number;
  index?: number;
}): GeneratedWorkoutRowClassification {
  const rawName = String(args.name ?? '').trim();
  const canonicalName = resolveExerciseName(rawName);
  const tags = getExerciseTags(canonicalName);
  const conditioningMeta = CONDITIONING_META[canonicalName];

  if (tags?.power || (!tags && POWER_FALLBACK_RX.test(rawName))) {
    return {
      kind: 'power', canonicalName, mainPattern: null,
      conditioningModality: null, hardConditioning: false,
      reason: tags?.power ? 'registry_power' : 'semantic_power_fallback',
    };
  }

  if (tags?.movement === 'conditioning' || conditioningMeta || (!tags && CONDITIONING_FALLBACK_RX.test(rawName))) {
    const modality = conditioningMeta?.modality ?? modalityFromText(rawName);
    const hard = conditioningMeta
      ? conditioningMeta.tier === 'A' || conditioningMeta.tier === 'B-high'
      : /\b(?:hard|vo2|max\s*effort|sprint|tabata|mas|glycolytic)\b/i.test(rawName);
    return {
      kind: 'conditioning', canonicalName, mainPattern: null,
      conditioningModality: modality, hardConditioning: hard,
      reason: tags?.movement === 'conditioning' || conditioningMeta
        ? 'registry_conditioning'
        : 'semantic_conditioning_fallback',
    };
  }

  if (tags?.movement === 'core' || (!tags && SUPPORT_FALLBACK_RX.test(rawName))) {
    return {
      kind: 'trunk_support', canonicalName, mainPattern: null,
      conditioningModality: null, hardConditioning: false,
      reason: tags?.movement === 'core' ? 'registry_trunk_support' : 'semantic_support_fallback',
    };
  }

  if (!tags && RECOVERY_FALLBACK_RX.test(rawName)) {
    return {
      kind: 'recovery_addon', canonicalName, mainPattern: null,
      conditioningModality: null, hardConditioning: false,
      reason: 'semantic_recovery_fallback',
    };
  }

  const mainPattern = mainPatternForExerciseMovement(tags?.movement);
  const mainLift = !!mainPattern && (
    tags?.load === 'high' ||
    ((args.index ?? 99) <= 1 && tags?.load !== 'low') ||
    ((args.sets ?? 0) >= 3 && (args.repsMax ?? 99) <= 12 && tags?.load === 'moderate')
  );
  return {
    kind: mainLift ? 'strength_main' : 'strength_accessory',
    canonicalName,
    mainPattern,
    conditioningModality: null,
    hardConditioning: false,
    reason: tags ? (mainLift ? 'registry_main_strength' : 'registry_strength_accessory') : 'unknown_strength_accessory',
  };
}
