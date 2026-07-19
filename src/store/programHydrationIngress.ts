import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
} from './acceptedStateColdStart';
import { INJURY_EPISODE_PROTOCOL_VERSION } from '../rules/injuryEpisode';
import { TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION } from '../rules/temporarySourceFact';
import { REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION } from '../rules/reversibleAdjustmentLedger';
import { WEEKLY_EXPOSURE_CONTRACT_V2_VERSION } from '../rules/weeklyExposureContractV2';

/** Durable Zustand envelope version currently written by ProgramStore. */
export const PROGRAM_STORE_PERSISTENCE_VERSION = 0 as const;

export type ProgramHydrationIngressKind =
  | 'accepted_canonical'
  | 'legacy_precanonical'
  | 'migration_required'
  | 'invalid_or_ambiguous';

export interface ProgramHydrationIngressClassification {
  kind: ProgramHydrationIngressKind;
  persistenceVersion: number;
  reason: string;
}

export type AcceptedProgramHydrationIngressClassification =
  ProgramHydrationIngressClassification & {
    kind: Exclude<ProgramHydrationIngressKind, 'invalid_or_ambiguous'>;
  };

export class ProgramHydrationIngressError extends Error {
  readonly code = 'program_hydration_ingress_rejected' as const;

  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'ProgramHydrationIngressError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasEntries(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function hasMaterialProgramState(state: Record<string, unknown>): boolean {
  return !!state.currentProgram || !!state.currentMicrocycle || !!state.todayWorkout ||
    hasEntries(state.dateOverrides) || hasEntries(state.weekScopedOverlays) ||
    (Array.isArray(state.userRemovalConstraints) && state.userRemovalConstraints.length > 0);
}

function invalid(
  persistenceVersion: number,
  reason: string,
): ProgramHydrationIngressClassification {
  return { kind: 'invalid_or_ambiguous', persistenceVersion, reason };
}

function unsupportedProtocolReason(
  state: Record<string, unknown>,
): string | null {
  const context = isRecord(state.acceptedMaterialContext)
    ? state.acceptedMaterialContext
    : null;
  const base = context && isRecord(context.acceptedCompositionBase)
    ? context.acceptedCompositionBase
    : null;
  if (base && base.protocolVersion !== ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION) {
    return `unsupported_accepted_composition_base_protocol:${String(base.protocolVersion)}`;
  }
  const profile = context && isRecord(context.acceptedProfileSnapshot)
    ? context.acceptedProfileSnapshot
    : null;
  if (profile && profile.protocolVersion !== ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION) {
    return `unsupported_accepted_profile_snapshot_protocol:${String(profile.protocolVersion)}`;
  }
  const facts = context && Array.isArray(context.temporarySourceFacts)
    ? context.temporarySourceFacts
    : [];
  for (const fact of facts) {
    if (!isRecord(fact)) return 'invalid_temporary_source_fact:not_an_object';
    const expected = typeof fact.episodeId === 'string'
      ? INJURY_EPISODE_PROTOCOL_VERSION
      : TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION;
    if (fact.protocolVersion !== expected) {
      const identity = typeof fact.episodeId === 'string'
        ? fact.episodeId
        : typeof fact.factId === 'string' ? fact.factId : 'unknown';
      return `unsupported_temporary_source_fact_protocol:${identity}:${String(fact.protocolVersion)}`;
    }
  }
  const ledger = isRecord(state.reversibleAdjustmentLedger)
    ? state.reversibleAdjustmentLedger
    : null;
  if (ledger && ledger.protocolVersion !== REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION) {
    return `unsupported_reversible_adjustment_ledger_protocol:${String(ledger.protocolVersion)}`;
  }
  const baseLedger = base && isRecord(base.surfaces) &&
    isRecord(base.surfaces.reversibleAdjustmentLedger)
    ? base.surfaces.reversibleAdjustmentLedger
    : null;
  if (baseLedger && baseLedger.protocolVersion !== REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION) {
    return `unsupported_accepted_base_reversible_ledger_protocol:${String(baseLedger.protocolVersion)}`;
  }
  for (const contract of hydratedContracts(state)) {
    if (contract.protocolVersion !== WEEKLY_EXPOSURE_CONTRACT_V2_VERSION) {
      return `unsupported_weekly_exposure_contract_protocol:${String(contract.protocolVersion)}`;
    }
  }
  return null;
}

