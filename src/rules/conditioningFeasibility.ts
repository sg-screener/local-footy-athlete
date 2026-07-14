import type {
  ConditioningEquipmentModality,
  ConditioningFeasibilityDecision,
  ConditioningSubstitutionFamily,
  OnboardingData,
  SeasonPhase,
  Workout,
} from '../types/domain';
import type { SessionAllocation } from '../utils/coachingEngine';
import type { GenerationConstraintContext } from '../utils/generationConstraints';
import type { ResolvedEquipmentCapabilities } from '../utils/equipmentAvailability';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
import type { Section18EquipmentPolicyState } from './weeklyExposureContractV2';
import { selectDefaultAerobicErgModalityFromHash } from '../utils/sessionBuilder';

type ErgModality = NonNullable<SessionAllocation['ergModality']>;
type AllowedErgModality = Exclude<ErgModality, 'bike_erg'>;

export interface ConditioningFeasibilityContext {
  phase?: SeasonPhase | null;
  offseasonSubphase?: OffseasonSubphase | null;
  preseasonSubphase?: PreseasonSubphase | null;
  equipment: ResolvedEquipmentCapabilities;
  profile?: OnboardingData | null;
  generationConstraints?: GenerationConstraintContext;
}

export interface ConditioningSubstitutionPolicy extends Section18EquipmentPolicyState {
  /** Exact ordered families considered by the modality resolver. */
  attemptedFamilies: ConditioningSubstitutionFamily[];
  feasibilityReason: string;
}

const COARSE_SUBSTITUTIONS: Section18EquipmentPolicyState['consideredSubstitutions'] = [
  'available_ergs',
  'running',
  'hills',
  'walking',
  'bodyweight',
  'safe_mixed',
];

const ALL_FAMILIES: ConditioningSubstitutionFamily[] = [
  'selected_modality',
  'bike',
  'row',
  'ski',
  'treadmill',
  'outdoor_running',
  'hill_running_or_walking',
  'brisk_walking',
  'bodyweight_circuit',
  'safe_mixed_modal',
];

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function upperLimbRestriction(
  profile: OnboardingData | null | undefined,
  constraints?: GenerationConstraintContext,
): boolean {
  return (profile?.injuries ?? []).some((injury) =>
    injury.severity !== 'Mild' && /shoulder|elbow|wrist|upper arm|pec/i.test(injury.bodyArea)) ||
    !!constraints?.injuries.some((injury) =>
      injury.effectiveSeverity >= 4 && injury.region === 'upper_body');
}

function lowerLimbRestriction(
  profile: OnboardingData | null | undefined,
  constraints?: GenerationConstraintContext,
): boolean {
  return (profile?.injuries ?? []).some((injury) =>
    injury.severity !== 'Mild' &&
    /foot|ankle|achilles|calf|shin|knee|quad|hamstring|groin|hip|lower back|back/i.test(injury.bodyArea)) ||
    !!constraints?.injuries.some((injury) =>
      injury.effectiveSeverity >= 4 &&
      (injury.region === 'lower_body' || injury.region === 'back_midline'));
}

function allowedErgs(
  equipmentModalities: readonly ConditioningEquipmentModality[],
  profile: OnboardingData | null | undefined,
  constraints?: GenerationConstraintContext,
): AllowedErgModality[] {
  const available = new Set(equipmentModalities);
  const upperRestricted = upperLimbRestriction(profile, constraints);
  const out: AllowedErgModality[] = [];
  if (available.has('bike')) out.push('bike');
  if (available.has('row') && !upperRestricted) out.push('row');
  if (available.has('ski') && !upperRestricted) out.push('ski');
  if (available.has('bike') && !upperRestricted && (available.has('row') || available.has('ski'))) {
    out.push('mixed');
  }
  return out;
}

function canonicalRequested(modality: ErgModality | undefined): AllowedErgModality | undefined {
  return modality === 'bike_erg' ? 'bike' : modality;
}

