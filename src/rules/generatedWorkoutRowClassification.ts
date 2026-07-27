import {
  CONDITIONING_META,
  getExerciseTags,
  type ConditioningModality,
} from '../data/exerciseTags';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
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
  // A ROW'S MAIN-LIFT IDENTITY IS NOT ITS DOSE (Sam's deload law, 2026-07-27).
  //
  // The three clauses below all read the PRESCRIPTION — the load tag aside,
  // they ask how many sets the row was given and where it sits in the session.
  // Both are things a deload changes: it halves main-lift sets and trims
  // accessories out from in front of the lift. So a moderate-load anchor at 3
  // sets read as a main lift, and the same anchor at the deloaded 2 sets, now
  // third in the session, read as an accessory.
  //
  // That silently deleted a main-strength exposure from the week. It is the
  // deload law's forbidden move — "same week, same days; the structure doesn't
  // change, the work shrinks" — and because it happened by reclassification
  // rather than through a recorded reduction, every layer that audits
  // authorised reductions reported the week as untouched while §18 counted one
  // fewer session and rejected it.
  //
  // The pool registry already answers this by IDENTITY: `RDLs` is an anchor
  // lift whether it is prescribed for five sets or one. It is the same registry
  // the deload transform itself trusts to decide what it may trim, so deferring
  // to it here makes those two owners agree instead of contradicting each other
  // on the same row. The dose clauses stay for rows the registry does not know
  // — edge-authored, coach-inserted and legacy content — where a heuristic is
  // still the only thing available.
  const registryAnchorLift = classifyPoolSlot(canonicalName)?.role === 'anchor';
  const mainLift = !!mainPattern && (
    registryAnchorLift ||
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