function hydratedContracts(state: Record<string, unknown>): Record<string, unknown>[] {
  const contracts: Record<string, unknown>[] = [];
  const collectMicrocycle = (value: unknown): void => {
    if (!isRecord(value) || !isRecord(value.exposureContractV2)) return;
    contracts.push(value.exposureContractV2);
  };
  const program = isRecord(state.currentProgram) ? state.currentProgram : null;
  if (program && Array.isArray(program.microcycles)) {
    program.microcycles.forEach(collectMicrocycle);
  }
  collectMicrocycle(state.currentMicrocycle);
  if (isRecord(state.weekScopedOverlays)) {
    for (const overlay of Object.values(state.weekScopedOverlays)) {
      if (isRecord(overlay) && isRecord(overlay.exposureContractV2)) {
        contracts.push(overlay.exposureContractV2);
      }
    }
  }
  const context = isRecord(state.acceptedMaterialContext)
    ? state.acceptedMaterialContext
    : null;
  const base = context && isRecord(context.acceptedCompositionBase)
    ? context.acceptedCompositionBase
    : null;
  if (base && isRecord(base.surfaces)) {
    contracts.push(...hydratedContracts(base.surfaces));
  }
  return contracts;
}

function programUsesCurrentContracts(state: Record<string, unknown>): boolean {
  const microcycles: unknown[] = [];
  const program = isRecord(state.currentProgram) ? state.currentProgram : null;
  if (program && Array.isArray(program.microcycles)) microcycles.push(...program.microcycles);
  if (state.currentMicrocycle) microcycles.push(state.currentMicrocycle);
  for (const microcycle of microcycles) {
    if (!isRecord(microcycle) ||
      !isRecord(microcycle.exposureContractV2) ||
      microcycle.exposureContractV2.protocolVersion !== WEEKLY_EXPOSURE_CONTRACT_V2_VERSION) {
      return false;
    }
  }
  if (isRecord(state.weekScopedOverlays)) {
    for (const overlay of Object.values(state.weekScopedOverlays)) {
      if (!isRecord(overlay)) return false;
      const hasWorkouts = hasEntries(overlay.workoutsByDate);
      if (hasWorkouts && (!isRecord(overlay.exposureContractV2) ||
        overlay.exposureContractV2.protocolVersion !== WEEKLY_EXPOSURE_CONTRACT_V2_VERSION)) {
        return false;
      }
    }
  }
  return true;
}

function hydratedWorkouts(state: Record<string, unknown>): Record<string, unknown>[] {
  const workouts: Record<string, unknown>[] = [];
  const collectWorkout = (value: unknown): void => {
    if (isRecord(value)) workouts.push(value);
  };
  const collectMicrocycle = (value: unknown): void => {
    if (!isRecord(value) || !Array.isArray(value.workouts)) return;
    value.workouts.forEach(collectWorkout);
  };
  const program = isRecord(state.currentProgram) ? state.currentProgram : null;
  if (program && Array.isArray(program.microcycles)) {
    program.microcycles.forEach(collectMicrocycle);
  }
  collectMicrocycle(state.currentMicrocycle);
  collectWorkout(state.todayWorkout);
  if (isRecord(state.dateOverrides)) Object.values(state.dateOverrides).forEach(collectWorkout);
  if (isRecord(state.weekScopedOverlays)) {
    for (const overlay of Object.values(state.weekScopedOverlays)) {
      if (isRecord(overlay) && isRecord(overlay.workoutsByDate)) {
        Object.values(overlay.workoutsByDate).forEach(collectWorkout);
      }
    }
  }
  return workouts;
}

function hasLegacyWorkoutSignature(state: Record<string, unknown>): boolean {
  return hydratedWorkouts(state).some((workout) => {
    const contributions = Array.isArray(workout.strengthPatternContributions)
      ? workout.strengthPatternContributions
      : [];
    const intent = workout.strengthIntent;
    if (contributions.length > 0 && !isRecord(intent)) return true;
    return intent !== undefined && (
      !isRecord(intent) || !Array.isArray(intent.plannedPatterns) ||
      !Array.isArray(intent.effectivePatterns)
    );
  });
}

function hasKnownLegacySignatures(state: Record<string, unknown>): boolean {
  const context = isRecord(state.acceptedMaterialContext)
    ? state.acceptedMaterialContext
    : null;
  const facts = context && Array.isArray(context.temporarySourceFacts)
    ? context.temporarySourceFacts
    : [];
  const base = context && isRecord(context.acceptedCompositionBase)
    ? context.acceptedCompositionBase
    : null;
  const ledger = isRecord(state.reversibleAdjustmentLedger)
    ? state.reversibleAdjustmentLedger
    : null;
  const legacyConstraints = context && Array.isArray(context.activeConstraints) &&
    context.activeConstraints.some((constraint) => isRecord(constraint) && (
      (constraint.type === 'injury' && !constraint.injuryEpisodeId) ||
      ((constraint.type === 'fatigue' || constraint.type === 'soreness' ||
        constraint.type === 'equipment' || constraint.type === 'schedule') &&
        (!Array.isArray(constraint.temporarySourceFactIds) ||
          constraint.temporarySourceFactIds.length === 0))
    ));
  const legacyInjuryCompatibility = !!context && facts.length === 0 && (
    (Array.isArray(context.injuryEpisodes) && context.injuryEpisodes.length > 0) ||
    (context.activeInjury !== null && context.activeInjury !== undefined)
  );
  const legacyAcceptedBase = !!base && isRecord(base.surfaces) && (
    !programUsesCurrentContracts(base.surfaces) || hasLegacyWorkoutSignature(base.surfaces) ||
    !isRecord(base.surfaces.reversibleAdjustmentLedger)
  );
  return !programUsesCurrentContracts(state) || hasLegacyWorkoutSignature(state) ||
    (!!context && !ledger) || (facts.length > 0 && !base) || !!legacyConstraints ||
    legacyInjuryCompatibility || legacyAcceptedBase;
}