function weightedOrder(seed: string): AllowedErgModality[] {
  const first = selectDefaultAerobicErgModalityFromHash(stableHash(seed));
  const orders: Record<AllowedErgModality, AllowedErgModality[]> = {
    bike: ['bike', 'mixed', 'row', 'ski'],
    mixed: ['mixed', 'bike', 'row', 'ski'],
    row: ['row', 'bike', 'mixed', 'ski'],
    ski: ['ski', 'mixed', 'bike', 'row'],
  };
  return orders[first];
}

function stripConditioningFocus(focus: string): string {
  const parts = focus.split('+').map((part) => part.trim()).filter(Boolean);
  const kept = parts.filter((part) =>
    !/conditioning|aerobic|tempo|interval|zone\s*2|finisher|off-feet/i.test(part));
  return kept.join(' + ') || 'Mobility, foam rolling, light movement';
}

function removeConditioning(
  entry: SessionAllocation,
  decision: ConditioningFeasibilityDecision,
): SessionAllocation {
  const strengthRemains = !!entry.strengthPattern || !!entry.strengthIntent?.plannedPatterns.length;
  return {
    ...entry,
    tier: strengthRemains ? entry.tier : 'recovery',
    focus: strengthRemains ? stripConditioningFocus(entry.focus) : 'Mobility, foam rolling, light movement',
    isHardExposure: strengthRemains ? entry.isHardExposure : false,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    conditioningVariant: undefined,
    conditioningFeel: undefined,
    conditioningOffFeet: undefined,
    ergModality: undefined,
    section18ConditioningRole: 'none',
    conditioningFeasibility: decision,
  };
}

function stressFor(entry: SessionAllocation): 'light' | 'moderate' | 'hard' {
  if (entry.conditioningCategory === 'vo2' || entry.conditioningCategory === 'glycolytic' ||
      entry.conditioningCategory === 'sprint' || entry.conditioningFlavour === 'high-intensity') {
    return 'hard';
  }
  if (entry.section18ConditioningRole === 'optional_flush' ||
      entry.section18ConditioningRole === 'optional_recovery_aerobic') return 'light';
  return 'moderate';
}

function substitutionDecision(args: {
  entry: SessionAllocation;
  context: ConditioningFeasibilityContext;
  allowed: AllowedErgModality[];
}): { family: ConditioningSubstitutionFamily; erg?: AllowedErgModality; attempted: ConditioningSubstitutionFamily[] } | null {
  const { entry, context, allowed } = args;
  const attempted: ConditioningSubstitutionFamily[] = ['selected_modality'];
  const canonical = canonicalRequested(entry.ergModality);
  if (canonical && allowed.includes(canonical)) {
    return { family: canonical, erg: canonical, attempted };
  }
  // With the full normal pool available, preserve the builder's deliberate
  // deterministic modality rotation. Feasibility owns whether the exposure
  // can survive; it does not collapse an already-valid mixed/default choice
  // to a single erg.
  if (!canonical && ['bike', 'row', 'ski', 'mixed'].every((candidate) =>
    allowed.includes(candidate as AllowedErgModality))) {
    return { family: 'selected_modality', attempted };
  }

  for (const candidate of weightedOrder(entry.planEntryId ?? `${entry.dayOfWeek}:${entry.focus}`)) {
    attempted.push(candidate);
    if (allowed.includes(candidate)) return { family: candidate, erg: candidate, attempted };
  }

  const modalities = new Set(context.equipment.conditioningModalities);
  attempted.push('treadmill');
  if (modalities.has('treadmill') && !lowerLimbRestriction(context.profile, context.generationConstraints)) {
    return { family: 'treadmill', attempted };
  }

  const lowerRestricted = lowerLimbRestriction(context.profile, context.generationConstraints);
  const upperRestricted = upperLimbRestriction(context.profile, context.generationConstraints);
  const readiness = context.generationConstraints?.readiness;
  const stress = stressFor(entry);
  const genuineSprint = entry.conditioningCategory === 'sprint';
  const runningSafe = !lowerRestricted && !entry.conditioningOffFeet &&
    !(genuineSprint && readiness?.avoidSprint);

  attempted.push('outdoor_running');
  if (runningSafe) return { family: 'outdoor_running', attempted };

  attempted.push('hill_running_or_walking');
  if (!lowerRestricted && !entry.conditioningOffFeet) {
    return { family: 'hill_running_or_walking', attempted };
  }

  attempted.push('brisk_walking');
  if (!lowerRestricted && stress !== 'hard' && !genuineSprint) {
    return { family: 'brisk_walking', attempted };
  }

  const bodyweightAvailable = context.equipment.tags.includes('bodyweight');
  attempted.push('bodyweight_circuit');
  if (bodyweightAvailable && !genuineSprint && !(lowerRestricted && upperRestricted)) {
    return { family: 'bodyweight_circuit', attempted };
  }

  attempted.push('safe_mixed_modal');
  if (bodyweightAvailable && !genuineSprint && !lowerRestricted && !upperRestricted) {
    return { family: 'safe_mixed_modal', attempted };
  }
  return null;
}

