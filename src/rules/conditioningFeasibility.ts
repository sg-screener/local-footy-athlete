import type {
  ConditioningEquipmentModality,
  ConditioningFeasibilityDecision,
  OnboardingData,
  SeasonPhase,
} from '../types/domain';
import type { SessionAllocation } from '../utils/coachingEngine';
import type { GenerationConstraintContext } from '../utils/generationConstraints';
import type { ResolvedEquipmentCapabilities } from '../utils/equipmentAvailability';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
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

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function upperLimbRestriction(profile: OnboardingData | null | undefined): boolean {
  return (profile?.injuries ?? []).some((injury) =>
    injury.severity !== 'Mild' && /shoulder|elbow|wrist|upper arm|pec/i.test(injury.bodyArea));
}

function allowedErgs(
  equipmentModalities: readonly ConditioningEquipmentModality[],
  profile: OnboardingData | null | undefined,
): AllowedErgModality[] {
  const available = new Set(equipmentModalities);
  const upperRestricted = upperLimbRestriction(profile);
  const out: AllowedErgModality[] = [];
  if (available.has('bike')) out.push('bike');
  if (available.has('row') && !upperRestricted) out.push('row');
  if (available.has('ski') && !upperRestricted) out.push('ski');
  // Mixed easy work includes Bike plus Row/Ski. Never invent it from one erg.
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

function removedDecision(
  requested: ErgModality | undefined,
  allowed: AllowedErgModality[],
  reason: ConditioningFeasibilityDecision['reason'],
): ConditioningFeasibilityDecision {
  return {
    status: 'removed',
    ...(requested ? { requestedModality: requested } : {}),
    allowedModalities: allowed,
    reason,
  };
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
    conditioningFeasibility: decision,
  };
}

/**
 * One allocation boundary owns whether planned conditioning is feasible.
 * Prompt construction, edge normalisation and deterministic fallback consume
 * this serialisable result; none may independently reconstruct availability.
 */
export function resolveConditioningFeasibility(
  entry: SessionAllocation,
  context: ConditioningFeasibilityContext,
): SessionAllocation {
  if (!entry.conditioningCategory && !entry.conditioningFlavour) return { ...entry };

  const requested = entry.ergModality;
  const allowed = allowedErgs(context.equipment.conditioningModalities, context.profile);
  const readiness = context.generationConstraints?.readiness;
  if (readiness?.fullPause || (
    readiness?.avoidHardConditioning &&
    (entry.conditioningCategory === 'vo2' || entry.conditioningCategory === 'glycolytic')
  )) {
    return removeConditioning(entry, removedDecision(requested, allowed, 'readiness_blocks_conditioning'));
  }

  const requiresErg = entry.conditioningOffFeet === true ||
    entry.hasCombinedConditioning === true ||
    entry.conditioningCategory === 'aerobic_base';
  const runningPermitted = !requiresErg &&
    !(context.phase === 'Off-season' && context.offseasonSubphase === 'early_offseason');
  if (!requiresErg && runningPermitted) {
    return {
      ...entry,
      conditioningFeasibility: {
        status: 'feasible',
        ...(requested ? { requestedModality: requested } : {}),
        ...(requested ? { resolvedModality: requested } : {}),
        allowedModalities: allowed,
        reason: 'available_capability',
      },
    };
  }

  const canonical = canonicalRequested(requested);
  if (canonical && allowed.includes(canonical)) {
    return {
      ...entry,
      conditioningFeasibility: {
        status: 'feasible',
        requestedModality: requested,
        resolvedModality: requested,
        allowedModalities: allowed,
        reason: 'available_capability',
      },
    };
  }

  if (allowed.length === 0) {
    return removeConditioning(
      entry,
      removedDecision(requested, allowed, 'no_permitted_off_feet_modality'),
    );
  }

  // Preserve the existing 40/40/10/10 default when every normal option is
  // available. The downstream builder remains the deterministic dose owner.
  if (!requested && ['bike', 'row', 'ski', 'mixed'].every((modality) =>
    allowed.includes(modality as AllowedErgModality))) {
    return {
      ...entry,
      conditioningFeasibility: {
        status: 'feasible',
        allowedModalities: allowed,
        reason: 'available_capability',
      },
    };
  }

  const replacement = weightedOrder(entry.planEntryId ?? `${entry.dayOfWeek}:${entry.focus}`)
    .find((modality) => allowed.includes(modality))!;
  return {
    ...entry,
    ergModality: replacement,
    conditioningFeasibility: {
      status: requested ? 'replaced' : 'feasible',
      ...(requested ? { requestedModality: requested } : {}),
      resolvedModality: replacement,
      allowedModalities: allowed,
      reason: requested
        ? 'deterministic_available_replacement'
        : 'available_capability',
    },
  };
}

export function resolveWeeklyConditioningFeasibility(
  weeklyPlan: readonly SessionAllocation[],
  context: ConditioningFeasibilityContext,
): SessionAllocation[] {
  return weeklyPlan.map((entry) => resolveConditioningFeasibility(entry, context));
}