function hasAcceptedCanonicalEvidence(state: Record<string, unknown>): boolean {
  const context = isRecord(state.acceptedMaterialContext)
    ? state.acceptedMaterialContext
    : null;
  if (!context) return false;
  const revision = context.revision;
  const profile = isRecord(context.acceptedProfileSnapshot)
    ? context.acceptedProfileSnapshot
    : null;
  const base = isRecord(context.acceptedCompositionBase)
    ? context.acceptedCompositionBase
    : null;
  const facts = Array.isArray(context.temporarySourceFacts)
    ? context.temporarySourceFacts
    : [];
  const ledger = isRecord(state.reversibleAdjustmentLedger)
    ? state.reversibleAdjustmentLedger
    : null;
  const currentEmptyEnvelope = !hasMaterialProgramState(state) && revision === 0 &&
    context.acceptedCompositionBase == null && context.acceptedProfileSnapshot == null;
  if (currentEmptyEnvelope) {
    return !!ledger && ledger.protocolVersion === REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION &&
      !hasKnownLegacySignatures(state);
  }
  if (typeof revision !== 'number' || revision <= 0 ||
    !profile || profile.protocolVersion !== ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION ||
    !isRecord(profile.onboardingData) ||
    !ledger || ledger.protocolVersion !== REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION) {
    return false;
  }
  if (base && (base.protocolVersion !== ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION ||
    !isRecord(base.surfaces))) {
    return false;
  }
  if (facts.length > 0 && !base) return false;
  return !hasKnownLegacySignatures(state);
}

/**
 * Decide who owns hydration before any normalizer can erase provenance.
 *
 * The persisted envelope version establishes the supported schema family;
 * accepted protocols then distinguish a current accepted snapshot from a
 * supported legacy shape that still needs structural migration.
 */
export function classifyProgramHydrationIngress(
  value: unknown,
  persistenceVersion: number,
): ProgramHydrationIngressClassification {
  if (persistenceVersion !== PROGRAM_STORE_PERSISTENCE_VERSION) {
    return invalid(
      persistenceVersion,
      `unsupported_program_store_persistence_version:${String(persistenceVersion)}`,
    );
  }
  if (!isRecord(value)) {
    return invalid(persistenceVersion, 'program_store_state_not_object');
  }
  const protocolFailure = unsupportedProtocolReason(value);
  if (protocolFailure) return invalid(persistenceVersion, protocolFailure);
  if (hasAcceptedCanonicalEvidence(value)) {
    return {
      kind: 'accepted_canonical',
      persistenceVersion,
      reason: 'current_accepted_protocols_verified',
    };
  }
  if (!hasMaterialProgramState(value)) {
    return {
      kind: 'legacy_precanonical',
      persistenceVersion,
      reason: 'supported_sparse_precanonical_envelope',
    };
  }
  if (hasKnownLegacySignatures(value)) {
    return {
      kind: 'migration_required',
      persistenceVersion,
      reason: 'supported_legacy_program_signatures',
    };
  }
  const context = isRecord(value.acceptedMaterialContext)
    ? value.acceptedMaterialContext
    : null;
  if (context && typeof context.revision === 'number' && context.revision > 0 &&
    isRecord(context.acceptedProfileSnapshot)) {
    return invalid(persistenceVersion, 'ambiguous_incomplete_accepted_envelope');
  }
  return {
    kind: 'migration_required',
    persistenceVersion,
    reason: 'supported_legacy_program_signatures',
  };
}

export function requireProgramHydrationIngress(
  value: unknown,
  persistenceVersion: number,
): AcceptedProgramHydrationIngressClassification {
  const classification = classifyProgramHydrationIngress(value, persistenceVersion);
  if (classification.kind === 'invalid_or_ambiguous') {
    throw new ProgramHydrationIngressError(classification.reason);
  }
  return classification as AcceptedProgramHydrationIngressClassification;
}