/**
 * Whole-week preflight used before target construction. Missing machines are
 * not global infeasibility: the contract is reduced only when every safe
 * equivalent family is unavailable.
 */
export function resolveConditioningSubstitutionPolicy(
  context: ConditioningFeasibilityContext,
): ConditioningSubstitutionPolicy {
  const fullPause = context.generationConstraints?.readiness?.fullPause === true;
  const lowerRestricted = lowerLimbRestriction(context.profile, context.generationConstraints);
  const upperRestricted = upperLimbRestriction(context.profile, context.generationConstraints);
  const ergs = allowedErgs(
    context.equipment.conditioningModalities,
    context.profile,
    context.generationConstraints,
  );
  const treadmill = context.equipment.conditioningModalities.includes('treadmill') && !lowerRestricted;
  const running = !lowerRestricted;
  const bodyweight = context.equipment.tags.includes('bodyweight') && !(lowerRestricted && upperRestricted);
  const feasible = !fullPause && (ergs.length > 0 || treadmill || running || bodyweight);
  const substitutionNeeded = feasible && ergs.length === 0;
  return {
    appConditioningFeasible: feasible,
    substitutionStatus: fullPause
      ? 'exhausted'
      : substitutionNeeded
        ? 'substituted'
        : feasible
          ? 'not_required'
          : 'exhausted',
    consideredSubstitutions: substitutionNeeded || !feasible ? [...COARSE_SUBSTITUTIONS] : [],
    attemptedFamilies: substitutionNeeded || !feasible ? [...ALL_FAMILIES] : ['selected_modality'],
    feasibilityReason: fullPause
      ? 'readiness_full_pause'
      : feasible
        ? substitutionNeeded ? 'safe_non_machine_substitute_available' : 'selected_or_machine_modality_available'
        : 'all_safe_equivalent_conditioning_families_exhausted',
  };
}

/**
 * One allocation boundary owns modality feasibility. It preserves role,
 * stress and purpose; a hard/core exposure is removed only after equivalent
 * machine, running, hill, walking, bodyweight and mixed-modal options have
 * been considered in order.
 */
export function resolveConditioningFeasibility(
  entry: SessionAllocation,
  context: ConditioningFeasibilityContext,
): SessionAllocation {
  if (!entry.conditioningCategory && !entry.conditioningFlavour) return { ...entry };

  const requested = entry.ergModality;
  const allowed = allowedErgs(
    context.equipment.conditioningModalities,
    context.profile,
    context.generationConstraints,
  );
  const readiness = context.generationConstraints?.readiness;
  if (readiness?.fullPause || (
    readiness?.avoidHardConditioning && stressFor(entry) === 'hard'
  )) {
    return removeConditioning(entry, {
      status: 'removed',
      ...(requested ? { requestedModality: requested } : {}),
      allowedModalities: allowed,
      attemptedSubstitutionFamilies: [],
      feasibilityDetail: readiness.fullPause
        ? 'full_pause_blocks_conditioning'
        : 'readiness_blocks_required_intensity',
      reason: 'readiness_blocks_conditioning',
    });
  }

  const resolved = substitutionDecision({ entry, context, allowed });
  if (!resolved) {
    return removeConditioning(entry, {
      status: 'removed',
      ...(requested ? { requestedModality: requested } : {}),
      allowedModalities: allowed,
      attemptedSubstitutionFamilies: [...ALL_FAMILIES],
      feasibilityDetail: `no_safe_equivalent_for_${entry.section18ConditioningRole ?? 'untyped'}_${stressFor(entry)}`,
      reason: 'no_safe_equivalent_substitute',
    });
  }

  const canonical = canonicalRequested(requested);
  const selectedWasAvailable = !!canonical && resolved.erg === canonical;
  const machineDefault = !requested && !!resolved.erg;
  const isReplacement = !selectedWasAvailable && !machineDefault;
  return {
    ...entry,
    ...(resolved.erg ? { ergModality: resolved.erg } : { ergModality: undefined }),
    ...(resolved.family === 'outdoor_running' || resolved.family === 'hill_running_or_walking'
      ? { conditioningOffFeet: false }
      : {}),
    conditioningFeasibility: {
      status: isReplacement ? 'replaced' : 'feasible',
      ...(requested ? { requestedModality: requested } : {}),
      ...(resolved.erg ? { resolvedModality: resolved.erg } : {}),
      allowedModalities: allowed,
      attemptedSubstitutionFamilies: resolved.attempted,
      resolvedSubstitutionFamily: resolved.family,
      feasibilityDetail: `preserved_${entry.section18ConditioningRole ?? 'untyped'}_${stressFor(entry)}_conditioning`,
      reason: isReplacement ? 'safe_equivalent_substitution' : 'available_capability',
    },
  };
}

export function resolveWeeklyConditioningFeasibility(
  weeklyPlan: readonly SessionAllocation[],
  context: ConditioningFeasibilityContext,
): SessionAllocation[] {
  return weeklyPlan.map((entry) => resolveConditioningFeasibility(entry, context));
}

/** Make a non-machine substitution real in canonical content, not metadata-only. */
export function applyResolvedConditioningSubstitution(workout: Workout): Workout {
  const family = workout.conditioningFeasibility?.resolvedSubstitutionFamily;
  if (!family || family === 'selected_modality' || family === 'bike' || family === 'row' ||
      family === 'ski' || family === 'mixed') {
    return workout;
  }
  const stress = workout.section18Evidence?.conditioningStress ??
    (workout.intensity === 'High' || workout.intensity === 'Maximal' ? 'hard' : 'moderate');
  const label = family === 'treadmill'
    ? stress === 'hard' ? 'Treadmill Intervals' : 'Treadmill Aerobic Work'
    : family === 'outdoor_running'
      ? stress === 'hard' ? 'Outdoor Running Intervals' : 'Outdoor Aerobic Run'
      : family === 'hill_running_or_walking'
        ? stress === 'hard' ? 'Hill Running Intervals' : 'Brisk Hill Walk'
        : family === 'brisk_walking'
          ? 'Brisk Walking'
          : family === 'bodyweight_circuit'
            ? 'Bodyweight Conditioning Circuit'
            : 'Mixed-Modal Conditioning Circuit';
  const description = stress === 'hard'
    ? 'Complete the prescribed hard work and recovery structure at the same intended session stress.'
    : stress === 'light'
      ? 'Keep this easy and conversational for the prescribed duration.'
      : 'Complete the prescribed controlled work at a moderate, repeatable effort.';
  const conditioningIds = new Set(
    workout.conditioningBlock?.options.flatMap((option) => option.exerciseIds) ??
      workout.exercises.filter((row) => row.section18Evidence?.role === 'conditioning').map((row) => row.id),
  );
  const exercises = workout.exercises.map((row) => conditioningIds.has(row.id)
    ? {
        ...row,
        exercise: row.exercise ? {
          ...row.exercise,
          name: label,
          description,
          equipmentRequired: family === 'treadmill' ? ['Treadmill'] : [],
        } : row.exercise,
      }
    : row);
  const allIds = Array.from(conditioningIds);
  return {
    ...workout,
    exercises,
    ...(workout.conditioningBlock ? {
      conditioningBlock: {
        ...workout.conditioningBlock,
        options: [{ title: label, description, exerciseIds: allIds }],
      },
    } : {}),
  };
}
